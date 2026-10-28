// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ZONE-SAFE (2026-10-25) - THE STREETS OF A SETTLEMENT ARE PEACE (bible/11-Multiplayer/Wild-Zone.md section 26).
//
// The owner: "Btw with the pvp changes. All cities should be considered safe zones" - and, asked which places, "Every
// settlement". In the open zone (Cyrodiil, and the open sea past Veilhaven's peace) no player's blow or spell lands on
// one who stands in the streets of a city, a town or a village, and none struck from there lands on anyone. The open
// country, the roads, the dungeons and the zone's halls are the zone's as they were.
//
// IN A SETTLEMENT, ONE LAW, HERE: Daggerfall Unity's own location test over the place a point stands on - the location
// its map pixel stands (the index the world host keeps: the Bay's rows, and past the Bay TESA's places as their pixels
// stand them - a capital's slices, Arena's towns, the countryside's hamlets), of a settlement's kind, and the point within
// that location's footprint widened one city block on every side (PlayerGPS.PlayerLocationRectCheck, :668-716; its rect
// SetWorldLocationRect, :636-659 - world/streamingWorld.js locationWorldRect, isInLocationRect). The pixel is the point's
// own, as DFU's CurrentLocation is the player's pixel's: a rect widened over its pixel's edge does not reach the next.
//
// THE KINDS ARE THE THREE DFU NAMES TOWNS (DFRegion.LocationTypes TownCity, TownHamlet, TownVillage). A DEPARTURE FROM
// DFU's IsPlayerInTown (PlayerGPS.cs:504-527), which counts four more for its rest and its watch - HomeFarms, HomeWealthy,
// Tavern, ReligionTemple (systems/nearbyObjects.js TOWN_LOCATION_TYPES): a farmstead, a manor, a roadside inn and a
// temple each stand alone in the open country, and MAPS.BSA holds 5,929 of them against 3,444 settlements (410 cities,
// 1,200 towns, 1,834 villages, of its 15,251 rows) - counted as towns they would stand a refuge on every road of the
// zone. They are DFU's towns still: the zone's watch answers a blow struck at one (ZONE-WATCH, scenes/world.js
// zoneWatchCall). A dungeon, a graveyard, a coven, a cult's shrine and a poor home are neither.
//
// WHO SAYS IT: each client of itself and of the bodies it sees. My word on the zone to the relay's referee is 0 in a
// settlement's streets (scenes/world.js wildCan -> setWildZone), so the referee - which lands a blow only where both
// fighters said they stand in the zone (net/wild/wildRef.js) - refuses every blow and cast into the streets and out of
// them; and every door of mine refuses a body whose shown pose stands in one (wildFair: the melee arm, the arrows, the
// cast engine's marks). The relay has no map: the defender's own word protects the defender (section 22's known limits).
// ═══════════════════════════════════════════════════════════════════
import { t } from '../textManager.js';
import { LOCATION_TYPES } from '../../formats/mapsFile.js';
import { worldCoordToMapPixel, locationWorldRect, isInLocationRect } from '../../world/streamingWorld.js';
import { wildInside, WILD_NAME } from './wildZone.js';   // WILD-CITY-PORT: the zone's own pixels; ZONE-HOMES: its name

/** The settlements' kinds: a city, a town, a village (MapsFile LocationTypes 0-2). */
export const SETTLEMENT_TYPES = Object.freeze(new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]));

/** Is `loc` (a DFLocation) a settlement: of a settlement's kind, with the exterior a footprint is read from.
 *  @param {any} loc @returns {boolean} */
export const isSettlement = (loc) => SETTLEMENT_TYPES.has(loc?.mapTableData?.locationType) && !!loc?.exterior?.exteriorData;

/**
 * Does the world-frame point `p` (`[x, y, z]`, natives on x and z - the wire's frame, scenes/world.js campToWire and a
 * peer's shown pose) stand in a settlement's streets: the location `index` keeps for the point's map pixel (`"x,y"`), a
 * settlement, and the point within its rect widened a block.
 * @param {ArrayLike<number> | null | undefined} p
 * @param {{ get(key: string): any } | null | undefined} index
 * @returns {boolean}
 */
