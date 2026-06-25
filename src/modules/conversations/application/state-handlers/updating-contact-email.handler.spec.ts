import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { MarkPatientEmailVerifiedUseCase } from '../../../patients/application/use-cases/mark-patient-email-verified.use-case';
import { UpdatePatientContactDetailsUseCase } from '../../../patients/application/use-cases/update-patient-contact-details.use-case';
import { ContactUpdateCompletionService } from '../services/contact-update-completion.service';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import { PrimaryFlowContinuationResolverService } from '../services/primary-flow-continuation-resolver.service';
import { UpdatingContactEmailHandler } from './updating-contact-email.handler';

describe('UpdatingContactEmailHandler', () => {
  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'UPDATING_CONTACT_EMAIL',
    status: 'BOT_ACTIVE',
    context: {
      flowIntent: 'UPDATE_CONTACT',
      patientValidation: {
        failedAttempts: 0,
        patientId: 10,
      },
      contactVerification: {
        fullName: 'DANIEL CASTANO',
        primaryPhone: '3001234567',
        primaryEmail: 'daniel@example.com',
        requiresPhoneUpdate: false,
        requiresEmailUpdate: false,
        selectedUpdateMode: 'EMAIL',
        completedForCurrentFlow: false,
        invalidPhoneAttempts: 0,
        invalidEmailAttempts: 0,
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  } as const;

  function buildHandler(
    updatePatientContactDetails: UpdatePatientContactDetailsUseCase,
    markPatientEmailVerified: MarkPatientEmailVerifiedUseCase,
    contactUpdateCompletionService: ContactUpdateCompletionService,
  ): UpdatingContactEmailHandler {
    return new UpdatingContactEmailHandler(
      new PatientContactInputValidatorService(),
      markPatientEmailVerified,
      updatePatientContactDetails,
      new PatientContactUpdateOptionsListFactory(),
      new PatientContactUpdateSuccessMessageFactory(),
      contactUpdateCompletionService,
      new PrimaryFlowContinuationResolverService(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('closes the conversation after updating the email in UPDATE_CONTACT flow', async () => {
    const contactUpdateCompletionService = {
      buildResult: jest.fn(),
    } as unknown as ContactUpdateCompletionService;

    const handler = buildHandler(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'UPDATED',
          mode: 'EMAIL',
          phoneMasked: null,
          emailMasked: 'n***@example.com',
        }),
      } as unknown as UpdatePatientContactDetailsUseCase,
      {
        execute: jest.fn(),
      } as unknown as MarkPatientEmailVerifiedUseCase,
      contactUpdateCompletionService,
    );

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'text',
      textBody: 'nuevo@example.com',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
    });
  });

  it('verifies the same email without blocking the UPDATE_CONTACT flow', async () => {
    const contactUpdateCompletionService = {
      buildResult: jest.fn(),
    } as unknown as ContactUpdateCompletionService;

    const markPatientEmailVerified = {
      execute: jest.fn().mockResolvedValue({
        status: 'UPDATED',
        emailMasked: 'd***@example.com',
      }),
    } as unknown as MarkPatientEmailVerifiedUseCase;

    const updatePatientContactDetails = {
      execute: jest.fn(),
    } as unknown as UpdatePatientContactDetailsUseCase;

    const handler = buildHandler(
      updatePatientContactDetails,
      markPatientEmailVerified,
      contactUpdateCompletionService,
    );

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-5',
      from: '573001112233',
      timestamp: '1711111115',
      messageType: 'text',
      textBody: 'daniel@example.com',
      phoneNumberId: '123',
    });

    expect(markPatientEmailVerified.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'daniel@example.com',
      }),
    );
    expect(updatePatientContactDetails.execute).not.toHaveBeenCalled();
    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
  });

  it('returns to PATIENT_VALIDATED and continues the primary flow in live mode with the same email', async () => {
    const contactUpdateCompletionService = {
      buildResult: jest.fn(),
    } as unknown as ContactUpdateCompletionService;

    const markPatientEmailVerified = {
      execute: jest.fn().mockResolvedValue({
        status: 'UPDATED',
        emailMasked: 'd***@example.com',
      }),
    } as unknown as MarkPatientEmailVerifiedUseCase;

    const updatePatientContactDetails = {
      execute: jest.fn(),
    } as unknown as UpdatePatientContactDetailsUseCase;

    const handler = buildHandler(
      updatePatientContactDetails,
      markPatientEmailVerified,
      contactUpdateCompletionService,
    );

    const result = await handler.handle(
      {
        ...baseSession,
        context: {
          ...baseSession.context,
          flowIntent: 'REQUEST_APPOINTMENT',
          contactVerification: {
            ...baseSession.context.contactVerification,
            selectedUpdateMode: 'EMAIL',
          },
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-3',
        from: '573001112233',
        timestamp: '1711111113',
        messageType: 'text',
        textBody: 'daniel@example.com',
        phoneNumberId: '123',
      },
    );

    expect(markPatientEmailVerified.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'daniel@example.com',
      }),
    );
    expect(updatePatientContactDetails.execute).not.toHaveBeenCalled();
    expect(result.nextState).toBe('PATIENT_VALIDATED');
    expect(result.continueFlow).toBe(true);
  });

  it('delegates to the completion service when finishing BOTH mode with the same email', async () => {
    const contactUpdateCompletionService = {
      buildResult: jest.fn().mockResolvedValue({
        nextState: 'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
        nextContext: {
          flowIntent: 'REQUEST_APPOINTMENT',
          patientValidation: {
            failedAttempts: 0,
            patientId: 10,
          },
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            selectedUpdateMode: 'BOTH',
            verifiedPhone: '3014445566',
            completedForCurrentFlow: true,
            invalidPhoneAttempts: 0,
            invalidEmailAttempts: 0,
          },
        },
        outboundMessages: [
          {
            type: 'text',
            body: 'Tus datos de contacto quedaron confirmados y actualizados correctamente.',
          },
          { type: 'interactive_buttons', body: 'Autorizas a IPS SISM...' },
        ],
      }),
    } as unknown as ContactUpdateCompletionService;

    const handler = buildHandler(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'UPDATED',
          mode: 'PHONE',
          phoneMasked: '******66',
          emailMasked: null,
        }),
      } as unknown as UpdatePatientContactDetailsUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'UPDATED',
          emailMasked: 'd***@example.com',
        }),
      } as unknown as MarkPatientEmailVerifiedUseCase,
      contactUpdateCompletionService,
    );

    const result = await handler.handle(
      {
        ...baseSession,
        context: {
          ...baseSession.context,
          contactVerification: {
            ...baseSession.context.contactVerification,
            selectedUpdateMode: 'BOTH',
            verifiedPhone: '3014445566',
          },
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'text',
        textBody: 'daniel@example.com',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe(
      'REQUESTING_WHATSAPP_APPOINTMENT_NOTIFICATIONS_OPT_IN',
    );
    expect(markPatientEmailVerified.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'daniel@example.com',
      }),
    );
    expect(updatePatientContactDetails.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'PHONE',
        newPhone: '3014445566',
      }),
    );
    expect(contactUpdateCompletionService.buildResult).toHaveBeenCalledWith(
      expect.objectContaining({
        verifiedPhone: '3014445566',
      }),
    );
  });
});
