# Encuestas de satisfaccion post-atencion por WhatsApp

## Objetivo

Implementar el envio automatico de encuestas de satisfaccion para pacientes con citas atendidas, usando la API oficial de Meta WhatsApp Cloud API en modo de coexistencia, con trazabilidad completa, deduplicacion por paciente, cumplimiento de politicas de mensajeria y una experiencia nativa dentro de WhatsApp basada en `Flows`.

El comportamiento esperado es:

1. El sistema ejecuta un proceso automatico cada 30 minutos, de lunes a viernes, desde las 07:30 hasta las 17:00 en `America/Bogota`.
2. En cada ejecucion identifica citas del dia con `agenda.Estado = 'Atendida'`, `agenda.notificacion_encuesta = 'No enviado'` y telefono valido en `usuarios.Telefono`.
3. El sistema envia una sola encuesta por paciente por dia aunque tenga multiples citas atendidas.
4. El primer mensaje se envia con una plantilla oficial aprobada por Meta que abre un `WhatsApp Flow`.
5. El paciente responde toda la encuesta dentro del `Flow`, sin obligarlo a contestar pregunta por pregunta en texto libre.
6. El backend conserva la fuente de verdad del proceso: elegibilidad, despacho, auditoria, handoff, bloqueo de contactos y resultados.
7. Todas las acciones quedan auditadas en la base bot sin exponer datos sensibles innecesarios.

## Alcance

Incluye:

- Deteccion automatica de pacientes elegibles por ventana de 30 minutos.
- Dedupe de una encuesta por paciente por dia.
- Persistencia bot para definiciones, despachos, respuestas, bloqueos y consentimientos.
- Envio de plantilla inicial de encuesta por WhatsApp Cloud API usando boton `FLOW`.
- Diseno del `Flow` con las 5 preguntas de satisfaccion.
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
2. El telefono valido en Colombia para elegibilidad es un numero de 10 digitos que cumple `^3\d{9}$` despues de sanitizar.
3. La fuente del telefono para encuesta sera `usuarios.Telefono`, no `agenda.Telefono`.
4. El sistema enviara solo una encuesta por paciente por dia.
5. Si el paciente tiene varias citas atendidas el mismo dia, la encuesta se asociara a todas las agendas elegibles relacionadas a traves de una tabla puente, pero solo se enviara una vez.
6. La encuesta negocio-iniciada se enviara mediante una plantilla oficial aprobada por Meta con boton `FLOW`, no con `reply buttons` ni con `list` como mensaje inicial.
7. La primera pantalla del `Flow` resolvera la decision de continuar o no continuar, para evitar varias preguntas de arranque en el chat.
8. Las 5 preguntas de satisfaccion se responderan dentro del `Flow`, no como estados individuales del bot conversacional.
9. Si el paciente indica `No conozco a la persona`, el sistema bloqueara futuros envios de encuestas para ese telefono en la base bot y no modificara `usuarios.Telefono`.
10. Si el paciente no responde o abandona, la encuesta expirara a las 24 horas desde el envio del template.
11. Si la conversacion entra en `HUMAN_HANDOFF`, la encuesta no seguira enviando mensajes automaticos.
12. La columna legacy `agenda.notificacion_encuesta` se mantendra como marcador operativo, pero la fuente real del estado sera la base bot.
13. El sistema solo enviara encuestas a pacientes con opt-in valido para WhatsApp y para esta finalidad.
14. Para elegibilidad y legado se conserva el telefono de 10 digitos, pero para el envio real a Cloud API se normaliza a formato de destinatario WhatsApp `57 + numero` sin el signo `+`.

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

1. Si un paciente ya tiene un despacho `PENDING`, `SENT`, `STARTED`, `COMPLETED`, `DECLINED`, `EXPIRED`, `BLOCKED_CONTACT` o `CANCELLED_BY_HANDOFF` ese mismo dia, no se crea un nuevo despacho.
2. Si una nueva agenda del mismo paciente entra en una corrida posterior del mismo dia, se vincula al despacho diario existente mediante tabla puente, pero no dispara un nuevo envio.

