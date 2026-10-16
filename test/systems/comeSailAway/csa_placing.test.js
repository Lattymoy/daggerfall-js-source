// CSA-C (2026-09-27) - COME SAIL AWAY'S BOATS PLACED, KEPT AND SAVED:
// world/prefabColliders.js (Physics.Raycast over a prefab's BoxColliders and
// MeshColliders, the convex ones as their hull) and systems/comeSailAway/comeSailAway.js
// (StartPlacing .. PlaceBoatAtRayHit's five arms, SetBoatPositionAndDirection,
// the nodes, the visibility, OnPositionUpdate's kept bug, the four console
// commands, ComeSailAwaySaveData). The runtime runs over the vendored hulls
// (the real SpawnBoat) and a scripted scene: each ray's answer, the terrains,
// the player's pixel - every expectation worked out here from the C#'s rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comeSailAwayModels } from '../../../src/systems/comeSailAway/comeSailAwayModels.js';
import { Boat, spawnBoat, setLights, HULL_NAMES } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import {
  createComeSailAwayRuntime, convertToInt32, upPlaneRaycast, tileMapIndexAtPosition, hullFromMessage, variantFromMessage,
  WATER_LEVEL, NO_WATER_LEVEL, CONSOLE, BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE, PLACE_CLICK_DELAY, TERRAIN_EDGE,
} from '../../../src/systems/comeSailAway/comeSailAway.js';
import {
  collidersOf, raycastColliders, rayBoxEntry, rayMeshEntry, convexHullPlanes, rayConvexEntry, invertAffine, BUILTIN_COLLIDER_MESHES,
} from '../../../src/world/prefabColliders.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { quatRotate } from '../../../src/world/quat.js';

const DIR = new URL('../../../vendor/come-sail-away/Models/', import.meta.url);
const json = (f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const MODELS = comeSailAwayModels({ prefabs: json('prefabs.json'), meshes: json('meshes.json'), bin: new Uint8Array(readFileSync(new URL('meshes.bin', DIR))), materials: json('materials.json'), animation: json('animation.json') });
const geometry = (c) => (c.m_Mesh?.mesh ? MODELS.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] : null);
const close = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps = 1e-4, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(close(v, b[i], eps), `${msg} [${i}] ${v} vs ${b[i]}`)); };
/** The same objects, in order - by identity, so a failing mutant is told so at once rather than having assert diff a
 *  boat's whole object graph (CSA-G: a boat's graph is big enough for that diff to run the machine out of memory). */
const sameObjects = (actual, expected, msg) => assert.ok(actual.length === expected.length && actual.every((x, i) => x === expected[i]), msg ?? 'the same objects, in order');
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const ctxFor = (player) => ({ models: MODELS, player: () => player, billboardSize: () => [0.8, 1.6], modelBounds: () => ({ min: [-1, 0, -1], max: [1, 1, 1] }) });

// ── the scripted scene ────────────────────────────────────────────────────────
/** A terrain record as the host hands it: the pixel's corner, a TileMap of `.r` bytes, a SampleHeight. */
function terrain(x, y, { tile = 5, height = 40, map = null } = {}) {
  const tileMap = map ?? new Uint8Array(128 * 128).fill(tile << 2);
  return { mapPixelX: x, mapPixelY: y, position: [(x - 10) * 819.2, 0, -(y - 20) * 819.2], tileMap, sampleHeight: typeof height === 'function' ? height : () => height };
}
function scene(opts = {}) {
  const out = { hud: [], mid: [], log: [], removed: [], spawned: [], rays: [] };
  const boats = [];
  const player = { position: [1, 2, 3], rotation: [0, 0, 0, 1] };   // yaw 0: the right is +x
  const cam = { position: [0, 50, 0], forward: [0, -1, 0] };
  const terrains = opts.terrains ?? [terrain(10, 20), terrain(11, 20), terrain(12, 20)];
  let pixel = { X: 10, Y: 20 };
  let now = 0;
  const hits = opts.hits ?? [];
  const deps = {
    pool: {
      models: MODELS,
      ready: () => opts.ready?.() ?? true,
      spawnNow: (boat, p) => { spawnBoat(boat, ctxFor(p)); boats.push(boat); out.spawned.push({ boat, player: p }); return boat; },
      remove: (b) => { out.removed.push(b); const i = boats.indexOf(b); if (i >= 0) boats.splice(i, 1); },
    },
    player: () => player,
    camera: () => cam,
    currentMapPixel: () => ({ X: pixel.X, Y: pixel.Y }),
    isPlayerInside: () => !!opts.inside?.(),
    blockWaterLevel: () => opts.waterLevel?.() ?? NO_WATER_LEVEL,
    iliacPuddleNoMore: () => !!opts.ipnm,
    raycast: (o, d, reach, q) => { out.rays.push({ o: [...o], d: [...d], reach, triggers: q.triggers }); const h = typeof hits === 'function' ? hits(o, d, reach, q) : hits.shift(); return h ?? null; },
    playerTerrain: () => terrains.find((t) => t.mapPixelX === pixel.X && t.mapPixelY === pixel.Y) ?? null,
    terrainAt: (x, y) => terrains.find((t) => t.mapPixelX === x && t.mapPixelY === y) ?? null,
    terrains: () => terrains,
    heightMapValue: opts.heightMapValue ?? (() => 255),   // CSA-F: WOODS.WLD all land - the waves lay nothing, and cast no ray
    worldCompensation: () => opts.compensation?.() ?? [0, 0, 0],
    hudText: (t, s) => out.hud.push(s == null ? t : [t, s]),
    midScreenText: (t, s) => out.mid.push([t, s]),
    log: (t) => out.log.push(t),
    random: { range: opts.range ?? ((min) => min) },
    time: () => now,
    persistentDungeonBoats: () => !!opts.persistent,
    packedItems: { serialize: (items) => items.map((it) => ({ ...it })), deserialize: (records) => records.map((it) => ({ ...it, restored: true })) },
  };
  const rt = createComeSailAwayRuntime(deps);
  return { rt, out, boats, player, cam, terrains, setPixel: (x, y) => { pixel = { X: x, Y: y }; }, setTime: (t) => { now = t; }, deps };
}

// ── world/prefabColliders.js ──────────────────────────────────────────────────

