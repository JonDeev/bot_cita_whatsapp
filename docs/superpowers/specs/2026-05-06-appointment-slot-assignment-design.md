# Asignacion inmediata de cupo al seleccionar la hora

## Objetivo

Agregar el paso de asignacion real de la cita inmediatamente despues de que el paciente seleccione una hora disponible.

El comportamiento esperado es:

1. El paciente selecciona una hora visible en el flujo.
2. Esa hora ya viene ligada internamente a un `idagenda` representante.
3. El sistema intenta asignar primero ese `idagenda`.
4. Antes de actualizar, revalida que el cupo siga disponible.
5. Si el cupo representante ya no esta libre, el sistema intenta automaticamente otro cupo libre de la misma combinacion funcional.
6. Si logra asignar un cupo, responde con el mensaje final de confirmacion.
7. Si ya no queda ningun cupo libre para esa misma hora, informa al paciente y vuelve a mostrar horas del mismo dia.

## Alcance

Este cambio cubre solo la asignacion inmediata del cupo despues de seleccionar la hora.

Incluye:

- Asignacion inmediata desde `SELECTING_APPOINTMENT_TIME`.
- Revalidacion concurrente de disponibilidad en `agenda`.
- Fallback automatico a otro cupo libre de la misma hora.
- Actualizacion segura del cupo exacto por `idagenda`.
- Consulta de datos finales de paciente, profesional y sede.
- Mensaje final de confirmacion.
- Auditoria del intento, fallback y resultado final.
- Pruebas unitarias pequenas por responsabilidad.

No incluye:

- Nuevo paso conversacional de confirmacion.
- Reagendamiento o cancelacion.
- Cambios estructurales en tablas legacy.
- Cambios de reglas para otras sedes diferentes de `IdSede = 109`.

## Reglas funcionales

### Regla principal

La hora visible que el paciente selecciona debe seguir ligada a un cupo real en `agenda`.

Eso significa:

- la interfaz muestra la hora una sola vez
- internamente la opcion conserva un `slotRef`
- `slotRef` representa el `idagenda` del cupo principal de esa hora

### Regla de disponibilidad

Un cupo solo puede asignarse si en el momento del update sigue cumpliendo:

- `agenda.Estado = 'Sin asignar'`
- `agenda.idusuario = '0000'`
- `agenda.IdSede = 109`

### Regla de fallback

Si el `idagenda` representante ya no esta disponible, el sistema debe intentar automaticamente otro cupo libre que cumpla:

- misma especialidad por `Cups`
- mismo dia por `fecha_cita`
- misma hora por `idhora`
- misma sede `IdSede = 109`
- `Estado = 'Sin asignar'`
- `idusuario = '0000'`
- profesional habilitado para bot con `especialidad_empleados.bot = 'SI'`

Si no existe ningun cupo libre para esa misma combinacion, la hora se considera agotada.

### Regla de sede

Para este flujo, el bot solo puede asignar cupos de la sede:

- `IdSede = 109`

La consulta de horas, la revalidacion y el fallback deben respetar siempre esa restriccion.

### Regla de actualizacion en agenda

Cuando la asignacion sea exitosa, el registro exacto de `agenda` debe actualizar:

- `idusuario = usuarios.IdUsuario`
- `AsignadaPor = 'AdrianaBot'`
- `fecha_solicitud = fecha actual del autoagendamiento`
- `Estado = 'Asignada'`
- `MedioSolicitud = 'BOT'`
- `Telefono = telefono del paciente`

`fecha_solicitud` debe guardar solo fecha porque la columna legacy es `DATE`.

El valor usado para `agenda.idusuario` debe salir de `usuarios.IdUsuario`.

## Flujo conversacional

### Caso exitoso

