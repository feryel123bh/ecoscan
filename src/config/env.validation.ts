import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum AiProvider {
  None = 'none', // rules only
  Ollama = 'ollama',
  Api = 'api',
}

/**
 * Every enviroment variable EcoScan reads, with its rules.
 * Invalid configuration = the process refuses to start( fail fast)
 */

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number) // env values are strings : convert explicitly
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  @IsString()
  @Matches(/^rediss?:\/\//, { message: 'REDIS_URL must start with redis:// or rediss://' })
  REDIS_URL: string;

  /**Secret used to hash IP addresses before they reach logs or Redis keys. */
  @IsString()
  @MinLength(16, { message: 'IP_HASH_SALT must be at least 16 characters long' })
  IP_HASH_SALT: string;

  @IsEnum(AiProvider)
  AI_PROVIDER: AiProvider = AiProvider.None;

  /** Maximum number of IA calls per day, all users combined. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  AI_DAILY_BUDGET = 200;
}

/** Used by ConfigModule.forRoot({ validate}). Lists every problem at once. */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(config, {
    skipMissingProperties: false,
  });
  const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
  if (messages.length > 0) {
    throw new Error(`Invalid configuration:\n-${messages.join('\n- ')}`);
  }

  return config;
}
