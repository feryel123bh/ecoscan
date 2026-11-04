import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * RFC 9457 "Problem Details for HTTP APIs".
 * A standard error format that many tools and client libraries understand.
 */

export interface ProblemDetails {
  type: string; //URI identifying the kind of problem
  title: string; //short, human-readable summary of that kind
  status: number; //HTTP status Code
  detail?: string; // explanation specific to this occurence
  instance: string; //the request path that produced the pproblem
  errors?: string[]; //extension member: list of validation errors
}

// Relative URI reference (allowed by RFC 9457): resolves against the API's own domain
const PROBLEM_BASE = '/problems/';

/** Converts every exception into an application/problem+json response */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const problem = this.toProblem(exception, request.originalUrl ?? request.url);

    if (problem.status >= 500) {
      //Full details go to the logs, never to the client.
      this.logger.error(
        `${request.method} ${request.url} -> ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(problem.status).type('application/problem+json').json(problem);
  }
  private toProblem(exception: unknown, instance: string): ProblemDetails {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const slug = (HttpStatus[status] ?? 'error').toLowerCase().replace(/_/g, '-');
      return {
        type: PROBLEM_BASE + slug,
        title: titleFor(status),
        status,
        ...(Array.isArray(message)
          ? { detail: 'The request contains invalid fields.', errors: message }
          : { detail: message ?? exception.message }),
        instance,
      };
    }
    return {
      type: PROBLEM_BASE + 'internal-server-error',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occured.',
      instance,
    };
  }
}

/** "NOT_FOUND" -> "Not Found" */
function titleFor(status: number): string {
  const name = HttpStatus[status] ?? 'ERROR';
  return name
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
