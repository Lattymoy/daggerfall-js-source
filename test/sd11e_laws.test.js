// SD11e (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II): THE
// ARC'S SECOND AUDIT, THE PURE LAWS AND THE BALANCE - each fix as it stands. The Dragon Break's paired Hour-Hand never a
// pincer (the escape search on the real law's worst geometry, at the weakest build); the End believing the blows of its
// wind-up and nothing past its moment, beat or no beat; the Stomp's disc and ring each its own, its ring judged where its
// front's centre crosses on that frame's ground, and neither it nor the beam judged over a stale span; the Hearts never in
// the Remnant's body, and their ring as wide as their count; the Hand's way shown as it gathers, and its range its beam's;
// nobody on the Steps; the words and the comments the docs lens read.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newRemnantFight, joinRemnant, stepRemnant, applyRemnantHit, applyEchoHit, applyHeartHit, remnantStateOf, heartsOpen,
  handSwept, behindPillar, windupFor, blowsFor, pairWay, heartCountFor, heartRingFor, inArena, arenaOf, ringPassed,
  SD_BLOWS, SD_BODY, SD_ECHO, SD_REM, SD_HEART, SD_HEARTS, SD_HEARTS_CLOSE_MS, SD_PILLARS, SD_PHASE_AT, SD_OPENING_MS,
  SD_ARENA_SLACK,
} from '../src/net/sdRemnant.js';
import { sdBlowVerdict, SD_STRIKE_LATE_MS } from '../src/net/sdStrike.js';
import { createSdFightLink, sdHourOver } from '../src/net/sdFightLink.js';
import { validSdOut } from '../src/net/wire.js';
import { SD_PILLAR_W } from '../src/net/sdBrain.js';
import { sdRiddleText, sdRiddleHolds, sdHour } from '../src/net/sdBrain.js';
import { sdNameOf, sdRoll, SD_NAMES } from '../src/net/sdLaw.js';
import { sdSalt } from '../src/systems/sdSite.js';
import { HIT_KINDS, dpsRef, MELEE_REACH } from '../src/net/gateBrain.js';
import { runSpeed, JUMP_SPEED, GRAVITY, CAPSULE_RADIUS } from '../src/player/motor.js';
import { createSdRemnant, remnantOpenAt } from '../src/scenes/sdRemnant.js';
import { sdTelegraphShapes } from '../src/scenes/sdRemnantBlows.js';
import { remnantBarModel, SD_BAR_TEXT } from '../src/ui/sdRemnantBar.js';
import { TELEGRAPH_KIND } from '../src/render/gateTelegraph.js';
import { SD_STEPS_COURSE } from '../src/world/sdSteps.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };

// ── the paired Hour-Hand (L4 F2) ───────────────────────────────────────

const HAND = SD_BLOWS.hand, HAND_W = windupFor(HAND, 2, SD_BODY.gold), FRAME = 1000 / 60, REACT = 250;
const inPillar = (x, z) => SD_PILLARS.some(([px, pz]) => Math.abs(x - px) < SD_PILLAR_W / 2 + CAPSULE_RADIUS && Math.abs(z - pz) < SD_PILLAR_W / 2 + CAPSULE_RADIUS);
/** Whether a body at `start` running to `wp` from REACT ms after the word (at `v` m/s, then standing) lives through both
 *  beams - each judged every 1/60 s at its exact place, shaded per caster; the pillars, the casters' bodies and the
 *  arena's edge walls it may not pass (pair5.mjs's search, one waypoint). */
