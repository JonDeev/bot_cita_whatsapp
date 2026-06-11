# Plan de implementacion: confirmacion operativa del numero oficial para consentimiento WhatsApp

## Contexto

Este plan operacionaliza la politica definida en:

- `docs/superpowers/specs/2026-06-11-whatsapp-consent-number-confirmation-policy-design.md`

El objetivo es corregir la persistencia del consentimiento de WhatsApp para que siempre quede asociada al numero oficial vigente del paciente, sin usar `participantPhone` como fallback y sin extender la vida util de `contactVerification` mas alla de lo necesario.

La base actual ya tiene piezas utiles:

- `PatientValidatedHandler` ya activa la confirmacion de contacto cuando corresponde.
- `ContactUpdateCompletionService` ya reevalua el gate de consentimiento despues de actualizar contacto.
- `RequestingWhatsappAppointmentNotificationsOptInHandler` ya centraliza el registro del consentimiento post-reserva.
- `ConsentPhoneResolverService` ya existe como punto de resolucion, pero aun debe alinearse con la politica cerrada.

## Objetivo

Entregar una implementacion segura y mantenible que cumpla estas reglas:

1. el consentimiento solo se guarda con el numero oficial vigente del paciente
2. `participantPhone` solo sirve para detectar mismatch, nunca para persistir consentimiento
3. el flujo de actualizacion de contacto debe producir un snapshot estable del numero oficial antes de limpiar `contactVerification`
4. si ese snapshot no existe, la persistencia del consentimiento debe detenerse de forma controlada
5. recordatorios y encuestas no cambian en esta fase

## No objetivos

1. No modificar la logica de recordatorios.
2. No modificar la logica de encuestas.
3. No introducir OTP, SMS ni verificacion criptografica.
4. No crear nuevas dependencias externas.
5. No tocar UI nueva.
6. No abrir una refactorizacion mas amplia de conversaciones fuera de este problema.

## Estrategia de entrega

1. Primero se estabiliza la fuente del telefono de consentimiento.
2. Luego se ajusta el encadenamiento del flujo para que el snapshot sobreviva al cierre de `contactVerification`.
3. Despues se endurece la persistencia y la auditoria.
4. Por ultimo se amplian las pruebas unitarias y de flujo para cubrir regresiones.

La secuencia importa: si se ajusta solo el handler de consentimiento sin fijar el snapshot, el bug volvera a aparecer cuando `contactVerification` se limpie antes del opt-in.

## Decision tecnica principal

La solucion recomendada es introducir un snapshot transitorio y dedicado del telefono de consentimiento en el contexto de conversacion, por ejemplo `appointmentNotificationsConsentPhone`.

Ese campo debe:

1. poblarse con el numero oficial confirmado por el flujo
2. persistirse solo mientras dure el tramo post-reserva que necesita el opt-in
3. limpiarse cuando el consentimiento ya se registro o cuando el flujo sale de esa rama
4. no reemplazar a `usuarios.Telefono` como fuente de verdad

Esto evita reutilizar `contactVerification` como contenedor de una responsabilidad que no le corresponde.

## Workstream 1: snapshot estable del telefono

### Archivos

- `src/modules/conversations/domain/entities/conversation-session-context.entity.ts`
- `src/modules/conversations/application/state-handlers/selecting-appointment-time.handler.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.ts`

### Cambios

1. Agregar un campo opcional de contexto para guardar el telefono oficial que se usara para el consentimiento post-reserva.
2. Al cerrar la asignacion de cita, conservar ese snapshot antes de limpiar `contactVerification`.
3. En el cierre del flujo de actualizacion de contacto, conservar el snapshot solo si el siguiente paso es pedir opt-in.
4. Mantener el contexto existente compatible hacia atras para no romper sesiones ya serializadas.

### Criterio tecnico

Si el usuario responde el opt-in despues de que `contactVerification` ya fue limpiado, el handler aun debe poder leer el telefono oficial desde el snapshot transitorio.

## Workstream 2: resolucion de telefono de consentimiento

### Archivos

- `src/modules/conversations/application/services/consent-phone-resolver.service.ts`
- `src/modules/conversations/application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler.ts`
- `src/modules/conversations/conversations.module.ts`

### Cambios

1. El resolver debe dejar de usar `participantPhone` como fallback.
2. El resolver debe aceptar solo el telefono oficial snapshot o, en su defecto, devolver `NONE`.
3. El handler de opt-in debe persistir el consentimiento solo cuando el resolver entregue un telefono valido.
4. Si el telefono no existe, el handler debe registrar auditoria, devolver un mensaje controlado y no intentar salvar el consentimiento con otro numero.
5. La inyeccion en el modulo debe quedar explicita y simple, sin crear dependencias circulares.

