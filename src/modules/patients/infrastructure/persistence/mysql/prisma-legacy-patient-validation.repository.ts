import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  PatientValidationRecord,
  PatientValidationRepository,
} from '../../../domain/ports/patient-validation.repository';

@Injectable()
export class PrismaLegacyPatientValidationRepository implements PatientValidationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDocumentAndBirthDate(
    documentNumber: string,
    birthDateIso: string,
  ): Promise<PatientValidationRecord | null> {
    const start = new Date(`${birthDateIso}T00:00:00.000Z`);
    const end = new Date(`${birthDateIso}T23:59:59.999Z`);

    const patient = await this.prisma.usuarios.findFirst({
      where: {
        Identificaci_n_usuario: documentNumber,
        Fecha_nacimient: {
          gte: start,
          lte: end,
        },
      },
      select: {
        IdUsuario: true,
        Identificaci_n_usuario: true,
        Fecha_nacimient: true,
        Estado: true,
        Codigo_eps: true,
        Tipo_usuario: true,
        Sexo: true,
      },
    });

    if (!patient || !patient.Fecha_nacimient) {
      return null;
    }

    return {
      patientId: patient.IdUsuario,
      documentNumber: patient.Identificaci_n_usuario,
      birthDateIso: patient.Fecha_nacimient.toISOString().slice(0, 10),
      status: patient.Estado ?? null,
      epsCode: patient.Codigo_eps ?? null,
      userType: patient.Tipo_usuario ?? null,
      sex: patient.Sexo ?? null,
    };
  }
}
