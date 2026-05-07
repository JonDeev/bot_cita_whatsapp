import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { ResolveEligibleSpecialtiesByPatientUseCase } from '../../../patients/application/use-cases/resolve-eligible-specialties-by-patient.use-case';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
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
        execute: jest.fn().mockResolvedValue({
          isEligible: true,
          specialties: [{ code: '890201', name: 'MEDICINA GENERAL', cups: '890201' }],
        }),
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      new AssignedAppointmentListFactory(),
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
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      new AssignedAppointmentListFactory(),
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
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      new AssignedAppointmentListFactory(),
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
      } as unknown as ResolveEligibleSpecialtiesByPatientUseCase,
      new AssignedAppointmentListFactory(),
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
});
