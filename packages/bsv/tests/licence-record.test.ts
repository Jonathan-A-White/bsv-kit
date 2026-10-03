// The typed-record reader: makes the same bytes as Postern's builders, and reads them back.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transaction } from '@bsv/sdk';
import { describe, expect, it } from 'vitest';
import { findTypedRecords } from '../src/licence/record.js';
import { ADDRESS, OTHER_ADDRESS, mintTxHex, revokeTxHex, transferTxHex } from './support/records.js';

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'postern-licence.json'), 'utf-8')) as {
  address: string;
  txids: { mint: string };
  hexes: Record<string, string>;
};

describe('the test builders against the fixture Postern made', () => {
  it('make the same transactions as Postern\'s own builders', () => {
    expect(fixture.address).toBe(ADDRESS);
    expect(mintTxHex('postern')).toBe(fixture.hexes.mintPostern);
    expect(mintTxHex('spellforge-leaderboard-testnet')).toBe(fixture.hexes.mintLegacy);
    expect(mintTxHex('some-other-collection')).toBe(fixture.hexes.mintOther);
    expect(mintTxHex('postern', OTHER_ADDRESS)).toBe(fixture.hexes.mintForSomeoneElse);
    expect(transferTxHex(`${fixture.txids.mint}:0`)).toBe(fixture.hexes.transferAwayFromB);
  });
});

describe('findTypedRecords', () => {
  it('reads the mint Postern made', () => {
    const records = findTypedRecords(fixture.hexes.mintPostern);
    expect(records).toHaveLength(1);
    expect(records[0].recordType).toBe('M');
    expect(records[0].vout).toBe(0);
    expect(JSON.parse(new TextDecoder().decode(Uint8Array.from(records[0].payloadBytes)))).toEqual({ collection: 'postern', holder: ADDRESS });
  });

  it('reads the transfer Postern made', () => {
    const [record] = findTypedRecords(fixture.hexes.transferAwayFromB);
    expect(record.recordType).toBe('TR');
    expect(JSON.parse(new TextDecoder().decode(Uint8Array.from(record.payloadBytes)))).toEqual({
      origin: `${fixture.txids.mint}:0`,
      to: OTHER_ADDRESS,
    });
  });

  it('reads a revoke as a W record', () => {
    const [record] = findTypedRecords(revokeTxHex('c'.repeat(64) + ':0'));
    expect(record.recordType).toBe('W');
  });

  it('finds nothing in a transaction with no record', () => {
    expect(findTypedRecords(new Transaction().toHex())).toEqual([]);
  });
});
