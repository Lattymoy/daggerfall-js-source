// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): Skyrim's night sky wears an aurora - the law (where, when, under
// what sky, how strong a night), the pass (one additive triangle at the far plane), its door in the sky controller (eased,
// `?aurora=`), and where the controller draws it. Where ARENA2_PATH names the data, the place is held on the traced map
// the game runs too. Mutants: tools/mutants/skyrimaurora.json.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SKYRIM_THEATRE, AURORA_DIALS, AURORA_NIGHTS, NO_AURORA, auroraLatitude, auroraDark, auroraClear, auroraNight,
  auroraNightBase, auroraNightStrength, auroraTarget, auroraSky, auroraRoll, skyrimRows, skyTheatreAt,
} from '../../src/world/tamriel/skyrimAurora.js';
import {
  AuroraPass, AURORA_FS, AURORA_ADD_FS, AURORA_UNIFORMS, AURORA_PROGRAMS, AURORA_QUALITY, AURORA_MAX_STEPS, AURORA_DEPTH, AURORA_ARC_GAP,
  AURORA_RAY_ROWS, AURORA_ARC_ROW, AURORA_WAVES, AURORA_RATES, AURORA_SHEET_VAR, AURORA_GLOW_VAR, AURORA_REACH, AURORA_HEM, AURORA_CROWN,
  AURORA_GLOW, AURORA_GAIN, AURORA_PEAK, AURORA_HORIZON_LIFT, auroraPhases, AURORA_DOME_FS, AURORA_DOME, AURORA_LIGHT,
} from '../../src/render/auroraPass.js';
import { waterUniforms, waterSurfaceFs, AURORA_SKY_UNIT, AURORA_DOME_UV_GLSL, AURORA_MIRROR } from '../../src/render/waterSurface.js';
import { createAuroraHost, auroraDoor, withAuroraLight, AURORA_EASE_S, AURORA_DRAWN_FROM, AURORA_DOME_GAP_S } from '../../src/scenes/auroraHost.js';
import { Renderer } from '../../src/render/renderer.js';
import { wrapAngle } from '../../src/world/mat4.js';
import { THEATRE_KEYS, theatreAt } from '../../src/world/worldWide/worldGrid.js';
import { pictureToBay, setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setFolkPlace } from '../../src/characters/provinceFolk.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A picture-grid point's world pixel. */
const pix = (x, y) => { const [bx, by] = pictureToBay(x, y); return [Math.floor(bx), Math.floor(by)]; };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL'].every((f) => existsSync(join(ARENA2, f)));
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

// Skyrim, the Bay's Daggerfall and the provinces beside Skyrim - each where its own theatre says; and the seas past the Bay
const COAST = pix(168, 22), PINES = pix(180, 58);   // on the Frozen Coast and in the Pinewoods
const MORROWIND = pix(240, 60), HIGH_ROCK = pix(80, 40), CYRODIIL = pix(180, 100);
const DAGGERFALL = [207, 213];
const GHOSTS = pix(165, 14), FAR_SEA = pix(160, 2), WROTHGAR_SEA = pix(80, 18);
const MIDNIGHT = 0, NIGHT_SKY = 405 * 360 * 1440 + 23 * 60;

test('SKYRIM-AURORA THE DIALS: as the record gives them (mutants: any dial moved)', () => {
  assert.deepEqual({ ...AURORA_DIALS }, {
    sunFrom: -6, sunFull: -16, coverFrom: 0.6, coverGone: 0.9, decksFrom: 0.35, decksGone: 0.55, south: 0.6,
    hangSouth: 3.2, hangNorth: 0.4, swellMinutes: 150, swell: 0.2, seaReach: 10,
  });
  assert.deepEqual(AURORA_NIGHTS.map((t) => ({ ...t })), [{ share: 0.2, from: 0.3, to: 0.5 }, { share: 0.55, from: 0.6, to: 0.85 }, { share: 0.25, from: 0.9, to: 1 }]);
  assert.deepEqual([AURORA_EASE_S, AURORA_DRAWN_FROM], [6, 0.002]);
});

