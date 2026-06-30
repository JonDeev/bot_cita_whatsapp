# Snapshot visible de mensajes plantilla en observabilidad

Fecha: 2026-06-26  
Estado: Aprobado para plan de implementacion  
Relacion:

- ajusta `2026-05-28-admin-chats-observability-design.md`
- preserva `admin-conversations` como vista tecnica
- complementa `2026-05-25-appointment-reminders-design.md`
- complementa `2026-05-07-satisfaction-surveys-design.md`

## 1. Objetivo

Resolver el problema actual de observabilidad donde los mensajes outbound enviados como `template` se muestran en paneles administrativos como `template:<nombre>` en lugar del contenido real que vio el paciente en WhatsApp.

El cambio debe:

1. mostrar en `Chats` y `Conversations` el texto final visible del template enviado
2. mantener intactos los flujos de mensajeria del paciente
3. no introducir regresiones en otros modulos administrativos
4. preservar trazabilidad tecnica y auditoria del envio
5. evitar una solucion con alto blast radius en contratos, persistencia o UI

## 2. Alcance

Incluye:

1. mensajes outbound `messageType = template`
2. persistencia de snapshot visible del template en `bot_messages`
3. persistencia de snapshot tecnico complementario en `bot_messages.payload`
4. cobertura para las tres plantillas activas actuales:
   - `recordatorio_cita_24h`
   - `verificacion_telefono_paciente`
   - `satisfaction_survey_flow`
5. ajustes de diseño para que `Chats` y `Conversations` muestren el contenido real usando el contrato actual basado en `body`
6. estrategia de rollout sin romper historicos ni otros modulos

No incluye:

1. cambios en el contenido de negocio de las plantillas aprobadas en Meta
2. cambios en la UX del paciente dentro de WhatsApp
3. rediseño de `admin-chats` o `admin-conversations`
4. una tabla nueva tipo `bot_template_messages` en fase 1
5. reconstruccion forzada o completa de historicos ya enviados
6. render enriquecido obligatorio de botones o CTA en fase 1

## 3. Problema actual

## 3.1 Comportamiento observado

Hoy el sistema persiste para templates un valor tecnico como:

```txt
template:recordatorio_cita_24h
```

Ese valor termina siendo mostrado por las vistas administrativas como si fuera el contenido visible del mensaje.

Consecuencias:

1. el operador no ve el mismo mensaje que vio el paciente
2. la observabilidad funcional de chat queda degradada
3. los templates pierden legibilidad operacional
4. se obliga a inspeccionar `payload` o a inferir mentalmente el texto real

## 3.2 Causa de arquitectura

La causa principal no es de frontend. El problema es de contrato de persistencia:

1. `body` ya es la fuente transversal de contenido visible para UI y DTOs admin
2. para mensajes `text` e `interactive`, `body` contiene contenido util
3. para mensajes `template`, `body` guarda un identificador tecnico y no el snapshot visible

Conclusion:

1. el cambio correcto debe ocurrir en backend al momento de persistir el outbound template
2. no es buena practica reconstruir el mensaje real en frontend

## 4. Decision de arquitectura

Se adopta la opcion A como solucion recomendada:

1. generar en backend un snapshot visible del template al momento del envio
2. guardar ese snapshot visible en `bot_messages.body`
3. guardar el snapshot tecnico en `bot_messages.payload`
4. mantener `body` como contrato actual de visualizacion para `Chats` y `Conversations`

Se descartan en fase 1:

1. agregar un nuevo contrato principal `renderedBody`
2. crear una tabla dedicada tipo `bot_template_messages`
3. reconstruir el texto visible desde frontend

Razon principal:

1. `body` ya es el contrato semantico de contenido visible en el sistema admin
2. reutilizarlo reduce cambios en DTOs, repositorios, masking y UI
3. el cambio queda confinado al flujo de persistencia de outbound templates
4. la UI empieza a mostrar el mensaje real casi sin cambios

## 5. Principios de implementacion

1. Backend como fuente de verdad del snapshot visible.
2. Persistencia inmutable del contenido mostrado al paciente.
3. Cero impacto en el contenido entregado a Meta.
4. Cambios aditivos y acotados por modulo.
5. Responsabilidades claras: render visible en backend, presentacion simple en frontend.
6. Sin codigo espagueti ni logica duplicada por template en multiples capas.
7. Soporte para crecimiento futuro sin rehacer el contrato base.

## 6. Contrato recomendado

## 6.1 `bot_messages.body`

