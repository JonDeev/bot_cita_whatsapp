# Diseno: configuracion operativa de encuestas de satisfaccion en panel administrativo

Fecha: 2026-06-17
Estado: Propuesto para revision del usuario
Alcance: configuracion operativa de encuestas de satisfaccion desde el panel admin, sin tocar `reminders` ni alterar la experiencia conversacional del paciente

## 1. Objetivo

Agregar una seccion de `Configuracion` al area de `Encuestas` del panel administrativo para controlar los envios de encuestas de satisfaccion con seguridad operativa, trazabilidad completa y limites claros de alcance.

La capacidad debe permitir:

1. activar o pausar envios de encuestas sin redeploy
2. operar `mock/live` con rollout controlado
3. ajustar guardrails de scheduler y despacho
4. auditar todas las mutaciones y vistas sensibles
5. mantener el dominio `surveys` como owner de la configuracion

## 2. Alcance

Incluye:

1. nueva vista `/admin/surveys/settings`
2. endpoints admin para leer, actualizar y auditar configuracion
3. persistencia versionada de configuracion en bot DB
4. separacion entre configuracion almacenada y configuracion efectiva
5. pausa de emergencia explicita
6. controles con allowed values cerrados
7. integracion runtime solo en `surveys`

No incluye:

1. cambios en `src/modules/reminders/**`
2. cambios en `src/modules/admin-reminders/**`
3. cambios en textos, estados o pantallas del `Flow` de encuestas
4. cambios en la UX del paciente dentro de la conversacion
5. editor de plantillas o contenido de mensajes
6. engine generico compartido de runtime settings
7. ejecucion de pruebas en esta tarea

## 3. Principios no negociables

1. `surveys` sigue siendo el owner funcional y tecnico de la configuracion de encuestas.
2. `admin-surveys` es solo un adapter administrativo HTTP y de permisos.
3. La fuente de verdad operativa sera la base bot, no variables de entorno.
4. Las variables de entorno quedan solo como bootstrap defaults y fallback seguro.
5. Toda mutacion debe ser auditable, versionada e inmutable a nivel de eventos.
6. No se introducen abstracciones compartidas con `reminders` en esta fase.
7. El diseno debe privilegiar codigo necesario y pequenos componentes cohesionados.
8. No se aceptan inputs libres para parametros operativos de alto impacto.
9. El frontend refleja permisos; la seguridad real vive en backend.
10. Ningun cambio de configuracion debe modificar el contrato conversacional del paciente.

## 4. Decisiones cerradas

1. La nueva capacidad vivira dentro del area ya existente de `Encuestas`.
2. Se agregara navegacion secundaria `Operacion | Configuracion`.
3. La configuracion de encuestas se implementara como bounded context propio, no como extension de `reminders`.
4. Se usara concurrencia optimista con `expectedVersion`.
5. Se registraran snapshots `previous`, `new` y `effective` por cada cambio.
6. `ADMIN` podra editar todas las secciones.
7. `SUPERVISOR` podra ver todo pero editar solo `primary`.
8. La pausa de emergencia requerira `reason` siempre.
9. Los cambios de alto impacto en secciones `advanced` y `protected` requeriran `reason`.
10. El runtime de encuestas consumira configuracion resuelta antes de programar, crear lotes o enviar.

## 5. Arquitectura aprobada

Se mantiene modular monolith con arquitectura hexagonal.

```txt
Admin panel /api/admin/surveys/settings
        ↓
admin-surveys application adapters
        ↓
surveys application use cases
        ↓
surveys domain runtime settings
        ↓
runtime settings repository port
        ↓
Prisma bot repository
        ↓
MySQL bot DB
```

Separacion de responsabilidades:

1. `packages/shared`
   - DTOs, enums y schemas Zod compartidos
2. `surveys/domain`
   - tipos, puertos, reglas y tokens
3. `surveys/application`
   - catalogo, resolver, initializer y use cases
4. `surveys/infrastructure`
   - Prisma repository e integracion con scheduler
