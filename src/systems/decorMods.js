// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR-MODS (FIELD BUGS 2026-10-05b) — THE TOWN MODS' FURNISHINGS, IN
// THE CATALOGUE WHILE THEY STAND.
//
// The owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the town mods' furnishings first. Beautiful
// Villages and Beautiful Cities redecorate some 1,400 interiors - coloured
// beds, paintings, tapestries and banners, rugs, set tables and stocked
// shelves, a captain's chest - and Detailed Ships furnishes its two ships;
// none of it could be set in a house. WD3 kept the catalogue to Daggerfall's
// own blocks (systems/decorScan.js reads BLOCKS.BSA past the door), so the
// mods' pieces would never renumber it nor leave it when a mod went off -
// and with it, the flats DECOR-MODFLATS had let a player place out of
// Detailed Ships' ships went too.
//
// THE PIECES are the port's own stand-ins for what the mods place (world/
// townStandIns.js, world/detStandIns.js, systems/detailedShips.js), MEASURED
// over the mods' own blocks - both town packs and the two ships, rebuilt
// from the player's BLOCKS.BSA (test/decormods.test.js measures them again
// where ARENA2 is at hand): each with how many times the mods stand it, a
// room's where any of it stands inside (offered in every room, and a yard),
// a street's where all of it stands outside (a yard's alone). Never the
// town's own structure - its hills, a temple's platform and foundation, the
// roofs' domes, the docks, the city wall's fill, a chimney; nor the crop
// fields (a field the town sows, no piece); nor the dolphins (drawn to break
// the sea's surface, half their picture under it). A piece two of the mods'
// ids stand in for alike is offered once (DECOR_MOD_TWINS), and DET's old
// archive numbers are its new ones' (DET_OLD_ARCHIVES).
//
// WHILE THEY STAND: a piece is offered while the port stands it - its
// stand-in's own switch, the one the mods' towns are drawn by (a town mod
// loaded for the game, or a save's town pinned to one; Detailed Ships' own
// switch for its ships' pieces; online, the town mods are on for every
// player). A piece placed stands while its mod does, as the mod's towns do.
// AUDIT 05b A3: every piece is in the catalogue whatever is on - so none's
// name or number moves with a switch - and the switch is asked as the
// piece is offered (decorModsLive, systems/decorCatalogue.js
// decorRoomEntries), never once when the catalogue was read: the switches
// turn mid-game (Detailed Ships turned off, a town pack landing).
//
// NAMED as the port names them: a bed by its colour, a hanging by its
// picture (world/townPictures.js - the one table its builder reads,
// world/detStandIns.js DET_PICTURES, world/townStandIns.js ROSYS_PICTURES),
// a drawn sprite by its drawing (world/standInSprites.js), a flat that
// stands in as one of Daggerfall's own by that one's kind - else by the
// piece; numbered after every place read before them (systems/
// decorCatalogue.js DECOR_FROM), so no name of Daggerfall's ever moves.
// Read off tables alone, never a switch or a built model.
// ═══════════════════════════════════════════════════════════════════

import {
  townBedOf, TOWN_BED_COLOURS, TOWN_PAINTINGS, RMBRP_ROCKS, RMBRP_STALLS, RMBRP_HILLS, TOWN_CROP_FIELDS,
  CITY_WALL_PIECE, TOWN_CLUTTER, TOWN_CLUTTER_ARCHIVE, TOWN_GARDEN, TOWN_GARDEN_ARCHIVE, ROSYS_PICTURES,
} from '../world/townStandIns.js';
import { DET_FLAT_STAND_INS, DET_FLAT_DRAWINGS, DET_TOWN_FLATS, DET_OLD_ARCHIVES, DET_DOLPHIN_RECORDS, DET_PICTURES } from '../world/detStandIns.js';
import { TOWN_PICTURES } from '../world/townPictures.js';
import { DETAILED_SHIPS_DERIVED } from './detailedShips.js';
import { customAliasFor, hasCustomModel } from '../world/customModels.js';
import { hasTextureReplacement } from './textureReplacement.js';
import { decorKey, isDecorModEntry } from './decorCatalogue.js';   // AUDIT 05b A11: the one key a piece and its entry share

/** THE MODS' PIECES THAT STAND INSIDE - offered in every room (and a yard): model id or `archive_record` -> how many
 *  times the mods stand it (measured, 2026-10-05: Beautiful Villages 1.4.2, Beautiful Cities 0.5.0, Detailed Ships
 *  1.0.0, over the player's own BLOCKS.BSA). */
