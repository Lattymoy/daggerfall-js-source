// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WATER-PUDDLE (2026-09-25, Mac: "fixing any and all issues (especially
// with ingame puddles and tiles in towns that are one square)"): THE
// PUDDLE IS THE ART'S.
//
// DFU's shallow-water records - the town docks, moats and puddles (8, 23,
// 33-36; world/water/waterCorners.js SHALLOW_WHOLE) and record 9 - carry their
// water as a SHAPE painted on the tile: a pool on sand, a puddle in the
// grass. The enhanced water pass knew them only as "whole" (their corners
// all four), so it laid a full 6.4 m square of shimmering water over the
// art, and every puddle in the Bay read as a flat blue square - the shot
// that opened this slice is a record-23 tile in the desert by Bubumbaret.
//
// This leaf reads each such record's own texels: a texel is water where
// its colour sits within WATER_COLOUR_TOLERANCE of one of the water tile's
// (record 0's) own colours - WATER5's rule (reverted with the basin in
// MAC5, and brought back here for these records alone; every other tile
// keeps WATER1's corner table and its look). The answer rides in the
// ALPHA of that record's layer of the ground tile array: every reader of
// the array takes `.rgb` (TERRAIN_FS, the enhanced lighting's terrain, the
// water's own texel), so the alpha is the one channel free to say it, and
// the array's mip chain carries it into the distance with no second
// texture. The water pass discards a puddle texel the alpha calls dry.
//
// THE FEET ARE NOT ASKED. Where the player WADES stays DFU's
// PlayerMotor.OnShallowWaterTile - the whole tile (WATER-DRAW1's split:
// the draw and the law are two questions). This is the picture only.
// ═══════════════════════════════════════════════════════════════════

import { SHALLOW_WHOLE, SHALLOW_DRAWN, WATER_DRAW_MASK_TABLE } from './water/waterCorners.js';

/** The records the pass drew whole, in order: record 9 and DFU's shallow-water tiles. */
export const PUDDLE_RECORDS = Object.freeze([...new Set([...SHALLOW_DRAWN, ...SHALLOW_WHOLE])].sort((a, b) => a - b));
/** The records a ground archive paints (DFU's 56). */
const GROUND_RECORDS = 56;
const anyTurn = (r) => [0, 1, 2, 3].some((t) => WATER_DRAW_MASK_TABLE[(r << 2) | t]);
/**
 * SHORE-SILT (2026-10-12, Dudey's field video: a village pond's dirt shore, and a town's, freckled with blue blotches
 * where the new water's bed should be): the records the draw calls part water and part ground - the marching shores,
 * WATER-DRAW2's corners and saddles - whose water is NOT the art's alone (the puddles above are). The bed's silt
 * (render/waterBedGlsl.js) covered their water where the corner table's bilinear coverage lies, and the art paints its
 * water as a ragged shape that reaches past that line - 7 to 34% of a temperate shore tile was painted water left
 * bare, outside the silt and outside the sheet: flat blue paint on the bank.
 */
export const SHORE_RECORDS = Object.freeze(Array.from({ length: GROUND_RECORDS - 1 }, (_, i) => i + 1)
  .filter((r) => anyTurn(r) && !PUDDLE_RECORDS.includes(r)));
/** SHORE-SILT: the records with no water at any turn - the ground the shores' water is told apart from. */
export const DRY_RECORDS = Object.freeze(Array.from({ length: GROUND_RECORDS - 1 }, (_, i) => i + 1).filter((r) => !anyTurn(r)));

/** How far (Euclidean RGB, 0..255 a channel) from one of the water tile's colours a texel may sit and still be water:
 *  a puddle's lighter or darker blue counts, a brown or a green does not (WATER5's tolerance). */
export const WATER_COLOUR_TOLERANCE = 24;

/** The smallest patch the art paints that counts: a speck of blue in the sand under this many texels is the ground's
 *  own grain, and a fleck of mud inside a pool under it is the pool's - the texel colour rule alone salts every tile
 *  with single shimmering texels (the ground's palette shares its blues). */