### Regla clave

`participantPhone` permanece como insumo de mismatch y trazabilidad, pero nunca como fuente de persistencia.

## Workstream 3: alineacion con el gate de consentimiento

### Archivos

- `src/modules/patients/application/use-cases/resolve-whatsapp-appointment-notifications-opt-in-gate.use-case.ts`
- `src/modules/patients/application/use-cases/register-whatsapp-post-booking-consent.use-case.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`

### Cambios

1. Mantener el gate estricto y sin relajarlo.
2. No convertir el use case de registro de consentimiento en un sitio donde se “adivina” el telefono correcto.
3. Cuando la actualizacion de contacto requiera opt-in, el telefono oficial ya debe venir resuelto desde el snapshot.
4. Si la persistencia de contacto falla, el flujo debe detenerse o redirigir a una salida controlada.
5. Si la actualizacion termina bien, el flujo puede volver a `PATIENT_VALIDATED` o pedir opt-in segun el gate, pero siempre con el mismo numero oficial.

### Regla clave

La capa de dominio sigue siendo estricta. La correccion debe ocurrir antes de llegar al caso de uso de registro, no dentro de el.

## Workstream 4: auditoria y observabilidad minima

### Archivos

- `src/modules/conversations/application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`
- `src/modules/audit/application/services/audit.service.ts` si ya existe el evento o el contrato necesita ajustarse

### Cambios

1. Registrar la fuente del telefono usado para persistir el consentimiento.
2. Registrar cuando no existe telefono oficial disponible para el opt-in.
3. Registrar cuando el flujo llega al opt-in sin el snapshot esperado.
4. Mantener los nombres de eventos consistentes y faciles de buscar.
5. No exponer telefono completo en logs si ya existe una politica de masking en la capa de auditoria.

### Regla clave

La auditoria debe explicar por que se guardo o por que no se pudo guardar el consentimiento, sin filtrar datos sensibles.

## Workstream 5: pruebas de regresion

### Archivos

- `src/modules/conversations/application/services/consent-phone-resolver.service.spec.ts`
- `src/modules/conversations/application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler.spec.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.spec.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.spec.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.spec.ts`
- `src/modules/conversations/application/state-handlers/selecting-appointment-time.handler.spec.ts`

### Cobertura minima

1. el consentimiento se registra con el snapshot oficial
2. el handler no usa `participantPhone` como fallback
3. si el snapshot no existe, el consentimiento no se persiste
4. al salir del flujo de reserva, el snapshot queda disponible aunque `contactVerification` se limpie
5. el flujo de actualizacion conserva el numero correcto para el opt-in posterior
6. el mensaje de salida controlado se mantiene cuando el guardado no es posible

### Enfoque

Las pruebas deben cubrir el caso feliz y la regresion principal. No se necesita una bateria enorme; se necesita una bateria que bloquee el reingreso del bug.

## Orden recomendado de implementacion

1. actualizar `ConversationSessionContext` con el snapshot de consentimiento
2. ajustar el cierre del flujo de reserva para poblar ese snapshot
3. cambiar el resolver para no usar `participantPhone`
4. adaptar el handler de opt-in para leer solo la fuente oficial
5. reforzar `ContactUpdateCompletionService` para que preserve el snapshot cuando corresponda
6. revisar `selecting-appointment-time.handler.ts` para que no borre la unica copia util antes de tiempo
7. ampliar pruebas unitarias y de flujo
8. revisar el modulo Nest para mantener la inyeccion limpia

## Riesgos

1. Si se conserva el fallback a `participantPhone`, el bug original puede reaparecer.
2. Si se guarda el snapshot dentro de `contactVerification` y luego se limpia demasiado pronto, la persistencia seguira fallando.
3. Si se relaja el use case de registro, se pierde la proteccion de dominio.
4. Si se toca recordatorios o encuestas en este mismo cambio, se abre una regresion innecesaria.

## Criterios de aceptacion

1. El consentimiento post-reserva se registra solo con el telefono oficial vigente.
2. `participantPhone` no se usa para persistir consentimiento.
3. La limpieza de `contactVerification` no rompe el guardado del opt-in.
4. El flujo de actualizacion de contacto sigue pudiendo pedir consentimiento cuando el gate lo requiera.
5. Recordatorios y encuestas quedan sin cambios.
6. Las pruebas relevantes cubren el caso feliz y la regresion principal.

## Definicion de listo

Este plan queda listo para implementar cuando:

1. el equipo entienda donde vive la fuente estable del telefono de consentimiento
2. el snapshot transitorio quede definido y acotado
3. el handler de consentimiento deje de depender de `participantPhone`
4. no exista ambiguedad sobre recordatorios o encuestas
5. las pruebas nuevas cubran la regresion que origino el problema
