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
