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

// ---------------------------------------------------------------------------------------------------------------------
// S3 - THE HOUR'S SKY: a painted map, the fetch over it.
// ---------------------------------------------------------------------------------------------------------------------
import { glslFunctions } from './glsl.mjs';
import {
  octEncode, octDecode, SD_OCT_GLSL, SD_SKY_PAINT_FS, SD_SKY_FS, SD_SKY_FETCH_GLSL, SD_CLOCK_FACE, SD_CLOCK_TOP, SD_SHARD_TOP,
  SD_SKY_SHARDS, SD_SKY_MAP, SD_SKY_STEPS, SD_SKY_MODE, CLOCK_BASIS,
} from '../src/render/sdSky.js';
import { numeralCell, numeralWidth, SD_HOUR_NUMERALS, sdSkySigns, SD_SKY_SIGN_GRID } from '../src/world/sdSkyArt.js';
import { SD_SIGNS } from '../src/world/sdHallArt.js';

test('SD-LOOK THE SKY MAP: the octahedral map\'s two ways round (a direction to its place and back, the shaders\' own and the JS pinned equal), every texel about Daggerfall\'s own sky density (pi/512 a pixel); the face lowered - centre at 0.20, 0.34 across - every city still wholly over it (mutants: a fold turned; the face high again)', () => {
  const f = glslFunctions(SD_OCT_GLSL);
  for (const d0 of [[0, 1, 0], [0, 0, 1], [1, 0, 0], [0.3, -0.8, 0.2], [-0.7, 0.1, -0.7], [0.01, -1, 0.01], [-0.4, 0.4, 0.82]]) {
    const l = Math.hypot(...d0), d = d0.map((v) => v / l);
    const js = octEncode(d), gl = f.octEncode(d);
    assert.ok(Math.abs(js[0] - gl[0]) < 1e-9 && Math.abs(js[1] - gl[1]) < 1e-9, `encode ${d0}`);
    const back = octDecode(js), gb = f.octDecode(js);
    assert.ok(back.every((v, k) => Math.abs(v - d[k]) < 1e-9) && gb.every((v, k) => Math.abs(v - d[k]) < 1e-9), `round trip ${d0}`);
  }
  // density: neighbouring texels of the upper diamond a fraction of a degree apart
  const a = octDecode([0.5 + 3 / SD_SKY_MAP, 0.7]), b = octDecode([0.5 + 4 / SD_SKY_MAP, 0.7]);
  const ang = Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
  assert.ok(ang > 0.2 * (Math.PI / 512) && ang < 2 * (Math.PI / 512), `a texel ${(ang * 180 / Math.PI).toFixed(2)} degrees`);
  assert.deepEqual([SD_CLOCK_FACE.elev, SD_CLOCK_FACE.r], [0.2, 0.34]);
  assert.ok(Math.abs(CLOCK_BASIS.centre[1] - Math.sin(0.2)) < 1e-12);
  for (const s of SD_SKY_SHARDS) assert.ok(SD_SHARD_TOP - s.depth > SD_CLOCK_TOP, `${s.name} over the face`);
});

