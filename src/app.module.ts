import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SurveysModule } from './modules/surveys/surveys.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [PrismaModule, WhatsappModule, SurveysModule, RemindersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
