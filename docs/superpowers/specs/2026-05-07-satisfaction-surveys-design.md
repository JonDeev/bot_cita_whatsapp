# Encuestas de satisfaccion post-atencion por WhatsApp

## Objetivo

Implementar el envio automatico de encuestas de satisfaccion para pacientes con citas atendidas, usando la API oficial de Meta WhatsApp Cloud API en modo de coexistencia, con trazabilidad completa, deduplicacion por paciente y cumplimiento de politicas de mensajeria.

El comportamiento esperado es:

1. El sistema ejecuta un proceso automatico cada 30 minutos, de lunes a viernes, desde las 07:30 hasta las 17:00 en `America/Bogota`.
2. En cada ejecucion identifica citas del dia con `agenda.Estado = 'Atendida'`, `agenda.notificacion_encuesta = 'No enviado'` y telefono valido en `usuarios.Telefono`.
3. El sistema envia una sola encuesta por paciente por dia aunque tenga multiples citas atendidas.
4. El primer mensaje se envia con una plantilla oficial aprobada por Meta.
5. Si el paciente acepta responder, el bot realiza las 5 preguntas dentro de la conversacion.
6. Si el paciente rechaza, no conoce a la persona o no responde, el sistema cierra o expira el proceso segun reglas controladas.
7. Todas las acciones quedan auditadas en la base bot sin exponer datos sensibles innecesarios.

## Alcance

Incluye:

- Deteccion automatica de pacientes elegibles por ventana de 30 minutos.
- Dedupe de una encuesta por paciente por dia.
- Persistencia bot para definiciones, despachos, respuestas, bloqueos y consentimientos.
- Envio de plantilla inicial de encuesta por WhatsApp Cloud API.
- Flujo conversacional completo de encuesta con 5 preguntas.
- Manejo de rechazo, telefono desconocido, expiracion y handoff humano.
- Actualizacion operativa controlada de `agenda.notificacion_encuesta`.
- Auditoria, idempotencia, reintentos y pruebas relevantes.

No incluye:

- Panel administrativo para editar encuestas.
- Reporteria BI o dashboard analitico.
- IA generativa para interpretar respuestas.
- Cambio del maestro clinico `usuarios.Telefono`.
- Uso de librerias no oficiales de WhatsApp.

## Decisiones cerradas

1. La encuesta aplica a citas del mismo dia con:
   - `agenda.Estado = 'Atendida'`
   - `agenda.notificacion_encuesta = 'No enviado'`
   - telefono valido en `usuarios.Telefono`
2. El telefono valido en Colombia para este flujo es un numero de 10 digitos que cumple `^3\d{9}$` despues de sanitizar.
3. La fuente del telefono para encuesta sera `usuarios.Telefono`, no `agenda.Telefono`.
4. El sistema enviara solo una encuesta por paciente por dia.
5. Si el paciente tiene varias citas atendidas el mismo dia, la encuesta se asociara a todas las agendas elegibles relacionadas a traves de una tabla puente, pero solo se enviara una vez.
6. El primer mensaje de encuesta sera negocio-iniciado y se enviara mediante una plantilla oficial aprobada por Meta.
7. El primer mensaje usara `reply buttons`, no `list`, porque es el punto de entrada mas seguro para una plantilla de inicio de conversacion.
8. Las preguntas posteriores se responderan dentro de la ventana conversacional de 24 horas con mensajes del bot.
9. Si el paciente responde `No conozco a la persona`, el sistema bloqueara futuros envios de encuestas para ese telefono en la base bot y no modificara `usuarios.Telefono`.
10. Si el paciente no responde o abandona, la encuesta expirara a las 24 horas desde el envio o inicio del flujo.
11. Si la conversacion entra en `HUMAN_HANDOFF`, la encuesta no seguira enviando mensajes automaticos.
12. La columna legacy `agenda.notificacion_encuesta` se mantendra como marcador operativo, pero la fuente real del estado sera la base bot.
13. El sistema solo enviara encuestas a pacientes con opt-in valido para WhatsApp y para esta finalidad.

## Reglas funcionales

### Regla de horario

El proceso automatico se ejecuta:

- de lunes a viernes
- desde las 07:30 hasta las 17:00
- cada 30 minutos
- en zona horaria `America/Bogota`

Cada corrida procesa la ventana inmediatamente anterior:

1. `07:30` procesa citas con hora `>= 07:00` y `< 07:30`
2. `08:00` procesa citas con hora `>= 07:30` y `< 08:00`
3. `08:30` procesa citas con hora `>= 08:00` y `< 08:30`
4. el patron se repite hasta `17:00`, que procesa `>= 16:30` y `< 17:00`

