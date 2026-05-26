import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { SendWhatsappInteractiveButtonsMessageUseCase } from './send-whatsapp-interactive-buttons-message.use-case';

describe('SendWhatsappInteractiveButtonsMessageUseCase', () => {
  it('sends interactive buttons and records success audit', async () => {
    const sender = {
      sendInteractiveButtonsMessage: jest
        .fn()
        .mockResolvedValue({ messageId: 'wamid-789' }),
      sendFlowTemplateMessage: jest.fn(),
      sendTemplateMessage: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new SendWhatsappInteractiveButtonsMessageUseCase(
      sender as any,
      auditService,
    );

    const result = await useCase.execute({
      to: '573001112233',
      body: '¿Deseas hacer algo mas?',
      buttons: [
        { id: 'nav_main_menu', title: 'Menu principal' },
        { id: 'nav_finish', title: 'Finalizar' },
      ],
      trigger: 'test',
    });

    expect(result.messageId).toBe('wamid-789');
    expect(auditService.record).toHaveBeenCalledWith(
      'whatsapp.outbound.interactive_buttons.sent',
      {
        to: '573001112233',
        trigger: 'test',
        messageId: 'wamid-789',
      },
    );
  });

  it('rejects duplicated button ids', async () => {
    const sender = {
      sendInteractiveButtonsMessage: jest.fn(),
      sendFlowTemplateMessage: jest.fn(),
      sendTemplateMessage: jest.fn(),
    };
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const useCase = new SendWhatsappInteractiveButtonsMessageUseCase(
      sender as any,
      auditService,
    );

    await expect(
      useCase.execute({
        to: '573001112233',
        body: '¿Deseas hacer algo mas?',
        buttons: [
          { id: 'nav_main_menu', title: 'Menu principal' },
          { id: 'nav_main_menu', title: 'Finalizar' },
        ],
        trigger: 'test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
