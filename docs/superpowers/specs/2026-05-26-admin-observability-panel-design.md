# Panel Administrativo de Observabilidad Fase 1

Fecha: 2026-05-26
Estado: Aprobado para revision final del usuario
Alcance: Panel administrativo publico con login seguro para observabilidad operativa del bot oficial de WhatsApp SISM

## 1. Objetivo

Construir la fase 1 del panel administrativo del bot oficial de WhatsApp para operar produccion con el numero oficial sin perder visibilidad operativa.

La prioridad de esta fase es:

1. Monitorear salud operativa del sistema.
2. Ver conversaciones y mensajes sin responder desde el panel.
3. Ver metricas y logs de recordatorios y encuestas.
4. Detectar fallos criticos casi en tiempo real.
5. Dejar una base solida para evolucionar despues a handoff humano, asignacion de asesores, administracion de usuarios y panel operativo completo.

## 2. Alcance de fase 1

Incluye:

1. Login seguro al panel.
2. RBAC pragmatica con roles `ADMIN`, `SUPERVISOR`, `ASESOR`.
3. Acceso activo en fase 1 solo para `ADMIN` y `SUPERVISOR`.
4. Dashboard operativo.
5. Lista de conversaciones.
6. Detalle de conversacion.
7. Timeline de mensajes por conversacion.
8. Vista de recordatorios.
9. Vista de encuestas.
10. Vista de logs, fallos y auditoria admin.
11. Feed inicial de actividad operativa.
12. SSE para eventos criticos.
13. Auditoria de autenticacion y accesos sensibles.

No incluye:

1. Responder mensajes desde el panel.
2. Tomar o cerrar handoffs desde el panel.
3. Chat live bidireccional.
4. CRUD completo de asesores.
5. Configuracion avanzada del sistema.
6. Exportaciones complejas.
7. Dark mode avanzado.
8. Browser push notifications.
9. Integracion con SSO externo.

## 3. Principios no negociables

1. El backend NestJS actual sigue siendo la unica autoridad de autenticacion, autorizacion, auditoria, cookies y SSE.
2. No se reescribe el backend actual ni se crea un backend paralelo para el panel.
3. El frontend vive en este mismo repo, en `apps/web`.
4. Los contratos compartidos viven en `packages/shared`.
5. La seguridad real vive en backend; el frontend solo refleja permisos.
6. Todo acceso administrativo funciona con `deny-by-default`.
7. No se guardan tokens de sesion en `localStorage` ni `sessionStorage`.
8. Todo acceso sensible debe quedar auditado.
9. No se exponen datos clinicos ni identificadores sensibles innecesarios.
10. El panel de fase 1 es de observabilidad operativa, no de atencion humana.

## 4. Arquitectura final aprobada

### 4.1 Enfoque general

Se aprueba el enfoque:

```txt
Frontend: React + Vite + TypeScript
Backend admin: NestJS actual
Monorepo: pnpm workspace
Tiempo real: SSE
Estado server-side: TanStack Query
Sesion: opaca server-side
```

### 4.2 Estructura del repo

```txt
src/                      -> backend NestJS actual
apps/web/                 -> frontend administrativo
packages/shared/          -> roles, tipos, zod schemas, DTOs y utilidades compartidas
prisma/bot/               -> schema del bot + nuevas tablas admin
docs/superpowers/specs/   -> specs y planes
```

### 4.3 Separacion de rutas SPA y API

Se aprueba la separacion:

```txt
SPA: /admin/*
API: /api/admin/*
```

Motivos:

1. Evita conflictos entre React Router y controladores Nest.
2. Simplifica configuracion en Nginx o proxy inverso.
3. Hace mas claro que el dashboard es una SPA y la API es una capacidad separada.

### 4.4 Despliegue recomendado

Se recomienda desplegar SPA y API admin en el mismo origen HTTPS.

Ejemplo:

```txt
https://botadmin.sism.com/admin/*      -> SPA
https://botadmin.sism.com/api/admin/*  -> API admin
```

Motivos:

1. simplifica cookies seguras
2. simplifica SSE autenticado
3. reduce complejidad de CORS
4. facilita endurecimiento de sesion

## 5. Stack frontend aprobado

