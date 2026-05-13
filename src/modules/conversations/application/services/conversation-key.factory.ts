import { Injectable } from '@nestjs/common';

@Injectable()
export class ConversationKeyFactory {
  createWhatsappConversationKey(
    phoneNumberId: string | undefined,
    participantPhone: string,
  ): string {
    return `whatsapp:${phoneNumberId ?? 'unknown'}:${participantPhone}`;
  }
}
