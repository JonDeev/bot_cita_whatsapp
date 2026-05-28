import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  AdminAuthMeResponseDto,
  AdminLoginResponseDto,
} from '@whatsapp-bot/shared';
import { AdminIdentifierNormalizerService } from '../../application/services/admin-identifier-normalizer.service';
import { AdminSessionCookieService } from '../../application/services/admin-session-cookie.service';
import { GetAdminAuthMeUseCase } from '../../application/use-cases/get-admin-auth-me.use-case';
import { IssueAdminCsrfTokenUseCase } from '../../application/use-cases/issue-admin-csrf-token.use-case';
import { LoginAdminUseCase } from '../../application/use-cases/login-admin.use-case';
import { LogoutAdminUseCase } from '../../application/use-cases/logout-admin.use-case';
import type { AdminAuthRequest } from './admin-auth-request';
import { CurrentAdminAuth } from './current-admin-auth.decorator';
import { AdminCsrfGuard } from './guards/admin-csrf.guard';
import { AdminSessionGuard } from './guards/admin-session.guard';

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(
    private readonly normalizer: AdminIdentifierNormalizerService,
    private readonly loginAdmin: LoginAdminUseCase,
    private readonly getMe: GetAdminAuthMeUseCase,
    private readonly issueCsrf: IssueAdminCsrfTokenUseCase,
    private readonly logoutAdmin: LogoutAdminUseCase,
    private readonly sessionCookie: AdminSessionCookieService,
  ) {}

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: AdminAuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminLoginResponseDto> {
    const parsed = this.normalizer.parseLoginRequest(body);
    const result = await this.loginAdmin.execute({
      identifier: parsed.identifier,
      password: parsed.password,
      ipAddress: this.extractClientIp(request),
      userAgent: this.extractUserAgent(request),
    });

    this.sessionCookie.setSessionCookie(response, result.sessionToken, result.expiresAt);

    return { user: result.user };
  }

  @Get('me')
  @UseGuards(AdminSessionGuard)
  getAuthenticatedAdmin(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
  ): AdminAuthMeResponseDto {
    return this.getMe.execute(adminAuth);
  }

  @Get('csrf')
  @UseGuards(AdminSessionGuard)
  async issueCsrfToken(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
  ): Promise<{ csrfToken: string }> {
    return this.issueCsrf.execute(adminAuth);
  }

  @Post('logout')
  @UseGuards(AdminSessionGuard, AdminCsrfGuard)
  async logout(
    @CurrentAdminAuth() adminAuth: AdminAuthRequest['adminAuth'],
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.logoutAdmin.execute(adminAuth);
    this.sessionCookie.clearSessionCookie(response);

    return { success: true };
  }

  private extractClientIp(request: AdminAuthRequest): string | null {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      const [first] = forwardedFor.split(',');
      return first?.trim() ?? null;
    }

    return request.ip ?? null;
  }

  private extractUserAgent(request: AdminAuthRequest): string | null {
    const rawHeader = request.headers['user-agent'];
    if (typeof rawHeader !== 'string') {
      return null;
    }

    const trimmed = rawHeader.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 512) : null;
  }
}
