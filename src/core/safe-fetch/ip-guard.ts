import ipaddr from 'ipaddr.js';
/**
 * Is this IP address a public internet address we may connect to ?
 *
 * Allow-list aqpproach: only the "unicast" range( ordinary public addresses) is accepted. Everything else is refused: loopback,
 * private networks, link-local
 * (including the cloud metadata service 169.254.169.254), carrier-grade NAT,
 * multicast, reserved ranges, and IPv6 ranges that can embed an IPv4 address.
 * Refusing "everything that is not knowwn to be safe" is safer than listing the
 * dangerous ranges one by one: a forgotten range stays blocked.
 */

export function isPublicIp(address: string, allowedInternalIps: readonly string[] = []): boolean {
  if (!ipaddr.isValid(address)) return false;

  let parsed = ipaddr.parse(address);
  // "::ffff:127.0.0.1" is IPv4 127.0.0.1 written as IPv6: check the real IPv4.
  if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
  }

  if (allowedInternalIps.includes(parsed.toString())) return true;
  return parsed.range() === 'unicast';
}
