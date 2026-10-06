// AUDIT SHIPS (2026-10-06, Mac: "Audit everything" - PR #634's SAIL-FREE and SERPENT3; bible/01-Overview/Audit-Ships.md):
// THE SERPENT'S HALF. Each pin is one finding, fixed at its root: A1 it leads its marks and never closes slower than the
// ship it closes on, so at SAIL-FREE's ways one ship alone still can't win and two can (Mac's call); C1 the ships fighting
// it are the shares in its health, and a ship is the hull a fighter says she is on now; C2 a game told to reload is not
// heard; B1 a short sleep stands as it was said, and a socket back beats it again; B3 the whirl forms in its waters, its
// eye to its left; B4 a Maw bursts on its mark; B5/D2 every turn of its own is said ahead, its coil wound and let go so
// too; B6 the coil drawn turns with its head; B7 a fight across the relay's deploy is taken up; C3 the pair's share
// carried blow to blow; C4 a wake's splashes paced; D3 the laws no pin could fail. Each failed on the build before it.
// tools/mutants/auditships.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newSerpentFight, joinSerpentFight, stepSerpentBrain, applySerpentHit, serpentStateOf, serpentResume, serpentWoke, serpentWreck,
  coilWord, coilHolds, pickSerpentTarget, pruneLegs, closeV, serpentWayOf, serpentLeadOf, serpentShipsFighting, serpentOnShip, maelTurnToFit,
  SERPENT_ATTACK_TABLE, SERPENT_PHASE_AT, SERPENT_TICK_MS, ZONES, ARENA_R, MAEL_ORBIT_R, CRUISE_V, DASH_V, CLOSE_V, DRIFT_V,
  SERPENT_SLEEP_MS, SERPENT_DRAWN_MS, SERPENT_SAY_AHEAD_MS, SERPENT_LEAD_MAX_MS, SERPENT_WAY_EASE_MS, SERPENT_WAY_STALE_MS, SERPENT_WAY_MAX_V,
  STUN_X, HEAD_X, GUN_REACH_M, SERPENT_POSE_SLACK, ORBIT_R, RAM_V, ramLen, serpentWrapYaw,
} from '../src/net/serpentBrain.js';
import { LEG, MODE, COIL_R, SWIM_MIN_V, headAt, bodyAt, modeAt, coilAngleAt, coilWeight } from '../src/net/serpentBody.js';
import { createSerpentLink } from '../src/net/serpentLink.js';
import { createSerpentHost, WAKE_MS, IN_CHANGE_MS } from '../src/scenes/serpentHost.js';
import { fleetShare, shipHurt, crushHurt, shapeMeets, ramHead, SERPENT_PAIR_SHARE } from '../src/systems/serpentStrike.js';
import { serpentTimes, serpentSiteKey, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../src/net/serpentLaw.js';
import { validSerpentOut, cellRoomOfWire, serpentFightId, PIXEL_UNITS } from '../src/net/wire.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { lawsOf, fleetFights, fightLine } from '../tools/serpentFleetSim.mjs';
import { fakeRooms } from './fakeRoom.mjs';

const T0 = 10_000_000;
const SOUND = T0 + 25 * 60_000;
/** A seeded [0,1) source (mulberry32). */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A body at the fight - with its pose's send time `ts` when it says one, as the relay hands it on (_serpentBodies). */
const body = (sub, x, z, ts) => ({ sub, x, z, dead: false, ...(ts !== undefined ? { ts: ts % 2 ** 24 } : {}) });
/** A fight joined by `hls`' ships as s1, s2 ... */
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
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ═══ A1: IT LEADS ITS MARKS ════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS A1 her way and her turn read off her own poses\' send times (serpentWayOf) - their change over the time her sender kept between them, eased over SERPENT_WAY_EASE_MS; the same pose again nothing new; at rest with no `ts`, past SERPENT_WAY_STALE_MS or past SERPENT_WAY_MAX_V; the clock\'s wrap read - and where she will be (serpentLeadOf), along the round she sails, never led past SERPENT_LEAD_MAX_MS nor out of its waters (mutants: no easing; the turn not held; the lead unbounded; a warp learned)', () => {
  const p = {};
  serpentWayOf(p, { x: 0, z: 0, ts: 1000 });
  assert.deepEqual([p.vx, p.vz, p.vw], [0, 0, 0], 'her first pose: at rest');
  serpentWayOf(p, { x: 0, z: 10, ts: 1000 + SERPENT_WAY_EASE_MS });
  near(p.vz, 20, 1e-9, '10 m in her own half second'); near(p.vx, 0, 1e-9);
  serpentWayOf(p, { x: 0, z: 10, ts: 1000 + SERPENT_WAY_EASE_MS });
  near(p.vz, 20, 1e-9, 'the same pose again: nothing new');
  serpentWayOf(p, { x: 0, z: 10, ts: 1000 + SERPENT_WAY_EASE_MS * 1.5 });
  near(p.vz, 10, 1e-9, 'a quarter second lying still: eased half way');
  serpentWayOf(p, { x: 0, z: 10 + SERPENT_WAY_MAX_V, ts: 1000 + SERPENT_WAY_EASE_MS * 1.5 + 900 });
  assert.equal(Math.hypot(p.vx, p.vz), 0, 'a warp is no way');
  serpentWayOf(p, { x: 0, z: 30, ts: 3000 }); serpentWayOf(p, { x: 0, z: 60, ts: 3000 + SERPENT_WAY_STALE_MS + 1 });
  assert.equal(Math.hypot(p.vx, p.vz), 0, 'nothing heard of her that long: at rest');
  const q = {};
  serpentWayOf(q, { x: 0, z: 0, ts: 2 ** 24 - 250 }); serpentWayOf(q, { x: 5, z: 0, ts: 250 });
  near(q.vx, 10, 1e-9, 'across the clock\'s wrap');
  const r = { vx: 5, vz: 5, vw: 0.1 };
  serpentWayOf(r, { x: 0, z: 0 });
  assert.deepEqual([r.vx, r.vz, r.vw], [0, 0, 0], 'no send time: aimed where she lies, as before');
  // her round: 200 m about the heart at 15 m/s, a pose every 250 ms
  const R = 200, v = 15, w = v / R, at = (k) => ({ x: R * Math.sin(w * k * 0.25), z: R * Math.cos(w * k * 0.25) });
  const f = { players: { s1: {} } };
  for (let k = 0; k <= 60; k++) serpentWayOf(f.players.s1, { ...at(k), ts: k * 250 });
  near(f.players.s1.vw, w, 0.002, 'her turn');
  const led = serpentLeadOf(f, { sub: 's1', ...at(60) }, 3000), truth = at(72);
  assert.ok(dist(led, truth) <= 0.5, `led along her round (${dist(led, truth).toFixed(2)} m off)`);
  const straight = serpentLeadOf({ players: { s1: { ...f.players.s1, vw: 0 } } }, { sub: 's1', ...at(60) }, 3000);
  assert.ok(dist(straight, truth) > 4, `led straight it misses her (${dist(straight, truth).toFixed(2)} m)`);
  const g = { players: { s1: { vx: 0, vz: 20, vw: 0 } } };
  assert.deepEqual(serpentLeadOf(g, { sub: 's1', x: 0, z: 0 }, 60_000), serpentLeadOf(g, { sub: 's1', x: 0, z: 0 }, SERPENT_LEAD_MAX_MS), 'never led past SERPENT_LEAD_MAX_MS');
  near(serpentLeadOf(g, { sub: 's1', x: 0, z: 470 }, 3000).z, ARENA_R + 60, 1e-9, 'never out of its waters');
});

