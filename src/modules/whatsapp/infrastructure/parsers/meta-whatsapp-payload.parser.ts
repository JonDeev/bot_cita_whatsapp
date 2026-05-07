import { Injectable } from '@nestjs/common';
import {
  IncomingMessageReceivedEvent,
  MessageStatusChangedEvent,
  NormalizedWhatsappEvent,
} from '../../domain/events/normalized-whatsapp.event';
import { WhatsappPayloadParserPort } from '../../domain/ports/whatsapp-payload-parser.port';

interface MetaChangeValue {
  metadata?: {
    phone_number_id?: string;
  };
  messages?: Array<{
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
    text?: {
      body?: string;
    };
    interactive?: {
      list_reply?: {
        id?: string;
        title?: string;
      };
      button_reply?: {
        id?: string;
        title?: string;
      };
    };
    context?: {
      id?: string;
    };
  }>;
  statuses?: Array<{
    id?: string;
    recipient_id?: string;
    status?: string;
    timestamp?: string;
  }>;
}

@Injectable()
export class MetaWhatsappPayloadParser implements WhatsappPayloadParserPort {
  parse(payload: unknown, receivedAt: string): NormalizedWhatsappEvent[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const entry = (payload as { entry?: unknown[] }).entry;
    if (!Array.isArray(entry)) {
      return [];
    }

    const events: NormalizedWhatsappEvent[] = [];

    for (const entryItem of entry) {
      const changes = (entryItem as { changes?: unknown[] }).changes;
      if (!Array.isArray(changes)) {
        continue;
      }

      for (const changeItem of changes) {
        const field = (changeItem as { field?: string }).field;
        if (field !== 'messages') {
          continue;
        }

        const value = (changeItem as { value?: MetaChangeValue }).value;
        if (!value) {
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id;

        if (Array.isArray(value.messages)) {
          for (const message of value.messages) {
            if (!message.id || !message.from || !message.timestamp || !message.type) {
              continue;
            }

            const incomingEvent: IncomingMessageReceivedEvent = {
              kind: 'incoming_message_received',
              messageId: message.id,
              from: message.from,
              timestamp: message.timestamp,
              receivedAt,
              messageType: message.type,
              textBody: message.text?.body,
              interactiveReplyId:
                message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id,
              interactiveReplyTitle:
                message.interactive?.list_reply?.title ??
                message.interactive?.button_reply?.title,
              contextMessageId: message.context?.id,
              phoneNumberId,
            };

            events.push(incomingEvent);
          }
        }

        if (Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            if (!status.id || !status.recipient_id || !status.status || !status.timestamp) {
              continue;
            }

            const statusEvent: MessageStatusChangedEvent = {
              kind: 'message_status_changed',
              messageId: status.id,
              recipientId: status.recipient_id,
              status: status.status,
              timestamp: status.timestamp,
              receivedAt,
              phoneNumberId,
            };

            events.push(statusEvent);
          }
        }
      }
    }

    return events;
  }
}
