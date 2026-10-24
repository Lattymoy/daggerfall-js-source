// FIELD BUGS 2026-10-04d: THE PLAYER'S OWN TOWNS, for the gated pins - the port's MapsFile and BlocksFile over
// ARENA2_PATH, the world-data door holding both vendored town packs at their load priorities (formats/worldData/worldDataPack.js,
// as scenes/modWorldData.js registers them), and the layout pins told where a town is. Nothing of ARENA2 is written or
// kept. Without ARENA2_PATH (and its MAPS.BSA, BLOCKS.BSA, CLIMATE.PAK, POLITIC.PAK) every gated test skips.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARENA2 = process.env.ARENA2_PATH;
export const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
export const SKIP = HAVE_ARENA2 ? false : 'ARENA2_PATH not set';
export const BV = 'beautiful-villages', BC = 'beautiful-cities';
export const VERSIONS = Object.freeze({ [BV]: '1.4.2', [BC]: '0.5.0' });
const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
/** A vendored pack's JSON. */
export const packJson = (v) => JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString('utf8'));

/** The towns as a game with `mods` loaded stands them: { maps, blocks, W, LP, packs, keyOf(mapId), world(location) }. */
export async function openTowns({ mods = true } = {}) {
  const W = await import('../src/formats/worldData/worldDataReplacement.js');
  const LP = await import('../src/systems/layoutPins.js');
  const { setValue } = await import('../src/systems/settings/settings.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { openWorldDataPack } = await import('../src/formats/worldData/worldDataPack.js');
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  W._resetWorldDataReplacement(); LP._resetLayoutPins();
  setValue('Enhancements', 'AssetInjection', 'True');
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  const packs = {};
  if (mods) {
    for (const [v, priority] of [[BV, 10], [BC, 20]]) {
      packs[v] = openWorldDataPack(packJson(v), { blocks });
      W.registerWorldDataPack(packs[v], () => true, { priority });
    }
  }
  W.latchWorldDataDoor?.();
  W.quietLocationOverrides(true);
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const keyOfMapId = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r); if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) keyOfMapId.set(reg.mapTable[l].mapId, r + 100 * l);
  }
  const locOf = (k) => maps.getLocation(k % 100, Math.floor(k / 100));
  LP.configureLayoutPins({
    vendorOn: () => mods, vendorVersion: (v) => VERSIONS[v] ?? '', locationKeyOfMapId: (id) => keyOfMapId.get(id) ?? null,
    gridOf: (k) => locOf(k)?.exterior?.exteriorData?.blockNames ?? null, locationTypeOf: (k) => locOf(k)?.mapTableData?.locationType ?? null,
  });
  /** The quest machine's world seam with the player standing in `location` (a Place's `local`, a moved site's town). */
  const world = (location = null) => ({
    maps, getBlock: (name) => blocks.getBlockByName(name), currentLocation: () => location ?? { loaded: false },
    isHouseOwned: () => false, isPlayerHome: () => false, buildingNameOpts: () => ({}),
  });
  return { maps, blocks, W, LP, packs, keyOf: (mapId) => keyOfMapId.get(mapId) ?? null, world };
}

/** Every location of the world, in region order: { r, l, loc } (read through the door). */
export function* everyLocation(maps) {
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r); if (!reg) continue;
    for (let l = 0; l < reg.locationCount; l++) yield { r, l, loc: maps.getLocation(r, l) };
  }
}
/** A seeded draw, the same every run (a Park-Miller LCG). */
export function seeded(seed = 1) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