test('SD-LOOK THE FACE IN STARS: its twelve hours written in Roman numerals plotted in stars - the paint\'s glyph table the very cells world/sdSkyArt.js numeralCell lights, every hour, every cell; the six Endings\' signs sampled into the strip it reads as constellations (mutants: a glyph\'s row; a numeral misspelled)', () => {
  const f = glslFunctions(SD_SKY_PAINT_FS, { uTime: 0, uHaze: [0.2, 0.15, 0.07], uSteps: 10, uEnding: [0, 0, 0], uEndingIdx: -1, vUv: [0.5, 0.5], texelFetch: () => [0, 0, 0, 0] });
  assert.deepEqual(SD_HOUR_NUMERALS, ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']);
  for (let h = 0; h < 12; h++) {
    const s = SD_HOUR_NUMERALS[h], w = numeralWidth(s);
    assert.equal(f.numeralWidth(h), w, `${s}'s width`);
    let lit = 0;
    for (let cy = 0; cy < 7; cy++) for (let cx = 0; cx < w; cx++) { const want = numeralCell(s, cx, cy); assert.equal(f.numeralLit(h, cx, cy) > 0.5, want, `${s} cell ${cx},${cy}`); if (want) lit++; }
    assert.ok(lit >= 7, `${s} drawn`);
  }
  assert.equal(numeralCell('V', 0, 0) && numeralCell('V', 2, 6) && !numeralCell('V', 2, 0), true, 'a V points down at its foot');
  const sg = sdSkySigns(), N = SD_SKY_SIGN_GRID;
  assert.deepEqual([sg.width, sg.height], [N * SD_SIGNS.length, N]);
  for (let i = 0; i < SD_SIGNS.length; i++) { let n = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (sg.data[y * sg.width + i * N + x] === 255) n++; assert.ok(n >= 6 && n < N * N * 0.8, `sign ${i}: a constellation (${n} stars)`); }
});

test('SD-LOOK THE PAINT IS PIXEL ART: every texel it paints posterized to the pixel law\'s steps through the ordered dither (its brightest channel a whole step), the void black overhead (L0), the haze meeting the fog at the horizon; the fetch adds the hands on the escapement, the Reset sweeping them to XII (mutants: the posterize skipped; the void lifted)', () => {
  const f = glslFunctions(SD_SKY_PAINT_FS, { uTime: 40, uHaze: [0.2, 0.15, 0.07], uSteps: SD_SKY_STEPS.lane, uEnding: [0, 0, 0], uEndingIdx: -1, vUv: [0.5, 0.5], o: [0, 0, 0, 0], texelFetch: () => [1, 0, 0, 0] });
  let zenith = 0, whole = 0, n = 0;
  for (const uv of [[0.5, 0.5], [0.51, 0.5], [0.5, 0.93], [0.3, 0.6], [0.7, 0.4], [0.5, 0.97], [0.05, 0.05], [0.9, 0.95], [0.62, 0.88], [0.45, 0.91]]) {
    f.globals.vUv = uv; f.main(); n++;
    const c = f.globals.o, l = Math.max(c[0], c[1], c[2]);
    if (Math.abs(l * SD_SKY_STEPS.lane - Math.round(l * SD_SKY_STEPS.lane)) < 1e-6) whole++;
    if (uv[0] === 0.5 && uv[1] === 0.5) zenith = l;
  }
  assert.equal(whole, n, 'every texel a whole step');
  assert.ok(zenith <= 0.1, `the zenith black (${zenith})`);
  assert.ok(SD_SKY_FS.includes(SD_SKY_FETCH_GLSL), 'the sky\'s pass is the fetch');
  const g = glslFunctions(SD_SKY_FETCH_GLSL, { uTime: 333.3, uGain: 1, uClock: [SD_SKY_MODE.reset, 1, 0, 0], texelFetch: () => [0, 0, 0, 1] });
  const up = (x) => [0, 1, 2].map((j) => CLOCK_BASIS.centre[j] * Math.cos(x * SD_CLOCK_FACE.r) + CLOCK_BASIS.up[j] * Math.sin(x * SD_CLOCK_FACE.r));
  assert.ok(Math.max(...g.skyFaceLive(up(0.45), [3, 3])) > 0.5, 'the Reset landed: both hands at XII');
  g.globals.uClock = [0, 0, 0, 0];
  const tk = g.skyTick(333.3);
  assert.ok(Math.abs(tk - 333) < 1e-9 || tk > 333, 'the escapement held after its ease');
});

// ---------------------------------------------------------------------------------------------------------------------
// S4 - THE RIFT AND THE RETURN: the astrolabe and its window.
// ---------------------------------------------------------------------------------------------------------------------
import { sdRiftFace, riftLook, SD_RIFT_OPEN_LOOK, SD_RIFT_NOT_YET, SD_RIFT_CLOSED, SD_RIFT_REFUSED, SD_RIFT_PROBE_M } from '../src/world/sdDungeon.js';
import { irisPositions, SD_RIFT_PARTS, riftCentreY } from '../src/world/sdRiftModel.js';
import { createSdEnd } from '../src/scenes/sdEnd.js';
import { SD_WINDOW_FS, SD_FLOOR_FS } from '../src/render/sdRiftPass.js';
import { sdRise, sdFind, sdFell, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';

/** A box hall the collider answers: x0..x1, z0..z1, floor 0, ceiling h; `pillar` { x, z, half } a square column. */
function boxHall({ x0 = -5, x1 = 5, z0 = -15, z1 = 15, h = 8, pillar = null } = {}) {
  return {
    floor: () => 0,
    ray: (o, d, max) => {
      let t = Infinity;
      for (const [ax, at] of [[0, x0], [0, x1], [2, z0], [2, z1], [1, 0], [1, h]]) { if (Math.abs(d[ax]) < 1e-9) continue; const k = (at - o[ax]) / d[ax]; if (k > 1e-6) t = Math.min(t, k); }
      if (pillar) for (let k = 0.05; k < t; k += 0.05) { const x = o[0] + d[0] * k, z = o[2] + d[2] * k; if (Math.abs(x - pillar.x) < pillar.half && Math.abs(z - pillar.z) < pillar.half) { t = k; break; } }
      return t <= max ? t : null;
    },
  };
}

test('SD-LOOK THE RIFT\'S FACE: square to its hall\'s long line - the opposite pair of chest rays that reaches farthest (a miss its probe\'s length), the first of a tie - unless a pillar stands in its own plane, then the next; the same on every client (mutants: the short line; the pillar unasked)', () => {
  assert.deepEqual(sdRiftFace([0, 0, 0], 7, boxHall()), [Math.cos(Math.PI / 2), 0, 1], 'a hall along z: its face along z');
  assert.deepEqual(sdRiftFace([0, 0, 0], 7, boxHall({ x0: -15, x1: 15, z0: -5, z1: 5 })), [1, 0, 0], 'along x');
  assert.deepEqual(sdRiftFace([0, 0, 0], 5, boxHall({ x0: -20, x1: 20, z0: -20, z1: 20 })), [Math.cos(Math.PI / 4), 0, Math.sin(Math.PI / 4)], 'square: its diagonal, the longest line it has (the first of the two)');
  // a pillar in the ring's plane (across the long line, at half its height) turns it to the next pair
  assert.deepEqual(sdRiftFace([0, 0, 0], 5, boxHall({ x0: -9, x1: 9, z0: -15, z1: 15 })), [Math.cos(Math.PI / 2), 0, 1], 'a broad hall\'s long line, never its diagonal');
  const p = boxHall({ x0: -9, x1: 9, z0: -15, z1: 15, pillar: { x: 2.2, z: 0, half: 0.4 } });
  assert.notDeepEqual(sdRiftFace([0, 0, 0], 5, p), [Math.cos(Math.PI / 2), 0, 1], 'the pillar asked');
  assert.ok(SD_RIFT_PROBE_M > 0);
});

test('SD-LOOK THE RIFT\'S LOOK IS ITS STATE (riftLook): found - the iris wide, the gear ticking once a second, its studs the hours left (all past a day); risen or unheard - a pinhole, still, at 30%; the collapse - the gear twice a second, a stud gone ember each 7.5 s, wide to a third for one who went in, shut and ember for a newcomer; gone or another slot - shut and cold; refused for good - shut and red (mutants: the collapse uncounted; a newcomer let see in)', () => {
  const T0 = 1_800_000_000_000, H = 3_600_000;
  const risen = sdRise(null, T0, 0), found = sdFind(risen, T0 + 1000);
  assert.deepEqual(riftLook(null, 1, T0), SD_RIFT_NOT_YET);
  assert.deepEqual(riftLook(risen, risen.s, T0 + 10), SD_RIFT_NOT_YET);
  assert.deepEqual(riftLook(found, found.s + 1, T0 + 2000), SD_RIFT_CLOSED);
  assert.deepEqual(riftLook(found, found.s, T0 + 2000, { fallen: true }), SD_RIFT_REFUSED);
  const open = riftLook(found, found.s, T0 + 2000);
  assert.deepEqual([open.state, open.aperture, open.tickHz, open.tone], ['open', 1, 1, 'gold']);
  assert.equal(open.studs, Math.max(1, Math.min(24, Math.ceil((found.until - T0 - 2000) / H))));
  const fell = sdFell(found, T0 + 5000);
  for (const [k, studs] of [[0.0, 24], [7.5, 23], [90, 12], [179, 1]]) {
    const L = riftLook(fell, fell.s, fell.fellAt + k * 1000, { entered: true });
    assert.deepEqual([L.state, L.tickHz, L.studs, L.ember], ['collapse', 2, studs, 24 - studs], `${k} s into the collapse`);
    assert.ok(L.aperture >= 1 / 3 - 1e-9 && L.aperture <= 1, 'wide to a third');
  }
  const newcomer = riftLook(fell, fell.s, fell.fellAt + 1000);
  assert.deepEqual([newcomer.aperture, newcomer.tone], [0, 'ember']);
  assert.equal(riftLook(fell, fell.s, fell.fellAt + SD_COLLAPSE_MS + 1).state, 'closed');
});

test('SD-LOOK THE IRIS: eight leaves whose aperture is the state - shut, they meet over the heart; wide, every leaf behind the hour-ring\'s lip; the same vertices at every aperture (written in place while it eases) (mutants: the leaves short of the heart; wide leaves in the window)', () => {
  const R = 3.5, count = irisPositions(7, 0).positions.length;
  for (const a of [0, 0.07, 0.4, 1]) assert.equal(irisPositions(7, a).positions.length, count);
  const minR = (a) => { const p = irisPositions(7, a).positions; let m = Infinity; for (let i = 0; i < p.length; i += 3) m = Math.min(m, Math.hypot(p[i], p[i + 1])); return m; };
  assert.ok(minR(0) < 1e-6, 'shut: they meet at the heart');
  assert.ok(minR(1) * Math.cos(Math.PI / 8) >= SD_RIFT_PARTS.ring0 * R - 1e-6, `wide: behind the lip (${(minR(1) / R).toFixed(3)} R)`);
  assert.ok(minR(0.07) > 0 && minR(0.07) < 0.1 * R, 'not yet: a pinhole');
  assert.ok(SD_RIFT_PARTS.iris1 <= SD_RIFT_PARTS.ring1, 'the leaves never past the hour-ring');
});

test('SD-LOOK THE RIFT TURNS: on the realm\'s clock its gear ticks a tooth FORWARD each second and holds; its hour-ring ratchets an hour BACK on each toll; every part that turns casts nothing (noShadow), the crater, plinth and claws cast; shut and cold its parts swap to the cold records; its light before its face in gold, none when closed (mutants: the teeth still; the ring forward; a turning part casting)', () => {
  let ms = 100_000, sec = 1000;
  const r = { uploadTexture() {}, uploadEmissionTexture() {}, createMesh: (m) => ({ m }), destroyMesh() {}, updateMeshVertices() {} };
  let L = SD_RIFT_OPEN_LOOK;
  const end = createSdEnd({ renderer: r, now: () => ms, clock: () => sec, look: () => L });
  const draws = [];
  end.stand({ rift: { at: [0, 0, 0], size: 6, face: [0, 0, 1] }, retAt: null, dynamicDraws: draws });
  assert.deepEqual(draws.map((d) => !!d.noShadow).filter((v) => !v).length, 1, 'one part casts - the static one');
  const at = (s) => { sec = s; ms += 16; end.frame(null); return end.parts; };
  const g0 = at(1000.5).gearAngle, g1 = at(1001.5).gearAngle, g1b = at(1001.9).gearAngle;
  const pitch = (Math.PI * 2) / SD_RIFT_PARTS.teeth;
  assert.ok(Math.abs(g1 - g0 - pitch) < 1e-9, 'a tooth a second');
  assert.ok(g1 > g0, 'forward');
  assert.equal(g1b, g1, 'held after its ease');
  const ring = [];
  for (let k = 0; k < 4; k++) { sec += 6.5; ms += 16; ring.push(end.parts.ringAngle); end.frame(null); }   // no bell: the realm's clock tolls it
  ring.push(end.parts.ringAngle);
  assert.ok(ring.slice(1).every((v, i) => v <= ring[i] + 1e-9) && ring.at(-1) < ring[0], 'back, toll by toll');
  L = SD_RIFT_CLOSED; end.frame(null);
  assert.ok(draws.filter((d) => d.noShadow !== undefined && d.texRemap).length >= 4, 'cold records swapped in');
  assert.equal(end.lights().length, 0, 'closed: no light');
  L = SD_RIFT_OPEN_LOOK; end.frame(null);
  const [light] = end.lights();
  assert.ok(light.z < 0 && Math.abs(light.y - riftCentreY(6)) < 1e-9, 'before its face (-z), at its heart\'s height');
  assert.ok(light.color[0] > light.color[2], 'gold');
});

test('SD-LOOK THE WINDOW: the Hour\'s own painted sky through the iris (the fetch the sky\'s pass reads), along the eye\'s own ray - and a step through\'s ripple never NaN when no step has been (an infinite age blanked every ray); the floor light\'s gear spokes and toll pulse (mutants: the ripple unguarded)', () => {
  assert.ok(SD_WINDOW_FS.includes(SD_SKY_FETCH_GLSL), 'the same fetch');
  assert.match(SD_WINDOW_FS, /rw = normalize\(wp - uEye\)/, 'the eye\'s own ray');
  let bad = 0;
  const f = glslFunctions(SD_WINDOW_FS, { uModel: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 3, 8, 1], uToLocal: [1, 0, 0, 0, 1, 0, 0, 0, 1], uSize: [3, 3], uEye: [0, 1.7, -7], uLight: 1, uEmber: 0, uSteps: 10, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.7, -7], uFogColor: [0, 0, 0], uFocus: [0, 0, 0, 0], uTime: 40, uGain: 1, uClock: [0, 0, 0, 0], vDisc: [0.3, 0.2], vWorld: [0, 3, 8], o: [0, 0, 0, 0], texelFetch: (s, p) => { if (!p.every(Number.isFinite)) bad++; return [0.5, 0.4, 0.2, 1]; } });
  for (const age of [9, 1.5, 0.3]) {
    f.globals.uRipple = [0, 0, age < 1.5 ? 1 : 0, age];
    f.main();
    assert.ok(f.globals.o.every(Number.isFinite), `a number at age ${age}`);
  }
  f.globals.uRipple = [0, 0, 0, Infinity]; f.main();
  assert.ok(f.globals.o.every(Number.isFinite), 'no step at all: still a number');
  assert.equal(bad, 0, 'and every tap of the sky a texel, never a NaN');
  for (const g of [[0, 0], [0.3, 0.2], [-0.9, 0.1]]) assert.ok(f.windowRay(g).every(Number.isFinite), `the window's ray at ${g}, no step at all`);
  assert.match(SD_FLOOR_FS, /fract\(\(ha - uGear\) \/ TAU \* 36\.0\)/, 'the gear\'s 36 teeth as spokes');
});

