import type { AppointmentConfirmationDetailsRepository } from '../../domain/ports/appointment-confirmation-details.repository';
import type { AppointmentReschedulingRepository } from '../../domain/ports/appointment-rescheduling.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';
import { RescheduleAssignedAppointmentByPatientUseCase } from './reschedule-assigned-appointment-by-patient.use-case';

describe('RescheduleAssignedAppointmentByPatientUseCase', () => {
  const patient = {
    userId: 98,
    firstName: 'DANIEL',
    secondName: 'ANDRES',
    firstLastName: 'CASTANO',
    secondLastName: 'NAVARRO',
    phone: '3001112233',
  };

  it('returns invalid input when required data is missing', async () => {
    const useCase = new RescheduleAssignedAppointmentByPatientUseCase(
      {
        rescheduleAssignedFutureAppointmentByPatient: jest.fn(),
      } as unknown as AppointmentReschedulingRepository,
      {
        findPatientById: jest.fn(),
        findAssignedAppointmentBySlotRef: jest.fn(),
      } as unknown as AppointmentConfirmationDetailsRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      originalSlotRef: '101',
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: null,
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredNewSlotRef: '201',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'INVALID_INPUT',
    });
  });

  it('returns original appointment not rebookable when repository rejects original slot', async () => {
    const useCase = new RescheduleAssignedAppointmentByPatientUseCase(
      {
        rescheduleAssignedFutureAppointmentByPatient: jest
          .fn()
          .mockResolvedValue({ status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' }),
      },
      {
        findPatientById: jest.fn().mockResolvedValue(patient),
        findAssignedAppointmentBySlotRef: jest.fn(),
      },
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      originalSlotRef: '101',
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredNewSlotRef: '201',
    });

    expect(result).toEqual({ status: 'ORIGINAL_APPOINTMENT_NOT_REBOOKABLE' });
  });

  it('returns rescheduled details when repository succeeds', async () => {
    const reschedulingRepository: AppointmentReschedulingRepository = {
      rescheduleAssignedFutureAppointmentByPatient: jest.fn().mockResolvedValue({
        status: 'RESCHEDULED',
        assignedSlotRef: '202',
        usedFallbackSlot: true,
      }),
    };
    const confirmationRepository: AppointmentConfirmationDetailsRepository = {
      findPatientById: jest.fn().mockResolvedValue(patient),
      findAssignedAppointmentBySlotRef: jest.fn().mockResolvedValue({
        slotRef: '202',
        appointmentDateIso: '2026-05-20',
        appointmentTimeHHmm: '11:40',
        professionalName: 'MEDICO FALLBACK',
        siteName: 'Santa Marta',
        siteAddress: 'Carrera 19',
      }),
    };
    const useCase = new RescheduleAssignedAppointmentByPatientUseCase(
      reschedulingRepository,
      confirmationRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      originalSlotRef: '101',
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredNewSlotRef: '201',
    });

    expect(result).toMatchObject({
      status: 'RESCHEDULED',
      appointment: {
        slotRef: '202',
        appointmentDisplayTime: '11:40 AM',
        usedFallbackSlot: true,
      },
    });
  });

  it('returns assigned slot not found when confirmation details query fails', async () => {
    const useCase = new RescheduleAssignedAppointmentByPatientUseCase(
      {
        rescheduleAssignedFutureAppointmentByPatient: jest.fn().mockResolvedValue({
          status: 'RESCHEDULED',
          assignedSlotRef: '202',
          usedFallbackSlot: false,
        }),
      },
      {
        findPatientById: jest.fn().mockResolvedValue(patient),
        findAssignedAppointmentBySlotRef: jest.fn().mockResolvedValue(null),
      },
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      originalSlotRef: '101',
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredNewSlotRef: '201',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'ASSIGNED_SLOT_NOT_FOUND',
    });
  });
});
