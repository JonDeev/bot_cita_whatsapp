# Flujo 2: Consultar citas agendadas y pendientes por asistir

## Objetivo

Implementar el flujo 2 del menu principal para que un paciente validado pueda:

1. Consultar sus citas futuras con estado `Asignada`.
2. Verlas en una lista interactiva de WhatsApp.
3. Seleccionar una cita y visualizar su detalle completo en un mensaje de botones.
4. Navegar con `Volver`, `Menu principal` o `Finalizar`.

## Alcance

Incluye:

- Activacion real de `main_menu_check_appointments`.
- Reutilizacion obligatoria de `WAITING_DOCUMENT` y `WAITING_BIRTH_DATE`.
- Enrutamiento por intencion despues de `PATIENT_VALIDATED`.
- Listado de citas futuras asignadas del paciente con paginacion actual.
- Mensaje de detalle de cita seleccionada en modo solo lectura.
- Mensaje de no disponibilidad de citas con botones de salida.
- Auditoria de consulta, seleccion y navegacion.
- Pruebas unitarias y de flujo de conversacion para el nuevo camino.

No incluye:

- Cancelacion de cita en flujo 2.
- Reprogramacion de cita en flujo 2.
- Cambios de handoff humano.
- Cambios estructurales de tablas legacy.

## Decisiones cerradas

1. El flujo 2 reutiliza exactamente la misma validacion de identidad del flujo 1 y 3.
2. Se agrega una nueva intencion conversacional: `CHECK_APPOINTMENTS`.
3. La consulta solo lista citas que cumplan:
   - `Estado = 'Asignada'`
   - `idusuario` del paciente validado
   - fecha/hora futura en `America/Bogota`
4. La lista muestra:
   - `title`: nombre de especialidad
   - `description`: fecha + hora
5. Si el paciente selecciona una cita, se muestra mensaje tipo `interactive_buttons` con detalle completo y botones:
   - `Volver`
   - `Menu principal`
   - `Finalizar`
6. Si no hay citas, se responde con mensaje tipo `interactive_buttons`:
   - `Hola {nombre_paciente} No tienes citas agendadas`
   - botones `Menu principal` y `Finalizar`
7. La modalidad mostrada en detalle sera fija: `PRESENCIAL`.
8. Se corrige redaccion de copia a `agendadas` (no `agenadadas`).

## Reglas funcionales

### Regla de entrada

1. Paciente selecciona `Consultar citas` en menu principal.
2. Bot solicita documento.
3. Bot solicita fecha de nacimiento.
4. Si identidad valida, entra al flujo de consulta.

### Regla de elegibilidad de citas

Una cita se lista solo si cumple simultaneamente:

- `agenda.Estado = 'Asignada'`
- `agenda.idusuario = IdUsuario del paciente`
- `agenda.fecha_cita > fecha actual` o misma fecha con hora mayor

Ordenamiento:

1. `fecha_cita ASC`
2. `idhora ASC`
3. `idagenda ASC`

### Regla de listado interactivo

Body:

`Hola {Nombre_Paciente} Estas son tus citas agendadas`

Boton list:

`Ver citas`

Filas:

- `title`: especialidad
- `description`: `${appointmentDateIso} ${appointmentDisplayTime}`

Si hay mas resultados que el limite de pagina actual, se conserva `Ver mas citas`.

### Regla de detalle de cita

Al seleccionar una cita se envia `interactive_buttons` con este formato:

```txt
Señor(a) ${appointment.patientFullName}, su cita agendada es:.

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

- `nav_back` -> `Volver`
- `nav_main_menu` -> `Menu principal`
- `nav_finish` -> `Finalizar`

### Regla de no citas

Si el paciente no tiene citas elegibles:

- Body: `Hola {nombre_paciente} No tienes citas agendadas`
- Botones:
  - `nav_main_menu` -> `Menu principal`
  - `nav_finish` -> `Finalizar`

## Arquitectura y estados

Se mantiene modular monolith + arquitectura hexagonal + state machine.

### Estado e intencion nueva

- `flowIntent`: agregar `CHECK_APPOINTMENTS`
- estado nuevo recomendado: `REVIEWING_ASSIGNED_APPOINTMENT_DETAILS`

### Transiciones

1. `MAIN_MENU` + `main_menu_check_appointments` -> `WAITING_DOCUMENT`
2. `WAITING_DOCUMENT` -> `WAITING_BIRTH_DATE`
3. `WAITING_BIRTH_DATE` (valida) -> `PATIENT_VALIDATED`
4. `PATIENT_VALIDATED` con `CHECK_APPOINTMENTS`:
   - con citas -> `SELECTING_ASSIGNED_APPOINTMENT`
   - sin citas -> permanece en estado de salida controlada con botones
5. `SELECTING_ASSIGNED_APPOINTMENT` (seleccion de cita) -> `REVIEWING_ASSIGNED_APPOINTMENT_DETAILS`
6. `REVIEWING_ASSIGNED_APPOINTMENT_DETAILS` + `Volver` -> `SELECTING_ASSIGNED_APPOINTMENT`

## Diseno por capas

### Capa conversaciones

Cambios:

- `main-menu.handler.ts`:
  - soportar `MAIN_MENU_OPTION_IDS.CHECK_APPOINTMENTS`.
- `conversation-session-context.entity.ts`:
  - extender `ConversationFlowIntent`.
- `patient-validated.handler.ts`:
  - nuevo branch para `CHECK_APPOINTMENTS`.
  - reutiliza `ListFutureAssignedAppointmentsByPatientUseCase`.
- `selecting-assigned-appointment.handler.ts`:
  - enrutamiento por intencion:
    - `CANCEL_OR_RESCHEDULE` -> flujo actual.
    - `CHECK_APPOINTMENTS` -> estado de detalle solo lectura.
- nuevo handler:
  - `reviewing-assigned-appointment-details.handler.ts`.
- nueva factory:
  - `assigned-appointment-consultation-details-message.factory.ts`.
- `assigned-appointment-list.factory.ts`:
  - parametrizar body segun modo (`CONSULT` o `CANCEL_RESCHEDULE`).
- `conversation-state-handler-resolver.service.ts`:
  - registrar nuevo handler.
- `conversation-state-prompt.service.ts`:
  - reconstruir prompt del nuevo estado.
- `conversation-navigation.service.ts`:
  - mapear `Volver` del nuevo estado a `SELECTING_ASSIGNED_APPOINTMENT`.

### Capa appointments

Cambios:

- `patient-assigned-appointment.repository.ts`:
  - extender candidato con `siteName` y `siteAddress`.
- `prisma-legacy-patient-assigned-appointment.repository.ts`:
  - enriquecer query con `sedes`.
- `list-future-assigned-appointments-by-patient.use-case.ts`:
  - propagar `siteName` y `siteAddress` en resultado para detalle.

## Auditoria

Registrar al menos:

- `conversation.check_appointments.started`
- `appointment.check_list.requested`
- `appointment.check_list.resolved`
- `appointment.check_list.empty`
- `appointment.check_list.failed`
- `conversation.check_appointment.selected`

Tambien mantener auditoria actual de validacion de identidad.

## Manejo de errores

1. Fallo tecnico en consulta:
   - mensaje controlado sin detalle interno.
2. Cita seleccionada ya no encontrada en contexto:
   - reconstruir lista.
3. Datos incompletos de sede/profesional:
   - aplicar defaults seguros.

## Criterios de aceptacion

1. El paciente puede entrar por `Consultar citas` y reutiliza validacion existente.
2. Solo se listan citas `Asignada` futuras del paciente.
3. La lista muestra especialidad + fecha/hora.
4. Al seleccionar una cita se muestra detalle con `Volver`, `Menu principal`, `Finalizar`.
5. Si no hay citas, se muestra mensaje con `Menu principal` y `Finalizar`.
6. No se habilita cancelar/reprogramar en flujo 2.
7. Se generan eventos de auditoria de consulta y seleccion.
8. Las pruebas relevantes quedan en verde.

## Plan de implementacion sugerido

### Fase 1

- Activar entrada de menu + intencion `CHECK_APPOINTMENTS`.
- Branch en `PATIENT_VALIDATED`.
- Lista con body de consulta y no-citas con botones.

### Fase 2

- Estado y handler de detalle solo lectura.
- Mensaje detalle con 3 botones.
- Navegacion `Volver`.

### Fase 3

- Enriquecimiento de datos de sede/direccion en query y use case.
- Cobertura de pruebas unitarias y de flujo.

