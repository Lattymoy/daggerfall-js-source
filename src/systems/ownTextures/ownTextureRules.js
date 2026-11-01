// @ts-check
// OUR OWN TEXTURE TREATMENTS. Each rule makes a new picture from the player's own classic record
// (formats/classicPictures.js); no author's picture is read, sampled or measured. Pure, no DOM: the page and the build
// worker run the same code. enhance: an edge-aware upscale, our grain, a gentle grade. road: enhance with the paving's
// stones raised. desert: the Alik'r's sand, pale and rippled. snow: snow laid by slope and exposure. And the snow
// runtime's masks (snowMask) and albedo (snowAlbedo).

/** @typedef {{ width: number, height: number, data: Uint8Array | Uint8ClampedArray }} Rgba */

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smooth = (a, b, value) => {
  const fraction = clamp01((value - a) / (b - a));
  return fraction * fraction * (3 - 2 * fraction);
};
const lumaOf = (red, green, blue) => (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
const wrapI = (i, n) => ((i % n) + n) % n;
const clampI = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);

/** A 32-bit integer hash of a lattice point and a seed, as [0, 1). */
export function hash01(x, y, seed) {
  let hash = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in [0, 1) over a lattice of `cells` x `cells` that wraps, read at (cellX, cellY) in cells - so a picture
 * whose
 *  side is a whole number of cells tiles. */
export function tileNoise(cellX, cellY, cells, seed) {
  const i = Math.floor(cellX),
    j = Math.floor(cellY);
  const fracX = cellX - i,
    fracY = cellY - j;
  const easeX = fracX * fracX * (3 - 2 * fracX),
    easeY = fracY * fracY * (3 - 2 * fracY);
  const column0 = wrapI(i, cells),
    column1 = wrapI(i + 1, cells),
    row0 = wrapI(j, cells),
    row1 = wrapI(j + 1, cells);
  const topLeft = hash01(column0, row0, seed),
    topRight = hash01(column1, row0, seed),
    bottomLeft = hash01(column0, row1, seed),
    bottomRight = hash01(column1, row1, seed);
  const top = topLeft + (topRight - topLeft) * easeX;
  return top + (bottomLeft + (bottomRight - bottomLeft) * easeX - top) * easeY;
}

/** Octaves of tileNoise across a width x height picture, centred on 0 (about +-1): `cells` the coarsest lattice across the
 *  picture's width, doubled each octave, each half as strong. */
export function textureGrain(width, height, cells, octaves, seed) {
  const out = new Float32Array(width * height);
  let amp = 1,
    total = 0;
  const rowEase = new Float32Array(height),
    rowCell = new Int32Array(height),
    columnEase = new Float32Array(width),
    columnCell = new Int32Array(width);
  for (let octave = 0; octave < octaves; octave++) {
    const cellsAcross = cells << octave,
      cellsDown = Math.max(1, Math.round((cellsAcross * height) / width));
    // the lattice once (tileNoise's values), then each texel a smoothstep blend of its four corners
    const lat = new Float32Array(cellsAcross * cellsDown);
    for (let j = 0; j < cellsDown; j++)
      for (let i = 0; i < cellsAcross; i++) lat[j * cellsAcross + i] = 2 * hash01(i, j, seed + octave * 7919) - 1;
    for (let x = 0; x < width; x++) {
      const cellX = ((x + 0.5) * cellsAcross) / width,
        i = Math.floor(cellX),
        fraction = cellX - i;
      columnCell[x] = i % cellsAcross;
      columnEase[x] = fraction * fraction * (3 - 2 * fraction);
    }
    for (let y = 0; y < height; y++) {
      const cellY = ((y + 0.5) * cellsDown) / height,
        j = Math.floor(cellY),
        fraction = cellY - j;
      rowCell[y] = j % cellsDown;
      rowEase[y] = fraction * fraction * (3 - 2 * fraction);
    }
    for (let y = 0; y < height; y++) {
      const row0 = rowCell[y] * cellsAcross,
        row1 = ((rowCell[y] + 1) % cellsDown) * cellsAcross,
        easeY = rowEase[y];
      for (let x = 0; x < width; x++) {
        const column0 = columnCell[x],
          column1 = (column0 + 1) % cellsAcross,
          easeX = columnEase[x];
        const top = lat[row0 + column0] + (lat[row0 + column1] - lat[row0 + column0]) * easeX;
        const bottom = lat[row1 + column0] + (lat[row1 + column1] - lat[row1 + column0]) * easeX;
        out[y * width + x] += amp * (top + (bottom - top) * easeY);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** The classic picture with every clear texel's colour taken from its opaque neighbours, so an upscale's blend at a
 *  sprite's edge never pulls in the clear texels' black. The alpha is kept. */
export function bleedClear(src) {
  const { width, height } = src;
  const data = new Uint8Array(src.data);
  const known = new Uint8Array(width * height);
  let todo = [];
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] === 0) todo.push(i);
    else known[i] = 1;
  }
  for (let pass = 0; pass < 4 && todo.length; pass++) {
    const filled = [],
      left = [];
    for (const i of todo) {
      const x = i % width,
        y = (i / width) | 0;
      let red = 0,
        green = 0,
        blue = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const neighbourX = x + dx,
            neighbourY = y + dy;
          if (
            neighbourX < 0 ||
            neighbourY < 0 ||
            neighbourX >= width ||
            neighbourY >= height ||
            !known[neighbourY * width + neighbourX]
          )
            continue;
          const k = (neighbourY * width + neighbourX) * 4;
          red += data[k];
          green += data[k + 1];
          blue += data[k + 2];
          n++;
        }
      if (n) filled.push(i, red / n, green / n, blue / n);
      else left.push(i);
    }
    for (let entry = 0; entry < filled.length; entry += 4) {
      const i = filled[entry];
      data[i * 4] = filled[entry + 1];
      data[i * 4 + 1] = filled[entry + 2];
      data[i * 4 + 2] = filled[entry + 3];
      known[i] = 1;
    }
    todo = left;
  }
  return { width, height, data };
}

/** Catmull-Rom's four weights at fraction t. */
function cubicWeights(fraction, out, offset) {
  const squared = fraction * fraction,
    cubed = squared * fraction;
  out[offset] = -0.5 * cubed + squared - 0.5 * fraction;
  out[offset + 1] = 1.5 * cubed - 2.5 * squared + 1;
  out[offset + 2] = -1.5 * cubed + 2 * squared + 0.5 * fraction;
  out[offset + 3] = 0.5 * cubed - 0.5 * squared;
}

/**
 * THE EDGE-AWARE UPSCALE. Catmull-Rom, one axis and then the other, each output texel clamped to the range of the four
 * source texels nearest it - a cubic's overshoot past an edge is what draws a halo, and the clamp takes it away while
 * the curve keeps the edge's slope. A tile wraps (`wrap`), a sprite's border is its own edge. The alpha is the same
 * curve cut at half, so a sprite's outline is smoothed and stays a cutout. Smaller than the record: a box filter.
 * @param {Rgba} src @param {number} width @param {number} height @param {boolean} wrap @returns {Rgba}
 */
export function upscaleEdgeAware(src, width, height, wrap) {
  const { width: srcWidth, height: srcHeight } = src;
  if (width <= srcWidth && height <= srcHeight) return boxFit(src, width, height);
  const bled = bleedClear(src).data;
  const at = wrap ? wrapI : clampI;
  // each output column's four taps and their weights, and its two nearest source columns (the clamp's range)
  const tap = new Int32Array(width * 4),
    weightsX = new Float32Array(width * 4),
    near = new Int32Array(width * 2);
  for (let x = 0; x < width; x++) {
    const srcX = ((x + 0.5) * srcWidth) / width - 0.5,
      i = Math.floor(srcX);
    cubicWeights(srcX - i, weightsX, x * 4);
    for (let k = 0; k < 4; k++) tap[x * 4 + k] = at(i - 1 + k, srcWidth) * 4;
    near[x * 2] = at(i, srcWidth) * 4;
    near[x * 2 + 1] = at(i + 1, srcWidth) * 4;
  }
  // the horizontal pass: sh rows of w texels, four channels, float
  const mid = new Float32Array(srcHeight * width * 4);
  for (let y = 0; y < srcHeight; y++) {
    const row = y * srcWidth * 4;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0;
      for (let k = 0; k < 4; k++) {
        const tapAt = row + tap[x * 4 + k],
          weight = weightsX[x * 4 + k];
        red += bled[tapAt] * weight;
        green += bled[tapAt + 1] * weight;
        blue += bled[tapAt + 2] * weight;
        alpha += bled[tapAt + 3] * weight;
      }
      mid[offset] = red;
      mid[offset + 1] = green;
      mid[offset + 2] = blue;
      mid[offset + 3] = alpha;
    }
  }
  const out = new Uint8Array(width * height * 4);
  const weightsY = new Float32Array(4);
  for (let y = 0; y < height; y++) {
    const srcY = ((y + 0.5) * srcHeight) / height - 0.5,
      j = Math.floor(srcY);
    cubicWeights(srcY - j, weightsY, 0);
    const midRow0 = at(j - 1, srcHeight) * width * 4,
      midRow1 = at(j, srcHeight) * width * 4,
      midRow2 = at(j + 1, srcHeight) * width * 4,
      midRow3 = at(j + 2, srcHeight) * width * 4;
    const nearRow0 = at(j, srcHeight) * srcWidth * 4,
      nearRow1 = at(j + 1, srcHeight) * srcWidth * 4;
    const weight0 = weightsY[0],
      weight1 = weightsY[1],
      weight2 = weightsY[2],
      weight3 = weightsY[3];
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4,
        midColumn = x * 4;
      const corner0 = nearRow0 + near[x * 2],
        corner1 = nearRow0 + near[x * 2 + 1],
        corner2 = nearRow1 + near[x * 2],
        corner3 = nearRow1 + near[x * 2 + 1];
      for (let channel = 0; channel < 4; channel++) {
        let value =
          mid[midRow0 + midColumn + channel] * weight0 +
          mid[midRow1 + midColumn + channel] * weight1 +
          mid[midRow2 + midColumn + channel] * weight2 +
          mid[midRow3 + midColumn + channel] * weight3;
        const cornerValue0 = bled[corner0 + channel],
          cornerValue1 = bled[corner1 + channel],
          cornerValue2 = bled[corner2 + channel],
          cornerValue3 = bled[corner3 + channel];
        const lo =
          cornerValue0 < cornerValue1
            ? cornerValue0 < cornerValue2
              ? cornerValue0 < cornerValue3
                ? cornerValue0
                : cornerValue3
              : cornerValue2 < cornerValue3
                ? cornerValue2
                : cornerValue3
            : cornerValue1 < cornerValue2
              ? cornerValue1 < cornerValue3
                ? cornerValue1
                : cornerValue3
              : cornerValue2 < cornerValue3
                ? cornerValue2
                : cornerValue3;
        const hi =
          cornerValue0 > cornerValue1
            ? cornerValue0 > cornerValue2
              ? cornerValue0 > cornerValue3
                ? cornerValue0
                : cornerValue3
              : cornerValue2 > cornerValue3
                ? cornerValue2
                : cornerValue3
            : cornerValue1 > cornerValue2
              ? cornerValue1 > cornerValue3
                ? cornerValue1
                : cornerValue3
              : cornerValue2 > cornerValue3
                ? cornerValue2
                : cornerValue3;
        value = value < lo ? lo : value > hi ? hi : value;
        out[offset + channel] = channel === 3 ? (value >= 127.5 ? 255 : 0) : value + 0.5;
      }
    }
  }
  return { width, height, data: out };
}

