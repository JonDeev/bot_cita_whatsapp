import { AuditService } from '../../../audit/application/services/audit.service';
import { PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS } from '../services/patient-contact-update-field-option-id';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { SelectingContactUpdateFieldHandler } from './selecting-contact-update-field.handler';

describe('SelectingContactUpdateFieldHandler', () => {
  const LEGACY_EMAIL_REPLY_ID = 'patient_contact_update_field:email';

  function extractRowIds(message: unknown): string[] {
    if (
      !message ||
      typeof message !== 'object' ||
      !('sections' in message) ||
      !Array.isArray((message as { sections?: unknown[] }).sections)
    ) {
      return [];
    }

    return ((message as { sections: Array<{ rows?: Array<{ id: string }> }> })
      .sections ?? [])
      .flatMap((section) => section.rows ?? [])
      .map((row) => row.id);
  }

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

  it('moves to phone update state when both option is selected', async () => {
    const handler = buildHandler();

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-2',
      from: '573001112233',
      timestamp: '1711111112',
      messageType: 'interactive',
      interactiveReplyId: PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BOTH,
      interactiveReplyTitle: 'Telefono y correo',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('UPDATING_CONTACT_PHONE');
    expect(result.nextContext?.contactVerification?.selectedUpdateMode).toBe(
      'BOTH',
    );
  });

  it('falls back to the current options list when receiving a legacy email reply id', async () => {
    const handler = buildHandler();

    const result = await handler.handle(baseSession, {
      kind: 'incoming_message_received',
      messageId: 'wamid-legacy-email',
      from: '573001112233',
      timestamp: '1711111113',
      messageType: 'interactive',
      interactiveReplyId: LEGACY_EMAIL_REPLY_ID,
      interactiveReplyTitle: 'Correo',
      phoneNumberId: '123',
    });

    expect(result.nextState).toBe('SELECTING_CONTACT_UPDATE_FIELD');
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
    });
    expect(extractRowIds(result.outboundMessages[0])).toEqual([
      PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.PHONE,
      PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BOTH,
      PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.BACK,
      PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.MAIN_MENU,
      PATIENT_CONTACT_UPDATE_FIELD_OPTION_IDS.FINISH,
    ]);
  });
});
