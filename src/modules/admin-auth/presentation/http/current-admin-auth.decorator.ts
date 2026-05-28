import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminAuthRequest } from './admin-auth-request';

export const CurrentAdminAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AdminAuthRequest>();
    return request.adminAuth;
  },
);
