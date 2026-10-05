import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../../prisma/tenant-context';

@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    let restauranteId = request.user?.restauranteId ?? null;
    const isSuperadmin = request.user?.rol === 'superadmin';

    if (!restauranteId) {
      const slug = this.extraerSlug(request);
      if (slug) {
        try {
          const restaurante = await this.prisma.restaurante.findUnique({
            where: { slug },
            select: { id: true },
          });
          if (restaurante) restauranteId = restaurante.id;
        } catch {}
      }
    }

    return new Observable((subscriber) => {
      tenantContext.run({ restauranteId, isSuperadmin }, () => {
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }

  private extraerSlug(request: any): string | null {
    return (
      request.headers['x-restaurant-slug'] ||
      request.query?.restaurante ||
      request.body?.restaurante_slug ||
      request.body?.restauranteSlug ||
      request.body?.restaurante ||
      null
    );
  }
}