Para `messageType = template`, `body` debe almacenar el texto visible final del mensaje enviado.

Ejemplos:

1. `recordatorio_cita_24h`
   - el texto completo del recordatorio con sus variables sustituidas
2. `verificacion_telefono_paciente`
   - el texto completo de verificacion con el nombre resuelto si aplica
3. `satisfaction_survey_flow`
   - el texto visible principal del template de encuesta

No debe almacenar:

1. `template:<nombre>`
2. ids internos
3. placeholders sin resolver tipo `{{1}}`

## 6.2 `bot_messages.payload`

Para `messageType = template`, `payload` debe conservar el detalle tecnico necesario para auditoria y futura UI enriquecida.

Campos recomendados:

1. `kind = template_snapshot`
2. `templateName`
3. `templateLanguageCode`
4. `templateVariant`
5. `bodyTextParameters`
6. `visibleButtons`
7. `flowMetadata` cuando aplique
8. `snapshotVersion`
9. `renderedHash`
10. `transport`
    - `to`
    - `messageType`
    - `whatsappMessageId` si ya existe al persistir

`payload` no debe duplicar el texto visible completo ya guardado en `body`.

Razon principal:

1. `body` ya resuelve legibilidad transversal y compatibilidad con UI
2. duplicar el mismo contenido visible en `payload` aumenta exposicion de datos y complejidad de masking sin aportar valor fuerte en fase 1
3. el snapshot tecnico debe centrarse en metadata operativa, no en repetir el cuerpo completo

## 6.3 No cambiar el contrato principal en fase 1

No se recomienda introducir en esta fase:

1. `renderedBody` en DTOs compartidos
2. `templateSnapshot` como dependencia obligatoria del frontend
3. nuevos campos que obliguen a migrar todas las vistas admin

## 7. Templates cubiertos

## 7.1 `recordatorio_cita_24h`

Regla:

1. `body` debe contener el texto final del recordatorio con nombre, tipo de cita, fecha, hora, profesional, ciudad, modalidad y direccion ya resueltos

`payload` debe conservar:

1. `templateName = recordatorio_cita_24h`
2. parametros usados para el render
3. `snapshotVersion`
4. hash del resultado

## 7.2 `verificacion_telefono_paciente`

Regla:

1. `body` debe contener el texto visible de verificacion

`payload` debe conservar:

1. `templateName = verificacion_telefono_paciente`
2. parametros usados
3. botones visibles:
   - `Confirmar`
   - `No lo reconozco`
4. payloads tecnicos de quick reply cuando aplique

## 7.3 `satisfaction_survey_flow`

Regla:

1. `body` debe contener el texto visible del template inicial de encuesta

`payload` debe conservar:

1. `templateName = satisfaction_survey_flow`
2. parametros usados
3. CTA visible del flow
4. `buttonIndex`
5. metadata operativa no sensible del flow

No debe conservar:

1. `flowToken` crudo
2. secretos, tokens temporales ni identificadores que no sean necesarios para observabilidad funcional

Si se requiere correlacion forense con el despacho o el envio real, debe reutilizarse:

1. `dispatchId`
2. `conversationKey`
3. `whatsappMessageId`
4. ids de despacho o persistencia ya existentes en sus modulos origen

Nota:

1. en fase 1 el panel no necesita renderizar el CTA visualmente para considerarse correcto
2. basta con mostrar el texto real en `body` y conservar el CTA en `payload`

## 8. Arquitectura propuesta

## 8.1 Servicio central de snapshot

Se recomienda introducir un servicio backend dedicado a construir snapshots visibles de templates.

Responsabilidades:

1. recibir identificador de template + parametros visibles
2. generar `visibleBody`
3. generar metadata visible complementaria
4. producir un snapshot consistente y versionable

No debe:

1. llamar a Meta
2. persistir directamente
3. decidir politicas de masking

## 8.2 Puntos de integracion

El snapshot debe construirse antes de `saveOutbound` en los flujos que hoy envian templates:

1. reminders
2. survey phone verification
3. survey flow invitation

La persistencia de `saveOutbound` debe seguir siendo el punto unico de almacenamiento de `bot_messages`.

## 8.3 Boundary correcta

La solucion debe quedar repartida asi:

1. use case de envio
   - resuelve datos de negocio
   - invoca renderer de snapshot
2. repositorio de mensajes
   - persiste `body` y `payload`
3. UI admin
   - sigue leyendo `body`

Esto evita:

