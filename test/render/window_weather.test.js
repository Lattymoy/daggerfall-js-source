// WINDOW-WEATHER (2026-10-18, a player's request: seeing the rain and the thunder through the windows): THE WEATHER
// THROUGH THE GLASS - an add-on to the real windows (render/windowWeather.js), wired by the interior host beside the
// view out. The drops are the lab's (render/precipitation.js) with the room and the rectangle kept out, drawn after
// the room under the far-plane trick so only the cut glass takes them; the storm runs DFU's lightning schedule and
// flashes the panes and the room. Pinned by execution over a recording GL; the host's wiring by its text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  windowWeatherOn, wwDropCount, wwSandCount, WW_SAND_BOX, WW_SAND_NEEDLES, wwFall, wwWind, wwRoomBox, wwGlassRectPx, wwClock, windowWeatherShaders, WW_NEEDLES,
  createWindowWeather, windowWeatherFor, wwFlashAnchor, WW_BOX, WW_ROOM_MARGIN, WW_FLASH_GLASS, WW_FLASH_COLOR, WW_FLASH_RANGE,
  WW_FLASH_INSET, WW_FLASH_REACH, WW_RELEASE_MS, WW_WIND, WW_WIND_FLOOR,
} from '../../src/render/windowWeather.js';
import { LAB_WX_VS, LAB_WX_FS, LAB_BOX, PRECIP_REST_S, PRECIP_CLOCK_MAX_S } from '../../src/render/precipitation.js';
import { Renderer } from '../../src/render/renderer.js';
import { windAt } from '../../src/systems/weather/weatherMap.js';
import { perspective, lookAt, mirrorProjectionX, identity, multiply } from '../../src/world/mat4.js';
import { hostText } from '../hostText.mjs';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';
import { WISP_VS, WISP_FS, SAND_LOOK } from '../../src/render/windWisps.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A GL that records every call (the windows1 tests' own shape). */
function recordingGl(log) {
  let id = 0;
  return new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
}
const uploads = (log, name) => log.filter((c) => /^uniform/.test(c[0]) && c[1]?.name === name).map((c) => c.slice(2));
const at = (log, name, ...args) => log.findIndex((c) => c[0] === name && args.every((a, i) => c[i + 1] === a));
const last = (log, name, ...args) => log.findLastIndex((c) => c[0] === name && args.every((a, i) => c[i + 1] === a));

function addOn({ word = 'rain', level = 1, on = true } = {}) {
  const log = [], foreign = [], flashes = [];
  const fell = { word, level };
  const renderer = { gl: recordingGl(log), worldViewportPx: null, stats: { draws: 0 }, markForeignPass: () => foreign.push(log.length), setFlashLight: (l) => flashes.push({ ...l, color: [...l.color] }) };
  const ww = createWindowWeather({ renderer, on: () => on, falling: () => fell });
  return { ww, log, foreign, fell, renderer, flashes };
}
/** A room: its box, and a wall WALL metres down any ray (the collider's raycast's shape). */
const WALL = 4;
const collider = (min, max) => ({ bounds: () => ({ min, max }), rays: [], raycast(o, d, reach) { this.rays.push([o, d, reach]); return WALL; } });
const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500));
const view = lookAt([0, 1.5, 0], [0, 1.5, -5], [0, 1, 0]);
const ROOM = collider([-3, 0, -4], [3, 3, 2]);
const GLASS = { rect: [-0.5, -0.25, 0.5, 0.75], view: true };
const multiplyPV = () => multiply(proj, view);

