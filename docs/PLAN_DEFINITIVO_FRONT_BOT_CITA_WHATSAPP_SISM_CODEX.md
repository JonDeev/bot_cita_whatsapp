# PLAN DEFINITIVO — FRONT ADMINISTRATIVO BOT_CITA_WHATSAPP SISM

**Proyecto:** `bot_cita_whatsapp`  
**IPS:** Servicios Integrales de Salud del Magdalena — SISM  
**Versión:** 2.0 definitiva  
**Fecha:** Mayo 2026  
**Destino:** Documento de contexto para Codex / agente de desarrollo  
**Criterio técnico:** plan fusionado y corregido a partir de la revisión del estado actual del repositorio, el plan previo de ChatGPT y el plan definitivo propuesto por Claude.

---

## 0. Resumen ejecutivo

El objetivo es construir un **panel administrativo interno** para el bot oficial de WhatsApp de SISM, enfocado primero en **monitoreo, trazabilidad, métricas, logs y control operativo** antes de habilitar funciones completas de atención humana.

La decisión final recomendada es:

```txt
Backend principal: NestJS actual
Frontend: React + Vite + TypeScript en apps/web
Monorepo: pnpm workspace
Contratos compartidos: packages/shared con Zod y tipos TS
Autenticación: NestJS + cookies HttpOnly/Secure/SameSite
NO usar NextAuth en fase inicial
NO usar Next.js en fase inicial
Tiempo real: SSE desde NestJS para eventos críticos
Chat humano futuro: WebSocket solo si la operación lo exige
Mensajes humanos: siempre vía BotOutboxMessage + worker
Auditoría: toda acción humana queda registrada
```

Este proyecto ya tiene backend NestJS, Prisma, MariaDB/MySQL, BullMQ, Redis, webhooks, recordatorios, encuestas, conversaciones, handoff y outbox. Por eso el front **no debe crear otra capa backend innecesaria**. El panel debe apoyarse en el backend existente y exponer rutas administrativas seguras bajo `/admin/*`.

---

## 1. Principios no negociables

Estas reglas deben respetarse durante toda la implementación:

```txt
1. No reescribir el backend NestJS desde cero.
2. No romper los flujos actuales de WhatsApp, recordatorios ni encuestas.
3. El front vive en apps/web dentro del mismo repo como workspace pnpm.
4. Toda ruta administrativa del backend va bajo /admin/*.
5. Toda ruta /admin/* requiere autenticación y autorización por rol.
6. Tokens de sesión NUNCA en localStorage ni sessionStorage.
7. Usar cookies HttpOnly + Secure + SameSite para sesión.
8. Validar siempre en backend, aunque el front valide también.
9. Usar Zod y tipos compartidos en packages/shared.
10. Toda acción humana debe quedar auditada.
11. Los mensajes humanos nunca se envían directo a Meta: pasan por BotOutboxMessage.
12. No exponer datos clínicos innecesarios.
13. Teléfono parcial en listados; teléfono completo solo en detalle autorizado.
14. JSON técnico de webhooks/outbox visible solo para ADMIN y SUPERVISOR.
15. No subir secretos, tokens ni credenciales al repositorio.
16. Implementar por fases pequeñas, con build verde en cada fase.
17. Mantener arquitectura modular y separación por responsabilidades.
18. Priorizar producción estable por encima de UI sofisticada.
```

---

## 2. Estado actual que debe respetarse

El backend actual ya contiene piezas importantes:

```txt
src/
├── app.module.ts
├── modules/
│   ├── whatsapp/          # webhook handler, outbox, Meta API
│   ├── conversations/     # estado de conversaciones
│   ├── human-handoff/     # handoff humano existente
│   ├── reminders/         # recordatorios de citas
│   ├── surveys/           # encuestas de satisfacción
│   ├── audit/             # auditoría de eventos
│   ├── appointments/      # citas SISM
│   └── patients/          # pacientes

prisma/
└── bot/
    └── schema.prisma      # modelos del bot
```

Modelos ya existentes que el front debe aprovechar:

```txt
BotConversation
BotMessage
BotHandoff
BotOutboxMessage
BotWebhookEvent
BotAuditEvent
BotSurveyDispatch
BotAppointmentReminderDispatch
```

