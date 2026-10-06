// AUDIT SERPENT (2026-10-04, Mac: "I definitely want to do a conprehensive audit on this and ensure its absolute
// perfection"): the pins of the four lenses' findings (bible/01-Overview/Audit-Sea-Serpent.md) - each one a law that
// failed before its fix. THE BRAIN: one timeline on the relay and every client (S2), the coiled ship's word that comes
// before its coil (S3), the coil let go at the kill and the sounding and the throes said (S4, M2), the yaw a word carries
// (S6), a share kept only by being at the fight (S8, E2, T2), the coil a ship's alone (S10), the ships counted (B7), the
// turn of a phase never unsaying an attack in flight (S2), standing within reach (E1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newSerpentFight, joinSerpentFight, applySerpentHit, stepSerpentBrain, serpentStateOf, serpentEarned, serpentEarnedBy, coilWord, coilHolds,
  pickSerpentTarget, serpentWreck, serpentShareWanted, serpentAtkFrame, SHIP_REF, SERPENT_TTK_S, SERPENT_ATTACK_TABLE, SERPENT_ATTACK_BY_ID, ZONES,
  ENGAGE_R, SERPENT_STAND_R, SERPENT_TARGET_R, SERPENT_IDLE_RETIRE_MS, SERPENT_ABSENT_RETIRE_MS, SERPENT_RECEIPT_SHARE, SERPENT_STOOD_SHARE,
  SERPENT_PHASE_AT, SERPENT_TICK_MS, ORBIT_R, CRUISE_V, SERPENT_SLEEP_MS, COIL_ESC_MS, SERPENT_COIL_PASS,
  SERPENT_SAY_AHEAD_MS, DEEP_V,   // AUDIT SHIPS B5: an end's swim said ahead
} from '../src/net/serpentBrain.js';
import { LEG, MODE, bodyAt, headAt, modeAt, supersede } from '../src/net/serpentBody.js';
import { createSerpentLink, foldSerpent, SERPENT_STATE_EMPTY } from '../src/net/serpentLink.js';
import { validSerpentOut } from '../src/net/wire.js';
import { HULL } from '../src/systems/naval/navalShips.js';

const T0 = 10_000_000;
const SOUND = T0 + 25 * 60_000;
/** A seeded [0,1) source (mulberry32) - the pins' own dice. */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const body = (sub, x, z, dead = false) => ({ sub, x, z, dead });
/** A fight joined by `hls`' ships as s1, s2 ... (or `id`'s accounts - the wire's own shape, for a pin that folds words). */
function fightOf(hls = [HULL.Carrack], id = (i) => `s${i + 1}`) {
  const f = newSerpentFight(363, T0, SOUND, 'sethrakul', 0, 0, 0.4);
  hls.forEach((hl, i) => assert.ok(joinSerpentFight(f, id(i), `P${i + 1}`, 20, hl, T0, true)));
  return f;
}
const acct = (i) => `acct-000${i + 1}`;
function surfaced(f, t = T0) {
  f.legs = [{ k: LEG.arc, at: t - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: t - 30_000, m: MODE.cruise }];
  f.openUntil = t; f.nextAt = t;
  return f;
}
const worst = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, a[i].z - b[i].z)); return d; };
/** A client's link on fight `f`'s site, and its fold of the brain's words as the relay fans them - each naming the
 *  fight's site (server _serpentFan; AUDIT SERPENT 2 F1). */
function clientOf(f, now) {
  const L = createSerpentLink({ now, site: () => ({ day: f.day, sx: f.sx, sz: f.sz }) });
  const fold = (words) => { for (const w of words) { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: f.sx, sz: f.sz }); assert.ok(v, `the wire passes ${w.k}`); L.word(v); } };
  return { L, fold };
}

// ═══ ONE TIMELINE (S2) ═══════════════════════════════════════════════════════════════════════════════════

