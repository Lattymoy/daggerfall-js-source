// A reader for Unity AssetBundles in the UnityFS container - the
// `.dfmod` a Daggerfall Unity mod ships as. Enough of the format to
// take a mod's TEXTURES and TEXT ASSETS out of the player's own copy of
// the mod at runtime, the way the port takes ARENA2 out of the player's
// own copy of the game: the bundle never enters the repo.
//
// Written from the container as the reference readers describe it
// (AssetStudio's BundleFile/SerializedFile, UnityPy's the same), and
// validated byte for byte against a reference extraction of the two
// bundles this port has met (both Unity 2019.4.40f1, UnityFS 7,
// SerializedFile 21, LZ4HC blocks). What is NOT here, on purpose:
//   - LZMA-compressed bundles (Unity's default when a mod is built
//     without ChunkBasedCompression) - refused with a clear error;
//   - SerializedFile versions below 14 (Unity 5.0 and older: the
//     pre-blob type tree, the unaligned 32-bit path ids) and files with
//     the type tree stripped - the object layout is read FROM the tree
//     the bundle carries, which is what keeps this reader independent
//     of the Unity version, so a bundle without one is refused;
//   - every texture format but the seven a mod's PNG import lands on
//     (Alpha8, RGB24, RGBA32, ARGB32, DXT1, DXT5, and - DFMOD1 - BC7).
//
// Nothing here touches the DOM. It runs in node under the pins and in
// the browser under the data door.

import { lz4BlockDecompress } from '../lz4.js';
import { dxtDecode } from '../dxt.js';
import { bc7Decode } from '../bc7.js';
import { unpackUnityCrunch } from '../crunch.js';   // DWHD1: Diverse Weapons HD's handhelds are crunched
import { resampleRgba } from '../resample.js';   // DFMOD2: a picture past the detail with no smaller mip   // DFMOD1: DREAM's paperdoll ships its sprites as BC7

// ---- binary reader ---------------------------------------------------

class Reader {
  /** @param {Uint8Array} bytes @param {boolean} littleEndian */
  constructor(bytes, littleEndian = false) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
    this.le = littleEndian;
  }
  get length() { return this.bytes.length; }
  u8() {
    if (this.pos >= this.bytes.length) throw new Error('unity bundle: read past the end');
    return this.bytes[this.pos++];
  }
  i8() { return this.view.getInt8(this.pos++); }
  u16() { const v = this.view.getUint16(this.pos, this.le); this.pos += 2; return v; }
  i16() { const v = this.view.getInt16(this.pos, this.le); this.pos += 2; return v; }
  u32() { const v = this.view.getUint32(this.pos, this.le); this.pos += 4; return v; }
  i32() { const v = this.view.getInt32(this.pos, this.le); this.pos += 4; return v; }
  f32() { const v = this.view.getFloat32(this.pos, this.le); this.pos += 4; return v; }
  f64() { const v = this.view.getFloat64(this.pos, this.le); this.pos += 8; return v; }
  i64() { const v = this.view.getBigInt64(this.pos, this.le); this.pos += 8; return v; }
  u64() { const v = this.view.getBigUint64(this.pos, this.le); this.pos += 8; return v; }
  bytesOf(n) {
    if (this.pos + n > this.bytes.length) throw new Error(`unity bundle: read of ${n} bytes past the end`);
    const v = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return v;
  }
  cstr() {
    const start = this.pos;
    while (this.pos < this.bytes.length && this.bytes[this.pos] !== 0) this.pos++;
    const s = utf8(this.bytes.subarray(start, this.pos));
    this.pos++;   // the terminator
    return s;
  }
  align(n = 4) { this.pos = (this.pos + n - 1) & ~(n - 1); }
}

const utf8 = (b) => new TextDecoder('utf-8').decode(b);

// ---- UnityFS container -------------------------------------------------

/** Archive flags (the pre-2020.3.34 set, which every 2019 bundle wears). */
const COMPRESSION_MASK = 0x3f;
const BLOCKS_INFO_AT_END = 0x80;
const BLOCK_INFO_NEED_PADDING = 0x200;   // only meaningful on the newer flag set
const COMPRESSION = Object.freeze({ NONE: 0, LZMA: 1, LZ4: 2, LZ4HC: 3 });

function decompress(src, uncompressedSize, flags) {
  const mode = flags & COMPRESSION_MASK;
  if (mode === COMPRESSION.NONE) {
    // AUDIT 68 S12-bundle-stored-block-short: a truncated stored block is
    // corrupt, as a short LZ4 block is - never a zero-filled tail
    if (src.length < uncompressedSize) throw new Error(`unity bundle: stored block holds ${src.length} of ${uncompressedSize} bytes`);
    return src.subarray(0, uncompressedSize);
  }
  if (mode === COMPRESSION.LZ4 || mode === COMPRESSION.LZ4HC) return lz4BlockDecompress(src, uncompressedSize);
  if (mode === COMPRESSION.LZMA) throw new Error('unity bundle: LZMA-compressed bundles are not supported (build the mod with ChunkBasedCompression, or unpack it once)');
  throw new Error(`unity bundle: unknown compression ${mode}`);
}

