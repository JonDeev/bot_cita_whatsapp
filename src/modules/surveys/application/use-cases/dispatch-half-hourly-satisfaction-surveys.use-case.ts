import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { SATISFACTION_SURVEY_DISPATCH_STATUSES } from '../../domain/ports/survey-dispatch.repository';
import {
  SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY,
  SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY,
  SURVEY_RECIPIENT_POLICY_REPOSITORY,
} from '../../domain/surveys.tokens';
import type {
  SatisfactionSurveyEligibilityRepository,
  SatisfactionSurveyEligibleAppointment,
} from '../../domain/ports/satisfaction-survey-eligibility.repository';
import {
  SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES,
  type SatisfactionSurveyLegacyStatusRepository,
} from '../../domain/ports/satisfaction-survey-legacy-status.repository';
import type { SurveyRecipientPolicyRepository } from '../../domain/ports/survey-recipient-policy.repository';
import { CreateSatisfactionSurveyDispatchUseCase } from './create-satisfaction-survey-dispatch.use-case';
import { SendSatisfactionSurveyPhoneVerificationUseCase } from './send-satisfaction-survey-phone-verification.use-case';
import { SendSatisfactionSurveyFlowInvitationUseCase } from './send-satisfaction-survey-flow-invitation.use-case';
import { SatisfactionSurveyRuntimeSettingsResolverService } from '../services/satisfaction-survey-runtime-settings-resolver.service';
import { SatisfactionSurveyDispatchWindowService } from '../services/satisfaction-survey-dispatch-window.service';
import { SurveyWhatsappPhoneNormalizerService } from '../services/survey-whatsapp-phone-normalizer.service';

interface DispatchCandidate {
  patientLegacyUserId: number;
  patientName: string;
  patientPhone: string;
  requiresPhoneVerification: boolean;
  appointments: SatisfactionSurveyEligibleAppointment[];
}

export interface DispatchHalfHourlySatisfactionSurveysInput {
  runAtIso?: string;
}

export interface DispatchHalfHourlySatisfactionSurveysResult {
  skipped: boolean;
  skipReason?: string;
  runAtIso: string;
  surveyDateIso?: string;
  windowStartHHmm?: string;
  windowEndHHmm?: string;
  eligibleAppointments: number;
  createdDispatches: number;
  sentDispatches: number;
  verificationSentDispatches: number;
  reusedDispatches: number;
  markedAsNotApplicable: number;
  markedAsSent: number;
  failedDispatches: number;
}

@Injectable()
export class DispatchHalfHourlySatisfactionSurveysUseCase {
  private readonly logger = new Logger(
    DispatchHalfHourlySatisfactionSurveysUseCase.name,
  );

