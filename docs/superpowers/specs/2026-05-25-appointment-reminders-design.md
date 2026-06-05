# Diseno: recordatorios de cita por WhatsApp 24 horas antes

## Resumen

Se implementara un sistema automatizado para enviar recordatorios de cita por WhatsApp 24 horas antes del inicio de la cita, usando la API oficial de Meta WhatsApp Cloud API, con trazabilidad completa, deduplicacion, verificacion oficial de telefono en legacy y soporte para citas creadas tanto por el bot como por otros canales operativos.

El diseno recomendado para este proyecto es un modelo hibrido persistente:

1. Un `synchronizer` detecta citas legacy elegibles y crea o actualiza despachos internos de recordatorio en la base bot.
2. Un `dispatcher` procesa los despachos vencidos usando bloqueo e idempotencia.
3. Si el telefono aun no esta verificado, el sistema envia primero una plantilla de verificacion sin datos sensibles.
4. Si el paciente confirma el telefono, el sistema todavia podra enviar el recordatorio siempre que falten al menos 3 horas para la cita.

## Objetivo

Enviar recordatorios de citas medicas por WhatsApp a pacientes con cita `Asignada`, programados para salir alrededor de 24 horas antes con SLA operativo maximo de 5 minutos, sin perder envios por retrasos del cron, sin enviar datos de cita a telefonos no verificados y manteniendo el backend como fuente de verdad operativa.

## Alcance

Incluye:

- Deteccion automatica de citas futuras con `agenda.Estado = 'Asignada'`.
- Programacion persistente de recordatorios en la base bot.
- Sincronizacion de citas creadas dentro y fuera del bot.
- Envio de plantilla `Utility` para recordatorio de cita.
- Envio de plantilla `Utility` con botones para verificar telefono.
- Uso de `usuarios.telefono_verificado_en` como fuente oficial de verificacion telefonica.
- Uso de `bot_patient_contact_consents` como fuente oficial de opt-in para notificaciones de cita.
- Limpieza de `usuarios.Tel_fono` (mapeado a columna legacy `Teléfono`) cuando la respuesta sea `No lo reconozco`.
- Auditoria, idempotencia, reintentos y control anti-duplicado.
- Idempotencia inbound para reentregas de webhook de Meta.
- Recuperacion de locks huerfanos para evitar despachos atascados.
- Cobertura de pruebas unitarias, de integracion y de flujo.

No incluye:

- Confirmacion de correo en este flujo.
- Panel administrativo de recordatorios.
- IA generativa.
- Uso de librerias no oficiales de WhatsApp.
- Cambios en la arquitectura de handoff humano mas alla de validar si el envio esta permitido.

## Decisiones cerradas

1. El valor operativo confirmado para elegibilidad es `agenda.Estado = 'Asignada'`.
2. La hora de negocio se evaluara en `America/Bogota`.
3. El telefono fuente para recordatorios sera el campo Prisma `usuarios.Tel_fono` (mapeado a columna legacy `Teléfono`), no `agenda.Telefono`.
4. La verificacion oficial del numero sera `usuarios.telefono_verificado_en`.
5. El opt-in oficial para recordatorios sera el consentimiento en base bot con finalidad `APPOINTMENT_NOTIFICATIONS`.
6. Los mensajes iniciales proactivos de recordatorio y de verificacion se enviaran con plantillas aprobadas por Meta categoria `Utility`.
7. La plantilla de recordatorio aprobada es `recordatorio_cita_24h` con `language_code = es_CO`.
8. La plantilla de verificacion aprobada es `verificacion_telefono_paciente` con `language_code = es_CO`, botones `Confirmar` y `No lo reconozco`, y `message_validity_period = 12 horas` configurado en Meta.
9. El parametro `{{1}}` de `verificacion_telefono_paciente` sera `patientShortName`, construido como `usuarios.Primer_nombre + usuarios.Primer_apellido`, normalizado con `trim`.
10. Si el telefono no esta verificado, no se enviaran datos de la cita hasta obtener confirmacion.
11. Si el paciente responde `No lo reconozco`, el sistema limpiara `usuarios.Tel_fono`, dejara `usuarios.telefono_verificado_en = NULL` y registrara supresion de contacto.
12. Si el paciente confirma el telefono despues de la verificacion, el sistema podra enviar el recordatorio solo si faltan al menos 3 horas para la cita.
13. Si faltan menos de 3 horas para la cita al momento de la confirmacion, no se enviara el recordatorio y el despacho quedara marcado como omitido por confirmacion tardia.
14. La vigencia operativa de la verificacion seguira ligada a la ventana de la cita; la validez de 12 horas configurada en Meta no extiende la ventana de negocio del backend.
15. La modalidad se seguira resolviendo con la regla actual del proyecto:
    - `IdModalidad = 0` => `PRESENCIAL`
    - `IdModalidad != 0` => valor vacio hasta definir catalogo real
