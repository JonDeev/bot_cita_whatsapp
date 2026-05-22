# Diseno: validacion por prompt interactivo activo para replies de WhatsApp

## Resumen

Se reemplazara la proteccion basada en antiguedad general del `contextMessageId` por una validacion basada en el prompt interactivo activo de la conversacion.

El objetivo es corregir el bug donde un reply viejo o entregado tarde puede mover la conversacion a un estado incorrecto, sin romper el comportamiento legitimo de WhatsApp donde un paciente puede responder varios minutos despues a un menu aun vigente.

Adicionalmente, este diseno define la politica de abandono por inactividad para conversaciones en `BOT_ACTIVE`, con recordatorio previo y expiracion controlada.

La regla principal sera:

1. Un reply interactivo solo se ejecuta si corresponde a una instancia valida dentro de la ventana de prompts vigente para la conversacion.
2. Si el reply pertenece a un prompt viejo o no coincide con el contexto vigente, el bot no ejecuta la accion.
3. En ese caso, el bot auditara el descarte, marcara el webhook como contexto invalido y reenviara el prompt vigente del estado actual con un mensaje breve de recuperacion.

## Problema observado

Se detecto un incidente donde la conversacion avanzo desde `MAIN_MENU` hacia `WAITING_DOCUMENT` sin una interaccion aparente reciente del paciente.

La evidencia tecnica mostro:

1. El evento aceptado fue `incoming_message_received`.
2. El `interactiveReplyId` recibido correspondia a una opcion real del menu principal.
3. El `contextMessageId` apuntaba a un mensaje outbound antiguo.
4. El backend acepto ese contexto por existir historicamente, aunque ya no fuera el prompt vigente de la conversacion.

El intento inicial de mitigacion por edad del contexto reduce el incidente observado, pero introduce una regresion funcional:

1. Un paciente puede responder validamente a un menu despues de 15, 20 o 30 minutos.
2. El canal de WhatsApp es asincronico y no debe depender de ventanas de tiempo duras como control principal.
3. La navegacion `nav_*` aun podria colarse sin validacion fuerte del contexto esperado.

Conclusion:

La validacion correcta no es por tiempo general, sino por identidad de la instancia vigente esperada dentro de `interactivePromptWindow`.

## Objetivo funcional

Cuando llegue un mensaje `interactive`, el sistema debe decidir si ese reply corresponde a una instancia valida dentro de la ventana de prompts vigente para esa conversacion.

Comportamiento esperado:

1. Si el reply coincide con una instancia valida de la ventana, se procesa normalmente.
2. Si el reply corresponde a un prompt viejo o no permitido para el estado actual, no se procesa.
3. En ese caso el paciente recibe un mensaje corto:

```txt
Esa opcion ya no esta activa. Te envio el paso actualizado.
```

4. Despues del mensaje de recuperacion, el bot reenviara el prompt vigente del estado actual.
5. El evento quedara auditado y persistido como descarte por contexto invalido.

## Alcance

Incluye:

1. Nuevo modelo de ventana de prompts interactivos vigentes en `ConversationSessionContext`.
2. Registro de la ventana de prompts interactivos validos al enviar listas y botones.
3. Validacion de replies interactivos contra la ventana de prompts vigente.
4. Fallback conversacional al prompt vigente cuando el contexto sea invalido o desactualizado.
5. Tratamiento consistente para opciones de navegacion `nav_*`.
6. Politica unica de inactividad para conversaciones en `BOT_ACTIVE`.
7. Recordatorio por inactividad con reenvio del prompt vigente.
8. Expiracion controlada de conversaciones abandonadas y reapertura segura en `MAIN_MENU`.
9. Actualizacion de `bot_webhook_events.processing_status` para distinguir descartes por contexto invalido.
10. Cobertura de pruebas unitarias del flujo de validacion, recuperacion y expiracion.

No incluye:

1. Cambios funcionales en agendamiento, cancelacion, reschedule o dispensario.
2. Cambios en handoff humano.
3. Reestructuracion completa del pipeline de outbox.
4. Cambios de proveedor o uso de IA.

## Decisiones cerradas

