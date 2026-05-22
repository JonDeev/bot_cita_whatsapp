import { AuditService } from '../../../audit/application/services/audit.service';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import { PATIENT_CONTACT_CONFIRMATION_OPTION_IDS } from '../services/patient-contact-confirmation-option-id';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { PatientContactUpdateSuccessMessageFactory } from '../services/patient-contact-update-success-message.factory';
import { ConfirmingPatientContactHandler } from './confirming-patient-contact.handler';

describe('ConfirmingPatientContactHandler', () => {
  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'CONFIRMING_PATIENT_CONTACT',
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
        completedForCurrentFlow: false,
        invalidPhoneAttempts: 0,
        invalidEmailAttempts: 0,
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  } as const;

  function buildHandler(): ConfirmingPatientContactHandler {
    return new ConfirmingPatientContactHandler(
      new PatientContactConfirmationMessageFactory(),
      new PatientContactUpdateOptionsListFactory(),
      new PatientContactUpdateSuccessMessageFactory(),
      new MainMenuListFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  it('marks verification as completed when contact data is valid and user chooses continue', async () => {
    const handler = buildHandler();

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'interactive',
      interactiveReplyId: PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.CONTINUE,
      interactiveReplyTitle: 'Continuar',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('PATIENT_VALIDATED');
    expect(
      result.nextContext?.contactVerification?.completedForCurrentFlow,
    ).toBe(true);
  });

  it('redirects to update options when patient must correct contact data', async () => {
    const handler = buildHandler();

    const result = await handler.handle(
      {
        ...baseSession,
        context: {
          ...baseSession.context,
          contactVerification: {
            ...baseSession.context.contactVerification,
            requiresPhoneUpdate: true,
          },
        },
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'interactive',
        interactiveReplyId: PATIENT_CONTACT_CONFIRMATION_OPTION_IDS.CONTINUE,
        interactiveReplyTitle: 'Continuar',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_CONTACT_UPDATE_FIELD');
    expect(result.outboundMessages[1]).toMatchObject({
      type: 'interactive_list',
    });
  });
});
