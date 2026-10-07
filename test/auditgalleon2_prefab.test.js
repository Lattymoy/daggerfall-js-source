// AUDIT GALLEON-2 (2026-10-03): HER PREFAB, HER PICTURES, HER MESHES AND HER LOADER, read a second time (the first:
// test/auditgalleon_prefab.test.js). Each pin failed on the code as it stood (57baee705) or, where the law was right and
// unpinned, on its mutant (tools/mutants/auditgalleon2_prefab.json); each fix carries an `AUDIT GN2-<id>` comment.
//   PF3  her pictures painted and her glass's glow cut at the preload, never at her first draw
//   PF4  her model fetched beside the mod's five files; her prefab built once a process, and never written by a boat
//   PF5  her pictures and her glow classic art to Retro Mode's no-mip cap, as every other hull's are
//   PF7  her helm taken from any side of her wheel       PF8  her doors hinged at their leaf's face, the castle's on her deck
//   TS7  her glow her glass, pixel for pixel              TS8  a built prism's ends face out
//   TS12 a flipped smooth triangle's corner normals ride their corners; her port side's livery reads unmirrored
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import * as GM from '../src/world/galleonModel.js';
import * as GA from '../src/world/galleonArt.js';
import { MeshBench, prism, box, planarUv, cross, sub, dot, norm, add, scl } from '../src/world/galleonMesh.js';
import { comeSailAwayModels, loadComeSailAwayModels, CSA_MODEL_URLS } from '../src/systems/comeSailAwayModels.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { Renderer } from '../src/render/renderer.js';
import { Boat, boatAnimators, animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import {
  clearVendorTextures, isVendorArchive, preloadTextureArchive, vendorTextureStandIn, decodedTexture, setTextureDeriveContext,
} from '../src/systems/textureReplacement.js';
import { colliderPoses, boxColliderTriangles, raycastColliders, invertAffine } from '../src/world/prefabColliders.js';
import { EYE_HEIGHT, CROUCH_EYE_HEIGHT } from '../src/player/motor.js';
import { multiply } from '../src/world/mat4.js';
import { MODELS, scene } from './csaScene.mjs';

const { MEASURED: M, HELM } = GM;
const { galleonArt, galleonGlow, _resetGalleonArt, GALLEON_ARCHIVE, TEX, BANDS } = GA;
const DIR = new URL('../vendor/come-sail-away/Models/', import.meta.url);
const BAKE_TEXT = readFileSync(new URL('../src/assets/galleon/galleon.json', import.meta.url), 'utf8');
const BAKE = JSON.parse(BAKE_TEXT);
const modFiles = () => {
  const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  return { prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') };
};
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const nodeNamed = (root, name) => [...root.walk()].find((n) => n.name === name) ?? null;
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
/** A renderer that draws nothing (the pool's calls into it). */
const quietRenderer = (extra = {}) => ({
  createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((x) => ({ ...x, _bounds: [0, 0, 0, 0] })) }),
  drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers) => ({ archive, record, size, centers }),
  destroyBillboardBatch() {}, destroyMesh() {}, uploadEmissionTexture() {}, ...extra,
});
const classicShell = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
/** A pipeline that answers a vendor-only archive as scenes/dataPipeline.js's getTexture does - the vendor door's preload
 *  (every picture built), then the stand-in - and logs each archive asked for. */
function vendorPipeline(asked = []) {
  const files = new Map();
  return {
    asked,
    getTexture: async (a) => {
      asked.push(a);
      if (!isVendorArchive(a)) return classicShell();
      if (!files.has(a)) files.set(a, preloadTextureArchive(a).then(() => vendorTextureStandIn(a)));
      return files.get(a);
    },
    uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }),
  };
}
/** Her pictures off the door and her glow uncut, as a process that never loaded her stands. */
const freshArt = () => { clearVendorTextures(); _resetGalleonArt(); setTextureDeriveContext({ classicRgba: async () => null }); };