1. La opcion elegida por producto es reenviar el prompt vigente del estado actual cuando llegue una interaccion desactualizada.
2. La validacion principal sera por ventana de prompts vigente, no por antiguedad arbitraria.
3. La edad maxima podra existir solo como defensa secundaria opcional, nunca como criterio principal de aceptacion.
4. Las opciones `nav_back`, `nav_main_menu` y `nav_finish` no tendran bypass libre; tambien deberan corresponder a la ventana de prompts vigente.
5. Los descartes por contexto invalido deben reflejarse tanto en auditoria como en `bot_webhook_events.processing_status`.

## Diseno de dominio

### Nuevo concepto: `InteractivePromptWindow`

Agregar a `ConversationSessionContext` una estructura con esta semantica:

```txt
interactivePromptWindow
  currentPromptId
  prompts[]
```

Cada item de `prompts[]` tendra:

```txt
promptId
logicalStepKey
promptKind
state
outboundMessageId
allowedReplyIds[]
issuedAt
source
validUntil?
```

Campos:

1. `currentPromptId`
   - Identifica la instancia principal y vigente del paso actual.

2. `promptId`
   - Identificador interno unico de la instancia del prompt.

3. `logicalStepKey`
   - Identificador estable del paso logico exacto del flujo.
   - Debe distinguir prompts distintos dentro del mismo `state`.
   - Ejemplos:
   - `MAIN_MENU:ROOT`
   - `SELECTING_SPECIALTY:PAGE_1`
   - `SELECTING_ASSIGNED_APPOINTMENT:OFFSET_0`
   - `NAVIGATION:SELECTING_APPOINTMENT_DATE`

4. `promptKind`
   - Identificador semantico del prompt, por ejemplo:
   - `MAIN_MENU`
   - `NAVIGATION`
   - `SPECIALTY_SELECTION`
   - `ASSIGNED_APPOINTMENT_SELECTION`
   - `CONTACT_CONFIRMATION`
   - `CONTACT_UPDATE_FIELD_SELECTION`

5. `state`
   - Estado conversacional al que pertenece el prompt.

6. `outboundMessageId`
   - `wamid` del mensaje interactivo enviado por WhatsApp.

7. `allowedReplyIds`
   - Lista exacta de ids permitidos para ese prompt.

8. `issuedAt`
   - Timestamp ISO del momento de envio.

9. `source`
   - `ORIGINAL` o `IDLE_REMINDER_REISSUE`.

10. `validUntil`
   - Opcional.
   - No sera obligatorio para la primera implementacion.
   - Si se usa en el futuro, actuara como defensa adicional.

### Regla de cardinalidad

1. En operacion normal, la ventana tendra una sola instancia valida.
2. Durante la tolerancia del reminder por inactividad, la ventana podra tener como maximo dos instancias validas del mismo paso logico:
   - la principal reenviada por el reminder
   - la inmediatamente anterior del mismo `logicalStepKey`
3. No se permite coexistencia de prompts validos de estados distintos.
4. Cuando el estado cambie o la conversacion expire, se invalidan todas las instancias de la ventana.

### Regla de validez

Un `interactive` inbound se considera valido solo si:

1. Existe `interactivePromptWindow` en la sesion.
2. El reply pertenece al `state` actual esperado o a la reconstruccion legitima de ese estado.
3. El `interactiveReplyId` esta incluido en `allowedReplyIds` de una instancia valida dentro de la ventana.
4. Si el evento trae `contextMessageId`, debe coincidir con el `outboundMessageId` de una instancia valida dentro de la ventana.
5. Si el evento no trae `contextMessageId`, solo se acepta si se cumple una de estas condiciones:
   - existe exactamente una instancia valida compatible dentro de la ventana actual
   - existen exactamente dos instancias validas compatibles y ambas pertenecen al mismo `logicalStepKey`, porque corresponden al prompt principal actual y a su reenvio por reminder
6. Si existen varias instancias compatibles y no pertenecen al mismo `logicalStepKey`, el sistema no debe adivinar; debe tratar el evento como contexto invalido y recuperar el flujo.
7. La tolerancia del reminder por inactividad solo puede aplicar cuando ambas instancias compatibles comparten:
   - `logicalStepKey`
   - `state`
   - `promptKind`
   - `allowedReplyIds`

