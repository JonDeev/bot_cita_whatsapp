# Diseno: eliminar la opcion standalone de correo en actualizacion de contacto

## Resumen

Este ajuste elimina la opcion visible `Correo` del subflujo de actualizacion de contacto en WhatsApp.

El objetivo es cerrar de forma segura el bypass detectado en produccion:

- el sistema detecta correctamente cuando el telefono actual no sirve como celular valido
- hoy aun asi el paciente puede elegir actualizar solo correo
- esa rama le permite continuar sin corregir el celular

La decision funcional es mantener el flujo `Ambos` exactamente como hoy y quitar unicamente la entrada standalone de `Correo`.

## Objetivo funcional

Cuando el paciente entre al subflujo de actualizacion de contacto, la lista interactiva solo debe ofrecer:

- `Telefono`
- `Ambos`
- `Volver`
- `Menu principal`
- `Finalizar`

Como resultado:

1. si el paciente viene desde `Actualizar y seguir`, no podra terminar el subflujo corrigiendo solo correo
2. si el sistema redirige por telefono invalido, tampoco existira la ruta de solo correo
3. si el paciente entra desde el flujo principal `Actualizar contacto`, ya no vera la opcion standalone de correo
4. si elige `Ambos`, el flujo debe seguir funcionando igual:
   - primero telefono
   - luego correo
   - luego cierre exitoso

## Alcance

Incluye:

- eliminar la opcion visible `Correo` de la lista interactiva
- eliminar el enrutamiento standalone hacia `UPDATING_CONTACT_EMAIL`
- mantener la logica interna de correo necesaria para `Ambos`
- ajustar pruebas unitarias y de flujo relacionadas con la opcion visible
- manejar de forma segura replies antiguos que apunten a la opcion ya retirada

No incluye:

- redisenar el subflujo completo de contacto
- eliminar la actualizacion de correo dentro de `Ambos`
- eliminar soporte de persistencia o verificacion de correo
- refactorizar ahora campos de contexto como `requiresEmailUpdate` o `invalidEmailAttempts`
- cambios en recordatorios, consentimientos, citas, documentos o handoff

## Problema de negocio

El bug no esta en la validacion del telefono.

El bug esta en que la compuerta de contacto detecta que el celular es invalido, pero la lista posterior sigue ofreciendo una salida standalone de correo.

Eso rompe la regla de negocio esperada:

- si el telefono no es un celular util para WhatsApp o recordatorios
- el paciente no deberia poder completar el subflujo sin corregirlo

## Decision funcional

### Decision principal

Se elimina `Correo` como opcion standalone visible en el bot.

### Decision de compatibilidad

La logica interna de actualizacion y verificacion de correo se mantiene para soportar `Ambos`.

### Decision de UX

No se cambia la experiencia general del paciente fuera de la desaparicion de una opcion puntual.

Regla:

- `Ambos` debe conservar mensajes, orden y salida funcional tal como hoy

## Principios de diseno

1. Hacer el cambio minimo que cierre el bug.
2. No mezclar correccion funcional con refactor grande.
3. No borrar logica reutilizada por `Ambos`.
4. No dejar codigo zombie expuesto al flujo visible.
5. Mantener compatibilidad defensiva con replies viejos ya emitidos en produccion.
6. Mantener una sola fuente de verdad para opciones visibles y una sola fuente de verdad para enrutamiento.

## Restricciones de implementacion

Estas reglas son obligatorias para evitar regresiones y codigo espagueti:

1. No se elimina `UPDATING_CONTACT_EMAIL`.
2. No se elimina `ContactUpdateMode.EMAIL`.
3. No se elimina `UpdatingContactEmailHandler`.
4. No se elimina `MarkPatientEmailVerifiedUseCase`.
5. No se elimina soporte de persistencia o verificacion de correo.
6. Todas esas piezas dejan de ser una entrada visible standalone, pero siguen siendo dependencias internas obligatorias del flujo `Ambos`.
7. No se permite introducir una rama legacy especial para `EMAIL`.
8. No se permite duplicar la decision de visibilidad de opciones fuera de la factory del listado.
9. No se permite duplicar la decision de enrutamiento fuera del handler selector del subflujo.

## Arquitectura propuesta

```txt
WhatsApp webhook
↓
Conversation orchestrator
↓
State handlers
↓
Use cases
↓
Repository ports
↓
Legacy adapters
```

El cambio se concentra en la capa conversacional.

La capa de pacientes solo se mantiene intacta para soportar la etapa de correo dentro de `Ambos`.

## Componentes involucrados

### 1. Lista interactiva de actualizacion

Archivo principal:

- `src/modules/conversations/application/services/patient-contact-update-options-list.factory.ts`

Responsabilidad:

- dejar de renderizar la fila `Correo`
- conservar `Telefono` y `Ambos`
- no alterar botones de navegacion

### 2. Identificadores de opciones

Archivo principal:

- `src/modules/conversations/application/services/patient-contact-update-field-option-id.ts`

Responsabilidad:

- eliminar el option id publico `EMAIL`
- mantener ids de `PHONE`, `BOTH` y navegacion

### 3. Seleccion de opcion de actualizacion

Archivo principal:

- `src/modules/conversations/application/state-handlers/selecting-contact-update-field.handler.ts`

Responsabilidad:

- resolver solo `PHONE` y `BOTH`
- eliminar la rama standalone que envia a `UPDATING_CONTACT_EMAIL`
- si llega un reply viejo de `EMAIL`, reutilizar el fallback actual y reemitir la lista nueva
- no crear una rama especial, no lanzar error y no agregar una UX nueva solo para compatibilidad

### 4. Flujo combinado telefono + correo

Archivo principal:

- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`

Responsabilidad:

- mantener sin cambios la transicion a `UPDATING_CONTACT_EMAIL` cuando el modo sea `BOTH`

### 5. Etapa interna de correo

Archivo principal:

- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`

Responsabilidad:

- seguir siendo una etapa interna del flujo `BOTH`
- no volver a quedar accesible como opcion standalone desde la lista visible

### 6. Soporte de persistencia y verificacion de correo

Archivos principales:

- `src/modules/patients/application/use-cases/update-patient-contact-details.use-case.ts`
- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.ts`
- `src/modules/patients/infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository.ts`

Responsabilidad:

- permanecer activos para la ruta `Ambos`
- no eliminarse en esta fase

## Flujo esperado

### Flujo A: redireccion por telefono invalido

1. el sistema detecta telefono invalido o no verificable
2. redirige al subflujo de actualizacion
3. la lista muestra `Telefono` y `Ambos`
4. el paciente no tiene forma de completar solo correo

### Flujo B: actualizar y seguir

1. el paciente elige actualizar
2. la lista muestra `Telefono` y `Ambos`
3. si elige `Telefono`, corrige celular y continua
4. si elige `Ambos`, corrige celular y luego correo

### Flujo C: actualizar contacto desde menu principal

1. el paciente entra por `Actualizar contacto`
2. llega a la lista de actualizacion
3. ya no existe la opcion standalone `Correo`
4. puede corregir solo telefono o telefono + correo

### Flujo D: reply antiguo de una opcion vieja

1. un paciente responde a un mensaje interactivo viejo con id `patient_contact_update_field:email`
2. el handler ya no debe aceptar esa rama standalone
3. el flujo no debe fallar
4. el sistema no debe crear una rama de compatibilidad especial
5. el sistema debe reutilizar el fallback actual del selector
6. el sistema debe responder con la lista nueva sin `Correo`
7. el sistema no debe mostrar un mensaje nuevo ni un error tecnico por ese caso

## UX y continuidad

La UX no debe cambiar salvo por la eliminacion de una opcion puntual.

Debe mantenerse:

- mensaje de confirmacion de contacto
- texto de telefono actual
- texto de correo actual
- mensajes de telefono
- etapa de correo para `Ambos`
- mensaje final de exito
- navegacion `Volver`, `Menu principal`, `Finalizar`

No debe cambiar:

- orden del flujo `Ambos`
- comportamiento de consentimiento posterior
- continuidad del flujo principal despues de completar contacto

## Estrategia de implementacion

### Enfoque recomendado

Enfoque quirurgico.

Consiste en:

- retirar solo la entrada standalone visible
- mantener la etapa interna de correo usada por `Ambos`
- no refactorizar ahora el dominio ni la persistencia
- no duplicar reglas de visibilidad o compatibilidad en multiples handlers

### Motivo

Este enfoque:

- resuelve el bug real
- reduce riesgo de regresion
- evita borrar piezas todavia utiles
- mantiene el cambio facil de revisar y testear

## Riesgos y mitigaciones

### Riesgo 1: borrar demasiada logica de correo

Impacto:

- romper `Ambos`

Mitigacion:

- no tocar `UPDATING_CONTACT_EMAIL`
- no tocar use cases de correo
- no tocar persistencia de correo

### Riesgo 2: replies viejos en produccion

Impacto:

- respuesta interactiva antigua con id de correo ya no valido

Mitigacion:

- conservar fallback seguro en el handler
- reemitir la lista nueva

### Riesgo 3: limpieza excesiva de contexto

Impacto:

- introducir cambios no necesarios en varios handlers y specs

Mitigacion:

- no podar en esta fase `requiresEmailUpdate`, `invalidEmailAttempts` ni `primaryEmail`

## Pruebas requeridas

### Unit tests

- la lista de actualizacion ya no incluye `Correo`
- seleccionar `Telefono` sigue llevando a `UPDATING_CONTACT_PHONE`
- seleccionar `Ambos` sigue llevando a `UPDATING_CONTACT_PHONE`
- un reply de `EMAIL` ya no abre la rama standalone y cae en fallback seguro

### Flow tests

- telefono invalido redirige a lista sin `Correo`
- `Ambos` sigue recorriendo telefono y luego correo
- `Actualizar contacto` ya no ofrece `Correo`
- el flujo principal de cita continua igual tras corregir telefono o `Ambos`

### Regression tests

- reproducir el caso real de produccion con telefono fijo/corto
- confirmar que ya no existe bypass por correo

## Criterios de aceptacion

1. la lista interactiva de actualizacion no muestra `Correo`
2. el bot ya no permite iniciar una actualizacion standalone solo de correo
3. `Ambos` mantiene exactamente el flujo actual
4. la validacion de telefono sigue siendo la compuerta real del subflujo
5. replies antiguos con el id viejo de correo no rompen la conversacion
6. no se elimina logica necesaria para `Ambos`
7. las pruebas relevantes del subflujo quedan actualizadas

## Archivos que deben cambiar en la implementacion

- `src/modules/conversations/application/services/patient-contact-update-options-list.factory.ts`
- `src/modules/conversations/application/services/patient-contact-update-field-option-id.ts`
- `src/modules/conversations/application/state-handlers/selecting-contact-update-field.handler.ts`
- pruebas relacionadas de conversations

## Archivos que no deben eliminarse en esta fase

- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`
- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.ts`
- `src/modules/patients/application/use-cases/update-patient-contact-details.use-case.ts`
- adaptadores legacy de persistencia de correo

## Resultado esperado

El paciente siempre quedara obligado a corregir su celular cuando el flujo de contacto lo requiera.

Al mismo tiempo:

- `Ambos` seguira funcionando correctamente
- no se introduciran cambios amplios de UX
- no se dejara codigo visible inconsistente con la regla nueva
