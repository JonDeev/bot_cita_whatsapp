import { Injectable } from '@nestjs/common';
import type { AdminSurveyDispatchListResult } from '../../domain/admin-surveys.types';

@Injectable()
export class AdminSurveysMaskingService {
  mapDispatches(result: AdminSurveyDispatchListResult) {
    return {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      items: result.items.map((item) => {
        const { patientPhone, ...safeItem } = item;
        return {
          ...safeItem,
          patientPhoneMasked: this.maskPhone(patientPhone),
        };
      }),
    };
  }

  private maskPhone(value: string): string {
    const digits = value.replace(/\D+/g, '');
    if (digits.length <= 4) {
      return '****';
    }

    return `***${digits.slice(-4)}`;
  }
}
