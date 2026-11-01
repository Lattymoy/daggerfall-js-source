// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL2 (2026-10-08, bible/03-World/Tamriel.md) - THE GROUND BEYOND THE BAY: the land mass, streamed.
//
// Mac: "Lets worry about this later and only implement the land mass." The towns, the dungeons, the regions and the
// roads wait; the GROUND does not. Daggerfall's streamed world grows every tile from two bytes a map pixel - WOODS.WLD's
// height and CLIMATE.PAK's climate - through DFU's own kernel (world/terrain/terrainSampler.js, world/terrain/terrainGen.js), and that
// kernel asks for them through three reads: getHeightMapValue, getHeightMapValuesRange1Dim and
// getLargeHeightMapValuesRange (the large map's 5x5 of detail a pixel). This module answers those reads for any pixel
// of the continent's frame (world/tamriel/tamrielFrame.js): the Bay's own bytes on the Bay, and the authored continent's past
// it (world/tamriel/tamrielGeography.js) - so a player who walks off the Bay's edge finds the land going on, textured by its
// province's climate, with the climate's own trees and nothing built on it.
//
// THE BAY IS NOT MOVED BY A BYTE. The kernel reads a 4 x 4 window of small heights round a pixel and a 3 x 3 of large
// ones, and at the Bay's edge that window reaches past the data - where WoodsFile CLAMPS to the edge's own pixel. Any
// other answer there would re-shape the Bay's edge tiles, and every anchor, save and seam that stands on them. So the
// seam band (SEAM_PX pixels past the edge) answers EXACTLY the clamped read, and the authored ground blends in from the
// edge's byte over BLEND_PX pixels after it: test/world/tamriel2.test.js holds every Bay pixel's samples byte-identical with
// the ground composed and without.
//
// THE HEIGHT LAW is the raster's (world/tamriel/tamrielRaster.js reads it from here, one home): the sea's byte is 0; land starts
// at SHORE_BYTE and rises with distance from the coast to INLAND_BYTE over PLAIN_REACH picture units; a range lifts its
// band toward SNOW_BYTE by its gain; a lattice hash of ±2 keeps a plain from reading as a contour. Pure, deterministic,
// cached a pixel (the stream asks the same few hundred pixels many times). TAMRIEL-RELIEF (2026-10-24): where the trace
// stands, the land's height is the owner's heightmap instead (world/tamriel/tamrielRelief.js) - eased in from SHORE_BYTE
// over RELIEF_COAST_REACH, the lattice hash on it - and the authored ranges are the law only without a trace.
// ═══════════════════════════════════════════════════════════════════
import { rangeLift } from './tamrielGeography.js';
import { provinceKeyAt, coastDistanceAt, coastDepthAt, tamrielTrace } from './tamrielLand.js';   // TAMRIEL3: the picture's own land where it is traced, the authored shape else; SMOOTH-LAND: its smooth law and waterline
import { bayToPicture, inBay, BAY_W, BAY_H, tamrielFrameInBay, tamrielFit } from './tamrielFrame.js';
import { CLIMATES, regionOfTheatre } from '../../formats/mapsTables.js';
import { tamrielBiomeAt } from './tamrielBiomes.js';   // TESA-BIOME: each province's zones, each its own climate and air
import { reliefStands, reliefAt, RELIEF_COAST_REACH, RELIEF_FLOOR } from './tamrielRelief.js';   // TAMRIEL-RELIEF: the owner's heightmap on the trace
import { theatreAt } from '../worldWide/worldGrid.js';   // WW-R: a province's land is its region's
import { WATER_BYTE } from '../roadsProducer.js';   // AUDIT TESA II R1: the beach line the land stands over - one constant
import { rumareBasin, rumareMouthPixel } from '../rumareWaters.js';   // RUMARE-WATER: the land let down about the Imperial City at the sea
import { perlinNoise } from '../perlin.js';   // RELIEF-PEAKS: the large map before it (largeMapBefore), for the records written on it
import { inEtherLaw } from '../ethericSea.js';   // RELIEF-PEAKS: the Eltheric Ocean's box keeps its own large map
import { landLayer } from '../land/landLayer.js';   // FOUNDATION F4: the land's rows, asked before the law
import { gen2Byte, gen2Climate } from '../gen2/gen2Ground.js';   // The published regions' ground, asked before the law
import { BASE_HEIGHT_SCALE, NOISE_MAP_SCALE, MAX_TERRAIN_HEIGHT, EXTRA_NOISE_SCALE, cubicInterpolator } from '../terrain/terrainSampler.js';   // RELIEF-PEAKS: the kernel's own two terms

