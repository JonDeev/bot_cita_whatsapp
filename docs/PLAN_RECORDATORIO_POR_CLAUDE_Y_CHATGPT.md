# Plan Definitivo — Sistema de Recordatorios WhatsApp IPS SISM

**Proyecto:** Bot de citas WhatsApp IPS SISM  
**Canal:** WhatsApp Business Platform / Cloud API de Meta  
**Base de datos:** MySQL  
**Zona horaria operativa:** `America/Bogota`  
**Fecha del documento:** 2026-05-25  
**Estado:** Plan técnico antes de implementación

---

## 1. Objetivo

Implementar un sistema automatizado para enviar recordatorios de citas médicas por WhatsApp, 24 horas antes de la cita, usando la API oficial de Meta.

El sistema debe:

- Enviar recordatorios solo a pacientes con cita asignada.
- Usar plantillas aprobadas por Meta.
- Respetar opt-in del paciente.
- No enviar información médica a números no verificados.
- Evitar duplicados.
- Registrar trazabilidad completa.
- Manejar fallos, reintentos y auditoría.
- Ser robusto ante retrasos del cron o reinicios del servidor.

---

## 2. Veredicto profesional

La mejor estrategia no es buscar citas exactamente entre:

```txt
ahora + 24h
y
ahora + 24h + 1min
```

Ese enfoque es frágil. Si el cron se retrasa unos minutos, puede perder pacientes.

Tampoco se recomienda usar como lógica principal:

```txt
ahora + 23h
a
ahora + 25h
```

Ese rango es más robusto, pero puede enviar recordatorios demasiado temprano si no se controla bien.

La mejor práctica para producción es crear una tabla de recordatorios programados:

```txt
recordatorio_programado_para = fecha_hora_cita - 24 horas
```

Luego el cron procesa recordatorios vencidos:

```sql
WHERE estado = 'PENDIENTE'
  AND programado_para <= NOW()
```

Así, si el cron debía correr a las 11:00 a.m. pero corre a las 11:03 a.m., el recordatorio no se pierde.

---

## 3. Decisión final de arquitectura

```txt
Crear o actualizar cita
→ crear/actualizar registro en bot_recordatorio_cita
→ programado_para = fecha_hora_cita - 24h

Cron cada minuto
→ buscar recordatorios PENDIENTES vencidos
→ bloquear filas de forma atómica
→ validar cita
→ validar opt-in
→ validar teléfono
→ validar si teléfono está verificado
→ enviar template correspondiente
→ registrar resultado
```

---

## 4. Configuración requerida en Meta

Antes de programar los envíos reales, se deben configurar y aprobar dos plantillas en WhatsApp Manager / Business Manager.

### 4.1 Plantilla de recordatorio de cita

**Nombre sugerido:**

```txt
recordatorio_cita_24h
```

**Categoría:**

```txt
Utility
```

**Uso:**

Enviar datos de la cita a pacientes cuyo teléfono ya esté verificado.

**Texto sugerido para Meta:**

```txt
Hola {{1}}. Te recordamos tu cita en IPS SISM:

🩺 Tipo de cita: {{2}}
⚕️ Modalidad: {{3}}
📅 Fecha: {{4}}
⏰ Hora: {{5}}
🌆 Ciudad: {{6}}
🧭 Dirección: {{7}}
👨‍⚕️ Profesional: {{8}}

❗ Recuerda llegar 15 minutos antes para activar tu cita y evitar retrasos en tu atención.
```

**Variables de ejemplo para aprobación:**

| Variable | Ejemplo |
|---|---|
| `{{1}}` | María García |
| `{{2}}` | Medicina General |
| `{{3}}` | Presencial |
| `{{4}}` | 26 de mayo de 2026 |
| `{{5}}` | 11:00 AM |
| `{{6}}` | Santa Marta |
| `{{7}}` | Calle 22 #5-40, Centro |
| `{{8}}` | Dr. Juan Pérez |

---

### 4.2 Plantilla de verificación de teléfono

**Nombre sugerido:**

```txt
verificacion_telefono_paciente
```

**Categoría:**

```txt
Utility
```

**Tipo:**

```txt
Template con botones de respuesta rápida
```