test('CSA-C: a prefab\'s colliders - only an active object\'s switched-on BoxCollider or MeshCollider is in the scene; a box is met from outside only, a mesh from either face, a convex mesh as its hull', () => {
  const root = new PrefabNode('root', { position: [10, 0, 0], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: [2, 2, 2] });
  const box = new PrefabNode('box', { position: [0, 1, 0], components: [{ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: false, m_Center: { x: 0, y: 0, z: 0 }, m_Size: { x: 1, y: 1, z: 1 } }] }).setParent(root);
  const off = new PrefabNode('off', { components: [{ type: 'BoxCollider', m_Enabled: false, m_Center: { x: 0, y: 0, z: 0 }, m_Size: { x: 9, y: 9, z: 9 } }] }).setParent(root);
  const hid = new PrefabNode('hid', { active: false }).setParent(root);
  new PrefabNode('under', { components: [{ type: 'BoxCollider', m_Enabled: true, m_Center: { x: 0, y: 0, z: 0 }, m_Size: { x: 9, y: 9, z: 9 } }] }).setParent(hid);
  const trig = new PrefabNode('trig', { position: [0, 3, 0], components: [{ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: true, m_Center: { x: 0, y: 0, z: 0 }, m_Size: { x: 1, y: 1, z: 1 } }] }).setParent(root);
  assert.deepEqual(collidersOf(root).map((c) => c.node.name), ['box', 'trig'], 'the switched-off box and everything under an inactive object answer nothing');
  // the box: local centre (0,1,0) under the root's x2 scale -> world centre (10, 2, 0), a 2 m cube; from x=0 along +x it is met at x=9
  const h = raycastColliders(root, [0, 2, 0], [1, 0, 0], 100, { geometry });
  assert.equal(h.node, box);
  assert.ok(close(h.distance, 9), h.distance);
  closeV(h.point, [9, 2, 0]);
  assert.equal(raycastColliders(root, [0, 2, 0], [1, 0, 0], 8.9, { geometry }), null, 'beyond maxDistance');
  assert.equal(raycastColliders(root, [10, 2, 0], [1, 0, 0], 100, { geometry }), null, 'an origin inside the box does not hit it');
  // the trigger stands at world y 6 (local 3 x 2): it answers only a query that takes triggers
  assert.equal(raycastColliders(root, [0, 6, 0], [1, 0, 0], 100, { geometry }).node, trig);
  assert.equal(raycastColliders(root, [0, 6, 0], [1, 0, 0], 100, { triggers: false, geometry }), null);
  // the slab test's edges
  assert.equal(rayBoxEntry([0, 0, 0], [0, 0, 1], [-1, -1, 2], [1, 1, 3]), 2);
  assert.equal(rayBoxEntry([0, 5, 0], [0, 0, 1], [-1, -1, 2], [1, 1, 3]), null, 'parallel and outside');
  assert.equal(rayBoxEntry([0, 0, 5], [0, 0, 1], [-1, -1, 2], [1, 1, 3]), null, 'behind');
  // a mesh from either face; a convex mesh as its hull (and no hit from inside it)
  const quad = { positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], indices: [0, 1, 2, 0, 2, 3] };
  assert.equal(rayMeshEntry([0, 0, -5], [0, 0, 1], quad), 5);
  assert.equal(rayMeshEntry([0, 0, 5], [0, 0, -1], quad), 5, 'the back face answers too - the port\'s MeshColliders are met from both faces');
  const cubePts = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, 0, 0, 0, 0.3, -0.2, 0.5];
  const hull = convexHullPlanes(cubePts);
  for (let i = 0; i < cubePts.length; i += 3) for (const pl of hull) assert.ok(pl.n[0] * cubePts[i] + pl.n[1] * cubePts[i + 1] + pl.n[2] * cubePts[i + 2] - pl.d <= 1e-9, 'every point on or inside every face');
  assert.equal(new Set(hull.map((pl) => pl.n.map((v) => Math.round(v * 1e6)).join())).size, 6, 'a cube\'s hull has its six planes (two triangles each), the inner points none');
  assert.equal(rayConvexEntry([-5, 0.2, 0.1], [1, 0, 0], hull), 4);
  assert.equal(rayConvexEntry([0, 0, 0], [1, 0, 0], hull), null, 'from inside: no hit');
  assert.equal(rayConvexEntry([5, 0, 0], [1, 0, 0], hull), null, 'behind');
  assert.equal(convexHullPlanes([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0.5, 0, 0.5]), null, 'a flat set cooks no hull');
  assert.equal(convexHullPlanes([0, 0, 0, 1, 0, 0, 0, 1, 0]), null, 'three points cook none');
  // a MeshCollider over Unity's Cube: from inside, the triangles are met (both faces) and the convex hull is not
  const inner = new PrefabNode('inner', { position: [50, 0, 0], components: [{ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { builtin: 'Cube' } }] });
  assert.ok(close(raycastColliders(inner, [50, 0, 0], [1, 0, 0], 100, { geometry }).distance, 0.5), 'a non-convex mesh has no inside: its far wall answers');
  inner.components[0].m_Convex = true;
  assert.equal(raycastColliders(inner, [50, 0, 0], [1, 0, 0], 100, { geometry }), null, 'cooked convex, the ray starts inside it');
  assert.ok(close(raycastColliders(inner, [40, 0.2, 0.1], [1, 0, 0], 100, { geometry }).distance, 9.5), '...and from outside it is met at its face');
  // a turned, scaled, moved node's inverse
  const m = root.worldMatrix(), inv = invertAffine(m);
  const p = [3, -2, 7], w = [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  closeV([inv[0] * w[0] + inv[4] * w[1] + inv[8] * w[2] + inv[12], inv[1] * w[0] + inv[5] * w[1] + inv[9] * w[2] + inv[13], inv[2] * w[0] + inv[6] * w[1] + inv[10] * w[2] + inv[14]], p, 1e-9);
  assert.equal(invertAffine([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), null, 'a singular matrix has none');
});

test('CSA-C: a built hull under the ray - its hull, masts and doors, its trigger boxes when the query takes them, never the switched-off Plane or an unchosen variant\'s flag cube; the two doors cooked convex', () => {
  const boat = spawnBoat(new Boat(1, 3), ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }));
  boat.GameObject.localPosition = [100, 34, 200];
  const cols = collidersOf(boat.GameObject);
  assert.ok(!cols.some((c) => c.node.name === 'Plane'), 'the prefab\'s Plane is switched off');
  assert.equal(cols.filter((c) => c.node.name === 'Cube').length, 0, 'no flag cube answers: the unchosen variants are inactive, and the chosen one\'s cube stands switched off (CSA-B)');
  const variants = boat.GameObject.getChild(0).find('OldSkiffHull/Variants');
  assert.deepEqual(variants.children.map((c) => c.activeSelf), [false, false, false, true, false, false, false]);
  assert.equal(variants.find('3/FlagObject/Cube').activeSelf, false);
  assert.deepEqual(cols.map((c) => c.collider.type), ['MeshCollider', 'BoxCollider', 'BoxCollider', 'BoxCollider', 'BoxCollider'], 'the hull and four trigger boxes');
  // straight down onto the hull's middle: the first collider met is the hull or a trigger box standing on it
  const down = raycastColliders(boat.GameObject, [100, 60, 200], [0, -1, 0], 100, { triggers: false, geometry });
  assert.equal(down.node.name, 'OldSkiffHull', 'with triggers ignored, the hull');
  const hullOnly = raycastColliders(boat.GameObject.getChild(0).find('OldSkiffHull'), [100, 60, 200], [0, -1, 0], 100, { triggers: false, geometry });
  assert.ok(close(down.distance, hullOnly.distance, 1e-9));
  // the two convex colliders in the bundle
  const convex = [];
  for (let hull = 0; hull < 5; hull++) for (const c of collidersOf(spawnBoat(new Boat(hull, 0), ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] })).GameObject)) if (c.collider.m_Convex) convex.push(c.node.name);
  assert.deepEqual(convex.sort(), ['GalleonInteriorEntrance', 'T\'ava Trireme Door'].sort());
  for (const name of convex) {
    const g = MODELS.geometry(name);
    const planes = convexHullPlanes(g.positions);
    assert.ok(planes && planes.length >= 4, `${name}: a hull`);
    for (let i = 0; i < g.positions.length; i += 3) for (const pl of planes) assert.ok(pl.n[0] * g.positions[i] + pl.n[1] * g.positions[i + 1] + pl.n[2] * g.positions[i + 2] - pl.d <= 1e-5, `${name}: every vertex inside`);
  }
});