## Cambios conversacionales

### Al enviar un prompt interactivo

Cada vez que el sistema envie un `interactive_list` o `interactive_buttons`, debe:

1. Persistir normalmente el mensaje outbound.
2. Actualizar la sesion con un nuevo prompt interactivo principal dentro de `interactivePromptWindow`.
3. Invalidar prompts interactivos anteriores de otros estados o de otros pasos logicos.
4. Permitir coexistencia transitoria solo con la instancia interactiva inmediatamente anterior del mismo `logicalStepKey` cuando el nuevo envio corresponda a un reminder por inactividad.

### Al enviar mensajes no interactivos

Cuando un estado ya no espere respuesta interactiva, el sistema debe limpiar `interactivePromptWindow`.

Ejemplos:

1. `WAITING_DOCUMENT`
2. `WAITING_BIRTH_DATE`
3. `UPDATING_CONTACT_PHONE`
4. `UPDATING_CONTACT_EMAIL`

### Al recibir un interactive valido

1. Se procesa el handler o comando correspondiente.
2. Si ese procesamiento genera un nuevo prompt interactivo, la sesion se actualiza con la nueva ventana de prompts validos.
3. Si el flujo pasa a una etapa textual, se limpia la ventana de prompts.

### Al recibir un interactive desactualizado o fuera de contexto

1. No se ejecuta la accion del reply recibido.
2. Se audita el descarte con razon semantica.
3. Se responde con mensaje de recuperacion.
4. Se reconstruye el prompt vigente del estado actual usando `ConversationStatePromptService` o el mecanismo equivalente.
5. Se reenvia ese prompt al paciente.
6. La conversacion conserva su estado actual; no debe mutar por el reply invalido.

## Politica de abandono por inactividad

Esta politica aplica solo a conversaciones con `status = BOT_ACTIVE`.

No aplica a conversaciones en `HUMAN_HANDOFF`, que mantienen su propio control operativo de timeout.

### Regla general

Se usara una unica politica de inactividad para cualquier conversacion en `BOT_ACTIVE`, sin diferenciar por estado conversacional.

Cualquier mensaje inbound del paciente reinicia el contador de inactividad.

### Recordatorio por inactividad

Si la conversacion acumula `15 minutos` de inactividad, el sistema debe enviar un unico recordatorio de recuperacion.

El recordatorio debe:

1. enviar un mensaje breve de reactivacion
2. reenviar el prompt vigente del estado actual
3. no cambiar el `state`
4. no cambiar el `status`
5. no enviar mas de un recordatorio por el mismo ciclo de inactividad

El prompt reenviado por el recordatorio pasa a ser la referencia principal del paso actual.

Sin embargo, para evitar friccion de UX en WhatsApp, el sistema podra aceptar de forma transitoria respuestas sobre la instancia interactiva inmediatamente anterior del mismo paso, siempre que:

1. corresponda al mismo `logicalStepKey`
2. corresponda al mismo `state`
3. corresponda al mismo `promptKind`
4. tenga los mismos `allowedReplyIds`
5. la conversacion siga dentro del mismo ciclo de inactividad
6. la conversacion aun no haya expirado

Esta tolerancia no aplica a prompts de otros estados ni a pasos logicos anteriores del flujo.

Mensaje recomendado:

`Seguimos aqui para ayudarte. Si deseas continuar, te envio nuevamente el paso actual.`

### Expiracion por inactividad

Si la conversacion acumula `20 minutos` de inactividad total sin recibir nuevos mensajes inbound del paciente, la conversacion debe pasar a `status = EXPIRED`.

Al expirar la conversacion, el sistema debe:

1. conservar trazabilidad del ultimo `state`
2. invalidar cualquier instancia valida en `interactivePromptWindow`
3. no reenviar el ultimo paso
4. no enviar un mensaje adicional al paciente en el momento exacto de la expiracion

La expiracion silenciosa evita ruido innecesario y reduce mensajes automaticos de bajo valor.

### Reapertura despues de expiracion

Si el paciente vuelve a escribir despues de que la conversacion este en `EXPIRED`, el sistema debe:

