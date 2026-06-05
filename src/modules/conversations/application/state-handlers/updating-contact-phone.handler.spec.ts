import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { UpdatePatientContactDetailsUseCase } from '../../../patients/application/use-cases/update-patient-contact-details.use-case';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import { UpdatingContactPhoneHandler } from './updating-contact-phone.handler';

describe('UpdatingContactPhoneHandler', () => {
  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'UPDATING_CONTACT_PHONE',
    status: 'BOT_ACTIVE',
    context: {
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
        selectedUpdateMode: 'PHONE',
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
  ): UpdatingContactPhoneHandler {
    return new UpdatingContactPhoneHandler(
      new PatientContactInputValidatorService(),
      updatePatientContactDetails,
      new PatientContactUpdateOptionsListFactory(),
      new PatientContactUpdateSuccessMessageFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('persists phone update and returns to PATIENT_VALIDATED', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        status: 'UPDATED',
        mode: 'PHONE',
        phoneMasked: '******66',
        emailMasked: null,
      }),
    } as unknown as UpdatePatientContactDetailsUseCase);

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'text',
      textBody: '3014445566',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('PATIENT_VALIDATED');
    expect(
      result.nextContext?.contactVerification?.completedForCurrentFlow,
    ).toBe(true);
  });

  it('closes the conversation after updating the phone in UPDATE_CONTACT flow', async () => {
    const handler = buildHandler({
      execute: jest.fn().mockResolvedValue({
        status: 'UPDATED',
        mode: 'PHONE',
        phoneMasked: '******66',
        emailMasked: null,
      }),
    } as unknown as UpdatePatientContactDetailsUseCase);

    const result = await handler.handle(
      {
        ...baseSession,
        context: {
          ...baseSession.context,
          flowIntent: 'UPDATE_CONTACT',
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-4',
        from: '573001112233',
        timestamp: '1711111114',
        messageType: 'text',
        textBody: '3014445566',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.nextStatus).toBe('CLOSED');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'text',
    });
  });

  it('advances without error when the patient repeats the same valid phone', async () => {
    const execute = jest.fn();
    const handler = buildHandler({
      execute,
    } as unknown as UpdatePatientContactDetailsUseCase);

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-2',
      from: '573001112233',
      timestamp: '1711111112',
      messageType: 'text',
      textBody: '3001234567',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('PATIENT_VALIDATED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps the flow moving to email update when phone is unchanged in BOTH mode', async () => {
    const handler = buildHandler({
      execute: jest.fn(),
    } as unknown as UpdatePatientContactDetailsUseCase);

    const result = await handler.handle(
      {
        ...baseSession,
        context: {
          ...baseSession.context,
          contactVerification: {
            ...baseSession.context.contactVerification,
            selectedUpdateMode: 'BOTH',
          },
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-3',
        from: '573001112233',
        timestamp: '1711111113',
        messageType: 'text',
        textBody: '3001234567',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('UPDATING_CONTACT_EMAIL');
    expect(result.nextContext?.contactVerification?.selectedUpdateMode).toBe(
      'EMAIL',
    );
    expect(
      result.nextContext?.contactVerification?.pendingPhone,
    ).toBeUndefined();
  });
});
