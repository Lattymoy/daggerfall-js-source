// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1 (2026-09-25) — THE CATALOGUE: EVERYTHING DAGGERFALL FURNISHES.
//
// Mac, asked what the decorator's catalogue holds: "Everything
// Daggerfall furnishes" - every piece of furniture and decor Daggerfall
// itself places inside its buildings, found in the game data, browsed
// with a turning preview, named where the game names them; and the
// panel "an intuitive scrolling menu with filters".
//
// THE SOURCE is BLOCKS.BSA's own town blocks (RMB): every building
// interior's PROP models - the object type Daggerfall lays out as a
// room's furniture (world/interiorLayout.js PROP_MODEL_TYPE) - and its
// flats, the editor's markers (TEXTURE.199) excepted. DECOR-DUNGEON
// (FIELD BUGS 2026-10-05b, the owner: "a lot of missing decor items",
// asked which, the dungeons' furnishings among them): and its dungeon
// blocks (RDB) - every model of the furniture families that stands
// there doing nothing (no action, no door) and every flat that is not
// an editor's marker; a dungeon has no prop type, so a model is told
// from the dungeon's own architecture by its family (below).
// DECOR-OUTDOOR (the same day, the outdoor pieces for a yard): and each
// town block's STREET - the block's own models and flats and each
// building's outside flats - with the climate's own NATURE set whole;
// these stand in a yard alone, and the nature a yard is offered is its
// own climate's (a yard's trees turn with its town's season). HOME-DOORS
// (2026-09-30): and its DOORS - the five models AddActionDoors hangs
// between a building's rooms, a door placed hanging in a doorway
// (systems/decorDoorways.js). A piece is in the
// catalogue because Daggerfall put it in a room; nothing is invented.
// DECOR-MODS (the same day, the town mods' furnishings first): and while
// a town mod stands, the pieces the port stands in for what the mods
// place (systems/decorMods.js) - read after every place of Daggerfall's,
// so none of its names moves. The ladder is left out: placed, it
// would stand in the room and not be climbed (the climb reads the
// room's own ladders, found at build).
//
// THE NAMES are the game's where it has them - the house containers
// World Tooltips names (worldTooltips.js HOUSE_CONTAINER_NAMES), the
// beds, the shop shelves, the lights of TEXTURE.210 as Daggerfall
// Unity's own light table calls them - and otherwise the piece's kind
// with a number, stable for the same game data (numbered in id order
// within its name).
//
// Pure: the blocks are an argument; the host scans BLOCKS.BSA and
// measures each piece's size (the price is by size, net/decorLaw.js).
// ═══════════════════════════════════════════════════════════════════

import { PROP_MODEL_TYPE, DOOR_MODEL_BASE_ID, DOOR_MODEL_COUNT } from '../world/interiorLayout.js';
import { isDoorModel } from './decorDoorways.js';   // HOME-DOORS
import { EDITOR_FLATS_ARCHIVE, isNatureArchive } from '../world/rmbFlats.js';
import { LADDER_MODEL_ID } from '../player/enterExit.js';
import { BED_MODELS } from './rrRealism.js';
import { isHouseContainerModel } from './containers.js';
import { isShopShelfModel } from './shopStock.js';
import { HOUSE_CONTAINER_NAMES } from './worldTooltips.js';
import { interiorLightProperties } from '../world/interiorLights.js';
import { decorPrice } from '../net/decorLaw.js';
import { BULLETIN_BOARD_MODEL_ID, WINDMILL_MODEL_ID, isCityGate } from '../world/rmbLayout.js';   // GUILD1e: the hall's board is Daggerfall's own; DECOR-OUTDOOR: the mill and the gates are no street pieces
import { CLIMATE_NATURE } from '../formats/mapsFile.js';   // DECOR-OUTDOOR: the climates' nature sets
import { isTreeRecord } from '../world/terrainNature.js';
import { isNudeFlat, showNudity } from '../characters/nudeFlats.js';   // NUDE-DECOR: no nude figure offered while Show Nudity is off
import { rdbObjects, rdbModelActs, isActionDoor, isNpcFlat } from '../world/rdbLayout.js';   // DECOR-DUNGEON: the dungeon's own walk, its acting and its doors
import { RDB_RESOURCE_TYPES } from '../formats/blocksFile.js';

