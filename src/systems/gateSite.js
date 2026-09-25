// @ts-check
// WB1 (2026-09-25): WHERE THE GATE STANDS - the client's half of the site, over the world's own data.
//
// net/gateLaw.js rolls a day's region and pixel over LISTS; this module makes the lists, once a session, from the map
// files every client holds alike (MAPS.BSA's locations, the climate and politic pages) - so every client finds the
// same spot with no word from the relay (spawned dungeons' law). A pixel is SUITABLE when:
//
//   - it is LAND (not the Ocean climate - the spawned dungeons' own test);
//   - NO LOCATION stands on it or on any of its eight neighbours (a gate does not open in a hamlet's orchard);
//   - it is REACHABLE: a town a traveller can fast-travel to (a city, a hamlet or a village) stands GATE_TOWN_MIN_PX
//     to GATE_TOWN_MAX_PX pixels from it (Chebyshev) - online a trip arrives at once (OL2), so the gate is a ride
//     from a town, not a march across a province; the nearest such town names the gate in the chat;
//   - no SPAWNED DUNGEON is rolled there (world/spawnedDungeons.js): a spawn stands at its pixel's centre, and so, near
//     enough, does a gate.
//
// THE SCAN IS THE WHOLE MAP, ONCE: a mask of the locations' neighbourhoods and one of the towns' rings, built from the
// location lists (thousands of rows, not the half-million pixels), then one pass over the pixels with array reads and
// one hash each. The answer is kept for the session; the data does not change under it.
//
// Not a DFU member. Ledger A (WB).
import { CLIMATES, LOCATION_TYPES, REGION_NAMES } from '../formats/mapsFile.js';
import { spawnsDungeon, WORLD_SALT } from '../world/spawnedDungeons.js';
import { pickGateRegion, pickGatePixel, gateSpotLocal, omenRing } from '../net/gateLaw.js';

const W = 1000, H = 500;
/** The towns a gate may be reached from: DFU's fast-travel towns. */
export const GATE_TOWN_TYPES = Object.freeze([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
/** How far from its town a gate may stand, map pixels (Chebyshev): far enough to be the wilds, near enough to ride. */
export const GATE_TOWN_MIN_PX = 2;
export const GATE_TOWN_MAX_PX = 4;
/** A region needs at least this many suitable pixels to hold a gate - a sliver of a province is no place for one. */
export const GATE_REGION_MIN_PIXELS = 24;

/** Is a politic value a province's (MapsFile.getRegionIndexAt's own bands: High Rock's sea coast 64, a region's
 *  128 + index, and the one known bad value 128 + 105 that DFU reads as the Wrothgarian Mountains)? */
export const politicClaimed = (pol) => pol === 64 || (pol >= 128 && pol < 128 + REGION_NAMES.length) || pol === 128 + 105;

/**
 * The world's suitable pixels, by region.
 * @param {{regionCount:number, getRegion:(r:number)=>any, getClimateIndex:(x:number,y:number)=>number, getPoliticIndex:(x:number,y:number)=>number, getRegionIndexAt:(x:number,y:number)=>number}} maps
 * @param {{spawnSalt?: number}} [o]
 * @returns {{byRegion: Map<number, Int32Array>, towns: Array<{name:string, px:number, py:number, region:number}>, townAt: Int32Array}}
 */
export function scanGatePixels(maps, { spawnSalt = WORLD_SALT } = {}) {
  const near = new Uint8Array(W * H);
  const townAt = new Int32Array(W * H).fill(-1);
  const townDist = new Uint8Array(W * H).fill(255);
  const towns = [];
  const townTypes = new Set(GATE_TOWN_TYPES);
  for (let r = 0; r < (maps?.regionCount ?? 0); r++) {
    const region = maps.getRegion(r);
    const table = region?.mapTable;
    if (!table) continue;
    for (let i = 0; i < table.length; i++) {
      const row = table[i];
      if (!row) continue;
      const id = (row.mapId >>> 0) & 0xfffff;   // DFU's own law: the low 20 bits of a MapId ARE its pixel (y * 1000 + x)
      const px = id % 1000, py = Math.floor(id / 1000);
      if (px >= W || py >= H) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx, y = py + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) near[y * W + x] = 1;
      }
      if (!townTypes.has(row.locationType)) continue;
      const t = towns.length;
      towns.push({ name: String(region.mapNames?.[i] ?? ''), px, py, region: r });
      for (let dy = -GATE_TOWN_MAX_PX; dy <= GATE_TOWN_MAX_PX; dy++) for (let dx = -GATE_TOWN_MAX_PX; dx <= GATE_TOWN_MAX_PX; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d < GATE_TOWN_MIN_PX) continue;
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const p = y * W + x;
        if (d < townDist[p]) { townDist[p] = d; townAt[p] = t; }   // the NEAREST town names the gate; the first listed wins a tie
      }
    }
  }
  /** @type {Map<number, number[]>} */
  const lists = new Map();
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (near[p] || townAt[p] < 0) continue;
      if (maps.getClimateIndex(x, y) === CLIMATES.Ocean) continue;
      if (spawnsDungeon(spawnSalt, x, y)) continue;
      // the POLITIC page says whose land it is; getRegionIndexAt clamps a value it does not know to region 0, so a
      // pixel no province claims would otherwise join the first province's list
      if (!politicClaimed(maps.getPoliticIndex(x, y))) continue;
      const r = maps.getRegionIndexAt(x, y);
      let list = lists.get(r);
      if (!list) lists.set(r, list = []);
      list.push(p);
    }
  }
  const byRegion = new Map();
  for (const [r, list] of lists) byRegion.set(r, Int32Array.from(list));   // row-major, so ascending: the roll's order is the data's
  return { byRegion, towns, townAt };
}

/** The regions a gate may open in, ascending. */
export const gateRegions = (scan) => [...scan.byRegion.keys()].filter((r) => scan.byRegion.get(r).length >= GATE_REGION_MIN_PIXELS).sort((a, b) => a - b);

/**
 * A day's gate site, or null when the world offered no ground at all.
 * @param {number} day
 * @param {ReturnType<typeof scanGatePixels>} scan
 */
export function findGateSite(day, scan) {
  const region = pickGateRegion(day, gateRegions(scan));
  if (region == null) return null;
  const id = pickGatePixel(day, scan.byRegion.get(region));
  if (id == null) return null;
  const px = id % W, py = Math.floor(id / W);
  const town = scan.towns[scan.townAt[id]] ?? null;
  const spot = gateSpotLocal(day);
  const regionName = REGION_NAMES[region] ?? '';
  const near = town?.name || regionName;
  return { day, region, regionName, px, py, town, spot, ring: omenRing(day, px, py, spot), near, place: town?.name && regionName ? `${town.name}, ${regionName}` : near };
}