// ---------------------------------------------------------------------------------------------------------------------
// S5 - THE STEP THROUGH THE HOUR: the Hour's own veil.
// ---------------------------------------------------------------------------------------------------------------------
import { SD_VEIL_FS, SD_VEIL_MODE, SD_VEIL_TURN_S, SD_VEIL_SLOW_AFTER_S, sdVeilHand, sdVeilQuarters } from '../src/render/sdVeil.js';
import { createGateVeil, VEIL_THEMES, VEIL_HOUR_CUES, VEIL_HOUR_HOLD_S, VEIL_HOUR_SCALE, VEIL_SCALE, VEIL_CENTRE_MAX, VEIL_OPEN_WAIT_TICKS } from '../src/ui/gateVeil.js';
import { VEIL_CLOSE_S } from '../src/render/gateVeil.js';
import { HOUR_CHIME, HOUR_CHIME_MENDED } from '../src/systems/sdScore.js';
import { midiNote } from '../src/systems/gateScore.js';

/** A page the veil builds in: a GL that records its calls (a uniform's location its name), a frame clock, the sounds. */
function veilPage({ reduce = false, noHour = false } = {}) {
  const calls = [], sources = new Map();
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, COLOR_BUFFER_BIT: 5, VERTEX_SHADER: 6, FRAGMENT_SHADER: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'shaderSource') sources.set(a[0], a[1]);
        if (k === 'getShaderParameter') return !(noHour && sources.get(a[0])?.includes('uShatter'));
        if (k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        return {};
      };
    },
  });
  const canvas = { style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => gl };
  const doc = { body: { appendChild() {} }, createElement: () => canvas };
  let frames = [], t = 1000;
  const sounds = [];
  const engine = { soundIndexForId: () => -1, playOneShot: (...a) => sounds.push(a) };
  const step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); };
  const win = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, matchMedia: (q) => ({ matches: reduce && /reduced-motion/.test(q) }) };
  const u = (name) => calls.filter((c) => (c[0] === 'uniform1f' || c[0] === 'uniform2f') && c[1] === name).map((c) => c.slice(2));
  return { doc, raf: (f) => frames.push(f), now: () => t, engine, win, calls, sounds, step, canvas, u };
}
const pitchOf = (note) => 0.7 * 2 ** ((midiNote(note) - midiNote('C5')) / 12);

