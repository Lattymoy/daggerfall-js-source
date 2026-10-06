// AUDIT SHIPS 2 (2026-10-06, Mac: "Audit everything" - PR #634 again, the first audit's fixes with it;
// bible/01-Overview/Audit-Ships.md, its second round): THE SERPENT'S HALF. Each pin is one finding, fixed at its root, and
// failed on the build before it. tools/mutants/auditships2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newSerpentFight, joinSerpentFight, stepSerpentBrain, applySerpentHit, serpentStateOf, serpentResume, serpentWoke, serpentWreck, serpentWayOf,
  coilWord, coilHolds, serpentWrapYaw, serpentSaysTrack, serpentShareWanted,
  SERPENT_ATTACK_TABLE, SERPENT_TICK_MS, SERPENT_SAY_AHEAD_MS, SERPENT_HP_SEND_MS, SERPENT_WAY_STALE_MS, SERPENT_CLOCK_SPAN_MS, SERPENT_TRACK_WORDS,
  ZONES, CRUISE_V, DASH_V, HUNT_TURN_R, SERPENT_TTK_S, SHIP_REF,
} from '../src/net/serpentBrain.js';
import { LEG, MODE, COIL_R, COIL_BLEND_MS, COIL_HEAD_IN, DRIFT_V, bodyAt, headAt, coilAngleAt, coilPoint } from '../src/net/serpentBody.js';
import { createSerpentLink } from '../src/net/serpentLink.js';
import { createSerpentHost, WAKE_MS } from '../src/scenes/serpentHost.js';
import { venomBite, venomHurt, fleetShare } from '../src/systems/serpentStrike.js';
import { SERPENT_BAR_TEXT } from '../src/ui/serpentBar.js';
import { validSerpentOut, cellRoomOfWire, serpentFightId, PIXEL_UNITS } from '../src/net/wire.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { fakeRooms } from './fakeRoom.mjs';

const T0 = 10_000_000;
const SOUND = T0 + 25 * 60_000;
/** A seeded [0,1) source (mulberry32). */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A body at the fight, its pose's send time `ts` when it says one (the relay's _serpentBodies). */
const body = (sub, x, z, ts) => ({ sub, x, z, dead: false, ...(ts !== undefined ? { ts: ts % 2 ** 24 } : {}) });
/** A fight joined by `hls`' ships as s1, s2 ... */
function fightOf(hls = [HULL.Carrack]) {
  const f = newSerpentFight(363, T0, SOUND, 'sethrakul', 0, 0, 0.4);
  hls.forEach((hl, i) => assert.ok(joinSerpentFight(f, `s${i + 1}`, `P${i + 1}`, 20, hl, T0, true)));
  return f;
}
/** Up and swimming: its opening over, a round west of its heart. */
function surfaced(f, t = T0) {
  f.legs = [{ k: LEG.arc, at: t - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: t - 30_000, m: MODE.cruise }];
  f.openUntil = t; f.nextAt = t; f.lastTickAt = t;
  return f;
}
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
/** A client's link folding the relay's words as the wire passes them. */
function screenOf(f, clock) {
  const link = createSerpentLink({ now: clock, site: () => ({ day: f.day, sx: 0, sz: 0 }) });
  const hear = (w) => { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  hear(serpentStateOf(f));
  return { link, hear };
}

/** The client's host over its link, the relay's words heard `lag` ms after the brain says them; `feet` where I stand. */
function clientOf({ maxHealth = 100, feet = [60, 1, 0], boat = null } = {}) {
  let now = T0;
  const fx = [], bites = [];
  const sw = { day: 363, site: { sx: 0, sz: 0 }, phase: 'hunt', t: { soundAt: T0 + 25 * 60_000 } };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw }, online: { ready: () => false, send: () => true, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0, feet: () => feet, level: () => 20,
    boat: () => boat, strike: () => {}, maxHealth: () => maxHealth, hurt: (n, el) => bites.push([n, el]),
    say: () => {}, mid: () => {}, sound: () => {}, fx: (k) => fx.push({ k, t: now }),
  });
  const hear = (w) => { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  return { host, link, hear, fx, bites, at: () => now, set: (t) => { now = t; } };
}

