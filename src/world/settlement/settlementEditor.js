// @ts-check
// THE EDITOR'S SEAM. What the WORLD 2.0 editor asks of a
// settlement: a published row's controls changed within their bounds (`params`) and its structure fixed (`fix`), one
// district dressed again from a seed of its own while every other keeps its buildings and keys, and what changed between
// two plans. The ledger keeps every key an anchor still holds and refuses a protected one's loss. Pure.
import { dressSettlement } from './settlementGen.js';

/** The controls a row may set, each its least and most; the layout holds a ring to three sectors at least. */
export const PARAM_BOUNDS = Object.freeze({ size: [0.5, 2], density: [0.5, 2], bands: [1, 8], sectors: [2, 16], open: [0, 0.9] });
/** The structures a row may fix. */
export const FIX_LAYOUTS = Object.freeze(['ring', 'row']);

/**
 * A row with `patch` applied - its params and fix - and what the patch got wrong; a refused patch leaves the row as it
 * was. @param {any} row a settlements.json row @param {{ params?: Record<string, number>, fix?: any }} patch
 * @returns {{ row: any, problems: string[] }}
 */
export function editSettlementRow(row, patch) {
  const problems = [];
  const params = { ...(row.params ?? {}) };
  for (const [k, value] of Object.entries(patch.params ?? {})) {
    const range = PARAM_BOUNDS[/** @type {keyof typeof PARAM_BOUNDS} */ (k)];
    if (!range) { problems.push(`no control '${k}'`); continue; }
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) { problems.push(`${k} ${value} is outside ${range[0]} to ${range[1]}`); continue; }
    params[k] = value;
  }
  let fix = row.fix;
  if (patch.fix !== undefined) {
    const wanted = patch.fix;
    if (!FIX_LAYOUTS.includes(wanted?.layout)) problems.push(`layout '${wanted?.layout}' is not one of ${FIX_LAYOUTS.join(', ')}`);
    else if (wanted.centre && !(wanted.centre.length === 2 && wanted.centre.every(Number.isFinite))) problems.push('centre is not two numbers');
    else if (wanted.shore && !(Math.abs(Math.hypot(wanted.shore.dir?.[0], wanted.shore.dir?.[1]) - 1) < 1e-6 && wanted.shore.at > 0)) problems.push('shore is not a unit direction and a distance');
    else fix = wanted;
  }
  return problems.length ? { row, problems } : { row: { ...row, params, fix }, problems };
}

/**
 * One district dressed again from its own seed: every other district's buildings, keys and services stand as they were,
 * and the ledger keeps each key its anchor still holds. `published` the plan before; `protectedKeys` the town's.
 * @param {any} input @param {any} layout @param {string} district e.g. 'd3' @param {number} seed
 * @param {{ ledger?: any, published?: any[], protectedKeys?: number[] }} [was]
 */
export function regenerateDistrict(input, layout, district, seed, { ledger = input.ledger, published = [], protectedKeys = [] } = {}) {
  const made = dressSettlement({ ...input, ledger, published, protectedKeys, districtSeeds: { ...(input.districtSeeds ?? {}), [district]: seed >>> 0 } }, layout);
  return { ...made, changed: planDiff({ buildings: published }, made.plan) };
}

/**
 * What changed between two plans' buildings, by key: added, removed, moved (its pad, place, turn or footprint), retyped.
 * @param {{ buildings: any[] }} before @param {{ buildings: any[] }} after
 */
export function planDiff(before, after) {
  const was = new Map(before.buildings.map((b) => [b.key, b])), now = new Map(after.buildings.map((b) => [b.key, b]));
  const stand = (/** @type {any} */ b) => JSON.stringify([b.pad, b.at, b.yaw, b.lift, b.footprint]);
  const keys = (/** @type {(k: number) => boolean} */ keep, /** @type {Map<number, any>} */ from) => [...from.keys()].filter(keep).sort((a, b) => a - b);
  return {
    added: keys((k) => !was.has(k), now),
    removed: keys((k) => !now.has(k), was),
    moved: keys((k) => was.has(k) && stand(was.get(k)) !== stand(now.get(k)), now),
    retyped: keys((k) => was.has(k) && was.get(k).type !== now.get(k).type, now),
  };
}