/** Unity's version string -> [major, minor, patch] for the flag-set rule. */
export function parseUnityVersion(s) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(s ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/** The newer archive-flag set arrived mid-2020.3, 2021.3 and 2022.1
 *  (AssetStudio's BundleFile.ReadHeader rule, kept verbatim). */
export function usesNewArchiveFlags([a, b, c]) {
  if (a < 2020) return false;
  if (a === 2020) return b > 3 || (b === 3 && c >= 34);
  if (a === 2021) return b > 3 || (b === 3 && c >= 2);
  if (a === 2022) return b > 1 || (b === 1 && c >= 1);
  return true;
}

/** DFMOD2: the bundle as a random-access BYTE SOURCE - `{ size, slice(start, end) -> Uint8Array }`. A Uint8Array
 *  is its own; a multi-gigabyte `.dfmod` (DREAM's full set) is a Blob read by range in the worker
 *  (unityBundleWorker.js blobSource), because the whole file as one ArrayBuffer is past what a tab can hold. */
export function byteSource(bytes) {
  if (bytes instanceof Uint8Array) return { size: bytes.length, slice: (a, b) => bytes.subarray(a, Math.min(bytes.length, b)) };
  if (typeof Blob !== 'undefined' && bytes instanceof Blob) throw new Error('unity bundle: a Blob is read by range in the worker (blobSource), not here');
  if (bytes && typeof bytes.slice === 'function' && Number.isFinite(bytes.size)) return bytes;
  throw new Error('unity bundle: not a byte source');
}
/** How much of the front a header is read from - the signature, two version strings and a few fields. */
const HEADER_PEEK = 4096;

/**
 * Open a UnityFS bundle: header, blocks, directory. Returns the
 * container's files as byte views, still undecoded.
 * @param {Uint8Array | {size:number, slice:(a:number,b:number)=>Uint8Array}} bytes
 */
export function readUnityFs(bytes) {
  const src = byteSource(bytes);
  const r = new Reader(src.slice(0, Math.min(src.size, HEADER_PEEK)), false);
  const signature = r.cstr();
  if (signature !== 'UnityFS') throw new Error(`unity bundle: not a UnityFS archive (signature ${JSON.stringify(signature)})`);
  const version = r.u32();
  const unityVersion = r.cstr();
  const unityRevision = r.cstr();
  r.i64();   // the whole bundle's size
  const compressedInfoSize = r.u32();
  const uncompressedInfoSize = r.u32();
  const flags = r.u32();
  const engine = parseUnityVersion(unityRevision);
  const newFlags = usesNewArchiveFlags(engine);
  if (version >= 7 || (engine[0] === 2019 && (engine[1] > 4 || (engine[1] === 4 && engine[2] >= 15)))) r.align(16);
  const start = r.pos;
  let infoBytes;
  let pos = start;   // DFMOD2: an absolute position in the source from here on
  if (flags & BLOCKS_INFO_AT_END) {
    infoBytes = src.slice(src.size - compressedInfoSize, src.size);
  } else {
    infoBytes = src.slice(start, start + compressedInfoSize);
    pos = start + compressedInfoSize;
  }
  if (infoBytes.length < compressedInfoSize) throw new Error('unity bundle: the block directory runs past the end');
  const info = new Reader(decompress(infoBytes, uncompressedInfoSize, flags), false);
  info.bytesOf(16);   // the uncompressed data hash
  const blockCount = info.i32();
  const blocks = [];
  for (let i = 0; i < blockCount; i++) {
    blocks.push({ uncompressedSize: info.u32(), compressedSize: info.u32(), flags: info.u16() });
  }
  const nodeCount = info.i32();
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({ offset: Number(info.i64()), size: Number(info.i64()), flags: info.u32(), path: info.cstr() });
  }
  if (newFlags && (flags & BLOCK_INFO_NEED_PADDING)) pos = (pos + 15) & ~15;
  if (flags & BLOCKS_INFO_AT_END) pos = start;
  // DW1: THE BLOCKS STAY COMPRESSED. This used to decompress every
  // block into one stream the directory indexed - which is the whole
  // bundle in memory, and for a bundle that is 58 MB of LZ4 around
  // 1.69 GB of pixels (Diverse Weapons: 12,934 textures inline in one
  // serialized file, no .resS) that is the tab. A file is a byte
  // SOURCE now: `read(offset, length)` decompresses only the blocks
  // that span the range, through a small LRU, and `bytes` materialises
  // the whole file for the callers that want it (a test's CAB, a
  // manifest) - a mod's whole bundle is never held at once.
  const stream = blockStream(src, pos, blocks);
  const files = nodes.map((n) => {
    let whole = null;
    return {
      path: n.path, flags: n.flags, size: n.size,
      read: (offset, length) => stream.read(n.offset + offset, length),
      get bytes() { return whole ??= stream.read(n.offset, n.size); },
    };
  });
  return { signature, version, unityVersion, unityRevision, flags, files };
}

/** How many decompressed blocks are kept. Unity's ChunkBasedCompression
 *  writes 128 KB blocks, so this is a few MB - enough that an index
 *  pass over objects laid out in order re-decompresses nothing, and a
 *  texture spanning a block edge finds both halves. */
export const BLOCK_CACHE = 32;

/** The compressed blocks as one addressable uncompressed stream, a
 *  block at a time. `read` answers a fresh Uint8Array of exactly
 *  `length` bytes (short at the end of the stream), never a view into
 *  the cache, so a caller may hold it while the cache turns over. */
