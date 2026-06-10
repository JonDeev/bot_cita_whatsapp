import { AuditService } from '../../../audit/application/services/audit.service';
import { RegisterWhatsappPostBookingConsentUseCase } from '../../../patients/application/use-cases/register-whatsapp-post-booking-consent.use-case';
import type { AppointmentReminderDispatchRepository } from '../../domain/ports/appointment-reminder-dispatch.repository';
import type {
  AppointmentReminderEligibilityRepository,
  EligibleAppointmentForReminder,
} from '../../domain/ports/appointment-reminder-eligibility.repository';
import type { AppointmentReminderPatientContactRepository } from '../../domain/ports/appointment-reminder-patient-contact.repository';
import type { AppointmentReminderRecipientPolicyRepository } from '../../domain/ports/appointment-reminder-recipient-policy.repository';
import { AppointmentReminderButtonTokenService } from '../services/appointment-reminder-button-token.service';
import { AppointmentReminderDispatchConfigService } from '../services/appointment-reminder-dispatch-config.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import type { AppointmentReminderTemplateDeliveryService } from '../services/appointment-reminder-template-delivery.service';
import { AppointmentReminderRuntimeSettingsResolverService } from '../services/appointment-reminder-runtime-settings-resolver.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import { HandleAppointmentReminderVerificationReplyUseCase } from './handle-appointment-reminder-verification-reply.use-case';

type DispatchRepositoryMock = Pick<
  AppointmentReminderDispatchRepository,
  | 'recordInboundDedup'
  | 'findById'
  | 'markPostVerificationSkipped'
  | 'markPostVerificationPausedHold'
  | 'markPostVerificationSent'
  | 'markInboundDedupProcessed'
>;

type EligibilityRepositoryMock = Pick<
  AppointmentReminderEligibilityRepository,
  'findByLegacyAgendaIds'
>;

type PatientContactRepositoryMock = Pick<
  AppointmentReminderPatientContactRepository,
  'markPhoneVerified' | 'clearPhoneAndVerification'
>;

type RecipientPolicyRepositoryMock = Pick<
  AppointmentReminderRecipientPolicyRepository,
  | 'resolveReminderContactSuppression'
  | 'hasActiveSuppression'
  | 'upsertUnknownPersonSuppression'
  | 'clearUnknownPersonSuppression'
> &
  Partial<
    Pick<
      AppointmentReminderRecipientPolicyRepository,
      'hasAppointmentNotificationsOptIn' | 'isHumanHandoffActive'
    >
  >;

type DispatchConfigMock = Pick<
  AppointmentReminderDispatchConfigService,
  'getVerificationGraceHours'
> &
  Partial<Pick<AppointmentReminderDispatchConfigService, 'getWhatsAppPhoneNumberId'>>;

type TemplateDeliveryServiceMock = Pick<
  AppointmentReminderTemplateDeliveryService,
  'send'
>;

type RegisterWhatsappPostBookingConsentUseCaseMock = Pick<
  RegisterWhatsappPostBookingConsentUseCase,
  'execute'
>;

