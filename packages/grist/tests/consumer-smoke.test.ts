// The consumer smoke test (scripts/consumer-smoke.mjs): installs bsv-kit from a fresh clone into a scratch
// directory, as an app does, and from there imports 'bsv-kit/grist' (sendGrist reaches bsv's door) and
// 'bsv-kit/bsv' alone (its import graph holds no grist file). It needs the network or a warm npm cache, because
// the install runs the build with devDependencies; set BSV_KIT_SKIP_SMOKE=1 to leave it out offline.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'consumer-smoke.mjs');

describe.skipIf(process.env.BSV_KIT_SKIP_SMOKE === '1')('a consumer install of bsv-kit', () => {
  it('imports bsv-kit/grist and sends a grist through the door, and imports bsv-kit/bsv alone without grist', () => {
    let output = '';
    try {
      output = execFileSync('node', [script], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 540_000 });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      throw new Error(`consumer smoke test failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`);
    }
    expect(output).toContain('sendGrist reached the door');
    expect(output).toContain('bsv alone imports');
    expect(output).toContain('bsv-kit/testing imports');
    expect(output).toContain('bsv-kit/tips imports');
    expect(output).toContain('consumer smoke test passed');
  }, 600_000);
});
