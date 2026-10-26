// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): A PORT TOWN'S SITES, KEPT.
//
// Placing a port town's shipyard and lighthouse (portSites.js portSitesOn) tries every spot of the town's ground in four
// turns - 230 ms inside the start town's pixel build on a warm launch, every launch, for the same answer. The answer is
// a function of what portSitesOn reads and nothing else: the ground's closed and road cells and the sea field. So it is
// kept in the player's derived store under a stamp over exactly those - the cells' bytes and the field's value at every
// cell - and a town whose ground or water changed (a mod's layout, a yard moved) is a different key.
//
// Every town's sites live in one small record, fetched before the world's first pixel builds (prefetchPortSites, from
// the mod world-data loader), so the build stays synchronous; a town placed anew is written back a moment later.

import { fnv1a, derivedValueStore } from '../systems/firstVisit/firstVisitStore.js';
import { portSitesOn } from './portSites.js';
import { closeSite } from './merchantYards/merchantYardSites.js';

/** Bump when portSitesOn's placing changes shape. */
export const PORT_SITES_VERSION = 1;
const RECORD_KEY = `fv-port-sites:v${PORT_SITES_VERSION}`;
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

const isSites = (v) => Array.isArray(v) && v.every((s) => s && typeof s.kind === 'string' && Number.isInteger(s.gx) && Number.isInteger(s.gy) && Number.isInteger(s.nx) && Number.isInteger(s.nz));
const isRecord = (v) => v instanceof Map && [...v.values()].every(isSites);

/** Fetch every kept town's sites. Answers how many towns were found. */
export async function prefetchPortSites(store = derivedValueStore()) {
  if (kept) return kept.towns.size;
  const hit = store ? await store.get(RECORD_KEY) : null;
  kept = { towns: isRecord(hit) ? hit : new Map(), store, timer: null };
  return kept.towns.size;
}

/**
 * portSitesOn's answer for this ground and field: the kept sites (closed on `g`, as portSitesOn closes them), or
 * portSitesOn's own, kept. Each call answers fresh objects - the host dresses the sites it is handed.
 * @param {{ width: number, height: number, blocked: Uint8Array, road: Uint8Array }} g
 * @param {{ at: (gx: number, gy: number) => number, kind?: string }} field
 */
export function keptPortSitesOn(g, field) {
  if (!kept) return portSitesOn(g, field);
  const key = portSitesStamp(g, field);
  const sites = kept.towns.get(key);
  if (sites) {
    kept.towns.delete(key);
    kept.towns.set(key, sites);   // the most recent last
    for (const s of sites) closeSite(g, s);
    return structuredClone(sites);
  }
  const placed = portSitesOn(g, field);
  kept.towns.set(key, structuredClone(placed));
  while (kept.towns.size > PORT_SITES_MAX) kept.towns.delete(kept.towns.keys().next().value);
  scheduleSave();
  return placed;
}

function scheduleSave() {
  const k = kept;
  if (!k?.store || k.timer) return;
  k.timer = setTimeout(() => { k.timer = null; k.store.set(RECORD_KEY, k.towns); }, SAVE_AFTER_MS);
}

/** Tests: write what was added now. */
export async function _flushPortSites() {
  const k = kept;
  if (!k?.store) return;
  if (k.timer) { clearTimeout(k.timer); k.timer = null; }
  await k.store.set(RECORD_KEY, k.towns);
}
/** Tests: forget the fetched record. */
export function _resetPortSites() { if (kept?.timer) clearTimeout(kept.timer); kept = null; }
