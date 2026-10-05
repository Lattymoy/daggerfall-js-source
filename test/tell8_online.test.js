// TELL8 - ONLINE (bible/12-Enhanced-AI/Feud-Arc.md section 10; Mac, 2026-10-04: "breath more depth into it", then "Go"
// on every call - OPEN 9: wind-ups at peers, each client judging its own feet). Before it a telegraphed blow lived on its
// owner's machine alone: no peer saw a mark, a glint or a held arm, and a foe never wound up at a peer.
// The record's law (net/wire.js validFoeRecord, each field); the owner's word (ai/puppetBlows.js blowWire) and the
// puppet's synthetic state (applyBlowRecord, puppetBlowTurn) - a mark from `wl`, its tracking, a feint's cut, a break,
// a late record, the stagger and the overreach on its entity; each judges their own feet - ON A REAL SPRITE the held
// arm, the strike after the landing and the verdict, weight and effect the host's door spends; THE OWNER'S REAL BRAIN
// winding up at a peer and judging its window by its own view, never the damage; the blow's class (net/wire.js
// hitClassField/hitClassOf, blowClassOf) and the owner's door weighing it; a puppet handed over thinks afresh; the
// hosts by source; the relay's row.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { validFoeRecord, hitClassField, hitClassOf, HIT_CLASS_K_MAX, FOE_WINDUP_MS, FOE_WINDUP_REACH, POSE_BOUND, RELAY_VERSION } from '../src/net/wire.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, tacticsStep, foeGlint, poiseTrack, LOCAL_TARGET, staggeredNow, overreachedNow, tokensOut } from '../src/ai/tactics.js';
import { makeBlow, resetBlows, liveBlows, drawableBlows, blowConnects, blowScaled, BLOW, IRON_COLOR, BLOW_COLOR } from '../src/ai/foeBlows.js';
import { TELL } from '../src/ai/tells.js';
import { WIRE_KINDS, WIRE_IRON, WIRE_FEINT, WIRE_LANDED, WIRE_LANDED_S, WIRE_LAND_MS, PUPPET_HELD_UNTIL, blowWire, blowWireKey, applyBlowRecord, puppetBlowTurn, puppetGapLanded, blowClassOf, puppetBlow } from '../src/ai/puppetBlows.js';
import { blowTakenScale } from '../src/systems/blowTaken.js';
import { windupDoor, landBlowEffect } from '../src/scenes/hostCombat.js';
import { _resetBlowEffectsForTests } from '../src/systems/blowEffects.js';
import { MobileUnit } from '../src/characters/mobileUnit.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let T = 10;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); _resetBlowEffectsForTests(); T = 10; setPref('enhancedAI', true); });
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ── the record ──────────────────────────────────────────────────────

test('TELL8: the record\'s law - the wind-up\'s four fields together (its shape and flags, yaw, landing, origin), a point with them, the stagger or the overreach; each malformed one refuses the record (mutants: a field let through unbounded; the four apart)', () => {
  const base = { i: 3, t: 7, f: [1, 2, 3] };
  const w = { wk: 0, wy: 0.5, wl: 700, wo: [10, 2, -4], wn: 4 };
  assert.deepEqual(validFoeRecord({ ...base, ...w, wp: 3.5, ws: 1 }), { ...base, ...w, wp: 3.5, ws: 1 });
  assert.deepEqual(validFoeRecord({ ...base, wk: 6 | WIRE_IRON | WIRE_FEINT, wy: 7, wl: 0, wo: [0, 0, 0], wn: 9 }).wy, 7 - 2 * Math.PI, 'the yaw wrapped, as `y`');
  assert.deepEqual(validFoeRecord({ ...base, ws: 2 }), { ...base, ws: 2 }, 'a stagger or an overreach rides alone');
  assert.deepEqual(validFoeRecord(base), base, 'none: an old record reads as before');
  for (const [bad, why] of [
    [{ wk: 7 }, 'shape 7 is none'], [{ wk: 128 }, 'past the flags'],   // PIN MOVED (FEUD WIRE: +64 a revenant's signature)
    [{ wn: 256 }, 'a serial past a byte'], [{ wn: -1 }, 'a serial below'], [{ wn: 1.5 }, 'a whole serial'], [{ wk: -1 }, 'negative'], [{ wk: 1.5 }, 'whole'],
    [{ wy: NaN }, 'a yaw'], [{ wl: FOE_WINDUP_MS + 1 }, 'a landing past 3 s'], [{ wl: -1 }, 'a landing past'], [{ wl: 2.5 }, 'whole ms'],
    [{ wo: [1, 2] }, 'three'], [{ wo: [POSE_BOUND * 2, 0, 0] }, 'bounded as `f`'], [{ wo: [0, 1e6, 0] }, 'its height bounded'],
    [{ wp: -1 }, 'a point behind'], [{ wp: FOE_WINDUP_REACH + 1 }, 'a point too far'],
  ]) assert.equal(validFoeRecord({ ...base, ...w, ...bad }), null, why);
  for (const k of ['wk', 'wy', 'wl', 'wo', 'wn']) { const r = { ...base, ...w }; delete r[k]; assert.equal(validFoeRecord(r), null, `${k} missing: the five ride together`); }
  assert.equal(validFoeRecord({ ...base, ...w, wk: 0 | WIRE_LANDED, wl: 0 }).wk, WIRE_LANDED, 'AUDIT TELL O2: a landing said after it');
  assert.equal(validFoeRecord({ ...base, wp: 2 }), null, 'a point with no wind-up');
  for (const ws of [0, 3, '1', true]) assert.equal(validFoeRecord({ ...base, ws }), null, `ws ${ws}`);
  assert.equal(WIRE_LAND_MS, FOE_WINDUP_MS, 'the writer\'s ceiling is the reader\'s');
  assert.deepEqual([...WIRE_KINDS], ['lunge', 'sweep', 'slam', 'ring', 'charge', 'leap', 'aimed']);
  assert.equal(RELAY_VERSION, 'world170');   // AUDIT TELL moved it on (world162 was TELL8's, world163 AUDIT TELL's on the branch); RVN13 and FEUD WIRE after it, and FEUD's merge of main renumbered the arc's relay to world170 - PIN MOVED
});

