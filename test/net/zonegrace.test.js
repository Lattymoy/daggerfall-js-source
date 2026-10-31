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
import { newWildRef, wildZone, wildBlow, wildCarry, wildCarryOf, wildGraceLeft, wildGraceTaken, wildGone, WILD_GRACE, WILD_REF } from '../../src/net/wild/wildRef.js';
import { seaHelm, seaShot } from '../../src/net/sea/seaRef.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { validWildRefOut, WILD_GRACE_MS_MAX, worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { createWildGrace, WILD_GRACE_SAY_MS } from '../../src/systems/wild/wildGrace.js';
import { WILD_TEXT } from '../../src/systems/wild/wildZone.js';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
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
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: 'r-a', ed: true }, true, at(-1), now);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b', ed: true }, true, at(1), now);
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
  wildZone(st2, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), G - 1);   // a keepalive is no entry
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
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), 2_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(st, 'acct-b', 2_000 + WILD_GRACE.awayMs), 0, 'away long enough, but struck inside the fight\'s minute: none');
  // and the striker the same - a fight is both sides'
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10 }, false, at(-1), 3_000);
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ed: true }, true, at(-1), 3_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(st, 'acct-a', 3_000 + WILD_GRACE.awayMs), 0, 'the striker none either');
  // quiet a minute, away a moment: none (away too short)
  const t = 1_000 + WILD_GRACE.fightMs + 5_000;
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), t);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), t + 1_000);
  assert.equal(wildGraceLeft(st, 'acct-b', t + 1_000), 0, 'a step out and back');
  // quiet and away long enough: a fresh passage
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), t + 2_000);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), t + 2_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(st, 'acct-b', t + 2_000 + WILD_GRACE.awayMs), G);
});

test('ZONE-GRACE THE LAW, A RISE AND A CROSSING: a fallen rising on its word has no safe passage (PVP-DEATH, as the owner asked); a cell crossed inside the zone - a new room\'s fighter with its carry - is no entry, and keeps the passage it had (mutants: the rise graced; a crossing a fresh passage; the passage dropped at the crossing; the carry\'s words unread)', () => {
  const st = enter(-G);
  let k = 0, r;
  do { r = hit(st, 1_000 + 300 * k++); } while (!r.fell && k < 400);
  assert.ok(r.fell, 'b fell');
  const fellAt = 1_000 + 300 * (k - 1);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), fellAt + WILD_REF.riseMs);
  assert.equal(wildGraceLeft(st, 'acct-b', fellAt + WILD_REF.riseMs), 0, 'risen: no passage');
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), fellAt + WILD_REF.riseMs + 1);
  const later = fellAt + WILD_REF.riseMs + WILD_GRACE.fightMs;   // PIN MOVED (DEATH-10): the rise is 10 s, so out of the fight a minute past it
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), later);
  assert.equal(wildGraceLeft(st, 'acct-b', later), G, 'a later entry from outside: its passage');
  // a fallen gone to town, back past the rise: the rise is its entry, and no passage
  const away = enter(-G);
  let j = 0, q;
  do { q = hit(away, 1_000 + 300 * j++); } while (!q.fell && j < 400);
  const fell2 = 1_000 + 300 * (j - 1);
  wildZone(away, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), fell2 + 1);
  wildZone(away, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), fell2 + WILD_REF.riseMs);
  assert.equal(wildGraceLeft(away, 'acct-b', fell2 + WILD_REF.riseMs), 0, 'back from town and risen: no passage');
  // the crossing: the carry the hub keeps, read in the next room
  const fresh = newWildRef();
  wildZone(fresh, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), fellAt + WILD_REF.riseMs);
  const carry = wildCarryOf(JSON.parse(JSON.stringify(wildCarry(fresh, 'acct-b', fellAt + WILD_REF.riseMs + 5_000))));
  assert.equal(carry.gr, fellAt + WILD_REF.riseMs + G, 'its passage carried');
  const next = newWildRef();
  wildZone(next, 'acct-b', { id: 'peer-b', lv: 10, carry, ed: true }, true, at(1), fellAt + WILD_REF.riseMs + 6_000);
  assert.equal(wildGraceLeft(next, 'acct-b', fellAt + WILD_REF.riseMs + 6_000), G - 6_000, 'the same passage, never a fresh one');
  // a crossing in the middle of a fight: no passage at all in the next room
  const fight = enter(-G);
  hit(fight, 1_000);
  const c2 = wildCarryOf(wildCarry(fight, 'acct-b', 2_000));
  assert.equal(c2.gr, undefined, 'no passage to carry');
  const room2 = newWildRef();
  wildZone(room2, 'acct-b', { id: 'peer-b', lv: 10, carry: c2, ed: true }, true, at(1), 2_500);
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
    await say(a, { k: 'zone', z: 1, ed: 1 });
    clock += 1_000;
    await say(b, { k: 'zone', z: 1, ed: 1 });
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
  assert.ok(w.includes('    wildGrace.frame(here);'), 'the zone\'s frame says the run-out');   // PIN MOVED (AUDIT PVP-EASE L3-7): with whether I stand in the zone
  // AUDIT PVP-EASE L3-7, L4-6: out of the zone, nothing heard stands and nothing is said
  g.heard({ id: 'peer-me', ms: G });
  g.heard({ id: 'peer-c', ms: 20_000 });
  const n = said.length;
  clock += 8_000;
  g.frame(false);
  clock += G;
  g.frame(false);
  assert.deepEqual([said.length, g.mine(), g.graced('peer-c')], [n, 0, false], 'stepped out: no "Other players can attack you" where none can');
  // the strangers' passages run out forgotten
  g.heard({ id: 'peer-d', ms: 1_000 });
  clock += 2_000;
  g.frame(true);
  assert.equal(g.graced('peer-d'), false);
});

