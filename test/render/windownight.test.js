// WINDOW-NIGHT (FIELD FEEDBACK 2026-10-31, Discord #feature-feedback, a player: "It gets way to bright at night for me. I
// still want to see outside but not be blasted by the light"): the windows' light by night - the moon's gain and the
// panes' night glow held against a room's own ambient on both lanes, and the Window light part (On, Day only, Off) read
// where the frame's kind is decided, the view out and the street's rooms standing under each.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  WindowLightPass, windowAperturesOf, wlKindFor, wlSunUp, WL_SUN_GAIN, WL_MOON_GAIN, WL_SKY_GAIN, WL_SKY_NIGHT_GAIN,
} from '../../src/render/windowLight.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { windowEmissionRGB } from '../../src/render/windowEmission.js';
import { realWindowsMode, windowLightMode, createViewOut, viewOutFrame } from '../../src/render/realWindows.js';
import { skyState, moonlightTerm, withMoonAmbient } from '../../src/render/enhancedSky.js';
import { elDecode3 } from '../../src/render/enhancedLighting.js';
import { exteriorAmbient } from '../../src/world/worldClock.js';
import { INTERIOR_NIGHT_AMBIENT } from '../../src/world/interior/interiorLights.js';
import { FEATURES, FEATURE_PREF_DEFAULTS, FEATURE_PREF_ONLINE } from '../../src/systems/features.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';
import { perspective, lookAt, identity } from '../../src/world/mat4.js';

const I = identity();
const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** A recording GL (wl1_windowlight.test.js's): programs link, a uniform block has index 0, every other call logged. */
function recordingGl(log) {
  let id = 0;
  return new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getUniformBlockIndex') return () => 0;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (k === 'TEXTURE0') return 33984;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
}
const recordingRenderer = (log = []) => new Renderer({ getContext: () => recordingGl(log), clientWidth: 640, clientHeight: 400, width: 640, height: 400 });

/** A room's east wall at x = 3, its glass facing into the room (-x), one picture of glass over it (W7's room). */
function eastRoom() {
  const pass = new WindowLightPass(recordingGl([]), { activeTexture: () => {} });
  const colors = new Uint8ClampedArray(16 * 16 * 4).fill(255);
  pass.addMask('4002_0', { width: 16, height: 16, colors });
  const P = new Float32Array([3, 0, -3, 3, 0, 3, 3, 3, 3, 3, 3, -3]);
  const N = new Float32Array([-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0]);
  const UV = new Float32Array([0, 0, 2, 0, 2, 1, 0, 1]);
  const set = windowAperturesOf(P, N, UV, new Uint32Array([0, 1, 2, 0, 2, 3]), 0, 6);
  pass.note({ wl: [{ key: '4002_0', ap: set.recs, cells: set.cells }] }, I, null, 'inside', 1000);
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 1.6, 0], [3, 1.6, 0], [0, 1, 0]);
  const frame = (decode = null) => pass.frame({ kind: 'inside', eye: [0, 1.6, 0], view, proj, now: 1100, shadows: true, glass: () => 'glass', decode });
  return { pass, frame };
}

/** The outside a building's glass sees at minute `m` under a full Masser (the producer's sky and moon), for setOutside. */
function fullMoonOutside(m) {
  const term = moonlightTerm(skyState({ minuteOfDay: m, phases: { masser: 4, secunda: 4 } }));
  const sky = withMoonAmbient(exteriorAmbient(m), term);
  return { term, o: { at: 1000, sunDir: [0, -1, 0], sunColor: [1, 1, 1], sunScale: 0, moonDir: [...term.dir], moonColor: [...term.color], moonScale: term.scale, sky: [sky[0], sky[1], sky[2]] } };
}

test('WINDOW-NIGHT WN1: THE NIGHT\'S GAINS - the moon well under the sun, the panes\' glow by night a fifth of the day\'s; the pass writes the moon at its gain and the sky\'s glow at the night\'s, the day\'s glow kept (mutants: the old gains, the night glow at the day\'s)', () => {
  assert.equal(WL_MOON_GAIN, 0.3);
  assert.equal(WL_SKY_NIGHT_GAIN, 0.1);
  assert.deepEqual([WL_SUN_GAIN, WL_SKY_GAIN], [0.9, 0.5], 'the day is unchanged');
  assert.ok(WL_MOON_GAIN <= WL_SUN_GAIN / 3, 'the moon well under the sun');
  const { pass, frame } = eastRoom();
  const sky = [0.3, 0.3, 0.32];
  pass.setOutside({ at: 1000, sunDir: [0.8, -0.5, 0.1], sunColor: [1, 1, 1], sunScale: 0, moonDir: [0.7, 0.7, 0], moonColor: [0.5, 0.6, 0.8], moonScale: 0.4, sky });
  assert.equal(frame(), 2, 'both panes, by the moon');
  const d = pass.data;
  assert.ok(near(d[20], 0.5 * 0.4 * WL_MOON_GAIN) && near(d[22], 0.8 * 0.4 * WL_MOON_GAIN), 'the moon at its scale and gain');
  assert.ok(near(d[24], sky[0] * WL_SKY_NIGHT_GAIN) && near(d[26], sky[2] * WL_SKY_NIGHT_GAIN), 'the sky\'s glow at the night\'s gain');
  pass.setOutside({ at: 1000, sunDir: [-0.8, 0.5, 0.1], sunColor: [1, 1, 1], sunScale: 0.9, moonDir: [0.7, 0.7, 0], moonColor: [1, 1, 1], moonScale: 0, sky });
  assert.equal(frame(), 2, 'by day, the sun behind the room');
  assert.ok(near(d[24], sky[0] * WL_SKY_GAIN), 'the day\'s glow');
  pass.setOutside({ at: 1000, sunDir: [0.8, -0.5, 0.1], sunColor: [1, 1, 1], sunScale: 0, moonDir: [0.7, 0.7, 0], moonColor: [1, 1, 1], moonScale: 0, sky });
  assert.equal(frame(), 2, 'no moon: the glow alone');
  assert.ok(near(d[24], sky[0] * WL_SKY_NIGHT_GAIN), 'a moonless night glows at the night\'s gain');
});

