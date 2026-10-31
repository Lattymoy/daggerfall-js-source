// @ts-check
// VENDOR-HOUSES (Mac, 2026-10-30, forwarding #feature-feedback "Player Vendors": "trying to find a vendor in Daggerfall
// is insane"; "make them a different color like the Player's own houses are red"): which houses in a region hold a
// player's trader with goods up, for the town map to ink blue. Read off the Notice Board's own vendor directory (its door
// law with it), registered by scenes/vendorHost.js; the town map's opening asks for its region.

import { restoresSoFar } from './save/save.js'; // AUDIT TECH-FEEDBACK II F5: every load passes the one door

/** A region's traders are read again after this long (seconds): one read a town map's opening at most. */
export const VENDOR_HOUSES_READ_S = 120;
/** AUDIT TECH-FEEDBACK F4: a read that failed is asked again after this long, and one never answered is let go. */
export const VENDOR_HOUSES_RETRY_S = 15;
export const VENDOR_HOUSES_HUNG_S = 30;

/** @type {((region: number) => any) | null} */
let _read = null;
/** AUDIT TECH-FEEDBACK II F5: whether the market is open now - nothing is marked while it is shut. */
let _open = () => true;
/** AUDIT TECH-FEEDBACK II F5: the loads seen - a load (another character, another door's law) forgets every read. */
let _loads = null;
/** @type {Map<number, { at: number, busy: boolean, failed: boolean, keys: Set<string> }>} */
const _regions = new Map();
let _version = 0;

const keyOf = (map, buildingKey) => `${Number(map) >>> 0}:${Number(buildingKey)}`;

/** The directory's read: `(region) => { ok, data: { rows: [{ map, buildingKey }] } }`, or null where the market is shut;
 *  `open` whether the market is open now. */
export function registerVendorHouseReader(fn, { open = null } = {}) {
  _read = typeof fn === 'function' ? fn : null;
  _open = typeof open === 'function' ? open : () => true;
}

/** Ask for `region`'s traders unless they were read in the last VENDOR_HOUSES_READ_S or a read is out. The version moves
 *  when the answer changes what is marked. */
export function ensureVendorHouses(region, nowS = Date.now() / 1000, loads = restoresSoFar()) {
  if (_loads !== loads) {
    if (_loads != null && _regions.size) {
      _regions.clear();
      _version++;
    }
    _loads = loads;
  }
  if (!_read || !Number.isInteger(region) || region < 0) return;
  const had = _regions.get(region);
  if (
    had &&
    ((had.busy && nowS - had.at < VENDOR_HOUSES_HUNG_S) ||
      (!had.busy && nowS - had.at < (had.failed ? VENDOR_HOUSES_RETRY_S : VENDOR_HOUSES_READ_S)))
  )
    return;
  const entry = { at: nowS, busy: true, failed: false, keys: had?.keys ?? new Set() };
  _regions.set(region, entry);
  let asked;
  try {
    asked = _read(region);
  } catch (e) {
    asked = Promise.reject(e);
  } // AUDIT TECH-FEEDBACK II F4: a throw is a failure, not a shut market
  Promise.resolve(asked)
    .then(
      (r) => {
        if (_regions.get(region) !== entry) return; // a newer read took the region over
        if (!r?.ok) {
          entry.failed = true;
          // the market shut (the reader answers none): nothing of it is marked; a service error keeps what was read
          if (r == null && entry.keys.size) {
            entry.keys = new Set();
            _version++;
          }
          return;
        }
        const keys = new Set();
        for (const row of r.data?.rows ?? []) {
          if (Number.isSafeInteger(Number(row?.map)) && Number(row?.buildingKey) > 0)
            keys.add(keyOf(row.map, row.buildingKey));
        }
        const same = keys.size === entry.keys.size && [...keys].every((k) => entry.keys.has(k));
        entry.keys = keys;
        if (!same) _version++;
      },
      () => {
        if (_regions.get(region) === entry) entry.failed = true;
      },
    )
    .finally(() => {
      entry.busy = false;
    }); // AUDIT TECH-FEEDBACK II F4
}

/** Whether the house `buildingKey` of town `map` holds a trader with goods up, as last read. */
export function isVendorHouse(map, buildingKey) {
  if (!_open()) return false;
  const k = keyOf(map, buildingKey);
  for (const r of _regions.values()) if (r.keys.has(k)) return true;
  return false;
}

/** Moves each time a read changes the marked houses (the town sheet repaints on it). */
export const vendorHousesVersion = () => _version;

/** Tests only. */
export function _resetVendorHousesForTests() {
  _read = null;
  _open = () => true;
  _loads = null;
  _regions.clear();
  _version = 0;
}