### Regla de elegibilidad

Una agenda es elegible si cumple simultaneamente:

- `agenda.fecha_cita = fecha actual del sistema`
- `TRIM(agenda.Estado) = 'Atendida'`
- `TRIM(agenda.notificacion_encuesta) = 'No enviado'`
- `agenda.idusuario` corresponde a un paciente valido en `usuarios`
- `usuarios.Telefono` existe y, tras sanitizar, cumple `^3\d{9}$`
- la hora `agenda.idhora` cae dentro de la ventana de 30 minutos procesada
- el paciente tiene opt-in valido para WhatsApp con finalidad de encuesta de satisfaccion
- el telefono no esta bloqueado en `bot_contact_suppressions`

### Regla de deduplicacion diaria

La clave de dedupe sera:

- `patientLegacyUserId + surveyDate`

Consecuencias:

1. Si un paciente ya tiene un despacho `PENDING`, `SENT`, `STARTED`, `COMPLETED`, `DECLINED` o `EXPIRED` ese mismo dia, no se crea un nuevo despacho.
2. Si una nueva agenda del mismo paciente entra en una corrida posterior del mismo dia, se vincula al despacho diario existente mediante tabla puente, pero no dispara un nuevo envio.

### Regla de telefono

Normalizacion:

1. remover espacios, guiones, parentesis y cualquier caracter no numerico
2. si el valor empieza por `57` y queda de 12 digitos, no se considerara valido para este flujo porque el requerimiento actual exige almacenar y usar 10 digitos sin prefijo
3. solo sera valido si el resultado final tiene exactamente 10 digitos y empieza por `3`

### Regla de opt-in

El sistema solo puede enviar la encuesta si existe evidencia de consentimiento para mensajeria por WhatsApp con este proposito.

Se considera valido si existe un registro que documente:

- canal `WHATSAPP`
- finalidad `SATISFACTION_SURVEY`
- consentimiento otorgado
- fecha de otorgamiento
- fuente del consentimiento
- version de politica o texto aplicado

Si la politica de tratamiento actual menciona de forma explicita que el paciente autoriza contacto por WhatsApp para notificaciones y encuestas de satisfaccion, y la IPS conserva evidencia verificable de esa aceptacion, dicha aceptacion puede cargarse como fuente inicial de opt-in. Si la politica solo habla de tratamiento de datos de forma general y no menciona WhatsApp o encuestas, no debe asumirse como opt-in suficiente para mensajes negocio-iniciados.

### Regla de estado legacy

`agenda.notificacion_encuesta` se actualizara asi:

- `Enviado`: cuando la plantilla inicial sea aceptada para envio por el adaptador y se registre el `messageId`
- `Respondida`: cuando la encuesta quede `COMPLETED`
- `No aplica`: cuando una agenda quede cubierta por dedupe diario, bloqueo de telefono, falta de opt-in o `UNKNOWN_PERSON`

No se usara esta columna para reconstruir resultados ni respuestas.

## Flujo automatico

### Caso principal

1. Un scheduler dispara el caso de uso cada 30 minutos.
2. El caso de uso calcula la ventana exacta a procesar.
3. El repositorio legacy consulta agendas atendidas en esa ventana y une con `usuarios` por `agenda.idusuario = usuarios.IdUsuario`.
4. El sistema normaliza telefono, valida opt-in y verifica bloqueos.
5. El sistema agrupa resultados por paciente y fecha.
6. Si no existe despacho diario, crea `bot_survey_dispatches` con estado `PENDING`.
7. El sistema vincula todas las `agenda.idagenda` elegibles del paciente al despacho mediante `bot_survey_dispatch_appointments`.
8. El sistema encola un job de envio por despacho.
9. El worker envia la plantilla inicial por Cloud API.
10. Si el envio es exitoso:
    - guarda `initial_whatsapp_message_id`
    - cambia estado a `SENT`
    - registra mensaje outbound
    - audita
    - actualiza las agendas relacionadas a `Enviado`
11. Si falla:
    - registra `FAILED`
    - conserva reintentos controlados
    - no actualiza `agenda.notificacion_encuesta` a `Enviado`

### Query legacy recomendada

La implementacion debe usar un repositorio de lectura aislado para legacy. La consulta debe:

- leer `agenda`
- unir con `usuarios`
- filtrar por fecha actual
- filtrar por `Estado = 'Atendida'`
- filtrar por `notificacion_encuesta = 'No enviado'`
- convertir `idhora` a hora comparable
- ordenar por:
  1. `agenda.idusuario ASC`
  2. `agenda.fecha_cita ASC`
  3. `agenda.idhora ASC`
  4. `agenda.idagenda ASC`

