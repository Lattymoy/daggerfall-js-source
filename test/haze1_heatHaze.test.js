// HAZE1 (2026-10-08, Mac: "We have permission to use and implement everything into the codebase. These should be on
// by default and integrate into our enhanced environments seamlessly") - HEAT HAZE 1.0.1 (demifiend000), ported off its
// assembly and its compiled shader (vendor/heat-haze/). bible/07-Rendering/Heat-Haze.md is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  HEAT_HAZE_VENDOR, HAZE, HAZE_CLIMATES, HAZE_OFF, weatherStrength, meetsRules, daylightStrength, isDayMinute, hazeNoise,
  heatHazeSettings, heatHazeOn, createHeatHaze,
} from '../src/systems/heatHaze.js';
import { HeatHazeRenderer, hazeCylinder, hazePhase, HAZE_AXES, HAZE_DRIFT } from '../src/render/heatHaze.js';
import { MOD_SETTINGS, modSetting, setModSetting } from '../src/systems/modSettings.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);

test('HAZE1 the rules: Desert and Desert2 by day under a sunny (1) or cloudy (0.5) sky, outdoors; Subtropical only with AllowSubtropical; every other weather 0, the sandstorm too (HeatHazeEligibility.MeetsRules, GetWeatherStrength) (mutants: cloudy at full; subtropical always; the day ignored)', () => {
  assert.deepEqual(HAZE_CLIMATES, { desert: 224, desert2: 225, subtropical: 229 });
  assert.deepEqual(['sunny', 'cloudy', 'overcast', 'fog', 'rain', 'thunder', 'snow', 'sandstorm'].map(weatherStrength), [1, 0.5, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(weatherStrength), [1, 0.5, 0, 0, 0, 0, 0], 'DFU\'s WeatherType numbers too');
  assert.equal(meetsRules(true, 224, true, 'sunny', false), true);
  assert.equal(meetsRules(true, 225, true, 'cloudy', false), true);
  assert.equal(meetsRules(true, 229, true, 'sunny', false), false, 'subtropical: opt-in');
  assert.equal(meetsRules(true, 229, true, 'sunny', true), true);
  assert.equal(meetsRules(true, 226, true, 'sunny', true), false, 'the mountains: never');
  assert.equal(meetsRules(false, 224, true, 'sunny', false), false, 'inside: never');
  assert.equal(meetsRules(true, 224, false, 'sunny', false), false, 'by night: never');
  assert.equal(meetsRules(true, 224, true, 'overcast', false), false);
  // IsDay: 06:00 up to 18:00
  assert.deepEqual([359, 360, 1079, 1080].map(isDayMinute), [false, true, true, false]);
});

test('HAZE1 the daylight: 0 to 06:00, a smoothstep over the thirty minutes after it, 1 through the day, down over the thirty before 18:00 (GetDaylightStrength) (mutants: the ramp an hour; the evening ramp dropped; the min a max)', () => {
  assert.equal(daylightStrength(360), 0);
  assert.equal(daylightStrength(375), 0.5, 'half way up the ramp: smoothstep(0.5)');
  near(daylightStrength(366), 0.104, 1e-9, 'smoothstep(0.2) = 0.04 x 2.6');
  assert.equal(daylightStrength(390), 1);
  assert.equal(daylightStrength(720), 1);
  assert.equal(daylightStrength(1065), 0.5);
  near(daylightStrength(1074), 0.104, 1e-9);
  assert.equal(daylightStrength(1080), 0);
  assert.equal(daylightStrength(1300), 0);
  assert.equal(daylightStrength(375.5), daylightStrength(1080 - 15.5), 'the two ramps are one law');
});

test('HAZE1 the noise: CreateNoiseTexture byte for byte - System.Random(1212701233) on an 8 x 8 lattice, two channels, single precision, banker\'s rounding (the sha256 the mod\'s own C# makes, compiled under .NET 8 from its decompiled CreateNoiseTexture) (mutants: the seed; the lattice; the channels swapped)', () => {
  const b = hazeNoise();
  assert.equal(b.length, 64 * 64 * 4);
  assert.equal(createHash('sha256').update(b).digest('hex'), 'd83ba92e2e7bc98377d795cbab6bf653d952eacd2f2e33f8b02e2755c370be04');
  assert.deepEqual([b[0], b[1], b[2], b[3], b[4], b[5], b[1000], b[1001], b[16380], b[16381]], [100, 39, 0, 255, 103, 45, 152, 184, 103, 51]);
  assert.deepEqual([HAZE.noiseSeed, HAZE.noiseSize, HAZE.noiseLattice], [1212701233, 64, 8]);
});

test('HAZE1 the strength: eases toward Intensity x daylight x weather with a 0.8 s time constant and snaps within 1e-4; an ineligible frame, or the switch off, drops it to 0 at once; the ring rides the player at 1.5 m over the foot taken while grounded (HeatHazeMod.Update, UpdateRingTransform) (mutants: the ease linear; the drop eased; the layer read in the air; the offset)', () => {
  const s = heatHazeSettings((k) => MOD_SETTINGS[HEAT_HAZE_VENDOR].keys[k].default);
  assert.deepEqual(s, { enabled: true, allowSubtropical: false, intensity: 1.5, distance: 400.4, ringHeight: 1006, noiseScale: 4.5, animationSpeed: 4 }, 'the mod\'s defaults');
  const h = createHeatHaze();
  const noon = { exterior: true, climate: 224, weather: 'sunny', minuteOfDay: 720, foot: [10, 20, 30], grounded: true, settings: s };
  let st = h.tick({ ...noon, dt: 0.8 });
  near(st.intensity, 1.5 * (1 - Math.exp(-1)), 1e-12, 'one time constant');
  assert.deepEqual(st.center, [10, 21.5, 30]);
  assert.equal(st.radius, 400.4);
  assert.equal(st.halfHeight, 503);
  for (let i = 0; i < 200; i++) st = h.tick({ ...noon, dt: 0.1 });
  assert.equal(st.intensity, 1.5, 'snapped');
  st = h.tick({ ...noon, dt: 0.1, weather: 'cloudy' });
  near(st.intensity, 1.5 - 0.75 * (1 - Math.exp(-0.125)), 1e-12, 'easing down to the cloudy target');
  st = h.tick({ ...noon, dt: 0.1, weather: 'rain' });
  assert.equal(st.intensity, 0, 'ineligible: at once');
  assert.equal(st.visible, false);
  h.tick({ ...noon, dt: 10 });
  st = h.tick({ ...noon, dt: 0.1, settings: HAZE_OFF });
  assert.equal(st.intensity, 0, 'switched off: at once');
  h.tick({ ...noon, dt: 10 });
  h.suppress();
  st = h.tick({ ...noon, dt: 0 });
  assert.equal(st.intensity, 0, 'suppressed (inside) and no time since');
  // the layer: read while grounded, kept in the air
  st = h.tick({ ...noon, dt: 0.1, foot: [0, 50, 0], grounded: false });
  assert.equal(st.center[1], 21.5, 'a jump does not lift the ring');
  st = h.tick({ ...noon, dt: 0.1, foot: [0, 50, 0], grounded: true });
  assert.equal(st.center[1], 51.5);
});

test('HAZE1 the settings: the mod\'s keys, its own Enabled the port\'s switch (on by default, MO1), clamped as LoadSettings clamps them; `?haze=off` the kill door (mutants: a clamp dropped; off by default)', () => {
  assert.equal(MOD_SETTINGS[HEAT_HAZE_VENDOR].keys.Enabled.default, true);
  assert.deepEqual(Object.keys(MOD_SETTINGS[HEAT_HAZE_VENDOR].keys), ['Enabled', 'Heat Haze.AllowSubtropical', 'Heat Haze.Intensity', 'Heat Haze.FullStrengthDistance', 'Heat Haze.RingHeight', 'Heat Haze.NoiseScale', 'Heat Haze.AnimationSpeed']);
  const ms = JSON.parse(read('vendor/heat-haze/modsettings.json').replace(/^﻿/, ''));
  for (const k of ms.Sections[0].Keys) {
    if (k.Name === 'Enabled') continue;
    const def = MOD_SETTINGS[HEAT_HAZE_VENDOR].keys[`Heat Haze.${k.Name}`];
    assert.equal(def.default, k.Value, `${k.Name}: the mod's default`);
    assert.equal(def.description, k.Description, `${k.Name}: the mod's words`);
    if ('Min' in k) assert.deepEqual([def.min, def.max], [k.Min, k.Max], `${k.Name}: the mod's range`);
  }
  const wild = { Enabled: true, 'Heat Haze.AllowSubtropical': true, 'Heat Haze.Intensity': 9, 'Heat Haze.FullStrengthDistance': 1, 'Heat Haze.RingHeight': 99999, 'Heat Haze.NoiseScale': 0, 'Heat Haze.AnimationSpeed': -3 };
  assert.deepEqual(heatHazeSettings((k) => wild[k]), { enabled: true, allowSubtropical: true, intensity: 3, distance: 50, ringHeight: 1500, noiseScale: 0.25, animationSpeed: 0 });
  assert.equal(modSetting(HEAT_HAZE_VENDOR, 'Enabled'), true);
  assert.equal(heatHazeOn(''), true);
  assert.equal(heatHazeOn('?haze=off'), false);
  setModSetting(HEAT_HAZE_VENDOR, 'Enabled', false);
  try { assert.equal(heatHazeOn(''), false); } finally { setModSetting(HEAT_HAZE_VENDOR, 'Enabled', true); }
});

test('HAZE1 the shader: every constant the DXBC carries, as the vendored listing reads them - the fade 25 to 70 (1/45), the two world axes, the 1.5 up, 0.0022 x 3.6 and 7.2, the drift, 1.15 and 0.85, the (0.3, 1) bend - and the cylinder 128 sides, +-70 (mutants: an axis; a scale; the drift; the bend\'s mix)', () => {
  const listing = read('vendor/heat-haze/shaders/HeatHaze.glsl');
  const floats = new Set([...listing.matchAll(/-?\d+\.\d+(?:e-?\d+)?/g)].map((m) => Math.fround(Number(m[0]))));
  const has = (v) => floats.has(Math.fround(v));
  for (const v of [0.02222222276031970977783203125, ...HAZE_AXES.a, ...HAZE_AXES.b, HAZE_AXES.up, HAZE_AXES.scale, HAZE_AXES.k1, HAZE_AXES.k2, ...HAZE_DRIFT, 1.15, 0.85, 0.3, 0.9999, 25.0]) {
    assert.ok(has(v) || has(-v), `${v} is a constant of the mod's shader`);
  }
  const fs = read('src/render/heatHaze.js');
  for (const t of ['(abs(vObjY) - 25.0) * 0.0222222228', 'if (0.9999 - s < 0.0) discard;', 'vec2(0.9239, 0.3827)', 'vec2(-0.4226, 0.9063)', 'vWorld.y * 1.5',
    'uNoiseScale * 0.0022', 'vec4(3.6, 3.6, 7.2, 7.2)', 'texture(uNoise, uv.xy).xy - 0.5', 'texture(uNoise, uv.zw).yx - 0.5', '(n1 * 1.15 + n2 * 0.85) * vec2(0.3, 1.0) * strength']) {
    assert.ok(fs.includes(t), `the translation reads ${t}`);
  }
  const { pos, idx } = hazeCylinder();
  assert.equal(pos.length, 128 * 2 * 3);
  assert.equal(idx.length, 768);
  assert.deepEqual([...pos.slice(0, 6)], [1, -70, 0, 1, 70, 0]);
  assert.deepEqual([...idx.slice(0, 6)], [0, 3, 1, 0, 2, 3], 'CreateCylinderMesh\'s winding');
  assert.deepEqual([...idx.slice(762)], [254, 1, 255, 254, 0, 1], 'the last side closes on the first');
});

test('HAZE1 the noise stands on the land: the phase the CPU adds for the origin\'s displacement makes a world point read the same noise whatever the scene\'s origin, and wraps (mutants: the anchor\'s sign; an axis\'s scale)', () => {
  // the shader's own read of a scene position, before the phase
  const uvOf = (p, k) => [
    (p[0] * HAZE_AXES.a[0] + p[2] * HAZE_AXES.a[1]) * k * HAZE_AXES.k1, p[1] * HAZE_AXES.up * k * HAZE_AXES.k1,
    (p[0] * HAZE_AXES.b[0] + p[2] * HAZE_AXES.b[1]) * k * HAZE_AXES.k2, p[1] * HAZE_AXES.up * k * HAZE_AXES.k2,
  ];
  const frac = (v) => v - Math.floor(v);
  const ns = 4.5, k = ns * HAZE_AXES.scale, t = 123.456;
  const world = [1234.5, 87.25, -456.75];
  const anchor = [819.2 * 3, 0, -819.2 * 2];   // the land three pixels east and two south of the scene's origin
  const scene = world.map((w, i) => w - anchor[i]);
  const a = uvOf(scene, k).map((u, i) => frac(u + hazePhase(anchor, t, ns)[i]));
  const b = uvOf(world, k).map((u, i) => frac(u + hazePhase([0, 0, 0], t, ns)[i]));
  for (let i = 0; i < 4; i++) near(Math.min(Math.abs(a[i] - b[i]), 1 - Math.abs(a[i] - b[i])), 0, 1e-9, `read ${i}`);
  for (const v of hazePhase([1e7, -3e6, 5e8], 1e6, ns)) assert.ok(v >= 0 && v < 1, 'wrapped');
});

test('HAZE1 the pass: the GrabPass is the world viewport copied out of what is bound, then the ring drawn with the depth test, the depth mask and CULL_FACE off and no blend, and the baseline put back; nothing drawn while the strength is nothing (mutants: the mask left off; the cull left off; the copy\'s rect)', () => {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return k;
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      return (...a) => { calls.push([k, ...a]); };
    },
  });
  const r = new HeatHazeRenderer(/** @type {any} */ (gl));
  calls.length = 0;
  const state = { visible: true, intensity: 1.5, center: [1, 2, 3], radius: 400.4, halfHeight: 503, noiseScale: 4.5, animationSpeed: 4 };
  assert.equal(r.draw({ ...state, visible: false }, new Float32Array(16), new Float32Array(16), [0, 0, 640, 360], 1), false);
  assert.deepEqual(calls, [], 'nothing at all while it is not visible');
  assert.equal(r.draw(state, new Float32Array(16), new Float32Array(16), [8, 4, 640, 360], 1), true);
  const names = calls.map((c) => c[0]);
  const at = (n) => names.indexOf(n);
  assert.deepEqual(calls.find((c) => c[0] === 'copyTexSubImage2D'), ['copyTexSubImage2D', 'TEXTURE_2D', 0, 0, 0, 8, 4, 640, 360], 'the world\'s viewport');
  assert.ok(at('copyTexSubImage2D') < at('drawElements'), 'grabbed before the ring is drawn');
  assert.deepEqual(calls.find((c) => c[0] === 'drawElements'), ['drawElements', 'TRIANGLES', 768, 'UNSIGNED_SHORT', 0]);
  const before = calls.slice(0, at('drawElements')), after = calls.slice(at('drawElements'));
  assert.ok(before.some((c) => c[0] === 'depthMask' && c[1] === false) && after.some((c) => c[0] === 'depthMask' && c[1] === true), 'ZWrite Off for the ring, and back');
  assert.ok(before.some((c) => c[0] === 'disable' && c[1] === 'CULL_FACE') && after.some((c) => c[0] === 'enable' && c[1] === 'CULL_FACE'), 'Cull Off for the ring, and back');
  assert.ok(before.some((c) => c[0] === 'disable' && c[1] === 'BLEND'), 'no blend: the grab is written back');
  assert.ok(!calls.some((c) => c[0] === 'disable' && c[1] === 'DEPTH_TEST'), 'the depth test is what keeps the near world out');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3f' && c[1] === 'uScale'), ['uniform3f', 'uScale', 400.4, 503 / 70, 400.4], 'the mesh scaled to the radius and the height');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uIntensity'), ['uniform1f', 'uIntensity', 1.5]);
  r.offsetOrigin([819.2, 0, 0]);
  assert.deepEqual(r.anchor, [-819.2, 0, 0], 'the land stays where it was: the anchor takes the shift back');
});

