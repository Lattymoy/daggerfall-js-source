// DYNAMIC SKIES - OUR OWN PICTURES (OWN-WORK4). Nothing is loaded: the sky's one texture and the pixel snow's flake
// are painted here, at runtime, by our own code - tileable value noise and a drawn six-armed crystal. The tables the
// instance takes are dynamicSkies.js's own.

import { WEATHER_LOOK, FOG_LOOK, DYNAMIC_LIGHT_CURVE } from './dynamicSkies.js';

/** The painted textures, by the name the pass and the snow ask for. */
export const DYNAMIC_SKIES_TEXTURES = Object.freeze(['PixelSnow', 'SkyNoise']);

/** Our tables, in the shape DynamicSkies' constructor takes. */
export function dynamicSkiesAssets() {
  return { weathers: WEATHER_LOOK, fog: FOG_LOOK, lightCurve: DYNAMIC_LIGHT_CURVE };
}

/** An integer hash of a lattice point and a seed, 0..1. */
function latticeHash(x, y, seed) {
  let mixed = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
}

/** One octave of value noise: a lattice of `cells` a side that wraps, so the texture tiles, eased between its
 *  points by smoothstep. Returns the sampler over 0..1 coordinates. */
function valueOctave(cells, seed) {
  const lattice = new Float64Array(cells * cells);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) lattice[j * cells + i] = latticeHash(i, j, seed);
  return (across, down) => {
    const x = across * cells,
      y = down * cells;
    const left = Math.floor(x),
      top = Math.floor(y);
    const fracX = x - left,
      fracY = y - top;
    const easeX = fracX * fracX * (3 - 2 * fracX),
      easeY = fracY * fracY * (3 - 2 * fracY);
    const wrap = (i) => ((i % cells) + cells) % cells;
    const col0 = wrap(left),
      col1 = wrap(left + 1),
      row0 = wrap(top) * cells,
      row1 = wrap(top + 1) * cells;
    const topLeft = lattice[row0 + col0],
      topRight = lattice[row0 + col1],
      lowLeft = lattice[row1 + col0],
      lowRight = lattice[row1 + col1];
    return (
      topLeft +
      (topRight - topLeft) * easeX +
      (lowLeft - topLeft) * easeY +
      (topLeft - topRight - lowLeft + lowRight) * easeX * easeY
    );
  };
}

/** The three channels of the sky's noise: the low clouds' body (red), the high clouds' streaks (green), the moons'
 *  seas and the star river (blue, billowed). Each an fBm of `octaves`, its lattice doubling; alpha is whole. */
export const SKY_NOISE_CHANNELS = Object.freeze([
  Object.freeze({ seed: 11, cells: 4, octaves: 5, billow: false }),
  Object.freeze({ seed: 23, cells: 8, octaves: 5, billow: false }),
  Object.freeze({ seed: 37, cells: 3, octaves: 4, billow: true }),
]);

/** OWN-WORK4 AUDIT (2026-11-01): each octave's lattice turned by a whole-number matrix [turnA, turnB, turnC, turnD] (so the texture
 *  still tiles) and shifted by its own fraction of a cell. Value noise is flat along its lattice lines, and with every
 *  octave's lines on one grid the lit clouds showed them as long streaks under an overcast deck. */
export const OCTAVE_TURNS = Object.freeze([
  Object.freeze([1, 0, 0, 1]),
  Object.freeze([1, 1, -1, 1]),
  Object.freeze([2, 1, -1, 2]),
  Object.freeze([1, -2, 2, 1]),
  Object.freeze([3, 1, -1, 3]),
]);
/** An octave's sampler over 0..1 coordinates, its lattice turned and shifted (OCTAVE_TURNS); its cells kept near
 *  `cells` across the picture whatever the turn's own scale. */
function turnedOctave(cells, seed, index) {
  const [turnA, turnB, turnC, turnD] = OCTAVE_TURNS[index % OCTAVE_TURNS.length];
  const scale = Math.sqrt(turnA * turnD - turnB * turnC);
  const octave = valueOctave(Math.max(1, Math.round(cells / scale)), seed);
  const shiftAcross = latticeHash(index, 1, seed),
    shiftDown = latticeHash(index, 2, seed);
  return (across, down) =>
    octave(turnA * across + turnB * down + shiftAcross, turnC * across + turnD * down + shiftDown);
}

/** Paint the sky's noise: RGBA bytes, `size` square, tiling on every edge. Each channel is equalized - its values
 *  replaced by their rank - so a cut at 1 - c covers c of the sky, which is the cloud layers' rule. */
