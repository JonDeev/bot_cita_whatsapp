# Plan de implementacion: eliminar la opcion standalone de correo en actualizacion de contacto

## Contexto

Este plan implementa la spec:

- `docs/superpowers/specs/2026-07-01-remove-standalone-contact-email-option-design.md`

El objetivo es eliminar la opcion visible `Correo` del subflujo de actualizacion de contacto en WhatsApp sin romper el flujo `Ambos`.

El bug que se corrige es puntual:

- el sistema detecta un telefono invalido
- redirige correctamente a actualizacion
- pero hoy aun expone una salida standalone de solo correo
- esa salida permite continuar sin corregir el celular

La solucion debe cerrar ese bypass sin cambiar la UX general del bot ni alterar el comportamiento actual de `Ambos`.

## Objetivo

Implementar un cambio pequeno, mantenible y testeable con estas reglas:

1. la lista de actualizacion ya no muestra `Correo`
2. el paciente no puede iniciar una actualizacion standalone solo de correo
3. `Ambos` sigue funcionando exactamente igual que hoy
4. replies viejos con el id antiguo de correo no rompen la conversacion
5. no se elimina logica interna todavia necesaria para `Ambos`

## Estrategia recomendada

La forma mas segura es separar tres decisiones:

- **retirar la exposicion publica** de `Correo` en la capa conversacional
- **mantener la logica interna** de correo como etapa exclusiva de `Ambos`
- **limpiar solo la superficie visible y sus pruebas**, no el dominio completo

Esto evita dos errores comunes:

- borrar demasiado y romper `Ambos`
- dejar una opcion invisible pero todavia accesible como ruta funcional

## Guardrails de ejecucion

Estas reglas son obligatorias durante la implementacion:

1. No borrar `UPDATING_CONTACT_EMAIL`.
2. No borrar `ContactUpdateMode.EMAIL`.
3. No borrar `UpdatingContactEmailHandler`.
4. No borrar `MarkPatientEmailVerifiedUseCase`.
5. No borrar soporte de persistencia o verificacion de correo.
6. No crear una rama legacy especifica para `patient_contact_update_field:email`.
7. No mover la decision de visibilidad fuera de `PatientContactUpdateOptionsListFactory`.
8. No mover la decision de enrutamiento fuera de `SelectingContactUpdateFieldHandler`.
9. No mezclar esta correccion con podas de contexto o refactors laterales.

## Workstream 1: retirar la opcion visible del menu interactivo

### Archivos

- `src/modules/conversations/application/services/patient-contact-update-options-list.factory.ts`
- `src/modules/conversations/application/services/patient-contact-update-field-option-id.ts`

### Cambios

1. Quitar la fila `Correo` del listado interactivo.
2. Eliminar el id publico `patient_contact_update_field:email`.
3. Mantener `Telefono`, `Ambos`, `Volver`, `Menu principal` y `Finalizar`.
4. No alterar el texto general del prompt ni la estructura de navegacion.

### Resultado esperado

El paciente ya no ve una ruta standalone de correo en ninguna entrada del subflujo.

## Workstream 2: retirar el enrutamiento standalone de correo

### Archivos

- `src/modules/conversations/application/state-handlers/selecting-contact-update-field.handler.ts`
- `src/modules/conversations/application/state-handlers/selecting-contact-update-field.handler.spec.ts`

### Cambios

1. Eliminar la rama que resolvia `EMAIL` hacia `UPDATING_CONTACT_EMAIL`.
2. Mantener solo las ramas `PHONE` y `BOTH`.
3. Reusar el fallback existente para cualquier reply ya no soportado.
4. Confirmar que la respuesta por defecto vuelva a mostrar la lista nueva sin `Correo`.
5. No agregar mensajes nuevos ni tratamiento especial para replies antiguos.

### Nota tecnica

No hace falta crear una rama especial para ids legacy de correo.
El fallback actual es suficiente si se mantiene estable y controlado.
Debe ser un fallback silencioso y reutilizar la UX actual del selector.

## Workstream 3: preservar intacto el flujo `Ambos`

### Archivos

- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.ts`
- `src/modules/conversations/application/services/conversation-state-prompt.service.ts`
- `src/modules/conversations/application/services/conversation-navigation.service.ts`

### Cambios

1. No cambiar la transicion `PHONE -> EMAIL` cuando el modo es `BOTH`.
2. No cambiar mensajes de correo del paso interno de `Ambos`.
3. No cambiar las salidas de exito ni la continuidad del flujo principal.
4. Verificar que `UPDATING_CONTACT_EMAIL` siga existiendo como estado interno de soporte.

### Regla

`UPDATING_CONTACT_EMAIL` deja de ser una entrada visible standalone, pero sigue siendo una etapa interna valida del flujo combinado.

## Workstream 4: no borrar logica de correo usada por `Ambos`

### Archivos

- `src/modules/patients/application/use-cases/update-patient-contact-details.use-case.ts`
- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.ts`
- `src/modules/patients/patients.module.ts`
- `src/modules/patients/infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository.ts`

### Cambios

1. No eliminar el soporte de actualizacion real de correo.
2. No eliminar el soporte de verificacion de correo.
3. No eliminar providers ni tokens de pacientes relacionados con correo.
4. No alterar persistencia legacy que hoy usa `Ambos`.

### Motivo

Aunque `Correo` desaparezca del menu, `Ambos` sigue necesitando la etapa y la persistencia de correo.

## Workstream 5: pruebas de regresion y compatibilidad

### Archivos

- `src/modules/conversations/application/state-handlers/selecting-contact-update-field.handler.spec.ts`
- `src/modules/conversations/application/services/conversation-state-prompt.service.spec.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.spec.ts`
- `src/modules/conversations/application/use-cases/handle-incoming-conversation-message.use-case.spec.ts`
- pruebas adicionales del modulo conversations si aplican

### Cobertura minima

1. la lista ya no contiene `Correo`
2. `Telefono` sigue entrando a `UPDATING_CONTACT_PHONE`
3. `Ambos` sigue entrando a `UPDATING_CONTACT_PHONE`
4. `Ambos` sigue pasando luego a `UPDATING_CONTACT_EMAIL`
5. un reply viejo de `EMAIL` ya no abre una rama standalone, no lanza error y cae en el fallback actual
6. el caso real de telefono invalido ya no tiene bypass por correo

### Enfoque

Las pruebas deben enfocarse en preservar comportamiento y cerrar el hueco exacto, no en reescribir toda la suite.

## Workstream 6: limpieza documental

### Archivos

- `docs/superpowers/specs/2026-07-01-remove-standalone-contact-email-option-design.md`
- documentos previos solo si realmente inducen a error operativo

### Cambios

1. Mantener la nueva spec como fuente vigente de esta regla.
2. No borrar specs historicas salvo que haya una razon fuerte.
3. Si se toca documentacion anterior, debe quedar claro que `Correo` ya no es una opcion visible standalone.

## Orden recomendado de implementacion

1. actualizar la lista interactiva y los option ids visibles
2. eliminar la rama standalone de `EMAIL` en el handler de seleccion
3. ajustar pruebas unitarias directas del selector
4. verificar que `Ambos` siga intacto mediante pruebas del flujo phone -> email
5. agregar prueba de compatibilidad para replies antiguos
6. correr pruebas focalizadas del modulo de conversaciones

## Riesgos

1. Si se elimina logica de correo interna, se rompe `Ambos`.
2. Si se elimina solo la fila visual pero se deja la rama standalone activa, el flujo puede seguir siendo invocable por ids antiguos.
3. Si se podan ahora campos de contexto no criticos, el cambio deja de ser minimo y aumenta la superficie de regresion.
4. Si no se cubre el reply viejo de `EMAIL`, una respuesta atrasada de produccion puede comportarse de forma inesperada.

## No objetivos

1. No refactorizar ahora `requiresEmailUpdate`.
2. No eliminar ahora `invalidEmailAttempts`.
3. No redisenar el subflujo de confirmacion de contacto.
4. No cambiar persistencia de correo usada por `Ambos`.
5. No alterar la continuidad del flujo principal despues de contacto.

## Criterios de aceptacion

1. La lista interactiva no muestra `Correo`.
2. No existe ruta standalone visible de solo correo.
3. `Ambos` conserva su secuencia actual de telefono y luego correo.
4. Un reply viejo de correo no rompe la sesion.
5. El bug de telefono invalido sin correccion queda cerrado.
6. No hay cambios de UX fuera de la eliminacion de esa opcion puntual.
7. Las pruebas focalizadas relevantes quedan en verde.

## Definicion de listo

Este plan queda listo para implementar cuando:

1. la spec de diseno esta aprobada
2. hay acuerdo en mantener `Ambos` sin cambios funcionales
3. esta claro que se elimina solo la entrada standalone visible
4. las pruebas a tocar estan identificadas y acotadas
