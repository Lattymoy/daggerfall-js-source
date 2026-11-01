// @ts-check
// IC-INTERIORS (2026-10-27, the owner's field report, item 5: "Interiors in the Imperial city need to match their exterior
// with varied layouts"; bible/03-World/Arena-Provinces.md IC-INTERIORS) - DAGGERFALL'S OWN INTERIOR KIT, AS A TABLE.
//
// Daggerfall builds a building's rooms out of a kit of ARCH3D models on a grid of 128-unit cells (3.2 m, the fabric's
// own storey - world/imperialFabric.js STOREY): a floor tile a cell (1000), a ceiling tile (2000), a wall a cell side
// (3004 plain, 3018 the same wall with its window, 3002 the wall with the street door's picture, 3000 the wall with a
// doorway through it), and a post 12 units wide (4000) where two walls meet - each face 6 units in from its cell's edge,
// so two rooms' walls stand 12 apart and a post closes the gap. The hundreds digit is the building set the pieces wear
// (1000 the city's, 1300 a manor's, 1500 a tavern's ...). Its rooms are furnished with the 41xxx props (beds, tables,
// chairs, shelves, wardrobes, crates) and its upper storeys reached by its ladder (41409, the LadderBottom and LadderTop
// markers - DaggerfallLadder). Measured off the freeware's 920 RMB blocks and ARCH3D (the IC-INTERIORS record): every
// number below is a measure of a model or a count of Daggerfall's own use, pinned against the player's own ARCH3D where
// it is at hand (test/world/icinteriors.test.js). Nothing of a model is in the repository but its id and its measures.
//
// Pure data: world/interior/fabricInterior.js lays a building's rooms from it.

/** A kit cell's side and a storey's pitch (classic units, forty a metre): Daggerfall's multi-storey interiors stand each
 *  storey 129 over the last (GENRAL00.RMB, TVRNBM04.RMB: walls at -63, -192, -321). A wall's face stands KIT_INSET in
 *  from its cell's edge. */
export const KIT_CELL = 128;
export const KIT_STOREY = 129;
export const KIT_INSET = 6;

/** The building sets the kit is made in, by the model id's hundreds digit (`piece + 100 * set`): each piece's texture
 *  archive (the set's, TEXTURE.1xx - DFLocation.ClimateTextureSet's Interior_CityInt 16, Interior_FarmInt 28,
 *  Interior_MagesGuildInt 37, Interior_ManorInt 40, Interior_MerchantHomesInt 44, Interior_TavernInt 60,
 *  Interior_TempleInt 63, Interior_VillageInt 66, and 71). Every piece below is in all nine. */
export const KIT_SET_ARCHIVES = Object.freeze([116, 128, 137, 140, 144, 160, 163, 166, 171]);

/** The pieces, at set 0. Measured (classic units): the floor a 128 square at its origin, the ceiling the same facing
 *  down; a wall's face at its local x = 0 facing -x, 116 along z (+-58) and 126 up (+-63); the street door's picture
 *  (TEXTURE.74 - world/meshReader.js BUILDING_DOORS) and its door face (the game's door - world/staticDoors.js) on its
 *  wall at local z -50..0, 89 up from its foot; the doorway's face at local x = -3, its jambs to +3 (half a 12-unit
 *  wall), its opening z -25..25 and 89 up; the post a 12-wide face at local z = +1 facing -z. THE STAIR (31023,
 *  Daggerfall's straight stair of two storeys - 684 of its interiors stand one to five, TVRNBM04.RMB's two at YPos -128):
 *  one cell, 255 up about its origin (its foot on the storey under it, its last step 129 over that - the next storey's
 *  floor), its foot at local +z and its head at -z, its two long walls inside its cell (local x = +-58) the whole cell long
 *  on both storeys, its foot's end walled on the upper storey (local z = +64), its own ceiling over the upper storey. */