test('WINDOW-NIGHT WN2: A MOONLIT ROOM IS A DIM PATCH, NOT A WASH - a full Masser at 21:00 through a pane facing it, the beam and the glow as the pass writes them (on each lane\'s decode) against the room\'s own night ambient: on the Enhanced lane about once the ambient (it was four times), on the classic set under half (it was one and a half) (mutants: the old gains)', () => {
  const { term, o } = fullMoonOutside(21 * 60);
  assert.ok(term.scale > 0.2 && term.dir[0] > 0.6, 'a full Masser low in the east');
  for (const [lane, decode, max, min] of [['Enhanced', (c) => elDecode3(c, [0, 0, 0]), 1.25, 0.5], ['classic', null, 0.5, 0.15]]) {
    const { pass, frame } = eastRoom();
    pass.setOutside(o);
    assert.equal(frame(decode), 2, `${lane}: both panes`);
    const d = pass.data;
    const patch = [d[20] + d[24], d[21] + d[25], d[22] + d[26]];   // the beam where it lands square, and the glow at the glass
    const room = decode ? decode(INTERIOR_NIGHT_AMBIENT) : INTERIOR_NIGHT_AMBIENT;
    const k = lum(patch) / lum(room);
    assert.ok(k <= max && k >= min, `${lane}: the moonlit patch adds ${k.toFixed(2)} of the room's ambient - between ${min} and ${max}`);
  }
});

test('WINDOW-NIGHT WN3: THE LAW OF THE PART - On lights as ever, Off none at any hour, Day only none while the sun is down and never a street\'s lamp (a lit room\'s, by night); the sun\'s test is the frame\'s own (mutants: Off ignored, Day only ignored, the street kept under Day only, the sun always up)', () => {
  for (const kind of ['street', 'inside']) {
    assert.equal(wlKindFor(kind, 'on', false), kind, `On: ${kind} by night`);
    assert.equal(wlKindFor(kind, 'on', true), kind, `On: ${kind} by day`);
    assert.equal(wlKindFor(kind, 'off', true), null, `Off: no ${kind} by day`);
    assert.equal(wlKindFor(kind, 'off', false), null, `Off: no ${kind} by night`);
    assert.equal(wlKindFor(kind, 'day', false), null, `Day only: no ${kind} by night`);
  }
  assert.equal(wlKindFor('inside', 'day', true), 'inside', 'Day only: the sun through the glass by day');
  assert.equal(wlKindFor('street', 'day', true), null, 'Day only: a street\'s light is the night\'s');
  assert.equal(wlKindFor(null, 'on', true), null, 'no frame of window light stays none');
  assert.equal(wlSunUp({ sunScale: 0.9, sunDir: [0.8, 0.5, 0.1] }), true);
  assert.equal(wlSunUp({ sunScale: 0, sunDir: [0.8, 0.5, 0.1] }), false, 'no sun to speak of');
  assert.equal(wlSunUp({ sunScale: 0.9, sunDir: [0.8, 0.04, 0.1] }), false, 'on the horizon: down');
  assert.equal(wlSunUp(null), false, 'no outside read');
});

