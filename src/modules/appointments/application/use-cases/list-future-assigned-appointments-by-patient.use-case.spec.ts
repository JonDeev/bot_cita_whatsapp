import type { AppointmentConfirmationDetailsRepository } from '../../domain/ports/appointment-confirmation-details.repository';
import type { PatientAssignedAppointmentRepository } from '../../domain/ports/patient-assigned-appointment.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';
import { ListFutureAssignedAppointmentsByPatientUseCase } from './list-future-assigned-appointments-by-patient.use-case';

describe('ListFutureAssignedAppointmentsByPatientUseCase', () => {
  const patient = {
    userId: 98,
    firstName: 'DANIEL',
    secondName: 'ANDRES',
    firstLastName: 'CASTANO',
    secondLastName: 'NAVARRO',
    phone: '3001112233',
  };

  it('returns invalid input when patient id is missing', async () => {
    const useCase = new ListFutureAssignedAppointmentsByPatientUseCase(
      {
        findFutureAssignedAppointmentsByPatient: jest.fn(),
      } as unknown as PatientAssignedAppointmentRepository,
      {
        findPatientById: jest.fn(),
        findAssignedAppointmentBySlotRef: jest.fn(),
      } as unknown as AppointmentConfirmationDetailsRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({ patientId: null });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'INVALID_INPUT',
    });
  });

  it('returns empty when patient has no assigned future appointments', async () => {
    const listRepository: PatientAssignedAppointmentRepository = {
      findFutureAssignedAppointmentsByPatient: jest.fn().mockResolvedValue([]),
    };
    const confirmationRepository: AppointmentConfirmationDetailsRepository = {
      findPatientById: jest.fn().mockResolvedValue(patient),
      findAssignedAppointmentBySlotRef: jest.fn(),
    };
    const useCase = new ListFutureAssignedAppointmentsByPatientUseCase(
      listRepository,
      confirmationRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({ patientId: 98, offset: 0 });

    expect(result).toEqual({
      status: 'EMPTY',
      patientFullName: 'DANIEL ANDRES CASTANO NAVARRO',
      currentOffset: 0,
    });
  });

  it('returns found with 9 rows and hasMore when more than 10 records exist', async () => {
    const listRepository: PatientAssignedAppointmentRepository = {
      findFutureAssignedAppointmentsByPatient: jest.fn().mockResolvedValue(
        Array.from({ length: 11 }, (_, index) => ({
          slotRef: String(100 + index),
          appointmentDateIso: '2026-05-30',
          appointmentTimeHHmm: '11:40',
          specialtyName: '890201 - MEDICINA GENERAL',
          specialtyCups: '890201',
          professionalName: 'MEDICO',
          siteName: 'Sede Central',
          siteAddress: 'Calle 1 # 2-3',
        })),
      ),
    };
    const confirmationRepository: AppointmentConfirmationDetailsRepository = {
      findPatientById: jest.fn().mockResolvedValue(patient),
      findAssignedAppointmentBySlotRef: jest.fn(),
    };
    const useCase = new ListFutureAssignedAppointmentsByPatientUseCase(
      listRepository,
      confirmationRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({ patientId: 98, offset: 0 });

    expect(result).toMatchObject({
      status: 'FOUND',
      patientFullName: 'DANIEL ANDRES CASTANO NAVARRO',
      hasMore: true,
      currentOffset: 0,
      nextOffset: 9,
    });
    if (result.status !== 'FOUND') {
      throw new Error('Unexpected result status in test.');
    }
    expect(result.appointments).toHaveLength(9);
    expect(result.appointments[0]).toMatchObject({
      specialtyName: 'MEDICINA GENERAL',
      appointmentDisplayTime: '11:40 AM',
      siteName: 'Sede Central',
      siteAddress: 'Calle 1 # 2-3',
    });
  });

  it('uses default specialty name when specialty cannot be resolved', async () => {
    const listRepository: PatientAssignedAppointmentRepository = {
      findFutureAssignedAppointmentsByPatient: jest.fn().mockResolvedValue([
        {
          slotRef: '101',
          appointmentDateIso: '2026-05-30',
          appointmentTimeHHmm: '11:40',
          specialtyName: null,
          specialtyCups: null,
          professionalName: 'MEDICO',
          siteName: null,
          siteAddress: null,
        },
      ]),
    };
    const confirmationRepository: AppointmentConfirmationDetailsRepository = {
      findPatientById: jest.fn().mockResolvedValue(patient),
      findAssignedAppointmentBySlotRef: jest.fn(),
    };
    const useCase = new ListFutureAssignedAppointmentsByPatientUseCase(
      listRepository,
      confirmationRepository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({ patientId: 98, offset: 0 });

    if (result.status !== 'FOUND') {
      throw new Error('Unexpected result status in test.');
    }
    expect(result.appointments[0]).toMatchObject({
      specialtyName: 'ESPECIALIDAD POR CONFIRMAR',
      siteName: 'SEDE POR CONFIRMAR',
      siteAddress: 'DIRECCION POR CONFIRMAR',
    });
  });
});
