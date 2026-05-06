# Flujo de mover o cancelar con cancelacion de cita

## Objetivo

Agregar el flujo 3 del menu principal para que un paciente validado pueda consultar sus citas futuras asignadas y cancelar una de ellas desde WhatsApp.

El comportamiento esperado es:

1. El paciente selecciona `Mover o cancelar` desde el menu principal.
2. El bot solicita numero de documento y fecha de nacimiento reutilizando la misma validacion del flujo 1.
3. Si la identidad es valida, el bot consulta las citas futuras con estado `Asignada` del paciente.
4. El bot muestra esas citas en una lista interactiva paginada.
5. El paciente selecciona una cita.
6. El bot muestra el detalle de esa cita con dos botones: `Reprogramar` y `Cancelar`.
7. Si el paciente presiona `Cancelar`, el sistema libera el cupo en `agenda`.
8. El bot confirma la cancelacion y ofrece `Menu principal` y `Finalizar`.

## Alcance

Incluye:

- Entrada real desde la opcion `main_menu_cancel_or_reschedule`.
- Reutilizacion de `WAITING_DOCUMENT` y `WAITING_BIRTH_DATE`.
- Enrutamiento posterior a validacion por intencion de flujo.
- Consulta de citas futuras asignadas del paciente.
- Paginacion de lista para limite de WhatsApp.
- Pantalla de detalle de cita seleccionada.
- Cancelacion real del cupo en `agenda`.
- Auditoria de consulta, seleccion y cancelacion.
- Pruebas unitarias y de flujo para la ruta de cancelacion.

No incluye:

- Implementacion real de `Reprogramar`.
- Cambios estructurales en tablas legacy.
- Cambios de handoff humano.
- Cambios al flujo de solicitar cita distintos a soportar el enrutamiento por intencion.

## Decisiones cerradas

1. La validacion de identidad debe ser exactamente la misma del flujo 1.
2. El flujo se activara desde la opcion `Mover o cancelar` del menu principal.
3. Si el paciente no tiene citas futuras asignadas, el bot debe responder:
   - `Hola {nombre_paciente} Usted no tiene citas agendadas`
   - botones `Menu principal` y `Finalizar`
4. Si hay menos de 10 citas, se muestran todas.
5. Si hay exactamente 10 citas, se muestran las 10.
6. Si hay mas de 10 citas, se muestran 9 citas y la ultima fila sera `Ver mas citas`.
7. El nombre de la especialidad para cada cita se resolvera desde `especialidad_empleados` y `tvespecialidades`.
8. No se usara `agenda.TipoCita` para nombrar la especialidad porque ese campo no guarda datos confiables para este flujo.
9. El mensaje de detalle de la cita seleccionada ira en singular.
10. En la cancelacion se actualizaran `fecha_cancelada` y `cancelada_por`.
11. No se tocaran `Fecha_cancelacion` ni `CanceldaPor`.
12. La hora exacta de cancelacion se conservara en la auditoria del bot.

## Reglas funcionales

### Regla de identidad

La identidad del paciente debe validarse con:

- numero de documento sanitizado
- fecha de nacimiento en formato `DD-MM-YYYY` en WhatsApp
- fecha ISO internamente

El flujo debe respetar:

- maximo de intentos ya existente
- no exponer si el documento existe o no
- no registrar documento completo en auditoria

### Regla de citas elegibles

Una cita podra aparecer en la lista si cumple todas estas condiciones:

- `agenda.Estado = 'Asignada'`
- `agenda.idusuario` coincide con el paciente validado
- la cita es futura considerando fecha y hora combinadas en `America/Bogota`

Si existen multiples citas, el orden debe ser:

1. `fecha_cita ASC`
2. `idhora ASC`
3. `idagenda ASC`

### Regla de especialidad mostrada

Para obtener el nombre de especialidad de cada cita:

1. se toma el medico de `agenda.idmedico`
2. se relaciona con `especialidad_empleados`
3. se resuelve el nombre con `tvespecialidades`

El diseno de implementacion debe asegurar una estrategia determinista cuando un medico tenga multiples especialidades. La implementacion recomendada es priorizar la especialidad principal si existe, y como fallback usar el menor codigo de especialidad asociado al medico para evitar duplicados no deterministas.

### Regla de seleccion de cita

Cada item de la lista debe representar una sola cita real por `idagenda`.

El item debe mostrar:

- `title`: nombre de la especialidad
- `description`: fecha y hora

Cuando el paciente seleccione una cita, el sistema debe conservar en sesion:

- `slotRef`
- nombre del paciente
- nombre de especialidad
- profesional
- fecha
- hora

### Regla de cancelacion

La cancelacion debe liberar el cupo para que otro paciente pueda agendarlo.

La actualizacion solo debe ocurrir si el registro sigue cumpliendo:

- `idagenda` coincide con la cita seleccionada
- `Estado = 'Asignada'`
- `idusuario` coincide con el paciente validado
- la cita sigue siendo futura

### Regla de actualizacion en agenda

Cuando la cancelacion sea valida, `agenda` debe quedar asi:

- `idusuario = '0000'`
- `AsignadaPor = NULL`
- `fecha_solicitud = NULL`
- `Telefono = NULL`
- `MedioSolicitud = NULL`
- `Estado = 'Sin asignar'`
- `fecha_cancelada = fecha actual del sistema`
- `motivo = 'CANCELADA POR EL PACIENTE DESDE EL BOT'`
- `cancelada_por = 'BOT'`
- `paciente_cancelada = IdUsuario del paciente`

Nota importante:

- En el schema actual `fecha_cancelada` es `DATE`, no `DATETIME`
- por eso en `agenda` se conservara solo la fecha
- la hora exacta de cancelacion debe quedar en `bot_audit_events`

## Flujo conversacional

### Caso principal

1. El paciente abre el menu principal.
2. Selecciona `Mover o cancelar`.
3. El bot pide documento.
4. El bot pide fecha de nacimiento.
5. El sistema valida identidad con el flujo existente.
6. El sistema consulta las citas futuras asignadas del paciente.
7. El bot muestra la lista interactiva de citas.
8. El paciente selecciona una cita.
9. El bot muestra el detalle con botones `Reprogramar` y `Cancelar`.
10. El paciente pulsa `Cancelar`.
11. El sistema intenta cancelar de forma atomica.
12. Si la cancelacion es exitosa, el bot responde `Su cita se cancelo correctamente`.
13. El bot muestra botones `Menu principal` y `Finalizar`.

### Caso sin citas

1. El paciente completa la validacion.
2. El sistema no encuentra citas futuras `Asignada`.
3. El bot responde:
   - `Hola {nombre_paciente} Usted no tiene citas agendadas`
4. El bot muestra botones `Menu principal` y `Finalizar`.

### Caso con mas de 10 citas

1. El sistema consulta una pagina de citas.
2. Si hay mas de 10 resultados disponibles, el bot muestra:
   - 9 citas
   - 1 fila `Ver mas citas`
3. Cuando el paciente selecciona `Ver mas citas`, el sistema carga la siguiente pagina.

### Caso de cita ya no cancelable

Si la cita cambia antes del `UPDATE` y ya no cumple las condiciones:

1. no se cancela nada
2. se registra auditoria de rechazo
3. el bot informa que la cita ya no esta disponible para cancelar
4. el sistema vuelve a consultar el listado actualizado
5. si aun existen citas elegibles, muestra la primera pagina de nuevo
6. si ya no existen citas elegibles, responde con el mensaje de `sin citas`

### Caso de `Reprogramar`

Por ahora:

1. no se modifica `agenda`
2. el bot responde con un mensaje placeholder controlado
3. el flujo permanece listo para que el paciente elija otra accion o vuelva al menu

## Arquitectura y estados

Se mantiene modular monolith + arquitectura hexagonal.

### Reutilizacion del flujo 1

Se reutilizan estos handlers existentes:

- `WAITING_DOCUMENT`
- `WAITING_BIRTH_DATE`

La diferencia estara en la intencion del flujo guardada en sesion.

### Contexto nuevo

Agregar un campo en la sesion:

- `flowIntent: 'REQUEST_APPOINTMENT' | 'CANCEL_OR_RESCHEDULE'`

Esto permite que despues de validar identidad el sistema enrute segun el flujo iniciado.

### Estados nuevos

Se agregan estos estados conversacionales:

- `SELECTING_ASSIGNED_APPOINTMENT`
- `REVIEWING_ASSIGNED_APPOINTMENT_ACTIONS`

### Enrutamiento despues de validar identidad

`PATIENT_VALIDATED` debe convertirse en un punto de enrutamiento:

- si `flowIntent = REQUEST_APPOINTMENT`, continua el flujo actual de especialidades
- si `flowIntent = CANCEL_OR_RESCHEDULE`, carga el listado de citas asignadas

## Diseno por capas

### Capa de conversacion

Responsabilidades:

- detectar la opcion del menu principal
- guardar `flowIntent`
- resolver el handler para listado de citas asignadas
- resolver el handler para detalle de cita seleccionada
- interpretar `Ver mas citas`
- interpretar `Cancelar`
- dejar `Reprogramar` como placeholder

Nuevos handlers recomendados:

- `selecting-assigned-appointment.handler.ts`
- `reviewing-assigned-appointment-actions.handler.ts`

Nuevas factories y helpers recomendados:

- `assigned-appointment-list.factory.ts`
- `assigned-appointment-details-message.factory.ts`
- `assigned-appointment-option-id.ts`
- `assigned-appointment-action-option-id.ts`

