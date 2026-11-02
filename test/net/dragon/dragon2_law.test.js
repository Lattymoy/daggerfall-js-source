// DRAGON2 (bible/11-Multiplayer/Dwarven-Dragon.md sections 2-8): THE DRAGON'S LAW, BODY, BRAIN, JUDGE, RECEIPT AND WIRE.
// The clock decides its watches, its look and its site's roll; its body is a path every screen walks the same; its brain
// fights aloft and grounded, every blow held to its escape floor; the relay counts its plain blows; its receipt is never
// another's; its frame is projected field by field both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAGON_WATCH_MS, DRAGON_WATCH_ONE_IN, DRAGON_LAND_SPAN_MS, DRAGON_STAY_MS, dragonLandOf, dragonQuietAt, dragonAskEnd, DRAGON_CLIMB_MS, DRAGON_SHINY_ONE_IN, dragonWatchAt, isDragonOmen, dragonOmenOk,
  dragonShinyOf, dragonLookOf, dragonTimes, dragonSeedTold, dragonWatchesAbout, dragonAdmits, dragonHolds, dragonCellOf, dragonSitePick, DRAGON_CELLS, DRAGON_CELL_PX, dragonFightId, dragonSiteKey,
} from '../../../src/net/dragon/dragonLaw.js';
import { lineLeg, orbitLeg, dragonLegAt, planAt, planEnd, orbitFrom, fallLeg, roostLeg, ROOST_ALT, ROOST_R, FLY_V, EASE, DRAGON_BODY_R } from '../../../src/net/dragon/dragonBody.js';
import * as B from '../../../src/net/dragon/dragonBrain.js';
import { judgeDragon } from '../../../src/net/bossRef.js';
import { DRAGON_SEAM, BOSS_SEAM_KEYS } from '../../../src/net/bossSeam.js';
import { egWindupFloorMs, egInShape } from '../../../src/net/eliteGates/egShape.js';
import { HIT_KINDS, dpsRef, BUCKET_DEPTH_X, HIT_CAP_X } from '../../../src/net/gate/gateBrain.js';
import { BAY_ORIGIN, TAMRIEL_W, TAMRIEL_H } from '../../../src/world/tamriel/tamrielFrame.js';   // DRAGON-CELL: the frame the cells are drawn from
import {
  validDragonIn, validDragonOut, parseClient, DRAGON_KINDS, DRAGON_OUT_KINDS, DRAGON_NO_WORDS, DRAGON_LEGS_MAX,
  DRAGON_BLOWS_WIRE_MAX, DRAGON_BLOW_KINDS, DRAGON_CHART_MAX, DRAGON_RECEIPT_WIRE_MAX, relaySupportsDragon, DRAGON_RELAY_MIN, DRAGON_RIDE_RELAY_MIN, RELAY_VERSION,
} from '../../../src/net/wire.js';
import { DRAGON_RECEIPT_V, DRAGON_RECEIPT_TTL_S, DRAGON_RECEIPT_MAX, dragonReceiptValid, mintDragonReceipt, readDragonReceipt, verifyDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { mintSerpentReceipt, verifySerpentReceipt } from '../../../src/net/serpent/serpentReceipt.js';
import { mintReceipt, verifyReceipt } from '../../../src/net/gate/gateReceipt.js';

const seeded = (s = 7) => () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
/** DRAGON-HIDDEN: a watch's omen under the tests' seed (the relay's is HMAC of its secret - net/dragon/dragonSeed.js). */
const SEED = 0x5eed1234;
const om = (w, s = SEED) => ({ w, s });
const isDragonWatch = (w) => isDragonOmen(om(w));
const firstWatch = (from, pred = isDragonWatch) => { let w = from; while (!pred(w)) w++; return w; };
const W = firstWatch(500_000);

// ═══ THE CLOCK ═══════════════════════════════════════════════════════════════════════════════════

test('DRAGON2 law: one watch in three brings a dragon down, one dragon in twenty is the Aetherbright, its landing a second its seed rolls in the first twenty minutes of its watch and forty minutes on it climbs away (mutants: every watch a dragon; the shiny every dragon; the stay unbounded)', () => {
  assert.deepEqual([DRAGON_WATCH_MS, DRAGON_WATCH_ONE_IN, DRAGON_LAND_SPAN_MS, DRAGON_STAY_MS, DRAGON_CLIMB_MS, DRAGON_SHINY_ONE_IN], [3_600_000, 3, 1_200_000, 2_400_000, 15_000, 20]);
  let n = 0, shiny = 0;
  const N = 30_000;
  const seeds = seeded(11);
  for (let w = 400_000; w < 400_000 + N; w++) { const o = om(w, Math.floor(seeds() * 4294967296)); if (isDragonOmen(o)) { n++; if (dragonShinyOf(o)) shiny++; } }
  assert.ok(Math.abs(n / N - 1 / 3) < 0.02, `about a third (${n / N})`);
  assert.ok(Math.abs(shiny / n - 1 / 20) < 0.012, `about one in twenty (${shiny / n})`);
  assert.equal(isDragonOmen(om(-1)), false);
  assert.equal(isDragonOmen(om(1.5)), false);
  assert.equal(isDragonOmen({ w: W }), false, 'no seed, no dragon');
  assert.equal(dragonOmenOk(om(W, 2 ** 32)), false, 'a seed past 32 bits is none');
  const t = dragonTimes(om(W));
  assert.deepEqual(t, { w: W, landAt: W * DRAGON_WATCH_MS + dragonLandOf(om(W)), leaveAt: W * DRAGON_WATCH_MS + dragonLandOf(om(W)) + DRAGON_STAY_MS });
  // DRAGON-HIDDEN-TIME: its landing is the seed's, a whole second in the watch's first twenty minutes, spread over them
  const lands = new Set();
  for (let s = 1; s <= 400; s++) { const l = dragonLandOf(om(W, s * 0x9e3779b1 >>> 0)); assert.ok(l >= 0 && l < DRAGON_LAND_SPAN_MS && l % 1000 === 0); lands.add(Math.floor(l / 60_000)); }
  assert.equal(lands.size, 20, 'every minute of the span lands some dragon');
  assert.equal(dragonQuietAt(W), W * DRAGON_WATCH_MS + DRAGON_LAND_SPAN_MS);
  assert.ok(dragonAskEnd(W) >= t.leaveAt + DRAGON_CLIMB_MS);
  assert.equal(dragonWatchAt(t.landAt), W);
  assert.equal(dragonLookOf(om(W)), dragonShinyOf(om(W)) ? 1 : 0);
  // DRAGON-HIDDEN: a watch's seed is told only once its landing is past, and only for the watches about
  assert.equal(dragonSeedTold(om(W), W, t.landAt - 1), false, 'never before it lands');
  assert.equal(dragonSeedTold(om(W), W, t.landAt), true);
  assert.equal(dragonSeedTold(om(W + 1), W + 1, t.landAt), false, 'never a watch to come');
  const Q = firstWatch(W + 1, (w) => !isDragonWatch(w));
  assert.equal(dragonSeedTold(om(Q), Q, dragonQuietAt(Q) - 1), false, 'a quiet watch is told no sooner than the latest landing');
  assert.equal(dragonSeedTold(om(Q), Q, dragonQuietAt(Q)), true);
  assert.equal(dragonSeedTold(null, Q, dragonQuietAt(Q)), true, 'no secret: told quiet at the latest landing');
  assert.deepEqual(dragonWatchesAbout(t.landAt), [W, W - 1]);
  // a fight begins from its landing until it leaves; one already joined holds through the climb
  assert.equal(dragonAdmits(om(W), t.landAt - 1), false);
  assert.equal(dragonAdmits(om(W), t.landAt), true);
  assert.equal(dragonAdmits(om(W), t.leaveAt), false);
  assert.equal(dragonHolds(om(W), t.leaveAt), true);
  assert.equal(dragonHolds(om(W), t.leaveAt + DRAGON_CLIMB_MS), false);
  assert.equal(dragonAdmits(om(firstWatch(W + 1, (w) => !isDragonWatch(w))), t.landAt), false, 'a watch with no dragon admits none');
  // the same watch under another seed is another fate - nothing in the source rolls it
  const fates = new Set();
  for (let s = 1; s <= 64; s++) fates.add(isDragonOmen(om(W, s * 0x9e3779b1 >>> 0)));
  assert.deepEqual([...fates].sort(), [false, true]);
});

test('DRAGON2 law: its site is in the cell its omen rolls (DRAGON-CELL - PIN MOVED: the gate\'s site law on a lane, until the relay told the omen to the whole world) - any cell of the continent\'s frame at its authored fit, the Bay\'s and past it, its own roll and never the watch\'s number; a fight is named by its watch and its site to the whole unit (mutants: the cell\'s roll the watch\'s; the frame shrunk)', () => {
  const frame = { cx0: Math.floor(-BAY_ORIGIN.x / DRAGON_CELL_PX), cy0: Math.floor(-BAY_ORIGIN.y / DRAGON_CELL_PX) };
  assert.deepEqual(DRAGON_CELLS, { ...frame, cols: Math.ceil((TAMRIEL_W - BAY_ORIGIN.x) / DRAGON_CELL_PX) - frame.cx0, rows: Math.ceil((TAMRIEL_H - BAY_ORIGIN.y) / DRAGON_CELL_PX) - frame.cy0 });
  let bay = 0, past = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let w = 0; w < 20_000; w++) {
    const { cx, cy } = dragonCellOf(om(w));
    x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
    if (cx >= 0 && cy >= 0 && cx * DRAGON_CELL_PX < 1000 && cy * DRAGON_CELL_PX < 500) bay++; else past++;
  }
  assert.ok(x0 >= DRAGON_CELLS.cx0 && y0 >= DRAGON_CELLS.cy0 && x1 < DRAGON_CELLS.cx0 + DRAGON_CELLS.cols && y1 < DRAGON_CELLS.cy0 + DRAGON_CELLS.rows, 'inside the frame');
  assert.ok(x0 <= DRAGON_CELLS.cx0 + 2 && x1 >= DRAGON_CELLS.cx0 + DRAGON_CELLS.cols - 3 && y0 <= DRAGON_CELLS.cy0 + 2 && y1 >= DRAGON_CELLS.cy0 + DRAGON_CELLS.rows - 3, 'and over the whole of it');
  assert.ok(bay > 0 && past > bay * 10, `the Bay\'s cells and the world\'s (${bay}, ${past})`);
  assert.notDeepEqual(dragonCellOf(om(W, 1)), dragonCellOf(om(W, 2)), 'the cell is the seed\'s, never the watch\'s number');
  assert.notEqual(dragonSitePick(om(W, 1)), dragonSitePick(om(W, 2)), 'and its ground\'s pick');
  assert.equal(dragonSiteKey(1234.4, -5.6), '1234,-6');
  assert.equal(dragonFightId(W, 1234.4, -5.6), `${W}@1234,-6`);
});

