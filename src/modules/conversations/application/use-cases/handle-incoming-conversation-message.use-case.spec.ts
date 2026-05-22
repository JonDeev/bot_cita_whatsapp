import { AuditService } from '../../../audit/application/services/audit.service';
import { AssignedAppointmentConsultationDetailsMessageFactory } from '../services/assigned-appointment-consultation-details-message.factory';
import { AssignedAppointmentDetailsMessageFactory } from '../services/assigned-appointment-details-message.factory';
import { AssignedAppointmentListFactory } from '../services/assigned-appointment-list.factory';
import { AppointmentDoctorListFactory } from '../services/appointment-doctor-list.factory';
import { AppointmentDoctorListPresenterService } from '../services/appointment-doctor-list-presenter.service';
import { AppointmentDateListFactory } from '../services/appointment-date-list.factory';
import { AppointmentNotificationOptInMessageFactory } from '../services/appointment-notification-opt-in-message.factory';
import { AppointmentTimeListFactory } from '../services/appointment-time-list.factory';
import { ConversationConfigService } from '../services/conversation-config.service';
import { ConversationKeyFactory } from '../services/conversation-key.factory';
import { ConversationNavigationService } from '../services/conversation-navigation.service';
import { ConversationStatePromptService } from '../services/conversation-state-prompt.service';
import { MainMenuListFactory } from '../services/main-menu-list.factory';
import { InteractivePromptWindowService } from '../services/interactive-prompt-window.service';
import { PatientContactConfirmationMessageFactory } from '../services/patient-contact-confirmation-message.factory';
import { PatientContactUpdateOptionsListFactory } from '../services/patient-contact-update-options-list.factory';
import { SpecialtyListFactory } from '../services/specialty-list.factory';
import { MainMenuHandler } from '../state-handlers/main-menu.handler';
import { HandleIncomingConversationMessageUseCase } from './handle-incoming-conversation-message.use-case';

