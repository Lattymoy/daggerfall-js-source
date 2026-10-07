// MOONLIT1 - THE MOONLIT NIGHT (2026-10-07, the owner: "I feel like nighttime is too dark. Like the moonlight needs to
// have detailed lighting when the moon is in full. It should never be pitch black at night").
//
// The enhanced sky's night, pinned with no game data and on the fake GL: the night sky's own light as the floor the
// world's ambient never falls below (NIGHT_SKY, nightSkyLight, withNightFloor); the moons' light - the lit fraction
// squared, the twilight it rises through (moonRise), the haze at the horizon, the lid that diffuses it, the silver it
// leans to, Masser's southern arc; the key taking the directional shadow map once the sun's scale is nought (the
// shadow pass's 'moon' kind, moonShadowAt, the lane's readers, the flats' key slot); the hosts' fold; and the look
// itself, measured through the lane's own arithmetic on a typical default-pack texel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  skyState, moonlightTerm, withMoonAmbient, withNightFloor, nightSkyLight, moonRise, moonCloudiness, moonSkyDirection,
  MOONLIGHT, NIGHT_SKY, MOONS, WEATHER_SKY,
} from '../src/render/enhancedSky.js';
import { exteriorAmbient, sunScale, isNight } from '../src/world/worldClock.js';
import { weatherSunlightScale } from '../src/world/weather.js';
import { dynamicMoonState, dynamicMoonlight } from '../src/render/dynamicSkiesBridge.js';
import { MATERIAL_DEFAULTS } from '../src/systems/dynamicSkies.js';
import { SHADOW_GLSL, SHADOW_MIN_SUN_Y, SHADOW_TUNING, SHADOW_FAR_CASCADE_EVERY, shadowKind } from '../src/render/shadowPass.js';
import {
  EL_LANE, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_DECAL_FS, EL_FAR_RING_FS, EL_BB_VS_EXT,
  elDecode, elEncode, elTonemapRGB, EL_EXPOSURE,
} from '../src/render/enhancedLighting.js';
import { AIR_ADAPT_MAX } from '../src/render/airPass.js';
import { waterSurfaceFs } from '../src/render/waterSurface.js';
import { GAME_GRASS_VS, GAME_GRASS_FS } from '../src/render/labGrass.js';
import { CLOUD_SHADOW_GLSL } from '../src/render/cloudShadow.js';
import { courtLighting } from '../src/render/deadlands.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const hexOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const f32 = (a) => [...a].map(Math.fround);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('MOONLIT1: the night sky\'s own light - a cool floor, greyer under a lid, folded UNDER a host\'s ambient per channel', () => {
  const clear = nightSkyLight(skyState({ minuteOfDay: 0, weather: 'sunny' }));
  const lid = nightSkyLight(skyState({ minuteOfDay: 0, weather: 'thunder' }));
  assert.deepEqual(clear, hexOf(NIGHT_SKY.clear), 'the sunny row\'s scattered cumulus is no lid: the clear floor whole');
  assert.deepEqual(lid, hexOf(NIGHT_SKY.overcast), 'a storm\'s lid: the overcast floor whole');
  assert.ok(clear[2] > clear[1] && clear[1] > clear[0], 'a clear night is cool - blue over green over red');
  assert.ok(lid[0] + lid[1] + lid[2] < clear[0] + clear[1] + clear[2], 'a lid is a little darker');
  assert.ok((lid[2] - lid[0]) < (clear[2] - clear[0]), 'and greyer');
  const mid = nightSkyLight({ cloudCover: (WEATHER_SKY.sunny.cover + WEATHER_SKY.rain.cover) / 2 });
  for (let i = 0; i < 3; i++) assert.ok(near(mid[i], (clear[i] + lid[i]) / 2, 1e-12), 'eased between the two by the lid (smoothstep, its middle)');
  assert.deepEqual(nightSkyLight(null), clear, 'a state with no cover is a clear sky');
  // the fold: per channel, in place, scaled; null touches nothing
  const amb = new Float32Array([0.25, 0.5, 0.1]);
  assert.equal(withNightFloor(amb, [0.3, 0.4, 0.2]), amb, 'in place - the hosts mint the array each frame');
  assert.deepEqual([...amb], f32([0.3, 0.5, 0.2]), 'each channel the greater - a floor, never a lift past it');
  assert.equal(withNightFloor(amb, null, 1), amb);
  assert.deepEqual([...amb], f32([0.3, 0.5, 0.2]), 'the classic sky\'s null is no floor');
  const halved = withNightFloor(new Float32Array([0.1, 0.1, 0.1]), [0.4, 0.6, 0.8], 0.5);
  assert.deepEqual([...halved], f32([0.2, 0.3, 0.4]), 'Night Brightness scales the floor');
});

