// THE SHIP REFIT (2026-10-29): the two ships a player can own, furnished by the port. Daggerfall builds both as empty
// shells - a cog (SHIPAA00.RMB) and a galleon (SHIPAA01.RMB) whose cabins hold two crates between them. The refit
// furnishes every room they already have: a captain's cabin, berths, a mess, a chart room and an arms locker, stores,
// a cargo hold, and lamps in the rooms that had none. Every piece is one of Daggerfall's own models or flats, laid out
// here in metres in the interior's frame (world/interior/interiorLayout.js) and checked against the shells by
// tools/shipRefitCheck.mjs. The building record is the player's own (BLOCKS.BSA) with these pieces appended, served as
// the port's own building file (ReplaceRmbBlockBuildingData) behind no door, so Warm Ashes' ambush variants lay it over
// their blocks as DFU composes two such files. No switch: the same deck for every player, Replace Game Artwork or not.

import { buildingToDfuJson } from '../formats/worldData/worldDataJson.js';
import { registerPortBuilding, buildingReplacementFilename } from '../formats/worldData/worldDataReplacement.js';
import { ROTATION_DIVISOR } from '../formats/blocksFile.js';

const U = 0.025; // MeshReader.GlobalScale: one classic unit in metres
/** RmbBlock3dObjectRecord.ObjectType for a room's furniture - interiorLayout stands its lowest point on YPos. */
const PROP = 3;

/** A classic flat's size in pixels at record scale 0 - each of the ones the refit stands (the check reads them back
 *  off the player's TEXTURE files). A flat's record is its centre, so a standing one is lifted half its height. */
export const REFIT_FLAT_PX = Object.freeze({
  '200_1': 18,
  '205_0': 37,
  '205_17': 27,
  '205_19': 33,
  '205_20': 27,
  '205_43': 18,
  '208_0': 74,
  '208_4': 55,
  '208_6': 29,
  '210_27': 38,
});
/** The candles are drawn at half size (record scale -128): their height in metres. */
const CANDLE_M = Object.freeze({ '210_3': 0.2375 });
/** How far below its origin each deck model reaches (its lowest vertex, metres): an exterior record stands its origin,
 *  not its foot, at YPos (the check reads these back off the player's ARCH3D). */
export const REFIT_MODEL_FOOT = Object.freeze({
  41811: 0.2822,
  41813: 0.2602,
  41818: 0.2887,
  41822: 0.3887,
  41827: 0.3,
  41831: 0.3,
  41832: 0.65,
  41834: 0.65,
});

/** A model standing on the storey's floor: [id, x, z, face, lift]. `face` is where the model's own +Z turns to, in
 *  degrees (0 +z, 90 +x, 180 -z, -90 -x); `lift` stands it on something that height above the floor. */
const m = (id, x, z, face = 0, lift = 0) => Object.freeze({ id, x, z, face, lift });
/** A flat standing on the floor (or `on` that height over it): [archive, record, x, z]. */
const f = (archive, record, x, z, on = 0) => Object.freeze({ archive, record, x, z, on });
/** A lamp hanging from the ceiling at `ceil`. */
const lamp = (x, z, ceil, record = 27) => Object.freeze({ archive: 210, record, x, z, hang: ceil });

