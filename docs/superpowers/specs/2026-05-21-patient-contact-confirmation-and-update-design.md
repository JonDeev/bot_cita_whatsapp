# Diseno: confirmacion y actualizacion de contacto post-validacion y flujo autonomo de actualizar contacto

## Resumen

Se agregara un subflujo reutilizable inmediatamente despues de validar identidad con `documento + fecha de nacimiento`.

Este subflujo tendra dos usos:

1. Como compuerta previa antes de continuar con los flujos de:
   - Solicitar cita
   - Consultar citas
   - Cancelar/Reprogramar
   - Mi dispensario

2. Como flujo principal de la opcion del menu:
   - Actualizar contacto

El objetivo es confirmar que el paciente correcto es quien esta interactuando y depurar datos de contacto en la tabla legacy `usuarios`, sin duplicar logica entre flujos y manteniendo arquitectura hexagonal, tipado fuerte, auditoria y manejo controlado de errores.

## Objetivo funcional

Despues de validar identidad, el bot debe mostrar un mensaje interactivo de confirmacion de contacto con nombre, telefono y correo actual del paciente.

El paciente podra:

1. Continuar si sus datos estan correctos.
2. Actualizar telefono, correo o ambos antes de continuar.
3. Terminar el proceso.

La misma logica tambien debe atender la opcion de menu `Actualizar contacto`, donde el flujo termina despues de validar identidad y completar la confirmacion o actualizacion.

## Alcance

Incluye:

- Reutilizacion de `WAITING_DOCUMENT` y `WAITING_BIRTH_DATE`.
- Nuevo subflujo comun de confirmacion/actualizacion de contacto.
- Integracion con los flujos ya existentes que dependen de paciente validado.
- Activacion real de `main_menu_update_contact`.
- Lectura de nombre, telefono y correo desde `usuarios`.
- Escritura controlada sobre campos permitidos de `usuarios`.
- Validacion fuerte de celular colombiano y correo.
- Auditoria de interacciones y cambios.
- Manejo de errores sin exponer detalles internos.
- Cobertura de pruebas unitarias y de flujo.

No incluye:

- Cambios en handoff humano.
- Nuevas tablas en legacy.
- Cambios en FAQ o IA.
- Cambios en otras columnas de `usuarios` distintas a las definidas en este spec.

## Decisiones cerradas

1. El subflujo se ejecuta una sola vez por ingreso a servicio, justo despues de identidad valida.
2. `PATIENT_VALIDATED` seguira siendo el punto central de enrutamiento.
3. La opcion `Actualizar contacto` reutiliza exactamente este mismo subflujo.
4. Telefono y correo se mostraran completos en el mensaje de confirmacion.
5. Si telefono o correo llegan vacios o invalidos, no se permitira continuar sin corregirlos.
6. Si el paciente pulsa `Continuar` sin editar, no se modificara `usuarios.confirmacion_telefono`.
7. Si el paciente actualiza un dato y la validacion es correcta, el bot continuara de inmediato:
   - hacia el flujo principal si viene de otro servicio
   - hacia mensaje de exito + menu principal si viene de `Actualizar contacto`
8. La escritura en `usuarios` se hara con adaptador dedicado, credencial separada y whitelist estricta de columnas.
9. No se reutilizara el `PrismaService` legacy read-only actual para estas escrituras.
10. No se deben registrar telefono o correo completos en logs o auditoria.

## Mensaje de confirmacion

### Formato

Mensaje interactivo tipo botones:

```txt
Hola {Nombre_usuario}. Por favor verifica que tus datos de contacto esten correctos. Los usamos para enviarte los recordatorios de tu cita a tiempo. ✅

📱Telefono: {usuario.Telefono}
📧Correo electronico: {usuario.email}

¿La informacion es correcta? ❓
```

Botones:

1. `Continuar`
2. `Actualizar y continuar`
3. `Terminar proceso`

### Reglas

- Si ambos datos son validos y el paciente pulsa `Continuar`, el flujo marca la verificacion como completada.
- Si alguno esta vacio o invalido y pulsa `Continuar`, no puede avanzar; se le informa que debe actualizar sus datos y se redirige a la lista de actualizacion.
- `Terminar proceso` cierra la conversacion de la misma forma controlada que `Finalizar`.

## Lista de actualizacion

Cuando el paciente elija `Actualizar y continuar`, el bot mostrara un mensaje interactivo tipo lista con estas opciones:

- `Telefono`
- `Correo`
- `Ambos`
- `Volver`
- `Menu principal`
- `Finalizar`

### Reglas

- `Volver` regresa al mensaje de confirmacion.
- `Menu principal` limpia el contexto transitorio de este subflujo y vuelve al menu principal.
- `Finalizar` cierra la conversacion.

