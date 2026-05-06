import type { AppointmentAssignmentRepository } from '../../domain/ports/appointment-assignment.repository';
import type { AppointmentConfirmationDetailsRepository } from '../../domain/ports/appointment-confirmation-details.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';
import { AssignAppointmentSlotAfterTimeSelectionUseCase } from './assign-appointment-slot-after-time-selection.use-case';

describe('AssignAppointmentSlotAfterTimeSelectionUseCase', () => {
  const patient = {
    userId: 98,
    firstName: 'DANIEL',
    secondName: 'ANDRES',
    firstLastName: 'CASTANO',
    secondLastName: 'NAVARRO',
    phone: '3001112233',
  };

  it('assigns the preferred slot when still available', async () => {
    const assignmentRepository: AppointmentAssignmentRepository = {
      assignSlotIfAvailable: jest.fn().mockResolvedValue(true),
      findFallbackAvailableSlot: jest.fn().mockResolvedValue(null),
    };
    const confirmationRepository: AppointmentConfirmationDetailsRepository = {
      findPatientById: jest.fn().mockResolvedValue(patient),
      findAssignedAppointmentBySlotRef: jest.fn().mockResolvedValue({
        slotRef: '101',
        appointmentDateIso: '2026-05-20',
        appointmentTimeHHmm: '11:40',
        professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
        siteName: 'Santa Marta',
        siteAddress: 'Carrera 19',
      }),
    };

    const useCase = new AssignAppointmentSlotAfterTimeSelectionUseCase(
      assignmentRepository,
      confirmationRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredSlotRef: '101',
      now: new Date('2026-05-05T19:00:00.000Z'),
    });

    expect(result).toMatchObject({
      status: 'ASSIGNED',
      appointment: {
        slotRef: '101',
        usedFallbackSlot: false,
        appointmentDisplayTime: '11:40 AM',
      },
    });
    expect(assignmentRepository.findFallbackAvailableSlot).not.toHaveBeenCalled();
  });

  it('uses fallback slot when preferred slot was already taken', async () => {
    const assignmentRepository: AppointmentAssignmentRepository = {
      assignSlotIfAvailable: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
      findFallbackAvailableSlot: jest.fn().mockResolvedValue({ slotRef: '202' }),
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

    const useCase = new AssignAppointmentSlotAfterTimeSelectionUseCase(
      assignmentRepository,
      confirmationRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredSlotRef: '101',
    });

    expect(result).toMatchObject({
      status: 'ASSIGNED',
      appointment: {
        slotRef: '202',
        usedFallbackSlot: true,
      },
    });
    expect(assignmentRepository.findFallbackAvailableSlot).toHaveBeenCalledTimes(1);
  });

  it('returns time no longer available when no fallback slot exists', async () => {
    const useCase = new AssignAppointmentSlotAfterTimeSelectionUseCase(
      {
        assignSlotIfAvailable: jest.fn().mockResolvedValue(false),
        findFallbackAvailableSlot: jest.fn().mockResolvedValue(null),
      },
      {
        findPatientById: jest.fn().mockResolvedValue(patient),
        findAssignedAppointmentBySlotRef: jest.fn(),
      },
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredSlotRef: '101',
    });

    expect(result).toEqual({ status: 'TIME_NO_LONGER_AVAILABLE' });
  });

  it('does not use fallback when slot belongs to an explicitly selected doctor', async () => {
    const assignmentRepository: AppointmentAssignmentRepository = {
      assignSlotIfAvailable: jest.fn().mockResolvedValue(false),
      findFallbackAvailableSlot: jest.fn().mockResolvedValue({ slotRef: '202' }),
    };
    const useCase = new AssignAppointmentSlotAfterTimeSelectionUseCase(
      assignmentRepository,
      {
        findPatientById: jest.fn().mockResolvedValue(patient),
        findAssignedAppointmentBySlotRef: jest.fn(),
      },
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 98,
      specialtyName: 'MEDICINA GENERAL',
      specialtyCups: '890201',
      appointmentDateIso: '2026-05-20',
      appointmentTimeHHmm: '11:40',
      preferredSlotRef: '101',
      doctorEmployeeCode: 'M001',
    });

    expect(result).toEqual({ status: 'TIME_NO_LONGER_AVAILABLE' });
    expect(assignmentRepository.findFallbackAvailableSlot).not.toHaveBeenCalled();
  });
});
