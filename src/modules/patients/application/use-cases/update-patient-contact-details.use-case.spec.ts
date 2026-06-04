import type { PatientContactProfileRepository } from '../../domain/ports/patient-contact-profile.repository';
import type { UpdatePatientContactDetailsRepository } from '../../domain/ports/update-patient-contact-details.repository';
import { PatientContactInputValidatorService } from '../services/patient-contact-input-validator.service';
import { UpdatePatientContactDetailsUseCase } from './update-patient-contact-details.use-case';

describe('UpdatePatientContactDetailsUseCase', () => {
  function buildUseCase(dependencies?: {
    profileRepository?: PatientContactProfileRepository;
    updateRepository?: UpdatePatientContactDetailsRepository;
  }): UpdatePatientContactDetailsUseCase {
    return new UpdatePatientContactDetailsUseCase(
      dependencies?.profileRepository ?? {
        findByPatientId: jest.fn().mockResolvedValue({
          patientId: 10,
          firstName: 'DANIEL',
          secondName: null,
          firstLastName: 'CASTANO',
          secondLastName: null,
          primaryPhone: '3001234567',
          primaryEmail: 'daniel@example.com',
          phoneVerifiedAtIso: null,
          emailVerifiedAtIso: null,
        }),
      },
      dependencies?.updateRepository ?? {
        updatePatientContactDetails: jest.fn().mockResolvedValue('UPDATED'),
      },
      new PatientContactInputValidatorService(),
    );
  }

  it('updates phone and stores previous phone as secondary backup when valid', async () => {
    const updatePatientContactDetails = jest.fn().mockResolvedValue('UPDATED');
    const useCase = buildUseCase({
      updateRepository: { updatePatientContactDetails },
    });

    const result = await useCase.execute({
      patientId: 10,
      mode: 'PHONE',
      newPhone: '3014445566',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'REQUEST_APPOINTMENT',
    });

    expect(result.status).toBe('UPDATED');
    expect(updatePatientContactDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 10,
        mode: 'PHONE',
        nextPrimaryPhone: '3014445566',
        phoneBackupToSecondary: '3001234567',
      }),
    );
  });

  it('updates email and stores previous email backup when valid', async () => {
    const updatePatientContactDetails = jest.fn().mockResolvedValue('UPDATED');
    const useCase = buildUseCase({
      updateRepository: { updatePatientContactDetails },
    });

    const result = await useCase.execute({
      patientId: 10,
      mode: 'EMAIL',
      newEmail: 'nuevo@example.com',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'UPDATE_CONTACT',
    });

    expect(result.status).toBe('UPDATED');
    expect(updatePatientContactDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 10,
        mode: 'EMAIL',
        nextPrimaryEmail: 'nuevo@example.com',
        emailBackupToSecondary: 'daniel@example.com',
      }),
    );
  });

  it('updates both fields as one consistent operation', async () => {
    const updatePatientContactDetails = jest.fn().mockResolvedValue('UPDATED');
    const useCase = buildUseCase({
      updateRepository: { updatePatientContactDetails },
    });

    const result = await useCase.execute({
      patientId: 10,
      mode: 'BOTH',
      newPhone: '3025556677',
      newEmail: 'otro@example.com',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'CHECK_APPOINTMENTS',
    });

    expect(result.status).toBe('UPDATED');
    expect(updatePatientContactDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'BOTH',
        nextPrimaryPhone: '3025556677',
        nextPrimaryEmail: 'otro@example.com',
      }),
    );
  });

  it('rejects updates when the new phone is equal to the current one', async () => {
    const useCase = buildUseCase();

    const result = await useCase.execute({
      patientId: 10,
      mode: 'PHONE',
      newPhone: '3001234567',
      updatedBy: 'AdrianaBot',
      triggerFlowIntent: 'REQUEST_APPOINTMENT',
    });

    expect(result).toEqual({
      status: 'VALIDATION_ERROR',
      reason: 'SAME_PHONE',
    });
  });
});
