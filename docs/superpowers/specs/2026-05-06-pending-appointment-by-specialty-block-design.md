# Bloqueo por cita pendiente futura en la misma especialidad

## Objetivo

Evitar que un paciente agende una nueva cita cuando ya tiene una cita asignada, futura y pendiente de cumplir en la misma especialidad seleccionada.

El comportamiento esperado es:

1. El paciente selecciona una especialidad en el flujo de solicitud de cita.
2. El sistema valida si existe una cita pendiente futura para ese paciente en esa misma especialidad.
3. Si existe, el flujo se bloquea y el bot responde con el detalle de la cita pendiente mas cercana.
4. Si no existe, el flujo continua normalmente hacia seleccion de fecha.

## Alcance

Incluye:

1. Validacion de cita pendiente en `SELECTING_SPECIALTY`.
2. Consulta en tabla legacy `agenda` con filtros funcionales definidos.
3. Seleccion de la cita pendiente mas cercana cuando existan multiples.
4. Mensaje de bloqueo en formato `interactive_buttons` con 3 botones.
5. Soporte de accion `Volver` para regresar a seleccion de especialidad.
6. Auditoria para validacion iniciada, bloqueo, paso libre y fallo tecnico.
7. Pruebas unitarias de caso de uso, repositorio y handler.

No incluye:

1. Cambios a reglas de asignacion, cancelacion o reagendamiento.
2. Cambios de esquema de base de datos.
3. Ajustes a reglas de handoff humano.
4. Cambios en motor de navegacion global fuera de este flujo.

## Regla de negocio

Una cita se considera pendiente para bloquear nueva asignacion de la misma especialidad si cumple:

1. `agenda.Estado = 'Asignada'`.
2. `agenda.idusuario` corresponde al paciente autenticado en la sesion.
3. La cita es futura considerando fecha y hora combinadas.
4. Corresponde a la misma especialidad seleccionada por `Cups`.

Si hay mas de una cita que cumple la regla, se debe usar la mas cercana por fecha y hora.

## Flujo conversacional esperado

### Caso bloqueado

1. En `SELECTING_SPECIALTY`, el paciente elige una especialidad valida.
2. Antes de consultar disponibilidad de fechas, el sistema valida cita pendiente futura.
3. Si encuentra cita pendiente, permanece en `SELECTING_SPECIALTY`.
4. Responde un mensaje `interactive_buttons` con detalle de cita y 3 botones:
   1. `↩ Volver`
   2. `Menu principal`
   3. `Finalizar`
5. El flujo no debe avanzar a `SELECTING_APPOINTMENT_DATE`.

### Caso sin bloqueo

1. Si no existe cita pendiente futura en la especialidad seleccionada, el flujo sigue igual:
   1. consulta fechas disponibles
   2. pasa a `SELECTING_APPOINTMENT_DATE` cuando haya disponibilidad
   3. o vuelve a `MAIN_MENU` con mensaje existente si no hay disponibilidad

### Comportamiento del boton `↩ Volver` en bloqueo

1. El boton de bloqueo usa un `option id` propio, no `nav_back`.
2. El `SelectingSpecialtyHandler` interpreta ese id y vuelve a mostrar lista de especialidades.
3. Esto permite seleccionar una especialidad distinta sin redirigir a `MAIN_MENU`.

## Arquitectura y diseño por capas

Se mantiene modular monolith + arquitectura hexagonal.

### Capa de aplicacion (appointments)

Nuevo caso de uso:

1. `find-nearest-pending-future-appointment-by-patient-and-specialty.use-case.ts`

Responsabilidades:

1. Validar entrada (`patientId`, `specialtyCups`, `now`).
2. Solicitar a repositorio la cita pendiente mas cercana.
3. Transformar salida a resultado de aplicacion simple:
   1. `hasPendingAppointment: true` con detalle
   2. `hasPendingAppointment: false`
   3. `status: TECHNICAL_FAILURE` en caso excepcional

### Capa de dominio (appointments)

Nuevo puerto:

1. `pending-appointment-check.repository.ts`

Contrato principal:

1. `findNearestPendingFutureAppointmentByPatientAndSpecialty(...)`

Salida del puerto:

1. datos del paciente para saludo
2. datos de cita (fecha, hora, modalidad)
3. datos de profesional
4. datos de sede y direccion

### Capa de infraestructura (appointments)

Nuevo adaptador Prisma legacy:

1. `prisma-legacy-pending-appointment-check.repository.ts`

Responsabilidades:

1. Ejecutar consulta SQL parametrizada sobre tablas legacy.
2. Aplicar filtros de regla de negocio.
3. Retornar la cita mas cercana (`ORDER BY ... LIMIT 1`).
4. No construir mensajes de WhatsApp.

### Capa de conversacion

1. `SelectingSpecialtyHandler` integra el caso de uso nuevo antes de consultar disponibilidad de fechas.
2. Nueva factory:
   1. `pending-appointment-block-message.factory.ts`
3. Nuevo helper de option id para `↩ Volver` de bloqueo:
   1. `pending-appointment-block-option-id.ts`

## Consulta y criterios de persistencia

Tablas legacy involucradas:

1. `agenda` (fuente principal)
2. `especialidad_empleados` (validacion de especialidad por `Cups`)
3. `usuarios` (nombre paciente)
4. `empleados` (nombre profesional)
5. `sedes` (sede y direccion)

Filtros obligatorios:

1. `TRIM(COALESCE(a.Estado, '')) = 'Asignada'`
2. `TRIM(COALESCE(a.idusuario, '')) = {patientId}`
3. `STR_TO_DATE(TRIM(COALESCE(a.idhora, '')), '%H:%i') IS NOT NULL`
4. especialidad por `Cups` usando `EXISTS` con `especialidad_empleados`
5. cita estrictamente futura por fecha+hora contra `now` en `America/Bogota`

