import { PrismaBotService } from '../../../../../shared/infrastructure/prisma-bot/prisma-bot.service';
import { PrismaBotContractedEpsRepository } from './prisma-bot-contracted-eps.repository';

describe('PrismaBotContractedEpsRepository', () => {
  it('returns true only when eps code is active in bot db', async () => {
    const prismaBot = {
      botAllowedEps: {
        findUnique: jest.fn().mockResolvedValue({ isActive: true }),
      },
    } as unknown as PrismaBotService;

    const repository = new PrismaBotContractedEpsRepository(prismaBot);
    const isAllowed = await repository.isCodeAllowed('eps042');

    expect(isAllowed).toBe(true);
  });
});
