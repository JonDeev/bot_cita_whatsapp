# Modulo Admin Chats de Observabilidad

Fecha: 2026-05-28  
Estado: Propuesto para implementacion  
Relacion: Extiende `2026-05-26-admin-observability-panel-design.md` sin reemplazarlo

## 1. Objetivo

Introducir un modulo `Chats` en el panel admin para mejorar comprension operativa tipo bandeja de conversaciones, manteniendo el modulo `Conversations` actual como vista tecnica/forense.

Resultado esperado:

1. Vista mas intuitiva para operacion diaria.
2. Separacion explicita entre observabilidad funcional (`Chats`) y observabilidad tecnica (`Conversations`).
3. Reutilizacion de seguridad, auditoria y RBAC existentes.

## 2. Alcance

Incluye:

1. Nueva ruta frontend `/admin/chats`.
2. Layout de 2 paneles:
   - izquierdo: listado de chats estilo WhatsApp.
   - derecho: timeline de mensajes con burbujas (entrante izquierda, saliente derecha).
3. Nuevos endpoints admin orientados a UI chat (read-only).
4. Enmascaramiento por rol igual al estandar admin actual.
5. Integracion con SSE para refresco.

No incluye:

1. Responder mensajes desde el panel.
2. Acciones de handoff desde `Chats`.
3. Archivos adjuntos enriquecidos (preview multimedia avanzado) en esta fase.
4. Reemplazar o eliminar `Conversations`.

## 3. Principios de arquitectura

1. Modular monolith + Hexagonal Architecture (igual al proyecto).
2. `Chats` no debe introducir logica de negocio clinica; solo lectura operacional.
3. `Conversations` se mantiene intacto para soporte tecnico.
4. Seguridad real solo backend:
   - frontend refleja permisos, no los decide.
5. Archivos pequenos y responsabilidades claras.

## 4. UX funcional

## 4.1 Panel izquierdo (lista)

Cada item muestra:

1. Telefono enmascarado.
2. Estado conversacional legible.
3. Ultimo mensaje (preview corto).
4. Hora del ultimo evento.
5. Indicador visual del chat activo.

Comportamiento:

1. Click selecciona chat y carga panel derecho.
2. Si no hay seleccion: estado vacio guiado.
3. Scroll independiente.

## 4.2 Panel derecho (mensajes)

Cada mensaje muestra:

1. Burbuja alineada segun direccion:
   - `INBOUND` izquierda.
   - `OUTBOUND` derecha.
2. Texto o fallback legible por tipo.
3. Timestamp.

Reglas:

1. `SUPERVISOR` sin payload tecnico crudo.
2. `ADMIN` puede ver detalle tecnico opcional en bloque secundario colapsable.
3. Sin render de JSON bruto por defecto.

## 5. API backend propuesta

Nuevo modulo: `src/modules/admin-chats`.

Endpoints read-only:

1. `GET /api/admin/chats`
2. `GET /api/admin/chats/:id`
3. `GET /api/admin/chats/:id/messages`

## 5.1 Contrato `GET /api/admin/chats`

Query:

1. `page`, `pageSize`
2. `status?`
3. `phone?`
4. `from?`, `to?`

Respuesta:

1. `items[]` con resumen de chat para sidebar.
2. `total`, `page`, `pageSize`.

## 5.2 Contrato `GET /api/admin/chats/:id`

Respuesta:

1. `id`
2. `participantPhoneMasked`
3. `status`
4. `state`
5. `updatedAtIso`
6. metadata operacional segura.

## 5.3 Contrato `GET /api/admin/chats/:id/messages`

Query:

1. `page`, `pageSize`

Respuesta:

1. `items[]` con:
   - `id`
   - `direction`
   - `messageType`
   - `body`
   - `occurredAtIso`
   - `payload` (solo `ADMIN`, segun policy actual)
2. paginacion estandar.

## 6. Seguridad y permisos

Roles con acceso en fase:

1. `ADMIN`
2. `SUPERVISOR`

Reglas:

1. Guardas: `AdminSessionGuard` + `AdminRolesGuard`.
2. Deny-by-default.
3. `ASESOR` sin acceso fase actual.
4. Auditoria minima:
   - `admin.chat.viewed`
   - `admin.chat.messages_viewed`
5. Sin exponer datos sensibles no necesarios.

## 7. Integracion SSE

1. Reusar stream existente `GET /api/admin/stream`.
2. Invalidar queries de `chats` cuando lleguen eventos relevantes:
   - `message.inbound`
   - `message.outbound`
   - `outbox.failed`
3. Evitar polling agresivo.

## 8. Frontend estructura propuesta

Nuevos bloques:

1. `apps/web/src/features/chats/`
   - `chats.api.ts`
   - `chats.hooks.ts`
   - `chats.types.ts`
2. `apps/web/src/pages/chats-page.tsx`
3. componentes UI acotados:
   - `chat-list-panel.tsx`
   - `chat-thread-panel.tsx`
   - `chat-message-bubble.tsx`

Sidebar:

1. Nuevo item `Chats`.
2. Mantener `Conversations` como modulo tecnico.

## 9. Testing (diseno)

Unit tests:

1. parser de query chats.
2. masking por rol en mensajes.
3. formateo direccional de burbujas.

Integracion:

1. acceso endpoint con `ADMIN`/`SUPERVISOR`.
2. rechazo `401` y `403`.
3. payload tecnico oculto para `SUPERVISOR`.

E2E smoke:

1. abrir `/admin/chats`
2. seleccionar chat
3. visualizar mensajes alineados
4. confirmar degradacion segura sin sesion

## 10. Criterios de aceptacion

1. `Conversations` no cambia comportamiento.
2. `Chats` ofrece lectura clara tipo mensajeria.
3. Mensajes entrantes/salientes alinean correctamente.
4. Seguridad y masking respetan reglas actuales.
5. SSE refresca UI sin recarga manual obligatoria.
6. Codigo modular, tipado estricto y mantenible.
