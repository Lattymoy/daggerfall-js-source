// SD8d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT'S BLOWS
// ON ME - each judged on my own machine (net/sdStrike.js: the Stomp's disc and its ring, jumped; the Hour-Hand outrun or
// shaded by a pillar; the Gear Volley's discs and its burning brass; the Hour's own), shown on the arena's floor (the gate's
// telegraph pass over another floor), heard, and its fall (scenes/sdRemnantBlows.js), wired into the hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_BLOWS, SD_BODY, SD_PILLARS, pulsePct, SD_RESET_PCT, SD_END_PCT, newRemnantFight, joinRemnant, remnantStateOf, behindPillar, SD_ARENA_SLACK,
} from '../src/net/sdRemnant.js';
import { sdBlowVerdict, sdVolleyPools, sdPoolUnder, SD_STRIKE_LATE_MS } from '../src/net/sdStrike.js';
import { createSdFightLink } from '../src/net/sdFightLink.js';
import { validSdOut } from '../src/net/wire.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { POOL_TICK_MS, COURT_R } from '../src/net/gateBrain.js';
import { strikeDamage, STRIKE_LATE_MS } from '../src/net/gateStrike.js';
import {
  createSdRemnantBlows, sdTelegraphShapes, sdPoolShapes, sdBlowsInFlight, SD_BLOW_COLOR, SD_BLOWS_TEXT, SD_BLOW_CUES, SD_TELEGRAPH_FLOOR, SD_ARENA_CENTRE,
} from '../src/scenes/sdRemnantBlows.js';
import { arenaToDungeon } from '../src/scenes/sdRemnant.js';
import { GateTelegraphRenderer, TELEGRAPH_KIND, TELEGRAPH_EDGE, TELEGRAPH_EDGE_DAGON, TELEGRAPH_FLASH_MS, TELEGRAPH_MARGIN, TELEGRAPH_POOL, telegraphQuadOver } from '../src/render/gateTelegraph.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const T0 = 1_800_000_000_000;
let I = 0;
const blow = (A, at, o = {}) => ({ i: ++I, a: A.id, at, x: 0, z: 0, yw: 0, tg: [], ...o });
/** Judge a blow frame by frame (`step` ms) from `from` to `to`, `grounded(t)` and where I stand `at(t)`: every strike. */
function run(atk, from, to, at, grounded = () => true, step = 20) {
  const hits = [];
  let seen = {}, done = false;
  for (let t = from; t <= to && !done; t += step) {
    const [px, pz] = at(t);
    const v = sdBlowVerdict(atk, px, pz, t - step, t, grounded(t), seen);
    seen = v.seen; done = v.done;
    for (const h of v.hits) hits.push({ ...h, t });
  }
  return hits;
}

// ── the verdicts ──────────────────────────────────────────────────────

test('SD8d THE STOMP: its disc as it lands on a body within its reach, once - never one first seen long after; its ring rolling out strikes a body ON THE GROUND as its front passes, once - a body in the air lets it pass under and is never struck after; nothing past its end (mutants: the ring on the airborne; the disc twice; a stale landing judged; the ring unbounded)', () => {
  const A = SD_BLOWS.stomp, at = T0 + 10_000;
  const s = blow(A, at);
  assert.deepEqual(sdBlowVerdict(s, 3, 0, at - 200, at - 100, true), { hits: [], seen: {}, done: false }, 'still winding up');
  assert.deepEqual(run(s, at - 1000, at + 3000, () => [3, 0]).map((h) => [h.part, h.pct, h.base]), [['disc', A.pct, A.base]], 'the disc, once - inside it the ring never reaches me');
  assert.deepEqual(run(s, at - 1000, at + 3000, () => [A.r + 0.5, 0]).map((h) => h.part), ['ring'], 'just outside the disc: the ring, at once');
  const ring = run(s, at - 1000, at + 3000, () => [12, 0]);
  assert.deepEqual(ring.map((h) => [h.part, h.pct, h.base]), [['ring', A.ringPct, A.ringBase]], 'the ring, once');
  assert.ok(Math.abs(ring[0].t - (at + ((12 - A.r) / A.wave) * 1000)) <= 80, 'as its front passes');
  assert.deepEqual(run(s, at - 1000, at + 3000, () => [12, 0], (t) => !(t > at + 300 && t < at + 750)), [], 'jumped: it passes under, and never strikes after');
  assert.deepEqual(run(s, at - 1000, at + 3000, () => [A.r1 + A.width / 2 + 0.3, 0]), [], 'past its end');
  // a landing first seen late: the disc not judged, the ring still the ground's
  const late = sdBlowVerdict(blow(A, at), 3, 0, at + SD_STRIKE_LATE_MS + 20, at + SD_STRIKE_LATE_MS + 40, true);
  assert.deepEqual([late.hits, late.seen.disc], [[], true], 'a stale landing is no strike');
  assert.equal(SD_STRIKE_LATE_MS, STRIKE_LATE_MS);
});