test('TELL8: the owner\'s word - a live wind-up\'s shape, iron and feint flags, yaw, landing in ms (clamped), origin through the record\'s projection and point; none for a cut feint, a landed blow or a puppet; the stagger and the overreach; the dedupe key never carries `wl` (mutants: a flag dropped; wl in the key)', () => {
  const b = makeBlow('leap', [5, 1, 5], 0.25, 10, IRON_COLOR, 'iron');
  b.ahead = 6.123; b.feint = true;
  const ai = { _tac: { state: 'windup', blow: b } };
  const toWire = (p) => [p[0] * 2, p[1], p[2] * 2];
  const r = blowWire(ai, 10.4, toWire);
  assert.deepEqual(r, { wk: 5 | WIRE_IRON | WIRE_FEINT, wy: 0.25, wl: Math.round((b.land - 10.4) * 1000), wo: [10, 1, 10], wn: 0, wp: 6.12 });
  const later = blowWire(ai, 10.6, toWire);
  assert.equal(blowWireKey(r), blowWireKey(later), 'the key holds as the landing runs down');
  assert.notEqual(r.wl, later.wl);
  b.yaw = 0.5;
  assert.notEqual(blowWireKey(blowWire(ai, 10.6, toWire)), blowWireKey(r), 'a tracking turn re-sends');
  b.land = 20; assert.equal(blowWire(ai, 10, toWire).wl, WIRE_LAND_MS, 'clamped');
  b.cut = 10.5; assert.deepEqual(blowWire(ai, 10.6, toWire), {}, 'a cut feint is no wind-up');
  b.cut = undefined; assert.deepEqual(blowWire(ai, 21, toWire), {}, 'nor one past its landing');
  assert.deepEqual(blowWire({ _tac: { state: 'staggered', until: 12 } }, 11), { ws: 1 });
  assert.deepEqual(blowWire({ _tac: { state: 'overreach', until: 12 } }, 11), { ws: 2 });
  assert.deepEqual(blowWire({ _tac: { state: 'overreach', until: 12 } }, 12.5), {}, 'spent');
  assert.deepEqual(blowWire({ _tac: { puppet: true, state: 'windup', blow: b } }, 10), {}, 'a puppet\'s synthetic state says nothing');
  assert.deepEqual(blowWire(null), {});
  assert.deepEqual(blowWire({ _tac: { state: 'windup', blow: makeBlow('lunge', [0, 0, 0], 0, 10) } }, 10.1).wk, 0, 'a plain lunge: shape 0, no flags');
});

// ── the puppet ──────────────────────────────────────────────────────

