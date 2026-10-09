// RW1 (2026-10-09, Mac: "...allowing players to see inside/outside of house windows"): THE VIEW OUT - from inside a
// building, its glass shows the real street: drawn from the interior camera into a target of its own
// (renderer.outsideViewFrame - a bracket that puts back everything it sets), cropped to the screen rectangle the glass
// covered last frame, kept while the camera is still, painted as the interior frame's background inside that
// rectangle (renderer.setGlassView), the glass texels cut to it. An interior's glass is DFU's window table drawn
// indoors, an interior set's 0xff texels (FLAGGED - unverified without the player's data), a declared mask
// (renderer.uploadGlassMask), or a cutout picture's holes (uploadTexture { cutout: true }) - the caravan's door. Pinned by
// execution over a recording GL; the hosts' wiring by their text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Renderer } from '../src/render/renderer.js';
import { ShadowPass, DEPTH_BB_FS, DEPTH_FS } from '../src/render/shadowPass.js';
import { StaticBatchBuilder } from '../src/render/staticBatch.js';
import { windowEmissionRGB } from '../src/render/windowEmission.js';
import {
  cropProjection, viewOutProjection, VIEW_NEAR, VIEW_FAR, sphereNdcRect, padRect, GLASS_RECT_MARGIN, viewTargetSize, VIEW_SCALE,
  VIEW_MAX_SIDE, VIEW_BUCKET, viewOutDue, VIEW_MAX_AGE_MS, VIEW_RELEASE_MS, createViewOut, viewOutFrame, viewRays,
  viewSkyFrom,
} from '../src/render/realWindows.js';
import { interiorGlassMask, isInteriorGlassArchive, GLASS_INDEX, GLASS_MIN_TEXELS, GLASS_MAX_SHARE, glassMaskFromAlpha, glassTexelCount } from '../src/world/interiorGlass.js';
import { perspective, lookAt, mirrorProjectionX, identity, multiply } from '../src/world/mat4.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const I = identity();
const px = { width: 1, height: 1, colors: new Uint8ClampedArray([255, 255, 255, 255]) };

