# Reprogramacion de cita desde el boton Reprogramar

## Objetivo

Agregar la implementacion real del boton `Reprogramar` para que un paciente validado pueda mover una cita futura ya asignada hacia otro horario de la misma especialidad, reutilizando el flujo existente de solicitud de cita desde el paso de seleccion de fecha.

El comportamiento esperado es:

1. El paciente entra por `Mover o cancelar`.
2. Selecciona una cita futura asignada.
3. Presiona `Reprogramar`.
4. El bot lo envia directamente al flujo de disponibilidad de la especialidad de esa cita.
5. El flujo inicia en `SELECTING_APPOINTMENT_DATE`.
6. El paciente puede elegir otra fecha o usar la opcion de elegir profesional.
7. Luego selecciona la hora.
8. El sistema asigna el nuevo cupo y libera el cupo anterior en una sola operacion transaccional.
9. El bot responde con el mensaje final de reprogramacion y botones `Menu principal` y `Finalizar`.

## Alcance

Incluye:

- Activacion real del boton `assigned_appointment_action:reprogram`.
- Reutilizacion del flujo existente de fecha, profesional y hora.
- Inicio del subflujo en `SELECTING_APPOINTMENT_DATE`.
- Conservacion obligatoria de la especialidad de la cita original.
- Posibilidad de cambiar de profesional dentro de esa misma especialidad.
- Asignacion del nuevo cupo y liberacion del cupo anterior en una sola transaccion.
- Mensaje final interactivo especifico de reprogramacion.
- Auditoria de inicio, intento, fallback, exito y falla.
- Pruebas unitarias y de navegacion para el nuevo subflujo.

No incluye:

- Cambios al flujo de cancelacion ya implementado.
- Cambios de handoff humano.
- Cambios estructurales en tablas legacy.
- Reprogramacion entre especialidades diferentes.
- Reprogramacion de citas no futuras.

## Decisiones cerradas

1. La reprogramacion conserva la especialidad de la cita original.
2. El paciente si puede cambiar de profesional, siempre dentro de esa especialidad.
3. El flujo no pasa por `SELECTING_SPECIALTY`; entra directo a `SELECTING_APPOINTMENT_DATE`.
4. La pantalla de fechas debe seguir mostrando la opcion de `Elegir profesional`, igual que el flujo normal.
5. La operacion de reprogramacion debe ser atomica: si falla la nueva asignacion, la cita original no se libera.
6. La liberacion del cupo anterior debe actualizar `agenda` con los mismos campos usados en la cancelacion por bot.
7. El valor canonicamente libre en legacy sigue siendo `Estado = 'Sin asignar'` e `idusuario = '0000'`.
8. El mensaje final debe ser diferente al de asignacion nueva y debe decir `su cita se reprogramo satisfactoriamente`.
9. Si la cita original no permite resolver de forma segura la especialidad por `CUPS`, el bot no reprograma y responde con un mensaje controlado.
10. `Volver`, `Menu principal` y `Finalizar` deben limpiar el contexto del subflujo de reprogramacion.

## Reglas funcionales

### Regla de entrada al subflujo

Cuando el paciente este en `REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS` y presione `Reprogramar`, el sistema debe:

- conservar la cita seleccionada como cita original de referencia
- resolver la especialidad operativa de esa cita
- cargar fechas disponibles para esa especialidad
- mover la conversacion a `SELECTING_APPOINTMENT_DATE`

No debe pedir nuevamente documento, fecha de nacimiento ni especialidad.

### Regla de especialidad operativa

La reprogramacion necesita un identificador estable de especialidad para consultar disponibilidad.

La fuente principal sera:

- `agenda.TipoCita` como `specialtyCups`

Condiciones:

- si `TipoCita` viene informado y no vacio, se usa como filtro principal del subflujo
- el nombre visible de especialidad puede seguir resolviendose con la estrategia actual de presentacion
- si `TipoCita` esta vacio o no permite una reprogramacion confiable, el flujo no debe continuar por bot

Respuesta funcional recomendada para ese caso:

- `En este momento no podemos reprogramar esta cita automaticamente. Por favor intenta con un asesor desde el menu principal.`

### Regla de navegacion del subflujo

La reprogramacion es un subflujo de `CANCEL_OR_RESCHEDULE`, no una solicitud nueva.

Por eso:

- desde `SELECTING_APPOINTMENT_DATE`, `Volver` debe regresar al detalle de la cita seleccionada
- desde `SELECTING_APPOINTMENT_DOCTOR`, `Volver` debe regresar a la lista de fechas de esa reprogramacion
- desde `SELECTING_APPOINTMENT_TIME`, `Volver` debe seguir regresando a fechas
- `Menu principal` y `Finalizar` deben limpiar el contexto de reprogramacion

### Regla de disponibilidad

La busqueda de fechas, profesionales y horas debe seguir exactamente las reglas ya existentes del flujo normal de solicitud:

- misma especialidad por `CUPS`
- misma sede habilitada por el flujo actual
- mismos filtros de disponibilidad
- misma logica de `fallback` cuando un cupo visible ya no este disponible

La unica diferencia es el punto de entrada y el cierre transaccional.

### Regla de reprogramacion atomica

La reprogramacion solo sera exitosa si ocurren ambas acciones:

1. asignar el nuevo cupo
2. liberar el cupo anterior

Estas dos acciones deben ejecutarse dentro de una sola transaccion.

Si cualquiera falla:

- se hace rollback completo
- el paciente conserva su cita original
- el bot responde con un mensaje controlado de falla tecnica o de disponibilidad

### Regla de liberacion del cupo anterior

Una vez asignado correctamente el nuevo cupo, el cupo original debe quedar asi en `agenda`:

- `idusuario = '0000'`
- `AsignadaPor = NULL`
- `fecha_solicitud = NULL`
- `Telefono = NULL`
- `MedioSolicitud = NULL`
- `Estado = 'Sin asignar'`
- `fecha_cancelada = fecha de cancelacion en America/Bogota`
- `motivo = 'CANCELADA POR EL PACIENTE DESDE EL BOT'`
- `cancelada_por = 'BOT'`
- `paciente_cancelada = IdUsuario del paciente`

El `UPDATE` del cupo original solo puede ocurrir si ese registro sigue cumpliendo:

- `idagenda` coincide con la cita original
- `Estado = 'Asignada'`
- `idusuario` coincide con el paciente validado
- la cita sigue siendo futura

### Regla del mensaje final

Cuando la reprogramacion sea exitosa, el bot debe responder con mensaje interactivo tipo boton usando el nuevo cupo asignado:

```txt
Senor(a) ${appointment.patientFullName}, su cita se reprogramo satisfactoriamente.

🩺Especialidad: ${appointment.specialtyName}
👩🏼‍💻Modalida: PRESENCIAL
📅Fecha de la cita: ${appointment.appointmentDateIso}
🕜Hora: ${appointment.appointmentDisplayTime}
👩🏼‍⚕️Profesional: ${appointment.professionalName}
🏙️Sede: ${appointment.siteName}.
🏙️Direccion: ${appointment.siteAddress}.

Favor estar 🕘 15 minutos antes de la hora asignada
```

Botones:

- `nav_main_menu` con titulo `Menu principal`
- `nav_finish` con titulo `Finalizar`

## Flujo conversacional

### Caso principal

1. El paciente entra al flujo `Mover o cancelar`.
2. Valida identidad.
3. El bot muestra sus citas futuras asignadas.
4. El paciente selecciona una cita.
5. El bot muestra el detalle con botones `Reprogramar` y `Cancelar`.
6. El paciente pulsa `Reprogramar`.
7. El sistema resuelve `specialtyCups` de la cita original.
8. El sistema consulta fechas disponibles para esa especialidad.
9. El bot muestra la lista de fechas y permite `Elegir profesional`.
10. El paciente elige fecha o profesional y luego fecha.
11. El paciente selecciona una hora.
12. El sistema intenta reprogramar de forma atomica.
13. Si la operacion es exitosa, el bot responde con el mensaje final de reprogramacion.

### Caso de cambio de profesional

1. El paciente entra al subflujo de reprogramacion.
2. En `SELECTING_APPOINTMENT_DATE`, elige `Elegir profesional`.
3. El bot muestra medicos disponibles de la misma especialidad.
4. El paciente selecciona un profesional.
5. El bot muestra fechas para ese profesional dentro de la misma especialidad.
6. El paciente elige fecha y hora.
7. El sistema reprograma usando el nuevo profesional.

### Caso de cita original no reprogramable

Si la cita original ya no cumple las condiciones o no tiene `specialtyCups` seguro:

1. no se inicia el subflujo de disponibilidad
2. se registra auditoria de rechazo
3. el bot responde con mensaje controlado
4. el paciente puede volver al menu o terminar

### Caso de nuevo horario agotado

Si el nuevo `slotRef` ya no esta disponible al momento de confirmar:

1. el sistema intenta `fallback` si el flujo no estaba fijado a un medico especifico
2. si el `fallback` existe y queda asignado, la reprogramacion continua con exito
3. si ya no existe cupo para esa hora, el bot informa que la hora ya no esta disponible
4. el flujo permanece en `SELECTING_APPOINTMENT_TIME`
5. el bot vuelve a mostrar horas actualizadas del mismo dia

### Caso de cita original ya no valida al confirmar

Si la cita original cambia antes de completar la transaccion:

1. la transaccion no debe liberar ningun cupo
2. la nueva asignacion tambien debe revertirse
3. el sistema registra rechazo de reprogramacion
4. el bot informa que la cita original ya no esta disponible para reprogramar
5. el sistema reconstruye el listado de citas asignadas si todavia hay citas futuras

## Arquitectura y estados

Se mantiene modular monolith + arquitectura hexagonal.

### Estados existentes reutilizados

Se reutilizan:

- `SELECTING_ASSIGNED_APPOINTMENT`
- `REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS`
- `SELECTING_APPOINTMENT_DATE`
- `SELECTING_APPOINTMENT_DOCTOR`
- `SELECTING_APPOINTMENT_TIME`

No es necesario crear un nuevo estado conversacional si el subflujo queda representado en sesion de forma explicita.

### Contexto nuevo recomendado

Agregar un contexto especifico de reprogramacion, por ejemplo:

- `appointmentReschedule.originalSlotRef`
- `appointmentReschedule.originalSpecialtyName`
- `appointmentReschedule.originalSpecialtyCups`
- `appointmentReschedule.originalDoctorEmployeeCode?`
- `appointmentReschedule.originalAppointmentDateIso`
- `appointmentReschedule.originalAppointmentTimeHHmm`

Objetivos:

- distinguir una asignacion nueva de una reprogramacion
- redirigir `Volver` correctamente
- saber que cupo original debe liberarse al confirmar la nueva hora

### Enriquecimiento de la cita seleccionada

La estructura de cita asignada en sesion hoy no tiene toda la informacion operativa necesaria.

Para reprogramacion debe quedar disponible al menos:

- `slotRef`
- `specialtyName`
- `specialtyCups`
- `professionalName`
- `appointmentDateIso`
- `appointmentTimeHHmm`
- `appointmentDisplayTime`

`specialtyCups` debe provenir de la consulta a legacy y guardarse desde que se arma el listado de citas asignadas.

## Diseno por capas

### Capa de conversacion

Cambios esperados:

- reemplazar el placeholder actual del boton `Reprogramar`
- iniciar el contexto `appointmentReschedule`
- sembrar `specialtySelection.selectedSpecialty` con la especialidad de la cita original
- cargar fechas disponibles y pasar a `SELECTING_APPOINTMENT_DATE`
- desviar el cierre de `SELECTING_APPOINTMENT_TIME` al caso de uso de reprogramacion cuando exista `appointmentReschedule`

Componentes a ajustar:

- `reviewing-assigned-appointment-actions.handler.ts`
- `selecting-appointment-time.handler.ts`
- `conversation-navigation.service.ts`
- `conversation-state-prompt.service.ts`
- factories de mensaje final

### Capa de aplicacion en appointments

Crear un caso de uso dedicado:

- `reschedule-assigned-appointment-by-patient.use-case.ts`

Responsabilidades:

- validar la entrada del intento de reprogramacion
- obtener datos del paciente necesarios para asignacion
- coordinar la transaccion de asignar nuevo cupo y liberar cupo anterior
- resolver datos finales para el mensaje de confirmacion
- devolver un resultado funcional sin filtrar detalles tecnicos al paciente

Resultado recomendado:

- `RESCHEDULED`
- `TIME_NO_LONGER_AVAILABLE`
- `ORIGINAL_APPOINTMENT_NOT_REBOOKABLE`
- `TECHNICAL_FAILURE`

Si el estado es `RESCHEDULED`, debe devolver el mismo shape funcional de una cita confirmada:

- `slotRef`
- `specialtyName`
- `patientFullName`
- `appointmentDateIso`
- `appointmentTimeHHmm`
- `appointmentDisplayTime`
- `professionalName`
- `siteName`
- `siteAddress`
- `usedFallbackSlot`

### Capa de persistencia

Crear un puerto dedicado:

- `appointment-rescheduling.repository.ts`

Responsabilidades:

