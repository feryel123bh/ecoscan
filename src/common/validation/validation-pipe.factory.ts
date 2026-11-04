import { BadRequestException, ValidationPipe } from '@nestjs/common';
/** One ValidationPipe configuration, shared by main.ts and the e2e tests. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true, //strip properties without a decorator
    forbidNonWhitelisted: true, // ...and reject the request if there are any
    transform: true, //plain JSON -> DTO class instance
    validationError: { target: false, value: false }, // never echo submitted values
    exceptionFactory: (errors) =>
      new BadRequestException(
        errors.flatMap((e) => Object.values(e.constraints ?? { [e.property]: 'is invalid' })),
      ),
  });
}