/** A piece's KIND - the panel's filter - and what it reads as. */
export const DECOR_KINDS = Object.freeze({
  bed: 'Beds', storage: 'Storage', shelf: 'Shelves', furniture: 'Furniture', door: 'Doors',   // HOME-DOORS
  light: 'Lights', clothing: 'Clothing', boxes: 'Boxes and bottles', arms: 'Arms and armour',
  books: 'Books and scrolls', misc: 'Odds and ends', treasure: 'Treasure', decor: 'Decorations',
  people: 'Vendors',   // HOME-VENDOR (Mac: "People category sounds wrong call it vendors"): the people Daggerfall stands in its rooms - a home's trader is one of them, made the vendor station
  dungeon: 'Dungeon furniture',   // DECOR-DUNGEON: what Daggerfall stands in its dungeons and nowhere in a house - a throne, a cage, a coffin, a statue
  outdoor: 'Outdoors',   // DECOR-OUTDOOR: what Daggerfall stands in its streets and nowhere inside - a fence, a well, a fountain, a cart
  nature: 'Trees and plants',   // DECOR-OUTDOOR: the climate's own nature - a yard's own climate's
  mods: "Town mods' furnishings",   // DECOR-MODS: what the town mods (and Detailed Ships) furnish, as the port stands it in
});
/** A kind's own word for one piece of it, where the game gives none. */
const KIND_ONE = Object.freeze({
  bed: 'Bed', storage: 'Cupboard', shelf: 'Shelves', furniture: 'Furniture', door: 'Door', light: 'Light', clothing: 'Clothing',
  boxes: 'Box', arms: 'Arms', books: 'Books', misc: 'Odds and ends', treasure: 'Treasure', decor: 'Decoration', people: 'Vendor',
  dungeon: 'Dungeon piece', outdoor: 'Outdoor piece', nature: 'Plant', mods: 'Furnishing',
});
/** The flat archives Daggerfall files its interior dressing under (lootDataTables.js DROP_ICON_ARCHIVES names five of
 *  them for the inventory's drop icons; 210 is the lights, 216 the treasure piles). Any other is a decoration. */
const FLAT_ARCHIVE_KIND = Object.freeze({ 204: 'clothing', 205: 'boxes', 207: 'arms', 209: 'books', 210: 'light', 211: 'misc', 216: 'treasure' });
export const LIGHTS_ARCHIVE = 210;
/** TEXTURE.210's records as Daggerfall Unity's own light table names them (world/interiorLights.js). */
const LIGHT_NAMES = Object.freeze({
  0: 'Bowl with fire', 2: 'Skull candle', 3: 'Candle', 4: 'Candle with base', 5: 'Candleholder with three candles',
  6: 'Skull torch', 8: 'Turquoise lamp', 9: 'Chandelier with candles', 11: 'Candle in lamp', 13: 'Round lamp',
  17: 'Mounted torch', 20: 'Brazier torch', 21: 'Standing candle', 22: 'Round lantern', 24: 'Lantern with long chain',
  25: 'Lantern with medium chain', 26: 'Lantern with short chain', 27: 'Lantern',
});

/** A model's kind. */
export function modelKind(model) {
  if (isDoorModel(model)) return 'door';   // HOME-DOORS: hung in a doorway, never stood on a floor
  if (BED_MODELS.includes(model)) return 'bed';
  if (isShopShelfModel(model)) return 'shelf';
  if (isHouseContainerModel(model)) return 'storage';
  return 'furniture';
}
/** A flat's kind, by its archive. */
export const flatKind = (archive) => FLAT_ARCHIVE_KIND[archive] ?? 'decor';

/** The key a catalogue entry and a placed piece share: `m41000`, `f210.4`. */
export const decorKey = (what) => (what.model != null ? `m${what.model}` : `f${what.flat[0]}.${what.flat[1]}`);

/** DECOR-DUNGEON: WHERE A PIECE WAS FOUND, in the order a shared name is numbered - a house's rooms first (DECOR1's own
 *  catalogue, so no name of theirs ever moves), then a dungeon's; DECOR-OUTDOOR: then a town's street, then the
 *  climate's nature; DECOR-MODS: then the town mods' rooms, then their streets (systems/decorMods.js). A piece found in
 *  two is the earlier place's. */
