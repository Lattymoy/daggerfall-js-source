// @ts-check
// OUR OWN SHEATHING, in place of Weapon Sheathing's retired files. SHEATH_POINTS hangs each bone weaponSheathing.js
// names under a bone the game's skeleton already has, at our own place on the body; sheathingAddonBytes() writes them
// as a bone addon, each node marked "BONE" (mwSkin.js injectSkeletonNodes). ownScabbardBytes() builds a `_sh` file
// for the weapon in hand, sized to its own mesh - a sheath, a ring or a quiver - on the mechanism's file law: "Bip01
// Sheath" always shown, an empty "Bip01 Weapon" where the weapon itself hangs, a quiver's "Bip01 Ammo" with a node a
// round.
import { MW_WEAPON_TYPE } from '../formats/morrowind/mwFirstPerson.js';
import { flattenNif } from '../formats/morrowind/mwNifMesh.js';
import { parseNif } from '../formats/morrowind/mwNifFile.js';
import { writeNifBytes } from '../formats/morrowind/mwNifWrite.js';
import { SHEATHING_BONE, SHEATH_WEAPON_NODE, SHEATH_AMMO_NODE } from './weaponSheathing.js';

/** Where the addon lives in a data-files tree: the base skeleton's own animations folder, so every body takes it. */
export const SHEATHING_ADDON_PATH = 'animations/xbase_anim/dfo_sheathing.nif';
/** The scabbard file's own sheath node. */
export const SHEATH_NODE = 'Bip01 Sheath';
/** How many rounds a quiver of ours holds in view. */
export const QUIVER_SLOTS = 6;

const unit = (vec) => {
  const len = Math.hypot(vec[0], vec[1], vec[2]) || 1;
  return [vec[0] / len, vec[1] / len, vec[2] / len];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (vec, k) => [vec[0] * k, vec[1] * k, vec[2] * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** A weapon frame in the body's axes (right, forward, up): `y` along the weapon (grip to tip or head), `z` square to
 *  it toward `n`, `x` their cross. */
function frame(y, n) {
  const along = unit(y);
  const square = unit(add(n, scale(along, -dot(n, along))));
  return { x: cross(along, square), y: along, z: square };
}

/** The belt's height over the pelvis bone: the hook the waist lantern hangs from (combat/fpArm.js HIP_LANTERN_HOOK). */
export const BELT = 9.5;

/**
 * Our own points, in the body's axes as it stands in the bind (right, forward, up; units from the parent bone's
 * origin), and the weapon's frame there. The rule: a one-handed weapon hangs from the belt at the hip, a two-handed
 * one and a bow across the back, a crossbow at the small of the back, its prod across. Blades hang hilt up and
 * forward on the left hip, for the right hand's draw; a haft stands head up through its ring; a greatsword's hilt
 * rises over the left shoulder, a staff's or a spear's head over the right, an axe's and a maul's over the left.
 */
export const SHEATH_POINTS = Object.freeze({
  'Bip01 ShortBladeOneHand': { parent: 'Bip01 Pelvis', at: [-8.5, 5, BELT - 0.5], ...frame([0.1, -0.2, -0.97], [-1, 0, 0]) },
  'Bip01 LongBladeOneHand': { parent: 'Bip01 Pelvis', at: [-10.5, 2, BELT], ...frame([0, -0.45, -0.89], [-1, 0, 0]) },
  'Bip01 BluntOneHand': { parent: 'Bip01 Pelvis', at: [-10.5, -3, BELT], ...frame([0, 0.15, 0.99], [-1, 0, 0]) },
  'Bip01 MarksmanThrown': { parent: 'Bip01 Pelvis', at: [10.5, -3, BELT - 0.5], ...frame([0, 0, -1], [1, 0, 0]) },
  'Bip01 MarksmanCrossbow': { parent: 'Bip01 Pelvis', at: [0, -8, 6], ...frame([0, 0.1, 0.99], [0, -1, 0]) },
  'Bip01 LongBladeTwoClose': { parent: 'Bip01 Spine2', at: [-4, -7.5, -4], ...frame([0.45, 0, -0.89], [0, -1, 0]) },
  'Bip01 AxeTwoClose': { parent: 'Bip01 Spine2', at: [-3, -7.5, -6], ...frame([-0.4, 0, 0.92], [0, -1, 0]) },
  'Bip01 BluntTwoClose': { parent: 'Bip01 Spine2', at: [-3, -7.5, -6], ...frame([-0.4, 0, 0.92], [0, -1, 0]) },
  'Bip01 BluntTwoWide': { parent: 'Bip01 Spine2', at: [3, -7.5, -6], ...frame([0.4, 0, 0.92], [0, -1, 0]) },
  'Bip01 SpearTwoWide': { parent: 'Bip01 Spine2', at: [3, -7.5, -6], ...frame([0.3, 0, 0.95], [0, -1, 0]) },
  'Bip01 MarksmanBow': { parent: 'Bip01 Spine2', at: [0, -7, -2], ...frame([-0.4, 0, 0.92], [0, -1, 0]) },
});

/** The game's spine bones run x up, y forward, z left - the body's (right, forward, up) in a parent's own axes. */
const toParent = (vec) => [vec[2], vec[1], -vec[0]];

/** Our bone addon: a root, each parent by name, each point a marked node under it (the injector's shape). */
export function sheathingAddonRecords() {
  const records = /** @type {any[]} */ ([{ type: 'NiNode', name: 'dfo_sheathing', children: [] }]);
  const parents = new Map();
  for (const [name, point] of Object.entries(SHEATH_POINTS)) {
    if (!parents.has(point.parent)) {
      parents.set(point.parent, records.length);
      records[0].children.push(records.length);
      records.push({ type: 'NiNode', name: point.parent, children: [] });
    }
    const [x, y, z] = [point.x, point.y, point.z].map(toParent);
    records[parents.get(point.parent)].children.push(records.length);
    records.push({
      type: 'NiNode',
      name,
      translation: toParent(point.at),
      rotation: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]],
      scale: 1,
      children: [],
      extra: records.length + 1,
    });
    records.push({ type: 'NiStringExtraData', string: 'BONE' });
  }
  return records;
}

