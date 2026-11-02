// PERF-ARENA (2026-10-10, Mac: "Exterior performance is really bad" - "Interior is fine. It's exterior that's the
// issue"): the still flats share their buffers. A billboard batch built still takes a range of an arena's quads - one
// VAO, one vertex buffer and one index buffer for thousands of batches - and its draws name the range by the index
// offset, so a town's flats no longer bind a VAO a draw. The record is `bible/07-Rendering/Performance-Arena.md`.
// These pins hold it to the picture: a GL that keeps what is written into its buffers resolves every triangle a draw
// rasterises, and the arena's draws resolve to the very triangles the per-batch buffers did, draw for draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, WORLD_FRAME, BB_ARENA_QUADS, BB_ARENA_MAX_QUADS, BB_ARENA_HOMES_MAX, arenaTake, arenaGive } from '../../src/render/renderer.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const RIGHT = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 4000)), VIEW = lookAt([0, 30, 90], [0, 0, 0], [0, 1, 0]);
const ARRAY = 34962, ELEMENT = 34963;

/** A GL that keeps its buffers' bytes, each VAO's attribute pointers and element buffer, the bound program and its
 *  uniforms - and answers every drawElements with the triangles it rasterises: each index resolved through the bound
 *  VAO to its corner's five floats, with the program's uOrigin and uSize at the draw. */
function modelGl() {
  let ids = 0, arrayBuf = null, vao = null, prog = null;
  const bufs = new Map(), vaos = new Map(), uniforms = new Map(), draws = [], calls = [];
  const none = { attr: [], ebo: null };
  const cur = () => (vao ? vaos.get(vao) : none);
  const consts = { ARRAY_BUFFER: ARRAY, ELEMENT_ARRAY_BUFFER: ELEMENT, TEXTURE0: 1000, TEXTURE1: 1001, TEXTURE2: 1002, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
  const copy = (data) => new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  const fns = {
    createVertexArray: () => { const v = { id: ++ids }; vaos.set(v, { attr: [], ebo: null }); return v; },
    bindVertexArray: (v) => { vao = v; },
    bindBuffer: (t, b) => { if (t === ELEMENT) cur().ebo = b; else arrayBuf = b; },
    bufferData: (t, data) => { bufs.set(t === ELEMENT ? cur().ebo : arrayBuf, typeof data === 'number' ? new Uint8Array(data) : copy(data)); },
    bufferSubData: (t, at, data, src = 0, len = undefined) => {
      const per = data.BYTES_PER_ELEMENT, n = len ?? data.length - src;
      const bytes = new Uint8Array(data.buffer, data.byteOffset + src * per, n * per);
      const into = bufs.get(t === ELEMENT ? cur().ebo : arrayBuf);
      assert.ok(at + bytes.length <= into.length, 'a write inside its buffer');
      into.set(bytes, at);
    },
    vertexAttribPointer: (i, size, _t, _n, stride, off) => { cur().attr[i] = { buf: arrayBuf, size, stride, off }; },
    useProgram: (p) => { prog = p; if (!uniforms.has(p)) uniforms.set(p, new Map()); },
    drawElements: (_mode, count, _type, off) => {
      const v = cur(), ix = bufs.get(v.ebo);
      if (!v.attr[0] || !v.attr[1] || !ix) { draws.push({ prog, origin: null, size: null, tris: null }); return; }   // not a flat's draw
      const idx = new Uint32Array(ix.buffer.slice(off, off + count * 4));
      const tris = [];
      for (const k of idx) {
        const corner = [];
        for (const a of [0, 1]) {
          const p = v.attr[a], f = new Float32Array(bufs.get(p.buf).buffer.slice(k * p.stride + p.off, k * p.stride + p.off + p.size * 4));
          corner.push(...f);
        }
        tris.push(corner);
      }
      const u = uniforms.get(prog);
      draws.push({ prog, origin: u?.get('uOrigin') ?? null, size: u?.get('uSize') ?? null, tris });
    },
  };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k in fns) return (...a) => { calls.push(k === 'bindVertexArray' && a[0] == null ? 'unbind' : k); return fns[k](...a); };   // the pass's closing unbind is no draw's
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      if (k === 'uniform3f' || k === 'uniform2f') return (loc, ...v) => { calls.push(k); uniforms.get(prog)?.set(loc, v); };
      return () => { calls.push(k); };
    },
  });
  return { gl, draws, calls, vaos, bufs, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

/** A renderer on the model GL - `arenas` false is the base (every batch its own buffers, as before PERF-ARENA). */
function stand(arenas, lane = false) {
  const m = modelGl();
  const r = new Renderer(m.canvas);
  if (!arenas) r._bbArenas = null;
  r._bbCullOff = true;   // the main pass's view cull off: these flats are not where an identity camera looks
  if (lane) r.setLightingLane(EL_LANE);
  for (const k of ['504_1', '504_2', '504_3', '210_0']) r.textures.set(k, { id: k });
  r.setLighting(new Float32Array([0.3, 0.3, 0.3]), 1);
  return { r, ...m };
}

let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
/** A town's flats: woods of many quads and single flats, three records and a lamp, some scaled (LPT1), each pixel its
 *  own origin array. */
function town(r) {
  seed = 11;
  const out = [];
  for (let k = 0; k < 40; k++) {
    const n = k % 5 === 0 ? 1 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 60);
    const centers = Array.from({ length: n }, () => [rnd() * 60 - 30, rnd() * 4, rnd() * 60 - 30]);
    const scales = k % 7 === 3 ? centers.map(() => 0.3 + rnd() * 0.7) : null;
    const b = r.createBillboardBatch(k % 9 === 0 ? 210 : 504, k % 9 === 0 ? 0 : 1 + (k % 3), { w: 1 + rnd() * 3, h: 2 + rnd() * 8 }, centers, scales ? { scales } : {});
    b.origin = [Math.floor(k / 8) * 20 - 40, 0, (k % 8) * 3 - 12];
    out.push(b);
  }
  return out;
}
const drawn = (m) => m.draws.filter((d) => d.tris).map((d) => ({ origin: d.origin, size: d.size, tris: d.tris }));

