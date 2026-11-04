import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/**
 * Entry point of the worker process. No HTTP server: an application context
 * that stays alive and , process the scan queue.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks(); //SIGTERM close Redis cleanly, then exit.
  app.get(Logger).log('EcoScan worker started, waiting for jobs');
}
void bootstrap();
