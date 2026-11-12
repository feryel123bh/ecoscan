import { lookup as dnsLookup, LookupAddress } from 'node:dns';
import { BlockedTargetError } from './safe-fetch.errors';
import { isPublicIp } from './ip-guard';

type Resolver = (
  hostname: string,
  options: { all: true },
  callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * A replacement for the DNS lookup done hen opening a connection.
 *
 * why here, and not before the request ? Because the address that is checked is
 * the address that is used. If we resolved the name ourselves, checked it , and
 * then let the HTTP client resolve it again, an attacker controlling the DNS
 * could answer  "public IP" the first time and "127.0.0.1" the second time
 * (DNS rebinding). Here, check and connection use the same answer.
 *
 * `resolve` can be replaced in unit tests by a fake DNS.
 */
export function createSafeLookup(
  allowedInternalIps: readonly string[] = [],
  resolve: Resolver = dnsLookup,
) {
  return (
    hostname: string,
    options: { all?: boolean } | number | undefined,
    callback: LookupCallback,
  ): void => {
    resolve(hostname, { all: true }, (err, addresses) => {
      if (err) return callback(err, []);
      const allowed = addresses.filter((a) => isPublicIp(a.address, allowedInternalIps));
      if (allowed.length === 0) {
        return callback(
          new BlockedTargetError(`${hostname} resolves to a non-public address. `),
          [],
        );
      }

      // Node asks for either every address (happy eyeballs) or a single one.
      const wantsAll = typeof options === 'object' && options?.all === true;
      if (wantsAll) return callback(null, allowed);
      const first = allowed[0] as LookupAddress;
      return callback(null, first.address, first.family);
    });
  };
}
