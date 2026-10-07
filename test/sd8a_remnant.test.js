// SD8a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT'S LAW
// (net/sdRemnant.js) - the numbers; a fighter's share and the gate's belief of a blow; the three phases (the Walking Hour,
// the Dragon Break's Echoes and their pair, the Last Moment's Reset and its Hearts); the Hour's own blows (the Pulse, the
// Hour Ends); a lost fight; the geometry every struck screen judges by; and whole fights, simulated: a party at its
// reference damage fells it inside the Hour, a party at half does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_TTK_S, SD_SHARE_X, SD_OPENING_MS, SD_LOST_MS, SD_PHASE_AT, SD_PHASE_NAMES, SD_BREAK_MS, SD_BODY, SD_REM,
  SD_ECHO, SD_ECHO_SPOTS, SD_REM_START, SD_FAST, SD_LAST_SPEED_X, SD_ECHO_PAIR_MS, SD_ECHO_HAND_FIRST_MS, SD_ECHO_HAND_EVERY_MS, SD_WALK_IN_MS, SD_RESET_FIRST_MS,
  SD_RESET_EVERY_MS, SD_RESET_PCT, SD_RESET_HEAL, SD_HEARTS, SD_HEART, SD_HEARTS_CLOSE_MS, SD_STUN_MS, SD_STUN_HIT_X,
  SD_PULSE_EVERY_MS, SD_PULSE_PCT, SD_PULSE_STEP, SD_ENDS_MS, SD_END_EVERY_MS, SD_END_PCT, SD_PILLARS, SD_BLOWS,
  SD_BLOW_BY_ID, heartCountFor, heartHpFor, pulsePct, windupFor, blowsFor, arenaOf, inArena, keepInArena, stompRingAt,
  ringPassed, handAngleAt, handSwept, behindPillar, newRemnantFight, joinRemnant, applyRemnantHit, applyEchoHit,
  applyHeartHit, heartsOpen, remnantOpen, stepRemnant, remnantStateOf, atkFrameOf, pairWay,
} from '../src/net/sdRemnant.js';
import { SD_ARENA, SD_PILLAR_R, SD_PILLAR_W } from '../src/net/sdBrain.js';
import { SD_FIGHTERS_MAX } from '../src/net/sdLaw.js';
import { dpsRef, HIT_KINDS, BUCKET_DEPTH_X, HIT_CAP_X, MELEE_REACH, POSE_SLACK, earned, earnedBy, REPEAT_MAX } from '../src/net/gateBrain.js';

const T0 = 1_800_000_000_000;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
/** A fight in slot 4 with `n` fighters at `lv`, born at T0. */
function fight(n = 4, lv = 30) {
  const f = newRemnantFight(4, 1, T0);
  for (let k = 0; k < n; k++) joinRemnant(f, `p${k}`, `P${k}`, lv, T0);
  return f;
}
/** Every fighter standing about the centre, `r` out. */
const ringOf = (f, r = 6) => Object.keys(f.players).map((sub, k, all) => { const a = (k / all.length) * Math.PI * 2; return { sub, x: Math.sin(a) * r, z: Math.cos(a) * r, dead: false }; });
/** Beat the fight every 250 ms from `from` until a frame `want` says - the frames, and the moment it was said. */
function beatUntil(f, from, want, bodiesAt, rng = seeded(5), most = 120_000) {
  const out = [];
  for (let now = from; now <= from + most; now += 250) {
    for (const x of stepRemnant(f, now, bodiesAt(now), rng)) out.push({ now, ...x });
    if (out.some(want)) return { out, now };
  }
  return { out, now: null };
}
/** Beat the fight every 250 ms up to `until`, the bodies as `bodiesAt(now)` says; the frames said. */
function beatTo(f, from, until, bodiesAt, rng = seeded(5)) {
  const out = [];
  for (let now = from; now <= until; now += 250) for (const x of stepRemnant(f, now, bodiesAt(now), rng)) out.push({ now, ...x });
  return out;
}

