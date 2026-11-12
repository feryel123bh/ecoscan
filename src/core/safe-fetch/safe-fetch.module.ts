import { Module } from '@nestjs/common';
import { DEFAULT_SAFE_FETCH_OPTIONS, SAFE_FETCH_OPTIONS } from './safe-fetch.options';
import { SafeFetchService } from './safe-fetch.service';

/**
 * Production options are fixed in code, Not read form enviroment variables:
 * no configuration mistake can ever re-open internal addresses in production.
 * Tests replace SAFE_FETCH_OPTIONS with overrideProvider().
 */

@Module({
  providers: [
    { provide: SAFE_FETCH_OPTIONS, useValue: DEFAULT_SAFE_FETCH_OPTIONS },
    SafeFetchService,
  ],
  exports: [SafeFetchService],
})
export class SafeFetchModule {}