function lives(atks, start, wp, v) {
  let [x, z] = start, t = -HAND_W, prev = t, to = wp;
  while (t < HAND.active) {
    const nt = t + FRAME;
    if (nt + HAND_W >= REACT && to) {
      const d = Math.hypot(to[0] - x, to[1] - z), step = (v * FRAME) / 1000;
      if (d <= step) { [x, z] = to; to = null; } else { x += ((to[0] - x) / d) * step; z += ((to[1] - z) / d) * step; }
    }
    if (inPillar(x, z) || atks.some((a) => Math.hypot(x - a.x, z - a.z) < SD_ECHO.r + CAPSULE_RADIUS) || Math.hypot(x, z) > 26 - CAPSULE_RADIUS) return false;
    if (nt >= 0) for (const a of atks) if (handSwept(a, x, z, Math.max(prev, 0), nt) && !behindPillar(a.x, a.z, x, z)) return false;
    prev = nt; t = nt;
  }
  return true;
}
/** The escapes from `start`: every waypoint of a metre's grid on the arena a run to which lives. */
function escapes(atks, start, v) {
  const out = [];
  for (let x = -25; x <= 25; x++) for (let z = -25; z <= 25; z++) if (Math.hypot(x, z) <= 25.4 && !inPillar(x, z) && lives(atks, start, [x, z], v)) out.push([x, z]);
  return out;
}
const weakest = runSpeed(10, 0), byDefault = runSpeed(50, 30);

test('SD11e THE PAIRED HOUR-HAND IS NO PINCER (L4 F2): a solo at the arena\'s south end, where the Steps deliver everyone, when the Dragon Break begins - the real law\'s first pair Hand has both Echoes at it from beyond, and silver turns gold\'s way: the two beams cross it the same way, and a run escapes them at the weakest build (Speed 10, Running 0); with silver the other way, as it was, no run escapes even the default build. A fighter BETWEEN the two keeps them turning opposite ways - the same pincer the other way round, both turned one way (mutants: silver always the other way; always gold\'s way)', () => {
  let s = 4242;
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  f.hp = SD_PHASE_AT[0] * f.max - 1;   // the Break due at the wake
  const at = [0, -23], bodies = [{ sub: 'a', x: at[0], z: at[1], dead: false }];
  let hands = null;
  for (let now = T0 + SD_OPENING_MS; now < T0 + 30_000 && !hands; now += 250) {
    const h = stepRemnant(f, now, bodies, rng).filter((x) => x.k === 'atk' && x.a === HAND.id);
    if (h.length === 2) hands = h;
  }
  assert.ok(hands, 'the pair\'s Hand');
  const [g, sv] = hands[0].b === SD_BODY.gold ? hands : [hands[1], hands[0]];
  const aim = (h) => Math.atan2(at[0] - h.x, at[1] - h.z);
  assert.ok(near(Math.sin(aim(g) - g.yw), 0, 0.01) && near(Math.sin(aim(sv) - sv.yw), 0, 0.01), 'both at the one fighter');
  assert.deepEqual([g.sw, sv.sw, g.at === sv.at], [1, 1, true], 'from both at once, silver gold\'s way');
  assert.equal(pairWay(g, sv, { x: at[0], z: at[1] }), 1);
  const atks = [g, sv].map((h) => ({ at: 0, x: h.x, z: h.z, yw: h.yw, sw: h.sw }));
  assert.ok(escapes(atks, at, weakest).length > 0, 'a run escapes at the weakest build');
  const was = atks.map((a, k) => ({ ...a, sw: k ? -1 : 1 }));
  assert.deepEqual(escapes(was, at, byDefault), [], 'the old pincer: no run escaped even the default build');
  // between them: silver the other way, as it always was
  const G = { x: -5, z: 0 }, S = { x: 5, z: 0 }, T = { x: 0, z: 0 };
  assert.equal(pairWay(G, S, T), -1);
  assert.equal(pairWay(G, S, null), -1, 'no fighter: the other way');
  const pair = (sw) => [G, S].map((c, k) => ({ at: 0, x: c.x, z: c.z, yw: Math.atan2(T.x - c.x, T.z - c.z), sw: k ? sw : 1 }));
  assert.ok(escapes(pair(pairWay(G, S, T)), [T.x, T.z], weakest).length > 0, 'between: a run escapes at the weakest build');
  assert.deepEqual(escapes(pair(1), [T.x, T.z], weakest), [], 'both one way: none');
});

