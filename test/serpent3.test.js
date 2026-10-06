// SERPENT3 (2026-10-05, Mac: "the serpent world boss teleports. Nobody has beat it yet."; Mac's call: "Two or more ships") -
// THE SERPENT NEVER LEAPS (bible/11-Multiplayer/Sea-Serpent.md section 15). The relay's own brain over whole fights: its
// head swims every metre it shows (a Rising Maw and a coil dashed for under the sea, closed on at the surface first, the
// Maelstrom formed where it swims, a slept fight taken up where it was); every attack's swim said as it begins, so a client
// a wire's time behind draws the relay's body without a snap; a blow judged where the body lay when it struck; a pair's
// share of its blows; the brain's law version; the relay's taking up of a slept fight before a word is judged; and the
// client's whirl telegraph and dash wake. Each pin failed on the build before it. tools/mutants/serpent3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  newSerpentFight, joinSerpentFight, stepSerpentBrain, applySerpentHit, serpentStateOf, serpentResume, closeAim, wayOnto, wayLen, dashFits,
  SERPENT_ATTACK_TABLE, SERPENT_ATTACK_BY_ID, SERPENT_PHASE_AT, SERPENT_TICK_MS, ZONES, ARENA_R, TURN_R, HUNT_TURN_R, MAEL_ORBIT_R, CRUISE_V,
  DRIFT_V, RAM_V, DASH_V, CLOSE_V, SERPENT_CLOSE_MS, SERPENT_SLEEP_MS, SERPENT_DRAWN_MS, SERPENT_SAY_AHEAD_MS, CRUSH, GRIP, MAEL_GRIND, SERPENT_HIT_LOOKBACK_MS, serpentWrapYaw,
} from '../src/net/serpentBrain.js';
import { LEG, MODE, COIL_R, headAt, bodyAt, modeAt, anyExposed, legIndexAt, sameLeg } from '../src/net/serpentBody.js';
import { createSerpentLink } from '../src/net/serpentLink.js';
import { createSerpentHost } from '../src/scenes/serpentHost.js';
import { fleetShare, shipHurt, crushHurt, gripHurt, grindHurt, SERPENT_PAIR_SHARE } from '../src/systems/serpentStrike.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_BRAIN_MIN, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import { validSerpentOut, cellRoomOfWire, serpentFightId, PIXEL_UNITS } from '../src/net/wire.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { fakeRooms } from './fakeRoom.mjs';

const T0 = 10_000_000;
const SOUND = T0 + 25 * 60_000;
/** A seeded [0,1) source (mulberry32). */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const body = (sub, x, z) => ({ sub, x, z, dead: false });
/** A fight joined by `hls`' ships as s1, s2 ... (or `id`'s accounts - the wire's own shape, for a pin that folds words). */
function fightOf(hls = [HULL.Carrack], id = (i) => `s${i + 1}`) {
  const f = newSerpentFight(363, T0, SOUND, 'sethrakul', 0, 0, 0.4);
  hls.forEach((hl, i) => assert.ok(joinSerpentFight(f, id(i), `P${i + 1}`, 20, hl, T0, true)));
  return f;
}
const acct = (i) => `acct-000${i + 1}`;
/** Up and swimming: its opening over, a round west of its heart. */
function surfaced(f, t = T0) {
  f.legs = [{ k: LEG.arc, at: t - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: t - 30_000, m: MODE.cruise }];
  f.openUntil = t; f.nextAt = t; f.lastTickAt = t;
  return f;
}
/** Steps `f` from `from` until `until` (ms) or `stop` answers true, each beat's words kept with their beat. */
function run(f, from, until, bodies, rng, stop = () => false) {
  const beats = [];
  for (let t = from; t <= until; t += SERPENT_TICK_MS) {
    const said = stepSerpentBrain(f, t, typeof bodies === 'function' ? bodies(t) : bodies, rng);
    beats.push({ t, said });
    if (stop(said, t)) break;
  }
  return beats;
}
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);

// ═══ IT NEVER LEAPS ════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT3 it never leaps: through whole fights - ships circling its waters and out past them, blows on it, its phases turned, a room that slept three minutes - its head never moves faster than its dash between two 50 ms looks, and no leg after its rising is a leap (`j`); its jumps moved the whole body a median 195-384 m in a frame, 2.3 a minute (mutants: any leap back)', () => {
  let maxStep = 0, leaps = 0, beats = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const rng = seeded(seed), dice = seeded(seed + 100);
    const f = fightOf([HULL.Carrack, HULL.SmallShip, HULL.LargeGalley, HULL.LargeBoat]);
    const orbit = [300, 650, 1050, 480].map((r, i) => ({ r, a: dice() * 6.28, w: (0.02 + dice() * 0.05) * (i % 2 ? -1 : 1) }));
    let now = T0, prev = headAt(f.legs, now);
    for (let n = 0; n < 2400 && !f.fell; n++) {
      const was = now;
      if (n === 1200) now += 3 * 60_000;   // a room asleep
      now += SERPENT_TICK_MS;
      const bodies = orbit.map((o, i) => body(`s${i + 1}`, Math.sin(o.a + o.w * n * 0.25) * o.r, Math.cos(o.a + o.w * n * 0.25) * o.r));
      const said = stepSerpentBrain(f, now, bodies, rng);
      leaps += said.filter((w) => w.k === 'sw' && w.l.j).length;
      if (n % 4 === 0) applySerpentHit(f, 's1', 4 + dice() * 6, ZONES.body, bodies[0], now);
      if (n === 600) f.hp = f.max * (SERPENT_PHASE_AT[0] - 0.01);
      if (n === 1800) f.hp = Math.min(f.hp, f.max * (SERPENT_PHASE_AT[1] - 0.01));
      for (let t = was + 50; t <= now; t += 50) { const h = headAt(f.legs, t); maxStep = Math.max(maxStep, Math.hypot(h.x - prev.x, h.z - prev.z)); prev = h; }
      beats++;
    }
  }
  assert.ok(beats > 12_000, `fights long enough to turn (${beats} beats)`);
  assert.equal(leaps, 0, 'no leap said');
  assert.ok(maxStep <= DASH_V * 0.05 + 0.05, `its head swims every metre (${maxStep.toFixed(2)} m in 50 ms at most)`);
});