test('SKYRIM-AURORA THE PLACE: Skyrim alone, by its own rows on the land in use - 1 on its north coast, less to the south; none on the Bay, none in the provinces beside it (mutants: the theatre any province; the latitude unturned; the Bay let in; the pixel\'s centre dropped)', () => {
  assert.equal(THEATRE_KEYS[SKYRIM_THEATRE], 'Skyrim');
  assert.equal(theatreAt(...COAST), SKYRIM_THEATRE);
  assert.deepEqual(skyrimRows(), [18.25, 77.75], 'the authored shape\'s first and last rows');
  close(auroraLatitude(...COAST), 0.9369747899159664, 1e-12);
  close(auroraLatitude(...PINES), 0.3319327731092437, 1e-12);
  for (const [name, p] of [['Morrowind', MORROWIND], ['High Rock', HIGH_ROCK], ['Cyrodiil', CYRODIIL], ['the Bay', DAGGERFALL]]) {
    assert.notEqual(theatreAt(...p), SKYRIM_THEATRE, name);
    assert.equal(auroraLatitude(...p), null, name);
    assert.equal(auroraTarget({ px: p[0], py: p[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0 }), NO_AURORA, name);
  }
  assert.equal(auroraLatitude(COAST[0] + 0.5, COAST[1]), null, 'a pixel is whole, past the Bay too');
});

test('SKYRIM-AURORA THE SEA: past the Bay a sea\'s sky is its nearest land\'s within ten picture units - the Sea of Ghosts Skyrim\'s, whole; the far ocean and High Rock\'s north sea none (mutants: the sea left out; the reach unbounded; the nearest land unread)', () => {
  assert.equal(theatreAt(...GHOSTS), -1, 'the sea');
  assert.equal(skyTheatreAt(...GHOSTS), SKYRIM_THEATRE);
  assert.equal(auroraLatitude(...GHOSTS), 1);
  assert.equal(skyTheatreAt(...FAR_SEA), -1, 'sixteen picture units off the coast');
  assert.equal(skyTheatreAt(...WROTHGAR_SEA), THEATRE_KEYS.indexOf('HighRock'));
  assert.equal(auroraLatitude(...WROTHGAR_SEA), null);
  assert.equal(skyTheatreAt(...DAGGERFALL), 0, 'the Bay\'s own answer, never a search');
});

test('SKYRIM-AURORA THE LAND IN USE: a trace\'s Skyrim gives its own rows, found again when the land moves (mutants: the rows fixed; the cache never dropped)', () => {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 40; y < 60; y++) for (let x = 100; x < 280; x++) { land[y * w + x] = 1; province[y * w + x] = x < 200 ? 3 : 4; }
  setTamrielTrace({ w, h, land, province });
  assert.deepEqual(skyrimRows(), [40.25, 59.75]);
  assert.equal(auroraLatitude(...pix(150, 50)), 0.5);
  assert.equal(auroraLatitude(...pix(150, 35)), 1, 'the sea north of its coast');
  setTamrielTrace(null);
  assert.deepEqual(skyrimRows(), [18.25, 77.75], 'the authored shape again');
});

test('SKYRIM-AURORA with ARENA2: on the traced map the game runs, Solitude is the north coast and the Sea of Ghosts its sky (mutants: the authored rows kept)', { skip: !HAVE_ARENA2 && 'no ARENA2' }, async () => {
  const { ImgFile } = await import('../../src/formats/imgFile.js');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { traceTamrielPicture, paletteReader } = await import('../../src/ui/tamrielTrace.js');
  const { capitalCentrePixel } = await import('../../src/world/tamrielCapitals.js');
  const f = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const pic = new ImgFile(); pic.load(f('TMAP00I0.IMG'), 'TMAP00I0.IMG');
  const pal = new DFPalette(); pal.load(f('MAP.PAL'), 'MAP.PAL');
  const pk = new ImgFile(); pk.load(f('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
  setTamrielTrace(traceTamrielPicture(pk.getDFBitmap(), pic.getDFBitmap(), paletteReader(pal)));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the fit test/ui/tamriel4.test.js pins
  assert.deepEqual(skyrimRows(), [29.25, 80.75]);
  const sol = capitalCentrePixel(1);
  assert.ok(auroraLatitude(sol.px, sol.py) > 0.99, `Solitude ${auroraLatitude(sol.px, sol.py)}`);
  const ghosts = pix(150, 26);
  assert.deepEqual([theatreAt(...ghosts), skyTheatreAt(...ghosts), auroraLatitude(...ghosts)], [-1, SKYRIM_THEATRE, 1]);
});

test('SKYRIM-AURORA THE DARK: by the sun\'s depth - none at 18:00, whole by 19:30 and to 04:30, gone by 06:00 (mutants: the ramp turned; the sun\'s arc unturned)', () => {
  const at = (h) => +auroraDark(h * 60).toFixed(3);
  assert.deepEqual([17, 18, 18.5, 19, 19.5, 23, 0, 3, 4.5, 5, 5.5, 6, 12].map(at), [0, 0, 0.061, 0.972, 1, 1, 1, 1, 1, 0.972, 0.061, 0, 0]);
  assert.equal(auroraDark(NaN), 0);
});

test('SKYRIM-AURORA THE SKY: a cloudy night keeps it whole and an overcast one hides it; over the sky\'s own decks it goes from a sunny night\'s cover; the weather that puts the night sky out puts it out (mutants: the cover unread; the decks unread; nightSky unread)', () => {
  assert.deepEqual([0.32, 0.55, 0.6, 0.75, 0.9, 0.94, 1].map((c) => +auroraClear(c).toFixed(3)), [1, 1, 1, 0.5, 0, 0, 0]);
  assert.deepEqual([0.32, 0.35, 0.45, 0.55, 0.94].map((c) => +auroraClear(c, true).toFixed(3)), [1, 1, 0.5, 0, 0]);
  assert.equal(auroraClear(NaN), 0, 'no cover read is no sky');
  const t = auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0.32, nightSky: false });
  assert.equal(t, NO_AURORA);
});

