// THE MOD WORLD-DATA LOADER (RR3b) - a vendored mod's WorldData/*.json
// into the world-data door (formats/worldData/worldDataReplacement.js), the way
// ModManager hands DFU's WorldDataReplacement a mod's TextAssets. Vite's
// glob turns each file into a lazy chunk (a block can be hundreds of KB);
// loadModWorldData() reads them ALL once, before the first region loads,
// so the readers' synchronous asks find them - the C# reads files off
// disk on demand; the port fronts one await, as the quest pack does.
//
// BROWSER-ONLY: import.meta.glob is a Vite compile-time macro - node
// tests register their JSON on the door from fs.
import { registerWorldDataAsset, installWorldDataReplacement, boundWorldDataBlocks, latchWorldDataDoor, worldDataBlocksServing } from '../formats/worldData/worldDataReplacement.js';
import { rebuildWorldDataPatch, canonicalSha256 } from '../formats/worldData/worldDataPatch.js';
import { modSetting } from '../systems/modSettings.js';
import { configureLayoutPins } from '../systems/layoutPins.js';   // WD3: the layout a save's towns were made in
import { installTownStandIns } from '../world/townStandIns.js';   // WD3: the port's own pieces, a room's decor among them
import { installTownDress } from './townDressHost.js';   // TOWN-DRESS (OWN-WORK3): our market stall
import { installArena } from '../world/arena/arenaCity.js';   // ARENA1: the Arena of Daggerfall - the port's own block, the city's edit and the colosseum
import { installCapitals } from '../world/capitalModels.js';   // TESA10: the capitals' blocks, landmarks and pictures
import { installCuratedBlocks } from '../world/dungeon/curatedInstall.js';   // DELVE II (DLV5): the curated blocks
import { installTownOutline } from '../world/townOutline.js';   // TOWN-SHAPES TS3: the open cell a town past the Bay leaves
import { installUrbanArt } from '../world/urban/urbanArt.js';   // URBANIZER: the towns' own pictures - their streets' stone, their walls, the capitals' brick, half-timber and ashlar
import { installShipRefit } from '../world/shipRefit.js';   // the ships a player owns, furnished
import { installRoleplayRealismWorld } from '../systems/roleplayRealism/rrWorld.js';   // OWN-WORK3: the Master Armorer's keep and shop, our own
import { installImmersiveTravelGates } from '../world/immersiveTravelGates.js';   // IT1: the carriages at the gates
import { immersiveTravelLoaded } from '../systems/immersiveTravel.js';   // AUDIT IT1 G3: the mod loaded for the game
import { prefetchGroundTiles } from '../world/terrain/groundTilesKept.js';   // FIRST-VISIT
import { prefetchPortSites } from '../world/portSitesKept.js';   // FIRST-VISIT

// The glob sits INSIDE the loader (Vite rewrites it wherever it stands),
// so a node test that imports a host reaching this module does not trip
// on the macro - only a call would, and node never calls it.
const globFiles = () => import.meta.glob('../../vendor/*/WorldData/*.json', { import: 'default' });
// WD1: a mod whose world data is a whole classic block with its edits in it
// ships the edit only (formats/worldData/worldDataPatch.js); rebuilt here from the
// player's BLOCKS.BSA and registered under the file's own DFU name.
const globPatches = () => import.meta.glob('../../vendor/*/WorldDataPatches/*.json', { import: 'default' });
const vendorOf = (path) => /vendor\/([^/]+)\/WorldData(?:Patches)?\//.exec(path)?.[1] ?? '';
const baseName = (path) => path.split('/').pop();

let _loaded = null;
/** Every vendored mod's world-data file onto the door, gated on that mod's
 *  Enabled (a mod that is off is a mod DFU never loaded). Once. */
