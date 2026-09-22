import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drawText } from '../src/ui/text.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { Renderer } from '../src/render/renderer.js';

// ═══ PERF-ON: ONE DRAW A STRING ═══════════════════════════════════
//
// Mac, 2026-09-15: "improving online performance. I notice the more
// people that are online, the worse fps becomes."
//
// MEASURED, not guessed. Every per-peer cost in net/ is bounded -
// peerBodies caps at BODIES_MAX 8 and culls past BODY_RANGE, a doll is
// one billboard batch - EXCEPT the name over each peer's head, which
// had no cap at all and cost about nine `drawScreenQuad` a peer a
// frame. And `drawScreenQuad` is a full GL state setup: eight
// uniforms, a texture bind and a draw, roughly ten GL calls A LETTER.
// The names were the whole of the slope.
//
// The glyphs of one string share a texture and a colour and cannot
// overlap each other, so they are a RUN: one draw, issued where the
// per-glyph calls were.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, glyphWidth: () => 5, glyphSpacing: 1 };
const font = { fnt: FNT, tex: 'FONT-TEX' };

/** A renderer that records quads the per-glyph way. */
const perGlyph = () => {
  const quads = [];
  return { quads, drawScreenQuad: (tex, dst, src, color) => quads.push({ tex, dst, src, color }) };
};
/** ...and one that takes the run. */
const batched = () => {
  const quads = [], runs = [];
  return {
    quads, runs,
    drawScreenQuad: (tex, dst, src, color) => quads.push({ tex, dst, src, color }),
    drawScreenQuadRun: (tex, qs, color) => { runs.push({ tex, n: qs.length, color }); for (const q of qs) quads.push({ tex, dst: q.dst, src: q.src, color }); },
  };
};

