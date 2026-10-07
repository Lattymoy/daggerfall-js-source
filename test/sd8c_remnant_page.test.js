// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE BRASS REMNANT ON THE
// PAGE - the fight as the page holds it (net/sdFightLink.js: the realm's words folded, my place in the fight), the arena's
// set (scenes/sdRemnant.js: the bodies where the realm says, my `in`, my blows through the gate's three seams), its bar
// (ui/sdRemnantBar.js on the gate's own), its bodies made (world/sdRemnantModel.js, world/sdRemnantArt.js), the arena's
// pillars on the collider, and the realm's `me`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_BODY, SD_BLOWS, SD_REM, SD_ECHO, SD_HEART, SD_REM_START, SD_ECHO_SPOTS, SD_OPENING_MS, SD_BREAK_MS, SD_PHASE_AT, SD_PHASE_NAMES,
  SD_RESET_FIRST_MS, SD_RESET_EVERY_MS, SD_HEARTS, SD_HEARTS_CLOSE_MS, SD_LOST_MS, SD_ENDS_MS, SD_PILLARS,
  newRemnantFight, joinRemnant, stepRemnant, applyRemnantHit, applyEchoHit, applyHeartHit, heartsOpen, remnantStateOf, behindPillar, windupFor,
} from '../src/net/sdRemnant.js';
import { SD_FIGHT_EMPTY, SD_IN_RETRY_MS, SD_FIGHT_TEXT, foldSdFight, createSdFightLink, sdBodyAt, sdBlowDone, sdHeartsOf } from '../src/net/sdFightLink.js';
import { validSdOut, SOCIAL_ROOM, SD_KEY, worldRoom, PIXEL_UNITS, SD_BRAIN_V, SD_NO_WORDS } from '../src/net/wire.js';
import { SD_ARENA, SD_PILLAR_R, SD_PILLAR_W, SD_PILLAR_H, realmToDungeon, dungeonToRealm } from '../src/net/sdBrain.js';
import { dpsRef, HIT_KINDS, PHASE_AT } from '../src/net/gateBrain.js';
import { sdRoomKey } from '../src/net/sdLaw.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import {
  createSdRemnant, remnantPose, echoPose, heartsOpenAt, remnantOpenAt, arenaToDungeon, SD_KNEEL_M, SD_REM_SINK_MS, SD_ECHO_SINK_MS,
  SD_REMNANT_MOBILE, SD_REMNANT_NAMES,
} from '../src/scenes/sdRemnant.js';
import { remnantBarModel, sdBarNear, SD_BAR_TEXT, SD_BAR_NEAR_M, SD_ENDS_WARN_MS, SD_ENDS_NEAR_MS } from '../src/ui/sdRemnantBar.js';
import { drawGateBossBar, destroyGateBossBar, FELL_HOLD_MS, FELL_FADE_MS } from '../src/ui/gateBossBar.js';
import { buildRemnantModel, buildHeartModel, remnantMatrix, remnantScale, SD_REMNANT_WEAR, SD_REMNANT_HEART_RECORD, SD_REMNANT_EYE_RECORD } from '../src/world/sdRemnantModel.js';
import { remnantArt, echoMetalArt, SD_REMNANT_GOLD_RECORD, SD_REMNANT_SILVER_RECORD, SD_REMNANT_ART_SIZE, SD_ECHO_METALS } from '../src/world/sdRemnantArt.js';
import { realmPillarTris, realmFloorTris, realmColliderTris, realmLampTris, SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD, SD_REALM_ARCHIVE } from '../src/world/sdRealm.js';
import { SD_STEPS_CRACKED_RECORD, SD_STEPS_BEAT_RECORD } from '../src/world/sdStepsArt.js';
import { identity } from '../src/world/mat4.js';
import { SD_HALL_GLOW_RECORD } from '../src/world/sdHallArt.js';
import { Collider } from '../src/player/collider.js';
import { fakeRooms } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const T0 = 1_800_000_000_000;

// ── the page follows the law ──────────────────────────────────────────

/** A whole fight run by the law (SD8a's own simulation), every frame it says passed through the wire's projection and
 *  folded into the page's state - the deltas alone (no whole state after the first) - and the page's view of each body
 *  checked against the law's at every beat. */
function shadow({ n = 8, dpsX = 1, hearts = true, pair = true, seed = 7 } = {}) {
  const rng = seeded(seed), f = newRemnantFight(4, 1, T0);
  const subs = Array.from({ length: n }, (_, k) => `p${k}`);
  for (const sub of subs) joinRemnant(f, sub, sub, 30, T0);
  const pos = subs.map((_, k) => { const a = (k / n) * Math.PI * 2; return [Math.sin(a) * 6, Math.cos(a) * 6]; });
  let s = foldSdFight(SD_FIGHT_EMPTY, validSdOut(remnantStateOf(f)), T0);
  const kinds = new Set();
  const hear = (frames, now) => {
    for (const x of frames) {
      const w = validSdOut(x);
      assert.ok(w, `the wire takes the law's ${x.k}`);
      kinds.add(w.k);
      if (w.k !== 'st') s = foldSdFight(s, w, now);
    }
  };
  const d = dpsRef(30) * 0.5 * dpsX;
  let q = 0, now = T0, beats = 0;
  for (let step = 0; step < 4 * 20 * 60 && !f.fell; step++) {
    now += 250;
    hear(stepRemnant(f, now, subs.map((sub, k) => ({ sub, x: pos[k][0], z: pos[k][1], dead: false })), rng), now);
    beats++;
    // THE PAGE'S VIEW, CHECKED: phase, health, each body where it stands and the blow it has in flight, the Echoes, the
    // Hearts, the stun, the Hour's blow, the end (bodies the End stopped within a beat's walk of the law's moment)
    const tol = f.ended ? 1 : 0.05;
    assert.equal(s.ph, f.phase, `the phase at ${now - T0}`);
    assert.equal(s.h, Math.round(f.hp), `the health at ${now - T0}`);
    assert.ok(dist2(sdBodyAt(s.rem, now), sdBodyAt(f.rem, now)) <= tol, `the Remnant where it stands at ${now - T0}`);
    if (f.rem.atk) assert.equal(s.rem.atk?.i, f.rem.atk.i, 'its blow in flight');
    else assert.ok(!s.rem.atk || sdBlowDone(s.rem.atk, now), 'none in flight');
    assert.equal(!!s.ec, !!f.ec, 'the Echoes stand while the law\'s do');
    if (f.ec) {
      for (let k = 0; k < 2; k++) {
        const E = f.ec[k], P = s.ec[k];
        assert.deepEqual([P.up, P.dn, P.h, P.m], [E.up, E.downAt ?? 0, Math.ceil(E.h), Math.ceil(E.m)], `Echo ${k}'s rising, fall and health`);
        if (E.h > 0) assert.ok(dist2(sdBodyAt(P, now), sdBodyAt(E.body, now)) <= tol, `Echo ${k} where it stands`);
        if (E.h > 0 && E.body.atk) assert.equal(P.atk?.i, E.body.atk.i, `Echo ${k}'s blow`);
      }
    }
    assert.equal(sdHeartsOf(s, now)?.i ?? null, f.cx?.i ?? null, 'the Hearts standing while the Reset winds up - gone as it lands');
    if (f.cx) f.cx.c.forEach((o, c) => { assert.deepEqual([s.cx.c[c][0], s.cx.c[c][1]], [o.x, o.z]); assert.equal(s.cx.c[c][2], Math.ceil(o.h), `Heart ${c}'s health`); });
    if (f.stunUntil > 0) assert.equal(s.su, f.stunUntil, 'the stun');
    assert.equal(!!s.ended, !!f.ended, 'the Hour\'s end');
    if (f.clock) assert.equal(s.clk?.i, f.clock.i, 'the Hour\'s blow');
    if ((now - T0) % 500) continue;
    for (const [k, sub] of subs.entries()) {
      const pose = { x: pos[k][0], z: pos[k][1] };
      q++;
      if (f.phase === 2 && f.ec) { const e = pair ? k % 2 : 0; hear(applyEchoHit(f, sub, f.ec[e].h > 0 ? e : 1 - e, d, HIT_KINDS.Spell, pose, now, q), now); }
      else if (hearts && f.cx && heartsOpen(f, now)) { const c = f.cx.c.findIndex((o) => o.h > 0); if (c >= 0) hear(applyHeartHit(f, sub, c, d * 4, HIT_KINDS.Spell, pose, now, q), now); }
      else {
        applyRemnantHit(f, sub, d, HIT_KINDS.Spell, pose, now, q);
        if (f.fell && !s.fell) hear([{ k: 'fell', ...f.fell }], now);   // the relay fans the fall (SD8b _sdFightFallOnce)
      }
    }
  }
  return { f, s, kinds, beats };
}

