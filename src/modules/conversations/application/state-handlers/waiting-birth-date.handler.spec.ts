import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientIdentityInputNormalizerService } from '../../../patients/application/services/patient-identity-input-normalizer.service';
import { ValidatePatientByDocumentAndBirthDateUseCase } from '../../../patients/application/use-cases/validate-patient-by-document-and-birth-date.use-case';
import { WaitingBirthDateHandler } from './waiting-birth-date.handler';

describe('WaitingBirthDateHandler', () => {
  it('moves to PATIENT_VALIDATED when identity is valid', async () => {
    const handler = new WaitingBirthDateHandler(
      new PatientIdentityInputNormalizerService(),
      {
        execute: jest.fn().mockResolvedValue({
          isValid: true,
          patientId: 10,
          epsCode: 'EPS042',
          userType: '01',
          sex: 'F',
        }),
      } as unknown as ValidatePatientByDocumentAndBirthDateUseCase,
      {
        record: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
    );

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'WAITING_BIRTH_DATE',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            documentNumber: '1234567',
            documentNumberMasked: '***4567',
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'text',
        textBody: '05-11-1990',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('PATIENT_VALIDATED');
  });
});
