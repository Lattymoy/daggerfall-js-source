// A MORROWIND NIF, WRITTEN. The other end of src/formats/mwNifFile.js.
//
//     node tools/nifWrite.mjs <mesh.json> <out.nif> [--texture=NAME.dds]
//                             [--node=NAME] [--keep-v]
//
// FIELD-GUN-MW2 (2026-09-20). FIELD-GUN-MW1 baked Mac's FBX into the
// batch shape `flattenNif` emits, and then stopped, because a batch is
// not where the Morrowind lane takes a part:
//
//   bindPartsInto (mwFirstPerson.js:2004-2014) does `parseNif(part.bytes)`
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
};

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
  if (!mesh?.positions?.length) throw new Error('this mesh has no positions');
  if (!mesh.indices?.length) throw new Error('this mesh has no triangles');
  // V GOES DOWN in a NIF. See the header.
  const uvs = mesh.uvs
    ? mesh.uvs.map((v, i) => (i % 2 === 1 && !keepV ? 1 - v : v))
    : null;
  const records = [
    // 0: the root. Rule 34 wipes its transform in the parser anyway.
    { type: 'NiNode', name: node ?? mesh.name ?? 'Root', children: [1] },
    // 1: the shape. NAMELESS - see the header's MW-D6 note.
    { type: 'NiTriShape', name: '', data: 2, properties: [3, 4, 5] },
    { type: 'NiTriShapeData', positions: mesh.positions, normals: mesh.normals, uvs, indices: mesh.indices },
    { type: 'NiMaterialProperty', name: `${mesh.name ?? 'mesh'}Material` },
    { type: 'NiTexturingProperty', textures: [texture ? { source: 6 } : null] },
    { type: 'NiStencilProperty', drawMode: 3 },       // rule 65: Both
  ];
  if (texture) records.push({ type: 'NiSourceTexture', fileName: texture });
  else records[4].textures = [null];
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