// ── PF3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 PF3: her pictures are painted and her glass\'s glow cut AT THE PRELOAD - her archive asked and every one of her twenty-three records built on the vendor door, her stern windows\' glow made - never at her first draw (her first mesh\'s ask, or a sail bake\'s: a 50-120 ms stall the first time a hull 2 came into view)', async () => {
  freshArt();
  const pipeline = vendorPipeline();
  const pool = createComeSailAwayPool({ renderer: quietRenderer(), pipeline, fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  assert.ok(pipeline.asked.includes(GALLEON_ARCHIVE), `TEXTURE.${GALLEON_ARCHIVE} asked during the preload`);
  for (const r of Object.values(TEX)) assert.ok(decodedTexture(GALLEON_ARCHIVE, r), `record ${r} painted at the preload`);
  assert.equal(GA._galleonGlowMade?.(), true, 'her glow cut at the preload');
  freshArt();
});

// ── PF4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 PF4: her model is fetched BESIDE the mod\'s five files - every one of the six asked before any answers (it was asked only once all five had come: a whole fetch later)', async () => {
  const events = [];
  const slow = async (url) => {
    const name = String(url).split('/').pop();
    events.push(`start ${name}`);
    await new Promise((r) => setTimeout(r, 15));
    events.push(`done ${name}`);
    return fileFetch(url);
  };
  const m = await loadComeSailAwayModels(slow, CSA_MODEL_URLS, { warn() {} });
  assert.equal(m.galleon, true);
  const firstDone = events.findIndex((e) => e.startsWith('done'));
  assert.ok(events.indexOf('start galleon.json') >= 0 && events.indexOf('start galleon.json') < firstDone, `her model asked before any file answered: ${events.join(', ')}`);
});

test('AUDIT GALLEON-2 PF4: her prefab is built ONCE A PROCESS - a second world\'s models over the same bake (parsed anew, as a new scene\'s fetch gives it) serve the same prefab, components and meshes; a bake that differs under the same source hash is built anew, never served the cached one (galleonPrefab was a 150-340 ms long task on the loader\'s then, every world scene)', () => {
  const files = modFiles();
  const a = comeSailAwayModels({ ...files, galleon: JSON.parse(BAKE_TEXT) });
  const b = comeSailAwayModels({ ...modFiles(), galleon: JSON.parse(BAKE_TEXT) });
  assert.ok(b.prefab(GM.GALLEON_PREFAB_ID) === a.prefab(GM.GALLEON_PREFAB_ID), 'the same prefab tree');
  assert.ok(b.geometry('galleon:hull') === a.geometry('galleon:hull'), 'the same meshes');
  assert.ok(b.components[b.components.length - 1] === a.components[a.components.length - 1], 'the same components');
  assert.ok(MODELS.prefab(GM.GALLEON_PREFAB_ID) === a.prefab(GM.GALLEON_PREFAB_ID), 'the scene\'s models too');
  // the same sha256 over other parts: built, and it fails as that bake fails
  const lacking = { ...JSON.parse(BAKE_TEXT), parts: BAKE.parts.filter((p) => p.role !== 'bowsprit') };
  assert.equal(lacking.sha256, BAKE.sha256);
  assert.throws(() => comeSailAwayModels({ ...modFiles(), galleon: lacking }), /the bake has no bowsprit/);
  // and the good bake is still served after it
  assert.ok(comeSailAwayModels({ ...modFiles(), galleon: JSON.parse(BAKE_TEXT) }).prefab(GM.GALLEON_PREFAB_ID) === a.prefab(GM.GALLEON_PREFAB_ID), 'the good bake served again');
  // over another mod table - its components a row longer, or its own galleon (whose small things hers are) changed - she
  // is built anew, her components' places in the table her own
  // the longer table first, over the cache the good table left - its components' places all that differ (SHIPS-2: each
  // port ship has its own entry, so a table changed first rebuilds her on that alone)
  const longer = modFiles();
  longer.prefabs.components = [{ type: 'Transform' }, ...longer.prefabs.components];
  const c = comeSailAwayModels({ ...longer, galleon: JSON.parse(BAKE_TEXT) });
  const hullOf = (models) => models.prefab(GM.GALLEON_PREFAB_ID).children.find((n) => n.name === GM.GALLEON_HULL_NODE)
    .components.map((i) => models.components[i]).map((k) => [k.type, k.m_Mesh?.mesh ?? null]);
  assert.deepEqual(hullOf(c), hullOf(a), 'her hull\'s components where her table puts them');
  assert.deepEqual(hullOf(a).map(([t]) => t), ['MeshFilter', 'MeshRenderer', 'MeshCollider']);
  const changed = modFiles();
  changed.prefabs.components = [{ type: 'Transform' }, ...changed.prefabs.components];   // the longer table's places: its galleon all that differs
  const findIn = (t, name) => (t.name === name ? t : t.children.reduce((f, k) => f ?? findIn(k, name), null));
  findIn(changed.prefabs.prefabs[String(GM.GALLEON_PREFAB_ID)], 'Modifiers').position = [0, 0.5, 0];
  const d = comeSailAwayModels({ ...changed, galleon: JSON.parse(BAKE_TEXT) });
  assert.deepEqual(d.prefab(GM.GALLEON_PREFAB_ID).children.find((n) => n.name === 'Modifiers').position, [0, 0.5, 0], 'the mod\'s galleon\'s small things as that table has them');
});

