import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly backend: string;
  private readonly hits = new Map<string, number[]>();
  private lastSweep = Date.now();

  constructor() {
    this.backend = (process.env.RATE_LIMIT_BACKEND || 'memory').toLowerCase();
    if (this.backend !== 'redis') {
      this.logger.warn(
        'RATE_LIMIT_BACKEND=memory: los contadores viven en el proceso. ' +
          'Con mas de una instancia hay que migrar el backend a Redis (Fase 11).',
      );
    }
  }

  check(key: string, rule: RateLimitRule): void {
    const now = Date.now();
    const cutoff = now - rule.windowMs;
    const previous = (this.hits.get(key) || []).filter((t) => t > cutoff);

    if (previous.length >= rule.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((previous[0] + rule.windowMs - now) / 1000));
      throw new HttpException(
        `Demasiados intentos. Reintenta en ${retryAfterSec} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    previous.push(now);
    this.hits.set(key, previous);
    this.sweep(now);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    const maxWindow = 60 * 60 * 1000;
    for (const [key, timestamps] of this.hits.entries()) {
      const alive = timestamps.filter((t) => t > now - maxWindow);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
  }
}
