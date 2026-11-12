import { BlockedTargetError } from './safe-fetch.errors';
import { checkUrl } from './url-guard';
const PORTS = [80, 443];
describe('checkUrl', () => {
  it.each([
    'https://example.com/',
    'http://example.com/page?x=1',
    'https://example.com:443/',
    'http://8.8.8.8/',
  ])('accepts %s', (url) => {
    expect(checkUrl(url, PORTS)).toBeInstanceOf(URL);
  });
  it.each([
    ['not a url', 'invalid'],
    ['file:///etc/passwd', 'file scheme'],
    ['ftp://example.com/', 'ftp scheme'],
    ['gopher://example.com/', 'gopher scheme'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['https://user:pass@example.com/', 'credentials'],
    ['https://example.com:8080/', 'non-standard port'],
    ['http://example.com:6379/', 'Redis port'],
    ['http://127.0.0.1/', 'loopback literal'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata literal'],
    ['http://[::1]/', 'IPv6 loopback literal'],
    ['http://[::ffff:127.0.0.1]/', 'disguised IPv4 literal'],
    ['http://0x7f000001/', 'hexadecimal IP (normalized to 127.0.0.1 by URL)'],
    ['http://2130706433/', 'decimal IP (normalized to 127.0.0.1 by URL)'],
  ])('refuses %s (%s)', (url) => {
    expect(() => checkUrl(url, PORTS)).toThrow(BlockedTargetError);
  });
});