/** The height law's bytes (WOODS' own units: byte * 8 metres; the sea at 3 and under). AUDIT TESA II R1/G12: the shore - the
 *  least any land past the Bay stands, the relief's and the authored law's alike - is one over the beach line every
 *  reader of the ground calls water at or under (roadsProducer.js WATER_BYTE: the roads, the places' dry ground, the
 *  gates' land); at 5 it WAS that line, and a land pixel at the floor read as water (78,355 of them on the relief, a
 *  pond each: places unserved, pairs unrouted, three capitals' gates dropped). */
export const SHORE_BYTE = WATER_BYTE + 1;
export const INLAND_BYTE = 22;
export const SNOW_BYTE = 112;
/** How far inland (picture units) the plain takes to rise from the shore to INLAND_BYTE. */
export const PLAIN_REACH = 6;
/** The seam: this many pixels past the Bay's edge answer the Bay's own clamped read, so the kernel's windows at the
 *  edge see what they always saw. The kernel's small window reaches 2 past a pixel, its large one 1. */
export const SEAM_PX = 2;
/** The authored ground blends in from the edge's byte over this many pixels after the seam. */
export const BLEND_PX = 12;
/** The ground's cache: pixels remembered before the cache is dropped whole (the stream asks a few hundred). */
export const GROUND_CACHE_MAX = 262144;