test('PERF-ARENA the allocator: over a long random life of takes and gives, no two live ranges overlap, every range is inside its arena, the free list stays ascending with no two ranges touching, and the free quads are the arena less the live ones (mutants: PERFARENA-give-no-join, PERFARENA-take-past-fit)', () => {
  const cap = 4096;
  const free = [0, cap];
  const live = [];
  seed = 5;
  for (let step = 0; step < 6000; step++) {
    if (live.length && rnd() < 0.45) {
      const [at, n] = live.splice(Math.floor(rnd() * live.length), 1)[0];
      arenaGive(free, at, n);
    } else {
      const n = 1 + Math.floor(rnd() * (rnd() < 0.1 ? 400 : 40));
      const at = arenaTake(free, n);
      if (at >= 0) live.push([at, n]);
      else { let room = 0; for (let i = 1; i < free.length; i += 2) room = Math.max(room, free[i]); assert.ok(room < n, `a take of ${n} refused while a range of ${room} was free`); }
    }
    for (let i = 0; i < free.length; i += 2) {
      assert.ok(free[i + 1] > 0 && free[i] >= 0 && free[i] + free[i + 1] <= cap, 'a free range inside the arena');
      if (i) assert.ok(free[i - 2] + free[i - 1] < free[i], 'ascending, never two touching');
    }
    const used = new Uint8Array(cap);
    for (const [at, n] of live) for (let q = at; q < at + n; q++) { assert.equal(used[q], 0, 'no two live ranges overlap'); used[q] = 1; }
    for (let i = 0; i < free.length; i += 2) for (let q = free[i]; q < free[i] + free[i + 1]; q++) assert.equal(used[q], 0, 'no free quad is live');
    let freeQuads = 0; for (let i = 1; i < free.length; i += 2) freeQuads += free[i];
    assert.equal(freeQuads + live.reduce((s, [, n]) => s + n, 0), cap, 'the free and the live are the arena');
  }
  for (const [at, n] of live.splice(0)) arenaGive(free, at, n);
  assert.deepEqual(free, [0, cap], 'all given back: one range, the whole arena');
});

