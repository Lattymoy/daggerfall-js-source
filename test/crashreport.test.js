// THE CRASH LINE (2026-08-21). A player's crash report arrived with
// frames and NO message - "drawMesh@https://.../main.js:404:11594" -
// because the overlay printed `err.stack` alone and SpiderMonkey's
// stack is frames ONLY, while V8's begins with "Name: message". The
// overlay had been making a browser-dependent decision it did not know
// it was making, and it cost the one line that says what was null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crashText } from '../src/ui/crashText.js';
import { Renderer } from '../src/render/renderer.js';

test('crash report: a FIREFOX stack still names the error', () => {
  // SpiderMonkey: frames only, no message anywhere in `stack`.
  const err = new TypeError('mesh is null');
  err.stack = 'drawMesh@https://x/assets/main.js:404:11594\nre@https://x/assets/main.js:489:35808';
  const out = crashText(err);
  assert.match(out, /^TypeError: mesh is null\n/, 'the message leads, always');
  assert.match(out, /drawMesh@/, 'and the frames survive');
});

test('crash report: a CHROME stack is not printed twice', () => {
  // V8 folds the message into `stack`; printing our head as well would
  // duplicate it.
  const err = new TypeError('mesh is null');
  err.stack = 'TypeError: mesh is null\n    at drawMesh (https://x/main.js:404:11)';
  const out = crashText(err);
  assert.equal(out.match(/mesh is null/g).length, 1);
  assert.match(out, /at drawMesh/);
});

test('crash report: the shapes that are not Errors at all', () => {
  // A rejection can carry anything. None of these may render as
  // "undefined" or throw inside the reporter.
  assert.equal(crashText(null), 'unknown error');
  assert.equal(crashText(undefined), 'unknown error');
  assert.equal(crashText('a string reason'), 'a string reason');
  assert.equal(crashText({ message: 'bare object' }), 'bare object');
  assert.match(crashText(new Error('')), /Error/);
  // and a stack that is not a string (some hosts hand back an object)
  const odd = new Error('odd'); odd.stack = { frames: [] };
  assert.equal(crashText(odd), 'Error: odd');
});

test('crash report: an error with NO stack still gets coordinates', () => {
  // window.onerror carries filename/lineno/colno even when `error` is
  // stripped (a cross-origin script), and they are the only location
  // left - the overlay used to drop them.
  const out = crashText({ name: 'TypeError', message: 'x is null' },
    { filename: 'https://x/main.js', lineno: 404, colno: 11594 });
  assert.equal(out, 'TypeError: x is null\nat https://x/main.js:404:11594');
});