test('SERPENT3 every screen draws the relay\'s body as it swims: a client folding the words a wire\'s time late (150 ms, within SERPENT_SAY_AHEAD_MS) never sees its head snap - every attack\'s swim was said as it began, a dash SERPENT_SAY_AHEAD_MS before the head takes it; its jumps snapped a lagging client\'s head 178-583 m and the ram\'s run, said a beat late, 8.7 m (mutants: a dash taken at the beat, the ram\'s run said late)', () => {
  const lag = 150;
  let worst = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const rng = seeded(seed);
    const f = surfaced(fightOf([HULL.Carrack, HULL.SmallShip, HULL.Carrack], acct));
    const link = createSerpentLink({ now: () => clock, site: () => ({ day: f.day, sx: 0, sz: 0 }) });
    let clock = T0;
    const hear = (w) => { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
    hear(serpentStateOf(f));
    const inbox = [];
    const ships = [0, 1, 2].map((i) => ({ a: i * 2.1, r: 160 + 70 * i }));
    let prev = null;
    for (let t = T0; t < T0 + 8 * 60_000 && !f.fell; t += 50) {
      clock = t;
      if ((t - T0) % SERPENT_TICK_MS === 0) {
        const bodies = ships.map((s, i) => { s.a += 0.004 * (i % 2 ? -1 : 1); return body(acct(i), Math.sin(s.a) * s.r, Math.cos(s.a) * s.r); });
        for (const w of stepSerpentBrain(f, t, bodies, rng)) inbox.push({ due: t + lag, w });
        if ((t - T0) % 500 === 0) for (const w of applySerpentHit(f, acct(0), 6, ZONES.body, bodies[0], t)) inbox.push({ due: t + lag, w });
      }
      while (inbox.length && inbox[0].due <= t) hear(inbox.shift().w);
      const h = headAt(link.state().legs, t);
      // PIN MOVED (AUDIT SHIPS D2, 2026-10-06): its step against the relay's own head's that frame - the old bound, 2.5 m a
      // frame, passed a closing surge's change of pace said at the beat (1.4 m over the relay's own step at 150 ms)
      const r0 = headAt(f.legs, t - 50), r1 = headAt(f.legs, t);
      if (prev) worst = Math.max(worst, Math.hypot(h.x - prev.x, h.z - prev.z) - Math.hypot(r1.x - r0.x, r1.z - r0.z));
      prev = h;
    }
  }
  // AUDIT SHIPS D2: every turn of its own said ahead, its turns' own few centimetres are all a lagging screen sees
  assert.ok(worst <= 0.05, `the head a client draws never snaps (${worst.toFixed(3)} m over the relay's own step in a 50 ms frame at most)`);
});

// ═══ THE DASHES, SAID AS THEY BEGIN ════════════════════════════════════════════════════════════════════════════════

/** A breach begun on a ship lying still at (120, 0) - closed on, then dashed for: its beat, its word, the beats after. */
function breachOn(x = 120, z = 0) {
  const f = surfaced(fightOf([HULL.Carrack]));
  const rng = seeded(3);
  f.closing = { a: SERPENT_ATTACK_TABLE.breach.id, s: 's1', at: T0 };
  const beats = run(f, T0, T0 + 20_000, [body('s1', x, z)], rng, (said) => said.some((w) => w.k === 'atk'));
  const at = beats.at(-1);
  const atk = at.said.find((w) => w.k === 'atk');
  return { f, rng, beats, begun: at.t, atk };
}