test('AUDIT GALLEON-2 PF4: the cached prefab is NEVER WRITTEN - boats built on it (spawned, sailed, their doors, hatches and shutters worked, drawn and their sails baked by a pool) leave her tree, her components and every mesh of hers to the byte as built', async () => {
  const hashOf = (models) => {
    const h = createHash('sha256');
    h.update(JSON.stringify(models.prefab(GM.GALLEON_PREFAB_ID)));
    h.update(JSON.stringify(models.components));
    for (const key of Object.keys(models.meshes).filter((k) => models.meshes[k].galleon).sort()) {
      const g = models.geometry(key);
      h.update(key);
      for (const a of [g.positions, g.normals, g.uvs, g.indices, g.blendIndices, ...(g.bindPoses ?? [])]) if (a) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
      h.update(JSON.stringify([g.subMeshes, g.slots, g.aabb]));
    }
    return h.digest('hex');
  };
  // what is cached now (the mod's table as the game fetches it), and what the scene's boats are built on
  const cached = comeSailAwayModels({ ...modFiles(), galleon: JSON.parse(BAKE_TEXT) });
  const hash = () => hashOf(cached) + hashOf(MODELS);
  const before = hash();
  // a scene's boat: placed, helmed, sail made, every part that opens worked
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  s.helm(boat);
  s.rt.RaiseSails();
  for (const n of boat.GameObject.walk()) if (/^(CastleDoor|BulkheadDoor|Hatch(Aft|Fore)|Gunport(Starboard|Port)\d)$/.test(n.name)) animatorOf(n).SetBool('Opened', true);
  for (let i = 0; i < 12; i++) s.frame();
  // a pool's: preloaded (her deck baked), drawn, its sails baked
  freshArt();
  const pool = createComeSailAwayPool({ renderer: quietRenderer(), pipeline: vendorPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  assert.ok(pool.models.prefab(GM.GALLEON_PREFAB_ID) === cached.prefab(GM.GALLEON_PREFAB_ID), 'the pool\'s models serve the cached prefab');
  pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  for (let i = 0; i < 20; i++) { pool.frame(0.25, {}); pool.draw(); await new Promise((r) => setTimeout(r, 2)); }
  assert.equal(hash(), before, 'her prefab as built');
  freshArt();
});

// ── PF5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 PF5: her pictures and her glass\'s glow are her CLASSIC ART to Retro Mode - through the real pipeline into the real renderer\'s uploads, Retro Mode without mip maps caps every one of hers to its first level as it caps a classic hull\'s texture (she was the only hull drawn mip-mapped: her stand-ins uploaded as replacements, TryImportTexture\'s, which DFU\'s retro arm never reaches)', async () => {
  freshArt();
  let nextId = 1, bound = null;
  const maxLevel = new Map();
  const gl = {
    TEXTURE_2D: 'T2D', TEXTURE_2D_ARRAY: 'T2DA', TEXTURE0: 'U0', TEXTURE1: 'U1', RGBA: 'RGBA', UNSIGNED_BYTE: 'UB', UNPACK_FLIP_Y_WEBGL: 'FLIP',
    TEXTURE_WRAP_S: 'WS', TEXTURE_WRAP_T: 'WT', TEXTURE_MIN_FILTER: 'MIN', TEXTURE_MAG_FILTER: 'MAG', TEXTURE_MAX_LEVEL: 'MAXL',
    REPEAT: 'REPEAT', NEAREST: 'NEAREST', NEAREST_MIPMAP_NEAREST: 'NMN', CLAMP_TO_EDGE: 'CLAMP', LINEAR: 'LINEAR',
    createTexture: () => ({ id: nextId++ }), bindTexture: (_, t) => { bound = t; }, pixelStorei() {}, texImage2D() {}, generateMipmap() {}, activeTexture() {},
    texParameteri: (_, p, v) => { if (bound && p === 'MAXL') maxLevel.set(bound.id, v); },
  };
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    gl, textures: new Map(), emissionTextures: new Map(), emissionWhite: new Set(), tileArrays: new Map(), _replacements: new WeakSet(), _retroMips: true,
    _texKeysByBase: new Map(), _texGen: 0, _tex0Bound: null, _activeTexture() {}, _forgetTextureShadows() {},
  }, quietRenderer({ uploadEmissionTexture: Renderer.prototype.uploadEmissionTexture }));
  const warn = console.warn;
  console.warn = () => {};   // no ARENA2 here: the flats' config and the classic archives say so
  try {
    const pipeline = createDataPipeline({ renderer, arch: null, palette: null, fetch: async () => { throw new Error('no ARENA2 here'); } });
    const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} } });
    assert.equal(await pool.preload(), true);
    pool.spawnNow(new Boat(HULL.SmallShip, 0), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
    const hers = (map) => [...map.keys()].filter((k) => k.startsWith(`${GALLEON_ARCHIVE}_`));
    for (let i = 0; i < 100 && hers(renderer.emissionTextures).length < BANDS.sternWindows.recs.length; i++) { pool.draw(); await new Promise((r) => setTimeout(r, 5)); }
    assert.ok(hers(renderer.textures).length >= 20, `her pictures uploaded (${hers(renderer.textures).length})`);
    assert.equal(hers(renderer.emissionTextures).length, BANDS.sternWindows.recs.length, 'her glow uploaded');
    renderer._applyRetroMips(false);   // Retro Mode on, UseMipMapsInRetroMode off
    for (const k of hers(renderer.textures)) assert.equal(maxLevel.get(renderer.textures.get(k).id), 0, `${k}: capped to its first level under Retro Mode`);
    for (const k of hers(renderer.emissionTextures)) assert.equal(maxLevel.get(renderer.emissionTextures.get(k).id), 0, `${k}'s glow: capped with its picture`);
    // a mod's own stand-in stays TryImportTexture's: uploaded through the same door, never capped
    assert.equal(pipeline.isClassicArt(GALLEON_ARCHIVE), true);
    assert.equal(pipeline.isClassicArt(112395), false, 'Come Sail Away\'s own pictures are a mod\'s');
  } finally { console.warn = warn; }
  freshArt();
});

