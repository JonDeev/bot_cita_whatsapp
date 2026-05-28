import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AdminAuthAuditRepository,
  CreateAdminAuditEventInput,
} from '../../../domain/ports/admin-auth-audit.repository';

@Injectable()
export class PrismaBotAdminAuthAuditRepository
  implements AdminAuthAuditRepository
{
  constructor(private readonly prismaBot: PrismaBotService) {}

  async create(event: CreateAdminAuditEventInput): Promise<void> {
    await this.prismaBot.botAdminAuditEvent.create({
      data: {
        adminUserId: event.adminUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: event.metadata,
        ipHash: event.ipHash,
        occurredAt: new Date(event.occurredAtIso),
      },
    });
  }
}