export const KIT_PIECE = Object.freeze({
  floor: 1000,
  ceiling: 2000,
  doorway: 3000,
  exit: 3002,
  wall: 3004,
  window: 3018,
  post: 4000,
  stair: 31023,
});
/** A piece's model id in a set. */
export const kitModel = (piece, set) => piece + 100 * set;
/** THE PIECES MADE ELSEWHERE: a set's piece whose geometry is set 0's moved (classic units: x, up, z - measured, every one
 *  a pure move of every face) - its origin at its cell's middle on the floor where set 0's is on its face (the window
 *  walls of sets 2, 3, 5 and 8, all of set 8's walls), its ceiling's plane 128 up from its origin (sets 4, 6, 8), a post's
 *  origin at its cell's corner (sets 5 and 8). A piece is placed so its set-0 origin stands where the plan says. */
export const KIT_SHIFT = Object.freeze(
  /** @type {Record<number, readonly [number, number, number]>} */ ({
    2400: [0, 128, -1],
    2600: [0, 128, -1],
    2800: [0, 128, -1],
    3218: [58, 64, 0],
    3318: [58, 64, 0],
    3518: [58, 64, 0],
    3800: [61, 64, 0],
    3802: [58, 64, 0],
    3804: [58, 64, 0],
    3818: [58, 64, 0],
    4500: [-64, 64, 57],
    4800: [-64, 64, 57],
    31623: [0, 128, 0],
  }),
);
/** The measures the plan lays the pieces by (classic units): a wall's half length and half height, the doorway face's
 *  offset back from its wall's face, the street door's middle along its wall (local z), the post's face offset; the floor
 *  tile's and the ceiling tile's extents about their origins ([x0, x1, z0, z1] - the ceiling's a unit along +z). */
export const KIT_MEASURE = Object.freeze({
  wallHalf: 58,
  wallHalfH: 63,
  doorwayBack: 3,
  exitDoorMid: -25,
  postFace: 1,
  floorBox: Object.freeze([-64, 64, -64, 64]),
  ceilingBox: Object.freeze([-64, 64, -63, 65]),
});

/** DaggerfallInterior.AddActionDoors' door (DOOR_MODEL_BASE_ID 9000 + the record's index): its leaf 48 wide from its hinge
 *  (local x -1..47), 6 thick (local z -7..-1), 88 high about its origin. Daggerfall hangs it in a 3000 doorway with its
 *  hinge 23 along the wall from the doorway's middle and its leaf in the far half of the wall, 45 up (RESIAL00.RMB #0: the
 *  doorway at (61, -64, 0), its door at (71, -45, 23) turned 1536). */
export const KIT_DOOR = Object.freeze({
  along: 23,
  out: 71,
  y: -45,
  yRotation: 1536,
  openRotation: 90,
  index: 0,
  unknown: 10,
});

/** THE LADDER (DaggerfallInterior's ladderModelId 41409, DaggerfallLadder) and its markers' records (InteriorMarkerTypes
 *  LadderBottom 21, LadderTop 22): one storey tall (126), against a wall by its +z side (local z -3.1..4.9). */
export const KIT_LADDER = 41409;

/**
 * THE FURNITURE: each prop by its id - its extent at rest [x0, x1, z0, z1] and its height (classic units), and the side it
 * stands against a wall by: '-z' / '+z' where that face is not modelled (a wardrobe's, a shelf's, a fireplace's back -
 * measured: the model carries no face toward it), '-x' a bed's head, null a piece that stands free (both faces drawn).
 * A chair's back is at -z: it is sat facing +z.
 */
