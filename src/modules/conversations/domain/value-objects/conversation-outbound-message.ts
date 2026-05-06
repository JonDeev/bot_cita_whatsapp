export interface ConversationOutboundTextMessage {
  type: 'text';
  body: string;
}

export interface ConversationOutboundInteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ConversationOutboundInteractiveListSection {
  title: string;
  rows: ConversationOutboundInteractiveListRow[];
}

export interface ConversationOutboundInteractiveListMessage {
  type: 'interactive_list';
  body: string;
  buttonText: string;
  sections: ConversationOutboundInteractiveListSection[];
}

export interface ConversationOutboundInteractiveButtonReply {
  id: string;
  title: string;
}

export interface ConversationOutboundInteractiveButtonsMessage {
  type: 'interactive_buttons';
  body: string;
  buttons: ConversationOutboundInteractiveButtonReply[];
}

export type ConversationOutboundMessage =
  | ConversationOutboundTextMessage
  | ConversationOutboundInteractiveListMessage
  | ConversationOutboundInteractiveButtonsMessage;
