import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '@prisma/client';

const WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const STRICT_READ_ONLY_MODELS = new Set([
  'usuarios',
  'empleados',
  'tvespecialidades',
  'especialidad_empleados',
  'sedes',
  'tventidades',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString =
      process.env.SISM_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Missing database connection string. Define SISM_DATABASE_URL or DATABASE_URL in the environment.',
      );
    }

    const adapter = new PrismaMariaDb(connectionString);
    super({ adapter });

    const guarded = this.$extends(
      Prisma.defineExtension({
        name: 'legacy-db-guardrails',
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              if (model && WRITE_ACTIONS.has(operation)) {
                if (STRICT_READ_ONLY_MODELS.has(model)) {
                  throw new Error(
                    `[DB_GUARDRAIL] Write blocked for read-only legacy table: ${model}.${operation}`,
                  );
                }

                if (model === 'agenda') {
                  if (
                    operation === 'create' ||
                    operation === 'createMany' ||
                    operation === 'upsert'
                  ) {
                    throw new Error(
                      '[DB_GUARDRAIL] Creating records in agenda is forbidden by project policy.',
                    );
                  }

                  if (operation === 'delete' || operation === 'deleteMany') {
                    throw new Error(
                      '[DB_GUARDRAIL] Deleting records in agenda is forbidden by project policy.',
                    );
                  }

                  const agendaUpdatesEnabled =
                    process.env.ALLOW_AGENDA_UPDATES === 'true';
                  if (
                    (operation === 'update' || operation === 'updateMany') &&
                    !agendaUpdatesEnabled
                  ) {
                    throw new Error(
                      '[DB_GUARDRAIL] agenda updates are disabled. Explicit authorization is required.',
                    );
                  }
                }
              }

              return query(args);
            },
          },
        },
      }),
    );

    Object.assign(this, guarded);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