test('SKYRIM-AURORA THE NIGHTS: an evening and the morning after are one night; its strength the same on every machine, its tiers in their shares, swelling by a fifth over 150 minutes (mutants: the night cut at midnight; a tier\'s share; the swell gone; its phase lost)', () => {
  const day = 405 * 360;
  assert.equal(auroraNight(day * 1440 + 20 * 60), auroraNight((day + 1) * 1440 + 4 * 60), 'one night across midnight');
  assert.notEqual(auroraNight(day * 1440 + 20 * 60), auroraNight((day + 1) * 1440 + 20 * 60));
  assert.equal(auroraRoll(123456, 0x51a7), auroraRoll(123456, 0x51a7));
  const N = 20000, shares = [0.2, 0.55, 0.25], ranges = [[0.3, 0.5], [0.6, 0.85], [0.9, 1]], counts = [0, 0, 0];
  for (let n = 0; n < N; n++) {
    const b = auroraNightBase(day + n);
    const i = ranges.findIndex(([a, z]) => b >= a && b <= z);
    assert.ok(i >= 0, `night ${n}: ${b} in no tier`);
    counts[i]++;
  }
  shares.forEach((s, i) => close(counts[i] / N, s, 0.015));
  // the swell, by its own literal law at two minutes of one night
  const night = auroraNight(NIGHT_SKY), b = auroraNightBase(night), phase = 2 * Math.PI * auroraRoll(night, 0x5e11);
  for (const m of [NIGHT_SKY, NIGHT_SKY + 61]) close(auroraNightStrength(m), b * (0.8 + 0.1 * (1 + Math.sin(2 * Math.PI * m / 150 + phase))), 1e-12);
  assert.notEqual(auroraNightStrength(NIGHT_SKY), auroraNightStrength(NIGHT_SKY + 61), 'it moves within a night');
});

test('SKYRIM-AURORA THE WEIGHT: 0.6 of it at the south edge and all of it on the coast, times the clear sky, the night and the dark - its arcs hung 3.2 hem heights north in the south and 0.4 on the coast (mutants: the south\'s share; the hang unturned; the dark unread)', () => {
  const lat = auroraLatitude(...COAST);
  const t = auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0.75 });
  close(t.weight, (0.6 + 0.4 * lat) * 0.5 * auroraNightStrength(NIGHT_SKY));
  close(t.hang, 3.2 * (1 - lat) + 0.4 * lat);
  assert.equal(auroraSky({ px: GHOSTS[0], py: GHOSTS[1], skyMinutes: NIGHT_SKY, cover: 0.32 }).hang, 0.4, 'overhead at the coast\'s sea');
  const dusk = auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: 18.5 * 60, skyMinutes: NIGHT_SKY, cover: 0.32 });
  close(dusk.weight, auroraSky({ px: COAST[0], py: COAST[1], skyMinutes: NIGHT_SKY, cover: 0.32 }).weight * auroraDark(18.5 * 60));
  assert.equal(auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: 12 * 60, skyMinutes: NIGHT_SKY, cover: 0.32 }), NO_AURORA, 'none by day');
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 64;
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k === 'getExtension') return null;
        if (k.startsWith('create')) return { k };
        return undefined;
      };
    },
  });
  return { gl, calls };
}

test('SKYRIM-AURORA THE PASS\'S DIALS: the tiers, the curtains, the clock, the colours and the light as the record gives them - and the skip reaches past every wave and glow (mutants: any of them moved)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(AURORA_QUALITY)), { lo: { steps: 6, scale: 0.5 }, default: { steps: 10, scale: 0.5 }, hi: { steps: 12, scale: 0.75 } });
  assert.deepEqual([AURORA_MAX_STEPS, AURORA_DEPTH, AURORA_ARC_GAP, AURORA_RAY_ROWS, AURORA_ARC_ROW], [16, 1.5, 1.3, 256, 5.3]);
  assert.deepEqual(JSON.parse(JSON.stringify(AURORA_WAVES)), [[0.55, 0.62, 0.035], [0.3, 1.37, -0.05], [0.35, 2.9, 0.07]]);
  assert.deepEqual({ ...AURORA_RATES }, { swell: -0.06, hem: 0.02, rays: 0.16 });
  assert.deepEqual([AURORA_SHEET_VAR, AURORA_GLOW_VAR], [1 / 24, 1 / 5]);
  assert.deepEqual([[...AURORA_HEM], [...AURORA_CROWN], [...AURORA_GLOW]], [[0.25, 1, 0.55], [0.1, 0.6, 0.9], [0.08, 0.25, 0.85]]);
  assert.deepEqual([AURORA_GAIN, AURORA_PEAK, AURORA_HORIZON_LIFT], [0.42, 0.95, 1.5]);
  assert.deepEqual({ ...AURORA_DOME }, { width: 256, height: 64, steps: 6, every: 3 });
  assert.deepEqual([[...AURORA_LIGHT], AURORA_MIRROR, AURORA_SKY_UNIT], [[0.012, 0.06, 0.042], 0.3, 24]);
  // the skip: the waves' amplitudes summed, and the glow out to where it is under 1/100 (exp(-2.5 * 1.4^2))
  close(AURORA_REACH, 0.55 + 0.3 + 0.35 + 1.4, 1e-12);
  assert.ok(Math.exp(-2.5 * 1.4 * 1.4) < 0.01);
  for (const line of [
    'if (yHi < uHang - 3.9 || yLo > uHang + 3.9) return vec3(0.0);',   // the skip, at the gap and the reach
    'float sVar = 0.041667 + step2 * step2 / 12.0, gVar = 0.2 + step2 * step2 / 12.0;',   // each sample widened by its step
    'float hem = smoothstep(0.0, 0.06 + 1.0 / uSteps, hn) * exp(-hn * 2.4);',
    'col *= m > 1e-5 ? 0.95 * (1.0 - exp(-m / 0.95)) / m : 1.0;',   // the roll-off
    'col += (jitter - 0.5) / 255.0 * step(0.004, col.g + col.b);',   // the dither
    'min(inversesqrt(up), 1.5) * smoothstep(0.01, 0.12, dir.y);',   // the horizon's lift, capped, faded in the last seven degrees
    'float lodR = smoothstep(0.25, 0.6, span * 7.0 / 6.2832), lodW = smoothstep(0.25, 0.6, span * 2.9 / 6.2832);',
    'if (dir.y <= 0.0) return vec3(0.0);',   // the ground's texels cost nothing
  ]) for (const fs of [AURORA_FS, AURORA_DOME_FS]) assert.ok(fs.includes(line), line);
});

