import { useEffect, useMemo, useState } from 'react';
import { useAdminAccess } from '../features/auth/use-admin-access';
import type { AdminChatListItem, AdminChatMessageItem } from '../features/chats/chats.types';
import {
  useChatDetailQuery,
  useChatMessagesQuery,
  useChatsQuery,
} from '../features/chats/chats.hooks';
import { ChatListPanel } from '../features/chats/ui/chat-list-panel';
import { ChatThreadPanel } from '../features/chats/ui/chat-thread-panel';

const LIST_PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

export function ChatsPage() {
  const [listPage, setListPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [chatItems, setChatItems] = useState<AdminChatListItem[]>([]);
  const [threadItemsDesc, setThreadItemsDesc] = useState<AdminChatMessageItem[]>([]);
  const access = useAdminAccess();

  const listParams: {
    page: number;
    pageSize: number;
    phone?: string;
  } = {
    page: listPage,
    pageSize: LIST_PAGE_SIZE,
  };

  if (phoneFilter.length > 0) {
    listParams.phone = phoneFilter;
  }

  const chats = useChatsQuery(listParams);
  const detail = useChatDetailQuery(selectedChatId ?? NaN);
  const messages = useChatMessagesQuery(selectedChatId ?? NaN, {
    page: messagesPage,
    pageSize: MESSAGES_PAGE_SIZE,
  });

  useEffect(() => {
    if (!chats.data) {
      return;
    }

    if (listPage === 1) {
      setChatItems(chats.data.items);
      return;
    }

    setChatItems((current) => {
      const seen = new Set(current.map((item) => item.id));
      const next = [...current];
      chats.data.items.forEach((item) => {
        if (!seen.has(item.id)) {
          next.push(item);
        }
      });
      return next;
    });
  }, [chats.data, listPage]);

  useEffect(() => {
    if (chatItems.length === 0) {
      setSelectedChatId(null);
      setMessagesPage(1);
      setThreadItemsDesc([]);
      return;
    }

    if (
      selectedChatId == null ||
      !chatItems.some((chat) => chat.id === selectedChatId)
    ) {
      setSelectedChatId(chatItems[0]!.id);
      setMessagesPage(1);
      setThreadItemsDesc([]);
    }
  }, [chatItems, selectedChatId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPhoneFilter(searchInput.trim());
      setListPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (!messages.data) {
      return;
    }

    if (messagesPage === 1) {
      setThreadItemsDesc(messages.data.items);
      return;
    }

    setThreadItemsDesc((current) => {
      const seen = new Set(current.map((item) => item.id));
      const next = [...current];
      messages.data.items.forEach((item) => {
        if (!seen.has(item.id)) {
          next.push(item);
        }
      });
      return next;
    });
  }, [messages.data, messagesPage]);

  const orderedMessages = useMemo(
    () => [...threadItemsDesc].reverse(),
    [threadItemsDesc],
  );

  const hasMoreChats = useMemo(() => {
    const total = chats.data?.total ?? 0;
    return chatItems.length > 0 && chatItems.length < total;
  }, [chatItems.length, chats.data?.total]);

  const hasMoreMessages = useMemo(() => {
    const total = messages.data?.total ?? 0;
    return threadItemsDesc.length > 0 && threadItemsDesc.length < total;
  }, [messages.data?.total, threadItemsDesc.length]);

  return (
    <section className="h-full min-h-0 overflow-hidden p-5">
      <div className="grid h-full min-h-0 gap-4 overflow-hidden xl:grid-cols-[340px_1fr]">
        <div className="flex min-h-0 flex-col">
          <ChatListPanel
            chats={chatItems}
            selectedChatId={selectedChatId}
            onSelectChat={(chatId) => {
              setSelectedChatId(chatId);
              setMessagesPage(1);
              setThreadItemsDesc([]);
            }}
            searchValue={searchInput}
            isSearchOpen={isSearchOpen}
            onSearchChange={setSearchInput}
            onToggleSearch={() => setIsSearchOpen((current) => !current)}
            onClearSearch={() => {
              setSearchInput('');
              setPhoneFilter('');
              setListPage(1);
            }}
            hasMoreChats={hasMoreChats}
            onLoadMoreChats={() => setListPage((current) => current + 1)}
            isLoadingMoreChats={chats.isFetching && listPage > 1}
            isLoading={chats.isLoading}
            isError={chats.isError}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <ChatThreadPanel
            detail={detail.data ?? null}
            messages={orderedMessages}
            isLoadingDetail={detail.isLoading}
            isLoadingMessages={messages.isLoading && messagesPage === 1}
            isErrorDetail={detail.isError}
            isErrorMessages={messages.isError}
            hasMoreMessages={hasMoreMessages}
            onLoadOlderMessages={() => setMessagesPage((current) => current + 1)}
            isLoadingOlderMessages={messages.isFetching && messagesPage > 1}
            canViewTechnicalDetails={access.canViewTechnicalDetails}
          />
        </div>
      </div>
    </section>
  );
}