5. `admin-surveys`
   - controller, parser y wrappers administrativos
6. `apps/web`
   - UI de configuracion de encuestas

## 6. Taxonomia de configuracion

### 6.1 Secciones

Se aprueban tres secciones:

1. `primary`
2. `advanced`
3. `protected`

### 6.2 Campos aprobados

`primary`

1. `sendMode`
2. `sendRolloutPercent`
3. `emergencyPauseEnabled`

`advanced`

1. `dispatchEnabled`
2. `eligibilityLimit`
3. `expirationHours`
4. `scheduleProfile`

`protected`

1. `schedulerLoopEnabled`
2. `tickIntervalMs`
3. `slotLockTtlSeconds`
4. `maxDispatchesPerRun`

### 6.3 Razon de diseno

Este set es suficiente para operar encuestas con seguridad sin caer en sobreconfiguracion.

No se aprueban en esta fase:

1. edicion browser-based de variables de entorno
2. docenas de toggles de horario
3. reglas clinicas configurables desde UI
4. motor generico de settings multi-modulo

## 7. Allowed values

Todos los valores editables deben salir de catalogos cerrados.

### 7.1 Primary

`sendMode`

1. `mock`
2. `live`

`sendRolloutPercent`

1. `0`
2. `5`
3. `10`
4. `25`
5. `50`
6. `75`
7. `100`

`emergencyPauseEnabled`

1. `enabled`
2. `disabled`

### 7.2 Advanced

`dispatchEnabled`

1. `enabled`
2. `disabled`

`eligibilityLimit`

1. `100`
2. `250`
3. `500`
4. `1000`

`expirationHours`

1. `12`
2. `24`
3. `36`
4. `48`

`scheduleProfile`

1. `business_hours_mon_fri`
2. `extended_hours_mon_fri`
3. `business_hours_mon_sat`

### 7.3 Protected

`schedulerLoopEnabled`

1. `enabled`
2. `disabled`

`tickIntervalMs`

1. `30000`
2. `60000`
3. `300000`

`slotLockTtlSeconds`

1. `1200`
2. `1800`
3. `2100`
4. `2700`

`maxDispatchesPerRun`

1. `25`
2. `50`
3. `100`
4. `200`

## 8. Clases de mutabilidad runtime

### 8.1 Hot-reloadable

Deben aplicar sin reinicio:

1. `sendMode`
2. `sendRolloutPercent`
3. `emergencyPauseEnabled`
4. `dispatchEnabled`
5. `eligibilityLimit`
6. `expirationHours`
7. `scheduleProfile`
8. `slotLockTtlSeconds`
9. `maxDispatchesPerRun`

### 8.2 Restart-scoped

Persisten de inmediato pero su efecto real requiere reinicio controlado:

1. `schedulerLoopEnabled`
2. `tickIntervalMs`

### 8.3 Regla de UX operativa

La UI debe mostrar con claridad:

1. que campos aplican de inmediato
2. que campos requieren reinicio controlado
3. el valor almacenado
4. el valor efectivo hot-reloadable

## 9. Modelo de datos aprobado

Se recomiendan dos tablas nuevas:

1. `bot_satisfaction_survey_runtime_settings`
2. `bot_satisfaction_survey_runtime_setting_events`

### 9.1 Runtime settings

Campos minimos:

1. `id`
2. `scope_key`
3. `send_mode`
4. `send_rollout_percent`
5. `emergency_pause_enabled`
6. `dispatch_enabled`
7. `eligibility_limit`
8. `expiration_hours`
9. `schedule_profile`
10. `scheduler_loop_enabled`
11. `tick_interval_ms`
12. `slot_lock_ttl_seconds`
13. `max_dispatches_per_run`
14. `version`
15. `updated_by_admin_user_id`
16. `updated_at`
17. `created_at`

### 9.2 Runtime setting events

Campos minimos:

1. `id`
2. `settings_version`
3. `admin_user_id`
4. `change_type`
5. `section`
6. `reason`
7. `previous_snapshot_json`
8. `new_snapshot_json`
9. `effective_snapshot_json`
10. `occurred_at`
11. `created_at`

