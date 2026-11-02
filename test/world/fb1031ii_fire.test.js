// AUDIT FB1031 II G1 (FIELD FEEDBACK 2026-10-31, #feature-feedback: "Red Mountain doesn't always render, not sure if bug
// or just issue with how distant terrain works."). Red Mountain's lava (its lake and foyadas), its plume and the
// Ghostfence's curtain and halos are drawn only in the far ring's pass (render/redMountainFire.js, through the world's
// lens and the far lens), and the pass dropped them whole under every weather row that leaves the sky clear - the ash
// Red Mountain wears half its hours, a dusting, a sprinkle, Dynamic Skies' overcast, rain and snow - even at the crater's
// rim, where the land still showed; and the plume popped out at a front's switch to the weather. Now they are drawn
// under such a row, fogged by its own law and density from the world fog's point (render/horizonHaze.js horizonHazeOf),
// and keep what the land keeps at their distance. Clear air is as it was. bible/03-World/Red-Mountain.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { FarRingRenderer, summitFromOf } from '../../src/render/farRing.js';
import { LAVA_FS, PLUME_FS, FIRE, FIRE_COMMON_UNIFORMS, fireUniforms, fireLocations, setFireCommon } from '../../src/render/redMountainFire.js';
import { FENCE_CURTAIN_FS, FENCE_HALO_FS } from '../../src/render/ghostfenceGlow.js';
import { FOG_SETTINGS, fogFactor } from '../../src/world/weather.js';
import { fallTerms, blendFog } from '../../src/systems/weather/weatherFront.js';
import { fogSettingsFromPresets } from '../../src/systems/dynamicSkies/dynamicSkies.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const dsRows = () => {
  const dir = 'vendor/dynamic-skies/FogSettings/';
  return fogSettingsFromPresets(Object.fromEntries(readdirSync(new URL(`../../${dir}`, import.meta.url)).map((f) => [f.replace('.json', ''), rd(dir + f)])), 1);
};
const light = { sun: 0.65, dim: 0.8 };   // an overcast sky's sun and grass (redmountain_seen.test.js's)
const CLEAR = { mode: 'linear', start: 0, end: 4000, excludeSky: true };
/** Every row that leaves the sky clear, the land drawn through it. */
const WEATHER = () => {
  const ds = dsRows();
  return {
    'the whole ash': FOG_SETTINGS.ashfall,
    'an ash dusting': fallTerms({ sun: 0.4, dim: 0.6, fog: FOG_SETTINGS.ashfall }, 0, 'ashfall', light).fog,
    rain: FOG_SETTINGS.rainy,
    'a rain sprinkle': fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.rainy }, 0, 'rain', light).fog,
    snow: FOG_SETTINGS.snowy,
    "Dynamic Skies' overcast": ds.overcast,
    "Dynamic Skies' rain": ds.rainy,
    "Dynamic Skies' snow": ds.snowy,
    'a front past its switch': blendFog(CLEAR, FOG_SETTINGS.ashfall, 0.51),
  };
};
/** The land's share the row leaves at d metres (weather.js fogFactor: the world's own exp and exp2). */
const land = (row, d) => fogFactor(row, d);
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

/** A ring under the Proxy-GL stub (redmountain_seen.test.js's), the fire's and the fence's draws caught with their pass. */
function stubRing(renderer = null) {
  const seen = { fire: 0, fence: 0, pass: null };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name });
      if (k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const r = new FarRingRenderer(gl, { renderer });
  r.build({ heightBytes: new Uint8Array(1000 * 500).fill(30), mapWidth: 1000, mapHeight: 500, climateAt: () => 231, baseX: 207, baseY: 213, radius: 4 }, 207, 213, 2);
  r._coneNow = () => ({ at: { px: 207, py: 213, centre: [0, 0, 0], base: 0 } });
  r._fireNow = () => ({ draw: (pass) => { seen.fire++; seen.pass = pass; } });
  r._fenceNow = () => ({ draw: () => { seen.fence++; } });
  r._floraRadius = 5;
  return { r, seen };
}
const EYE = [0, 10, 0];
const frame = (fog) => ({
  origin: [0, 0, 0], lightDir: new Float32Array([0, 1, 0]), ambient: new Float32Array([0.4, 0.4, 0.4]), sunScale: 0.5,
  sunColor: new Float32Array([1, 1, 1]), fogColor: new Float32Array([0.5, 0.45, 0.4]), fog, fovY: 1, aspect: 1.6,
  eye: EYE, worldProj: new Float32Array(16).fill(1),
});

