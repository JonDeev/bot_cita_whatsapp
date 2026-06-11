# Diseno: confirmacion operativa del numero oficial para consentimiento WhatsApp

## Resumen

Esta especificacion define la politica funcional para los flujos interactivos del chatbot WhatsApp donde el paciente debe confirmar o actualizar su numero de contacto antes de continuar.

La regla central es que el consentimiento de WhatsApp solo puede persistirse contra el `usuarios.Telefono` vigente del paciente, siempre que ese numero haya pasado por la confirmacion operativa del flujo y exista `usuarios.telefono_verificado_en`.

Esta politica aplica unicamente al chatbot interactivo. No modifica ni redisenia los flujos de recordatorios ni de encuestas salientes, que quedan exactamente como estan hoy.

## Objetivo

Asegurar que, antes de continuar con flujos conversacionales que dependen de WhatsApp, el sistema obligue al paciente a actualizar o confirmar su numero oficial cuando exista riesgo de inconsistencia entre:

- el numero almacenado en `usuarios.Telefono`
- el numero de la sesion de WhatsApp (`participantPhone`)
- el estado de verificacion operativa en `usuarios.telefono_verificado_en`

El objetivo es evitar consentimientos asociados a numeros antiguos, numeros historicos o numeros de sesion por fallback, manteniendo una sola verdad operativa para WhatsApp.

## Alcance

Incluye:

- validacion del numero oficial del paciente antes de continuar en flujos interactivos del bot
- redireccion obligatoria al flujo de actualizar contacto cuando falle cualquiera de las condiciones de elegibilidad
- persistencia del consentimiento siempre contra el numero vigente en `usuarios.Telefono`
- actualizacion de `usuarios.Telefono` y `usuarios.telefono_verificado_en` como parte del mismo flujo operativo
- bloqueo de continuidad cuando el paciente rechaza actualizar o confirmar el numero cuando es obligatorio
- bloqueo de continuidad cuando falla la escritura en legacy al actualizar o verificar
- auditoria de redireccion, rechazo, mismatch y fallas tecnicas
- cobertura de pruebas unitarias y de flujo para la logica afectada

No incluye:

- cambios en recordatorios automatizados
- cambios en encuestas de satisfaccion
- cambios en la logica de despacho saliente existente
- OTP, SMS, llamadas o verificacion criptografica de posesion
- librerias no oficiales de WhatsApp

## Decisiones Cerradas

1. La unica verdad operativa para WhatsApp sera `usuarios.Telefono`.
2. `usuarios.telefono_verificado_en` debe existir para considerar el numero como verificado operativamente.
3. Si `usuarios.Telefono` esta vacio, el paciente debe ir al flujo de actualizar contacto.
4. Si `usuarios.Telefono` no es valido, el paciente debe ir al flujo de actualizar contacto.
5. Si `usuarios.telefono_verificado_en` esta vacio, el paciente debe ir al flujo de actualizar contacto.
6. Si `participantPhone` es diferente de `usuarios.Telefono`, el paciente debe ir al flujo de actualizar contacto.
7. Si el paciente rechaza actualizar o confirmar el numero cuando es obligatorio, no puede continuar.
8. Si falla la escritura en legacy al actualizar telefono o marcar `telefono_verificado_en`, el sistema debe bloquear continuidad.
9. El consentimiento de WhatsApp se persiste unicamente con `usuarios.Telefono` vigente al momento del consentimiento.
10. Si el numero cambia, el consentimiento previo deja de ser valido para WhatsApp.
11. La politica aplica solo al chatbot interactivo y a flujos que dependen de la conversacion con el paciente.
12. Los flujos de recordatorios y encuestas permanecen sin cambios en esta fase.

## Principios De Diseno

### Una sola verdad operativa

El sistema no debe mantener varias fuentes equivalentes para el consentimiento. `participantPhone` solo sirve como senal de mismatch o como contexto conversacional, pero no como fallback para persistir consentimiento.

### Confirmacion operativa, no criptografica

La validacion del numero no debe confundirse con una verificacion fuerte tipo OTP. Lo que el sistema hace es una confirmacion operativa del numero oficial para WhatsApp dentro del flujo de negocio.

### Fallo seguro

Si el numero no puede resolverse o no puede persistirse correctamente en legacy, el sistema debe detener el flujo y ofrecer una salida controlada, preferiblemente handoff humano o un mensaje neutral de reintento.

### Cohesion de flujo

La actualizacion de telefono y la confirmacion operativa del numero deben vivir en el mismo recorrido funcional, sin dispersar la logica en multiples handlers o atajos ad hoc.

## Estado Actual Del Proyecto

Hoy el proyecto ya cuenta con varias piezas relevantes:

- valida el perfil de contacto del paciente en `PatientValidatedHandler`
- identifica si el telefono principal requiere actualizacion
- lleva al paciente al flujo de confirmacion de contacto
- permite actualizar telefono y marcar `telefono_verificado_en` en la persistencia legacy
- en el flujo de cambio de contacto, puede volver a pedir consentimiento si el gate lo requiere

Sin embargo, hoy la politica no se aplica desde un punto unico y todavia existen dependencias entre:

- `participantPhone`
- `contactVerification`
- `verifiedPhone`
- `usuarios.Telefono`
- `usuarios.telefono_verificado_en`

Esta especificacion busca cerrar esa ambiguedad solo para el chatbot interactivo.

## Reglas Funcionales

### 1. Validacion inicial del numero

Antes de permitir que el paciente continue en un flujo interactivo que dependa del canal WhatsApp, el sistema debe validar:

- que `usuarios.Telefono` exista
- que `usuarios.Telefono` sea un celular valido
- que `usuarios.telefono_verificado_en` exista
- que `participantPhone` coincida con `usuarios.Telefono`

Si cualquiera de estas condiciones falla, el paciente debe ser redirigido al flujo de actualizar contacto.

### 2. Redireccion obligatoria

Cuando se detecte alguna de las condiciones anteriores, el bot no debe intentar resolver el consentimiento ni continuar con el flujo principal.

El comportamiento esperado es:

1. enviar al flujo de actualizar contacto
2. pedir al paciente que confirme o actualice su numero
3. actualizar `usuarios.Telefono`
4. dejar `usuarios.telefono_verificado_en` como evidencia operativa del proceso
5. solo despues evaluar el consentimiento correspondiente

### 3. Numero de tercero o familiar

Si el paciente escribe desde el numero de un familiar, cuidador o tercero autorizado, el sistema lo tratara igual que cualquier otro mismatch.

No se toma ese numero como valido por defecto. Se obliga al flujo de actualizar contacto y el numero final que el paciente confirme pasara a ser la nueva verdad oficial.

### 4. Consentimiento

El consentimiento de WhatsApp debe persistirse siempre con el `usuarios.Telefono` vigente al momento de la aceptacion.

No debe persistirse con:

- `participantPhone`
- un numero historico anterior
- un telefono transitorio del contexto conversacional
- un fallback silencioso por ausencia de `contactVerification`

### 5. Cambio de numero

Si el paciente cambia su numero, cualquier consentimiento previo asociado al numero anterior deja de ser valido para WhatsApp.

Ese nuevo numero debe pasar por la misma politica de actualizacion/verificacion operativa y el consentimiento debe volver a quedar asociado al numero vigente.

### 6. Fallas tecnicas

Si falla la escritura en legacy al:

- actualizar `usuarios.Telefono`
- actualizar `usuarios.telefono_verificado_en`

el sistema debe:

1. bloquear la continuidad
2. evitar pedir consentimiento
3. evitar continuar con cualquier flujo dependiente de WhatsApp
4. registrar auditoria
5. ofrecer salida controlada o handoff si el flujo lo soporta

### 7. Rechazo del paciente

Si el paciente rechaza actualizar o confirmar el numero cuando es obligatorio, no puede continuar.

El flujo debe terminar en una salida controlada, no en una continuidad parcial ni en un consentimiento derivado.

## Flujo Propuesto

### Flujo de inicio

1. El paciente escribe por WhatsApp.
2. El sistema resuelve la sesion y obtiene `participantPhone`.
3. El sistema consulta `usuarios.Telefono` y `usuarios.telefono_verificado_en`.
4. Si existe mismatch o falta verificacion, redirige al flujo de actualizar contacto.

### Flujo de actualizacion y confirmacion operativa

1. El paciente entra al flujo de actualizar contacto.
2. El sistema solicita o confirma el numero.
3. El sistema actualiza `usuarios.Telefono`.
4. El sistema marca `usuarios.telefono_verificado_en`.
5. El sistema considera ese numero como la unica verdad operativa para WhatsApp.
6. El sistema solicita o persiste el consentimiento correspondiente.

### Flujo de salida controlada

1. Si hay rechazo del paciente o falla tecnica, el bot detiene la continuacion.
2. Se registra auditoria.
3. Se devuelve un mensaje controlado.
4. Si existe handoff o escalamiento humano, se usa ese mecanismo.

## Comportamiento Actual Relevante

Los componentes que ya acercan al proyecto a esta politica son:

- `PatientValidatedHandler`, que detecta si la validacion de contacto debe activarse
- `ConfirmingPatientContactHandler`, que obliga a confirmar o actualizar el contacto
- `UpdatingContactPhoneHandler`, que actualiza telefono y persiste la verificacion operativa
- `ContactUpdateCompletionService`, que reevalua el gate de consentimiento despues de una actualizacion exitosa
- `ResolveWhatsappAppointmentNotificationsOptInGateUseCase`, que ya usa `phoneVerifiedAtIso` y compara el telefono del consentimiento con el telefono verificado