/** A small stable lattice hash, 0..1 (the fog's own shape, ui/wild/wildMapInk.js - a hash, not a table). */
export function groundHash(x, y, salt = 0x51ed) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** THE AUTHORED HEIGHT at a picture-grid point, in WOODS bytes: 0 at sea, SHORE_BYTE and up on land - the relief's where
 *  the trace stands (TAMRIEL-RELIEF), the authored law's else. With the relief:
 *   - AUDIT TESA II G4: the ease is the WATERLINE's - the trace's sea field reads a pixel's centre (a land pixel by the sea
 *     reads 1, the waterline between them 0.5), so the ease it read was half at the water and whole half a unit in, and a
 *     shore under high ground stood a third of its height over the water (68 bytes by a lake in Craglorn's heights). Now
 *     SHORE_BYTE at the waterline, the relief's own RELIEF_COAST_REACH inland;
 *   - AUDIT TESA II G12: the land the relief stands never under RELIEF_FLOOR inland (eased up from the shore as the
 *     height is) - the heightmap's dark land, where the trace has land and the picture sea (the Inner Sea), stood at the
 *     shore's own bytes and the kernel's samples dipped under the ocean's floor in sea-level ponds. */
export function authoredHeightByte(px, py, noise = 0) {
  if (!provinceKeyAt(px, py) || straitAt(px, py)) return 0;
  if (reliefStands()) {
    const ease = Math.min(1, Math.max(0, /** @type {number} */ (coastDepthAt(px, py))) / RELIEF_COAST_REACH);   // SMOOTH-LAND: off the smooth waterline (the law's own distance)
    const h = SHORE_BYTE + Math.max(0, reliefAt(px, py) - SHORE_BYTE) * ease + noise;
    return Math.max(Math.round(SHORE_BYTE + (RELIEF_FLOOR - SHORE_BYTE) * ease), Math.min(255, Math.round(h)));   // never under the shore, nor inland under the floor
  }
  const inland = Math.min(1, coastDistanceAt(px, py) / PLAIN_REACH);
  let h = SHORE_BYTE + (INLAND_BYTE - SHORE_BYTE) * inland + noise;
  const lift = rangeLift(px, py);
  if (lift > 0) h = Math.max(h, SHORE_BYTE + (SNOW_BYTE - SHORE_BYTE) * lift);
  return Math.max(SHORE_BYTE, Math.min(255, Math.round(h)));
}

/** TESA x AUDIT TESA II: A STRAIT AT A CORNER (Bay pixels, Chebyshev, about a corner of the trace's pixels). The trace draws a
 *  channel on the diagonal as a staircase of its sea pixels, each meeting the next at one corner; while the shore stood at
 *  the beach line those corners' land read as water (AUDIT TESA II R1 lifted the shore over it), and a boat never sails
 *  through a corner of the land (systems/travel/travelRoute.js) - so the shore closed every such channel: Ebonheart's water
 *  round Vvardenfell was cut off from the sea. The land this near a corner whose four pixels are sea on one diagonal and
 *  land on the other is the sea's, the channel as wide as a boat's step through it. */
export const STRAIT_PX = 1.5;
/** Is the picture point (px, py) a traced strait's - within STRAIT_PX Bay pixels of a corner of the trace's pixels that
 *  joins two of its sea pixels on the diagonal (the other two land)? */
export function straitAt(px, py) {
  if (!tamrielTrace()) return false;
  const reach = STRAIT_PX / (tamrielFit()?.ppu ?? Infinity), cx = Math.round(px), cy = Math.round(py);
  if (Math.abs(px - cx) > reach || Math.abs(py - cy) > reach) return false;
  const sea = (x, y) => !provinceKeyAt(x, y), nw = sea(cx - 0.5, cy - 0.5), ne = sea(cx + 0.5, cy - 0.5), sw = sea(cx - 0.5, cy + 0.5), se = sea(cx + 0.5, cy + 0.5);
  return (nw && se && !ne && !sw) || (ne && sw && !nw && !se);
}

/** How far a Bay-coordinate pixel stands past the Bay's edge, in pixels (0 on the Bay): Chebyshev, so the seam is a
 *  square band round the rectangle as the kernel's window is. */
export function bayEdgeDistance(x, y) {
  return Math.max(0, -x, x - (BAY_W - 1), -y, y - (BAY_H - 1));
}

/** @type {Map<number, number>} */
const _bytes = new Map();
const cacheKey = (x, y) => (x + 8192) * 32768 + (y + 8192);
/** For the pins: the cache's size, and a way to drop it. */
export const groundCacheSize = () => _bytes.size;
export const dropGroundCache = () => { _bytes.clear(); _large.clear(); };   // TAMRIEL-DEEP: the large map reads the land too

/** THE AUTHORED HEIGHT at a Bay-coordinate pixel beyond the Bay (integers), with the lattice noise, cached. Asked of
 *  a pixel on the Bay it still answers the authored law - the composition below is what chooses. RUMARE-WATER
 *  (world/rumareWaters.js rumareBasin): about the Imperial City, where its canal stands, the land let down toward the shore
 *  (SHORE_BYTE) - whole on its span, eased back to its own over RUMARE_BASIN.ramp pixels - so the city at the sea meets
 *  the land round it as a shore; the sea and the land already that low never moved; and the span's pixels the
 *  Waterfront's mouth crosses the sea's (rumareMouthPixel), the canal's water laid on into it. */
export function tamrielHeightByte(x, y) {
  const k = cacheKey(x, y);
  const hit = _bytes.get(k);
  if (hit !== undefined) return hit;
  const [px, py] = bayToPicture(x + 0.5, y + 0.5);
  let byte = rumareMouthPixel(x, y) ? 0 : authoredHeightByte(px, py, (groundHash(x, y) - 0.5) * 4);   // RUMARE-WATER: the mouth's pixels the sea's
  const basin = byte > SHORE_BYTE ? rumareBasin(x, y) : 0;
  if (basin > 0) byte = Math.round(byte - (byte - SHORE_BYTE) * basin);
  byte = gen2Byte(x, y, byte) ?? byte;   // A published region's ground over the law
  byte = landLayer().heightAt(x, y) ?? byte;   // FOUNDATION F4: a row of the land's (world/land/landLayer.js) over the law
  if (_bytes.size >= GROUND_CACHE_MAX) _bytes.clear();
  _bytes.set(k, byte);
  return byte;
}

/** The climate at a Bay-coordinate pixel beyond the Bay: its zone's (TESA-BIOME, world/tamriel/tamrielBiomes.js), or the
 *  Ocean's at sea. AUDIT TESA II K15: every land pixel past the Bay is a zone's (each of the nine provinces has zones, and
 *  biomeAtPicture answers one for any point of a province's land), so the province's own climate it fell back to answered
 *  nothing and is gone; every reader asks of a pixel past the Bay (the Bay's own read the Bay's map). */
export function tamrielClimateAt(x, y) {
  return landLayer().climateAt(x, y) ?? gen2Climate(x, y) ?? tamrielBiomeAt(x, y)?.climate ?? CLIMATES.Ocean;   // FOUNDATION F4: a row's climate first, for every reader; WG2: a published region's next
}

/** AUDIT TESA-BIOME Z4: whether a pixel (px, py)'s 3x3 of climates (ECOTONE1, the host's climates3x3) reads its neighbour
 *  (x, y) - a Bay pixel the Bay's own map alone, as ever; a pixel past the Bay the continent's frame, so a border between
 *  two zones blends (the nature's patchy fade, the ground's neighbour archives) as the Bay's own climates' borders do,
 *  where every neighbour past the Bay had worn the pixel's own and each border was the pixel's straight edge. */
export function climateNeighbourIn(px, py, x, y) {
  if (inBay(px, py)) return inBay(x, y);
  const f = tamrielFrameInBay();
  return x >= f.x0 && y >= f.y0 && x < f.x0 + f.w && y < f.y0 + f.h;
}

/** RELIEF-PEAKS: WOODS.WLD'S LARGE MAP IS ITS SMALL ONE'S OWN LAW. The kernel's second term (terrainSampler.js kernelTerms'
 *  `noise`, x NOISE_MAP_SCALE) was read as detail - "small bytes (0..9)", a swell about 4.5 past the Bay (BREATHTAKER3) - and
 *  it is a third of Daggerfall's height: measured on the freeware's file, a land pixel's inner 3 x 3 stands at 1.18 times
 *  its small byte to byte 85 (12.2 at byte 12, 47.6 at 40, 82.3 at 70, 100.6 at 85, each byte's quartiles within one of its
 *  median) and at the byte itself by the Bay's top (109) - 75 m at byte 15, 265 m at 45, 500 m from 80. So the same byte
 *  stood 50 to 540 m lower past the Bay than on it, and the Wrothgarians fell some 600 m in half a pixel at the Bay's north
 *  edge, where the large map handed from WOODS.WLD's to the swell. Past the Bay's top the continent's bytes run on to
 *  `byteTop` (TAMRIEL-RELIEF's CEILING_BYTE): there the kernel's own height (the small term and the large) runs on from the
 *  top's to DFU's ceiling less the ground noise and a cell's rounding, so a byte past the Bay's tallest is never stood on
 *  DFU's clamp as a plateau - the lift's continuation carries the rest (world/landforms.js continentLift). */
export const LARGE_LAW = Object.freeze({ gain: 1.18, knee: 85, top: 109, byteTop: 180 });
/** The large map's cell for a small byte `b` (fractional) by the law, 0 at sea. */
export function largeOfByte(b) {
  const { gain, knee, top, byteTop } = LARGE_LAW;
  if (!(b > 0)) return 0;
  if (b <= knee) return gain * b;
  if (b <= top) return gain * knee + ((top - gain * knee) * (b - knee)) / (top - knee);
  const h0 = (BASE_HEIGHT_SCALE + NOISE_MAP_SCALE) * top, h1 = MAX_TERRAIN_HEIGHT - EXTRA_NOISE_SCALE - NOISE_MAP_SCALE;
  const h = h0 + (h1 - h0) * Math.min(1, (b - top) / (byteTop - top));
  return Math.max(0, (h - BASE_HEIGHT_SCALE * b) / NOISE_MAP_SCALE);
}

/** The large map's 5 x 5 for a pixel beyond the Bay - data[x][y] as WoodsFile.getLargeMapData shapes it (x east, y south;
 *  the kernel reads the inner 3 x 3). RELIEF-PEAKS: WOODS.WLD's own law (LARGE_LAW, largeOfByte) of the continent's bytes,
 *  each cell the law of the small byte at its own place - a pixel's cells stand about its byte's node (the pixel's
 *  south-east corner) a third of a pixel apart, so a cell's byte is the small term there, the bytes about the node read by
 *  the kernel's own cubic - where it was BREATHTAKER3's swell about 4.5. Deterministic in the pixel, kept. TAMRIEL-DEEP
 *  (bible/03-World/Deep-Waters.md): none at sea, as WOODS.WLD's own sea carries none (0 over 406 of 411 sampled Bay sea
 *  pixels, 1 the most) - detail there lifted the seabed past the Bay into the beach line's reach
 *  (world/deepWater/deepWatersBake.js classifyPixel). RUMARE-WATER: none on the basin's span about the Imperial City, eased
 *  back over its ramp (world/rumareWaters.js rumareBasin), as its bytes are let down to the shore - the city at the sea
 *  stands where it stood. */
/** @type {Map<number, Uint8Array[]>} the pixels' cells, kept (a kernel reads nine a pixel, a neighbour's again) */
const _large = new Map();
export function tamrielLargeMap(x, y) {
  const k = cacheKey(x, y), hit = _large.get(k);
  if (hit) return hit;
  const data = [], sea = tamrielHeightByte(x, y) === 0, keep = 1 - rumareBasin(x, y);   // RUMARE-WATER: the basin's floor the shore's
  // the bytes about the node (x - 2 .. x + 3 each way), and the small term between them as the kernel reads it
  // (terrainSampler.js kernelTerms' `base`: DFU's cubic east, and north from a row to the one above it) - so the two terms
  // are one law at every sample, where a cell read bilinearly stood a pixel-wide ripple of up to 19 m against the cubic
  const win = new Float64Array(36);
  if (!sea) for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) win[j * 6 + i] = tamrielHeightByte(x - 2 + i, y - 2 + j);
  const b = (i, j) => win[(j + 2) * 6 + i + 2];
  for (let ix = 0; ix < 5; ix++) {
    const col = new Uint8Array(5);
    if (!sea) {
      const fx = (ix - 2) / 3, X = Math.floor(fx), tx = fx - X;
      for (let iy = 0; iy < 5; iy++) {
        const fy = (iy - 2) / 3, Y = Math.floor(fy), ty = fy - Y;
        const row = (r) => cubicInterpolator(b(X - 1, r), b(X, r), b(X + 1, r), b(X + 2, r), tx);
        col[iy] = Math.round(keep * largeOfByte(cubicInterpolator(row(Y + 2), row(Y + 1), row(Y), row(Y - 1), 1 - ty)));
      }
    }
    data.push(col);
  }
  if (_large.size >= LARGE_CACHE_MAX) _large.clear();
  _large.set(k, data);
  return data;
}
/** The large map's kept pixels before they are dropped whole. */
const LARGE_CACHE_MAX = 16384;

