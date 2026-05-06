import type { PendingAppointmentCheckRepository } from '../../domain/ports/pending-appointment-check.repository';
import { AppointmentTimePresenterService } from '../services/appointment-time-presenter.service';
import { FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase } from './find-nearest-pending-future-appointment-by-patient-and-specialty.use-case';

describe('FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase', () => {
  it('returns invalid input when patient or specialty data is missing', async () => {
    const repository: PendingAppointmentCheckRepository = {
      findNearestPendingFutureAppointmentByPatientAndSpecialty: jest.fn(),
    };
    const useCase = new FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase(
      repository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: null,
      specialtyCups: '890201',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'INVALID_INPUT',
    });
    expect(
      repository.findNearestPendingFutureAppointmentByPatientAndSpecialty,
    ).not.toHaveBeenCalled();
  });

  it('returns nearest pending appointment details when repository finds a match', async () => {
    const repository: PendingAppointmentCheckRepository = {
      findNearestPendingFutureAppointmentByPatientAndSpecialty: jest.fn().mockResolvedValue({
        slotRef: '101',
        appointmentDateIso: '2026-05-30',
        appointmentTimeHHmm: '11:40',
        modalityId: 0,
        professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
        siteName: 'Santa Marta',
        siteAddress: 'Carrera 19',
        patientFirstName: 'MARIA',
        patientSecondName: 'FERNANDA',
        patientFirstLastName: 'PEREZ',
        patientSecondLastName: 'LOPEZ',
      }),
    };
    const useCase = new FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase(
      repository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 77,
      specialtyCups: '890201',
      now: new Date('2026-05-06T15:30:00.000Z'),
    });

    expect(
      repository.findNearestPendingFutureAppointmentByPatientAndSpecialty,
    ).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'FOUND',
      appointment: {
        slotRef: '101',
        patientFullName: 'MARIA FERNANDA PEREZ LOPEZ',
        appointmentDateIso: '2026-05-30',
        appointmentTimeHHmm: '11:40',
        appointmentDisplayTime: '11:40 AM',
        modality: 'PRESENCIAL',
        professionalName: 'ALICAN MARIA ZAMBRANO PIZARRO',
        siteName: 'Santa Marta',
        siteAddress: 'Carrera 19',
      },
    });
  });

  it('returns technical failure when repository throws an error', async () => {
    const repository: PendingAppointmentCheckRepository = {
      findNearestPendingFutureAppointmentByPatientAndSpecialty: jest
        .fn()
        .mockRejectedValue(new Error('DB timeout')),
    };
    const useCase = new FindNearestPendingFutureAppointmentByPatientAndSpecialtyUseCase(
      repository,
      new AppointmentTimePresenterService(),
    );

    const result = await useCase.execute({
      patientId: 77,
      specialtyCups: '890201',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'UNEXPECTED_ERROR',
    });
  });
});
