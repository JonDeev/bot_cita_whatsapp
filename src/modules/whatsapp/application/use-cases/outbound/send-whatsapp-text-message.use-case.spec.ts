import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { SendWhatsappTextMessageUseCase } from './send-whatsapp-text-message.use-case';

describe('SendWhatsappTextMessageUseCase', () => {
  it('sends text and records success audit', async () => {
    const sender = {
      sendTextMessage: jest.fn().mockResolvedValue({ messageId: 'wamid-123' }),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
      sendFlowTemplateMessage: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new SendWhatsappTextMessageUseCase(sender, auditService);

    const result = await useCase.execute({
      to: '573001112233',
      body: 'hola',
      trigger: 'test',
    });

    expect(result.messageId).toBe('wamid-123');
    expect(auditService.record).toHaveBeenCalledWith(
      'whatsapp.outbound.text.sent',
      {
        to: '573001112233',
        trigger: 'test',
        messageId: 'wamid-123',
      },
    );
  });

  it('validates required recipient', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
      sendFlowTemplateMessage: jest.fn(),
    };
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const useCase = new SendWhatsappTextMessageUseCase(sender, auditService);

    await expect(
      useCase.execute({
        to: '',
        body: 'hola',
        trigger: 'test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