test('TELL8: the puppet\'s state - its mark from `wl` (landing at now + wl, part-filled by the shape\'s length), its colour, its glint (none for a feint), the bar\'s track; tracking turns it; a late record after its landing is no second blow (mutants: the start not part-filled; a new blow per record; the landed blow reborn)', () => {
  const ai = { feet: [0, 0, 0] };
  applyBlowRecord(ai, { wk: 2 | WIRE_IRON, wy: 0.3, wl: 400, wo: [0, 0, 3], wn: 1 }, { origin: [0, 0, 3] });
  const b = puppetBlow(ai);
  assert.ok(b);
  assert.equal(b.kind, 'slam');
  assert.equal(b.guard, 'iron');
  assert.ok(near(b.land, 10.4));
  assert.ok(near(b.land - b.start, BLOW.slam.windup + TELL.IRON_EXTRA), 'the shape\'s nominal length - a late record starts part-filled');
  assert.deepEqual([...b.color], [...IRON_COLOR]);
  assert.equal(ai._tac.puppet, true);
  assert.equal(ai._tac.state, 'windup');
  assert.ok(foeGlint(ai, 10.1), 'its glint');
  assert.deepEqual(poiseTrack(ai), { state: 'iron', fill: 1, word: 'Iron' }, 'the bar reads it');
  assert.equal(drawableBlows(10.1, [0, 0, 0]).length, 1, 'the ground draws it');
  puppetBlowTurn(ai, null, 10.35);
  assert.equal(drawableBlows(10.36, [0, 0, 0]).length, 1, 'kept seen by its frames - records come only when it changes');
  // the same blow again (a re-sent record, its tracking turned): updated, not reborn
  applyBlowRecord(ai, { wk: 2 | WIRE_IRON, wy: 0.6, wl: 300, wo: [0.1, 0, 3], wn: 1 }, { origin: [0.1, 0, 3] });
  assert.equal(puppetBlow(ai), b);
  assert.equal(b.yaw, 0.6);
  assert.ok(near(b.land, 10.4), 'its landing kept');
  // the landing, on this machine's clock; then a record written before it, read after it
  T = 10.45; puppetBlowTurn(ai, null, T);
  assert.equal(ai._tac.state, 'engage');
  applyBlowRecord(ai, { wk: 2 | WIRE_IRON, wy: 0.6, wl: 50, wo: [0.1, 0, 3], wn: 1 }, { origin: [0.1, 0, 3] });
  assert.equal(ai._tac.state, 'engage', 'the landed blow is not wound up again');
  // a feint: no glint; a sweep
  const fai = { feet: [0, 0, 0] };
  applyBlowRecord(fai, { wk: 1 | WIRE_FEINT, wy: 0, wl: 600, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0] });
  assert.equal(puppetBlow(fai).feint, true);
  assert.deepEqual([...puppetBlow(fai).color], [...BLOW_COLOR]);
  assert.equal(foeGlint(fai, 10.1), null, 'a feint never glints');
});

test('TELL8: the field gone - a feint\'s cut dashes its mark and lets its swing go on, a break drops the mark and cancels the held arm once; the stagger and the overreach on the puppet and its entity, so my roll takes x1.25 and x1.3 (mutants: the cancel never sent; the fold infinite - unread)', () => {
  const ai = { feet: [0, 0, 0] }, ent = {};
  applyBlowRecord(ai, { wk: 0 | WIRE_FEINT, wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0], entity: ent });
  const fb = puppetBlow(ai);
  assert.deepEqual(puppetBlowTurn(ai, null, 10.1), { hold: true, staggered: false }, 'held through its wind-up');
  T = 10.2; applyBlowRecord(ai, {}, { entity: ent });
  assert.equal(fb.cut, 10.2, 'cut: its mark fades dashed');
  assert.deepEqual(puppetBlowTurn(ai, null, 10.25), { hold: false, staggered: false }, 'its held swing goes on as a plain blow');
  // a break: a stagger arrives with the field gone
  applyBlowRecord(ai, { wk: 0, wy: 0, wl: 500, wo: [0, 0, 0], wn: 2 }, { origin: [0, 0, 0], entity: ent });
  T = 10.4; applyBlowRecord(ai, { ws: 1 }, { entity: ent });
  assert.equal(liveBlows().has(ai), false, 'its mark gone');
  assert.equal(ai._tac.state, 'staggered');
  assert.deepEqual(puppetBlowTurn(ai, null, 10.45), { hold: 'cancel', staggered: true }, 'the held arm dropped, once');
  assert.deepEqual(puppetBlowTurn(ai, null, 10.5), { hold: false, staggered: true });
  assert.equal(ent.staggerUntil, PUPPET_HELD_UNTIL);
  assert.ok(staggeredNow(ent), 'the fold reads it');
  assert.equal(blowTakenScale(null, ent), TELL.STAGGER_TAKEN, 'my roll against it takes x1.25');
  applyBlowRecord(ai, { ws: 2 }, { entity: ent });
  assert.equal(ai._tac.state, 'overreach');
  assert.ok(overreachedNow(ent) && !staggeredNow(ent));
  assert.equal(blowTakenScale(null, ent), TELL.PUNISH_TAKEN, 'x1.3');
  assert.deepEqual(puppetBlowTurn(ai, null, 10.6), { hold: 'spent', staggered: false }, 'the follow-through stands');
  assert.deepEqual(poiseTrack(ai), { state: 'open', fill: 0, word: 'Open' });
  applyBlowRecord(ai, {}, { entity: ent });
  assert.equal(ai._tac.state, 'engage');
  assert.equal(ent.staggerUntil, 0); assert.equal(ent.overreachUntil, 0);
  assert.equal(blowTakenScale(null, ent), 1, 'its owner said it ended');
});

