import { AuditService } from '../../../audit/application/services/audit.service';
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
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import { HandleAppointmentReminderVerificationReplyUseCase } from './handle-appointment-reminder-verification-reply.use-case';

type DispatchRepositoryMock = Pick<
  AppointmentReminderDispatchRepository,
  | 'recordInboundDedup'
  | 'findById'
  | 'markPostVerificationSkipped'
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
  'hasActiveSuppression' | 'upsertUnknownPersonSuppression'
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
>;

type TemplateDeliveryServiceMock = Pick<
  AppointmentReminderTemplateDeliveryService,
  'send'
>;

function createUseCase(input: {
  dispatchRepository: DispatchRepositoryMock;
  eligibilityRepository: EligibilityRepositoryMock;
  patientContactRepository: PatientContactRepositoryMock;
  recipientPolicyRepository: RecipientPolicyRepositoryMock;
  configService: DispatchConfigMock;
  templateDeliveryService: TemplateDeliveryServiceMock;
  auditService: AuditService;
  tokenService: AppointmentReminderButtonTokenService;
  templateConfig: AppointmentReminderTemplateConfigService;
}): HandleAppointmentReminderVerificationReplyUseCase {
  return new HandleAppointmentReminderVerificationReplyUseCase(
    input.dispatchRepository as AppointmentReminderDispatchRepository,
    input.eligibilityRepository as AppointmentReminderEligibilityRepository,
    input.patientContactRepository,
    {
      hasActiveSuppression:
        input.recipientPolicyRepository.hasActiveSuppression,
      upsertUnknownPersonSuppression:
        input.recipientPolicyRepository.upsertUnknownPersonSuppression,
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
    input.configService as AppointmentReminderDispatchConfigService,
    new AppointmentReminderPhoneNormalizerService(),
    input.templateDeliveryService as AppointmentReminderTemplateDeliveryService,
    input.auditService,
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
      markInboundDedupProcessed: jest.fn().mockResolvedValue(undefined),
    };

    const recipientPolicyRepository = {
      hasActiveSuppression: jest.fn().mockResolvedValue(true),
      upsertUnknownPersonSuppression: jest.fn(),
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
      templateDeliveryService,
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
      },
    );
    expect(dispatchRepository.markInboundDedupProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-inbound-1',
        resultStatus: 'PROCESSED_SUPPRESSED_CONTACT',
      }),
    );
    expect(templateDeliveryService.send).not.toHaveBeenCalled();
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