test('AUDIT FB1031 II G1: THE PASS - under every row that leaves the sky clear (the ash whole and dusting, rain and a sprinkle, snow, Dynamic Skies\' overcast, rain and snow, a front past its switch) the lava, the plume and the fence are drawn, handed the row\'s law and density, no summit in thinner air, the haze from the eye - and under the travel view from the traveller, as the world\'s fog is (TV1); clear air hands what it did; a fog over the sky draws none (mutants: the weather\'s gate back; the law unhanded; the summits through the weather; the haze from the eye in the weather; from the traveller in clear air)', () => {
  for (const [name, row] of Object.entries(WEATHER())) {
    const { r, seen } = stubRing();
    r.draw(new Float32Array(16), frame(row));
    assert.deepEqual([seen.fire, seen.fence], [1, 1], `${name}: the fire and the fence drawn (they were not)`);
    const { fog, summitFrom, hazeFrom, hold } = seen.pass;
    assert.deepEqual([fog.law, fog.density], [row.mode === 'exp2' ? 2 : 1, row.density], `${name}: the row's own law`);
    assert.ok(summitFrom > 1e8, `${name}: no summit in thinner air (NO_SUMMIT, the ring's)`);
    assert.equal(hazeFrom, EYE, `${name}: the haze from the eye on the ground`);
    assert.equal(hold, 0.85);
  }
  // the front either side of its switch: drawn both sides, so the plume never pops out with the mode
  for (const t of [0.49, 0.51]) {
    const { r, seen } = stubRing();
    r.draw(new Float32Array(16), frame(blendFog(CLEAR, FOG_SETTINGS.ashfall, t)));
    assert.equal(seen.fire, 1, `the front at ${t}`);
  }
  // clear air: the pass as it was - the linear ramp (law 0), the summits' air past the grid, the eye
  const sun = stubRing();
  sun.r.draw(new Float32Array(16), frame(CLEAR));
  assert.equal(sun.seen.fire, 1);
  assert.deepEqual({ ...sun.seen.pass.fog }, { color: frame(CLEAR).fogColor, start: 0, end: 4000, law: 0, density: 0 });
  assert.equal(sun.seen.pass.summitFrom, summitFromOf(5));
  assert.equal(sun.seen.pass.hazeFrom, EYE);
  // the travel view up: the weather is the traveller's (fogGlsl.js focusOrigin), the clear air's haze the eye's as before
  const focus = new Float32Array([500, 20, -300, 1]);
  for (const [row, want] of [[FOG_SETTINGS.ashfall, focus], [CLEAR, EYE]]) {
    const tv = stubRing({ focus });
    tv.r.draw(new Float32Array(16), frame(row));
    assert.equal(tv.seen.pass.hazeFrom, want, `the travel view, ${row.mode}`);
  }
  const down = stubRing({ focus: new Float32Array([500, 20, -300, 0]) });
  down.r.draw(new Float32Array(16), frame(FOG_SETTINGS.ashfall));
  assert.equal(down.seen.pass.hazeFrom, EYE, 'the view going down (w 0): the eye');
  // a fog over the sky stands no land, and no fire or fence on it (RED-MOUNTAIN-SEEN)
  for (const row of [FOG_SETTINGS.heavy, FOG_SETTINGS.sandstorm]) {
    const { r, seen } = stubRing();
    r.draw(new Float32Array(16), frame(row));
    assert.deepEqual([seen.fire, seen.fence], [0, 0]);
  }
});