// ── systems/comeSailAway/comeSailAway.js: the pure reads ───────────────────────────────────

test('CSA-C: the C#\'s small reads - Convert.ToInt32, Plane.Raycast on an up plane, the item message\'s hull and variant, GetTileMapIndexAtPosition in Unity\'s floats', () => {
  assert.equal(convertToInt32(null), 0);
  assert.equal(convertToInt32(' 12 '), 12);
  assert.equal(convertToInt32('+3'), 3);
  assert.equal(convertToInt32('-7'), -7);
  assert.throws(() => convertToInt32('1.5'), /FormatException/);
  assert.throws(() => convertToInt32('two'), /FormatException/);
  assert.throws(() => convertToInt32('99999999999'), /OverflowException/);
  // Plane(up, (0, h, 0)).Raycast: the distance to the plane along the ray, false (null) parallel or behind
  assert.equal(upPlaneRaycast([0, 50, 0], [0, -1, 0], 34), 16);
  assert.equal(upPlaneRaycast([0, 50, 0], [0, 1, 0], 34), null, 'the plane behind the ray');
  assert.equal(upPlaneRaycast([0, 10, 0], [0, 1, 0], 34), 24, 'from below, looking up');
  assert.equal(upPlaneRaycast([0, 50, 0], [1, 0, 0], 34), null, 'parallel');
  assert.equal(upPlaneRaycast([0, 34, 0], [0, -1, 0], 34), null, 'on the plane: enter 0 is not > 0');
  const d = unit([0, -1, 1]);
  assert.equal(upPlaneRaycast([0, 44, 0], d, 34), Math.fround(Math.fround(-10) / Math.fround(d[1])));
  // item.message = hull * 10 + variant
  assert.deepEqual([hullFromMessage(23), variantFromMessage(23), hullFromMessage(4), variantFromMessage(4), hullFromMessage(123)], [2, 3, 0, 4, 2]);
  // the tile map: row by z, column by x, each 128th of 819.2 truncated and clamped, the byte's record (.r / 4)
  const map = new Uint8Array(128 * 128);
  map[5 * 128 + 7] = (9 << 2) | 3;
  map[0] = 1 << 2;
  map[127 * 128 + 127] = 2 << 2;
  const t = { position: [100, 5, 200], tileMap: map };
  assert.equal(tileMapIndexAtPosition([100 + 7 * 6.4 + 0.1, 0, 200 + 5 * 6.4 + 0.1], t), 9, 'the record, the rotate and flip bits dropped');
  assert.equal(tileMapIndexAtPosition([100 - 50, 0, 200 - 1], t), 1, 'before the corner: clamped to 0');
  assert.equal(tileMapIndexAtPosition([100 + 5000, 0, 200 + 900], t), 2, 'past the far edge: clamped to 127');
  assert.equal(tileMapIndexAtPosition([100 - 0.01, 0, 200 - 0.01], t), 1, '(int) truncates toward zero - a hair before the corner is tile 0');
  assert.equal(tileMapIndexAtPosition([0, 0, 0], { position: [0, 0, 0], tileMap: null }), -1, 'no TileMap: -1');
  assert.equal(tileMapIndexAtPosition([0, 0, 0], { position: [0, 0, 0], tileMap: new Uint8Array(0) }), -1);
  assert.throws(() => tileMapIndexAtPosition([0, 0, 0], null), TypeError, 'a null terrain is the C#\'s NullReferenceException');
  assert.equal(TERRAIN_EDGE, Math.fround(819.2));
  assert.equal(PLACE_CLICK_DELAY, Math.fround(0.2));
  assert.equal(WATER_LEVEL, 34);
});

// ── the placement ray's five arms ─────────────────────────────────────────────

test('CSA-C: PlaceBoatAtRayHit, Iliac Puddle No More\'s sea - a "DeepWaters" collider places the boat at the hit, broadside (its forward the player\'s right), on the terrain the downward ray meets with triggers ignored', () => {
  const s = scene({ ipnm: true, hits: [
    { distance: 12, point: [5, 34.28, 900], name: 'DeepWaters_Surface', terrain: null, root: null },
    { distance: 2, point: [5, 32, 900], name: 'DaggerfallTerrain', terrain: null, root: null },
  ] });
  s.terrains[1].position = [819.2, 0, 0];
  const down = s.terrains[1];
  s.out.rays.length = 0;
  s.deps.raycast = ((orig) => (o, d, r, q) => { const h = orig(o, d, r, q); if (h && h.name === 'DaggerfallTerrain') h.terrain = down; return h; })(s.deps.raycast);
  s.rt.PlaceBoatAtRayHit(0, 4);
  assert.deepEqual(s.out.hud, ['Boat placed!']);
  assert.equal(s.rt.AllBoats.length, 1);
  const b = s.rt.AllBoats[0];
  assert.deepEqual([b.hull, b.variant], [0, 4]);
  closeV(b.GameObject.position, [5, 34.28, 900], 1e-4);   // a Transform holds floats
  closeV(quatRotate(b.GameObject.rotation, [0, 0, 1]), [1, 0, 0], 1e-9, 'the boat faces the player\'s right');
  assert.deepEqual(s.out.rays.map((r) => [r.reach, r.triggers]), [[100, true], [100, false]], 'the ray takes triggers, the downward one ignores them');
  closeV(s.out.rays[1].o, [5, 34.28, 900]);
  assert.deepEqual(s.out.rays[1].d, [0, -1, 0]);
  assert.deepEqual(b.MapPixel, { X: 11, Y: 20 }, 'the downward ray\'s terrain is not the player\'s: its pixel off the streaming world\'s array');
  // Iliac Puddle No More's node test on that terrain: SampleHeight < 34 is water (0), else land (1)
  assert.deepEqual(b.NodeTileMapIndices, [1, 1, 1, 1, 1], 'the stand-in terrain samples 40 everywhere');
  assert.equal(s.rt.placing, false);
});