// ═══ A REAL `Renderer` OVER A LOGGING GL STUB ══════════════════════
// The glstate.test.js / audit26 precedent, narrowed to what a run
// touches. Every GL enum gets a stable number, every creator hands
// back an object, and every other call is logged - with typed-array
// arguments COPIED, because the renderer reuses its instance buffer in
// place and a live reference would read the NEXT call's bytes.
const enumIds = new Map();
const glEnum = (k) => {
  if (!enumIds.has(k)) enumIds.set(k, 0x9000 + enumIds.size);
  return enumIds.get(k);
};
function loggingRenderer(log, size = { w: 640, h: 400 }) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return size.w;
      if (k === 'drawingBufferHeight') return size.h;
      if (typeof k === 'string' && k.toUpperCase() === k) return glEnum(k);
      return (...args) => { log.push([k, ...args.map((v) => (ArrayBuffer.isView(v) ? v.slice() : v))]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: size.w, clientHeight: size.h, width: size.w, height: size.h };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
/** The instance floats of the last run uploaded, exactly as many as it uploaded. */
function packed(log) {
  const e = log.filter((x) => x[0] === 'bufferSubData').at(-1);
  assert.ok(e, 'the run uploaded no instance data at all');
  const [, , , arr, srcOffset, length] = e;
  return arr.subarray(srcOffset, srcOffset + length);
}

test('PERF-ON: the batched run draws the SAME quads as the per-glyph path, in the same order', () => {
  // THE PIN THAT MATTERS. A faster path that moves a pixel is not a
  // faster path, it is a bug - and this is a renderer change nobody
  // can see from here (no GPU, no ARENA2), so the geometry is proven
  // by EQUALITY rather than by looking. Every dst rect, every UV, the
  // colour and the texture, glyph for glyph and in order.
  for (const [text, x, y, scale] of [
    ['Wanderer7', 100, 40, 1],
    ['THE QUICK BROWN FOX', 0, 0, 2],
    ['a b  c', 13.5, 7.25, 1.5],
    ['with odd codes — and spaces', 5, 5, 1],
    ['', 3, 3, 1],
  ]) {
    const a = perGlyph(), b = batched();
    const wa = drawText(a, font, text, x, y, scale, [0.5, 0.25, 1, 1]);
    const wb = drawText(b, font, text, x, y, scale, [0.5, 0.25, 1, 1]);
    assert.equal(wb, wa, `${JSON.stringify(text)}: the advance moved`);
    assert.deepEqual(b.quads, a.quads, `${JSON.stringify(text)}: the batched run draws different quads`);
    // ...and it really WAS one draw, not the fallback in disguise
    if (a.quads.length) {
      assert.equal(b.drawScreenQuad === undefined ? 0 : b.quads.length - b.runs.reduce((s, r) => s + r.n, 0), 0,
        'a glyph escaped the run');
      assert.equal(b.runs.length, 1, `${JSON.stringify(text)}: ${b.runs.length} draws for one string`);
      assert.equal(b.runs[0].tex, 'FONT-TEX');
      assert.deepEqual(b.runs[0].color, [0.5, 0.25, 1, 1]);
    } else {
      assert.equal(b.runs.length, 0, 'an empty string draws nothing at all');
    }
  }
});

test('PERF-ON: the per-glyph path is the FALLBACK and still works - a renderer without a run is not broken', () => {
  // Not dead code: the suite's stub renderers and the glyph-recording
  // font harness that reconstructs painted strings (nativetrade) carry
  // `drawScreenQuad` alone, and must read exactly what they always did.
  const a = perGlyph();
  drawText(a, font, 'Hello', 0, 0, 1);
  assert.equal(a.quads.length, 5, 'five glyphs, five quads, as before');
  assert.equal(typeof a.drawScreenQuadRun, 'undefined');
  assert.match(read('src/ui/text.js'), /const run = typeof renderer\?\.drawScreenQuadRun === 'function' \? \[\] : null;/,
    'the run is FEATURE-DETECTED - an optional renderer member, not a required one');
});

test('PERF-ON: the name pass no longer scales by the glyph - measured, per peer', () => {
  // The symptom's own shape: what does ONE more peer cost? Before, a
  // whole name of quads; now, one draw whatever the name's length.
  const proj = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, -1, 0]);
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1]);
  // ACC1d-MARK: `v` is EXPLICIT, and both values are measured below. The
  // relay's wire has no `v: false` - it sends `v: true` and OMITS the field
  // otherwise (server/src/index.js `_named`), so a fixture that says nothing
  // is asking for a mark, and a pin that says nothing is measuring a case it
  // did not choose.
  const peers = (n, v) => Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `Wanderer${i}`, v,
    shown: { x: 0, y: 0, z: 0, yaw: 0 }, look: { race: 1, gender: 0, face: 0, items: [] },
  }));
  const run = (n, v = true) => {
    const r = batched();
    r.createBillboardBatch = () => ({ origin: [0, 0, 0] });
    r.destroyBillboardBatch = () => {}; r.uploadTexture = () => {}; r.releaseTexture = () => {};
    const rp = new RemotePlayers({ renderer: r, deps: null, compose: async () => null });
    rp._dolls.set('*', { rec: 'd', w: 1, h: 2 });
    const g = rp._dolls.get.bind(rp._dolls); rp._dolls.get = () => g('*');
    rp.sync(peers(n, v), (p) => [p.x, p.y, p.z]);
    r.runs.length = 0; r.quads.length = 0;
    const drawn = rp.drawNames(r, font, proj, view, 1280, 800, [0, 0, 0], 1, (p) => [p.x, p.y, p.z]);
    return { drawn, draws: r.runs.length, loose: r.quads.length - r.runs.reduce((s, x) => s + x.n, 0) };
  };
  for (const n of [1, 4, 16]) {
    const m = run(n);
    assert.equal(m.drawn, n, `${n} peers, ${m.drawn} names drawn`);
    assert.equal(m.draws, n, `${n} peers must be ${n} draws - one a NAME, not one a glyph`);
    assert.equal(m.loose, 0, 'a glyph escaped the run and is a draw of its own');
  }
  // ACC1d-MARK PAYS A CONSTANT, NOT A GLYPH. A name the relay cannot vouch
  // for wears a mark, and the mark is its own draw - so an unvouched room
  // costs TWO draws a peer instead of one, and still nothing that scales
  // with how long anybody's name is. That is the whole of PERF-ON's law:
  // `Wanderer15` is ten glyphs and neither number moves with it.
  for (const n of [1, 4, 16]) {
    const m = run(n, false);
    assert.equal(m.drawn, n, `${n} marked peers, ${m.drawn} names drawn`);
    assert.equal(m.draws, 2 * n, `${n} unvouched peers must be ${2 * n} draws - a NAME and a MARK each, and neither a glyph`);
    assert.equal(m.loose, 0, 'a glyph escaped the run and is a draw of its own');
  }
});