// ── PF7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 PF7: HER HELM IS TAKEN FROM ANY SIDE OF HER WHEEL - from her roof at every bearing round the hub (0.9-2.4 m off it, standing and crouched), Come Sail Away\'s activation ray at the hub (triggers taken, 3.2 m) meets her DriveTrigger before anything of hers, as every bearing does on the mod\'s own galleon (forward of the wheel her HelmPedestal\'s collider stood out of the trigger: 150-210 deg, 1 of 6)', () => {
  const s = scene();
  const boat = s.place(HULL.SmallShip, 0);
  const H = boat.MeshObject.worldMatrix();
  const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : null);
  const isDrive = (n) => { for (let k = n; k; k = k.parent) if (k === boat.DriveTrigger) return true; return false; };
  const missed = [];
  for (const eyeY of [EYE_HEIGHT, CROUCH_EYE_HEIGHT]) {
    for (let deg = 0; deg < 360; deg += 15) {
      for (const r of [0.9, 1.2, 1.5, 1.8, 2.1, 2.4]) {
        const a = (deg * Math.PI) / 180;   // 0 abaft the hub (the helmsman's side), 180 forward of it
        const eye = [HELM.hub[0] + Math.sin(a) * r, M.castleRoofY + eyeY, HELM.hub[2] - Math.cos(a) * r];
        const o = xf(H, eye), t = xf(H, HELM.hub), d = sub(t, o), L = Math.hypot(...d);
        const hit = raycastColliders(boat.GameObject, o, d.map((v) => v / L), 3.2, { triggers: true, geometry });
        if (!(hit && isDrive(hit.node))) missed.push(`${deg} deg ${r} m eye ${eyeY}: ${hit ? hit.node.name : 'nothing'}`);
      }
    }
  }
  assert.deepEqual(missed, [], 'her DriveTrigger first from every side');
  // still where the helm stands: the wheel's hub and the pedestal's collider inside the trigger's cube (over the hub), its
  // after face clear of the helmsman's capsule
  const inv = invertAffine(H);
  const boxIn = (node, c) => { const g = boxColliderTriangles(c), m = node.worldMatrix(), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < g.positions.length; i += 3) { const p = xf(inv, xf(m, [g.positions[i], g.positions[i + 1], g.positions[i + 2]])); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } } return { mn, mx }; };
  const cube = boxIn(boat.DriveTrigger, boat.DriveTrigger.getComponent('BoxCollider'));
  const pedNode = nodeNamed(boat.GameObject, 'HelmPedestal'), ped = boxIn(pedNode, pedNode.getComponent('BoxCollider'));
  assert.ok([0, 1, 2].every((k) => HELM.hub[k] > cube.mn[k] + 0.2 && HELM.hub[k] < cube.mx[k] - 0.2), 'the wheel\'s hub inside the trigger');
  assert.ok([0, 2].every((k) => ped.mn[k] > cube.mn[k] + 0.05 && ped.mx[k] < cube.mx[k] - 0.05) && ped.mx[1] < cube.mx[1], `the pedestal's collider inside it over the hub (${ped.mn.map((v) => v.toFixed(3))}..${ped.mx.map((v) => v.toFixed(3))} in ${cube.mn.map((v) => v.toFixed(3))}..${cube.mx.map((v) => v.toFixed(3))})`);
  assert.ok(cube.mn[2] > HELM.stand[2] + 0.4, `the trigger's after face (${cube.mn[2].toFixed(3)}) clear of the helmsman at ${HELM.stand[2]}`);
});