test('PERF-ARENA the picture: a town of still batches (woods and single flats, three records and a lamp, scaled flats, eight origins) draws through the main pass, then the shadow pass replays it into the sun\'s cascades - every draw, in order, rasterises the very triangles (each corner\'s five floats) at the very origin and size the per-batch buffers did; and the main pass binds ONE VAO for the lot (the base: one a draw) (mutants: PERFARENA-offset-dropped, PERFARENA-corner-at-zero, PERFARENA-index-winding, PERFARENA-shadow-offset, PERFARENA-air-offset)', () => {
  const runs = [false, true].map((arenas) => {
    const s = stand(arenas, true);
    s.r.setAir(true);
    s.r.emissionTextures.set('210_0', { id: 'lamp-glow' });   // the lamps bloom: the air pass replays them
    const batches = town(s.r);
    const sun = new Float32Array([0.45, 0.8, 0.35]);
    s.r.beginFrame(PROJ, VIEW, sun, WORLD_FRAME);
    s.calls.length = 0; s.draws.length = 0;
    s.r.drawBillboards(batches, RIGHT, UP);
    const main = drawn(s), vaoBinds = s.calls.filter((c) => c === 'bindVertexArray').length;
    s.draws.length = 0;
    s.r.resolveFrame();   // the air pass: the emitters replayed into its images
    const air = drawn(s).filter((d) => d.tris.length);
    s.draws.length = 0;
    s.r.beginFrame(PROJ, VIEW, sun, WORLD_FRAME);   // the replay of the frame just drawn
    return { main, air, replay: drawn(s), vaoBinds, arenas: s.r._bbArenas?.length ?? 0 };
  });
  const [base, arena] = runs;
  assert.ok(base.air.length >= 2, `the air pass replayed the lamps (${base.air.length} draws)`);
  assert.deepEqual(arena.air, base.air, 'the air pass: the same, draw for draw');
  assert.ok(base.main.length >= 40 && base.main.every((d) => d.tris.length > 0), `the base drew the town (${base.main.length} draws)`);
  assert.deepEqual(arena.main, base.main, 'the main pass: the same triangles at the same origin and size, draw for draw');
  assert.ok(base.replay.length >= 40, `the shadow pass replayed the town into its cascades (${base.replay.length} draws)`);
  assert.deepEqual(arena.replay, base.replay, 'the shadow replay: the same, draw for draw');
  assert.equal(arena.arenas, 1, 'one arena holds the town');
  assert.equal(base.vaoBinds, base.main.length, 'the base bound a VAO a draw');
  assert.equal(arena.vaoBinds, 1, 'the arena binds one for every draw of the pass');
});

test('PERF-ARENA a batch\'s life: freed, its range goes back (its VAO with it, so no replay reaches it) and a second free gives nothing back twice; the next batch takes the range and draws its own corners there; a still batch moved (a felled tree) rewrites its range and draws where it moved, as the base does; a dynamic batch (a gib) keeps buffers of its own; a batch bigger than an arena gets one its size (mutants: PERFARENA-double-free, PERFARENA-move-at-zero, PERFARENA-dynamic-shared, AUDIT-ARENA-cap-ignores-batch)', () => {
  const runs = [false, true].map((arenas) => {
    const s = stand(arenas);
    const a = s.r.createBillboardBatch(504, 1, { w: 1, h: 2 }, [[1, 0, 1], [2, 0, 2], [3, 0, 3]]);
    const b = s.r.createBillboardBatch(504, 2, { w: 1, h: 3 }, [[4, 0, 4], [5, 0, 5]]);
    const free0 = arenas ? JSON.stringify(s.r._bbArenas[0].free) : null;
    s.r.destroyBatch(a);
    assert.equal(a.vao, arenas ? null : a.vao, 'a freed arena batch lets its VAO (the arena\'s) go');
    const free1 = arenas ? JSON.stringify(s.r._bbArenas[0].free) : null;
    s.r.destroyBatch(a); s.r.destroyBillboardBatch(a);
    if (arenas) {
      assert.notEqual(free1, free0, 'the range went back');
      assert.equal(JSON.stringify(s.r._bbArenas[0].free), free1, 'a second free gives nothing back');
    }
    const c = s.r.createBillboardBatch(504, 3, { w: 2, h: 2 }, [[7, 1, 7], [8, 1, 8]]);
    if (arenas) assert.equal(c._q0, 0, 'the next batch takes the freed range');
    s.r.moveBillboardBatch(b, [[9, -5, 9], [10, -5, 10]]);
    const gib = s.r.createBillboardBatch(210, 0, { w: 0.3, h: 0.3 }, [[0, 1, 0]], { dynamic: true });
    assert.equal(gib._arena, null, 'a dynamic batch owns its buffers');
    assert.equal(gib.buffers.length, 2);
    if (arenas) assert.ok(gib.vao !== s.r._bbArenas[0].vao);
    s.r.moveBillboardBatch(gib, [[0, 2, 0]]);
    s.r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    s.draws.length = 0;
    s.r.drawBillboards([b, c, gib], RIGHT, UP);
    // AUDIT PERF-ARENA A2: bigger than the arena the doubling would open next (twice the first), so only the batch's own
    // size can make room for it
    const bigN = 2 * BB_ARENA_QUADS + 10;
    const big = s.r.createBillboardBatch(504, 1, { w: 1, h: 1 }, Array.from({ length: bigN }, (_, i) => [i, 0, 0]));
    if (arenas) { assert.ok(big._arena.cap >= bigN, `a batch bigger than an arena: an arena with room for it (${big._arena.cap})`); assert.equal(big._q0, 0); assert.equal(big._ibOff, 0); }
    return drawn(s);
  });
  assert.equal(runs[0].length, 3);
  assert.deepEqual(runs[1], runs[0], 'the moved, the reused and the dynamic batch draw what the base draws');
});