function blockStream(src, dataStart, blocks) {
  const cOff = new Array(blocks.length);   // compressed offset of block i in `bytes`
  const uOff = new Array(blocks.length + 1);   // uncompressed offset of block i; the last entry is the total
  let c = dataStart, u = 0;
  for (let i = 0; i < blocks.length; i++) { cOff[i] = c; uOff[i] = u; c += blocks[i].compressedSize; u += blocks[i].uncompressedSize; }
  uOff[blocks.length] = u;
  const cache = new Map();   // block index -> decompressed bytes, insertion order = age
  const block = (i) => {
    let d = cache.get(i);
    if (d) { cache.delete(i); cache.set(i, d); return d; }   // touched: youngest again
    const b = blocks[i];
    d = decompress(src.slice(cOff[i], cOff[i] + b.compressedSize), b.uncompressedSize, b.flags);
    cache.set(i, d);
    if (cache.size > BLOCK_CACHE) cache.delete(cache.keys().next().value);
    return d;
  };
  const total = u;
  return {
    size: total,
    read(offset, length) {
      if (!(offset >= 0) || !(length >= 0)) throw new Error(`unity bundle: bad read ${offset}+${length}`);
      const end = Math.min(total, offset + length);
      const out = new Uint8Array(Math.max(0, end - offset));
      if (!out.length) return out;
      // the first block holding `offset`, by binary search over the prefix sums
      let lo = 0, hi = blocks.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (uOff[mid] <= offset) lo = mid; else hi = mid - 1; }
      let at = offset, put = 0;
      for (let i = lo; i < blocks.length && at < end; i++) {
        const d = block(i);
        const from = at - uOff[i];
        const n = Math.min(d.length - from, end - at);
        out.set(d.subarray(from, from + n), put);
        at += n; put += n;
      }
      return out;
    },
  };
}

// ---- SerializedFile ----------------------------------------------------

/** The common-string table a type tree's names index with the high bit
 *  set (AssetStudio's CommonString, the 2019 extent). */
export const COMMON_STRINGS = Object.freeze(new Map([
  [0, 'AABB'], [5, 'AnimationClip'], [19, 'AnimationCurve'], [34, 'AnimationState'], [49, 'Array'], [55, 'Base'],
  [60, 'BitField'], [69, 'bitset'], [76, 'bool'], [81, 'char'], [86, 'ColorRGBA'], [96, 'Component'], [106, 'data'],
  [111, 'deque'], [117, 'double'], [124, 'dynamic_array'], [138, 'FastPropertyName'], [155, 'first'], [161, 'float'],
  [167, 'Font'], [172, 'GameObject'], [183, 'Generic Mono'], [196, 'GradientNEW'], [208, 'GUID'], [213, 'GUIStyle'],
  [222, 'int'], [226, 'list'], [231, 'long long'], [241, 'map'], [245, 'Matrix4x4f'], [256, 'MdFour'],
  [263, 'MonoBehaviour'], [277, 'MonoScript'], [288, 'm_ByteSize'], [299, 'm_Curve'], [307, 'm_EditorClassIdentifier'],
  [331, 'm_EditorHideFlags'], [349, 'm_Enabled'], [359, 'm_ExtensionPtr'], [374, 'm_GameObject'], [387, 'm_Index'],
  [395, 'm_IsArray'], [405, 'm_IsStatic'], [416, 'm_MetaFlag'], [427, 'm_Name'], [434, 'm_ObjectHideFlags'],
  [452, 'm_PrefabInternal'], [469, 'm_PrefabParentObject'], [490, 'm_Script'], [499, 'm_StaticEditorFlags'],
  [519, 'm_Type'], [526, 'm_Version'], [536, 'Object'], [543, 'pair'], [548, 'PPtr<Component>'],
  [564, 'PPtr<GameObject>'], [581, 'PPtr<Material>'], [596, 'PPtr<MonoBehaviour>'], [616, 'PPtr<MonoScript>'],
  [633, 'PPtr<Object>'], [646, 'PPtr<Prefab>'], [659, 'PPtr<Sprite>'], [672, 'PPtr<TextAsset>'], [688, 'PPtr<Texture>'],
  [702, 'PPtr<Texture2D>'], [718, 'PPtr<Transform>'], [734, 'Prefab'], [741, 'Quaternionf'], [753, 'Rectf'],
  [759, 'RectInt'], [767, 'RectOffset'], [778, 'second'], [785, 'set'], [789, 'short'], [795, 'size'], [800, 'SInt16'],
  [807, 'SInt32'], [814, 'SInt64'], [821, 'SInt8'], [827, 'staticvector'], [840, 'string'], [847, 'TextAsset'],
  [857, 'TextMesh'], [866, 'Texture'], [874, 'Texture2D'], [884, 'Transform'], [894, 'TypelessData'], [907, 'UInt16'],
  [914, 'UInt32'], [921, 'UInt64'], [928, 'UInt8'], [934, 'unsigned int'], [947, 'unsigned long long'],
  [966, 'unsigned short'], [981, 'vector'], [988, 'Vector2f'], [997, 'Vector3f'], [1006, 'Vector4f'],
  [1015, 'm_ScriptingClassIdentifier'], [1042, 'Gradient'], [1051, 'Type*'], [1057, 'int2_storage'],
  [1070, 'int3_storage'], [1083, 'BoundsInt'], [1093, 'm_CorrespondingSourceObject'], [1121, 'm_PrefabInstance'],
  [1138, 'm_PrefabAsset'], [1152, 'FileSize'], [1161, 'Hash128'],
]));

const ALIGN_FLAG = 0x4000;