test('SD8d THE HOUR-HAND: its beam strikes a body it sweeps over, once, within its length - outrun, behind it, past its length or shaded by a pillar between it and where it was cast from, never (mutants: the pillar\'s shade forgotten; struck behind it; the beam twice)', () => {
  const A = SD_BLOWS.hand, at = T0 + 10_000;
  const h = blow(A, at, { sw: 1 });
  const ahead = run(h, at - 1000, at + A.active + 500, () => [0, 10]);
  assert.deepEqual(ahead.map((x) => [x.part, x.pct, x.base]), [['beam', A.pct, A.base]]);
  const edge = at + (A.active * (Math.PI / 2 - Math.asin(A.width / 2 / 10))) / Math.PI;
  assert.ok(Math.abs(ahead[0].t - edge) <= 40, 'as the beam\'s edge meets me, a little before the middle of its sweep');
  const [px, pz] = SD_PILLARS[0];
  assert.equal(behindPillar(0, 0, px * 1.25, pz * 1.25), true);
  assert.deepEqual(run(h, at - 1000, at + A.active + 500, () => [px * 1.25, pz * 1.25]), [], 'shaded by a pillar');
  assert.equal(run(h, at - 1000, at + A.active + 500, () => [px * 0.6, pz * 0.6]).length, 1, 'before the pillar: struck');
  assert.deepEqual(run(h, at - 1000, at + A.active + 500, () => [0, -10]), [], 'behind it');
  assert.deepEqual(run(h, at - 1000, at + A.active + 500, () => [0, A.len + 1]), [], 'past its length');
  // outrun: a body moving ahead of the beam (the same way it turns, faster) is never met
  const outrun = run(h, at - 1000, at + A.active + 500, (t) => { const k = Math.max(0, (t - at) / A.active); const a = -Math.PI / 2 + Math.PI * k + 0.6; return [Math.sin(a) * 8, Math.cos(a) * 8]; });
  assert.deepEqual(outrun, [], 'kept ahead of the hand');
});

test('SD8d THE GEAR VOLLEY AND THE HOUR\'S OWN: the Volley one strike however many of its discs meet me, as it lands, and its brass burning at each mark for its span; the Pulse a share of its count, the Reset and the End theirs - the whole arena, its slack, and nothing off it (mutants: a strike a disc; the pools unlaid; the Pulse not growing; the arena\'s blow reaching the Steps)', () => {
  const V = SD_BLOWS.volley, at = T0 + 10_000;
  const v = blow(V, at, { tg: [[5, 5], [6, 5]] });
  assert.deepEqual(run(v, at - 100, at + 500, () => [5.5, 5]).map((x) => [x.part, x.pct, x.base]), [['discs', V.pct, V.base]], 'two discs on me: one strike');
  assert.deepEqual(run(v, at - 100, at + 500, () => [20, 20]), []);
  const pools = sdVolleyPools(v);
  assert.deepEqual(pools.map((p) => [p.x, p.z, p.r, p.from, p.until, p.pct, p.base]), [[5, 5, V.pool.r, at, at + V.pool.ms, V.pool.pct, V.pool.base], [6, 5, V.pool.r, at, at + V.pool.ms, V.pool.pct, V.pool.base]]);
  assert.equal(sdPoolUnder(pools, 5, 7.9, at + 100)?.x, 5);
  assert.equal(sdPoolUnder(pools, 5, 7.9, at + V.pool.ms), null, 'burnt out');
  assert.equal(sdPoolUnder(pools, 5, 7.9, at - 1), null, 'not before it lands');
  assert.deepEqual(sdVolleyPools(blow(SD_BLOWS.stomp, at)), [], 'the Volley\'s alone');
  const one = (A, o = {}) => run(blow(A, at, o), at - 100, at + 300, () => [0, 0]).map((x) => [x.part, x.pct, x.base]);
  assert.deepEqual(one(SD_BLOWS.pulse, { n: 3 }), [['all', pulsePct(3), 0]], 'the Pulse grows with its count');
  assert.deepEqual(one(SD_BLOWS.reset), [['all', SD_RESET_PCT, 0]]);
  assert.deepEqual(one(SD_BLOWS.end), [['all', SD_END_PCT, 0]]);
  assert.equal(run(blow(SD_BLOWS.end, at), at - 100, at + 300, () => [0, SD_ARENA.r + SD_ARENA_SLACK - 0.5]).length, 1, 'at its rim, within the slack');   // AUDIT SD II (SD11e, PIN MOVED): L4 C2 - the arena's own slack, short of the Steps
  assert.deepEqual(run(blow(SD_BLOWS.end, at), at - 100, at + 300, () => [0, -(SD_ARENA.r + SD_ARENA_SLACK + 4)]), [], 'off the arena - on the Steps - nothing');
});

