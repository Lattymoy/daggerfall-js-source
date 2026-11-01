// A MORROWIND NIF, WRITTEN. The other end of src/formats/morrowind/mwNifFile.js.
//
//     node tools/nifWrite.mjs <mesh.json> <out.nif> [--texture=NAME.dds]
//                             [--node=NAME] [--keep-v]
//
// FIELD-GUN-MW2 (2026-09-20). FIELD-GUN-MW1 baked Mac's FBX into the
// batch shape `flattenNif` emits, and then stopped, because a batch is
// not where the Morrowind lane takes a part:
//
//   bindPartsInto (mwFirstPerson.js:"for (const part of parts)") does `parseNif(part.bytes)`
//   and hands the result to `bindPart`. A part IS NIF BYTES.
//
// ═══ SO THE MESH BECOMES A NIF, AND NOT A SECOND DOOR ═════════════
//
// The obvious alternative - teach `bindPartsInto` to take pre-flattened
// batches beside NIF bytes - is the wrong one, and the file's own
// history says why: "MW7 failed by carrying a second port of one rule,
// and two copies of a rule drift." Everything a part gets on the way in
// is BEHIND that door: rule 34's discarded root transform, rule 14's
// BoneOffset, rule 13's mirror, the property chain, the attach. A
// second entrance would have to re-implement or skip every one of them,
// for ever, for one mesh.
//
// Written as a NIF, the port's own weapon is a part like any other and
// `fpArm.js` needs no arm for it at all.
//
// ═══ THE PRECEDENT ════════════════════════════════════════════════
//
// This repo already authors NIFs: `test/fixtures/mw/generate.py` writes
// its fixtures with pyffi. That is a Python dependency a bake cannot
// have, and its purpose is the opposite of this one's - it exists so
// the READER is tested against a writer sharing none of its
// assumptions. This writer shares every assumption with the reader ON
// PURPOSE, and is held to it by the strictest check available: the pin
// parses what it writes with the port's own `parseNif` and flattens it
// with the port's own `flattenNif`, and the batches must equal the
// baked mesh field for field. A 4.0.0.2 stream carries NO record sizes,
// so one byte wrong anywhere desynchronises the rest of the file - and
// the reader's own trailing-byte check means a writer that is off by
// four cannot produce a file that parses at all.
//
// ═══ WHAT IS WRITTEN, AND WHY EACH RECORD IS THERE ════════════════
//
//   NiNode              the root. Rule 34 wipes record 0's transform in
//                       the PARSER, so writing identity is not a
//                       simplification - it is the only thing that
//                       survives.
//   NiTriShape          NAMELESS, so bindPartsInto's MW-D6 arm binds it
//                       once for the part rather than once per side.
//   NiTriShapeData      the geometry.
//   NiMaterialProperty  white diffuse/ambient, no emission. The texture
//                       carries the colour; a tint here would be a
//                       second place to change it.
//   NiTexturingProperty base slot -> the source below.
//   NiSourceTexture     EXTERNAL, by name. `resolveMaterial` reads
//                       `src.external && src.fileName` and nothing else
//                       - an internal NiPixelData is parsed and dropped
//                       - so an internal texture would need the
//                       material resolver changed, which is a
//                       divergence from the reference for one asset.
//                       The name is resolved wherever the lane resolves
//                       texture names; that is the loader's problem and
//                       not this file's.
//   NiStencilProperty   drawMode 3 (Both). Rule 65's only two-sided
//                       value, and the honest answer to a mesh with 65
//                       single-shared edges: Morrowind's own artists
//                       reach for exactly this record when a shell has
//                       an open side, and the alternative - inventing
//                       geometry to close somebody else's model - is
//                       worse than drawing what they made.
//
// ═══ V GOES DOWN ══════════════════════════════════════════════════
//
// FBX puts v = 0 at the BOTTOM of the image; a NIF's uv set and a DDS's
// rows both run downward from the top. So the write is `1 - v` unless
// `--keep-v` says the mesh already holds it that way. Get this wrong
// and the model is textured upside down - which looks like a painting
// mistake and is not one.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMain } from './lib/isMain.mjs';

// OWN-WORK4 (2026-10-31): THE WRITER'S CORE LIVES IN src/formats/morrowind/mwNifWrite.js - the game writes its own
// scabbards in the browser - and every name is re-exported here, so a bake writes the bytes it always did. `writeNif`
// answers a Buffer, as it always has.
import {
  MW_NIF_VERSION,
  NIF_HEADER_LINE,
  NifOut,
  WRITERS,
  boundingSphere,
  writeNifBytes,
} from '../src/formats/morrowind/mwNifWrite.js';

