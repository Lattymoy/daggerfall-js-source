// AUDIT PRE-MERGE 0928 (nav) - the Sea Update read before it merged, 2026-09-28: lens N's findings on the dungeon's
// soup bake (cd0c38262), FIELD-CONSOLE1 (88cfb1130) and the ARENA2 triage, each pinned against the real modules
// BEFORE its fix and red on the unfixed tree.
//
//   N1  the browser bakes only through the worker, and nothing held the anchor union on that path: the client could
//       stop sending it, or the worker stop reading it, with every pin green (they all bake without a worker)
//   N2  the player's feet dropped out of the union when they did not land - a load while swimming or levitating -
//       and whenever a foe's DID land, the foes alone were the union: the player's own room was culled
//   N3  five of the bake's laws had no pin: the landing ring, the walkable filter, ANCHOR_Y_TOLERANCE, the cache
//       key's union hash, and the gap SOUP_AGENT must never link
//   N4  the worker's own error never reached the console, and a small soup's main-thread fallback said nothing
//   N5  a cache hit with a dead worker re-cut a large soup on the main thread (2.8 s on 25k triangles) - the very
//       freeze the bake path's own rule refuses
//   N8  FIELD-CONSOLE1's three unpinned lines: the vendored set's key form, PERF-2D naming the run's opener, and the
//       readback canvases asking for willReadFrequently
//
// N6 is the ARENA2 bake's own loader (test/enhancedAI.test.js); N10 is the triage's mutation records
// (tools/mutants/arena2triage.json). Mutants: tools/mutants/navbake.json (N1, N3) and audit0928_nav.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A triangle soup: quads, boxes and rooms (floor, ceiling, four walls). */
function soup() {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  const box = (x0, x1, y0, y1, z0, z1) => {
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]);
    quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]); quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]); quad([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]);
  };
  const room = (x0, x1, z0, z1, y, h = 3) => {
    quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]); quad([x0, y + h, z0], [x0, y + h, z1], [x1, y + h, z1], [x1, y + h, z0]);
    for (const [a, b] of [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]]) quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]]);
  };
  return { P, I, quad, box, room };
}
async function colliderOf(s) {
  const { Collider } = await import('../src/player/collider.js');
  const c = new Collider(() => -Infinity);
  c.addMesh('dungeon', new Float32Array(s.P), new Uint32Array(s.I), IDENTITY);
  return c;
}
/** The player's room A (x 0-10, `h` high) and a foe's room B 20 m off (x 30-40), both floors at y 0, no walk between. */
function twoRooms({ h = 3 } = {}) {
  const s = soup();
  s.room(0, 10, 0, 10, 0, h);
  s.room(30, 40, 0, 10, 0);
  return s;
}
const A = [2, 0, 5], FOE = [35, 0, 5], FOE2 = [38, 0, 8];
const on = async (bake, x, z, y = 0) => (await import('../src/ai/navmesh.js')).__locatePolyIndexed(bake.chf, x, z, y) >= 0;
/** A large soup for the worker's guards: a floor of small quads, over DEGENERATE_MIN_TRIS. */
async function quadFloor(n) {
  const s = soup();
  for (let i = 0; i < n; i++) { const x = (i % 40) * 0.5, z = Math.floor(i / 40) * 0.5; s.quad([x, 0, z], [x + 0.5, 0, z], [x + 0.5, 0, z + 0.5], [x, 0, z + 0.5]); }
  return colliderOf(s);
}
/** A worker double that runs the REAL navWorker module (AUDIT 68's rig): each posted job reaches its onmessage. */
async function realWorker() {
  await import('../src/ai/navWorker.js');
  const handler = globalThis.onmessage;
  const posted = [];
  class RealWorker {
    constructor() { this.onmessage = null; this.onerror = null; }
    postMessage(m) {
      posted.push(m.t);
      setTimeout(() => {
        globalThis.postMessage = (reply) => { this.onmessage?.({ data: reply }); };
        try { handler({ data: m }); } finally { delete globalThis.postMessage; }
      }, 0);
    }
    terminate() {}
  }
  return { RealWorker, posted };
}
/** A worker that answers every job with its own error (navWorker's catch). */
const errWorker = (message) => class {
  constructor() { this.onmessage = null; this.onerror = null; }
  postMessage(m) { setTimeout(() => this.onmessage?.({ data: { t: 'error', id: m.id, message } }), 0); }
  terminate() {}
};
/** A worker that dies under its first job (onerror). */
class DyingWorker {
  constructor() { this.onmessage = null; this.onerror = null; }
  postMessage() { setTimeout(() => this.onerror?.({ message: 'out of memory' }), 0); }
  terminate() {}
}
const captureWarn = async (fn) => {
  const said = [], warn = console.warn;
  console.warn = (...a) => said.push(a.join(' '));
  try { return { value: await fn(), said }; } finally { console.warn = warn; }
};