test('WINDOW-WEATHER W1: one shower on both sides of the glass - the drops are the street\'s density (the lab\'s count x the level) over the smaller volume indoors, what falls is the world\'s law for the street\'s word (the sand is not the rain\'s), and nothing falls for a clear word or a zero level (mutants: the volume\'s share lost, the level ignored, the sand drawn)', () => {
  assert.equal(WW_BOX, 24);
  assert.ok(WW_BOX < LAB_BOX, 'a smaller volume than the street\'s');
  assert.equal(wwDropCount('rain', 1), 4851, 'round(26000 x (24/42)^3)');
  assert.equal(wwDropCount('storm', 1), 4851);
  assert.equal(wwDropCount('snow', 1), 3732, 'round(20000 x (24/42)^3)');
  assert.equal(wwDropCount('rain', 0.5), 2426, 'a half shower');
  assert.equal(wwDropCount('rain', 2), 4851, 'the level held to 1');
  assert.equal(wwDropCount('rain', LAB_BOX === 42 ? 1 : 0, LAB_BOX), 26000, 'at the street\'s own volume, the street\'s own count');
  assert.deepEqual(wwFall('rain', 1), { mode: 'rain', sand: false, kind: 0, fall: 22, count: 4851 });
  assert.deepEqual(wwFall('thunder', 1), { mode: 'storm', sand: false, kind: 0, fall: 22, count: 4851 });
  assert.deepEqual(wwFall('snow', 1), { mode: 'snow', sand: false, kind: 1, fall: 1.6, count: 3732 });
  assert.deepEqual(wwFall('sandstorm', 1), { mode: 'sand', sand: true, kind: 0, fall: 0, count: 2257 }, 'the sand - the wisps\' program in its look: round(7000 x (48/70)^3) - its own, larger volume');
  assert.equal(wwSandCount(0.5), 1228, 'the street\'s smoothstep ramp, its share');
  assert.equal(wwSandCount(0), 0);
  assert.equal(wwFall('sandstorm', 0), null, 'no sand without a storm');
  for (const w of ['clear', 'cloudy', 'overcast', 'fog', null, undefined]) assert.equal(wwFall(w, 1), null, `${w}: nothing falls`);
  assert.equal(wwFall('rain', 0), null, 'a word with nothing down yet');
});

test('WINDOW-WEATHER W2: the switch is the real windows\' Full (the street cut into the glass) on the enhanced skin, and ?windowweather=off its own kill door; the wind\'s stand-in is the weather map\'s field at the room, at the fall\'s own speed (mutants: the switch on under Rooms only, the door ignored, the calm floor lost)', () => {
  assert.equal(windowWeatherOn('?skin=enhanced&windows=full'), true);
  assert.equal(windowWeatherOn('?skin=enhanced&windows=rooms'), false, 'Rooms only cuts no glass');
  assert.equal(windowWeatherOn('?skin=enhanced&windows=off'), false);
  assert.equal(windowWeatherOn('?skin=classic&windows=full'), false, 'the classic skin is Daggerfall\'s glass');
  assert.equal(windowWeatherOn('?skin=enhanced&windows=full&windowweather=off'), false, 'the door');
  for (const [x, z, m] of [[0, 0, 0], [120, -40, 700], [-900, 3000, 1440 * 3], [0, 0, 38646]]) {
    for (const mode of ['rain', 'storm', 'snow']) {
      const w = windAt(x, z, m), mag = Math.hypot(w[0], w[1]);
      const v = wwWind(mode, x, z, m);
      const speed = Math.hypot(v[0], v[1]);
      assert.ok(Math.abs(speed - WW_WIND[mode] * Math.max(WW_WIND_FLOOR, Math.min(1, mag))) < 1e-9, `${mode}: the fall's own speed`);
      if (mag > 1e-6) assert.ok(Math.abs(v[0] * w[1] - v[1] * w[0]) < 1e-9 && v[0] * w[0] + v[1] * w[1] > 0, 'down the map\'s wind');
    }
  }
  const calm = windAt(0, 0, 38646);
  assert.ok(Math.hypot(calm[0], calm[1]) < 0.05, 'the map near calm there (its three terms against each other)');
  assert.ok(Math.abs(Math.hypot(...wwWind('rain', 0, 0, 38646)) - WW_WIND.rain * WW_WIND_FLOOR) < 1e-9, 'a calm reading still leans the rain - the floor');
  assert.ok(WW_WIND.storm > WW_WIND.rain && WW_WIND.rain > WW_WIND.snow, 'a storm drives the rain harder, a flake drifts least');
});