test('MOONLIT1: the floor leaves a clear day DFU\'s to the byte, darkens a dusk only INTO the night, lifts a storm\'s day to it, and Night Brightness scales it', () => {
  const clearFloor = nightSkyLight(skyState({ minuteOfDay: 0, weather: 'sunny' }));
  const folded = (m, wx = 1, scale = 1, floor = clearFloor) => [...withNightFloor(exteriorAmbient(m, scale, wx), floor, scale)];
  // the floor's bluest channel binds until DFU's lerp passes it - a little after seven, from a little before five
  for (let m = 7 * 60 + 10; m <= 16 * 60 + 50; m++) {
    assert.deepEqual(folded(m), [...exteriorAmbient(m, 1, 1)], `${Math.floor(m / 60)}:${m % 60} - a clear day is DFU's lerp, untouched`);
  }
  assert.notDeepEqual(folded(17 * 60), [...exteriorAmbient(17 * 60, 1, 1)], 'and by five the night\'s floor has the blue');
  let last = Infinity;
  for (let m = 12 * 60; m <= 19 * 60; m++) {
    const a = folded(m), sum = a[0] + a[1] + a[2];
    assert.ok(sum <= last + 1e-9, `${Math.floor(m / 60)}:${m % 60} - the dusk only darkens (${sum.toFixed(4)} after ${last.toFixed(4)})`);
    last = sum;
  }
  assert.deepEqual(folded(0), f32(clearFloor), 'a clear midnight stands on the floor');
  assert.ok(folded(0)[1] > 0.4 && exteriorAmbient(0, 1, 1)[1] === 0.25, 'where DFU stands on 0.25');
  // DFU leaves a storm's noon under a clear night's light (its lerp rides the weather's scale squared): the storm's
  // floor lifts it there and no further; the sun's key is untouched by any of this
  const wx = weatherSunlightScale('thunder', false);
  const stormFloor = nightSkyLight(skyState({ minuteOfDay: 720, weather: 'thunder' }));
  const dfu = [...exteriorAmbient(720, 1, wx)];
  assert.ok(dfu.every((v, i) => v < stormFloor[i]), 'DFU\'s storm noon is darker than the storm\'s own night floor');
  assert.deepEqual(folded(720, wx, 1, stormFloor), f32(stormFloor));
  // Night Brightness: the slider scales the floor as it scales DFU's own night; at nought the night is the player's black
  assert.deepEqual(folded(0, 1, 0), [0, 0, 0]);
  folded(0, 1, 0.5).forEach((v, i) => assert.ok(near(v, Math.fround(clearFloor[i] * 0.5), 1e-7), `half brightness, channel ${i}`));
});

test('MOONLIT1: the moons take the night as the twilight goes - nought while the sun is up, so the two keys are never both lit', () => {
  for (let m = 0; m < 1440; m++) {
    const r = moonRise({ minuteOfDay: m });
    assert.ok(r >= 0 && r <= 1);
    if (r > 0) assert.equal(sunScale(m), 0, `${m}: the moon rises only where the sun's key is nought`);
    if (!isNight(m)) assert.equal(r, 0, `${m}: the day is the sun's`);
    const next = moonRise({ minuteOfDay: (m + 1) % 1440 });
    assert.ok(Math.abs(next - r) < 0.07, `${m}: no step (${(next - r).toFixed(4)} in a minute)`);
  }
  assert.equal(moonRise({ minuteOfDay: 0 }), 1, 'midnight is the moons\'');
  assert.equal(moonRise({ minuteOfDay: 18 * 60 }), 0, 'the dusk minute itself is not yet');
  assert.ok(near(moonRise({ minuteOfDay: 18 * 60 + 12 }), 0.5, 1e-3), 'three degrees down, half way');
  assert.equal(moonRise({ minuteOfDay: 18 * 60 + 30 }), 1, 'and whole once the sun is twilightDeg under');
  assert.equal(moonRise({ minuteOfDay: 6 * 60 }), 0, 'the dawn minute is the sun\'s');
  for (const m of [1085, 1095, 1300, 300, 355]) {
    assert.ok(near(moonRise(skyState({ minuteOfDay: m })), moonRise({ minuteOfDay: m })), `${m}: the state's own elevation and its clock agree`);
  }
  assert.equal(moonRise({ night: true }), 1, 'a state with no clock keeps the night boolean');
  assert.equal(moonRise({ night: false }), 0);
});