test('FIELD-CSA1 (Julian: "first attempt just didn\'t spawn in the boat and the deed disappeared"): a "DeepWaters" hit under the sea\'s top is the carved floor - the boat floats on the water over it, where the look crosses the sea, else straight above the floor it met; the sea\'s top rides the vertical compensation', () => {
  // a swimmer's eye just under the surface, looking down: the ray never meets the surface's box from inside it, and goes on to the seabed
  const s = scene({ ipnm: true });
  const deed = { templateIndex: BOAT_DEED_TEMPLATE, UID: 31, message: 10 };   // a Large Boat's: no crew, spent on placing
  const bag = [deed];
  s.rt.StartPlacing(deed, bag);
  s.cam.position = [5, 33.5, 900];
  s.cam.forward = unit([0, -1, 1]);
  const floor = [5, 33.5 - 8 / Math.SQRT2, 900 + 8 / Math.SQRT2];
  s.deps.raycast = (o, d, r, q) => { s.out.rays.push({ o: [...o], d: [...d] }); return q.triggers ? { distance: 8, point: [...floor], name: 'DeepWaters_Seafloor', terrain: null, root: null } : null; };
  s.rt.PlaceBoatAtRayHit(1, 0);
  assert.deepEqual(s.out.hud, ['Boat placed!']);
  closeV(s.rt.AllBoats[0].GameObject.position, [floor[0], WATER_LEVEL, floor[2]], 1e-3, 'straight above the floor it met, on the water - not on the seabed');
  closeV(s.out.rays[1].o, [floor[0], WATER_LEVEL, floor[2]], 1e-3, 'the terrain under it asked from where it floats');
  assert.deepEqual(bag, [], 'the deed spent on a boat that stands where it can be boarded');
  // an eye over the water with no surface to meet (Spawn Water Surfaces off): the boat stands where the look crossed the sea
  const t = scene({ ipnm: true });
  t.cam.position = [0, 44, 0];
  t.cam.forward = unit([0, -1, 1]);
  t.deps.raycast = (o, d, r, q) => (q.triggers ? { distance: 30 * Math.SQRT2, point: [0, 14, 30], name: 'DeepWaters_Seafloor', terrain: null, root: null } : null);
  t.rt.PlaceBoatAtRayHit(1, 0);
  closeV(t.rt.AllBoats[0].GameObject.position, [0, WATER_LEVEL, 10], 1e-3, 'where the look crossed the sea');
  // the vertical compensation: after a recentre on a mountain the sea stands 501 m lower in the scene than the mod's 34
  const c = scene({ ipnm: true, compensation: () => [0, -501, 0] });
  c.cam.position = [5, -467.5, 900];
  c.cam.forward = [0, -1, 0];
  c.deps.raycast = (o, d, r, q) => (q.triggers ? { distance: 10, point: [5, -477.5, 900], name: 'DeepWaters_Seafloor', terrain: null, root: null } : null);
  c.rt.PlaceBoatAtRayHit(1, 0);
  closeV(c.rt.AllBoats[0].GameObject.position, [5, WATER_LEVEL - 501, 900], 1e-3, 'the sea\'s top in the scene, not 34 m over it');
});

test('FIELD-CSA1: the sea plane (nothing hit) is met within the placing ray\'s reach, as the dungeon\'s plane is - a look out to sea past it places nothing and keeps the deed ("Placement aborted!", the dungeon plane\'s own log line)', () => {
  const s = scene({ ipnm: true });
  const deed = { templateIndex: BOAT_DEED_TEMPLATE, UID: 5, message: 10 };
  const bag = [deed];
  s.rt.StartPlacing(deed, bag);
  s.cam.position = [0, 36, 0];
  s.cam.forward = unit([0, -0.01, 1]);   // two metres over the water, the look a hair under the horizon: the sea met 200 m out
  s.deps.raycast = () => null;
  s.rt.PlaceBoatAtRayHit(1, 0);
  assert.equal(s.rt.AllBoats.length, 0, 'no boat two hundred metres off, out of sight');
  assert.deepEqual(bag, [deed], 'the deed kept');
  assert.deepEqual(s.out.hud, [['Placement aborted!', 3]]);
  assert.match(s.out.log.at(-1), /^COME SAIL AWAY - INTERSECTION WITH WATER PLANE IS TOO FAR AT 200\./);
  assert.equal(s.rt.placing, false);
  // within the reach it places, as before
  s.rt.StartPlacing(deed, bag);
  s.cam.forward = unit([0, -0.1, 1]);   // met 20 m out
  s.rt.PlaceBoatAtRayHit(1, 0);
  assert.equal(s.rt.AllBoats.length, 1);
  closeV(s.rt.AllBoats[0].GameObject.position, [0, WATER_LEVEL, 20], 1e-3);
});

test('CSA-C: PlaceBoatAtRayHit - a deed repositions the boat it placed before (its UID), its packed cargo comes aboard, and the item is spent unless the boat is crewed', () => {
  const s = scene({ ipnm: true });
  const collection = [];
  const deed = { templateIndex: BOAT_DEED_TEMPLATE, UID: 77, message: 23 };
  collection.push(deed);
  const first = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1], 2, 3);
  first.uid = 77;
  s.rt.state.PackedCargoes.set('77', [{ name: 'rope' }]);
  s.rt.StartPlacing(deed, collection);
  assert.deepEqual(s.out.mid, [['Place the boat in water', 3]]);
  s.rt.StartPlacing({ templateIndex: 1 }, []);
  assert.equal(s.rt.state.placeItem, deed, 'a second StartPlacing while placing changes nothing');
  s.deps.raycast = (o, d, r, q) => (q.triggers ? { distance: 3, point: [50, 34.28, 60], name: 'DeepWaters_Surface', terrain: null, root: null } : null);
  s.rt.PlaceBoatAtRayHit(2, 3);
  assert.equal(s.rt.AllBoats.length, 1, 'no second boat: the deed\'s boat moved');
  closeV(first.GameObject.position, [50, 34.28, 60], 1e-4);
  assert.deepEqual(first.Cargo.Items, [{ name: 'rope' }], 'TransferAll: the packed cargo aboard');
  assert.deepEqual(s.rt.state.PackedCargoes.get('77'), [], '...and the packed collection emptied, kept under its UID');
  assert.equal(first.crewed, true, 'a galleon is crewed');
  assert.deepEqual(collection, [deed], 'a crewed boat keeps its deed');
  assert.equal(s.rt.placing, false);
  assert.equal(s.rt.state.placeItem, null);
  // boat parts: never a lookup - a new boat, the parts spent
  const parts = { templateIndex: BOAT_PARTS_TEMPLATE, UID: 78, message: 0 };
  const bag = [parts];
  s.rt.StartPlacing(parts, bag);
  s.rt.PlaceBoatAtRayHit(0, 0);
  assert.equal(s.rt.AllBoats.length, 2);
  assert.equal(s.rt.AllBoats[1].uid, 78);
  assert.deepEqual(bag, [], 'a rowboat is not crewed: its parts are spent');
});

test('CSA-C: PlaceBoatAtRayHit, a dungeon\'s water - blockWaterLevel x -0.025 is the plane; a nearer hit than the plane places the boat on it, inside; a plane out of reach or behind stops placing with the C#\'s log line', () => {
  const s = scene({ waterLevel: () => 200, inside: () => true });
  s.cam.position = [0, 2, 0];
  s.cam.forward = unit([0, -1, 1]);
  // the level is 200: y = -5 (Unity floats); from y 2 the ray reaches it at 7 / sin 45
  s.deps.raycast = () => ({ distance: 50, point: [0, -20, 22], name: 'StaticGeometry', terrain: null, root: null });
  s.rt.PlaceBoatAtRayHit(0, 1);
  assert.equal(s.out.log[0], `COME SAIL AWAY - PLACING BOAT IN DUNGEON WITH WATER LEVEL AT ${Math.fround(Math.fround(200 * -1) * Math.fround(0.025))}`);
  assert.deepEqual(s.out.hud, ['Boat placed!']);
  const b = s.rt.AllBoats[0];
  assert.equal(b.inside, true);
  assert.ok(close(b.GameObject.position[1], -5, 1e-4), b.GameObject.position);
  assert.ok(close(b.GameObject.position[2], 7, 1e-4));
  assert.deepEqual(b.NodeTileMapIndices, [0, 0, 0, 0, 0], 'inside a dungeon with water every node is water');
  assert.deepEqual(b.MapPixel, { X: 10, Y: 20 });
  // the plane farther than the hit: the terrain test, which a dungeon's geometry fails
  s.deps.raycast = () => ({ distance: 3, point: [0, 0, 2], name: 'StaticGeometry', terrain: null, root: null });
  s.rt.PlaceBoatAtRayHit(0, 1);
  assert.deepEqual(s.out.mid.at(-1), ['Boat can only be placed on water!', 3]);
  // looking up: no intersection
  s.cam.forward = [0, 1, 0];
  s.rt.PlaceBoatAtRayHit(0, 1);
  assert.equal(s.out.log.at(-1), 'COME SAIL AWAY - PLACEMENT DOES NOT INTERSECT WITH PLANE');
  // the plane beyond 100
  s.cam.position = [0, 200, 0];
  s.cam.forward = [0, -1, 0];
  s.deps.raycast = () => ({ distance: 150, point: [0, 50, 0], name: 'StaticGeometry', terrain: null, root: null });
  s.rt.PlaceBoatAtRayHit(0, 1);
  assert.match(s.out.log.at(-1), /^COME SAIL AWAY - INTERSECTION WITH WATER PLANE IS TOO FAR AT 205/);
  assert.equal(s.rt.AllBoats.length, 1);
});

