// What the page says about a licence, an answer and a failure, in plain words.
import type { licence } from 'bsv-kit/bsv';
import type { grist } from 'bsv-kit/grist';

export function describeLicence(status: licence.LicenceStatus): string {
  switch (status.state) {
    case 'held':
      return `Held: this key holds a licence in "${status.collection}" (mint ${status.outpoint.txid}:${status.outpoint.vout}).`;
    case 'revoked':
      return `Revoked: this key held a licence in "${status.collection}" (mint ${status.outpoint.txid}:${status.outpoint.vout}) but it was moved away.`;
    case 'indexing':
      return `Indexing: a licence is on its way (mint ${status.txid}); the chain index has not shown it yet.`;
    case 'none':
      return 'None: this key holds no licence in that collection. Give the public key above to the Governor to be licensed.';
  }
}

export function describeAnswer(answer: grist.GristAnswer): string {
  const g = answer.grind;
  const lines = [`The mill ${answer.status} this grist (grind ${g.app} / ${g.kind} / ${g.v}).`];
  if (answer.reason) lines.push(`Reason: ${answer.reason}`);
  if (answer.answer !== undefined) lines.push('', JSON.stringify(answer.answer, null, 2));
  return lines.join('\n');
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