test('AUDIT SERPENT S2: a word said now supersedes every leg or mode still to come - on the relay as it pushes and on every client as it folds - so the body a client draws is the body the relay judges, beat by beat, through fights, wakes and turns (mutants: the rule dropped on either side; a turn unsaying an attack in flight)', () => {
  assert.deepEqual(supersede([{ at: 1 }, { at: 5 }, { at: 3 }, { at: 9 }], 4), [{ at: 1 }, { at: 3 }]);
  let worstD = 0, sorted = true, beats = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const rng = seeded(seed), dice = seeded(seed + 100);
    const f = fightOf([HULL.Carrack, HULL.SmallShip, HULL.LargeGalley, HULL.LargeBoat], acct);
    let now = T0;
    const { L, fold } = clientOf(f, () => now);
    fold([serpentStateOf(f)]);
    // ships sailing rings about the waters, some out past the serpent's reach
    const orbit = [300, 650, 1050, 480].map((r, i) => ({ r, a: dice() * 6.28, w: (0.02 + dice() * 0.05) * (i % 2 ? -1 : 1) }));
    for (let n = 0; n < 1600; n++) {
      if (seed % 3 === 0 && n === 700) now += 3 * 60_000;   // a room asleep: SERPENT3 takes it up where it was (serpentResume)
      now += SERPENT_TICK_MS;
      const bodies = orbit.map((o, i) => body(acct(i), Math.sin(o.a + o.w * n * 0.25) * o.r, Math.cos(o.a + o.w * n * 0.25) * o.r));
      fold(stepSerpentBrain(f, now, bodies, rng));
      if (n % 4 === 0) fold(applySerpentHit(f, acct(0), 60 + dice() * 80, ZONES.body, bodies[0], now));
      if (f.fell) break;
      sorted &&= f.legs.every((l, i) => !i || f.legs[i - 1].at <= l.at) && f.modes.every((m, i) => !i || f.modes[i - 1].at <= m.at);
      worstD = Math.max(worstD, worst(bodyAt(f, now), bodyAt(L.state(), now)));
      beats++;
    }
  }
  assert.ok(beats > 8000, `fights long enough to turn (${beats} beats)`);
  assert.ok(sorted, 'the relay\'s track and modes always in time order');
  assert.ok(worstD < 0.01, `every client's body is the relay's (${worstD.toFixed(3)} m apart at worst)`);
});

