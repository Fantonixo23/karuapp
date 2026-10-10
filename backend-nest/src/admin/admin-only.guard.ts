import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export const SUPERADMIN_EMAILS = (
  process.env.ADMIN_ALLOWED_EMAILS || 'juampabloportillo22@gmail.com'
)
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.rol !== 'superadmin') {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    const usuario = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('usuarios')
        .select('email')
        .where('id', '=', user.sub)
        .executeTakeFirst(),
    );

    const email = usuario?.email?.trim().toLowerCase();
    if (!email || !SUPERADMIN_EMAILS.includes(email)) {
      throw new ForbiddenException('Acceso restringido');
    }

    return true;
  }
}