let _addon = null;
/** The addon's NIF bytes, written once. */
export const sheathingAddonBytes = () => (_addon ??= writeNifBytes(sheathingAddonRecords(), [0]));

// ---- the scabbards ----------------------------------------------------------------------------------------------

/** Each weapon type's kind of scabbard, or none (a thrown weapon stacks). */
export const SCABBARD_KIND = Object.freeze({
  [MW_WEAPON_TYPE.ShortBladeOneHand]: 'sheath',
  [MW_WEAPON_TYPE.LongBladeOneHand]: 'sheath',
  [MW_WEAPON_TYPE.LongBladeTwoHand]: 'sheath',
  [MW_WEAPON_TYPE.AxeOneHand]: 'ring',
  [MW_WEAPON_TYPE.AxeTwoHand]: 'ring',
  [MW_WEAPON_TYPE.BluntOneHand]: 'ring',
  [MW_WEAPON_TYPE.BluntTwoClose]: 'ring',
  [MW_WEAPON_TYPE.BluntTwoWide]: 'ring',
  [MW_WEAPON_TYPE.SpearTwoWide]: 'ring',
  [MW_WEAPON_TYPE.MarksmanBow]: 'quiver',
  [MW_WEAPON_TYPE.MarksmanCrossbow]: 'quiver',
});

/** Our paints, as a material's diffuse: the leather, its darker edge, the fittings. */
export const SCABBARD_PAINT = Object.freeze({
  leather: Object.freeze([0.36, 0.22, 0.12]),
  edge: Object.freeze([0.24, 0.14, 0.08]),
  fitting: Object.freeze([0.56, 0.54, 0.5]),
});

/** A weapon mesh's extent, read off its own geometry (as the holster instances it: no BoneOffset). Each slice of its
 *  length along y holds the widest x and z the mesh reaches there, and `top` the highest y a vertex of it stands at. */
