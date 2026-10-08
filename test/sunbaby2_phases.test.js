// SUNBABY2 — THE SUN BABY'S PHASES: THE WRATH, ITS FIRE, AND TODD (2026-10-04).
//
// The ask: "give it phases where it turns evil and starts raining fireballs upon daggerfall", then "and also a phase
// where it turns into todd howard". SUNBABY1's event (`/event sunbaby`) gains a cycle of faces read off the stage's
// own moment on the shared clock (world/sunbabySky.js), a fire that falls under the wrath through the spell engine's
// drawn missiles (scenes/hostMagic.js skyFire), and the host seams that carry both (scenes/shared.js, world.js).
//
// THE PINS, BY THE DOOR THEY GUARD:
//   the phases  - the cycle's table, each face's morph, the fire only while the wrath is whole, the first cycle risen
//                 laughing, and the line said for a change a player watched (never to a joiner)
//   the fire    - the shared clock's slots, bounded; landing round the eye on the ground, out of the sun's side of the
//                 sky; no backlog; and a fall the engine's missile always finishes
//   the land    - the wrath's light, key, haze and water
//   the look    - the GLSL from the tables (every new colour, Todd's finer grid) and the pass's face uniform
//   the engine  - skyFire: a drawn fire missile that lands where it was thrown, larger, heard there, burning nothing
//   the host    - the face each frame from the shared clock, said, handed to the sky and the light; the fire gated on
//                 the staged word and the wrath, reset on a jump, handed to the engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUNBABY_PHASES, SUNBABY_CYCLE_S, SUNBABY_MORPH_S, SUNBABY_FACE_LINES, SUNBABY_AMBIENT, SUNBABY_HORIZON, SUNBABY_ZENITH,
  SUNBABY_WRATH_ZENITH, SUNBABY_WRATH_HORIZON, SUNBABY_EMBERS, SUNBABY_WRATH_HEART, SUNBABY_WRATH_SKIN, SUNBABY_WRATH_RIM,
  SUNBABY_WRATH_RAY, SUNBABY_WRATH_EYE, SUNBABY_WRATH_DARK, SUNBABY_WRATH_FIRE, SUNBABY_WRATH_TOOTH, SUNBABY_WRATH_HORN,
  SUNBABY_WRATH_TINT, SUNBABY_TODD_SKIN, SUNBABY_TODD_HAIR, SUNBABY_TODD_IRIS, SUNBABY_TODD_LIP, SUNBABY_TODD_TOOTH,
  SUNBABY_TODD_DETAIL, SUNBABY_FIRE_SLOT_MS, SUNBABY_FIRE_CHANCE, SUNBABY_FIRE_SLOTS_MAX, SUNBABY_FIRE_SALT,
  SUNBABY_FIRE_NEAR_M, SUNBABY_FIRE_SPLIT_M, SUNBABY_FIRE_FAR_M, SUNBABY_FIRE_NEAR_SHARE, SUNBABY_FIRE_SPREAD,
  SUNBABY_FIRE_ELEV_DEG, SUNBABY_FIRE_FALL_M, SUNBABY_SUN_BEARING, SUNBABY_GLSL,
  createSunbaby, sunbabyPhase, sunbabyFireballs, sunbabyFireball, createSunbabyRain, sunbabyLight, sunbabyKey,
  sunbabyHaze, sunbabyWaterSky,
} from '../src/world/sunbabySky.js';
import { EXTERIOR_NIGHT_AMBIENT } from '../src/world/worldClock.js';
import { SunbabySkyRenderer, SUNBABY_FS as FS } from '../src/render/sunbabySkyRenderer.js';
import { createPlayerMagic, SKY_FIRE_SCALE, SKY_FIRE_HEARD_M } from '../src/scenes/hostMagic.js';
import { MISSILE_SPEED, MISSILE_LIFESPAN_S } from '../src/systems/spellcast.js';
import { SPELL_CAST_SOUND } from '../src/systems/enemySpells.js';
import { billboardSize } from '../src/world/rmbFlats.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < eps);
const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// ── THE PHASES ───────────────────────────────────────────────────────

