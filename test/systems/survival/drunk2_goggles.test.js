// AUDIT DRUNK2 (2026-10-17) - THE BEER GOGGLES, DRAWN (src/render/drunkGoggles.js). The other DRUNK2 suites hand the feel a
// renderer with no `gl`, so the pass itself never ran in a test. Here it runs against a FAKE WebGL2 context that records
// every call (buildProgram's own createProgram / createShader / link-status questions answered, the made program held so
// `isProgram` can say it is lost) and a fake renderer that records the foreign pass's bracket. Pinned: nothing at all at
// no strength; at a strength the order resolveFrame -> endWorldPass -> endUiRun -> copy -> draw -> markForeignPass; the
// viewport during the draw is the presented picture's place in GL's bottom-up pixels (a pillarbox, and a rect with a y
// offset to pin the flip); the uRect uniform is that place as shares of the buffer; the baseline (depth test, culling, the
// whole-buffer viewport) is put back; the copy is sized once a size; a lost program is built again.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawDrunkGoggles, releaseDrunkGoggles, GOGGLES } from '../../../src/render/drunkGoggles.js';

/** A recording WebGL2: every method logs [name, ...args]; a constant (an UPPER_CASE name) answers its own name. */
function fakeGl(w = 1920, h = 1080) {
  const log = [];
  const programs = new Set();
  let n = 0;
  const token = (kind) => ({ kind, n: ++n });
  const own = {
    drawingBufferWidth: w, drawingBufferHeight: h, log, programs,
    createProgram() { const p = token('program'); programs.add(p); log.push(['createProgram']); return p; },
    createShader(type) { const s = token('shader'); log.push(['createShader', type]); return s; },
    getProgramParameter() { return true; },
    getShaderParameter() { return true; },
    isProgram(p) { return programs.has(p); },
    deleteProgram(p) { programs.delete(p); log.push(['deleteProgram']); },
    getUniformLocation(_p, name) { return { name }; },
    createVertexArray() { return token('vao'); },
    createTexture() { return token('texture'); },
    lose() { programs.clear(); },
  };
  return new Proxy(own, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) return key;   // GL's constants, as their own names
      return (...args) => { log.push([key, ...args]); };
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}
/** A renderer around it: the passes it is asked to close are logged in the same order as the GL's calls. */
function fakeRenderer(gl) {
  const mark = (name) => () => { gl.log.push([name]); };
  return { gl, resolveFrame: mark('resolveFrame'), endWorldPass: mark('endWorldPass'), endUiRun: mark('endUiRun'), markForeignPass: mark('markForeignPass') };
}
const names = (gl) => gl.log.map((c) => c[0]);
/** The calls of one name, in order, each as its arguments. */
const calls = (gl, name) => gl.log.filter((c) => c[0] === name).map((c) => c.slice(1));
/** A uniform's last value: the arguments after its location, by the uniform's name. */
const uniform = (gl, fn, name) => calls(gl, fn).filter((a) => a[0]?.name === name).map((a) => a.slice(1)).at(-1);
/** The viewport in force when the draw was issued. */
const viewportAtDraw = (gl) => {
  const at = names(gl).lastIndexOf('drawArrays');
  const v = gl.log.slice(0, at).filter((c) => c[0] === 'viewport').at(-1);
  return v?.slice(1);
};

test('AUDIT DRUNK2: no goggles at no strength - not a call on the context nor a pass closed, whatever the clock or the rect', () => {
  const gl = fakeGl();
  const r = fakeRenderer(gl);
  for (const k of [0, -0.5, NaN, undefined, null]) {
    assert.equal(drawDrunkGoggles(r, /** @type {any} */ (k), 5, { x: 0, y: 0, w: 1920, h: 1080 }), false, String(k));
  }
  assert.deepEqual(gl.log, [], 'sober: the frame is left exactly as it stood');
  // and no context at all (a test\'s stand-in renderer): nothing, and no pass closed on its behalf
  const bare = { resolveFrame() { throw new Error('closed a pass for no context'); } };
  assert.equal(drawDrunkGoggles(bare, 1, 5, null), false);
  assert.equal(drawDrunkGoggles(null, 1, 5, null), false);
});

