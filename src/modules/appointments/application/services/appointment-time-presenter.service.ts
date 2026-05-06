import { Injectable } from '@nestjs/common';

const TIME_24H_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

@Injectable()
export class AppointmentTimePresenterService {
  formatHHmmAsTwelveHour(timeHHmm: string): string {
    const normalized = timeHHmm.trim();
    const match = TIME_24H_PATTERN.exec(normalized);
    if (!match) {
      return normalized;
    }

    const hour = Number(match[1]);
    const minute = match[2];
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;

    return `${String(hour12).padStart(2, '0')}:${minute} ${meridiem}`;
  }
}
