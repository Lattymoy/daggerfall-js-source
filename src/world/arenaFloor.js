// @ts-check
// ARENA2 (2026-10-02, Mac: "Players can choose to watch AI fights ... and climb esclating tiers of opponents"): THE
// FLOOR'S INSTANCE - the colosseum stood on its own as a made level, so a ladder bout (or an exhibition watched from
// the stands) is fought on a floor of its own, never in the city's street. Design: bible/11-Multiplayer/Arena.md
// "2. The fights" ("An instance of the floor").
//
// NOT A FIFTH HOST - the Burning Court's law (world/gateArena.js): a made DUNGEON level, entered and left through the
// dungeon host's own arm (scenes/worldModes.js enterArenaFloor):
//   - A MADE LOCATION (`arenaFloorLocation`): one starting block, the city's region and climate, `arenaFloor` the
//     bout's kind ('ladder', 'watch') - which the rest, the save, the map and the way out read.
//   - A MADE BLOCK (`arenaFloorBlock`): ARENADAG.RMB's own contents moved into a dungeon block - the colosseum (864102,
//     world/arenaModel.js, registered by world/arenaCity.js), Kamer's tiers, beams, barrels and braziers as models,
//     his torches and braziers as flats AND as the dungeon's lights - and the start marker where the player arrives:
//     on the sand at their mark for a ladder bout, on the lower terrace for one watched. The gate's people and the
//     undercroft's stair are the city's and stay there.
//   - THE BLOCKS FILE (`arenaFloorBlocks`): the real one answering one more name, as the court's does.
//
// THE FRAME. An RMB's misc model stands at (X, -Y - 4, Z + 4096) x GLOBAL_SCALE in its block (world/rmbLayout.js); a
// dungeon model at (x, -y, z) x GLOBAL_SCALE (world/rdbLayout.js getModelMatrix) - so the block is carried over with
// y + 4 and z + 4096 and every piece keeps its place against every other. The colosseum's sand is its model's floor
// (y -4.68 in its own frame, measured off the mesh - a disc about 19.5 m round), so the FLOOR CENTRE below is where
// the RMB's colosseum stands with that taken off. The ring (the motor's clamp, the bout's ring-out) is a disc on it.
//
// Not a DFU member. Ledger A (ARENA).

import ARENA_BLOCK_JSON from '../../vendor/daggerfall-arena/Arena/ARENADAG.RMB.json' with { type: 'json' };
import { ARENA_MODEL_ID } from './arenaModel.js';
import { GLOBAL_SCALE } from './meshReader.js';

/** The made block's name and the index its blocks file answers (the court's is 900000, the city's arena block
 *  900100). */
export const ARENA_FLOOR_BLOCK = 'ARENAFLR.RDB';
export const ARENA_FLOOR_BLOCK_INDEX = 900101;
/** The made location's record id - beside the court's (0x7ffff000), no classic location's. */
export const ARENA_FLOOR_LOCATION_ID = 0x7ffff100;
/** RMB_DIMENSION (formats/blocksFile.js) - an RMB block's side in its units. */
const RMB_SIDE = 4096;
/** world/rmbLayout.js PROPS_OFFSET_Y and world/rmbFlats.js BLOCK_FLATS_OFFSET_Y. */
const PROPS_Y = -4, FLATS_Y = -6;
/** The colosseum's sand, in its own model frame (measured off Models/864102: the floor's triangles under its origin). */
export const SAND_Y_MODEL = -4.68;
/** The sand's disc: its radius, metres (measured: the floor holds at 19 m from the centre every way round). */
export const SAND_R = 19.2;
/** THE RING on the sand: the motor's clamp (the player never leaves it) and the bout's line - past it is fleeing,
 *  past it by the slack (systems/arenaBout.js RING_SLACK_M) is out. */
