import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { LoggingModule } from './core/logging/logging.module';
import { RedisModule } from './core/redis/redis.module';
import { HealthModule } from './health/health.module';

/** Root module of the HTTP API process. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggingModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