/** A box filter to a smaller size, alpha-weighted, the cutout kept a cutout. */
function boxFit(src, width, height) {
  const { width: srcWidth, height: srcHeight, data: srcData } = src;
  if (srcWidth === width && srcHeight === height) return { width, height, data: new Uint8Array(srcData) };
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * srcWidth) / width),
        x1 = Math.max(x0 + 1, Math.floor(((x + 1) * srcWidth) / width)),
        y0 = Math.floor((y * srcHeight) / height),
        y1 = Math.max(y0 + 1, Math.floor(((y + 1) * srcHeight) / height));
      let red = 0,
        green = 0,
        blue = 0,
        alpha = 0,
        n = 0;
      for (let srcY = y0; srcY < y1; srcY++)
        for (let srcX = x0; srcX < x1; srcX++) {
          const i = (srcY * srcWidth + srcX) * 4,
            texelAlpha = srcData[i + 3];
          red += srcData[i] * texelAlpha;
          green += srcData[i + 1] * texelAlpha;
          blue += srcData[i + 2] * texelAlpha;
          alpha += texelAlpha;
          n++;
        }
      const offset = (y * width + x) * 4;
      if (alpha) {
        out[offset] = red / alpha + 0.5;
        out[offset + 1] = green / alpha + 0.5;
        out[offset + 2] = blue / alpha + 0.5;
      }
      out[offset + 3] = alpha / n >= 127.5 ? 255 : 0;
    }
  return { width, height, data: out };
}

