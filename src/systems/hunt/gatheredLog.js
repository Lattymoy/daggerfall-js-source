// @ts-check
// HUNTERS-MARK (2026-10-27; bible/10-UI/Collections.md section 10): WHAT A CHARACTER HAS GATHERED - the fish its net has
// brought up, by species (scenes/fishHost.js), and the trophies it has taken, by beast (systems/hunt/trophies.js) - kept in
// its save (the per-mod slot, systems/modSaveData.js), read by the Collections page's Fish and Trophies parts. Each row is
// how many and the UTC day of the first. Read defensively: a row out of its law is dropped.
import { registerModSaveData } from '../modSaveData.js';

export const GATHERED_VENDOR = 'gatheredLog';
/** The kinds the log keeps: a fish by its item template, a trophy by its beast (MobileTypes, or a mod's id). */
export const GATHERED_KINDS = Object.freeze(['fish', 'trophies']);
const fresh = () => ({ fish: {}, trophies: {} });
let log = /** @type {Record<string, Record<string, { n: number, day: number }>>} */ (fresh());

/** A save's record read: whole-number keys, each `{ n >= 1, day >= 0 }`. */
export function readGathered(/** @type {any} */ rec) {
  const out = fresh();
  for (const kind of GATHERED_KINDS) {
    const src = rec?.[kind];
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    for (const [k, v] of Object.entries(src)) {
      if (!/^\d{1,5}$/.test(k) || !Number.isSafeInteger(v?.n) || v.n < 1 || !Number.isSafeInteger(v?.day) || v.day < 0)
        continue;
      out[/** @type {'fish'|'trophies'} */ (kind)][k] = { n: v.n, day: v.day };
    }
  }
  return out;
}
/** One more of `key` gathered on UTC day `day` - the first's day kept. */
export function noteGathered(
  /** @type {'fish'|'trophies'} */ kind,
  /** @type {number} */ key,
  /** @type {number} */ day,
) {
  if (!GATHERED_KINDS.includes(kind) || !Number.isSafeInteger(key) || key < 0) return false;
  const row = log[kind][String(key)];
  const d = Number.isSafeInteger(day) && day >= 0 ? day : 0;
  log[kind][String(key)] = row ? { n: row.n + 1, day: row.day } : { n: 1, day: d };
  return true;
}
/** A kind's rows, `{ key: { n, day } }` - a copy. */
export const gatheredOf = (/** @type {'fish'|'trophies'} */ kind) => ({ ...(log[kind] ?? {}) });
export const _resetGatheredForTests = (/** @type {any} */ rec = null) => {
  log = readGathered(rec);
};

registerModSaveData(GATHERED_VENDOR, {
  newSaveData: () => fresh(),
  getSaveData: () => readGathered(log),
  restoreSaveData: (rec) => {
    log = readGathered(rec);
  },
});
