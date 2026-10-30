// @ts-check
// VENDOR-HOUSES (Mac, 2026-10-30, forwarding #feature-feedback "Player Vendors": "trying to find a vendor in Daggerfall
// is insane"; "make them a different color like the Player's own houses are red"): which houses in a region hold a
// player's trader with goods up, for the town map to ink blue. Read off the Notice Board's own vendor directory (its door
// law with it), registered by scenes/vendorHost.js; the town map's opening asks for its region.

/** A region's traders are read again after this long (seconds): one read a town map's opening at most. */
export const VENDOR_HOUSES_READ_S = 120;

/** @type {((region: number) => any) | null} */
let _read = null;
/** @type {Map<number, { at: number, busy: boolean, keys: Set<string> }>} */
const _regions = new Map();
let _version = 0;

const keyOf = (map, buildingKey) => `${Number(map) >>> 0}:${Number(buildingKey)}`;

/** The directory's read: `(region) => { ok, data: { rows: [{ map, buildingKey }] } }`, or null where the market is shut. */
export function registerVendorHouseReader(fn) { _read = typeof fn === 'function' ? fn : null; }

/** Ask for `region`'s traders unless they were read in the last VENDOR_HOUSES_READ_S or a read is out. The version moves
 *  when the answer changes what is marked. */
export function ensureVendorHouses(region, nowS = Date.now() / 1000) {
  if (!_read || !Number.isInteger(region) || region < 0) return;
  const had = _regions.get(region);
  if (had && (had.busy || nowS - had.at < VENDOR_HOUSES_READ_S)) return;
  const entry = { at: nowS, busy: true, keys: had?.keys ?? new Set() };
  _regions.set(region, entry);
  let asked;
  try { asked = _read(region); } catch { asked = null; }
  Promise.resolve(asked).then((r) => {
    if (!r?.ok) return;
    const keys = new Set();
    for (const row of r.data?.rows ?? []) {
      if (Number.isSafeInteger(Number(row?.map)) && Number(row?.buildingKey) > 0) keys.add(keyOf(row.map, row.buildingKey));
    }
    const same = keys.size === entry.keys.size && [...keys].every((k) => entry.keys.has(k));
    entry.keys = keys;
    if (!same) _version++;
  }, () => {}).finally(() => { entry.busy = false; });
}

/** Whether the house `buildingKey` of town `map` holds a trader with goods up, as last read. */
export function isVendorHouse(map, buildingKey) {
  const k = keyOf(map, buildingKey);
  for (const r of _regions.values()) if (r.keys.has(k)) return true;
  return false;
}

/** Moves each time a read changes the marked houses (the town sheet repaints on it). */
export const vendorHousesVersion = () => _version;

/** Tests only. */
export function _resetVendorHousesForTests() { _read = null; _regions.clear(); _version = 0; }
