export type NormalizedWhatsappEvent =
  | IncomingMessageReceivedEvent
  | MessageStatusChangedEvent;

export interface IncomingMessageReceivedEvent {
  kind: 'incoming_message_received';
  messageId: string;
  from: string;
  timestamp: string;
  receivedAt?: string;
  messageType: string;
  textBody?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
  interactiveFlowToken?: string;
  interactiveFlowResponse?: Record<string, unknown>;
  contextMessageId?: string;
  phoneNumberId?: string;
}

export interface MessageStatusChangedEvent {
  kind: 'message_status_changed';
  messageId: string;
  recipientId: string;
  status: string;
  timestamp: string;
  receivedAt?: string;
  phoneNumberId?: string;
}