test('PERF-ON: the run is the NARROW case, and drawScreenQuad keeps every other law', () => {
  // A run is textured, unrotated, one colour - what a string is. The
  // solid-fill arm (U10's alpha), the blend opt-in (U21c) and the
  // rotate opt (c2/S10) all stay `drawScreenQuad`'s, untouched, so no
  // art path changes and nothing else in the UI moves.
  const src = read('src/render/renderer.js');
  const runFn = src.slice(src.indexOf('  drawScreenQuadRun(tex, quads, color'), src.indexOf('    drawScreenOverlayQuad(tex, u1, v1)'));
  assert.ok(runFn.length > 500, 'the run is gone');
  assert.doesNotMatch(runFn, /opts\.rotate|uRotOn/, 'the run grew a rotate arm - that is drawScreenQuad’s');
  assert.doesNotMatch(runFn, /opts\.blend|uBlendTex/, 'the run grew the blend opt-in - that is drawScreenQuad’s');
  assert.match(runFn, /if \(!tex \|\| !n\) return;/, 'a run with no texture or no quads must draw nothing');
  // The 1-bit cutout law, and the two brackets drawScreenQuad keeps.
  assert.match(runFn, /if \(t\.a < 0\.5\) discard;/, 'the classic 1-bit cutout law is not in the run’s shader');
  assert.match(runFn, /if \(this\._worldViewportPx\) this\.endWorldPass\(\);/, 'ROAD-E E5: a run is a 2D primitive and ends the world pass too');
  // PERF-2D: the handedness bracket is the RUN's pair now (_open2D /
  // _close2D), so the run opens it and does not carry its own copy - a
  // screen quad with CULL_FACE on still draws nothing, and
  // test/handedness.test.js pins the pair itself.
  assert.match(runFn, /this\._open2D\(this\._screenQuadRunVao\)/, 'the run opens the 2D bracket');
  assert.doesNotMatch(runFn, /gl\.disable\(gl\.CULL_FACE\);/, 'and does not keep a second copy of it');
  assert.match(runFn, /this\._screenOffset\?\.\[0\] \?\? 0/, 'the letterbox offset applies to a run as it does to a quad');
  assert.match(runFn, /this\.stats\.draws\+\+;/, 'a run is a draw and must be counted as one');
  // ONE draw for the whole run.
  assert.equal((runFn.match(/drawElementsInstanced|drawArraysInstanced/g) ?? []).length, 1, 'a run is ONE draw call');
});

// ═══ THE TWO PINS THE EQUALITY PIN CANNOT BE ══════════════════════
//
// A mutation campaign against the pins above left two survivors, and
// both were holes in the pins rather than in the code:
//
//   - `h: fnt.fixedHeight * scale` -> `+ 1` SURVIVED. The equality pin
//     compares the run against the per-glyph path, but the mutation
//     lands in the `dst` both paths SHARE, so both drift together and
//     stay equal. The pin proves the two paths AGREE; it cannot prove
//     either is RIGHT. Only an absolute expectation can.
//   - `dst.x + ox` -> `dst.x` SURVIVED. The pin matched the source
//     text `this._screenOffset?.[0] ?? 0`, which is the line that
//     DECLARES ox, not the arithmetic that spends it. The F-SING
//     lesson again: a source-text pin cannot tell a wired seam from a
//     spelled one. Only running the packer can.
//
// So below: exact pixels and exact UVs for a known string, and the
// real `Renderer` driven over a logging GL stub so the bytes that
// would reach the GPU are read back out of `bufferSubData`.

