// THE CHEST, BAKED OUT OF ITS FBX.
//
//     node tools/bakeChest.mjs [--fbx=src/assets/chest/source/Low_Poly_Chest_Mimic.fbx]
//
// CHEST3D (2026-10-31, the owner, sending Low_Poly_Chest_Mimic.fbx: "I want to implement this and ensure any chests use
// this. Texture it with daggerfall textures"). A Blender export of four objects - Chest_Small_Base, _Top (the lid),
// _Hinge and _Latch - each parented rigidly to a bone of one Armature (no skin), and one action, the mimic's hop: the
// lid's bone (Bone.002) turns 77 degrees open, the latch's (Bone.003) 33 more, the root hops and squashes, over 3.4 s.
// No material and no picture: each object one flat vertex colour. world/chestModel.js lays Daggerfall's own pictures
// on it; this bake hands it the shape twice, shut (the rest pose) and open (the lid's widest key, the latch's there).
//
// THE FRAME, the game's: metres at the scene's own scale (world/chestModel.js fits each chest to the box it stands for),
// +y up, +z the chest's front (the latch side - Daggerfall's furniture faces +z), x along it, the origin on the floor
// under the base's middle. Blender's (Z up, the latch toward +X, the length along Y) turned so: x = -Y, y = Z, z = X -
// a mirror, as the world is left-handed. Every triangle is wound so cross(b - a, c - a) is its outside
// (world/merchantYards/merchantYardModels.js faces' law), its normal that, flat.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { readFbx, nodeAt, childNamed, objectName, property70 } from './fbxRead.mjs';
import { eulerXYZ, sceneFrame, polygonsOf, blenderTessellate } from './fbxMesh.mjs';
import { ROOT, sourcePath } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE_FBX = 'src/assets/chest/source/Low_Poly_Chest_Mimic.fbx';
export const OUT_JSON = 'src/assets/chest/chest.json';
/** Each part's object, and the bones that turn when the chest opens. */
export const CHEST_PARTS = Object.freeze({ base: 'Chest_Small_Base', lid: 'Chest_Small_Top', hinge: 'Chest_Small_Hinge', latch: 'Chest_Small_Latch' });
export const LID_BONE = 'Bone.002';
export const LATCH_BONE = 'Bone.003';

const TICKS_S = 46186158000;   // FBX's KTime: ticks a second
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** 3x4 affine matrices, row-major: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz]. */
const mul = (a, b) => {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
    o[r * 4 + 3] = a[r * 4] * b[3] + a[r * 4 + 1] * b[7] + a[r * 4 + 2] * b[11] + a[r * 4 + 3];
  }
  return o;
};
const apply = (m, v) => [0, 1, 2].map((r) => m[r * 4] * v[0] + m[r * 4 + 1] * v[1] + m[r * 4 + 2] * v[2] + m[r * 4 + 3]);
const turn = (m, v) => [0, 1, 2].map((r) => m[r * 4] * v[0] + m[r * 4 + 1] * v[1] + m[r * 4 + 2] * v[2]);

/** An object's Lcl T*R*S, its rotation `rot` where one is given (a posed bone's). */
function localOf(o, rot = null) {
  const t = (property70(o, 'Lcl Translation') ?? [0, 0, 0]).map(Number);
  const r = (rot ?? property70(o, 'Lcl Rotation') ?? [0, 0, 0]).map(Number);
  const s = (property70(o, 'Lcl Scaling') ?? [1, 1, 1]).map(Number);
  const m = eulerXYZ(r);
  return [m[0] * s[0], m[1] * s[1], m[2] * s[2], t[0], m[3] * s[0], m[4] * s[1], m[5] * s[2], t[1], m[6] * s[0], m[7] * s[1], m[8] * s[2], t[2]];
}

/** The scene's objects by id and name, and each one's parent. */
function sceneOf(tree) {
  const objects = nodeAt(tree.nodes, 'Objects').children;
  const byId = new Map(objects.map((o) => [String(o.props[0]), o]));
  const links = nodeAt(tree.nodes, 'Connections').children.map((c) => c.props.map((x) => String(x)));
  const parentOf = (id) => links.find((c) => c[0] === 'OO' && c[1] === id)?.[2] ?? '0';
  const model = (name) => objects.find((o) => o.name === 'Model' && objectName(o.props[1]) === name) ?? null;
  return { objects, byId, links, parentOf, model };
}

