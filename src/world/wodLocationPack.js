// ═══════════════════════════════════════════════════════════════════
// WOD1 - WORLD OF DAGGERFALL: ONE REGION FOLDER, PACKED.
//
// The mod reads StreamingAssets/Locations/<region>/*.txt at runtime,
// every file of a folder the moment the player enters that region
// (LocationLoader.cs:82-88). Those folders are 2,413 XML files and
// 63 MB - the size of the port's whole vendor tree again - for 227,938
// instances whose information is eight small numbers and two short
// strings each. So the vendored tree carries one file per folder
// instead: LocationHelper.LoadLocationInstance's OUTPUT (the ported
// reader, wodLocationData.js), in the folder's load order, as columns.
//
// What is kept is exactly what the reader yields and in the order it
// yields it - which is what makes this a cache of the author's files
// rather than a re-authoring of them: tools/worldOfDaggerfallAssets.mjs
// runs the ported reader over the shipped files and writes these, and
// `locations.json` beside them lists every source file with its sha256
// and instance count, so anyone holding the archive can re-derive each
// pack byte for byte.
//
// Layout (little-endian):
//   'WODL'  u16 version  i16 region  u32 count
//   u16 stringCount, then per string: u16 byteLength + UTF-8 bytes
//   u16 fileCount, then per file: u16 nameString, u32 instanceCount
//   u8 width x 8 - bytes per value of each column below (1, 2 or 4,
//   signed; the encoder takes the narrowest that holds the column)
//   the columns, `count` values each, in COLUMNS order.
// A LEAF: no imports.
// ═══════════════════════════════════════════════════════════════════

export const WOD_PACK_MAGIC = 'WODL';
export const WOD_PACK_VERSION = 1;
/** The instance fields, in the order the pack stores their columns.
 *  `name` and `prefab` are indices into the pack's string table. */
export const WOD_PACK_COLUMNS = Object.freeze(['name', 'prefab', 'type', 'worldX', 'worldY', 'terrainX', 'terrainY', 'locationID']);

const fits = (w, lo, hi) => lo >= -(2 ** (8 * w - 1)) && hi <= 2 ** (8 * w - 1) - 1;

/**
 * Encode one region folder.
 * @param {number} region - the folder's name, a region index.
 * @param {Array<{file:string, instances:Array<object>}>} files - in the
 *   folder's load order; each instance a LocationInstance.
 * @returns {Uint8Array}
 */
export function encodeRegionPack(region, files) {
  const strings = [];
  const stringIndex = new Map();
  const intern = (s) => {
    if (!stringIndex.has(s)) { stringIndex.set(s, strings.length); strings.push(s); }
    return stringIndex.get(s);
  };
  const all = [];
  const fileRows = files.map(({ file, instances }) => {
    all.push(...instances);
    return [intern(file), instances.length];
  });
  const cols = WOD_PACK_COLUMNS.map((c) => all.map((inst) => ((c === 'name' || c === 'prefab') ? intern(inst[c]) : inst[c])));
  for (const [c, vals] of WOD_PACK_COLUMNS.map((c, i) => [c, cols[i]])) {
    for (const v of vals) {
      if (!Number.isInteger(v) || v < -(2 ** 31) || v > 2 ** 31 - 1) throw new Error(`WOD pack: ${c} value ${v} is not an Int32`);
    }
  }
  const widths = cols.map((vals) => {
    let lo = 0, hi = 0;
    for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return [1, 2, 4].find((w) => fits(w, lo, hi));
  });
  if (strings.length > 0xffff || files.length > 0xffff) throw new Error('WOD pack: table too large');
  const enc = new TextEncoder();
  const sBytes = strings.map((s) => enc.encode(s));
  let size = 4 + 2 + 2 + 4 + 2 + sBytes.reduce((n, b) => n + 2 + b.length, 0) + 2 + files.length * 6 + WOD_PACK_COLUMNS.length;
  for (const w of widths) size += w * all.length;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let o = 0;
  for (let i = 0; i < 4; i++) out[o++] = WOD_PACK_MAGIC.charCodeAt(i);
  dv.setUint16(o, WOD_PACK_VERSION, true); o += 2;
  dv.setInt16(o, region, true); o += 2;
  dv.setUint32(o, all.length, true); o += 4;
  dv.setUint16(o, strings.length, true); o += 2;
  for (const b of sBytes) { dv.setUint16(o, b.length, true); o += 2; out.set(b, o); o += b.length; }
  dv.setUint16(o, files.length, true); o += 2;
  for (const [name, n] of fileRows) { dv.setUint16(o, name, true); o += 2; dv.setUint32(o, n, true); o += 4; }
  for (const w of widths) out[o++] = w;
  cols.forEach((vals, c) => {
    const w = widths[c];
    for (const v of vals) {
      if (w === 1) dv.setInt8(o, v); else if (w === 2) dv.setInt16(o, v, true); else dv.setInt32(o, v, true);
      o += w;
    }
  });
  if (o !== size) throw new Error(`WOD pack: wrote ${o} of ${size} bytes`);
  return out;
}

/**
 * Decode one region pack into the columns LocationSession.appendRegion
 * takes, plus its file table.
 * @param {Uint8Array} bytes
 * @returns {{region:number, count:number, files:Array<{file:string,count:number}>,
 *   name:string[], prefab:string[], type:Int32Array, worldX:Int32Array,
 *   worldY:Int32Array, terrainX:Int32Array, terrainY:Int32Array, locationID:Int32Array}}
 */
export function decodeRegionPack(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]); o += 4;
  if (magic !== WOD_PACK_MAGIC) throw new Error('WOD pack: bad magic');
  const version = dv.getUint16(o, true); o += 2;
  if (version !== WOD_PACK_VERSION) throw new Error(`WOD pack: version ${version}`);
  const region = dv.getInt16(o, true); o += 2;
  const count = dv.getUint32(o, true); o += 4;
  const nStrings = dv.getUint16(o, true); o += 2;
  const dec = new TextDecoder();
  const strings = [];
  for (let i = 0; i < nStrings; i++) {
    const n = dv.getUint16(o, true); o += 2;
    strings.push(dec.decode(bytes.subarray(o, o + n))); o += n;
  }
  const nFiles = dv.getUint16(o, true); o += 2;
  const files = [];
  for (let i = 0; i < nFiles; i++) {
    const file = strings[dv.getUint16(o, true)]; o += 2;
    files.push({ file, count: dv.getUint32(o, true) }); o += 4;
  }
  const widths = [];
  for (let i = 0; i < WOD_PACK_COLUMNS.length; i++) widths.push(bytes[o++]);
  const out = { region, count, files };
  WOD_PACK_COLUMNS.forEach((c, ci) => {
    const w = widths[ci];
    const a = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      a[i] = w === 1 ? dv.getInt8(o) : w === 2 ? dv.getInt16(o, true) : dv.getInt32(o, true);
      o += w;
    }
    out[c] = (c === 'name' || c === 'prefab') ? Array.from(a, (k) => strings[k]) : a;
  });
  if (o !== bytes.length) throw new Error(`WOD pack: ${bytes.length - o} trailing bytes`);
  if (files.reduce((n, f) => n + f.count, 0) !== count) throw new Error('WOD pack: file table does not sum to the count');
  return out;
}
