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
import { provinceKeyAt, coastDistanceAt, tamrielTrace } from './tamrielLand.js';   // TAMRIEL3: the picture's own land where it is traced, the authored shape else
import { bayToPicture, inBay, BAY_W, BAY_H, tamrielFrameInBay, tamrielFit } from './tamrielFrame.js';
import { CLIMATES, regionOfTheatre } from '../../formats/mapsTables.js';
import { tamrielBiomeAt } from './tamrielBiomes.js';   // TESA-BIOME: each province's zones, each its own climate and air
import { reliefStands, reliefAt, RELIEF_COAST_REACH, RELIEF_FLOOR } from './tamrielRelief.js';   // TAMRIEL-RELIEF: the owner's heightmap on the trace
import { theatreAt } from '../worldWide/worldGrid.js';   // WW-R: a province's land is its region's
import { WATER_BYTE } from '../roadsProducer.js';   // AUDIT TESA II R1: the beach line the land stands over - one constant

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
    const ease = Math.min(1, Math.max(0, coastDistanceAt(px, py) - 0.5) / RELIEF_COAST_REACH);
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
export const dropGroundCache = () => _bytes.clear();

/** THE AUTHORED HEIGHT at a Bay-coordinate pixel beyond the Bay (integers), with the lattice noise, cached. Asked of
 *  a pixel on the Bay it still answers the authored law - the composition below is what chooses. */
export function tamrielHeightByte(x, y) {
  const k = cacheKey(x, y);
  const hit = _bytes.get(k);
  if (hit !== undefined) return hit;
  const [px, py] = bayToPicture(x + 0.5, y + 0.5);
  const byte = authoredHeightByte(px, py, (groundHash(x, y) - 0.5) * 4);
  if (_bytes.size >= GROUND_CACHE_MAX) _bytes.clear();
  _bytes.set(k, byte);
  return byte;
}

/** The climate at a Bay-coordinate pixel beyond the Bay: its zone's (TESA-BIOME, world/tamriel/tamrielBiomes.js), or the
 *  Ocean's at sea. AUDIT TESA II K15: every land pixel past the Bay is a zone's (each of the nine provinces has zones, and
 *  biomeAtPicture answers one for any point of a province's land), so the province's own climate it fell back to answered
 *  nothing and is gone; every reader asks of a pixel past the Bay (the Bay's own read the Bay's map). */
export function tamrielClimateAt(x, y) {
  return tamrielBiomeAt(x, y)?.climate ?? CLIMATES.Ocean;
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

/** The large map's 5 x 5 of detail for a pixel beyond the Bay - data[x][y] as WoodsFile.getLargeMapData shapes it: a
 *  lattice hash of small bytes (0..9; the kernel scales them by NOISE_MAP_SCALE), deterministic in the pixel. */
export function tamrielLargeMap(x, y) {
  const data = [];
  for (let ix = 0; ix < 5; ix++) {
    const col = new Uint8Array(5);
    for (let iy = 0; iy < 5; iy++) col[iy] = Math.floor(groundHash(x * 5 + ix, y * 5 + iy, 0x2545) * 10);
    data.push(col);
  }
  return data;
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
    return bayEdgeDistance(x, y) <= SEAM_PX ? woods.getLargeMapData(x, y) : tamrielLargeMap(x, y);
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
 *  law's map reads it (systems/weather/airGround.js); the ground, the textures and the tables never do. */
export function groundAirClimateIndex(bayClimateIndex) {
  return (x, y) => {
    if (inBay(x, y)) return bayClimateIndex(x, y);
    const zone = tamrielBiomeAt(x, y);   // AUDIT TESA-BIOME Z7: the zone read once
    return zone ? zone.air ?? zone.climate : tamrielClimateAt(x, y);
  };
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