/** A ship sailing straight at `v` m/s along `yw` from (x0, z0) at T0 - where she is at `t`. */
const sailing = (x0, z0, yw, v) => (t) => ({ x: x0 + Math.sin(yw) * v * (t - T0) / 1000, z: z0 + Math.cos(yw) * v * (t - T0) / 1000 });
/** Attack `A` at a ship sailing `her` - her way learned off her poses over two seconds, its own attacks held off - as
 *  the beat begins it (the closing's path: begun the beat its dash fits): the attack's word and its beat. */
function aimedAt(A, her, phase = 1) {
  const f = surfaced(fightOf([HULL.Carrack]));
  f.phase = phase;
  f.openUntil = T0 + 60_000;
  const ships = (t) => [body('s1', her(t).x, her(t).z, t)];
  run(f, T0, T0 + 2000, ships, seeded(3));
  f.closing = { a: A.id, s: 's1', at: T0 + 2250 };
  const beats = run(f, T0 + 2250, T0 + 2250 + 12_000, ships, seeded(4), (said) => said.some((x) => x.k === 'atk'));
  const atk = beats.at(-1).said.find((x) => x.k === 'atk');
  assert.ok(atk && atk.a === A.id, `${A.key} begun`);
  return { f, atk, t: beats.at(-1).t };
}

test('AUDIT SHIPS A1 every mark is laid where its ship WILL BE when it lands, her way held - the Rising Maw\'s burst and the coil\'s ring about her place at the landing, the spit\'s pool there, the tail swept at it, the ram\'s lane run down onto her; aimed where she stood, a ship under SAIL-FREE\'s full sail had sailed out of every one before it landed (mutants: each attack unled; her way never read off her poses)', () => {
  const T = SERPENT_ATTACK_TABLE;
  const her = sailing(100, 40, -Math.PI / 2, 12);   // sailing west, across its waters
  for (const [A, phase] of [[T.breach, 1], [T.coil, 2], [T.spit, 1]]) {
    const { atk } = aimedAt(A, her, phase);
    assert.ok(dist({ x: atk.tg[0][0], z: atk.tg[0][1] }, her(atk.at)) <= 1, `${A.key}: on her at the landing (${dist({ x: atk.tg[0][0], z: atk.tg[0][1] }, her(atk.at)).toFixed(2)} m; unled ${(12 * (atk.at - T0 - 2250) / 1000).toFixed(0)} m)`);
  }
  const lash = aimedAt(T.lash, her).atk;
  const p = { x: lash.tg[0][0], z: lash.tg[0][1] }, there = her(lash.at);
  near(serpentWrapYaw(Math.atan2(there.x - p.x, there.z - p.z) - lash.yw), 0, 0.01, 'the tail swept at her place as it lands');
  // the ram: its lane led by its crawl and its run's own time to her (RAM_LEAD_STEPS) - its run meets her sailing at it
  // and sailing across its lane either way (led once, one sailing on across it was missed by 18 m)
  const b = Math.atan2(20 - -50, 30 - -20);   // her bearing from its head as it turns on her
  for (const yw of [b + Math.PI, b + Math.PI / 2, b - Math.PI / 2]) {
    const course = sailing(20, 30, yw, 12), ram = aimedAt(T.ram, course).atk;
    let run = Infinity;
    for (let t = ram.at; t <= ram.at + T.ram.active; t += 10) { const h = ramHead(ram, t); if (h) run = Math.min(run, dist({ x: h[0], z: h[1] }, course(t))); }
    assert.ok(run <= 1, `sailing ${yw.toFixed(2)}: its run onto her (${run.toFixed(2)} m at the nearest)`);
  }
});

test('AUDIT SHIPS A1 it closes on a ship no slower than CLOSE_GAIN_V over her way (closeV - CLOSE_V at the least, DASH_V at the most): a ship running before it at 20 m/s is surged on at 28, where at a fixed CLOSE_V she outsailed every surge and its Maw was begun once a fight (mutants: the fixed surge; the gain lost; the cap lost)', () => {
  const f = fightOf([HULL.Carrack]);
  const at = (vz) => { f.players.s1.vx = 0; f.players.s1.vz = vz; return closeV(f, { sub: 's1' }); };
  assert.equal(at(0), CLOSE_V, 'a ship lying still: CLOSE_V');
  // AUDIT 2 XD6 (2026-10-06): the law's own figures - read off CLOSE_GAIN_V itself, a gain of 6 passed as well as 8
  near(at(17.7), 25.7, 1e-9, 'a galleon at full sail in a 2 m/s wind');
  assert.equal(at(30), DASH_V, 'never past its dash');
  assert.equal(closeV(f, null), CLOSE_V);
  // the beat: a ship 300 m ahead of its head running north at 20 m/s
  const g = surfaced(fightOf([HULL.Carrack]));
  g.legs = [{ k: LEG.line, at: T0 - 1000, x: 0, z: -11, yw: 0, v: CRUISE_V }];
  g.openUntil = T0 + 60_000;
  const her = sailing(0, 300, 0, 20);
  const ships = (t) => [body('s1', her(t).x, her(t).z, t)];
  run(g, T0, T0 + 2000, ships, seeded(1));
  g.closing = { a: SERPENT_ATTACK_TABLE.breach.id, s: 's1', at: T0 + 2250 };
  const beats = run(g, T0 + 2250, T0 + 6000, ships, seeded(2));
  const surge = beats.flatMap((b) => b.said).filter((x) => x.k === 'sw').map((x) => x.l.v);
  assert.ok(surge.length > 0 && surge.every((v) => Math.abs(v - 28) <= 0.5), `surged at 28 m/s (${surge.join(', ')})`);
});

test('AUDIT SHIPS A1 one ship alone still can\'t, and two can (Mac\'s call: "Two or more ships") at the ways SAIL-FREE gives a ship circling under full sail - against the relay\'s own brain over whole fights (tools/serpentFleetSim.mjs), at the measured 38% gunnery a lone galleon wins at most one fight in twelve circling at 17.7, 21.2 and 26.5 m/s (a galleon in a 2 m/s wind, a Carrack in one, a galleon in a storm), and a pair eight at 13.3 m/s and ten at 17.7; aimed where she stood and closed on at 20 m/s, a lone galleon won every fight from 15.5 m/s (mutants: unled marks; the fixed surge; the pair\'s share lost)', async () => {
  const laws = await lawsOf();
  for (const v of [17.7, 21.2, 26.5]) {
    const r = fleetFights(laws, { ships: 1, hit: 0.38, v, seeds: 12 });
    assert.ok(r.wins <= 1, fightLine(r));
  }
  for (const [v, wins] of [[13.3, 8], [17.7, 10]]) {
    const r = fleetFights(laws, { ships: 2, hit: 0.38, v, seeds: 12 });
    assert.ok(r.wins >= wins, fightLine(r));
  }
});