test('AUDIT FB1031 II G1: THE UNIFORMS - setFireCommon hands the pass\'s law and density (uFogLaw, 0 without) and the haze\'s point (uHazeFrom, the eye without), the same in both lenses; every fire and fence program locates them (mutants: the law unset; uFogLaw unlisted; the point unset; the point ignored)', () => {
  const calls = [];
  const gl = new Proxy({}, { get: (t, k) => (typeof k !== 'string' ? undefined : (...a) => { calls.push([k, ...a]); return k === 'getUniformLocation' ? { name: a[1] } : {}; }) });
  const U = fireLocations(gl, {}, FIRE_COMMON_UNIFORMS);
  const pass = { eye: [1, 2, 3], fog: { color: [0.5, 0.5, 0.5], start: 0, end: 0, law: 2, density: 0.00075 }, rim: [18000, 30000], hold: 0.85, ringOrigin: [0, 0, 0], summitFrom: 1e9, worldFar: 4000, depth: null, hazeFrom: [7, 8, 9, 1] };
  const of = (p, isFar) => { calls.length = 0; setFireCommon(gl, U, p, isFar, new Float32Array(16), null); return Object.fromEntries(calls.filter((c) => c[1]?.name).map((c) => [c[1].name, c.slice(2)])); };
  for (const isFar of [true, false]) {
    const u = of(pass, isFar);
    assert.deepEqual(u.uFogLaw, [2, 0.00075], 'the row\'s law');
    assert.deepEqual(u.uHazeFrom, [7, 8, 9], 'the haze\'s point');
  }
  const bare = of({ ...pass, fog: { color: [0, 0, 0], start: 0, end: 3000 }, hazeFrom: undefined }, false);
  assert.deepEqual(bare.uFogLaw, [0, 0], 'no law: the linear ramp');
  assert.deepEqual(bare.uHazeFrom, [1, 2, 3], 'no point: the eye');
  assert.ok(FIRE_COMMON_UNIFORMS.includes('uFogLaw') && FIRE_COMMON_UNIFORMS.includes('uHazeFrom'));
  for (const fs of [LAVA_FS, PLUME_FS, FENCE_CURTAIN_FS, FENCE_HALO_FS]) assert.match(fs, /uniform vec2 uFogLaw;[^\n]*\nuniform vec3 uHazeFrom;/);
});

// ── THE SHADERS ON THEIR OWN TEXT (test/glsl.mjs) ─────────────────

const AT = [0, 4000, 0];   // the fragment; the eye moved out along x
const lawOf = (row) => [row.mode === 'exp2' ? 2 : 1, row.density];
const RAMP = { uHaze: [0, 0, 24000, 39000], uHold: [1, 0, 1e9] };   // _weatherAir's ramp handed (closed), its rim, no summit
const lavaFs = () => glslFunctions(LAVA_FS, { ...fireUniforms(), ...RAMP, uTime: 0.2, vWorld: AT, vInfo: [0, 0, 0, 0], vLocal: [10, 20] });
const plumeFs = () => glslFunctions(PLUME_FS, { ...fireUniforms(), ...RAMP, uTime: 0, uLight: 0.3, uLightDir: [0, 1, 0], uFoot: [0, 0, 0], vUV: [0.3, 0.4], vWorld: AT, vNormal: [1, 0, 0], uFace: 1 });
const curtainFs = () => glslFunctions(FENCE_CURTAIN_FS, { ...fireUniforms(), ...RAMP, uTime: 0.1, uLight: 0, vSide: [3, 0.4], vWorld: AT });
const haloFs = () => glslFunctions(FENCE_HALO_FS, { ...fireUniforms(), ...RAMP, uLight: 0, vCorner: [0.2, 0.1], vShare: 1, vWorld: AT });
/** o, its fragment seen from `d` metres out (the eye, and the haze's point at `from` metres out, x), under `law`. */
const shade = (fs, law, d, { from = d, fog = [0, 0, 0] } = {}) => {
  Object.assign(fs.globals, { uFogLaw: law, uEye: [d, AT[1], 0], uHazeFrom: [from, AT[1], 0], uFogColor: fog });
  fs.main();
  return Array.from(fs.globals.o).map(Number);
};

