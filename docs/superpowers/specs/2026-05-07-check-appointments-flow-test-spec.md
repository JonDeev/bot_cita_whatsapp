# Flujo 2: Spec de pruebas y validacion

## Objetivo

Definir los casos de prueba minimos y de regresion para implementar `Consultar citas` sin afectar flujos existentes.

## Cobertura objetivo

1. Entrada por menu principal.
2. Reutilizacion de validacion de identidad.
3. Listado de citas elegibles.
4. Seleccion de cita y detalle con botones de navegacion.
5. Caso sin citas.
6. Navegacion `Volver`, `Menu principal`, `Finalizar`.
7. No regresion de flujo 3 (cancelar/reprogramar).

## Matriz de pruebas unitarias

### A. Conversacion - menu e intencion

Archivo:

- `src/modules/conversations/application/state-handlers/main-menu.handler.spec.ts`

Casos:

1. Seleccion `main_menu_check_appointments` mueve a `WAITING_DOCUMENT`.
2. Contexto guarda `flowIntent = CHECK_APPOINTMENTS`.
3. Mensaje pide documento.

### B. Conversacion - enrutamiento post validacion

Archivo:

- `src/modules/conversations/application/state-handlers/patient-validated.handler.spec.ts`

Casos:

1. `flowIntent = CHECK_APPOINTMENTS` + resultado `FOUND`:
   - `nextState = SELECTING_ASSIGNED_APPOINTMENT`
   - mensaje `interactive_list` con saludo de consulta
2. `flowIntent = CHECK_APPOINTMENTS` + resultado `EMPTY`:
   - mensaje `interactive_buttons`
   - botones `Menu principal` y `Finalizar`
3. `flowIntent = CHECK_APPOINTMENTS` + resultado tecnico:
   - mensaje de error controlado.

### C. Conversacion - seleccion de cita

Archivo:

- `src/modules/conversations/application/state-handlers/selecting-assigned-appointment.handler.spec.ts`

Casos:

1. En intencion `CHECK_APPOINTMENTS`, seleccionar item:
   - mueve a `REVIEWING_ASSIGNED_APPOINTMENT_DETAILS`
   - envia detalle tipo `interactive_buttons` con `Volver/Menu principal/Finalizar`
2. `show_more` en consulta:
   - recarga pagina y conserva modo consulta.
3. `show_more` que termina en `EMPTY`:
   - mensaje de no citas con botones.

### D. Conversacion - detalle solo lectura

Archivo nuevo:

- `src/modules/conversations/application/state-handlers/reviewing-assigned-appointment-details.handler.spec.ts`

Casos:

1. Con cita seleccionada, si llega texto libre:
   - reconstruye mismo mensaje detalle.
2. Sin cita seleccionada:
   - retorna a listado.

### E. Navegacion

Archivos:

- `src/modules/conversations/application/services/conversation-navigation.service.spec.ts`
- `src/modules/conversations/application/use-cases/handle-incoming-conversation-message.use-case.spec.ts`

Casos:

1. `nav_back` desde `REVIEWING_ASSIGNED_APPOINTMENT_DETAILS` vuelve a `SELECTING_ASSIGNED_APPOINTMENT`.
2. `nav_main_menu` limpia contexto.
3. `nav_finish` cierra sesion.

### F. Appointments - consulta de citas

Archivos:

- `src/modules/appointments/application/use-cases/list-future-assigned-appointments-by-patient.use-case.spec.ts`
- `src/modules/appointments/infrastructure/persistence/mysql/prisma-legacy-patient-assigned-appointment.repository.spec.ts`

Casos:

1. Se mapean `siteName` y `siteAddress` cuando existen.
2. Se aplican defaults cuando faltan.
3. Se conserva filtro por:
   - estado asignada
   - paciente correcto
   - fecha/hora futura
4. Se conserva paginacion de 9 + `Ver mas citas` cuando aplica.

## Pruebas de regresion obligatoria

1. Flujo 1 (`Solicitar cita`) no cambia comportamiento.
2. Flujo 3 (`Cancelar o reprogramar`) mantiene:
   - botones `Reprogramar` y `Cancelar`
   - estados existentes
3. Validacion documento/fecha mantiene:
   - formato
   - intentos maximos
4. Navegacion global conserva semantica actual.

## Datos de prueba recomendados

1. Paciente con 0 citas futuras asignadas.
2. Paciente con 1 cita futura asignada.
3. Paciente con >10 citas futuras asignadas (para paginacion).
4. Cita con sede/direccion presentes.
5. Cita con sede/direccion vacios (fallback).

## Criterio de pase

La implementacion puede pasar a QA solo si:

1. Todos los tests nuevos pasan.
2. No falla ninguna prueba de regresion de conversaciones y appointments.
3. El flujo 2 cumple exactitud de mensajes y botones definidos en la spec funcional.

## Comandos sugeridos al ejecutar

1. `pnpm test -- main-menu.handler`
2. `pnpm test -- patient-validated.handler`
3. `pnpm test -- selecting-assigned-appointment.handler`
4. `pnpm test -- reviewing-assigned-appointment-details.handler`
5. `pnpm test -- list-future-assigned-appointments-by-patient`
6. `pnpm test -- prisma-legacy-patient-assigned-appointment.repository`
7. `pnpm test -- handle-incoming-conversation-message`