function recordingRenderer(log) {
  let id = 0;
  const stub = new Proxy({}, {
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
  const canvas = { getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const uploads = (log, name) => log.filter((c) => /^uniform/.test(c[0]) && c[1]?.name === name).map((c) => c.slice(2));
const project = (pv, p) => { const x = pv[0] * p[0] + pv[4] * p[1] + pv[8] * p[2] + pv[12], y = pv[1] * p[0] + pv[5] * p[1] + pv[9] * p[2] + pv[13], z = pv[2] * p[0] + pv[6] * p[1] + pv[10] * p[2] + pv[14], w = pv[3] * p[0] + pv[7] * p[1] + pv[11] * p[2] + pv[15]; return [x / w, y / w, z / w]; };

test('RW1 view V1: the view out\'s lens - the crop makes the glass\'s rectangle the whole clip space (its corners at the edge, its centre the middle), and the street\'s lens lands every direction where the room\'s does, its depth out to the fog (mutants: the crop\'s scale or offset, the far plane, x and y moved)', () => {
  const proj = mirrorProjectionX(perspective(1.1, 1.6, 0.05, 500));
  const view = lookAt([1, 1.6, 2], [-2, 2, -9], [0, 1, 0]);
  const pv = multiply(proj, view);
  const rect = [-0.3, -0.2, 0.5, 0.6];
  const cpv = multiply(cropProjection(proj, rect), view);
  for (const p of [[-3, 2, -10], [0, 0.5, -4], [4, 3, -20], [-1, 1, -2]]) {
    const a = project(pv, p), b = project(cpv, p);
    assert.ok(Math.abs(b[0] - (2 * (a[0] - rect[0]) / (rect[2] - rect[0]) - 1)) < 1e-4, 'x: the rectangle stretched to the edges');
    assert.ok(Math.abs(b[1] - (2 * (a[1] - rect[1]) / (rect[3] - rect[1]) - 1)) < 1e-4, 'y: the same');
    assert.ok(Math.abs(b[2] - a[2]) < 1e-5, 'depth untouched');
  }
  const far = viewOutProjection(proj);
  const fpv = multiply(far, view);
  for (const p of [[-3, 2, -10], [0, 0.5, -4], [4, 3, -200]]) {
    const a = project(pv, p), b = project(fpv, p);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5, 'the same NDC: the crop and the background line up with the room');
  }
  const viewDepth = (d) => project(far, [0, 0, -d])[2];
  assert.ok(Math.abs(viewDepth(VIEW_NEAR) + 1) < 1e-4 && Math.abs(viewDepth(VIEW_FAR) - 1) < 1e-3, 'near and far are the street\'s');
  assert.ok(VIEW_FAR > 500, 'past the interior lens\'s 500 m');
});

test('RW1 view V2: a sphere\'s rectangle on the screen is conservative - every point of the sphere lands inside it, a sphere behind the eye is none, one through the eye\'s plane is all of it, one off to the side is none; the rectangle grows by the margin and the target follows its size (mutants: the depth range taken whole, the behind test, the margin, the bucket)', () => {
  const proj = mirrorProjectionX(perspective(1.1, 1.6, 0.05, 500));
  const view = lookAt([0, 1.6, 0], [0, 1.6, -10], [0, 1, 0]);
  const pv = multiply(proj, view);
  for (const [c, r] of [[[0.5, 1.8, -6], 0.8], [[-2, 1, -4], 1.5], [[3, 2.5, -12], 2], [[0, 1.6, -2.5], 2]]) {
    const rect = sphereNdcRect(pv, c[0], c[1], c[2], r);
    assert.ok(rect, `a sphere ahead at ${c} answers a rectangle`);
    for (let i = 0; i < 300; i++) {
      const u = (i * 0.618) % 1, v = (i * 0.414) % 1, th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
      const p = [c[0] + r * Math.sin(ph) * Math.cos(th), c[1] + r * Math.cos(ph), c[2] + r * Math.sin(ph) * Math.sin(th)];
      const q = project(pv, p);
      if (Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1) continue;   // off screen: the rectangle is held to it
      assert.ok(q[0] >= rect[0] - 1e-6 && q[0] <= rect[2] + 1e-6 && q[1] >= rect[1] - 1e-6 && q[1] <= rect[3] + 1e-6, `a point of the sphere (${q}) outside ${rect}`);
    }
  }
  assert.equal(sphereNdcRect(pv, 0, 1.6, 10, 1), null, 'behind the eye');
  assert.deepEqual(sphereNdcRect(pv, 0, 1.6, -0.5, 1), [-1, -1, 1, 1], 'the eye\'s plane through it: all of the screen');
  assert.equal(sphereNdcRect(pv, 60, 1.6, -5, 1), null, 'wholly off to the side');
  assert.deepEqual(padRect([0, 0, 0.2, 0.2]), [-GLASS_RECT_MARGIN, -GLASS_RECT_MARGIN, 0.2 + GLASS_RECT_MARGIN, 0.2 + GLASS_RECT_MARGIN]);
  assert.deepEqual(padRect([-1, 0.9, 1, 1]), [-1, 0.9 - GLASS_RECT_MARGIN, 1, 1], 'held to the screen');
  assert.equal(padRect(null), null);
  const s = viewTargetSize([-1, -1, 1, 1], 1280, 720);
  assert.deepEqual([s.w, s.h], [1280 * VIEW_SCALE, 720 * VIEW_SCALE], 'the whole screen at the scale');
  assert.equal(s.allocW % VIEW_BUCKET, 0); assert.ok(s.allocW >= s.w && s.allocH >= s.h);
  const q = viewTargetSize([0, 0, 0.1, 0.1], 1280, 720);
  assert.deepEqual([q.w, q.h], [Math.round(0.05 * 1280 * VIEW_SCALE), Math.round(0.05 * 720 * VIEW_SCALE)], 'a pane: a pane\'s pixels');
  assert.equal(viewTargetSize([-1, -1, 1, 1], 8000, 8000).w, VIEW_MAX_SIDE, 'held to the cap');
});

test('RW1 view V3: when the street is drawn - no glass on screen draws nothing (and frees the target once unwanted long enough), glass with the row at Full draws it once and keeps it while the camera is still and young, a move or an age draws it again, Rooms only cuts nothing and paints a hole\'s sky alone (mutants: the still camera redrawn, a move kept, the rooms-only street, the release)', () => {
  const calls = [];
  let rect = null, holes = false;
  const fake = {
    takeGlassRect: () => (rect ? { rect: [...rect], holes } : null),
    outsideViewFrame: (r, proj, view, scene) => { calls.push({ r, proj: [...proj], scene }); return true; },
    releaseOutsideView: () => calls.push('released'),
  };
  const st = createViewOut();
  const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500)), view = lookAt([0, 1.6, 0], [0, 1.6, -5], [0, 1, 0]);
  const scene = { draw: () => {} };
  assert.equal(viewOutFrame(st, { renderer: fake, mode: 'full', proj, view, now: 0, scene }), null, 'no glass met: nothing');
  assert.equal(calls.length, 0);
  rect = [-0.2, -0.1, 0.3, 0.4];
  const a = viewOutFrame(st, { renderer: fake, mode: 'full', proj, view, now: 10, scene });
  assert.deepEqual(a, { rect: padRect(rect), view: true });
  assert.equal(calls.length, 1, 'drawn');
  assert.deepEqual(calls[0].r, padRect(rect), 'cropped to the glass grown by the margin');
  assert.equal(calls[0].proj[14], viewOutProjection(proj)[14], 'under the street\'s lens');
  assert.equal(calls[0].scene, scene);
  viewOutFrame(st, { renderer: fake, mode: 'full', proj, view, now: 20, scene });
  assert.equal(calls.length, 1, 'a still camera keeps its picture');
  viewOutFrame(st, { renderer: fake, mode: 'full', proj, view, now: 10 + VIEW_MAX_AGE_MS, scene });
  assert.equal(calls.length, 2, 'aged: the street moves on');
  const moved = lookAt([0.01, 1.6, 0], [0.01, 1.6, -5], [0, 1, 0]);
  viewOutFrame(st, { renderer: fake, mode: 'full', proj, view: moved, now: 20 + VIEW_MAX_AGE_MS, scene });
  assert.equal(calls.length, 3, 'a move draws it again');
  assert.equal(viewOutDue({ drawn: false }, view, rect, 0), true, 'never drawn: due');
  // rooms only: no street; the glass is not cut; a cutout's holes still get their sky
  assert.equal(viewOutFrame(st, { renderer: fake, mode: 'rooms', proj, view, now: 1000, scene }), null, 'glass alone, the street off: the room as it was');
  holes = true;
  assert.deepEqual(viewOutFrame(st, { renderer: fake, mode: 'rooms', proj, view, now: 1001, scene }), { rect: padRect(rect), view: false }, 'holes: their sky');
  assert.deepEqual(viewOutFrame(st, { renderer: fake, mode: 'full', proj, view, now: 1002, scene: null }), { rect: padRect(rect), view: false }, 'a host with no street: the sky');
  assert.equal(calls.length, 3, 'neither drew the street');
  // unwanted long enough, the target is let go
  rect = null;
  viewOutFrame(st, { renderer: fake, mode: 'full', proj, view, now: 1002 + VIEW_RELEASE_MS + 1, scene });
  assert.equal(calls.at(-1), 'released');
});

test('RW1 view V4: the view out\'s pass is a bracket - it draws into its own target under the cropped lens on the classic set with no shadow recording, the exterior\'s kept light and the host\'s clock over it, the building box on, the hooks run and the skipped mesh left out - and afterwards the frame target, the lights, the fog, the window style, the clear and the camera are as they were (mutants: a restore lost, the box left on, the skip ignored, the hooks not run)', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(9, 4, px, { opaque: true });
  const wall = { vao: { id: 'wallvao' }, subMeshes: [{ textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 0 }] };
  const wagon = { vao: { id: 'wagonvao' }, subMeshes: [{ textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 0 }] };
  // the street as an exterior frame left it
  r.setLighting(new Float32Array([0.9, 0.9, 0.9]), 0.6, new Float32Array([1, 1, 1]));
  r.setFog('linear', 0, 10, 2400, new Float32Array([0.5, 0.6, 0.7]));
  r.setWindowEmission(windowEmissionRGB('day'));
  r.setPointLights(new Float32Array([1, 2, 3, 18]), new Float32Array([1, 1, 1]));
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  r.setWindowRooms('full');
  // the interior's own state before its frame
  const roomAmb = new Float32Array([0.6, 0.55, 0.5]), roomFog = new Float32Array([0, 0, 0]), roomEm = windowEmissionRGB('disabled');
  const roomLights = new Float32Array([0, 2.6, 0, 9]);
  r.setLighting(roomAmb, 0); r.setFog('exp', 0.001, 0, 0, roomFog); r.setWindowEmission(roomEm); r.setPointLights(roomLights, new Float32Array([1, 0.8, 0.6]));
  r.setClearColor([0, 0, 0, 1]);
  const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500)), view = lookAt([0, 1.6, 0], [0, 1.6, -5], [0, 1, 0]);
  r.outsideViewSkip.add(wagon);
  const fakeShadows = { recordMesh() {}, reaches: () => false };   // a lane's shadow pass: the pass records nothing into it
  r._shadows = fakeShadows;
  const hooked = [];
  r.outsideViewDraws.add((info) => hooked.push(info.renderer === r));
  let inside = null;
  log.length = 0;
  const ok = r.outsideViewFrame([-0.5, -0.5, 0.5, 0.5], proj, view, {
    clip: [-3, 0, -3, 3, 4, 3],
    setup: (rr) => { rr.setWindowEmission(windowEmissionRGB('night')); return new Float32Array([0, 0.5, 0.86]); },
    draw: (info) => {
      inside = { ambient: [...r._ambient], fogMode: r._fogMode, emission: [...r._windowEmission], lights: [...r._pointLights], shadows: r._shadows, air: r._air, rooms: r._rw.rooms, proj: [...info.proj], light: [...r._lightDir], indirect: r._indirect[3] };
      info.renderer.drawMesh(wall, I);
      info.renderer.drawMesh(wagon, I);
    },
  });
  assert.equal(ok, true, 'a picture made');
  assert.deepEqual(hooked, [true], 'every outsideViewDraws hook ran, once');
  // inside the pass
  assert.deepEqual(inside.ambient.map((v) => Math.round(v * 100) / 100), [0.9, 0.9, 0.9], 'the street\'s kept light');
  assert.equal(inside.fogMode, 1, 'the street\'s fog');
  assert.deepEqual(inside.emission, [...windowEmissionRGB('night')], 'the host\'s clock over the kept style');
  assert.deepEqual(inside.lights, [1, 2, 3, 18], 'the street\'s lanterns, not the room\'s lamp');
  assert.equal(inside.indirect, 0, 'no indirect light from the player indoors');
  assert.deepEqual(inside.light.map((v) => Math.round(v * 100) / 100), [0, 0.5, 0.86], 'the sun where the host\'s clock says');
  assert.equal(inside.shadows, null, 'no shadow recording');
  assert.equal(inside.air, null, 'no air pass');
  assert.equal(inside.rooms, true, 'the neighbours\' windows show their rooms');
  assert.ok(Math.abs(inside.proj[0] - cropProjection(proj, [-0.5, -0.5, 0.5, 0.5])[0]) < 1e-6, 'the cropped lens');
  const t = r._rwTarget;
  const binds = log.filter((c) => c[0] === 'bindFramebuffer');
  assert.equal(binds[0][2], t.fbo, 'its own target bound first');
  assert.equal(binds.at(-1)[2], null, 'the frame target back after');
  assert.ok(log.some((c) => c[0] === 'framebufferRenderbuffer' && c[4] === t.rb), 'a depth of its own');
  const draws = log.filter((c) => c[0] === 'bindVertexArray').map((c) => c[1]?.id);
  assert.ok(draws.includes('wallvao') && !draws.includes('wagonvao'), 'the skipped mesh is left out of the pass');
  const clip = uploads(log, 'uViewClipMax');
  assert.deepEqual(clip[0], [3, 4, 3, 1], 'the building\'s box on'); assert.deepEqual(clip.at(-1), [0, 0, 0, 0], 'and off after');
  // after the pass
  assert.equal(r._ambient, roomAmb, 'the room\'s light back'); assert.equal(r._fogMode, 2, 'its fog');
  assert.equal(r._fogColor, roomFog); assert.equal(r._windowEmission, roomEm, 'its window style');
  assert.deepEqual([...r._pointLights], [...roomLights], 'its lamps');
  assert.deepEqual([...r._clearColor], [0, 0, 0, 1], 'its clear');
  assert.equal(r._rwOutside, null, 'the bracket closed');
  assert.equal(r._shadows, fakeShadows, 'the shadow pass back');
  // outside a pass, the skipped mesh draws as ever
  log.length = 0; r.beginFrame(proj, view, new Float32Array([0, 1, 0])); r.drawMesh(wagon, I);
  assert.ok(log.some((c) => c[0] === 'bindVertexArray' && c[1]?.id === 'wagonvao'), 'the skip is the pass\'s alone');
});

