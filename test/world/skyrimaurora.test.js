// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): Skyrim's night sky wears an aurora - the law (where, when, under
// what sky, how strong a night), the pass (one additive triangle at the far plane), its door in the sky controller (eased,
// `?aurora=`), and where the controller draws it. Mutants: tools/mutants/skyrimaurora.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SKYRIM_THEATRE, AURORA_DIALS, AURORA_NIGHTS, NO_AURORA, auroraLatitude, auroraDark, auroraClear, auroraNight,
  auroraNightBase, auroraNightStrength, auroraTarget, auroraRoll,
} from '../../src/world/tamriel/skyrimAurora.js';
import { AuroraPass, AURORA_FS, AURORA_UNIFORMS, AURORA_PROGRAMS } from '../../src/render/auroraPass.js';
import { createAuroraHost, auroraDoor, AURORA_EASE_S, AURORA_DRAWN_FROM } from '../../src/scenes/auroraHost.js';
import { THEATRE_KEYS, theatreAt } from '../../src/world/worldWide/worldGrid.js';
import { pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A picture-grid point's world pixel. */
const pix = (x, y) => { const [bx, by] = pictureToBay(x, y); return [Math.floor(bx), Math.floor(by)]; };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// Skyrim's Frozen Coast and its Pinewoods (world/tamriel/tamrielBiomes.js's own points), the Bay's Daggerfall, and the
// provinces beside Skyrim - each where its own theatre says
const COAST = pix(168, 22), PINES = pix(180, 58);
const MORROWIND = pix(240, 60), HIGH_ROCK = pix(80, 40), CYRODIIL = pix(180, 100);
const DAGGERFALL = [207, 213];
const MIDNIGHT = 0, NIGHT_SKY = 405 * 360 * 1440 + 23 * 60;

test('SKYRIM-AURORA THE PLACE: Skyrim alone, 1 on its north coast and less to the south - none on the Bay, none in the provinces beside it (mutants: the theatre any province; the latitude unturned; the Bay let in)', () => {
  assert.equal(THEATRE_KEYS[SKYRIM_THEATRE], 'Skyrim');
  assert.equal(theatreAt(...COAST), SKYRIM_THEATRE);
  assert.equal(auroraLatitude(...COAST), 1, 'the north coast, whole');
  close(auroraLatitude(...PINES), (AURORA_DIALS.southY - 58.5) / (AURORA_DIALS.southY - AURORA_DIALS.northY), 0.02);
  assert.ok(auroraLatitude(...PINES) < auroraLatitude(...COAST));
  for (const [name, p] of [['Morrowind', MORROWIND], ['High Rock', HIGH_ROCK], ['Cyrodiil', CYRODIIL], ['the Bay', DAGGERFALL]]) {
    assert.notEqual(theatreAt(...p), SKYRIM_THEATRE, name);
    assert.equal(auroraLatitude(...p), null, name);
    assert.equal(auroraTarget({ px: p[0], py: p[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0 }), NO_AURORA, name);
  }
  assert.equal(auroraLatitude(2.5, 3), null, 'a pixel is whole');
});

test('SKYRIM-AURORA THE DARK: by the sun\'s depth - none at 18:00, whole by 19:30 and to 04:30, gone by 06:00 (mutants: the ramp turned; the sun\'s arc unturned)', () => {
  const at = (h) => +auroraDark(h * 60).toFixed(3);
  assert.deepEqual([17, 18, 18.5, 19, 19.5, 23, 0, 3, 4.5, 5, 5.5, 6, 12].map(at), [0, 0, 0.061, 0.972, 1, 1, 1, 1, 1, 0.972, 0.061, 0, 0]);
});

test('SKYRIM-AURORA THE SKY: a cloudy night keeps it whole, an overcast one hides it, and the weather that puts the night sky out puts it out (mutants: the cover unread; nightSky unread)', () => {
  assert.deepEqual([0.32, 0.55, 0.6, 0.75, 0.9, 0.94, 1].map((c) => +auroraClear(c).toFixed(3)), [1, 1, 1, 0.5, 0, 0, 0]);
  const t = auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0.32, nightSky: false });
  assert.equal(t, NO_AURORA);
});

test('SKYRIM-AURORA THE NIGHTS: an evening and the morning after are one night; its strength the same on every machine, its tiers in their shares, swelling by a fifth at most (mutants: the night cut at midnight; a tier\'s share; the swell)', () => {
  const day = 405 * 360;
  assert.equal(auroraNight(day * 1440 + 20 * 60), auroraNight((day + 1) * 1440 + 4 * 60), 'one night across midnight');
  assert.notEqual(auroraNight(day * 1440 + 20 * 60), auroraNight((day + 1) * 1440 + 20 * 60));
  assert.equal(auroraRoll(123456, 0x51a7), auroraRoll(123456, 0x51a7));
  const N = 20000, counts = AURORA_NIGHTS.map(() => 0);
  for (let n = 0; n < N; n++) {
    const b = auroraNightBase(day + n);
    const i = AURORA_NIGHTS.findIndex((t) => b >= t.from && b <= t.to);
    assert.ok(i >= 0, `night ${n}: ${b} in no tier`);
    counts[i]++;
  }
  AURORA_NIGHTS.forEach((t, i) => close(counts[i] / N, t.share, 0.015));
  close(AURORA_NIGHTS.reduce((s, t) => s + t.share, 0), 1);
  for (let m = 0; m < 1440; m += 7) {
    const sky = day * 1440 + 18 * 60 + m, b = auroraNightBase(auroraNight(sky)), s = auroraNightStrength(sky);
    assert.ok(s <= b + 1e-12 && s >= b * (1 - AURORA_DIALS.swell) - 1e-12, `${s} against ${b}`);
  }
});

