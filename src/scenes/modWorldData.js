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
import { registerWorldDataAsset, registerWorldDataPack, installWorldDataReplacement, boundWorldDataBlocks, quietLocationOverrides, latchWorldDataDoor, worldDataDoorOpen } from '../formats/worldDataReplacement.js';
import { rebuildWorldDataPatch, canonicalSha256 } from '../formats/worldDataPatch.js';
import { openWorldDataPack, packFileSha256, readPackText } from '../formats/worldDataPack.js';
import { modSetting, latchModLoaded, modLatchedOn } from '../systems/modSettings.js';
import { configureLayoutPins, vendorsPinnedIn } from '../systems/layoutPins.js';   // WD3: the layout a save's towns were made in
import { installTownStandIns } from '../world/townStandIns.js';   // WD3: the peer mods' pieces the town packs place, the port's own
import { installArena } from '../world/arenaCity.js';   // ARENA1: the Arena of Daggerfall - the port's own block, the city's edit and the colosseum

// The glob sits INSIDE the loader (Vite rewrites it wherever it stands),
// so a node test that imports a host reaching this module does not trip
// on the macro - only a call would, and node never calls it.
const globFiles = () => import.meta.glob('../../vendor/*/WorldData/*.json', { import: 'default' });
// WD1: a mod whose world data is a whole classic block with its edits in it
// ships the edit only (formats/worldDataPatch.js); rebuilt here from the
// player's BLOCKS.BSA and registered under the file's own DFU name.
const globPatches = () => import.meta.glob('../../vendor/*/WorldDataPatches/*.json', { import: 'default' });
// WD3: a mod whose world data is thousands of files ships ONE pack (formats/worldDataPack.js), gzipped, as a URL the
// build emits beside the bundle (never a JS chunk, never inlined) - fetched only when its mod is loaded for the game.
const globPacks = () => import.meta.glob('../../vendor/*/WorldDataPack/*.pack.json.gz', { eager: true, query: '?url', import: 'default' });
const vendorOf = (path) => /vendor\/([^/]+)\/WorldData(?:Patches|Pack)?\//.exec(path)?.[1] ?? '';
const baseName = (path) => path.split('/').pop();

/**
 * WD3: THE LOAD ORDER OF THE PACKED MODS - DFU's ModManager priority, higher loaded later and answering first
 * (ModManager.cs:404-427). Both of carademono's town mods ship FIGHBM00.RMB and the two differ; Beautiful Cities
 * (0.5.0, built for DFU 1.1.1) is the later of the two and loads after Beautiful Villages (1.4.2, DFU 1.0.0), as a
 * player who runs both orders them. Every WD1 vendor stands at 0, below them: none of their files share a name.
 */
export const WORLD_DATA_PRIORITY = Object.freeze({ 'beautiful-villages': 10, 'beautiful-cities': 20 });

let _loaded = null;
const _packs = new Map();   // vendor -> opened pack (loaded for the game, or for a save's pins)
/** Every vendored mod's world-data file onto the door, gated on that mod's
 *  Enabled (a mod that is off is a mod DFU never loaded). Once. */
export async function loadModWorldData() {
  if (_loaded) return _loaded;
  _loaded = (async () => {
    installWorldDataReplacement();
    await installArena();   // ARENA1: behind no switch and no door - the arena stands in every layout (world/arenaCity.js)
    const door = latchWorldDataDoor();   // WD3 (AUDIT WD3 P2/P3): Replace Game Artwork (online, the room) read once for the game
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
    // WD3: a packed mod is loaded for the game or not at all - its switch is read here, once, and latched, so a switch
    // flipped mid-game moves no town under the player's feet (the Features row: "Takes effect when the game is next started");
    // the layout pins stamp a save's records with what is loaded (systems/layoutPins.js)
    configureLayoutPins({ vendorOn: (v) => modLatchedOn(v) === true, vendorVersion: (v) => _packs.get(v)?.mod?.version ?? '' });
    // the packs fetched side by side (AUDIT WD3 B4); a mod is latched loaded only once its pack is on the door - one
    // that did not load (the network, an old browser with no DecompressionStream) is a mod not loaded, its towns
    // Daggerfall's and stamped so (AUDIT WD3 B1), and said (`worldDataPacksMissing`)
    const counts = await Promise.all(Object.entries(globPacks()).map(async ([path, url]) => {
      const vendor = vendorOf(path);
      let on = false;
      try { on = modSetting(vendor, 'Enabled') === true; } catch { on = false; }
      // a closed door serves none of its towns: the mod is not loaded (no 26 MB fetched for nothing), and a house
      // bought under it is stamped with the Daggerfall town it stands in (AUDIT WD3 P2)
      const got = on && door ? await loadPackFrom(vendor, url, () => true) : 0;
      latchModLoaded(vendor, got > 0);
      if (on && door && !got) _missing.add(vendor);
      return got;
    }));
    return n + counts.reduce((a, b) => a + b, 0);
  })();
  return _loaded;
}

