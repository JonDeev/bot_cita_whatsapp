import { Search, X } from 'lucide-react';
import type { AdminChatListItem } from '../chats.types';
import {
  formatConversationStateLabel,
  formatConversationStatusLabel,
  formatMessageDirectionLabel,
} from '../../../shared/intl/admin-labels';
import { formatDateTime } from '../../../shared/intl/date';
import { StateMessage } from '../../../shared/ui/state-messages';

interface ChatListPanelProps {
  chats: AdminChatListItem[];
  selectedChatId: number | null;
  onSelectChat: (chatId: number) => void;
  searchValue: string;
  isSearchOpen: boolean;
  onSearchChange: (value: string) => void;
  onToggleSearch: () => void;
  onClearSearch: () => void;
  hasMoreChats: boolean;
  onLoadMoreChats: () => void;
  isLoadingMoreChats: boolean;
  isLoading: boolean;
  isError: boolean;
}

export function ChatListPanel({
  chats,
  selectedChatId,
  onSelectChat,
  searchValue,
  isSearchOpen,
  onSearchChange,
  onToggleSearch,
  onClearSearch,
  hasMoreChats,
  onLoadMoreChats,
  isLoadingMoreChats,
  isLoading,
  isError,
}: ChatListPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Chats</h2>
          <button
            type="button"
            onClick={onToggleSearch}
            aria-label="Buscar chats"
            className="rounded-lg border border-[var(--border)] p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <Search size={14} />
          </button>
        </div>
        {isSearchOpen ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por telefono"
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Limpiar busqueda"
              className="rounded-lg border border-[var(--border)] p-2 text-slate-600 hover:bg-slate-100"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </header>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? <StateMessage title="Cargando chats..." /> : null}
        {isError ? (
          <StateMessage
            title="No fue posible cargar chats."
            description="Reintenta en unos segundos."
            tone="danger"
          />
        ) : null}
        {!isLoading && !isError ? (
          <ul className="divide-y divide-slate-100">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full px-4 py-3 text-left transition ${
                    selectedChatId === chat.id
                      ? 'bg-teal-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{chat.participantPhone}</p>
                    <span className="text-[11px] text-[var(--muted)]">
                      {chat.lastMessageOccurredAtIso
                        ? formatDateTime(chat.lastMessageOccurredAtIso)
                        : formatDateTime(chat.updatedAtIso)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
                    {chat.lastMessageDirection
                      ? `${formatMessageDirectionLabel(chat.lastMessageDirection)}: `
                      : ''}
                    {chat.lastMessagePreview ?? 'Sin vista previa'}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {formatConversationStatusLabel(chat.status)} ·{' '}
                    {formatConversationStateLabel(chat.state)}
                  </p>
                </button>
              </li>
            ))}
            {chats.length === 0 ? (
              <li className="p-4">
                <StateMessage title="No hay chats para los filtros aplicados." />
              </li>
            ) : null}
            {chats.length > 0 && hasMoreChats ? (
              <li className="p-3">
                <button
                  type="button"
                  onClick={onLoadMoreChats}
                  disabled={isLoadingMoreChats}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMoreChats ? 'Cargando...' : 'Cargar mas chats'}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
