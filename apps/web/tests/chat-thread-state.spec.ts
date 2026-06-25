import type { InfiniteData } from '@tanstack/react-query';
import {
  buildChatThreadSnapshot,
  getNextChatMessagesPageParam,
  resolveChatThreadMutation,
  type ChatThreadMutation,
} from '../src/features/chats/chat-thread-state';
import type {
  AdminChatMessageItem,
  AdminPaginatedResult,
} from '../src/features/chats/chats.types';

function createMessage(
  id: number,
  overrides: Partial<AdminChatMessageItem> = {},
): AdminChatMessageItem {
  return {
    id,
    body: `message-${id}`,
    direction: 'INBOUND',
    messageType: 'text',
    occurredAtIso: `2026-06-25T10:${String(id).padStart(2, '0')}:00.000Z`,
    payload: null,
    whatsappMessageId: `wamid-${id}`,
    ...overrides,
  };
}

function createPage(
  page: number,
  items: AdminChatMessageItem[],
  total = items.length,
): AdminPaginatedResult<AdminChatMessageItem> {
  return {
    items,
    page,
    pageSize: 50,
    total,
  };
}

function createInfiniteData(
  pages: AdminPaginatedResult<AdminChatMessageItem>[],
): InfiniteData<AdminPaginatedResult<AdminChatMessageItem>, number> {
  return {
    pages,
    pageParams: pages.map((page) => page.page),
  };
}

function expectMutation(
  previous: ReturnType<typeof buildChatThreadSnapshot> | null,
  next: ReturnType<typeof buildChatThreadSnapshot>,
  expected: ChatThreadMutation,
) {
  expect(resolveChatThreadMutation(previous, next)).toEqual(expected);
}

describe('chat thread state', () => {
  it('classifies the first loaded snapshot as THREAD_RESET', () => {
    const snapshot = buildChatThreadSnapshot(
      7,
      createInfiniteData([createPage(1, [createMessage(3), createMessage(2)], 2)]),
    );

    expectMutation(null, snapshot, {
      type: 'THREAD_RESET',
      key: `THREAD_RESET:${snapshot.versionKey}`,
    });
  });

  it('classifies older page loads as OLDER_MESSAGES_PREPENDED', () => {
    const previous = buildChatThreadSnapshot(
      7,
      createInfiniteData([createPage(1, [createMessage(5), createMessage(4)], 4)]),
    );
    const next = buildChatThreadSnapshot(
      7,
      createInfiniteData([
        createPage(1, [createMessage(5), createMessage(4)], 4),
        createPage(2, [createMessage(3), createMessage(2)], 4),
      ]),
    );

    expectMutation(previous, next, {
      type: 'OLDER_MESSAGES_PREPENDED',
      key: `OLDER_MESSAGES_PREPENDED:${next.versionKey}`,
    });
  });

  it('classifies newly arrived recent messages as LIVE_MESSAGE_APPENDED', () => {
    const previous = buildChatThreadSnapshot(
      7,
      createInfiniteData([createPage(1, [createMessage(5), createMessage(4)], 3)]),
    );
    const next = buildChatThreadSnapshot(
      7,
      createInfiniteData([createPage(1, [createMessage(6), createMessage(5)], 4)]),
    );

    expectMutation(previous, next, {
      type: 'LIVE_MESSAGE_APPENDED',
      key: `LIVE_MESSAGE_APPENDED:${next.versionKey}`,
    });
  });

  it('classifies same-id latest page refreshes as LATEST_MESSAGES_REFRESHED', () => {
    const previous = buildChatThreadSnapshot(
      7,
      createInfiniteData([createPage(1, [createMessage(5), createMessage(4)], 2)]),
    );
    const next = buildChatThreadSnapshot(
      7,
      createInfiniteData([
        createPage(
          1,
          [createMessage(5, { body: 'updated-body' }), createMessage(4)],
          2,
        ),
      ]),
    );

    expectMutation(previous, next, {
      type: 'LATEST_MESSAGES_REFRESHED',
      key: `LATEST_MESSAGES_REFRESHED:${next.versionKey}`,
    });
  });

  it('derives the next page param from the unique loaded message count', () => {
    const firstPage = createPage(1, [createMessage(5), createMessage(4)], 4);
    const secondPage = createPage(2, [createMessage(3), createMessage(2)], 4);

    expect(
      getNextChatMessagesPageParam(secondPage, [firstPage, secondPage]),
    ).toBeUndefined();
  });
});
