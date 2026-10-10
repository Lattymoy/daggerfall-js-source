// FIELD BUGS 2026-10-04d PLACE-LRU (the Discord: "After long plays there are consistent GPU memory leaks that do not
// lower down even after closing the tab ... Related to play length ... Idling does not increase mem usage"; a player's
// follow-up: "world instances are cached. visiting new cities generates a mesh for them but does never dispose of them
// after leaving that place ... needs to have a limit of chunks being stored with minimum set for chunks visible by
// viewing range").
//
// Measured in the source first. What a place builds for itself alone already went with it (destroyPixel, the two
// contexts' destroy()). What places SHARE never went anywhere: the data pipeline's `gpuMeshes` (a VAO and four buffers a
// model, its CPU copy beside it), the renderer's pictures and emission maps, and its ground tile arrays kept every
// model, picture and ground a session had met. So the player was right about the shared half - and the per-place half
// (a town's merged statics, its terrain, its flats) was already freed when its pixel left the view.
//
// Driven here through the REAL pipeline (scenes/dataPipeline.js) and the REAL Renderer over a fake WebGL2 that counts
// what is alive: a walk of places in the world host's own shape (scenes/world.js holdPixel: the pipeline with a place's
// hold laid over it), each with a model of its own, one model every place shares, a climate swap, a flat and a ground.
// Before PLACE-LRU the pipeline has no holds, the walk falls back to the plain doors, and every count grows with the
// places walked - the bound below fails on the pre-fix tree for the reason it exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer } from '../src/render/renderer.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { remapSubMeshes } from '../src/world/texRemap.js';
import { identity } from '../src/world/mat4.js';
import { buildInteriorContext } from '../src/scenes/interiorContext.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = (ms = 1) => new Promise((r) => setTimeout(r, ms));

/** A WebGL2 that answers everything and COUNTS what is alive, by kind; a delete of a dead object is a double free. */
function countingGl() {
  const live = new Map();   // kind -> Set
  const twice = [];
  const bound = [];   // every texture bindTexture was handed, in order
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (k === 'bindTexture') return (_t, tex) => { bound.push(tex); };
      if (typeof k !== 'string') return undefined;
      if (k.startsWith('create')) {
        const kind = k.slice(6);
        return () => { const o = { kind, id: ++ids }; if (!live.has(kind)) live.set(kind, new Set()); live.get(kind).add(o); return o; };
      }
      if (k.startsWith('delete')) {
        const kind = k.slice(6);
        return (o) => { if (!o) return; if (!live.get(kind)?.delete(o)) twice.push(`${kind}#${o.id}`); };
      }
      if (k.toUpperCase() === k) return 1;   // a GL enum
      return () => {};
    },
  });
  const count = (kind) => live.get(kind)?.size ?? 0;
  const alive = (o) => !!o && !!live.get(o.kind)?.has(o);
  return { gl, count, alive, twice, bound };
}

/** A TEXTURE file of `n` 1x1 records (audit68_scenes_ab's synthetic archive). */
function textureArchive(n) {
  const recPos = 26 + 20 * n, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, n, true);
  for (let i = 0; i < n; i++) v.setInt32(26 + 20 * i + 2, recPos, true);
  v.setInt16(recPos + 4, 1, true); v.setInt16(recPos + 6, 1, true);
  v.setUint32(recPos + 10, 256, true); v.setUint32(recPos + 14, RECORD_HEADER, true); v.setUint16(recPos + 20, 1, true);
  bytes[recPos + RECORD_HEADER] = 5;
  return bytes;
}

// The walk's art. Each place owns a model (its own picture, at 120+ / record by place), a flat (250+), a ground (an
// archive of its own); every place shares one model (110_0); the climate swap is +200 (120 -> 320, 110 -> 310). None
// of these is a window, an emissive record or a spectral archive.
const SHARED = 900000, PINNED = 900001, OWN = (i) => 900100 + i;
const OWN_PIC = (i) => [120 + Math.floor(i / 32), i % 32];
const FLAT = (i) => [250 + Math.floor(i / 32), i % 32];
const GROUND = (i) => 1000 + i;
const SWAP = (archive) => archive + 200;