// ═══ XC4: THE VENOM'S SHARE, CARRIED ══════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XC4 the venom\'s bite at a pair\'s share is two thirds of the whole over a pool - its whole bite on my body (venomBite: pct of my health and base, never under 1) shared and carried bite to bite as every blow is (venomHurt); handed on as pct x k and base x k and rounded a bite at a time, a pair at 20 health took every 1-point bite whole and at 40 half of each 2 (mutants: the share rounded alone; the carry dropped)', () => {
  const P = SERPENT_ATTACK_TABLE.spit.pool;
  assert.deepEqual([20, 40, 100, 150].map((h) => venomBite(P, h)), [1, 2, 3, 4], 'the whole bite: world.js\'s own law');
  assert.equal(venomBite(P, -5), 1, 'never under a point');
  for (const [health, whole] of [[20, 1], [40, 2], [100, 3], [150, 4]]) {
    const carry = { venom: 0 };
    let pair = 0, one = 0, three = 0;
    for (let i = 0; i < 30; i++) { pair += venomHurt(whole, 2 / 3, carry); one += venomHurt(whole, 1, { venom: 0 }); three += venomHurt(whole, 1); }
    assert.equal(pair, 20 * whole, `${health} health: a pair\'s thirty bites are two thirds of the whole\'s`);
    assert.deepEqual([one, three], [30 * whole, 30 * whole], 'one ship and three take the whole');
  }
  // the host: a pool on my feet, a pair's share, my body's own health - the bites as the world takes them, in points
  const R = clientOf({ maxHealth: 20 });
  const f = newSerpentFight(363, T0, T0 + 25 * 60_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, HULL.Carrack, T0, true);
  R.host.frame();
  R.hear({ ...serpentStateOf(f), n: 2 });
  R.hear({ k: 'atk', i: 1, a: SERPENT_ATTACK_TABLE.spit.id, at: T0 + 300, x: 0, z: 0, yw: 0, tg: [[60, 0]] });
  for (let t = T0; t <= T0 + 300 + P.ms; t += 100) { R.set(t); R.host.frame(); }
  assert.ok(R.bites.length >= 6, `the venom bit (${R.bites.length})`);
  assert.ok(R.bites.every(([n, el]) => n === 1 && el === 'poison'), 'a bite is a point or none - a none is never handed on');
  const ticks = Math.round(R.bites.length * 3 / 2);
  assert.ok(Math.abs(R.bites.length - ticks * 2 / 3) <= 1, `two thirds of the pool's bites land (${R.bites.length})`);
});

// ═══ XC6: THE WAKE TO ITS TURN ═════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XC6 a dash cut by the kill or the sounding keeps its bow wave until its own turn - the end is said SERPENT_SAY_AHEAD_MS on (AUDIT SHIPS B5) and the head dashes on under the sea till then; the wave stopped at the word, and 15-18 m of a 34 m/s dash went by with none over it; past its turn (the throes, the dive) none (mutants: the wave stopped at the word)', () => {
  for (const [how, pend, endBeat] of [['sounded mid-ram', 'ram', T0 + 6000], ['slain mid-Maw-dash', 'breach', T0 + 14_000]]) {
    const f = newSerpentFight(363, T0, how.startsWith('sounded') ? endBeat : T0 + 25 * 60_000, 'sethrakul', 0, 0, 0);
    joinSerpentFight(f, 'acct-0001', 'Ama', 20, HULL.Carrack, T0, true);
    f.legs = [{ k: LEG.line, at: T0 - 30_000, x: -500, z: -330, yw: 0, v: 11 }];
    f.modes = [{ at: T0 - 30_000, m: MODE.cruise }];
    f.openUntil = T0; f.nextAt = T0; f.lastTickAt = T0;
    f.pending = pend;
    const R = clientOf({ feet: [600, 1, 600] });
    R.host.frame();
    R.hear(serpentStateOf(f));
    const inbox = [];
    let endAt = null;
    const rng = () => 0.5;
    for (let now = T0; now <= endBeat + 3000; now += 10) {
      R.set(now);
      if ((now - T0) % SERPENT_TICK_MS === 0) {
        if (how.startsWith('slain') && now === endBeat) {
          const p = bodyAt(f, now - 1000)[2];
          f.hp = 0.5;
          for (const w of applySerpentHit(f, 'acct-0001', 50, ZONES.body, { x: p.x + 30, z: p.z }, now)) inbox.push({ due: now + 100, w });
        }
        for (const w of stepSerpentBrain(f, now, [{ sub: 'acct-0001', x: 600, z: 600, dead: false }], rng)) inbox.push({ due: now + 100, w });
        if (endAt === null && (f.fell || f.gone)) endAt = now;
      }
      while (inbox.length && inbox[0].due <= now) R.hear(inbox.shift().w);
      R.host.frame();
    }
    assert.ok(endAt !== null, `${how}: it ended`);
    const turn = endAt + SERPENT_SAY_AHEAD_MS, wakes = R.fx.filter((e) => e.k === 'wake').map((e) => e.t);
    assert.ok(wakes.some((t) => t >= endAt + 100 && t < turn), `${how}: a wave over its dash after its word (${wakes.slice(-3)})`);
    assert.ok(turn - wakes.at(-1) <= WAKE_MS, `${how}: until its turn, a wave each WAKE_MS (the last ${turn - wakes.at(-1)} ms before it)`);
    assert.ok(wakes.every((t) => t < turn), `${how}: none past its turn`);
  }
});

// ═══ XC8: THE BAR'S COUNT ══════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XC8 the bar\'s count says what it counts - the ships FIGHTING it (AUDIT SHIPS C1: the shares in its health), where it said "in its waters" over a count that left a rowboat and an idle ship in its waters out (mutants: the old words)', () => {
  assert.deepEqual([1, 2, 3].map(SERPENT_BAR_TEXT.ships), ['1 ship fighting it', '2 ships fighting it', '3 ships fighting it']);
});

// ═══ XB1: THE CLOSING SURGE, SWUM AS THE DASHES ARE ═════════════════════════════════════════════════════════════════

/** Closing on a ship 450 m off sailing a `course` ('line' across its bow, or a 300 m 'round') at `v` m/s for 8 s - its
 *  way read off her poses first: every beat's words. */