El panel administrativo no debe duplicar esta persistencia. Debe crear vistas, endpoints y permisos sobre lo existente.

---

## 3. Decisiones técnicas definitivas

### 3.1 Frontend: React + Vite, no Next.js en esta fase

Se elige **React + Vite + TypeScript** porque:

```txt
- El proyecto ya tiene backend NestJS.
- No se necesita SSR para un dashboard interno.
- No se necesita SEO.
- No se necesita BFF adicional en esta fase.
- Vite produce un build estático simple de servir.
- La seguridad, cookies, roles, SSE y auditoría deben vivir en NestJS.
```

Next.js puede ser útil en otros contextos, pero aquí agregaría otra capa de servidor y más complejidad sin una necesidad real inmediata.

### 3.2 Auth: NestJS propio, no NextAuth

No usar NextAuth en fase inicial porque:

```txt
- Ya existe backend NestJS.
- El backend debe ser autoridad de autenticación y autorización.
- Evita doble sesión: NextAuth session + JWT backend.
- Evita exponer accessToken en la sesión del cliente.
- Facilita auditoría centralizada.
```

Decisión:

```txt
POST /admin/auth/login
GET  /admin/auth/me
POST /admin/auth/refresh
POST /admin/auth/logout
```

La sesión se manejará con cookies `HttpOnly`, no con tokens guardados en JavaScript.

### 3.3 Tiempo real: SSE temprano, WebSocket después

Usar **SSE** para:

```txt
- mensajes entrantes
- mensajes salientes
- outbox failed
- webhook failed
- handoff iniciado
- handoff cerrado
- recordatorio fallido
- encuesta completada
```

Usar **WebSocket** solo más adelante si el chat humano necesita bidireccionalidad avanzada.

### 3.4 `packages/shared` obligatorio

Crear un paquete compartido para evitar duplicar DTOs y enums:

```txt
packages/shared/
├── src/
│   ├── dto/
│   ├── schemas/
│   └── types/
└── package.json
```

---

## 4. Arquitectura final del repo

```txt
bot_cita_whatsapp/
├── src/                         # Backend NestJS actual
│   └── modules/
│      ├── whatsapp/
│      ├── conversations/
│      ├── reminders/
│      ├── surveys/
│      ├── audit/
│      ├── human-handoff/
│      │
│      ├── admin-auth/           # NUEVO
│      ├── admin-users/          # NUEVO
│      ├── admin-dashboard/      # NUEVO
│      ├── admin-conversations/  # NUEVO
│      ├── admin-handoff/        # NUEVO
│      ├── admin-reminders/      # NUEVO
│      ├── admin-surveys/        # NUEVO
│      ├── admin-logs/           # NUEVO
│      └── dashboard-stream/     # NUEVO SSE
│
├── apps/
│   └── web/                     # Front React + Vite + TypeScript
│      ├── src/
│      │  ├── app/
│      │  │  ├── router.tsx
│      │  │  ├── providers.tsx
│      │  │  └── routes/
│      │  ├── features/
│      │  │  ├── auth/
│      │  │  ├── dashboard/
│      │  │  ├── conversations/
│      │  │  ├── handoff/
│      │  │  ├── reminders/
│      │  │  ├── surveys/
│      │  │  ├── logs/
│      │  │  └── agents/
│      │  ├── shared/
│      │  │  ├── components/
│      │  │  ├── hooks/
│      │  │  ├── lib/
│      │  │  ├── ui/
│      │  │  └── utils/
│      │  └── main.tsx
│      ├── index.html
│      ├── vite.config.ts
│      └── package.json
│
├── packages/
│   └── shared/
│      ├── src/
│      │  ├── dto/
│      │  ├── schemas/
│      │  ├── types/
│      │  └── index.ts
│      └── package.json
│
├── prisma/
│   └── bot/
│      └── schema.prisma
│
├── docs/
├── ops/
├── pnpm-workspace.yaml
└── package.json
```

---

## 5. Stack definitivo