test('RW1 view V5: the interior frame\'s glass - setGlassView paints the background inside the rectangle (the street, or the sky alone), cuts the glass only with the street in it, and measures the frame\'s glass and holes for the next view out, which takeGlassRect hands over once (mutants: the cut without the street, the watch lost, the rectangle not forgotten, the background outside the rectangle)', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(9, 3, px, { opaque: true }); r.uploadEmissionTexture(9, 3, px, { window: true });   // DFU's window, drawn indoors
  r.uploadTexture(9, 5, px); r.uploadGlassMask(9, 5, px);                                           // an interior's declared glass
  r.uploadTexture(9, 6, px, { cutout: true });                                                       // a cutout
  r.uploadTexture(9, 4, px, { opaque: true });                                                       // a wall
  const sub = (rec, start, b) => ({ textureArchive: 9, textureRecord: rec, primitiveCount: 2, startIndex: start, _bounds: new Float32Array(b) });
  const room = { vao: {}, subMeshes: [sub(3, 0, [0, 1.5, -4, 0.5]), sub(5, 6, [1, 1.5, -4, 0.5]), sub(6, 12, [-1, 1.5, -4, 0.5]), sub(4, 18, [0, 1.5, -6, 3])] };
  const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500)), view = lookAt([0, 1.5, 0], [0, 1.5, -5], [0, 1, 0]);
  // frame 1: nothing seen yet, nothing painted, the glass measured
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
  log.length = 0;
  r.setGlassView(null);
  assert.equal(log.filter((c) => c[0] === 'drawArrays').length, 0, 'no glass known: no background');
  r.drawMesh(room, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[0], [2], [0]], 'the window plain (no view out yet), the declared glass glass (no style), the rest plain');
  assert.deepEqual(uploads(log, 'uCutout'), [[0], [1], [0]], 'the cutout picture cut, alone');
  const seen = r.takeGlassRect();
  assert.ok(seen && seen.holes, 'the glass met, and a hole among it');
  const pv = multiply(proj, view);
  for (const [x, y, z] of [[0, 1.5, -4], [1, 1.5, -4], [-1, 1.5, -4]]) {
    const q = project(pv, [x, y, z]);
    assert.ok(q[0] >= seen.rect[0] && q[0] <= seen.rect[2] && q[1] >= seen.rect[1] && q[1] <= seen.rect[3], `the pane at ${x} inside the rectangle`);
  }
  const wallQ = project(pv, [0, 4.4, -6]);
  assert.ok(wallQ[1] > seen.rect[3], 'the wall (no glass) is not measured');
  assert.equal(r.takeGlassRect(), null, 'handed over once');
  // frame 2: the street in it - the background over the rectangle, the glass cut inside it
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
  r._rwEnsureTarget(64, 64);   // a view out already drawn
  log.length = 0;
  r.setGlassView({ rect: [-0.5, -0.25, 0.5, 0.75], view: true });
  const bg = log.findIndex((c) => c[0] === 'drawArrays' && c[1] === 'TRIANGLE_STRIP' && c[3] === 4);
  assert.ok(bg >= 0, 'the background, one strip');
  assert.deepEqual(uploads(log, 'uRect')[0], [-0.5, -0.25, 0.5, 0.75], 'inside the rectangle alone');
  assert.deepEqual(uploads(log, 'uHasView')[0], [1], 'the street in it');
  log.length = 0;
  r.drawMesh(room, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[3], [0]], 'both glasses cut, the rest plain');
  assert.deepEqual([...uploads(log, 'uGlassRect')[0][0]], [160, 150, 480, 350], 'the rectangle in the frame\'s pixels');
  // frame 3: only the sky (holes with the street off) - the glass is NOT cut
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
  log.length = 0;
  r.setGlassView({ rect: [-0.5, -0.25, 0.5, 0.75], view: false });
  assert.deepEqual(uploads(log, 'uHasView')[0], [0], 'the sky alone');
  log.length = 0; r.drawMesh(room, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[2], [0]], 'the window plain, the declared glass glass - nothing cut');
  // a dungeon frame (no setGlassView): nothing watched
  r.takeGlassRect(); r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
  r.drawMesh(room, I);
  assert.equal(r.takeGlassRect(), null, 'a frame that never armed the watch measures nothing');
});