/** The two ships: the block, its index in BLOCKS.BSA and the record, each storey's floor and its pieces. */
export const SHIP_REFIT = Object.freeze({
  small: Object.freeze({
    block: 'SHIPAA00.RMB',
    index: 390,
    record: 0,
    storeys: Object.freeze({
      // the deck the ladder lands on: the cabin aft, the berths, the mess, the chart room and arms locker, the stores
      deck: Object.freeze({
        floor: 3.6,
        models: Object.freeze([
          // the captain's cabin, across the stern
          m(41000, -17.65, 2.4),
          m(41811, -16.2, 2.4, 90),
          m(41003, -13.3, 2.4, -90),
          m(41030, -13.05, -4.2, -90),
          m(41051, -18.7, -4.2, 90),
          m(41102, -17.95, -4.2, -90),
          m(41108, -15.6, -3.6),
          m(41100, -15.6, -4.65),
          m(41100, -15.6, -2.55, 180),
          // the starboard berths: five bunks along the hull, a sea chest at each
          m(41002, -11.1, 3.65),
          m(41812, -11.1, 2.65),
          m(41002, -8.65, 4.05),
          m(41812, -8.65, 3.05),
          m(41002, -6, 4.2),
          m(41812, -6, 3.15),
          m(41002, -3.4, 4.2),
          m(41812, -3.4, 3.15),
          m(41002, -0.85, 4.1),
          m(41812, -0.85, 3.1),
          // the mess: a long table, its benches, a cupboard
          m(41109, 3.3, 2.4),
          m(41106, 2.4, 1.2),
          m(41106, 4.2, 1.2),
          m(41106, 2.4, 3.6, 180),
          m(41106, 4.2, 3.6, 180),
          m(41032, 1, 3.8, 90),
          // the bow stores
          m(41822, 9.5, 1.85),
          m(41818, 9.5, 1.85, 0, 0.78),
          // the port berths, aft
          m(41002, -10.25, -6.95),
          m(41812, -10.25, -5.95, 180),
          m(41002, -7.85, -7.35),
          m(41812, -7.85, -6.35, 180),
          m(41002, -5.4, -7.75),
          m(41812, -5.4, -6.65, 180),
          // the arms locker and the chart room, forward
          m(41003, -1.6, -7.6),
          m(41003, 0.5, -7.35),
          m(41813, -2.6, -6),
          m(41112, 2.4, -5.5),
          m(41101, 1.9, -4.55, 180),
          m(41101, 2.9, -4.55, 180),
          // the sail locker in the port bow
          m(41827, 9.7, -4.8),
          m(41818, 10, -4.05),
        ]),
        flats: Object.freeze([
          f(208, 0, -17.95, 0.2),
          f(210, 3, -15.6, -3.6, 0.76), // the cabin's globe, a candle on its table
          f(210, 3, 2.6, 2.4, 0.82),
          f(210, 3, 4.0, 2.4, 0.82),
          f(200, 1, 3.3, 2.2, 0.82),
          f(205, 0, 5.55, 3.55),
          f(205, 0, 5.75, 3.0),
          f(205, 17, 7.3, 2.2),
          f(205, 19, 7.4, -5.6),
          f(205, 0, 13, 0.05),
          f(205, 0, 13.7, -2.9),
          f(208, 4, 4.9, -6.6),
          f(208, 6, 2.0, -5.5, 0.66),
          f(210, 3, 2.9, -5.5, 0.66),
          lamp(-15.8, -0.6, 6.8),
          lamp(-8.0, 2.5, 6.8),
          lamp(-2.0, 2.5, 6.8),
          lamp(3.5, 2.3, 6.8),
          lamp(-8.0, -6.0, 6.8),
          lamp(2.0, -5.8, 6.8),
          lamp(11.5, -1.5, 6.8),
        ]),
      }),
      // the hold below: the cargo
      hold: Object.freeze({
        floor: 0.225,
        models: Object.freeze([
          m(41833, -14.6, 0.5),
          m(41832, -11.45, 1.5),
          m(41822, -11.45, 1.5, 0, 1.3),
          m(41822, -9.95, 2.05),
          m(41831, -3.05, 2.45),
          m(41827, -1.7, 2.2),
          m(41832, 1.1, 1.65),
          m(41818, 3.3, 1.8),
          m(41834, -13.9, -4.05),
          m(41833, -10.9, -4.3),
          m(41813, 2.55, -5.05),
          m(41813, 3.6, -4.8, 30),
        ]),
        flats: Object.freeze([
          f(205, 0, 4.8, -1.5),
          f(205, 0, 5.5, -2.4),
          f(205, 0, 4.9, -3.3),
          f(205, 17, -4.5, -5.6),
          f(205, 17, -3.5, -5.9),
          f(205, 19, 0, -5.4),
          f(205, 0, -17.3, -1.0),
          f(205, 20, -17.2, 0.2),
          lamp(-13.0, -1.0, 3.43),
          lamp(1.0, -1.0, 3.43),
        ]),
      }),
    }),
    // the open deck: cargo along the rails, the waist and the companionway left clear
    deck: Object.freeze({
      floor: 5.8,
      start: Object.freeze([2.0, 1.0]),
      models: Object.freeze([
        m(41822, -9.5, 3.4),
        m(41818, -9.5, 3.4, 0, 0.78),
        m(41811, -7.6, 3.6),
        m(41827, 5.9, 3.3),
        m(41831, 7.2, 3.05),
        m(41832, -9.0, -6.0),
        m(41822, -7.4, -6.2),
        m(41818, 9.0, -5.6),
        m(41827, 10.3, -5.35),
        m(41822, 12.0, 1.8),
      ]),
    }),
  }),
  large: Object.freeze({
    block: 'SHIPAA01.RMB',
    index: 630,
    record: 0,
    storeys: Object.freeze({
      deck: Object.freeze({
        floor: 5.75,
        models: Object.freeze([
          // the great cabin, across the stern
          m(41000, -26.05, 8.35),
          m(41811, -24.75, 8.35, 90),
          m(41004, -21.1, 7.5, -90),
          m(41051, -27.5, -3.5, 90),
          m(41104, -26.8, -3.5, 90),
          m(41109, -24.2, -4.4),
          m(41100, -24.9, -5.55),
          m(41100, -23.5, -5.55),
          m(41100, -24.9, -3.25, 180),
          m(41100, -23.5, -3.25, 180),
          m(41030, -20.85, -3.0, -90),
          m(41030, -20.85, -4.6, -90),
          m(41812, -21.2, -6.0),
          // the officers' quarters: three berths along the hull, a table between
          ...[-18, -12, -6].flatMap((x) => [
            m(41001, x, 11.4),
            m(41811, x + 1.6, 11.4, 90),
            m(41003, x, 4.2),
            m(41103, x + 1.6, 9.6, 180),
          ]),
          m(41108, -3.5, 8),
          m(41102, -3.5, 7.0),
          m(41102, -3.5, 9.0, 180),
          // the crew's berths: bunks along the hull, a sea chest at each, and along the inner wall; Daggerfall's own
          // lantern hangs where a fifth hull berth would stand (11.2, 10.4), so none stands there
          ...[1.5, 4.2, 6.9, 9.6, 15.0, 17.7, 20.4, 23.1, 25.8, 28.5, 31.2, 33.9].flatMap((x) => [
            m(41002, x, 11.0),
            m(41812, x, 10.0),
          ]),
          ...[2.5, 5.2, 7.9, 10.6, 13.3, 16.0, 18.7, 21.4, 24.1].flatMap((x) => [
            m(41002, x, 4.45),
            m(41812, x, 5.55, 180),
          ]), // the door is at 27
          // the chart room
          m(41112, -16.3, -4.5),
          m(41101, -17.0, -3.55, 180),
          m(41101, -15.6, -3.55, 180),
          m(41118, -13.0, -6.5, -90),
          m(41030, -20.1, -4.5, 90),
          // the mess: two long tables and their benches, the cupboards
          ...[-6.5, 0.5].flatMap((x) => [
            m(41121, x, -5.0),
            m(41106, x - 0.95, -5.85),
            m(41106, x + 0.95, -5.85),
            m(41106, x - 0.95, -4.15, 180),
            m(41106, x + 0.95, -4.15, 180),
          ]),
          m(41032, -11.85, -7.0, 90),
          m(41032, -11.85, -2.5, 90),
          // the galley's stores and its worktop
          m(41027, 6.65, -6.5, 90),
          m(41027, 6.65, -3.0, 90),
          m(41116, 12.0, -7.8),
          m(41822, 16.0, -7.6),
          m(41818, 16.0, -7.6, 0, 0.78),
          m(41827, 17.4, -7.7),
          // the arms locker, its wardrobes either side of Daggerfall's own lantern (25.6, -7.2)
          m(41003, 24.0, -7.65),
          m(41003, 26.9, -7.65),
          m(41003, 29.0, -7.65),
          m(41813, 30.6, -7.6),
          m(41813, 31.6, -7.6),
          m(41108, 26.0, -3.0),
          // the sail locker in the bow
          m(41832, 41.5, 6.0),
          m(41827, 41.5, 4.4),
          m(41832, 41.5, -3.5),
          m(41818, 40.0, -4.3),
        ]),
        flats: Object.freeze([
          f(208, 0, -26.8, 1.0),
          f(208, 4, -27.0, 5.0),
          f(210, 3, -24.6, -4.4, 0.82),
          f(210, 3, -23.6, -4.4, 0.82),
          f(200, 1, -24.1, -4.2, 0.82),
          f(208, 0, -19.35, -7.6),
          f(208, 4, -13.2, -7.8),
          f(208, 6, -16.6, -4.5, 0.66),
          f(210, 3, -15.9, -4.5, 0.66),
          f(210, 3, -7.2, -5.0, 0.77),
          f(210, 3, -5.8, -5.0, 0.77),
          f(210, 3, -0.2, -5.0, 0.77),
          f(210, 3, 1.2, -5.0, 0.77),
          f(200, 1, -6.5, -4.8, 0.77),
          f(200, 1, 0.5, -4.8, 0.77),
          f(205, 0, -11.4, -8.0),
          f(205, 0, 5.6, -8.0),
          f(205, 17, 9.0, -8.0),
          f(205, 19, 10.0, -7.9),
          f(205, 0, 19.5, -7.9),
          f(205, 0, 20.4, -7.6),
          f(205, 17, 38.5, 7.5),
          f(205, 19, 38.5, -5.0),
          f(210, 3, -3.5, 8.0, 0.77),
          lamp(-24.2, 2.0, 8.97),
          lamp(-24.2, 7.0, 8.97),
          lamp(-24.2, -3.0, 8.97),
          lamp(-15.0, 8.0, 8.97),
          lamp(-6.0, 8.0, 8.97),
          lamp(5.0, 8.0, 8.97),
          lamp(15.0, 8.0, 8.97),
          lamp(25.0, 8.0, 8.97),
          lamp(33.0, 8.0, 8.97),
          lamp(-16.3, -4.5, 8.97),
          lamp(-6.5, -5.0, 8.97),
          lamp(0.5, -5.0, 8.97),
          lamp(12.0, -4.5, 8.97),
          lamp(22.0, -4.5, 8.97),
          lamp(31.0, -4.5, 8.97),
          lamp(40.0, 2.0, 8.97),
        ]),
      }),
      hold: Object.freeze({
        floor: 2.7,
        models: Object.freeze([
          m(41833, -6.0, 6.3),
          m(41833, 0.0, 6.3),
          m(41832, 3.0, 6.9),
          m(41822, 3.0, 6.9, 0, 1.3),
          m(41834, 16.0, 6.5),
          m(41834, 22.0, 6.5),
          m(41834, 28.0, 6.5),
          m(41832, 31.5, 6.9),
          m(41818, 33.0, 7.2),
          m(41833, 0.0, -3.0),
          m(41833, 6.0, -3.0),
          m(41832, 16.0, -3.6),
          m(41832, 18.0, -3.6),
          m(41822, 18.0, -3.6, 0, 1.3),
          m(41834, 24.0, -3.4),
          m(41813, 13.0, -2.5),
          m(41813, 14.0, -2.5),
          m(41813, 26.0, 4.8),
          m(41827, 36.0, 5.5),
          m(41827, 36.0, -2.0),
        ]),
        flats: Object.freeze([
          f(205, 0, 34.5, 4.0),
          f(205, 0, 35.3, 3.2),
          f(205, 0, 34.6, 2.4),
          f(205, 17, 9.0, -4.0),
          f(205, 17, 8.0, -4.4),
          f(205, 19, 20.2, 7.4),
          f(205, 20, -4.0, -2.4),
          f(205, 0, 40.5, 1.5),
          lamp(0.0, 1.5, 5.52),
          lamp(16.0, 5.0, 5.52),
          lamp(38.0, 1.5, 5.52),
        ]),
      }),
    }),
    deck: Object.freeze({
      floor: 10.6,
      start: Object.freeze([10.0, 2.0]),
      models: Object.freeze([
        m(41832, -12.0, 7.3),
        m(41822, -12.0, 7.3, 0, 1.3),
        m(41827, -10.5, 7.5),
        m(41834, 10.0, 7.0),
        m(41822, 20.0, 7.5),
        m(41818, 21.0, 7.6),
        m(41832, 34.0, 7.3),
        m(41811, 42.0, 7.5),
        m(41834, -8.0, -3.6),
        m(41822, 2.0, -3.8),
        m(41818, 3.1, -3.9),
        m(41832, 16.0, -3.5),
        m(41822, 16.0, -3.5, 0, 1.3),
        m(41827, 30.0, -3.7),
        m(41813, 40.0, -3.8),
      ]),
    }),
  }),
});