function closingOn(course, v) {
  const f = newSerpentFight(363, T0, T0 + 3_600_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 's1', 'P1', 20, HULL.Carrack, T0, true);
  f.modes = [{ at: T0 - 60_000, m: MODE.cruise }];
  f.openUntil = T0 + 3_600_000; f.nextAt = T0 + 3_600_000;
  const R = 300, her = course === 'round'
    ? (t) => { const a = (v * (t - T0)) / 1000 / R; return { x: R * Math.sin(a), z: R * Math.cos(a) }; }
    : (t) => ({ x: -200 + (v * (t - T0)) / 1000, z: 150 });
  f.legs = [{ k: LEG.line, at: T0 - 9000, x: 0, z: -220 - CRUISE_V * 7, yw: 0.7, v: CRUISE_V }];
  f.lastTickAt = T0 - 2250;
  const at = (t) => [body('s1', her(t).x, her(t).z, t)];
  for (let t = T0 - 2000; t < T0; t += SERPENT_TICK_MS) stepSerpentBrain(f, t, at(t), () => 0.5);
  f.closing = { a: SERPENT_ATTACK_TABLE.breach.id, s: 's1', at: T0 + 3_600_000 };
  const beats = [];
  for (let t = T0; t <= T0 + 8000; t += SERPENT_TICK_MS) beats.push({ t, said: stepSerpentBrain(f, t, at(t), () => 0.5), her: her(t) });
  return { f, beats };
}

test('AUDIT SHIPS 2 XB1 the closing surge is swum as its dashes are - a turn of HUNT_TURN_R and a straight at where it meets her (closeAim), said whole SERPENT_SAY_AHEAD_MS on, laid again only when its straight no longer runs at her: closing on a ship sailing across its bow or round its waters at 13, 21.2 and 26.5 m/s, every leg is said ahead, its turns never swing back and forth, and it is laid again a few times in 8 s; steered as it cruises (no turn cut under LEG_MIN_MS, at 4-6 times the cruise\'s turn rate), it swung 30 degrees each side of her and back every 1.25 s, 7 times in 8 s, each turn said at the beat (mutants: steered as it cruises; laid again every beat; its turn said at the beat)', () => {
  let reversals = 0;
  for (const course of ['line', 'round']) for (const v of [13, 21.2, 26.5]) {
    const { f, beats } = closingOn(course, v);
    const gap = (b) => { const h = headAt(f.legs, b.t); return Math.hypot(b.her.x - h.x, b.her.z - h.z); };
    assert.ok(gap(beats[0]) - gap(beats.at(-1)) >= 150, `${course} ${v}: it closes on her (${gap(beats[0]).toFixed(0)} -> ${gap(beats.at(-1)).toFixed(0)} m)`);
    assert.ok(!beats.some((b) => b.said.some((w) => w.k === 'atk')), `${course} ${v}: still closing`);
    const legs = beats.flatMap((b) => b.said.filter((w) => w.k === 'sw').map((w) => ({ ...w.l, said: b.t })));
    assert.ok(legs.every((l) => l.at >= l.said + SERPENT_SAY_AHEAD_MS), `${course} ${v}: every leg said SERPENT_SAY_AHEAD_MS ahead`);
    assert.ok(legs.every((l) => l.k !== LEG.arc || l.r === HUNT_TURN_R), `${course} ${v}: its turns on HUNT_TURN_R`);
    const arcs = legs.filter((l) => l.k === LEG.arc);
    const flips = arcs.filter((l, i) => i > 0 && l.sd !== arcs[i - 1].sd).length;
    reversals += flips;
    assert.ok(flips <= 1, `${course} ${v}: its turns never swing back and forth (${flips} reversals)`);
    assert.ok(legs.length <= 12, `${course} ${v}: laid again a few times, not every beat (${legs.length} legs in 8 s)`);
  }
  assert.ok(reversals <= 6, `${reversals} reversals over six closings`);
});

// ═══ XB2: THE KILL BETWEEN BEATS ═══════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XB2 a kill between beats (a blow is judged the moment it comes) lays its throes SERPENT_SAY_AHEAD_MS on and unsays nothing said before then: a Rising Maw and a ram begun at a beat, their swims said to begin SERPENT_SAY_AHEAD_MS on, slain 250, 400 and 450 ms after it - a client 100, 150 and 250 ms late draws the relay\'s head every moment; held from the blow\'s moment (AUDIT SHIPS B5\'s holdNow), the dash a lagging screen had begun to draw was unsaid - 0.7, 1.6 and 3.2 m (mutants: the swim held from the blow)', () => {
  let worst = 0;
  for (const attack of ['breach', 'ram']) for (const lag of [100, 150, 250]) for (const after of [250, 400, 450]) {
    const f = newSerpentFight(363, T0, T0 + 3_600_000, 'sethrakul', 0, 0, 0);
    joinSerpentFight(f, 'acct-0001', 'P1', 20, HULL.Carrack, T0, true);
    f.legs = [{ k: LEG.line, at: T0 - 5000, x: 0, z: -55, yw: 0, v: CRUISE_V }];
    f.modes = [{ at: T0 - 60_000, m: MODE.cruise }];
    f.openUntil = T0; f.nextAt = T0; f.lastTickAt = T0 - SERPENT_TICK_MS;
    let clock = T0;
    const { link, hear } = screenOf(f, () => clock);
    f.closing = { a: SERPENT_ATTACK_TABLE[attack].id, s: 'acct-0001', at: T0 };
    const said = stepSerpentBrain(f, T0, [body('acct-0001', 0, 60, 0)], () => 0.5);
    assert.ok(said.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE[attack].id), `${attack} begun`);
    const inbox = said.map((w) => ({ due: T0 + lag, w }));
    f.hp = 1;
    for (let t = T0; t <= T0 + 2000; t += 5) {
      clock = t;
      if (t === T0 + after) { const h = headAt(f.legs, t); for (const w of applySerpentHit(f, 'acct-0001', 50, ZONES.body, { x: h.x + 20, z: h.z }, t)) inbox.push({ due: t + lag, w }); assert.ok(f.fell, 'slain between beats'); }
      while (inbox.length && inbox[0].due <= t) hear(inbox.shift().w);
      const c = headAt(link.state().legs, t), r = headAt(f.legs, t);
      worst = Math.max(worst, Math.hypot(c.x - r.x, c.z - r.z));
    }
  }
  assert.ok(worst <= 0.001, `every lagging screen draws the relay's head (${worst.toFixed(4)} m apart at worst)`);
});