/** Read one type tree in the blob format (SerializedFile 12+). */
function readTypeTreeBlob(r, version) {
  const nodeCount = r.i32();
  const stringSize = r.i32();
  const nodeSize = version >= 19 ? 32 : 24;
  const nodeBytes = r.bytesOf(nodeSize * nodeCount);
  const strings = r.bytesOf(stringSize);
  const nv = new DataView(nodeBytes.buffer, nodeBytes.byteOffset, nodeBytes.byteLength);
  const le = r.le;
  const str = (v) => {
    if ((v & 0x80000000) === 0) {
      let end = v;
      while (end < strings.length && strings[end] !== 0) end++;
      return utf8(strings.subarray(v, end));
    }
    const off = v & 0x7fffffff;
    return COMMON_STRINGS.get(off) ?? String(off);
  };
  const root = { level: -1, children: [] };
  const stack = [root];
  let parent = root;
  let prev = root;
  for (let i = 0; i < nodeCount; i++) {
    const o = i * nodeSize;
    const node = {
      version: nv.getUint16(o, le),
      level: nv.getUint8(o + 2),
      typeFlags: nv.getUint8(o + 3),
      type: str(nv.getUint32(o + 4, le)),
      name: str(nv.getUint32(o + 8, le)),
      byteSize: nv.getInt32(o + 12, le),
      index: nv.getInt32(o + 16, le),
      metaFlag: nv.getInt32(o + 20, le),
      children: [],
    };
    if (node.level > prev.level) { stack.push(parent); parent = prev; }
    else if (node.level < prev.level) { while (node.level <= parent.level) parent = stack.pop(); }
    parent.children.push(node);
    prev = node;
  }
  return root.children[0];
}

/** Does this container file look like a SerializedFile? The header is
 *  big-endian: metadata size, file size, version, data offset - and
 *  from version 22 the 32-bit size slot is written as 0 and the real
 *  64-bit size follows the endian byte, so the size is read where that
 *  version keeps it (the reference readers' IsSerializedFile rule). */
/** Whether a file's first bytes are a SerializedFile header whose
 *  recorded size is the file's own. `size` is the whole file's length;
 *  `head` need only be its first 48 bytes (DW1: a lazy file is not
 *  read whole to be recognised). */
function looksSerialized(head, size = head.length) {
  if (head.length < 20) return false;
  const v = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const version = v.getUint32(8);
  if (version < 5 || version > 40) return false;
  if (version >= 22) {
    if (head.length < 48) return false;
    return Number(v.getBigInt64(24)) === size;
  }
  return v.getUint32(4) === size;
}

/**
 * Parse a SerializedFile's header, type table and object table.
 * @param {Uint8Array} bytes the file within the container
 * @param {string} name the container path
 */
export function readSerializedFile(source, name) {
  // DW1: a Uint8Array, or a lazy `{ size, read(offset, length) }` from
  // readUnityFs. The header and the metadata are read once, whole; an
  // object's body is read when `read()` is called, and only that body.
  const src = source instanceof Uint8Array
    ? { size: source.length, read: (o, n) => source.subarray(o, Math.min(source.length, o + n)) }
    : source;
  const head = new Reader(src.read(0, Math.min(src.size, 48)), false);
  let metadataSize = head.u32();
  head.u32();   // fileSize, re-read below
  const headerVersion = head.u32();
  if (headerVersion >= 22) { head.u32(); head.u8(); head.bytesOf(3); metadataSize = head.u32(); }
  const headerSize = headerVersion >= 22 ? 48 : 20;
  const bytes = src.read(0, Math.min(src.size, headerSize + metadataSize + 64));   // the metadata, and a little slack for the alignment its tail takes
  const r = new Reader(bytes, false);
  metadataSize = r.u32();
  let fileSize = r.u32();
  const version = r.u32();
  let dataOffset = r.u32();
  let littleEndian = false;
  if (version >= 9) {
    littleEndian = r.u8() === 0;
    r.bytesOf(3);
    if (version >= 22) {
      metadataSize = r.u32();
      fileSize = Number(r.i64());
      dataOffset = Number(r.i64());
      r.i64();
    }
  } else {
    throw new Error(`unity bundle: SerializedFile version ${version} is older than this reader`);
  }
  r.le = littleEndian;
  const unityVersion = version >= 7 ? r.cstr() : '';
  const targetPlatform = version >= 8 ? r.i32() : 0;
  const enableTypeTree = version >= 13 ? r.u8() !== 0 : true;
  if (!enableTypeTree) throw new Error(`unity bundle: ${name} carries no type tree; this reader takes the object layout from it`);
  // Below 14 the object table is a different shape (unaligned 32-bit
  // path ids unless bigIdEnabled, an isDestroyed field before 11) and
  // 9 and 11 write the old type-tree format: Unity 5.0 and older, which
  // no DFU mod is built with. Refused whole rather than read wrongly.
  if (version < 14) throw new Error(`unity bundle: SerializedFile ${version} (Unity 5.0 or older) is older than this reader`);
  const typeCount = r.i32();
  const types = [];
  for (let i = 0; i < typeCount; i++) {
    const classId = r.i32();
    if (version >= 16) r.u8();   // isStrippedType
    const scriptTypeIndex = version >= 17 ? r.i16() : -1;
    if (version >= 13) {
      if ((version < 16 && classId < 0) || (version >= 16 && classId === 114)) r.bytesOf(16);
      r.bytesOf(16);   // oldTypeHash
    }
    const node = readTypeTreeBlob(r, version);
    if (version >= 21) { const n = r.i32(); r.bytesOf(4 * n); }   // typeDependencies
    types.push({ classId, scriptTypeIndex, node });
  }
  if (version >= 7 && version < 14) r.i32();   // bigIdEnabled
  const objectCount = r.i32();
  const objects = [];
  for (let i = 0; i < objectCount; i++) {
    r.align(4);
    const pathId = r.i64();
    const byteStart = version >= 22 ? Number(r.i64()) : r.u32();
    const byteSize = r.u32();
    const typeId = r.i32();
    let type;
    let classId;
    if (version < 16) {
      classId = r.u16();
      type = types.find((t) => t.classId === typeId) ?? null;
    } else {
      type = types[typeId];
      classId = type.classId;
    }
    if (version >= 11 && version < 17) r.i16();
    if (version === 15 || version === 16) r.u8();
    objects.push({
      pathId, classId, byteStart: dataOffset + byteStart, byteSize, type,
      /** Parse the object through its type tree. */
      read: () => readObject(src.read(dataOffset + byteStart, byteSize), 0, byteSize, type?.node, littleEndian),
      /** DFMOD2: the object's top-level fields BEFORE `stopAt`, off the front of its body only - a texture's name,
       *  size and format without reading (and, inline, decompressing) its pixels. Null when the front is not enough. */
      head: (stopAt, peek = 2048) => readObjectHead(src.read(dataOffset + byteStart, Math.min(byteSize, peek)), type?.node, littleEndian, stopAt),
    });
  }
  // CSA-A: the files a pointer's m_FileID names (1 is the first entry) - a
  // mod's prefab points into Unity's own "unity default resources" for its
  // built-in cube, sphere and plane. Read when the metadata holds them; a
  // reader that stops short (an older header) leaves the list empty.
  const externals = [];
  try {
    if (version >= 11) {
      const scriptTypes = r.i32();
      for (let i = 0; i < scriptTypes; i++) { r.i32(); if (version >= 14) { r.align(4); r.i64(); } else r.i32(); }
    }
    const count = r.i32();
    for (let i = 0; i < count; i++) {
      if (version >= 6) r.cstr();   // tempEmpty
      const guid = version >= 5 ? r.bytesOf(16) : null;
      const type = version >= 5 ? r.i32() : 0;
      externals.push({ path: r.cstr(), type, guid: guid ? [...guid].map((x) => x.toString(16).padStart(2, '0')).join('') : null });
    }
  } catch { externals.length = 0; }
  return { name, version, unityVersion, targetPlatform, littleEndian, metadataSize, fileSize, dataOffset, types, objects, externals };
}