// ═══ C1: THE SHIPS FIGHTING IT ═════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS C1 the ships fighting it are the shares standing in its health (serpentShipsFighting - its state\'s `n`, the pair\'s share): a lone galleon with a rowboat by is one ship and takes her blows whole; a true pair with a rowboat by is two; a hand who sighted it from her own ship and rides a friend\'s deck is no ship - her share out of its health until she is aboard again, at the fraction it stands at - and never coiled (serpentOnShip: the hull she says now); a rowboat\'s wreck is a wreck, no longer gone at (mutants: the hull claim counted; a retired share counted; the ratchet read as aboard; a rowboat\'s wreck dropped)', () => {
  const rng = seeded(1);
  const lone = surfaced(fightOf([HULL.SmallShip, HULL.Rowboat]));
  stepSerpentBrain(lone, T0, [body('s1', 100, 0), body('s2', 110, 0)], rng);
  assert.equal(lone.ships, 1, 'a galleon and a rowboat: one ship');
  assert.equal(fleetShare(serpentStateOf(lone).n), 1, 'her blows whole');
  assert.equal(serpentWreck(lone, 's2', 1, T0 + 100), true, 'the rowboat wrecked');
  assert.equal(lone.players.s2.wreck, true);
  assert.equal(pickSerpentTarget(lone, [body('s2', 110, 0)], rng), null, 'a wreck is not gone at');
  const pair = surfaced(fightOf([HULL.SmallShip, HULL.SmallShip, HULL.Rowboat]));
  stepSerpentBrain(pair, T0, [body('s1', 100, 0), body('s2', -100, 0), body('s3', 0, 120)], rng);
  assert.equal(pair.ships, 2, 'a pair and a rowboat: two ships');
  near(fleetShare(serpentStateOf(pair).n), SERPENT_PAIR_SHARE, 1e-12, 'the pair\'s share');
  // the rider: her own ship's share brought, then her `in` from the captain's deck
  const ride = surfaced(fightOf([HULL.SmallShip, HULL.SmallShip]));
  const both = ride.max, frac = ride.hp / ride.max;
  joinSerpentFight(ride, 's2', 'P2', 20, -1, T0 + 100, true);
  assert.equal(ride.players.s2.aboard, false);
  assert.equal(ride.players.s2.retired, true, 'her share out of its health');
  near(ride.max, both - ride.players.s2.share, 1e-9);
  near(ride.hp / ride.max, frac, 1e-12, 'at the fraction it stands at');
  stepSerpentBrain(ride, T0 + 250, [body('s1', 100, 0), body('s2', 100, 2)], rng);
  assert.equal(ride.ships, 1, 'one ship');
  assert.equal(serpentShipsFighting(ride), 1);
  assert.equal(serpentOnShip(ride.players.s2), false, 'a hand now');
  for (let i = 0; i < 20; i++) assert.equal(pickSerpentTarget(ride, [body('s2', 100, 2)], seeded(i), true), null, 'never coiled');
  joinSerpentFight(ride, 's2', 'P2', 20, HULL.SmallShip, T0 + 500, true);
  stepSerpentBrain(ride, T0 + 500, [body('s1', 100, 0), body('s2', -100, 0)], rng);
  assert.equal(ride.players.s2.retired, false, 'aboard her own again: her share back');
  near(ride.max, both, 1e-9);
  assert.equal(ride.ships, 2, 'a pair again');
  assert.equal(serpentOnShip(ride.players.s2), true);
  // a captain in her rowboat is a boat: the coil may take it
  const boat = surfaced(fightOf([HULL.SmallShip]));
  joinSerpentFight(boat, 's1', 'P1', 20, HULL.Rowboat, T0 + 100, true);
  assert.equal(serpentOnShip(boat.players.s1), true, 'in her rowboat, on a boat');
  assert.equal(boat.players.s1.aboard, false, 'and her galleon\'s share out');
});

/** The host over a link in the site's own frame - my ship at (60, 0) - its `in` words kept. */
function clientRig({ online = false } = {}) {
  let now = 50_000_000;
  const strikes = [], fx = [], said = [];
  const sw = { day: 363, site: { sx: 0, sz: 0 }, phase: 'hunt', t: { soundAt: now + 25 * 60_000 } };
  const link = createSerpentLink({ now: () => now, site: () => ({ day: 363, sx: 0, sz: 0 }) });
  const ship = { boat: { id: 'mine' }, hull: HULL.Carrack, root: [60, 0], pos: [60, 0, 0], yaw: 0, hl: 25, hw: 7, maxHull: 1200, maxSail: 600, atHelm: true, wrecked: false };
  let mine = ship;
  const host = createSerpentHost({
    now: () => now, link, omen: { swimming: () => sw },
    online: { ready: () => online, send: (m) => { said.push(m); return true; }, acct: () => 'acct-0001' },
    toScene: (sx, sz, x, z) => [x, z], toSite: (sx, sz, x, z) => [x, z], seaY: () => 0,
    feet: () => [60, 1, 0], level: () => 20, boat: () => mine,
    strike: (b, hurt) => strikes.push({ b, hurt }), hurt: () => {},
    say: () => {}, mid: () => {}, sound: () => {}, fx: (k, p) => fx.push([k, p]),
  });
  const hear = (w) => { const v = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(v, `the wire passes ${w.k}`); link.word(v); };
  return { host, link, hear, strikes, fx, said, at: () => now, step: (ms) => { now += ms; return host.frame(); }, board: (b) => { mine = b === 'mine' ? ship : b; } };
}
/** A whole state off the brain's own fight, as the wire projects it. */
function stateOf(now, n) {
  const f = newSerpentFight(363, now, now + 25 * 60_000, 'sethrakul', 0, 0, 0);
  joinSerpentFight(f, 'acct-0001', 'Ama', 20, 4, now, true);
  const st = validSerpentOut(serpentStateOf(f));
  return n === undefined ? st : { ...st, n };
}

