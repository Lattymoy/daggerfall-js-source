// MAP-LAG (2026-09-23, Mac: "the enhanced map now is very laggy after we introduced the weather changes"). The held
// map's weather cost, measured in Chromium over a 1000 x 500 bay (bible/01-Overview/Field-Bugs-2026-09-23.md,
// MAP-LAG): the regions inked again on every pan and zoom frame (30-76 ms a zoom frame, 11-48 a pan zoomed in), a
// forecast read on every pointer move (17 ms), and the bay's field and regions read again at every open (a new window
// each time). Pinned here by execution through the real window, on canvases that record what is drawn on them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { HeldMapWindow } from '../src/ui/heldMap.js';
import { SHEET_MEMBERS } from '../src/ui/mapStrip.js';
import {
  weatherField, weatherFieldJob, fieldRegions, fieldRegionOf, fieldStrength, fieldStepOf, fallsAt, FIELD_WORDS,
  paintWeatherRegions, weatherStrokes, weatherPhrase, hatchPattern, fieldOfMapPixel, WEATHER_LAYER_REFRESH_MINUTES,
} from '../src/ui/weatherLayer.js';
import { systemsNear, forecastAt } from '../src/systems/weatherMap.js';
import { mapGround } from '../src/systems/weatherSim.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = 405 * 360 * 1440;

/** A context that records every call - with the alpha, the composite and the fill it was made under - and whose
 *  patterns record the matrices laid on them. */