**Texto sugerido:**

```txt
Hola. IPS SISM desea confirmar si este número está autorizado
para recibir recordatorios de citas médicas.

Por protección de tus datos, no enviaremos información de citas
hasta confirmar este contacto.

Selecciona una opción:
```

**Botones:**

| Texto visible | ID / Payload |
|---|---|
| Confirmar número | `btn_confirmar` |
| Número equivocado | `btn_numero_equivocado` |

**Regla crítica de privacidad:**

No incluir nombre del paciente, cédula, especialidad, fecha, hora ni datos de la cita en esta plantilla. Si el número está equivocado, revelarías información personal o sensible a un tercero.

---

## 5. Template interactiva vs mensaje interactivo normal

Para envíos proactivos fuera de la ventana de atención de 24 horas, se debe usar una plantilla aprobada.

No se debe diseñar la verificación como un simple mensaje:

```json
{
  "type": "interactive"
}
```

Debe enviarse como:

```json
{
  "type": "template"
}
```

con botones configurados dentro de la plantilla aprobada.

Los mensajes interactivos normales sirven dentro de una ventana activa permitida, pero los envíos automáticos proactivos deben salir como templates aprobadas.

---

## 6. Modelo de costos

Regla financiera recomendada:

```txt
Todo recordatorio automático debe presupuestarse como Utility cobrable.
```

Aunque algunos mensajes puedan salir sin cargo si existe una ventana de atención abierta, no se debe construir el presupuesto esperando gratuidad.

### Casos

| Escenario | Tratamiento recomendado |
|---|---|
| Recordatorio automático sin interacción reciente | Utility cobrable |
| Recordatorio automático dentro de ventana 24h | Puede no generar cargo, pero no presupuestar como gratis |
| Respuesta directa del bot dentro de ventana 24h | Service message |
| Verificación proactiva de teléfono | Utility template cobrable |

---

## 7. Opt-in

El opt-in ya se captura al final de la autoasignación de cita. Aun así, debe quedar guardado de forma auditable.

Campos recomendados en `usuarios` o tabla relacionada:

```sql
whatsapp_opt_in_en DATETIME NULL,
whatsapp_opt_in_origen VARCHAR(50) NULL,
whatsapp_opt_in_texto TEXT NULL,
whatsapp_opt_out_en DATETIME NULL
```

Ejemplo de origen:

```txt
AUTOASIGNACION_CITA
```

Regla:

```txt
Si no hay opt-in válido, no se debe enviar recordatorio.
```

Estado recomendado en tabla de recordatorios:

```txt
OMITIDO_SIN_OPT_IN
```

---

## 8. Modelo de datos recomendado

### 8.1 Tabla principal de recordatorios

```sql
CREATE TABLE bot_recordatorio_cita (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  agenda_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,

  telefono_destino VARCHAR(20) NULL,
  tipo_recordatorio VARCHAR(30) NOT NULL DEFAULT 'CITA_24H',
  template_name VARCHAR(100) NULL,

  programado_para DATETIME NOT NULL,
  fecha_hora_cita DATETIME NOT NULL,

  estado ENUM(
    'PENDIENTE',
    'ENVIANDO',
    'VERIFICACION_ENVIADA',
    'ESPERANDO_CONFIRMACION_TELEFONO',
    'ENVIADO',
    'FALLIDO',
    'OMITIDO_TELEFONO_INVALIDO',
    'OMITIDO_SIN_OPT_IN',
    'CANCELADO_CITA_NO_ASIGNADA'
  ) NOT NULL DEFAULT 'PENDIENTE',

  intentos TINYINT NOT NULL DEFAULT 0,
  proximo_intento_en DATETIME NULL,

  meta_message_id VARCHAR(150) NULL,
  ultimo_error TEXT NULL,

  enviado_en DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_agenda_tipo_fecha (
    agenda_id,
    tipo_recordatorio,
    fecha_hora_cita
  ),

  INDEX idx_estado_programado (
    estado,
    programado_para
  ),

  INDEX idx_usuario (
    usuario_id
  )
);
```

### 8.2 Por qué la clave única incluye `fecha_hora_cita`

Se recomienda:

```sql
UNIQUE (agenda_id, tipo_recordatorio, fecha_hora_cita)
```

Esto permite que una cita reprogramada usando el mismo `agenda_id` pueda generar un nuevo recordatorio para la nueva fecha/hora.

Si solo se usa:

```sql
UNIQUE (agenda_id, tipo_recordatorio)
```

una reprogramación podría quedar bloqueada por el recordatorio anterior.

---

### 8.3 Tabla de auditoría de contactos

```sql
CREATE TABLE bot_contacto_auditoria (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT NULL,
  telefono_anterior VARCHAR(20) NULL,
  accion ENUM(
    'TELEFONO_CONFIRMADO',
    'NUMERO_EQUIVOCADO',
    'TELEFONO_INVALIDO',
    'OPT_IN_AUSENTE'
  ) NOT NULL,
  origen VARCHAR(50) NULL,
  detalle TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_usuario (usuario_id),
  INDEX idx_telefono (telefono_anterior)
);
```

---

## 9. Estados del recordatorio

| Estado | Significado |
|---|---|
| `PENDIENTE` | Listo para enviarse cuando llegue la hora |
| `ENVIANDO` | Tomado por un worker/cron para procesar |
| `VERIFICACION_ENVIADA` | Se envió plantilla de verificación |
| `ESPERANDO_CONFIRMACION_TELEFONO` | Pendiente de respuesta del paciente |
| `ENVIADO` | Recordatorio enviado correctamente |
| `FALLIDO` | Falló definitivamente después de reintentos |
| `OMITIDO_TELEFONO_INVALIDO` | Teléfono vacío, mal formado o no celular colombiano |
| `OMITIDO_SIN_OPT_IN` | No hay autorización WhatsApp |
| `CANCELADO_CITA_NO_ASIGNADA` | La cita ya no está asignada |

---

## 10. Flujo al crear o reprogramar una cita

### 10.1 Cuando el bot crea o reprograma cita

```txt
1. Obtener fecha_hora_cita.
2. Calcular programado_para = fecha_hora_cita - 24h.
3. Crear o actualizar bot_recordatorio_cita.
4. Dejar estado = PENDIENTE.
```

### 10.2 Cuando la cita se crea fuera del bot

En IPS SISM puede ocurrir que las citas sean creadas desde otro sistema o módulo.

Por eso se recomienda un job sincronizador:

```txt
Cada X minutos:
→ buscar citas asignadas futuras
→ verificar si ya tienen recordatorio
→ crear/actualizar recordatorio si hace falta
```

Este sincronizador evita depender exclusivamente de que el bot sea quien cree la cita.

---

## 11. Cron de envío

### 11.1 Frecuencia

```txt
Cada minuto
```

### 11.2 Zona horaria

La lógica del negocio debe usar:

```txt
America/Bogota
```

Recomendación técnica:

- Servidor en UTC.
- Código maneja zona `America/Bogota` para reglas de negocio.
- Base de datos puede guardar en UTC o en hora local Colombia, pero debe ser consistente.

---

## 12. Bloqueo atómico anti-duplicado

Si hay más de un proceso corriendo, dos workers podrían tomar el mismo recordatorio. Para evitarlo, se debe bloquear la fila.

Patrón recomendado en MySQL 8:

```sql
START TRANSACTION;

SELECT id
FROM bot_recordatorio_cita
WHERE estado = 'PENDIENTE'
  AND programado_para <= NOW()
ORDER BY programado_para ASC
LIMIT 50
FOR UPDATE SKIP LOCKED;

-- Actualizar esos ids a ENVIANDO

COMMIT;
```

Si la versión de MySQL no soporta `SKIP LOCKED`, se debe usar otro mecanismo de bloqueo controlado, por ejemplo:

- un solo worker,
- lock de aplicación,
- actualización atómica con condición `estado = 'PENDIENTE'`,
- o cola externa como BullMQ.

---

## 13. Validaciones antes del envío

Para cada recordatorio tomado por el cron:

```txt
1. Verificar que agenda.Estado siga siendo el valor real de cita asignada.
2. Verificar que el paciente tenga opt-in.
3. Verificar que usuarios.Telefono exista.
4. Normalizar teléfono a formato E.164.
5. Verificar si usuarios.telefono_verificado_en es NULL o no.
```

