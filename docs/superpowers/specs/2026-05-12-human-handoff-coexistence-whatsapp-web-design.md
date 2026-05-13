# Flujo: Handoff humano con coexistencia y asesor por WhatsApp Web

## Objetivo

Implementar un flujo de handoff humano seguro y auditable usando la API oficial de WhatsApp Cloud API en modo coexistencia, permitiendo que el asesor atienda desde WhatsApp Web sin construir UI web propia en esta fase.

El flujo debe garantizar:

1. Pausa total de respuestas automaticas del bot durante handoff.
2. Continuidad en el mismo chat del paciente.
3. Reactivacion controlada del bot al finalizar la atencion humana.
4. Respaldo por auto-liberacion con timeout.
5. Trazabilidad completa de eventos y mensajes.

## Alcance

Incluye:

- Activacion real de la opcion `main_menu_human_handoff`.
- Cambio de estado de conversacion a `HUMAN_HANDOFF`.
- Persistencia de sesion de handoff en `bot_handoffs`.
- Bloqueo de respuestas automaticas cuando `status = HUMAN_HANDOFF`.
- Mecanismo de cierre manual sin UI web (CLI interna).
- Mensaje de transicion al reactivar el bot.
- Auto-liberacion por timeout de 12 horas como mecanismo de respaldo.
- Auditoria de inicio, actividad y cierre de handoff.
- Pruebas unitarias y de flujo para reglas criticas.

No incluye:

- Panel web para asesores.
- Integracion con software externo de contact center en esta fase.
- Automatizacion por librerias no oficiales (`whatsapp-web.js`, Baileys, etc.).
- Uso de IA generativa para este flujo.

## Decisiones cerradas

1. El asesor atendera desde WhatsApp Web en modo coexistencia.
2. La conversacion humana ocurre en el mismo chat del paciente.
3. El backend sigue como fuente de verdad de estado y auditoria.
4. El handoff se cierra por operacion interna mediante CLI.
5. Al cerrar handoff y reactivar bot, se envia exactamente este mensaje:

`Tu atencion con asesor finalizo. Si deseas, continua por este medio con el menu.`

6. Habra auto-liberacion por timeout de 12 horas solo como respaldo operativo.

## Reglas funcionales

### Regla de inicio de handoff

1. Paciente selecciona `main_menu_human_handoff`.
2. Backend registra handoff activo en `bot_handoffs`.
3. Conversacion pasa a:
   - `status = HUMAN_HANDOFF`
   - `state` se conserva o se fija en un estado neutro de salida segun implementacion final.
4. Bot envia un mensaje de confirmacion de escalamiento humano.

### Regla durante handoff activo

1. Si `status = HUMAN_HANDOFF`, el orquestador no genera respuestas automaticas.
2. Se siguen recibiendo webhooks y guardando mensajes inbound/outbound/system.
3. Se mantiene idempotencia y reglas anti-duplicado de webhook.
4. La conversacion no vuelve a bot automaticamente por texto libre del paciente.

### Regla de cierre manual de handoff

1. Operacion ejecuta comando CLI interno `handoff:close`.
2. El cierre manual:
   - marca `bot_handoffs.isActive = false`
   - define `bot_handoffs.endedAt = now`
   - actualiza conversacion a `status = BOT_ACTIVE`
   - actualiza conversacion a `state = MAIN_MENU`
   - limpia contexto transaccional sensible del flujo
3. Se envia mensaje de transicion oficial al paciente:

`Tu atencion con asesor finalizo. Si deseas, continua por este medio con el menu.`

### Regla de auto-liberacion por timeout (respaldo)

1. Un job periodico revisa handoffs activos con antiguedad mayor a 12 horas.
2. Si el handoff califica para cierre automatico:
   - se cierra con razon `AUTO_TIMEOUT`
   - se reactiva `BOT_ACTIVE` en `MAIN_MENU`
   - se envia el mismo mensaje de transicion
3. El timeout no reemplaza el cierre manual; solo evita conversaciones bloqueadas indefinidamente.

## Arquitectura y capas

Se mantiene arquitectura actual: modular monolith + hexagonal + state machine.

### Capa conversaciones

Cambios:

- `main-menu.handler.ts`
  - enrutar `main_menu_human_handoff` a caso de uso de inicio de handoff.
- `handle-incoming-conversation-message.use-case.ts`
  - mantener guard clause: si `status != BOT_ACTIVE`, no responder automatico.
  - reforzar auditoria de mensajes recibidos durante handoff.
- nuevo caso de uso `start-human-handoff.use-case.ts`
- nuevo caso de uso `close-human-handoff.use-case.ts`

### Capa persistencia

Cambios:

- Nuevo repositorio de handoff sobre `bot_handoffs`.
- Operaciones minimas:
  - `start`
  - `findActiveByConversationKey`
  - `closeActive`
  - `findStaleActive`