// ═══ THE BODY ════════════════════════════════════════════════════════════════════════════════════

test('DRAGON2 body: a path, not a physics - a line eased at both ends or falling, an orbit at FLY_V with its height eased; a plan is its latest begun leg; an orbit taken up from a point flies on from it; a fall lands under it (mutants: the orbit\'s pace; the fall eased smooth; the latest leg skipped)', () => {
  const l = lineLeg(1000, 2000, [0, 0, 10], [20, 0, 30], 0);
  assert.deepEqual([dragonLegAt(l, 0).x, dragonLegAt(l, 1000).x, dragonLegAt(l, 3000).x, dragonLegAt(l, 9000).a], [0, 0, 20, 30]);
  assert.equal(dragonLegAt(l, 2000).x, 10, 'half way at half time');
  assert.ok(Math.abs(dragonLegAt(l, 2000).yw - Math.PI / 2) < 1e-9, 'facing its way (east)');
  const f = lineLeg(0, 1000, [5, 5, 40], [5, 5, 0], 1, EASE.fall);
  assert.equal(dragonLegAt(f, 500).a, 30, 'a fall from rest: a quarter of the way at half its time');
  const o = orbitLeg(0, 0, 0, 50, 0, 1, 30, 60, 4000);
  const q = dragonLegAt(o, 1000);
  assert.ok(Math.abs(Math.hypot(q.x, q.z) - 50) < 1e-6, 'on its circle');
  assert.ok(Math.abs(Math.atan2(q.x, q.z) - FLY_V / 50) < 1e-6, 'turned FLY_V / r a second');
  assert.equal(dragonLegAt(o, 4000).a, 60);
  assert.equal(dragonLegAt(o, 2000).a, 45);
  const plan = [lineLeg(0, 1000, [0, 0, 0], [10, 0, 0], 0), lineLeg(1000, 1000, [10, 0, 0], [10, 10, 0], 0), orbitLeg(2000, 10, 0, 10, 0, -1, 30)];
  assert.equal(planAt(plan, 1500).x, 10);
  assert.ok(planAt(plan, 1500).z > 0);
  assert.equal(planEnd(plan.slice(0, 2)), 2000);
  assert.equal(planEnd(plan), Infinity);
  const p = { x: 30, z: 40, a: 25, yw: 0 }, of = orbitFrom(p, 0, 20, 1);
  assert.ok(Math.hypot(dragonLegAt(of, 0).x - 30, dragonLegAt(of, 0).z - 40) < 0.05, 'it flies on from where it stood');
  assert.ok(Math.hypot(of.cx, of.cz) < Math.hypot(30, 40), 'about a centre toward its site');
  const fl = fallLeg({ x: 3, z: 4, a: 45, yw: 0 }, 100);
  assert.deepEqual([dragonLegAt(fl, 1e6).x, dragonLegAt(fl, 1e6).z, dragonLegAt(fl, 1e6).a], [3, 4, 0]);
  assert.ok(fl.ms >= 3000 && fl.ms <= 3100, 'forty-five metres under gravity, about three seconds');
  const r = roostLeg(om(W));
  assert.deepEqual([r.k, r.at, r.r, r.a], [1, dragonTimes(om(W)).landAt, ROOST_R, ROOST_ALT]);
});