test('RW1 view V6: the glass door a non-ARENA2 room declares - uploadGlassMask rides the emission unit as glass (never an emission, never a window style), refuses a record with an emission map of its own, and is freed by the emission eviction its `e:` key names (mutants: the glass kept as an emission, the refusal lost, the eviction leaking)', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(7, 1, px);
  const tex = r.uploadGlassMask(7, 1, px);
  assert.ok(tex, 'declared');
  assert.equal(r.glassMasks.get('7_1'), tex);
  assert.equal(r.emissionTextures.has('7_1'), false, 'not an emission map');
  assert.equal(r.windowMasks.has('7_1'), false, 'not DFU\'s window');
  assert.equal(r.uploadGlassMask(7, 1, px), tex, 'the same key, the same mask');
  r.uploadEmissionTexture(7, 2, px, { window: true });
  assert.equal(r.uploadGlassMask(7, 2, px), null, 'a window of DFU\'s table is glass already');
  assert.ok(r.emissionTextures.has('7_2'), 'and keeps its emission');
  const mesh = { vao: {}, subMeshes: [{ textureArchive: 7, textureRecord: 1, primitiveCount: 2, startIndex: 0 }] };
  r.beginFrame(I, I, new Float32Array([0, 1, 0])); r.setWindowRooms('full'); r.setWindowEmission(windowEmissionRGB('night'));
  log.length = 0; r.drawMesh(mesh, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[2], [0]], 'from a street frame: glass, no room, no glow');
  assert.equal(mesh.subMeshes[0]._evEmis, tex, 'the mask on the emission unit');
  assert.equal(r.evictEmissionTexture('7_1'), true, 'freed by its e: key');
  assert.equal(r.glassMasks.has('7_1'), false);
  assert.ok(log.some((c) => c[0] === 'deleteTexture' && c[1] === tex));
  const m = glassMaskFromAlpha({ width: 2, height: 1, colors: new Uint8ClampedArray([9, 9, 9, 0, 9, 9, 9, 255]) });
  assert.deepEqual([...m.colors], [255, 255, 255, 255, 0, 0, 0, 0], 'a cutout\'s holes as a mask');
  assert.equal(glassTexelCount(m), 1);
});

