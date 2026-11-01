// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { CLIMATES } from '../formats/mapsFile.js';
import { cyrodiilMask } from '../systems/wild/cyrodiilZone.js';
import { inEther } from '../world/ethericSea.js';
import { inBay as onTheBay } from '../world/tamriel/tamrielFrame.js';
import { pathFreePixel, spawnsDungeon } from '../world/spawnedDungeons.js';
import { settlementOnPixel } from '../world/settlement/settlementPlaces.js';   // a settlement's pixel
import { wildInside } from '../systems/wild/wildZone.js';

/** @param {any} host */
export function createSpawnStand(host) {
  const {
    _arenaTemplates, _capitalBase, _countryTemplates, _insideSpawn, _spawnGround, _spawnLedger, _spawnSalt,
    _spawnUnroaded, etherPlaceAt, etherSea, locationIndex, maps, params, terrainGen, zoneHalls
  } = host;
  const spawnedDungeonAt = (px, py) => {
    if (!params.has('online')) return null;
    try {
      { const _wm = cyrodiilMask(); if (_wm && wildInside(_wm, px, py)) return zoneHalls.standOf(_wm, px, py); }   // BOOT-TDZ2: the stand over the mask just read, never the session's (declared far below this build)   // PVPDUNGEONS: the spawner is excluded in the zone - only the tier rules stand halls there (the day's hall on this pixel, or nothing)
      if (!spawnsDungeon(_spawnSalt, px, py) || maps.getClimateIndex(px, py) === CLIMATES.Ocean || !_spawnGround(px, py)) return null;
      // SPAWN-ROADS (2026-09-25, Mac: "Anyway to have things avoid being on a road?"): no ruin on a pixel a road,
      // track, river or stream crosses (spawnedDungeons.js pathFreePixel). Online the network is the room's (the
      // lane forces Basic Roads, onlineLane.js ONLINE_ROOM_MOD_KEYS), so every client asks the same bytes. Asked
      // BEFORE the network lands, the answer is PROVISIONAL: the ruin stands for now and its key is kept, and the
      // roads sweep (sweepRoadless) takes back every provisional one a path crosses before it rebuilds the pixels.
      const net = terrainGen.roads();
      if (net && !pathFreePixel(net, px, py)) return null;
      // SPAWN-WORLD: past the Bay never on a place - a capital, an Arena place, the countryside's or a lair stands first
      // (_locationToBuild asks them first; the ground's law asks the same, world/spawnGroundPlace.js placeAt)
      if (!onTheBay(px, py) && host.provinceQuestPlaces?.placeOnPixel(px, py)) return null;
      // TTL1: ...AND NOT WHILE THE PLAYER IS IN IT. The creator's rule
      // says so twice ("when there is no player in it"), and this is
      // where it is kept: a pixel is only rebuilt from the overworld, so
      // the one dungeon that could be underfoot is the one the mode
      // machine is standing in. Its time runs out the moment they leave.
      const key = `${px},${py}`;
      // AUDIT OW5b D2: GONE IS GONE - the ledger's row is KEPT (its clocks keep it expired as the calendar goes on, and it
      // rides the save), so the pixel stays empty. It was forgotten here, and the roll is a pure hash of the pixel: the
      // very next ask - the build's own, a moment after buildPixel's probe had asked - stood the same dungeon again on a
      // fresh seven days. "Spawned Dungeons should expire/removed" (TTL1, the creator's rule relayed by Mac)
      // SPAWN-REBIRTH: gone until it stands again - REBIRTH_TTL_DAYS after it died the row is of a life that is over,
      // `expired` answers false, and the same dungeon stands here with no clock running until a player enters it
      if (_spawnLedger.expired(key, host._spawnClock()) && !_insideSpawn(key)) {
        host._locIndexGen += 1;   // AUDIT OW4 D5
        locationIndex.delete(key);
        return null;
      }
      const loc = host._spawnCloneAt(px, py);
      if (!loc) return null;
      host._locIndexGen += 1;   // AUDIT OW4 D5
      locationIndex.set(key, loc);
      if (!net) _spawnUnroaded.add(key);   // SPAWN-ROADS: decided without the network - the sweep asks again
      // SPAWN-REBIRTH: standing it starts NO clock - the seven days start when a player enters it (onDungeonSpawned).
      // A first sight here started them for every spawn within the terrain distance of a road walked, entered or not
      return loc;
    } catch (e) { console.warn('[spawned dungeons]', px, py, e?.message ?? e); return null; }
  };
  /** AUDIT OW5b D2: WHAT STANDS ON A PIXEL BEING BUILT - its place in the index, unless that is a spawn whose time has run
   *  out with nobody in it: then it leaves the index and the pixel is built empty; else what spawnedDungeonAt stands. The
   *  build took the index's word for a spawn it held, so one stood again at every rebuild whatever its clocks said, while
   *  the Overworld (tvSpawnGone) had it gone. */
  function _locationToBuild(px, py) {
    if (etherSea && inEther(px, py)) return etherPlaceAt(px, py);   // ETHER-PLACES: an isle's place, or the open sea's none
    if ((_arenaTemplates || _countryTemplates || _capitalBase) && !onTheBay(px, py)) return (locationIndex.get(`${px},${py}`)?.superTier ? locationIndex.get(`${px},${py}`) : null) || (params.has('online') && zoneHalls.standIn(cyrodiilMask(), px, py)) || host.capitalLocationAt(px, py) || (_arenaTemplates && host.arenaLocationAt(px, py)) || host.countryLocationAt(px, py) || host.lairLocationAt(px, py) || spawnPastBayAt(px, py);   // WW5: a province's Hollow first, as its lane stands it in the index (scenes/superDungeon/sdLanes.js - the scan keeps every place off its pixel); AUDIT TESA II P1: the open zone's hall today (Cyrodiil's, past the Bay - it stood in the Bay's arm alone, never reached here); TESA10: a capital; TESA2: Arena's; TESA7-8: the land's
    const key = `${px},${py}`;
    const loc = locationIndex.get(key);
    if (loc?.spawned && !loc.wildHall && _spawnLedger.expired(key, host._spawnClock()) && !_insideSpawn(key)) {   // AUDIT SPAWN-REBIRTH F6: a hall's day is its own
      host._locIndexGen += 1;   // AUDIT OW4 D5
      locationIndex.delete(key);
      return null;
    }
    return loc || spawnedDungeonAt(px, py);
  }
  /** SPAWN-WORLD (2026-10-26, the audit NO SYSTEM LEFT BEHIND IN THE BAY A3): WHAT THE SPAWNER STANDS ON A PIXEL PAST THE
   *  BAY that no place takes - the Bay's own law: the spawn the index holds, unless its clocks have run out with nobody in
   *  it (out of the index, the pixel empty - the row kept, AUDIT OW5b D2), else what spawnedDungeonAt stands. One stood
   *  before its region's roads landed (TESA14: a region's layer at a time) that a road crosses now is taken back as the
   *  Bay's roads sweep takes one back (_dropRoadedSpawns: the index and its clocks), unless the player stands in it - the
   *  layer's landing builds the pixels it reaches again (scenes/tamrielSweepsHost.js arenaRoadsLanded). */
  function spawnPastBayAt(px, py) {
    if (settlementOnPixel(px, py)) return null;   // a settlement keeps its pixel from the spawn roll
    const key = `${px},${py}`;
    const loc = locationIndex.get(key);
    if (!loc?.spawned || loc.wildHall) return spawnedDungeonAt(px, py);
    if (_insideSpawn(key)) return loc;
    const net = terrainGen.roads(), roaded = !!net && !pathFreePixel(net, px, py);
    if (!roaded && !_spawnLedger.expired(key, host._spawnClock())) return loc;
    host._locIndexGen += 1;   // AUDIT OW4 D5
    locationIndex.delete(key);
    if (roaded) _spawnLedger.forget(key);
    return null;
  }
  return { _locationToBuild };
}