// ── the End (L4 F3, F4) ────────────────────────────────────────────────

/** The Last Moment, its last 30 points: two fighters standing in the arena. */
function lastMoment() {
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0); joinRemnant(f, 'b', 'B', 30, T0);
  f.phase = 3; f.hp = 30; f.rem.x = 0; f.rem.z = 0;
  return f;
}
const two = [{ sub: 'a', x: 3, z: 3, dead: false }, { sub: 'b', x: -3, z: 3, dead: false }];

test('SD11e THE END BELIEVES ITS WIND-UP (L4 F3): the End\'s word stops the bodies 2 s before it lands - and a finishing blow in those 2 s fells it (it landed nothing: the race to the wire lost its last two seconds); nobody new comes in from the word; from its moment, nothing - and the page believes the same: counted in, its blow goes out through the wind-up and not at the End, the bar counting it down until then (mutants: the word refusing blows; the page refusing from the word; the bar ended at the word)', () => {
  const f = lastMoment();
  const word = stepRemnant(f, f.endsAt - 2000, two, () => 0.5);
  assert.ok(f.ended && f.rem.atk === null && f.rem.mv === null, 'said, and the body stopped');
  assert.ok(word.some((x) => x.k === 'atk' && x.a === SD_BLOWS.end.id && x.at === f.endsAt));
  assert.equal(joinRemnant(f, 'n', 'N', 30, f.endsAt - 1500), false, 'nobody new from the word');
  const g = lastMoment();
  stepRemnant(g, g.endsAt - 2000, two, () => 0.5);
  assert.equal(applyRemnantHit(g, 'a', 40, HIT_KINDS.Spell, { x: 3, z: 3 }, g.endsAt - 1, 1), 30, 'a finishing blow a moment before it lands');
  assert.ok(g.fell && g.fell.at === g.endsAt - 1);
  const h = lastMoment();
  stepRemnant(h, h.endsAt - 2000, two, () => 0.5);
  assert.equal(applyRemnantHit(h, 'a', 40, HIT_KINDS.Spell, { x: 3, z: 3 }, h.endsAt, 1), 0, 'at its moment, nothing');
  // the page: counted in, the End said - its blow goes out through the wind-up, never at the End
  let clock = T0;
  const L = createSdFightLink({ now: () => clock });
  const p = lastMoment();
  p.op = T0;
  L.word(validSdOut({ ...remnantStateOf(p), me: 1 }));
  for (const w of stepRemnant(p, p.endsAt - 2000, two, () => 0.5)) { const v = validSdOut(w); if (v) L.word(v); }
  const sent = [];
  const set = createSdRemnant({ link: () => L, sendBlow: (k, x) => { sent.push({ k, ...x }); return true; } });
  clock = p.endsAt - 1500;
  assert.ok(L.state().ended === p.endsAt && !sdHourOver(L.state(), clock), 'its word heard');
  assert.deepEqual([L.joined(), remnantOpenAt(L.state(), clock), !!set.target()], [true, true, true], 'in its wind-up: a body my blows meet');
  assert.equal(set.hit({ d: 40, r: HIT_KINDS.Spell }), true, 'and a blow out');
  assert.equal(remnantBarModel(L.state(), clock).wrath, SD_BAR_TEXT.endsIn('0:02'), 'the bar still counts it down');
  clock = p.endsAt;
  assert.deepEqual([L.joined(), remnantOpenAt(L.state(), clock), set.target(), set.hit({ d: 40, r: HIT_KINDS.Spell })], [false, false, null, false], 'at the End, nothing');
  assert.equal(remnantBarModel(L.state(), clock).wrath, SD_BAR_TEXT.ended, 'and the bar says so');
  assert.equal(sent.length, 1);
});