## 10. Comportamiento runtime aprobado

### 10.1 Scheduler

El scheduler de encuestas debe consultar configuracion runtime antes de ejecutar:

1. si `schedulerLoopEnabled = disabled`, no agenda ticks efectivos
2. si `scheduleProfile` indica que no corresponde correr, no procesa ventana
3. si `tickIntervalMs` cambia, el nuevo valor queda almacenado y se refleja tras reinicio controlado

### 10.2 Batch dispatcher

El batch dispatcher debe:

1. cortar ejecucion si `dispatchEnabled = disabled`
2. limitar elegibilidad por `eligibilityLimit`
3. limitar envios por corrida con `maxDispatchesPerRun`
4. usar `expirationHours` para calcular expiracion
5. respetar `slotLockTtlSeconds` al adquirir locks

### 10.3 Sender

El sender de encuestas debe:

1. no llamar a Meta si `sendMode = mock`
2. auditar el intento mock
3. bloquear envio real si `emergencyPauseEnabled = enabled`
4. respetar `sendRolloutPercent` antes del envio real

## 11. API administrativa aprobada

Rutas nuevas:

1. `GET /api/admin/surveys/settings`
2. `GET /api/admin/surveys/settings/options`
3. `GET /api/admin/surveys/settings/history`
4. `PATCH /api/admin/surveys/settings`
5. `POST /api/admin/surveys/settings/emergency-pause`

Reglas:

1. mismas guards de sesion y RBAC ya usadas en panel
2. mutaciones protegidas por CSRF
3. validacion con Zod en parser
4. respuestas basadas en DTO compartido de `packages/shared`

## 12. Diseno frontend aprobado

La vista de configuracion de encuestas debe seguir la forma operativa ya conocida del panel, sin copiar directamente componentes de `reminder-settings`.

Pantallas:

1. `/admin/surveys`
   - metricas y despachos
2. `/admin/surveys/settings`
   - configuracion operativa

Componentes esperados:

1. banner de pausa de emergencia
2. formularios por seccion
3. card resumen
4. historial reciente
5. dialogo de pausa de emergencia

La experiencia debe ser:

1. mobile-first
2. densa y legible en desktop
3. clara en permisos y estados efectivos

## 13. Seguridad y auditoria

Requisitos:

1. toda vista sensible genera evento de auditoria admin
2. toda mutacion genera evento de auditoria admin y evento de configuracion
3. no se aceptan valores fuera de catalogo
4. todo conflicto de version debe fallar explicitamente
5. `reason` es obligatorio para pausa de emergencia y cambios sensibles
6. no se exponen secretos ni payloads clinicos

## 14. Estrategia para evitar codigo espagueti

Se aprueban estas reglas de implementacion:

1. un servicio para catalogo
2. un servicio para resolver configuracion efectiva
3. un servicio para bootstrap defaults
4. un repositorio dedicado al runtime settings de encuestas
5. use cases pequenos con una sola responsabilidad
6. ningun controller con logica de negocio
7. ningun acceso directo a Prisma desde controller
8. ningun archivo utilitario gigante multiuso
9. nada de abstracciones genericas sin segundo consumidor real
10. cambios minimos y cohesionados en runtime de encuestas

## 15. Que no se debe hacer

No se debe:

1. tocar `src/modules/reminders/**`
2. tocar `src/modules/admin-reminders/**`
3. cambiar `Flow`, copy o respuestas de paciente
4. introducir un `settings engine` global
5. duplicar reglas operativas en varios lugares
6. agregar inputs numericos libres en frontend
7. escribir codigo acoplado entre `admin-surveys` y `reminders`

## 16. Resultado esperado

Al finalizar esta iniciativa, el panel de `Encuestas` tendra una seccion de `Configuracion` segura, auditable y moderna, capaz de controlar el envio de encuestas sin redeploy, sin tocar `reminders` y sin afectar el flujo conversacional del paciente.
