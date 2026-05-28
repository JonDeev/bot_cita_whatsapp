import { Injectable } from '@nestjs/common';
import type {
  AdminChatDetailDto,
  AdminChatListItemDto,
  AdminChatMessageItemDto,
  AdminPaginatedResultDto,
} from '@whatsapp-bot/shared';
import type {
  AdminConversationDetailResponse,
  AdminConversationListResponseItem,
  AdminConversationMessageResponseItem,
} from '../../../admin-conversations/application/services/admin-conversations-masking.service';
import type { PaginatedResult } from '../../../admin-conversations/domain/admin-conversations.types';

@Injectable()
export class AdminChatsMapperService {
  mapChatList(
    result: PaginatedResult<AdminConversationListResponseItem>,
  ): AdminPaginatedResultDto<AdminChatListItemDto> {
    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        participantPhoneMasked: item.participantPhoneMasked,
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

  mapChatDetail(detail: AdminConversationDetailResponse): AdminChatDetailDto {
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
      participantPhoneMasked: detail.participantPhoneMasked,
    };
  }

  mapChatMessages(
    result: PaginatedResult<AdminConversationMessageResponseItem>,
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
