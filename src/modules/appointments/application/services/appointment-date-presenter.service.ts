import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentDatePresenterService {
  formatIsoDate(isoDate: string): string {
    const [year, month, day] = isoDate.trim().split('-');
    if (!year || !month || !day) {
      return isoDate.trim();
    }

    return `${day}/${month}/${year}`;
  }
}
