import { AuditService } from '../../../audit/application/services/audit.service';
import type { AppointmentReminderDispatchQueuePort } from '../../domain/ports/appointment-reminder-dispatch-queue.port';
import type {
  AppointmentReminderDispatchRecord,
  AppointmentReminderDispatchRepository,
} from '../../domain/ports/appointment-reminder-dispatch.repository';
import type { AppointmentReminderEligibilityRepository } from '../../domain/ports/appointment-reminder-eligibility.repository';
import type { AppointmentReminderRecipientPolicyRepository } from '../../domain/ports/appointment-reminder-recipient-policy.repository';
import { AppointmentReminderButtonTokenService } from '../services/appointment-reminder-button-token.service';
import { AppointmentReminderDispatchFailurePolicyService } from '../services/appointment-reminder-dispatch-failure-policy.service';
import { AppointmentReminderDispatchContactDecisionService } from '../services/appointment-reminder-dispatch-contact-decision.service';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import { AppointmentReminderTemplateDeliveryService } from '../services/appointment-reminder-template-delivery.service';
import { AppointmentReminderVerificationActionKeyService } from '../services/appointment-reminder-verification-action-key.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import { TemplateMessageSnapshotService } from '../../../whatsapp/application/services/template-message-snapshot.service';
import { DispatchDueAppointmentRemindersUseCase } from './dispatch-due-appointment-reminders.use-case';

type DispatchRepositoryMock = {
  claimDueDispatches: jest.Mock<
    Promise<AppointmentReminderDispatchRecord[]>,
    [
      {
        runAtIso: string;
        workerId: string;
        lockTtlSeconds: number;
        limit: number;
        restrictToDispatchIds?: readonly number[];
      },
    ]
  >;
  markSent: jest.Mock<
    Promise<boolean>,
    Parameters<AppointmentReminderDispatchRepository['markSent']>
  >;
  markVerificationPending: jest.Mock<
    Promise<boolean>,
    Parameters<AppointmentReminderDispatchRepository['markVerificationPending']>
  >;
  markVerificationPendingAfterUncertainOwnership: jest.Mock<
    Promise<boolean>,
    Parameters<
      AppointmentReminderDispatchRepository['markVerificationPendingAfterUncertainOwnership']
    >
  >;
  markSentAfterUncertainOwnership: jest.Mock<
    Promise<boolean>,
    Parameters<
      AppointmentReminderDispatchRepository['markSentAfterUncertainOwnership']
    >
  >;
  markPausedHold: jest.Mock<
    Promise<boolean>,
    Parameters<AppointmentReminderDispatchRepository['markPausedHold']>
  >;
  markSkipped: jest.Mock<
    Promise<boolean>,
    Parameters<AppointmentReminderDispatchRepository['markSkipped']>
  >;
  renewLock: jest.Mock<
    Promise<boolean>,
    Parameters<AppointmentReminderDispatchRepository['renewLock']>
  >;
  markFailed: jest.Mock<
    Promise<boolean>,
    Parameters<AppointmentReminderDispatchRepository['markFailed']>
  >;
};

type EligibilityRepositoryMock = {
  findByLegacyAgendaIds: jest.Mock<
    Promise<
      Awaited<
        ReturnType<
          AppointmentReminderEligibilityRepository['findByLegacyAgendaIds']
        >
      >
    >,
    Parameters<
      AppointmentReminderEligibilityRepository['findByLegacyAgendaIds']
    >
  >;
};

type RecipientPolicyRepositoryMock = {
  isHumanHandoffActive: jest.Mock<
    Promise<boolean>,
    Parameters<
      AppointmentReminderRecipientPolicyRepository['isHumanHandoffActive']
    >
  >;
  hasAppointmentNotificationsOptIn: jest.Mock<
    Promise<boolean>,
    Parameters<
      AppointmentReminderRecipientPolicyRepository['hasAppointmentNotificationsOptIn']
    >
  >;
  resolveReminderContactSuppression: jest.Mock<
    Promise<
      Awaited<
        ReturnType<
          AppointmentReminderRecipientPolicyRepository['resolveReminderContactSuppression']
        >
      >
    >,
    Parameters<
      AppointmentReminderRecipientPolicyRepository['resolveReminderContactSuppression']
    >
  >;
};