test('AUDIT DRUNK2: a goggled frame - resolve, close the world and the UI run, copy the canvas, draw, then say a foreign pass was made, in that order', () => {
  const gl = fakeGl();
  const r = fakeRenderer(gl);
  assert.equal(drawDrunkGoggles(r, 0.5, 3, null), true);
  const n = names(gl);
  const at = (name) => { const i = n.indexOf(name); assert.ok(i >= 0, `${name} was called`); return i; };
  const order = ['resolveFrame', 'endWorldPass', 'endUiRun', 'copyTexSubImage2D', 'drawArrays', 'markForeignPass'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `in order: ${n.join(' ')}`);
  assert.equal(n.filter((x) => x === 'drawArrays').length, 1, 'one draw');
  assert.deepEqual(calls(gl, 'drawArrays'), [['TRIANGLES', 0, 3]], 'the one full-screen triangle');
  assert.equal(n.at(-1), 'markForeignPass', 'the foreign pass is declared last, once the baseline is back');
  assert.equal(n.filter((x) => x === 'markForeignPass').length, 1);
  assert.ok(at('useProgram') > at('copyTexSubImage2D') && at('useProgram') < at('drawArrays'), 'the copy is taken before the program is set');
  assert.ok(n.indexOf('disable') > order[3] && n.indexOf('disable') < order[4], 'depth, culling and blend are off for the draw, after the copy');
  assert.deepEqual(calls(gl, 'disable'), [['DEPTH_TEST'], ['CULL_FACE'], ['BLEND']]);
  assert.deepEqual(calls(gl, 'copyTexSubImage2D'), [['TEXTURE_2D', 0, 0, 0, 0, 0, 1920, 1080]], 'the whole buffer is copied');
});

test('AUDIT DRUNK2: the draw is inside the presented picture - a pillarbox is its own viewport and uRect, the whole buffer when no rect is given', () => {
  const pillar = fakeGl();
  drawDrunkGoggles(fakeRenderer(pillar), 1, 2, { x: 240, y: 0, w: 1440, h: 1080 });
  assert.deepEqual(viewportAtDraw(pillar), [240, 0, 1440, 1080], 'retro mode\'s 4:3 picture in 1920 by 1080: the bars stay out of the pass');
  assert.deepEqual(uniform(pillar, 'uniform4f', 'uRect'), [240 / 1920, 0, 1440 / 1920, 1]);
  assert.deepEqual(uniform(pillar, 'uniform2f', 'uPx'), [1 / 1920, 1 / 1080], 'one pixel in uv is the buffer\'s, not the picture\'s');

  const whole = fakeGl();
  drawDrunkGoggles(fakeRenderer(whole), 1, 2, null);
  assert.deepEqual(viewportAtDraw(whole), [0, 0, 1920, 1080]);
  assert.deepEqual(uniform(whole, 'uniform4f', 'uRect'), [0, 0, 1, 1]);
});

test('AUDIT DRUNK2: the rect is the HUD\'s (from the top) and the viewport GL\'s (from the bottom) - a y offset is flipped, not copied', () => {
  const gl = fakeGl();
  drawDrunkGoggles(fakeRenderer(gl), 1, 2, { x: 100, y: 200, w: 1500, h: 600 });
  // 200 down from the top of 1080 with a height of 600 puts the picture's bottom edge 280 up from GL's bottom
  assert.deepEqual(viewportAtDraw(gl), [100, 280, 1500, 600]);
  assert.deepEqual(uniform(gl, 'uniform4f', 'uRect'), [100 / 1920, 280 / 1080, 1500 / 1920, 600 / 1080]);
  // a picture hung from the top edge sits at the top of GL's buffer
  const top = fakeGl();
  drawDrunkGoggles(fakeRenderer(top), 1, 2, { x: 0, y: 0, w: 1920, h: 400 });
  assert.deepEqual(viewportAtDraw(top), [0, 680, 1920, 400]);
  // a smaller buffer: the shares are of the buffer asked, not of a 1080 the code assumes
  const small = fakeGl(1280, 720);
  drawDrunkGoggles(fakeRenderer(small), 1, 2, { x: 160, y: 60, w: 960, h: 600 });
  assert.deepEqual(viewportAtDraw(small), [160, 60, 960, 600]);
  assert.deepEqual(uniform(small, 'uniform4f', 'uRect'), [160 / 1280, 60 / 720, 960 / 1280, 600 / 720]);
});

test('AUDIT DRUNK2: the baseline is put back - depth test and culling on, the viewport the whole buffer, the vertex array unbound - after the draw', () => {
  const gl = fakeGl();
  drawDrunkGoggles(fakeRenderer(gl), 0.7, 4, { x: 240, y: 0, w: 1440, h: 1080 });
  const n = names(gl);
  const after = gl.log.slice(n.lastIndexOf('drawArrays') + 1);
  assert.deepEqual(after, [['bindVertexArray', null], ['enable', 'DEPTH_TEST'], ['enable', 'CULL_FACE'], ['viewport', 0, 0, 1920, 1080], ['markForeignPass']]);
  assert.deepEqual(calls(gl, 'enable'), [['DEPTH_TEST'], ['CULL_FACE']], 'blend stays off, as the 2D pass after it sets its own');
});

