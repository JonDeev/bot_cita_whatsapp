import { Test } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/application/services/audit.service';
import { AppointmentReminderBootstrapConfigService } from '../src/modules/reminders/application/services/appointment-reminder-bootstrap-config.service';
import { AppointmentReminderRuntimeSettingsCatalogService } from '../src/modules/reminders/application/services/appointment-reminder-runtime-settings-catalog.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../src/modules/reminders/application/services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderDispatchConfigService } from '../src/modules/reminders/application/services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../src/modules/reminders/application/services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderButtonTokenService } from '../src/modules/reminders/application/services/appointment-reminder-button-token.service';
import { AppointmentReminderTemplateConfigService } from '../src/modules/reminders/application/services/appointment-reminder-template-config.service';
import { AppointmentReminderTemplateDeliveryService } from '../src/modules/reminders/application/services/appointment-reminder-template-delivery.service';
import { AppointmentReminderWindowService } from '../src/modules/reminders/application/services/appointment-reminder-window.service';
import { TemplateMessageSnapshotService } from '../src/modules/whatsapp/application/services/template-message-snapshot.service';
import { DispatchDueAppointmentRemindersUseCase } from '../src/modules/reminders/application/use-cases/dispatch-due-appointment-reminders.use-case';
import { ReconcileAppointmentReminderDispatchHealthUseCase } from '../src/modules/reminders/application/use-cases/reconcile-appointment-reminder-dispatch-health.use-case';
import { ToggleAppointmentReminderEmergencyPauseUseCase } from '../src/modules/reminders/application/use-cases/toggle-appointment-reminder-emergency-pause.use-case';
import type {
  AppointmentReminderDispatchRecord,
  AppointmentReminderDispatchRepository,
} from '../src/modules/reminders/domain/ports/appointment-reminder-dispatch.repository';
import type { AppointmentReminderEligibilityRepository } from '../src/modules/reminders/domain/ports/appointment-reminder-eligibility.repository';
import type { AppointmentReminderRecipientPolicyRepository } from '../src/modules/reminders/domain/ports/appointment-reminder-recipient-policy.repository';
import { APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT } from '../src/modules/reminders/domain/appointment-reminder-runtime.types';

type RuntimeSettingsSnapshot = {
  sendMode: 'mock' | 'live';
  sendRolloutPercent: 0 | 5 | 10 | 25 | 50 | 75 | 100;
  emergencyPauseEnabled: boolean;
  dispatchBatchSize: 10 | 25 | 50 | 100;
  eligibilityLimit: 100 | 250 | 500 | 1000;
  syncEnabled: boolean;
  dispatchEnabled: boolean;
  queueEnabled: boolean;
  syncIntervalMs: 60000 | 300000 | 600000 | 900000;
  recoverySweepIntervalMs: 60000 | 300000 | 600000 | 900000;
  workerConcurrency: 1 | 2 | 3 | 5;
  lockTtlSeconds: 120 | 180 | 300 | 600;
  lockHeartbeatIntervalMs: 30000 | 60000 | 120000;
  minConfirmationHours: 3 | 4 | 6 | 12;
};

function cloneSnapshot(snapshot: RuntimeSettingsSnapshot): RuntimeSettingsSnapshot {
  return { ...snapshot };
}