test('SERPENT3 the Rising Maw: closed on at the surface - no word of it while its dash is longer than its wind-up swims, surging at CLOSE_V on HUNT_TURN_R, its body up - and begun the beat it fits: its wind-up its own, never stretched; its whole dash said in that beat, a turn and a straight at DASH_V at most begun SERPENT_SAY_AHEAD_MS on, its burst where its word says and that the ship\'s place; its sounding and its burst said with it (mutants: the dash begun at the beat; the burst said at its beat; the closing\'s pace; the dash beyond DASH_V)', () => {
  const { f, beats, begun, atk } = breachOn();
  const A = SERPENT_ATTACK_TABLE.breach;
  assert.ok(atk && atk.a === A.id, 'a Rising Maw begun');
  assert.ok(begun - T0 < SERPENT_CLOSE_MS, `within the closing (${begun - T0} ms)`);
  for (const b of beats.slice(0, -1)) {
    assert.ok(!b.said.some((w) => w.k === 'atk'), 'no word of it while closing');
    for (const w of b.said.filter((x) => x.k === 'sw')) { assert.equal(w.l.v, CLOSE_V, 'surging at CLOSE_V'); if (w.l.k === LEG.arc) assert.equal(w.l.r, HUNT_TURN_R, 'turning on HUNT_TURN_R'); }
    assert.notEqual(modeAt(f.modes, b.t), MODE.deep, 'on the surface, where the guns reach it');
  }
  assert.equal(atk.at - begun, A.windup, 'its own wind-up');
  const burst = headAt(f.legs, atk.at);
  near(Math.hypot(burst.x - atk.tg[0][0], burst.z - atk.tg[0][1]), 0, 0.05, 'it bursts where its word says');
  // AUDIT SHIPS D7 (2026-10-06): and every screen, folding the words it was said, bursts it there - `tg` is made of the
  // relay's own track, so the relay's head at its landing could not but meet it
  const screen = createSerpentLink({ now: () => begun, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  screen.word(validSerpentOut(serpentStateOf(surfaced(fightOf([HULL.Carrack])))));
  for (const b of beats) for (const w of b.said) screen.word(validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }));
  const drawn = headAt(screen.state().legs, atk.at);
  near(Math.hypot(drawn.x - atk.tg[0][0], drawn.z - atk.tg[0][1]), 0, 0.05, 'every screen bursts it where its word says');
  near(Math.hypot(atk.tg[0][0] - 120, atk.tg[0][1]), 0, 0.05, 'under her');
  const dash = beats.at(-1).said.filter((w) => w.k === 'sw');
  assert.ok(dash.length >= 2 && dash.every((w) => w.l.at >= begun + SERPENT_SAY_AHEAD_MS && w.l.v <= DASH_V), 'its dash said in the beat, a breath ahead, at DASH_V at most');
  const rides = beats.at(-1).said.filter((w) => w.k === 'dv').map((w) => [w.at - begun, w.m]);
  // PIN MOVED (AUDIT SHIPS D2, 2026-10-06): it sounds SERPENT_SAY_AHEAD_MS on, with its dash - sounded at the beat, a
  // screen 150 ms behind snapped its head down
  assert.deepEqual(rides, [[SERPENT_SAY_AHEAD_MS, MODE.deep], [A.windup, MODE.breach]], 'it sounds with its dash, and its burst is said with it');
  const after = run(f, begun + SERPENT_TICK_MS, atk.at + A.active, [body('s1', 120, 0)], seeded(9));
  assert.ok(after.every((b) => !b.said.some((w) => w.k === 'sw' || w.k === 'dv')), 'nothing of its swim or its ride said late');
});

test('SERPENT3 the coil: dashed for under the sea onto the round it closes about her, tangent - its head at the landing COIL_R from her and going round her counter-clockwise at DRIFT_V, as the coil lies (AUDIT SHIPS B6 - PIN MOVED) - all said as it began (the coil\'s ride too); the coil\'s bearing its head\'s at the landing; its winding says no swim (it leapt the head onto the ring there) (mutants: the leap back; the round the wrong way; the bearing the beat\'s)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  f.phase = 2;
  f.pending = 'coil';
  f.threat = { s1: 5 };
  const ship = body('s1', 250, -40);
  const beats = run(f, T0, T0 + 20_000, [ship], seeded(4), (said) => said.some((w) => w.k === 'atk'));
  const atk = beats.at(-1).said.find((w) => w.k === 'atk');
  assert.ok(atk && atk.a === SERPENT_ATTACK_TABLE.coil.id, 'the coil begun on her');
  assert.equal(atk.at - beats.at(-1).t, SERPENT_ATTACK_TABLE.coil.windup, 'its own wind-up');
  const round = beats.at(-1).said.filter((w) => w.k === 'sw').at(-1).l;
  // PIN MOVED (AUDIT SHIPS B6, 2026-10-06): counter-clockwise - serpentBody.js coilPoint lays the body clockwise of its
  // head, which swims the other way; clockwise, the track's body lay across the ring from the coil's
  assert.deepEqual([round.k, round.r, round.sd, round.v], [LEG.arc, COIL_R, -1, DRIFT_V], 'round her at DRIFT_V, counter-clockwise');
  assert.ok(round.at <= atk.at, 'on it by the landing');
  // AUDIT SHIPS D7: dashed for under the sea - sounded from its dash's start to its landing
  for (let t = beats.at(-1).t + SERPENT_SAY_AHEAD_MS; t < atk.at; t += 250) assert.equal(modeAt(f.modes, t), MODE.deep, `under the sea at +${t - beats.at(-1).t} ms`);
  assert.ok(beats.at(-1).said.some((w) => w.k === 'dv' && w.at === atk.at && w.m === MODE.coil), 'the coil\'s ride said with it');
  const h = headAt(f.legs, atk.at);
  near(Math.hypot(h.x - ship.x, h.z - ship.z), COIL_R, 0.1, 'its head on the round at the landing');
  const bearing = Math.atan2(h.x - ship.x, h.z - ship.z);
  near(Math.abs(serpentWrapYaw(h.yw - (bearing - Math.PI / 2))), 0, 0.01, 'going round her, tangent');   // PIN MOVED (AUDIT SHIPS B6): the other way
  const wound = run(f, beats.at(-1).t + SERPENT_TICK_MS, atk.at + 300, [ship], seeded(5));
  const coil = wound.flatMap((b) => b.said).find((w) => w.k === 'coil');
  assert.ok(coil, 'wound');
  near(Math.abs(serpentWrapYaw(coil.th - bearing)), 0, 1e-3, 'its bearing its head\'s at the landing');
  assert.ok(!wound.some((b) => b.said.some((w) => w.k === 'sw' || w.k === 'dv')), 'its winding says no swim and no ride');
});

