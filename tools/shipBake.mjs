// THE BAKE FOR A SCENE OF PARTS - one ship of Mac's Blender scene into the boat's frame.
//
// SHIPS-2 (2026-10-07, Mac, sending Tiny_Ship.fbx, New_Ship_2.fbx and New_Ship_2_Shutter.fbx: "implement both of these
// new ship placement models, UV Map/Texture, and ensure it matches the love we gave the other new ship model we
// implemented"): the galleon's bake (tools/bakeGalleon.mjs, GALLEON and its two audits) made the home of every ship's.
// Mac builds his ships as a scene of parts - a hull, decks, masts, a hatch cover, a shutter, each its own object - and
// keeps working stations of them along the scene's Y: the bake reads ONE ship of it, by a SPEC (`bakeScene`):
//
//   frame  where the ship stands in the scene and how it is taken into the boat's (scale, waterline, midship,
//          centreline - `toBoat`);
//   roles  each object of hers by name, the role it plays aboard and the scene box it was read standing in;
//   skip   every other object of the scene, each said for what it is and checked to be it - a `twin` (a Shift+D copy
//          standing in a part's own place), a station beyond a scene Y (`minY`), an object standing wholly outside
//          her own band of the scene (`band`, another ship's), or an object with no faces (`empty`) - so a part of hers
//          is never dropped by its name;
//   hull   the role whose object IS the boat's frame (its origin her centreline), and `cut`, what of it is cut off as
//          its own part (the galleon's rudder).
//
// tools/fbxRead.mjs is the reader and tools/fbxMesh.mjs's helpers do the polygon work. The bake does three things and
// nothing else, and leaves everything that is art (which face wears which texture, how a texture lies on it, what a
// part is hung from) to the ship's model module, where a test can read it:
//
// 1. EACH OBJECT INTO THE BOAT'S FRAME. A Blender export carries its axis conversion on every object (Lcl Rotation -90
//    about X, Lcl Scaling 100, UnitScaleFactor 1 - centimetres), so the object's own T*R*S is applied and the file's
//    GlobalSettings (`sceneFrame`) take the result back to Mac's Z-up scene in metres, where a ship's bow is +X and her
//    port side +Y. Come Sail Away's hulls - and so the port's boats - stand in Unity's frame: +x starboard, +y up, +z the
//    bow, the root on the waterline (systems/naval/navalShips.js's header). So a scene point (X, Y, Z) is the boat's
//    ( CENTRELINE - Y, Z - WATERLINE, X - MIDSHIP ) times SCALE: a mirror, which is why every polygon's corners are
//    REVERSED on the way through - Blender's front is counter-clockwise in a right-handed frame and the port's is
//    clockwise in Unity's (renderer.js frontFace(CW)), so the reversal keeps each face's front its front.
//
//    AUDIT GN-B5: WHAT IT CANNOT READ, IT REFUSES BY NAME - never bakes wrong: a file whose GlobalSettings are not
//    Blender's FBX axes (EXPORT_AXES), an object parented under another, one carrying a pre/post rotation, a pivot, a
//    rotation or scaling OFFSET or a geometric transform (the bake reads T*R*S only), one MIRRORED by its own transform
//    (a negative determinant: every face of it would bake inside out), and one not standing where it was read (the
//    spec's role boxes, BOX_SLACK out in any coordinate).
//
// 2. EACH POLYGON CUT INTO TRIANGLES AS BLENDER CUTS IT (AUDIT GN-B1): tools/fbxMesh.mjs blenderTessellate, Blender
//    5.1's own tessellation ported - and an export any other Blender wrote is refused by name (assertBlenderFill: its
//    fill may not be the port's) - on each polygon as Blender holds it (the mesh's own coordinates, its corners in their
//    own order), the triangles then carried through the mirror as the polygon is. A polygon its triangles do not TILE
//    is refused by object and number, never patched (tools/fbxMesh.mjs tilingFault), so the bake makes no point and no
//    triangle of its own. The polygons are kept as well, since a face's texture is chosen per polygon.
//
// 3. WHAT THE SPEC CUTS OFF THE HULL (`cut`) as parts of their own - the galleon's rudder, modelled into her hull's
//    mesh, turns.
//
// The output is a JSON a test re-bakes byte for byte (`bakeJson`): the source is committed beside it, so the file is a
// DERIVATION, never a blob.
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFbx, nodeAt, childNamed, childrenNamed, property70, objectName } from './fbxRead.mjs';
import { eulerXYZ, polygonsOf, sceneFrame, blenderTessellate, blenderProject, tilingFault, BLENDER_FILL } from './fbxMesh.mjs';