// ─── N1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 0928 N1: the worker bakes the anchor union - a foe’s room with no walk to the player is kept through the real navWorker (mutants: the client sends no anchors; the worker drops them)', async () => {
  const { NavClient } = await import('../src/ai/navClient.js');
  const { navPath } = await import('../src/ai/navBake.js');
  const { RealWorker, posted } = await realWorker();
  const collider = await colliderOf(twoRooms());
  const client = new NavClient({ store: null, WorkerCtor: RealWorker });
  const bake = await client.bake({ collider, anchor: A, anchors: [FOE], key: 'dungeon:n1' });
  assert.deepEqual(posted, ['bake'], 'the worker baked it - in the browser there is no other road');
  assert.ok(await on(bake, 5, 5), 'the player’s room');
  assert.ok(await on(bake, 35, 5), 'and the foe’s, named in the union the worker was handed');
  assert.ok(navPath(bake, FOE, FOE2), 'and it routes');
  client.dispose();
});

// ─── N2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 0928 N2: the player’s feet stay in the union when they do not land - loaded swimming 1.5 m over a flooded hall’s floor, the player’s room stands beside a foe’s', async () => {
  const { bakeNavFromCollider } = await import('../src/ai/navBake.js');
  const collider = await colliderOf(twoRooms({ h: 4 }));
  const SWIM = [5, 1.5, 5];   // 1.5 m over the floor: past ANCHOR_Y_TOLERANCE, so the feet do not land
  const alone = bakeNavFromCollider(collider, { anchor: SWIM });
  assert.ok(await on(alone, 5, 5), 'alone, the player’s room stands (his nearest-span pick)');
  const foeAlone = bakeNavFromCollider(collider, { anchor: FOE });
  const both = bakeNavFromCollider(collider, { anchor: SWIM, anchors: [FOE] });
  assert.ok(await on(both, 5, 5), 'beside a landed foe, the player’s room still stands - it was culled');
  assert.ok(await on(both, 35, 5), 'and the foe’s');
  assert.equal(both.stats.polys, alone.stats.polys + foeAlone.stats.polys, 'the union is exactly the two rooms - no roof, nothing else');
});

// ─── N3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 0928 N3: a foe leaning on its wall lands on the floor beside it - its own cell is the eroded margin (the ring, and the walkable filter)', async () => {
  const { bakeNavFromCollider, landAnchors } = await import('../src/ai/navBake.js');
  const collider = await colliderOf(twoRooms());
  const LEANING = [39.8, 0, 5];   // 0.2 m off room B's east wall, in the one ring of erosion
  const bake = bakeNavFromCollider(collider, { anchor: A, anchors: [LEANING] });
  assert.ok(await on(bake, 35, 5), 'the leaning foe’s room is kept');
  // the one cell it lands on: not its own (eroded, unwalkable), the first walkable one of the eight around it
  const landed = landAnchors(bake.chf, [LEANING]).map((p) => [p.x, Math.round(p.y * 1000) / 1000, p.z]);
  assert.deepEqual(landed, [[39.625, 0, 4.875]]);
});