test('SD8a THE NUMBERS: a share of 420 s of reference damage x 1.25; the phases at 70% and 35%; the Hearts 3 and one for every two living, 8 at most, three seconds of the living\'s damage between them; the Pulse 12% and 2% more each; the Hour fifteen minutes; four pillars on the diagonals (mutants: the share the Warden\'s; a Heart for every living; the Pulse unchanging)', () => {
  assert.equal(SD_TTK_S, 420); assert.equal(SD_SHARE_X, 1.25); assert.equal(SD_FIGHTERS_MAX, 256);
  assert.deepEqual(SD_PHASE_AT, [0.7, 0.35]);
  assert.deepEqual(SD_PHASE_NAMES, ['The Walking Hour', 'The Dragon Break', 'The Last Moment']);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9, 10, 11, 40].map(heartCountFor), [3, 3, 4, 4, 5, 5, 7, 8, 8, 8]);
  assert.deepEqual(SD_HEARTS, [3, 8]);
  assert.equal(heartHpFor([30, 30, 30, 30], 5), Math.round((3 * 4 * dpsRef(30)) / 5));
  assert.equal(heartHpFor([1], 8), SD_HEART.min, 'never less than its floor');
  assert.equal(pulsePct(0), 0.12); assert.ok(near(pulsePct(1), 0.14)); assert.ok(near(pulsePct(29), 0.7));
  assert.equal(SD_PULSE_PCT, 0.12); assert.equal(SD_PULSE_STEP, 0.02); assert.equal(SD_PULSE_EVERY_MS, 30_000);
  assert.equal(SD_ENDS_MS, 900_000); assert.equal(SD_END_EVERY_MS, 2000); assert.equal(SD_END_PCT, 0.99);
  assert.equal(SD_RESET_PCT, 0.7); assert.equal(SD_RESET_HEAL, 0.08); assert.equal(SD_STUN_MS, 8000); assert.equal(SD_STUN_HIT_X, 1.5);
  assert.equal(SD_ECHO_PAIR_MS, 15_000); assert.equal(SD_RESET_EVERY_MS, 50_000);
  assert.equal(SD_PILLARS.length, 4);
  for (const [x, z] of SD_PILLARS) { assert.ok(near(Math.hypot(x, z), SD_PILLAR_R, 1e-9)); assert.ok(near(Math.abs(x), Math.abs(z), 1e-9), 'on a diagonal'); }
  assert.ok(SD_REM.h >= 4 * 1.75, 'four times a man\'s height');
  // the blows: the Walking Hour's three, the clock's two, the Last Moment's turn
  assert.deepEqual(SD_BLOW_BY_ID.map((A) => A.key), ['stomp', 'hand', 'volley', 'pulse', 'reset', 'end']);
  assert.deepEqual([SD_BLOWS.stomp.r, SD_BLOWS.stomp.r1], [7, 22]);
  assert.ok(near(SD_BLOWS.stomp.r + (SD_BLOWS.stomp.wave * SD_BLOWS.stomp.active) / 1000, SD_BLOWS.stomp.r1), 'the ring rolls out to 22 m over its span');
  assert.equal(SD_BLOWS.hand.active, 4000); assert.ok(near(SD_BLOWS.hand.arc, Math.PI), 'half the arena in four seconds');
  assert.deepEqual([SD_BLOWS.volley.max, SD_BLOWS.volley.r, SD_BLOWS.volley.pool.ms], [5, 3, 6000]);
  assert.equal(SD_BLOWS.reset.windup, 8000);
  for (const A of SD_BLOW_BY_ID) assert.ok(!('el' in A) || A.el == null, 'no element: no resistance answers it');
  // faster: the Echoes and the Last Moment, never the clock's or the Reset
  assert.equal(windupFor(SD_BLOWS.stomp, 1, SD_BODY.remnant), SD_BLOWS.stomp.windup);
  assert.equal(windupFor(SD_BLOWS.stomp, 2, SD_BODY.gold), Math.round(SD_BLOWS.stomp.windup * SD_FAST));
  assert.equal(windupFor(SD_BLOWS.hand, 3, SD_BODY.remnant), Math.round(SD_BLOWS.hand.windup * SD_FAST));
  assert.equal(windupFor(SD_BLOWS.reset, 3, SD_BODY.remnant), SD_BLOWS.reset.windup);
  assert.equal(windupFor(SD_BLOWS.pulse, 3, SD_BODY.hour), SD_BLOWS.pulse.windup);
  assert.equal(SD_FAST, 0.8);
});

test('SD8a A SHARE AND A SEAT: each fighter brings its share at the fraction the fight stands at - a newcomer to a bled fight comes with an empty bucket; its first claim kept; a full fight frees an idle seat; a fight over takes nobody (mutants: the share at full; the bucket always full)', () => {
  const f = newRemnantFight(4, 1, T0);
  assert.equal(joinRemnant(f, 'a', 'A', 30, T0), true);
  const share = SD_TTK_S * dpsRef(30) * SD_SHARE_X;
  assert.ok(near(f.max, share) && near(f.hp, share));
  assert.equal(f.players.a.bucket, BUCKET_DEPTH_X * dpsRef(30), 'whole: a full bucket');
  f.hp = f.max * 0.8;
  joinRemnant(f, 'b', 'B', 10, T0 + 1);
  assert.ok(near(f.hp / f.max, 0.8), 'at the fraction it stands at');
  assert.equal(f.players.b.bucket, 0, 'bled: an empty bucket');
  joinRemnant(f, 'a', 'A2', 60, T0 + 2);
  assert.equal(f.players.a.lv, 30, 'the first claim kept');
  assert.equal(f.players.a.name, 'A2');
  const full = newRemnantFight(4, 2, T0);
  for (let k = 0; k < SD_FIGHTERS_MAX; k++) joinRemnant(full, `s${k}`, 'x', 1, T0);
  assert.equal(joinRemnant(full, 'late', 'L', 1, T0, new Set()), true, 'an idle seat freed (nobody present)');
  assert.equal(Object.keys(full.players).length, SD_FIGHTERS_MAX);
  const present = new Set(Object.keys(full.players));
  assert.equal(joinRemnant(full, 'later', 'L', 1, T0, present), false, 'every seat held');
  f.fell = { at: T0 };
  assert.equal(joinRemnant(f, 'c', 'C', 30, T0 + 3), false, 'over: nobody new');
});