export { MW_NIF_VERSION, NIF_HEADER_LINE, NifOut, WRITERS, boundingSphere };

/** The container (mwNifWrite.js writeNifBytes), as a Buffer. */
export function writeNif(records, roots = [0]) {
  const bytes = writeNifBytes(records, roots);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * A baked mesh (tools/fbxMesh.mjs) as a rigid, textured, two-sided
 * Morrowind part.
 */
export function meshToNif(mesh, { texture = null, node = null, keepV = false } = {}) {
  return meshesToNif([{ mesh, texture }], { node, keepV });
}

/**
 * MW-STEEL1: SEVERAL baked meshes as ONE part, each shape with its own
 * texture - the closed steel helm is a shell and a visor painted from two
 * pictures, and a part is one file. Every shape is written exactly as
 * meshToNif writes its one (nameless, its own material, texturing and
 * stencil, its own source), in order under the one root, so a single
 * mesh is the same records, the same indices and the same bytes it
 * always was.
 */
export function meshesToNif(shapes, { node = null, keepV = false } = {}) {
  if (!shapes?.length) throw new Error('no meshes to write');
  // 0: the root. Rule 34 wipes its transform in the parser anyway.
  const records = [{ type: 'NiNode', name: node ?? shapes[0].mesh?.name ?? 'Root', children: [] }];
  for (const shape of shapes) shapeRecords(records, shape, keepV);
  return writeNif(records, [0]);
}

/** One shape's records under root 0 - the shape, its data, material, texturing, stencil and source - and, for a
 *  skinned one (MW-STEEL4), its skin instance and data after them. A rigid shape is the records meshesToNif always
 *  wrote, in the same order. */
function shapeRecords(records, { mesh, texture = null, name = '', skin = null }, keepV) {
  if (!mesh?.positions?.length) throw new Error('this mesh has no positions');
  if (!mesh.indices?.length) throw new Error('this mesh has no triangles');
  // V GOES DOWN in a NIF. See the header.
  const uvs = mesh.uvs ? mesh.uvs.map((v, i) => (i % 2 === 1 && !keepV ? 1 - v : v)) : null;
  const at = records.length;
  records[0].children.push(at);
  const skinAt = at + (texture ? 6 : 5);
  records.push(
    // the shape. NAMELESS unless named - see the header's MW-D6 note; a skinned part's shape is named for rule 15
    { type: 'NiTriShape', name, data: at + 1, properties: [at + 2, at + 3, at + 4], ...(skin ? { skin: skinAt } : {}) },
    { type: 'NiTriShapeData', positions: mesh.positions, normals: mesh.normals, uvs, indices: mesh.indices },
    { type: 'NiMaterialProperty', name: `${mesh.name ?? 'mesh'}Material` },
    { type: 'NiTexturingProperty', textures: [texture ? { source: at + 5 } : null] },
    { type: 'NiStencilProperty', drawMode: 3 }, // rule 65: Both
  );
  if (texture) records.push({ type: 'NiSourceTexture', fileName: texture });
  if (skin)
    records.push(
      { type: 'NiSkinInstance', data: skinAt + 1, skeletonRoot: 0, bones: skin.bones },
      { type: 'NiSkinData', bones: skin.data },
    );
}

/** An affine's inverse, for the rigid transforms a skeleton's bind is made of: (R^T, -R^T t). */
function rigidInverse({ a, t }) {
  const r = [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
  return {
    a: r,
    t: [
      -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]),
      -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]),
      -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2]),
    ],
  };
}

/**
 * MW-STEEL4: SEVERAL baked meshes as ONE SKINNED part, the shape a retail body part or armour piece has - each shape
 * a NiSkinInstance over named bones and a NiSkinData of their inverse binds and weights, so the reader takes it on
 * the very path it takes Morrowind's own (bindPart's skinned branch, rule 12: rebound onto the wearer's skeleton by
 * the bones' NAMES, never parented to a bone; drawn by skinBatch, rule 20).
 *
 * `bones` is `[{ name, bind: { a, t } }]`: where each bone stood in the BIND POSE, in the frame the meshes are
 * authored in (`a` row-major, as mwAffine's affines are). Each shape is `{ mesh, texture, name, weights }`, `name`
 * the shape's own (rule 15's filter picks a skinned part's geometry by it: "Tri Right Hand 0" for the right hand),
 * and `weights` one `[[boneName, weight], ...]` list per vertex. What is written for each:
 *
 *   NiSkinInstance  its data, the root (0) as its skeleton root, and the bones the shape weights, in `bones` order
 *   NiSkinData      an identity skin transform, and per bone its INVERSE BIND - the bind undone, mesh space to bone
 *                   space, as rule 19 reads it (no inversion at load) - its vertices' bounding sphere in that bone's
 *                   space, and its (vertex, weight) list
 *
 * and the bones themselves, as NiNodes under the root standing at their binds, after every shape: the file is its own
 * bind pose, so a tool that skins it against its own nodes (NifSkope) draws it where it was authored. The port never
 * reads them - a rebound part's bones are the wearer's (rule 12) - and so their order costs a shape's records nothing:
 * a rigid shape here would be the records meshesToNif writes.
 */
