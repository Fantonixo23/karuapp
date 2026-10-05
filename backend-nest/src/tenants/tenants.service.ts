import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getRestauranteBySlug(slug: string) {
    const restaurante = await this.prisma.withTenant().restaurante.findUnique({
      where: { slug },
    });
    if (!restaurante) throw new NotFoundException('Restaurante no encontrado');
    return restaurante;
  }

  async verifyLicense(restauranteId: number) {
    const restaurante = await this.prisma.withTenant().restaurante.findUnique({
      where: { id: restauranteId },
    });
    if (!restaurante) return { valid: false, reason: 'not_found' };

    if (!restaurante.activo || restaurante.estadoLicencia === 'suspended') {
      return { valid: false, reason: 'suspended' };
    }

    if (restaurante.fechaExpiracion && restaurante.fechaExpiracion < new Date()) {
      await this.prisma.withTenant().restaurante.update({
        where: { id: restauranteId },
        data: { estadoLicencia: 'expirado' },
      });
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  }
}