// ── the floor ─────────────────────────────────────────────────────────

test('SD8d THE FLOOR SHOWS EACH BLOW: the Stomp\'s disc filling to its landing, then its ring rolling out at its front; the Hand\'s half-circle as it gathers, then its beam where it stands in its sweep; the Volley\'s marks; the Hour\'s own over the whole floor, the Reset\'s and the End\'s in Dagon\'s edge; an Echo\'s faster; gone after its flash; the burning brass coming up and dying down (mutants: the ring left at its start; the beam not turning; the wind-up\'s share wrong)', () => {
  const at = T0 + 10_000;
  const S = SD_BLOWS.stomp;
  const [d] = sdTelegraphShapes(blow(S, at), SD_BODY.remnant, 1, at - S.windup / 2);
  assert.deepEqual([d.kind, d.r, d.t, d.flash, d.color, d.court], [TELEGRAPH_KIND.disc, S.r, 0.5, 0, SD_BLOW_COLOR.stomp, 0]);
  const rolling = sdTelegraphShapes(blow(S, at), SD_BODY.remnant, 1, at + 500);
  const ring = rolling.find((x) => x.kind === TELEGRAPH_KIND.ring);
  assert.ok(near(ring.r0, 12 - S.width / 2) && near(ring.r1, 12 + S.width / 2), 'its front at 12 m half a second on');
  assert.equal(rolling.some((x) => x.kind === TELEGRAPH_KIND.disc), false, 'the disc gone after its flash');
  assert.deepEqual(sdTelegraphShapes(blow(S, at), SD_BODY.remnant, 1, at + S.active + TELEGRAPH_FLASH_MS), [], 'all gone');
  assert.deepEqual(sdTelegraphShapes(blow(S, at), SD_BODY.remnant, 1, at - S.windup - 1), [], 'nothing before its word');
  const [e] = sdTelegraphShapes(blow(S, at), SD_BODY.gold, 2, at - Math.round(S.windup * 0.8) / 2);
  assert.ok(near(e.t, 0.5, 1e-3), 'an Echo winds up faster');
  const H = SD_BLOWS.hand;
  const [cone] = sdTelegraphShapes(blow(H, at, { yw: 0.3, sw: 1 }), SD_BODY.remnant, 1, at - H.windup / 2);
  assert.deepEqual([cone.kind, cone.r, cone.yaw, cone.halfArc, cone.t], [TELEGRAPH_KIND.cone, H.len, 0.3, H.arc / 2, 0.5]);
  const [lane] = sdTelegraphShapes(blow(H, at, { x: 1, z: 2, yw: 0, sw: 1 }), SD_BODY.remnant, 1, at + H.active / 2);
  assert.deepEqual([lane.kind, lane.halfW], [TELEGRAPH_KIND.lane, H.width / 2]);
  assert.ok(near(lane.end[0], 1) && near(lane.end[1], 2 + H.len), 'the beam ahead at the half of its sweep');
  const [late] = sdTelegraphShapes(blow(H, at, { yw: 0, sw: 1 }), SD_BODY.remnant, 1, at + H.active);
  assert.ok(near(late.end[0], H.len, 1e-6) && near(late.end[1], 0, 1e-6), 'and at its side at its end');
  const [vol] = sdTelegraphShapes(blow(SD_BLOWS.volley, at, { tg: [[1, 2], [3, 4]] }), SD_BODY.remnant, 1, at - 100);
  assert.deepEqual([vol.kind, vol.r, vol.points], [TELEGRAPH_KIND.discs, SD_BLOWS.volley.r, [[1, 2], [3, 4]]]);
  const [pul] = sdTelegraphShapes(blow(SD_BLOWS.pulse, at), SD_BODY.hour, 1, at - 100);
  const [res] = sdTelegraphShapes(blow(SD_BLOWS.reset, at), SD_BODY.remnant, 3, at - 100);
  assert.deepEqual([pul.kind, pul.edge, res.edge, res.color], [TELEGRAPH_KIND.all, TELEGRAPH_EDGE, TELEGRAPH_EDGE_DAGON, SD_BLOW_COLOR.reset]);
  // the burning brass
  const pools = sdVolleyPools(blow(SD_BLOWS.volley, at, { tg: [[1, 1], [2, 2]] }));
  assert.deepEqual(sdPoolShapes(pools, at - 1), []);
  const [p0] = sdPoolShapes(pools, at + 75);
  assert.deepEqual([p0.kind, p0.points.length, p0.alpha], [TELEGRAPH_KIND.discs, 2, 0.5], 'coming up');
  assert.equal(sdPoolShapes(pools, at + SD_BLOWS.volley.pool.ms - 500)[0].alpha, 0.5, 'dying down');
  // what is in flight
  assert.deepEqual(sdBlowsInFlight(null), []);
});