test('SUNBABY2 phases: one cycle - the baby 60 s, the wrath 45 s, the baby 30 s, Todd 30 s - each face morphing in over SUNBABY_MORPH_S (SUNBABY3: 1 s); the said lines (mutants: none of their own - the table is the law)', () => {
  assert.deepEqual(SUNBABY_PHASES, [{ face: 'baby', s: 60 }, { face: 'evil', s: 45 }, { face: 'baby', s: 30 }, { face: 'todd', s: 30 }]);
  assert.ok(Object.isFrozen(SUNBABY_PHASES) && SUNBABY_PHASES.every(Object.isFrozen));
  assert.equal(SUNBABY_CYCLE_S, 165);
  assert.equal(SUNBABY_MORPH_S, 1);   // SUNBABY3 moved it: "transition much faster" (6 s)
  assert.deepEqual(SUNBABY_FACE_LINES, {
    evil: 'The sun baby stops laughing. Its eyes burn - fire rains on Daggerfall!',
    baby: 'The sun baby giggles again.',
    todd: 'The sun baby becomes Todd Howard. Sixteen times the flowers. It just works.',
  });
});

test('SUNBABY2 phases: the face at each second of the cycle - the wrath and Todd smoothed in and out at the head of the phase after, the fire only while the wrath is WHOLE, and the first cycle rises laughing rather than morphing out of Todd (mutants: the first cycle morphed; the fire early; no morph)', () => {
  const at = (s) => { const p = sunbabyPhase(s); return [p.index, p.face, +p.evil.toFixed(6), +p.todd.toFixed(6), p.fire]; };
  assert.deepEqual(at(0), [0, 'baby', 0, 0, false], 'it rises laughing');
  for (const s of [NaN, -5, undefined]) assert.deepEqual(at(s), [0, 'baby', 0, 0, false], `${s}: before the stage, or none, is its first moment`);
  assert.deepEqual(at(59.9), [0, 'baby', 0, 0, false]);
  assert.deepEqual(at(60), [1, 'evil', 0, 0, false], 'the wrath begins as the baby');
  // SUNBABY3 moved these: the morph is 1 s
  assert.deepEqual(at(60.5), [1, 'evil', 0.5, 0, false], 'half way');
  assert.deepEqual(at(60.75), [1, 'evil', 0.84375, 0, false], 'smoothstep, and no fire before it is whole');
  assert.deepEqual(at(61), [1, 'evil', 1, 0, true], 'whole: the fire falls');
  assert.deepEqual(at(104.9), [1, 'evil', 1, 0, true]);
  assert.deepEqual(at(105), [2, 'baby', 1, 0, false], 'the baby comes back out of the wrath, and the fire stops at once');
  assert.deepEqual(at(105.5), [2, 'baby', 0.5, 0, false]);
  assert.deepEqual(at(106), [2, 'baby', 0, 0, false]);
  assert.deepEqual(at(135), [3, 'todd', 0, 0, false]);
  assert.deepEqual(at(135.5), [3, 'todd', 0, 0.5, false]);
  assert.deepEqual(at(136), [3, 'todd', 0, 1, false]);
  assert.deepEqual(at(165), [0, 'baby', 0, 1, false], 'the second cycle begins as Todd');
  assert.deepEqual(at(165.5), [0, 'baby', 0, 0.5, false]);
  assert.deepEqual(at(166), [0, 'baby', 0, 0, false]);
  assert.deepEqual(at(165 * 40 + 70), at(70), 'it wraps');
});

