// WINDOW-WEATHER LIFECYCLE: the room's flash anchor and the add-on's GPU objects belong to the room/view that made them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { windowWeatherFor, WW_LIGHTNING_SEED, WW_RELEASE_MS } from '../../src/render/windowWeather.js';
import { setWeather, resetWeatherSim } from '../../src/systems/weather/weatherSim.js';
import { LightningPlayer } from '../../src/world/weather.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = (path) => readFileSync(join(ROOT, path), 'utf8');

function recordingGl(log) {
  let id = 0;
  return new Proxy({}, {
    get: (_, key) => {
      if (key === 'getProgramParameter' || key === 'getShaderParameter') return () => true;
      if (key === 'getUniformLocation') return (program, name) => ({ program, name });
      if (key === 'getAttribLocation') return () => 0;
      if (key === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (key === 'drawingBufferWidth') return 640;
      if (key === 'drawingBufferHeight') return 400;
      if (typeof key === 'string' && key.startsWith('create')) return () => { const value = { id: ++id, kind: key }; log.push([key, value]); return value; };
      if (typeof key === 'string' && key.toUpperCase() === key) return key;
      return (...args) => { log.push([key, ...args]); };
    },
  });
}

function weatherRoom(renderer, collider) {
  const ww = windowWeatherFor(renderer);
  const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500));
  const view = lookAt([0, 1.5, 0], [0, 1.5, -5], [0, 1, 0]);
  const glass = { rect: [-0.5, -0.25, 0.5, 0.75], view: true };
  const eye = [0, 1.5, 0];
  ww.frame({ glass, proj, view, eye, dt: 0.016, now: 1000, collider });
  return ww;
}

function room() {
  return {
    bounds: () => ({ min: [-3, 0, -4], max: [3, 3, 2] }),
    raycast: () => 4,
  };
}

function withThunder(run) {
  const oldLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '?skin=enhanced&windows=full' } });
  setWeather('thunder');
  try { run(); }
  finally {
    resetWeatherSim();
    if (oldLocation) Object.defineProperty(globalThis, 'location', oldLocation);
    else delete globalThis.location;
  }
}

test('WINDOW-WEATHER LIFECYCLE: idle frame releases add-on resources and a later room builds lazily', () => {
  withThunder(() => {
    const log = [];
    const renderer = { gl: recordingGl(log), worldViewportPx: null, stats: { draws: 0 } };
    const collider = room();
    const ww = weatherRoom(renderer, collider);
    const programs = log.filter(([name]) => name === 'createProgram').length;
    assert.ok(ww.built && ww.window && programs > 0);
    const frame = { glass: null, proj: perspective(1, 1.6, 0.05, 500), view: lookAt([0, 1.5, 0], [0, 1.5, -5], [0, 1, 0]), eye: [0, 1.5, 0], dt: 0, collider };
    ww.frame({ ...frame, now: 1000 + WW_RELEASE_MS });
    assert.equal(ww.built, true, 'resources stay until the idle threshold is exceeded');
    ww.frame({ ...frame, now: 1001 + WW_RELEASE_MS });
    assert.equal(ww.built, false);
    assert.equal(ww.window, null);
    assert.equal(log.filter(([name]) => name === 'deleteProgram').length, programs);
    ww.release();
    assert.equal(log.filter(([name]) => name === 'deleteProgram').length, programs, 'repeat release deletes nothing twice');
    weatherRoom(renderer, room());
    assert.equal(ww.built, true);
    assert.equal(log.filter(([name]) => name === 'createProgram').length, programs * 2);
  });
});

test('WINDOW-WEATHER LIFECYCLE: the light phase invalidates a flash anchor on a room change before composing light', () => {
  withThunder(() => {
    const log = [], flashes = [];
    const renderer = { gl: recordingGl(log), worldViewportPx: null, stats: { draws: 0 }, setFlashLight: (light) => flashes.push({ ...light }), outsideViewDraws: new Set(), _rwTarget: { attached: true, fbo: 'street', w: 320, h: 180 } };
    const roomA = room(), roomB = room();
    const ww = weatherRoom(renderer, roomA);
    assert.ok(ww.window, 'room A established an anchor');
    for (const hook of renderer.outsideViewDraws) hook({ pv: new Float32Array(16) });
    const depthTexture = log.find(([name]) => name === 'createTexture')[1];
    assert.ok(depthTexture, 'room A allocated its depth copy');

    const oracle = new LightningPlayer(WW_LIGHTNING_SEED);
    const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500));
    const view = lookAt([0, 1.5, 0], [0, 1.5, -5], [0, 1, 0]);
    const glass = { rect: [-0.5, -0.25, 0.5, 0.75], view: true };
    let lit = false;
    for (let i = 0; i < 400 && !lit; i++) {
      const nextIsLit = oracle.tick(0.5) > 1;
      ww.light({ dt: 0.5, collider: nextIsLit ? roomB : roomA });
      lit = ww.flashing;
      if (!nextIsLit) ww.frame({ glass, proj, view, eye: [0, 1.5, 0], dt: 0.5, now: 1500 + i * 500, collider: roomA });
    }
    assert.ok(lit, 'the oracle selected the first lit tick while changing rooms');
    assert.equal(ww.window, null, 'room B invalidated room A\'s anchor in the light phase');
    assert.equal(renderer.outsideViewDraws.size, 0, 'room B detached the old depth hook before lighting');
    assert.ok(log.some(([name, value]) => name === 'deleteTexture' && value === depthTexture), 'room B released the old depth copy');
    assert.equal(flashes.length, 0, 'the lit phase did not compose room A\'s stale position into room B');
    assert.equal(ww.flashing, true, 'the storm remained lit while the room changed');

    assert.doesNotThrow(() => ww.light({ dt: 0 }), 'legacy direct light({dt}) calls remain supported');
  });
});

test('WINDOW-WEATHER LIFECYCLE: host keeps the real windows exit and supplies the live room collider to light', () => {
  const modes = source('src/scenes/worldModes.js');
  const addon = source('src/render/windowWeather.js');
  assert.ok(modes.includes('  const dropViewOut = () => { renderer.releaseOutsideView?.(); viewOut.drawn = false; renderer.takeGlassRect?.(); };'));
  assert.ok(!modes.includes('releaseWindowWeatherView') && !addon.includes('releaseWindowWeatherView'));
  assert.match(modes, /windowWeatherFor\(renderer\)\.light\(\{ dt, collider: interiorCtx\.collider \}\);/);
});
