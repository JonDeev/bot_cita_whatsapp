import { Module } from '@nestjs/common';
import { PrismaBotService } from './prisma-bot.service';

@Module({
  providers: [PrismaBotService],
  exports: [PrismaBotService],
})
export class PrismaBotModule {}
