import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  PatientContactProfileRecord,
  PatientContactProfileRepository,
} from '../../../domain/ports/patient-contact-profile.repository';

@Injectable()
export class PrismaLegacyPatientContactProfileRepository implements PatientContactProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPatientId(
    patientId: number,
  ): Promise<PatientContactProfileRecord | null> {
    const patient = await this.prisma.usuarios.findUnique({
      where: { IdUsuario: patientId },
      select: {
        IdUsuario: true,
        Primer_nombre: true,
        Segundo_nombre: true,
        Primer_apellido: true,
        Segundo_apellido: true,
        Tel_fono: true,
        email: true,
      },
    });

    if (!patient) {
      return null;
    }

    return {
      patientId: patient.IdUsuario,
      firstName: patient.Primer_nombre,
      secondName: patient.Segundo_nombre?.trim() || null,
      firstLastName: patient.Primer_apellido,
      secondLastName: patient.Segundo_apellido?.trim() || null,
      primaryPhone: patient.Tel_fono?.trim() || null,
      primaryEmail: patient.email?.trim() || null,
    };
  }
}
