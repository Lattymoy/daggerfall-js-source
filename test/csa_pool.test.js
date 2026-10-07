// CSA-B (2026-09-27) - COME SAIL AWAY'S BOATS DRAWN (scenes/comeSailAwayPool.js):
// the pool over a recording renderer and a stand-in pipeline - what a built
// hull hands the world pass (every active, switched-on renderer that wears a
// Daggerfall texture, never the water mask), the sails' FixDeformations bakes
// on their timer, the flats (a lantern dark until SetLights lights it), and the
// lanterns' DaggerfallLight and DungeonLightHandler deciding the light.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool, activeObjects, lanternLightUpdate, vertexBox, LANTERN_HANDLER_REACH, CSA_LIGHTS_MAX } from '../src/scenes/comeSailAwayPool.js';
import { Boat, setLights } from '../src/systems/comeSailAwayBoat.js';
import { CSA_MODEL_URLS, CARRACK_MODEL_URL, LARGE_BOAT_MODEL_URL } from '../src/systems/comeSailAwayModels.js';
import { setShipStanding } from '../src/systems/naval/navalShips.js';
import { PrefabNode } from '../src/world/prefabNode.js';

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const settle = () => new Promise((r) => setTimeout(r, 0));

function recordingRenderer() {
  const r = { created: [], drawn: [], updated: [], batches: [], destroyed: [] };
  r.createMesh = (model) => { const m = { model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }; r.created.push(m); return m; };
  r.drawMesh = (mesh, matrix) => r.drawn.push({ mesh, matrix });
  r.updateMeshVertices = (mesh, p, n) => r.updated.push({ mesh, p: p.slice(), n: n.slice() });
  r.createBillboardBatch = (archive, record, size, centers, opts) => { const b = { archive, record, size, centers, opts }; r.batches.push(b); return b; };
  r.destroyBillboardBatch = (b) => r.destroyed.push(b);
  r.destroyMesh = (m) => r.destroyed.push(m);
  return r;
}
function standInPipeline() {
  const uploads = [];
  const texture = (archive) => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }), archive: undefined, _a: archive });
  const textureFiles = new Map();
  const cpuModels = new Map(), gpuMeshes = new Map();
  return {
    uploads, textureFiles, cpuModels, gpuMeshes,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture(a)); return textureFiles.get(a); },
    uploadRecord: (a, r, o) => uploads.push([a, r, !!o?.opaque]),
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); const g = { classic: id }; gpuMeshes.set(id, g); return g; },
  };
}

test('CSA-B: the pool walks only active objects, each with its matrix carried down once, depth first', () => {
  const a = new PrefabNode('a', { position: [1, 0, 0] });
  const b = new PrefabNode('b', { position: [0, 2, 0] }).setParent(a);
  new PrefabNode('b1', { position: [0, 0, 3] }).setParent(b);
  new PrefabNode('off', { active: false }).setParent(a);
  new PrefabNode('under-off').setParent(a.getChild(1));
  const c = new PrefabNode('c').setParent(a);
  const seen = [...activeObjects(a)];
  assert.deepEqual(seen.map(([n]) => n.name), ['a', 'b', 'b1', 'c']);
  assert.deepEqual([...seen[2][1]].slice(12, 15), [1, 2, 3]);
  assert.equal(seen[3][0], c);
  assert.deepEqual([...activeObjects(new PrefabNode('x', { active: false }))], []);
  assert.deepEqual(vertexBox(new Float32Array([1, 2, 3, -1, 5, 0])), { min: [-1, 2, 0], max: [1, 5, 3] });
  assert.equal(vertexBox(new Float32Array(0)), null);
});