export const DECOR_MOD_ROOMS = Object.freeze({
  models: Object.freeze({
    // the beds, six colours of Daggerfall's three
    42069: 347, 42070: 162, 42071: 302, 42072: 185, 42073: 162, 42074: 113, 42075: 217, 42076: 238, 42077: 301,
    42078: 273, 42079: 136, 42080: 173, 42081: 249, 42082: 259, 42083: 295, 42084: 216, 42085: 186, 42086: 215,
    // DET's: the regions' tapestries and banners; the pillars, the ensign staff, a stump, a flower pot, the wind vane;
    // the decorative tapestries and the Eight's; a column's drum, the sea chest, the weapon rack, two rugs
    45008: 8, 45023: 8, 45024: 10, 45029: 4, 45034: 6, 45044: 16, 45059: 20, 45060: 14, 45065: 7, 45070: 8,
    45081: 10015, 45082: 452, 45110: 29252, 45111: 284, 45112: 93, 45114: 60, 45120: 36, 45121: 9, 45129: 4892,
    45134: 14, 45135: 89, 45136: 110, 45137: 137, 45138: 55, 45139: 44, 45140: 21, 45141: 12, 45142: 19, 45143: 20,
    45144: 25, 45145: 25, 45146: 12, 45147: 20, 45148: 16, 45150: 20, 45151: 30, 45152: 16, 45153: 24, 45154: 56,
    45155: 16, 45156: 32, 45157: 40, 45158: 62, 45159: 122, 45160: 35, 45161: 60, 45162: 76, 45163: 138, 45164: 38,
    45169: 42, 45190: 548, 45191: 363, 45192: 14, 45194: 8,
    // the paintings (Rosy's Resources, New Paintings) and Rosy's small hangings and rugs
    69420: 37, 69421: 50, 69422: 71, 69423: 85, 69424: 123, 69425: 25, 69426: 98, 69427: 77, 69428: 65, 69429: 186,
    69430: 82, 69431: 83, 69432: 208, 69433: 49, 69434: 49, 69435: 115, 69436: 78, 69437: 111, 69440: 84, 69441: 186,
    69444: 81, 69445: 153, 69446: 33, 69447: 81, 69448: 35, 69449: 40, 69450: 22, 69451: 106, 69452: 32, 69453: 48,
    69454: 47, 69455: 29, 69456: 97, 69457: 37, 69458: 43, 69459: 24, 69460: 36, 69461: 72, 69462: 47, 69463: 109,
    69464: 120, 69467: 29, 69468: 139, 69469: 98, 69471: 160, 69472: 160,
    79010: 67, 79011: 57, 79012: 55, 79013: 69, 79014: 24, 79015: 93, 79016: 32, 79017: 89, 79018: 105, 79019: 27,
    79020: 55, 79021: 15, 79022: 9, 79023: 25, 79024: 21, 79025: 34, 79026: 107, 79027: 49, 79028: 19, 79029: 71,
    79030: 60,
  }),
  flats: Object.freeze({
    // Cliffworms' Items (Detailed Ships' pictures, the towns' shelves too) and his statuette
    '1210_1': 2, '1210_3': 1, '1210_4': 1, '1210_8': 1, '1210_10': 166, '1210_11': 170, '1210_12': 113, '1210_17': 145,
    '1210_18': 22, '1210_19': 40, '1210_20': 45, '1230_30': 2,
    // DET's: the ship's monkey; rats and dogs; the galley's food; the easel, firewood, a sack, bottles, a planter; the
    // stores' odds and ends; a statue
    '10009_14': 12, '10010_36': 16, '10010_38': 8, '10010_40': 32, '10010_73': 103, '10010_74': 6, '10010_75': 11,
    '10010_77': 64, '10010_78': 65, '10021_0': 120, '10021_1': 130, '10021_2': 159, '10021_3': 126, '10021_4': 237,
    '10021_5': 17, '10021_6': 196, '10021_7': 471, '10021_8': 351, '10021_9': 46, '10021_10': 193, '10021_11': 24,
    '10021_12': 273, '10021_13': 251, '10021_14': 175, '10021_15': 152, '10021_16': 21, '10021_17': 300, '10021_22': 1,
    '10021_27': 1, '10022_4': 24, '10023_0': 11, '10024_2': 19, '10025_0': 37, '10025_2': 25, '10025_3': 146,
    '10027_0': 204, '10027_1': 47, '10027_3': 5, '10027_4': 1, '10027_5': 1, '10027_6': 8, '10027_7': 2, '10027_8': 4,
    '10027_9': 2, '10027_10': 4, '10027_11': 1, '10027_12': 1, '10027_13': 1, '10027_14': 1, '10028_4': 12,
    // the towns' set tables and stocked shelves
    '56790_1': 13, '56790_2': 328, '56790_3': 151, '56790_4': 136, '56790_5': 24, '56790_7': 213, '56790_8': 289,
    '56790_9': 73, '56790_10': 122, '56790_11': 152, '56790_12': 186, '56790_13': 75, '56790_14': 45, '56790_16': 251,
    '56790_18': 133, '56790_19': 353, '56790_20': 259, '56790_21': 353, '56790_22': 533, '56790_23': 299,
    '56790_24': 237, '56790_25': 602,
  }),
});
/** THE MODS' PIECES THAT STAND OUTSIDE ALONE - a yard's: the rocks, the market stalls, a temple column's head; the
 *  towns' fowl, sheep, cattle, horses and doves; the grain; a temple's garden rows. */
