 ADR 0002: SSRF protection for outgoing requests- Status: accepted- Date: 2026-11-04
## Context
EcoScan downloads URLs chosen by anonymous users, from inside our network.
Without protection, an attacker could make the server request internal targets
(`localhost`, private networks, the cloud metadata service `169.254.169.254`)
and read the answers: a Server-Side Request Forgery (SSRF).
## Decision
All outgoing HTTP requests go through a single module, `src/core/safe-fetch`.- **URL check before any network activity**: `http`/`https` only, ports 80/443,
no credentials in the URL, IP literals checked directly.- **Allow-list of IP ranges**: only ordinary public unicast addresses are
accepted (via `ipaddr.js`). IPv4 addresses disguised as IPv6 are unwrapped
first. Unknown or special ranges are refused by default.- **Check at connection time**: a custom DNS `lookup` given to the undici
agent. The address that is checked is the address that is used, which
defeats DNS rebinding.- **Manual redirects** (max 3), each target checked again.- **Limits**: one global deadline per fetch, streamed body with a byte limit,
and a decompression limit (10x) against zip bombs.- **Production options are hard-coded**, not read from environment variables:
a configuration mistake cannot re-open internal addresses. Tests inject
their own options to reach a local server.
## Consequences- Sites served only on non-standard ports cannot be analysed (accepted).- Every new feature that needs the network must use `SafeFetchService`;
a code review rule, and a check in the PR checklist.- Timeouts and decompression errors are detected through the abort signal and
error codes rather than `instanceof`, which proved unreliable across
execution contexts (found by the tests).