function createRuntimeSettingsRepo(initialSnapshot: RuntimeSettingsSnapshot) {
  let version = 1;
  let snapshot = cloneSnapshot(initialSnapshot);
  const events: Array<{
    id: number;
    settingsVersion: number;
    adminUserId: number | null;
    actor: {
      displayName: string | null;
      username: string | null;
    };
    changeType:
      | 'SETTINGS_UPDATED'
      | 'EMERGENCY_PAUSE_ENABLED'
      | 'EMERGENCY_PAUSE_DISABLED'
      | 'DEFAULTS_SEEDED';
    section: 'primary' | 'advanced' | 'protected';
    reason: string | null;
    previousSnapshot: RuntimeSettingsSnapshot;
    newSnapshot: RuntimeSettingsSnapshot;
    effectiveSnapshot: RuntimeSettingsSnapshot;
    occurredAtIso: string;
    createdAtIso: string;
  }> = [];

  const repo = {
    findByScope: jest.fn(async (scopeKey: string) => {
      if (scopeKey !== APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT) {
        return null;
      }

      return {
        id: 1,
        scopeKey,
        version,
        snapshot,
        updatedByAdminUserId: 7,
        updatedAtIso: '2026-06-07T12:00:00.000Z',
        createdAtIso: '2026-06-07T11:00:00.000Z',
      };
    }),
    findLatestEventByChangeTypes: jest.fn(async ({
      changeTypes,
    }: {
      changeTypes: readonly (
        | 'SETTINGS_UPDATED'
        | 'EMERGENCY_PAUSE_ENABLED'
        | 'EMERGENCY_PAUSE_DISABLED'
        | 'DEFAULTS_SEEDED'
      )[];
    }) => {
      const latestRelevantEvent = [...events]
        .filter((event) => changeTypes.includes(event.changeType))
        .sort((a, b) => {
          if (a.occurredAtIso !== b.occurredAtIso) {
            return a.occurredAtIso > b.occurredAtIso ? -1 : 1;
          }

          return b.id - a.id;
        })[0];

      return latestRelevantEvent ?? null;
    }),
    listEvents: jest.fn(async ({ limit }: { limit: number }) =>
      events.slice(0, limit),
    ),
    saveWithEvent: jest.fn(async (command: {
      scopeKey: string;
      expectedVersion: number;
      nextSnapshot: RuntimeSettingsSnapshot;
      effectiveSnapshot: RuntimeSettingsSnapshot;
      adminUserId: number | null;
      changeType:
        | 'SETTINGS_UPDATED'
        | 'EMERGENCY_PAUSE_ENABLED'
        | 'EMERGENCY_PAUSE_DISABLED'
        | 'DEFAULTS_SEEDED';
      section: 'primary' | 'advanced' | 'protected';
      reason: string | null;
      occurredAtIso: string;
      adminAudit: Record<string, unknown>;
    }) => {
      if (command.scopeKey !== APPOINTMENT_REMINDER_RUNTIME_SETTINGS_SCOPE_DEFAULT) {
        return null;
      }

      if (version !== command.expectedVersion) {
        return null;
      }

      const previousSnapshot = cloneSnapshot(snapshot);
      snapshot = cloneSnapshot(command.nextSnapshot);
      version += 1;

      const event = {
        id: events.length + 1,
        settingsVersion: version,
        adminUserId: command.adminUserId,
        actor: {
          displayName: 'Admin SISM',
          username: 'admin',
        },
        changeType: command.changeType,
        section: command.section,
        reason: command.reason,
        previousSnapshot,
        newSnapshot: cloneSnapshot(command.nextSnapshot),
        effectiveSnapshot: cloneSnapshot(command.effectiveSnapshot),
        occurredAtIso: command.occurredAtIso,
        createdAtIso: command.occurredAtIso,
      };
      events.unshift(event);

      return {
        settings: {
          id: 1,
          scopeKey: command.scopeKey,
          version,
          snapshot,
          updatedByAdminUserId: command.adminUserId,
          updatedAtIso: command.occurredAtIso,
          createdAtIso: '2026-06-07T11:00:00.000Z',
        },
        event,
      };
    }),
    getSnapshot: () => cloneSnapshot(snapshot),
    getVersion: () => version,
  };

  return repo;
}