test('SD-LOOK THE HOUR\'S HAND (S5): shut into the Hour it sweeps BACKWARDS from XII - a turn in its first two seconds, then slower (the stillness deliberate); out of it FORWARD and slowing; the shader\'s hand the JS law to the last digit, the quarters struck as it passes each (mutants: the hand forward into the Hour; the shader\'s forward; no slowing)', () => {
  const f = glslFunctions(SD_VEIL_FS, { uRes: [960, 540], uCentre: [0, 0], uMend: 0 });
  for (const mode of Object.values(SD_VEIL_MODE)) for (let t = 0; t <= 10; t += 0.37) assert.ok(Math.abs(f.handAt(t, mode) - sdVeilHand(t, mode)) < 1e-9, `mode ${mode} at ${t}`);
  const IN = SD_VEIL_MODE.in;
  assert.ok(sdVeilHand(0.5, IN) < 0, 'backwards');
  assert.ok(Math.abs(sdVeilHand(SD_VEIL_TURN_S, IN) + Math.PI * 2) < 1e-9, 'a whole turn back by its first');
  const early = sdVeilHand(0, IN) - sdVeilHand(1, IN), late = sdVeilHand(SD_VEIL_SLOW_AFTER_S + 1, IN) - sdVeilHand(SD_VEIL_SLOW_AFTER_S + 2, IN);
  assert.ok(late <= early * 0.5 && late > 0, `slower once it has run (${late} against ${early})`);
  for (const mode of [SD_VEIL_MODE.back, SD_VEIL_MODE.home]) {
    assert.ok(sdVeilHand(0.5, mode) > 0, 'forward out of it');
    assert.ok(sdVeilHand(2, mode) - sdVeilHand(1, mode) < sdVeilHand(1, mode) - sdVeilHand(0, mode), 'slowing');
    assert.ok(sdVeilHand(60, mode) <= Math.PI * 2 * 1.2 + 1e-9, 'coming to rest');
  }
  assert.equal(sdVeilQuarters(SD_VEIL_TURN_S, IN), 4, 'four quarters in a turn');
  assert.equal(sdVeilQuarters(0.4, IN), 0);
});