test('AUDIT PRE-MERGE 0928 N3: ANCHOR_Y_TOLERANCE - feet 0.55 m over their floor land, 0.65 m over do not, and a foe 1.5 m up elects nothing', async () => {
  const { bakeNavFromCollider, landAnchors, ANCHOR_Y_TOLERANCE } = await import('../src/ai/navBake.js');
  assert.equal(ANCHOR_Y_TOLERANCE, 0.6);
  const collider = await colliderOf(twoRooms());
  const bake = bakeNavFromCollider(collider, { anchor: A });
  const chf = bake.chf;
  const col = chf.spans[Math.floor((5.1 - chf.xmin) / chf.cs) + Math.floor((5.1 - chf.zmin) / chf.cs) * chf.nx];
  const floor = col.filter((s) => s.walkable).map((s) => chf.ymin + s.floor * chf.ch);
  assert.equal(floor.length, 1, 'one walkable floor in the room’s middle column');
  assert.equal(landAnchors(chf, [[5.1, floor[0] + 0.55, 5.1]]).length, 1, '0.55 m over the floor lands');
  assert.deepEqual(landAnchors(chf, [[5.1, floor[0] + 0.65, 5.1]]), [], '0.65 m over it does not');
  const up = bakeNavFromCollider(collider, { anchor: A, anchors: [[35, 1.5, 5]] });
  assert.equal(await on(up, 35, 5), false, 'a foe anchor 1.5 m over its floor elects nothing');
  assert.equal(up.stats.polys, bake.stats.polys);
});

test('AUDIT PRE-MERGE 0928 N3: the cache key carries the union - a moved foe is a new key, the same cell the same one, and the cache never serves a bake to another union', async () => {
  const { navCacheKey, NavClient } = await import('../src/ai/navClient.js');
  const base = { key: 'loc', tris: 10, minY: -5, maxY: 3, anchor: [1, 0, 1] };
  const one = navCacheKey({ ...base, anchors: [[35, 0, 5]] });
  assert.notEqual(one, navCacheKey(base), 'a union is not the lone anchor’s key');
  assert.notEqual(one, navCacheKey({ ...base, anchors: [[36, 0, 5]] }), 'a foe a metre off is a new key');
  assert.equal(one, navCacheKey({ ...base, anchors: [[35.1, 0.2, 5.1]] }), 'the same cell is the same key');
  assert.notEqual(one, navCacheKey({ ...base, anchors: [[35, 0, 5], [35, 0, 5]] }), 'two foes in one cell are not one foe');
  assert.equal(navCacheKey({ ...base, anchors: [] }), navCacheKey(base), 'no foes named is the lone anchor’s key');
  const mem = new Map(); const store = { async get(k) { return mem.get(k) ?? null; }, async set(k, v) { mem.set(k, v); } };
  const collider = await colliderOf(twoRooms());
  const client = new NavClient({ store, WorkerCtor: undefined });
  const served = await client.bake({ collider, anchor: A, anchors: [FOE], key: 'dungeon:n3' });
  assert.ok(!served.cached && await on(served, 35, 5));
  const lone = await client.bake({ collider, anchor: A, key: 'dungeon:n3' });
  assert.equal(lone.cached, false, 'the player alone is not the union’s cached bake');
  assert.equal(await on(lone, 35, 5), false);
  assert.equal((await client.bake({ collider, anchor: A, anchors: [FOE], key: 'dungeon:n3' })).cached, true, 'the same union hits');
});