test('AUDIT SERPENT S2: a kill while a ram\'s run is still to come, and the sounding while a Rising Maw\'s burst is (it rides the deep already: its word said for what it drops) - the relay\'s legs and modes and the client\'s stay in time order and the same, the words to come superseded (PIN MOVED, SERPENT3: a breach\'s jump and a woken room\'s surfacing were the words to come; every attack\'s swim is said as it begins now) (mutants: the rule dropped from either side\'s legs or modes; a mode said away unsaid)', () => {
  for (const [end, want] of [['fell', SERPENT_ATTACK_TABLE.ram.id], ['gone', SERPENT_ATTACK_TABLE.breach.id]]) {
    const f = surfaced(fightOf([HULL.Carrack], acct));
    const rng = seeded(11);
    const b = [body(acct(0), 120, 0)];
    let now = T0;
    const { L, fold } = clientOf(f, () => now);
    fold([serpentStateOf(f)]);
    let begun = null;
    while (now < T0 + 300_000 && !begun) { now += SERPENT_TICK_MS; const ws = stepSerpentBrain(f, now, b, rng); fold(ws); begun = ws.find((w) => w.k === 'atk' && w.a === want); }
    assert.ok(begun, `${end}: its ${SERPENT_ATTACK_BY_ID[want].key} begun`);
    // the Maw sounded mid-dash, under the sea already, its burst still to come: the sounding's word is the ride it
    // rides - it changes the track only by what it drops, and is said so every client drops it too
    if (end === 'gone') { now += 1000; fold(stepSerpentBrain(f, now, b, rng)); assert.equal(modeAt(f.modes, now), MODE.deep, 'under the sea'); }
    assert.ok(f.legs.at(-1).at > now && f.modes.at(-1).at > now, 'its swim and its ride still to come');
    now += 10;
    const go = now + SERPENT_SAY_AHEAD_MS, before = (xs) => xs.filter((x) => x.at > now && x.at < go).map((x) => ({ ...x }));
    const legsSaid = before(f.legs), modesSaid = before(f.modes);
    // PIN MOVED (AUDIT 2 XB2, 2026-10-06): its ride said at its turn, SERPENT_SAY_AHEAD_MS on, though it rides it already
    if (end === 'gone') { f.soundAt = now; const said = stepSerpentBrain(f, now, b, rng); fold(said); assert.ok(f.gone, 'sounded'); assert.ok(said.some((w) => w.k === 'dv' && w.at === go && w.m === MODE.deep), 'its ride said, though it rides it already'); }
    else { f.hp = 1; f.shieldUntil = 0; fold(applySerpentHit(f, acct(0), 50, ZONES.body, b[0], now)); assert.ok(f.fell, 'slain as its dash begins'); }
    const inOrder = (xs) => xs.every((x, i) => !i || xs[i - 1].at <= x.at);
    assert.ok(inOrder(f.legs) && inOrder(f.modes), `the relay's in order (${end})`);
    assert.ok(inOrder(L.state().legs) && inOrder(L.state().modes), 'the client\'s in order');
    // PIN MOVED (AUDIT 2 XB2, 2026-10-06): the client's track the relay's from its first leg on - the relay keeps the legs a
    // blow is judged back on a second longer (AUDIT SHIPS D3), as it keeps its modes
    assert.deepEqual(L.state().legs, f.legs.slice(-L.state().legs.length), 'one track');
    assert.deepEqual(L.state().modes, f.modes.slice(-L.state().modes.length), 'one ride');
    // PIN MOVED (AUDIT SHIPS B5, 2026-10-06): nothing still to come after its end but its own throes or dive, said
    // SERPENT_SAY_AHEAD_MS on. PIN MOVED (AUDIT 2 XB2, 2026-10-06): and what was said to come before then, swum as it was
    // said - let go AT the end (holdNow), the swim a screen a wire's time behind had begun was unsaid
    const after = (xs) => xs.filter((x) => x.at >= go);
    assert.deepEqual(after(f.legs).map((l) => l.at), [go], `nothing still to come after its end but its own swim (${end})`);
    const ride = end === 'fell' ? MODE.dying : MODE.deep;
    assert.ok(after(f.modes).every((m) => m.at === go && m.m === ride) && modeAt(f.modes, go) === ride, 'and its own ride');
    assert.deepEqual(before(f.legs), legsSaid, `what was to come before its turn swum as it was said (${end})`);
    assert.deepEqual(before(f.modes), modesSaid, 'and ridden');
    if (end === 'fell') assert.ok(legsSaid.length, 'its run\'s wind-up was to come before its turn');
  }
});

