import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { TemplateMessageSnapshotService } from '../../../../whatsapp/application/services/template-message-snapshot.service';
import { PrismaBotConversationMessageRepository } from './prisma-bot-conversation-message.repository';

describe('PrismaBotConversationMessageRepository', () => {
  it('stores inbound messages as idempotent upserts', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveInbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageId: 'wamid.1',
      messageType: 'text',
      from: '573001112233',
      phoneNumberId: '123',
      textBody: 'hola',
      interactiveReplyId: null,
      interactiveReplyTitle: null,
      contextMessageId: null,
      providerTimestamp: '1711111111',
      receivedAt: '2026-05-07T12:44:15.000Z',
    });

    expect(prismaBot.botConversation.upsert).toHaveBeenCalledTimes(1);
    expect(prismaBot.botMessage.upsert).toHaveBeenCalledTimes(1);
  });

  it('stores outbound template snapshots with provider message id when available', async () => {
    const templateSnapshotService = new TemplateMessageSnapshotService();
    const templateSnapshot =
      templateSnapshotService.buildAppointmentReminderSnapshot({
        templateName: 'recordatorio_cita_24h',
        languageCode: 'es_CO',
        bodyTextParameters: ['PACIENTE', 'Consulta medica', 'PRESENCIAL', '2026-05-26', '15:00', 'SANTA MARTA', 'CALLE 1', 'MEDICO'],
      });
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveOutbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageType: 'template',
      to: '573001112233',
      whatsappMessageId: 'wamid.out.1',
      body: templateSnapshot.visibleBody,
      sentAt: '2026-05-07T12:44:18.000Z',
      templateSnapshot,
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledTimes(1);
    expect(prismaBot.botMessage.create).not.toHaveBeenCalled();
    expect(prismaBot.botMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: templateSnapshot.visibleBody,
          payload: expect.objectContaining({
            kind: 'template_snapshot',
            templateName: 'recordatorio_cita_24h',
            transport: {
              to: '573001112233',
              messageType: 'template',
              whatsappMessageId: 'wamid.out.1',
            },
          }),
        }),
      }),
    );
  });

  it('stores flow template snapshots without leaking flow tokens', async () => {
    const templateSnapshotService = new TemplateMessageSnapshotService();
    const templateSnapshot =
      templateSnapshotService.buildSurveyFlowInvitationSnapshot({
        templateName: 'satisfaction_survey_flow',
        languageCode: 'es_CO',
        bodyTextParameters: ['Adriana', 'MEDICINA GENERAL', '07:30'],
        buttonIndex: '0',
        dispatchId: '22',
        surveyDateIso: '2026-05-10',
      });
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveOutbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageType: 'template',
      to: '573001112233',
      whatsappMessageId: 'wamid.flow.1',
      body: templateSnapshot.visibleBody,
      sentAt: '2026-05-07T12:44:18.000Z',
      templateSnapshot,
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: templateSnapshot.visibleBody,
          payload: expect.objectContaining({
            kind: 'template_snapshot',
            templateName: 'satisfaction_survey_flow',
            flowMetadata: {
              buttonIndex: '0',
              ctaLabel: 'Responder encuesta',
              dispatchId: '22',
              surveyDateIso: '2026-05-10',
            },
            transport: {
              to: '573001112233',
              messageType: 'template',
              whatsappMessageId: 'wamid.flow.1',
            },
          }),
        }),
      }),
    );
    const upsertCall = prismaBot.botMessage.upsert.mock.calls[0]?.[0];
    const payload = (upsertCall as any)?.create?.payload;
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty('flowToken');
    expect(payload?.flowMetadata).not.toHaveProperty('flowActionData');
  });

  it('stores verification button payloads as technical metadata only', async () => {
    const templateSnapshotService = new TemplateMessageSnapshotService();
    const templateSnapshot =
      templateSnapshotService.buildSurveyPhoneVerificationSnapshot({
        templateName: 'verificacion_telefono_paciente',
        languageCode: 'es_CO',
        bodyTextParameters: ['ADRIANA RUIZ'],
        visibleButtons: [
          { index: '0', title: 'Confirmar' },
          { index: '1', title: 'No lo reconozco' },
        ],
        buttonPayloads: [
          { index: '0', payload: 'ssv_confirm:abc123' },
          { index: '1', payload: 'ssv_reject:def456' },
        ],
      });
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveOutbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageType: 'template',
      to: '573001112233',
      whatsappMessageId: 'wamid.verify.1',
      body: templateSnapshot.visibleBody,
      sentAt: '2026-05-07T12:44:18.000Z',
      templateSnapshot,
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: templateSnapshot.visibleBody,
          payload: expect.objectContaining({
            kind: 'template_snapshot',
            buttonPayloads: [
              { index: '0', payload: 'ssv_confirm:abc123' },
              { index: '1', payload: 'ssv_reject:def456' },
            ],
          }),
        }),
      }),
    );
    const upsertCall = prismaBot.botMessage.upsert.mock.calls[0]?.[0];
    const payload = (upsertCall as any)?.create?.payload;
    expect(payload.body).toBeUndefined();
  });

  it('stores inbound interactive message body using interactive reply title fallback', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveInbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageId: 'wamid.2',
      messageType: 'interactive',
      from: '573001112233',
      phoneNumberId: '123',
      textBody: null,
      interactiveReplyId: 'specialty:890201',
      interactiveReplyTitle: 'MEDICINA GENERAL',
      contextMessageId: 'wamid.out.1',
      providerTimestamp: '1711111112',
      receivedAt: '2026-05-07T12:44:16.000Z',
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: 'MEDICINA GENERAL',
        }),
      }),
    );
  });

  it('stores outbound interactive placeholder body as visible fallback', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await repository.saveOutbound({
      conversationKey: 'whatsapp:123:573001112233',
      messageType: 'interactive',
      to: '573001112233',
      whatsappMessageId: 'wamid.out.2',
      body: '\u200B',
      sentAt: '2026-05-07T12:44:18.000Z',
    });

    expect(prismaBot.botMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          body: 'Mensaje interactivo',
        }),
      }),
    );
  });

  it('checks whether an outbound message id is known for the conversation', async () => {
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 99 }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await expect(
      repository.hasKnownOutboundMessage(
        'whatsapp:123:573001112233',
        'wamid.out.1',
      ),
    ).resolves.toBe(true);
  });

  it('resolves outbound message occurredAt for known context id', async () => {
    const occurredAt = new Date('2026-05-22T12:41:18.160Z');
    const prismaBot = {
      botConversation: {
        upsert: jest.fn().mockResolvedValue({ id: 10 }),
      },
      botMessage: {
        upsert: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ occurredAt }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotConversationMessageRepository(prismaBot);

    await expect(
      repository.findOutboundMessageOccurredAt?.(
        'whatsapp:123:573001112233',
        'wamid.out.1',
      ),
    ).resolves.toBe('2026-05-22T12:41:18.160Z');
  });
});
