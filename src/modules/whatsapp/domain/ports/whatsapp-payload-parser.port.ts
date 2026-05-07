import { NormalizedWhatsappEvent } from '../events/normalized-whatsapp.event';

export interface WhatsappPayloadParserPort {
  parse(payload: unknown, receivedAt: string): NormalizedWhatsappEvent[];
}
