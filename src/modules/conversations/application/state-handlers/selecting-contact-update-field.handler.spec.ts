import { AuditService } from '../../../audit/application/services/audit.service';
import { PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS } from '../services/patient-contact-update-field-option-id';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { SelectingContactUpdateFieldHandler } from './selecting-contact-update-field.handler';

describe('SelectingContactUpdateFieldHandler', () => {
  function buildHandler(): SelectingContactUpdateFieldHandler {
    return new SelectingContactUpdateFieldHandler(
      new PatientContactUpdateOptionsListFactory(),
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );
  }

  const baseSession = {
    conversationKey: 'whatsapp:123:573001112233',
    channel: 'whatsapp',
    participantPhone: '573001112233',
    phoneNumberId: '123',
    state: 'SELECTING_CONTACT_UPDATE_FIELD',
    status: 'BOT_ACTIVE',
    context: {
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
      patientValidation: {
        failedAttempts: 0,
        patientId: 10,
      },
    },
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  } as const;

  it('moves to phone update state when phone option is selected', async () => {
    const handler = buildHandler();

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'interactive',
      interactiveReplyId: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.PHONE,
      interactiveReplyTitle: 'Telefono',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('UPDATING_CONTACT_PHONE');
    expect(result.nextContext?.contactVerification?.selectedUpdateMode).toBe(
      'PHONE',
    );
  });
});
