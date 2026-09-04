// ═══════════════════════════════════════════════════════════════════
// AUDIT 58 F4 — TERRAINHELPER'S TWO RUNTIME DATA REPAIRS.
// 1:1 translation of Daggerfall Unity's TerrainHelper.cs (MIT,
// Daggerfall Workshop / Gavin Clayton), the half StreamingWorld runs
// ONCE at ReadyCheck (StreamingWorld.cs:1676-1685) before the first
// terrain streams:
//
//   TerrainHelper.DilateCoastalClimate(dfUnity.ContentReader, 2);
//   TerrainHelper.SmoothLocationNeighbourhood(dfUnity.ContentReader);
//
// Both mutate the IN-MEMORY reader buffers, so every later consumer -
// the climate/nature/sky archives, PlayerGPS's climate index, the
// travel calculator's ocean-pixel count, the sampler's heights - reads
// the repaired data for the rest of the session. Neither had a port,
// so the port's coastline kept climate 223 (ocean -> Swamp base,
// ground 402, sky 24, TemperateWoodland nature, Breton people) on
// every land-adjacent ocean pixel that terrain interpolation raises
// above sea level, which is the exact artefact the dilation exists to
// hide (src/world/terrainSampler.js's bicubic over the small heightmap
// is the same interpolation).
//
// VERBATIM, and the two places the shapes bite:
//  - The dilation reads the LIVE buffer and writes a CLONE, swapping
//    the clone in only at the end of each pass. Writing in place (e.g.
//    through PakFile.setValue) would let a pixel that just became land
//    act as a source later in the same scan and the dilation would run
//    further than its two passes.
//  - The smoothing writes the LIVE height buffer in scan order, so a
//    later location reads an earlier location's averaged bytes. That
//    is DFU's behaviour, not an accident of ours.
//
// CLASSIC-LANE LAW - no isEnhanced() gate on either.
// ═══════════════════════════════════════════════════════════════════

import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { PAK_WIDTH } from '../formats/pakFile.js';
import { hasLocation } from '../systems/mapDirectory.js';

/** TerrainHelper.TransferLandToOcean's `const int oceanClimate = 223`. */
export const OCEAN_CLIMATE = 223;

/** SmoothLocationNeighbourhood's default `int threshold = 20`. */
export const SMOOTH_GRADIENT_THRESHOLD = 20;

/**
 * TerrainHelper.DilateCoastalClimate (:383-416), verbatim.
 *
 * Each pass clones the in-memory CLIMATE.PAK buffer, walks x in
 * [1, 999) / y in [1, 499), and for every land pixel writes its climate
 * into each of its eight Moore neighbours that is ocean - source AND
 * destination both read from the pre-pass buffer, the write landing in
 * the clone - then stores the clone back as the reader's buffer.
 *
 * The `+ 1` on X is PakFile's own column offset, the same one
 * MapsFile.getClimateIndex uses (`climatePak.getValue(x + 1, y)`).
 *
 * @param {object} maps - the loaded MapsFile (its `climatePak` is mutated).
 * @param {number} [passes] - DFU's call site passes 2.
 * @returns {number} pixels turned from ocean to land climate, all passes.
 */
export function dilateCoastalClimate(maps, passes = 2) {
  const pak = maps?.climatePak;
  if (!pak?.buffer) return 0;
  let changed = 0;
  for (let pass = 0; pass < passes; pass++) {
    const src = pak.buffer;
    // "Get clone of in-memory climate array"
    const climateArray = src.slice();
    // Copies climate data from source to destination if destination is
    // ocean (TransferLandToOcean, :420-441) - inlined per neighbour.
    const transfer = (srcX, srcY, dstX, dstY) => {
      const srcClimate = src[srcY * PAK_WIDTH + (srcX + 1)];
      if (srcClimate === OCEAN_CLIMATE) return;   // source must be land
      const dstOffset = dstY * PAK_WIDTH + (dstX + 1);
      if (src[dstOffset] !== OCEAN_CLIMATE) return;   // destination must be ocean
      if (climateArray[dstOffset] !== srcClimate) changed++;
      climateArray[dstOffset] = srcClimate;
    };
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        transfer(x, y, x - 1, y - 1);
        transfer(x, y, x, y - 1);
        transfer(x, y, x + 1, y - 1);
        transfer(x, y, x - 1, y);
        transfer(x, y, x + 1, y);
        transfer(x, y, x - 1, y + 1);
        transfer(x, y, x, y + 1);
        transfer(x, y, x + 1, y + 1);
      }
    }
    // "Store modified climate array"
    pak.buffer = climateArray;
  }
  return changed;
}

/** GetGradient (:490-496) - DFU's faster |dx| + |dy| arm, not the
 *  commented-out sqrt one. */
export function terrainGradient(x0y0, x1y0, x0y1) {
  return Math.abs(x1y0 - x0y0) + Math.abs(x0y1 - x0y0);
}

/** AverageHeights (:499-522): the 3x3 mean around (cx, cy), written
 *  back over all nine cells. C#'s `(byte)average` truncates toward
 *  zero, and every height is non-negative, so Math.trunc is the cast. */
function averageHeights(heightArray, cx, cy) {
  let average = 0;
  let counter = 0;
  for (let y = cy - 1; y < cy + 2; y++) {
    for (let x = cx - 1; x < cx + 2; x++) {
      average += heightArray[y * MAP_WIDTH + x];
      counter++;
    }
  }
  average /= counter;
  const b = Math.trunc(average) & 0xff;
  for (let y = cy - 1; y < cy + 2; y++) {
    for (let x = cx - 1; x < cx + 2; x++) {
      heightArray[y * MAP_WIDTH + x] = b;
    }
  }
}

/**
 * TerrainHelper.SmoothLocationNeighbourhood (:443-474), verbatim.
 *
 * Over x in [1, 999) / y in [1, 499): where the map dictionary has a
 * location, take the Sobel-ish gradient of the raw height bytes and,
 * when it exceeds the threshold, flatten the 3x3 neighbourhood to its
 * own mean. The buffer written is the LIVE one `getHeightMapValue`
 * reads (DFU's `WoodsFileReader.Buffer`), in scan order, so a later
 * location sees an earlier one's result.
 *
 * DFU's own TODO at StreamingWorld.cs:1683 doubts this reaches used
 * data; it does - DefaultTerrainSampler reads that same live buffer.
 *
 * @param {Map} mapDict - buildMapDict's answer (ContentReader's mapDict).
 * @param {object} woods - the loaded WoodsFile; its heightMapBuffer is mutated.
 * @param {number} [threshold]
 * @returns {number} locations smoothed.
 */
export function smoothLocationNeighbourhood(mapDict, woods, threshold = SMOOTH_GRADIENT_THRESHOLD) {
  const heightArray = woods?.heightMapBuffer;
  if (!heightArray) return 0;
  let smoothed = 0;
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (!hasLocation(mapDict, x, y)) continue;
      const x0y0 = heightArray[y * MAP_WIDTH + x];
      const x1y0 = heightArray[y * MAP_WIDTH + (x + 1)];
      const x0y1 = heightArray[(y + 1) * MAP_WIDTH + x];
      if (terrainGradient(x0y0, x1y0, x0y1) > threshold) {
        averageHeights(heightArray, x, y);
        smoothed++;
      }
    }
  }
  return smoothed;
}
