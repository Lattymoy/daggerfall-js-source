// ZONE-GRACE (2026-10-26, the owner: "making the experience more palatable while retaining its punishment"; asked,
// "Entry/rise grace" - bible/11-Multiplayer/Wild-Zone.md section 3b): SAFE PASSAGE. For WILD_GRACE.ms after a fighter
// enters the open zone or rises from a fall, the relay's referee lands no player's blow or cast on it, and its own blow or
// cast on a player ends it at once (net/wild/wildRef.js). An entry grants it only to one away from the zone
// WILD_GRACE.awayMs and out of every fight WILD_GRACE.fightMs - a step out and back is no way out of a fight - and a cell
// crossed inside the zone is no entry: the grace rides the carry. The relay says it (`wref` `grace`, net/wire.js) and the
// game tells its player (systems/wild/wildGrace.js). Pinned: the law alone, the relay over the real Room
// (test/fakeRoom.mjs), the wire, and the client's words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newWildRef, wildZone, wildBlow, wildCarry, wildCarryOf, wildGraceLeft, WILD_GRACE, WILD_REF } from '../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { validWildRefOut, WILD_GRACE_MS_MAX, worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { createWildGrace, WILD_GRACE_SAY_MS } from '../../src/systems/wild/wildGrace.js';
import { WILD_TEXT } from '../../src/systems/wild/wildZone.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
const FIST = { w: -1, m: 0 };
const G = WILD_GRACE.ms;
/** a's fist on b at `now` */
const hit = (st, now, by = 'acct-a', to = 'acct-b') => wildBlow(st, by, to, { d: 999, held: FIST, rid: '0123456789ab' }, now);
/** Two fighters entering the zone at `now`. */
function enter(now) {
  const st = newWildRef();
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: 'r-a' }, true, at(-1), now);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b' }, true, at(1), now);
  return st;
}

test('ZONE-GRACE THE LAW, AN ENTRY (net/wild/wildRef.js wildZone, wildBlow): a fighter entering the zone stands WILD_GRACE.ms under safe passage - no blow lands on it (`grace`), until it runs out; its own blow on a player ends it at once and lands where its target has none (mutants: the entry ungraced; the passage unread at a blow; the striker\'s kept; the length)', () => {
  assert.equal(G, 60_000, 'the owner\'s minute');
  const st = enter(0);
  assert.deepEqual([wildGraceLeft(st, 'acct-a', 0), wildGraceLeft(st, 'acct-b', 0)], [G, G], 'both under it');
  const r = hit(st, 1_000);
  assert.deepEqual([r.ok, r.dealt, r.why, r.graceEnded], [false, 0, 'grace', true], 'her blow ends her own passage, and his keeps it off');
  assert.equal(wildGraceLeft(st, 'acct-a', 1_000), 0, 'hers ended');
  assert.equal(wildGraceLeft(st, 'acct-b', 1_000), G - 1_000, 'his stands');
  const back = hit(st, 2_000, 'acct-b', 'acct-a');
  assert.deepEqual([back.ok, back.dealt > 0, back.graceEnded], [true, true, true], 'he strikes back - his ends, and his blow lands on her');
  // run out
  const st2 = enter(0);
  wildZone(st2, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), G - 1);   // a keepalive is no entry
  assert.equal(hit(st2, G - 1, 'acct-a', 'acct-b').why, 'grace');
  const st3 = enter(0);
  wildBlow(st3, 'acct-b', 'acct-a', { d: 0, held: FIST }, 1);   // nothing: his own passage ended by his swing
  assert.ok(hit(st3, G, 'acct-a', 'acct-b').dealt > 0, 'at its end, struck');
});

