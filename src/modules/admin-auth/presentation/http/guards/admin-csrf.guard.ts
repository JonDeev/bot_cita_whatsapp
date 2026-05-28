import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AdminAuthRequest } from '../admin-auth-request';
import { AdminTokenService } from '../../../application/services/admin-token.service';

@Injectable()
export class AdminCsrfGuard implements CanActivate {
  constructor(private readonly tokenService: AdminTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminAuthRequest>();
    if (!request.adminAuth) {
      throw new UnauthorizedException('Missing authenticated admin context.');
    }

    const expectedHash = request.adminAuth.csrfTokenHash;
    if (!expectedHash) {
      throw new UnauthorizedException('Missing CSRF token binding.');
    }

    const rawHeader = request.headers['x-csrf-token'];
    const providedToken =
      typeof rawHeader === 'string' ? rawHeader : rawHeader?.[0];
    if (!providedToken || providedToken.trim().length === 0) {
      throw new UnauthorizedException('Missing CSRF token.');
    }

    const isMatch = this.tokenService.matchesHash(
      providedToken.trim(),
      expectedHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Invalid CSRF token.');
    }

    return true;
  }
}