/** RELIEF-PEAKS: THE LARGE MAP A RECORD PAST THE BAY WAS WRITTEN ON before GROUND_FRAME_LAW 3 (world/terrain/
 *  terrainSampler.js): BREATHTAKER3's swell about 4.5 past the Bay's seam, handed over at the seam, none at sea, the Rumare
 *  basin's let down - kept for that one reader (scenes/groundFrameHost.js groundMovedField: DFU's own ground moved under
 *  the record, stood again by the move). Never the world's ground. */
export const LARGE_SWELL_BEFORE = Object.freeze({ wave: 11, swing: 2.5, mean: 4.5 });
/** The swell's 5 x 5 for a pixel past the Bay, as tamrielLargeMap answered it before RELIEF-PEAKS. */
export function largeMapBefore(x, y) {
  const data = [], { wave, swing, mean } = LARGE_SWELL_BEFORE, sea = tamrielHeightByte(x, y) === 0, keep = 1 - rumareBasin(x, y);
  for (let ix = 0; ix < 5; ix++) {
    const col = new Uint8Array(5);
    if (!sea) for (let iy = 0; iy < 5; iy++) col[iy] = Math.round(keep * (mean + swing * (2 * perlinNoise((x * 5 + ix) / wave + 0.37, (y * 5 + iy) / wave + 0.61) - 1)));
    data.push(col);
  }
  return data;
}
/** RELIEF-PEAKS: the world's composed reader (`woods`: groundWoods' composition, the Eltheric Ocean's over it or not) with
 *  the large map before GROUND_FRAME_LAW 3 past the Bay's seam (largeMapBefore) - DFU's own ground a record written then
 *  stood on. The Bay and its seam band, the Eltheric Ocean's box and the bytes are the reader's own. */