## Validaciones de datos

### Telefono

Se permitira modificar solo el telefono celular principal del paciente.

Regla:

- Debe tener exactamente 10 digitos.
- Debe iniciar por `3`.
- Se deben eliminar caracteres no numericos antes de validar.
- Si el nuevo numero coincide con el telefono principal actual normalizado, debe rechazarse y pedirse uno diferente.

Ejemplo valido:

```txt
3001234567
```

Ejemplos invalidos:

```txt
0312345678
320123456
573001234567
```

### Correo

Se permitira modificar el correo principal del paciente.

Regla:

- Debe tener estructura valida de email.
- Puede usar dominios genericos o dominios propios.
- Si el nuevo correo coincide con el correo principal actual normalizado, debe rechazarse y pedirse uno diferente.

Ejemplos validos:

```txt
paciente@gmail.com
paciente@outlook.com
paciente@miempresa.com
```

## Reglas de actualizacion en legacy

La actualizacion solo puede tocar estos campos en `usuarios`:

- `Teléfono`
- `Telefono Secundario`
- `email`
- `CorreoElectrónico`
- `confirmacion_telefono`

### Caso 1: actualiza solo telefono

Si `usuarios.Teléfono` actual contiene un celular colombiano valido y es diferente al nuevo:

- mover el valor actual a `usuarios.\`Telefono Secundario\``
- guardar el nuevo en `usuarios.Teléfono`
- guardar `confirmacion_telefono = 'telefono'`

Si el valor actual esta vacio o es invalido:

- no copiarlo a `Telefono Secundario`
- guardar solo el nuevo en `usuarios.Teléfono`
- guardar `confirmacion_telefono = 'telefono'`

### Caso 2: actualiza solo correo

Si `usuarios.email` actual es valido y diferente al nuevo:

- mover el valor actual a `usuarios.CorreoElectrónico`
- guardar el nuevo en `usuarios.email`
- guardar `confirmacion_telefono = 'correo'`

Si el valor actual esta vacio o es invalido:

- no copiarlo a `CorreoElectrónico`
- guardar solo el nuevo en `usuarios.email`
- guardar `confirmacion_telefono = 'correo'`

### Caso 3: actualiza ambos

Debe ejecutarse en una sola transaccion logica:

- aplicar la regla de telefono
- aplicar la regla de correo
- guardar `confirmacion_telefono = 'ambos'`

### Caso 4: solo confirma sin editar

- no modificar `confirmacion_telefono`
- no cambiar telefono ni correo
- continuar el flujo

## Arquitectura propuesta

Se mantiene modular monolith + arquitectura hexagonal.

