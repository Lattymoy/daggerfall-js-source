// ARENA1: the player's data as the arena tests read it - MAPS.BSA, BLOCKS.BSA and ARCH3D.BSA out of ARENA2_PATH,
// and Beautiful Cities' and Villages' packs on the door for the city's other layout. Null without ARENA2.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { openWorldDataPack } from '../src/formats/worldDataPack.js';
import { registerWorldDataPack, installWorldDataReplacement, bindWorldDataBlocks, quietLocationOverrides, _resetWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { setValue } from '../src/systems/settings.js';
import { installArena, _resetArena } from '../src/world/arenaCity.js';
import { _resetLayoutPins } from '../src/systems/layoutPins.js';

export const ARENA2 = process.env.ARENA2_PATH ?? '';
export const HAS_ARENA2 = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
export const ROOT = new URL('..', import.meta.url).pathname;
export const vendorBytes = (rel) => new Uint8Array(readFileSync(join(ROOT, 'vendor/daggerfall-arena', rel)));
const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));

export function loadMaps() {
  const m = new MapsFile();
  m.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  return m;
}
export function loadBlocks() {
  const b = new BlocksFile();
  b.load(bytes('BLOCKS.BSA'));
  return b;
}

/**
 * A fresh door: AssetInjection as asked, the blocks bound, the town packs on it when `packs`, the arena installed
 * when `arena`. Answers { maps, blocks }.
 */
export async function bootDoor({ packs = false, arena = true, injection = true } = {}) {
  _resetWorldDataReplacement();
  _resetLayoutPins();
  _resetArena();
  setValue('Enhancements', 'AssetInjection', injection ? 'True' : 'False');
  installWorldDataReplacement();
  const blocks = loadBlocks();
  bindWorldDataBlocks(blocks);
  if (packs) {
    for (const [v, pr] of [['beautiful-villages', 10], ['beautiful-cities', 20]]) {
      const pack = openWorldDataPack(JSON.parse(gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString()), { blocks });
      registerWorldDataPack(pack, () => true, { priority: pr });
    }
    quietLocationOverrides(true);
  }
  if (arena) await installArena({ readBin: async () => vendorBytes('Models/864102.bin'), log: null });
  return { maps: loadMaps(), blocks };
}

/** dfMeshToModel over the player's ARCH3D, as scenes/dataPipeline.js reads a classic model. */
export function classicModels() {
  const arch = new Arch3dFile();
  arch.load(bytes('ARCH3D.BSA'));
  const files = new Map();
  const size = (a, r) => {
    if (!files.has(a)) { const t = new TextureFile(); t.load(bytes(TextureFile.indexToFileName(a)), TextureFile.indexToFileName(a)); files.set(a, t); }
    const t = files.get(a);
    return { width: t.getWidth(r), height: t.getHeight(r) };
  };
  return (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : dfMeshToModel(arch.getMesh(i), size); };
}
