import { AuditService } from '../../../audit/application/services/audit.service';
import { DispatchDueAppointmentRemindersUseCase } from './dispatch-due-appointment-reminders.use-case';

describe('DispatchDueAppointmentRemindersUseCase', () => {
  it('re-enqueues retry job when delivery fails and queue mode is enabled', async () => {
    const dispatchRepository = {
      claimDueDispatches: jest.fn().mockResolvedValue([
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
      ]),
      markSent: jest.fn(),
      markVerificationPending: jest.fn(),
      markVerificationPendingAfterUncertainOwnership: jest.fn(),
      markSentAfterUncertainOwnership: jest.fn(),
      markSkipped: jest.fn(),
      renewLock: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn().mockResolvedValue(true),
    };

    const eligibilityRepository = {
      findByLegacyAgendaIds: jest.fn().mockResolvedValue([
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
      ]),
    };

    const recipientPolicyRepository = {
      isHumanHandoffActive: jest.fn().mockResolvedValue(false),
      hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
      hasActiveSuppression: jest.fn().mockResolvedValue(false),
    };

    const dispatchQueue = {
      scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      getLockTtlSeconds: jest.fn().mockReturnValue(300),
      getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60_000),
      getDispatchBatchSize: jest.fn().mockReturnValue(50),
      isQueueEnabled: jest.fn().mockReturnValue(true),
    };

    const templateConfig = {
      getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
      getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('confirm:'),
      getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('reject:'),
    };

    const sendWhatsappTemplateMessage = {
      execute: jest.fn().mockRejectedValue(new Error('Meta unavailable')),
    };

    const recordAudit = jest.fn().mockResolvedValue(undefined);
    const auditService = {
      record: recordAudit,
    } as unknown as AuditService;

    const useCase = new DispatchDueAppointmentRemindersUseCase(
      dispatchRepository as any,
      eligibilityRepository as any,
      recipientPolicyRepository as any,
      dispatchQueue,
      configService as any,
      templateConfig as any,
      {} as any,
      {} as any,
      {} as any,
      sendWhatsappTemplateMessage as any,
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [901],
    });

    expect(dispatchRepository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 901,
        attempts: 1,
        nextAttemptAtIso: '2026-05-25T10:05:00.000Z',
      }),
    );
    expect(dispatchQueue.scheduleDispatchJob).toHaveBeenCalledWith({
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
    const dispatchRepository = {
      claimDueDispatches: jest.fn().mockResolvedValue([
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
      ]),
      markSent: jest.fn(),
      markVerificationPending: jest.fn(),
      markVerificationPendingAfterUncertainOwnership: jest.fn(),
      markSentAfterUncertainOwnership: jest.fn(),
      markSkipped: jest.fn(),
      renewLock: jest.fn().mockResolvedValue(false),
      markFailed: jest.fn(),
    };

    const useCase = new DispatchDueAppointmentRemindersUseCase(
      dispatchRepository as any,
      {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
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
        ]),
      } as any,
      {
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
      } as any,
      {
        scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
      },
      {
        getLockTtlSeconds: jest.fn().mockReturnValue(300),
        getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60_000),
        getDispatchBatchSize: jest.fn().mockReturnValue(50),
        isQueueEnabled: jest.fn().mockReturnValue(true),
      } as any,
      {
        getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
        getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('confirm:'),
        getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('reject:'),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      { execute: jest.fn() } as any,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [902],
    });

    expect(dispatchRepository.markFailed).not.toHaveBeenCalled();
    expect(dispatchRepository.markSent).not.toHaveBeenCalled();
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 0,
      skipped: 0,
      failed: 1,
    });
  });

  it('marks as failed when CAS transition to SENT fails after send', async () => {
    const dispatchRepository = {
      claimDueDispatches: jest.fn().mockResolvedValue([
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
      ]),
      markSent: jest.fn().mockResolvedValue(false),
      markVerificationPending: jest.fn(),
      markVerificationPendingAfterUncertainOwnership: jest.fn(),
      markSentAfterUncertainOwnership: jest.fn().mockResolvedValue(false),
      markSkipped: jest.fn(),
      renewLock: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn(),
    };

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new DispatchDueAppointmentRemindersUseCase(
      dispatchRepository as any,
      {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
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
        ]),
      } as any,
      {
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
      } as any,
      {
        scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
      },
      {
        getLockTtlSeconds: jest.fn().mockReturnValue(300),
        getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60_000),
        getDispatchBatchSize: jest.fn().mockReturnValue(50),
        isQueueEnabled: jest.fn().mockReturnValue(true),
      } as any,
      {
        getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
        getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('confirm:'),
        getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('reject:'),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        execute: jest.fn().mockResolvedValue({ messageId: 'wamid-903' }),
      } as any,
      auditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [903],
    });

    expect(dispatchRepository.markSent).toHaveBeenCalled();
    expect(recordAudit).toHaveBeenCalledWith(
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
    const dispatchRepository = {
      claimDueDispatches: jest.fn().mockResolvedValue([
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
      ]),
      markSent: jest.fn().mockResolvedValue(false),
      markVerificationPending: jest.fn(),
      markVerificationPendingAfterUncertainOwnership: jest.fn(),
      markSentAfterUncertainOwnership: jest.fn().mockResolvedValue(true),
      markSkipped: jest.fn(),
      renewLock: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn(),
    };

    const useCase = new DispatchDueAppointmentRemindersUseCase(
      dispatchRepository as any,
      {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
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
        ]),
      } as any,
      {
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
      } as any,
      {
        scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
      },
      {
        getLockTtlSeconds: jest.fn().mockReturnValue(300),
        getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60_000),
        getDispatchBatchSize: jest.fn().mockReturnValue(50),
        isQueueEnabled: jest.fn().mockReturnValue(true),
      } as any,
      {
        getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
        getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('confirm:'),
        getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('reject:'),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        execute: jest.fn().mockResolvedValue({ messageId: 'wamid-904' }),
      } as any,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [904],
    });

    expect(dispatchRepository.markSent).toHaveBeenCalled();
    expect(
      dispatchRepository.markSentAfterUncertainOwnership,
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

  it('compensates PHONE_VERIFICATION_PENDING transition when CAS fails after verification send', async () => {
    const dispatchRepository = {
      claimDueDispatches: jest.fn().mockResolvedValue([
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
      ]),
      markSent: jest.fn(),
      markVerificationPending: jest.fn().mockResolvedValue(false),
      markVerificationPendingAfterUncertainOwnership: jest
        .fn()
        .mockResolvedValue(true),
      markSentAfterUncertainOwnership: jest.fn(),
      markSkipped: jest.fn(),
      renewLock: jest.fn().mockResolvedValue(true),
      markFailed: jest.fn(),
    };

    const useCase = new DispatchDueAppointmentRemindersUseCase(
      dispatchRepository as any,
      {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
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
        ]),
      } as any,
      {
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
      } as any,
      {
        scheduleDispatchJob: jest.fn().mockResolvedValue(undefined),
      },
      {
        getLockTtlSeconds: jest.fn().mockReturnValue(300),
        getLockHeartbeatIntervalMs: jest.fn().mockReturnValue(60_000),
        getDispatchBatchSize: jest.fn().mockReturnValue(50),
        isQueueEnabled: jest.fn().mockReturnValue(true),
      } as any,
      {
        getTemplateLanguageCode: jest.fn().mockReturnValue('es_CO'),
        getConfirmButtonPayloadPrefix: jest.fn().mockReturnValue('confirm:'),
        getRejectButtonPayloadPrefix: jest.fn().mockReturnValue('reject:'),
      } as any,
      {
        resolveVerificationExpiresAtIso: jest
          .fn()
          .mockReturnValue('2026-05-26T12:00:00.000Z'),
      } as any,
      {
        createToken: jest.fn().mockReturnValue('token-905'),
        hashToken: jest.fn().mockReturnValue('hash-905'),
      } as any,
      {} as any,
      {
        execute: jest.fn().mockResolvedValue({ messageId: 'wamid-905' }),
      } as any,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await useCase.execute({
      runAtIso: '2026-05-25T10:00:00.000Z',
      workerId: 'worker:test',
      restrictToDispatchIds: [905],
    });

    expect(dispatchRepository.markVerificationPending).toHaveBeenCalled();
    expect(
      dispatchRepository.markVerificationPendingAfterUncertainOwnership,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 905,
        verificationMessageId: 'wamid-905',
        verificationTokenHash: 'hash-905',
      }),
    );
    expect(result).toEqual({
      claimed: 1,
      sent: 0,
      verificationSent: 1,
      skipped: 0,
      failed: 0,
    });
  });
});
