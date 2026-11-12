import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Agent, Dispatcher, errors, request } from 'undici';
import {
  FetchFailedError,
  FetchTimeoutError,
  SafeFetchError,
  TooLargeError,
  TooManyRedirectsError,
} from './safe-fetch.errors';
import { SAFE_FETCH_OPTIONS, SafeFetchOptions } from './safe-fetch.options';
import { createSafeLookup } from './safe-lookup';
import { checkUrl } from './url-guard';

export interface FetchRequest {
  /** Maximum number of bytes transferred (compressed, as on the network). */
  maxBytes: number;
  /** Keep and decode the body (HTML,CSS)? false= only count the bytes. */
  keepBody: boolean;
}

export interface FetchResult {
  finalUrl: string; // after redirects
  status: number;
  contentType: string | null;
  /** Bytes actually transferred on the network, before decompression. */
  transferredBytes: number;
  //Decoded body, only when keepBody is true.
  body?: Buffer;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/** A compressed body may not expand to more than this many times its size. */
const MAX_DECOMPRESSION_RATIO = 10;

/**
 * The ONLY component allowed to make outgoing HTTP requests.
 * Every target is checked (scheme, port, IP) before and during connection.
 * every redirect is checked again, and every response is size- and time-limited.
 */
@Injectable()
export class SafeFetchService implements OnModuleDestroy {
  private readonly agent: Agent;

  constructor(@Inject(SAFE_FETCH_OPTIONS) private readonly options: SafeFetchOptions) {
    this.agent = new Agent({
      //the DNSlookup used to open every connection: rejects non-public IPs.
      connect: {
        lookup: createSafeLookup(options.allowedInternalIps),
        timeout: options.timeoutMs,
      },
      headersTimeout: options.timeoutMs,
      bodyTimeout: options.timeoutMs,
    });
  }
  async fetch(rawUrl: string, req: FetchRequest): Promise<FetchResult> {
    //One deadline for the whole operation, redirects included.
    const signal = AbortSignal.timeout(this.options.timeoutMs);
    let url = this.check(rawUrl);

    for (let redirects = 0; ; redirects++) {
      const response = await this.send(url, signal);
      if (REDIRECT_STATUSES.has(response.statusCode)) {
        await response.body.dump(); // discard the redirect body
        if (redirects >= this.options.maxRedirects) {
          throw new TooManyRedirectsError(`More than ${this.options.maxRedirects} redirects.`);
        }
        const location = header(response, 'location');
        if (!location) throw new TooManyRedirectsError('Redirect without a Location header.');
        //Relative locations are resolved against the current URL, then checked again.
        url = this.check(new URL(location, url));
        continue;
      }

      const { bytes, chunks } = await this.readBody(response, req, signal);
      const contentType = header(response, 'content type');
      const result: FetchResult = {
        finalUrl: url.toString(),
        status: response.statusCode,
        contentType,
        transferredBytes: bytes,
      };
      if (req.keepBody) {
        result.body = decode(
          Buffer.concat(chunks),
          header(response, 'content-encoding'),
          req.maxBytes * MAX_DECOMPRESSION_RATIO,
        );
      }
      return result;
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.agent.close();
  }

  private check(url: string | URL): URL {
    return checkUrl(url, this.options.allowedPorts, this.options.allowedInternalIps);
  }

  private async send(url: URL, signal: AbortSignal): Promise<Dispatcher.ResponseData> {
    try {
      return await request(url, {
        dispatcher: this.agent,
        method: 'GET',
        signal,
        headers: {
          'user-agent': this.options.userAgent,
          //Ask for compressed responses: we measure what really travels.
          'accept-encoding': 'gzip, br',
          accept: '*/*',
        },
      });
    } catch (error) {
      throw toSafeFetchError(error, signal);
    }
  }
  /** Reads the body as a stream, counting bytes and stopping at the limit. */
  private async readBody(
    response: Dispatcher.ResponseData,
    req: FetchRequest,
    signal: AbortSignal,
  ): Promise<{ bytes: number; chunks: Buffer[] }> {
    const chunks: Buffer[] = [];
    let bytes = 0;
    try {
      for await (const chunck of response.body) {
        const buffer = chunck as Buffer;
        bytes += buffer.length;
        if (bytes > req.maxBytes) {
          response.body.destroy(); //stop downloading immediatly
          throw new TooLargeError('Response larger than ${req.maxBytes} bytes.');
        }
        if (req.keepBody) chunks.push(buffer);
        if (signal.aborted) throw new FetchTimeoutError('Timed out while reading the body.');
      }
    } catch (error) {
      throw toSafeFetchError(error, signal);
    }
    return { bytes, chunks };
  }
}

function header(response: Dispatcher.ResponseData, name: string): string | null {
  const value = response.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Decompresses the body. maxOutputLength protects against "zip bombs":
 * a tiny compressed file that expands to gigabytes in memory.
 */
function decode(raw: Buffer, encoding: string | null, maxOutputLength: number): Buffer {
  try {
    switch (encoding?.trim().toLocaleLowerCase()) {
      case 'gzip':
      case 'x-gzip':
        return gunzipSync(raw, { maxOutputLength });
      case 'br':
        return brotliDecompressSync(raw, { maxOutputLength });
      case 'deflate':
        return inflateSync(raw, { maxOutputLength });
      default:
        return raw;
    }
  } catch (error) {
    //Check the error code, not `instanceof RangeError`: error.classes created by
    //Node's internals are not always recongnized by instanceof (e.g. under Jest)
    if ((error as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new TooLargeError('DEcompressed body is too large.');
    }
    throw new FetchFailedError('Invalid compressed body.');
  }
}
/**
 * Maps any low-level error to one of our SafeFetchError classes.
 * For the global deadline, we check the signal itself rather than the error's
 * type: the abort error can take several forms depending on where it happens.
 */
function toSafeFetchError(error: unknown, signal: AbortSignal): SafeFetchError {
  if (error instanceof SafeFetchError) return error;
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof SafeFetchError) return cause;
  if (
    signal.aborted ||
    error instanceof errors.HeadersTimeoutError ||
    error instanceof errors.BodyTimeoutError ||
    error instanceof errors.ConnectTimeoutError
  ) {
    return new FetchTimeoutError('The server did not answer in time.');
  }
  const message = error instanceof Error ? error.message : String(error);
  return new FetchFailedError(message);
}
