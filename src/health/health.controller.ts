import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../core/redis/redis.constants';

export interface HealthReport {
  status: 'ok';
  redis: 'up';
}

/**
 * Health chack used by Docker, the hosting platform and monitoring tools.
 * 200 = ready to serve.
 * 503= a dependency is down: stop sending traffic here.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
  @Get()
  async chack(): Promise<HealthReport> {
    try {
      await withTimeout(this.redis.ping(), 1000);
      return { status: 'ok', redis: 'up' };
    } catch {
      throw new ServiceUnavailableException('Redis is unreachable.');
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out after ${ms} ms')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
