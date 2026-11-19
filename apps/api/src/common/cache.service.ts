import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Key/value store for OTPs, verification tokens and rate counters.
 * Uses Redis when REDIS_URL is set; otherwise a process-local Map (development only —
 * not suitable for multiple API instances).
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis?: Redis;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    const url = env().REDIS_URL;
    if (url) {
      this.redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
      this.redis.on('error', (e) => this.logger.error(`Redis error: ${e.message}`));
    } else {
      if (env().NODE_ENV === 'production') throw new Error('REDIS_URL is required in production');
      this.logger.warn('REDIS_URL not set — using in-memory cache (single instance only)');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    let raw: string | null;
    if (this.redis) raw = await this.redis.get(key);
    else {
      const hit = this.memory.get(key);
      raw = hit && hit.expiresAt > Date.now() ? hit.value : null;
      if (hit && !raw) this.memory.delete(key);
    }
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.redis) await this.redis.set(key, raw, 'EX', ttlSeconds);
    else this.memory.set(key, { value: raw, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    if (this.redis) await this.redis.del(key);
    else this.memory.delete(key);
  }

  /** Fixed-window counter. Returns the count after increment. */
  async incr(key: string, windowSeconds: number): Promise<number> {
    if (this.redis) {
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, windowSeconds);
      return n;
    }
    const current = (await this.get<number>(key)) ?? 0;
    const hit = this.memory.get(key);
    const ttl = hit ? Math.max(1, Math.ceil((hit.expiresAt - Date.now()) / 1000)) : windowSeconds;
    await this.set(key, current + 1, ttl);
    return current + 1;
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }
}
