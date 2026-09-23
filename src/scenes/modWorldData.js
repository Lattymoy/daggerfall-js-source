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
import { registerWorldDataAsset, installWorldDataReplacement } from '../formats/worldDataReplacement.js';
import { modSetting } from '../systems/modSettings.js';

// The glob sits INSIDE the loader (Vite rewrites it wherever it stands),
// so a node test that imports a host reaching this module does not trip
// on the macro - only a call would, and node never calls it.
const globFiles = () => import.meta.glob('../../vendor/*/WorldData/*.json', { import: 'default' });
const vendorOf = (path) => /vendor\/([^/]+)\/WorldData\//.exec(path)?.[1] ?? '';
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
    return n;
  })();
  return _loaded;
}