16. La ciudad y direccion de la cita se resolveran desde la informacion de sede usada por las consultas de agenda.
17. Si la conversacion esta en `HUMAN_HANDOFF`, el sistema no enviara recordatorios automaticos ni verificaciones automaticas; el despacho se marcara como `SKIPPED_HANDOFF_ACTIVE`.
18. El backend bot sera la fuente de verdad del despacho; las columnas legacy solo se usaran como apoyo operativo.
19. El despacho de recordatorios sera principalmente orientado a eventos (`delayed jobs`) con barrido de recuperacion periodico, para evitar escaneos intensivos cada minuto.

## Modelo operativo recomendado

### Enfoque hibrido persistente

El sistema no debe depender de una consulta exacta sobre `agenda` del tipo `ahora + 24h`.

En su lugar se separan dos responsabilidades:

1. `synchronizer`
   - recorre citas legacy futuras elegibles
   - calcula `scheduledFor = appointmentStartsAt - 24 horas`
   - crea o actualiza un despacho persistente en la base bot

2. `dispatcher`
   - busca despachos cuyo `scheduledFor <= now`
   - toma un lote con bloqueo anti-duplicado
   - valida estado real de cita, opt-in, telefono y verificacion
   - envia la plantilla correspondiente

Ventajas:

- no se pierden recordatorios si el proceso corre tarde
- los reinicios del servidor no borran trabajo pendiente
- la deduplicacion queda persistida
- soporta citas creadas fuera del bot
- deja trazabilidad clara de cada intento

## Arquitectura

Se mantiene modular monolith + arquitectura hexagonal.

```txt
Legacy agenda/usuarios
        ↓
Appointment reminder synchronizer
        ↓
Reminder dispatch repository (bot DB)
        ↓
Appointment reminder dispatcher
        ↓
WhatsApp outbound template adapter
        ↓
Audit + conversation messages + suppressions
```

## Componentes propuestos

### Modulo `appointments`

Nuevas responsabilidades:

- repositorio de lectura legacy para citas elegibles a recordatorio
- servicio para resolver fecha/hora exacta de cita
- servicio para resolver payload del recordatorio

### Modulo `patients`

Nuevas responsabilidades:

- lectura de `usuarios.Tel_fono` (columna legacy `Teléfono`)
- lectura de `usuarios.telefono_verificado_en`
- escritura controlada de:
  - `usuarios.Tel_fono`
  - `usuarios.telefono_verificado_en`

### Modulo `reminders`

Nuevo modulo recomendado:

- `application/use-cases/create-or-refresh-appointment-reminder-dispatches.use-case.ts`
- `application/use-cases/dispatch-due-appointment-reminders.use-case.ts`
- `application/use-cases/confirm-appointment-reminder-phone.use-case.ts`
- `application/use-cases/reject-appointment-reminder-phone.use-case.ts`
- `application/services/appointment-reminder-window.service.ts`
- `application/services/appointment-reminder-message.factory.ts`
- `application/services/appointment-reminder-phone-verification-message.factory.ts`
- `domain/ports/appointment-reminder-dispatch.repository.ts`
- `infrastructure/persistence/mysql/prisma-bot-appointment-reminder-dispatch.repository.ts`
- `infrastructure/scheduling/appointment-reminder.scheduler.ts`
- `infrastructure/scheduling/appointment-reminder-sync.scheduler.ts`

### Modulo `whatsapp`

Reutiliza:

- envio de plantillas por Cloud API
- webhook inbound de botones
- almacenamiento de mensajes outbound

### Modulo `audit`

Reutiliza:

- `bot_audit_events`

### Persistencia bot ya existente a reutilizar