export const RING_R = 14;
/** The lower terrace (the colosseum's podium walk round the sand), above the sand, metres - where a watcher arrives. */
export const TERRACE_UP = 6.9;
/** Seats: the band of the tiers a spectator stands on (above the sand, metres), and the radii they are sought in. */
export const SEAT_UP_MIN = 5;
export const SEAT_UP_MAX = 14.5;
export const SEAT_R_MIN = 20.6;
export const SEAT_R_MAX = 37;
/** The flats' half heights (TEXTURE.210, measured): an RDB flat stands at its centre, an RMB flat on its base. */
const FLAT_HALF_H = Object.freeze({ '210:15': 0.95, '210:17': 0.62, '210:19': 1.17, '210:27': 0.48 });
/** A light flat's light: its radius in classic units (a dungeon light's range is radius x GLOBAL_SCALE x 3 -
 *  world/dungeonLights.js) - the braziers the brightest. */
const FLAT_LIGHT_R = Object.freeze({ '210:15': 160, '210:17': 150, '210:19': 260, '210:27': 170 });

/**
 * ARENA5: THE BANNERS' HANGINGS (Arena.md 3: a team gives "its colours on your ladder bouts (your banners on your side of
 * the floor, ...)"; the ARENA3 record left them waiting on "hangings the floor's instance does not stand").
 *
 * DAGGERFALL'S BANNERS ARE MODELS, NOT FLATS. No flat archive of TEXTURE.175-216 holds a banner, a flag or a tapestry;
 * they are ARCH3D's tapestry run, 42500..42571 (DFU's RDBLayout minTapestryID..maxTapestryID - world/rdbLayout.js
 * MIN_TAPESTRY_ID: collider-free cloth). Kamer hung twenty of them on the tiers' rail round the sand, every one facing it
 * (42512, 42513, 42514 - World of Daggerfall's own catalogue calls 42512 "Flag" and 42514 "Flower Banner Long",
 * vendor/world-of-daggerfall/Scripts/LocationHelper.cs; the bundle survey's "seating tiers" misread them) and one over
 * the south box (42548). So the banners of a bout hang at HIS hang points: every one of his ring on a bannered side's half
 * of the floor (past HANG_HALF_M of the middle line, either way along the floor's long axis - side 0 west, side 1 east,
 * systems/arenaFighters.js boutMarks) is taken down and that banner's own cloth hung in its place, turned as his was; the
 * banners over the middle line and the box stay his.
 *
 * WHICH CLOTH. The Blue's is 42558, the one classic banner a peer's catalogue names by its colour ("Banner_Blue_Large",
 * the same LocationHelper.cs). No catalogue in the tree names a red one; the Red's is 42557, the large banner beside it in
 * ARCH3D's run (hung as wall cloth in a Roleplay & Realism interior, vendor/roleplay-realism/WorldData), so the two banners
 * hang the same size and shape and differ in colour - recorded to be looked at by eye: a classic record that does not read
 * red is one number here to change.
 */
export const KAMER_BANNERS = Object.freeze([42512, 42513, 42514]);
export const ARENA_BANNER_MODEL = Object.freeze({ red: 42557, blue: 42558 });
/** A ring banner this far or more from the floor's middle line (metres, along its long axis) is its side's to hang. */
export const HANG_HALF_M = 6;

const colosseumRecord = (block = ARENA_BLOCK_JSON) => block.RmbBlock.Misc3dObjectRecords.find((o) => Number(o.ModelIdNum) === ARENA_MODEL_ID);
/** THE FLOOR CENTRE in the made level's frame (metres): the colosseum's place with its sand taken off. */
export function floorCentre(block = ARENA_BLOCK_JSON) {
  const c = colosseumRecord(block);
  return Object.freeze([c.XPos * GLOBAL_SCALE, (-c.YPos + PROPS_Y) * GLOBAL_SCALE + SAND_Y_MODEL, (c.ZPos + RMB_SIDE) * GLOBAL_SCALE]);
}
/** THE FLOOR CENTRE in the CITY block's own frame (the same numbers: the RMB's misc models stand in that frame) - the
 *  world host adds its block's origin (scenes/world.js). */
