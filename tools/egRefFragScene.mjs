// THE REFERENCE HERO FRAGMENT'S SCENE - the port's own stand-in for one of Mac's Blender exports.
//
//     node tools/egRefFragScene.mjs [--out=src/assets/egfrags/source/egRefFrag.fbx]
//
// EG6c (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 11.6). Authored hero fragments are Mac's, modelled in
// Blender; until his arrive, ONE REFERENCE FRAGMENT proves the path his will take - a scene written here, from numbers
// alone (no game data, no third-party art, no trigonometry: the octagons' corners are Math.SQRT1_2's), committed as the
// .fbx tools/fragBake.mjs bakes exactly as it bakes one of his (tools/bakeEgRefFrag.mjs, the reference's own bake
// script). Re-run it and the same bytes come out (test/tooling/eg6c_bake.test.js holds it to them).
//
// It is written as Blender writes an export (tools/fbxWrite.mjs, Blender's FBX defaults - Y up, Z front, X right, units
// in centimetres): each object's origin at the middle of its box, its vertices about it in Blender's own Z-up axes, its
// Lcl Rotation the -90 degrees about X and its Lcl Scaling the 100 Blender's exporter writes, its normals ByPolygonVertex,
// its UVs ByPolygonVertex IndexToDirect, its materials ByPolygon. Its SceneInfo names its writer (FRAG_REF_WRITER), never
// a Blender: the bake knows the port's own writer by that name and asks no Blender's cut of its faces.
//
// THE FRAGMENT: a passage of the Oblivion Caverns (the Galleries' first kit), 30 m along Blender's +Y, 6 m across, its vault
// 6 m up and open to the burning sky over the middle of its chasm. Its mouth's threshold and a fight floor before the
// chasm; three inner pieces across it (two ledges, a Drift); a fight floor after it with a stair up to a balcony where a
// Caster stands, and two exits - the floor's and the balcony's, 1.5 m up (a socket may change height, section 11.5). A
// fire fall at the near lip, a magma surge along the far floor, falling basalt on the near one; an alcove behind the west
// wall; three lights; a walk graph of seven nodes that does not cross the chasm (the legion walks, it does not jump); the
// collider's proxy. Every marker kind the bake reads stands in it at least once, and its art wears seven of the band's
// dress records - one floor of two faces (a welded edge), smooth posts with a UV seam (a split one).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { S, D, I, L, dArr, iArr, writeFbx } from './fbxWrite.mjs';
import { FRAG_REF_WRITER } from './fragBake.mjs';
import { ROOT } from './shipBake.mjs';
import { isMain } from './lib/isMain.mjs';

/** Where the scene is committed. */
export const REF_FRAG_FBX = 'src/assets/egfrags/source/egRefFrag.fbx';

const H = Math.SQRT1_2;
/** An octagon's corners about (0, 0), radius 1, from +X counter-clockwise (seen from +Z). */
const OCT = Object.freeze([[1, 0], [H, H], [0, 1], [-H, H], [-1, 0], [-H, -H], [0, -1], [H, -H]]);

/**
 * A MESH BEING BUILT: shapes added to it share a vertex where they share a place (as one Blender mesh does), each face
 * with its material slot and, for a smooth face, its corners' own normals and UVs.
 */