// ═══ XC3 / XB5: ONE CENTRE ═════════════════════════════════════════════════════════════════════════════════════════

/** Steps `f` from `from` to `to` over `bodies`; the head's widest step in a 50 ms look, and its bearing about the coil
 *  against the coil drawn (worst, radians) and its distance off the ring from `round` on while the coil holds. */
function heldRound(f, from, to, bodies, rng, round) {
  let step = 0, bearing = 0, ring = 0, prev = headAt(f.legs, from);
  for (let t = from; t <= to; t += SERPENT_TICK_MS) {
    stepSerpentBrain(f, t, bodies, rng);
    for (let u = t; u < t + SERPENT_TICK_MS; u += 50) {
      const h = headAt(f.legs, u), c = f.coil;
      step = Math.max(step, Math.hypot(h.x - prev.x, h.z - prev.z));
      prev = h;
      if (u >= round && coilHolds(f, u)) {
        bearing = Math.max(bearing, Math.abs(serpentWrapYaw(Math.atan2(h.x - c.x, h.z - c.z) - coilAngleAt(c, u))));
        ring = Math.max(ring, Math.abs(Math.hypot(h.x - c.x, h.z - c.z) - COIL_R));
      }
    }
  }
  return { step, bearing, ring };
}
/** The drawn coil's head (its snout) against the track's head, on the flat, at its letting go `c.off`. */
const gapAtLetGo = (f) => { const c = f.coil, d = coilPoint(c, 0, coilAngleAt(c, c.off)), h = headAt(f.legs, c.off); return Math.hypot(d.x - h.x, d.z - h.z); };

test('AUDIT SHIPS 2 XC3 one centre: her word `held` moves the coil onto her hull\'s middle (up to COIL_HELD_SLACK), and its head\'s round is laid again about it as it is drawn - said SERPENT_SAY_AHEAD_MS on, begun once the coil holds the whole body (its winding on drawn), a straight onto the ring where the coil drawn has gone round to at DASH_V at most, and round it from there: from then the coil drawn turns with its head, and as it lets go its head lies where an unmoved coil\'s does; kept round the mark, its head stood up to 30 m from the coil drawn as it let go and the body lurched 42 m unwinding (mutants: the round kept about the mark; laid at the beat; laid before the coil is drawn whole; onto the coil\'s first bearing)', () => {
  for (const d of [0, 18, 30]) {
    const f = surfaced(fightOf([HULL.Carrack]));
    f.phase = 2; f.pending = 'coil'; f.threat = { s1: 5 };
    const ship = body('s1', 250, -40), rng = seeded(4);
    let t = T0, atk = null;
    for (; t < T0 + 20_000 && !atk; t += SERPENT_TICK_MS) atk = stepSerpentBrain(f, t, [ship], rng).find((w) => w.k === 'atk') ?? null;
    assert.equal(atk?.a, SERPENT_ATTACK_TABLE.coil.id, 'its coil begun');
    for (; !(f.coil && f.coil.i === atk.i) && t <= atk.at + 1000; t += SERPENT_TICK_MS) stepSerpentBrain(f, t, [ship], rng);
    assert.ok(f.coil && f.coil.i === atk.i, 'wound');
    const c = f.coil, was = { x: c.x, z: c.z };
    const said = coilWord(f, 's1', 'held', c.i, c.x + d, c.z, t - SERPENT_TICK_MS);
    near(Math.hypot(c.x - was.x, c.z - was.z), d, 0.01, `moved ${d} m`);
    assert.equal(said[0]?.k, 'coil', 'the coil said where it now lies');
    const laid = said.filter((w) => w.k === 'sw').map((w) => w.l);
    if (!d) { assert.equal(laid.length, 0, 'unmoved: its round as it was'); continue; }
    assert.equal(laid.length, 2, 'a straight onto the ring and round it');
    const [line, round] = laid;
    assert.ok(line.at >= t - SERPENT_TICK_MS + SERPENT_SAY_AHEAD_MS && line.at >= c.w + COIL_BLEND_MS, 'said ahead, once the coil holds the whole body');
    assert.ok(line.v <= DASH_V, `at DASH_V at most (${line.v})`);
    assert.deepEqual([round.k, round.r, round.sd, round.v], [LEG.arc, COIL_R, -1, DRIFT_V], 'round its ring, counter-clockwise, adrift');
    const r = heldRound(f, t, c.until + 3000, [ship], rng, round.at);
    assert.ok(r.step <= DASH_V * 0.05 + 0.05, `its head swims every metre (${r.step.toFixed(2)} m in 50 ms)`);
    assert.ok(r.bearing <= 0.01, `the coil drawn turns with its head (${r.bearing.toFixed(4)} rad off)`);
    assert.ok(r.ring <= 0.05, `its head on the ring about her middle (${r.ring.toFixed(3)} m off)`);
    assert.equal(f.coil.why, 'crushed');
    near(gapAtLetGo(f), COIL_R * (1 - COIL_HEAD_IN), 0.2, 'as it lets go its head lies where an unmoved coil\'s does');
  }
});