export function groundBefore(woods) {
  const before = Object.create(woods);
  before.getLargeMapData = (x, y) => (bayEdgeDistance(x, y) > SEAM_PX && !inEtherLaw(x, y) ? largeMapBefore(x, y) : woods.getLargeMapData(x, y));
  return before;
}

/**
 * THE COMPOSITION: a WoodsFile with the continent round it. A prototype child of the Bay's own reader, so every
 * read WoodsFile builds on these two (the range reads call them through `this`) answers the continent too, and
 * nothing else about the reader changes - its buffer, its header, its writers stay the Bay's.
 *   - on the Bay, and in the SEAM band past its edge: the Bay's own (clamped) read, to the byte
 *   - past the seam: the authored ground, blended in from the edge's byte over BLEND_PX pixels
 * @param {any} woods - a loaded WoodsFile (or the pins' stub with its two reads)
 */
export function groundWoods(woods) {
  const ground = Object.create(woods);
  ground.getHeightMapValue = function (x, y) {
    const d = bayEdgeDistance(x, y);
    if (d <= SEAM_PX) return woods.getHeightMapValue(x, y);
    const edge = woods.getHeightMapValue(x, y);   // the clamp's answer: the nearest edge pixel's byte
    const t = Math.min(1, (d - SEAM_PX) / BLEND_PX), own = tamrielHeightByte(x, y);
    const b = Math.round(edge * (1 - t) + own * t);
    return own > 0 ? Math.max(SHORE_BYTE, b) : b;   // AUDIT TESA II R1: the trace's land over the beach line in the blend too (an edge at sea had blended it under)
  };
  ground.getLargeMapData = function (x, y) {
    const d = bayEdgeDistance(x, y);
    if (d <= SEAM_PX) return woods.getLargeMapData(x, y);
    const own = tamrielLargeMap(x, y);
    if (d >= SEAM_PX + BLEND_PX) return own;
    // RELIEF-PEAKS: blended in from the edge's own large map (the clamp's answer) over the bytes' own BLEND_PX - it handed
    // over at the seam, a wall of some 600 m along the Wrothgarians' edge
    const edge = woods.getLargeMapData(x, y), t = (d - SEAM_PX) / BLEND_PX, out = [];
    for (let i = 0; i < 5; i++) {
      const col = new Uint8Array(5);
      for (let j = 0; j < 5; j++) col[j] = Math.round(edge[i][j] * (1 - t) + own[i][j] * t);
      out.push(col);
    }
    return out;
  };
  ground.isTamrielGround = true;
  ground.bay = woods;
  return ground;
}