test('RW1 view V7: a cutout picture - { cutout: true } marks the texture (a later ask marks a key already held), its sub-meshes cut in the lit pass and nowhere else, and the shadow casters replay a cut sub-mesh on its own with the half-alpha program and its picture, the rest in runs as ever (mutants: the flag lost, every picture cut, the shadow replay casting the holes, the cells kept for a cut mesh)', () => {
  const log = [];
  const r = recordingRenderer(log);
  const a = r.uploadTexture(5, 1, px, { cutout: true });
  r.uploadTexture(5, 2, px);
  const b = r.textures.get('5_2');
  assert.equal(r._cutoutArt.has(a), true); assert.equal(r._cutoutArt.has(b), false, 'no other picture');
  r.uploadTexture(5, 2, px, { cutout: true });
  assert.equal(r._cutoutArt.has(b), true, 'a cutout ask cuts the picture the key already holds');
  r.uploadTexture(5, 3, px, { opaque: true });
  const mesh = { vao: {}, bounds: new Float32Array([0, 0, 0, 1]), subMeshes: [
    { textureArchive: 5, textureRecord: 3, primitiveCount: 2, startIndex: 0, _bounds: new Float32Array([0, 0, 0, 1]) },
    { textureArchive: 5, textureRecord: 1, primitiveCount: 2, startIndex: 6, _bounds: new Float32Array([0, 0, 0, 1]) },
    { textureArchive: 5, textureRecord: 3, primitiveCount: 2, startIndex: 12, _bounds: new Float32Array([0, 0, 0, 1]) },
  ], shadowCells: [{ startIndex: 0, primitiveCount: 6, _bounds: new Float32Array([0, 0, 0, 1]) }], shadowVao: { id: 'cells' } };
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  log.length = 0; r.drawMesh(mesh, I);
  assert.deepEqual(uploads(log, 'uCutout'), [[0], [1], [0]], 'the cut picture cut, the two others not');
  assert.equal(mesh._evAnyCut, true);
  // the shadow casters
  const sl = [];
  const gl = new Proxy({}, { get: (_, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, nm) => ({ nm, p });
    if (typeof k === 'string' && k.startsWith('create')) return () => ({});
    if (typeof k === 'string' && k.toUpperCase() === k) return k;
    return (...args) => sl.push([k, ...args]);
  } });
  const sp = new ShadowPass(gl, { build: (vs, fs) => ({ fs }), vs: { mesh: 'mesh', bb: 'bb', terrain: 'terrain', char: 'char' } });
  assert.equal(sp.programs.meshCutout.p.fs, DEPTH_BB_FS, 'the half-alpha cut, the flats\' own');
  sp.recordMesh(mesh, I, null);
  sl.length = 0;
  sp.replay({ bindVao: (v) => sl.push(['bindVao', v]) }, I, null);
  const progs = sl.filter((c) => c[0] === 'useProgram').map((c) => c[1].fs);
  assert.deepEqual(progs, [DEPTH_FS, DEPTH_BB_FS, DEPTH_FS], 'the run, the cut one, the run again');
  assert.ok(sl.some((c) => c[0] === 'bindTexture' && c[2] === mesh.subMeshes[1]._evTex), 'the cut sub-mesh\'s own picture');
  assert.ok(!sl.some((c) => c[0] === 'bindVao' && c[1]?.id === 'cells'), 'a mesh with a cut picture replays its sub-meshes, not its cells');
  assert.equal(sl.filter((c) => c[0] === 'drawElements').length, 3);
  // INCIDENT 2026-09-04's law stands for every other picture: the model shader's only alpha cut is the flag's
  const fs = rd('src/render/renderer.js');
  const model = fs.slice(fs.indexOf('const FS = `'), fs.indexOf('const CHAR_FS = `'));
  assert.ok(!/tex\.a/.test(model) && model.split('${RW_MAIN_CUTOUT}').length === 2, 'the classic FS reads no alpha but through the block\'s one line, behind its flag');
});

