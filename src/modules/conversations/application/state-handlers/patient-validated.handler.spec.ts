import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolveAssignedDispensaryByPatientUseCase } from '../../../patients/application/use-cases/resolve-assigned-dispensary-by-patient.use-case';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { ResolvePatientContactProfileUseCase } from '../../../patients/application/use-cases/resolve-patient-contact-profile.use-case';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { AssignedDispensaryMessageFactory } from '../services/assigned-dispensary-message.factory';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import { PatientValidatedHandler } from './patient-validated.handler';

describe('PatientValidatedHandler', () => {
  function buildAuditService(): AuditService {
    return {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
  }

  it('moves to SELECTING_SPECIALTY with interactive list when specialties are available', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          isEligible: true,
          specialties: [
            { code: '890201', name: 'MEDICINA GENERAL', cups: '890201' },
          ],
        }),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientId: 10,
          fullName: 'DANIEL CASTANO',
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          isPrimaryPhoneValid: true,
          isPrimaryEmailValid: true,
        }),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
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
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
            invalidPhoneAttempts: 0,
            invalidEmailAttempts: 0,
          },
          patientValidation: {
            failedAttempts: 0,
            documentNumber: '1234567',
            documentNumberMasked: '***4567',
            patientId: 10,
            epsCode: 'EPS042',
            userType: '01',
            sex: 'F',
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

  it('moves to SELECTING_ASSIGNED_APPOINTMENT when flow intent is cancel or reschedule', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientFullName: 'DANIEL CASTANO',
          appointments: [
            {
              slotRef: '101',
              specialtyName: 'MEDICINA GENERAL',
              professionalName: 'MEDICO',
              siteName: 'Sede Central',
              siteAddress: 'Calle 1 # 2-3',
              appointmentDateIso: '2026-05-30',
              appointmentTimeHHmm: '11:40',
              appointmentDisplayTime: '11:40 AM',
            },
          ],
          hasMore: false,
          currentOffset: 0,
        }),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientId: 10,
          fullName: 'DANIEL CASTANO',
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          isPrimaryPhoneValid: true,
          isPrimaryEmailValid: true,
        }),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
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
          flowIntent: 'CANCEL_OR_RESCHEDULE',
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
            invalidPhoneAttempts: 0,
            invalidEmailAttempts: 0,
          },
          patientValidation: {
            failedAttempts: 0,
            documentNumber: '1234567',
            documentNumberMasked: '***4567',
            patientId: 10,
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-4',
        from: '573001112233',
        timestamp: '1711111113',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_ASSIGNED_APPOINTMENT');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      buttonText: 'Ver citas',
    });
  });

  it('moves to SELECTING_ASSIGNED_APPOINTMENT with consultation copy when flow intent is check appointments', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientFullName: 'DANIEL CASTANO',
          appointments: [
            {
              slotRef: '101',
              specialtyName: 'MEDICINA GENERAL',
              professionalName: 'MEDICO',
              siteName: 'Sede Central',
              siteAddress: 'Calle 1 # 2-3',
              appointmentDateIso: '2026-05-30',
              appointmentTimeHHmm: '11:40',
              appointmentDisplayTime: '11:40 AM',
            },
          ],
          hasMore: false,
          currentOffset: 0,
        }),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientId: 10,
          fullName: 'DANIEL CASTANO',
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          isPrimaryPhoneValid: true,
          isPrimaryEmailValid: true,
        }),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
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
          flowIntent: 'CHECK_APPOINTMENTS',
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
            invalidPhoneAttempts: 0,
            invalidEmailAttempts: 0,
          },
          patientValidation: {
            failedAttempts: 0,
            documentNumber: '1234567',
            documentNumberMasked: '***4567',
            patientId: 10,
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-5',
        from: '573001112233',
        timestamp: '1711111114',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_ASSIGNED_APPOINTMENT');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
      body: 'Hola DANIEL CASTANO Estas son tus citas agendadas',
    });
  });

  it('returns no appointments buttons when flow intent is check appointments and no assigned appointments exist', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'EMPTY',
          patientFullName: 'DANIEL CASTANO',
          currentOffset: 0,
        }),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientId: 10,
          fullName: 'DANIEL CASTANO',
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          isPrimaryPhoneValid: true,
          isPrimaryEmailValid: true,
        }),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
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
          flowIntent: 'CHECK_APPOINTMENTS',
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
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
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-6',
        from: '573001112233',
        timestamp: '1711111115',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('SELECTING_ASSIGNED_APPOINTMENT');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      body: 'Hola DANIEL CASTANO No tienes citas agendadas',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });

  it('returns assigned dispensary buttons when flow intent is check dispensary', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientFullName: 'DANIEL CASTANO',
          dispensary: {
            id: 4,
            name: 'DISPENSARIO SUPLYMEDICAL',
            address: "CLL 29 CRA 13 FRENTE A MCDONALD'S",
            city: 'SANTA MARTA',
            schedule: 'Lunes a viernes 8:00 - 12:00 y 2:00 a 6:00',
          },
        }),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientId: 10,
          fullName: 'DANIEL CASTANO',
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          isPrimaryPhoneValid: true,
          isPrimaryEmailValid: true,
        }),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
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
          flowIntent: 'CHECK_DISPENSARY',
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
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
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-7',
        from: '573001112233',
        timestamp: '1711111116',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    const outboundMessage = result.outboundMessages[0];
    expect(outboundMessage).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });

    if (outboundMessage.type !== 'interactive_buttons') {
      throw new Error('Expected interactive buttons outbound message');
    }

    expect(outboundMessage.body).toContain('DISPENSARIO SUPLYMEDICAL');
  });

  it('returns not-assigned dispensary copy when flow intent is check dispensary and no assignment exists', async () => {
    const handler = new PatientValidatedHandler(
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'NOT_ASSIGNED',
          patientFullName: 'DANIEL CASTANO',
        }),
      } as unknown as ResolveAssignedDispensaryByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      {
        execute: jest.fn().mockResolvedValue({
          status: 'FOUND',
          patientId: 10,
          fullName: 'DANIEL CASTANO',
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          isPrimaryPhoneValid: true,
          isPrimaryEmailValid: true,
        }),
      } as unknown as ResolvePatientContactProfileUseCase,
      new AssignedAppointmentListFactory(),
      new AssignedDispensaryMessageFactory(),
      new PatientContactConfirmationMessageFactory(),
      new SpecialtyListFactory(),
      buildAuditService(),
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
          flowIntent: 'CHECK_DISPENSARY',
          contactVerification: {
            fullName: 'DANIEL CASTANO',
            primaryPhone: '3001234567',
            primaryEmail: 'daniel@example.com',
            requiresPhoneUpdate: false,
            requiresEmailUpdate: false,
            completedForCurrentFlow: true,
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
      },
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-8',
        from: '573001112233',
        timestamp: '1711111117',
        messageType: 'text',
        textBody: 'ok',
        phoneNumberId: '123',
      },
    );

    expect(result.nextState).toBe('MAIN_MENU');
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      body: 'hola DANIEL CASTANO, no tenemos informacion de tu dispensario asignado aun comunicate con tu EPS',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });
});
