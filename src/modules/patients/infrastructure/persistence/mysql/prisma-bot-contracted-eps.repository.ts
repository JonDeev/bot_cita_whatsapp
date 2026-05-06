import { Injectable } from '@nestjs/common';
import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import type { ContractedEpsRepository } from '../../../domain/ports/contracted-eps.repository';

@Injectable()
export class PrismaBotContractedEpsRepository implements ContractedEpsRepository {
  constructor(private readonly prismaBot: PrismaBotService) {}

  async isCodeAllowed(epsCode: string): Promise<boolean> {
    const normalizedCode = epsCode.trim().toUpperCase();
    if (!normalizedCode) {
      return false;
    }

    const allowedEps = await this.prismaBot.botAllowedEps.findUnique({
      where: { code: normalizedCode },
      select: { isActive: true },
    });

    return allowedEps?.isActive ?? false;
  }
}