export function refFragMesh(name, mats = []) {
  const verts = [], faces = [], faceMat = [], corner = [];
  const at = new Map();
  const v = (p) => { const k = p.join(','); if (!at.has(k)) { at.set(k, verts.length); verts.push(p); } return at.get(k); };
  const m = {
    name, mats, verts, faces, faceMat, corner,
    /** a face over points (counter-clockwise seen from where it faces), material slot `mat`, its corners' normals and
     *  UVs (`smooth`: [[normal, uv], ...]) or none - flat, mapped from its plane */
    face(pts, mat = 0, smooth = null) { faces.push(pts.map(v)); faceMat.push(mat); corner.push(smooth); return m; },
    /** a level rectangle at height z, facing up (or down) */
    level(x0, y0, x1, y1, z, mat = 0, down = false) { const q = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]; return m.face(down ? q.reverse() : q, mat); },
    /** an upright rectangle across X at y, facing -Y (or +Y) */
    across(x0, x1, y, z0, z1, mat = 0, back = false) { const q = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]; return m.face(back ? q.reverse() : q, mat); },
    /** an upright rectangle along Y at x, facing -X (or +X) */
    along(x, y0, y1, z0, z1, mat = 0, east = false) { const q = [[x, y1, z0], [x, y0, z0], [x, y0, z1], [x, y1, z1]]; return m.face(east ? q.reverse() : q, mat); },
    /** a box, every face out */
    box(x0, y0, z0, x1, y1, z1, mat = 0) {
      const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]) m.face(f.map((i) => p[i]), mat);
      return m;
    },
    /** a level octagon of radius r about (x, y) at height z, facing up */
    disc(x, y, z, r, mat = 0) { return m.face(OCT.map(([c, s]) => [x + r * c, y + r * s, z]), mat); },
    /** an octagonal post of radius r from z0 to z1: its sides SMOOTH (each corner's normal its own bearing, u round the
     *  post - a seam where it closes, v up it), its top flat */
    post(x, y, r, z0, z1, mat = 0) {
      for (let k = 0; k < 8; k++) {
        const [c0, s0] = OCT[k], [c1, s1] = OCT[(k + 1) % 8], u0 = k / 8, u1 = (k + 1) / 8;
        m.face([[x + r * c0, y + r * s0, z0], [x + r * c1, y + r * s1, z0], [x + r * c1, y + r * s1, z1], [x + r * c0, y + r * s0, z1]], mat,
          [[[c0, s0, 0], [u0, 0]], [[c1, s1, 0], [u1, 0]], [[c1, s1, 0], [u1, (z1 - z0) / 2]], [[c0, s0, 0], [u0, (z1 - z0) / 2]]]);
      }
      return m.disc(x, y, z1, r, mat);
    },
    /** a strip w wide from a to b ([x, y, z]), facing up - a walk-graph edge */
    strip(a, b, w) {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), px = (-dy / l) * (w / 2), py = (dx / l) * (w / 2);
      return m.face([[a[0] - px, a[1] - py, a[2]], [b[0] - px, b[1] - py, b[2]], [b[0] + px, b[1] + py, b[2]], [a[0] + px, a[1] + py, a[2]]]);
    },
  };
  return m;
}

/** A face's own normal (Newell's), unit. */
function faceNormal(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(n[0], n[1], n[2]);
  return n.map((c) => c / l + 0);
}

/**
 * THE REFERENCE FRAGMENT'S SCENE: every object, art and marker, in Blender's scene (metres, Z up, the course along +Y).
 * @returns {ReturnType<typeof refFragMesh>[]}
 */