---

## 14. Estado real de la cita

No asumir que el valor correcto es `Asignada`.

Primero se debe verificar el valor real en producción:

```sql
SELECT DISTINCT Estado
FROM agenda;
```

Si el valor real es:

```txt
Asingada
```

la consulta debe usar ese valor hasta que se haga una normalización formal.

Regla:

```txt
Usar el valor real de producción, no el valor que debería existir.
```

---

## 15. Normalización de teléfono E.164

WhatsApp requiere números con código de país.

Formato esperado para celular colombiano:

```txt
+573XXXXXXXXX
```

Ejemplos válidos:

```txt
3001234567    → +573001234567
573001234567  → +573001234567
+573001234567 → +573001234567
```

Ejemplos inválidos:

```txt
123456
6054210000
+5754210000
```

Regla mínima:

```txt
Debe iniciar con +573
Debe tener 13 caracteres incluyendo +
Debe ser celular colombiano
```

---

## 16. Decisión según verificación del teléfono

### 16.1 Teléfono verificado

Condición:

```sql
usuarios.telefono_verificado_en IS NOT NULL
```

Acción:

```txt
Enviar template recordatorio_cita_24h.
Guardar meta_message_id.
Marcar estado = ENVIADO.
Guardar enviado_en.
```

---

### 16.2 Teléfono no verificado

Condición:

```sql
usuarios.telefono_verificado_en IS NULL
```

Acción:

```txt
No enviar datos de la cita.
Enviar template verificacion_telefono_paciente.
Marcar estado = VERIFICACION_ENVIADA o ESPERANDO_CONFIRMACION_TELEFONO.
```

Si el paciente confirma antes de la cita, el sistema puede enviar el recordatorio correspondiente.

---

## 17. Webhook de botones

### 17.1 Confirmar número

Cuando llegue:

```txt
btn_confirmar
```

Acciones:

```sql
UPDATE usuarios
SET telefono_verificado_en = [fecha/hora actual Colombia]
WHERE idusuario = ?;
```

También registrar auditoría:

```txt
accion = TELEFONO_CONFIRMADO
```

Luego revisar si existe un recordatorio cercano en estado:

```txt
VERIFICACION_ENVIADA
ESPERANDO_CONFIRMACION_TELEFONO
```

Si aplica, enviar el recordatorio de cita.

---

### 17.2 Número equivocado

Cuando llegue:

```txt
btn_numero_equivocado
```

Acciones:

```sql
UPDATE usuarios
SET Telefono = NULL,
    telefono_verificado_en = NULL
WHERE idusuario = ?;
```

Registrar auditoría:

```txt
accion = NUMERO_EQUIVOCADO
telefono_anterior = teléfono que se limpió
```

No volver a enviar mensajes a ese número para ese usuario.

---

## 18. Reintentos

Estrategia recomendada:

| Intento | Cuándo |
|---|---|
| 1 | Inmediato |
| 2 | +5 minutos |
| 3 | +15 minutos |

Después de 3 intentos:

```txt
estado = FALLIDO
```

y se debe generar alerta para revisión.

Campos usados:

```txt
intentos
proximo_intento_en
ultimo_error
```

---

## 19. Rate limits y límites de WABA

Se debe revisar el límite real de la cuenta WABA antes de producción.

Puntos a validar:

- Nivel de mensajería actual.
- Límite diario de conversaciones o mensajes según configuración vigente.
- Calidad del número.
- Método de pago activo.
- Estado de la cuenta.
- Estado de las plantillas.

No asumir volumen ilimitado. Si la IPS tiene alto volumen de citas, se debe planificar escalamiento del límite con Meta.

---

## 20. Seguridad y privacidad

Reglas obligatorias:

```txt
No enviar datos de cita a teléfonos no verificados.
No incluir nombre del paciente en verificación inicial.
No enviar cédula, diagnóstico ni datos clínicos sensibles por verificación.
No repetir mensajes a números marcados como equivocados.
Registrar auditoría de confirmaciones y teléfonos eliminados.
```

---

## 21. Checklist antes de programar