function createDispatchRepository(initialDispatch: AppointmentReminderDispatchRecord) {
  const dispatches = new Map<number, AppointmentReminderDispatchRecord>([
    [initialDispatch.id, { ...initialDispatch }],
  ]);

  return {
    claimDueDispatches: jest.fn(
      async ({ runAtIso, limit, restrictToDispatchIds }: { runAtIso: string; workerId: string; lockTtlSeconds: number; limit: number; restrictToDispatchIds?: readonly number[]; }) => {
        const due = [...dispatches.values()]
          .filter((dispatch) => dispatch.status === 'PENDING')
          .filter((dispatch) => dispatch.scheduledForIso <= runAtIso)
          .filter(
            (dispatch) =>
              !restrictToDispatchIds ||
              restrictToDispatchIds.includes(dispatch.id),
          )
          .slice(0, limit)
          .map((dispatch) => {
            const locked: AppointmentReminderDispatchRecord = {
              ...dispatch,
              status: 'LOCKED',
              lockVersion: dispatch.lockVersion + 1,
              lockedBy: 'worker:test',
              lockAcquiredAtIso: runAtIso,
              lockExpiresAtIso: runAtIso,
            };
            dispatches.set(dispatch.id, locked);
            return locked;
          });

        return due;
      },
    ),
    markPausedHold: jest.fn(async ({ dispatchId, expectedLockVersion }: { dispatchId: number; expectedLockVersion: number; workerId: string; reason: string; }) => {
      const current = dispatches.get(dispatchId);
      if (!current || current.lockVersion !== expectedLockVersion) {
        return false;
      }

      dispatches.set(dispatchId, {
        ...current,
        status: 'PAUSED_HOLD',
      });
      return true;
    }),
    releasePausedHolds: jest.fn(async ({ limit }: { runAtIso: string; limit: number; }) => {
      const released: number[] = [];
      for (const dispatch of dispatches.values()) {
        if (released.length >= limit) {
          break;
        }

        if (dispatch.status !== 'PAUSED_HOLD') {
          continue;
        }

        dispatches.set(dispatch.id, {
          ...dispatch,
          status: 'PENDING',
          lockedBy: null,
          lockAcquiredAtIso: null,
          lockExpiresAtIso: null,
        });
        released.push(dispatch.id);
      }

      return released;
    }),
    markSent: jest.fn(async ({ dispatchId, expectedLockVersion, metaMessageId, sentAtIso }: { dispatchId: number; expectedLockVersion: number; workerId: string; metaMessageId: string; sentAtIso: string; }) => {
      const current = dispatches.get(dispatchId);
      if (!current || current.lockVersion !== expectedLockVersion) {
        return false;
      }

      dispatches.set(dispatchId, {
        ...current,
        status: 'SENT',
        metaMessageId,
        sentAtIso,
      });
      return true;
    }),
    markSkipped: jest.fn(),
    markFailed: jest.fn(),
    markPostVerificationPausedHold: jest.fn(),
    markPostVerificationSent: jest.fn(),
    markPostVerificationSkipped: jest.fn(),
    markPostVerificationSentAfterUncertainOwnership: jest.fn(),
    markSentAfterUncertainOwnership: jest.fn(),
    recoverExpiredLocks: jest.fn().mockResolvedValue(0),
    expirePendingPhoneVerifications: jest.fn().mockResolvedValue(0),
    renewLock: jest.fn().mockResolvedValue(true),
    findDueDispatchIds: jest.fn().mockResolvedValue([]),
    findById: jest.fn(async (dispatchId: number) => dispatches.get(dispatchId) ?? null),
    findByVerificationTokenHash: jest.fn().mockResolvedValue(null),
    markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    recordInboundDedup: jest.fn().mockResolvedValue(true),
    markVerificationPending: jest.fn().mockResolvedValue(true),
    markVerificationPendingAfterUncertainOwnership: jest.fn().mockResolvedValue(true),
    markOlderPendingDispatchesAsRescheduled: jest.fn().mockResolvedValue(0),
    upsertDispatch: jest.fn(),
    getDispatches: () => dispatches,
  };
}

