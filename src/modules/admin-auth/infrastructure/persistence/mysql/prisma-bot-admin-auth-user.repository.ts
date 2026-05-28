import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { AdminAuthUserRecord } from '../../../domain/admin-auth.types';
import type { AdminAuthUserRepository } from '../../../domain/ports/admin-auth-user.repository';

@Injectable()
export class PrismaBotAdminAuthUserRepository implements AdminAuthUserRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async findByEmail(email: string): Promise<AdminAuthUserRecord | null> {
    const user = await this.prismaBot.botAdminUser.findUnique({
      where: { email },
    });

    return user ? this.map(user) : null;
  }

  async findByUsername(username: string): Promise<AdminAuthUserRecord | null> {
    const user = await this.prismaBot.botAdminUser.findUnique({
      where: { username },
    });

    return user ? this.map(user) : null;
  }

  private map(user: {
    id: number;
    email: string;
    username: string;
    displayName: string;
    passwordHash: string;
    role: string;
    status: string;
  }): AdminAuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      role: user.role as AdminAuthUserRecord['role'],
      status: user.status as AdminAuthUserRecord['status'],
    };
  }
}