### Capa de aplicacion en appointments

Nuevos casos de uso recomendados:

- `list-future-assigned-appointments-by-patient.use-case.ts`
- `cancel-assigned-appointment-by-patient.use-case.ts`

#### `list-future-assigned-appointments-by-patient.use-case.ts`

Responsabilidades:

- validar entrada
- calcular fecha y hora actual en `America/Bogota`
- pedir la pagina de citas al repositorio
- devolver un resultado funcional con items listos para conversacion

Resultado esperado:

- `FOUND`
- `EMPTY`
- `TECHNICAL_FAILURE`

#### `cancel-assigned-appointment-by-patient.use-case.ts`

Responsabilidades:

- validar entrada minima
- intentar cancelacion atomica
- devolver un resultado funcional sin exponer SQL ni errores internos

Resultado esperado:

- `CANCELLED`
- `NOT_CANCELLABLE`
- `TECHNICAL_FAILURE`

### Capa de dominio en appointments

Nuevos puertos recomendados:

- `patient-assigned-appointment.repository.ts`
- `appointment-cancellation.repository.ts`

#### Puerto de listado

Debe exponer una operacion paginada por paciente, con lectura enfocada a:

- `idagenda`
- especialidad
- fecha
- hora
- profesional

#### Puerto de cancelacion

Debe exponer una operacion atomica que:

- reciba `slotRef`
- reciba `patientUserId`
- reciba fecha y hora actual normalizada
- haga el `UPDATE` condicional
- devuelva si la fila fue cancelada o no

### Capa de infraestructura

Adaptadores recomendados:

- `prisma-legacy-patient-assigned-appointment.repository.ts`
- `prisma-legacy-appointment-cancellation.repository.ts`

## Diseno de persistencia

### Tablas legacy involucradas

- `agenda`
- `usuarios`
- `empleados`
- `especialidad_empleados`
- `tvespecialidades`

### Consulta de listado

La consulta de listado debe:

1. filtrar solo citas futuras asignadas del paciente
2. resolver especialidad desde `especialidad_empleados` y `tvespecialidades`
3. devolver items ordenados
4. soportar paginacion por offset logico estable

La implementacion recomendada es pedir `11` registros:

- si devuelve `0`, resultado `EMPTY`
- si devuelve `1..10`, se muestran todos
- si devuelve `11`, se muestran `9` citas y la fila `Ver mas citas`

El offset debe avanzar de `9` en `9` para las paginas que usan `Ver mas citas`.

Esto simplifica el armado de la lista dentro del limite de 10 filas.

### Actualizacion atomica de cancelacion

El `UPDATE` no debe depender de una lectura previa insegura.

La estrategia correcta es:

1. ejecutar `UPDATE agenda ... WHERE ...`
2. verificar filas afectadas
3. si afecta `1`, la cancelacion fue exitosa
4. si afecta `0`, la cita ya no era cancelable

### SQL funcional esperado para cancelacion

```sql
UPDATE agenda
SET
  idusuario = '0000',
  AsignadaPor = NULL,
  fecha_solicitud = NULL,
  Telefono = NULL,
  MedioSolicitud = NULL,
  Estado = 'Sin asignar',
  fecha_cancelada = CURRENT_DATE,
  motivo = 'CANCELADA POR EL PACIENTE DESDE EL BOT',
  cancelada_por = 'BOT',
  paciente_cancelada = :patientUserId
WHERE idagenda = :slotId
  AND TRIM(COALESCE(Estado, '')) = 'Asignada'
  AND TRIM(COALESCE(idusuario, '')) = :patientUserId
  AND (
    fecha_cita > STR_TO_DATE(:currentDateIso, '%Y-%m-%d')
    OR (
      fecha_cita = STR_TO_DATE(:currentDateIso, '%Y-%m-%d')
      AND STR_TO_DATE(TRIM(COALESCE(idhora, '')), '%H:%i')
        > STR_TO_DATE(:currentTimeHHmm, '%H:%i')
    )
  );
```

## Formato de mensajes

### Lista de citas asignadas

Tipo:

- `interactive_list`

Contenido de cada item:

- `title`: nombre de especialidad
- `description`: `YYYY-MM-DD hh:mm AM/PM`

Fila de paginacion:

- `title`: `Ver mas citas`
- `description`: `Consultar mas citas asignadas`

### Mensaje de detalle de cita seleccionada

Tipo:

- `interactive_buttons`

Body:

```text
Señor(a) {nombre_paciente}, ⚠️ Usted cuenta con la siguiente cita asignada:

🩺Tipo de cita: {nombre_especialidad}
👨🏼‍⚕️Profesional: {nombre_profesional}
📅Fecha: {fecha_iso}
🕗Hora: {hora_display}
```