test('AUDIT DRUNK2: the uniforms - the strength clamped to one, the clock, the table\'s wave, ghost, blur, glow, saturation and warmth', () => {
  const gl = fakeGl();
  drawDrunkGoggles(fakeRenderer(gl), 3, 12.5, null);
  assert.deepEqual(uniform(gl, 'uniform1f', 'uK'), [1], 'a strength past one is one');
  assert.deepEqual(uniform(gl, 'uniform1f', 'uT'), [12.5]);
  assert.deepEqual(uniform(gl, 'uniform1f', 'uWave'), [GOGGLES.wave]);
  assert.deepEqual(uniform(gl, 'uniform3f', 'uGhost'), [GOGGLES.ghost.x, GOGGLES.ghost.y, GOGGLES.ghost.mix]);
  assert.deepEqual(uniform(gl, 'uniform1f', 'uBlurPx'), [GOGGLES.blurPx]);
  assert.deepEqual(uniform(gl, 'uniform1f', 'uGlow'), [GOGGLES.glow]);
  assert.deepEqual(uniform(gl, 'uniform1f', 'uSat'), [GOGGLES.saturate]);
  assert.deepEqual(uniform(gl, 'uniform3f', 'uWarm'), [...GOGGLES.warm]);
  assert.deepEqual(uniform(gl, 'uniform1i', 'uFrame'), [0], 'the copy is texture unit 0');
  const half = fakeGl();
  drawDrunkGoggles(fakeRenderer(half), 0.25, 0, null);
  assert.deepEqual(uniform(half, 'uniform1f', 'uK'), [0.25]);
});

test('AUDIT DRUNK2: one program and one copy a context - made on the first frame, sized once a buffer size, released on request, built again once lost', () => {
  const gl = fakeGl();
  const r = fakeRenderer(gl);
  drawDrunkGoggles(r, 1, 0, null);
  drawDrunkGoggles(r, 1, 1, null);
  assert.equal(calls(gl, 'createProgram').length, 1, 'the second frame reuses the program');
  assert.equal(calls(gl, 'texImage2D').length, 1, 'and the copy\'s storage');
  assert.equal(calls(gl, 'copyTexSubImage2D').length, 2, 'but the canvas is copied every frame');
  assert.deepEqual(calls(gl, 'texImage2D')[0].slice(0, 9), ['TEXTURE_2D', 0, 'RGBA8', 1920, 1080, 0, 'RGBA', 'UNSIGNED_BYTE', null]);
  // the canvas resized: the storage is made again at the new size
  gl.drawingBufferWidth = 1280; gl.drawingBufferHeight = 720;
  drawDrunkGoggles(r, 1, 2, null);
  assert.equal(calls(gl, 'texImage2D').length, 2);
  assert.deepEqual(calls(gl, 'texImage2D')[1].slice(3, 5), [1280, 720]);
  assert.equal(calls(gl, 'createProgram').length, 1);
  // a lost and restored context keeps its `gl` but not what was made on it: the program is built again and the draw uses it
  const first = calls(gl, 'useProgram').at(-1)[0];
  gl.lose();
  assert.equal(drawDrunkGoggles(r, 1, 3, null), true);
  assert.equal(calls(gl, 'createProgram').length, 2, 'a program that is no program is rebuilt');
  const second = calls(gl, 'useProgram').at(-1)[0];
  assert.notEqual(second, first);
  assert.ok(gl.programs.has(second), 'the draw uses the new one');
  drawDrunkGoggles(r, 1, 4, null);
  assert.equal(calls(gl, 'createProgram').length, 2, 'and keeps it');
  // the context lets them go on request (and a context never drawn on has nothing to let go)
  const before = calls(gl, 'deleteProgram').length;
  releaseDrunkGoggles(gl);
  assert.equal(calls(gl, 'deleteProgram').length, before + 1);
  assert.deepEqual([calls(gl, 'deleteTexture').length, calls(gl, 'deleteVertexArray').length], [1, 1]);
  releaseDrunkGoggles(gl);
  assert.equal(calls(gl, 'deleteProgram').length, before + 1, 'released once');
  releaseDrunkGoggles(fakeGl());
});
