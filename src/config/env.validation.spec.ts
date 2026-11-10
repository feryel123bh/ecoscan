import { AiProvider, NodeEnv, validateEnv } from './env.validation';

const valid = {
  NODE_ENV: 'test',
  PORT: '3001',
  REDIS_URL: 'redis://127.0.0.1:6380',
  IP_HASH_SALT: 'a-long-random-secret-value',
};

describe('validateEnv', () => {
  it('returns typed values and applies defaults', () => {
    const config = validateEnv(valid);
    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe(NodeEnv.Test);
    expect(config.AI_PROVIDER).toBe(AiProvider.None);
    expect(config.AI_DAILY_BUDGET).toBe(200);
  });
  it('lists every invalid variable at once', () => {
    expect(() => validateEnv({ ...valid, PORT: '70000', REDIS_URL: 'http://x' })).toThrow(
      /PORT must not be greater than 65535[\s\S]*REDIS_URL must start with redis/,
    );
  });

  it('rejects a missing REDIS_URL', () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.REDIS_URL;
    expect(() => validateEnv(rest)).toThrow(/REDIS_URL/);
  });

  it('rejects a salt that is too short', () => {
    expect(() => validateEnv({ ...valid, IP_HASH_SALT: 'short' })).toThrow(/at least 16/);
  });

  it('rejects an unknown AI provider', () => {
    expect(() => validateEnv({ ...valid, AI_PROVIDER: 'gpt' })).toThrow(/AI_PROVIDER/);
  });
});
