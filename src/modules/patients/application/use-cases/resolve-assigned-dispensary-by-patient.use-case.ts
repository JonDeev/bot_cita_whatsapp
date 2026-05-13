import { Inject, Injectable } from '@nestjs/common';
import { PATIENT_ASSIGNED_DISPENSARY_REPOSITORY } from '../../domain/patients.tokens';
import type { PatientAssignedDispensaryRepository } from '../../domain/ports/patient-assigned-dispensary.repository';

export interface ResolveAssignedDispensaryByPatientInput {
  patientId?: number | null;
}

export type ResolveAssignedDispensaryByPatientResult =
  | {
      status: 'FOUND';
      patientFullName: string;
      dispensary: {
        id: number;
        name: string;
        address: string;
        city: string;
        schedule: string;
      };
    }
  | {
      status: 'NOT_ASSIGNED';
      patientFullName: string;
    }
  | {
      status: 'TECHNICAL_FAILURE';
      reason: 'INVALID_INPUT' | 'PATIENT_NOT_FOUND' | 'UNEXPECTED_ERROR';
    };

@Injectable()
export class ResolveAssignedDispensaryByPatientUseCase {
  constructor(
    @Inject(PATIENT_ASSIGNED_DISPENSARY_REPOSITORY)
    private readonly patientAssignedDispensaryRepository: PatientAssignedDispensaryRepository,
  ) {}

  async execute(
    input: ResolveAssignedDispensaryByPatientInput,
  ): Promise<ResolveAssignedDispensaryByPatientResult> {
    const patientId = input.patientId ?? null;
    if (
      typeof patientId !== 'number' ||
      !Number.isInteger(patientId) ||
      patientId <= 0
    ) {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'INVALID_INPUT',
      };
    }

    try {
      const assignedDispensary =
        await this.patientAssignedDispensaryRepository.findAssignedDispensaryByPatientId(
          patientId,
        );

      if (assignedDispensary) {
        return {
          status: 'FOUND',
          patientFullName: this.buildPatientFullName({
            firstName: assignedDispensary.firstName,
            secondName: assignedDispensary.secondName,
            firstLastName: assignedDispensary.firstLastName,
            secondLastName: assignedDispensary.secondLastName,
          }),
          dispensary: {
            id: assignedDispensary.dispensaryId,
            name: assignedDispensary.dispensaryName,
            address: assignedDispensary.dispensaryAddress,
            city: assignedDispensary.dispensaryCity,
            schedule: assignedDispensary.dispensarySchedule,
          },
        };
      }

      const patientFullName =
        await this.patientAssignedDispensaryRepository.findPatientFullNameById(
          patientId,
        );

      if (!patientFullName) {
        return {
          status: 'TECHNICAL_FAILURE',
          reason: 'PATIENT_NOT_FOUND',
        };
      }

      return {
        status: 'NOT_ASSIGNED',
        patientFullName,
      };
    } catch {
      return {
        status: 'TECHNICAL_FAILURE',
        reason: 'UNEXPECTED_ERROR',
      };
    }
  }

  private buildPatientFullName(parts: {
    firstName: string;
    secondName: string | null;
    firstLastName: string;
    secondLastName: string | null;
  }): string {
    const fullName = [
      parts.firstName,
      parts.secondName,
      parts.firstLastName,
      parts.secondLastName,
    ]
      .map((part) => part?.trim() ?? '')
      .filter((part) => part.length > 0)
      .join(' ')
      .trim();

    return fullName || 'PACIENTE';
  }
}
