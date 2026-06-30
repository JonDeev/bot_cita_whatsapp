import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import { APPOINTMENT_REMINDER_DISPATCH_QUEUE } from '../../domain/reminder-queue.tokens';
import {
  APPOINTMENT_REMINDER_DISPATCH_REPOSITORY,
  APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY,
  APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderDispatchQueuePort } from '../../domain/ports/appointment-reminder-dispatch-queue.port';
import type {
  AppointmentReminderDispatchRecord,
  AppointmentReminderDispatchRepository,
} from '../../domain/ports/appointment-reminder-dispatch.repository';
import type { AppointmentReminderEligibilityRepository } from '../../domain/ports/appointment-reminder-eligibility.repository';
import type { AppointmentReminderRecipientPolicyRepository } from '../../domain/ports/appointment-reminder-recipient-policy.repository';
import { AppointmentReminderDispatchContactDecisionService } from '../services/appointment-reminder-dispatch-contact-decision.service';
import { AppointmentReminderDispatchFailurePolicyService } from '../services/appointment-reminder-dispatch-failure-policy.service';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import { AppointmentReminderTemplateDeliveryService } from '../services/appointment-reminder-template-delivery.service';
import { AppointmentReminderVerificationActionKeyService } from '../services/appointment-reminder-verification-action-key.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import { TemplateMessageSnapshotService } from '../../../whatsapp/application/services/template-message-snapshot.service';
import type { OutboundWhatsappTemplateQuickReplyButton } from '../../../whatsapp/domain/value-objects/outbound-whatsapp-message';

export interface DispatchDueAppointmentRemindersResult {
  claimed: number;
  sent: number;
  verificationSent: number;
  skipped: number;
  failed: number;
}

interface ReminderDispatchLeaseHeartbeat {
  renewNow(): Promise<boolean>;
  isLockLost(): boolean;
  stop(): void;
}

@Injectable()
export class DispatchDueAppointmentRemindersUseCase {
  private readonly logger = new Logger(
    DispatchDueAppointmentRemindersUseCase.name,
  );