test('crash report: the listeners use it, and there is only ONE per event', () => {
  // main.js is the entry point - it calls addEventListener and touches
  // `document` at import, so no test can load it. Read it instead.
  // It carried TWO unhandledrejection listeners; the second could only
  // ever overwrite the first with a worse-formatted message.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const ev of ['error', 'unhandledrejection']) {
    const n = [...main.matchAll(new RegExp(`addEventListener\\('${ev}'`, 'g'))].length;
    assert.equal(n, 1, `main.js registers ${n} '${ev}' listeners`);
  }
  assert.match(main, /crashOverlay\(crashText\(e\.error, e\)/, 'the error listener composes the message');
  assert.match(main, /crashText\(e\.reason\)/, 'and so does the rejection listener');
  assert.ok(!/crashOverlay\(e\.error\?\.stack/.test(main), 'no listener prints a raw stack any more');
});

// ---------------------------------------------------------------
// THE CRASH ITSELF: drawMesh must not kill the frame loop
// ---------------------------------------------------------------
test('drawMesh: an absent mesh costs a MODEL, never the run', () => {
  // The reported stack was drawMesh <- one caller: `gl.bindVertexArray(mesh.vao)`
  // on a null mesh threw out of the frame loop, requestAnimationFrame
  // stopped, and the whole scene died for ONE model the player's
  // ARCH3D did not carry. NEVER TRAPS says that costs the model.
  //
  // Renderer needs a real WebGL2 context, so drive the real method
  // against a `this` that records every gl call: the point of the pin
  // is that it touches NOTHING when the mesh is bad.
  const calls = [];
  const gl = new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'TRIANGLES' || prop === 'UNSIGNED_INT' || prop === 'TEXTURE_2D'
        || prop === 'TEXTURE0' || prop === 'TEXTURE1') return prop;
      return (...args) => calls.push([prop, ...args]);
    },
  });
  const self = Object.assign(Object.create(Renderer.prototype),
    { gl, program: 'P', uModel: 'M', textures: new Map(), emissionTextures: new Map(), _blackTex: 'black' });
  const warns = [];
  const realWarn = console.warn;
  console.warn = (...a) => warns.push(a[0]);
  try {
    const m = new Float32Array(16);
    for (const bad of [null, undefined, {}, { vao: 1 }, { vao: 1, subMeshes: [] }]) {
      calls.length = 0;
      assert.doesNotThrow(() => Renderer.prototype.drawMesh.call(self, bad, m, null),
        `drawMesh threw on ${JSON.stringify(bad)}`);
      assert.deepEqual(calls, [], 'and it touched no GL state on the way out');
    }
    // ONE warning per distinct shape, not one per frame - sixty a
    // second would be its own kind of broken.
    const before = warns.length;
    for (let i = 0; i < 100; i++) Renderer.prototype.drawMesh.call(self, null, m, null);
    assert.equal(warns.length, before, 'the warning does not repeat');
    assert.ok(warns.some((w) => /drawMesh skipped/.test(w)), `it did warn: ${warns}`);
  } finally { console.warn = realWarn; }
});

test('drawMesh: a GOOD mesh still draws - the guard is not a mute button', () => {
  const calls = [];
  const gl = new Proxy({}, {
    get: (_, prop) => (['TRIANGLES', 'UNSIGNED_INT', 'TEXTURE_2D', 'TEXTURE0', 'TEXTURE1'].includes(prop)
      ? prop
      : (...args) => calls.push([prop, ...args])),
  });
  const self = Object.assign(Object.create(Renderer.prototype), {
    gl, program: 'P', uModel: 'M', _blackTex: 'black',
    textures: new Map([['100_2', 'tex']]), emissionTextures: new Map(),
  });
  const mesh = { vao: 'VAO', subMeshes: [{ textureArchive: 100, textureRecord: 2, primitiveCount: 4, startIndex: 6 }] };
  Renderer.prototype.drawMesh.call(self, mesh, new Float32Array(16), null);
  assert.deepEqual(calls.find((c) => c[0] === 'drawElements'),
    ['drawElements', 'TRIANGLES', 12, 'UNSIGNED_INT', 24], 'count x3 and byte offset x4');
  assert.ok(calls.some((c) => c[0] === 'bindVertexArray' && c[1] === 'VAO'));
});

// ---------------------------------------------------------------
// and the producer that could actually emit one
// ---------------------------------------------------------------
test('interior placements skip a model this ARCH3D does not carry', () => {
  // dataPipeline.getGpuMesh returns NULL for an unknown model id and
  // CACHES the null; cpuModels is written only on the success path. The
  // interior builder pushed that null into its draw list AND read
  // `cpu.positions` off undefined one line later - the only builder in
  // the port that did not skip the placement.
  const ctx = readFileSync(new URL('../src/scenes/interiorContext.js', import.meta.url), 'utf8');
  const loop = ctx.match(/for \(const p of interior\.placements\)[\s\S]*?\n {2}}/)[0];
  assert.match(loop, /if \(!gpu \|\| !cpu\) \{[\s\S]*?continue;/, 'the placement is skipped');
  assert.ok(!/drawList\.push\(\{ mesh: await getGpuMesh/.test(loop),
    'and the null never reaches the draw list');
  // the sibling builders that always had the guard, so this pin fails
  // if one of THEM loses it
  for (const [file, re] of [
    ['../src/scenes/dungeonContext.js', /if \(!gpu\) continue;/],
    ['../src/scenes/world.js', /if \(!gpu\) continue;/],
  ]) {
    assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), re, `${file} lost its guard`);
  }
});