type DispatchQueueMock = {
  scheduleDispatchJob: jest.Mock<
    Promise<void>,
    Parameters<AppointmentReminderDispatchQueuePort['scheduleDispatchJob']>
  >;
};

type DispatchConfigServiceMock = Pick<
  AppointmentReminderDispatchConfigService,
  | 'getLockTtlSeconds'
  | 'getLockHeartbeatIntervalMs'
  | 'getDispatchBatchSize'
  | 'getWhatsAppPhoneNumberId'
  | 'isQueueEnabled'
>;

type TemplateConfigServiceMock = Pick<
  AppointmentReminderTemplateConfigService,
  | 'getTemplateLanguageCode'
  | 'getConfirmButtonPayloadPrefix'
  | 'getRejectButtonPayloadPrefix'
>;

type WindowServiceMock = Pick<
  AppointmentReminderWindowService,
  'resolveVerificationExpiresAtIso'
>;

type ButtonTokenServiceMock = Pick<
  AppointmentReminderButtonTokenService,
  'createToken' | 'hashToken'
>;

type PhoneNormalizerServiceMock = Pick<
  AppointmentReminderPhoneNormalizerService,
  'toE164Colombia' | 'normalizeLegacyPhone' | 'normalizeE164Colombia'
>;

type TemplateDeliveryServiceMock = {
  send: jest.Mock<
    Promise<{ messageId: string }>,
    Parameters<AppointmentReminderTemplateDeliveryService['send']>
  >;
};

type DispatchDueAppointmentRemindersFixture = {
  useCase: DispatchDueAppointmentRemindersUseCase;
  dispatchRepository: DispatchRepositoryMock;
  eligibilityRepository: EligibilityRepositoryMock;
  recipientPolicyRepository: RecipientPolicyRepositoryMock;
  dispatchQueue: DispatchQueueMock;
  configService: DispatchConfigServiceMock;
  templateConfig: TemplateConfigServiceMock;
  windowService: WindowServiceMock;
  buttonTokenService: ButtonTokenServiceMock;
  phoneNormalizer: PhoneNormalizerServiceMock;
  templateSnapshotService: TemplateMessageSnapshotService;
  templateDeliveryService: TemplateDeliveryServiceMock;
  verificationActionKeyService: AppointmentReminderVerificationActionKeyService;
  failurePolicy: AppointmentReminderDispatchFailurePolicyService;
  auditService: {
    record: jest.Mock<Promise<void>, [string, Record<string, unknown>]>;
  };
  runtimeResolver: {
    resolveEffectiveHotReloadableSettings: jest.Mock<
      Promise<{
        sendMode: 'live' | 'mock';
        sendRolloutPercent: number;
        emergencyPauseEnabled: boolean;
        dispatchBatchSize: number;
        eligibilityLimit: number;
        lockTtlSeconds: number;
        lockHeartbeatIntervalMs: number;
        minConfirmationHours: number;
      }>,
      []
    >;
  };
};

