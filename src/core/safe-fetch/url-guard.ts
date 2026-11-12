import { isIP } from 'node:net';
import { BlockedTargetError } from './safe-fetch.errors';
import { isPublicIp } from './ip-guard';

const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 };

/**
 * First line of defence, before any network activity:
 * parses the URL and rejects anything that is not a plain public http(s) URL .
 */

export function checkUrl(
  raw: string | URL,
  allowedPorts: readonly number[],
  allowedInternalIps: readonly string[] = [],
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedTargetError('Invalid URL.');
  }

  const defaultPort = DEFAULT_PORTS[url.protocol];
  if (defaultPort === undefined) {
    throw new BlockedTargetError(`scheme "${url.protocol}" is not allowed.`);
  }
  if (url.username || url.password) {
    throw new BlockedTargetError('Credentials in the URL are not allowed.');
  }

  const port = url.port === '' ? defaultPort : Number(url.port);
  if (!allowedPorts.includes(port)) {
    throw new BlockedTargetError(`Port ${port} is not allowed.`);
  }

  // An IP written directly in the URL never goes through DNS: check it here.
  // URL keeps IPv6 literals in brackets: "[::1]" -> "::1".
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0 && !isPublicIp(host, allowedInternalIps)) {
    throw new BlockedTargetError(`Address ${host} is not public. `);
  }

  return url;
}