export function refFragScene() {
  const out = [];
  const add = (m) => { out.push(m); return m; };
  // ── THE ART, in the Galleries' dress (world/eliteGates/egBandArt.js EG_DRESS's records by name)
  add(refFragMesh('Floor_Near', ['floor', 'pillar'])).level(-3, 0, 0, 9, 0).level(0, 0, 3, 9, 0).across(-3, 3, 9, -0.6, 0, 1, true);
  add(refFragMesh('Floor_Far', ['floor', 'pillar'])).level(-3, 21, 3, 25.5, 0).level(-3, 25.5, 3, 30, 0).across(-3, 3, 21, -0.6, 0, 1);
  add(refFragMesh('Walls', ['pillar'])).box(-3.5, 0, -0.6, -3, 30, 6).box(3, 0, -0.6, 3.5, 30, 6);
  add(refFragMesh('Vault', ['root'])).box(-3.5, 0, 6, 3.5, 13, 6.6).box(-3.5, 17, 6, 3.5, 30, 6.6);
  add(refFragMesh('Magma', ['molten'])).level(-3, 9, 3, 21, -4);
  add(refFragMesh('Edge_Lines', ['edge'])).level(-3, 8.85, 3, 9, 0.01).level(-3, 21, 3, 21.15, 0.01);
  add(refFragMesh('Posts', ['brass'])).post(-2.5, 0.8, 0.35, 0, 4.2).post(2.5, 0.8, 0.35, 0, 4.2);
  add(refFragMesh('Balcony', ['cobble', 'pillar'])).level(1.5, 25, 3, 30, 1.5).along(1.5, 25, 30, 0, 1.5, 1);
  add(refFragMesh('Stair', ['cobble'])).face([[1.5, 22.5, 0], [3, 22.5, 0], [3, 25, 1.5], [1.5, 25, 1.5]]);
  add(refFragMesh('Niche', ['pillar'])).box(-4.5, 4.4, 0, -3.5, 5.6, 2.2);
  // ── THE LAW, as named markers
  add(refFragMesh('socket.in')).across(-2, 2, 0, 0, 4);
  add(refFragMesh('socket.out.main')).across(-2.5, 0.5, 30, 0, 4, 0, true);
  add(refFragMesh('socket.out.balcony')).across(1.5, 3, 30, 1.5, 5.5, 0, true);
  add(refFragMesh('floor.threshold')).level(-3, 0, 3, 1.5, 0);
  add(refFragMesh('floor.fight.near')).level(-3, 1.5, 0, 9, 0).level(0, 1.5, 3, 9, 0);
  add(refFragMesh('floor.fight.far')).level(-3, 21, 3, 30, 0);
  add(refFragMesh('floor.fight.balcony')).level(1.5, 25, 3, 30, 1.5);
  add(refFragMesh('ramp.stair')).face([[1.5, 22.5, 0], [3, 22.5, 0], [3, 25, 1.5], [1.5, 25, 1.5]]);
  add(refFragMesh('ceil.near')).level(-3, 0, 3, 13, 6, 0, true);
  add(refFragMesh('ceil.far')).level(-3, 17, 3, 30, 6, 0, true);
  add(refFragMesh('open.mouth')).box(-3.1, 0, -0.05, 3.1, 0.05, 0.05);
  add(refFragMesh('open.lipnear')).box(-3.1, 8.95, -0.05, 3.1, 9.05, 0.05);
  add(refFragMesh('open.lipfar')).box(-3.1, 20.95, -0.05, 3.1, 21.05, 0.05);
  add(refFragMesh('open.exit')).box(-3.1, 29.95, -0.05, 3.1, 30, 1.55);
  add(refFragMesh('open.balconyside')).box(1.45, 24.95, 1.45, 1.55, 30, 1.55);
  add(refFragMesh('open.stairtop')).box(1.45, 24.95, 1.45, 3.05, 25.05, 1.55);
  const N = { mouth: [0, 0.75, 0], near: [0, 5, 0], lipnear: [0, 8.3, 0], lipfar: [0, 21.7, 0], far: [-1.5, 27, 0], stairfoot: [2.25, 22, 0], balcony: [2.25, 27.5, 1.5] };
  for (const [k, p] of Object.entries(N)) add(refFragMesh(`node.${k}`)).disc(p[0], p[1], p[2], 0.5);
  for (const [k, a, b] of [['mouthnear', 'mouth', 'near'], ['lipnear', 'near', 'lipnear'], ['lipfar', 'lipfar', 'far'], ['stairfoot', 'lipfar', 'stairfoot'], ['farfoot', 'far', 'stairfoot'], ['stair', 'stairfoot', 'balcony']]) add(refFragMesh(`edge.${k}`)).strip(N[a], N[b], 0.2);
  const cube = (name, x, y, z, s = 0.3) => add(refFragMesh(name)).box(x - s / 2, y - s / 2, z, x + s / 2, y + s / 2, z + s);
  cube('anchor.rift.west', -2.85, 6, 1);
  cube('anchor.lurker.near', 2.5, 3, 0);
  cube('anchor.lurker.far', -2.5, 28, 0);
  cube('anchor.caster.balcony', 2.25, 28.5, 1.5);
  cube('anchor.niche.mage', -2.5, 24, 0);
  cube('anchor.engine.sluice', 0, 26, 0);
  cube('anchor.hazard.spout', 2.6, 21.5, 0);
  add(refFragMesh('hazard.fall.lip.ph1500')).level(-3, 7.8, 3, 9, 0);
  add(refFragMesh('hazard.surge.channel.per8000.ph2000')).level(-3, 21.5, 1, 29.5, 0);
  add(refFragMesh('hazard.basalt.near.ph700')).disc(0.5, 4, 0, 2.5).disc(-0.5, 6.5, 0, 2.5);
  add(refFragMesh('course.ledge.a')).box(-1.2, 10, -0.8, 1.2, 12, 0);
  add(refFragMesh('course.drift.b.amp100.per5000.ph900')).box(-1.5, 14, -0.8, 1.5, 16.4, 0);
  add(refFragMesh('course.ledge.c')).box(-1.2, 18, -0.8, 1.2, 20, 0);
  add(refFragMesh('alcove.seam.shard.west')).box(-4.5, 4.4, 0, -3.5, 5.6, 2.2);
  cube('light.band.near', 0, 4, 3.9, 0.2);
  cube('light.lava.chasm', 0, 15, 0.9, 0.2);
  cube('light.band.far', 0, 27, 3.9, 0.2);
  add(refFragMesh('collider.proxy'))
    .level(-3, 0, 3, 9, 0).level(-3, 21, 3, 30, 0).level(1.5, 25, 3, 30, 1.5).along(1.5, 25, 30, 0, 1.5)
    .face([[1.5, 22.5, 0], [3, 22.5, 0], [3, 25, 1.5], [1.5, 25, 1.5]])
    .along(-3, 0, 30, 0, 6, 0, true).along(3, 0, 30, 0, 6)
    .level(-3, 0, 3, 13, 6, 0, true).level(-3, 17, 3, 30, 6, 0, true);
  return out;
}