export const DECOR_MOD_STREETS = Object.freeze({
  models: Object.freeze({
    45170: 14,
    53006: 2, 53012: 4, 53014: 3, 53017: 1, 53020: 1, 53023: 10, 53029: 18, 53030: 20, 53031: 18, 53032: 7, 53033: 14,
    53035: 6, 53036: 7, 53037: 30, 53038: 58, 53039: 20, 53040: 13, 53042: 1, 53054: 3, 53064: 3, 53083: 4, 53085: 1,
    53086: 1,
    53100: 2, 53101: 1, 53102: 2, 53103: 3, 53104: 2, 53106: 1, 53107: 2, 53108: 3, 53109: 1, 53113: 2, 53115: 1,
    53117: 1, 53118: 2, 53121: 3, 53122: 1, 53123: 3, 53124: 2,
  }),
  flats: Object.freeze({
    '10010_3': 16, '10010_4': 22, '10010_5': 12, '10010_6': 9, '10010_15': 59, '10010_16': 51, '10010_17': 54,
    '10010_18': 27, '10010_19': 15, '10010_20': 7, '10010_22': 9, '10010_23': 16, '10010_24': 16, '10010_25': 6,
    '10010_42': 363, '10010_43': 487, '10010_44': 1607, '10010_46': 321, '10010_47': 430, '10010_48': 654,
    '10010_49': 53, '10010_50': 596, '10010_51': 6, '10010_52': 5, '10024_0': 6, '10024_1': 5,
    '10035_1': 20, '10035_2': 16, '10035_3': 31, '10035_4': 29, '10035_5': 14, '10035_6': 13, '10035_7': 28,
  }),
});
/** Two ids the mods place that the port stands in alike - the one offered for both (its count both's). */
export const DECOR_MOD_TWINS = Object.freeze({ 45113: 45112, 45087: 45121, 45115: 45114, 45122: 45120 });
/** What the mods stand that is never a piece - the town itself, a field it sows, the sea's - by why. */
export const DECOR_MOD_LEFT_OUT = Object.freeze({
  hills: Object.freeze(Object.keys(RMBRP_HILLS).map(Number)),   // the ground the pack raises under its buildings
  structure: Object.freeze([53160, 53170, 53182, 53187, 53194, 53140, 53141, 53142, 53143, 53144, CITY_WALL_PIECE, 45074, 45076, 45077]),   // a temple's platform and foundation, the roofs' domes, the docks and their ramp and steps, the city wall's fill, a chimney's base, flue and topper
  fields: Object.freeze(Object.keys(TOWN_CROP_FIELDS).map(Number)),   // the crop fields - a field of flats sown by id, no model
  sea: Object.freeze(DET_DOLPHIN_RECORDS.map((r) => `10009_${r}`)),   // the dolphins, drawn half under the sea's surface
});

const words = (name) => name.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** The mods' models the port names by the piece - the ones that wear no picture of their own. */
const MODEL_NAMES = Object.freeze({
  45081: 'Wooden pillar', 45110: 'Wooden pillar', 45111: 'Wooden pillar', 45112: 'Wooden pillar', 45129: 'Stone pillar',
  45082: 'Ensign staff', 45114: 'Stump', 45120: 'Flower pot', 45121: 'Wind vane', 45169: 'Column drum', 45170: 'Column head',
  45190: 'Sea chest', 45191: 'Weapon rack',
});
/** Detailed Ships' own drawings (no classic record is them): the bottles and the statuette. */
const OWN_ART_NAMES = Object.freeze({ '1210_10': 'Green bottle', '1210_11': 'Blue bottle', '1210_12': 'Brown bottle', '1230_30': 'Statuette' });

