import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@whatsapp-bot/prisma-client';
import { AuditService } from '../../../audit/application/services/audit.service';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type {
  ConversationMessageRepository,
  TemplateMessageSnapshot,
} from '../../../conversations/domain/ports/conversation-message.repository';
import { APPOINTMENT_REMINDER_OUTBOX_REPOSITORY } from '../../domain/reminders.tokens';
import type { AppointmentReminderOutboxRepository } from '../../domain/ports/appointment-reminder-outbox.repository';
import {
  APPOINTMENT_REMINDER_SEND_MODES,
} from '../../domain/appointment-reminder-runtime.types';
import { AppointmentReminderDispatchConfigService } from './appointment-reminder-dispatch-config.service';
import { SendWhatsappTemplateMessageUseCase } from '../../../whatsapp/application/use-cases/outbound/send-whatsapp-template-message.use-case';
import type {
  OutboundWhatsappSendResult,
  OutboundWhatsappTemplateQuickReplyButton,
} from '../../../whatsapp/domain/value-objects/outbound-whatsapp-message';
import { AppointmentReminderRuntimeSettingsResolverService } from './appointment-reminder-runtime-settings-resolver.service';

export interface AppointmentReminderTemplateDeliveryInput {
  conversationKey: string;
  dispatchId: number;
  patientLegacyUserId: number;
  to: string;
  templateName: string;
  languageCode: string;
  trigger: string;
  bodyTextParameters?: string[];
  quickReplyButtons?: OutboundWhatsappTemplateQuickReplyButton[];
  templateSnapshot: TemplateMessageSnapshot;
}

export interface AppointmentReminderTemplateDeliveryResult extends OutboundWhatsappSendResult {
  deliveryMode: 'live' | 'mock';
}

interface AppointmentReminderOutboxQuickReplyButton {
  [key: string]: Prisma.JsonValue;
  index: string;
  payload: string;
}

interface AppointmentReminderOutboxPayload {
  [key: string]: Prisma.JsonValue;
  kind: 'appointment_reminder_template';
  dispatchId: number;
  conversationKey: string;
  recipientPhone: string;
  templateName: string;
  languageCode: string;
  trigger: string;
  bodyTextParameters: string[];
  quickReplyButtons: AppointmentReminderOutboxQuickReplyButton[];
  deliveryMode: 'live' | 'mock';
  messageId: string | null;
}

@Injectable()
export class AppointmentReminderTemplateDeliveryService {
  private readonly logger = new Logger(
    AppointmentReminderTemplateDeliveryService.name,
  );

  constructor(
    private readonly configService: AppointmentReminderDispatchConfigService,
    private readonly sendWhatsappTemplateMessage: SendWhatsappTemplateMessageUseCase,
    @Inject(APPOINTMENT_REMINDER_OUTBOX_REPOSITORY)
    private readonly reminderOutboxRepository: AppointmentReminderOutboxRepository,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly auditService: AuditService,
    private readonly runtimeResolver?: AppointmentReminderRuntimeSettingsResolverService,
  ) {}

  async send(
    input: AppointmentReminderTemplateDeliveryInput,
  ): Promise<AppointmentReminderTemplateDeliveryResult> {
    const runtimeSettings =
      await this.resolveRuntimeHotReloadableSettings();
    const deliveryMode = this.resolveDeliveryMode(
      input.patientLegacyUserId,
      runtimeSettings.sendMode,
      runtimeSettings.sendRolloutPercent,
      runtimeSettings.emergencyPauseEnabled,
    );
    const sentAtIso = new Date().toISOString();
    const deduplicationKey = this.buildDeduplicationKey(input);

    await this.reminderOutboxRepository.reserve({
      deduplicationKey,
      conversationKey: input.conversationKey,
      recipientPhone: input.to,
      payload: this.buildOutboxPayload(input, deliveryMode, null),
    });

    const result = await this.sendAndMarkOutbox({
      input,
      deduplicationKey,
      sentAtIso,
      deliveryMode,
    });

    await this.persistOutboundTemplateMessage({
      conversationKey: input.conversationKey,
      dispatchId: input.dispatchId,
      messageId: result.messageId,
      templateName: input.templateName,
      to: input.to,
      sentAtIso,
      trigger: input.trigger,
      deliveryMode,
      templateSnapshot: input.templateSnapshot,
    });

    return result;
  }

  private resolveDeliveryMode(
    patientLegacyUserId: number,
    sendMode: 'live' | 'mock',
    sendRolloutPercent: number,
    emergencyPauseEnabled: boolean,
  ): 'live' | 'mock' {
    if (emergencyPauseEnabled) {
      throw new Error('Emergency pause is active for appointment reminders.');
    }

    if (sendMode === APPOINTMENT_REMINDER_SEND_MODES.MOCK) {
      return 'mock';
    }

    if (
      !this.configService.isWithinReminderSendRollout(
        patientLegacyUserId,
        sendRolloutPercent,
      )
    ) {
      return 'mock';
    }

    return 'live';
  }

