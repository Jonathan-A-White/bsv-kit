// A licence the issuer funded: the holder's own address never lists it, so the check also reads the
// issuer's history, as Postern's backend does (server/internal/licence: HeldCollections with an
// IssuerKey). mw-xjwp5m.9. The recorded case is the Governor's cairn licence for mpkzbiex..., made by
// Postern's Issue a licence; its mint txs are the real WhatsOnChain answers.
import { PrivateKey } from '@bsv/sdk';
import { describe, expect, it } from 'vitest';
import { licence } from '../src/index.js';
import recorded from './fixtures/woc-issued-licence.json' with { type: 'json' };
import { ADDRESS, PUBLIC_KEY_HEX, fundingTx, signedRecordTx } from './support/records.js';

const { FakeChainReader, findLicence, findLicenceForAddress, licenceStatus } = licence;

const ISSUER = PrivateKey.fromHex('22'.repeat(32));
const ISSUER_PUBLIC_KEY = ISSUER.toPublicKey().toString();
const ISSUER_ADDRESS = ISSUER.toPublicKey().toAddress('testnet');
const STRANGER = PrivateKey.fromHex('33'.repeat(32));

const FIRST = '97518e09dff9cffc51030718598e04c78ba466f71807a90de073109011b7716a';
const SECOND = '629cc60aa3a3c4860de8b5ed5aa2757001a48c3d89604b9a06d855e883def653';
const txs = recorded.transactions as Record<string, string>;

/** The chain as WhatsOnChain showed it: the holder has no history; the issuer lists the first mint
 * (in a block) and the second (still in the mempool); the first's own source is known by txid only. */
function recordedChain() {
  const reader = new FakeChainReader();
  for (const [txid, hex] of Object.entries(txs)) reader.addKnownTransaction(txid, hex);
  reader.addTransaction(recorded.issuerAddress, FIRST, txs[FIRST]);
  reader.addUnconfirmedTransaction(recorded.issuerAddress, SECOND, txs[SECOND]);
  return reader;
}

describe('a licence the issuer funded (recorded from WhatsOnChain)', () => {
  it('is none when only the holder history is read: why the check said None', async () => {
    expect(await findLicenceForAddress(recorded.holderAddress, 'cairn', { reader: recordedChain() })).toBeNull();
  });

  it('is held when the issuer is named, including a mint not in a block yet', async () => {
    const found = await findLicenceForAddress(recorded.holderAddress, 'cairn', { reader: recordedChain(), issuer: recorded.issuerPublicKey });
    expect(found).toEqual({ txid: SECOND, vout: 0, collection: 'cairn' });
  });

  it('is held when only the mempool mint is in the history', async () => {
    const alone = new FakeChainReader();
    for (const [txid, hex] of Object.entries(txs)) alone.addKnownTransaction(txid, hex);
    alone.addUnconfirmedTransaction(recorded.issuerAddress, SECOND, txs[SECOND]);
    const found = await findLicenceForAddress(recorded.holderAddress, 'cairn', { reader: alone, issuer: recorded.issuerPublicKey });
    expect(found?.txid).toBe(SECOND);
  });

  it('is not held in another collection', async () => {
    expect(await findLicenceForAddress(recorded.holderAddress, 'postern', { reader: recordedChain(), issuer: recorded.issuerPublicKey })).toBeNull();
  });
});

describe('the issuer rule', () => {
  it('finds a mint by public key, saying held', async () => {
    const funding = fundingTx(ISSUER);
    const mint = await signedRecordTx(ISSUER, funding, 'M', { collection: 'cairn', holder: ADDRESS });
    const reader = new FakeChainReader();
    reader.addKnownTransaction(funding.id('hex'), funding.toHex());
    reader.addTransaction(ISSUER_ADDRESS, mint.txid, mint.hex);
    const status = await licenceStatus(PUBLIC_KEY_HEX, 'cairn', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 });
    expect(status).toMatchObject({ state: 'held', outpoint: { txid: mint.txid, vout: 0 } });
    expect(await findLicence(PUBLIC_KEY_HEX, 'cairn', { reader })).toBeNull();
  });

  it('ignores a mint someone else signed, even one that names the holder', async () => {
    const funding = fundingTx(STRANGER);
    const mint = await signedRecordTx(STRANGER, funding, 'M', { collection: 'cairn', holder: ADDRESS });
    const reader = new FakeChainReader();
    reader.addKnownTransaction(funding.id('hex'), funding.toHex());
    reader.addTransaction(ADDRESS, mint.txid, mint.hex);
    expect(await findLicence(PUBLIC_KEY_HEX, 'cairn', { reader })).not.toBeNull();
    expect(await findLicence(PUBLIC_KEY_HEX, 'cairn', { reader, issuer: ISSUER_PUBLIC_KEY })).toBeNull();
  });

  it("ignores a mint in the issuer's history that the issuer did not sign", async () => {
    const funding = fundingTx(STRANGER);
    const mint = await signedRecordTx(STRANGER, funding, 'M', { collection: 'cairn', holder: ADDRESS });
    const reader = new FakeChainReader();
    reader.addKnownTransaction(funding.id('hex'), funding.toHex());
    reader.addTransaction(ISSUER_ADDRESS, mint.txid, mint.hex);
    expect(await findLicence(PUBLIC_KEY_HEX, 'cairn', { reader, issuer: ISSUER_PUBLIC_KEY })).toBeNull();
  });

  it("is revoked by a revoke record the issuer signed, found in the issuer's history", async () => {
    const funding = fundingTx(ISSUER);
    const mint = await signedRecordTx(ISSUER, funding, 'M', { collection: 'cairn', holder: ADDRESS });
    const revokeFunding = fundingTx(ISSUER);
    const revoke = await signedRecordTx(ISSUER, revokeFunding, 'W', { kind: 'revoke', origin: `${mint.txid}:0` });
    const reader = new FakeChainReader();
    reader.addKnownTransaction(funding.id('hex'), funding.toHex());
    reader.addKnownTransaction(revokeFunding.id('hex'), revokeFunding.toHex());
    reader.addTransaction(ISSUER_ADDRESS, mint.txid, mint.hex);
    reader.addTransaction(ISSUER_ADDRESS, revoke.txid, revoke.hex);
    const status = await licenceStatus(PUBLIC_KEY_HEX, 'cairn', { reader, issuer: ISSUER_PUBLIC_KEY, now: () => 0 });
    expect(status).toMatchObject({ state: 'revoked', outpoint: { txid: mint.txid, vout: 0 } });
  });

  it('ignores a revoke the issuer did not sign', async () => {
    const funding = fundingTx(ISSUER);
    const mint = await signedRecordTx(ISSUER, funding, 'M', { collection: 'cairn', holder: ADDRESS });
    const forgedFunding = fundingTx(STRANGER);
    const forged = await signedRecordTx(STRANGER, forgedFunding, 'W', { kind: 'revoke', origin: `${mint.txid}:0` });
    const reader = new FakeChainReader();
    reader.addKnownTransaction(funding.id('hex'), funding.toHex());
    reader.addKnownTransaction(forgedFunding.id('hex'), forgedFunding.toHex());
    reader.addTransaction(ISSUER_ADDRESS, mint.txid, mint.hex);
    reader.addTransaction(ISSUER_ADDRESS, forged.txid, forged.hex);
    expect(await findLicence(PUBLIC_KEY_HEX, 'cairn', { reader, issuer: ISSUER_PUBLIC_KEY })).not.toBeNull();
  });
});