// ── the driver ────────────────────────────────────────────────────────

/** A fight heard by a real link on a clock the test turns, and the arena's blows over it. */
function rig({ at = [0, -6], alive = true, maxHealth = 200 } = {}) {
  let clock = T0 + 20_000, ground = true;
  const L = createSdFightLink({ now: () => clock });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  const struck = [], said = [], sounds = [];
  let pos = at;
  const e = { health: alive ? maxHealth : 0, maxHealth };
  const B = createSdRemnantBlows({
    link: L, audio: { play3d: (clip, p, vol, o) => sounds.push({ clip, p, vol, pitch: o.pitch }) },
    feet: () => (pos ? arenaToDungeon(pos[0], pos[1]) : null), grounded: () => ground, player: () => e,
    strike: (dmg, how) => { struck.push({ dmg, name: how.name, t: clock }); }, say: (t) => said.push(t), me: () => 'A',
  });
  return {
    L, B, struck, said, sounds, e,
    word: (w) => L.word(validSdOut(w)),
    to: (t) => { clock = t; B.frame(); },
    across: (from, to, step = 50) => { for (let t = from; t <= to; t += step) { clock = t; B.frame(); } },
    stand: (p) => { pos = p; }, air: (v) => { ground = !v; }, now: () => clock,
  };
}