test('SUNBABY2 phases: createSunbaby keeps the stage\'s moment and frames the face on the shared clock - a change a player watched is said once, a joiner is told nothing, the end\'s fade keeps the face, and another word moves nothing (mutants: a joiner told; the moment dropped at the end)', () => {
  const T = 1_700_000_000_000, ms = (s) => T + s * 1000;
  const s = createSunbaby();
  s.set({ kind: 'sunbaby', at: T }, { live: true });
  assert.deepEqual([s.frame(ms(10)).face, s.frame(ms(10)).line], ['baby', null], 'the stage is no change of face');
  assert.equal(s.frame(ms(59)).line, null);
  const w = s.frame(ms(61));
  assert.equal(w.face, 'evil');
  assert.equal(w.line, SUNBABY_FACE_LINES.evil, 'watched: said');
  assert.equal(s.frame(ms(62)).line, null, 'once');
  assert.equal(s.frame(ms(66)).fire, true);
  assert.equal(s.frame(ms(140)).line, SUNBABY_FACE_LINES.todd, 'frames that skipped the baby\'s whole phase (indoors) name the face they see');
  assert.equal(s.frame(ms(141)).line, null);
  const j = createSunbaby();
  j.set({ kind: 'sunbaby', at: T }, { live: false });
  const jf = j.frame(ms(70));
  assert.deepEqual([jf.face, jf.evil, jf.fire, jf.line], ['evil', 1, true, null], 'a joiner comes in on the wrath, untold');
  assert.equal(j.frame(ms(106)).line, SUNBABY_FACE_LINES.baby, 'and is told the next change');
  j.set({ kind: 'dread', at: ms(200) }, { live: true });
  assert.equal(j.on, false);
  const end = j.frame(ms(70));
  assert.deepEqual([end.face, end.evil, end.line], ['evil', 1, null], 'the sky fades out on the face it wore; nothing is said off the event');
  assert.equal(createSunbaby().frame(ms(70)).face, 'baby', 'no event: the baby');
});

// ── THE FIRE ─────────────────────────────────────────────────────────

test('SUNBABY2 fire: the shared clock\'s slots - the same fireballs for every client, a window split anywhere the same as whole, about the chance\'s share of slots, at most SUNBABY_FIRE_SLOTS_MAX a tick (mutants: the chance ignored; the slots unbounded)', () => {
  assert.deepEqual([SUNBABY_FIRE_SLOT_MS, SUNBABY_FIRE_CHANCE, SUNBABY_FIRE_SLOTS_MAX, SUNBABY_FIRE_SALT], [250, 0.7, 8, 0x5b0b]);
  const a = 1_700_000_000_000, b = a + 1900, m = a + 777;
  const whole = sunbabyFireballs(a, b);
  assert.deepEqual(whole, sunbabyFireballs(a, b), 'pure');
  assert.deepEqual([...sunbabyFireballs(a, m), ...sunbabyFireballs(m, b)], whole, 'a window split is the window');
  for (const f of whole) assert.ok(f.atMs > a && f.atMs <= b);
  let n = 0;
  for (let t = a; t < a + 120_000; t += 1000) n += sunbabyFireballs(t, t + 1000).length;
  const want = 120_000 / SUNBABY_FIRE_SLOT_MS * SUNBABY_FIRE_CHANCE;
  assert.ok(Math.abs(n - want) < want * 0.15, `about ${want} in two minutes, got ${n}`);
  const late = sunbabyFireballs(a, a + 3_600_000);
  assert.ok(late.length <= SUNBABY_FIRE_SLOTS_MAX && late.every((f) => f.atMs > a + 3_600_000 - SUNBABY_FIRE_SLOTS_MAX * SUNBABY_FIRE_SLOT_MS), 'a tab asleep an hour drops two seconds, not an hour');
  assert.deepEqual(sunbabyFireballs(b, a), []);
});