describe('HandleIncomingConversationMessageUseCase', () => {
  function buildUseCase(
    repository: {
      findByKey: jest.Mock;
      save: jest.Mock;
    },
    conversationPersistenceRepository: {
      findByKey: jest.Mock;
      upsert: jest.Mock;
    },
    conversationMessageRepository: {
      saveInbound: jest.Mock;
      saveOutbound: jest.Mock;
      hasKnownOutboundMessage: jest.Mock;
      findOutboundMessageOccurredAt?: jest.Mock;
    },
    conversationStateHandlerResolver: { resolve: jest.Mock },
    auditService: AuditService,
  ): HandleIncomingConversationMessageUseCase {
    return new HandleIncomingConversationMessageUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      new ConversationKeyFactory(),
      conversationStateHandlerResolver as any,
      new ConversationNavigationService(),
      new ConversationStatePromptService(
        new MainMenuListFactory(),
        new SpecialtyListFactory(),
        new AssignedAppointmentListFactory(),
        new AssignedAppointmentConsultationDetailsMessageFactory(),
        new AssignedAppointmentDetailsMessageFactory(),
        new AppointmentDoctorListFactory(
          new AppointmentDoctorListPresenterService(),
        ),
        new AppointmentDateListFactory(),
        new AppointmentTimeListFactory(),
        new AppointmentNotificationOptInMessageFactory(),
        new PatientContactConfirmationMessageFactory(),
        new PatientContactUpdateOptionsListFactory(),
      ),
      new InteractivePromptWindowService(),
      new MainMenuListFactory(),
      new ConversationConfigService(),
      auditService,
    );
  }

  it('creates a session and returns only main menu message', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const mainMenuHandler = new MainMenuHandler(new MainMenuListFactory());
    const conversationStateHandlerResolver = {
      resolve: jest.fn().mockReturnValue(mainMenuHandler),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'text',
      textBody: 'hola',
      phoneNumberId: '123',
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(conversationPersistenceRepository.upsert).toHaveBeenCalledTimes(1);
    expect(conversationMessageRepository.saveInbound).toHaveBeenCalledTimes(1);
    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
    });
  });

  it('does not append navigation buttons for birth date prompt step', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'WAITING_DOCUMENT',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const waitingDocumentHandler = {
      handle: jest.fn().mockResolvedValue({
        nextState: 'WAITING_BIRTH_DATE',
        outboundMessages: [
          {
            type: 'text',
            body: 'Ahora escribe tu fecha de nacimiento en formato DD-MM-YYYY.',
          },
        ],
      }),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn().mockReturnValue(waitingDocumentHandler),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-1',
      from: '573001112233',
      timestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'text',
      textBody: '12345678',
      phoneNumberId: '123',
    });

    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
  });

  it('closes the conversation when patient selects finalize', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_SPECIALTY',
        status: 'BOT_ACTIVE',
        context: {
          interactivePromptWindow: {
            currentPromptId: 'prompt:wamid-nav',
            prompts: [
              {
                promptId: 'prompt:wamid-nav',
                logicalStepKey: 'NAVIGATION:SELECTING_SPECIALTY',
                promptKind: 'NAVIGATION',
                state: 'SELECTING_SPECIALTY',
                outboundMessageId: 'wamid-nav',
                allowedReplyIds: ['nav_main_menu', 'nav_finish'],
                issuedAt: '2026-05-04T10:00:00.000Z',
                source: 'ORIGINAL',
              },
            ],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-2',
      from: '573001112233',
      timestamp: '1711111112',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'interactive',
      interactiveReplyId: 'nav_finish',
      interactiveReplyTitle: 'Finalizar',
      phoneNumberId: '123',
    });

    expect(result.outboundMessages).toHaveLength(1);
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'CLOSED',
      }),
    );
    expect(conversationStateHandlerResolver.resolve).not.toHaveBeenCalled();
  });

  it('reopens a closed conversation with any inbound message', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'CLOSED',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const mainMenuHandler = new MainMenuHandler(new MainMenuListFactory());
    const conversationStateHandlerResolver = {
      resolve: jest.fn().mockReturnValue(mainMenuHandler),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-3',
      from: '573001112233',
      timestamp: '1711111113',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'text',
      textBody: 'hola otra vez',
      phoneNumberId: '123',
    });

    expect(result.outboundMessages[0]).toMatchObject({
      type: 'interactive_list',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'BOT_ACTIVE',
        state: 'MAIN_MENU',
      }),
    );
  });

  it('reopens an expired conversation at main menu and does not continue old flow state', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_SPECIALTY',
        status: 'EXPIRED',
        context: {
          flowIntent: 'REQUEST_APPOINTMENT',
          interactivePromptWindow: {
            currentPromptId: 'prompt:wamid-old',
            prompts: [
              {
                promptId: 'prompt:wamid-old',
                logicalStepKey: 'SELECTING_SPECIALTY:ROOT',
                promptKind: 'SPECIALTY_SELECTION',
                state: 'SELECTING_SPECIALTY',
                outboundMessageId: 'wamid-old',
                allowedReplyIds: ['specialty:890201'],
                issuedAt: '2026-05-22T11:50:00.000Z',
                source: 'ORIGINAL',
              },
            ],
          },
        },
        createdAt: '2026-05-22T11:40:00.000Z',
        updatedAt: '2026-05-22T12:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-expired-reopen',
      from: '573001112233',
      timestamp: '1779453468',
      receivedAt: '2026-05-22T12:42:43.148Z',
      messageType: 'text',
      textBody: 'hola',
      phoneNumberId: '123',
    });

    expect(result.status).toBe('HANDLED');
    expect(result.outboundMessages).toHaveLength(2);
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
    expect(result.outboundMessages[1]).toMatchObject({ type: 'interactive_list' });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'BOT_ACTIVE',
        state: 'MAIN_MENU',
      }),
    );
    expect(conversationStateHandlerResolver.resolve).not.toHaveBeenCalled();
  });

  it('rebuilds the specialty prompt when user navigates back from appointment date selection', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'SELECTING_APPOINTMENT_DATE',
        status: 'BOT_ACTIVE',
        context: {
          specialtySelection: {
            offeredSpecialties: [
              { code: '890201', name: 'MEDICINA GENERAL', cups: '890201' },
            ],
          },
          appointmentDateSelection: {
            scope: 'SPECIALTY',
            specialtyOfferedDates: [
              { isoDate: '2026-05-06', displayDate: '06/05/2026' },
            ],
            offeredDates: [
              { isoDate: '2026-05-06', displayDate: '06/05/2026' },
            ],
          },
          interactivePromptWindow: {
            currentPromptId: 'prompt:wamid-outbound-1',
            prompts: [
              {
                promptId: 'prompt:wamid-outbound-1',
                logicalStepKey: 'NAVIGATION:SELECTING_APPOINTMENT_DATE',
                promptKind: 'NAVIGATION',
                state: 'SELECTING_APPOINTMENT_DATE',
                outboundMessageId: 'wamid-outbound-1',
                allowedReplyIds: ['nav_back', 'nav_main_menu', 'nav_finish'],
                issuedAt: '2026-05-04T10:00:00.000Z',
                source: 'ORIGINAL',
              },
            ],
          },
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-8',
      from: '573001112233',
      timestamp: '1711111118',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'interactive',
      interactiveReplyId: 'nav_back',
      interactiveReplyTitle: 'Volver',
      phoneNumberId: '123',
      contextMessageId: 'wamid-outbound-1',
    });

    expect(result.outboundMessages).toEqual([
      {
        type: 'interactive_list',
        body: 'Seleccione la especialidad que desea agendar.',
        buttonText: 'Ver especialidades',
        sections: [
          {
            title: 'Especialidades activas',
            rows: [{ id: 'specialty:890201', title: 'MEDICINA GENERAL' }],
          },
        ],
      },
      {
        type: 'interactive_buttons',
        body: '\u200B',
        buttons: [
          { id: 'nav_main_menu', title: 'Menu principal' },
          { id: 'nav_finish', title: 'Finalizar' },
        ],
      },
    ]);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'SELECTING_SPECIALTY',
      }),
    );
    expect(conversationStateHandlerResolver.resolve).not.toHaveBeenCalled();
  });

  it('restores a durable session when Redis does not have it', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'WAITING_DOCUMENT',
        status: 'BOT_ACTIVE',
        context: {
          flowIntent: 'REQUEST_APPOINTMENT',
        },
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const waitingDocumentHandler = {
      handle: jest.fn().mockResolvedValue({
        nextState: 'WAITING_BIRTH_DATE',
        outboundMessages: [
          {
            type: 'text',
            body: 'Ahora escribe tu fecha de nacimiento en formato DD-MM-YYYY.',
          },
        ],
      }),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn().mockReturnValue(waitingDocumentHandler),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-restore',
      from: '573001112233',
      timestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'text',
      textBody: '12345678',
      phoneNumberId: '123',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'WAITING_BIRTH_DATE',
      }),
    );
    expect(conversationPersistenceRepository.findByKey).toHaveBeenCalledTimes(
      1,
    );
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
  });

  it('recovers conversation when interactive reply has invalid context', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(false),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-invalid-context',
      from: '573001112233',
      timestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
      messageType: 'interactive',
      interactiveReplyId: 'main_menu_request_appointment',
      interactiveReplyTitle: 'Solicitar cita',
      contextMessageId: 'wamid-unknown-outbound',
      phoneNumberId: '123',
    });

    expect(result.status).toBe('RECOVERED_INVALID_CONTEXT');
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
    expect(conversationStateHandlerResolver.resolve).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });

  it('recovers conversation when interactive reply does not match active prompt window', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        conversationKey: 'whatsapp:123:573001112233',
        channel: 'whatsapp',
        participantPhone: '573001112233',
        phoneNumberId: '123',
        state: 'MAIN_MENU',
        status: 'BOT_ACTIVE',
        createdAt: '2026-05-04T10:00:00.000Z',
        updatedAt: '2026-05-04T10:00:00.000Z',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const conversationPersistenceRepository = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const conversationMessageRepository = {
      saveInbound: jest.fn().mockResolvedValue(undefined),
      saveOutbound: jest.fn().mockResolvedValue(undefined),
      hasKnownOutboundMessage: jest.fn().mockResolvedValue(true),
    };
    const conversationStateHandlerResolver = {
      resolve: jest.fn(),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = buildUseCase(
      repository,
      conversationPersistenceRepository,
      conversationMessageRepository,
      conversationStateHandlerResolver,
      auditService,
    );

    const result = await useCase.execute({
      kind: 'incoming_message_received',
      messageId: 'wamid-old-context',
      from: '573001112233',
      timestamp: '1779453468',
      receivedAt: '2026-05-22T12:42:43.148Z',
      messageType: 'interactive',
      interactiveReplyId: 'main_menu_update_contact',
      interactiveReplyTitle: 'Actualizar contacto',
      contextMessageId: 'wamid-outbound-old',
      phoneNumberId: '123',
    });

    expect(result.status).toBe('RECOVERED_INVALID_CONTEXT');
    expect(result.outboundMessages[0]).toMatchObject({ type: 'text' });
    expect(conversationStateHandlerResolver.resolve).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalled();
  });
});