### Capas involucradas

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
Legacy adapters / bot adapters
```

### Estados nuevos

Agregar a `CONVERSATION_STATES`:

- `CONFIRMING_PATIENT_CONTACT`
- `SELECTING_CONTACT_UPDATE_FIELD`
- `UPDATING_CONTACT_PHONE`
- `UPDATING_CONTACT_EMAIL`

### Intencion nueva

Agregar a `ConversationFlowIntent`:

- `UPDATE_CONTACT`

## Diseno conversacional

### Entrada desde otros servicios

Transicion base:

1. `MAIN_MENU` selecciona servicio.
2. `WAITING_DOCUMENT`
3. `WAITING_BIRTH_DATE`
4. identidad valida
5. `PATIENT_VALIDATED`
6. si contacto no ha sido confirmado para ese flujo:
   - `CONFIRMING_PATIENT_CONTACT`
7. al completar el subflujo:
   - volver a `PATIENT_VALIDATED`
   - enrutar al flujo principal original

### Entrada desde actualizar contacto

Transicion:

1. `MAIN_MENU` + `main_menu_update_contact`
2. `WAITING_DOCUMENT`
3. `WAITING_BIRTH_DATE`
4. identidad valida
5. `PATIENT_VALIDATED`
6. `CONFIRMING_PATIENT_CONTACT`
7. si completa confirmacion o actualizacion:
   - mensaje de exito
   - `MAIN_MENU`

### Navegacion interna

- `CONFIRMING_PATIENT_CONTACT`
  - `Continuar` -> completa o bloquea
  - `Actualizar y continuar` -> `SELECTING_CONTACT_UPDATE_FIELD`
  - `Terminar proceso` -> cierre
- `SELECTING_CONTACT_UPDATE_FIELD`
  - `Telefono` -> `UPDATING_CONTACT_PHONE`
  - `Correo` -> `UPDATING_CONTACT_EMAIL`
  - `Ambos` -> `UPDATING_CONTACT_PHONE`, luego `UPDATING_CONTACT_EMAIL`
  - `Volver` -> `CONFIRMING_PATIENT_CONTACT`
  - `Menu principal` -> `MAIN_MENU`
  - `Finalizar` -> cierre
- `UPDATING_CONTACT_PHONE`
  - dato valido -> guardar pendiente o persistir
  - `Volver` -> `SELECTING_CONTACT_UPDATE_FIELD`
- `UPDATING_CONTACT_EMAIL`
  - dato valido -> persistir y terminar subflujo
  - `Volver` -> `SELECTING_CONTACT_UPDATE_FIELD`

## Cambios por modulo

### Conversations

Cambios esperados:

- `main-menu.handler.ts`
  - activar `MAIN_MENU_OPTION_IDS.UPDATE_CONTACT`
- `conversation-session-context.entity.ts`
  - agregar `UPDATE_CONTACT`
  - agregar bloque `contactVerification`
- `patient-validated.handler.ts`
  - convertirlo en compuerta de contacto antes del enrutamiento final
- nuevos handlers:
  - `confirming-patient-contact.handler.ts`
  - `selecting-contact-update-field.handler.ts`
  - `updating-contact-phone.handler.ts`
  - `updating-contact-email.handler.ts`
- nuevas factories:
  - `patient-contact-confirmation-message.factory.ts`
  - `patient-contact-update-options-list.factory.ts`
  - `patient-contact-update-success-message.factory.ts`
- `conversation-navigation.service.ts`
  - mapear `Volver` entre estados del subflujo
  - evitar navegacion adicional automatica cuando el propio mensaje ya trae botones/lista de navegacion final
- `conversation-state-prompt.service.ts`
  - reconstruir prompts de estados nuevos
- `conversation-state-handler-resolver.service.ts`
  - registrar handlers nuevos

### Patients

Agregar casos de uso y puertos:

- `ResolvePatientContactProfileUseCase`
- `UpdatePatientContactDetailsUseCase`
- `PatientContactProfileRepository`
- `UpdatePatientContactDetailsRepository`

Agregar servicios:

- `PatientContactInputValidatorService`
- utilidad compartida de telefono colombiano
- utilidad de validacion de email

Agregar adaptadores:

- lectura desde `usuarios` para:
  - nombre
  - telefono principal
  - correo principal
- escritura controlada en `usuarios` para campos permitidos

## Contratos y tipos

### Contact profile

El perfil leido del paciente debe exponer al menos:

- `patientId`
- `fullName`
- `primaryPhone`
- `primaryEmail`

### Contact verification context

El contexto de sesion debe guardar al menos:

- `fullName`
- `primaryPhone`
- `primaryEmail`
- `requiresPhoneUpdate`
- `requiresEmailUpdate`
- `selectedUpdateMode`
- `pendingPhone`
- `completedForCurrentFlow`
- `invalidPhoneAttempts`
- `invalidEmailAttempts`

### Update command

El comando de actualizacion debe distinguir explicitamente:

- `PHONE`
- `EMAIL`
- `BOTH`

Y debe llevar:

- `patientId`
- `newPhone?`
- `newEmail?`
- `updatedBy = 'AdrianaBot'`
- `triggerFlowIntent`

## Seguridad y guardrails

### Principios

- No exponer errores tecnicos al paciente.
- No registrar PII completa en logs.
- No abrir escritura general sobre `usuarios`.
- No modificar otras tablas legacy.

### Conexion de escritura

Se definira una conexion dedicada para este caso, separada de la de lectura, por ejemplo mediante variable de entorno distinta.

La cuenta debe tener permiso unicamente para `UPDATE` sobre columnas aprobadas de `usuarios`.

### Restriccion de implementacion

La escritura no debe pasar por el `PrismaService` legacy actual porque hoy aplica guardrails read-only para `usuarios`.

Debe existir un adaptador de escritura aislado con SQL parametrizado y validaciones previas.

Esta restriccion es obligatoria y no negociable para la implementacion.

La conexion de escritura debe estar separada de la de lectura y limitada a este caso de uso.

La implementacion debe aplicar como minimo:

- credencial separada para escritura legacy
- whitelist estricta de columnas actualizables
- SQL parametrizado
- auditoria de intento, exito y fallo
- posibilidad de deshabilitar la escritura por configuracion en ambientes no autorizados

## Auditoria

Registrar al menos estos eventos:

- `patient.contact_confirmation.prompted`
- `patient.contact_confirmation.selected`
- `patient.contact_update.option_selected`
- `patient.contact_update.validation_failed`
- `patient.contact_update.persisted`
- `patient.contact_update.failed`
- `patient.contact_update.completed_as_primary_flow`

Datos auditables permitidos:

- `conversationKey`
- `patientId`
- `flowIntent`
- tipo de actualizacion
- telefono/correo enmascarados
- resultado
- motivo de fallo tecnico o funcional sin PII completa

## Manejo de errores

### Errores funcionales

- telefono invalido
- correo invalido
- dato repetido respecto al actual
- falta documento o contexto inconsistente

Respuesta:

- mensaje claro y controlado
- permanencia en el paso correcto
- contador de intentos

### Errores tecnicos

- falla leyendo contacto desde legacy
- falla actualizando contacto
- timeout o excepcion inesperada

Respuesta:

- no caer la API
- auditar error
- responder mensaje generico
- permitir reintento o salida segura

### Limite de intentos

Se define por defecto:

- 3 intentos invalidos por paso de telefono
- 3 intentos invalidos por paso de correo

Al superar el limite:

- volver a lista de actualizacion
- no cerrar de forma abrupta
- permitir `Menu principal` o `Finalizar`

## Criterios de aceptacion

1. Todo flujo que hoy pasa por identidad valida debe pasar por la compuerta de contacto antes de continuar.
2. `Actualizar contacto` debe funcionar como flujo autonomo reutilizando exactamente el mismo subflujo.
3. Si telefono o correo son invalidos o faltan, `Continuar` no debe avanzar.
4. El telefono nuevo debe validarse como celular colombiano valido.
5. El correo nuevo debe validarse estructuralmente.
6. La actualizacion de telefono debe mover el anterior a `Telefono Secundario` solo si era valido.
7. La actualizacion de correo debe mover el anterior a `CorreoElectrónico` solo si era valido.
8. La actualizacion de ambos debe ejecutarse como una sola operacion consistente.
9. Si solo confirma sin editar, no debe tocar `confirmacion_telefono`.
10. Si entra desde `Actualizar contacto`, al finalizar debe mostrar exito y volver al menu principal.
11. Todos los errores relevantes deben quedar auditados.
12. La API no debe caerse por errores de validacion o excepciones de infraestructura.
13. La escritura sobre `usuarios` debe implementarse exclusivamente a traves del adaptador dedicado de escritura legacy definido en este spec.
14. El subflujo de confirmacion/actualizacion de contacto debe implementarse como componente conversacional reutilizable central, sin duplicar ramas equivalentes dentro de multiples handlers principales.

## Plan de pruebas

### Unit tests

- activacion de `main_menu_update_contact`
- branch de `PATIENT_VALIDATED` hacia compuerta de contacto
- handler de confirmacion
- handler de seleccion de campo a actualizar
- handler de actualizacion de telefono
- handler de actualizacion de correo
- validador de celular colombiano
- validador de email
- caso de uso de actualizacion para:
  - telefono
  - correo
  - ambos
  - confirmacion sin cambios

### Repository tests

- lectura correcta del perfil de contacto desde `usuarios`
- update solo telefono
- update solo correo
- update ambos
- no copiar dato previo invalido a secundario/respaldo

### Flow tests

- solicitar cita -> validacion -> confirmacion -> continuar
- consultar citas -> validacion -> actualizar telefono -> continuar
- mi dispensario -> validacion -> dato faltante -> obligar actualizacion
- actualizar contacto -> validacion -> actualizar correo -> mensaje de exito -> menu
- actualizar contacto -> confirmar sin cambios -> mensaje de exito -> menu
- `Volver`, `Menu principal`, `Finalizar`
- falla tecnica de persistencia con respuesta controlada

## Variables de entorno y configuracion

Se debera documentar en `.env.example` la configuracion necesaria para la conexion dedicada de escritura legacy.

La implementacion final debe dejar claro:

- conexion de lectura legacy
- conexion de escritura legacy para contacto
- que la escritura esta limitada a este caso de uso

## Supuestos

- `main_menu_update_contact` ya existe en el menu, pero falta activarlo en el handler.
- `usuarios.Teléfono` es el campo principal a mostrar y actualizar.
- `usuarios.email` es el correo principal a mostrar y actualizar.
- `usuarios.CorreoElectrónico` se usara como respaldo historico del correo previo.
- `usuarios.\`Telefono Secundario\`` se usara como respaldo del telefono previo.
- El valor de `confirmacion_telefono` se tratara como bandera de ultimo tipo de actualizacion realizada:
  - `telefono`
  - `correo`
  - `ambos`
- Si no hubo actualizacion, ese campo no se modifica.

## Riesgos y notas de implementacion

- Mostrar telefono y correo completos mejora confirmacion visual, pero incrementa exposicion si hubo validacion cruzada incorrecta. Esta decision queda explicita por requerimiento funcional.