test('SKYRIM-AURORA THE CLOCK: the phases wrapped in double precision on the CPU - every wave and drift in (-pi, pi] (world/mat4.js wrapAngle), each arc\'s rays on two whole rows of the noise\'s 256 and the share between them, seamless where the rows wrap (mutants: a phase unwrapped; the rows\' wrap lost)', () => {
  for (const t of [0, 100, 3599.98, 3600, 1e9 + 0.5]) {
    const ph = auroraPhases(t);
    AURORA_WAVES.forEach((w, i) => close(ph.wave[i], wrapAngle(t * w[2]), 1e-9));
    for (const v of [...ph.wave, ...ph.drift]) assert.ok(v > -Math.PI && v <= Math.PI, `${t}: ${v}`);
    for (let k = 0; k < 3; k++) {
      const row = (((t * 0.16 + k * 5.3) % 256) + 256) % 256, r0 = Math.floor(row), u = row - r0;
      assert.deepEqual([ph.lo[k], ph.hi[k]], [r0, (r0 + 1) % 256]);
      close(ph.share[k], u * u * (3 - 2 * u), 1e-12);
    }
  }
  const atWrap = auroraPhases((255.5 - 0) / 0.16);
  assert.deepEqual([atWrap.lo[0], atWrap.hi[0]], [255, 0], 'the last row blends into the first');
  close(atWrap.share[0], 0.5, 1e-9);
  assert.deepEqual(auroraPhases(NaN), auroraPhases(0), 'no clock is the clock at 0');
});

test('SKYRIM-AURORA THE PASS: nothing at weight 0; above it the march into its map and every third frame the dome map (nothing blended, the frame and the world rect given back), then one triangle at the far plane ADDING the map to the sky with the buffer\'s alpha untouched - every state put back, every allocation let go (mutants: drawn at 0; blended over by alpha; the depth written; the depth test left as found)', () => {
  const { gl, calls } = fakeGl();
  const p = new AuroraPass(gl, AURORA_QUALITY.default);
  calls.length = 0;
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0, 1, 0, [0, 0, 200, 100]);
  assert.deepEqual(calls, [], 'no aurora, no pass');
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);
  const at = (k, ...a) => calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  const all = (k, ...a) => calls.map((c, i) => (c[0] === k && a.every((v, j) => c[j + 1] === v) ? i : -1)).filter((i) => i >= 0);
  const [march, dome, add] = all('drawArrays', 'TRIANGLES', 0, 3);
  assert.ok(march >= 0 && dome > march && add > dome, 'the march, the dome map, then the add');
  assert.ok(at('texImage2D', 'TEXTURE_2D', 0, 'RGBA8', 256, 64) >= 0 && at('texParameteri', 'TEXTURE_2D', 'TEXTURE_WRAP_S', 'REPEAT') >= 0, 'the dome map, wrapping round the azimuth');
  assert.ok(calls.slice(march, dome).some((c) => c[0] === 'viewport' && c[1] === 0 && c[2] === 0 && c[3] === 256 && c[4] === 64));
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uSteps').map((c) => c[2]), [10, 6], 'the tier\'s steps on the screen, the dome map\'s own');
  assert.ok(at('texImage2D', 'TEXTURE_2D', 0, 'RGBA8', 100, 50) >= 0, 'the map at the tier\'s half of the world rect');
  assert.ok(at('bindFramebuffer', 'FRAMEBUFFER') < march && at('viewport', 0, 0, 100, 50) < march);
  assert.ok(at('disable', 'BLEND') < march && at('disable', 'DEPTH_TEST') < march, 'the march blends nothing');
  const marchBack = calls.slice(march, dome);
  assert.ok(marchBack.some((c) => c[0] === 'bindFramebuffer' && c[2] === null) && marchBack.some((c) => c[0] === 'viewport' && c[1] === 10 && c[2] === 20 && c[3] === 200 && c[4] === 100), 'the march gives the frame and the world rect back');
  const between = calls.slice(dome, add);
  assert.ok(p.domeTex, 'the dome map is the water\'s once drawn');
  assert.ok(between.some((c) => c[0] === 'bindFramebuffer' && c[2] === null), 'the frame given back');
  assert.ok(between.some((c) => c[0] === 'viewport' && c[1] === 10 && c[2] === 20 && c[3] === 200 && c[4] === 100), 'and the world rect');
  const addState = (k, ...a) => between.some((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  for (const [k, ...a] of [['blendFuncSeparate', 'ONE', 'ONE', 'ZERO', 'ONE'], ['enable', 'BLEND'], ['enable', 'DEPTH_TEST'], ['depthFunc', 'LEQUAL'], ['depthMask', false]]) assert.ok(addState(k, ...a), `the add: ${k} ${a}`);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uWeight'), ['uniform1f', 'uWeight', 0.6]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uHang'), ['uniform1f', 'uHang', 1.5]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSteps'), ['uniform1f', 'uSteps', 10]);
  close(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uPixel')[2], 2 * Math.tan(0.55) / 50, 1e-12);
  const after = calls.slice(add);
  for (const [k, ...a] of [['disable', 'BLEND'], ['enable', 'CULL_FACE'], ['depthFunc', 'LESS'], ['depthMask', true], ['bindTexture', 'TEXTURE_2D', null]]) assert.ok(after.some((c) => c[0] === k && a.every((v, i) => c[i + 1] === v)), `${k} ${a} put back`);
  calls.length = 0;
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);
  assert.equal(at('texImage2D', 'TEXTURE_2D', 0, 'RGBA8', 100, 50), -1, 'the map kept while the rect holds');
  assert.equal(all('drawArrays', 'TRIANGLES', 0, 3).length, 2, 'the dome map not marched again on the next frame');
  const [march2, add2] = all('drawArrays', 'TRIANGLES', 0, 3), back2 = calls.slice(march2, add2);
  assert.ok(back2.some((c) => c[0] === 'bindFramebuffer' && c[2] === null) && back2.some((c) => c[0] === 'viewport' && c[1] === 10 && c[2] === 20 && c[3] === 200 && c[4] === 100), 'and on a frame with no dome map');
  calls.length = 0;
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);
  assert.equal(all('drawArrays', 'TRIANGLES', 0, 3).length, 5, 'and again on the third');
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);   // a turn on, so the fresh one falls between two
  calls.length = 0;
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100], true);
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5, 0, [10, 20, 200, 100]);
  assert.equal(all('drawArrays', 'TRIANGLES', 0, 3).length, 7, 'a fresh dome marched at once, and the turn begun again from it');
  calls.length = 0;
  p.dispose();
  assert.deepEqual(calls.map((c) => c[0]), ['deleteProgram', 'deleteProgram', 'deleteProgram', 'deleteBuffer', 'deleteVertexArray', 'deleteTexture', 'deleteFramebuffer', 'deleteTexture', 'deleteFramebuffer']);
  assert.equal(p.domeTex, null);
  for (const u of AURORA_UNIFORMS) assert.match(AURORA_FS, new RegExp(`uniform \\w+[^;]*\\b${u}\\b`), u);
  assert.deepEqual(AURORA_PROGRAMS.map((pr) => pr[1]), [AURORA_FS, AURORA_ADD_FS, AURORA_DOME_FS]);
});

