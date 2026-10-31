// AUDIT FB1031 LIGHT (FIELD FEEDBACK 2026-10-31, Discord #feature-feedback). A player: "It gets way to bright at night
// for me. I still want to see outside but not be blasted by the light so it destroys the dark and light in the room
// during day and night." Another: "Red Mountain doesn't always render, not sure if bug or just issue with how distant
// terrain works." L1: the panes' glow eases from the day's gain to the night's as the sun sets and rises, and Day only
// fades by the same share (render/windowLight.js wlDayShare). L2: under a weather row the far views fog by the row's own
// law (render/horizonHaze.js horizonHazeOf). L4: the fog's colour eases to DFU's grey across the rain-to-snow band
// (scenes/shared.js outdoorFogColor). bible/07-Rendering/Real-Windows.md and bible/03-World/Red-Mountain.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions } from '../glsl.mjs';
import {
  WindowLightPass, windowAperturesOf, wlDayShare, wlGlowGain, WL_DUSK_RISE, WL_SUN_GAIN, WL_SKY_GAIN, WL_SKY_NIGHT_GAIN,
} from '../../src/render/windowLight.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { windowEmissionRGB } from '../../src/render/windowEmission.js';
import { skyState, moonlightTerm, lightStreetAt } from '../../src/render/enhancedSky.js';
import { elDecode3 } from '../../src/render/enhancedLighting.js';
import { viewOutLight, sunDirection, SUN_RIG_COLOR } from '../../src/world/worldClock.js';
import { INTERIOR_AMBIENT } from '../../src/world/interior/interiorLights.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';
import { perspective, lookAt, identity } from '../../src/world/mat4.js';
import { HORIZON_HAZE_GLSL } from '../../src/render/horizonHaze.js';
import { FarRingRenderer, ringFogOf } from '../../src/render/farRing.js';
import { FarTreesBand } from '../../src/render/farTrees.js';
import { FOG_SETTINGS, fogForWeather, fogFactor } from '../../src/world/weather.js';
import { fallTerms, wander } from '../../src/systems/weather/weatherFront.js';
import { airLight, airColor, litFog } from '../../src/systems/weather/nightFog.js';
import { outdoorFogColor, GRAY_FOG_COLOR, GRAY_FOG_FULL_DENSITY, RAINY_FOG_DENSITY } from '../../src/scenes/shared.js';
import { LAND_VIEW_TIERS } from '../../src/world/landView.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** A recording GL (windownight.test.js's): programs link, a uniform block has index 0, every other call a no-op. */
function recordingGl() {
  let id = 0;
  return new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getUniformBlockIndex' || k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (k === 'TEXTURE0') return 33984;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return () => {};
    },
  });
}
const newRenderer = () => new Renderer({ getContext: () => recordingGl(), clientWidth: 640, clientHeight: 400, width: 640, height: 400 });

/** One 1 m x 1.2 m pane on the east wall (x 3, its glass facing into the room, -x: the morning sun's) or the west (-x 3). */
function pane(pass, wall, now = 1000) {
  const x = wall === 'east' ? 3 : -3, nx = wall === 'east' ? -1 : 1;
  pass.addMask('4002_0', { width: 16, height: 16, colors: new Uint8ClampedArray(16 * 16 * 4).fill(255) });
  const P = new Float32Array([x, 1, -0.5, x, 1, 0.5, x, 2.2, 0.5, x, 2.2, -0.5]);
  const N = new Float32Array([nx, 0, 0, nx, 0, 0, nx, 0, 0, nx, 0, 0]);
  const set = windowAperturesOf(P, N, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), new Uint32Array([0, 1, 2, 0, 2, 3]), 0, 6);
  pass.note({ wl: [{ key: '4002_0', ap: set.recs, cells: set.cells }] }, identity(), null, 'inside', now);
  return { proj: perspective(1.1, 1.6, 0.1, 500), view: lookAt([0, 1.6, 0], [x, 1.6, 0], [0, 1, 0]) };
}

/** The outside a building's glass reads at minute `m`: the host's view-out terms (world.js outsideView's setup -
 *  viewOutLight, the moon of the hour through lightStreetAt, sunDirection), through the renderer's own capture. */
const outsideAt = (m) => ({
  setup: (rr) => { lightStreetAt(rr, viewOutLight(m, 1, 1, 1), moonlightTerm(skyState({ minuteOfDay: m, phases: { masser: 4, secunda: 4 } })), SUN_RIG_COLOR); return sunDirection(m); },
  draw: () => {},
});