export function settledAt(p, index) {
  if (!p || !index || !Number.isFinite(p[0]) || !Number.isFinite(p[2])) return false;
  const px = worldCoordToMapPixel(p[0], p[2]);
  const loc = index.get(`${px.x},${px.y}`);
  return isSettlement(loc) && isInLocationRect(p[0], p[2], locationWorldRect(loc, px.x, px.y));
}

/**
 * WILD-CITY-PORT (2026-10-28, the owner: "Even with the open pvp, players should be able to teleport in and out of the
 * cities"): MAY A TELEPORT PASS THE ZONE. Each end is none (the door, asked where I stand), outside `mask`, or a
 * settlement's. The end it lands at: the place `locAt` stands on its pixel. Where I stand: outdoors in a settlement's
 * streets (`feet`, settledAt's frame over `index`), else in a building of one (`mode` 'interior'). A dungeon is the zone's.
 * @param {any} mask @param {{ x: number, y: number }|null} from @param {{ x: number, y: number }|null} to @param {ArrayLike<number>|null} feet
 * @param {string|undefined} mode @param {{ get(key: string): any }} index @param {(px: number, py: number) => any} locAt @returns {boolean}
 */
export function zonePortFree(mask, from, to, feet, mode, index, locAt) {
  const inZone = (at) => !!at && wildInside(mask, at.x, at.y);
  const here = !inZone(from) || (feet ? settledAt(feet, index) : mode === 'interior' && isSettlement(locAt(from.x, from.y)));
  return here && (!inZone(to) || isSettlement(locAt(to.x, to.y)));
}

/** ZONE-HOMES (2026-10-28, the owner: "Imperial City houses still cannot be purchased"): MAY A HOUSE BE BOUGHT HERE.
 *  Outside the zone, yes; in it, only at a door in a settlement's streets (`feet`, settledAt's frame over `index`; null
 *  indoors or underground). PVPDUNGEONS' "no houses" stays the open country's: ZONE-SAFE made the settlements peace.
 *  @param {boolean} inZone @param {ArrayLike<number>|null} feet @param {{ get(key: string): any }} index @returns {boolean} */
export const zoneHouseFree = (inZone, feet, index) => !inZone || (!!feet && settledAt(feet, index));

// ── the frame's word: am I in the streets of one now ──
let _safe = false;
/**
 * The world host's frame (scenes/world.js wildFrame): `here` - I stand in the open zone; `settled` - outdoors in a
 * settlement's streets. Its crossing is said through `say`: into the streets, their peace; out of them still in the zone,
 * its end. Leaving the zone from the streets says nothing of its own (the zone's own leave line is said), and `keep` (in
 * a building - no player fights under a roof) keeps the word I had, so a door in and out of the same street is no
 * crossing. Answers whether I stand in the streets now.
 * @param {boolean} here @param {boolean} settled @param {(line: string) => void} say @param {boolean} [keep]
 * @returns {boolean}
 */
export function zoneSafeFrame(here, settled, say, keep = false) {
  if (keep) return _safe;
  const now = !!here && !!settled;
  if (now === _safe) return now;
  _safe = now;
  if (now) say(ZONE_SAFE_TEXT.enter);
  else if (here) say(ZONE_SAFE_TEXT.leave);
  return now;
}
/** Do I stand in a settlement's streets in the zone (the frame's last word) - the HUD's zone tile and its tip. */
export const zoneSafe = () => _safe;

// ── the words (L10N4: through the text core, read when they are said) ──
export const ZONE_SAFE_TEXT = Object.freeze({
  get chip() { return t('wild.safe.chip', 'Safe zone'); },
  get enter() { return t('wild.safe.enter', 'You are in the streets of a city, town or village: a safe zone. Other players cannot attack you here, and you cannot attack them.'); },
  get leave() { return t('wild.safe.leave', 'You leave the safe streets. Other players may attack you again.'); },
  get rule() { return t('wild.safe.rule', 'Cities, towns and villages are safe zones: no player can attack another in their streets.'); },
  get noHouse() { return t('wild.safe.noHouse', 'In {zone}, houses are for sale only in cities, towns and villages.', { zone: WILD_NAME }); },
});