test('SD8a BELIEF: the gate\'s hand and purse - refused from a stranger, asleep, off the arena, a melee blow out of reach; capped a blow and by the bucket; a phase holds its floor; stunned it takes half again; the Last Moment\'s last blow fells it, the fight\'s chart and best with it (mutants: no floor; the stun unweighted; melee from anywhere)', () => {
  const f = fight(2, 30);
  const pose = { x: 0, z: 4 };
  assert.equal(applyRemnantHit(f, 'p0', 50, HIT_KINDS.Spell, pose, T0 + 100), 0, 'asleep: the opening');
  const now = T0 + SD_OPENING_MS + 10;
  assert.equal(remnantOpen(f, now), true);
  assert.equal(applyRemnantHit(f, 'x', 50, HIT_KINDS.Spell, pose, now), 0, 'a stranger');
  assert.equal(applyRemnantHit(f, 'p0', 50, HIT_KINDS.Spell, { x: 0, z: SD_ARENA.r + POSE_SLACK + 1 }, now), 0, 'off the arena');
  assert.equal(applyRemnantHit(f, 'p0', 50, HIT_KINDS.Melee, { x: 0, z: SD_REM_START[1] - SD_REM.r - MELEE_REACH - POSE_SLACK - 1 }, now + 400), 0, 'a sword out of reach');
  const got = applyRemnantHit(f, 'p0', 50, HIT_KINDS.Melee, { x: 0, z: SD_REM_START[1] - SD_REM.r - 1 }, now + 800);
  assert.equal(got, 50, 'within reach');
  const big = applyRemnantHit(f, 'p1', 1e9, HIT_KINDS.Spell, pose, now + 900);
  assert.equal(big, HIT_CAP_X * dpsRef(30), 'capped a blow');
  // the floor: past 70% nothing lands in the Walking Hour
  f.hp = SD_PHASE_AT[0] * f.max + 10;
  assert.equal(applyRemnantHit(f, 'p0', 100, HIT_KINDS.Spell, pose, now + 2000), 10, 'held at the floor');
  assert.equal(applyRemnantHit(f, 'p0', 100, HIT_KINDS.Spell, pose, now + 2400), 0);
  // the Last Moment: stunned, half again; the last blow fells it
  f.phase = 3;
  f.hp = 100;
  f.stunUntil = now + 5000;
  const before = f.players.p1.dealt;
  assert.equal(applyRemnantHit(f, 'p1', 40, HIT_KINDS.Spell, pose, now + 3000), 60, 'x1.5');
  assert.equal(f.players.p1.dealt - before, 60);
  assert.equal(applyRemnantHit(f, 'p1', 80, HIT_KINDS.Spell, pose, now + 3400), 40, 'what was left');
  assert.ok(f.fell && f.fell.at === now + 3400);
  assert.deepEqual(f.fell.top.slice(0, 2), ['P1', 'P0']);
  assert.equal(f.fell.n, 2);
  assert.ok(Array.isArray(f.fell.dm) && f.fell.dm.length === 2, 'every fighter\'s part');
  assert.equal(earned(f, 'p1'), true); assert.equal(earnedBy(f, 'p1'), 'dealt');
  assert.equal(applyRemnantHit(f, 'p1', 10, HIT_KINDS.Spell, pose, now + 4000), 0, 'fallen');
});

test('SD8a THE WALKING HOUR: asleep through the opening, then it walks at its chosen and strikes - the Stomp only near, the Hour-Hand and the Gear Volley from afar and a walk in after each; never a blow a third time running; the Volley at five fighters at most, on the arena; the Hand turning one way or the other (mutants: no walk in; the stomp from afar; the volley at everyone)', () => {
  const f = fight(8, 30);
  const far = (now) => ringOf(f, 20);
  const frames = beatTo(f, T0, T0 + SD_OPENING_MS - 250, far);
  assert.ok(frames.every((x) => x.k !== 'atk' && x.k !== 'mv'), 'asleep');
  const fr = beatTo(f, T0 + SD_OPENING_MS, T0 + SD_OPENING_MS + 120_000, far, seeded(11));
  const atks = fr.filter((x) => x.k === 'atk' && x.b === SD_BODY.remnant);
  assert.ok(atks.length > 10);
  assert.ok(atks.every((x) => x.a === SD_BLOWS.hand.id || x.a === SD_BLOWS.volley.id), 'from afar no stomp');
  for (let k = 2; k < atks.length; k++) assert.ok(!(atks[k].a === atks[k - 1].a && atks[k].a === atks[k - 2].a), 'never thrice running');
  for (const x of atks.filter((a) => a.a === SD_BLOWS.volley.id)) {
    assert.ok(x.tg.length >= 1 && x.tg.length <= 5, 'five at most');
    assert.ok(x.tg.every(([px, pz]) => inArena(px, pz)), 'on the arena');
  }
  assert.ok(atks.filter((a) => a.a === SD_BLOWS.hand.id).every((a) => a.sw === 1 || a.sw === -1));
  const sws = new Set(atks.filter((a) => a.a === SD_BLOWS.hand.id).map((a) => a.sw));
  assert.equal(sws.size, 2, 'either way');
  // after each far blow it walks in (mv) before the next
  const mvs = fr.filter((x) => x.k === 'mv' && x.b === SD_BODY.remnant && x.v > 0);
  assert.ok(mvs.length >= atks.length / 2, 'it walks');
  assert.ok(mvs.every((m) => near(m.v, SD_REM.speed)), 'at the Walking Hour\'s pace');
  // near: the Stomp comes
  const g = fight(2, 30);
  const close = () => Object.keys(g.players).map((sub) => ({ sub, x: 0, z: SD_REM_START[1] - SD_REM.r - 2, dead: false }));
  const nf = beatTo(g, T0 + SD_OPENING_MS, T0 + SD_OPENING_MS + 60_000, close, seeded(3));
  assert.ok(nf.some((x) => x.k === 'atk' && x.a === SD_BLOWS.stomp.id), 'near, it stomps');
  // the choice's own law
  assert.deepEqual(blowsFor(3).map((A) => A.key), ['stomp', 'hand', 'volley']);
  assert.deepEqual(blowsFor(20).map((A) => A.key), ['hand', 'volley']);
  assert.deepEqual(blowsFor(20, SD_BLOWS.hand.id).map((A) => A.key), ['volley']);
  assert.ok(REPEAT_MAX >= 1);
  assert.equal(SD_WALK_IN_MS, 3000);
});