test('SKYRIM-AURORA THE WEIGHT: the latitude\'s strength times the dark, the clear sky and the night - and the arcs hung from the south edge\'s distance to the coast\'s overhead (mutants: the south\'s share; the hang unturned)', () => {
  const d = AURORA_DIALS;
  for (const [p, lat] of [[COAST, auroraLatitude(...COAST)], [PINES, auroraLatitude(...PINES)]]) {
    const t = auroraTarget({ px: p[0], py: p[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0.75 });
    close(t.weight, (d.south + (1 - d.south) * lat) * 1 * 0.5 * auroraNightStrength(NIGHT_SKY));
    close(t.hang, d.hangSouth * (1 - lat) + d.hangNorth * lat);
  }
  assert.equal(auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0.32 }).hang, d.hangNorth, 'overhead on the coast');
  assert.equal(auroraTarget({ px: COAST[0], py: COAST[1], minuteOfDay: 12 * 60, skyMinutes: NIGHT_SKY, cover: 0.32 }).weight, 0, 'none by day');
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

test('SKYRIM-AURORA THE DOOR: the law\'s weight at the player\'s pixel, taken whole at first and eased after over real seconds; none with no pixel; `?aurora=` off, on or a weight anywhere (mutants: the ease skipped; the first use eased from 0; the door unread)', () => {
  let here = { x: PINES[0], y: PINES[1] }, ms = 0;
  const host = createAuroraHost(null, new URLSearchParams(''), () => here, () => ms);
  const pines = auroraTarget({ px: PINES[0], py: PINES[1], minuteOfDay: MIDNIGHT, skyMinutes: NIGHT_SKY, cover: 0.32 }), want = pines.weight;
  assert.ok(want > 0 && pines.hang > AURORA_DIALS.hangNorth);
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want);
  here = { x: DAGGERFALL[0], y: DAGGERFALL[1] };
  ms += AURORA_EASE_S * 1000;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  close(host.weight, want * Math.exp(-1), 1e-12);
  assert.equal(host.hang, pines.hang, 'a fading aurora keeps where it hung');
  here = null;
  ms += 60000;
  host.use(MIDNIGHT, NIGHT_SKY, 0.32, true);
  assert.ok(host.weight < AURORA_DRAWN_FROM, 'gone with no pixel');
  host.draw(0, 0, 1, 1);   // no gl: nothing to build, nothing thrown
  assert.equal(createAuroraHost(null, new URLSearchParams('aurora=off')), null);
  const forced = createAuroraHost(null, new URLSearchParams('aurora=0.5'), () => ({ x: DAGGERFALL[0], y: DAGGERFALL[1] }), () => 0);
  forced.use(12 * 60, 0, 1, false);
  assert.equal(forced.weight, 0.5, 'a door stands it anywhere, at any hour');
  assert.deepEqual(['on', '', '0.25', '7', '-1', 'off', 'x', null].map(auroraDoor), [1, 1, 0.25, 1, 0, 'off', null, null]);
});

test('SKYRIM-AURORA THE SKY CONTROLLER: built on the enhanced lane alone, handed the eased cover after the ease, drawn over the lane\'s sky and under its clouds - and no host grows (mutants: drawn after the clouds; the classic lane given it; the cover unhanded)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /const aurora = enhancedLane \? createAuroraHost\(gl, params\) : null;/);
  assert.match(shared, /weatherRowNow = easeWeather\(weatherRowNow, want, easeDt\);\s*weatherRowNow\.wind = windModel\.vector\(\);\s*aurora\?\.use\(minuteOfDay, skyNow, weatherRowNow\.cover, showNightSky\);/);
  assert.match(shared, /\(enhancedSky \?\? dynamicSky \?\? sky\)\.draw\(yaw, pitch, fovY, aspect\);\s*aurora\?\.draw\(yaw, pitch, fovY, aspect\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*skyViewport = viewport;\s*clouds\?\.update\(viewport\);\s*cloudsShown\?\.draw/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.ok(!/aurora/i.test(rd(host)), `${host} carries none of it`);
  assert.match(rd('src/characters/provinceFolk.js'), /export const pixelHere = \(\) => \(_pixelOf \? _pixelOf\(null\) : null\);/, 'the world host\'s own place door');
});
