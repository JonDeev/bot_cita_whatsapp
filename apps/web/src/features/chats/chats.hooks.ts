import { useQuery } from '@tanstack/react-query';
import { getChatDetail, getChatMessages, getChats } from './chats.api';
import type { ListChatMessagesParams, ListChatsParams } from './chats.types';

export const chatsQueryKey = ['admin', 'chats'] as const;

export function useChatsQuery(params: ListChatsParams) {
  return useQuery({
    queryKey: [...chatsQueryKey, 'list', params],
    queryFn: () => getChats(params),
    placeholderData: (previous) => previous,
  });
}

export function useChatDetailQuery(chatId: number) {
  return useQuery({
    queryKey: [...chatsQueryKey, 'detail', chatId],
    queryFn: () => getChatDetail(chatId),
    enabled: Number.isFinite(chatId) && chatId > 0,
  });
}

export function useChatMessagesQuery(
  chatId: number,
  params: ListChatMessagesParams,
) {
  return useQuery({
    queryKey: [...chatsQueryKey, 'messages', chatId, params],
    queryFn: () => getChatMessages(chatId, params),
    placeholderData: (previous) => previous,
    enabled: Number.isFinite(chatId) && chatId > 0,
  });
}