test('MOONLIT1: a moon\'s light is its lit fraction squared, fades into the haze at the horizon, and a lid turns its key into fill', () => {
  const st = (phase, y = 0.9, cover = WEATHER_SKY.sunny.cover, sPhase = 0) => ({
    minuteOfDay: 0, cloudCover: cover,
    masser: { dir: [0, y, -Math.sqrt(Math.max(0, 1 - y * y))], phase, vis: 1, color: [0.8, 0.6, 0.5] },
    secunda: { dir: [0, 1, 0], phase: sPhase, vis: 1, color: [0.9, 0.9, 0.85] },
  });
  const full = moonlightTerm(st(4)).scale;
  assert.equal(full, MOONLIGHT.masser, 'full, clear, high and whole: the key\'s own dial');
  assert.ok(near(moonlightTerm(st(3)).scale / full, 0.5625), 'gibbous: three quarters lit, nine sixteenths the light');
  assert.ok(near(moonlightTerm(st(2)).scale / full, 0.25), 'a half moon: a quarter');
  assert.ok(near(moonlightTerm(st(1)).scale / full, 0.0625), 'a crescent: a sixteenth');
  assert.ok(near(moonlightTerm(st(6)).scale, moonlightTerm(st(2)).scale), 'waning as waxing');
  // the horizon's haze: nought at it, whole above horizonY, eased between - and the fill fades in from the dome's -0.05
  assert.equal(moonlightTerm(st(4, 0)).scale, 0, 'on the horizon, no key');
  let lastK = 0;
  for (let y = 0; y <= MOONLIGHT.horizonY + 1e-9; y += 0.005) {
    const k = moonlightTerm(st(4, y)).scale;
    assert.ok(k >= lastK && k - lastK < 0.02, `y ${y.toFixed(3)}: the key climbs by slivers`);
    lastK = k;
  }
  assert.ok(near(lastK, full, 1e-6));
  assert.equal(moonlightTerm(st(4, -0.05)), null, 'set under the dome\'s own cut: no key, no fill');
  // the lid: none at the sunny row, all of it from the rain row; the key times (1 - cloudDiffuse c), and a share of
  // what it took back as fill
  assert.equal(moonCloudiness(WEATHER_SKY.sunny.cover), 0);
  assert.equal(moonCloudiness(WEATHER_SKY.rain.cover), 1);
  assert.equal(moonCloudiness(WEATHER_SKY.thunder.cover), 1);
  assert.ok(moonCloudiness(WEATHER_SKY.cloudy.cover) > 0.2 && moonCloudiness(WEATHER_SKY.cloudy.cover) < 0.4, 'broken cloud lets most of the key through');
  const half = (WEATHER_SKY.sunny.cover + WEATHER_SKY.rain.cover) / 2, c = moonCloudiness(half);
  assert.ok(near(c, 0.5));
  const lidded = moonlightTerm(st(4, 0.9, half));
  assert.ok(near(lidded.scale, MOONLIGHT.masser * (1 - MOONLIGHT.cloudDiffuse * c)));
  const fill = MOONLIGHT.skyFill + MOONLIGHT.cloudFill * MOONLIGHT.cloudDiffuse * c * MOONLIGHT.masser;
  for (let i = 0; i < 3; i++) assert.ok(near(lidded.ambient[i], lidded.color[i] * fill), `channel ${i}: her sky and the lid's share, in her key's colour`);
  // Secunda's lift: her colour, her own phase squared - and no key from her
  const sec = moonlightTerm(st(0, 0.9, WEATHER_SKY.sunny.cover, 4));
  assert.equal(sec.scale, 0);
  for (let i = 0; i < 3; i++) assert.ok(near(sec.ambient[i], [0.9, 0.9, 0.85][i] * MOONLIGHT.secunda));
  assert.ok(near(moonlightTerm(st(0, 0.9, WEATHER_SKY.sunny.cover, 2)).ambient[0], 0.9 * MOONLIGHT.secunda * 0.25));
  // the colour: her rose leaned toward silver by silverMix
  const sv = hexOf(MOONLIGHT.silver), t = moonlightTerm(st(4));
  assert.deepEqual(t.color, [0.8, 0.6, 0.5].map((v, i) => v + (sv[i] - v) * MOONLIGHT.silverMix));
  assert.ok(t.color[2] > 0.5 && t.color[2] >= t.color[1], 'moonlight is seen cool');
  assert.equal(t.casts, true, 'the world\'s moon');
});