// ═══ THE BRAIN ═══════════════════════════════════════════════════════════════════════════════════

const T = dragonTimes(om(W));
const birth = (now = T.landAt + 60_000) => DRAGON_SEAM.new({ w: W, b: 0, sx: 0, sz: 0, now, leaveAt: T.leaveAt, roost: roostLeg(om(W)) });
const BODIES = [{ sub: 'a', x: 10, z: 0 }, { sub: 'b', x: -15, z: 20 }, { sub: 'c', x: 5, z: -25 }];
function fightOf(n = 3, lv = 20) {
  const now = T.landAt + 60_000, f = birth(now);
  for (const b of BODIES.slice(0, n)) B.joinDragonFight(f, b.sub, b.sub.toUpperCase(), lv, now, true);
  return { f, now };
}

test('DRAGON2 brain: the seam keeps every member; a fighter brings DRAGON_TTK_S of its reference, a late one at the fraction it stands at with an empty bucket; a full fight frees a seat of one with no part and not about (mutants: the share the gate\'s; the late bucket full; a seat freed from one with a part)', () => {
  for (const k of BOSS_SEAM_KEYS) assert.equal(typeof DRAGON_SEAM[k], 'function');
  assert.equal(B.DRAGON_TTK_S, 720);   // PIN MOVED: DRAGON-HARDER, 200 before
  const { f, now } = fightOf(2);
  assert.equal(f.max, 2 * B.DRAGON_TTK_S * dpsRef(20));   // PIN MOVED: DRAGON-HARDER, by its own constant
  assert.equal(f.players.a.bucket, BUCKET_DEPTH_X * dpsRef(20));
  f.hp = f.max / 2;
  assert.equal(B.joinDragonFight(f, 'late', 'L', 30, now, true), true);
  assert.equal(f.hp, f.max / 2, 'at the fraction it stands at');
  assert.equal(f.players.late.bucket, 0);
  assert.equal(B.joinDragonFight(f, 'new', 'N', 1, now, false), false, 'not while it admits none');
  const g = birth();
  for (let i = 0; i < B.DRAGON_FIGHTERS_MAX; i++) B.joinDragonFight(g, `s${i}`, 'x', 5, T.landAt, true);
  g.players.s0.dealt = 1e6;
  assert.equal(B.joinDragonFight(g, 'more', 'M', 5, T.landAt, true, new Set()), true);
  assert.ok(g.players.s0 && !g.players.s1, 'the first without a part made room');
  assert.equal(B.joinDragonFight(g, 'more2', 'M', 5, T.landAt, true, null), false, 'no census, no seat freed');
});