export function paintSkyNoise(size = 256) {
  const data = new Uint8Array(size * size * 4).fill(255);
  const values = new Float64Array(size * size);
  const BINS = 4096;
  const count = new Float64Array(BINS);
  SKY_NOISE_CHANNELS.forEach((channel, k) => {
    const octaves = Array.from({ length: channel.octaves }, (_, index) =>
      turnedOctave(channel.cells << index, channel.seed + index * 101, index),
    );
    let lo = Infinity,
      hi = -Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0,
          amp = 1;
        for (const octave of octaves) {
          const value = octave(x / size, y / size);
          sum += (channel.billow ? 1 - Math.abs(2 * value - 1) : value) * amp;
          amp *= 0.5;
        }
        values[y * size + x] = sum;
        lo = Math.min(lo, sum);
        hi = Math.max(hi, sum);
      }
    }
    // the equalizing: each value's bin, then the share of the texture under it
    const bin = (value) => Math.min(BINS - 1, Math.floor(((value - lo) / (hi - lo || 1)) * BINS));
    count.fill(0);
    for (let i = 0; i < values.length; i++) count[bin(values[i])]++;
    for (let index = 0, under = 0; index < BINS; index++) {
      const here = count[index];
      count[index] = (under + here / 2) / values.length;
      under += here;
    }
    for (let i = 0; i < values.length; i++) data[i * 4 + k] = Math.min(255, Math.floor(count[bin(values[i])] * 256));
  });
  return { width: size, height: size, data };
}

/** Paint the pixel snow's flake: a six-armed crystal, 64 square, white with a pale blue rim, every other texel clear
 *  (premultiplied: a clear texel is black, for the snow's premultiplied blend). Two side branches an arm. */
export function paintSnowflake(size = 64) {
  const data = new Uint8Array(size * size * 4);
  const ink = new Uint8Array(size * size);
  const centre = (size - 1) / 2,
    arm = size * 0.42;
  const plot = (x, y) => {
    const i = Math.round(x),
      j = Math.round(y);
    if (i >= 0 && j >= 0 && i < size && j < size) ink[j * size + i] = 1;
  };
  const line = (x0, y0, x1, y1) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let step = 0; step <= steps; step++) plot(x0 + ((x1 - x0) * step) / steps, y0 + ((y1 - y0) * step) / steps);
  };
  for (let armIndex = 0; armIndex < 6; armIndex++) {
    const ang = (armIndex * Math.PI) / 3,
      dx = Math.cos(ang),
      dy = Math.sin(ang);
    line(centre, centre, centre + dx * arm, centre + dy * arm);
    for (const [at, len] of [
      [0.45, 0.3],
      [0.72, 0.2],
    ]) {
      const branchX = centre + dx * arm * at,
        branchY = centre + dy * arm * at;
      for (const turn of [Math.PI / 3, -Math.PI / 3]) {
        const turnX = Math.cos(ang + turn),
          turnY = Math.sin(ang + turn);
        line(branchX, branchY, branchX + turnX * arm * len, branchY + turnY * arm * len);
      }
    }
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const at = (j * size + i) * 4;
      const near = (stepX, stepY) =>
        ink[Math.min(size - 1, Math.max(0, j + stepY)) * size + Math.min(size - 1, Math.max(0, i + stepX))];
      if (ink[j * size + i]) data.set([255, 255, 255, 255], at);
      else if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) data.set([188, 212, 255, 255], at);
    }
  }
  return { width: size, height: size, data };
}

const painted = new Map();
const paint = (name) => {
  if (!painted.has(name))
    painted.set(name, name === 'SkyNoise' ? paintSkyNoise() : name === 'PixelSnow' ? paintSnowflake() : null);
  return painted.get(name);
};

/** A painted texture as a data URL (the snow's pass loads an Image); null in node, which has no canvas. */
export function dynamicSkiesTextureUrl(name) {
  const pic = paint(name);
  if (!pic || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = pic.width;
  canvas.height = pic.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pic.data), pic.width, pic.height), 0, 0);
  return canvas.toDataURL('image/png');
}

/** One painted texture for the pass ({ width, height, data }), painted on the next task so the boot's frame is not
 *  held for it (the slot shows the noise's middle meanwhile); rejects a name we do not paint, and the caller warns. */
export function loadDynamicSkiesTexture(name) {
  if (name !== 'SkyNoise' && name !== 'PixelSnow')
    return Promise.reject(new Error(`Dynamic Skies: no texture named ${name}`));
  return new Promise((resolve) => setTimeout(() => resolve(paint(name)), 0));
}