### Regla de telefono

Normalizacion de elegibilidad:

1. remover espacios, guiones, parentesis y cualquier caracter no numerico
2. si el valor empieza por `57` y queda de 12 digitos, no se considerara valido como dato legacy para este flujo porque el requerimiento operativo actual exige almacenar y usar 10 digitos sin prefijo
3. solo sera valido si el resultado final tiene exactamente 10 digitos y empieza por `3`

Normalizacion de transporte hacia Meta:

1. el sistema tomara el telefono legacy valido de 10 digitos
2. construira el destinatario WhatsApp como `57${telefonoLegacy}`
3. ese valor se almacenara como snapshot en `patient_phone_e164`
4. el numero legacy original se conserva para auditoria y consistencia operativa

### Regla de opt-in

El sistema solo puede enviar la encuesta si existe evidencia de consentimiento para mensajeria por WhatsApp con este proposito.

Se considera valido si existe un registro que documente:

- canal `WHATSAPP`
- finalidad `SATISFACTION_SURVEYS`
- consentimiento otorgado
- fecha de otorgamiento
- fuente del consentimiento
- version de politica o texto aplicado

Si la politica de tratamiento actual menciona de forma explicita que el paciente autoriza contacto por WhatsApp para notificaciones y encuestas de satisfaccion, y la IPS conserva evidencia verificable de esa aceptacion, dicha aceptacion puede cargarse como fuente inicial de opt-in. Si la politica solo habla de tratamiento de datos de forma general y no menciona WhatsApp o encuestas, no debe asumirse como opt-in suficiente para mensajes negocio-iniciados.

La fuente recomendada para este proyecto es capturar un consentimiento unificado de WhatsApp inmediatamente despues de que el paciente complete exitosamente el autoagendamiento de la cita, con texto explicito que cubra recordatorios/notificaciones de cita y encuestas de satisfaccion. Aunque la pregunta de UX sea una sola, el resultado debe persistirse por finalidades separadas, al menos `APPOINTMENT_NOTIFICATIONS` y `SATISFACTION_SURVEYS`.

### Regla de estado legacy

`agenda.notificacion_encuesta` se actualizara asi:

- `Enviado`: cuando la plantilla inicial con boton `FLOW` sea aceptada para envio por el adaptador y se registre el `messageId`
- `Respondida`: cuando la encuesta quede `COMPLETED`
- `No aplica`: cuando una agenda quede cubierta por dedupe diario, bloqueo de telefono, falta de opt-in, `UNKNOWN_PERSON` o `CANCELLED_BY_HANDOFF`

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
8. El sistema encola o ejecuta el envio del template `FLOW` por despacho.
9. El worker o caso de uso de envio manda la plantilla oficial por Cloud API.
10. Si el envio es exitoso:
    - guarda `initial_whatsapp_message_id`
    - guarda `flow_token`
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
4. si hay actividad manual en la conversacion, el backend no debe relanzar encuestas automaticamente salvo reanudacion explicita

## Flujo con WhatsApp Flow

### Mensaje inicial

La encuesta se inicia con una plantilla oficial aprobada por Meta del tipo `template` con un boton `FLOW`.

La plantilla debe:

- estar aprobada antes del primer envio
- usar el texto final validado por IPS SISM
- incluir placeholders para `patientName`, `specialtyName` y `hour` en el `body`, si asi se define el template
- incluir un unico boton `FLOW` en `index = 0`
- abrir el `Flow` publicado de encuesta de satisfaccion

Texto base recomendado del template:

```txt
Hola *{{1}}*! Tu opinion es muy valiosa para nosotros y queremos mejorar para ti. Como 🏥 *IPS SISM* nos gustaria conocer tu experiencia en la atencion de tu cita de 🩺 *{{2}}* a las *{{3}}*.

Selecciona el boton para responder la breve encuesta.
```

El backend enviara el template y adjuntara:

- `template.name`
- `template.language.code`
- `components[type=body].parameters[text]` si la plantilla usa placeholders
- `components[type=button, sub_type=flow, index=0].parameters[type=action].action.flow_token`
- `flow_action_data` con metadatos minimos del despacho si el `Flow` necesita datos de entrada

