// @ts-check
// FOUNDATION F4 (2026-10-30, bible/03-World/Foundation-Arc.md) - THE LAND AS DATA: a shore or a hill fixed by a row of
// landEdits.json. A row is a rectangle of world pixels and its ground: `height` a WOODS byte (water at WATER_LINE and
// under, land at LAND_LEAST and over, nothing between, so every reader of the water agrees), `climate` a CLIMATE.PAK
// byte. Later rows win. On the Bay the rows are written into WOODS.WLD and CLIMATE.PAK as they are served
// (scenes/shared.js fetchBytes), so every host, worker and reader reads one ground; past the Bay the ground's two reads
// ask them first (world/tamriel/tamrielGround.js). Ours: DFU has no land edits.
import LAND from './landEdits.json' with { type: 'json' };
import { worldPixelKey, inWorldGrid } from '../worldWide/worldGrid.js';
import { worldPixelOk } from '../../net/wire.js';
import { inBay } from '../tamriel/tamrielFrame.js';
import { CLIMATES } from '../../formats/mapsTables.js';
import { WoodsFile, MAP_WIDTH } from '../../formats/woodsFile.js';
import { PakFile } from '../../formats/pakFile.js';

/** The highest water byte - ui/overworldModel.js isWaterPixel's (byte x 8 at or under 27.2). */
export const WATER_LINE = 3;
/** The least land byte - tamrielGround.js SHORE_BYTE, over the roads' beach line (roadsProducer.js WATER_BYTE). */
export const LAND_LEAST = 6;
/** The widest side of one row's rectangle, pixels. */
export const LAND_ROW_SIDE_MAX = 64;
const CLIMATE_BYTES = new Set(Object.values(CLIMATES));

/** @typedef {{ x: number, y: number, w?: number, h?: number, height?: number, climate?: number, note: string }} LandRow */

/** A row's problems, as words: none for a good row. @param {any} r */
export function landRowProblems(r) {
  if (!r || typeof r !== 'object') return ['not a row'];
  const out = [], w = r.w ?? 1, h = r.h ?? 1;
  const side = (v) => Number.isSafeInteger(v) && v >= 1 && v <= LAND_ROW_SIDE_MAX;
  if (!worldPixelOk(r.x) || !worldPixelOk(r.y) || !inWorldGrid(r.x, r.y)) out.push('pixel');
  else if (!side(w) || !side(h) || !inWorldGrid(r.x + w - 1, r.y + h - 1)) out.push('size');
  if (r.height !== undefined && !(Number.isSafeInteger(r.height) && r.height >= 0 && r.height <= 255 && (r.height <= WATER_LINE || r.height >= LAND_LEAST))) out.push('height');
  if (r.climate !== undefined && !CLIMATE_BYTES.has(r.climate)) out.push('climate');
  if (r.height === undefined && r.climate === undefined) out.push('says nothing');
  if (typeof r.note !== 'string' || !r.note.trim()) out.push('note');
  return out;
}

/** FNV-1a of a string. @param {string} s */
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };

/**
 * A layer of the rows that are good (a bad one dropped, its index in `dropped`): each pixel's height and climate by its
 * world key, the Bay's pixels apart, and a `stamp` that moves with the rows ('' for none) - the keys of the caches
 * kept between sessions read it. @param {any} json
 */