test('WINDOW-NIGHT WN4: THE PART, READ WHERE THE KIND IS DECIDED - the renderer\'s frame by the pref: under Off no street and no building lights at any hour, nor the view out\'s street; under Day only a building lights by day off the outside its glass last read and not by night, and no street; the rooms behind the glass stand under each (mutants: the part unread, the view out\'s street lit under it, Day only blind to the sun)', () => {
  const was = getPref('windowLight');
  const r = recordingRenderer();
  r.setLighting(new Float32Array([0.2, 0.18, 0.2]), 0, new Float32Array([1, 1, 1]));
  const day = { setup: (rr) => { rr.setLighting(new Float32Array([0.8, 0.8, 0.9]), 0.9, new Float32Array([1, 0.95, 0.85])); return new Float32Array([0.8, 0.45, 0.1]); }, draw: () => {} };
  const night = { setup: (rr) => { rr.setLighting(new Float32Array([0.3, 0.3, 0.3]), 0, new Float32Array([1, 1, 1])); rr.setMoonlight({ scale: 0.22, dir: [0.7, 0.7, 0], color: [0.83, 0.6, 0.53] }); return null; }, draw: () => {} };
  const street = () => { r.setWindowRooms('full'); r.setWindowEmission(windowEmissionRGB('night')); return r._wlKindOf({ world: true }); };
  let at = 10000;
  const inside = (scene) => { r.setWindowEmission(windowEmissionRGB('disabled')); r.captureOutsideLight(scene, at += 1000, 'full'); return r._wlKindOf({ world: true }); };
  const viewOut = () => { r._rwOutside = {}; try { return r._wlKindOf({ world: true }); } finally { r._rwOutside = null; } };
  try {
    setPref('windowLight', 'on');
    assert.deepEqual([windowLightMode(), street(), inside(day), inside(night), viewOut()], ['on', 'street', 'inside', 'inside', 'street'], 'On: as WL1 lit it');
    setPref('windowLight', 'off');
    assert.deepEqual([windowLightMode(), street(), inside(day), inside(night), viewOut()], ['off', null, null, null, null], 'Off: none at any hour');
    assert.equal(r._rw?.rooms ?? true, true, 'Off: the street\'s rooms still drawn');
    setPref('windowLight', 'day');
    assert.deepEqual([windowLightMode(), street(), inside(day), inside(night), viewOut()], ['day', null, 'inside', null, null], 'Day only: a building by day alone');
    assert.equal(inside(day), 'inside', 'and again when the sun is up');
    setPref('windowLight', 'bright');
    assert.equal(windowLightMode(), 'on', 'a word the part does not know is On');
    // a whole interior frame at night under Day only: no kind, no lights, no window sun's map asked
    setPref('windowLight', 'day');
    inside(night);
    r.beginFrame(perspective(1.1, 1.6, 0.1, 500), lookAt([0, 1.6, 0], [3, 1.6, 0], [0, 1, 0]), new Float32Array([0, 1, 0]), WORLD_FRAME);
    assert.deepEqual([r._wlKind, r._wlLive, r._wlSun], [null, false, null], 'a night frame under Day only lights nothing');
  } finally { setPref('windowLight', was); }
});

test('WINDOW-NIGHT WN5: THE VIEW OUT STANDS - under Off and Day only the Real windows row\'s word is unchanged and a building\'s glass still draws the street through it; the part is read by the renderer and no host (mutants: the view out tied to the part)', () => {
  const was = getPref('windowLight');
  try {
    for (const light of ['off', 'day', 'on']) {
      setPref('windowLight', light);
      assert.equal(realWindowsMode('?skin=enhanced'), 'full', `${light}: the row stands at Full`);
      const drawn = [];
      const renderer = { takeGlassRect: () => ({ rect: [0.2, 0.2, 0.6, 0.6], holes: false }), outsideViewFrame: (...a) => { drawn.push(a); return true; }, captureOutsideLight: () => {} };
      const out = viewOutFrame(createViewOut(), { renderer, mode: realWindowsMode('?skin=enhanced'), proj: perspective(1.1, 1.6, 0.1, 500), view: lookAt([0, 1.6, 0], [3, 1.6, 0], [0, 1, 0]), now: 5000, scene: { setup: () => null, draw: () => {} } });
      assert.equal(out?.view, true, `${light}: the glass cut to the street`);
      assert.equal(drawn.length, 1, `${light}: the street drawn`);
    }
  } finally { setPref('windowLight', was); }
  const readers = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && /windowLightMode\(|getPref\('windowLight'\)/.test(readFileSync(p, 'utf8'))) readers.push(p.replace(/\\/g, '/')); } };
  walk('src');
  assert.deepEqual(readers.sort(), ['src/render/realWindows.js', 'src/render/renderer.js'], 'the part\'s one home and its one reader, never a host');
});

test('WINDOW-NIGHT WN6: THE CONTROL - a part of the Real windows card, Window light: On, Day only, Off; On by default, the player\'s own online (mutants: the default off On)', () => {
  const row = FEATURES.find((f) => f.id === 'real-windows');
  const part = row.control.parts?.find((p) => p.key === 'windowLight');
  assert.ok(part, 'on the card');
  assert.equal(part.label, 'Window light');
  assert.deepEqual(part.tiers.map(([v, l]) => [v, l]), [['on', 'On'], ['day', 'Day only'], ['off', 'Off']]);
  assert.equal(FEATURE_PREF_DEFAULTS.windowLight, 'on', 'On by default: the light as WL1 shipped it, tamer by night');
  assert.equal(FEATURE_PREF_ONLINE.windowLight, 'player', 'what this screen draws');
  assert.equal(row.control.key, 'realWindows', 'the card\'s own switch is unchanged');
});