test('SERPENT3 the Maelstrom forms where it swims: its eye MAEL_ORBIT_R to its left as the whirl turns, drawn in so its round lies inside its waters, said in its word; its head on that round from the forming, circling it counter-clockwise, reared at the landing - all said as it began - and the whirl formed at the eye its word named; it formed at the waters\' heart and leapt the head 230-480 m onto its round (mutants: the heart again; the eye unbounded; the round the wrong way)', () => {
  for (const [hx, hz, yw] of [[-60, 0, 0], [380, 120, 1.2], [0, -410, Math.PI]]) {
    const g = surfaced(fightOf([HULL.Carrack]));
    g.legs = [{ k: LEG.line, at: T0 - 5000, x: hx - Math.sin(yw) * 55, z: hz - Math.cos(yw) * 55, yw, v: 11 }];
    g.phase = 2; g.hp = g.max * SERPENT_PHASE_AT[1] - 1;
    const beats = run(g, T0, T0 + 8000, [body('s1', 150, 0)], seeded(7), (said) => said.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.mael.id));
    const begun = beats.at(-1), atk = begun.said.find((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.mael.id);
    assert.ok(atk, 'the whirl begun');
    const [ex, ez] = atk.tg[0];
    assert.ok(Math.hypot(ex, ez) <= ARENA_R - MAEL_ORBIT_R + 0.01, `its round inside its waters (${Math.hypot(ex, ez).toFixed(1)} m out)`);
    const round = begun.said.filter((w) => w.k === 'sw').at(-1).l;
    assert.deepEqual([round.k, round.r, round.sd, round.v], [LEG.arc, MAEL_ORBIT_R, -1, CRUISE_V], 'round its eye, counter-clockwise');
    assert.ok(begun.said.some((w) => w.k === 'dv' && w.at === atk.at && w.m === MODE.rear), 'reared as it forms, said with it');
    for (let t = atk.at; t <= atk.at + 4000; t += 500) { const h = headAt(g.legs, t); near(Math.hypot(h.x - ex, h.z - ez), MAEL_ORBIT_R, 0.1, `circling its eye at ${t - atk.at} ms`); }
    const formed = run(g, begun.t + SERPENT_TICK_MS, atk.at + 300, [body('s1', 150, 0)], seeded(8)).flatMap((b) => b.said);
    const m = formed.find((w) => w.k === 'mael');
    assert.deepEqual([m.x, m.z], [ex, ez], 'formed where its word said');
    assert.ok(!formed.some((w) => w.k === 'sw' && w.l.j), 'no leap onto its round');
  }
  // its head far out past its waters, swimming away: its round drawn in, a swim longer than its wind-up - the wind-up
  // waits for it (stretched, never shortened), swum ON THE SURFACE at DASH_V at most, sounded for its own wind-up alone
  const g = surfaced(fightOf([HULL.Carrack]));
  g.legs = [{ k: LEG.line, at: T0 - 5000, x: 0, z: 520, yw: 0, v: 11 }];
  g.phase = 2; g.hp = g.max * SERPENT_PHASE_AT[1] - 1;
  const beats = run(g, T0, T0 + 8000, [body('s1', 150, 0)], seeded(7), (said) => said.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.mael.id));
  const b = beats.at(-1), atk = b.said.find((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.mael.id);
  const A = SERPENT_ATTACK_TABLE.mael;
  assert.ok(atk.at - b.t > A.windup, `stretched (${atk.at - b.t} ms)`);
  assert.ok(b.said.filter((w) => w.k === 'sw').every((w) => w.l.v <= DASH_V), 'never past DASH_V');
  assert.notEqual(modeAt(g.modes, b.t + 100), MODE.deep, 'on the surface as it swims');
  assert.equal(modeAt(g.modes, atk.at - A.windup + 1), MODE.deep, 'sounded for its own wind-up');
  assert.notEqual(modeAt(g.modes, atk.at - A.windup - 1), MODE.deep);
});

