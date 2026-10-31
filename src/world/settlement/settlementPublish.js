// @ts-check
// RMB-CONTRACTS RMBC7 (2026-10-31, bible/03-World/RMB-Contracts.md RD-6, RD-19, RD-20): WHAT A REVISION MAY NOT MOVE. A
// town's protected keys are its homes' and halls' (the account service's /v1/homes/town answer, readable by anyone). A
// published settlement is revised against them through its ledger; a grown town's keys are its anchors' own, so a
// revision there is refused when a protected key's anchor would be gone. tools/settlementRevise.mjs asks these. Pure.
import { keyBandOf } from './settlementContract.js';
import { dressSettlement } from './settlementGen.js';

/** A town's protected keys from its homes' answer: every home's and hall's key, sorted, once each.
 *  @param {{ mapId?: number, homes?: Array<{ buildingKey?: number }> }} answer @returns {{ place: number, keys: number[] }} */
export function protectedOfTown(answer) {
  const keys = new Set();
  for (const home of answer?.homes ?? []) if (Number.isSafeInteger(home?.buildingKey) && /** @type {number} */ (home.buildingKey) > 0) keys.add(home.buildingKey);
  return { place: (answer?.mapId ?? 0) >>> 0, keys: [...keys].sort((a, b) => a - b) };
}

/** A revision's conflicts: the plan dressed from its layout with the town's protected keys and what was published; [] when
 *  it may publish. @param {any} input @param {any} layout @param {number[]} protectedKeys @param {any[]} [published] */
export function revisionConflicts(input, layout, protectedKeys, published = []) {
  return dressSettlement({ ...input, protectedKeys, published }, layout).report.conflicts;
}

/** What a protected building may not change: its name, kind and access, and where it stands (its yard and rooms hang off it). */
const KEPT = ['anchor', 'type', 'access', 'pad', 'at', 'yaw', 'lift', 'footprint'];

/** A grown town's protected minted keys its new plan loses: a key no building holds, or one whose building `published`
 *  named, typed or stood otherwise (each field the published row holds) - a home gone, handed on, made a shop or moved.
 *  @param {{ buildings: Array<{ key: number }> }} plan @param {number[]} protectedKeys @param {any[]} [published]
 *  @returns {number[]} */
export function protectedGone(plan, protectedKeys, published = []) {
  const held = new Map(plan.buildings.map((b) => [b.key, b])), was = new Map(published.map((b) => [b.key, b]));
  const changed = (/** @type {any} */ a, /** @type {any} */ b) => KEPT.some((f) => f in a && JSON.stringify(a[f]) !== JSON.stringify(b[f]));
  return protectedKeys.filter((k) => keyBandOf(k) === 'minted' && (!held.has(k) || (was.has(k) && changed(was.get(k), held.get(k)))));
}
