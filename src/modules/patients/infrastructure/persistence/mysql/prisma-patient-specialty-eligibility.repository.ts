import { Prisma } from '@prisma/client';
import { BotSexRule } from '@whatsapp-bot/prisma-client';
import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type { PatientSexCode } from '../../../../../shared/domain/patient-sex-code';
import type {
  EligibleSpecialtyRecord,
  PatientSpecialtyEligibilityFilters,
  PatientSpecialtyEligibilityRepository,
} from '../../../domain/ports/patient-specialty-eligibility.repository';

@Injectable()
export class PrismaPatientSpecialtyEligibilityRepository implements PatientSpecialtyEligibilityRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaBot: PrismaBotService,
  ) {}

  async findEligibleSpecialties(
    filters: PatientSpecialtyEligibilityFilters,
  ): Promise<EligibleSpecialtyRecord[]> {
    const specialtyRules = await this.prismaBot.botEpsSpecialtyRule.findMany({
      where: {
        epsCode: filters.epsCode,
        userTypeCode: filters.userType,
        isActive: true,
        sexRule: {
          in: this.resolveSexRules(filters.sex),
        },
      },
      select: {
        specialtyCode: true,
      },
    });

    const specialtyCodes = Array.from(
      new Set(
        specialtyRules.map((rule) => rule.specialtyCode.trim()).filter(Boolean),
      ),
    );

    if (specialtyCodes.length === 0) {
      return [];
    }

    const specialtyCatalog = await this.prisma.$queryRaw<
      Array<{
        codigoEspecialidad: string;
        especialidad: string | null;
        cups: string | null;
      }>
    >(Prisma.sql`
      SELECT
        CodigoEspecialidad AS codigoEspecialidad,
        Especialidad AS especialidad,
        CUPS AS cups
      FROM tvespecialidades
      WHERE TRIM(CodigoEspecialidad) IN (${Prisma.join(specialtyCodes)})
         OR TRIM(CUPS) IN (${Prisma.join(specialtyCodes)})
    `);

    const specialtyByCode = new Map<
      string,
      (typeof specialtyCatalog)[number]
    >();
    for (const specialty of specialtyCatalog) {
      const codeKey = specialty.codigoEspecialidad?.trim();
      const cupsKey = specialty.cups?.trim();
      if (codeKey) {
        specialtyByCode.set(codeKey, specialty);
      }
      if (cupsKey) {
        specialtyByCode.set(cupsKey, specialty);
      }
    }

    const eligibleSpecialties: EligibleSpecialtyRecord[] = [];
    for (const code of specialtyCodes) {
      const specialty = specialtyByCode.get(code);
      if (!specialty) {
        continue;
      }

      const name = this.buildDisplayName(specialty.especialidad);
      if (!name) {
        continue;
      }

      eligibleSpecialties.push({
        code,
        name,
        cups: specialty.cups?.trim() || null,
      });
    }

    return eligibleSpecialties.sort((left, right) =>
      left.name.localeCompare(right.name, 'es'),
    );
  }

  private resolveSexRules(sex: PatientSexCode): BotSexRule[] {
    // Legacy bot rules still use H/M, so we translate the API contract here.
    switch (sex) {
      case 'F':
        return [BotSexRule.ANY, BotSexRule.M];
      case 'M':
        return [BotSexRule.ANY, BotSexRule.H];
      case 'I':
        return [BotSexRule.ANY];
      default:
        return [BotSexRule.ANY];
    }
  }

  private buildDisplayName(rawName: string | null): string {
    if (!rawName?.trim()) {
      return '';
    }

    const normalized = rawName.trim();
    return normalized.replace(/^\d+\s*-\s*/, '').trim();
  }
}