test('RW1 view V8: which interior texels are glass - a building interior\'s own record whose bitmap carries enough of the glass index and no more than a pane\'s share, never a dungeon\'s, a crypt\'s or an exterior set\'s; the pipeline asks it after the emissive arm and never of a mod\'s picture (mutants: a dungeon set taken, the count or share bounds, the arm before the emissive one)', () => {
  const bm = (n, size = 64 * 64) => { const data = new Uint8Array(size); for (let i = 0; i < n; i++) data[i * 7 % size] = GLASS_INDEX; return { width: 64, height: 64, data }; };
  const cut = (b) => ({ glass: b.data.filter((v) => v === GLASS_INDEX).length });
  for (const a of [16, 116, 316, 416, 44, 60, 63, 66, 11, 28, 37, 40]) assert.ok(isInteriorGlassArchive(a), `${a}: a building's interior`);
  for (const a of [19, 22, 23, 24, 25, 45, 47, 48, 68, 41, 12, 14, 9, 504, 1210, -16]) assert.equal(isInteriorGlassArchive(a), false, `${a}: no street window in it`);
  assert.deepEqual(interiorGlassMask(316, bm(GLASS_MIN_TEXELS), cut), { glass: GLASS_MIN_TEXELS }, 'a pane');
  assert.equal(interiorGlassMask(316, bm(GLASS_MIN_TEXELS - 1), cut), null, 'too few: a speck of a colour');
  assert.equal(interiorGlassMask(316, bm(Math.floor(GLASS_MAX_SHARE * 4096) + 1), cut), null, 'too many: a colour, not a pane');
  assert.ok(interiorGlassMask(316, bm(Math.floor(GLASS_MAX_SHARE * 4096)), cut));
  assert.equal(interiorGlassMask(322, bm(200), cut), null, 'a dungeon set');
  const p = rd('src/scenes/dataPipeline.js');
  const emissive = p.indexOf('renderer.uploadEmissionTexture(archive, record, color32, { white: true, replacement });');
  const arm = p.indexOf('} else if (!t.vendor && !swap && isInteriorGlassArchive(archive) && renderer.uploadGlassMask) {');
  assert.ok(emissive > 0 && arm > emissive && arm - emissive < 200, 'the last arm, after the auto-emissive one (a fireplace keeps its glow)');
  assert.match(p.slice(arm, arm + 800), /const glass = interiorGlassMask\(archive, bitmap, \(b\) => t\.getWindowColors32\(b\)\);\n\s+if \(glass\) renderer\.uploadGlassMask\(archive, record, glass, \{ replacement \}\);/);
});

