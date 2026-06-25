import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getChatDetail, getChatMessages, getChats } from './chats.api';
import type { ListChatMessagesParams, ListChatsParams } from './chats.types';
import {
  buildChatThreadSnapshot,
  getNextChatMessagesPageParam,
  resolveChatThreadMutation,
  type ChatThreadMutation,
  type ChatThreadSnapshot,
} from './chat-thread-state';

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

interface UseChatThreadQueryResult {
  hasMoreMessages: boolean;
  isError: boolean;
  isLoadingInitial: boolean;
  isLoadingOlderMessages: boolean;
  loadOlderMessages: () => void;
  messages: ChatThreadSnapshot['messagesAsc'];
  mutation: ChatThreadMutation | null;
}

export function useChatThreadQuery(
  chatId: number,
  pageSize: number,
): UseChatThreadQueryResult {
  const isEnabled = Number.isFinite(chatId) && chatId > 0;
  const previousSnapshotRef = useRef<ChatThreadSnapshot | null>(null);

  const query = useInfiniteQuery({
    queryKey: [...chatsQueryKey, 'messages', chatId, 'thread', pageSize],
    queryFn: ({ pageParam }) =>
      getChatMessages(chatId, {
        page: pageParam,
        pageSize,
      }),
    enabled: isEnabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      getNextChatMessagesPageParam(lastPage, allPages),
  });

  const snapshot = useMemo(
    () =>
      query.data && isEnabled ? buildChatThreadSnapshot(chatId, query.data) : null,
    [chatId, isEnabled, query.data],
  );

  const mutation = useMemo(
    () => resolveChatThreadMutation(previousSnapshotRef.current, snapshot),
    [snapshot],
  );

  useEffect(() => {
    if (!isEnabled) {
      previousSnapshotRef.current = null;
      return;
    }

    if (snapshot) {
      previousSnapshotRef.current = snapshot;
    }
  }, [isEnabled, snapshot]);

  const hasMoreMessages = useMemo(() => {
    if (!snapshot) {
      return false;
    }

    return snapshot.messagesDesc.length > 0 && snapshot.messagesDesc.length < snapshot.total;
  }, [snapshot]);

  const loadOlderMessages = () => {
    if (!query.hasNextPage || query.isFetchingNextPage) {
      return;
    }

    void query.fetchNextPage();
  };

  return {
    hasMoreMessages,
    isError: query.isError,
    isLoadingInitial: query.isLoading,
    isLoadingOlderMessages: query.isFetchingNextPage,
    loadOlderMessages,
    messages: snapshot?.messagesAsc ?? [],
    mutation,
  };
}