const PRIMITIVES = {
  bool: (r) => r.u8() !== 0,
  SInt8: (r) => r.i8(), UInt8: (r) => r.u8(), char: (r) => r.u8(),
  short: (r) => r.i16(), SInt16: (r) => r.i16(), UInt16: (r) => r.u16(), 'unsigned short': (r) => r.u16(),
  int: (r) => r.i32(), SInt32: (r) => r.i32(), UInt32: (r) => r.u32(), 'unsigned int': (r) => r.u32(), 'Type*': (r) => r.u32(),
  'long long': (r) => r.i64(), SInt64: (r) => r.i64(), UInt64: (r) => r.u64(), 'unsigned long long': (r) => r.u64(), FileSize: (r) => r.u64(),
  float: (r) => r.f32(), double: (r) => r.f64(),
};

/** The generic type-tree walk (the reference readers' read_value):
 *  primitives by name, `string` and `TypelessData` as sized byte runs,
 *  an `Array` child as a sized vector, anything else as a class of its
 *  children; a node whose meta flag carries 0x4000 aligns to 4 after. */
function readValue(node, r) {
  let align = (node.metaFlag & ALIGN_FLAG) !== 0;
  let value;
  const prim = PRIMITIVES[node.type];
  if (prim) {
    value = prim(r);
  } else if (node.type === 'string') {
    const n = r.i32();
    const raw = r.bytesOf(n);
    // A TextAsset's m_Script is declared `string` and may be binary (a
    // mod's DLL rides in one); it stays bytes. Every other string - a
    // name, a path - decodes.
    value = node.name === 'm_Script' ? raw.slice() : utf8(raw);
    align = true;
  } else if (node.type === 'TypelessData') {
    const n = r.i32();
    value = r.bytesOf(n);
  } else if (node.children.length && node.children[0].type === 'Array') {
    const arr = node.children[0];
    if (arr.metaFlag & ALIGN_FLAG) align = true;
    const n = r.i32();
    if (n < 0) throw new Error('unity bundle: negative array length');
    // Every element consumes at least one byte, so a count past the
    // bytes that remain is corrupt - and refused BEFORE the allocation,
    // which for a count near 2^31 is not a catchable error but the tab.
    if (n > r.length - r.pos) throw new Error(`unity bundle: array length ${n} exceeds the ${r.length - r.pos} bytes that remain`);
    const sub = arr.children[1];
    if ((sub.type === 'UInt8' || sub.type === 'char') && !(sub.metaFlag & ALIGN_FLAG)) {
      value = r.bytesOf(n);
    } else {
      value = new Array(n);
      for (let i = 0; i < n; i++) value[i] = readValue(sub, r);
    }
  } else {
    value = {};
    for (const c of node.children) value[c.name] = readValue(c, r);
  }
  if (align) r.align(4);
  return value;
}

/** DFMOD2: the top-level fields of an object up to (not including) `stopAt`, from a prefix of its body; null when
 *  the prefix runs out first (the caller reads the whole object instead). */