test('AUDIT SHIPS C1 on the client: the `in` is said again AT ONCE when the ship I stand on changes - off her deck, back aboard - not IN_RESEND_MS later (AUDIT 2 XC7: and never sooner than IN_CHANGE_MS after the last): what I am aboard is what keeps my share in its health, and twenty seconds of a share that is not fighting is twenty seconds of a pair\'s share wrong (mutants: the change unread)', () => {
  const R = clientRig({ online: true });
  R.host.frame();
  R.hear(stateOf(R.at()));
  R.step(100);
  const ins = () => R.said.filter((m) => m.k === 'in').map((m) => m.hl);
  assert.deepEqual(ins(), [HULL.Carrack], 'said once');
  R.step(100);
  assert.deepEqual(ins(), [HULL.Carrack], 'not again while nothing changes');
  // PIN MOVED (AUDIT 2 XC7, 2026-10-06): at once - but never sooner than IN_CHANGE_MS after the last (a hull flapping each
  // frame said sixty a second and the cell's bucket dropped my volleys)
  R.board(null); R.step(100);
  assert.deepEqual(ins(), [HULL.Carrack], 'off her deck 200 ms after the last: held');
  R.step(IN_CHANGE_MS - 100);
  assert.deepEqual(ins(), [HULL.Carrack, -1], 'off her deck: said as IN_CHANGE_MS passes');
  R.board('mine'); R.step(IN_CHANGE_MS);
  assert.deepEqual(ins(), [HULL.Carrack, -1, HULL.Carrack], 'aboard again: said at once');
});

// ═══ C2: A GAME TOLD TO RELOAD ═════════════════════════════════════════════════════════════════════════════════════

const DAY = 363, TT = serpentTimes(DAY), PX = 205, PY = 214;
const SX = (PX + 0.5) * PIXEL_UNITS, SZ = (499 - PY + 0.5) * PIXEL_UNITS, CELL = cellRoomOfWire(SX, SZ);
const pose = (mx, mz) => ({ x: SX + mx * SERPENT_NATIVE_PER_M, y: 0, z: SZ + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0 });
const inWord = (bv) => JSON.stringify({ t: 'serpent', k: 'in', d: DAY, bv, lv: 20, hl: HULL.Carrack, sx: SX, sz: SZ });
/** A relay cell with a fight born of peer-0001's `in`, its body lying beside her (100 m east of its heart, she at 120). */
async function relayFight(clock) {
  const r = fakeRooms({ now: () => clock.t }).room(CELL);
  const a = r.connect(); await r.hello(a, 'peer-0001', pose(120, 0));
  await r.raw(a, inWord(SERPENT_BRAIN_V));
  const fight = r.room._serpents.get(serpentFightId(DAY, serpentSiteKey(SX, SZ)));
  fight.legs = [{ k: LEG.line, at: clock.t - 1000, x: 100, z: 0, yw: Math.PI / 2, v: 2 }];
  fight.modes = [{ at: clock.t - 60_000, m: MODE.cruise }];
  fight.lastTickAt = clock.t;
  return { r, a, fight };
}

test('AUDIT SHIPS C2 a game before the brain\'s law is told to reload - and its account is then not heard nor gone at in the fight it is in until it says an `in` on the law: its volleys spend nothing, its body is no target; a fight read back across the relay\'s deploy kept its fighters, whose old tabs drew the new law\'s whirl at the heart and took a pair\'s blows whole, and fought on (mutants: the mark not set; its words heard; its body counted; the mark never cleared)', async () => {
  const realNow = Date.now; const clock = { t: TT.riseAt + 20_000 };
  try {
    Date.now = () => clock.t;
    const { r, a, fight } = await relayFight(clock);
    const me = fight.players['acct-peer-0001'];
    await r.raw(a, inWord(1));
    assert.deepEqual(a.sent.filter((m) => m.t === 'serpent').at(-1), { t: 'serpent', k: 'no', m: 'reload' });
    assert.equal(me.stale, true, 'marked');
    assert.equal(r.room._serpentBodies(fight).length, 0, 'not gone at');
    clock.t += 1000; fight.lastTickAt = clock.t;
    await r.raw(a, JSON.stringify({ t: 'serpent', k: 'hit', d: 30, z: ZONES.body }));
    assert.equal(me.dealt, 0, 'its volley not heard');
    await r.raw(a, inWord(SERPENT_BRAIN_V));
    assert.equal(me.stale, undefined, 'reloaded: heard again');
    assert.equal(r.room._serpentBodies(fight).length, 1);
    clock.t += 1000; fight.lastTickAt = clock.t;
    await r.raw(a, JSON.stringify({ t: 'serpent', k: 'hit', d: 30, z: ZONES.body }));
    assert.ok(me.dealt > 0, 'its volley lands');
  } finally { Date.now = realNow; }
});

test('AUDIT SHIPS A1 the relay hands the brain each fighter\'s pose with its send time (`ts` - _serpentBodies), which her way is read off; a pose that says none is aimed where it lies (mutants: the send time dropped)', async () => {
  const realNow = Date.now; const clock = { t: TT.riseAt + 20_000 };
  try {
    Date.now = () => clock.t;
    const { r, a, fight } = await relayFight(clock);
    await r.pose(a, { ...pose(121, 0), ts: 4321 });
    assert.equal(r.room._serpentBodies(fight)[0].ts, 4321, 'her send time handed on');
    clock.t += 100;
    await r.pose(a, pose(122, 0));
    assert.equal('ts' in r.room._serpentBodies(fight)[0], false, 'none said, none handed on');
  } finally { Date.now = realNow; }
});

// ═══ B1: A SHORT SLEEP ═════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS B1 a fight its room slept no longer than SERPENT_DRAWN_MS (every screen still drawing it as it was said - scenes/serpentHost.js SERPENT_HEARD_MS) is NOT taken up from its last beat: what was said stands - its attack in flight kept, its track untouched - and a head swum out past its waters meanwhile turns for home from the moment its word can reach them, never from its last beat; taken up from its last beat, every screen still drawing it snapped its head back as far as 148 m (mutants: the short sleep taken up; home from its last beat)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  const beats = run(f, T0, T0 + 30_000, [body('s1', 90, 60)], seeded(5), (said) => said.some((w) => w.k === 'atk'));
  const atk = f.atk, legs = JSON.stringify(f.legs), t0 = beats.at(-1).t;
  assert.ok(atk);
  const slept = t0 + SERPENT_SLEEP_MS + 2000;
  assert.ok(slept - t0 <= SERPENT_DRAWN_MS);
  assert.deepEqual(serpentResume(f, slept), [], 'nothing said');
  assert.equal(f.atk, atk, 'its attack in flight kept');
  assert.equal(JSON.stringify(f.legs), legs, 'its track as it was said');
  // its head out past its waters by the time its word can come: home from then
  const g = surfaced(fightOf([HULL.Carrack]));
  const out0 = [{ k: LEG.line, at: T0 - 1000, x: 0, z: 380, yw: 0.5, v: CRUISE_V }];
  g.legs = JSON.parse(JSON.stringify(out0));
  g.lastTickAt = T0;
  const now = T0 + 9000, from = now + SERPENT_SAY_AHEAD_MS;
  const before = headAt(g.legs, from);
  assert.ok(Math.hypot(before.x, before.z) > ARENA_R + 60, 'swum out meanwhile');
  const out = serpentResume(g, now);
  const sw = out.filter((w) => w.k === 'sw').map((w) => w.l);
  assert.equal(sw.length, 1, 'one turn said');
  assert.deepEqual([sw[0].at, sw[0].k, sw[0].r, sw[0].v], [from, LEG.arc, ORBIT_R, CRUISE_V], 'a round home from when its word can reach a screen');
  const h = headAt(g.legs, from);
  near(dist(h, before), 0, 0.02, 'no leap');
  const c = { x: h.x + sw[0].sd * ORBIT_R * Math.cos(h.yw), z: h.z - sw[0].sd * ORBIT_R * Math.sin(h.yw) };   // its round's centre
  assert.ok(-h.x * (c.x - h.x) - h.z * (c.z - h.z) > 0, 'its round turns it toward its waters\' heart');
  for (let t = T0; t < from; t += 100) near(dist(headAt(g.legs, t), headAt(out0, t)), 0, 1e-9, 'nothing it swam before then moved');
  // a fight beaten on time is never taken up, though its head be swum out past its waters (its beat steers it home)
  const k = surfaced(fightOf([HULL.Carrack]));
  k.legs = JSON.parse(JSON.stringify(out0));
  k.lastTickAt = T0 + 8000;
  assert.deepEqual(serpentResume(k, T0 + 8000 + SERPENT_SLEEP_MS), [], 'within SERPENT_SLEEP_MS of its beat: nothing');
});