/** AUDIT GN-B5: the axes this export was written in (Blender's FBX default: Y up, Z front, X right - all positive),
 *  read off its GlobalSettings. tools/fbxMesh.mjs sceneFrame reads the up and coord axes; the front axis it never asks
 *  is what makes the frame right-handed, so a file written in any other axes is refused, never re-derived. */
export const EXPORT_AXES = Object.freeze({ UpAxis: 1, UpAxisSign: 1, FrontAxis: 2, FrontAxisSign: 1, CoordAxis: 0, CoordAxisSign: 1 });

/** AUDIT GN-B5: how far (m, any coordinate of the box) an object may stand from where its role was read. */
export const BOX_SLACK = 0.02;

/** A coordinate to 0.1 mm, as the file holds it. AUDIT GN2-BK5: a half step away from nought both sides (Math.round
 *  alone takes 1.23465 up to 1.2347 and -1.23465 up to -1.2346), so a mirror pair bakes to the same |x|; + 0: never a
 *  -0 in the file. */
export const round4 = (v) => Math.sign(v) * Math.round(Math.abs(v) * 1e4) / 1e4 + 0;

/** A scene point (metres, Z up, bow +X) in the boat's frame: `frame` the ship's (scale, waterline, midship,
 *  centreline). */
export function toBoat([x, y, z], frame) {
  return [(frame.centreline - y) * frame.scale, (z - frame.waterline) * frame.scale, (x - frame.midship) * frame.scale];
}

/** AUDIT GN-B5: the transform properties T*R*S does not carry, each at the value that leaves it out. Blender writes
 *  none of them; a file that does was authored with a pivot or an offset the bake would silently drop. */
const UNREAD_TRANSFORM = Object.freeze([
  ['PreRotation', [0, 0, 0]], ['PostRotation', [0, 0, 0]], ['RotationOffset', [0, 0, 0]], ['RotationPivot', [0, 0, 0]],
  ['ScalingOffset', [0, 0, 0]], ['ScalingPivot', [0, 0, 0]],
  ['GeometricTranslation', [0, 0, 0]], ['GeometricRotation', [0, 0, 0]], ['GeometricScaling', [1, 1, 1]],
]);

/** AUDIT GN-B5: the file is in this export's axes (EXPORT_AXES), or the bake refuses it, naming what differs. */
function assertExportAxes(tree) {
  const gs = nodeAt(tree.nodes, 'GlobalSettings');
  if (!gs) throw new Error('no GlobalSettings in this FBX - the bake reads its axes there');
  for (const [key, want] of Object.entries(EXPORT_AXES)) {
    const got = property70(gs, key)?.[0];
    if (got === undefined || Number(got) !== want) {
      throw new Error(`GlobalSettings ${key} is ${got} where this export's is ${want} - the bake reads Blender's FBX axes (${Object.entries(EXPORT_AXES).map(([k, v]) => `${k} ${v}`).join(', ')}) and no other; export with Forward -Z, Up Y`);
    }
  }
}

/** AUDIT GN2-BK1: the file was written by the Blender whose fill tools/fbxMesh.mjs ports (BLENDER_FILL, 5.1.x) - its
 *  SceneInfo's Original and LastSaved application Blender's, their versions that one - or the bake refuses it, naming
 *  what wrote it: another Blender's fill may cut Mac's faces otherwise than the port does (5.0's did, two of hers). */
