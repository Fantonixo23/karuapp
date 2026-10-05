import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { SocketModule } from './socket/socket.module';
import { TenantsModule } from './tenants/tenants.module';
import { ProductosModule } from './productos/productos.module';
import { MesasModule } from './mesas/mesas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { CocinaModule } from './cocina/cocina.module';
import { CajaModule } from './caja/caja.module';
import { FacturacionModule } from './facturacion/facturacion.module';
import { InventarioModule } from './inventario/inventario.module';
import { InformesModule } from './informes/informes.module';
import { UtilsModule } from './utils/utils.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LicenseGuard } from './common/guards/license.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { RlsContextInterceptor } from './common/interceptors/rls-context.interceptor';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    SocketModule,
    TenantsModule,
    ProductosModule,
    MesasModule,
    UsuariosModule,
    PedidosModule,
    CocinaModule,
    CajaModule,
    FacturacionModule,
    InventarioModule,
    InformesModule,
    UtilsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: LicenseGuard },
    { provide: APP_INTERCEPTOR, useClass: RlsContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