test('SERPENT3 the ram\'s whole swim said as it begins - turned on her SERPENT_SAY_AHEAD_MS on, its crawl, its run down the lane at RAM_V from the lane\'s start at its landing, up at the lane\'s end at CRUISE_V and its breach there - and nothing of it said through its span; its run and its rising were said a beat late, every screen\'s head snapped forward (mutants: the run left to its beat; the rising left)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  const A = SERPENT_ATTACK_TABLE.ram;
  let found = null;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const g = surfaced(fightOf([HULL.Carrack]));
    const beats = run(g, T0, T0 + 30_000, [body('s1', 90, 60)], seeded(seed), (said) => said.some((w) => w.k === 'atk' && w.a === A.id));
    const b = beats.at(-1), atk = b.said.find((w) => w.k === 'atk' && w.a === A.id);
    if (atk) found = { g, b, atk };
  }
  assert.ok(found, 'a ram begun');
  void f;
  const { g, b, atk } = found;
  assert.equal(atk.at - b.t, SERPENT_SAY_AHEAD_MS + A.windup, 'its wind-up whole from its turn');
  const legs = b.said.filter((w) => w.k === 'sw').map((w) => w.l);
  const at = (t) => legs.find((l) => l.at === t);
  assert.ok(at(b.t + SERPENT_SAY_AHEAD_MS), 'turned on her a breath ahead');
  const runLeg = at(atk.at), up = at(atk.at + A.active);
  assert.ok(runLeg && up, 'its run and its rising said with it');
  assert.deepEqual([runLeg.x, runLeg.z, runLeg.v], [atk.tg[0][0], atk.tg[0][1], RAM_V], 'down the lane at RAM_V from its start');
  assert.deepEqual([up.x, up.z, up.v], [atk.tg[1][0], atk.tg[1][1], CRUISE_V], 'up at its end');
  assert.ok(b.said.some((w) => w.k === 'dv' && w.at === atk.at + A.active && w.m === MODE.breach), 'its breach at the lane\'s end said with it');
  const span = run(g, b.t + SERPENT_TICK_MS, atk.at + A.active + A.recover - 1, [body('s1', 90, 60)], seeded(3));
  assert.ok(span.every((x) => !x.said.some((w) => w.k === 'sw' || w.k === 'dv')), 'nothing said late through its span');
});

// ═══ CLOSING ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT3 closing: a ship lying inside the round it would turn on to face her is not turned at - it runs on straight until she can be (closeAim); one out of it is surged at; a still ship astern is faced and dashed for within SERPENT_CLOSE_MS, where on its cruising turn it circled her and never faced her; one that keeps beyond its dash is let go after SERPENT_CLOSE_MS and it chooses again (mutants: turned at inside the round; no letting go)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  f.legs = [{ k: LEG.line, at: T0 - 1000, x: 0, z: 0, yw: 0, v: 20 }];   // heading north from (0, 11)
  const h = headAt(f.legs, T0);
  const inside = { x: h.x + 25, z: h.z - 5 };   // abeam to starboard, inside the starboard round
  const aim = closeAim(f, T0, inside);
  near(Math.atan2(aim[0] - h.x, aim[1] - h.z), h.yw, 1e-9, 'on, straight');
  const out = { x: h.x + 200, z: h.z };
  assert.deepEqual(closeAim(f, T0, out), [out.x, out.z], 'surged at');
  // a still ship astern of it: faced and dashed for
  const s = surfaced(fightOf([HULL.Carrack]));
  s.legs = [{ k: LEG.line, at: T0 - 2000, x: 120, z: -40, yw: 0, v: 11 }];   // running north, she lies astern
  s.closing = { a: SERPENT_ATTACK_TABLE.breach.id, s: 's1', at: T0 };
  assert.equal(dashFits(s, SERPENT_ATTACK_TABLE.breach, T0, body('s1', 120, -60)), false, 'astern, beyond the dash');
  const beats = run(s, T0, T0 + SERPENT_CLOSE_MS, [body('s1', 120, -60)], seeded(2), (said) => said.some((w) => w.k === 'atk'));
  assert.ok(beats.at(-1).said.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.breach.id), `faced and dashed for (${beats.at(-1).t - T0} ms)`);
  // one that keeps ahead of it: let go
  const g = surfaced(fightOf([HULL.Carrack]));
  g.closing = { a: SERPENT_ATTACK_TABLE.coil.id, s: 's1', at: T0 };
  const away = (t) => { const hh = headAt(g.legs, t); return [body('s1', hh.x + Math.sin(hh.yw) * 400, hh.z + Math.cos(hh.yw) * 400)]; };
  const fled = run(g, T0, T0 + SERPENT_CLOSE_MS + 500, away, seeded(6));
  assert.ok(!fled.some((b) => b.said.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.coil.id)), 'no coil on a ship it never reached');
  assert.equal(g.closing?.a === SERPENT_ATTACK_TABLE.coil.id && g.closing.at === T0, false, 'let go after SERPENT_CLOSE_MS');
  // the dash's own geometry: onto a point (the Maw's), onto a round tangent (the coil's)
  const way = wayOnto({ x: 0, z: 0 }, 0, HUNT_TURN_R, { x: 0, z: 100 });
  assert.equal(way.turn, 0, 'dead ahead: no turn');
  near(way.len, 100, 1e-9, 'a straight');
  const ring = wayOnto({ x: 0, z: 0 }, 0, HUNT_TURN_R, { x: COIL_R, z: 200 }, COIL_R, 1);
  near(ring.turn, 0, 1e-9, 'already on its tangent');
  near(wayLen(ring), 200, 1e-9);
  assert.ok(HUNT_TURN_R < TURN_R && CLOSE_V > CRUISE_V && CLOSE_V < DASH_V);
});