test('AUDIT PRE-MERGE 0928 N3: SOUP_AGENT’s one ring never links a 0.7 m gap (a body is 0.7 m), at every grid alignment, while a 1.25 m doorway links', async () => {
  const { bakeNavFromCollider, navPath, SOUP_AGENT } = await import('../src/ai/navBake.js');
  const { AGENT } = await import('../src/ai/navmesh.js');
  assert.deepEqual(SOUP_AGENT, { ...AGENT, radius: AGENT.cs });
  const level = (door, off) => {   // two 6 m rooms, a 0.3 m wall and one doorway 2.22 m high (the classic frame's lintel)
    const s = soup(), len = 6, wall = 0.3, X0 = off, X1 = off + 2 * len + wall, Z0 = off, Z1 = off + len, y = 12.8;
    s.room(X0, X1, Z0, Z1, y);
    const wx0 = X0 + len, wx1 = wx0 + wall, dz0 = Z0 + len / 2 - door / 2, dz1 = dz0 + door;
    s.box(wx0, wx1, y, y + 3, Z0, dz0); s.box(wx0, wx1, y, y + 3, dz1, Z1); s.box(wx0, wx1, y + 2.22, y + 3, dz0, dz1);
    return { s, a: [X0 + 1.5, y, Z0 + len / 2], b: [X1 - 1.5, y, Z0 + len / 2] };
  };
  for (let k = 0; k < 12; k++) {
    const gap = level(0.7, k * 0.0237);
    assert.equal(navPath(bakeNavFromCollider(await colliderOf(gap.s), { anchor: gap.a }), gap.a, gap.b), null, `alignment ${k}: a 0.7 m gap does not link`);
  }
  const door = level(1.25, 0);
  assert.ok(navPath(bakeNavFromCollider(await colliderOf(door.s), { anchor: door.a }), door.a, door.b), 'the rig links a real doorway');
});

// ─── N4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 0928 N4: the worker’s own error reaches the console - on a large soup the classic motor stands, and a small soup’s main-thread bake says so', async () => {
  const { NavClient, DEGENERATE_MIN_TRIS } = await import('../src/ai/navClient.js');
  const WORD = 'RangeError: Array buffer allocation failed';
  const big = await quadFloor(Math.ceil(DEGENERATE_MIN_TRIS / 2) + 10);
  const large = await captureWarn(() => new NavClient({ store: null, WorkerCtor: errWorker(WORD) }).bake({ collider: big, anchor: [1, 0, 1], key: 'n4:big' }));
  assert.equal(large.value, null);
  assert.deepEqual(large.said, [`[enhanced-ai] the nav worker failed on ${DEGENERATE_MIN_TRIS + 20} triangles - not baking on the main thread; the classic motor stands (the worker: ${WORD})`]);
  const rooms = await colliderOf(twoRooms());
  const here = await captureWarn(() => new NavClient({ store: null, WorkerCtor: DyingWorker }).bake({ collider: rooms, anchor: A, key: 'n4:small' }));
  assert.ok(here.value && here.value.stats.polys > 0, 'a small soup still bakes here');
  assert.deepEqual(here.said, ['[enhanced-ai] the nav worker failed - baking 24 triangles on the main thread (the worker: out of memory)']);
});

// ─── N5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 0928 N5: a cache hit with a dead worker does not re-cut a large soup on the main thread - the classic motor stands, as on the bake path; a small soup still hydrates here', async () => {
  const { NavClient, DEGENERATE_MIN_TRIS, bakeHere } = await import('../src/ai/navClient.js');
  const { navInputFromCollider } = await import('../src/ai/navBake.js');
  const hitOf = (collider, anchor) => { const r = bakeHere(navInputFromCollider(collider), anchor); return { async get() { return { baked: r.baked, cs: r.cs, stats: r.stats }; }, async set() {} }; };
  const big = await quadFloor(Math.ceil(DEGENERATE_MIN_TRIS / 2) + 10);
  const large = await captureWarn(() => new NavClient({ store: hitOf(big, [1, 0, 1]), WorkerCtor: DyingWorker }).bake({ collider: big, anchor: [1, 0, 1], key: 'n5:big' }));
  assert.ok(large.value === null, 'no main-thread re-cut of the cached bake’s boxes');
  assert.deepEqual(large.said, [`[enhanced-ai] the nav worker failed on ${DEGENERATE_MIN_TRIS + 20} triangles - not re-cutting a cached bake on the main thread; the classic motor stands (the worker: out of memory)`]);
  const rooms = await colliderOf(twoRooms());
  const small = await captureWarn(() => new NavClient({ store: hitOf(rooms, A), WorkerCtor: DyingWorker }).bake({ collider: rooms, anchor: A, key: 'n5:small' }));
  assert.ok(small.value?.cached && await on(small.value, 5, 5), 'a small soup’s cached bake still hydrates here');
});