test('PERF-ON: the glyph quads are ABSOLUTE - exact pixels, exact UVs, not merely "the same as before"', () => {
  // "AB" at (100, 40) scale 2, against the harness font above:
  // glyphWidth 5, fixedHeight 8, FNT_GLYPH_SPACING 1, cell 16x16 in a
  // 16-column, 15-row atlas.
  //   'A' is code 65, glyph index 65 - FNT_ASCII_START(33) = 32,
  //        so atlas cell (col 0, row 2)
  //   'B' is 66 -> 33 -> cell (col 1, row 2)
  // dst: x advances by (glyphWidth + spacing) * scale = 12 a glyph;
  //      w is glyphWidth * scale = 10; h is fixedHeight * scale = 16.
  // uv: the cell's left gw/16 of its width, its top 8/16 of its height.
  const a = perGlyph();
  const w = drawText(a, font, 'AB', 100, 40, 2, [1, 1, 1, 1]);
  assert.equal(w, 24, 'the advance is two glyph cells of (5 + 1) * 2');
  assert.deepEqual(a.quads.map((q) => q.dst), [
    { x: 100, y: 40, w: 10, h: 16 },
    { x: 112, y: 40, w: 10, h: 16 },
  ], 'the glyph rects moved - h is fixedHeight * scale, w is glyphWidth * scale, x steps by (gw + spacing) * scale');
  // The atlas is 16 x 15 cells of 16px, so 256 x 240; a glyph is the
  // cell's left 5/16 and top 8/16. Spelled out here rather than read
  // back from glyphSrc, so the window is an EXPECTATION and not a
  // restatement of the code under test.
  const cell = (col, row) => ({
    u0: (col * 16) / 256, v0: (row * 16) / 240,
    u1: ((col + 1) * 16) / 256, v1: ((row + 1) * 16) / 240,
  });
  const window5x8 = (col, row) => {
    const c = cell(col, row);
    return { u0: c.u0, v0: c.v0, u1: c.u0 + (c.u1 - c.u0) * (5 / 16), v1: c.v0 + (c.v1 - c.v0) * (8 / 16) };
  };
  assert.deepEqual(a.quads.map((q) => q.src), [window5x8(0, 2), window5x8(1, 2)],
    'the source window moved - the glyph is the cell’s left gw columns and top fixedHeight rows');
  // ...and the run carries those same absolute quads, so the pin above
  // now pins BOTH paths to the pixel rather than to each other.
  const b = batched();
  drawText(b, font, 'AB', 100, 40, 2, [1, 1, 1, 1]);
  assert.deepEqual(b.quads, a.quads);
});

test('PERF-ON: the run PACKS what it was given - the real Renderer’s instance bytes, letterbox offset and all', () => {
  // The Proxy-GL precedent (glstate.test.js / audit26): a real
  // `Renderer` over a logging stub, so `drawScreenQuadRun` runs for
  // real - program built, VAO bound, instance array packed - and the
  // floats that would reach the GPU are read back out of the
  // `bufferSubData` call. No GPU needed, and no source-text reading.
  const log = [];
  const r = loggingRenderer(log);
  const quads = [
    { dst: { x: 100, y: 40, w: 10, h: 16 }, src: { u0: 0, v0: 0.25, u1: 0.5, v1: 0.75 } },
    { dst: { x: 112, y: 40, w: 10, h: 16 }, src: { u0: 0.5, v0: 0.25, u1: 1, v1: 0.75 } },
  ];

  r.drawScreenQuadRun('TEX', quads, [1, 0.5, 0, 1]);
  assert.deepEqual([...packed(log)], [
    100, 40, 10, 16, 0, 0.25, 0.5, 0.75,
    112, 40, 10, 16, 0.5, 0.25, 1, 0.75,
  ], 'eight floats a quad: dst x, y, w, h then src u0, v0, u1, v1 - the stride the VAO declares');
  assert.equal(log.filter((e) => e[0] === 'drawElementsInstanced').length, 1, 'one draw for the whole run');

  // The VAO has to READ those bytes the way they were written: eight
  // floats (32 bytes) a quad, dst at 0 and src at 16, both stepping
  // once an INSTANCE. Read off the real calls, because a stride that
  // disagrees with the packer is the one bug the packed floats above
  // cannot show - every quad would sample the next quad's numbers.
  const attrib = (loc) => log.filter((e) => e[0] === 'vertexAttribPointer' && e[1] === loc).at(-1);
  assert.deepEqual(attrib(1)?.slice(2), [4, glEnum('FLOAT'), false, 32, 0], 'aDst: four floats at byte 0 of a 32-byte instance');
  assert.deepEqual(attrib(2)?.slice(2), [4, glEnum('FLOAT'), false, 32, 16], 'aSrc: four floats at byte 16 of the same instance');
  for (const loc of [1, 2]) {
    assert.deepEqual(log.filter((e) => e[0] === 'vertexAttribDivisor' && e[1] === loc).at(-1)?.[2], 1,
      `attribute ${loc} must advance once a QUAD - a divisor of 0 makes every instance the first quad`);
  }
  assert.deepEqual(log.filter((e) => e[0] === 'drawElementsInstanced').at(-1).at(-1), 2,
    'and it is instanced by the QUAD COUNT');

  // THE LETTERBOX. Every 2D primitive in this renderer is placed in
  // the letterboxed screen's coordinates, so a run that ignores
  // `_screenOffset` paints a name in the black bars. This is the pin
  // that a source-text match on the declaration line could not be.
  log.length = 0;
  r.setScreenOffset(17, 23);
  r.drawScreenQuadRun('TEX', quads, [1, 1, 1, 1]);
  assert.deepEqual([...packed(log)].slice(0, 4), [117, 63, 10, 16],
    'the letterbox offset is not SPENT on the run’s geometry - the quad packs at its raw x/y');
  assert.deepEqual([...packed(log)].slice(8, 12), [129, 63, 10, 16],
    '...on every quad of the run, not just the first');
  assert.deepEqual([...packed(log)].slice(4, 8), [0, 0.25, 0.5, 0.75], 'and the offset does not touch the UVs');
});