test('SD-LOOK THE HOUR\'S VEIL, DRAWN (S5): nothing taken before it closes; shut, the whole screen its brass and its dial, the Mantella\'s green at its hub; every pixel a whole step of six (pixel art); the Dragon Break\'s crack only past the hand\'s first turn; the way home\'s crack MENDED; forced, its pieces gone once it has shattered; reduced motion, a dither wipe and nothing between (mutants: the posterize dropped; the Break at once; the mend unread; the pieces never falling; reduced motion ignored)', () => {
  const W = 96, H = 54;
  const at = (x, y, u) => {
    const f = glslFunctions(SD_VEIL_FS, { uRes: [W, H], uTime: 1, uCover: 0, uShut: 0, uOpening: 0, uCentre: [0, 0], uMode: 0, uMend: 0, uShatter: 0, uReduce: 0, ...u, gl_FragCoord: [x + 0.5, y + 0.5, 0, 1], o: [0, 0, 0, 0] });
    f.main();
    return f.globals.o;
  };
  const grid = [];
  for (let y = 2; y < H; y += 13) for (let x = 3; x < W; x += 17) grid.push([x, y]);
  assert.equal(at(W / 2, H / 2, { uCover: 0 })[3], 0, 'nothing taken');
  for (const [x, y] of grid) {
    const o = at(x, y, { uCover: 1, uShut: 0.5 });
    assert.equal(o[3], 1, `shut over (${x}, ${y})`);
    for (const c of o.slice(0, 3)) assert.ok(Math.abs(c * 6 - Math.round(c * 6)) < 1e-9, `a whole step at (${x}, ${y}): ${c}`);
  }
  const hub = at(W / 2, H / 2, { uCover: 1, uShut: 0.5 });
  assert.ok(hub[1] > hub[0] && hub[1] > hub[2], `the hub the Mantella's green: ${hub}`);
  // the crack, on the face itself: a point on its line
  const f = glslFunctions(SD_VEIL_FS, { uRes: [960, 540], uCentre: [0, 0], uMend: 0 });
  const x = 0.2, d = [0.86, 0.5].map((v) => v / Math.hypot(0.86, 0.5)), n = [-d[1], d[0]];
  const y = 0.035 * Math.sin(x * 23) + 0.018 * Math.sin(x * 61 + 1.3) + 0.01 * Math.sign(Math.sin(x * 9));
  const P = [d[0] * x + n[0] * y, d[1] * x + n[1] * y], lum = (c) => c[0] + c[1] + c[2];
  const dark = (mode, t) => lum(f.face(P, mode, t, { value: 0 })) < 0.2;
  assert.equal(dark(SD_VEIL_MODE.in, 1), false, 'whole before its first turn');
  assert.equal(dark(SD_VEIL_MODE.in, SD_VEIL_TURN_S + 0.5), true, 'the Dragon Break');
  assert.equal(dark(SD_VEIL_MODE.back, 0.2), true, 'still cracked going back');
  assert.equal(dark(SD_VEIL_MODE.home, 0.2), true, 'cracked as the way home shuts...');
  f.globals.uMend = 1;
  assert.equal(dark(SD_VEIL_MODE.home, 1.5), false, '...and mended');
  // forced: the face whole, then every piece gone
  for (const [x2, y2] of grid.slice(0, 6)) {
    assert.equal(at(x2, y2, { uMode: SD_VEIL_MODE.cast, uCover: 1, uShatter: 0 })[3], 1, 'the red face at once');
    assert.equal(at(x2, y2, { uMode: SD_VEIL_MODE.cast, uCover: 1, uShatter: 1 })[3], 0, `shattered away at (${x2}, ${y2})`);
  }
  // reduced motion: every pixel all or nothing, about as many as the cover
  let shown = 0, n2 = 0;
  for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) { const a = at(xx + 40, yy + 20, { uReduce: 1, uCover: 0.5 })[3]; assert.ok(a === 0 || a === 1); shown += a; n2++; }
  assert.equal(shown / n2, 0.5, 'the ordered dither: half of every 4x4 at half');
});

test('SD-LOOK THE HOUR\'S VEIL ON THE PAGE (S5): the Hour\'s themes draw its own program at a third of the pixels, pixelated, pivoting on the Rift (held inside the screen); the blades ratchet in at the closing\'s thirds, the bell tolls as they shut, the BROKEN quarters strike as the hand passes (the fourth on its wrong F sharp) and the chime as it opens; the way home holds shut until mended and strikes the mended; forced, the bell and the shattering; reduced motion strikes no quarter; the brass whirl stays for "brass" and stands in where the Hour\'s will not build (mutants: the hold dropped; one ratchet; the quarters mended going in; the centre unclamped; reduced motion never asked; drawn smooth; at the fire\'s scale)', () => {
  const p = veilPage();
  const veil = createGateVeil(p);
  veil.cover('hourIn', { centre: [0.2, 0.1] });
  const R = VEIL_HOUR_CUES.ratchet;
  assert.deepEqual(p.sounds, [[R.clip, R.volume, R.pitches[0]]], 'the first ratchet');
  for (let i = 0; i < Math.ceil((VEIL_CLOSE_S * 1000) / 16) + 1; i++) p.step();
  assert.equal(veil.phase, 'shut');
  assert.deepEqual(p.sounds.map((s) => s[2]).slice(0, 3), R.pitches, 'three ratchets, rising');
  assert.deepEqual(p.sounds[3], [VEIL_HOUR_CUES.shut[0].clip, VEIL_HOUR_CUES.shut[0].volume, VEIL_HOUR_CUES.shut[0].pitch], 'the toll as it shuts');
  assert.deepEqual(p.u('uMode').at(-1), [SD_VEIL_MODE.in]);
  assert.deepEqual(p.u('uCentre').at(-1), [0.2, 0.1], 'on the Rift');
  assert.equal(p.canvas.width, Math.round(1280 * VEIL_HOUR_SCALE));
  assert.equal(p.canvas.style.imageRendering, 'pixelated');
  for (let i = 0; i < Math.ceil((SD_VEIL_TURN_S * 1000) / 16) + 2; i++) p.step();
  const quarters = p.sounds.slice(4).filter((s) => s[0] === VEIL_HOUR_CUES.chime);
  assert.deepEqual(quarters.map((s) => s[2]), HOUR_CHIME.map((c) => pitchOf(c[3])), 'the broken quarters, a turn of them');
  assert.ok(Math.abs(quarters[3][2] - pitchOf('F#5')) < 1e-12, 'the fourth on F sharp');
  p.sounds.length = 0;
  veil.frameDrawn(); veil.reveal();
  for (let i = 0; i < VEIL_OPEN_WAIT_TICKS + 2; i++) { veil.frameDrawn(); p.step(); }
  assert.equal(veil.phase, 'opening', 'a step\'s opens as soon as its place has drawn');
  assert.ok(p.sounds.some((s) => s[0] === VEIL_HOUR_CUES.open[0].clip && s[2] === VEIL_HOUR_CUES.open[0].pitch), 'the chime');
  // the way home: shut at once, held until mended, the mended quarters
  const h = veilPage();
  const home = createGateVeil(h);
  home.flash('hourHome', { centre: [3, 0] });
  assert.deepEqual(h.u('uCentre').at(-1), [VEIL_CENTRE_MAX, 0], 'held inside the screen');
  assert.ok(!h.sounds.some((s) => s[0] === VEIL_HOUR_CUES.cast[1].clip && s[2] === VEIL_HOUR_CUES.cast[1].pitch), 'no shattering');
  for (let i = 0; i < 50; i++) { home.frameDrawn(); h.step(); }
  assert.equal(home.phase, 'shut', `held ${VEIL_HOUR_HOLD_S[SD_VEIL_MODE.home]} s`);
  for (let i = 0; i < 60 && home.phase === 'shut'; i++) { home.frameDrawn(); h.step(); }
  assert.equal(home.phase, 'opening');
  const mended = h.sounds.filter((s) => s[0] === VEIL_HOUR_CUES.chime && s[1] === 0.55).map((s) => s[2]);
  assert.ok(mended.length > 0 && mended.every((v, i) => v === HOUR_CHIME_MENDED.map((c) => pitchOf(c[3]))[i]), `the mended quarters: ${mended}`);
  // forced: the bell and the shattering, at once
  const c = veilPage();
  createGateVeil(c).flash('hourCast');
  assert.deepEqual(c.sounds, VEIL_HOUR_CUES.cast.map((s) => [s.clip, s.volume, s.pitch]));
  assert.deepEqual(c.u('uMode').at(-1), [SD_VEIL_MODE.cast]);
  // reduced motion: still, no quarter
  const r = veilPage({ reduce: true });
  const rv = createGateVeil(r);
  rv.cover('hourIn');
  for (let i = 0; i < 300; i++) r.step();
  assert.deepEqual(r.u('uReduce').at(-1), [1]);
  assert.equal(r.sounds.filter((s) => s[0] === VEIL_HOUR_CUES.chime).length, 0, 'no quarter struck');
  // the brass whirl stays its own, and stands in for an Hour's that would not build
  const b = veilPage();
  createGateVeil(b).flash('brass');
  assert.deepEqual(b.u('uTheme').at(-1), [VEIL_THEMES.brass]);
  assert.equal(b.canvas.width, Math.round(1280 * VEIL_SCALE));
  assert.equal(b.u('uMode').length, 0);
  const nb = veilPage({ noHour: true });
  createGateVeil(nb).flash('hourCast');
  assert.deepEqual(nb.u('uTheme').at(-1), [VEIL_THEMES.brass], 'the whirl in brass');
  assert.equal(nb.canvas.style.imageRendering, '');
});