/** The real pipeline over the real renderer, with a fake ARCH3D that carries one triangle a model. */
function world() {
  const glc = countingGl();
  const canvas = { getContext: () => glc.gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  const renderer = new Renderer(canvas);
  const models = new Map([[SHARED, [110, 0]], [PINNED, [130, 0]]]);
  for (let i = 0; i < 128; i++) models.set(OWN(i), OWN_PIC(i));
  const p = (x, z) => ({ x, y: 0, z, nx: 0, ny: -1, nz: 0, u: 0, v: 0 });
  const arch = {
    getRecordIndex: (id) => (models.has(id) ? id : -1),
    getMesh: (id) => {
      const [textureArchive, textureRecord] = models.get(id);
      return { totalVertices: 3, totalTriangles: 1, subMeshes: [{ textureArchive, textureRecord, totalTriangles: 1, planes: [{ points: [p(0, 0), p(40, 0), p(0, 40)] }] }] };
    },
  };
  const palette = new DFPalette(); palette.makeGrayscale();
  const tex = textureArchive(64);
  const pipe = createDataPipeline({ renderer, arch, palette, fetch: async (name) => (name === 'FLATS.CFG' ? new Uint8Array(0) : tex) });
  // the world host's own shape (scenes/world.js holdPixel) - and, on a tree with no holds, the plain doors
  const place = (kind, key) => (pipe.holdPlace ? { ...pipe, ...pipe.holdPlace(kind, key) } : { ...pipe, release() {}, settle() {}, tileArray() {} });
  /** One place built as a streamed pixel builds: the models through its doors, the climate swap through remapSubMeshes
   *  (texRemap.js, the hosts' one door), a flat, its ground held before the cache is asked. */
  async function build(i, key = `${i},0`) {
    const h = place('pixel', key);
    const shared = await h.getGpuMesh(SHARED);
    const own = await h.getGpuMesh(OWN(i));
    const texRemap = new Map();
    await remapSubMeshes(own.subMeshes, texRemap, SWAP, h);
    await remapSubMeshes(shared.subMeshes, texRemap, SWAP, h);
    const [fa, fr] = FLAT(i);
    await h.getTexture(fa);
    h.uploadRecord(fa, fr);
    h.tileArray(GROUND(i));
    if (!renderer.tileArrays.has(GROUND(i))) renderer.uploadTileArray(GROUND(i), [{ width: 1, height: 1, colors: new Uint8ClampedArray(4) }]);
    h.settle();
    return { h, own, shared, texRemap, key, flatKey: `${fa}_${fr}`, ownKeys: [`${OWN_PIC(i)[0]}_${OWN_PIC(i)[1]}#opaque`, `${SWAP(OWN_PIC(i)[0])}_${OWN_PIC(i)[1]}#opaque`] };
  }
  const census = () => ({
    meshes: pipe.gpuMeshes.size, cpu: pipe.cpuModels.size, textures: renderer.textures.size, tiles: renderer.tileArrays.size,
    glTextures: glc.count('Texture'), vaos: glc.count('VertexArray'), buffers: glc.count('Buffer'),
  });
  return { glc, renderer, pipe, place, build, census };
}

/** The walk: `n` places in a row, `view` of them standing at once - each new one built, the one leaving the view released. */
async function walk(w, from, n, view, built = []) {
  for (let i = from; i < from + n; i++) {
    built[i] = await w.build(i);
    if (i - view >= 0 && built[i - view]) built[i - view].h.release();
  }
  return built;
}

const KEEP = 3, VIEW = 2;

test('PLACE-LRU THE BOUND: a walk through N distinct places holds the GL objects of the view and the kept places alone - the same at 12 places as at 48, every count (mutants: no trim; a shelf with no keep; a model freed without its buffers; a model\'s pictures never let go)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const base = w.census();
  const built = await walk(w, 0, 12, VIEW);
  const at12 = w.census();
  await walk(w, 12, 36, VIEW, built);
  const at48 = w.census();
  assert.deepEqual(at48, at12, `48 places hold what 12 did: ${JSON.stringify(at12)} -> ${JSON.stringify(at48)}`);
  // exact: the view's and the kept places' own models, the shared one; nothing else
  assert.equal(at48.meshes, VIEW + KEEP + 1, 'the models: the view\'s and the kept places\' own, and the one every place shares');
  assert.equal(at48.cpu, at48.meshes, 'and the CPU copies go with them');
  assert.equal(at48.textures, 3 * (VIEW + KEEP) + 2, 'the pictures: three a place (its model\'s, its swap, its flat), two shared');
  assert.equal(at48.tiles, VIEW + KEEP, 'a tile array a place standing or kept');
  assert.equal(at48.vaos - base.vaos, at48.meshes, 'one VAO a model standing');
  assert.equal(at48.buffers - base.buffers, 4 * at48.meshes, 'four buffers a model standing');
  assert.equal(at48.glTextures - base.glTextures, at48.textures + at48.tiles, 'every GL texture is one the caches name');
  assert.deepEqual(w.glc.twice, [], 'nothing freed twice');
  const s = w.pipe.placeStats();
  assert.equal(s.live, VIEW, 'the view stands');
  assert.equal(s.kept.pixel, KEEP, 'and KEEP of the places gone are kept');
});