test('TELL8: each judges their own feet - a puppet\'s blow AT ME lands on my feet: in it the verdict, its weight and its effect for the host\'s door; out of it a dodge; inside at the late sample and out at the landing a perfect dodge; an onlooker judges nothing; an aimed shot\'s arrow is its owner\'s (mutants: the verdict judged at an onlooker; the weight unset; the perfect never)', () => {
  const at = (me) => { const ai = { feet: [0, 0, 0] }; applyBlowRecord(ai, { wk: 0, wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0], me }); return ai; };
  // in the lane at the landing: a hit
  let ai = at(true);
  assert.equal(ai._tac.key, LOCAL_TARGET, 'at me: the cues mark the bar\'s foe');
  T = 10.3; puppetBlowTurn(ai, [0, 0, 2], T);
  T = 10.55; puppetBlowTurn(ai, [0, 0, 2], T);
  assert.equal(ai._blowVerdict, true);
  assert.equal(ai._blowMult, BLOW.lunge.mult);
  assert.deepEqual(ai._blowFx, { kind: 'lunge', iron: false, at: 10.55 });
  assert.equal(ai._blowLandedAt, 10.55);
  assert.equal(blowConnects(ai, false, T), true, 'the host\'s reach test answers the verdict');
  assert.equal(blowScaled(ai, 10), 15, 'and its weight');
  const fx = landBlowEffect({ ai, entity: {} }, 15, [0, 0, 2], T);
  assert.equal(fx?.push, 3, 'and its effect, on MY machine');
  // out of it at the landing, in it at the late sample: a perfect dodge
  ai = at(true);
  T = 10.8; puppetBlowTurn(ai, [0, 0, 2], T);
  T = 10.81; ai._tac.blow.land = 11; puppetBlowTurn(ai, [0, 0, 2], T);
  T = 11.01; puppetBlowTurn(ai, [3, 0, 2], T);
  assert.equal(ai._blowVerdict, false);
  assert.equal(ai._perfectAt, 11.01, 'the parry ring and "Perfect" are mine');
  assert.equal(blowConnects(ai, true, T), false, 'dodged');
  // an onlooker: the blow at another lands on nobody here
  ai = at(false);
  T = 11.6; puppetBlowTurn(ai, [0, 0, 2], T);
  assert.equal(ai._blowVerdict, undefined);
  assert.equal(ai._blowLandedAt, 11.6, 'its landing still sounds');
  // an aimed shot: held never, judged never
  const sh = { feet: [0, 0, 0] };
  applyBlowRecord(sh, { wk: 6, wy: 0, wl: 400, wo: [0, 0, 0], wp: 8, wn: 1 }, { origin: [0, 0, 0], me: true });
  assert.equal(puppetBlow(sh).ahead, 8);
  assert.equal(puppetBlowTurn(sh, [0, 0, 4], T).hold, false);
  T = 12.1; puppetBlowTurn(sh, [0, 0, 4], T);
  assert.equal(sh._blowVerdict, undefined);
  // a charge or a leap that landed lets its long stride through the host's leap gate
  const lp = { feet: [0, 0, 0] };
  applyBlowRecord(lp, { wk: 5, wy: 0, wl: 300, wo: [0, 0, 0], wp: 5, wn: 1 }, { origin: [0, 0, 0], me: true });
  assert.equal(puppetGapLanded(lp, T), false);
  T = 12.5; puppetBlowTurn(lp, [0, 0, 5], T);
  assert.equal(puppetGapLanded(lp, T), true);
  assert.equal(lp._blowVerdict, true, 'the leap\'s disc at its point');
  assert.equal(puppetGapLanded(lp, T + 2), false, 'a verdict\'s life');
  const ln = { feet: [0, 0, 0] };
  applyBlowRecord(ln, { wk: 0, wy: 0, wl: 300, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0], me: true });
  T = 13; puppetBlowTurn(ln, [0, 0, 2], T);
  assert.equal(puppetGapLanded(ln, T), false, 'a lunge carries no stride past a walk');
});

test('TELL8: on a real sprite - the puppet\'s swing starts at its wind-up\'s record, holds its raised arm to the landing and strikes after it (mutants: the hold never passed)', () => {
  const mobile = new MobileUnit(M.Orc, ENEMY_BASICS[M.Orc], () => 8, () => 0.99);
  const ai = { feet: [0, 0, 0] };
  applyBlowRecord(ai, { wk: 0, wy: 0, wl: 600, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0], me: true });
  let struck = null, first = true;
  for (let i = 0; i < 120 && struck == null; i++) {
    T = 10 + i / 60;
    const pb = puppetBlowTurn(ai, [0, 0, 2], T);
    mobile.update(1 / 60, { striking: first, hold: pb.hold }, 0, [0, 0, 0], [0, 1.6, -5]);
    first = false;
    if (mobile.doMeleeDamage) struck = T;
  }
  assert.ok(struck != null, 'it struck');
  assert.ok(struck >= 10.6, `not before its landing (${struck})`);
  assert.equal(ai._blowVerdict, true, 'judged on my feet at the landing, ready for the strike');
});