export const cityFloorCentre = floorCentre;

/** A point of the floor's frame ([x, z] from the centre, `up` metres over the sand) in the level's. */
export const floorPoint = (x, z, up = 0, c = floorCentre()) => [c[0] + x, c[1] + up, c[2] + z];

/** The ring the motor keeps a fighter inside (player/motor.js `arena`, the duel's shape). */
export const arenaRing = (c = floorCentre()) => ({ centre: [c[0], c[1], c[2]], radius: RING_R });

/** Where a player arrives: a ladder fighter on the sand at their mark (side 0's, west), a watcher on the lower
 *  terrace's south side looking north over the sand. `[x, z, up]` in the floor's frame and the yaw. */
export const ARRIVE = Object.freeze({
  ladder: Object.freeze({ at: Object.freeze([-6, 0, 0]), yaw: Math.PI / 2 }),
  // ARENA4: the second fighter of a bout between players, on side 1's mark (east), facing west at the first
  rival: Object.freeze({ at: Object.freeze([6, 0, 0]), yaw: -Math.PI / 2 }),
  watch: Object.freeze({ at: Object.freeze([0, -21.8, TERRACE_UP]), yaw: 0 }),
});
/** The ways out (the exit doors' places): the sand's north gate, and the terrace's south stair for a watcher -
 *  `[x, z, up]` and the way the door faces (into the floor). */
export const WAYS_OUT = Object.freeze([
  Object.freeze({ at: Object.freeze([0, 18.6, 0]), normal: Object.freeze([0, 0, -1]) }),
  Object.freeze({ at: Object.freeze([0, -23.4, TERRACE_UP]), normal: Object.freeze([0, 0, 1]) }),
]);
export const ARENA_EXIT_W = 3.2;
export const ARENA_EXIT_H = 3.6;

/**
 * THE MADE LOCATION for a bout of `kind` ('ladder', 'rival' - ARENA4's second fighter - or 'watch') at the city: the city's region, its climate, the map
 * table's row with map id 0 (no world room keys off it - ARENA4's bout rooms are `arena:<id>`).
 * @param {{ kind?: string, city?: any, bout?: string|null }} o
 */
export function arenaFloorLocation({ kind = 'ladder', city = null, bout = null } = {}) {
  return {
    name: 'The Arena of Daggerfall', regionIndex: city?.regionIndex ?? 17, regionName: city?.regionName ?? 'Daggerfall', locationIndex: -1, hasDungeon: true,
    climate: { worldClimate: city?.climate?.worldClimate ?? 227, climateType: city?.climate?.climateType ?? 2 },
    mapTableData: { mapId: 0, locationType: -1, dungeonType: 0, longitude: 0, latitude: 0 },
    exterior: { exteriorData: { locationId: ARENA_FLOOR_LOCATION_ID } },
    dungeon: {
      recordElement: { header: { locationId: ARENA_FLOOR_LOCATION_ID, unknown: 0 } },
      blocks: [{ x: 0, z: 0, blockName: ARENA_FLOOR_BLOCK, isStartingBlock: true, blockIndex: 0, blockNumber: 0, blockNumberStartIndexBitfield: 0 }],
    },
    arenaFloor: kind,
    // ARENA4: the relay's bout this instance stands (`arena:b<id>` - its room), null for a bout of this screen's alone
    ...(bout ? { arenaBout: bout } : {}),
  };
}
/** Is this location the floor's instance? */
export const isArenaFloor = (loc) => typeof loc?.arenaFloor === 'string' && loc?.dungeon?.recordElement?.header?.locationId === ARENA_FLOOR_LOCATION_ID;