test('ZONE-GRACE AUDIT PVP-EASE L3-1, L3-2, L3-5 THE LAW: A CROSSING AND A WAKE ARE NO ENTRY - the carry holds the last fight (`fa`), whether the fighter stands in the zone by the last room\'s word (`in`) and a passage ended; so a striker crossing, a struck one crossing past the mend, a walker hopping cells and a room woken from its sleep grant no fresh minute (mutants: the fight uncarried; `in` unread; the carry\'s age bounding the fight; an ended passage revived)', () => {
  const st = enter(-G);
  assert.ok(hit(st, 1_000).dealt > 0, 'a fight');
  // the striker crosses 2 s after its blow
  const ca = wildCarryOf(JSON.parse(JSON.stringify(wildCarry(st, 'acct-a', 3_000))));
  assert.deepEqual([ca.fa, ca.in], [1_000, 1], 'its fight and its stand carried');
  const next = newWildRef();
  wildZone(next, 'acct-a', { id: 'peer-a', lv: 10, carry: ca, ed: true }, true, at(-1), 3_000);
  assert.equal(wildGraceLeft(next, 'acct-a', 3_000), 0, 'the striker: none');
  // the struck one crosses 31 s after the blow - past the mend, which bounded the old carry
  wildGone(st, 'acct-b', 32_000);
  const cb = wildCarryOf(wildCarry(st, 'acct-b', 32_000));
  assert.equal(cb.in, undefined, 'its leave');
  const next2 = newWildRef();
  wildZone(next2, 'acct-b', { id: 'peer-b', lv: 10, carry: cb, ed: true }, true, at(1), 33_000);
  assert.equal(wildGraceLeft(next2, 'acct-b', 33_000), 0, 'a crossing: none');
  // and one that steps out the moment after the blow, away the half minute: its fight a minute's still
  const st2 = enter(-G);
  hit(st2, 1_000);
  wildGone(st2, 'acct-b', 2_000);
  const cb2 = wildCarryOf(wildCarry(st2, 'acct-b', 2_000));
  const next3 = newWildRef();
  wildZone(next3, 'acct-b', { id: 'peer-b', lv: 10, carry: cb2, ed: true }, true, at(1), 2_000 + WILD_GRACE.awayMs);
  assert.equal(wildGraceLeft(next3, 'acct-b', 2_000 + WILD_GRACE.awayMs), 0, 'struck inside the fight\'s minute: none');
  // a walker who never fought, crossing cell after cell - and a room that slept and woke, its fighters forgotten
  const w1 = newWildRef();
  wildZone(w1, 'acct-w', { id: 'peer-w', lv: 10, ed: true }, true, at(0), 0);
  assert.equal(wildGraceLeft(w1, 'acct-w', 0), G, 'its entry');
  const cw = wildCarryOf(wildCarry(w1, 'acct-w', 50_000));
  for (const t of [85_000, 140_000]) {
    const w2 = newWildRef();
    wildZone(w2, 'acct-w', { id: 'peer-w', lv: 10, carry: cw, ed: true }, true, at(0), t);
    assert.equal(wildGraceLeft(w2, 'acct-w', t), 0, `at ${t}: in the zone by the last word - never a fresh minute`);
  }
  // L3-5: a passage its own blow ended stays ended across the line
  const e = enter(0);
  assert.equal(hit(e, 1_000).graceEnded, true);
  const ce = wildCarryOf(wildCarry(e, 'acct-a', 1_500));
  assert.equal(ce.gr, undefined);
  const e2 = newWildRef();
  wildZone(e2, 'acct-a', { id: 'peer-a', lv: 10, carry: { ...ce, gr: 61_000, at: 1_000 } }, true, at(-1), 1_200);
  wildZone(e2, 'acct-a', { id: 'peer-a', lv: 10 }, false, at(-1), 1_300);
  wildZone(e2, 'acct-a', { id: 'peer-a', lv: 10, carry: ce, ed: true }, true, at(-1), 4_000);
  assert.equal(wildGraceLeft(e2, 'acct-a', 4_000), 0, 'the newer word: ended');
});