export function assertBlenderFill(tree) {
  const info = nodeAt(tree.nodes, 'FBXHeaderExtension', 'SceneInfo');
  if (!info) throw new Error('no SceneInfo in this FBX\'s header - the bake reads there which Blender wrote it');
  for (const at of ['Original', 'LastSaved']) {
    const name = String(property70(info, `${at}|ApplicationName`)?.[0] ?? '');
    if (!name.startsWith('Blender')) throw new Error(`this FBX was written by ${name || 'nothing named'} (SceneInfo ${at}|ApplicationName), not Blender - the bake cuts faces as Blender ${BLENDER_FILL} does`);
    const version = String(property70(info, `${at}|ApplicationVersion`)?.[0] ?? '');
    if (version !== BLENDER_FILL && !version.startsWith(`${BLENDER_FILL}.`)) {
      throw new Error(`this FBX was written by Blender ${version || '(no version)'} (SceneInfo ${at}|ApplicationVersion) - tools/fbxMesh.mjs cuts faces as Blender ${BLENDER_FILL} does, and another Blender's fill may cut them otherwise; export from Blender ${BLENDER_FILL}, or port that Blender's polyfill_2d.cc and say so in BLENDER_FILL`);
    }
  }
}

const det3 = (a) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);

/** AUDIT GN-B6: an Euler angle (degrees) within a microradian of a quarter turn IS that quarter turn. Blender's
 *  exporter writes its axis conversion (-90 about X) into every root object's rotation through single precision, and
 *  the noise is a float32 step or two: the hull's reads -90.0000093 (0.16 urad), which tilts her mirror plane enough
 *  that a vertex Mac mirrored exactly bakes 1.6 um off its pair - across the bake's last digit for five of them. No
 *  modelled rotation is a microradian off a quarter turn; nothing here moves more than 2.8 um (her main mast's head). */
const quarterTurn = (deg) => { const q = Math.round(deg / 90) * 90; return Math.abs(deg - q) * (Math.PI / 180) <= 1e-6 ? q : deg; };

/** Every Mesh model with its Geometry, materials and placement, from a parsed FBX: `local` its mesh's own vertices (as
 *  Blender holds them - AUDIT GN-B1 cuts its faces there), `scene` the same placed in Mac's scene, `origin` where its
 *  own origin stands in the scene (AUDIT GN-B6). GATE-FBX: `read` names the objects a bake will bake (every one, for a
 *  ship's); one it declines is placed for its box alone (`unread`, no polygons) - its faces are never baked, so their
 *  sense is never asked (the gate is one object of a scene of 1,905, and one of the others is mirrored). */
