import { PatientIdentityInputNormalizerService } from '../../../patients/application/services/patient-identity-input-normalizer.service';
import { WaitingDocumentHandler } from './waiting-document.handler';

describe('WaitingDocumentHandler', () => {
  it('moves to birth date state when document is valid', async () => {
    const handler = new WaitingDocumentHandler(
      new PatientIdentityInputNormalizerService(),
    );

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'WAITING_DOCUMENT',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-1',
        from: '573001112233',
        timestamp: '1711111111',
        messageType: 'text',
        textBody: '1.234.567',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('WAITING_BIRTH_DATE');
    expect(result.nextContext?.patientValidation?.documentNumber).toBe(
      '1234567',
    );
  });
});
