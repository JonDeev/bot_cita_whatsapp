import { Injectable } from '@nestjs/common';
import type { ConversationOutboundTextMessage } from '../../domain/value-objects/conversation-outbound-message';

@Injectable()
export class PatientContactUpdateSuccessMessageFactory {
  build(): ConversationOutboundTextMessage {
    return {
      type: 'text',
      body: 'Tus datos de contacto quedaron confirmados y actualizados correctamente.',
    };
  }
}
