# Changelog: @bsv-kit/bsv

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-16)

Everything since 0.1.0 (the v0.1.0 tag of 2026-10-09); the version number was raised on 2026-10-09 and the tag v0.2.0 is
made on 2026-10-16.

- Changed (breaking): the door signs Postern's v2 scheme, `Authorization: Postern2 <pubkey>:<nonce>:<sig>` over
  `postern-v2`, the method, the request target, the body's sha256 and the nonce; the v1 header is gone. Migration: none
  in code, but the backend must be a Postern that accepts v2 (mw-5r3p30.32). The test vectors come from Postern's own
  `apiFetch`.
- Changed: with an `issuer`, a revoke's signature is checked only when the revoke names one of the holder's mints, and one
  check reads each transaction once (mw-fm7wmn.22).
- Fixed: a bulk read that fails rejects the check, as any read does, rather than asking a rate-limited WhatsOnChain for each
  txid (mw-fm7wmn.22).
- New: `WhatsOnChainReader` and `FakeChainReader` read transactions in bulk (`POST /txs/hex`, 20 a request, paced), and
  `licenceStatus` and `hasLicence` take an optional `txCache` (`get(txid)`, `set(txid, hex)`) that keeps the transactions
  between checks (mw-fm7wmn.22).
- New: the `bsv-kit/bsv` entry point is built and packed with the other libraries.

## 0.1.0 (2026-10-09)

- New: `vault` (generate a key from BIP-39 words, wrap and unwrap it at rest, a storage port, a day-long key session), `door`
  (one signed `fetch` for every `/api` call, typed refusals and timeouts, `me()`) and `licence` (`hasLicence`,
  `licenceStatus` with held, revoked, indexing and none, a pluggable chain reader, an issuer's licences, the whole confirmed
  history paged), lifted from Postern's `src/services/`. Postern's wire formats are the law.