export function sceneObjects(tree, read = () => true) {
  const objects = nodeAt(tree.nodes, 'Objects');
  if (!objects) throw new Error('no Objects section in this FBX');
  assertExportAxes(tree);
  const byId = new Map(objects.children.map((o) => [String(o.props[0]), o]));
  const links = childrenNamed(nodeAt(tree.nodes, 'Connections'), 'C').map((c) => ({ kind: c.props[0], src: String(c.props[1]), dst: String(c.props[2]) }));
  const frame = sceneFrame(tree);
  const out = [];
  for (const model of childrenNamed(objects, 'Model')) {
    if (model.props[2] !== 'Mesh') continue;
    const id = String(model.props[0]);
    const name = objectName(model.props[1]);
    const parent = links.find((l) => l.kind === 'OO' && l.src === id);
    if (!parent || parent.dst !== '0') throw new Error(`${name} is parented under object ${parent?.dst} - the bake reads root objects only`);
    for (const [prop, identity] of UNREAD_TRANSFORM) {
      const v = property70(model, prop);
      if (v && v.some((x, i) => Math.abs(Number(x) - identity[i]) > 1e-9)) throw new Error(`${name} carries ${prop} ${JSON.stringify(v)} - the bake reads T*R*S only`);
    }
    if (Number(property70(model, 'RotationOrder')?.[0] ?? 0) !== 0) throw new Error(`${name}: rotation order is not XYZ Euler`);
    const geoLink = links.find((l) => l.kind === 'OO' && l.dst === id && byId.get(l.src)?.name === 'Geometry');
    const geo = geoLink ? byId.get(geoLink.src) : null;
    if (!geo) throw new Error(`${name} has no Geometry`);
    const materials = links.filter((l) => l.kind === 'OO' && l.dst === id && byId.get(l.src)?.name === 'Material').map((l) => objectName(byId.get(l.src).props[1]));
    const S = (property70(model, 'Lcl Scaling') ?? [1, 1, 1]).map(Number);
    const R = eulerXYZ((property70(model, 'Lcl Rotation') ?? [0, 0, 0]).map(Number).map(quarterTurn));
    const T = (property70(model, 'Lcl Translation') ?? [0, 0, 0]).map(Number);
    const m = frame.m;
    // the object's T*R*S into FBX world space, then the file's frame into the scene (metres, Z up)
    const place = (p) => {
      const s = [p[0] * S[0], p[1] * S[1], p[2] * S[2]];
      const w = [R[0] * s[0] + R[1] * s[1] + R[2] * s[2] + T[0], R[3] * s[0] + R[4] * s[1] + R[5] * s[2] + T[1], R[6] * s[0] + R[7] * s[1] + R[8] * s[2] + T[2]];
      return [m[0] * w[0] + m[1] * w[1] + m[2] * w[2], m[3] * w[0] + m[4] * w[1] + m[5] * w[2], m[6] * w[0] + m[7] * w[1] + m[8] * w[2]];
    };
    if (!read(name)) {
      const raw = childNamed(geo, 'Vertices')?.props[0] ?? [];
      const scene = [];
      for (let i = 0; i < raw.length; i += 3) scene.push(place([raw[i], raw[i + 1], raw[i + 2]]));
      out.push({ name, unread: true, local: [], scene, origin: place([0, 0, 0]), polygons: [], polyMaterial: [], materials });
      continue;
    }
    // AUDIT GN-B5: a transform that mirrors (a negative scale, an odd number of them) turns every face it carries
    // inside out - the bake's own mirror reverses each polygon's corners on the strength of the frame alone. The
    // determinant of the whole linear map, the file's frame times R times S, says so whatever the rotation.
    const det = det3([0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (m[r * 3] * R[c] + m[r * 3 + 1] * R[3 + c] + m[r * 3 + 2] * R[6 + c]) * S[c])));
    if (!(det > 0)) throw new Error(`${name}'s transform ${det < 0 ? 'mirrors it' : 'flattens it'} (scale ${JSON.stringify(S)}, determinant ${det.toPrecision(4)}) - ${det < 0 ? 'its faces would bake inside out' : 'it would bake flat'}; apply the scale in Blender (Ctrl+A) before exporting`);
    const raw = childNamed(geo, 'Vertices')?.props[0];
    const pvi = childNamed(geo, 'PolygonVertexIndex')?.props[0];
    if (!raw || !pvi) throw new Error(`${name}'s Geometry carries no Vertices/PolygonVertexIndex`);
    const local = [], scene = [];
    for (let i = 0; i < raw.length; i += 3) {
      local.push([raw[i], raw[i + 1], raw[i + 2]]);
      scene.push(place([raw[i], raw[i + 1], raw[i + 2]]));
    }
    const matLayer = childNamed(geo, 'LayerElementMaterial');
    const matIndex = matLayer ? childNamed(matLayer, 'Materials')?.props[0] : null;
    const matMap = matLayer ? childNamed(matLayer, 'MappingInformationType')?.props[0] : null;
    const polygons = polygonsOf(pvi);
    const polyMaterial = polygons.map((_, k) => (matIndex ? (matMap === 'AllSame' ? matIndex[0] : matIndex[k]) : -1));
    out.push({ name, local, scene, origin: place([0, 0, 0]), polygons, polyMaterial, materials });
  }
  return out;
}

/**
 * AUDIT GN-B1: POLYGON `k` OF AN OBJECT CUT AS BLENDER CUTS IT, OR REFUSED. Its corners as Blender holds them - the
 * mesh's own coordinates, in the polygon's own order - through tools/fbxMesh.mjs blenderTessellate; then the cut is
 * held to its face (tilingFault: in the plane the fill worked in, each triangle's area judged on its corners in 3D,
 * so one standing edge-on to the face is caught too), and a polygon it does not tile is refused, naming the object
 * and the polygon, never patched - no point made along an edge, no fill of the bake's own. Returns corner-index
 * triples, each wound as the polygon is.
 */
export function fillFace(object, k) {
  const poly = object.polygons[k];
  if (poly.length < 3) throw new Error(`${object.name} polygon #${k}: ${poly.length} corners is not a face`);
  const corners = poly.map((vi) => object.local[vi]);
  const tris = blenderTessellate(corners);
  const fault = tilingFault(blenderProject(corners), tris, corners);
  if (fault) throw new Error(`${object.name} polygon #${k} (${poly.length} corners): Blender's cut does not tile it - ${fault}. Fix the face in Blender before exporting.`);
  return tris;
}