### Estructura del Flow

El `Flow` debe vivir en WhatsApp Manager o administrarse por Flows API, pero su version publicada debe respetar este contenido funcional:

Pantalla 1:

- pregunta de continuacion
- opciones:
  - `Si responder la encuesta`
  - `No responder la encuesta`
  - `No conozco a la persona`
  - `Terminar proceso`

Pantalla 2 a 5:

- Pregunta 1 de 5: facilidad para conseguir la cita
- Pregunta 2 de 5: satisfaccion general con escala 1 a 4
- Pregunta 3 de 5: recomendacion a familiar o amigo
- Pregunta 4 de 5: aspecto a mejorar
- Pregunta 5 de 5: comentario o recomendacion libre

Tipos recomendados de componentes:

- radio / single choice para preguntas cerradas
- long text o text area para comentario final
- pantalla final de agradecimiento

### Resultado del Flow

El backend debe ser capaz de diferenciar al menos estos resultados:

- `DECLINED`: el paciente decide no responder o terminar el proceso
- `BLOCKED_CONTACT`: el paciente marca `No conozco a la persona`
- `COMPLETED`: el paciente responde y finaliza exitosamente
- `EXPIRED`: no abre o no finaliza dentro de 24 horas

### Captura de respuestas

La captura oficial de resultados debe hacerse por la integracion propia de `WhatsApp Flows`, no revirtiendo a preguntas por chat.

Reglas:

1. el resultado del `Flow` debe correlacionarse con `bot_survey_dispatches` mediante `flow_token`
2. las respuestas deben guardarse en `bot_survey_answers`
3. la finalizacion debe actualizar el despacho y las agendas relacionadas
4. si el `Flow` devuelve `No conozco a la persona`, el sistema debe crear un bloqueo en `bot_contact_suppressions`
5. si entra `HUMAN_HANDOFF`, no se inicia un nuevo envio automatico para esa conversacion

### Expiracion

La encuesta permanece activa hasta 24 horas desde `SENT` o `STARTED`.

Si expira:

1. cambia a `EXPIRED`
2. no se envian mas mensajes de encuesta
3. se audita el vencimiento
4. las agendas relacionadas no vuelven a disparar una nueva encuesta ese mismo dia

## Arquitectura

Se mantiene modular monolith + arquitectura hexagonal.

### Modulos afectados

- `surveys`
- `whatsapp`
- `conversations`
- `audit`
- `human-handoff`
- `shared` para scheduler y colas cuando se incorporen

### Responsabilidades por modulo

#### `surveys`

Responsable de:

- reglas de elegibilidad de encuesta
- definiciones y preguntas
- despachos diarios
- tokens de correlacion de Flow
- respuestas de encuesta
- expiracion
- bloqueos de contacto
- consentimiento para el proposito de encuesta

#### `whatsapp`

Responsable de:

- envio del template `FLOW`
- adaptacion del payload oficial de Cloud API
- recepcion y normalizacion de webhooks relacionados con mensajes enviados
- persistencia de mensajes inbound y outbound

#### `conversations`

Responsable de:

- identidad de conversacion por `conversationKey`
- auditoria del hilo de mensajes
- consulta de estado de conversacion para respetar `HUMAN_HANDOFF`

No es responsable de modelar cada pregunta de la encuesta como un estado del bot.

#### `audit`

Responsable de:

- registrar todos los eventos de negocio y de envio

### Casos de uso recomendados

- `dispatch-half-hourly-satisfaction-surveys.use-case.ts`
- `create-satisfaction-survey-dispatch.use-case.ts`
- `send-satisfaction-survey-flow-invitation.use-case.ts`
- `record-satisfaction-survey-flow-submission.use-case.ts`
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
- `updated_at`

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
- `updated_at`

### `bot_survey_question_options`

Campos:

- `id`
- `survey_question_id`
- `option_value`
- `option_label`
- `option_order`
- `is_terminal_action`
- `created_at`
- `updated_at`

### `bot_survey_dispatches`

Campos:

- `id`
- `survey_definition_id`
- `patient_legacy_user_id`
- `patient_name`
- `patient_phone`
- `patient_phone_e164`
- `survey_date`
- `status`
- `trigger_type`
- `window_start_at`
- `window_end_at`
- `expires_at`
- `conversation_key`
- `initial_template_name`
- `initial_template_language`
- `initial_whatsapp_message_id`
- `flow_token`
- `flow_opened_at`
- `started_at`
- `completed_at`
- `declined_at`
- `expired_at`
- `failed_at`
- `failure_reason`
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
- `created_at`

### `bot_contact_suppressions`

Campos:

- `id`
- `patient_legacy_user_id`
- `phone`
- `channel`
- `reason`
- `scope`
- `active`
- `expires_at`
- `notes`
- `created_at`
- `updated_at`

### `bot_patient_contact_consents`

Ya definida previamente para soportar la validacion de opt-in por finalidad.

## Auditoria

Eventos minimos:

- `survey.eligibility.found`
- `survey.eligibility.skipped.invalid_phone`
- `survey.eligibility.skipped.already_sent_same_day`
- `survey.dispatch.created`
- `survey.dispatch.reused`
- `survey.dispatch.flow_template.attempted`
- `survey.dispatch.flow_template.sent`
- `survey.dispatch.flow_template.failed`
- `survey.flow.started`
- `survey.answer.recorded`
- `survey.completed`
- `survey.declined`
- `survey.expired`
- `survey.phone_suppressed`
- `survey.cancelled.human_handoff`

## Testing

Pruebas unitarias recomendadas:

- normalizacion y validacion de telefono para encuestas
- creacion idempotente de `dispatch`
- factory de `flow_token`
- use case de envio del `Flow Template Message`
- repositorio Prisma de `survey-dispatch`
- mapping de estado `HUMAN_HANDOFF` a cancelacion o bloqueo de envio

Pruebas posteriores de integracion:

- scheduler contra repositorio legacy aislado
- persistencia de respuestas del `Flow`
- actualizacion de `agenda.notificacion_encuesta`

## Observabilidad operativa

Para operacion de produccion se expone un endpoint interno de metricas por franja:

- `GET /internal/surveys/metrics`
- header opcional por ambiente: `x-internal-token` (controlado por `INTERNAL_SURVEYS_METRICS_TOKEN`)
- filtros:
  - `date=YYYY-MM-DD`
  - `windowStart=HH:MM`
  - `windowEnd=HH:MM`

Metricas por franja de 30 minutos:

- `eligible`
- `sent`
- `failed`
- `completed`
- `declined`
- `blocked`
- `sendRate = sent/eligible`
- `completionRate = completed/sent`

Definicion de `sent` para observabilidad:

- cuenta despachos en estados `SENT`, `STARTED`, `COMPLETED`, `DECLINED`, `EXPIRED` y `BLOCKED_CONTACT`
- esto evita subcontar envios reales que ya cambiaron de estado posterior

Evento de auditoria asociado:

- `survey.metrics.queried`

Alertas operativas iniciales recomendadas:

- warning si `sendRate < 0.85` en una franja
- critical si `sendRate < 0.70` en 2 franjas consecutivas
- warning si `completionRate < 0.30` diario
- warning si `failed >= 3` por franja
- critical si `failed >= 5` en 2 franjas consecutivas

## Fases recomendadas

### Fase 1

- tablas bot de encuesta
- siembra de la definicion v1 con 5 preguntas
- creacion idempotente de despachos
- envio del `Flow Template Message`
- auditoria y persistencia de outbound

### Fase 2

- scheduler cada 30 minutos
- repositorio legacy de elegibilidad
- actualizacion operativa de `agenda.notificacion_encuesta`
- expiracion automatica

### Fase 3

- captura completa de resultados del `Flow`
- persistencia de respuestas en `bot_survey_answers`
- bloqueo automatizado por `No conozco a la persona`
- metricas y conciliacion de resultados

### Fase 4

- endpoint interno de metricas por franja
- token interno por ambiente para consulta operativa
- runbook de monitoreo y respuesta a incidentes