test('RW1 view V9: the interior\'s merge keeps a sphere a model per sub-mesh, so a window measured on the screen is its own model\'s and not the room\'s, and a pixel\'s merge keeps none (mutants: the pieces off, a piece\'s sphere wrong)', () => {
  const quad = (x) => ({ positions: new Float32Array([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0]), normals: new Float32Array(12), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 9, textureRecord: 3, startIndex: 0, primitiveCount: 2 }] });
  const key = (a, r) => `${a}_${r}`;
  const sb = new StaticBatchBuilder({ pieces: true });
  sb.add(quad(0), I, key); sb.add(quad(10), I, key);
  const m = sb.finish();
  assert.equal(m.subMeshes.length, 1, 'one sub-mesh for the one picture');
  const p = m.subMeshes[0].pieces;
  assert.equal(p.length, 8, 'two models, two spheres');
  assert.ok(Math.abs(p[0] - 0.5) < 1e-6 && Math.abs(p[4] - 10.5) < 1e-6, 'each at its own model');
  assert.ok(p[3] < 1 && p[7] < 1, 'each a model\'s size, not the batch\'s');
  const plain = new StaticBatchBuilder(); plain.add(quad(0), I, key);
  assert.equal(plain.finish().subMeshes[0].pieces, undefined, 'a pixel\'s merge measures none');
  assert.match(rd('src/scenes/interiorContext.js'), /const staticBuilder = new StaticBatchBuilder\(\{ pieces: true \}\);/);
});

