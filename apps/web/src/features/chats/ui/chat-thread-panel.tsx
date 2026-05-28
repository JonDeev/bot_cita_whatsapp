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
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold">
          {detail?.participantPhoneMasked ?? 'Cargando...'}
        </h2>
        {detail ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatConversationStatusLabel(detail.status)} ·{' '}
            {formatConversationStateLabel(detail.state)}
          </p>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
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
    </section>
  );
}