- `bot_patient_contact_consents`
- `bot_contact_consent_events`
- `bot_contact_suppressions`
- `bot_messages`
- `bot_audit_events`

## Modelo de datos

### Nueva tabla recomendada

Se recomienda crear una tabla bot dedicada para despachos de recordatorio, por ejemplo:

```txt
bot_appointment_reminder_dispatches
```

Campos minimos:

- `id`
- `legacy_agenda_id`
- `patient_legacy_user_id`
- `conversation_key`
- `recipient_phone_raw`
- `recipient_phone_e164`
- `appointment_starts_at`
- `scheduled_for`
- `reminder_type`
- `status`
- `template_name`
- `verification_template_name`
- `meta_message_id`
- `verification_message_id`
- `attempts`
- `next_attempt_at`
- `last_error`
- `lock_acquired_at`
- `lock_expires_at`
- `locked_by`
- `lock_version`
- `verification_token_hash`
- `verification_requested_at`
- `verification_expires_at`
- `sent_at`
- `created_at`
- `updated_at`

Clave unica recomendada:

```txt
legacy_agenda_id + reminder_type + appointment_starts_at
```

Esto evita bloquear nuevas programaciones si una cita reusa el mismo `agenda.idagenda` despues de reprogramacion.

### Estados del despacho

Estados minimos recomendados:

- `PENDING`
- `LOCKED`
- `PHONE_VERIFICATION_PENDING`
- `PHONE_VERIFICATION_EXPIRED`
- `SENT`
- `SKIPPED_NO_OPT_IN`
- `SKIPPED_INVALID_PHONE`
- `SKIPPED_APPOINTMENT_CANCELLED`
- `SKIPPED_APPOINTMENT_RESCHEDULED`
- `SKIPPED_LATE_CONFIRMATION`
- `SKIPPED_SUPPRESSED_CONTACT`
- `SKIPPED_HANDOFF_ACTIVE`
- `FAILED`

## Fuentes oficiales de datos

### Legacy

- `agenda`
  - `Estado`
  - `fecha_cita`
  - `idhora`
  - `idusuario`
  - `idmedico`
  - `IdSede`
  - `IdModalidad`
  - `TipoCita`
- `usuarios`
  - `IdUsuario`
  - `Primer_nombre`
  - `Segundo_nombre`
  - `Primer_apellido`
  - `Segundo_apellido`
  - columna legacy `Teléfono`
  - campo Prisma `Tel_fono` con `@map("Teléfono")`
  - `telefono_verificado_en`
- sedes y tablas auxiliares para direccion y ciudad

### Convencion de nombres legacy/prisma

Para evitar errores de implementacion:

- cuando este documento diga `usuarios.Tel_fono`, se refiere al campo Prisma
- ese campo Prisma esta mapeado a la columna fisica legacy `usuarios.Teléfono`
- no se debe usar `agenda.Telefono` como fuente de envio

### Bot DB

- `bot_patient_contact_consents`
  - finalidad `APPOINTMENT_NOTIFICATIONS`
- `bot_contact_suppressions`
- `bot_messages`
- `bot_audit_events`

## Reglas funcionales

### Regla de elegibilidad de cita

Una cita es candidata a recordatorio si cumple simultaneamente:

- `agenda.Estado = 'Asignada'`
- fecha/hora de inicio valida
- `agenda.idusuario` valido
- telefono en `usuarios.Tel_fono`
- consentimiento vigente para `APPOINTMENT_NOTIFICATIONS`
- no existe supresion activa incompatible con el envio

### Regla de programacion

Para cada cita candidata:

```txt
scheduledFor = appointmentStartsAt - 24 horas
```

### Regla de telefono

Normalizacion legacy:

1. remover caracteres no numericos
2. aceptar solo numero colombiano celular de 10 digitos que empiece por `3`

Normalizacion para transporte Meta:

```txt
57 + numeroLegacy
```

### Regla de verificacion

Si `usuarios.telefono_verificado_en IS NOT NULL`:

- el numero se considera verificado para recordatorios

Si `usuarios.telefono_verificado_en IS NULL`:

- no se envia el recordatorio clinico
- se envia la plantilla de verificacion
- la ventana operativa de respuesta se controla con `verification_expires_at = appointment_starts_at - 3 horas`
- la `message_validity_period = 12 horas` de Meta no reemplaza esa regla de negocio

