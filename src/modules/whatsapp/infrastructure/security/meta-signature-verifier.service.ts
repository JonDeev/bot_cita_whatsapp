import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WhatsappSignatureVerifierPort } from '../../domain/ports/whatsapp-signature-verifier.port';
import { WhatsappConfigService } from '../../application/services/whatsapp-config.service';

@Injectable()
export class MetaSignatureVerifierService implements WhatsappSignatureVerifierPort {
  private readonly logger = new Logger(MetaSignatureVerifierService.name);

  constructor(private readonly configService: WhatsappConfigService) {}

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const appSecret = this.configService.getAppSecret();
    if (!appSecret) {
      this.logger.error('WHATSAPP_APP_SECRET is missing.');
      return false;
    }

    if (!signatureHeader?.startsWith('sha256=')) {
      return false;
    }

    const expectedDigest = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const expectedSignature = Buffer.from(`sha256=${expectedDigest}`);
    const receivedSignature = Buffer.from(signatureHeader);

    if (expectedSignature.length !== receivedSignature.length) {
      return false;
    }

    return timingSafeEqual(expectedSignature, receivedSignature);
  }
}