test('SKYRIM-AURORA THE DOOR: the sky\'s aurora at the player\'s pixel, whole at first and after a jump, eased over 6 real seconds after that - times the dark at the frame\'s own minute, so a rest into the day takes it at once; a bad frame never latches it; `?aurora=` off, on or a weight anywhere (mutants: the ease skipped; the first use eased from 0; the dark eased; the jump unread; the NaN kept; the door unread)', () => {
  let here = /** @type {{x: number, y: number}|null} */ ({ x: PINES[0], y: PINES[1] }), ms = 0;
  const host = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(null, new URLSearchParams(''), { here: () => here, clock: () => ms }));
  const pines = auroraSky({ px: PINES[0], py: PINES[1], skyMinutes: NIGHT_SKY, cover: 0.32 }), want = pines.weight;
  assert.ok(want > 0 && pines.hang > AURORA_DIALS.hangNorth);
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want);
  host.use(12 * 60, NIGHT_SKY, 0.32, true);
  assert.equal(host.weight, 0, 'a rest into the day: gone the same frame');
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want, 1e-12);
  here = { x: DAGGERFALL[0], y: DAGGERFALL[1] };
  ms += 6000;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want * Math.exp(-1), 1e-12);
  assert.equal(host.hang, pines.hang, 'a fading aurora keeps where it hung');
  here = { x: PINES[0], y: PINES[1] };
  host.jump();
  ms += 100;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want, 1e-12);   // a jump lands whole
  ms += 1000;
  host.use(MIDNIGHT, NaN, 0.32, true);
  ms += 60000;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  assert.ok(host.weight > 0.9 * want, 'one bad frame forgotten');
  ms = NaN;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want, 1e-12);   // a bad clock is a jump: whole
  ms = 1e6;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want, 1e-12);   // and the next frame whole too, the clock found again
  here = null;
  ms += 60000;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  assert.ok(host.weight < AURORA_DRAWN_FROM, 'gone with no pixel');
  assert.equal(createAuroraHost(null, new URLSearchParams('aurora=off')), null);
  const forced = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(null, new URLSearchParams('aurora=0.5'), { here: () => ({ x: DAGGERFALL[0], y: DAGGERFALL[1] }), clock: () => 0 }));
  forced.use(12 * 60, 0, 1, false);
  assert.equal(forced.weight, 0.5, 'a door stands it anywhere, at any hour');
  forced.draw(0, 0, 1, 1, [0, 0, 8, 8]);   // no gl: nothing to build, nothing thrown
  assert.deepEqual(['on', '', '0.25', '7', '-1', 'off', 'OFF', ' On ', 'x', null].map(auroraDoor), [1, 1, 0.25, 1, 0, 'off', 'off', 1, null, null]);
});

test('SKYRIM-AURORA THE DOOR, DRAWN: built on its tier\'s march, handed the walk clock\'s time, and dimmed by the veil - none drawn at a veil of 0 (mutants: the tier unread; the veil unread; the clock unread)', () => {
  const { gl, calls } = fakeGl();
  const host = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(gl, new URLSearchParams('aurora=1'), { quality: 'lo' }));
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true, false, 100);
  calls.length = 0;
  host.draw(0, 0.3, 1.1, 1.5, [0, 0, 64, 32], 0);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 0, 'a whole veil draws nothing');
  host.draw(0, 0.3, 1.1, 1.5, [0, 0, 64, 32], 0.5);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uWeight'), ['uniform1f', 'uWeight', 0.5]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSteps'), ['uniform1f', 'uSteps', 6], 'the lo tier\'s');
  const ph = auroraPhases(100 * 5), wave = calls.find((c) => c[0] === 'uniform3f' && c[1] === 'uWave');
  assert.deepEqual(wave.slice(2), ph.wave, 'a game minute is five of the curtains\' seconds');
});

