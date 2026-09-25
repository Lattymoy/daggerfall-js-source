// DISC17 (2026-09-24, Mac). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC17.
//
// ── DISC17-A: "I really want to give the wisps more opacity and reduce the amount of wind wisps" ──
// Half as many (WISP_MAX 240 -> 120, a calm 19 -> 10), each twice as dark (WISP_LOOK's alpha 0.10/0.12 -> 0.20/0.24).
//
// ── DISC17-B: "Sometimes thunder ends abruptly" ──
// A distant storm's thunder plays from a stand-in THUNDER_SOURCE_M (13 m) from the ear at a 13 m reference distance,
// and a panner stays where it was put. The ear moved on under a rolling clip - a walk, and at every map pixel crossed
// the floating origin's 819.2 m recentre, which dropped the clip 35 dB in one frame. A `far` shot keeps its offset
// from the listener until its clip has run out.
//
// ── DISC17-C: "Remove the enhanced map weather enhancements entirely" ──
// The held map is the bay again: no regions, glyphs, legend or forecast, no weather in the hover, and none of
// MAP-LAG's machinery for them (the kept raster, the job, the sheet contract's paintUnder). The sim's own weather
// laws stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { WISP_MAX, WISP_FLOOR, WISP_LOOK, WISP_FS, WindWispsRenderer, wispCount } from '../src/render/windWisps.js';
import { AudioEngine } from '../src/systems/audio.js';
import { THUNDER_SOURCE_M, thunderSourceAt } from '../src/systems/distantStorms.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { SHEET_MEMBERS } from '../src/ui/mapStrip.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('DISC17-A: half the wisps, each twice as dark - 120 at a gale and 10 in a calm, the ink\'s heart 0.70 at a gale where it was 0.35 (mutants: the count back at 240; the alpha back at WIND3\'s)', () => {
  assert.equal(WISP_MAX, 120);
  assert.deepEqual([wispCount(1), wispCount(0)], [120, 10], 'a gale and a dead calm (the floor is the same share)');
  assert.equal(WISP_FLOOR, 0.08);
  assert.deepEqual([...WISP_LOOK.alpha], [0.20, 0.24]);
  // the flourish's line at the heart of its ink, mid-life: the shader's own factor times the look's alpha
  const heart = Number(WISP_FS.match(/a = mix\(a, drawn \* ink \* ([\d.]+), uCurl\);/)[1]);
  const gale = heart * (WISP_LOOK.alpha[0] + WISP_LOOK.alpha[1]), calm = heart * WISP_LOOK.alpha[0];
  assert.ok(Math.abs(gale - 0.704) < 1e-9 && Math.abs(calm - 0.32) < 1e-9, `a gale ${gale}, a calm ${calm}`);
  assert.ok(gale >= 2 * heart * 0.22 - 1e-9, 'twice WIND5\'s gale');
  // drawn: a gale puts up 120 flourishes with the new alpha
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (typeof k === 'string' && /^[A-Z_]+$/.test(k)) return k;
      if (k.startsWith?.('create')) return () => ({});
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  const r = new WindWispsRenderer(gl);
  r.draw({ on: true, strength01: 1, step: [0, 0], windV: [3, 0] }, new Float32Array(16), new Float32Array(16), new Float32Array(3), 1);
  assert.equal(r.drawn, 120);
  assert.deepEqual(calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uAlpha').slice(2), [0.20, 0.24]);
});

/** A WebAudio graph that records the listener and every panner the engine makes, with a clock. */
function riggedEngine() {
  const param = () => ({ value: 0 });
  const panners = [];
  const listener = { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() };
  const ctx = {
    state: 'running', currentTime: 100, destination: { connect(n) { return n; } }, listener,
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createPanner: () => { const p = { positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() {} }; panners.push(p); return p; },
    createBufferSource: () => ({ buffer: null, playbackRate: param(), connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  e.buffers.set(349, { duration: 6 });   // StormLightningThunder, a rolling clip
  return { e, panners, listener, ctx };
}
/** WebAudio's 'inverse' distance gain for a panner, from the listener it is heard by (the spec's formula). */
const inverseGain = (pan, listener, ref) => {
  const d = Math.hypot(pan.positionX.value - listener.positionX.value, pan.positionY.value - listener.positionY.value, pan.positionZ.value - listener.positionZ.value);
  return ref / (ref + Math.max(d, ref) - ref);
};

test('DISC17-B: a distant storm\'s thunder keeps its place from the ear - a walk and a floating-origin recentre under a rolling clip leave its level and bearing where they were; an ordinary one-shot still stays where it was put (mutants: the far shot not moved; its offset not taken from the ear)', () => {
  const { e, panners, listener } = riggedEngine();
  const fwd = [0, 0, 1];
  let ear = [100, 2, 200];
  e.setListener(ear, fwd);
  const at = thunderSourceAt(ear, ear[0] + 9000, ear[2] + 4000);   // a storm ten kilometres off, north-east
  e.play3d(349, at, 0.6, { refDistance: THUNDER_SOURCE_M, maxDistance: THUNDER_SOURCE_M * 8, far: true });
  e.play3d(349, at, 0.6, { refDistance: THUNDER_SOURCE_M, maxDistance: THUNDER_SOURCE_M * 8 });   // the same shot, not far
  const [far, plain] = panners;
  const level0 = inverseGain(far, listener, THUNDER_SOURCE_M);
  const bearing = (p) => Math.atan2(p.positionX.value - listener.positionX.value, -(p.positionZ.value - listener.positionZ.value));
  const b0 = bearing(far);
  // a walk: twenty metres south-west over two seconds of the roll
  for (let i = 1; i <= 20; i++) { ear = [100 - i * 0.7, 2, 200 - i * 0.7]; e.setListener(ear, fwd); }
  assert.ok(Math.abs(inverseGain(far, listener, THUNDER_SOURCE_M) - level0) < 1e-9, 'the far thunder\'s level holds under the walk');
  assert.ok(Math.abs(bearing(far) - b0) < 1e-9, 'and its bearing');
  assert.ok(inverseGain(plain, listener, THUNDER_SOURCE_M) < 0.6 * level0, 'a panner left where it was put fell behind the walk');
  // a recentre: the scene moves 819.2 m under the ear in one frame
  ear = [ear[0] - 819.2, ear[1], ear[2]];
  e.setListener(ear, fwd);
  assert.ok(Math.abs(inverseGain(far, listener, THUNDER_SOURCE_M) - level0) < 1e-9, 'the far thunder rolls on through a recentre');
  const plainDb = 20 * Math.log10(inverseGain(plain, listener, THUNDER_SOURCE_M) / level0);
  assert.ok(plainDb < -34, `the old one-shot dropped ${plainDb.toFixed(1)} dB there - the abrupt end`);
  // the offset is the ear's, not the scene origin's
  assert.ok(Math.abs((far.positionX.value - listener.positionX.value) - (at[0] - 100)) < 1e-9);
});

test('DISC17-B: a far shot is let go when its clip has run out - its panner no longer moved and the list empty; the ambience\'s own storm stays DFU\'s one-shot; both hosts play the distant thunder far (mutant: never let go)', () => {
  const { e, panners, ctx } = riggedEngine();
  e.setListener([0, 0, 0], [0, 0, 1]);
  e.play3d(349, [13, 6, 0], 1, { refDistance: 13, far: true });
  e.setListener([1, 0, 0], [0, 0, 1]);
  assert.equal(panners[0].positionX.value, 14, 'moved with the ear while it sounds');
  ctx.currentTime += 6.01;
  e.setListener([5, 0, 0], [0, 0, 1]);
  assert.equal(panners[0].positionX.value, 14, 'a spent clip stays put');
  assert.equal(e._far.length, 0, 'and is let go');
  assert.equal(e.play3d(349, [1, 0, 0], 1, { far: true }), 6, 'a far shot answers its duration as play3d always did (A3\'s busy clock)');
  // the storm overhead is DFU's AmbientEffectsPlayer, placed at PlaySomewhereOnHorizon's 3000 m minimum - untouched
  assert.match(rd('src/systems/ambientEffects.js'), /const d = this\.engine\.play3d\(index, pos, 1, \{ refDistance: minDistance, maxDistance: minDistance \* 8 \}\);/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    // EVERY thunder the host plays from a strike's side is held there from the ear - the distant storms' and (EVENT1,
    // world.js) the dread's alike: one pin per line, so a second thunder line cannot stand in for the first
    const thunder = rd(host).match(/audio\.play3d\(s\.clip, thunderSourceAt\([^)]*\), s\.volume, \{[^}]*\}\);/g) ?? [];
    assert.ok(thunder.length >= 1, host);
    for (const line of thunder) assert.match(line, /\{ refDistance: THUNDER_SOURCE_M, maxDistance: THUNDER_SOURCE_M \* 8, far: true \}\);$/, `${host}: ${line}`);
  }
});

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}

