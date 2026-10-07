import { Controller, Post, Get, Body, UseGuards, Req, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { RateLimitRule, RateLimitService } from '../common/rate-limit.service';

const LOGIN_RULE: RateLimitRule = { limit: 5, windowMs: 15 * 60 * 1000 };
const CODE_RULE: RateLimitRule = { limit: 10, windowMs: 15 * 60 * 1000 };
const RESET_RULE: RateLimitRule = { limit: 5, windowMs: 15 * 60 * 1000 };
const RESEND_RULE: RateLimitRule = { limit: 3, windowMs: 15 * 60 * 1000 };

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimit: RateLimitService,
    private jwtService: JwtService,
  ) {}

  @Public()
  @Post('login-saas')
  async loginSaas(@Req() req: any, @Body() body: { email: string; password: string }) {
    const key = this.key(req, 'login-saas', body.email);
    this.rateLimit.check(key, LOGIN_RULE);
    const result = await this.authService.loginSaas(body.email, body.password);
    this.rateLimit.reset(key);
    return result;
  }

  @Public()
  @Post('login-pin')
  async loginPin(
    @Req() req: any,
    @Body() body: { pin: string; restaurante_slug: string },
  ) {
    return this.loginPinInternal(req, body);
  }

  @Public()
  @Post('login-pin-mobile')
  async loginPinMobile(
    @Req() req: any,
    @Body() body: { pin: string; restaurante_slug: string },
  ) {
    return this.loginPinInternal(req, body);
  }

  @Public()
  @Post('register-saas')
  async registerSaas(@Req() req: any, @Body() body: {
    email: string;
    password: string;
    nombre: string;
    restaurante_nombre: string;
    telefono?: string;
  }) {
    this.rateLimit.check(this.key(req, 'register-saas', body.email), LOGIN_RULE);
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
  async verificarCuenta(@Req() req: any, @Body() body: { email: string; code: string }) {
    this.rateLimit.check(this.key(req, 'verificar-cuenta', body.email), CODE_RULE);
    return this.authService.verificarCuenta(body.email, body.code);
  }

  @Public()
  @Post('reenviar-codigo')
  async reenviarCodigo(@Req() req: any, @Body() body: { email: string }) {
    this.rateLimit.check(this.key(req, 'reenviar-codigo', body.email), RESEND_RULE);
    return this.authService.reenviarCodigo(body.email);
  }

  @Public()
  @Post('olvide-contrasena')
  async olvideContrasena(@Req() req: any, @Body() body: { email: string }) {
    this.rateLimit.check(this.key(req, 'olvide-contrasena', body.email), RESET_RULE);
    return this.authService.olvideContrasena(body.email);
  }

  @Public()
  @Post('verificar-codigo')
  async verificarCodigo(@Req() req: any, @Body() body: { email: string; code: string }) {
    this.rateLimit.check(this.key(req, 'verificar-codigo', body.email), CODE_RULE);
    return this.authService.verificarCodigo(body.email, body.code);
  }

  @Public()
  @Post('restablecer-contrasena')
  async restablecerContrasena(
    @Req() req: any,
    @Body() body: { email: string; code: string; newPassword: string },
  ) {
    this.rateLimit.check(this.key(req, 'restablecer-contrasena', body.email), RESET_RULE);
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

  /**
   * Token corto (1 h) para suscribirse al canal Realtime `restaurante:<id>`.
   * Los claims (`role`, `restaurante_id`) son los que evalúan las politicas de
   * `realtime.messages`; la variante `agente` es para el agente de impresión (Fase 10).
   */
  @Post('realtime-token')
  async realtimeToken(@CurrentUser() user: JwtPayload, @Body() body: { variante?: 'usuario' | 'agente' }) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new BadRequestException('SUPABASE_JWT_SECRET no configurado en el servidor');
    if (!user.restauranteId) throw new ForbiddenException('El usuario no pertenece a un restaurante');

    const variante = body?.variante === 'agente' ? 'agente' : 'usuario';
    const token = this.jwtService.sign(
      {
        role: variante === 'agente' ? 'agente' : 'authenticated',
        aud: 'authenticated',
        restaurante_id: String(user.restauranteId),
        tipo: variante,
      },
      {
        secret,
        algorithm: 'HS256',
        subject: String(user.sub),
        expiresIn: 60 * 60,
      },
    );

    return {
      success: true,
      token,
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || '',
      restaurante_id: user.restauranteId,
      expires_in: 3600,
    };
  }

  private async loginPinInternal(req: any, body: { pin: string; restaurante_slug: string }) {
    const key = this.key(req, 'login-pin', body.restaurante_slug);
    this.rateLimit.check(key, LOGIN_RULE);
    const result = await this.authService.loginPin(body.pin, body.restaurante_slug);
    this.rateLimit.reset(key);
    return result;
  }

  private key(req: any, scope: string, identifier?: string): string {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const target = (identifier || 'anonymous').trim().toLowerCase();
    return `${scope}:${ip}:${target}`;
  }
}
