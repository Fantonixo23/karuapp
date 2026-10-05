import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantContext } from './tenant-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
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