test('WINDOW-WEATHER W3: the drop program is the lab\'s, byte for byte, with three things added - the world point handed on, the room\'s box discarded, the view out\'s rectangle kept - and a lab that moved under it is said, never patched half (mutants: the room discard lost, the rectangle lost)', () => {
  const { vs, fs } = windowWeatherShaders();
  assert.ok(vs.includes('out vec3 vWorld;') && vs.includes('vWorld = p;\n  gl_Position = uVP * vec4(p, 1.0);'), 'the world point, set where the lab places the drop');
  assert.equal(vs.replace('\nout vec3 vWorld;   // WINDOW-WEATHER: the drop\'s world point', '').replace('vWorld = p;\n  ', ''), LAB_WX_VS, 'the lab\'s vertex stage otherwise untouched');
  assert.ok(fs.includes('if (all(greaterThan(vWorld, uRoomMin)) && all(lessThan(vWorld, uRoomMax))) discard;'), 'a drop inside the room\'s box is the room\'s side of the glass');
  assert.ok(/gl_FragCoord\.x < uGlassRect\.x \|\| gl_FragCoord\.y < uGlassRect\.y \|\| gl_FragCoord\.x >= uGlassRect\.z \|\| gl_FragCoord\.y >= uGlassRect\.w\) discard;/.test(fs), 'outside the rectangle, nothing (the renderer\'s own rwInRect law)');
  assert.ok(fs.indexOf('discard') > fs.indexOf('void main(){') && fs.indexOf('discard') < fs.indexOf('if (uKind < 0.5)'), 'before the lab colours the drop');
  assert.ok(fs.endsWith(LAB_WX_FS.slice(LAB_WX_FS.indexOf('if (uKind < 0.5)'))), 'the lab\'s colours, verbatim');
  for (const [k, needle] of Object.entries(WW_NEEDLES)) {
    const src = k.startsWith('vs') ? LAB_WX_VS : LAB_WX_FS;
    assert.equal(src.split(needle).length, 2, `${k}: the lab holds "${needle}" once`);
  }
  assert.throws(() => windowWeatherShaders(LAB_WX_VS.replace(WW_NEEDLES.vsPos, 'gl_Position = vec4(p, 1.0);'), LAB_WX_FS), /vertex stage changed/);
  assert.throws(() => windowWeatherShaders(LAB_WX_VS, LAB_WX_FS + WW_NEEDLES.fsMain), /fragment stage changed/, 'twice is not once');
});