test('HAZE1 the hosts (THE FOUR HOSTS RULE): world.js and exterior.js build the ring on the enhanced lane and draw it once the opaque world is whole, before what falls; both stand it down indoors; world.js carries its noise across the floating origin. worldModes.js (interiors) and dungeonContext.js draw no exterior - nothing to haze (mutants: the draw after the rain; the indoor drop)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /const hazeGl = sky\.enhanced \? new HeatHazeRenderer\(renderer\.gl\) : null;/, `${host}: built on the enhanced lane`);
    assert.match(s, /heatHaze\.suppress\(\);/, `${host}: indoors, at once`);
    assert.match(s, /settings: heatHazeOn\(\) \? heatHazeSettings\(\) : HAZE_OFF \}\);/, `${host}: the switch read per frame`);
  }
  const w = read('src/scenes/world.js');
  assert.ok(w.indexOf('if (hz.visible && !tvf && hazeGl.draw(') < w.indexOf('    drawFalling();   // RAIN-OVER-GRASS'), 'world.js: before what falls');
  assert.ok(w.indexOf('labGrass.draw(proj, view') < w.indexOf('if (hz.visible && !tvf && hazeGl.draw('), 'world.js: after the grass');
  assert.match(w, /hazeGl\?\.offsetOrigin\(r\.offset\);/);
  const e = read('src/scenes/exterior.js');
  assert.ok(e.indexOf('if (hz.visible && hazeGl.draw(') < e.indexOf('const precipShown = enhancedFront ? fx.shown : precipMode;'), 'exterior.js: before what falls');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /HeatHaze/, `${host}: no exterior to haze`);
});
