// AUDIT NAV1 (2026-09-29) - THE FRAME'S COST (the online audit's #11-#14): what a sea fight costs a frame, and how the
// port's own machinery carries it - a mover's bucket in the world's collider (player/collider.js), a tree's colliders
// indexed and asked bounds first (world/prefabColliders.js), a node's matrix kept while it reads the same
// (world/prefabNode.js), the world's sync carrying a boat's buckets (scenes/world.js csaSyncColliders), the boats culled
// and their still parts merged (scenes/comeSailAway/comeSailAwayPool.js), the effects on one sheet (render/navalRender.js), what
// the particle budget lets go first (systems/naval/navalEffects.js), and the sea's word made once a tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Collider } from '../../src/player/collider.js';
import { navInputFromCollider } from '../../src/ai/nav/navBake.js';
import {
  collidersOf, colliderPoses, raycastColliders, rayMeshEntry, rayMeshEntryWithin, rayBoxEntry, rayConvexEntry, hullOf, invertAffine, boxColliderTriangles,
} from '../../src/world/prefabColliders.js';
import { PrefabNode, prefabShapeStamp } from '../../src/world/prefabNode.js';
import { multiply } from '../../src/world/mat4.js';
import { mat4FromQuatPosScale, quatMultiply } from '../../src/world/quat.js';
import { createComeSailAwayPool, STILL_FRAMES, STILL_MIN } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { boundsOf } from '../../src/render/bounds.js';
import { lookAt, perspective } from '../../src/world/mat4.js';
import {
  NavalRenderer, NAVAL_SHEET, NAVAL_SHEET_SIZE, NAVAL_SHEET_GUTTER, NAVAL_TEX_SIZE, NAVAL_STRIDE, NAVAL_GL_TEXTURES, navalSheetTexture,
  NAVAL_TEXTURES, sheetUv, pictureOf,
} from '../../src/render/navalRender.js';
import { createNavalEffects, PARTICLE_BUDGET, EVICT_RANK } from '../../src/systems/naval/navalEffects.js';
import { seeded } from '../navalSea.mjs';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const cut = (src, start, end = '\n  }\n') => { const i = src.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return src.slice(i, src.indexOf(end, i) + end.length); };
const cutLine = (src, start) => { const i = src.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return src.slice(i, src.indexOf('\n', i) + 1); };
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
const pipeline = () => ({ getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) });
/** A pool over a recording renderer whose meshes carry their real spheres (createMesh's own, boundsOf). */
async function recordingPool(extra = {}) {
  const log = { drawn: [], cast: [], made: [], destroyed: [] };
  const renderer = {
    createMesh: (model) => { const m = { model, vao: {}, buffers: [{}, {}], bounds: boundsOf(model.positions), subMeshes: model.subMeshes.map((s) => ({ ...s })) }; log.made.push(m); return m; },
    drawMesh: (mesh, matrix) => log.drawn.push({ mesh, matrix }), recordShadowMesh: (mesh, matrix) => log.cast.push({ mesh, matrix }), shadowReach: () => false,
    updateMeshVertices() {}, createBillboardBatch: (a, r, size, centers, opts) => ({ a, r, size, centers, opts }), destroyBillboardBatch() {},
    destroyMesh: (m) => log.destroyed.push(m),
    ...extra,
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: pipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return { pool, renderer, log };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
/** Every mesh of a boat loaded (the pool builds them on first sight, a texture's promise apiece). */
async function loaded(pool) { for (let i = 0; i < 3; i++) { pool.draw(); await settle(); } }
const rotY = (a) => [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
const rotX = (a) => [1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1];
const rotZ = (a) => [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const turnOf = (m) => [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];

// ── the world's collider: a mover's bucket ──────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 (#12) A MOVER\'S BUCKET: a hull baked once and carried by a turn and a translation answers every query as her triangles baked where she stands - the rays and their normals, the overlaps, the contact and the contact beneath, the sweep, a walk on her deck, the nav soup; her box holds hers; a bucket carried by no turn is the plain bucket to the bit (mutants: the point or the ray not turned back, the normal, the contact, the sweep\'s box or the soup not turned out, the box unturned)', async () => {
  const { pool } = await recordingPool();
  const boat = pool.spawnSeaNow(new Boat(3, 0));
  const hull = collidersOf(boat.GameObject).find((c) => c.collider.type === 'MeshCollider' && !c.collider.m_IsTrigger && pool.models.geometry(c.collider.m_Mesh.mesh));
  const g = pool.models.geometry(hull.collider.m_Mesh.mesh);
  const MA = multiply(trans(100, -1, 50), multiply(rotY(0.3), rotX(0.02)));
  const D = multiply(trans(12, 0.3, -7), multiply(rotY(0.9), multiply(rotX(-0.05), rotZ(0.04))));   // her motion since the bake: a turn, a heel, a way
  const MB = multiply(D, MA);
  const R = turnOf(D), T = [D[12], D[13], D[14]];
  const baked = new Collider(), carried = new Collider();
  baked.addMesh('hull', g.positions, g.indices, MB);
  carried.addMesh('hull', g.positions, g.indices, MA, () => T, () => R);
  const c = [MB[12], MB[13], MB[14]];
  const rnd = seeded(5);
  let hits = 0, overlaps = 0, contacts = 0, sweeps = 0;
  for (let i = 0; i < 800; i++) {
    const o = [c[0] + (rnd() - 0.5) * 60, c[1] + (rnd() - 0.2) * 20, c[2] + (rnd() - 0.5) * 60];
    let d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const l = Math.hypot(...d); d = d.map((x) => x / l);
    const a = baked.raycastHit(o, d, 80), b = carried.raycastHit(o, d, 80);
    assert.equal(Number.isFinite(a.dist), Number.isFinite(b.dist), 'the same rays meet her');
    if (Number.isFinite(a.dist)) {
      hits++;
      assert.ok(Math.abs(a.dist - b.dist) < 1e-3, `a ray's distance (${a.dist} vs ${b.dist})`);
      assert.ok(Math.hypot(a.normal[0] - b.normal[0], a.normal[1] - b.normal[1], a.normal[2] - b.normal[2]) < 1e-5, 'its normal, as she stands');
    }
    const r = 0.3 + rnd() * 2;
    assert.equal(baked.sphereOverlaps(o, r), carried.sphereOverlaps(o, r), 'the same overlap');
    if (carried.sphereOverlaps(o, r)) overlaps++;
    for (const beneath of [null, 0]) {
      const ca = baked.capsuleContact(o, 1.8, 0.5, null, [0, 0, 0], beneath), cb = carried.capsuleContact(o, 1.8, 0.5, null, [0, 0, 0], beneath);
      assert.equal(!!ca, !!cb, 'the same contact');
      if (ca) { contacts++; assert.ok(Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]) < 1e-3, 'the contact where she stands'); }
    }
    const sa = baked.sphereCastAll(o, 0.4, d, 10), sb = carried.sphereCastAll(o, 0.4, d, 10);
    assert.equal(sa.length, sb.length, 'the same sweep');
    for (let k = 0; k < sa.length; k++) { sweeps++; assert.ok(Math.abs(sa[k].dist - sb[k].dist) < 1e-3); }
  }
  assert.ok(hits > 50 && overlaps > 50 && contacts > 50 && sweeps > 20, `every query met her (${hits}, ${overlaps}, ${contacts}, ${sweeps})`);
  // a walk along her deck, the motor's own move on each
  const deck = baked.raycastHit([c[0], c[1] + 30, c[2]], [0, -1, 0], 60);
  const f1 = [c[0], c[1] + 30 - deck.dist + 0.01, c[2]], f2 = [...f1];
  for (let s = 0; s < 120; s++) { baked.move(f1, 0.05, -0.2, 0.03); carried.move(f2, 0.05, -0.2, 0.03); }
  assert.ok(Math.hypot(f1[0] - f2[0], f1[1] - f2[1], f1[2] - f2[2]) < 1e-3, `a walk on her deck ends where it ends on her baked (${f1} vs ${f2})`);
  // her box holds hers; the nav soup her triangles as they stand
  const ba = baked.bounds(), bb = carried.bounds();
  for (let k = 0; k < 3; k++) assert.ok(bb.min[k] <= ba.min[k] + 1e-6 && bb.max[k] >= ba.max[k] - 1e-6, 'her turned box holds her');
  assert.ok(bb.max[1] - bb.min[1] < (ba.max[1] - ba.min[1]) * 2, 'and is her box, turned - never the world');
  const na = navInputFromCollider(baked), nb = navInputFromCollider(carried);
  assert.equal(na.tris, nb.tris);
  let worst = 0; for (let k = 0; k < na.positions.length; k++) worst = Math.max(worst, Math.abs(na.positions[k] - nb.positions[k]));
  assert.ok(worst < 1e-3, `the soup's every corner where she stands (${worst})`);
  // no turn: the plain bucket's own walk, to the bit
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1], Z = [0, 0, 0];
  const plain = new Collider(), unturned = new Collider();
  plain.addMesh('hull', g.positions, g.indices, MA); unturned.addMesh('hull', g.positions, g.indices, MA, () => Z, () => I);
  for (let i = 0; i < 400; i++) {
    const o = [MA[12] + (rnd() - 0.5) * 60, MA[13] + (rnd() - 0.2) * 20, MA[14] + (rnd() - 0.5) * 60];
    const c1 = [...o], c2 = [...o], o1 = {}, o2 = {};
    plain._resolveSphere(c1, 0.35, o1, Infinity, true); unturned._resolveSphere(c2, 0.35, o2, Infinity, true);
    assert.deepEqual([c1, o1], [c2, o2], 'a sphere resolved alike');
  }
  pool.remove(boat);
});