// ── the owner ───────────────────────────────────────────────────────

test('TELL8: the owner\'s real brain winds up at a peer it hunts (OPEN 9), aimed at the peer\'s feet; at its landing its own view of them opens the window (6.3) - and leaves no verdict, weight or effect to land on anyone here (mutants: the peer never wound up at; the verdict kept at the owner)', () => {
  noteLocalPlayer([50, 0, 50], [0, 0, 1]);   // the owner's player, far off
  const peer = { isPlayer: true, isPeer: true, id: 'p2', feet: [0, 0, 2] };
  const ent = { health: 100, maxHealth: 100, mobileType: M.Orc, level: 12 };
  const ai = { feet: [0, 0, 0], yaw: 0, _armedTargeting: true, target: peer, _dist: 2, inSight: true, detected: true, canAct: true, stopDistance: 2.25, speed: 4, vitals: () => ent };
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    for (let i = 0; i < 40 && ai._tac?.state !== 'windup'; i++) { T += 1 / 16; tacticsStep(ai, 0, 2); }
  } finally { Math.random = rnd; }
  assert.equal(ai._tac.state, 'windup', 'it winds up at the peer');
  const b = ai._tac.blow;
  assert.ok(liveBlows().get(ai) === b);
  assert.notEqual(ai._tac.key, LOCAL_TARGET);
  assert.ok(Object.keys(blowWire(ai, T)).includes('wk'), 'and the record carries it to every peer');
  // the peer steps out: the owner's view says a miss - the window opens; no verdict waits for any swing here
  peer.feet[0] = 20;
  Math.random = () => 0.99;
  try { while (T < b.land + 0.05) { T += 1 / 16; tacticsStep(ai, 20, 2); } } finally { Math.random = rnd; }
  assert.equal(ai._tac.state, 'overreach', 'the owner\'s view opens the window');
  assert.equal(ai._blowVerdict, null);
  assert.equal(ai._blowMult, undefined);
  assert.equal(ai._blowFx, null);
  assert.deepEqual(blowWire(ai, T).ws, 2, 'and says so to the peers');
  // a second, the peer standing in it: the owner's view says a hit - and still nothing is left to land here
  peer.feet[0] = 0;
  Math.random = () => 0;
  try { for (let i = 0; i < 400 && !(ai._tac?.state === 'windup'); i++) { T += 1 / 16; tacticsStep(ai, 0, 2); } } finally { Math.random = rnd; }
  assert.equal(ai._tac.state, 'windup');
  const b2 = ai._tac.blow;
  Math.random = () => 0.99;
  try { while (T < b2.land + 0.05) { T += 1 / 16; tacticsStep(ai, 0, 2); } } finally { Math.random = rnd; }
  assert.notEqual(ai._tac.state, 'overreach', 'a hit in its view: no window');
  assert.equal(ai._blowVerdict, null);
  assert.equal(ai._blowFx, null, 'its effect is the peer\'s to apply, on the peer\'s machine');
});

test('TELL8: a puppet handed to me (its owner gone - the heir) thinks afresh: the synthetic state and its mark are dropped at its first step (mutants: the stale state kept)', () => {
  const ai = { feet: [0, 0, 0], _armedTargeting: false, _dist: Infinity, inSight: false, detected: false };
  applyBlowRecord(ai, { wk: 0, wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0] });
  assert.ok(liveBlows().has(ai));
  tacticsStep(ai, 0, 1);
  assert.equal(liveBlows().has(ai), false);
  assert.ok(ai._tac && !ai._tac.puppet, 'a brain of its own');
});

// ── the blow's class ────────────────────────────────────────────────

