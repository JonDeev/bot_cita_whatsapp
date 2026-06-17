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
    const recordSatisfactionSurveyTemplateReply = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };
    const handleAppointmentReminderVerificationReply = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };

    const service = new ConversationOrchestratorService(
      handleIncomingConversationMessage,
      conversationMessageRepository,
      sendWhatsappInteractiveListMessage,
      sendWhatsappInteractiveButtonsMessage,
      sendWhatsappTextMessage,
      recordSatisfactionSurveyFlowSubmission as any,
      recordSatisfactionSurveyTemplateReply as any,
      handleAppointmentReminderVerificationReply as any,
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
    const sendInteractiveButtonsExecute = jest
      .fn()
      .mockResolvedValue({ messageId: 'wamid-btn-1' });
    const sendWhatsappInteractiveButtonsMessage = {
      execute: sendInteractiveButtonsExecute,
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
    const recordSatisfactionSurveyTemplateReply = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };
    const handleAppointmentReminderVerificationReply = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };

    const service = new ConversationOrchestratorService(
      handleIncomingConversationMessage,
      conversationMessageRepository,
      sendWhatsappInteractiveListMessage,
      sendWhatsappInteractiveButtonsMessage,
      sendWhatsappTextMessage,
      recordSatisfactionSurveyFlowSubmission as any,
      recordSatisfactionSurveyTemplateReply as any,
      handleAppointmentReminderVerificationReply as any,
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

    expect(sendInteractiveButtonsExecute).toHaveBeenCalledTimes(1);
    expect(conversationMessageRepository.saveOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'interactive',
        whatsappMessageId: 'wamid-btn-1',
      }),
    );
  });

  it('skips conversation state handling when survey flow submission was handled', async () => {
    const handleIncomingConversationMessageExecute = jest
      .fn()
      .mockResolvedValue({
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
      });
    const handleIncomingConversationMessage = {
      execute: handleIncomingConversationMessageExecute,
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
      { execute: jest.fn().mockResolvedValue({ handled: false }) } as any,
      { execute: jest.fn().mockResolvedValue({ handled: false }) } as any,
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

    expect(handleIncomingConversationMessageExecute).not.toHaveBeenCalled();
  });

  it('routes interactive reminder replies to reminders use case before conversation flow', async () => {
    const handleIncomingConversationMessageExecute = jest.fn();
    const handleIncomingConversationMessage = {
      execute: handleIncomingConversationMessageExecute,
      registerDispatchedInteractivePrompts: jest.fn(),
    } as unknown as HandleIncomingConversationMessageUseCase;

    const reminderReplyExecute = jest.fn().mockResolvedValue({ handled: true });
    const handleAppointmentReminderVerificationReply = {
      execute: reminderReplyExecute,
    };
    const recordSatisfactionSurveyTemplateReply = {
      execute: jest.fn().mockResolvedValue({ handled: false }),
    };

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
      { execute: jest.fn().mockResolvedValue({ handled: false }) } as any,
      recordSatisfactionSurveyTemplateReply as any,
      handleAppointmentReminderVerificationReply as any,
      {
        isAutoReplyEnabled: jest.fn().mockReturnValue(true),
      } as unknown as WhatsappConfigService,
    );

    await service.handleEvent({
      kind: 'incoming_message_received',
      messageId: 'wamid-reminder-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'interactive',
      interactiveReplyId: 'appt_reminder_confirm:signed_payload',
      receivedAt: '2026-05-26T10:00:00.000Z',
      phoneNumberId: '123',
    });

    expect(reminderReplyExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        inboundMessageId: 'wamid-reminder-1',
        interactiveReplyId: 'appt_reminder_confirm:signed_payload',
      }),
    );
    expect(handleIncomingConversationMessageExecute).not.toHaveBeenCalled();
  });

  it('skips reminder and conversation flow when survey template quick reply was handled', async () => {
    const handleIncomingConversationMessageExecute = jest.fn();
    const handleIncomingConversationMessage = {
      execute: handleIncomingConversationMessageExecute,
      registerDispatchedInteractivePrompts: jest.fn(),
    } as unknown as HandleIncomingConversationMessageUseCase;

    const surveyTemplateReplyExecute = jest
      .fn()
      .mockResolvedValue({ handled: true });
    const reminderReplyExecute = jest.fn();

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
      { execute: jest.fn().mockResolvedValue({ handled: false }) } as any,
      { execute: surveyTemplateReplyExecute } as any,
      { execute: reminderReplyExecute } as any,
      {
        isAutoReplyEnabled: jest.fn().mockReturnValue(true),
      } as unknown as WhatsappConfigService,
    );

    await service.handleEvent({
      kind: 'incoming_message_received',
      messageId: 'wamid-survey-template-1',
      from: '573001112233',
      timestamp: '1711111111',
      messageType: 'interactive',
      interactiveReplyId: 'No deseo responder',
      interactiveReplyTitle: 'No deseo responder',
      contextMessageId: 'wamid-template-123',
      phoneNumberId: '123',
    });

    expect(surveyTemplateReplyExecute).toHaveBeenCalledTimes(1);
    expect(reminderReplyExecute).not.toHaveBeenCalled();
    expect(handleIncomingConversationMessageExecute).not.toHaveBeenCalled();
  });
});
