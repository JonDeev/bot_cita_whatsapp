import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@whatsapp-bot/shared';
import type {
  AdminConversationDetail,
  AdminConversationListItem,
  AdminConversationMessageItem,
  PaginatedResult,
} from '../../domain/admin-conversations.types';

export interface AdminConversationListResponseItem extends Omit<
  AdminConversationListItem,
  'participantPhone' | 'lastMessageBody'
> {
  participantPhoneMasked: string;
  lastMessageBody: string | null;
}

export interface AdminConversationDetailResponse extends Omit<
  AdminConversationDetail,
  'participantPhone'
> {
  participantPhoneMasked: string;
}

export interface AdminConversationMessageResponseItem extends Omit<
  AdminConversationMessageItem,
  'payload'
> {
  payload: unknown;
}

@Injectable()
export class AdminConversationsMaskingService {
  mapConversationList(
    role: AdminRole,
    result: PaginatedResult<AdminConversationListItem>,
  ): PaginatedResult<AdminConversationListResponseItem> {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        participantPhoneMasked: this.maskPhone(item.participantPhone),
        lastMessageBody:
          role === 'ADMIN'
            ? item.lastMessageBody
            : this.maskText(item.lastMessageBody),
      })),
    };
  }

  mapConversationDetail(
    role: AdminRole,
    detail: AdminConversationDetail,
  ): AdminConversationDetailResponse {
    return {
      ...detail,
      conversationKey: role === 'ADMIN' ? detail.conversationKey : 'RESTRICTED',
      participantPhoneMasked: this.maskPhone(detail.participantPhone),
    };
  }

  mapConversationMessages(
    role: AdminRole,
    result: PaginatedResult<AdminConversationMessageItem>,
  ): PaginatedResult<AdminConversationMessageResponseItem> {
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        payload: role === 'ADMIN' ? item.payload : null,
        body: role === 'ADMIN' ? item.body : this.maskText(item.body),
      })),
    };
  }

  private maskPhone(value: string): string {
    const digits = value.replace(/\D+/g, '');
    if (digits.length <= 4) {
      return '****';
    }

    const visible = digits.slice(-4);
    return `***${visible}`;
  }

  private maskText(value: string | null): string | null {
    if (!value) {
      return value;
    }

    if (value.length <= 6) {
      return '******';
    }

    return `${value.slice(0, 2)}******`;
  }
}