test('CSA-B: a lantern\'s light - DaggerfallLight sets it to IsCityLightsOn on its first frame and at each change of the flag, DungeonLightHandler every 0.4 s of game time to "within 51.5 m on the ground plane", and neither runs while SetLights has them off', () => {
  const holder = new PrefabNode('DungeonLight(Clone)', { position: [0, 10, 0] });
  const light = holder.addComponent({ type: 'Light', enabled: true });
  light.node = holder;
  const dl = holder.addComponent({ type: 'DaggerfallLight', enabled: true, InteriorLight: false, lastCityLightsFlag: null });
  const h = holder.addComponent({ type: 'DungeonLightHandler', enabled: true, UnscaledBlockRange: 2060, UpdateInSeconds: 0.4, timer: 0 });
  assert.equal(LANTERN_HANDLER_REACH, 51.5);
  lanternLightUpdate(light, { dt: 0.1, cityLightsOn: false, playerPosition: [0, 0, 0] });
  assert.equal(light.enabled, false, 'by day the first frame puts it out');
  for (let i = 0; i < 3; i++) lanternLightUpdate(light, { dt: 0.1, cityLightsOn: false, playerPosition: [0, 0, 0] });
  assert.equal(light.enabled, false, 'four tenths is not MORE than 0.4');
  lanternLightUpdate(light, { dt: 0.1, cityLightsOn: false, playerPosition: [0, 500, 51] });
  assert.equal(light.enabled, true, 'the handler lights it: 51 m away on the ground plane, whatever the height');
  assert.equal(h.timer, 0);
  for (let i = 0; i < 5; i++) lanternLightUpdate(light, { dt: 0.1, cityLightsOn: false, playerPosition: [52, 0, 0] });
  assert.equal(light.enabled, false, 'past the reach it goes out');
  lanternLightUpdate(light, { dt: 0.01, cityLightsOn: true, playerPosition: [52, 0, 0] });
  assert.equal(light.enabled, true, 'the flag changed: DaggerfallLight sets it to the flag');
  assert.equal(dl.lastCityLightsFlag, true);
  dl.enabled = false; h.enabled = false; light.enabled = false;
  for (let i = 0; i < 10; i++) lanternLightUpdate(light, { dt: 0.1, cityLightsOn: false, playerPosition: [0, 0, 0] });
  assert.equal(light.enabled, false, 'switched off by SetLights: nothing decides it');
});