export const MIN_PATCH_TEXELS = 32;

/**
 * The colour rule's answer made into shapes: water patches under
 * `minArea` texels (4-connected) turn dry wherever they lie, and dry
 * patches under it turn wet unless they reach the tile's edge - a dry
 * patch at the edge is the neighbour's ground reaching in, and is kept
 * whatever its size.
 * @param {Uint8Array} wet - 1 water, 0 dry, row-major
 * @returns {Uint8Array} the same array, cleaned
 */
export function cleanMask(wet, w, h, minArea = MIN_PATCH_TEXELS) {
  // OW-HITCH (2026-10-21, the owner: "Theres still a lot of hitching in the overworld"): the same patches, found with no
  // array a texel - the walk made four neighbours' array at every texel it reached (a 256-texel set's 3.6 million), and
  // a ground set met at a new climate on the journey was built in one frame. A patch is a 4-connected component, so the
  // order it is walked in moves nothing; its texels are a run of `patch` (a stack's worth at most: every texel once).
  const n = w * h, seen = new Uint8Array(n), stack = new Int32Array(n), patch = new Int32Array(n);
  for (let pass = 0; pass < 2; pass++) {
    const want = pass === 0 ? 1 : 0;
    if (pass) seen.fill(0);
    for (let start = 0; start < n; start++) {
      if (seen[start] || wet[start] !== want) continue;
      let top = 0, size = 0;
      stack[top++] = start; seen[start] = 1;
      let edge = false;
      while (top) {
        const i = stack[--top], x = i % w, y = (i - x) / w;
        patch[size++] = i;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
        if (x > 0 && !seen[i - 1] && wet[i - 1] === want) { seen[i - 1] = 1; stack[top++] = i - 1; }
        if (x < w - 1 && !seen[i + 1] && wet[i + 1] === want) { seen[i + 1] = 1; stack[top++] = i + 1; }
        if (y > 0 && !seen[i - w] && wet[i - w] === want) { seen[i - w] = 1; stack[top++] = i - w; }
        if (y < h - 1 && !seen[i + w] && wet[i + w] === want) { seen[i + w] = 1; stack[top++] = i + w; }
      }
      if (size < minArea && (want === 1 || !edge)) for (let k = 0; k < size; k++) wet[patch[k]] = 1 - want;
    }
  }
  return wet;
}

/** OW-HITCH: a count a 24-bit colour, by open addressing in typed arrays - a Map's get and set a texel was most of what a
 *  tile set's shores cost (shoreWaterColours counts every texel of thirty records). `add(key)` counts one; `get(key)` its
 *  count (0 for none); `forEach(fn)` each colour counted and its count. */
class ColourCounts {
  constructor() { this._grow(1 << 12); this.size = 0; }
  _grow(cap) {
    const oldK = this.keys, oldC = this.counts;
    this.keys = new Int32Array(cap).fill(-1); this.counts = new Float64Array(cap); this.mask = cap - 1;
    if (oldK) for (let i = 0; i < oldK.length; i++) if (oldK[i] >= 0) { const at = this._slot(oldK[i]); this.keys[at] = oldK[i]; this.counts[at] = oldC[i]; }
  }
  _slot(key) {
    let i = Math.imul(key, 0x9e3779b1) >>> 0 & this.mask;
    while (this.keys[i] !== -1 && this.keys[i] !== key) i = (i + 1) & this.mask;
    return i;
  }
  add(key) {
    let i = this._slot(key);
    if (this.keys[i] === -1) {
      if ((this.size + 1) * 2 > this.keys.length) { this._grow(this.keys.length * 2); i = this._slot(key); }
      this.keys[i] = key; this.size++;
    }
    this.counts[i]++;
  }
  get(key) { const i = this._slot(key); return this.keys[i] === key ? this.counts[i] : 0; }
  forEach(fn) { for (let i = 0; i < this.keys.length; i++) if (this.keys[i] >= 0) fn(this.keys[i], this.counts[i]); }
}