test('MOONLIT1: Masser\'s arc leans south - due east and west at rise and set, off the zenith at midnight; the slot\'s other tenants never cast', () => {
  assert.ok(MOONS.masser.tilt < -0.3 && MOONS.masser.tilt > -0.5, 'about twenty degrees, toward -Z (the star pole is north)');
  const dusk = moonSkyDirection(18 * 60, 4, MOONS.masser.tilt);
  assert.ok(near(dusk[0], 1, 1e-6) && Math.abs(dusk[1]) < 1e-6 && Math.abs(dusk[2]) < 1e-6, 'a full Masser rises due east as the sun sets');
  const mid = moonSkyDirection(0, 4, MOONS.masser.tilt);
  assert.ok(mid[1] > 0.9 && mid[2] < -0.3, 'high at midnight, in the south');
  // so a wall facing her takes a third of her key at midnight, and a caster's shadow lies beside it
  assert.ok(dot(mid, [0, 0, -1]) > 0.3 && Math.hypot(mid[0], mid[2]) / mid[1] > 0.3);
  const state = skyState({ minuteOfDay: 0, phases: { masser: 4, secunda: 3 } });
  assert.deepEqual(state.masser.dir, mid, 'the dome draws her where the light comes from');
  // the court's key and the automap's fill ride the moon's slot and never claim the map
  assert.equal('casts' in courtLighting().key, false);
  assert.equal('casts' in courtLighting({ strength: 1, az: 0.4, elev: 0.6 }).key, false);
  assert.match(read('src/ui/automapWindow.js'), /renderer\.setMoonlight\(\{ scale: beacon\.fill, dir: BEACON_FILL_DIR, color: WHITE3 \}\);/);
  assert.doesNotMatch(read('src/scenes/worldModes.js') + read('src/ui/automapWindow.js') + read('src/render/deadlands.js'), /casts:/);
});

test('MOONLIT1: under Dynamic Skies the mod\'s moons take the same law - its state carries the clock and the lid', () => {
  const dyn = (masser, cover) => ({
    mat: { ...MATERIAL_DEFAULTS }, _sunDir: [0, -0.5, 0],
    phases: { masser: { phase: masser }, secunda: { phase: 0 } },
    moonDirection: (w) => (w === 'Moon' ? [0, 0.8, -0.6] : [0, 0.5, 0.5]),
  });
  const clear = dynamicMoonState(dyn(4, 0), 0, WEATHER_SKY.sunny.cover);
  assert.equal(clear.minuteOfDay, 0, 'the clock the moons rise on');
  assert.equal(clear.cloudCover, WEATHER_SKY.sunny.cover, 'the lid the key is diffused by');
  const t = dynamicMoonlight(clear);
  assert.equal(t.casts, true);
  assert.ok(near(t.scale, MOONLIGHT.masser * clear.masser.vis), 'full, high, clear: the dial times the mod\'s own visibility');
  const storm = dynamicMoonlight(dynamicMoonState(dyn(4, 0), 0, WEATHER_SKY.thunder.cover));
  assert.ok(storm.scale < t.scale * 0.1, 'under the lid the key goes to fill');
  assert.equal(dynamicMoonlight(dynamicMoonState(dyn(4, 0), 12 * 60, 0)), null, 'and by day there is none');
  assert.deepEqual(nightSkyLight(clear), hexOf(NIGHT_SKY.clear), 'the floor reads the mod\'s state as the dome\'s');
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /nightFloor\(\) \{\n\s*if \(enhancedSky\?\.state\) return nightSkyLight\(enhancedSky\.state\);\n\s*return dynamicMoons \? nightSkyLight\(dynamicMoons\) : null;\n\s*\},/,
    'the sky\'s seam: the dome\'s state, the mod\'s moons, and null under the classic sky');
});

