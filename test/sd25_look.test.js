// SD25 (2026-10-08, the Abyss Dungeon's look; bible/11-Multiplayer/Super-Dungeons-Look.md): the rebuilt fidelity's pins,
// a slice at a time. SD-FLASH (S0): the Beat step's warning blinks under the project's flash ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SD_STEPS_COURSE, SD_BEAT_SOLID, SD_BEAT_BLINK, beatWarned } from '../src/world/sdSteps.js';
import { createSdSteps, SD_BEAT_BLINK_HZ } from '../src/scenes/sdSteps.js';
import { TELEGRAPH_THROB_MAX_HZ } from '../src/render/gateTelegraph.js';

/** A realm second on a whole Beat cycle (sd7b's). */
const T0 = 1_800_000_000 - (1_800_000_000 % 36);

test('SD-FLASH: a Beat step\'s warning falters at most three times a second (TELEGRAPH_THROB_MAX_HZ) - its 0.4 s is one falter, timed from the warning\'s own start: shown first, then out, still solid (mutants: the old 8; the falter on the absolute clock)', () => {
  assert.ok(SD_BEAT_BLINK_HZ <= TELEGRAPH_THROB_MAX_HZ);
  const renderer = { createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {} };
  const steps = createSdSteps({ renderer, audio: { playOneShot() {}, play3d() {} } });
  steps.stand({ dynamicDraws: [], collider: { addMesh() {} } });
  for (const i of SD_STEPS_COURSE.map((s, k) => (s.kind === 'beat' ? k : -1)).filter((k) => k >= 0)) {
    const s = SD_STEPS_COURSE[i], seen = [];
    for (let cyc = 0; cyc < 3; cyc++) {
      const from = T0 + cyc * 3.6 + s.beat + SD_BEAT_SOLID - SD_BEAT_BLINK;
      assert.ok(Math.abs(beatWarned(s, from + 0.05) - 0.05) < 1e-6, `step ${i}: the warning's clock`);
      seen.length = 0;
      for (let k = 0; k < 24; k++) {
        steps.ride(from + (k + 0.5) / 60, 1 / 60, null);
        assert.equal(steps.steps[i].solid, true, `step ${i}: warning, still there`);
        seen.push(!steps.steps[i].matrix.every((x) => x === 0));
      }
      const falters = seen.filter((v, k) => !v && (k === 0 || seen[k - 1])).length;
      assert.equal(seen[0], true, `step ${i}: shown as the warning starts`);
      assert.ok(falters >= 1 && falters / SD_BEAT_BLINK <= TELEGRAPH_THROB_MAX_HZ, `step ${i}: ${falters} falters in ${SD_BEAT_BLINK} s`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// S1 - THE GRADE, THE LIGHT AND THE FLOORS: the amber soup ended.
// ---------------------------------------------------------------------------------------------------------------------
import { SD_RAMP, SD_LIGHT, SD_HOUR_GRADE, SD_TICK_EASE_S, sdTick, handToTwelve } from '../src/world/sdLook.js';
import { offPalette, paletteOf, ramp, quantize, image, put } from '../src/world/sdPixelKit.js';
import {
  realmFloorArt, realmBrassArt, realmRootArt, realmArenaArt, realmCobbleArt, realmEdgeArt, SD_BRASS_EDGE_GLOW, SD_EDGE_GLOW,
} from '../src/world/sdRealmArt.js';
import {
  buildRealmModel, SD_REALM_TRILIGHT, SD_REALM_KEY_LIGHT, SD_REALM_FOG, SD_LAMP_COLOR, SD_REALM_BRASS_RECORD, SD_REALM_EDGE_RECORD,
  SD_REALM_ARENA_RECORD, SD_REALM_COBBLE_RECORD, SD_ISLAND_SIDES, SD_RIM_H, SD_TOOTH_TOP, SD_TOOTH_OUT, SD_TOOTH_PITCH, SD_ARENA_BANDS,
  SD_COMPASS, SD_ARRIVE_Z, SD_INLAY_H, realmClamp,
} from '../src/world/sdRealm.js';
import { SD_THRESHOLD, SD_ORRERY, SD_ARENA, SD_WALK, dungeonToRealm, realmToDungeon } from '../src/net/sdBrain.js';
import { SD_FX_COLOR } from '../src/scenes/sdFx.js';
import { SD_GLOW_COLORS } from '../src/world/sdHallArt.js';
import { SD_BEAM_CORE } from '../src/render/sdBeam.js';
import { TURNING_STEP_S, turningWheelAngle, TURNING_HZ } from '../src/render/auraRing.js';
import { AirPass, AIR_ADAPT_KEY, AIR_ADAPT_MAX, AIR_BLOOM_STRENGTH, AIR_VIGNETTE, AIR_CONTRAST } from '../src/render/airPass.js';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SD-LOOK the look in one place: every ramp five steps or more, dark to light; the five lights and the moment the values of their homes (nothing re-pointed); the escapement the Turning Hour aura\'s own; a countdown\'s hand to twelve (mutants: a light re-valued; the escapement unheld)', () => {
  for (const [k, r] of Object.entries(SD_RAMP)) {
    assert.ok(r.length >= 5, `${k}: ${r.length} steps`);
    if (k !== 'baySky') for (let i = 1; i < r.length; i++) assert.ok(r[i][0] + r[i][1] + r[i][2] > r[i - 1][0] + r[i - 1][1] + r[i - 1][2], `${k}: dark to light`);
  }
  assert.deepEqual(SD_RAMP.void[0], [5, 4, 3], 'nothing darker than the void\'s first step');
  assert.deepEqual([...SD_LIGHT.gold], [...SD_LAMP_COLOR]);
  assert.deepEqual([...SD_LIGHT.mantella], [...SD_FX_COLOR.mantella]);
  assert.deepEqual([...SD_LIGHT.moon], [...SD_FX_COLOR.pale]);
  assert.deepEqual([...SD_LIGHT.red], [...SD_FX_COLOR.end]);
  assert.deepEqual([...SD_LIGHT.moment], [...SD_BEAM_CORE]);
  assert.deepEqual(SD_LIGHT.ember.map((v) => Math.round(v * 255)), [...SD_GLOW_COLORS.fray]);
  assert.equal(SD_TICK_EASE_S, TURNING_STEP_S);
  for (const t of [0, 0.1, 0.24, 0.25, 0.7, 1.0, 7.13, 12345.9]) assert.ok(Math.abs(sdTick(t) * -Math.PI * 2 * TURNING_HZ.wheel - turningWheelAngle(t)) < 1e-9, `the aura's wheel at ${t}`);
  assert.equal(sdTick(3.5), 4, 'held after its ease');
  assert.equal(sdTick(3), 3);
  for (let t = 0; t < 4; t += 0.01) assert.ok(sdTick(t + 0.01) >= sdTick(t), 'never back');
  assert.deepEqual([handToTwelve(8, 8), handToTwelve(2, 8), handToTwelve(0, 8), handToTwelve(-1, 8), handToTwelve(9, 8), handToTwelve(1, 0)], [1, 0.25, 0, 0, 1, 0]);
});

test('SD-LOOK the paint box: a ramp through the ordered dither is always one of its steps, the 4x4 Bayer order the shaders\' own; quantize forces every texel into the palette (mutants: a blend between steps)', () => {
  const r = SD_RAMP.basalt, keys = new Set(r.map((c) => c.join()));
  let seenSteps = new Set();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (const t of [0, 0.13, 0.5, 0.61, 0.99, 1]) { const c = ramp(r, t, x, y); assert.ok(keys.has(c.join()), `${c} a step`); seenSteps.add(c.join()); }
  assert.ok(seenSteps.size >= 4, 'it does step');
  // a half-way t dithers half and half over a 4x4 tile
  let hi = 0;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ramp([[0, 0, 0], [10, 10, 10]], 0.5, x, y)[0] === 10) hi++;
  assert.equal(hi, 8);
  const img = image(4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) put(img, x, y, [x * 40, y * 30, 7]);
  assert.ok(offPalette(img, paletteOf(r)) > 0);
  assert.equal(offPalette(quantize(img, paletteOf(r)), paletteOf(r)), 0);
});

test('SD-LOOK THE FLOORS DO NOT GLOW: stone, earth and bronze paint with no light of their own - the joints that were the neon grid (0.18), the roots\' veins (0.35), the arena\'s cracks (0.8) gone; brass glows only on its rubbed edges, at SD_BRASS_EDGE_GLOW; the edge line alone at the ambient rung; every picture in its ramps (mutants: a joint lit; brass glowing whole; a picture off its palette)', () => {
  const lit = (img) => { let n = 0; for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] || img.colors[i + 1] || img.colors[i + 2]) n++; return n; };
  for (const [name, a] of [['floor', realmFloorArt()], ['root', realmRootArt()], ['arena', realmArenaArt()], ['cobble', realmCobbleArt()]]) assert.equal(lit(a.emission), 0, `${name}: no light of its own`);
  const brass = realmBrassArt(), S = brass.albedo.width;
  let glowing = 0;
  for (let i = 0; i < brass.emission.colors.length; i += 4) {
    const e = brass.emission.colors[i], a = brass.albedo.colors[i];
    if (e) { glowing++; assert.ok(e <= Math.ceil(a * SD_BRASS_EDGE_GLOW), 'a worn edge\'s glint, no more'); }
  }
  assert.ok(glowing > 0 && glowing <= S * 4 + 4, `brass glows only on its rubbed rows (${glowing} of ${S * S})`);
  const edge = realmEdgeArt();
  for (let i = 0; i < edge.emission.colors.length; i += 4) assert.ok(Math.abs(edge.emission.colors[i] - edge.albedo.colors[i] * SD_EDGE_GLOW) <= 1, 'the edge line at the ambient rung');
  const { basalt, cobble, brass: Br, bronze, earth, verdigris, void: Vo } = SD_RAMP;
  assert.equal(offPalette(realmFloorArt().albedo, paletteOf(basalt)), 0, 'the flags in basalt');
  assert.equal(offPalette(realmCobbleArt().albedo, paletteOf(cobble, Br)), 0, 'the street in cobble and brass');
  assert.equal(offPalette(realmArenaArt().albedo, paletteOf(bronze)), 0, 'the arena in bronze');
  assert.equal(offPalette(brass.albedo, paletteOf(Br, verdigris)), 0, 'brass in brass and verdigris');
  assert.equal(offPalette(realmRootArt().albedo, paletteOf(basalt, earth, Br, Vo)), 0, 'the root in its strata');
});

test('SD-LOOK THE LIGHT: the void over dimmer, the furnace under warm and brighter (up-light on every underside), the key paler and stronger, the haze unchanged - the void stays black (mutants: the furnace dark)', () => {
  const sum = (c) => c[0] + c[1] + c[2];
  assert.ok(sum(SD_REALM_TRILIGHT.ground) > sum(SD_REALM_TRILIGHT.sky), 'the furnace below outshines the void above');
  assert.ok(SD_REALM_TRILIGHT.ground[0] > 3 * SD_REALM_TRILIGHT.ground[2], 'and it is warm');
  assert.ok(sum(SD_REALM_TRILIGHT.sky) < 0.6, 'the void over it dim');
  assert.equal(SD_REALM_KEY_LIGHT.scale, 0.65);
  assert.deepEqual([...SD_REALM_FOG.color], [0.2, 0.15, 0.07]);
  assert.equal(SD_REALM_FOG.density, 0.0045);
});

test('SD-LOOK THE GRADE: the Hour\'s on the lane holds the eye down (key 0.12, at most 1.15x) with a little more bloom, vignette and contrast; the resolve takes the frame\'s grade and every frame that asks none gets the lane\'s defaults back; the dungeon arm asks it in the Hour alone (mutants: the grade kept past its frame; the defaults never restored)', () => {
  assert.deepEqual({ ...SD_HOUR_GRADE }, { adaptKey: 0.12, adaptMax: 1.15, bloom: 0.8, vignette: 0.34, contrast: 1.08 });
  const air = Object.create(AirPass.prototype);
  air.grade = new Float32Array([0, 1, 0, 0]); air.adaptParams = new Float32Array([0, 0, 0.7, 0]);
  air.setGrade(SD_HOUR_GRADE);
  assert.deepEqual([...air.grade].map((v) => +v.toFixed(4)), [0.8, 1, 0.34, 1.08]);
  assert.deepEqual([...air.adaptParams].map((v) => +v.toFixed(4)), [0, 0.12, 0.7, 1.15]);
  air.setGrade(null);
  assert.deepEqual([...air.grade].map((v) => +v.toFixed(4)), [AIR_BLOOM_STRENGTH, 1, AIR_VIGNETTE, AIR_CONTRAST].map((v) => +v.toFixed(4)));
  assert.deepEqual([...air.adaptParams].map((v) => +v.toFixed(4)), [0, AIR_ADAPT_KEY, 0.7, AIR_ADAPT_MAX].map((v) => +v.toFixed(4)));
  const R = read('src/render/renderer.js');
  assert.match(R, /if \(!this\._air\?\.pending\) return;[^]{0,900}this\._air\.setGrade\?\.\(this\._sceneGrade\); this\._sceneGrade = null;[^]{0,900}this\._air\.composite\(\);/, 'every resolve takes the frame\'s grade, and gives it up');
  assert.match(R, /setSceneGrade\(g\) \{ this\._sceneGrade = g \?\? null; \}/);
  const W = read('src/scenes/worldModes.js');
  assert.equal((W.match(/setSceneGrade/g) ?? []).length, 1, 'the Hour alone asks a grade: the Hollow keeps the defaults');
});

test('SD-LOOK THE ISLANDS: the Threshold the Bay\'s cobbles and its compass rose (the long point at the Orrery, the tail at the way back); every rim toothed outside its disc and under its top (the motor never meets a tooth), a gold edge line along every rim and the walk\'s kerbs; the arena laid in rings (mutants: a tooth over the rim; the compass turned; the edge line gone)', () => {
  const m = buildRealmModel();
  const verts = (rec) => { const s = m.subMeshes.find((x) => x.textureRecord === rec); const out = []; for (let i = s.startIndex; i < s.startIndex + s.primitiveCount * 3; i++) out.push(dungeonToRealm(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2])); return out; };
  const cob = verts(SD_REALM_COBBLE_RECORD);
  assert.ok(cob.every((p) => Math.abs(p[1]) < 1e-4 && Math.hypot(p[0] - SD_THRESHOLD.x, p[2] - SD_THRESHOLD.z) <= SD_THRESHOLD.r + 1e-3), 'the street is the Threshold\'s floor');
  // the compass: brass at the inlay's height on the Threshold, its farthest point +z (the Orrery), the next -z (the way back)
  const inlay = verts(SD_REALM_BRASS_RECORD).filter((p) => Math.abs(p[1] - SD_INLAY_H) < 1e-4 && Math.hypot(p[0], p[2] - SD_ARRIVE_Z) < SD_COMPASS.north + 0.01);
  const far = inlay.reduce((a, p) => (Math.hypot(p[0], p[2] - SD_ARRIVE_Z) > Math.hypot(a[0], a[2] - SD_ARRIVE_Z) ? p : a));
  assert.ok(Math.abs(far[0]) < 1e-3 && Math.abs(far[2] - SD_ARRIVE_Z - SD_COMPASS.north) < 1e-3, `the long point at +z, the Orrery (${far})`);
  const tail = inlay.filter((p) => p[2] < SD_ARRIVE_Z - SD_COMPASS.cardinal + 1e-3);
  assert.ok(tail.length > 0 && tail.every((p) => Math.abs(p[0]) < 1e-3), 'the tail at -z, the way back');
  assert.ok(SD_ORRERY.z > SD_ARRIVE_Z && SD_ORRERY.x === 0, 'the Orrery is +z of the arrival');
  // the teeth: every brass vertex outside an island's disc is under the rim's top
  for (const I of [SD_THRESHOLD, SD_ORRERY, SD_ARENA]) {
    const outside = verts(SD_REALM_BRASS_RECORD).filter((p) => { const d = Math.hypot(p[0] - I.x, p[2] - I.z); return d > I.r + 0.01 && d < I.r + SD_TOOTH_OUT + 0.01 && Math.abs(p[0] - SD_WALK.x) > SD_WALK.halfW + 0.01; });
    assert.ok(outside.length >= Math.round((2 * Math.PI * I.r) / SD_TOOTH_PITCH) * 8, `${I.z}: toothed (${outside.length})`);
    assert.ok(outside.every((p) => p[1] <= SD_TOOTH_TOP + 1e-4 && SD_TOOTH_TOP < SD_RIM_H), `${I.z}: every tooth under the rim's top`);
    assert.ok(outside.every((p) => realmClamp(realmToDungeon(p[0], 0, p[2]), 0) !== null || Math.abs(p[0] - SD_WALK.x) <= SD_WALK.halfW), `${I.z}: no tooth on a floor`);
  }
  // the edge line: on every rim (its top strip a ring at the rim's top) and both kerbs
  const edge = verts(SD_REALM_EDGE_RECORD);
  for (const I of [SD_THRESHOLD, SD_ORRERY, SD_ARENA]) assert.ok(edge.filter((p) => Math.abs(Math.hypot(p[0] - I.x, p[2] - I.z) - I.r) < 0.05 && p[1] > SD_RIM_H).length >= SD_ISLAND_SIDES * 6, `${I.z}: its edge line`);
  for (const sd of [-1, 1]) for (const [z0, z1] of [[SD_THRESHOLD.r - 1, SD_THRESHOLD.r + 0.5], [SD_ORRERY.z - SD_ORRERY.r - 0.5, SD_ORRERY.z - SD_ORRERY.r + 1]]) assert.ok(edge.some((p) => Math.abs(p[0] - (SD_WALK.x + sd * SD_WALK.halfW)) < 0.05 && p[2] > z0 && p[2] < z1), `the walk's ${sd < 0 ? 'left' : 'right'} kerb, island to island`);
  // the arena in rings: 48 sides x SD_ARENA_BANDS quads, uv along each ring
  const s = m.subMeshes.find((x) => x.textureRecord === SD_REALM_ARENA_RECORD);
  assert.equal(s.primitiveCount, SD_ISLAND_SIDES * SD_ARENA_BANDS * 2);
});