Botones:

- `Reprogramar`
- `Cancelar`

### Mensaje de cancelacion exitosa

Texto:

- `Su cita se cancelo correctamente`

Botones:

- `Menu principal`
- `Finalizar`

### Mensaje sin citas

Texto:

- `Hola {nombre_paciente} Usted no tiene citas agendadas`

Botones:

- `Menu principal`
- `Finalizar`

## Navegacion y sesion

### Comportamiento de `Menu principal`

Debe:

- volver a `MAIN_MENU`
- limpiar contexto del flujo actual

### Comportamiento de `Finalizar`

Debe:

- cerrar la conversacion
- no dejar acciones automaticas pendientes

### Sesion recomendada para este flujo

Agregar estructura dedicada, por ejemplo:

- pagina actual del listado
- citas mostradas en la pagina
- cita seleccionada

Esto evita recalcular mapping de ids y permite validar que el item seleccionado pertenece a la pagina ofrecida.

## Auditoria

Eventos recomendados:

- `conversation.cancel_or_reschedule.started`
- `appointment.assigned_list.requested`
- `appointment.assigned_list.resolved`
- `appointment.assigned_list.empty`
- `appointment.assigned_list.show_more.selected`
- `conversation.assigned_appointment.selected`
- `conversation.assigned_appointment.reprogramming.placeholder_shown`
- `appointment.cancellation.attempted`
- `appointment.cancellation.succeeded`
- `appointment.cancellation.rejected`
- `appointment.cancellation.failed`

Campos de auditoria recomendados:

- `conversationKey`
- `patientId`
- `slotRef`
- `pageNumber`
- `appointmentDate`
- `appointmentTime`
- `specialtyName`
- `errorMessage` cuando aplique
- `cancelledAt` con fecha y hora exacta del bot

No registrar:

- documento completo
- fecha de nacimiento completa
- datos clinicos

## Manejo de errores

### Error al listar citas

Si ocurre una falla tecnica:

1. no exponer el detalle interno
2. responder con mensaje funcional
3. ofrecer volver al menu principal
4. registrar auditoria tecnica

### Error al cancelar

Si ocurre una falla tecnica:

1. no asumir cancelacion
2. informar al paciente que no fue posible completar la operacion
3. ofrecer `Menu principal`
4. registrar auditoria tecnica

### Cita no cancelable

Si el `UPDATE` no afecta filas:

1. informar que la cita ya no esta disponible para cancelar
2. volver a consultar el listado actualizado y mostrar la primera pagina si aun hay citas
3. si no quedan citas, mostrar la salida de `sin citas`
4. registrar auditoria de rechazo funcional

## Pruebas

### Unitarias

- `list-future-assigned-appointments-by-patient.use-case.spec.ts`
- `cancel-assigned-appointment-by-patient.use-case.spec.ts`
- `prisma-legacy-patient-assigned-appointment.repository.spec.ts`
- `prisma-legacy-appointment-cancellation.repository.spec.ts`
- `selecting-assigned-appointment.handler.spec.ts`
- `reviewing-assigned-appointment-actions.handler.spec.ts`
- factories de lista y detalle

### Flujo

Escenarios minimos:

1. paciente validado con una cita y cancelacion exitosa
2. paciente validado sin citas
3. paciente con mas de 10 citas y uso de `Ver mas citas`
4. cita que deja de ser cancelable antes del `UPDATE`
5. boton `Reprogramar` mostrando placeholder

## Riesgos y mitigaciones

### Ambiguedad de especialidad por medico

Riesgo:

- un medico puede tener multiples especialidades relacionadas

Mitigacion:

- definir criterio determinista en consulta
- cubrirlo con pruebas del repositorio
- validar con datos reales antes de cerrar implementacion

### Perdida de hora en `fecha_cancelada`

Riesgo:

- la tabla legacy no conserva hora en esa columna

Mitigacion:

- guardar solo fecha en `agenda`
- guardar fecha y hora exacta en auditoria del bot

### Lista fuera de sincronizacion

Riesgo:

- una cita visible puede cambiar antes de que el paciente la seleccione o cancele

Mitigacion:

- revalidar por `idagenda` y paciente
- cancelar solo con `UPDATE` condicional
- tratar `0` filas afectadas como resultado funcional esperado

## Resultado esperado de implementacion

Al finalizar este cambio:

1. la opcion `Mover o cancelar` ya no respondera `pronto`
2. el bot reutilizara la validacion segura de identidad existente
3. el paciente podra ver sus citas futuras asignadas en una lista interactiva
4. el paciente podra seleccionar una cita y cancelarla
5. el cupo quedara libre en `agenda`
6. la trazabilidad quedara registrada en auditoria del bot
7. `Reprogramar` quedara explicitamente diferido para una fase posterior