test('AUDIT SHIPS B1 a socket back at its fight beats it again at once - its hello arms the beat while a fight it hears lives; the beat was armed by a serpent word alone, so a fighter back from a dropped socket left it asleep until her next word, and the sleep\'s resume drew her serpent somewhere else (mutants: the hello arms nothing)', async () => {
  const realNow = Date.now; const clock = { t: TT.riseAt + 20_000 };
  try {
    Date.now = () => clock.t;
    const { r, a } = await relayFight(clock);
    assert.ok(r.alarm.at <= clock.t + SERPENT_TICK_MS, 'beating');
    await r.drop(a);
    clock.t += SERPENT_TICK_MS;
    await r.fire();
    assert.ok(r.alarm.at > clock.t + 60_000, 'nobody hears it: asleep');
    clock.t += 1500;
    const b = r.connect(); await r.hello(b, 'peer-0001', pose(120, 0));
    assert.ok(r.alarm.at !== null && r.alarm.at <= clock.t + SERPENT_TICK_MS, 'her socket back: beating again');
  } finally { Date.now = realNow; }
});

// ═══ B3: THE WHIRL IN ITS WATERS ═══════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS B3/D3 the Maelstrom forms in its waters wherever it turns - heads out to its waters\' rim heading every way: its eye always within ARENA_R - MAEL_ORBIT_R, its head on its round at the forming, counter-clockwise, swum to without a leap; its eye MAEL_ORBIT_R to its LEFT wherever that lies in its waters; drawn in so near that no turn and straight met its round (its head inside it), the round about its head where it stood lay out of them - a seventh of the third phase\'s turns, its eye up to 437 m out (maelTurnToFit) (mutants: the head\'s own round; the eye to its right; the turn not to fit)', () => {
  /** The least turn to its left alone that fits it (the fix's first form, which swam up to a whole round). */
  const leftFit = (h) => {
    const R = 30, cx = h.x - Math.cos(h.yw) * R, cz = h.z + Math.sin(h.yw) * R;
    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 90) {
      const yw = h.yw - a, px = cx + Math.cos(yw) * R, pz = cz - Math.sin(yw) * R, d = Math.hypot(px - Math.cos(yw) * MAEL_ORBIT_R, pz + Math.sin(yw) * MAEL_ORBIT_R);
      if (d <= ARENA_R - MAEL_ORBIT_R) return a;
    }
    return Infinity;   // none fits
  };
  let inner = 0, turned = 0, righted = 0;
  for (const rr of [0, 150, 300, 380, 420]) for (let a = 0; a < 8; a++) for (let y = 0; y < 8; y++) {
    const hx = Math.sin(a * Math.PI / 4) * rr, hz = Math.cos(a * Math.PI / 4) * rr, yw = y * Math.PI / 4;
    const g = surfaced(fightOf([HULL.Carrack]));
    g.legs = [{ k: LEG.line, at: T0 - 5000, x: hx - Math.sin(yw) * 55, z: hz - Math.cos(yw) * 55, yw, v: 11 }];
    g.phase = 2; g.hp = g.max * SERPENT_PHASE_AT[1] - 1;
    const said = stepSerpentBrain(g, T0, [body('s1', 150, 0)], seeded(7));
    const atk = said.find((w) => w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.mael.id);
    assert.ok(atk, 'the whirl begun at the turn');
    const [ex, ez] = atk.tg[0];
    assert.ok(Math.hypot(ex, ez) <= ARENA_R - MAEL_ORBIT_R + 0.05, `head (${hx.toFixed(0)}, ${hz.toFixed(0)}) heading ${yw.toFixed(2)}: its eye ${Math.hypot(ex, ez).toFixed(2)} m out (its legs' centimetres)`);
    near(dist(headAt(g.legs, atk.at), { x: ex, z: ez }), MAEL_ORBIT_R, 0.1, 'its head on its round at the forming');
    assert.equal(said.filter((w) => w.k === 'sw').at(-1).l.sd, -1, 'counter-clockwise');
    assert.ok(!said.some((w) => w.k === 'sw' && w.l.j), 'no leap');
    const h1 = headAt(g.legs, T0 + SERPENT_SAY_AHEAD_MS);
    const lx = h1.x - Math.cos(h1.yw) * MAEL_ORBIT_R, lz = h1.z + Math.sin(h1.yw) * MAEL_ORBIT_R;
    if (Math.hypot(lx, lz) <= ARENA_R - MAEL_ORBIT_R - 1) { inner++; near(dist({ x: ex, z: ez }, { x: lx, z: lz }), 0, 0.05, 'its eye to its left'); }
    const fit = maelTurnToFit(h1);
    if (fit.a > 0) { turned++; if (fit.sd > 0) righted++; assert.ok(fit.a <= leftFit(h1) + 1e-9, 'whichever side turns it less'); }
  }
  assert.ok(inner >= 60 && turned >= 10 && righted >= 5, `every case met (${inner} to its left as it is, ${turned} turned to fit, ${righted} of them to the right)`);
});

// ═══ B4: THE MAW ON ITS MARK ═══════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS B4 a Rising Maw at a ship close ahead bursts on its mark: a way its wind-up could swim at a cruise is swum at the one pace that fills it, rise and all - its head on the mark at the landing, never past it before - and no farther past than the slowest it swims (SWIM_MIN_V) could carry it; dashed and risen at CRUISE_V it was swum early and rose on past her mark until the landing (27 m past a ship 8 m ahead) (mutants: the cruise rise kept; the pace floor lost)', () => {
  const A = SERPENT_ATTACK_TABLE.breach;
  const floor = (SWIM_MIN_V * (A.windup - SERPENT_SAY_AHEAD_MS)) / 1000;
  for (const d of [8, 12, 16, 20, 30, 45, 60]) {
    const f = surfaced(fightOf([HULL.Carrack]));
    f.legs = [{ k: LEG.line, at: T0 - 5000, x: 0, z: -55, yw: 0, v: CRUISE_V }];   // heading north, at (0, 0) at T0
    f.closing = { a: A.id, s: 's1', at: T0 };
    const said = stepSerpentBrain(f, T0, [body('s1', 0, d)], seeded(1));
    const atk = said.find((w) => w.k === 'atk');
    assert.ok(atk && atk.a === A.id, `begun at ${d} m`);
    const off = Math.hypot(atk.tg[0][0], atk.tg[0][1] - d);
    assert.ok(off <= floor + 0.05, `${d} m ahead: its burst ${off.toFixed(2)} m from her (the floor's ${floor.toFixed(1)})`);
    if (d >= 12) near(off, 0, 0.05, `${d} m ahead: on her`);
    if (d >= 12) for (let t = T0 + SERPENT_SAY_AHEAD_MS; t < atk.at - 100; t += 100) assert.ok(headAt(f.legs, t).z < d - 0.05, `not past her before the landing (${t - T0} ms)`);
  }
});