test('TELL8: the blow\'s class - its K, its back flag and its weakness flag as one bounded integer, round trip; judged on my machine against the puppet; the owner\'s door weighs a peer\'s blow by it, and without it K_PEER never from behind (mutants: the class unread; the back flag from the owner\'s feet)', () => {
  assert.equal(hitClassField({ k: 1.15, back: true }), 1115);
  assert.deepEqual(hitClassOf({ wc: 1115 }), { k: 1.15, back: true, weak: false });
  assert.deepEqual(hitClassOf({ wc: 3060 }), { k: 0.6, back: true, weak: true });
  assert.equal(hitClassField({ k: 9 }), HIT_CLASS_K_MAX, 'clamped');
  for (const wc of [-1, 4000, 401, 1.5, '100', null]) assert.equal(hitClassOf({ wc }), null, `${wc}`);
  assert.equal(hitClassOf({}), null);
  // judged against the puppet: K by its kind and weapon, my feet behind its facing
  const ai = { _tac: { puppet: true, state: 'windup', blow: makeBlow('lunge', [0, 0, 0], 0, 10) } };
  assert.deepEqual(blowClassOf(ai, { kind: 'melee' }, [0, 0, 2]), { k: TELL.K_HANDS, back: false, weak: false });
  assert.deepEqual(blowClassOf(ai, { kind: 'arrow' }, [0, 0, -2]), { k: TELL.K_ARROW, back: true, weak: false });
  assert.equal(blowClassOf({ _tac: { state: 'engage' } }, { kind: 'melee' }, [0, 0, 2]), null, 'not winding up: no class');
  // the owner's door
  const foe = () => ({ entity: { health: 100, maxHealth: 100 }, ai: { feet: [0, 0, 0], _tac: { state: 'windup', blow: makeBlow('lunge', [0, 0, 0], 0, 10) } } });
  const f1 = foe(), f2 = foe(), f3 = foe();
  windupDoor(f1, 10, { kind: 'melee', peer: true, weight: 600, from: [0, 0, -2] });
  windupDoor(f2, 10, { kind: 'melee', peer: true, weight: 600, wc: { k: 1.3, back: true, weak: false } });
  windupDoor(f3, 10, { kind: 'melee', peer: true, weight: 600, wc: { k: 0.5, back: false, weak: false } });
  assert.equal(f1.ai._tac.blow.taken, 10 * TELL.K_PEER, 'K_PEER - and never from behind: `from` is the owner\'s feet, not the peer\'s');
  assert.ok(near(f2.ai._tac.blow.taken, 10 * 1.3 * TELL.POISE_BACK), 'its class and its back');
  assert.ok(near(f3.ai._tac.blow.taken, 5));
});

// ── the hosts ───────────────────────────────────────────────────────

test('TELL8: the hosts by source - both pools write the wind-up into the record and its key, read it onto the puppet (at me by the blow\'s recipient), turn it every frame (the hold, the stagger\'s Hurt, the cues), carry the class out and in; the watch\'s door; the leap gate (mutants: any pool unwired)', () => {
  const x = rd('src/scenes/exteriorFoes.js'), d = rd('src/scenes/dungeonContext.js');
  assert.match(x, /if \(!f\.dead && f\.ai\._tac && !f\.ai\._tac\.puppet\) Object\.assign\(r, blowWire\(f\.ai, tacticsNow\(\), \(p\) => _net\.toWire\(p\)\)\);/);
  assert.match(x, /\$\{r\.sp \?\? 0\}(?:,\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rt \?\? -1\},\$\{r\.rb \?\? 0\})?\$\{r\.wk !== undefined \|\| r\.ws !== undefined \? `,\$\{blowWireKey\(r\)\}` : ''\}`;/);   // PIN MOVED (FEUD WIRE: and the revenant's blows, `rb`)
  assert.match(x, /if \(r\.d !== 1 && \(r\.wk !== undefined \|\| r\.ws !== undefined \|\| f\.ai\._tac\?\.puppet\)\) applyBlowRecord\(f\.ai, r, \{ origin: r\.wo \? _net\.toScene\(r\.wo\) : null, me: recipientIsMe\(f, r\.b \?\? r\.g \?\? p\.target\), entity: f\.entity, collider, sig: SIG \}\);/);   // PIN MOVED (FEUD WIRE: and the signature's numbers)
  assert.match(x, /const _pb = f\.ai\._tac\?\.puppet \? puppetBlowTurn\(f\.ai, playerFeet\) : NO_PUPPET_BLOW;/);
  assert.match(x, /hurting: f\.ai\.hurtKnock \|\| _pb\.staggered, casting: !!f\._castPending, hold: _pb\.hold \}/);
  assert.match(x, /if \(f\._pup\?\.leap && !puppetGapLanded\(f\.ai\)\) return false;/);
  // PIN MOVED (AUDIT FEUD: a blow of its weakness rides its class winding up or not - blowClassOf answers null otherwise;
  // AUDIT FEUD 2: a blow that landed)
  assert.match(x, /const _wc = blowClassOf\(f\.ai, \{ kind, weapon, claws: !weapon && !!playerEntity\?\.isInBeastForm, round \}, playerFeet, !round && damage > 0 && feudWeakBlow\(f\.entity, \{ kind, weapon, element, attacker: playerEntity \}\)\);/);
  assert.match(x, /\.\.\.\(_wc \? \{ wc: hitClassField\(_wc\) \} : \{\}\),/);
  assert.match(x, /whole: data\.z === 1, \.\.\.\(data\.wc != null \? \{ wc: hitClassOf\(data\) \} : \{\}\) \}\);/);
  assert.match(x, /if \(onWatch\) _net\.watch\.hurt\(f, dmg, at, dir, data\.wc != null \? hitClassOf\(data\) : null, kind\);/);   // PIN MOVED (AUDIT TELL P1: and its kind)
  assert.match(d, /if \(!f\.dead && f\.ai\._tac && !f\.ai\._tac\.puppet\) Object\.assign\(r, blowWire\(f\.ai, tacticsNow\(\)\)\);/);
  assert.match(d, /\$\{r\.v\}(?:,\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\})?\$\{r\.wk !== undefined \|\| r\.ws !== undefined \? `,\$\{blowWireKey\(r\)\}` : ''\}`;/);   // PIN MOVED (FEUD WIRE: and the revenant's blows, `rb`)
  assert.match(d, /applyBlowRecord\(f\.ai, r, \{ origin: r\.wo \?\? null, me: _to != null && _me != null && _to === _me, entity: f\.entity, collider, sig: SIG \}\);/);   // PIN MOVED (FEUD WIRE: and the signature's numbers)
  assert.match(d, /_pb = f\.ai\._tac\?\.puppet \? puppetBlowTurn\(f\.ai, _pf\) : null;/);
  assert.match(d, /if \(r\.d !== 1 && \(r\.wk !== undefined \|\| r\.ws !== undefined \|\| f\.ai\._tac\?\.puppet\)\) \{/, 'a record and a puppet that say none: nothing to do (the lifted harnesses reach none of it)');
  assert.match(d, /hold: _puppet \? \(_pb\?\.hold \?\? false\) : f\.ai\._blowHold,/);
  assert.equal((d.match(/\.\.\.\(_wc \? \{ wc: hitClassField\(_wc\) \} : \{\}\),/g) ?? []).length, 2, 'both of the dungeon\'s lanes');
  assert.match(d, /whole: data\.z === 1, \.\.\.\(data\.wc != null \? \{ wc: hitClassOf\(data\) \} : \{\}\) \}\);/);
  assert.match(rd('src/scenes/world.js'), /hurt: \(g, dmg, at, dir, wc = null, kind = 'melee'\) => cityGuards\.hurtGuard\(g, dmg, at, dir, \{ fromPlayer: false, peer: true, wc, kind \}\) \},/);   // PIN MOVED (AUDIT TELL P1: and its kind)
  assert.match(rd('src/scenes/cityGuards.js'), /from: striker\?\.ai\?\.feet \?\? playerFeet, wc,/);
  assert.match(rd('test/relayversion.test.js'), /world170: '[0-9a-f]{64}',   \/\/ FEUD [^\n]*TELL8's wind-up, stagger and blow class on the foe record/);   // PIN MOVED (FEUD's merge of main): TELL8's world162 is one version with the arc's other wire changes, world170
});