export const DECOR_FROM = Object.freeze({ room: 0, dungeon: 1, street: 2, nature: 3, mod: 4, modstreet: 5 });
/** DECOR-OUTDOOR: the places whose pieces stand OUTSIDE - in a yard alone. */
const OUTSIDE = new Set(['street', 'nature', 'modstreet']);
/** DECOR-MODS: the places a mod's piece is read from - offered only while the port stands it (decorRoomEntries). */
const MOD_FROM = new Set(['mod', 'modstreet']);
/** DECOR-MODS: whether an entry is a town mod's piece (systems/decorMods.js). */
export const isDecorModEntry = (e) => MOD_FROM.has(e?.from);
/** DECOR-DUNGEON: Daggerfall's FURNITURE FAMILIES - the ARCH3D ids of the furniture and props that stand free in a room,
 *  41000-43999; a dungeon's own architecture, its corridors, rooms, stairs and vaults, is 50000-98999 (the dungeon seam
 *  census's split, tools/seamCensus.mjs isArchitecture). A dungeon has no prop type of its own, so its family is how a
 *  dungeon's furnishing is told from the dungeon itself. */
export const DECOR_FURNITURE_FIRST = 41000;
export const DECOR_FURNITURE_LAST = 43999;
/** DECOR-DUNGEON: the pieces Daggerfall keeps among its architecture's ids that stand free all the same - MEASURED over
 *  its 187 dungeon blocks: each of the 731 models a dungeon stands doing nothing outside the families was looked at, and
 *  the THINGS kept (a statue, a sword, a pedestal, a hanging, a coffin) - never the dungeon itself: its structure (a
 *  wall, a stair, a floor, a platform, a pit, a cave's cone of rock), its passages (a door, a trapdoor, a portcullis, a
 *  ramp, a bridge) or its mechanisms (a lever and its housing). Each is named by the tag Daggerfall's own dungeon editor
 *  gave its reference (BLOCKS.BSA's model list), with how many times it stands still there - test/decordungeon.test.js
 *  measures both again over the player's own blocks. */
export const DECOR_FREE_STANDING = Object.freeze([
  60512, 60520,   // the boulders (ST1 1, ST9 1)
  62317,   // the marble arch (XA2 3)
  62318, 62319, 62321,   // the wooden beams (BM0 5, BM0 30, BM1 12)
  62323, 62324, 62325, 62326, 62327, 62328, 62329, 62330,   // the statues - a figure standing and one seated, small and large, in pale stone and in dark (ST0-ST3 26, 14, 5, 3, 6, 7, 8, 6)
  74009, 74201,   // the marble columns (CLM 18, 19)
  74069,   // the stone casket (CAS 1)
  74071, 74072, 74073,   // the marble coffins, open, and their lid (BCH 2, BCX 9, LID 1)
  74082, 74086, 74091, 74237,   // the pedestals - wood and marble, marble, stone, wooden (TRP 1, TSP 1, HT3 1, PED 1)
  74094,   // the domed pavilion (MAN 1)
  74221, 74224, 74225, 74226, 74227, 74228,   // the great crossbow, a sword, an axe, the knight's armour, a sword, a crossbow (BOW 1, SWD 7, AXE 7, AMR 10, SWD 10, BW2 5)
  74229,   // the arcane cage (ARC 15)
  74800, 74804, 74806, 75800,   // the hangings - large and small (LRG 5, 1, 5; SRG 2)
  99800,   // an arrow (ARW 2) - the archers' own shot (combat/arrowFlight.js), lying where Daggerfall left it
]);
const FREE_STANDING = new Set(DECOR_FREE_STANDING);
/** DECOR-DUNGEON: whether a dungeon's model is a furnishing - of the furniture families (the ladder aside, as in a room)
 *  or one of the free-standing pieces. */
export const isDungeonFurnishing = (id) => Number.isSafeInteger(id) && id !== LADDER_MODEL_ID
  && ((id >= DECOR_FURNITURE_FIRST && id <= DECOR_FURNITURE_LAST) || FREE_STANDING.has(id));
/** DECOR-OUTDOOR: whether a town block's own model is a street piece - all but a mill (its sails turn), a city's gate,
 *  the town's board (GUILD1e: the hall's own piece) and the ladder. */
