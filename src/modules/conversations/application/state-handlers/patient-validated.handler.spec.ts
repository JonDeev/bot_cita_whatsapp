import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import { PatientValidatedHandler } from './patient-validated.handler';

describe('PatientValidatedHandler', () => {
  it('moves to SELECTING_SPECIALTY with interactive list when specialties are available', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn().mockResolvedValue({
          isEligible: true,
          specialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
        }),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      new SpecialtyListFactory(),
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
        state: 'PATIENT_VALIDATED',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            documentNumber: '1234567',
            documentNumberMasked: '***4567',
            patientId: 10,
            epsCode: 'EPS042',
            userType: '01',
            sex: 'M',
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-3',
        from: '573001112233',
        timestamp: '1711111112',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_SPECIALTY');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Seleccione la especialidad que desea agendar.',
    });
  });
});
