// @ts-check
// ═══════════════════════════════════════════════════════════════════
// URBANIZER U1 (2026-10-26; KPbICA's spec, forwarded by the owner: "Buildings assets should utilize more cut stones,
// bricks, half-timbering"; bible/03-World/Urban-Fabric.md section 2) - A PROVINCE'S TOWNS IN THEIR OWN STONE.
//
// Daggerfall dresses a town's buildings in its location's climate (DaggerfallLocation's ClimateUse.UseLocation:
// ClimateSwaps.ApplyClimate rebases every exterior set - CityA, CityB, the merchants' homes, the villages, the manors,
// the taverns, the farms - onto the climate's base: Desert 0, Mountain 100, Temperate 300, Swamp 400). Measured on the
// freeware (the four bases' exterior sets side by side, the player's own TEXTURE.0xx-4xx - nothing of them kept):
//   - MOUNTAIN is cut stone and rubble - grey ashlar, coursed rubble, cobble walls under timber framing in its villages,
//     dark stone taverns with their posts: the Nord's stone and timber;
//   - TEMPERATE is the Breton's half-timbering - braced frames over plaster, frames over brick in the merchants' homes and
//     the manors and the farms, plain plaster in CityA, boards in its villages;
//   - DESERT is sandstone and stucco - plastered walls under arched windows, sandstone brick in its castles and merchants'
//     homes, adobe in its villages and farms;
//   - SWAMP is timber over cobble and brick, overgrown - frames over stone in CityA, over brick in CityB, vines and moss
//     over the rest.
// A town past the Bay stood on its ZONE's climate (TESA-BIOME, world/tamriel/tamrielBiomes.js - getWorldClimateSettings
// of CLIMATE.PAK's value), and Daggerfall maps MountainWoods to TEMPERATE: half of Skyrim (the Tundra Plains, the
// Pinewoods) stood Breton half-timber over plaster, Mournhold's Deshaan and the Telvanni Peninsula with it, Cyrodiil's
// jungles the Swamp's vines, Summerset's Auridon the Breton frames.
//
// So a town past the Bay wears its PROVINCE's set, its ground still its zone's: TOWN_LOOK, a base a province - Skyrim the
// Mountain's stone and timber everywhere, Cyrodiil the Temperate's half-timbering and brick, Hammerfell and Elsweyr the
// Desert's sandstone, Summerset and Morrowind the Desert's pale stucco (the Velothi's, the Altmer's - never the Breton
// frames), Valenwood and Black Marsh the Swamp's timber - and TOWN_LOOK_ZONES, the zones whose own country is another's
// stone (Wrothgar's and the Jerall's mountain stone, Vvardenfell's ash country the Mountain's dark rubble, Blackwood's
// marsh timber). Only the location's `climateType` moves (the set its buildings' and its interiors' pictures swap to,
// pixelBuild.js townClimateBase, worldModes.js's interior): its ground, its trees, its people, its sky stay its zone's.
//
// DEPARTURE (named; Port-Ledger section A, URBANIZER): from DFU's ClimateUse.UseLocation reading the location's climate
// whole - past the Bay the set is the province's. The Bay's towns are Daggerfall's and keep theirs; the Imperial City
// is its own district work (not this module's - TESA11, world/imperialCity.js).
//
// Pure but for `townClimateAt`'s reading of the land (the province and the zone under a pixel, the trace's).
// ═══════════════════════════════════════════════════════════════════
import { CLIMATE_BASE_TYPES } from '../../formats/mapsFile.js';
import { provinceKeyBeyondBay } from '../tamriel/tamrielLand.js';
import { tamrielBiomeAt } from '../tamriel/tamrielBiomes.js';

const { Desert, Mountain, Temperate, Swamp } = CLIMATE_BASE_TYPES;
const look = (base, why) => Object.freeze({ base, why });

/** A province's towns' building set past the Bay - its climate base (ClimateSwaps.ApplyClimate's), and why. */
export const TOWN_LOOK = Object.freeze({
  Skyrim: look(Mountain, "the Nord's stone and timber - ashlar and rubble walls, framing over stone"),
  HighRock: look(Temperate, "the Breton's half-timbering over plaster and brick"),
  Hammerfell: look(Desert, "the Redguard's sandstone and adobe"),
  Sumurset: look(Desert, "the Altmer's pale stone and stucco under arched windows"),
  Valenwood: look(Swamp, "the Bosmer's timber under the forest's vines"),
  Elsweyr: look(Desert, "the Khajiit's sandstone and adobe"),
  BlackMarsh: look(Swamp, "the Argonian's timber over the marsh's stone, overgrown"),
  Morrowind: look(Desert, "the Velothi's stucco and sandstone"),
  Imperial: look(Temperate, "the Empire's half-timbering, brick and cut stone"),
});

/** The zones (world/tamriel/tamrielBiomes.js keys) whose own country is another set's than their province's. */
export const TOWN_LOOK_ZONES = Object.freeze({
  highRockWrothgar: look(Mountain, "Wrothgar's mountain stone"),
  morrowindAshlands: look(Mountain, "the ash country's dark rubble - the Redoran's"),
  morrowindRedMountain: look(Mountain, "the ash country's dark rubble"),
  morrowindVelothi: look(Mountain, "the Velothi Mountains' stone"),
  cyrodiilJerall: look(Mountain, "the Jerall's Nord stone - Bruma's"),
  cyrodiilBlackwood: look(Swamp, "Blackwood's marsh timber"),
});

/** A town's building set by its province and its zone: the zone's own where it has one, else its province's, else null
 *  (a province this table does not name - the Bay's own towns are never asked). */
export function townLookBase(province, zone = null) {
  const z = zone ? TOWN_LOOK_ZONES[zone] : null;
  if (z) return z.base;
  return Object.hasOwn(TOWN_LOOK, province ?? '') ? TOWN_LOOK[province].base : null;
}

/** A location's climate settings with its buildings' set made `base` (only `climateType` moves); the same settings where
 *  it already wears it or none is given. */
export function withTownLook(settings, base) {
  if (!settings || base == null || settings.climateType === base) return settings;
  return Object.freeze({ ...settings, climateType: base, zoneClimateType: settings.climateType });
}

/**
 * THE CLIMATE A TOWN PAST THE BAY STANDS IN (scenes/tamrielPlacesHost.js - every place, the countryside's towns and the
 * capitals but the Imperial City): its pixel's climate settings (`settings`, getWorldClimateSettings of the pixel's
 * climate) with its buildings' set its province's (townLookBase over the province and the zone under the pixel).
 * @param {number} px @param {number} py @param {any} settings
 */
export function townClimateAt(px, py, settings) {
  return withTownLook(settings, townLookBase(provinceKeyBeyondBay(px, py), tamrielBiomeAt(px, py)?.key ?? null));
}