test('AUDIT SERPENT S2: a room that wakes takes its fight up ONCE - PIN MOVED (SERPENT3): no longer a surfacing leapt back inside its waters, but one round laid from its last beat where its head was (serpentResume), however many beats pass after; its head never leaps and never swam on (mutants: asked again every beat; the head left to swim on)', () => {
  const f = fightOf([HULL.Carrack]);
  f.legs = [{ k: LEG.line, at: T0 - 120_000, x: 0, z: 0, yw: 0, v: 11 }];   // two minutes' swim north from the heart...
  f.modes = [{ at: T0 - 120_000, m: MODE.cruise }];
  f.openUntil = T0; f.nextAt = T0 + 60_000;
  f.lastTickAt = T0 - 120_000 + 1;   // ...with no beat since its first moment: nobody heard it
  assert.ok(T0 - f.lastTickAt > SERPENT_SLEEP_MS);
  const t0 = f.lastTickAt, was = headAt(f.legs, t0);
  const words = [];
  for (let t = T0; t <= T0 + 4000; t += SERPENT_TICK_MS) {
    const said = stepSerpentBrain(f, t, [], seeded(1));
    // once: no beat after it lays a leg back before its own moment - only the taking up does
    if (t > T0) assert.ok(said.every((w) => w.k !== 'sw' || w.l.at >= t), `a leg laid back in time at ${t - T0} ms`);
    words.push(...said);
  }
  const laid = words.filter((w) => w.k === 'sw' && w.l.at < T0);
  assert.equal(laid.length, 1, 'one round, from its last beat');
  assert.equal(laid[0].l.k, LEG.arc);
  assert.equal(laid[0].l.r, ORBIT_R);
  assert.ok(!words.some((w) => w.k === 'sw' && w.l.j), 'no leap');
  let maxStep = 0, prev = headAt(f.legs, t0);
  for (let t = t0; t <= T0 + 4000; t += 50) { const h = headAt(f.legs, t); maxStep = Math.max(maxStep, Math.hypot(h.x - prev.x, h.z - prev.z)); prev = h; }
  assert.ok(maxStep <= CRUISE_V * 0.05 + 0.01, `its head swims the whole way (${maxStep.toFixed(2)} m in 50 ms at most)`);
  const h = headAt(f.legs, T0 + 4000);
  assert.ok(Math.hypot(h.x - was.x, h.z - was.z) <= 2 * ORBIT_R + CRUISE_V * 4.5, 'about where its last beat left it');
});

test('AUDIT SERPENT S2: a phase crossed mid-attack lets the attack land as it was said - its ward at once, its turn after (mutant: the attack in flight dropped and the turn begun over it)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  const rng = seeded(3);
  const bodies = [body('s1', 120, 0)];
  let breach = null;
  for (let t = T0; t < T0 + 60_000 && !breach; t += SERPENT_TICK_MS) for (const w of stepSerpentBrain(f, t, bodies, rng)) if (w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.breach.id) breach = { ...w, t };
  assert.ok(breach, 'a breach begun');
  f.hp = f.max * (SERPENT_PHASE_AT[0] - 0.01);   // the turn crossed in its wind-up
  const out = stepSerpentBrain(f, breach.t + SERPENT_TICK_MS, bodies, rng);
  assert.ok(out.some((w) => w.k === 'ph' && w.n === 2), 'its ward');
  assert.equal(f.atk?.i, breach.i, 'the breach still in flight');
  assert.ok(!out.some((w) => w.k === 'atk'), 'nothing begun over it');
  const later = [];
  for (let t = breach.t + 2 * SERPENT_TICK_MS; t < breach.at + 8000; t += SERPENT_TICK_MS) later.push(...stepSerpentBrain(f, t, bodies, rng));
  assert.equal(later.find((w) => w.k === 'atk')?.a, SERPENT_ATTACK_TABLE.cry.id, 'the Call comes after it');
});

// ═══ THE COIL'S WORDS (S3, S4, M2, S10) ════════════════════════════════════════════════════════════════

