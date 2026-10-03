import { describe, expect, it } from 'vitest';
import * as grist from '../src/index.js';

describe('@bsv-kit/grist', () => {
  it('exports the grist namespace', () => {
    expect(Object.keys(grist)).toEqual(['grist']);
    expect(grist.grist).toBeTypeOf('object');
  });

  it('names what an app uses: sendGrist, awaitAnswer, decryptAnswer', () => {
    expect(grist.grist.sendGrist).toBeTypeOf('function');
    expect(grist.grist.awaitAnswer).toBeTypeOf('function');
    expect(grist.grist.decryptAnswer).toBeTypeOf('function');
  });
});