Criterio temporal en SQL:

1. convertir `now` a `dateIso` y `timeHHmm` en capa de aplicacion
2. filtrar:
   1. `a.fecha_cita > dateIso`
   2. o `a.fecha_cita = dateIso` y `a.idhora > timeHHmm` como hora real

Priorizacion:

1. `ORDER BY a.fecha_cita ASC, STR_TO_DATE(TRIM(a.idhora), '%H:%i') ASC, a.idagenda ASC`
2. `LIMIT 1`

## Formato del mensaje de bloqueo

Tipo de mensaje:

1. `interactive_buttons`

Cuerpo:

1. `Hola {nombre_paciente} ya tienes una cita asignada para {nombre_especialidad}:`
2. linea en blanco
3. `🩺Especialidad: {nombre_especialidad}`
4. `👩🏼‍💻Modalidad: {modalidad}`
5. `📅Fecha de la cita: {YYYY-MM-DD}`
6. `🕜Hora: {hh:mm AM/PM}`
7. `👩🏼‍⚕️Profesional: {nombre_profesional}`
8. `🏙️Sede: {nombre_sede}.`
9. `🏙️Dirección: {direccion_sede}.`

Regla de modalidad:

1. `IdModalidad = 0` => `PRESENCIAL`
2. `IdModalidad != 0` => valor vacio despues de `Modalidad:`

Botones:

1. `↩ Volver` con option id custom de bloqueo
2. `Menu principal` con `nav_main_menu`
3. `Finalizar` con `nav_finish`

## Auditoria

Eventos a registrar:

1. `appointment.pending_by_specialty.check.started`
2. `appointment.pending_by_specialty.check.blocked`
3. `appointment.pending_by_specialty.check.clear`
4. `appointment.pending_by_specialty.check.failed`

Campos de auditoria:

1. `conversationKey`
2. `patientId`
3. `specialtyCode`
4. `specialtyCups`
5. `slotRef` (si bloqueado)
6. `appointmentDate` y `appointmentTime` (si bloqueado)
7. `errorMessage` (si fallo)

No registrar datos sensibles adicionales innecesarios.

## Manejo de errores

Si la validacion de cita pendiente falla por error tecnico:

1. No permitir avance por seguridad funcional.
2. Responder con mensaje tecnico existente de agenda (`buildTechnicalFailure()`).
3. Registrar auditoria `...check.failed`.
4. No exponer mensaje tecnico interno al paciente.

## Pruebas

### Caso de uso

1. Retorna `hasPendingAppointment: false` cuando no hay cita pendiente.
2. Retorna `hasPendingAppointment: true` con cita mas cercana cuando hay multiples.
3. Maneja entrada invalida retornando `TECHNICAL_FAILURE` con razon `INVALID_INPUT`.
4. Deriva modalidad segun regla (`0` presencial, otro vacio).

### Repositorio legacy

1. Filtra por `Estado = 'Asignada'`.
2. Filtra por `idusuario` del paciente.
3. Filtra por `Cups` de especialidad.
4. Excluye horas invalidas.
5. Aplica criterio de futuro por fecha+hora.
6. Selecciona solo la cita mas cercana.

### Handler `SelectingSpecialtyHandler`

1. Bloquea flujo cuando hay cita pendiente y responde `interactive_buttons`.
2. No avanza a seleccion de fecha cuando bloquea.
3. `↩ Volver` del bloqueo vuelve a mostrar especialidades.
4. Si no hay cita pendiente, conserva comportamiento actual.
5. Si falla validacion pendiente, responde mensaje tecnico seguro.

## Archivos propuestos

Nuevos:

1. `src/modules/appointments/domain/ports/pending-appointment-check.repository.ts`
2. `src/modules/appointments/application/use-cases/find-nearest-pending-future-appointment-by-patient-and-specialty.use-case.ts`
3. `src/modules/appointments/infrastructure/persistence/mysql/prisma-legacy-pending-appointment-check.repository.ts`
4. `src/modules/conversations/application/services/pending-appointment-block-message.factory.ts`
5. `src/modules/conversations/application/services/pending-appointment-block-option-id.ts`
6. `src/modules/appointments/application/use-cases/find-nearest-pending-future-appointment-by-patient-and-specialty.use-case.spec.ts`
7. `src/modules/appointments/infrastructure/persistence/mysql/prisma-legacy-pending-appointment-check.repository.spec.ts`

Ajustes:

1. `src/modules/appointments/domain/appointments.tokens.ts`
2. `src/modules/appointments/appointments.module.ts`
3. `src/modules/conversations/application/state-handlers/selecting-specialty.handler.ts`
4. `src/modules/conversations/application/state-handlers/selecting-specialty.handler.spec.ts`
5. `src/modules/conversations/conversations.module.ts` (solo si hace falta registrar provider adicional)

## Definition of Done

1. El bloqueo se ejecuta en `SELECTING_SPECIALTY` antes de consultar fechas.
2. La regla de pendiente usa exactamente:
   1. `Estado='Asignada'`
   2. `idusuario` del paciente
   3. misma especialidad por `Cups`
   4. fecha/hora futura
3. Si hay multiples, se usa solo la mas cercana.
4. El mensaje de bloqueo sale como `interactive_buttons` con 3 botones.
5. `↩ Volver` del bloqueo devuelve a seleccion de especialidad.
6. Modalidad cumple:
   1. `IdModalidad=0` => `PRESENCIAL`
   2. otro => vacio
7. Se generan eventos de auditoria definidos.
8. Pruebas nuevas y ajustadas pasan en alcance relevante.
9. No se rompe comportamiento existente cuando no hay bloqueo.