test('PLACE-LRU NEVER WHAT A LIVE PLACE DRAWS: a place standing through the whole walk keeps its model, its pictures and its ground - the same GL objects, alive, and its draw binds only live textures (mutants: a place\'s door holding nothing; a model\'s pictures not the model\'s)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const home = await w.build(60, 'home');
  const before = { vao: home.own.vao, tex: home.ownKeys.map((k) => w.renderer.textures.get(k)), flat: w.renderer.textures.get(home.flatKey), ground: w.renderer.tileArrays.get(GROUND(60)) };
  await walk(w, 0, 30, VIEW);
  assert.equal(home.own.vao, before.vao, 'the model is the one it was');
  assert.ok(w.glc.alive(home.own.vao), 'and its VAO is alive');
  assert.deepEqual(home.ownKeys.map((k) => w.renderer.textures.get(k)), before.tex, 'its pictures are the ones they were');
  for (const t of before.tex) assert.ok(w.glc.alive(t), 'and alive');
  assert.equal(w.renderer.textures.get(home.flatKey), before.flat, 'its flat too');
  assert.equal(w.renderer.tileArrays.get(GROUND(60)), before.ground, 'and its ground');
  assert.ok(w.glc.alive(before.ground));
  w.renderer.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  w.glc.bound.length = 0;
  w.renderer.drawMesh(home.own, identity(), home.texRemap);
  const drawn = w.glc.bound.filter(Boolean);
  assert.ok(drawn.includes(before.tex[1]), 'the swapped picture is what the draw binds');
  for (const t of drawn) assert.ok(w.glc.alive(t), 'and every texture the draw binds is alive');
});

test('PLACE-LRU SHARED AND PINNED: a model every place holds stands the whole walk, and what is asked for outside any place is never freed (mutants: a count freed at one holder; the sweep blind to the pin; the pipeline\'s own doors not pinning)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const pinned = await w.pipe.getGpuMesh(PINNED);
  await w.pipe.getTexture(130);
  w.pipe.uploadRecord(130, 5);
  const pinnedPic = w.renderer.textures.get('130_5');
  // a place asks for both as well, and is walked off the shelf: what it let go is pinned, and stays
  const asker = w.place('pixel', 'asker');
  assert.equal(await asker.getGpuMesh(PINNED), pinned);
  asker.uploadRecord(130, 5);
  asker.release();
  const built = await walk(w, 0, 4, VIEW);
  const shared = built[0].shared;
  await walk(w, 4, 30, VIEW, built);
  assert.equal(built[33].shared, shared, 'every place got the one shared model');
  assert.ok(w.glc.alive(shared.vao), 'and it stood through the walk');
  assert.ok(w.renderer.textures.has('110_0#opaque') && w.renderer.textures.has('310_0#opaque'), 'its picture and its swap with it');
  assert.equal(w.pipe.gpuMeshes.get(PINNED), pinned, 'the pinned model is the one it was');
  assert.ok(w.glc.alive(pinned.vao), 'alive');
  assert.ok(w.renderer.textures.has('130_0#opaque'), 'and its picture');
  assert.equal(w.renderer.textures.get('130_5'), pinnedPic, 'a picture the UI asked for stays');
  assert.ok(w.glc.alive(pinnedPic));
});

