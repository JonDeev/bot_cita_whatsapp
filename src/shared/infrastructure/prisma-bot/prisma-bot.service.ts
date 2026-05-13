import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@whatsapp-bot/prisma-client';

@Injectable()
export class PrismaBotService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.BOT_DATABASE_URL;
    if (!connectionString) {
      throw new Error('Missing BOT_DATABASE_URL environment variable.');
    }

    const adapter = new PrismaMariaDb(connectionString);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