test('CSA-C: PlaceBoatAtRayHit, the terrain - a hit on a Terrain whose tile there is water (0) places the boat on it; any other tile or collider refuses; no hit at all is the WaterLevel plane with Iliac Puddle No More, else "Placement aborted!"', () => {
  const map = new Uint8Array(128 * 128).fill(7 << 2);
  map[10 * 128 + 20] = 0;   // the water tile
  const t = terrain(10, 20, { map });
  const s = scene({ terrains: [t] });
  const onWater = [20 * 6.4 + 1, 0, 10 * 6.4 + 1];
  s.deps.raycast = () => ({ distance: 30, point: onWater, name: 'DaggerfallTerrain', terrain: t, root: null });
  s.rt.PlaceBoatAtRayHit(0, 2);
  assert.deepEqual(s.out.hud, ['Boat placed!']);
  const b = s.rt.AllBoats[0];
  closeV(b.GameObject.position, onWater);
  assert.deepEqual(b.MapPixel, { X: 10, Y: 20 }, 'the player\'s own terrain: the player\'s pixel');
  // the nodes read the tile map: the Center over the water tile, the others where the hull reaches
  const want = b.Nodes.map((n) => tileMapIndexAtPosition(n.position, t));
  assert.deepEqual(b.NodeTileMapIndices, want);
  assert.equal(b.NodeTileMapIndices[0], 0);
  s.deps.raycast = () => ({ distance: 30, point: [0.5, 0, 0.5], name: 'DaggerfallTerrain', terrain: t, root: null });
  s.rt.PlaceBoatAtRayHit(0, 2);
  assert.deepEqual(s.out.mid.at(-1), ['Boat can only be placed on water!', 3], 'a land tile');
  s.deps.raycast = () => ({ distance: 30, point: onWater, name: 'Dingy', terrain: null, root: b.GameObject });
  s.rt.PlaceBoatAtRayHit(0, 2);
  assert.deepEqual(s.out.mid.at(-1), ['Boat can only be placed on water!', 3], 'another boat is in the way');
  s.deps.iliacPuddleNoMore = () => true;
  s.deps.raycast = () => ({ distance: 30, point: [0.5, 0, 0.5], name: 'DaggerfallTerrain', terrain: t, root: null });
  s.rt.PlaceBoatAtRayHit(0, 2);
  assert.deepEqual(s.out.mid.at(-1), ['Boat can only be placed on water!', 3], 'with the sea mod on, only a "DeepWaters" collider takes its arm - a land tile still refuses');
  s.deps.iliacPuddleNoMore = () => false;
  assert.equal(s.rt.AllBoats.length, 1);
  // nothing hit
  s.deps.raycast = () => null;
  s.rt.PlaceBoatAtRayHit(0, 2);
  assert.deepEqual(s.out.hud.at(-1), ['Placement aborted!', 3]);
  const w = scene({ ipnm: true });
  w.cam.position = [0, 44, 0];
  w.cam.forward = unit([0, -1, 1]);
  w.deps.raycast = () => null;
  w.rt.PlaceBoatAtRayHit(0, 2);
  assert.deepEqual(w.out.hud, ['Boat placed!']);
  const wb = w.rt.AllBoats[0];
  assert.ok(close(wb.GameObject.position[1], WATER_LEVEL, 1e-4), 'on the world plane y = WaterLevel');
  assert.ok(close(wb.GameObject.position[2], 10, 1e-4));
  w.cam.forward = [0, 1, 0];
  w.rt.PlaceBoatAtRayHit(0, 2);
  assert.equal(w.out.log.at(-1), 'COME SAIL AWAY - PLACEMENT DOES NOT INTERSECT WITH PLANE');
  // DECLARED: the models not in yet - no boat, the placing ends
  const n = scene({ ready: () => false });
  n.rt.PlaceBoatAtRayHit(0, 0);
  assert.equal(n.rt.AllBoats.length, 0);
  assert.equal(n.out.rays.length, 0);
  assert.match(n.out.log[0], /models have not loaded/);
});

test('CSA-C: the console - placeboat reads its arguments as the C# does (a random variant for hull 0), printboats, identifyboat off the hit\'s root, purgeboat and its refusals', () => {
  const draws = [];
  const s = scene({ range: (min, max) => { draws.push([min, max]); return 5; } });
  s.deps.raycast = () => ({ distance: 3, point: [0, 0, 0], name: 'DaggerfallTerrain', terrain: s.terrains[0], root: null });
  s.terrains[0].tileMap.fill(0);
  assert.equal(s.rt.console.placeboat(['1', '2', '3']), 'Error - Too many arguments, check the usage notes.');
  assert.equal(s.rt.console.placeboat([]), 'Attempting to place boat');
  assert.deepEqual([s.rt.AllBoats[0].hull, s.rt.AllBoats[0].variant], [0, 5]);
  assert.deepEqual(draws, [[-12, 12], [0, 7]], 'Start\'s wind roll (15 x Random.Range(-12, 12) degrees), then Random.Range(0, 7) for the variant');
  s.rt.console.placeboat(['0']);
  assert.deepEqual([s.rt.AllBoats[1].hull, s.rt.AllBoats[1].variant], [0, 5]);
  s.rt.console.placeboat(['2']);
  assert.deepEqual([s.rt.AllBoats[2].hull, s.rt.AllBoats[2].variant], [2, 0], 'one argument that is not 0: variant 0');
  s.rt.console.placeboat(['1', '6']);
  assert.deepEqual([s.rt.AllBoats[3].hull, s.rt.AllBoats[3].variant], [1, 6]);
  assert.throws(() => s.rt.console.placeboat(['x']), /FormatException/, 'Convert.ToInt32\'s exception leaves the command');
  s.rt.AllBoats[2].MapPixel = { X: 3, Y: 4 };
  assert.equal(s.rt.console.printboats([]), `0 - Rowboat at 10, 20\n1 - Rowboat at 10, 20\n2 - ${HULL_NAMES[2]} at 3, 4\n3 - Large Boat at 10, 20\n`);
  s.deps.raycast = () => ({ distance: 3, point: [0, 0, 0], name: 'OldSkiffHull', terrain: null, root: s.rt.AllBoats[3].GameObject });
  assert.equal(s.rt.console.identifyboat([]), 'Hit object is a boat with index 3');
  s.deps.raycast = () => ({ distance: 3, point: [0, 0, 0], name: 'DaggerfallTerrain', terrain: s.terrains[0], root: null });
  assert.equal(s.rt.console.identifyboat([]), 'Hit object is not a boat!');
  s.deps.raycast = () => null;
  assert.equal(s.rt.console.identifyboat([]), 'Nothing was hit!');
  assert.equal(s.rt.console.purgeboat([]), 'Error - No arguments provided, check the usage notes.');
  assert.equal(s.rt.console.purgeboat(['1', '2']), 'Error - Too many arguments, check the usage notes.');
  assert.equal(s.rt.console.purgeboat(['4']), 'Error - Index is out of range');
  assert.throws(() => s.rt.console.purgeboat(['-1']), /ArgumentOutOfRangeException/);
  const gone = s.rt.AllBoats[1];
  assert.equal(s.rt.console.purgeboat(['1']), 'Boat at index 1 was purged.');
  assert.equal(s.rt.AllBoats.length, 3);
  assert.ok(s.out.removed.at(-1) === gone, 'the purged boat removed');
  s.rt.state.AllBoats.length = 0;
  assert.equal(s.rt.console.printboats([]), 'No placed boats!');
  assert.deepEqual(Object.keys(CONSOLE), ['giveboat', 'placeboat', 'printboats', 'identifyboat', 'purgeboat'], 'Start registers GiveMeBoat first (1081), CSA-H\'s');
  assert.equal(CONSOLE.placeboat.usage, 'placeboat [hull] [variant]; No argument will result in random hull and variant. WARNING: only hull 0 is available now and variants only go from 0-6');
});

