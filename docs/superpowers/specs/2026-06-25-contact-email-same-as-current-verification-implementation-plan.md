# Plan de implementacion: correo igual al actual como verificacion sin reescritura

## Contexto

Este plan implementa la spec:

- `docs/superpowers/specs/2026-06-25-contact-email-same-as-current-verification-design.md`

El objetivo es resolver un punto muy especifico del flujo de actualizacion de contacto: cuando el paciente escribe un correo valido que ya existe en la BD, el sistema debe continuar como verificacion exitosa, actualizar `correo_verificado_en` y no intentar guardar el mismo correo otra vez.

La solucion debe evitar efectos colaterales en otros flujos. No se cambia el menu interactivo ni la estructura general del orquestador.

## Objetivo

Implementar un comportamiento mantenible y testeable con estas reglas:

1. correo valido igual al actual implica verificacion exitosa
2. no se persiste el mismo correo como update
3. `correo_verificado_en` se actualiza
4. la conversacion sigue sin bloqueo
5. el resto de flujos permanece intacto

## Estrategia recomendada

La forma mas segura es separar tres responsabilidades:

- **routear el caso** en el handler de conversacion
- **actualizar correo** cuando el valor es distinto
- **verificar correo** cuando el valor es valido y coincide con el actual

Esto evita que un mismo use case tenga que inventar reglas ambiguas y permite testear cada comportamiento por separado.
En el subflujo `BOTH`, el handler puede cerrar la actualizacion de telefono pendiente y la verificacion de correo dentro de la misma salida exitosa, sin exponer el caso como error.

## Workstream 1: decision de flujo en conversaciones

### Archivos

- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.spec.ts`

### Cambios

1. Detectar el caso `SAME_EMAIL` como ruta valida, no como error.
2. En ese caso, evitar la salida de error genérica.
3. Redirigir la ejecucion hacia el caso de uso dedicado de verificacion.
4. Mantener intacto el manejo de `INVALID_EMAIL`, `MISSING_EMAIL` y fallas tecnicas.
5. Reusar la salida de exito ya existente para no cambiar la UX mas de lo necesario.

### Nota tecnica

El handler no debe contener logica compleja de persistencia. Solo debe decidir si el input representa una actualizacion real o una verificacion sin cambio.

## Workstream 2: caso de uso de verificacion de correo

### Archivos

- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.ts`
- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.spec.ts`
- `src/modules/patients/domain/ports/mark-patient-email-verified.repository.ts`
- `src/modules/patients/patients.module.ts`
- `src/modules/patients/domain/patients.tokens.ts`

### Cambios

1. Crear un use case dedicado para marcar `correo_verificado_en`.
2. Validar `patientId`, correo normalizado y coincidencia con el correo actual.
3. Rechazar entradas vacias o invalidas.
4. No permitir que este use case cambie el correo principal.
5. Retornar un resultado claro para la capa de conversacion.
6. Registrar el nuevo provider y su token en el modulo de pacientes.
7. Consumir un puerto dedicado que apunte al mismo adapter MariaDB legacy existente.

### Beneficio

La logica queda explicita: si el correo no cambia, no se hace una escritura de datos maestros, solo una verificacion.

## Workstream 3: extension del repositorio legacy

### Archivos

- `src/modules/patients/infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository.ts`
- `src/modules/patients/infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository.spec.ts`

### Cambios

1. Agregar la escritura de `correo_verificado_en` para el caso de verificacion.
2. Mantener la whitelist de columnas.
3. Conservar el comportamiento actual de actualizacion de correo para los casos donde el correo si cambia.
4. No tocar el flujo de telefono.
5. No mezclar esta escritura con cambios de otros datos sensibles.
6. Mantener la implementacion compartida dentro del mismo adapter para no duplicar infraestructura.

### Nota tecnica

Si la implementacion actual ya tiene un adaptador compartido para actualizacion de contacto, la extension debe respetar ese limite y evitar SQL duplicado o condiciones ramificadas innecesarias.

## Workstream 4: auditoria y mensajes

### Archivos

- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`
- `src/modules/audit/application/services/audit.service.ts` si el contrato requiere un evento nuevo

### Cambios

1. Registrar el caso `SAME_EMAIL` como verificacion exitosa.
2. Registrar el update real y la falla real por separado.
3. No mostrar correo completo en logs o auditoria.
4. Mantener textos cortos y no tecnicos en los mensajes al paciente.

### Regla

La auditoria debe explicar la decision funcional, no exponer datos sensibles ni ruido operacional.

## Workstream 5: pruebas

### Archivos

- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.spec.ts`
- `src/modules/patients/application/use-cases/update-patient-contact-details.use-case.spec.ts`
- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.spec.ts`
- `src/modules/patients/infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository.spec.ts`

### Cobertura minima

1. correo igual al actual y valido continua sin error
2. correo igual al actual no dispara reescritura del correo principal
3. correo igual al actual actualiza `correo_verificado_en`
4. correo distinto sigue actualizando como hoy
5. correo invalido sigue bloqueandose como hoy
6. el flujo principal de `Actualizar contacto` usa el mismo comportamiento

### Enfoque

Las pruebas deben ser pequenas y enfocadas en el caso nuevo. No hace falta una bateria grande; hace falta una bateria que impida regresar al comportamiento anterior.

## Orden recomendado de implementacion

1. definir el caso de uso de verificacion de correo
2. extender el contrato del repositorio para soportar la escritura de `correo_verificado_en`
3. adaptar `UpdatingContactEmailHandler` para enrutar `SAME_EMAIL` al use case dedicado
4. mantener `UpdatePatientContactDetailsUseCase` solo para cambios reales de correo
5. actualizar la auditoria
6. cubrir el caso con pruebas unitarias
7. revisar que `Actualizar contacto` y el flujo comun se comporten igual

## Riesgos

1. Si se toca solo el handler y no el use case dedicado, la logica quedara inconsistente.
2. Si se modifica la persistencia sin separar intencion, el cambio quedara dificil de mantener.
3. Si se expone la nueva semantica en la UI, la experiencia puede volverse confusa.
4. Si no se registra el nuevo provider en el modulo, el flujo quedara desconectado.

## No objetivos

1. No agregar nuevas opciones al menu interactivo.
2. No cambiar otros flujos de conversaciones.
3. No modificar telefono.
4. No introducir frontend nuevo.
5. No reescribir el orquestador completo.

## Criterios de aceptacion

1. Un correo valido igual al actual continua sin mostrar error.
2. El mismo correo no se vuelve a guardar.
3. `correo_verificado_en` se actualiza.
4. El cambio funciona tanto en `Actualizar contacto` como en el subflujo compartido.
5. Ningun otro flujo se ve afectado.
6. Las pruebas cubren el caso nuevo.
7. `UpdatePatientContactDetailsUseCase` sigue siendo el camino para cambios reales de correo y no absorbe el caso `SAME_EMAIL`.

## Definicion de listo

El plan queda listo para implementar cuando:

1. la spec de diseño esta aprobada
2. existe consenso sobre separar verificacion de actualizacion
3. el contrato de persistencia para `correo_verificado_en` esta claro
4. las pruebas proponen el comportamiento exacto que queremos preservar
