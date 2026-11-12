/** Base class: every refusal or failure of the safe-fetch module. */
export abstract class SafeFetchError extends Error {
  abstract readonly code: string;
}

/***the target is forbidden: internal address, scheme, port, credentials ... */
export class BlockedTargetError extends SafeFetchError {
  readonly code = 'BLOCKED_TARGET';
}

/** The response is larger than the allowed limit. */
export class TooLargeError extends SafeFetchError {
  readonly code = 'TOO_LARGE';
}

/** The server did not answer in time. */
export class FetchTimeoutError extends SafeFetchError {
  readonly code = 'TIMEOUT';
}

/** More redirects than allowed, or an invalid redirect. */
export class TooManyRedirectsError extends SafeFetchError {
  readonly code = 'TOO_MANY_REDIRECTS';
}

/** Network failure: DNS name not found, connection refused, TLS error ... */
export class FetchFailedError extends SafeFetchError {
  readonly code = 'FETCH_FAILED';
}