test('AUDIT FB1031 II G1: THE FIRE AND THE FENCE KEEP WHAT THE LAND KEEPS - under each row the lava\'s colour, the plume\'s ash and the curtain\'s and halos\' light keep the land\'s share at their distance (1 - the world\'s exp or exp2 factor: near the rim nearly whole in a sprinkle or an overcast, by 30 km nothing), measured from the haze\'s point; the plume\'s ash fogs whole, its fire with it, and in the whole ash 30 km out nothing of it is drawn (mutants: the linear haze in the weather; the lava\'s cap in the weather; the plume\'s floor; its colour\'s 0.7; its fire\'s 0.5; the eye\'s distance for the point\'s)', () => {
  const [lava, plume, curtain, halo] = [lavaFs(), plumeFs(), curtainFs(), haloFs()];
  for (const [name, row] of Object.entries(WEATHER())) {
    const law = lawOf(row), none = [law[0], 0];
    for (const d of [100, 300, 1000, 3000, 30000]) {
      const T = land(row, d);
      // the lava: its mix toward the fog the land's (white fog less black is the mix itself)
      const m = shade(lava, law, d, { fog: [1, 1, 1] })[0] - shade(lava, law, d)[0];
      assert.ok(near(1 - m, T), `${name}, the lava at ${d} m: keeps ${(1 - m).toFixed(4)}, the land ${T.toFixed(4)}`);
      // the plume: its ash's share of itself, and its colour's mix toward the fog the land's
      const a = shade(plume, law, d)[3], a0 = shade(plume, none, d)[3];
      assert.ok(a0 > 0.05 && near(a / a0, T), `${name}, the plume at ${d} m: ${(a / a0).toFixed(4)} of its ash, the land ${T.toFixed(4)}`);
      if (T > 0.01 && T < 0.99) {
        const mix = (shade(plume, law, d, { fog: [1, 1, 1] })[0] - shade(plume, law, d)[0]) / a;
        assert.ok(near(mix, 1 - T, 1e-6), `${name}, the plume's colour at ${d} m: ${mix.toFixed(4)} toward the fog`);
      }
      // the fence: its light the land's share (its own fades by 12 and 45 km apart)
      if (d <= 3000) {
        for (const [part, fs] of [['curtain', curtain], ['halo', halo]]) {
          const g = shade(fs, law, d)[1], g0 = shade(fs, none, d)[1];
          assert.ok(g0 > 0.01 && near(g / g0, T), `${name}, the ${part} at ${d} m: ${(g / g0).toFixed(4)} of its light, the land ${T.toFixed(4)}`);
        }
      }
    }
  }
  // the whole ash 30 km out: the lava wholly the fog, the plume nothing - its ash and its fire
  const ash = lawOf(FOG_SETTINGS.ashfall);
  assert.deepEqual(shade(lava, ash, 30000, { fog: [0.5, 0.5, 0.5] }).map((v) => v.toFixed(6)), ['0.500000', '0.500000', '0.500000', '1.000000']);
  assert.ok(shade(plume, ash, 30000).every((v) => Math.abs(v) < 1e-12), 'the plume: none of it');
  // the share is the haze's point's: the eye 300 m out, the traveller 3 km
  const sprinkle = WEATHER()['a rain sprinkle'];
  const m = shade(lava, lawOf(sprinkle), 300, { from: 3000, fog: [1, 1, 1] })[0] - shade(lava, lawOf(sprinkle), 300, { from: 3000 })[0];
  assert.ok(near(1 - m, land(sprinkle, 3000)), `from the traveller: ${(1 - m).toFixed(4)}`);
  for (const [part, fs] of [['curtain', curtain], ['halo', halo]]) {
    const g = shade(fs, lawOf(sprinkle), 300, { from: 3000 })[1] / shade(fs, [1, 0], 300, { from: 3000 })[1];
    assert.ok(near(g, land(sprinkle, 3000)), `the fence's ${part} from the traveller too`);
  }
});

test('AUDIT FB1031 II G1: CLEAR AIR AS IT WAS - under the linear ramp the lava takes at most FIRE.hazeHold of the haze (less where it melts) and the plume keeps FIRE.hazeFloor of its ash through the hold, 0.7 of the haze in its colour (mutants: the weather\'s whole in clear air)', () => {
  const [lava, plume] = [lavaFs(), plumeFs()];
  const clear = { uHaze: [0, 4000, 24000, 39000], uHold: [0.85, 0, 1e9] };
  Object.assign(lava.globals, clear); Object.assign(plume.globals, clear);
  for (const d of [2000, 10000, 20000]) {
    const hz = Number(lava.hazeAt(d, AT[1]));
    const m = shade(lava, [0, 0], d, { fog: [1, 1, 1] })[0] - shade(lava, [0, 0], d)[0];
    assert.ok(hz > 0.4 && m <= FIRE.hazeHold * hz + 1e-12 && m >= FIRE.hazeHold * 0.4 * hz - 1e-12, `the lava at ${d} m: ${m.toFixed(4)} of the fog under a haze of ${hz.toFixed(3)}`);
  }
  // at 10 km the haze is the hold (0.85): the plume keeps its floor, 0.5, of its ash
  plume.globals.uHaze = [0, 4000, 1e9, 2e9];
  const a = shade(plume, [0, 0], 10000)[3];
  plume.globals.uHold = [0, 0, 1e9];   // no haze at all
  const a0 = shade(plume, [0, 0], 10000)[3];
  assert.ok(near(a / a0, FIRE.hazeFloor), `the plume through the hold: ${(a / a0).toFixed(4)} of its ash`);
  plume.globals.uHold = [0.85, 0, 1e9];
  const mix = (shade(plume, [0, 0], 10000, { fog: [1, 1, 1] })[0] - shade(plume, [0, 0], 10000)[0]) / a;
  assert.ok(near(mix, 0.85 * 0.7, 1e-6), `its colour ${mix.toFixed(4)} toward the fog`);
});