test('RW1 view V10: THE FOUR HOSTS, the interior arm - the view out is asked once the room\'s light and air are set (its bracket puts them back), before the room\'s lamps and its beginFrame, and painted right after that beginFrame, never in the dungeon arm; world.js and exterior.js hand a street that leaves the player\'s building out; dungeonContext.js draws no view out (FLAGGED there: a dungeon has no window to the street) (mutants: the order swapped, a host without its street, the dungeon arm painting)', () => {
  const wm = rd('src/scenes/worldModes.js');
  const vo = wm.indexOf('const _rwView = viewOutFrame(viewOut, { renderer, mode: realWindowsMode(), proj, view, now: performance.now(), scene: host.outsideView?.(exteriorDoor?.matrix ?? null) ?? null });');
  const light = wm.indexOf('renderer.setLighting(new Float32Array(isNight(skyMinutes() % 1440) ? INTERIOR_NIGHT_AMBIENT : INTERIOR_AMBIENT), 0);');
  const fog = wm.indexOf("renderer.setFog('exp', 0.001, 0, 0, new Float32Array([0, 0, 0]));", light);
  const lamps = wm.indexOf('renderer.setPointLights(_itLit.data, null, _itLit.colors);\n    renderer.everyLightCasts();', vo);
  const begin = wm.indexOf('    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);   // AUDIT-EL F5: a WORLD frame - the lane replays its records for this one\n    renderer.setGlassView(_rwView);');
  assert.ok(light > 0 && fog > light && vo > fog && vo - fog < 600, 'the room\'s light and air, then the view out (a bracket: it puts them back)');
  assert.ok(lamps > vo, 'the room\'s lamps after it - its own beginFrame takes no tier the room asked for (DISC15)');
  assert.ok(begin > lamps, 'painted right after the interior\'s beginFrame');
  assert.equal(wm.split('renderer.setGlassView(').length - 1, 1, 'one arm paints it');
  const dungeonBegin = wm.indexOf('      renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);');
  assert.ok(dungeonBegin > 0 && dungeonBegin < vo, 'the dungeon arm stands above it and returns before it');
  assert.ok(!rd('src/scenes/dungeonContext.js').includes('outsideViewFrame') && !rd('src/scenes/dungeonContext.js').includes('setGlassView'), 'the dungeon host draws no view out');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /const outsideView = \(doorMatrix\) => \(\{\n\s+clip: outsideViewClip\(doorMatrix\),/, `${host}: the street leaves the building out`);
    assert.match(s, /return sunDirection\(clockMinute\);/, `${host}: the clock's sun`);
  }
  assert.match(rd('src/scenes/world.js'), /if \(ring > VIEW_RINGS\) continue;/, 'the streamed world walks VIEW_RINGS out');
  // the background's ray and sky are the camera's own
  const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500)), view = lookAt([0, 1, 0], [0, 1, -5], [0, 1, 0]);
  const rays = viewRays(proj, view);
  assert.deepEqual(rays.z.map((v) => Math.round(v * 1e6) / 1e6 + 0), [0, 0, -1], 'the centre of the screen looks where the camera does');
  const sky = viewSkyFrom([0.5, 0.6, 0.7]);
  assert.deepEqual(sky.horizon, [0.5, 0.6, 0.7], 'the horizon is the fog the street fades into');
});

test('RW1 view V11: an interior\'s declared glass never blooms - the Enhanced Lighting air pass\'s emission replay draws DFU\'s window mask and leaves the glass mask that rides the same unit (mutants: the glass replayed as an emission)', async () => {
  const { AirPass } = await import('../src/render/airPass.js');
  const calls = [];
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && k.toUpperCase() === k ? k : (...args) => calls.push([k, ...args])) });
  const fake = { gl, programs: { emitMesh: { p: {}, uProj: 'uProj', uView: 'uView', uModel: 'uModel', uEmissionTex: 'uEmissionTex', uEmissionColor: 'uEmissionColor' } }, targets: {}, _planes: new Float32Array(24), _identityView: I, _emitDepth() {}, _white: [1, 1, 1], stats: { emitDraws: 0 } };
  const mesh = { vao: {}, subMeshes: [
    { _evEmis: 'window-mask', _evWin: 1, primitiveCount: 2, startIndex: 0 },
    { _evEmis: 'glass-mask', _evWin: 2, primitiveCount: 2, startIndex: 6 },
  ] };
  const sp = { count: 1, records: [{ kind: 0, mesh, matrix: I, bounded: false }] };
  AirPass.prototype._replayEmission.call(fake, { blackTex: 'black', windowEmission: [0.8, 0.57, 0.18], bindVao() {} }, sp, I, null);
  const bound = calls.filter((c) => c[0] === 'bindTexture').map((c) => c[2]);
  assert.deepEqual(bound, ['window-mask'], 'the window blooms, the glass does not');
  assert.equal(fake.stats.emitDraws, 1);
});
