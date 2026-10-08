// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md) - THE OPEN ZONE ON THE WORLD MAP.
//
// The owner: "make sure the high risk area is marked with a highquality fog of war on the world map and red lines
// around it". So the Wrothgarian Mountains wear two things on the held map's world sheet (ui/heldMap.js):
//
//   THE FOG - a drifting smoke over every pixel of the zone, thickest in its heart and thinning to nothing a pixel or
//   two inside its edge, so the mountains' own ink still reads through it. Built ONCE a map, on a canvas of its own at
//   FOG_RES canvas pixels a map pixel (the map's whole span of the zone, never more): the zone's mask feathered by a
//   distance-to-edge falloff, times three octaves of value noise, in the parchment's own ash and dried-blood tones. The
//   sheet draws it as one image under the view's transform, smoothed - nothing is computed per frame.
//   THE RED LINE - the zone's edge (systems/wildZone.js wildEdgeChains), a dark halo under a red stroke, and over it a
//   brighter dashed line once the sheet is zoomed past its far band - the map's own pen, a warning's colour.
//
// And one mark the overlay breathes: MY REMAINS (net/wildRemains.js) - a ring and its name where my things lie, while
// they lie, pulsing as the gate's ring does.
//
// Pure canvas 2D over the view's own transform (ui/inkMap.js toPaper); no game import beyond the zone's leaf.
// ═══════════════════════════════════════════════════════════════════
import { wildEdgeChains } from '../systems/wildZone.js';
import { smoothContour } from './wildZoneMap.js';   // SMOOTHZONE: the red line is a contour, not a pixel's staircase

/** Canvas pixels a map pixel in the fog's own canvas - smooth at any zoom the sheet allows, ~1 MB for the zone. */
export const FOG_RES = 6;
/** How far inside the edge the fog thickens to its body, map pixels. */
export const FOG_FEATHER_PX = 2.5;
/** The fog's tones: ash, and the zone's dried blood at its heart. */
export const FOG_ASH = Object.freeze([46, 40, 38]);
export const FOG_BLOOD = Object.freeze([92, 18, 14]);
/** The line's inks. */
export const WILD_LINE = Object.freeze({ halo: 'rgba(28,6,4,0.55)', red: '#b3261a', bright: 'rgba(235,72,52,0.95)' });