test('SD8c THE PAGE FOLLOWS THE LAW: every word a whole simulated fight says - eight fighters, splitting the Echoes and breaking every Heart; an Echo left alone rising; the Reset landing; the Hour ending - folded through the wire into the page\'s state keeps it the law\'s at every beat: the phase, the health, each body where it stands and the blow it has in flight, the Echoes\' rising and fall, the Hearts, the stun, the Hour\'s blow and its end; the fall where it fell (mutants: a walk that keeps its blow; the break not stopping it; an Echo risen elsewhere; the stun keeping the Hearts; the End leaving them walking)', () => {
  const full = shadow();
  assert.ok(full.f.fell && full.s.fell, 'felled on the page as in the law');
  assert.deepEqual([full.s.fell.at, full.s.fell.top, full.s.fell.n], [full.f.fell.at, full.f.fell.top, full.f.fell.n]);
  assert.deepEqual(full.s.fell.dm, full.f.fell.dm, 'its chart');
  assert.ok(dist2([full.s.rem.x, full.s.rem.z], sdBodyAt(full.f.rem, full.f.fell.at)) < 0.05, 'where it fell');
  for (const k of ['mv', 'atk', 'hp', 'ph', 'ec', 'cx', 'cxh', 'cxb', 'stun', 'fell']) assert.ok(full.kinds.has(k), `the fight said ${k}`);
  const rose = shadow({ pair: false });
  assert.ok(rose.f.fell && rose.s.fell, 'all on one Echo: it rises again, and the page stands it at its spot');
  const left = shadow({ hearts: false });
  assert.ok(left.f.fell, 'the Reset lands, and heals');
  const ends = shadow({ dpsX: 0.5 });
  assert.ok(ends.f.ended && !ends.f.fell && ends.s.ended === ends.f.ended.at, 'the Hour ends on the page as in the law');
});