1. El paciente selecciona una opcion valida de hora.
2. El handler toma el `slotRef` y la hora seleccionada desde la sesion.
3. El handler invoca el caso de uso de asignacion inmediata.
4. El caso de uso intenta asignar el cupo principal.
5. Si el cupo principal ya no esta libre, intenta fallback automatico a otro cupo libre de la misma hora.
6. Si la asignacion ocurre, el handler responde con el mensaje final de cita asignada.

### Hora agotada

Si no se puede asignar ni el cupo principal ni un fallback valido:

1. El sistema informa que la hora ya no esta disponible.
2. El flujo permanece en `SELECTING_APPOINTMENT_TIME`.
3. El bot vuelve a mostrar horas disponibles del mismo dia.

### Falla tecnica

Si ocurre una falla de infraestructura o consulta:

1. El sistema no expone el error interno al paciente.
2. El flujo pasa a un estado seguro.
3. El bot responde con un mensaje funcional para reintentar o volver al menu.

## Arquitectura de aplicacion

### Estado conversacional

No se agrega un nuevo estado para confirmar la cita.

`SELECTING_APPOINTMENT_TIME` pasa a ser el estado que:

- valida la hora seleccionada
- ejecuta la asignacion inmediata
- decide si la cita fue creada, si la hora se agoto o si hubo falla tecnica

### Caso de uso principal

Crear un caso de uso dedicado:

- `assign-appointment-slot-after-time-selection.use-case.ts`

Responsabilidades:

- validar datos minimos de entrada
- intentar asignar el `idagenda` principal
- resolver fallback si el principal ya no esta libre
- cargar datos finales de confirmacion
- devolver un resultado funcional, no excepciones de negocio

### Resultado del caso de uso

El caso de uso debe devolver uno de estos estados:

- `ASSIGNED`
- `TIME_NO_LONGER_AVAILABLE`
- `TECHNICAL_FAILURE`

Si el estado es `ASSIGNED`, debe incluir:

- `idagenda`
- `usedFallbackSlot`
- `appointmentDateIso`
- `appointmentTimeHHmm`
- `appointmentDisplayTime`
- `specialtyName`
- `patientFullName`
- `professionalName`
- `siteName`
- `siteAddress`

### Repositorio de asignacion

Crear un puerto especifico para asignacion, separado del repositorio de disponibilidad:

- `appointment-assignment.repository.ts`

Responsabilidades:

- intentar update condicional por `idagenda`
- buscar un slot fallback de la misma combinacion funcional
- exponer una API pequena y enfocada a concurrencia y asignacion

No debe construir mensajes ni contener logica conversacional.

### Repositorio de datos de confirmacion

Crear un puerto de lectura agregado:

- `appointment-confirmation-details.repository.ts`

Responsabilidades:

- consultar datos del paciente en `usuarios`
- consultar nombre del profesional en `empleados`
- consultar sede y direccion en `sedes`

Esto evita sobrecargar el repositorio de validacion del paciente, que hoy solo valida identidad.

### Factory del mensaje final

Crear una factory dedicada:

- `appointment-assignment-confirmation-message.factory.ts`

Responsabilidad:

- construir exactamente el mensaje final que se enviara por WhatsApp

No debe consultar base de datos ni decidir reglas de negocio.

## Diseño de persistencia

### Tablas legacy involucradas

- `agenda`
- `usuarios`
- `empleados`
- `especialidad_empleados`
- `sedes`

### Restriccion de lectura y escritura

- `usuarios`, `empleados`, `especialidad_empleados` y `sedes` siguen siendo solo lectura
- `agenda` solo puede actualizarse con guardias explicitas y con `ALLOW_AGENDA_UPDATES = true`

### Estrategia segura de actualizacion

La asignacion no debe hacerse con una secuencia insegura de:

- leer cupo
- asumir que sigue libre
- actualizar sin condicion

La estrategia correcta es:

1. Ejecutar update condicional sobre `agenda`.
2. Filtrar por:
   - `idagenda`
   - `Estado = 'Sin asignar'`
   - `idusuario = '0000'`
   - `IdSede = 109`
