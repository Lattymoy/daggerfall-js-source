// FIELD BUGS 2026-10-12g PANE-CLIP - "Wall missing through window": "I should be looking at the outside wall there"
// (The Savage Goat in Fontbridge). The view out left out every fragment inside the entered building's model box and a
// quarter metre round it - the building's own other wing across a notch, a second model of it, a neighbour's wall
// against it, and (that near face gone, the rest seen from behind) the whole neighbour: the street showed where a wall
// stands. Now the watched frame's glass and cutout sub-meshes are drawn again, depth alone, under the view out's lens,
// and the street draws only past that depth. Pinned by execution over a recording GL (the bracket's own state is
// windows1_view.test.js V4's). bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Renderer } from '../../src/render/renderer.js';
import { setFrameTarget } from '../../src/render/renderTarget.js';
import { cropProjection, viewOutProjection, padRect, RW_MAIN_DERIVS, realWindowsGlsl, VIEW_PANE_UNIT, VIEW_PANES_MAX } from '../../src/render/realWindows.js';
import { perspective, lookAt, mirrorProjectionX, identity, multiply, trs } from '../../src/world/mat4.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const rd = (p) => hostText(p);
const I = identity();
const px = { width: 1, height: 1, colors: new Uint8ClampedArray([255, 255, 255, 255]) };

function recordingRenderer(log, deleted) {
  let id = 0;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'isVertexArray') return (v) => !!v && !deleted.has(v);
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const r = new Renderer({ getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 });
  log.length = 0;
  return r;
}
const uploads = (log, name) => log.filter((c) => /^uniform/.test(c[0]) && c[1]?.name === name).map((c) => c.slice(2));

// the room: DFU's window drawn indoors, a declared glass, a cutout, and a plain wall - at a matrix of its own
function room(r) {
  r.uploadTexture(9, 3, px, { opaque: true }); r.uploadEmissionTexture(9, 3, px, { window: true });
  r.uploadTexture(9, 5, px); r.uploadGlassMask(9, 5, px);
  r.uploadTexture(9, 6, px, { cutout: true });
  r.uploadTexture(9, 4, px, { opaque: true });
  const sub = (rec, start, b) => ({ textureArchive: 9, textureRecord: rec, primitiveCount: 2, startIndex: start, _bounds: new Float32Array(b) });
  return { vao: { id: 'roomvao' }, subMeshes: [sub(3, 0, [0, 1.5, -4, 0.5]), sub(5, 6, [1, 1.5, -4, 0.5]), sub(6, 12, [-1, 1.5, -4, 0.5]), sub(4, 18, [0, 1.5, -6, 3])] };
}
const proj = mirrorProjectionX(perspective(1, 1.6, 0.05, 500)), view = lookAt([0, 1.5, 0], [0, 1.5, -5], [0, 1, 0]);
const street = { vao: { id: 'streetvao' }, subMeshes: [{ textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 0 }] };

function watchedFrame(r, mesh, m) {
  r.beginFrame(proj, view, new Float32Array([0, 1, 0]));
  r.setGlassView(null);
  r.drawMesh(mesh, m);
  return r.takeGlassRect();
}