function coilBegun(seed = 2) {
  const f = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  f.phase = 2; f.threat = { s1: 5, s2: 5 }; f.seq = 9;
  f.atk = { i: 9, a: SERPENT_ATTACK_TABLE.coil.id, at: T0 + 100, x: 50, z: 0, yw: 0, tg: [[0, 0]], until: T0 + 100 + SERPENT_ATTACK_TABLE.coil.recover, s: 's1' };
  return { f, rng: seeded(seed), bodies: [body('s1', 0, 0), body('s2', 150, 0)] };
}
test('AUDIT SERPENT S3/B1: the coiled ship\'s word said at the landing, before the beat that winds the coil, is heard as it winds - her escape lets it close on empty sea, her `held` brings it onto her hull (mutants: the word dropped; kept from anyone; kept from long before its landing)', () => {
  const { f, rng, bodies } = coilBegun();
  assert.deepEqual(stepSerpentBrain(f, T0, bodies, rng).filter((w) => w.k === 'coil'), [], 'not yet wound');
  assert.deepEqual(coilWord(f, 's1', 'esc', 9, 0, 0, T0 + 150), [], 'said between its landing and the beat');
  assert.deepEqual(coilWord(f, 's2', 'held', 9, 0, 0, T0 + 150), [], 'another\'s word is never kept');
  const wound = stepSerpentBrain(f, T0 + 250, bodies, rng);
  assert.deepEqual(wound.filter((w) => w.k === 'coil' || w.k === 'cx').map((w) => w.k), ['coil', 'cx'], 'wound, and let go at once');
  assert.ok(!coilHolds(f, T0 + 300));
  const g = coilBegun();
  stepSerpentBrain(g.f, T0, g.bodies, g.rng);
  coilWord(g.f, 's1', 'held', 9, 12, -8, T0 + 150);
  stepSerpentBrain(g.f, T0 + 250, g.bodies, g.rng);
  assert.deepEqual([g.f.coil.x, g.f.coil.z, g.f.coil.held], [12, -8, true], 'onto her hull');
  const early = coilBegun();
  coilWord(early.f, 's1', 'esc', 9, 0, 0, T0 + 100 - 5000);
  assert.equal(early.f.atk.word, undefined, 'a word long before its landing is not hers to say');
});

test('AUDIT SERPENT S4/M1/M2: the kill and the sounding let a holding coil go and SAY so, and say its throes and its dive - the client lets go of the ship it held (mutants: no `cx` at the fall; the throes kept on the relay; the client\'s fold holding on)', () => {
  const { f, rng, bodies } = coilBegun();
  stepSerpentBrain(f, T0, bodies, rng); stepSerpentBrain(f, T0 + 250, bodies, rng);
  coilWord(f, 's1', 'held', 9, 0, 0, T0 + 300);
  assert.ok(coilHolds(f, T0 + 400));
  let L = foldSerpent(SERPENT_STATE_EMPTY, serpentStateOf(f), T0 + 400);
  assert.ok(L.coil && !(L.coil.off > 0), 'the client holds it too');
  f.hp = 1; f.shieldUntil = 0;
  const out = applySerpentHit(f, 's2', 50, ZONES.body, { x: 150, z: 0 }, T0 + 500);
  const kinds = out.map((w) => w.k);
  assert.ok(kinds.includes('cx') && kinds.includes('dv') && kinds.includes('sw') && kinds.at(-1) === 'fell', `the words at the fall: ${kinds}`);
  // PIN MOVED (AUDIT SHIPS B5, 2026-10-06): its throes said SERPENT_SAY_AHEAD_MS on, what was to come let go at the kill
  assert.ok(out.some((w) => w.k === 'dv' && w.m === MODE.dying && w.at === T0 + 500 + SERPENT_SAY_AHEAD_MS), 'its throes said ahead');
  for (const w of out) L = foldSerpent(L, w, T0 + 500);
  assert.ok(L.coil.off > 0, 'let go');
  // the fell word alone (a hub's, a lost cx) lets go too
  const M = foldSerpent(foldSerpent(SERPENT_STATE_EMPTY, serpentStateOf(coilHeldFight()), T0), { k: 'fell', at: T0 + 9, top: [], n: 1 }, T0 + 9);
  assert.ok(M.coil.off > 0);
  // the sounding
  const g = coilHeldFight();
  const gone = stepSerpentBrain(g, SOUND + 10, [], seeded(1));
  // PIN MOVED (AUDIT SHIPS B5): the coil let go first and the gone last, its dive said SERPENT_SAY_AHEAD_MS on
  const ends = gone.filter((w) => ['cx', 'dv', 'sw', 'gone'].includes(w.k));
  assert.deepEqual([ends[0].k, ends.at(-1).k], ['cx', 'gone']);
  assert.ok(ends.some((w) => w.k === 'dv' && w.m === MODE.deep && w.at === SOUND + 10 + SERPENT_SAY_AHEAD_MS), 'its dive said ahead');
  assert.ok(ends.some((w) => w.k === 'sw' && w.l.at === SOUND + 10 + SERPENT_SAY_AHEAD_MS && w.l.v === DEEP_V), 'and its swim down');
});
function coilHeldFight() {
  const { f, rng, bodies } = coilBegun();
  stepSerpentBrain(f, T0, bodies, rng); stepSerpentBrain(f, T0 + 250, bodies, rng);
  coilWord(f, 's1', 'held', 9, 0, 0, T0 + 300);
  return f;
}

