import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SurveysModule } from './modules/surveys/surveys.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminOverviewModule } from './modules/admin-overview/admin-overview.module';
import { DashboardStreamModule } from './modules/dashboard-stream/dashboard-stream.module';
import { AdminConversationsModule } from './modules/admin-conversations/admin-conversations.module';
import { AdminRemindersModule } from './modules/admin-reminders/admin-reminders.module';
import { AdminSurveysModule } from './modules/admin-surveys/admin-surveys.module';
import { AdminLogsModule } from './modules/admin-logs/admin-logs.module';
import { AdminChatsModule } from './modules/admin-chats/admin-chats.module';

@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    SurveysModule,
    RemindersModule,
    AdminAuthModule,
    AdminOverviewModule,
    DashboardStreamModule,
    AdminConversationsModule,
    AdminRemindersModule,
    AdminSurveysModule,
    AdminLogsModule,
    AdminChatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