| Área | Tecnología | Decisión |
|---|---|---|
| Front | React + Vite + TypeScript | Sí |
| Routing | React Router | Sí |
| UI | shadcn/ui + Tailwind | Sí |
| Iconos | lucide-react | Sí |
| Toasts | Sonner | Sí |
| Animaciones | Motion / Framer Motion moderado | Sí |
| Server state | TanStack Query | Sí |
| Tablas | TanStack Table | Sí |
| Estado local UI | Zustand | Sí |
| Formularios | React Hook Form + Zod | Sí |
| Validación compartida | packages/shared + Zod | Sí |
| Gráficas | Recharts | Sí |
| Auth | NestJS + cookies HttpOnly | Sí |
| SSE | NestJS `@Sse()` + EventSource | Sí |
| WebSocket | Fase futura | Solo si hace falta |
| Password hashing | argon2 | Sí |
| Rate limit | @nestjs/throttler | Sí |
| Seguridad HTTP | helmet + CORS estricto | Sí |
| Cola mensajes | BotOutboxMessage + BullMQ | Sí |

---

## 6. Módulos backend nuevos

Cada módulo admin debe respetar separación de responsabilidades.

```txt
src/modules/admin-auth/
├── application/
│   └── use-cases/
├── domain/
│   └── ports/
├── infrastructure/
│   └── persistence/
└── presentation/
    └── http/
        ├── controller.ts
        └── dto/
```

Módulos a crear:

```txt
admin-auth
admin-users
admin-dashboard
admin-conversations
admin-handoff
admin-reminders
admin-surveys
admin-logs
dashboard-stream
```

---

## 7. Base de datos — modelos nuevos

Agregar en `prisma/bot/schema.prisma` mediante migración separada.

### 7.1 `BotAdminUser`

```prisma
model BotAdminUser {
  id           Int       @id @default(autoincrement())
  name         String    @db.VarChar(120)
  email        String    @unique @db.VarChar(191)
  passwordHash String    @map("password_hash") @db.VarChar(191)
  role         String    @db.VarChar(32)
  isActive     Boolean   @default(true) @map("is_active")
  lastLoginAt  DateTime? @map("last_login_at") @db.DateTime(3)
  createdAt    DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.DateTime(3)

  adminAuditEvents BotAdminAuditEvent[]
  refreshTokens    BotAdminRefreshToken[]

  @@index([role, isActive], map: "idx_bot_admin_users_role_active")
  @@map("bot_admin_users")
}
```

### 7.2 `BotAdminAuditEvent`

```prisma
model BotAdminAuditEvent {
  id             Int      @id @default(autoincrement())
  adminUserId    Int      @map("admin_user_id")
  action         String   @db.VarChar(128)
  conversationId Int?     @map("conversation_id")
  metadata       Json?    @db.Json
  ipAddress      String?  @map("ip_address") @db.VarChar(64)
  userAgent      String?  @map("user_agent") @db.Text
  occurredAt     DateTime @map("occurred_at") @db.DateTime(3)
  createdAt      DateTime @default(now()) @map("created_at") @db.DateTime(3)

  adminUser BotAdminUser @relation(fields: [adminUserId], references: [id], onDelete: Restrict)

  @@index([adminUserId, occurredAt], map: "idx_bot_admin_audit_admin_occurred")
  @@index([conversationId], map: "idx_bot_admin_audit_conversation")
  @@index([action, occurredAt], map: "idx_bot_admin_audit_action_occurred")
  @@map("bot_admin_audit_events")
}
```

### 7.3 `BotAdminRefreshToken`

```prisma
model BotAdminRefreshToken {
  id          Int       @id @default(autoincrement())
  adminUserId Int       @map("admin_user_id")
  tokenHash   String    @map("token_hash") @db.VarChar(191)
  expiresAt   DateTime  @map("expires_at") @db.DateTime(3)
  revokedAt   DateTime? @map("revoked_at") @db.DateTime(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  adminUser BotAdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)

  @@index([adminUserId, expiresAt], map: "idx_bot_admin_refresh_user_expires")
  @@index([tokenHash], map: "idx_bot_admin_refresh_token_hash")
  @@map("bot_admin_refresh_tokens")
}
```

### 7.4 Mejora progresiva para `BotHandoff`

Si `BotHandoff` actualmente usa `assigned_to` como string, no romperlo de una vez. Agregar campo nullable:

```prisma
assignedAdminUserId Int? @map("assigned_admin_user_id")
```

Mantener `assigned_to` durante transición. Luego migrar gradualmente.

---

## 8. Roles y permisos

Roles válidos:

