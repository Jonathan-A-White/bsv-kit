import { describe, expect, it } from 'vitest';
import * as bsv from '../src/index.js';

describe('@bsv-kit/bsv', () => {
  it('exports the vault, door and licence namespaces', () => {
    expect(Object.keys(bsv).sort()).toEqual(['door', 'licence', 'vault']);
    expect(bsv.vault).toBeTypeOf('object');
    expect(bsv.door).toBeTypeOf('object');
    expect(bsv.licence).toBeTypeOf('object');
  });
});