/** A small, stable hash noise (value noise on an integer lattice), 0..1. */
function lattice(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
/** Value noise at (x, y), bilinear over the lattice with a smoothstep. */
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const a = lattice(xi, yi, seed), b = lattice(xi + 1, yi, seed), c = lattice(xi, yi + 1, seed), d = lattice(xi + 1, yi + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Three octaves, 0..1. */
export function fogNoise(x, y) {
  return (valueNoise(x, y, 7) * 0.55 + valueNoise(x * 2.03, y * 2.03, 13) * 0.3 + valueNoise(x * 4.11, y * 4.11, 29) * 0.15);
}

/**
 * THE FOG's pixels for a zone mask: `{ data: Uint8ClampedArray (RGBA), w, h, x0, y0 }` - the zone's box, FOG_RES canvas
 * pixels a map pixel, its alpha the feathered mask times the noise. Pure (no canvas), so the pins can read it.
 */
export function fogPixels(mask, res = FOG_RES) {
  if (!mask?.box) return null;
  const { x0, y0, x1, y1 } = mask.box;
  const mw = x1 - x0 + 1, mh = y1 - y0 + 1;
  // the distance (in map pixels, a chessboard's) from each inside pixel to the nearest outside one, out to the feather
  const reach = Math.ceil(FOG_FEATHER_PX) + 1;
  const depth = new Float32Array(mw * mh);
  const isIn = (x, y) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.inside[y * mask.width + x] === 1;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const gx = x0 + x, gy = y0 + y;
      if (!isIn(gx, gy)) { depth[y * mw + x] = 0; continue; }
      let d = reach;
      for (let r = 1; r <= reach && d === reach; r++) {
        for (let k = -r; k <= r && d === reach; k++) {
          if (!isIn(gx + k, gy - r) || !isIn(gx + k, gy + r) || !isIn(gx - r, gy + k) || !isIn(gx + r, gy + k)) d = r;
        }
      }
      depth[y * mw + x] = d;
    }
  }
  const w = mw * res, h = mh * res;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) {
    const my = py / res;
    const iy = Math.min(mh - 1, Math.floor(my));
    for (let px = 0; px < w; px++) {
      const mx = px / res;
      const ix = Math.min(mw - 1, Math.floor(mx));
      // bilinear depth across the map pixels, so the feather is a slope and not a staircase
      const fx = mx - ix - 0.5, fy = my - iy - 0.5;
      const sx = fx < 0 ? -1 : 1, sy = fy < 0 ? -1 : 1;
      const at = (x, y) => (x >= 0 && y >= 0 && x < mw && y < mh ? depth[y * mw + x] : 0);
      const ax = Math.abs(fx), ay = Math.abs(fy);
      const dd = at(ix, iy) * (1 - ax) * (1 - ay) + at(ix + sx, iy) * ax * (1 - ay) + at(ix, iy + sy) * (1 - ax) * ay + at(ix + sx, iy + sy) * ax * ay;
      const edge = Math.max(0, Math.min(1, (dd - 0.35) / FOG_FEATHER_PX));
      if (edge <= 0) continue;
      const n = fogNoise((x0 + mx) * 0.55, (y0 + my) * 0.55);
      const heart = Math.max(0, Math.min(1, (dd - 1) / (reach + 1)));
      const a = edge * (0.42 + 0.38 * n) * (0.85 + 0.15 * heart);
      const t = Math.max(0, Math.min(1, 0.25 + heart * 0.45 + (n - 0.5) * 0.5));
      const o = (py * w + px) * 4;
      data[o] = FOG_ASH[0] + (FOG_BLOOD[0] - FOG_ASH[0]) * t;
      data[o + 1] = FOG_ASH[1] + (FOG_BLOOD[1] - FOG_ASH[1]) * t;
      data[o + 2] = FOG_ASH[2] + (FOG_BLOOD[2] - FOG_ASH[2]) * t;
      data[o + 3] = Math.round(255 * Math.min(0.78, a));
    }
  }
  return { data, w, h, x0, y0 };
}

const _cache = new WeakMap();   // mask -> { canvas, x0, y0, w, h, chains }
/** The fog as a canvas and the edge's chains, built once a mask (null without a document or a zone). */
export function wildInk(mask, doc = globalThis.document) {
  if (!mask?.box || !doc?.createElement) return null;
  const had = _cache.get(mask);
  if (had) return had;
  const px = fogPixels(mask);
  let canvas = null;
  if (px) {
    canvas = doc.createElement('canvas');
    canvas.width = px.w; canvas.height = px.h;
    const c = canvas.getContext('2d');
    if (c) c.putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
  }
  const ink = { canvas, x0: px?.x0 ?? 0, y0: px?.y0 ?? 0, w: (px?.w ?? 0) / FOG_RES, h: (px?.h ?? 0) / FOG_RES, chains: wildEdgeChains(mask).map((c) => smoothContour(c)) };
  _cache.set(mask, ink);
  return ink;
}

/** The view's map point to the paper's (ui/inkMap.js toPaper, restated so this leaf needs none of the sheet). */
const paper = (view, x, y) => [(x - view.ox) * view.scale, (y - view.oy) * view.scale];

/**
 * THE ZONE ON THE SHEET - the fog, then the red line - in paper pixels (the sheet's own dpr transform already set).
 * `far` the sheet's zoom band is its farthest (the dashes are left off there: a thin red line alone reads at that
 * size); `fog` the fog's alpha (1, or a breath on the zone map). Nothing drawn when the zone is off the paper.
 */