/** Unsharp masking on the luma, held inside each texel's own 3 x 3 range of it: crisper edges, never a halo past
 *  them. The colour moves with its luma. */
export function sharpenInRange(pic, amount, wrap) {
  const { width, height, data } = pic;
  const at = wrap ? wrapI : clampI;
  const n = width * height;
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  // a row's three: sum, least and most; then a column's three of those
  const rowSum = new Float32Array(n),
    rowLeast = new Float32Array(n),
    rowMost = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const left = luma[row + at(x - 1, width)],
        centre = luma[row + x],
        right = luma[row + at(x + 1, width)];
      rowSum[row + x] = left + centre + right;
      rowLeast[row + x] = left < centre ? (left < right ? left : right) : centre < right ? centre : right;
      rowMost[row + x] = left > centre ? (left > right ? left : right) : centre > right ? centre : right;
    }
  }
  const out = new Uint8Array(data);
  for (let y = 0; y < height; y++) {
    const above = at(y - 1, height) * width,
      row = y * width,
      below = at(y + 1, height) * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      if (data[i * 4 + 3] === 0) continue;
      const mean = (rowSum[above + x] + rowSum[i] + rowSum[below + x]) / 9;
      const lo = Math.min(rowLeast[above + x], rowLeast[i], rowLeast[below + x]),
        hi = Math.max(rowMost[above + x], rowMost[i], rowMost[below + x]);
      let sharpened = luma[i] + amount * (luma[i] - mean);
      sharpened = sharpened < lo ? lo : sharpened > hi ? hi : sharpened;
      const lift = sharpened - luma[i];
      for (let channel = 0; channel < 3; channel++) {
        const value = data[i * 4 + channel] + lift;
        out[i * 4 + channel] = value < 0 ? 0 : value > 255 ? 255 : value + 0.5;
      }
    }
  }
  return { width, height, data: out };
}

/**
 * THE GROUND'S EDGES, CRISP. The upscale's luma pushed from its mean over a record texel's width (an unsharp mask at the
 * record's own scale), held inside the range of the four record texels nearest it: each edge as steep as the record's
 * nearest-texel look, its curve kept, no halo. The colour moves with its luma.
 * @param {Rgba} pic the upscale @param {Rgba} src the record it was made from @param {number} amount @param {boolean} wrap
 * @returns {Rgba}
 */