/** The pass's light for a pane at each minute of `[from, to]`, as a share of the room's day ambient: the glow at the
 *  glass and the whole (the beam where it lands square, and the glow). */
function lightOverMinutes({ wall, decode, dayOnly, from, to }) {
  const r = newRenderer();
  r.setWindowEmission(windowEmissionRGB('disabled'));
  const pass = new WindowLightPass(recordingGl(), { activeTexture: () => {} });
  const { proj, view } = pane(pass, wall);
  const amb = lum(decode ? decode(INTERIOR_AMBIENT) : INTERIOR_AMBIENT);
  const rows = [];
  let at = 1e6;
  for (let m = from; m <= to; m++) {
    r._wl.outside = null;
    r.captureOutsideLight(outsideAt(m), at += 1000, 'full');
    pass.setOutside(r._wl.outside);
    const n = pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view, proj, now: 1100, shadows: false, glass: () => 'glass', decode, dayOnly });
    const d = pass.data;
    rows.push({ m, glow: n ? lum([d[24], d[25], d[26]]) / amb : 0, all: n ? lum([d[20] + d[24], d[21] + d[25], d[22] + d[26]]) / amb : 0 });
  }
  return rows;
}
const worstStep = (rows, k) => rows.slice(1).reduce((w, row, i) => { const s = Math.abs(row[k] - rows[i][k]); return s > w.s ? { s, m: row.m } : w; }, { s: 0, m: rows[0].m });
const LANES = [['classic', null, 0.06], ['Enhanced', (c) => elDecode3(c, [0, 0, 0]), 0.12]];

test('AUDIT FB1031 L1: THE DAY\'S SHARE - the glass\'s day eases in over the sun\'s first WL_DUSK_RISE of height on a smoothstep, none with the sun down (the clock\'s night sun stands at sin(pi), 1e-16 over the horizon) or no outside read; the glow\'s gain runs from the night\'s to the day\'s by it (mutants: the rise, the floor, the curve, the gain\'s ends)', () => {
  assert.equal(WL_DUSK_RISE, 0.15);
  const at = (y) => wlDayShare({ sunDir: [0, y, 0] });
  assert.deepEqual([at(0), at(sunDirection(18 * 60 + 30)[1]), at(-0.5), wlDayShare(null)], [0, 0, 0, 0], 'down, on the horizon, under it, unread');
  assert.ok(sunDirection(18 * 60 + 30)[1] > 0, 'the clock\'s night sun is not quite under the horizon');
  assert.ok(near(at(0.0375), 0.15625), `a quarter of the rise: ${at(0.0375)} (a smoothstep, not a line)`);
  assert.ok(near(at(0.075), 0.5) && near(at(0.15), 1) && near(at(0.6), 1), 'half way at half the rise, whole from it');
  assert.ok(at(0.001) > 0 && at(0.001) < 1e-3, 'a sun a hair over the horizon has a hair of the day');
  assert.deepEqual([wlGlowGain(0), wlGlowGain(1)], [WL_SKY_NIGHT_GAIN, WL_SKY_GAIN]);
  assert.ok(near(wlGlowGain(0.5), (WL_SKY_NIGHT_GAIN + WL_SKY_GAIN) / 2));
});