test('DISC17-C: the held map carries no weather - a host that still hands it one gets the bay alone: no regions inked, no weather in the kept ink\'s key, none in the hover', () => {
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  try {
    const minutes = 405 * 360 * 1440 + 100 * 1440 + 8 * 60;
    const win = new HeldMapWindow({
      getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => CLIMATES.Swamp,
      woods: { heightMapBuffer: new Uint8Array(100 * 60).fill(10) }, mapSize: { width: 100, height: 60 },
      gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
      weather: { on: () => true, minutes: () => minutes },   // what the host handed until DISC17-C
    });
    const sheet = win._worldSheet();
    assert.doesNotMatch(sheet.staticKey(), /wx\d|noweather/, 'the kept ink is keyed on the bay alone');
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, k) => (k === 'measureText' ? (t) => ({ width: t.length * 6 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...args) => calls.push([k, ...args])),
      set: () => true,
    });
    sheet.paintStatic(ctx, { model: win._ensureWorldModel(), view: { ox: 0, oy: 0, scale: 8 }, paperW: 800, paperH: 480, dpr: 1, band: 'near' });
    assert.ok(!calls.some((c) => c[0] === 'fill' && c[1] === 'nonzero'), 'no weather region laid on the bay');
    assert.equal(win._hoverLabel(0.5, 0.5)?.label, '', 'a bare pixel of sea names nothing - no weather, no forecast');
    for (const k of ['_weatherLayer', '_withWeather', '_paintWeather', '_drawWeatherUnder', '_stepWeather', '_readRestingForecast']) assert.equal(win[k], undefined, k);
    assert.equal('paintUnder' in sheet, false);
  } finally { delete globalThis.document; }
});