export function crispInRange(pic, src, amount, wrap) {
  const { width, height, data } = pic;
  const { width: srcWidth, height: srcHeight, data: srcData } = src;
  const at = wrap ? wrapI : clampI;
  const radius = Math.max(1, Math.round(width / srcWidth / 2));
  const n = width * height;
  const luma = new Float32Array(n),
    across = new Float32Array(n),
    mean = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = 255 * lumaOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let d = -radius; d <= radius; d++) sum += luma[y * width + at(x + d, width)];
      across[y * width + x] = sum / (2 * radius + 1);
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let d = -radius; d <= radius; d++) sum += across[at(y + d, height) * width + x];
      mean[y * width + x] = sum / (2 * radius + 1);
    }
  const srcLuma = new Float32Array(srcWidth * srcHeight);
  for (let i = 0; i < srcLuma.length; i++)
    srcLuma[i] = 255 * lumaOf(srcData[i * 4], srcData[i * 4 + 1], srcData[i * 4 + 2]);
  const out = new Uint8Array(data);
  for (let y = 0; y < height; y++) {
    const j = Math.floor(((y + 0.5) * srcHeight) / height - 0.5),
      row0 = at(j, srcHeight) * srcWidth,
      row1 = at(j + 1, srcHeight) * srcWidth;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i * 4 + 3] === 0) continue;
      const k = Math.floor(((x + 0.5) * srcWidth) / width - 0.5),
        column0 = at(k, srcWidth),
        column1 = at(k + 1, srcWidth);
      const near0 = srcLuma[row0 + column0],
        near1 = srcLuma[row0 + column1],
        near2 = srcLuma[row1 + column0],
        near3 = srcLuma[row1 + column1];
      const lo = Math.min(near0, near1, near2, near3),
        hi = Math.max(near0, near1, near2, near3);
      let crisp = luma[i] + amount * (luma[i] - mean[i]);
      crisp = crisp < lo ? lo : crisp > hi ? hi : crisp;
      const lift = crisp - luma[i];
      for (let channel = 0; channel < 3; channel++) {
        const value = data[i * 4 + channel] + lift;
        out[i * 4 + channel] = value < 0 ? 0 : value > 255 ? 255 : value + 0.5;
      }
    }
  }
  return { width, height, data: out };
}

/** The chroma plane a record's share of each hue is counted on: (blue - luma, red - luma), cells of 16. */
const HUE_GRID = 32;
const hueCell = (value) => (value < -256 ? 0 : value >= 256 ? HUE_GRID - 1 : Math.floor((value + 256) / 16));
/** How far hue `a` lies from a ground's hue `b` (each a chroma: the colour less its light). A difference along the
 *  ground's own hue is strength, not hue - a pale tan in dark dirt is the dirt's hue - so it is not counted. */
function hueGap(a0, a1, a2, b0, b1, b2) {
  const full = Math.hypot(a0 - b0, a1 - b1, a2 - b2);
  const strength = Math.hypot(b0, b1, b2);
  if (strength < 8) return full;
  const along = (a0 * b0 + a1 * b1 + a2 * b2) / (strength * strength);
  return along < 0 ? full : Math.hypot(a0 - along * b0, a1 - along * b1, a2 - along * b2);
}
/** A texel's hue is stray where the record holds under `share` of its texels within `cells` cells of it on the chroma
 *  plane, and it is `gap` off the median hue of its 5 x 5. */
export const STRAY_HUE = Object.freeze({ share: 0.03, cells: 1, gap: 30 });

/**
 * THE GROUND'S HUE. A classic ground record carries stray texels of a hue it has almost nowhere else - violet in the
 * Alik'r's sand, pink, yellow and teal in the snow - one texel at the record's size, a blot once upscaled. A stray texel
 * keeps its light and takes the median hue of its 5 x 5. With `snow`, a snowy (bright) texel takes the mean hue of the
 * snowy texels round it: the snow's grain is light and shade, never hue. `foreign(r, g, b)`: a hue the ground never
 * holds, stray wherever it stands, which takes its neighbours' own hue. The alpha and every light are kept.
 * @param {Rgba} src @param {{ snow?: boolean, foreign?: ?((r: number, g: number, b: number) => boolean) }} [o] @returns {Rgba}
 */
export function groundHue(src, { snow = false, foreign = null } = {}) {
  const { width, height, data } = src;
  const n = width * height;
  const chroma = new Float32Array(n * 3),
    light = new Float32Array(n),
    share = new Int32Array(HUE_GRID * HUE_GRID);
  let opaque = 0;
  for (let i = 0; i < n; i++) {
    light[i] = 255 * lumaOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    for (let channel = 0; channel < 3; channel++) chroma[i * 3 + channel] = data[i * 4 + channel] - light[i];
    if (data[i * 4 + 3] === 0) continue;
    opaque++;
    share[hueCell(chroma[i * 3 + 2]) * HUE_GRID + hueCell(chroma[i * 3])]++;
  }
  const shareOf = (i) => {
    const blueCell = hueCell(chroma[i * 3 + 2]),
      redCell = hueCell(chroma[i * 3]);
    let count = 0;
    for (let a = Math.max(0, blueCell - STRAY_HUE.cells); a <= Math.min(HUE_GRID - 1, blueCell + STRAY_HUE.cells); a++)
      for (let b = Math.max(0, redCell - STRAY_HUE.cells); b <= Math.min(HUE_GRID - 1, redCell + STRAY_HUE.cells); b++)
        count += share[a * HUE_GRID + b];
    return count / opaque;
  };
  const out = new Uint8Array(data);
  const around = [[], [], []];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i * 4 + 3] === 0) continue;
      const snowy = snow ? smooth(150, 170, light[i]) : 0;
      const alien = foreign ? foreign(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) : false;
      const stray = alien || shareOf(i) < STRAY_HUE.share;
      if (!stray && snowy <= 0) continue;
      around[0].length = around[1].length = around[2].length = 0;
      const sum = [0, 0, 0];
      let weight = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = clampI(y + dy, height) * width + clampI(x + dx, width);
          if ((!dx && !dy) || data[j * 4 + 3] === 0) continue;
          const snowyThere = snow ? smooth(150, 170, light[j]) : 0;
          const kin = !foreign || !foreign(data[j * 4], data[j * 4 + 1], data[j * 4 + 2]);
          for (let channel = 0; channel < 3; channel++) {
            if (kin) around[channel].push(chroma[j * 3 + channel]);
            sum[channel] += snowyThere * chroma[j * 3 + channel];
          }
          weight += snowyThere;
        }
      let target = null,
        amount = 0;
      if (stray && around[0].length >= (alien ? 3 : 12)) {
        const median = around.map((values) => values.sort((a, b) => a - b)[values.length >> 1]);
        const own = chroma.subarray(i * 3, i * 3 + 3);
        if (alien || hueGap(own[0], own[1], own[2], median[0], median[1], median[2]) >= STRAY_HUE.gap) {
          target = median;
          amount = 1;
        }
      }
      if (!target && snowy > 0 && weight > 0) {
        target = sum.map((value) => value / weight);
        amount = snowy;
      }
      if (!target) continue;
      for (let channel = 0; channel < 3; channel++) {
        const own = chroma[i * 3 + channel];
        const value = light[i] + own + amount * (target[channel] - own);
        out[i * 4 + channel] = value < 0 ? 0 : value > 255 ? 255 : value + 0.5;
      }
    }
  return { width, height, data: out };
}