test('AUDIT SHIPS 2 XB5 a coil holding a ship across the relay\'s deploy (a fight of an older law - AUDIT SHIPS B7) keeps her, and its head\'s round is laid again about it as this law draws it (the coil turning with its head - B6): said SERPENT_SAY_AHEAD_MS on, round its ring from where the coil drawn has gone round to; kept on the old law\'s track (a straight tangent off the ring), the coil drawn stood 78 m from its head as it let go and the body swept 102 m (mutants: the old round kept)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  const at = T0 - 3000, th = 0.5, A = SERPENT_ATTACK_TABLE.coil;
  f.atk = { i: 9, a: A.id, at, x: 0, z: 0, yw: 0, tg: [[120, 60]], until: at + A.active + A.recover, s: 's1', done: true };
  f.coil = { i: 9, s: 's1', x: 120, z: 60, th, at, until: at + 24_000, off: 0, h: 100, m: 100, held: true, why: null };
  // the old law: its head placed on the ring and swum on along its tangent
  f.legs.push({ k: LEG.line, at, x: 120 + Math.sin(th) * COIL_R, z: 60 + Math.cos(th) * COIL_R, yw: th - Math.PI / 2, v: DRIFT_V, j: 1 });
  delete f.bv;
  serpentWoke(f);
  assert.equal(f.woke, 'law');
  const said = serpentResume(f, T0);
  assert.ok(coilHolds(f, T0), 'she is kept');
  const laid = said.filter((w) => w.k === 'sw').map((w) => w.l);
  assert.equal(laid.length, 2, 'its round laid again');
  assert.ok(laid[0].at >= T0 + SERPENT_SAY_AHEAD_MS, 'said ahead');
  const r = heldRound(f, T0 + SERPENT_TICK_MS, f.coil.until + 3000, [body('s1', 120, 60)], seeded(3), laid[1].at);
  assert.ok(r.bearing <= 0.01 && r.ring <= 0.05, `round its ring as this law draws it (${r.bearing.toFixed(4)} rad, ${r.ring.toFixed(3)} m off)`);
  near(gapAtLetGo(f), COIL_R * (1 - COIL_HEAD_IN), 0.2, 'as it lets go its head lies where this law\'s own coil\'s does');
});

// ═══ THE RELAY: XB4 A GAME TOLD TO RELOAD; XB6 KEPT BEFORE IT IS SAID ═══════════════════════════════════════════════

const DAY = 363, TT = serpentTimes(DAY), PX = 205, PY = 214;
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS, CELL = cellRoomOfWire(SX, SZ);
const FIGHT = serpentFightId(DAY, serpentSiteKey(SX, SZ));
const poseAt = (mx, mz, ts) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0, ...(ts !== undefined ? { ts: ts % 2 ** 24 } : {}) });
const inWord = (bv, hl = HULL.Carrack) => JSON.stringify({ t: 'serpent', k: 'in', d: DAY, bv, lv: 20, hl, sx: SX, sz: SZ });
/** Runs `fn` with the clock at `clock.t` and the relay's dice seeded - every draw the same each run. */
async function onSeededRelay(clock, seed, fn) {
  const realNow = Date.now, realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto), rng = seeded(seed);
  try {
    Date.now = () => clock.t;
    globalThis.crypto.getRandomValues = (b) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(rng() * 2 ** (8 * b.BYTES_PER_ELEMENT)); return b; };
    return await fn();
  } finally { Date.now = realNow; globalThis.crypto.getRandomValues = realRandom; }
}

