// @ts-check
// AUDIT-STOREFRONT II (2026-10-29, the owner: "the glyphs for the horse and the general art of those icons is so bad";
// bible/06-Systems/Storefront.md section 9): THE EFFECTS' EMBLEMS, drawn again in the profile icons' hand - a lit field
// in a bezel, the picture modelled in light and shade, and moving where the effect moves (ui/profileIcons.js
// drawnIconNode builds them, and stills them for less motion). A mount look is a horse's head and neck drawn whole -
// ears, brow, cheek, muzzle - in its look. Pure data: shapes in the icons' `[tag, attrs, children]` form, a 64-unit square.
import { gearPath, starPath, glintPath, spin, pulse, drift, sway, mote } from './iconKit.js';

// ═══ THE HORSE: its head and neck in profile, its muzzle to the left ═══
/** The whole silhouette: the throat, the round cheek, the jaw, chin and lips, the face's long line, the two ears, the crest. */
const HEAD = 'M37 64 C38.4 54 39.6 44 40.8 35 C40.4 39.4 37.6 41.4 33.8 41.6 C28.6 42 23.2 45.8 20.2 50.4 C19.4 52.8 17 54.6 14.4 54 '
  + 'C12.4 53.6 11.6 52.2 12.2 51 C10.2 50.6 8.6 49 8.6 46.6 C8.6 44 9.8 42.2 11.6 40.6 C16 35.6 21.4 27.4 26.4 20.4 C27.8 18.4 29.4 17 30.8 15.8 '
  + 'C31.8 14.8 32.4 13.8 32.8 12.8 C32.4 9.2 33.2 5.4 35.4 2.4 C37.8 5.2 39.2 8.8 38.9 12 C39.4 9 40.6 6.4 42.6 4.2 C44 7.6 44 10.6 43.2 13.4 '
  + 'C50.4 14.8 56 22.6 58 33.6 C59.6 42.6 60.6 53 61 64 Z';
/** The near ear's hollow. */
const EAR_IN = 'M33.9 11.4 C33.8 8.4 34.4 6 35.4 4.6 C36.7 6.6 37.6 9 37.7 11.8 C36.4 10.8 35 10.8 33.9 11.4 Z';
/** The eye's almond, its lid over it, at the brow. */
const EYE = 'M27.4 22.6 C28.4 20.6 30.4 19.6 32.2 19.8 C31.6 21.8 29.6 23.2 27.4 22.6 Z';
const LID = 'M27 22.2 C28 19.8 30.4 18.8 32.6 19.4';
/** The nostril's flared comma, and the mouth's line. */
const NOSTRIL = 'M11.4 42.6 C13.2 41.8 14.8 43 14.8 45.2 C14 44.2 12.8 43.8 11.6 44.2 Z';
const MOUTH = 'M12.2 51 C13.8 50.4 15.8 50.2 17.6 50.8';
/** The crest's line, a mane's root. */
const CREST = 'M43.2 13.4 C50.4 14.8 56 22.6 58 33.6 C59.6 42.6 60.6 53 61 64';

/** The light and shade every horse is modelled with: the round cheek lit, the face's ridge and the nose caught by the
 *  light, the throat and the jaw's underside in shadow. `lit` and `dark` the look's own two. */
const modelled = (/** @type {string} */ lit, /** @type {string} */ dark, k = 1) => [
  ['ellipse', { cx: 33.6, cy: 32.4, rx: 6.4, ry: 5.2, fill: lit, opacity: 0.16 * k, transform: 'rotate(-34 33.6 32.4)' }],
  ['ellipse', { cx: 32.8, cy: 31.4, rx: 3.6, ry: 2.6, fill: lit, opacity: 0.14 * k, transform: 'rotate(-34 32.8 31.4)' }],
  ['path', { d: 'M30.8 24.4 C27.2 28.6 23.8 33.2 21 37.4', stroke: lit, 'stroke-width': 0.8, fill: 'none', opacity: 0.3 * k, 'stroke-linecap': 'round' }],
  ['path', { d: 'M24.6 22.6 C20.6 28.4 16.6 34 13.2 38.8', stroke: lit, 'stroke-width': 0.6, fill: 'none', opacity: 0.3 * k, 'stroke-linecap': 'round' }],
  ['path', { d: 'M44.4 15.6 C50.2 17.4 54.6 24 56.4 33', stroke: lit, 'stroke-width': 1, fill: 'none', opacity: 0.22 * k }],
  ['path', { d: 'M40.8 35 C40.4 39.4 37.6 41.4 33.8 41.6 C28.6 42 23.2 45.8 20.2 50.4', stroke: dark, 'stroke-width': 2.4, fill: 'none', opacity: 0.55 * k }],
  ['path', { d: 'M37 64 C38.4 54 39.6 44 40.8 35', stroke: dark, 'stroke-width': 3.4, fill: 'none', opacity: 0.4 * k }],
  ['path', { d: 'M41.6 33.6 C46 37.4 49.4 44 50.6 52', stroke: dark, 'stroke-width': 0.8, fill: 'none', opacity: 0.35 * k }],
];
/** The eye, the nostril and the mouth, in the look's own ink (`ink`) with a catch-light (`glint`). */
const features = (/** @type {string} */ ink, /** @type {string} */ glint) => [
  ['path', { d: EYE, fill: ink }],
  ['circle', { cx: 30.6, cy: 20.9, r: 0.55, fill: glint }],
  ['path', { d: LID, stroke: ink, 'stroke-width': 0.7, fill: 'none', opacity: 0.7 }],
  ['path', { d: NOSTRIL, fill: ink, opacity: 0.85 }],
  ['path', { d: MOUTH, stroke: ink, 'stroke-width': 0.7, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }],
];
/** Points down the crest, a fin's or a rivet's root. */
const MANE_ROOTS = [[42.4, 12.6], [46, 13.6], [49.2, 15.8], [52, 19], [54.2, 23], [55.8, 27.6], [57, 32.6], [58, 38], [58.8, 43.6], [59.4, 49.4]];
/** The frame a horse is drawn in: a little smaller than its field, so the ears and the muzzle stand clear of the rim. */
const FRAME = 'translate(5.4 7) scale(0.86)';
/** A band down the crest, an armour's crinet or a fin's root. */
const CREST_BAND = 'M42.6 13.2 C50.4 14.6 56 22.4 58 33.4 C59.6 42.4 60.6 53 61 64 L55.8 64 C55.4 53.6 54.6 43.8 53 35.4 C51.2 26.2 47.2 20.2 41.4 18 Z';
/** The crest's two curves, as their points: a lock of mane is laid on it by its place and its slope. */
const CREST_CURVES = [[[43.2, 13.4], [50.4, 14.8], [56, 22.6], [58, 33.6]], [[58, 33.6], [59.6, 42.6], [60.6, 53], [61, 64]]];
const r2 = (/** @type {number} */ n) => Math.round(n * 100) / 100;
/** The crest at `u` (0 at the poll, 1 at the neck's foot): its point, its way along (`t`) and its way out (`n`). */
function crestAt(/** @type {number} */ u) {
  const seg = u < 0.5 ? CREST_CURVES[0] : CREST_CURVES[1], q = u < 0.5 ? u * 2 : (u - 0.5) * 2, m = 1 - q;
  const at = (/** @type {number} */ i) => m * m * m * seg[0][i] + 3 * m * m * q * seg[1][i] + 3 * m * q * q * seg[2][i] + q * q * q * seg[3][i];
  const dt = (/** @type {number} */ i) => 3 * m * m * (seg[1][i] - seg[0][i]) + 6 * m * q * (seg[2][i] - seg[1][i]) + 3 * q * q * (seg[3][i] - seg[2][i]);
  const tx = dt(0), ty = dt(1), l = Math.hypot(tx, ty) || 1;
  return { x: at(0), y: at(1), t: [tx / l, ty / l], n: [ty / l, -tx / l] };
}
/**
 * A MANE THAT RISES - fire, smoke or light off the crest: `count` locks from the poll to `upTo` down the crest, each
 * rising `len` out and leaning `lean` of that back, `w` wide at its root, a little longer and shorter by turns.
 */