// ── AUDIT TELL: the landing on the wire, the blow's serial ─────────

test('AUDIT TELL O2: the owner SAYS its landing (+32, wl 0) for WIRE_LANDED_S after it, under the blow\'s serial; a receiver whose clock runs behind lands the blow on that word - never reads the field gone as a break; an overreach record lands it too; a chain\'s next serial lands the one before; a break still cancels (mutants: the landing unsaid; the landed record ignored; the serial unread)', () => {
  // the owner
  const b = makeBlow('lunge', [0, 0, 0], 0, 9.3); b.n = 7;
  const owner = { _tac: { state: 'engage', landed: { blow: b, at: 10 } } };
  assert.deepEqual(blowWire(owner, 10.2), { wk: WIRE_LANDED, wy: 0, wl: 0, wo: [0, 0, 0], wn: 7 });
  assert.deepEqual(blowWire(owner, 10 + WIRE_LANDED_S + 0.01), {}, 'said for WIRE_LANDED_S, then nothing');
  assert.notEqual(blowWireKey({ wk: 0, wn: 7, wy: 0, wo: [0, 0, 0] }), blowWireKey({ wk: WIRE_LANDED, wn: 7, wy: 0, wo: [0, 0, 0] }), 'the landing re-sends');
  // a receiver behind: its own landing is 0.9 s off when its owner's word comes
  const at = () => { const ai = { feet: [0, 0, 0] }; applyBlowRecord(ai, { wk: 0, wy: 0, wl: 900, wo: [0, 0, 0], wn: 3 }, { origin: [0, 0, 0], me: true }); puppetBlowTurn(ai, [0, 0, 2], T); return ai; };
  let ai = at();
  T = 10.3; applyBlowRecord(ai, { wk: WIRE_LANDED, wy: 0, wl: 0, wo: [0, 0, 0], wn: 3 }, { origin: [0, 0, 0], me: true });
  assert.equal(ai._tac.state, 'engage', 'landed on its owner\'s word');
  assert.equal(ai._blowVerdict, true, 'judged on my feet');
  assert.equal(liveBlows().get(ai)?.land, 10.3, 'its mark flashes now');
  T = 10.5; applyBlowRecord(ai, {}, { origin: null, me: true });
  assert.equal(puppetBlowTurn(ai, [0, 0, 2], T).hold, false, 'the field gone after: no cancel');
  // an overreach record before its landing here: it landed there
  ai = at();
  T = 10.6; applyBlowRecord(ai, { ws: 2 }, { origin: null, me: true });
  assert.equal(ai._blowVerdict, true);
  assert.equal(ai._tac.state, 'overreach');
  // a chain: its next serial lands the one before, then winds up
  ai = at();
  T = 10.9; applyBlowRecord(ai, { wk: 1, wy: 0, wl: 400, wo: [0, 0, 0], wn: 4 }, { origin: [0, 0, 0], me: true });
  assert.equal(ai._blowVerdict, true, 'the first landed');
  assert.equal(puppetBlow(ai).kind, 'sweep', 'the second wound up');
  assert.equal(puppetBlow(ai).n, 4);
  // the same serial after it landed here (my clock ahead): nothing new
  T = 11.6; puppetBlowTurn(ai, [0, 0, 2], T);
  assert.equal(ai._tac.state, 'engage');
  applyBlowRecord(ai, { wk: 1, wy: 0, wl: 100, wo: [0, 0, 0], wn: 4 }, { origin: [0, 0, 0], me: true });
  assert.equal(ai._tac.state, 'engage', 'not wound up again');
  // a break still cancels
  ai = at();
  T = 12; applyBlowRecord(ai, {}, { origin: null, me: true });
  assert.equal(puppetBlowTurn(ai, [0, 0, 2], T).hold, 'cancel');
  assert.equal(ai._blowVerdict, undefined);
});