test('AUDIT SHIPS 2 XB4 a game told to reload (AUDIT SHIPS C2\'s mark) takes its share out of the health and its ship out of the count at the next beat - at the fraction it stands at, the count said to every screen - and brings both back with its `in` on the law; its share stood in both until its absence retired it, 45 s: a pair\'s survivor took every blow at a pair\'s two thirds, and the health stayed a pair\'s (mutants: a stale share wanted)', async () => {
  const clock = { t: TT.riseAt + 20_000 };
  await onSeededRelay(clock, 1, async () => {
    const r = fakeRooms({ now: () => clock.t }).room(CELL);
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', poseAt(120, 0)); await r.hello(b, 'peer-0002', poseAt(-120, 0));
    await r.raw(a, inWord(SERPENT_BRAIN_V)); await r.raw(b, inWord(SERPENT_BRAIN_V));
    const f = r.room._serpents.get(FIGHT), one = f.players['acct-peer-0001'];
    clock.t += SERPENT_TICK_MS; await r.fire();
    assert.equal(f.ships, 2, 'a pair');
    const both = f.max, frac = f.hp / f.max;
    await r.raw(b, inWord(1));   // peer-0002's game is older than the law
    assert.equal(f.players['acct-peer-0002'].stale, true);
    clock.t += SERPENT_TICK_MS; await r.fire();
    assert.equal(f.ships, 1, 'one ship at the next beat');
    const said = a.sent.filter((m) => m.t === 'serpent' && m.k === 'hp');
    assert.equal(said.at(-1).n, 1, 'the count said to her screen');
    assert.equal(fleetShare(said.at(-1).n), 1, 'her blows whole');
    near(f.max, both - one.share, 1e-6, 'its health a lone ship\'s');
    near(f.hp / f.max, frac, 1e-9, 'at the fraction it stands at');
    await r.raw(b, inWord(SERPENT_BRAIN_V));   // reloaded
    clock.t += SERPENT_TICK_MS; await r.fire();
    assert.equal(f.ships, 2, 'a pair again');
    near(f.max, both, 1e-6);
  });
  assert.equal(serpentShareWanted({ share: 10, joinedAt: 0, seenAt: 0, hitAt: 0, stale: true }, 0), false, 'the law: a stale share is not wanted');
});

/** A relay restarted mid-fight - the Room replaced over the same storage (fakeRoom wake()) `after` ms into it, its socket
 *  back `gap` ms later - her screen folding its words: the farthest its head was moved by a word. */
async function restartedOn(seed, after, gap) {
  const clock = { t: TT.riseAt + 20_000 };
  return onSeededRelay(clock, seed, async () => {
    const r = fakeRooms({ now: () => clock.t }).room(CELL);
    const a = r.connect();
    const ship = (t) => { const ang = (13 * (t - TT.riseAt)) / 1000 / 170; return [Math.sin(ang) * 170, Math.cos(ang) * 170]; };
    await r.hello(a, 'peer-0001', poseAt(...ship(clock.t), clock.t));
    await r.raw(a, inWord(SERPENT_BRAIN_V));
    const link = createSerpentLink({ now: () => clock.t, site: () => ({ day: DAY, sx: SX, sz: SZ }) });
    let read = 0;
    const drain = () => { for (; read < a.sent.length; read++) { const m = a.sent[read]; if (m.t !== 'serpent') continue; const { t, ...w } = m; void t; const v = validSerpentOut(w); if (v) link.word(v); } };
    drain();
    let lastHit = clock.t;
    const step = async (t) => {
      clock.t = t;
      if ((t - TT.riseAt) % 100 === 0) await r.pose(a, poseAt(...ship(t), t));
      if (t - lastHit >= 500) { lastHit = t; await r.raw(a, JSON.stringify({ t: 'serpent', k: 'hit', d: 4, z: ZONES.body })); }
      if (r.alarm.at != null && clock.t >= r.alarm.at) await r.fire();
    };
    const end = clock.t + after;
    for (let t = clock.t + 50; t <= end; t += 50) { await step(t); drain(); }
    r.wake();
    let worst = 0;
    for (let t = clock.t + 50; t <= end + gap + 6000; t += 50) {
      const before = headAt(link.state().legs, t);
      if (t >= end + gap) await step(t); else clock.t = t;
      drain();
      const h = headAt(link.state().legs, t);
      worst = Math.max(worst, Math.hypot(h.x - before.x, h.z - before.z));
    }
    return worst;
  });
}

test('AUDIT SHIPS 2 XB6 a relay restarted mid-fight wakes it where its screens hold it: it keeps the fight BEFORE it says a word that lays its track (serpentSaysTrack - its swim, its ride, an attack, its coil, the whirl, a turn, its end), so a short sleep\'s law (AUDIT SHIPS B1) keeps a track every screen has - 48 restarts over the checkpoint\'s two seconds, back within SERPENT_SLEEP_MS and past it, and no word moves a screen\'s head; kept every SERPENT_CHECKPOINT_MS alone, after its words had gone out, a restart woke it up to 1.25 s before its screens, and snapped a head 56 m and 185 m (mutants: kept after it is said)', async () => {
  assert.deepEqual([...SERPENT_TRACK_WORDS].sort(), ['atk', 'cb', 'coil', 'cr', 'cx', 'dv', 'fell', 'gone', 'mael', 'ph', 'sw']);
  assert.equal(serpentSaysTrack([{ k: 'hp' }, { k: 'ch' }, { k: 'st' }]), false, 'its health and its whole state lay nothing');
  let worst = 0;
  for (const gap of [1500, 7000]) for (let k = 0; k < 24; k++) worst = Math.max(worst, await restartedOn(k + 1, 14_000 + k * 1337, gap));
  assert.ok(worst <= 0.05, `no word moves a screen's head (${worst.toFixed(2)} m at worst)`);
});

// ═══ HER WAY: XB8 HER CLOCK HELD TO THE RELAY'S; XB11 NO POSE, NO WAY ═══════════════════════════════════════════════

/** A ship sailing east at 5 m/s, her poses true, sent every 100 ms and stamped by her clock run at `rate` of the
 *  relay's (`jitter` ms of it each way): the relay hands the brain her latest each beat for `ms`. Her way, read. */
