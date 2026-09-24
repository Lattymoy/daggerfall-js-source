// MAC-T (2026-09-18, Mac's play report on the deployed build): "when typing in chat, if typing H, it triggers you
// switching your weapon hand".
//
// T2 - THE SAME ROOT AS JANOME'S HAND SWITCH, MET FROM THE CHAT LINE. The chat panel stops the field's keydown in the
// window's CAPTURE phase (CG2 / AUDIT CHAT D2), so the host's bubble listener never fills its ring from a typed line -
// and it listens to keydown ALONE. The host's keyup listener is ungated, so a typed H's RELEASE reached
// `noteKeyUp` and the frame read it as SwitchHand's up edge (DFU fires SwitchHand on ActionComplete). JAN1 made the
// ring release only what it captured (`own`): an up whose down the ring never saw is a window's - or a chat line's -
// and not the player's. This pin drives the real panel and the real ring through both phases, so the chat case is
// held by name and not by the transport window's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyEdges, noteKeyDown, noteKeyUp, beginInputFrame, released, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { ChatLog } from '../src/net/chat.js';
import { createChatPanel } from '../src/ui/chatPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** Both phases for BOTH key events (chat1's window carries keydown alone): the capture pass, then - unless propagation
 *  was stopped - the bubble pass, where the host's own listeners live (world.js: `keys.add(e.code); noteKeyDown(...)`
 *  on the down, `keys.delete(e.code); noteKeyUp(...)` on the up). */
function fakeWindow() {
  const listeners = [];
  const dispatch = (type, code, e) => {
    const ev = { type, code, target: null, isTrusted: true, prevented: false, stopped: false, immediate: false, repeat: false,
      preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; },
      stopImmediatePropagation() { ev.stopped = true; ev.immediate = true; }, ...e };
    for (const l of listeners) { if (ev.immediate) break; if (l.t === type && l.capture) l.fn(ev); }
    if (!ev.stopped) for (const l of listeners) if (l.t === type && !l.capture) l.fn(ev);
    return ev;
  };
  return {
    listeners,
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    key(code, e = {}) { return dispatch('keydown', code, e); },
    keyup(code, e = {}) { return dispatch('keyup', code, e); },
  };
}
const defaultAction = (e) => (e.code === 'Enter' ? 'ActivateCursor' : null);

