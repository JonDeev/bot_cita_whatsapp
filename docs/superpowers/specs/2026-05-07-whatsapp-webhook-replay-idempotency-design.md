# Proteccion contra replay de webhooks y trazabilidad temporal en WhatsApp

## Objetivo

Evitar que el bot responda a eventos entrantes viejos, reprocesados o fuera de contexto, y corregir la trazabilidad temporal para que los tiempos de proveedor, recepcion, persistencia y envio no se mezclen.

El comportamiento esperado es:

1. Si un webhook entrante ya fue procesado antes, el sistema no debe volver a ejecutar logica conversacional ni enviar respuestas.
2. Si un reply interactivo llega tarde o fuera de contexto, el sistema debe auditarlo y descartarlo sin responder automaticamente.
3. Si Redis pierde la sesion, el sistema debe poder reconstruir el estado conversacional desde persistencia durable antes de asumir una conversacion nueva.
4. Los tiempos guardados en base de datos deben distinguir claramente:
   1. cuando ocurrio el evento en Meta
   2. cuando lo recibio el backend
   3. cuando el backend persistio el registro
   4. cuando el backend envio el outbound

## Problema observado

Se presento un incidente donde el bot envio `Escribe tu numero de documento de identidad.` al numero `573043477809` el `2026-05-07` sin interaccion aparente del usuario en ese momento.

La evidencia tecnica indica:

1. El webhook entrante fue aceptado el `2026-05-07T12:44:15Z`.
2. El evento normalizado fue `incoming_message_received`.
3. El `interactiveReplyId` guardado fue `main_menu_request_appointment`.
4. El `occurred_at` del mensaje inbound y del outbound asociado quedo con fecha `2026-05-04 16:17:47`.
5. La sesion activa se busca solo en Redis con TTL de 24 horas.
6. La deduplicacion actual depende de Redis y tambien expira.

Conclusion funcional:

1. El bot no se activo solo.
2. El backend recibio un evento entrante viejo o reprocesado.
3. Como la deduplicacion y la sesion activa no son durables, el sistema trato el evento como nuevo.
4. Al no encontrar sesion activa, reconstruyo una conversacion en `MAIN_MENU`.
5. El handler de `MAIN_MENU` interpreto el `interactiveReplyId` y avanzo a `WAITING_DOCUMENT`.
6. El outbound quedo con un `occurred_at` incorrecto porque reutiliza el timestamp del inbound.

## Alcance

Incluye:

1. Inbox durable de webhooks entrantes.
2. Idempotencia persistente por `messageId` y clave de deduplicacion.
3. Validacion de antiguedad para eventos entrantes, especialmente interactivos.
4. Validacion de contexto para replies interactivos.
5. Recuperacion de sesion desde MySQL cuando Redis no tenga estado.
6. Correccion de la semantica temporal en `bot_messages` y `bot_audit_events`.
7. Auditoria explicita de eventos descartados por duplicado, stale o contexto invalido.
8. Pruebas unitarias y de integracion orientadas al replay.

No incluye:

1. Cambios de contenido conversacional del menu principal.
2. Nuevas capacidades funcionales de citas, cancelacion o reagendamiento.
3. Cambios de handoff humano fuera de proteger el motor frente a eventos viejos.
4. Cambios de UI o panel administrativo.
5. Uso de IA o cambios de proveedor WhatsApp.

## Causas raiz

### Causa 1: idempotencia temporal, no durable

La deduplicacion actual depende de Redis con TTL de 24 horas. Si el mismo evento vuelve a llegar despues de esa ventana, el sistema puede aceptarlo otra vez.

Riesgo:

1. Replays tardios del proveedor.
2. Reentregas operativas despues de reinicios.
3. Poca trazabilidad historica de por que se acepto o descarto un evento.

### Causa 2: estado de sesion no recuperable desde persistencia durable

La sesion conversacional se lee solo desde Redis. Si Redis expira o se vacia, el backend crea una sesion nueva en `MAIN_MENU` aunque la conversacion ya tenga historial persistido.

Riesgo:

1. Reabrir flujos viejos como si fueran nuevos.
2. Perder continuidad conversacional real.
3. Responder automaticamente a replies que ya no corresponden al contexto actual.

### Causa 3: reply interactivo no validado contra contexto vigente