/** The climate read with the continent round it: the Bay's own on the Bay (the reader's, after the coastal
 *  dilation), the province's past it. */
export function groundClimateIndex(bayClimateIndex) {
  return (x, y) => (inBay(x, y) ? bayClimateIndex(x, y) : tamrielClimateAt(x, y));
}

/** TESA-BIOME: THE AIR'S CLIMATE with the continent round it - the Bay's own on the Bay, past it a zone's `air` where the
 *  lore's air is not its ground's (Morrowind's grey volcanic ground, its warm air), else its ground's climate. The air
 *  law's map reads it (systems/weather/airGround.js), and the body's felt air (feltClimateIndex); the ground, the
 *  textures and the encounters' tables never do. */
export function groundAirClimateIndex(bayClimateIndex) {
  return (x, y) => {
    if (inBay(x, y)) return bayClimateIndex(x, y);
    const row = landLayer().climateAt(x, y);   // AUDIT FOUNDATION II L4: a row's climate its air too
    if (row !== undefined) return row;
    const zone = tamrielBiomeAt(x, y);   // AUDIT TESA-BIOME Z7: the zone read once
    return zone ? zone.air ?? zone.climate : tamrielClimateAt(x, y);
  };
}

/**
 * THE AIR A BODY FEELS (TESA-LANDS' audit, the owner: "Definitely fix any bugs you encounter"): a pixel's climate as the
 * survival law reads it (systems/survival/temperature.js CLIMATE_TEMP) - past the Bay a zone's `air` where it names one
 * (groundAirClimateIndex's law), else `climate` (the hosts' map's answer). It read the ground's: the Ashlands' Mountains
 * (-40) under the Dak'fron's Desert2 air (+50) froze a character to death on a summer's walk.
 * @param {number} x @param {number} y @param {number} climate
 */
