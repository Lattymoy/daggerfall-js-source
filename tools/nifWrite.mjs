// A MORROWIND NIF, WRITTEN. The other end of src/formats/mwNifFile.js.
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

export const MW_NIF_VERSION = 0x04000002;
export const NIF_HEADER_LINE = 'NetImmerse File Format, Version 4.0.0.2\n';

/** A little-endian byte builder whose methods are the reader's, one for
 *  one. Named the same so the two files can be diffed by eye. */
export class NifOut {
  constructor() { this.parts = []; this.length = 0; }
  _push(buf) { this.parts.push(buf); this.length += buf.length; return this; }
  _num(size, fn, v) { const b = Buffer.alloc(size); fn.call(b, v, 0); return this._push(b); }
  u8(v) { return this._num(1, Buffer.prototype.writeUInt8, v); }
  u16(v) { return this._num(2, Buffer.prototype.writeUInt16LE, v); }
  i16(v) { return this._num(2, Buffer.prototype.writeInt16LE, v); }
  u32(v) { return this._num(4, Buffer.prototype.writeUInt32LE, v); }
  i32(v) { return this._num(4, Buffer.prototype.writeInt32LE, v); }
  f32(v) { return this._num(4, Buffer.prototype.writeFloatLE, v); }
  /** The 32-bit bool this version uses everywhere. */
  bool(v) { return this.u32(v ? 1 : 0); }
  /** uint32 length + latin1 bytes. */
  string(s) { const b = Buffer.from(String(s ?? ''), 'latin1'); return this.u32(b.length)._push(b); }
  vec3(v) { return this.f32(v[0]).f32(v[1]).f32(v[2]); }
  mat33(m) { for (let i = 0; i < 9; i++) this.f32(m[i]); return this; }
  /** A record ref: an int32 index, -1 for null. */
  ref(v) { return this.i32(v ?? -1); }
  refList(list) { this.u32(list.length); for (const r of list) this.ref(r); return this; }
  f32Array(a) { for (const v of a) this.f32(v); return this; }
  u16Array(a) { for (const v of a) this.u16(v); return this; }
  toBuffer() { return Buffer.concat(this.parts, this.length); }
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** NiObjectNET: name, extra-data chain head, controller chain head. */
const objectNET = (o, { name = '', extra = -1, controller = -1 }) =>
  o.string(name).ref(extra).ref(controller);

/** NiAVObject: the transform, the velocity, the properties, and the
 *  bounding volume this writer never emits (the reference treats a
 *  missing one as "no bound", which is what a first-person part wants). */
function avObject(o, rec) {
  objectNET(o, rec);
  o.u16(rec.flags ?? 0);
  o.vec3(rec.translation ?? [0, 0, 0]);
  o.mat33(rec.rotation ?? IDENTITY3);
  o.f32(rec.scale ?? 1);
  o.vec3(rec.velocity ?? [0, 0, 0]);
  o.refList(rec.properties ?? []);
  o.bool(false);
}

/** The record writers, keyed exactly as mwNifFile.js's READERS are. */
export const WRITERS = {
  NiNode(o, rec) {
    avObject(o, rec);
    o.refList(rec.children ?? []);
    o.refList(rec.effects ?? []);
  },

  NiTriShape(o, rec) {
    avObject(o, rec);
    o.ref(rec.data);
    o.ref(rec.skin ?? -1);
  },

  NiTriShapeData(o, rec) {
    const n = rec.positions.length / 3;
    if (n > 0xffff) throw new Error(`${n} vertices will not fit NiTriShapeData's uint16 count`);
    o.u16(n);
    o.bool(true).f32Array(rec.positions);
    if (rec.normals) o.bool(true).f32Array(rec.normals); else o.bool(false);
    // The bounding sphere the exporter is expected to have computed.
    // `flattenNif` does not read it, but a file that lies about its own
    // bounds is a file that lies, so it is computed rather than zeroed.
    const { center, radius } = boundingSphere(rec.positions);
    o.vec3(center).f32(radius);
    o.bool(false);                                    // no vertex colours
    // At 4.0.0.2 the uv-set COUNT is a uint16 and a separate bool gates
    // whether any are written at all. Both, in that order.
    o.u16(rec.uvs ? 1 : 0).bool(!!rec.uvs);
    if (rec.uvs) o.f32Array(rec.uvs);
    const tris = rec.indices.length / 3;
    if (tris > 0xffff) throw new Error(`${tris} triangles will not fit the uint16 count`);
    o.u16(tris);
    o.u32(rec.indices.length);
    o.u16Array(rec.indices);
    o.u16(0);                                         // no match groups
  },

  NiMaterialProperty(o, rec) {
    objectNET(o, rec);
    o.u16(rec.flags ?? 1);
    o.vec3(rec.ambient ?? [1, 1, 1]);
    o.vec3(rec.diffuse ?? [1, 1, 1]);
    o.vec3(rec.specular ?? [0, 0, 0]);
    o.vec3(rec.emissive ?? [0, 0, 0]);
    o.f32(rec.glossiness ?? 0);
    o.f32(rec.alpha ?? 1);
  },

  NiTexturingProperty(o, rec) {
    objectNET(o, rec);
    o.u16(rec.flags ?? 0);
    o.u32(rec.applyMode ?? 2);                        // APPLY_MODULATE
    const slots = rec.textures ?? [];
    o.u32(slots.length);
    slots.forEach((tex, i) => {
      if (!tex) { o.bool(false); return; }
      o.bool(true);
      o.ref(tex.source).u32(tex.clampMode ?? 3).u32(tex.filterMode ?? 2).u32(tex.uvSet ?? 0);
      o.i16(0).i16(-75).u16(0);                       // ps2L, ps2K, unknown: the exporter's constants
      // The bump slot alone carries the luma pair and a 2x2 matrix.
      if (i === 5) o.f32(1).f32(0).f32Array([1, 0, 0, 1]);
    });
  },

  NiSourceTexture(o, rec) {
    objectNET(o, rec);
    o.u8(1);                                          // external
    o.string(rec.fileName);
    o.u32(rec.pixelLayout ?? 5).u32(rec.useMipmaps ?? 2).u32(rec.alphaFormat ?? 3).u8(rec.isStatic ?? 1);
  },

  NiStencilProperty(o, rec) {
    objectNET(o, rec);
    o.u16(rec.flags ?? 0);
    o.u8(rec.enabled ?? 0);
    o.u32(rec.compareFunc ?? 0).u32(rec.stencilRef ?? 0).u32(rec.mask ?? 0xffffffff);
    o.u32(rec.failAction ?? 0).u32(rec.zfailAction ?? 0).u32(rec.zpassAction ?? 0);
    o.u32(rec.drawMode ?? 0);
  },

  // MW-STEEL2: A SKIN, so a test can stand a SKINNED body - a retail body part's own records - on a skeleton whose
  // rest is not its bind pose, which is what the plate's T-pose fault needed and no rigid fixture can show. The
  // reader's field order exactly (mwNifFile.js NiSkinInstance / NiSkinData): the instance names its data, its
  // skeleton root and its bones; the data carries the skin's own transform, the bone count, the 4.0.0.2 partition ref,
  // and per bone its inverse bind, a bounding sphere and its (vertex, weight) list.
  NiSkinInstance(o, rec) {
    o.ref(rec.data);
    o.ref(rec.skeletonRoot ?? -1);
    o.refList(rec.bones ?? []);
  },

  // MW-CAST1: AN EXTERNAL .KF, so a test can stand an arm whose clips carry a group no committed fixture has (the
  // spellcast group). The reader's field order exactly (mwNifFile.js): the helper is a bare NiObjectNET whose extra
  // chain is the text keys and then one bone name per controller, and whose controller chain is the keyframe
  // controllers in the same order. Held to the reader by a round trip: armfpweapon.kf parsed and written back is the
  // same bytes.
  NiSequenceStreamHelper(o, rec) {
    objectNET(o, rec);
  },

  NiStringExtraData(o, rec) {
    o.ref(rec.next ?? -1);
    o.u32(rec.recordSize ?? 4 + Buffer.byteLength(String(rec.string ?? ''), 'latin1'));
    o.string(rec.string);
  },

  NiTextKeyExtraData(o, rec) {
    o.ref(rec.next ?? -1);
    o.u32(rec.recordSize ?? 0);
    o.u32(rec.keys.length);
    for (const k of rec.keys) o.f32(k.time).string(k.text);
  },

  NiKeyframeController(o, rec) {
    o.ref(rec.next ?? -1).u16(rec.flags ?? 8).f32(rec.frequency ?? 1).f32(rec.phase ?? 0);
    o.f32(rec.startTime ?? 0).f32(rec.stopTime ?? 0).ref(rec.target ?? -1);
    o.ref(rec.data);
  },

  NiKeyframeData(o, rec) {
    const rot = rec.rotationKeys ?? [];
    o.u32(rot.length);
    if (rot.length) {
      if ((rec.rotationType ?? 1) === 4) throw new Error('NiKeyframeData: XYZ rotation keys are not written');
      o.u32(rec.rotationType ?? 1);
      for (const k of rot) {
        o.f32(k.time).f32Array(k.value);
        if ((rec.rotationType ?? 1) === 3) o.f32Array(k.tbc);
      }
    }
    keyGroup(o, rec.translations, 3);
    keyGroup(o, rec.scales, 1);
  },

  NiSkinData(o, rec) {
    const tr = rec.transform ?? {};
    o.mat33(tr.rotation ?? IDENTITY3).vec3(tr.translation ?? [0, 0, 0]).f32(tr.scale ?? 1);
    o.u32(rec.bones.length);
    o.ref(rec.partitions ?? -1);
    for (const b of rec.bones) {
      const t = b.transform ?? {};
      o.mat33(t.rotation ?? IDENTITY3).vec3(t.translation ?? [0, 0, 0]).f32(t.scale ?? 1);
      o.vec3(b.center ?? [0, 0, 0]).f32(b.radius ?? 0);
      o.u16(b.indices.length);
      for (let v = 0; v < b.indices.length; v++) o.u16(b.indices[v]).f32(b.weights[v]);
    }
  },
};

/** MW-CAST1: a KeyGroup<T> as the reader takes it (mwNifFile.js readKeyGroupOf): the count, then - only when there are
 *  keys - the interpolation type and the keys, a quadratic key's two tangents and a TBC key's three floats after its
 *  value. `dim` is 1 for a float group, 3 for a vector. */
function keyGroup(o, group, dim) {
  const keys = group?.keys ?? [];
  o.u32(keys.length);
  if (!keys.length) return;
  const type = group.type ?? 1;
  o.u32(type);
  const val = (v) => (dim === 1 ? o.f32(v) : o.f32Array(v));
  for (const k of keys) {
    o.f32(k.time);
    val(k.value);
    if (type === 2) { val(k.inTan); val(k.outTan); }
    else if (type === 3) o.f32Array(k.tbc);
  }
}

/** The sphere the exporter writes beside the vertices. */
export function boundingSphere(positions) {
  const n = positions.length / 3;
  if (!n) return { center: [0, 0, 0], radius: 0 };
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]); }
  }
  const center = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    radius = Math.max(radius, Math.hypot(positions[i] - center[0], positions[i + 1] - center[1], positions[i + 2] - center[2]));
  }
  return { center, radius };
}

