import { Injectable } from '@nestjs/common';
import type { ConversationOutboundInteractiveListMessage } from '../../domain/value-objects/conversation-outbound-message';
import { buildSpecialtyOptionId } from './specialty-option-id';

interface SpecialtyListItem {
  code: string;
  name: string;
  cups?: string | null;
}

@Injectable()
export class SpecialtyListFactory {
  build(specialties: SpecialtyListItem[]): ConversationOutboundInteractiveListMessage {
    return {
      type: 'interactive_list',
      body: 'Seleccione la especialidad que desea agendar.',
      buttonText: 'Ver especialidades',
      sections: [
        {
          title: 'Especialidades activas',
          rows: specialties.map((specialty) => ({
            id: buildSpecialtyOptionId(specialty.code),
            title: specialty.name,
          })),
        },
      ],
    };
  }
}
