export interface OutboundWhatsappTextMessage {
  to: string;
  body: string;
}

export interface OutboundWhatsappInteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface OutboundWhatsappInteractiveListSection {
  title: string;
  rows: OutboundWhatsappInteractiveListRow[];
}

export interface OutboundWhatsappInteractiveListMessage {
  to: string;
  body: string;
  buttonText: string;
  sections: OutboundWhatsappInteractiveListSection[];
}

export interface OutboundWhatsappInteractiveButtonReply {
  id: string;
  title: string;
}

export interface OutboundWhatsappInteractiveButtonsMessage {
  to: string;
  body: string;
  buttons: OutboundWhatsappInteractiveButtonReply[];
}

export interface OutboundWhatsappFlowTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  bodyTextParameters?: string[];
  buttonIndex: string;
  flowToken: string;
  flowActionData?: Record<string, string | number | boolean>;
}

export interface OutboundWhatsappSendResult {
  messageId: string;
}
