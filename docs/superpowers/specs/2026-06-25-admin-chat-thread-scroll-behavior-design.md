# Admin Chat Thread Scroll Behavior

Fecha: 2026-06-25  
Estado: Aprobado para plan de implementacion  
Relacion: Complementa `2026-05-28-admin-chats-observability-design.md`

## 1. Objetivo

Corregir el comportamiento del panel derecho del modulo `Chats` para que el historial de mensajes se comporte como un chat operativo moderno y predecible.

El cambio debe garantizar:

1. Al abrir un chat, el panel de mensajes inicia en el mensaje mas reciente.
2. Si el operador esta en la parte inferior y llega un mensaje nuevo, el panel permanece anclado abajo.
3. Si el operador sube manualmente para revisar historial, un mensaje nuevo no debe moverle el scroll.
4. Cuando el operador no esta en el fondo, la interfaz debe mostrar una accion clara para volver rapidamente al ultimo mensaje.
5. Al cargar mensajes anteriores, la posicion visual actual debe preservarse sin saltos.

## 2. Alcance

Incluye:

1. Comportamiento del panel derecho de `Chats`.
2. Capa de datos del thread en el frontend.
3. Deteccion de mensajes nuevos en la pantalla de `Chats`.
4. Estado visual de “anclado al fondo” vs “navegando historial”.
5. Definicion de pruebas para el comportamiento del thread.

No incluye:

1. Cambios de schema, Prisma o base de datos.
2. Cambios en endpoints backend existentes.
3. Cambios de negocio en conversaciones, handoff o auditoria.
4. Virtualizacion de listas como parte obligatoria de esta entrega.
5. Cambios funcionales en `admin-conversations`.

## 3. Contexto actual

El comportamiento actual se arma entre:

1. [apps/web/src/pages/chats-page.tsx](/home/jon/adriana/apps/web/src/pages/chats-page.tsx:16)
2. [apps/web/src/features/chats/ui/chat-thread-panel.tsx](/home/jon/adriana/apps/web/src/features/chats/ui/chat-thread-panel.tsx:22)
3. [apps/web/src/features/chats/chats.hooks.ts](/home/jon/adriana/apps/web/src/features/chats/chats.hooks.ts:23)

Observaciones:

1. El contenedor del thread tiene scroll interno, pero no existe una politica explicita de auto-scroll.
2. El thread usa una query paginada por pagina activa y fusiona resultados manualmente en estado local.
3. La lista de mensajes visible se reconstruye desde `threadItemsDesc` y luego se invierte para render.
4. El stream administrativo invalida queries globalmente, pero no expresa intencion especifica para mantener sincronizada la primera pagina del chat abierto.

Conclusiones:

1. El bug no es solo visual.
2. Existe una deuda de modelado de estado del thread en frontend.
3. El backend actual ya entrega los mensajes recientes primero y no necesita cambios para esta mejora.

## 4. Problema real a resolver

No basta con “hacer scroll abajo al abrir”.

La solucion correcta debe cubrir tres escenarios distintos:

1. Inicializacion del thread:
   - abrir chat
   - cambiar de chat
   - cargar el bloque inicial de mensajes
2. Recepcion de mensajes nuevos:
   - seguir abajo si el operador ya estaba abajo
   - no mover el viewport si el operador estaba revisando historial
3. Navegacion de historial:
   - permitir scroll manual libre
   - cargar mensajes anteriores sin perder el contexto visual
   - ofrecer una CTA para volver al ultimo mensaje

## 5. Decision de arquitectura

Se adopta una solucion de impacto medio y centrada en frontend.

La decision recomendada es:

1. Mantener el backend y la API actuales.
2. Reestructurar la capa de datos del thread en frontend para soportar multiples paginas de mensajes de forma consistente.
3. Encapsular la logica de viewport del panel derecho en una abstraccion dedicada, separada del render del componente.

Razon principal:

1. El contrato backend ya es suficiente.
2. El comportamiento requerido depende del estado del usuario dentro del viewport, no de una regla de negocio del servidor.
3. Resolverlo solo con un `scrollToBottom()` generaria una UX incorrecta y codigo fragil.

