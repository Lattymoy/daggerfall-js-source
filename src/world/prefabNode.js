// @ts-check
// CSA-B (2026-09-27): A UNITY PREFAB, INSTANTIATED - the node tree a mod's C#
// walks by name.
//
// Come Sail Away builds each boat by instancing a prefab (DFU's
// MeshReplacement.ImportCustomGameobject) and then walking its Transforms:
// `GetChild(i)`, `.name`, `.gameObject.activeSelf`, `SetActive`,
// `localPosition` / `localRotation` / `localScale`, `SetParent`,
// `GetComponent<T>()`, `GetComponentInChildren<T>()`. The port keeps that
// shape, so the mod's walk reads here line for line: a PrefabNode is a
// GameObject and its Transform in one (Unity keeps them one-to-one), with
// its components as the plain records tools/comeSailAwayExtract.mjs wrote
// (vendor/come-sail-away/Models/prefabs.json), each instance holding its OWN
// copy so a runtime edit (a collider's size, a renderer switched off) touches
// that boat alone.
//
// The Unity rules kept:
// - a child's world matrix is its parent's times T * R * S (the rotation a
//   unit quaternion [x, y, z, w], Unity's order);
// - `activeInHierarchy` is `activeSelf` on this node and every ancestor;
// - `getComponentInChildren` searches depth first, this node first, and
//   finds a component only on an ACTIVE node (Unity's includeInactive =
//   false); `getComponentsInChildren` the same, all of them;
// - children keep their order, and a new child goes last;
// - `transform.parent = p` (SetParent with worldPositionStays) keeps the
//   world position and rotation and re-derives the local scale the way
//   Unity's Transform.SetWorldRotationAndScale does: the local scale set to
//   one, the node's world rotation-and-scale inverted, times the one it had,
//   and the local scale read off that product's diagonal - so a node moved
//   under a scaled parent keeps its world size (the helper objects the mod
//   parents this way - a billboard, a light, a baked sail's holder - get a
//   local scale of one over the parent's) and `setParent` (SetParent(p,
//   false)) keeps the local transform as it stands.

import { multiply } from './mat4.js';
import { mat4FromQuatPosScale, quatMultiply, quatRotate } from './quat.js';

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ZERO3 = Object.freeze([0, 0, 0]), ONE3 = Object.freeze([1, 1, 1]);
const _rotScratch = new Float32Array(16);   // lossyScaleOf's rotation, read at once (rs3 copies it out)
/** AUDIT NAV1 (the frame's cost, #12): A TREE'S SHAPE, STAMPED - bumped by every change to which node hangs under
 *  which (setParent, and so setParentKeepWorld and every instance built) and to which components a node carries
 *  (addComponent); never by a move, a turn or a switch on or off. What is kept of a tree's shape (world/
 *  prefabColliders.js's index of its colliders, a boat's plan and her Animators) stands while the stamp does.
 *  BOAT-STAMP (2026-10-21, a player's profile: the boats' pool 11% of the frame, rendererModelKey 2.6% - every boat's
 *  key made again most frames): EACH TREE ITS OWN. The stamp was ONE count for every tree in the game, so a boat built
 *  anywhere - a sea hull streaming in, a peer's boat, a fitting stood - made every boat's plan, bones, still chains,
 *  Animators and colliders again the next frame. It is kept on a tree's top node (`_treeStamp`) and bumped there: a node
 *  hung elsewhere bumps the tree it left and the one it joined, a component added its own tree. Every bump is a fresh
 *  draw of one count, so no bump repeats a value any stamp has had: a node whose tree changes reads a value it never
 *  read. A tree never reshaped reads 0, as every such tree does - and no reader compares one tree's stamp with
 *  another's: each keeps the stamp it read off its own node's tree, and its next read is that node's tree's again. */
let _shapeCount = 0;
/** The top node of `n`'s tree - the node it hangs under that hangs under nothing (itself, for a top node). The climb
 *  ends: no node hangs under itself or a node of its own (setParent refuses it). */