export function weaponExtent(weaponBytes, slices = 16, parse = parseNif) {
  const pts = [];
  for (const b of flattenNif(parse(weaponBytes))) {
    for (let i = 0; i + 2 < b.positions.length; i += 3) pts.push([b.positions[i], b.positions[i + 1], b.positions[i + 2]]);
  }
  if (!pts.length) return null;
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((vertex) => vertex[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((vertex) => vertex[k])));
  const len = hi[1] - lo[1] || 1;
  const width = Array.from({ length: slices }, () => [0, 0]);
  const top = Array.from({ length: slices }, (_, slot) => lo[1] + (slot * len) / slices);
  for (const vertex of pts) {
    const slot = Math.min(slices - 1, Math.floor(((vertex[1] - lo[1]) / len) * slices));
    width[slot][0] = Math.max(width[slot][0], Math.abs(vertex[0]));
    width[slot][1] = Math.max(width[slot][1], Math.abs(vertex[2]));
    top[slot] = Math.max(top[slot], vertex[1]);
  }
  return { lo, hi, width, top, slice: len / slices };
}

/** A tapered box along y from y0 to y1, half-sizes (x0, z0) to (x1, z1), about the line (cx, *, cz): flat faces. */
function taper(y0, y1, x0, z0, x1, z1, midX = 0, midZ = 0) {
  const corners = [
    [midX - x0, y0, midZ - z0], [midX + x0, y0, midZ - z0], [midX + x0, y0, midZ + z0], [midX - x0, y0, midZ + z0],
    [midX - x1, y1, midZ - z1], [midX + x1, y1, midZ - z1], [midX + x1, y1, midZ + z1], [midX - x1, y1, midZ + z1],
  ];
  return quads(corners, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]);
}

/** An n-sided tube along `axis` from `base`, radius r, length h, closed at its foot. */
function tube(base, axis, radius, height, n = 8) {
  const a = unit(axis);
  const across = unit(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const side = cross(a, across);
  const ring = (k, off) => Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2;
    return add(add(base, scale(a, off)), add(scale(across, Math.cos(angle) * radius * k), scale(side, Math.sin(angle) * radius * k)));
  });
  const corners = [...ring(0.85, 0), ...ring(1, height), base];
  const faces = [];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i], [2 * n, (i + 1) % n, i]);
  return quads(corners, faces);
}

/** Corners and faces (quads or triangles, wound outward) to flat-shaded positions, normals and indices. */
function quads(corners, faces) {
  const positions = [], normals = [], indices = [];
  for (const face of faces) {
    const points = face.map((i) => corners[i]);
    const nrm = unit(cross(add(points[1], scale(points[0], -1)), add(points[2], scale(points[0], -1))));
    const at = positions.length / 3;
    for (const corner of points) {
      positions.push(...corner);
      normals.push(...nrm);
    }
    for (let k = 1; k + 1 < points.length; k++) indices.push(at, at + k, at + k + 1);
  }
  return { positions, normals, indices };
}

const join = (...meshes) => {
  const out = { positions: [], normals: [], indices: [] };
  for (const mesh of meshes) {
    const at = out.positions.length / 3;
    out.positions.push(...mesh.positions);
    out.normals.push(...mesh.normals);
    out.indices.push(...mesh.indices.map((i) => i + at));
  }
  return out;
};

/** A sheath reads its blade in fine slices, so its mouth sits on the guard's own top; a guard is this deep at most. */
const SHEATH_SLICES = 48;
const GUARD_DEPTH = 3;

/** A blade's sheath, sized to the blade: from the guard's top (the widest slice in the grip's half, and any slice as
 *  wide just over it) to past the tip, narrowing toward it no faster than the blade does. */