// ── PF8 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Segment p->q against triangle: whether it crosses inside both. */
function segTri(p, q, [a, b, c]) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const s0 = sub(p, a), u = dot(s0, h) / det; if (u < 0 || u > 1) return false;
  const qq = cross(s0, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qq) / det; return t > 1e-6 && t < 1 - 1e-6;
}
const triTri = (A, B) => [0, 1, 2].some((i) => segTri(A[i], A[(i + 1) % 3], B) || segTri(B[i], B[(i + 1) % 3], A));
const boxOf = (tris) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } return { mn, mx }; };
const crossCount = (As, Bs) => {
  const ba = boxOf(As);
  let n = 0;
  for (const B of Bs) {
    const bb = boxOf([B]);
    if ([0, 1, 2].some((k) => bb.mx[k] < ba.mn[k] || bb.mn[k] > ba.mx[k])) continue;
    for (const A of As) if (triTri(A, B)) n++;
  }
  return n;
};
const trisOf = (g, m) => { const out = [], I = g.indices; for (let t = 0; t < I.length; t += 3) out.push([0, 1, 2].map((k) => xf(m, [g.positions[I[t + k] * 3], g.positions[I[t + k] * 3 + 1], g.positions[I[t + k] * 3 + 2]]))); return out; };

test('AUDIT GALLEON-2 PF8: HER DOORS SWING ON THEIR LEAF\'S FACE - shut or open, neither leaf (drawn or solid) meets anything of hers, the open leaf lying inside its doorway\'s jamb; the castle\'s door stands ON her main deck, the bulkhead\'s on her gun deck (both pivoted at the middle of the leaf\'s thickness: open, 2.0 cm into the jamb over their whole height - the castle\'s 15 pairs of triangles, the bulkhead\'s 11 - and the castle\'s foot 1.4 cm inside her deck)', () => {
  for (const opened of [false, true]) {
    const s = scene();
    const boat = s.place(HULL.SmallShip, 0);
    for (const name of ['CastleDoor', 'BulkheadDoor']) animatorOf(nodeNamed(boat.GameObject, name)).SetBool('Opened', opened);
    const anims = boatAnimators(boat);
    for (let i = 0; i < 40; i++) for (const a of anims) a.update(0.1);
    const inv = invertAffine(boat.MeshObject.worldMatrix());
    const local = (m) => multiply(inv, m, new Float32Array(16));
    const solids = [];
    for (const { node, collider: c, world } of colliderPoses(boat.GameObject)) {
      if (c.m_IsTrigger || c.m_Enabled === false) continue;
      const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : null;
      if (g) solids.push({ node, tris: trisOf(g, local(world)) });
    }
    const drawn = [];
    for (const n of boat.GameObject.walk()) {
      const mf = n.activeInHierarchy ? n.getComponent('MeshFilter') : null;
      const g = mf?.m_Mesh?.mesh ? MODELS.geometry(mf.m_Mesh.mesh) : null;
      if (g) drawn.push({ node: n, tris: trisOf(g, local(n.worldMatrix())) });
    }
    for (const [name, d, floor] of [['CastleDoor', M.castleDoor, M.mainDeckY], ['BulkheadDoor', M.bulkheadDoor, M.gunDeckY]]) {
      const node = nodeNamed(boat.GameObject, name);
      for (const [what, list] of [['solid', solids], ['drawn', drawn]]) {
        const me = list.find((x) => x.node === node);
        const hits = list.filter((x) => x !== me).map((x) => [x.node.name, crossCount(me.tris, x.tris)]).filter(([, k]) => k);
        assert.deepEqual(hits, [], `${name} ${opened ? 'open' : 'shut'}: its ${what} leaf meets nothing of hers`);
      }
      const { mn, mx } = boxOf(solids.find((x) => x.node === node).tris);
      assert.ok(mn[1] >= floor, `${name}: its foot (${mn[1].toFixed(4)}) on its deck (${floor})`);
      if (!opened) near((mn[2] + mx[2]) / 2, d.z, 1e-3, `${name} shut: across its doorway's middle`);
      assert.ok(mx[1] <= d.y1, `${name}: under its doorway's head`);
      assert.ok(mn[0] >= -d.halfX && mx[0] <= d.halfX, `${name} ${opened ? 'open' : 'shut'}: inside its jambs (x ${mn[0].toFixed(4)}..${mx[0].toFixed(4)}, the jambs ±${d.halfX})`);
    }
  }
});