test('SD8c THE FOLD, word by word: nothing but a whole state starts a fight; a walk ends the blow before it and faces its way; the Dragon Break stops the Remnant where its walk had taken it; the Last Moment stands it at the centre with its first Reset 50 s on; an Echo falls where it stood and rises again at its spot; the Hearts rise whole, their health and their breaking said; the stun clears them and moves the Reset; the fall keeps the chart the realm\'s word brought; the loss (mutants: each word folded wrong)', () => {
  const f = newRemnantFight(4, 3, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  const st = validSdOut(remnantStateOf(f));
  assert.equal(foldSdFight(SD_FIGHT_EMPTY, validSdOut({ k: 'hp', h: 5, m: 9 }), T0), SD_FIGHT_EMPTY, 'no fight yet');
  let s = foldSdFight(SD_FIGHT_EMPTY, st, T0);
  assert.deepEqual([s.fi, s.ph, s.op, s.rem.x, s.rem.z], [3, 1, T0 + SD_OPENING_MS, ...SD_REM_START]);
  // a blow, then a walk: the walk ends it, and faces its way
  s = foldSdFight(s, validSdOut({ k: 'atk', b: 0, i: 1, a: SD_BLOWS.stomp.id, at: T0 + 2000, x: 0, z: 8, yw: 1, tg: [] }), T0);
  assert.equal(s.rem.atk.a, SD_BLOWS.stomp.id);
  s = foldSdFight(s, validSdOut({ k: 'mv', b: 0, x: 0, z: 8, tx: 6, tz: 8, v: 2, at: T0 + 5000 }), T0 + 5000);
  assert.equal(s.rem.atk, null, 'a walk ends the blow before it');
  assert.ok(near(s.rem.yw, Math.PI / 2), 'facing +x, its way');
  assert.deepEqual(sdBodyAt(s.rem, T0 + 6000), [2, 8], 'two metres on after a second');
  assert.deepEqual(sdBodyAt(s.rem, T0 + 60_000), [6, 8], 'and no further than its goal');
  // the Dragon Break: stopped where its walk had taken it
  s = foldSdFight(s, validSdOut({ k: 'ph', n: 2, at: T0 + 6500, up: T0 + 9000 }), T0 + 6500);
  assert.deepEqual([s.ph, s.rem.x, s.rem.z, s.rem.mv], [2, 3, 8, null]);
  s = foldSdFight(s, validSdOut({ k: 'ec', e: [[50, 50, T0 + 9000, 0], [50, 50, T0 + 9000, 0]], at: T0 + 6500 }), T0 + 6500);
  assert.deepEqual(s.ec.map((E) => [E.x, E.z, E.h, E.up]), SD_ECHO_SPOTS.map(([x, z]) => [x, z, 50, T0 + 9000]), 'the Echoes rise at their spots');
  // gold walks, and falls where it stood; then rises again at its spot
  s = foldSdFight(s, validSdOut({ k: 'mv', b: SD_BODY.gold, x: -9, z: 2, tx: -9, tz: 12, v: 3, at: T0 + 10_000 }), T0 + 10_000);
  s = foldSdFight(s, validSdOut({ k: 'ec', e: [[0, 50, T0 + 9000, T0 + 12_000], [50, 50, T0 + 9000, 0]], d: 0, n: 'Ann', at: T0 + 12_000 }), T0 + 12_000);
  assert.deepEqual([s.ec[0].x, s.ec[0].z, s.ec[0].mv, s.ec[0].dn], [-9, 8, null, T0 + 12_000], 'fallen where it stood');
  s = foldSdFight(s, validSdOut({ k: 'ec', e: [[25, 50, T0 + 29_500, 0], [50, 50, T0 + 9000, 0]], r: 0, at: T0 + 27_000 }), T0 + 27_000);
  assert.deepEqual([s.ec[0].x, s.ec[0].z, s.ec[0].h, s.ec[0].up], [...SD_ECHO_SPOTS[0], 25, T0 + 29_500], 'risen again at its spot');
  // the Last Moment
  s = foldSdFight(s, validSdOut({ k: 'ph', n: 3, at: T0 + 40_000, up: T0 + 42_500 }), T0 + 40_000);
  assert.deepEqual([s.ph, s.ec, s.rem.x, s.rem.z, s.ou, s.rk], [3, null, 0, 0, T0 + 42_500, T0 + 42_500 + SD_RESET_FIRST_MS]);
  assert.ok(s.h <= SD_PHASE_AT[1] * s.m, 'its health held to the turn');
  // the Reset and its Hearts
  s = foldSdFight(s, validSdOut({ k: 'atk', b: 0, i: 9, a: SD_BLOWS.reset.id, at: T0 + 100_000, x: 0, z: 0, yw: 0, tg: [] }), T0 + 92_000);
  s = foldSdFight(s, validSdOut({ k: 'cx', i: 9, m: 80, c: [[10, 0], [-10, 0], [0, 12]] }), T0 + 92_000);
  assert.deepEqual(s.cx.c, [[10, 0, 80], [-10, 0, 80], [0, 12, 80]], 'risen whole');
  s = foldSdFight(s, validSdOut({ k: 'cxh', i: 9, h: [80, 31, 80] }), T0 + 93_000);
  s = foldSdFight(s, validSdOut({ k: 'cxb', i: 9, c: 2, n: 'Bo', at: T0 + 94_000 }), T0 + 94_000);
  assert.deepEqual(s.cx.c.map((q) => q[2]), [80, 31, 0]);
  assert.equal(foldSdFight(s, validSdOut({ k: 'cxb', i: 8, c: 0, n: 'Bo', at: T0 }), T0).cx.c[0][2], 80, 'another Reset\'s Heart is not these');
  s = foldSdFight(s, validSdOut({ k: 'stun', until: T0 + 103_000, at: T0 + 95_000 }), T0 + 95_000);
  assert.deepEqual([s.cx, s.su, s.stunAt, s.rem.atk, s.rk], [null, T0 + 103_000, T0 + 95_000, null, T0 + 103_000 + SD_RESET_EVERY_MS]);
  // the fall, its chart kept from whichever word brought it
  s = foldSdFight(s, validSdOut({ k: 'mv', b: 0, x: 0, z: 0, tx: 0, tz: -10, v: 2, at: T0 + 110_000 }), T0 + 110_000);
  s = foldSdFight(s, validSdOut({ k: 'fell', at: T0 + 112_000, top: ['Ann'], n: 1 }), T0 + 112_000);
  assert.deepEqual([s.fell.at, s.rem.x, s.rem.z, s.h], [T0 + 112_000, 0, -4, 0], 'where it fell');
  s = foldSdFight(s, validSdOut({ k: 'fell', at: T0 + 112_000, top: ['Ann'], n: 1, dm: [{ n: 'Ann', l: 30, d: 10, x: 0, h: 1, b: 10, f: 0 }] }), T0 + 113_000);
  assert.ok(s.fell.dm, 'the chart, from the second word');
  assert.equal(foldSdFight(s, validSdOut({ k: 'lost', at: T0 + 200_000 }), T0).lost, T0 + 200_000);
  // the Hour's End stops every body
  let e = foldSdFight(SD_FIGHT_EMPTY, st, T0);
  e = foldSdFight(e, validSdOut({ k: 'mv', b: 0, x: 0, z: 8, tx: 0, tz: -8, v: 2, at: T0 }), T0);
  e = foldSdFight(e, validSdOut({ k: 'atk', b: SD_BODY.hour, i: 40, a: SD_BLOWS.end.id, at: T0 + 5000, x: 0, z: 0, yw: 0, tg: [] }), T0 + 3000);
  assert.deepEqual([e.ended, e.rem.mv, e.rem.x, e.rem.z, e.clk.i], [T0 + 5000, null, 0, 2, 40], 'stopped as the End was said');
  const e2 = foldSdFight(e, validSdOut({ k: 'atk', b: SD_BODY.hour, i: 41, a: SD_BLOWS.end.id, at: T0 + 7000, x: 0, z: 0, yw: 0, tg: [] }), T0 + 7000);
  assert.deepEqual([e2.ended, e2.clk.i], [T0 + 5000, 41], 'the end is when it first came');
});

// ── my place in the fight ─────────────────────────────────────────────

test('SD8c MY PLACE IN THE FIGHT: my `in` is due standing in the arena until the realm answers it with the whole fight and `me` - a whole state fanned to everyone is not an answer; every SD_IN_RETRY_MS at most; never into a fight fallen or past its Hour; again into a fight lost or a fresh one; a refusal stands for the fight it was said in (an older game\'s and a closed Hour\'s for good) and is said once; out of the realm, all forgotten (mutants: joined by a fanned state; no retry gap; a refusal for good lapsing)', () => {
  let clock = T0;
  const said = [], refused = [];
  const L = createSdFightLink({ now: () => clock, say: (t) => said.push(t), onRefused: (m) => refused.push(m) });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  const st = (over = {}) => validSdOut({ ...remnantStateOf(f), ...over });
  assert.equal(L.inDue(clock), true, 'no fight heard: due');
  L.sentIn(clock);
  assert.equal(L.inDue(clock + SD_IN_RETRY_MS - 1), false, 'not again so soon');
  assert.equal(L.inDue(clock + SD_IN_RETRY_MS), true);
  L.word(st());
  assert.equal(L.joined(), false, 'a whole state fanned to everyone is no answer');
  L.word(st({ me: 1 }));
  assert.equal(L.joined(), true, 'the realm\'s answer: I am in it');
  assert.equal(L.inDue(clock + 60_000), false, 'and say no more');
  L.word(validSdOut({ k: 'lost', at: clock }));
  assert.equal(L.joined(), false, 'a fight lost');
  assert.equal(L.inDue(clock + 60_000), true, 'the next `in` makes a fresh one');
  assert.equal(said.at(-1), SD_FIGHT_TEXT.lost);
  f.fi = 2; f.lost = null;
  L.word(st());
  assert.equal(L.joined(), false, 'a fresh fight, not yet mine');
  L.word(st({ me: 1 }));
  assert.equal(L.joined(), true);
  // refusals
  f.fi = 3;
  L.word(st());
  L.word(validSdOut({ k: 'no', m: SD_NO_WORDS[2] }));
  assert.deepEqual([said.at(-1), refused.at(-1)], [SD_FIGHT_TEXT.no['the arena is full'], 'the arena is full']);
  assert.equal(L.inDue(clock + 60_000), false, 'the arena full: not into this fight');
  L.word(validSdOut({ k: 'lost', at: clock }));
  assert.equal(L.inDue(clock + 60_000), true, 'its loss lapses it');
  L.word(validSdOut({ k: 'no', m: SD_NO_WORDS[3] }));
  f.fi = 4;
  L.word(st());
  assert.equal(L.inDue(clock + 60_000), false, 'an older game: never again this visit');
  L.leave();
  assert.deepEqual([L.state(), L.joined(), L.inDue(clock)], [SD_FIGHT_EMPTY, false, true], 'out of the realm: forgotten');
  L.word(validSdOut({ k: 'no', m: SD_NO_WORDS[0] }));
  f.fi = 5; L.word(st());
  assert.equal(L.inDue(clock + 60_000), false, 'the Hour closed: never again this visit');
  // into a fight fallen or past its Hour: never
  const L2 = createSdFightLink({ now: () => clock });
  f.fi = 6; f.fell = { at: T0, top: [], n: 1 };
  L2.word(st());
  assert.equal(L2.inDue(clock + 60_000), false, 'fallen');
  f.fell = null; f.ended = { at: T0 }; f.fi = 7;
  L2.word(st());
  assert.equal(L2.inDue(clock + 60_000), false, 'past its Hour');
  // the turns said once each, live alone
  const words = [];
  const L3 = createSdFightLink({ now: () => clock, say: (t) => words.push(t) });
  L3.word(validSdOut({ k: 'ph', n: 2, at: T0, up: T0 + 1 }));
  assert.deepEqual(words, [], 'no fight heard: nothing said');
  f.ended = null; f.fi = 8;
  L3.word(st());
  L3.word(validSdOut({ k: 'ph', n: 2, at: T0, up: T0 + SD_BREAK_MS }));
  L3.word(validSdOut({ k: 'ec', e: [[0, 9, T0, T0 + 1], [9, 9, T0, 0]], d: 0, n: 'Ann', at: T0 + 1 }));
  L3.word(validSdOut({ k: 'ec', e: [[4, 9, T0 + 9, 0], [9, 9, T0, 0]], r: 0, at: T0 + 2 }));
  L3.word(validSdOut({ k: 'ph', n: 3, at: T0 + 3, up: T0 + 4 }));
  L3.word(validSdOut({ k: 'stun', until: T0 + 9, at: T0 + 5 }));
  assert.deepEqual(words, [SD_FIGHT_TEXT.dragonBreak, SD_FIGHT_TEXT.echoFell('Ann', 0), SD_FIGHT_TEXT.echoRose(0), SD_FIGHT_TEXT.lastMoment, SD_FIGHT_TEXT.stunned]);
});

// ── the realm's `me` ──────────────────────────────────────────────────

const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0 }; };
const fights = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k !== 'pz' && m.k !== 'ev');
const say = (o) => JSON.stringify({ t: 'sd', ...o });
/** The fake world driven to a FOUND Hollow and its realm standing (SD8b's rig). */
async function withRealm(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room('chat:r17'); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }   // AUDIT SD: past the Orrery, kept as a realm keeps it - the fight's door asks its Concord (PIN MOVED)
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      await fn({ realm, rec, beat });
    });
  } finally { Date.now = realNow; }
}