Hoy el sistema acepta `interactiveReplyId` por su valor funcional, pero no valida si ese reply corresponde al ultimo menu valido enviado ni si el evento llego dentro de una ventana razonable.

Riesgo:

1. Ejecutar intenciones viejas.
2. Mover estado por replies desfasados.
3. Aceptar respuestas interactivos sin correlacion suficiente.

### Causa 4: mezcla de tiempos con distinta semantica

El inbound usa el timestamp del proveedor para `occurred_at`, pero el outbound tambien reutiliza ese mismo timestamp. Ademas, la auditoria usa UTC y se persiste en columnas `DATETIME` sin dejar explicita la convencion operativa.

Riesgo:

1. Confusion entre hora real de recepcion y hora del evento proveedor.
2. Confusion entre hora real de envio y hora del inbound que disparo la respuesta.
3. Dificultad forense y operativa al revisar SQL manualmente.

## Enfoque recomendado

Se mantiene modular monolith + arquitectura hexagonal.

La solucion se apoya en cuatro decisiones:

1. Introducir un `webhook inbox` durable en MySQL.
2. Hacer la idempotencia definitiva contra MySQL y usar Redis solo como optimizacion.
3. Recuperar sesion desde persistencia durable cuando Redis falle o expire.
4. Separar los tiempos de proveedor, recepcion, persistencia y envio.

## Diseño por capas

### Capa de dominio WhatsApp

Nuevos conceptos:

1. `WebhookInboxEvent`
2. `WebhookProcessingStatus`
3. `WebhookRejectionReason`

Nuevo puerto:

1. `webhook-inbox.repository.ts`

Responsabilidades del puerto:

1. Registrar un evento recibido con su metadata normalizada.
2. Garantizar unicidad por `deduplicationKey`.
3. Consultar si un evento ya existe y en que estado quedo.
4. Marcar resultado de procesamiento:
   1. `PROCESSED`
   2. `DUPLICATE`
   3. `SKIPPED_STALE`
   4. `SKIPPED_INVALID_CONTEXT`
   5. `FAILED`

### Capa de aplicacion WhatsApp

El `ProcessWhatsappWebhookUseCase` debe cambiar su responsabilidad de:

1. parsear
2. consultar Redis
3. orquestar

a este flujo:

1. validar firma del webhook
2. parsear payload y enriquecer eventos normalizados
3. calcular `receivedAt`
4. registrar evento en inbox durable
5. decidir si es duplicado, stale o invalido
6. solo si es valido y nuevo, entregar al orquestador
7. marcar resultado final en inbox y auditoria

### Capa de dominio Conversaciones

El puerto `ConversationPersistenceRepository` debe dejar de ser solo `upsert`.

Debe poder:

1. `findByKey(conversationKey)`
2. `upsert(session)`

Esto permite recuperar una conversacion durable cuando Redis no la tenga.

### Capa de aplicacion Conversaciones

`HandleIncomingConversationMessageUseCase` debe resolver la sesion asi:

1. buscar en Redis
2. si no existe, buscar en persistencia MySQL
3. si existe en MySQL, reconstruir sesion y restaurarla en Redis
4. solo si no existe en ningun lado, crear sesion inicial

Adicionalmente, antes de ejecutar handlers interactivos debe poder validar:

1. antiguedad del evento
2. correlacion con contexto conversacional vigente

### Capa de infraestructura MySQL

Nuevos adapters:

1. `prisma-bot-webhook-inbox.repository.ts`
2. extension del repositorio de persistencia de conversacion para `findByKey`

Responsabilidades:

1. persistir webhook events con unicidad fuerte
2. recuperar estado durable de conversacion
3. no contener logica conversacional

## Modelo de datos propuesto

### Nueva tabla `bot_webhook_events`

Campos recomendados:

1. `id`
2. `deduplication_key`
3. `provider_message_id`
4. `event_kind`
5. `phone_number_id`
6. `participant_phone`
7. `message_type`
8. `interactive_reply_id`
9. `context_message_id`
10. `provider_occurred_at`
11. `received_at`
12. `processed_at`
13. `signature_valid`
14. `payload_hash`
15. `payload`
16. `processing_status`
17. `rejection_reason`
18. `error_message`
19. `created_at`
20. `updated_at`

Indices recomendados:

1. unico por `deduplication_key`
2. indice por `provider_message_id`
3. indice por `event_kind, received_at`
4. indice por `participant_phone, received_at`

### Ajustes a `bot_messages`

Se recomienda introducir semantica explicita:

1. inbound:
   1. `provider_occurred_at`
   2. `received_at`
2. outbound:
   1. `sent_at`

Si no se hace cambio fisico inmediato de esquema, la implementacion transitoria debe al menos asegurar:

1. `occurred_at` del inbound = tiempo del proveedor
2. `occurred_at` del outbound = hora real de envio o persistencia del outbound
3. nunca reutilizar el timestamp del inbound para el outbound

## Eventos normalizados

`NormalizedWhatsappEvent` debe enriquecerse para soportar decisiones seguras.

Campos nuevos recomendados para `incoming_message_received`:

1. `providerOccurredAt`
2. `receivedAt`
3. `contextMessageId`
4. `rawField`
5. `rawChangeType`

Esto permite:

1. diferenciar la hora del proveedor frente a la hora real de recepcion
2. detectar replies interactivos stale
3. correlacionar replies con mensajes previamente enviados

## Reglas funcionales nuevas

### Regla de deduplicacion

Un evento no debe procesarse mas de una vez si comparte la misma `deduplicationKey`.

La `deduplicationKey` debe construirse de forma determinista:

1. inbound: `incoming:{messageId}`
2. status: `status:{messageId}:{status}:{timestamp}`

La verificacion definitiva se hace contra MySQL. Redis queda como acelerador opcional.

### Regla de antiguedad

Los eventos `interactive` deben ser descartados si exceden una ventana maxima configurable entre `providerOccurredAt` y `receivedAt`.

Recomendacion inicial:

1. `interactive`: ventana corta y estricta
2. `text`: ventana mas permisiva, configurable

Al descartarse:

1. no se cambia estado
2. no se envia outbound automatico
3. se registra auditoria y estado en inbox

### Regla de contexto interactivo

Un reply interactivo solo puede considerarse valido si:

1. la conversacion esta en estado `BOT_ACTIVE`
2. existe contexto conversacional vigente compatible con el reply
3. el reply corresponde al ultimo mensaje interactivo valido o a una accion aun vigente

Si el sistema no puede validar el contexto:

1. no responde automaticamente
2. audita `SKIPPED_INVALID_CONTEXT`

### Regla de reconstruccion de sesion

Si Redis no tiene sesion:

1. primero se consulta MySQL
2. si MySQL tiene una conversacion activa, esa es la fuente de verdad
3. la sesion se restablece en Redis con TTL renovado
4. solo si no hay registro durable, se crea una sesion nueva

### Regla de tiempo interno

La politica oficial del backend sera:

1. guardar todos los tiempos tecnicos en UTC
2. tratar `created_at`, `received_at`, `processed_at`, `sent_at` y `provider_occurred_at` como UTC
3. convertir a `America/Bogota` solo en consultas operativas, reportes o UI

## Auditoria

Nuevos eventos recomendados:

1. `whatsapp.webhook.received`
2. `whatsapp.webhook.persisted`
3. `whatsapp.webhook.duplicate_skipped`
4. `whatsapp.webhook.stale_skipped`
5. `whatsapp.webhook.invalid_context_skipped`
6. `conversation.session.restored_from_persistence`
7. `conversation.session.created_from_scratch`
8. `whatsapp.outbound.sent`

Campos minimos de auditoria:

1. `conversationKey`
2. `messageId`
3. `eventKind`
4. `messageType`
5. `interactiveReplyId`
6. `providerOccurredAt`
7. `receivedAt`
8. `deduplicationKey`
9. `rejectionReason`
10. `ageSeconds`

No registrar payloads sensibles completos en auditoria textual. El payload detallado vive en la inbox durable.

## Manejo de errores

### Error al persistir inbox

1. no procesar el evento
2. responder HTTP 200 si el webhook ya fue aceptado a nivel de proveedor y el error es controlado de duplicado
3. responder controladamente segun estrategia de resiliencia si es un error real de persistencia
4. auditar `FAILED`

### Error al restaurar sesion

1. no asumir automaticamente una sesion nueva si hay inconsistencia durable
2. auditar el error
3. evitar responder automaticamente cuando exista duda de contexto

### Error al validar antiguedad o contexto