1. duplicar reglas de render en frontend
2. meter logica de template dentro del repositorio
3. repartir strings o placeholders en multiples capas

## 8.4 Gobernanza del copy y anti-drift

El renderer interno de snapshot y el copy aprobado en Meta deben mantenerse sincronizados como una sola capacidad gobernada.

Reglas cerradas:

1. cualquier cambio en el texto visible de una plantilla aprobada en Meta requiere actualizar el renderer backend correspondiente
2. cualquier cambio visible en el renderer requiere actualizar fixtures de prueba y `snapshotVersion`
3. no se permite cambiar copy en Meta para plantillas observadas por snapshot sin una actualizacion coordinada en codigo
4. el renderer backend debe considerarse parte del contrato de observabilidad de la plantilla

Controles recomendados:

1. un renderer pequeno y explicito por plantilla o familia de plantilla
2. fixtures por template con texto esperado
3. `snapshotVersion` como version logica del render persistido
4. checklist de cambio en PR para modificaciones de templates observadas

## 9. Compatibilidad y no regresion

## 9.1 Flujos del paciente

No cambia:

1. el payload enviado a Meta
2. la seleccion de template
3. la sustitucion de parametros en transporte
4. la experiencia del paciente en WhatsApp

## 9.2 Modulos administrativos

No debe cambiar comportamiento en:

1. `admin-reminders`
2. `admin-surveys`
3. `admin-logs`
4. `admin-overview`

Excepto donde esos modulos lean `bot_messages.body` con mensajes tipo template, en cuyo caso la mejora debe ser solo de legibilidad, no funcional.

## 9.3 Historicos

Los mensajes ya persistidos con `template:<nombre>` permanecen como historico legado.

Regla:

1. no bloquear despliegue por backfill historico
2. cualquier backfill debe ser opcional, acotado y `best effort`
3. la fuente de verdad robusta empieza desde el momento en que se implemente el snapshot

## 10. Seguridad y datos sensibles

1. `body` sigue siendo sujeto de masking por rol como hoy.
2. `payload` tecnico sigue expuesto solo donde la policy actual ya lo permite.
3. no deben guardarse datos clinicos adicionales fuera de los que la plantilla ya expone al paciente.
4. el snapshot no debe introducir secretos, tokens de sistema, `flowToken` crudo ni payloads innecesarios.
5. si se conserva metadata de flow o quick reply, debe seguir el mismo estandar de acceso actual para `ADMIN` vs `SUPERVISOR`.

## 11. Riesgos y controles

Riesgo 1: duplicar logica de render por template en multiples use cases  
Control:

1. servicio central de snapshot
2. tests por template y por version

Riesgo 2: romper vistas existentes por tocar contratos compartidos  
Control:

1. no introducir `renderedBody` como contrato principal en fase 1
2. reutilizar `body`

Riesgo 3: persistir contenido visible inconsistente con la plantilla real  
Control:

1. snapshot generado desde la misma data visible usada en el envio
2. versionado de snapshot
3. tests con fixtures por template

Riesgo 4: intentar corregir todo el historico y generar alto impacto  
Control:

1. no hacer del backfill un prerequisito
2. limitar cualquier backfill a un follow-up opcional

## 12. Criterios de aceptacion

1. Un mensaje template nuevo ya no aparece como `template:<nombre>` en `Chats`.
2. Un mensaje template nuevo ya no aparece como `template:<nombre>` en `Conversations`.
3. `body` muestra el texto real que vio el paciente.
4. `payload` conserva el snapshot tecnico auditable.
5. Los mensajes `text` e `interactive` mantienen comportamiento actual.
6. El envio a Meta no cambia semantica ni payload de transporte.
7. No se introducen tablas nuevas ni cambios de contrato innecesarios en fase 1.
8. El codigo resultante mantiene responsabilidades claras, bajo acoplamiento y pruebas modulares.

## 13. Estrategia recomendada

Implementar esta solucion como una mejora de persistencia y observabilidad de outbound templates, no como un rediseño general del sistema de mensajeria admin.

La estrategia recomendada es:

1. usar `body` como snapshot visible
2. usar `payload` como snapshot tecnico
3. centralizar el render en backend
4. dejar historicos como legado
5. posponer cualquier enriquecimiento visual del panel a una fase 2 opcional

Esta decision:

1. resuelve el problema real con bajo traumatismo
2. conserva la arquitectura actual
3. reduce el riesgo sobre otros modulos
4. deja una base limpia y mantenible para futuras mejoras