function createDispatchDueAppointmentRemindersFixture(): DispatchDueAppointmentRemindersFixture {
  const dispatchRepository: DispatchRepositoryMock = {
    claimDueDispatches: jest
      .fn<
        Promise<AppointmentReminderDispatchRecord[]>,
        [
          {
            runAtIso: string;
            workerId: string;
            lockTtlSeconds: number;
            limit: number;
            restrictToDispatchIds?: readonly number[];
          },
        ]
      >()
      .mockResolvedValue([]),
    markSent: jest
      .fn<
        Promise<boolean>,
        Parameters<AppointmentReminderDispatchRepository['markSent']>
      >()
      .mockResolvedValue(false),
    markVerificationPending: jest
      .fn<
        Promise<boolean>,
        Parameters<
          AppointmentReminderDispatchRepository['markVerificationPending']
        >
      >()
      .mockResolvedValue(false),
    markVerificationPendingAfterUncertainOwnership: jest
      .fn<
        Promise<boolean>,
        Parameters<
          AppointmentReminderDispatchRepository['markVerificationPendingAfterUncertainOwnership']
        >
      >()
      .mockResolvedValue(false),
    markSentAfterUncertainOwnership: jest
      .fn<
        Promise<boolean>,
        Parameters<
          AppointmentReminderDispatchRepository['markSentAfterUncertainOwnership']
        >
      >()
      .mockResolvedValue(false),
    markPausedHold: jest
      .fn<
        Promise<boolean>,
        Parameters<AppointmentReminderDispatchRepository['markPausedHold']>
      >()
      .mockResolvedValue(false),
    markSkipped: jest
      .fn<
        Promise<boolean>,
        Parameters<AppointmentReminderDispatchRepository['markSkipped']>
      >()
      .mockResolvedValue(false),
    renewLock: jest
      .fn<
        Promise<boolean>,
        Parameters<AppointmentReminderDispatchRepository['renewLock']>
      >()
      .mockResolvedValue(false),
    markFailed: jest
      .fn<
        Promise<boolean>,
        Parameters<AppointmentReminderDispatchRepository['markFailed']>
      >()
      .mockResolvedValue(false),
  };

  const eligibilityRepository: EligibilityRepositoryMock = {
    findByLegacyAgendaIds: jest
      .fn<
        Promise<
          Awaited<
            ReturnType<
              AppointmentReminderEligibilityRepository['findByLegacyAgendaIds']
            >
          >
        >,
        Parameters<
          AppointmentReminderEligibilityRepository['findByLegacyAgendaIds']
        >
      >()
      .mockResolvedValue([]),
  };

  const recipientPolicyRepository: RecipientPolicyRepositoryMock = {
    isHumanHandoffActive: jest
      .fn<
        Promise<boolean>,
        Parameters<
          AppointmentReminderRecipientPolicyRepository['isHumanHandoffActive']
        >
      >()
      .mockResolvedValue(false),
    hasAppointmentNotificationsOptIn: jest
      .fn<
        Promise<boolean>,
        Parameters<
          AppointmentReminderRecipientPolicyRepository['hasAppointmentNotificationsOptIn']
        >
      >()
      .mockResolvedValue(false),
    resolveReminderContactSuppression: jest
      .fn<
        Promise<
          Awaited<
            ReturnType<
              AppointmentReminderRecipientPolicyRepository['resolveReminderContactSuppression']
            >
          >
        >,
        Parameters<
          AppointmentReminderRecipientPolicyRepository['resolveReminderContactSuppression']
        >
      >()
      .mockResolvedValue({ kind: 'ALLOW_CONTACT' }),
  };

  const dispatchQueue: DispatchQueueMock = {
    scheduleDispatchJob: jest
      .fn<
        Promise<void>,
        Parameters<AppointmentReminderDispatchQueuePort['scheduleDispatchJob']>
      >()
      .mockResolvedValue(undefined),
  };

  const configService: DispatchConfigServiceMock = {
    getLockTtlSeconds: jest.fn().mockReturnValue(300),
    getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60_000),
    getDispatchBatchSize: jest.fn().mockReturnValue(50),
    getWhatsAppPhoneNumberId: jest.fn().mockReturnValue('12345'),
    isQueueEnabled: jest.fn().mockReturnValue(true),
  };

  const templateConfig: TemplateConfigServiceMock = {
    getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
    getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('arc:'),
    getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('arr:'),
  };

  const windowService: WindowServiceMock = {
    resolveVerificationExpiresAtIso: jest
      .fn()
      .mockReturnValue('2026-05-26T12:00:00.000Z'),
  };

  const buttonTokenService: ButtonTokenServiceMock = {
    createToken: jest.fn().mockReturnValue('token'),
    hashToken: jest.fn().mockReturnValue('hash'),
  };

  const phoneNormalizer: PhoneNormalizerServiceMock = {
    toE164Colombia: jest
      .fn()
      .mockImplementation((phone: string) => `57${phone}`),
    normalizeE164Colombia: jest
      .fn()
      .mockImplementation((rawPhone: string | null | undefined) => {
        if (!rawPhone) {
          return null;
        }

        const digitsOnly = rawPhone.replace(/\D+/g, '');
        return /^573\d{9}$/.test(digitsOnly) ? digitsOnly : null;
      }),
    normalizeLegacyPhone: jest
      .fn()
      .mockImplementation((rawPhone: string | null | undefined) => {
        if (!rawPhone) {
          return null;
        }

        const digitsOnly = rawPhone.replace(/\D+/g, '');
        return /^3\d{9}$/.test(digitsOnly) ? digitsOnly : null;
      }),
  };

  const verificationActionKeyService =
    new AppointmentReminderVerificationActionKeyService();
  const failurePolicy = new AppointmentReminderDispatchFailurePolicyService();
  const templateSnapshotService = new TemplateMessageSnapshotService();

  const templateDeliveryService: TemplateDeliveryServiceMock = {
    send: jest
      .fn<
        Promise<{ messageId: string }>,
        Parameters<AppointmentReminderTemplateDeliveryService['send']>
      >()
      .mockResolvedValue({ messageId: 'wamid-default' }),
  };

  const auditService: Pick<AuditService, 'record'> = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const runtimeResolver = {
    resolveEffectiveHotReloadableSettings: jest.fn().mockResolvedValue({
      sendMode: 'live' as const,
      sendRolloutPercent: 100,
      emergencyPauseEnabled: false,
      dispatchBatchSize: 50,
      eligibilityLimit: 500,
      lockTtlSeconds: 300,
      lockHeartbeatIntervalMs: 60_000,
      minConfirmationHours: 3,
    }),
  };

  const dispatchContactDecisionService =
    new AppointmentReminderDispatchContactDecisionService();

  const useCase = new DispatchDueAppointmentRemindersUseCase(
    dispatchRepository as unknown as AppointmentReminderDispatchRepository,
    eligibilityRepository as unknown as AppointmentReminderEligibilityRepository,
    recipientPolicyRepository as unknown as AppointmentReminderRecipientPolicyRepository,
    dispatchQueue,
    dispatchContactDecisionService,
    configService as unknown as AppointmentReminderDispatchConfigService,
    templateConfig as unknown as AppointmentReminderTemplateConfigService,
    windowService as unknown as AppointmentReminderWindowService,
    verificationActionKeyService,
    failurePolicy,
    phoneNormalizer as unknown as AppointmentReminderPhoneNormalizerService,
    templateSnapshotService,
    templateDeliveryService as unknown as AppointmentReminderTemplateDeliveryService,
    auditService,
    runtimeResolver as unknown as AppointmentReminderRuntimeSettingsResolverService,
  );

  return {
    useCase,
    dispatchRepository,
    eligibilityRepository,
    recipientPolicyRepository,
    dispatchQueue,
    configService,
    templateConfig,
    windowService,
    buttonTokenService,
    phoneNormalizer,
    templateSnapshotService,
    templateDeliveryService,
    verificationActionKeyService,
    failurePolicy,
    auditService,
    runtimeResolver,
  };
}