3. Si el update afecta `1` fila, el cupo fue asignado.
4. Si afecta `0` filas, el cupo ya no estaba disponible.

### Busqueda de fallback

La busqueda del fallback debe resolver un cupo libre con:

- mismo `Cups`
- mismo `fecha_cita`
- mismo `idhora`
- misma sede `109`
- `Estado = 'Sin asignar'`
- `idusuario = '0000'`
- `bot = 'SI'`

Debe devolver un solo candidato determinista para reintentar la asignacion.

## Datos de salida para confirmacion

### Paciente

Fuente: `usuarios`

Campos:

- `IdUsuario`
- `Primer_nombre`
- `Segundo_nombre`
- `Primer_apellido`
- `Segundo_apellido`
- `Teléfono`

### Profesional

Fuente: `empleados`

Campos:

- `Código_empleado`
- `Nombre_empleado`

### Sede

Fuente: `sedes`

Campos:

- `IdSede`
- `Sede`
- `Direccion`

## Mensaje final al paciente

La respuesta exitosa debe salir exactamente con este formato, sustituyendo los valores reales:

```txt
Señor(a) {PACIENTE}, su cita se asignó satisfactoriamente.

🩺Especialidad: {ESPECIALIDAD}
👩🏼‍💻Modalida: PRESENCIAL
📅Fecha de la cita: {FECHA}
🕜Hora: {HORA AM/PM}
👩🏼‍⚕️Profesional: {PROFESIONAL}
🏙️Sede: {SEDE}.
🏙️Direccion: {DIRECCION}.

Favor estar 🕘 15 minutos antes de la hora asignada
```

La hora debe mostrarse en formato de 12 horas con `AM/PM`.

## Auditoria

Registrar al menos estos eventos:

- `appointment.assignment.attempted`
- `appointment.assignment.primary_slot_unavailable`
- `appointment.assignment.fallback_slot_found`
- `appointment.assignment.time_exhausted`
- `appointment.assignment.succeeded`
- `appointment.assignment.failed`

Campos minimos sugeridos:

- `conversationKey`
- `patientId`
- `specialtyCode`
- `specialtyCups`
- `appointmentDate`
- `appointmentTime`
- `preferredSlotRef`
- `assignedSlotRef`
- `usedFallbackSlot`

No se debe registrar mas informacion sensible de la necesaria.

## Manejo de errores

### Error funcional

Si la hora ya no tiene cupos disponibles:

- no se debe tratar como error tecnico
- el sistema debe responder con un mensaje funcional
- el flujo debe permitir elegir otra hora

### Error tecnico

Si falla base de datos, consulta o update:

- no se debe exponer detalle interno al paciente
- se debe auditar el error
- el flujo debe degradar a un estado seguro

## Pruebas recomendadas

Crear pruebas cortas y enfocadas:

- `assign-appointment-slot-after-time-selection.use-case.spec.ts`
- `prisma-legacy-appointment-assignment.repository.spec.ts`
- `appointment-assignment-confirmation-message.factory.spec.ts`
- `selecting-appointment-time.handler.spec.ts`

Casos minimos:

- asigna correctamente con el cupo principal
- usa fallback cuando el principal ya no esta libre
- devuelve `TIME_NO_LONGER_AVAILABLE` si no queda fallback
- devuelve `TECHNICAL_FAILURE` ante falla de infraestructura
- arma el mensaje final exacto
- el update respeta las guardias de disponibilidad real

## Notas de implementacion

- El schema Prisma actual debe extenderse para incluir el modelo legacy `sedes`.
- La consulta de horas disponible y la futura asignacion deben respetar `IdSede = 109`.
- No se debe guardar en sesion informacion derivada como nombre del profesional o direccion de sede, para evitar datos stale.
- La sesion solo necesita conservar la referencia seleccionada (`slotRef`) y el contexto funcional ya elegido.