1. reabrir la conversacion en `status = BOT_ACTIVE`
2. reiniciar el flujo en `state = MAIN_MENU`
3. limpiar contexto transaccional del flujo anterior
4. enviar un mensaje breve explicando la reanudacion
5. enviar nuevamente el menu principal

Mensaje recomendado:

`Tu sesion anterior finalizo por inactividad. Te comparto nuevamente el menu principal para continuar.`

Esta reapertura no debe retomar el ultimo estado previo, para evitar continuar sobre contexto viejo, incompleto o ya no confiable.

## Manejo de navegacion

Las opciones `nav_back`, `nav_main_menu` y `nav_finish` deben dejar de tratarse como excepcion libre.

Reglas:

1. Si el reply llega con `contextMessageId`, debe coincidir con el `outboundMessageId` de una instancia valida dentro de la ventana.
2. Si el reply no trae `contextMessageId`, se acepta solo si:
   - existe `interactivePromptWindow`
   - el `promptKind` vigente admite navegacion
   - el `interactiveReplyId` esta incluido en `allowedReplyIds`
   - la resolucion cumple exactamente la misma regla general de validez definida para cualquier `interactive`
3. Si cualquiera de esas condiciones falla, se trata como interaccion desactualizada y se reenviara el prompt vigente.

Esto evita que un boton viejo de navegacion cierre o reinicie una conversacion fuera de tiempo.

## Trazabilidad y auditoria

### Auditoria conversacional

Agregar o reutilizar eventos de auditoria con metadata util:

1. `conversation.interactive.reply_accepted`
2. `conversation.interactive.recovery_prompt_reissued`
3. `conversation.interactive.invalid_context_recovered`
4. `conversation.interactive.invalid_context_rejected`
5. `conversation.idle.reminder.sent`
6. `conversation.expired.by_inactivity`
7. `conversation.reopened.after_expiration`

Metadata recomendada:

1. `conversationKey`
2. `messageId`
3. `interactiveReplyId`
4. `contextMessageId`
5. `logicalStepKey`
6. `promptKind`
7. `promptState`
8. `promptOutboundMessageId`
9. `promptId`
10. `reason`
11. `recoveryAction`

Razones minimas:

1. `MISSING_ACTIVE_PROMPT`
2. `REPLY_ID_NOT_ALLOWED`
3. `CONTEXT_MESSAGE_ID_MISMATCH`
4. `MISSING_CONTEXT_MESSAGE_ID_WITHOUT_SAFE_FALLBACK`
5. `PROMPT_STATE_MISMATCH`

### Estado del webhook

El pipeline de webhook debe distinguir entre:

1. evento rechazado sin side effects conversacionales
2. evento invalido que disparo recuperacion conversacional

Comportamiento esperado:

1. Si el evento fue omitido por contexto invalido sin enviar mensajes de recuperacion, `bot_webhook_events.processing_status` debe quedar en `SKIPPED_INVALID_CONTEXT`.
2. Si el evento fue manejado con recuperacion conversacional y genero outbound de recuperacion, `bot_webhook_events.processing_status` debe quedar en `PROCESSED`.
3. En ambos casos, la auditoria debe distinguir explicitamente entre `invalid_context_rejected` y `invalid_context_recovered`.
4. `rejection_reason` debe guardar una razon concreta y estable cuando aplique.

Esto mejora operacion, soporte y analisis forense sin mezclar descartes puros con recuperaciones exitosas.

## Cambios de aplicacion

### `HandleIncomingConversationMessageUseCase`

Debe dejar de resolver replies interactivos con la heuristica:

```txt
mensaje outbound conocido + edad del contexto
```

Y pasar a:

```txt
prompt interactivo activo esperado + reply permitido + correlacion segura
```

Responsabilidades nuevas:

1. Validar el inbound interactivo contra `session.context.interactivePromptWindow`.
2. Retornar un resultado estructurado de procesamiento, no solo outbound messages.
3. Diferenciar:
   - `HANDLED`
   - `RECOVERED_INVALID_CONTEXT`
   - `REJECTED_INVALID_CONTEXT`
