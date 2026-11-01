// WG2 SOILS (Phase 2): what the ground is made of, from its rock, its slope, its water
// and its air (data/soils.json holds each soil's numbers). A river's flood plain is alluvium, a steep slope scree or
// bare rock, a waterlogged flat peat or mire, a dry sandstone basin sand, the cold ground tundra; the rock's own soil
// otherwise. `moisture` (0..1) is what a plant's roots find: the rain, the water table and the soil's hold on it.
import { slopeOf } from './gridOps.js';
import { WATER_KIND } from './hydrology.js';
import { clampExact, rand01, seedOf } from './exact.js';
import { ROCKS, SOILS, soil as soilOf } from './tables.js';

/** Where a slope (rise over run) gives scree, and bare rock. */
export const SCREE_SLOPE = 0.55;
export const ROCK_SLOPE = 0.9;
/** Mean air under which the ground is tundra, C. */
export const TUNDRA_C = -2;

/**
 * @param {import('./geology.js').RegionSpec} spec @param {import('./field.js').Field} elev @param {import('./field.js').Field} rock
 * @param {ReturnType<import('./climate.js').climate>} air @param {ReturnType<import('./hydrology.js').hydrology>} hyd
 * @param {import('./field.js').Field} deposit metres laid by the water @param {number} cellM
 */
export function soils(spec, elev, rock, air, hyd, deposit, cellM) {
  const slope = slopeOf(elev, cellM), n = elev.data.length, seed = seedOf(spec.seed, 'soil');
  const soil = elev.like(Uint8Array), depth = elev.like(), fertility = elev.like(), moisture = elev.like();
  const id = (k) => soilOf(k).id;
  for (let k = 0; k < n; k++) {
    const r = ROCKS[rock.data[k]], s = slope.data[k], p = air.precip.data[k], t = air.temp.data[k], wf = hyd.water.data[k];
    let key = r.soil;
    if (wf & WATER_KIND.playa) key = 'salt';
    else if (wf & WATER_KIND.wetland) key = t > 12 ? 'mire' : 'peat';
    else if (s > ROCK_SLOPE) key = 'rock';
    else if (s > SCREE_SLOPE) key = 'scree';
    else if (t < TUNDRA_C) key = 'tundra';
    else if ((wf & (WATER_KIND.floodplain | WATER_KIND.river)) || deposit.data[k] > 3) key = 'alluvium';
    else if (r.key === 'basalt' || r.key === 'tuff') key = 'andisol';
    else if (p < 350) key = r.soil === 'sand' || deposit.data[k] > 1 ? 'sand' : 'aridisol';
    else if (t > 19 && p > 1400) key = 'laterite';
    else if (t < 7 && p > 600 && r.soil !== 'clay') key = 'podzol';
    const so = SOILS[id(key)];
    soil.data[k] = so.id;
    // the depth thins with the slope and thickens with what the water laid; a little lattice variety
    depth.data[k] = Math.max(0, so.depth * (1 - clampExact(s / ROCK_SLOPE, 0, 1)) + Math.min(4, deposit.data[k] * 0.5)) * (0.85 + 0.3 * rand01(seed, k));
    const wetness = clampExact(p / 1500, 0, 1) * 0.6 + (1 - clampExact(hyd.table.data[k] / 8, 0, 1)) * 0.4;
    moisture.data[k] = clampExact(wetness * (0.5 + 0.5 * so.retention) + (wf & (WATER_KIND.wetland | WATER_KIND.lake) ? 0.4 : 0), 0, 1);
    fertility.data[k] = clampExact(so.fertility * (0.4 + 0.6 * moisture.data[k]) * (t < 0 ? 0.4 : t > 30 ? 0.7 : 1), 0, 1);
  }
  return { soil, depth, fertility, moisture, slope };
}
