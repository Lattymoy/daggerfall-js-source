// ═══════════════════════════════════════════════════════════════════
// THE SKY MAP — the province from directly above, and the cloud deck
// the camera climbs through to get there.
//
// ── WHY THIS IS A SECOND RENDERER ────────────────────────────────
//
// ui/introFlyover.js cannot draw this shot, and no camera path makes it
// able to. Its pitch is a HORIZON SHIFT - the projection's vertical
// axis is fixed and `horizon` slides the whole picture up or down - so
// the nearest ground it can show sits at
//
//     z_near  =  eye * scaleH / (H - horizonY)
//
// units ahead, and every knob fights itself: climbing raises `eye` as
// fast as it lowers the horizon, and widening the angle drops scaleH
// but spreads the frame sideways. Run the numbers at any altitude and
// any angle and the answer is the same shape - a WEDGE receding to a
// vanishing point, two hundred units in front of the camera. That is
// why the first attempt at "the entire map" came back as a valley
// corridor with two ridges converging: not a bad camera position, a
// projection that has no way to look down.
//
// A true pitch would mean a per-PIXEL ray march instead of a per-COLUMN
// span fill - every pixel gets its own vertical angle, so the column's
// shared horizontal ray stops being shared, and the technique's whole
// speed argument goes with it. Looking straight down needs none of
// that machinery anyway: with the camera overhead the heightfield IS
// the image, one sample per pixel, which is cheaper than the flyover
// rather than dearer.
//
// ── THE CLOUDS ARE THE CUT ───────────────────────────────────────
//
// Two projections cannot be cross-faded; they disagree about where
// everything is. But they can be cut between, and a cut is invisible
// inside a white-out - which is why the camera flies UP THROUGH A CLOUD
// DECK on the way. The deck is not a curtain hung over a technical
// seam: it is the reason the shot works, it is what makes the altitude
// legible (you have to pass something to feel you have risen), and it
// is what the brief asked for. The seam is real and it is hidden on
// purpose; recorded here so nobody later mistakes the white-out for
// decoration and removes it.
//
// ── AND THE CLOUDS STAY, ONCE YOU ARE ABOVE THEM ─────────────────
//
// The same field draws the deck from below, the white-out inside it,
// the patches lying over the province from above, and the SHADOWS
// those patches throw on the ground - offset along the sun's bearing
// by the deck's height, which is the one detail that stops a map view
// reading as a flat picture of a map.
// ═══════════════════════════════════════════════════════════════════

import { makeNoise, octaveNoise, SEA_LEVEL } from './introMap.js';
import {
  posterise, edgeFade, OCEAN, SUN_BEARING, SUN_ELEVATION,
  SKY_HORIZON, SUN_GLOW, mipFor,
} from './introFlyover.js';

/** The deck's base and top, in the same height units as the map. The
 *  camera is inside cloud between them and the white-out is total at
 *  the middle. */
export const CLOUD_BASE = 300;
export const CLOUD_TOP = 460;
/** Where the deck sits for shadow-casting purposes. */
export const CLOUD_H = (CLOUD_BASE + CLOUD_TOP) / 2;

/** How much of the sky the cloud field covers, and how sharply it
 *  breaks from clear to solid. Coverage is subtracted from the noise,
 *  so a higher number is a CLEARER sky. */
export const CLOUD_COVERAGE = 0.52;
export const CLOUD_SHARPNESS = 3.4;

/** How far the deck drifts, in cells per second. Slow: this is weather
 *  seen from twenty thousand feet, not steam off a kettle. */
export const CLOUD_DRIFT_X = 2.6;
export const CLOUD_DRIFT_Y = -1.1;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

/**
 * The cloud field: coverage in 0..1 at a world point and a time.
 *
 * One field, four jobs - the deck from below, the white-out inside it,
 * the patches from above and the shadows they throw - so a cloud is
 * never in two places at once, which is what happens the moment two
 * fields are allowed to drift apart.
 */
export function makeClouds(seed = 0xc10d) {
  const n = makeNoise(seed);
  return (x, y, t) => {
    const dx = (x + CLOUD_DRIFT_X * t) * 0.0042;
    const dy = (y + CLOUD_DRIFT_Y * t) * 0.0042;
    // Two octave-sums at different scales: the big one makes weather
    // systems, the small one makes their ragged edges.
    const base = octaveNoise(n, dx, dy, 4);
    const detail = octaveNoise(n, dx * 3.7 + 11, dy * 3.7 - 7, 3);
    const v = base * 0.72 + detail * 0.28;
    return clamp01((v - CLOUD_COVERAGE) * CLOUD_SHARPNESS);
  };
}

/**
 * How thoroughly the camera is inside the deck, 0..1.
 * 1 at the middle, 0 at base and top. This is the white-out, and it is
 * also the window in which the projection is allowed to change.
 * Pure, and pinned: the switch must happen where this is at its peak.
 */
export function inCloud(z) {
  if (z <= CLOUD_BASE || z >= CLOUD_TOP) return 0;
  const k = (z - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE);
  // Sine rather than a triangle, so entering and leaving the deck ease
  // instead of cornering.
  return Math.sin(k * Math.PI);
}

