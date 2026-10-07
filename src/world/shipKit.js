// @ts-check
// SHIPS-2 (2026-10-07, Mac: "ensure it matches the love we gave the other new ship model we implemented"): THE
// SHIPWRIGHT'S KIT - what every ship of the port's builds her prefab with.
//
// The galleon (world/galleonModel.js, world/galleonRig.js) built hers on helpers of her own, and the carrack and the
// large boat (world/carrackModel.js, world/largeBoatModel.js) build theirs the same way - so the helpers live here, ONE
// home (the bible's ONE CONSTRUCTION SEAM): a node in Come Sail Away's data shape, a yaw, the clips' curves, a rigid
// matrix's inverse, a baked part's points, and `prefabBench` - the components and meshes a prefab adds to the mod's
// shared table, its renderers and colliders, and its skinned renderers' bones resolved once the tree's paths are known.
//
// A ship's prefab is Come Sail Away's data (systems/comeSailAwayModels.js): a node tree, its components as indices into
// `[...csaComponents, ...components]`, its meshes by key in the CSA geometry shape (world/galleonMesh.js MeshBench), its
// clips and overrides beside the mod's. Not a DFU member. Ledger A (GALLEON, SHIPS-2).
import { pathHash } from './unityAnimator.js';
import { mat4FromQuatPosScale } from './quat.js';
import { multiply } from './mat4.js';
import { colliderOf } from './galleonMesh.js';

/** @typedef {{ p?: readonly number[], r?: readonly number[], s?: readonly number[], c?: number[], kids?: any[], active?: boolean }} NodeOpts */
/** A node as Come Sail Away's prefabs hold one: its name, active flag, local transform, components and children.
 *  @param {string} name @param {NodeOpts} [opts] */
export const nodeOf = (name, { p = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1], c = [], kids = [], active = true } = {}) => ({ name, active, layer: 0, tag: 0, position: [...p], rotation: [...r], scale: [...s], components: c, children: kids });
/** A turn about y (Unity's: +z toward +x), as a quaternion. */
export const yaw = (deg) => { const a = (deg * Math.PI) / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
/** A node tree copied (the mod's own small things, stood in a ship of the port's). */
export const clone = (t) => JSON.parse(JSON.stringify(t));
/** The first node of a tree by name, depth first, or null. */
export const findNode = (t, name) => { if (!t) return null; if (t.name === name) return t; for (const c of t.children) { const f = findNode(c, name); if (f) return f; } return null; };

/** A clip of constant curves (`length` s long; a pose held). */
export const constClip = (name, curves, length = 0, loop = true) => ({ name, start: 0, stop: length, sampleRate: 60, loop, wrapMode: 0, denseRate: 60, denseBegin: 0, events: [], curves });
/** A node's euler angles, held (`path` from the Animator's node). */
export const eulerCurve = (path, e) => ({ path: pathHash(path), attribute: 'euler', components: e.map((v) => ({ constant: Math.fround(v) })) });
/** A node's position, held. */
export const posCurve = (path, p) => ({ path: pathHash(path), attribute: 'position', components: p.map((v) => ({ constant: Math.fround(v) })) });

/** The positions of a baked part as points. */
export const pointsOf = (part) => { const out = []; for (let i = 0; i < part.positions.length; i += 3) out.push([part.positions[i], part.positions[i + 1], part.positions[i + 2]]); return out; };
/** A box `{ min, max }` over points. */
export function boxOfPoints(pts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return { min, max };
}
/** A bake's part by role (the first), or an error naming the ship and the role. */
export function partOf(bake, role, ship = 'ship') {
  const p = bake.parts.find((x) => x.role === role);
  if (!p) throw new Error(`${ship}: the bake has no ${role}`);
  return p;
}

/** The inverse of a rotation-translation(-scale-free) column-major 4x4: R^T, -R^T t. */
export function invertRigid(m) {
  const o = new Float32Array(16);
  o[0] = m[0]; o[1] = m[4]; o[2] = m[8];
  o[4] = m[1]; o[5] = m[5]; o[6] = m[9];
  o[8] = m[2]; o[9] = m[6]; o[10] = m[10];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]);
  o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]);
  o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  o[15] = 1;
  return o;
}

/** A geometry built on the galleon's bench (its slots in her archive) worn in `archive` - every ship's pictures carry
 *  the galleon's record numbers for the ones the fleet shares (world/carrackArt.js TEX), so a door, a gun or a yard the
 *  galleon's builders make is the same mesh in another ship's archive. A collider's geometry (no slots) passes as it is. */