export const FURNITURE = Object.freeze(
  /** @type {Record<number, readonly [number, number, number, number, number, string | null]>} */ ({
    // beds (RR1's three - systems/roleplayRealism/rrRealism.js BED_MODELS), the canopy bed a wealthy home's
    41000: [-51, 37, -32, 32, 19, '-x'],
    41001: [-48, 35, -20, 21, 25, '-x'],
    41002: [-53, 43, -27, 26, 85, '-x'],
    // wardrobes and cupboards (house containers - systems/containers.js; World Tooltips' "Wardrobe", "Cupboard", "Dresser")
    41003: [-36, 36, -17, 21, 92, '-z'],
    41004: [-68, 68, -17, 21, 92, '-z'],
    41800: [-36, 36, -17, 21, 92, '-z'],
    41801: [-68, 68, -17, 21, 92, '-z'],
    41032: [-18, 18, -8, 10, 72, '-z'],
    41037: [-18, 18, -8, 10, 72, '-z'],
    41051: [-21, 21, -8, 10, 71, '-z'],
    41804: [-18, 18, -8, 10, 72, '-z'],
    41033: [-17, 17, -8, 8, 34, '-z'],
    41034: [-18, 18, -6, 6, 35, '-z'],
    // cabinets, chests, crates and barrels (house containers), standing free
    41007: [-17, 17, -11, 11, 24, null],
    41008: [-17, 17, -11, 11, 24, null],
    41802: [-17, 17, -11, 11, 24, null],
    41803: [-17, 17, -11, 11, 24, null],
    41811: [-13, 13, -13, 13, 21, null],
    41812: [-13, 13, -13, 14, 21, null],
    41813: [-12, 12, -12, 12, 20, null],
    41818: [-12, 12, -12, 12, 23, null],
    41822: [-16, 16, -16, 16, 31, null],
    41826: [-15, 15, -15, 15, 16, null],
    41827: [-19, 19, -19, 19, 24, null],
    41829: [-19, 19, -19, 19, 16, null],
    41831: [-19, 19, -16, 16, 24, null],
    41832: [-26, 26, -26, 26, 52, null],
    // tables, the counter and the long table, chairs and benches
    41108: [-35, 35, -24, 24, 31, null],
    41112: [-46, 46, -19, 19, 26, null],
    41109: [-60, 60, -26, 25, 33, null],
    41121: [-82, 82, -24, 24, 31, null],
    41126: [-40, 40, -14, 13, 38, null],
    41100: [-17, 16, -17, 13, 50, '-z'],
    41102: [-12, 13, -13, 11, 54, '-z'],
    41103: [-14, 15, -14, 11, 46, '-z'],
    41105: [-36, 36, -10, 10, 22, null],
    41106: [-36, 36, -10, 10, 22, null],
    // the hearths (Improved Interior Lighting's fireplaces - systems/improvedInteriorLighting.js IIL_FIREPLACE_MODELS)
    41116: [-32, 32, -10, 10, 50, '-z'],
    41117: [-44, 44, -29, 15, 62, '-z'],
    // shelves (DaggerfallInterior's shopShelvesObjectGroupIndices - systems/shopStock.js SHOP_SHELF_MODEL_INDICES): a shop's
    // stock, a library's or a guild's books, a home's ornaments
    41005: [-26, 26, -4, 9, 74, '+z'],
    41006: [-45, 45, -4, 9, 68, '+z'],
    41012: [-26, 26, -4, 9, 74, '+z'],
    41013: [-45, 45, -4, 9, 68, '+z'],
    41044: [-45, 45, -4, 9, 68, '+z'],
    41018: [-26, 26, -9, 4, 74, '-z'],
    41019: [-45, 45, -9, 4, 74, '-z'],
    41026: [-48, 48, -6, 6, 72, '-z'],
    41028: [-28, 28, -10, 10, 54, '-z'],
    41031: [-48, 48, -6, 6, 72, '-z'],
    41036: [-18, 18, -8, 10, 72, '-z'],
    41040: [-48, 48, -6, 6, 72, '-z'],
    41049: [-24, 24, -5, 5, 72, '-z'],
    41011: [-45, 45, -12, 12, 68, null],
    41014: [-26, 26, -12, 12, 74, null],
    41015: [-45, 45, -12, 12, 76, null],
    41016: [-24, 24, -8, 8, 72, null],
    41017: [-48, 48, -12, 12, 72, null],
    41029: [-48, 48, -12, 12, 72, null],
    41042: [-45, 45, -12, 12, 68, null],
    41046: [-45, 45, -12, 12, 68, null],
    41047: [-24, 24, -8, 8, 72, null],
    41048: [-48, 48, -12, 12, 72, null],
    // a book's pedestal
    41020: [-11, 11, -11, 11, 38, null],
    // the ladder
    41409: [-28, 28, -3, 5, 126, '+z'],
  }),
);
/** A piece taller than this (classic units) is not stood against a window if another wall will take it. */
export const TALL = 60;

