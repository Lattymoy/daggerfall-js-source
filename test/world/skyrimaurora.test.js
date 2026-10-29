// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): Skyrim's night sky wears an aurora - the law (where, when, under
// what sky, how strong a night), the pass (one additive triangle at the far plane), its door in the sky controller (eased,
// `?aurora=`), and where the controller draws it. Where ARENA2_PATH names the data, the place is held on the traced map
// the game runs too. Mutants: tools/mutants/skyrimaurora.json.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SKYRIM_THEATRE, AURORA_DIALS, AURORA_NIGHTS, NO_AURORA, auroraLatitude, auroraDark, auroraClear, auroraNight,
  auroraNightBase, auroraNightStrength, auroraTarget, auroraSky, auroraRoll, skyrimRows, skyTheatreAt,
} from '../../src/world/tamriel/skyrimAurora.js';
import { AuroraPass, AURORA_FS, AURORA_UNIFORMS, AURORA_PROGRAMS } from '../../src/render/auroraPass.js';
import { createAuroraHost, auroraDoor, AURORA_EASE_S, AURORA_DRAWN_FROM } from '../../src/scenes/auroraHost.js';
import { THEATRE_KEYS, theatreAt } from '../../src/world/worldWide/worldGrid.js';
import { pictureToBay, setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A picture-grid point's world pixel. */
const pix = (x, y) => { const [bx, by] = pictureToBay(x, y); return [Math.floor(bx), Math.floor(by)]; };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL'].every((f) => existsSync(join(ARENA2, f)));
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

// Skyrim's Frozen Coast and its Pinewoods (world/tamriel/tamrielBiomes.js's own points), the Bay's Daggerfall, and the
// provinces beside Skyrim - each where its own theatre says; and the seas past the Bay
const COAST = pix(168, 22), PINES = pix(180, 58);
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

test('SKYRIM-AURORA THE PASS: nothing at weight 0; above it one triangle at the far plane, its light ADDED to the sky with the buffer\'s alpha untouched, every state put back, and every allocation let go (mutants: drawn at 0; blended over by alpha; the depth written)', () => {
  const { gl, calls } = fakeGl();
  const p = new AuroraPass(gl);
  calls.length = 0;
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0, 1);
  assert.deepEqual(calls, [], 'no aurora, no pass');
  p.draw(0.3, 0.2, 1.1, 16 / 9, 0.6, 1.5);
  const at = (k, ...a) => calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  const draw = at('drawArrays', 'TRIANGLES', 0, 3);
  assert.ok(draw >= 0);
  assert.ok(at('enable', 'BLEND') >= 0 && at('enable', 'BLEND') < draw);
  assert.ok(at('blendFuncSeparate', 'ONE', 'ONE', 'ZERO', 'ONE') >= 0 && at('blendFuncSeparate', 'ONE', 'ONE', 'ZERO', 'ONE') < draw, 'light added; the alpha untouched');
  for (const [k, v] of [['depthFunc', 'LEQUAL'], ['depthMask', false]]) assert.ok(at(k, v) >= 0 && at(k, v) < draw, `${k} ${v}: only the cleared depth, none written - the land stands over it`);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uWeight'), ['uniform1f', 'uWeight', 0.6]);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uHang'), ['uniform1f', 'uHang', 1.5]);
  const after = calls.slice(draw);
  for (const [k, ...a] of [['disable', 'BLEND'], ['enable', 'CULL_FACE'], ['depthFunc', 'LESS'], ['depthMask', true]]) assert.ok(after.some((c) => c[0] === k && a.every((v, i) => c[i + 1] === v)), `${k} ${a} put back`);
  calls.length = 0;
  p.dispose();
  assert.deepEqual(calls.map((c) => c[0]), ['deleteProgram', 'deleteBuffer', 'deleteVertexArray']);
  for (const u of AURORA_UNIFORMS) assert.match(AURORA_FS, new RegExp(`uniform float[^;]*\\b${u}\\b`), u);
  assert.match(AURORA_FS, /if \(dir\.y <= 0\.0\) discard;/, 'none under the horizon');
  assert.deepEqual(AURORA_PROGRAMS[0][1], AURORA_FS);
});

test('SKYRIM-AURORA THE DOOR: the sky\'s aurora at the player\'s pixel, whole at first and after a jump, eased over 6 real seconds after that - times the dark at the frame\'s own minute, so a rest into the day takes it at once; a bad frame never latches it; `?aurora=` off, on or a weight anywhere (mutants: the ease skipped; the first use eased from 0; the dark eased; the jump unread; the NaN kept; the door unread)', () => {
  let here = /** @type {{x: number, y: number}|null} */ ({ x: PINES[0], y: PINES[1] }), ms = 0;
  const host = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(null, new URLSearchParams(''), () => here, () => ms));
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
  here = null;
  ms += 60000;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  assert.ok(host.weight < AURORA_DRAWN_FROM, 'gone with no pixel');
  host.draw(0, 0, 1, 1);   // no gl: nothing to build, nothing thrown
  assert.equal(createAuroraHost(null, new URLSearchParams('aurora=off')), null);
  const forced = /** @type {NonNullable<ReturnType<typeof createAuroraHost>>} */ (createAuroraHost(null, new URLSearchParams('aurora=0.5'), () => ({ x: DAGGERFALL[0], y: DAGGERFALL[1] }), () => 0));
  forced.use(12 * 60, 0, 1, false);
  assert.equal(forced.weight, 0.5, 'a door stands it anywhere, at any hour');
  assert.deepEqual(['on', '', '0.25', '7', '-1', 'off', 'OFF', ' On ', 'x', null].map(auroraDoor), [1, 1, 0.25, 1, 0, 'off', 'off', 1, null, null]);
});

test('SKYRIM-AURORA THE SKY CONTROLLER: built on the enhanced lane alone, handed the eased cover after the ease (the WeatherStyle only under the mod, the decks while no volumetric clouds are shown), told of a jump, drawn over the lane\'s sky and under its clouds - and no host grows (mutants: drawn after the clouds; the classic lane given it; the cover unhanded; the jump untold)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /const aurora = enhancedLane \? createAuroraHost\(gl, params\) : null;/);
  assert.match(shared, /weatherRowNow = easeWeather\(weatherRowNow, want, easeDt\);\s*weatherRowNow\.wind = windModel\.vector\(\);(\s*\/\/[^\n]*)*\s*aurora\?\.use\(minuteOfDay, skyNow, weatherRowNow\.cover, dynamic \? showNightSky : true, !cloudsShown\);/);
  assert.match(shared, /weatherJump\(\) \{[^}]*clouds\?\.jump\(\);[^\n]*\n\s*aurora\?\.jump\(\);/);
  assert.match(shared, /\(enhancedSky \?\? dynamicSky \?\? sky\)\.draw\(yaw, pitch, fovY, aspect\);\s*aurora\?\.draw\(yaw, pitch, fovY, aspect\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*skyViewport = viewport;\s*clouds\?\.update\(viewport\);\s*cloudsShown\?\.draw/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.ok(!/aurora/i.test(rd(host)), `${host} carries none of it`);
  assert.match(rd('src/characters/provinceFolk.js'), /export const pixelHere = \(\) => \(_pixelOf \? _pixelOf\(null\) : null\);/, 'the world host\'s own place door');
  assert.match(rd('src/tools/skyLab.js'), /const auroraW = Number\(auroraDoor\(params\.get\('aurora'\)\)\) \|\| 0;/, 'the lab reads the game\'s door');
});