test('SKYRIM-AURORA THE DOOR, SHOWN: the water\'s map only on a frame the aurora drew, marched afresh after a skipped frame or a gap of AURORA_DOME_GAP_S; the land\'s light by the weight drawn - the veil\'s, none with no pass, and at a view out\'s own minute (mutants: the map ungated; the gap unread; the skip unread; the veil unread; the pass unread; the minute unread)', () => {
  let ms = 0;
  const { gl, calls } = fakeGl();
  const pines = auroraSky({ px: PINES[0], py: PINES[1], skyMinutes: NIGHT_SKY, cover: 0.32 }).weight;
  const host = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(gl, new URLSearchParams(''), { here: () => ({ x: PINES[0], y: PINES[1] }), clock: () => ms }));
  const draws = (veil = 1) => { calls.length = 0; host.draw(0, 0.3, 1.1, 1.5, [0, 0, 64, 32], veil); return calls.filter((c) => c[0] === 'drawArrays').length; };
  const frame = (veil = 1) => { ms += 16; host.use(MIDNIGHT, NIGHT_SKY, 0.32, true); return draws(veil); };
  assert.equal(AURORA_DOME_GAP_S, 0.5);
  assert.deepEqual([frame(), frame(), frame(), frame()], [3, 2, 2, 3], 'the first frame\'s dome, then every third');
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  assert.equal(host.skyMap, null, 'a frame not drawn yet hands no map');
  assert.ok(draws() > 0 && host.skyMap?.tex, 'and a drawn one its dome');
  assert.equal(frame(0), 0);
  assert.equal(host.skyMap, null, 'a whole veil: no curtains in the sky, none in the water');
  assert.equal(host.light(), null, 'nor on the land');
  assert.equal(frame(), 3, 'after a skipped frame the dome is marched at once');
  assert.equal(frame(), 2);
  ms += 1000;
  assert.equal(frame(), 3, 'and after a gap (an hour indoors)');
  frame(0.5);
  [...host.light()].forEach((a, c) => close(a, AURORA_LIGHT[c] * pines * 0.5, 1e-7));
  assert.equal(host.light(12 * 60), null, 'a view out at noon: the clock\'s dark, none');
  [...host.light(MIDNIGHT)].forEach((a, c) => close(a, AURORA_LIGHT[c] * pines * 0.5, 1e-7));
  const blind = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(null, new URLSearchParams('aurora=1'), { clock: () => ms }));
  blind.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  blind.draw(0, 0.3, 1.1, 1.5, [0, 0, 64, 32]);
  assert.deepEqual([blind.light(), blind.skyMap], [null, null], 'no pass: no curtains, so no light and no map');
});

test('SKYRIM-AURORA THE PLACE DOOR: the world host\'s own door (setFolkPlace) is the pixel the aurora reads - and none with no host (mutants: the place door unread)', () => {
  let ms = 0;
  setFolkPlace((feet) => (feet ? null : { x: PINES[0], y: PINES[1] }), () => 0);
  try {
    const host = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(null, new URLSearchParams(''), { clock: () => ms }));
    host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
    close(host.weight, auroraSky({ px: PINES[0], py: PINES[1], skyMinutes: NIGHT_SKY, cover: 0.32 }).weight);
    setFolkPlace(null, null);
    ms += 60000;
    host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
    assert.ok(host.weight < AURORA_DRAWN_FROM, 'no host, no place');
  } finally { setFolkPlace(null, null); }
});

test('SKYRIM-AURORA THE SKY CONTROLLER: built on the enhanced lane alone at the clouds\' tier, handed the eased cover after the ease (the WeatherStyle only under the mod, the decks while no volumetric clouds are shown, put out under the sun baby) and the walk clock, told of a jump, drawn over the lane\'s sky and under its clouds in the world rect, dimmed in the brass air - and no host grows (mutants: drawn after the clouds; never drawn; the classic lane given it; the cover unhanded; the jump untold; the brass unread; the sun baby unread; the view out\'s minute dropped)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /const aurora = enhancedLane \? createAuroraHost\(gl, params, \{ quality: cloudQuality \}\) : null;/);
  assert.match(shared, /weatherRowNow = easeWeather\(weatherRowNow, want, easeDt\);\s*weatherRowNow\.wind = windModel\.vector\(\);(\s*\/\/[^\n]*)*\s*aurora\?\.use\(minuteOfDay, skyNow, weatherRowNow\.cover, \(dynamic \? showNightSky : true\) && !sunbabyOn && !\(sunbabyW > 0\), !cloudsShown, nowMin\);/, 'the sun baby\'s flower sky puts it out');
  assert.match(shared, /weatherJump\(\) \{[^}]*clouds\?\.jump\(\);[^\n]*\n\s*aurora\?\.jump\(\);/);
  assert.match(shared, /\(enhancedSky \?\? dynamicSky \?\? sky\)\.draw\(yaw, pitch, fovY, aspect\);\s*aurora\?\.draw\(yaw, pitch, fovY, aspect, viewport, 1 - brassW\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*skyViewport = viewport;\s*clouds\?\.update\(viewport\);\s*cloudsShown\?\.draw/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.ok(!/aurora/i.test(rd(host)), `${host} carries none of it`);
    assert.match(rd(host), /r\.setLighting\(withMoonAmbient\(light\.ambient, sky\.moonlight\(clockMinute\)\), light\.sun, SUN_RIG_COLOR\);/, `${host}: the view out's light at its clock minute`);
  }
  assert.match(rd('src/characters/provinceFolk.js'), /export const pixelHere = \(\) => \(_pixelOf \? _pixelOf\(null\) : null\);/, 'the world host\'s own place door');
  assert.match(rd('src/tools/skyLab.js'), /const auroraW = Number\(auroraDoor\(params\.get\('aurora'\)\)\) \|\| 0;/, 'the lab reads the game\'s door');
});

