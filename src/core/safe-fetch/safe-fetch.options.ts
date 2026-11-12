/** Injection token for options below. */
export const SAFE_FETCH_OPTIONS = Symbol('SAFE_FETCH_OPTIONS');

export interface SafeFetchOptions {
  /** Ports a URL may use. Production: 80 and 443 only. */
  allowedPorts: number[];
  /**
   * IP adresses allowed even though they are internal.
   * ALWAYS empty in production: only tests fill it, to reach a local test server.
   */
  allowedInternalIps: string[];
  timeoutMs: number;
  maxRedirects: number;
  userAgent: string;
}

export const DEFAULT_SAFE_FETCH_OPTIONS: SafeFetchOptions = {
  allowedPorts: [80, 443],
  allowedInternalIps: [],
  timeoutMs: 10_000,
  maxRedirects: 3,
  userAgent: 'EcoScan/1.0 (+https://github.com/feryel123bh/ecoscan)',
};
