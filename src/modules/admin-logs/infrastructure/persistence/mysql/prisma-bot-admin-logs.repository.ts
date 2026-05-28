import { Injectable } from '@nestjs/common';
import type {
  BotOutboxMessage,
  BotWebhookEvent,
  Prisma,
} from '@whatsapp-bot/prisma-client';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type {
  AdminAuditLogItem,
  AdminFailureLogItem,
  AdminFailureSource,
} from '../../../domain/admin-logs.types';
import type {
  AdminLogsRepository,
  ListAdminAuditQuery,
  ListAdminEventsQuery,
  ListAdminFailuresQuery,
} from '../../../domain/ports/admin-logs.repository';

@Injectable()
export class PrismaBotAdminLogsRepository implements AdminLogsRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async listEvents(query: ListAdminEventsQuery) {
    const where: Prisma.BotAuditEventWhereInput = {};
    if (query.action) {
      where.action = query.action;
    }
    const occurredAtRange = this.buildDateRangeFilter(query.fromIso, query.toIso);
    if (occurredAtRange) {
      where.occurredAt = occurredAtRange;
    }

    const skip = (query.page - 1) * query.pageSize;
    const [total, items] = await Promise.all([
      this.prismaBot.botAuditEvent.count({ where }),
      this.prismaBot.botAuditEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        conversationId: item.conversationId,
        conversationKey: item.conversationKey,
        occurredAtIso: item.occurredAt.toISOString(),
        metadata: item.metadata,
      })),
    };
  }

  async listFailures(query: ListAdminFailuresQuery) {
    if (query.source) {
      return this.listSingleSourceFailures(
        query.source,
        query.page,
        query.pageSize,
        query.fromIso,
        query.toIso,
      );
    }

    const pageTake = query.page * query.pageSize;
    const outboxWhere: Prisma.BotOutboxMessageWhereInput = { status: 'FAILED' };
    const webhookWhere: Prisma.BotWebhookEventWhereInput = {
      processingStatus: 'FAILED',
    };
    const updatedAtRange = this.buildDateRangeFilter(query.fromIso, query.toIso);
    if (updatedAtRange) {
      outboxWhere.updatedAt = updatedAtRange;
      webhookWhere.updatedAt = updatedAtRange;
    }

    const [outboxCount, webhookCount, outboxItems, webhookItems] = await Promise.all([
      this.prismaBot.botOutboxMessage.count({
        where: outboxWhere,
      }),
      this.prismaBot.botWebhookEvent.count({
        where: webhookWhere,
      }),
      this.prismaBot.botOutboxMessage.findMany({
        where: outboxWhere,
        orderBy: { updatedAt: 'desc' },
        take: pageTake,
      }),
      this.prismaBot.botWebhookEvent.findMany({
        where: webhookWhere,
        orderBy: { updatedAt: 'desc' },
        take: pageTake,
      }),
    ]);

    const merged = [
      ...outboxItems.map((item) => this.mapOutboxFailure(item)),
      ...webhookItems.map((item) => this.mapWebhookFailure(item)),
    ].sort((left, right) => right.occurredAtIso.localeCompare(left.occurredAtIso));

    const offset = (query.page - 1) * query.pageSize;
    return {
      total: outboxCount + webhookCount,
      page: query.page,
      pageSize: query.pageSize,
      items: merged.slice(offset, offset + query.pageSize),
    };
  }

  async listAudit(query: ListAdminAuditQuery) {
    const where: Prisma.BotAdminAuditEventWhereInput = {};
    if (query.action) {
      where.action = query.action;
    }
    if (query.adminUserId) {
      where.adminUserId = query.adminUserId;
    }
    const occurredAtRange = this.buildDateRangeFilter(query.fromIso, query.toIso);
    if (occurredAtRange) {
      where.occurredAt = occurredAtRange;
    }

    const skip = (query.page - 1) * query.pageSize;
    const [total, items] = await Promise.all([
      this.prismaBot.botAdminAuditEvent.count({ where }),
      this.prismaBot.botAdminAuditEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: query.pageSize,
        include: {
          adminUser: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: items.map((item): AdminAuditLogItem => ({
        id: item.id,
        adminUserId: item.adminUserId,
        adminUsername: item.adminUser?.username ?? null,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        occurredAtIso: item.occurredAt.toISOString(),
        metadata: item.metadata,
      })),
    };
  }

  private async listSingleSourceFailures(
    source: AdminFailureSource,
    page: number,
    pageSize: number,
    fromIso: string | null,
    toIso: string | null,
  ) {
    const skip = (page - 1) * pageSize;

    if (source === 'OUTBOX') {
      const where: Prisma.BotOutboxMessageWhereInput = { status: 'FAILED' };
      const updatedAtRange = this.buildDateRangeFilter(fromIso, toIso);
      if (updatedAtRange) {
        where.updatedAt = updatedAtRange;
      }
      const [total, items] = await Promise.all([
        this.prismaBot.botOutboxMessage.count({ where }),
        this.prismaBot.botOutboxMessage.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: pageSize,
        }),
      ]);

      return {
        total,
        page,
        pageSize,
        items: items.map((item) => this.mapOutboxFailure(item)),
      };
    }

    const where: Prisma.BotWebhookEventWhereInput = {
      processingStatus: 'FAILED',
    };
    const updatedAtRange = this.buildDateRangeFilter(fromIso, toIso);
    if (updatedAtRange) {
      where.updatedAt = updatedAtRange;
    }
    const [total, items] = await Promise.all([
      this.prismaBot.botWebhookEvent.count({ where }),
      this.prismaBot.botWebhookEvent.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: items.map((item) => this.mapWebhookFailure(item)),
    };
  }

  private mapOutboxFailure(item: BotOutboxMessage): AdminFailureLogItem {
    return {
      source: 'OUTBOX',
      id: item.id,
      status: item.status,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      occurredAtIso: (item.failedAt ?? item.updatedAt).toISOString(),
      conversationId: item.conversationId,
    };
  }

  private mapWebhookFailure(item: BotWebhookEvent): AdminFailureLogItem {
    return {
      source: 'WEBHOOK',
      id: item.id,
      status: item.processingStatus,
      errorCode: item.rejectionReason,
      errorMessage: item.errorMessage,
      occurredAtIso: (item.processedAt ?? item.updatedAt).toISOString(),
      conversationId: null,
    };
  }

  private buildDateRangeFilter(
    fromIso: string | null,
    toIso: string | null,
  ): { gte?: Date; lte?: Date } | null {
    if (!fromIso && !toIso) {
      return null;
    }

    const range: { gte?: Date; lte?: Date } = {};

    if (fromIso) {
      range.gte = new Date(fromIso);
    }

    if (toIso) {
      range.lte = new Date(toIso);
    }

    return range;
  }
}
