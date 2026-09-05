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
//   - the pre-blob type-tree format (SerializedFile < 12) and files
//     with the type tree stripped - the object layout is read FROM the
//     tree the bundle carries, which is what makes this reader
//     version-independent, so a bundle without one is refused;
//   - every texture format but the six a mod's PNG import lands on
//     (Alpha8, RGB24, RGBA32, ARGB32, DXT1, DXT5).
//
// Nothing here touches the DOM. It runs in node under the pins and in
// the browser under the data door.

import { lz4BlockDecompress } from './lz4.js';
import { dxtDecode } from './dxt.js';

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
  u8() { return this.bytes[this.pos++]; }
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
  if (mode === COMPRESSION.NONE) return src.subarray(0, uncompressedSize);
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

/**
 * Open a UnityFS bundle: header, blocks, directory. Returns the
 * container's files as byte views, still undecoded.
 * @param {Uint8Array} bytes
 */
export function readUnityFs(bytes) {
  const r = new Reader(bytes, false);
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
  if (flags & BLOCKS_INFO_AT_END) {
    infoBytes = bytes.subarray(bytes.length - compressedInfoSize);
  } else {
    infoBytes = r.bytesOf(compressedInfoSize);
  }
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
  if (newFlags && (flags & BLOCK_INFO_NEED_PADDING)) r.align(16);
  if (flags & BLOCKS_INFO_AT_END) r.pos = start;
  // Every block, decompressed, into one stream the directory indexes.
  let total = 0;
  for (const b of blocks) total += b.uncompressedSize;
  const data = new Uint8Array(total);
  let at = 0;
  for (const b of blocks) {
    const chunk = decompress(r.bytesOf(b.compressedSize), b.uncompressedSize, b.flags);
    data.set(chunk, at);
    at += b.uncompressedSize;
  }
  const files = nodes.map((n) => ({ path: n.path, flags: n.flags, bytes: data.subarray(n.offset, n.offset + n.size) }));
  return { signature, version, unityVersion, unityRevision, flags, files };
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
 *  big-endian: metadata size, file size, version, data offset. */
function looksSerialized(bytes) {
  if (bytes.length < 20) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fileSize = v.getUint32(4);
  const version = v.getUint32(8);
  return version >= 5 && version <= 40 && fileSize === bytes.length;
}

/**
 * Parse a SerializedFile's header, type table and object table.
 * @param {Uint8Array} bytes the file within the container
 * @param {string} name the container path
 */
export function readSerializedFile(bytes, name) {
  const r = new Reader(bytes, false);
  let metadataSize = r.u32();
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
  if (version < 12 && version !== 10) throw new Error(`unity bundle: SerializedFile ${version} writes the old type-tree format`);
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
      read: () => readObject(bytes, dataOffset + byteStart, byteSize, type?.node, littleEndian),
    });
  }
  return { name, version, unityVersion, targetPlatform, littleEndian, metadataSize, fileSize, dataOffset, types, objects };
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

function readObject(fileBytes, start, size, node, littleEndian) {
  if (!node) throw new Error('unity bundle: object has no type tree');
  const r = new Reader(fileBytes, littleEndian);
  r.pos = start;
  const v = readValue(node, r);
  if (r.pos - start !== size) throw new Error(`unity bundle: ${node.type} read ${r.pos - start} of ${size} bytes`);
  return v;
}

// ---- the objects a mod carries ------------------------------------------

export const CLASS_ID = Object.freeze({ Texture2D: 28, TextAsset: 49, AssetBundle: 142 });

/** Unity's TextureFormat values this reader decodes. */
export const TEXTURE_FORMAT = Object.freeze({ Alpha8: 1, RGB24: 3, RGBA32: 4, ARGB32: 5, DXT1: 10, DXT5: 12 });

/**
 * Decode a parsed Texture2D to RGBA8, TOP ROW FIRST (Unity stores its
 * rows bottom-up; every consumer here wants the raster order a PNG
 * decodes to). Mip 0 only.
 * @param {object} tex the Texture2D value
 * @param {(path:string, offset:number, size:number) => Uint8Array} resource
 *   resolves the bundle's `.resS` streams for a texture that streams
 * @returns {{width:number,height:number,data:Uint8Array}}
 */
export function decodeTexture2D(tex, resource = null) {
  const width = tex.m_Width;
  const height = tex.m_Height;
  const format = tex.m_TextureFormat;
  let src = tex['image data'];
  const stream = tex.m_StreamData;
  if ((!src || !src.length) && stream && stream.size > 0) {
    if (!resource) throw new Error(`unity bundle: ${tex.m_Name} streams from ${stream.path} and no resource resolver was given`);
    src = resource(stream.path, Number(stream.offset), Number(stream.size));
  }
  if (!src) throw new Error(`unity bundle: ${tex.m_Name} carries no image data`);
  let rgba;
  const n = width * height;
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
    default:
      throw new Error(`unity bundle: ${tex.m_Name} is TextureFormat ${format}, which this reader does not decode`);
  }
  // Bottom-up to top-down.
  const out = new Uint8Array(n * 4);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(rgba.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return { width, height, data: out };
}

/**
 * Open a `.dfmod` (or any UnityFS bundle) and index its textures and
 * text assets by name. Textures decode lazily through `rgba()`.
 * @param {Uint8Array} bytes
 */
export function readUnityBundle(bytes) {
  const fs = readUnityFs(bytes);
  const resources = new Map();
  const assets = [];
  for (const f of fs.files) {
    if (looksSerialized(f.bytes)) assets.push(readSerializedFile(f.bytes, f.path));
    else resources.set(f.path, f.bytes);
  }
  const resource = (path, offset, size) => {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const res = resources.get(base) ?? resources.get(path);
    if (!res) throw new Error(`unity bundle: resource ${path} is not in the container`);
    return res.subarray(offset, offset + size);
  };
  const textures = [];
  const textAssets = [];
  for (const a of assets) {
    for (const o of a.objects) {
      if (o.classId === CLASS_ID.Texture2D) {
        const tex = o.read();
        textures.push({
          name: tex.m_Name, width: tex.m_Width, height: tex.m_Height, format: tex.m_TextureFormat,
          mipCount: tex.m_MipCount, filterMode: tex.m_TextureSettings?.m_FilterMode, wrapU: tex.m_TextureSettings?.m_WrapU,
          rgba: () => decodeTexture2D(tex, resource),
        });
      } else if (o.classId === CLASS_ID.TextAsset) {
        const t = o.read();
        // m_Script is a byte run: a manifest is UTF-8 JSON, a DLL is not
        // text at all, so both the bytes and a decoded view are offered.
        textAssets.push({ name: t.m_Name, bytes: t.m_Script, get text() { return utf8(t.m_Script); } });
      }
    }
  }
  return { ...fs, assets, textures, textAssets };
}
