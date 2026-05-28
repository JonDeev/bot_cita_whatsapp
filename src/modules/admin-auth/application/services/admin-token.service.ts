import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminTokenService {
  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  matchesHash(token: string, expectedHash: string): boolean {
    const actual = this.hashOpaqueToken(token);
    const actualBuffer = Buffer.from(actual, 'utf8');
    const expectedBuffer = Buffer.from(expectedHash, 'utf8');
    if (actualBuffer.byteLength !== expectedBuffer.byteLength) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