function wayRead(rate, ms, jitter = 0, rng = seeded(7)) {
  const p = {};
  for (let now = T0; now <= T0 + ms; now += SERPENT_TICK_MS) {
    const sent = Math.floor((now - 40) / 100) * 100;   // her latest pose, sent 40 ms and more before the beat
    serpentWayOf(p, body('s1', (5 * (sent - T0)) / 1000, 0, Math.round(T0 + (sent - T0) * rate + (rng() - 0.5) * 2 * jitter)), now);
  }
  return Math.hypot(p.vx, p.vz);
}

test('AUDIT SHIPS 2 XB8 her sender\'s clock is held to the relay\'s (SERPENT_CLOCK_SPAN_MS, SERPENT_CLOCK_SKEW): true poses stamped by a clock run at an eighth of the relay\'s, or eight times, read no way at all - she is aimed where she lies, as a pose with no send time is - while an honest clock\'s way is read through a sender\'s jitter, and one a little off (a resync) is read; at an eighth, a ship making 5 m/s read 20, unseen by anyone, and the Maw led at her burst on an honest ship 95 m off (mutants: her clock unheld)', () => {
  near(wayRead(1, 6000), 5, 0.05, 'an honest clock');
  near(wayRead(1, 6000, 60), 5, 1, 'an honest clock, jittered 60 ms');
  assert.ok(wayRead(0.9, 6000) > 4, 'a clock a tenth slow: read');
  assert.equal(wayRead(1 / 8, 6000), 0, 'an eighth: no way');
  assert.equal(wayRead(8, 6000), 0, 'eight times: no way');
  assert.ok(SERPENT_CLOCK_SPAN_MS <= 2000, 'held within two seconds');
});

test('AUDIT SHIPS 2 XB11 no new pose of hers past SERPENT_WAY_STALE_MS of the relay\'s own clock and she is at rest: a ship hove to sends none for a heartbeat (20 s), and the brain, reading the same pose each beat, led its marks on her at her last way all that while (mutants: her way kept without a pose)', () => {
  const p = {};
  for (let now = T0; now <= T0 + 3000; now += SERPENT_TICK_MS) serpentWayOf(p, body('s1', (10 * (now - T0)) / 1000, 0, now), now);
  near(Math.hypot(p.vx, p.vz), 10, 0.05, 'making 10 m/s');
  const last = body('s1', 30, 0, T0 + 3000);
  for (let now = T0 + 3250; now <= T0 + 3000 + SERPENT_WAY_STALE_MS; now += SERPENT_TICK_MS) serpentWayOf(p, last, now);
  near(Math.hypot(p.vx, p.vz), 10, 0.05, 'her last pose a while ago: her way kept');
  serpentWayOf(p, last, T0 + 3000 + SERPENT_WAY_STALE_MS + SERPENT_TICK_MS);
  assert.equal(Math.hypot(p.vx, p.vz), 0, 'none past SERPENT_WAY_STALE_MS: at rest');
});

// ═══ THE SHIPS FIGHTING IT: XB9, XB10, XC1, XC5 ═════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS 2 XB9 a captain on a smaller warship of her own is a ship of the fight: her share taken down to hers at the fraction it stands at, a true pair two ships and its share a pair\'s; never shrunk (AUDIT SERPENT H2), she was no ship at all - her share out of its health, and the pair read as one, its blows whole (mutants: the smaller ship no ship)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  const bodies = [body('s1', 100, 0), body('s2', -100, 0)];
  stepSerpentBrain(f, T0, bodies, seeded(1));
  const frac = f.hp / f.max, both = f.max;
  joinSerpentFight(f, 's2', 'P2', 20, HULL.SmallShip, T0 + 100, true);   // her galleon now
  stepSerpentBrain(f, T0 + 250, bodies, seeded(1));
  assert.equal(f.players.s2.share, SERPENT_TTK_S * SHIP_REF[HULL.SmallShip], 'her share her galleon\'s');
  assert.equal(f.players.s2.retired, false);
  near(f.max, both - SERPENT_TTK_S * (SHIP_REF[HULL.Carrack] - SHIP_REF[HULL.SmallShip]), 1e-9);
  near(f.hp / f.max, frac, 1e-12, 'at the fraction it stands at');
  assert.equal(f.ships, 2, 'a pair');
  near(fleetShare(serpentStateOf(f).n), fleetShare(2), 1e-12, 'the pair\'s share');
  // her rowboat is no warship: her share out until she is aboard one again (AUDIT SHIPS C1)
  joinSerpentFight(f, 's2', 'P2', 20, HULL.Rowboat, T0 + 500, true);
  assert.equal(f.players.s2.retired, true);
});