test('SUNBABY2 fire: each lands round the eye inside the ring, on the ground there, and falls out of the sun\'s side of the sky, steep, FALL_M up its line - a fall the engine\'s missile always finishes (mutants: from below; the ground ignored)', () => {
  assert.deepEqual([SUNBABY_FIRE_NEAR_M, SUNBABY_FIRE_SPLIT_M, SUNBABY_FIRE_FAR_M, SUNBABY_FIRE_NEAR_SHARE, SUNBABY_FIRE_SPREAD, SUNBABY_FIRE_FALL_M], [8, 30, 120, 0.35, 0.6, 90]);
  assert.deepEqual(SUNBABY_FIRE_ELEV_DEG, [58, 80]);
  assert.ok(SUNBABY_FIRE_FALL_M / MISSILE_SPEED < MISSILE_LIFESPAN_S - 2, 'it lands with seconds of the engine\'s lifespan to spare');
  const all = [];
  for (let t = 0; t < 60_000; t += 1000) all.push(...sunbabyFireballs(1_700_000_000_000 + t, 1_700_000_000_000 + t + 1000));
  const nearN = all.filter((f) => f.distance < SUNBABY_FIRE_SPLIT_M).length;
  assert.ok(Math.abs(nearN / all.length - SUNBABY_FIRE_NEAR_SHARE) < 0.1, 'about the near share lands close');
  const eye = [100, 40, -50];
  for (const s of all) {
    assert.ok(s.distance >= SUNBABY_FIRE_NEAR_M && s.distance <= SUNBABY_FIRE_FAR_M);
    assert.ok(Math.abs(s.az - SUNBABY_SUN_BEARING) <= SUNBABY_FIRE_SPREAD + 1e-12, 'out of the sun\'s side');
    const deg = s.elev * 180 / Math.PI;
    assert.ok(deg >= SUNBABY_FIRE_ELEV_DEG[0] && deg <= SUNBABY_FIRE_ELEV_DEG[1], 'steep');
    const asked = [];
    const f = sunbabyFireball(s, eye, (x, z) => { asked.push([x, z]); return 3 + x * 0.01; });
    assert.deepEqual(asked, [[f.to[0], f.to[2]]], 'the ground under it is asked');
    assert.ok(Math.abs(f.to[1] - (3 + f.to[0] * 0.01)) < 1e-9, 'it lands on it');
    assert.ok(Math.abs(Math.hypot(f.to[0] - eye[0], f.to[2] - eye[2]) - s.distance) < 1e-9);
    const up = [f.from[0] - f.to[0], f.from[1] - f.to[1], f.from[2] - f.to[2]];
    assert.ok(Math.abs(Math.hypot(...up) - SUNBABY_FIRE_FALL_M) < 1e-9);
    assert.ok(up[1] > SUNBABY_FIRE_FALL_M * Math.sin(SUNBABY_FIRE_ELEV_DEG[0] * Math.PI / 180) - 1e-9, 'from above');
    assert.ok(up[0] * Math.cos(SUNBABY_SUN_BEARING) + up[2] * Math.sin(SUNBABY_SUN_BEARING) > 0, 'from the sun\'s side');
    assert.equal(f.seed, s.seed);
  }
  const s0 = all[0];
  assert.equal(sunbabyFireball(s0, eye, () => -Infinity).to[1], eye[1], 'nothing streamed there: the eye\'s height');
  assert.equal(sunbabyFireball(s0, eye).to[1], eye[1]);
});

test('SUNBABY2 fire: the rain on a client drops nothing on its first tick, nothing while the wrath is not whole and no backlog when it is, the slots since the last tick after; a clock gone back or a reset starts from now (mutants: a backlog; the fire ungated)', () => {
  const rain = createSunbabyRain(), eye = [0, 0, 0], T = 1_700_000_000_000;
  assert.deepEqual(rain.tick({ sharedMs: T, eye, fire: true }), [], 'the first tick');
  assert.deepEqual(rain.tick({ sharedMs: T + 10_000, eye, fire: false }), [], 'no wrath, no fire');
  const got = rain.tick({ sharedMs: T + 11_000, eye, fire: true });
  assert.deepEqual(got.map((f) => f.seed), sunbabyFireballs(T + 10_000, T + 11_000).map((s) => s.seed), 'the second since, and nothing of the ten before');
  assert.ok(got.length > 0);
  assert.deepEqual(rain.tick({ sharedMs: T + 5_000, eye, fire: true }), [], 'the clock went back');
  assert.ok(rain.tick({ sharedMs: T + 7_000, eye, fire: true }).length > 0);
  rain.reset();
  assert.deepEqual(rain.tick({ sharedMs: T + 9_000, eye, fire: true }), [], 'reset: from now');
});

