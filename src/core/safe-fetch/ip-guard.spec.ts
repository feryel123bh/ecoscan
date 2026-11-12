import { isPublicIp } from './ip-guard';
describe('isPublicIp', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback (whole 127/8)'],
    ['10.0.0.5', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private (end of 172.16/12)'],
    ['192.168.1.10', 'private'],
    ['169.254.169.254', 'cloud metadata service (link-local)'],
    ['0.0.0.0', 'unspecified'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['192.0.2.1', 'reserved for documentation'],
    ['::1', 'IPv6 loopback'],
    ['::', 'IPv6 unspecified'],
    ['fc00::1', 'IPv6 unique local'],
    ['fd12:3456::1', 'IPv6 unique local'],
    ['fe80::1', 'IPv6 link-local'],
    ['::ffff:127.0.0.1', 'IPv4 loopback disguised as IPv6'],
    ['::ffff:10.0.0.1', 'IPv4 private disguised as IPv6'],
    ['2002:7f00:1::1', '6to4 address embedding 127.0.0.1'],
    ['64:ff9b::7f00:1', 'NAT64 address embedding 127.0.0.1'],
    ['not-an-ip', 'not an IP at all'],
  ])('refuses %s (%s)', (address) => {
    expect(isPublicIp(address)).toBe(false);
  });
  it.each(['8.8.8.8', '1.1.1.1', '93.184.215.14', '2001:4860:4860::8888', '::ffff:8.8.8.8'])(
    'accepts the public address %s',
    (address) => {
      expect(isPublicIp(address)).toBe(true);
    },
  );
  it('accepts an internal address only when explicitly allowed (tests only)', () => {
    expect(isPublicIp('127.0.0.1', ['127.0.0.1'])).toBe(true);
    expect(isPublicIp('::ffff:127.0.0.1', ['127.0.0.1'])).toBe(true);
    expect(isPublicIp('10.0.0.1', ['127.0.0.1'])).toBe(false);
  });
});
