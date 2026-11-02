// @ts-check
// BAY-LEFT-B (2026-10-27, bible/03-World/Arena-Provinces.md BAY-LEFT-B) - A PLACE THE PORT MADE, BY ITS MAP ID ALONE. A
// leaf (a reader that keys by a map id - systems/banking.js's deeds, systems/discovery.js's store - asks it without the
// places' plans).
//
// DFU's MapId names a Bay place by its pixel in its low 20 bits (getMapPixelID, under the Bay's 1000 x 500). Every place
// the port made past the Bay or past the Veil carries a number of its own there, 500,000 and up - an Arena place
// (world/arenaLocations.js arenaPlaceId), a country place, a lair and a capital's slice (world/tamrielCountry.js
// countryPlaceId and the lanes after it), an isle's (world/etherPlaces.js etherPlaceId) - its lane in the high bits
// (AUDIT TESA II P6, systems/discovery.js discoveryKeyOf). A Bay place, a spawn on a Bay pixel and the Abyss's pits keep
// DFU's pixel.
import { MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';

/** The Bay's pixel ids: getMapPixelID's ceiling. */
export const BAY_PIXEL_IDS = MAX_MAP_PIXEL_X * MAX_MAP_PIXEL_Y;
/** Is a map id a place the port made (past the Bay or past the Veil) - its low 20 bits past the Bay's pixel ids? */
export const isMadePlaceId = (id) => ((Number(id) >>> 0) & 0xfffff) >= BAY_PIXEL_IDS;
