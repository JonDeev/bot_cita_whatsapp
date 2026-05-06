import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule, WhatsappModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