### Regla de confirmacion tardia

Si el paciente confirma el numero despues de haber recibido la plantilla de verificacion:

- si faltan `>= 3 horas` para la cita, se envia el recordatorio inmediatamente
- si faltan `< 3 horas`, no se envia el recordatorio

### Regla de privacidad

La plantilla de verificacion puede incluir unicamente:

- `patientShortName = trim(usuarios.Primer_nombre + " " + usuarios.Primer_apellido)`

La plantilla de verificacion no debe incluir:

- fecha de la cita
- especialidad
- profesional
- direccion
- cualquier dato clinico

### Regla de handoff humano

Antes del envio final, el sistema debe verificar si la conversacion asociada esta en `HUMAN_HANDOFF`.

Decision cerrada para este proyecto:

- no enviar recordatorios automaticos
- no enviar verificacion automatica de telefono
- marcar el despacho como `SKIPPED_HANDOFF_ACTIVE`

Esto mantiene consistencia con la regla general del proyecto: cuando `HUMAN_HANDOFF` esta activo, el bot no debe seguir respondiendo automaticamente.

## Flujos

### Flujo principal con telefono verificado

1. El `synchronizer` detecta una cita futura elegible.
2. Calcula `scheduledFor`.
3. Crea o actualiza el despacho `PENDING`.
4. El `dispatcher` toma el despacho cuando `scheduledFor <= now`.
5. Revalida que la cita siga `Asignada`.
6. Revalida opt-in y telefono.
7. Detecta que `telefono_verificado_en` existe.
8. Envia plantilla `recordatorio_cita_24h`.
9. Guarda `meta_message_id`, `sent_at` y cambia a `SENT`.
10. Registra auditoria y mensaje outbound.

### Flujo con telefono no verificado

1. El `dispatcher` toma el despacho vencido.
2. Revalida cita, opt-in y telefono.
3. Detecta `telefono_verificado_en = NULL`.
4. Envia plantilla `verificacion_telefono_paciente`.
5. Cambia despacho a `PHONE_VERIFICATION_PENDING`.
6. Guarda `verification_message_id`, `verification_requested_at` y `verification_expires_at` (recomendado: `appointment_starts_at - 3 horas`).
7. Registra auditoria.
8. Si no llega respuesta valida antes de `verification_expires_at`, marca `PHONE_VERIFICATION_EXPIRED` y no vuelve a intentar.

### Flujo `Confirmar`

1. El webhook recibe el boton `Confirmar`.
2. El sistema valida idempotencia inbound usando `meta_message_id` inbound + `button_payload_id`.
3. El sistema identifica de forma deterministica al paciente y al despacho pendiente usando token firmado del boton de verificacion.
4. El sistema valida que el remitente coincida con el `recipient_phone_e164` del despacho.
5. Si el evento inbound ya fue procesado, responde idempotente sin repetir transiciones.
6. Si el evento es nuevo, continua el flujo.
7. Actualiza `usuarios.telefono_verificado_en` con fecha/hora actual de Colombia.
8. Audita `appointment_reminder.phone_confirmed`.
9. Revisa si el despacho sigue pendiente de recordatorio.
10. Si faltan `>= 3 horas`, envia el recordatorio y marca `SENT`.
11. Si faltan `< 3 horas`, marca `SKIPPED_LATE_CONFIRMATION`.

### Flujo `No lo reconozco`

1. El webhook recibe el boton `No lo reconozco`.
2. El sistema valida idempotencia inbound usando `meta_message_id` inbound + `button_payload_id`.
3. El sistema resuelve el despacho por token firmado y valida remitente.
4. Si el evento inbound ya fue procesado, responde idempotente sin repetir cambios.
5. Si el evento es nuevo, limpia `usuarios.Tel_fono`.
6. Mantiene `usuarios.telefono_verificado_en = NULL`.
7. Registra supresion en `bot_contact_suppressions` con razon `UNKNOWN_PERSON`.
8. Audita `appointment_reminder.phone_rejected_unknown_person`.
9. El despacho se cierra como `SKIPPED_SUPPRESSED_CONTACT`.

### Flujo de reprogramacion de cita