test('MOONLIT1: the receiver block - the moon term reads the map only where the moon drew it; the lane\'s readers, the water and the grass take it', () => {
  assert.match(SHADOW_GLSL, /float moonShadowAt\(vec3 wp, vec3 n\) \{ return uSunShadowParams\.w > 1\.5 \? sunShadowTap\(wp, n, false, 0\.0\) : 1\.0; \}/);
  assert.match(SHADOW_GLSL, /if \(uSunShadowParams\.w <= 0\.0\) return 1\.0;/, 'the map\'s own tap: on at 1 (the sun\'s) and 2 (the moon\'s)');
  const moonTerm = 'float mdiff = (uMoonScale > 0.0 && mndl > 0.0) ? mndl * moonShadowAt(vWorldPos, n) : 0.0;';
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['character', EL_CHAR_FS]]) {
    assert.equal(fs.split(moonTerm).length - 1, 1, `${name}: the moon's N.L under her map, gated as the sun's`);
    assert.ok(fs.includes('float mndl = max(dot(n, uMoonDir), 0.0);'), name);
    assert.ok(fs.includes('uMoonColor * (uMoonScale * mdiff)'), `${name}: and that term is the one the lit sum takes`);
  }
  assert.ok(EL_DECAL_FS.includes('vec3 moonLit = (dot(uDecalMoon, uDecalMoon) > 0.0 && mndl > 0.0) ? uDecalMoon * (mndl * moonShadowAt(vWorld, n)) : vec3(0.0);'), 'a mark lies under the moon\'s shadow as its floor does');
  assert.ok(!EL_FAR_RING_FS.includes('moonShadowAt'), 'the far ring stands past every cascade');
  // a flat's key slot is the owner's: the lane reads the map whoever drew it, by the line it always had
  assert.ok(EL_BB_VS_EXT.main.includes('vBBSunVis = dot(uBBSun, uBBSun) > 0.0 ? (uMesh > 0.5 ? sunShadowAt('));
  // the water: the lane's program reads her map for her diffuse and her glint; the classic one never
  const laneWater = waterSurfaceFs(CLOUD_SHADOW_GLSL, SHADOW_GLSL), classicWater = waterSurfaceFs(CLOUD_SHADOW_GLSL);
  assert.ok(laneWater.includes('float mshadow = uMoonScale > 0.0 ? moonShadowAt(vWorldPos, n) : 0.0;'));
  assert.ok(classicWater.includes('float mshadow = 1.0;') && !classicWater.includes('moonShadowAt('), 'the classic water has no map to read');
  for (const w of [laneWater, classicWater]) {
    assert.ok(w.includes('float mdiff = max(dot(n, uMoonDir), 0.0) * mshadow;') && w.includes('* uMoonScale * mshadow;'), 'the body and the glint');
  }
  // the grass: the root's read beside the sun's, one value a triangle, and the fragment's moon under it
  assert.ok(GAME_GRASS_VS.includes('vMoonSh = (gl_VertexID % 3 == 2 && uMoonScale > 0.0) ? moonShadowAt(rootW + vec3(0.0, '));
  assert.ok(GAME_GRASS_VS.includes('flat out float vMoonSh;') && GAME_GRASS_VS.includes('uniform float uMoonScale;'));
  assert.ok(GAME_GRASS_FS.includes('flat in float vMoonSh;') && GAME_GRASS_FS.includes('uMoonCol * (uMoonScale * vMoonLam * vMoonSh)'));
});

