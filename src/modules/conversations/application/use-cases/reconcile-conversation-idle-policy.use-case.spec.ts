import { AuditService } from '../../../audit/application/services/audit.service';
import { ReconcileConversationIdlePolicyUseCase } from './reconcile-conversation-idle-policy.use-case';

describe('ReconcileConversationIdlePolicyUseCase', () => {
  it('expires bot-active conversations that passed idle expiration time', async () => {
    const sessionRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const persistenceRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      findBotActiveConversationsDueForExpiration: jest
        .fn()
        .mockResolvedValue([
          {
            conversationKey: 'whatsapp:123:573001112233',
            channel: 'whatsapp',
            participantPhone: '573001112233',
            phoneNumberId: '123',
            state: 'SELECTING_SPECIALTY',
            status: 'BOT_ACTIVE',
            createdAt: '2026-05-22T12:00:00.000Z',
            updatedAt: '2026-05-22T12:00:00.000Z',
            idleExpiresAt: '2026-05-22T12:20:00.000Z',
            context: {
              interactivePromptWindow: {
                currentPromptId: 'prompt:1',
                prompts: [
                  {
                    promptId: 'prompt:1',
                    logicalStepKey: 'SELECTING_SPECIALTY:ROOT',
                    promptKind: 'SPECIALTY_SELECTION',
                    state: 'SELECTING_SPECIALTY',
                    outboundMessageId: 'wamid-1',
                    allowedReplyIds: ['specialty:890201'],
                    issuedAt: '2026-05-22T12:00:00.000Z',
                    source: 'ORIGINAL',
                  },
                ],
              },
            },
          },
        ]),
      findBotActiveConversationsDueForIdleReminder: jest
        .fn()
        .mockResolvedValue([]),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new ReconcileConversationIdlePolicyUseCase(
      persistenceRepository as any,
      sessionRepository as any,
      {
        isEnabled: jest.fn().mockReturnValue(true),
        getBatchSize: jest.fn().mockReturnValue(100),
        getReminderAfterMinutes: jest.fn().mockReturnValue(15),
      } as any,
      {
        buildForState: jest.fn(),
      } as any,
      {
        buildNavigationMessage: jest.fn(),
      } as any,
      {
        clear: jest.fn().mockReturnValue(undefined),
      } as any,
      auditService,
    );

    const result = await useCase.execute('2026-05-22T12:25:00.000Z');

    expect(result.expiredCount).toBe(1);
    expect(persistenceRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'EXPIRED',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      'conversation.expired.by_inactivity',
      expect.any(Object),
    );
  });

  it('sends a single reminder payload for bot-active conversation in reminder window', async () => {
    const sessionRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    const persistenceRepository = {
      upsert: jest.fn().mockResolvedValue(undefined),
      findBotActiveConversationsDueForExpiration: jest
        .fn()
        .mockResolvedValue([]),
      findBotActiveConversationsDueForIdleReminder: jest
        .fn()
        .mockResolvedValue([
          {
            conversationKey: 'whatsapp:123:573001112233',
            channel: 'whatsapp',
            participantPhone: '573001112233',
            phoneNumberId: '123',
            state: 'SELECTING_SPECIALTY',
            status: 'BOT_ACTIVE',
            createdAt: '2026-05-22T12:00:00.000Z',
            updatedAt: '2026-05-22T12:00:00.000Z',
          },
        ]),
    };
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    const useCase = new ReconcileConversationIdlePolicyUseCase(
      persistenceRepository as any,
      sessionRepository as any,
      {
        isEnabled: jest.fn().mockReturnValue(true),
        getBatchSize: jest.fn().mockReturnValue(100),
        getReminderAfterMinutes: jest.fn().mockReturnValue(15),
      } as any,
      {
        buildForState: jest.fn().mockReturnValue({
          nextState: 'SELECTING_SPECIALTY',
          outboundMessages: [
            {
              type: 'interactive_list',
              body: 'Especialidades',
              buttonText: 'Ver',
              sections: [
                {
                  title: 'Activas',
                  rows: [
                    { id: 'specialty:890201', title: 'MEDICINA GENERAL' },
                  ],
                },
              ],
            },
          ],
        }),
      } as any,
      {
        buildNavigationMessage: jest.fn().mockReturnValue({
          type: 'interactive_buttons',
          body: '\u200B',
          buttons: [{ id: 'nav_back', title: 'Volver' }],
        }),
      } as any,
      {
        clear: jest.fn(),
      } as any,
      auditService,
    );

    const result = await useCase.execute('2026-05-22T12:15:00.000Z');

    expect(result.expiredCount).toBe(0);
    expect(result.remindersToDispatch).toHaveLength(1);
    expect(result.remindersToDispatch[0].outboundMessages[0]).toMatchObject({
      type: 'text',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      'conversation.idle.reminder.sent',
      expect.any(Object),
    );
  });
});