/**
 * The container: header line, version, record count, the records, then
 * the root footer. `records` is `[{ type, ...fields }]` and `roots` is
 * indices into it.
 */
export function writeNif(records, roots = [0]) {
  const o = new NifOut();
  o._push(Buffer.from(NIF_HEADER_LINE, 'latin1'));
  o.u32(MW_NIF_VERSION);
  o.u32(records.length);
  for (const rec of records) {
    const writer = WRITERS[rec.type];
    if (!writer) throw new Error(`no NIF writer for record type "${rec.type}"`);
    o.string(rec.type);
    writer(o, rec);
  }
  o.u32(roots.length);
  for (const r of roots) o.ref(r);
  return o.toBuffer();
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
  const uvs = mesh.uvs
    ? mesh.uvs.map((v, i) => (i % 2 === 1 && !keepV ? 1 - v : v))
    : null;
  const at = records.length;
  records[0].children.push(at);
  const skinAt = at + (texture ? 6 : 5);
  records.push(
    // the shape. NAMELESS unless named - see the header's MW-D6 note; a skinned part's shape is named for rule 15
    { type: 'NiTriShape', name, data: at + 1, properties: [at + 2, at + 3, at + 4], ...(skin ? { skin: skinAt } : {}) },
    { type: 'NiTriShapeData', positions: mesh.positions, normals: mesh.normals, uvs, indices: mesh.indices },
    { type: 'NiMaterialProperty', name: `${mesh.name ?? 'mesh'}Material` },
    { type: 'NiTexturingProperty', textures: [texture ? { source: at + 5 } : null] },
    { type: 'NiStencilProperty', drawMode: 3 },       // rule 65: Both
  );
  if (texture) records.push({ type: 'NiSourceTexture', fileName: texture });
  if (skin) records.push({ type: 'NiSkinInstance', data: skinAt + 1, skeletonRoot: 0, bones: skin.bones }, { type: 'NiSkinData', bones: skin.data });
}

