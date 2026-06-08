import { NavLink } from 'react-router-dom';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useAdminAccess } from '../features/auth/use-admin-access';
import { formatAdminRoleLabel } from '../shared/intl/admin-labels';
import { reminderSettingsGuideSections } from '../features/reminder-settings-guide/reminder-settings-guide.content';
import { ReminderSettingsGuideNav } from '../features/reminder-settings-guide/ui/reminder-settings-guide-nav';
import { ReminderSettingsGuideSection } from '../features/reminder-settings-guide/ui/reminder-settings-guide-section';

const remindersAreaNavItems = [
  { to: '/admin/reminders', label: 'Operacion', end: true },
  { to: '/admin/reminders/settings', label: 'Configuracion', end: false },
  { to: '/admin/reminders/settings/guide', label: 'Guia de uso', end: false },
] as const;

export function ReminderSettingsGuidePage() {
  const access = useAdminAccess();

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Recordatorios
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Guia de uso</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Manual operativo para entender como leer la configuracion, activar el
              comportamiento correcto y auditar cambios sin ambiguedad.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--muted)]">
            Rol visible:{' '}
            <span className="font-semibold text-[var(--text)]">
              {access.role ? formatAdminRoleLabel(access.role) : '-'}
            </span>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Navegacion de recordatorios">
          {remindersAreaNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-teal-200 bg-teal-50 text-teal-900'
                    : 'border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Inicio rapido
              </h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text)]">
              <li>1. Usa Operacion para revisar el estado diario.</li>
              <li>2. Usa Configuracion para revisar valores y diferencias.</li>
              <li>3. Usa esta guia para decidir cambios seguros.</li>
            </ul>
          </article>

          <ReminderSettingsGuideNav sections={reminderSettingsGuideSections} />
        </aside>

        <main className="space-y-4">
          <article className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Lectura segura
              </p>
              <p className="mt-2 text-sm text-[var(--text)]">
                Esta pagina explica el significado operativo de los campos sin exigir conocimiento
                tecnico profundo.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Accion recomendada
              </p>
              <p className="mt-2 text-sm text-[var(--text)]">
                Lee primero el estado efectivo y luego valida el historial antes de mover
                cualquier parametro.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Navegacion rapida
              </p>
              <p className="mt-2 text-sm text-[var(--text)]">
                Usa los anclajes laterales para saltar entre secciones sin perder contexto.
              </p>
            </div>
          </article>

          <div className="space-y-4">
            {reminderSettingsGuideSections.map((section) => (
              <ReminderSettingsGuideSection key={section.id} section={section} />
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ExternalLink size={16} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Recordatorio operativo
              </h2>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Si una seccion no coincide con lo observado en Operacion o Configuracion, revisa
              primero el historial reciente y confirma la version activa.
            </p>
          </div>
        </main>
      </div>
    </section>
  );
}