1. aplicar politica conservadora
2. preferir no responder
3. registrar la causa exacta del descarte

## Configuracion

Variables nuevas recomendadas:

1. `WHATSAPP_INTERACTIVE_EVENT_MAX_AGE_SECONDS`
2. `WHATSAPP_TEXT_EVENT_MAX_AGE_SECONDS`
3. `WHATSAPP_RESTORE_SESSION_FROM_PERSISTENCE=true`
4. `WHATSAPP_STORE_WEBHOOK_PAYLOADS=true`

La configuracion por defecto debe ser segura y conservadora.

## Plan de implementacion

### Fase 1: inbox durable e idempotencia persistente

1. agregar tabla `bot_webhook_events`
2. crear puerto y adapter Prisma
3. registrar cada evento recibido antes de orquestar
4. cortar reprocesamiento por clave unica durable

### Fase 2: recuperacion de sesion durable

1. extender `ConversationPersistenceRepository`
2. recuperar conversacion desde MySQL cuando Redis falle
3. rehidratar Redis desde persistencia

### Fase 3: validacion de contexto y antiguedad

1. enriquecer eventos normalizados
2. validar replies interactivos stale
3. validar contexto vigente

### Fase 4: limpieza de semantica temporal

1. separar claramente tiempos del proveedor y tiempos internos
2. dejar de reutilizar timestamp inbound para outbound
3. ajustar auditoria y mensajes persistidos

## Estrategia de despliegue

1. desplegar primero cambios aditivos de esquema y persistencia
2. activar inbox durable sin bloquear todavia, solo observando
3. validar que los eventos nuevos se persisten correctamente
4. activar bloqueo de duplicados durables
5. activar validacion stale para `interactive`
6. finalmente activar restauracion durable de sesion y ajustes temporales

Esto permite rollout progresivo y menor riesgo operacional.

## Pruebas

### Unitarias

1. `ProcessWhatsappWebhookUseCase` descarta duplicado ya persistido.
2. `ProcessWhatsappWebhookUseCase` marca `SKIPPED_STALE` cuando corresponde.
3. `HandleIncomingConversationMessageUseCase` restaura sesion desde persistencia cuando Redis no la tiene.
4. `MainMenuHandler` no cambia de estado si el evento interactivo fue descartado antes.
5. El repositorio de mensajes no reutiliza el timestamp inbound para outbound.

### Integracion

1. mismo `messageId` reenviado despues de 24 horas no produce nuevo outbound.
2. reply interactivo viejo con Redis vacio no crea una conversacion nueva utilizable.
3. si existe conversacion durable activa, el estado se restaura correctamente.
4. los tiempos persistidos distinguen:
   1. proveedor
   2. recepcion
   3. envio

### Regresion

1. mensajes nuevos y validos siguen funcionando igual.
2. respuestas `interactive` actuales siguen resolviendo flujo cuando estan dentro de ventana y contexto.
3. estados `message_status_changed` siguen auditandose sin afectar la conversacion.

## Riesgos y mitigaciones

### Riesgo 1: payloads de webhook aumentan almacenamiento

Mitigacion:

1. guardar payload JSON solo para eventos entrantes relevantes
2. aplicar politica de retencion si hace falta mas adelante

### Riesgo 2: rechazar replies validos por una ventana demasiado corta

Mitigacion:

1. hacer la ventana configurable
2. empezar solo con `interactive`
3. revisar metricas antes de endurecer mas

### Riesgo 3: restaurar una sesion durable inconsistente

Mitigacion:

1. usar politica conservadora
2. si el contexto no es confiable, no responder automaticamente
3. auditar para analisis posterior

## Criterios de aceptacion

1. Un evento inbound replayado no puede volver a disparar respuesta automatica aunque lleguen dias despues.
2. Un reply interactivo viejo no puede mover estado si la sesion activa ya expiro y el contexto no es valido.
3. Si Redis pierde la sesion, el backend puede restaurarla desde MySQL antes de crear una nueva.
4. `bot_messages` ya no mezcla el tiempo del inbound con el tiempo real del outbound.
5. El equipo puede diferenciar operativamente en BD:
   1. hora del proveedor
   2. hora de recepcion
   3. hora de persistencia
   4. hora de envio
6. Toda decision de descarte queda auditada con razon explicita.