/** A recording fake GL (el2's). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE_CUBE_MAP_POSITIVE_X: 100, TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A lit frame on the lane: one mesh, one terrain surface, one billboard batch (el2's drawWorld). */
function drawWorld(r) {
  r.textures.set('1_1', { id: 't11' }); r.textures.set('210_1', { id: 't2101' });
  const mesh = { vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  r.drawMesh(mesh, I, null);
  r.drawTerrain({ vao: { id: 'vao-t' }, indexCount: 6 }, I, {}, {}, 6.4);
  r.drawBillboards([{ archive: 210, record: 1, vao: { id: 'vao-b' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [1, 0, 1] }], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
}
const NIGHT_AMB = new Float32Array([0.38, 0.42, 0.5]);
const MOON = Object.freeze({ scale: 0.44, dir: [0, 0.94, -0.34], color: [0.79, 0.74, 0.78], casts: true });
const SUNSET = new Float32Array([-1, 0, 0]);   // worldClock.sunDirection's clamp at night

test('MOONLIT1: the renderer hands the world\'s moon the directional map once the sun\'s scale is nought - and only her', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  const seen = [];
  const render = sp.render.bind(sp);
  sp.render = (f) => { seen.push({ moon: f.moon, sunScale: f.sunScale, lightDir: [...f.lightDir] }); return render(f); };
  const frame = () => { calls.length = 0; r.beginFrame(I, I, SUNSET, WORLD_FRAME); drawWorld(r); return seen.at(-1); };
  // night: the sun nought, the world's moon high and lit
  r.setLighting(NIGHT_AMB, 0, new Float32Array([1, 1, 1]));
  r.setMoonlight(MOON);
  frame();
  const f = frame();
  assert.equal(f.moon, true, 'the hand-over');
  assert.deepEqual(f.lightDir, f32(MOON.dir), 'the cascades drawn from HER direction');
  assert.equal(f.sunScale, MOON.scale, 'at her scale');
  assert.equal(sp.kind, 'moon'); assert.equal(sp.sunParams[3], 2, 'the receivers hear the map is the moon\'s');
  assert.equal(sp.stats.cascadesDrawn, 3);
  assert.equal(r._moonMapNow, true);
  // the flats: her half rides the key slot the lane shadows, and leaves the tint
  const am = NIGHT_AMB.map(elDecode), mc = MOON.color.map(elDecode);
  const tint = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uTint').at(-1), key = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uBBSun').at(-1);
  for (let i = 0; i < 3; i++) {
    assert.ok(near(tint[2 + i], am[i], 1e-6), `the tint is the ambient alone (channel ${i})`);
    assert.ok(near(key[2 + i], mc[i] * MOON.scale * 0.5, 1e-6), `her Lambert-average half in the key slot (channel ${i})`);
  }
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunShadowParams' && c[2][3] === 2), 'uploaded as hers');
  // the sun up: the map is the sun's, her half back on the tint
  r.setLighting(NIGHT_AMB, 0.3, new Float32Array([1, 1, 1]));
  const day = frame();
  assert.equal(day.moon, false); assert.deepEqual(day.lightDir, [...SUNSET]); assert.equal(sp.sunParams[3], 0, 'the sun at the horizon has no map (SHADOW_MIN_SUN_Y) - and the moon does not take it while its scale stands');
  assert.equal(r._moonMapNow, false);
  const dayTint = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uTint').at(-1);
  assert.ok(near(dayTint[2], am[0] + mc[0] * MOON.scale * 0.5, 1e-6), 'her half on the tint again');
  // the court's key (no `casts`) on the same slot: never the map
  r.setLighting(NIGHT_AMB, 0, new Float32Array([1, 1, 1]));
  r.setMoonlight({ scale: 0.6, dir: [0, 0.9, 0.43], color: [1, 0.5, 0.3] });
  assert.equal(frame().moon, false); assert.equal(sp.kind, 'point');
  // her, too low to throw a usable map - the sun's own height rule
  r.setMoonlight({ ...MOON, dir: [0.999, SHADOW_MIN_SUN_Y * 0.8, 0] });
  assert.equal(shadowKind(MOON.scale, [0.999, SHADOW_MIN_SUN_Y * 0.8, 0]), 'point');
  assert.equal(frame().moon, false);
  // and too faint
  r.setMoonlight({ ...MOON, scale: 0.005 });
  assert.equal(frame().moon, false);
  // the classic set: no maps, so no frame of it is hers
  r.setMoonlight(MOON);
  frame();
  assert.equal(r._moonMapNow, true);
  r.setLightingLane(null);
  calls.length = 0;
  r.beginFrame(I, I, SUNSET, WORLD_FRAME);
  assert.equal(r._moonMapNow, false, 'a frame with no maps owns none');
  drawWorld(r);
  const classicTint = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uTint').at(-1);
  assert.ok(near(classicTint[2], NIGHT_AMB[0] + MOON.color[0] * MOON.scale * 0.5, 1e-6), 'the classic flats keep her half on the tint');
});

test('MOONLIT1: a lens-local pass and a studio bake read no moon-owned map - their geometry is at the origin of a private space; a world character takes her map, and a sun-owned map is untouched', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.setLighting(NIGHT_AMB, 0, new Float32Array([1, 1, 1]));
  r.setMoonlight(MOON);
  r.beginFrame(I, I, SUNSET, WORLD_FRAME); drawWorld(r);
  r.beginFrame(I, I, SUNSET, WORLD_FRAME);
  assert.equal(r.shadows.sunParams[3], 2, 'the moon owns the map');
  const flags = () => calls.filter((c) => (c[0] === 'uniform4fv' || c[0] === 'uniform4f') && c[1] === 'uSunShadowParams').map((c) => (c[0] === 'uniform4f' ? c[5] : c[2][3]));
  const sprite = (lensLocal) => { calls.length = 0; r.renderCharacterSprite({ vao: {}, count: 3 }, I, I, I, 8, 8, { lensLocal }); return flags(); };
  const lens = sprite(true);
  assert.ok(lens.length >= 2 && lens.at(-1) === 0, `the viewmodel's block hears no map (${JSON.stringify(lens)})`);
  assert.equal(r._lensDepth, 0, 'the depth back');
  calls.length = 0;
  r.renderCharacterSpriteImage({ vao: {}, count: 3 }, I, I, I, 8, 8);   // the studio bake: the inventory figure, an item icon
  const studio = flags();
  assert.ok(studio.length >= 2 && studio.at(-1) === 0, `nor does the studio bake's (${JSON.stringify(studio)})`);
  assert.equal(r._studioDepth, 0);
  const world = sprite(false);
  assert.ok(world.length >= 1 && world.at(-1) === 2, `a character in the world takes her map (${JSON.stringify(world)})`);
  // by day the sun's map is the lens-local pass's as before - this slice changes nothing there
  r.setLighting(NIGHT_AMB, 0.4, new Float32Array([1, 1, 1]));
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME); drawWorld(r);
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  assert.equal(r.shadows.sunParams[3], 1);
  assert.equal(sprite(true).at(-1), 1, 'a sun-owned map is not the guard\'s');
});

