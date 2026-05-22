import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HandleIncomingConversationMessageUseCase } from '../../../conversations/application/use-cases/handle-incoming-conversation-message.use-case';
import { ReconcileConversationIdlePolicyUseCase } from '../../../conversations/application/use-cases/reconcile-conversation-idle-policy.use-case';
import { CONVERSATION_MESSAGE_REPOSITORY } from '../../../conversations/domain/conversations.tokens';
import type { ConversationMessageRepository } from '../../../conversations/domain/ports/conversation-message.repository';
import type { ConversationOutboundMessage } from '../../../conversations/domain/value-objects/conversation-outbound-message';
import { RedisService } from '../../../../shared/infrastructure/redis/redis.service';
import { SendWhatsappInteractiveButtonsMessageUseCase } from '../../application/use-cases/outbound/send-whatsapp-interactive-buttons-message.use-case';
import { SendWhatsappInteractiveListMessageUseCase } from '../../application/use-cases/outbound/send-whatsapp-interactive-list-message.use-case';
import { SendWhatsappTextMessageUseCase } from '../../application/use-cases/outbound/send-whatsapp-text-message.use-case';
import { ConversationIdlePolicySchedulerConfigService } from './conversation-idle-policy-scheduler-config.service';

@Injectable()
export class ConversationIdlePolicyScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConversationIdlePolicyScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly reconcileIdlePolicyUseCase: ReconcileConversationIdlePolicyUseCase,
    private readonly handleIncomingConversationMessageUseCase: HandleIncomingConversationMessageUseCase,
    @Inject(CONVERSATION_MESSAGE_REPOSITORY)
    private readonly conversationMessageRepository: ConversationMessageRepository,
    private readonly sendWhatsappInteractiveListMessage: SendWhatsappInteractiveListMessageUseCase,
    private readonly sendWhatsappInteractiveButtonsMessage: SendWhatsappInteractiveButtonsMessageUseCase,
    private readonly sendWhatsappTextMessage: SendWhatsappTextMessageUseCase,
    private readonly redisService: RedisService,
    private readonly configService: ConversationIdlePolicySchedulerConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.getTickIntervalMs();
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    void this.tick();
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    const lockKey = 'conversation:idle-policy:tick-lock';
    const lockAcquired = await this.redisService.setIfAbsent(
      lockKey,
      new Date().toISOString(),
      this.configService.getLockTtlSeconds(),
    );
    if (!lockAcquired) {
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      const result = await this.reconcileIdlePolicyUseCase.execute(nowIso);
      for (const reminder of result.remindersToDispatch) {
        const dispatchedInteractivePrompts: Array<{
          outboundMessage: ConversationOutboundMessage;
          whatsappMessageId: string;
          source: 'IDLE_REMINDER_REISSUE' | 'ORIGINAL';
          issuedAt: string;
        }> = [];
        let reminderSourceAssigned = false;

        for (const outboundMessage of reminder.outboundMessages) {
          const dispatchResult = await this.dispatchOutboundMessage(
            reminder.session.conversationKey,
            reminder.session.participantPhone,
            outboundMessage,
          );
          if (
            dispatchResult &&
            outboundMessage.type !== 'text' &&
            dispatchResult.whatsappMessageId
          ) {
            dispatchedInteractivePrompts.push({
              outboundMessage,
              whatsappMessageId: dispatchResult.whatsappMessageId,
              source: reminderSourceAssigned
                ? 'ORIGINAL'
                : 'IDLE_REMINDER_REISSUE',
              issuedAt: dispatchResult.sentAt,
            });
            reminderSourceAssigned = true;
          }
        }

        if (dispatchedInteractivePrompts.length > 0) {
          await this.handleIncomingConversationMessageUseCase.registerDispatchedInteractivePrompts(
            {
              session: reminder.session,
              dispatchedInteractivePrompts,
            },
          );
        }
      }

      this.logger.log(
        `Conversation idle policy tick completed. reminders=${result.remindersToDispatch.length} expired=${result.expiredCount}.`,
      );
    } catch (error) {
      this.logger.error(
        'Conversation idle policy tick failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async dispatchOutboundMessage(
    conversationKey: string,
    to: string,
    outboundMessage: ConversationOutboundMessage,
  ): Promise<{ whatsappMessageId: string; sentAt: string } | null> {
    const sentAt = new Date().toISOString();

    try {
      if (outboundMessage.type === 'interactive_list') {
        const response = await this.sendWhatsappInteractiveListMessage.execute({
          to,
          body: outboundMessage.body,
          buttonText: outboundMessage.buttonText,
          sections: outboundMessage.sections,
          trigger: 'conversation_idle_reminder',
        });
        await this.conversationMessageRepository.saveOutbound({
          conversationKey,
          messageType: 'interactive',
          to,
          whatsappMessageId: response.messageId,
          body: outboundMessage.body,
          sentAt,
        });
        return { whatsappMessageId: response.messageId, sentAt };
      }

      if (outboundMessage.type === 'interactive_buttons') {
        const response =
          await this.sendWhatsappInteractiveButtonsMessage.execute({
            to,
            body: outboundMessage.body,
            buttons: outboundMessage.buttons,
            trigger: 'conversation_idle_reminder',
          });
        await this.conversationMessageRepository.saveOutbound({
          conversationKey,
          messageType: 'interactive',
          to,
          whatsappMessageId: response.messageId,
          body: outboundMessage.body,
          sentAt,
        });
        return { whatsappMessageId: response.messageId, sentAt };
      }

      const response = await this.sendWhatsappTextMessage.execute({
        to,
        body: outboundMessage.body,
        trigger: 'conversation_idle_reminder',
      });
      await this.conversationMessageRepository.saveOutbound({
        conversationKey,
        messageType: 'text',
        to,
        whatsappMessageId: response.messageId,
        body: outboundMessage.body,
        sentAt,
      });
      return { whatsappMessageId: response.messageId, sentAt };
    } catch (error) {
      this.logger.error(
        `Failed to dispatch idle reminder outbound message to ${to}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }
}
