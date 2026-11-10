// Runs before every e2e test file, so the configuration is valid when
// AppModule is imported (ConfigModule validates at import time).
Object.assign(process.env, {
  NODE_ENV: 'test',
  // EcoScan's own Redis (port 6380), on IPv4 explicitly.
  // TEST_REDIS_URL lets CI choose its own Redis; a REDIS_URL defined
  // elsewhere on this machine can no longer interfere.
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6380',
  IP_HASH_SALT: 'test-salt-at-least-16-chars',
});