const action0 = () => ({ flags: 0, nextObjectOffset: -1, previousObjectOffset: -1, axis: 0, duration: 0, magnitude: 0 });
const NO_MODEL = { xRotation: 0, yRotation: 0, zRotation: 0, modelIndex: 0, triggerFlagStartingLock: 0, soundIndex: 0, actionOffset: 0 };
const NO_FLAT = { position: 0, textureBitfield: 0, textureArchive: 0, textureRecord: 0, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: -1, action: 0 };
const res = (o = {}) => ({ modelResource: { ...NO_MODEL, actionResource: action0() }, flatResource: { ...NO_FLAT }, lightResource: { unknown1: 0, unknown2: 0, radius: 0 }, ...o });

/** ARENA5: the cloth a ring banner of Kamer's hangs for a bout - `banners` `{ west, east }` (scenes/arenaBouts.js
 *  floorBanners): its side's banner's (ARENA_BANNER_MODEL) when it hangs on a bannered half, else his own. Pure. */
export function hangingModel(o, banners, block = ARENA_BLOCK_JSON) {
  const id = Number(o.ModelIdNum);
  if (!banners || !KAMER_BANNERS.includes(id)) return id;
  const dx = (o.XPos - colosseumRecord(block).XPos) * GLOBAL_SCALE;
  const b = dx <= -HANG_HALF_M ? banners.west : dx >= HANG_HALF_M ? banners.east : null;
  return b === 'red' || b === 'blue' ? ARENA_BANNER_MODEL[b] : id;
}

/**
 * THE MADE BLOCK: ARENADAG.RMB's models, its light flats (each a flat and a light) and the start marker of `kind`, as
 * BlocksFile.getBlock hands an RDB over. Pure (the vendored block in). ARENA5: `banners` `{ west, east }` - the bout's
 * banners hung on their sides' halves (hangingModel); the block is made at each entry, so they follow the bout.
 */
export function arenaFloorBlock(kind = 'ladder', block = ARENA_BLOCK_JSON, banners = null) {
  const rmb = block.RmbBlock;
  /** @type {any[]} */
  const modelReferenceList = [];
  const refOf = new Map();
  const objects = [];
  let pos = 1;
  for (const o of rmb.Misc3dObjectRecords) {
    const id = hangingModel(o, banners, block);
    if (id === 43600) continue;   // the undercroft's stair is the city's
    if (!refOf.has(id)) { refOf.set(id, modelReferenceList.length); modelReferenceList.push({ modelId: String(id), modelIdNum: id, description: 'ARN' }); }
    objects.push({
      type: 0x01, position: pos++, index: objects.length, xPos: o.XPos, yPos: o.YPos - PROPS_Y, zPos: o.ZPos + RMB_SIDE,
      resources: res({ modelResource: { ...NO_MODEL, xRotation: o.XRotation | 0, yRotation: o.YRotation | 0, zRotation: o.ZRotation | 0, modelIndex: refOf.get(id), actionResource: action0() } }),
    });
  }
  for (const f of rmb.MiscFlatObjectRecords) {
    const key = `${f.TextureArchive}:${f.TextureRecord}`;
    if (f.TextureArchive !== 210) continue;   // the gate's people stand in the city (world/arenaCity.js); only the lights come in
    const half = FLAT_HALF_H[key] ?? 0.6;
    const base = (-f.YPos + FLATS_Y) * GLOBAL_SCALE, centre = base + half;
    const yPos = Math.round(-centre / GLOBAL_SCALE);
    objects.push({
      type: 0x03, position: pos++, index: objects.length, xPos: f.XPos, yPos, zPos: f.ZPos + RMB_SIDE,
      resources: res({ flatResource: { ...NO_FLAT, textureArchive: 210, textureRecord: f.TextureRecord } }),
    });
    objects.push({
      type: 0x02, position: pos++, index: objects.length, xPos: f.XPos, yPos: yPos - 20, zPos: f.ZPos + RMB_SIDE,
      resources: res({ lightResource: { unknown1: 0, unknown2: 0, radius: FLAT_LIGHT_R[key] ?? 160 } }),
    });
  }
  // the start marker (the editor flat 199.10): no water (soundIndex 0), no castle (magnitude 0)
  const arrive = ARRIVE[kind] ?? ARRIVE.ladder;
  const [mx, my, mz] = floorPoint(arrive.at[0], arrive.at[1], arrive.at[2] + 0.4, floorCentre(block));
  objects.push({
    type: 0x03, position: pos++, index: objects.length, xPos: Math.round(mx / GLOBAL_SCALE), yPos: Math.round(-my / GLOBAL_SCALE), zPos: Math.round(mz / GLOBAL_SCALE),
    resources: res({ flatResource: { ...NO_FLAT, textureArchive: 199, textureRecord: 10 } }),
  });
  return { name: ARENA_FLOOR_BLOCK, position: 0, rdbBlock: { modelReferenceList, objectRootList: [{ rdbObjects: objects }] } };
}