test('DISC17-C: the weather layer is gone from the tree - no module, no import, no host wiring, no sheet member; the sim keeps its own laws (mutants: the host hands the map its weather again)', () => {
  assert.equal(existsSync(new URL('../src/ui/weatherLayer.js', import.meta.url)), false);
  const map = rd('src/ui/heldMap.js');
  assert.doesNotMatch(map, /weatherLayer|weatherMap\.js|weatherSim\.js|forecast|deps\.weather/i);
  const world = rd('src/scenes/world.js');
  const build = world.slice(world.indexOf('function buildTravelMapWindow('), world.indexOf('function buildTravelMapWindow(') + 3000);
  assert.doesNotMatch(build, /weather:/, 'the map is handed no weather');
  assert.match(build, /getClimateIndex: \(x, yy\) => maps\.getClimateIndex\(x, yy\),/, 'and the climate lookup it had before the weather (the travel time\'s, the ink\'s)');
  assert.equal(SHEET_MEMBERS.includes('paintUnder'), false);
  for (const f of ['src/ui/townSheet.js', 'src/ui/automapSheet.js', 'src/ui/mapStrip.js']) assert.doesNotMatch(rd(f), /paintUnder/, f);
  // what the map read stays the sim's: the forecast law and the ground law are the weather map's own
  assert.match(rd('src/systems/weatherMap.js'), /export function forecastAt\(/);
  assert.match(rd('src/systems/weatherSim.js'), /export function mapGround\(climateAt\)/);
});
