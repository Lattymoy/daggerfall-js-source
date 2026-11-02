// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): A PORT TOWN'S SITES, KEPT.
// portSitesOn (portSites.js) tries every spot of a town's ground for the shipyard and lighthouse: 230 ms in the start
// town's pixel build, every warm launch. The answer depends on the ground's closed and road cells and the sea field only,
// so it is kept under a stamp over those, and a changed town is a different key. The record's key is
// firstVisitPin('portSites') (tools/computationPin.mjs), so a code change starts the record afresh.
// All towns' sites are one small record, fetched before the first pixel build (prefetchPortSites, from the mod
// world-data loader) so the build stays synchronous. A town placed anew is written back a moment later.

import { fnv1a, derivedValueStore, keepAnswer, firstVisitPin } from '../systems/firstVisit/firstVisitStore.js';
import { portSitesOn } from './portSites.js';
import { closeSite } from './merchantYards/merchantYardSites.js';

/** The cache's scope: one record of every kept town. */
export const PORT_SITES_SCOPE = 'fv-port-sites:';
/** The record of every kept town, under the placing's pin. */
export const portSitesKey = () => `${PORT_SITES_SCOPE}${firstVisitPin('portSites')}`;
/** The towns kept - the most recently placed. */
export const PORT_SITES_MAX = 512;
const SAVE_AFTER_MS = 2000;

/** @type {{ towns: Map<string, object[]>, store: any, timer: any } | null} */
let kept = null;

/** The stamp of portSitesOn's inputs. @param {{ width: number, height: number, blocked: Uint8Array, road: Uint8Array }} g
 *  @param {{ at: (gx: number, gy: number) => number, kind?: string }} field */
export function portSitesStamp(g, field) {
  const { width: W, height: H } = g;
  const values = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) values[y * W + x] = field.at(x, y);
  let h = fnv1a(g.blocked);
  h = fnv1a(g.road, h);
  h = fnv1a(new Uint8Array(values.buffer), h);
  return `${W}x${H}:${field.kind ?? ''}:${h.toString(36)}`;
}

const isSites = (v) =>
  Array.isArray(v) &&
  v.every(
    (s) =>
      s &&
      typeof s.kind === 'string' &&
      Number.isInteger(s.gx) &&
      Number.isInteger(s.gy) &&
      Number.isInteger(s.nx) &&
      Number.isInteger(s.nz),
  );
const isRecord = (v) => v instanceof Map && [...v.values()].every(isSites);

/** Fetch every kept town's sites. Answers how many towns were found. */
export async function prefetchPortSites(store = derivedValueStore()) {
  if (kept) return kept.towns.size;
  const hit = store ? await store.get(portSitesKey()) : null;
  kept = { towns: isRecord(hit) ? hit : new Map(), store, timer: null };
  return kept.towns.size;
}

/**
 * portSitesOn's answer for this ground and field: the kept sites (closed on `g`, as portSitesOn closes them), or
 * portSitesOn's own, kept. Each call answers fresh objects - the host dresses the sites it is handed. `near` the town's
 * PORT_PLACES_NEAR row (portSites.js), in the key: the pin reads portSitesOn's code, not the table.
 * @param {{ width: number, height: number, blocked: Uint8Array, road: Uint8Array }} g
 * @param {{ at: (gx: number, gy: number) => number, kind?: string }} field
 * @param {Readonly<Record<string, ReadonlyArray<number>>>|null} [near]
 */
export function keptPortSitesOn(g, field, near = null) {
  if (!kept) return portSitesOn(g, field, near);
  const key = `${portSitesStamp(g, field)}${near ? `:near${JSON.stringify(near)}` : ''}`;
  const sites = kept.towns.get(key);
  if (sites) {
    kept.towns.delete(key);
    kept.towns.set(key, sites); // the most recent last
    for (const s of sites) closeSite(g, s);
    return structuredClone(sites);
  }
  const placed = portSitesOn(g, field, near);
  kept.towns.set(key, structuredClone(placed));
  while (kept.towns.size > PORT_SITES_MAX) kept.towns.delete(kept.towns.keys().next().value);
  scheduleSave();
  return placed;
}

function scheduleSave() {
  const k = kept;
  if (!k?.store || k.timer) return;
  k.timer = setTimeout(() => {
    k.timer = null;
    keepAnswer(k.store, portSitesKey(), k.towns, PORT_SITES_SCOPE);
  }, SAVE_AFTER_MS);
}

/** Tests: write what was added now. */
export async function _flushPortSites() {
  const k = kept;
  if (!k?.store) return;
  if (k.timer) {
    clearTimeout(k.timer);
    k.timer = null;
  }
  await keepAnswer(k.store, portSitesKey(), k.towns, PORT_SITES_SCOPE);
}
/** Tests: forget the fetched record. */
export function _resetPortSites() {
  if (kept?.timer) clearTimeout(kept.timer);
  kept = null;
}