test('SD8c THE REALM SAYS `me` to the `in` it counts - in its answer alone, never in the state it fans on the beat or says at a hello; the wire keeps `me` 1 and nothing else; an `in` it drops (its pose not yet in the arena) is answered by nothing, so the page never counts itself in (mutants: `me` fanned to everyone; the wire dropping it)', async () => {
  assert.equal(validSdOut({ ...remnantStateOf(newRemnantFight(4, 1, T0)), s: 4, me: 1 }).me, 1);
  assert.equal('me' in validSdOut({ ...remnantStateOf(newRemnantFight(4, 1, T0)), s: 4, me: 2 }), false, 'only 1');
  assert.equal('me' in validSdOut({ ...remnantStateOf(newRemnantFight(4, 1, T0)), s: 4 }), false);
  await withRealm(async ({ realm, beat }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: SD_BRAIN_V }));
    assert.equal(fights(ann).at(-1).me, 1, 'my answer');
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(4, -12), { name: 'Bo' });
    assert.equal(fights(bo).at(-1).k, 'st');
    assert.equal(fights(bo).at(-1).me, undefined, 'the state at Bo\'s hello is no answer');
    await beat(6000);
    const fanned = fights(bo).filter((m) => m.k === 'st');
    assert.ok(fanned.length >= 2 && fanned.every((m) => m.me === undefined), 'nor the state fanned on the beat');
    const L = createSdFightLink({ now: () => Date.now() });
    for (const m of fights(bo)) L.word(validSdOut(m));
    assert.equal(L.joined(), false, 'Bo is not in it');
    await realm.raw(bo, say({ k: 'in', lv: 20, bv: SD_BRAIN_V }));
    L.word(validSdOut(fights(bo).at(-1)));
    assert.equal(L.joined(), true, 'until the realm answers Bo');
    // an `in` the realm drops - its pose not yet in the arena (a step behind the page's own feet) - is answered by nothing
    const cy = realm.connect(); await realm.hello(cy, 'peer-cy', inArenaAt(0, -(SD_ARENA.r + 6)), { name: 'Cy' });
    const before = fights(cy).length;
    await realm.raw(cy, say({ k: 'in', lv: 20, bv: SD_BRAIN_V }));
    assert.equal(fights(cy).length, before, 'answered by nothing');
    const Lc = createSdFightLink({ now: () => Date.now() });
    for (const m of fights(cy)) Lc.word(validSdOut(m));
    await beat(6000);
    for (const m of fights(cy).slice(before)) Lc.word(validSdOut(m));
    assert.equal(Lc.joined(), false, 'so its page never counts itself in on the fanned state - and sends no blow the realm would call junk');
  });
});

// ── the set ───────────────────────────────────────────────────────────

/** A renderer that keeps what it is asked to make. */
const fakeRenderer = () => { const made = [], up = []; return { made, up, createMesh: (m) => { made.push(m); return { id: made.length }; }, destroyMesh() {}, uploadTexture: (a, r) => up.push([a, r]), uploadEmissionTexture() {} }; };
/** A fight and its link on a clock the test turns. */
function rig({ joined = true } = {}) {
  let clock = T0;
  const L = createSdFightLink({ now: () => clock });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut({ ...remnantStateOf(f), ...(joined ? { me: 1 } : {}) }));
  const sent = [], ins = [];
  const r = fakeRenderer();
  const set = createSdRemnant({ renderer: r, link: () => L, sendIn: () => { ins.push(clock); return true; }, sendBlow: (k, x) => { sent.push({ k, ...x }); return true; }, alive: () => true });
  const draws = [];
  set.stand({ dynamicDraws: draws });
  return { L, f, set, sent, ins, draws, r, at: (t) => { clock = t; }, now: () => clock };
}
const translation = (d) => [d.object.matrix[12], d.object.matrix[13], d.object.matrix[14]];
const hidden = (d) => d.object.matrix.every((v) => v === 0);
const feetAt = (x, z) => arenaToDungeon(x, z);

test('SD8c THE SET STANDS THE BODIES: the Remnant, the two Echoes and the most Hearts a Reset raises, each a draw hidden until the fight stands it; their metals uploaded; with no fight to fight the Remnant waits where a fight begins it, facing the way in; it walks where the realm says, kneels stunned, is gone outside time and rises at the centre for the Last Moment, and sinks where it fell; an Echo rises out of the floor and sinks where it fell; a Heart stands while the Reset winds up (mutants: a body drawn outside time; no kneel; the fall left standing)', () => {
  const { set, draws, r, L, at } = rig();
  assert.equal(draws.length, 1 + 2 + SD_HEARTS[1]);
  assert.ok(draws.every(hidden), 'hidden until the first frame');
  assert.ok(r.up.some(([a, rec]) => a === SD_REALM_ARCHIVE && rec === SD_REMNANT_GOLD_RECORD) && r.up.some(([, rec]) => rec === SD_REMNANT_SILVER_RECORD), 'the Echoes\' metals uploaded');
  set.frame(0.016, null);
  assert.deepEqual(translation(draws[0]).map((v) => Math.round(v * 100) / 100), arenaToDungeon(...SD_REM_START).map((v) => Math.round(v * 100) / 100), 'waiting at its start');
  assert.ok(draws.slice(1).every(hidden), 'no Echo, no Heart');
  // pure: where it stands, and how
  const s0 = L.state();
  assert.deepEqual(remnantPose(SD_FIGHT_EMPTY, T0), { x: SD_REM_START[0], z: SD_REM_START[1], yw: Math.PI, sink: 0, shown: true }, 'no fight: waiting');
  const walking = foldSdFight(s0, validSdOut({ k: 'mv', b: 0, x: 0, z: 8, tx: 0, tz: 0, v: 2, at: T0 + 9000 }), T0 + 9000);
  assert.deepEqual([remnantPose(walking, T0 + 10_000).x, remnantPose(walking, T0 + 10_000).z], [0, 6]);
  assert.equal(remnantPose({ ...walking, su: T0 + 20_000 }, T0 + 10_000).sink, SD_KNEEL_M, 'kneeling, stunned');
  assert.equal(remnantPose({ ...walking, ph: 2 }, T0 + 10_000).shown, false, 'outside time');
  const back = { ...walking, ph: 3, ou: T0 + 10_000 + SD_BREAK_MS / 2 };
  assert.ok(near(remnantPose(back, T0 + 10_000).sink, SD_REM.h / 2), 'rising at its return');
  assert.equal(remnantPose(back, T0 + 10_000 + SD_BREAK_MS).sink, 0);
  const fell = { ...walking, fell: { at: T0 + 10_000, top: [], n: 1 } };
  assert.ok(near(remnantPose(fell, T0 + 10_000 + SD_REM_SINK_MS / 2).sink, SD_REM.h / 2), 'sinking where it fell');
  assert.equal(remnantPose(fell, T0 + 10_000 + SD_REM_SINK_MS).shown, false, 'and gone');
  assert.equal(remnantPose({ ...walking, lost: T0 + 9000 }, T0 + 10_000).z, SD_REM_START[1], 'a fight lost: waiting again');
  // the Echoes
  const brk = foldSdFight(foldSdFight(s0, validSdOut({ k: 'ph', n: 2, at: T0 + 20_000, up: T0 + 20_000 + SD_BREAK_MS }), T0 + 20_000),
    validSdOut({ k: 'ec', e: [[50, 50, T0 + 20_000 + SD_BREAK_MS, 0], [50, 50, T0 + 20_000 + SD_BREAK_MS, 0]], at: T0 + 20_000 }), T0 + 20_000);
  assert.ok(near(echoPose(brk, 0, T0 + 20_000 + SD_BREAK_MS / 2).sink, SD_ECHO.h / 2), 'an Echo rising');
  assert.deepEqual([echoPose(brk, 1, T0 + 30_000).x, echoPose(brk, 1, T0 + 30_000).sink], [SD_ECHO_SPOTS[1][0], 0]);
  const down = foldSdFight(brk, validSdOut({ k: 'ec', e: [[0, 50, T0 + 22_500, T0 + 30_000], [50, 50, T0 + 22_500, 0]], d: 0, n: 'A', at: T0 + 30_000 }), T0 + 30_000);
  assert.ok(near(echoPose(down, 0, T0 + 30_000 + SD_ECHO_SINK_MS / 2).sink, SD_ECHO.h / 2), 'sinking where it fell');
  assert.equal(echoPose(down, 0, T0 + 30_000 + SD_ECHO_SINK_MS).shown, false);
  assert.equal(echoPose(s0, 0, T0).shown, false, 'none outside the break');
  // drawn: in the break, the Remnant hidden and the Echoes standing at their scale
  L.word(validSdOut({ k: 'ph', n: 2, at: T0 + 20_000, up: T0 + 20_000 + SD_BREAK_MS }));
  L.word(validSdOut({ k: 'ec', e: [[50, 50, T0 + 20_000 + SD_BREAK_MS, 0], [50, 50, T0 + 20_000 + SD_BREAK_MS, 0]], at: T0 + 20_000 }));
  at(T0 + 30_000);
  set.frame(0.016, null);
  assert.ok(hidden(draws[0]), 'the Remnant outside time');
  assert.ok(!hidden(draws[1]) && !hidden(draws[2]), 'the Echoes stand');
  assert.ok(near(Math.hypot(draws[1].object.matrix[0], draws[1].object.matrix[2]), remnantScale(true), 1e-6), 'at an Echo\'s height');
  // the Hearts while the Reset winds up
  L.word(validSdOut({ k: 'ph', n: 3, at: T0 + 40_000, up: T0 + 40_000 + SD_BREAK_MS }));
  L.word(validSdOut({ k: 'atk', b: 0, i: 7, a: SD_BLOWS.reset.id, at: T0 + 100_000, x: 0, z: 0, yw: 0, tg: [] }));
  L.word(validSdOut({ k: 'cx', i: 7, m: 60, c: [[10, 0], [-10, 0], [0, 12]] }));
  L.word(validSdOut({ k: 'cxb', i: 7, c: 1, n: 'A', at: T0 + 94_000 }));
  at(T0 + 95_000);
  set.frame(0.016, null);
  assert.deepEqual(draws.slice(3).map(hidden), [false, true, false, true, true, true, true, true], 'the two standing Hearts');
  assert.ok(near(translation(draws[3])[0], arenaToDungeon(10, 0)[0], 1e-4) && near(translation(draws[3])[2], arenaToDungeon(10, 0)[2], 1e-4), 'at its spot');
  at(T0 + 100_000);
  set.frame(0.016, null);
  assert.ok(draws.slice(3).every(hidden), 'gone as the Reset lands - the law says no word for it');
  set.clear();
});