test('PLACE-LRU A REVISIT REBUILDS CLEANLY: a place dropped from the shelf lost its own model (made inert, its buffers deleted) and its pictures; walking back builds new ones, alive, and the draw binds them (mutants: the evicted model left drawable; no destroyMesh)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const built = await walk(w, 0, VIEW + KEEP + 6, VIEW);
  const gone = built[0];
  assert.equal(gone.own.vao, null, 'the old model is inert - a holder that outlived its place draws nothing');
  assert.equal(w.pipe.gpuMeshes.has(OWN(0)), false, 'and out of the cache');
  assert.equal(w.pipe.cpuModels.has(OWN(0)), false, 'with its CPU copy');
  for (const k of [...gone.ownKeys, gone.flatKey]) assert.equal(w.renderer.textures.has(k), false, `${k} let go`);
  assert.equal(w.renderer.tileArrays.has(GROUND(0)), false, 'and its ground');
  const back = await w.build(0);
  assert.notEqual(back.own, gone.own, 'a new model');
  assert.ok(w.glc.alive(back.own.vao), 'alive');
  assert.ok(back.own.buffers.every((b) => w.glc.alive(b)));
  for (const k of [...back.ownKeys, back.flatKey]) assert.ok(w.glc.alive(w.renderer.textures.get(k)), `${k} uploaded again`);
  assert.ok(w.glc.alive(w.renderer.tileArrays.get(GROUND(0))), 'the ground again');
  w.renderer.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  w.glc.bound.length = 0;
  w.renderer.drawMesh(back.own, identity(), back.texRemap);
  assert.ok(w.glc.bound.includes(w.renderer.textures.get(back.ownKeys[1])), 'the draw binds the new swap');
  assert.deepEqual(w.glc.twice, [], 'nothing freed twice');
});

test('PLACE-LRU KEPT AND SETTLED: a place gone within the keep is warm - its revisit uploads nothing - and the place standing again lets its last visit\'s keep go, with what only that visit held (mutant: settle dropping nothing)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const first = await w.build(5, 'twice');
  first.h.release();
  const vaos = w.glc.count('VertexArray'), textures = w.glc.count('Texture');
  // the same place again, this time with another flat - a season's re-skin, a rebuilt layout
  const again = w.place('pixel', 'twice');
  const own = await again.getGpuMesh(OWN(5));
  assert.equal(own, first.own, 'warm: the kept model answers');
  assert.equal(w.glc.count('VertexArray'), vaos, 'and nothing was built');
  const [fa, fr] = FLAT(6);
  await again.getTexture(fa);
  again.uploadRecord(fa, fr);
  assert.equal(w.glc.count('Texture'), textures + 1, 'only the new flat went up');
  assert.ok(w.renderer.textures.has(first.flatKey), 'the old flat is still kept while the place builds');
  again.settle();
  assert.equal(w.renderer.textures.has(first.flatKey), false, 'standing again, the old visit\'s flat goes');
  assert.ok(w.renderer.textures.has(`${fa}_${fr}`), 'the new one stays');
  assert.ok(w.glc.alive(own.vao), 'and the model the new visit holds');
  again.release();
  assert.equal(w.pipe.placeStats().kept.pixel, 1, 'one keep a place');
});

test('PLACE-LRU ONE KEEP A PLACE, AND NOTHING HELD BY A PLACE GONE: a place gone twice keeps its newer visit only - the older visit\'s own art goes - and a build\'s late answer for a place already dropped holds nothing (mutants: a second keep never dropped; a dropped place still holding)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const up = async (h, i) => { const [a, r] = FLAT(i); await h.getTexture(a); h.uploadRecord(a, r); return `${a}_${r}`; };
  const v1 = w.place('pixel', 'twice');
  const f1 = await up(v1, 40);
  v1.release();
  const v2 = w.place('pixel', 'twice');   // walked back, and gone again before it stood (no settle)
  const f2 = await up(v2, 41);
  v2.release();
  assert.equal(w.renderer.textures.has(f1), false, 'the older visit\'s flat went with its keep');
  assert.ok(w.renderer.textures.has(f2), 'the newer visit is kept');
  assert.equal(w.pipe.placeStats().kept.pixel, 1);
  // a place walked off the shelf, and its build's async tail answers after: what it uploads is nobody's
  const late = w.place('pixel', 'late');
  late.release();
  const built = await walk(w, 0, VIEW + KEEP + 1, VIEW);
  const f3 = await up(late, 42);
  assert.ok(w.renderer.textures.has(f3), 'the late upload went up');
  await walk(w, VIEW + KEEP + 1, 2, VIEW, built);   // the next sweep
  assert.equal(w.renderer.textures.has(f3), false, 'and the next sweep freed it - nothing held it');
});