/** THE BLOCKS FILE the floor is laid from: the real one, answering one name more (world/gateArena.js gateArenaBlocks'
 *  law). */
export function arenaFloorBlocks(real, kind = 'ladder', banners = null) {
  const made = arenaFloorBlock(kind, ARENA_BLOCK_JSON, banners);   // ARENA5: the bout's banners hung
  return {
    getBlockIndex: (name) => (name === ARENA_FLOOR_BLOCK ? ARENA_FLOOR_BLOCK_INDEX : real ? real.getBlockIndex(name) : -1),
    getBlock: (i) => (i === ARENA_FLOOR_BLOCK_INDEX ? made : real ? real.getBlock(i) : null),
  };
}

/** THE WAYS OUT as exit doors (scenes/dungeonContext.js `exitDoors`' shape - world/gateArena.js courtExitDoor's): a
 *  body tall and a gate wide, facing into the floor. */
export function arenaExitDoors(c = floorCentre()) {
  return WAYS_OUT.map((w) => {
    const [x, y, z] = floorPoint(w.at[0], w.at[1], w.at[2], c);
    return {
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
      centre: { x: 0, y: ARENA_EXIT_H / 2, z: 0 }, size: { x: ARENA_EXIT_W, y: ARENA_EXIT_H, z: 1 },
      normal: { x: w.normal[0], y: w.normal[1], z: w.normal[2] },
      arena: true,
    };
  });
}

/**
 * THE SEATS: where a spectator can stand on the tiers round the sand - sampled on rings and arcs a body apart, each
 * kept where the ground under it (`heightAt(x, z)` in the floor's frame, the level's collider asked from above, or the
 * city's) stands SEAT_UP_MIN to SEAT_UP_MAX over the sand. `best` the seats over the sand's long sides near its
 * middle (the nobles' and courtiers'). Answers `[{ x, y, z, best }]` in the floor's frame (y over the sand). Pure.
 * @param {(x: number, z: number) => number|null} heightAt
 */
export function crowdSeats(heightAt, { step = 1.15 } = {}) {
  const out = [];
  for (let r = SEAT_R_MIN; r <= SEAT_R_MAX; r += step) {
    const n = Math.max(8, Math.floor((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (r * 0.37);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = heightAt(x, z);
      if (!Number.isFinite(h)) continue;
      if (h < SEAT_UP_MIN || h > SEAT_UP_MAX) continue;
      const best = Math.abs(Math.sin(a)) > 0.86 && r < SEAT_R_MIN + 6;
      out.push({ x, y: /** @type {number} */ (h), z, best });
    }
  }
  return out;
}
/** `n` of the seats, picked by the seed's die (a sold-out bout takes them all). Pure. */
export function pickSeats(seats, n, rng) {
  const a = seats.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.max(0, Math.min(a.length, n | 0)));
}