test('SD8c MY `in` AND MY BLOWS: the `in` said standing alive in the arena when it is due - never from outside it, never dead, again only after the retry gap; the Remnant a body my blows meet only in a fight that counted me in - warded asleep and rising, not outside time - each blow out as the wire\'s `hit` in whole points; ONE NUMBER A BLOW across the bodies it meets in a frame, a second meeting of one a blow of its own; the Echoes and the Hearts likewise, and only while they take blows (mutants: an `in` from anywhere; blows into a fight that never answered; each blow its own number)', () => {
  // the `in`
  const a = rig({ joined: false });
  a.at(T0 + 100);
  a.set.frame(0.016, feetAt(0, -(SD_ARENA.r + 2)));
  assert.equal(a.ins.length, 0, 'not from outside the arena');
  a.set.frame(0.016, feetAt(0, -10));
  assert.equal(a.ins.length, 1, 'standing in it');
  a.set.frame(0.016, feetAt(0, -10));
  assert.equal(a.ins.length, 1, 'not again within the retry gap');
  a.at(T0 + 100 + SD_IN_RETRY_MS);
  a.set.frame(0.016, feetAt(0, -10));
  assert.equal(a.ins.length, 2, 'again after it');
  a.at(T0 + SD_OPENING_MS + 1000);
  assert.equal(remnantOpenAt(a.L.state(), T0 + SD_OPENING_MS + 1000), true, 'awake, and open to a blow');
  assert.equal(a.set.target(), null, 'no body to strike in a fight that never answered me');
  assert.deepEqual([a.set.hit({ d: 30, r: HIT_KINDS.Melee }), a.sent.length], [false, 0], 'and no blow into it');
  const dead = createSdRemnant({ link: () => createSdFightLink({ now: () => T0 }), sendIn: () => assert.fail('the dead say no `in`'), alive: () => false });
  dead.frame(0.016, feetAt(0, -10));
  // the Remnant, joined
  const b = rig();
  b.at(T0 + 1000);
  const t0 = b.set.target();
  assert.deepEqual([t0.height, t0.radius, t0.warded, t0.mobile, t0.entity.name], [SD_REM.h, SD_REM.r, true, SD_REMNANT_MOBILE, SD_REMNANT_NAMES.remnant], 'asleep: warded');
  assert.equal(t0.entity.pacifyImmune, true, 'never swayed');
  assert.equal(b.set.hit({ d: 30, r: HIT_KINDS.Melee }), false, 'nothing lands asleep');
  b.at(T0 + SD_OPENING_MS);
  const t1 = b.set.target();
  assert.equal(t1.warded, false);
  assert.deepEqual(t1.feet, arenaToDungeon(...SD_REM_START));
  assert.equal(b.set.hit({ d: 29.6, r: HIT_KINDS.Melee }), true);
  assert.equal(b.set.hit({ d: 0.4, r: HIT_KINDS.Melee }), false, 'under a point is none');
  assert.equal(b.set.hit({ d: 9, r: 7 }), false, 'a kind the wire does not know');
  assert.deepEqual(b.sent[0], { k: 'hit', q: b.sent[0].q, d: 30, r: HIT_KINDS.Melee });
  b.set.hit({ d: 5, r: HIT_KINDS.Melee });
  assert.notEqual(b.sent[1].q, b.sent[0].q, 'a second meeting of it in one frame: a blow of its own');
  b.set.frame(0.016, null);
  b.set.hit({ d: 5, r: HIT_KINDS.Spell });
  assert.ok(b.sent[2].q > b.sent[1].q, 'a new frame, a new blow');
  // the Dragon Break: the Remnant out of reach; the Echoes the host's bodies
  b.L.word(validSdOut({ k: 'ph', n: 2, at: T0 + 20_000, up: T0 + 20_000 + SD_BREAK_MS }));
  b.L.word(validSdOut({ k: 'ec', e: [[50, 50, T0 + 20_000 + SD_BREAK_MS, 0], [50, 50, T0 + 20_000 + SD_BREAK_MS, 0]], at: T0 + 20_000 }));
  b.at(T0 + 21_000);
  assert.equal(b.set.target(), null, 'outside time');
  assert.deepEqual(b.set.echoTargets(), [], 'still rising');
  b.at(T0 + 23_000);
  b.set.frame(0.016, null);
  const ec = b.set.echoTargets();
  assert.deepEqual(ec.map((E) => [E.i, E.m, E.height, E.radius, E.entity.name, E.entity.hostI]), [[0, 50, SD_ECHO.h, SD_ECHO.r, SD_REMNANT_NAMES.echoes[0], 0], [1, 50, SD_ECHO.h, SD_ECHO.r, SD_REMNANT_NAMES.echoes[1], 1]]);
  assert.deepEqual(ec[1].feet, arenaToDungeon(...SD_ECHO_SPOTS[1]));
  const n = b.sent.length;
  assert.equal(b.set.echoHit({ i: 0, d: 12, r: HIT_KINDS.Shaft }), true);
  assert.equal(b.set.echoHit({ i: 1, d: 12, r: HIT_KINDS.Shaft }), true);
  assert.deepEqual(b.sent.slice(n).map((m) => [m.k, m.e, m.d]), [['ehit', 0, 12], ['ehit', 1, 12]]);
  assert.equal(b.sent[n].q, b.sent[n + 1].q, 'one blow meeting both: one number');
  b.set.frame(0.016, null);
  b.set.echoHit({ i: 0, d: 12, r: HIT_KINDS.Shaft });
  const q1 = b.sent.at(-1).q;
  b.set.frame(0.016, null);
  b.set.echoHit({ i: 1, d: 12, r: HIT_KINDS.Shaft });
  assert.equal(b.sent.at(-1).q, q1 + 1, 'a frame ends my blow: the next, on another body, is a number of its own');
  assert.equal(b.set.hit({ d: 30, r: HIT_KINDS.Melee }), false, 'nothing lands on it outside time');
  // the Last Moment's Reset: the Hearts the crystals' bodies, closed in its last half second
  b.L.word(validSdOut({ k: 'ph', n: 3, at: T0 + 40_000, up: T0 + 42_500 }));
  b.L.word(validSdOut({ k: 'atk', b: 0, i: 9, a: SD_BLOWS.reset.id, at: T0 + 100_000, x: 0, z: 0, yw: 0, tg: [] }));
  b.L.word(validSdOut({ k: 'cx', i: 9, m: 60, c: [[10, 0], [-10, 0], [0, 12]] }));
  b.at(T0 + 95_000);
  b.set.frame(0.016, null);
  assert.equal(heartsOpenAt(b.L.state(), T0 + 95_000), true);
  const hs = b.set.heartTargets();
  assert.deepEqual(hs.map((h) => [h.c, h.height, h.radius, h.entity.name, h.entity.crystalC]), [0, 1, 2].map((c) => [c, SD_HEART.h, SD_HEART.r, SD_REMNANT_NAMES.heart, c]));
  assert.equal(b.set.heartHit({ c: 2, d: 20, r: HIT_KINDS.Melee }), true);
  assert.deepEqual([b.sent.at(-1).k, b.sent.at(-1).c, b.sent.at(-1).d], ['xhit', 2, 20]);
  assert.equal(b.set.heartHit({ c: 5, d: 20, r: HIT_KINDS.Melee }), false, 'no such Heart');
  b.at(T0 + 100_000 - SD_HEARTS_CLOSE_MS);
  assert.deepEqual([b.set.heartTargets().length, b.set.heartHit({ c: 0, d: 20, r: HIT_KINDS.Melee })], [0, false], 'closed in its last half second');
  assert.equal(remnantOpenAt(b.L.state(), T0 + 99_000), true, 'the Remnant struck as it winds up');
  b.L.word(validSdOut({ k: 'fell', at: T0 + 101_000, top: ['A'], n: 1 }));
  b.at(T0 + 101_001);
  assert.deepEqual([b.set.target(), b.set.hit({ d: 30, r: HIT_KINDS.Melee })], [null, false], 'fallen: nothing to strike');
});

