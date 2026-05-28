import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AdminLoginRequestSchema } from '@whatsapp-bot/shared';
import type { AdminLoginRequest } from '@whatsapp-bot/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../shared/http/api-client';
import { meQueryKey, useLoginAdmin } from './auth.hooks';

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loginMutation = useLoginAdmin();

  const form = useForm<AdminLoginRequest>({
    resolver: zodResolver(AdminLoginRequestSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values);
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      navigate('/admin/dashboard', { replace: true });
      toast.success('Sesion iniciada');
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'No fue posible iniciar sesion';
      toast.error(message);
    }
  });

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-lg shadow-slate-200/60">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          SISM ADMIN
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Panel de observabilidad</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Inicia sesion con usuario o correo para monitorear operacion del bot.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium" htmlFor="identifier">
            Usuario o correo
          </label>
          <input
            id="identifier"
            autoComplete="username"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] transition focus:ring-2"
            {...form.register('identifier')}
          />
          <p className="min-h-5 text-xs text-[var(--danger)]">
            {form.formState.errors.identifier?.message}
          </p>

          <label className="block text-sm font-medium" htmlFor="password">
            Contrasena
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--accent)] transition focus:ring-2"
            {...form.register('password')}
          />
          <p className="min-h-5 text-xs text-[var(--danger)]">
            {form.formState.errors.password?.message}
          </p>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="mt-2 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginMutation.isPending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}