test('SD11e NOTHING PAST THE END, BEAT OR NO BEAT (L4 F4): a realm whose beat stalled before the End (its last beat 2.1 s short, so no word said it) believes no blow after the Hour\'s moment - on the Remnant, an Echo or a Heart - where a blow 3 s past it felled the Remnant and minted receipts (mutants: each refusal by the beat\'s word alone)', () => {
  const f = lastMoment();
  stepRemnant(f, f.endsAt - 2100, two, () => 0.5);
  assert.equal(f.ended, null, 'no beat has said it');
  assert.equal(applyRemnantHit(f, 'a', 40, HIT_KINDS.Spell, { x: 3, z: 3 }, f.endsAt + 3000, 1), 0);
  assert.equal(f.fell, null);
  assert.ok(applyRemnantHit(f, 'a', 10, HIT_KINDS.Spell, { x: 3, z: 3 }, f.endsAt - 100, 2) > 0, 'before it, a blow');
  // an Echo
  const e = newRemnantFight(4, 1, T0);
  joinRemnant(e, 'a', 'A', 30, T0);
  e.hp = SD_PHASE_AT[0] * e.max - 1;
  stepRemnant(e, T0 + SD_OPENING_MS, [{ sub: 'a', x: 0, z: -12, dead: false }], seeded(2));
  assert.equal(e.phase, 2);
  e.ec[0].up = 0; e.endsAt = T0 + SD_OPENING_MS + 1000;
  assert.deepEqual(applyEchoHit(e, 'a', 0, 10, HIT_KINDS.Spell, { x: 0, z: -12 }, e.endsAt + 3000, 1), []);
  assert.equal(e.players.a.ed ?? 0, 0);
  // a Heart, still open by the Reset's own clock
  const r = lastMoment();
  r.hp = 0.3 * r.max; r.outUntil = 0; r.resetAt = T0 + SD_OPENING_MS;
  stepRemnant(r, T0 + SD_OPENING_MS, two, seeded(4));
  assert.ok(r.cx, 'the Hearts');
  const t = T0 + SD_OPENING_MS + 1000;
  assert.equal(heartsOpen(r, t), true);
  r.endsAt = t - 1;
  const [q] = r.cx.c;
  assert.deepEqual(applyHeartHit(r, 'a', 0, 1e6, HIT_KINDS.Spell, { x: q.x, z: q.z }, t, 1), []);
  assert.equal(r.cx.c[0].h, r.cx.m, 'unbroken');
});

// ── the Stomp's ring, the beam's span (L4 F5, F6, F7) ───────────────────

const STOMP = SD_BLOWS.stomp;
let I = 0;
const blow = (A, at, o = {}) => ({ i: ++I, a: A.id, at, x: 0, z: 0, yw: 0, tg: [], ...o });
/** Every strike a blow lands, judged frame by frame (`step` ms) where I stand `d(t)` metres out along +x, on the ground
 *  as `grounded(t)` says. */
function strikes(atk, from, to, d, grounded = () => true, step = 1000 / 60) {
  const out = [];
  let seen = {}, done = false;
  for (let t = from; t <= to && !done; t += step) {
    const v = sdBlowVerdict(atk, d(t), 0, t - step, t, grounded(t), seen);
    seen = v.seen; done = v.done;
    for (const h of v.hits) out.push(h.part);
  }
  return out;
}

test('SD11e THE STOMP\'S DISC AND ITS RING EACH THEIR OWN (L4 F5): a body 6.4-7 m out at the landing took the disc and the ring both (80% and 22) - the near-miss at the rim the heaviest hit of all; now the ring rolls out from the disc\'s rim: within it the disc, past it the ring, never both (mutants: the ring\'s band inside the disc)', () => {
  const at = T0 + 10_000;
  for (const d of [3, 6.3, 6.5, 6.9, 7]) assert.deepEqual(strikes(blow(STOMP, at), at - 500, at + 2000, () => d), ['disc'], `${d} m: the disc`);
  for (const d of [7.05, 7.1, 7.6]) assert.deepEqual(strikes(blow(STOMP, at), at - 500, at + 2000, () => d), ['ring'], `${d} m: the ring`);
  assert.equal(ringPassed(blow(STOMP, at), 6.5, at - 16, at + 16), false, 'its band never inside the disc');
});