// ── TS7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 TS7: HER GLOW IS HER GLASS, PIXEL FOR PIXEL - each stern slice\'s mask lit exactly where its picture is her glass or its glint (galleonArt.js\'s two glass colours), the warm lamp colour there and black everywhere else; both slices carry glass (the check was some pixel over nothing: every pixel glowing passed it)', () => {
  const GLASS = [[34, 48, 58], [92, 124, 136]];   // C.glass, C.glassLit
  const art = new Map(galleonArt());
  let panes = 0;
  for (const rec of BANDS.sternWindows.recs) {
    const pic = art.get(rec), glow = galleonGlow(rec);
    assert.deepEqual([glow.width, glow.height], [pic.width, pic.height]);
    let lit = 0;
    for (let i = 0; i < pic.data.length; i += 4) {
      const glass = GLASS.some((c) => c[0] === pic.data[i] && c[1] === pic.data[i + 1] && c[2] === pic.data[i + 2]);
      const at = `record ${rec} pixel ${(i / 4) % pic.width},${Math.floor(i / 4 / pic.width)}`;
      assert.deepEqual([...glow.data.subarray(i, i + 4)], glass ? [255, 186, 96, 255] : [0, 0, 0, 255], `${at}: ${glass ? 'glass glows' : 'no glass, no glow'}`);
      if (glass) lit++;
    }
    panes += lit;
    assert.ok(lit > 0, `record ${rec} carries glass`);
  }
  assert.ok(panes < 64 * 64 * 2 * 0.2, `her glass a fifth of her stern at most (${panes} pixels)`);
});

// ── TS8 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Every triangle of a convex solid's geometry faces away from a point inside it; its signed volume. */
function solidOf(g, inside) {
  let out = 0, vol = 0;
  const P = g.positions, I = g.indices;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => [P[I[t + k] * 3], P[I[t + k] * 3 + 1], P[I[t + k] * 3 + 2]]);
    const n = cross(sub(b, a), sub(c, a)), mid = scl(add(add(a, b), c), 1 / 3);
    if (dot(n, sub(mid, inside)) > 0) out++;
    vol += dot(a, cross(b, c)) / 6;
  }
  return { faces: I.length / 3, out, vol };
}

