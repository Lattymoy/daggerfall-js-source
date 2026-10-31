// OWN-WORK2 (2026-10-31): THE BAY'S NETWORK AS THE WORLD HOST BUILDS IT - scenes/world.js's boot repair of the heights
// (smoothLocationNeighbourhood), then world/roadsProducer.js buildRoadsFromSettlements over MAPS.BSA's places - off the
// player's own ARENA2. Kept on disk outside the tree (a render of game data is game data), keyed by the generator's
// cache key and its sources, so a run's test files pay the build once. `bayRoads()` is null without ARENA2.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { MapsFile } from '../src/formats/mapsFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { buildMapDict } from '../src/systems/map/mapDirectory.js';
import { smoothLocationNeighbourhood } from '../src/world/terrain/terrainHelper.js';
import { settlementsOf, buildRoadsFromSettlements } from '../src/world/roadsProducer.js';
import { roadsCacheKey } from '../src/world/roadsCache.js';

export const ARENA2 = process.env.ARENA2_PATH ?? '';
export const HAS_BAY = !!ARENA2 && ['MAPS.BSA', 'WOODS.WLD', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
/** A test's skip while the player's data is not here. */
export const BAY_SKIP = HAS_BAY ? false : 'no ARENA2 (sh tools/fetch-data.sh, then ARENA2_PATH)';

const SOURCES = ['world/roadsProducer.js', 'world/roadsCache.js', 'world/road/roadNetwork.js', 'world/road/roadLand.js', 'world/road/riverNetwork.js', 'world/road/roadGaps.js', 'world/terrain/terrainHelper.js'];
const KINDS = ['roads', 'tracks', 'rivers', 'streams'];
let kept = null;

/** The maps, the smoothed heights and the places, as the world host reads them. */
export function bayArchives() {
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile();
  woods.load(bytes('WOODS.WLD'));
  smoothLocationNeighbourhood(buildMapDict(maps), woods);
  woods.syncHeightMapBytes();
  return { maps, woods, settlements: settlementsOf(maps) };
}

/** @returns {?{ roads: Uint8Array, tracks: Uint8Array, rivers: Uint8Array, streams: Uint8Array, stats: any }} */
export function bayRoads() {
  if (!HAS_BAY) return null;
  if (kept) return kept;
  const { woods, settlements } = bayArchives();
  const h = createHash('sha256').update(roadsCacheKey({ settlements, woodsLength: woods.heightMapBuffer.length, land: null })).update(woods.heightMapBuffer);
  for (const f of SOURCES) h.update(readFileSync(new URL(`../src/${f}`, import.meta.url)));
  const dir = join(tmpdir(), 'dfo-bay-roads'), file = join(dir, `${h.digest('hex').slice(0, 24)}.bin`);
  const n = woods.heightMapBuffer.length;
  if (existsSync(file)) {
    const b = new Uint8Array(readFileSync(file));
    const stats = JSON.parse(Buffer.from(b.subarray(4 * n)).toString('utf8'));
    kept = { ...Object.fromEntries(KINDS.map((k, i) => [k, b.slice(i * n, (i + 1) * n)])), stats };
    return kept;
  }
  const net = buildRoadsFromSettlements(settlements, woods);
  if (!net) throw new Error('the Bay\'s network did not build');
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}`;
  writeFileSync(tmp, Buffer.concat([...KINDS.map((k) => Buffer.from(net[k])), Buffer.from(JSON.stringify(net.stats))]));
  renameSync(tmp, file);
  kept = { roads: net.roads, tracks: net.tracks, rivers: net.rivers, streams: net.streams, stats: net.stats };
  return kept;
}

/** Our network where the player's data is, else no path at all - for a pin the roads only feed. */
export function bayRoadsOrNone() {
  const none = () => new Uint8Array(1000 * 500);
  return bayRoads() ?? { roads: none(), tracks: none(), rivers: none(), streams: none(), stats: null };
}
