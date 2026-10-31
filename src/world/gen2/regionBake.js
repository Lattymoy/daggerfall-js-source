// @ts-check
// WG2 THE BAKE (bible/03-World/World-2-Canon.md, "The bake"): a region made whole, stage by stage in stageGraph.js's
// order - canon, geology, climate, erosion, hydrology, soil, biome, resources - each reading only what the stages before
// it made. Offline: tools/wg2Bake.mjs runs it and the bake ships (WG-4); a client only reads a bake (regionSampler.js).
import { canonGrid, geology, regionGrid, byteMetres, infillCanon, wetHollows } from './geology.js';
import { climate } from './climate.js';
import { erode } from './erosion.js';
import { hydrology } from './hydrology.js';
import { soils } from './soil.js';
import { biomes, pixelClimates } from './biome.js';
import { resourceSites } from './resources.js';
import { provinceProfile } from './tables.js';
import { STAGES } from './stageGraph.js';
import { canonPrint } from './canon.js';

/** The generator's law (the manifest's `generatorVersion` names it). A change that moves any bake's bytes for the same
 *  spec raises it, and the old law is kept beside the new one while a published region was baked by it (WG-5). */
export const GENERATOR_VERSION = 'wg2-1';

/** The WOODS byte whose far-view height (landforms.js nodeGround) is nearest `m` metres - the byte the kernel and the
 *  far rings read for a pixel of a published region. 0 under the sea. */
const BYTE_M = Array.from({ length: 256 }, (_, b) => byteMetres(b));
export function byteOfMetres(m) {
  if (m < 0) return 0;
  let lo = 6, hi = 255;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (BYTE_M[mid] < m) lo = mid + 1; else hi = mid; }
  return lo > 6 && m - BYTE_M[lo - 1] < BYTE_M[lo] - m ? lo - 1 : lo;
}

/**
 * Bake a region. Answers every field on the region's grid, the vector water, the resource sites, and per world pixel
 * the byte and the climate the game's own readers take.
 * @param {import('./geology.js').RegionSpec} spec
 */
export function bakeRegion(spec) {
  const g = regionGrid(spec);
  const canon = canonGrid(spec);
  const geo = geology(spec, canon);
  const isSea = (k) => canon.theatre.data[k] === 0;
  const air0 = climate(spec, canon, geo.elev);
  const worked = erode(geo.elev, geo.rock, geo.uplift, air0.precip, g.cellM, { steps: spec.erosion?.steps, k: spec.erosion?.k, isSea });
  // the fans and the flats the water laid close small hollows a ridge of sediment wide: filled as before the erosion
  // (a dry land's great basins kept), and the wet lowlands' pools laid after
  infillCanon(spec, canon, worked.elev);
  wetHollows(spec, canon, worked.elev);
  const air = climate(spec, canon, worked.elev);
  const wet = worked.elev.like();
  for (let k = 0; k < wet.data.length; k++) wet.data[k] = provinceProfile(canon.theatre.data[k]).wet;
  const hyd = hydrology(spec, worked.elev, air, g.cellM, { isSea, wet });
  const soil = soils(spec, hyd.elev, geo.rock, air, hyd, worked.deposit, g.cellM);
  const bio = biomes(spec, hyd.elev, geo.rock, canon.theatre, air, soil, hyd);
  const elev = bio.elev;
  // the game's own readers' half: a byte and a climate a world pixel. A pixel's byte stands at its node, its south-east
  // corner (landforms.js byteBeyond: the kernel's (x + 1) * 128, (MAP_H - y) * 128), so it is the land there
  const bytes = new Uint8Array(spec.rect.w * spec.rect.h);
  for (let py = 0; py < spec.rect.h; py++) for (let px = 0; px < spec.rect.w; px++) {
    const nx = spec.rect.x + px + 1, ny = spec.rect.y + py + 1;
    const m = (elev.at(nx - 0.25, ny - 0.25) + elev.at(nx + 0.25, ny - 0.25) + elev.at(nx - 0.25, ny + 0.25) + elev.at(nx + 0.25, ny + 0.25)) / 4;
    const [ci, cj] = elev.cellOf(nx, ny);
    bytes[py * spec.rect.w + px] = canon.theatre.get(ci, cj) === 0 && m < 0 ? 0 : byteOfMetres(m);
  }
  const climates = pixelClimates(bio.biome, spec.res);
  const resources = resourceSites(spec, { elev, rock: geo.rock, biome: bio.biome, soil, hyd, air });
  return {
    spec, generator: GENERATOR_VERSION, canon: canonPrint(), stages: Object.fromEntries(Object.entries(STAGES).map(([k, v]) => [k, v.version])),
    fields: {
      elev, rock: geo.rock, soil: soil.soil, soilDepth: soil.depth, fertility: soil.fertility, moisture: soil.moisture, biome: bio.biome,
      water: hyd.water, lake: hyd.lakeId, discharge: hyd.discharge, table: hyd.table, temp: air.temp, precip: air.precip,
      humidity: air.humidity, exposure: air.exposure, solar: air.solar, season: air.season, theatre: canon.theatre, deposit: worked.deposit,
    },
    rivers: hyd.rivers, lakes: hyd.lakes, falls: hyd.falls, springs: hyd.springs.map(({ cell, ...s }) => s), resources, bytes, climates,
    before: geo.elev,
  };
}
