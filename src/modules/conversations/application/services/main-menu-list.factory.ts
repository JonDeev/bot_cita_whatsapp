import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';

@Injectable()
export class MainMenuListFactory {
  build(): ConversationOutboundInteractiveListMessage {
    return {
      type: 'interactive_list',
      body: [
        '👋🏻 ¡Hola! Soy *ADRIANA*, tu asistente virtual de 🏥 *IPS SISM*.',
        '',
        'Al continuar, aceptas nuestra Política de Tratamiento de Datos Personales 👉 https://www.sism.com.co/static/media/politica-tt-datos.74a2dad6.pdf',
        '',
        'Seleccione una opción en la lista ⬇️',
      ].join('\n'),
      buttonText: 'Ver opciones',
      sections: [
        {
          title: 'Menú principal',
          rows: [
            {
              id: 'main_menu_request_appointment',
              title: '⚕️ Solicitar cita',
              description: 'Agendar una nueva cita',
            },
            {
              id: 'main_menu_check_appointments',
              title: '🔍 Consultar citas',
              description: 'Ver citas ya programadas',
            },
            {
              id: 'main_menu_cancel_or_reschedule',
              title: '⚠️ Mover o cancelar',
              description: 'Cancelar o reprogramar una cita',
            },
            {
              id: 'main_menu_update_contact',
              title: '📝 Actualizar contacto',
              description: 'Actualizar datos de contacto',
            },
            {
              id: 'main_menu_human_handoff',
              title: '👩🏻‍💻 Asesor humano',
              description: 'Contactar a un asesor',
            },
            {
              id: 'main_menu_faq',
              title: '❓ Preguntas frecuentes',
              description: 'Resolver dudas comunes',
            },
          ],
        },
      ],
    };
  }
}
