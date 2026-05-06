import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProcessWhatsappWebhookUseCase } from '../../application/use-cases/process-whatsapp-webhook.use-case';
import { VerifyWebhookChallengeUseCase } from '../../application/use-cases/verify-webhook-challenge.use-case';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  constructor(
    private readonly verifyWebhookChallenge: VerifyWebhookChallengeUseCase,
    private readonly processWhatsappWebhook: ProcessWhatsappWebhookUseCase,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') hubMode?: string,
    @Query('hub.verify_token') hubVerifyToken?: string,
    @Query('hub.challenge') hubChallenge?: string,
  ): string {
    return this.verifyWebhookChallenge.execute({
      mode: hubMode,
      verifyToken: hubVerifyToken,
      challenge: hubChallenge,
    });
  }

  @Post()
  @HttpCode(200)
  async receiveWebhook(
    @Req() request: RequestWithRawBody,
    @Headers('x-hub-signature-256') signatureHeader: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ received: true }> {
    await this.processWhatsappWebhook.execute({
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(payload ?? {})),
      signatureHeader,
      payload,
    });

    return { received: true };
  }
}