function sheathShapes(ext) {
  const across = (w) => Math.max(w[0], w[1]);
  const guardSlice = ext.width.slice(0, Math.ceil(ext.width.length / 2)).reduce((best, w, i, all) => (across(w) > across(all[best]) ? i : best), 0);
  let guardEnd = guardSlice;
  for (let i = guardSlice + 1; i < ext.width.length && (i - guardSlice) * ext.slice <= GUARD_DEPTH; i++)
    if (across(ext.width[i]) >= 0.7 * across(ext.width[guardSlice])) guardEnd = i;
  const mouth = ext.top[guardEnd];
  const blade = ext.width.slice(guardEnd + 1);
  const halfX = Math.max(0.6, ...blade.map((w) => w[0])) + 0.35;
  const halfZ = Math.max(0.3, ...blade.map((w) => w[1])) + 0.35;
  const len = Math.max(2, ext.hi[1] - mouth) + 0.6;
  // the tip's half sizes: the taper's own share, or what keeps every slice of the blade inside it
  const tipOf = (half, k, share) =>
    blade.reduce((tip, w, i) => Math.max(tip, half - (half - w[k] - 0.35) / Math.min(1, ((i + 1) * ext.slice) / len)), half * share);
  const [tipX, tipZ] = [tipOf(halfX, 0, 0.55), tipOf(halfZ, 1, 0.8)];
  return {
    offset: mouth,
    shapes: [
      { paint: 'leather', mesh: taper(0, len, halfX, halfZ, tipX, tipZ) },
      { paint: 'fitting', mesh: join(taper(-0.3, 1.6, halfX + 0.25, halfZ + 0.25, halfX + 0.2, halfZ + 0.2), taper(len - 2.4, len + 0.3, tipX * 1.13, tipZ * 1.1, tipX * 0.9, tipZ * 0.875)) },
    ],
  };
}

/** A haft's ring and the strap that holds it to the belt or the back, round the haft at its middle. */
function ringShapes(ext) {
  const at = ext.lo[1] + (ext.hi[1] - ext.lo[1]) * 0.45;
  const slot = Math.floor((at - ext.lo[1]) / ext.slice);
  const w = ext.width[Math.max(0, Math.min(ext.width.length - 1, slot))];
  const ringX = Math.max(0.5, Math.min(w[0], 2)) + 0.3, ringZ = Math.max(0.5, Math.min(w[1], 2)) + 0.3, b = 0.35;
  const ring = join(
    taper(-0.6, 0.6, b, ringZ + b, b, ringZ + b, -ringX - b),
    taper(-0.6, 0.6, b, ringZ + b, b, ringZ + b, ringX + b),
    taper(-0.6, 0.6, ringX, b, ringX, b, 0, -ringZ - b),
    taper(-0.6, 0.6, ringX, b, ringX, b, 0, ringZ + b),
  );
  return { offset: at, shapes: [{ paint: 'edge', mesh: ring }, { paint: 'leather', mesh: taper(-0.5, 0.5, 0.9, 0.25, 0.9, 0.25, 0, -ringZ - 1.4) }] };
}

/** A quiver beside the bow or the crossbow, in the weapon's own frame: its axis and its mouth, and the rounds'. */
/** Where each quiver hangs against its weapon, in the body's axes: the bow's on the back beside it, its mouth over the
 *  right shoulder; the crossbow's on the belt beside it, its mouth up. `at` is a share of the quiver's length down. */
const QUIVER_AT = Object.freeze({
  'Bip01 MarksmanBow': { at: [5, -1.5, -0.55], axis: [0.25, 0, 0.97] },
  'Bip01 MarksmanCrossbow': { at: [3, 1, -0.6], axis: [0, -0.1, 0.99] },
});