test('DRAGON2 brain: A DRAGON_BLOW - a swing only while it stands GROUNDED within reach, a shaft or a spell within DRAGON_SHOT_R; on the ground every blow GROUNDED_X heavier; its ward, the blow rate, the one-blow cap and the bucket hold (mutants: a swing aloft; the grounded weight gone; the shot reach unbounded; the ward ignored)', () => {
  const { f, now } = fightOf(1);
  const at = B.dragonPlaceAt(f, now);
  const near = { x: at.x + DRAGON_BODY_R + 1, z: at.z };
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Melee, near, now), 0, 'aloft, no swing reaches it');
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Shaft, near, now), 10);
  const later = B.dragonPlaceAt(f, now + 1000);
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Spell, { x: later.x + DRAGON_BODY_R + B.DRAGON_SHOT_R + 1, z: later.z }, now + 1000), 0, 'past a shot\'s reach, from where it flies then');
  assert.equal(B.applyDragonHit(f, 'zz', 10, HIT_KINDS.Shaft, near, now + 1000), 0, 'a stranger');
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Shaft, null, now + 1000), 0, 'no pose');
  f.md = B.DRAGON_MODE.ground;
  f.legs = [lineLeg(now, 0, [0, 0, 0], [0, 0, 0], 0)];
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Melee, { x: DRAGON_BODY_R + 2, z: 0 }, now + 2000), 10 * B.GROUNDED_X);
  assert.equal(B.applyDragonHit(f, 'a', 10, HIT_KINDS.Melee, { x: DRAGON_BODY_R + 9, z: 0 }, now + 3000), 0, 'out of a swing\'s reach');
  const cap = HIT_CAP_X * dpsRef(20);
  assert.equal(B.applyDragonHit(f, 'a', 1e6 / 2, HIT_KINDS.Melee, { x: 5, z: 0 }, now + 4000), cap, 'the one-blow cap');
  let n = 0;
  for (let i = 0; i < 10; i++) if (B.applyDragonHit(f, 'a', 1, HIT_KINDS.Shaft, { x: 5, z: 0 }, now + 5000) > 0) n++;
  assert.equal(n, B.DRAGON_HIT_HZ_MAX, 'the blow rate');
  f.shieldUntil = now + 99_000;
  assert.equal(B.applyDragonHit(f, 'a', 5, HIT_KINDS.Shaft, { x: 5, z: 0 }, now + 9000), 0, 'its ward');
});