// ── the bar ───────────────────────────────────────────────────────────

test('SD8c THE BAR: the Brass Remnant\'s name over the phase it fights in, its health with the turns cut at 70% and 35% and spent as it passes them, in brass; warded while it cannot be struck - stirring before its wake, outside time in the break; the Hour\'s own blow called first, then a stun, then the Reset with its Hearts left and its seconds, its own blows, an Echo\'s by name; the Echoes\' health in the break; the next Reset; the Hour\'s end counting down in its last five minutes and pulsing in its last; Felled, held, then faded; none for a fight lost; shown near the arena alone (mutants: the gate\'s marks; the Hour\'s blow behind another; the end never said)', () => {
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  const s0 = foldSdFight(SD_FIGHT_EMPTY, validSdOut(remnantStateOf(f)), T0);
  assert.equal(remnantBarModel(SD_FIGHT_EMPTY, T0), null, 'no fight');
  assert.equal(remnantBarModel({ ...s0, lost: T0 }, T0), null, 'a fight lost');
  const m = remnantBarModel(s0, T0 + 1000);
  assert.deepEqual([m.theme, m.name, m.title, m.frac, m.marks, m.spent, m.fighters, m.fightersLine], ['brass', SD_BAR_TEXT.name, SD_PHASE_NAMES[0], 1, [...SD_PHASE_AT], [false, false], 1, SD_BAR_TEXT.fighters(1)]);
  assert.deepEqual([m.warded, m.callout.text], [true, SD_BAR_TEXT.stirs(7)], 'stirring before its wake');
  const awake = remnantBarModel(s0, T0 + SD_OPENING_MS);
  assert.deepEqual([awake.warded, awake.callout], [false, null]);
  // its blow, called with its line
  const A = SD_BLOWS.hand, at = T0 + SD_OPENING_MS + 5000;
  const hand = foldSdFight(s0, validSdOut({ k: 'atk', b: 0, i: 3, a: A.id, at, x: 0, z: 8, yw: 0, tg: [], sw: 1 }), T0);
  const c = remnantBarModel(hand, at - A.windup / 2).callout;
  assert.deepEqual([c.text, c.t, c.dagon], [A.name, 0.5, false]);
  assert.equal(remnantBarModel(hand, at + A.active + A.recover).callout, null, 'done');
  // the Hour's own first
  const P = SD_BLOWS.pulse;
  const pulse = foldSdFight(hand, validSdOut({ k: 'atk', b: SD_BODY.hour, i: 4, a: P.id, at: at + 500, x: 0, z: 0, yw: 0, tg: [], n: 0 }), T0);
  assert.equal(remnantBarModel(pulse, at - 100).callout.text, P.name, 'the Pulse over its own blow');
  // the break: warded, outside time, an Echo's blow by name, the Echoes' health
  let brk = foldSdFight(s0, validSdOut({ k: 'ph', n: 2, at: T0 + 20_000, up: T0 + 22_500 }), T0 + 20_000);
  brk = foldSdFight(brk, validSdOut({ k: 'ec', e: [[25, 50, T0 + 22_500, 0], [0, 50, T0 + 22_500, T0 + 30_000]], d: 1, n: 'A', at: T0 + 30_000 }), T0 + 30_000);
  const b = remnantBarModel(brk, T0 + 31_000);
  assert.deepEqual([b.warded, b.callout.text, b.host, b.spent, b.title], [true, SD_BAR_TEXT.outside, SD_BAR_TEXT.echoes('50%', 'fallen'), [true, false], SD_PHASE_NAMES[1]]);
  const V = SD_BLOWS.volley, vat = T0 + 34_000;
  const gv = foldSdFight(brk, validSdOut({ k: 'atk', b: SD_BODY.gold, i: 8, a: V.id, at: vat, x: -9, z: 2, yw: 0, tg: [[1, 1]] }), T0);
  const gc = remnantBarModel(gv, vat - 100).callout;
  assert.equal(gc.text, SD_BAR_TEXT.echo(0, V.name));
  assert.ok(gc.t > 0.9 && gc.t < 1, 'an Echo\'s wind-up, faster');
  assert.equal(windupFor(V, 2, SD_BODY.gold) < V.windup, true);
  // the Last Moment: the Reset with its Hearts; the stun; the next Reset
  let last = foldSdFight(brk, validSdOut({ k: 'ph', n: 3, at: T0 + 40_000, up: T0 + 42_500 }), T0 + 40_000);
  const lm = remnantBarModel(last, T0 + 50_000);
  assert.deepEqual([lm.reckonIn, lm.spent], [SD_BAR_TEXT.resetIn('0:43'), [true, true]]);
  last = foldSdFight(last, validSdOut({ k: 'atk', b: 0, i: 9, a: SD_BLOWS.reset.id, at: T0 + 100_000, x: 0, z: 0, yw: 0, tg: [] }), T0 + 92_000);
  last = foldSdFight(last, validSdOut({ k: 'cx', i: 9, m: 60, c: [[10, 0], [-10, 0], [0, 12]] }), T0 + 92_000);
  last = foldSdFight(last, validSdOut({ k: 'cxb', i: 9, c: 0, n: 'A', at: T0 + 93_000 }), T0 + 93_000);
  const rs = remnantBarModel(last, T0 + 95_000);
  assert.deepEqual([rs.callout.text, rs.callout.dagon, rs.reckonIn], [SD_BAR_TEXT.reset(2, 3, 5), true, null]);
  last = foldSdFight(last, validSdOut({ k: 'stun', until: T0 + 104_000, at: T0 + 96_000 }), T0 + 96_000);
  assert.equal(remnantBarModel(last, T0 + 97_000).callout.text, SD_BAR_TEXT.stunned(7));
  // the Hour's end
  const ends = s0.ends;
  assert.equal(remnantBarModel(s0, ends - SD_ENDS_WARN_MS - 1000).wrath, null);
  assert.equal(remnantBarModel(s0, ends - SD_ENDS_WARN_MS).wrath, SD_BAR_TEXT.endsIn('5:00'));
  assert.deepEqual([remnantBarModel(s0, ends - SD_ENDS_NEAR_MS - 1000).wrathNear, remnantBarModel(s0, ends - SD_ENDS_NEAR_MS).wrathNear], [false, true]);
  assert.equal(SD_ENDS_MS, ends - s0.op);
  const ended = foldSdFight(s0, validSdOut({ k: 'atk', b: SD_BODY.hour, i: 50, a: SD_BLOWS.end.id, at: ends, x: 0, z: 0, yw: 0, tg: [] }), ends - 2000);
  assert.deepEqual([remnantBarModel(ended, ends + 100).wrath, remnantBarModel(ended, ends - 100).callout.text], [SD_BAR_TEXT.ended, SD_BLOWS.end.name]);
  // felled, held, faded
  const fell = foldSdFight(s0, validSdOut({ k: 'fell', at: T0 + 300_000, top: ['A'], n: 1 }), T0 + 300_000);
  const alpha = (since) => remnantBarModel(fell, T0 + 300_000 + since).alpha;
  assert.deepEqual([alpha(0), alpha(FELL_HOLD_MS), alpha(FELL_HOLD_MS + FELL_FADE_MS / 2), alpha(FELL_HOLD_MS + FELL_FADE_MS)], [1, 1, 0.5, 0]);
  assert.deepEqual([remnantBarModel(fell, T0 + 300_000).fallen, remnantBarModel(fell, T0 + 300_000).callout, remnantBarModel(fell, T0 + 300_000).frac], [true, null, 0]);
  // near the arena alone
  assert.equal(sdBarNear(SD_ARENA.x, SD_ARENA.z - SD_ARENA.r - SD_BAR_NEAR_M), true);
  assert.equal(sdBarNear(SD_ARENA.x, SD_ARENA.z - SD_ARENA.r - SD_BAR_NEAR_M - 0.5), false, 'the Steps behind it');
  assert.equal(sdBarNear(NaN, 0), false);
});