test('SD11e THE RING IS JUMPED RUNNING OUT WITH IT (L4 F7): judged at the frame its front\'s centre crosses me, on that frame\'s ground - its whole band, on any grounded frame inside it, rode over a body running out at 7-10 m/s longer than a jump stays aloft; now a jump clears it at every speed, at 60 and 30 frames a second; standing it strikes once, and a body running IN through it at a run is struck once, whatever frame it crosses in (mutants: the band judged whole; the frame before forgotten)', () => {
  let n = 0, y = 0, vy = JUMP_SPEED;
  do { vy -= GRAVITY / 60; y += vy / 60; n++; } while (y > 0);
  const air = (n / 60) * 1000, at = 0;
  for (const fps of [60, 30]) for (const d0 of [7.5, 10]) for (let u = 6.5; u <= 10.01; u += 0.5) {
    let cleared = false;
    for (let tj = -600; tj <= 1600 && !cleared; tj += 1000 / 60) cleared = strikes(blow(STOMP, at), 0, 1600, (t) => d0 + (u * t) / 1000, (t) => !(t >= tj && t < tj + air), 1000 / fps).length === 0;
    assert.ok(cleared, `${fps} fps, ${d0} m out, running out at ${u.toFixed(1)} m/s: a jump clears it`);
  }
  assert.deepEqual(strikes(blow(STOMP, at), 0, 2000, () => 12), ['ring'], 'standing: once');
  for (let k = 0; k < 12; k++) {
    const d0 = 20 + k * 0.05;
    assert.deepEqual(strikes(blow(STOMP, at), 0, 2000, (t) => Math.max(0, d0 - (byDefault * t) / 1000)), ['ring'], `running in from ${d0.toFixed(2)} m: once`);
  }
});

test('SD11e NO ROLLING PART OVER A STALE SPAN (L4 F6): a span from before a Stomp\'s landing to 2.5 s after it (a tab hidden across it) is no ring, and one into a Hand to 4.9 s no beam - done, with no hit, as the gate\'s rolling charge is; a span ending inside SD_STRIKE_LATE_MS of its end is still judged (mutants: the ring and the beam judged over any span)', () => {
  const at = T0 + 10_000, H = SD_BLOWS.hand;
  const ring = sdBlowVerdict(blow(STOMP, at), 12, 0, at - 100, at + 2500, true);
  assert.deepEqual([ring.hits, ring.done], [[], true]);
  const beam = sdBlowVerdict(blow(H, at, { sw: 1 }), 0, 15, at - 100, at + 4900, true);
  assert.deepEqual([beam.hits, beam.done], [[], true]);
  assert.deepEqual(sdBlowVerdict(blow(STOMP, at), 12, 0, at + 100, at + STOMP.active + SD_STRIKE_LATE_MS, true).hits.map((h) => h.part), ['ring'], 'inside the bound: judged');
  assert.deepEqual(sdBlowVerdict(blow(H, at, { sw: 1 }), 0, 15, at - 100, at + H.active + SD_STRIKE_LATE_MS, true).hits.map((h) => h.part), ['beam']);
});

// ── the Hearts (L4 F8, F9) ─────────────────────────────────────────────

/** The Reset called with `n` living standing about `rem` (the Remnant's place), on seed `seed`: its Hearts. */
function resetHearts(n, rem, rng) {
  const f = newRemnantFight(4, 1, T0);
  const subs = Array.from({ length: n }, (_, k) => `p${k}`);
  for (const sub of subs) joinRemnant(f, sub, sub, 30, T0);
  f.phase = 3; f.hp = 0.3 * f.max; f.outUntil = 0; f.resetAt = T0 + SD_OPENING_MS;
  f.rem.x = rem[0]; f.rem.z = rem[1];
  const bodies = subs.map((sub) => ({ sub, x: rem[0] + 3, z: rem[1], dead: false }));
  const cx = stepRemnant(f, T0 + SD_OPENING_MS, bodies, rng).find((x) => x.k === 'cx');
  return { f, cx, rem: [f.rem.x, f.rem.z] };
}