test('SKYRIM-AURORA THE DOME MAP: a texel\'s direction and a direction\'s texel are one law - the dome\'s march and the water\'s read agree, north at the middle, east a quarter on, the zenith guarded (mutants: the azimuth turned; the height read as an angle)', () => {
  // the two GLSL texts, read in JS: the dome's texel -> direction, and auroraDomeUv's direction -> uv
  assert.match(AURORA_DOME_FS, /float az = \(uv\.x - 0\.5\) \* 6\.2831853, y = uv\.y, c = sqrt\(max\(0\.0, 1\.0 - y \* y\)\);\s*outColor = vec4\(auroraAlong\(vec3\(sin\(az\) \* c, y, cos\(az\) \* c\)\), 1\.0\);/);
  assert.equal(AURORA_DOME_UV_GLSL, 'vec2 auroraDomeUv(vec3 R) { return vec2((length(R.xz) > 1e-6 ? atan(R.x, R.z) : 0.0) * 0.15915494 + 0.5, R.y); }');
  const dirOf = (u, v) => { const az = (u - 0.5) * 6.2831853, c = Math.sqrt(Math.max(0, 1 - v * v)); return [Math.sin(az) * c, v, Math.cos(az) * c]; };
  const uvOf = (R) => [(Math.hypot(R[0], R[2]) > 1e-6 ? Math.atan2(R[0], R[2]) : 0) * 0.15915494 + 0.5, R[1]];
  assert.deepEqual(uvOf([0, 1, 0]), [0.5, 1], 'straight up: the zenith row, never atan(0, 0)');
  for (const [u, v] of [[0.5, 0.3], [0.75, 0.1], [0.2, 0.8], [0.02, 0.5]]) {
    const back = uvOf(dirOf(u, v));
    close(back[0], u, 1e-6); close(back[1], v, 1e-12);
  }
  assert.deepEqual(dirOf(0.5, 0).map((x) => +x.toFixed(6)), [0, 0, 1], 'north at the middle');
  assert.deepEqual(dirOf(0.75, 0).map((x) => +Math.abs(x).toFixed(6)), [1, 0, 0], 'east a quarter on');
  assert.ok(dirOf(0.75, 0)[0] > 0);
});

test('SKYRIM-AURORA THE LAND\'S LIGHT: the aurora\'s light rides the sky\'s moonlight term - added to its ambient, a moonless night given a term with no key, none with no aurora (mutants: the light dropped; the key lit; the moon\'s own ambient lost)', () => {
  const moon = { dir: [0.3, 0.8, 0.5], scale: 0.2, color: [0.8, 0.85, 1], ambient: [0.01, 0.02, 0.03] };
  assert.equal(withAuroraLight(moon, null), moon);
  assert.equal(withAuroraLight(null, null), null);
  const lit = withAuroraLight(moon, [0.012, 0.06, 0.042]);
  assert.deepEqual([lit.dir, lit.scale, lit.color], [moon.dir, moon.scale, moon.color]);
  lit.ambient.forEach((a, c) => close(a, moon.ambient[c] + [0.012, 0.06, 0.042][c], 1e-12));
  assert.deepEqual(moon.ambient, [0.01, 0.02, 0.03], 'the moon\'s own term untouched');
  const moonless = withAuroraLight(null, [0.012, 0.06, 0.042]);
  assert.equal(moonless.scale, 0, 'no key');
  assert.deepEqual(moonless.ambient, [0.012, 0.06, 0.042]);
  // the door's light: AURORA_LIGHT by the weight drawn, none before the first draw
  const { gl } = fakeGl();
  const host = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(gl, new URLSearchParams('aurora=0.5'), { clock: () => 0 }));
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  assert.equal(host.light(), null, 'nothing before the first draw');
  host.draw(0, 0.3, 1.1, 1.5, [0, 0, 64, 32]);
  [...host.light()].forEach((a, c) => close(a, AURORA_LIGHT[c] * 0.5, 1e-7));
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /const moonNow = \(minute\) => withAuroraLight\(enhancedSky\?\.state \? moonlightTerm\(enhancedSky\.state\) : dynamicMoonlight\(dynamicMoons\), aurora\?\.light\(minute\) \?\? null\);/, 'every reader of the moonlight - the land, the water\'s body, the night air');
  assert.match(shared, /moonlight\(minute\) \{ return moonNow\(minute\); \}/);
});

