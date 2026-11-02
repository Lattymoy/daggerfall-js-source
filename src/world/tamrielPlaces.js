// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA12 (2026-10-13, the owner: "I want to make it where attaching the arena file isn't needed"; asked, "Canon +
// generated" and "Remove it"; bible/03-World/Arena-Provinces.md TESA12) - THE PLACES PAST THE BAY, THE PORT'S OWN.
//
// Arena's CITYDATA.65 stood the towns past the Bay from the player's own copy of Arena; nothing of Arena is read now. The
// places are made here, on the trace (world/tamriel/tamrielLand.js - Daggerfall's own picture of Tamriel, the player's files), the
// same on every client, online and off:
//
//   THE CITIES are TAMRIEL1's (world/tamriel/tamrielGeography.js CITIES) - the lore's own, placed by the port's reading of the
//   lore map: Windhelm and Whiterun, Anvil and Kvatch, Vivec and Necrom, Senchal, Woodhearth, Lilmoth. Each stands on its
//   point, or on its province's land nearest it within SNAP_REACH; one TAMRIEL1 calls a port (`port`) stands on its
//   shore (world/arenaPlaces.js standArenaPixels). A capital's is pinned on the capital the port built.
//   THE TOWNS AND VILLAGES are made: PLACE_COUNTS of each a province - Arena's own shape of a province (eight towns and
//   sixteen villages, a count and no data) - each on its province's land past the Bay, as far from every place before it
//   as PLACE_TRIES draws off the province's hash find (the best of the tries), named by its province's people
//   (world/tamrielCountry.js countryName: a hamlet's and a village's stem off the province's DFU name bank), no name twice.
//
// Every place keeps TESA2's slot law (world/arenaLocations.js arenaPlaceId: its province's PLACES_PER_PROVINCE slots, then
// its own): the cities 0 on in TAMRIEL1's order, the towns from TOWN_SLOT, the villages from VILLAGE_SLOT. Pure over the
// trace and the fit (the Bay's rectangle on the picture is the fit's).
// ═══════════════════════════════════════════════════════════════════
import { CITIES } from './tamriel/tamrielGeography.js';
import { PROVINCE_OF_ID } from './tamriel/tamrielLand.js';
import { PICTURE_W, PICTURE_H, bayPictureRect } from './tamriel/tamrielFrame.js';
import { hash32 } from './spawnedDungeons.js';
import { countryName } from './tamrielCountry.js';
import { provinceNameBank } from './tamrielPeople.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';

/** A province's slots in the places' lane (TESA2's ordinal: province * PLACES_PER_PROVINCE + slot). */
export const PLACES_PER_PROVINCE = 48;
/** The provinces in the lane's order - the picker's race order, the Imperial Province ninth (PROVINCE_OF_ID's 1 to 9). */
export const PLACE_PROVINCES = Object.freeze(Array.from({ length: 9 }, (_, p) => PROVINCE_OF_ID[p + 1]));
/** The made places a province: Arena's shape of one, eight towns and sixteen villages. */
export const PLACE_COUNTS = Object.freeze({ town: 8, village: 16 });
/** The first slot of a province's towns, and of its villages - its cities below them. */
export const TOWN_SLOT = 16;
export const VILLAGE_SLOT = TOWN_SLOT + PLACE_COUNTS.town;
/** The draws a made place's point takes: the farthest of them from every place before it stands. */
export const PLACE_TRIES = 24;
/** How far, picture pixels, a city off its province's land is moved onto it - past this it is left off. TAMRIEL1's points
 *  were read off the lore map, whose coasts lie wider than the picture's: the farthest on the freeware's trace is 22.6
 *  (Thorn, Black Marsh's east coast, onto the picture's). */
export const SNAP_REACH = 24;
/** A snapped city stands this far inside the pixel it was moved onto, so a fraction never reads the neighbour. */
export const SNAP_INSET = 0.1;
/** How far inside the Bay's rectangle's edge, picture pixels, no made place stands - the Bay's own ground is the Bay's. */
export const BAY_MARGIN = 1;
/** The made places' salt (their hash's own). */
const SALT = 0x7a12;
/** A made place's kind and the Daggerfall type its name is framed for. */
/** @type {ReadonlyArray<readonly ['town' | 'village', number, number]>} */
const MADE = Object.freeze([
  Object.freeze(/** @type {const} */ (['town', LOCATION_TYPES.TownHamlet, TOWN_SLOT])),
  Object.freeze(/** @type {const} */ (['village', LOCATION_TYPES.TownVillage, VILLAGE_SLOT])),
]);

/** The land of one province on a trace, as a predicate over picture points - provinceKeyAt's own reading (the pixel under
 *  the point, nothing off the grid), over one mask made once a province.
 *  @param {import('./tamriel/tamrielLand.js').TamrielTrace} trace @param {string} key */
export function provinceLand(trace, key) {
  const { w, h, land, province } = trace;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) if (land[i] && PROVINCE_OF_ID[province[i]] === key) mask[i] = 1;
  return (x, y) => {
    const px = Math.floor(x),
      py = Math.floor(y);
    return px >= 0 && py >= 0 && px < w && py < h && mask[py * w + px] === 1;
  };
}

