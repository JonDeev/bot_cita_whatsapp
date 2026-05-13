import { ListFutureAssignedAppointmentsByPatientUseCase } from '../../../appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case';
import { RescheduleAssignedAppointmentByPatientUseCase } from '../../../appointments/application/use-cases/reschedule-assigned-appointment-by-patient.use-case';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AssignedAppointmentListFactory } from './assigned-appointment-list.factory';
import { AppointmentAvailabilityMessageFactory } from './appointment-availability-message.factory';
import { AppointmentRescheduleConfirmationMessageFactory } from './appointment-reschedule-confirmation-message.factory';
import { AppointmentReschedulingTimeSelectionService } from './appointment-rescheduling-time-selection.service';

describe('AppointmentReschedulingTimeSelectionService', () => {
  function buildSession() {
    return {
      conversationKey: 'whatsapp:123:573001112233',
      channel: 'whatsapp',
      participantPhone: '573001112233',
      phoneNumberId: '123',
      state: 'SELECTING_APPOINTMENT_TIME',
      status: 'BOT_ACTIVE',
      context: {
        patientValidation: {
          failedAttempts: 0,
          patientId: 98,
        },
        appointmentReschedule: {
          originalSlotRef: '101',
          originalSpecialtyName: 'MEDICINA GENERAL',
          originalSpecialtyCups: '890201',
          originalAppointmentDateIso: '2026-05-20',
          originalAppointmentTimeHHmm: '11:40',
        },
        specialtySelection: {
          offeredSpecialties: [
            { code: '890201', name: 'MEDICINA GENERAL', cups: '890201' },
          ],
          selectedSpecialty: {
            code: '890201',
            name: 'MEDICINA GENERAL',
            cups: '890201',
          },
        },
        appointmentDateSelection: {
          scope: 'SPECIALTY',
          specialtyOfferedDates: [
            { isoDate: '2026-05-30', displayDate: '30/05/2026' },
          ],
          offeredDates: [{ isoDate: '2026-05-30', displayDate: '30/05/2026' }],
          selectedDateIso: '2026-05-30',
        },
      },
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z',
    } as const;
  }

  function buildAuditService(): AuditService {
    return {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
  }

  it('returns TIME_NO_LONGER_AVAILABLE when selected time is exhausted', async () => {
    const service = new AppointmentReschedulingTimeSelectionService(
      {
        execute: jest
          .fn()
          .mockResolvedValue({ status: 'TIME_NO_LONGER_AVAILABLE' }),
      } as unknown as RescheduleAssignedAppointmentByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      new AssignedAppointmentListFactory(),
      new AppointmentRescheduleConfirmationMessageFactory(),
      new AppointmentAvailabilityMessageFactory(),
      buildAuditService(),
    );

    const outcome = await service.handleAfterTimeSelection(buildSession(), {
      slotRef: '202',
      timeHHmm: '11:40',
      displayTime: '11:40 AM',
    });

    expect(outcome).toEqual({
      status: 'TIME_NO_LONGER_AVAILABLE',
      selectedDisplayTime: '11:40 AM',
    });
  });

  it('returns COMPLETED with reprogram confirmation when rescheduling succeeds', async () => {
    const service = new AppointmentReschedulingTimeSelectionService(
      {
        execute: jest.fn().mockResolvedValue({
          status: 'RESCHEDULED',
          appointment: {
            slotRef: '202',
            specialtyName: 'MEDICINA GENERAL',
            patientFullName: 'DANIEL ANDRES CASTANO NAVARRO',
            appointmentDateIso: '2026-05-30',
            appointmentTimeHHmm: '11:40',
            appointmentDisplayTime: '11:40 AM',
            professionalName: 'MEDICO',
            siteName: 'Santa Marta',
            siteAddress: 'Carrera 19',
            usedFallbackSlot: false,
          },
        }),
      } as unknown as RescheduleAssignedAppointmentByPatientUseCase,
      {
        execute: jest.fn(),
      } as unknown as ListFutureAssignedAppointmentsByPatientUseCase,
      new AssignedAppointmentListFactory(),
      new AppointmentRescheduleConfirmationMessageFactory(),
      new AppointmentAvailabilityMessageFactory(),
      buildAuditService(),
    );

    const outcome = await service.handleAfterTimeSelection(buildSession(), {
      slotRef: '202',
      timeHHmm: '11:40',
      displayTime: '11:40 AM',
    });

    expect(outcome.status).toBe('COMPLETED');
    if (outcome.status !== 'COMPLETED') {
      throw new Error('Unexpected status in test.');
    }

    expect(outcome.result.nextState).toBe('MAIN_MENU');
    expect(outcome.result.outboundMessages[0]).toMatchObject({
      type: 'interactive_buttons',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
    });
  });
});
