import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { PatientContactInputValidatorService } from '../../../patients/application/services/patient-contact-input-validator.service';
import { ResolveAssignedDispensaryByPatientUseCase } from '../../../patients/application/use-cases/resolve-assigned-dispensary-by-patient.use-case';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { ResolvePatientContactProfileUseCase } from '../../../patients/application/use-cases/resolve-patient-contact-profile.use-case';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { AssignedDispensaryMessageFactory } from '../services/assigned-dispensary-message.factory';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
import { PatientContactRevalidationPolicyService } from '../services/patient-contact-revalidation-policy.service';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import { PatientValidatedHandler } from './patient-validated.handler';

describe('PatientValidatedHandler revalidation gate', () => {
  function buildAuditService(): AuditService {
    return {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
  }

  function buildHandler(profileResult: Record<string, unknown>) {
    return new PatientValidatedHandler(
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue(profileResult),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
      new PatientContactRevalidationPolicyService(
        new PatientContactInputValidatorService(),
      ),
    );
  }

  it('prompts contact confirmation without revalidation when the phone is verified and matches the session', async () => {
    const handler = buildHandler({
      status: 'FOUND',
      patientId: 10,
      fullName: 'DANIEL CASTANO',
      primaryPhone: '3001234567',
      primaryEmail: 'daniel@example.com',
      phoneVerifiedAtIso: '2026-06-10T10:00:00.000Z',
      isPrimaryPhoneValid: true,
      isPrimaryEmailValid: true,
    });

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
            patientId: 10,
          },
        },
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-1',
        from: '573001112233',
        timestamp: '1711111111',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('CONFIRMING_PATIENT_CONTACT');
    expect(result.nextContext?.contactVerification).toMatchObject({
      requiresPhoneUpdate: false,
      requiresPhoneRevalidation: false,
      phoneRevalidationReasons: [],
    });
  });

  it('prompts contact confirmation with revalidation reasons when the phone is not verified and the session phone mismatches', async () => {
    const handler = buildHandler({
      status: 'FOUND',
      patientId: 10,
      fullName: 'DANIEL CASTANO',
      primaryPhone: '3001234567',
      primaryEmail: 'daniel@example.com',
      phoneVerifiedAtIso: null,
      isPrimaryPhoneValid: true,
      isPrimaryEmailValid: true,
    });

    const result = await handler.handle(
      {
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573009998888',
        phoneNumberId: '123',
        state: 'PATIENT_VALIDATED',
        status: 'BOT_ACTIVE',
        context: {
          patientValidation: {
            failedAttempts: 0,
            patientId: 10,
          },
        },
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-2',
        from: '573009998888',
        timestamp: '1711111112',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('CONFIRMING_PATIENT_CONTACT');
    expect(result.nextContext?.contactVerification).toMatchObject({
      requiresPhoneRevalidation: true,
      phoneRevalidationReasons: [
        'PHONE_NOT_VERIFIED',
        'SESSION_PHONE_MISMATCH',
      ],
    });
  });
});