/** How busy the record is round each texel: the luma's spread over its 3 x 3, 0 (flat) to 1 (a strong pattern). */
function busyness(src, wrap) {
  const { width, height, data } = src;
  const out = new Float32Array(width * height);
  const at = wrap ? wrapI : clampI;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0,
        sumSquares = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = (at(y + dy, height) * width + at(x + dx, width)) * 4;
          const level = lumaOf(data[i], data[i + 1], data[i + 2]);
          sum += level;
          sumSquares += level * level;
        }
      const deviation = Math.sqrt(Math.max(0, sumSquares / 9 - (sum / 9) * (sum / 9)));
      out[y * width + x] = clamp01(deviation / 0.12);
    }
  return out;
}

/**
 * OUR DETAIL: a fine grain laid over the upscale, strongest where the record is busiest (a stony path takes more than a
 * smooth wall), and never on a clear texel. `cells` is the grain's coarsest lattice across the picture.
 */
export function addDetail(pic, src, { strength, cells, seed, wrap }) {
  const { width, height, data } = pic;
  const busy = busyness(src, wrap);
  const n = textureGrain(width, height, cells, 3, seed);
  const srcWidth = src.width,
    srcHeight = src.height;
  const col = new Int32Array(width);
  for (let x = 0; x < width; x++) col[x] = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / width));
  for (let y = 0; y < height; y++) {
    const srcRow = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / height)) * srcWidth;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] === 0) continue;
      const k = 1 + strength * (0.35 + 0.65 * busy[srcRow + col[x]]) * n[y * width + x];
      data[offset] = Math.min(255, data[offset] * k + 0.5);
      data[offset + 1] = Math.min(255, data[offset + 1] * k + 0.5);
      data[offset + 2] = Math.min(255, data[offset + 2] * k + 0.5);
    }
  }
  return pic;
}

/** OUR GRADE: a soft S-curve on the luma about its middle, and the colour widened round it. */
export function grade(pic, { contrast, saturation }) {
  const data = pic.data;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    const red = data[offset],
      green = data[offset + 1],
      blue = data[offset + 2];
    const luma = lumaOf(red, green, blue);
    const gradedLuma = clamp01(luma + contrast * (luma - 0.5) * (1 - Math.abs(2 * luma - 1)));
    const k = luma > 0.001 ? gradedLuma / luma : 1;
    const gradedLevel = gradedLuma * 255;
    for (let channel = 0; channel < 3; channel++) {
      const value = gradedLevel + saturation * (data[offset + channel] * k - gradedLevel);
      data[offset + channel] = value < 0 ? 0 : value > 255 ? 255 : value + 0.5;
    }
  }
  return pic;
}

/** How a record's edges meet the next texel, for the upscale and the grain: a wall or a dungeon's tile repeats itself
 *  (it wraps); a terrain record meets OTHER records at its edges (a shore's water half meets the water tile), so its
 *  own far edge is no neighbour - it is held at its border, as a flat's sprite is. */
export const wrapsOf = (archive) => {
  const a = archive % 100;
  return archive < 500 && a !== 2 && a !== 3 && a !== 4 && a !== 5 && a !== 6 && !(archive >= 194 && archive <= 195);
};

/** A record's own seed: the same record grows the same grain on every machine. */
export const recordSeed = (archive, record, frame = 0) => (archive * 1009 + record * 97 + frame * 13 + 0x51ed) | 0;

/**
 * THE ENHANCED LOOK. The record upscaled to width x height (edge-aware), sharpened in range, given our grain and
 * graded. A tile that wraps wraps at every step, so it still repeats without a seam; the grain's lattice wraps always.
 * `ground` (a terrain record; 'winter' a winter set's): its stray hues taken away first (groundHue), its edges made crisp
 * at the record's own scale, and a grain down to one texel - an upscale of the ground is never softer than the record.
 * @param {Rgba} src @param {number} width @param {number} height
 * @param {{ wrap: boolean, seed: number, ground?: boolean | 'winter' }} o @returns {Rgba}
 */
export function enhance(src, width, height, { wrap, seed, ground = false }) {
  const own = ground ? groundHue(src, { snow: ground === 'winter' }) : src;
  const up = upscaleEdgeAware(own, width, height, wrap);
  const factor = width / src.width;
  const sharp = factor > 1.01 ? (ground ? crispInRange(up, own, 1.5, wrap) : sharpenInRange(up, 0.55, wrap)) : up;
  const cells = Math.max(2, Math.round(src.width / 4));
  addDetail(sharp, src, { strength: factor > 1.01 ? 0.07 : 0.04, cells, seed, wrap });
  if (ground && factor > 1.01) addDetail(sharp, src, { strength: 0.05, cells: Math.max(2, width >> 2), seed: seed + 1, wrap });
  return grade(sharp, { contrast: 0.12, saturation: 1.08 });
}