const topOf = (n) => { let r = n; while (r.parent) r = r.parent; return r; };
/** The tree `n` stands in, reshaped: its top node stamped with a value no stamp has had. */
const reshaped = (n) => { topOf(n)._treeStamp = ++_shapeCount; };
/** The shape stamp of the tree `node` stands in (its top node's): another value once a node of that tree is hung
 *  elsewhere, one is hung in it, or one of its nodes is given a component; the same while only other trees change.
 *  @param {PrefabNode} node */
export const prefabShapeStamp = (node) => topOf(node)._treeStamp;
/** BOAT-FAR (its audit, 2026-10-21): A TREE'S SWITCHES, STAMPED - bumped on its top node (`_treeSwitch`) by every
 *  setActive that turns a node of it on or off (one that sets what the node already reads bumps nothing), drawn from
 *  the shape's count; never by a move, a turn, a node hung or a component added (the shape's). Which nodes a walk of
 *  the tree reaches - its active children, down from an active top - stands while this and its shape's stamp do, and a
 *  far boat's held walk (scenes/comeSailAway/comeSailAwayPool.js lifeOf) is kept only while both stand.
 *  @param {PrefabNode} node */
export const prefabSwitchStamp = (node) => topOf(node)._treeSwitch;

export class PrefabNode {
  /**
   * @param {string} name
   * @param {{ active?: boolean, layer?: number, tag?: number, position?: number[], rotation?: number[], scale?: number[], components?: any[] }} [o]
   */
  constructor(name, { active = true, layer = 0, tag = 0, position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], components = [] } = {}) {
    this.name = name;
    this.activeSelf = active;
    this.layer = layer;
    this.tag = tag;
    this.localPosition = [...position];
    this.localRotation = [...rotation];
    this.localScale = [...scale];
    /** @type {any[]} */
    this.components = components;
    /** @type {PrefabNode|null} */
    this.parent = null;
    /** @type {PrefabNode[]} */
    this.children = [];
    /** BOAT-STAMP: on a top node, its tree's shape stamp (prefabShapeStamp) - read on no other */
    this._treeStamp = 0;
    /** BOAT-FAR (its audit): on a top node, its tree's switches' stamp (prefabSwitchStamp) - read on no other */
    this._treeSwitch = 0;
    /** @type {PrefabNode|null} the root of the prefab instance this node came from (instantiatePrefab) */
    this.prefabRoot = null;
    /** @type {Map<string, PrefabNode>|null} on an instance's root: its nodes by prefab path */
    this.prefabPaths = null;
    // AUDIT NAV1 (the frame's cost, #11/#12): the world matrix as last made (worldMatrix), the local values it was made
    // of, and the parent and the parent's matrix it was made under
    /** @type {any} */ this._w = null;
    /** @type {Float64Array|null} */ this._wk = null;
    /** @type {PrefabNode|null|undefined} */ this._wParent = undefined;
    /** @type {any} */ this._wParentM = undefined;
    /** @type {any} */ this._r = null;
    /** @type {Float64Array|null} */ this._rk = null;
    /** @type {PrefabNode|null|undefined} */ this._rParent = undefined;
    /** @type {any} */ this._rParentQ = undefined;
  }

  get childCount() { return this.children.length; }
  getChild(i) { return this.children[i]; }

  /** Unity's SetParent(parent, false): the local transform is kept as it stands. A parent that is this node or one of
   *  its own is refused, as Unity's SetParent refuses it - here by a throw, before anything moves, so the caller is
   *  named where it asks (no caller does: a node under its own child would make every climb to its tree's top, topOf,
   *  climb for ever). */
  setParent(parent) {
    for (let p = parent; p; p = p.parent) if (p === this) throw new Error(`PrefabNode.setParent: '${this.name}' cannot hang under itself or a node of its own ('${parent.name}')`);
    const left = topOf(this);   // BOAT-STAMP: the tree it leaves (itself, hung under nothing)
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = parent;
    if (parent) parent.children.push(this);
    reshaped(left); reshaped(this);   // ...and the tree it joins (itself again, hung under nothing now)
    return this;
  }

  /** `transform.parent = parent` - Unity's SetParent(parent, worldPositionStays: true). */
  setParentKeepWorld(parent) {
    const worldPosition = this.position;
    const worldRotation = this.rotation;
    const worldRS = rs3(this.worldMatrix());
    this.setParent(parent);
    this.rotation = worldRotation;
    this.position = worldPosition;
    // Transform.SetWorldRotationAndScale
    this.localScale = [1, 1, 1];
    const m = mul3(inv3(rs3(this.worldMatrix())), worldRS);
    this.localScale = [m[0], m[4], m[8]];
    return this;
  }

  /** Transform.position: the node's origin in its root's frame; setting it moves the local position to match. */
  get position() { const m = this.worldMatrix(); return [m[12], m[13], m[14]]; }
  set position(p) { this.localPosition = this.parent ? this.parent.inverseTransformPoint(p) : [...p]; }
  /** Transform.rotation: the local rotations multiplied down from the root (scale never enters it). AUDIT NAV1 (#11):
   *  kept as worldMatrix keeps its matrix - made again only when this node's local rotation reads otherwise, its parent
   *  is another, or its parent's was made again; a copy handed out, so no reader can write into what is kept. */
  get rotation() {
    const p = this.parent, pr = p ? p._rotationKept() : null, q = this.localRotation, k = this._rk;
    if (!(k && this._rParent === p && this._rParentQ === pr && k[0] === q[0] && k[1] === q[1] && k[2] === q[2] && k[3] === q[3])) {
      this._r = pr ? quatMultiply(pr, q) : [...q];
      const kk = (this._rk ??= new Float64Array(4));
      kk[0] = q[0]; kk[1] = q[1]; kk[2] = q[2]; kk[3] = q[3];
      this._rParent = p; this._rParentQ = pr;
    }
    return [...this._r];
  }
  /** The kept world rotation itself (the getter's own, never a copy) - a child's product reads its parent's. */
  _rotationKept() { this.rotation; return this._r; }
  set rotation(q) { this.localRotation = this.parent ? normalizeQuat(quatMultiply(quatInverse(this.parent.rotation), q)) : [...q]; }
  /** Transform.lossyScale: the world rotation undone from the world rotation-and-scale, its diagonal. */
  get lossyScale() { return this.lossyScaleOf(this.worldMatrix()); }
  /** AUDIT PRE-MERGE 0928 R5: lossyScale over the node's world matrix already in hand (a walk's), the same arithmetic.
   *  PERF-SAILS3: into `out` when one is given - the product's diagonal alone, each term the one mul3 sums (rs3's
   *  rows of the rotation, transposed, against the world's columns), in mul3's order: the same floats, no array made. */
  lossyScaleOf(world, out = undefined) {
    const R = mat4FromQuatPosScale(this.rotation, ZERO3, ONE3, _rotScratch);
    if (out) {
      out[0] = R[0] * world[0] + R[1] * world[1] + R[2] * world[2];
      out[1] = R[4] * world[4] + R[5] * world[5] + R[6] * world[6];
      out[2] = R[8] * world[8] + R[9] * world[9] + R[10] * world[10];
      return out;
    }
    const m = mul3(transpose3(rs3(R)), rs3(world));
    return [m[0], m[4], m[8]];
  }
  /** Transform.InverseTransformPoint: a point in the root's frame, in this node's. */
  inverseTransformPoint(p) {
    const m = this.worldMatrix();
    const inv = inv3(rs3(m));
    const d = [p[0] - m[12], p[1] - m[13], p[2] - m[14]];
    return [inv[0] * d[0] + inv[1] * d[1] + inv[2] * d[2], inv[3] * d[0] + inv[4] * d[1] + inv[5] * d[2], inv[6] * d[0] + inv[7] * d[1] + inv[8] * d[2]];
  }
  /** Transform.InverseTransformVector: a vector in the root's frame, in this node's - its rotation and scale undone,
   *  no position. */
  inverseTransformVector(v) {
    const inv = inv3(rs3(this.worldMatrix()));
    return [inv[0] * v[0] + inv[1] * v[1] + inv[2] * v[2], inv[3] * v[0] + inv[4] * v[1] + inv[5] * v[2], inv[6] * v[0] + inv[7] * v[1] + inv[8] * v[2]];
  }
  /** Transform.forward: the node's rotation of +Z. */
  get forward() { return quatRotate(this.rotation, [0, 0, 1]); }

  /** GameObject.SetActive. BOAT-FAR (its audit): a switch that changes what the node reads stamps its tree's switches
   *  (prefabSwitchStamp); one that sets what it reads is no switch. */
  setActive(v) {
    const on = !!v;
    if (this.activeSelf !== on) { this.activeSelf = on; topOf(this)._treeSwitch = ++_shapeCount; }
  }
  get activeInHierarchy() {
    for (let n = /** @type {PrefabNode|null} */ (this); n; n = n.parent) if (!n.activeSelf) return false;
    return true;
  }

  /** T * R * S of this node alone. */
  localMatrix() { return mat4FromQuatPosScale(this.localRotation, this.localPosition, this.localScale); }
  /**
   * The node's matrix in its root's frame (the root's own transform included).
   *
   * AUDIT NAV1 (the frame's cost, #11/#12): KEPT WHILE IT READS THE SAME, as Unity keeps a Transform's. It was made
   * afresh at every ask - the local matrix of this node and of every one above it, and their products - and a sea
   * fight asks it hundreds of times a frame (a hull's box alone some 240 times with eight ships near: a fifth of the
   * sea's frame, and its garbage). Now it is made again only when this node's local position, rotation or scale reads
   * otherwise than when it was made (their values, never the arrays' identity), when its parent is another, or when
   * its parent's own was made again - the same product of the same values as before, to the bit. The node's own: read
   * it, never write it; one made again is a new one, so a matrix handed out stays as it was.
   */
  worldMatrix() {
    const p = this.parent;
    const pw = p ? p.worldMatrix() : null;
    const q = this.localRotation, t = this.localPosition, s = this.localScale, k = this._wk;
    if (k && this._wParent === p && this._wParentM === pw && k[0] === q[0] && k[1] === q[1] && k[2] === q[2] && k[3] === q[3]
      && k[4] === t[0] && k[5] === t[1] && k[6] === t[2] && k[7] === s[0] && k[8] === s[1] && k[9] === s[2]) return this._w;
    const local = mat4FromQuatPosScale(q, t, s);
    const w = pw ? multiply(pw, local) : local;
    const kk = (this._wk ??= new Float64Array(10));
    kk[0] = q[0]; kk[1] = q[1]; kk[2] = q[2]; kk[3] = q[3]; kk[4] = t[0]; kk[5] = t[1]; kk[6] = t[2]; kk[7] = s[0]; kk[8] = s[1]; kk[9] = s[2];
    this._w = w; this._wParent = p; this._wParentM = pw;
    return w;
  }
  /** A point in the node's frame, in its root's frame. */
  transformPoint(p) {
    const m = this.worldMatrix();
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }

  getComponent(type) { return this.components.find((c) => c.type === type) ?? null; }
  getComponents(type) { return this.components.filter((c) => c.type === type); }
  addComponent(c) { this.components.push(c); reshaped(this); return c; }

  /** Depth first, this node first; only a component on an active node (Unity's default). */
  getComponentInChildren(type) {
    return this.activeInHierarchy ? findActive(this, type) : null;
  }
  getComponentsInChildren(type, out = []) {
    if (this.activeInHierarchy) collectActive(this, type, out);
    return out;
  }

  /** The node whose slash-joined names from here are `path` ('' is this node), or null. */
  find(path) {
    if (!path) return this;
    let n = /** @type {PrefabNode|null} */ (this);
    for (const part of path.split('/')) { n = n?.children.find((c) => c.name === part) ?? null; if (!n) return null; }
    return n;
  }
  /** This node's path from `root` (Unity's AnimationUtility path: the root's own name not included). */
  pathFrom(root) {
    const parts = [];
    for (let n = /** @type {PrefabNode|null} */ (this); n && n !== root; n = n.parent) parts.unshift(n.name);
    return parts.join('/');
  }
  /** Every node of the subtree, depth first, this one first. */
  *walk() { yield this; for (const ch of this.children) yield* ch.walk(); }
}

