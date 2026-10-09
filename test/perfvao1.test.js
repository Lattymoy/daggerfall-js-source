// PERF-VAO1 (2026-10-09, Mac: "I want to continue working to increase performance across the board, especially for
// online"; PERF-NEXT item 6, bible/07-Rendering/Performance-Online.md): ONE bindVao FOR THE LIFE OF THE RENDERER. The
// world frame handed the shadow pass and the air pass a `bindVao` closure minted that frame (renderer.js _renderPasses),
// so their `f.bindVao(vao)` met a new call target every frame - V8 deoptimized the shadow replay on it ("wrong call
// target"). The same call, one identity: pinned by identity across frames and by what it does (the renderer's own
// _bindVao, its skip of a repeat included). Never on a clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A GL that answers every call and records the VAO binds. */
function bindingGl() {
  const binds = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
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
      return (...args) => { if (k === 'bindVertexArray') binds.push(args[0]); };
    },
  });
  return { binds, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('PERF-VAO1: the shadow pass and the air pass are handed ONE bindVao, frame after frame - the same function both get, every frame - and it is the renderer\'s own _bindVao, a repeat skipped (mutants: a closure minted each frame again; one that binds past the renderer\'s skip)', () => {
  const g = bindingGl();
  const r = new Renderer(g.canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);   // the lane, and the air pass's door open (as the world host opens it)
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const seen = { shadow: [], air: [] };
  const sp = r.shadows, render = sp.render.bind(sp);
  sp.render = (f) => { seen.shadow.push(f.bindVao); return render(f); };
  assert.ok(r._air, 'the lane stands an air pass');
  const air = r._air, prepare = air.prepare.bind(air);
  air.prepare = (f) => { seen.air.push(f.bindVao); return prepare(f); };
  for (let f = 0; f < 3; f++) {
    r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  }
  assert.equal(seen.shadow.length, 3, 'the shadow pass ran each frame');
  assert.equal(seen.air.length, 3, 'and the air pass');
  const fn = seen.shadow[0];
  assert.equal(typeof fn, 'function');
  for (const f of [...seen.shadow, ...seen.air]) assert.equal(f, fn, 'one function, every frame, both passes');
  // what it does: the renderer's own bind, its repeat skipped
  const vao = { id: 'v' };
  r.markForeignPass();
  g.binds.length = 0;
  const before = r.stats.vaoBinds;
  fn(vao); fn(vao);
  assert.deepEqual(g.binds, [vao], 'bound once - the second is the renderer\'s skip');
  assert.equal(r.stats.vaoBinds - before, 1, 'counted where the renderer counts its binds');
});