test('SD8a THE DRAGON BREAK: at 70% it steps outside time and two Echoes rise, each with half of what is left to 35%; a blow on an Echo comes off the whole; one fallen and left alone 15 s rises again with half its health; both fallen within 15 s - the Last Moment, at 35%, the Remnant back at the centre; while both stand the Hour-Hand sweeps from both at once, gold one way and silver the other (mutants: the Echoes the whole that is left; no rise; the Hand from one)', () => {
  const f = fight(4, 30);
  const bodies = () => ringOf(f, 6);
  const wake = T0 + SD_OPENING_MS;
  f.hp = SD_PHASE_AT[0] * f.max - 1;
  const fr = beatTo(f, wake, wake, bodies);
  assert.equal(f.phase, 2);
  const ph = fr.find((x) => x.k === 'ph');
  assert.deepEqual([ph.n, ph.up], [2, wake + SD_BREAK_MS]);
  const pool = f.hp - SD_PHASE_AT[1] * f.max;
  assert.ok(near(f.ec[0].h, pool / 2, 1e-6) && near(f.ec[1].h, pool / 2, 1e-6), 'half of what is left each');
  assert.deepEqual(f.ec.map((E) => [E.body.x, E.body.z]), SD_ECHO_SPOTS.map((s) => [...s]));
  assert.equal(remnantOpen(f, wake + 5000), false, 'outside time');
  assert.equal(applyRemnantHit(f, 'p0', 10, HIT_KINDS.Spell, { x: 0, z: 0 }, wake + 5000), 0);
  assert.deepEqual(applyEchoHit(f, 'p0', 0, 10, HIT_KINDS.Spell, { x: 0, z: 0 }, wake + 100), [], 'not yet risen');
  // a blow on GOLD comes off the whole
  const hp0 = f.hp;
  applyEchoHit(f, 'p0', 0, 30, HIT_KINDS.Spell, { x: 0, z: 0 }, wake + SD_BREAK_MS + 10, 1);
  assert.ok(near(hp0 - f.hp, 30, 1e-6));
  // a join keeps the pool true
  joinRemnant(f, 'late', 'L', 40, wake + SD_BREAK_MS + 20);
  assert.ok(near(f.ec[0].h + f.ec[1].h, f.hp - SD_PHASE_AT[1] * f.max, 1e-6), 'the Echoes are what is left to the floor');
  // GOLD falls; SILVER is left alone 15 s: GOLD rises with half its health
  const t1 = wake + SD_BREAK_MS + 1000;
  f.ec[0].h = 5;
  f.hp = SD_PHASE_AT[1] * f.max + 5 + f.ec[1].h;
  for (const sub of Object.keys(f.players)) { f.players[sub].bucket = 1e9; }
  const fell = applyEchoHit(f, 'p1', 0, 50, HIT_KINDS.Spell, { x: 0, z: 0 }, t1, 7);
  assert.equal(fell[0].k, 'ec'); assert.equal(fell[0].d, 0); assert.equal(fell[0].n, 'P1');
  assert.equal(f.ec[0].downAt, t1);
  const mGold = f.ec[0].m;
  const risen = beatTo(f, t1 + 250, t1 + SD_ECHO_PAIR_MS + 250, () => ringOf(f, 6));
  assert.ok(near(f.ec[0].h, mGold / 2, 1e-6), 'risen with half');
  assert.ok(risen.some((x) => x.k === 'ec' && x.r === 0));
  assert.equal(f.phase, 2);
  // both within 15 s: the Last Moment (each brought low first - a blow is capped, HIT_CAP_X)
  const t2 = t1 + SD_ECHO_PAIR_MS + 10_000;
  for (const E of f.ec) { E.up = 0; }
  f.ec[0].h = 7; f.ec[1].h = 9;
  f.hp = SD_PHASE_AT[1] * f.max + 16;
  const left = f.ec[0].h + f.ec[1].h;
  applyEchoHit(f, 'p2', 0, f.ec[0].h, HIT_KINDS.Spell, { x: 0, z: 0 }, t2, 20);
  applyEchoHit(f, 'p3', 1, f.ec[1].h, HIT_KINDS.Spell, { x: 0, z: 0 }, t2 + 5000, 21);
  assert.ok(left > 0);
  const last = beatTo(f, t2 + 5250, t2 + 5250, () => ringOf(f, 6));
  assert.equal(f.phase, 3);
  assert.ok(near(f.hp / f.max, SD_PHASE_AT[1], 1e-6), 'at 35%');
  assert.deepEqual([f.rem.x, f.rem.z], [0, 0], 'back at the centre');
  assert.ok(last.some((x) => x.k === 'ph' && x.n === 3 && x.up === t2 + 5250 + SD_BREAK_MS));
  assert.equal(f.resetAt, t2 + 5250 + SD_BREAK_MS + SD_RESET_FIRST_MS);
  assert.equal(remnantOpen(f, t2 + 5300), false, 'returning');
  assert.equal(remnantOpen(f, t2 + 5250 + SD_BREAK_MS), true, 'returned');
  // the Hour-Hand from both: while both stand it is the pair's - every Hand from both at once, gold one way and silver the
  // other, the first SD_ECHO_HAND_FIRST_MS after they rise and each SD_ECHO_HAND_EVERY_MS on; never one Echo's alone
  for (const seed of [1, 3, 9]) {
    const g = fight(6, 30);
    g.hp = SD_PHASE_AT[0] * g.max - 1;
    const gb = beatTo(g, wake, wake + 90_000, () => ringOf(g, 20), seeded(seed));
    const hands = gb.filter((x) => x.k === 'atk' && x.a === SD_BLOWS.hand.id);
    assert.ok(hands.length >= 8, `seed ${seed}: the Hand comes`);
    const byAt = new Map();
    for (const h of hands) byAt.set(h.at, [...(byAt.get(h.at) ?? []), h]);
    for (const hs of byAt.values()) {
      assert.equal(hs.length, 2, `seed ${seed}: from both at once`);
      // AUDIT SD II (SD11e, PIN MOVED): L4 F2 - gold the way the bearing grows, silver the other; both at ONE fighter
      // beyond the two, silver gold's way (pairWay - the two beams cross it the same way, never a pincer)
      const gh = hs.find((h) => h.b === SD_BODY.gold), sh = hs.find((h) => h.b === SD_BODY.silver);
      const aimed = (h) => ringOf(g, 20).find((b) => { const a = Math.atan2(b.x - h.x, b.z - h.z) - h.yw; return Math.abs(Math.sin(a)) < 0.02 && Math.cos(a) > 0; });
      const T = aimed(gh), one = !!T && T.sub === aimed(sh)?.sub;
      assert.ok(gh.sw === 1 && sh.sw === (one ? pairWay(gh, sh, T) : -1), 'each its own way');
    }
    const begun = [...new Set(hands.map((h) => h.now))];
    assert.ok(begun[0] >= wake + SD_BREAK_MS + SD_ECHO_HAND_FIRST_MS, 'the first after they rise');
    for (let k = 1; k < begun.length; k++) assert.ok(begun[k] - begun[k - 1] >= SD_ECHO_HAND_EVERY_MS, 'and each a while after');
    assert.deepEqual(blowsFor(20, -1, 1, true).map((A) => A.key), ['volley'], 'the pair\'s own choice holds no Hand');
  }
  // close in, the Echoes chain their blows - each holds for the other when the Hand is due, so it still comes
  {
    const g = fight(6, 30);
    g.hp = SD_PHASE_AT[0] * g.max - 1;
    const closeIn = () => Object.keys(g.players).map((sub, k) => { const [x, z] = SD_ECHO_SPOTS[k % 2]; return { sub, x: x + 1.5, z: z - 2.5, dead: false }; });
    const cb = beatTo(g, wake, wake + 90_000, closeIn, seeded(5));
    const begun = new Set(cb.filter((x) => x.k === 'atk' && x.a === SD_BLOWS.hand.id).map((x) => x.at));
    assert.ok(begun.size >= 5, `close in, the pair's Hand still comes (${begun.size})`);
    assert.ok(cb.some((x) => x.k === 'atk' && x.a === SD_BLOWS.stomp.id), 'close in, they stomp');
  }
  // one left alone fights with all three - its Hand its own
  const lone = fight(4, 30);
  lone.hp = SD_PHASE_AT[0] * lone.max - 1;
  beatTo(lone, wake, wake, () => ringOf(lone, 20));
  lone.ec[1].h = 0; lone.ec[1].downAt = wake + 1;
  const lb = beatTo(lone, wake + SD_BREAK_MS, wake + SD_BREAK_MS + SD_ECHO_PAIR_MS - 500, () => ringOf(lone, 20), seeded(6));
  assert.ok(lb.some((x) => x.k === 'atk' && x.a === SD_BLOWS.hand.id && x.b === SD_BODY.gold), 'alone, its own Hand');
  assert.ok(lb.every((x) => !(x.k === 'atk' && x.b === SD_BODY.silver)), 'the fallen strikes nothing');
  // and the Echoes' blows are faster
  const g2 = fight(6, 30);
  g2.hp = SD_PHASE_AT[0] * g2.max - 1;
  const gb2 = beatTo(g2, wake, wake + 30_000, () => ringOf(g2, 20), seeded(9));
  const echoStomp = gb2.find((x) => x.k === 'atk' && x.b === SD_BODY.gold);
  assert.ok(echoStomp && echoStomp.at - echoStomp.now === Math.round(SD_BLOW_BY_ID[echoStomp.a].windup * SD_FAST), 'faster');
});