export function paintWildZone(ctx, view, ink, { paperW, paperH, far = false, fog = 1 }) {
  if (!ink || !view) return;
  const [ax, ay] = paper(view, ink.x0, ink.y0);
  const bw = ink.w * view.scale, bh = ink.h * view.scale;
  if (ax > paperW || ay > paperH || ax + bw < 0 || ay + bh < 0) return;
  ctx.save();
  if (ink.canvas) {
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch { /* an older canvas */ }
    ctx.globalAlpha = fog;   // WILD2: the zone map thins it, so its rings' tones read
    // SMOOTHZONE: the fog is cut by the smoothed contour, so its edge is the red line's own curve
    ctx.save();
    ctx.beginPath();
    for (const c of ink.chains) {
      for (let i = 0; i < c.length; i++) { const [x, y] = paper(view, c[i].x, c[i].y); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.closePath();
    }
    ctx.clip('evenodd');
    ctx.drawImage(ink.canvas, ax, ay, bw, bh);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  const topY = ink.y0 === 0 ? 1.0 : -Infinity;   // PVPDUNGEONS: no line along the map's own upper edge, where the map ends
  const path = () => {
    ctx.beginPath();
    for (const c of ink.chains) {
      for (let i = 0; i < c.length; i++) {
        const [x, y] = paper(view, c[i].x, c[i].y);
        if (i === 0 || (c[i].y < topY && c[i - 1].y < topY)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  path();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(28,6,4,0.22)'; ctx.lineWidth = Math.max(7, Math.min(13, view.scale * 1.7)); ctx.stroke();   // SMOOTHZONE: a wide soft shadow under the line
  ctx.strokeStyle = WILD_LINE.halo; ctx.lineWidth = Math.max(3.5, Math.min(7, view.scale * 0.9)); ctx.stroke();
  ctx.strokeStyle = WILD_LINE.red; ctx.lineWidth = Math.max(1.6, Math.min(3, view.scale * 0.38)); ctx.stroke();
  if (!far) {
    ctx.setLineDash([Math.max(4, view.scale * 0.9), Math.max(3, view.scale * 0.6)]);
    ctx.strokeStyle = WILD_LINE.bright; ctx.lineWidth = Math.max(0.8, Math.min(1.4, view.scale * 0.16)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** MY REMAINS on the overlay: a pulsing ring and its words at map point (x, y), and the minutes they have left. */
export function paintWildRemains(ctx, view, marks, { pulse = 0, label = 'Your remains' } = {}) {
  if (!marks?.length || !view) return;
  ctx.save();
  ctx.font = "600 11px 'Cormorant', Georgia, serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const m of marks) {
    const [x, y] = paper(view, m.x, m.y);
    const r = 7 + 2.5 * (0.5 + 0.5 * Math.sin(pulse * Math.PI * 2));
    ctx.lineWidth = 3; ctx.strokeStyle = WILD_LINE.halo; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = WILD_LINE.bright; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    // a small cross at its heart - where the body lay
    ctx.lineWidth = 2; ctx.strokeStyle = WILD_LINE.red;
    ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke();
    const text = m.minutes != null ? `${label} (${m.minutes} min)` : label;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(244,234,210,0.85)'; ctx.strokeText(text, x, y + r + 3);
    ctx.fillStyle = '#6b1d10'; ctx.fillText(text, x, y + r + 3);
  }
  ctx.restore();
}

/** The map key's swatch for the zone: a square of its fog edged in its red line, KEY_CHIP_PX on a side (ui/heldMap.js). */
export function paintWildKeyChip(ctx, { dpr = 1, size = 14 } = {}) {
  if (!ctx) return;
  const s = size * dpr;
  ctx.save();
  ctx.clearRect(0, 0, s, s);
  const g = ctx.createRadialGradient?.(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.7);
  if (g) {
    g.addColorStop(0, `rgba(${FOG_BLOOD.join(',')},0.75)`);
    g.addColorStop(1, `rgba(${FOG_ASH.join(',')},0.55)`);
    ctx.fillStyle = g;
  } else ctx.fillStyle = `rgba(${FOG_ASH.join(',')},0.6)`;
  ctx.fillRect(1.5 * dpr, 1.5 * dpr, s - 3 * dpr, s - 3 * dpr);
  ctx.lineWidth = 3 * dpr; ctx.strokeStyle = WILD_LINE.halo; ctx.strokeRect(1.5 * dpr, 1.5 * dpr, s - 3 * dpr, s - 3 * dpr);
  ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = WILD_LINE.red; ctx.strokeRect(1.5 * dpr, 1.5 * dpr, s - 3 * dpr, s - 3 * dpr);
  ctx.restore();
}

// ── PVPDUNGEONS: THE CROWS OVER A HALL A BODY LIES IN, AND THE ZONE'S BORDER ALIGHT ───────────────────────────────────
// Both are the overlay's (ui/heldMap.js paintOverlay): redrawn at the window's FX_HZ only while something moves, over the
// kept layer, so neither costs the sheet's static ink a repaint.

// THE CROWS (the owner: "use the first ones we had thats enough"): three small black birds circling a hall a body lies
// in, each three dark pixels - a body and two wings that beat up and down - on its own place round the circle.
/** A hall's flock: `halls` `[{ x, y, key }]` (the ones a body lies in), circling over each hall's mark. */
export function paintWildCrows(ctx, view, halls, { t = 0, paperW = Infinity, paperH = Infinity } = {}) {
  if (!halls?.length || !view) return;
  const px = Math.max(1, Math.min(3, Math.round(view.scale * 0.32)));
  const rr = 13 * px * 0.9 + 6;
  ctx.save();
  ctx.fillStyle = '#0c0c10';
  for (const h of halls) {
    const [cx, cy] = paper(view, h.x + 0.5, h.y + 0.5);
    if (cx < -rr * 2 || cy < -rr * 2 || cx > paperW + rr * 2 || cy > paperH + rr * 2) continue;
    for (let i = 0; i < 3; i++) {
      const a = t * 1.3 + i * 2.1;
      const bx = Math.round(cx + Math.cos(a) * rr), by = Math.round(cy + Math.sin(a) * rr * 0.6 - 4);
      const flap = Math.floor(t * 6 + i) % 2 === 0;
      ctx.fillRect(bx, by, 2 * px, px);                                // the body
      ctx.fillRect(bx - 2 * px, by + (flap ? -px : px), 2 * px, px);   // the wings, up then down
      ctx.fillRect(bx + 2 * px, by + (flap ? -px : px), 2 * px, px);
    }
  }
  ctx.restore();
}

// ZONE-GIANTS (2026-10-08, the owner: "always spawn 2 giants per tier and make em show on the map where they wander
// around", then: "show the giants as skulls high quality pixel ones please and dont use the same method those circly
// around them look cheap"): each giant a pixel SKULL where it walks - an outlined bone dome lit from the upper left,
// shaded down its right side, deep sockets with an ember in each, the nasal hollow and a row of teeth - with a soft drop
// shadow under it and no halo. A giant that stands in my own world now has its embers burning bright and breathing.
// Paper pixels, whole ones (crisp at any zoom): one per sprite pixel on the world map, two once the map is close.
const SKULL = [   // GIANT-SKULL2 (the owner: "make the skulls a bit smaller"): eleven by ten
  '...OOOOO...',
  '.OOWWWBBOO.',
  'OWWWBBBBBSO',
  'OWWBBBBBBSO',
  'OBEEEBEEESO',
  'OBEREBERESO',
  '.OBBBEBBSO.',
  '..OSBBBSO..',
  '..OBOBOBO..',
  '...OOOOO...',
];
const SKULL_INK = { O: '#1b120b', W: '#fbf4e2', B: '#e3d6b6', S: '#a8946c', E: '#120c08' };
const SKULL_DEAD_INK = { O: '#2a2420', W: '#cfc8b8', B: '#aaa293', S: '#7c7466', E: '#1a1612' };
/** GIANT-FALL: the cross over a fallen giant's skull - two crisp diagonals corner to corner, a deep red with a one-pixel
 *  dark rim, thin enough that the skull reads through it. */
function paintSkullCross(ctx, x0, y0, cols, rows, px) {
  const n = Math.max(cols, rows), ox = x0 - Math.round(((n - cols) * px) / 2), oy = y0 - Math.round(((n - rows) * px) / 2);
  const cells = (pass) => { for (let k = 0; k < n; k++) for (const c of [k, n - 1 - k]) pass(ox + c * px, oy + k * px); };
  ctx.fillStyle = 'rgba(27,8,5,0.9)';
  cells((x, y) => ctx.fillRect(x - 1, y - 1, px + 2, px + 2));
  ctx.fillStyle = '#c8301f';
  cells((x, y) => ctx.fillRect(x, y, px, px));
}
export function paintWildGiants(ctx, view, giants, { paperW = Infinity, paperH = Infinity, t = 0 } = {}) {
  if (!giants?.length || !view) return;
  const px = view.scale >= 4 ? 2 : 1;
  const cols = SKULL[0].length, rows = SKULL.length, w = cols * px, h = rows * px;
  ctx.save();
  for (const gi of giants) {
    const [cx, cy] = paper(view, gi.x, gi.y);
    if (cx < -w * 2 || cy < -h * 2 || cx > paperW + w * 2 || cy > paperH + h * 2) continue;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    // the drop shadow: the skull's own shape, a pixel down and right, faint
    ctx.fillStyle = 'rgba(20,12,6,0.28)';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (SKULL[r][c] !== '.') ctx.fillRect(x0 + (c + 1) * px, y0 + (r + 1) * px, px, px);
    const glow = gi.here ? 0.75 + 0.25 * Math.sin(t * 5 + gi.g) : 0;
    const ink = gi.dead ? SKULL_DEAD_INK : SKULL_INK;
    for (let r = 0; r < rows; r++) {
      const row = SKULL[r];
      for (let c = 0; c < row.length; c++) {
        const k = row[c];
        if (k === '.') continue;
        ctx.fillStyle = k === 'R' ? (gi.dead ? '#1a1612' : gi.here ? `rgba(255,${Math.round(90 + 90 * glow)},40,1)` : '#b0281a') : ink[k];
        ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
      }
    }
    if (gi.dead) paintSkullCross(ctx, x0, y0, cols, rows, px);   // GIANT-FALL: fallen - crossed out where it lies
  }
  ctx.restore();
}

// HALL-LOCK MARK (2026-10-08, the owner: "It should also show locked dungeons for you with a tiny lock symbol next to it"):
// a tiny padlock at the upper right of each hall whose hour's lock holds for ME - its shackle an arch, its body a dark
// block with a light keyhole, a parchment halo round both so it reads over any ink. Paper pixels, the glyphs' own size.
export function paintWildLocks(ctx, view, halls, { paperW = Infinity, paperH = Infinity } = {}) {
  if (!halls?.length || !view) return;
  ctx.save();
  for (const h of halls) {
    const [cx, cy] = paper(view, h.x + 0.5, h.y + 0.5);
    const x = Math.round(cx + 6), y = Math.round(cy - 7);   // the body's top-left; the glyph's reach is 5
    if (x < -12 || y < -12 || x > paperW + 12 || y > paperH + 12) continue;
    // the halo
    ctx.fillStyle = 'rgba(238,222,190,0.92)';
    ctx.fillRect(x - 1, y - 4, 8, 10);
    // the shackle
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + 1.2, y + 0.5); ctx.lineTo(x + 1.2, y - 1); ctx.arc(x + 3, y - 1, 1.8, Math.PI, 0); ctx.lineTo(x + 4.8, y + 0.5); ctx.stroke();
    // the body and its keyhole
    ctx.fillStyle = '#7a1f14'; ctx.fillRect(x, y, 6, 5);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y + 4, 6, 1);
    ctx.fillStyle = '#f1dfb8'; ctx.fillRect(x + 2.5, y + 1.3, 1, 2);
  }
  ctx.restore();
}

// THE BORDER ALIGHT: a fire along the red line while the pointer is on the zone (the world map alone). Tongues of square
// pixels rise off the line - white-hot at the root through yellow and orange to a red tip, each with its own height that
// breathes and a sway that grows toward its tip - over a warm glow laid with `lighter` (no blur: three soft strokes), with
// a few embers lifting away. Never along the map's own upper edge, where the map ends.
const FLAME_PAL = ['#fff4cf', '#ffe17a', '#ffbd3e', '#ff8a24', '#e8521c', '#a62a14'];
const _h = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
export function paintWildFlames(ctx, view, ink, t = 0, { paperW = Infinity, paperH = Infinity } = {}) {
  if (!ink?.chains?.length || !view) return;
  const PX = view.scale >= 5 ? 3 : 2, topY = ink.y0 === 0 ? 1.0 : -Infinity;
  const onPaper = (x, y) => x > -20 && y > -40 && x < paperW + 20 && y < paperH + 20;
  ctx.save();
  // the glow: three wide soft strokes, added
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  for (const c of ink.chains) for (let i = 0; i < c.length; i++) { const [x, y] = paper(view, c[i].x, c[i].y); if (i === 0 || (c[i].y < topY && c[i - 1].y < topY)) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  const breath = 0.85 + 0.15 * Math.sin(t * 6.3);
  for (const [w, a] of [[16, 0.05], [9, 0.08], [4, 0.12]]) { ctx.strokeStyle = `rgba(255,${110 + w * 4},40,${(a * breath).toFixed(3)})`; ctx.lineWidth = w; ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over';
  // the tongues, a column of square pixels every two pixels along the line
  let n = 0;
  for (const c of ink.chains) {
    let acc = 0;
    for (let i = 1; i < c.length; i++) {
      if (c[i].y < topY && c[i - 1].y < topY) continue;
      const [x0, y0] = paper(view, c[i - 1].x, c[i - 1].y), [x1, y1] = paper(view, c[i].x, c[i].y);
      const seg = Math.hypot(x1 - x0, y1 - y0);
      acc += seg;
      while (acc >= PX * 1.5) {
        acc -= PX * 1.5;
        n++;
        const f0 = seg ? 1 - acc / seg : 1;
        const bx = x0 + (x1 - x0) * f0, by = y0 + (y1 - y0) * f0;
        if (!onPaper(bx, by)) continue;
        const r = _h(n);
        const flick = 0.55 + 0.3 * Math.sin(t * (6 + r * 5) + r * 40) + 0.15 * Math.sin(t * 17 + n * 0.7);
        const height = Math.max(2, Math.round((3 + r * 6 + 3 * Math.sin(n * 0.21 + t * 1.3)) * flick));
        for (let k = 0; k < height; k++) {
          const f = k / height;
          const sway = Math.sin(t * 7 + n * 0.8 + k * 0.6) * (0.3 + k * 0.55);
          const col = FLAME_PAL[Math.min(FLAME_PAL.length - 1, Math.floor(f * (FLAME_PAL.length - 0.01) + (1 - flick) * 0.8))];
          ctx.globalAlpha = Math.max(0.2, 1 - f * f * 0.7);
          ctx.fillStyle = col;
          ctx.fillRect(Math.round((bx + sway) / PX) * PX, Math.round((by - (k + 0.5) * PX) / PX) * PX, k < height * 0.4 ? PX * 2 : PX, PX);
        }
        if (_h(n + 77) > 0.9) {   // an ember
          const life = (t * (0.6 + r) + r * 7) % 1;
          ctx.globalAlpha = (1 - life) * 0.9; ctx.fillStyle = life < 0.5 ? '#ffd56a' : '#ff8a3a';
          ctx.fillRect(Math.round((bx + Math.sin(t * 2 + n) * 5 * life) / PX) * PX, Math.round((by - (height + life * 12) * PX) / PX) * PX, PX, PX);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