function createUseCase(input: {
  dispatchRepository: Partial<DispatchRepositoryMock> &
    Pick<
      DispatchRepositoryMock,
      | 'recordInboundDedup'
      | 'findById'
      | 'markPostVerificationSkipped'
      | 'markPostVerificationSent'
      | 'markInboundDedupProcessed'
    >;
  eligibilityRepository: EligibilityRepositoryMock;
  patientContactRepository: PatientContactRepositoryMock;
  recipientPolicyRepository: Partial<RecipientPolicyRepositoryMock> &
    Pick<
      RecipientPolicyRepositoryMock,
      'upsertUnknownPersonSuppression'
    >;
  configService: DispatchConfigMock;
  templateDeliveryService: TemplateDeliveryServiceMock;
  registerWhatsappPostBookingConsent?: RegisterWhatsappPostBookingConsentUseCaseMock;
  auditService: AuditService;
  tokenService: AppointmentReminderButtonTokenService;
  templateConfig: AppointmentReminderTemplateConfigService;
  runtimeResolver?: AppointmentReminderRuntimeSettingsResolverService;
}): HandleAppointmentReminderVerificationReplyUseCase {
  const configService: AppointmentReminderDispatchConfigService = {
    ...input.configService,
    getWhatsAppPhoneNumberId:
      input.configService.getWhatsAppPhoneNumberId ??
      jest.fn().mockReturnValue('12345'),
  } as AppointmentReminderDispatchConfigService;

  return new HandleAppointmentReminderVerificationReplyUseCase(
    {
      recordInboundDedup: input.dispatchRepository.recordInboundDedup,
      findById: input.dispatchRepository.findById,
      markPostVerificationSkipped:
        input.dispatchRepository.markPostVerificationSkipped,
      markPostVerificationPausedHold:
        input.dispatchRepository.markPostVerificationPausedHold ??
        jest.fn().mockResolvedValue(false),
      markPostVerificationSent: input.dispatchRepository.markPostVerificationSent,
      markInboundDedupProcessed: input.dispatchRepository.markInboundDedupProcessed,
    } as unknown as AppointmentReminderDispatchRepository,
    input.eligibilityRepository as AppointmentReminderEligibilityRepository,
    input.patientContactRepository,
    {
      resolveReminderContactSuppression:
        input.recipientPolicyRepository.resolveReminderContactSuppression ??
        jest.fn().mockResolvedValue({ kind: 'ALLOW_CONTACT' }),
      hasActiveSuppression:
        input.recipientPolicyRepository.hasActiveSuppression ??
        jest
          .fn()
          .mockImplementation(async (command: {
            patientLegacyUserId: number;
            phone: string;
          }) => {
            const decision =
              await input.recipientPolicyRepository.resolveReminderContactSuppression(
                command,
              );
            return decision.kind !== 'ALLOW_CONTACT';
          }),
      upsertUnknownPersonSuppression:
        input.recipientPolicyRepository.upsertUnknownPersonSuppression,
      clearUnknownPersonSuppression:
        input.recipientPolicyRepository.clearUnknownPersonSuppression ??
        jest.fn().mockResolvedValue(false),
      hasAppointmentNotificationsOptIn:
        input.recipientPolicyRepository.hasAppointmentNotificationsOptIn ??
        jest.fn().mockResolvedValue(false),
      isHumanHandoffActive:
        input.recipientPolicyRepository.isHumanHandoffActive ??
        jest.fn().mockResolvedValue(false),
    } as AppointmentReminderRecipientPolicyRepository,
    input.templateConfig,
    input.tokenService,
    new AppointmentReminderWindowService(),
    configService,
    new AppointmentReminderPhoneNormalizerService(),
    input.templateDeliveryService as AppointmentReminderTemplateDeliveryService,
    input.registerWhatsappPostBookingConsent ??
      ({
        execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
      } as unknown as RegisterWhatsappPostBookingConsentUseCase),
    input.auditService,
    input.runtimeResolver,
  );
}

function createMinimalEligibleAppointment(
  override?: Partial<EligibleAppointmentForReminder>,
): EligibleAppointmentForReminder {
  return {
    legacyAgendaId: 1,
    patientLegacyUserId: 1,
    patientPhoneRaw: '3001234567',
    patientFirstName: 'ADRIANA',
    patientLastName: 'RUIZ',
    patientPhoneVerifiedAtIso: null,
    appointmentDateIso: '2099-01-01T00:00:00.000Z',
    appointmentTimeHhmm: '08:00',
    legacyState: 'Asignada',
    modalityId: 0,
    specialtyName: 'MEDICINA GENERAL',
    doctorName: 'MEDICO',
    siteCity: 'SANTA MARTA',
    siteAddress: 'CALLE 1',
    ...override,
  };
}

