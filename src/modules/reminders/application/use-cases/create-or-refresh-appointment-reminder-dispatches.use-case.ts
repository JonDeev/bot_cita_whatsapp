import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../../../audit/application/services/audit.service';
import {
  APPOINTMENT_REMINDER_DISPATCH_REPOSITORY,
  APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY,
} from '../../domain/reminders.tokens';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import type { AppointmentReminderEligibilityRepository } from '../../domain/ports/appointment-reminder-eligibility.repository';
import { AppointmentReminderAppointmentTimeService } from '../services/appointment-reminder-appointment-time.service';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import { APPOINTMENT_REMINDER_DISPATCH_QUEUE } from '../../domain/reminder-queue.tokens';
import type { AppointmentReminderDispatchQueuePort } from '../../domain/ports/appointment-reminder-dispatch-queue.port';

export interface CreateOrRefreshAppointmentReminderDispatchesResult {
  scanned: number;
  created: number;
  refreshed: number;
  rescheduledPrevious: number;
  skippedInvalidPhone: number;
}

@Injectable()
export class CreateOrRefreshAppointmentReminderDispatchesUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_ELIGIBILITY_REPOSITORY)
    private readonly eligibilityRepository: AppointmentReminderEligibilityRepository,
    @Inject(APPOINTMENT_REMINDER_DISPATCH_REPOSITORY)
    private readonly dispatchRepository: AppointmentReminderDispatchRepository,
    @Inject(APPOINTMENT_REMINDER_DISPATCH_QUEUE)
    private readonly dispatchQueue: AppointmentReminderDispatchQueuePort,
    private readonly auditService: AuditService,
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly phoneNormalizer: AppointmentReminderPhoneNormalizerService,
    private readonly windowService: AppointmentReminderWindowService,
    private readonly appointmentTimeService: AppointmentReminderAppointmentTimeService,
    private readonly templateConfig: AppointmentReminderTemplateConfigService,
    private readonly runtimeResolver?: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async execute(input?: {
    runAtIso?: string;
  }): Promise<CreateOrRefreshAppointmentReminderDispatchesResult> {
    const runAtIso = input?.runAtIso ?? new Date().toISOString();
    const runtimeSettings = this.runtimeResolver
      ? await this.runtimeResolver.resolveEffectiveHotReloadableSettings()
      : {
          eligibilityLimit: this.configService.getEligibilityLimit(),
        };

    const candidates =
      await this.eligibilityRepository.findFutureAssignedAppointments({
        nowIso: runAtIso,
        maxWindowHours: this.configService.getMaxEligibilityWindowHours(),
        limit: runtimeSettings.eligibilityLimit,
      });

    let created = 0;
    let refreshed = 0;
    let skippedInvalidPhone = 0;
    let rescheduledPrevious = 0;

    for (const candidate of candidates) {
      const normalizedPhone = this.phoneNormalizer.normalizeLegacyPhone(
        candidate.patientPhoneRaw,
      );

      if (!normalizedPhone) {
        skippedInvalidPhone += 1;
        continue;
      }

      const recipientPhoneE164 = this.phoneNormalizer.toE164Colombia(
        normalizedPhone,
      );
      const appointmentStartsAtIso =
        this.appointmentTimeService.resolveAppointmentStartsAtIso({
          appointmentDateIso: candidate.appointmentDateIso,
          appointmentTimeHhmm: candidate.appointmentTimeHhmm,
        });
      const scheduledForIso =
        this.windowService.resolveScheduledForIso(appointmentStartsAtIso);

      const upsertResult = await this.dispatchRepository.upsertDispatch({
        legacyAgendaId: candidate.legacyAgendaId,
        patientLegacyUserId: candidate.patientLegacyUserId,
        conversationKey: this.createConversationKey(recipientPhoneE164),
        recipientPhoneRaw: normalizedPhone,
        recipientPhoneE164,
        appointmentStartsAtIso,
        scheduledForIso,
        reminderType: this.templateConfig.getReminderType(),
        templateName: this.templateConfig.getReminderTemplateName(),
        verificationTemplateName: this.templateConfig.getVerificationTemplateName(),
      });

      if (upsertResult.wasCreated) {
        created += 1;
      } else {
        refreshed += 1;
      }

      const markedRescheduled =
        await this.dispatchRepository.markOlderPendingDispatchesAsRescheduled({
          legacyAgendaId: candidate.legacyAgendaId,
          keepDispatchId: upsertResult.dispatch.id,
        });
      rescheduledPrevious += markedRescheduled;

      if (this.configService.isQueueEnabled()) {
        await this.dispatchQueue.scheduleDispatchJob({
          dispatchId: upsertResult.dispatch.id,
          scheduledForIso: scheduledForIso,
        });
      }
    }

    await this.auditService.record('appointment_reminder.sync.completed', {
      scanned: candidates.length,
      created,
      refreshed,
      skippedInvalidPhone,
      rescheduledPrevious,
    });

    return {
      scanned: candidates.length,
      created,
      refreshed,
      rescheduledPrevious,
      skippedInvalidPhone,
    };
  }

  private createConversationKey(recipientPhoneE164: string): string {
    const phoneNumberId = this.configService.getWhatsAppPhoneNumberId();
    return `whatsapp:${phoneNumberId || 'unknown'}:${recipientPhoneE164}`;
  }
}