test('SD8d THE DRIVER JUDGES ON MY FEET: a Stomp landing on me strikes once, its share of my own health and its base, through the door every blow lands by; its wind-up and its landing heard where it stands; jumped, its ring passes; the Hand shaded by a pillar spares me; the dead and those out of the Hour are never struck (mutants: a blow struck twice; the ring on the airborne; the dead struck)', () => {
  const S = SD_BLOWS.stomp, A0 = T0 + 21_000;
  const r = rig({ at: [0, 6] });
  r.word({ k: 'atk', b: 0, i: 5, a: S.id, at: A0, x: 0, z: 8, yw: 0, tg: [] });
  r.to(A0 - 900);
  assert.deepEqual(r.struck, [], 'still winding up');
  assert.deepEqual(r.sounds.map((x) => x.clip), [SD_BLOW_CUES.windup.stomp.clip], 'its wind-up heard at its word');
  r.across(A0 - 100, A0 + 2000);
  assert.deepEqual(r.struck.map((x) => [x.dmg, x.name]), [[strikeDamage(S.pct, 200, S.base), S.name]], 'once, my own share and its base');
  assert.ok(r.sounds.some((x) => x.clip === SD_BLOW_CUES.land.stomp.clip && x.pitch === SD_BLOW_CUES.land.stomp.pitch), 'its landing heard');
  assert.deepEqual(r.sounds[0].p, realmToDungeon(SD_ARENA.x, 3, SD_ARENA.z + 8), 'where it stands');
  // its ring: on the ground, struck; in the air as it passes, never
  const g = rig({ at: [0, 8 + 12] });
  g.word({ k: 'atk', b: 0, i: 6, a: S.id, at: A0, x: 0, z: 8, yw: 0, tg: [] });
  g.across(A0 - 100, A0 + 2000);
  assert.deepEqual(g.struck.map((x) => x.dmg), [strikeDamage(S.ringPct, 200, S.ringBase)], 'the ring, on the ground');
  const j = rig({ at: [0, 8 + 12] });
  j.word({ k: 'atk', b: 0, i: 7, a: S.id, at: A0, x: 0, z: 8, yw: 0, tg: [] });
  j.across(A0 - 100, A0 + 300);
  j.air(true); j.across(A0 + 350, A0 + 750); j.air(false);
  j.across(A0 + 800, A0 + 2000);
  assert.deepEqual(j.struck, [], 'jumped');
  // the Hand, shaded
  const H = SD_BLOWS.hand, [px, pz] = SD_PILLARS[0];
  const sh = rig({ at: [px * 1.25, pz * 1.25] });
  sh.word({ k: 'atk', b: 0, i: 8, a: H.id, at: A0, x: 0, z: 0, yw: 0, tg: [], sw: 1 });
  sh.across(A0 - 100, A0 + H.active + 500);
  assert.deepEqual(sh.struck, [], 'behind a pillar');
  sh.stand([0, 10]);
  const sh2 = rig({ at: [0, 10] });
  sh2.word({ k: 'atk', b: 0, i: 9, a: H.id, at: A0, x: 0, z: 0, yw: 0, tg: [], sw: 1 });
  sh2.across(A0 - 100, A0 + H.active + 500);
  assert.equal(sh2.struck.length, 1, 'in the open');
  // the dead and those out of the Hour
  const d = rig({ at: [0, 6], alive: false });
  d.word({ k: 'atk', b: 0, i: 10, a: S.id, at: A0, x: 0, z: 8, yw: 0, tg: [] });
  d.across(A0 - 100, A0 + 2000);
  assert.deepEqual(d.struck, [], 'the dead');
  const o = rig({ at: null });
  o.word({ k: 'atk', b: 0, i: 11, a: S.id, at: A0, x: 0, z: 8, yw: 0, tg: [] });
  o.across(A0 - 100, A0 + 2000);
  assert.deepEqual(o.struck, [], 'out of the Hour');
});