// ═══ A FIGHT TAKEN UP ══════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT3 a fight taken up after its room slept: the attack it had in flight landed on empty waters - let go, never landed later; a coil holding a ship keeps its round and its clock; asked by the relay before a word is judged - a blow on a fight whose head swam on two minutes is judged on it taken up where it was, where it was refused for the water (mutants: the attack kept; the coil let go; the word judged on the fight asleep)', async () => {
  // AUDIT SHIPS D7 (2026-10-06): a Rising Maw in flight, its dash and its burst said to come - "never landed later" was
  // read off a new attack's word, which never carries an old one's number
  const { f, beats, begun, atk } = breachOn();
  assert.ok(f.atk && f.atk.i === atk.i);
  const toCome = beats.at(-1).said.filter((w) => w.k === 'sw' && w.l.at > begun).map((w) => w.l);
  assert.ok(toCome.length >= 2, 'its dash said to come');
  // PIN MOVED (AUDIT SHIPS B1, 2026-10-06): a sleep past SERPENT_DRAWN_MS - no screen still draws it; a shorter one takes
  // nothing up (test/auditships.test.js)
  const slept = begun + SERPENT_DRAWN_MS + 1000;
  serpentResume(f, slept);
  assert.equal(f.atk, null, 'let go');
  assert.ok(toCome.every((l) => !f.legs.some((x) => sameLeg(x, l))), 'its dash to come swum no more');
  assert.ok(!f.modes.some((m) => m.at === atk.at && m.m === MODE.breach), 'its burst to come ridden no more');
  run(f, slept + SERPENT_TICK_MS, slept + 3000, [body('s1', 120, 0)], seeded(6));
  assert.ok(Math.hypot(headAt(f.legs, atk.at).x - atk.tg[0][0], headAt(f.legs, atk.at).z - atk.tg[0][1]) > SERPENT_ATTACK_TABLE.breach.r, 'never burst at her');
  // a coil holding a ship keeps its round
  const c = surfaced(fightOf([HULL.Carrack]));
  c.coil = { i: 4, s: 's1', x: 0, z: 0, th: 0, at: T0 - 1000, until: T0 + 20_000, off: 0, h: 60, m: 60, held: true, why: null };
  const legs = JSON.stringify(c.legs);
  assert.deepEqual(serpentResume(c, T0 + SERPENT_DRAWN_MS + 1), [], 'nothing said');   // PIN MOVED (AUDIT SHIPS B1): taken up past SERPENT_DRAWN_MS
  assert.equal(JSON.stringify(c.legs), legs, 'its round kept');
  assert.deepEqual([c.coil.at, c.coil.until, c.coil.off, c.coil.held], [T0 - 1000, T0 + 20_000, 0, true], 'its clock kept, holding her');   // AUDIT SHIPS D7: its title's clock
  // the relay: a blow on a slept fight
  const DAY = 363, TT = serpentTimes(DAY), PX = 205, PY = 214;
  const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS, CELL = cellRoomOfWire(SX, SZ);
  const pose = (mx, mz) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0 });
  const realNow = Date.now; let clock = TT.riseAt + 20_000;
  try {
    Date.now = () => clock;
    const r = fakeRooms({ now: () => clock }).room(CELL);
    const a = r.connect(); await r.hello(a, 'peer-0001', pose(120, 0));
    await r.raw(a, JSON.stringify({ t: 'serpent', k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: SX, sz: SZ }));
    const fight = r.room._serpents.get(serpentFightId(DAY, serpentSiteKey(SX, SZ)));
    fight.legs = [{ k: LEG.line, at: clock - 1000, x: 100, z: 0, yw: Math.PI / 2, v: 11 }];   // swimming east...
    fight.modes = [{ at: clock - 60_000, m: MODE.cruise }];
    fight.lastTickAt = clock;
    clock += 120_000;   // ...two minutes with no beat: 1.4 km out, were it swum on
    assert.ok(Math.hypot(headAt(fight.legs, clock).x - 120, headAt(fight.legs, clock).z) > 1000);
    await r.raw(a, JSON.stringify({ t: 'serpent', k: 'hit', d: 30, z: ZONES.body }));
    assert.ok(fight.players['acct-peer-0001'].dealt > 0, 'judged on the fight taken up where it was');
  } finally { Date.now = realNow; }
});

// ═══ A BLOW JUDGED WHEN IT STRUCK ══════════════════════════════════════════════════════════════════════════════════

test('SERPENT3 a blow is judged where the body lay when it struck: its word a volley\'s gathering and the wire late, the body asked back as far as SERPENT_HIT_LOOKBACK_MS - a blow whose word comes 400 ms after the last of it sounded lands; one 1.5 s after does not (mutants: judged at the word alone; the look back shortened)', () => {
  const sounding = () => {
    const f = surfaced(fightOf([HULL.Carrack]));
    f.legs = [{ k: LEG.line, at: T0 - 60_000, x: 0, z: -600, yw: 0, v: 3 }];
    f.modes = [{ at: T0 - 60_000, m: MODE.breach }, { at: T0, m: MODE.deep }];
    return f;
  };
  const probe = sounding();
  let last = T0;
  for (let t = T0; t < T0 + 4000; t += 10) if (anyExposed(bodyAt(probe, t))) last = t;
  assert.ok(last > T0 && last < T0 + 3000, `it sounds (${last - T0} ms)`);
  const h = headAt(probe.legs, last);
  const pose = { x: h.x + 40, z: h.z };
  const blow = (late, zone) => { const f = sounding(); applySerpentHit(f, 's1', 10, zone, pose, last + late); return f.players.s1.dealt; };
  assert.ok(blow(400, ZONES.body) > 0, 'its word 400 ms after: it lands');
  assert.ok(blow(900, ZONES.body) > 0, 'its word 900 ms after: it lands');
  assert.equal(blow(1500, ZONES.body), 0, '1.5 s after: under the sea');
  assert.deepEqual([...SERPENT_HIT_LOOKBACK_MS], [0, 500, 1000]);
});