// ── THE LAND ─────────────────────────────────────────────────────────

test('SUNBABY2 the land: under the wrath the lifted ambient and the key redden by the tint, the haze and the water burn - each by the event\'s weight, and the laughing sky\'s exactly at no wrath (mutants: the light untinted; the key untinted; the haze unburnt)', () => {
  assert.deepEqual(SUNBABY_WRATH_TINT, [1.0, 0.52, 0.40]);
  assert.ok(near([...sunbabyLight(EXTERIOR_NIGHT_AMBIENT, 1, 1)], SUNBABY_AMBIENT.map((v, i) => v * SUNBABY_WRATH_TINT[i]), 1e-6), 'midnight under the wrath: its bright day, reddened');
  assert.ok(near([...sunbabyLight([0.5, 0.5, 0.5], 0.5, 1)], [0.5, 0.5, 0.5].map((v, i) => (v + Math.max(0, SUNBABY_AMBIENT[i] - v) * 0.5) * (1 + (SUNBABY_WRATH_TINT[i] - 1) * 0.5)), 1e-6), 'by the weight');
  assert.ok(near([...sunbabyLight([0.25, 0.3, 0.35], 0, 1)], [0.25, 0.3, 0.35]), 'no event: the light as given');
  assert.ok(near([...sunbabyLight([0.25, 0.3, 0.35], 1, 0)], [...sunbabyLight([0.25, 0.3, 0.35], 1)]), 'no wrath: SUNBABY1\'s');
  const key = sunbabyKey([1, 0.9, 0.8], 1, 1);
  assert.ok(key instanceof Float32Array);
  assert.ok(near([...key], [1, 0.9 * 0.52, 0.8 * 0.4], 1e-6));
  assert.ok(near([...sunbabyKey([1, 0.9, 0.8], 0, 1)], [1, 0.9, 0.8]) && near([...sunbabyKey([1, 0.9, 0.8], 1, 0)], [1, 0.9, 0.8]));
  assert.ok(near(sunbabyHaze([0.2, 0.3, 0.4], 1, 1), SUNBABY_WRATH_HORIZON));
  assert.ok(near(sunbabyHaze([0.2, 0.3, 0.4], 1, 0), SUNBABY_HORIZON));
  const ws = { zenith: [0, 0, 0], horizon: [1, 1, 1] };
  const w1 = sunbabyWaterSky(ws, 1, 1);
  assert.ok(near(w1.zenith, SUNBABY_WRATH_ZENITH) && near(w1.horizon, SUNBABY_WRATH_HORIZON));
  const w0 = sunbabyWaterSky(ws, 1, 0);
  assert.ok(near(w0.zenith, SUNBABY_ZENITH) && near(w0.horizon, SUNBABY_HORIZON));
  assert.equal(sunbabyWaterSky(ws, 0, 1), ws, 'no event: the water\'s own sky');
});

// ── THE LOOK ─────────────────────────────────────────────────────────