// ─── N8 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 0928 N8: the vendored set answers in import.meta.glob’s own key form - every frame the mod ships, and nothing past its last', async () => {
  const { inVendoredSet, SPRITE_ARCHIVE, DROPPED_ARCHIVE } = await import('../src/systems/handheldTorches.js');
  // the table as Vite builds it: its keys are the glob's own pattern, spelled from the importing file
  const glob = /import\.meta\.glob\('([^']*)\/\*\.png'/.exec(read('src/systems/handheldTorches.js'));
  assert.ok(glob, 'the table is a glob of the vendored folder');
  const files = readdirSync(new URL('../vendor/handheld-torches/Textures/', import.meta.url)).filter((f) => f.endsWith('.png'));
  const table = Object.fromEntries(files.map((f) => [`${glob[1]}/${f}`, `/assets/${f}`]));
  const admitted = (archive) => {
    const out = [];
    for (let record = 0; record < 16; record++) for (let frame = 0; frame < 8; frame++) if (inVendoredSet(table, `${archive}_${record}-${frame}.png`)) out.push(`${record}-${frame}`);
    return out;
  };
  const shipped = (archive) => files.map((f) => new RegExp(`^${archive}_(\\d+-\\d+)\\.png$`).exec(f)?.[1]).filter(Boolean)
    .sort((p, q) => { const [a, b] = p.split('-').map(Number), [c, d] = q.split('-').map(Number); return a - c || b - d; });
  assert.deepEqual(admitted(SPRITE_ARCHIVE), shipped(SPRITE_ARCHIVE), 'the hand’s sprite: exactly the frames on disk');
  assert.deepEqual(admitted(SPRITE_ARCHIVE), ['0-0', '0-1', '0-2', '0-3', '1-0', '1-1', '1-2', '1-3']);
  assert.deepEqual(admitted(DROPPED_ARCHIVE), shipped(DROPPED_ARCHIVE), 'the dropped flats: exactly the frames on disk');
  assert.equal(inVendoredSet(null, `${SPRITE_ARCHIVE}_0-9.png`), true, 'no table (node): the loaders fetch as before');
});

/** A GL-logging renderer (glstate.test.js's rig). */
async function glRig() {
  const { Renderer } = await import('../src/render/renderer.js');
  const ids = new Map();
  const stub = new Proxy({}, { get: (o, k) => {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, name) => ({ name });
    if (k === 'getAttribLocation') return () => 0;
    if (['createTexture', 'createBuffer', 'createVertexArray', 'createProgram', 'createShader', 'createFramebuffer', 'createRenderbuffer', 'createQuery'].includes(k)) return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
    if (k === 'getExtension') return () => null;
    if (k === 'drawingBufferWidth') return 640;
    if (k === 'drawingBufferHeight') return 400;
    if (typeof k === 'string' && k.toUpperCase() === k) { if (!ids.has(k)) ids.set(k, 0x9000 + ids.size); return ids.get(k); }
    return () => {};
  } });
  return new Renderer({ getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 });
}
function openTheRun(r) { r.drawScreenQuad({ id: 'A' }, { x: 0, y: 0, w: 8, h: 8 }); }
function landTheForeignPass(r) { r.markForeignPass(); }