test('ZONE-GRACE THE LAW, NO WAY OUT OF A FIGHT: a fighter that steps out of the zone and back inside WILD_GRACE.awayMs, or that struck or was struck inside WILD_GRACE.fightMs, enters with no safe passage; away and quiet long enough, it does (mutants: the away unread; the fight unread; the struck side unread)', () => {
  const st = enter(-G);
  const r = hit(st, 1_000);
  assert.ok(r.dealt > 0, 'a fight, past their entry\'s passage');
  // b steps out and straight back in
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), 2_000);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), 2_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(st, 'acct-b', 2_000 + WILD_GRACE.awayMs), 0, 'away long enough, but struck inside the fight\'s minute: none');
  // and the striker the same - a fight is both sides'
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10 }, false, at(-1), 3_000);
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10 }, true, at(-1), 3_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(st, 'acct-a', 3_000 + WILD_GRACE.awayMs), 0, 'the striker none either');
  // quiet a minute, away a moment: none (away too short)
  const t = 1_000 + WILD_GRACE.fightMs + 5_000;
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), t);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), t + 1_000);
  assert.equal(wildGraceLeft(st, 'acct-b', t + 1_000), 0, 'a step out and back');
  // quiet and away long enough: a fresh passage
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), t + 2_000);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), t + 2_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(st, 'acct-b', t + 2_000 + WILD_GRACE.awayMs), G);
});

test('ZONE-GRACE THE LAW, A RISE AND A CROSSING: a fallen rising on its word stands under safe passage; a cell crossed inside the zone - a new room\'s fighter with its carry - is no entry, and keeps the passage it had (mutants: the rise ungraced; a crossing a fresh passage; the passage dropped at the crossing; the carry\'s words unread)', () => {
  const st = enter(-G);
  let k = 0, r;
  do { r = hit(st, 1_000 + 300 * k++); } while (!r.fell && k < 400);
  assert.ok(r.fell, 'b fell');
  const fellAt = 1_000 + 300 * (k - 1);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, true, at(1), fellAt + WILD_REF.riseMs);
  assert.equal(wildGraceLeft(st, 'acct-b', fellAt + WILD_REF.riseMs), G, 'risen: a fresh passage');
  // the crossing: the carry the hub keeps, read in the next room
  const carry = wildCarryOf(JSON.parse(JSON.stringify(wildCarry(st, 'acct-b', fellAt + WILD_REF.riseMs + 5_000))));
  assert.equal(carry.gr, fellAt + WILD_REF.riseMs + G, 'its passage carried');
  const next = newWildRef();
  wildZone(next, 'acct-b', { id: 'peer-b', lv: 10, carry }, true, at(1), fellAt + WILD_REF.riseMs + 6_000);
  assert.equal(wildGraceLeft(next, 'acct-b', fellAt + WILD_REF.riseMs + 6_000), G - 6_000, 'the same passage, never a fresh one');
  // a crossing in the middle of a fight: no passage at all in the next room
  const fight = enter(-G);
  hit(fight, 1_000);
  const c2 = wildCarryOf(wildCarry(fight, 'acct-b', 2_000));
  assert.equal(c2.gr, undefined, 'no passage to carry');
  const room2 = newWildRef();
  wildZone(room2, 'acct-b', { id: 'peer-b', lv: 10, carry: c2 }, true, at(1), 2_500);
  assert.equal(wildGraceLeft(room2, 'acct-b', 2_500), 0, 'a crossing is no way out of a fight');
});

// ─── THE RELAY ───────────────────────────────────────────────────────────────────────────────────────────────────

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));

test('ZONE-GRACE THE RELAY (server/src/index.js _wildGraceSay, _wildGraceBlow): an entry\'s safe passage said to the room; a blow it keeps off said to its striker alone, with what is left; a striker\'s own passage ended by its blow said to the room; past it, blows land (mutants: the entry unsaid; the striker untold; the end unsaid)', async () => {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(CELL, { now: () => clock });
    const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
    const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci }); return ws; };
    const a = await join('peer-0001', -1, 'r00000000000000000a02'), b = await join('peer-0002', 1, 'r00000000000000000a01'), c = await join('peer-0003', 30, 'r00000000000000000a03');
    await say(a, { k: 'zone', z: 1 });
    clock += 1_000;
    await say(b, { k: 'zone', z: 1 });
    for (const ws of [a, b, c]) assert.deepEqual(refs(ws, 'grace').map((g) => [g.id, g.ms]), [['peer-0001', G], ['peer-0002', G]], 'each entry said to the room');
    for (const g of refs(c, 'grace')) assert.ok(validWildRefOut(g), 'a word the wire takes');
    clock += 300;
    await say(a, { k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: W(-1), d: 999 });
    assert.deepEqual(refs(a, 'grace').at(-1), { t: 'wref', k: 'grace', id: 'peer-0002', ms: G - 300, n: 1 }, 'kept off: the striker told what is left');
    assert.ok(!refs(b, 'grace').some((g) => g.n === 1), 'the struck one is told nothing of it');
    assert.deepEqual(refs(c, 'grace').at(-1), { t: 'wref', k: 'grace', id: 'peer-0001', ms: 0 }, 'her own passage ended by her swing, said to the room');
    assert.equal(refs(b, 'hp').length, 0, 'no blow landed');
    clock += G;
    await say(a, { k: 'strike', to: 'peer-0002', n: 2, by: 'melee', p: W(-1), d: 999 });
    assert.equal(refs(b, 'hp').length, 1, 'past his passage, her blow lands');
    assert.ok(rd('server/src/index.js').includes('if (x && x.graceUntil > now && x.graceUntil !== graceWas) this._wildGraceSay(a, x.graceUntil - now);'));
  } finally { Date.now = realNow; }
});