  constructor(
    @Inject(SATISFACTION_SURVEY_ELIGIBILITY_REPOSITORY)
    private readonly eligibilityRepository: SatisfactionSurveyEligibilityRepository,
    @Inject(SATISFACTION_SURVEY_LEGACY_STATUS_REPOSITORY)
    private readonly legacyStatusRepository: SatisfactionSurveyLegacyStatusRepository,
    @Inject(SURVEY_RECIPIENT_POLICY_REPOSITORY)
    private readonly recipientPolicyRepository: SurveyRecipientPolicyRepository,
    private readonly dispatchWindowService: SatisfactionSurveyDispatchWindowService,
    private readonly runtimeSettingsResolver: SatisfactionSurveyRuntimeSettingsResolverService,
    private readonly createSurveyDispatch: CreateSatisfactionSurveyDispatchUseCase,
    private readonly sendSurveyPhoneVerification: SendSatisfactionSurveyPhoneVerificationUseCase,
    private readonly sendSurveyFlowInvitation: SendSatisfactionSurveyFlowInvitationUseCase,
    private readonly phoneNormalizer: SurveyWhatsappPhoneNormalizerService,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    input: DispatchHalfHourlySatisfactionSurveysInput = {},
  ): Promise<DispatchHalfHourlySatisfactionSurveysResult> {
    const runAt = this.resolveRunAt(input.runAtIso);
    const runAtIso = runAt.toISOString();
    const runtimeSettings =
      await this.runtimeSettingsResolver.resolveStoredSnapshot();

    if (!runtimeSettings.dispatchEnabled) {
      await this.auditService.record('survey.dispatch.batch.skipped_disabled', {
        runAtIso,
        reason: 'Dispatching is disabled in runtime settings.',
      });

      return {
        skipped: true,
        skipReason: 'Dispatching is disabled in runtime settings.',
        runAtIso,
        eligibleAppointments: 0,
        createdDispatches: 0,
        sentDispatches: 0,
        verificationSentDispatches: 0,
        reusedDispatches: 0,
        markedAsNotApplicable: 0,
        markedAsSent: 0,
        failedDispatches: 0,
      };
    }

    const windowResult = this.dispatchWindowService.resolveForRunAt(
      runAt,
      runtimeSettings.scheduleProfile,
      runtimeSettings.expirationHours,
    );
    if (!windowResult.shouldRun || !windowResult.window) {
      const reason = windowResult.reason ?? 'Unknown schedule reason.';
      await this.auditService.record('survey.dispatch.batch.skipped_window', {
        runAtIso,
        reason,
      });

      return {
        skipped: true,
        skipReason: reason,
        runAtIso,
        eligibleAppointments: 0,
        createdDispatches: 0,
        sentDispatches: 0,
        verificationSentDispatches: 0,
        reusedDispatches: 0,
        markedAsNotApplicable: 0,
        markedAsSent: 0,
        failedDispatches: 0,
      };
    }

    const window = windowResult.window;
    const appointments =
      await this.eligibilityRepository.findEligibleAppointmentsByWindow({
        surveyDateIso: window.surveyDateIso,
        windowStartHHmm: window.windowStartHHmm,
        windowEndHHmm: window.windowEndHHmm,
        limit: runtimeSettings.eligibilityLimit,
      });

    await this.auditService.record('survey.eligibility.found', {
      runAtIso,
      surveyDateIso: window.surveyDateIso,
      windowStartHHmm: window.windowStartHHmm,
      windowEndHHmm: window.windowEndHHmm,
      count: appointments.length,
    });

    const classification = await this.classifyAppointments(appointments);

    let markedAsNotApplicable = 0;
    if (classification.noApplicableAgendaIds.length > 0) {
      markedAsNotApplicable =
        await this.legacyStatusRepository.updateAgendaSurveyNotificationStatus({
          legacyAgendaIds: classification.noApplicableAgendaIds,
          status:
            SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
        });
    }

    let createdDispatches = 0;
    let reusedDispatches = 0;
    let sentDispatches = 0;
    let verificationSentDispatches = 0;
    let markedAsSent = 0;
    let failedDispatches = 0;

    const dispatchCandidates = classification.dispatchCandidates.slice(
      0,
      runtimeSettings.maxDispatchesPerRun,
    );

    if (dispatchCandidates.length < classification.dispatchCandidates.length) {
      await this.auditService.record('survey.dispatch.batch.truncated', {
        runAtIso,
        scheduleProfile: runtimeSettings.scheduleProfile,
        eligibilityLimit: runtimeSettings.eligibilityLimit,
        maxDispatchesPerRun: runtimeSettings.maxDispatchesPerRun,
        truncatedCandidates:
          classification.dispatchCandidates.length - dispatchCandidates.length,
      });
    }

    for (const candidate of dispatchCandidates) {
      try {
        const dispatchResult = await this.createSurveyDispatch.execute({
          patientLegacyUserId: candidate.patientLegacyUserId,
          patientName: candidate.patientName,
          patientPhone: candidate.patientPhone,
          surveyDateIso: window.surveyDateIso,
          triggerType: 'POST_APPOINTMENT_HALF_HOUR_BATCH',
          windowStartIso: window.windowStartIso,
          windowEndIso: window.windowEndIso,
          expiresAtIso: window.expiresAtIso,
          appointments: candidate.appointments.map((appointment) => ({
            legacyAgendaId: appointment.legacyAgendaId,
            appointmentDateIso: appointment.appointmentDateIso,
            appointmentTimeHhmm: appointment.appointmentTimeHhmm,
            specialtyName: appointment.specialtyName,
            doctorName: appointment.doctorName,
            siteName: appointment.siteName,
          })),
        });

        if (dispatchResult.wasCreated) {
          createdDispatches += 1;
        } else {
          reusedDispatches += 1;
        }

        const dispatchStatus = dispatchResult.dispatch.status;
        const agendaIds = candidate.appointments.map(
          (appointment) => appointment.legacyAgendaId,
        );

        if (
          dispatchStatus === SATISFACTION_SURVEY_DISPATCH_STATUSES.SENT ||
          dispatchStatus === SATISFACTION_SURVEY_DISPATCH_STATUSES.STARTED ||
          dispatchStatus === SATISFACTION_SURVEY_DISPATCH_STATUSES.COMPLETED ||
          dispatchStatus === SATISFACTION_SURVEY_DISPATCH_STATUSES.DECLINED ||
          dispatchStatus === SATISFACTION_SURVEY_DISPATCH_STATUSES.EXPIRED ||
          dispatchStatus ===
            SATISFACTION_SURVEY_DISPATCH_STATUSES.CANCELLED_BY_HANDOFF ||
          dispatchStatus ===
            SATISFACTION_SURVEY_DISPATCH_STATUSES.BLOCKED_CONTACT
        ) {
          const updated =
            await this.legacyStatusRepository.updateAgendaSurveyNotificationStatus(
              {
                legacyAgendaIds: agendaIds,
                status:
                  SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.NOT_APPLICABLE,
              },
            );
          markedAsNotApplicable += updated;
          continue;
        }

        if (candidate.requiresPhoneVerification) {
          const verificationResult =
            await this.sendSurveyPhoneVerification.execute({
              dispatchId: dispatchResult.dispatch.id,
            });

          if (verificationResult.wasSent) {
            verificationSentDispatches += 1;
          }

          continue;
        }

        await this.sendSurveyFlowInvitation.execute({
          dispatchId: dispatchResult.dispatch.id,
        });

        sentDispatches += 1;
        const updated =
          await this.legacyStatusRepository.updateAgendaSurveyNotificationStatus(
            {
              legacyAgendaIds: agendaIds,
              status: SATISFACTION_SURVEY_LEGACY_NOTIFICATION_STATUSES.SENT,
            },
          );
        markedAsSent += updated;
      } catch (error) {
        failedDispatches += 1;
        this.logger.error(
          `Failed processing satisfaction survey dispatch for patient ${candidate.patientLegacyUserId}.`,
          error instanceof Error ? error.stack : undefined,
        );

        await this.auditService.record('survey.dispatch.batch.patient_failed', {
          runAtIso,
          patientLegacyUserId: candidate.patientLegacyUserId,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const result: DispatchHalfHourlySatisfactionSurveysResult = {
      skipped: false,
      runAtIso,
      surveyDateIso: window.surveyDateIso,
      windowStartHHmm: window.windowStartHHmm,
      windowEndHHmm: window.windowEndHHmm,
      eligibleAppointments: appointments.length,
      createdDispatches,
      sentDispatches,
      verificationSentDispatches,
      reusedDispatches,
      markedAsNotApplicable,
      markedAsSent,
      failedDispatches,
    };

    await this.auditService.record('survey.dispatch.batch.completed', {
      skipped: result.skipped,
      runAtIso: result.runAtIso,
      surveyDateIso: result.surveyDateIso,
      windowStartHHmm: result.windowStartHHmm,
      windowEndHHmm: result.windowEndHHmm,
      eligibleAppointments: result.eligibleAppointments,
      createdDispatches: result.createdDispatches,
      sentDispatches: result.sentDispatches,
      verificationSentDispatches: result.verificationSentDispatches,
      reusedDispatches: result.reusedDispatches,
      markedAsNotApplicable: result.markedAsNotApplicable,
      markedAsSent: result.markedAsSent,
      failedDispatches: result.failedDispatches,
    });

    return result;
  }

  private resolveRunAt(runAtIso: string | undefined): Date {
    if (!runAtIso) {
      return new Date();
    }

    const parsed = new Date(runAtIso);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid runAtIso value: ${runAtIso}`);
    }

    return parsed;
  }

  private async classifyAppointments(
    appointments: SatisfactionSurveyEligibleAppointment[],
  ): Promise<{
    dispatchCandidates: DispatchCandidate[];
    noApplicableAgendaIds: number[];
  }> {
    const noApplicableAgendaIds: number[] = [];
    const consentCache = new Map<string, boolean>();
    const suppressionCache = new Map<string, boolean>();
    const grouped = new Map<number, DispatchCandidate>();

    for (const appointment of appointments) {
      const sanitizedPhone = this.phoneNormalizer.sanitize(
        appointment.patientPhone ?? '',
      );
      if (!this.phoneNormalizer.isValidLegacyColombianMobile(sanitizedPhone)) {
        noApplicableAgendaIds.push(appointment.legacyAgendaId);
        await this.auditService.record(
          'survey.eligibility.skipped.invalid_phone',
          {
            legacyAgendaId: appointment.legacyAgendaId,
            patientLegacyUserId: appointment.patientLegacyUserId,
          },
        );
        continue;
      }

      const suppressionKey = sanitizedPhone;
      let isSuppressed = suppressionCache.get(suppressionKey);
      if (isSuppressed === undefined) {
        isSuppressed =
          await this.recipientPolicyRepository.isPhoneSuppressedForSatisfactionSurveys(
            {
              phone: sanitizedPhone,
            },
          );
        suppressionCache.set(suppressionKey, isSuppressed);
      }

      if (isSuppressed) {
        noApplicableAgendaIds.push(appointment.legacyAgendaId);
        await this.auditService.record(
          'survey.eligibility.skipped.suppressed_contact',
          {
            legacyAgendaId: appointment.legacyAgendaId,
            patientLegacyUserId: appointment.patientLegacyUserId,
          },
        );
        continue;
      }

      const consentKey = `${appointment.patientLegacyUserId}:${sanitizedPhone}`;
      let hasConsent = consentCache.get(consentKey);
      if (hasConsent === undefined) {
        hasConsent =
          await this.recipientPolicyRepository.hasGrantedSatisfactionSurveyConsent(
            {
              patientLegacyUserId: appointment.patientLegacyUserId,
              phone: sanitizedPhone,
            },
          );
        consentCache.set(consentKey, hasConsent);
      }

      if (!hasConsent) {
        await this.auditService.record(
          'survey.eligibility.needs_phone_verification',
          {
            legacyAgendaId: appointment.legacyAgendaId,
            patientLegacyUserId: appointment.patientLegacyUserId,
          },
        );
      }

      const current = grouped.get(appointment.patientLegacyUserId);
      if (!current) {
        grouped.set(appointment.patientLegacyUserId, {
          patientLegacyUserId: appointment.patientLegacyUserId,
          patientName: appointment.patientName,
          patientPhone: sanitizedPhone,
          requiresPhoneVerification: !hasConsent,
          appointments: [appointment],
        });
        continue;
      }

      current.appointments.push(appointment);
      current.requiresPhoneVerification =
        current.requiresPhoneVerification || !hasConsent;
    }

    return {
      dispatchCandidates: Array.from(grouped.values()),
      noApplicableAgendaIds,
    };
  }
}