test('AUDIT PRE-MERGE 0928 N8: PERF-2D’s warning names the draw that opened the run and the pass that found it', async () => {
  const { identity } = await import('../src/world/mat4.js');
  const r = await glRig();
  r.beginFrame(new Float32Array(identity()), new Float32Array(identity()), new Float32Array([0, -1, 0]));
  const { said } = await captureWarn(() => { openTheRun(r); landTheForeignPass(r); });
  assert.equal(said.length, 1);
  assert.match(said[0], /\n {2}the run it found:\s+at Renderer\.drawScreenQuad \([^)]*renderer\.js:\d+:\d+\) <-\s+at openTheRun \(/, 'the run’s opener, and who called it');
  assert.match(said[0], /\n {2}the pass that found it:\s+at landTheForeignPass \(/, 'the pass that found it');
});

/** A canvas that records every getContext's options, with a 2D context enough for the readback sites. */
function recordingCanvas(log, w = 4, h = 4) {
  const ctx = {
    font: '', fillStyle: '', textBaseline: '',
    measureText: () => ({ width: 10, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    fillText() {}, drawImage() {}, putImageData() {},
    getImageData: (x, y, gw, gh) => ({ width: gw, height: gh, data: new Uint8ClampedArray(Math.max(1, gw * gh) * 4) }),
  };
  return { width: w, height: h, getContext: (kind, opts) => { log.push([kind, opts ?? null]); return ctx; } };
}

test('AUDIT PRE-MERGE 0928 N8: every canvas the port makes to read pixels back asks for willReadFrequently - the PNG decode, the SDF atlas, the held map’s sheet and thumbs, the save shot', async () => {
  const want = ['2d', { willReadFrequently: true }];
  const log = [];
  const saved = { createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas, document: globalThis.document, Image: globalThis.Image, localStorage: globalThis.localStorage };
  try {
    // the PNG decode every vendored texture goes through
    globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
    globalThis.OffscreenCanvas = class { constructor(w, h) { return recordingCanvas(log, w, h); } };
    const { decodePng } = await import('../src/systems/textureReplacement.js');
    await decodePng(new Uint8Array([137, 80, 78, 71]));
    assert.deepEqual(log.splice(0), [want], 'decodePng');
    // the SDF face's atlas - L10N2: DFU's dynamic face (ui/glyphFace.js) took the seeded build's place; each page it
    // grows into is read back at its upload, so the page asks at its one context (the measurer only measures)
    const { createGlyphFace } = await import('../src/ui/glyphFace.js');
    createGlyphFace('Test', { makeCanvas: (w, h) => recordingCanvas(log, w, h) }).add(65);
    assert.deepEqual(log.splice(0), [['2d', null], want], 'the glyph face: its measurer, then its page');
    // the held map: the painted sheet and the thumbs' offscreen (the hands canvas is only written)
    globalThis.document = { createElement: () => recordingCanvas(log) };
    const { HeldMapWindow } = await import('../src/ui/heldMap.js');
    const sprite = { naturalWidth: 64, naturalHeight: 64 };
    HeldMapWindow.prototype._paintSheet.call({}, sprite, recordingCanvas(log));
    assert.deepEqual(log.splice(0), [want], '_paintSheet');
    HeldMapWindow.prototype._keyHands.call({}, sprite, recordingCanvas(log));
    assert.deepEqual(log.splice(0), [want, ['2d', null]], '_keyHands: the offscreen it reads, then the hands it writes');
    // the save window's shot
    const { SaveWindow } = await import('../src/ui/saveWindow.js');
    const { SAVE_SHOT_PREFIX } = await import('../src/systems/saveSlots.js');
    globalThis.localStorage = { getItem: (k) => (k === `${SAVE_SHOT_PREFIX}k1` ? 'data:image/jpeg;base64,X' : null), setItem() {}, removeItem() {}, key: () => null, length: 0 };
    globalThis.Image = class { set src(u) { this.width = 2; this.height = 2; this.onload?.(); } };
    const uploads = [];
    new SaveWindow('load', { playerName: () => 'Mac' })._shotTexture({ uploadTexture: (...a) => { uploads.push(a[0]); return {}; }, releaseTexture() {} }, 'k1');
    assert.deepEqual(uploads, ['saveshot'], 'the shot was read back and uploaded');
    assert.deepEqual(log.splice(0), [want], 'the save shot');
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
  // the paperdoll tool's skin (a THREE page, not drivable here): its two read-back canvases ask at their FIRST context
  const skin = read('src/tools/paperdoll/skin.js');
  assert.match(skin, /const g2 = c\.getContext\('2d', \{ willReadFrequently: true \}\); g2\.drawImage\(img, 0, 0\);/);
  assert.match(skin, /\n\s*bc\.getContext\('2d', \{ willReadFrequently: true \}\)\.drawImage\(bi, 0, 0\);/);
});