La consulta debe ademas intentar resolver:

- nombre del paciente
- especialidad
- hora de cita
- sede si esta disponible

### Reintentos e idempotencia

La clave de idempotencia recomendada es:

`survey:{patientLegacyUserId}:{surveyDate}`

Reglas:

1. El job de creacion de despacho debe poder ejecutarse varias veces sin duplicar envios.
2. El job de envio debe reintentar solo sobre despachos en `PENDING` o `FAILED`.
3. Si el mismo template se intenta enviar dos veces por error, el segundo intento debe reconocer el `dispatch` existente antes de volver a llamar a Meta.

### Integracion con coexistencia

Como el numero operara en modo de coexistencia:

1. el backend sigue siendo la fuente de verdad del estado de encuesta
2. todos los mensajes de encuesta entrantes y salientes se auditan en la base bot
3. si una conversacion asociada entra a `HUMAN_HANDOFF`, la encuesta no sigue enviando mensajes automatizados
4. si hay actividad manual en la conversacion, el backend no debe relanzar preguntas automaticamente salvo reanudacion explicita

## Flujo conversacional

### Mensaje inicial

El inicio de encuesta se enviara con una plantilla oficial aprobada por Meta con `reply buttons`.

Botones recomendados:

- `survey_accept` -> `Si responder`
- `survey_decline` -> `No responder`
- `survey_unknown_person` -> `No conozco a la persona`

La opcion `Terminar proceso` no es necesaria como boton inicial porque funcionalmente queda cubierta por `No responder`.

Texto base:

```txt
Hola *${patientName}*! Tu opinion es muy valiosa para nosotros y queremos mejorar para ti. Como 🏥 *IPS SISM* nos gustaria conocer tu experiencia en la atencion de tu cita de 🩺 *${specialtyName}* a las *${hour}*.

Selecciona una opcion para continuar:
```

### Preguntas

Pregunta 1:

```txt
Pregunta 1 de 5: ¿Considera usted que fue facil conseguir su cita con la 🏥IPS SISM?

*1.* SI
*2.* NO
```

Pregunta 2:

```txt
Pregunta 2 de 5: De acuerdo a su experiencia, ¿Que tan satisfecho se encuentra con la atencion brindada? Siendo (4) muy satisfecho y (1) muy insatisfecho.

*4.* ⭐⭐⭐⭐
*3.* ⭐⭐⭐
*2.* ⭐⭐
*1.* ⭐
```

Pregunta 3:

```txt
Pregunta 3 de 5: ¿Recomendaria los servicios de la IPS con algun familiar y/o amigo?

*1.* SI
*2.* NO
```

Pregunta 4:

```txt
Pregunta 4 de 5: ¿En que te gustaria que mejoraramos para tu proxima visita?

*1.* EN LAS INSTALACIONES
*2.* EN LA ATENCION DE TU PROFESIONAL
*3.* EN LA ATENCION DE SERVICIO AL USUARIO
*4.* EN EL TIEMPO DE ESPERA EN LA SALA
*5.* EN NADA TODO ESTUVO BIEN
```

Pregunta 5:

```txt
Pregunta 5 de 5: Dejanos un comentario o recomendacion para seguir mejorando.
```

### Comportamiento

Mensaje inicial:

1. `survey_accept` inicia la encuesta
2. `survey_decline` cierra la encuesta en estado `DECLINED`
3. `survey_unknown_person` bloquea el telefono en bot y cierra la encuesta en estado `BLOCKED_CONTACT`

Preguntas:

1. Q1 acepta `1` o `2`
2. Q2 acepta `1`, `2`, `3` o `4`
3. Q3 acepta `1` o `2`
4. Q4 acepta `1`, `2`, `3`, `4` o `5`
5. Q5 acepta texto libre

Reglas generales:

- si el paciente responde fuera del catalogo valido, el bot repite la pregunta actual
- si el paciente escribe una opcion de navegacion global definida por el bot, se aplica la politica general del canal
- si entra handoff humano, la encuesta se pausa o se cierra segun estado

### Expiracion

La encuesta permanece activa hasta 24 horas desde `SENT` o `STARTED`.

Si expira:

1. cambia a `EXPIRED`
2. no se envian mas mensajes de encuesta
3. se audita el vencimiento
4. las agendas relacionadas no vuelven a disparar una nueva encuesta ese mismo dia

## Arquitectura y estados

Se mantiene modular monolith + arquitectura hexagonal + state machine.

### Modulos afectados