test('SD8c THE BAR\'S MARKS FOLLOW ITS MODEL - the Remnant\'s cut at 70% and 35%, the gate\'s at its own thirds after, each written when it changes (mutants: the marks laid once, at the gate\'s)', () => {
  destroyGateBossBar();
  const made = [], heads = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', innerHTML: '', id: '', children: [], append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute() {} }; made.push(n); return n; };
  const doc = { createElement: node, body: node('body'), head: { append: (s) => heads.push(s) }, getElementById: (id) => heads.find((s) => s.id === id) ?? null };
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  const s0 = foldSdFight(SD_FIGHT_EMPTY, validSdOut(remnantStateOf(f)), T0);
  drawGateBossBar(remnantBarModel(s0, T0 + SD_OPENING_MS), { doc });
  const ticks = () => made.filter((n) => /^wb-boss-mark( |$)/.test(n.className)).map((n) => n.style.left);
  assert.deepEqual(ticks(), ['70.0%', '35.0%']);
  assert.match(made.find((n) => n.className.startsWith('wb-boss-bar')).className, /\bbrass\b/, 'in brass');
  assert.match(heads[0].textContent, /\.wb-boss-bar\.brass \.wb-boss-fill/, 'its sheet dresses it');
  drawGateBossBar({ ...remnantBarModel(s0, T0 + SD_OPENING_MS), marks: [...PHASE_AT], theme: undefined }, { doc });
  assert.deepEqual(ticks(), ['66.0%', '33.0%'], 'the gate\'s, when its model says so');
  destroyGateBossBar();
});

// ── the bodies made ───────────────────────────────────────────────────

const boundsOf = (m) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); } return { lo, hi }; };
const recsOf = (m) => m.subMeshes.map((x) => x.textureRecord);

test('SD8c THE BODIES MADE: the Remnant its own height from its feet, its body within its radius, facing +z, a cage of brass about a heart of the Mantella\'s light, its eyes alight; the Echoes the same body in gold and in silver, stood at their own height by the matrix; a Heart its own height and across; the matrix a proper turn about y (a facing of 0 is +z, a quarter turn +x); the Echoes\' metals made in code at records of their own (mutants: a body facing away; an Echo in brass; the matrix turning the other way)', () => {
  const brass = buildRemnantModel('brass'), gold = buildRemnantModel('gold'), silver = buildRemnantModel('silver'), heart = buildHeartModel();
  const b = boundsOf(brass);
  assert.ok(near(b.lo[1], 0) && near(b.hi[1], SD_REM.h, 1e-4), 'its feet at 0, its height the law\'s');
  assert.ok(Math.max(-b.lo[0], b.hi[0], -b.lo[2], b.hi[2]) <= SD_REM.r * 1.1, 'within its body');
  assert.ok(recsOf(brass).includes(SD_REALM_BRASS_RECORD) && recsOf(brass).includes(SD_REALM_ROOT_RECORD), 'the Hour\'s own brass');
  assert.ok(recsOf(brass).includes(SD_REMNANT_HEART_RECORD) && recsOf(brass).includes(SD_REMNANT_EYE_RECORD), 'its heart and eyes alight');
  assert.equal(SD_REMNANT_HEART_RECORD, SD_HALL_GLOW_RECORD.mantella);
  assert.ok(recsOf(gold).includes(SD_REMNANT_GOLD_RECORD) && !recsOf(gold).includes(SD_REALM_BRASS_RECORD), 'gold');
  assert.ok(recsOf(silver).includes(SD_REMNANT_SILVER_RECORD) && !recsOf(silver).includes(SD_REMNANT_GOLD_RECORD), 'silver');
  assert.deepEqual(Object.keys(SD_REMNANT_WEAR), ['brass', 'gold', 'silver']);
  // its eyes on its face: +z
  const eyes = brass.subMeshes.find((x) => x.textureRecord === SD_REMNANT_EYE_RECORD);
  for (let i = eyes.startIndex; i < eyes.startIndex + eyes.primitiveCount * 3; i++) assert.ok(brass.positions[brass.indices[i] * 3 + 2] > 0, 'facing +z');
  const h = boundsOf(heart);
  assert.ok(near(h.lo[1], 0) && near(h.hi[1], SD_HEART.h, 1e-4) && near(h.hi[0], SD_HEART.r, 1e-4));
  assert.ok(near(remnantScale(true), SD_ECHO.h / SD_REM.h) && remnantScale(false) === 1);
  // the matrix: +z turned to the facing, scaled, stood at its place
  const M = remnantMatrix(5, 1, -3, Math.PI / 2, 2);
  const apply = (p) => [0, 1, 2].map((k) => M[k] * p[0] + M[4 + k] * p[1] + M[8 + k] * p[2] + M[12 + k]);
  const fwd = apply([0, 0, 1]);
  assert.ok(near(fwd[0], 7) && near(fwd[1], 1) && near(fwd[2], -3), 'a quarter turn faces +x');
  const up = apply([0, 1, 0]);
  assert.ok(near(up[1], 3), 'scaled');
  const det = M[0] * (M[5] * M[10] - M[6] * M[9]) - M[4] * (M[1] * M[10] - M[2] * M[9]) + M[8] * (M[1] * M[6] - M[2] * M[5]);
  assert.ok(det > 0, 'a proper turn - never a mirror');
  assert.ok(near(Math.atan2(fwd[0] - 5, fwd[2] + 3), Math.PI / 2), 'the law\'s bearing: atan2(dx, dz)');
  // the metals
  assert.deepEqual(remnantArt().map(([rec]) => rec), [SD_REMNANT_GOLD_RECORD, SD_REMNANT_SILVER_RECORD]);
  const others = [SD_STEPS_CRACKED_RECORD, SD_STEPS_BEAT_RECORD, ...Object.values(SD_HALL_GLOW_RECORD), SD_REALM_BRASS_RECORD, SD_REALM_ROOT_RECORD];
  assert.ok([SD_REMNANT_GOLD_RECORD, SD_REMNANT_SILVER_RECORD].every((r) => !others.includes(r)), 'records of their own');
  const g = echoMetalArt('gold'), s = echoMetalArt('silver');
  assert.equal(g.albedo.width, SD_REMNANT_ART_SIZE);
  assert.equal(g.albedo.colors.length, SD_REMNANT_ART_SIZE * SD_REMNANT_ART_SIZE * 4);
  const mid = ((5 * SD_REMNANT_ART_SIZE) + 6) * 4;
  assert.ok(g.albedo.colors[mid] > g.albedo.colors[mid + 2] + 60, 'gold is warm');
  assert.ok(Math.abs(s.albedo.colors[mid] - s.albedo.colors[mid + 2]) < 30, 'silver is not');
  assert.ok(g.emission.colors[mid] > 0 && g.emission.colors[0] === 0, 'a low light of its own, none in its seams');
  assert.deepEqual(echoMetalArt('gold').albedo.colors, g.albedo.colors, 'the same pixels every boot');
  assert.deepEqual(Object.keys(SD_ECHO_METALS), ['gold', 'silver']);
});

