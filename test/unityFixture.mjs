// A UnityFS bundle BUILT HERE - the fixture behind the reader's pins
// (seasonsIliacBay.test.js, where it was written) and the bundle worker's
// (unitybundleworker.test.js). A byte writer, the two type trees the
// reader must walk (Texture2D, TextAsset), one SerializedFile of object
// bodies, a literals-only LZ4 encoder, and the container around a CAB.
import { COMMON_STRINGS, TEXTURE_FORMAT } from '../src/formats/unityBundle.js';
import { SEASONS_MOD } from '../src/systems/seasonsIliacBay.js';

/** A byte writer with both endiannesses. */
export class W {
  constructor() { this.parts = []; this.len = 0; }
  push(u8) { this.parts.push(u8); this.len += u8.length; return this; }
  bytes() { const out = new Uint8Array(this.len); let o = 0; for (const p of this.parts) { out.set(p, o); o += p.length; } return out; }
  u8(v) { return this.push(new Uint8Array([v & 255])); }
  u16(v, le) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, le); return this.push(b); }
  i16(v, le) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, le); return this.push(b); }
  u32(v, le) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, le); return this.push(b); }
  i32(v, le) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, le); return this.push(b); }
  f32(v, le) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, le); return this.push(b); }
  i64(v, le) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(v), le); return this.push(b); }
  cstr(s) { return this.push(new Uint8Array([...Buffer.from(s, 'utf8'), 0])); }
  align(n = 4) { while (this.len % n) this.u8(0); return this; }
  str(s, le) { const b = Buffer.from(s, 'utf8'); this.i32(b.length, le); this.push(new Uint8Array(b)); return this.align(4); }
}

/** A type tree as nested nodes [type, name, size, align, typeFlags, children]. */
export const N = (type, name, size, align = false, typeFlags = 0, children = []) => ({ type, name, size, align, typeFlags, children });
export const STRING = (name) => N('string', name, -1, false, 0, [N('Array', 'Array', -1, true, 1, [N('int', 'size', 4), N('char', 'data', 1)])]);
export const TEXTURE2D_TREE = N('Texture2D', 'Base', -1, false, 0, [
  STRING('m_Name'), N('int', 'm_ForcedFallbackFormat', 4), N('bool', 'm_DownscaleFallback', 1, true),
  N('int', 'm_Width', 4), N('int', 'm_Height', 4), N('int', 'm_CompleteImageSize', 4), N('int', 'm_TextureFormat', 4),
  N('int', 'm_MipCount', 4), N('bool', 'm_IsReadable', 1), N('bool', 'm_IgnoreMasterTextureLimit', 1), N('bool', 'm_IsPreProcessed', 1),
  N('bool', 'm_StreamingMipmaps', 1, true), N('int', 'm_StreamingMipmapsPriority', 4, true), N('int', 'm_ImageCount', 4), N('int', 'm_TextureDimension', 4),
  N('GLTextureSettings', 'm_TextureSettings', 24, false, 0, [N('int', 'm_FilterMode', 4), N('int', 'm_Aniso', 4), N('float', 'm_MipBias', 4), N('int', 'm_WrapU', 4), N('int', 'm_WrapV', 4), N('int', 'm_WrapW', 4)]),
  N('int', 'm_LightmapFormat', 4), N('int', 'm_ColorSpace', 4),
  N('TypelessData', 'image data', -1, true, 1, [N('int', 'size', 4), N('UInt8', 'data', 1)]),
  N('StreamingInfo', 'm_StreamData', -1, false, 0, [N('unsigned int', 'offset', 4), N('unsigned int', 'size', 4), STRING('path')]),
]);
export const TEXTASSET_TREE = N('TextAsset', 'Base', -1, false, 0, [STRING('m_Name'), STRING('m_Script')]);

/** Write a type tree blob (SerializedFile 21: 32-byte nodes), using the
 *  COMMON table for every name it knows and a local buffer for the rest. */
export function treeBlob(tree, le) {
  const flat = [];
  const walk = (n, level) => { flat.push({ ...n, level }); for (const c of n.children) walk(c, level + 1); };
  walk(tree, 0);
  const common = new Map([...COMMON_STRINGS].map(([k, v]) => [v, k]));
  const local = new W();
  const localOff = new Map();
  const off = (s) => {
    if (common.has(s)) return (0x80000000 | common.get(s)) >>> 0;
    if (!localOff.has(s)) { localOff.set(s, local.len); local.cstr(s); }
    return localOff.get(s);
  };
  const w = new W();
  w.i32(flat.length, le);
  const strings = new W();
  const offsets = flat.map((n) => [off(n.type), off(n.name)]);
  w.i32(local.len, le);
  flat.forEach((n, i) => {
    w.u16(1, le).u8(n.level).u8(n.typeFlags).u32(offsets[i][0], le).u32(offsets[i][1], le)
      .i32(n.size, le).i32(i, le).i32(n.align ? 0x4000 : 0, le).i64(0n, le);
  });
  w.push(local.bytes());
  void strings;
  return w.bytes();
}

/** A Texture2D object body (LE) as the tree above lays it out. */
export function texture2dBody(name, width, height, format, data) {
  const le = true;
  const w = new W();
  w.str(name, le).i32(0, le).u8(0).align(4).i32(width, le).i32(height, le).i32(data.length, le).i32(format, le).i32(1, le)
    .u8(0).u8(0).u8(0).u8(0).align(4).i32(0, le).align(4).i32(1, le).i32(2, le)
    .i32(0, le).i32(1, le).f32(0, le).i32(1, le).i32(1, le).i32(1, le)
    .i32(0, le).i32(1, le)
    .i32(data.length, le).push(data).align(4)
    .u32(0, le).u32(0, le).str('', le);
  return w.bytes();
}
export function textAssetBody(name, text) {
  return new W().str(name, true).str(text, true).bytes();
}