// ═══ A PAIR'S SHARE ════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT3 a pair\'s share (Mac: "Two or more ships"): with exactly two ships afloat at the fight every blow, crush, grip, grind and venom bite lands at SERPENT_PAIR_SHARE - each of a pair takes what each of three would; a lone ship and three or more take the whole; the host reads the count off the relay\'s state (mutants: a lone ship eased; the pair\'s share unread on a blow, a crush, a grip, a grind, the venom)', () => {
  near(SERPENT_PAIR_SHARE, 2 / 3, 1e-12);
  assert.deepEqual([0, 1, 2, 3, 5].map(fleetShare), [1, 1, 2 / 3, 1, 1]);
  const whole = { maxHull: 1200, maxSail: 600 };
  const A = SERPENT_ATTACK_TABLE.ram;
  assert.deepEqual(shipHurt(A, whole, 2 / 3), { hull: Math.round((A.hull * 1200 + A.base) * 2 / 3), sail: Math.round(A.sail * 600 * 2 / 3), crew: Math.round(A.crew * 2 / 3) });
  assert.deepEqual(shipHurt(A, whole), shipHurt(A, whole, 1));
  // AUDIT SHIPS D7 (2026-10-06): each at exactly the share - "less than" passed a share squared or halved
  assert.deepEqual(crushHurt(whole, 2 / 3), { hull: Math.round((CRUSH.hull * 1200 + CRUSH.base) * 2 / 3), sail: Math.round(CRUSH.sail * 600 * 2 / 3), crew: Math.round(CRUSH.crew * 2 / 3) });
  assert.equal(gripHurt(whole, 10, undefined, 2 / 3).hurt.hull, Math.floor((GRIP.hull * 1200 + GRIP.base) * 10 * 2 / 3));
  assert.equal(grindHurt(whole, 10, 0, 2 / 3).hurt.hull, Math.floor((MAEL_GRIND.hull * 1200 + MAEL_GRIND.base) * 10 * 2 / 3));
  const hostSrc = readFileSync(new URL('../src/scenes/serpentHost.js', import.meta.url), 'utf8');
  assert.match(hostSrc, /crushHurt\(ship, share\(\), blows\)/, 'the crush at the share');   // PIN MOVED (AUDIT SHIPS C3): carried
  assert.match(hostSrc, /gripHurt\(ship, Math\.min\(1, dtS\), grip, share\(\)\)/, 'the grip at the share');
  assert.match(hostSrc, /grindHurt\(ship, dtS, grind, share\(\)\)/, 'the grind at the share');
  assert.match(hostSrc, /const share = \(\) => fleetShare\(deps\.link\.state\(\)\.n\);/, 'off the relay\'s count');
  // the host: a Rising Maw on my ship, and the venom on my feet, by the ships afloat at the fight
  for (const n of [1, 2, 3]) {
    const { host, hear, step, at, strikes, bites } = clientRig();
    host.frame();
    hear({ ...stateOf(at()), n });
    hear({ k: 'atk', i: 1, a: SERPENT_ATTACK_TABLE.breach.id, at: at() + 1000, x: 0, z: 0, yw: 0, tg: [[60, 0]] });
    step(1050);
    hear({ k: 'atk', i: 2, a: SERPENT_ATTACK_TABLE.spit.id, at: at() + 1000, x: 0, z: 0, yw: 0, tg: [[60, 0]] });
    step(1050); step(1100);
    const B = SERPENT_ATTACK_TABLE.breach, k = n === 2 ? 2 / 3 : 1;
    assert.equal(strikes[0].hurt.hull, Math.round((B.hull * 1200 + B.base) * k), `${n} ship(s): the blow's share`);
    const P = SERPENT_ATTACK_TABLE.spit.pool;
    assert.ok(bites.length > 0, 'the venom bit');
    // PIN MOVED (AUDIT 2 XC4, 2026-10-06): the venom's bite is handed on in points - its whole on my body (3 at 100
    // health), then the pair's share of it, carried bite to bite (pct x k and base x k rounded alone let a pair take
    // the whole of a 1-point bite)
    const whole = Math.max(1, Math.round(P.pct * 100 + P.base));
    assert.deepEqual(bites[0], [Math.round(whole * k), 'poison'], `${n} ship(s): the venom's share`);
  }
});

// ═══ THE LAW'S VERSION, AND THE CLIENT ═════════════════════════════════════════════════════════════════════════════

test('SERPENT3 the brain\'s law is version 2 and a game before it is told to reload: it draws the whirl at the waters\' heart and takes a pair\'s blows whole (mutants: the old version kept)', async () => {
  assert.equal(SERPENT_BRAIN_V, 2);
  assert.equal(SERPENT_BRAIN_MIN, 2);
  const DAY = 363, TT = serpentTimes(DAY), PX = 205, PY = 214;
  const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS, CELL = cellRoomOfWire(SX, SZ);
  const realNow = Date.now; const clock = TT.riseAt + 20_000;
  try {
    Date.now = () => clock;
    const r = fakeRooms({ now: () => clock }).room(CELL);
    const a = r.connect(); await r.hello(a, 'peer-0001', { x: SX + 100 * SERPENT_NATIVE_PER_M, y: 0, z: SZ, yaw: 0, pitch: 0 });
    await r.raw(a, JSON.stringify({ t: 'serpent', k: 'in', d: DAY, bv: 1, lv: 20, hl: 4, sx: SX, sz: SZ }));
    assert.deepEqual(a.sent.filter((m) => m.t === 'serpent').at(-1), { t: 'serpent', k: 'no', m: 'reload' });
  } finally { Date.now = realNow; }
});

