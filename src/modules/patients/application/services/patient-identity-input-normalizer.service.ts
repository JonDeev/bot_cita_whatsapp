import { Injectable } from '@nestjs/common';
import {
  normalizePatientSexCode as normalizePatientSexCodeValue,
  type PatientSexCode,
} from '../../../../shared/domain/patient-sex-code';

export interface ParsedWhatsappBirthDate {
  isoDate: string;
}

@Injectable()
export class PatientIdentityInputNormalizerService {
  sanitizeDocumentNumber(rawValue: string): string | null {
    const sanitized = rawValue.replace(/\D/g, '');
    if (sanitized.length === 0) {
      return null;
    }

    return sanitized;
  }

  parseWhatsappBirthDate(rawValue: string): ParsedWhatsappBirthDate | null {
    const trimmed = rawValue.trim();
    const match = /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/.exec(trimmed);
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year)
    ) {
      return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    const isValidDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;

    if (!isValidDate) {
      return null;
    }

    const isoDate = `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    return { isoDate };
  }

  normalizePatientSexCode(
    rawValue: string | null | undefined,
  ): PatientSexCode | null {
    return normalizePatientSexCodeValue(rawValue);
  }

  maskDocumentNumber(documentNumber: string): string {
    const visibleDigits = documentNumber.slice(-4);
    return `***${visibleDigits}`;
  }
}