test('SD8a THE LAST MOMENT: faster; the Reset 50 s after its return - Hearts rise, heartCountFor the living, apart and clear of the pillars, each a share of three seconds of the living\'s damage; every one broken - it is stunned 8 s and takes half again, the next 50 s after; one left - it lands and heals 8%, the next 50 s after its end; the Hearts take no blow in its last half second (mutants: the Reset never; the heal forgotten; the Hearts open to the end)', () => {
  const f = fight(6, 40);
  const wake = T0 + SD_OPENING_MS;
  f.phase = 3; f.hp = 0.3 * f.max; f.outUntil = wake; f.resetAt = wake + 1000; f.rem = { ...f.rem, x: 0, z: 0 };
  const bodies = () => ringOf(f, 10);
  const isReset = (x) => x.k === 'atk' && x.a === SD_BLOWS.reset.id;
  const { out: fr } = beatUntil(f, wake, isReset, bodies, seeded(4));
  const reset = fr.find(isReset);
  assert.ok(reset, 'the Reset called - once the blow in flight is done');
  const first = fr.find((x) => x.k === 'atk' && x.b === SD_BODY.remnant);
  assert.ok(first.a !== SD_BLOWS.reset.id && reset.now >= first.at, 'it waits out the blow it began');
  assert.equal(reset.at - reset.now, SD_BLOWS.reset.windup, 'its eight seconds, never shortened');
  const cx = fr.find((x) => x.k === 'cx');
  assert.equal(cx.c.length, heartCountFor(6));
  assert.equal(cx.m, heartHpFor(Array(6).fill(40), heartCountFor(6)));
  for (const [x, z] of cx.c) {
    const r = Math.hypot(x, z);
    assert.ok(r >= SD_HEART.ring[0] - 0.01 && r <= SD_HEART.ring[1] + 0.01, 'on the ring');
    assert.ok(SD_PILLARS.every(([px, pz]) => Math.hypot(px - x, pz - z) >= SD_HEART.pillarGap - 0.01), 'clear of the pillars');
  }
  for (let i = 0; i < cx.c.length; i++) for (let j = i + 1; j < cx.c.length; j++) assert.ok(Math.hypot(cx.c[i][0] - cx.c[j][0], cx.c[i][1] - cx.c[j][1]) >= SD_HEART.gap - 0.01, 'apart');
  // over many draws, and the most Hearts, never on a pillar
  for (let seed = 1; seed <= 40; seed++) {
    const g = fight(20, 30);
    g.phase = 3; g.hp = 0.3 * g.max; g.outUntil = wake; g.resetAt = wake; g.rem.x = 0; g.rem.z = 0;
    const got = stepRemnant(g, wake, ringOf(g, 10), seeded(seed)).find((x) => x.k === 'cx');
    assert.equal(got.c.length, SD_HEARTS[1]);
    for (const [x, z] of got.c) assert.ok(SD_PILLARS.every(([px, pz]) => Math.hypot(px - x, pz - z) >= SD_HEART.pillarGap - 0.01), `draw ${seed}: clear of the pillars`);
  }
  // the walk is faster in the Last Moment
  const g = fight(2, 30);
  g.phase = 3; g.hp = 0.3 * g.max; g.outUntil = wake; g.resetAt = wake + 600_000; g.rem.x = 0; g.rem.z = 0;
  const walk = beatTo(g, wake, wake + 20_000, () => ringOf(g, 20), seeded(2)).filter((x) => x.k === 'mv' && x.v > 0);
  assert.ok(walk.length && walk.every((m) => near(m.v, SD_REM.speed * SD_LAST_SPEED_X)));
  // every Heart broken: stunned
  for (const p of Object.values(f.players)) p.bucket = 1e9;
  const t = reset.now + 1000;
  let out = [];
  for (let c = 0; c < cx.c.length; c++) out = out.concat(applyHeartHit(f, `p${c % 6}`, c, 1e6, HIT_KINDS.Spell, { x: cx.c[c][0], z: cx.c[c][1] }, t + c * 300, 100 + c));
  assert.equal(out.filter((x) => x.k === 'cxb').length, cx.c.length);
  const stun = out.find((x) => x.k === 'stun');
  assert.ok(stun && stun.until === f.stunUntil);
  assert.equal(stun.until - stun.at, SD_STUN_MS, 'eight seconds');
  assert.equal(f.rem.atk, null, 'the Reset called off');
  assert.equal(f.resetAt, f.stunUntil + SD_RESET_EVERY_MS);
  // one left: it lands and heals
  const h = fight(4, 30);
  h.phase = 3; h.hp = 0.2 * h.max; h.outUntil = wake; h.resetAt = wake + 500; h.rem.x = 0; h.rem.z = 0;
  const { out: hr, now: called } = beatUntil(h, wake, isReset, () => ringOf(h, 10), seeded(8));
  const r2 = hr.find(isReset);
  assert.equal(heartsOpen(h, r2.at - SD_HEARTS_CLOSE_MS - 1), true);
  assert.equal(heartsOpen(h, r2.at - SD_HEARTS_CLOSE_MS), false, 'closed in its last half second');
  assert.deepEqual(applyHeartHit(h, 'p0', 0, 1e6, HIT_KINDS.Spell, { x: 0, z: 10 }, r2.at - 100, 1), []);
  const before = h.hp;
  beatTo(h, called + 250, r2.at + 250, () => ringOf(h, 10), seeded(8));
  assert.ok(near(h.hp - before, SD_RESET_HEAL * h.max, 1e-6), 'healed');
  assert.equal(h.cx, null);
  beatTo(h, r2.at + 500, r2.at + SD_BLOWS.reset.active + SD_BLOWS.reset.recover + 250, () => ringOf(h, 10), seeded(8));
  assert.ok(h.resetAt > r2.at + SD_BLOWS.reset.active + SD_BLOWS.reset.recover && h.resetAt <= r2.at + SD_BLOWS.reset.active + SD_BLOWS.reset.recover + 250 + SD_RESET_EVERY_MS, 'the next 50 s after its end');
});

