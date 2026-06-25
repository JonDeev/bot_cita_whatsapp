import {
  buildChatThreadSnapshot,
  resolveChatThreadMutation,
} from '../src/features/chats/chat-thread-state';
import {
  getPreservedScrollTop,
  getScrollTopForLatest,
} from '../src/features/chats/chat-thread-viewport.logic';
import type {
  AdminChatMessageItem,
  AdminPaginatedResult,
} from '../src/features/chats/chats.types';
import type { InfiniteData } from '@tanstack/react-query';

function message(id: number): AdminChatMessageItem {
  return {
    id,
    body: `message-${id}`,
    direction: 'INBOUND',
    messageType: 'text',
    occurredAtIso: `2026-06-25T10:${String(id).padStart(2, '0')}:00.000Z`,
    payload: null,
    whatsappMessageId: `wamid-${id}`,
  };
}

function page(
  pageNumber: number,
  items: AdminChatMessageItem[],
  total: number,
): AdminPaginatedResult<AdminChatMessageItem> {
  return {
    items,
    page: pageNumber,
    pageSize: 50,
    total,
  };
}

function data(
  pages: AdminPaginatedResult<AdminChatMessageItem>[],
): InfiniteData<AdminPaginatedResult<AdminChatMessageItem>, number> {
  return {
    pages,
    pageParams: pages.map((entry) => entry.page),
  };
}

describe('chat thread flow', () => {
  it('keeps the latest message pinned and preserves position through older prepends', () => {
    const initial = buildChatThreadSnapshot(
      91,
      data([page(1, [message(5), message(4)], 4)]),
    );
    const resetMutation = resolveChatThreadMutation(null, initial);

    expect(resetMutation?.type).toBe('THREAD_RESET');
    expect(
      getScrollTopForLatest({
        clientHeight: 100,
        scrollHeight: 420,
        scrollTop: 0,
      }),
    ).toBe(320);

    const liveUpdate = buildChatThreadSnapshot(
      91,
      data([page(1, [message(6), message(5)], 5)]),
    );
    expect(resolveChatThreadMutation(initial, liveUpdate)?.type).toBe(
      'LIVE_MESSAGE_APPENDED',
    );

    const olderPageLoaded = buildChatThreadSnapshot(
      91,
      data([
        page(1, [message(6), message(5)], 5),
        page(2, [message(4), message(3)], 5),
      ]),
    );
    expect(resolveChatThreadMutation(liveUpdate, olderPageLoaded)?.type).toBe(
      'OLDER_MESSAGES_PREPENDED',
    );

    expect(
      getPreservedScrollTop({
        clientHeight: 100,
        previousScrollHeight: 420,
        previousScrollTop: 160,
        nextScrollHeight: 560,
      }),
    ).toBe(300);
  });
});
