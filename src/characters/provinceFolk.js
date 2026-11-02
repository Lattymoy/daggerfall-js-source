// @ts-check
// PROVINCE-FOLK (2026-10-28, bible/03-World/World-Wide.md PROVINCE-FOLK; the owner: "The world of tamriel needs to have
// their accurate races present within their respective regions"): WHO LIVES IN A PROVINCE PAST THE BAY. Each
// province's people by the lore - its own race most of all, then the neighbours, traders and garrisons it is known to
// hold. A walker, a resident, a keeper and a foe past the Bay is one of them; the Bay keeps DFU's own law (no folk here).
// Not a DFU member: DFU's people stop at the Bay, and its townsfolk are one race a climate.
import { theatreOfArea, THEATRE_KEYS } from '../world/worldWide/worldGrid.js';
import { tamrielBiomeAt } from '../world/tamriel/tamrielBiomes.js'; // AUDIT PROVINCE-FOLK B6: a zone's own people
import { theatreOfRegion } from '../formats/mapsTables.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { getNameBank, BANK_TYPES } from './nameHelper.js';

/** @typedef {ReadonlyArray<readonly [string, number]>} Folk - [race, weight], the province's own race first */
/** @param {Array<[string, number]>} rows @returns {Folk} */
const folk = (rows) => Object.freeze(rows.map((r) => Object.freeze(r)));

/** Each province's people by its key (world/worldWide/worldGrid.js THEATRE_KEYS), the weights out of 100. No Orcs: DFU's
 *  banks give no Orc a full name (Monster1 names a lair or a monster in one word), and Wrothgar's Orcs stand as its foes. */
export const PROVINCE_FOLK = Object.freeze({
  HighRock: folk([
    ['Breton', 82],
    ['Redguard', 5],
    ['Nord', 4],
    ['Imperial', 4],
    ['HighElf', 3],
    ['WoodElf', 2],
  ]), // the Direnni's Altmer kin, the Skyrim border's Nords
  Hammerfell: folk([
    ['Redguard', 82],
    ['Breton', 6],
    ['Imperial', 5],
    ['Khajiit', 3],
    ['Nord', 2],
    ['DarkElf', 2],
  ]), // the Alik'r caravans' Khajiit, Colovia's Imperials
  Skyrim: folk([
    ['Nord', 84],
    ['Imperial', 5],
    ['Breton', 4],
    ['DarkElf', 4],
    ['Khajiit', 2],
    ['Redguard', 1],
  ]), // the Reach's Bretons, the east's Dark Elves, the caravans
  Morrowind: folk([
    ['DarkElf', 82],
    ['Imperial', 6],
    ['Argonian', 4],
    ['Nord', 3],
    ['Breton', 3],
    ['Khajiit', 2],
  ]), // the Legion and the East Empire Company, the Great Houses' bonded
  Sumurset: folk([
    ['HighElf', 92],
    ['WoodElf', 4],
    ['Imperial', 3],
    ['Breton', 1],
  ]), // the isles keep to their own
  Valenwood: folk([
    ['WoodElf', 82],
    ['HighElf', 6],
    ['Khajiit', 5],
    ['Imperial', 5],
    ['Breton', 2],
  ]), // Elsweyr's border, Sumurset's reach, the Empire's ports
  Elsweyr: folk([
    ['Khajiit', 84],
    ['WoodElf', 6],
    ['Imperial', 5],
    ['Argonian', 3],
    ['Redguard', 2],
  ]), // the Bosmer of the border woods, Senchal's traders
  BlackMarsh: folk([
    ['Argonian', 84],
    ['Imperial', 7],
    ['DarkElf', 5],
    ['Khajiit', 2],
    ['Breton', 2],
  ]), // Gideon's and Stormhold's Imperials, Morrowind's border
  Imperial: folk([
    ['Imperial', 64],
    ['Breton', 6],
    ['Nord', 6],
    ['Redguard', 6],
    ['DarkElf', 4],
    ['WoodElf', 4],
    ['Khajiit', 4],
    ['HighElf', 3],
    ['Argonian', 3],
  ]), // the Empire's heart, every people in it
});

/** AUDIT PROVINCE-FOLK B6: the zones (world/tamriel/tamrielBiomes.js) whose own people differ from their province's,
 *  out of 100 - the game's zone text or the lore names them. */
export const ZONE_FOLK = Object.freeze({
  skyrimReach: folk([
    ['Breton', 60],
    ['Nord', 28],
    ['Imperial', 4],
    ['Redguard', 3],
    ['DarkElf', 3],
    ['Khajiit', 2],
  ]), // the Reachmen, of Breton blood (UESP Lore:Reachmen)
  valenwoodReapersMarch: folk([
    ['WoodElf', 55],
    ['Khajiit', 35],
    ['Imperial', 5],
    ['HighElf', 3],
    ['Breton', 2],
  ]), // Arenthia's march on Elsweyr (Lore:Reaper's March)
  blackMarshGloomire: folk([
    ['Argonian', 60],
    ['Imperial', 30],
    ['DarkElf', 4],
    ['Khajiit', 3],
    ['Breton', 3],
  ]), // Gideon, the Empire's town in Black Marsh (Lore:Gideon)
  cyrodiilBlackwood: folk([
    ['Imperial', 60],
    ['Argonian', 16],
    ['Khajiit', 12],
    ['Breton', 4],
    ['Redguard', 3],
    ['WoodElf', 3],
    ['DarkElf', 2],
  ]), // Leyawiin on the marsh's border (Lore:Leyawiin)
});