```ts
export const AdminRole = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  ASESOR: 'ASESOR',
  READONLY: 'READONLY',
} as const;

export type AdminRole = typeof AdminRole[keyof typeof AdminRole];
```

Matriz RBAC:

| Permiso | ADMIN | SUPERVISOR | ASESOR | READONLY |
|---|:---:|:---:|:---:|:---:|
| Ver dashboard | Sí | Sí | Limitado | Sí |
| Ver conversaciones | Sí | Sí | Solo asignadas | Sí |
| Ver mensajes completos | Sí | Sí | Solo asignadas | Sí |
| Ver logs técnicos JSON | Sí | Sí | No | Resumen |
| Ver webhooks crudos | Sí | Sí | No | No |
| Tomar handoff | Sí | Sí | Sí | No |
| Asignar handoff | Sí | Sí | No | No |
| Responder conversación | Sí | Opcional | Sí | No |
| Cerrar handoff | Sí | Sí | Solo asignadas | No |
| Ver recordatorios | Sí | Sí | No | Sí |
| Ver encuestas | Sí | Sí | No | Sí |
| CRUD asesores | Sí | No | No | No |
| Ver auditoría admin | Sí | Sí | No | No |

---

## 9. Seguridad

### 9.1 Cookies recomendadas

```ts
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/admin',
};
```

Cookies sugeridas:

```txt
sism_admin_access    # corta duración, HttpOnly
sism_admin_refresh   # mayor duración, HttpOnly, rotada y hasheada en BD
```

### 9.2 Reglas de sesión

```txt
Access token TTL: 15 minutos
Refresh token TTL: 7 días
Refresh token: guardar hash en BD, nunca valor plano
Logout: revocar refresh token actual
Refresh: rotar refresh token si es posible
Login fallido: auditar LOGIN_FAILED
```

### 9.3 CORS

```ts
app.enableCors({
  origin: process.env.ADMIN_FRONTEND_ORIGIN,
  credentials: true,
});
```

### 9.4 Helmet

```ts
app.use(helmet());
```

### 9.5 Rate limiting

```ts
ThrottlerModule.forRoot([
  {
    ttl: 60_000,
    limit: 5,
  },
]);
```

Aplicar especialmente a:

```txt
POST /admin/auth/login
POST /admin/auth/refresh
```

---

## 10. Endpoints administrativos

### 10.1 Auth

```txt
POST /admin/auth/login
GET  /admin/auth/me
POST /admin/auth/refresh
POST /admin/auth/logout
```

### 10.2 Dashboard