/** A P row of a Properties70: its name, type, subtype, flags and values. */
const P = (name, type, sub, flags, ...v) => ({ name: 'P', props: [S(name), S(type), S(sub), S(flags), ...v] });

/**
 * THE FILE: the scene written as Blender's exporter writes one (the header's list) - the bytes a function of the scene's
 * numbers alone.
 * @param {ReturnType<typeof refFragMesh>[]} [scene]
 */
export function writeRefFragFbx(scene = refFragScene()) {
  const objects = [], links = [], matIds = new Map();
  const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
  scene.forEach((m, i) => {
    const geoId = 1000 + i * 10, modelId = geoId + 1;
    const lo = [0, 1, 2].map((k) => Math.min(...m.verts.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...m.verts.map((p) => p[k])));
    const o = lo.map((v, k) => Math.round(((v + hi[k]) / 2) * 1000) / 1000 + 0);   // the origin at the middle of its box
    const pvi = [], normals = [], uvs = [], uvIdx = [];
    m.faces.forEach((f, fi) => {
      const pts = f.map((vi) => m.verts[vi]), flat = faceNormal(pts), smooth = m.corner[fi];
      const dom = flat.map(Math.abs).indexOf(Math.max(...flat.map(Math.abs)));
      f.forEach((vi, j) => {
        pvi.push(j === f.length - 1 ? ~vi : vi);
        const p = m.verts[vi];
        normals.push(...(smooth ? smooth[j][0] : flat));
        // a flat face mapped from its plane, a tile every two metres
        uvIdx.push(uvs.length / 2);
        uvs.push(...(smooth ? smooth[j][1] : dom === 2 ? [p[0] / 2, p[1] / 2] : dom === 0 ? [p[1] / 2, p[2] / 2] : [p[0] / 2, p[2] / 2]).map(r6));
      });
    });
    const layers = [
      { name: 'LayerElementNormal', props: [I(0)], children: [{ name: 'Version', props: [I(102)] }, { name: 'Name', props: [S('')] }, { name: 'MappingInformationType', props: [S('ByPolygonVertex')] }, { name: 'ReferenceInformationType', props: [S('Direct')] }, { name: 'Normals', props: [dArr(normals)] }] },
      { name: 'LayerElementUV', props: [I(0)], children: [{ name: 'Version', props: [I(101)] }, { name: 'Name', props: [S('UVMap')] }, { name: 'MappingInformationType', props: [S('ByPolygonVertex')] }, { name: 'ReferenceInformationType', props: [S('IndexToDirect')] }, { name: 'UV', props: [dArr(uvs)] }, { name: 'UVIndex', props: [iArr(uvIdx)] }] },
    ];
    if (m.mats.length) layers.push({ name: 'LayerElementMaterial', props: [I(0)], children: [{ name: 'Version', props: [I(101)] }, { name: 'Name', props: [S('')] }, { name: 'MappingInformationType', props: [S('ByPolygon')] }, { name: 'ReferenceInformationType', props: [S('IndexToDirect')] }, { name: 'Materials', props: [iArr(m.faceMat)] }] });
    objects.push({ name: 'Geometry', props: [L(geoId), S(`${m.name}\u0000\u0001Geometry`), S('Mesh')], children: [
      { name: 'Vertices', props: [dArr(m.verts.flatMap((p) => p.map((v, k) => r6(v - o[k]))))] },
      { name: 'PolygonVertexIndex', props: [iArr(pvi)] },
      { name: 'GeometryVersion', props: [I(124)] },
      ...layers,
    ] });
    objects.push({ name: 'Model', props: [L(modelId), S(`${m.name}\u0000\u0001Model`), S('Mesh')], children: [
      { name: 'Version', props: [I(232)] },
      { name: 'Properties70', children: [
        P('Lcl Translation', 'Lcl Translation', '', 'A', D(o[0] * 100), D(o[2] * 100), D(-o[1] * 100 + 0)),
        P('Lcl Rotation', 'Lcl Rotation', '', 'A', D(-90), D(0), D(0)),
        P('Lcl Scaling', 'Lcl Scaling', '', 'A', D(100), D(100), D(100)),
      ] },
    ] });
    links.push([modelId, 0], [geoId, modelId]);
    for (const name of m.mats) {
      if (!matIds.has(name)) {
        matIds.set(name, 9000 + matIds.size);
        objects.push({ name: 'Material', props: [L(matIds.get(name)), S(`${name}\u0000\u0001Material`), S('')], children: [{ name: 'Version', props: [I(102)] }, { name: 'ShadingModel', props: [S('Lambert')] }] });
      }
      links.push([matIds.get(name), modelId]);
    }
  });
  const info = (at) => [P(`${at}|ApplicationVendor`, 'KString', '', '', S('daggerfall-js-source')), P(`${at}|ApplicationName`, 'KString', '', '', S(FRAG_REF_WRITER)), P(`${at}|ApplicationVersion`, 'KString', '', '', S('1'))];
  const axis = (name, v) => P(name, 'int', 'Integer', '', I(v));
  return writeFbx([
    { name: 'FBXHeaderExtension', children: [
      { name: 'FBXHeaderVersion', props: [I(1003)] },
      { name: 'FBXVersion', props: [I(7400)] },
      { name: 'SceneInfo', props: [S('GlobalInfo\u0000\u0001SceneInfo'), S('UserData')], children: [
        { name: 'Type', props: [S('UserData')] }, { name: 'Version', props: [I(100)] },
        { name: 'Properties70', children: [...info('Original'), ...info('LastSaved')] },
      ] },
    ] },
    { name: 'Creator', props: [S(`${FRAG_REF_WRITER} (EG6c)`)] },
    { name: 'GlobalSettings', children: [
      { name: 'Version', props: [I(1000)] },
      { name: 'Properties70', children: [axis('UpAxis', 1), axis('UpAxisSign', 1), axis('FrontAxis', 2), axis('FrontAxisSign', 1), axis('CoordAxis', 0), axis('CoordAxisSign', 1), P('UnitScaleFactor', 'double', 'Number', '', D(1))] },
    ] },
    { name: 'Objects', children: objects },
    { name: 'Connections', children: links.map(([src, dst]) => ({ name: 'C', props: [S('OO'), L(src), L(dst)] })) },
  ]);
}

if (isMain(import.meta.url)) {
  const out = resolve(process.argv.slice(2).find((a) => a.startsWith('--out='))?.slice(6) ?? resolve(ROOT, REF_FRAG_FBX));
  const bytes = writeRefFragFbx();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log(`${out}: ${refFragScene().length} objects, ${bytes.length} bytes`);
}