test('WINDOW-WEATHER W4: the room\'s box is the collider\'s bounds grown by the margin, and the rectangle is the renderer\'s own - the pixels setGlassView cuts the glass in (mutants: the margin lost, the rectangle\'s arithmetic drifted)', () => {
  assert.deepEqual(wwRoomBox({ min: [-3, 0, -4], max: [3, 3, 2] }), { min: [-3 - WW_ROOM_MARGIN, -WW_ROOM_MARGIN, -4 - WW_ROOM_MARGIN], max: [3 + WW_ROOM_MARGIN, 3 + WW_ROOM_MARGIN, 2 + WW_ROOM_MARGIN] });
  assert.equal(wwRoomBox(null), null);
  const log = [];
  const canvas = { getContext: () => recordingGl(log), clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  const px = { width: 1, height: 1, colors: new Uint8ClampedArray([255, 255, 255, 255]) };
  r.uploadTexture(9, 5, px); r.uploadGlassMask(9, 5, px);
  const room = { vao: {}, subMeshes: [{ textureArchive: 9, textureRecord: 5, primitiveCount: 2, startIndex: 0, _bounds: new Float32Array([0, 1.5, -4, 0.5]) }] };
  for (const vp of [null, [40, 30, 500, 300]]) {
    if (vp) r.setWorldViewport({ x: vp[0], y: 400 - vp[1] - vp[3], w: vp[2], h: vp[3] });
    r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
    r._rwEnsureTarget(64, 64);
    r.setGlassView(GLASS);
    log.length = 0;
    r.drawMesh(room, identity());
    const cut = [...uploads(log, 'uGlassRect')[0][0]];
    assert.deepEqual(wwGlassRectPx(GLASS.rect, r.worldViewportPx ?? [0, 0, 640, 400]), cut, `the renderer's own rectangle (${vp ? 'a docked viewport' : 'the whole frame'})`);
  }
});

test('WINDOW-WEATHER W5: the fall\'s clock is re-origined as the street\'s is - on the first draw, after a rest off the screen, on a clock that ran backwards and at the hour - and the wind\'s travel goes back to nothing with it (mutants: the rest ignored)', () => {
  const s = { t0: null, last: 0, windOff: [3, 4] };
  assert.equal(wwClock(s, 100), 0); assert.deepEqual(s.windOff, [0, 0]);
  s.windOff[0] = 2;
  assert.equal(wwClock(s, 101.5), 1.5); assert.equal(s.windOff[0], 2, 'a running fall keeps its travel');
  assert.equal(wwClock(s, 101.5 + PRECIP_REST_S + 0.1), 0, 'a rest'); assert.equal(s.windOff[0], 0);
  wwClock(s, 300); assert.equal(wwClock(s, 299), 0, 'backwards');
  let t = 299;
  for (let i = 0; i < PRECIP_CLOCK_MAX_S / 5; i++) wwClock(s, (t += 5));
  assert.ok(wwClock(s, t + 5) < 10, 'the hour');
});

test('WINDOW-WEATHER W6: a frame of rain - after the room\'s draws, one instanced draw of the indoor count under the far-plane trick (depthRange 1 1, LEQUAL, no depth write: only the cut glass takes it), the room\'s box and the rectangle handed over, the baseline put back and the renderer told (mutants: the trick lost, the baseline left, the renderer not told)', () => {
  const { ww, log, foreign, renderer } = addOn({ word: 'rain', level: 1 });
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000, collider: ROOM });
  const draw = at(log, 'drawArraysInstanced', 'TRIANGLES', 0, 6, 4851);
  assert.ok(draw >= 0, 'one draw, the indoor count');
  const range = at(log, 'depthRange', 1, 1), leq = at(log, 'depthFunc', 'LEQUAL'), mask = at(log, 'depthMask', false);
  assert.ok(range >= 0 && range < draw && leq < draw && mask < draw && at(log, 'enable', 'DEPTH_TEST') < draw, 'every drop at the far plane, tested - where the room wrote no depth');
  assert.ok(last(log, 'depthRange', 0, 1) > draw && last(log, 'depthFunc', 'LESS') > draw && last(log, 'depthMask', true) > draw, 'the depth law put back');
  assert.ok(last(log, 'disable', 'BLEND') > draw && last(log, 'enable', 'CULL_FACE') > draw && last(log, 'bindVertexArray', null) > draw, 'the baseline back');
  assert.deepEqual(foreign, [log.length], 'the renderer told, last');
  assert.equal(renderer.stats.draws, 1);
  assert.deepEqual(uploads(log, 'uRoomMin')[0], [-3 - WW_ROOM_MARGIN, -WW_ROOM_MARGIN, -4 - WW_ROOM_MARGIN]);
  assert.deepEqual(uploads(log, 'uRoomMax')[0], [3 + WW_ROOM_MARGIN, 3 + WW_ROOM_MARGIN, 2 + WW_ROOM_MARGIN]);
  assert.deepEqual(uploads(log, 'uGlassRect')[0], [160, 150, 480, 350], 'the glass\'s pixels on a 640 x 400 frame');
  assert.deepEqual(uploads(log, 'uBox')[0], [WW_BOX]);
  assert.deepEqual(uploads(log, 'uKind')[0], [0]);
  assert.deepEqual(uploads(log, 'uFall')[0], [22]);
  assert.equal(at(log, 'drawArrays', 'TRIANGLE_STRIP', 0, 4), -1, 'no storm, no flash');
});

test('WINDOW-WEATHER W7: nothing is drawn without glass to see through - no view out on screen, the street off (only the sky behind holes), no room, a clear sky, or the add-on off - and an unused add-on frees what it built (mutants: the street-off guard lost, the release lost)', () => {
  const cases = [
    ['no glass on screen', {}, { glass: null }],
    ['the street off', {}, { glass: { rect: GLASS.rect, view: false } }],
    ['no room', {}, { collider: null }],
    ['a clear sky', { word: 'clear' }, {}],
    ['the add-on off', { on: false }, {}],
  ];
  for (const [what, o, f] of cases) {
    const { ww, log } = addOn(o);
    ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000, collider: ROOM, ...f });
    assert.equal(log.filter((c) => /^draw/.test(c[0])).length, 0, `${what}: nothing drawn`);
    assert.equal(ww.built, false, `${what}: nothing built`);
  }
  const { ww, log, fell } = addOn();
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000, collider: ROOM });
  assert.equal(ww.built, true);
  fell.word = 'clear';
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000 + WW_RELEASE_MS - 1, collider: ROOM });
  assert.equal(ww.built, true, 'kept a while');
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000 + WW_RELEASE_MS + 1, collider: ROOM });
  assert.equal(ww.built, false, 'freed after the wait');
  assert.equal(log.filter((c) => c[0] === 'deleteProgram').length, 3, 'the three programs');
  assert.equal(log.filter((c) => c[0] === 'deleteBuffer').length, 2, 'both buffers');
  assert.equal(log.filter((c) => c[0] === 'deleteVertexArray').length, 2, 'both VAOs');
  const b = addOn();
  b.ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000, collider: ROOM });
  b.ww.release();
  assert.equal(b.ww.built, false, 'release frees it at once');
  b.ww.release();
  assert.equal(b.log.filter((c) => c[0] === 'deleteProgram').length, 3, 'once');
});