test('AUDIT NAV1 (#12) THE WORLD\'S UP THROUGH A MOVER\'S TURN: a deck laid flat and carried rolled 30 degrees is ground a body rests on, rolled 80 a wall that pushes it aside; its face a floor for the one-way law only as it stands; a ray meets its face turned to the ray as it stands (mutants: the contact read in the deck\'s own frame, the face\'s slope in its own frame, the floor\'s height the local one)', () => {
  const quad = { positions: [-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5], indices: [0, 2, 1, 0, 3, 2] };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const rolled = (deg) => { const c = new Collider(); const m = rotZ((deg * Math.PI) / 180); const R = turnOf(m); c.addMesh('deck', quad.positions, quad.indices, I, () => [0, 0, 0], () => R); return c; };
  const baked = (deg) => { const c = new Collider(); c.addMesh('deck', quad.positions, quad.indices, rotZ((deg * Math.PI) / 180)); return c; };
  // each case as the same deck baked rolled answers it, to the rounding: rest, a wall, a floor sunk under, a wall sunk under
  for (const [deg, c0, oneWay] of [[30, [0.5, 0.34, 1], false], [80, [0.33, 0.05, 0.2], false], [30, [0.5, -0.1, 1], true], [80, [-0.05, -0.1, 0.3], true], [55, [0.2, 0.1, -0.4], true]]) {
    const a = [...c0], b = [...c0], oa = {}, ob = {};
    rolled(deg)._resolveSphere(a, 0.35, oa, Infinity, oneWay); baked(deg)._resolveSphere(b, 0.35, ob, Infinity, oneWay);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9, `rolled ${deg}, from ${c0}: where the baked deck leaves it (${a} vs ${b})`);
    assert.deepEqual([!!oa.grounded, !!oa.hitCeiling, !!oa.pushedDown], [!!ob.grounded, !!ob.hitCeiling, !!ob.pushedDown], `rolled ${deg}, from ${c0}: the same contact`);
    if (oa.grounded) assert.ok(Math.abs(oa.groundY - ob.groundY) < 1e-9);
  }
  // a sphere over the middle of the deck, just touching
  const at30 = rolled(30), out30 = {};
  const c30 = [0, 0.34, 0];
  at30._resolveSphere(c30, 0.35, out30);
  assert.equal(out30.grounded, true, 'rolled 30: ground (cos 30 over the slope limit\'s)');
  const at80 = rolled(80), out80 = {};
  const c80 = [0.33, 0.05, 0];
  at80._resolveSphere(c80, 0.35, out80);
  assert.ok(!out80.grounded, 'rolled 80: a wall');
  assert.ok(c80[0] > 0.33, 'pushed off it, sideways');
  // the one-way floor: a lower sphere sunk under the deck is set ON it where it is a floor, never where it is a wall
  const sunk30 = [0, -0.1, 0], o30 = {};
  at30._resolveSphere(sunk30, 0.35, o30, Infinity, true);
  assert.ok(sunk30[1] > 0.2 && o30.grounded, `set on the floor it sank under (${sunk30[1]})`);
  const sunk80 = [-0.05, -0.1, 0], o80 = {};
  at80._resolveSphere(sunk80, 0.35, o80, Infinity, true);
  assert.ok(!o80.grounded, 'a wall is never a floor, turned or not');
  // the ray: its face as it stands, turned to meet the ray
  const h = at30.raycastHit([0, 5, 0], [0, -1, 0], 20);
  assert.ok(Math.abs(h.dist - 5) < 1e-9);
  assert.ok(Math.abs(h.normal[0] - -Math.sin(Math.PI / 6)) < 1e-9 && Math.abs(h.normal[1] - Math.cos(Math.PI / 6)) < 1e-9, `the face rolled 30, toward the ray (${h.normal})`);
});

// ── a tree's colliders: the index, bounds first ─────────────────────────────────────────────────────────────────

/** The walk raycastColliders replaced (its pre-audit body): every collider, its object's matrix, every triangle. */
function bruteRaycast(root, origin, dir, maxDistance, { triggers = true, geometry }) {
  const cols = [];
  const stack = [root];
  while (stack.length) { const n = stack.pop(); if (!n.activeSelf) continue; for (const c of n.components) if ((c.type === 'BoxCollider' || c.type === 'MeshCollider') && c.m_Enabled !== false) cols.push({ node: n, collider: c }); for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]); }
  let best = null;
  for (const { node, collider } of cols) {
    if (collider.m_IsTrigger && !triggers) continue;
    const inv = invertAffine(node.worldMatrix());
    if (!inv) continue;
    const o = [inv[0] * origin[0] + inv[4] * origin[1] + inv[8] * origin[2] + inv[12], inv[1] * origin[0] + inv[5] * origin[1] + inv[9] * origin[2] + inv[13], inv[2] * origin[0] + inv[6] * origin[1] + inv[10] * origin[2] + inv[14]];
    const d = [inv[0] * dir[0] + inv[4] * dir[1] + inv[8] * dir[2], inv[1] * dir[0] + inv[5] * dir[1] + inv[9] * dir[2], inv[2] * dir[0] + inv[6] * dir[1] + inv[10] * dir[2]];
    let t = null;
    if (collider.type === 'BoxCollider') { const c = collider.m_Center ?? { x: 0, y: 0, z: 0 }, s = collider.m_Size ?? { x: 1, y: 1, z: 1 }; const hx = Math.abs(s.x) / 2, hy = Math.abs(s.y) / 2, hz = Math.abs(s.z) / 2; t = rayBoxEntry(o, d, [c.x - hx, c.y - hy, c.z - hz], [c.x + hx, c.y + hy, c.z + hz]); }
    else { const g = geometry(collider, node); if (!g) continue; if (collider.m_Convex) { const h = hullOf(g); t = h ? rayConvexEntry(o, d, h) : null; } else t = rayMeshEntry(o, d, g); }
    if (t != null && t <= maxDistance && (!best || t < best.distance)) best = { distance: t, node, collider };
  }
  return best;
}