test('SD8a THE HOUR\'S OWN BLOWS: the Mantella Pulse every 30 s from the wake, numbered (its share grows), through every phase; the Hour Ends fifteen minutes after the wake - every 2 s from then, and nothing else is done or believed (mutants: the Pulse from the birth; the End never again; blows believed past the Hour)', () => {
  const f = fight(3, 20);
  const wake = T0 + SD_OPENING_MS;
  const fr = beatTo(f, T0, wake + 95_000, () => ringOf(f, 20));
  const pulses = fr.filter((x) => x.k === 'atk' && x.b === SD_BODY.hour && x.a === SD_BLOWS.pulse.id);
  assert.deepEqual(pulses.map((x) => x.at), [1, 2, 3].map((k) => wake + k * SD_PULSE_EVERY_MS));
  assert.deepEqual(pulses.map((x) => x.n), [0, 1, 2]);
  assert.ok(pulses.every((x) => x.at - x.now >= SD_BLOWS.pulse.windup - 250 && x.at - x.now <= SD_BLOWS.pulse.windup), 'said its wind-up before');
  // the End
  f.endsAt = wake + 100_000;
  const end = beatTo(f, wake + 95_250, wake + 107_000, () => ringOf(f, 20));
  const ends = end.filter((x) => x.k === 'atk' && x.a === SD_BLOWS.end.id);
  assert.deepEqual(ends.map((x) => x.at).slice(0, 4), [0, 1, 2, 3].map((k) => f.endsAt + k * SD_END_EVERY_MS));
  assert.ok(ends.every((x) => x.b === SD_BODY.hour));
  assert.ok(end.filter((x) => x.k === 'atk' && x.now > f.endsAt).every((x) => x.a === SD_BLOWS.end.id), 'nothing else is done');
  assert.equal(applyRemnantHit(f, 'p0', 10, HIT_KINDS.Spell, { x: 0, z: 0 }, wake + 107_000), 0, 'nothing believed');
  assert.equal(joinRemnant(f, 'n', 'N', 10, wake + 107_000), false);
});