// ── the nodes, the visibility, the floating origin ────────────────────────────

test('CSA-C: UpdateBoatVisibility - inside, only a boat placed inside this pixel stands; outside, a boat more than a pixel off hides and one placed inside hides and is destroyed unless the setting keeps it; a near one shows and reads its nodes', () => {
  let inside = false, persistent = false;
  const s = scene({ inside: () => inside });
  s.deps.persistentDungeonBoats = () => persistent;
  const near = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1]);
  const far = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1]); far.MapPixel = { X: 12, Y: 20 };
  const dungeon = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1]); dungeon.inside = true;
  near.NodeTileMapIndices.fill(-9);
  s.rt.UpdateBoatVisibility();
  assert.deepEqual([near.GameObject.activeSelf, far.GameObject.activeSelf, dungeon.GameObject.activeSelf], [true, false, false]);
  assert.deepEqual(near.NodeTileMapIndices, [5, 5, 5, 5, 5], 'the near boat reads its nodes on its own pixel\'s terrain');
  sameObjects(s.rt.AllBoats, [near, far], 'the dungeon\'s boat destroyed on the way out');
  sameObjects(s.out.removed, [dungeon], 'the dungeon\'s boat removed');
  // with the setting it stays (hidden)
  const kept = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1]); kept.inside = true;
  persistent = true;
  s.rt.UpdateBoatVisibility();
  assert.equal(s.rt.AllBoats.includes(kept), true);
  assert.equal(kept.GameObject.activeSelf, false);
  // inside: the inside boat of this pixel stands, the others go dark
  inside = true;
  s.rt.UpdateBoatVisibility();
  assert.deepEqual([near.GameObject.activeSelf, far.GameObject.activeSelf, kept.GameObject.activeSelf], [false, false, true]);
  // the one-boat form never destroys, and reads the nodes whatever it decided
  inside = false; persistent = false;
  kept.NodeTileMapIndices.fill(-9);
  s.rt.UpdateBoatVisibilityOf(kept);
  assert.equal(s.rt.AllBoats.includes(kept), true);
  assert.equal(kept.GameObject.activeSelf, false);
  assert.deepEqual(kept.NodeTileMapIndices, [5, 5, 5, 5, 5], 'hidden, and its nodes read all the same');
  s.rt.UpdateBoatVisibilityOf(null);
  // a boat with no pixel outside: its nodes' MapPixel.X throws, as the C#'s NullReferenceException
  far.MapPixel = null;
  assert.throws(() => s.rt.UpdateBoatVisibilityOf(far), TypeError);
});

test('CSA-C: UpdateBoatNodes - inside a dungeon with water every node is water, a dry inside reads nothing; outside, Iliac Puddle No More\'s SampleHeight under 34 is water, else the tile map; the pixel form reads nothing where no terrain is built', () => {
  let inside = false, level = NO_WATER_LEVEL;
  const heights = [10, 33.9, 34, 50, 0];
  let k = 0;
  const t = terrain(10, 20, { height: () => heights[k++ % 5] });
  const s = scene({ ipnm: true, inside: () => inside, waterLevel: () => level, terrains: [t] });
  const b = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1]);
  k = 0;
  s.rt.UpdateBoatNodes(b);
  assert.deepEqual(b.NodeTileMapIndices, [0, 0, 1, 1, 0], 'under 34 is water - 34 itself is not');
  inside = true;
  b.NodeTileMapIndices.fill(7);
  s.rt.UpdateBoatNodes(b);
  assert.deepEqual(b.NodeTileMapIndices, [7, 7, 7, 7, 7], 'a dry inside reads nothing');
  level = 100;
  s.rt.UpdateBoatNodes(b);
  assert.deepEqual(b.NodeTileMapIndices, [0, 0, 0, 0, 0]);
  inside = false;
  b.NodeTileMapIndices.fill(7);
  s.rt.UpdateBoatNodesAtMapPixel(b, { X: 30, Y: 30 });
  assert.deepEqual(b.NodeTileMapIndices, [7, 7, 7, 7, 7], 'no terrain built at that pixel: nothing read');
  // UpdateAllBoatsNodes, kept as the C# has it: its reference comparison against a new DFPosition never holds
  s.rt.UpdateAllBoatsNodes();
  assert.deepEqual(b.NodeTileMapIndices, [7, 7, 7, 7, 7]);
});