test('CSA-B: a spawned boat draws every active, switched-on renderer that wears a Daggerfall texture - its textures uploaded opaque first - and its helpers\' classic models, never the water mask', async () => {
  const renderer = recordingRenderer();
  const pipeline = standInPipeline();
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  const boat = await pool.spawn(new Boat(0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  assert.ok(boat && pool.boats.length === 1);
  assert.ok(pipeline.uploads.some(([a, r, o]) => a === 210 && r === 27 && !o), 'the lantern flat uploaded before the build (a billboard: not opaque)');
  assert.equal(pool.draw(), 0, 'the first frame asks for the meshes and draws none');
  for (let i = 0; i < 5; i++) await settle();
  const n = pool.draw();
  const drawn = renderer.drawn.map((d) => d.mesh);
  assert.ok(n > 0 && drawn.every((m) => m.model || m.classic));
  const hullMeshes = new Set(renderer.created.map((m) => m.model.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`).join(',')));
  assert.ok(hullMeshes.size > 0);
  // every drawn submesh's texture was uploaded opaque (a mesh material, alphaIndex -1) before its mesh was built
  for (const m of renderer.created) for (const s of m.model.subMeshes) assert.ok(pipeline.uploads.some(([a, r, o]) => a === s.textureArchive && r === s.textureRecord && o), `${s.textureArchive}_${s.textureRecord}`);
  // the water mask is never uploaded as a mesh; the helper plane (renderer off) is never drawn
  const want = [...activeObjects(boat.GameObject)].filter(([nd]) => {
    const mr = nd.getComponent('MeshRenderer');
    return mr && mr.m_Enabled !== false && !mr.materials?.[0]?.billboard && (mr.classicModel != null || (mr.materials ?? []).some((s) => Number.isInteger(s?.archive)));
  }).length;
  assert.equal(n, want, 'exactly those - the water mask, whose one slot is the bundle\'s WaterMaskMaterial, is not among them');
  assert.ok([...activeObjects(boat.GameObject)].some(([nd]) => nd.name === 'DingyWaterCull'), 'the mask is there to be skipped');
  pool.remove(boat);
  assert.equal(pool.boats.length, 0);
  assert.equal(pool.draw(), 0);
});

test('CSA-B: the sails bake on FixDeformations\' timer - nothing drawn until the first bake, the mesh built once its textures are in, the later bakes written over it', async () => {
  const renderer = recordingRenderer();
  const pipeline = standInPipeline();
  // SHIPS-2: the mod's own Carrack and her five sails on FixDeformations' own timer - hull 4 as the game stands it when
  // Mac's carrack's model will not load (his bakes on the galleon's law: test/ships2_carrack.test.js)
  const modFetch = (url) => (url === CARRACK_MODEL_URL || url === LARGE_BOAT_MODEL_URL ? Promise.resolve({ ok: false, status: 404 }) : fileFetch(url));
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: modFetch, log: { warn() {} } });
  const boat = await pool.spawn(new Boat(4), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });   // the carrack: five sails
  setShipStanding(4, true); setShipStanding(1, true);   // the builds the new ships' again, for every other test
  const holders = [...activeObjects(boat.GameObject)].filter(([n]) => n.getComponent('FixDeformations')).map(([n]) => n);
  assert.equal(holders.length, 5);
  for (let f = 0; f < 7; f++) pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.ok(holders.every((h) => h.getComponent('FixDeformations').bakedMesh == null), 'seven frames: no bake yet');
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.ok(holders.every((h) => h.getComponent('FixDeformations').bakedMesh), 'the eighth frame bakes');
  for (let i = 0; i < 5; i++) await settle();
  const baked = renderer.created.filter((m) => holders.some((h) => h.getComponent('FixDeformations').bakedMesh?.gpu === m));
  assert.equal(baked.length, 5, 'one mesh per sail');
  const before = renderer.updated.length;
  for (let f = 0; f < 8; f++) pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.equal(renderer.updated.length - before, 5, 'the next bake writes over each sail\'s mesh');
  for (let f = 0; f < 50; f++) pool.frame(0, { playerPosition: [0, 0, 0] });
  assert.equal(renderer.updated.length - before, 5, 'a paused game never bakes');
  const drawnSails = (() => { renderer.drawn.length = 0; pool.draw(); return renderer.drawn.filter((d) => baked.includes(d.mesh)).length; })();
  assert.equal(drawnSails, 5);
});

test('CSA-B: the flats - one batch per active billboard, centred on its object, a lantern dark until SetLights lights it; and the lit lanterns reach the host\'s lights, the nearest few', async () => {
  const renderer = recordingRenderer();
  const pipeline = standInPipeline();
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
  const boat = await pool.spawn(new Boat(2), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });   // the galleon: crew and eighteen lanterns
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  const flats = [...activeObjects(boat.GameObject)].filter(([n]) => n.getComponent('DaggerfallBillboard') && n.getComponent('MeshRenderer').m_Enabled !== false);
  assert.equal(pool.batches().length, flats.length);
  const size = [40 * 0.025, 64 * 0.025];
  for (const b of pool.batches()) {
    assert.deepEqual([b.size.w, b.size.h].map((v) => +v.toFixed(6)), size.map((v) => +v.toFixed(6)));
    assert.equal(b.emissionOff, b.archive === 210, `${b.archive}_${b.record}: a lantern is dark while its light is off`);
  }
  const [node, m] = flats[0];
  const b0 = pool.batches()[0];
  assert.deepEqual(b0.origin.map((v) => +v.toFixed(4)), [m[12], m[13] - size[1] / 2, m[14]].map((v) => +v.toFixed(4)), 'the batch stands on its base, its centre on the object');
  assert.ok(node);
  assert.deepEqual(pool.lights([0, 0, 0]), []);
  setLights(boat, true);
  pool.frame(0.5, { playerPosition: [0, 0, 0], cityLightsOn: true });
  assert.ok(pool.batches().filter((b) => b.archive === 210).every((b) => !b.emissionOff));
  const lit = pool.lights([0, 0, 0]);
  assert.equal(lit.length, CSA_LIGHTS_MAX);
  assert.deepEqual(lit[0].color.map((v) => +v.toFixed(4)), [1, +(147 / 255).toFixed(4), +(41 / 255).toFixed(4)]);
  assert.equal(lit[0].range, 20);
  const d = lit.map((l) => Math.hypot(l.x, l.y, l.z));
  assert.ok(d.every((v, i) => i === 0 || v >= d[i - 1]), 'nearest first');
  pool.offsetAll([10, 0, -5]);
  assert.deepEqual(boat.GameObject.localPosition, [10, 0, -5]);
  pool.destroyAll();
  assert.equal(pool.batches().length, 0);
});

test('CSA-B: the pool never traps on files that will not load - no boat stands and it says so once', async () => {
  const warns = [];
  const pool = createComeSailAwayPool({ renderer: recordingRenderer(), pipeline: standInPipeline(), fetchFn: async () => ({ ok: false, status: 404 }), log: { warn: (...a) => warns.push(a) } });
  assert.equal(await pool.spawn(new Boat(0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] }), null);
  assert.equal(await pool.spawn(new Boat(0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] }), null);
  assert.equal(warns.length, 1);
  assert.ok(Object.values(CSA_MODEL_URLS).every((u) => u.includes('vendor/come-sail-away/Models/')));
});

/** A Renderer over a GL that records what it is asked (audit39_render.test.js's stub, with the binds and the buffer writes kept). */
async function stubRenderer() {
  const { Renderer } = await import('../src/render/renderer.js');
  const log = { binds: [], subData: [] };
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'bindTexture') return (target, tex) => log.binds.push(tex);
      if (k === 'bufferSubData') return (target, offset, data) => log.subData.push(data);
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { r: new Renderer(canvas), log };
}
const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('CSA-B: the renderer\'s two new doors - a flat marked emissionOff binds no emission map (a lit twin of the same record still binds its own), and updateMeshVertices writes a bake over the mesh\'s own two buffers and moves its bounds', async () => {
  const { r, log } = await stubRenderer();
  const albedo = { name: 'albedo' }, glow = { name: 'glow' };
  r.textures.set('210_27', albedo);
  r.emissionTextures.set('210_27', glow);
  r.beginFrame(identity(), identity(), new Float32Array([0, 1, 0]));
  log.binds.length = 0;
  const dark = { archive: 210, record: 27, vao: {}, indexCount: 6, size: { w: 1, h: 1 }, emissionOff: true };
  const litB = { archive: 210, record: 27, vao: {}, indexCount: 6, size: { w: 1, h: 1 } };
  r.drawBillboards([dark], [1, 0, 0], [0, 1, 0]);
  assert.ok(log.binds.includes(albedo) && !log.binds.includes(glow), 'the dark lantern: its albedo, no glow');
  log.binds.length = 0;
  r.drawBillboards([dark, litB], [1, 0, 0], [0, 1, 0]);
  assert.ok(log.binds.includes(glow), 'the lit one of the same record still binds the glow - the skip key carries the switch');
  // a bake written over a mesh
  const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: new Float32Array(9), uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2]), subMeshes: [{ textureArchive: 50, textureRecord: 7, startIndex: 0, primitiveCount: 1 }] };
  const mesh = r.createMesh(model);
  log.subData.length = 0;
  const moved = new Float32Array([10, 0, 0, 11, 0, 0, 10, 1, 0]), normals = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1]);
  r.updateMeshVertices(mesh, moved, normals);
  assert.deepEqual(log.subData, [moved, normals]);
  assert.ok(mesh.bounds[0] > 9 && mesh.subMeshes[0]._bounds[0] > 9, 'the whole and the submesh bounds follow the bake');
  mesh._dead = true;
  log.subData.length = 0;
  r.updateMeshVertices(mesh, moved, normals);
  assert.equal(log.subData.length, 0, 'a destroyed mesh takes no write');
});
