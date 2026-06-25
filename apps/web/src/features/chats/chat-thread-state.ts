import type { InfiniteData } from '@tanstack/react-query';
import type { AdminChatMessageItem, AdminPaginatedResult } from './chats.types';

type ChatMessagesPage = AdminPaginatedResult<AdminChatMessageItem>;

export type ChatThreadMutationType =
  | 'THREAD_RESET'
  | 'OLDER_MESSAGES_PREPENDED'
  | 'LATEST_MESSAGES_REFRESHED'
  | 'LIVE_MESSAGE_APPENDED';

export interface ChatThreadMutation {
  type: ChatThreadMutationType;
  key: string;
}

export interface ChatThreadSnapshot {
  readonly chatId: number;
  readonly latestPageSignature: string;
  readonly loadedPageCount: number;
  readonly messagesAsc: AdminChatMessageItem[];
  readonly messagesDesc: AdminChatMessageItem[];
  readonly newestMessageId: number | null;
  readonly oldestMessageId: number | null;
  readonly total: number;
  readonly versionKey: string;
}

function createMessageSignature(message: AdminChatMessageItem): string {
  return [
    message.id,
    message.direction,
    message.messageType,
    message.occurredAtIso,
    message.body ?? '',
  ].join(':');
}

function flattenMessagesDesc(
  pages: readonly ChatMessagesPage[],
): AdminChatMessageItem[] {
  const seenIds = new Set<number>();
  const messages: AdminChatMessageItem[] = [];

  pages.forEach((page) => {
    page.items.forEach((message) => {
      if (seenIds.has(message.id)) {
        return;
      }

      seenIds.add(message.id);
      messages.push(message);
    });
  });

  return messages;
}

function countUniqueMessages(pages: readonly ChatMessagesPage[]): number {
  return flattenMessagesDesc(pages).length;
}

function createLatestPageSignature(page: ChatMessagesPage | undefined): string {
  if (!page) {
    return 'empty';
  }

  return page.items.map(createMessageSignature).join('|');
}

function isOlderMessagesPrepended(
  previous: ChatThreadSnapshot,
  next: ChatThreadSnapshot,
): boolean {
  if (next.loadedPageCount <= previous.loadedPageCount) {
    return false;
  }

  return previous.messagesDesc.every(
    (message, index) => next.messagesDesc[index]?.id === message.id,
  );
}

function hasLiveMessagesAppended(
  previous: ChatThreadSnapshot,
  next: ChatThreadSnapshot,
): boolean {
  const previousIds = new Set(previous.messagesDesc.map((message) => message.id));

  return next.messagesDesc.some((message) => !previousIds.has(message.id));
}

export function buildChatThreadSnapshot(
  chatId: number,
  data: InfiniteData<ChatMessagesPage>,
): ChatThreadSnapshot {
  const messagesDesc = flattenMessagesDesc(data.pages);
  const messagesAsc = [...messagesDesc].reverse();
  const latestPage = data.pages[0];
  const newestMessageId = messagesDesc[0]?.id ?? null;
  const oldestMessageId = messagesDesc.at(-1)?.id ?? null;
  const total = latestPage?.total ?? messagesDesc.length;
  const latestPageSignature = createLatestPageSignature(latestPage);

  return {
    chatId,
    latestPageSignature,
    loadedPageCount: data.pages.length,
    messagesAsc,
    messagesDesc,
    newestMessageId,
    oldestMessageId,
    total,
    versionKey: [
      chatId,
      data.pages.length,
      total,
      newestMessageId ?? 'none',
      oldestMessageId ?? 'none',
      latestPageSignature,
    ].join(':'),
  };
}

export function resolveChatThreadMutation(
  previous: ChatThreadSnapshot | null,
  next: ChatThreadSnapshot | null,
): ChatThreadMutation | null {
  if (!next) {
    return null;
  }

  if (!previous || previous.chatId !== next.chatId) {
    return {
      type: 'THREAD_RESET',
      key: `THREAD_RESET:${next.versionKey}`,
    };
  }

  if (isOlderMessagesPrepended(previous, next)) {
    return {
      type: 'OLDER_MESSAGES_PREPENDED',
      key: `OLDER_MESSAGES_PREPENDED:${next.versionKey}`,
    };
  }

  if (hasLiveMessagesAppended(previous, next)) {
    return {
      type: 'LIVE_MESSAGE_APPENDED',
      key: `LIVE_MESSAGE_APPENDED:${next.versionKey}`,
    };
  }

  if (
    previous.latestPageSignature !== next.latestPageSignature ||
    previous.total !== next.total
  ) {
    return {
      type: 'LATEST_MESSAGES_REFRESHED',
      key: `LATEST_MESSAGES_REFRESHED:${next.versionKey}`,
    };
  }

  return null;
}

export function getNextChatMessagesPageParam(
  lastPage: ChatMessagesPage,
  allPages: readonly ChatMessagesPage[],
): number | undefined {
  return countUniqueMessages(allPages) < lastPage.total
    ? lastPage.page + 1
    : undefined;
}