test('SKYRIM-AURORA THE WATER\'S MIRROR: the sky controller hands the dome map with the water\'s sky, waterUniforms forwards it, the water reads it along its reflected ray at its Fresnel or AURORA_MIRROR, added as a glint - and the renderer binds it on its own unit, the black texel without one (mutants: the map unhanded; the mirror at the bare Fresnel; the unit shared)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /const auroraIn = \(ws\) => \{ const map = aurora\?\.skyMap \?\? null; return map \? \{ \.\.\.ws, aurora: map \} : ws; \};/);
  assert.equal((shared.match(/return auroraIn\(leaved\(dreaded\(/g) ?? []).length, 2, 'on both lanes');
  const tex = { k: 'tex' };
  assert.equal(waterUniforms({ sky: { zenith: [0, 0, 0], horizon: [0, 0, 0], aurora: { tex } } }).aurora, tex);
  assert.equal(waterUniforms({ sky: { zenith: [0, 0, 0], horizon: [0, 0, 0] } }).aurora, null);
  const fs = waterSurfaceFs();
  assert.ok(fs.includes(AURORA_DOME_UV_GLSL));
  assert.ok(fs.includes('if (uAuroraSkyOn == 1) auroraRefl = textureLod(uAuroraSky, auroraDomeUv(R), 0.0).rgb * step(0.0, R.y) * max(F, 0.30);'));
  assert.ok(fs.includes('own += auroraRefl * (1.0 - foam);'));
  const r = rd('src/render/renderer.js');
  assert.match(r, /_bindAuroraSky\(L, tex\) \{\s*const gl = this\.gl, on = tex \? 1 : 0, want = tex \?\? this\._blackTex;\s*if \(L\.auroraOn !== on\) \{ gl\.uniform1i\(L\.auroraSkyOn, on\); L\.auroraOn = on; \}\s*if \(this\._auroraBound === want\) return;\s*this\._activeTexture\(gl\.TEXTURE0 \+ AURORA_SKY_UNIT\);\s*gl\.bindTexture\(gl\.TEXTURE_2D, want\);/);
  assert.match(r, /this\._bindRipples\(L\);\s*this\._bindAuroraSky\(L, u\.aurora\);/);
  // both programs' fixed samplers sent at their build - the snow lines' too: a frame with no snow had left it on unit 0
  // beside the tile array - and both units holding the black texel from the start
  assert.match(r, /_waterSamplerUnits\(P, L\) \{\s*this\._use\(P\);\s*this\.gl\.uniform1i\(L\.snow\.lines, SNOW_LINES_UNIT\); L\.snowUnit = true;\s*this\.gl\.uniform1i\(L\.auroraSky, AURORA_SKY_UNIT\);/);
  assert.equal((r.match(/this\._waterSamplerUnits\(this\.waterSurfaceProgram(Lane)?, this\._ws(Lane)?\);/g) ?? []).length, 2, 'the classic water and the lane\'s');
  assert.match(r, /for \(const unit of \[SNOW_LINES_UNIT, AURORA_SKY_UNIT\]\) \{ this\._activeTexture\(gl\.TEXTURE0 \+ unit\); gl\.bindTexture\(gl\.TEXTURE_2D, this\._blackTex\); \}/);
});

test('SKYRIM-AURORA THE UNIT, THE AURORA\'S ALONE: no other fixed texture unit is AURORA_SKY_UNIT - so a snow pass between two water draws leaves the dome map where the water\'s cache says it is (mutants: the unit the snow\'s far map\'s, as it first was)', () => {
  const dir = new URL('../../src/render/', import.meta.url);
  const others = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/export const (\w+_UNITS?) = ([^;]+);/g)) {
      if (m[1] === 'AURORA_SKY_UNIT' || m[1] === 'WATER_LAYER_UNITS') continue;   // the layers' units are a polygon offset's
      for (const n of m[2].matchAll(/(?<![\w.])\d+(?![\w.])/g)) others.push([`${f} ${m[1]}`, Number(n[0])]);
    }
  }
  assert.ok(others.some(([k, n]) => /SNOW_UNITS/.test(k) && n === 20), 'the scan reads the snow\'s');
  assert.deepEqual(others.filter(([, n]) => n === AURORA_SKY_UNIT), [], 'its unit is no other\'s');
  // the renderer itself, on a GL that records each unit's texture: the water, a snow pass, the water again
  let active = 0;
  const units = new Map();
  const gl = new Proxy({}, {
    get: (_, k) => {
      if (k === 'TEXTURE0') return 33984;
      if (k === 'activeTexture') return (u) => { active = u - 33984; };
      if (k === 'bindTexture') return (_t, tex) => { units.set(active, tex); };
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'getExtension') return () => null;
      if (k === 'getParameter') return () => 16;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ k });
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const r = /** @type {any} */ (new Renderer(/** @type {any} */ ({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 })));
  const dome = { k: 'dome' }, white = { k: 'snow' };
  r._use(r.waterSurfaceProgram); r._bindAuroraSky(r._ws, dome);
  const u = { origin: [0, 0, 0], depths: [0, 0, 0, 0], limits: [0, 0, 0, 0], dynMap: [0, 0, 0, 0], dynTexel: [0, 0, 0, 0], statMap: [0, 0, 0, 0], flags: [0, 0, 0, 0], radius: [0, 0, 0, 0], inner: [0, 0, 0, 0], outer: [0, 0, 0, 0], boundaryFade: 0, darkening: 0 };
  r.drawSnowBegin();
  r.drawSnow({ vao: {}, indexCount: 3 }, u, { dynamic: white, static: white, context: white, far: white, albedo: white });
  r.drawSnowEnd();
  assert.ok([...units.values()].includes(white), 'the snow pass bound its maps');
  r._use(r.waterSurfaceProgram); r._bindAuroraSky(r._ws, dome);
  assert.equal(units.get(AURORA_SKY_UNIT), dome, 'the water reads the dome, not the snow');
});
