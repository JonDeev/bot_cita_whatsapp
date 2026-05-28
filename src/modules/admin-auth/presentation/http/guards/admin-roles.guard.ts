import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@whatsapp-bot/shared';
import { AdminAuthAuditService } from '../../../application/services/admin-auth-audit.service';
import { ADMIN_ROLES_METADATA_KEY } from '../admin-roles.decorator';
import type { AdminAuthRequest } from '../admin-auth-request';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuthAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AdminAuthRequest>();
    const adminAuth = request.adminAuth;
    if (!adminAuth || !requiredRoles.includes(adminAuth.user.role)) {
      await this.audit.write({
        adminUserId: adminAuth?.user.id ?? null,
        action: 'admin.auth.access_denied',
        metadata: {
          requiredRoles: requiredRoles.join(','),
          currentRole: adminAuth?.user.role ?? 'UNAUTHENTICATED',
          route: request.route?.path ?? request.path,
        },
      });
      throw new ForbiddenException('Insufficient admin role.');
    }

    return true;
  }
}