export const isStreetPiece = (id) => Number.isSafeInteger(id) && id > 0 && id !== LADDER_MODEL_ID && id !== WINDMILL_MODEL_ID
  && id !== BULLETIN_BOARD_MODEL_ID && !isCityGate(id);
/** DECOR-OUTDOOR: the climates' nature sets (their summer archives - formats/mapsFile.js getWorldClimateSettings) and the
 *  records Daggerfall stands of each: 1 to 31, every one the wilderness lays (terrainNature.js layoutNature's
 *  nextIntRange(1, 32)) and the towns' ground scenery draws from (record 0 is a marker). A piece stores its climate's
 *  summer archive; the season's is the yard's to draw. */
export const DECOR_NATURE_BASES = Object.freeze([...new Set(Object.values(CLIMATE_NATURE))].sort((a, b) => a - b));
export const DECOR_NATURE_RECORDS = 31;
/** DECOR-OUTDOOR: the climate's nature, every set's every record, into a collection (`collectDecor`'s Map) - a key a room
 *  or a street already holds stays theirs. */
export function addDecorNature(into = new Map()) {
  for (const base of DECOR_NATURE_BASES) {
    for (let r = 1; r <= DECOR_NATURE_RECORDS; r++) {
      const what = { model: null, flat: [base, r], nature: base };
      const key = decorKey(what);
      if (!into.has(key)) into.set(key, { ...what, count: 0, from: 'nature' });
    }
  }
  return into;
}

/**
 * EVERY PIECE DAGGERFALL PUTS IN A ROOM, over `dfBlocks` (parsed RMB blocks, blocksFile.js's shape): each interior's
 * prop models and its flats, the editor's markers and the ladder left out. Answers a Map key -> `{ model, flat, count }`,
 * `count` how many times Daggerfall places it (the panel's "most common first"). `into` is a Map to add to - the scan
 * (systems/decorScan.js) reads the blocks a few at a time into one.
 * @param {Iterable<any>} dfBlocks
 * @param {Map<string, {model: number|null, flat: number[]|null, count: number, person?: boolean, from?: string}>} [into]
 */