test('SD11e NO HEART IN THE REMNANT\'S BODY (L4 F8): over 300 Resets with the Remnant standing on the Hearts\' own ring, never a Heart within SD_REM.r + SD_HEART.r + 1 of it (one rose inside its body in 4% of Resets, overlapping it in 8%); and a floor too crowded for the dice lays its ring turned so the Remnant stands between two (mutants: the Remnant not minded; the crowded ring where it was)', () => {
  const clear = SD_REM.r + SD_HEART.r + 1, rng = seeded(11);
  let resets = 0;
  for (let k = 0; k < 300; k++) {
    const n = 1 + (k % 20), [r0, r1] = heartRingFor(heartCountFor(n)), a = rng() * Math.PI * 2, r = r0 + rng() * (r1 - r0);
    const { cx, rem } = resetHearts(n, [Math.sin(a) * r, Math.cos(a) * r], rng);
    resets++;
    for (const [x, z] of cx.c) assert.ok(Math.hypot(x - rem[0], z - rem[1]) >= clear - 0.01, `Reset ${k}: clear of its body`);
  }
  assert.equal(resets, 300);
  // the dice that find nothing (always 0): the crowded floor's ring, the Remnant where its old ring laid the second Heart
  const old = [Math.sin((1 / 3) * Math.PI * 2 + Math.PI / 8) * 12, Math.cos((1 / 3) * Math.PI * 2 + Math.PI / 8) * 12];
  const { cx } = resetHearts(1, old, () => 0);
  assert.equal(cx.c.length, 3);
  for (const [x, z] of cx.c) assert.ok(Math.hypot(x - old[0], z - old[1]) >= clear - 0.01, 'the crowded ring clear of it');
});

test('SD11e THE HEARTS\' RING AS WIDE AS THEIR COUNT (L4 F9): 6 m out to 2 m a Heart past the first - 6-10 m for three, 6-20 m for eight; each Heart on its own ring; and the Reset no travel race a small melee party loses: one fighter in melee at reference damage, at the default build, reaches and breaks its three inside the 7.5 s they stand in every one of 300 real Resets (it lost 72% of them when they rose 8-22 m out) (mutants: the ring the whole for any count)', () => {
  assert.deepEqual([3, 4, 5, 6, 7, 8].map(heartRingFor), [[6, 10], [6, 12], [6, 14], [6, 16], [6, 18], [6, 20]]);
  assert.deepEqual(SD_HEART.ring, [6, 20]);
  for (const n of [1, 2, 6, 20]) {
    const [r0, r1] = heartRingFor(heartCountFor(n)), rng = seeded(n);
    for (let k = 0; k < 20; k++) {
      const { cx } = resetHearts(n, [(rng() - 0.5) * 24, (rng() - 0.5) * 24], rng);
      assert.equal(cx.c.length, heartCountFor(n));
      for (const [x, z] of cx.c) assert.ok(Math.hypot(x, z) >= r0 - 0.01 && Math.hypot(x, z) <= r1 + 0.01, `${n} living: on its ring`);
    }
  }
  // hearts.mjs's method: the shortest visiting order from beside the Remnant, each Heart's health at reference damage
  const window = (SD_BLOWS.reset.windup - SD_HEARTS_CLOSE_MS) / 1000, reach = SD_HEART.r + MELEE_REACH - 0.3, rng = seeded(12345);
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let lost = 0;
  for (let k = 0; k < 300; k++) {
    const rem = [(rng() - 0.5) * 24, (rng() - 0.5) * 24];
    const { cx } = resetHearts(1, rem, rng);
    const best = Math.min(...orders.map((o) => {
      let [x, z] = [rem[0] + 3, rem[1]], t = 0;
      for (const i of o) { const [hx, hz] = cx.c[i]; t += Math.max(0, Math.hypot(hx - x, hz - z) - reach) / byDefault + cx.m / dpsRef(30); x = hx; z = hz; }
      return t;
    }));
    if (best > window) lost++;
  }
  assert.equal(lost, 0, 'every Reset made');
  assert.equal(SD_HEARTS[0], 3);
});

