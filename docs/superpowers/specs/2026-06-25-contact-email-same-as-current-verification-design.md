# Diseno: tratar el correo igual al actual como verificacion exitosa en actualizar contacto

## Resumen

Este ajuste cambia un unico caso de negocio dentro del flujo de actualizacion de contacto:

- si el paciente escribe un correo valido que coincide con el correo actual normalizado en la BD
- el sistema no debe tratarlo como error
- el sistema no debe intentar guardar el mismo correo otra vez
- el sistema debe marcar `correo_verificado_en`
- el flujo debe continuar sin quedar bloqueado

La experiencia visible debe cambiar lo minimo posible. No se agregan nuevas opciones al menu interactivo ni nuevas intenciones visibles para el paciente. El caso se resuelve por debajo, en backend.

## Objetivo funcional

Cuando el paciente ingrese el mismo correo ya registrado:

1. validar que el correo tenga formato correcto
2. comparar el correo normalizado contra el correo actual normalizado de la BD
3. si coincide, tomarlo como confirmacion valida
4. no persistir el mismo correo de nuevo
5. actualizar `correo_verificado_en`
6. continuar el flujo como exito

Este comportamiento debe aplicarse en dos rutas:

- el subflujo de `Actualizar contacto`
- el subflujo comun de actualizacion de correo usado por los demas flujos

## Alcance

Incluye:

- cambio de comportamiento para el caso `SAME_EMAIL`
- separacion clara entre actualizar correo y verificar correo
- marcado de `correo_verificado_en` cuando el correo es el mismo y valido
- reutilizacion del mismo flujo de salida exitosa existente
- ajuste de pruebas unitarias y de handler
- auditoria explicita del caso sin exponer datos sensibles

No incluye:

- nuevas opciones visibles en la lista interactiva
- cambios de UX amplios
- cambios en telefono
- cambios en otros flujos de conversaciones
- cambios en FAQ, documentos, citas o handoff
- cambios de frontend web

## Decision funcional

### Caso nuevo

Si el correo nuevo:

- es valido
- y coincide con el correo actual normalizado

entonces el sistema debe:

- ser detectado por el handler de conversacion como un caso especial de verificacion
- no pasar por el use case de actualizacion de correo
- ejecutar un caso de uso dedicado de verificacion
- registrar la verificacion del correo en `correo_verificado_en`
- no escribir el mismo correo como update
- responder con un mensaje de exito o continuidad, no con un mensaje de error

Si el paso ocurre dentro del subflujo `BOTH`, y existe un telefono confirmado pendiente distinto al actual, el flujo debe conservar esa actualizacion de telefono pendiente y luego cerrar con exito la verificacion de correo.

### Caso distinto

Si el correo nuevo es valido y diferente:

- se mantiene el flujo de actualizacion actual

### Caso invalido

Si el correo es invalido o vacio:

- se mantiene el manejo de error actual

## Principios de diseno