function risingMane(/** @type {number} */ count, /** @type {number} */ len, /** @type {number} */ w, lean = 0.7, upTo = 0.72) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const c = crestAt(0.02 + (upTo * i) / (count - 1)), L = len * (i % 3 === 1 ? 1.2 : i % 3 === 2 ? 0.85 : 1);
    const p = (/** @type {number} */ u, /** @type {number} */ v) => `${r2(c.x + c.t[0] * u + c.n[0] * v)} ${r2(c.y + c.t[1] * u + c.n[1] * v)}`;
    parts.push(`M${p(-w / 2, -0.6)} C${p(-w * 0.3, L * 0.45)} ${p(L * lean * 0.3, L * 0.8)} ${p(L * lean, L)} C${p(L * lean * 0.5, L * 0.6)} ${p(w * 0.7, L * 0.3)} ${p(w / 2, -0.6)} Z`);
  }
  return parts.join(' ');
}
/** The forelock between the ears, over the brow. */
const FORELOCK = 'M35.6 11.6 C33.6 12.8 31.6 15.2 30.2 18.4 C32.4 16.6 34 16 35.2 16.2 C34.6 17.8 34.6 19.4 35.2 20.8 C36 18.2 37.6 15.8 39.6 14.4 C38.8 13 37.4 12 35.6 11.6 Z';

