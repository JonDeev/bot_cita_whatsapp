import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AdminAuthMeResponseDto } from '@whatsapp-bot/shared';
import type { AuthenticatedAdminContext } from '../../presentation/http/admin-auth-request';

@Injectable()
export class GetAdminAuthMeUseCase {
  execute(
    adminAuth: AuthenticatedAdminContext | undefined,
  ): AdminAuthMeResponseDto {
    if (!adminAuth) {
      throw new UnauthorizedException('Missing authenticated admin context.');
    }

    return {
      id: adminAuth.user.id,
      email: adminAuth.user.email,
      username: adminAuth.user.username,
      displayName: adminAuth.user.displayName,
      role: adminAuth.user.role,
      status: adminAuth.user.status,
    };
  }
}