/** A whole fight stepped: three fighters standing about it, each landing `d` a second (a swing grounded, a shaft aloft). */
function runFight({ n = 3, d = 25, ms = 20 * 60_000 } = {}) {
  const { f, now: t0 } = fightOf(n);
  const rng = seeded(11), words = [];
  let now = t0, prevMd = f.md;
  const modes = [];
  for (let k = 0; k * 250 < ms && !f.fell && !f.gone; k++) {
    now += 250;
    words.push(...B.stepDragonBrain(f, now, BODIES.slice(0, n), rng).map((w) => ({ ...w, now })));
    if (f.md !== prevMd) { modes.push([prevMd, f.md, now]); prevMd = f.md; }
    if (k % 4 === 0) for (const b of BODIES.slice(0, n)) B.applyDragonHit(f, b.sub, d, f.md === B.DRAGON_MODE.ground ? HIT_KINDS.Melee : HIT_KINDS.Shaft, b, now);
  }
  return { f, words, modes, now };
}

test('DRAGON2 brain: THE FIGHT - every blow\'s wind-up held to its shape\'s escape floor, none thrown thrice running, every one of its nine in the fight; its phases at two thirds and a third with their ward; on the ground GROUNDED_MS, then a Takeoff Gust; at nought it falls (mutants: a wind-up under its floor; the repeat bound gone; a phase\'s ward skipped; the ground kept for good)', () => {
  const { f, words, modes } = runFight();
  const blows = words.filter((w) => w.k === 'atk');
  const seen = new Set(blows.map((b) => b.a));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8], 'every blow it has, thrown');
  for (const b of blows) for (const s of b.s) assert.ok(b.wu >= egWindupFloorMs(s), `${B.DRAGON_BLOWS[b.a].key}'s wind-up ${b.wu} under its floor`);
  for (let i = 2; i < blows.length; i++) assert.ok(!(blows[i].a === blows[i - 1].a && blows[i].a === blows[i - 2].a), 'never thrice running');
  const phases = words.filter((w) => w.k === 'ph');
  assert.deepEqual(phases.map((w) => w.n), [2, 3]);
  for (const p of phases) assert.equal(p.until, p.now + B.DRAGON_SHIELD_MS);
  assert.ok(modes.length >= 4, 'it came down and rose again');
  const downs = words.filter((w) => w.k === 'md' && w.m === B.DRAGON_MODE.ground);
  const ups = words.filter((w) => w.k === 'md' && w.m === B.DRAGON_MODE.air);
  for (const d of downs) {
    const up = ups.find((u) => u.now > d.now);
    if (up) assert.ok(up.now >= d.until - 300 || phases.some((p) => p.now > d.now && p.now < up.now), 'it rose when its time on the ground was spent (or a phase lifted it)');
  }
  assert.ok(f.fell, 'it fell');
  assert.equal(B.dragonPlaceAt(f, f.fell.at + 60_000).a, 0, 'and lies on the ground');
  assert.deepEqual(Object.keys(f.players).map((s) => B.dragonEarned(f, s) && B.dragonEarnedBy(f, s)), ['dealt', 'dealt', 'dealt']);
});

