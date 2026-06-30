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

export interface TemplateMessageSnapshotButton {
  index: string;
  title: string;
}

export interface TemplateMessageSnapshotButtonPayload {
  index: string;
  payload: string;
}

export interface TemplateMessageSnapshotFlowMetadata {
  buttonIndex?: string;
  ctaLabel?: string;
  dispatchId?: string;
  surveyDateIso?: string;
}

export interface TemplateMessageSnapshot {
  templateName: string;
  templateLanguageCode: string;
  templateVariant:
    | 'APPOINTMENT_REMINDER'
    | 'SURVEY_PHONE_VERIFICATION'
    | 'SURVEY_FLOW_INVITATION';
  visibleBody: string;
  bodyTextParameters: readonly string[];
  visibleButtons: readonly TemplateMessageSnapshotButton[];
  buttonPayloads?: readonly TemplateMessageSnapshotButtonPayload[];
  flowMetadata?: TemplateMessageSnapshotFlowMetadata;
  snapshotVersion: string;
  renderedHash: string;
}

export interface SaveOutboundConversationMessageInput {
  conversationKey: string;
  messageType: string;
  to: string;
  whatsappMessageId: string | null;
  body: string | null;
  sentAt: string;
  templateSnapshot?: TemplateMessageSnapshot;
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
