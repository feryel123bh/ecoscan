import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REDIS_CLIENT } from '../src/core/redis/redis.constants';

async function createApp(redisOverride?: Redis): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (redisOverride) builder = builder.overrideProvider(REDIS_CLIENT).useValue(redisOverride);
  const app = (await builder.compile()).createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Health (e2e)', () => {
  describe('with Redis available', () => {
    let app: INestApplication<App>;
    beforeAll(async () => (app = await createApp()));
    afterAll(async () => app.close());

    it('GET /api/v1/health returns 200', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200, { status: 'ok', redis: 'up' });
    });

    it('returns RFC 9457 problem details on unknown routes', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 404, title: 'Not Found', instance: '/api/v1/nope' });
    });

    it('sets security headers', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('with Redis down', () => {
    let app: INestApplication<App>;
    // Nothing listens on this port: every command fails quickly.
    const deadRedis = new Redis('redis://127.0.0.1:6399', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    beforeAll(async () => (app = await createApp(deadRedis)));
    afterAll(async () => {
      await app.close();
      deadRedis.disconnect();
    });

    it('GET /api/v1/health returns 503 so traffic is sent elsewhere', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(503);
      expect(res.body).toMatchObject({ status: 503, detail: 'Redis is unreachable.' });
    });
  });
});