test('DRAGON2 brain: its shapes - a Crash Landing a disc where it lands, a Strafing Run a lane through its target, a Claw Rake before it, a Tail Sweep behind it, an Overpressure a ring safe beneath; plain blows are the relay\'s to count, shock and fire the struck screen\'s (mutants: a strafe lane wide of its target; the tail before it; the vent with no safe heart)', () => {
  const { words } = runFight();
  const shape = (key) => words.find((w) => w.k === 'atk' && B.DRAGON_BLOWS[w.a].key === key)?.s ?? null;
  assert.equal(shape('crash')[0][0], 'd'); assert.equal(shape('crash')[0][3], B.CRASH_R);
  assert.equal(shape('strafe')[0][0], 'l'); assert.equal(shape('strafe')[0][5], B.STRAFE_W);
  assert.ok(BODIES.some((b) => egInShape(shape('strafe')[0], b.x, b.z)), 'its lane runs through a fighter');
  assert.equal(shape('claw')[0][0], 'c'); assert.equal(shape('tail')[0][0], 'c');
  assert.equal(shape('vent')[0][0], 'r'); assert.equal(shape('vent')[0][3], B.VENT_SAFE_R);
  assert.equal(shape('rain').length, B.RAIN_DISCS);
  assert.deepEqual(B.DRAGON_BLOWS.filter((b) => b.el == null).map((b) => b.key), ['crash', 'claw', 'tail', 'gust', 'rain']);
});

test('DRAGON2 brain: it leaves at its time - climbing away unslain, its blows gone; a woken fight carries its numbers past its checkpoint; one no beat stepped is taken up circling where it was (mutants: the leaving never said; the wake not carried; the sleep resumed mid-blow)', () => {
  const { f, now } = fightOf(1);
  B.stepDragonBrain(f, now + 250, BODIES.slice(0, 1), seeded());
  const out = B.stepDragonBrain(f, T.leaveAt, BODIES.slice(0, 1), seeded());
  assert.deepEqual(out.map((w) => w.k), ['mv', 'gone']);
  assert.equal(f.gone.at, T.leaveAt);
  assert.ok(B.dragonPlaceAt(f, T.leaveAt + 15_000).a > 300, 'out of sight');
  assert.deepEqual(B.stepDragonBrain(f, T.leaveAt + 250, BODIES, seeded()), [], 'a fight over says nothing');
  const g = fightOf(1).f;
  g.seq = 7;
  assert.equal(B.dragonWoke(g).seq, 7 + B.DRAGON_WAKE_SEQ);
  g.blows = [{ i: 1, at: g.beatAt + 9e6 }];
  assert.deepEqual(B.dragonResume(g, g.beatAt + 1000), [], 'a fight stepped lately is left as it is');
  const said = B.dragonResume(g, g.beatAt + B.DRAGON_SLEEP_MS);
  assert.deepEqual(said.map((w) => w.k), ['mv']);
  assert.deepEqual(g.blows, []);
});

