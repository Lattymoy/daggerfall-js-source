// @ts-check
// WG2 RESOURCES ("Resources"): the land's goods read off its environment - ore where
// a terrane's rock carries it, at the outcrop; timber where the forest stands thick; fish in the larger rivers and the
// lakes; farmland where the soil is deep, wet and level; game where the woods meet open ground; salt on a dry lake's
// floor. Each site's id is its world pixel's key, its kind and its good, so it is the same site in every session. The
// economy's numbers stay the server's (WG-8): a site says where and how rich, never what it pays.
import { worldPixelKey } from '../worldWide/worldGrid.js';
import { TERRANE_PX, terraneSeed } from './geology.js';
import { WATER_KIND } from './hydrology.js';
import { rand01, seedOf, clampExact } from './exact.js';
import { ROCKS, BIOME_TABLE, biome as biomeOf } from './tables.js';

const FOREST = new Set(['temperateForest', 'borealForest', 'temperateJungle', 'tropicalJungle', 'swamp']);
const OPEN = new Set(['steppe', 'savanna', 'alpine', 'tundra', 'marsh', 'riparian']);
/** The game each open or wooded biome holds. */
const GAME = Object.freeze({ temperateForest: ['deer', 'boar', 'wolf'], borealForest: ['deer', 'bear', 'wolf'], temperateJungle: ['boar', 'spider'],
  tropicalJungle: ['boar', 'spider'], swamp: ['mudcrab', 'slaughterfish'], steppe: ['antelope', 'wolf'], savanna: ['antelope', 'lion'],
  alpine: ['goat', 'bear'], tundra: ['deer', 'wolf'], marsh: ['mudcrab', 'heron'], riparian: ['deer', 'heron'] });

/** @typedef {{ id: string, kind: string, good: string, x: number, y: number, rich: number, note?: string }} Site */

/**
 * @param {import('./geology.js').RegionSpec} spec
 * @param {{ elev: any, rock: any, biome: any, soil: any, hyd: any, air: any }} f
 * @returns {Site[]}
 */
export function resourceSites(spec, f) {
  const { elev, rock, biome, soil, hyd } = f, seed = seedOf(spec.seed, 'resources'), sites = [];
  const at = (i, j) => [elev.x0 + (i + 0.5) / elev.res, elev.y0 + (j + 0.5) / elev.res];
  const idOf = (x, y, kind, good) => `${kind}:${worldPixelKey(Math.floor(x), Math.floor(y))}:${good}`;
  const add = (x, y, kind, good, rich, note) => sites.push({ id: idOf(x, y, kind, good), kind, good, x: Math.round(x * 64) / 64, y: Math.round(y * 64) / 64, rich: Math.round(rich * 100) / 100, ...(note ? { note } : {}) });
  const { x: rx, y: ry, w: rw, h: rh } = spec.rect;
  // ore: a terrane whose rock carries it, at its steepest exposed cell near the seed
  for (let b = Math.floor(ry / TERRANE_PX); b <= Math.floor((ry + rh) / TERRANE_PX); b++) {
    for (let a = Math.floor(rx / TERRANE_PX); a <= Math.floor((rx + rw) / TERRANE_PX); a++) {
      const s = terraneSeed(spec, a, b);
      if (!elev.covers(s.x, s.y)) continue;
      const ores = ROCKS[s.rock].ores, keys = Object.keys(ores).sort();
      for (const good of keys) {
        if (rand01(seed, a, b, good.length * 31 + good.charCodeAt(0)) > 0.12 * ores[good]) continue;
        const [ci, cj] = elev.cellOf(s.x, s.y), r = 3 * spec.res;
        let best = -1, bi = ci, bj = cj;
        for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || j < 0 || i >= elev.w || j >= elev.h || rock.get(i, j) !== s.rock) continue;
          const sl = soil.slope.get(i, j);
          if (sl > best) { best = sl; bi = i; bj = j; }
        }
        const [x, y] = at(bi, bj);
        add(x, y, 'ore', good, clampExact(0.35 + 0.65 * rand01(seed, a, b, 7) * ROCKS[s.rock].hardness, 0, 1));
      }
    }
  }
  // blocks of the grid for the living goods
  const block = 6 * spec.res;
  for (let bj = 0; bj < elev.h; bj += block) for (let bi = 0; bi < elev.w; bi += block) {
    const tally = new Map();
    let fert = 0, level = 0, wet = 0, cells = 0, forest = 0, open = 0;
    for (let j = bj; j < Math.min(elev.h, bj + block); j++) for (let i = bi; i < Math.min(elev.w, bi + block); i++) {
      const k = j * elev.w + i, key = BIOME_TABLE[biome.data[k]].key;
      tally.set(key, (tally.get(key) ?? 0) + 1);
      cells++;
      if (FOREST.has(key)) forest++;
      if (OPEN.has(key)) open++;
      fert += soil.fertility.data[k];
      if (soil.slope.data[k] < 0.08) level++;
      if (hyd.table.data[k] < 6 || hyd.water.data[k] & (WATER_KIND.river | WATER_KIND.floodplain)) wet++;
    }
    const keys = [...tally.keys()].sort(), top = keys.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a), keys[0]);
    const [cx, cy] = at(Math.min(elev.w - 1, bi + (block >> 1)), Math.min(elev.h - 1, bj + (block >> 1)));
    if (forest / cells > 0.5) add(cx, cy, 'wood', biomeOf(top).species.find((s) => !['grass', 'fern', 'reed', 'heather', 'lichen'].includes(s)) ?? top, forest / cells);
    const farm = (fert / cells) * (level / cells) * (0.4 + 0.6 * wet / cells);
    if (farm > 0.22) add(cx + 0.5, cy, 'farm', 'arable', clampExact(farm * 1.6, 0, 1));
    if (forest / cells > 0.2 && open / cells > 0.2) { const g = GAME[top] ?? GAME.temperateForest; add(cx, cy + 0.5, 'game', g[0], clampExact((forest + open) / cells, 0, 1), g.join(' ')); }
  }
  // fish: the larger rivers every few pixels of their course, the lakes that hold water; salt on the dry ones
  for (const rv of hyd.rivers) {
    if (rv.order < 2) continue;
    const step = 6 * spec.res * 4;
    for (let p = step >> 1; p < rv.pts.length; p += step) add(rv.pts[p].x, rv.pts[p].y, 'fish', 'river', clampExact(Math.sqrt(rv.pts[p].q) / 12, 0.1, 1));
  }
  for (const lk of hyd.lakes) {
    if (lk.kind === 'playa') add(lk.x, lk.y, 'salt', 'salt', clampExact(lk.hollow / 40, 0.2, 1));
    else add(lk.x, lk.y, 'fish', 'lake', clampExact(lk.cells / 60, 0.1, 1));
  }
  sites.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sites.filter((s, i) => i === 0 || s.id !== sites[i - 1].id);
}
