import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api')
export class HealthController {
  constructor(private db: DatabaseService) {}

  @Public()
  @Get('health')
  async health() {
    let dbOk = true;
    try {
      await this.db.run((db) => db.selectFrom('usuarios').select('id').limit(1).execute());
    } catch {
      dbOk = false;
    }
    return {
      ok: dbOk,
      db: dbOk ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
    };
  }
}