/** How much a texel is paving: grey (no colour to speak of) and darker than snow. */
const pavingOf = (red, green, blue) => {
  const most = Math.max(red, green, blue),
    least = Math.min(red, green, blue);
  const sat = most ? (most - least) / most : 0;
  return (1 - smooth(0.06, 0.14, sat)) * (1 - smooth(0.7, 0.78, lumaOf(red, green, blue)));
};

/** A picture's luma softened over a 3 x 3, held at its border. */
function softLuma(pic) {
  const { width, height, data } = pic;
  const raw = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) raw[i] = lumaOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) sum += raw[clampI(y + dy, height) * width + clampI(x + dx, width)];
      out[y * width + x] = sum / 9;
    }
  return out;
}

/**
 * THE ROAD (Masked Roads' records 46, 47 and 55: Daggerfall's road and its two flanks). The enhanced look, and the
 * paving's own stones raised: the picture's soft luma taken as height, lit from the north-west, so every stone the
 * record draws stands as a cobble and its joint sinks. Where the paving meets the ground a worn verge darkens it, its
 * edge broken by a noise rather than drawn as a line. `ground` as enhance's.
 * @param {Rgba} src @param {number} width @param {number} height
 * @param {{ seed: number, ground?: boolean | 'winter' }} o @returns {Rgba}
 */
export function road(src, width, height, { seed, ground = false }) {
  const out = enhance(src, width, height, { wrap: false, seed, ground });
  const data = out.data,
    srcWidth = src.width,
    srcHeight = src.height,
    srcData = src.data;
  const heightField = softLuma(out);
  const edge = textureGrain(width, height, 6, 2, seed + 31);
  const relief = 1.4 * (width / srcWidth);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const srcAt =
        (Math.min(srcHeight - 1, Math.floor((y * srcHeight) / height)) * srcWidth +
          Math.min(srcWidth - 1, Math.floor((x * srcWidth) / width))) *
        4;
      const paving = pavingOf(srcData[srcAt], srcData[srcAt + 1], srcData[srcAt + 2]);
      const pavingEdged = paving > 0.02 ? paving + 0.22 * edge[y * width + x] : 0; // no grey at all: the enhanced look itself
      const pave = smooth(0.45, 0.7, pavingEdged),
        verge = smooth(0.2, 0.45, pavingEdged) * (1 - pave);
      if (pave <= 0 && verge <= 0) continue;
      const slopeX = heightField[y * width + clampI(x + 1, width)] - heightField[y * width + clampI(x - 1, width)],
        slopeY = heightField[clampI(y + 1, height) * width + x] - heightField[clampI(y - 1, height) * width + x];
      const k = pave * (1 + clamp01(0.5 - (slopeX + slopeY) * relief) * 0.5 - 0.25) + verge * 0.88 + (1 - pave - verge);
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        data[offset + channel] = Math.min(255, data[offset + channel] * k + 0.5);
    }
  return out;
}

/** A field's mean over the (2 radius + 1)-square round each texel, held at the border. */
function boxMean(field, width, height, radius) {
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) sum += field[clampI(y + dy, height) * width + clampI(x + dx, width)];
      out[y * width + x] = sum / ((2 * radius + 1) * (2 * radius + 1));
    }
  return out;
}

/**
 * THE ALIK'R'S SAND. A record of the desert's ground at its own size, its violet taken away (groundHue): where it is
 * sand (a warm tan, light enough, over its 5 x 5 - so a pale speck in dark dirt is no dune), it is graded toward a pale
 * dune sand that keeps the record's own light and dark, and rippled by the wind - crests a few texels apart, bent by a
 * slow noise, whole cycles across the tile so it repeats. Water and green stay the record's, and on a road record so
 * does the paving - darker over its 7 x 7, on a flank (`road` 'flank': 47, 55) only on its paved, lower-right half.
 * @param {Rgba} src @param {{ seed: number, road?: false | 'full' | 'flank' }} o @returns {Rgba}
 */
export function desert(src, { seed, road = false }) {
  const { width, height } = src;
  const srcData = groundHue(src, { foreign: violetOf }).data;
  const out = new Uint8Array(srcData);
  const luma = new Float32Array(width * height),
    own = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const red = srcData[i * 4],
      green = srcData[i * 4 + 1],
      blue = srcData[i * 4 + 2];
    luma[i] = lumaOf(red, green, blue);
    const warm = smooth(0.02, 0.1, (red - blue) / 255) * smooth(-0.02, 0.06, (green - blue) / 255);
    own[i] = warm * smooth(0.3, 0.42, luma[i]);
  }
  const near = boxMean(own, width, height, 2),
    wide = road ? boxMean(luma, width, height, 3) : null;
  const field = new Float32Array(width * height);
  let sum = 0,
    n = 0;
  for (let i = 0; i < width * height; i++) {
    const red = srcData[i * 4],
      green = srcData[i * 4 + 1],
      blue = srcData[i * 4 + 2];
    const kept = (1 - waterOf(red, green, blue)) * (1 - smooth(0.02, 0.08, (green - Math.max(red, blue)) / 255));
    const side = road === 'flank' ? smooth(-0.3, -0.1, ((i % width) + ((i / width) | 0) + 1) / width - 1) : 1;
    const paved = wide ? (1 - smooth(0.49, 0.53, wide[i])) * side : 0;
    field[i] = smooth(0.3, 0.6, near[i]) * kept * (1 - paved);
    sum += own[i] * field[i] * luma[i];
    n += own[i] * field[i];
  }
  const mean = n > 0 ? sum / n : 0.5;
  const warp = textureGrain(width, height, 4, 2, seed);
  const tone = [236, 210, 166];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const amount = field[y * width + x] * 0.9;
      if (amount <= 0 || srcData[i + 3] === 0) continue;
      const rel = luma[y * width + x] / mean;
      const ripple = Math.sin(2 * Math.PI * ((7 * x) / width + (3 * y) / height) + 2.4 * warp[y * width + x]);
      const k = Math.min(1.1, Math.max(0.62, 0.86 + 0.7 * (rel - 1))) * (1 + 0.06 * ripple);
      for (let channel = 0; channel < 3; channel++) {
        const value = srcData[i + channel] + amount * (tone[channel] * k - srcData[i + channel]);
        out[i + channel] = value < 0 ? 0 : value > 255 ? 255 : value + 0.5;
      }
    }
  return { width, height, data: out };
}

