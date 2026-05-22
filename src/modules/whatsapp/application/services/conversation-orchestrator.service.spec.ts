import { HandleIncomingConversationMessageUseCase } from '../../../conversations/application/use-cases/handle-incoming-conversation-message.use-case';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { SendWhatsappInteractiveButtonsMessageUseCase } from '../use-cases/outbound/send-whatsapp-interactive-buttons-message.use-case';
import { SendWhatsappInteractiveListMessageUseCase } from '../use-cases/outbound/send-whatsapp-interactive-list-message.use-case';
import { SendWhatsappTextMessageUseCase } from '../use-cases/outbound/send-whatsapp-text-message.use-case';
import { WhatsappConfigService } from './whatsapp-config.service';

describe('ConversationOrchestratorService', () => {
  it('does not throw when outbound interactive list dispatch fails', async () => {
    const handleIncomingConversationMessage = {
      execute: jest.fn().mockResolvedValue({
        status: 'HANDLED',
        conversationKey: 'whatsapp:123:573001112233',
        session: {
          conversationKey: 'whatsapp:123:573001112233',
          channel: 'whatsapp',
          participantPhone: '573001112233',
          phoneNumberId: '123',
          state: 'MAIN_MENU',
          status: 'BOT_ACTIVE',
          createdAt: '2026-05-07T12:00:00.000Z',
          updatedAt: '2026-05-07T12:00:00.000Z',
        },
        outboundMessages: [
          {
            type: 'interactive_list',
            body: 'menu',
            buttonText: 'Ver opciones',
            sections: [
              {
                title: 'Menú principal',
                rows: [
                  {
                    id: 'main_menu_request_appointment',
                    title: '⚕️ Solicitar cita',
                  },
                ],
              },
            ],
          },
        ],
      }),
      registerDispatchedInteractivePrompts: jest
        .fn()
        .mockResolvedValue(undefined),
    } as unknown as HandleIncomingConversationMessageUseCase;

    const sendWhatsappInteractiveListMessage = {
      execute: jest.fn().mockRejectedValue(new Error('dispatch error')),
    } as unknown as SendWhatsappInteractiveListMessageUseCase;

    const sendWhatsappInteractiveButtonsMessage = {
      execute: jest.fn(),
    } as unknown as SendWhatsappInteractiveButtonsMessageUseCase;

    const conversationMessageRepository = {
      saveInbound: jest.fn(),
      saveOutbound: jest.fn(),
      hasKnownOutboundMessage: jest.fn(),
    };

    const sendWhatsappTextMessage = {
      execute: jest.fn(),
    } as unknown as SendWhatsappTextMessageUseCase;

    const whatsappConfig = {
      isAutoReplyEnabled: jest.fn().mockReturnValue(true),
    } as unknown as WhatsappConfigService;
    const recordSatisfactionSurveyFlowSubmission = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };

    const service = new ConversationOrchestratorService(
      handleIncomingConversationMessage,
      conversationMessageRepository,
      sendWhatsappInteractiveListMessage,
      sendWhatsappInteractiveButtonsMessage,
      sendWhatsappTextMessage,
      recordSatisfactionSurveyFlowSubmission as any,
      whatsappConfig,
    );

    await expect(
      service.handleEvents([
        {
          kind: 'incoming_message_received',
          messageId: 'wamid-1',
          from: '573001112233',
          timestamp: '1711111111',
          messageType: 'text',
          textBody: 'hola',
          phoneNumberId: '123',
        },
      ]),
    ).resolves.toBeUndefined();
  });

  it('dispatches interactive buttons messages', async () => {
    const handleIncomingConversationMessage = {
      execute: jest.fn().mockResolvedValue({
        status: 'HANDLED',
        conversationKey: 'whatsapp:123:573001112233',
        session: {
          conversationKey: 'whatsapp:123:573001112233',
          channel: 'whatsapp',
          participantPhone: '573001112233',
          phoneNumberId: '123',
          state: 'SELECTING_SPECIALTY',
          status: 'BOT_ACTIVE',
          createdAt: '2026-05-07T12:00:00.000Z',
          updatedAt: '2026-05-07T12:00:00.000Z',
        },
        outboundMessages: [
          {
            type: 'interactive_buttons',
            body: '¿Deseas hacer algo mas?',
            buttons: [
              { id: 'nav_main_menu', title: 'Menu principal' },
              { id: 'nav_finish', title: 'Finalizar' },
            ],
          },
        ],
      }),
      registerDispatchedInteractivePrompts: jest
        .fn()
        .mockResolvedValue(undefined),
    } as unknown as HandleIncomingConversationMessageUseCase;

    const sendWhatsappInteractiveListMessage = {
      execute: jest.fn(),
    } as unknown as SendWhatsappInteractiveListMessageUseCase;
    const sendWhatsappInteractiveButtonsMessage = {
      execute: jest.fn().mockResolvedValue({ messageId: 'wamid-btn-1' }),
    } as unknown as SendWhatsappInteractiveButtonsMessageUseCase;
    const conversationMessageRepository = {
      saveInbound: jest.fn(),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn(),
    };
    const sendWhatsappTextMessage = {
      execute: jest.fn(),
    } as unknown as SendWhatsappTextMessageUseCase;
    const whatsappConfig = {
      isAutoReplyEnabled: jest.fn().mockReturnValue(true),
    } as unknown as WhatsappConfigService;
    const recordSatisfactionSurveyFlowSubmission = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };

    const service = new ConversationOrchestratorService(
      handleIncomingConversationMessage,
      conversationMessageRepository,
      sendWhatsappInteractiveListMessage,
      sendWhatsappInteractiveButtonsMessage,
      sendWhatsappTextMessage,
      recordSatisfactionSurveyFlowSubmission as any,
      whatsappConfig,
    );

    await service.handleEvents([
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-9',
        from: '573001112233',
        timestamp: '1711111111',
        messageType: 'text',
        textBody: 'hola',
        phoneNumberId: '123',
      },
    ]);

    expect(sendWhatsappInteractiveButtonsMessage.execute).toHaveBeenCalledTimes(
      1,
    );
    expect(conversationMessageRepository.saveOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'interactive',
        whatsappMessageId: 'wamid-btn-1',
      }),
    );
  });

  it('skips conversation state handling when survey flow submission was handled', async () => {
    const handleIncomingConversationMessage = {
      execute: jest.fn().mockResolvedValue({
        status: 'HANDLED',
        conversationKey: 'whatsapp:123:573001112233',
        session: {
          conversationKey: 'whatsapp:123:573001112233',
          channel: 'whatsapp',
          participantPhone: '573001112233',
          phoneNumberId: '123',
          state: 'MAIN_MENU',
          status: 'BOT_ACTIVE',
          createdAt: '2026-05-07T12:00:00.000Z',
          updatedAt: '2026-05-07T12:00:00.000Z',
        },
        outboundMessages: [],
      }),
      registerDispatchedInteractivePrompts: jest
        .fn()
        .mockResolvedValue(undefined),
    } as unknown as HandleIncomingConversationMessageUseCase;

    const service = new ConversationOrchestratorService(
      handleIncomingConversationMessage,
      {
        saveInbound: jest.fn(),
        saveOutbound: jest.fn(),
        hasKnownOutboundMessage: jest.fn(),
      },
      {
        execute: jest.fn(),
      } as unknown as SendWhatsappInteractiveListMessageUseCase,
      {
        execute: jest.fn(),
      } as unknown as SendWhatsappInteractiveButtonsMessageUseCase,
      { execute: jest.fn() } as unknown as SendWhatsappTextMessageUseCase,
      { execute: jest.fn().mockResolvedValue({ handled: true }) } as any,
      {
        isAutoReplyEnabled: jest.fn().mockReturnValue(true),
      } as unknown as WhatsappConfigService,
    );

    await service.handleEvents([
      {
        kind: 'incoming_message_received',
        messageId: 'wamid-flow-1',
        from: '573001112233',
        timestamp: '1711111111',
        messageType: 'interactive',
        interactiveFlowToken: 'survey_dispatch:99:2026-05-11',
        interactiveFlowResponse: { survey_decision: '1' },
        phoneNumberId: '123',
      },
    ]);

    expect(handleIncomingConversationMessage.execute).not.toHaveBeenCalled();
  });
});