test('WINDOW-WEATHER W8: a storm runs DFU\'s lightning schedule, ticked as the room is lit - a lit frame lights the room through its window (the renderer\'s lightning channel, a cold light just inside the glass last looked through) and flashes the panes a cold white (one strip over the rectangle, added, the far-plane trick\'s); a dark frame and a rain word light nothing, and a room whose window was never seen takes the panes\' flash alone (mutants: the flash never added, the light never composed, every word a storm)', () => {
  const { ww, log, flashes } = addOn({ word: 'thunder', level: 1 });
  const room = collider([-3, 0, -4], [3, 3, 2]);
  const eye = [0, 1.5, 0];
  let lit = -1, beforeSeen = 0;
  for (let i = 0; i < 400 && lit < 0; i++) {
    log.length = 0;
    ww.light({ dt: 0.5 });
    if (ww.flashing && i === 0) beforeSeen++;
    ww.frame({ glass: GLASS, proj, view, eye, dt: 0.5, now: 1000 + i * 500, collider: room });
    if (ww.flashing && flashes.length) lit = i;
  }
  assert.equal(beforeSeen, 0, 'the schedule waits before its first strike (DFU\'s 4-35 s)');
  assert.ok(lit >= 0, 'a strike within the schedule\'s longest wait');
  const strip = at(log, 'drawArrays', 'TRIANGLE_STRIP', 0, 4);
  assert.ok(strip >= 0, 'the panes\' flash, one strip');
  const add = last(log, 'blendFunc', 'ONE', 'ONE'), far = at(log, 'depthRange', 1, 1);
  assert.ok(add >= 0 && add < strip && far >= 0 && far < strip, 'added, and only on the glass');
  assert.deepEqual(uploads(log, 'uRect').at(-1), GLASS.rect, 'over the view out\'s rectangle');
  assert.deepEqual(uploads(log, 'uFlash').at(-1), [...WW_FLASH_GLASS]);
  const l = flashes.at(-1);
  const want = wwFlashAnchor(GLASS.rect, [...multiplyPV()], eye, room);
  assert.ok(want && Math.hypot(l.x - want[0], l.y - want[1], l.z - want[2]) < 1e-9, 'the light where the window was found');
  assert.equal(l.range, WW_FLASH_RANGE);
  assert.deepEqual(l.color, [...WW_FLASH_COLOR]);
  const lights = flashes.length;
  let dark = false;
  for (let i = 0; i < 400 && !dark; i++) { ww.light({ dt: 0.5 }); dark = !ww.flashing; }
  assert.ok(dark);
  assert.equal(flashes.length, lights, 'a dark frame composes no light');
  const rain = addOn({ word: 'rain' });
  for (let i = 0; i < 200; i++) {
    rain.ww.light({ dt: 0.5 });
    rain.ww.frame({ glass: GLASS, proj, view, eye, dt: 0.5, now: 1000 + i * 500, collider: room });
    assert.equal(rain.ww.flashing, false, 'rain alone never flashes');
  }
  assert.equal(rain.flashes.length, 0);
  const blind = addOn({ word: 'thunder' });
  let panes = 0;
  for (let i = 0; i < 400; i++) {
    blind.log.length = 0;
    blind.ww.light({ dt: 0.5 });
    blind.ww.frame({ glass: { rect: GLASS.rect, view: true }, proj, view, eye, dt: 0.5, now: 1000 + i * 500, collider: { bounds: room.bounds, raycast: () => Infinity } });
    if (blind.ww.flashing && at(blind.log, 'drawArrays', 'TRIANGLE_STRIP', 0, 4) >= 0) panes++;
  }
  assert.ok(panes > 0, 'the panes still flash');
  assert.equal(blind.flashes.length, 0, 'a window the ray never met lights nothing in the room');
  assert.equal(blind.ww.window, null);
});

