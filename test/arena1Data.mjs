// ARENA1: the player's data as the arena tests read it - MAPS.BSA, BLOCKS.BSA and ARCH3D.BSA out of ARENA2_PATH. The town
// packs that gave the city its other layout are retired (OWN-WORK3). Null without ARENA2.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { installWorldDataReplacement, bindWorldDataBlocks, _resetWorldDataReplacement } from '../src/formats/worldData/worldDataReplacement.js';
import { setValue } from '../src/systems/settings/settings.js';
import { installArena, _resetArena } from '../src/world/arena/arenaCity.js';
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
 * A fresh door: AssetInjection as asked, the blocks bound, the arena installed when `arena`. Answers { maps, blocks }.
 * OWN-WORK3: `packs` is read for the callers that still name it, and loads nothing - the town packs are retired.
 */
export async function bootDoor({ packs: _packs = false, arena = true, injection = true } = {}) {
  _resetWorldDataReplacement();
  _resetLayoutPins();
  _resetArena();
  setValue('Enhancements', 'AssetInjection', injection ? 'True' : 'False');
  installWorldDataReplacement();
  const blocks = loadBlocks();
  bindWorldDataBlocks(blocks);
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
