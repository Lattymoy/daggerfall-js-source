// THE ANTI-FLICKER PATCH (2026-10-06, the player: every shadow in the tavern blinking at once with Enhanced Lighting on,
// on every card, and none with `&shadowcache=off`; bible/01-Overview/Waypoints-And-Pace.md). CACHE-OFF: the shadow cache
// is OFF unless asked ON - by the address, the device or the Enhanced Lighting row's "Shadow cache" part - and the
// renderer's own default is the page's door. EMPTY-HOLD (audit68_render_b.test.js S17, disc15.test.js THE DOOR) and
// IDLER-STICKY (audit_reach.test.js B3) are pinned beside the laws they changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowCacheOn, SHADOW_EMPTY_HOLD } from '../src/render/shadowPass.js';
import { Renderer, shadowCacheDefault } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

const nullGl = () => new Proxy({}, {
  get(o, k) {
    if (k in o) return o[k];
    if (typeof k !== 'string') return undefined;
    let v;
    if (k === 'getProgramParameter' || k === 'getShaderParameter') v = () => true;
    else if (k === 'getUniformLocation') v = (_p, n) => n;
    else if (k === 'getParameter') v = () => new Float32Array(4);
    else if (k.startsWith('create')) v = () => ({});
    else if (k.toUpperCase() === k) v = 1;
    else v = () => {};
    o[k] = v;
    return v;
  },
});
const canvas = () => ({ getContext: () => nullGl(), clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
const store = (on) => ({ getItem: (k) => (k === 'dfjs.shadowCache' ? on : null) });

test('CACHE-OFF: the cache is off unless asked on - the address first (`shadowcache=off` wins over every other door), then the device, then the Enhanced Lighting part', () => {
  resetPrefs();
  assert.equal(shadowCacheOn('', null), false, 'asked by nothing: off - the whole-room blink is never the default');
  assert.equal(shadowCacheOn('?shadowcache=on', null), true, 'the address');
  assert.equal(shadowCacheOn('?shadowcache=off', store('on')), false, 'an address\'s off wins over the device');
  assert.equal(shadowCacheOn('', store('on')), true, 'the device');
  assert.equal(shadowCacheOn('', store('off')), false);
  assert.equal(shadowCacheOn('', { getItem() { throw new Error('denied'); } }), false, 'a storage that throws is no storage');
  setPref('shadowCache', true);
  assert.equal(shadowCacheOn('', null), true, 'the row\'s "Shadow cache" part, asked of the page\'s own search');
  assert.equal(shadowCacheOn('?other=1', null), false, 'a door handed another search is answered by it alone (PERF-URL\'s one parse)');
  resetPrefs();
});

test('CACHE-OFF: the device\'s word reaches the door through the one storage seam (systems/appStorage.js)', () => {
  globalThis.localStorage = { getItem: (k) => (k === 'dfjs.shadowCache' ? 'on' : null), setItem() {}, removeItem() {} };
  try {
    assert.equal(shadowCacheOn(''), true);
  } finally { delete globalThis.localStorage; }
  assert.equal(shadowCacheOn(''), false);
});

test('CACHE-OFF: the renderer\'s own default is the page\'s door - off in a page asked by nothing - and the lane\'s install hands it to the pass; outside a page (node) it stays on, so SC1\'s pins drive the cache', () => {
  resetPrefs();
  assert.equal(shadowCacheDefault(), true, 'node: no document');
  const quiet = console.info;
  console.info = () => {};
  try {
    const node = new Renderer(canvas());
    node.setLightingLane(EL_LANE);
    assert.equal(node.shadows.cacheOn, true);
    globalThis.document = {};
    try {
      assert.equal(shadowCacheDefault(), false, 'a page asked by nothing');
      const page = new Renderer(canvas());
      page.setLightingLane(EL_LANE);
      assert.equal(page.shadows.cacheOn, false, 'direct shadow draws - no cache blits');
      page.setShadowCache(true);
      assert.equal(page.shadows.cacheOn, true, 'the lane\'s door still turns it on');
    } finally { delete globalThis.document; }
  } finally { console.info = quiet; }
  assert.equal(SHADOW_EMPTY_HOLD, 30, 'EMPTY-HOLD: half a second of empty frames is held, never longer');
});