```txt
[ ] Verificar valor real de agenda.Estado.
[ ] Confirmar joins reales entre agenda y usuarios.
[ ] Confirmar columna real de teléfono: usuarios.Telefono / usuarios.Télefono.
[ ] Confirmar columna real: usuarios.telefono_verificado_en.
[ ] Confirmar que existe opt-in guardado.
[ ] Crear template recordatorio_cita_24h en Meta.
[ ] Crear template verificacion_telefono_paciente en Meta.
[ ] Confirmar método de pago activo en WABA.
[ ] Confirmar webhook activo.
[ ] Crear tabla bot_recordatorio_cita.
[ ] Crear tabla bot_contacto_auditoria.
[ ] Confirmar zona horaria del servidor.
[ ] Definir si se usará UTC o hora Colombia en DB.
[ ] Verificar versión de MySQL para SKIP LOCKED.
[ ] Confirmar volumen diario de citas.
```

---

## 22. Plan de implementación por fases

### Fase 1 — Preparación

```txt
1. Revisar estructura real de tablas.
2. Confirmar estados reales de agenda.
3. Crear plantillas en Meta.
4. Esperar aprobación.
5. Crear tablas bot.
```

### Fase 2 — Programación del recordatorio

```txt
1. Crear cálculo de programado_para.
2. Crear job sincronizador de citas.
3. Crear cron de recordatorios.
4. Implementar bloqueo anti-duplicado.
5. Implementar normalización E.164.
```

### Fase 3 — Integración Meta

```txt
1. Enviar template recordatorio.
2. Enviar template verificación.
3. Guardar meta_message_id.
4. Guardar errores.
5. Manejar reintentos.
```

### Fase 4 — Webhook

```txt
1. Recibir respuesta de botones.
2. Procesar btn_confirmar.
3. Procesar btn_numero_equivocado.
4. Auditar cambios.
5. Enviar recordatorio si el paciente confirma a tiempo.
```

### Fase 5 — Pruebas

```txt
1. Probar cita con teléfono verificado.
2. Probar cita con teléfono no verificado.
3. Probar número equivocado.
4. Probar cron retrasado.
5. Probar reprogramación de cita.
6. Probar cancelación de cita.
7. Probar duplicados.
8. Probar fallo de API Meta.
```

---

## 23. Recomendación final senior

La arquitectura definitiva debe ser:

```txt
recordatorio_programado_para = fecha_hora_cita - 24h
```

y no una consulta directa con rango exacto de 1 minuto.

Los mensajes proactivos deben salir como:

```txt
template aprobada de Meta
```

y no como mensaje libre.

El recordatorio se debe presupuestar como:

```txt
Utility cobrable
```

aunque algunos mensajes puedan no generar costo si están dentro de una ventana válida.

La verificación de teléfono debe ser neutra, sin nombre ni datos del paciente.

La tabla de recordatorios debe tener clave única por:

```txt
agenda_id + tipo_recordatorio + fecha_hora_cita
```

para soportar reprogramaciones.

Además, IPS SISM debe tener:

```txt
auditoría
reintentos
normalización E.164
validación de opt-in
bloqueo anti-duplicado
sincronizador de citas creadas fuera del bot
```

---

## 24. Fuentes oficiales consultadas

- Meta — WhatsApp Business Platform: Message Templates  
  https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview

- Meta — Sending messages / customer service window  
  https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages

- Meta — Interactive reply buttons messages  
  https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages/

- Meta — Interactive message templates  
  https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates/

- WhatsApp Business — Platform Pricing  
  https://whatsappbusiness.com/products/platform-pricing/

- WhatsApp Business — Utility Messages  
  https://whatsappbusiness.com/products/conversation-categories/utility/

- WhatsApp Business — Policy  
  https://whatsappbusiness.com/policy/

- MySQL — InnoDB Locking Reads / SELECT FOR UPDATE / SKIP LOCKED  
  https://dev.mysql.com/doc/refman/8.3/en/innodb-locking-reads.html

- Colombia — Protección de Datos Personales, Ley 1581 de 2012  
  https://www.mincit.gov.co/minindustria/estrategia-transversal/regulacion/proteccion-de-datos-personales