describe('DispatchDueAppointmentRemindersUseCase', () => {
  it('marks dispatches as PAUSED_HOLD when emergency pause is active', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();

    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 905,
        legacyAgendaId: 3005,
        patientLegacyUserId: 80,
        conversationKey: 'whatsapp:1:573001234570',
        recipientPhoneRaw: '3001234570',
        recipientPhoneE164: '573001234570',
        appointmentStartsAtIso: '2026-05-26T14:00:00.000Z',
        scheduledForIso: '2026-05-25T14:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);

    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3005,
        patientLegacyUserId: 80,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234570',
        patientPhoneVerifiedAtIso: '2026-01-01T00:00:00.000Z',
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '14:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.markPausedHold.mockResolvedValue(true);
    fixture.runtimeResolver.resolveEffectiveHotReloadableSettings.mockResolvedValue(
      {
        sendMode: 'live',
        sendRolloutPercent: 100,
        emergencyPauseEnabled: true,
        dispatchBatchSize: 50,
        eligibilityLimit: 500,
        lockTtlSeconds: 300,
        lockHeartbeatIntervalMs: 60_000,
        minConfirmationHours: 3,
      },
    );

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [905],
    });

    expect(fixture.dispatchRepository.markPausedHold).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 905,
        workerId: 'worker:test',
        reason: 'emergency_pause_active',
      }),
    );
    expect(fixture.templateDeliveryService.send).not.toHaveBeenCalled();
    expect(fixture.auditService.record).toHaveBeenCalledWith(
      'appointment_reminder.dispatch.paused_hold',
      expect.objectContaining({
        dispatchId: 905,
        source: 'dispatch_due',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it('still blocks external send when PAUSED_HOLD cannot be persisted', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();

    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 906,
        legacyAgendaId: 3006,
        patientLegacyUserId: 81,
        conversationKey: 'whatsapp:1:573001234571',
        recipientPhoneRaw: '3001234571',
        recipientPhoneE164: '573001234571',
        appointmentStartsAtIso: '2026-05-26T14:00:00.000Z',
        scheduledForIso: '2026-05-25T14:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 5,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);

    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3006,
        patientLegacyUserId: 81,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234571',
        patientPhoneVerifiedAtIso: '2026-01-01T00:00:00.000Z',
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '14:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.markPausedHold.mockResolvedValue(false);
    fixture.runtimeResolver.resolveEffectiveHotReloadableSettings.mockResolvedValue(
      {
        sendMode: 'live',
        sendRolloutPercent: 100,
        emergencyPauseEnabled: true,
        dispatchBatchSize: 50,
        eligibilityLimit: 500,
        lockTtlSeconds: 300,
        lockHeartbeatIntervalMs: 60_000,
        minConfirmationHours: 3,
      },
    );

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [906],
    });

    expect(fixture.dispatchRepository.markPausedHold).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 906,
        workerId: 'worker:test',
        reason: 'emergency_pause_active',
      }),
    );
    expect(fixture.templateDeliveryService.send).not.toHaveBeenCalled();
    expect(fixture.auditService.record).toHaveBeenCalledWith(
      'appointment_reminder.dispatch.lock_lost',
      expect.objectContaining({
        dispatchId: 906,
        workerId: 'worker:test',
        reason: 'cas_mark_paused_hold_failed',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it('re-enqueues retry job when delivery fails and queue mode is enabled', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();

    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 901,
        legacyAgendaId: 3001,
        patientLegacyUserId: 77,
        conversationKey: 'whatsapp:1:573001234567',
        recipientPhoneRaw: '3001234567',
        recipientPhoneE164: '573001234567',
        appointmentStartsAtIso: '2026-05-26T12:00:00.000Z',
        scheduledForIso: '2026-05-25T12:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);

    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3001,
        patientLegacyUserId: 77,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234567',
        patientPhoneVerifiedAtIso: '2026-01-01T00:00:00.000Z',
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '12:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);

    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.renewLock.mockResolvedValue(true);
    fixture.dispatchRepository.markFailed.mockResolvedValue(true);
    fixture.templateDeliveryService.send.mockRejectedValue(
      new Error('Meta unavailable'),
    );

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [901],
    });

    expect(fixture.dispatchRepository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 901,
        attempts: 1,
        nextAttemptAtIso: '2026-05-25T10:05:00.000Z',
      }),
    );
    expect(fixture.dispatchQueue.scheduleDispatchJob).toHaveBeenCalledWith({
      dispatchId: 901,
      scheduledForIso: '2026-05-25T10:05:00.000Z',
    });
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 1,
    });
  });

  it('blocks external send when lease renewal fails', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();

    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 902,
        legacyAgendaId: 3002,
        patientLegacyUserId: 78,
        conversationKey: 'whatsapp:1:573001234568',
        recipientPhoneRaw: '3001234568',
        recipientPhoneE164: '573001234568',
        appointmentStartsAtIso: '2026-05-26T13:00:00.000Z',
        scheduledForIso: '2026-05-25T13:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);

    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3002,
        patientLegacyUserId: 78,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234568',
        patientPhoneVerifiedAtIso: '2026-01-01T00:00:00.000Z',
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '13:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);

    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.renewLock.mockResolvedValue(false);

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [902],
    });

    expect(fixture.dispatchRepository.markFailed).not.toHaveBeenCalled();
    expect(fixture.dispatchRepository.markSent).not.toHaveBeenCalled();
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 1,
    });
  });

  it('marks as failed when CAS transition to SENT fails after send', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 903,
        legacyAgendaId: 3003,
        patientLegacyUserId: 79,
        conversationKey: 'whatsapp:1:573001234569',
        recipientPhoneRaw: '3001234569',
        recipientPhoneE164: '573001234569',
        appointmentStartsAtIso: '2026-05-26T14:00:00.000Z',
        scheduledForIso: '2026-05-25T14:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3003,
        patientLegacyUserId: 79,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234569',
        patientPhoneVerifiedAtIso: '2026-01-01T00:00:00.000Z',
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '14:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.dispatchRepository.markSent.mockResolvedValue(false);
    fixture.dispatchRepository.markSentAfterUncertainOwnership.mockResolvedValue(
      false,
    );
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.renewLock.mockResolvedValue(true);
    fixture.templateDeliveryService.send.mockResolvedValue({
      messageId: 'wamid-903',
    });

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [903],
    });

    expect(fixture.dispatchRepository.markSent).toHaveBeenCalled();
    expect(fixture.auditService.record).toHaveBeenCalledWith(
      'appointment_reminder.dispatch.lock_lost',
      expect.objectContaining({
        dispatchId: 903,
        reason: 'cas_mark_sent_failed',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 1,
    });
  });

  it('compensates SENT transition when CAS fails after successful send', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 904,
        legacyAgendaId: 3004,
        patientLegacyUserId: 79,
        conversationKey: 'whatsapp:1:573001234560',
        recipientPhoneRaw: '3001234560',
        recipientPhoneE164: '573001234560',
        appointmentStartsAtIso: '2026-05-26T14:00:00.000Z',
        scheduledForIso: '2026-05-25T14:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3004,
        patientLegacyUserId: 79,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234560',
        patientPhoneVerifiedAtIso: '2026-01-01T00:00:00.000Z',
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '14:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.dispatchRepository.markSent.mockResolvedValue(false);
    fixture.dispatchRepository.markSentAfterUncertainOwnership.mockResolvedValue(
      true,
    );
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.renewLock.mockResolvedValue(true);
    fixture.templateDeliveryService.send.mockResolvedValue({
      messageId: 'wamid-904',
    });

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [904],
    });

    expect(fixture.dispatchRepository.markSent).toHaveBeenCalled();
    expect(
      fixture.dispatchRepository.markSentAfterUncertainOwnership,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 904,
        metaMessageId: 'wamid-904',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      verificationSent: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it('sends reminder template when phone is valid and opt-in is granted', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 905,
        legacyAgendaId: 3005,
        patientLegacyUserId: 80,
        conversationKey: 'whatsapp:1:573001234561',
        recipientPhoneRaw: '3001234561',
        recipientPhoneE164: '573001234561',
        appointmentStartsAtIso: '2026-05-26T15:00:00.000Z',
        scheduledForIso: '2026-05-25T15:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3005,
        patientLegacyUserId: 80,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234561',
        patientPhoneVerifiedAtIso: null,
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '15:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.markSent.mockResolvedValue(true);
    fixture.dispatchRepository.renewLock.mockResolvedValue(true);
    fixture.templateDeliveryService.send.mockResolvedValue({
      messageId: 'wamid-905',
    });

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [905],
    });

    expect(fixture.templateDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'recordatorio_cita_24h',
        bodyTextParameters: [
          'ADRIANA RUIZ',
          'MEDICINA GENERAL',
          'PRESENCIAL',
          '2026-05-26',
          '15:00',
          'SANTA MARTA',
          'CALLE 1',
          'MEDICO',
        ],
        to: '573001234561',
      }),
    );
    const reminderCallArgs = fixture.templateDeliveryService.send.mock.calls[0]?.[0];
    expect(reminderCallArgs?.templateSnapshot?.visibleBody).toBe(
      fixture.templateSnapshotService
        .buildAppointmentReminderSnapshot({
          templateName: 'recordatorio_cita_24h',
          languageCode: 'es_CO',
          bodyTextParameters: [
            'ADRIANA RUIZ',
            'MEDICINA GENERAL',
            'PRESENCIAL',
            '2026-05-26',
            '15:00',
            'SANTA MARTA',
            'CALLE 1',
            'MEDICO',
          ],
        })
        .visibleBody,
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      verificationSent: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it('sends verification template when phone is valid but opt-in is missing', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 906,
        legacyAgendaId: 3006,
        patientLegacyUserId: 81,
        conversationKey: 'whatsapp:1:573001234562',
        recipientPhoneRaw: '3001234562',
        recipientPhoneE164: '573001234562',
        appointmentStartsAtIso: '2026-05-26T15:00:00.000Z',
        scheduledForIso: '2026-05-25T15:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3006,
        patientLegacyUserId: 81,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234562',
        patientPhoneVerifiedAtIso: null,
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '15:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      false,
    );
    fixture.dispatchRepository.markVerificationPending.mockResolvedValue(true);
    fixture.dispatchRepository.renewLock.mockResolvedValue(true);
    fixture.templateDeliveryService.send.mockResolvedValue({
      messageId: 'wamid-906',
    });

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [906],
    });

    expect(fixture.templateDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'verificacion_telefono_paciente',
        bodyTextParameters: ['ADRIANA RUIZ'],
      }),
    );
    const callArgs = fixture.templateDeliveryService.send.mock.calls[0]?.[0];
    expect(callArgs?.templateSnapshot?.visibleBody).toBe(
      fixture.templateSnapshotService
        .buildSurveyPhoneVerificationSnapshot({
          templateName: 'verificacion_telefono_paciente',
          languageCode: 'es_CO',
          bodyTextParameters: ['ADRIANA RUIZ'],
          visibleButtons: [
            { index: '0', title: 'Confirmar' },
            { index: '1', title: 'No lo reconozco' },
          ],
          buttonPayloads: callArgs?.quickReplyButtons,
        })
        .visibleBody,
    );
    expect(callArgs?.templateSnapshot?.buttonPayloads).toEqual(
      callArgs?.quickReplyButtons,
    );
    expect(callArgs?.quickReplyButtons?.[0]?.payload).toMatch(/^arc:/);
    expect(callArgs?.quickReplyButtons?.[1]?.payload).toMatch(/^arr:/);
    expect(callArgs?.quickReplyButtons?.[0]?.payload.length).toBeLessThanOrEqual(128);
    expect(callArgs?.quickReplyButtons?.[1]?.payload.length).toBeLessThanOrEqual(128);
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it('marks dispatch as invalid phone and skips templates when phone is malformed', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 907,
        legacyAgendaId: 3007,
        patientLegacyUserId: 82,
        conversationKey: 'whatsapp:1:6011234567',
        recipientPhoneRaw: '6011234567',
        recipientPhoneE164: null,
        appointmentStartsAtIso: '2026-05-26T15:00:00.000Z',
        scheduledForIso: '2026-05-25T15:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3007,
        patientLegacyUserId: 82,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '6011234567',
        patientPhoneVerifiedAtIso: null,
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '15:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [907],
    });

    expect(
      fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn,
    ).not.toHaveBeenCalled();
    expect(
      fixture.recipientPolicyRepository.resolveReminderContactSuppression,
    ).not.toHaveBeenCalled();
    expect(fixture.templateDeliveryService.send).not.toHaveBeenCalled();
    expect(fixture.dispatchRepository.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 907,
        status: 'SKIPPED_INVALID_PHONE',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 1,
      failed: 0,
    });
  });

  it('skips reminder when the canonical phone has an active suppression', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 908,
        legacyAgendaId: 3008,
        patientLegacyUserId: 83,
        conversationKey: 'whatsapp:1:573001234563',
        recipientPhoneRaw: '3001234563',
        recipientPhoneE164: '573001234563',
        appointmentStartsAtIso: '2026-05-26T15:00:00.000Z',
        scheduledForIso: '2026-05-25T15:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3008,
        patientLegacyUserId: 83,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234563',
        patientPhoneVerifiedAtIso: null,
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '15:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      false,
    );
    fixture.recipientPolicyRepository.resolveReminderContactSuppression.mockResolvedValue(
      {
        kind: 'BLOCK_SUPPRESSED_CONTACT',
        reason: 'UNKNOWN_PERSON',
      },
    );

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [908],
    });

    expect(fixture.templateDeliveryService.send).not.toHaveBeenCalled();
    expect(fixture.dispatchRepository.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 908,
        status: 'SKIPPED_SUPPRESSED_CONTACT',
        reason: 'UNKNOWN_PERSON',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 1,
      failed: 0,
    });
  });

  it('marks invalid-phone status when suppression policy blocks the canonical phone as invalid', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 910,
        legacyAgendaId: 3010,
        patientLegacyUserId: 85,
        conversationKey: 'whatsapp:1:573001234565',
        recipientPhoneRaw: '3001234565',
        recipientPhoneE164: '573001234565',
        appointmentStartsAtIso: '2026-05-26T15:00:00.000Z',
        scheduledForIso: '2026-05-25T15:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3010,
        patientLegacyUserId: 85,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234565',
        patientPhoneVerifiedAtIso: null,
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '15:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.recipientPolicyRepository.resolveReminderContactSuppression.mockResolvedValue(
      {
        kind: 'BLOCK_INVALID_PHONE',
      },
    );

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [910],
    });

    expect(fixture.templateDeliveryService.send).not.toHaveBeenCalled();
    expect(fixture.dispatchRepository.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 910,
        status: 'SKIPPED_INVALID_PHONE',
        reason: 'INVALID_PHONE',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 1,
      failed: 0,
    });
  });

  it('uses stored e164 as canonical phone when raw phone is malformed', async () => {
    const fixture = createDispatchDueAppointmentRemindersFixture();
    fixture.dispatchRepository.claimDueDispatches.mockResolvedValue([
      {
        id: 909,
        legacyAgendaId: 3009,
        patientLegacyUserId: 84,
        conversationKey: null,
        recipientPhoneRaw: 'no-valido',
        recipientPhoneE164: '573001234564',
        appointmentStartsAtIso: '2026-05-26T16:00:00.000Z',
        scheduledForIso: '2026-05-25T16:00:00.000Z',
        reminderType: 'APPOINTMENT_24H',
        status: 'LOCKED',
        templateName: 'recordatorio_cita_24h',
        verificationTemplateName: 'verificacion_telefono_paciente',
        metaMessageId: null,
        verificationMessageId: null,
        attempts: 0,
        nextAttemptAtIso: null,
        lockAcquiredAtIso: '2026-05-25T10:00:00.000Z',
        lockExpiresAtIso: '2026-05-25T10:05:00.000Z',
        lockedBy: 'worker:test',
        lockVersion: 4,
        verificationTokenHash: null,
        verificationRequestedAtIso: null,
        verificationExpiresAtIso: null,
        sentAtIso: null,
      },
    ]);
    fixture.eligibilityRepository.findByLegacyAgendaIds.mockResolvedValue([
      {
        legacyAgendaId: 3009,
        patientLegacyUserId: 84,
        patientFirstName: 'ADRIANA',
        patientLastName: 'RUIZ',
        patientPhoneRaw: '3001234564',
        patientPhoneVerifiedAtIso: null,
        appointmentDateIso: '2026-05-26T00:00:00.000Z',
        appointmentTimeHhmm: '16:00',
        legacyState: 'Asignada',
        modalityId: 0,
        specialtyName: 'MEDICINA GENERAL',
        siteCity: 'SANTA MARTA',
        siteAddress: 'CALLE 1',
        doctorName: 'MEDICO',
      },
    ]);
    fixture.recipientPolicyRepository.hasAppointmentNotificationsOptIn.mockResolvedValue(
      true,
    );
    fixture.dispatchRepository.markSent.mockResolvedValue(true);
    fixture.dispatchRepository.renewLock.mockResolvedValue(true);
    fixture.templateDeliveryService.send.mockResolvedValue({
      messageId: 'wamid-909',
    });

    const result = await fixture.useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [909],
    });

    expect(
      fixture.recipientPolicyRepository.resolveReminderContactSuppression,
    ).toHaveBeenCalledWith({
      patientLegacyUserId: 84,
      phone: '573001234564',
    });
    expect(fixture.templateDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationKey: 'whatsapp:12345:573001234564',
        to: '573001234564',
      }),
    );
    expect(fixture.dispatchRepository.markSkipped).not.toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 909,
        status: 'SKIPPED_INVALID_PHONE',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      verificationSent: 0,
      skipped: 0,
      failed: 0,
    });
  });
});