test('SD-LOOK THE VEIL CLOSES ON THE RIFT (S5): the world host keeps where the Rift\'s window (or the Return\'s) stood on the screen the frame it was drawn - into a kept typed array, by hand through the view and the projection (nothing made a frame) - and the step in, the way back and the way home each close on it; forced, on the screen\'s middle (mutants: the aim dropped)', () => {
  const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const body = W.slice(W.indexOf('function sdVeilAim(proj, view, m) {'), W.indexOf('/** Where the next Hour\'s veil pivots'));
  assert.ok(body.length > 100);
  assert.doesNotMatch(body, /new |[=(,:]\s*\[|=>|\.\.\./, 'nothing made: no array, no closure, no spread');
  assert.match(W, /sdVeilAim\(proj, view, look\?\.window\?\.model \?\? look\?\.bay\?\.model\);/, 'each frame the Rift is drawn');
  assert.match(W, /\}, 'hourIn', \{ centre: sdVeilCentre\(\) \}\);/);
  assert.match(W, /\}, 'hourBack', \{ centre: sdVeilCentre\(\) \}\);/);
  assert.match(W, /gateVeil\?\.flash\('hourHome', \{ centre: sdVeilCentre\(\) \}\);/);
});

// ---------------------------------------------------------------------------------------------------------------------
// S7 - THE ARENA'S READS: the floor tells the clock's blows.
// ---------------------------------------------------------------------------------------------------------------------
import { SD_FISSURES, SD_FLOOD, SD_ARENA_NUMERALS, SD_ARENA_CELL_M, SD_RESET_EMBER, SD_ARENA_GLOW_FS, sdFissurePaths, sdFissureField, sdArenaGlowAt, sdHourClockOf } from '../src/render/sdArenaGlow.js';
import { SD_ARENA as SD_ARENA_AT } from '../src/net/sdBrain.js';
import { SD_BLOWS } from '../src/net/sdRemnant.js';
import { SD_SKY_MODE as SKY_MODE } from '../src/render/sdSky.js';

const glowMemo = () => ({ flood: -1, floodK: 0, reset: -1, end: 0, pulseAt: -Infinity });
const fightAt = (t, o = {}) => ({ fi: 1, op: t - 300_000, ends: t + 600_000, ph: 1, rem: { atk: null }, ec: [], clk: null, su: -Infinity, fell: null, lost: null, ...o });