test('PERF-ARENA the arenas fill and spill: still batches past an arena\'s room open a second twice its size (PERF-ARENA2), a record\'s batch goes to its record\'s arena first and a new record\'s takes a freed range first-fit before a new arena is made, and every batch draws its own corners wherever it landed; an arena emptied whole is let go, the first kept (mutants: PERFARENA-no-spill, PERFARENA-never-let-go, PERFARENA-first-let-go, PERFARENA2-no-growth, PERFARENA2-no-home, AUDIT-ARENA-stale-home, AUDIT-ARENA-no-home-on-first-fit)', () => {
  const s = stand(true);
  const rows = [];
  const quads = Math.floor(BB_ARENA_QUADS / 4) + 1;   // four do not fit in one arena
  for (let k = 0; k < 4; k++) rows.push(s.r.createBillboardBatch(504, 1, { w: 1, h: 1 }, Array.from({ length: quads }, (_, i) => [k, i, 0])));
  assert.equal(s.r._bbArenas.length, 2, 'the fourth spilled into a second arena');
  assert.ok(rows[3]._arena === s.r._bbArenas[1] && rows[3]._q0 === 0);
  assert.equal(s.r._bbArenas[1].cap, BB_ARENA_QUADS * 2, 'PERF-ARENA2: the second arena holds twice the first');
  s.r.destroyBatch(rows[1]);
  // PERF-ARENA2: a batch of the same record goes to its record's arena first (the second, where the last went), though
  // the first holds a freed range that fits; a batch of a record with no arena yet takes the first fit
  const kin = s.r.createBillboardBatch(504, 1, { w: 1, h: 1 }, [[41, 41, 41]]);
  assert.ok(kin._arena === s.r._bbArenas[1], 'a record\'s batches together: its home arena first');
  const back = s.r.createBillboardBatch(504, 2, { w: 1, h: 1 }, [[42, 42, 42]]);
  assert.ok(back._arena === s.r._bbArenas[0] && back._q0 === rows[1]._q0, 'first fit: the freed range in the first arena');
  assert.equal(s.r._bbArenaOfKey.get('504_2'), back._arena, 'and that arena is its record\'s home from now on (AUDIT PERF-ARENA A3)');
  s.r.destroyBatch(kin);
  s.r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  s.draws.length = 0;
  s.r.drawBillboards([rows[0], rows[3], back], RIGHT, UP);
  const firstCorner = (d) => d.tris[0].slice(0, 3);
  const byOrder = s.draws.map(firstCorner);
  assert.deepEqual(new Set(byOrder.map((c) => c.join())), new Set([[0, 0, 0], [3, 0, 0], [42, 42, 42]].map((c) => c.join())), 'each batch drew its own first corner');
  // emptied, the second arena is let go - its VAO and both buffers deleted; the first stays for the next pixel
  const second = s.r._bbArenas[1];
  s.calls.length = 0;
  s.r.destroyBatch(rows[3]);
  assert.equal(s.r._bbArenas.length, 1, 'the emptied arena is gone');
  assert.ok(s.r._bbArenas[0] !== second);
  assert.equal(s.calls.filter((c) => c === 'deleteVertexArray').length, 1, 'its VAO deleted');
  assert.equal(s.calls.filter((c) => c === 'deleteBuffer').length, 1, 'and its vertex buffer - the index buffer is every arena\'s (AUDIT PERF-ARENA A4)');
  // AUDIT PERF-ARENA A1: the let-go takes its records' homes with it - the record whose home it was goes to a standing
  // arena, and draws its own corner there
  const after = s.r.createBillboardBatch(504, 1, { w: 1, h: 1 }, [[77, 7, 7], [78, 7, 7], [79, 7, 7]]);
  assert.ok(s.r._bbArenas.includes(after._arena), 'a record homed in the let-go arena lands in a standing one');
  s.draws.length = 0;
  s.r.drawBillboards([after], RIGHT, UP);
  assert.deepEqual(firstCorner(s.draws[0]), [77, 7, 7], 'and draws its own corner');
  s.r.destroyBatch(after);
  for (const b of [rows[0], rows[2], back]) s.r.destroyBatch(b);
  assert.equal(s.r._bbArenas.length, 1, 'the first arena is kept, empty');
  assert.deepEqual(s.r._bbArenas[0].free, [0, BB_ARENA_QUADS]);
});

