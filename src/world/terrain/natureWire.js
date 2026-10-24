// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT BANTHA1 PERF-2 (bible/03-World/Bantha-Jungle.md): A PIXEL'S NATURE ACROSS THE WORKER'S WIRE, BY COLUMN. The
// kernel's nature is a list of plain objects - a flat each, its record, its place and whatever its layout wrote (a
// wood's `wood`, a border's `archive`, a jungle tree's `jungle` and `js`). Posted as it is, the main thread rebuilt them
// in one structured clone as the message landed: 3 ms an ordinary pixel, 10 ms a jungle pixel's 12,600 flats, out of
// every breather's reach. Here every field is a column of float64s (NaN where a flat has no such field), the columns'
// buffers TRANSFERRED, and the objects made again on the main thread with exactly the fields they had - in a loop that
// costs a fraction of the clone. A list with a field that is not a number crosses as it is (no column can hold it).
// ═══════════════════════════════════════════════════════════════════

/**
 * The list by column: `{ wire: 'nature', n, keys, cols }`, each column a Float64Array of `n` (NaN for a field a flat
 * lacks) - or the list itself where a field is not a number. `buffers(packed)` the columns' buffers to transfer.
 * @param {any[]} list
 */
export function packNature(list) {
  if (!Array.isArray(list) || !list.length) return list;
  const keys = [];
  const at = new Map();
  for (const f of list) {
    for (const k in f) {
      if (at.has(k)) continue;
      at.set(k, keys.length);
      keys.push(k);
    }
  }
  const n = list.length, cols = keys.map(() => new Float64Array(n).fill(NaN));
  for (let i = 0; i < n; i++) {
    const f = list[i];
    for (const k in f) {
      const v = f[k];
      if (v === undefined) continue;   // a field written empty is a field lacked
      if (typeof v !== 'number') return list;   // a field no column holds: the list crosses as it is
      cols[at.get(k)][i] = v;
    }
  }
  return { wire: 'nature', n, keys, cols };
}

/** The buffers a packed list hands the wire (none for a list that crossed as it is). */
export const natureBuffers = (packed) => (packed?.wire === 'nature' ? packed.cols.map((c) => c.buffer) : []);

/**
 * The list again, every flat with the fields it had (a NaN is a field it lacked - no layout writes NaN): the common
 * eight on every flat, one shape (undefined where it lacked one - as a layout's `f.archive ?? ...` reads it), any other
 * only where it was. A list that crossed as it is comes back untouched.
 * @param {any} packed
 */
export function unpackNature(packed) {
  if (packed?.wire !== 'nature') return packed;
  const { n, keys, cols } = packed, out = new Array(n);
  // the fields every layout writes, in one order, each flat one shape (a field it lacks, undefined - never written); the
  // rest by name after
  const col = (k) => { const j = keys.indexOf(k); return j < 0 ? null : cols[j]; };
  const cr = col('record'), cx = col('x'), cy = col('y'), cz = col('z'), ca = col('archive'), cw = col('wood'), cj = col('jungle'), cs = col('js');
  const rest = [];
  for (let k = 0; k < keys.length; k++) if (!SHAPED.has(keys[k])) rest.push(k);
  const at = (c, i) => { if (!c) return undefined; const v = c[i]; return v === v ? v : undefined; };
  for (let i = 0; i < n; i++) {
    const f = { record: at(cr, i), x: at(cx, i), y: at(cy, i), z: at(cz, i), archive: at(ca, i), wood: at(cw, i), jungle: at(cj, i), js: at(cs, i) };
    for (let r = 0; r < rest.length; r++) { const v = cols[rest[r]][i]; if (v === v) f[keys[rest[r]]] = v; }
    out[i] = f;
  }
  return out;
}
const SHAPED = new Set(['record', 'x', 'y', 'z', 'archive', 'wood', 'jungle', 'js']);