## 6. Principios de implementacion

1. Separar datos, comportamiento de scroll y render de UI.
2. Evitar efectos dispersos entre pagina, item renderer y contenedor.
3. Tratar el thread como un flujo con estados explicitos, no como una coleccion sin semantica.
4. No usar `column-reverse`; complica la semantica de scroll y hace mas fragiles los calculos.
5. Mantener archivos pequenos y con una sola responsabilidad.
6. Preservar el contrato actual del backend mientras se mejora el cliente.
7. No introducir logica espagueti basada en multiples booleanos ambiguos.

## 7. Diseño propuesto

## 7.1 Modelo de estado del thread

El panel derecho debe trabajar con dos modos de viewport:

1. `FOLLOW_LATEST`
   - el operador esta anclado al fondo
   - si entra un mensaje nuevo, el thread baja automaticamente
2. `BROWSING_HISTORY`
   - el operador subio manualmente
   - si entra un mensaje nuevo, el thread no debe moverse
   - se muestra una accion para volver al fondo

Este estado no debe inferirse de forma dispersa en varios componentes. Debe vivir en una sola abstraccion dedicada al thread.

## 7.2 Capa de datos del thread

El frontend no debe seguir modelando el historial como “una pagina activa + merge manual”.

Se recomienda:

1. Usar `useInfiniteQuery` para los mensajes del chat seleccionado.
2. Tratar la pagina 1 como la pagina mas reciente.
3. Permitir prepend de paginas antiguas sin recalcular manualmente toda la lista en cada sitio.
4. Derivar la lista renderizable de una estructura de paginas acumuladas, no de dos o tres estados paralelos.

Beneficios:

1. Mejora el manejo de mensajes nuevos cuando ya se cargaron mensajes antiguos.
2. Reduce riesgo de duplicados y estados desalineados.
3. Permite razonar mejor sobre “append reciente” y “prepend historico”.

## 7.2.1 Protocolo de mutaciones del thread

Para evitar una implementacion fragil basada en inferencias indirectas como `messages.length`, el thread debe manejar cambios de datos con un protocolo explicito de mutaciones.

Mutaciones requeridas:

1. `THREAD_RESET`
   - ocurre al abrir el primer chat visible o al cambiar de chat
   - reemplaza por completo el dataset anterior
   - reinicia el estado del viewport a `FOLLOW_LATEST`
   - posiciona el thread en el ultimo mensaje
2. `OLDER_MESSAGES_PREPENDED`
   - ocurre al cargar historial anterior
   - agrega mensajes al inicio de la lista renderizada
   - preserva la posicion visual relativa del operador
   - no cambia el modo actual del viewport
3. `LATEST_MESSAGES_REFRESHED`
   - ocurre cuando se revalida la pagina reciente del chat abierto
   - actualiza la parte mas nueva del dataset sin asumir por defecto que hubo un append puro
   - debe reconciliar por `message.id`, no por longitud del arreglo
   - si aparecen mensajes nuevos y el usuario esta en `FOLLOW_LATEST`, el viewport acompaña
   - si aparecen mensajes nuevos y el usuario esta en `BROWSING_HISTORY`, el viewport no se mueve
4. `LIVE_MESSAGE_APPENDED`
   - representa el caso semantico en el que la reconciliacion detecta uno o mas mensajes nuevos al final cronologico de la conversacion
   - activa auto-follow solo si el usuario ya estaba anclado al fondo
   - incrementa el estado de “hay mensajes nuevos abajo” si el usuario estaba navegando historial

Reglas de reconciliacion:

1. La identidad de un mensaje debe ser `message.id`.
2. La reconciliacion no debe depender de `messages.length` como criterio principal.
3. El merge de mensajes debe ser deterministico y estable frente a re-fetches parciales.
4. El hook de viewport debe recibir el tipo de mutacion resuelta, no deducirla indirectamente desde el DOM o desde diferencias ambiguas de arrays.

## 7.3 Control de viewport

La logica del scroll debe vivir en un hook dedicado, por ejemplo:

1. `useChatThreadViewport`

Responsabilidades de ese hook:

1. Exponer `containerRef`.
2. Calcular si el usuario esta “cerca del fondo” con un umbral controlado.
3. Cambiar entre `FOLLOW_LATEST` y `BROWSING_HISTORY`.
4. Ejecutar `scrollToLatest`.
5. Preservar posicion al cargar mensajes anteriores.
6. Exponer `showJumpToLatest`.
7. Exponer contador o marca de mensajes nuevos no vistos, si se desea en esta entrega o en una siguiente.
8. Consumir un tipo de mutacion del thread ya resuelto por la capa de datos.

Responsabilidades que no debe asumir:

1. Formateo de mensajes.
2. Render de bubbles.
3. Obtencion HTTP directa.

## 7.4 Comportamientos obligatorios

### Apertura y cambio de chat

1. Al abrir el modulo con un chat seleccionado automaticamente, el viewport debe iniciar abajo.
2. Al cambiar de chat manualmente, el viewport debe reiniciarse abajo.
3. El estado de “navegando historial” no debe heredarse entre chats distintos.

### Mensaje nuevo

1. Si el operador esta abajo:
   - el mensaje entra
   - el viewport sigue abajo
2. Si el operador esta arriba:
   - el mensaje entra en la data del thread
   - el viewport no se mueve
   - aparece o se mantiene visible la CTA para volver al ultimo mensaje

### Cargar mensajes anteriores

1. Al prepend de mensajes antiguos, el sistema debe preservar la referencia visual actual.
2. El operador debe seguir viendo aproximadamente el mismo mensaje que estaba observando antes de la carga.

## 7.5 UI del panel derecho

El `ChatThreadPanel` debe seguir siendo principalmente presentacional.

Debe renderizar:

1. Cabecera del chat.
2. Contenedor scrollable del historial.
3. Boton “Cargar mensajes anteriores”.
4. CTA flotante o fija de “Ir al ultimo mensaje”.

La CTA recomendada:

1. Boton flotante en la esquina inferior derecha del panel.
2. Visible solo cuando el usuario no esta anclado al fondo.
3. Accesible por teclado y con `aria-label` explicito.

No es necesario replicar pixel-perfect WhatsApp Web. Lo importante es adoptar el mismo principio UX:

1. auto-follow condicional
2. no pelear con el usuario si esta leyendo historial
3. acceso rapido para regresar al fondo

## 7.6 Integracion con eventos en tiempo real

La pantalla de `Chats` ya recibe invalidaciones desde el stream administrativo:

1. [apps/web/src/features/overview/use-admin-stream.ts](/home/jon/adriana/apps/web/src/features/overview/use-admin-stream.ts:81)

El cambio recomendado no requiere alterar el contrato del stream, pero si requiere que la pagina de chats consuma los mensajes con una estrategia mas robusta.

Eso implica:

1. cuando se invalide la query del chat abierto, el frontend debe ser capaz de incorporar el mensaje nuevo al conjunto visible
2. si el usuario estaba abajo, el viewport acompaña
3. si no lo estaba, se mantiene inmovil
4. la revalidacion debe convertirse primero en una mutacion explicita del thread antes de afectar el viewport

## 8. Impacto

## 8.1 Impacto tecnico

Impacto estimado: medio.

Impacto por capa:

1. Frontend UI: alto
2. Frontend state/data: alto
3. Backend API: nulo o casi nulo
4. Persistencia: nulo
5. Auditoria: nulo

La mayor complejidad no esta en pintar un boton, sino en modelar correctamente:

1. mensajes recientes
2. historial cargado progresivamente
3. estado de anclaje del usuario

## 8.2 Modulos afectados

Afectados:

1. `apps/web/src/pages/chats-page.tsx`
2. `apps/web/src/features/chats/chats.hooks.ts`
3. `apps/web/src/features/chats/ui/chat-thread-panel.tsx`
4. nuevos archivos frontend para hook o utilidades del thread

No afectados:

1. `src/modules/admin-chats/*`
2. `src/modules/admin-conversations/*`
3. `packages/shared/*`
4. Prisma y MySQL

## 8.3 Riesgos

Riesgo 1: parche superficial que auto-scrollea siempre  
Control:

