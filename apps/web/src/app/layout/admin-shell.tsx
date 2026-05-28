import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessagesSquare, MessageSquare, Bell, ClipboardList, ScrollText, UserCircle, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAdminMe, useLogoutAdmin } from '../../features/auth/auth.hooks';
import { ApiError } from '../../shared/http/api-client';
import { useAdminStream } from '../../features/overview/use-admin-stream';
import { clearAdminClientState } from '../../features/auth/admin-session-client-state';
import { formatAdminRoleLabel } from '../../shared/intl/admin-labels';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { to: '/admin/dashboard', label: 'Panel', icon: LayoutDashboard },
  { to: '/admin/chats', label: 'Chats', icon: MessagesSquare },
  { to: '/admin/conversations', label: 'Conversaciones', icon: MessageSquare },
  { to: '/admin/reminders', label: 'Recordatorios', icon: Bell },
  { to: '/admin/surveys', label: 'Encuestas', icon: ClipboardList },
  { to: '/admin/logs', label: 'Registros', icon: ScrollText },
  { to: '/admin/profile', label: 'Perfil', icon: UserCircle },
];

const streamStatusLabel: Record<'connecting' | 'connected' | 'disconnected', string> = {
  connecting: 'Conectando',
  connected: 'Conectado',
  disconnected: 'Desconectado',
};

export function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQuery = useAdminMe();
  const logoutMutation = useLogoutAdmin();
  const stream = useAdminStream();
  const isChatsRoute = location.pathname.startsWith('/admin/chats');

  const onLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'No fue posible cerrar sesion';
      toast.error(message);
    } finally {
      clearAdminClientState(queryClient);
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <div
      className={`grid md:grid-cols-[260px_1fr] ${
        isChatsRoute ? 'h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      <aside className="border-r border-[var(--border)] bg-[var(--panel)] p-4">
        <Link
          className="block rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-amber-950"
          to="/admin/dashboard"
          aria-label="Ir al panel principal de observabilidad"
        >
          <p className="text-sm font-semibold tracking-wide">Panel Admin SISM</p>
          <p className="mt-1 text-xs text-amber-800">Observabilidad operativa del bot</p>
        </Link>
        <nav className="mt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-teal-50 text-teal-900'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className={`flex min-h-0 flex-col ${isChatsRoute ? 'h-screen' : 'min-h-screen'}`}>
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-5 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Entorno</p>
            <p className="text-sm font-medium">Produccion</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Transmision:{' '}
              <span
                className={
                  stream.status === 'connected'
                    ? 'font-semibold text-emerald-700'
                    : stream.status === 'connecting'
                      ? 'font-semibold text-amber-700'
                    : 'font-semibold text-rose-700'
                }
              >
                {streamStatusLabel[stream.status]}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-semibold">{meQuery.data?.displayName ?? 'Cargando...'}</p>
              <p className="text-xs text-[var(--muted)]">
                {meQuery.data?.role ? formatAdminRoleLabel(meQuery.data.role) : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-slate-100"
            >
              <LogOut size={14} />
              Salir
            </button>
          </div>
        </header>

        <main
          className={`flex-1 min-h-0 ${
            isChatsRoute ? 'overflow-hidden p-0' : 'p-5'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