/** The people of theatre `t` (1..9 - the provinces past the Bay), or null: the Bay's theatre, the sea, none. @param {number} t */
export const folkOfTheatre = (t) =>
  Number.isInteger(t) && t > 0 ? (PROVINCE_FOLK[/** @type {'Skyrim'} */ (THEATRE_KEYS[t])] ?? null) : null;
/** The people of a region (formats/mapsTables.js - a province's 62..70), or null on the Bay. @param {number} r */
export const folkOfRegion = (r) => folkOfTheatre(theatreOfRegion(r));
/** The people of an area (worldGrid.js - a province's district past the Bay), or null on the Bay. @param {number} a */
export const folkOfArea = (a) => folkOfTheatre(theatreOfArea(a));
/** A province's `people` at map pixel (px, py): its zone's where ZONE_FOLK names one; none on the Bay.
 *  @param {Folk|null} people @param {number|undefined} px @param {number|undefined} py */
export const withZone = (people, px, py) =>
  people && Number.isFinite(px) && Number.isFinite(py)
    ? (ZONE_FOLK[
        /** @type {'skyrimReach'} */ (
          tamrielBiomeAt(Math.floor(/** @type {number} */ (px)), Math.floor(/** @type {number} */ (py)))?.key
        )
      ] ?? people)
    : people;
/** The people at a map pixel of a region. @param {number|undefined} px @param {number|undefined} py @param {number} region */
export const folkAt = (px, py, region) => withZone(folkOfRegion(region), px, py);
/** A location's people (a MAPS row, or a place past the Bay): its region's, its zone's off its pixel. @param {any} loc */
export function folkOfLocation(loc) {
  const t = loc?.mapTableData,
    p = t ? longitudeLatitudeToMapPixel(t.longitude, t.latitude) : null;
  return folkAt(p?.x, p?.y, loc?.regionIndex ?? -1);
}
/** A people's key - ZONE_FOLK's or PROVINCE_FOLK's - so a record can name whose it is; null for none. @param {Folk|null} people */
export const folkKeyOf = (people) =>
  people
    ? (Object.keys(ZONE_FOLK).find((k) => ZONE_FOLK[/** @type {'skyrimReach'} */ (k)] === people) ??
      Object.keys(PROVINCE_FOLK).find((k) => PROVINCE_FOLK[/** @type {'Skyrim'} */ (k)] === people) ??
      null)
    : null;
/** The people a key names, or null (the Bay's, none). @param {any} key */
export const folkOfKey = (key) =>
  typeof key === 'string'
    ? (ZONE_FOLK[/** @type {'skyrimReach'} */ (key)] ?? PROVINCE_FOLK[/** @type {'Skyrim'} */ (key)] ?? null)
    : null;
/** The races a person past the Bay may be: every race of every people here. */
export const FOLK_RACE_KEYS = Object.freeze([
  ...new Set([...Object.values(PROVINCE_FOLK), ...Object.values(ZONE_FOLK)].flatMap((f) => f.map(([r]) => r))),
]);

function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** One of `people` by a whole-number seed, by their weights; null for no people. The seed is mixed here, so two
 *  neighbouring seeds draw two people. @param {Folk|null} people @param {number} seed @returns {string|null} */
export function folkRace(people, seed) {
  if (!people?.length) return null;
  const total = people.reduce((n, [, w]) => n + w, 0);
  let r = mix((seed >>> 0) ^ 0x70f01c) % total;
  for (const [race, w] of people) {
    if (r < w) return race;
    r -= w;
  }
  return people[0][0];
}
/** The name bank of a person of `race`: their own people's - an Imperial's the Imperial bank, an Argonian's the Imperial
 *  too (NameHelper.GetNameBank's own law). @param {string} race */
export const folkNameBank = (race) => (race === 'Imperial' ? BANK_TYPES.Imperial : getNameBank(race));

/** The world host's doors (scenes/world.js): the map pixel scene feet stand on - the player's own for none - and the
 *  region at a pixel. AUDIT PROVINCE-FOLK A5: a foe is drawn where it stands, so every machine that sees it agrees. */
let _pixelOf = /** @type {((feet: number[]|null) => ({ x: number, y: number } | null)) | null} */ (null);
let _regionAt = /** @type {((x: number, y: number) => number) | null} */ (null);
/** @param {typeof _pixelOf} pixelOf @param {typeof _regionAt} regionAt */
export function setFolkPlace(pixelOf, regionAt) {
  _pixelOf = typeof pixelOf === 'function' ? pixelOf : null;
  _regionAt = typeof regionAt === 'function' ? regionAt : null;
}
/** The people where scene feet stand, or where the player does for none; null on the Bay and with no host.
 *  @param {number[]|null} [feet] */
export function folkWhere(feet = null) {
  const p = _pixelOf && _regionAt ? _pixelOf(feet) : null;
  return p ? folkAt(p.x, p.y, _regionAt?.(p.x, p.y) ?? -1) : null;
}
/** SKYRIM-AURORA: the map pixel the player stands on, through the same door - null with no host (the fixed-city bench
 *  sets none). The sky's aurora reads it (scenes/auroraHost.js), so no host hands the sky a pixel of its own. */
export const pixelHere = () => (_pixelOf ? _pixelOf(null) : null);
/** The people where the player stands. A standing person and a roster of the place read it. */
export const folkHere = () => folkWhere(null);
/** The place's own people's race where the player stands (Cyrodiil's Imperial, the Reach's Breton), or null on the Bay. */
export const nativeHere = () => folkHere()?.[0][0] ?? null;
/** AUDIT TAMRIEL-WIDE E2: the own people's race where scene `feet` stand (the player's for none) - a person drawn by a
 *  border is of their own side, on every machine. @param {number[]|null} [feet] */
export const nativeAt = (feet = null) => folkWhere(feet)?.[0][0] ?? null;
