import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { SatisfactionSurveyEligibilitySourceConfigService } from '../../../application/services/satisfaction-survey-eligibility-source-config.service';
import type {
  FindEligibleAppointmentsByWindowFilters,
  SatisfactionSurveyEligibilityRepository,
  SatisfactionSurveyEligibleAppointment,
} from '../../../domain/ports/satisfaction-survey-eligibility.repository';

interface JsonEligibilityRow {
  legacyAgendaId?: number;
  patientLegacyUserId?: number;
  patientName?: string;
  patientPhone?: string | null;
  appointmentDateIso?: string;
  appointmentTimeHhmm?: string;
  specialtyName?: string | null;
  doctorName?: string | null;
  siteName?: string | null;
}

@Injectable()
export class JsonFileSatisfactionSurveyEligibilityRepository implements SatisfactionSurveyEligibilityRepository {
  private readonly logger = new Logger(
    JsonFileSatisfactionSurveyEligibilityRepository.name,
  );

  constructor(
    private readonly configService: SatisfactionSurveyEligibilitySourceConfigService,
  ) {}

  async findEligibleAppointmentsByWindow(
    filters: FindEligibleAppointmentsByWindowFilters,
  ): Promise<SatisfactionSurveyEligibleAppointment[]> {
    const rows = await this.readRows();
    const windowStart = this.toTotalMinutes(filters.windowStartHHmm);
    const windowEnd = this.toTotalMinutes(filters.windowEndHHmm);

    const filteredRows = rows
      .map((row) => this.toAppointment(row))
      .filter(
        (appointment): appointment is SatisfactionSurveyEligibleAppointment =>
          Boolean(appointment),
      )
      .filter(
        (appointment) =>
          appointment.appointmentDateIso === filters.surveyDateIso,
      )
      .filter((appointment) => {
        const appointmentMinutes = this.toTotalMinutes(
          appointment.appointmentTimeHhmm,
        );
        return (
          appointmentMinutes >= windowStart && appointmentMinutes < windowEnd
        );
      })
      .sort((left, right) => {
        if (left.patientLegacyUserId !== right.patientLegacyUserId) {
          return left.patientLegacyUserId - right.patientLegacyUserId;
        }

        if (left.appointmentTimeHhmm !== right.appointmentTimeHhmm) {
          return left.appointmentTimeHhmm.localeCompare(
            right.appointmentTimeHhmm,
          );
        }

        return left.legacyAgendaId - right.legacyAgendaId;
      });

    return filteredRows.slice(0, filters.limit ?? filteredRows.length);
  }

  private async readRows(): Promise<JsonEligibilityRow[]> {
    const path = this.configService.getJsonFilePath();
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(
        `Eligibility JSON file must contain an array. path=${path}`,
      );
    }

    this.logger.log(
      `Loaded ${parsed.length} test eligibility rows from ${path}.`,
    );

    return parsed as JsonEligibilityRow[];
  }

  private toAppointment(
    row: JsonEligibilityRow,
  ): SatisfactionSurveyEligibleAppointment | null {
    const legacyAgendaId = Number(row.legacyAgendaId);
    const patientLegacyUserId = Number(row.patientLegacyUserId);
    const patientName = (row.patientName ?? '').trim();
    const appointmentDateIso = (row.appointmentDateIso ?? '').trim();
    const appointmentTimeHhmm = (row.appointmentTimeHhmm ?? '').trim();

    if (
      !Number.isInteger(legacyAgendaId) ||
      legacyAgendaId <= 0 ||
      !Number.isInteger(patientLegacyUserId) ||
      patientLegacyUserId <= 0 ||
      !patientName ||
      !appointmentDateIso ||
      !this.isValidDateIso(appointmentDateIso) ||
      !this.isValidHHmm(appointmentTimeHhmm)
    ) {
      return null;
    }

    return {
      legacyAgendaId,
      patientLegacyUserId,
      patientName,
      patientPhone: row.patientPhone?.trim() || null,
      appointmentDateIso,
      appointmentTimeHhmm,
      specialtyName: row.specialtyName?.trim() || null,
      doctorName: row.doctorName?.trim() || null,
      siteName: row.siteName?.trim() || null,
    };
  }

  private isValidDateIso(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return (
      utcDate.getUTCFullYear() === year &&
      utcDate.getUTCMonth() === month - 1 &&
      utcDate.getUTCDate() === day
    );
  }

  private isValidHHmm(value: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return false;
    }

    const [hourText, minuteText] = value.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);

    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }

  private toTotalMinutes(hhmm: string): number {
    const [hourText, minuteText] = hhmm.split(':');
    return Number(hourText) * 60 + Number(minuteText);
  }
}