const CT0 = 50_000_000;
/** A whole state off the brain's own fight, as the wire projects it. */
function stateOf(now) {
  const f = newSerpentFight(363, now, now + 25 * 60_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  return validSerpentOut(serpentStateOf(f));
}
/** The host over a link in the site's own frame, my ship at (60, 0). */
function clientRig() {
  let now = CT0;
  const strikes = [], bites = [], fx = [];
  const sw = { day: 363, site: { sx: 0, sz: 0 }, phase: 'hunt', t: { soundAt: CT0 + 25 * 60_000 } };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  const boat = { id: 'mine' };
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw },
    online: { ready: () => false, send: () => true, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0,
    feet: () => [60, 1, 0], level: () => 20,
    boat: () => ({ boat, hull: 4, root: [60, 0], pos: [60, 0, 0], yaw: 0, hl: 25, hw: 7, maxHull: 1200, maxSail: 600, atHelm: true, wrecked: false }),
    strike: (b, hurt) => strikes.push({ b, hurt }), maxHealth: () => 100, hurt: (n, el) => bites.push([n, el]),
    say: () => {}, mid: () => {}, sound: () => {}, fx: (k, p) => fx.push([k, p]),
  });
  const hear = (w) => { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  return { host, link, hear, strikes, bites, fx, at: () => now, step: (ms) => { now += ms; return host.frame(); } };
}

test('SERPENT3 on the client: the whirl\'s waters laid as it winds where its word says it forms (its eye beside the serpent), no longer always the heart; and its dash under the sea seen on it - a bow wave over its head while it swims sounded faster than it cruises, none while it cruises or lies sounded and slow, and the ram\'s run its one wave (mutants: the heart again; no wake; the wake while it cruises; the ram\'s doubled)', () => {
  const R = clientRig();
  R.host.frame();
  R.hear(stateOf(R.at()));
  R.hear({ k: 'atk', i: 3, a: SERPENT_ATTACK_TABLE.mael.id, at: R.at() + 4000, x: 100, z: 0, yw: 0, tg: [[180, 40]] });
  R.step(10); R.step(1000);
  const disc = R.host.drawFrame().tele.find((t) => t.key === 'mael');
  assert.deepEqual(disc.c, [180, 40], 'its waters where its eye forms');
  // a dash sounded: the head under, faster than it cruises
  const W = clientRig();
  W.host.frame();
  const st = stateOf(W.at());
  const t = W.at();
  W.hear({ ...st, legs: [{ k: LEG.line, at: t - 2000, x: 0, z: 0, yw: 0, v: CRUISE_V }], modes: [{ at: t - 60_000, m: MODE.cruise }] });
  W.step(250);
  assert.equal(W.fx.filter(([k]) => k === 'wake').length, 0, 'cruising: none');
  W.hear({ k: 'sw', l: { k: LEG.line, at: W.at(), x: headAt(W.link.state().legs, W.at()).x, z: headAt(W.link.state().legs, W.at()).z, yw: 0, v: CLOSE_V } });
  W.step(250);
  assert.equal(W.fx.filter(([k]) => k === 'wake').length, 0, 'surging on the surface: none - its body shows');
  W.hear({ k: 'sw', l: { k: LEG.line, at: W.at(), x: headAt(W.link.state().legs, W.at()).x, z: headAt(W.link.state().legs, W.at()).z, yw: 0, v: CRUISE_V } });
  W.hear({ k: 'dv', at: W.at(), m: MODE.deep });
  W.step(2000);
  assert.equal(W.fx.filter(([k]) => k === 'wake').length, 0, 'sounded and slow: none');
  W.hear({ k: 'sw', l: { k: LEG.line, at: W.at(), x: headAt(W.link.state().legs, W.at()).x, z: headAt(W.link.state().legs, W.at()).z, yw: 0, v: DASH_V } });
  W.step(250); W.step(250);
  const wakes = W.fx.filter(([k]) => k === 'wake');
  assert.equal(wakes.length, 2, 'dashing under: a wave a frame');
  const h = headAt(W.link.state().legs, W.at());
  near(wakes[1][1][0], h.x, 1e-6, 'over its head'); near(wakes[1][1][2], h.z, 1e-6); assert.equal(wakes[1][1][1], 0, 'on the sea');
  // the ram's run: its own wave alone
  const M = clientRig();
  M.host.frame();
  const t2 = M.at();
  M.hear({ ...stateOf(t2), legs: [{ k: LEG.line, at: t2 - 100, x: 60, z: -150, yw: 0, v: RAM_V }], modes: [{ at: t2 - 5000, m: MODE.deep }] });
  M.hear({ k: 'atk', i: 5, a: SERPENT_ATTACK_TABLE.ram.id, at: t2 - 100, x: 60, z: -150, yw: 0, tg: [[60, -150], [60, -150 + 100]] });
  M.step(100);
  assert.equal(M.fx.filter(([k]) => k === 'wake').length, 1, 'one wave a frame down its lane');
  assert.ok(legIndexAt(M.link.state().legs, M.at()) >= 0);
});