// ── the pillars ───────────────────────────────────────────────────────

test('SD8c THE PILLARS STAND: the arena\'s four pillars on the collider, their sides and tops - the same squares the Hour-Hand\'s shade is judged by (net/sdRemnant.js behindPillar): a ray from the Remnant to a body the law shades meets the stone short of it, and one the law leaves in the open meets nothing; the realm\'s collider the floors and the pillars, one bucket (mutants: the pillars left off; a pillar out of its square)', () => {
  const p = realmPillarTris();
  assert.equal(p.length, 4 * 5 * 2 * 9, 'four pillars, four sides and a top each, two triangles a face');
  const all = realmColliderTris(), floors = realmFloorTris(), lamps = realmLampTris();
  assert.equal(all.length, floors.length + p.length + lamps.length);   // AUDIT SD II (L2 F14 - PIN MOVED): and the lamps' posts after them
  assert.deepEqual([...all.slice(floors.length, floors.length + p.length)], [...p]);
  for (let i = 0; i < p.length; i += 3) {
    const [x, y, z] = dungeonToRealm(p[i], p[i + 1], p[i + 2]);
    const ax = x - SD_ARENA.x, az = z - SD_ARENA.z;
    assert.ok(SD_PILLARS.some(([px, pz]) => Math.abs(ax - px) <= SD_PILLAR_W / 2 + 1e-4 && Math.abs(az - pz) <= SD_PILLAR_W / 2 + 1e-4), 'on a pillar\'s square');
    assert.ok(y >= -1e-6 && y <= SD_PILLAR_H + 1e-6);
  }
  const col = new Collider(() => -Infinity);
  const idx = new Uint32Array(p.length / 3);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  col.addMesh('sd:pillars', p, idx, identity());
  const rng = seeded(11);
  let shaded = 0, open = 0;
  for (let k = 0; k < 400; k++) {
    const ox = (rng() - 0.5) * 20, oz = (rng() - 0.5) * 20, a = rng() * Math.PI * 2, r = 6 + rng() * 20;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.hypot(x, z) > SD_ARENA.r) continue;
    const from = arenaToDungeon(ox, oz), to = arenaToDungeon(x, z);
    from[1] = 2; to[1] = 2;
    const d = [to[0] - from[0], 0, to[2] - from[2]], len = Math.hypot(d[0], d[2]);
    const hit = col.raycast(from, [d[0] / len, 0, d[2] / len], len);
    const law = behindPillar(ox, oz, x, z);
    const stone = Number.isFinite(hit) && hit < len - 1e-3;
    const insideOne = SD_PILLARS.some(([px, pz]) => (Math.abs(ox - px) < SD_PILLAR_W / 2 && Math.abs(oz - pz) < SD_PILLAR_W / 2) || (Math.abs(x - px) < SD_PILLAR_W / 2 && Math.abs(z - pz) < SD_PILLAR_W / 2));
    if (insideOne) continue;
    assert.equal(stone, law, `the stone and the law agree from (${ox.toFixed(2)}, ${oz.toFixed(2)}) to (${x.toFixed(2)}, ${z.toFixed(2)})`);
    if (law) shaded++; else open++;
  }
  assert.ok(shaded >= 10 && open >= 100, `both seen (${shaded} shaded, ${open} open)`);
  assert.ok(Math.hypot(...SD_PILLARS[0]) === SD_PILLAR_R || near(Math.hypot(...SD_PILLARS[0]), SD_PILLAR_R));
});

// ── the hosts ─────────────────────────────────────────────────────────

test('SD8c THE HOSTS, by source: the dungeon context makes the arena\'s set in the Hour alone, frames it beside the hall, clears it, and in the Hour answers the gate\'s three seams with it - the Remnant, its Echoes, the Reset\'s Hearts - and their doors out to the realm; the mode machine hands it the fight and the two doors and stands the pillars with the floors; the world host keeps the link online, hears the realm\'s fight words from its own slot, sends my `in` with my level and my blows, forgets the fight out of the realm and draws the bar near the arena (mutants: each seam left the court\'s; the bar never put away)', () => {
  const D = read('src/scenes/dungeonContext.js');
  assert.match(D, /const sdRemnant = _sdRealm \? createSdRemnant\(\{ renderer, link: \(\) => opts\.sdFight\?\.\(\) \?\? null, sendIn: \(\) => !!opts\.sdFightIn\?\.\(\), sendBlow: \(k, f\) => !!opts\.sdBlow\?\.\(k, f\), alive: \(\) => playerEntity\.health > 0 \}\) : null;/);
  assert.match(D, /if \(sdHall\) sdHallFrame\(dt, playerFeet\);[^\n]*\n\s+if \(sdRemnant\) sdRemnantFrame\(dt, playerFeet\);/);
  assert.match(D, /if \(playerFeet && !_sdRemnantStood\) \{ _sdRemnantStood = true; sdRemnant\.stand\(\{ dynamicDraws \}\); \}/);
  assert.match(D, /sdRemnant\?\.clear\(\);/);
  assert.match(D, /const b = sdRemnant \? sdRemnant\.target\(\) : opts\.gateBoss\?\.\(\) \?\? null;/);
  assert.match(D, /const list = sdRemnant \? sdRemnant\.heartTargets\(\) : opts\.gateCrystals\?\.\(\) \?\? null;/);
  assert.match(D, /const list = sdRemnant \? sdRemnant\.echoTargets\(\) : opts\.gateHost\?\.\(\) \?\? null;/);
  assert.match(D, /return sdRemnant \? sdRemnant\.hit\(\{ d: damage, r \}\) : !!opts\.onBossHit\?\.\(\{ d: damage, r \}\);/);
  assert.match(D, /sdRemnant \? sdRemnant\.heartHit\(\{ c: cr\.crystal, d: damage, r \}\)/);
  assert.match(D, /sdRemnant \? sdRemnant\.echoHit\(\{ i: hb\.host, d: damage, r \}\)/);
  const M = read('src/scenes/worldModes.js');
  assert.match(M, /sdFight: \(\) => host\.sdFight\?\.\(\) \?\? null,/);
  assert.match(M, /sdFightIn: \(\) => !!host\.sdFightIn\?\.\(\),/);
  assert.match(M, /sdBlow: \(k, f\) => !!host\.sdBlow\?\.\(k, f\),/);
  assert.match(M, /const tris = realmColliderTris\(\);/);
  const W = read('src/scenes/world.js');
  assert.match(W, /const sdFightLink = params\.has\('online'\) \? createSdFightLink\(\{ now: \(\) => Date\.now\(\) \+ _sharedOffsetMs, say: \(t\) => setMidScreenText\(t\) \}\) : null;/);
  assert.match(W, /online\.onSdFight = \(w\) => sdFightHeard\(w\);/);
  assert.match(W, /if \(!sdFightLink \|\| slot == null \|\| \(w\.k === 'st' && w\.s !== slot\)\) return;/);
  assert.match(W, /if \(!inRealm && _sdFightHeld\) \{ sdFightLink\.leave\(\); sdBlows\?\.leave\(\); _sdFightHeld = false; \}/);   // PIN MOVED (SD8d): its blows forgotten with it
  assert.match(W, /if \(sdBarNear\(x, z\)\) bar = remnantBarModel\(sdFightLink\.state\(\), sdFightLink\.now\(\)\);/);
  assert.match(W, /if \(bar \|\| _sdBarUp\) \{ drawGateBossBar\(bar, \{ hidden: gamePaused\(\) \|\| !!townTalk\.hudHidden \}\); _sdBarUp = !!bar; \}/);
  assert.match(W, /sdFightIn: \(\) => !!online\?\.sendSdIn\?\.\(playerEntity\.level\),/);
  assert.match(W, /sdBlow: \(k, f\) => !!online\?\.sendSdBlow\?\.\(k, f\),/);
  assert.match(W, /serpentAway\(!onlineOn\);[^\n]*sdFightAway\(\);/);
  const R = read('server/src/index.js');
  assert.match(R, /this\._send\(ws, JSON\.stringify\(\{ t: 'sd', \.\.\.remnantStateOf\(f\), me: 1 \}\)\);/);
  assert.equal((R.match(/me: 1/g) ?? []).length, 1, 'said in the answer alone');
});
