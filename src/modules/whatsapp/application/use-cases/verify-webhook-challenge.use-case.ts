import { Injectable, UnauthorizedException } from '@nestjs/common';
import { WhatsappConfigService } from '../services/whatsapp-config.service';

export interface VerifyWebhookChallengeInput {
  mode?: string;
  verifyToken?: string;
  challenge?: string;
}

@Injectable()
export class VerifyWebhookChallengeUseCase {
  constructor(private readonly configService: WhatsappConfigService) {}

  execute(input: VerifyWebhookChallengeInput): string {
    if (input.mode !== 'subscribe') {
      throw new UnauthorizedException(
        'Invalid hub.mode for webhook verification.',
      );
    }

    const expectedVerifyToken = this.configService.getVerifyToken();
    if (!expectedVerifyToken || input.verifyToken !== expectedVerifyToken) {
      throw new UnauthorizedException('Invalid verify token.');
    }

    if (!input.challenge) {
      throw new UnauthorizedException('Missing challenge.');
    }

    return input.challenge;
  }
}