/** A color32 layer's bytes (RGBA), whatever typed array carries them. */
const bytesOf = (layer) => new Uint8Array(layer.colors.buffer, layer.colors.byteOffset, layer.width * layer.height * 4);

/** The water tile's own colours: every RGB record 0 paints, once each. */
export function waterColours(layer0) {
  const b = bytesOf(layer0), seen = new Set(), out = [];
  for (let i = 0; i < b.length; i += 4) {
    const k = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    if (!seen.has(k)) { seen.add(k); out.push([b[i], b[i + 1], b[i + 2]]); }
  }
  return out;
}

/**
 * The ground archive's layers with each puddle record's water in its
 * alpha - 255 where the art paints water, 0 where it paints ground,
 * cleaned into shapes (`cleanMask`). The
 * puddle layers are COPIED before they are written (a record's color32
 * may be another reader's too); every other layer is handed back as it
 * came. An archive with no water tile is handed back untouched.
 * SHORE-SILT: the shore records' layers are copied and marked too, by their own rule (markShoreWater).
 * @param {Array<{width: number, height: number, colors: ArrayBufferView}>} layers - by record
 */
export function markPuddleWater(layers, tolerance = WATER_COLOUR_TOLERANCE) {
  return stepsDone(markPuddleWaterSteps(layers, tolerance));
}

/** OW-HITCH (2026-10-21, the owner: "Theres still a lot of hitching in the overworld"): A TILE SET'S WATER, A RECORD AT A
 *  TIME. The streaming host meets a ground set at every new climate and season a journey reaches - on the snow lane its
 *  winter twin with it - and marked its puddles and shores inside the build in one go: a 256-texel set (Vanilla
 *  Enhanced, worn by default) and its classic shapes, a fifth of a second and more, twice. The marks are walks over the
 *  records, so each is a generator that yields between them (`...Steps`): `stepsDone` runs one to its end (the readers
 *  that want it now, every function below by its old name), `stepsBreathing` gives the frame back between records
 *  through the host's breather. The same records, in the same order: the same bytes. */
export function stepsDone(steps) {
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}
/** OW-HITCH: `steps` run with `breathe()` awaited between them (the build's breather: a frame given back once its slice
 *  is spent, a microtask before). */
export async function stepsBreathing(steps, breathe) {
  for (;;) { const r = steps.next(); if (r.done) return r.value; await breathe(); }
}
/** OW-HITCH: markPuddleWater a record at a time (yields between them); its value the marked layers. */
export function* markPuddleWaterSteps(layers, tolerance = WATER_COLOUR_TOLERANCE) {
  if (!layers?.[0]) return layers;
  const water = waterColours(layers[0]);
  const t2 = tolerance * tolerance;
  const verdict = new Map();
  const isWater = (r, g, b) => {
    const k = (r << 16) | (g << 8) | b;
    let v = verdict.get(k);
    if (v === undefined) {
      v = water.some(([wr, wg, wb]) => (r - wr) ** 2 + (g - wg) ** 2 + (b - wb) ** 2 <= t2);
      verdict.set(k, v);
    }
    return v;
  };
  const out = layers.slice();
  for (const rec of PUDDLE_RECORDS) {
    const layer = layers[rec];
    if (!layer) continue;
    const b = bytesOf(layer).slice();
    const wet = new Uint8Array(layer.width * layer.height);
    for (let i = 0; i < wet.length; i++) wet[i] = isWater(b[i * 4], b[i * 4 + 1], b[i * 4 + 2]) ? 1 : 0;
    cleanMask(wet, layer.width, layer.height);
    for (let i = 0; i < wet.length; i++) b[i * 4 + 3] = wet[i] ? 255 : 0;
    out[rec] = { ...layer, colors: b };
    yield;
  }
  return yield* markShoreWaterSteps(out);   // SHORE-SILT: and each shore's painted water, by its own rule (markShoreWater)
}

/** SHORE-SILT: how much rarer on the dry tiles than on the wet ones a colour must be to be the water's - twenty times. */
export const SHORE_DRY_RATIO = 0.05;