test('ZONE-GRACE AUDIT PVP-EASE L3-6 + L3-4 THE LAW: no rise grants the minute - a death to a foe neither (PVP-DEATH, as the owner asked), carried to the town\'s cell; the next entry from outside does; and a take from a remains ends it (as the owner asked) (mutants: a foe\'s rise graced; `dd` uncarried; a take unread)', () => {
  const st = enter(-G);
  hit(st, 1_000);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, died: true }, false, at(1), 2_000);   // a foe's kill, said on its way out
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), 12_000);
  assert.equal(wildGraceLeft(st, 'acct-b', 12_000), 0, 'risen from a foe\'s kill: no passage');
  // the town in another cell
  const st2 = enter(-G);
  wildZone(st2, 'acct-b', { id: 'peer-b', lv: 10, died: true }, false, at(1), 2_000);
  const cd = wildCarryOf(wildCarry(st2, 'acct-b', 2_000));
  assert.equal(cd.dd, 2_000);
  const town = newWildRef();
  const back = 2_000 + WILD_GRACE.awayMs + 1;   // away and quiet long enough for an entry's passage, but a death's return
  wildZone(town, 'acct-b', { id: 'peer-b', lv: 10, carry: cd, ed: true }, true, at(1), back);
  assert.equal(wildGraceLeft(town, 'acct-b', back), 0, 'the death carried: no passage in the town\'s cell');
  wildZone(town, 'acct-b', { id: 'peer-b', lv: 10 }, false, at(1), 16_000);
  wildZone(town, 'acct-b', { id: 'peer-b', lv: 10, ed: true }, true, at(1), 17_000 + WILD_GRACE.awayMs + G);
  assert.equal(wildGraceLeft(town, 'acct-b', 17_000 + WILD_GRACE.awayMs + G), G, 'a later entry from outside, out of the fight: its passage');
  // a take
  const T = 18_000 + WILD_GRACE.awayMs + G;
  assert.equal(wildGraceTaken(town, 'acct-b', T), true);
  assert.equal(wildGraceLeft(town, 'acct-b', T), 0, 'its take ended it');
  assert.equal(wildGraceTaken(town, 'acct-b', T), false, 'none to end');
});

test('ZONE-GRACE AUDIT PVP-EASE L3-3 THE SEA (net/sea/seaRef.js seaShot): a ship whose captain is under safe passage takes no shot; a graced captain\'s own shot ends its passage and lands; a gunfight is a fight for both, for an entry\'s ask (mutants: the target\'s passage unread; the shooter\'s kept; the fight unmarked)', () => {
  const sea = newWildRef();
  wildZone(sea, 'a', { id: 'pa', lv: 10, ci: 'r-a', ed: true }, true, { x: 0, y: 0, z: 0 }, 0);   // just sailed in
  wildZone(sea, 'b', { id: 'pb', lv: 10, ci: 'r-b', ed: true }, true, { x: 50 * M, y: 0, z: 0 }, -G);   // long since
  seaHelm(sea, 'a', { id: 'pa', ci: 'r-a', hl: 2, t: 1, u: 11, h: 1 }, 1_000);
  seaHelm(sea, 'b', { id: 'pb', ci: 'r-b', hl: 2, t: 1, u: 22, h: 1 }, 1_000);
  const no = seaShot(sea, 'b', 'a', { d: 50 }, 3_000);
  assert.deepEqual([no.ok, no.dealt, no.why], [false, 0, 'grace'], 'her ship kept from the shot');
  const yes = seaShot(sea, 'a', 'b', { d: 50 }, 3_000);
  assert.deepEqual([yes.ok, yes.dealt > 0, yes.graceEnded], [true, true, true], 'her own shot ends her passage, and lands');
  assert.equal(wildGraceLeft(sea, 'a', 3_000), 0);
  assert.deepEqual([sea.fighters.get('a').fightAt, sea.fighters.get('b').fightAt], [3_000, 3_000], 'a fight, both sides');
});

