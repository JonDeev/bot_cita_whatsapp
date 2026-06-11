# Plan de implementacion: continuidad del flujo principal despues de contacto y consentimiento

## Contexto

Este plan corrige la continuidad del flujo conversacional cuando el paciente pasa por el subflujo de actualizacion de contacto y, si corresponde, por el consentimiento de WhatsApp.

El comportamiento esperado no depende de un caso puntual como `Solicitar cita`. Depende del `flowIntent` original de la sesion y debe reanudar el flujo principal correcto sin obligar al usuario a enviar un mensaje adicional.

## Antecedentes

La idea de que `PATIENT_VALIDATED` actua como punto de enrutamiento ya estaba documentada en:

- `docs/superpowers/specs/2026-05-21-patient-contact-confirmation-and-update-design.md`
- `docs/superpowers/specs/2026-05-06-cancel-or-reschedule-cancellation-flow-design.md`

El problema actual no es la existencia del enrutamiento, sino que algunos handlers del subflujo devuelven mensajes finales y dejan la sesion estacionada antes de que el flujo principal pueda continuar.

## Objetivo

Hacer que, despues de:

1. validar identidad,
2. actualizar telefono o correo,
3. registrar consentimiento si aplica,

el sistema retome automaticamente el flujo principal correcto segun `flowIntent`.

## No objetivos

1. No modificar el orquestador global para que ignore mensajes de salida.
2. No introducir hardcodes como `Solicitar cita` dentro del subflujo.
3. No duplicar la logica de reanudacion en varios handlers.
4. No cambiar la logica de recordatorios, encuestas o handoff.
5. No introducir AI ni nuevas dependencias externas.

## Regla de negocio

El subflujo de contacto es temporal. Al terminar, debe devolver control al flujo principal segun el contexto original:

- `REQUEST_APPOINTMENT` -> continuar en especialidades
- `CHECK_APPOINTMENTS` -> continuar en citas asignadas
- `CANCEL_OR_RESCHEDULE` -> continuar en citas asignadas
- `CHECK_DISPENSARY` -> continuar en dispensario
- `UPDATE_CONTACT` -> cerrar de forma controlada, porque ese es el flujo principal

## Principios de diseno

1. La continuidad debe resolverse en una sola pieza de aplicacion.
2. Los handlers deben hacer una sola cosa y delegar la reanudacion.
3. `PATIENT_VALIDATED` debe seguir siendo un punto tecnico de enrutamiento, no un final de flujo.
4. Los mensajes de confirmacion no deben bloquear la reanudacion del flujo principal.
5. El codigo debe permanecer predecible y testable, sin cadenas de condiciones repartidas por varios archivos.

## Propuesta tecnica

La solucion recomendada es introducir un resolver de continuidad del flujo principal, por ejemplo `PrimaryFlowContinuationResolver`.

Ese resolver recibira:

- la sesion actual
- el `flowIntent`
- el contexto de validacion y contacto

Y devolveria:

- el siguiente estado real del flujo principal
- el contexto que debe preservarse
- la necesidad de emitir mensajes complementarios

## Responsabilidades por componente

### `ContactUpdateCompletionService`

Debe quedarse con la responsabilidad de cerrar el subflujo de actualizacion de contacto.

Debe:

- decidir si requiere opt-in
- preparar el contexto de contacto validado
- conservar la informacion necesaria para continuar
- delegar la reanudacion al resolver de flujo principal cuando no haya opt-in pendiente

No debe:

- decidir por si mismo a que flujo de negocio se va despues
- hardcodear destinos por tipo de cita o servicio
- emitir una salida final que deje la sesion bloqueada en un estado transitorio

### `RequestingWhatsappAppointmentNotificationsOptInHandler`

Debe registrar el consentimiento y luego reanudar el flujo principal correcto.

Debe:

- persistir el consentimiento con la fuente correcta
- registrar auditoria del opt-in
- mantener el contexto valido
- delegar la continuidad al resolver central

No debe:

- dejar la sesion estacionada en `PATIENT_VALIDATED` como destino final visible
- asumir que el siguiente paso siempre es el mismo

### `PatientValidatedHandler`

Debe seguir siendo el router principal.

Debe:

- respetar `flowIntent`
- resolver el siguiente paso de negocio
- mantener la logica de especialidades, citas asignadas y dispensario separada

No debe:

- contener la logica de reanudacion del subflujo de contacto
- duplicar reglas de consentimiento

## Orden recomendado de implementacion

1. Crear el resolver de continuidad con una API pura y pequena.
2. Integrar ese resolver en `ContactUpdateCompletionService`.
3. Integrar ese resolver en `RequestingWhatsappAppointmentNotificationsOptInHandler`.
4. Alinear `UpdatingContactPhoneHandler` y `UpdatingContactEmailHandler` para que usen la misma semantica de continuacion.
5. Revisar `PatientValidatedHandler` para que siga siendo el punto de ruteo principal sin mezclar responsabilidades.
6. Añadir pruebas de flujo que cubran la reanudacion por `flowIntent`.

## Archivos potencialmente afectados

- `src/modules/conversations/application/services/primary-flow-continuation-resolver.service.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.ts`
- `src/modules/conversations/application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`
- `src/modules/conversations/application/state-handlers/patient-validated.handler.ts`
- `src/modules/conversations/domain/entities/conversation-session-context.entity.ts`

## Flujo esperado

### Caso `REQUEST_APPOINTMENT`

1. El paciente valida identidad.
2. Se confirma o actualiza contacto.
3. Si hace falta consentimiento, se registra.
4. El sistema reanuda en la seleccion de especialidad.

### Caso `CHECK_APPOINTMENTS`

1. El paciente valida identidad.
2. Se confirma o actualiza contacto.
3. Si hace falta consentimiento, se registra.
4. El sistema reanuda en el listado de citas asignadas.

### Caso `CANCEL_OR_RESCHEDULE`

1. El paciente valida identidad.
2. Se confirma o actualiza contacto.
3. Si hace falta consentimiento, se registra.
4. El sistema reanuda en el listado de citas asignadas.

### Caso `CHECK_DISPENSARY`

1. El paciente valida identidad.
2. Se confirma o actualiza contacto.
3. Si hace falta consentimiento, se registra.
4. El sistema reanuda en la ruta de dispensario.

### Caso `UPDATE_CONTACT`

1. El paciente entra a actualizar datos como flujo principal.
2. Se confirma o actualiza contacto.
3. Se cierra la conversacion o se vuelve al menu principal segun la regla actual.

## Criterios de aceptacion

1. El mensaje de consentimiento puede mostrarse.
2. Despues de ese mensaje, el sistema retoma el flujo principal correcto.
3. La continuidad depende de `flowIntent`, no de un caso puntual.
4. No quedan sesiones trabadas en `PATIENT_VALIDATED` esperando otro mensaje del usuario.
5. No se rompe `UPDATE_CONTACT`.
6. No se introduce logica espagueti en handlers.

## Riesgos

1. Si se deja un mensaje final en un estado puente, el orquestador corta la continuidad.
2. Si el resolver de continuidad se duplica en varios archivos, la regresion volvera a aparecer.
3. Si se mezcla la responsabilidad del mensaje de exito con la del siguiente estado, el flujo se vuelve dificil de mantener.

## Definicion de listo

Este plan queda listo para implementar cuando:

1. el equipo valida que el `flowIntent` sigue siendo la fuente de verdad
2. se confirma que `PATIENT_VALIDATED` solo enruta y no finaliza el flujo
3. el resolver central queda acotado y predecible
4. las pruebas de flujo cubren la reanudacion correcta por contexto