test('AUDIT SERPENT S10: a coil goes at a ship - with only hands aboard nobody\'s ship of their own at the fight, the turn\'s coil is not begun (mutant: a hand coiled)', () => {
  const f = surfaced(fightOf([-1, -1]));
  f.max = 1000; f.hp = 600; f.phase = 1;
  const rng = seeded(5);
  const words = [];
  for (let t = T0; t < T0 + 30_000; t += SERPENT_TICK_MS) words.push(...stepSerpentBrain(f, t, [body('s1', 100, 0), body('s2', -100, 0)], rng));
  assert.ok(words.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.cry.id), 'the Call');
  assert.ok(!words.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.coil.id), 'no coil on a hand');
  assert.equal(pickSerpentTarget(f, [body('s1', 100, 0)], seeded(1), true), null);
});

test('AUDIT SERPENT S6: an attack\'s word carries its bearing wrapped - a head on its ninth turn of an arc says a bearing the wire takes (mutant: the bearing unwrapped)', () => {
  const a = { i: 1, a: SERPENT_ATTACK_TABLE.roar.id, at: T0, x: 0, z: 0, yw: -8.795, tg: [[0, 0]] };
  const w = serpentAtkFrame(a);
  assert.ok(w.yw >= -Math.PI && w.yw < Math.PI, `${w.yw}`);
  assert.ok(validSerpentOut({ k: 'atk', ...w }), 'the wire takes it');
});

// ═══ BEING AT THE FIGHT (S8, E1, E2, T2, B7) ═══════════════════════════════════════════════════════════

test('AUDIT SERPENT S8/E2/T2: a share stays in its health only while its ship is AT the fight, afloat and firing - an `in` said from past ENGAGE_R keeps none, a wreck\'s goes and stays gone, a silent ship\'s goes and comes back with her next blow (mutants: the far `in` restoring; the wreck restored; the silent share kept; a blow not restoring it)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  const share = SERPENT_TTK_S * SHIP_REF[HULL.Carrack];
  const rng = seeded(7);
  const near = [body('s1', 100, 0), body('s2', -100, 0)];
  // s2 sails off past ENGAGE_R; its `in` from there keeps nothing
  let t = T0;
  for (; t < T0 + SERPENT_ABSENT_RETIRE_MS + 2000; t += 1000) { stepSerpentBrain(f, t, [near[0]], rng); applySerpentHit(f, 's1', 1, ZONES.body, near[0], t); joinSerpentFight(f, 's2', 'P2', 20, HULL.Carrack, t, true, null, false); }
  assert.equal(f.max, share, 'the far ship\'s share gone');
  joinSerpentFight(f, 's2', 'P2', 20, HULL.Carrack, t, true, null, true);
  assert.equal(f.max, 2 * share, 'back, sailing in');
  // a wreck
  assert.equal(serpentWreck(f, 's2', 1, t), true);
  assert.equal(f.max, share, 'a wreck\'s share out');
  stepSerpentBrain(f, t + 250, near, rng);
  joinSerpentFight(f, 's2', 'P2', 20, HULL.Carrack, t + 300, true);
  assert.equal(f.max, share, 'never back while she is one');
  assert.equal(pickSerpentTarget(f, [near[1]], seeded(1)), null, 'nor gone at');
  serpentWreck(f, 's2', 0, t + 500);
  assert.equal(f.max, 2 * share, 'afloat again');
  // silence
  const u = t + 1000;
  for (let x = u; x < u + SERPENT_IDLE_RETIRE_MS + 2000; x += 1000) { stepSerpentBrain(f, x, near, rng); applySerpentHit(f, 's1', 1, ZONES.body, near[0], x); }
  assert.ok(!serpentShareWanted(f.players.s2, u + SERPENT_IDLE_RETIRE_MS + 2000));
  assert.equal(f.max, share, 'a silent ship\'s share out');
  f.shieldUntil = 0;
  applySerpentHit(f, 's2', 1, ZONES.body, near[1], u + SERPENT_IDLE_RETIRE_MS + 3000);
  assert.equal(f.max, 2 * share, 'her next blow brings it back');
});