const yRotation = (face) => 0 - Math.round(face * ROTATION_DIVISOR); // never -0
const flatHeight = (archive, record) => {
  const k = `${archive}_${record}`;
  if (CANDLE_M[k] != null) return CANDLE_M[k];
  const px = REFIT_FLAT_PX[k];
  if (px == null) throw new Error(`ship refit: no size for flat ${k}`);
  return px * U;
};

/** A storey's pieces as RmbBlock3dObjectRecords and RmbBlockFlatObjectRecords (DFU's world-data JSON shape). */
export function refitRecords(storey) {
  const models = storey.models.map((p) => ({
    ModelId: String(p.id),
    ModelIdNum: p.id,
    ObjectType: PROP,
    XPos: Math.round(p.x / U),
    YPos: Math.round((storey.floor + p.lift) / U),
    ZPos: Math.round(p.z / U),
    XRotation: 0,
    YRotation: yRotation(p.face),
    ZRotation: 0,
  }));
  const flats = storey.flats.map((p) => {
    const h = flatHeight(p.archive, p.record);
    const y = p.hang != null ? p.hang - h / 2 : storey.floor + p.on + h / 2;
    return {
      Position: 0,
      XPos: Math.round(p.x / U),
      YPos: Math.round(-y / U),
      ZPos: Math.round(p.z / U),
      TextureArchive: p.archive,
      TextureRecord: p.record,
      FactionID: 0,
      Flags: 0,
    };
  });
  return { models, flats };
}

