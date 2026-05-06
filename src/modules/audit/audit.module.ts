import { Module } from '@nestjs/common';
import { PrismaBotModule } from '../../shared/infrastructure/prisma-bot/prisma-bot.module';
import { AuditService } from './application/services/audit.service';
import { AUDIT_EVENT_WRITER } from './domain/audit.tokens';
import { CompositeAuditEventWriterAdapter } from './infrastructure/logging/composite-audit-event-writer.adapter';
import { LoggerAuditEventWriterAdapter } from './infrastructure/logging/logger-audit-event-writer.adapter';
import { PrismaBotAuditEventWriterAdapter } from './infrastructure/persistence/mysql/prisma-bot-audit-event-writer.adapter';

@Module({
  imports: [PrismaBotModule],
  providers: [
    AuditService,
    LoggerAuditEventWriterAdapter,
    PrismaBotAuditEventWriterAdapter,
    {
      provide: AUDIT_EVENT_WRITER,
      useClass: CompositeAuditEventWriterAdapter,
    },
    CompositeAuditEventWriterAdapter,
  ],
  exports: [AuditService],
})
export class AuditModule {}
