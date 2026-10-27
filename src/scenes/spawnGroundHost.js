// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { createSpawnGroundPlace } from '../world/spawnGroundPlace.js';
import { cyrodiilMask } from '../systems/wild/cyrodiilZone.js';
import { getWorldClimateSettings, REGION_NAMES } from '../formats/mapsFile.js';
import { inEtherLaw } from '../world/ethericSea.js';
import { isEliteSpawn, pickTemplate, spawnsDungeon, spawnTemplates, synthesizeDungeonLocation } from '../world/spawnedDungeons.js';
import { isMainStoryDungeon } from '../world/dungeon/dungeonTextures.js';

/** @param {any} host */
export function createSpawnGroundHost(host) {
  const {
    _insideSpawn, _spawnGround, _spawnLedger, _spawnSalt, etherSea, locationIndex, maps, params, terrainGen, provinceQuestPlaces
  } = host;
  /** AUDIT OW4 D4: THE CLONE a pixel's spawn IS - the template its hash picks, dressed as where it stands (region, politic,
   *  climate, elite). Pure in the salt, the pixel and the map files, so the one answer serves spawnedDungeonAt (which stands
   *  it) and the Overworld's far found spawns (tvSpawnAt, which marks it without building its pixel). */
  function _spawnCloneAt(px, py) {
    host._spawnTemplates ??= spawnTemplates(locationIndex.values(), isMainStoryDungeon);
    const template = pickTemplate(host._spawnTemplates, _spawnSalt, px, py);
    if (!template) return null;
    const regionIndex = maps.getRegionIndexAt(px, py);
    return synthesizeDungeonLocation(template, { salt: _spawnSalt, px, py, where: {
      regionIndex, regionName: REGION_NAMES[regionIndex], politic: maps.getPoliticIndex(px, py), climate: getWorldClimateSettings(maps.getClimateIndex(px, py)),
    }, elite: isEliteSpawn(_spawnSalt, px, py) });   // ELITE: the same hash on every client
  }
  /** AUDIT OW4 D2: HAS A SPAWN'S TIME RUN OUT - the spawned feature's own test (spawnedDungeonAt's: the ledger's two
   *  clocks, never while the player is in it), asked NOW: the index lets an expired spawn go only when its pixel next
   *  builds, and until then its plate stood and its walk went. AUDIT OW5b D2: gone FROM THE GROUND - one standing on built
   *  ground stands until that ground is next built (_locationToBuild takes it out then), and its plate stands with it.
   *  FIELD BUGS 29h (SPAWN-PLATE; the Discord: "Elite Dungeons that despawn stay on map ... no entrance anymore but are
   *  still marked"): standing on the ground is the BUILD's word - whether the pixel stood a location, never that it is
   *  built. A pixel built after the clock ran out is built EMPTY, and read as built it kept its found plate (the store
   *  files a spawn for good) and its walk to bare grass whenever the traveller came within the grid.
   *  AUDIT SPAWN-REBIRTH F2: and the build's word BOTH WAYS - a pixel built empty while its spawn was dead stands none
   *  until it is built again, though the spawn has stood again since (its time over, `expired` answers false: the plate
   *  and the walk came back over the same bare grass, 29h's report the other way round); off the built ground, the clocks. */
  const tvSpawnGone = (x, y) => { const key = `${x},${y}`; if (_insideSpawn(key)) return false; const b = host.built.get(key); return b ? b.location == null : _spawnLedger.expired(key, host._spawnClock()); };
  /** GROUND-AGREE: the spawn law the Overworld and the ground share (world/spawnGroundPlace.js) - the gates it reads, handed in. */
  const spawnGroundPlace = createSpawnGroundPlace({
    maps,
    online: params.has('online'),
    etherSea,
    plateauDry: _spawnGround,
    terrainGen,
    cloneAt: _spawnCloneAt,
    spawnGone: tvSpawnGone,
    zoneMask: cyrodiilMask,   // AUDIT RELEASE R3-7: the open zone Cyrodiil's (WW-C2), as spawnedDungeonAt reads it
    placeAt: (x, y) => !!provinceQuestPlaces?.placeOnPixel(x, y),   // SPAWN-WORLD: past the Bay a place stands first (scenes/tamrielPlacesHost.js)
  });
  /** AUDIT OW4 D4: WHAT spawnedDungeonAt WOULD STAND on a pixel it has not built - its own gates (the sea, a path across
   *  the pixel, the clocks; the roll and the page are asked by the caller) and its clone, with none of its writes (the
   *  index, the roads' provisional keys): a far found spawn is marked, never built. */
  const tvSpawnAt = spawnGroundPlace.spawnAt;
  /** AUDIT OW5b D3: WHAT STANDS ON A PIXEL, built or not - the index's place, else the spawn its roll would stand (online,
   *  side-effect free: tvSpawnAt). A member walking to the leader's spawn read the index alone, and a far spawn their own
   *  pixels had never built was a bare spot to them. */
  const tvLocationAt = (x, y) => locationIndex.get(`${x},${y}`) ?? (params.has('online') && !inEtherLaw(x, y) && spawnsDungeon(_spawnSalt, x, y) ? tvSpawnAt(x, y) : null);   // ETHER-PLACES: no spawn past the Veil - the isles stand their own
  /** AUDIT LANDFORMS B1: landformLiftAt's pixels not built yet - what the build will stand there: the index's place, else
   *  online the spawn its roll stands (GROUND-AGREE: alive or dead - its ground is the roll's), read here without taking
   *  anything out of the index. AUDIT LANDFORMS II F1: declared here, beside the build's own answer, so it is the
   *  whole answer before anything can ask it. It was bound beside the Overworld's probes, far below the boot's load
   *  (`await worldQuickLoad({ ...bootLoadPick, snap })`) - online the only load - so that load stood a spawn's records on
   *  the wild lift and every later save wrote them on the spawn's: a camp at a spawned dungeon drifted by up to 24 m a
   *  session (the Citadel of Copperton), and a camp is never stood again. */
  const _liftLocationAt = (x, y) => spawnGroundPlace.groundLocationAt(x, y, locationIndex.get(`${x},${y}`));
  return { _liftLocationAt, _spawnCloneAt, spawnGroundPlace, tvLocationAt, tvSpawnAt, tvSpawnGone };
}