export function collectDecor(dfBlocks, into = new Map()) {
  const out = into;
  // DECOR-DUNGEON: a piece is read as its best place found it (`from`, DECOR_FROM) - met first in a dungeon and then in a
  // room, it is the room's reading (whether it is a person, say), every placement counted
  const add = (what, from = 'room') => {
    const key = decorKey(what);
    const had = out.get(key);
    if (!had) out.set(key, { ...what, count: 1, from });
    else if ((DECOR_FROM[from] ?? 0) < (DECOR_FROM[had.from] ?? 0)) out.set(key, { ...what, count: had.count + 1, from });
    else had.count++;
  };
  for (const b of dfBlocks ?? []) {
    for (const sub of b?.rmbBlock?.subRecords ?? []) {
      const interior = sub?.interior;
      for (const m of interior?.block3dObjectRecords ?? []) {
        if (m?.objectType !== PROP_MODEL_TYPE) continue;
        const id = m.modelIdNum;
        if (!Number.isSafeInteger(id) || id <= 0 || id === LADDER_MODEL_ID) continue;
        add({ model: id, flat: null });
      }
      // HOME-DOORS: the doors Daggerfall hangs between its rooms - DaggerfallInterior's AddActionDoors model
      for (const d of interior?.blockDoorRecords ?? []) {
        const idx = d?.doorModelIndex;
        if (!Number.isSafeInteger(idx) || idx < 0) continue;
        add({ model: DOOR_MODEL_BASE_ID + (idx % DOOR_MODEL_COUNT), flat: null });
      }
      for (const f of interior?.blockFlatObjectRecords ?? []) {
        const a = f?.textureArchive;
        const r = f?.textureRecord;
        if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || a === EDITOR_FLATS_ARCHIVE || r < 0) continue;
        add({ model: null, flat: [a, r] });
      }
      // HOME-VENDOR: and the PEOPLE it stands in them (blockPeopleRecords - interiorPeople.js's own) - a person placed is a
      // figure standing, and one made the vendor station is a home's trader (net/vendorLaw.js)
      for (const f of interior?.blockPeopleRecords ?? []) {
        const a = f?.textureArchive;
        const r = f?.textureRecord;
        if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || a === EDITOR_FLATS_ARCHIVE || r < 0) continue;
        add({ model: null, flat: [a, r], person: true });
      }
    }
    // DECOR-OUTDOOR: A TOWN BLOCK'S STREET - what Daggerfall stands outside its buildings: the block's own models (its
    // fences, wells, fountains, statues, carts, benches - isStreetPiece) and its flats, the block's own and each
    // building's outside, but an editor's marker or the climate's nature (the nature set stands whole - addDecorNature).
    // A street's people are people, as a room's are.
    const rmb = b?.rmbBlock;
    for (const m of rmb?.misc3dObjectRecords ?? []) {
      if (isStreetPiece(m?.modelIdNum)) add({ model: m.modelIdNum, flat: null }, 'street');
    }
    const streetFlat = (f) => {
      const a = f?.textureArchive;
      const r = f?.textureRecord;
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || r < 0 || a === EDITOR_FLATS_ARCHIVE || isNatureArchive(a)) return;
      add({ model: null, flat: [a, r], ...(isNpcFlat(a) ? { person: true } : {}) }, 'street');
    };
    for (const f of rmb?.miscFlatObjectRecords ?? []) streetFlat(f);
    for (const sub of rmb?.subRecords ?? []) for (const f of sub?.exterior?.blockFlatObjectRecords ?? []) streetFlat(f);
    // DECOR-DUNGEON: A DUNGEON BLOCK'S FURNISHINGS - each model of the furniture families (or a free-standing piece) that
    // stands there doing nothing: no action of its own (a lever, a moving throne, a lid that swings) and never a door;
    // and each flat but an editor's marker (its foes, its treasure, its quests), a flat that acts, or the climate's own
    // nature (a cave's tree is its climate's). A dungeon's people are people, as a room's are.
    const rdb = b?.rdbBlock;
    if (Array.isArray(rdb?.objectRootList) && Array.isArray(rdb.modelReferenceList)) {
      for (const obj of rdbObjects(rdb)) {
        if (obj?.type === RDB_RESOURCE_TYPES.Model) {
          const ref = obj.resources?.modelResource?.modelIndex;
          const id = rdb.modelReferenceList[ref]?.modelIdNum;
          if (!isDungeonFurnishing(id) || rdbModelActs(obj) || isActionDoor(rdb, ref)) continue;
          add({ model: id, flat: null }, 'dungeon');
        } else if (obj?.type === RDB_RESOURCE_TYPES.Flat) {
          const fr = obj.resources?.flatResource;
          const a = fr?.textureArchive;
          const r = fr?.textureRecord;
          if (!Number.isSafeInteger(a) || !Number.isSafeInteger(r) || r < 0 || a === EDITOR_FLATS_ARCHIVE || fr.action > 0 || isNatureArchive(a)) continue;
          add({ model: null, flat: [a, r], ...(isNpcFlat(a) ? { person: true } : {}) }, 'dungeon');
        }
      }
    }
  }
  return out;
}

/**
 * THE CATALOGUE over `collectDecor`'s Map: each piece with its kind, its name, whether it holds things by default (a
 * house container does), the light it carries by default (a TEXTURE.210 light does, with Daggerfall's own settings),
 * and `radius` null until the host measures it. Ordered by kind, then most common first.
 */
/** The light a flat carries by default - a TEXTURE.210 light's, with Daggerfall's own settings, within the piece
 *  law's bounds - or null (any other flat). DECOR2a: a candle of the player's own is lit as the catalogue's is. */
export function decorFlatLight(flat) {
  if (!Array.isArray(flat) || flat[0] !== LIGHTS_ARCHIVE) return null;
  const p = interiorLightProperties(flat[1]);
  return {
    color: (p.color ?? [1, 0.95, 0.8]).map((v) => Math.min(1, Math.max(0, v))),
    range: Math.min(30, Math.max(1, p.range)),
    intensity: Math.min(4, Math.max(0.05, p.intensity)),
  };
}