test('SD-LOOK THE ARENA\'S FISSURES (S7): eight runs from the boss to the rim, one each eighth, the same on every page; the field the distance to them - nought on a run, saturated far from every one (mutants: none needed - a pure bake, pinned by value)', () => {
  const P = sdFissurePaths();
  assert.deepEqual(P, sdFissurePaths(), 'seeded: every page the same');
  assert.equal(P.length, SD_FISSURES.n);
  P.forEach((run, i) => {
    assert.ok(Math.abs(Math.hypot(...run[0]) - SD_FISSURES.from) < 1e-9 && Math.abs(Math.hypot(...run.at(-1)) - SD_FISSURES.to) < 1e-9, `run ${i} boss to rim`);
    const a = Math.atan2(run[0][0], run[0][1]), want = ((i + 0.5) / SD_FISSURES.n) * Math.PI * 2;
    assert.ok(Math.abs(((a - want + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 0.3, `run ${i} on its eighth`);
  });
  const F = sdFissureField(P), N = F.size, R = SD_ARENA_AT.r, texel = ([x, z]) => F.data[Math.floor(((z + R) / (2 * R)) * N) * N + Math.floor(((x + R) / (2 * R)) * N)];
  assert.ok(texel(P[3][7]) < 40, 'on a run: near nought');
  for (let i = 0; i < SD_FISSURES.n; i++) {
    const a = (i / SD_FISSURES.n) * Math.PI * 2;
    assert.equal(texel([Math.sin(a) * 18, Math.cos(a) * 18]), 255, `between runs ${i - 1} and ${i}: far from both`);
  }
});

test('SD-LOOK THE FLOOR TELLS THE CLOCK\'S BLOWS (S7, sdArenaGlowAt): the Pulse floods from its LANDING - the front out to the rim in its 0.4 s, then fading over 1.2 s - and plays out though the clock\'s blow is replaced; the Reset lights the numerals one by one over its wind-up, all twelve as it lands, none once stunned; the End red; a fallen fight tells nothing; the sky reads the same clock (sdHourClockOf) (mutants: the flood never fading; the Pulse not kept; the count one short; the stun ignored; the End unread; the sky\'s Reset at once; no last minute)', () => {
  const t = 2_000_000, R = SD_ARENA_AT.r, P = SD_BLOWS.pulse, RS = SD_BLOWS.reset;
  let m = glowMemo();
  const pulse = { a: P.id, at: t, i: 3 };
  assert.equal(sdArenaGlowAt(fightAt(t, { clk: pulse }), t - 100, m).flood, -1, 'nothing before it lands');
  sdArenaGlowAt(fightAt(t, { clk: pulse }), t + 200, m);
  assert.ok(Math.abs(m.flood - R * 0.5) < 1e-9 && m.floodK === 1, 'halfway out at 0.2 s');
  sdArenaGlowAt(fightAt(t, { clk: { a: SD_BLOWS.end.id, at: t + 5000, i: 4 } }), t + (SD_FLOOD.front_s + SD_FLOOD.fade_s / 2) * 1000, m);
  assert.ok(m.flood === R && Math.abs(m.floodK - 0.5) < 1e-9, `the clock's next blow named: the flood still fading (${m.floodK})`);
  assert.equal(m.end, 1, 'and the End red');
  sdArenaGlowAt(fightAt(t), t + (SD_FLOOD.front_s + SD_FLOOD.fade_s) * 1000 + 1, m);
  assert.equal(m.flood, -1, 'over');
  m = glowMemo();
  const land = t + RS.windup, reset = { rem: { atk: { a: RS.id, at: land, i: 9 } } };
  assert.equal(sdArenaGlowAt(fightAt(t, reset), t + 1, m).reset, 1, 'I as it is called');
  assert.equal(sdArenaGlowAt(fightAt(t, reset), t + 5000, m).reset, 8, 'five seconds in: eight');
  assert.equal(sdArenaGlowAt(fightAt(t, reset), land, m).reset, 12, 'XII as it lands');
  assert.equal(sdArenaGlowAt(fightAt(t, { ...reset, su: t + 9000 }), t + 5000, m).reset, -1, 'stunned: no count');
  assert.equal(sdArenaGlowAt(fightAt(t, { ...reset, fell: { at: t } }), t + 5000, m).reset, -1, 'fallen: nothing');
  assert.equal(sdArenaGlowAt(fightAt(t, { lost: { at: t } }), t, m).end, 1);
  // the sky's word
  const c = new Float32Array(4);
  assert.deepEqual([...sdHourClockOf(fightAt(t, reset), t + 4000, c)].slice(0, 2), [SKY_MODE.reset, 0.5]);
  assert.equal(sdHourClockOf(fightAt(t, { clk: { a: SD_BLOWS.end.id, at: t, i: 1 } }), t, c)[0], SKY_MODE.end);
  assert.equal(sdHourClockOf(fightAt(t, { ec: [{ h: 3 }] }), t, c)[0], SKY_MODE.break);
  const live = sdHourClockOf(fightAt(t, { op: t - 300_000, ends: t + 30_000 }), t, c);
  assert.equal(live[0], SKY_MODE.fight); assert.ok(Math.abs(live[1] - 300 / 330) < 1e-6); assert.equal(live[2], 1, 'its last minute');
  assert.equal(sdHourClockOf(fightAt(t, { fell: { at: t } }), t, c)[0], SKY_MODE.none);
});

test('SD-LOOK THE RIM\'S NUMERALS COUNT THE RESET (S7, the shader): I lights first and XII last, the last two in ember, the rest in the Reset\'s soul-white; a brass glint at rest; every one red when the Hour ends; the flood lights the fissures inside its front alone (mutants: the count reversed; no ember; the front ignored)', () => {
  const f = glslFunctions(SD_ARENA_GLOW_FS, { uR: SD_ARENA_AT.r, uFlood: [-1, 0], uReset: -1, uEnd: 0, uSteps: 10, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFogColor: [0, 0, 0], vP: [0, 0], vWorld: [0, 0, 0], o: [0, 0, 0, 0], texture: () => [1, 0, 0, 0] });
  const C = SD_ARENA_CELL_M, lit = [];
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2, c = [Math.sin(a) * SD_ARENA_NUMERALS.r, Math.cos(a) * SD_ARENA_NUMERALS.r];
    let found = null;
    for (let dx = -8; dx <= 8 && !found; dx++) for (let dz = -8; dz <= 8 && !found; dz++) {
      const p = [(Math.floor(c[0] / C + dx) + 0.5) * C, (Math.floor(c[1] / C + dz) + 0.5) * C];
      if (f.numeralAt(p, h) > 0.5) found = p;
    }
    assert.ok(found, `numeral ${h} drawn`);
    lit.push(found);
  }
  const at = (p, u) => { Object.assign(f.globals, { uReset: -1, uEnd: 0, uFlood: [-1, 0], ...u, vP: p }); f.main(); return f.globals.o; };
  // which light: the nearest of the four by hue (the pixel law scales a colour whole, keeping its hue)
  const REF = { soul: [0.6, 1, 0.82], ember: [1, 0.376, 0.157], red: [1, 0.32, 0.26], rest: [0.85, 0.62, 0.27] };
  const hue = (c) => { const k = Math.max(...c.slice(0, 3)) || 1; return c.slice(0, 3).map((v) => v / k); };
  const kind = (o) => {
    if (Math.max(...o.slice(0, 3)) < 0.5) return 'rest';
    const h = hue(o);
    return Object.entries(REF).filter(([k]) => k !== 'rest').sort((A, B) => hue(A[1]).reduce((n, v, i) => n + (v - h[i]) ** 2, 0) - hue(B[1]).reduce((n, v, i) => n + (v - h[i]) ** 2, 0))[0][0];
  };
  for (let h = 0; h < 12; h++) assert.equal(kind(at(lit[h], {})), 'rest', `numeral ${h} at rest`);
  const order = (h) => (h === 0 ? 12 : h);
  for (const n of [1, 8, 12]) for (let h = 0; h < 12; h++) {
    const want = order(h) > n ? 'rest' : order(h) > 12 - SD_RESET_EMBER ? 'ember' : 'soul';
    assert.equal(kind(at(lit[h], { uReset: n })), want, `numeral ${h} at ${n} lit`);
  }
  for (let h = 0; h < 12; h++) assert.equal(kind(at(lit[h], { uEnd: 1 })), 'red', `numeral ${h} when the Hour ends`);
  // the flood: on a fissure (the field nought there), inside the front and past it
  const g = glslFunctions(SD_ARENA_GLOW_FS, { ...f.globals, texture: () => [0, 0, 0, 0] });
  const flood = (front) => { Object.assign(g.globals, { uReset: -1, uEnd: 0, uFlood: [front, 1], vP: [0, 6] }); g.main(); return g.globals.o[1]; };
  assert.ok(flood(10) > 0.5, 'inside the front: flooded');
  assert.ok(flood(4) < 0.3, 'past the front: dark still (the core\'s faint green)');
});

import { SD_STOMP_WALL, SD_STOMP_WALL_FS, sdStompWalls, sdStompWallRecords, sdStompWallVertices } from '../src/render/sdStompWall.js';
import { stompRingAt } from '../src/net/sdRemnant.js';

test('SD-LOOK THE STOMP\'S RING STANDS AS A WALL (S7): while a Stomp rolls - the Remnant\'s and each living Echo\'s - a wall stands at the very front the law strikes (stompRingAt), fading over its roll\'s last fifth; none before it lands or after; a fallen Echo stands none; banded light rising to a bright lip; the strip closed all round (mutants: a fallen Echo\'s wall; never fading; the lip dropped)', () => {
  const t = 3_000_000, S = SD_BLOWS.stomp, out = sdStompWallRecords();
  const atk = { a: S.id, at: t, x: 2, z: -3, i: 1 };
  const s = fightAt(t, { rem: { atk }, ec: [{ h: 0, atk: { ...atk, i: 2 } }, { h: 5, atk: { ...atk, x: -4, i: 3 } }] });
  assert.equal(sdStompWalls(s, t - 1, out), 0, 'not before it lands');
  assert.equal(sdStompWalls(s, t + 400, out), 2, 'the Remnant\'s and the living Echo\'s');
  assert.deepEqual([out[0].x, out[0].z, out[0].r, out[0].k], [2, -3, stompRingAt(atk, t + 400), 1]);
  assert.equal(out[1].x, -4, 'the living Echo\'s, never the fallen one\'s');
  sdStompWalls(s, t + S.active * 0.9, out);
  assert.ok(Math.abs(out[0].k - 0.5) < 1e-9, 'fading over its last fifth');
  assert.equal(sdStompWalls(s, t + S.active + 1, out), 0, 'rolled out');
  assert.equal(sdStompWalls(fightAt(t, { rem: { atk }, fell: { at: t } }), t + 400, out), 0, 'fallen: none');
  const f = glslFunctions(SD_STOMP_WALL_FS, { uColor: [1, 1, 1], uK: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], vWorld: [0, 0, 0], o: [0, 0, 0, 0] });
  const at = (v) => { f.globals.vP = [0.3, v]; f.main(); return f.globals.o[0]; };
  const body = [0.05, 0.3, 0.6, 0.8].map(at);
  assert.ok(body.every((k) => Math.abs(k * 4 - Math.round(k * 4)) < 1e-9), `banded: ${body}`);
  assert.ok(body[3] >= body[0] && at(0.95) > 1, 'rising to its bright lip, over the body\'s brightest');
  const v = sdStompWallVertices();
  assert.equal(v.length, SD_STOMP_WALL.segs * 12);
  assert.ok(v.includes(0) && v.includes(1), 'all round');
});

import { SdStompWallRenderer, SD_HOLD_WALL, SD_HOLD_CURTAIN } from '../src/render/sdStompWall.js';

test('SD-LOOK THE HOLD IS SEEN (S7): the hold\'s curtain the same wall in gold, taller, a hair outside the arena\'s rim - each wall drawn at its own height and colour, the Stomp\'s at its own (mutants: the height ignored; every wall in the Stomp\'s brass)', () => {
  assert.ok(SD_HOLD_WALL.r > SD_ARENA_AT.r && SD_HOLD_WALL.r < SD_ARENA_AT.r + 0.5, 'a hair outside the rim');
  assert.equal(SD_HOLD_WALL.h, SD_HOLD_CURTAIN.h);
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const r = new SdStompWallRenderer(gl), I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  r.draw([{ x: 0, z: 0, r: 9, k: 1 }, SD_HOLD_WALL], 2, I, I, null);
  const u = (n) => calls.filter((c) => c[1] === n).map((c) => c.slice(2));
  assert.deepEqual(u('uH').map((v) => v[0]), [SD_STOMP_WALL.h, SD_HOLD_CURTAIN.h], 'each at its own height');
  assert.deepEqual(u('uColor').map((v) => [...v[0]]), [[...SD_STOMP_WALL.color], [...SD_HOLD_CURTAIN.color]], 'each in its own light');
  assert.equal(r.drawn, 2);
});
