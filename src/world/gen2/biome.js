// WG2 BIOMES (Phase 2): the living cover chosen from the environment - air, rain,
// soil, water and height - not from a province's name (data/biomes.json). Each biome names the Daggerfall climate
// its ground and nature are drawn with, so the game's textures and flats read it as they read CLIMATE.PAK. A spring
// in a dry land greens the ground about it: an oasis. Sand under a dry wind is raised into dunes across the wind.
import { WATER_KIND } from './hydrology.js';
import { ridgedExact, fbmExact, seedOf, smoothExact, clampExact } from './exact.js';
import { ROCKS, BIOME_TABLE, SOILS, biome as biomeOf, provinceProfile } from './tables.js';

/** Mean air C under which the ground is a snowfield; and the alpine's air over ALPINE_M. */
export const SNOW_C = -5;
export const ALPINE_C = 1.5;
export const ALPINE_M = 900;
/** An oasis's reach about its spring, world pixels. */
export const OASIS_PX = 1.6;
/** The dunes' crest-to-crest spacing across the wind, world pixels, and their height, metres. */
export const DUNE_PX = 1.4;
export const DUNE_M = 26;

const B = (k) => biomeOf(k).id;

/**
 * @param {import('./geology.js').RegionSpec} spec @param {import('./field.js').Field} elev @param {import('./field.js').Field} rock
 * @param {import('./field.js').Field} theatre @param {ReturnType<import('./climate.js').climate>} air
 * @param {ReturnType<import('./soil.js').soils>} soil @param {ReturnType<import('./hydrology.js').hydrology>} hyd
 */
export function biomes(spec, elev, rock, theatre, air, soil, hyd) {
  const n = elev.data.length, out = elev.like(Uint8Array), sand = biomeOf('dunes').id;
  const SAND = new Set(['sand', 'beach']);
  for (let k = 0; k < n; k++) {
    const t = air.temp.data[k], p = air.precip.data[k], wf = hyd.water.data[k], e = elev.data[k], th = theatre.data[k];
    const soilKey = SOILS[soil.soil.data[k]].key, rk = ROCKS[rock.data[k]].key;
    let b;
    if (th === 0) b = 'lake';
    else if (wf & WATER_KIND.playa) b = 'saltFlat';
    else if (wf & WATER_KIND.lake) b = 'lake';
    else if ((rk === 'basalt' || rk === 'tuff') && th === 4 && t > 0) b = 'ashland';
    else if (t < SNOW_C) b = 'snowfield';
    else if (t < ALPINE_C && e > ALPINE_M) b = 'alpine';
    else if (t < -1) b = 'tundra';
    else if (wf & WATER_KIND.wetland) b = t > 16 ? 'swamp' : 'marsh';
    else if ((wf & (WATER_KIND.river | WATER_KIND.floodplain)) && p < 650) b = 'riparian';
    else if (p < 250) b = SAND.has(soilKey) ? 'dunes' : 'rockDesert';
    else if (p < 500) b = t > 20 ? 'savanna' : 'steppe';
    else if (p < 850 && t > 21) b = 'savanna';
    else if (t >= 20 && p >= 1600) b = 'tropicalJungle';
    else if (t >= 15 && p >= 1300) b = 'temperateJungle';
    else if (wf & WATER_KIND.floodplain) b = 'riparian';
    else if (t >= 5) b = 'temperateForest';
    else b = 'borealForest';
    out.data[k] = B(b);
  }
  // the oases: every spring in a dry land greens its reach
  for (const s of hyd.springs) {
    const reach = OASIS_PX;
    for (let j = 0; j < elev.h; j++) for (let i = 0; i < elev.w; i++) {
      const x = elev.x0 + (i + 0.5) / elev.res, y = elev.y0 + (j + 0.5) / elev.res, k = j * elev.w + i;
      const d2 = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
      if (d2 < reach * reach && air.precip.data[k] < 600 && out.data[k] !== B('lake')) out.data[k] = B('oasis');
    }
  }
  // the dunes: across the province's wind, on the sand desert alone, eased in from its edge
  const seed = seedOf(spec.seed, 'dunes'), raised = elev.clone();
  for (let k = 0; k < n; k++) {
    if (out.data[k] !== sand) continue;
    const i = k % elev.w, j = (k / elev.w) | 0, x = elev.x0 + (i + 0.5) / elev.res, y = elev.y0 + (j + 0.5) / elev.res;
    const [wx, wy] = provinceProfile(theatre.data[k]).wind, wl = Math.sqrt(wx * wx + wy * wy) || 1;
    const along = (x * wx + y * wy) / wl / DUNE_PX + 0.6 * fbmExact(seed, x / 9, y / 9, 2), across = (-x * wy + y * wx) / wl / (DUNE_PX * 5);
    const edge = smoothExact(0, 3, sandRun(out, i, j, sand));
    raised.data[k] += DUNE_M * edge * clampExact(ridgedExact(seed + 1, along, across, 2), 0, 1);
  }
  return { biome: out, elev: raised };
}

/** How many cells of sand lie each way about a cell, the least of the four (its depth into the sand sea). */
function sandRun(f, i, j, sand) {
  let best = 4;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let d = 0;
    while (d < 4 && f.get(i + dx * (d + 1), j + dy * (d + 1)) === sand) d++;
    best = Math.min(best, d);
  }
  return best;
}

/** The Daggerfall climate a pixel's ground wears: the most common among its cells' biomes' climates (ties to the lower
 *  byte). @param {import('./field.js').Field} biome @param {number} res */
export function pixelClimates(biome, res) {
  const pw = biome.w / res, ph = biome.h / res, out = new Uint8Array(pw * ph);
  for (let py = 0; py < ph; py++) for (let px = 0; px < pw; px++) {
    const count = new Map();
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const c = BIOME_TABLE[biome.data[(py * res + j) * biome.w + px * res + i]].climate;
      count.set(c, (count.get(c) ?? 0) + 1);
    }
    let best = 0, bc = 255;
    for (const [c, m] of count) if (m > best || (m === best && c < bc)) { best = m; bc = c; }
    out[py * pw + px] = bc;
  }
  return out;
}
