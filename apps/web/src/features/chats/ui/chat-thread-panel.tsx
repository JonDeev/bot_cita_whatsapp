import type { Ref, UIEventHandler } from 'react';
import type { AdminChatDetail, AdminChatMessageItem } from '../chats.types';
import {
  formatConversationStateLabel,
  formatConversationStatusLabel,
} from '../../../shared/intl/admin-labels';
import { StateMessage } from '../../../shared/ui/state-messages';
import { ChatMessageBubble } from './chat-message-bubble';

interface ChatThreadPanelProps {
  detail: AdminChatDetail | null;
  messages: AdminChatMessageItem[];
  isLoadingDetail: boolean;
  isLoadingMessages: boolean;
  isErrorDetail: boolean;
  isErrorMessages: boolean;
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => void;
  isLoadingOlderMessages: boolean;
  canViewTechnicalDetails: boolean;
  messageViewportRef: Ref<HTMLDivElement>;
  onMessageViewportScroll: UIEventHandler<HTMLDivElement>;
  onJumpToLatest: () => void;
  showJumpToLatest: boolean;
}

export function ChatThreadPanel({
  detail,
  messages,
  isLoadingDetail,
  isLoadingMessages,
  isErrorDetail,
  isErrorMessages,
  hasMoreMessages,
  onLoadOlderMessages,
  isLoadingOlderMessages,
  canViewTechnicalDetails,
  messageViewportRef,
  onMessageViewportScroll,
  onJumpToLatest,
  showJumpToLatest,
}: ChatThreadPanelProps) {
  if (!detail && !isLoadingDetail) {
    return (
      <StateMessage
        title="Selecciona un chat"
        description="Elige una conversacion en la columna izquierda para ver su historial."
      />
    );
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">
          {detail?.participantPhone ?? 'Cargando...'}
        </h2>
        {detail ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatConversationStatusLabel(detail.status)} ·{' '}
            {formatConversationStateLabel(detail.state)}
          </p>
        ) : null}
      </header>

      <div
        ref={messageViewportRef}
        onScroll={onMessageViewportScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        {isLoadingDetail || isLoadingMessages ? (
          <StateMessage title="Cargando mensajes..." />
        ) : null}
        {isErrorDetail || isErrorMessages ? (
          <StateMessage
            title="No fue posible cargar el chat."
            description="Reintenta en unos segundos."
            tone="danger"
          />
        ) : null}
        {!isLoadingMessages && !isErrorMessages ? (
          <ul className="space-y-3">
            {hasMoreMessages ? (
              <li className="flex justify-center">
                <button
                  type="button"
                  onClick={onLoadOlderMessages}
                  disabled={isLoadingOlderMessages}
                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingOlderMessages ? 'Cargando...' : 'Cargar mensajes anteriores'}
                </button>
              </li>
            ) : null}
            {messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                canViewTechnicalDetails={canViewTechnicalDetails}
              />
            ))}
            {messages.length === 0 ? (
              <li>
                <StateMessage title="Este chat no tiene mensajes visibles." />
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {showJumpToLatest ? (
        <div className="pointer-events-none absolute bottom-4 right-4">
          <button
            type="button"
            onClick={onJumpToLatest}
            aria-label="Ir al ultimo mensaje"
            className="pointer-events-auto rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"
          >
            Ir al ultimo mensaje
          </button>
        </div>
      ) : null}
    </section>
  );
}
