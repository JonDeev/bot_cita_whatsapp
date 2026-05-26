import { AuditService } from '../../../../audit/application/services/audit.service';
import { SendWhatsappTemplateMessageUseCase } from './send-whatsapp-template-message.use-case';

describe('SendWhatsappTemplateMessageUseCase', () => {
  it('records masked recipient phone in template audit events', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
      sendFlowTemplateMessage: jest.fn(),
      sendTemplateMessage: jest
        .fn()
        .mockResolvedValue({ messageId: 'wamid-1' }),
    };
    const recordAudit = jest.fn().mockResolvedValue(undefined);
    const auditService = {
      record: recordAudit,
    } as unknown as AuditService;

    const useCase = new SendWhatsappTemplateMessageUseCase(
      sender,
      auditService,
    );

    await useCase.execute({
      to: '+57 300 111 2233',
      templateName: 'recordatorio_cita_24h',
      languageCode: 'es_CO',
      trigger: 'appointment_reminder.dispatch_due',
    });

    expect(recordAudit).toHaveBeenCalledWith(
      'whatsapp.outbound.template.attempted',
      expect.objectContaining({
        to: '******2233',
      }),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      'whatsapp.outbound.template.sent',
      expect.objectContaining({
        to: '******2233',
      }),
    );
  });
});
