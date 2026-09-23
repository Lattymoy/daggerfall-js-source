// @ts-check
// HCC-IL (2026-09-23): THE EMBEDDED RESOURCES OF A .NET ASSEMBLY.
//
// Horse Cart and Cargo ships its horse art INSIDE `TrailingWagon.dll` -
// 45 PNGs as manifest resources (`TrailingWagon.Horse.horse1..5.png`,
// the five stationary directions, and `TrailingWagon.Horse.Walk.<d>-<f>.png`,
// five directions of an eight-frame walk), read at runtime through
// `Assembly.GetManifestResourceStream` (HorseTextureSet.LoadAll,
// HorseWalkAnimationSet.LoadAll). No other mod this port carries did
// that; every earlier one shipped its art as Unity textures in the
// bundle, which `formats/unityBundle.js` already opens. So this is the
// other door: the PE file's CLI header, its metadata root, the `#~`
// table stream walked table by table (ECMA-335 II.22 - every table
// before ManifestResource has to be measured to find it, which is why
// the schema of thirty-nine of them is written out below), and the
// ManifestResource rows resolved to `[length][bytes]` records in the
// CLI resources blob. Pure: bytes in, `{ name, bytes }` out, so
// `tools/hccAssets.mjs` reproduces `vendor/horse-cart-and-cargo/Textures/`
// from the shipped bundle and `test/hcc_assets.test.js` pins that the
// vendored files ARE the assembly's.

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** ECMA-335 II.22: the tables in token order. Each column is a kind:
 *  a byte width (2 or 4), 'S' (#Strings), 'G' (#GUID), 'B' (#Blob),
 *  ['i', table] (a simple index) or ['c', tagBits, [tables]] (a coded
 *  index). Only the ROW SIZES matter here - the walk skips every table
 *  before 0x28 and reads that one. */
const CA = ['MethodDef', 'Field', 'TypeRef', 'TypeDef', 'Param', 'InterfaceImpl', 'MemberRef', 'Module', 'DeclSecurity', 'Property',
  'Event', 'StandAloneSig', 'ModuleRef', 'TypeSpec', 'Assembly', 'AssemblyRef', 'File', 'ExportedType', 'ManifestResource', 'GenericParam',
  'GenericParamConstraint', 'MethodSpec'];
const TDR = ['TypeDef', 'TypeRef', 'TypeSpec'];
const IMPL = ['File', 'AssemblyRef', 'ExportedType'];
/** @type {ReadonlyArray<readonly [string, ReadonlyArray<any>]>} */
export const TABLES = Object.freeze([
  ['Module', [2, 'S', 'G', 'G', 'G']],
  ['TypeRef', [['c', 2, ['Module', 'ModuleRef', 'AssemblyRef', 'TypeRef']], 'S', 'S']],
  ['TypeDef', [4, 'S', 'S', ['c', 2, TDR], ['i', 'Field'], ['i', 'MethodDef']]],
  ['FieldPtr', [['i', 'Field']]],
  ['Field', [2, 'S', 'B']],
  ['MethodPtr', [['i', 'MethodDef']]],
  ['MethodDef', [4, 2, 2, 'S', 'B', ['i', 'Param']]],
  ['ParamPtr', [['i', 'Param']]],
  ['Param', [2, 2, 'S']],
  ['InterfaceImpl', [['i', 'TypeDef'], ['c', 2, TDR]]],
  ['MemberRef', [['c', 3, ['TypeDef', 'TypeRef', 'ModuleRef', 'MethodDef', 'TypeSpec']], 'S', 'B']],
  ['Constant', [2, ['c', 2, ['Field', 'Param', 'Property']], 'B']],
  ['CustomAttribute', [['c', 5, CA], ['c', 3, ['_', '_', 'MethodDef', 'MemberRef']], 'B']],
  ['FieldMarshal', [['c', 1, ['Field', 'Param']], 'B']],
  ['DeclSecurity', [2, ['c', 2, ['TypeDef', 'MethodDef', 'Assembly']], 'B']],
  ['ClassLayout', [2, 4, ['i', 'TypeDef']]],
  ['FieldLayout', [4, ['i', 'Field']]],
  ['StandAloneSig', ['B']],
  ['EventMap', [['i', 'TypeDef'], ['i', 'Event']]],
  ['EventPtr', [['i', 'Event']]],
  ['Event', [2, 'S', ['c', 2, TDR]]],
  ['PropertyMap', [['i', 'TypeDef'], ['i', 'Property']]],
  ['PropertyPtr', [['i', 'Property']]],
  ['Property', [2, 'S', 'B']],
  ['MethodSemantics', [2, ['i', 'MethodDef'], ['c', 1, ['Event', 'Property']]]],
  ['MethodImpl', [['i', 'TypeDef'], ['c', 1, ['MethodDef', 'MemberRef']], ['c', 1, ['MethodDef', 'MemberRef']]]],
  ['ModuleRef', ['S']],
  ['TypeSpec', ['B']],
  ['ImplMap', [2, ['c', 1, ['Field', 'MethodDef']], 'S', ['i', 'ModuleRef']]],
  ['FieldRVA', [4, ['i', 'Field']]],
  ['EncLog', [4, 4]],
  ['EncMap', [4]],
  ['Assembly', [4, 2, 2, 2, 2, 4, 'B', 'S', 'S']],
  ['AssemblyProcessor', [4]],
  ['AssemblyOS', [4, 4, 4]],
  ['AssemblyRef', [2, 2, 2, 2, 4, 'B', 'S', 'S', 'B']],
  ['AssemblyRefProcessor', [4, ['i', 'AssemblyRef']]],
  ['AssemblyRefOS', [4, 4, 4, ['i', 'AssemblyRef']]],
  ['File', [4, 'S', 'B']],
  ['ExportedType', [4, 4, 'S', 'S', ['c', 2, IMPL]]],
  ['ManifestResource', [4, 4, 'S', ['c', 2, IMPL]]],
]);
const MANIFEST_RESOURCE = 0x28;

/** The PE's section table, for RVA -> file offset. */
function sections(b) {
  const pe = u32(b, 0x3c);
  if (u32(b, pe) !== 0x00004550) throw new Error('not a PE file');
  const coff = pe + 4;
  const nSections = u16(b, coff + 2);
  const optSize = u16(b, coff + 16);
  const opt = coff + 20;
  const magic = u16(b, opt);
  const dirs = opt + (magic === 0x20b ? 112 : 96);
  const cli = { rva: u32(b, dirs + 14 * 8), size: u32(b, dirs + 14 * 8 + 4) };
  const secs = [];
  for (let i = 0; i < nSections; i++) {
    const s = opt + optSize + i * 40;
    secs.push({ va: u32(b, s + 12), raw: u32(b, s + 16), ptr: u32(b, s + 20) });
  }
  return { cli, secs };
}
const rvaToOffset = (secs, rva) => {
  for (const s of secs) if (rva >= s.va && rva < s.va + s.raw) return s.ptr + (rva - s.va);
  throw new Error(`RVA 0x${rva.toString(16)} falls in no section`);
};

/**
 * Every manifest resource of the assembly, in table order: `{ name, bytes }`.
 * Resources implemented outside this file (Implementation != 0 - another
 * module or assembly) carry `bytes: null`.
 * @param {Uint8Array} b
 */
export function readManifestResources(b) {
  const { cli, secs } = sections(b);
  if (!cli.rva) throw new Error('no CLI header: not a .NET assembly');
  const cliOff = rvaToOffset(secs, cli.rva);
  const metaRva = u32(b, cliOff + 8), resRva = u32(b, cliOff + 24), resSize = u32(b, cliOff + 28);
  const meta = rvaToOffset(secs, metaRva);
  if (u32(b, meta) !== 0x424a5342) throw new Error('bad metadata signature');
  const verLen = u32(b, meta + 12);
  let p = meta + 16 + verLen;
  const nStreams = u16(b, p + 2);
  p += 4;
  const streams = {};
  for (let i = 0; i < nStreams; i++) {
    const off = u32(b, p), size = u32(b, p + 4);
    let q = p + 8, name = '';
    while (b[q] !== 0) name += String.fromCharCode(b[q++]);
    q += 1;
    p = q + ((4 - (q - meta) % 4) % 4);
    streams[name] = { off: meta + off, size };
  }
  const tab = streams['#~'] ?? streams['#-'];
  const strs = streams['#Strings'];
  if (!tab || !strs) throw new Error('no metadata table stream');
  const heapSizes = b[tab.off + 6];
  const valid = [u32(b, tab.off + 8), u32(b, tab.off + 12)];   // low, high
  const present = (i) => (i < 32 ? (valid[0] >>> i) & 1 : (valid[1] >>> (i - 32)) & 1) === 1;
  let q = tab.off + 24;
  const rows = new Map();
  for (let i = 0; i < 64; i++) if (present(i)) { rows.set(TABLES[i]?.[0] ?? `t${i}`, u32(b, q)); q += 4; }
  const rowsOf = (name) => rows.get(name) ?? 0;
  const S = heapSizes & 1 ? 4 : 2, G = heapSizes & 2 ? 4 : 2, B = heapSizes & 4 ? 4 : 2;
  const colSize = (c) => {
    if (typeof c === 'number') return c;
    if (c === 'S') return S;
    if (c === 'G') return G;
    if (c === 'B') return B;
    if (c[0] === 'i') return rowsOf(c[1]) < 65536 ? 2 : 4;
    const max = Math.max(0, ...c[2].map((t) => rowsOf(t)));
    return max < (1 << (16 - c[1])) ? 2 : 4;
  };
  // walk to the ManifestResource table
  let off = q;
  for (let i = 0; i < MANIFEST_RESOURCE; i++) {
    if (!present(i)) continue;
    const [name, cols] = TABLES[i];
    off += rowsOf(name) * cols.reduce((n, c) => n + colSize(c), 0);
  }
  if (!present(MANIFEST_RESOURCE)) return [];
  const n = rowsOf('ManifestResource');
  const implSize = colSize(['c', 2, IMPL]);
  const readStr = (idx) => { let s = '', k = strs.off + idx; while (b[k] !== 0) s += String.fromCharCode(b[k++]); return s; };
  const resOff = resSize ? rvaToOffset(secs, resRva) : 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const offset = u32(b, off);
    const nameIdx = S === 4 ? u32(b, off + 8) : u16(b, off + 8);
    const impl = implSize === 4 ? u32(b, off + 8 + S) : u16(b, off + 8 + S);
    off += 8 + S + implSize;
    const name = readStr(nameIdx);
    if (impl !== 0 || !resSize) { out.push({ name, bytes: null }); continue; }
    const at = resOff + offset;
    const len = u32(b, at);
    out.push({ name, bytes: b.slice(at + 4, at + 4 + len) });
  }
  return out;
}
