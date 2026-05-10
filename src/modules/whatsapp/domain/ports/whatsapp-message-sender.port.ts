import {
  OutboundWhatsappFlowTemplateMessage,
  OutboundWhatsappInteractiveButtonsMessage,
  OutboundWhatsappInteractiveListMessage,
  OutboundWhatsappSendResult,
  OutboundWhatsappTextMessage,
} from '../value-objects/outbound-whatsapp-message';

export interface WhatsappMessageSenderPort {
  sendTextMessage(message: OutboundWhatsappTextMessage): Promise<OutboundWhatsappSendResult>;
  sendInteractiveListMessage(
    message: OutboundWhatsappInteractiveListMessage,
  ): Promise<OutboundWhatsappSendResult>;
  sendInteractiveButtonsMessage(
    message: OutboundWhatsappInteractiveButtonsMessage,
  ): Promise<OutboundWhatsappSendResult>;
  sendFlowTemplateMessage(
    message: OutboundWhatsappFlowTemplateMessage,
  ): Promise<OutboundWhatsappSendResult>;
}