// ── the Hand's way and its reach (L4 F10, C1) ──────────────────────────

test('SD11e THE HAND SHOWS ITS WAY AS IT GATHERS (L4 F10): its wind-up\'s half-circle and its beam standing at the edge its sweep begins from - one way for `sw` 1, the other for -1 (the Remnant\'s is a coin, and a straight run the wrong way met it) - then the beam alone where it stands in its sweep; the gate\'s own telegraph untouched (mutants: no beam in the wind-up; the beam at its far edge)', () => {
  const at = T0 + 10_000, H = SD_BLOWS.hand;
  for (const sw of [1, -1]) {
    const shapes = sdTelegraphShapes(blow(H, at, { x: 1, z: 2, yw: 0.3, sw }), SD_BODY.remnant, 1, at - H.windup / 2);
    assert.deepEqual(shapes.map((s) => s.kind), [TELEGRAPH_KIND.cone, TELEGRAPH_KIND.lane]);
    const [cone, lane] = shapes;
    assert.deepEqual([cone.yaw, cone.halfArc, lane.halfW, lane.t, lane.origin], [0.3, H.arc / 2, H.width / 2, cone.t, [1, 2]]);
    const a = 0.3 - (sw * H.arc) / 2;
    assert.ok(near(lane.end[0], 1 + Math.sin(a) * H.len) && near(lane.end[1], 2 + Math.cos(a) * H.len), `sw ${sw}: the beam at the edge it starts from`);
  }
  assert.deepEqual(sdTelegraphShapes(blow(H, at, { sw: 1 }), SD_BODY.remnant, 1, at + 100).map((s) => s.kind), [TELEGRAPH_KIND.lane], 'sweeping: the beam alone');
  assert.equal(read('src/render/gateTelegraph.js').includes('AUDIT SD II (L4'), false, 'the gate\'s pass is its own');
});

test('SD11e THE HAND\'S RANGE IS ITS BEAM\'S (L4 C1): it was chosen for a target 40 m past its body, and its beam reaches 34 from its chest - a target 34-42 m off was swept by a beam that never reached it; now its range past its body is the beam\'s length less the body (mutants: the range 40)', () => {
  const H = SD_BLOWS.hand;
  assert.equal(H.range + SD_REM.r, H.len);
  assert.ok(blowsFor(H.len - SD_REM.r - 0.1).includes(H), 'within the beam');
  assert.equal(blowsFor(H.len - SD_REM.r + 0.1).includes(H), false, 'past it: never the Hand');
});

// ── nobody on the Steps (L4 C2) ────────────────────────────────────────

