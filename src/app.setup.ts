import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { createValidationPipe } from './common/validation/validation-pipe.factory';

/**
 * Global HTTP configuration, applied identically in main.ts and in e2e tests.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
}