test('AUDIT NAV1 (#12) A SHIP\'S RAY, BOUNDS FIRST: every hull asked a thousand rays about her - near and far, long and short, triggers taken or not, as her swell turns, her root turns and moves, a sail comes and goes between them - answers the walk it replaced to the bit (the same distance, the same object, the same collider), and so does a box a scaled and mirrored chain carries out; a ray that passes her by walks none of her triangles (mutants: a link\'s length or scale dropped from the reach, the reach test turned, the box before the triangles skipped wrong, a trigger\'s answer lost)', async () => {
  const { pool } = await recordingPool();
  const geometry = (c) => (c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : null);
  const rnd = seeded(11);
  let rays = 0, hits = 0;
  for (const hullId of [1, 2, 3, 4]) {
    const boat = pool.spawnSeaNow(new Boat(hullId, 0));
    boat.GameObject.position = [300, 0, -200];
    const mo = boat.MeshObject;
    for (let i = 0; i < 1000; i++) {
      if (i % 7 === 0) { const a = (rnd() - 0.5) * 0.4; mo.localRotation = [Math.sin(a / 2), 0, 0, Math.cos(a / 2)]; }
      if (i % 13 === 0) { const y = rnd() * 6.28; boat.GameObject.rotation = [0, Math.sin(y / 2), 0, Math.cos(y / 2)]; boat.GameObject.position = [300 + rnd() * 5, rnd(), -200 + rnd() * 5]; }
      if (i % 101 === 0 && boat.Sails?.length) { const s = boat.Sails[Math.floor(rnd() * boat.Sails.length)]; s.setActive(!s.activeSelf); }
      const p = boat.GameObject.position;
      const near = i % 2 === 0;
      const o = near ? [p[0] + (rnd() - 0.5) * 30, p[1] + 5 + rnd() * 20, p[2] + (rnd() - 0.5) * 30] : [p[0] + (rnd() - 0.5) * 160, p[1] + (rnd() - 0.3) * 60, p[2] + (rnd() - 0.5) * 160];
      let d = near ? [(rnd() - 0.5) * 0.4, -1, (rnd() - 0.5) * 0.4] : [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
      const l = Math.hypot(...d); d = d.map((x) => x / l);
      const reach = rnd() < 0.5 ? 60 : rnd() * 8, triggers = rnd() < 0.5;
      const a = raycastColliders(boat.GameObject, o, d, reach, { triggers, geometry }), b = bruteRaycast(boat.GameObject, o, d, reach, { triggers, geometry });
      rays++;
      assert.equal(!!a, !!b, `hull ${hullId} ray ${i}: met alike`);
      if (b) { hits++; assert.ok(a.distance === b.distance && a.node === b.node && a.collider === b.collider, `hull ${hullId} ray ${i}: the same hit to the bit`); }
    }
    pool.remove(boat);
  }
  assert.ok(hits > 400, `rays met the hulls (${hits} of ${rays})`);
  // a link that stretches what hangs below it (a hull's trigger boxes under one stand up to 1.4 m past what the links'
  // lengths alone reach, a band the rays above seldom cross): a boom scaled 4 and a yard on it scaled 2 and mirrored
  // carry a box 16 m off their root - met where it stands, and every ray about it as the walk meets it, the boom turning
  const rig = new PrefabNode('rig', { position: [50, 0, 0] });
  const boomNode = new PrefabNode('boom', { scale: [4, 4, 4] }).setParent(rig);
  const yard = new PrefabNode('yard', { position: [1, 0, 0], scale: [1, -2, 1], components: [{ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: false, m_Center: { x: 3, y: 0, z: 0 }, m_Size: { x: 1, y: 1, z: 1 } }] }).setParent(boomNode);
  const out = raycastColliders(rig, [66, 20, 0], [0, -1, 0], 30, { geometry });
  assert.ok(out && Math.abs(out.distance - 16) < 1e-9 && out.node === yard, `the box a stretching chain carries 16 m out: met on its lid (${out?.distance})`);
  let rigHits = 0;
  for (let i = 0; i < 400; i++) {
    if (i % 5 === 0) { const a = rnd() * 6.28, b = (rnd() - 0.5) * 1.2; boomNode.localRotation = quatMultiply([0, Math.sin(a / 2), 0, Math.cos(a / 2)], [0, 0, Math.sin(b / 2), Math.cos(b / 2)]); }
    const wm = yard.worldMatrix(), c = [wm[0] * 3 + wm[12], wm[1] * 3 + wm[13], wm[2] * 3 + wm[14]];
    const o = [50 + (rnd() - 0.5) * 80, (rnd() - 0.5) * 40, (rnd() - 0.5) * 80];
    let d = [c[0] + (rnd() - 0.5) * 8 - o[0], c[1] + (rnd() - 0.5) * 12 - o[1], c[2] + (rnd() - 0.5) * 8 - o[2]];
    const l = Math.hypot(...d); d = d.map((x) => x / l);
    const a = raycastColliders(rig, o, d, 90, { geometry }), b = bruteRaycast(rig, o, d, 90, { geometry });
    assert.equal(!!a, !!b, `rig ray ${i}: met alike`);
    if (b) { rigHits++; assert.ok(a.distance === b.distance && a.node === b.node, `rig ray ${i}: the same hit to the bit`); }
  }
  assert.ok(rigHits > 100, `rays met the stretched box (${rigHits})`);
  // a ray well off her walks none of her triangles; one down her deck walks some
  const boat = pool.spawnSeaNow(new Boat(3, 0));
  boat.GameObject.position = [0, 0, 0];
  let reads = 0;
  const counted = new WeakMap();
  const countingGeometry = (c) => {
    const g = geometry(c);
    if (!g) return null;
    let w = counted.get(g);
    if (!w) { w = { positions: g.positions, indices: new Proxy(g.indices, { get: (t, k) => { if (typeof k === 'string' && /^\d+$/.test(k)) reads++; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } }) }; counted.set(g, w); }
    return w;
  };
  raycastColliders(boat.GameObject, [200, 10, 0], [0, -1, 0], 5, { geometry: countingGeometry });
  reads = 0;
  assert.equal(raycastColliders(boat.GameObject, [200, 10, 0], [0, -1, 0], 5, { geometry: countingGeometry }), null);
  assert.equal(reads, 0, 'a ray 200 m off her: not a triangle asked');
  const deckHit = raycastColliders(boat.GameObject, [0, 30, 0], [0, -1, 0], 60, { geometry: countingGeometry });
  assert.ok(deckHit && reads > 0, 'a ray down her deck asks hers');
  pool.remove(boat);
});

test('AUDIT NAV1 (#12) A MESH\'S TRIANGLES FILED BY WHERE THEY STAND: rayMeshEntryWithin answers rayMeshEntry\'s nearest parameter to the bit wherever it lies within the limit, and nothing past it - rays down, across, up from under, from inside her box and from far off, exactly along an axis, cut short or long (mutants: the wide triangles unasked, a cell\'s clamp, the walk\'s stop)', async () => {
  const { pool } = await recordingPool();
  const boat = pool.spawnSeaNow(new Boat(4, 0));
  const hull = collidersOf(boat.GameObject).find((c) => c.collider.type === 'MeshCollider' && !c.collider.m_IsTrigger && pool.models.geometry(c.collider.m_Mesh.mesh));
  const g = pool.models.geometry(hull.collider.m_Mesh.mesh);
  assert.ok(g.indices.length / 3 > 1000, 'a hull of a thousand triangles and more');
  const rnd = seeded(3);
  let met = 0;
  const axes = [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (let i = 0; i < 1500; i++) {
    const o = i % 3 === 0 ? [(rnd() - 0.5) * 20, (rnd() - 0.3) * 30, (rnd() - 0.5) * 60] : [(rnd() - 0.5) * 200, (rnd() - 0.5) * 80, (rnd() - 0.5) * 200];
    let d = i % 5 === 0 ? axes[i % 6] : [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const l = Math.hypot(...d); d = d.map((x) => x / l);
    const limit = i % 4 === 0 ? rnd() * 10 : 500;
    const t = rayMeshEntry(o, d, g);
    const want = t != null && t <= limit ? t : null;
    const got = rayMeshEntryWithin(o, d, g, limit);
    assert.equal(got, want, `ray ${i}: ${got} vs ${want}`);
    if (want != null) met++;
  }
  assert.ok(met > 100, `rays met her (${met})`);
  pool.remove(boat);
});

test('AUDIT NAV1 (#12) THE INDEX FOLLOWS THE TREE\'S SHAPE: the stamp moves when a node is hung elsewhere or given a component, never on a switch or a move; what is on is read live - a collider switched off, an object hidden above it - and the colliders after a reshape are the walk\'s own (mutants: setParent or addComponent unstamped, the index kept past a stamp) - BOAT-STAMP: each tree its own stamp, another tree\'s build, reshape or component leaving it, a node hung across moving both (mutants: the tree left or the tree joined unstamped, the node stamped and not its top, a count per tree)', () => {
  const box = (y) => ({ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: false, m_Center: { x: 0, y, z: 0 }, m_Size: { x: 1, y: 1, z: 1 } });
  const root = new PrefabNode('root');
  const a = new PrefabNode('a', { components: [box(0)] }).setParent(root);
  const b = new PrefabNode('b').setParent(root);
  const c = new PrefabNode('c', { components: [box(1)] }).setParent(b);
  const names = () => collidersOf(root).map((x) => x.node.name);
  assert.deepEqual(names(), ['a', 'c']);
  // BOAT-STAMP (2026-10-21): the stamp is the tree's own - read off any node of it, its top node's
  let s = prefabShapeStamp(root);
  b.setActive(false); a.localPosition = [5, 0, 0];
  assert.equal(prefabShapeStamp(root), s, 'a switch and a move leave the shape');
  assert.deepEqual(names(), ['a'], 'hidden above it: gone at once');
  b.setActive(true); a.components[0].m_Enabled = false;
  assert.deepEqual(names(), ['c'], 'switched off: gone at once');
  a.components[0].m_Enabled = true;
  const d = new PrefabNode('d', { components: [box(2)] });
  s = prefabShapeStamp(root);
  d.setParent(c);
  assert.ok(prefabShapeStamp(root) > s, 'hung under another: the shape moved');
  assert.deepEqual(names(), ['a', 'c', 'd']);
  s = prefabShapeStamp(root);
  b.addComponent(box(3));
  assert.ok(prefabShapeStamp(root) > s, 'a component more: the shape moved');
  assert.deepEqual(names(), ['a', 'b', 'c', 'd']);
  assert.equal(prefabShapeStamp(d), prefabShapeStamp(root), 'any node of the tree reads its top node\'s stamp');
  // BOAT-STAMP: ANOTHER TREE'S CHANGES ARE NOT THIS ONE'S - a tree built, reshaped and given a component elsewhere (a
  // boat streaming in, a fitting stood on another deck) leaves this tree's stamp, and its index, as they were
  s = prefabShapeStamp(root);
  const other = new PrefabNode('other');
  new PrefabNode('o1', { components: [box(4)] }).setParent(other);
  other.addComponent(box(5));
  new PrefabNode('o2').setParent(other).setParent(null);
  assert.equal(prefabShapeStamp(root), s, 'another tree built, given a component, a node taken out of it: this one\'s shape stands');
  // a node hung from this tree into the other moves both - the tree it left and the tree it joined
  const so = prefabShapeStamp(other);
  d.setParent(other);
  assert.ok(prefabShapeStamp(root) > s, 'the tree it left: its shape moved');
  assert.ok(prefabShapeStamp(other) > so, 'the tree it joined: its shape moved');
  assert.deepEqual(names(), ['a', 'b', 'c'], 'gone from this tree\'s index with it');
  assert.deepEqual(collidersOf(other).map((x) => x.node.name), ['other', 'o1', 'd'], 'and in the other\'s');
  // a node whose top node changes reads a stamp it never read: every stamp is a draw of one count, so a tree new to it
  // never happens to hold the value its old one had (a count per tree would: p bumped twice as x joined it, q once by
  // its component, and once more as x joins it - two, the value x read under p)
  const p = new PrefabNode('p'), x = new PrefabNode('x').setParent(p);
  const read = prefabShapeStamp(x);
  const q = new PrefabNode('q');
  q.addComponent(box(6));
  x.setParent(q);
  assert.notEqual(prefabShapeStamp(x), read, 'hung under a tree new to it: a stamp it never read');
  x.setParent(null);
  assert.ok(prefabShapeStamp(x) !== read && prefabShapeStamp(x) !== prefabShapeStamp(p), 'standing alone: its own, again new');
  // and its poses: each object's own matrix
  for (const { node, world } of colliderPoses(root)) assert.deepEqual([...world], [...node.worldMatrix()]);
});

test('AUDIT NAV1 (#11/#12) A NODE\'S MATRIX AND ROTATION KEPT WHILE THEY READ THE SAME: the same product as made afresh, to the bit, after its own or a parent\'s position, rotation or scale changed - an array written in place too - or it was hung elsewhere; the same object while nothing moved, a new one after (one handed out stays as it was); its rotation a copy no reader can write into what is kept (mutants: a value unread, the parent\'s matrix or the parent unchecked, the kept rotation handed out)', () => {
  const fresh = (n) => { const l = mat4FromQuatPosScale(n.localRotation, n.localPosition, n.localScale); return n.parent ? multiply(fresh(n.parent), l) : l; };
  const freshRot = (n) => (n.parent ? quatMultiply(freshRot(n.parent), n.localRotation) : [...n.localRotation]);
  const q = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
  const root = new PrefabNode('root', { position: [10, 0, 0], rotation: q(0.3), scale: [1, 2, 1] });
  const mid = new PrefabNode('mid', { position: [0, 1, 0], rotation: q(-0.4) }).setParent(root);
  const leaf = new PrefabNode('leaf', { position: [0, 0, 3], scale: [0.5, 0.5, 0.5] }).setParent(mid);
  const same = (n) => { assert.deepEqual([...n.worldMatrix()], [...fresh(n)]); assert.deepEqual(n.rotation, freshRot(n)); };
  same(leaf);
  const kept = leaf.worldMatrix();
  assert.equal(leaf.worldMatrix(), kept, 'nothing moved: the same matrix');
  const edits = [
    () => { root.localPosition = [11, 0, 0]; }, () => { mid.localRotation = q(0.2); }, () => { leaf.localScale = [1, 1, 1]; },
    () => { root.localScale[1] = 3; }, () => { mid.localPosition[2] = 4; }, () => { leaf.localRotation[1] = Math.sin(0.1); leaf.localRotation[3] = Math.cos(0.1); },
    () => { leaf.setParent(root); }, () => { leaf.setParent(mid); },
  ];
  for (const edit of edits) {
    const before = leaf.worldMatrix(), copy = [...before];
    edit();
    same(leaf); same(mid);
    assert.notEqual(leaf.worldMatrix(), before, 'moved: a new matrix');
    assert.deepEqual([...before], copy, 'the one handed out stays as it was');
  }
  const r = leaf.rotation;
  r[0] = 99;
  assert.notEqual(leaf.rotation[0], 99, 'a copy: the kept rotation untouched');
});

// ── the world's sync: carried, never baked again ────────────────────────────────────────────────────────────────

/** world.js's own sync, lifted: csaSyncColliders over a stand-in scene (a real Collider, the boats given). */
function liftedSync(scope) {
  const body = `
    let { colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider, csaAboard, csaColliderBoats, csaColliderMesh, _csaBoatIds, _csaBoatSerial, csa, modes } = s;
    ${cutLine(WORLD, '  const _csaBuckets = new Map();')}${cutLine(WORLD, '  const csaBoatId = (boat) =>')}
    ${cut(WORLD, '  const csaShapeOf = (c) =>', ');\n')}${cutLine(WORLD, '  const CSA_RIGID_EPS =')}${cut(WORLD, '  function csaCarry(b, m) {')}
    ${cut(WORLD, '  function csaSyncColliders() {')}
    return { sync: csaSyncColliders, buckets: _csaBuckets, box: boxColliderTriangles };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)(scope);
}

test('AUDIT NAV1 (#12) THE WORLD\'S SYNC CARRIES A BOAT\'S BUCKETS: three ships sailing, turning and rolling on the swell for a hundred frames are baked once - no triangle baked again - and her buckets answer as a fresh bake where she stands; a way with no turn walks the plain bucket\'s path; a box resized, another mesh, a scale changed, the mode\'s collider changed: baked again, and answering as they stand; the sea\'s ships stand in the collider after the sea\'s own frame (mutants: the motion\'s rigidity unasked, the shape unasked, a still bucket turned by nothing, the second sync unwired)', async () => {
  const { pool } = await recordingPool();
  const ships = [[4, [60, 0, 20]], [3, [-80, 0, 40]], [2, [10, 0, -90]]].map(([h, p]) => { const b = pool.spawnSeaNow(new Boat(h, 0)); b.GameObject.position = p; return b; });
  // a crate's box on the galley's deck (no hull ships a solid box of its own): a box among her buckets
  const crate = new PrefabNode('Crate', { position: [0, 10.25, 0], components: [{ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: false, m_Center: { x: 0, y: 0.5, z: 0 }, m_Size: { x: 1, y: 1, z: 1 } }] }).setParent(ships[1].MeshObject);
  let adds = 0;
  class Counting extends Collider { addMesh(k, p, ix, m, t, r) { adds++; return super.addMesh(k, p, ix, m, t, r); } }
  let col = new Counting();
  const geometry = (c) => (c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : null);
  const scope = { colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider: () => col, csaAboard: { aboard: null }, csaColliderBoats: () => ships, csaColliderMesh: geometry, _csaBoatIds: new WeakMap(), _csaBoatSerial: 0, csa: { peerBoats: [] }, modes: { mode: 'exterior' } };   // FIELD BUGS 2026-10-01b: the sync stands the peers' boats on the street too - none here
  const w = liftedSync(scope);
  /** Rays down on each of `boats` meet the mode's collider as a fresh bake of every ship where she stands. */
  const asFresh = (boats, what) => {
    const fresh = new Collider();
    for (const b of ships) {
      let i = 0;
      for (const { collider: c, world } of colliderPoses(b.GameObject)) { if (c.m_IsTrigger) continue; const tri = c.type === 'BoxCollider' ? w.box(c) : geometry(c); if (tri) fresh.addMesh(`${b.GameObject.name}:${i}:${Math.random()}`, tri.positions, tri.indices, world); i++; }
    }
    let met = 0;
    for (const b of boats) {
      const p = b.GameObject.position;
      for (let k = 0; k < 150; k++) {
        const o = [p[0] + (k % 15) - 7, p[1] + 30, p[2] + Math.floor(k / 15) * 2 - 10];
        const a = col.raycastHit(o, [0, -1, 0], 60).dist, f = fresh.raycastHit(o, [0, -1, 0], 60).dist;
        assert.equal(Number.isFinite(a), Number.isFinite(f), `${what}: met alike`);
        if (Number.isFinite(a)) { met++; assert.ok(Math.abs(a - f) < 2e-3, `${what}: where she stands (${a} vs ${f})`); }
      }
    }
    return met;
  };
  w.sync();
  const first = adds;
  assert.equal(first, w.buckets.size, 'each bucket baked once at first');
  assert.ok([...w.buckets.values()].some((b) => b.c === crate.components[0]), 'the crate\'s box among them');
  const q = (a, r = 0) => [Math.sin(r / 2) * Math.cos(a / 2), Math.sin(a / 2) * Math.cos(r / 2), 0, Math.cos(a / 2) * Math.cos(r / 2)];
  for (let f = 0; f < 100; f++) {
    ships.forEach((b, i) => {
      const p = b.GameObject.position;
      b.GameObject.position = [p[0] + 0.1 * Math.cos(i + f / 30), p[1], p[2] + 0.1 * Math.sin(i + f / 30)];
      b.GameObject.rotation = q(i + f / 60);
      if (b.MeshObject) b.MeshObject.localRotation = q(0, 0.03 * Math.sin(f / 9 + i));
    });
    w.sync();
  }
  assert.equal(adds, first, 'a hundred frames of motion: no triangle baked again');
  const met = asFresh(ships, 'carried');
  assert.ok(met > 100, `rays down on the decks (${met})`);
  // a way with no turn: a ship baked where she lies, then moved - carried on the plain path (no R), the way her T
  const skiff = pool.spawnSeaNow(new Boat(1, 0));
  skiff.GameObject.position = [-20, 0, -30];
  ships.push(skiff);
  w.sync();
  const hers = [...w.buckets.values()].filter((b) => b.boat === skiff);
  assert.ok(hers.length > 0, 'the skiff baked');
  const n0 = adds;
  skiff.GameObject.position = [-17, 0.5, -32];
  w.sync();
  assert.equal(adds, n0, 'a way: carried, not baked');
  for (const b of hers) {
    assert.equal(b.R, null, 'no turn: the plain bucket\'s path');
    assert.ok(Math.hypot(b.T[0] - 3, b.T[1] - 0.5, b.T[2] + 2) < 1e-4, `the way carried (${[...b.T]})`);
  }
  assert.ok(asFresh([skiff], 'a way') > 10, 'rays down on her deck');
  // a box resized: baked again - its lid where the new size stands, where the old never reached
  const crateBox = crate.components[0];
  const lid = (x) => { const m = crate.worldMatrix(); return [m[0] * x + m[4] + m[12], m[1] * x + m[5] + m[13], m[2] * x + m[6] + m[14]]; };
  const over = (p) => col.raycastHit([p[0], p[1] + 20, p[2]], [0, -1, 0], 60).dist;
  assert.ok(Math.abs(over(lid(0)) - 20) < 1e-3, `the crate's lid met (${over(lid(0))})`);
  assert.ok(over(lid(1.2)) > 20.5, 'beside the crate: her deck, further down');
  const n1 = adds;
  crateBox.m_Size = { x: 3, y: 1, z: 1 };
  w.sync();
  assert.equal(adds, n1 + 1, 'a box resized: its bucket baked again');
  assert.ok(Math.abs(over(lid(1.2)) - 20) < 1e-3, `the lid as long as it stands now (${over(lid(1.2))})`);
  asFresh([ships[1]], 'a box resized');
  // another mesh: baked again, and answering as it
  const meshes = colliderPoses(ships[0].GameObject).filter((x) => x.collider.type === 'MeshCollider' && !x.collider.m_IsTrigger && geometry(x.collider));
  const mA = meshes[0].collider, mB = meshes.find((x) => geometry(x.collider).positions !== geometry(mA).positions).collider;
  const was = mA.m_Mesh;
  const n2 = adds;
  mA.m_Mesh = mB.m_Mesh;
  w.sync();
  assert.equal(adds, n2 + 1, 'another mesh: its bucket baked again');
  asFresh([ships[0]], 'another mesh');
  mA.m_Mesh = was;
  w.sync();
  assert.equal(adds, n2 + 2, 'and its own again');
  // a scale changed: baked again
  const n3 = adds;
  const mo = ships[0].MeshObject;
  mo.localScale = [1.1, 1, 1];
  w.sync();
  assert.ok(adds > n3, 'a scale changed (no rigid motion carries it): baked again');
  mo.localScale = [1, 1, 1];
  w.sync();
  // the mode's collider changed: into the new one, gone from the old
  const old = col;
  col = new Counting();
  const n4 = adds;
  w.sync();
  assert.equal(adds - n4, w.buckets.size, 'every bucket baked into the new collider');
  assert.equal(old._buckets.size, 0, 'and none left in the old one');
  // the second sync: after the sea's frame poses her ships
  const naval = cut(WORLD, '  function navalFrame(dt) {');
  assert.match(naval, /naval\.frame\(dt \* worldTimeScale\(\)[^\n]*\n(\s*\/\/[^\n]*\n)+\s*if \(naval\.collidable\(\)\.length\) csaSyncColliders\(\);/);
  for (const b of ships) pool.remove(b);
});

test('AUDIT NAV1 (#12) CSACARRY: a bucket\'s motion since its bake - a turn and a translation carried, a pure translation on the plain path (no turn), the same matrix nothing at all; a scale or a mirror is no rigid motion and is baked again (mutants: the lengths or the angles unasked, the mirror let through, a pure way turned)', () => {
  const body = `${cutLine(WORLD, '  const CSA_RIGID_EPS =')}${cut(WORLD, '  function csaCarry(b, m) {')} return csaCarry;`;
  // eslint-disable-next-line no-new-func
  const carry = new Function(body)();
  const bake = (m) => ({ m: Float64Array.from(m), inv: invertAffine(m), R: null, Rs: new Float64Array(9), T: [0, 0, 0] });
  const M = multiply(trans(10, 2, 3), rotY(0.4));
  const b = bake(M);
  assert.equal(carry(b, M), true); assert.equal(b.R, null); assert.deepEqual(b.T, [0, 0, 0]);
  assert.equal(carry(b, multiply(trans(5, 0, -1), M)), true);
  assert.equal(b.R, null, 'a pure way: no turn');
  assert.ok(Math.hypot(b.T[0] - 5, b.T[1], b.T[2] + 1) < 1e-9);
  const turned = multiply(multiply(trans(1, 0, 0), rotY(0.7)), M);
  assert.equal(carry(b, turned), true);
  assert.ok(b.R, 'a turn');
  const want = multiply(turned, invertAffine(M));
  for (let i = 0; i < 9; i++) assert.ok(Math.abs(b.R[i] - turnOf(want)[i]) < 1e-9);
  assert.equal(carry(b, multiply(M, [1.2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])), false, 'a stretch: baked again');
  assert.equal(carry(b, multiply(M, [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])), false, 'a mirror: baked again');
  assert.equal(carry(b, multiply(M, [1, 0.05, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])), false, 'a shear: baked again');
});

// ── the boats drawn: culled, and their still parts as one ──────────────────────────────────────────────────────

const view = (eye, at, extra = {}) => ({ _proj: perspective(Math.PI / 3, 16 / 9, 0.2, 6000), _view: lookAt(eye, at, [0, 1, 0]), _camPos: eye, gl: { drawingBufferHeight: 1080 }, ...extra });

test('AUDIT NAV1 (#13) THE BOATS CULLED AS THE WORLD\'S MESHES ARE: a ship astern draws nothing; one ahead draws; a mesh off screen that would cast into the shadow maps is recorded for them and never drawn (SHADOW-REACH); a mesh under a pixel across is not drawn, her hull at any range she sails is (mutants: the frustum unasked, the shadow record dropped, the pixel\'s test turned)', async () => {
  const { pool, renderer, log } = await recordingPool();
  const eye = [0, 6, 0];
  Object.assign(renderer, view(eye, [0, 6, -100]));
  const ahead = pool.spawnSeaNow(new Boat(4, 0)); ahead.GameObject.position = [0, 0, -80];
  const astern = pool.spawnSeaNow(new Boat(4, 0)); astern.GameObject.position = [0, 0, 80];
  await loaded(pool);
  const walkOf = (b) => pool.walkOf(b).mats;
  log.drawn.length = 0; log.cast.length = 0;
  pool.draw();
  const drawnOf = (b) => log.drawn.filter((d) => walkOf(b).includes(d.matrix)).length;
  assert.ok(drawnOf(ahead) > 0, 'ahead: drawn');
  assert.equal(drawnOf(astern), 0, 'astern: nothing drawn');
  assert.equal(log.cast.length, 0, 'no shadow reached: nothing recorded');
  renderer.shadowReach = () => true;
  log.drawn.length = 0; log.cast.length = 0;
  pool.draw();
  assert.equal(drawnOf(astern), 0, 'astern, casting: still never drawn');
  assert.ok(log.cast.filter((d) => walkOf(astern).includes(d.matrix)).length > 0, 'but recorded for the shadow maps');
  renderer.shadowReach = () => false;
  // far down the look: her small meshes under a pixel, her hull still drawn
  ahead.GameObject.position = [0, 0, -1900];
  pool.frame?.(0, { cityLightsOn: false, playerPosition: eye });
  log.drawn.length = 0;
  pool.draw();
  const far = log.drawn.filter((d) => walkOf(ahead).includes(d.matrix) || pool.stillOf(ahead)?.mesh === d.mesh);
  assert.ok(far.length > 0, 'her hull drawn at 1.9 km');
  const every = { ...renderer, _proj: null };
  const all = []; const keep = log.drawn; log.drawn = all;
  pool.draw(every);
  log.drawn = keep;
  assert.ok(far.length < all.filter((d) => walkOf(ahead).includes(d.matrix) || pool.stillOf(ahead)?.mesh === d.mesh).length, 'fewer than every mesh: the ones under a pixel left');
  pool.remove(ahead); pool.remove(astern);
});

test('AUDIT NAV1 (#13) A BOAT\'S STILL PARTS AS ONE MESH: a war galley\'s parts still in her hull\'s frame STILL_FRAMES frames running are merged into one mesh drawn once at her hull\'s matrix - her 107 oars among them - its triangles theirs where they stand; a part that moves leaves it that frame and is drawn on its own, and joins again once still; a part switched off, and the batch is made again - her hull\'s own renderer too, the batch drawn at her hull\'s matrix still; the batch goes with her (mutants: merged before they were still, a moving part kept in, its triangles in the wrong frame, the batch drawn at the part\'s matrix, the batch left behind)', async () => {
  const { pool, log } = await recordingPool();
  const galley = pool.spawnSeaNow(new Boat(3, 0));
  galley.GameObject.position = [0, 0, -60];
  await loaded(pool);
  log.drawn.length = 0;
  pool.draw();
  assert.equal(pool.stillOf(galley), null, 'not merged before her parts have been still');
  for (let f = 0; f < STILL_FRAMES + 1; f++) pool.draw();
  const st = pool.stillOf(galley);
  assert.ok(st && st.nodes.size >= 107, `her still parts merged (${st?.nodes.size})`);
  const hullAt = pool.walkOf(galley).mats[pool.walkOf(galley).nodes.indexOf(galley.MeshObject)];
  log.drawn.length = 0;
  pool.draw();
  assert.deepEqual(log.drawn.filter((d) => d.mesh === st.mesh).map((d) => d.matrix), [hullAt], 'drawn once, at her hull\'s matrix');
  const walk = pool.walkOf(galley);
  for (const n of st.nodes) assert.ok(!log.drawn.some((d) => d.mesh !== st.mesh && d.matrix === walk.mats[walk.nodes.indexOf(n)]), `${n.name}: never drawn twice`);
  // its triangles: every part's, carried by her hull's matrix where each stands
  const merged = st.mesh.model;
  const oar = [...st.nodes].find((n) => n.name.startsWith("T'avaTriremeOar"));
  const oarWorld = walk.mats[walk.nodes.indexOf(oar)];
  const mf = oar.getComponent('MeshFilter');
  const og = pool.models.geometry(mf.m_Mesh.mesh);
  const at = (m, p, k) => [m[0] * p[k] + m[4] * p[k + 1] + m[8] * p[k + 2] + m[12], m[1] * p[k] + m[5] * p[k + 1] + m[9] * p[k + 2] + m[13], m[2] * p[k] + m[6] * p[k + 1] + m[10] * p[k + 2] + m[14]];
  const want = at(oarWorld, og.positions, 0);
  let nearest = Infinity;
  for (let k = 0; k < merged.positions.length; k += 3) { const q = at(hullAt, merged.positions, k); nearest = Math.min(nearest, Math.hypot(q[0] - want[0], q[1] - want[1], q[2] - want[2])); }
  assert.ok(nearest < 1e-3, `an oar's corner where the oar stands (${nearest})`);
  // a part that moves: out that frame, drawn on its own, in again once still
  oar.localRotation = [Math.sin(0.1), 0, 0, Math.cos(0.1)];
  log.drawn.length = 0;
  pool.draw();
  const oarAt = pool.walkOf(galley).mats[pool.walkOf(galley).nodes.indexOf(oar)];
  assert.ok(!pool.stillOf(galley).nodes.has(oar), 'moved: out of the batch');
  assert.ok(log.drawn.some((d) => d.matrix === oarAt), 'and drawn on its own');
  for (let f = 0; f < STILL_FRAMES + 1; f++) pool.draw();
  assert.ok(pool.stillOf(galley).nodes.has(oar), 'still again: in again');
  // switched off: made again without it
  const before = pool.stillOf(galley).mesh;
  oar.setActive(false);
  pool.draw();
  assert.notEqual(pool.stillOf(galley)?.mesh, before, 'made again');
  assert.ok(log.destroyed.includes(before), 'the old one let go');
  assert.ok(!pool.stillOf(galley).nodes.has(oar));
  // her hull's own renderer off: the batch her parts' alone, the first of them standing off her hull's frame - and
  // drawn at her hull's matrix still, the frame its triangles were laid in, never at a part's
  const hullMr = galley.MeshObject.getComponent('MeshRenderer');
  hullMr.m_Enabled = false;
  log.drawn.length = 0;
  pool.draw();
  const bare = pool.stillOf(galley);
  assert.ok(bare && !bare.nodes.has(galley.MeshObject), 'made again without her hull');
  const walk2 = pool.walkOf(galley);
  const hullNow = walk2.mats[walk2.nodes.indexOf(galley.MeshObject)];
  const firstAt = walk2.mats[walk2.nodes.findIndex((n) => bare.nodes.has(n))];
  assert.notDeepEqual([...firstAt], [...hullNow], 'her first part stands off her hull\'s frame');
  assert.deepEqual(log.drawn.filter((d) => d.mesh === bare.mesh).map((d) => [...d.matrix]), [[...hullNow]], 'drawn once, at her hull\'s matrix');
  hullMr.m_Enabled = true;
  pool.draw();
  assert.ok(pool.stillOf(galley).nodes.has(galley.MeshObject), 'her hull in again');
  const last = pool.stillOf(galley).mesh;
  pool.remove(galley);
  assert.ok(log.destroyed.includes(last), 'the batch goes with her');
  assert.ok(STILL_MIN >= 2);
});

// ── the effects: one sheet, and what goes first ─────────────────────────────────────────────────────────────────

function namedGl() {
  const calls = [];
  let id = 0;
  const gl = new Proxy({}, {
    get: (t, k) => {
      if (k === 'getUniformLocation') return (p, n) => n;
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader') return () => { const o = { id: ++id, kind: k }; calls.push([k, o]); return o; };
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls };
}

test('AUDIT NAV1 (#13) THE EFFECTS ON ONE SHEET: the four particle pictures stand in cells of their own on one sheet, a clear texel round each, every picture\'s texels as it was made; each quad wears its picture\'s cell; a frame at the particle budget with the aim laid is three draws and two binds - the blended one, the added sheet and the arcs\' line (mutants: no gutter, a picture in another\'s cell, a quad\'s cell, the runs unmerged)', () => {
  const sheet = navalSheetTexture();
  assert.deepEqual([sheet.width, sheet.height], [NAVAL_SHEET_SIZE, NAVAL_SHEET_SIZE]);
  assert.equal(NAVAL_SHEET_SIZE, 2 * (NAVAL_TEX_SIZE + 2 * NAVAL_SHEET_GUTTER));
  for (const [name, [col, row]] of Object.entries(NAVAL_SHEET)) {
    const pic = NAVAL_TEXTURES[name]();
    const x0 = col * (NAVAL_TEX_SIZE + 2 * NAVAL_SHEET_GUTTER) + NAVAL_SHEET_GUTTER, y0 = row * (NAVAL_TEX_SIZE + 2 * NAVAL_SHEET_GUTTER) + NAVAL_SHEET_GUTTER;
    for (let y = 0; y < NAVAL_TEX_SIZE; y += 7) for (let x = 0; x < NAVAL_TEX_SIZE; x += 7) assert.equal(sheet.data[((y0 + y) * sheet.width + x0 + x) * 4 + 3], pic.data[(y * pic.width + x) * 4 + 3], `${name} (${x}, ${y})`);
    for (let k = 0; k < NAVAL_TEX_SIZE; k += 5) {   // its gutter all round: clear
      assert.equal(sheet.data[((y0 - 1) * sheet.width + x0 + k) * 4 + 3], 0); assert.equal(sheet.data[((y0 + NAVAL_TEX_SIZE) * sheet.width + x0 + k) * 4 + 3], 0);
      assert.equal(sheet.data[((y0 + k) * sheet.width + x0 - 1) * 4 + 3], 0); assert.equal(sheet.data[((y0 + k) * sheet.width + x0 + NAVAL_TEX_SIZE) * 4 + 3], 0);
    }
    const uv = sheetUv(name);
    assert.deepEqual([uv.u0 * NAVAL_SHEET_SIZE, uv.u1 * NAVAL_SHEET_SIZE, uv.v0 * NAVAL_SHEET_SIZE, uv.v1 * NAVAL_SHEET_SIZE], [x0, x0 + NAVAL_TEX_SIZE, y0, y0 + NAVAL_TEX_SIZE]);
  }
  assert.deepEqual(Object.keys(NAVAL_GL_TEXTURES), ['sheet', 'line']);
  // a fight's frame at the budget
  const fx = createNavalEffects({ random: seeded(9) });
  for (let i = 0; i < 40; i++) { fx.muzzle([i, 3, 0], [0, 0, 1]); fx.splash([i, 0, 30]); fx.hit([i, 2, 60], [0, 0, 1]); fx.tear([i, 12, 60], [0, 0, 1]); fx.timber([i, 0, 60]); }
  fx.step(0.05);
  assert.equal(fx.count, PARTICLE_BUDGET);
  const { gl, calls } = namedGl();
  const vw = new Float32Array(16); vw[0] = 1; vw[5] = 1; vw[10] = 1; vw[15] = 1;
  const pj = new Float32Array(16); pj[5] = 1.57;
  const r = { gl, _proj: pj, _view: vw, _camPos: [0, 0, -30], _ambient: [0.3, 0.3, 0.3], _sunColor: [1, 1, 1], _sunScale: 1, _lightDir: [0, 1, 0], _fogColor: [0.5, 0.5, 0.6], _fogMode: 1, _fogDensity: 0.001, _fogRange: [10, 900], _dwFog: new Float32Array(4), _focus: new Float32Array(4), markForeignPass() {} };
  const pass = new NavalRenderer(r);
  const particles = fx.drawList();
  pass.draw({ particles, aim: { arcs: [[[0, 5, 0], [0, 6, 20], [0, 5, 40]]], zone: [[0, 0, 40], [2, 0, 40]], posts: true, strikes: [[0, 3, 40]], hot: true, radius: 2 }, time: 1 });
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  const binds = calls.filter((c) => c[0] === 'bindTexture' && c[2]);
  assert.equal(draws.length, 3, `three draws (${draws.length})`);
  assert.equal(binds.length - 2, 2, 'two binds a frame (the two made at the first frame besides)');
  assert.equal(draws.reduce((s, c) => s + c[3], 0), pass.drawn * 6, 'every vertex once');
  // each quad in its picture's cell
  const cellOf = (u, v) => Object.entries(NAVAL_SHEET).find(([n]) => { const c = sheetUv(n); return u >= c.u0 - 1e-6 && u <= c.u1 + 1e-6 && v >= c.v0 - 1e-6 && v <= c.v1 + 1e-6; })?.[0];
  const alphaFirst = [...particles.filter((p) => p.blend !== 'add')].sort((a, b) => ((b.pos[0]) ** 2 + (b.pos[1]) ** 2 + (b.pos[2] + 30) ** 2) - ((a.pos[0]) ** 2 + (a.pos[1]) ** 2 + (a.pos[2] + 30) ** 2));
  for (let q = 0; q < 50; q++) {
    const o = q * 6 * NAVAL_STRIDE;
    assert.equal(cellOf(pass.data[o + 3], pass.data[o + 4]), pictureOf(alphaFirst[q]), `quad ${q}: its picture's cell`);
  }
});

test('AUDIT NAV1 (#13) WHAT GOES FIRST PAST THE BUDGET: a splash\'s spray and foam and a port\'s glints, then the splinters, scraps and embers, then the flashes and the planks, the smoke last - whenever each was made; within the kind the cut falls in, the nearest its end (mutants: the ranks in another order, the farthest from its end first, the oldest first)', () => {
  assert.deepEqual(Object.entries(EVICT_RANK).sort((a, b) => a[1] - b[1]).map(([k]) => k), ['spray', 'foam', 'glint', 'debris', 'shred', 'ember', 'flash', 'timber', 'smoke']);
  const rankOrder = [['spray', 'foam', 'glint'], ['debris', 'shred', 'ember'], ['flash', 'timber'], ['smoke']];
  // a field over the budget by a cut inside the splinters' rank: every spray gone, some splinters, nothing above
  const fx = createNavalEffects({ random: seeded(2) });
  for (let i = 0; i < 20; i++) fx.smoke([i, 0, 0], [1, 0, 0], 1, 10);   // 200 puffs, the oldest
  for (let i = 0; i < 60; i++) fx.hit([i, 0, 50], [0, 0, 1]);   // 600 splinters, 180 puffs, 60 flashes: the cut (660) past the splashes' 520
  for (let i = 0; i < 40; i++) fx.splash([i, 0, 90]);   // the newest: spray and foam
  const kinds = (list) => list.reduce((m, p) => { m[p.kind] = (m[p.kind] ?? 0) + 1; return m; }, {});
  const before = kinds(fx.drawList());
  fx.step(0.001);
  const after = kinds(fx.drawList());
  assert.equal(fx.count, PARTICLE_BUDGET);
  assert.equal((after.spray ?? 0) + (after.foam ?? 0), 0, 'the spray and the foam all gone first');
  assert.equal(after.smoke, before.smoke, 'every puff of smoke kept');
  assert.equal(after.flash, before.flash, 'every flash kept');
  assert.ok(after.debris < before.debris, 'the cut in the splinters');
  assert.ok(rankOrder.length === 4);
  // within the rank the cut falls in, the nearest their end go first: a splash's old spray (0.8 s into its 0.9-1.7) before
  // its old foam (0.8 s into its 2.4), and both before the new - never the oldest first, never the newest
  const fx2 = createNavalEffects({ random: seeded(4) });
  for (let i = 0; i < 50; i++) fx2.splash([i, 0, 0]);
  fx2.step(0.8);
  for (let i = 0; i < 50; i++) fx2.splash([1000 + i, 0, 0]);
  fx2.step(0.001);
  const list = fx2.drawList();
  assert.equal(list.length, PARTICLE_BUDGET);
  const old = list.filter((p) => p.pos[0] < 500), fresh = list.filter((p) => p.pos[0] > 500);
  assert.equal(fresh.length, 650, 'every new particle kept');
  assert.equal(old.filter((p) => p.kind === 'foam').length, 50, 'every old foam ring kept - its share of its life the smaller');
  assert.equal(old.filter((p) => p.kind === 'spray').length, 600 - 400, 'the old spray the cut');
});

// ── the word, once a tick ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 (#14) THE SEA\'S WORD MADE ONCE A TICK: the moved test and the frame it rides ask one word - built and keyed once - and the next tick builds its own (mutants: built at each ask, kept past its tick)', () => {
  let built = 0, keyed = 0;
  const scope = {
    navalOn: () => true, naval: { word: () => { built++; return { ships: [built] }; } }, navalRecordKey: (r) => { keyed++; return JSON.stringify(r); },
    campToWire: (p) => p, _navalWordKey: null, _navalWordMade: null, _foesSentAt: 1000,
  };
  const body = `let { navalOn, naval, navalRecordKey, campToWire, _navalWordKey, _navalWordMade, _foesSentAt } = s;
    ${cut(WORLD, '  function navalWord(frame, full) {')}
    return { word: navalWord, tick: (t) => { _foesSentAt = t; } };`;
  // eslint-disable-next-line no-new-func
  const w = new Function('s', body)(scope);
  const frame = {};
  assert.equal(w.word(null, false), true, 'a first word: news');
  assert.equal(w.word(frame, false), true);
  assert.deepEqual([built, keyed], [1, 1], 'one word built and keyed for both asks');
  assert.deepEqual(frame.nv, { ships: [1] });
  w.tick(1200);
  const f2 = {};
  w.word(null, false); w.word(f2, false);
  assert.deepEqual([built, keyed], [2, 2], 'the next tick its own');
  assert.deepEqual(f2.nv, { ships: [2] });
});
