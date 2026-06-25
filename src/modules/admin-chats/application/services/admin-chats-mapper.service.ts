import { Injectable } from '@nestjs/common';
import type {
  AdminChatDetailDto,
  AdminChatListItemDto,
  AdminChatMessageItemDto,
  AdminPaginatedResultDto,
} from '@whatsapp-bot/shared';
import type {
  AdminChatDetailRecord,
  AdminChatListItemRecord,
  AdminChatMessageRecord,
  PaginatedResult,
} from '../../domain/admin-chats.types';

@Injectable()
export class AdminChatsMapperService {
  mapChatList(
    result: PaginatedResult<AdminChatListItemRecord>,
  ): AdminPaginatedResultDto<AdminChatListItemDto> {
    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        participantPhone: item.participantPhone,
        state: item.state,
        status: item.status,
        updatedAtIso: item.updatedAtIso,
        lastMessageDirection: item.lastMessageDirection,
        lastMessageType: item.lastMessageType,
        lastMessagePreview: item.lastMessageBody,
        lastMessageOccurredAtIso: item.lastMessageOccurredAtIso,
      })),
    };
  }

  mapChatDetail(detail: AdminChatDetailRecord): AdminChatDetailDto {
    return {
      id: detail.id,
      conversationKey: detail.conversationKey,
      channel: detail.channel,
      state: detail.state,
      status: detail.status,
      lastInboundAtIso: detail.lastInboundAtIso,
      idleExpiresAtIso: detail.idleExpiresAtIso,
      createdAtIso: detail.createdAtIso,
      updatedAtIso: detail.updatedAtIso,
      participantPhone: detail.participantPhone,
    };
  }

  mapChatMessages(
    result: PaginatedResult<AdminChatMessageRecord>,
  ): AdminPaginatedResultDto<AdminChatMessageItemDto> {
    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        direction: item.direction,
        whatsappMessageId: item.whatsappMessageId,
        messageType: item.messageType,
        body: item.body,
        payload: item.payload,
        occurredAtIso: item.occurredAtIso,
      })),
    };
  }
}