describe('HandleAppointmentReminderVerificationReplyUseCase', () => {
  const originalSecret =
    process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET;

  beforeEach(() => {
    process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.APPOINTMENT_REMINDERS_BUTTON_SIGNING_SECRET = originalSecret;
  });

  it('marks inbound dedup as processed when confirmation is skipped by suppression', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1001,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1001,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 501,
        patientLegacyUserId: 80,
        recipientPhoneRaw: '3001234567',
        recipientPhoneE164: '573001234567',
        appointmentStartsAtIso: '2099-02-01T12:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markPostVerificationPausedHold: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const recipientPolicyRepository = {
      resolveReminderContactSuppression: jest.fn().mockResolvedValue({
        kind: 'BLOCK_SUPPRESSED_CONTACT',
        reason: 'UNKNOWN_PERSON',
      }),
      hasActiveSuppression: jest.fn().mockResolvedValue(true),
      upsertUnknownPersonSuppression: jest.fn(),
      clearUnknownPersonSuppression: jest.fn().mockResolvedValue(false),
    };

    const patientContactRepository = {
      markPhoneVerified: jest.fn().mockResolvedValue(undefined),
      clearPhoneAndVerification: jest.fn(),
    };

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const templateDeliveryService = {
      send: jest.fn(),
    };
    const registerWhatsappPostBookingConsent = {
      execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository: {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
          createMinimalEligibleAppointment({
            legacyAgendaId: 501,
            patientFirstName: 'JOSE',
            patientLastName: 'PEREZ',
          }),
        ]),
      },
      patientContactRepository,
      recipientPolicyRepository,
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService,
      registerWhatsappPostBookingConsent,
      auditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-1',
      fromPhone: '573001234567',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T15:00:00.000Z',
    });

    expect(dispatchRepository.markPostVerificationSkipped).toHaveBeenCalledWith(
      {
        dispatchId: 1001,
        status: 'SKIPPED_SUPPRESSED_CONTACT',
        reason: 'UNKNOWN_PERSON',
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-1',
        resultStatus: 'PROCESSED_SUPPRESSED_CONTACT',
      }),
    );
    expect(
      recipientPolicyRepository.clearUnknownPersonSuppression,
    ).toHaveBeenCalledWith({
      patientLegacyUserId: 80,
      phone: '573001234567',
    });
    expect(
      registerWhatsappPostBookingConsent.execute,
    ).toHaveBeenCalledWith({
      patientId: 80,
      phone: '573001234567',
      granted: true,
      consentTextSnapshot:
        'Hola JOSE PEREZ. Somos IPS SISM.\n\n' +
        'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir recordatorios de citas, encuestas de satisfaccion y notificaciones importantes sobre servicios de salud de este paciente.\n\n' +
        'Su salud en buenas manos.',
      source: 'REMINDER_PHONE_VERIFICATION_TEMPLATE',
      respondedAtIso: '2026-05-25T15:00:00.000Z',
    });
    expect(templateDeliveryService.send).not.toHaveBeenCalled();
  });

  it('marks inbound dedup as processed with invalid-phone status when reminder policy blocks the confirmed phone as invalid', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1002,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1002,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 502,
        patientLegacyUserId: 81,
        recipientPhoneRaw: '3001234568',
        recipientPhoneE164: '573001234568',
        appointmentStartsAtIso: '2099-02-01T12:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markPostVerificationPausedHold: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const recipientPolicyRepository = {
      resolveReminderContactSuppression: jest.fn().mockResolvedValue({
        kind: 'BLOCK_INVALID_PHONE',
      }),
      hasActiveSuppression: jest.fn().mockResolvedValue(true),
      upsertUnknownPersonSuppression: jest.fn(),
      clearUnknownPersonSuppression: jest.fn().mockResolvedValue(false),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository: {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
          createMinimalEligibleAppointment({
            legacyAgendaId: 502,
          }),
        ]),
      },
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository,
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService: { send: jest.fn() },
      registerWhatsappPostBookingConsent: {
        execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
      },
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-invalid-phone',
      fromPhone: '573001234568',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T15:00:00.000Z',
    });

    expect(dispatchRepository.markPostVerificationSkipped).toHaveBeenCalledWith(
      {
        dispatchId: 1002,
        status: 'SKIPPED_INVALID_PHONE',
        reason: 'INVALID_PHONE',
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-invalid-phone',
        resultStatus: 'PROCESSED_INVALID_PHONE',
      }),
    );
  });

  it('records consent with a fallback snapshot when the legacy appointment lookup fails', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1008,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1008,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 802,
        patientLegacyUserId: 83,
        recipientPhoneRaw: '3001110000',
        recipientPhoneE164: '573001110000',
        appointmentStartsAtIso: '2099-05-01T12:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationPausedHold: jest.fn().mockResolvedValue(true),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const registerWhatsappPostBookingConsent = {
      execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository: {
        findByLegacyAgendaIds: jest.fn().mockRejectedValue(new Error('db down')),
      },
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue('UPDATED'),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository: {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        upsertUnknownPersonSuppression: jest.fn(),
        clearUnknownPersonSuppression: jest.fn().mockResolvedValue(false),
      },
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService: {
        send: jest.fn(),
      },
      registerWhatsappPostBookingConsent,
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-lookup-failure',
      fromPhone: '573001110000',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T15:00:00.000Z',
    });

    expect(
      dispatchRepository.markPostVerificationPausedHold,
    ).toHaveBeenCalledWith({
      dispatchId: 1008,
      reason: 'appointment_lookup_failed_after_confirmation',
    });
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-lookup-failure',
        resultStatus: 'PROCESSED_APPOINTMENT_LOOKUP_FAILED',
      }),
    );
    expect(registerWhatsappPostBookingConsent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        consentTextSnapshot:
          'Hola Paciente. Somos IPS SISM.\n\n' +
          'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir recordatorios de citas, encuestas de satisfaccion y notificaciones importantes sobre servicios de salud de este paciente.\n\n' +
          'Su salud en buenas manos.',
      }),
    );
  });

  it('marks inbound dedup as processed when appointment is no longer assigned', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1002,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1002,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 601,
        patientLegacyUserId: 81,
        recipientPhoneRaw: '3007654321',
        recipientPhoneE164: '573007654321',
        appointmentStartsAtIso: '2099-03-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const eligibilityRepository = {
      findByLegacyAgendaIds: jest.fn().mockResolvedValue([
        createMinimalEligibleAppointment({
          legacyAgendaId: 601,
          legacyState: 'Cancelada',
        }),
      ]),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository,
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository: {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        upsertUnknownPersonSuppression: jest.fn(),
      },
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService: { send: jest.fn() },
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-2',
      fromPhone: '573007654321',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T16:00:00.000Z',
    });

    expect(dispatchRepository.markPostVerificationSkipped).toHaveBeenCalledWith(
      {
        dispatchId: 1002,
        status: 'SKIPPED_APPOINTMENT_CANCELLED',
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-2',
        resultStatus: 'PROCESSED_APPOINTMENT_CANCELLED',
      }),
    );
  });

  it('continues confirmation when legacy phone verification sync fails', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1009,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1009,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 701,
        patientLegacyUserId: 82,
        recipientPhoneRaw: '3005556677',
        recipientPhoneE164: '573005556677',
        appointmentStartsAtIso: '2099-04-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markPostVerificationSent: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const eligibilityRepository = {
      findByLegacyAgendaIds: jest.fn().mockResolvedValue([
        createMinimalEligibleAppointment({
          legacyAgendaId: 701,
          patientFirstName: 'MARIA',
          patientLastName: 'PEREZ',
          appointmentDateIso: '2099-04-01T00:00:00.000Z',
          appointmentTimeHhmm: '13:00',
          siteAddress: 'CALLE 15',
          doctorName: 'DR. JUAN MARTINEZ',
        }),
      ]),
    };

    const templateDeliveryService = {
      send: jest.fn().mockResolvedValue({ messageId: 'wamid-reminder-2000' }),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository,
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue('PATIENT_NOT_FOUND'),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository: {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        upsertUnknownPersonSuppression: jest.fn(),
        clearUnknownPersonSuppression: jest.fn().mockResolvedValue(false),
      },
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService,
      registerWhatsappPostBookingConsent: {
        execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
      },
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-4',
      fromPhone: '573005556677',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T17:00:00.000Z',
    });

    expect(templateDeliveryService.send).toHaveBeenCalledTimes(1);
    expect(dispatchRepository.markPostVerificationSent).toHaveBeenCalledWith({
      dispatchId: 1009,
      metaMessageId: 'wamid-reminder-2000',
      sentAtIso: '2026-05-25T17:00:00.000Z',
    });
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-4',
        resultStatus: 'PROCESSED_CONFIRMED',
      }),
    );
  });

  it('skips reminder when human handoff is active after confirmation', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1005,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1005,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 801,
        patientLegacyUserId: 84,
        conversationKey: 'whatsapp:1:573009991111',
        recipientPhoneRaw: '3009991111',
        recipientPhoneE164: '573009991111',
        appointmentStartsAtIso: '2099-05-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository: {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
          createMinimalEligibleAppointment({
            legacyAgendaId: 801,
            legacyState: 'Asignada',
          }),
        ]),
      },
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository: {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        isHumanHandoffActive: jest.fn().mockResolvedValue(true),
        upsertUnknownPersonSuppression: jest.fn(),
      },
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService: { send: jest.fn() },
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-5',
      fromPhone: '573009991111',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T19:00:00.000Z',
    });

    expect(dispatchRepository.markPostVerificationSkipped).toHaveBeenCalledWith(
      {
        dispatchId: 1005,
        status: 'SKIPPED_HANDOFF_ACTIVE',
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-5',
        resultStatus: 'PROCESSED_HANDOFF_ACTIVE',
      }),
    );
  });

  it('skips reminder when appointment opt-in is missing after confirmation', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1006,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1006,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 901,
        patientLegacyUserId: 85,
        conversationKey: 'whatsapp:1:573009991112',
        recipientPhoneRaw: '3009991112',
        recipientPhoneE164: '573009991112',
        appointmentStartsAtIso: '2099-06-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository: {
        findByLegacyAgendaIds: jest.fn().mockResolvedValue([
          createMinimalEligibleAppointment({
            legacyAgendaId: 901,
            legacyState: 'Asignada',
          }),
        ]),
      },
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository: {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(false),
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        upsertUnknownPersonSuppression: jest.fn(),
      },
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService: { send: jest.fn() },
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-6',
      fromPhone: '573009991112',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T19:10:00.000Z',
    });

    expect(dispatchRepository.markPostVerificationSkipped).toHaveBeenCalledWith(
      {
        dispatchId: 1006,
        status: 'SKIPPED_NO_OPT_IN',
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-6',
        resultStatus: 'PROCESSED_NO_OPT_IN',
      }),
    );
  });

  it('sends reminder after valid phone confirmation when appointment is still eligible', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1003,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1003,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 701,
        patientLegacyUserId: 82,
        recipientPhoneRaw: '3005556677',
        recipientPhoneE164: '573005556677',
        appointmentStartsAtIso: '2099-04-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markPostVerificationSent: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const eligibilityRepository = {
      findByLegacyAgendaIds: jest.fn().mockResolvedValue([
        createMinimalEligibleAppointment({
          legacyAgendaId: 701,
          patientFirstName: 'MARIA',
          patientLastName: 'PEREZ',
          appointmentDateIso: '2099-04-01T00:00:00.000Z',
          appointmentTimeHhmm: '13:00',
          siteAddress: 'CALLE 15',
          doctorName: 'DR. JUAN MARTINEZ',
        }),
      ]),
    };

    const templateDeliveryService = {
      send: jest.fn().mockResolvedValue({ messageId: 'wamid-reminder-1003' }),
    };
    const registerWhatsappPostBookingConsent = {
      execute: jest.fn().mockResolvedValue({ status: 'RECORDED' }),
    };
    const recipientPolicyRepository = {
      hasActiveSuppression: jest.fn().mockResolvedValue(false),
      hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
      isHumanHandoffActive: jest.fn().mockResolvedValue(false),
      upsertUnknownPersonSuppression: jest.fn(),
      clearUnknownPersonSuppression: jest.fn().mockResolvedValue(false),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository,
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository,
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService,
      registerWhatsappPostBookingConsent,
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-3',
      fromPhone: '573005556677',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T17:00:00.000Z',
    });

    expect(templateDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '573005556677',
        templateName: 'recordatorio_cita_24h',
        bodyTextParameters: [
          'MARIA PEREZ',
          'MEDICINA GENERAL',
          'PRESENCIAL',
          '2099-04-01',
          '13:00',
          'SANTA MARTA',
          'CALLE 15',
          'DR. JUAN MARTINEZ',
        ],
      }),
    );
    expect(dispatchRepository.markPostVerificationSent).toHaveBeenCalledWith({
      dispatchId: 1003,
      metaMessageId: 'wamid-reminder-1003',
      sentAtIso: '2026-05-25T17:00:00.000Z',
    });
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-3',
        resultStatus: 'PROCESSED_CONFIRMED',
      }),
    );
    expect(
      recipientPolicyRepository.clearUnknownPersonSuppression,
    ).toHaveBeenCalledWith({
      patientLegacyUserId: 82,
      phone: '573005556677',
    });
    expect(
      registerWhatsappPostBookingConsent.execute,
    ).toHaveBeenCalledWith({
      patientId: 82,
      phone: '573005556677',
      granted: true,
      consentTextSnapshot:
        'Hola MARIA PEREZ. Somos IPS SISM.\n\n' +
        'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir recordatorios de citas, encuestas de satisfaccion y notificaciones importantes sobre servicios de salud de este paciente.\n\n' +
        'Su salud en buenas manos.',
      source: 'REMINDER_PHONE_VERIFICATION_TEMPLATE',
      respondedAtIso: '2026-05-25T17:00:00.000Z',
    });
  });

  it('moves confirmation into paused hold when emergency pause is active', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1007,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getConfirmButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1007,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 801,
        patientLegacyUserId: 83,
        recipientPhoneRaw: '3007778899',
        recipientPhoneE164: '573007778899',
        appointmentStartsAtIso: '2099-04-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markPostVerificationPausedHold: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const eligibilityRepository = {
      findByLegacyAgendaIds: jest.fn().mockResolvedValue([
        createMinimalEligibleAppointment({
          legacyAgendaId: 801,
          patientFirstName: 'ANA',
          patientLastName: 'RUIZ',
          appointmentDateIso: '2099-04-01T00:00:00.000Z',
          appointmentTimeHhmm: '13:00',
          siteAddress: 'CALLE 15',
          doctorName: 'DR. JUAN MARTINEZ',
        }),
      ]),
    };

    const runtimeResolver = {
      isEmergencyPauseActive: jest.fn().mockResolvedValue(true),
      resolveEffectiveHotReloadableSettings: jest.fn().mockResolvedValue({
        sendMode: 'live' as const,
        sendRolloutPercent: 100,
        emergencyPauseEnabled: true,
        dispatchBatchSize: 50,
        eligibilityLimit: 500,
        lockTtlSeconds: 300,
        lockHeartbeatIntervalMs: 60_000,
        minConfirmationHours: 3,
      }),
    } as unknown as AppointmentReminderRuntimeSettingsResolverService;

    const templateDeliveryService = {
      send: jest.fn(),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository,
      patientContactRepository: {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      recipientPolicyRepository: {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        hasAppointmentNotificationsOptIn: jest.fn().mockResolvedValue(true),
        isHumanHandoffActive: jest.fn().mockResolvedValue(false),
        upsertUnknownPersonSuppression: jest.fn(),
      },
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService,
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
      runtimeResolver,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-7',
      fromPhone: '573007778899',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T17:00:00.000Z',
    });

    expect(dispatchRepository.markPostVerificationPausedHold).toHaveBeenCalledWith(
      {
        dispatchId: 1007,
        reason: 'emergency_pause_active',
      },
    );
    expect(templateDeliveryService.send).not.toHaveBeenCalled();
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-7',
        resultStatus: 'PROCESSED_PAUSED_HOLD',
      }),
    );
  });

  it('clears phone and creates suppression when patient rejects ownership', async () => {
    const tokenService = new AppointmentReminderButtonTokenService();
    const templateConfig = new AppointmentReminderTemplateConfigService();
    const token = tokenService.createToken({
      dispatchId: 1004,
      expiresAtIso: '2099-01-01T00:00:00.000Z',
    });
    const interactiveReplyId = `${templateConfig.getRejectButtonPayloadPrefix()}${token}`;

    const dispatchRepository = {
      recordInboundDedup: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({
        id: 1004,
        status: 'PHONE_VERIFICATION_PENDING',
        verificationTokenHash: tokenService.hashToken(token),
        legacyAgendaId: 702,
        patientLegacyUserId: 83,
        recipientPhoneRaw: '3008889999',
        recipientPhoneE164: '573008889999',
        appointmentStartsAtIso: '2099-05-01T18:00:00.000Z',
        templateName: 'recordatorio_cita_24h',
      }),
      markPostVerificationSkipped: jest.fn().mockResolvedValue(true),
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const patientContactRepository = {
      markPhoneVerified: jest.fn(),
      clearPhoneAndVerification: jest.fn().mockResolvedValue(undefined),
    };
    const recipientPolicyRepository = {
      hasActiveSuppression: jest.fn(),
      upsertUnknownPersonSuppression: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = createUseCase({
      dispatchRepository,
      eligibilityRepository: { findByLegacyAgendaIds: jest.fn() },
      patientContactRepository,
      recipientPolicyRepository,
      templateConfig,
      tokenService,
      configService: {
        getVerificationGraceHours: jest.fn().mockReturnValue(3),
      },
      templateDeliveryService: { send: jest.fn() },
      auditService: {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    });

    await useCase.execute({
      inboundMessageId: 'wamid-inbound-4',
      fromPhone: '573008889999',
      interactiveReplyId,
      receivedAtIso: '2026-05-25T18:00:00.000Z',
    });

    expect(
      patientContactRepository.clearPhoneAndVerification,
    ).toHaveBeenCalledWith({
      patientLegacyUserId: 83,
    });
    expect(
      recipientPolicyRepository.upsertUnknownPersonSuppression,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        patientLegacyUserId: 83,
        phone: '573008889999',
      }),
    );
    expect(dispatchRepository.markPostVerificationSkipped).toHaveBeenCalledWith(
      {
        dispatchId: 1004,
        status: 'SKIPPED_SUPPRESSED_CONTACT',
        reason: 'UNKNOWN_PERSON',
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-4',
        resultStatus: 'PROCESSED_REJECTED',
      }),
    );
  });
});