test('MOONLIT1: a map drawn from the other light is never kept - the owner\'s change redraws every cascade, and an empty frame is not held across it', () => {
  const was = SHADOW_TUNING.override;
  SHADOW_TUNING.override = false;   // the far cascade every other frame (Steady shadows off), so a held map would show
  try {
    const { canvas } = recordingGl();
    const r = new Renderer(canvas);
    r.setLightingLane(EL_LANE);
    const sp = r.shadows;
    const frame = (draw = true) => { r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME); if (draw) drawWorld(r); };
    r.setLighting(NIGHT_AMB, 0.4, new Float32Array([1, 1, 1]));
    r.setMoonlight(MOON);
    frame(); frame();
    assert.equal(sp.kind, 'sun');
    if (sp.frameNo % SHADOW_FAR_CASCADE_EVERY !== 0) frame();   // land the sun on a frame that drew the far cascade...
    assert.equal(sp.frameNo % SHADOW_FAR_CASCADE_EVERY, 0);
    r.setLighting(NIGHT_AMB, 0, new Float32Array([1, 1, 1]));
    frame();   // ...so the moon's first frame is one the cadence would skip it on
    assert.equal(sp.kind, 'moon');
    assert.notEqual(sp.frameNo % SHADOW_FAR_CASCADE_EVERY, 0, 'a frame the far cascade waits on');
    assert.equal(sp.stats.cascadesDrawn, 3, 'all three drawn from the moon - none of the sun\'s held');
    frame(); frame();
    assert.equal(sp.stats.cascadesDrawn, 2, 'and the cadence is live: her own far map is kept on the next such frame');
    // an empty frame is held under the light that drew the maps (EMPTY-HOLD) - and never under the other one
    r.setLighting(NIGHT_AMB, 0.4, new Float32Array([1, 1, 1]));
    frame(); frame(false);   // the sun's maps, from the last frame that drew anything
    frame(false);
    assert.equal(sp.kind, 'sun', 'the control: an empty frame under the same sun is held');
    r.setLighting(NIGHT_AMB, 0, new Float32Array([1, 1, 1]));
    frame(false);
    assert.equal(sp.kind, null, 'the sun\'s maps were not held as the moon\'s');
    assert.equal(sp.sunParams[3], 0);
  } finally { SHADOW_TUNING.override = was; }
});

test('MOONLIT1: both exterior hosts fold the floor under DFU\'s night with one Night Brightness read; the interiors keep their own', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /import \{ withMoonAmbient, withNightFloor \} from '\.\.\/render\/enhancedSky\.js';/);
    assert.match(h, /const nightScale = getFloat\('Enhancements', 'NightAmbientLightScale', 0, 1\);\n\s*renderer\.setLighting\(\n\s*.*withMoonAmbient\(withNightFloor\(exteriorAmbient\(minute, nightScale, wxNow\.sun\), sky\.nightFloor\(\), nightScale\), moonNow\)/,
      `${host}: the floor under DFU's lerp, the moonlit sky over both`);
    assert.ok(h.includes('renderer.setMoonlight(moonNow);'));
  }
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/interior.js', 'src/scenes/dungeon.js']) {
    assert.ok(!read(host).includes('nightFloor'), `${host}: no sky, no night of its own - DFU's interior and dungeon light stand`);
  }
});