/** An affine's inverse, for the rigid transforms a skeleton's bind is made of: (R^T, -R^T t). */
function rigidInverse({ a, t }) {
  const r = [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
  return { a: r, t: [-(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]), -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]), -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2])] };
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
        if (!nodeOf.has(name)) throw new Error(`vertex ${v} is weighted to "${name}", which is not one of the part's bones`);
        if (!per.has(name)) per.set(name, { indices: [], weights: [] });
        per.get(name).indices.push(v);
        per.get(name).weights.push(w);
      }
    });
    return bones.filter((b) => per.has(b.name)).map((b) => {
      const inv = rigidInverse(b.bind);
      const { indices, weights: ws } = per.get(b.name);
      const local = [];
      for (const v of indices) {
        const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
        local.push(inv.a[0] * x + inv.a[1] * y + inv.a[2] * z + inv.t[0], inv.a[3] * x + inv.a[4] * y + inv.a[5] * z + inv.t[1], inv.a[6] * x + inv.a[7] * y + inv.a[8] * z + inv.t[2]);
      }
      const sphere = boundingSphere(local);
      return { name: b.name, data: { transform: { rotation: inv.a, translation: inv.t, scale: 1 }, center: sphere.center, radius: sphere.radius, indices, weights: ws } };
    });
  });
  // the bones' records come after every shape's, so their indices are known once the shapes are laid out
  let next = 1;
  for (const s of shapes) next += (s.texture ? 6 : 5) + 2;
  for (const b of bones) if (shapeSkins.some((list) => list.some((x) => x.name === b.name))) boneAt.set(b.name, next++);
  shapes.forEach((shape, i) => shapeRecords(records, {
    mesh: shape.mesh, texture: shape.texture ?? null, name: shape.name ?? '',
    skin: { bones: shapeSkins[i].map((x) => boneAt.get(x.name)), data: shapeSkins[i].map((x) => x.data) },
  }, keepV));
  for (const b of bones) {
    if (!boneAt.has(b.name)) continue;
    records[0].children.push(records.length);
    records.push({ type: 'NiNode', name: b.name, translation: [...b.bind.t], rotation: [...b.bind.a], scale: 1, children: [] });
  }
  return writeNif(records, [0]);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
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
  console.log(`  ${mesh.positions.length / 3} vertices, ${mesh.indices.length / 3} triangles, texture ${opt('texture') ?? '(none)'}`);
}