test('SUNBABY2 GLSL: the wrath\'s and Todd\'s faces are generated from the tables - every colour, Todd\'s grid SUNBABY_TODD_DETAIL times finer (sixteen times the flowers) - and the sun wears the face the pass is handed', () => {
  const v3 = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
  for (const c of [SUNBABY_WRATH_ZENITH, SUNBABY_WRATH_HORIZON, ...SUNBABY_EMBERS, SUNBABY_WRATH_HEART, SUNBABY_WRATH_SKIN, SUNBABY_WRATH_RIM, SUNBABY_WRATH_RAY,
    SUNBABY_WRATH_EYE, SUNBABY_WRATH_DARK, SUNBABY_WRATH_FIRE, SUNBABY_WRATH_TOOTH, SUNBABY_WRATH_HORN, SUNBABY_TODD_SKIN, SUNBABY_TODD_HAIR, SUNBABY_TODD_IRIS,
    SUNBABY_TODD_LIP, SUNBABY_TODD_TOOTH]) assert.ok(SUNBABY_GLSL.includes(v3(c)), v3(c));
  assert.equal(SUNBABY_TODD_DETAIL ** 2, 16, 'sixteen times the detail');
  assert.ok(SUNBABY_GLSL.includes(`* (1.0 + ${(SUNBABY_TODD_DETAIL - 1).toFixed(4)} * todd)`), 'the grid, finer under Todd');
  assert.match(SUNBABY_GLSL, /float evil = clamp\(face\.x, 0\.0, 1\.0\), todd = clamp\(face\.y, 0\.0, 1\.0\);/);
  assert.match(SUNBABY_GLSL, /col = sbSun\(col, uv, upx, t, evil, todd, photo, photoOn, duv\);/);   // SUNBABY3 moved it: the photograph
  assert.match(SUNBABY_GLSL, /vec4 l1 = sbFlowers\(p2, px2, 1\.0, [\d.]+, t, evil\);[\s\S]*vec4 l0 = sbFlowers\(p, px, 0\.0, [\d.]+, t, evil\);/, 'both layers burn');
  assert.match(FS, /uniform vec2 uFace;/);
});

/** A WebGL2 that records every call (constants answer their own names) - SUNBABY1's. */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k.startsWith('create')) return { k };
        return undefined;
      };
    },
  });
  return { gl, calls };
}

test('SUNBABY2 pass: the face the pass is handed reaches its uniform - the laughing baby at 0 and 0 (mutants: the face never set)', () => {
  const { gl, calls } = fakeGl();
  const p = new SunbabySkyRenderer(gl);
  assert.deepEqual([p.evil, p.todd], [0, 0]);
  p.weight = 1;
  p.draw(0, 0.3, 1.1, 1.5);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uFace'), ['uniform2f', 'uFace', 0, 0]);
  calls.length = 0;
  p.evil = 0.25; p.todd = 0.5;
  p.draw(0, 0.3, 1.1, 1.5);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uFace'), ['uniform2f', 'uFace', 0.25, 0.5]);
});

// ── THE ENGINE ───────────────────────────────────────────────────────

function magicRig() {
  const made = [], heard = [];
  const tex = { recordCount: 5, getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const player = { level: 1, activeEffects: [], health: 50, maxHealth: 50 };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.push(b); return b; }, destroyBillboardBatch() {} },
    audio: { playOneShotId() {}, play3dId: (...a) => heard.push(a) },
    getTexture: async () => tex, uploadRecord() {}, uploadRecordFrame() {}, collider: { raycast: () => Infinity },
    playerEntity: player, playerSinks: {}, say() {}, surfacePlayer() {},
    foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: false, day: true }),
  });
  return { magic, made, heard, tex, player };
}