/** One SerializedFile (version 21, little-endian data) holding the objects. */
export function serializedFile(objects) {
  const le = true;
  const meta = new W();
  meta.cstr('2019.4.40f1').i32(5, le).u8(1);
  const types = [[28, TEXTURE2D_TREE], [49, TEXTASSET_TREE]];
  meta.i32(types.length, le);
  for (const [classId, tree] of types) {
    meta.i32(classId, le).u8(0).i16(-1, le).push(new Uint8Array(16)).push(treeBlob(tree, le)).i32(0, le);
  }
  // object bodies, each 8-aligned in the data area
  const bodies = [];
  let at = 0;
  for (const o of objects) { at = (at + 7) & ~7; bodies.push({ ...o, start: at }); at += o.body.length; }
  meta.i32(objects.length, le);
  bodies.forEach((o, i) => { meta.align(4); meta.i64(BigInt(1000 + i), le).u32(o.start, le).u32(o.body.length, le).i32(o.typeIndex, le); });
  meta.i32(0, le).i32(0, le).i32(0, le).cstr('');   // scripts, externals, ref types, user info
  const metaBytes = meta.bytes();
  const headerLen = 20;
  let dataOffset = headerLen + metaBytes.length;
  dataOffset = (dataOffset + 15) & ~15;
  const fileSize = dataOffset + at;
  const f = new W();
  f.u32(metaBytes.length, false).u32(fileSize, false).u32(21, false).u32(dataOffset, false).u8(0).push(new Uint8Array(3));
  f.push(metaBytes);
  while (f.len < dataOffset) f.u8(0);
  for (const o of bodies) { while (f.len < dataOffset + o.start) f.u8(0); f.push(o.body); }
  return f.bytes();
}

/** Literals-only LZ4 encoding: a valid block for any input. */
export function lz4Literals(src) {
  const w = new W();
  let n = src.length;
  const token = Math.min(n, 15);
  w.u8(token << 4);
  if (token === 15) { n -= 15; while (n >= 255) { w.u8(255); n -= 255; } w.u8(n); }
  w.push(src);
  return w.bytes();
}

/** The UnityFS container around one CAB, with the block info and the
 *  block either stored or LZ4-wrapped. */
export function unityFs(cab, { lz4 = false, cabName = 'CAB-test', blockSize = 0 } = {}) {
  // DW1: `blockSize` splits the CAB into several blocks, the shape
  // Unity's ChunkBasedCompression writes (128 KB each), so the reader's
  // block-lazy stream is pinned across block edges
  const pieces = [];
  if (blockSize > 0) for (let at = 0; at < cab.length; at += blockSize) pieces.push(cab.subarray(at, Math.min(cab.length, at + blockSize)));
  else pieces.push(cab);
  const blocks = pieces.map((u) => ({ u, c: lz4 ? lz4Literals(u) : u }));
  const block = new W(); for (const b of blocks) block.push(b.c);
  const info = new W();
  info.push(new Uint8Array(16)).i32(blocks.length, false);
  for (const b of blocks) info.u32(b.u.length, false).u32(b.c.length, false).u16(lz4 ? 2 : 0, false);
  info.i32(1, false).i64(0n, false).i64(BigInt(cab.length), false).u32(4, false).cstr(cabName);
  const infoBytes = info.bytes();
  const infoBlock = lz4 ? lz4Literals(infoBytes) : infoBytes;
  const h = new W();
  h.cstr('UnityFS').u32(7, false).cstr('5.x.x').cstr('2019.4.40f1');
  const sizeAt = h.len;
  h.i64(0n, false).u32(infoBlock.length, false).u32(infoBytes.length, false).u32(0x40 | (lz4 ? 2 : 0), false).align(16);
  h.push(infoBlock).push(block.bytes());
  const out = h.bytes();
  new DataView(out.buffer).setBigInt64(sizeAt, BigInt(out.length), false);
  return out;
}

export const RGBA_2x2 = new Uint8Array([
  // Unity stores the BOTTOM row first: row 0 here is the bottom row
  10, 11, 12, 13, 20, 21, 22, 23,
  30, 31, 32, 33, 40, 41, 42, 43,
]);
export const DXT5_4x4 = new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0x00, 0xf8, 0x1f, 0x00, 0x00, 0x00, 0x00, 0x00]);   // opaque red block

export function testBundle({ lz4 = false, manifest = null } = {}) {
  const objects = [
    { typeIndex: 0, body: texture2dBody('K1', 2, 2, TEXTURE_FORMAT.RGBA32, RGBA_2x2) },
    { typeIndex: 0, body: texture2dBody('K2', 4, 4, TEXTURE_FORMAT.DXT5, DXT5_4x4) },
    { typeIndex: 1, body: textAssetBody('Seasons.dfmod', JSON.stringify(manifest ?? {
      ModTitle: SEASONS_MOD.title, GUID: SEASONS_MOD.guid, Files: ['Assets/Mods/Textures/TempW/K1.png', 'Assets/Mods/Textures/TempW/K2.png'],
    })) },
  ];
  return unityFs(serializedFile(objects), { lz4 });
}