/** A curve node's Z key values and times (seconds) on bone `name`'s Lcl Rotation. */
function rotationZKeys(scene, name) {
  const bone = scene.model(name);
  if (!bone) throw new Error(`the scene has no ${name}`);
  const id = String(bone.props[0]);
  const node = scene.links.find((c) => c[0] === 'OP' && c[2] === id && c[3] === 'Lcl Rotation');
  if (!node) throw new Error(`${name} has no rotation curves - re-export the action with the armature`);
  const z = scene.links.find((c) => c[0] === 'OP' && c[2] === node[1] && c[3] === 'd|Z');
  const curve = scene.byId.get(z?.[1]);
  if (!curve) throw new Error(`${name}'s rotation has no Z curve`);
  const times = childNamed(curve, 'KeyTime').props[0].map((t) => Number(t) / TICKS_S);
  const values = [...childNamed(curve, 'KeyValueFloat').props[0]].map(Number);
  return { times, values };
}
/** The value of keys at `t`, linear between them. */
function keyAt({ times, values }, t) {
  if (t <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++) if (t <= times[i]) { const f = (t - times[i - 1]) / ((times[i] - times[i - 1]) || 1); return values[i - 1] + (values[i] - values[i - 1]) * f; }
  return values[values.length - 1];
}

/** THE OPEN POSE: the lid's widest key, and the latch's rotation at that instant. */
export function openPose(tree) {
  const scene = sceneOf(tree);
  const lid = rotationZKeys(scene, LID_BONE), latch = rotationZKeys(scene, LATCH_BONE);
  const rest = (n) => (property70(scene.model(n), 'Lcl Rotation') ?? [0, 0, 0]).map(Number);
  const lidRest = rest(LID_BONE), latchRest = rest(LATCH_BONE);
  let at = 0;
  for (let i = 1; i < lid.values.length; i++) if (Math.abs(lid.values[i] - lidRest[2]) > Math.abs(lid.values[at] - lidRest[2])) at = i;
  const t = lid.times[at];
  return {
    t, lid: [lidRest[0], lidRest[1], lid.values[at]], latch: [latchRest[0], latchRest[1], keyAt(latch, t)],
    lidDeg: lid.values[at] - lidRest[2], latchDeg: keyAt(latch, t) - latchRest[2],
  };
}

/** Blender's scene (metres, Z up) to the chest's frame: x = -Y, y = Z, z = X. */
const toChest = ([x, y, z]) => [-y, z, x];

/** One part's triangles in the scene's metres (Z up), each with its outward normal, at the pose `rots` (bone name ->
 *  Lcl Rotation). */
function partTriangles(tree, scene, name, rots) {
  const model = scene.model(name);
  if (!model) throw new Error(`the scene has no ${name}`);
  const gid = scene.links.find((c) => c[0] === 'OO' && c[2] === String(model.props[0]) && scene.byId.get(c[1])?.name === 'Geometry')?.[1];
  const geo = scene.byId.get(gid);
  if (!geo) throw new Error(`${name} has no mesh`);
  const sf = sceneFrame(tree).m;
  const SF = [sf[0], sf[1], sf[2], 0, sf[3], sf[4], sf[5], 0, sf[6], sf[7], sf[8], 0];
  const world = (id) => {
    const o = scene.byId.get(id);
    const l = localOf(o, rots[objectName(o.props[1])] ?? null);
    const p = scene.parentOf(id);
    return p === '0' ? mul(SF, l) : mul(world(p), l);
  };
  const W = world(String(model.props[0]));
  const v = childNamed(geo, 'Vertices').props[0];
  const at = (i) => apply(W, [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]);
  const tris = [];
  for (const poly of polygonsOf(childNamed(geo, 'PolygonVertexIndex').props[0])) {
    const pts = poly.map(at);
    // the polygon's outside: its corners' winding as Blender wrote them (Newell's), in the scene's right-handed frame
    const n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    for (const [a, b, c] of blenderTessellate(pts)) tris.push({ p: [pts[a], pts[b], pts[c]], out: unit(n) });
  }
  return tris;
}