export function decorCatalogue(collected) {
  const entries = [];
  for (const [key, c] of collected ?? []) {
    // DECOR-MODS: a mod's piece is filed as what it stands in as (`as` - a coloured bed as its classic bed, a mod's flat as
    // the classic flat it stands in for)
    let kind = c.model != null ? modelKind(c.as ?? c.model) : c.person ? 'people' : flatKind(c.as ?? c.flat[0]);   // HOME-VENDOR
    // DECOR-DUNGEON: what Daggerfall stands in a dungeon and in no house is a dungeon's furniture - where the game files it
    // as nothing more (a bed, a chest, a shelf, a light or a treasure stays one)
    if (c.from === 'dungeon' && (kind === 'furniture' || kind === 'decor')) kind = 'dungeon';
    // DECOR-OUTDOOR: and what stands in a street and nowhere inside is an outdoor piece - but a light, a crate, a person,
    // as the game files them; the climate's nature is its trees and plants
    if ((c.from === 'street' || c.from === 'modstreet') && (kind === 'furniture' || kind === 'decor')) kind = 'outdoor';   // DECOR-MODS: a mod's street's too
    if (c.from === 'mod' && (kind === 'furniture' || kind === 'decor')) kind = 'mods';   // DECOR-MODS: and a mod's room's is its furnishing
    if (c.nature != null) kind = 'nature';
    const light = c.flat ? decorFlatLight(c.flat) : null;
    const own = c.base ?? (c.model != null   // DECOR-MODS: a mod's piece's own name (decorMods.js decorModNaming)
      ? (kind === 'storage' ? HOUSE_CONTAINER_NAMES[c.model] : kind === 'bed' ? 'Bed' : null)
      : (kind === 'light' ? LIGHT_NAMES[c.flat[1]] : kind === 'nature' && isTreeRecord(c.nature, c.flat[1]) ? 'Tree' : null));   // DECOR-OUTDOOR: a tree of its set (TREE_RECORDS), else a plant
    entries.push({ key, model: c.model, flat: c.flat, kind, base: own ?? KIND_ONE[kind], count: c.count, storage: kind === 'storage', light, radius: null, from: c.from ?? 'room',
      ...(c.nature != null ? { nature: c.nature } : {}) });   // DECOR-OUTDOOR: its climate's set
  }
  // a name shared is numbered, in id order (stable for the same game data)
  const byBase = new Map();
  for (const e of entries) {
    const group = e.nature != null ? `${e.base}|${e.nature}` : e.base;   // DECOR-OUTDOOR: a climate's trees numbered among its own - a yard sees its set alone
    const list = byBase.get(group) ?? [];
    list.push(e);
    byBase.set(group, list);
  }
  const idOrder = (e) => (e.model != null ? e.model : e.flat[0] * 1000 + e.flat[1]);
  // DECOR-DUNGEON: NO NAME MOVES FOR A PLACE READ AFTER IT. The pieces of each place (DECOR_FROM: a room's, then a
  // dungeon's) are numbered among themselves in id order and AFTER every earlier place's of the same name - the first
  // place's alone, one piece, keeps its bare name ("Vendor", then "Vendor 2"); numbering them all together renamed a
  // room's lone Vendor "Vendor 1" the day a dungeon's prisoner joined it, and a lower record renumbered every one above
  const fromOrder = (e) => DECOR_FROM[e.from] ?? 0;
  for (const list of byBase.values()) {
    list.sort((a, b) => fromOrder(a) - fromOrder(b) || idOrder(a) - idOrder(b));
    let taken = 0;
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j < list.length && fromOrder(list[j]) === fromOrder(list[i])) j++;
      const lone = taken === 0 && j - i === 1;
      for (let k = i; k < j; k++) list[k].name = lone ? list[k].base : `${list[k].base} ${taken + k - i + 1}`;
      taken += j - i;
      i = j;
    }
  }
  const kindOrder = Object.keys(DECOR_KINDS);
  entries.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || b.count - a.count || idOrder(a) - idOrder(b));
  return entries.map((e) => Object.freeze({
    key: e.key, model: e.model, flat: e.flat ? Object.freeze([...e.flat]) : null, kind: e.kind, name: e.name,
    count: e.count, storage: e.storage, light: e.light ? Object.freeze({ ...e.light, color: Object.freeze([...e.light.color]) }) : null,
    from: e.from,   // DECOR-DUNGEON: where Daggerfall stands it (DECOR_FROM)
    outside: OUTSIDE.has(e.from),   // DECOR-OUTDOOR: a street's or the climate's - a yard's alone
    nude: !!e.flat && isNudeFlat(e.flat[0], e.flat[1]),   // NUDE-DECOR (AUDIT 05b A7): asked once here, never a frame
    ...(e.nature != null ? { nature: e.nature } : {}),   // DECOR-OUTDOOR: the climate's set it is of (its summer archive)
  }));
}

