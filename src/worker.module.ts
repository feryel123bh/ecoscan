import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { LoggingModule } from './core/logging/logging.module';
import { RedisModule } from './core/redis/redis.module';

/**
 * Root module of the worker process: same configuration and Redis connection
 * as the API, but no HTTP controllers.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggingModule,
    RedisModule,
  ],
})
export class WorkerModule {}