test('AUDIT SHIPS 2 XB10 a coil closing on a ship lets her go at the next beat when she steps onto a friend\'s deck - a hand is never coiled (AUDIT SHIPS C1, serpentOnShip) - where a Rising Maw goes on closing; it was begun at her there (mutants: the closing\'s ship unasked)', () => {
  for (const [a, kept] of [['coil', false], ['breach', true]]) {
    const f = surfaced(fightOf([HULL.SmallShip, HULL.SmallShip]));
    f.phase = 2;
    f.closing = { a: SERPENT_ATTACK_TABLE[a].id, s: 's1', at: T0 };
    joinSerpentFight(f, 's1', 'P1', 20, -1, T0 + 100, true);   // aboard her friend's
    const said = stepSerpentBrain(f, T0 + 250, [body('s1', 400, 0), body('s2', 402, 0)], seeded(2));
    assert.equal(!!f.closing, kept, `${a}: ${kept ? 'closing still' : 'let go'}`);
    if (!kept) assert.ok(!said.some((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.coil.id && w.s === 's1'), 'no coil at a hand');
  }
});

test('AUDIT SHIPS 2 XC1 the count of the ships fighting it is said the moment it changes - a wreck, a join, a ship changed - on the health\'s own word (`hp`, its `n`), and the reply to an `in` counts it: said in the whole state alone, every SERPENT_STATE_SEND_MS, a pair\'s survivor was eased and a third ship\'s joining was not for up to 5 s (mutants: counted at the beat alone; said in the whole state alone)', () => {
  const f = surfaced(newSerpentFight(363, T0, SOUND, 'sethrakul', 0, 0, 0.4));
  for (const i of [1, 2]) joinSerpentFight(f, `acct-000${i}`, `P${i}`, 20, HULL.Carrack, T0, true);
  let clock = T0;
  const { link, hear } = screenOf(f, () => clock);
  const bodies = [body('acct-0001', 100, 0), body('acct-0002', -100, 0)];
  for (const w of stepSerpentBrain(f, T0, bodies, seeded(1))) hear(w);
  assert.equal(link.state().n, 2);
  serpentWreck(f, 'acct-0002', 1, T0 + 100);
  assert.equal(f.ships, 1, 'counted as she wrecks');
  clock = T0 + 250;
  const said = stepSerpentBrain(f, T0 + 250, bodies, seeded(1));
  assert.ok(said.some((w) => w.k === 'hp' && w.n === 1), 'said at the next beat, on its health\'s word');
  assert.ok(!said.some((w) => w.k === 'st'), 'not the whole state\'s');
  for (const w of said) hear(w);
  assert.equal(link.state().n, 1, 'her screen counts one');
  assert.equal(fleetShare(link.state().n), 1, 'her blows whole');
  joinSerpentFight(f, 'acct-0003', 'P3', 20, HULL.Carrack, T0 + 300, true);
  assert.equal(serpentStateOf(f).n, 2, 'the reply to an `in` counts the joiner');
  clock = T0 + 500;
  const next = stepSerpentBrain(f, T0 + 500, [...bodies, body('acct-0003', 0, 100)], seeded(1));
  assert.ok(next.some((w) => w.k === 'hp' && w.n === 2), 'and the next beat says it');
  assert.ok(SERPENT_HP_SEND_MS <= SERPENT_TICK_MS);
});

test('AUDIT SHIPS 2 XC5 a ship that wrecks in a coil is let go - said SERPENT_SAY_AHEAD_MS on (`cx`), as a phase\'s turn lets go, its swim taken up then - and the relay says it to every screen; held on, the wreck was gripped and crushed to the coil\'s end, 19 s, the serpent bound to her all that while (mutants: the coil kept on a wreck; the relay\'s word unsaid)', async () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  const A = SERPENT_ATTACK_TABLE.coil, at = T0 - 1000;
  f.atk = { i: 9, a: A.id, at, x: 0, z: 0, yw: 0, tg: [[120, 60]], until: at + A.active + A.recover, s: 's1', done: true };
  f.coil = { i: 9, s: 's1', x: 120, z: 60, th: 0.5, at, w: at + 500, until: at + 24_000, off: 0, h: 100, m: 100, held: true, why: null };
  const out = [];
  assert.equal(serpentWreck(f, 's1', 1, T0, out), true);
  assert.equal(coilHolds(f, T0), false, 'let go');
  assert.equal(f.coil.why, 'wreck');
  assert.deepEqual(out.filter((w) => w.k === 'cx'), [{ k: 'cx', i: 9, at: T0 + SERPENT_SAY_AHEAD_MS }], 'said ahead');
  assert.ok(out.some((w) => w.k === 'sw' && w.l.at === T0 + SERPENT_SAY_AHEAD_MS), 'its swim taken up then');
  // the relay: her wreck's word lets her coil go, and every screen hears it
  const clock = { t: TT.riseAt + 20_000 };
  await onSeededRelay(clock, 2, async () => {
    const r = fakeRooms({ now: () => clock.t }).room(CELL);
    const a = r.connect();
    await r.hello(a, 'peer-0001', poseAt(120, 0));
    await r.raw(a, inWord(SERPENT_BRAIN_V));
    const g = r.room._serpents.get(FIGHT), t = clock.t;
    g.lastTickAt = t;
    g.atk = { i: 9, a: A.id, at: t - 1000, x: 0, z: 0, yw: 0, tg: [[120, 0]], until: t + 30_000, s: 'acct-peer-0001', done: true };
    g.coil = { i: 9, s: 'acct-peer-0001', x: 120, z: 0, th: 0.5, at: t - 1000, w: t - 500, until: t + 23_000, off: 0, h: 100, m: 100, held: true, why: null };
    await r.raw(a, JSON.stringify({ t: 'serpent', k: 'wr', w: 1 }));
    assert.ok(a.sent.some((m) => m.t === 'serpent' && m.k === 'cx' && m.i === 9), 'her screen hears it let go');
    assert.equal(g.coil.why, 'wreck');
  });
});