function recordingContext(canvas) {
  const calls = [];
  const state = { globalAlpha: 1, globalCompositeOperation: 'source-over' };
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'canvas') return canvas;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (typeof k === 'string' && k.startsWith('create')) {
        return (...args) => { const p = { kind: k, args, transforms: [], setTransform(m) { p.transforms.push(m); }, addColorStop() {} }; return p; };
      }
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, alpha: state.globalAlpha, op: state.globalCompositeOperation, fillStyle: state.fillStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
/** A document whose every element can be a canvas. */
function canvasDocument() {
  const node = () => {
    let ctx = null;
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener(t, fn) { (n.listeners ||= []).push([t, fn]); }, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
      width: 0, height: 0,
      getContext: () => (ctx ??= recordingContext(n)),
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withCanvases(fn) {
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = canvasDocument();
  try { return fn(); } finally { delete globalThis.document; }
}
const fire = (node, type, ev) => { for (const [t, fn] of node.listeners ?? []) if (t === type) fn(ev); };

/** A 100 x 60 swamp in spring: rain and storm over it (WEATHER3e's own fixture). */
const mkWin = (clock, climateAt = () => CLIMATES.Swamp) => new HeldMapWindow({
  getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: climateAt,
  woods: { heightMapBuffer: new Uint8Array(100 * 60).fill(10) }, mapSize: { width: 100, height: 60 },
  gold: () => 10000, goldPieces: () => 10000, hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
  weather: { on: () => true, minutes: () => clock.m },
});
const open = (win) => { for (let i = 0; i < 20; i++) win.tick(0.05); return win; };
const settle = (win, s = 1) => { for (let t = 0; t < s; t += 1 / 60) win.tick(1 / 60); };
/** The regions' fills on a context: WEATHER3h's `fill('nonzero')` - the pen's own fills take no argument. */
const regionFills = (ctx) => ctx.calls.filter((c) => c.fn === 'fill' && c.args[0] === 'nonzero').length;

test('MAP-LAG: a pan or a zoom inks no weather - the kept raster is moved or stretched, and inked again crisp once the view holds still (mutants: the raster inked every frame; the settle never inks; the regions back in the static ink)', () => {
  withCanvases(() => {
    const clock = { m: YEAR + 100 * 1440 + 8 * 60 };
    const win = open(mkWin(clock));
    win._setView({ ox: 20, oy: 10, scale: win._view.scale * 1.2 });   // a little in from the fit, so it can pan and zoom
    settle(win, 2);
    const r0 = win._wxr;
    assert.ok(r0 && r0.scale === win._view.scale, 'the raster, inked at the sheet\'s view');
    const [a, b] = win._wxCanvases;
    const inked = () => regionFills(a.getContext('2d')) + regionFills(b.getContext('2d'));
    const frame = win._chrome.ink.getContext('2d');
    const n0 = inked();
    assert.ok(n0 > 0, 'the regions are inked into the raster');
    assert.equal(regionFills(win._layer.getContext('2d')), 0, 'and never into the kept ink: the pen lies over them');
    const laid = () => frame.calls.filter((c) => c.fn === 'drawImage' && (c.args[0] === a || c.args[0] === b)).at(-1);
    const layer = () => frame.calls.filter((c) => c.fn === 'drawImage').at(-1);

    // a pan inside the margin: the raster moves by whole device pixels, unstretched
    const v = { ...win._view };
    win._setView({ ox: v.ox + 1.3, oy: v.oy + 0.7, scale: v.scale });
    win.tick(1 / 60);
    assert.equal(inked(), n0, 'a pan frame inks no weather');
    const pan = laid();
    assert.ok(Number.isInteger(pan.args[1]) && Number.isInteger(pan.args[2]), 'moved by whole device pixels, so the hairlines stay sharp');
    assert.deepEqual([pan.args[3], pan.args[4]], [r0.canvas.width, r0.canvas.height], 'and not stretched');
    assert.equal(layer().args[0], win._layer, 'the kept ink is laid over it');
    assert.equal(win._wxr.stale, false, 'inside the margin, the raster still shows this view crisp');

    // a zoom: stretched, and nothing inked until the view holds still
    win._setView({ ox: v.ox, oy: v.oy, scale: v.scale * 1.25 });
    win.tick(1 / 60);
    assert.equal(inked(), n0, 'a zoom frame inks no weather');
    const zoom = laid(), k = win._view.scale / r0.scale;
    assert.ok(k > 1.2, `zoomed in (${k})`);
    assert.ok(Math.abs(zoom.args[3] - r0.canvas.width * k) < 1e-6, 'the raster stretched to the new scale');
    assert.equal(win._wxr.stale, true);
    for (let i = 0; i < 5; i++) { win._setView({ ox: v.ox, oy: v.oy, scale: v.scale * (1.25 + i / 20) }); win.tick(1 / 60); }
    assert.equal(inked(), n0, 'still moving: still nothing inked');
    settle(win, 2);
    assert.ok(inked() > n0, 'held still, it is inked again');
    assert.equal(win._wxr.scale, win._view.scale, 'crisp at the scale it came to rest at');
    assert.notEqual(win._wxr.canvas, r0.canvas, 'into the canvas that was not being laid');
    assert.equal(win._wxr.stale, false);
    win.dispose();
  });
});

test('MAP-LAG: the weather\'s first read is a job - the sheet opens at once and the regions are laid when inked, faded in; a job never holds a frame for all of it (mutants: the job run whole in one frame; no fade)', () => {
  withCanvases(() => {
    const clock = { m: YEAR + 101 * 1440 + 9 * 60 };
    const win = mkWin(clock, () => CLIMATES.Swamp);
    win.tick(0.05);
    assert.ok(win._wxJob && !win._wxr, 'the first paint asked for the weather, and laid none it had not read');
    assert.equal(win._wxJob.stage, 'field');
    // one step a call: the field a few rows, a word's loops, a stroke
    let steps = 0;
    while (win._wxJob && steps < 5000) { win._stepWeather(0); steps++; }
    assert.ok(steps > 10, `the job took ${steps} steps, one a call - not the whole bay in one`);
    assert.ok(win._wxr && win._weatherLayer().regions, 'and laid the raster, the regions kept with the refresh');
    assert.equal(win._wxr.fadeFrom, win._clock, 'the sheet\'s first weather comes up');
    win._paint();
    const frame = win._chrome.ink.getContext('2d');
    const first = frame.calls.filter((c) => c.fn === 'drawImage' && c.args[0] === win._wxr.canvas).at(-1);
    assert.equal(first.alpha, 0, 'from nothing');
    settle(win, 0.5);
    const later = frame.calls.filter((c) => c.fn === 'drawImage' && c.args[0] === win._wxr.canvas).at(-1);
    assert.equal(later.alpha, 1, 'to whole');
    // a raster that replaces one already laid swaps, whole: it is the same picture
    win._setView({ ox: 10, oy: 5, scale: win._view.scale * 2 });
    settle(win, 2);
    assert.equal(win._wxr.fadeFrom, null);
    win.dispose();
  });
});

test('MAP-LAG: the clock\'s next ten minutes - the last raster stands until the new refresh\'s is inked, so the weather never goes out under the sheet', () => {
  withCanvases(() => {
    const clock = { m: YEAR + 102 * 1440 + 10 * 60 };
    const win = open(mkWin(clock));
    settle(win, 2);
    const old = win._wxr;
    assert.ok(old);
    clock.m += WEATHER_LAYER_REFRESH_MINUTES;
    win._dirty = true; win.tick(1 / 60);
    const frame = win._chrome.ink.getContext('2d');
    assert.equal(frame.calls.filter((c) => c.fn === 'drawImage' && c.args[0] === old.canvas).at(-1)?.alpha, 1, 'the old raster is laid while the new is read');
    assert.equal(win._wxJob?.key, win._weatherLayer().key, 'and the new refresh\'s job is under way');
    settle(win, 2);
    assert.equal(win._wxr.key, win._weatherLayer().key, 'then the new one is laid');
    assert.equal(win._wxr.fadeFrom, null, 'swapped, not faded: the weather moved a quarter of a pixel');
    win.dispose();
  });
});

test('MAP-LAG: the hover names the weather at once and reads the forecast only once the pointer rests on the pixel; a press is not a rest (mutants: the forecast read on every move; the rest timer reset by a move within the pixel)', () => {
  withCanvases(() => {
    const clock = { m: YEAR + 100 * 1440 + 8 * 60 };
    const climate = () => CLIMATES.Swamp;
    const win = open(mkWin(clock, climate));
    const wx = win._weatherLayer();
    wx.forecasts.clear(); wx.nows.clear();
    const v = win._view;
    const paperOf = (px, py) => [(px + 0.5 - v.ox) * v.scale, (py + 0.5 - v.oy) * v.scale];
    // the pointer crossing the sheet: no forecast on any of it
    for (let px = 30; px < 50; px++) win._writeHover(...paperOf(px, 30));
    assert.equal(wx.forecasts.size, 0, 'no forecast read on the move');
    const [fx, fz] = fieldOfMapPixel(49, 30);
    const f = forecastAt(fx, fz, wx.minutes, climate, { hours: 12, step: 30, ground: wx.ground });
    assert.ok(win._chrome.label.textContent.endsWith(weatherPhrase(f.now.word, f.now.intensity)), 'the weather there, named at once');
    // at rest - moves inside the pixel do not restart the wait
    win.tick(0.1);
    win._writeHover(paperOf(49, 30)[0] + 0.2, paperOf(49, 30)[1]);
    win.tick(0.06);
    assert.equal(wx.forecasts.size, 1, 'resting on it, its forecast is read');
    assert.ok(win._chrome.label.textContent.endsWith(wx.forecasts.get('49,30')), 'and written into the label under the pointer');
    // a press starts a drag, and a drag is not a rest
    win._writeHover(...paperOf(20, 20));
    fire(win._chrome.stage, 'pointerdown', { button: 0, pointerId: 3, clientX: 0, clientY: 0 });
    win.tick(0.5);
    assert.equal(wx.forecasts.has('20,20'), false);
    fire(win._chrome.stage, 'pointercancel', { pointerId: 3 });
    // ...but a click that did not drag leaves the pointer resting where it is
    const at = paperOf(25, 20);
    fire(win._chrome.stage, 'pointerdown', { button: 0, pointerId: 4, clientX: at[0], clientY: at[1] });
    fire(win._chrome.stage, 'pointerup', { button: 0, pointerId: 4, clientX: at[0], clientY: at[1] });
    win.tick(0.2);
    assert.equal(wx.forecasts.has('25,20'), true, 'the click\'s pixel gets its forecast');
    win.dispose();
  });
});

test('MAP-LAG: a sheet opened inside the same refresh finds the bay read - its regions and forecasts with it - for the host\'s lookup; another refresh or lookup reads its own (mutants: no shared read)', () => {
  withCanvases(() => {
    const clock = { m: YEAR + 103 * 1440 + 11 * 60 };
    const look = () => CLIMATES.Swamp;
    const one = mkWin(clock, look), two = mkWin(clock, look);
    const read = one._weatherLayer();
    assert.equal(two._weatherLayer(), read, 'the same read, whole');
    assert.notEqual(mkWin(clock, () => CLIMATES.Swamp)._weatherLayer(), read, 'another lookup reads its own');
    clock.m += WEATHER_LAYER_REFRESH_MINUTES;
    assert.notEqual(mkWin(clock, look)._weatherLayer(), read, 'and the clock\'s next ten minutes are read again');
  });
});

test('MAP-LAG: the slices are the whole - the field row for row, the regions word for word, the strokes in order (mutants: a step that skips a row; the steps out of order)', () => {
  const m = YEAR + 170 * 1440 + 15 * 60, climate = () => CLIMATES.Swamp, ground = mapGround(climate);
  const [cx, cz] = fieldOfMapPixel(49.5, 29.5);
  const systems = systemsNear(cx, cz, m, climate, Math.hypot(100, 60) * TERRAIN_SIZE / 2);
  const opts = { width: 100, height: 60, ground: (w, x, z) => ground(w, x, z, m) };
  const whole = weatherField(systems, opts);
  const job = weatherFieldJob(systems, opts);
  let calls = 0;
  while (!job.step(3)) calls++;
  assert.ok(calls >= 9, 'thirty rows, three a step');
  assert.deepEqual(job.field, whole, 'the same field');
  const words = [...new Set(whole.words)];
  assert.ok(words.some(fallsAt), 'something falls over the fixture');
  assert.deepEqual(Object.fromEntries(words.filter((i) => i).map((i) => [FIELD_WORDS[i], fieldRegionOf(whole, i)])), fieldRegions(whole));
  assert.deepEqual(Object.fromEntries(words.filter(fallsAt).map((i) => [FIELD_WORDS[i], [1, 2].map((k) => fieldStepOf(whole, i, k))])), fieldStrength(whole));
  const a = recordingContext({}), b = recordingContext({});
  const view = { ox: 3, oy: 2, scale: 6 }, o = { paperW: 500, paperH: 300, dpr: 1, strength: fieldStrength(whole), under: true };
  paintWeatherRegions(a, view, fieldRegions(whole), o);
  const strokes = weatherStrokes(b, view, fieldRegions(whole), o);
  for (const s of strokes) s();
  assert.ok(strokes.length > 2);
  assert.deepEqual(b.calls.map((c) => c.fn), a.calls.map((c) => c.fn), 'stroke for stroke');
});

test('MAP-LAG: the hatch is laid from the map\'s corner, on a whole device pixel - a moved raster and a fresh one agree, and no tile is resampled', () => {
  const had = globalThis.DOMMatrix;
  globalThis.DOMMatrix = class { constructor(m) { this.m = m; } };
  try {
    const ctx = recordingContext({});
    const loop = { pts: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 1 }], box: [1, 1, 5, 5] };
    const tileDoc = { createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext({}) }) };
    const had2 = globalThis.document; globalThis.document = tileDoc;
    let pat = null;
    try {
      paintWeatherRegions(ctx, { ox: 3.3, oy: 1.7, scale: 2 }, { rain: [loop] }, { paperW: 100, paperH: 100, dpr: 2 });
      pat = hatchPattern(ctx, 'rain');   // the one it filled with: patterns are made once and kept
    } finally { if (had2) globalThis.document = had2; else delete globalThis.document; }
    assert.ok(pat?.transforms?.length, 'the pattern is laid by a matrix');
    assert.deepEqual(pat.transforms.at(-1).m, [1, 0, 0, 1, Math.round(-3.3 * 2 * 2) / 2, Math.round(-1.7 * 2 * 2) / 2], 'from the map\'s corner, on a whole device pixel');
  } finally { if (had) globalThis.DOMMatrix = had; else delete globalThis.DOMMatrix; }
});

test('MAP-LAG: the sheet contract carries what lies under the ink - every sheet answers it, and the window asks the live one, never which it is', () => {
  assert.ok(SHEET_MEMBERS.includes('paintUnder'));
  for (const f of ['src/ui/townSheet.js', 'src/ui/automapSheet.js']) assert.match(rd(f), /paintUnder\(\) \{ \/\* nothing lies under the plan's ink \*\/ \},/);
  const src = rd('src/ui/heldMap.js');
  assert.match(src, /if \(env\.underlay\) sheet\.paintUnder\(ctx, env\);/);
  assert.match(src, /paintUnder: \(ctx, env\) => this\._drawWeatherUnder\(ctx, env\),/);
  assert.match(src, /if \(wx\) this\._paintWeather\(ctx, env, wx, \{ regions: !env\.underlay \}\);/, 'the static ink leaves the regions out only where the raster lays them');
});
