// PERF-FACE (2026-10-10, the owner: "Lets do an audit on this. Also keep diving for more performance improvements. I
// want to go deep"; render/shadowPass.js FACES_ALL, bible/07-Rendering/Performance-Priority.md PERF-FACE): A LIVE FACE
// THAT HOLDS THE CACHE IS LEFT.
//
// SC1 draws a lantern's movers over a copy of its static cache - and copied all six faces whenever anything moved in
// its reach: six full 512^2 depth copies a lamp a frame for a walker who stands in front of one or two of them. Now a
// live face knows whether it holds the cache and nothing else, and only a face that may hold more is copied first.
//
// THE PICTURE IS THE ORACLE. Each depth layer's contents are modelled from the GL calls themselves - a clear empties a
// layer, the copy draw sets a live layer to its cache layer's contents, a depth draw adds what it draws (its array and
// its placement) - and after every frame of a story every live face of every lamp in use must hold exactly its cache
// plus what this frame drew into it: the picture six copies made. The story walks a mover across a lamp's faces, stands
// it still past the hold (it joins the cache), moves it again, takes it away and brings it back, adds a still caster
// (a fresh cache), and moves the lamps. Then the work: a mover in front of one face copies the faces it was in, not six.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { SHADOW_TUNING, SHADOW_DYNAMIC_HOLD, SHADOW_POINT_CASTERS } from '../src/render/shadowPass.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const at = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const GL = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, TRIANGLES: 4, LESS: 513, ALWAYS: 519, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };

function recordingGl() {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in GL) return GL[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  return { calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** A room under two lamps, a mover (a crate, a mesh), the steady schedule (FLICKER-FIX's default: every map every frame). */
function stand(steady = true) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('1_1', { id: 't11' });
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const was = SHADOW_TUNING.override;
  SHADOW_TUNING.override = steady;
  const room = { vao: { id: 'vao-room' }, buffers: [], bounds: new Float32Array([0, 2, 0, 9]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const crate = { vao: { id: 'vao-crate' }, buffers: [], bounds: new Float32Array([0, 0.5, 0, 0.6]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const post = { vao: { id: 'vao-post' }, buffers: [], bounds: new Float32Array([0, 1, 0, 0.3]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  return { r, sp: r.shadows, calls, room, crate, post, restore: () => { SHADOW_TUNING.override = was; } };
}

/** The depth layers' contents, from the calls: fbo -> Set of "array@x,y,z" (the cache's and the live layers' fbos). */
function model(sp) {
  const content = new Map();
  const live = new Map(), cache = new Map();   // fbo object -> layer index
  // the cache's layers are made on the first frame that asks for them (_ensureCache) - asked again at every feed, or
  // the model would never see a cache layer and every comparison below would be empty against empty
  const layerOf = (fb) => (live.has(fb) ? `L${live.get(fb)}` : cache.has(fb) ? `C${cache.get(fb)}` : null);
  const s = { prog: null, fbo: null, vao: null, layer: null, model: null };
  return {
    content,
    feed(calls) {
      sp.pointFbos.forEach((fb, i) => live.set(fb, i));
      sp.cacheFbos.forEach((fb, i) => cache.set(fb, i));
      assert.ok(live.size === 6 * SHADOW_POINT_CASTERS, 'the live layers known');
      const drawn = new Map();   // live layer -> what this frame drew into it
      for (const c of calls) {
        const [k, a, b, m] = c;
        if (k === 'useProgram') s.prog = a;
        else if (k === 'bindFramebuffer' && a === GL.FRAMEBUFFER) s.fbo = layerOf(b);
        else if (k === 'bindVertexArray') s.vao = a;
        else if (k === 'uniform1i' && a === 'uLayer') s.layer = b;
        else if (k === 'uniformMatrix4fv' && a === 'uModel') s.model = m;
        else if (k === 'clear' && s.fbo) content.set(s.fbo, new Set());
        else if (k === 'drawArrays' && s.prog === sp.programs.copy.p && s.fbo) content.set(s.fbo, new Set(content.get(`C${s.layer}`) ?? []));
        else if ((k === 'drawElements' || k === 'drawArrays') && s.fbo) {
          const id = `${s.vao?.id}@${s.model ? [s.model[12], s.model[13], s.model[14]].map((v) => Math.round(v * 100) / 100).join(',') : '-'}`;
          if (!content.has(s.fbo)) content.set(s.fbo, new Set());
          content.get(s.fbo).add(id);
          if (s.fbo[0] === 'L') { if (!drawn.has(s.fbo)) drawn.set(s.fbo, new Set()); drawn.get(s.fbo).add(id); }
        }
      }
      return drawn;
    },
  };
}

/** Every live face of every slot in use holds its cache plus this frame's draws into it - and nothing else. */
function assertPicture(sp, m, drawn, label) {
  let faces = 0;
  if (sp._slotCached.some(Boolean)) assert.ok(sp.cacheFbos.length === 6 * SHADOW_POINT_CASTERS && [...m.content.keys()].some((l) => l[0] === 'C' && m.content.get(l).size), `${label}: the caches are seen, and hold something`);
  for (let k = 0; k < SHADOW_POINT_CASTERS; k++) {
    if (!sp._slotCached[k]) continue;   // a slot with no cache in use this frame
    for (let face = 0; face < 6; face++) {
      const L = `L${k * 6 + face}`, C = `C${k * 6 + face}`;
      const want = new Set([...(m.content.get(C) ?? []), ...(drawn.get(L) ?? [])]);
      assert.deepEqual([...(m.content.get(L) ?? [])].sort(), [...want].sort(), `${label}: slot ${k} face ${face} holds its cache and this frame's movers`);
      faces++;
    }
  }
  return faces;
}

test('PERF-FACE: every live face ends every frame as its cache plus that frame\'s movers - a mover walked across a lamp\'s faces, stood still into the cache, moved again, taken away and brought back, a still caster added, the lamps moved (mutants: a face a mover was drawn into left uncopied; a fresh cache copied by face; an emptied slot trusted; a fresh cache with nothing moving copied by face)', () => {
  const { r, sp, calls, room, crate, post, restore } = stand();
  try {
    const m = model(sp);
    let lights = new Float32Array([1.5, 2.5, 0, 10, -1.5, 2.5, 0, 10]);
    let cx = 0, cz = 3, crateOn = true, postOn = false;
    let checked = 0;
    const frame = (label) => {
      r.setPointLights(lights, new Float32Array([1, 1, 1, 1, 1, 1]));
      calls.length = 0;
      r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
      const drawn = m.feed(calls);
      checked += assertPicture(sp, m, drawn, label);
      r.drawMesh(room, I, null);
      if (crateOn) r.drawMesh(crate, at(cx, 0, cz), null);
      if (postOn) r.drawMesh(post, at(0.5, 0, -2), null);
    };
    for (let f = 0; f < 4; f++) frame(`settle ${f}`);
    // the crate walks round the lamps - through +Z, +X, -Z, -X faces of each
    for (let s = 0; s < 40; s++) { const a = s * 0.16; cx = Math.sin(a) * 3; cz = Math.cos(a) * 3; frame(`walk ${s}`); }
    for (let f = 0; f < SHADOW_DYNAMIC_HOLD + 3; f++) frame(`still ${f}`);   // past the hold: it joins the cache
    for (let s = 0; s < 6; s++) { cz -= 0.4; frame(`moves again ${s}`); }
    crateOn = false; for (let f = 0; f < 3; f++) frame(`gone ${f}`);
    postOn = true; for (let f = 0; f < 3; f++) frame(`a still caster added, nothing moving ${f}`);   // a fresh cache, no mover: every face copied
    crateOn = true; cx = -2; cz = 1; for (let s = 0; s < 5; s++) { cx += 0.3; frame(`back ${s}`); }
    postOn = false; for (let f = 0; f < 3; f++) { cx += 0.3; frame(`a still caster taken, the mover walking ${f}`); }   // a fresh cache under a mover
    lights = new Float32Array([2.5, 2.5, 1, 10, -1.5, 2.5, -1, 10]); for (let f = 0; f < 4; f++) { cz += 0.2; frame(`the lamps moved ${f}`); }
    assert.ok(checked > 400, `a story's worth of faces checked (${checked})`);
  } finally { restore(); }
});

test('PERF-FACE: the work - a mover in front of a lamp copies the faces it was drawn into, not six, and a mover gone copies those back once (mutants: every face copied again; a face reported clean after a draw)', () => {
  const { r, sp, calls, room, crate, restore } = stand();
  try {
    const copiesOf = () => { let prog = null, n = 0; for (const c of calls) { if (c[0] === 'useProgram') prog = c[1]; else if (c[0] === 'drawArrays' && prog === sp.programs.copy.p) n++; } return n; };
    let cx = 0, on = true;
    const frame = () => {
      r.setPointLights(new Float32Array([0, 2.5, 0, 10]), new Float32Array([1, 1, 1]));
      calls.length = 0;
      r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
      const n = copiesOf();
      r.drawMesh(room, I, null);
      if (on) r.drawMesh(crate, at(cx, 0.5, 4), null);   // in front of the lamp's +Z face alone
      return n;
    };
    for (let f = 0; f < 4; f++) frame();
    cx = 0.05; frame();   // it moves: a dynamic from here
    let n = 0;
    for (let f = 0; f < 10; f++) { cx += 0.05; n += frame(); }
    const k = sp.casterOf[0];
    const dirty = [...sp._faceDyn.slice(k * 6, k * 6 + 6)].filter(Boolean).length;
    assert.ok(dirty >= 1 && dirty <= 2, `the crate stands in front of one face, or on an edge two (${dirty})`);
    assert.ok(n <= 10 * 2 && n >= 10, `a copy a frame of the face it was in, not six (${n} in ten frames)`);
    on = false;
    frame();   // the frame's records are replayed at the next beginFrame: this one still has the crate (EL2)
    const gone = frame();
    assert.equal(gone, dirty, 'gone: the faces it held are put back to the cache, once');
    assert.equal(frame(), 0, 'and then nothing');
    assert.deepEqual([...sp._faceDyn.slice(k * 6, k * 6 + 6)], [0, 0, 0, 0, 0, 0], 'every face the cache again');
  } finally { restore(); }
});