test('ZONE-GRACE THE WIRE (net/wire.js validWildRefOut): `grace` is a fighter\'s id and the ms left - at most WILD_GRACE.ms, pinned equal - and `n` 1 or nothing (mutants: the bound apart; a foreign `n`; an id unchecked)', () => {
  assert.equal(WILD_GRACE_MS_MAX, G, 'one number at both ends');
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'grace', id: 'peer-0001', ms: G }), { k: 'grace', id: 'peer-0001', ms: G });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'grace', id: 'peer-0001', ms: 0 }), { k: 'grace', id: 'peer-0001', ms: 0 });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'grace', id: 'peer-0001', ms: 5, n: 1 }), { k: 'grace', id: 'peer-0001', ms: 5, n: 1 });
  for (const bad of [{ ms: G + 1 }, { ms: -1 }, { ms: 1.5 }, { n: 2 }, { id: 'x y' }, { id: undefined }]) {
    assert.equal(validWildRefOut({ t: 'wref', k: 'grace', id: 'peer-0001', ms: 10, ...bad }), null, JSON.stringify(bad));
  }
});

test('ZONE-GRACE THE CLIENT (systems/wild/wildGrace.js): my passage said once when it begins - never again for a crossing that carries it - and when it ends, by my blow or run out; a blow of mine it kept off said once in WILD_GRACE_SAY_MS; who else is under it kept; the host hears the word and frames it (mutants: begun said twice; the end unsaid; the run-out unsaid; the kept-off line every swing)', () => {
  let clock = 0;
  const said = [];
  const g = createWildGrace({ me: () => 'peer-me', say: (l) => said.push(l), now: () => clock });
  g.heard({ id: 'peer-me', ms: G });
  clock += 10_000;
  g.heard({ id: 'peer-me', ms: G - 10_000 });   // a cell crossed, carried
  assert.deepEqual(said, [WILD_TEXT.graceOn(60)], 'said once');
  assert.equal(said[0], 'Safe passage: no player can harm you for 60 seconds, or until you attack one.');
  assert.equal(g.mine(), G - 10_000);
  g.heard({ id: 'peer-me', ms: 0 });
  assert.deepEqual(said.slice(1), [WILD_TEXT.graceOff()], 'ended by my blow');
  g.frame();
  assert.equal(said.length, 2, 'ended once');
  // run out
  g.heard({ id: 'peer-me', ms: G });
  clock += G;
  g.frame();
  assert.deepEqual(said.slice(-1), [WILD_TEXT.graceOff()]);
  assert.equal(said.length, 4);
  // another's, and a blow it kept off
  g.heard({ id: 'peer-b', ms: 30_000 });
  assert.equal(g.graced('peer-b'), true);
  g.heard({ id: 'peer-b', ms: 29_000, n: 1 });
  g.heard({ id: 'peer-b', ms: 28_700, n: 1 });
  assert.deepEqual(said.slice(4), [WILD_TEXT.graceKept(29)], 'once, however many swings');
  clock += WILD_GRACE_SAY_MS;
  g.heard({ id: 'peer-b', ms: 26_000, n: 1 });
  assert.equal(said.length, 6, 'and again after its pause');
  g.heard({ id: 'peer-b', ms: 0 });
  assert.equal(g.graced('peer-b'), false);
  const w = hostText('src/scenes/world.js');
  assert.ok(w.includes("else if (g.k === 'grace') wildGrace.heard(g);"), 'the referee\'s word heard');
  assert.ok(w.includes('    wildGrace.frame();'), 'the zone\'s frame says the run-out');
});
