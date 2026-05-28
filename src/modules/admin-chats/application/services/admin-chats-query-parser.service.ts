import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  ListAdminChatMessagesQuery,
  ListAdminChatsQuery,
} from '../../domain/ports/admin-chats.repository';

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

const listChatsSchema = z.object({
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
export class AdminChatsQueryParserService {
  parseListChatsQuery(raw: unknown): ListAdminChatsQuery {
    const parsed = listChatsSchema.parse(raw);
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
  ): ListAdminChatMessagesQuery {
    const parsed = listMessagesSchema.parse(raw);
    return {
      conversationId,
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
    };
  }
}