test('AUDIT FB1031 L1: NO STEP AT SUNSET OR SUNRISE - through the renderer\'s capture of the host\'s view-out terms, a pane\'s glow minute by minute from 17:20 to 18:10 and from 05:50 to 06:40 never steps by more than a small share of the room\'s ambient on either lane (it stepped 0.59 and 0.84 of it at 17:49, eleven minutes before the room\'s own night at 18:00); the night\'s gain from 18:00 and the day\'s by 06:35 (mutants: the ramp gone, the rise narrowed, the gain\'s ends)', () => {
  for (const [lane, decode, bound] of LANES) {
    for (const wall of ['east', 'west']) {
      for (const [from, to] of [[17 * 60 + 20, 18 * 60 + 10], [5 * 60 + 50, 6 * 60 + 40]]) {
        const rows = lightOverMinutes({ wall, decode, dayOnly: false, from, to });
        const w = worstStep(rows, 'glow');
        assert.ok(w.s <= bound, `${lane}, the ${wall} pane: the glow steps ${w.s.toFixed(3)} of the room's ambient at ${hm(w.m)} (bound ${bound})`);
      }
    }
  }
  // the ends are the gains WINDOW-NIGHT set: the night's from 18:00, the day's once the sun is WL_DUSK_RISE up
  const r = newRenderer();
  const pass = new WindowLightPass(recordingGl(), { activeTexture: () => {} });
  const { proj, view } = pane(pass, 'east');
  let at = 1e6;
  for (const [m, gain] of [[18 * 60, WL_SKY_NIGHT_GAIN], [18 * 60 + 30, WL_SKY_NIGHT_GAIN], [6 * 60 + 35, WL_SKY_GAIN], [12 * 60, WL_SKY_GAIN]]) {
    r._wl.outside = null;
    r.captureOutsideLight(outsideAt(m), at += 1000, 'full');
    pass.setOutside(r._wl.outside);
    assert.equal(pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view, proj, now: 1100, shadows: false, glass: () => 'glass' }) > 0, true);
    assert.ok(near(pass.data[24], r._wl.outside.sky[0] * gain, 1e-6), `${hm(m)}: the glow at ${gain} of the sky's light`);
  }
});

test('AUDIT FB1031 L1: DAY ONLY FADES, NEVER CUTS - the whole light of a pane the sun does not face (the east at sunset, the west at sunrise) minute by minute about 17:48-18:00 and 06:00-06:12 never steps past the bound (it went out whole at 17:49 and came on whole at 06:12), none from 18:00; a pane the sun faces takes the sun at its share, and no moon stands under Day only (mutants: the fade gone from the glow, from the key; the moon kept)', () => {
  for (const [lane, decode, bound] of LANES) {
    for (const [wall, from, to] of [['east', 17 * 60 + 40, 18 * 60 + 5], ['west', 5 * 60 + 55, 6 * 60 + 20]]) {
      const rows = lightOverMinutes({ wall, decode, dayOnly: true, from, to });
      const w = worstStep(rows, 'all');
      assert.ok(w.s <= bound, `${lane}, Day only, the ${wall} pane: its light steps ${w.s.toFixed(3)} of the room's ambient at ${hm(w.m)} (bound ${bound})`);
      const dark = rows.filter((row) => row.m >= 18 * 60 || row.m <= 6 * 60);
      assert.ok(dark.length > 0 && dark.every((row) => row.all === 0), `${lane}, Day only: no light with the sun down`);
    }
  }
  const pass = new WindowLightPass(recordingGl(), { activeTexture: () => {} });
  const { proj, view } = pane(pass, 'east');
  const frame = (dayOnly) => pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view, proj, now: 1100, shadows: false, glass: () => 'glass', dayOnly });
  const sky = [0.3, 0.3, 0.32];
  // the sun half way up its rise, facing the pane: Day only takes its beam and its glow at the share, On whole
  pass.setOutside({ at: 1000, sunDir: [0.9, 0.075, 0], sunColor: [1, 1, 1], sunScale: 0.4, moonDir: [0, -1, 0], moonColor: [1, 1, 1], moonScale: 0, sky });
  assert.equal(frame(false), 1);
  assert.ok(near(pass.data[20], 0.4 * WL_SUN_GAIN, 1e-6) && near(pass.data[24], sky[0] * wlGlowGain(0.5), 1e-6), 'On: the sun whole, the glow at the share\'s gain');
  assert.equal(frame(true), 1);
  assert.ok(near(pass.data[20], 0.4 * WL_SUN_GAIN * 0.5, 1e-6) && near(pass.data[24], sky[0] * wlGlowGain(0.5) * 0.5, 1e-6), 'Day only: both at the day\'s share');
  // the sun on the horizon with a moon up facing the glass: On lights by the moon, Day only by the sky's glow alone
  pass.setOutside({ at: 1000, sunDir: [-0.99, 0.03, 0], sunColor: [1, 1, 1], sunScale: 0, moonDir: [0.7, 0.7, 0], moonColor: [0.5, 0.6, 0.8], moonScale: 0.4, sky });
  assert.equal(frame(false), 1);
  assert.ok(pass.data[20] > 0.05, 'On: the moon\'s beam');
  assert.equal(frame(true), 1);
  assert.deepEqual([pass.data[20], pass.data[21], pass.data[22]], [0, 0, 0], 'Day only: no moon');
  assert.ok(pass.data[24] > 0, 'Day only: the glow at the dusk\'s share');
});