test('WINDOW-WEATHER W11: where the storm\'s light stands - down the ray from the eye through the middle of the glass\'s rectangle to the room\'s collider, WW_FLASH_INSET short of the wall; the window is found again only in a storm, at most every WW_FLASH_FIND_MS, and forgotten in the next room (mutants: the inset lost, the ray off the rectangle\'s middle)', () => {
  const pv = [...multiplyPV()];
  const room = collider([-3, 0, -4], [3, 3, 2]);
  const p = wwFlashAnchor([-0.5, -0.5, 0.5, 0.5], pv, [0, 1.5, 0], room);
  assert.ok(p && Math.hypot(p[0], p[1] - 1.5, p[2] + (WALL - WW_FLASH_INSET)) < 1e-4, 'straight ahead, just inside the wall');
  const [o, d, reach] = room.rays.at(-1);
  assert.deepEqual(o, [0, 1.5, 0]);
  assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9 && d[2] < -0.999, 'a unit ray, forward');
  assert.equal(reach, WW_FLASH_REACH);
  const q = wwFlashAnchor([0.2, 0.1, 0.6, 0.5], pv, [0, 1.5, 0], room);
  const dq = room.rays.at(-1)[1];
  assert.ok(q && dq[1] > 0, 'up, toward a pane above the middle (x is the mirrored lens\'s)');
  const ndc = (() => { const w = pv[3] * (dq[0] * 5) + pv[7] * (1.5 + dq[1] * 5) + pv[11] * (dq[2] * 5) + pv[15]; return [(pv[0] * (dq[0] * 5) + pv[4] * (1.5 + dq[1] * 5) + pv[8] * (dq[2] * 5) + pv[12]) / w, (pv[1] * (dq[0] * 5) + pv[5] * (1.5 + dq[1] * 5) + pv[9] * (dq[2] * 5) + pv[13]) / w]; })();
  assert.ok(Math.abs(ndc[0] - 0.4) < 1e-6 && Math.abs(ndc[1] - 0.3) < 1e-6, 'through the rectangle\'s middle');
  assert.equal(wwFlashAnchor([-0.5, -0.5, 0.5, 0.5], pv, [0, 1.5, 0], { raycast: () => Infinity }), null, 'nothing met');
  assert.equal(wwFlashAnchor([-0.5, -0.5, 0.5, 0.5], pv, [0, 1.5, 0], null), null, 'no room');
  const { ww } = addOn({ word: 'thunder' });
  const a = collider([-3, 0, -4], [3, 3, 2]);
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 0.016, now: 1000, collider: a });
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 0.016, now: 1100, collider: a });
  assert.equal(a.rays.length, 1, 'not again within the wait');
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 0.016, now: 1300, collider: a });
  assert.equal(a.rays.length, 2, 'again after it');
  assert.ok(ww.window);
  ww.frame({ glass: null, proj, view, eye: [0, 1.5, 0], dt: 0.016, now: 2000, collider: collider([0, 0, 0], [1, 1, 1]) });
  assert.equal(ww.window, null, 'the next room\'s window is its own');
  const rain = addOn({ word: 'rain' });
  const r = collider([-3, 0, -4], [3, 3, 2]);
  rain.ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 0.016, now: 1000, collider: r });
  assert.equal(r.rays.length, 0, 'no storm, no ray');
});