function quiverShapes(point, ext, bone) {
  const toBone = (vec) => [dot(vec, point.x), dot(vec, point.y), dot(vec, point.z)];
  const len = Math.max(14, Math.min(32, (ext.hi[1] - ext.lo[1]) * 0.42));
  const place = QUIVER_AT[bone];
  const axis = toBone(unit(place.axis));
  const base = toBone([place.at[0], place.at[1], place.at[2] * len]);
  const mouth = add(base, scale(axis, len));
  const radius = 2.4;
  const across = unit(cross(axis, Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const side = cross(axis, across);
  const slots = Array.from({ length: QUIVER_SLOTS }, (_, i) => {
    const angle = (i / QUIVER_SLOTS) * Math.PI * 2;
    const at = add(add(mouth, scale(axis, 3)), add(scale(across, Math.cos(angle) * radius * 0.5), scale(side, Math.sin(angle) * radius * 0.5)));
    const y = scale(axis, -1);
    const z = unit(cross(across, y));
    const x = cross(y, z);
    return { at, rotation: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]] };
  });
  return {
    offset: 0,
    shapes: [
      { paint: 'leather', mesh: tube(base, axis, radius, len) },
      { paint: 'fitting', mesh: tube(add(base, scale(axis, len - 1.2)), axis, radius + 0.25, 1.2) },
    ],
    slots,
  };
}

/**
 * Our scabbard for a weapon of `mwType`, as `_sh` NIF bytes - or null where its type takes none (a thrown weapon
 * stacks) or its mesh will not read. `weaponBytes` is the weapon's own mesh, which sizes it; `parseNif` the caller's
 * parse (its memo). One weapon's bytes answer the same scabbard bytes every time, so a body built again parses
 * nothing new.
 */
const _built = new WeakMap(); // weapon bytes -> Map(mwType -> scabbard bytes | null)
export function ownScabbardBytes({ mwType, weaponBytes, parseNif: parse = parseNif }) {
  if (!weaponBytes || typeof weaponBytes !== 'object') return null;
  if (!_built.has(weaponBytes)) _built.set(weaponBytes, new Map());
  const memo = _built.get(weaponBytes);
  if (!memo.has(mwType)) memo.set(mwType, buildScabbard(mwType, weaponBytes, parse));
  return memo.get(mwType);
}

function buildScabbard(mwType, weaponBytes, parse) {
  const kind = SCABBARD_KIND[mwType];
  const point = SHEATH_POINTS[SHEATHING_BONE[mwType]];
  if (!kind || !point) return null;
  let ext;
  try {
    ext = weaponExtent(weaponBytes, kind === 'sheath' ? SHEATH_SLICES : 16, parse);
  } catch {
    return null;
  }
  if (!ext) return null;
  const made = kind === 'sheath' ? sheathShapes(ext) : kind === 'ring' ? ringShapes(ext) : quiverShapes(point, ext, SHEATHING_BONE[mwType]);
  const records = /** @type {any[]} */ ([{ type: 'NiNode', name: `dfo_${kind}`, children: [1, 2] }]);
  records.push({ type: 'NiNode', name: SHEATH_NODE, children: [] });
  records.push({ type: 'NiNode', name: SHEATH_WEAPON_NODE, translation: [0, -made.offset, 0], children: [] });
  for (const piece of made.shapes) {
    records[1].children.push(records.length);
    const at = records.length;
    records.push(
      { type: 'NiTriShape', name: '', data: at + 1, properties: [at + 2, at + 3] },
      { type: 'NiTriShapeData', positions: piece.mesh.positions, normals: piece.mesh.normals, uvs: null, indices: piece.mesh.indices },
      { type: 'NiMaterialProperty', name: `dfo_${piece.paint}`, ambient: SCABBARD_PAINT[piece.paint], diffuse: SCABBARD_PAINT[piece.paint] },
      { type: 'NiStencilProperty', drawMode: 3 }, // both sides, as every part of ours is drawn
    );
  }
  if (made.slots) {
    records[0].children.push(records.length);
    const ammo = { type: 'NiNode', name: SHEATH_AMMO_NODE, children: /** @type {number[]} */ ([]) };
    records.push(ammo);
    made.slots.forEach((slot, i) => {
      ammo.children.push(records.length);
      records.push({ type: 'NiNode', name: `${SHEATH_AMMO_NODE} ${i}`, translation: slot.at, rotation: slot.rotation, children: [] });
    });
  }
  return writeNifBytes(records, [0]);
}