export async function loadModWorldData() {
  if (_loaded) return _loaded;
  _loaded = (async () => {
    installWorldDataReplacement();
    await installArena();   // ARENA1: behind no switch and no door - the arena stands in every layout (world/arena/arenaCity.js)
    installCapitals();   // TESA10: the same - the capitals' blocks and landmarks (world/capitalModels.js)
    installTownOutline();   // TOWN-SHAPES TS3: the same - the open cell of a town past the Bay (world/townOutline.js)
    installUrbanArt();   // URBANIZER: the same - the towns' own pictures (world/urban/urbanArt.js)
    installShipRefit(boundWorldDataBlocks());   // the ships' building files, built from your own BLOCKS.BSA (world/shipRefit.js)
    installCuratedBlocks();   // DELVE II (DLV5): the same - the curated blocks, each made of its base (world/dungeon/curatedInstall.js)
    latchWorldDataDoor();   // WD3 (AUDIT WD3 P2/P3): Replace Game Artwork (online, the room) read once for the game
    installTownDress();   // TOWN-DRESS (OWN-WORK3): behind no switch and no door - our market stall (scenes/townDressHost.js)
    installTownStandIns();   // OWN-WORK3: the port's own pieces a room's decor may stand, at every boot (world/townStandIns.js)
    let n = 0;
    await Promise.all(Object.entries(globFiles()).map(async ([path, load]) => {
      const vendor = vendorOf(path);
      const json = await load();
      if (registerWorldDataAsset(baseName(path), json, () => modSetting(vendor, 'Enabled') === true)) n++;
    }));
    await Promise.all(Object.entries(globPatches()).map(async ([path, load]) => {
      const vendor = vendorOf(path);
      if (await registerWorldDataPatch(await load(), () => modSetting(vendor, 'Enabled') === true)) n++;
    }));
    n += installRoleplayRealismWorld(boundWorldDataBlocks());   // OWN-WORK3: the Master Armorer's keep and shop, our own (systems/roleplayRealism/rrWorld.js)
    // IT1: the carriages at the gates, while Immersive Travel is loaded for the game (world/immersiveTravelGates.js).
    // AUDIT IT1 G3: asked of the mod LOADED FOR THE GAME (its Init's latch), never the switch as it stands. AUDIT IT1 G2:
    // guarded, in every host's load
    try { installImmersiveTravelGates(immersiveTravelLoaded); } catch (e) { console.error(`[worlddata] immersive travel's gate stand: ${e?.message ?? e}`); }
    // OWN-WORK3: no layout mod is loaded - Beautiful Villages and Beautiful Cities are retired, and every town stands as
    // Daggerfall lays it, dressed by our own law (world/townDress.js). A save's record stamped with their layout keeps
    // its stamp and sleeps (systems/layoutPins.js)
    configureLayoutPins({ vendorOn: () => false, vendorVersion: () => '' });
    // FIRST-VISIT: answers kept across launches, fetched before the world reads the towns the door serves - the boot
    // walks' ground tiles, for the door as it now serves (world/terrain/groundTilesKept.js), and the port towns' sites
    // (world/portSitesKept.js)
    await Promise.all([
      prefetchGroundTiles({ blocksBytes: boundWorldDataBlocks()?.bytes ?? null, serving: worldDataBlocksServing() }),
      prefetchPortSites(),
    ]);
    return n;
  })();
  return _loaded;
}

/** WD3, OWN-WORK3: a layout a save's pin asks for is never loaded - the town packs are retired, so no layout mod's pack
 *  is in the build. The pin is dropped and its records sleep (systems/layoutPins.js admitPinnedPacks). */
export async function ensureWorldDataPack(_vendor) { return false; }
/** WD3 (AUDIT WD3 B1): the packed mods switched on for this game whose packs did not load - none since OWN-WORK3. */
export const worldDataPacksMissing = () => [];

/**
 * WD1: one vendored patch onto the door - rebuilt from the bound BLOCKS.BSA,
 * checked against the author's file (its canonical sha256) and registered
 * under the file's DFU name. A rebuild that does not come back to the
 * author's bytes (a BLOCKS.BSA that is not the one the mod was made
 * against) is said and still served: it is the author's edit on the
 * player's own block, which is what the mod does to any block it meets.
 * A patch whose ops do not land is said and not served.
 * @returns {Promise<boolean>}
 */
export async function registerWorldDataPatch(patch, isOn) {
  const blocks = boundWorldDataBlocks();
  if (!blocks) { console.warn(`[worlddata] ${patch?.rebuilds}: no BLOCKS.BSA bound - patch not rebuilt`); return false; }
  let json;
  try { json = rebuildWorldDataPatch(patch, blocks); } catch (e) { console.error(`[worlddata] ${patch?.rebuilds}: ${e?.message ?? e}`); return false; }
  const sha = await canonicalSha256(json);
  if (sha !== patch.sha256) console.warn(`[worlddata] ${patch.rebuilds}: rebuilt from this BLOCKS.BSA, but not to the author's file (sha256 ${sha.slice(0, 12)}, the patch records ${String(patch.sha256).slice(0, 12)})`);
  return registerWorldDataAsset(patch.rebuilds, json, isOn);
}