test('AUDIT SERPENT E1/E2: standing counts only within SERPENT_STAND_R of its body, the serpent goes only at what it can reach, and dealing means SERPENT_RECEIPT_SHARE of one\'s share (mutants: a boat parked at 900 m standing; a target past its reach; one volley a dealer)', () => {
  assert.ok(SERPENT_STAND_R < ENGAGE_R && SERPENT_TARGET_R < ENGAGE_R && SERPENT_RECEIPT_SHARE >= 0.1);
  const f = surfaced(fightOf([HULL.Carrack, -1, -1]));
  const rng = seeded(8);
  const bodies = [body('s1', 100, 0), body('s2', 120, 10), body('s3', 0, 880)];   // s3: a rowboat parked out at 880 m
  for (let t = T0; t < T0 + 60_000; t += SERPENT_TICK_MS) stepSerpentBrain(f, t, bodies, rng);
  assert.ok(f.players.s2.stoodMs > 50_000, 'the hand aboard at the fight stood');
  assert.equal(f.players.s3.stoodMs, 0, 'the parked boat stood nothing');
  assert.equal(pickSerpentTarget(f, [bodies[2]], seeded(1)), null, 'nor can it be gone at');
  f.fell = { at: T0 + 60_000, top: [], n: 3 };
  f.liveMs = 60_000;
  assert.equal(serpentEarned(f, 's3'), false);
  assert.equal(serpentEarned(f, 's2'), f.players.s2.stoodMs >= SERPENT_STOOD_SHARE * 60_000);
  f.players.s1.dealt = 0.05 * f.players.s1.share;
  f.players.s1.stoodMs = 0;   // dealing alone
  assert.equal(serpentEarned(f, 's1'), false, 'a volley is not a share');
  f.players.s1.dealt = SERPENT_RECEIPT_SHARE * f.players.s1.share;
  assert.equal(serpentEarnedBy(f, 's1'), 'dealt');
});

test('AUDIT SERPENT B7: the state says the ships afloat at the fight - not every account that ever joined, not hands, not wrecks (mutant: the accounts counted)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.SmallShip, -1, HULL.LargeBoat]));
  serpentWreck(f, 's4', 1, T0);
  stepSerpentBrain(f, T0 + 250, [body('s1', 100, 0), body('s2', -100, 0), body('s3', 100, 5), body('s4', 0, 100)], seeded(1));
  assert.equal(serpentStateOf(f).n, 2);
});

test('AUDIT SERPENT T3: a blow on a holding coil takes SERPENT_COIL_PASS of itself off the serpent\'s own health - and a kill through the coil is a kill (mutant: the coil\'s fire wasted)', () => {
  const f = coilHeldFight();
  const hp = f.hp;
  f.shieldUntil = 0;
  applySerpentHit(f, 's2', 40, ZONES.coil, { x: 150, z: 0 }, T0 + 1000);
  assert.ok(f.players.s2.cd > 0);
  assert.ok(Math.abs(hp - f.hp - f.players.s2.cd * SERPENT_COIL_PASS) < 1e-9);
  f.hp = 1;
  const out = applySerpentHit(f, 's2', 40, ZONES.coil, { x: 150, z: 0 }, T0 + 2000);
  assert.ok(f.fell && out.some((w) => w.k === 'fell'), 'slain through its coil');
  assert.ok(COIL_ESC_MS > 0);
});