export function skinnedMeshesToNif(shapes, { node, bones, keepV = false }) {
  if (!shapes?.length) throw new Error('no meshes to write');
  if (!bones?.length) throw new Error('a skinned part needs its bones');
  const records = [{ type: 'NiNode', name: node ?? 'Root', children: [] }];
  const boneAt = new Map();
  const nodeOf = new Map(bones.map((b, i) => [b.name, i]));
  const shapeSkins = shapes.map(({ mesh, weights }) => {
    const n = mesh.positions.length / 3;
    if (weights?.length !== n) throw new Error(`${n} vertices and ${weights?.length ?? 0} weight lists`);
    const per = new Map();
    weights.forEach((list, v) => {
      if (!list.length) throw new Error(`vertex ${v} carries no weight`);
      for (const [name, w] of list) {
        if (!nodeOf.has(name))
          throw new Error(`vertex ${v} is weighted to "${name}", which is not one of the part's bones`);
        if (!per.has(name)) per.set(name, { indices: [], weights: [] });
        per.get(name).indices.push(v);
        per.get(name).weights.push(w);
      }
    });
    return bones
      .filter((b) => per.has(b.name))
      .map((b) => {
        const inv = rigidInverse(b.bind);
        const { indices, weights: ws } = per.get(b.name);
        const local = [];
        for (const v of indices) {
          const x = mesh.positions[v * 3],
            y = mesh.positions[v * 3 + 1],
            z = mesh.positions[v * 3 + 2];
          local.push(
            inv.a[0] * x + inv.a[1] * y + inv.a[2] * z + inv.t[0],
            inv.a[3] * x + inv.a[4] * y + inv.a[5] * z + inv.t[1],
            inv.a[6] * x + inv.a[7] * y + inv.a[8] * z + inv.t[2],
          );
        }
        const sphere = boundingSphere(local);
        return {
          name: b.name,
          data: {
            transform: { rotation: inv.a, translation: inv.t, scale: 1 },
            center: sphere.center,
            radius: sphere.radius,
            indices,
            weights: ws,
          },
        };
      });
  });
  // the bones' records come after every shape's, so their indices are known once the shapes are laid out
  let next = 1;
  for (const s of shapes) next += (s.texture ? 6 : 5) + 2;
  for (const b of bones) if (shapeSkins.some((list) => list.some((x) => x.name === b.name))) boneAt.set(b.name, next++);
  shapes.forEach((shape, i) =>
    shapeRecords(
      records,
      {
        mesh: shape.mesh,
        texture: shape.texture ?? null,
        name: shape.name ?? '',
        skin: { bones: shapeSkins[i].map((x) => boneAt.get(x.name)), data: shapeSkins[i].map((x) => x.data) },
      },
      keepV,
    ),
  );
  for (const b of bones) {
    if (!boneAt.has(b.name)) continue;
    records[0].children.push(records.length);
    records.push({
      type: 'NiNode',
      name: b.name,
      translation: [...b.bind.t],
      rotation: [...b.bind.a],
      scale: 1,
      children: [],
    });
  }
  return writeNif(records, [0]);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d = null) =>
    args
      .find((a) => a.startsWith(`--${k}=`))
      ?.split('=')
      .slice(1)
      .join('=') ?? d;
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) {
    console.error('usage: node tools/nifWrite.mjs <mesh.json> <out.nif> [--texture=NAME.dds] [--node=NAME] [--keep-v]');
    process.exit(2);
  }
  const mesh = JSON.parse(readFileSync(files[0], 'utf8'));
  const bytes = meshToNif(mesh, { texture: opt('texture'), node: opt('node'), keepV: args.includes('--keep-v') });
  mkdirSync(dirname(files[1]), { recursive: true });
  writeFileSync(files[1], bytes);
  console.log(`${files[0]} -> ${files[1]}  ${bytes.length} bytes`);
  console.log(
    `  ${mesh.positions.length / 3} vertices, ${mesh.indices.length / 3} triangles, texture ${opt('texture') ?? '(none)'}`,
  );
}
