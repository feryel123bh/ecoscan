import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../../config/env.validation';
import { REDIS_CLIENT } from './redis.constants';

/**
 * One shared Redis connection for the whole process.
 * @Global: any module can inject REDIS_CLIENT without importing RedisModule.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Redis =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          // Commands sent while (re)connecting wait in a short offline queue,
          // so the first request after start-up does not fail. Each command is
          // retried at most once, then rejected: callers add their own timeout
          // (see HealthController) so a request never hangs while Redis is down.
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Close the connection cleanly when the process stops (SIGTERM, tests). */
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