/**
 * The bake: the FBX's bytes in, `{ parts, open, ... }` out - each part's triangles in the chest's frame (a flat list of
 * corner coordinates, and a normal a triangle), the shut chest's parts and the open one's lid, hinge and latch. Pure.
 */
export function bakeChest(fbxBytes, tree = readFbx(fbxBytes), source = SOURCE_FBX) {
  const scene = sceneOf(tree);
  const pose = openPose(tree);
  const shut = Object.fromEntries(Object.entries(CHEST_PARTS).map(([k, n]) => [k, partTriangles(tree, scene, n, {})]));
  const opened = Object.fromEntries(['lid', 'hinge', 'latch'].map((k) => [k, partTriangles(tree, scene, CHEST_PARTS[k], { [LID_BONE]: pose.lid, [LATCH_BONE]: pose.latch })]));
  // the origin: the floor under the base's middle, in the chest's frame
  const base = shut.base.flatMap((t) => t.p.map(toChest));
  const lo = [0, 1, 2].map((k) => Math.min(...base.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...base.map((p) => p[k])));
  const origin = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  const lay = (tris) => {
    const positions = [], normals = [];
    for (const t of tris) {
      let [a, b, c] = t.p.map((p) => sub(toChest(p), origin));
      const out = unit(toChest(t.out));
      if (dot(cross(sub(b, a), sub(c, a)), out) < 0) [b, c] = [c, b];
      const n = unit(cross(sub(b, a), sub(c, a)));
      positions.push(...a.map(r4), ...b.map(r4), ...c.map(r4));
      normals.push(...n.map(r4));
    }
    return { positions, normals };
  };
  const parts = Object.fromEntries(Object.entries(shut).map(([k, t]) => [k, lay(t)]));
  const open = Object.fromEntries(Object.entries(opened).map(([k, t]) => [k, lay(t)]));
  const all = Object.values(parts).flatMap((p) => p.positions);
  const size = [0, 1, 2].map((k) => { const vs = all.filter((_, i) => i % 3 === k); return r4(Math.max(...vs) - Math.min(...vs)); });
  return {
    bake: 'tools/bakeChest.mjs', source, sha256: createHash('sha256').update(fbxBytes).digest('hex'),
    creator: childNamed(tree.nodes, 'Creator')?.props[0] ?? null,
    frame: 'metres at the scene\'s scale; +y up, +z the front (the latch), x along the chest; the origin on the floor under the base\'s middle',
    size, lidOpenDeg: r4(pose.lidDeg), latchOpenDeg: r4(pose.latchDeg), openAtS: r4(pose.t),
    parts, open,
  };
}

/** The JSON as written: the head pretty, each part's arrays on a line of their own. */
export function chestJson(baked) {
  const { parts, open, ...head } = baked;
  const block = (o) => Object.entries(o).map(([k, p]) => `    ${JSON.stringify(k)}: { "positions": ${JSON.stringify(p.positions)}, "normals": ${JSON.stringify(p.normals)} }`).join(',\n');
  return `${JSON.stringify(head, null, 2).replace(/\n}$/, '')},\n  "parts": {\n${block(parts)}\n  },\n  "open": {\n${block(open)}\n  }\n}\n`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const fbx = resolve(args.find((a) => a.startsWith('--fbx='))?.slice(6) ?? resolve(ROOT, SOURCE_FBX));
  const bytes = readFileSync(fbx);
  const baked = bakeChest(bytes, readFbx(bytes), sourcePath(fbx));
  const out = resolve(ROOT, OUT_JSON);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, chestJson(baked));
  console.log(`${fbx} -> ${out}`);
  for (const [k, p] of Object.entries(baked.parts)) console.log(`  ${k.padEnd(6)} ${String(p.normals.length / 3).padStart(3)} triangles`);
  console.log(`  size ${baked.size.join(' x ')} m; the lid opens ${baked.lidOpenDeg} degrees, the latch ${baked.latchOpenDeg} more`);
}