function readObjectHead(prefix, node, littleEndian, stopAt) {
  if (!node) throw new Error('unity bundle: object has no type tree');
  const r = new Reader(prefix, littleEndian);
  const value = {};
  try {
    for (const c of node.children) {
      if (c.name === stopAt) return value;
      value[c.name] = readValue(c, r);
    }
    return value;
  } catch { return null; }
}

function readObject(fileBytes, start, size, node, littleEndian) {
  if (!node) throw new Error('unity bundle: object has no type tree');
  const r = new Reader(fileBytes, littleEndian);
  r.pos = start;
  const v = readValue(node, r);
  if (r.pos - start !== size) throw new Error(`unity bundle: ${node.type} read ${r.pos - start} of ${size} bytes`);
  return v;
}

// ---- the objects a mod carries ------------------------------------------

export const CLASS_ID = Object.freeze({ Texture2D: 28, TextAsset: 49, AssetBundle: 142, Texture2DArray: 187 });   // GROUND1: the array DREAM's terrain ships as

/** Unity's TextureFormat values this reader decodes. */
export const TEXTURE_FORMAT = Object.freeze({ Alpha8: 1, RGB24: 3, RGBA32: 4, ARGB32: 5, DXT1: 10, DXT5: 12, BC7: 25, DXT1Crunched: 28, DXT5Crunched: 29 });

/**
 * Decode a parsed Texture2D to RGBA8, TOP ROW FIRST - the raster order
 * a PNG decodes to, since Unity stores its rows bottom-up and this
 * reader reverses them. That order is the reader's contract for any
 * bundle consumer, NOT a claim about what its callers want: the port
 * uploads textures in getColor32 (bottom-up) order, so a caller that
 * feeds one of these to the renderer converts at its own door - see
 * `toColor32Order` in `formats/color32Order.js`, the one place that
 * conversion lives, which BOTH such doors import:
 * `systems/seasonsIliacBayAssets.js` (the seasons mod's textures) and
 * `systems/textureReplacement.js` (M-TEX's loose-file swap). Mip 0
 * only.
 * @param {object} tex the Texture2D value
 * @param {(path:string, offset:number, size:number) => Uint8Array} resource
 *   resolves the bundle's `.resS` streams for a texture that streams
 * @returns {{width:number,height:number,data:Uint8Array}}
 */
export function decodeTexture2D(tex, resource = null, { maxSize = Infinity } = {}) {
  // DWHD1: A CRUNCHED TEXTURE is one CRN stream carrying its own mip levels - unpacked to plain DXT blocks at the
  // level the detail asks for, then decoded as DXT1/DXT5 are (Diverse Weapons HD, format 29)
  if (tex.m_TextureFormat === TEXTURE_FORMAT.DXT1Crunched || tex.m_TextureFormat === TEXTURE_FORMAT.DXT5Crunched) {
    let crn = tex['image data'];
    const st = tex.m_StreamData;
    if ((!crn || !crn.length) && st && st.size > 0) {
      if (!resource) throw new Error(`unity bundle: ${tex.m_Name} streams from ${st.path} and no resource resolver was given`);
      crn = resource(st.path, Number(st.offset), Number(st.size));
    }
    if (!crn || !crn.length) throw new Error(`unity bundle: ${tex.m_Name} carries no image data`);
    const lvl = mipLevelFor(tex, maxSize);
    const u = unpackUnityCrunch(crn, lvl);
    const px = dxtDecode(u.blocks, u.width, u.height, u.format === 'DXT5');
    const flipped = new Uint8Array(px.length);   // bottom-up to top-down, as below
    const row = u.width * 4;
    for (let y = 0; y < u.height; y++) flipped.set(px.subarray(y * row, (y + 1) * row), (u.height - 1 - y) * row);
    return { width: u.width, height: u.height, data: flipped };
  }
  // DFMOD2: A SMALLER MIP WHEN THE PICTURE IS BIGGER THAN ASKED. Unity stores the mip chain after mip 0, so a
  // 2048-pixel DREAM wall asked at 512 is mip 2 - a sixteenth of the decode and of the memory it stands in.
  const level = mipLevelFor(tex, maxSize);
  const { offset: mipOffset, size: mipSize } = mipSpan(tex, level);
  const width = Math.max(1, tex.m_Width >> level);
  const height = Math.max(1, tex.m_Height >> level);
  const format = tex.m_TextureFormat;
  let src = tex['image data'];
  const stream = tex.m_StreamData;
  if ((!src || !src.length) && stream && stream.size > 0) {
    if (!resource) throw new Error(`unity bundle: ${tex.m_Name} streams from ${stream.path} and no resource resolver was given`);
    src = level ? resource(stream.path, Number(stream.offset) + mipOffset, mipSize) : resource(stream.path, Number(stream.offset), Number(stream.size));
  } else if (src && level) {
    src = src.subarray(mipOffset, mipOffset + mipSize);
  }
  if (!src) throw new Error(`unity bundle: ${tex.m_Name} carries no image data`);
  let rgba;
  const n = width * height;
  // Mip 0 comes first and must be whole: a short buffer is corrupt, not
  // a darker picture (the block formats check the same in dxtDecode).
  const RAW_BPP = { [TEXTURE_FORMAT.RGBA32]: 4, [TEXTURE_FORMAT.ARGB32]: 4, [TEXTURE_FORMAT.RGB24]: 3, [TEXTURE_FORMAT.Alpha8]: 1 };
  if (RAW_BPP[format] && src.length < n * RAW_BPP[format]) {
    throw new Error(`unity bundle: ${tex.m_Name} carries ${src.length} bytes for ${width}x${height} at ${RAW_BPP[format]} bytes a texel`);
  }
  switch (format) {
    case TEXTURE_FORMAT.RGBA32:
      rgba = src.slice(0, n * 4);
      break;
    case TEXTURE_FORMAT.ARGB32:
      rgba = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        rgba[i * 4] = src[i * 4 + 1]; rgba[i * 4 + 1] = src[i * 4 + 2]; rgba[i * 4 + 2] = src[i * 4 + 3]; rgba[i * 4 + 3] = src[i * 4];
      }
      break;
    case TEXTURE_FORMAT.RGB24:
      rgba = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        rgba[i * 4] = src[i * 3]; rgba[i * 4 + 1] = src[i * 3 + 1]; rgba[i * 4 + 2] = src[i * 3 + 2]; rgba[i * 4 + 3] = 255;
      }
      break;
    case TEXTURE_FORMAT.Alpha8:
      rgba = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) { rgba[i * 4] = 0; rgba[i * 4 + 1] = 0; rgba[i * 4 + 2] = 0; rgba[i * 4 + 3] = src[i]; }
      break;
    case TEXTURE_FORMAT.DXT1:
      rgba = dxtDecode(src, width, height, false);
      break;
    case TEXTURE_FORMAT.DXT5:
      rgba = dxtDecode(src, width, height, true);
      break;
    case TEXTURE_FORMAT.BC7:
      rgba = bc7Decode(src, width, height);
      break;
    default:
      throw new Error(`unity bundle: ${tex.m_Name} is TextureFormat ${format}, which this reader does not decode`);
  }
  // Bottom-up to top-down.
  const out = new Uint8Array(n * 4);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(rgba.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return { width, height, data: out };
}