### 5.1 Core

1. `React`
2. `TypeScript` estricto
3. `Vite`
4. `React Router` en `Declarative Mode`

No se usa:

1. `Next.js`
2. `Framework Mode` de React Router
3. `NextAuth`

### 5.2 Server state y networking

1. `@tanstack/react-query`
2. cliente `fetch` propio
3. todas las requests con `credentials: 'include'`
4. invalidacion de queries al recibir eventos SSE

### 5.3 Validacion y formularios

1. `zod`
2. `react-hook-form`
3. `@hookform/resolvers`

### 5.4 UI

1. `tailwindcss`
2. `@tailwindcss/vite`
3. `shadcn/ui`
4. `Radix Primitives` como base interna
5. `class-variance-authority`
6. `clsx`
7. `tailwind-merge`
8. `lucide-react`
9. `sonner`

### 5.5 Tablas, graficas y motion

1. `@tanstack/react-table`
2. `recharts`
3. `motion`

### 5.6 Fechas

1. `Intl.DateTimeFormat`
2. `Intl.RelativeTimeFormat`
3. timezone objetivo: `America/Bogota`

### 5.7 Librerias que no se instalan en fase 1

1. `Redux`
2. `Zustand`
3. `Axios`
4. `MUI`
5. `Chakra`
6. `Ant Design`
7. `date-fns`
8. `dayjs`
9. `WebSocket`

`Zustand` queda reservado para una fase posterior si aparece estado UI transversal real.

## 6. Diseno visual aprobado

Direccion visual:

1. Consola operativa.
2. Light-first.
3. Sobria, densa y clara.
4. Prioridad en escaneabilidad y alertas operativas.
5. Motion moderado, funcional y respetando `prefers-reduced-motion`.

Guia visual:

1. Sidebar utilitaria en desktop.
2. Header con estado SSE, entorno y usuario.
3. Cards con jerarquia fuerte de severidad.
4. Color semantico consistente:
   - exito
   - warning
   - error
   - estado informativo
5. Toasts operativos con `Sonner`.

## 7. Rutas frontend aprobadas

```txt
/admin                    -> redireccion a /admin/dashboard
/admin/login
/admin/dashboard
/admin/conversations
/admin/conversations/:conversationId
/admin/reminders
/admin/surveys
/admin/logs
/admin/profile
/admin/unauthorized
```

Rutas reservadas para fases posteriores:

```txt
/admin/handoffs
/admin/agents
/admin/settings
/admin/audit
```

## 8. Pantallas aprobadas para fase 1

### 8.1 Login

1. Formulario `identifier + password`
2. `identifier` puede ser `username` o `email`
3. Errores claros
4. Sin recordar sesion persistente especial
5. Auditoria de login exitoso y fallido

### 8.2 Dashboard

Objetivo:

Permitir ver en 10-15 segundos si el sistema esta sano o degradado.

Contenido minimo:

1. mensajes inbound ultimas 24h
2. mensajes outbound ultimas 24h
3. fallos de outbox
4. fallos de webhook
5. recordatorios enviados/fallidos
6. encuestas enviadas/completadas
7. conversaciones activas
8. feed live de eventos criticos

### 8.3 Conversations

1. lista paginada
2. filtros por estado, telefono parcial y rango de fecha
3. datos enmascarados segun rol
4. sin acciones mutantes en fase 1

### 8.4 Conversation Detail

1. metadata operativa de la conversacion
2. timeline paginable de mensajes
3. tabs `Mensajes`, `Contexto`, `Eventos`
4. JSON tecnico solo para `ADMIN`
5. auditoria de visualizacion sensible

### 8.5 Reminders

1. metricas resumidas
2. dispatches recientes
3. estado y tendencias
4. thresholds visuales

### 8.6 Surveys

1. metricas resumidas
2. dispatches recientes
3. tasas de finalizacion
4. tendencias por ventana

### 8.7 Logs

1. `Eventos`
2. `Fallos`
3. `Auditoria`
4. vista resumida para `SUPERVISOR`
5. expansion tecnica para `ADMIN`

### 8.8 Profile

1. datos basicos del usuario
2. rol actual
3. cierre de sesion

## 9. Layout aprobado

### 9.1 AppShell

