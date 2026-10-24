// GRANT-UNHEARD (2026-10-18, Mac: a case in #mod-queue - "3 players' games refused 6 of this account's foes in 10
// minutes: unsigned 6" - "Is this the system working?"; bible/11-Multiplayer/Spawn-Grants.md section 18): A GRANT NEVER
// HEARD IS NO FORGERY. The relay drops a foes frame past the room's byte budget (server/src/index.js _foesFan), the full
// ones - the frames that carry the grants again - first, so in a crowded cell a reader can hold an owner's records and
// none of its grants for longer than GRANT_VERDICT_WAIT_MS. It was tallied `unsigned`, a case's reason; it is tallied
// `ungranted` - stood down while the law enforces, judged anew once heard, and never a case's. A grant HEARD whose
// signature fails is `unsigned` still, and judged once.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrantHost } from '../../src/scenes/grantHost.js';
import { signGrant, GRANT_TTL_MS, GRANT_CASE_REASONS, GRANT_STANDDOWN_REASONS } from '../../src/net/grantLaw.js';

const { subtle } = globalThis.crypto;
const CELL = 'world:3,12', OWNER = 'fake-0001';

async function signed(over = {}) {
  const R = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const g = { g: 7, o: OWNER, q: CELL, a: 'acct-fake', k: 'enc', p: [3, 12], m: 9, l: 9, r: 7, n: 2, s: 5, e: 0, c: [-1, -1], h: -1, x: Date.now() + GRANT_TTL_MS, ...over };
  return { R, gr: { ...g, sg: await signGrant(g, R.privateKey, { subtle }) } };
}
const session = (grantMode = 'measure') => ({ room: CELL, status: 'open', grantMode, sendGrant: () => true });

test('GRANT-UNHEARD THE CROWDED CELL: the frame that carried an owner\'s grant dropped by the relay, its deltas name the grant and carry none, and its full frames are dropped past the wait - the reader tallies `ungranted`, never `unsigned`, so no case opens; enforcing stands it down until a full frame comes through, then judges it anew, honest, and tallies nothing more (mutants: unheard tallied `unsigned`; the unheard never judged anew)', async () => {
  const { R, gr } = await signed();
  const owner = createGrantHost({ session: () => session(), fetchKey: async () => R.publicKey });
  owner.stood(gr, 0, {}); owner.stood(gr, 1, {});
  const dropped = owner.frameGrants([gr, gr], true);   // the relay's budget: gone
  assert.equal(dropped.length, 1, 'the grant went out once - and the relay dropped it');
  const reader = createGrantHost({ session: () => session('enforce'), fetchKey: async () => R.publicKey, verdictWait: 100 });
  const delta = owner.frameGrants([gr, gr], false);   // a foe moved: a small delta, which the budget passes
  assert.deepEqual(delta, [], 'a delta carries no grant already said');
  reader.heard(OWNER, delta);
  const rec = { i: 1, t: 0, gr: [7, 0] };
  assert.equal(await reader.check(OWNER, CELL, rec), 'ungranted', 'unheard past the wait');
  assert.deepEqual([...reader.tallied()], [[`${OWNER}|ungranted`, 1]], 'tallied as a record with no grant');
  assert.ok(!GRANT_CASE_REASONS.includes('ungranted'), 'which opens no case (server-account/src/grants.js)');
  assert.ok(GRANT_STANDDOWN_REASONS.includes('ungranted') && reader.downed(OWNER, rec), 'and an enforcing reader stands it down');
  reader.heard(OWNER, owner.frameGrants([gr, gr], true));   // a full frame the budget let through
  assert.equal(reader.downed(OWNER, rec), false, 'heard: no longer stood down');
  assert.equal(await reader.check(OWNER, CELL, rec), null, 'judged anew, and honest');
  assert.deepEqual([...reader.tallied()], [[`${OWNER}|ungranted`, 1]], 'nothing more tallied');
});

test('GRANT-UNHEARD A FORGED SIGNATURE IS `unsigned`, AND JUDGED ONCE: a grant heard whose signature the relay\'s key does not hold is a case\'s reason; the record stays stood down and is tallied once, however often its pool would build it again (mutant: a failed signature judged anew every time it is asked)', async () => {
  const { R, gr } = await signed();
  const reader = createGrantHost({ session: () => session('enforce'), fetchKey: async () => R.publicKey, verdictWait: 100 });
  reader.heard(OWNER, [{ ...gr, c: [0, -1] }]);   // a champion the relay never signed
  const rec = { i: 1, t: 0, gr: [7, 0], cp: 0 };
  assert.equal(await reader.check(OWNER, CELL, rec), 'unsigned');
  assert.ok(GRANT_CASE_REASONS.includes('unsigned'), 'a case\'s reason');
  for (let i = 0; i < 3; i++) {
    assert.equal(reader.downed(OWNER, rec), true, 'stood down, never rebuilt');
    assert.equal(await reader.check(OWNER, CELL, rec), 'unsigned');
  }
  assert.deepEqual([...reader.tallied()], [[`${OWNER}|unsigned`, 1]], 'counted once');
});