test('AUDIT GALLEON-2 TS8: A BUILT PRISM\'S ENDS FACE OUT - every face of a capped prism (any axis, tapered, twisted, on a reference, flat or smooth, a cone to its point) looks away from its middle and its volume is the frustum\'s, positive; a box\'s six faces likewise; her guns\' trucks\' caps face away from her gun (an end cap turned inward stood on 119 caps of hers - trucks, breeches, the wheel\'s hub, deadeyes, the gaff\'s heel - and no pin saw it)', () => {
  const area = (r, n) => (n / 2) * r * r * Math.sin((2 * Math.PI) / n);
  const cases = [
    { p0: [0, 0, 0], p1: [2, 0, 0], r0: 0.3, r1: 0.3, sides: 8 },
    { p0: [0, 1, 0], p1: [0, -1.5, 0], r0: 0.2, r1: 0.12, sides: 6, opts: { smooth: true } },
    { p0: [0.2, 0.1, -0.4], p1: [0.2, 0.1, 0.9], r0: 0.17, r1: 0.17, sides: 10, opts: { smooth: true, twist: 0.3 } },
    { p0: [1, 2, 3], p1: [-0.5, 2.7, 1.9], r0: 0.11, r1: 0.05, sides: 4, opts: { ref: [0, 1, 0] } },
    { p0: [0, 0, 0], p1: [0.3, 0.2, 0.1], r0: 0.036, r1: 0, sides: 6, opts: { smooth: true, caps: [true, false] } },
    { p0: [0, 0, 0], p1: [0, 0, -0.06], r0: 0.08, r1: 0.04, sides: 10, opts: { smooth: true } },
  ];
  for (const [k, { p0, p1, r0, r1, sides, opts = {} }] of cases.entries()) {
    const bench = new MeshBench(0);
    prism(bench, 1, p0, p1, r0, r1, sides, opts);
    const L = Math.hypot(...sub(p1, p0)), A0 = area(r0, sides), A1 = area(r1, sides);
    const s = solidOf(bench.finish(), scl(add(p0, p1), 0.5));
    assert.equal(s.out, s.faces, `prism ${k}: every face out (${s.out} of ${s.faces})`);
    assert.ok(Math.abs(s.vol - (L / 3) * (A0 + A1 + Math.sqrt(A0 * A1))) < 1e-9 + 1e-6 * s.vol, `prism ${k}: its volume the frustum's (${s.vol})`);
  }
  const axes = [norm([1, 0.2, 0]), norm([-0.2, 1, 0]), [0, 0, 1]];
  const bench = new MeshBench(0);
  box(bench, 1, [0.5, -0.3, 2], [0.4, 0.25, 0.1], { axes });
  const b = solidOf(bench.finish(), [0.5, -0.3, 2]);
  assert.equal(b.out, 12, 'a box\'s faces out');
  assert.ok(Math.abs(b.vol - 8 * 0.4 * 0.25 * 0.1) < 1e-6, `a box's volume (${b.vol})`);
  // in her: the trucks' end caps (the only faces of her gun square to its axle at |z| 0.38) face away from the gun
  const gun = GM.gunGeometry(), P = gun.positions, I = gun.indices;
  let caps = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b2, c] = [0, 1, 2].map((k) => [P[I[t + k] * 3], P[I[t + k] * 3 + 1], P[I[t + k] * 3 + 2]]);
    if (!(Math.abs(Math.abs(a[2]) - 0.38) < 1e-6 && [b2, c].every((p) => Math.abs(p[2] - a[2]) < 1e-6))) continue;
    caps++;
    assert.ok(Math.sign(cross(sub(b2, a), sub(c, a))[2]) === Math.sign(a[2]), `a truck's cap at z ${a[2]} faces out`);
  }
  assert.ok(caps >= 4 * 6, `her trucks' caps (${caps} triangles)`);
});

