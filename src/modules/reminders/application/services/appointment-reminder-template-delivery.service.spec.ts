import { AuditService } from '../../../audit/application/services/audit.service';
import type { SaveOutboundConversationMessageInput } from '../../../conversations/domain/ports/conversation-message.repository';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import type { AppointmentReminderOutboxRepository } from '../../domain/ports/appointment-reminder-outbox.repository';
import { AppointmentReminderDispatchConfigService } from './appointment-reminder-dispatch-config.service';
import { AppointmentReminderTemplateDeliveryService } from './appointment-reminder-template-delivery.service';
import { SendWhatsappTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-template-message.use-case';
import { AppointmentReminderRuntimeSettingsResolverService } from './appointment-reminder-runtime-settings-resolver.service';

describe('AppointmentReminderTemplateDeliveryService', () => {
  it('uses mock delivery mode when configured and persists outbound metadata', async () => {
    const saveOutbound = jest.fn().mockResolvedValue(undefined);
    const execute = jest.fn();
    const record = jest.fn().mockResolvedValue(undefined);
    const reserve = jest.fn().mockResolvedValue(undefined);
    const markSent = jest.fn().mockResolvedValue(undefined);
    const markFailed = jest.fn().mockResolvedValue(undefined);

    const conversationMessageRepository = {
      saveOutbound,
    } as ConversationMessageRepository;

    const reminderOutboxRepository = {
      reserve,
      markSent,
      markFailed,
    } as AppointmentReminderOutboxRepository;

    const sendWhatsappTemplateMessage = {
      execute,
    } as unknown as SendWhatsappTemplateMessageUseCase;

    const auditService = {
      record,
    } as AuditService;

    const configService = {
      isMockSendMode: jest.fn().mockReturnValue(true),
      isWithinReminderSendRollout: jest.fn().mockReturnValue(true),
    } as unknown as AppointmentReminderDispatchConfigService;

    const service = new AppointmentReminderTemplateDeliveryService(
      configService,
      sendWhatsappTemplateMessage,
      reminderOutboxRepository,
      conversationMessageRepository,
      auditService,
    );

    const result = await service.send({
      conversationKey: 'whatsapp:1:573001234567',
      dispatchId: 91,
      patientLegacyUserId: 5001,
      to: '573001234567',
      templateName: 'recordatorio_cita_24h',
      languageCode: 'es_CO',
      bodyTextParameters: ['PACIENTE'],
      trigger: 'appointment_reminder.dispatch_due',
    });

    expect(execute).not.toHaveBeenCalled();
    expect(reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        deduplicationKey:
          'appointment-reminder:91:recordatorio_cita_24h:appointment_reminder.dispatch_due',
      }),
    );
    expect(markSent).toHaveBeenCalledWith(
      expect.objectContaining({
        deduplicationKey:
          'appointment-reminder:91:recordatorio_cita_24h:appointment_reminder.dispatch_due',
      }),
    );
    const [savedMessage] = saveOutbound.mock.calls as Array<
      [SaveOutboundConversationMessageInput]
    >;

    expect(savedMessage?.[0]).toMatchObject({
      conversationKey: 'whatsapp:1:573001234567',
      messageType: 'template',
      to: '573001234567',
      whatsappMessageId: 'mock:91:recordatorio_cita_24h',
      body: 'template:recordatorio_cita_24h',
    });
    expect(typeof savedMessage?.[0].sentAt).toBe('string');
    expect(record).toHaveBeenCalledWith(
      'appointment_reminder.template.mock_sent',
      expect.objectContaining({
        dispatchId: 91,
        templateName: 'recordatorio_cita_24h',
        deliveryMode: 'mock',
      }),
    );
    expect(result).toEqual({
      messageId: 'mock:91:recordatorio_cita_24h',
      deliveryMode: 'mock',
    });
  });

  it('uses live delivery mode when the send cohort includes the patient', async () => {
    const saveOutbound = jest.fn().mockResolvedValue(undefined);
    const execute = jest.fn().mockResolvedValue({ messageId: 'wamid-live-1' });
    const record = jest.fn().mockResolvedValue(undefined);
    const reserve = jest.fn().mockResolvedValue(undefined);
    const markSent = jest.fn().mockResolvedValue(undefined);
    const markFailed = jest.fn().mockResolvedValue(undefined);

    const conversationMessageRepository = {
      saveOutbound,
    } as ConversationMessageRepository;

    const reminderOutboxRepository = {
      reserve,
      markSent,
      markFailed,
    } as AppointmentReminderOutboxRepository;

    const sendWhatsappTemplateMessage = {
      execute,
    } as unknown as SendWhatsappTemplateMessageUseCase;

    const auditService = {
      record,
    } as AuditService;

    const configService = {
      isMockSendMode: jest.fn().mockReturnValue(false),
      isWithinReminderSendRollout: jest.fn().mockReturnValue(true),
    } as unknown as AppointmentReminderDispatchConfigService;

    const service = new AppointmentReminderTemplateDeliveryService(
      configService,
      sendWhatsappTemplateMessage,
      reminderOutboxRepository,
      conversationMessageRepository,
      auditService,
    );

    const result = await service.send({
      conversationKey: 'whatsapp:1:573001234568',
      dispatchId: 92,
      patientLegacyUserId: 5002,
      to: '573001234568',
      templateName: 'verificacion_telefono_paciente',
      languageCode: 'es_CO',
      quickReplyButtons: [
        { index: '0', payload: 'confirm:token' },
        { index: '1', payload: 'reject:token' },
      ],
      trigger: 'appointment_reminder.phone_verification',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'verificacion_telefono_paciente',
        quickReplyButtons: [
          { index: '0', payload: 'confirm:token' },
          { index: '1', payload: 'reject:token' },
        ],
      }),
    );
    const [savedLiveMessage] = saveOutbound.mock.calls as Array<
      [SaveOutboundConversationMessageInput]
    >;

    expect(savedLiveMessage?.[0]).toMatchObject({
      conversationKey: 'whatsapp:1:573001234568',
      messageType: 'template',
      to: '573001234568',
      whatsappMessageId: 'wamid-live-1',
      body: 'template:verificacion_telefono_paciente',
    });
    expect(typeof savedLiveMessage?.[0].sentAt).toBe('string');
    expect(markSent).toHaveBeenCalledWith(
      expect.objectContaining({
        deduplicationKey:
          'appointment-reminder:92:verificacion_telefono_paciente:appointment_reminder.phone_verification',
      }),
    );
    expect(result).toEqual({
      messageId: 'wamid-live-1',
      deliveryMode: 'live',
    });
  });

  it('prefers runtime resolver settings over bootstrap config when available', async () => {
    const saveOutbound = jest.fn().mockResolvedValue(undefined);
    const execute = jest.fn().mockResolvedValue({ messageId: 'wamid-live-2' });
    const record = jest.fn().mockResolvedValue(undefined);
    const reserve = jest.fn().mockResolvedValue(undefined);
    const markSent = jest.fn().mockResolvedValue(undefined);
    const markFailed = jest.fn().mockResolvedValue(undefined);

    const conversationMessageRepository = {
      saveOutbound,
    } as ConversationMessageRepository;

    const reminderOutboxRepository = {
      reserve,
      markSent,
      markFailed,
    } as AppointmentReminderOutboxRepository;

    const sendWhatsappTemplateMessage = {
      execute,
    } as unknown as SendWhatsappTemplateMessageUseCase;

    const auditService = {
      record,
    } as AuditService;

    const configService = {
      isMockSendMode: jest.fn().mockReturnValue(true),
      isWithinReminderSendRollout: jest.fn().mockReturnValue(true),
    } as unknown as AppointmentReminderDispatchConfigService;

    const runtimeResolver = {
      resolveEffectiveHotReloadableSettings: jest.fn().mockResolvedValue({
        sendMode: 'live' as const,
        sendRolloutPercent: 100,
        emergencyPauseEnabled: false,
        dispatchBatchSize: 50,
        eligibilityLimit: 500,
        lockTtlSeconds: 300,
        lockHeartbeatIntervalMs: 60_000,
        minConfirmationHours: 3,
      }),
    } as unknown as AppointmentReminderRuntimeSettingsResolverService;

    const service = new AppointmentReminderTemplateDeliveryService(
      configService,
      sendWhatsappTemplateMessage,
      reminderOutboxRepository,
      conversationMessageRepository,
      auditService,
      runtimeResolver,
    );

    const result = await service.send({
      conversationKey: 'whatsapp:1:573001234579',
      dispatchId: 93,
      patientLegacyUserId: 5003,
      to: '573001234579',
      templateName: 'recordatorio_cita_24h',
      languageCode: 'es_CO',
      bodyTextParameters: ['PACIENTE'],
      trigger: 'appointment_reminder.dispatch_due',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalledWith(
      'appointment_reminder.template.mock_sent',
      expect.anything(),
    );
    expect(result).toEqual({
      messageId: 'wamid-live-2',
      deliveryMode: 'live',
    });
  });
});