/** The open deck's pieces as exterior RmbBlock3dObjectRecords: the origin is stood at YPos, so the foot is lifted to the
 *  deck. */
export function refitDeckRecords(deck) {
  return deck.models.map((p) => {
    const foot = REFIT_MODEL_FOOT[p.id];
    if (foot == null) throw new Error(`ship refit: no foot for deck model ${p.id}`);
    return {
      ModelId: String(p.id),
      ModelIdNum: p.id,
      ObjectType: PROP,
      XPos: Math.round(p.x / U),
      YPos: Math.round(-(deck.floor + p.lift + foot) / U),
      ZPos: Math.round(p.z / U),
      XRotation: 0,
      YRotation: yRotation(p.face),
      ZRotation: 0,
    };
  });
}

/** The ship's building file: the player's own classic record, the refit's pieces appended to its interior and deck. */
export function shipRefitJson(blocksFile, ship) {
  const got = blocksFile.getBlockName(ship.index);
  if (got !== ship.block)
    throw new Error(`ship refit: wants ${ship.block} at block ${ship.index}, BLOCKS.BSA has ${got}`);
  const json = buildingToDfuJson(blocksFile.readClassicBlock(ship.index), ship.record);
  const interior = json.RmbSubRecord.Interior;
  for (const storey of Object.values(ship.storeys)) {
    const { models, flats } = refitRecords(storey);
    interior.Block3dObjectRecords.push(...models);
    interior.BlockFlatObjectRecords.push(...flats);
  }
  interior.Header.Num3dObjectRecords = interior.Block3dObjectRecords.length;
  interior.Header.NumFlatObjectRecords = interior.BlockFlatObjectRecords.length;
  const exterior = json.RmbSubRecord.Exterior;
  exterior.Block3dObjectRecords.push(...refitDeckRecords(ship.deck));
  exterior.Header.Num3dObjectRecords = exterior.Block3dObjectRecords.length;
  return json;
}

/** Both ships' building files onto the world-data door, built from the bound BLOCKS.BSA. Answers how many landed. */
export function installShipRefit(blocksFile) {
  if (!blocksFile) return 0;
  let n = 0;
  for (const ship of Object.values(SHIP_REFIT)) {
    try {
      if (
        registerPortBuilding(
          buildingReplacementFilename(ship.block, ship.index, ship.record),
          shipRefitJson(blocksFile, ship),
        )
      )
        n++;
    } catch (e) {
      console.error(`[worlddata] ${e?.message ?? e} - that ship stands as Daggerfall built it`);
    }
  }
  return n;
}