// THE LOOK, measured: a typical default-pack texel (display 0.30 - the temperate terrain's own mean is 0.31, the
// buildings' 0.20-0.34) through the lane's own arithmetic - decode, exposure times the eye at its night ceiling, the
// colour curve, encode - as the frame the host builds would light it.
const ALBEDO = 0.30;
function lane(ambient, keys, n) {
  const alb = elDecode(ALBEDO);
  const light = [0, 1, 2].map((i) => elDecode(ambient[i]) + keys.reduce((a, k) => a + elDecode(k.color[i]) * k.scale * Math.max(0, dot(n, k.dir)), 0));
  return elTonemapRGB(light.map((v) => v * alb * EL_EXPOSURE * AIR_ADAPT_MAX)).map((v) => Math.round(elEncode(v) * 255));
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function nightAt(minute, weather, phases) {
  const s = skyState({ minuteOfDay: minute, weather, phases });
  const moon = moonlightTerm(s);
  const ambient = withMoonAmbient(withNightFloor(exteriorAmbient(minute, 1, weatherSunlightScale(weather, false)), nightSkyLight(s), 1), moon);
  return { ambient, moon };
}
const UP = [0, 1, 0];

test('MOONLIT1: never pitch black - every night, every phase, every weather row, the shade of a typical texel reads', () => {
  assert.ok(lum(lane(exteriorAmbient(0, 1, 1), [], UP)) < 26, 'DFU\'s 0.25 night: the texel at ~24/255, with the eye wide open - the report');
  let worst = Infinity, at = '';
  for (const weather of Object.keys(WEATHER_SKY)) {
    for (let p = 0; p <= 8; p += 0.5) {
      for (let m = 18 * 60; m < 30 * 60; m += 20) {
        const { ambient } = nightAt(m % 1440, weather, { masser: p, secunda: (p + 7) % 8 });
        const l = lum(lane(ambient, [], UP));   // the shade: no key at all
        if (l < worst) { worst = l; at = `${weather} phase ${p} at ${Math.floor((m % 1440) / 60)}:${m % 60}`; }
      }
    }
  }
  assert.ok(worst >= 33, `the darkest shade of any night reads ${worst.toFixed(1)}/255 (${at})`);
});

test('MOONLIT1: a full moon lights the world in detail - bright where she reaches, a shadow that reads, a wall facing her lit at midnight', () => {
  const full = { masser: 4, secunda: 3 };
  for (const m of [21 * 60, 0, 3 * 60]) {
    const { ambient, moon } = nightAt(m, 'sunny', full);
    const lit = lum(lane(ambient, [moon], UP)), shade = lum(lane(ambient, [], UP));
    assert.ok(lit >= 68, `${m}: the moonlit ground reads ${lit.toFixed(1)}`);
    assert.ok(lit - shade >= 15, `${m}: and her shadow on it reads (${lit.toFixed(1)} against ${shade.toFixed(1)})`);
    assert.ok(shade >= 45, `${m}: the moonlit sky lifts the shade (${shade.toFixed(1)})`);
  }
  const { ambient, moon } = nightAt(0, 'sunny', full);
  const wall = lum(lane(ambient, [moon], [0, 0, -1]));
  assert.ok(wall - lum(lane(ambient, [], [0, 0, -1])) >= 8, `a south wall takes her key at midnight (${wall.toFixed(1)})`);
  // the moonless night stands on the floor, cool and readable; a half moon sits between
  const dark = lane(nightAt(0, 'sunny', { masser: 0, secunda: 7 }).ambient, [], UP);
  assert.ok(lum(dark) >= 40 && lum(dark) <= 48, `a moonless clear night reads ${lum(dark).toFixed(1)}`);
  assert.ok(dark[2] > dark[0], 'and cool');
  const halfAt = nightAt(21 * 60, 'sunny', { masser: 2, secunda: 1 });
  const halfLit = lum(lane(halfAt.ambient, [halfAt.moon], UP));
  assert.ok(halfLit > lum(dark) + 3 && halfLit < 68, `a half moon's ground reads ${halfLit.toFixed(1)}`);
  // under a lid, her light is a glow with no shadow worth the name
  const lid = nightAt(0, 'overcast', full);
  const lidLit = lum(lane(lid.ambient, [lid.moon], UP)), lidShade = lum(lane(lid.ambient, [], UP));
  assert.ok(lidLit - lidShade < 4 && lidShade > lum(dark) - 6, `overcast: ${lidLit.toFixed(1)} lit, ${lidShade.toFixed(1)} shade`);
  // and noon is the sun's: the fold leaves it exactly as it was
  const noon = exteriorAmbient(720, 1, 1);
  assert.deepEqual([...withNightFloor(exteriorAmbient(720, 1, 1), nightSkyLight(skyState({ minuteOfDay: 720 })), 1)], [...noon]);
  assert.equal(moonlightTerm(skyState({ minuteOfDay: 720, phases: full })), null);
});