test('CSA-C / FIELD-CSA1: OnPositionUpdate moves EVERY boat by the offset - active, coming into sight, or out of sight before and after (the C#\'s kept bug left that one at the old origin\'s numbers, and a player who came back by another pixel never found it) - but a dungeon\'s boat out of sight, which stands in its dungeon\'s frame', () => {
  const s = scene({ persistent: true });
  const near = s.rt.PlaceBoat([10, 34, 10], [0, 0, 1]);
  const far = s.rt.PlaceBoat([20, 34, 20], [0, 0, 1]); far.MapPixel = { X: 13, Y: 20 };
  const back = s.rt.PlaceBoat([30, 34, 30], [0, 0, 1]); back.MapPixel = { X: 12, Y: 20 };
  const dun = s.rt.PlaceBoat([40, -5, 40], [0, 0, 1]); dun.inside = true;   // Persistent Dungeon Boats: kept, in the dungeon's frame
  s.rt.UpdateBoatVisibility();
  assert.deepEqual([near.GameObject.activeSelf, far.GameObject.activeSelf, back.GameObject.activeSelf, dun.GameObject.activeSelf], [true, false, false, false]);
  s.setPixel(11, 20);   // the player crossed east: `back` comes within a pixel, `far` stays two off
  s.rt.OnPositionUpdate([-819.2, 0, 0]);
  closeV(near.GameObject.position, [10 - 819.2, 34, 10], 1e-3, 'active: moved');
  closeV(far.GameObject.position, [20 - 819.2, 34, 20], 1e-3, 'inactive before and after: moved with the world all the same');
  closeV(back.GameObject.position, [30 - 819.2, 34, 30], 1e-3, 'inactive, made active by its visibility: moved');
  assert.deepEqual([near.GameObject.activeSelf, far.GameObject.activeSelf, back.GameObject.activeSelf], [true, false, true]);
  closeV(dun.GameObject.position, [40, -5, 40], 1e-9, 'a dungeon\'s boat out of sight: its dungeon\'s frame, which no recentre moves');
  assert.equal(dun.GameObject.activeSelf, false);
  // the round the player takes back to `far` by ANOTHER pixel than the one they left it from: east, north, west, south
  const home = [...far.GameObject.position];
  for (const [px, py, off] of [[12, 20, [-819.2, 0, 0]], [12, 19, [0, 0, -819.2]], [11, 19, [819.2, 0, 0]], [11, 20, [0, 0, 819.2]]]) {
    s.setPixel(px, py);
    s.rt.OnPositionUpdate(off);
  }
  closeV(far.GameObject.position, home, 1e-3, 'back where the round began, the boat stands where it stood');
});

test('FIELD-CSA1: OnWorldReanchored (a teleport\'s new frame) carries every boat by the frame\'s move and shows or hides it for the new pixel - the helm is not asked, and a dungeon\'s boat out of sight stays in its dungeon\'s frame', () => {
  const s = scene({ persistent: true });
  const here = s.rt.PlaceBoat([100, 34, 200], [0, 0, 1]);
  const away = s.rt.PlaceBoat([300, 34, 400], [0, 0, 1]); away.MapPixel = { X: 40, Y: 20 };
  const dun = s.rt.PlaceBoat([40, -5, 40], [0, 0, 1]); dun.inside = true;
  s.rt.UpdateBoatVisibility();
  assert.deepEqual([here.GameObject.activeSelf, away.GameObject.activeSelf], [true, false]);
  // the player woke at a temple 30 pixels west: the old frame's origin stands 30 pixels east of the new one's
  s.setPixel(-20, 20);
  const moves = [];
  s.deps.helm = { setPlayerPosition: (p) => moves.push(p) };
  s.rt.state.CurrentBoat = here;   // as if the teleport found them at its helm: OnPositionUpdateBoat's arm would set them back aboard
  s.rt.OnWorldReanchored([30 * 819.2, 0, 0]);
  s.rt.state.CurrentBoat = null;
  closeV(here.GameObject.position, [100 + 30 * 819.2, 34, 200], 1e-2, 'carried by the frame\'s move');
  closeV(away.GameObject.position, [300 + 30 * 819.2, 34, 400], 1e-2, 'in sight or not');
  assert.deepEqual([here.GameObject.activeSelf, away.GameObject.activeSelf], [false, false], 'thirty pixels off: hidden (and silent)');
  assert.deepEqual(moves, [], 'nobody set back at a helm');
  closeV(dun.GameObject.position, [40, -5, 40], 1e-9, 'the dungeon\'s boat: not the streaming world\'s to move');
  // and the teleport home stands it again where it was placed
  s.setPixel(10, 20);
  s.rt.OnWorldReanchored([-30 * 819.2, 0, 0]);
  closeV(here.GameObject.position, [100, 34, 200], 1e-2);
  assert.equal(here.GameObject.activeSelf, true);
});

// ── ComeSailAwaySaveData ──────────────────────────────────────────────────────

test('CSA-C: ComeSailAwaySaveData - GetSaveData writes each boat as the C# does, and RestoreSaveData stands them again through the pixel overload, their heights corrected by the vertical compensation, their cargo and lanterns back', () => {
  let comp = [0, 5, 0];
  const s = scene({ compensation: () => comp });
  const a = s.rt.PlaceBoat([1, 39, 2], [1, 0, 0], 2, 0);
  a.uid = 5; a.Cargo.Items.push({ name: 'fish', stackCount: 3 });
  setLights(a, true);
  const b2 = s.rt.PlaceBoat([4, 39, 5], [0, 0, -1], 1, 6);
  b2.inside = true;
  s.rt.state.PackedCargoes.set('9', [{ name: 'net' }]);
  s.rt.state.MoveVectorCurrent = [1, 2, 3];
  s.rt.AddMapMarker([7, 8], { r: 1, g: 0, b: 0, a: 1 }, 'home');
  s.rt.AddMapMarker([7, 8], { r: 0, g: 1, b: 0, a: 1 }, 'again');
  const data = s.rt.getSaveData();
  assert.deepEqual(data.worldCompensation, { x: 0, y: 5, z: 0 });
  assert.equal(data.placedBoats.length, 2);
  const pa = data.placedBoats[0];
  assert.deepEqual([pa.UID, pa.Hull, pa.Variant, pa.MapPixel, pa.lights, pa.inside], [5, 2, 0, { X: 10, Y: 20 }, true, false]);
  assert.deepEqual(pa.Position, { x: 1, y: 39, z: 2 });
  assert.ok(close(pa.Direction.x, 1, 1e-6) && close(pa.Direction.z, 0, 1e-6), 'the transform\'s forward');
  assert.deepEqual(pa.Items, [{ name: 'fish', stackCount: 3 }]);
  assert.equal(data.placedBoats[1].inside, true);
  assert.equal(data.currentBoat, -1, 'nothing sailed (CSA-D)');
  assert.deepEqual(data.placedMapMarkers, [{ position: { x: 7, y: 8 }, label: 'home', color: { r: 1, g: 0, b: 0, a: 1 } }], 'AddMapMarker: once a pixel');
  assert.deepEqual(data.packedCargoes, { 9: [{ name: 'net' }] });
  assert.deepEqual(data.moveVectorCurrent, { x: 1, y: 2, z: 3 });
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(data))), JSON.stringify(data), 'plain JSON');
  // a load where the world's vertical compensation stands 3 m lower than it did at the save
  comp = [0, 2, 0];
  const r = scene({ compensation: () => comp });
  r.rt.PlaceBoat([0, 0, 0], [0, 0, 1]);   // a boat the load replaces
  const before = r.rt.AllBoats[0];
  r.rt.restoreSaveData(JSON.parse(JSON.stringify(data)));
  sameObjects(r.out.removed, [before], 'every standing boat destroyed first');
  assert.equal(r.rt.AllBoats.length, 2);
  const [ra, rb] = r.rt.AllBoats;
  closeV(ra.GameObject.position, [1, 39 - 3, 2], 1e-4, 'Position + up x (compensation now - then)');
  closeV(ra.Position, [1, 36, 2], 1e-4);
  assert.deepEqual([ra.uid, ra.hull, ra.MapPixel, ra.LightOn, rb.inside], [5, 2, { X: 10, Y: 20 }, true, true]);
  assert.deepEqual(ra.Cargo.Items, [{ name: 'fish', stackCount: 3, restored: true }], 'DeserializeItems');
  assert.deepEqual(ra.NodeTileMapIndices, [5, 5, 5, 5, 5], 'placed through the pixel overload: the nodes read on that pixel\'s terrain');
  assert.deepEqual(r.rt.state.mapMarkers.map((m) => m.position), [[7, 8]]);
  assert.deepEqual([...r.rt.state.PackedCargoes.keys()], ['9']);
  assert.deepEqual(r.rt.getSaveData().placedBoats.map((p) => p.Position.y), [36, 36]);
  // a record missing fields keeps the constructor's (FullSerializer)
  const m = scene();
  m.rt.restoreSaveData({ placedBoats: [{ UID: 1, Hull: 0, Variant: 0, MapPixel: { X: 10, Y: 20 }, Position: { x: 0, y: 34, z: 0 }, Direction: { x: 0, y: 0, z: 1 } }] });
  assert.equal(m.rt.AllBoats.length, 1);
  assert.deepEqual(m.rt.AllBoats[0].Cargo.Items, []);
  assert.deepEqual(m.rt.newSaveData(), {
    worldCompensation: { x: 0, y: 0, z: 0 }, placedBoats: [], placedMapMarkers: [], currentBoat: -1, TemporaryShip: false, sailPosition: 0,
    moveVectorCurrent: { x: 0, y: 0, z: 0 }, moveVectorTarget: { x: 0, y: 0, z: 0 }, windVector: { x: 0, y: 0, z: 1 }, packedCargoes: {},
  });
});

