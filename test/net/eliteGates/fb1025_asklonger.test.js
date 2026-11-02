// FIELD BUGS 2026-10-25 ASK-LONGER (Grost on Discord, #suggestions, "Increase perk selection time for Elite Breaches":
// "Having only 10 seconds to read over potentially 16 different options, with a total of 5 different categories, is not
// enough for time to think for perk/boss/hall decisions ... At the very least, increase it to 20 seconds, maybe even
// 30"; SeQueL: "10 seconds is far to short. 20 seconds minimum"). The company's word (Elite-Gates.md section 16.4) is
// open EG_ASK_MS, 10 s until this record and 30 s now. Driven on the real director (egBreachNew, egEnter, egStep,
// egWord) at a solo Court's rest, as AUDIT EG V's fixtures are (egaudit5_a1.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS, EG_REST_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egWord, egGeo, EG_READY_MS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ASK_MS } from '../../../src/net/eliteGates/egRun.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/** Breach 12345 for one member (level 40) at circle 1's Court, stepped by the director to its rest's window. */
function soloRest() {
  const seed = 12345, rng = seeded(seed), sub = 'acct-0';
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: sub, o: 'M0', ew: 0, rh: 0, seed, op: T0, co: [[sub, 'M0', 1]], site: SITE, wg: [], pr: 'pyre' });
  let now = T0 + EG_SEALED_MS + 100;
  assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const frames = [];
  const plate = () => { const s = egHallOf(seed, B.h, egGeo(B)); return { sx: s.x0 + s.arrive.x, z: s.arrive.z }; };
  const step = (ms = 250) => { now += ms; frames.push(...egStep(B, now, [{ sub, ...plate(), dead: false, at: now }], rng)); };
  const stepUntil = (pred, max = 2400) => { for (let k = 0; k < max && !pred(); k++) step(); assert.ok(pred(), 'reached'); };
  const vote = (q, y) => frames.push(...egWord(B, sub, { k: 'vote', q, y }, null, now, rng));
  stepUntil(() => B.sg === 'trial');
  B.F.mem.lordsFell = 1; step();
  assert.equal(B.sg, 'rest', 'the Redoubt taken');
  stepUntil(() => B.rdSeq?.window === 1);
  return { B, frames, step, stepUntil, vote, now: () => now };
}

test('ASK-LONGER THE COMPANY\'S WORD IS OPEN 30 s (section 16.4): every question the rest puts - the decrees, the Ready, the respite - is said open until thirty seconds past the window, and a decree voted at once is still open, its choice unread, a step short of that; at the thirty seconds it closes with the vote kept (mutants: the old 10 s; any other length)', () => {
  assert.equal(EG_ASK_MS, 30_000);
  const P = soloRest(), at = P.now();
  const asks = P.frames.filter((f) => f.k === 'ask');
  assert.ok(asks.some((f) => f.q.startsWith('dec:')) && asks.some((f) => f.q === 'ready'), 'the decrees and the Ready asked');
  for (const f of asks) assert.equal(f.until, at + 30_000, `${f.q} said open thirty seconds`);
  const dec = P.B.asks.find((a) => a.q.startsWith('dec:'));
  P.vote(dec.q, 1);
  P.stepUntil(() => P.now() >= at + 30_000 - 250);
  assert.ok(P.B.asks.some((a) => a.q === dec.q), 'still open a step short of thirty seconds');
  assert.ok(!P.frames.some((f) => f.k === 'asked' && f.q === dec.q), 'not yet answered');
  P.step();
  assert.ok(!P.B.asks.some((a) => a.q === dec.q), 'closed at thirty seconds');
  assert.ok(P.frames.some((f) => f.k === 'asked' && f.q === dec.q && f.r === 1), 'the vote kept');
  assert.equal(P.B.sg, 'rest', 'inside the rest');
});

test('ASK-LONGER A READY AT ONCE STILL LEAVES THE WORD ITS TIME: a solo member who votes Ready the moment the window opens rests the whole thirty seconds and EG_READY_MS more - never the 13 s the 10 s word gave - and the rest\'s 90 s hold every question (mutants: the old 10 s; a word longer than the rest)', () => {
  const P = soloRest(), at = P.now();
  P.vote('ready', 1);
  P.stepUntil(() => P.now() >= at + EG_ASK_MS + EG_READY_MS - 250);
  assert.equal(P.B.sg, 'rest', 'still resting a step before the word and the Ready\'s three seconds');
  P.stepUntil(() => P.B.sg !== 'rest', 8);
  assert.ok(P.now() <= at + EG_ASK_MS + EG_READY_MS + 250, 'the Ready ends it then');
  assert.ok(EG_ASK_MS + EG_READY_MS < EG_REST_MS, 'the word closes inside the rest');
});