/** GALLEON-2: whether two objects are one shape - the same faces on the same corners, each within a micrometre. */
export function sameShape(a, b) {
  if (a.scene.length !== b.scene.length || a.polygons.length !== b.polygons.length) return false;
  if (!a.scene.every((p, i) => p.every((v, k) => Math.abs(v - b.scene[i][k]) < 1e-6))) return false;
  return a.polygons.every((p, i) => p.length === b.polygons[i].length && p.every((v, j) => v === b.polygons[i][j]));
}

/** A scene box: { min, max } over some points. */
export function boxOf(points) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return { min, max };
}
/** A box to the millimetre, as a spec's roles record it. */
export const mm = (b) => [b.min.map((v) => Math.round(v * 1000) / 1000 + 0), b.max.map((v) => Math.round(v * 1000) / 1000 + 0)];

/**
 * One part: its scene polygons over a subset of the object's vertices, re-indexed, into the boat's frame (`frame`) -
 * the positions (the source's corners and no others), each polygon's corners in the port's winding, its triangles,
 * which polygon each triangle is of, and (AUDIT GN-B7) `split`: how many of its polygons were cut, four corners or
 * more - the rest were triangles already.
 */
export function bakePart(role, object, polyIds, frame) {
  const remap = new Map();
  const positions = [];
  const take = (vi) => {
    if (!remap.has(vi)) {
      remap.set(vi, positions.length / 3);
      positions.push(...toBoat(object.scene[vi], frame).map(round4));
    }
    return remap.get(vi);
  };
  const polygons = [], triangles = [], triangleOf = [], material = [];
  let split = 0;
  for (const k of polyIds) {
    const poly = object.polygons[k];
    const tris = fillFace(object, k);   // AUDIT GN-B1: Blender's cut, or refused; GN-B3: on its own corners alone
    const ring = poly.map(take);
    const p = polygons.length;
    polygons.push([...ring].reverse());   // the mirror: the port's winding
    material.push(object.polyMaterial[k] >= 0 ? object.materials[object.polyMaterial[k]] ?? null : null);
    // AUDIT GN-B1: each triangle through the mirror as its polygon goes - (a, b, c) wound with the face in Mac's scene,
    // (a, c, b) with it in hers
    for (const [a, b, c] of tris) { triangles.push(ring[a], ring[c], ring[b]); triangleOf.push(p); }
    if (poly.length > 3) split++;
  }
  return { role, object: object.name, positions, polygons, material, triangles, triangleOf, split };
}

/**
 * What a skipped object is said to be, checked - or an Error naming what it is not. GALLEON-2's `twin` (a part's copy
 * standing IN its place, the same corners and faces as the part it names to the micrometre - its materials' names
 * apart) and `minY` (a working STATION wholly beyond that scene Y); SHIPS-2's `band` (wholly outside the ship's own band
 * of the scene's Y, `spec.band` - another ship's part, or another station's) and `empty` (an object with no faces).
 */
function skipFault(o, skip, byName, spec) {
  if (skip.twin) {
    const t = byName.get(skip.twin);
    return !t || !sameShape(o, t) ? `${o.name} was to be ${skip.twin}'s twin in its place and is not` : null;
  }
  if (skip.empty) return o.polygons.length ? `${o.name} was to be empty and has ${o.polygons.length} faces` : null;
  const b = boxOf(o.scene);
  if (skip.band) {
    const [y0, y1] = spec.band;
    return o.polygons.length && !(b.max[1] < y0 || b.min[1] > y1) ? `${o.name} was to stand outside her band of the scene (Y ${y0} to ${y1}) and stands at Y ${b.min[1].toFixed(2)} to ${b.max[1].toFixed(2)}` : null;
  }
  return !(b.min[1] > skip.minY) ? `${o.name} was to be another station (beyond Y ${skip.minY}) and stands at Y ${b.min[1].toFixed(2)}` : null;
}