test('SUNBABY2 engine: skyFire throws a DRAWN fire missile from the sky that lands where it was thrown - on the ground the collider\'s ray never meets - SKY_FIRE_SCALE times the flat, heard there as its element\'s cast, and burning nobody (mutants: the landing unchecked; silent; the scale dropped)', async () => {
  assert.deepEqual([SKY_FIRE_SCALE, SKY_FIRE_HEARD_M], [3, 48]);
  const { magic, made, heard, tex, player } = magicRig();
  for (const bad of [{ from: [0, 90, 0], to: [NaN, 0, 0] }, { from: [0, 90], to: [0, 0, 0] }, { from: [1, 2, 3], to: [1, 2, 3] }, {}]) assert.equal(magic.skyFire(bad), false, JSON.stringify(bad));
  assert.equal(magic.skyFire({ from: [0, 90, 0], to: [0, 0, 0] }), true);
  assert.equal(magic.missileCount(), 1);
  const feet = [40, 0, 40];   // not under it
  magic.update(1 / 60, feet, [0, 0, 1]);
  await settle(5);
  const ball = made.find((b) => b.archive === 375 && b.record === 0);
  assert.ok(ball, 'the fire missile\'s flat (archive 375)');
  const own = billboardSize(tex, 0);
  assert.deepEqual([ball.size.w, ball.size.h], [own.w * SKY_FIRE_SCALE, own.h * SKY_FIRE_SCALE], 'drawn larger');
  const fall = 90 / MISSILE_SPEED;
  let t = 1 / 60;
  while (t < fall - 0.1) { magic.update(1 / 60, feet, [0, 0, 1]); t += 1 / 60; }
  assert.equal(magic.missileCount(), 1, 'still falling');
  assert.deepEqual(heard, [], 'not heard before it lands');
  for (let i = 0; i < 20; i++) magic.update(1 / 60, feet, [0, 0, 1]);
  assert.equal(magic.missileCount(), 0, 'landed where it was thrown, though the ray met nothing');
  assert.equal(heard.length, 1);
  assert.deepEqual(heard[0], [SPELL_CAST_SOUND[0], [0, 0, 0], 1, { maxDistance: SKY_FIRE_HEARD_M }], 'fire\'s clip, from where it landed');
  assert.equal(player.health, 50, 'an event burns nobody');
  await settle(5);
  assert.ok(made.some((b) => b.archive === 375 && b.record === 1), 'the impact flash, record 1 of its archive');
});

// ── THE HOST ─────────────────────────────────────────────────────────

test('SUNBABY2 host: the sky controller hands the face to the pass, and world.js frames it from the shared clock each exterior frame - said when it changes, handed to the sky before its frame and to the light and the key - and drops the fire round the traveller only while the word is staged and the wrath whole, reset on a jump, through the spell engine (mutants: the face never told; the line unsaid; the fire ungated; the fire never thrown)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /setSunbabyFace\(evil = 0, todd = 0\) \{\s*sunbabyEvil = Math\.max\(0, Math\.min\(1, Number\(evil\) \|\| 0\)\);\s*sunbabyTodd = Math\.max\(0, Math\.min\(1, Number\(todd\) \|\| 0\)\);\s*if \(sunbabySky\) \{ sunbabySky\.evil = sunbabyEvil; sunbabySky\.todd = sunbabyTodd; \}/);
  const world = rd('src/scenes/world.js');
  assert.match(world, /const sunbabyW = sunbaby\.tick\(dt\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const sunbabyFace = sunbaby\.frame\(Date\.now\(\) \+ _sharedOffsetMs\);\n\s*if \(sunbabyFace\.line\) townTalk\.say\(sunbabyFace\.line\);/);
  assert.match(world, /if \(jump\) sunbabyRain\.reset\(\);\n\s*for \(const fb of sunbabyRain\.tick\(\{ sharedMs: Date\.now\(\) \+ _sharedOffsetMs, eye: tvStand, fire: sunbaby\.on && sunbabyFace\.fire, ground: sunbabyGround \}\)\) magic\.skyFire\(fb\);/);
  assert.match(world, /const sunbabyGround = \(x, z\) => \{ const h = heightAt\(x, z\); return Number\.isFinite\(h\) \? h : player\.pos\[1\]; \};/);
  const told = world.indexOf('sky.setSunbabyFace(sunbabyFace.evil, sunbabyFace.todd);');
  assert.ok(told > world.indexOf('sky.setSunbaby(sunbabyW, sunbaby.on);') && told < world.indexOf('sky.use(('), 'before the sky\'s frame');
  assert.match(world, /sunbabyKey\(dreadLight\(SUN_RIG_COLOR, skyDreadW\), sunbabyW, sunbabyFace\.evil\), sdAirW\)\);/);   // SD19 moved it: the key leaning brass near a Hollow (PIN MOVED)
});
