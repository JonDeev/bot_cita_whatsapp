# Admin Chats Full Phone Visibility

Fecha: 2026-06-25  
Estado: Aprobado para plan de implementacion  
Relacion: Ajusta `2026-05-28-admin-chats-observability-design.md` sin reemplazar `admin-conversations`

## 1. Objetivo

Mostrar el numero celular completo del participante en todo el modulo `Chats` del panel administrativo, sin enmascaramiento y sin diferenciar por rol entre `ADMIN` y `SUPERVISOR`.

El cambio debe:

1. Mantener intacto el comportamiento de otros modulos administrativos.
2. Evitar cambios en persistencia o migraciones.
3. Mantener responsabilidades claras entre dominio, mapeo de respuesta y seguridad.
4. Reducir acoplamiento entre `admin-chats` y `admin-conversations`.

## 2. Alcance

Incluye:

1. Listado de chats (`GET /api/admin/chats`).
2. Detalle de chat (`GET /api/admin/chats/:id`).
3. Frontend del modulo `Chats` que renderiza telefono en sidebar y cabecera del hilo.
4. Contratos compartidos del modulo `Chats`.
5. Refactor limitado para que `admin-chats` deje de depender del tipo enmascarado de `admin-conversations`.

No incluye:

1. Cambios en `admin-conversations`.
2. Cambios en `admin-reminders`, `admin-surveys` o `admin-logs`.
3. Cambios en masking de mensajes o payload tecnico.
4. Cambios en base de datos, Prisma o migraciones.
5. Nuevos permisos o nuevos roles.

## 3. Contexto actual

El numero completo ya existe en persistencia:

1. `BotConversation.participantPhone` en `bot_conversations.participant_phone`.

El enmascaramiento ocurre en la capa de respuesta:

1. `AdminConversationsMaskingService` transforma `participantPhone` a `participantPhoneMasked`.
2. `admin-chats` hoy reutiliza esa salida enmascarada para lista y detalle.
3. El frontend solo renderiza el valor recibido y no aplica masking propio.

Conclusión:

1. El problema no es de almacenamiento.
2. El cambio correcto es de contrato y mapeo de respuesta, no de base de datos.

## 4. Decision de arquitectura

Se adopta la opcion A:

1. Exponer un campo explicito `participantPhone` en el contrato de `admin-chats`.
2. Mantener `admin-conversations` sin cambios.
3. Hacer que `admin-chats` mapee lista y detalle desde el dominio crudo, sin pasar por el masking compartido de conversaciones.

Razon principal:

1. `admin-chats` y `admin-conversations` tienen objetivos diferentes.
2. El masking compartido de conversaciones no debe convertirse en una dependencia estructural del contrato de chats.
3. El nombre `participantPhoneMasked` no debe reutilizarse para enviar un valor completo porque genera semantica engañosa.

## 5. Principios de implementacion

1. Contratos con nombres semanticos correctos.
2. Cambios aditivos antes de limpieza cuando eso reduzca riesgo de despliegue.
3. Mappers especificos por modulo; sin reutilizar servicios de otro modulo cuando la semantica diverge.
4. Use cases delgados; sin logica de presentacion compleja dentro del controlador.
5. Sin condicionamiento por rol para el telefono en `admin-chats`.
6. Mantener masking por rol solo donde todavia aplica: cuerpos de mensaje y payload tecnico.

## 6. Diseño propuesto

## 6.1 Contrato compartido

El modulo `Chats` debe exponer telefono completo con un campo nuevo:

1. `participantPhone: string`

Para minimizar riesgo en un rollout interno, se recomienda una transicion en dos fases:

1. Fase 1:
   - agregar `participantPhone`
   - mantener `participantPhoneMasked` temporalmente como campo de compatibilidad
   - marcarlo como deprecado en comentario del DTO
2. Fase 2:
   - migrar frontend a `participantPhone`
   - eliminar `participantPhoneMasked` del contrato de `Chats`