test('SD8a LOST: a fight nobody living has stood in for 30 s is lost - said once, and it takes nobody after (mutants: never lost; the dead counted living)', () => {
  const f = fight(2, 20);
  const wake = T0 + SD_OPENING_MS;
  const dead = () => ringOf(f, 6).map((b) => ({ ...b, dead: true }));
  const fr = beatTo(f, wake, wake + SD_LOST_MS + 500, dead);
  assert.ok(f.lost, 'the dead stand in it for nobody');
  assert.equal(fr.filter((x) => x.k === 'lost').length, 1);
  assert.equal(f.lost.at, wake + SD_LOST_MS);
  assert.equal(joinRemnant(f, 'n', 'N', 10, wake + SD_LOST_MS + 600), false);
  assert.deepEqual(stepRemnant(f, wake + SD_LOST_MS + 1000, ringOf(f, 6), seeded(1)), [], 'it says nothing more');
  const g = fight(1, 20);
  beatTo(g, wake, wake + SD_LOST_MS + 1000, (now) => ringOf(g, 6).map((b) => ({ ...b, x: now < wake + 20_000 ? b.x : 40 })));
  assert.equal(g.lost, null, 'not yet: off the arena at 20 s, so 30 s from then');
});

test('SD8a THE GEOMETRY every struck screen judges by: the Stomp\'s ring rolls out at its pace, its front its width; the Hour-Hand turns from one side to the other over its span, sweeping a body ahead once and never one behind it or past its length; a pillar between shades (mutants: the ring from the centre; the hand the wrong way; no shade)', () => {
  const st = { at: 1000, x: 0, z: 0 };
  assert.equal(stompRingAt(st, 999), null);
  assert.equal(stompRingAt(st, 1000), 7);
  assert.equal(stompRingAt(st, 1500), 12);
  assert.equal(stompRingAt(st, 2500), 22);
  assert.equal(stompRingAt(st, 2600), null);
  assert.equal(ringPassed(st, 10, 1250, 1350), true, 'its front passed 10 m');
  assert.equal(ringPassed(st, 15, 1250, 1350), false);
  assert.equal(ringPassed(st, 6, 1000, 1100), false, 'inside it the disc, not the ring');
  assert.equal(ringPassed(st, 23, 2400, 2600), false, 'past 22 m');
  assert.equal(ringPassed(st, 22.5, 2400, 2600), false, 'its front\'s centre stops at 22 m');   // AUDIT SD II (SD11e, PIN MOVED): L4 F7 - the ring strikes where its front's centre crosses, never its band's edge
  // the hand: yw 0 (+z), turning the way the bearing grows
  const h = { at: 0, x: 0, z: 0, yw: 0, sw: 1 };
  assert.ok(near(handAngleAt(h, 0), -Math.PI / 2));
  assert.ok(near(handAngleAt(h, 2000), 0));
  assert.ok(near(handAngleAt(h, 4000), Math.PI / 2));
  assert.equal(handAngleAt(h, 4100), null);
  const back = { ...h, sw: -1 };
  assert.ok(near(handAngleAt(back, 0), Math.PI / 2), 'the other way');
  // a body straight ahead at 10 m is swept at the half
  assert.equal(handSwept(h, 0, 10, 1900, 2100), true);
  assert.equal(handSwept(h, 0, 10, 0, 1500), false, 'not yet');
  assert.equal(handSwept(h, 0, -10, 0, 4000), false, 'behind it, never');
  assert.equal(handSwept(h, 0, 40, 0, 4000), false, 'past its length');
  assert.equal(handSwept(h, 10, 0.01, 3900, 4000), true, 'at its end, its side');
  let n = 0;
  for (let t = 0; t < 4000; t += 16) if (handSwept(h, 7, 7, t, t + 16)) n++;
  assert.ok(n >= 1 && n <= 40, 'swept once, as the beam passes');
  // a pillar's shade
  const [px, pz] = SD_PILLARS[0];
  assert.equal(behindPillar(0, 0, px * 1.4, pz * 1.4), true, 'behind it');
  assert.equal(behindPillar(0, 0, px * 0.6, pz * 0.6), false, 'before it');
  assert.equal(behindPillar(0, 0, 0, 20), false, 'between the pillars');
  assert.equal(behindPillar(0, 0, -px * 1.4, pz * 1.4), true, 'every diagonal has its pillar');
  assert.equal(behindPillar(px * 1.4, pz * 1.4, 0, 0), true, 'both ways');
  assert.ok(SD_PILLAR_W > 1, 'a body\'s width');
  // the frame
  assert.deepEqual(arenaOf(SD_ARENA.x + 3, SD_ARENA.z - 4), [3, -4]);
  assert.equal(inArena(0, SD_ARENA.r), true); assert.equal(inArena(0, SD_ARENA.r + 0.1), false); assert.equal(inArena(NaN, 0), false);
  assert.deepEqual(keepInArena(30, 40, 10), [6, 8]);
});

