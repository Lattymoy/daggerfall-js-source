// @ts-check
// AURUM (2026-10-29, the owner: "For profile icons no figures should be used. Ensure some are fully animated and go
// beyond with detail"; bible/06-Systems/Aurum.md section 5): THE DAILY WARES' PROFILE ICONS - places, relics and the
// heavens, never a figure. Six move (the gate's fire, the Aurbis, the Elder Scroll, Azura's Star, Red Mountain, the
// hourglass); the rose and the tower are still. Drawn in code as every icon is (ui/profileIcons.js ICON_ART).
import { starPath, glintPath, spin, pulse, drift, sway, mote } from './iconKit.js';

const r2 = (/** @type {number} */ n) => Math.round(n * 100) / 100;
/** A ring of `n` points about (cx, cy) at `r`, from angle `a0` - each answered `[x, y, i]`. */
const ring = (/** @type {number} */ n, /** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ r, a0 = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => [r2(cx + Math.cos(a0 + (i * Math.PI * 2) / n) * r), r2(cy + Math.sin(a0 + (i * Math.PI * 2) / n) * r), i]);
/** A sky's stars, each `[x, y, r]`, the odd ones twinkling. */
const stars = (/** @type {number[][]} */ list, fill = '#ffffff') => list.map(([x, y, r], i) => ['circle', { cx: x, cy: y, r, fill }, i % 2 ? [pulse('opacity', '1;0.25;1', 2 + (i % 5) * 0.7, (i % 3) * 0.5)] : []]);

// THE GATE OF FLAME: an Oblivion gate's two spires, the fire turning between them
const GATE = 'M18.4 62 L18.6 42 C19.6 26 24.6 13 30.6 5 L33.4 5 C39.4 13 44.4 26 45.4 42 L45.6 62 Z';
const SPIRE_L = 'M3 62 C6 40 13.6 19 30.6 5 C24.6 13 19.6 26 18.6 42 L19 62 Z';
const SPIRE_R = 'M61 62 C58 40 50.4 19 33.4 5 C39.4 13 44.4 26 45.4 42 L45 62 Z';
const SPIKES = 'M8.2 48 L1 43.4 L9 44 Z M10.6 35.6 L3.6 29.4 L11.8 31.6 Z M15 24.4 L9.4 16.6 L16.8 20.4 Z M20.6 15 L17.4 7.8 L22.6 12.2 Z M25.6 9.4 L24.6 3.6 L27.4 7.4 Z';
const mirror = (/** @type {string} */ d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${r2(64 - Number(x))} ${y}`);

// THE HOURGLASS: two bulbs meeting at its neck (32, 32), its sand falling, then the glass turned over
const BULB_T = 'M20.4 13 L43.6 13 C43.6 22 35.4 27.4 33 31.2 L31 31.2 C28.6 27.4 20.4 22 20.4 13 Z';
const BULB_B = 'M20.4 51 L43.6 51 C43.6 42 35.4 36.6 33 32.8 L31 32.8 C28.6 36.6 20.4 42 20.4 51 Z';
const FLIP = { keyTimes: '0;0.86;1', calcMode: 'spline', keySplines: '0 0 1 1;0.5 0 0.5 1' };

export const DAILY_ICON_ART = Object.freeze({
  gatefire: Object.freeze({   // Dagon's Breach between black spires, the fire turning in its arch, embers rising off it
    field: ['#3a0a06', '#060102'],
    bezel: 'obsidian',
    defs: {
      fire: ['radialGradient', { cx: '50%', cy: '62%', r: '62%' }, [[0, '#fff6c8'], [0.18, '#ffd27a'], [0.42, '#ff8a2a'], [0.72, '#c2280e'], [1, '#3a0604']]],
      spireL: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#060203'], [0.55, '#1c0c0e'], [0.85, '#4a1610'], [1, '#a8320e']]],
      spireR: ['linearGradient', { x1: 1, y1: 0, x2: 0, y2: 0 }, [[0, '#060203'], [0.55, '#1c0c0e'], [0.85, '#4a1610'], [1, '#a8320e']]],
      sky: ['radialGradient', { cx: '50%', cy: '80%', r: '85%' }, [[0, '#d8501a', 0.9], [0.4, '#7a1a0c', 0.7], [1, '#140304', 0]]],
      portal: ['clipPath', {}, [['path', { d: GATE }]]],
      soft: ['filter', { x: '-30%', y: '-30%', width: '160%', height: '160%' }, [['feGaussianBlur', { stdDeviation: 1.2 }]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#sky)' }],
      ...stars([[8, 12, 0.5], [55, 10, 0.6], [50, 20, 0.4], [14, 22, 0.4], [58, 28, 0.5]], '#ffb48a'),
      ['path', { d: 'M0 50 L5 44 L9 47 L14 40 L18 45 L22 41 L26 46 L32 42 L38 46 L42 40 L47 45 L51 39 L56 46 L60 42 L64 47 L64 64 L0 64 Z', fill: '#2a0806', opacity: 0.85 }],
      ['path', { d: GATE, fill: 'url(#fire)' }, [pulse('opacity', '0.88;1;0.92;1;0.88', 0.9)]],
      ['g', { 'clip-path': 'url(#portal)' }, [
        ['ellipse', { cx: 32, cy: 40, rx: 14, ry: 20, fill: 'none', stroke: '#ffd27a', 'stroke-width': 1.4, 'stroke-dasharray': '9 5 3 6', opacity: 0.55, filter: 'url(#soft)' }, [spin(3.6, 32, 40)]],
        ['ellipse', { cx: 32, cy: 40, rx: 9.6, ry: 14, fill: 'none', stroke: '#fff2b0', 'stroke-width': 1.1, 'stroke-dasharray': '7 4 2 5', opacity: 0.6 }, [spin(2.4, 32, 40, true)]],
        ['ellipse', { cx: 32, cy: 40, rx: 5.6, ry: 8.6, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.9, 'stroke-dasharray': '5 3', opacity: 0.55 }, [spin(1.6, 32, 40)]],
        ['path', { d: 'M32 40 L22 14 L28 40 Z M32 40 L44 22 L35 41 Z M32 40 L24 62 L31 44 Z M32 40 L42 60 L34 43 Z', fill: '#ffe8a0', opacity: 0.18 }, [spin(6, 32, 40)]],
        ['ellipse', { cx: 32, cy: 41, rx: 3.6, ry: 7, fill: '#fffbe6', opacity: 0.85, filter: 'url(#soft)' }, [pulse('ry', '6;8.4;6', 1.3), pulse('opacity', '0.7;1;0.7', 1.3)]],
      ]],
      ['path', { d: SPIKES, fill: '#1a0a0c', stroke: '#000000', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: mirror(SPIKES), fill: '#1a0a0c', stroke: '#000000', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: SPIRE_L, fill: 'url(#spireL)', stroke: '#000000', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
      ['path', { d: SPIRE_R, fill: 'url(#spireR)', stroke: '#000000', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M30.6 5 C24.6 13 19.6 26 18.6 42 L19 62', fill: 'none', stroke: '#ff7a2a', 'stroke-width': 1.2, opacity: 0.9 }, [pulse('opacity', '0.6;1;0.75;1;0.6', 0.9)]],
      ['path', { d: 'M33.4 5 C39.4 13 44.4 26 45.4 42 L45 62', fill: 'none', stroke: '#ff7a2a', 'stroke-width': 1.2, opacity: 0.9 }, [pulse('opacity', '0.75;1;0.6;1;0.75', 0.9)]],
      ['path', { d: 'M6.6 54 C9 37 15.4 21 28.4 8.4 M14 50 C15.4 40 18 31 22.6 22.4', fill: 'none', stroke: '#6a3a40', 'stroke-width': 0.6, opacity: 0.55 }],
      ['path', { d: 'M57.4 54 C55 37 48.6 21 35.6 8.4 M50 50 C48.6 40 46 31 41.4 22.4', fill: 'none', stroke: '#4a2a30', 'stroke-width': 0.6, opacity: 0.45 }],
      ['circle', { cx: 32, cy: 5.4, r: 1.6, fill: '#ffd27a' }, [pulse('r', '1.2;2;1.2', 1.3)]],
      ['path', { d: 'M0 57 Q10 54 19 56.4 L45 56.4 Q54 54 64 57 L64 64 L0 64 Z', fill: '#100405' }],
      ['path', { d: 'M4 60.4 L11 59.2 L15.6 61 L21.6 59.6 M43 59.6 L48.4 61.2 L53 59.4 L60 60.6', fill: 'none', stroke: '#ff6a1a', 'stroke-width': 0.8, opacity: 0.8 }, [pulse('opacity', '0.4;0.95;0.4', 2.2)]],
      mote(28, 52, 0.7, '#ffb45a', 34, 3, 0, -3),
      mote(35, 50, 0.6, '#ffd27a', 30, 2.6, 0.7, 4),
      mote(31, 54, 0.5, '#ff8a2a', 38, 3.4, 1.5, 1),
      mote(38, 53, 0.7, '#ffb45a', 32, 3.1, 2.2, -2),
      mote(26, 49, 0.5, '#ffe8a0', 28, 2.4, 1.1, 5),
    ],
  }),

  aurbis: Object.freeze({   // the Aurbis: the wheel of the heavens about Aetherius's light, its spheres in their orbits
    field: ['#1c1a48', '#020109'],
    bezel: 'gold',
    defs: {
      sun: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff'], [0.35, '#fff4c8'], [0.7, '#f2c25a'], [1, '#c2801e']]],
      corona: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#fff4c8', 0.9], [0.35, '#f2c25a', 0.4], [1, '#f2c25a', 0]]],
      nebula: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#8a4ac8', 0.55], [1, '#8a4ac8', 0]]],
      nebula2: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#2a7ac8', 0.5], [1, '#2a7ac8', 0]]],
      nirn: ['radialGradient', { cx: '35%', cy: '35%', r: '65%' }, [[0, '#c8ffe0'], [0.45, '#3aa86a'], [1, '#0c3a6a']]],
      masser: ['radialGradient', { cx: '35%', cy: '35%', r: '65%' }, [[0, '#ffb48a'], [0.5, '#c24a20'], [1, '#4a1408']]],
      secunda: ['radialGradient', { cx: '35%', cy: '35%', r: '65%' }, [[0, '#ffffff'], [0.5, '#c8d0e0'], [1, '#5a6478']]],
    },
    shapes: [
      ['ellipse', { cx: 16, cy: 20, rx: 18, ry: 11, fill: 'url(#nebula)', opacity: 0.8 }, [pulse('opacity', '0.6;0.9;0.6', 9)]],
      ['ellipse', { cx: 48, cy: 46, rx: 20, ry: 12, fill: 'url(#nebula2)', opacity: 0.7 }, [pulse('opacity', '0.8;0.5;0.8', 11)]],
      ...stars([[9, 30, 0.5], [14, 46, 0.4], [20, 9, 0.6], [44, 8, 0.4], [55, 18, 0.6], [58, 38, 0.4], [50, 56, 0.5], [24, 55, 0.4], [6, 40, 0.3], [38, 58, 0.3], [30, 6, 0.4], [60, 28, 0.3]]),
      ['g', { opacity: 0.4 }, [
        ['circle', { cx: 32, cy: 32, r: 27, fill: 'none', stroke: '#f2cf6a', 'stroke-width': 0.6, 'stroke-dasharray': '0.6 1.6' }],
        ...ring(8, 32, 32, 27).map(([x, y]) => ['path', { d: `M32 32 L${x} ${y}`, stroke: '#f2cf6a', 'stroke-width': 0.35, opacity: 0.6 }]),
        ...ring(8, 32, 32, 27).map(([x, y]) => ['circle', { cx: x, cy: y, r: 1, fill: '#fff4c8' }]),
        spin(120, 32, 32),
      ]],
      ['g', { transform: 'rotate(-18 32 32)' }, [
        ['ellipse', { cx: 32, cy: 32, rx: 24, ry: 9, fill: 'none', stroke: '#f2cf6a', 'stroke-width': 0.5, opacity: 0.55 }],
        ['ellipse', { cx: 32, cy: 32, rx: 17.4, ry: 6.4, fill: 'none', stroke: '#f2cf6a', 'stroke-width': 0.5, opacity: 0.6 }],
        ['ellipse', { cx: 32, cy: 32, rx: 11.6, ry: 4.2, fill: 'none', stroke: '#fff4c8', 'stroke-width': 0.5, opacity: 0.6 }],
        ['circle', { cx: 0, cy: 0, r: 2.4, fill: 'url(#nirn)' }, [drift('M56 32 A24 9 0 1 1 8 32 A24 9 0 1 1 56 32', 16)]],
        ['circle', { cx: 0, cy: 0, r: 1.8, fill: 'url(#masser)' }, [drift('M14.6 32 A17.4 6.4 0 1 1 49.4 32 A17.4 6.4 0 1 1 14.6 32', 10)]],
        ['circle', { cx: 0, cy: 0, r: 1.3, fill: 'url(#secunda)' }, [drift('M43.6 32 A11.6 4.2 0 1 1 20.4 32 A11.6 4.2 0 1 1 43.6 32', 6)]],
      ]],
      ['circle', { cx: 32, cy: 32, r: 13, fill: 'url(#corona)' }, [pulse('r', '12;14.4;12', 5)]],
      ['path', { d: starPath(32, 32, 11.6, 6.6, 12), fill: '#fff4c8', opacity: 0.35 }, [spin(30, 32, 32)]],
      ['path', { d: starPath(32, 32, 9.4, 6, 8, 0), fill: '#ffffff', opacity: 0.3 }, [spin(22, 32, 32, true)]],
      ['circle', { cx: 32, cy: 32, r: 5.6, fill: 'url(#sun)' }],
      ['circle', { cx: 30.4, cy: 30.4, r: 1.6, fill: '#ffffff', opacity: 0.85 }],
      ['path', { d: glintPath(44, 14, 2.2), fill: '#ffffff', opacity: 0 }, [pulse('opacity', '0;1;0', 4, 1, { keyTimes: '0;0.2;0.5' })]],
    ],
  }),

  elderscroll: Object.freeze({   // an Elder Scroll unrolled between its gilded rollers, its script lit line by line, light behind it
    field: ['#241a50', '#05030e'],
    bezel: 'gold',
    defs: {
      parchment: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#b89a5a'], [0.12, '#f2e2b0'], [0.5, '#fff6d8'], [0.88, '#f2e2b0'], [1, '#b89a5a']]],
      roller: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#fff6d0'], [0.3, '#f2cf6a'], [0.65, '#a8771e'], [1, '#4a300a']]],
      rays: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#fff4c8', 0.55], [1, '#fff4c8', 0]]],
      sigil: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff'], [0.4, '#9ff9fc'], [1, '#3a8ad0', 0]]],
    },
    shapes: [
      ['g', { opacity: 0.55 }, [
        ...ring(12, 32, 32, 34).map(([x, y, i]) => ['path', { d: `M32 32 L${x} ${y} L${r2(32 + Math.cos(-Math.PI / 2 + ((i + 0.35) * Math.PI) / 6) * 34)} ${r2(32 + Math.sin(-Math.PI / 2 + ((i + 0.35) * Math.PI) / 6) * 34)} Z`, fill: 'url(#rays)' }]),
        spin(40, 32, 32),
      ]],
      ...stars([[10, 12, 0.5], [54, 14, 0.4], [8, 50, 0.4], [57, 50, 0.5], [48, 6, 0.3]], '#fff4c8'),
      ['path', { d: 'M16 15.6 L48 15.6 L48 48.4 L16 48.4 Z', fill: 'url(#parchment)', stroke: '#5a4220', 'stroke-width': 0.6 }],
      ['path', { d: 'M16 15.6 Q32 18 48 15.6 L48 18 Q32 20.4 16 18 Z M16 48.4 Q32 46 48 48.4 L48 46 Q32 43.6 16 46 Z', fill: '#8a6a34', opacity: 0.35 }],
      ['circle', { cx: 32, cy: 32, r: 6.8, fill: 'url(#sigil)', opacity: 0.6 }, [pulse('opacity', '0.4;0.85;0.4', 3)]],
      ['circle', { cx: 32, cy: 32, r: 5.2, fill: 'none', stroke: '#2a6aa8', 'stroke-width': 0.7 }],
      ['path', { d: starPath(32, 32, 4.6, 1.6, 6), fill: 'none', stroke: '#1a4a80', 'stroke-width': 0.6 }, [spin(12, 32, 32)]],
      ['circle', { cx: 32, cy: 32, r: 1.2, fill: '#ffffff' }],
      ...[[20, 21.6, 24], [36.6, 21.6, 44], [20, 25.2, 26], [38.4, 25.2, 44], [20, 38.6, 27.6], [37, 38.6, 44], [20, 42.2, 29], [35, 42.2, 44]].map(([x0, y, x1], i) => ['path', {
        d: `M${x0} ${y} ${Array.from({ length: Math.floor((x1 - x0) / 1.6) }, (_, k) => `l1 ${k % 3 === 0 ? -1.2 : k % 3 === 1 ? 1.2 : 0} l0.6 0`).join(' ')}`,
        fill: 'none', stroke: '#3a6aa8', 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: 0.55,
      }, [pulse('stroke', '#3a6aa8;#9ff9fc;#3a6aa8', 3.2, i * 0.4), pulse('opacity', '0.5;1;0.5', 3.2, i * 0.4)]]),
      ['rect', { x: 11.6, y: 11.4, width: 40.8, height: 5.4, rx: 2.7, fill: 'url(#roller)', stroke: '#2a1a04', 'stroke-width': 0.7 }],
      ['rect', { x: 11.6, y: 47.2, width: 40.8, height: 5.4, rx: 2.7, fill: 'url(#roller)', stroke: '#2a1a04', 'stroke-width': 0.7 }],
      ...[[11.6, 14.1], [52.4, 14.1], [11.6, 49.9], [52.4, 49.9]].flatMap(([x, y]) => [
        ['circle', { cx: x, cy: y, r: 3.6, fill: 'url(#goldRim)', stroke: '#2a1a04', 'stroke-width': 0.7 }],
        ['circle', { cx: x, cy: y, r: 1.6, fill: '#3a8ad0', stroke: '#1a0e02', 'stroke-width': 0.4 }],
        ['circle', { cx: x - 0.5, cy: y - 0.5, r: 0.5, fill: '#ffffff' }],
      ]),
      ['path', { d: 'M15.4 13 L48.6 13 M15.4 48.8 L48.6 48.8', stroke: '#fffbe6', 'stroke-width': 0.6, opacity: 0.7 }],
      ['ellipse', { cx: 14, cy: 13.4, rx: 2.4, ry: 0.8, fill: '#ffffff', opacity: 0.8 }, [drift('M0 0 L36 0', 3.6), pulse('opacity', '0;0.9;0', 3.6)]],
      mote(28, 30, 0.6, '#fff4c8', 18, 3, 0, -2),
      mote(36, 34, 0.5, '#9ff9fc', 20, 3.4, 1.2, 2),
      mote(32, 40, 0.6, '#fff4c8', 22, 3.8, 2.3, 0),
    ],
  }),

  azurastar: Object.freeze({   // Azura's Star, a soul gem of eight points turning slowly in the dusk, its heart of light pulsing
    field: ['#2a1a5a', '#06040e'],
    bezel: 'silver',
    defs: {
      dusk: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#0c0a2a'], [0.45, '#2a1a5a'], [0.78, '#7a3a7a'], [1, '#d8705a']]],
      core: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff'], [0.3, '#e0f4ff'], [0.65, '#9a7aff'], [1, '#5a3ac8', 0]]],
      halo: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#c8b8ff', 0.6], [0.5, '#8a6aff', 0.2], [1, '#8a6aff', 0]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#dusk)' }],
      ...stars([[8, 12, 0.5], [16, 6, 0.4], [50, 8, 0.5], [57, 20, 0.4], [44, 15, 0.3], [6, 26, 0.4], [22, 14, 0.3], [58, 34, 0.3]]),
      ['path', { d: 'M15.6 9.2 A5.4 5.4 0 1 0 21.4 17.4 A4.4 4.4 0 1 1 15.6 9.2 Z', fill: '#e6ecf8', stroke: '#8a94b8', 'stroke-width': 0.4 }],
      ['path', { d: 'M0 56 Q10 50 20 54 Q30 49 42 53 Q54 49 64 54 L64 64 L0 64 Z', fill: '#1a1030', opacity: 0.9 }],
      ['circle', { cx: 32, cy: 34, r: 22, fill: 'url(#halo)' }, [pulse('r', '19;23;19', 4)]],
      ['g', {}, [
        ...ring(16, 32, 34, 1).map(([, , i]) => {
          const a = (k) => -Math.PI / 2 + (k * Math.PI) / 8, R = (k) => (k % 2 ? 7.2 : 18);
          const p = (k) => `${r2(32 + Math.cos(a(k)) * R(k))} ${r2(34 + Math.sin(a(k)) * R(k))}`;
          return ['path', { d: `M32 34 L${p(i)} L${p(i + 1)} Z`, fill: ['#e8e0ff', '#7a5ad8', '#b8a6ff', '#4a2ea8'][i % 4], stroke: '#1a0e48', 'stroke-width': 0.35, 'stroke-linejoin': 'round' }];
        }),
        ['path', { d: starPath(32, 34, 18, 7.2, 8), fill: 'none', stroke: '#2a1a6a', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
        ['path', { d: starPath(32, 34, 10, 4.4, 8, -Math.PI / 2 + Math.PI / 8), fill: '#c8b8ff', opacity: 0.25 }],
        spin(36, 32, 34),
      ]],
      ['circle', { cx: 32, cy: 34, r: 6.6, fill: 'url(#core)' }, [pulse('r', '5.6;7.8;5.6', 2.8), pulse('opacity', '0.85;1;0.85', 2.8)]],
      ['circle', { cx: 32, cy: 34, r: 2, fill: '#ffffff' }],
      ['g', { opacity: 0.5 }, [
        ...ring(4, 32, 34, 26, -Math.PI / 4).map(([x, y]) => ['path', { d: `M32 34 L${x} ${y}`, stroke: '#ffffff', 'stroke-width': 0.4 }]),
        spin(14, 32, 34, true),
      ]],
      ...ring(8, 32, 34, 18).map(([x, y, i]) => ['path', { d: glintPath(x, y, 1.8), fill: '#ffffff', opacity: 0 }, [pulse('opacity', '0;1;0;0', 3.2, i * 0.4, { keyTimes: '0;0.12;0.3;1' }), spin(36, 32, 34)]]),
    ],
  }),

  redmountain: Object.freeze({   // Red Mountain under its ash, the crater glowing, lava running down its flanks, smoke and embers rising
    field: ['#3a0e08', '#050101'],
    bezel: 'obsidian',
    defs: {
      ash: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#120604'], [0.5, '#4a160c'], [0.82, '#a83a14'], [1, '#e0742a']]],
      rock: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#3a1a14'], [0.4, '#1e0c0a'], [1, '#080303']]],
      crater: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#fff6c8'], [0.3, '#ffb45a'], [0.7, '#e0461a', 0.6], [1, '#e0461a', 0]]],
      smoke: ['radialGradient', { cx: '50%', cy: '60%', r: '50%' }, [[0, '#6a4a40', 0.85], [0.6, '#3a2420', 0.6], [1, '#1a0e0c', 0]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#ash)' }],
      ['path', { d: 'M-8 18 Q8 12 22 17 Q36 22 50 15 Q62 10 74 16 L74 24 Q60 20 48 24 Q34 28 20 24 Q6 20 -8 26 Z', fill: '#1a0806', opacity: 0.7 }, [sway('translate', '0 0;-6 0;0 0', 16)]],
      ['path', { d: 'M-10 9 Q6 5 20 9 Q34 13 46 7 Q58 2 74 8 L74 13 Q58 9 46 13 Q32 18 18 14 Q4 10 -10 15 Z', fill: '#2a0e0a', opacity: 0.6 }, [sway('translate', '0 0;5 0;0 0', 21)]],
      ['path', { d: 'M27 22 Q22 14 26 8 Q30 2 37 5 Q44 8 41 15 Q38 20 36 22 Z', fill: 'url(#smoke)', opacity: 0.75 }, [pulse('opacity', '0.6;0.85;0.6', 6)]],
      ...[0, 1.3, 2.6, 3.9].map((b, i) => ['circle', { cx: 32, cy: 22, r: 3, fill: 'url(#smoke)', opacity: 0 }, [
        drift(`M0 0 Q${i % 2 ? 3 : -3} -9 ${i % 2 ? -2 : 4} -20`, 5.2, b), pulse('r', '3;10', 5.2, b), pulse('opacity', '0;1;0.8;0', 5.2, b, { keyTimes: '0;0.2;0.7;1' }),
      ]]),
      ['ellipse', { cx: 32, cy: 23, rx: 9, ry: 4.6, fill: 'url(#crater)' }, [pulse('rx', '8;10.4;8', 1.8), pulse('opacity', '0.85;1;0.85', 1.8)]],
      ['path', { d: 'M-2 62 L10 50 L16 44 L22 33 L27 24.6 L30 23 L34 23.4 L37.4 25 L42 32 L47.6 41 L54 48 L66 60 L66 64 L-2 64 Z', fill: 'url(#rock)', stroke: '#050101', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M27 24.6 L30 23 L34 23.4 L37.4 25 L35 26 L33 25 L30.4 25.4 Z', fill: '#ff8a2a' }, [pulse('fill', '#ff8a2a;#ffd27a;#ff8a2a', 1.8)]],
      ['path', { d: 'M22 33 L25 40 L22.6 48 L25.6 58 M42 32 L39.4 40.6 L43 49 L40.6 58 M16 44 L19 52 M47.6 41 L45 47', fill: 'none', stroke: '#4a2218', 'stroke-width': 0.6, opacity: 0.8 }],
      ['path', { d: 'M24 30 L40 30 L52 52 L12 52 Z', fill: '#e0461a', opacity: 0.08 }],
      ...[['M30.6 25 Q28.6 31 30 36 Q31.6 41 28.6 47 Q26.4 52 27.4 60', 2.4, 1.7], ['M35 25.6 Q37.4 30 36.4 34.6 Q35.6 39 38.6 43.4 Q40.4 46 39.6 49', 1.9, 1.3]].flatMap(([d, w, dur]) => [
        ['path', { d, fill: 'none', stroke: '#4a0e04', 'stroke-width': Number(w) + 1, 'stroke-linecap': 'round' }],
        ['path', { d, fill: 'none', stroke: '#e0461a', 'stroke-width': w, 'stroke-linecap': 'round' }, [pulse('stroke', '#e0461a;#ff7a1a;#e0461a', 2.4)]],
        ['path', { d, fill: 'none', stroke: '#ffd27a', 'stroke-width': 0.5, 'stroke-dasharray': '0.7 4.2', 'stroke-linecap': 'round', opacity: 0.85 }, [pulse('stroke-dashoffset', '9.8;0', Number(dur))]],
      ]),
      ['path', { d: 'M0 60 Q14 57 26 59.6 Q40 56.6 64 60 L64 64 L0 64 Z', fill: '#060202' }],
      mote(31, 22, 0.6, '#ffd27a', 18, 2.4, 0, -4),
      mote(33, 22, 0.5, '#ffb45a', 16, 2.1, 0.8, 3),
      mote(32, 23, 0.7, '#ff8a2a', 20, 2.8, 1.6, -1),
      mote(14, 30, 0.4, '#8a6a60', -6, 6, 0, 30),
      mote(8, 40, 0.4, '#8a6a60', -4, 7, 2.5, 32),
    ],
  }),

  hourglass: Object.freeze({   // a gilded hourglass, its sand running through the neck, turned over when the last grain falls
    field: ['#12304a', '#02070c'],
    bezel: 'gold',
    defs: {
      glass: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#cfe8ff', 0.35], [0.3, '#ffffff', 0.12], [0.7, '#9fc8ff', 0.08], [1, '#cfe8ff', 0.3]]],
      sand: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#fff0b0'], [0.5, '#f2c25a'], [1, '#c2801e']]],
      wood: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#fff6d0'], [0.35, '#f2cf6a'], [0.7, '#a8771e'], [1, '#4a300a']]],
      post: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#5a3a0c'], [0.4, '#fff0b0'], [0.7, '#c9963a'], [1, '#3a2408']]],
      topBulb: ['clipPath', {}, [['path', { d: BULB_T }]]],
      botBulb: ['clipPath', {}, [['path', { d: BULB_B }]]],
    },
    shapes: [
      ['g', { opacity: 0.35 }, [
        ['circle', { cx: 32, cy: 32, r: 26, fill: 'none', stroke: '#9fc8ff', 'stroke-width': 0.5 }],
        ...ring(12, 32, 32, 26).map(([x, y, i]) => ['path', { d: `M${x} ${y} L${r2(32 + (x - 32) * 0.9)} ${r2(32 + (y - 32) * 0.9)}`, stroke: '#cfe8ff', 'stroke-width': i % 3 ? 0.5 : 1 }]),
        spin(60, 32, 32),
      ]],
      ['g', {}, [
        ['g', { 'clip-path': 'url(#topBulb)' }, [
          ['rect', { x: 18, y: 18.6, width: 28, height: 14, fill: 'url(#sand)' }, [pulse('y', '18.6;31.4;31.4', 7, 0, { keyTimes: '0;0.86;1' })]],
        ]],
        ['g', { 'clip-path': 'url(#botBulb)' }, [
          ['path', { d: 'M18 51 L18 51 L32 51 L46 51 L46 51 Z', fill: 'url(#sand)' }, [pulse('d', 'M18 51 L18 51 L32 51 L46 51 L46 51 Z;M18 51 L18 43.4 L32 37.6 L46 43.4 L46 51 Z;M18 51 L18 43.4 L32 37.6 L46 43.4 L46 51 Z', 7, 0, { keyTimes: '0;0.86;1' })]],
        ]],
        ['path', { d: 'M32 31.2 L32 50', stroke: '#f2c25a', 'stroke-width': 0.7, 'stroke-dasharray': '0.7 0.9' }, [pulse('stroke-dashoffset', '3.2;0', 0.4), pulse('opacity', '1;1;0;0', 7, 0, { keyTimes: '0;0.85;0.86;1' })]],
        ['path', { d: BULB_T, fill: 'url(#glass)', stroke: '#cfe8ff', 'stroke-width': 0.7, 'stroke-opacity': 0.8 }],
        ['path', { d: BULB_B, fill: 'url(#glass)', stroke: '#cfe8ff', 'stroke-width': 0.7, 'stroke-opacity': 0.8 }],
        ['path', { d: 'M22.4 15 C22.4 20 26 24.4 29 27.6 M22.4 49 C22.4 44 26 39.6 29 36.4', fill: 'none', stroke: '#ffffff', 'stroke-width': 0.8, opacity: 0.6, 'stroke-linecap': 'round' }],
        ['path', { d: 'M17.6 12.4 L19.4 12.4 L19.4 51.6 L17.6 51.6 Z M44.6 12.4 L46.4 12.4 L46.4 51.6 L44.6 51.6 Z', fill: 'url(#post)', stroke: '#2a1a04', 'stroke-width': 0.5 }],
        ['path', { d: 'M17.6 22 L19.4 21 M17.6 32 L19.4 31 M17.6 42 L19.4 41 M44.6 22 L46.4 21 M44.6 32 L46.4 31 M44.6 42 L46.4 41', stroke: '#3a2408', 'stroke-width': 0.5 }],
        ['rect', { x: 14.4, y: 8.6, width: 35.2, height: 4.4, rx: 1.4, fill: 'url(#wood)', stroke: '#2a1a04', 'stroke-width': 0.7 }],
        ['rect', { x: 14.4, y: 51, width: 35.2, height: 4.4, rx: 1.4, fill: 'url(#wood)', stroke: '#2a1a04', 'stroke-width': 0.7 }],
        ['path', { d: 'M15.4 9.8 L48.6 9.8 M15.4 52.2 L48.6 52.2', stroke: '#fffbe6', 'stroke-width': 0.5, opacity: 0.7 }],
        ...[[16.6, 10.8], [47.4, 10.8], [16.6, 53.2], [47.4, 53.2], [32, 10.8], [32, 53.2]].map(([x, y]) => ['circle', { cx: x, cy: y, r: 0.8, fill: '#3a8ad0', stroke: '#1a0e02', 'stroke-width': 0.3 }]),
        sway('rotate', '0 32 32;0 32 32;180 32 32', 7, 0, FLIP),
      ]],
      ['path', { d: glintPath(50, 18, 1.8), fill: '#ffffff', opacity: 0 }, [pulse('opacity', '0;0;1;0', 7, 0, { keyTimes: '0;0.86;0.93;1' })]],
      ['path', { d: glintPath(13, 44, 1.4), fill: '#cfe8ff', opacity: 0 }, [pulse('opacity', '0;1;0', 2.8, 0.6)]],
    ],
  }),

  sanguinerose: Object.freeze({   // a black-red rose in full bloom, dew on its petals, thorns along its stem
    field: ['#40061a', '#070106'],
    bezel: 'obsidian',
    defs: {
      petal: ['radialGradient', { cx: '40%', cy: '30%', r: '75%' }, [[0, '#ff5a6a'], [0.35, '#c2142e'], [0.75, '#6a0418'], [1, '#2a0008']]],
      petalDeep: ['radialGradient', { cx: '50%', cy: '40%', r: '70%' }, [[0, '#a80a24'], [0.6, '#5a0214'], [1, '#1a0006']]],
      leaf: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#3a5a2a'], [0.5, '#1a2e14'], [1, '#060c04']]],
      glow: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ff2a4a', 0.5], [0.6, '#a80a24', 0.15], [1, '#a80a24', 0]]],
      dew: ['radialGradient', { cx: '35%', cy: '35%', r: '65%' }, [[0, '#ffffff'], [0.4, '#ffd8e0', 0.8], [1, '#ff8aa0', 0.2]]],
    },
    shapes: [
      ['circle', { cx: 32, cy: 26, r: 24, fill: 'url(#glow)' }],
      ['path', { d: 'M32 62 C31 52 33.6 46 31.6 38 C30.8 34.6 31.6 32 32.4 30', fill: 'none', stroke: '#0c1608', 'stroke-width': 2.6, 'stroke-linecap': 'round' }],
      ['path', { d: 'M32 62 C31 52 33.6 46 31.6 38 C30.8 34.6 31.6 32 32.4 30', fill: 'none', stroke: '#2a4a1e', 'stroke-width': 1.2, 'stroke-linecap': 'round' }],
      ['path', { d: 'M31.6 54 L28.6 52.6 L31.4 51.6 Z M33.2 47.6 L36.4 46 L33.4 45.2 Z M31.4 41 L28.4 39.6 L31.4 38.8 Z', fill: '#1a2a12', stroke: '#060c04', 'stroke-width': 0.4 }],
      ['path', { d: 'M32 48 C38 44 45 45 49 41 C45 49 38 50 32 48 Z', fill: 'url(#leaf)', stroke: '#060c04', 'stroke-width': 0.6 }],
      ['path', { d: 'M32 48 C38 46 43 45 49 41', fill: 'none', stroke: '#4a6a3a', 'stroke-width': 0.4 }],
      ['path', { d: 'M31.4 52.6 C25.4 49 18.4 50.6 14.6 46.6 C19 54 26 55 31.4 52.6 Z', fill: 'url(#leaf)', stroke: '#060c04', 'stroke-width': 0.6 }],
      ['path', { d: 'M31.4 52.6 C25.4 50.6 20 50 14.6 46.6', fill: 'none', stroke: '#4a6a3a', 'stroke-width': 0.4 }],
      ['path', { d: 'M27 33.4 L24.6 37 L29.4 35 Z M37.4 33.4 L39.8 37 L35 35 Z', fill: '#1a2e14', stroke: '#060c04', 'stroke-width': 0.4 }],
      ['path', { d: 'M17.6 24 C16 14.6 24 9.4 32 12.6 C40 9.4 48 14.6 46.4 24 C46 31.6 39.4 35.6 32 35.6 C24.6 35.6 18 31.6 17.6 24 Z', fill: 'url(#petalDeep)', stroke: '#1a0006', 'stroke-width': 0.7 }],
      ['path', { d: 'M18.4 25 C19.6 31.6 25 34.6 32 34.6 C30 31 25.4 27.6 18.4 25 Z', fill: 'url(#petal)', stroke: '#1a0006', 'stroke-width': 0.6 }],
      ['path', { d: 'M45.6 25 C44.4 31.6 39 34.6 32 34.6 C34 31 38.6 27.6 45.6 25 Z', fill: 'url(#petal)', stroke: '#1a0006', 'stroke-width': 0.6 }],
      ['path', { d: 'M20.4 17.6 C22 12 28.6 11.4 32 14.6 C27.6 15.4 23.6 18.4 22.6 23.4 C21.4 21.6 20.6 19.6 20.4 17.6 Z', fill: 'url(#petal)', stroke: '#1a0006', 'stroke-width': 0.6 }],
      ['path', { d: 'M43.6 17.6 C42 12 35.4 11.4 32 14.6 C36.4 15.4 40.4 18.4 41.4 23.4 C42.6 21.6 43.4 19.6 43.6 17.6 Z', fill: 'url(#petal)', stroke: '#1a0006', 'stroke-width': 0.6 }],
      ['path', { d: 'M22.6 24 C23.4 17.6 28 15.4 32 16.6 C36 15.4 40.6 17.6 41.4 24 C41.4 29.6 37 32.4 32 32.4 C27 32.4 22.6 29.6 22.6 24 Z', fill: 'url(#petalDeep)', stroke: '#1a0006', 'stroke-width': 0.6 }],
      ['path', { d: 'M24.6 25.4 C26 29.6 29 31.4 32 31.4 C35 31.4 38 29.6 39.4 25.4 C36.6 27.4 34.4 28 32 28 C29.6 28 27.4 27.4 24.6 25.4 Z', fill: 'url(#petal)', stroke: '#1a0006', 'stroke-width': 0.5 }],
      ['path', { d: 'M26.4 22.4 C27 18.6 30 17.4 32 18.4 C34 17.4 37 18.6 37.6 22.4 C36 21 34 20.6 32 21.6 C30 20.6 28 21 26.4 22.4 Z', fill: 'url(#petal)', stroke: '#1a0006', 'stroke-width': 0.5 }],
      ['path', { d: 'M28.4 24.6 C28.6 22.4 30.4 21.6 32 22.6 C33.6 21.6 35.4 22.4 35.6 24.6 C35 26.6 33.6 27.4 32 27.4 C30.4 27.4 29 26.6 28.4 24.6 Z', fill: '#4a0010', stroke: '#1a0006', 'stroke-width': 0.5 }],
      ['path', { d: 'M30 24.4 Q32 22.6 34 24.4 Q33 26 32 25.4 Q31 26 30 24.4 Z', fill: '#c2142e' }],
      ['path', { d: 'M19.6 22 Q20.6 15.4 26.6 13.4 M33.4 15.6 Q37.4 14.4 40.6 16.6 M25.4 27.6 Q28.4 30.4 31.4 30.6', fill: 'none', stroke: '#ff8a96', 'stroke-width': 0.6, opacity: 0.6, 'stroke-linecap': 'round' }],
      ['circle', { cx: 24.2, cy: 19.4, r: 1.2, fill: 'url(#dew)' }],
      ['circle', { cx: 40.6, cy: 27.6, r: 0.9, fill: 'url(#dew)' }],
      ['circle', { cx: 44.6, cy: 43.4, r: 0.8, fill: 'url(#dew)' }],
      ['circle', { cx: 34.4, cy: 31.4, r: 0.6, fill: 'url(#dew)' }],
    ],
  }),

  whitegold: Object.freeze({   // the White-Gold Tower over the Imperial City's walls and Lake Rumare at dusk, the moons above
    field: ['#24305a', '#04060e'],
    bezel: 'silver',
    defs: {
      dusk: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#0a1030'], [0.5, '#2a3a6a'], [0.78, '#a86a7a'], [1, '#f0b07a']]],
      marble: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#8a94b0'], [0.35, '#ffffff'], [0.6, '#e6ecf8'], [1, '#6a7490']]],
      wall: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#c8c0c8'], [1, '#5a5468']]],
      lake: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#d89a7a'], [0.4, '#4a5a8a'], [1, '#141a34']]],
      crown: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff', 0.9], [0.4, '#fff4c8', 0.4], [1, '#fff4c8', 0]]],
    },
    shapes: [
      ['rect', { x: 0, y: 0, width: 64, height: 64, fill: 'url(#dusk)' }],
      ...[[11, 13, 0.5], [18, 6, 0.4], [50, 9, 0.5], [57, 18, 0.4], [44, 4, 0.3], [6, 22, 0.3], [24, 16, 0.3], [58, 28, 0.3]].map(([x, y, r]) => ['circle', { cx: x, cy: y, r, fill: '#ffffff', opacity: 0.85 }]),
      ['circle', { cx: 47, cy: 15, r: 4.4, fill: 'url(#masser)' }],
      ['path', { d: 'M52.6 21.4 A2.8 2.8 0 1 0 56.6 24.8 A2.2 2.2 0 1 1 52.6 21.4 Z', fill: '#e6ecf8' }],
      ['circle', { cx: 32, cy: 7, r: 7, fill: 'url(#crown)' }],
      ['path', { d: 'M0 50 L64 50 L64 64 L0 64 Z', fill: 'url(#lake)' }],
      ['path', { d: 'M4 53 L18 53 M24 55.4 L40 55.4 M46 53.4 L60 53.4 M10 58 L22 58 M36 59.4 L54 59.4', stroke: '#ffd8b0', 'stroke-width': 0.5, opacity: 0.5 }],
      ['path', { d: 'M30.6 51 L33.4 51 L34.2 62 L29.8 62 Z', fill: '#ffffff', opacity: 0.16 }],
      ['path', { d: 'M6 50 L6 43.4 L10 43.4 L10 41.6 L13 41.6 L13 43.4 L22 43.4 L22 41 L25 41 L25 43.4 L39 43.4 L39 41 L42 41 L42 43.4 L51 43.4 L51 41.6 L54 41.6 L54 43.4 L58 43.4 L58 50 Z', fill: 'url(#wall)', stroke: '#2a2438', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M6 46 L58 46', stroke: '#3a3448', 'stroke-width': 0.4 }],
      ...[8, 16, 24, 40, 48, 56].map((x) => ['rect', { x: x - 0.6, y: 47, width: 1.2, height: 1.8, fill: '#ffd27a', opacity: 0.85 }]),
      ['path', { d: 'M28.4 43.4 L29.4 18 L31.2 9 L32 4.6 L32.8 9 L34.6 18 L35.6 43.4 Z', fill: 'url(#marble)', stroke: '#3a4058', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M27 43.4 L28 30 L36 30 L37 43.4 Z', fill: 'url(#marble)', stroke: '#3a4058', 'stroke-width': 0.6 }],
      ['path', { d: 'M26.6 30.4 L37.4 30.4 L36.6 28.6 L27.4 28.6 Z M28.4 19 L35.6 19 L35 17.6 L29 17.6 Z', fill: '#f2f4fa', stroke: '#3a4058', 'stroke-width': 0.5 }],
      ['path', { d: 'M30.4 43.4 L30.4 33 M33.6 43.4 L33.6 33 M31 28 L31 20.6 M33 28 L33 20.6', stroke: '#8a94b0', 'stroke-width': 0.4 }],
      ['path', { d: 'M32 4.6 L32.8 9 L34.6 18 L35.6 43.4', fill: 'none', stroke: '#ffffff', 'stroke-width': 0.6, opacity: 0.9 }],
      ['path', { d: 'M31.4 34 L32.6 34 L32.6 36 L31.4 36 Z M31.4 23 L32.6 23 L32.6 25 L31.4 25 Z', fill: '#ffd27a' }],
      ['path', { d: glintPath(32, 4.6, 2.6), fill: '#ffffff' }],
    ],
  }),
});