/**
 * SHORE-SILT: the colours that are the WATER's - painted by the wet tiles (record 0 and the shores) and twenty times
 * rarer, as a share of the texels, on the dry ones (every record with no water at any turn). WATER5's tolerance cannot
 * tell a shore's water from its ground: measured on ARENA2 it calls 30-100% of a dry record wet in the mountains, the
 * swamp and every winter and rain set (their grounds share the water's blues). Asking the archive's own dry tiles
 * does: a colour they paint is ground. And a shore paints more than record 0's blues - Vanilla Enhanced (worn by
 * default) feathers its water into the bank in blue-greys record 0 never uses, and a blue its stone uses a few times
 * in 2.6 million texels is still the water's, so the rule is a share, not an exclusion.
 */
export function shoreWaterColours(layers) {
  return stepsDone(shoreWaterColoursSteps(layers));
}
/** OW-HITCH: shoreWaterColours a record at a time. */
export function* shoreWaterColoursSteps(layers) {
  function* count(records) {
    const c = new ColourCounts();   // OW-HITCH: the same counts, in typed arrays
    let total = 0;
    for (const r of records) {
      if (!layers[r]) continue;
      const b = bytesOf(layers[r]);
      total += b.length / 4;
      for (let i = 0; i < b.length; i += 4) c.add((b[i] << 16) | (b[i + 1] << 8) | b[i + 2]);
      yield;
    }
    return { c, total: Math.max(total, 1) };
  }
  const wet = yield* count([0, ...SHORE_RECORDS]), dry = yield* count(DRY_RECORDS);
  const water = new Set();
  wet.c.forEach((k, n) => { if (dry.c.get(k) / dry.total < SHORE_DRY_RATIO * n / wet.total) water.add(k); });
  return water;
}

/** SHORE-SILT: each shore record's own water in its layer's alpha (255 water, 0 ground), cleaned into shapes - the
 *  shores' layers copied, every other layer handed back as it came. Its one reader is the bed's silt. */
export function markShoreWater(layers) {
  return stepsDone(markShoreWaterSteps(layers));
}
/** OW-HITCH: markShoreWater a record at a time. */
export function* markShoreWaterSteps(layers) {
  if (!layers?.[0]) return layers;
  const water = yield* shoreWaterColoursSteps(layers);
  const out = layers.slice();
  let lastKey = -1, lastWet = 0;   // OW-HITCH: a texel the colour of the last is its answer - a tile paints in runs
  for (const rec of SHORE_RECORDS) {
    const layer = layers[rec];
    if (!layer) continue;
    const b = new Uint8Array(bytesOf(layer));   // a copy: a record's color32 may be another reader's too
    const wet = new Uint8Array(layer.width * layer.height);
    for (let i = 0; i < wet.length; i++) {
      const k = (b[i * 4] << 16) | (b[i * 4 + 1] << 8) | b[i * 4 + 2];
      if (k !== lastKey) { lastKey = k; lastWet = water.has(k) ? 1 : 0; }
      wet[i] = lastWet;
    }
    cleanMask(wet, layer.width, layer.height, MIN_PATCH_TEXELS * Math.max(1, (layer.width * layer.height) / 4096));   // a speck is a speck at any size: Vanilla Enhanced paints 256 x 256
    for (let i = 0; i < wet.length; i++) b[i * 4 + 3] = 255 * wet[i];
    out[rec] = { ...layer, colors: b };
    yield;
  }
  return out;
}

/** The pass's turn on the CPU (render/waterSurface.js PUDDLE_ROT / PUDDLE_TRANS, which are TERRAIN_FS's ROT): a
 *  fraction across the tile, in the tilemap's frame, to the fraction across the record's own art. */
export function turnFraction(turn, fx, fz) {
  switch (turn & 3) {
    case 1: return [fz, 1 - fx];
    case 2: return [1 - fx, 1 - fz];
    case 3: return [1 - fz, fx];
    default: return [fx, fz];
  }
}