/**
 * The bake: the FBX's bytes in, one ship's parts out. Pure. `spec` says which ship (the header); `tree` is the bytes
 * parsed - a test hands in one it has changed, to see the bake refuse it; `source` the FBX's path as the file records
 * it (AUDIT GN2-BK4).
 * @param {Uint8Array} fbxBytes
 * @param {{ bake: string, source: string, frame: { scale: number, waterline: number, midship: number, centreline: number }, roles: Record<string, { role: string, box: number[][] }>, skip: Record<string, any>, band?: number[], hull?: string, cut?: (o: any, all: number[]) => any[] }} spec
 */
export function bakeScene(fbxBytes, spec, tree = readFbx(fbxBytes), source = spec.source) {
  assertBlenderFill(tree);   // AUDIT GN2-BK1
  const objects = sceneObjects(tree);
  const parts = [];
  const seen = new Set();
  const byName = new Map(objects.map((o) => [o.name, o]));
  const hullRole = spec.hull ?? 'hull';
  for (const o of objects) {
    const skip = spec.skip[o.name];
    if (skip) {
      const fault = skipFault(o, skip, byName, spec);
      if (fault) throw new Error(fault);
      continue;
    }
    const r = spec.roles[o.name];
    if (!r) throw new Error(`${o.name} plays no role aboard - name it in ROLES (or SKIP) after reading the scene`);
    // AUDIT GN-B5: where it was read, to BOX_SLACK in every coordinate of its box
    const b = boxOf(o.scene);
    const off = Math.max(...[b.min, b.max].flatMap((end, e) => end.map((v, k) => Math.abs(v - r.box[e][k]))));
    if (!(off <= BOX_SLACK)) throw new Error(`${o.name} (${r.role}) was read standing in the box ${JSON.stringify(r.box)} and stands in ${JSON.stringify(mm(b))} - ${(off * 100).toFixed(1)} cm out where ${BOX_SLACK * 100} cm is let pass; read the scene again (--list) before re-baking`);
    seen.add(o.name);
    const all = o.polygons.map((_, k) => k);
    if (r.role === hullRole) {
      // AUDIT GN-B6: her centreline is this object's own Y, to the bit - or her mirror pairs bake unequal
      if (o.origin[1] !== spec.frame.centreline) throw new Error(`the hull's origin stands at scene Y ${o.origin[1]} and FRAME.centreline is ${spec.frame.centreline} - set the centreline to the hull's Y`);
      if (spec.cut) parts.push(...spec.cut(o, all));
      else parts.push(bakePart(r.role, o, all, spec.frame));
    } else parts.push(bakePart(r.role, o, all, spec.frame));
  }
  const missing = Object.keys(spec.roles).filter((n) => !seen.has(n));
  if (missing.length) throw new Error(`the scene has none of ${missing.join(', ')}`);
  return {
    bake: spec.bake,
    source,
    sha256: createHash('sha256').update(fbxBytes).digest('hex'),
    creator: childNamed(tree.nodes, 'Creator')?.props[0] ?? null,
    frame: { ...spec.frame },
    parts,
  };
}

/** The bake as the file holds it: one part a line, so a re-bake that moves a part is one line of the diff. */
export function bakeJson(baked) {
  const { parts, ...head } = baked;
  const lines = parts.map((p) => `    ${JSON.stringify(p)}`);
  return `${JSON.stringify(head, null, 2).replace(/\n}$/, '')},\n  "parts": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

/** The repo's root (tools/..). */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** AUDIT GN2-BK4: an FBX's path as the file records it - in the repo, its path there (as a spec's source is written);
 *  else where it lies. */
export function sourcePath(file) {
  const abs = resolve(file);
  const rel = relative(ROOT, abs);
  return rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) ? rel.split(sep).join('/') : abs;
}

/** A scene's objects listed as a spec's roles record them - the name, the role a spec gives it (or how it is skipped),
 *  its box to the millimetre and its face count: what `--list` prints, read before a spec is written. */
export function listScene(bytes, spec = null) {
  return sceneObjects(readFbx(bytes)).map((o) => {
    const role = spec?.roles?.[o.name]?.role ?? (spec?.skip?.[o.name] ? '(skipped)' : '?');
    return `${o.name.padEnd(14)} ${role.padEnd(20)} ${o.polygons.length ? JSON.stringify(mm(boxOf(o.scene))) : '(no faces)'}  ${o.polygons.length} polygons`;
  });
}
