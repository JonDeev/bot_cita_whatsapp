import { AuditService } from '../../../audit/application/services/audit.service';
import { AppointmentReminderButtonTokenService } from '../services/appointment-reminder-button-token.service';
import { AppointmentReminderPhoneNormalizerService } from '../services/appointment-reminder-phone-normalizer.service';
import { AppointmentReminderTemplateConfigService } from '../services/appointment-reminder-template-config.service';
import { AppointmentReminderWindowService } from '../services/appointment-reminder-window.service';
import { HandleAppointmentReminderVerificationReplyUseCase } from './handle-appointment-reminder-verification-reply.use-case';

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

    const sendWhatsappTemplateMessage = {
      execute: jest.fn(),
    };

    const useCase = new HandleAppointmentReminderVerificationReplyUseCase(
      dispatchRepository as any,
      { findByLegacyAgendaIds: jest.fn() } as any,
      patientContactRepository,
      recipientPolicyRepository as any,
      templateConfig,
      tokenService,
      new AppointmentReminderWindowService(),
      { getVerificationGraceHours: jest.fn().mockReturnValue(3) } as any,
      new AppointmentReminderPhoneNormalizerService(),
      sendWhatsappTemplateMessage as any,
      auditService,
    );

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
    expect(sendWhatsappTemplateMessage.execute).not.toHaveBeenCalled();
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
        {
          legacyAgendaId: 601,
          legacyState: 'Cancelada',
        },
      ]),
    };

    const useCase = new HandleAppointmentReminderVerificationReplyUseCase(
      dispatchRepository as any,
      eligibilityRepository as any,
      {
        markPhoneVerified: jest.fn().mockResolvedValue(undefined),
        clearPhoneAndVerification: jest.fn(),
      },
      {
        hasActiveSuppression: jest.fn().mockResolvedValue(false),
        upsertUnknownPersonSuppression: jest.fn(),
      } as any,
      templateConfig,
      tokenService,
      new AppointmentReminderWindowService(),
      { getVerificationGraceHours: jest.fn().mockReturnValue(3) } as any,
      new AppointmentReminderPhoneNormalizerService(),
      { execute: jest.fn() } as any,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

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
});