4. Cuando el contexto sea invalido:
   - conservar estado
   - decidir si corresponde recuperacion conversacional o rechazo puro
   - preparar mensaje de recuperacion cuando aplique
   - reconstruir el prompt vigente cuando aplique

### Resultado estructurado

El caso de uso debe exponer un resultado con semantica suficiente para el webhook:

```txt
status
outboundMessages
skipReason?
```

Estados minimos:

1. `HANDLED`
2. `RECOVERED_INVALID_CONTEXT`
3. `REJECTED_INVALID_CONTEXT`
4. `SKIPPED_CONVERSATION_STATUS`

Esto permite que `ProcessWhatsappWebhookUseCase` persista el `processingStatus` correcto.

### `ConversationOrchestratorService`

Debe propagar el resultado estructurado de conversacion en vez de asumir que todo evento inbound exitosamente ejecutado equivale a `PROCESSED`.

Ademas, al despachar outbounds interactivos, debe poder informar al caso de uso o a la sesion el `messageId` real enviado para registrar la instancia correspondiente dentro de `interactivePromptWindow`.

### Inactividad y expiracion

Se debe agregar un mecanismo de revision periodica para conversaciones `BOT_ACTIVE`.

Responsabilidades minimas:

1. detectar conversaciones con `15 minutos` de inactividad para enviar el recordatorio
2. asegurar que el recordatorio se envie una sola vez por ciclo de inactividad
3. detectar conversaciones con `20 minutos` de inactividad total para marcarlas como `EXPIRED`
4. invalidar `interactivePromptWindow` al expirar
5. permitir que un inbound posterior reabra la conversacion en `MAIN_MENU`
6. usar una fuente de verdad durable y consultable, no solo Redis

## Cambios de infraestructura

### Repositorio de mensajes

El repositorio ya persiste inbound y outbound. Debe seguir permitiendo:

1. guardar inbound
2. guardar outbound
3. consultar outbound conocido

La primera implementacion no necesita ampliar schema de `bot_messages`, porque `interactivePromptWindow` vivira en `bot_conversations.context`.

### Persistencia de sesion

`ConversationSessionContext` ya se serializa completo en:

1. Redis
2. MySQL `bot_conversations.context`

La ventana de prompts puede serializarse en `context`, pero la politica de inactividad no debe depender solo de JSON opaco.

### Campos durables recomendados en `bot_conversations`

Para soportar la politica de inactividad de forma consultable y segura, el spec recomienda agregar columnas durables en `bot_conversations`:

1. `last_inbound_at`
2. `idle_reminder_sent_at`
3. `idle_expires_at`

Reglas:

1. estos campos son la fuente de verdad del scheduler de inactividad
2. Redis puede cachear la sesion, pero no define el reloj oficial
3. solo un inbound del paciente actualiza `last_inbound_at`
4. cada inbound del paciente recalcula `idle_expires_at = last_inbound_at + 20 minutos`
5. un outbound del bot no reinicia la inactividad ni modifica `idle_expires_at`
6. el envio del reminder actualiza `idle_reminder_sent_at`, pero no mueve `idle_expires_at`
7. la expiracion limpia `idle_reminder_sent_at` e invalida la ventana de prompts

### Reapertura desde `EXPIRED`

Cuando llegue un inbound sobre una conversacion en `EXPIRED`, la reapertura debe ocurrir antes de cualquier intento de interpretar el contenido del mensaje como continuation del flujo previo.

Orden obligatorio:

1. detectar `status = EXPIRED`
2. reabrir en `BOT_ACTIVE`
3. limpiar contexto transaccional anterior
4. reiniciar en `MAIN_MENU`
5. enviar mensaje de reapertura y menu principal
6. no intentar validar el inbound contra prompts previos expirados

## Flujo propuesto

### Caso 1: reply valido del menu principal

```txt
Bot envia menu principal
↓
Sesion guarda la ventana de prompts con MAIN_MENU como prompt principal
↓
Paciente responde con opcion valida
↓
Reply coincide con la instancia principal de la ventana de prompts
↓
Se procesa MAIN_MENU handler
↓
Estado cambia a WAITING_DOCUMENT
↓
Se limpia interactivePromptWindow porque el siguiente paso es texto
```

### Caso 2: reply viejo de un menu anterior