/** Violet - blue and red both over green - is no hue of the desert's ground: the classic record's specks of it. */
const violetOf = (red, green, blue) => blue > green + 8 && red > green;

/** How much a texel is water: blue well over red, and too dark to be snow in a blue light. */
const waterOf = (red, green, blue) =>
  smooth(0.06, 0.16, (blue - red) / 255) *
  smooth(-0.02, 0.06, (blue - green) / 255) *
  (1 - smooth(0.6, 0.7, lumaOf(red, green, blue)));

/** A record's pseudo-height (its soft luma) and the slope, the lee and the light there: the snow law's ground. Held at
 *  the record's border - a terrain record's far edge is another record's. */
function snowGround(src) {
  const { width, height } = src;
  const heightField = softLuma(src);
  const slope = new Float32Array(width * height),
    lee = new Float32Array(width * height),
    lit = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const slopeX =
          (heightField[y * width + clampI(x + 1, width)] - heightField[y * width + clampI(x - 1, width)]) * 4,
        slopeY = (heightField[clampI(y + 1, height) * width + x] - heightField[clampI(y - 1, height) * width + x]) * 4;
      const i = y * width + x;
      slope[i] = Math.sqrt(slopeX * slopeX + slopeY * slopeY);
      // the wind and the light are from the north-west: a face falling to the south-east is the lee, and in shade
      lee[i] = clamp01(0.5 + (slopeX + slopeY) * 0.9);
      lit[i] = clamp01(0.92 - 0.25 * (slopeX + slopeY));
    }
  return { ht: heightField, slope, lee, lit };
}

/**
 * The snow law's coverage of each texel, 0 to 1. A winter record: the snow it draws already (bright over its 3 x 3, not
 * water), crept a texel or two over the flat ground beside it, furthest downwind (the wind is from the north-west). A
 * summer record (`fromSummer`): laid over all
 * but water, full on the flat, thinner on steep ground and on faces to the wind. `joints`: snow sifted into the dark
 * joints of a paving too - the picture's, not the mask's (a dusted joint is no snow to stand in).
 */
function snowCover(src, ground, fromSummer, joints) {
  const { width, height, data: srcData } = src;
  const cover = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const water = waterOf(srcData[i * 4], srcData[i * 4 + 1], srcData[i * 4 + 2]);
    const steep = smooth(0.45, 1.4, ground.slope[i]) * (1.2 - 0.6 * ground.lee[i]);
    cover[i] = (1 - water) * (fromSummer ? clamp01(1.02 - 0.75 * steep) : smooth(0.62, 0.71, ground.ht[i]));
  }
  if (fromSummer) return cover;
  const raw = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) raw[i] = lumaOf(srcData[i * 4], srcData[i * 4 + 1], srcData[i * 4 + 2]);
  const spread = new Float32Array(cover);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (cover[i] >= 0.99) continue;
      // the exposure: snow drifts downwind - a snowy texel to the north-west (the wind's side) reaches further
      let near = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const wind = 0.55 + 0.45 * clamp01((-dx - dy) / 4);
          const reach =
            (cover[clampI(y + dy, height) * width + clampI(x + dx, width)] * wind) / (1 + Math.abs(dx) + Math.abs(dy));
          if (reach > near) near = reach;
        }
      const red = srcData[i * 4],
        green = srcData[i * 4 + 1],
        blue = srcData[i * 4 + 2];
      // the slope: the bare ground's own (a snowy neighbour counts at this texel's height - its brightness is no hill)
      const at = (j) => (cover[j] > 0.5 ? raw[i] : raw[j]);
      const slopeX = (at(y * width + clampI(x + 1, width)) - at(y * width + clampI(x - 1, width))) * 4,
        slopeY = (at(clampI(y + 1, height) * width + x) - at(clampI(y - 1, height) * width + x)) * 4;
      const flat = 1 - smooth(0.25, 0.7, Math.sqrt(slopeX * slopeX + slopeY * slopeY));
      const joint = joints
        ? pavingOf(red, green, blue) * smooth(0.02, 0.08, mean3(ground.ht, x, y, width, height) - ground.ht[i])
        : 0;
      // a joint takes snow only near the drift's edge: a whole road hatched white is no snowfall
      spread[i] = Math.max(
        cover[i],
        (1 - waterOf(red, green, blue)) * Math.max(near * flat, 0.8 * joint * smooth(0.1, 0.45, near)),
      );
    }
  return spread;
}
const mean3 = (field, x, y, width, height) => {
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) sum += field[clampI(y + dy, height) * width + clampI(x + dx, width)];
  return sum / 9;
};