1. El `synchronizer` detecta que para un mismo `legacy_agenda_id` cambio `appointment_starts_at`.
2. Crea o refresca el despacho de la nueva hora usando la clave unica compuesta.
3. Si existe despacho previo no terminal (`PENDING`, `LOCKED`, `PHONE_VERIFICATION_PENDING`), lo marca `SKIPPED_APPOINTMENT_RESCHEDULED`.
4. Audita `appointment_reminder.dispatch.skipped_rescheduled`.
5. Solo el despacho con hora vigente queda elegible para envio.

## Templates Meta requeridos

### Template 1: recordatorio de cita

Nombre sugerido:

```txt
recordatorio_cita_24h
```

Categoria:

```txt
Utility
```

Variables:

1. `patientName`
2. `specialtyName`
3. `modality`
4. `day`
5. `hour`
6. `city`
7. `address`
8. `doctorName`

### Template 2: verificacion de telefono

Nombre sugerido:

```txt
verificacion_telefono_paciente
```

Categoria:

```txt
Utility
```

Tipo:

```txt
Template con botones de respuesta rapida
```

Idioma:

```txt
es_CO
```

Variable de cuerpo:

```txt
{{1}} = patientShortName
patientShortName = trim(usuarios.Primer_nombre + " " + usuarios.Primer_apellido)
```

Botones:

- `button index 0 = Confirmar`
- `button index 1 = No lo reconozco`

Vigencia:

- `message_validity_period = 12 horas` en Meta
- la vigencia operativa real sigue controlada por `verification_expires_at`

Requisito de correlacion:

- cada boton debe incluir un `button_payload_id` firmado que represente el `dispatch_id`
- el payload firmado debe tener expiracion y proteccion anti-manipulacion
- el sistema no debe depender de texto libre del boton para identificar despacho

## Consideraciones Meta y costos

### Configuracion requerida en Meta

Antes de habilitar el envio real se debe confirmar:

- numero y WABA activos
- metodo de pago activo
- webhook activo para mensajes y estados
- plantilla `recordatorio_cita_24h` aprobada con `language_code = es_CO`
- plantilla `verificacion_telefono_paciente` aprobada con `language_code = es_CO`

### Regla financiera

Todo recordatorio automatico debe presupuestarse como `Utility` cobrable.

No se debe construir el modelo financiero suponiendo gratuidad por caer casualmente dentro de una ventana de atencion.

## Scheduler y sincronizacion

### Scheduler de sincronizacion

Frecuencia recomendada:

```txt
cada 5 minutos
```

Responsabilidad:

- mirar citas legacy futuras `Asignada`
- crear o refrescar despachos faltantes

### Scheduler de despacho

Frecuencia recomendada:

```txt
modelo hibrido recomendado:
- event-driven inmediato por delayed jobs
- barrido de recuperacion cada 5 minutos
```

Responsabilidad:

- procesar jobs vencidos disparados por cola sin escaneo completo de tabla
- tomar despachos `PENDING` o reintentables con `scheduledFor <= now` en lotes pequenos
- aplicar lock/lease con renovacion
- ejecutar envio o transicion de estado

Notas de capacidad:

- no se recomienda depender solo de poll cada minuto para evitar carga innecesaria cuando crezca el volumen
- la logica no depende de que la cita caiga en minuto `00/15/20/30/40/45`; cualquier minuto futuro sigue funcionando
- el barrido de recuperacion cubre trabajos perdidos por caidas, reinicios o desfases de cola

## Lock e idempotencia

### Anti-duplicado

El `dispatcher` debe tomar lotes con lock de base de datos o estrategia equivalente.

Patron recomendado:

- seleccionar ids elegibles
- bloquear filas
- transicionar de `PENDING` a `LOCKED`
- procesar

Si la base objetivo soporta `FOR UPDATE SKIP LOCKED`, es la opcion preferida.

Recuperacion de lock huerfano:

- al bloquear, persistir `lock_acquired_at`, `lock_expires_at` y `locked_by`
- definir TTL de lock (recomendado: 5 minutos) y heartbeat de renovacion (recomendado: cada 60 segundos)
- antes de enviar a Meta, validar que el lock siga vigente y pertenezca al worker actual
- usar transiciones `compare-and-set` por `id + status + lock_version` para evitar carreras entre workers
- un lock expirado solo puede ser recuperado si no hubo heartbeat dentro del TTL y la recuperacion incrementa `lock_version`
- la recuperacion debe devolver el despacho a `PENDING` antes de ser retomado por otro worker
- toda recuperacion debe auditarse como `appointment_reminder.dispatch.lock_recovered`