test('PLACE-LRU THE MISS DOOR: a picture let go that something outside any place still draws is made again in the draw - a billboard\'s and a mesh\'s - and is pinned from then on (mutants: no miss door, for a flat or for a material; a remade picture not pinned)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', KEEP);
  const built = await walk(w, 0, 1, VIEW);
  // a foe outdoors that drew place 0's flat through no place of its own, and a pinned model drawn with place 0's swap
  const [fa, fr] = FLAT(0);
  const batch = w.renderer.createBillboardBatch(fa, fr, { w: 1, h: 1 }, [[0, 0, 0]]);
  const pinned = await w.pipe.getGpuMesh(PINNED);
  const remap = new Map([['130_0', `${SWAP(OWN_PIC(0)[0])}_${OWN_PIC(0)[1]}`]]);
  w.renderer.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  w.renderer.drawMesh(pinned, identity(), remap);   // the sub-mesh stamps the swap it found
  await walk(w, 1, VIEW + KEEP + 2, VIEW, built);
  assert.equal(w.renderer.textures.has(built[0].flatKey), false, 'the flat was let go with its place');
  assert.equal(w.renderer.textures.has(built[0].ownKeys[1]), false, 'and the swap');
  w.renderer.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  w.glc.bound.length = 0;
  w.renderer.drawBillboards([batch], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  const flat = w.renderer.textures.get(built[0].flatKey);
  assert.ok(w.glc.alive(flat), 'the billboard\'s draw made the flat again');
  assert.ok(w.glc.bound.includes(flat), 'and bound it');
  w.glc.bound.length = 0;
  w.renderer.drawMesh(pinned, identity(), remap);
  const swap = w.renderer.textures.get(built[0].ownKeys[1]);
  assert.ok(w.glc.alive(swap), 'the mesh\'s draw made its swap again');
  assert.ok(w.glc.bound.includes(swap), 'and bound the NEW one - never the deleted one it had stamped');
  for (const t of w.glc.bound.filter(Boolean)) assert.ok(w.glc.alive(t), 'nothing dead is bound');
  // made again, it is pinned: a place that asks for it and goes does not take it from whoever drew it
  const asker = w.place('pixel', 'asker');
  await asker.getTexture(fa);
  asker.uploadRecord(fa, fr);
  asker.release();
  await walk(w, VIEW + KEEP + 3, VIEW + KEEP + 2, VIEW, built);
  assert.equal(w.renderer.textures.get(built[0].flatKey), flat, 'made again, it is pinned: whoever drew it holds it through no place');
  assert.ok(w.glc.alive(flat));
});

test('PLACE-LRU THE STAMP: an eviction moves the texture generation itself - a mesh drawn the very next moment, with nothing uploaded between, never binds the deleted texture it had stamped (AUDIT 39 F51\'s law, for an eviction) (mutant: the eviction leaves the stamp)', async () => {
  const w = world();
  w.pipe.keepPlaces?.('pixel', 0);   // a place gone is dropped at once
  const pinned = await w.pipe.getGpuMesh(PINNED);
  const h = w.place('pixel', 'stamp');
  await h.getTexture(SWAP(130));
  h.uploadRecord(SWAP(130), 0, { opaque: true });   // the place's swap of the pinned model's picture
  const key = `${SWAP(130)}_0#opaque`, remap = new Map([['130_0', `${SWAP(130)}_0`]]);
  w.renderer.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  w.renderer.drawMesh(pinned, identity(), remap);   // the sub-mesh stamps the swap
  const stamped = w.renderer.textures.get(key);
  assert.ok(w.glc.alive(stamped));
  h.release();
  assert.equal(w.renderer.textures.has(key), false, 'the swap went with its place');
  assert.equal(w.glc.alive(stamped), false, 'deleted');
  w.glc.bound.length = 0;
  w.renderer.drawMesh(pinned, identity(), remap);
  assert.ok(!w.glc.bound.includes(stamped), 'never the deleted texture it had stamped');
  const again = w.renderer.textures.get(key);
  assert.ok(w.glc.alive(again) && w.glc.bound.includes(again), 'the swap made again and bound');
});