/** A point off its province's land (`own`), onto the nearest of it within SNAP_REACH - the point clamped into the nearest
 *  pixel of the province, SNAP_INSET inside its edges - or null. */
export function snapToProvince(x, y, own, reach = SNAP_REACH) {
  if (own(x, y)) return { x, y, d: 0 };
  let best = null,
    bd = reach + 1e-9;
  const x0 = Math.max(0, Math.floor(x - reach)),
    x1 = Math.min(PICTURE_W - 1, Math.floor(x + reach));
  const y0 = Math.max(0, Math.floor(y - reach)),
    y1 = Math.min(PICTURE_H - 1, Math.floor(y + reach));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const qx = Math.min(Math.max(x, px + SNAP_INSET), px + 1 - SNAP_INSET);
      const qy = Math.min(Math.max(y, py + SNAP_INSET), py + 1 - SNAP_INSET);
      const d = Math.hypot(qx - x, qy - y);
      if (d >= bd || !own(qx, qy)) continue;
      bd = d;
      best = { x: qx, y: qy, d };
    }
  }
  return best;
}

/** A province's picture pixels a made place may stand on: its land with the pixel's whole square outside the Bay's
 *  rectangle and BAY_MARGIN more, in row order. @param {(x: number, y: number) => boolean} own */
export function provinceCells(own, bay = bayPictureRect()) {
  const cells = [];
  for (let y = 0; y < PICTURE_H; y++) {
    for (let x = 0; x < PICTURE_W; x++) {
      if (!own(x + 0.5, y + 0.5)) continue;
      const inBay =
        x + 1 > bay.x0 - BAY_MARGIN &&
        x < bay.x1 + BAY_MARGIN &&
        y + 1 > bay.y0 - BAY_MARGIN &&
        y < bay.y1 + BAY_MARGIN;
      if (!inBay) cells.push([x, y]);
    }
  }
  return cells;
}

/** A made place's point: of PLACE_TRIES draws off the province's hash (a cell, then a point inside it a quarter in from its
 *  edges), the one farthest from every point in `taken` - the first on a tie; none with no cell.
 *  @param {Array<[number, number]>} cells @param {Array<{ px: number, py: number }>} taken */
export function madePoint(cells, taken, p, slot) {
  if (!cells.length) return null;
  let best = null,
    bd = -1;
  for (let t = 0; t < PLACE_TRIES; t++) {
    const [cx, cy] = cells[hash32(SALT, p, slot, t) % cells.length];
    const h = hash32(SALT ^ 0x55, p, slot, t);
    const x = cx + 0.25 + 0.5 * ((h & 0xffff) / 0x10000),
      y = cy + 0.25 + 0.5 * ((h >>> 16) / 0x10000);
    let d = Infinity;
    for (const q of taken) d = Math.min(d, Math.hypot(q.px - x, q.py - y));
    if (d > bd) {
      bd = d;
      best = { x, y };
    }
  }
  return best;
}

/** A made place's name: its type's frame off its province's bank (countryName), drawn again past a name `used` has - the
 *  empty string after eight draws that all were. */
export function madeName(type, bank, p, slot, used) {
  for (let k = 0; k < 8; k++) {
    const name = countryName(type, bank, hash32(SALT, p, slot, 100 + k));
    if (name && !used.has(name)) return name;
  }
  return '';
}

/**
 * THE PLACES ON A TRACE: { provinces, places, lost } - each province { index, key, cells } (the cells its made places
 * may stand on), each place { province, provinceIndex, id, kind, name, px, py, snapped, port? } on the picture grid
 * (`snapped` the picture pixels a city was moved), `lost` the cities no land took. Null trace, none.
 * @param {import('./tamriel/tamrielLand.js').TamrielTrace | null} trace
 */
export function makeTamrielPlaces(trace, bay = bayPictureRect()) {
  const provinces = [],
    places = [],
    lost = [];
  if (!trace) return { provinces, places, lost };
  const used = new Set(CITIES.map((c) => c.name));
  PLACE_PROVINCES.forEach((key, p) => {
    const own = provinceLand(trace, key);
    const mine = [];
    CITIES.filter((c) => c.province === key).forEach((c, id) => {
      const place = {
        province: key,
        provinceIndex: p,
        id,
        kind: 'city-state',
        name: c.name,
        ...(c.port ? { port: true } : {}),
      };
      const at = snapToProvince(c.at[0], c.at[1], own);
      if (!at) {
        lost.push({ ...place, px: c.at[0], py: c.at[1] });
        return;
      }
      mine.push({ ...place, px: at.x, py: at.y, snapped: at.d });
    });
    const cells = provinceCells(own, bay);
    provinces.push({ index: p, key, cells: cells.length });
    const bank = provinceNameBank(key);
    for (const [kind, type, first] of MADE) {
      for (let i = 0; i < PLACE_COUNTS[kind]; i++) {
        const slot = first + i,
          at = madePoint(cells, mine, p, slot);
        if (!at) break;
        const name = bank == null ? '' : madeName(type, bank, p, slot, used);
        if (!name) continue;
        used.add(name);
        mine.push({ province: key, provinceIndex: p, id: slot, kind, name, px: at.x, py: at.y, snapped: 0 });
      }
    }
    places.push(...mine);
  });
  return { provinces, places, lost };
}