test('CSA-C: DECLARED - a save loaded before the models are in is held: GetSaveData hands it back whole, and the first frame they are in its boats stand and OnLoad\'s visibility runs for them', () => {
  let ready = false;
  const s = scene({ ready: () => ready });
  const rec = { ...s.rt.newSaveData(), placedBoats: [
    { UID: 0, Hull: 0, Variant: 1, MapPixel: { X: 10, Y: 20 }, Position: { x: 0, y: 34, z: 0 }, Direction: { x: 0, y: 0, z: 1 }, Items: [], lights: false, inside: false },
    { UID: 0, Hull: 0, Variant: 2, MapPixel: { X: 14, Y: 20 }, Position: { x: 9, y: 34, z: 0 }, Direction: { x: 0, y: 0, z: 1 }, Items: [], lights: false, inside: false },
  ] };
  s.rt.restoreSaveData(rec);
  assert.equal(s.rt.AllBoats.length, 0);
  assert.deepEqual(s.rt.getSaveData(), rec, 'the held record, as the load handed it');
  s.rt.tick();
  assert.equal(s.rt.AllBoats.length, 0, 'still loading');
  ready = true;
  s.rt.tick();
  assert.equal(s.rt.AllBoats.length, 2);
  assert.equal(s.rt.pendingRestore, null);
  assert.deepEqual(s.rt.AllBoats.map((b) => b.GameObject.activeSelf), [true, false], 'OnLoad\'s UpdateBoatVisibility ran: the boat four pixels off hides');
  assert.equal(s.rt.getSaveData().placedBoats.length, 2);
});

// ── LateUpdate's placing arm ──────────────────────────────────────────────────

test('AUDIT SHIPYARDS L1-1 (the port\'s own): the placing click stands no boat whose item has left its collection - sold at a shipyard, dropped, taken by a load - and lets the placing go; the same click with her item still held, by her number and kind, places her', () => {
  const s = scene();
  s.terrains[0].tileMap.fill(0);
  s.deps.raycast = () => ({ distance: 3, point: [2, 0, 2], name: 'DaggerfallTerrain', terrain: s.terrains[0], root: null });
  const parts = { templateIndex: BOAT_PARTS_TEMPLATE, UID: 3, message: 14 };
  const bag = [parts];
  s.setTime(10);
  s.rt.StartPlacing(parts, () => bag);
  bag.length = 0;   // sold: her parts gone from the list the placing was armed with
  s.setTime(10.3);
  s.rt.lateUpdate({ activateComplete: true });
  assert.deepEqual([s.rt.AllBoats.length, s.rt.placing], [0, false], 'no boat stood twice, the placing let go');
  const kept = { templateIndex: BOAT_PARTS_TEMPLATE, UID: 4, message: 14 };
  const bag2 = [{ ...kept }];   // her number and kind still held - a copy, as a list a load rebuilt holds
  s.setTime(20);
  s.rt.StartPlacing(kept, () => bag2);
  s.setTime(20.3);
  s.rt.lateUpdate({ activateComplete: true });
  assert.equal(s.rt.AllBoats.length, 1, 'held by her number: placed');
});

test('CSA-C: LateUpdate\'s placing arm (4957) - held by its pause gate and while sailing; a released Activate a fifth of a second after StartPlacing places the item\'s hull and variant (its message), logged as the C# logs them', () => {
  const s = scene();
  s.terrains[0].tileMap.fill(0);
  s.deps.raycast = () => ({ distance: 3, point: [2, 0, 2], name: 'DaggerfallTerrain', terrain: s.terrains[0], root: null });
  const parts = { templateIndex: BOAT_PARTS_TEMPLATE, UID: 3, message: 14 };
  s.setTime(10);
  s.rt.StartPlacing(parts, [parts]);
  s.setTime(10.2);
  s.rt.lateUpdate({ activateComplete: true });
  assert.equal(s.rt.AllBoats.length, 0, 'not past 0.2 s');
  s.setTime(10.3);
  s.rt.lateUpdate({ paused: true, activateComplete: true });
  assert.equal(s.rt.AllBoats.length, 0, 'the pause gate');
  assert.equal(s.rt.state.wasPaused, false, 'LateUpdate\'s gate returns without the mark - Update\'s sets it');
  s.rt.update({ paused: true });
  assert.equal(s.rt.state.wasPaused, true);
  s.rt.lateUpdate({ activateComplete: false });
  assert.equal(s.rt.AllBoats.length, 0, 'no click');
  s.rt.update({ activateComplete: true });
  assert.equal(s.rt.AllBoats.length, 0, 'Update has no placing arm');
  s.rt.lateUpdate({ activateComplete: true });
  assert.equal(s.rt.AllBoats.length, 1);
  assert.deepEqual([s.rt.AllBoats[0].hull, s.rt.AllBoats[0].variant], [1, 4]);
  assert.deepEqual(s.out.log.slice(0, 2), ['COME SAIL AWAY - ITEM HULL IS 1', 'COME SAIL AWAY - ITEM VARIANT IS 4']);
  assert.equal(s.rt.placing, false);
  // sailing holds the arm: LateUpdate's `if (IsSailing) ... else if (placing ...)` - PIN MOVED (AUDIT HOLDINGS F1): a
  // second boat's parts, the first's being refused while she stands (never a second boat of one number)
  s.rt.StartPlacing({ ...parts, UID: 4 }, []);
  s.setTime(20);
  s.rt.state.CurrentBoat = s.rt.AllBoats[0];
  assert.equal(s.rt.isSailing(), true);
  s.rt.lateUpdate({ activateComplete: true });   // the helm's arm instead (its move is nought: this scene's Time.deltaTime is 0)
  assert.equal(s.rt.AllBoats.length, 1);
  assert.equal(s.rt.placing, true, 'still placing - the click was the helm\'s frame');
});
