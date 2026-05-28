import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AdminSessionContext,
  CreateAdminSessionInput,
} from '../../../domain/admin-auth.types';
import type { AdminAuthSessionRepository } from '../../../domain/ports/admin-auth-session.repository';

@Injectable()
export class PrismaBotAdminAuthSessionRepository
  implements AdminAuthSessionRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async create(input: CreateAdminSessionInput): Promise<number> {
    const created = await this.prismaBot.botAdminSession.create({
      data: {
        userId: input.userId,
        sessionTokenHash: input.sessionTokenHash,
        csrfTokenHash: input.csrfTokenHash,
        ipHash: input.ipHash,
        userAgent: input.userAgent,
        expiresAt: new Date(input.expiresAtIso),
      },
      select: { id: true },
    });

    return created.id;
  }

  async findActiveByTokenHash(
    sessionTokenHash: string,
    nowIso: string,
  ): Promise<AdminSessionContext | null> {
    const found = await this.prismaBot.botAdminSession.findFirst({
      where: {
        sessionTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date(nowIso) },
      },
      include: {
        user: true,
      },
    });

    if (!found) {
      return null;
    }

    return {
      session: {
        id: found.id,
        userId: found.userId,
        sessionTokenHash: found.sessionTokenHash,
        csrfTokenHash: found.csrfTokenHash,
        ipHash: found.ipHash,
        userAgent: found.userAgent,
        lastSeenAt: found.lastSeenAt?.toISOString() ?? null,
        expiresAt: found.expiresAt.toISOString(),
        revokedAt: found.revokedAt?.toISOString() ?? null,
      },
      user: {
        id: found.user.id,
        email: found.user.email,
        username: found.user.username,
        displayName: found.user.displayName,
        role: found.user.role as AdminSessionContext['user']['role'],
        status: found.user.status as AdminSessionContext['user']['status'],
      },
    };
  }

  async updateCsrfTokenHash(sessionId: number, csrfTokenHash: string): Promise<void> {
    await this.prismaBot.botAdminSession.update({
      where: { id: sessionId },
      data: { csrfTokenHash },
    });
  }

  async revokeByTokenHash(
    sessionTokenHash: string,
    revokedAtIso: string,
  ): Promise<void> {
    await this.prismaBot.botAdminSession.updateMany({
      where: {
        sessionTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(revokedAtIso),
      },
    });
  }

  async touchLastSeen(sessionId: number, seenAtIso: string): Promise<void> {
    await this.prismaBot.botAdminSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date(seenAtIso) },
    });
  }
}
