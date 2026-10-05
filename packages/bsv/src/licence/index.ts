// The licence check: does a key hold a License token, read from WhatsOnChain through a pluggable chain
// reader. Lifted from Postern's src/services/licence.ts. No UI, no DOM.
export { DEFAULT_GRACE_MS, addressForPublicKey, findLicence, findLicenceForAddress, hasLicence, licenceStatus } from './licence.js';
export type { FoundLicence, LicenceOptions, LicenceOutpoint, LicenceStatus, MintPending } from './licence.js';
export type { AddressHistoryEntry, ChainReader } from './reader.js';
export { ChainError, WOC_TESTNET_URL, WhatsOnChainReader } from './whatsonchain.js';
export type { WhatsOnChainReaderOptions } from './whatsonchain.js';
export { FakeChainReader } from './fake.js';
export { findTypedRecords } from './record.js';
export type { TypedRecordInTransaction, TypedRecordType } from './record.js';
