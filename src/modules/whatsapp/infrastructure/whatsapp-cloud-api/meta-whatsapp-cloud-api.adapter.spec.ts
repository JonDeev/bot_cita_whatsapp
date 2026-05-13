import { InternalServerErrorException } from '@nestjs/common';
import { WhatsappConfigService } from '../../application/services/whatsapp-config.service';
import { MetaWhatsappCloudApiAdapter } from './meta-whatsapp-cloud-api.adapter';

type MockedFetch = jest.MockedFunction<typeof fetch>;

describe('MetaWhatsappCloudApiAdapter', () => {
  const originalFetch = global.fetch;
  let mockedFetch: MockedFetch;

  const configService = {
    getAccessToken: jest.fn(() => 'token-123'),
    getPhoneNumberId: jest.fn(() => '112260851488328'),
    getApiBaseUrl: jest.fn(() => 'https://graph.facebook.com'),
    getApiVersion: jest.fn(() => 'v22.0'),
  } as unknown as WhatsappConfigService;

  beforeEach(() => {
    mockedFetch = jest.fn() as MockedFetch;
    global.fetch = mockedFetch;
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('retries once and succeeds on a retryable transport error', async () => {
    const firstError = new TypeError('fetch failed') as TypeError & {
      cause?: { code?: string; message?: string };
    };
    firstError.cause = {
      code: 'EAI_AGAIN',
      message: 'getaddrinfo EAI_AGAIN graph.facebook.com',
    };

    mockedFetch.mockRejectedValueOnce(firstError).mockResolvedValueOnce(
      createResponse({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: 'wamid-123' }],
        }),
      }),
    );

    const adapter = new MetaWhatsappCloudApiAdapter(configService);

    const result = await adapter.sendTextMessage({
      to: '573001112233',
      body: 'hola',
    });

    expect(result).toEqual({ messageId: 'wamid-123' });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a non-retryable transport error and exposes cause details', async () => {
    const nonRetryableError = new TypeError('fetch failed') as TypeError & {
      cause?: { code?: string; message?: string };
    };
    nonRetryableError.cause = { code: 'EINVAL', message: 'invalid argument' };
    mockedFetch.mockRejectedValue(nonRetryableError);

    const adapter = new MetaWhatsappCloudApiAdapter(configService);

    await expect(
      adapter.sendTextMessage({
        to: '573001112233',
        body: 'hola',
      }),
    ).rejects.toThrow(
      'WhatsApp API transport error after 1 attempt(s). message=fetch failed causeCode=EINVAL causeMessage=invalid argument',
    );
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('retries retryable transport errors and fails after max attempts', async () => {
    const retryableError = new TypeError('fetch failed') as TypeError & {
      cause?: { code?: string; message?: string };
    };
    retryableError.cause = {
      code: 'ECONNRESET',
      message: 'read ECONNRESET',
    };
    mockedFetch.mockRejectedValue(retryableError);

    const adapter = new MetaWhatsappCloudApiAdapter(configService);

    await expect(
      adapter.sendTextMessage({
        to: '573001112233',
        body: 'hola',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('sends a flow template message using the official template payload shape', async () => {
    mockedFetch.mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: 'wamid-flow-321' }],
        }),
      }),
    );

    const adapter = new MetaWhatsappCloudApiAdapter(configService);

    const result = await adapter.sendFlowTemplateMessage({
      to: '573001112233',
      templateName: 'satisfaction_survey_flow',
      languageCode: 'es_CO',
      bodyTextParameters: ['Adriana', 'MEDICINA GENERAL', '07:30'],
      buttonIndex: '0',
      flowToken: 'survey_dispatch:21:2026-05-10',
      flowActionData: {
        dispatch_id: '21',
      },
    });

    expect(result).toEqual({ messageId: 'wamid-flow-321' });
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v22.0/112260851488328/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '573001112233',
          type: 'template',
          template: {
            name: 'satisfaction_survey_flow',
            language: {
              code: 'es_CO',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Adriana' },
                  { type: 'text', text: 'MEDICINA GENERAL' },
                  { type: 'text', text: '07:30' },
                ],
              },
              {
                type: 'button',
                sub_type: 'flow',
                index: '0',
                parameters: [
                  {
                    type: 'action',
                    action: {
                      flow_token: 'survey_dispatch:21:2026-05-10',
                      flow_action_data: {
                        dispatch_id: '21',
                      },
                    },
                  },
                ],
              },
            ],
          },
        }),
      }),
    );
  });
});

function createResponse(input: {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}): Response {
  return input as unknown as Response;
}