describe('Reminder runtime settings integration flow', () => {
  it('keeps emergency pause reason visible, holds dispatches, and releases them after pause is cleared', async () => {
    const bootstrapSnapshot: RuntimeSettingsSnapshot = {
      sendMode: 'live',
      sendRolloutPercent: 100,
      emergencyPauseEnabled: false,
      dispatchBatchSize: 50,
      eligibilityLimit: 500,
      syncEnabled: false,
      dispatchEnabled: false,
      queueEnabled: true,
      syncIntervalMs: 300000,
      recoverySweepIntervalMs: 300000,
      workerConcurrency: 1,
      lockTtlSeconds: 300,
      lockHeartbeatIntervalMs: 60000,
      minConfirmationHours: 3,
    };

    const runtimeRepo = createRuntimeSettingsRepo(bootstrapSnapshot);
    const dispatchRepository = createDispatchRepository({
      id: 9001,
      legacyAgendaId: 3001,
      patientLegacyUserId: 77,
      conversationKey: 'whatsapp:12345:573001234567',
      recipientPhoneRaw: '3001234567',
      recipientPhoneE164: '573001234567',
      appointmentStartsAtIso: '2099-01-01T12:00:00.000Z',
      scheduledForIso: '2026-06-07T10:00:00.000Z',
      reminderType: 'APPOINTMENT_24H',
      status: 'PENDING',
      templateName: 'recordatorio_cita_24h',
      verificationTemplateName: 'verificacion_telefono_paciente',
      metaMessageId: null,
      verificationMessageId: null,
      attempts: 0,
      nextAttemptAtIso: null,
      lockAcquiredAtIso: null,
      lockExpiresAtIso: null,
      lockedBy: null,
      lockVersion: 1,
      verificationTokenHash: null,
      verificationRequestedAtIso: null,
      verificationExpiresAtIso: null,
      sentAtIso: null,
    });

    const eligibilityRepository = {
      findByLegacyAgendaIds: jest.fn().mockResolvedValue([
        {
          legacyAgendaId: 3001,
          patientLegacyUserId: 77,
          patientFirstName: 'ANA',
          patientLastName: 'GOMEZ',
          patientPhoneRaw: '3001234567',
          patientPhoneVerifiedAtIso: '2026-06-07T09:00:00.000Z',
          appointmentDateIso: '2099-01-01T00:00:00.000Z',
          appointmentTimeHhmm: '12:00',
          legacyState: 'Asignada',
          modalityId: 0,
          specialtyName: 'MEDICINA GENERAL',
          siteCity: 'SANTA MARTA',
          siteAddress: 'CALLE 1',
          doctorName: 'DR. PEREZ',
        },
      ]),
    } as unknown as AppointmentReminderEligibilityRepository;

    const recipientPolicyRepository = {
      isHumanHandoffActive: jest.fn().mockResolvedValue(false),
      hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
      hasActiveSuppression: jest.fn().mockResolvedValue(false),
      upsertUnknownPersonSuppression: jest.fn(),
    } as unknown as AppointmentReminderRecipientPolicyRepository;

    const dispatchConfigService = {
      getLockTtlSeconds: jest.fn().mockReturnValue(300),
      getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60000),
      getDispatchBatchSize: jest.fn().mockReturnValue(50),
      isQueueEnabled: jest.fn().mockReturnValue(true),
      getWhatsAppPhoneNumberId: jest.fn().mockReturnValue('12345'),
      getRecoveryBatchSize: jest.fn().mockReturnValue(50),
    } as unknown as AppointmentReminderDispatchConfigService;

    const templateDeliveryService = {
      send: jest.fn().mockResolvedValue({ messageId: 'wamid-9001' }),
    } as unknown as AppointmentReminderTemplateDeliveryService;

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const bootstrap = {
      getRuntimeSettingsSnapshot: jest.fn().mockReturnValue(bootstrapSnapshot),
    } as unknown as AppointmentReminderBootstrapConfigService;

    const catalog = new AppointmentReminderRuntimeSettingsCatalogService();
    const resolver = new AppointmentReminderRuntimeSettingsResolverService(
      runtimeRepo as never,
      bootstrap,
      catalog,
    );

    const togglePauseUseCase = new ToggleAppointmentReminderEmergencyPauseUseCase(
      runtimeRepo as never,
      resolver,
    );

    const dispatchUseCase = new DispatchDueAppointmentRemindersUseCase(
      dispatchRepository as unknown as AppointmentReminderDispatchRepository,
      eligibilityRepository,
      recipientPolicyRepository,
      {
        scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
      } as never,
      dispatchConfigService,
      {
        getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
        getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('confirm:'),
        getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('reject:'),
      } as unknown as AppointmentReminderTemplateConfigService,
      new AppointmentReminderWindowService(),
      new AppointmentReminderButtonTokenService(),
      new AppointmentReminderPhoneNormalizerService(),
      new TemplateMessageSnapshotService(),
      templateDeliveryService,
      auditService,
      resolver,
    );

    const reconcileUseCase = new ReconcileAppointmentReminderDispatchHealthUseCase(
      dispatchRepository as unknown as AppointmentReminderDispatchRepository,
      dispatchConfigService,
      auditService,
      resolver,
    );

    const enabledView = await togglePauseUseCase.execute({
      adminUserId: 7,
      adminRole: 'ADMIN',
      expectedVersion: runtimeRepo.getVersion(),
      reason: 'Incidente operativo',
      emergencyPauseEnabled: 'enabled',
    });

    expect(enabledView.metadata.emergencyPauseReason).toBe(
      'Incidente operativo',
    );

    const pausedDispatchResult = await dispatchUseCase.execute({
      runAtIso: '2026-06-07T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [9001],
    });

    expect(pausedDispatchResult).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 0,
    });
    expect(templateDeliveryService.send).not.toHaveBeenCalled();

    const disabledView = await togglePauseUseCase.execute({
      adminUserId: 7,
      adminRole: 'ADMIN',
      expectedVersion: runtimeRepo.getVersion(),
      reason: 'Incidente resuelto',
      emergencyPauseEnabled: 'disabled',
    });

    expect(disabledView.metadata.emergencyPauseReason).toBeNull();

    const reconcileResult = await reconcileUseCase.execute({
      runAtIso: '2026-06-07T10:05:00.000Z',
    });

    expect(reconcileResult.recoveredLocks).toBe(0);
    expect(reconcileResult.expiredVerifications).toBe(0);

    const sentDispatchResult = await dispatchUseCase.execute({
      runAtIso: '2026-06-07T10:05:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [9001],
    });

    expect(sentDispatchResult.sent).toBe(1);
    expect(templateDeliveryService.send).toHaveBeenCalledTimes(1);
    expect(dispatchRepository.getDispatches().get(9001)?.status).toBe('SENT');
  });
});