### Idempotencia

Claves recomendadas:

- por despacho: `legacy_agenda_id + reminder_type + appointment_starts_at`
- por envio WhatsApp: `dispatchId + statusTransition`
- por webhook inbound: `meta_inbound_message_id + button_payload_id`

Persistencia requerida para inbound:

- crear tabla de deduplicacion inbound, por ejemplo `bot_webhook_inbound_dedup`
- campos minimos: `id`, `provider`, `inbound_message_id`, `button_payload_id`, `received_at`, `processed_at`, `result_status`
- indice unico obligatorio: `provider + inbound_message_id + button_payload_id`
- la deduplicacion debe ejecutarse en la misma transaccion que la mutacion de negocio

Reglas:

1. correr dos veces el `synchronizer` no debe duplicar despachos
2. correr dos veces el `dispatcher` no debe duplicar envios
3. reintentar envio fallido no debe crear otro despacho
4. reentrega de webhook inbound no debe repetir cambios ni envios

## Reintentos

Politica inicial recomendada:

1. intento inmediato
2. reintento a `+5 minutos`
3. reintento a `+15 minutos`

Despues del tercer fallo:

- marcar `FAILED`
- auditar

No se deben reintentar:

- `SKIPPED_NO_OPT_IN`
- `SKIPPED_INVALID_PHONE`
- `SKIPPED_APPOINTMENT_CANCELLED`
- `SKIPPED_APPOINTMENT_RESCHEDULED`
- `SKIPPED_LATE_CONFIRMATION`
- `SKIPPED_SUPPRESSED_CONTACT`
- `SKIPPED_HANDOFF_ACTIVE`
- `PHONE_VERIFICATION_EXPIRED`

## Auditoria

Eventos minimos recomendados:

- `appointment_reminder.dispatch.created`
- `appointment_reminder.dispatch.updated`
- `appointment_reminder.dispatch.locked`
- `appointment_reminder.dispatch.sent`
- `appointment_reminder.dispatch.failed`
- `appointment_reminder.dispatch.skipped_no_opt_in`
- `appointment_reminder.dispatch.skipped_invalid_phone`
- `appointment_reminder.dispatch.skipped_cancelled`
- `appointment_reminder.dispatch.skipped_rescheduled`
- `appointment_reminder.dispatch.verification_sent`
- `appointment_reminder.dispatch.verification_expired`
- `appointment_reminder.phone_confirmed`
- `appointment_reminder.phone_rejected_unknown_person`
- `appointment_reminder.dispatch.skipped_late_confirmation`
- `appointment_reminder.dispatch.skipped_handoff_active`
- `appointment_reminder.dispatch.lock_recovered`
- `appointment_reminder.inbound.duplicate_ignored`

No se deben registrar telefonos completos en auditoria; deben ir enmascarados cuando aparezcan en metadata.

## Consultas legacy

La consulta elegible debe resolver como minimo:

- `agenda.idagenda`
- `agenda.idusuario`
- `agenda.fecha_cita`
- `agenda.idhora`
- `agenda.IdModalidad`
- `agenda.TipoCita`
- `agenda.idmedico`
- `agenda.IdSede`
- nombre del paciente
- telefono del paciente
- `telefono_verificado_en`
- nombre del profesional
- direccion y ciudad de sede
- especialidad

La implementacion debe mantenerse en un repositorio infrastructure aislado y puede usar SQL raw si Prisma no expresa bien la consulta.

## Manejo de errores

Errores funcionales visibles para paciente:

- en este flujo no se enviaran errores internos; el paciente solo vera el resultado de la plantilla o no vera mensaje adicional

Errores operativos internos:

- fallo transportando a Meta
- template no configurado
- telefono invalido
- falta de opt-in
- cita ya cancelada o no asignada
- conflicto de lock
- verificacion expirada sin respuesta
- duplicado inbound detectado por idempotencia

Todos deben auditarse con mensaje controlado y sin exponer datos sensibles.

## Testing

### Unitarias