test('AUDIT FB1031 L1: THE RENDERER - under Day only a building\'s frame lights while the day has a share (17:55, the sun under wlSunUp\'s 0.05) and not at 18:30 (sin(pi)), and hands the pass the part, which fades the light by the share (mutants: the share\'s test, the part unhanded)', () => {
  const was = getPref('windowLight');
  const r = newRenderer();
  r.setLighting(new Float32Array([0.2, 0.18, 0.2]), 0, new Float32Array([1, 1, 1]));
  r.setWindowEmission(windowEmissionRGB('disabled'));
  r._cutoutKeys.add('4002_0');   // the picture's glass a building's
  const { proj, view } = pane(r._wl, 'east', performance.now());
  let at = 1e7;
  const frameAt = (m) => {
    r.captureOutsideLight(outsideAt(m), at += 1000, 'full');
    r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME);
    return { kind: r._wlKind, glow: r._wl.data[24], sky: r._wl.outside.sky[0], share: wlDayShare(r._wl.outside) };
  };
  try {
    setPref('windowLight', 'day');
    const dusk = frameAt(17 * 60 + 55);
    assert.ok(dusk.share > 0 && dusk.share < 0.1, `the dusk's share ${dusk.share}`);
    assert.equal(dusk.kind, 'inside', 'Day only: the dusk still lights');
    assert.ok(near(dusk.glow, dusk.sky * wlGlowGain(dusk.share) * dusk.share, 1e-6), `Day only: the glow at the share - ${dusk.glow} of the sky's ${dusk.sky}`);
    assert.equal(frameAt(18 * 60 + 30).kind, null, 'Day only: none by night');
    setPref('windowLight', 'on');
    const on = frameAt(17 * 60 + 55);
    assert.ok(near(on.glow, on.sky * wlGlowGain(on.share), 1e-6), 'On: the glow unfaded');
  } finally { setPref('windowLight', was); }
});

/** The horizon's law on the shader's own text (test/glsl.mjs). */
const haze = glslFunctions(HORIZON_HAZE_GLSL);
const light = { sun: 0.65, dim: 0.8 };   // an overcast sky's sun and grass (redmountain_seen.test.js's)
const WEATHER_ROWS = () => ({
  rain: FOG_SETTINGS.rainy,
  'rain sprinkle': fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.rainy }, 0, 'rain', light).fog,
  snow: FOG_SETTINGS.snowy,
  'snow dusting': fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.snowy }, 0, 'snow', light).fog,
  ashfall: FOG_SETTINGS.ashfall,
  'ash dusting': fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.ashfall }, 0, 'ashfall', light).fog,
  'an exp2 overcast': { mode: 'exp2', density: 0.0008, start: 0, end: 0, excludeSky: true },
});

test('AUDIT FB1031 L2: THE FAR VIEWS FOG BY THE WEATHER\'S OWN LAW - ringFogOf hands a weather row\'s law and density; the haze the ring, the middle ring, the far field and the band\'s trees mix is 1 - the world\'s own factor at their distance, so at the streamed grid\'s edge the far land shows what the streamed ground shows at every Land View (it stood wholly fog: a sprinkle at Land View 1 left the ground 54% there, the seam), and past it closes to the fog (mutants: the law, exp2 read as exp, the density, the linear arm taken)', () => {
  for (const [name, row] of Object.entries(WEATHER_ROWS())) {
    const rf = ringFogOf(row);
    assert.deepEqual([rf.weather, rf.law, rf.density], [true, row.mode === 'exp2' ? 2 : 1, row.density], `${name}: its law`);
    for (const [lv] of LAND_VIEW_TIERS) {
      const edge = lv * TERRAIN_SIZE;
      const shown = 1 - haze.horizonHazeOf([rf.law, rf.density], edge, rf.start, rf.end, 18000, 30000, rf.hold);
      assert.ok(near(shown, fogFactor(row, edge), 1e-9), `${name}, Land View ${lv}: the far land shows ${shown.toFixed(4)} at the grid's edge, the ground ${fogFactor(row, edge).toFixed(4)}`);
    }
    assert.ok(haze.horizonHazeOf([rf.law, rf.density], 30000, 0, 0, 18000, 30000, 1) > 0.9999, `${name}: wholly fog 30 km out`);
  }
  // the linear rows keep the draw distance's haze, the hold and the rim (FAR-SEA1's law), untouched
  const sunny = ringFogOf({ mode: 'linear', start: 0, end: 4000 });
  assert.equal(sunny.law, 0);
  for (const d of [1000, 3000, 6000, 25000]) assert.equal(haze.horizonHazeOf([0, 0], d, 0, 4000, 18000, 30000, 0.85), haze.horizonHaze(d, 0, 4000, 18000, 30000, 0.85));
  assert.equal(ringFogOf(FOG_SETTINGS.heavy), null, 'a fog over the sky stands none, as RED-MOUNTAIN-SEEN has it');
});

