import { useQuery } from '@tanstack/react-query';
import { getConversationDetail, getConversationMessages, getConversations } from './conversations.api';
import type {
  ListConversationMessagesParams,
  ListConversationsParams,
} from './conversations.types';

export const conversationsQueryKey = ['admin', 'conversations'] as const;

export function useConversationsQuery(params: ListConversationsParams) {
  return useQuery({
    queryKey: [...conversationsQueryKey, 'list', params],
    queryFn: () => getConversations(params),
    placeholderData: (previous) => previous,
  });
}

export function useConversationDetailQuery(conversationId: number) {
  return useQuery({
    queryKey: [...conversationsQueryKey, 'detail', conversationId],
    queryFn: () => getConversationDetail(conversationId),
    enabled: Number.isFinite(conversationId) && conversationId > 0,
  });
}

export function useConversationMessagesQuery(
  conversationId: number,
  params: ListConversationMessagesParams,
) {
  return useQuery({
    queryKey: [...conversationsQueryKey, 'messages', conversationId, params],
    queryFn: () => getConversationMessages(conversationId, params),
    placeholderData: (previous) => previous,
    enabled: Number.isFinite(conversationId) && conversationId > 0,
  });
}