/** A ring through (cx, cy) of radii (rx, ry) as a path, for a hole cut in a shape (`evenodd`). */
const ringHole = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rx, /** @type {number} */ ry) =>
  ` M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
/** Marks at angles round an ellipse, each `mark(x, y, deg)` - runes on a ring, rivets on a rim. */
const round = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rx, /** @type {number} */ ry, /** @type {number} */ n, /** @type {(x: number, y: number, deg: number) => any} */ mark, from = -90) =>
  Array.from({ length: n }, (_, i) => { const a = ((from + (360 * i) / n) * Math.PI) / 180; return mark(r2(cx + Math.cos(a) * rx), r2(cy + Math.sin(a) * ry), r2(from + (360 * i) / n + 90)); });
/** A flake of ash or a shard at (x, y), `r` across, turned `deg`. */
const flake = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ r, /** @type {number} */ deg) =>
  `M${r2(x - r)} ${y} L${x} ${r2(y - r * 0.6)} L${r2(x + r)} ${r2(y + r * 0.2)} L${r2(x + r * 0.2)} ${r2(y + r * 0.8)} Z`;
/** A shard drawn in from `from` (dx, dy off its place) toward the rift, fading as it goes. */
const drawnIn = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ dx, /** @type {number} */ dy, /** @type {number} */ dur, /** @type {number} */ begin) =>
  ['path', { d: flake(x, y, 1.8, 0), fill: '#2a1a4a', stroke: '#d6b8ff', 'stroke-width': 0.4, opacity: 0 }, [
    drift(`M0 0 L${dx} ${dy}`, dur, begin),
    pulse('opacity', '0;1;0.8;0', dur, begin, { keyTimes: '0;0.2;0.75;1' }),
  ]];

export const EMBLEM_ART = Object.freeze({
  // ═══ KILL EFFECTS: the foe taken, each its own way ═══
  'kill:ashen': Object.freeze({   // a skull burnt to grey ash, embers in its cracks, its jaw crumbling away into rising flakes
    field: ['#3a2e28', '#080605'],
    bezel: 'iron',
    defs: {
      heat: ['radialGradient', { cx: '50%', cy: '85%', r: '70%' }, [[0, '#ff7a1a', 0.7], [0.4, '#7a2a0a', 0.45], [1, '#0a0605', 0]]],
      ash: ['linearGradient', { x1: 0.2, y1: 0, x2: 0.8, y2: 1 }, [[0, '#ece6dc'], [0.35, '#b4aca2'], [0.75, '#6a625a'], [1, '#3a342e']]],
      socket: ['radialGradient', { cx: '50%', cy: '55%', r: '60%' }, [[0, '#ff9a3c', 0.9], [0.4, '#7a1a06'], [1, '#100806']]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 0.8 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#heat)' }],
      ['ellipse', { cx: 32, cy: 53, rx: 19, ry: 4.2, fill: 'none', stroke: '#ff8a3a', 'stroke-width': 1.6, opacity: 0.85 }, [pulse('opacity', '0.5;1;0.5', 1.8)]],
      ['ellipse', { cx: 32, cy: 53, rx: 13, ry: 2.6, fill: '#ffb45a', opacity: 0.35, filter: 'url(#glow)' }],
      // the cranium and the cheekbones, the jaw already gone to flakes
      ['path', { d: 'M18.6 29 C18.6 17.6 25 11.4 32 11.4 C39 11.4 45.4 17.6 45.4 29 C45.4 33.4 44 36.6 41.6 38.6 L41 42.2 L37.6 40.6 L35.6 43.4 L33 41 L30.4 43.6 L28 40.8 L25.6 43 L23 40.2 L22.4 38.6 C20 36.6 18.6 33.4 18.6 29 Z', fill: 'url(#ash)', stroke: '#1e1a16', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M22 23.4 C23.4 17.6 27.4 14.4 32 14', stroke: '#fffaf0', 'stroke-width': 1.3, fill: 'none', opacity: 0.55, 'stroke-linecap': 'round' }],
      ['path', { d: 'M41.6 20 C44 24 44.6 30 42.6 35.4 C41.4 37.6 39.4 38.6 38.4 38.8 C41.4 33 41.8 26 41.6 20 Z', fill: '#2a241e', opacity: 0.45 }],
      ['path', { d: 'M22.4 29.6 C22.4 25.8 25 24.4 27.4 24.6 C30 24.8 30.8 27.2 30.4 29.8 C30 32.6 28 34 26 33.8 C23.8 33.6 22.4 32 22.4 29.6 Z M33.6 29.8 C33.2 27.2 34 24.8 36.6 24.6 C39 24.4 41.6 25.8 41.6 29.6 C41.6 32 40.2 33.6 38 33.8 C36 34 34 32.6 33.6 29.8 Z',
        fill: 'url(#socket)', stroke: '#1e1a16', 'stroke-width': 0.7 }, [pulse('opacity', '0.8;1;0.85;1;0.8', 1.4)]],
      ['path', { d: 'M32 33.4 L30.2 37.6 L33.8 37.6 Z', fill: '#140c08' }],
      // the cracks, embers in them
      ['path', { d: 'M32 11.6 L31 15.4 L33.2 18 L31.4 21 M38.6 13.8 L37.2 17.4 L39.4 19.6 M20.4 25 L23.4 26.6 M44 33 L41.4 34.6 L42.4 37.4 M26.6 40.2 L27.8 37.4 L26.4 35.6',
        stroke: '#ff8a3a', 'stroke-width': 0.8, fill: 'none', 'stroke-linejoin': 'round', filter: 'url(#glow)' }, [pulse('opacity', '0.45;1;0.6;1;0.45', 2)]],
      ['path', { d: 'M32 11.6 L31 15.4 L33.2 18 L31.4 21 M38.6 13.8 L37.2 17.4 L39.4 19.6 M20.4 25 L23.4 26.6 M44 33 L41.4 34.6 L42.4 37.4 M26.6 40.2 L27.8 37.4 L26.4 35.6',
        stroke: '#ffe8a0', 'stroke-width': 0.35, fill: 'none', 'stroke-linejoin': 'round' }],
      // the teeth's stumps and the flakes the jaw went to, rising
      ['path', { d: 'M26 40.6 L26.4 44.2 L28.4 44 M29.8 41.8 L30.2 45 L32 45 M33.6 41.6 L34 44.8 L35.8 44.6 M37.2 40.8 L37.6 43.6', stroke: '#8a827a', 'stroke-width': 1, fill: 'none' }],
      ...[[24, 47, 1.4, 20], [29, 49, 1.1, -30], [35, 48, 1.3, 45], [40, 46.4, 1, 10], [31.4, 51, 0.9, 70], [27, 52.4, 0.8, -10], [37.6, 51.6, 0.8, 30]].map(([x, y, r, d], i) =>
        ['path', { d: flake(x, y, r, d), fill: i % 2 ? '#8a827a' : '#c8c0b6', opacity: 0 }, [
          drift(`M0 0 Q${(i % 2 ? 1 : -1) * 4} -14 ${(i % 3 - 1) * 6} -30`, 3.2 + (i % 3) * 0.5, i * 0.45),
          pulse('opacity', '0;0.95;0.6;0', 3.2 + (i % 3) * 0.5, i * 0.45, { keyTimes: '0;0.15;0.7;1' }),
        ]]),
      mote(30, 50, 0.5, '#ffb45a', 34, 2.8, 0.3, -3),
      mote(36, 49, 0.4, '#ffd27a', 30, 3.2, 1.6, 4),
    ],
  }),
  'kill:voidrend': Object.freeze({   // a rift torn down the air, its void turning with far stars, shards of the foe drawn into it
    field: ['#2a1252', '#05020c'],
    bezel: 'silver',
    defs: {
      haze: ['radialGradient', { cx: '50%', cy: '50%', r: '60%' }, [[0, '#8f5bff', 0.55], [0.5, '#3a1680', 0.35], [1, '#05020c', 0]]],
      void: ['radialGradient', { cx: '50%', cy: '50%', r: '55%' }, [[0, '#000000'], [0.55, '#0c0420'], [0.85, '#5a2ab8'], [1, '#e8d6ff']]],
      rift: ['clipPath', {}, [['path', { d: 'M32 6 L35.4 13.6 L33.6 18 L38 24.6 L35.8 30.6 L39.6 37.6 L35.2 44 L36.6 50.6 L32 58 L27.4 50.6 L28.8 44 L24.4 37.6 L28.2 30.6 L26 24.6 L30.4 18 L28.6 13.6 Z' }]]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 1.2 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#haze)' }],
      ...[[12, 16], [50, 14], [10, 44], [54, 46], [20, 56], [46, 8]].map(([x, y], i) => ['path', { d: glintPath(x, y, 1.1), fill: '#e8d6ff' }, [pulse('opacity', '0.2;0.9;0.2', 2.2 + i * 0.3, i * 0.4)]]),
      // the tear's light, the void in it, far stars turning in the void
      ['path', { d: 'M32 6 L35.4 13.6 L33.6 18 L38 24.6 L35.8 30.6 L39.6 37.6 L35.2 44 L36.6 50.6 L32 58 L27.4 50.6 L28.8 44 L24.4 37.6 L28.2 30.6 L26 24.6 L30.4 18 L28.6 13.6 Z',
        fill: '#b593ff', filter: 'url(#glow)' }, [pulse('opacity', '0.6;1;0.6', 1.6)]],
      ['path', { d: 'M32 6 L35.4 13.6 L33.6 18 L38 24.6 L35.8 30.6 L39.6 37.6 L35.2 44 L36.6 50.6 L32 58 L27.4 50.6 L28.8 44 L24.4 37.6 L28.2 30.6 L26 24.6 L30.4 18 L28.6 13.6 Z',
        fill: 'url(#void)', stroke: '#f4eeff', 'stroke-width': 0.7 }],
      ['g', { 'clip-path': 'url(#rift)' }, [
        ['g', {}, [
          ...[[32, 20, 0.7], [35, 28, 0.5], [29, 34, 0.6], [33.4, 40, 0.5], [30.6, 46, 0.6], [34, 24, 0.4], [30, 26, 0.4], [32, 52, 0.5]].map(([x, y, r]) => ['circle', { cx: x, cy: y, r, fill: '#ffffff' }]),
          ['path', { d: 'M32 32 m-5 0 a5 9 0 1 0 10 0 a5 9 0 1 0 -10 0', stroke: '#b593ff', 'stroke-width': 0.6, fill: 'none', 'stroke-dasharray': '3 2', opacity: 0.7 }],
          spin(8, 32, 32),
        ]],
      ]],
      // the foe's shards, drawn in
      drawnIn(12, 22, 16, 8, 2.6, 0), drawnIn(52, 20, -16, 10, 2.8, 0.6), drawnIn(14, 42, 14, -8, 2.4, 1.2),
      drawnIn(50, 44, -14, -10, 2.6, 1.8), drawnIn(20, 12, 10, 16, 3, 0.9), drawnIn(44, 54, -10, -16, 2.8, 2.2),
      ['path', { d: 'M18 24 Q24 26 27 28 M47 22 Q41 25 37.6 27.6 M17 41 Q22 39 26 38 M48 43 Q43 41 38.6 39', stroke: '#d6b8ff', 'stroke-width': 0.6, fill: 'none', 'stroke-dasharray': '1.4 1.6', opacity: 0.6 }],
    ],
  }),
  'kill:pyre': Object.freeze({   // a Daedric sigil burning into the ground, a pillar of crimson fire rising from it, embers storming up
    field: ['#4a0c06', '#060101'],
    bezel: 'obsidian',
    defs: {
      heat: ['radialGradient', { cx: '50%', cy: '80%', r: '75%' }, [[0, '#ff5a1e', 0.75], [0.45, '#7a0e04', 0.55], [1, '#060101', 0]]],
      outer: ['linearGradient', { x1: 0, y1: 1, x2: 0, y2: 0 }, [[0, '#ff6a1a'], [0.45, '#d2200a'], [0.85, '#7a0a04', 0.6], [1, '#7a0a04', 0]]],
      inner: ['linearGradient', { x1: 0, y1: 1, x2: 0, y2: 0 }, [[0, '#fff6c8'], [0.35, '#ffd27a'], [0.7, '#ff8a2a', 0.8], [1, '#ff8a2a', 0]]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 1 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#heat)' }],
      // the sigil: a ring in two, a Daedric star in it, its marks round its rim
      ['g', { transform: 'translate(0 37.6) scale(1 0.3)' }, [
        ['circle', { cx: 32, cy: 50, r: 22, fill: 'none', stroke: '#ff5a1e', 'stroke-width': 2.6, filter: 'url(#glow)' }],
        ['circle', { cx: 32, cy: 50, r: 22, fill: 'none', stroke: '#ffd27a', 'stroke-width': 0.9 }],
        ['circle', { cx: 32, cy: 50, r: 17, fill: 'none', stroke: '#ff8a3a', 'stroke-width': 0.9 }],
        ['path', { d: starPath(32, 50, 16.6, 6.4, 5), fill: 'none', stroke: '#ffb45a', 'stroke-width': 1.1 }],
        ...round(32, 50, 19.6, 19.6, 12, (x, y, d) => ['path', { d: `M${x} ${r2(y - 1.2)} L${x} ${r2(y + 1.2)} M${r2(x - 0.8)} ${y} L${r2(x + 0.8)} ${y}`, stroke: '#ffd27a', 'stroke-width': 0.7, transform: `rotate(${d} ${x} ${y})` }]),
        pulse('opacity', '0.7;1;0.75;1;0.7', 1.6),
      ]],
      // the pillar of fire
      ['path', { d: 'M20 52 C18 44 22 38 21.6 30 C21.4 24 24.4 18 27.6 12 C28.6 18 30.4 20 31.4 14 C32.6 8 34.6 6 36 4 C36 10 38.4 14 40 18 C42.4 24 41.6 30 42.6 36 C43.6 42 45 46 44 52 Z',
        fill: 'url(#outer)' }, [sway('translate', '0 0;0.6 -0.8;-0.4 0.2;0 0', 1.1)]],
      ['path', { d: 'M24.4 52 C23.4 46 26 41 25.8 35 C25.8 29 28 25 30.2 20 C31 25 32.8 26 33.6 21 C34.4 17 35.6 15 36.6 14 C36.6 19 38.2 24 38.8 28 C39.6 34 39.2 40 40 46 C40.2 48.6 39.8 50.4 39.4 52 Z',
        fill: 'url(#inner)' }, [sway('translate', '0 0;-0.5 -0.6;0.4 0.2;0 0', 0.9)]],
      ['ellipse', { cx: 32, cy: 49, rx: 6, ry: 2.4, fill: '#fff6c8', opacity: 0.8, filter: 'url(#glow)' }, [pulse('opacity', '0.6;1;0.6', 0.9)]],
      ...[[26, 46, 0], [33, 44, 0.5], [38, 47, 1], [30, 48, 1.5], [35, 50, 2], [28, 50, 2.5], [40, 49, 0.8]].map(([x, y, b], i) =>
        mote(x, y, 0.5 + (i % 3) * 0.15, i % 2 ? '#ffd27a' : '#ff8a3a', 34 + (i % 4) * 4, 2.4 + (i % 3) * 0.4, b, (i % 2 ? 1 : -1) * (3 + i))),
    ],
  }),
  'kill:tonal': Object.freeze({   // a crystal rung by a Dwemer note, its rings of sound spreading, its shards breaking from it
    field: ['#123e4a', '#020809'],
    bezel: 'brass',
    defs: {
      sea: ['radialGradient', { cx: '50%', cy: '50%', r: '65%' }, [[0, '#3fb8ff', 0.4], [0.6, '#0c3552', 0.3], [1, '#020809', 0]]],
      faceL: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#f2fdff'], [0.5, '#9fe6ff'], [1, '#3a9ad8']]],
      faceR: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#7fd0f8'], [0.6, '#2a7ab8'], [1, '#0c3552']]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 1.2 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#sea)' }],
      // the note's rings, spreading
      ...[0, 0.8, 1.6].map((b) => ['circle', { cx: 32, cy: 32, r: 9, fill: 'none', stroke: '#9fe6ff', 'stroke-width': 1.2, opacity: 0 }, [
        pulse('r', '9;27', 2.4, b), pulse('opacity', '0.9;0', 2.4, b), pulse('stroke-width', '1.6;0.3', 2.4, b),
      ]]),
      ['circle', { cx: 32, cy: 32, r: 15, fill: 'none', stroke: '#9fe6ff', 'stroke-width': 0.6, opacity: 0.35, 'stroke-dasharray': '1 2' }],
      // the crystal, its two lit faces, its cracks
      ['path', { d: 'M32 9 L40 19 L40 41 L32 53 L24 41 L24 19 Z', fill: '#9fe6ff', opacity: 0.5, filter: 'url(#glow)' }, [pulse('opacity', '0.35;0.7;0.35', 1.2)]],
      ['path', { d: 'M32 9 L32 53 L24 41 L24 19 Z', fill: 'url(#faceL)', stroke: '#0c3552', 'stroke-width': 0.6 }],
      ['path', { d: 'M32 9 L40 19 L40 41 L32 53 Z', fill: 'url(#faceR)', stroke: '#0c3552', 'stroke-width': 0.6 }],
      ['path', { d: 'M24 19 L32 23 L40 19 M24 41 L32 37 L40 41 M32 23 L32 37', stroke: '#e8fbff', 'stroke-width': 0.5, fill: 'none', opacity: 0.6 }],
      ['path', { d: 'M32 14 L29.6 21 L33.4 25.6 L30 31.4 L34 36 L31 42 M33.4 25.6 L37.6 27.4 M30 31.4 L26.2 33', stroke: '#ffffff', 'stroke-width': 0.8, fill: 'none', 'stroke-linejoin': 'round' },
        [pulse('opacity', '0.5;1;0.5', 1.2)]],
      ['path', { d: glintPath(27, 15, 2.6), fill: '#ffffff' }, [pulse('opacity', '0;1;0', 2.4)]],
      // shards breaking from it
      ...[[22, 22, -9, -5], [42, 24, 9, -6], [21, 40, -9, 6], [43, 38, 9, 7], [32, 8, 0, -4]].map(([x, y, dx, dy], i) =>
        ['path', { d: `M${x} ${r2(y - 2)} L${r2(x + 1.4)} ${y} L${x} ${r2(y + 2)} L${r2(x - 1.4)} ${y} Z`, fill: '#c8f2ff', stroke: '#ffffff', 'stroke-width': 0.3, opacity: 0 }, [
          drift(`M0 0 L${dx} ${dy}`, 2.4, i * 0.3), pulse('opacity', '0;1;0', 2.4, i * 0.3),
        ]]),
    ],
  }),

  // ═══ PORTAL SKINS: each gate's frame and its heart ═══
  'portal:runic': Object.freeze({   // a ring of standing stone cut with runes that glow, a blue vortex turning in it, mist at its foot
    field: ['#1e3248', '#03060a'],
    bezel: 'iron',
    defs: {
      sky: ['radialGradient', { cx: '50%', cy: '45%', r: '65%' }, [[0, '#3a6a9a', 0.6], [0.6, '#0c1a2a', 0.5], [1, '#03060a', 0]]],
      stone: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#c8ccd2'], [0.4, '#8a909a'], [0.75, '#4a505a'], [1, '#22262c']]],
      swirl: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f2fbff'], [0.2, '#7fd0ff'], [0.6, '#1a5ab8'], [1, '#081a40']]],
      mist: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#cfe6ff', 0.6], [1, '#cfe6ff', 0]]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 0.8 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#sky)' }],
      ['ellipse', { cx: 32, cy: 31, rx: 13.6, ry: 19.4, fill: 'url(#swirl)' }, [pulse('opacity', '0.85;1;0.85', 2.4)]],
      ...[[13.6, 19.4, 3.2, false, 0.8], [9.6, 14, 2.2, true, 0.7], [5.6, 8.6, 1.6, false, 0.6]].map(([rx, ry, d, back, o]) =>
        ['ellipse', { cx: 32, cy: 31, rx, ry, fill: 'none', stroke: '#dff4ff', 'stroke-width': 1, 'stroke-dasharray': '7 4 2 5', opacity: o }, [spin(Number(d), 32, 31, !!back)]]),
      ['ellipse', { cx: 32, cy: 31, rx: 3, ry: 5, fill: '#ffffff', opacity: 0.85, filter: 'url(#glow)' }, [pulse('ry', '4;6;4', 1.6)]],
      // the ring of stone, its runes
      ['path', { d: 'M32 6.4 C44.4 6.4 50.4 18 50.4 31 C50.4 44 44.4 55.6 32 55.6 C19.6 55.6 13.6 44 13.6 31 C13.6 18 19.6 6.4 32 6.4 Z' + ringHole(32, 31, 13.8, 19.6),
        fill: 'url(#stone)', 'fill-rule': 'evenodd', stroke: '#14181c', 'stroke-width': 0.9 }],
      ['path', { d: 'M18 16 C21 10.6 25.6 8.4 32 8.4', stroke: '#eef2f6', 'stroke-width': 1, fill: 'none', opacity: 0.55, 'stroke-linecap': 'round' }],
      ['g', {}, [
        ...round(32, 31, 16.2, 22.2, 10, (x, y, d) => ['path', { d: `M${x} ${r2(y - 1.4)} L${r2(x + 0.9)} ${y} L${x} ${r2(y + 1.4)} M${r2(x - 0.9)} ${r2(y - 0.6)} L${r2(x + 0.4)} ${r2(y - 0.6)}`,
          stroke: '#9fe6ff', 'stroke-width': 0.8, fill: 'none', transform: `rotate(${d} ${x} ${y})`, filter: 'url(#glow)' }]),
        ...round(32, 31, 16.2, 22.2, 10, (x, y, d) => ['path', { d: `M${x} ${r2(y - 1.4)} L${r2(x + 0.9)} ${y} L${x} ${r2(y + 1.4)} M${r2(x - 0.9)} ${r2(y - 0.6)} L${r2(x + 0.4)} ${r2(y - 0.6)}`,
          stroke: '#ffffff', 'stroke-width': 0.4, fill: 'none', transform: `rotate(${d} ${x} ${y})` }]),
        pulse('opacity', '0.5;1;0.5', 2.6),
      ]],
      // the stone's foot in the grass, mist curling
      ['path', { d: 'M8 58 Q20 52 32 54 Q44 52 56 58 L56 64 L8 64 Z', fill: '#0c1410' }],
      ['ellipse', { cx: 22, cy: 55, rx: 10, ry: 3, fill: 'url(#mist)' }, [sway('translate', '0 0;2 0;0 0', 5)]],
      ['ellipse', { cx: 44, cy: 56, rx: 9, ry: 2.6, fill: 'url(#mist)' }, [sway('translate', '0 0;-2 0;0 0', 4.4)]],
    ],
  }),
  'portal:daedric': Object.freeze({   // a black Daedric arch thorned along its back, a crimson rune-band on its face, fire turning in it
    field: ['#3a0806', '#050101'],
    bezel: 'obsidian',
    defs: {
      heat: ['radialGradient', { cx: '50%', cy: '60%', r: '70%' }, [[0, '#a8200c', 0.7], [0.5, '#3a0604', 0.5], [1, '#050101', 0]]],
      maw: ['radialGradient', { cx: '50%', cy: '58%', r: '58%' }, [[0, '#fff2c8'], [0.18, '#ffb45a'], [0.45, '#d2280a'], [0.8, '#4a0602'], [1, '#160100']]],
      obs: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#5a4448'], [0.3, '#24161a'], [0.7, '#0c0608'], [1, '#2a1414']]],
      gate: ['clipPath', {}, [['path', { d: 'M20.4 56 L20.4 28 Q20.4 13 32 12 Q43.6 13 43.6 28 L43.6 56 Z' }]]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 1 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#heat)' }],
      ['path', { d: 'M20.4 56 L20.4 28 Q20.4 13 32 12 Q43.6 13 43.6 28 L43.6 56 Z', fill: 'url(#maw)' }, [pulse('opacity', '0.88;1;0.9;1;0.88', 0.9)]],
      ['g', { 'clip-path': 'url(#gate)' }, [
        ...[[11, 17, 3.2, false, 0.6], [7.4, 12, 2.2, true, 0.7], [4, 7, 1.4, false, 0.6]].map(([rx, ry, d, back, o]) =>
          ['ellipse', { cx: 32, cy: 36, rx, ry, fill: 'none', stroke: '#ffe8a0', 'stroke-width': 1.1, 'stroke-dasharray': '8 4 2 5', opacity: o }, [spin(Number(d), 32, 36, !!back)]]),
        ['path', { d: 'M32 36 L24 12 L29.6 36 Z M32 36 L42 18 L34.4 37 Z M32 36 L24 58 L30.6 40 Z M32 36 L41 58 L33.6 39 Z', fill: '#ffe8a0', opacity: 0.16 }, [spin(6, 32, 36)]],
      ]],
      // the arch of black glass, thorns along its back, the rune-band burning on its face
      ['path', { d: 'M15.4 57 L15.4 28 Q15.4 7.6 32 6.6 Q48.6 7.6 48.6 28 L48.6 57 L43.6 57 L43.6 28 Q43.6 13 32 12 Q20.4 13 20.4 28 L20.4 57 Z', fill: 'url(#obs)', stroke: '#000000', 'stroke-width': 0.8 }],
      ['path', { d: 'M17.9 56 L17.9 28 Q17.9 10.2 32 9.3 Q46.1 10.2 46.1 28 L46.1 56', fill: 'none', stroke: '#ff5a1e', 'stroke-width': 0.9, 'stroke-dasharray': '1.6 1.2 0.6 1.2', filter: 'url(#glow)' },
        [pulse('opacity', '0.5;1;0.6;1;0.5', 2)]],
      ['path', { d: 'M15.4 24 L9.6 20.4 L15.6 30 Z M48.6 24 L54.4 20.4 L48.4 30 Z M18.6 13.4 L13.6 7.6 L21.6 11.2 Z M45.4 13.4 L50.4 7.6 L42.4 11.2 Z M32 6.6 L32 1 L34.4 6.8 Z M15.4 40 L10 39 L15.4 45 Z M48.6 40 L54 39 L48.6 45 Z',
        fill: '#140a0c', stroke: '#d2280a', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M21 12.6 C24 9.4 27.6 8 31 7.8', stroke: '#8a6a70', 'stroke-width': 0.8, fill: 'none', opacity: 0.7 }],
      ['path', { d: 'M10 57 L54 57 L56 64 L8 64 Z', fill: '#100406' }],
      mote(28, 54, 0.6, '#ffb45a', 30, 2.8, 0, -3), mote(36, 52, 0.5, '#ffd27a', 26, 2.4, 0.9, 3), mote(32, 56, 0.6, '#ff8a2a', 34, 3.2, 1.7, 1),
    ],
  }),
  'portal:aetheric': Object.freeze({   // a ring of shifting prismatic light round a violet heart, aetheric crystals turning about it
    field: ['#2a1a52', '#04020c'],
    bezel: 'silver',
    defs: {
      sky: ['radialGradient', { cx: '50%', cy: '48%', r: '65%' }, [[0, '#6a4ac8', 0.6], [0.6, '#1a0e3a', 0.5], [1, '#04020c', 0]]],
      heart: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff'], [0.25, '#e2d0ff'], [0.6, '#8f5bff'], [1, '#2a1268']]],
      prism: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#7fffd4'], [0.2, '#7fb8ff'], [0.4, '#d6b8ff'], [0.6, '#ff9ad6'], [0.8, '#ffe27a'], [1, '#7fffd4']]],
      crystal: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#ffffff'], [0.5, '#c8b4ff'], [1, '#6a4ac8']]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 1.3 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#sky)' }],
      ...[[10, 12], [54, 16], [8, 40], [56, 44], [18, 56], [48, 56]].map(([x, y], i) => ['path', { d: glintPath(x, y, 0.9), fill: '#ffffff' }, [pulse('opacity', '0.2;0.9;0.2', 2 + i * 0.35, i * 0.3)]]),
      ['ellipse', { cx: 32, cy: 32, rx: 13.6, ry: 19.6, fill: 'url(#heart)' }, [pulse('opacity', '0.85;1;0.85', 2)]],
      ['ellipse', { cx: 32, cy: 32, rx: 6, ry: 9, fill: '#ffffff', opacity: 0.6, filter: 'url(#glow)' }, [pulse('rx', '5;7;5', 2), pulse('ry', '8;10.4;8', 2)]],
      ['g', {}, [
        ['ellipse', { cx: 32, cy: 32, rx: 16.4, ry: 22.4, fill: 'none', stroke: 'url(#prism)', 'stroke-width': 3.6, filter: 'url(#glow)', opacity: 0.8 }],
        ['ellipse', { cx: 32, cy: 32, rx: 16.4, ry: 22.4, fill: 'none', stroke: 'url(#prism)', 'stroke-width': 2.2 }],
        spin(12, 32, 32),
      ]],
      ['ellipse', { cx: 32, cy: 32, rx: 16.4, ry: 22.4, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.7 }],
      // the crystals turning about it
      ['g', {}, [
        ...round(32, 32, 23.6, 23.6, 4, (x, y, d) => ['path', { d: `M${x} ${r2(y - 3.4)} L${r2(x + 1.8)} ${y} L${x} ${r2(y + 3.4)} L${r2(x - 1.8)} ${y} Z`, fill: 'url(#crystal)', stroke: '#ffffff', 'stroke-width': 0.4, transform: `rotate(${d} ${x} ${y})` }], -45),
        spin(16, 32, 32, true),
      ]],
    ],
  }),
  'portal:brass': Object.freeze({   // a brass cog-ring gate turning, an aetherium vortex in it, steam venting off its teeth
    field: ['#3a2c12', '#060402'],
    bezel: 'brass',
    defs: {
      forge: ['radialGradient', { cx: '50%', cy: '50%', r: '65%' }, [[0, '#2a7aa8', 0.5], [0.5, '#1a2a2a', 0.4], [1, '#060402', 0]]],
      core: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f2fdff'], [0.25, '#7fe0ff'], [0.65, '#1a6a9a'], [1, '#04121c']]],
      cog: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff0b8'], [0.3, '#e0aa4a'], [0.65, '#9a6414'], [1, '#3a2204']]],
      steam: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f2f7fa', 0.85], [1, '#f2f7fa', 0]]],
      glow: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 1 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#forge)' }],
      ['circle', { cx: 32, cy: 32, r: 16, fill: 'url(#core)' }, [pulse('opacity', '0.85;1;0.85', 2.2)]],
      ...[[13, 3, false, 0.6], [9, 2, true, 0.7], [5, 1.3, false, 0.6]].map(([r, d, back, o]) =>
        ['circle', { cx: 32, cy: 32, r, fill: 'none', stroke: '#dffaff', 'stroke-width': 1, 'stroke-dasharray': '6 3 2 4', opacity: o }, [spin(Number(d), 32, 32, !!back)]]),
      ['circle', { cx: 32, cy: 32, r: 3.2, fill: '#ffffff', opacity: 0.9, filter: 'url(#glow)' }, [pulse('r', '2.6;4;2.6', 1.4)]],
      // the cog-ring, turning
      ['g', {}, [
        ['path', { d: gearPath(32, 32, 27.4, 23.6, 18) + ringHole(32, 32, 17.2, 17.2), fill: 'url(#cog)', 'fill-rule': 'evenodd', stroke: '#2a1804', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
        ['circle', { cx: 32, cy: 32, r: 17.2, fill: 'none', stroke: '#fff0b8', 'stroke-width': 0.6, opacity: 0.8 }],
        ['circle', { cx: 32, cy: 32, r: 21.2, fill: 'none', stroke: '#3a2204', 'stroke-width': 0.6, opacity: 0.8 }],
        ...round(32, 32, 19.2, 19.2, 9, (x, y) => ['circle', { cx: x, cy: y, r: 0.9, fill: '#fff0b8', stroke: '#3a2204', 'stroke-width': 0.4 }]),
        spin(24, 32, 32),
      ]],
      // steam venting off it
      ...[[8, 20, 0], [56, 44, 1.3], [10, 46, 2.1], [54, 18, 0.7]].map(([x, y, b], i) =>
        ['ellipse', { cx: x, cy: y, rx: 4, ry: 3, fill: 'url(#steam)', opacity: 0 }, [drift(`M0 0 Q${i % 2 ? 2 : -2} -4 ${i % 2 ? 3 : -3} -9`, 2.6, b), pulse('opacity', '0;0.85;0', 2.6, b)]]),
    ],
  }),

  // ═══ MOUNT LOOKS: the horse's head in its look ═══
  'mount:warhorse': Object.freeze({   // a black Daedric charger under a spiked chanfron and a plated crinet, its eye a coal, smoke at its nostril
    field: ['#3a0a08', '#050101'],
    bezel: 'obsidian',
    defs: {
      haze: ['radialGradient', { cx: '50%', cy: '62%', r: '70%' }, [[0, '#a8200c', 0.75], [0.5, '#4a0804', 0.5], [1, '#0a0202', 0]]],
      hide: ['linearGradient', { x1: 0.1, y1: 0, x2: 0.9, y2: 1 }, [[0, '#4a383c'], [0.4, '#1e1417'], [1, '#060405']]],
      plate: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#6a5458'], [0.3, '#2e1e22'], [0.7, '#120a0c'], [1, '#2a1210']]],
      horn: ['linearGradient', { x1: 0, y1: 1, x2: 0.4, y2: 0 }, [[0, '#2a1a1e'], [0.7, '#5a2a22'], [1, '#ff6a2a']]],
      ember: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#fff2c8'], [0.3, '#ff7a2a'], [0.7, '#d2200a', 0.6], [1, '#d2200a', 0]]],
      blur: ['filter', { x: '-50%', y: '-50%', width: '200%', height: '200%' }, [['feGaussianBlur', { stdDeviation: 0.9 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#haze)' }],
      ['g', { transform: FRAME }, [
        // the mane: black smoke-hair streaming back, its tips smouldering
        ['path', { d: risingMane(11, 9, 4.4, 0.9), fill: '#0c0708', stroke: '#ff5a1e', 'stroke-width': 0.5 }, [sway('translate', '0 0;0.9 -0.5;0 0', 2.2)]],
        ['path', { d: risingMane(11, 5.6, 2.6, 0.9), fill: '#ff5a1e', opacity: 0.35 }, [sway('translate', '0 0;0.9 -0.5;0 0', 2.2), pulse('opacity', '0.2;0.55;0.3;0.2', 1.6)]],
        ['path', { d: HEAD, fill: 'url(#hide)', stroke: '#000000', 'stroke-width': 0.8 }],
        ...modelled('#a88a90', '#000000'),
        // the crinet: one plated band down the crest, its seams and its edge a forge's red
        ['path', { d: CREST_BAND, fill: 'url(#plate)', stroke: '#000000', 'stroke-width': 0.7 }],
        ['path', { d: 'M46.6 14.6 L44.6 19.4 M51.6 18.4 L48.8 22.6 M55 24 L51.6 27.4 M57.2 30.4 L53.2 32.8 M58.6 37.4 L54.2 38.8 M59.6 44.6 L55 45.2 M60.2 52 L55.4 52.2 M60.6 59 L55.8 59',
          stroke: '#000000', 'stroke-width': 0.8 }],
        ['path', { d: CREST, fill: 'none', stroke: '#d2280a', 'stroke-width': 0.6 }],
        ...[[45.2, 13.6], [50.6, 16.6], [54.6, 22], [57, 28.4], [58.6, 35.6], [59.6, 43], [60.2, 50.6]].map(([x, y]) =>
          ['path', { d: `M${x} ${y} L${x + 2.6} ${y - 2.4} L${x + 1.4} ${y + 1.2} Z`, fill: '#140a0c', stroke: '#d2280a', 'stroke-width': 0.4, 'stroke-linejoin': 'round' }]),
        // the chanfron: a plate down the face from the brow to the nose, a Daedric horn at the brow, its runes burning
        ['path', { d: 'M33.6 13.4 C30 16.4 27.4 20 25.4 23.4 L13.8 38.6 C15.6 39.8 17.2 40.4 18.4 40.2 L28 26.4 C30.6 23.4 33.6 21 36.8 19.4 C36.6 17 35.6 14.8 33.6 13.4 Z', fill: 'url(#plate)', stroke: '#000000', 'stroke-width': 0.7 }],
        ['path', { d: 'M33.6 13.4 C30 16.4 27.4 20 25.4 23.4 L13.8 38.6', fill: 'none', stroke: '#d2280a', 'stroke-width': 0.6 }],
        ['path', { d: 'M30.6 17.8 C29 14.4 26.8 11.4 23.4 9.2 C27.8 10.2 31 12.6 33 15.8 Z', fill: 'url(#horn)', stroke: '#000000', 'stroke-width': 0.5 }],
        ['g', {}, [
          ['path', { d: 'M30.4 20.6 L17 37.6', stroke: '#ff5a1e', 'stroke-width': 0.5, opacity: 0.8 }],
          ...[[27.4, 24.4], [23.6, 29.2], [19.8, 34]].map(([x, y]) => ['path', { d: `M${x} ${r2(y - 1.5)} L${r2(x + 1.3)} ${y} L${x} ${r2(y + 1.5)} L${r2(x - 1.3)} ${y} Z`, fill: '#ff7a2a', stroke: '#fff2c8', 'stroke-width': 0.3 }]),
          pulse('opacity', '0.55;1;0.65;1;0.55', 2.4),
        ]],
        ['path', { d: EAR_IN, fill: '#2a0606' }],
        ...features('#050203', '#ff9a5a'),
        // the eye a coal; smoke breathed at the nostril
        ['circle', { cx: 29.8, cy: 21.4, r: 2.6, fill: 'url(#ember)', filter: 'url(#blur)' }, [pulse('r', '2.2;3;2.2', 1.6)]],
        ['circle', { cx: 29.8, cy: 21.4, r: 0.9, fill: '#fff2c8' }],
        ['circle', { cx: 12.4, cy: 43.6, r: 1.4, fill: '#ff3a12', opacity: 0.6, filter: 'url(#blur)' }, [pulse('opacity', '0.3;0.8;0.3', 1.6)]],
        mote(10.6, 43, 1.6, '#6a5a5c', 12, 3.2, 0, -6),
        mote(11.4, 44, 1.2, '#5a4a4c', 10, 2.8, 1.4, -5),
      ]],
      mote(48, 58, 0.6, '#ff8a3a', 30, 3.4, 0, -4),
      mote(54, 60, 0.5, '#ffb45a', 34, 3.8, 1.2, -6),
      mote(44, 60, 0.5, '#ff6a1a', 28, 3, 2.1, 3),
    ],
  }),
  'mount:spectral': Object.freeze({   // a ghost steed of pale blue light, its mane streaming, its eye a white star
    field: ['#1a3a5a', '#03070d'],
    bezel: 'silver',
    defs: {
      night: ['radialGradient', { cx: '50%', cy: '45%', r: '70%' }, [[0, '#2a5a8a', 0.8], [0.6, '#0c1e34', 0.6], [1, '#03070d', 0]]],
      ghost: ['linearGradient', { x1: 0, y1: 0, x2: 0.5, y2: 1 }, [[0, '#f2fbff', 0.95], [0.35, '#b8e4ff', 0.8], [0.7, '#5a9ae0', 0.4], [1, '#5a9ae0', 0]]],
      wisp: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0.4 }, [[0, '#ffffff', 0.9], [0.6, '#9fd8ff', 0.5], [1, '#9fd8ff', 0]]],
      edge: ['linearGradient', { x1: 0, y1: 0, x2: 0.4, y2: 1 }, [[0, '#ffffff', 0.95], [0.6, '#cfeeff', 0.5], [1, '#cfeeff', 0]]],
      soft: ['filter', { x: '-40%', y: '-40%', width: '180%', height: '180%' }, [['feGaussianBlur', { stdDeviation: 1.4 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#night)' }],
      ...[[8, 14, 0.6], [16, 8, 0.4], [55, 12, 0.5], [6, 30, 0.4], [20, 58, 0.5], [12, 50, 0.4], [50, 6, 0.4]].map(([x, y, r]) =>
        ['circle', { cx: x, cy: y, r, fill: '#dff4ff', opacity: 0.7 }, [pulse('opacity', '0.25;0.9;0.25', 2.6 + x / 20, y / 30)]]),
      ['g', { transform: FRAME }, [
        // its glow behind it, and the mane streaming back as light
        ['path', { d: HEAD, fill: '#7fc8ff', opacity: 0.35, filter: 'url(#soft)' }, [pulse('opacity', '0.25;0.45;0.25', 3)]],
        ['path', { d: risingMane(11, 13, 4, 1.3, 0.8), fill: 'url(#wisp)', opacity: 0.8 }, [sway('translate', '0 0;1.6 -0.6;0 0', 3.4)]],
        ['path', { d: risingMane(9, 17, 2.4, 1.5, 0.8), fill: 'url(#wisp)', opacity: 0.45 }, [sway('translate', '0 0;2.4 -0.8;0 0', 2.6, 0.6)]],
        ['path', { d: HEAD, fill: 'url(#ghost)', stroke: 'url(#edge)', 'stroke-width': 0.8 }],
        ...modelled('#ffffff', '#1a4a8a', 0.9),
        ['path', { d: FORELOCK, fill: 'url(#wisp)', opacity: 0.9 }, [sway('rotate', '0 36 13;-4 36 13;0 36 13', 3)]],
        ['path', { d: EAR_IN, fill: '#4a8ad8', opacity: 0.5 }],
        ...features('#1a3a6a', '#ffffff'),
        // the eye a white star
        ['circle', { cx: 29.8, cy: 21.3, r: 3.2, fill: '#ffffff', opacity: 0.35, filter: 'url(#soft)' }],
        ['path', { d: starPath(29.8, 21.3, 3, 0.6, 4), fill: '#ffffff' }, [pulse('opacity', '0.7;1;0.7', 1.8), spin(9, 29.8, 21.3)]],
        ['ellipse', { cx: 11.6, cy: 43.4, rx: 2, ry: 1.4, fill: '#ffffff', opacity: 0, filter: 'url(#soft)' }, [drift('M0 0 Q-2 -2 -5 -4', 3), pulse('opacity', '0;0.7;0', 3)]],
      ]],
      mote(36, 60, 0.7, '#dff4ff', 40, 4.4, 0, 6),
      mote(46, 62, 0.6, '#ffffff', 44, 5, 1.4, 8),
      mote(41, 58, 0.5, '#bfe6ff', 36, 4, 2.6, -4),
      mote(52, 60, 0.6, '#dff4ff', 38, 4.6, 3.3, 5),
    ],
  }),
  'mount:dawnfire': Object.freeze({   // a radiant gold charger before the rising sun, bridled in red, its mane and forelock morning fire
    field: ['#6a3a10', '#0e0603'],
    bezel: 'gold',
    defs: {
      dawn: ['radialGradient', { cx: '72%', cy: '30%', r: '75%' }, [[0, '#fff2a8'], [0.18, '#ffc24a'], [0.45, '#d2601a'], [0.8, '#4a1408', 0.8], [1, '#140603', 0]]],
      coat: ['linearGradient', { x1: 0, y1: 0, x2: 0.8, y2: 1 }, [[0, '#fff2c0'], [0.3, '#f2c25a'], [0.7, '#c2801e'], [1, '#6a3a08']]],
      fire: ['linearGradient', { x1: 0, y1: 1, x2: 1, y2: 0 }, [[0, '#d2280a'], [0.35, '#ff7a1a'], [0.7, '#ffc24a'], [1, '#fff6c8']]],
      rays: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#fff6c8', 0.8], [1, '#fff6c8', 0]]],
      leather: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#c23a1e'], [1, '#6a1408']]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#dawn)' }],
      ['g', {}, [['path', { d: starPath(48, 18, 34, 12, 14), fill: 'url(#rays)', opacity: 0.6 }], spin(40, 48, 18)]],
      ['circle', { cx: 48, cy: 18, r: 8.6, fill: '#fff6c8', opacity: 0.95 }, [pulse('r', '8.2;9.2;8.2', 4)]],
      ['g', { transform: FRAME }, [
        // the mane and forelock a sheet of fire, flickering
        ['path', { d: risingMane(12, 10, 4.6, 0.6), fill: 'url(#fire)' }, [sway('translate', '0 0;0.6 -0.9;0 0;0.4 0.6;0 0', 1.2)]],
        ['path', { d: risingMane(12, 6, 2.4, 0.6), fill: '#fff2a8', opacity: 0.6 }, [pulse('opacity', '0.35;0.8;0.4;0.75;0.35', 0.9)]],
        ['path', { d: HEAD, fill: 'url(#coat)', stroke: '#4a2604', 'stroke-width': 0.8 }],
        ...modelled('#fff8d8', '#6a3a08'),
        // the bridle: the noseband round the nose, the cheekpiece from the bit to the crown, the browband, the throatlatch
        ['path', { d: 'M14.6 39.6 C17 41.4 19.6 43.6 21.8 46.4', stroke: 'url(#leather)', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }],
        ['path', { d: 'M17.6 49.8 C22 42 28.4 33 33.4 25.4 C35.6 21.6 37.4 17.4 38.4 13.4', stroke: 'url(#leather)', 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' }],
        ['path', { d: 'M32.6 15.8 C34.6 15.4 36.6 14.6 38.4 13.4', stroke: 'url(#leather)', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' }],
        ['path', { d: 'M38.6 13.6 C40.6 19.6 41.4 25.6 41 31.6', stroke: 'url(#leather)', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.85 }],
        ['circle', { cx: 17.6, cy: 49.8, r: 1.6, fill: 'none', stroke: '#ffd27a', 'stroke-width': 0.8 }],
        ...[[18.3, 42.4], [26.4, 35.4], [33.4, 25.4], [35.6, 15]].map(([x, y]) => ['circle', { cx: x, cy: y, r: 0.9, fill: '#ffd27a', stroke: '#6a3a08', 'stroke-width': 0.4 }]),
        ['path', { d: FORELOCK, fill: 'url(#fire)' }, [sway('rotate', '0 36 13;-5 36 13;2 36 13;0 36 13', 1.1)]],
        ['path', { d: EAR_IN, fill: '#a8601a' }],
        ...features('#2a1402', '#fff6c8'),
      ]],
      mote(52, 40, 0.6, '#fff2a8', 26, 2.6, 0, 3),
      mote(56, 30, 0.5, '#ffd27a', 22, 2.2, 0.9, 4),
      mote(50, 50, 0.6, '#ffb42e', 30, 3, 1.6, 2),
    ],
  }),
  'mount:automaton': Object.freeze({   // a Dwemer horse of brass plates and rivets, a turning gear at its jaw, an aetherium eye, steam at its nostril
    field: ['#2a3a3a', '#060908'],
    bezel: 'brass',
    defs: {
      forge: ['radialGradient', { cx: '50%', cy: '40%', r: '70%' }, [[0, '#3a6a6a', 0.6], [0.6, '#122222', 0.5], [1, '#060908', 0]]],
      plateB: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff0b8'], [0.25, '#e8b84a'], [0.6, '#b8801e'], [1, '#5a3608']]],
      plateD: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#e0a84a'], [0.5, '#9a6414'], [1, '#3a2204']]],
      copper: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#ffb07a'], [0.5, '#c2602a'], [1, '#5a2408']]],
      lens: ['radialGradient', { cx: '40%', cy: '40%', r: '60%' }, [[0, '#ffffff'], [0.3, '#9ff9fc'], [0.7, '#2a9ad8'], [1, '#0c3552']]],
      steam: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f2f7fa', 0.85], [1, '#f2f7fa', 0]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#forge)' }],
      ['g', { transform: FRAME }, [
        // the mane a crest of copper fins, each riveted to the crest's band
        ...MANE_ROOTS.map(([x, y], i) => ['path', { d: `M${x - 1.2} ${y + 0.6} L${x + 5.4} ${y - 1.2 + i * 0.6} L${x + 4} ${y + 3.8} Z`, fill: 'url(#copper)', stroke: '#3a1a04', 'stroke-width': 0.5, 'stroke-linejoin': 'round' }]),
        ['path', { d: HEAD, fill: 'url(#plateB)', stroke: '#2a1804', 'stroke-width': 0.9 }],
        ...modelled('#fff6d0', '#3a2204', 0.8),
        ['path', { d: CREST_BAND, fill: 'url(#plateD)', stroke: '#2a1804', 'stroke-width': 0.7 }],
        // the plates' seams: the brow plate, the muzzle's, the neck's rings
        ['path', { d: 'M24.8 23.2 C28.4 25.4 31.6 28.6 33.4 32.6 M14.6 37.6 C17.6 39 20.6 41.8 22.4 45 M40.6 33.6 C44.6 31.6 49 31.2 53.4 31.6 M39.8 43.6 C44.6 41.8 49.4 41.6 54.4 42.6 M38.6 53.6 C44 52.2 49.6 52.2 55.4 53.2',
          stroke: '#3a2204', 'stroke-width': 0.9, fill: 'none' }],
        ['path', { d: 'M24.8 23.6 C28.4 25.8 31.6 29 33.4 33 M40.6 34 C44.6 32 49 31.6 53.4 32 M39.8 44 C44.6 42.2 49.4 42 54.4 43', stroke: '#fff0b8', 'stroke-width': 0.4, fill: 'none', opacity: 0.6 }],
        // the jaw's hinge: a brass boss, a gear turning in it
        ['circle', { cx: 34.4, cy: 34.4, r: 5.4, fill: 'url(#plateD)', stroke: '#2a1804', 'stroke-width': 0.8 }],
        ['g', {}, [
          ['path', { d: gearPath(34.4, 34.4, 4.6, 3.6, 10), fill: '#c9963a', stroke: '#2a1804', 'stroke-width': 0.5 }],
          ['circle', { cx: 34.4, cy: 34.4, r: 1.4, fill: '#2a1804' }],
          spin(6, 34.4, 34.4),
        ]],
        ...[[26.6, 24.2], [30.4, 27.6], [16.6, 38.6], [20.4, 41.8], [44, 32.4], [50, 31.6], [43, 42.8], [50, 42.2], [44, 53], [51, 52.8], [46, 17.4], [51.6, 22], [54.8, 28.4], [56.4, 36], [57.4, 44], [58, 52]].map(([x, y]) =>
          ['circle', { cx: x, cy: y, r: 0.8, fill: '#fff0b8', stroke: '#3a2204', 'stroke-width': 0.4 }]),
        ['path', { d: EAR_IN, fill: '#5a3608', stroke: '#2a1804', 'stroke-width': 0.4 }],
        ['path', { d: NOSTRIL, fill: '#2a1804' }],
        ['path', { d: MOUTH, stroke: '#2a1804', 'stroke-width': 0.8, fill: 'none' }],
        // the eye an aetherium lens in a brass ring
        ['circle', { cx: 29.8, cy: 21.4, r: 3.6, fill: '#3fb8ff', opacity: 0.3 }, [pulse('r', '3.2;4.4;3.2', 2.2)]],
        ['circle', { cx: 29.8, cy: 21.4, r: 2.5, fill: '#5a3608', stroke: '#fff0b8', 'stroke-width': 0.5 }],
        ['circle', { cx: 29.8, cy: 21.4, r: 1.7, fill: 'url(#lens)' }, [pulse('opacity', '0.8;1;0.8', 2.2)]],
        ['circle', { cx: 29.2, cy: 20.8, r: 0.5, fill: '#ffffff' }],
        // steam at the nostril
        ['ellipse', { cx: 9, cy: 42, rx: 3, ry: 2.2, fill: 'url(#steam)', opacity: 0 }, [drift('M0 0 Q-3 -3 -6 -8', 2.6), pulse('opacity', '0;0.9;0', 2.6)]],
        ['ellipse', { cx: 10, cy: 43, rx: 2.4, ry: 1.8, fill: 'url(#steam)', opacity: 0 }, [drift('M0 0 Q-4 -2 -8 -5', 2.6, 1.3), pulse('opacity', '0;0.8;0', 2.6, 1.3)]],
      ]],
    ],
  }),
});