test('SD8d THE BRASS BURNS, THE HOUR STRIKES: the Volley\'s landing strikes once and lays its brass - a bite a tick, the first a tick after I stood in it, none once it burns out or I step away; the Pulse its share of its count; the Reset as it lands - said as it gathers, never once broken; the End said once and every one of its blows struck (mutants: the first bite at once; a broken Reset landing; the End said at every blow)', () => {
  const V = SD_BLOWS.volley, A0 = T0 + 21_000;
  const v = rig({ at: [4, 4] });
  v.word({ k: 'atk', b: 0, i: 20, a: V.id, at: A0, x: 0, z: 8, yw: 0, tg: [[4, 4]] });
  v.across(A0 - 100, A0 + V.pool.ms + 1000, 100);
  const bite = strikeDamage(V.pool.pct, 200, V.pool.base);
  assert.deepEqual(v.struck.map((x) => x.dmg), [strikeDamage(V.pct, 200, V.base), bite, bite, bite, bite, bite], 'its landing, then a bite a tick for its span');
  assert.deepEqual(v.struck.slice(1).map((x) => x.t - A0), [1000, 2000, 3000, 4000, 5000]);
  assert.equal(v.struck[1].name, SD_BLOWS_TEXT.burning);
  const away = rig({ at: [4, 4] });
  away.word({ k: 'atk', b: 0, i: 21, a: V.id, at: A0, x: 0, z: 8, yw: 0, tg: [[4, 4]] });
  away.across(A0 - 100, A0 + 500, 100);
  assert.ok(away.B.shapes().some((x) => x.pool === TELEGRAPH_POOL.ground && x.points.length === 1), 'the burning brass on the floor');
  away.stand([15, 15]); away.across(A0 + 600, A0 + 2500, 100);
  away.stand([4, 4]); away.across(A0 + 2600, A0 + 3700, 100);
  assert.deepEqual(away.struck.map((x) => x.t - A0), [0, 2600 + POOL_TICK_MS], 'stepped away, nothing; stepped back in, the first bite a tick after');
  // the Hour's own
  const p = rig({ at: [0, -6] });
  p.word({ k: 'atk', b: SD_BODY.hour, i: 30, a: SD_BLOWS.pulse.id, at: A0, x: 0, z: 0, yw: 0, tg: [], n: 2 });
  p.across(A0 - 200, A0 + 400);
  assert.deepEqual(p.struck.map((x) => x.dmg), [strikeDamage(pulsePct(2), 200, 0)]);
  const R = SD_BLOWS.reset;
  const rs = rig({ at: [0, -6] });
  rs.word({ k: 'ph', n: 2, at: T0 + 15_000, up: T0 + 17_500 });
  rs.word({ k: 'ph', n: 3, at: T0 + 18_000, up: T0 + 19_000 });
  rs.word({ k: 'atk', b: 0, i: 31, a: R.id, at: A0 + 8000, x: 0, z: 0, yw: 0, tg: [] });
  rs.to(A0);
  assert.deepEqual(rs.said, [SD_BLOWS_TEXT.reset(0)], 'said as it gathers');   // AUDIT SD II (L6 F7, PIN MOVED): the call counts its Hearts - none heard yet here
  rs.word({ k: 'stun', until: A0 + 9000, at: A0 + 1000 });
  rs.across(A0 + 1000, A0 + 9000, 100);
  assert.deepEqual(rs.struck, [], 'broken: it never lands');
  const rl = rig({ at: [0, -6] });
  rl.word({ k: 'ph', n: 2, at: T0 + 15_000, up: T0 + 17_500 });
  rl.word({ k: 'ph', n: 3, at: T0 + 18_000, up: T0 + 19_000 });
  rl.word({ k: 'atk', b: 0, i: 32, a: R.id, at: A0 + 8000, x: 0, z: 0, yw: 0, tg: [] });
  rl.across(A0, A0 + 9000, 100);
  assert.deepEqual(rl.struck.map((x) => x.dmg), [strikeDamage(SD_RESET_PCT, 200, 0)], 'unbroken: it lands');
  const E = SD_BLOWS.end;
  const en = rig({ at: [0, -6] });
  en.word({ k: 'atk', b: SD_BODY.hour, i: 40, a: E.id, at: A0, x: 0, z: 0, yw: 0, tg: [] });
  en.across(A0 - 1500, A0 + 500, 100);
  en.word({ k: 'atk', b: SD_BODY.hour, i: 41, a: E.id, at: A0 + 2000, x: 0, z: 0, yw: 0, tg: [] });
  en.across(A0 + 600, A0 + 2500, 100);
  assert.deepEqual(en.said, [SD_BLOWS_TEXT.end], 'said once');
  assert.deepEqual(en.struck.map((x) => x.dmg), [strikeDamage(SD_END_PCT, 200, 0), strikeDamage(SD_END_PCT, 200, 0)], 'every blow of it');
});