```txt
GET /admin/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Respuesta esperada:

```ts
export const AdminOverviewDtoSchema = z.object({
  conversations: z.object({
    active: z.number(),
    humanHandoff: z.number(),
    expired: z.number(),
    botActive: z.number(),
  }),
  messages: z.object({
    inboundToday: z.number(),
    outboundToday: z.number(),
    failedOutboundToday: z.number(),
  }),
  reminders: z.object({
    pending: z.number(),
    sent: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
  surveys: z.object({
    pending: z.number(),
    sent: z.number(),
    completed: z.number(),
    declined: z.number(),
    failed: z.number(),
  }),
  technicalHealth: z.object({
    failedWebhooksLast15m: z.number(),
    failedOutboxLast15m: z.number(),
    pendingOutbox: z.number(),
  }),
});
```

### 10.3 Conversaciones

```txt
GET /admin/conversations
GET /admin/conversations/:id
GET /admin/conversations/:id/messages
GET /admin/conversations/:id/audit-events
GET /admin/conversations/:id/webhook-events
GET /admin/conversations/:id/outbox-messages
```

Query params:

```txt
status
hasActiveHandoff
hasFailedOutbox
hasFailedWebhook
participantPhone
from
to
page
pageSize
sortBy
sortDir
```

### 10.4 Handoff

```txt
POST /admin/conversations/:id/handoff/take
POST /admin/conversations/:id/handoff/assign
POST /admin/conversations/:id/handoff/close
POST /admin/conversations/:id/reply
```

### 10.5 Recordatorios

```txt
GET /admin/reminders/metrics
GET /admin/reminders/dispatches
GET /admin/reminders/dispatches/:id
```

### 10.6 Encuestas

```txt
GET /admin/surveys/metrics
GET /admin/surveys/dispatches
GET /admin/surveys/dispatches/:id
```

### 10.7 Logs

```txt
GET /admin/logs/webhooks
GET /admin/logs/outbox
GET /admin/logs/audit
```

### 10.8 Asesores

```txt
GET    /admin/users
POST   /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id
DELETE /admin/users/:id   # soft delete, isActive=false
```

### 10.9 SSE

```txt
GET /admin/stream
```

---

## 11. SSE — eventos en tiempo real

### 11.1 Eventos mínimos

```ts
export type AdminSSEEvent =
  | { type: 'message.inbound'; conversationId: number }
  | { type: 'message.outbound'; conversationId: number }
  | { type: 'outbox.failed'; outboxId: number; conversationId?: number }
  | { type: 'webhook.failed'; webhookId: number; conversationId?: number }
  | { type: 'handoff.started'; conversationId: number }
  | { type: 'handoff.closed'; conversationId: number }
  | { type: 'reminder.sent'; dispatchId: number }
  | { type: 'reminder.failed'; dispatchId: number }
  | { type: 'survey.completed'; dispatchId: number }
  | { type: 'survey.failed'; dispatchId: number };
```

### 11.2 Backend NestJS

```ts
@Controller('admin/stream')
@UseGuards(AdminJwtGuard)
export class DashboardStreamController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Get()
  @Sse()
  stream(@Req() req: Request): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'admin.event').pipe(
      map((data) => ({ data })),
      takeUntil(fromEvent(req, 'close')),
    );
  }
}
```

### 11.3 Front React

```ts
export function useAdminStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(
      `${import.meta.env.VITE_API_URL}/admin/stream`,
      { withCredentials: true },
    );

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type.startsWith('message.')) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }

      if (data.type === 'outbox.failed') {
        queryClient.invalidateQueries({ queryKey: ['logs', 'outbox'] });
      }

      if (data.type === 'webhook.failed') {
        queryClient.invalidateQueries({ queryKey: ['logs', 'webhooks'] });
      }

      if (data.type.startsWith('reminder.')) {
        queryClient.invalidateQueries({ queryKey: ['reminders'] });
      }

      if (data.type.startsWith('survey.')) {
        queryClient.invalidateQueries({ queryKey: ['surveys'] });
      }
    };

    return () => source.close();
  }, [queryClient]);
}
```

---

## 12. Flujo de mensaje humano

Este flujo es obligatorio.

```txt
Asesor escribe mensaje en UI
  ↓
POST /admin/conversations/:id/reply
  ↓
Backend valida:
  - usuario autenticado
  - rol con permiso
  - conversación existe
  - handoff activo
  - asesor asignado o supervisor/admin
  - ventana WhatsApp de 24h vigente para mensaje libre
  - mensaje no vacío
  ↓
Crear BotMessage:
  direction = OUTBOUND
  source = HUMAN_AGENT
  ↓
Crear BotOutboxMessage:
  status = PENDING
  deduplicationKey = uuid
  ↓
Crear BotAdminAuditEvent:
  action = HUMAN_MESSAGE_SENT
  ↓
Worker BullMQ procesa outbox
  ↓
Meta Cloud API envía mensaje
  ↓
Webhook de status actualiza SENT / DELIVERED / READ / FAILED
  ↓
EventEmitter2 emite admin.event
  ↓
SSE actualiza dashboard
```

Regla crítica:

```txt
NUNCA enviar directo a Meta desde el controller.
SIEMPRE persistir primero en BotOutboxMessage.
```

---

## 13. UX y diseño

### 13.1 Principios

```txt
- Sobrio, institucional y operativo.
- Priorizar velocidad de lectura.
- Errores críticos visibles arriba.
- No esconder fallos técnicos.
- Poca animación, solo donde ayude.
- Mobile/tablet funcional, pero prioridad desktop.
```

### 13.2 Paleta

```txt
Primario: teal-600 / teal-700
Éxito: green-600
Advertencia: amber-500
Error: red-600
Fondo: gray-50
Cards: white
Texto: gray-900 / gray-600
```

### 13.3 Layout

```txt
Topbar:
- logo SISM
- breadcrumb
- estado técnico
- alertas
- usuario

Sidebar:
- Dashboard
- Conversaciones
- Handoffs
- Recordatorios
- Encuestas
- Logs
- Asesores
- Configuración

