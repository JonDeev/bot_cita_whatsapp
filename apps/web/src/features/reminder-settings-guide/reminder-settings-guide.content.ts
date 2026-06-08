import type { ReminderSettingsGuideSectionContent } from './reminder-settings-guide.types';

export const reminderSettingsGuideSections: ReminderSettingsGuideSectionContent[] = [
  {
    id: 'que-controla-esta-pantalla',
    title: 'Que controla esta pantalla',
    summary:
      'La vista centraliza los controles operativos de recordatorios, el estado efectivo y la trazabilidad de cambios.',
    paragraphs: [
      'Esta pantalla permite revisar la configuracion runtime de recordatorios sin entrar al backend ni reiniciar manualmente el sistema.',
      'Aqui se distinguen tres areas de trabajo: Operacion para observar despachos, Configuracion para revisar valores almacenados y Guia de uso para entender como operar con seguridad.',
    ],
    bullets: [
      'Los valores de la pantalla vienen del panel administrativo y del catalogo de opciones permitido por el backend.',
      'Los cambios se auditan con version, actor y razon cuando corresponde.',
      'Los campos protegidos se guardan, pero su aplicacion efectiva depende de un reinicio controlado.',
    ],
  },
  {
    id: 'estados-operativos-y-modos-de-envio',
    title: 'Estados operativos y modos de envio',
    summary:
      'El modo de envio define si la plataforma simula el flujo o si envia recordatorios reales por WhatsApp.',
    paragraphs: [
      'Mock significa que el sistema se comporta como si procesara recordatorios, pero sin enviar mensajes reales a pacientes.',
      'Live significa que el sistema puede enviar recordatorios reales si el rollout, la elegibilidad y la pausa de emergencia lo permiten.',
    ],
    referenceRows: [
      {
        field: 'Modo de envio',
        meaning: 'Indica si el envio real esta permitido o si la operacion se mantiene en prueba.',
      },
      {
        field: 'Porcentaje de rollout',
        meaning: 'Define que fraccion de pacientes elegibles participa en el envio real.',
      },
      {
        field: 'Pausa de emergencia',
        meaning: 'Sobrescribe el envio real para frenar la salida sin destruir el estado almacenado.',
      },
    ],
  },
  {
    id: 'como-activar-reminders-de-forma-segura',
    title: 'Como activar reminders de forma segura',
    summary:
      'El encendido progresivo reduce riesgo operativo y facilita validar la salud del flujo antes de abrirlo por completo.',
    paragraphs: [
      'Para una activacion segura, primero valida que la configuracion esta en mock y que el historial reciente no muestra incidentes.',
      'Luego eleva el rollout por escalones pequenos, revisando los despachos, la latencia y las posibles fallas en cada paso.',
    ],
    bullets: [
      'Empieza con rollout bajo y monitorea los despachos recientes.',
      'Sube el porcentaje solo despues de confirmar que los mensajes salen correctamente.',
      'Mantente atento a pausas de emergencia o errores repetidos en el historial.',
    ],
    callout: {
      tone: 'warning',
      title: 'Regla de prudencia',
      body: 'Nunca pases a live con rollout alto sin revisar primero el comportamiento en un tramo pequeño de pacientes elegibles.',
    },
  },
  {
    id: 'como-usar-pausa-de-emergencia',
    title: 'Como usar pausa de emergencia',
    summary:
      'La pausa detiene el envio real sin borrar la configuracion ni perder la trazabilidad del cambio.',
    paragraphs: [
      'La pausa de emergencia se usa cuando necesitas detener envios reales de forma inmediata mientras investigas un incidente operacional.',
      'No deshace cambios previos ni borra el estado almacenado: solo bloquea la emision efectiva de nuevos mensajes reales.',
    ],
    bullets: [
      'Activa la pausa cuando exista un incidente que requiera detener envios reales.',
      'Documenta siempre el motivo de la accion.',
      'Levanta la pausa solo cuando el flujo vuelva a ser seguro.',
    ],
    callout: {
      tone: 'warning',
      title: 'Lo que no hace',
      body: 'La pausa no corrige datos, no revierte historias y no reemplaza una investigacion del incidente.',
    },
  },
  {
    id: 'referencia-de-campos',
    title: 'Referencia de campos',
    summary:
      'Cada campo usa una lista cerrada de valores. No hay entrada libre en esta fase.',
    paragraphs: [
      'Consulta los nombres exactos que aparecen en la pantalla de configuracion y su significado operativo.',
    ],
    referenceRows: [
      { field: 'sendMode', meaning: 'mock o live.' },
      { field: 'sendRolloutPercent', meaning: '0, 5, 10, 25, 50, 75 o 100.' },
      { field: 'dispatchBatchSize', meaning: '10, 25, 50 o 100.' },
      { field: 'eligibilityLimit', meaning: '100, 250, 500 o 1000.' },
      { field: 'syncEnabled', meaning: 'enabled o disabled, solo con reinicio controlado.' },
      { field: 'lockTtlSeconds', meaning: '120, 180, 300 o 600.' },
      {
        field: 'minConfirmationHours',
        meaning: '3, 4, 6 o 12 horas antes de la cita.',
      },
    ],
  },
  {
    id: 'buenas-practicas-operativas',
    title: 'Buenas practicas operativas',
    summary:
      'Las decisiones operativas deben ser graduales, trazables y faciles de revisar.',
    paragraphs: [
      'Mantener cambios pequenos y frecuentes es mas seguro que mover varias palancas al mismo tiempo.',
      'Cuando ajustes un parametro, revisa el historial y confirma que el cambio corresponde a una razon operacional valida.',
    ],
    bullets: [
      'Usa mock para validar la forma del flujo antes de enviar mensajes reales.',
      'Aumenta rollout con observacion activa.',
      'No toques campos protegidos sin ventana de cambio y reinicio controlado.',
    ],
  },
  {
    id: 'errores-comunes-y-que-hacer',
    title: 'Errores comunes y que hacer',
    summary:
      'La mayoria de incidentes operativos se detectan rapido si miras el estado efectivo y el historial reciente.',
    paragraphs: [
      'Si el envio no coincide con lo esperado, revisa primero si la pausa de emergencia esta activa.',
      'Despues valida el modo de envio, el rollout y el ultimo cambio registrado en el historial.',
    ],
    bullets: [
      'Si el banner indica Pausado, la causa casi siempre es la pausa de emergencia.',
      'Si un campo protegido no parece cambiar en caliente, recuerda que requiere reinicio controlado.',
      'Si el historial no muestra el cambio esperado, puede existir un conflicto de version o una actualizacion fallida.',
    ],
  },
  {
    id: 'como-auditar-cambios',
    title: 'Como auditar cambios',
    summary:
      'Cada mutacion debe poder rastrearse desde la version anterior hasta la nueva con un actor identificado.',
    paragraphs: [
      'La auditabilidad es una parte central de la operacion. Cada cambio relevante deja version, fecha, actor, razon y estado anterior/nuevo.',
      'La pantalla de historial facilita verificar por que se hizo un ajuste y quien lo ejecutó.',
    ],
    bullets: [
      'Revisa la version actual antes y despues de cada ajuste.',
      'Confirma el motivo cuando el cambio afecta campos protegidos o la pausa de emergencia.',
      'Usa el historial para reconstruir el contexto de incidentes y cambios operativos.',
    ],
  },
];
