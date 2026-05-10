import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SurveysModule } from './modules/surveys/surveys.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule, WhatsappModule, SurveysModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
