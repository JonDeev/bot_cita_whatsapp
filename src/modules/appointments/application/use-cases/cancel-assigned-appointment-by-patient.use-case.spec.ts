import type { AppointmentCancellationRepository } from '../../domain/ports/appointment-cancellation.repository';
import { CancelAssignedAppointmentByPatientUseCase } from './cancel-assigned-appointment-by-patient.use-case';

describe('CancelAssignedAppointmentByPatientUseCase', () => {
  it('returns invalid input when patient or slot is missing', async () => {
    const useCase = new CancelAssignedAppointmentByPatientUseCase({
      cancelAssignedFutureAppointmentByPatient: jest.fn(),
    } as unknown as AppointmentCancellationRepository);

    const result = await useCase.execute({
      patientId: null,
      slotRef: '101',
    });

    expect(result).toEqual({
      status: 'TECHNICAL_FAILURE',
      reason: 'INVALID_INPUT',
    });
  });

  it('returns cancelled when guarded update succeeds', async () => {
    const useCase = new CancelAssignedAppointmentByPatientUseCase({
      cancelAssignedFutureAppointmentByPatient: jest.fn().mockResolvedValue(true),
    } as unknown as AppointmentCancellationRepository);

    const result = await useCase.execute({
      patientId: 98,
      slotRef: '101',
    });

    expect(result).toEqual({ status: 'CANCELLED' });
  });

  it('returns not cancellable when guarded update affects zero rows', async () => {
    const useCase = new CancelAssignedAppointmentByPatientUseCase({
      cancelAssignedFutureAppointmentByPatient: jest.fn().mockResolvedValue(false),
    } as unknown as AppointmentCancellationRepository);

    const result = await useCase.execute({
      patientId: 98,
      slotRef: '101',
    });

    expect(result).toEqual({ status: 'NOT_CANCELLABLE' });
  });
});