  constructor(
    @Inject(APPOINTMENT_REMINDER_DISPATCH_REPOSITORY)
    private readonly dispatchRepository: AppointmentReminderDispatchRepository,
    @Inject(APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY)
    private readonly eligibilityRepository: AppointmentReminderEligibilityRepository,
    @Inject(APPOINTMENT_REMINDER_RECIPIENT_POLICY_REPOSITORY)
    private readonly recipientPolicyRepository: AppointmentReminderRecipientPolicyRepository,
    @Inject(APPOINTMENT_REMINDER_DISPATCH_QUEUE)
    private readonly dispatchQueue: AppointmentReminderDispatchQueuePort,
    private readonly dispatchContactDecisionService: AppointmentReminderDispatchContactDecisionService,
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly templateConfig: AppointmentReminderTemplateConfigService,
    private readonly windowService: AppointmentReminderWindowService,
    private readonly verificationActionKeyService: AppointmentReminderVerificationActionKeyService,
    private readonly failurePolicy: AppointmentReminderDispatchFailurePolicyService,
    private readonly phoneNormalizer: AppointmentReminderPhoneNormalizerService,
    private readonly templateSnapshotService: TemplateMessageSnapshotService,
    private readonly templateDeliveryService: AppointmentReminderTemplateDeliveryService,
    private readonly auditService: AuditService,
    private readonly runtimeResolver?: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(input?: {
    runAtIso?: string;
    workerId?: string;
    restrictToDispatchIds?: readonly number[];
  }): Promise<DispatchDueAppointmentRemindersResult> {
    const runAtIso = input?.runAtIso ?? new Date().toISOString();
    const workerId = input?.workerId ?? `worker:${process.pid}`;
    const runtimeSettings = await this.resolveRuntimeHotReloadableSettings();

    const claimedDispatches = await this.dispatchRepository.claimDueDispatches({
      runAtIso,
      workerId,
      lockTtlSeconds: runtimeSettings.lockTtlSeconds,
      limit: runtimeSettings.dispatchBatchSize,
      restrictToDispatchIds: input?.restrictToDispatchIds,
    });

    if (claimedDispatches.length === 0) {
      return {
        claimed: 0,
        sent: 0,
        verificationSent: 0,
        skipped: 0,
        failed: 0,
      };
    }

    const latestAppointments =
      await this.eligibilityRepository.findByLegacyAgendaIds(
        claimedDispatches.map((dispatch) => dispatch.legacyAgendaId),
      );
    const appointmentsByLegacyId = new Map(
      latestAppointments.map((appointment) => [
        appointment.legacyAgendaId,
        appointment,
      ]),
    );

    let sent = 0;
    let verificationSent = 0;
    let skipped = 0;
    let failed = 0;

    for (const dispatch of claimedDispatches) {
      const appointment = appointmentsByLegacyId.get(dispatch.legacyAgendaId);

      if (!appointment || appointment.legacyState !== 'Asignada') {
        await this.markSkipped(
          dispatch,
          workerId,
          'SKIPPED_APPOINTMENT_CANCELLED',
        );
        skipped += 1;
        continue;
      }

      const handoffActive =
        await this.recipientPolicyRepository.isHumanHandoffActive({
          conversationKey: dispatch.conversationKey,
        });
      if (handoffActive) {
        await this.markSkipped(dispatch, workerId, 'SKIPPED_HANDOFF_ACTIVE');
        skipped += 1;
        continue;
      }

      const recipientPhoneE164 =
        this.resolveCanonicalRecipientPhoneE164(dispatch);
      if (!recipientPhoneE164) {
        await this.markSkipped(dispatch, workerId, 'SKIPPED_INVALID_PHONE');
        skipped += 1;
        continue;
      }

      const [hasAppointmentNotificationsOptIn, suppressionDecision] =
        await Promise.all([
          this.recipientPolicyRepository.hasAppointmentNotificationsOptIn({
            patientLegacyUserId: dispatch.patientLegacyUserId,
          }),
          this.recipientPolicyRepository.resolveReminderContactSuppression({
            patientLegacyUserId: dispatch.patientLegacyUserId,
            phone: recipientPhoneE164,
          }),
        ]);

      const contactDecision =
        this.dispatchContactDecisionService.resolve({
          recipientPhoneE164,
          hasAppointmentNotificationsOptIn,
          suppressionDecision,
        });

      if (contactDecision.kind === 'SKIP_SUPPRESSED_CONTACT') {
        await this.markSkipped(
          dispatch,
          workerId,
          'SKIPPED_SUPPRESSED_CONTACT',
          contactDecision.suppressionReason,
        );
        skipped += 1;
        continue;
      }

      if (contactDecision.kind === 'SKIP_INVALID_PHONE') {
        await this.markSkipped(
          dispatch,
          workerId,
          'SKIPPED_INVALID_PHONE',
          'INVALID_PHONE',
        );
        skipped += 1;
        continue;
      }

      try {
        if (runtimeSettings.emergencyPauseEnabled) {
          const paused = await this.dispatchRepository.markPausedHold({
            dispatchId: dispatch.id,
            expectedLockVersion: dispatch.lockVersion,
            workerId,
            reason: 'emergency_pause_active',
          });
          if (paused) {
            await this.auditService.record(
              'appointment_reminder.dispatch.paused_hold',
              {
                dispatchId: dispatch.id,
                source: 'dispatch_due',
              },
            );
            continue;
          }

          await this.auditService.record(
            'appointment_reminder.dispatch.lock_lost',
            {
              dispatchId: dispatch.id,
              workerId,
              reason: 'cas_mark_paused_hold_failed',
            },
          );
          this.logger.warn(
            `Reminder dispatch ${dispatch.id} could not transition to PAUSED_HOLD while emergency pause was active. External send was blocked.`,
          );
          continue;
        }

        if (contactDecision.kind === 'SEND_REMINDER') {
          const bodyTextParameters =
            this.buildReminderBodyParameters(appointment);
          const templateSnapshot =
            this.templateSnapshotService.buildAppointmentReminderSnapshot({
              templateName: dispatch.templateName,
              languageCode: this.templateConfig.getTemplateLanguageCode(),
              bodyTextParameters,
            });
          const sendResult = await this.sendWithLeaseHeartbeat({
            dispatch,
            workerId,
            runtimeSettings,
            send: () =>
              this.templateDeliveryService.send({
                conversationKey: this.resolveConversationKey(
                  dispatch,
                  contactDecision.recipientPhoneE164,
                ),
                dispatchId: dispatch.id,
                patientLegacyUserId: dispatch.patientLegacyUserId,
                to: contactDecision.recipientPhoneE164,
                templateName: dispatch.templateName,
                languageCode: this.templateConfig.getTemplateLanguageCode(),
                bodyTextParameters,
                templateSnapshot,
                trigger: 'appointment_reminder.dispatch_due',
              }),
          });
          if (!sendResult) {
            failed += 1;
            continue;
          }

          const markedSent = await this.dispatchRepository.markSent({
            dispatchId: dispatch.id,
            expectedLockVersion: dispatch.lockVersion,
            workerId,
            metaMessageId: sendResult.messageId,
            sentAtIso: runAtIso,
          });
          if (!markedSent) {
            const compensated =
              await this.dispatchRepository.markSentAfterUncertainOwnership({
                dispatchId: dispatch.id,
                metaMessageId: sendResult.messageId,
                sentAtIso: runAtIso,
              });
            if (compensated) {
              await this.auditService.record(
                'appointment_reminder.dispatch.sent_compensated',
                {
                  dispatchId: dispatch.id,
                  workerId,
                  messageId: sendResult.messageId,
                },
              );
              sent += 1;
              continue;
            }

            await this.auditService.record(
              'appointment_reminder.dispatch.lock_lost',
              {
                dispatchId: dispatch.id,
                workerId,
                reason: 'cas_mark_sent_failed',
              },
            );
            this.logger.warn(
              `Reminder dispatch ${dispatch.id} was sent but state transition to SENT failed due to CAS mismatch.`,
            );
            failed += 1;
            continue;
          }

          await this.auditService.record('appointment_reminder.dispatch.sent', {
            dispatchId: dispatch.id,
            legacyAgendaId: dispatch.legacyAgendaId,
            messageId: sendResult.messageId,
          });

          sent += 1;
          continue;
        }

        const verificationExpiresAtIso =
          this.windowService.resolveVerificationExpiresAtIso(
            dispatch.appointmentStartsAtIso,
          );
        const verificationBodyTextParameters =
          this.buildVerificationBodyParameters(appointment);
        const verificationConfirmActionKey =
          this.verificationActionKeyService.create();
        const verificationRejectActionKey =
          this.verificationActionKeyService.create();
        const verificationQuickReplyButtons: OutboundWhatsappTemplateQuickReplyButton[] = [
          {
            index: '0',
            payload: `${this.templateConfig.getConfirmButtonPayloadPrefix()}${verificationConfirmActionKey}`,
          },
          {
            index: '1',
            payload: `${this.templateConfig.getRejectButtonPayloadPrefix()}${verificationRejectActionKey}`,
          },
        ];
        const verificationTemplateSnapshot =
          this.templateSnapshotService.buildSurveyPhoneVerificationSnapshot({
            templateName: dispatch.verificationTemplateName,
            languageCode: this.templateConfig.getTemplateLanguageCode(),
            bodyTextParameters: verificationBodyTextParameters,
            visibleButtons: [
              { index: '0', title: 'Confirmar' },
              { index: '1', title: 'No lo reconozco' },
            ],
            buttonPayloads: verificationQuickReplyButtons,
          });

        const sendResult = await this.sendWithLeaseHeartbeat({
          dispatch,
          workerId,
          runtimeSettings,
          send: () =>
            this.templateDeliveryService.send({
              conversationKey: this.resolveConversationKey(
                dispatch,
                contactDecision.recipientPhoneE164,
              ),
              dispatchId: dispatch.id,
              patientLegacyUserId: dispatch.patientLegacyUserId,
              to: contactDecision.recipientPhoneE164,
              templateName: dispatch.verificationTemplateName,
              languageCode: this.templateConfig.getTemplateLanguageCode(),
              bodyTextParameters: verificationBodyTextParameters,
              templateSnapshot: verificationTemplateSnapshot,
              quickReplyButtons: verificationQuickReplyButtons,
              trigger: 'appointment_reminder.phone_verification',
            }),
        });
        if (!sendResult) {
          failed += 1;
          continue;
        }

        const markedVerificationPending =
          await this.dispatchRepository.markVerificationPending({
            dispatchId: dispatch.id,
            expectedLockVersion: dispatch.lockVersion,
            workerId,
            verificationTokenHash: null,
            verificationConfirmActionKey,
            verificationRejectActionKey,
            verificationMessageId: sendResult.messageId,
            verificationRequestedAtIso: runAtIso,
            verificationExpiresAtIso,
          });
        if (!markedVerificationPending) {
          const compensated =
            await this.dispatchRepository.markVerificationPendingAfterUncertainOwnership(
              {
                dispatchId: dispatch.id,
                verificationTokenHash: null,
                verificationConfirmActionKey,
                verificationRejectActionKey,
                verificationMessageId: sendResult.messageId,
                verificationRequestedAtIso: runAtIso,
                verificationExpiresAtIso,
              },
            );
          if (compensated) {
            await this.auditService.record(
              'appointment_reminder.dispatch.verification_sent_compensated',
              {
                dispatchId: dispatch.id,
                workerId,
                messageId: sendResult.messageId,
              },
            );
            verificationSent += 1;
            continue;
          }

          await this.auditService.record(
            'appointment_reminder.dispatch.lock_lost',
            {
              dispatchId: dispatch.id,
              workerId,
              reason: 'cas_mark_verification_pending_failed',
            },
          );
          this.logger.warn(
            `Reminder dispatch ${dispatch.id} sent verification template but state transition to PHONE_VERIFICATION_PENDING failed due to CAS mismatch.`,
          );
          failed += 1;
          continue;
        }

        await this.auditService.record(
          'appointment_reminder.dispatch.verification_sent',
          {
            dispatchId: dispatch.id,
            legacyAgendaId: dispatch.legacyAgendaId,
            messageId: sendResult.messageId,
          },
        );

        verificationSent += 1;
      } catch (error) {
        const failureDecision = this.failurePolicy.resolve({
          attempts: dispatch.attempts + 1,
          runAtIso,
          error,
        });

        const wasMarked = await this.dispatchRepository.markFailed({
          dispatchId: dispatch.id,
          expectedLockVersion: dispatch.lockVersion,
          workerId,
          reason: error instanceof Error ? error.message : 'Unknown error',
          attempts: dispatch.attempts + 1,
          nextAttemptAtIso: failureDecision.nextAttemptAtIso,
        });

        if (!wasMarked) {
          this.logger.warn(
            `Failed to transition reminder dispatch ${dispatch.id} to failed/retry state due to lock mismatch.`,
          );
        }

        if (
          wasMarked &&
          failureDecision.nextAttemptAtIso &&
          this.configService.isQueueEnabled()
        ) {
          try {
            await this.dispatchQueue.scheduleDispatchJob({
              dispatchId: dispatch.id,
              scheduledForIso: failureDecision.nextAttemptAtIso,
            });
          } catch (enqueueError) {
            this.logger.error(
              `Failed to schedule retry job for reminder dispatch ${dispatch.id}.`,
              enqueueError instanceof Error ? enqueueError.stack : undefined,
            );
          }
        }

        failed += 1;
      }
    }

    return {
      claimed: claimedDispatches.length,
      sent,
      verificationSent,
      skipped,
      failed,
    };
  }

  private async resolveRuntimeHotReloadableSettings(): Promise<{
    lockTtlSeconds: number;
    lockHeartbeatIntervalMs: number;
    dispatchBatchSize: number;
    emergencyPauseEnabled: boolean;
  }> {
    if (this.runtimeResolver) {
      const runtime =
        await this.runtimeResolver.resolveEffectiveHotReloadableSettings();
      return {
        lockTtlSeconds: runtime.lockTtlSeconds,
        lockHeartbeatIntervalMs: runtime.lockHeartbeatIntervalMs,
        dispatchBatchSize: runtime.dispatchBatchSize,
        emergencyPauseEnabled: runtime.emergencyPauseEnabled,
      };
    }

    return {
      lockTtlSeconds: this.configService.getLockTtlSeconds(),
      lockHeartbeatIntervalMs: this.configService.getLockHeartbeatIntervalMs(),
      dispatchBatchSize: this.configService.getDispatchBatchSize(),
      emergencyPauseEnabled: false,
    };
  }

  private async markSkipped(
    dispatch: AppointmentReminderDispatchRecord,
    workerId: string,
    status:
      | 'SKIPPED_NO_OPT_IN'
      | 'SKIPPED_INVALID_PHONE'
      | 'SKIPPED_APPOINTMENT_CANCELLED'
      | 'SKIPPED_APPOINTMENT_RESCHEDULED'
      | 'SKIPPED_LATE_CONFIRMATION'
      | 'SKIPPED_SUPPRESSED_CONTACT'
      | 'SKIPPED_HANDOFF_ACTIVE'
      | 'PHONE_VERIFICATION_EXPIRED',
    reason?: string,
  ): Promise<void> {
    await this.dispatchRepository.markSkipped({
      dispatchId: dispatch.id,
      expectedLockVersion: dispatch.lockVersion,
      workerId,
      status,
      reason,
    });

    await this.auditService.record('appointment_reminder.dispatch.skipped', {
      dispatchId: dispatch.id,
      status,
      reason,
    });
  }

  private buildReminderBodyParameters(input: {
    patientFirstName: string;
    patientLastName: string;
    specialtyName: string | null;
    modalityId: number;
    appointmentDateIso: string;
    appointmentTimeHhmm: string;
    siteCity: string | null;
    siteAddress: string | null;
    doctorName: string | null;
  }): string[] {
    const patientName =
      `${input.patientFirstName} ${input.patientLastName}`.trim();
    const date = new Date(input.appointmentDateIso);
    const day = date.toISOString().slice(0, 10);

    return [
      patientName || 'Paciente',
      input.specialtyName ?? 'Consulta medica',
      input.modalityId === 0 ? 'PRESENCIAL' : '',
      day,
      input.appointmentTimeHhmm,
      input.siteCity ?? '',
      input.siteAddress ?? '',
      input.doctorName ?? '',
    ];
  }

  private buildVerificationBodyParameters(input: {
    patientFirstName: string;
    patientLastName: string;
  }): string[] {
    const patientShortName =
      `${input.patientFirstName} ${input.patientLastName}`.trim();

    return [patientShortName || 'Paciente'];
  }

  private resolveConversationKey(dispatch: {
    conversationKey: string | null;
  }, recipientPhoneE164: string): string {
    if (dispatch.conversationKey?.trim()) {
      return dispatch.conversationKey;
    }

    const phoneNumberId = this.configService.getWhatsAppPhoneNumberId();
    return `whatsapp:${phoneNumberId || 'unknown'}:${recipientPhoneE164}`;
  }

  private resolveCanonicalRecipientPhoneE164(dispatch: {
    recipientPhoneE164: string | null;
    recipientPhoneRaw: string;
  }): string | null {
    const normalizedE164 = this.phoneNormalizer.normalizeE164Colombia(
      dispatch.recipientPhoneE164,
    );
    if (normalizedE164) {
      return normalizedE164;
    }

    const normalizedLegacyPhone = this.phoneNormalizer.normalizeLegacyPhone(
      dispatch.recipientPhoneRaw,
    );
    if (!normalizedLegacyPhone) {
      return null;
    }

    return this.phoneNormalizer.toE164Colombia(normalizedLegacyPhone);
  }

  private async sendWithLeaseHeartbeat<T>(input: {
    dispatch: AppointmentReminderDispatchRecord;
    workerId: string;
    runtimeSettings: {
      lockTtlSeconds: number;
      lockHeartbeatIntervalMs: number;
    };
    send: () => Promise<T>;
  }): Promise<T | null> {
    const leaseHeartbeat = this.createLeaseHeartbeat(
      input.dispatch,
      input.workerId,
      input.runtimeSettings,
    );

    try {
      const hasLease = await leaseHeartbeat.renewNow();
      if (!hasLease) {
        return null;
      }

      const sendResult = await input.send();
      if (leaseHeartbeat.isLockLost()) {
        await this.auditService.record(
          'appointment_reminder.dispatch.lock_lost',
          {
            dispatchId: input.dispatch.id,
            workerId: input.workerId,
            reason: 'lost_while_sending',
          },
        );
        return null;
      }

      return sendResult;
    } finally {
      leaseHeartbeat.stop();
    }
  }

  private createLeaseHeartbeat(
    dispatch: AppointmentReminderDispatchRecord,
    workerId: string,
    runtimeSettings: {
      lockTtlSeconds: number;
      lockHeartbeatIntervalMs: number;
    },
  ): ReminderDispatchLeaseHeartbeat {
    const lockTtlSeconds = runtimeSettings.lockTtlSeconds;
    const heartbeatIntervalMs = runtimeSettings.lockHeartbeatIntervalMs;
    let lockLost = false;
    let stopped = false;
    let renewing = false;

    const renewNow = async (): Promise<boolean> => {
      if (lockLost || stopped || renewing) {
        return !lockLost;
      }

      renewing = true;
      try {
        const renewed = await this.dispatchRepository.renewLock({
          dispatchId: dispatch.id,
          expectedLockVersion: dispatch.lockVersion,
          workerId,
          nowIso: new Date().toISOString(),
          lockTtlSeconds,
        });

        if (!renewed) {
          lockLost = true;
          await this.auditService.record(
            'appointment_reminder.dispatch.lock_lost',
            {
              dispatchId: dispatch.id,
              workerId,
              reason: 'lease_not_renewed',
            },
          );
          this.logger.warn(
            `Lease renewal failed for reminder dispatch ${dispatch.id}. External send blocked to avoid duplicates.`,
          );
          return false;
        }

        return true;
      } catch (error) {
        lockLost = true;
        await this.auditService.record(
          'appointment_reminder.dispatch.lock_lost',
          {
            dispatchId: dispatch.id,
            workerId,
            reason: 'lease_renewal_error',
          },
        );
        this.logger.error(
          `Lease renewal error for reminder dispatch ${dispatch.id}. External send blocked to avoid duplicates.`,
          error instanceof Error ? error.stack : undefined,
        );
        return false;
      } finally {
        renewing = false;
      }
    };

    const timer = setInterval(() => {
      void renewNow();
    }, heartbeatIntervalMs);
    timer.unref?.();

    return {
      renewNow,
      isLockLost: () => lockLost,
      stop: () => {
        stopped = true;
        clearInterval(timer);
      },
    };
  }
}