Contenido:
- KPI cards arriba
- tablas y detalle abajo
```

### 13.4 Componentes

```txt
MetricCard
TechnicalHealthCard
StatusBadge
ConversationTable
ConversationFilters
MessageThread
MessageBubble
TechnicalEventsPanel
HandoffQueue
HandoffActions
ReminderStatusChart
SurveyFunnelChart
DataTable
DateRangeFilter
EmptyState
ErrorState
SkeletonCard
ConfirmDialog
LiveEventFeed
```

### 13.5 Animaciones permitidas

```txt
Sí:
- Slide-in del panel de detalle
- Highlight de mensaje nuevo
- Skeleton loaders
- Badge pulse suave en alerta crítica
- Toasts de éxito/error

No:
- Splash screen
- Transiciones largas
- Animaciones en tablas
- Efectos decorativos innecesarios
```

---

## 14. Estructura del frontend

```txt
apps/web/src/
├── app/
│   ├── router.tsx
│   ├── providers.tsx
│   └── routes/
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── ConversationsPage.tsx
│       ├── ConversationDetailPage.tsx
│       ├── HandoffsPage.tsx
│       ├── RemindersPage.tsx
│       ├── SurveysPage.tsx
│       ├── LogsPage.tsx
│       └── AgentsPage.tsx
│
├── features/
│   ├── auth/
│   │   ├── api/
│   │   ├── hooks/
│   │   └── components/
│   ├── dashboard/
│   ├── conversations/
│   ├── handoff/
│   ├── reminders/
│   ├── surveys/
│   ├── logs/
│   └── agents/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── query-client.ts
│   │   └── auth.ts
│   ├── ui/
│   └── utils/
│
└── main.tsx
```

---

## 15. Cliente HTTP frontend

Usar `credentials: 'include'` porque la sesión vive en cookies.

```ts
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('No autenticado');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message ?? 'Error de servidor');
  }

  return res.json();
}
```

---

## 16. Variables de entorno

### 16.1 Backend `.env.example`

```env
# Admin Auth
ADMIN_JWT_SECRET=cambiar-en-produccion-minimo-64-chars
ADMIN_ACCESS_TOKEN_TTL_SECONDS=900
ADMIN_REFRESH_TOKEN_TTL_SECONDS=604800
ADMIN_ACCESS_COOKIE_NAME=sism_admin_access
ADMIN_REFRESH_COOKIE_NAME=sism_admin_refresh
ADMIN_COOKIE_SECURE=false
ADMIN_COOKIE_SAMESITE=lax

# CORS
ADMIN_FRONTEND_ORIGIN=http://localhost:5173

# Seguridad
ADMIN_LOGIN_RATE_LIMIT_TTL_MS=60000
ADMIN_LOGIN_RATE_LIMIT_MAX=5
```

Producción:

```env
ADMIN_COOKIE_SECURE=true
ADMIN_COOKIE_SAMESITE=strict
ADMIN_FRONTEND_ORIGIN=https://panel.sism.com.co
```

### 16.2 Front `apps/web/.env.example`

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Panel SISM WhatsApp
```

---

## 17. Scripts sugeridos

### 17.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "."
  - "apps/*"
  - "packages/*"