// ---- GROUND1: TEXTURE ARRAYS (DREAM's terrain) ---------------------------------------------------------------------
// A Texture2DArray names its format as a GraphicsFormat, not a TextureFormat. The ones a DFU texture mod's terrain
// is built with, mapped to the TextureFormat decode they share (UnityEngine.Experimental.Rendering.GraphicsFormat).
const GRAPHICS_FORMAT = Object.freeze({
  4: TEXTURE_FORMAT.RGBA32, 8: TEXTURE_FORMAT.RGBA32,        // R8G8B8A8 _SRGB / _UNorm
  96: TEXTURE_FORMAT.DXT1, 97: TEXTURE_FORMAT.DXT1,          // RGBA_DXT1 _SRGB / _UNorm
  100: TEXTURE_FORMAT.DXT5, 101: TEXTURE_FORMAT.DXT5,        // RGBA_DXT5 _SRGB / _UNorm
  108: TEXTURE_FORMAT.BC7, 109: TEXTURE_FORMAT.BC7,          // RGBA_BC7 _SRGB / _UNorm - DREAM's
});
/**
 * Every slice of a Texture2DArray, mip 0, top-down RGBA `{ width, height, data }` each (a decoded PNG's order, as
 * decodeTexture2D answers). Unity lays the data out SLICE-major - each slice's whole mip chain, then the next - so a
 * slice is `m_DataSize / m_Depth` bytes and its mip 0 is the front of it (checked on DREAM's 302: water, dirt, grass,
 * a dirt-grass edge at records 0, 1, 2, 10).
 */
export function decodeTextureArray(arr, resource = null) {
  const format = GRAPHICS_FORMAT[arr.m_Format];
  if (format == null) throw new Error(`unity bundle: ${arr.m_Name} is GraphicsFormat ${arr.m_Format}, which this reader does not decode`);
  let data = arr['image data'];
  const st = arr.m_StreamData;
  if ((!data || !data.length) && st && st.size > 0) {
    if (!resource) throw new Error(`unity bundle: ${arr.m_Name} streams from ${st.path} and no resource resolver was given`);
    data = resource(st.path, Number(st.offset), Number(st.size));
  }
  const depth = arr.m_Depth | 0;
  if (!data || !depth) throw new Error(`unity bundle: ${arr.m_Name} carries no image data`);
  const per = Math.floor(Number(arr.m_DataSize || data.length) / depth);
  const out = [];
  for (let i = 0; i < depth; i++) {
    out.push(decodeTexture2D({ m_Name: `${arr.m_Name}[${i}]`, m_Width: arr.m_Width, m_Height: arr.m_Height, m_MipCount: 1, m_TextureFormat: format, 'image data': data.subarray(i * per, (i + 1) * per) }));
  }
  return out;
}

