import { Injectable } from '@nestjs/common';
import { NormalizedWhatsappEvent } from '../../../domain/events/normalized-whatsapp.event';

@Injectable()
export class WebhookIdempotencyKeyFactory {
  create(event: NormalizedWhatsappEvent): string {
    if (event.kind === 'incoming_message_received') {
      return `incoming:${event.messageId}`;
    }

    return `status:${event.messageId}:${event.status}:${event.timestamp}`;
  }
}