  private async resolveRuntimeHotReloadableSettings(): Promise<{
    sendMode: 'live' | 'mock';
    sendRolloutPercent: number;
    emergencyPauseEnabled: boolean;
  }> {
    if (this.runtimeResolver) {
      return this.runtimeResolver.resolveEffectiveHotReloadableSettings();
    }

    const legacyIsMockSendMode =
      'isMockSendMode' in this.configService &&
      typeof this.configService.isMockSendMode === 'function'
        ? this.configService.isMockSendMode()
        : false;
    const legacyRolloutPercent =
      'getSendRolloutPercent' in this.configService &&
      typeof this.configService.getSendRolloutPercent === 'function'
        ? this.configService.getSendRolloutPercent()
        : 100;

    return {
      sendMode: legacyIsMockSendMode ? 'mock' : 'live',
      sendRolloutPercent: legacyRolloutPercent,
      emergencyPauseEnabled: false,
    };
  }

  private buildMockMessageId(input: {
    dispatchId: number;
    templateName: string;
  }): string {
    return `mock:${input.dispatchId}:${input.templateName}`;
  }

  private async sendAndMarkOutbox(input: {
    input: AppointmentReminderTemplateDeliveryInput;
    deduplicationKey: string;
    sentAtIso: string;
    deliveryMode: 'live' | 'mock';
  }): Promise<AppointmentReminderTemplateDeliveryResult> {
    const result = await this.sendWhatsAppTemplateMessageWithFallback(input);

    try {
      await this.reminderOutboxRepository.markSent({
        deduplicationKey: input.deduplicationKey,
        payload: this.buildOutboxPayload(
          input.input,
          input.deliveryMode,
          result.messageId,
        ),
        sentAtIso: input.sentAtIso,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.auditService.record(
        'appointment_reminder.template.outbox_mark_sent_failed',
        {
          dispatchId: input.input.dispatchId,
          templateName: input.input.templateName,
          trigger: input.input.trigger,
          deliveryMode: input.deliveryMode,
          errorMessage,
        },
      );
      throw error;
    }

    return {
      messageId: result.messageId,
      deliveryMode: input.deliveryMode,
    };
  }

  private async sendWhatsAppTemplateMessageWithFallback(input: {
    input: AppointmentReminderTemplateDeliveryInput;
    deduplicationKey: string;
    deliveryMode: 'live' | 'mock';
  }): Promise<OutboundWhatsappSendResult> {
    let result: OutboundWhatsappSendResult;

    try {
      result =
        input.deliveryMode === APPOINTMENT_REMINDER_SEND_MODES.LIVE
          ? await this.sendWhatsappTemplateMessage.execute({
              to: input.input.to,
              templateName: input.input.templateName,
              languageCode: input.input.languageCode,
              bodyTextParameters: input.input.bodyTextParameters,
              quickReplyButtons: input.input.quickReplyButtons,
              trigger: input.input.trigger,
            })
          : { messageId: this.buildMockMessageId(input.input) };

      if (input.deliveryMode === APPOINTMENT_REMINDER_SEND_MODES.MOCK) {
        await this.auditService.record(
          'appointment_reminder.template.mock_sent',
          {
            dispatchId: input.input.dispatchId,
            templateName: input.input.templateName,
            trigger: input.input.trigger,
            deliveryMode: input.deliveryMode,
          },
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.reminderOutboxRepository.markFailed({
        deduplicationKey: input.deduplicationKey,
        errorMessage,
      });
      throw error;
    }

    return result;
  }

  private buildDeduplicationKey(
    input: AppointmentReminderTemplateDeliveryInput,
  ): string {
    return [
      'appointment-reminder',
      input.dispatchId,
      input.templateName,
      input.trigger,
    ].join(':');
  }

  private buildOutboxPayload(
    input: AppointmentReminderTemplateDeliveryInput,
    deliveryMode: 'live' | 'mock',
    messageId: string | null,
  ): Prisma.InputJsonValue {
    const payload: AppointmentReminderOutboxPayload = {
      kind: 'appointment_reminder_template',
      dispatchId: input.dispatchId,
      conversationKey: input.conversationKey,
      recipientPhone: input.to,
      templateName: input.templateName,
      languageCode: input.languageCode,
      trigger: input.trigger,
      bodyTextParameters: input.bodyTextParameters ?? [],
      quickReplyButtons: (input.quickReplyButtons ?? []).map((button) => ({
        index: button.index,
        payload: button.payload,
      })),
      deliveryMode,
      messageId,
    };

    return payload as Prisma.InputJsonValue;
  }

  private async persistOutboundTemplateMessage(input: {
    conversationKey: string;
    dispatchId: number;
    messageId: string;
    templateName: string;
    to: string;
    sentAtIso: string;
    trigger: string;
    deliveryMode: 'live' | 'mock';
    templateSnapshot: TemplateMessageSnapshot;
  }): Promise<void> {
    try {
      await this.conversationMessageRepository.saveOutbound({
        conversationKey: input.conversationKey,
        messageType: 'template',
        to: input.to,
        whatsappMessageId: input.messageId,
        body: input.templateSnapshot.visibleBody,
        sentAt: input.sentAtIso,
        templateSnapshot: input.templateSnapshot,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to persist reminder outbound message for dispatch ${input.dispatchId}.`,
      );
      await this.auditService.record(
        'appointment_reminder.template.outbound_persistence_failed',
        {
          dispatchId: input.dispatchId,
          templateName: input.templateName,
          trigger: input.trigger,
          deliveryMode: input.deliveryMode,
          messageId: input.messageId,
          errorMessage,
        },
      );
    }
  }
}