La politica nueva no debe introducir otra fuente de verdad paralela.

## Reglas Que No Cambian

Esta especificacion no cambia:

- la logica de recordatorios salientes
- la logica de encuestas salientes
- el uso actual de los despachos salientes existentes
- el modo en que el backend consume consentimientos ya existentes para procesos ya implementados

Esto significa que la presente politica se enfoca en el chatbot interactivo y en el consentimiento que nace o se revalida dentro de ese recorrido.

## Riesgos Y Consideraciones

1. Si se usa `participantPhone` como respaldo para consentimiento, se podria registrar consentimiento sobre un numero que no es la verdad operativa.
2. Si no se bloquea la continuidad ante fallas de legacy, el sistema podria avanzar sin numero confiable.
3. Si se deja abierto el rechazo del paciente, la politica perderia consistencia y trazabilidad.
4. Si se confunde confirmacion operativa con OTP, el equipo podria sobreestimar el nivel de seguridad real del proceso.

## Componentes Afectados

### Capa de conversaciones

- validacion inicial de contacto
- redireccion obligatoria al flujo de actualizacion
- continuidad o bloqueo del flujo principal
- solicitud de consentimiento tras la confirmacion operativa

Archivos de referencia probables:

- `src/modules/conversations/application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler.ts`
- `src/modules/conversations/application/state-handlers/updating-contact-phone.handler.ts`
- `src/modules/conversations/application/services/contact-update-completion.service.ts`
- `src/modules/conversations/application/services/consent-phone-resolver.service.ts`
- `src/modules/conversations/application/use-cases/resolve-whatsapp-appointment-notifications-opt-in-gate.use-case.ts`
- `src/modules/conversations/conversations.module.ts`

### Capa de pacientes

- resolucion de perfil de contacto
- validacion del telefono principal
- escritura de `usuarios.Telefono`
- escritura de `usuarios.telefono_verificado_en`

### Capa de auditoria

- registro de mismatch
- registro de rechazo
- registro de falla tecnica
- registro de consentimiento persistido contra el telefono vigente

### Capa de pruebas

- `src/modules/conversations/application/services/consent-phone-resolver.service.spec.ts`
- `src/modules/conversations/application/state-handlers/requesting-whatsapp-appointment-notifications-opt-in.handler.spec.ts`

## Criterios De Aceptacion

1. Si `usuarios.Telefono` esta vacio, el sistema redirige al flujo de actualizar contacto.
2. Si `usuarios.Telefono` no es valido, el sistema redirige al flujo de actualizar contacto.
3. Si `usuarios.telefono_verificado_en` esta vacio, el sistema redirige al flujo de actualizar contacto.
4. Si `participantPhone` difiere de `usuarios.Telefono`, el sistema redirige al flujo de actualizar contacto.
5. Si el paciente escribe desde un numero de tercero o familiar, el sistema lo trata como mismatch y redirige al flujo de actualizar contacto.
6. Si el paciente rechaza actualizar o confirmar el numero cuando es obligatorio, el flujo no continua.
7. Si falla la escritura en legacy, el flujo no continua.
8. Si la actualizacion/verificacion termina bien, `usuarios.Telefono` y `usuarios.telefono_verificado_en` quedan actualizados.
9. El consentimiento se persiste contra `usuarios.Telefono` vigente.
10. No se usa `participantPhone` como fallback para guardar consentimiento.
11. El consentimiento anterior deja de ser valido si cambia el numero oficial.
12. Recordatorios y encuestas no cambian con esta especificacion.
13. `contactVerification.verifiedPhone` solo puede usarse como dato transitorio del flujo, no como fuente final de verdad si el numero oficial no quedo persistido.
14. No se debe extender la vida util del contexto `contactVerification` para resolver el consentimiento fuera del flujo de actualizacion de contacto.

## Notas De Implementacion

La implementacion posterior deberia seguir estas guias:

- concentrar la validacion del numero en un gate reutilizable, no dispersar la logica en cada handler
- evitar duplicar la resolucion de telefono en varias capas
- mantener el dominio estricto y la persistencia aislada en repositorios
- registrar auditoria suficiente para entender por que un flujo fue redirigido o bloqueado
- no introducir codigo espagueti ni dependencias circulares entre conversaciones y pacientes

## Definicion De Listo

Esta especificacion se considera lista cuando:

- la politica queda clara para el equipo funcional y tecnico
- el alcance excluye recordatorios y encuestas como se definio
- el consentimiento solo queda atado al numero oficial vigente del paciente
- la redireccion por mismatch o falta de verificacion queda explicitamente definida
- el siguiente paso ya puede convertirse en plan de implementacion por archivos y casos de uso