/**
 * Does the art paint water under this point of a puddle record's tile -
 * the texel the pass's alpha read lands on, at the pass's own middle (0.5)?
 * @param {{width: number, height: number, colors: ArrayBufferView}} layer - markPuddleWater's copy of the record
 * @param {number} byte - the tilemap byte (its turn in the low two bits)
 * @param {number} fx - the fraction across the tile, 0..1, along x
 * @param {number} fz - and along z
 */
export function puddleWetAt(layer, byte, fx, fz) {
  const [u, v] = turnFraction(byte & 3, fx, fz);
  const x = Math.min(layer.width - 1, Math.max(0, Math.floor(u * layer.width)));
  const y = Math.min(layer.height - 1, Math.max(0, Math.floor(v * layer.height)));
  return bytesOf(layer)[(y * layer.width + x) * 4 + 3] >= 128;
}

/**
 * GROUND1-W (a player's screenshot: a town's shallow water as brown mud under a blue sheen, with DREAM's ground
 * attached): A MOD'S TILE SET TAKES ITS PUDDLES' SHAPES FROM THE CLASSIC ONE. The colour rule above reads a
 * palette tile - record 0 paints a few dozen blues and a puddle's water is exactly those. A truecolour tile set
 * (DREAM's 256x256 `302-TexArray`) paints tens of thousands of colours in its water, browns among them, so "within
 * 24 of one of them" called half the sand wet and half the pool dry - and cost a colour search per texel against
 * every one of them. DREAM repaints the same records in the same layout, so the shape is the classic record's:
 * its mask, marked by the rule it was written for, is carried onto the mod's layer, stretched to its size.
 * @param {Array<{width:number,height:number,colors:ArrayLike<number>}>} modLayers - the mod's layers, unmarked
 * @param {Array<{width:number,height:number,colors:ArrayLike<number>}>} classicMarked - markPuddleWater(classic)
 * @returns the mod's layers with each puddle record's alpha set from the classic mask
 */
export function carryPuddleMask(modLayers, classicMarked) {
  return stepsDone(carryPuddleMaskSteps(modLayers, classicMarked));
}
/** OW-HITCH: carryPuddleMask a record at a time. */
export function* carryPuddleMaskSteps(modLayers, classicMarked) {
  const out = modLayers.slice();
  for (const rec of [...PUDDLE_RECORDS, ...SHORE_RECORDS]) {   // SHORE-SILT: and the shores' water (Vanilla Enhanced, worn by default, repaints them in the classic layout)
    const m = modLayers[rec], c = classicMarked?.[rec];
    if (!m || !c) continue;
    const src = bytesOf(c), b = bytesOf(m).slice();
    for (let y = 0; y < m.height; y++) {
      const sy = Math.min(c.height - 1, Math.floor(y * c.height / m.height));
      for (let x = 0; x < m.width; x++) {
        const sx = Math.min(c.width - 1, Math.floor(x * c.width / m.width));
        b[(y * m.width + x) * 4 + 3] = src[(sy * c.width + sx) * 4 + 3];
      }
    }
    out[rec] = { ...m, colors: b };
    yield;
  }
  // SHORE-SILT: a set painted in Daggerfall's own palette (Vanilla Enhanced, worn by default) paints its shores' water
  // past the classic shape - a feathered edge of blue flecks in the grass - so its shores are read by the rule itself,
  // on its own colours; a truecolour set (GROUND1-W's DREAM) keeps the classic shape carried above
  return palettedSet(modLayers) ? yield* markShoreWaterSteps(out) : out;
}

/** SHORE-SILT: does a tile set paint in a palette - its water tile in at most 256 colours? */
export function palettedSet(layers) {
  if (!layers?.[0]) return false;
  const b = bytesOf(layers[0]), seen = new Set();
  for (let i = 0; i < b.length; i += 4) {
    seen.add((b[i] << 16) | (b[i + 1] << 8) | b[i + 2]);
    if (seen.size > 256) return false;
  }
  return true;
}