/** GetComponentInChildren below a node already known active: an inactive child and all under it are passed over. */
function findActive(n, type) {
  const own = n.getComponent(type);
  if (own) return own;
  for (const ch of n.children) {
    if (!ch.activeSelf) continue;
    const found = findActive(ch, type);
    if (found) return found;
  }
  return null;
}
function collectActive(n, type, out) {
  out.push(...n.getComponents(type));
  for (const ch of n.children) if (ch.activeSelf) collectActive(ch, type, out);
}

// 3x3 matrices row by row: [m00 m01 m02 m10 m11 m12 m20 m21 m22].
/** The rotation-and-scale block of a column-major 4x4. */
const rs3 = (m) => [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
const mul3 = (a, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};
const transpose3 = (a) => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
function inv3(a) {
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = a;
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  if (!det) return [0, 0, 0, 0, 0, 0, 0, 0, 0];   // Matrix3x3f::Invert of a singular matrix: the port answers zero, never NaN
  const k = 1 / det;
  return [
    c00 * k, (a02 * a21 - a01 * a22) * k, (a01 * a12 - a02 * a11) * k,
    c01 * k, (a00 * a22 - a02 * a20) * k, (a02 * a10 - a00 * a12) * k,
    c02 * k, (a01 * a20 - a00 * a21) * k, (a00 * a11 - a01 * a10) * k,
  ];
}
const quatInverse = (q) => { const n = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3] || 1; return [-q[0] / n, -q[1] / n, -q[2] / n, q[3] / n]; };
const normalizeQuat = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };

/** A deep copy of a component record, so an instance's edits are its own. */
const copy = (c) => (c && typeof c === 'object' ? JSON.parse(JSON.stringify(c)) : c);

/**
 * A prefab's tree (prefabs.json's `prefabs[id]`) as PrefabNodes, each
 * component its own copy of the shared record it indexes.
 * @param {{ name:string, active:boolean, layer:number, tag:number, position:number[], rotation:number[], scale:number[], components:number[], children:any[] }} tree
 * @param {any[]} components the shared table
 */
export function instantiatePrefab(tree, components) {
  /** @type {Map<string, PrefabNode>} */
  const byPath = new Map();
  const build = (t, path) => {
    const node = new PrefabNode(t.name, {
      active: t.active, layer: t.layer, tag: t.tag, position: t.position, rotation: t.rotation, scale: t.scale,
      components: t.components.map((i) => copy(components[i])),
    });
    if (!byPath.has(path)) byPath.set(path, node);   // Transform.Find's first match (no pointer in the files names a shared path - pinned)
    for (const ch of t.children) build(ch, `${path}/${ch.name}`).setParent(node);
    return node;
  };
  const root = build(tree, tree.name);
  for (const n of root.walk()) n.prefabRoot = root;
  root.prefabPaths = byPath;
  return root;
}

/**
 * A component's `{ node: path }` pointer (a bone, a root bone, a sub-emitter's
 * owner) as the node of `node`'s own instance it names - the path is the
 * prefab's, from its root's prefab name, so a renamed root still answers.
 */
export function resolveNodePointer(node, pointer) {
  if (!pointer || typeof pointer.node !== 'string') return null;
  return node.prefabRoot?.prefabPaths?.get(pointer.node) ?? null;
}

export const IDENTITY_MATRIX = IDENTITY;
