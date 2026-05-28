import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class AdminFingerprintService {
  hashIp(ip: string | null | undefined): string | null {
    if (!ip || ip.trim().length === 0) {
      return null;
    }

    return createHash('sha256').update(ip.trim()).digest('hex');
  }
}