```

### 17.2 `package.json` raíz

Agregar sin eliminar scripts existentes:

```json
{
  "scripts": {
    "web:dev": "pnpm --filter @sism/web dev",
    "web:build": "pnpm --filter @sism/web build",
    "web:preview": "pnpm --filter @sism/web preview",
    "shared:build": "pnpm --filter @sism/shared build",
    "dev:api": "nest start --watch",
    "dev": "concurrently \"pnpm dev:api\" \"pnpm web:dev\"",
    "seed:admin": "ts-node ops/seeds/create-admin-user.ts"
  }
}
```

---

## 18. Orden exacto de implementación para Codex

Implementar en este orden. No saltar fases.

### Paso 1 — Preparar monorepo

```txt
1. Crear apps/web.
2. Crear packages/shared.
3. Actualizar pnpm-workspace.yaml.
4. Verificar que el backend actual sigue compilando.
```

### Paso 2 — Crear paquete compartido

```txt
1. Crear package @sism/shared.
2. Crear AdminRole.
3. Crear ConversationStatus.
4. Crear HandoffStatus.
5. Crear DTOs base con Zod.
6. Exportar todo desde src/index.ts.
```

### Paso 3 — Modelos Prisma

```txt
1. Agregar BotAdminUser.
2. Agregar BotAdminAuditEvent.
3. Agregar BotAdminRefreshToken.
4. Agregar assignedAdminUserId nullable a BotHandoff si aplica.
5. Crear migración separada.
6. Verificar migración local.
```

### Paso 4 — Seed admin

```txt
1. Crear ops/seeds/create-admin-user.ts.
2. Password inicial por variable de entorno.
3. Hashear con argon2.
4. No hardcodear contraseña en código.
```

### Paso 5 — Admin Auth backend

```txt
1. Crear admin-auth module.
2. Crear login use case.
3. Crear refresh use case.
4. Crear logout use case.
5. Crear /admin/auth/me.
6. Configurar cookies HttpOnly.
7. Implementar refresh token hash en BD.
8. Auditar LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT.
```

### Paso 6 — Guards y roles

```txt
1. AdminJwtGuard.
2. AdminRolesGuard.
3. Decorador @AdminRoles().
4. Decorador @CurrentAdminUser().
5. Probar 401 y 403.
```

### Paso 7 — Front base

```txt
1. Crear Vite React TS.
2. Instalar Tailwind y shadcn/ui.
3. Crear router.
4. Crear layout público y layout privado.
5. Crear LoginPage.
6. Crear ProtectedRoute usando /admin/auth/me.
7. Crear apiFetch con credentials include.
```

### Paso 8 — Dashboard

```txt
1. Crear admin-dashboard module.
2. Crear GET /admin/overview.
3. Agregar conteos reales:
   - conversations
   - messages
   - reminders
   - surveys
   - technicalHealth
4. Crear MetricCard.
5. Crear TechnicalHealthCard.
6. Renderizar DashboardPage.
```

### Paso 9 — Conversaciones

```txt
1. Crear admin-conversations module.
2. Crear GET /admin/conversations con paginación server-side.
3. Crear filtros.
4. Crear ConversationTable con TanStack Table.
5. Crear GET /admin/conversations/:id.
6. Crear GET /admin/conversations/:id/messages.
7. Crear vista detalle con timeline.
```

### Paso 10 — Logs

```txt
1. Crear admin-logs module.
2. Crear logs de webhooks.
3. Crear logs de outbox.
4. Crear logs de audit.
5. Restringir JSON técnico por rol.
```

### Paso 11 — SSE

```txt
1. Crear dashboard-stream module.
2. Agregar EventEmitter2 si no existe.
3. Emitir eventos desde webhook, outbox, reminders y surveys.
4. Crear GET /admin/stream.
5. Crear useAdminStream en front.
6. Invalidar queries con TanStack Query.
7. Mostrar toast en eventos críticos.
```

### Paso 12 — Handoff operativo

```txt
1. Crear admin-handoff module.
2. Crear take.
3. Crear assign.
4. Crear close.
5. Auditar cada acción.
6. Restringir por rol.
7. Permitir ASESOR solo en asignadas/tomadas.
```

### Paso 13 — Reply humano

```txt
1. Crear POST /admin/conversations/:id/reply.
2. Validar handoff activo.
3. Validar asesor autorizado.
4. Validar ventana WhatsApp de 24h.
5. Crear BotMessage.
6. Crear BotOutboxMessage PENDING.
7. Auditar HUMAN_MESSAGE_SENT.
8. Worker existente envía a Meta.
```

### Paso 14 — CRUD asesores

```txt
1. Crear admin-users module.
2. Crear listado.
3. Crear usuario.
4. Editar nombre/rol/estado.
5. Desactivar usuario, no borrar físico.
6. Auditar cambios.
```

### Paso 15 — Tests mínimos

```txt
Backend:
- login exitoso
- password incorrecto
- refresh token
- /admin/overview autenticado
- /admin/conversations autenticado
- RBAC 403
- handoff take/assign/close
- reply crea outbox

