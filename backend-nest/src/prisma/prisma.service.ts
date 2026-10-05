import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { tenantContext } from './tenant-context';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta DATABASE_URL: no se puede inicializar PrismaService');
}

const adapter = new PrismaPg({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  withTenant() {
    const ctx = tenantContext.getStore();
    if (!ctx?.restauranteId && !ctx?.isSuperadmin) return this;

    return this.$extends({
      query: {
        $allOperations: async ({ model, operation, args, query }) => {
          if (!model) return query(args);

          return this.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `SELECT set_config('app.current_restaurante_id', $1, TRUE), set_config('app.is_superadmin', $2, TRUE)`,
              ctx?.restauranteId ? String(ctx.restauranteId) : '',
              ctx?.isSuperadmin ? 'true' : 'false',
            );
            return (tx as any)[model][operation](args);
          });
        },
      },
    });
  }

  async bypassRls<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_restaurante_id', '', TRUE), set_config('app.is_superadmin', 'true', TRUE)`,
      );
      return fn(tx);
    });
  }
}
