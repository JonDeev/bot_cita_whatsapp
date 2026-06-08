import { formatDateTime } from '../../../shared/intl/date';
import type { ReminderRuntimeSettingHistoryItem } from '../reminder-settings.types';

interface ReminderSettingsHistoryTableProps {
  items: ReminderRuntimeSettingHistoryItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function formatActorLabel(item: ReminderRuntimeSettingHistoryItem) {
  if (item.actor.displayName) {
    return item.actor.displayName;
  }

  if (item.actor.username) {
    return item.actor.username;
  }

  if (item.actor.adminUserId) {
    return `Administrador #${item.actor.adminUserId}`;
  }

  return 'Sistema';
}

export function ReminderSettingsHistoryTable({
  items,
  isLoading = false,
  isError = false,
}: ReminderSettingsHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <p className="text-sm text-[var(--muted)]">Cargando historial reciente...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <p className="text-sm font-semibold text-rose-700">
          No fue posible cargar el historial reciente.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Reintenta en unos segundos.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
        <p className="text-sm text-[var(--muted)]">No hay cambios recientes para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Evento</th>
              <th className="px-3 py-3">Seccion</th>
              <th className="px-3 py-3">Autor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-b border-slate-100 last:border-b-0" key={item.id}>
                <td className="px-3 py-3 text-sm text-[var(--muted)]">
                  {formatDateTime(item.occurredAtIso)}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-[var(--text)]">{item.changeType}</p>
                  {item.reason ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.reason}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-sm text-[var(--muted)]">{item.section}</td>
                <td className="px-3 py-3 text-sm text-[var(--muted)]">
                  {formatActorLabel(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{item.changeType}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {item.section} · {formatActorLabel(item)}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">{formatDateTime(item.occurredAtIso)}</p>
            </div>
            {item.reason ? (
              <p className="mt-3 rounded-xl bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                {item.reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
