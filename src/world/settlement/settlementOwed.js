// @ts-check
// THE CARVE UNDER A RECORD. A record keeps its height on the ground before any settlement's carve: the frame host takes
// the carve's move off as it writes and puts its pixel's build's move back as it re-stands, so a save reads alike with
// the Landforms row on or off. A record re-stood on a settlement's pixel not built stands without the move, the pixel
// owed, and the build pays it (scenes/pixelBuild.js rides every record on the pixel by its `moved`). A pixel streamed
// out keeps its last build's move for the records still on it. One world stands at a time, so the ledger is the page's.
// Pure; worker-safe.

/** The pixels whose records stand without their carve, by key (`px,py`). */
const owed = new Set();
/** Each pixel's last build's carve, by key: `{ box, epoch }` (cropMoved's box, the count it was kept under). */
const kept = new Map();
/** The save whose load began the ledger last, so the several re-stands of one load begin it once. */
let readFrom = null;
/** How many saves were read, or worlds begun: ground kept from a build of an earlier one is no record's now. */
let epoch = 0;
/** Whether a pixel stands built now (the frame host's): its kept carve is its records' through a load. */
let builtNow = (/** @type {string} */ _key) => false;

/** The world's built pixels, for a load. @param {(key: string) => boolean} isBuilt */
export function padsOwedBuilt(isBuilt) {
  builtNow = isBuilt;
}

/** Owe a pixel's carve: a record on it stood without it. @param {string} key */
export function owePads(key) {
  owed.add(key);
}

/** Pay a pixel's carve: whether it was owed (its records now ride the build's move). @param {string} key */
export function payPads(key) {
  return owed.delete(key);
}

/** Whether a pixel's carve is owed. @param {string} key */
export function padsOwedAt(key) {
  return owed.has(key);
}

/** The owed pixels, sorted. */
export function padsOwed() {
  return [...owed].sort();
}

/**
 * A move field cropped to the samples it moved, so a town streamed out keeps only its outskirts: `x * dim + y`.
 * @param {ArrayLike<number>} moved @param {number} dim
 * @returns {{ x0: number, y0: number, x1: number, y1: number, field: Float32Array }|null} null where nothing moved
 */
export function cropMoved(moved, dim) {
  let x0 = dim, y0 = dim, x1 = -1, y1 = -1;
  for (let x = 0; x < dim; x++) for (let y = 0; y < dim; y++) if (moved[x * dim + y]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const rows = y1 - y0 + 1, field = new Float32Array((x1 - x0 + 1) * rows);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) field[(x - x0) * rows + y - y0] = moved[x * dim + y];
  return { x0, y0, x1, y1, field };
}

/** Keep a pixel's build's carve for the records on it once it streams out; none carved, none kept.
 *  @param {string} key @param {ArrayLike<number>|null|undefined} moved @param {number} dim */
export function keepCarve(key, moved, dim) {
  const box = moved ? cropMoved(moved, dim) : null;
  if (box) kept.set(key, { box, epoch });
  else kept.delete(key);
}

/** The carve a pixel's records stand on while it is not built: its last build's this load, else none. @param {string} key */
export function carveKept(key) {
  const entry = kept.get(key);
  return entry && entry.epoch === epoch ? entry.box : null;
}

/**
 * A load begins: its records replace whatever stood, so nothing is owed and a carve kept from before it is no record's,
 * but a pixel built now keeps its own. Begun once a save, whatever re-stands it.
 * @param {object | null | undefined} stamp the save's envelope
 */
export function padsOwedFrom(stamp) {
  if (!stamp || stamp === readFrom) return;
  readFrom = stamp;
  epoch++;
  owed.clear();
  for (const [key, entry] of kept) if (builtNow(key)) entry.epoch = epoch;
}

/** The saves read and worlds begun so far: a build's ground carries the count it was built under. */
export const owedEpoch = () => epoch;

/** A new world: nothing owed, kept or read. */
export function clearPadsOwed() {
  epoch++;
  owed.clear();
  kept.clear();
  readFrom = null;
  builtNow = () => false;
}