1. sidebar fija en desktop
2. sidebar colapsable o navegacion simplificada en mobile/tablet
3. header con:
   - estado SSE
   - entorno
   - usuario autenticado
   - menu de sesion

### 9.2 Dashboard layout

1. grid de KPIs
2. actividad reciente
3. modulo de alertas o live feed

### 9.3 Detail layout

1. lista + detalle en desktop cuando aplique
2. navegacion lista -> detalle en mobile

## 10. RBAC aprobada

### 10.1 Roles

Se definen desde fase 1:

```txt
ADMIN
SUPERVISOR
ASESOR
```

### 10.2 Roles activos en fase 1

```txt
ADMIN
SUPERVISOR
```

`ASESOR` existe en codigo, tipos y base de datos, pero no tiene acceso habilitado al panel en fase 1.

### 10.3 Reglas

1. Todo lo no permitido explicitamente queda denegado.
2. `SUPERVISOR` ve operacion y datos resumidos.
3. `SUPERVISOR` no ve JSON tecnico crudo.
4. `SUPERVISOR` no crea usuarios.
5. `SUPERVISOR` no ejecuta acciones mutantes operativas.
6. `ADMIN` ve detalle tecnico y gestiona usuarios admin del panel.
7. `ASESOR` no accede al panel en fase 1.

## 11. Autenticacion y sesion aprobadas

### 11.1 Modelo

Se aprueba:

1. sesion opaca server-side
2. Redis para lookup rapido y revocacion
3. MySQL bot DB para persistencia de usuarios, sesiones y auditoria
4. cookie de sesion `HttpOnly + Secure + SameSite=Strict`
5. CSRF explicito para requests mutantes
6. hashing de password con `Argon2id`

### 11.2 Convencion de cookie

En produccion se usara una cookie con prefijo `__Host-`, por ejemplo:

```txt
__Host-sism_admin_session
```

Requisitos cerrados:

1. `Secure`
2. `HttpOnly`
3. `Path=/`
4. sin atributo `Domain`
5. servida solo por `HTTPS`

### 11.3 CSRF

Para `POST`, `PATCH`, `PUT` y `DELETE`:

1. token CSRF separado
2. validacion en backend
3. no confiar solo en `SameSite`
4. el frontend obtiene el token por `GET /api/admin/auth/csrf`
5. el frontend envia el token en header `X-CSRF-Token`
6. el token CSRF no se envia por URL
7. el token CSRF no se guarda en `localStorage` ni `sessionStorage`

### 11.4 Si Redis falla

Comportamiento aprobado:

1. nunca permitir acceso sin validar sesion
2. si Redis no tiene la sesion, consultar MySQL
3. si la sesion existe en MySQL, no esta revocada y no expiro, rehidratar Redis
4. si MySQL falla o la sesion no es valida, fallar cerrado
5. nunca asumir autenticacion por solo presencia de cookie

### 11.5 Anti-enumeracion y login

Reglas aprobadas para autenticacion:

1. login con `identifier + password`
2. `identifier` puede ser `username` o `email`
3. si `identifier` contiene `@`, buscar por `email`
4. si `identifier` no contiene `@`, buscar por `username`
5. `username` nunca puede contener `@`
6. siempre responder `Credenciales invalidas` ante fallo
7. siempre ejecutar verificacion de `Argon2id` contra un `hashCandidate`
8. si el usuario existe, `hashCandidate = password_hash` real
9. si el usuario no existe, `hashCandidate = DUMMY_ARGON2ID_HASH`
10. solo despues de verificar el hash decidir si autentica o no
11. no salir rapido por usuario inexistente o inactivo
12. auditar `LOGIN_FAILED` sin filtrar detalle sensible en la respuesta publica

Reglas para `DUMMY_ARGON2ID_HASH`:

1. debe ser un hash `Argon2id` valido
2. debe generarse previamente
3. debe permitir `Argon2id.verify()`
4. no debe ser un string plano tipo `dummy`
5. debe usar parametros similares a los hashes reales de produccion
6. puede vivir como constante interna segura del modulo auth o como variable de entorno

### 11.6 Rate limiting de login

Reglas aprobadas:

1. limitar intentos por IP
2. limitar intentos por `identifier` normalizado
3. auditar intentos fallidos
4. mantener respuesta publica generica
5. no bloquear toda la operacion por el abuso de un solo atacante

## 12. API backend aprobada

Rutas API:

```txt
POST /api/admin/auth/login
GET  /api/admin/auth/me
GET  /api/admin/auth/csrf
POST /api/admin/auth/logout

GET  /api/admin/overview
GET  /api/admin/live-feed
GET  /api/admin/stream

GET  /api/admin/conversations
GET  /api/admin/conversations/:id
GET  /api/admin/conversations/:id/messages

GET  /api/admin/reminders/metrics
GET  /api/admin/reminders/dispatches

GET  /api/admin/surveys/metrics
GET  /api/admin/surveys/dispatches

GET  /api/admin/logs/events
GET  /api/admin/logs/failures
GET  /api/admin/logs/audit
```

Regla de integracion:

1. El frontend no consume `/internal/*`.
2. La API admin reutiliza use cases y repositorios existentes.
3. No se hacen llamadas HTTP internas entre modulos del mismo backend.

## 13. SSE aprobada

### 13.1 Estrategia

1. `GET /api/admin/live-feed` para carga inicial
2. `GET /api/admin/stream` para actualizaciones
3. TanStack Query para cache y fallback
4. SSE solo para eventos criticos

### 13.2 Eventos iniciales

```txt
message.inbound
message.outbound
outbox.failed
webhook.failed
reminder.failed
survey.completed
auth.session.revoked
system.degraded
```

### 13.3 Regla operativa

No se implementa replay complejo ni WebSocket en fase 1.

### 13.4 Reglas de produccion detras de proxy

1. `GET /api/admin/stream` requiere sesion valida
2. `GET /api/admin/stream` no requiere CSRF por ser `GET` sin mutacion
3. deshabilitar buffering en Nginx o proxy equivalente
4. enviar heartbeat periodico para mantener viva la conexion
5. si la sesion se revoca, emitir `auth.session.revoked` y cerrar la conexion
6. la aplicacion debe usar headers apropiados para `text/event-stream`

## 14. Modelo de datos nuevo aprobado

Se agregan tablas administrativas separadas en la bot DB.

### 14.1 `bot_admin_users`

Campos minimos:

1. `id`
2. `email`
3. `username`
4. `display_name`
5. `password_hash`
6. `role`
7. `status`
8. `last_login_at`
9. `created_at`
10. `updated_at`

Reglas aprobadas:

1. `email` unico y canonizado con `trim + lowercase`
2. `username` unico y canonizado con `trim + lowercase`
3. `username` valida contra regex `^[a-z0-9._-]{3,32}$`
4. `username` sin espacios
5. `username` sin `@`
6. `username` no debe contener cedula, telefono, datos clinicos ni informacion sensible
7. en fase 1 el `username` no es editable por el propio usuario
8. cambios futuros de `username` deben quedar auditados

Shared schemas minimos:

1. `AdminUsernameSchema`
2. `AdminLoginIdentifierSchema`
3. `AdminLoginRequestSchema`

### 14.2 `bot_admin_sessions`

Campos minimos:

1. `id`
2. `user_id`
3. `session_token_hash`
4. `csrf_token_hash`
5. `ip_hash`
6. `user_agent`
7. `last_seen_at`
8. `expires_at`
9. `revoked_at`
10. `created_at`

### 14.3 `bot_admin_audit_events`

Campos minimos:

1. `id`
2. `admin_user_id`
3. `action`
4. `resource_type`
5. `resource_id`
6. `metadata`
7. `ip_hash`
8. `occurred_at`
9. `created_at`

Separacion aprobada:

La auditoria administrativa no se mezcla con `bot_audit_events` de conversaciones.

## 15. Modulos backend nuevos aprobados

```txt
src/modules/admin-auth
src/modules/admin-users
src/modules/admin-overview
src/modules/admin-conversations
src/modules/admin-reminders
src/modules/admin-surveys
src/modules/admin-logs
src/modules/dashboard-stream
src/modules/admin-shared
```

## 16. Seguridad aprobada