test('AUDIT TELL B8 + O4 + O6: a foe that turns on another mid-wind-up breaks it (one blow, one judge); a seat handed back gives up its brain\'s tokens; the gap-closers\' leap gate opens for a charge AT ME, once (mutants: the turn landed; the tokens kept; the gate reopened)', () => {
  noteLocalPlayer([50, 0, 50], [0, 0, 1]);
  const peer = { isPlayer: true, isPeer: true, id: 'p3', feet: [0, 0, 2] };
  const ent = { health: 100, maxHealth: 100, mobileType: M.Orc, level: 12 };
  const ai = { feet: [0, 0, 0], yaw: 0, _armedTargeting: true, target: peer, _dist: 2, inSight: true, detected: true, canAct: true, stopDistance: 2.25, speed: 4, vitals: () => ent };
  const rnd = Math.random;
  Math.random = () => 0;
  try { for (let i = 0; i < 40 && ai._tac?.state !== 'windup'; i++) { T += 1 / 16; tacticsStep(ai, 0, 2); } } finally { Math.random = rnd; }
  assert.equal(ai._tac.state, 'windup');
  const b = ai._tac.blow;
  ai.target = { isPlayer: true, isPeer: true, id: 'p4', feet: [0, 0, 2] };   // turned on another
  T += 1 / 16; tacticsStep(ai, 0, 2);
  assert.equal(liveBlows().has(ai), false, 'its mark gone');
  assert.notEqual(ai._tac.blow, b);
  assert.equal(ai._blowVerdict, null);
  assert.ok(Object.keys(blowWire(ai, T)).every((k) => k !== 'wk'), 'and its peers are told it broke');
  // a seat handed back: the real brain's tokens go before the synthetic state takes its place
  const mine = { feet: [0, 0, 0], yaw: 0, _armedTargeting: false, _dist: 2, inSight: true, detected: true, canAct: true, stopDistance: 2.25, speed: 4, vitals: () => ent };
  T += 1 / 16; tacticsStep(mine, 0, 2);
  assert.ok(mine._tac && !mine._tac.puppet);
  applyBlowRecord(mine, { ws: 1 }, { entity: ent });
  assert.ok(mine._tac.puppet);
  assert.equal(tokensOut(LOCAL_TARGET, 'melee') + tokensOut(LOCAL_TARGET, 'ranged'), 0, 'no token held by a brain that is gone');
  // the leap gate: a charge AT ME, once; a charge at another, never
  const ch = { feet: [0, 0, 0] };
  applyBlowRecord(ch, { wk: 4, wy: 0, wl: 100, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0], me: false });
  T += 0.2; puppetBlowTurn(ch, [0, 0, 3], T);
  assert.equal(puppetGapLanded(ch, T), false, 'a charge at another opens nothing for me');
  const cm = { feet: [0, 0, 0] };
  applyBlowRecord(cm, { wk: 4, wy: 0, wl: 100, wo: [0, 0, 0], wn: 1 }, { origin: [0, 0, 0], me: true });
  T += 0.2; puppetBlowTurn(cm, [0, 0, 3], T);
  assert.equal(puppetGapLanded(cm, T), true);
  assert.equal(puppetGapLanded(cm, T), false, 'once');
});