- calculo de `scheduledFor`
- regla de envio tardio `>= 3 horas`
- normalizacion de telefono
- resolucion de modalidad
- decision entre recordatorio y verificacion
- transiciones de estado del despacho
- expiracion de `PHONE_VERIFICATION_PENDING` a `PHONE_VERIFICATION_EXPIRED`
- heartbeat y expiracion de lease con `lock_version`

### Integracion

- query legacy de citas elegibles
- persistencia de despacho en bot DB
- deduplicacion inbound con indice unico y transaccion atomica
- actualizacion de `usuarios.telefono_verificado_en`
- limpieza de `usuarios.Tel_fono`
- creacion de supresion `UNKNOWN_PERSON`
- reentrega de webhook `Confirmar` no duplica transiciones
- reentrega de webhook `No lo reconozco` no duplica limpieza/supresion
- recuperacion de lock expirado permite continuar procesamiento

### E2E

- cita asignada con telefono verificado -> envio de recordatorio
- cita asignada con telefono no verificado -> envio de verificacion
- confirmacion con mas de 3 horas -> envio posterior del recordatorio
- confirmacion con menos de 3 horas -> no envio
- respuesta `No lo reconozco` -> limpieza y supresion
- reprogramacion -> nuevo despacho correcto
- cron retrasado -> no se pierde recordatorio
- doble worker -> no duplica envio
- lock huerfano recuperado -> no se pierde recordatorio
- replay inbound de Meta -> no duplica efectos
- despacho en `PHONE_VERIFICATION_PENDING` expira y se cierra sin envio clinico

## Rollout recomendado

### Fase 1

- confirmar templates Meta
- crear tabla bot de despachos
- implementar query legacy y `synchronizer`

### Fase 2

- implementar `dispatcher`
- conectar envio template recordatorio
- auditar y guardar outbound

### Fase 3

- implementar template de verificacion y webhook de botones
- actualizar `usuarios.telefono_verificado_en`
- limpiar `usuarios.Tel_fono` y registrar supresion
- validar correlacion fuerte de botones con `dispatch_id` firmado

### Fase 4

- activar reintentos
- pruebas de volumen
- monitoreo operativo y ajuste de lotes

## Riesgos y mitigaciones

### Riesgo 1: citas creadas o modificadas fuera del bot

Mitigacion:

- `synchronizer` recurrente

### Riesgo 2: envio duplicado

Mitigacion:

- tabla persistente
- lock
- clave unica

### Riesgo 3: exposicion de datos a tercero

Mitigacion:

- no incluir datos de cita en la verificacion
- usar `telefono_verificado_en` como compuerta oficial

### Riesgo 4: confirmacion demasiado tarde

Mitigacion:

- regla explicita de maximo 3 horas antes

### Riesgo 5: dos fuentes de verdad para consentimiento

Mitigacion:

- usar solo `bot_patient_contact_consents` para `APPOINTMENT_NOTIFICATIONS`

## Criterios de aceptacion

1. Toda cita `Asignada` futura elegible genera o refresca un despacho persistente de recordatorio.
2. Un cron retrasado no provoca perdida del recordatorio.
3. El SLA operativo de salida del recordatorio es maximo 5 minutos respecto al `scheduled_for` cuando no hay fallas externas.
4. No se envian datos de cita a numeros con `usuarios.telefono_verificado_en = NULL`.
5. La verificacion usa plantilla `Utility` aprobada con botones.
6. `Confirmar` actualiza `usuarios.telefono_verificado_en` con hora actual Colombia.
7. `No lo reconozco` limpia `usuarios.Tel_fono` y registra supresion de contacto.
8. Si la confirmacion llega con al menos 3 horas de anticipacion, el recordatorio se envia.
9. Si la confirmacion llega con menos de 3 horas de anticipacion, el recordatorio no se envia.
10. El opt-in se valida en base bot con finalidad `APPOINTMENT_NOTIFICATIONS`.
11. No se envian recordatorios ni verificaciones automaticas cuando la conversacion esta en `HUMAN_HANDOFF`.
12. El sistema no duplica envios aunque existan reinicios o multiples workers.
13. Un lock expirado se recupera sin dejar despachos atascados y sin riesgo de doble envio por carrera.
14. Reentregas inbound de Meta no repiten efectos sobre verificacion, limpieza ni envio.
15. Un despacho en `PHONE_VERIFICATION_PENDING` expira automaticamente al llegar a `verification_expires_at`.
