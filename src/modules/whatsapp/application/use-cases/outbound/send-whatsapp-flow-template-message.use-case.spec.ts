import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { SendWhatsappFlowTemplateMessageUseCase } from './send-whatsapp-flow-template-message.use-case';

describe('SendWhatsappFlowTemplateMessageUseCase', () => {
  it('sends a flow template and records success audit', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
      sendFlowTemplateMessage: jest
        .fn()
        .mockResolvedValue({ messageId: 'wamid-flow-123' }),
      sendTemplateMessage: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new SendWhatsappFlowTemplateMessageUseCase(
      sender,
      auditService,
    );

    const result = await useCase.execute({
      to: '573001112233',
      templateName: 'satisfaction_survey_flow',
      languageCode: 'es_CO',
      bodyTextParameters: ['Adriana', 'MEDICINA GENERAL', '07:30'],
      buttonIndex: '0',
      flowToken: 'survey_dispatch:15:2026-05-10',
      flowActionData: {
        dispatch_id: '15',
      },
      trigger: 'test',
    });

    expect(result.messageId).toBe('wamid-flow-123');
    expect(auditService.record).toHaveBeenCalledWith(
      'whatsapp.outbound.flow_template.sent',
      {
        to: '573001112233',
        trigger: 'test',
        templateName: 'satisfaction_survey_flow',
        messageId: 'wamid-flow-123',
      },
    );
  });

  it('rejects a non-numeric button index', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
      sendFlowTemplateMessage: jest.fn(),
      sendTemplateMessage: jest.fn(),
    };
    const auditService = { record: jest.fn() } as unknown as AuditService;

    const useCase = new SendWhatsappFlowTemplateMessageUseCase(
      sender,
      auditService,
    );

    await expect(
      useCase.execute({
        to: '573001112233',
        templateName: 'satisfaction_survey_flow',
        languageCode: 'es_CO',
        buttonIndex: 'flow',
        flowToken: 'survey_dispatch:15:2026-05-10',
        trigger: 'test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
