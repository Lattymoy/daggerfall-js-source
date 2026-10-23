// @ts-check
// HARBOUR-BOOK (2026-10-04, from the field: the port towns' new docks "missing" for some players) - THE HARBOURS FOUND
// NEAR THE PLAYER, ONE BOOK FOR THE QUAYS AND THE SEA. SHIP-LIFE's harbours (shipLife.js findHarbour) were the naval
// host's own Map, sounded in its frame alone - and that frame runs only while Naval Combat and Come Sail Away do, so a
// player with either off stood no quay in any port. A port's quays are its town's, not the sea fight's: the harbours are
// kept here, the world host sounds them every exterior frame whatever runs on the water, and the quays
// (scenes/quayPool.js) and the naval host (its moored ships, its docking, its errands) read the same book.
//
// ITS LIFE (navalHost.js harbourFrame's, moved whole): the port town within a pixel of the player (`harbourNear` - its
// key, its name, its footprint in the scene now and whether every pixel the sounding reads is built) is sounded once
// that ground is built (AUDIT HOLDINGS O1: a pixel not built reads as land); a port that gave no harbour is sounded again
// HARBOUR_RETRY_S later (AUDIT SHIP-LIFE B7); the berths move with the floating origin (`offsetAll`), and the book is
// emptied at a transition, a jump and a load (`clear`) - found again where the world is next. A naval host made without
// a book (its tests) keeps one of its own and steps it in its frame, as before.
//
// FB1020c HARBOUR-REACH (the field, 2026-10-20: "a lot of harbor towns dont have harbors dispite being along the coast"):
// ONE REACH FOR BOTH LAWS. A port town is one the open sea bears on within SEA_RING map pixels (world/portSites.js
// portTownOnSea - its shipyard, its lighthouse, the harbour board's port), and its harbour was sounded on the built ground
// within HARBOUR_REACH (420 m) of its footprint alone. DFU's kernel (DefaultTerrainSampler, TerrainHelper's location blend)
// lays the shore of a coast whose land stands high or whose town fills its pixel far past that: on the real map 37 of the
// 106 port towns sounded no harbour at all - no quay, no docks, no ship moored - Daggerfall, Sentinel and Wayrest among
// them (their shores 1.5 km, 700 m and 1.1 km off their footprints). A Bay port whose own shore gives no berth is sounded
// again out to the ring the port law read (`portRingReach`: the pixels within SEA_RING of the town's), once its ground is
// built - never "no harbour" before it is (an unbuilt pixel reads as land) - and only once a book's life (its scan is some
// five times the near one's): 36 of the 37 stand a harbour then. Aldbrugh (Shalgora) still sounds none - left open, no
// port dropped. An isle's port past the Veil sounds its own reach (AUDIT CAPTAIN'S SEA H1) and asks no farther.
//
// Not a DFU member. Ledger A (QUAYS).
import { findHarbour, offsetHarbour, HARBOUR_REACH } from './shipLife.js';
import { SEA_RING } from '../../world/portSites.js';
import { TERRAIN_SIZE } from '../../world/terrain/terrainSampler.js';

/** AUDIT SHIP-LIFE B7: a port whose shore gave no harbour is sounded again after this (s) - the terrain streams in
 *  nearest-first, and a harbour sounded on arrival met unbuilt water. */
export const HARBOUR_RETRY_S = 10;

/** FB1020c HARBOUR-REACH: the reach (m) off a town's footprint `rect` that sounds the pixels within SEA_RING of its own -
 *  the ring the port law reads (a town's footprint stands at its pixel's middle, DFU's TerrainHelper's tile origin). */
export const portRingReach = (rect) => (SEA_RING + 0.5) * TERRAIN_SIZE - Math.max(rect.maxX - rect.minX, rect.maxZ - rect.minZ) / 2;

/**
 * `ready(reach)` - whether every pixel a sounding to `reach` (m, its own when none is named) reads is built.
 * @param {{
 *   harbourNear: () => ({ key: string, name?: string|null, rect: { minX: number, maxX: number, minZ: number, maxZ: number },
 *     ready?: (reach?: number) => boolean, reach?: number } | null),
 *   isWater: (x: number, z: number, hull: number) => boolean,
 * }} deps
 */
export function createHarbourBook(deps) {
  /** key -> { key, name, harbour (findHarbour's, or null: a port with no shore to berth at), at (when it was sounded),
   *  far (FB1020c HARBOUR-REACH: whether the port law's ring was sounded) } */
  const book = new Map();

  /** Sound the port near the player: once its ground is built, and again HARBOUR_RETRY_S after a sounding that found
   *  no harbour. FB1020c HARBOUR-REACH: a Bay port whose own shore gave none, out to the port law's ring once that ground
   *  is built. `clock` in seconds. */
  function step(clock) {
    const near = deps.harbourNear() ?? null;
    if (!near) return;
    const own = near.reach ?? HARBOUR_REACH;
    const sound = (reach = own) => findHarbour({ rect: near.rect, isWater: (x, z, h) => deps.isWater(x, z, h), reach });   // AUDIT CAPTAIN'S SEA H1: an isle port's own reach
    const h = book.get(near.key);
    if (!h) { if (near.ready?.() !== false) book.set(near.key, { key: near.key, name: near.name ?? null, harbour: sound(), at: clock }); }
    else if (!h.harbour && clock - h.at >= HARBOUR_RETRY_S && near.ready?.() !== false) { h.harbour = sound(); h.at = clock; }
    const e = book.get(near.key), far = own === HARBOUR_REACH ? portRingReach(near.rect) : 0;
    if (e && !e.harbour && !e.far && far > own && near.ready?.(far) !== false) { e.harbour = sound(far); e.far = true; }
  }
  /** The world moved (the floating origin): every harbour's berths, approaches and mouth with it, in place. */
  function offsetAll(o) { for (const h of book.values()) offsetHarbour(h.harbour, o); }
  /** A transition, a jump, a load: every harbour forgotten, to be sounded again where the world is next. */
  function clear() { book.clear(); }
  /** The harbours with berths, for the quays - `[{ key, name, harbour }]`. */
  function list() {
    const out = [];
    for (const h of book.values()) if (h.harbour?.berths?.length) out.push({ key: h.key, name: h.name ?? null, harbour: h.harbour });
    return out;
  }
  return { step, offsetAll, clear, list, get: (key) => book.get(key), values: () => book.values() };
}