```txt
Bot envio un menu antiguo
↓
Luego la conversacion avanzo y cambio la instancia vigente dentro de `interactivePromptWindow`
↓
Paciente pulsa una opcion del menu viejo
↓
Reply no coincide con ninguna instancia valida de la ventana de prompts
↓
No se ejecuta la accion
↓
Se audita contexto invalido
↓
Auditoria marca invalid_context_recovered
↓
Bot responde:
"Esa opcion ya no esta activa. Te envio el paso actualizado."
↓
Bot reenvia el prompt vigente del estado actual
```

### Caso 3: boton viejo de navegacion

```txt
Bot envio botones de navegacion para un estado anterior
↓
El paciente pulsa Volver o Menu principal desde un mensaje viejo
↓
El reply no coincide con ninguna instancia vigente valida de `interactivePromptWindow`
↓
No se ejecuta la navegacion
↓
Se reenvia el prompt vigente del estado actual
```

### Caso 4: recordatorio por inactividad

```txt
Conversacion permanece en BOT_ACTIVE
↓
No entran mensajes del paciente durante 15 minutos
↓
Job detecta inactividad
↓
Bot envia mensaje breve de reactivacion
↓
Bot reenvia el prompt vigente del estado actual
↓
Ese nuevo prompt pasa a ser la referencia principal
↓
El prompt interactivo inmediatamente anterior del mismo paso puede seguir aceptandose de forma transitoria hasta que la conversacion expire o cambie de estado
↓
La conversacion conserva el mismo state y status
```

### Caso 5: expiracion por abandono

```txt
Conversacion permanece en BOT_ACTIVE
↓
No entran mensajes del paciente durante 20 minutos
↓
Job detecta expiracion
↓
Conversacion pasa a EXPIRED
↓
Se invalida interactivePromptWindow
↓
No se envia mensaje adicional al momento exacto de expirar
```

### Caso 6: reapertura luego de expiracion

```txt
Conversacion esta en EXPIRED
↓
Paciente vuelve a escribir
↓
Sistema reabre en BOT_ACTIVE
↓
Sistema reinicia en MAIN_MENU
↓
Bot informa que la sesion anterior finalizo por inactividad
↓
Bot envia nuevamente el menu principal
```

## Manejo de errores

Principios:

1. No exponer detalles internos al paciente.
2. No dejar el evento en silencio si el bot puede recuperar el flujo.
3. No mutar estado conversacional por un inbound interactivo invalido.

Si falla la reconstruccion del prompt vigente:

1. auditar el error
2. responder con un fallback seguro:

```txt
No pudimos continuar con esa opcion. Te envio el menu principal para seguir.
```

3. reenviar `MAIN_MENU`
4. actualizar la sesion con la nueva ventana de prompts del menu principal

## Pruebas requeridas

### Unitarias de conversaciones

1. acepta un reply interactivo valido aunque llegue mucho despues, siempre que siga siendo una instancia valida y vigente dentro de `interactivePromptWindow`
2. rechaza un reply cuyo `interactiveReplyId` no esta dentro de `allowedReplyIds`
3. rechaza un reply con `contextMessageId` distinto al `outboundMessageId` de la instancia vigente esperada
4. rechaza un reply cuando no existe `interactivePromptWindow`
5. reenvia el prompt vigente del estado actual cuando el contexto es invalido
6. no cambia el estado de la sesion cuando el reply es invalido
7. limpia `interactivePromptWindow` al pasar a estados textuales
8. actualiza `interactivePromptWindow` al emitir un nuevo prompt interactivo
9. envia un unico recordatorio a los `15 minutos` de inactividad
10. no cambia el estado al enviar el recordatorio
11. expira la conversacion a los `20 minutos` si no hubo respuesta
12. invalida `interactivePromptWindow` al expirar
13. reabre en `MAIN_MENU` cuando entra un nuevo inbound despues de `EXPIRED`
14. no retoma el ultimo estado previo despues de una expiracion
15. acepta un reply sobre el prompt interactivo inmediatamente anterior despues de enviar el reminder, siempre que corresponda al mismo paso logico y la conversacion no haya expirado
16. rechaza un reply sobre un prompt anterior de otro estado aunque se haya enviado un reminder recientemente

