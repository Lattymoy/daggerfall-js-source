// WEATHER3 slice E (2026-09-22): THE WEATHER ON THE MAP - the enhanced
// travel map inks the world weather map's systems over the bay, in the
// sheet's own hand, and the hover names the weather under the pointer and
// its forecast (ui/weatherLayer.js; ui/heldMap.js's world sheet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  weatherMarks, paintWeatherLayer, forecastText, weatherPhrase, mapOfField, fieldOfMapPixel, WEATHER_INK, WASH_ALPHA, INK_LEAN,
  WASH_RIM, GLYPH_MIN_ENV, GLYPH_MIN_PX, WEATHER_LAYER_REFRESH_MINUTES, WEATHER_FORECAST_HOURS, WEATHER_NAMES,
} from '../src/ui/weatherLayer.js';
import { forecastAt, PRIORITY } from '../src/systems/weatherMap.js';
import { pixelOfField } from '../src/systems/weatherField.js';
import { INK_RGB } from '../src/ui/inkMap.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;

/** A recording 2D context - every call with the styles in force; gradients record their stops. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k === 'createRadialGradient') return (...args) => { const g = { args, stops: [], addColorStop: (o, c) => g.stops.push([o, c]) }; calls.push({ fn: k, args, g }); return g; };
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

test('WEATHER3e: the map\'s frame - a field position lands on the pixel the field law says, and a pixel\'s centre goes back', () => {
  for (const [x, z] of [[1000, 2000], [409600.4, 12345], [819199, 409599]]) {
    const [mx, my] = mapOfField(x, z);
    const p = pixelOfField(x, z);
    assert.equal(Math.floor(mx), p.x); assert.equal(Math.floor(my), p.y);
  }
  const [fx, fz] = fieldOfMapPixel(12, 34);
  const [mx, my] = mapOfField(fx, fz);
  assert.ok(Math.abs(mx - 12.5) < 1e-9 && Math.abs(my - 34.5) < 1e-9, 'the pixel\'s centre');
});

const sys = (type, over = {}) => ({ id: `${type}:1`, type, x: 81920, z: 81920 * 3, env: 1, bands: [[8192, type], [16384, 'cloudy']], ...over });

test('WEATHER3e: THE MARKS - in map pixels, laid lowest priority first so the storm\'s heart is inked last, as the sky blends them', () => {
  const marks = weatherMarks([sys('thunder'), sys('cloudy', { bands: [[20000, 'cloudy']] }), sys('rain'), sys('fog', { bands: [[5000, 'fog']] })]);
  assert.deepEqual(marks.map((m) => m.type), ['cloudy', 'fog', 'rain', 'thunder']);
  const t = marks.at(-1);
  assert.deepEqual([t.x, t.y], mapOfField(81920, 81920 * 3));
  assert.deepEqual(t.bands, [[10, 'thunder'], [20, 'cloudy']], 'radii in map pixels');
  for (let i = 1; i < marks.length; i++) assert.ok(PRIORITY.indexOf(marks[i].type) <= PRIORITY.indexOf(marks[i - 1].type));
});

test('WEATHER3e: THE WASH - a soft-rimmed disc per band in its weather\'s pigment, heavier with the storm\'s strength, the pen\'s glyph only on a grown storm with room for it', () => {
  const view = { ox: 0, oy: 0, scale: 2 };
  const paint = (marks) => { const ctx = recordingCtx(); paintWeatherLayer(ctx, view, marks, { paperW: 400, paperH: 300 }); return ctx.calls; };
  const storm = { id: 's', type: 'thunder', x: 50, y: 50, env: 1, bands: [[8, 'thunder'], [14, 'rain'], [22, 'cloudy']] };
  const calls = paint([storm]);
  const grads = calls.filter((c) => c.fn === 'createRadialGradient');
  assert.equal(grads.length, 3, 'one wash a band');
  assert.deepEqual(grads.map((c) => c.args[5]), [44, 28, 16], 'outer band first, the heart last');
  grads.forEach((c, i) => {
    const rr = c.args[5];
    assert.ok(Math.abs(c.args[2] - rr * (1 - WASH_RIM)) < 1e-9, 'full over the inner part, thinning at the rim');
    const word = storm.bands[2 - i][1];
    assert.match(c.g.stops[0][1], new RegExp(`rgba\\(${WEATHER_INK[word].map(Math.round).join(', ')}, ${WASH_ALPHA[word]}\\)`), `${word}: its pigment at its full strength`);
    assert.match(c.g.stops[1][1], /, 0\)$/, 'nothing at the edge');
  });
  // WEATHER3g: every pigment leans INK_LEAN toward the pen (no channel brighter than white leaned that far), and each is
  // its own colour - no two weathers within a visible distance of each other
  for (const rgb of Object.values(WEATHER_INK)) for (let k = 0; k < 3; k++) assert.ok(rgb[k] <= 255 - (255 - INK_RGB[k]) * INK_LEAN + 1e-9, 'every pigment leans toward the pen');
  const inks = Object.entries(WEATHER_INK);
  for (let i = 0; i < inks.length; i++) for (let j = i + 1; j < inks.length; j++) {
    const d = Math.hypot(...inks[i][1].map((v, k) => v - inks[j][1][k]));
    assert.ok(d > 30, `${inks[i][0]} and ${inks[j][0]} are told apart (${d.toFixed(0)})`);
  }
  assert.ok(calls.some((c) => c.fn === 'stroke'), 'the grown storm is signed');
  // a young storm: a lighter wash, no glyph
  const young = paint([{ ...storm, env: GLYPH_MIN_ENV - 0.1 }]);
  const a = (cs) => Number(/, ([\d.]+)\)$/.exec(cs.find((c) => c.fn === 'createRadialGradient').g.stops[0][1])[1]);
  assert.ok(a(young) < a(calls));
  assert.ok(!young.some((c) => c.fn === 'stroke'), 'a storm being born carries no mark yet');
  // too small on the paper for a glyph
  const tiny = paint([{ ...storm, bands: [[(GLYPH_MIN_PX - 1) / 2, 'thunder'], [14, 'rain']] }]);
  assert.ok(!tiny.some((c) => c.fn === 'stroke'));
  // off the paper: nothing
  assert.deepEqual(paint([{ ...storm, x: 1000, y: 50 }]), [{ fn: 'setTransform', args: [1, 0, 0, 1, 0, 0], strokeStyle: undefined, fillStyle: undefined, lineWidth: undefined }]);
  // a cloud field is washed, never signed
  assert.ok(!paint([{ id: 'c', type: 'cloudy', x: 50, y: 50, env: 1, bands: [[30, 'cloudy']] }]).some((c) => c.fn === 'stroke'));
});

test('WEATHER3e: THE FORECAST IN WORDS - the weather now, and when it next changes and to what', () => {
  const f = (now, next) => ({ at: 1000, now, steps: [], next });
  assert.equal(forecastText(f({ word: 'rain', intensity: 0.9 }, { at: 1180, word: 'sunny' })), 'Rain, heavy - clearing in about 3 hours');
  assert.equal(forecastText(f({ word: 'rain', intensity: 0.5 }, { at: 1160, word: 'overcast' })), 'Rain - overcast in about 3 hours', 'two hours forty is about three');
  assert.equal(forecastText(f({ word: 'sunny', intensity: 0 }, { at: 1030, word: 'rain' })), 'Clear skies - rain in under an hour');
  assert.equal(forecastText(f({ word: 'overcast', intensity: 0.5 }, { at: 1070, word: 'thunder' })), 'Overcast - thunderstorm in about an hour');
  assert.equal(forecastText(f({ word: 'fog', intensity: 1 }, null)), `Fog - no change for the next ${WEATHER_FORECAST_HOURS} hours`);
  assert.equal(weatherPhrase('snow', 0.2), 'Snow, light');
  assert.equal(weatherPhrase('rain', 0.5), 'Rain');
  assert.equal(weatherPhrase('cloudy', 1), 'Cloudy', 'only what falls has a strength');
  for (const w of [...PRIORITY, 'sunny']) assert.ok(WEATHER_NAMES[w], `${w} has a name`);
});

// ── the sheet ────────────────────────────────────────────────────────

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
function withDocument(fn) {
  globalThis.document = fakeDocument();
  try { return fn(); } finally { delete globalThis.document; }
}
const clock = { m: YEAR + 100 * 1440 + 8 * 60 };
const winDeps = (extra = {}) => ({
  getPlayerPixel: () => ({ x: 5, y: 5 }),
  getClimateIndex: () => CLIMATES.Swamp,
  woods: { heightMapBuffer: new Uint8Array(100 * 60).fill(10) },
  mapSize: { width: 100, height: 60 },
  gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
  weather: { on: () => true, minutes: () => clock.m },
  ...extra,
});

test('WEATHER3e: THE SHEET reads the whole bay once a refresh, keys its kept layer on it, and inks it under the marks', () => {
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  withDocument(() => {
    const win = new HeldMapWindow(winDeps());
    const wx = win._weatherLayer();
    assert.ok(wx && wx.marks.length > 0, 'the systems over a 100 x 60 bay');
    const reach = Math.hypot(100, 60) / 2;
    for (const m of wx.marks) assert.ok(Math.hypot(m.x - 50, m.y - 30) <= reach + m.bands.at(-1)[0] + 1e-6, `${m.id} stands over THIS sheet, whatever its height (the field's y runs from the bay's south edge)`);
    assert.equal(win._weatherLayer(), wx, 'read once a refresh, not once a frame');
    const sheet = win._worldSheet();
    const key0 = sheet.staticKey();
    assert.match(key0, new RegExp(`wx${Math.floor(clock.m / WEATHER_LAYER_REFRESH_MINUTES)}$`));
    clock.m += WEATHER_LAYER_REFRESH_MINUTES;
    assert.notEqual(win._weatherLayer(), wx, 'the next refresh reads the map again');
    assert.notEqual(sheet.staticKey(), key0, 'and the kept layer is stale');
    // painted with the static ink
    const ctx = recordingCtx();
    sheet.paintStatic(ctx, { model: win._ensureWorldModel(), view: { ox: 0, oy: 0, scale: 8 }, paperW: 800, paperH: 480, dpr: 1, band: 'near' });
    assert.ok(ctx.calls.some((c) => c.fn === 'createRadialGradient'), 'the weather washed over the bay');
    // no weather to read: the bay alone
    const off = new HeldMapWindow(winDeps({ weather: { on: () => false, minutes: () => clock.m } }));
    assert.equal(off._weatherLayer(), null);
    assert.match(off._worldSheet().staticKey(), /noweather$/);
    const ctx2 = recordingCtx();
    off._worldSheet().paintStatic(ctx2, { model: off._ensureWorldModel(), view: { ox: 0, oy: 0, scale: 8 }, paperW: 800, paperH: 480, dpr: 1, band: 'near' });
    assert.ok(!ctx2.calls.some((c) => c.fn === 'createRadialGradient'));
    assert.equal(new HeldMapWindow(winDeps({ weather: undefined }))._weatherLayer(), null, 'a host that hands no weather');
  });
});

test('WEATHER3e: THE HOVER - the place\'s label and the weather there with its forecast, read off the same law; the label alone with no weather', () => {
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  withDocument(() => {
    const win = new HeldMapWindow(winDeps());
    const [fx, fz] = fieldOfMapPixel(40, 30);
    const want = forecastText(forecastAt(fx, fz, clock.m, () => CLIMATES.Swamp, { hours: WEATHER_FORECAST_HOURS, step: 30 }));
    assert.equal(win._withWeather('Wrothgarian Mountains', 40, 30), `Wrothgarian Mountains · ${want}`);
    assert.equal(win._withWeather('', 40, 30), want, 'the sea or a nameless pixel: the weather alone');
    assert.equal(win._weatherLayer().forecasts.get('40,30'), want, 'read once a pixel a refresh');
    const off = new HeldMapWindow(winDeps({ weather: { on: () => false, minutes: () => clock.m } }));
    assert.equal(off._withWeather('Daggerfall : Daggerfall', 40, 30), 'Daggerfall : Daggerfall');
  });
  // both hover arms carry it
  const src = rd('src/ui/heldMap.js');
  assert.match(src, /label: this\._withWeather\(region && name \? `\$\{region\} : \$\{name\}` : name, Math\.floor\(m\.x\), Math\.floor\(m\.y\)\)/, 'a place');
  assert.match(src, /label: this\._withWeather\(\(region >= 0 && region < \(this\.deps\.maps\?\.regionCount \?\? 0\)\) \? \(REGION_NAMES\[region\] \?\? ''\) : '', px, py\)/, 'a bare pixel');
});

test('WEATHER3e: the host hands the map its weather - on the map\'s lane and never under a pin, at its own clock', () => {
  assert.match(rd('src/scenes/world.js'), /weather: \{ on: \(\) => !weatherOverride && weatherMapOn\(\), minutes: \(\) => playerTicker\.classicMinutes \},/);
});
