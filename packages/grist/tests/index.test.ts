import { describe, expect, it } from 'vitest';
import * as grist from '../src/index.js';

describe('@bsv-kit/grist', () => {
  it('exports the grist namespace', () => {
    expect(Object.keys(grist)).toEqual(['grist']);
    expect(grist.grist).toBeTypeOf('object');
  });
});