test('SD11e NOBODY ON THE STEPS (L4 C2): the arena\'s own slack keeps every point of every Crumble step - its corners, and a body hanging its capsule past the last one\'s far edge - out of the fight: the Pulse, the Reset and the End strike nothing there, the realm sees nobody there, and its `in` is from the arena alone; its rim, with a pose\'s age, still in (the gate\'s POSE_SLACK reached the last step\'s last 0.6 m) (mutants: the gate\'s slack; the relay\'s `in` on it)', () => {
  const crumble = SD_STEPS_COURSE.filter((s) => s.kind === 'crumble');
  assert.equal(crumble.length, 8);
  for (const s of crumble) for (const dx of [-s.w / 2, 0, s.w / 2]) for (const dz of [-s.d / 2, s.d / 2 + CAPSULE_RADIUS]) {
    const [x, z] = arenaOf(s.x + dx, s.z + dz);
    assert.equal(inArena(x, z, SD_ARENA_SLACK), false, `step ${s.i} (${dx}, ${dz}): off the arena`);
    for (const A of [SD_BLOWS.pulse, SD_BLOWS.reset, SD_BLOWS.end]) assert.deepEqual(sdBlowVerdict(blow(A, 1000, { n: 3 }), x, z, 990, 1000, true).hits, [], `${A.key} on step ${s.i}`);
  }
  assert.equal(inArena(0, -(26 - CAPSULE_RADIUS + 1.4), SD_ARENA_SLACK), true, 'the rim, and a pose\'s age past it');
  // the realm: a fighter on the last step is seen nowhere - away, its share out in time
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  const last = crumble[crumble.length - 1], [lx, lz] = arenaOf(last.x, last.z + last.d / 2);
  stepRemnant(f, T0 + 5000, [{ sub: 'a', x: lx, z: lz, dead: false }], seeded(1));
  assert.equal(f.players.a.seenAt, T0, 'not seen from the Steps');
  const R = read('server/src/index.js');
  assert.match(R, /if \(!inArena\(at\.x, at\.z, SD_ARENA_SLACK\)\) return;\s+\/\/ from the arena alone/);
  assert.match(read('src/net/sdStrike.js'), /if \(inArena\(px, pz, SD_ARENA_SLACK\)\) hits\.push\(\{ part: 'all', pct, base: A\.base \}\);/);   // PIN MOVED (AUDIT SD III F3): the whole arena's blow judged however late - still on the arena's own slack
});

// ── the words and the comments (L4 C4, C5, C6; the docs lens) ──────────

test('SD11e THE WORDS AND THE COMMENTS (L4 C4, C5, C6; the docs lens): the mirror riddle reads one way - "as far before twelve as B stands past it", 12 - h, where "read from twelve backwards" read 13 - h too - and holds for every hour; a city\'s `$&` is its name, not a pattern; a slot\'s salt its own for 2047 Hollows, and its comment says so; sdFell\'s `n` every seat its fight took; the great cities the hubs\' claim\'s first, not the largest (mutants: the old riddle; a string replacement; each comment as it was)', () => {
  const said = sdRiddleText({ kind: 'mirror', a: 5, b: 0 });
  assert.equal(said, 'The Blades stands as far before twelve as Daggerfall stands past it.');
  for (let h = 0; h < 12; h++) {
    const hours = [h, 0, 0, 0, 0, sdHour(12 - h)];
    assert.ok(sdRiddleHolds({ kind: 'mirror', a: 5, b: 0 }, hours), `Daggerfall at ${h}: the Blades at ${sdHour(12 - h)}`);
    assert.equal(sdRiddleHolds({ kind: 'mirror', a: 5, b: 0 }, [h, 0, 0, 0, 0, sdHour(13 - h)]), false, '13 - h never');
  }
  const s = [...Array(64).keys()].find((k) => k > 0 && SD_NAMES[sdRoll(k, 2) % SD_NAMES.length].includes('{city}'));
  assert.equal(sdNameOf(s, 'Cash$&Carry').includes('Cash$&Carry'), true, 'a name, never a pattern');
  assert.equal(sdNameOf(s, "Bel$'ar").includes("Bel$'ar"), true);
  assert.equal(sdSalt(1), sdSalt(2048), 'slot 1 and slot 2048 share a salt');
  assert.equal(new Set(Array.from({ length: 2047 }, (_, k) => sdSalt(k + 1))).size, 2047, 'and every slot between has its own');
  const site = read('src/systems/sdSite.js'), law = read('src/net/sdLaw.js');
  assert.match(site, /a slot's own until the 2047th Hollow after it/);
  assert.equal(/2048th Hollow/.test(site) || /largest cities/.test(site), false, 'no comment says what the code does not');
  assert.match(site, /SD_GREAT_CITIES cities by that same claim/);
  assert.match(law, /how many fought it \(`n` - every seat its fight took/);
  assert.equal(law.includes('how many earned it'), false);
  assert.match(read('src/world/sdSteps.js'), /by the checkpoints' near edges/, 'C3 was SD11a\'s');
});
