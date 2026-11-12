import { LookupAddress } from 'node:dns';
import { BlockedTargetError } from './safe-fetch.errors';
import { createSafeLookup } from './safe-lookup';
/** A fake DNS that always answers with the given addresses. */
function fakeDns(addresses: LookupAddress[]) {
  return (
    _host: string,
    _options: { all: true },
    callback: (err: NodeJS.ErrnoException | null, a: LookupAddress[]) => void,
  ) => callback(null, addresses);
}
/** Calls the lookup and returns what it passed to its callback. */
function run(lookup: ReturnType<typeof createSafeLookup>, all: boolean) {
  return new Promise<{ err: unknown; address: unknown }>((resolve) =>
    lookup('evil.example', { all }, (err, address) => resolve({ err, address })),
  );
}
describe('createSafeLookup', () => {
  it('blocks a public-looking name that resolves to a private address', async () => {
    const lookup = createSafeLookup([], fakeDns([{ address: '10.0.0.5', family: 4 }]));
    const { err } = await run(lookup, false);
    expect(err).toBeInstanceOf(BlockedTargetError);
  });
  it('blocks a name that resolves to the cloud metadata service', async () => {
    const lookup = createSafeLookup([], fakeDns([{ address: '169.254.169.254', family: 4 }]));
    expect((await run(lookup, true)).err).toBeInstanceOf(BlockedTargetError);
  });
  it('returns only the public addresses when a name has mixed answers', async () => {
    const lookup = createSafeLookup(
      [],
      fakeDns([
        { address: '127.0.0.1', family: 4 },
        { address: '8.8.8.8', family: 4 },
      ]),
    );
    const { err, address } = await run(lookup, true);
    expect(err).toBeNull();
    expect(address).toEqual([{ address: '8.8.8.8', family: 4 }]);
  });
  it('returns a single address when Node does not ask for all of them', async () => {
    const lookup = createSafeLookup([], fakeDns([{ address: '8.8.8.8', family: 4 }]));
    expect((await run(lookup, false)).address).toBe('8.8.8.8');
  });
});