/** WD3: a pack that is not loaded for the game, loaded now for a save that pins a town to it (systems/layoutPins.js:
 *  a house bought while the mod was on keeps its town though the mod was switched off since). Its files answer only
 *  where a pin lets them in. Answers whether the pack is on the door. */
export async function ensureWorldDataPack(vendor) {
  if (!worldDataDoorOpen()) return false;   // AUDIT WD3 P2: behind a closed door no pin is honoured - the town stands as it is served
  if (_packs.has(vendor)) return true;
  const entry = Object.entries(globPacks()).find(([path]) => vendorOf(path) === vendor);
  if (!entry) return false;
  // AUDIT WD3 P6: two asks at once (the online layouts' retries) share one fetch
  if (!_pending.has(vendor)) _pending.set(vendor, loadPackFrom(vendor, entry[1], () => false).finally(() => _pending.delete(vendor)));
  return (await _pending.get(vendor)) > 0;
}
const _pending = new Map();   // vendor -> the pack's load in flight

/** WD3: whether a town pack serves any town - loaded for the game, or let in by a save's pin. */
const townPacksLive = () => { const pinned = vendorsPinnedIn(); return [..._packs.keys()].some((v) => modLatchedOn(v) === true || pinned.has(v)); };

const _missing = new Set();   // vendors switched on whose pack did not load
/** WD3 (AUDIT WD3 B1): the packed mods switched on for this game whose packs did not load - online, the room's towns
 *  this client cannot stand (a home bought here would be keyed in another layout than the room's). */
export const worldDataPacksMissing = () => [..._missing];

/** The packs on the door, by vendor. */
export const loadedWorldDataPacks = () => new Map(_packs);

/** AUDIT WD3 B4: how long a pack's fetch may take before its towns stand as Daggerfall's (2.6 MB at its largest). */
export const PACK_FETCH_TIMEOUT_MS = 120000;
async function loadPackFrom(vendor, url, isOn) {
  const blocks = boundWorldDataBlocks();
  if (!blocks) { console.warn(`[worlddata] ${vendor}: no BLOCKS.BSA bound - pack not opened`); return 0; }
  try {
    const res = await fetch(url, typeof AbortSignal?.timeout === 'function' ? { signal: AbortSignal.timeout(PACK_FETCH_TIMEOUT_MS) } : undefined);   // AUDIT WD3 B4: a stalled fetch never holds the boot
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await readPackText(new Uint8Array(await res.arrayBuffer()));
    const pack = openWorldDataPack(JSON.parse(text), { blocks, onRebuilt: spotCheck(vendor) });
    _packs.set(vendor, pack);
    quietLocationOverrides(true);   // a pack's 7,000 towns are counted once here, not logged one by one as they are read
    const n = registerWorldDataPack(pack, isOn, { priority: WORLD_DATA_PRIORITY[vendor] ?? 0 });
    // once, whichever pack opens first - on while a town pack is loaded for the game or a pin lets one in (AUDIT WD3 T2)
    installTownStandIns(townPacksLive);
    console.log(`[worlddata] ${vendor}: ${n} files on the door (${pack.mod?.title ?? vendor} ${pack.mod?.version ?? ''})`);
    return n;
  } catch (e) {
    console.error(`[worlddata] ${vendor}: the pack did not load (${e?.message ?? e}) - its towns stand classic`);
    return 0;
  }
}

/**
 * WD3: the rebuild checked against the author's file, in the background - WD1's check at load, for a pack of
 * thousands: one block in every 8 the first time it is served and one location in every 64, hashed off the frame, and one
 * line said for the pack however many differ (a BLOCKS.BSA or MAPS.BSA that is not the one the mod was made
 * against: the author's edit on the player's own data is still what the mod does, and is served).
 */
function spotCheck(vendor) {
  const queue = [];
  let differ = 0, checked = 0, running = false, locations = 0, blocks = 0;
  const pump = async () => {
    running = true;
    while (queue.length) {
      const [name, json, want] = queue.shift();
      try { if ((await packFileSha256(json)) !== want) differ++; } catch { /* no hash available: unchecked */ }
      checked++;
      await new Promise((r) => setTimeout(r, 0));
    }
    running = false;
    if (differ) console.warn(`[worlddata] ${vendor}: ${differ} of ${checked} checked files rebuilt from your game files differ from the author's - served as rebuilt`);
  };
  return (name, json, want) => {
    if (name.startsWith('location-') && (locations++ % 64) !== 0) return;
    if (!name.startsWith('location-') && (blocks++ % 8) !== 0) return;   // AUDIT WD3 B4: one block in eight - each hash a hitch on a phone
    queue.push([name, json, want]);
    if (!running) pump();
  };
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