### Unitarias de webhook

1. marca `SKIPPED_INVALID_CONTEXT` cuando conversacion retorna rechazo puro por contexto
2. mantiene `PROCESSED` cuando la interaccion fue aceptada o cuando fue recuperada con outbound de recuperacion

### Regresion del incidente observado

Crear una prueba orientada al caso real:

1. conversacion avanza a un estado posterior
2. queda activo un prompt nuevo
3. entra un reply de un menu viejo historicamente conocido
4. el bot no debe ir a `WAITING_DOCUMENT`
5. el bot debe reenviar el prompt vigente del estado actual

## Estrategia de implementacion

Orden recomendado:

1. extender `ConversationSessionContext` con `interactivePromptWindow`
2. introducir resultado estructurado en `HandleIncomingConversationMessageUseCase`
3. implementar validador de instancia interactiva vigente
4. registrar y limpiar la ventana de prompts en transiciones outbound
5. agregar columnas durables de inactividad en `bot_conversations`
6. implementar la politica de inactividad con recordatorio unico y expiracion
7. integrar diferencia entre `REJECTED_INVALID_CONTEXT` y `RECOVERED_INVALID_CONTEXT` con `ProcessWhatsappWebhookUseCase`
8. agregar pruebas de aceptacion y regresion
9. retirar el control actual basado en `WHATSAPP_INTERACTIVE_CONTEXT_MAX_AGE_SECONDS` como criterio principal

## Riesgos y mitigaciones

### Riesgo 1: no tener `contextMessageId` en todos los replies

Mitigacion:

1. permitir correlacion segura por ventana de prompts vigente + `allowedReplyIds`
2. no aceptar replies sin `contextMessageId` si no existe suficiente evidencia contextual
3. usar `logicalStepKey` para distinguir pasos distintos dentro del mismo estado

### Riesgo 2: reenviar prompts repetidamente ante clientes defectuosos

Mitigacion:

1. auditar frecuencia
2. si se detecta bucle real, agregar rate limiting conversacional despues

### Riesgo 3: acoplar demasiado el orquestador con persistencia de prompt

Mitigacion:

1. mantener `interactivePromptWindow` como dato de sesion
2. encapsular la resolucion en un servicio o helper de aplicacion pequeño

### Riesgo 4: enviar multiples recordatorios por el mismo ciclo de abandono

Mitigacion:

1. persistir una marca de recordatorio enviado por ciclo de inactividad
2. resetear esa marca solo cuando llegue un nuevo inbound del paciente

### Riesgo 5: ambiguedad cuando no llega `contextMessageId`

Mitigacion:

1. aceptar replies sin `contextMessageId` solo si existe exactamente una instancia valida compatible en la ventana actual
2. permitir la excepcion controlada solo cuando existan exactamente dos instancias compatibles del mismo `logicalStepKey` por reenvio de reminder
3. si existen varias instancias compatibles de pasos distintos, no adivinar y recuperar flujo

## Criterios de aceptacion

1. Un reply interactivo viejo no puede mover la conversacion a un estado que ya no corresponde.
2. Un reply interactivo valido sigue funcionando aunque el paciente responda varios minutos despues.
3. Navegacion vieja no puede cerrar ni reiniciar una conversacion fuera de contexto.
4. El paciente recibe una recuperacion clara y el prompt vigente si intenta usar una opcion vieja.
5. Los rechazos puros por contexto invalido quedan auditados y registrados como `SKIPPED_INVALID_CONTEXT`, y las recuperaciones quedan diferenciadas como `PROCESSED` con auditoria de recuperacion.
6. Una conversacion `BOT_ACTIVE` inactiva recibe un unico recordatorio a los `15 minutos`.
7. Si no hay respuesta, la conversacion pasa a `EXPIRED` a los `20 minutos`.
8. La expiracion invalida `interactivePromptWindow` y no reenvia pasos adicionales.
9. Si el paciente vuelve a escribir despues de `EXPIRED`, la conversacion reinicia en `MAIN_MENU`.
10. La correccion queda cubierta por pruebas de regresion del incidente observado y del abandono por inactividad.