Frontend:
- build exitoso
- login renderiza
- dashboard renderiza con datos vacíos
- ConversationTable EmptyState
- apiFetch redirige en 401
```

---

## 19. Checklist antes de producción

### Seguridad

```txt
[ ] Cookies HttpOnly activas
[ ] Secure=true en producción
[ ] SameSite configurado
[ ] No tokens en localStorage/sessionStorage
[ ] CORS restringido al dominio real
[ ] Helmet activo
[ ] Rate limit en login
[ ] Passwords con argon2
[ ] Refresh tokens hasheados
[ ] Logout revoca refresh token
[ ] /admin/* retorna 401 sin sesión
[ ] /admin/* retorna 403 sin rol
```

### Monitoreo

```txt
[ ] Dashboard muestra datos reales
[ ] Webhooks fallidos visibles
[ ] Outbox FAILED visible
[ ] Pending outbox visible
[ ] Recordatorios por estado visibles
[ ] Encuestas por estado visibles
[ ] Conversaciones paginadas
[ ] Detalle con timeline
[ ] SSE conectado
[ ] Toast en eventos críticos
```

### Privacidad

```txt
[ ] Teléfono parcial en listados
[ ] JSON técnico restringido
[ ] No se exponen datos clínicos innecesarios
[ ] Auditoría activa
[ ] Logs no muestran secretos
```

### Calidad

```txt
[ ] Backend build OK
[ ] Front build OK
[ ] Shared package build OK
[ ] Migraciones aplicadas
[ ] Seed admin ejecutado
[ ] Tests mínimos pasando
[ ] Variables completas
[ ] No secretos en repo
```

### Producción

```txt
[ ] SSL activo
[ ] Dominio panel configurado
[ ] ADMIN_FRONTEND_ORIGIN correcto
[ ] VITE_API_URL correcto
[ ] NGINX/reverse proxy configurado si aplica
[ ] Logs de servidor accesibles
[ ] Backup BD configurado
```

---

## 20. Comandos iniciales sugeridos

> Ejecutar uno por uno, verificando build después de cada bloque.

```bash
# Desde la raíz
mkdir -p apps packages/shared/src/{dto,schemas,types}

# Crear front
pnpm create vite apps/web --template react-ts

# Crear package shared
cat > packages/shared/package.json <<'EOF'
{
  "name": "@sism/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
EOF
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "."
  - "apps/*"
  - "packages/*"
```

Instalar dependencias frontend:

```bash
cd apps/web

pnpm add react-router-dom @tanstack/react-query @tanstack/react-table
pnpm add zustand zod react-hook-form @hookform/resolvers
pnpm add sonner lucide-react recharts framer-motion
pnpm add @sism/shared@workspace:*
```

Instalar dependencias backend:

```bash
cd ../..

pnpm add argon2 cookie-parser helmet @nestjs/throttler @nestjs/jwt
```

---

## 21. Referencias técnicas consultadas

- NestJS Server-Sent Events: https://docs.nestjs.com/techniques/server-sent-events
- NestJS Authentication: https://docs.nestjs.com/security/authentication
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Cookie Attributes Testing: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/02-Testing_for_Cookies_Attributes
- Vite Production Build: https://vite.dev/guide/build
- shadcn/ui Vite Installation: https://ui.shadcn.com/docs/installation/vite
- TanStack Query React Overview: https://tanstack.com/query/latest/docs/framework/react/overview
- TanStack Table Introduction: https://tanstack.com/table/latest/docs/introduction
- TanStack Table Pagination: https://tanstack.com/table/v8/docs/guide/pagination
- React Router Documentation: https://reactrouter.com/home
- Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- Meta WhatsApp Send Messages / Customer Service Window: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages

---

## 22. Decisión final para el equipo

La arquitectura final del proyecto debe quedar así:

```txt
NestJS = cerebro operativo, seguridad, auditoría, cookies, roles, SSE y WhatsApp.
React/Vite = panel administrativo liviano y rápido.
packages/shared = contratos tipados entre API y front.
SSE = monitoreo en tiempo real de eventos críticos.
Outbox = garantía de trazabilidad para mensajes humanos.
Auditoría = cumplimiento operativo y control de acciones.
```

No implementar Next.js ni NextAuth en esta etapa. Si en el futuro aparece una necesidad real de SSR, BFF complejo, reportes públicos renderizados en servidor o páginas públicas administradas, se puede reevaluar. Para el estado actual de SISM, la solución más robusta y mantenible es **NestJS + React/Vite + shared contracts + SSE + outbox + auditoría**.