/** Bytes one mip level of a format takes; 0 for a format this reader does not decode. */
function mipBytes(format, w, h) {
  const blocks = Math.max(1, Math.ceil(w / 4)) * Math.max(1, Math.ceil(h / 4));
  switch (format) {
    case TEXTURE_FORMAT.DXT1: return blocks * 8;
    case TEXTURE_FORMAT.DXT5: case TEXTURE_FORMAT.BC7: return blocks * 16;
    case TEXTURE_FORMAT.RGBA32: case TEXTURE_FORMAT.ARGB32: return w * h * 4;
    case TEXTURE_FORMAT.RGB24: return w * h * 3;
    case TEXTURE_FORMAT.Alpha8: return w * h;
    default: return 0;
  }
}
/** The first mip level no larger than `maxSize` on its longer side, within the chain the texture carries. */
export function mipLevelFor(tex, maxSize = Infinity) {
  const count = Math.max(1, tex.m_MipCount ?? tex.mipCount ?? 1);
  let level = 0;
  while (level < count - 1 && Math.max(tex.m_Width >> level, tex.m_Height >> level) > maxSize) level++;
  return level;
}
/** Where mip `level` starts in the image data, and its byte size. */
export function mipSpan(tex, level) {
  let offset = 0;
  for (let i = 0; i < level; i++) offset += mipBytes(tex.m_TextureFormat, Math.max(1, tex.m_Width >> i), Math.max(1, tex.m_Height >> i));
  return { offset, size: mipBytes(tex.m_TextureFormat, Math.max(1, tex.m_Width >> level), Math.max(1, tex.m_Height >> level)) };
}

/**
 * Open a `.dfmod` (or any UnityFS bundle) and index its textures and
 * text assets by name. Textures decode lazily through `rgba()`.
 * @param {Uint8Array} bytes
 */
/** DFMOD2: one texture decoded no larger than `maxSize` - the mip that fits, else mip 0 box-filtered down. */
function decodeCapped(tex, resource, maxSize) {
  const img = decodeTexture2D(tex, resource, { maxSize });
  if (Math.max(img.width, img.height) <= maxSize) return img;
  const k = maxSize / Math.max(img.width, img.height);
  const r = resampleRgba(img, img.width * k, img.height * k);
  return { width: r.width, height: r.height, data: r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength) };
}

/**
 * DFMOD2: `knownTextures` - the texture list a stored index already carries ([[name, width, height], ...] in object
 * order) - lets an open skip every texture's head read and every text asset (a 330 MB inline bundle's index is
 * otherwise 200 MB of decompression). It is used only when it counts exactly the Texture2D objects the file holds;
 * anything else reads the heads as before.
 */
export function readUnityBundle(bytes, { maxTextureSize = Infinity, knownTextures = null } = {}) {
  const fs = readUnityFs(bytes);
  const resources = new Map();
  const assets = [];
  for (const f of fs.files) {
    if (looksSerialized(f.read(0, 48), f.size)) assets.push(readSerializedFile(f, f.path));
    else resources.set(f.path, f);
  }
  const resource = (path, offset, size) => {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const res = resources.get(base) ?? resources.get(path);
    if (!res) throw new Error(`unity bundle: resource ${path} is not in the container`);
    if (offset < 0 || size < 0 || offset + size > res.size) throw new Error(`unity bundle: ${path} stream ${offset}+${size} runs past ${res.size} bytes`);
    return res.read(offset, size);
  };
  const textures = [];
  const textAssets = [];
  const texObjects = [];
  for (const a of assets) for (const o of a.objects) if (o.classId === CLASS_ID.Texture2D) texObjects.push(o);
  // GROUND1: the texture arrays, by their heads (a few per mod), whichever path reads the textures
  const arrays = [];
  for (const a of assets) {
    for (const o of a.objects) {
      if (o.classId !== CLASS_ID.Texture2DArray) continue;
      try {
        const h = o.head('image data') ?? o.read();
        arrays.push({ name: h.m_Name, width: h.m_Width, height: h.m_Height, depth: h.m_Depth, format: h.m_Format, layers: () => decodeTextureArray(o.read(), resource) });
      } catch { /* an array this reader cannot read is not one of the mod's pictures */ }
    }
  }
  if (Array.isArray(knownTextures) && knownTextures.length === texObjects.length && texObjects.length) {
    for (let i = 0; i < texObjects.length; i++) {
      const o = texObjects[i];
      const [name, width, height] = knownTextures[i];
      textures.push({ name, width, height, rgba: (opts) => decodeCapped(o.read(), resource, opts?.maxSize ?? maxTextureSize) });
    }
    return { ...fs, assets, textures, textAssets, arrays };
  }
  for (const a of assets) {
    for (const o of a.objects) {
      if (o.classId === CLASS_ID.Texture2D) {
        // DFMOD2: the index reads each texture's HEAD only - name, size, format, mips, settings - and stops at its
        // pixels. Reading every body at open was the whole bundle decompressed before the first picture (a
        // multi-gigabyte DREAM set, minutes and the tab); the body is read when a picture is asked for
        const tex = o.head('image data') ?? o.read();
        textures.push({
          name: tex.m_Name, width: tex.m_Width, height: tex.m_Height, format: tex.m_TextureFormat,
          mipCount: tex.m_MipCount, filterMode: tex.m_TextureSettings?.m_FilterMode, wrapU: tex.m_TextureSettings?.m_WrapU,
          // DW1: the body is READ AGAIN on decode rather than kept. `tex`
          // holds the pixels inline (`image data`), and a closure over
          // it for 12,934 textures is the whole bundle in memory by
          // another road; the index above keeps the few fields it needs
          // and the object's own read is a block or two.
          rgba: (opts) => decodeCapped(o.read(), resource, opts?.maxSize ?? maxTextureSize),
        });
      } else if (o.classId === CLASS_ID.TextAsset) {
        const t = o.read();
        // m_Script is a byte run: a manifest is UTF-8 JSON, a DLL is not
        // text at all, so both the bytes and a decoded view are offered.
        textAssets.push({ name: t.m_Name, bytes: t.m_Script, get text() { return utf8(t.m_Script); } });
      }
    }
  }
  return { ...fs, assets, textures, textAssets, arrays };
}