test('AUDIT FB1031 L2: THE DRAW HANDS THE LAW - the ring\'s program (the middle ring and the far field draw by it) takes the row\'s law and density, and the band\'s trees take them too; a linear row hands none (mutants: the ring\'s uniform, the band\'s, the trees\' own)', () => {
  const seen = { u2f: {}, band: null };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name });
      if (k === 'uniform2f') return (loc, x, y) => { seen.u2f[loc?.name] = [x, y]; };
      if (k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader') return () => ({});
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const ring = new FarRingRenderer(gl);
  ring.build({ heightBytes: new Uint8Array(1000 * 500).fill(30), mapWidth: 1000, mapHeight: 500, climateAt: () => 231, baseX: 207, baseY: 213, radius: 4 }, 207, 213, 2);
  ring._fenceNow = () => null;
  ring._coneNow = () => null;
  ring._band = { count: 1, drawn: { baseX: 207, baseY: 213 }, draw: (s) => { seen.band = s; }, dispose: () => {} };
  ring._floraRadius = 5;
  ring._floraOf = () => () => null;
  ring._bandGround = () => null;
  const frame = (fog) => ({ origin: [0, 0, 0], lightDir: new Float32Array([0, 1, 0]), ambient: new Float32Array([0.4, 0.4, 0.4]), sunScale: 0.5,
    sunColor: new Float32Array([1, 1, 1]), fogColor: new Float32Array([0.5, 0.45, 0.4]), fog, fovY: 1, aspect: 1.6, eye: [0, 10, 0], worldProj: new Float32Array(16).fill(1) });
  const sprinkle = WEATHER_ROWS()['rain sprinkle'];
  ring.draw(new Float32Array(16), frame(sprinkle));
  assert.deepEqual(seen.u2f.uFogLaw, [1, sprinkle.density], 'the ring: exp at the sprinkle\'s density');
  assert.deepEqual([seen.band.law, seen.band.density], [1, sprinkle.density], 'the band');
  ring.draw(new Float32Array(16), frame({ mode: 'exp2', density: 0.0008, start: 0, end: 0, excludeSky: true }));
  assert.deepEqual(seen.u2f.uFogLaw, [2, 0.0008], 'exp2');
  ring.draw(new Float32Array(16), frame({ mode: 'linear', start: 0, end: 4000, excludeSky: true }));
  assert.deepEqual(seen.u2f.uFogLaw, [0, 0], 'a linear row: the haze\'s ramp');
  // the trees' own program takes what the band is handed
  const tgl = new Proxy({ TEXTURE0: 33984, drawingBufferHeight: 400 }, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => name;
      if (k === 'uniform2f') return (loc, x, y) => { seen.u2f[`trees ${loc}`] = [x, y]; };
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      return () => {};
    },
  });
  const band = new FarTreesBand(tgl, { source: { floraBand: () => Promise.resolve(null) }, read: () => ({}) });
  band.drawn = { count: 1, vao: {} };
  band.tex = {};
  band.draw({ ...seen.band, proj: new Float32Array(16), view: new Float32Array(16), origin: [0, 0, 0], radius: 5, viewportH: 400, hazeFrom: new Float32Array(4),
    haze: new Float32Array(8), hazeEye: [0, 1, 0], cloudFar: 1, cloudRect: new Float32Array(4), cloudUnit: 15, exposure: 1, law: 1, density: sprinkle.density, ground: null });
  assert.deepEqual(seen.u2f['trees uFogLaw'], [1, sprinkle.density], 'the band\'s trees: the row\'s law');
});

const b8 = (c) => Array.from(c, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255));

