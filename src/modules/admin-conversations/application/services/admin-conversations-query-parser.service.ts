import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  ListAdminConversationMessagesQuery,
  ListAdminConversationsQuery,
} from '../../domain/ports/admin-conversations.repository';

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

const listConversationsSchema = z.object({
  page: pageSchema.optional(),
  pageSize: pageSizeSchema.optional(),
  status: z.string().trim().min(1).max(32).optional(),
  phone: z.string().trim().min(3).max(32).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const listMessagesSchema = z.object({
  page: pageSchema.optional(),
  pageSize: pageSizeSchema.optional(),
});

@Injectable()
export class AdminConversationsQueryParserService {
  parseListConversationsQuery(raw: unknown): ListAdminConversationsQuery {
    const parsed = listConversationsSchema.parse(raw);
    return {
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      status: parsed.status ?? null,
      participantPhoneContains: parsed.phone ?? null,
      fromIso: parsed.from ?? null,
      toIso: parsed.to ?? null,
    };
  }

  parseListMessagesQuery(
    conversationId: number,
    raw: unknown,
  ): ListAdminConversationMessagesQuery {
    const parsed = listMessagesSchema.parse(raw);
    return {
      conversationId,
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
    };
  }
}
