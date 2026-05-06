import { Injectable } from '@nestjs/common';

interface PresentedDoctorRow {
  title: string;
  description?: string;
}

@Injectable()
export class AppointmentDoctorListPresenterService {
  private static readonly TITLE_MAX_LENGTH = 24;
  private static readonly DESCRIPTION_MAX_LENGTH = 72;
  private static readonly ELLIPSIS = '...';
  private static readonly DEFAULT_TITLE = 'MEDICO DISPONIBLE';

  present(displayName: string): PresentedDoctorRow {
    const normalizedName = this.normalize(displayName);
    if (!normalizedName) {
      return { title: AppointmentDoctorListPresenterService.DEFAULT_TITLE };
    }

    if (this.countCharacters(normalizedName) <= AppointmentDoctorListPresenterService.TITLE_MAX_LENGTH) {
      return { title: normalizedName };
    }

    const compactTitle = this.buildCompactTitle(normalizedName);
    const safeTitle = this.truncate(compactTitle, AppointmentDoctorListPresenterService.TITLE_MAX_LENGTH);
    const safeDescription = this.truncate(
      normalizedName,
      AppointmentDoctorListPresenterService.DESCRIPTION_MAX_LENGTH,
    );

    if (safeDescription === safeTitle) {
      return { title: safeTitle };
    }

    return {
      title: safeTitle,
      description: safeDescription,
    };
  }

  private normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private buildCompactTitle(fullName: string): string {
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length <= 1) {
      return fullName;
    }

    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  private truncate(value: string, maxLength: number): string {
    if (this.countCharacters(value) <= maxLength) {
      return value;
    }

    const truncatedLength = maxLength - AppointmentDoctorListPresenterService.ELLIPSIS.length;
    if (truncatedLength <= 0) {
      return AppointmentDoctorListPresenterService.ELLIPSIS.slice(0, maxLength);
    }

    const head = Array.from(value).slice(0, truncatedLength).join('').trimEnd();
    return `${head}${AppointmentDoctorListPresenterService.ELLIPSIS}`;
  }

  private countCharacters(text: string): number {
    return Array.from(text).length;
  }
}