test('PERF-ARENA stray array state: a foreign pass that bound an array of its own behind the shadow\'s back (no markForeignPass) and left it bound - every flat of the next billboard call still draws from its arena (the call forgets the shadow on entry); and the snow\'s shared blanket, built with the arena\'s array left bound, cuts no flat\'s indices away (its element buffer is bound with no array bound) (mutants: PERFARENA-shadow-trusted, PERFARENA-snow-on-the-arena)', async () => {
  const { SnowfallSurface } = await import('../../src/render/snowfallSurface.js');
  const base = stand(false), arena = stand(true);
  const runs = [base, arena].map((s) => {
    const batches = town(s.r).slice(0, 12);
    s.r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    s.r.drawBillboards(batches.slice(0, 6), RIGHT, UP);
    s.r._bindVao(batches[6].vao);   // the shadow names a flat's array (the arena's) ...
    s.gl.bindVertexArray(s.gl.createVertexArray());   // ... and a foreign pass binds its own behind its back
    s.draws.length = 0;
    s.r.drawBillboards(batches.slice(6), RIGHT, UP);
    const drawnHere = drawn(s);
    // the snow's shared blanket built while the arena's array is bound
    const snow = new SnowfallSurface(s.gl, s.r);   // built at the snow's start, long before its blanket
    s.r._bindVao(batches[0].vao);
    snow._sharedBlanket({ uv: new Float32Array(8), index: new Uint32Array(6) });
    s.draws.length = 0;
    s.r.drawBillboards(batches.slice(0, 6), RIGHT, UP);
    return { after: drawnHere, again: drawn(s) };
  });
  assert.equal(runs[0].after.length, 6, 'the base drew the six after the stray bind');
  assert.deepEqual(runs[1].after, runs[0].after, 'the arena\'s flats drew their own triangles after the stray bind');
  assert.equal(runs[0].again.length, 6);
  assert.deepEqual(runs[1].again, runs[0].again, 'and after the snow\'s blanket was built, the same');
});

test('PERF-ARENA2 the growth: each arena holds twice the one before it, and never more than BB_ARENA_MAX_QUADS - an arena opened past a full one of the most holds the most again (mutant: PERFARENA2-unbounded)', () => {
  const s = stand(true);
  s.r.createBillboardBatch(504, 1, { w: 1, h: 1 }, [[0, 0, 0]]);
  assert.equal(s.r._bbArenas[0].cap, BB_ARENA_QUADS, 'the first: BB_ARENA_QUADS');
  s.r._bbArenas.push({ vao: s.gl.createVertexArray(), vb: null, cap: BB_ARENA_MAX_QUADS, free: [], taken: 0 });   // a full arena of the most
  s.r._bbArenas[0].free.length = 0;   // and the first full too
  const b = s.r.createBillboardBatch(504, 3, { w: 1, h: 1 }, [[1, 1, 1]]);
  assert.equal(b._arena, s.r._bbArenas[2], 'a third opened');
  assert.equal(b._arena.cap, BB_ARENA_MAX_QUADS, 'holding the most, not twice it');
});

