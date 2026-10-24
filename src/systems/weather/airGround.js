// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT PRECIP (2026-10-19, the owner: "Audit this and ensure perfection. No band aids") - THE LAW'S MAP FOR THE AIR: what
// systems/weather/airTemperature.js reads its climates and the ground's heights off, composed once as the world mounts.
// bible/07-Rendering/Biome-Precipitation.md is the record.
//
// The air read the Bay's 1000 x 500 pixels and held every read to its edge (AIR-1): the continent past it read the
// edge's pixel, and the Eltheric Ocean - two thousand rows north of the Bay, its latitude unbounded - fell as snow every
// day of the year on a subtropical port. It read each climate after the coastal dilation (AIR-10: a texture repair that
// pushes land climate two pixels into the sea, so the snow line ran parallel to every coast out at sea), and the
// ground's height as WOODS' byte alone (AIR-3: DFU's base term, 110 m to 900 m under the ground the player walks in the
// ranges). Here:
//   - THE CLIMATES are CLIMATE.PAK's own (the buffer the dilation kept, terrainHelper.js `undilated`), the continent's
//     provinces past the Bay (world/tamriel/tamrielGround.js) and the Eltheric Ocean's isles (world/ethericSea.js) -
//     composed whatever the client's own rows say (`tamrielLand` is each player's own online), so every client reads
//     one air;
//   - THE GROUND is the kernel's own mean (world/landforms.js meanGroundField: both bicubic terms, and the landforms'
//     lift where the world stands them), read at the point;
//   - ITS TOP (the snowpack's ceiling, AUDIT PRECIP PACK-1) is the bound of the ground each pixel can stand
//     (world/landforms.js groundTopOf), never a byte and a guess.
import { meanGroundField, groundTopOf } from '../../world/landforms.js';
import { groundWoods, groundClimateIndex } from '../../world/tamriel/tamrielGround.js';
import { etherWoods, etherClimateIndex } from '../../world/ethericSea.js';
import { TERRAIN_SIZE, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION } from '../../world/terrain/terrainSampler.js';
import { MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../../formats/mapsFile.js';
import { PAK_WIDTH } from '../../formats/pakFile.js';
import { SEA_LEVEL_M } from './airTemperature.js';

/** The Bay's own reader under any composition the host made of it (groundWoods' `bay`, etherWoods' `under`). */
export function bayReader(woods) {
  let w = woods;
  for (;;) {
    if (w?.isEtherGround) w = w.under;
    else if (w?.isTamrielGround) w = w.bay;
    else return w;
  }
}

/** Kernel units as metres above the sea (the streamed scale, less the sea's own). */
export const metresOfUnits = (units) => units * STREAMING_TERRAIN_SCALE - SEA_LEVEL_M;

/**
 * THE LAW'S MAP: `woods` the world's reader (any composition of it), `maps` its MapsFile (after the boot's dilation -
 * its kept buffer is read), `landforms` whether the world stands the landforms (online always: shared.js landformsOn),
 * `climates()` the landforms' climates table once made (landforms.js landformClimates; null until then). Answers the
 * air's ground (airTemperature.js setAirGround): `climateAt(px, py)`, `groundAt(x, z)` (metres above the sea) and
 * `topAt(px, py)` (metres above the sea - the highest the pixel's own ground stands).
 * @param {{ woods: any, maps: any, landforms: boolean, climates?: () => ?Uint8Array }} o
 */
export function lawAirGround({ woods, maps, landforms, climates = () => null }) {
  const bay = bayReader(woods);
  const law = etherWoods(groundWoods(bay));
  const pak = maps.climatePak;
  const raw = pak.undilated ?? pak.buffer;
  const bayClimate = (x, y) => (x >= 0 && y >= 0 && x < MAX_MAP_PIXEL_X && y < MAX_MAP_PIXEL_Y ? raw[y * PAK_WIDTH + x + 1] : -1);
  const climateAt = etherClimateIndex(groundClimateIndex(bayClimate));
  const span = HEIGHTMAP_DIMENSION - 1;
  const fields = new Map();
  /** A pixel's mean-ground field, kept for the last few pixels asked (a frame asks the player's and its cells'). */
  const fieldOf = (px, py) => {
    const key = (px + 16384) * 32768 + (py + 16384);
    let f = fields.get(key);
    if (f) { fields.delete(key); fields.set(key, f); return f; }
    f = meanGroundField(law, px, py, landforms);
    if (fields.size >= 64) fields.delete(fields.keys().next().value);
    fields.set(key, f);
    return f;
  };
  const tops = new Map();
  return {
    climateAt,
    groundAt(x, z) {
      const px = Math.floor(x / TERRAIN_SIZE), row = Math.floor(z / TERRAIN_SIZE), py = MAX_MAP_PIXEL_Y - 1 - row;
      const sx = (x / TERRAIN_SIZE - px) * span, sy = (z / TERRAIN_SIZE - row) * span;
      return metresOfUnits(fieldOf(px, py)(sx, sy));
    },
    topAt(px, py) {
      const table = climates();
      const key = ((px + 16384) * 32768 + (py + 16384)) * 2 + (table ? 1 : 0);
      let t = tops.get(key);
      if (t === undefined) {
        t = metresOfUnits(groundTopOf(law, px, py, landforms, table));
        if (tops.size >= 65536) tops.delete(tops.keys().next().value);
        tops.set(key, t);
      }
      return t;
    },
  };
}