// ═══ B5/D2: EVERY TURN OF ITS OWN SAID AHEAD ═══════════════════════════════════════════════════════════════════════

/** Whole fights - two ships circling at `v` m/s and firing, on the beat and between beats (a blow is judged as it comes),
 *  on the coil while it holds (its head a seventh of the time), the coiled ship's word at the landing on her own machine,
 *  slain or sounding - folded by a client at each of `lags` (ms late): how far each drew its head from the relay's at the
 *  same moment, every 10 ms, and its whole body (its depth and its coil with it) every 50 ms. PIN MOVED (AUDIT 2 XB1/XD5,
 *  2026-10-06): its step against the relay's own step in a 50 ms frame, at 150 ms and 13 m/s ships, read 0.028 m while
 *  the head was drawn 0.15 m off - a sideways snap keeps its step's length, and a frame dilutes it. */
function laggedFights(lags, { seeds = 6, v = 26.5 } = {}) {
  const worst = lags.map((lag) => ({ lag, head: 0, body: 0 }));
  for (let seed = 1; seed <= seeds; seed++) {
    const rng = seeded(seed), dice = seeded(seed + 50);
    const sound = seed % 2 ? T0 + 4 * 60_000 : SOUND;
    const f = newSerpentFight(363, T0, sound, 'sethrakul', 0, 0, 0.4);
    [HULL.Carrack, HULL.SmallShip].forEach((hl, i) => joinSerpentFight(f, acct(i), `P${i}`, 20, hl, T0, true));
    surfaced(f);
    let clock = T0;
    const screens = lags.map((lag) => ({ lag, inbox: [], link: createSerpentLink({ now: () => clock, site: () => ({ day: f.day, sx: 0, sz: 0 }) }) }));
    const hear = (link, w) => { const ok = validSerpentOut(w.k === 'st' ? w : { ...w, sx: 0, sz: 0 }); assert.ok(ok, `the wire passes ${w.k}`); link.word(ok); };
    for (const s of screens) hear(s.link, serpentStateOf(f));
    const say = (t, ws) => { for (const w of ws) for (const s of screens) s.inbox.push({ due: t + s.lag, w }); };
    const coils = new Map();
    const ships = [0, 1].map((i) => ({ a: i * 3.1, r: 160 + 70 * i, dir: i ? -1 : 1 }));
    const foot = (i) => { const s = ships[i]; return { sub: acct(i), x: Math.sin(s.a) * s.r, z: Math.cos(s.a) * s.r, yw: s.a + s.dir * Math.PI / 2, hl: 30, hw: 8, dead: false }; };
    const fire = (t) => { for (let i = 0; i < 2; i++) {
      const z = coilHolds(f, t) && seed % 3 ? ZONES.coil : dice() < 0.15 ? ZONES.head : ZONES.body;   // every third fight lets its coils crush
      say(t, applySerpentHit(f, acct(i), seed % 2 ? 4 : 9, z, foot(i), t));
    } };
    for (let t = T0; t < T0 + 9 * 60_000 && !(f.fell && t > f.fell.at + 8000) && !(f.gone && t > sound + 8000); t += 10) {
      clock = t;
      for (const s of ships) s.a += (s.dir * v * 0.01) / s.r;
      if ((t - T0) % SERPENT_TICK_MS === 0) {
        const said = stepSerpentBrain(f, t, [0, 1].map((i) => ({ ...foot(i), ts: t })), rng);
        say(t, said);
        for (const w of said) if (w.k === 'atk' && w.a === SERPENT_ATTACK_TABLE.coil.id) coils.set(w.i, w);
        for (const [i, a] of coils) {
          if (t < a.at) continue;
          coils.delete(i);
          const k = [0, 1].find((j) => acct(j) === a.s);
          if (k === undefined) continue;
          const ft = foot(k);
          say(t, coilWord(f, a.s, shapeMeets(a, ft, a.at) ? 'held' : 'esc', a.i, ft.x, ft.z, t));
        }
        if ((t - T0) % 500 === 0) fire(t);
      }
      if ((t - T0) % 500 === 120) fire(t);   // AUDIT 2 XB2: between beats - a kill there too
      for (const s of screens) while (s.inbox.length && s.inbox[0].due <= t) hear(s.link, s.inbox.shift().w);
      const r = headAt(f.legs, t), rb = (t - T0) % 50 === 0 ? bodyAt(f, t) : null;
      screens.forEach((s, i) => {
        const c = headAt(s.link.state().legs, t);
        worst[i].head = Math.max(worst[i].head, Math.hypot(c.x - r.x, c.z - r.z));
        if (rb) { const cb = bodyAt(s.link.state(), t); for (let j = 0; j < rb.length; j++) worst[i].body = Math.max(worst[i].body, Math.hypot(cb[j].x - rb[j].x, cb[j].y - rb[j].y, cb[j].z - rb[j].z)); }
      });
    }
    assert.ok(f.fell || f.gone, `seed ${seed}: the fight ended`);
  }
  return worst;
}

test('AUDIT SHIPS B5/D2 every turn of its own is said SERPENT_SAY_AHEAD_MS ahead - its throes and its sounding, the cry\'s and the roar\'s rearing, a change of pace, every attack\'s ride and its settling back, the whirl\'s rearing, a coil\'s letting go (crushed, broken, slipped) and its winding drawn from when its word has come (`w`) - PIN MOVED (AUDIT 2 XB1/XB2/XD5, 2026-10-06): and its steering\'s turns and its closing surge (closeOn), and the kill\'s throes and the letting go laid from then alone, a blow judged between beats - so through whole fights, slain and sounded, ships circling at 26.5 m/s, a client any wire\'s time short of it late (150, 250 and 450 ms) draws the relay\'s head and body to the millimetre, and one past it does not; said at the beat, its kill mid-dash snapped a lagging head 3.6 m, a surge 1.4 m, a spit\'s rise 8.5 m up and a coil\'s winding 2 m, its closing\'s turns 0.8 m at 150 ms and 2.2 m at 250, and a kill between beats 3.2 m (mutants: each said at the beat)', () => {
  const [a, b, c, late] = laggedFights([150, 250, 450, 650]);
  // its body to the centimetre - a leg begins where the last left the head, rounded to it (roundLeg), and a client lets
  // go of a leg as its tail leaves it, so a tail on the very joint may be drawn from either side of it (AUDIT SERPENT S2)
  for (const w of [a, b, c]) assert.ok(w.head <= 0.001 && w.body < 0.01, `${w.lag} ms late: its head drawn ${w.head.toFixed(4)} m and its body ${w.body.toFixed(4)} m from the relay's`);
  assert.ok(late.head > 0.5 && late.body > 0.5, `a client past it does see it (${late.head.toFixed(2)} m and ${late.body.toFixed(2)} m at ${late.lag} ms)`);
});