1. No duplicar logica entre `Actualizar contacto` y el flujo comun.
2. No mezclar la validacion del correo con la persistencia del correo.
3. No introducir un mensaje nuevo que parezca tecnico o confuso.
4. No tocar otros estados ni ramas del orquestador.
5. Mantener el cambio en la capa de aplicacion y dominio, no en el adaptador de WhatsApp.

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
Legacy MariaDB adapter
```

El cambio se implementa en la capa de conversacion y en la capa de pacientes para que el caso especial quede reusable y testeable.

## Componentes involucrados

### 1. Handler de actualizacion de correo

Archivo principal:

- `src/modules/conversations/application/state-handlers/updating-contact-email.handler.ts`

Responsabilidad:

- distinguir entre correo invalido, correo diferente y correo igual al actual
- cuando el correo sea igual al actual, derivar a verificacion
- cuando el correo sea diferente, invocar el use case de actualizacion existente
- no contener logica de persistencia

### 2. Caso de uso de actualizacion existente

Archivo principal:

- `src/modules/patients/application/use-cases/update-patient-contact-details.use-case.ts`

Responsabilidad:

- seguir manejando la actualizacion real cuando el correo es distinto
- mantener la validacion de formato y normalizacion para updates reales
- no cambiar el comportamiento de otros consumidores de este caso de uso
- no absorber el caso `SAME_EMAIL`

### 3. Caso de uso de verificacion de correo

Se recomienda crear un caso de uso especifico, análogo al de verificacion de telefono:

- `src/modules/patients/application/use-cases/mark-patient-email-verified.use-case.ts`

Responsabilidad:

- validar paciente
- validar correo normalizado
- confirmar que el correo dado coincide con el correo actual
- persistir `correo_verificado_en`

### 4. Puerto de verificacion de correo

Archivo principal:

- `src/modules/patients/domain/ports/mark-patient-email-verified.repository.ts`

Responsabilidad:

- exponer una operacion dedicada para marcar la verificacion del correo
- reutilizar el adapter MariaDB legacy existente para escribir en `usuarios`

### 5. Repositorio legacy

Archivo principal:

- `src/modules/patients/infrastructure/persistence/mysql/mariadb-legacy-patient-contact-details.repository.ts`

Responsabilidad:

- escribir `correo_verificado_en` sin cambiar el correo cuando el caso sea solo verificacion
- conservar el comportamiento actual para updates reales

### 6. Integracion en el modulo de pacientes

Archivo principal:

- `src/modules/patients/patients.module.ts`

Responsabilidad:

- registrar el nuevo use case y su repositorio
- mantener la compatibilidad con los providers existentes

## Flujo esperado

### Flujo A: correo igual al actual

1. el paciente escribe un correo
2. el correo se normaliza
3. el sistema lo compara contra el correo actual
4. si coincide y es valido, se trata como verificacion exitosa
5. se actualiza `correo_verificado_en`
6. el flujo continua

### Flujo B: correo diferente

1. el paciente escribe un correo nuevo
2. el correo se valida
3. se persiste el cambio de correo
4. el flujo continua

### Flujo C: correo invalido

1. el paciente escribe un correo mal formado
2. el sistema responde con validacion de error
3. el flujo solicita un valor correcto

## Mensajeria y UX

La experiencia debe permanecer casi igual.

Reglas:

- no agregar opciones nuevas al menu
- no mostrar un mensaje de error para el caso de correo igual al actual
- no dejar el flujo atrapado esperando una respuesta distinta
- reutilizar el mensaje de exito ya existente cuando corresponda

Si se requiere un texto nuevo, debe ser corto y equivalente a una confirmacion, no a un fallo.
La salida visible para el caso `SAME_EMAIL` debe sentirse como confirmacion normal, no como un atajo tecnico.

## Auditoria

Registrar estos eventos de manera separada:

- correo igual al actual tratado como verificacion
- correo actualizado realmente
- correo invalido
- falla tecnica al persistir

La auditoria debe guardar identificadores y contexto, no el correo completo.

## Riesgos

1. Si se sigue tratando `SAME_EMAIL` como error, el problema de UX persiste.
2. Si se cambia la persistencia sin separar la intencion, se puede guardar informacion de forma ambigua.
3. Si se toca el flujo de telefono por accidente, se introducen regresiones innecesarias.
4. Si el caso de uso no queda testeado, el comportamiento puede volver a romperse en futuras modificaciones.

## No objetivos

1. No modificar otros flujos conversacionales.
2. No cambiar el menu interactivo.
3. No introducir nuevas dependencias externas.
4. No crear nueva logica de IA o reglas heuristicas.
5. No reescribir el flujo completo de actualizacion de contacto.

## Criterios de aceptacion

1. Un correo valido igual al actual no se muestra como error.
2. El sistema no intenta guardar el mismo correo otra vez.
3. `correo_verificado_en` se actualiza en ese caso.
4. El mismo comportamiento aplica al flujo principal de `Actualizar contacto` y al subflujo reutilizado.
5. Los demas flujos no cambian.
6. Las pruebas cubren el caso nuevo.

## Definicion de listo

El cambio queda listo para implementar cuando:

1. el equipo acepta que este caso es una verificacion, no una actualizacion
2. queda claro que la UX no se abre a nuevas opciones
3. se confirma que el comportamiento debe vivir en backend
4. existe una estrategia de pruebas para el caso `SAME_EMAIL`