test('DRAGON2 judge: a plain blow counted at its landing on a body deep in its shape before and after - never a shock\'s or a fire\'s, never one stepping out (mutants: the element counted; the landing judged early)', () => {
  const { f, now } = fightOf(2);
  f.blows = [{ i: 1, a: 3, at: now, p: 0.35, el: null, s: [['d', 0, 0, 9]] }, { i: 2, a: 1, at: now, p: 0.22, el: 'shock', s: [['d', 0, 0, 9]] }];
  const bodies = [{ sub: 'a', x: 1, z: 1, dead: false }, { sub: 'b', x: 8.5, z: 0, dead: false }];
  assert.deepEqual(judgeDragon(f, bodies, now + 100), [], 'not before its landing\'s slack');
  assert.deepEqual(judgeDragon(f, bodies, now + 500), [{ sub: 'a', share: 0.35 }], 'the one deep in it, the plain blow alone');
  assert.deepEqual(judgeDragon(f, bodies, now + 900), [], 'each blow once');
});

// ═══ THE RECEIPT ═════════════════════════════════════════════════════════════════════════════════

test('DRAGON2 receipt: z1, minted by the relay and verified by its public half - its watch, look, account, seed, how earned, level, a week; never a serpent\'s or a gate\'s, whichever verifier is asked; unsigned read, never honoured (mutants: the version read after the signature; the shapes overlapping)', async () => {
  const subtle = globalThis.crypto.subtle, kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']), nowS = 1_800_000_000;
  const what = { q: W, b: 1, s: 'acct-0001', c: 4242, x: 'dealt', l: 22 };
  const r = await mintDragonReceipt(what, kp.privateKey, { subtle, nowS });
  assert.ok(r.startsWith(`${DRAGON_RECEIPT_V}.`) && r.length <= DRAGON_RECEIPT_MAX);
  assert.equal(DRAGON_RECEIPT_MAX, DRAGON_RECEIPT_WIRE_MAX);
  const ok = await verifyDragonReceipt(r, kp.publicKey, { subtle, nowS: nowS + 10 });
  assert.deepEqual(ok, { ok: true, claims: { ...what, i: nowS, e: nowS + DRAGON_RECEIPT_TTL_S } });
  assert.equal((await verifyDragonReceipt(r, kp.publicKey, { subtle, nowS: nowS + DRAGON_RECEIPT_TTL_S })).why, 'expired');
  const serp = await mintSerpentReceipt({ d: 3, b: 'sethrakul', s: 'acct-0001', c: 1, x: 'dealt', h: 4, l: 2 }, kp.privateKey, { subtle, nowS });
  const gate = await mintReceipt({ d: 363, b: 'ruhn', s: 'acct-0001', c: 1, x: 'dealt' }, kp.privateKey, { subtle, nowS });
  assert.equal((await verifyDragonReceipt(serp, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifyDragonReceipt(gate, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifySerpentReceipt(r, kp.publicKey, { subtle, nowS })).why, 'version');
  assert.equal((await verifyReceipt(r, kp.publicKey, { subtle, nowS })).why, 'version');
  for (const k of ['d', 'h', 'w', 'y', 'n', 'k', 't', 'o', 'r']) assert.equal(dragonReceiptValid({ ...ok.claims, [k]: 1 }), false, `another shape's ${k}`);
  assert.equal(dragonReceiptValid({ ...ok.claims, b: 2 }), false, 'no third look');
  assert.equal(dragonReceiptValid({ ...ok.claims, x: 'rite' }), false);
  const un = await mintDragonReceipt(what, null, { subtle, nowS });
  assert.equal(readDragonReceipt(un).signed, false);
  assert.equal((await verifyDragonReceipt(un, kp.publicKey, { subtle, nowS })).why, 'unsigned');
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════

test('DRAGON2 wire: the client says two things, `in` and `hit`, projected field by field after a hello; the cell\'s every word projected for the client - the brain\'s own state passes whole, its bounds pinned equal to the brain\'s; a refusal a closed list (mutants: a field carried; a leg unbounded; a word invented)', () => {
  assert.deepEqual(DRAGON_KINDS, ['in', 'hit', 'ask']);   // PIN MOVED: DRAGON-HIDDEN, the `ask` for a watch's omen
  assert.deepEqual(validDragonIn({ k: 'ask', w: W, s: 5 }), { k: 'ask', w: W }, 'an ask names a watch alone - never a seed');
  assert.equal(validDragonIn({ k: 'ask', w: -1 }), null);
  assert.deepEqual(validDragonIn({ k: 'in', w: W, bv: 1, lv: 20, sx: 1, sz: 2, junk: 9 }), { k: 'in', w: W, bv: 1, lv: 20, sx: 1, sz: 2 });
  assert.deepEqual(validDragonIn({ k: 'hit', d: 30, r: 2, z: 9 }), { k: 'hit', d: 30, r: 2 });
  assert.equal(validDragonIn({ k: 'hit', d: 30, r: 3 }), null);
  assert.equal(validDragonIn({ k: 'hit', d: 1e9, r: 0 }), null);
  assert.equal(validDragonIn({ k: 'gone' }), null, 'the client never says the cell\'s words');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'dragon', k: 'hit', d: 9, r: 1 }), { hasHello: true }), { t: 'dragon', k: 'hit', d: 9, r: 1 });
  assert.ok('error' in parseClient(JSON.stringify({ t: 'dragon', k: 'hit', d: 9, r: 1 }), { hasHello: false }));
  assert.equal(relaySupportsDragon(RELAY_VERSION), true);
  assert.equal(relaySupportsDragon(`world${DRAGON_RELAY_MIN - 1}`), false);
  assert.deepEqual([DRAGON_RELAY_MIN, DRAGON_RIDE_RELAY_MIN], [299, 288], 'PIN MOVED (DRAGON-CELL, world299, world298 on its branch until LITANY-STAND took it: the relay that tells an omen near its cell alone; DRAGON-HIDDEN, world294 past WYRM-RIDER and PVP-VITALS): the fight past the ride - the first relay that answers `ask` (290, 291 then 292 on its branch, renumbered past PVP-LINGER, GILDED-GLOW and DELVE II)');
  assert.equal(relaySupportsDragon('world289'), false, 'HAND-WRAPS\' relay closes the socket on `ask`');
  assert.equal(relaySupportsDragon('world290'), false, 'and PVP-LINGER\'s');
  assert.equal(relaySupportsDragon('world291'), false, 'and GILDED-GLOW\'s');
  assert.equal(relaySupportsDragon('world292'), false, 'and DELVE II\'s');
  assert.equal(relaySupportsDragon('world293'), false, 'and PVP-VITALS\'');
  assert.deepEqual([DRAGON_BLOWS_WIRE_MAX, DRAGON_BLOW_KINDS], [B.DRAGON_BLOWS_KEPT, B.DRAGON_BLOWS.length]);
  const { f, words } = runFight({ ms: 4 * 60_000 });
  const site = { w: W, sx: 1e6, sz: 2e6 };
  for (const w of [B.dragonStateOf(f), ...words.map(({ now: _now, ...w }) => w)]) {
    if (w.k === 'st' && w.blows.length > DRAGON_BLOWS_WIRE_MAX) continue;
    const { k, ...rest } = w;
    const back = validDragonOut({ k, ...rest, ...site });
    assert.ok(back, `the brain's ${k} passes`);
  }
  const st = { ...B.dragonStateOf(f), ...site };
  assert.equal(validDragonOut({ ...st, legs: Array(DRAGON_LEGS_MAX + 1).fill(st.legs[0]) }), null);
  assert.equal(validDragonOut({ ...st, h: st.m + 1 }), null);
  assert.equal(validDragonOut({ ...st, sx: undefined }), null, 'a fight word names its site');
  assert.deepEqual(validDragonOut({ k: 'no', m: DRAGON_NO_WORDS[0] }), { k: 'no', m: DRAGON_NO_WORDS[0] });
  assert.equal(validDragonOut({ k: 'no', m: 'go away' }), null);
  assert.equal(validDragonOut({ k: 'dance', ...site }), null);
  assert.ok(DRAGON_OUT_KINDS.includes('bd'));
  assert.deepEqual(validDragonOut({ k: 'omen', w: W, s: 7, x: 1 }), { k: 'omen', w: W, s: 7 }, 'DRAGON-HIDDEN: a watch\'s seed, of no site');
  assert.deepEqual(validDragonOut({ k: 'omen', w: W, s: null }), { k: 'omen', w: W, s: null }, 'none at this relay');
  assert.equal(validDragonOut({ k: 'omen', w: W, s: 2 ** 32 }), null);
});