1. modelar explicitamente `FOLLOW_LATEST` y `BROWSING_HISTORY`
2. cubrir el caso de scroll manual hacia arriba

Riesgo 2: mensajes nuevos no visibles cuando hay paginas antiguas cargadas  
Control:

1. reemplazar la estrategia de merge manual por una estrategia acumulativa mas estable
2. mantener siempre sincronizada la pagina mas reciente del chat abierto
3. formalizar las mutaciones `THREAD_RESET`, `OLDER_MESSAGES_PREPENDED`, `LATEST_MESSAGES_REFRESHED` y `LIVE_MESSAGE_APPENDED`

Riesgo 3: saltos visuales al cargar historial  
Control:

1. medir `scrollHeight` y `scrollTop` antes del prepend
2. restaurar offset relativo despues del render

Riesgo 4: logica dificil de mantener  
Control:

1. encapsular viewport en hook dedicado
2. mantener `ChatThreadPanel` como componente presentacional
3. evitar efectos cruzados en multiples componentes

Riesgo 5: falta de cobertura automatizada en frontend  
Control:

1. introducir pruebas automatizadas de componente en `apps/web`
2. complementar con validacion manual solo como verificacion final, no como estrategia principal

## 8.4 Estrategia de testing aprobada

La estrategia de testing deja de ser opcional.

Decision:

1. Introducir pruebas de componente para `apps/web` usando tooling nativo al stack Vite.
2. La recomendacion es `Vitest` + `@testing-library/react` + `@testing-library/user-event`.
3. Estas dependencias deben quedar aisladas al workspace `apps/web`.
4. No se deben introducir cambios en el runner de pruebas del backend ni en los modulos Nest para resolver este requerimiento.

Razon:

1. El comportamiento a validar es de interaccion y viewport de React.
2. Este tipo de flujo es mas estable y mas economico de probar en componente que solo con e2e manual.
3. Limitar el tooling a `apps/web` evita dañar otros modulos o mezclar pipelines de backend y frontend.

## 9. Referencia de buenas practicas externas

No se identifico una documentacion oficial publica de WhatsApp Web que describa su algoritmo exacto de auto-scroll al 2026-06-25.

La recomendacion se apoya en patrones estables de interfaces de chat modernas:

1. React `useLayoutEffect` para sincronizacion visual previa al repaint.
2. MDN `scrollTop` y `scrollHeight` para control fino del viewport.
3. Patrones de message lists modernas como `auto-scroll-to-bottom` condicional y `prepend` con preservacion de posicion.

Referencias:

1. React `useLayoutEffect`: https://react.dev/reference/react/useLayoutEffect
2. MDN `scrollTop`: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop
3. MDN `scrollHeight`: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
4. React Virtuoso scroll modifiers: https://virtuoso.dev/virtuoso-message-list/scroll-modifier/
5. Stream chat infinite scroll best practices: https://getstream.io/chat/docs/sdk/react/guides/channel-list-infinite-scroll/

## 10. Criterios de aceptacion

1. Abrir un chat posiciona el panel derecho en el mensaje mas reciente.
2. Cambiar de chat posiciona el panel derecho en el mensaje mas reciente.
3. Si llega un mensaje nuevo y el operador esta abajo, el panel sigue abajo.
4. Si llega un mensaje nuevo y el operador esta arriba, el panel no se mueve.
5. Cuando el operador no esta abajo, existe una accion visible para regresar al ultimo mensaje.
6. Al cargar mensajes anteriores, la posicion visual se conserva sin saltos.
7. La implementacion mantiene responsabilidades separadas entre datos, viewport y render.
8. No se introducen cambios en backend ni persistencia para resolver este requerimiento.
9. Las reglas de mutacion del thread estan explicitamente modeladas y cubiertas por pruebas automatizadas.

## 11. Estrategia recomendada

Implementar este cambio como una mejora de arquitectura frontend del thread de `Chats`, no como un parche puntual de DOM.

Esa decision:

1. resuelve el bug visible actual
2. cubre el comportamiento esperado de tiempo real
3. evita regresiones cuando el operador navega historial
4. deja una base mantenible para futuras mejoras como contador de mensajes nuevos, anclas no leidas o virtualizacion
