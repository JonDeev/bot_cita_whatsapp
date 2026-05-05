# Seleccion de fecha de cita por especialidad

## Objetivo

Agregar el paso siguiente a la seleccion de especialidad para que el bot muestre al paciente los dias mas cercanos con cupos disponibles para la especialidad elegida.

El comportamiento esperado es:

1. El paciente selecciona una especialidad.
2. El sistema consulta la agenda legacy para esa especialidad.
3. El bot muestra hasta 5 dias disponibles, ordenados del mas cercano al mas lejano.
4. Si no hay dias disponibles, el bot informa la novedad y ofrece `Menu principal` y `Finalizar`.

## Alcance

Este cambio cubre solo el paso de seleccion de fecha despues de escoger una especialidad.

Incluye:

- Consulta de disponibilidad por especialidad en la base legacy.
- Nuevo estado conversacional para seleccion de fecha.
- Lista interactiva de fechas disponibles.
- Manejo del caso sin disponibilidad.
- Persistencia en sesion de fechas ofrecidas y fecha seleccionada.
- Auditoria de resolucion de disponibilidad y seleccion de fecha.
- Pruebas unitarias del flujo nuevo.

No incluye:

- Seleccion de hora.
- Creacion de la cita.
- Reagendamiento o cancelacion.
- Cambios en tablas legacy.

## Flujo conversacional

### Caso con disponibilidad

1. El usuario selecciona una opcion valida en `SELECTING_SPECIALTY`.
2. El handler registra la especialidad seleccionada en la sesion.
3. El handler invoca un caso de uso para resolver los proximos dias con cupos disponibles.
4. Si existen resultados, el flujo avanza a `SELECTING_APPOINTMENT_DATE`.
5. El bot responde con una lista interactiva:

`Selecciona el dia de la cita`

6. La lista debe mostrar solo fechas unicas en formato `DD/MM/YYYY`.
7. Deben mostrarse maximo 5 fechas.
8. Siempre se deben mostrar del dia mas cercano al mas lejano.

### Caso sin disponibilidad

Si no hay dias disponibles para la especialidad seleccionada, el flujo debe volver a `MAIN_MENU` y enviar un unico mensaje `interactive_buttons` con este texto:

`En este momento no hay citas disponible para esta especialidad. Pronto habran mas citas disponibles para esta especialidad`

Botones:

- `Menu principal`
- `Finalizar`

No se debe enviar un mensaje de texto adicional separado.

## Reglas de negocio de disponibilidad

La disponibilidad se obtiene desde la tabla `agenda` de la BD legacy.

Un cupo solo cuenta como disponible si cumple todas estas condiciones:

- `agenda.Estado = 'Sin asignar'`
- `agenda.idusuario = '0000'`
- `agenda.fecha_cita` es hoy o una fecha futura valida segun la regla horaria
- el medico asociado al cupo esta habilitado para el bot en `especialidad_empleados.bot = 'SI'`
- la especialidad seleccionada corresponde al `Cups` de `especialidad_empleados`

La relacion base es:

- `agenda.idmedico = especialidad_empleados.Código_empleado`

### Regla horaria

La ventana de disponibilidad debe calcularse con zona horaria `America/Bogota`.

Solo se deben considerar cupos desde la hora actual mas 2 horas.

Ejemplo:

- Si hoy es `05/05/2026 10:39`, los cupos de `05/05/2026` solo cuentan desde `12:39` en adelante.
- Los cupos de dias anteriores nunca cuentan.
- Los cupos de dias posteriores si cuentan.

Como `agenda.idhora` es `varchar(5)`, la comparacion debe tratar la hora como valor horario real y no como comparacion lexicografica.

Si un registro tiene `idhora` vacia o en un formato no interpretable como hora valida, ese cupo no debe contarse como disponible.

## Resolucion de especialidad

La especialidad seleccionada en la conversacion ya viene desde el flujo de especialidades elegibles.

Para consultar disponibilidad:

- se debe usar el `cups` asociado a la especialidad ofrecida al usuario
- si una especialidad no tiene `cups`, no se debe consultar agenda
- en ese caso el flujo debe tratarse como sin disponibilidad y volver a `MAIN_MENU` con el mensaje definido

## Diseño de aplicacion

### Estado conversacional nuevo

Agregar un nuevo estado:

- `SELECTING_APPOINTMENT_DATE`

### Contexto de sesion

Extender el contexto de sesion para guardar:

- especialidad seleccionada completa
- fechas ofrecidas al usuario
- fecha seleccionada por el usuario en formato ISO

La sesion debe seguir usando formato de presentacion separado del formato interno:

- mostrar: `DD/MM/YYYY`
- persistir internamente: `YYYY-MM-DD`

### Responsabilidades por capa

#### Handler de conversacion

El handler de `SELECTING_SPECIALTY` debe:

- validar la opcion seleccionada
- guardar la especialidad elegida
- invocar el caso de uso de disponibilidad
- decidir si avanza a `SELECTING_APPOINTMENT_DATE` o vuelve a `MAIN_MENU`
- construir el mensaje de salida correspondiente

El nuevo handler de `SELECTING_APPOINTMENT_DATE` debe:

- validar la fecha elegida desde la lista interactiva
- aceptar solo fechas previamente ofrecidas
- guardar la fecha seleccionada en la sesion
- si la seleccion no es valida, permanecer en `SELECTING_APPOINTMENT_DATE` y volver a mostrar la lista ofrecida
- dejar listo el flujo para el siguiente paso de seleccion de hora

#### Caso de uso

Crear un caso de uso dedicado, por ejemplo:

- `resolve-available-appointment-dates-by-specialty.use-case.ts`

Su responsabilidad es:

- recibir la especialidad seleccionada
- validar que exista un `cups` utilizable
- pedir al repositorio los dias disponibles
- devolver una respuesta de aplicacion clara para el flujo conversacional

#### Puerto de dominio

Crear un puerto de lectura, por ejemplo:

- `appointment-availability.repository.ts`

Debe devolver cupos candidatos ordenados por fecha y hora.

La deduplicacion por dia, el limite de 5 fechas y la forma final de respuesta deben quedar en el caso de uso para mantener la regla de negocio fuera del adaptador.

#### Adaptador de infraestructura

Crear una implementacion Prisma sobre la DB legacy.

La consulta debe:

- unir `agenda` con `especialidad_empleados`
- filtrar por disponibilidad real
- filtrar por `bot = 'SI'`
- filtrar por `Cups`
- excluir horas no validas segun la regla de ahora + 2 horas
- ordenar ascendentemente por fecha y hora
- excluir registros con `idhora` no interpretable
- devolver cupos candidatos listos para que el caso de uso los reduzca a fechas unicas

## Formato de salida al usuario

### Lista de fechas disponibles

Texto del mensaje:

`Selecciona el dia de la cita`

Contenido:

- filas con fechas en formato `DD/MM/YYYY`
- una fila por dia disponible
- maximo 5 filas

Ejemplo:

- `06/05/2026`
- `07/05/2026`
- `08/05/2026`
- `09/05/2026`
- `10/05/2026`

### Sin disponibilidad

Texto exacto:

`En este momento no hay citas disponible para esta especialidad. Pronto habran mas citas disponibles para esta especialidad`

Botones:

- `Menu principal`
- `Finalizar`

## Auditoria

Registrar al menos estos eventos:

- `conversation.specialty.selected`
- `appointment.availability.resolved`
- `appointment.availability.empty`
- `conversation.appointment_date.selected`

Los eventos no deben incluir datos sensibles innecesarios.

Se puede registrar:

- `conversationKey`
- `specialtyCode`
- `specialtyCups`
- cantidad de fechas disponibles
- fecha seleccionada en formato ISO

No se debe registrar contenido sensible del paciente fuera de lo estrictamente necesario.

## Manejo de errores

Si la consulta de disponibilidad falla por error tecnico:

- no se debe exponer el error interno al paciente
- el flujo debe responder con un mensaje funcional y seguro
- se recomienda volver a `MAIN_MENU`
- se debe registrar auditoria tecnica del fallo

Mensaje sugerido para error tecnico:

`En este momento no podemos consultar la agenda de esta especialidad. Intenta nuevamente en unos minutos desde el menu principal.`

Este caso es distinto al caso de agenda vacia.

## Pruebas

### Unitarias del caso de uso

- devuelve hasta 5 fechas
- devuelve fechas en orden ascendente
- excluye cupos de dias pasados
- excluye cupos del dia actual antes del corte de ahora + 2 horas
- incluye cupos del dia actual desde el corte en adelante
- devuelve vacio si la especialidad no tiene `cups`

### Unitarias del repositorio

- filtra por `Estado = 'Sin asignar'`
- filtra por `idusuario = '0000'`
- filtra por `bot = 'SI'`
- cruza correctamente `agenda.idmedico` con `especialidad_empleados.Código_empleado`
- filtra por `Cups` de la especialidad
- deduplica fechas repetidas por varias horas del mismo dia

### Unitarias de handlers

- `SELECTING_SPECIALTY` avanza a `SELECTING_APPOINTMENT_DATE` cuando hay fechas
- `SELECTING_SPECIALTY` vuelve a `MAIN_MENU` con botones cuando no hay fechas
- `SELECTING_APPOINTMENT_DATE` acepta una fecha valida ofrecida
- `SELECTING_APPOINTMENT_DATE` reitera la lista cuando la opcion seleccionada no es valida

## Criterios de aceptacion

- Luego de elegir la especialidad, el usuario ve solo los dias con cupos disponibles para esa especialidad.
- La lista muestra maximo 5 dias y minimo 1 si existe disponibilidad.
- Los dias siempre salen del mas cercano al mas lejano.
- Los cupos del dia actual solo cuentan desde ahora + 2 horas.
- Solo cuentan agendas libres con `Estado = 'Sin asignar'` e `idusuario = '0000'`.
- Solo cuentan medicos con `bot = 'SI'` en `especialidad_empleados`.
- Si no hay disponibilidad, el usuario recibe el mensaje definido con `Menu principal` y `Finalizar`.
- La seleccion de fecha queda persistida en la sesion para el siguiente paso.
- El comportamiento queda cubierto por pruebas unitarias relevantes.