test('SD8d ITS FALL, AND THE FLOOR DRAWN: the fall heard and said once a fight, the damage chart from it; out of the Hour all forgotten; the floor\'s shapes drawn by the gate\'s pass over the ARENA - its centre, one floor of its radius, the quad clipped to its square - and the court\'s own unchanged by default (mutants: the court\'s radius over the arena; the fall said twice)', () => {
  const r = rig({ at: [0, -6] });
  r.word({ k: 'fell', at: T0 + 25_000, top: ['A'], n: 1, dm: [{ n: 'A', l: 30, d: 900, x: 0, h: 40, b: 30, f: 0 }] });
  r.to(T0 + 25_100);
  r.to(T0 + 25_200);
  assert.deepEqual(r.said, [SD_BLOWS_TEXT.fell], 'said once');
  assert.ok(r.sounds.some((x) => x.clip === SD_BLOW_CUES.fall.clip && x.pitch === SD_BLOW_CUES.fall.pitch), 'its body\'s thud');
  assert.equal(r.B.state().chartAt, T0 + 25_100, 'the chart from the first sight of it');
  r.B.leave();
  assert.deepEqual([r.B.state().chartAt, r.B.state().pools, r.B.shapes()], [null, [], []]);
  // drawn
  assert.equal(r.B.drawPass(null, null, null, 0), false, 'nothing to draw, no pass');
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, ZERO: 14, drawingBufferHeight: 900 }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const d = rig({ at: [0, -6] });
  const B = createSdRemnantBlows({ gl, link: d.L, feet: () => arenaToDungeon(0, -6), player: () => d.e });
  d.word({ k: 'atk', b: 0, i: 50, a: SD_BLOWS.stomp.id, at: d.now() + 500, x: 2, z: 3, yw: 0, tg: [] });
  B.frame();
  assert.equal(B.shapes().length, 1);
  const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  assert.equal(B.drawPass(I4, I4, [0, 0, 0], 1), true);
  assert.ok(calls.some((c) => c[0] === 'uniform1f' && c[1] === 'uFloorR' && c[2] === SD_ARENA.r), 'the arena\'s radius');
  assert.ok(calls.some((c) => c[0] === 'uniform3f' && c[1] === 'uCentre' && c[2] === SD_ARENA_CENTRE[0] && c[4] === SD_ARENA_CENTRE[2]), 'its centre');
  assert.ok(calls.some((c) => c[0] === 'uniform2f' && c[1] === 'uCourt' && c[2] === 0 && c[3] === 0));
  assert.deepEqual(SD_ARENA_CENTRE, realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z));
  const half = SD_ARENA.r + TELEGRAPH_MARGIN;
  assert.deepEqual(telegraphQuadOver({ kind: TELEGRAPH_KIND.all }, 0, SD_TELEGRAPH_FLOOR.courts, SD_TELEGRAPH_FLOOR.r), [-half, -half, half, half], 'the arena\'s square');
  const ch = COURT_R + TELEGRAPH_MARGIN;
  assert.deepEqual(telegraphQuadOver({ kind: TELEGRAPH_KIND.all }, 0).map((v, k) => (k < 2 ? v + ch : v - ch)).every((v) => Math.abs(v) < 1e6), true, 'the court\'s own by default');
  const pass = new GateTelegraphRenderer(gl);
  calls.length = 0;
  pass.draw(B.shapes()[0], I4, I4, [0, 0, 0], 1);
  assert.ok(calls.some((c) => c[0] === 'uniform1f' && c[1] === 'uFloorR' && c[2] === COURT_R), 'the court\'s radius when no floor is named');
});

test('SD8d THE HOSTS, by source: the world host makes the blows online beside the link - my feet in the Hour, the motor\'s ground, my entity, the dungeon context\'s strike door - frames them in the realm and forgets them out of it, and draws their floor in the dungeon arm\'s pass in the Hour (mutants: the blows never framed; their floor never drawn)', () => {
  const W = read('src/scenes/world.js');
  assert.match(W, /const sdBlows = sdFightLink \? createSdRemnantBlows\(\{/);
  assert.match(W, /feet: \(\) => \(playerSpawned && modes\?\.sdRealmSlot\?\.\(\) != null \? player\.feetAt\(\) : null\),\n\s+grounded: \(\) => !!player\.grounded,/);
  assert.match(W, /strike: \(dmg, how\) => \{ modes\?\.dungeonCtx\?\.strikePlayer\?\.\(dmg, how\); \},[^\n]*\n\s+say: \(t, everyone = false, key = null\) => \{ if \(everyone \|\| sdNearArena\(\)\) sdSay\(t, SD_VOICE_RANK\.turn, key\); \},/);   // AUDIT SD II (L6 F15, SD11d, PIN MOVED): near its arena, its fall to the whole Hour, through the Hour's voice
  assert.match(W, /if \(!inRealm && _sdFightHeld\) \{ sdFightLink\.leave\(\); sdBlows\?\.leave\(\); sdRemVoice\?\.leave\(\); _sdFightHeld = false; \}/);   // SD14a (PIN MOVED): its voice let go with it
  assert.match(W, /if \(inRealm\) \{ try \{ sdBlows\?\.frame\(\); \}/);
  assert.match(W, /drawSdTelegraph: \(\{ proj, view, eye \}\) => \{ const t = performance\.now\(\) \/ 1000, fog = courtFogNow\(\); const blows = !!sdBlows\?\.drawPass\(proj, view, eye, t, fog\), lines = !!sdSpoilsPool\?\.drawPass\(proj, view, eye, t, fog\); if \(blows \|\| lines\) renderer\.markForeignPass\(\); \},/);   // SD9e: and its spoils' loot lines, in the same pass (PIN MOVED)
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /if \(isGateArena\(dungeonLoc\)\) host\.drawGateCourt\?\.\(\{ proj, view, eye: mwv\.eye \}\);[^\n]*\n\s+if \(isSdRealm\(dungeonLoc\)\) host\.drawSdTelegraph\?\.\(\{ proj, view, eye: mwv\.eye \}\);/);
});
