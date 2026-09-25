// THE MOD WORLD-DATA LOADER (RR3b) - a vendored mod's WorldData/*.json
// into the world-data door (formats/worldDataReplacement.js), the way
// ModManager hands DFU's WorldDataReplacement a mod's TextAssets. Vite's
// glob turns each file into a lazy chunk (the fort's block is 230 KB);
// loadModWorldData() reads them ALL once, before the first region loads,
// so the readers' synchronous asks find them - the C# reads files off
// disk on demand; the port fronts one await, as the quest pack does.
//
// BROWSER-ONLY: import.meta.glob is a Vite compile-time macro - node
// tests register their JSON on the door from fs.
import { registerWorldDataAsset, installWorldDataReplacement, boundWorldDataBlocks } from '../formats/worldDataReplacement.js';
import { rebuildWorldDataPatch, canonicalSha256 } from '../formats/worldDataPatch.js';
import { modSetting } from '../systems/modSettings.js';

// The glob sits INSIDE the loader (Vite rewrites it wherever it stands),
// so a node test that imports a host reaching this module does not trip
// on the macro - only a call would, and node never calls it.
const globFiles = () => import.meta.glob('../../vendor/*/WorldData/*.json', { import: 'default' });
// WD1: a mod whose world data is a whole classic block with its edits in it
// ships the edit only (formats/worldDataPatch.js); rebuilt here from the
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
    return n;
  })();
  return _loaded;
}

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
