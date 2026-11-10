import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation';

/**
 * Structured JSON logs (pino). Each request gets an id, reused from the
 * X-Request-Id header when a proxy already set one, so a request can be
 * followed across services.
 * Privacy: requests are logged with id, method and URL only
 * (no IP, no headers).
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const env = config.get('NODE_ENV', { infer: true });
        return {
          pinoHttp: {
            level: env === NodeEnv.Production ? 'info' : 'debug',
            //Human-readable logs in developement, raw JSON elsewhere.
            transport:
              env === NodeEnv.Development
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            enabled: env !== NodeEnv.Test,
            genReqId: (req: IncomingMessage) => {
              const header = req.headers['x-request-id'];
              return typeof header === 'string' && header.length <= 64 ? header : randomUUID();
            },
            //Par défaut, pino journalise l'adresse IP et tous les en-têtes, cookies compris. On ne garde que l'identifiant, la méthode, l'URL et le statut:
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