- verificar elegibilidad del cupo original
- asignar el nuevo cupo con guardias de concurrencia
- buscar `fallback` si aplica
- liberar el cupo original solo despues de asignar el nuevo
- ejecutar todo dentro de una transaccion

No debe construir mensajes ni tomar decisiones conversacionales.

## Diseno de persistencia

### Tablas legacy involucradas

- `agenda`
- `usuarios`
- `empleados`
- `especialidad_empleados`
- `sedes`

### Estrategia transaccional

La operacion segura no debe ser:

1. cancelar la cita original
2. salir de la transaccion
3. intentar asignar la nueva

La estrategia correcta es:

1. abrir transaccion
2. validar que la cita original sigue asignada al paciente y sigue siendo futura
3. intentar asignar el nuevo `slotRef`
4. si el nuevo `slotRef` falla y no hay medico fijo, intentar `fallback`
5. si no se logra nueva asignacion, hacer rollback
6. si la nueva asignacion si ocurre, liberar el cupo original
7. confirmar transaccion

### Guardias del nuevo cupo

El `UPDATE` del nuevo cupo debe seguir las mismas reglas de concurrencia del flujo de asignacion actual:

- `idagenda` coincide con el cupo elegido
- `Estado = 'Sin asignar'`
- `idusuario = '0000'`
- `IdSede = 109`

Si el flujo venia con profesional elegido, no debe usar `fallback` hacia otro medico.

### Guardias del cupo original

El `UPDATE` de liberacion del cupo original debe validar:

- `idagenda` coincide con el cupo original
- `Estado = 'Asignada'`
- `idusuario` coincide con el paciente
- sigue siendo una cita futura

Si este `UPDATE` no afecta filas, la transaccion debe revertirse por completo.

## Auditoria

Eventos recomendados:

- `conversation.assigned_appointment.reprogramming.started`
- `appointment.rescheduling.attempted`
- `appointment.rescheduling.primary_slot_unavailable`
- `appointment.rescheduling.fallback_slot_found`
- `appointment.rescheduling.succeeded`
- `appointment.rescheduling.rejected`
- `appointment.rescheduling.failed`

Metadatos minimos:

- `conversationKey`
- `patientId`
- `originalSlotRef`
- `preferredSlotRef`
- `assignedSlotRef` cuando exista
- `specialtyCups`
- `doctorEmployeeCode` cuando aplique
- `appointmentDate`
- `appointmentTime`
- `reason` cuando falle o sea rechazado

## Pruebas

### Aplicacion

- reprograma exitosamente cuando la cita original es valida y el nuevo cupo sigue libre
- reprograma exitosamente con `fallback` cuando el cupo visible se agota y no habia medico fijo
- devuelve `TIME_NO_LONGER_AVAILABLE` cuando ya no quedan cupos para esa hora
- devuelve `ORIGINAL_APPOINTMENT_NOT_REBOOKABLE` cuando la cita original ya no es liberable
- devuelve `TECHNICAL_FAILURE` cuando falta informacion minima o ocurre una falla inesperada

### Persistencia

- la transaccion asigna el nuevo cupo y libera el anterior
- si falla la asignacion nueva, el cupo original permanece intacto
- si falla la liberacion del original, la asignacion nueva se revierte
- el `UPDATE` de liberacion deja los campos exactos requeridos en `agenda`

### Conversacion

- `Reprogramar` inicia en `SELECTING_APPOINTMENT_DATE` con la especialidad de la cita elegida
- el contexto `appointmentReschedule` queda sembrado correctamente
- al confirmar hora en modo reprogramacion se usa el mensaje final de reprogramacion
- `Volver` desde fechas en reprogramacion regresa al detalle de la cita seleccionada
- `Menu principal` y `Finalizar` limpian el contexto de reprogramacion

## Riesgos y controles

### Riesgo de especialidad ambigua

Si la cita original no expone un `CUPS` confiable, reprogramar con una especialidad incorrecta seria peor que no reprogramar.

Control:

- bloquear la reprogramacion automatica en ese caso
- ofrecer mensaje funcional para pasar a asesor

### Riesgo de doble asignacion

Si la nueva cita se asigna pero la original no se libera, el paciente quedaria con dos cupos.

Control:

- exigir transaccion unica
- rollback si la liberacion del original no afecta filas

### Riesgo de perdida de cita

Si se cancela primero y luego falla la nueva asignacion, el paciente pierde su cupo actual.

Control:

- nunca liberar primero
- solo liberar despues de tener el nuevo cupo efectivamente asignado