### Capa jobs

Cambios:

- Job BullMQ `release-stale-handoffs` (cada 5-10 min).
- Idempotencia obligatoria por `conversationKey + handoffId + reason`.

### Capa auditoria

Se mantienen adaptadores existentes y se agregan eventos de dominio del flujo handoff.

## Modelo de datos

Se reutiliza estructura existente:

- `bot_conversations.status`: `BOT_ACTIVE | HUMAN_HANDOFF | CLOSED | EXPIRED`
- `bot_handoffs`:
  - `conversationId`
  - `isActive`
  - `assignedTo` (opcional en esta fase)
  - `note` (opcional)
  - `startedAt`
  - `endedAt`

No se requieren cambios de esquema para esta fase si la tabla actual ya esta desplegada como en `prisma/bot/schema.prisma`.

## Seguridad y cumplimiento

1. No exponer datos sensibles en logs ni auditoria sin masking.
2. No incluir documento completo, fecha de nacimiento completa ni contenido clinico innecesario en eventos.
3. CLI de cierre manual restringida a operadores autorizados.
4. Endpoint interno (fase posterior) debe incluir autenticacion fuerte, autorizacion por rol y rate limit.
5. Mantener uso exclusivo de canal oficial Meta WhatsApp Cloud API.

## Auditoria obligatoria

Eventos minimos:

- `conversation.handoff.started`
- `conversation.handoff.message_logged`
- `conversation.processing.skipped` (razon `HUMAN_HANDOFF`)
- `conversation.handoff.ended.manual`
- `conversation.handoff.ended.timeout`
- `conversation.transition.message.sent`
- `conversation.status.changed`

Metadata minima sugerida:

- `conversationKey`
- `conversationId` (si aplica)
- `handoffId`
- `reason` (`MANUAL` | `AUTO_TIMEOUT`)
- `operator` (manual)
- `previousStatus`
- `nextStatus`
- `occurredAt`

## Manejo de errores

1. Si falla el cierre de handoff en DB, no enviar mensaje de transicion y registrar error auditable.
2. Si falla envio del mensaje de transicion, mantener handoff cerrado y reintentar envio via outbox.
3. Si se intenta cerrar un handoff ya cerrado, responder idempotente sin error funcional.
4. Si el job timeout falla en una conversacion, registrar y continuar con siguientes items.

## Criterios de aceptacion

1. Seleccionar `Asesor humano` cambia la conversacion a `HUMAN_HANDOFF`.
2. Durante `HUMAN_HANDOFF`, el bot no responde automaticamente.
3. Mensajes entrantes y salientes durante handoff quedan persistidos y auditados.
4. Cierre manual reactiva el bot en `MAIN_MENU` y envia mensaje de transicion exacto.
5. Auto-liberacion por timeout de 12h cierra handoff y envia el mismo mensaje.
6. No se introducen librerias no oficiales de WhatsApp.
7. Pruebas relevantes de flujo y unidad quedan en verde.

## Plan de implementacion sugerido

### Fase 1: Inicio y pausa de bot

- Activar opcion `main_menu_human_handoff`.
- Crear caso de uso `start-human-handoff`.
- Persistir `bot_handoffs` y actualizar `status = HUMAN_HANDOFF`.
- Asegurar bloqueo de auto-respuesta.

### Fase 2: Cierre manual sin UI

- Crear CLI `handoff:close`.
- Implementar `close-human-handoff.use-case`.
- Reactivar bot en `BOT_ACTIVE + MAIN_MENU`.
- Enviar mensaje de transicion oficial.

### Fase 3: Timeout de respaldo

- Crear job BullMQ `release-stale-handoffs`.
- Cerrar handoffs > 12h con razon `AUTO_TIMEOUT`.
- Reusar logica de cierre manual para consistencia.

### Fase 4: Pruebas y endurecimiento

- Unit tests de use cases.
- Tests de flujo conversacional.
- Verificacion de auditoria y outbox.

## Comandos operativos propuestos

Inicio manual opcional (si se requiere fuera de menu):

```bash
pnpm handoff:start --conversation-key <key> --assigned-to <operator> --note "motivo"
```

Cierre manual con reactivacion:

```bash
pnpm handoff:close --conversation-key <key> --resolution resume --note "asesoria finalizada"
```

Cierre manual definitivo:

```bash
pnpm handoff:close --conversation-key <key> --resolution close --note "caso cerrado por asesor"
```

Consulta operativa:

```bash
pnpm handoff:list --active
```

## Fuera de alcance inmediato (fase posterior)

1. Endpoint interno protegido para cerrar/gestionar handoff sin CLI.
2. Panel web de asesores.
3. Integracion con plataforma de contact center.