// ═══ B6: THE COIL DRAWN TURNS WITH ITS HEAD ════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS B6 the coil drawn turns with its head (serpentBody.js coilAngleAt): its head goes round the ring under her counter-clockwise at DRIFT_V, as the coil lies, and the drawn coil\'s bearing is its head\'s every moment it holds - held where it was let go; clockwise and drawn still, the track\'s body lay across the ring from the coil\'s and swept over her ship as it wound and let go (mutants: the round the wrong way; the coil drawn still; turned on past its letting go)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  f.phase = 2; f.pending = 'coil'; f.threat = { s1: 5 };
  const ship = body('s1', 250, -40);
  const beats = run(f, T0, T0 + 20_000, [ship], seeded(4), (said) => said.some((w) => w.k === 'atk'));
  const atk = beats.at(-1).said.find((w) => w.k === 'atk');
  run(f, beats.at(-1).t + SERPENT_TICK_MS, atk.at + 300, [ship], seeded(5));
  const c = f.coil;
  assert.ok(c && c.i === atk.i, 'wound');
  const [cx, cz] = atk.tg[0];
  for (let t = c.at; t <= c.at + 12_000; t += 500) {
    const h = headAt(f.legs, t);
    near(Math.abs(serpentWrapYaw(Math.atan2(h.x - cx, h.z - cz) - coilAngleAt(c, t))), 0, 0.01, `the drawn coil's bearing its head's at +${t - c.at} ms`);
  }
  near(coilAngleAt(c, c.at + 10_000), c.th - (DRIFT_V * 10) / COIL_R, 1e-9, 'counter-clockwise at DRIFT_V');
  // let go: held where it was let go
  const out = coilWord(f, 's1', 'esc', c.i, 0, 0, c.at + 100);
  assert.ok(out.some((w) => w.k === 'cx'));
  near(coilAngleAt(c, c.off + 5000), coilAngleAt(c, c.off), 1e-12, 'held where it was let go');
});

// ═══ B7: A FIGHT ACROSS THE DEPLOY ═════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS B7 a fight checkpointed by a brain before this law (no `bv`, or an older one - a relay deployed mid-fight) is stamped with this law as it wakes and TAKEN UP at its next beat, however short its sleep: its attack in flight let go, its swim to come (the old law\'s leaps and words-at-the-beat) swum no more; a fight of this law wakes as it slept (mutants: the old fight honoured; every fight taken up)', () => {
  const f = surfaced(fightOf([HULL.Carrack]));
  delete f.bv;
  f.atk = { i: 9, a: SERPENT_ATTACK_TABLE.breach.id, at: T0 + 2000, x: 0, z: 0, yw: 0, tg: [[300, 0]], until: T0 + 5000, s: 's1' };
  f.legs.push({ k: LEG.line, at: T0 + 1500, x: 300, z: 0, yw: 0, v: CRUISE_V, j: 1 });   // the old Maw's leap, still to come
  serpentWoke(f);
  assert.deepEqual([f.bv, f.woke], [SERPENT_BRAIN_V, 'law'], 'stamped, and marked to be taken up');
  const out = serpentResume(f, T0 + 300);
  assert.equal(f.atk, null, 'its attack let go');
  assert.ok(!f.legs.some((l) => l.j && l.at > T0), 'the leap to come swum no more');
  assert.ok(out.some((w) => w.k === 'sw'), 'its swim said again');
  assert.equal(f.woke, undefined);
  assert.deepEqual(serpentResume(f, T0 + 400), [], 'once');
  const g = surfaced(fightOf([HULL.Carrack]));
  serpentWoke(g);
  assert.equal(g.woke, undefined, 'a fight of this law');
  assert.deepEqual(serpentResume(g, T0 + 300), [], 'wakes as it slept');
});

// ═══ C3: THE PAIR'S SHARE, CARRIED ═════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS C3 the pair\'s share is carried blow to blow (shipHurt/crushHurt `carry`): over a pair\'s fight a ship\'s crew, hull and canvas lost are two thirds of the whole\'s - thirty spits take twenty men, three lashes four - where rounded a blow at a time a one-man blow took the whole man and a two-man one one; the whole rounded as it always was, its carry untouched; the host carries it a day (mutants: rounded a blow at a time; the carry dropped)', () => {
  const T = SERPENT_ATTACK_TABLE, whole = { maxHull: 672, maxSail: 256 }, k = SERPENT_PAIR_SHARE;
  for (const [A, n, men] of [[T.spit, 30, 20], [T.lash, 3, 4], [T.breach, 9, 12], [T.roar, 6, 4]]) {
    const carry = { hull: 0, sail: 0, crew: 0 };
    const sum = { hull: 0, sail: 0, crew: 0 };
    for (let i = 0; i < n; i++) { const h = shipHurt(A, whole, k, carry); sum.hull += h.hull; sum.sail += h.sail; sum.crew += h.crew; }
    assert.equal(sum.crew, men, `${n} ${A.key}s: ${men} men`);
    near(sum.hull, n * (A.hull * whole.maxHull + A.base) * k, 0.5, `${A.key}: its hull`);
    near(sum.sail, n * A.sail * whole.maxSail * k, 0.5, `${A.key}: its canvas`);
  }
  const carry = { hull: 0, sail: 0, crew: 0 };
  assert.deepEqual(shipHurt(T.spit, whole, 1, carry), shipHurt(T.spit, whole), 'the whole as it was');
  assert.deepEqual(carry, { hull: 0, sail: 0, crew: 0 }, 'its carry untouched');
  const c2 = { hull: 0, sail: 0, crew: 0 };
  assert.equal(crushHurt(whole, k, c2).crew + crushHurt(whole, k, c2).crew + crushHurt(whole, k, c2).crew, 8, 'three crushes of four men: eight');
  // the host: three spits on my ship, a pair at the fight - two men
  const R = clientRig();
  R.host.frame();
  R.hear(stateOf(R.at(), 2));
  for (let i = 0; i < 3; i++) {
    R.hear({ k: 'atk', i: 10 + i, a: T.spit.id, at: R.at() + 1000, x: 0, z: 0, yw: 0, tg: [[60, 0]] });
    R.step(1050); R.step(2000);
  }
  assert.equal(R.strikes.length, 3);
  assert.equal(R.strikes.reduce((s, x) => s + x.hurt.crew, 0), 2, 'two men of three');
});