test('PLACE-LRU the interior context owns its hold: settled once built, released LAST in destroy() - after its own batches are gone - and a context with no hold builds as ever', async () => {
  const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
  const cpuModels = new Map();
  const live = new Set();
  const renderer = {
    createBillboardBatch: (a, r, s, c) => { const b = { a, r, c }; live.add(b); return b; },
    destroyBatch: (b) => { live.delete(b); }, destroyMesh: () => {}, createMesh: () => ({}),
  };
  const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const calls = [];
  const placeHold = { settle: () => calls.push(['settle', live.size]), release: () => calls.push(['release', live.size]) };
  const deps = { renderer, getGpuMesh: async (id) => { cpuModels.set(id, model); return { gpu: id }; }, cpuModels,
    getTexture: () => Promise.resolve(tex), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const dfBlock = { name: 'T.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 },
    block3dObjectRecords: [{ modelIdNum: 1, objectType: 3, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
    blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [],
    blockPeopleRecords: [{ xPos: 0, yPos: 0, zPos: 100, textureArchive: 182, textureRecord: 0, factionID: 0, flags: 0, position: 1 }] } }] } };
  const ctx = await buildInteriorContext({ ...deps, placeHold }, dfBlock, 0, 0, 300, 0, null, { peopleVisible: true });
  assert.deepEqual(calls.map((c) => c[0]), ['settle'], 'built: settled, nothing released');
  await settle(5);
  assert.ok(live.size > 0, 'the room stands its flats');
  ctx.destroy();
  assert.deepEqual(calls.map((c) => c[0]), ['settle', 'release'], 'destroyed: released');
  assert.equal(calls[1][1], 0, 'after the room\'s own batches were freed');
  const bare = await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, { peopleVisible: true });
  bare.destroy();   // the standalone ?interior scene's: no hold, nothing to release
});