test('WINDOW-WEATHER W9: THE ADD-ON IS WIRED BESIDE THE REAL WINDOWS, NOT INTO THEM - the interior host asks its one instance (one a renderer) to light once the room\'s lamps are stored and before its beginFrame, and to draw after the room\'s own draws and before the viewmodel, adding two lines and changing none of the real windows\' own; the real windows\' module names it nowhere, and the hosts with no glass to look out of ask nothing (mutants: the frame dropped, the light dropped)', () => {
  const modes = hostText('src/scenes/worldModes.js');
  assert.ok(modes.includes("import { windowWeatherFor } from '../render/windowWeather.js';"));
  const lit = modes.indexOf('windowWeatherFor(renderer).light({ dt, collider: interiorCtx.collider });');
  assert.ok(lit > modes.indexOf('renderer.setPointLights(_itLit.data, null, _itLit.colors);'), 'after the room\'s lamps are stored (setFlashLight composes into them)');
  const begin = modes.indexOf('renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);', lit);
  assert.ok(begin > lit && begin < modes.indexOf('renderer.setGlassView(_rwView);'), 'before the interior frame begins');
  const call = modes.indexOf('windowWeatherFor(renderer).frame({ glass: _rwView, proj, view, eye: mwv.eye, dt, now: performance.now(), collider: interiorCtx.collider });');
  assert.ok(call > 0, 'drawn with the view out\'s answer and the room\'s collider');
  assert.ok(call > modes.indexOf('const _rwView = viewOutFrame(viewOut') && call > modes.indexOf('host.csaDrawParticlesBlended?.();'), 'after the view out and the room\'s last world draw');
  assert.ok(call < modes.indexOf('interiorWeapon.draw({ paralyzed });'), 'before the viewmodel\'s screen quads');
  assert.equal(modes.split('windowWeatherFor(renderer)').length, 3, 'two asks, no more');
  const fake = { gl: recordingGl([]) };
  assert.equal(windowWeatherFor(fake), windowWeatherFor(fake), 'one a renderer');
  assert.notEqual(windowWeatherFor(fake), windowWeatherFor({ gl: recordingGl([]) }));
  const rw = readFileSync(join(ROOT, 'src/render/realWindows.js'), 'utf8');
  assert.ok(!/windowWeather|WINDOW-WEATHER/.test(rw), 'the real windows know nothing of it');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.ok(!hostText(host).includes('windowWeatherFor'), `${host}: no glass to look out through - FLAGGED none`);
  }
});

test('WINDOW-WEATHER W10: the drop program RUN (test/glsl.mjs) - the vertex stage hands on the very point it places, and the fragment stage keeps a drop past the glass in the lab\'s own colour while it discards one in the room (its walls\' margin included) and one outside the rectangle (mutants: the room discard lost, the rectangle lost)', () => {
  const { vs, fs } = windowWeatherShaders();
  const pv = [...identity()];
  for (const seed of [[1, 2, 3, 0.25], [20, 5, 11, 0.8], [7.5, 23, 0.5, 0.01]]) {
    for (const corner of [[0, 0], [1, 1]]) {
      const v = glslFunctions(vs, { aCorner: corner, aSeed: seed, uVP: pv, uEye: [0, 1.5, 0], uRight: [1, 0, 0], uUp: [0, 1, 0], uTime: 3.2, uKind: 0, uBox: WW_BOX, uFall: 22, uWindV: [2, 1], uWindOff: [0.4, 0.2] });
      v.main();
      const w = v.globals.vWorld, p = v.globals.gl_Position;
      assert.ok([0, 1, 2].every((i) => Math.abs(p[i] - w[i]) < 1e-9) && p[3] === 1, 'gl_Position is uVP x the world point handed on');
      assert.ok([0, 2].every((i) => Math.abs(w[i] - [0, 1.5, 0][i]) <= WW_BOX / 2 + 1), 'inside the volume round the eye');
    }
  }
  const box = wwRoomBox({ min: [-3, 0, -4], max: [3, 3, 2] });
  const frag = (world, xy) => {
    const f = glslFunctions(fs, { vT: 0.8, vSeed: 0.3, uKind: 0, vWorld: world, uRoomMin: box.min, uRoomMax: box.max, uGlassRect: [160, 150, 480, 350], gl_FragCoord: [xy[0], xy[1], 1, 1] });
    try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
    return f.globals.o;
  };
  const kept = frag([0, 1.5, -7], [300, 250]);
  assert.ok(kept, 'a drop past the glass, in the rectangle, is drawn');
  assert.ok(Math.abs(kept[3] - 0.42) < 1e-6 && Math.abs(kept[0] - 0.72) < 1e-6, 'in the lab\'s colour (a drop\'s head, 0.42 cover)');
  assert.equal(frag([0, 1.5, -1], [300, 250]), null, 'in the room: the room\'s side of the glass');
  assert.equal(frag([0, 1.5, -4.2], [300, 250]), null, 'in the wall\'s margin');
  assert.equal(frag([0, 1.5, -7], [100, 250]), null, 'left of the rectangle');
  assert.equal(frag([0, 1.5, -7], [300, 350]), null, 'its top edge is out (the renderer\'s half-open law)');
  assert.ok(frag([0, 1.5, -7], [160, 150]), 'its bottom-left corner is in');
  const flake = glslFunctions(fs, { vT: 0.5, vSeed: 0.3, uKind: 1, vWorld: [5, 1, 5], uRoomMin: box.min, uRoomMax: box.max, uGlassRect: [0, 0, 640, 400], gl_FragCoord: [10, 10, 1, 1] });
  flake.main();
  assert.ok(Math.abs(flake.globals.o[3] - 0.72) < 1e-6, 'a flake in the lab\'s colour too');
});