/**
 * THE SHELVES A BUILDING KEEPS, by its pool (world/imperialFabricBuildings.js FABRIC_DONORS' pools): the shelf models
 * Daggerfall's own buildings of that type carry most, read off the freeware's 920 RMB blocks (each type's commonest, in
 * order - an alchemist's 41042 in 98 of its records). Every one is in DaggerfallInterior's shop-shelf group: a shop's
 * stock where the building is a shop (RMBLayout.IsShop), a guild's or a library's books, a home's ornaments.
 */
export const POOL_SHELVES = Object.freeze({
  alchemist: [41042, 41040, 41031, 41019, 41046],
  armorer: [41048, 41031, 41028, 41047],
  bank: [41019, 41018],
  bookseller: [41015, 41017, 41026, 41019, 41018],
  clothing: [41011, 41013, 41036],
  furniture: [41019, 41018],
  gems: [41042, 41044, 41011, 41006, 41018],
  general: [41046, 41040, 41006, 41029, 41012],
  library: [41015, 41019, 41018, 41017],
  mages: [41016, 41015, 41019, 41017, 41018],
  fighters: [41049, 41015, 41019, 41017],
  pawn: [41040, 41046, 41029, 41005, 41012],
  weaponsmith: [41048, 41031, 41040, 41049],
  tavern: [41018, 41005],
  house1: [41005, 41012, 41040, 41019],
  house2: [41031, 41018, 41028, 41037],
  house3: [41019, 41037, 41029, 41013],
  house4: [41015, 41011, 41006, 41016],
  temple: [41006, 41019, 41015],
  thieves: [41031, 41018, 41028, 41037], // a temple's the one Daggerfall's own temples stand (41006, six of the eight donors')
});

/** What a room is furnished as: the pieces of each part (the first that fits is stood, by the plan's seed's order). */
export const PIECES = Object.freeze({
  bed: [41000, 41001],
  bedWealthy: [41002, 41000],
  wardrobe: [41003, 41800, 41004, 41801],
  cupboard: [41032, 41037, 41051, 41804],
  dresser: [41034, 41033],
  cabinet: [41007, 41008, 41802, 41803],
  chest: [41811, 41812, 41813],
  crate: [41822, 41826, 41827, 41829, 41831, 41832, 41818],
  table: [41108, 41112],
  bigTable: [41109, 41121],
  counter: [41126],
  chair: [41100, 41102, 41103],
  bench: [41105, 41106],
  hearth: [41116, 41117],
  pedestal: [41020],
});

/** THE KINDS a pool's building is laid out as, and the building sets each wears (KIT_SET_ARCHIVES' index): a home the
 *  city's, a merchant's or a village's plaster, a wealthy one a manor's; a shop the city's or a merchant's; a tavern a
 *  manor's (Daggerfall's own taverns wear set 3 - TVRNAL00.RMB, TVRNBM04.RMB) or a tavern's; the Mages Guild its own. */
export const POOL_KIND = Object.freeze({
  house1: 'house',
  house2: 'house',
  house3: 'house',
  house4: 'house',
  tavern: 'tavern',
  mages: 'guild',
  fighters: 'guild',
  bank: 'bank',
  library: 'library',
  alchemist: 'shop',
  armorer: 'shop',
  bookseller: 'shop',
  clothing: 'shop',
  furniture: 'shop',
  gems: 'shop',
  general: 'shop',
  pawn: 'shop',
  weaponsmith: 'shop',
  temple: 'temple',
  thieves: 'house', // IC-PROPS x IC-INTERIORS: a temple of the Eight its nave; the Thieves Guild's house a home, as THIE blocks' House2
});
export const POOL_SETS = Object.freeze({
  house1: [3, 4],
  house2: [0, 4, 7],
  house3: [0, 7],
  house4: [0, 3, 4],
  tavern: [3, 5],
  mages: [2],
  fighters: [0, 3],
  bank: [3, 4],
  library: [2, 3],
  shop: [0, 4],
  temple: [6],
  thieves: [0, 4, 7], // a temple Daggerfall's temple set (Interior_TempleInt, TEXTURE.163)
});
