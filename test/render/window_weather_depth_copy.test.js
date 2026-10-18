// WINDOW-WEATHER: verify the depth-copy helper's ownership and GL-state contract without a GPU.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWindowWeatherDepth } from '../../src/render/windowWeatherDepth.js';

function recordingGl() {
  let next = 0;
  const log = [], createdTextures = [], createdFramebuffers = [], deletedTextures = [], deletedFramebuffers = [];
  const state = {
    active: 'TEXTURE2',
    textures: new Map([['TEXTURE0', 'original-unit-0'], ['TEXTURE1', 'original-unit-1'], ['TEXTURE2', 'original-unit-2']]),
    read: 'outside-read-fbo', draw: 'outside-draw-fbo',
    scissor: true, scissorBox: [7, 11, 99, 123], status: 'FRAMEBUFFER_COMPLETE',
  };
  const gl = new Proxy({}, {
    get(_target, name) {
      if (name === 'getParameter') return () => { assert.fail('depth capture/bind must not query GL bindings'); };
      if (name === 'isEnabled') return (cap) => { log.push([name, cap]); return cap === 'SCISSOR_TEST' && state.scissor; };
      if (name === 'enable' || name === 'disable') return (cap) => { if (cap === 'SCISSOR_TEST') state.scissor = name === 'enable'; log.push([name, cap]); };
      if (name === 'createTexture') return () => { const value = { id: ++next, kind: 'texture' }; createdTextures.push(value); return value; };
      if (name === 'createFramebuffer') return () => { const value = { id: ++next, kind: 'framebuffer' }; createdFramebuffers.push(value); return value; };
      if (name === 'checkFramebufferStatus') return () => state.status;
      if (name === 'bindTexture') return (target, value) => { state.textures.set(state.active, value); log.push([name, target, value, state.active]); };
      if (name === 'activeTexture') return (value) => { state.active = value; log.push([name, value]); };
      if (name === 'bindFramebuffer') return (target, value) => {
        if (target === 'READ_FRAMEBUFFER') state.read = value;
        else if (target === 'DRAW_FRAMEBUFFER') state.draw = value;
        else { state.read = value; state.draw = value; }
        log.push([name, target, value]);
      };
      if (name === 'deleteTexture') return (value) => deletedTextures.push(value);
      if (name === 'deleteFramebuffer') return (value) => deletedFramebuffers.push(value);
      if (typeof name === 'string' && name.toUpperCase() === name) return name;
      return (...args) => { log.push([name, ...args]); };
    },
  });
  return { gl, log, state, createdTextures, createdFramebuffers, deletedTextures, deletedFramebuffers };
}

function fixture({ enabled = true, outsideHooks = true } = {}) {
  const g = recordingGl();
  const hooks = new Set();
  const renderer = {
    gl: g.gl,
    markForeignPass: () => g.log.push(['markForeignPass']),
    _rwPaneN: 1,
    _rwTarget: {
      attached: true, w: 320, h: 180, allocW: 512, allocH: 256,
      fbo: 'street-fbo', paneAttached: true, paneTex: 'pane-depth-texture',
      pv: Float32Array.from({ length: 16 }, (_, i) => i + 0.25),
    },
    ...(outsideHooks ? { outsideViewDraws: hooks } : {}),
  };
  const depth = createWindowWeatherDepth(renderer, () => enabled);
  const refresh = (pv = renderer._rwTarget.pv) => { for (const hook of hooks) hook({ pv }); };
  return { ...g, renderer, hooks, depth, refresh };
}

const blits = (log) => log.filter(([name]) => name === 'blitFramebuffer');
const matrixUniform = (log) => log.find(([name, location]) => name === 'uniformMatrix4fv' && location === 'street-pv');

test('WINDOW-WEATHER depth copy: the depth-only page door overrides an already ready copy and disables both samplers', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  let reads = 0;
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { get search() { reads++; return '?windowweatherdepth=off'; } } });
  try {
    const f = fixture();
    // Subscribe with the normal door first, then capture before turning the depth door off.
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '' } });
    f.depth.prepare(); f.refresh();
    assert.equal(f.depth.ready, true);
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { get search() { reads++; return '?windowweatherdepth=off'; } } });
    assert.equal(f.depth.prepare(), false);
    f.depth.bind({ uStreetDepthOn: 'street-on', uPaneDepthOn: 'pane-on' })();
    assert.equal(f.depth.ready, false);
    for (const name of ['street-on', 'pane-on']) assert.ok(f.log.some(([call, key, value]) => call === 'uniform1f' && key === name && value === 0));
    assert.equal(reads, 1, 'only prepare reads the page door, once per frame');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search: '?windowweatherdepth=on' } });
    f.refresh();
    assert.equal(f.depth.prepare(), true, 'the explicit on value retains depth clipping');
    f.depth.release();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else delete globalThis.location;
  }
});