- `surveys`
- `whatsapp`
- `conversations`
- `audit`
- `human-handoff`
- `shared` para colas y scheduler si se centralizan adaptadores comunes

### Responsabilidades por modulo

#### `surveys`

Responsable de:

- reglas de elegibilidad de encuesta
- definiciones y preguntas
- despachos diarios
- respuestas de encuesta
- expiracion
- bloqueos de contacto
- consentimiento para el proposito de encuesta

#### `whatsapp`

Responsable de:

- envio de plantilla inicial
- envio de preguntas dentro de la ventana
- recepcion y normalizacion de respuestas
- persistencia de mensajes inbound y outbound

#### `conversations`

Responsable de:

- estado de la conversacion
- session context
- enrutamiento por estado
- respeto de `BOT_ACTIVE` y `HUMAN_HANDOFF`

#### `audit`

Responsable de:

- registrar todos los eventos de negocio y de envio

### Estados nuevos recomendados

Agregar a `CONVERSATION_STATES`:

- `SURVEY_INVITATION`
- `SURVEY_Q1`
- `SURVEY_Q2`
- `SURVEY_Q3`
- `SURVEY_Q4`
- `SURVEY_Q5`
- `SURVEY_COMPLETED`
- `SURVEY_DECLINED`
- `SURVEY_EXPIRED`

### Session context recomendado

Agregar un bloque como:

```ts
surveySession?: {
  dispatchId: string;
  surveyDefinitionCode: string;
  surveyVersion: number;
  surveyDateIso: string;
  patientLegacyUserId: number;
  appointmentIds: number[];
  currentQuestionKey?: string;
  expiresAtIso: string;
}
```

### Casos de uso recomendados

- `dispatch-half-hourly-satisfaction-surveys.use-case.ts`
- `send-satisfaction-survey-invitation.use-case.ts`
- `start-satisfaction-survey.use-case.ts`
- `record-satisfaction-survey-answer.use-case.ts`
- `complete-satisfaction-survey.use-case.ts`
- `expire-satisfaction-surveys.use-case.ts`
- `suppress-survey-contact.use-case.ts`

### Repositorios recomendados

Legacy:

- `satisfaction-survey-eligibility.repository.ts`
- `satisfaction-survey-legacy-status.repository.ts`

Bot:

- `survey-definition.repository.ts`
- `survey-dispatch.repository.ts`
- `survey-answer.repository.ts`
- `contact-suppression.repository.ts`
- `patient-contact-consent.repository.ts`

## Modelo de datos

### `bot_survey_definitions`

Campos:

- `id`
- `code`
- `version`
- `name`
- `is_active`
- `created_at`

### `bot_survey_questions`

Campos:

- `id`
- `survey_definition_id`
- `question_order`
- `question_key`
- `question_type`
- `body`
- `is_required`
- `created_at`

### `bot_survey_question_options`

Campos:

- `id`
- `survey_question_id`
- `option_value`
- `option_label`
- `option_order`
- `is_terminal_action`

### `bot_survey_dispatches`

Campos:

- `id`
- `survey_definition_id`
- `patient_legacy_user_id`
- `patient_phone`
- `patient_phone_e164`
- `survey_date`
- `status`
- `trigger_type`
- `window_start_at`
- `window_end_at`
- `expires_at`
- `started_at`
- `completed_at`
- `declined_at`
- `expired_at`
- `failed_at`
- `conversation_key`
- `initial_template_name`
- `initial_whatsapp_message_id`
- `last_inbound_whatsapp_message_id`
- `dedupe_key`
- `created_at`
- `updated_at`

Constraint principal:

- `unique(patient_legacy_user_id, survey_date)`

### `bot_survey_dispatch_appointments`

Campos:

- `id`
- `survey_dispatch_id`
- `legacy_agenda_id`
- `appointment_date`
- `appointment_time_hhmm`
- `specialty_name`
- `doctor_name`
- `site_name`
- `created_at`

Constraint recomendada:

- `unique(legacy_agenda_id)`

### `bot_survey_answers`

Campos:

- `id`
- `survey_dispatch_id`
- `survey_question_id`
- `answer_order`
- `selected_option_value`
- `selected_option_label_snapshot`
- `free_text_answer`
- `answered_at`
- `source_message_id`

### `bot_contact_suppressions`

Campos:

- `id`
- `patient_legacy_user_id`
- `phone`
- `channel`
- `reason`
- `scope`
- `active`
- `created_at`
- `expires_at`
- `notes`

### `bot_patient_contact_consents`

Campos:

- `id`
- `patient_legacy_user_id`
- `phone`
- `channel`
- `purpose`
- `granted`
- `granted_at`
- `revoked_at`
- `source`
- `policy_version`
- `evidence_snapshot`
- `created_at`

