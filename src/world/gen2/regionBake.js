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
import { STAGE_GRAPH } from './stageGraph.js';
import { canonPrint } from './canon.js';
import { regionInflow } from './continent.js';
import { groundPatches, authoredCourses, PATCH_TILE_PX } from './edit/editLayers.js';
import { docPrint } from './edit/revisions.js';

/** The generator's law (the manifest's `generatorVersion` names it). A change that moves any bake's bytes for the same
 *  spec raises it, and the old law is kept beside the new one while a published region was baked by it (WG-5). */
export const BAKE_GENERATOR = 'wg2-2';

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
 * `doc`: an editor document (edit/editLayers.js) applied as the authored overrides - its brushes and hand rivers on the
 * worked land before the water is found, its biome paint after the biomes, its roads kept for the sampler to ease.
 * @param {import('./geology.js').RegionSpec} spec @param {{ doc?: any }} [o]
 */
export function bakeRegion(spec, o = {}) {
  const g = regionGrid(spec);
  const canon = canonGrid(spec);
  const geo = geology(spec, canon);
  const isSea = (k) => canon.theatre.data[k] === 0;
  const air0 = climate(spec, canon, geo.elev);
  const inflow = regionInflow(spec);   // the rivers that enter from beyond the region's edge (continent.js)
  const worked = erode(geo.elev, geo.rock, geo.uplift, air0.precip, g.cellM, { steps: spec.erosion?.steps, k: spec.erosion?.k, isSea, inflow });
  // the fans and the flats the water laid close small hollows a ridge of sediment wide: filled as before the erosion
  // (a dry land's great basins kept), and the wet lowlands' pools laid after
  infillCanon(spec, canon, worked.elev);
  wetHollows(spec, canon, worked.elev);
  const authored = o.doc ? applyGroundEdits(spec, o.doc, worked.elev) : null;
  const air = climate(spec, canon, worked.elev);
  const wet = worked.elev.like();
  for (let k = 0; k < wet.data.length; k++) wet.data[k] = provinceProfile(canon.theatre.data[k]).wet;
  const hyd = hydrology(spec, worked.elev, air, g.cellM, { isSea, wet, inflow, forced: authored?.forced });
  const soil = soils(spec, hyd.elev, geo.rock, air, hyd, worked.deposit, g.cellM);
  const bio = biomes(spec, hyd.elev, geo.rock, canon.theatre, air, soil, hyd);
  if (o.doc) applyBiomePaint(o.doc, bio.biome);
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
    spec, generator: BAKE_GENERATOR, canon: canonPrint(), stages: Object.fromEntries(Object.entries(STAGE_GRAPH).map(([k, v]) => [k, v.version])),
    fields: {
      elev, rock: geo.rock, soil: soil.soil, soilDepth: soil.depth, fertility: soil.fertility, moisture: soil.moisture, biome: bio.biome,
      water: hyd.water, lake: hyd.lakeId, discharge: hyd.discharge, table: hyd.table, temp: air.temp, precip: air.precip,
      humidity: air.humidity, exposure: air.exposure, solar: air.solar, season: air.season, theatre: canon.theatre, deposit: worked.deposit,
    },
    rivers: hyd.rivers, lakes: hyd.lakes, falls: hyd.falls, springs: hyd.springs.map(({ cell, ...s }) => s), resources, bytes, climates,
    edits: o.doc ? docPrint(o.doc) : null, roads: authored?.roads ?? [],
    before: geo.elev,
  };
}

/**
 * THE AUTHORED OVERRIDES ON THE WORKED LAND (the toolchain's step 8): a document's brushes added cell by cell, then its
 * hand-drawn rivers cut along their courses (each cell under a course stood at its surface less its depth, the surface
 * never rising) and marked to be rivers whatever they carry. Answers the forced cells and the roads' courses.
 * @param {import('./geology.js').RegionSpec} spec @param {any} doc @param {import('./field.js').Field} elev
 */
export function applyGroundEdits(spec, doc, elev) {
  const res = elev.res, side = PATCH_TILE_PX * res, patches = groundPatches(doc, /** @type {any} */ ({ fields: { elev }, header: { seed: spec.seed } }));
  for (const p of patches.values()) for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const ci = p.tx * side + i, cj = p.ty * side + j;
    if (ci < elev.w && cj < elev.h) elev.data[cj * elev.w + ci] += p.data[j * side + i];
  }
  const ways = authoredCourses(doc, (x, y) => elev.at(x, y)), forced = new Uint8Array(elev.data.length);
  for (const rv of ways.rivers) for (const [x, y, s] of rv.pts) {
    if (!elev.covers(x, y)) continue;
    const [i, j] = elev.cellOf(x, y), k = j * elev.w + i;
    elev.data[k] = Math.min(elev.data[k], s - rv.depth);
    forced[k] = 1;
  }
  return { forced, roads: ways.roads.map((r) => ({ width: r.width, pts: r.pts })) };
}

/** A document's biome paint on the bake's biomes (a cell whose centre a stroke reaches takes its biome). */
export function applyBiomePaint(doc, biome) {
  for (const L of doc.layers) if (L.visible) for (const op of L.ops) {
    if (op.kind !== 'biome') continue;
    for (let j = 0; j < biome.h; j++) for (let i = 0; i < biome.w; i++) {
      const x = biome.x0 + (i + 0.5) / biome.res, y = biome.y0 + (j + 0.5) / biome.res, dx = (x - op.x) * 819.2, dy = (y - op.y) * 819.2;
      if (dx * dx + dy * dy < op.r * op.r) biome.data[j * biome.w + i] = op.biome;
    }
  }
}

/**
 * THE REGION'S TOWNS, BAKED (Settlement System 2.0's layer of the file): each of `towns` made on the region's own ground
 * (the bake decoded and sampled as a client samples it), its ids minted under its ordinal's map id, and refused whole if
 * the validator finds a problem - a bake never ships a town that floats, buries or strands a door. Every client then
 * stands the same records (GROUND-AGREE); nothing is generated at run time.
 * @param {Uint8Array} bytes the encoded bake @param {readonly any[]} towns settlement specs with `ordinal`
 * @param {(d: any) => any} sampler regionSampler @param {{ generate: Function, problems: Function, mint: Function, mapId: Function }} law
 */
export function bakeTowns(bytes, towns, sampler, law, decode) {
  if (!towns.length) return [];
  const S = sampler(decode(bytes));
  return towns.map((spec) => {
    const t = law.generate(S, spec), mapId = law.mapId(spec.ordinal), { buildings } = law.mint(t.id, mapId, t.buildings);
    const town = { ...t, mapId, ordinal: spec.ordinal, buildings };
    const bad = law.problems(S, town, { minted: true });
    if (bad.length) throw new Error(`wg2: ${spec.id} cannot be baked: ${bad.slice(0, 4).join('; ')}`);
    const { keep, ...plain } = town;
    return plain;
  });
}
