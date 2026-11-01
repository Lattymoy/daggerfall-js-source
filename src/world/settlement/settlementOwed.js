// @ts-check
// WHAT A RECORD STILL OWES A SETTLEMENT'S CARVE. A record written before the carve law re-stands by the carve's move
// under it, and that move is its pixel's build's own: no other thread can lay a town's outskirts as the kernel lays them.
// So a record that loads before its pixel is built stands without the move, its pixel is owed, and the save carries the
// debt until the build pays it (scenes/pixelBuild.js rides every record on the pixel by the build's `moved`). One world
// stands at a time, so the ledger is the page's. Pure; worker-safe.

/** The pixels whose records stand without their carve, by key (`px,py`). */
const owed = new Set();
/** The debt the last loaded save carried: its records on these pixels were written without the carve. */
let saved = new Set();
/** The save whose debt was read last, so the several re-stands of one load read it once. */
let readFrom = null;
/** How many saves were read, or worlds begun: ground kept from a build of an earlier one is no record's now. */
let epoch = 0;
/** Whether a pixel stands built now (the frame host's): a save's debt there is paid exactly as its records re-stand. */
let builtNow = (/** @type {string} */ _key) => false;

/** The world's built pixels, for the next save's debt. @param {(key: string) => boolean} isBuilt */
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

/** The owed pixels, sorted, for a save. */
export function padsOwed() {
  return [...owed].sort();
}

/**
 * A loaded save's debt: what its records on each pixel still owe. Read once a save, whatever re-stands it: the world's
 * records replace whatever stood, so the ledger starts again from the save's own debt.
 * @param {{ padsOwed?: unknown } | null | undefined} stamp the save's envelope
 */
export function padsOwedFrom(stamp) {
  if (!stamp || stamp === readFrom) return;
  readFrom = stamp;
  epoch++;
  const list = Array.isArray(stamp.padsOwed) ? stamp.padsOwed.filter((key) => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)) : [];
  saved = new Set(list);
  owed.clear();
  for (const key of list) if (!builtNow(key)) owed.add(key);   // built: its records re-stand by its build's own move now
}

/** The saves read and worlds begun so far: a build's ground carries the count it was built under. */
export const owedEpoch = () => epoch;

/** Whether the loaded save's records on a pixel were written without its carve. @param {string} key */
export function savedPadsOwed(key) {
  return saved.has(key);
}

/** A new world: nothing owed, no save read. */
export function clearPadsOwed() {
  epoch++;
  owed.clear();
  saved = new Set();
  readFrom = null;
  builtNow = () => false;
}