/**
 * Draw the province from directly above.
 *
 * `cam`  { x, y, span }  - centre in map cells, and how many cells the
 *                          frame's WIDTH covers. Square pixels follow.
 * `t`    seconds, for the cloud drift and the water.
 *
 * Orthographic on purpose. A perspective camera looking down would put
 * a vanishing point in the middle of a map and lean every mountain
 * outward from it; the travel map this is quoting has no vanishing
 * point, and neither should this.
 */
export function drawSkyMap(target, prepared, cam, t = 0, clouds = defaultClouds) {
  const W = target.width, H = target.height;
  const span = Math.min(cam.span, MAX_SPAN);
  const px = target.data;
  const u32 = new Uint32Array(px.buffer, px.byteOffset, W * H);

  // Cells per pixel, and therefore which mip level to read. The same
  // law as the flyover's: sample a field at a rate finer than its
  // detail or it aliases.
  const perPx = span / W;
  const lvl = mipFor(perPx, prepared.levels.length);
  const m = prepared.levels[lvl];
  const mw = m.w, mh = m.h, mhh = m.height, mc = m.colour;
  const sc = 1 / (1 << lvl);

  const sunCos = Math.cos(SUN_BEARING), sunSin = Math.sin(SUN_BEARING);
  const x0 = cam.x - span * 0.5;
  const y0 = cam.y - (span * H) / W * 0.5;
  // The shadow's offset: a cloud at CLOUD_H throws its shadow along the
  // sun's bearing by height/tan(elevation). With the sun this low that
  // is a long way, and it is what makes the deck read as floating
  // ABOVE the land rather than painted onto it.
  // AND CAPPED. At a dawn sun's elevation the true offset is about
  // 1300 cells - longer than the province - so every cloud's shadow
  // would fall off the map and every shadow on screen would belong to a
  // cloud that is not. That is physically right and visually useless:
  // the eye needs to see the pair. Capped to a fraction of the frame,
  // which keeps the direction honest and the association readable.
  const trueLen = (CLOUD_H - SEA_LEVEL) / Math.max(0.05, SUN_ELEVATION);
  const shadowLen = Math.min(trueLen, span * SHADOW_CAP);
  const shX = -sunCos * shadowLen, shY = -sunSin * shadowLen;

  // ── THE CLOUD BUFFER ──────────────────────────────────────────
  // The field was sampled three times per PIXEL - layer, shadow, and
  // the lit-side probe - at seven octaves each, which is 2.7 million
  // noise evaluations a frame and all fifty of its milliseconds.
  // Clouds have no detail at pixel scale, so they are computed once
  // into a quarter-resolution buffer and read back bilinearly. The
  // buffer covers the frame PLUS the shadow offset on every side, so
  // the shadow lookup never falls off the end of it.
  const marginX = Math.abs(shX) + 40, marginY = Math.abs(shY) + 40;
  const bx0 = x0 - marginX, by0 = y0 - marginY;
  const bw = span + marginX * 2;
  const bh = (span * H) / W + marginY * 2;
  const CW = 96, CH = 96;
  if (CLOUD_BUF.length < CW * CH) CLOUD_BUF = new Float32Array(CW * CH);
  for (let j = 0; j < CH; j++) {
    const wy2 = by0 + (j / (CH - 1)) * bh;
    for (let i = 0; i < CW; i++) {
      CLOUD_BUF[j * CW + i] = clouds(bx0 + (i / (CW - 1)) * bw, wy2, t);
    }
  }
  const cbx = (CW - 1) / bw, cby = (CH - 1) / bh;
  const cloudAt = (wx2, wy2) => {
    let u = (wx2 - bx0) * cbx, v = (wy2 - by0) * cby;
    if (u < 0) u = 0; else if (u > CW - 1.001) u = CW - 1.001;
    if (v < 0) v = 0; else if (v > CH - 1.001) v = CH - 1.001;
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j;
    const o = j * CW + i;
    const a2 = CLOUD_BUF[o] + (CLOUD_BUF[o + 1] - CLOUD_BUF[o]) * fu;
    const b2 = CLOUD_BUF[o + CW] + (CLOUD_BUF[o + CW + 1] - CLOUD_BUF[o + CW]) * fu;
    return a2 + (b2 - a2) * fv;
  };

  for (let py = 0; py < H; py++) {
    const wy = y0 + py * perPx;
    for (let pxi = 0; pxi < W; pxi++) {
      const wx = x0 + pxi * perPx;

      // Sample, clamped, with the same taper to open sea outside the
      // map that the flyover uses - one law, one home.
      let mx = (wx * sc) | 0, my = (wy * sc) | 0;
      let over = 0;
      if (mx < 0) { over = -mx; mx = 0; } else if (mx >= mw) { over = mx - mw + 1; mx = mw - 1; }
      if (my < 0) { const o2 = -my; if (o2 > over) over = o2; my = 0; }
      else if (my >= mh) { const o2 = my - mh + 1; if (o2 > over) over = o2; my = mh - 1; }
      const mi = my * mw + mx;
      const eK = over > 0 ? edgeFade(over, sc, MAP_EDGE_TAPER) : 0;
      const hgt = SEA_LEVEL + (mhh[mi] - SEA_LEVEL) * (1 - eK);

      let cr = mc[mi * 3], cg = mc[mi * 3 + 1], cb = mc[mi * 3 + 2];
      if (eK > 0) {
        cr = mix(cr, OCEAN[0], eK);
        cg = mix(cg, OCEAN[1], eK);
        cb = mix(cb, OCEAN[2], eK);
      }

      let r, g, b;
      if (hgt <= SEA_LEVEL + 0.5) {
        // Water from above: deep, with the sun's sheen where the light
        // grazes it. No glitter path - that is a grazing-angle effect
        // and there is no grazing angle looking straight down.
        const ripple = Math.sin(wx * 0.05 + t * 1.3) * Math.cos(wy * 0.043 - t * 0.9);
        r = cr + ripple * 5; g = cg + ripple * 6; b = cb + ripple * 8;
      } else {
        // Land, hillshaded off the map's own gradient at THIS level.
        const xR = mx + 1 < mw ? mx + 1 : mx, xL = mx > 0 ? mx - 1 : mx;
        const yD = my + 1 < mh ? my + 1 : my, yU = my > 0 ? my - 1 : my;
        // SHADED FROM THE TAPERED SURFACE. The gradient must describe
        // the land that is actually being drawn: reading it off the RAW
        // heights while the drawn height sinks by a per-pixel amount
        // means neighbouring pixels disagree about how far they have
        // sunk, which threw vertical speckle right across the tapered
        // margin - and the margin is exactly where the widest shot puts
        // its mountains.
        const fade = 1 - eK;
        const gx = (mhh[my * mw + xR] - mhh[my * mw + xL]) * 0.5 * sc * fade;
        const gy = (mhh[yD * mw + mx] - mhh[yU * mw + mx]) * 0.5 * sc * fade;
        const nl = (-gx * sunCos - gy * sunSin) * 0.22 + SUN_ELEVATION * 4.4;
        const lam = clamp01(0.30 + nl * 0.56);
        r = cr * lam; g = cg * lam; b = cb * lam;
      }

      // THE SHADOW, sampled where the cloud that casts it actually is.
      const sh = cloudAt(wx + shX, wy + shY);
      if (sh > 0) {
        const k = 1 - sh * 0.42;
        r *= k; g *= k; b *= k;
      }

      // THE CLOUD ITSELF, over the top. Lit warm on the sun's side by
      // sampling the field a little toward the sun and taking the
      // difference - a cheap stand-in for a normal, and enough to stop
      // the deck reading as flat white paint.
      const cv = cloudAt(wx, wy);
      if (cv > 0.004) {
        const lit = clamp01(0.62 + (cv - cloudAt(wx + 26 * sunCos, wy + 26 * sunSin)) * 2.2);
        const cwR = mix(SKY_HORIZON[0], SUN_GLOW[0], lit) * 0.96;
        const cwG = mix(SKY_HORIZON[1], SUN_GLOW[1], lit) * 0.96;
        const cwB = mix(SKY_HORIZON[2] + 40, SUN_GLOW[2], lit) * 0.96;
        const a = cv * 0.94;
        r = mix(r, cwR, a); g = mix(g, cwG, a); b = mix(b, cwB, a);
      }

      u32[py * W + pxi] = 0xff000000
        | ((b < 0 ? 0 : b > 255 ? 255 : b) << 16)
        | ((g < 0 ? 0 : g > 255 ? 255 : g) << 8)
        | (r < 0 ? 0 : r > 255 ? 255 : r);
    }
  }

  posterise(target);
  return target;
}