test('PLACE-LRU THE FOUR HOSTS: the world host holds each pixel and lets it go; the interior and dungeon builds take a hold their contexts release; the fixed city is pinned and its doors are worldModes\'', () => {
  const W = rd('src/scenes/world.js');
  // scenes/world.js - wired: every streamed pixel is a place
  assert.match(W, /const pipeline = createDataPipeline\(\{ renderer, arch, palette \}\); const holdPixel = \(key\) => \(\{ \.\.\.pipeline, \.\.\.pipeline\.holdPlace\('pixel', key\) \}\);/, 'the pixel\'s view of the pipeline');
  assert.match(W, /breather\.reset\(\);[^\n]*\n\s*const key = `\$\{px\},\$\{py\}`, pipeline = holdPixel\(key\), \{ getGpuMesh, uploadRecord, uploadRecordFrame \} = pipeline;/, 'the build\'s doors and `pipeline` are the pixel\'s, from its first line');
  assert.match(W, /const seedTilemap = new Uint8Array\(128 \* 128\); made\.placeHold = pipeline;/, 'BUILD-FAIL1\'s ledger carries the hold');
  // ECOTONE1: PIN MOVED - the tile set's one home (loadGroundSet) holds through the pixel's door it is handed, the
  // build's own `pipeline`, for its own set and every border neighbour's
  assert.match(W, /hold\.tileArray\(groundArchive\); const groundTex = await getTexture\(groundArchive\);[^\n]*\n\s*if \(!renderer\.tileArrays\.has\(groundArchive\)\)/, 'the ground held before the cache is asked');
  assert.match(W, /await loadGroundSet\(groundArchive, pipeline\);/, '...the pixel\'s own, held by the pixel');
  assert.match(W, /\n\s*placeHold: pipeline,\n\s*location: dfLocation \? dfLocation\.name : null,/, 'the published pixel carries its hold');
  assert.match(W, /console\.warn\(`\[roads\] pixel \$\{key\} painted without the network twice - kept as painted`\);\n\s*\}\n\s*const entry = built\.get\(key\); pipeline\.settle\(\);/, 'and settles it once it stands (past the roads retry, which tears it down and builds again)');
  const destroy = W.slice(W.indexOf('function destroyPixel(px, py'), W.indexOf('// --- Streaming state + player'));
  assert.match(destroy, /built\.delete\(key\); p\.placeHold\?\.release\(\);[^\n]*\n\s*\}\s*$/, 'destroyPixel lets it go, LAST');
  assert.match(W, /if \(built\.has\(key\)\) return;\n\s*if \(m\) \{\s*m\.placeHold\?\.release\(\);/, 'a build that threw lets its hold go');
  assert.match(W, /const state = new StreamingWorldState\(fogDistance\); pipeline\.keepPlaces\('pixel', \(2 \* state\.terrainDistance \+ 1\) \*\* 2\);/, 'a view of pixels kept past the view');
  assert.match(W, /\(entry\.placeHold \?\? pipeline\)\.uploadRecord\(archive, record\);/, 'the street\'s people are the pixel\'s');
  // scenes/worldModes.js - wired: a building and a dungeon are places
  const M = rd('src/scenes/worldModes.js');
  assert.match(M, /const placeHoldOf = \(kind, key\) => pipeline\.holdPlace\?\.\(kind, key\) \?\? \{ getGpuMesh, uploadRecord, uploadRecordFrame, release\(\) \{\}, settle\(\) \{\} \};/);
  assert.match(M, /const buildingHold = placeHoldOf\('interior', [^\n]*\); const ctx = await buildInteriorContext\([^\n]*\n\s*\{ renderer, getGpuMesh: buildingHold\.getGpuMesh, cpuModels, getTexture, uploadRecord: buildingHold\.uploadRecord, uploadRecordFrame: buildingHold\.uploadRecordFrame, palette, getMachineryParts, placeHold: buildingHold \},/);
  assert.match(M, /\}\)\.catch\(\(e\) => \{ buildingHold\.release\(\); if \(live\(\)\) say\(NOTHING_OF_VALUE_TEXT\); throw e; \}\);/);
  assert.match(M, /await getTexture\(waterArchive\); const dungeonHold = placeHoldOf\('dungeon', [^\n]*\);[^\n]*\n\s*layingOutLoc = dfLocation;[^\n]*\n\s*const ctx = await buildDungeonContext\(\n\s*\{ renderer, arch, getGpuMesh: dungeonHold\.getGpuMesh, cpuModels, getTexture, uploadRecord: dungeonHold\.uploadRecord, uploadRecordFrame: dungeonHold\.uploadRecordFrame, palette, placeHold: dungeonHold \},/);
  assert.match(M, /\}\)\.catch\(\(e\) => \{ dungeonHold\.release\(\); throw e; \}\);/);
  // scenes/dungeonContext.js - wired: settled when built, released last in destroy()
  const D = rd('src/scenes/dungeonContext.js');
  assert.match(D, /const \{ renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette, placeHold = null \} = deps;/);
  assert.match(D, /hudText\.dispose\(\); placeHold\?\.release\(\);[^\n]*\n\s*\},\n\s*\}; placeHold\?\.settle\(\);[^\n]*\n(?:\s*\/\/[^\n]*\n|\s*if \(sdEnd && !_sdEndAsked\)[^\n]*\n|\s*for \(const f of foes\) \{\n(?:\s{4}[^\n]*\n)*\s*\}\n|\s*for \(const \[i, p\] of lootPiles\.entries\(\)\) if \(p\.stopKey[^\n]*\n)*\s*return api;\n\}/);   // AUDIT SD IV (S1, PIN MOVED): the end stood as the level is built, after the hold settles. PIN MOVED (AUDIT LW-II D1): LW14's company-cleared foes and piles are settled there too, after the hold
  // scenes/interiorContext.js (worldModes' building): released LAST (the behaviour is driven above)
  assert.match(rd('src/scenes/interiorContext.js'), /_raceMeshes\?\.clear\?\.\(\); placeHold\?\.release\(\);[^\n]*\n\s*\},\n\s*\};\n\}/);
  // scenes/exterior.js - the fixed city is ONE place it never leaves: its doors stay pinned; its buildings and dungeons
  // are worldModes', handed the whole pipeline
  const E = rd('src/scenes/exterior.js');
  assert.doesNotMatch(E, /holdPlace|keepPlaces/, 'the bench holds its one city for good');
  assert.match(E, /pipeline: \{ \.\.\.pipeline, arch, palette \},/, 'and hands worldModes the pipeline its holds come from');
});
