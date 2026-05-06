import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../../../../audit/application/services/audit.service';
import { SendWhatsappInteractiveListMessageUseCase } from './send-whatsapp-interactive-list-message.use-case';

describe('SendWhatsappInteractiveListMessageUseCase', () => {
  it('sends an interactive list and records success audit', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn().mockResolvedValue({ messageId: 'wamid-456' }),
      sendInteractiveButtonsMessage: jest.fn(),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

    const useCase = new SendWhatsappInteractiveListMessageUseCase(sender, auditService);

    const result = await useCase.execute({
      to: '573001112233',
      body: 'menu',
      buttonText: 'Ver opciones',
      sections: [
        {
          title: 'Menú principal',
          rows: [{ id: 'main_menu_request_appointment', title: '⚕️ Solicitud de cita' }],
        },
      ],
      trigger: 'test',
    });

    expect(result.messageId).toBe('wamid-456');
    expect(auditService.record).toHaveBeenCalledWith('whatsapp.outbound.interactive_list.sent', {
      to: '573001112233',
      trigger: 'test',
      messageId: 'wamid-456',
    });
  });

  it('validates that at least one section exists', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
    };
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const useCase = new SendWhatsappInteractiveListMessageUseCase(sender, auditService);

    await expect(
      useCase.execute({
        to: '573001112233',
        body: 'menu',
        buttonText: 'Ver opciones',
        sections: [],
        trigger: 'test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects section titles longer than WhatsApp limits', async () => {
    const sender = {
      sendTextMessage: jest.fn(),
      sendInteractiveListMessage: jest.fn(),
      sendInteractiveButtonsMessage: jest.fn(),
    };
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const useCase = new SendWhatsappInteractiveListMessageUseCase(sender, auditService);

    await expect(
      useCase.execute({
        to: '573001112233',
        body: 'menu',
        buttonText: 'Ver opciones',
        sections: [
          {
            title: 'Especialidades disponibles',
            rows: [{ id: 'specialty:890201', title: 'MEDICINA GENERAL' }],
          },
        ],
        trigger: 'test',
      }),
    ).rejects.toThrow(
      'Interactive list section title at index 0 exceeds 24 characters.',
    );

    expect(sender.sendInteractiveListMessage).not.toHaveBeenCalled();
  });
});