test("WINDOW-WEATHER W12: A SANDSTORM through the glass - the wisps' program in the sand's look (render/windWisps.js WEATHER2d), with the same three things added, RUN: a streak past the glass in the sand's own colour, none in the room or outside the rectangle; a frame of it is one instanced draw of the indoor count on the sand's program, its look and the level its strength (mutants: the sand drawn on the rain's program, the look lost)", () => {
  const { vs, fs } = windowWeatherShaders(WISP_VS, WISP_FS, WW_SAND_NEEDLES);
  assert.equal(vs.replace("\nout vec3 vWorld;   // WINDOW-WEATHER: the drop's world point", '').replace('vWorld = p;\n  ', ''), WISP_VS, "the wisps' vertex stage otherwise untouched");
  assert.ok(fs.endsWith(WISP_FS.slice(WISP_FS.indexOf('float a = smoothstep'))), "the wisps' colours, verbatim");
  const box = wwRoomBox({ min: [-3, 0, -4], max: [3, 3, 2] });
  const frag = (world, xy) => {
    const f = glslFunctions(fs, { vT: 0.6, vLife: 1, uStrength: 1, uColor: [...SAND_LOOK.color], uAlpha: [...SAND_LOOK.alpha], vWorld: world, uRoomMin: box.min, uRoomMax: box.max, uGlassRect: [160, 150, 480, 350], gl_FragCoord: [xy[0], xy[1], 1, 1] });
    try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
    return f.globals.o;
  };
  const kept = frag([0, 1.5, -7], [300, 250]);
  assert.ok(kept && [0, 1, 2].every((i) => Math.abs(kept[i] - SAND_LOOK.color[i]) < 1e-6), "past the glass, in the sand's colour");
  assert.equal(frag([0, 1.5, -1], [300, 250]), null, 'in the room, nothing');
  assert.equal(frag([0, 1.5, -7], [500, 250]), null, 'outside the rectangle, nothing');
  const v = glslFunctions(vs, { aCorner: [0, 1], aSeed: [3, 4, 5, 0.4], uVP: [...identity()], uEye: [0, 1.5, 0], uTime: 12, uBox: WW_BOX, uStrength: 1, uWindV: [6, 0], uWindOff: [1, 0], uLen: [...SAND_LOOK.len] });
  v.main();
  assert.ok([0, 1, 2].every((i) => Math.abs(v.globals.gl_Position[i] - v.globals.vWorld[i]) < 1e-9), 'the world point it places, handed on');
  const { ww, log } = addOn({ word: 'sandstorm', level: 1 });
  ww.frame({ glass: GLASS, proj, view, eye: [0, 1.5, 0], dt: 1 / 60, now: 1000, collider: ROOM });
  const draw = at(log, 'drawArraysInstanced', 'TRIANGLES', 0, 6, 2257);
  assert.ok(draw >= 0, 'one draw, the indoor count');
  const used = log.filter((c, k) => c[0] === 'useProgram' && k < draw).at(-1)[1];
  assert.ok(uploads(log, 'uColor').length === 1 && log.some((c) => /^uniform/.test(c[0]) && c[1]?.name === 'uColor' && c[1].p === used), "on the sand's program");
  assert.deepEqual(uploads(log, 'uColor')[0], [...SAND_LOOK.color]);
  assert.deepEqual(uploads(log, 'uAlpha')[0], [...SAND_LOOK.alpha]);
  assert.deepEqual(uploads(log, 'uLen')[0], [...SAND_LOOK.len]);
  assert.deepEqual(uploads(log, 'uStrength')[0], [1]);
  assert.deepEqual(uploads(log, 'uBox')[0], [WW_SAND_BOX], 'the sand\'s own volume');
  assert.equal(uploads(log, 'uFall').length, 0, "not the rain's program");
  assert.ok(at(log, 'depthRange', 1, 1) < draw, 'the far-plane trick, as the drops');
});