// ═══ C4: A WAKE'S SPLASHES PACED ═══════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS C4 a wake\'s splashes come at most every WAKE_MS of the fight\'s clock, however fast the screen draws - its bow wave as it dashes under, and the ram\'s down its lane; one a frame was 1,874 particles a second at 144 fps, the sea\'s whole budget while it dashed, and the guns\' spray went first (mutants: one a frame)', () => {
  const W = clientRig();
  W.host.frame();
  const t = W.at();
  W.hear({ ...stateOf(t), legs: [{ k: LEG.line, at: t - 100, x: 0, z: 0, yw: 0, v: DASH_V }], modes: [{ at: t - 60_000, m: MODE.deep }] });
  for (let i = 0; i < 288; i++) W.step(1000 / 144);
  const n = W.fx.filter(([k]) => k === 'wake').length;
  assert.ok(n >= Math.floor(2000 / WAKE_MS) - 1 && n <= Math.ceil(2000 / WAKE_MS) + 1, `dashing two seconds at 144 fps: ${n} splashes`);
  const M = clientRig();
  M.host.frame();
  const t2 = M.at();
  M.hear({ ...stateOf(t2), legs: [{ k: LEG.line, at: t2 - 100, x: 60, z: -150, yw: 0, v: RAM_V }], modes: [{ at: t2 - 5000, m: MODE.deep }] });
  M.hear({ k: 'atk', i: 5, a: SERPENT_ATTACK_TABLE.ram.id, at: t2 - 100, x: 60, z: -150, yw: 0, tg: [[60, -150], [60, -150 + 100]] });
  for (let i = 0; i < 144; i++) M.step(1000 / 144);
  const m = M.fx.filter(([k]) => k === 'wake').length;
  assert.ok(m <= Math.ceil(1000 / WAKE_MS) + 1, `the ram's run a second at 144 fps: ${m} splashes`);
  // and the ram's wake is its run's - it runs on down its lane past my ship once it has struck her (it was the ram's
  // judging's, and stopped there)
  const S = clientRig();
  S.host.frame();
  const t3 = S.at();
  S.hear({ ...stateOf(t3), legs: [{ k: LEG.line, at: t3 - 100, x: 60, z: -60, yw: 0, v: RAM_V }], modes: [{ at: t3 - 5000, m: MODE.deep }] });
  S.hear({ k: 'atk', i: 6, a: SERPENT_ATTACK_TABLE.ram.id, at: t3 - 100, x: 60, z: -60, yw: 0, tg: [[60, -60], [60, -60 + ramLen()]] });
  let struck = -1;
  for (let i = 0; i < 180; i++) { S.step(1000 / 60); if (struck < 0 && S.strikes.length) struck = S.fx.length; }
  assert.ok(struck >= 0, 'the ram struck her');
  const after = S.fx.slice(struck).filter(([k]) => k === 'wake');
  assert.ok(after.length >= 10, `its wake runs on down its lane (${after.length} splashes after it struck)`);
  assert.ok(after.at(-1)[1][2] > 30, 'past her');
});

// ═══ D3: THE LAWS NO PIN COULD FAIL ════════════════════════════════════════════════════════════════════════════════

/** Its body running east at 20 m/s, reared, and a ship off its tail's end: in its guns' reach half a second ago, past
 *  it now - a blow on it is judged back then (SERPENT_HIT_LOOKBACK_MS). */
function lookedBack() {
  const f = surfaced(fightOf([HULL.Carrack]));
  const T = T0 + 5000;
  f.legs = [{ k: LEG.line, at: T0 - 60_000, x: -1200, z: 0, yw: Math.PI / 2, v: 20 }];
  f.modes = [{ at: T0 - 60_000, m: MODE.rear }, { at: T - 200, m: MODE.cruise }];
  const tail = bodyAt(f, T - 500).at(-1);
  const reach = GUN_REACH_M + SERPENT_POSE_SLACK;
  const ship = { x: tail.x - reach + 4, z: tail.z };
  return { f, T, ship };
}

test('AUDIT SHIPS D3 a blow judged back at its moment (SERPENT_HIT_LOOKBACK_MS) is judged THERE whole: its stun read then (a stun that has ended by its word still counts the blow struck within it) and its head\'s rearing read then (a head reared then counts though it has settled since) (mutants: the stun read at the word; the head read at the word)', () => {
  const plain = lookedBack();
  applySerpentHit(plain.f, 's1', 4, ZONES.body, plain.ship, plain.T);
  const d0 = plain.f.players.s1.dealt;
  assert.ok(d0 > 0, 'judged back then');
  const stun = lookedBack();
  stun.f.stunUntil = stun.T - 200;   // stunned when it struck, not when its word came
  applySerpentHit(stun.f, 's1', 4, ZONES.body, stun.ship, stun.T);
  near(stun.f.players.s1.dealt, d0 * STUN_X, 1e-9, 'stunned when it struck');
  const head = lookedBack();
  applySerpentHit(head.f, 's1', 4, ZONES.head, head.ship, head.T);
  near(head.f.players.s1.dealt, d0 * HEAD_X, 1e-9, 'its head reared when it struck');
  assert.equal(modeAt(head.f.modes, head.T), MODE.cruise, 'settled by its word');
});

test('AUDIT SHIPS D3 a closing on a ship that wrecks is let go at the next beat - nothing dashed at a wreck (mutants: closed on a wreck)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.Carrack]));
  f.openUntil = T0 + 60_000;
  const bodies = [body('s1', 0, 420), body('s2', -300, -100)];
  f.closing = { a: SERPENT_ATTACK_TABLE.breach.id, s: 's1', at: T0 };
  run(f, T0, T0 + 500, bodies, seeded(2));
  assert.ok(f.closing, 'closing on her');
  serpentWreck(f, 's1', 1, T0 + 600);
  const said = run(f, T0 + 750, T0 + 5000, bodies, seeded(3)).flatMap((b) => b.said);
  assert.equal(f.closing, null, 'let go');
  assert.ok(!said.some((w) => w.k === 'atk' && w.s === 's1'), 'nothing at the wreck');
});

test('AUDIT SHIPS D3 the relay keeps the track a blow is judged on: each beat lets go only the legs its body no longer lies along SERPENT_HIT_LOOKBACK_MS back - the body a second ago is the body it was (mutants: pruned to the beat)', () => {
  const f = surfaced(fightOf([HULL.Carrack, HULL.SmallShip]));
  const rng = seeded(11);
  let worst = 0;
  for (let t = T0; t < T0 + 120_000; t += SERPENT_TICK_MS) {
    const back = t - 1000, before = bodyAt(f, back).map((p) => ({ ...p }));
    stepSerpentBrain(f, t, [body('s1', Math.sin(t / 9000) * 200, Math.cos(t / 9000) * 200, t), body('s2', -150, 60, t)], rng);
    const after = bodyAt(f, back);
    for (let i = 0; i < after.length; i++) worst = Math.max(worst, Math.hypot(after[i].x - before[i].x, after[i].z - before[i].z));
    void pruneLegs;
  }
  assert.ok(worst <= 1e-6, `the body a second back unchanged by the beat (${worst} m)`);
});
