import type { AdminChatMessageItem } from '../chats.types';
import {
  formatMessageDirectionLabel,
  formatMessageTypeLabel,
} from '../../../shared/intl/admin-labels';
import { formatDateTime } from '../../../shared/intl/date';
import { safeJson } from '../../../shared/utils/safe-json';

interface ChatMessageBubbleProps {
  message: AdminChatMessageItem;
  canViewTechnicalDetails: boolean;
}

export function ChatMessageBubble({
  message,
  canViewTechnicalDetails,
}: ChatMessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND';

  return (
    <li className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <article
        className={`max-w-[80%] rounded-2xl border px-3 py-2 shadow-sm ${
          isOutbound
            ? 'border-teal-200 bg-teal-50 text-slate-900'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <p className="text-sm">{message.body ?? 'Mensaje sin contenido visible'}</p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          {formatMessageDirectionLabel(message.direction)} ·{' '}
          {formatMessageTypeLabel(message.messageType)} ·{' '}
          {formatDateTime(message.occurredAtIso)}
        </p>
        {canViewTechnicalDetails && message.payload ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-[var(--muted)]">
              Ver carga tecnica
            </summary>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">
              {safeJson(message.payload)}
            </pre>
          </details>
        ) : null}
      </article>
    </li>
  );
}