export function landLayerOf(json) {
  const raw = Array.isArray(json?.edits) ? json.edits : [];
  /** @type {LandRow[]} */ const rows = [];
  /** @type {number[]} */ const dropped = [];
  raw.forEach((r, i) => (landRowProblems(r).length ? dropped.push(i) : rows.push(Object.freeze({ ...r }))));
  /** @type {Map<number, { height?: number, climate?: number }>} */ const at = new Map();
  /** @type {Map<number, [number, number]>} */ const bay = new Map();
  for (const r of rows) {
    for (let y = r.y; y < r.y + (r.h ?? 1); y++) for (let x = r.x; x < r.x + (r.w ?? 1); x++) {
      const k = worldPixelKey(x, y), was = at.get(k) ?? {};
      at.set(k, { ...was, ...(r.height !== undefined ? { height: r.height } : {}), ...(r.climate !== undefined ? { climate: r.climate } : {}) });
      if (inBay(x, y)) bay.set(k, [x, y]);
    }
  }
  return Object.freeze({
    rows: Object.freeze(rows), dropped: Object.freeze(dropped), size: at.size, stamp: rows.length ? fnv(JSON.stringify(rows)) : '',
    /** A pixel's edited height, or undefined. @param {number} x @param {number} y */
    heightAt: (x, y) => (at.size ? at.get(worldPixelKey(x, y))?.height : undefined),
    /** A pixel's edited climate, or undefined. @param {number} x @param {number} y */
    climateAt: (x, y) => (at.size ? at.get(worldPixelKey(x, y))?.climate : undefined),
    /** The Bay's edited pixels: `[x, y, { height?, climate? }]`. */
    bayPixels: () => [...bay].map(([k, [x, y]]) => /** @type {const} */ ([x, y, /** @type {{ height?: number, climate?: number }} */ (at.get(k))])),
  });
}
/** @typedef {ReturnType<typeof landLayerOf>} LandLayer */

let _game = /** @type {LandLayer|null} */ (null);
let _layer = /** @type {LandLayer|null} */ (null);
/** The layer every reader reads: the game's file, or a test's (setLandLayer). */
export const landLayer = () => (_layer ??= _game ??= landLayerOf(LAND));
/** For the pins: a layer in place of the game's; none given, the game's again. @param {LandLayer|null} [layer] */
export const setLandLayer = (layer = null) => { _layer = layer; served.clear(); };

/** @type {Map<string, WeakMap<Uint8Array, Uint8Array>>} */ const served = new Map();
/**
 * A game file as the land serves it: WOODS.WLD and CLIMATE.PAK with the Bay's rows written in (a copy, made once for
 * each read of the file), any other file and a file no row touches as it came. @param {string} name @param {Uint8Array} bytes
 */
export function landServedBytes(name, bytes, layer = landLayer()) {
  const file = String(name).toUpperCase();
  if ((file !== 'WOODS.WLD' && file !== 'CLIMATE.PAK') || !(bytes instanceof Uint8Array)) return bytes;
  const edits = layer.bayPixels().filter(([, , e]) => (file === 'WOODS.WLD' ? e.height !== undefined : e.climate !== undefined));
  if (!edits.length) return bytes;
  let kept = served.get(layer.stamp + file);
  if (!kept) served.set(layer.stamp + file, (kept = new WeakMap()));
  const had = kept.get(bytes);
  if (had) return had;
  const out = file === 'WOODS.WLD' ? servedWoods(bytes, edits) : servedClimate(bytes, edits);
  kept.set(bytes, out);
  return out;
}

/** @param {Uint8Array} bytes @param {ReadonlyArray<readonly [number, number, { height?: number }]>} edits */
function servedWoods(bytes, edits) {
  const w = new WoodsFile();
  if (!w.load(new Uint8Array(bytes))) return bytes;
  for (const [x, y, e] of edits) {
    const i = y * MAP_WIDTH + x;   // BAY-OWN: WOODS.WLD's own grid (an edit on the Bay)
    w.heightMapBuffer[i] = /** @type {number} */ (e.height);
    if (/** @type {number} */ (e.height) <= WATER_LINE) w._bytes.fill(0, w.dataOffsets[i] + 22, w.dataOffsets[i] + 22 + 25);   // the 5 x 5 detail (woodsFile.js getLargeMapData)
  }
  w.syncHeightMapBytes();
  return w._bytes;
}

/** @param {Uint8Array} bytes @param {ReadonlyArray<readonly [number, number, { climate?: number }]>} edits */
function servedClimate(bytes, edits) {
  const p = new PakFile();
  if (!p.load(bytes)) return bytes;
  for (const [x, y, e] of edits) p.setValue(x + 1, y, /** @type {number} */ (e.climate));   // mapsFile.js getClimateIndex: +1 x
  return p.encode();
}
