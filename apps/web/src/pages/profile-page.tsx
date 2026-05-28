import { useAdminMe } from '../features/auth/auth.hooks';
import {
  formatAdminRoleLabel,
  formatAdminUserStatusLabel,
} from '../shared/intl/admin-labels';
import { StateMessage } from '../shared/ui/state-messages';

export function ProfilePage() {
  const meQuery = useAdminMe();

  if (meQuery.isLoading) {
    return <StateMessage title="Cargando perfil..." />;
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <StateMessage
        title="No fue posible cargar el perfil."
        description="Valida tu sesion e intenta nuevamente."
        tone="danger"
      />
    );
  }

  const user = meQuery.data;

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Datos de la sesion administrativa actual.
        </p>
      </header>

      <article className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-sm md:grid-cols-2">
        <p className="text-sm">
          <span className="font-semibold">Nombre:</span> {user.displayName}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Usuario:</span> {user.username}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Correo:</span> {user.email}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Rol:</span> {formatAdminRoleLabel(user.role)}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Estado:</span>{' '}
          {formatAdminUserStatusLabel(user.status)}
        </p>
      </article>
    </section>
  );
}