1. `deny-by-default` en backend
2. guards por sesion y rol
3. throttling en login y endpoints sensibles
4. datos sensibles enmascarados segun rol
5. HTTPS obligatorio en produccion
6. no exponer secretos ni payloads tecnicos a `SUPERVISOR`
7. auditar login, logout, login fallido, acceso denegado y visualizacion sensible

## 17. Observabilidad backend reutilizable

La fase 1 debe reutilizar principalmente estas fuentes ya existentes:

1. `bot_conversations`
2. `bot_messages`
3. `bot_webhook_events`
4. `bot_outbox_messages`
5. `bot_audit_events`
6. `bot_handoffs`
7. `bot_survey_dispatches`
8. `bot_appointment_reminder_dispatches`

## 18. Orden de implementacion aprobado

### Fase A - Fundaciones backend

1. `packages/shared`
2. nuevas tablas admin
3. migracion Prisma
4. seed seguro del `ADMIN` inicial
5. auth
6. sesiones
7. CSRF
8. guards
9. auditoria admin
10. tests minimos de auth y RBAC

Regla del seed inicial:

1. no sembrar password fija versionada
2. obtener password inicial desde variable de entorno o secret de despliegue
3. `username` inicial sugerido: `admin`
4. `email` inicial: el correo operativo real definido por SISM
5. rotacion obligatoria antes de produccion o procedimiento manual equivalente documentado

### Fase B - Overview y stream

1. `/api/admin/overview`
2. `/api/admin/live-feed`
3. `/api/admin/stream`
4. adaptacion de eventos internos

### Fase C - Conversations

1. listado
2. detalle
3. timeline paginable
4. masking por rol
5. auditoria de visualizacion

### Fase D - Reminders y Surveys

1. endpoints admin de metricas
2. dispatches recientes
3. thresholds visuales

### Fase E - Logs

1. eventos
2. fallos
3. auditoria admin

### Fase F - Frontend shell

1. `apps/web`
2. login
3. rutas protegidas
4. app shell
5. dashboard
6. toasts
7. SSE client

### Fase G - Hardening

1. revision y endurecimiento de CSRF en produccion
2. rate limiting
3. expiracion de sesion
4. pruebas E2E
5. validacion de despliegue HTTPS y proxy

## 19. Pruebas requeridas

### 19.1 Backend

1. auth service
2. login correcto
3. login fallido
4. guard de sesion
5. guard de roles
6. CSRF para rutas mutantes
7. acceso denegado por rol
8. SSE autenticado y no autenticado
9. masking por rol
10. anti-enumeracion con `hashCandidate`
11. rate limiting de login

### 19.2 Frontend

1. rutas protegidas
2. redireccion a login
3. render de dashboard
4. invalidacion de queries por SSE
5. estados vacios y errores

## 20. Definicion de listo para fase 1

La fase 1 se considera lista cuando:

1. el usuario `ADMIN` puede autenticarse y navegar el panel
2. el usuario `SUPERVISOR` puede autenticarse y ver observabilidad operativa con restricciones correctas
3. la cookie de sesion esta endurecida correctamente
4. el login funciona con `identifier` por `username` o `email`
5. el backend bloquea accesos no autorizados
6. el panel muestra overview, conversaciones, reminders, surveys y logs
7. SSE entrega eventos criticos relevantes
8. toda visualizacion sensible y autenticacion queda auditada
9. no se usan librerias no oficiales de WhatsApp
10. no se exponen datos sensibles innecesarios
11. pasan las pruebas minimas relevantes

## 21. Fuentes y referencias

1. NestJS Authentication: https://docs.nestjs.com/security/authentication
2. NestJS Authorization: https://docs.nestjs.com/security/authorization
3. NestJS Server-Sent Events: https://docs.nestjs.com/techniques/server-sent-events
4. NestJS Events: https://docs.nestjs.com/techniques/events
5. NestJS Rate Limiting: https://docs.nestjs.com/security/rate-limiting
6. OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
7. OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
8. OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
9. OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
10. OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
11. MDN Secure Cookie Configuration: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies
12. MDN Set-Cookie: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
13. React Router modes: https://reactrouter.com/start/modes
14. TanStack Query: https://tanstack.com/query/latest/docs/react/
15. Vite guide: https://vite.dev/guide/