export function feltClimateIndex(x, y, climate) {
  return (inBay(x, y) || landLayer().climateAt(x, y) !== undefined ? null : tamrielBiomeAt(x, y)?.air) ?? climate;   // AUDIT FOUNDATION II L4: a row's climate felt
}

/** WW-R (bible/03-World/World-Wide.md WW-R): THE POLITIC MAP PAST THE BAY - a province's land its region's politic
 *  (128 + its region, formats/mapsTables.js regionOfTheatre: MapsFile.getRegionIndexAt reads the province's region off
 *  it, as it reads a Bay region off POLITIC.PAK), the sea about it the PAK's own answer off its map (no region's); the
 *  Bay to the byte. @param {(x: number, y: number) => number} bayPoliticIndex */
export function groundPoliticIndex(bayPoliticIndex) {
  return (x, y) => {
    if (inBay(x, y)) return bayPoliticIndex(x, y);
    const r = regionOfTheatre(theatreAt(x, y));
    return r >= 0 ? 128 + r : bayPoliticIndex(x, y);
  };
}

/** The maps' readers composed over the continent's ground (TAMRIEL2's climate, WW-R's politic) - the Bay's to the byte.
 *  @param {{ getClimateIndex: (x: number, y: number) => number, getPoliticIndex: (x: number, y: number) => number }} maps */
export function groundMaps(maps) {
  maps.getClimateIndex = groundClimateIndex(maps.getClimateIndex.bind(maps));
  maps.getPoliticIndex = groundPoliticIndex(maps.getPoliticIndex.bind(maps));
}