test('WINDOW-WEATHER depth copy: prepare subscribes without touching the room target; the hook copies once per refresh', () => {
  const f = fixture();
  assert.equal(f.depth.prepare(), false);
  assert.equal(f.log.length, 0, 'prepare must not change the room pass framebuffer or textures');
  assert.equal(f.hooks.size, 1, 'one outside-view hook is installed');
  f.refresh();
  assert.equal(f.depth.prepare(), true);
  assert.equal(f.depth.ready, true);
  assert.equal(blits(f.log).length, 1, 'the first subscribed refresh is copied');
  assert.deepEqual(blits(f.log)[0].slice(1), [0, 0, 320, 180, 0, 0, 320, 180, 'DEPTH_BUFFER_BIT', 'NEAREST']);

  assert.equal(f.depth.prepare(), true);
  assert.equal(blits(f.log).length, 1, 'a ready copy is reused until the next view refresh');
  const nextPv = Float32Array.from({ length: 16 }, (_, i) => 100 + i);
  [...f.hooks][0]({ pv: nextPv });
  assert.equal(blits(f.log).length, 2, 'the view-out hook copies that refresh');
  assert.equal(f.depth.ready, true);
  f.depth.bind({
    uStreetDepthOn: 'street-on', uPaneDepthOn: 'pane-on', uStreetDepth: 'street-depth',
    uPaneDepth: 'pane-depth', uStreetPV: 'street-pv', uPaneScale: 'pane-scale',
  })();
  assert.deepEqual(matrixUniform(f.log), ['uniformMatrix4fv', 'street-pv', false, nextPv]);
});

test('WINDOW-WEATHER depth copy: capture restores the view target for later hooks, bind ends on unit zero, scissor is read once', () => {
  const f = fixture();
  const before = {
    active: f.state.active, textures: new Map(f.state.textures), read: f.state.read, draw: f.state.draw,
    scissor: f.state.scissor, scissorBox: [...f.state.scissorBox],
  };
  f.depth.prepare();
  f.hooks.add(() => {
    assert.equal(f.state.read, f.renderer._rwTarget.fbo, 'later hooks retain the view-out read target');
    assert.equal(f.state.draw, f.renderer._rwTarget.fbo, 'later hooks retain the view-out draw target');
    assert.equal(f.state.active, 'TEXTURE0');
    assert.equal(f.state.textures.get('TEXTURE0'), null);
    assert.equal(f.log.at(-1)[0], 'markForeignPass', 'later hooks must not trust stale texture shadows');
  });
  f.refresh();
  assert.equal(f.log.filter(([name]) => name === 'isEnabled').length, 1);
  assert.equal(f.state.scissor, before.scissor);
  assert.deepEqual(f.state.scissorBox, before.scissorBox);

  const uniforms = {
    uStreetDepthOn: 'street-on', uPaneDepthOn: 'pane-on', uStreetDepth: 'street-depth',
    uPaneDepth: 'pane-depth', uStreetPV: 'street-pv', uPaneScale: 'pane-scale',
  };
  const restore = f.depth.bind(uniforms);
  assert.equal(f.state.active, 'TEXTURE1', 'bind leaves unit one active until its returned restore runs');
  assert.notEqual(f.state.textures.get('TEXTURE0'), before.textures.get('TEXTURE0'));
  assert.equal(f.state.textures.get('TEXTURE1'), 'pane-depth-texture');
  assert.ok(f.log.some(([name, location, value]) => name === 'uniform1f' && location === 'street-on' && value === 1));
  assert.ok(f.log.some(([name, location, value]) => name === 'uniform1f' && location === 'pane-on' && value === 1));
  assert.ok(f.log.some(([name, location, x, y]) => name === 'uniform2f' && location === 'pane-scale' && x === 0.625 && y === 0.703125));
  restore();
  assert.equal(f.state.active, 'TEXTURE0');
  assert.equal(f.state.textures.get('TEXTURE2'), before.textures.get('TEXTURE2'), 'unrelated units are untouched');
  f.state.scissor = false;
  f.refresh();
  assert.equal(f.state.scissor, false, 'capture preserves a disabled scissor too');
  assert.equal(f.log.filter(([name]) => name === 'isEnabled').length, 2, 'only capture queries scissor, never bind');
});