test('PERF-ON: a 2D primitive LEAVES GL as it found it - the bracket balances, for the quad and for the run alike', () => {
  // A side finding of this slice's mutation campaign, and the reason
  // the law is written here as a law rather than as one more `assert
  // .match` on the run's source: deleting `gl.enable(gl.CULL_FACE)`
  // from drawScreenQuad - the run's older sibling, five lines up the
  // same file - passed the ENTIRE suite. Nothing pinned it. A screen
  // quad turns CULL_FACE off because its winding is the wrong
  // handedness; leaving it off means every back face in the world pass
  // that follows draws, for the rest of the session.
  //
  // So: replay the real enables and disables and require the net to be
  // zero. Generative - it covers the blend arm's own toggle, and any
  // capability either function learns to touch later, without being
  // told which.
  const names = new Map([...enumIds].map(([k, v]) => [v, k]));
  const balance = (fn) => {
    const log = [];
    const r = loggingRenderer(log);
    fn(r); r._close2D();         // the FIRST call builds the program; the toggles are the same either way
    log.length = 0;
    fn(r);
    // PERF-2D (2026-09-19): the bracket is a RUN's now - 43% of a
    // dungeon frame's GL calls were this pair, opened and shut around
    // every single quad. The LAW is untouched and so is this pin: GL
    // still goes back exactly as it was found, just at the end of the
    // run rather than the end of the quad. `_close2D` is what every
    // path that needs the baseline calls, and it is what the renderer
    // itself calls at the head of every 3D draw and every foreign seam
    // (test/glstate.test.js reads that law out of the source), so
    // closing here is the same close the real frame does.
    r._close2D();
    const net = new Map();
    for (const [call, cap] of log) {
      if (call === 'enable') net.set(cap, (net.get(cap) ?? 0) + 1);
      if (call === 'disable') net.set(cap, (net.get(cap) ?? 0) - 1);
    }
    return net;
  };
  const quad = { dst: { x: 0, y: 0, w: 10, h: 10 }, src: { u0: 0, v0: 0, u1: 1, v1: 1 } };
  for (const [label, fn] of [
    ['drawScreenQuad', (r) => r.drawScreenQuad('TEX', quad.dst, quad.src)],
    ['drawScreenQuad blend', (r) => r.drawScreenQuad('TEX', quad.dst, quad.src, [1, 1, 1, 1], { blend: true })],
    ['drawScreenQuadRun', (r) => r.drawScreenQuadRun('TEX', [quad])],
  ]) {
    const net = balance(fn);
    // non-vacuous first: a call that toggled NOTHING would balance trivially
    assert.ok(net.size >= 2, `${label} toggled ${net.size} capabilities - the pin is reading nothing`);
    for (const cap of ['CULL_FACE', 'DEPTH_TEST']) {
      assert.ok(net.has(glEnum(cap)), `${label} no longer touches ${cap} at all`);
    }
    const leaked = [...net].filter(([, d]) => d !== 0).map(([c, d]) => `${names.get(c) ?? c}${d > 0 ? ' left ON' : ' left OFF'}`);
    assert.deepEqual(leaked, [], `${label} leaks GL state into the next pass: ${leaked.join(', ')}`);
  }
});
