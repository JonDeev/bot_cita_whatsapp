export interface SaveInboundConversationMessageInput {
  conversationKey: string;
  messageId: string;
  messageType: string;
  from: string;
  phoneNumberId: string | null;
  textBody: string | null;
  interactiveReplyId: string | null;
  interactiveReplyTitle: string | null;
  contextMessageId: string | null;
  providerTimestamp: string;
  receivedAt: string;
}

export interface SaveOutboundConversationMessageInput {
  conversationKey: string;
  messageType: string;
  to: string;
  whatsappMessageId: string | null;
  body: string | null;
  sentAt: string;
}

export interface ConversationMessageRepository {
  saveInbound(input: SaveInboundConversationMessageInput): Promise<void>;
  saveOutbound(input: SaveOutboundConversationMessageInput): Promise<void>;
  hasKnownOutboundMessage(
    conversationKey: string,
    whatsappMessageId: string,
  ): Promise<boolean>;
  findOutboundMessageOccurredAt?(
    conversationKey: string,
    whatsappMessageId: string,
  ): Promise<string | null>;
}