test('WINDOW-WEATHER depth copy: incomplete targets restore GL state and stay unavailable until a complete capture', () => {
  const f = fixture();
  f.state.status = 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
  f.depth.prepare();
  f.refresh();
  assert.equal(f.depth.prepare(), false);
  assert.equal(f.depth.ready, false);
  assert.equal(blits(f.log).length, 0, 'incomplete destination is never blitted');
  assert.equal(f.state.active, 'TEXTURE0');
  assert.equal(f.state.textures.get('TEXTURE0'), null);
  assert.equal(f.state.read, f.renderer._rwTarget.fbo);
  assert.equal(f.state.draw, f.renderer._rwTarget.fbo);

  f.state.status = 'FRAMEBUFFER_COMPLETE';
  f.refresh();
  assert.equal(f.depth.prepare(), true);
  assert.equal(blits(f.log).length, 1);
});

test('WINDOW-WEATHER depth copy: disabled or unsupported capture allocates nothing; release owns only its copy and is repeatable', () => {
  const disabled = fixture({ enabled: false });
  assert.equal(disabled.depth.prepare(), false);
  disabled.refresh();
  assert.equal(disabled.depth.ready, false);
  assert.equal(disabled.log.some(([name]) => name === 'createTexture' || name === 'createFramebuffer'), false);
  assert.equal(blits(disabled.log).length, 0);
  disabled.depth.release();
  assert.equal(disabled.hooks.size, 0);

  const unsupported = fixture({ outsideHooks: false });
  assert.equal(unsupported.depth.prepare(), false);
  assert.equal(unsupported.log.some(([name]) => name === 'createTexture' || name === 'createFramebuffer'), false);

  const f = fixture();
  f.depth.prepare();
  f.refresh();
  assert.equal(f.depth.prepare(), true);
  const ownedTexture = f.createdTextures[0];
  const ownedFramebuffer = f.createdFramebuffers[0];
  const targetTexture = f.renderer._rwTarget.paneTex;
  const targetFramebuffer = f.renderer._rwTarget.fbo;
  f.depth.release();
  assert.equal(f.depth.ready, false);
  assert.equal(f.hooks.size, 0, 'release detaches the outside-view callback');
  assert.deepEqual(f.deletedTextures, [ownedTexture]);
  assert.deepEqual(f.deletedFramebuffers, [ownedFramebuffer]);
  assert.ok(!f.deletedTextures.includes(targetTexture) && !f.deletedFramebuffers.includes(targetFramebuffer), 'borrowed renderer targets remain owned by the renderer');
  f.depth.release();
  assert.equal(f.deletedTextures.length, 1);
  assert.equal(f.deletedFramebuffers.length, 1);

  assert.equal(f.depth.prepare(), false, 'a released helper waits for the next room view');
  f.refresh();
  assert.equal(f.depth.ready, true, 'a released helper rebuilds at the next refresh');
  assert.equal(f.hooks.size, 1);
  assert.equal(f.deletedTextures.length, 1, 'rebuild allocates new resources without deleting again');
});

test('WINDOW-WEATHER depth copy: borrowed renderer fields and foreign-pass cleanup remain available', () => {
  const source = readFileSync(new URL('../../src/render/renderer.js', import.meta.url), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.match(code, /this\._rwPaneN\b/, 'renderer.js lost _rwPaneN: window weather would silently fall back to the room box');
  const target = code.match(/this\._rwTarget\s*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  for (const field of ['fbo', 'w', 'h', 'allocW', 'allocH', 'pv', 'attached', 'paneTex', 'paneAttached']) {
    assert.match(target, new RegExp(`(?:^|,)\\s*${field}\\s*(?=[:,])`), `renderer.js lost _rwTarget.${field}: window weather would silently fall back to the room box`);
  }
  const outside = code.slice(code.indexOf('  outsideViewFrame('), code.indexOf('  _rwSkips('));
  assert.match(outside, /finally\s*\{[\s\S]*this\.markForeignPass\(\)/, 'outsideViewFrame finally must invalidate foreign texture bindings');
  const foreign = code.slice(code.indexOf('  markForeignPass()'), code.indexOf('  markForeignPass()') + 1800);
  assert.match(foreign, /this\._forgetTextureShadows\(\)/, 'markForeignPass must forget texture shadows');
});