/** How far past the map's edge the land sinks IN THIS VIEW, in cells.
 *
 *  ONE LAW, TWO SCALES, and the scale is the whole point. The flyover
 *  meets the map's edge at four hundred units through haze, where 260
 *  cells of fade is a gentle dissolve. Looking straight down, the same
 *  260 cells is most of the visible margin - the clamped edge row is
 *  still seven tenths present when it leaves the frame - so the north
 *  and south rims came back as horizontal smears of repeated mountain.
 *  edgeFade already takes the taper as an argument; this is the same
 *  law read at the distance this view actually sees it from. */
export const MAP_EDGE_TAPER = 45;

/** The widest the map view is allowed to open, in cells across the
 *  frame's width.
 *
 *  A CAP, AND IT IS GEOMETRY NOT TASTE. The province is 1024 x 640 and
 *  the frame is 16:9, so a span past 640 * 16/9 = 1138 starts showing
 *  sky above and below the map as well as beside it - and every cell of
 *  that is clamped edge, which is the smear again. Under this the frame
 *  is always within the province vertically. */
export const MAX_SPAN = 1120;

/** How far a cloud's shadow may fall, as a fraction of the frame. */
export const SHADOW_CAP = 0.16;

/** Scratch for the per-frame cloud buffer. */
let CLOUD_BUF = new Float32Array(96 * 96);

/** The one field the whole intro shares. */
export const defaultClouds = makeClouds();