Si frontend y backend se despliegan siempre de forma atomica dentro del monorepo, la fase 2 puede ejecutarse en la misma entrega. Aun asi, el diseño mantiene la transicion explicita porque reduce riesgo y deja trazabilidad del cambio.

## 6.2 Backend `admin-chats`

Lista y detalle de chats:

1. Deben leer `participantPhone` completo desde el repositorio.
2. Deben mapear a DTO de chats sin pasar por `AdminConversationsMaskingService`.

Mensajes del chat:

1. No requieren exponer telefono.
2. Pueden seguir reutilizando la logica actual de masking para `body` y `payload` segun rol.

Refactor de acoplamiento:

1. `AdminChatsMapperService` no debe depender de tipos de salida del masking service de `admin-conversations`.
2. Debe depender de tipos de dominio de conversaciones o de tipos propios de `admin-chats`.

## 6.3 Frontend `Chats`

La UI debe renderizar:

1. `participantPhone` en la lista de chats.
2. `participantPhone` en la cabecera del hilo.

La pagina `ChatsPage` no requiere cambios de flujo, paginacion ni seleccion de chat.

## 6.4 Seguridad

No cambia el modelo de acceso:

1. `ADMIN` y `SUPERVISOR` mantienen acceso al modulo `Chats`.
2. Ambos veran telefono completo en este modulo.

No cambia:

1. ocultamiento de payload tecnico para `SUPERVISOR`
2. restricciones del modulo `admin-conversations`
3. auditoria de acceso actual

## 7. Impacto y analisis de riesgo

## 7.1 Impacto tecnico

Impacto estimado: medio y acotado.

Componentes afectados:

1. `packages/shared/src/admin/chats-dto.ts`
2. `src/modules/admin-chats/application/use-cases/*`
3. `src/modules/admin-chats/application/services/admin-chats-mapper.service.ts`
4. `apps/web/src/features/chats/*`
5. tests del modulo `admin-chats`

Componentes no afectados:

1. `prisma/bot/schema.prisma`
2. repositorios MySQL de conversaciones
3. `admin-conversations` endpoints y UI
4. modulos administrativos no relacionados

## 7.2 Riesgos

Riesgo 1: romper el front de chats por cambio de contrato  
Control:

1. rollout aditivo con `participantPhone`
2. migracion del frontend en la misma entrega
3. cleanup del campo deprecado solo al final

Riesgo 2: romper `admin-conversations` por tocar servicio compartido  
Control:

1. no cambiar `AdminConversationsMaskingService` para lista/detalle de conversaciones
2. aislar el cambio dentro de `admin-chats`

Riesgo 3: aumentar acoplamiento entre modulos  
Control:

1. eliminar dependencia del mapper de chats a tipos enmascarados de conversaciones
2. usar nombres explicitos y responsabilidad por modulo

Riesgo 4: mayor exposicion de PII en `Chats`  
Control:

1. mantener autenticacion, RBAC y auditoria existentes
2. limitar el cambio al modulo solicitado
3. no expandir esta decision a otros modulos sin requerimiento explicito

## 8. Criterios de aceptacion

1. El sidebar de `Chats` muestra telefono completo.
2. La cabecera del hilo de `Chats` muestra telefono completo.
3. `ADMIN` y `SUPERVISOR` observan el mismo telefono completo en `Chats`.
4. `admin-conversations` sigue mostrando telefonos enmascarados como hoy.
5. No hay migraciones ni cambios de esquema.
6. El codigo resultante conserva archivos pequeños, contratos claros y bajo acoplamiento.
7. Los tests del modulo afectado cubren lista, detalle y contrato.

## 9. Estrategia recomendada

Implementar este cambio como un ajuste de contrato de `admin-chats` con aislamiento modular, no como una alteracion global del policy de masking.

Esa decision:

1. satisface el requerimiento funcional
2. evita regresiones en otros modulos
3. mantiene semantica correcta en nombres y responsabilidades
4. deja una base mas limpia para futuros cambios de visibilidad por modulo