/** The classic flat a mod's flat stands in as - [archive, record] - or null (a drawing of the port's, or the author's). */
export function decorModFlatSource(archive, record) {
  const a = DET_OLD_ARCHIVES[archive] ?? archive;
  const det = DET_FLAT_STAND_INS[a]?.[record] ?? DET_TOWN_FLATS[a]?.[record] ?? null;
  if (det) return [det[0], det[1]];
  if (a === TOWN_CLUTTER_ARCHIVE) return TOWN_CLUTTER[record] ? [...TOWN_CLUTTER[record]] : null;
  if (a === TOWN_GARDEN_ARCHIVE) return TOWN_GARDEN[record] ? [...TOWN_GARDEN[record]] : null;
  const derived = DETAILED_SHIPS_DERIVED[`${a}_${record}-0`];
  return derived?.from ? [derived.from[0], derived.from[1]] : null;
}

/**
 * A MOD PIECE'S NAME AND WHAT IT IS FILED AS - `{ base, as }`: `base` its own name or null (the catalogue's kind word,
 * numbered), `as` the archive (a flat) or model id (a model) the catalogue files it by - the classic one it stands in
 * as, or its own. `what` - `{ model }` or `{ flat: [archive, record] }`.
 */
export function decorModNaming(what) {
  if (what.model != null) {
    const id = what.model;
    const bed = townBedOf(id);
    if (bed) return { base: `${capital(TOWN_BED_COLOURS[bed.colour].name)} bed`, as: bed.model };   // AUDIT 05b A3: its classic bed by the table, never by a switch
    if (TOWN_PAINTINGS[id]) return { base: 'Painting', as: id };
    if (RMBRP_ROCKS[id]) return { base: 'Boulder', as: id };
    if (RMBRP_STALLS[id]) return { base: 'Market stall', as: id };
    if (MODEL_NAMES[id]) return { base: MODEL_NAMES[id], as: id };
    // a hanging or a rug: its own picture's name (world/townPictures.js) - the table its builder wears it by (AUDIT 05b
    // A8: read off the built model, a whole model was built to name a piece, and none named while its switch was off)
    const pic = DET_PICTURES[id] ?? ROSYS_PICTURES[id];
    return { base: pic != null ? capital(TOWN_PICTURES[pic]?.name ?? '') || null : null, as: id };
  }
  const [archive, record] = what.flat;
  const k = `${archive}_${record}`;
  if (OWN_ART_NAMES[k]) return { base: OWN_ART_NAMES[k], as: archive === 1210 ? 205 : archive };   // the bottles are bottles
  const drawn = DET_FLAT_DRAWINGS[DET_OLD_ARCHIVES[archive] ?? archive]?.[record];
  if (drawn) return { base: words(drawn[0]), as: archive };
  const from = decorModFlatSource(archive, record);
  return { base: null, as: from ? from[0] : archive };
}

/** Whether the port stands a mod's piece now - its stand-in's own switch (a model's on the model door, a flat's on the
 *  texture door). */
export function decorModLive(what) {
  if (what.model != null) return !!(customAliasFor(what.model) || hasCustomModel(what.model));
  return hasTextureReplacement(what.flat[0], what.flat[1]);
}

/** AUDIT 05b A3: how often the house decorator asks the switches again while its panel is up (and once as it opens). */
export const DECOR_MODS_LIVE_S = 1;
/**
 * AUDIT 05b A3: THE MODS' PIECES THE PORT STANDS NOW, of a catalogue's `entries` - their keys, the offer's own
 * (systems/decorCatalogue.js decorRoomEntries offers a mod's piece among them alone). `live` decorModLive unless told.
 * @param {readonly any[]|null} entries @param {(what: any) => boolean} [live]
 */
export function decorModsLive(entries, live = decorModLive) {
  const out = new Set();
  for (const e of entries ?? []) if (isDecorModEntry(e) && live(e)) out.add(e.key);
  return out;
}

/**
 * THE MODS' PIECES, INTO A COLLECTION (systems/decorCatalogue.js collectDecor's Map): every one, whatever is on (AUDIT
 * 05b A3: what is offered is asked as it is offered - decorModsLive), a room's (`from: 'mod'`) or a street's
 * (`'modstreet'`), with its count, its name and what it is filed as (`base`, `as`). A key a place read before already
 * holds stays that place's.
 * @param {Map<string, any>} [into]
 */
export function addDecorMods(into = new Map()) {
  const put = (what, count, from) => {
    const key = decorKey(what);
    if (into.has(key)) return;
    into.set(key, { ...what, count, from, ...decorModNaming(what) });
  };
  for (const { table, from } of [{ table: DECOR_MOD_ROOMS, from: 'mod' }, { table: DECOR_MOD_STREETS, from: 'modstreet' }]) {
    for (const [id, count] of Object.entries(table.models)) put({ model: Number(id), flat: null }, count, from);
    for (const [k, count] of Object.entries(table.flats)) put({ model: null, flat: k.split('_').map(Number) }, count, from);
  }
  return into;
}