test('AUDIT FB1031 L4: THE GREY EASES IN - each of DFU\'s rows keeps SetSkyFogColor\'s colour (the rain the sky\'s, itself; the snow, the heavy fog, the ash Color.gray, itself), and between the rain\'s density and the snow\'s the colour eases on a smoothstep, so a thinning snow or a breathing ash never flips it (it flipped whole at 0.003) (mutants: the threshold back, the band\'s top, the curve)', () => {
  assert.equal(GRAY_FOG_FULL_DENSITY, FOG_SETTINGS.snowy.density);
  assert.deepEqual([RAINY_FOG_DENSITY, GRAY_FOG_FULL_DENSITY], [0.003, 0.005]);
  const sky = new Float32Array([0.2, 0.21, 0.25]);
  assert.equal(outdoorFogColor(FOG_SETTINGS.rainy, sky), sky);
  for (const row of [FOG_SETTINGS.snowy, FOG_SETTINGS.heavy, FOG_SETTINGS.ashfall, FOG_SETTINGS.sandstorm]) assert.equal(outdoorFogColor(row, sky), GRAY_FOG_COLOR);
  const at = (density) => Array.from(outdoorFogColor({ mode: 'exp', density }, sky));
  const k = 0.15625;   // a quarter of the band on a smoothstep
  at(0.0035).forEach((v, c) => assert.ok(near(v, sky[c] + (0.5 - sky[c]) * k, 1e-6), `a quarter in: channel ${c} ${v}`));
  let worst = 0;
  for (let d = 0.00075; d <= 0.0065; d += 0.00001) worst = Math.max(worst, ...at(d + 0.00001).map((v, c) => Math.abs(v - at(d)[c])));
  assert.ok(worst < 0.005, `the colour moves at most ${worst.toFixed(4)} for a hundred-thousandth of density`);
  assert.equal(outdoorFogColor({ mode: 'exp2', density: 0.004 }, sky), sky, 'an exp2 row (Dynamic Skies\') is not SetSkyFogColor\'s Exponential');
});

test('AUDIT FB1031 L4: THE PRODUCER - a snow and an ash thickening from a dusting to their whole row (RAIN-SPRINKLE\'s fallTerms), lit as the frame lights its fog (NIGHT-FOG\'s litFog), at noon and at 23:00 under the dome, never step by more than 8 levels in 255 for a hundredth of intensity (it stepped 75); an ash breathing about its peak at 23:00 drifts, never flips (it flipped six times in ten minutes, 53 to 128)', () => {
  for (const [weather, row] of [['snow', FOG_SETTINGS.snowy], ['ashfall', FOG_SETTINGS.ashfall]]) {
    for (const m of [720, 1380]) {
      const s = skyState({ minuteOfDay: m, weather, phases: { masser: 4, secunda: 4 } });
      const air = airColor(airLight({ minute: m, nightScale: 1, sun: 0.45, moon: moonlightTerm(s) }));
      const colour = (i) => b8(litFog(outdoorFogColor(fallTerms({ sun: 0.45, dim: 0.6, fog: row }, i, weather, light).fog, s.clearColor), air));
      let worst = 0, prev = colour(0);
      for (let i = 1; i <= 100; i++) { const c = colour(i / 100); worst = Math.max(worst, ...c.map((v, j) => Math.abs(v - prev[j]))); prev = c; }
      assert.ok(worst <= 8, `${weather} at ${hm(m)}: the fog steps ${worst} levels for a hundredth of intensity`);
      assert.deepEqual(colour(1), [128, 128, 128], `${weather} at ${hm(m)}: the whole row DFU's grey`);
    }
  }
  const s = skyState({ minuteOfDay: 1380, weather: 'ashfall', phases: { masser: 4, secunda: 4 } });
  const air = airColor(airLight({ minute: 1380, nightScale: 1, sun: 0.45, moon: moonlightTerm(s) }));
  let worst = 0, prev = null;
  for (let t = 0; t <= 600; t += 5) {
    const f = fallTerms({ sun: 0.45, dim: 0.6, fog: FOG_SETTINGS.ashfall }, 0.35 * wander(t, 0), 'ashfall', light).fog;
    const c = b8(litFog(outdoorFogColor(f, s.clearColor), air));
    if (prev) worst = Math.max(worst, ...c.map((v, j) => Math.abs(v - prev[j])));
    prev = c;
  }
  assert.ok(worst <= 12, `an ash breathing at 23:00: at most ${worst} levels in five seconds`);
  assert.equal(fogForWeather('ashfall'), FOG_SETTINGS.ashfall);
});
