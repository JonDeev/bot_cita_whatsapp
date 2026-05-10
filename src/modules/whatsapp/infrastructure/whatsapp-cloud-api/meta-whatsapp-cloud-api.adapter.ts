import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { WhatsappConfigService } from '../../application/services/whatsapp-config.service';
import type { WhatsappMessageSenderPort } from '../../domain/ports/whatsapp-message-sender.port';
import {
  OutboundWhatsappFlowTemplateMessage,
  OutboundWhatsappInteractiveButtonsMessage,
  OutboundWhatsappInteractiveListMessage,
  OutboundWhatsappSendResult,
  OutboundWhatsappTextMessage,
} from '../../domain/value-objects/outbound-whatsapp-message';

interface MetaSendMessageResponse {
  messages?: Array<{
    id?: string;
  }>;
  error?: {
    message?: string;
    code?: number;
    type?: string;
    error_data?: {
      details?: string;
    };
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

const MAX_FETCH_ATTEMPTS = 2;
const INITIAL_RETRY_DELAY_MS = 250;
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

@Injectable()
export class MetaWhatsappCloudApiAdapter implements WhatsappMessageSenderPort {
  private readonly logger = new Logger(MetaWhatsappCloudApiAdapter.name);

  constructor(private readonly configService: WhatsappConfigService) {}

  async sendTextMessage(
    message: OutboundWhatsappTextMessage,
  ): Promise<OutboundWhatsappSendResult> {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'text',
      text: {
        body: message.body,
        preview_url: false,
      },
    });
  }

  async sendInteractiveListMessage(
    message: OutboundWhatsappInteractiveListMessage,
  ): Promise<OutboundWhatsappSendResult> {
    const response = await this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: message.body,
        },
        action: {
          button: message.buttonText,
          sections: message.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
            })),
          })),
        },
      },
    });

    return response;
  }

  async sendInteractiveButtonsMessage(
    message: OutboundWhatsappInteractiveButtonsMessage,
  ): Promise<OutboundWhatsappSendResult> {
    const response = await this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: message.body,
        },
        action: {
          buttons: message.buttons.map((button) => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    });

    return response;
  }

  async sendFlowTemplateMessage(
    message: OutboundWhatsappFlowTemplateMessage,
  ): Promise<OutboundWhatsappSendResult> {
    const components: Array<Record<string, unknown>> = [];

    if (message.bodyTextParameters && message.bodyTextParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: message.bodyTextParameters.map((text) => ({
          type: 'text',
          text,
        })),
      });
    }

    components.push({
      type: 'button',
      sub_type: 'flow',
      index: message.buttonIndex,
      parameters: [
        {
          type: 'action',
          action: {
            flow_token: message.flowToken,
            ...(message.flowActionData && Object.keys(message.flowActionData).length > 0
              ? { flow_action_data: message.flowActionData }
              : {}),
          },
        },
      ],
    });

    return this.send({
      messaging_product: 'whatsapp',
      to: message.to,
      type: 'template',
      template: {
        name: message.templateName,
        language: {
          code: message.languageCode,
        },
        components,
      },
    });
  }

  private async send(payload: Record<string, unknown>): Promise<OutboundWhatsappSendResult> {
    const accessToken = this.configService.getAccessToken();
    const phoneNumberId = this.configService.getPhoneNumberId();
    const apiBaseUrl = this.configService.getApiBaseUrl();
    const apiVersion = this.configService.getApiVersion();

    if (!accessToken || !phoneNumberId) {
      throw new InternalServerErrorException('Missing WhatsApp API credentials.');
    }

    const endpoint = `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;
    const response = await this.sendWithRetry(endpoint, accessToken, payload);

    const json = await this.parseResponseJson(response);

    if (!response.ok) {
      const details = this.buildApiErrorDetails(response.status, json.error);
      if (response.status === 401) {
        throw new UnauthorizedException(details);
      }

      throw new InternalServerErrorException(details);
    }

    const messageId = json.messages?.[0]?.id;
    if (!messageId) {
      throw new InternalServerErrorException('WhatsApp API response does not include message id.');
    }

    return { messageId };
  }

  private async sendWithRetry(
    endpoint: string,
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < MAX_FETCH_ATTEMPTS) {
      attempt += 1;
      try {
        return await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastError = error;
        const details = this.buildFetchErrorDetails(error);
        const shouldRetry =
          attempt < MAX_FETCH_ATTEMPTS && this.isRetryableNetworkError(error);

        if (shouldRetry) {
          this.logger.warn(
            `WhatsApp API transport error on attempt ${attempt}/${MAX_FETCH_ATTEMPTS}; retrying in ${INITIAL_RETRY_DELAY_MS}ms. ${details}`,
          );
          await this.delay(INITIAL_RETRY_DELAY_MS);
          continue;
        }

        throw new InternalServerErrorException(
          `WhatsApp API transport error after ${attempt} attempt(s). ${details}`,
          {
            cause: error instanceof Error ? error : undefined,
          },
        );
      }
    }

    throw new InternalServerErrorException(
      `WhatsApp API transport error after ${MAX_FETCH_ATTEMPTS} attempt(s). ${this.buildFetchErrorDetails(
        lastError,
      )}`,
    );
  }

  private async parseResponseJson(response: Response): Promise<MetaSendMessageResponse> {
    try {
      return (await response.json()) as MetaSendMessageResponse;
    } catch {
      return {};
    }
  }

  private buildApiErrorDetails(
    status: number,
    error: MetaSendMessageResponse['error'],
  ): string {
    const message = error?.message ?? 'Unknown error.';
    const details = error?.error_data?.details ? ` details=${error.error_data.details}` : '';
    const code = error?.code ? ` code=${error.code}` : '';
    const subcode = error?.error_subcode ? ` subcode=${error.error_subcode}` : '';
    const type = error?.type ? ` type=${error.type}` : '';
    const trace = error?.fbtrace_id ? ` trace=${error.fbtrace_id}` : '';

    return `WhatsApp API request failed with status ${status}. ${message}${details}${code}${subcode}${type}${trace}`;
  }

  private isRetryableNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const cause = this.extractErrorCause(error);
    if (!cause?.code) {
      return false;
    }

    return RETRYABLE_NETWORK_ERROR_CODES.has(cause.code);
  }

  private buildFetchErrorDetails(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'unknown fetch transport error.';
    }

    const cause = this.extractErrorCause(error);
    const causeCode = cause?.code ? ` causeCode=${cause.code}` : '';
    const causeMessage = cause?.message ? ` causeMessage=${cause.message}` : '';

    return `message=${error.message}${causeCode}${causeMessage}`;
  }

  private extractErrorCause(
    error: Error,
  ): {
    code?: string;
    message?: string;
  } | null {
    const cause = error.cause;
    if (!cause || typeof cause !== 'object') {
      return null;
    }

    const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
    const message =
      'message' in cause && typeof cause.message === 'string' ? cause.message : undefined;

    return { code, message };
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