/**
 * GUILD1e (2026-09-30, Mac: "Finish the seats"; Seats-Arc 8.2: "the hall carries ... a private guild board"): THE HALL'S
 * BOARD - Daggerfall's own board (rmbLayout.js BULLETIN_BOARD_MODEL_ID, a town's), offered in a guild's hall alone
 * (`hall`), never in a home or a yard: a town's board stands outdoors, and nothing of Daggerfall's rooms carries one, so
 * it is the one piece the catalogue holds that no room placed. Pressed in the hall, it opens the guild's own notes
 * (scenes/worldModes.js activateDecor). Priced by its size, as every piece.
 */
export const HALL_BOARD_ENTRY = Object.freeze({
  key: `m${BULLETIN_BOARD_MODEL_ID}`, model: BULLETIN_BOARD_MODEL_ID, flat: null, kind: 'furniture', name: 'Notice Board',
  count: 0, storage: false, light: null, hall: true,
});
/** The catalogue a room offers: a hall's board in a hall's room alone; HOME-YARD: no door in a yard. NUDE-DECOR: and no
 *  nude figure while Show Nudity is off (`show`, the setting unless told) - one chosen would stand as that figure to
 *  every visitor whose setting is on, and here as its stand-in, a piece its owner never saw. DECOR-OUTDOOR: and the
 *  street's pieces and the climate's nature in a yard alone - its own climate's nature (`room.natureBase`, its set's
 *  summer archive). DECOR-MODS (AUDIT 05b A3): and a town mod's piece while the port stands it alone - `mods`, the keys
 *  of the mods' pieces standing now (systems/decorMods.js decorModsLive; none unless told): asked here, as the offer is
 *  made, never once when the catalogue was read - a mod turned off left its pieces for sale that stood nowhere, and one
 *  turned on was never offered until the game was loaded again. The panel asks every frame: a field read a piece. */
export function decorRoomEntries(entries, room, show = null, mods = null) {
  const nude = !(show ?? showNudity());
  return entries?.filter((e) => (!e.hall || (!!room?.hall && !room?.yard))
    && !(room?.yard && e.kind === 'door')
    && !(nude && e.nude)
    && (!e.outside || !!room?.yard)
    && (e.nature == null || e.nature === room?.natureBase)
    && (!MOD_FROM.has(e.from) || !!mods?.has(e.key))) ?? null;
}

/** A piece's SIZE band, by its radius in metres - the panel's size filter. */
export const DECOR_SIZES = Object.freeze({ small: 'Small', medium: 'Medium', large: 'Large' });
export function decorSize(radiusMetres) {
  if (!(radiusMetres > 0)) return null;
  if (radiusMetres < 0.5) return 'small';
  if (radiusMetres < 1.25) return 'medium';
  return 'large';
}

/**
 * THE PANEL'S FILTERS over the catalogue: kinds (any of), words (every word found in the name or the kind), a size
 * band, holds-things, gives-light; sorted most common first, by price, or by name. `radiusOf(entry)` is the host's
 * measure (null while unmeasured: such an entry passes no size filter and sorts last by price).
 * @param {readonly any[]} entries
 * @param {{ kinds?: Iterable<string>|null, text?: string, size?: string|null, storage?: boolean|null,
 *   light?: boolean|null, sort?: string, radiusOf?: (entry: any) => (number|null) }} [opts]
 */
export function filterDecor(entries, {
  kinds = null, text = '', size = null, storage = null, light = null, sort = 'common', radiusOf = () => null,
} = {}) {
  const want = kinds && [...kinds].length ? new Set(kinds) : null;
  const words = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const out = (entries ?? []).filter((e) => {
    if (want && !want.has(e.kind)) return false;
    if (storage !== null && e.storage !== storage) return false;
    if (light !== null && (e.light !== null) !== light) return false;
    if (size !== null && decorSize(radiusOf(e)) !== size) return false;
    if (words.length) {
      const hay = `${e.name} ${DECOR_KINDS[e.kind]}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'price') {
    const p = (e) => decorPrice(radiusOf(e) ?? 0) || Infinity;
    out.sort((a, b) => p(a) - p(b) || a.name.localeCompare(b.name));
  }
  return out;
}
