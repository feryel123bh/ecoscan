import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import {
  BlockedTargetError,
  FetchTimeoutError,
  TooLargeError,
  TooManyRedirectsError,
} from './safe-fetch.errors';
import { DEFAULT_SAFE_FETCH_OPTIONS, SafeFetchOptions } from './safe-fetch.options';
import { SafeFetchService } from './safe-fetch.service';
const PAGE = '<html><body>' + 'Hello EcoScan! '.repeat(200) + '</body></html>';
const PAGE_GZIP = gzipSync(PAGE);
// 5 MB of zeros compress to a few kilobytes: a small "zip bomb".
const ZIP_BOMB = gzipSync(Buffer.alloc(5_000_000));
/** A small local HTTP server with one route per scenario. */
function startTestServer(): Promise<Server> {
  const server = createServer((req, res) => {
    switch (req.url) {
      case '/page':
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(PAGE);
      case '/page-gzip':
        res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
        return res.end(PAGE_GZIP);
      case '/zip-bomb':
        res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
        return res.end(ZIP_BOMB);
      case '/big':
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        return res.end(Buffer.alloc(2_000_000));
      case '/slow':
        return; // never answers
      case '/redirect-ok':
        res.writeHead(302, { location: '/page' });
        return res.end();
      case '/redirect-metadata':
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
        return res.end();
      case '/redirect-loop':
        res.writeHead(302, { location: '/redirect-loop' });
        return res.end();
      default:
        res.writeHead(404);
        return res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
describe('SafeFetchService (against a local server)', () => {
  let server: Server;
  let port: number;
  let base: string;
  const services: SafeFetchService[] = [];
  /** A service that may reach the local test server: tests only. */
  function testService(overrides: Partial<SafeFetchOptions> = {}): SafeFetchService {
    const service = new SafeFetchService({
      ...DEFAULT_SAFE_FETCH_OPTIONS,
      allowedPorts: [80, 443, port],
      allowedInternalIps: ['127.0.0.1'],
      timeoutMs: 1000,
      ...overrides,
    });
    services.push(service);
    return service;
  }
  beforeAll(async () => {
    server = await startTestServer();
    port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await Promise.all(services.map((s) => s.onModuleDestroy()));
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  it('downloads a page and counts its exact size', async () => {
    const result = await testService().fetch(`${base}/page`, {
      maxBytes: 1_000_000,
      keepBody: true,
    });
    expect(result.status).toBe(200);
    expect(result.transferredBytes).toBe(Buffer.byteLength(PAGE));
    expect(result.body?.toString()).toBe(PAGE);
  });
  it('counts compressed bytes but returns the decoded body', async () => {
    const result = await testService().fetch(`${base}/page-gzip`, {
      maxBytes: 1_000_000,
      keepBody: true,
    });
    expect(result.transferredBytes).toBe(PAGE_GZIP.length);
    expect(result.transferredBytes).toBeLessThan(Buffer.byteLength(PAGE));
    expect(result.body?.toString()).toBe(PAGE);
  });
  it('follows a safe redirect and reports the final URL', async () => {
    const result = await testService().fetch(`${base}/redirect-ok`, {
      maxBytes: 1_000_000,
      keepBody: false,
    });
    expect(result.finalUrl).toBe(`${base}/page`);
    expect(result.body).toBeUndefined();
  });
  it('blocks a redirect to the cloud metadata service', async () => {
    await expect(
      testService().fetch(`${base}/redirect-metadata`, { maxBytes: 1000, keepBody: false }),
    ).rejects.toThrow(BlockedTargetError);
  });
  it('stops an endless redirect loop', async () => {
    await expect(
      testService().fetch(`${base}/redirect-loop`, { maxBytes: 1000, keepBody: false }),
    ).rejects.toThrow(TooManyRedirectsError);
  });
  it('stops reading a response that is too large', async () => {
    await expect(
      testService().fetch(`${base}/big`, { maxBytes: 100_000, keepBody: false }),
    ).rejects.toThrow(TooLargeError);
  });
  it('refuses a small compressed body that expands far too much (zip bomb)', async () => {
    expect(ZIP_BOMB.length).toBeLessThan(20_000); // tiny on the network...
    await expect(
      testService().fetch(`${base}/zip-bomb`, { maxBytes: 20_000, keepBody: true }),
    ).rejects.toThrow(TooLargeError); // ...but refused once decompressed beyond 10x
  });
  it('gives up on a server that never answers', async () => {
    await expect(
      testService({ timeoutMs: 300 }).fetch(`${base}/slow`, { maxBytes: 1000, keepBody: false }),
    ).rejects.toThrow(FetchTimeoutError);
  });
  it('blocks "localhost" through DNS when internal addresses are not allowed', async () => {
    // Port allowed, but no internal IP allowed: the DNS check must refuse it.
    const strict = testService({ allowedInternalIps: [] });
    await expect(
      strict.fetch(`http://localhost:${port}/page`, { maxBytes: 1000, keepBody: false }),
    ).rejects.toThrow(BlockedTargetError);
  });
  it('with production options, refuses the local server outright', async () => {
    const production = new SafeFetchService(DEFAULT_SAFE_FETCH_OPTIONS);
    services.push(production);
    await expect(
      production.fetch(`${base}/page`, { maxBytes: 1000, keepBody: false }),
    ).rejects.toThrow(BlockedTargetError);
  });
});