export function inArchive(geometry, archive) {
  if (!geometry?.slots) return geometry;
  return { ...geometry, slots: geometry.slots.map((s) => ({ ...s, archive })) };
}

/**
 * A PREFAB'S BENCH: the components and meshes a ship's prefab adds, and the helpers that make them - `base` the mod's
 * component table's length (her components' indices follow it), `ship` her name for an error.
 *   comp(record)           a component, answering its index;
 *   mesh(key, geometry)    a mesh by key (refused if it built nothing);
 *   renderer(geometry)     a MeshRenderer over its slots;
 *   meshNode(name, key, geometry, { collider, colliderGeometry, ...node opts })
 *                          a node drawing `geometry`, with a MeshCollider over the same triangles when `collider` - or
 *                          over `colliderGeometry`'s (a drawing with faces its collider leaves out);
 *   boxCollider(centre, size), animator(controller)
 *   skinned(node, key, bones, rootBone, materials)
 *                          a SkinnedMeshRenderer on `node` whose bone pointers are filled in by `finish`;
 *   finish(root)           the skinned renderers' bones and bind poses, now the tree's paths are known.
 */
export function prefabBench(base, ship = 'ship') {
  const components = [];
  /** @type {Record<string, any>} */
  const meshes = {};
  const skinnedLater = [];
  const comp = (c) => { components.push(c); return base + components.length - 1; };
  const mesh = (key, geometry) => { if (!geometry) throw new Error(`${ship}: ${key} built nothing`); meshes[key] = geometry; return key; };
  const renderer = (geometry) => comp({ type: 'MeshRenderer', m_Enabled: true, materials: geometry.slots.map((s) => ({ ...s })) });
  /** @param {string} name @param {string} key @param {any} geometry @param {NodeOpts & { collider?: boolean, colliderGeometry?: any }} [opts] */
  const meshNode = (name, key, geometry, { collider = false, colliderGeometry = geometry, ...opts } = {}) => {
    mesh(key, geometry);
    const c = [comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), renderer(geometry)];
    if (collider) { mesh(`${key}:collider`, colliderOf(colliderGeometry)); c.push(comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: `${key}:collider` } })); }
    return nodeOf(name, { ...opts, c: [...c, ...(opts.c ?? [])] });
  };
  const boxCollider = (center, size) => comp({ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: false, m_Center: { x: center[0], y: center[1], z: center[2] }, m_Size: { x: size[0], y: size[1], z: size[2] } });
  const animator = (controller) => comp({ type: 'Animator', m_Enabled: true, m_Controller: { controller }, m_ApplyRootMotion: false });
  const skinned = (node, key, bones, rootBone, materials, rope = false) => skinnedLater.push({ node, key, bones, rootBone, materials, rope });
  function finish(root) {
    const paths = new Map(), rest = new Map();
    const walk = (n, path, parentM) => {
      const m = multiply(parentM, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
      paths.set(n, path); rest.set(n, m);
      for (const c of n.children) walk(c, `${path}/${c.name}`, m);
    };
    walk(root, root.name, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    for (const k of skinnedLater) {
      const at = rest.get(k.node);
      if (!at) throw new Error(`${ship}: a skinned renderer outside the tree`);
      // Unity's bind pose: the bone's rest world inverse, times the renderer's rest world
      const geometry = meshes[k.key];
      geometry.bindPoses = k.bones.map((b) => multiply(invertRigid(rest.get(b)), at, new Float32Array(16)));
      k.node.components.push(comp({
        type: 'SkinnedMeshRenderer', m_Enabled: true, m_Mesh: { mesh: k.key }, m_Materials: k.materials,
        m_Bones: k.bones.map((b) => ({ node: paths.get(b) })), m_RootBone: k.rootBone ? { node: paths.get(k.rootBone) } : null,
        m_AABB: { m_Center: { x: geometry.aabb.center[0], y: geometry.aabb.center[1], z: geometry.aabb.center[2] }, m_Extent: { x: geometry.aabb.extent[0], y: geometry.aabb.extent[1], z: geometry.aabb.extent[2] } },
      }));
    }
    return { components, meshes };
  }
  return { components, meshes, comp, mesh, renderer, meshNode, boxCollider, animator, skinned, finish };
}