test('AUDIT PERF-ARENA A4: ONE INDEX BUFFER FOR EVERY ARENA - every standing arena\'s array holds the same element buffer, as large as the largest arena; an arena larger than it grows it, the new one bound into every standing arena and the old let go, and the flats of the arenas made before the growth draw the very triangles they drew before it; a deleted arena deletes no index buffer (mutants: AUDIT-ARENA-not-rebound, AUDIT-ARENA-old-kept, AUDIT-ARENA-delete-shared)', () => {
  const s = stand(true);
  const ebos = () => s.r._bbArenas.map((a) => s.vaos.get(a.vao).ebo);
  const early = [s.r.createBillboardBatch(504, 1, { w: 1, h: 2 }, [[1, 0, 1], [2, 0, 2]]), s.r.createBillboardBatch(504, 2, { w: 2, h: 1 }, Array.from({ length: 40 }, (_, i) => [i, 1, -i]))];
  s.r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  s.draws.length = 0;
  s.r.drawBillboards(early, RIGHT, UP);
  const before = s.draws.map((d) => d.tris);
  const ib0 = s.r._bbIndex.ib;
  assert.equal(s.bufs.get(ib0).length, BB_ARENA_QUADS * 24, 'the first arena\'s: its own size');
  // past the first arena: a second, twice its size, and a third bigger than both
  const fill = s.r.createBillboardBatch(504, 3, { w: 1, h: 1 }, Array.from({ length: BB_ARENA_QUADS }, (_, i) => [i, 2, 0]));
  const huge = s.r.createBillboardBatch(504, 3, { w: 1, h: 1 }, Array.from({ length: 3 * BB_ARENA_QUADS }, (_, i) => [i, 3, 0]));
  assert.equal(s.r._bbArenas.length, 3, 'three arenas');
  const one = new Set(ebos());
  assert.equal(one.size, 1, 'every standing arena holds one element buffer');
  const ib = [...one][0];
  assert.equal(ib, s.r._bbIndex.ib);
  assert.ok(s.bufs.get(ib).length >= Math.max(...s.r._bbArenas.map((a) => a.cap)) * 24, 'as large as the largest arena');
  assert.notEqual(ib, ib0, 'grown');
  assert.ok(s.calls.includes('deleteBuffer'), 'the old one let go');
  s.draws.length = 0;
  s.r.drawBillboards(early, RIGHT, UP);
  assert.deepEqual(s.draws.map((d) => d.tris), before, 'the flats made before the growth draw the very triangles they drew');
  s.draws.length = 0;
  s.r.drawBillboards([fill, huge], RIGHT, UP);
  assert.deepEqual(s.draws.map((d) => d.tris[0].slice(0, 3)), [[0, 2, 0], [0, 3, 0]], 'and the new arenas\' flats their own');
  s.calls.length = 0;
  s.r.destroyBatch(huge);
  assert.equal(s.calls.filter((c) => c === 'deleteBuffer').length, 1, 'a deleted arena lets its vertex buffer go and no index buffer');
  assert.equal(new Set(ebos()).size, 1);
});

test('AUDIT PERF-ARENA A5-A7: the record homes start over past BB_ARENA_HOMES_MAX (a doll mints a key for good); an arena not standing is never spliced from the list (the free of a batch whose arena is gone takes no standing arena with it); and a dynamic batch freed by destroyBatch lets its array go as destroyBillboardBatch does (mutants: AUDIT-ARENA-homes-unbounded, AUDIT-ARENA-splice-unguarded, AUDIT-ARENA-dynamic-keeps-vao)', () => {
  const s = stand(true);
  assert.equal(BB_ARENA_HOMES_MAX, 4096);
  for (let k = 0; k < BB_ARENA_HOMES_MAX + 40; k++) {
    s.r.destroyBatch(s.r.createBillboardBatch(9000 + k, 0, { w: 1, h: 1 }, [[k, 0, 0]]));
    assert.ok(s.r._bbArenaOfKey.size <= BB_ARENA_HOMES_MAX + 1, `the homes stay bounded (${s.r._bbArenaOfKey.size})`);
  }
  const keep = s.r.createBillboardBatch(504, 1, { w: 1, h: 1 }, Array.from({ length: BB_ARENA_QUADS }, (_, i) => [i, 0, 0]));
  const second = s.r.createBillboardBatch(504, 2, { w: 1, h: 1 }, [[1, 1, 1]]);
  assert.equal(s.r._bbArenas.length, 2);
  const ghost = { _arena: { free: [], cap: 4, vao: s.gl.createVertexArray(), vb: null }, _q0: 0, _quads: 4, vao: null, buffers: [] };
  s.r.destroyBatch(ghost);
  assert.equal(s.r._bbArenas.length, 2, 'a batch whose arena is not standing takes no standing arena with it');
  assert.ok(s.r._bbArenas[1] === second._arena);
  const gib = s.r.createBillboardBatch(210, 0, { w: 0.3, h: 0.3 }, [[0, 1, 0]], { dynamic: true });
  s.r.destroyBatch(gib);
  assert.equal(gib.vao, null, 'a freed dynamic batch has no array');
  assert.deepEqual(gib.buffers, []);
  s.r.destroyBatch(keep); s.r.destroyBatch(second);
});