test('SD8a WHOLE FIGHTS, simulated: eight fighters at their reference damage, splitting the Echoes and breaking every Heart, fell it inside the Hour - and at 60% of it still; at half, the Hour Ends with it standing; all on one Echo, it keeps rising; Hearts left, the Reset lands and heals and the fight runs long (mutants: the share the Warden\'s; the Echoes not paired; the Reset not healing)', () => {
  function sim({ n = 8, lv = 30, dpsX = 1, hearts = true, pair = true } = {}) {
    const rng = seeded(7), f = newRemnantFight(4, 1, T0);
    const subs = Array.from({ length: n }, (_, k) => `p${k}`);
    for (const sub of subs) joinRemnant(f, sub, sub, lv, T0);
    const pos = subs.map((_, k) => { const a = (k / n) * Math.PI * 2; return [Math.sin(a) * 6, Math.cos(a) * 6]; });
    const tally = { stun: 0, rise: 0, reset: 0, end: 0 };
    const d = dpsRef(lv) * 0.5 * dpsX;
    let q = 0, now = T0;
    for (let step = 0; step < 4 * 20 * 60 && !f.fell; step++) {
      now += 250;
      for (const x of stepRemnant(f, now, subs.map((sub, k) => ({ sub, x: pos[k][0], z: pos[k][1], dead: false })), rng)) {
        if (x.k === 'ec' && x.r != null) tally.rise++;
        if (x.k === 'atk' && x.a === SD_BLOWS.reset.id) tally.reset++;
        if (x.k === 'atk' && x.a === SD_BLOWS.end.id) tally.end++;
      }
      if ((now - T0) % 500) continue;
      for (const [k, sub] of subs.entries()) {
        const pose = { x: pos[k][0], z: pos[k][1] };
        q++;
        if (f.phase === 2 && f.ec) { const e = pair ? k % 2 : 0; applyEchoHit(f, sub, f.ec[e].h > 0 ? e : 1 - e, d, HIT_KINDS.Spell, pose, now, q); }
        else if (hearts && f.cx && heartsOpen(f, now)) { const c = f.cx.c.findIndex((o) => o.h > 0); if (c >= 0) tally.stun += applyHeartHit(f, sub, c, d * 4, HIT_KINDS.Spell, pose, now, q).filter((x) => x.k === 'stun').length; }
        else applyRemnantHit(f, sub, d, HIT_KINDS.Spell, pose, now, q);
      }
    }
    return { f, t: (now - T0) / 1000, tally };
  }
  const full = sim();
  assert.ok(full.f.fell, 'felled');
  assert.ok(full.t > 480 && full.t < 600, `in about nine minutes (${full.t} s)`);
  assert.ok(full.tally.reset >= 2 && full.tally.stun === full.tally.reset, 'every Reset broken');
  const weak = sim({ dpsX: 0.6 });
  assert.ok(weak.f.fell && weak.t < (SD_OPENING_MS + SD_ENDS_MS) / 1000, `at 60% still inside the Hour (${weak.t} s)`);
  const half = sim({ dpsX: 0.5 });
  assert.ok(!half.f.fell && half.f.ended && half.tally.end > 0, 'at half, the Hour Ends');
  const one = sim({ pair: false });
  assert.ok(one.tally.rise >= 2, `all on one Echo: it keeps rising (${one.tally.rise})`);
  assert.ok(one.t > full.t + 120);
  const left = sim({ hearts: false });
  assert.ok(left.f.fell && left.tally.stun === 0 && left.tally.reset > full.tally.reset && left.t > full.t + 120, 'the Reset lands and heals');
});

test('SD8a THE STATE: the whole of the fight as the wire says it - slot and fight, phase, health, the bodies with their walks and blows, the Echoes, the Hour\'s blow, the Pulses, the Hour\'s end, the Hearts, the stun, the next Reset, the fallen and the lost (mutant: the fight\'s number dropped)', () => {
  const f = fight(2, 30);
  const s = remnantStateOf(f);
  assert.deepEqual(Object.keys(s), ['k', 's', 'fi', 'ph', 'h', 'm', 'op', 'ou', 'rem', 'ec', 'clk', 'pu', 'pa', 'ends', 'ended', 'cx', 'su', 'rk', 'n', 'fell', 'lost']);
  assert.deepEqual([s.k, s.s, s.fi, s.ph, s.n, s.op], ['st', 4, 1, 1, 2, T0 + SD_OPENING_MS]);
  assert.deepEqual([s.rem.x, s.rem.z], [...SD_REM_START]);
  assert.equal(s.ends, T0 + SD_OPENING_MS + SD_ENDS_MS);
  assert.equal(s.pa, T0 + SD_OPENING_MS + SD_PULSE_EVERY_MS);
  f.hp = SD_PHASE_AT[0] * f.max - 1;
  beatTo(f, T0 + SD_OPENING_MS, T0 + SD_OPENING_MS, () => ringOf(f, 6));
  const s2 = remnantStateOf(f);
  assert.equal(s2.ph, 2);
  assert.equal(s2.ec.length, 2);
  assert.deepEqual(Object.keys(s2.ec[0]), ['h', 'm', 'up', 'dn', 'x', 'y'.replace('y', 'z'), 'yw', 'mv', 'atk']);
  assert.deepEqual(atkFrameOf(SD_BODY.hour, { i: 3, a: 3, at: 9, x: 0, z: 0, yw: 0, tg: [], n: 2 }), { k: 'atk', b: 3, i: 3, a: 3, at: 9, x: 0, z: 0, yw: 0, tg: [], n: 2 });
});

test('SD8a the gate\'s hand and purse are one: net/gateBrain.js exports spendBlow and spendPurse, and the Remnant spends them - no second blow rate, no second bucket', () => {
  const g = readFileSync(new URL('../src/net/gateBrain.js', import.meta.url), 'utf8');
  assert.match(g, /^export function spendBlow\(p, now, seq = null, who = ''\) \{/m);
  assert.match(g, /^export function spendPurse\(p, d, left, now\) \{/m);
  const r = readFileSync(new URL('../src/net/sdRemnant.js', import.meta.url), 'utf8');
  assert.equal((r.match(/spendBlow\(p, now, seq, /g) ?? []).length, 3, 'the Remnant, an Echo, a Heart');
  assert.equal((r.match(/spendPurse\(p, /g) ?? []).length, 3);
  assert.doesNotMatch(r, /p\.bucket\s*=/, 'no bucket of its own');
  assert.equal(SD_ECHO.r < SD_REM.r, true);
});