## Auditoria

Eventos minimos recomendados:

- `survey.eligibility.scan.started`
- `survey.eligibility.scan.completed`
- `survey.eligibility.skipped.invalid_phone`
- `survey.eligibility.skipped.no_opt_in`
- `survey.eligibility.skipped.blocked_contact`
- `survey.eligibility.skipped.already_sent_same_day`
- `survey.dispatch.created`
- `survey.dispatch.appointment_linked`
- `survey.dispatch.sent`
- `survey.dispatch.failed`
- `survey.started`
- `survey.answer.recorded`
- `survey.completed`
- `survey.declined`
- `survey.expired`
- `survey.contact_suppressed`
- `survey.cancelled.human_handoff`

Reglas de privacidad:

- no registrar telefono completo en logs de aplicacion si no es estrictamente necesario
- si se audita el telefono, preferir version enmascarada
- no guardar texto libre sensible fuera de la respuesta necesaria

## Manejo de errores

1. Si falla la consulta legacy:
   - registrar auditoria
   - no marcar agendas
   - reintentar en siguiente corrida o segun job policy
2. Si falla el envio a Meta:
   - mantener `FAILED`
   - reintentos controlados
   - no marcar `Enviado` en legacy
3. Si el paciente responde una opcion invalida:
   - repetir la pregunta actual
4. Si el dispatch ya expiro y llega respuesta tardia:
   - no reabrir
   - responder mensaje controlado opcional indicando que la encuesta finalizo
5. Si el paciente esta en `HUMAN_HANDOFF`:
   - no continuar la encuesta automaticamente
6. Si falta opt-in:
   - no enviar
   - marcar agendas relacionadas a `No aplica`

## Testing

### Unitarias

- normalizacion y validacion de telefono colombiano
- calculo de ventana de 30 minutos
- dedupe diario por paciente
- reglas de opt-in
- reglas de bloqueo por `UNKNOWN_PERSON`
- transiciones de estados de encuesta
- grabacion de respuestas por pregunta

### Integracion

- query legacy de elegibilidad
- persistencia de dispatches y answers
- update de `agenda.notificacion_encuesta`
- integracion con adaptador WhatsApp sender mock

### Flujo conversacional

- aceptacion completa de encuesta
- rechazo en mensaje inicial
- `No conozco a la persona`
- expiracion a 24 horas
- bloqueo por handoff humano
- respuesta invalida y reintento de la misma pregunta

## Rollout recomendado

### Fase 1

- crear tablas bot
- sembrar definicion de encuesta v1
- implementar consulta de elegibilidad y dedupe
- implementar envio de plantilla inicial

### Fase 2

- implementar flujo conversacional completo
- registrar respuestas
- actualizar `agenda.notificacion_encuesta`

### Fase 3

- agregar expiracion automatica
- bloqueo por `UNKNOWN_PERSON`
- opt-in gate estricto
- endurecer auditoria y metricas

### Fase 4

- monitoreo operativo
- revision de tasa de entrega, inicio y finalizacion
- ajustes de copy de plantilla segun aprobacion y calidad

## Criterios de aceptacion

1. El sistema ejecuta el barrido automatico cada 30 minutos de lunes a viernes entre 07:30 y 17:00.
2. Solo se consideran agendas `Atendida` del dia, dentro de la ventana correspondiente, con `notificacion_encuesta = 'No enviado'`.
3. Solo se envian encuestas a telefonos validos de 10 digitos en `usuarios.Telefono`.
4. Solo se envia una encuesta por paciente por dia.
5. El inicio de encuesta sale por plantilla oficial de Meta.
6. El paciente puede aceptar, rechazar o reportar `No conozco a la persona`.
7. Las 5 preguntas quedan almacenadas con version y respuestas auditables.
8. Si el paciente no responde, la encuesta expira a las 24 horas.
9. Si el paciente reporta telefono desconocido, se bloquean futuros envios de encuesta sin modificar `usuarios.Telefono`.
10. Si la conversacion entra en handoff humano, el bot no continua la encuesta automaticamente.
11. `agenda.notificacion_encuesta` se actualiza de forma coherente con el estado operativo.
12. Las pruebas relevantes del modulo quedan en verde.

## Referencias oficiales

- WhatsApp Business Messaging Policy: https://whatsappbusiness.com/policy/
- WhatsApp Business Platform Features: https://whatsappbusiness.com/products/business-platform-features/
- WhatsApp Business Platform Pricing: https://whatsappbusiness.com/products/platform-pricing/
- Managing Message Templates with the WhatsApp Business Platform: https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/
