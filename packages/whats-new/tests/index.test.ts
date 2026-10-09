import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

describe('@bsv-kit/whats-new', () => {
  it('exports the sheet, the list, the button, the summary and the functions behind them', () => {
    for (const name of ['WhatsNewSheet', 'WhatsNewList', 'CheckForUpdates', 'UpdateSummary', 'useChangelog', 'summarise', 'versionLink', 'fetchChangelog', 'githubAnchor']) {
      expect(pkg).toHaveProperty(name);
      expect(pkg[name as keyof typeof pkg]).toBeTypeOf('function');
    }
  });

  it('runs nothing that needs a page when it is imported', () => {
    // this file runs in node: importing the package above touched no window, document or navigator
    expect(typeof window).toBe('undefined');
  });
});
