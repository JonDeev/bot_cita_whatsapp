import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type {
  SatisfactionSurveyLegacyStatusRepository,
  UpdateAgendaSurveyNotificationStatusCommand,
} from '../../../domain/ports/satisfaction-survey-legacy-status.repository';

@Injectable()
export class PrismaLegacySatisfactionSurveyLegacyStatusRepository implements SatisfactionSurveyLegacyStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateAgendaSurveyNotificationStatus(
    command: UpdateAgendaSurveyNotificationStatusCommand,
  ): Promise<number> {
    if (command.legacyAgendaIds.length === 0) {
      return 0;
    }

    this.ensureAgendaUpdatesEnabled();

    const agendaIds = command.legacyAgendaIds
      .filter((id) => Number.isInteger(id) && id > 0)
      .map((id) => Number(id));

    if (agendaIds.length === 0) {
      return 0;
    }

    const updatedRows = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE agenda
      SET notificacion_encuesta = ${command.status}
      WHERE idagenda IN (${Prisma.join(agendaIds)})
    `);

    return Number(updatedRows);
  }

  private ensureAgendaUpdatesEnabled(): void {
    if (process.env.ALLOW_AGENDA_UPDATES === 'true') {
      return;
    }

    throw new Error(
      '[DB_GUARDRAIL] Survey agenda updates are disabled. Set ALLOW_AGENDA_UPDATES=true to proceed.',
    );
  }
}
