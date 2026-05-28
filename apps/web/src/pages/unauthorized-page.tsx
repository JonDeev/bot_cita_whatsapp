import { Link } from 'react-router-dom';
import { PagePlaceholder } from '../shared/ui/page-placeholder';

export function UnauthorizedPage() {
  return (
    <PagePlaceholder
      title="Acceso denegado"
      description="No tienes permisos para acceder a este recurso."
      actions={
        <Link className="text-sm font-medium text-[var(--accent)] underline" to="/admin/dashboard">
          Volver al panel
        </Link>
      }
    />
  );
}
