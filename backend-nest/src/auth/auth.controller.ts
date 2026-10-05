import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login-saas')
  async loginSaas(@Body() body: { email: string; password: string }) {
    return this.authService.loginSaas(body.email, body.password);
  }

  @Public()
  @Post('login-pin')
  async loginPin(@Body() body: { pin: string; restaurante?: string }) {
    return this.authService.loginPin(body.pin, body.restaurante);
  }

  @Public()
  @Post('login-pin-mobile')
  async loginPinMobile(@Body() body: { pin: string; restaurante?: string }) {
    return this.authService.loginPin(body.pin, body.restaurante);
  }

  @Public()
  @Post('register-saas')
  async registerSaas(@Body() body: {
    email: string;
    password: string;
    nombre: string;
    restaurante_nombre: string;
    telefono?: string;
  }) {
    return this.authService.registerSaas({
      email: body.email,
      password: body.password,
      nombre: body.nombre,
      restauranteNombre: body.restaurante_nombre,
      telefono: body.telefono,
    });
  }

  @Public()
  @Post('verificar-cuenta')
  async verificarCuenta(@Body() body: { email: string; code: string }) {
    return this.authService.verificarCuenta(body.email, body.code);
  }

  @Public()
  @Post('reenviar-codigo')
  async reenviarCodigo(@Body() body: { email: string }) {
    return this.authService.reenviarCodigo(body.email);
  }

  @Public()
  @Post('olvide-contrasena')
  async olvideContrasena(@Body() body: { email: string }) {
    return this.authService.olvideContrasena(body.email);
  }

  @Public()
  @Post('verificar-codigo')
  async verificarCodigo(@Body() body: { email: string; code: string }) {
    return this.authService.verificarCodigo(body.email, body.code);
  }

  @Public()
  @Post('restablecer-contrasena')
  async restablecerContrasena(@Body() body: { email: string; code: string; newPassword: string }) {
    return this.authService.restablecerContrasena(body.email, body.code, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('enviar-2fa')
  async enviar2fa(@CurrentUser('sub') userId: number) {
    return this.authService.enviar2fa(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verificar-2fa')
  async verificar2fa(@CurrentUser('sub') userId: number, @Body() body: { code: string }) {
    return this.authService.verificar2fa(userId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser('sub') userId: number) {
    return this.authService.me(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout() {
    return { success: true, message: 'Sesión cerrada' };
  }
}