test('ZONE-GRACE AUDIT PVP-EASE L3-1 THE RELAY (server/src/index.js): the hub holds a fighter IN the zone from its entry to its leave - a striker crossing into the next cell, and a cell that slept and woke, grant no fresh minute; a leave said by a room the fighter has already left (its old socket closing after it stood in the next) is dropped; a real leave and a quiet return grant it (mutants: the entry and the leave unput; the socket\'s leave unput; the hub\'s newest-wins alone; a take unread)', async () => {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((res) => setImmediate(res)); };
  try {
    const world = fakeRooms({ now: () => clock });
    const A = worldRoom(PX, PY), B = worldRoom(PX + 2 * 16, PY);
    assert.notEqual(A, B, 'two cells');
    const base = (key) => { const m = /^world:(-?\d+),(-?\d+)$/.exec(key); return { x: Number(m[1]) * PIXEL_UNITS + 16384, z: (499 - Number(m[2])) * PIXEL_UNITS + 16384 }; };
    const zone = (key, ws) => world.room(key).raw(ws, JSON.stringify({ t: 'wild', data: { k: 'zone', z: 1, ed: 1 } }));
    const join = async (key, id, x, ci) => {
      const r = world.room(key), b0 = base(key), ws = r.connect();
      await r.hello(ws, id, { x: b0.x + x * M, y: 0, z: b0.z, yaw: 0, pitch: 0 }, { lv: 10, look: LOOK, rc: 1, ci });
      await zone(key, ws);
      await settle();
      return ws;
    };
    const fresh = (ws, id) => refs(ws, 'grace').filter((g) => g.id === id && g.ms === G);
    const ra = world.room(A), rb = world.room(B);
    const a = await join(A, 'peer-0001', -1, 'r00000000000000000a02'), b = await join(A, 'peer-0002', 1, 'r00000000000000000a01');
    clock += G + 1_000;
    const b0 = base(A);
    await ra.raw(a, JSON.stringify({ t: 'wild', data: { k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: [b0.x - M, 0, b0.z], d: 999 } }));
    assert.equal(refs(b, 'hp').length, 1, 'a blow landed');
    // the striker's page crosses: its socket in B said in the zone before its socket in A closes
    clock += 2_000;
    const a2 = await join(B, 'peer-0001', -1, 'r00000000000000000a02');
    await ra.drop(a);
    await settle();
    assert.deepEqual(fresh(a2, 'peer-0001'), [], 'a crossing: no fresh passage');
    // B sleeps and wakes, its fighters forgotten - a minute past the fight, and past A's late leave
    clock += G + 1_000;
    rb.room._wildRef = null;
    await zone(B, a2);
    await settle();
    assert.deepEqual(fresh(a2, 'peer-0001'), [], 'a room woken: in the zone by the hub\'s word, no fresh minute');
    // a real leave, and a quiet return past the away and the fight
    const c = await join(A, 'peer-0003', 30, 'r00000000000000000a03');
    assert.equal(fresh(c, 'peer-0003').length, 1, 'its entry');
    clock += 1_000;
    await ra.drop(c);
    await settle();
    clock += G + 1_000;
    const c2 = await join(A, 'peer-0003', 30, 'r00000000000000000a03');
    assert.equal(fresh(c2, 'peer-0003').length, 1, 'gone and back after a quiet minute: its passage');
  } finally { Date.now = realNow; }
  const relay = rd('server/src/index.js');
  for (const seam of [
    'if (x && (x.zone !== wasIn || died)) this._wildCarryPut(a.sub, this._zoneCarry(st, a.sub, now, a.key));',
    'seaGone(this._wildRef, a.sub, Date.now()); this._wildLeaveCarry(a, Date.now()); }',
    'if (res.graceEnded) { this._wildGraceSay(a, 0); this._wildCarryPut(a.sub, this._zoneCarry(st, a.sub, now, a.key)); }',
    'this._wildGraceTake(a, now);   // AUDIT PVP-EASE L3-4 (the owner: "Any take ends passage"): its own remains or another\'s',
    "this._wildGraceTake(a, now);   // AUDIT PVP-EASE L3-4: a take ends safe passage",
    'if (!st || !a.sub || !wildGraceTaken(st, a.sub, now)) return;\n    this._wildGraceSay(a, 0);\n    this._wildCarryPut(a.sub, this._zoneCarry(st, a.sub, now, a.key));',
    "if (res.graceEnded || res.why === 'grace') this._wildGraceBlow(a, tb, st, res, now);   // AUDIT PVP-EASE L3-3: safe passage, as a blow's",
  ]) assert.ok(relay.includes(seam), seam);
});