test('PANE-CLIP the watched frame\'s glass is drawn again, depth alone, under the view out\'s lens, before the street - and the street is clipped by it while it draws, and never after (mutants: the panes never kept; never handed on; their matrix lost; the depth not cleared; the clip never on; the sampler on the wrong unit; the clip left on)', () => {
  const log = [], deleted = new Set();
  const r = recordingRenderer(log, deleted);
  const mesh = room(r);
  const M = trs(0.5, 0, -0.25, 0, 0, 0);
  const seen = watchedFrame(r, mesh, M);
  assert.ok(seen, 'the glass was met');
  log.length = 0;
  const rect = padRect(seen.rect);
  let during = null;
  const laneFbo = { id: 'lanefbo' };
  r._frameFbo = laneFbo; setFrameTarget(laneFbo);
  const ok = r.outsideViewFrame(rect, viewOutProjection(proj), view, {
    draw: (info) => {
      during = { on: uploads(log, 'uPaneOn').at(-1), unit: uploads(log, 'uPaneDepth').at(-1) };
      info.renderer.drawMesh(street, I);
    },
  });
  setFrameTarget(null);
  assert.equal(ok, true);
  const t = r._rwTarget;
  const firstStreet = log.findIndex((c) => c[0] === 'bindFramebuffer' && c[2] === t.fbo);
  const paneBind = log.findIndex((c) => c[0] === 'bindFramebuffer' && c[2] === t.paneFbo);
  assert.ok(paneBind >= 0 && paneBind < firstStreet, 'the panes\' own target, before the street\'s');
  const before = log.slice(paneBind, firstStreet);
  assert.ok(before.some((c) => c[0] === 'framebufferTexture2D' && c[2] === 'DEPTH_ATTACHMENT' && c[4] === t.paneTex), 'a depth texture, read by the street after');
  const clear = before.findIndex((c) => c[0] === 'clear' && c[1] === 'DEPTH_BUFFER_BIT');
  const draws = before.filter((c) => c[0] === 'drawElements');
  assert.ok(clear >= 0 && clear < before.findIndex((c) => c[0] === 'drawElements'), 'cleared to the far plane before the panes');
  assert.deepEqual(draws.map((c) => c[4]), [0, 6 * 4, 12 * 4], 'the window, the declared glass and the cutout - never the wall');
  assert.deepEqual(draws.map((c) => c[2]), [6, 6, 6]);
  const pv = multiply(cropProjection(viewOutProjection(proj), rect), view);
  const sentPv = before.find((c) => c[0] === 'uniformMatrix4fv' && c[1]?.name === 'uPV')[3];
  assert.ok([...sentPv].every((v, i) => Math.abs(v - pv[i]) < 1e-5), 'the view out\'s own cropped lens');
  const models = before.filter((c) => c[0] === 'uniformMatrix4fv' && c[1]?.name === 'uModel').map((c) => [...c[3]]);
  assert.equal(models.length, 3);
  for (const mm of models) assert.deepEqual(mm, [...M], 'each pane at the matrix it was drawn at');
  assert.deepEqual(during, { on: [1], unit: [VIEW_PANE_UNIT] }, 'the street draws clipped, the depth read on its own unit');
  const bound = log.findIndex((c) => c[0] === 'activeTexture' && c[1] === 'TEXTURE0' + VIEW_PANE_UNIT);
  assert.ok(bound > firstStreet && log[bound + 1][0] === 'bindTexture' && log[bound + 1][2] === t.paneTex, 'the pane depth on that unit');
  assert.deepEqual(uploads(log, 'uPaneOn').at(-1), [0], 'off after the pass');
  assert.deepEqual(uploads(log, 'uPaneDepth').at(-1), [0], 'the sampler back on unit 0 - a picture is always bound there');
  const lastUnit = log.findLastIndex((c) => c[0] === 'activeTexture' && c[1] === 'TEXTURE0' + VIEW_PANE_UNIT);
  assert.ok(log[lastUnit + 1][0] === 'bindTexture' && log[lastUnit + 1][2] === null, 'and the unit emptied');
});

test('PANE-CLIP no glass met, or a pane whose room was let go since: no pane drawn and no clip (mutants: a deleted VAO drawn)', () => {
  const log = [], deleted = new Set();
  const r = recordingRenderer(log, deleted);
  const mesh = room(r);
  const seen = watchedFrame(r, mesh, I);
  deleted.add(mesh.vao);   // the room left between the watched frame and the view out
  log.length = 0;
  r.outsideViewFrame(padRect(seen.rect), viewOutProjection(proj), view, { draw: (info) => info.renderer.drawMesh(street, I) });
  setFrameTarget(null);
  assert.equal(log.filter((c) => c[0] === 'bindVertexArray' && c[1]?.id === 'roomvao').length, 0, 'the let-go room is never bound');
  assert.ok(!uploads(log, 'uPaneOn').some((u) => u[0] === 1), 'no pane drew: nothing clips the street');
  // a frame that met no glass hands on no panes
  r.beginFrame(proj, view, new Float32Array([0, 1, 0])); r.setGlassView(null);
  assert.equal(r.takeGlassRect(), null);
  assert.equal(r._rwPaneN, 0, 'none kept');
  assert.equal(VIEW_PANES_MAX, 256);
});

test('PANE-CLIP the law in both mesh shaders: a fragment of the street at or before the pane\'s depth is not drawn; the building\'s box is gone from the shaders and the hosts (mutants: the compare turned; the box back)', () => {
  assert.match(RW_MAIN_DERIVS, /\n {2}if \(uPaneOn > 0\.5 && gl_FragCoord\.z <= texelFetch\(uPaneDepth, ivec2\(gl_FragCoord\.xy\), 0\)\.r\) discard;/);
  assert.match(realWindowsGlsl(), /uniform highp sampler2D uPaneDepth;[^\n]*\nuniform float uPaneOn;/, 'a highp depth, and its switch');
  for (const f of readdirSync(new URL('../../src/render/', import.meta.url), { recursive: true })) {
    if (f.endsWith('.js')) assert.doesNotMatch(rd(`src/render/${f}`), /uViewClipMin|uViewClipMax|VIEW_CLIP_PAD/, `src/render/${f}`);
  }
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.doesNotMatch(rd(host), /outsideViewClip|clip: outsideView/, host);
  assert.match(rd('src/scenes/worldModes.js'), /scene: host\.outsideView\?\.\(\) \?\? null \}\);/);
});