test('MAC-T2: an H typed into the chat line switches no hand - the field stops the down in capture, the host\'s ungated keyup still runs, and the ring releases only what it captured; the same H on the canvas still switches', () => {
  setBindings(defaults());
  const doc = fakeDocument(), win = fakeWindow();
  // the host's shape: bubble, on the window, feeding the held Set and the edge ring (world.js:7754 / :7764 / :7980)
  const keys = new Set(); const edge = keyEdges();
  win.addEventListener('keydown', (e) => { keys.add(e.code); noteKeyDown(edge, e.code, e.repeat); });
  win.addEventListener('keyup', (e) => { keys.delete(e.code); noteKeyUp(edge, e.code); });
  const log = new ChatLog();
  const panel = createChatPanel({ log, onSend: () => true, action: defaultAction, doc, win, touch: false });
  assert.equal(win.listeners.filter((l) => l.t === 'keyup').length, 1, 'the panel adds NO keyup listener - the host\'s is the only one, ungated, so the ring\'s own gate is what stands between a chat line and the hand');

  // the player opens the chat and types "h"
  win.key('Enter', { target: doc.body }); win.keyup('Enter', { target: doc.body });
  assert.equal(log.open, true); assert.equal(panel.input.focused, true, 'the caret in the field');
  const down = win.key('KeyH', { target: panel.input });
  assert.equal(down.stopped, true, 'the field\'s down is stopped at the window (CG2)');
  assert.equal(keys.has('KeyH'), false, 'the held Set never saw it');
  const up = win.keyup('KeyH', { target: panel.input });
  assert.equal(up.stopped, false, 'the release is NOT stopped - it reaches the host\'s keyup listener, as it did on the deployed build');
  beginInputFrame(edge);
  assert.equal(released(edge, keys, 'SwitchHand'), false, 'MAC-T2: the frame reads no SwitchHand release off a chat line');
  assert.equal(edge.upFrame.size, 0, 'the up ring is empty: an up with no down of its own is the field\'s, not the player\'s');

  // the contrast: the chat closed, the same key on the canvas is the player's and switches
  win.key('Escape', { target: panel.input }); win.keyup('Escape', { target: panel.input });
  assert.equal(log.open, false);
  win.key('KeyH', { target: doc.body }); win.keyup('KeyH', { target: doc.body });
  beginInputFrame(edge);
  assert.equal(released(edge, keys, 'SwitchHand'), true, 'the player\'s own H still switches hands on its release');
  panel.destroy();

  // by source: the gate, and the host feeding the ring from BOTH events with no field check of its own (the field's
  // key is stopped before it - the panel's law, not the host's)
  assert.match(rd('src/ui/input.js'), /export function noteKeyUp\(edges, code\) \{ if \(!edges\) return; if \(edges\.own && !edges\.own\.delete\(code\)\) return; edges\.up\.add\(code\); \}/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = rd(host);
    assert.match(h, /addEventListener\('keyup', \(e\) => \{ keys\.delete\(e\.code\); noteKeyUp\(latch\.edge, e\.code\);/, `${host}: the ungated keyup feeds the ring`);
  }
});

// T1 - "a ball of light that hovers over the third person character when having a torch equipped". No light-ball
// object exists: the ball is EL7's bloom GLARE SPRITE, drawn for the player's own carried torch. The exemption that
// was meant to stop it - "no glare for the torch in the hand" - was written as "within 1.5 of the CAMERA"
// (AIR_GLARE_MIN_DISTANCE), and the third-person camera stands 2.7 behind the hand, so it lapsed; the body billboard
// then passed the glare's presence test for a flame flat. The same camera-distance proxy governed the shadow-caster
// pick and the contact march (SHADOW_CASTER_MIN_DISTANCE - "one hand distance", bugs5_field pins it), so all three
// laws read the fact BY NAME now: the torch and candle records say `carried`, the one composer every host goes
// through (withPlayerLights) turns that into a per-light mask, the renderer lifts it off the array before its cap cut
// and shifts it under the lightning flash, and the glare, the caster pick and the caster table (-2, which the march
// reads) skip a carried light in any camera. DFU's PlayerTorch is a bare point light with no flare.
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS } from '../src/render/enhancedLighting.js';
import { pickShadowCasters, pickShadowCaster } from '../src/render/shadowPass.js';
import { withPlayerLights } from '../src/scenes/magicCandle.js';
import { playerTorchLight } from '../src/systems/playerTorch.js';
import { perspective, mirrorProjectionX } from '../src/world/mat4.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096, TRIANGLES: 4 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
function drawWorld(r) {
  r.textures.set('1_1', { id: 't11' }); r.textures.set('210_1', { id: 't2101' });
  const mesh = { vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const batch = { archive: 210, record: 1, vao: { id: 'vao-b' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [1, 0, 1] };
  r.drawMesh(mesh, I, null);
  r.drawBillboards([batch], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
}
/** Two frames on the fake GL: the lights set, the world drawn, the first screen quad resolving the images - the
 *  glare count and the glare centres are the observables (el3_air's shape). The eye is at the origin (the identity
 *  view): a torch 3 units in front of it is the THIRD-PERSON case, well past the 1.5 the old camera-distance proxy read (LIGHT-NEAR1: gone). */
function glareFrame(lights) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const ap = r.air;
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, -0.2]);
  const P = mirrorProjectionX(perspective(1, 1.6, 0.5, 6000));
  r.beginFrame(P, I, sun, WORLD_FRAME); drawWorld(r); r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });
  r.setPointLights(lights, new Float32Array([1, 0.7, 0.4]));
  r.beginFrame(P, I, sun, WORLD_FRAME); drawWorld(r);
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  const centres = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uCenter').map((c) => c.slice(2));
  return { r, ap, centres };
}
const lantern = new Float32Array([5, 2, 1, 14]);
const torchEntity = { _torch: { range: 14 } };
const thirdPersonTorch = () => playerTorchLight(torchEntity, [0, -0.9, -3], 0);   // the body 3 units ahead of the camera; the light at hand height

test('MAC-T1 (a): the carried torch draws NO glare sprite in third person - the lantern beside it still does; strip the mask and the ball is back; the torch takes no caster slot and stands -2 in the caster table', () => {
  const torch = thirdPersonTorch();
  assert.equal(torch.carried, true, 'the torch record says what it is');
  assert.ok(Math.hypot(torch.x, torch.y, torch.z) > 1.5, 'the third-person case: the light is past the 1.5 the old camera-distance proxy read');
  const masked = withPlayerLights(lantern, torch);
  assert.deepEqual([...masked.carried], [1, 0]);
  const on = glareFrame(masked);
  assert.equal(on.ap.stats.glares, 1, 'MAC-T1: one glare - the lantern\'s');
  assert.deepEqual(on.centres, [[5, 2, 1]], 'and it is the lantern, not the torch');
  assert.equal(on.r.shadows.casterOf[0], -2, 'the hand\'s light is -2 in the caster table: no slot, no contact march');
  assert.equal(on.r.shadows.casterOf[1], 0, 'the lantern is caster 0');
  // the deployed build's shape: the same array with no mask (the old law, distance from the camera alone)
  const bare = Float32Array.from(masked);
  const off = glareFrame(bare);
  assert.equal(off.ap.stats.glares, 2, 'without the mask the torch glares too - the ball over the character');
  assert.equal(off.r.shadows.casterOf[0], 0, 'and takes the nearest caster slot (F3\'s regression in third person)');
});

