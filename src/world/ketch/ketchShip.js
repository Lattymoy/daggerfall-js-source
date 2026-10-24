// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SKY-KETCH AS A MADE LEVEL - the Rourken ship a crew
// boards, the Shattered Hour's way (world/superDungeon/sdRealm.js): not a fifth host, the dungeon host with a level made
// in code -
//   - A MADE LOCATION (`ketchShipLocation`): one starting block, a name, a region, a climate - and `ketch`, the crew's
//     ship (its voyage, its captain's digest, its room's key), which the room's identity (scenes/worldModes.js
//     roomIdentity - kind 'kt'), the refusals and the way down read.
//   - AN EMPTY BLOCK (`ketchShipBlock`): a blocks file answering ONE extra name with a made block holding nothing but its
//     start marker, on the Anchor Deck where the anchor-lift sets a crew down - no model, no door, no foe marker, no water.
//   - THE SHIP ITSELF is world/ketch/ketchModel.js's, stood by scenes/ketch/ketchDeckHost.js.
//
// THE FRAME is the deck's (net/ketch/ketchDeck.js), moved into the dungeon's by the Hour's own translation (KT_ORIGIN).
// The sky is the world's own (the dungeon arm draws the exterior's sky over the ship - the arena floor's way, HOTFIX
// 1003l): the Ketch keeps station over Daggerfall at the hour it is there, in the weather it is in.
//
// Not a DFU member. Ledger A (KETCH).
import { KT_ARRIVE, deckToDungeon } from '../../net/ketch/ketchDeck.js';
import { ketchRoomKey } from '../../net/ketch/ketchLaw.js';
import { KT_WORDS } from '../../systems/ketch/ketchWords.js';

/** The made block's name and index, and the made location's id (the court's 0x7ffff000, the arena floor's 0x7ffff100, the
 *  Hour's 0x7ffff200, the Spire's 0x7ffff300). */
export const KT_SHIP_BLOCK = 'SKYKETCH.RDB';
export const KT_SHIP_BLOCK_INDEX = 900400;
export const KT_SHIP_LOCATION_ID = 0x7ffff400;
/** Classic units a metre (1 / MeshReader.GlobalScale). */
const UNITS_PER_M = 40;

/**
 * THE MADE LOCATION - what the dungeon host reads of a real one, and no more: a name, a region, a climate, the map table's
 * row (map id 0 - no world room keys off it; the ship's room is the relay's own `kt:<voyage>.<owner>`), the dungeon's
 * record and its one block. `ketch` the crew's ship: its voyage `n`, its captain's digest `owner`, its room's `key`.
 * @param {{ n: number, owner: string, regionIndex?: number, regionName?: string, climate?: { worldClimate: number, climateType: number } }} o
 */
export function ketchShipLocation({ n, owner, regionIndex = 17, regionName = 'Daggerfall', climate = { worldClimate: 231, climateType: 2 } }) {
  const key = ketchRoomKey(n, owner);
  return {
    name: KT_WORDS.name, regionIndex, regionName, locationIndex: -1, hasDungeon: true,
    climate: { worldClimate: climate.worldClimate, climateType: climate.climateType },
    mapTableData: { mapId: 0, locationType: -1, dungeonType: 0, longitude: 0, latitude: 0 },
    exterior: { exteriorData: { locationId: KT_SHIP_LOCATION_ID } },
    dungeon: {
      recordElement: { header: { locationId: KT_SHIP_LOCATION_ID, unknown: 0 } },
      blocks: [{ x: 0, z: 0, blockName: KT_SHIP_BLOCK, isStartingBlock: true, blockIndex: 0, blockNumber: 0, blockNumberStartIndexBitfield: 0 }],
    },
    ketch: key ? { n, owner, key } : null,
  };
}

/** Is this location a crew's ship (a made one, keyed by its room)? */
export const isKetchShip = (loc) => typeof loc?.ketch?.key === 'string' && loc?.dungeon?.recordElement?.header?.locationId === KT_SHIP_LOCATION_ID;

/** THE EMPTY BLOCK: an RDB block as BlocksFile.getBlock hands one over, holding its start marker where the anchor-lift
 *  sets a crew down and nothing else (its flat names no water - soundIndex 0 - and no castle - magnitude 0). */
export function ketchShipBlock() {
  const [x, , z] = deckToDungeon(KT_ARRIVE.x, KT_ARRIVE.y, KT_ARRIVE.z);
  const marker = {
    type: 0x03, position: 1, index: 0,
    xPos: Math.round(x * UNITS_PER_M), yPos: 0, zPos: Math.round(z * UNITS_PER_M),
    resources: { flatResource: { textureArchive: 199, textureRecord: 10, flags: 0, magnitude: 0, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: -1, action: 0, position: 0 } },
  };
  return { name: KT_SHIP_BLOCK, position: 0, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: [marker] }] } };
}

/** THE BLOCKS FILE THE SHIP IS LAID FROM: the real one, answering one name more. */
export function ketchShipBlocks(real) {
  const block = ketchShipBlock();
  return {
    getBlockIndex: (name) => (name === KT_SHIP_BLOCK ? KT_SHIP_BLOCK_INDEX : real ? real.getBlockIndex(name) : -1),
    getBlock: (i) => (i === KT_SHIP_BLOCK_INDEX ? block : real ? real.getBlock(i) : null),
  };
}

/** THE AIR AT THE KETCH'S HEIGHT BY DAY - a thin haze the sky's horizon meets (the deck's open air, never a dungeon's dark):
 *  the colour the sky leans to at its foot, exponential. KETCH-LOOK KL1: thinner (0.0028 before) - the city 800 m off
 *  keeps about a quarter of its contrast and the land darkens under her hull; the other hours' are world/ketch/
 *  ketchAtmos.js KT_HOURS'. */
export const KT_AIR_FOG = Object.freeze({ mode: 'exp', density: 0.0016, color: Object.freeze([0.62, 0.7, 0.8]) });
/** BELOW DECKS - the gun deck's and the hold's air: lamp-warm and close. KETCH-LOOK KL1: a warm haze the far end dissolves
 *  into ([0.1, 0.08, 0.05] before - a dark brown the hold's far end went black in). */
export const KT_BELOW_FOG = Object.freeze({ mode: 'exp', density: 0.012, color: Object.freeze([0.16, 0.12, 0.08]) });
/** The ambient light at the Ketch's height at noon and the sun's colour and share there - world/ketch/ketchAtmos.js
 *  KT_HOURS' day row (its night, its twilights and below decks are its own rows: KETCH-LOOK KL1). The share 0.8 (0.85
 *  before) and the sky's fill [0.52, 0.54, 0.58] ([0.56, 0.58, 0.62] before, KETCH-LOOK KL2): her steel deck's lit plate
 *  stood over the ladder's noon floor (p95 0.32, the rung 0.30) - the shade under her rails a little deeper for it. */
export const KT_LIGHT = Object.freeze({
  noon: Object.freeze([0.52, 0.54, 0.58]),
  sun: Object.freeze([1.0, 0.95, 0.84]), sunScale: 0.8,
});