/**
 * OUR SNOW LAW. A winter record (Daggerfall's own TEXTURE.103, .303, .403), or a summer one where the player's data has
 * no winter record (`fromSummer`), at its own size: snow laid by slope and exposure (snowCover), and where it lies a
 * cold white shaded by the ground's own relief - lit from the north-west, blue in the hollows - with a rare glint.
 * Water is left as the record has it.
 * @param {Rgba} src @param {{ seed: number, fromSummer?: boolean }} o @returns {Rgba}
 */
export function snow(src, { seed, fromSummer = false }) {
  const { width, height, data: srcData } = src;
  const ground = snowGround(src);
  const cover = snowCover(src, ground, fromSummer, true);
  const fine = textureGrain(width, height, Math.max(2, width >> 3), 2, seed);
  const keepOwn = fromSummer ? 0.25 : 0.5; // the record's own grain, kept in the snow: a field of it is never blank
  const tinted = groundHue(src, { snow: !fromSummer }).data; // where the snow lies thin, the record shows without its stray hues
  const out = new Uint8Array(tinted);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        amount = cover[i];
      if (amount <= 0) continue;
      const offset = i * 4;
      const own = 255 * keepOwn * (lumaOf(srcData[offset], srcData[offset + 1], srcData[offset + 2]) - ground.ht[i]);
      const hollow = clamp01((mean3(ground.ht, x, y, width, height) - ground.ht[i]) * 6);
      const glint = hash01(x, y, seed) > 0.985 ? 1.05 : 1;
      const light = (0.95 + 0.03 * fine[i]) * (0.88 + 0.14 * ground.lit[i]) * glint;
      const tone = [light * (240 - 16 * hollow), light * (244 - 8 * hollow), light * 254];
      for (let channel = 0; channel < 3; channel++) {
        const value = tinted[offset + channel] + amount * (tone[channel] + own - tinted[offset + channel]);
        out[offset + channel] = value < 0 ? 0 : value > 255 ? 255 : value + 0.5;
      }
    }
  return { width, height, data: out };
}

/** The bytes of one winter record's surface mask - where snow may lie, 0 to 255, in the record's own rows (row 0 its
 *  top: systems/snowfall.js SnowCoverage reads row (1 - v) * 63 at the ground's v, and the ground draws the record's
 *  top row at v = 1) - from our snow law's coverage softened over a 3 x 3. A texel under 2% is bare, one over 96% full. */
export function snowMask(src, { fromSummer = false } = {}) {
  const { width, height } = src;
  const ground = snowGround(src);
  const cover = snowCover(src, ground, fromSummer, false);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const coverage = mean3(cover, x, y, width, height);
      out[y * width + x] = coverage >= 0.96 ? 255 : coverage < 0.02 ? 0 : Math.round(coverage * 255);
    }
  return out;
}

/** OUR SNOW'S ALBEDO: a cold white with a soft drift of light and shadow and a few glints, `size` square, repeating -
 *  rows top-down. */
export function snowAlbedo(size = 64, seed = 0x5a0f) {
  const drift = textureGrain(size, size, 4, 3, seed),
    fine = textureGrain(size, size, 16, 2, seed + 11);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const light = 0.92 + 0.05 * drift[i] + 0.02 * fine[i];
    const cold = clamp01(0.5 - drift[i]) * 0.05;
    const glint = hash01(i % size, (i / size) | 0, seed) > 0.992 ? 0.06 : 0;
    data[i * 4] = Math.min(255, 255 * (light - cold + glint) + 0.5);
    data[i * 4 + 1] = Math.min(255, 255 * (light - cold * 0.5 + glint) + 0.5);
    data[i * 4 + 2] = Math.min(255, 255 * (light + 0.03 + glint) + 0.5);
    data[i * 4 + 3] = 255;
  }
  return { width: size, height: size, data };
}

/** The rules by name, as a spec names them (ownTexturePacks.js). */
export const OWN_RULE_NAMES = Object.freeze(['enhance', 'road', 'desert', 'snow']);

/** The source at the spec's size, where a pack keeps a record at a size of its own. */
const fit = (src, width, height) =>
  src.width === width && src.height === height ? src : upscaleEdgeAware(src, width, height, false);

/**
 * One picture by its spec: `{ rule, w, h, wrap?, fromSummer?, road?, ground?, seed }` over the classic source picture.
 * Answers a new picture; the source is not written.
 * @param {{ rule: string, w: number, h: number, wrap?: boolean, fromSummer?: boolean, road?: false | 'full' | 'flank',
 * ground?: boolean | 'winter', seed: number }} spec
 * @param {Rgba} src
 * @returns {Rgba}
 */
export function applyOwnRule(spec, src) {
  switch (spec.rule) {
    case 'enhance':
      return enhance(src, spec.w, spec.h, { wrap: !!spec.wrap, seed: spec.seed, ground: spec.ground ?? false });
    case 'road':
      return road(src, spec.w, spec.h, { seed: spec.seed, ground: spec.ground ?? false });
    case 'desert':
      return desert(fit(src, spec.w, spec.h), { seed: spec.seed, road: spec.road ?? false });
    case 'snow':
      return snow(fit(src, spec.w, spec.h), { seed: spec.seed, fromSummer: !!spec.fromSummer });
    default:
      throw new Error(`no own texture rule ${spec.rule}`);
  }
}