// ── TS12 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT GALLEON-2 TS12: A FLIPPED SMOOTH TRIANGLE\'S CORNER NORMALS RIDE THEIR CORNERS - a triangle laid against the way it should face has its corners turned, and each corner keeps its own normal and its own uv (the swap of the normals with the corners went unpinned: every one of her 13 flipped triangles carries one normal at all three)', () => {
  const pa = [0, 0, 0], pb = [1, 0, 0], pc = [0, 1, 0];   // cross(b - a, c - a) +z: laid facing -z, it turns
  const na = norm([0.1, 0, -1]), nb = norm([0.3, 0.1, -1]), nc = norm([-0.1, 0.4, -1]);
  const bench = new MeshBench(0);
  bench.tri(7, pa, pb, pc, [0, 0], [1, 0], [0, 1], [0, 0, -1], [na, nb, nc]);
  const g = bench.finish();
  const corners = [0, 1, 2].map((k) => ({ p: [...g.positions.subarray(k * 3, k * 3 + 3)], n: [...g.normals.subarray(k * 3, k * 3 + 3)], uv: [...g.uvs.subarray(k * 2, k * 2 + 2)] }));
  assert.ok(cross(sub(corners[1].p, corners[0].p), sub(corners[2].p, corners[0].p))[2] < 0, 'turned to face -z');
  const given = [[pa, na, [0, 0]], [pb, nb, [1, 0]], [pc, nc, [0, 1]]];
  for (const c of corners) {
    const [, n, uv] = given.find(([p]) => p.every((v, k) => Math.abs(v - c.p[k]) < 1e-9));
    c.n.forEach((v, k) => assert.ok(Math.abs(v - n[k]) < 1e-6, `the corner at ${c.p} keeps its normal`));
    assert.deepEqual(c.uv, uv, `the corner at ${c.p} keeps its uv`);
  }
});

test('AUDIT GALLEON-2 TS12: HER PORT SIDE READS UNMIRRORED - planar uv runs u to the right of a viewer facing a side, bow or stern face from outside and v up it, either side of her; every face of her hull, castle, rail and parapet that wears a livery is drawn so (its uv\'s winding against its front: the port side\'s u mirror - 1687 corners of hers - went unpinned)', () => {
  const up = [0, 1, 0];
  for (const n of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], norm([0.8, 0.1, 0.5]), norm([-0.8, -0.2, 0.4]), norm([-0.3, 0, -0.9]), norm([0.4, 0.3, 0.9])]) {
    const right = norm(cross(up, scl(n, -1)));   // the viewer looks along -n; Unity's frame is left-handed
    const p = [1.3, 2.1, -0.7], e = 0.01;
    const [u0, v0] = planarUv(p, n, [1, 1]);
    assert.ok(planarUv(add(p, scl(right, e)), n, [1, 1])[0] > u0, `facing ${n.map((v) => v.toFixed(2))}: u runs to the viewer's right`);
    assert.ok(planarUv(add(p, scl(up, e)), n, [1, 1])[1] > v0, `facing ${n.map((v) => v.toFixed(2))}: v runs up`);
  }
  const liveries = new Set(Object.values(BANDS).flatMap((b) => b.recs));
  const sides = new Map();
  for (const key of ['galleon:hull', 'galleon:castle', 'galleon:castleRail', 'galleon:castleParapet']) {
    const g = MODELS.geometry(key);
    g.slots.forEach((slot, k) => {
      if (!liveries.has(slot.record)) return;
      const sm = g.subMeshes[k];
      for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
        const [a, b, c] = [0, 1, 2].map((j) => [...g.positions.subarray(g.indices[t + j] * 3, g.indices[t + j] * 3 + 3)]);
        const [ua, ub, uc] = [0, 1, 2].map((j) => [...g.uvs.subarray(g.indices[t + j] * 2, g.indices[t + j] * 2 + 2)]);
        const n = cross(sub(b, a), sub(c, a));
        if (!(Math.hypot(...n) > 1e-8) || Math.abs(n[1]) >= Math.max(Math.abs(n[0]), Math.abs(n[2]))) continue;
        const uvArea = (ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1]);
        if (Math.abs(uvArea) < 1e-9) continue;
        const side = n[0] > 0.3 ? 'starboard' : n[0] < -0.3 ? 'port' : n[2] > 0 ? 'bow' : 'stern';
        const s = sides.get(side) ?? { ok: 0, mirrored: 0 };
        if (uvArea < 0) s.ok++; else s.mirrored++;
        sides.set(side, s);
      }
    });
  }
  for (const side of ['starboard', 'port', 'stern']) assert.ok(sides.get(side)?.ok > 10, `her ${side} faces wear her liveries (${JSON.stringify(sides.get(side))})`);
  for (const [side, s] of sides) assert.equal(s.mirrored, 0, `her ${side} livery unmirrored (${JSON.stringify(s)})`);
});