test('MAC-T1 (b): the mask is PER LIGHT, in the array\'s order - the candle and the torch are the player\'s, a dropped torch, a thrown one and a burning foe keep their glare; the paired arm carries it; a composed base keeps its own', () => {
  const candle = { x: 0, y: 1, z: 0, range: 4, carried: true };
  const dropped = [{ x: 3, y: 0.5, z: 3, range: 9 }, { x: -3, y: 0.5, z: 3, range: 14 }, { x: 0, y: 1, z: 6, range: 14 }];
  const base = new Float32Array([5, 2, 1, 14, 9, 2, 1, 12]);
  const out = withPlayerLights(base, candle, thirdPersonTorch(), ...dropped);
  assert.equal(out.length / 4, 7);
  assert.deepEqual([...out.carried], [1, 1, 0, 0, 0, 0, 0], 'the player\'s two, then three world torches, then the base');
  assert.equal(withPlayerLights(base).carried, undefined, 'no player light: the base is handed back as it came');
  const paired = withPlayerLights({ data: base, colors: new Float32Array([1, 1, 1, 0.5, 0.5, 0.5]) }, null, thirdPersonTorch(), dropped[0]);
  assert.deepEqual([...paired.carried], [1, 0, 0, 0], 'the interior host\'s paired shape rides the same mask');
  assert.equal(paired.carried, paired.data.carried);
  const twice = withPlayerLights(out, { x: 1, y: 1, z: 1, range: 3 });
  assert.deepEqual([...twice.carried], [0, 1, 1, 0, 0, 0, 0, 0], 'a base that already carries a mask keeps it, shifted behind the new lights');
});

test('MAC-T1 (c): the renderer lifts the mask before its cap cut and shifts it under the lightning flash; a plain array clears it', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  const data = withPlayerLights(lantern, thirdPersonTorch());
  r.setPointLights(data, new Float32Array([1, 1, 1]));
  assert.deepEqual([...r._pointCarried], [1, 0]);
  r.setFlashLight({ x: 0, y: 50, z: 0, range: 800, color: [1, 1, 1] });
  assert.equal(r._pointLights.length / 4, 3, 'the flash prepended');
  assert.deepEqual([...r._pointCarried], [0, 1, 0], 'the mask shifted with it: the flash unmarked, the torch still marked');
  r.setPointLights(new Float32Array([5, 2, 1, 14]), new Float32Array([1, 1, 1]));
  assert.equal(r._pointCarried, null, 'an array with no mask carries no mask');
  // the cap: a mask longer than the installed set's cap is cut with the array
  const many = withPlayerLights(new Float32Array(64 * 4).fill(1), thirdPersonTorch());
  r.setPointLights(many, new Float32Array([1, 1, 1]));
  assert.equal(r._pointCarried.length, r._pointLights.length / 4);
});

test('MAC-T1 (d): the caster pick skips a carried light in any camera; by source the three laws read the flag and the hosts are untouched', () => {
  const lights = new Float32Array([0.3, 0.9, -2.8, 14, 5, 2, 1, 14, -4, 2, 2, 12]);   // the torch nearest, then two lanterns
  const eye = [0, 0, 0];
  assert.deepEqual(pickShadowCasters(lights, eye, 6), [0, 2, 1], 'the old law: the torch 2.9 from the camera is a caster, and the nearest (then the lanterns by distance)');
  assert.deepEqual(pickShadowCasters(lights, eye, 6, new Uint8Array([1, 0, 0])), [2, 1], 'masked: never');
  assert.equal(pickShadowCaster(lights, eye, new Uint8Array([1, 0, 0])), 2);
  assert.match(rd('src/systems/playerTorch.js'), /range: st\.range,\n(?:\s*\/\/[^\n]*\n)*\s*carried: true,\n\s*\};/, 'the torch record');
  assert.match(rd('src/scenes/magicCandle.js'), /range: CANDLE\.range, carried: true \}/, 'the candle record');
  assert.match(rd('src/render/airPass.js'), /if \(f\.carried && f\.carried\[i\]\) continue;/, 'the glare');
  assert.match(rd('src/render/shadowPass.js'), /if \(carried && carried\[i\]\) continue;/, 'the caster pick');
  assert.match(rd('src/render/shadowPass.js'), /if \(f\.carried\[i\]\) this\.casterOf\[i\] = -2;/, 'the table');
  for (const fs of [EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS]) assert.match(fs, /\(k == -2 \|\| d > uPointLights\[i\]\.w \* 0\.7/, 'the march reads the table');
  assert.match(rd('src/render/renderer.js'), /const carried = data\.carried \?\? null;\n\s*this\._pointCarried = carried \? carried\.subarray\(0, n\) : null;\n\s*this\._pointLights = data\.subarray/, 'lifted BEFORE the cut');
  // the FOUR HOSTS: minted in one home, composed in one home - every host's light call goes through the composer
  let sites = 0;
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const s = rd(h);
    const n = (s.match(/withPlayerLights\(/g) ?? []).length;
    assert.ok(n >= 1, `${h} composes through withPlayerLights`);
    assert.equal((s.match(/playerTorchLight\(playerEntity, player\.feetAt\(\), cam\.yaw\)/g) ?? []).length, n, `${h}: every composition carries the torch`);   // DISC13-A: off the render feet now
    sites += n;
  }
  assert.equal(sites, 6, 'six call sites, no host edit');
});
