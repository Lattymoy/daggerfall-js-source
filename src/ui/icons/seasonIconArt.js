// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 3): SEASON ONE'S PROFILE ICONS, the track's three -
// drawn in code as every icon is (ui/profileIcons.js ICON_ART). AURUM (the owner: "For profile icons no figures should be
// used. Ensure some are fully animated and go beyond with detail"): no construct stands in them any more, and the
// Lexicon and the Gearheart move - the shard's stars twinkle, the rest is its still drawing.
import { gearPath, glintPath, spin, pulse, drift, sway, mote } from './iconKit.js';

const HEART = 'M0 6.4 L-6 0.4 Q-8.6 -2.6 -6.4 -5 Q-3.8 -7.2 -1.4 -5.2 L0 -3.8 L1.4 -5.2 Q3.8 -7.2 6.4 -5 Q8.6 -2.6 6 0.4 Z';
/** A heartbeat's timing: two beats, then rest. */
const BEAT = { keyTimes: '0;0.12;0.25;0.37;1' };
/** A small gear turning about (x, y): its teeth, its hub and its spoke holes. */
const smallGear = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ dur) => ['g', {}, [
  ['path', { d: gearPath(x, y, 8.6, 6.6, 8), fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
  ['circle', { cx: x, cy: y, r: 4.6, fill: 'url(#brassDeep)', stroke: '#1a0e04', 'stroke-width': 0.6 }],
  ...[0, 1, 2, 3].map((i) => ['circle', { cx: x + Math.cos(i * Math.PI / 2) * 2.6, cy: y + Math.sin(i * Math.PI / 2) * 2.6, r: 0.9, fill: '#0a1218' }]),
  ['circle', { cx: x, cy: y, r: 1.2, fill: '#f3d78a', stroke: '#2a1806', 'stroke-width': 0.4 }],
  spin(dur, x, y, true),
]];
/** The lexicon's script: each line its own, lit in turn. */
const script = (/** @type {string[]} */ lines, /** @type {string} */ ink, /** @type {number} */ start) => lines.flatMap((d, i) => [
  ['path', { d, stroke: '#3fb8ff', 'stroke-width': 2.6, fill: 'none', opacity: 0.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [pulse('opacity', '0.2;0.6;0.2', 2.4, start + i * 0.6)]],
  ['path', { d, stroke: ink, 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [pulse('opacity', '0.6;1;0.6', 2.4, start + i * 0.6)]],
]);

export const SEASON_ICON_ART = Object.freeze({
  aetherium: Object.freeze({   // a cut shard of aetherium, two splinters beside it, set in a brass clasp; its stars twinkle
    field: ['#0f3a5e', '#020912'],
    bezel: 'brass',
    shapes: [
      ['path', { d: 'M32 30 L12 10 L16 8 Z M32 30 L52 10 L48 8 Z M32 30 L4 32 L4 28 Z M32 30 L60 32 L60 28 Z M32 30 L18 58 L14 56 Z M32 30 L46 58 L50 56 Z', fill: '#9ff9fc', opacity: 0.08 }],
      ['circle', { cx: 32, cy: 30, r: 23, fill: 'url(#glowBlue)', opacity: 0.8 }],
      ['path', { d: 'M20.6 31 L14.6 41.6 L18.6 51 L23 49.6 Z', fill: '#2a8ad0', stroke: '#06223a', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M20.6 31 L23 49.6 L25.4 49 Z', fill: '#155a94', stroke: '#06223a', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M43.4 31 L49.4 41.6 L45.4 51 L41 49.6 Z', fill: '#155a94', stroke: '#06223a', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M43.4 31 L41 49.6 L38.6 49 Z', fill: '#4aa6e0', stroke: '#06223a', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 5.4 L22 21 L26.4 50.4 L29.8 50.4 L30.4 20.4 Z', fill: '#2a8ad0', stroke: '#06223a', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 5.4 L30.4 20.4 L29.8 50.4 L34.2 50.4 L34.6 21.6 Z', fill: '#7fe0ff', stroke: '#06223a', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 5.4 L34.6 21.6 L34.2 50.4 L37.6 50.4 L42 21 Z', fill: '#155a94', stroke: '#06223a', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 5.4 L22 21 L30.4 20.4 Z', fill: '#c8f8ff', stroke: '#06223a', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 5.4 L34.6 21.6 L42 21 Z', fill: '#4aa6e0', stroke: '#06223a', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
      ['ellipse', { cx: 32, cy: 32, rx: 5, ry: 13, fill: 'url(#aether)', opacity: 0.65 }],
      ['path', { d: 'M31.6 7.6 L30.8 20.4 L30.2 46', stroke: '#ffffff', 'stroke-width': 0.8, fill: 'none', opacity: 0.75 }],
      ['path', { d: 'M23.4 21.6 L27 46', stroke: '#c8f8ff', 'stroke-width': 0.6, fill: 'none', opacity: 0.55 }],
      ['path', { d: 'M17.6 48 L46.4 48 L43.8 57 L20.2 57 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M21.4 48 L24 39.4 L26.6 48 Z M42.6 48 L40 39.4 L37.4 48 Z', fill: 'url(#brassV)', stroke: '#2a1806', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M19 51.4 L45 51.4', stroke: '#140a02', 'stroke-width': 0.9 }], ['path', { d: 'M19.2 52.4 L44.8 52.4', stroke: '#fff0c0', 'stroke-width': 0.6, opacity: 0.55 }],
      ['circle', { cx: 24.4, cy: 54.6, r: 0.9, fill: '#fff0c0' }], ['circle', { cx: 32, cy: 54.6, r: 0.9, fill: '#fff0c0' }], ['circle', { cx: 39.6, cy: 54.6, r: 0.9, fill: '#f3d78a' }],
      ['path', { d: glintPath(48, 15.4, 4.4), fill: '#ffffff' }, [pulse('opacity', '1;0.25;1', 3.2)]],
      ['path', { d: glintPath(14, 21.4, 2.4), fill: '#d8f7ff' }, [pulse('opacity', '0.3;1;0.3', 2.6, 0.8)]],
      ['path', { d: glintPath(37.4, 12.2, 1.6), fill: '#ffffff' }, [pulse('opacity', '0.9;0.2;0.9', 2.1, 1.4)]],
    ],
  }),
  lexicon: Object.freeze({   // a Dwemer lexicon floating in its rings of runes, its script lit line by line, its gem casting light upward
    field: ['#16243a', '#03060c'],
    bezel: 'brass',
    defs: {
      beam: ['linearGradient', { x1: 0, y1: 1, x2: 0, y2: 0 }, [[0, '#9ff9fc', 0.7], [0.5, '#3fb8ff', 0.22], [1, '#3fb8ff', 0]]],
    },
    shapes: [
      ['circle', { cx: 32, cy: 32, r: 25, fill: 'url(#glowBlue)', opacity: 0.45 }, [pulse('opacity', '0.35;0.6;0.35', 4)]],
      ['circle', { cx: 32, cy: 32, r: 24.6, fill: 'none', stroke: '#3fb8ff', 'stroke-width': 0.6, 'stroke-dasharray': '2.2 1.2 0.6 1.2 1 2.4', opacity: 0.4 }, [spin(48, 32, 32)]],
      ['circle', { cx: 32, cy: 32, r: 21.4, fill: 'none', stroke: '#9ff9fc', 'stroke-width': 0.4, 'stroke-dasharray': '0.6 2.8', opacity: 0.45 }, [spin(30, 32, 32, true)]],
      ['path', { d: 'M28.6 17 L35.4 17 L44 -4 L20 -4 Z', fill: 'url(#beam)', opacity: 0.45 }, [pulse('opacity', '0.3;0.65;0.3', 3.2)]],
      ['ellipse', { cx: 32, cy: 57, rx: 15, ry: 2.6, fill: '#020306', opacity: 0.6 }, [pulse('rx', '15;13;15', 4, 0, { calcMode: 'spline', keyTimes: '0;0.5;1', keySplines: '0.45 0 0.55 1;0.45 0 0.55 1' })]],
      ['g', {}, [
        ['path', { d: 'M32 10.4 L51 20.6 L32 30.8 L13 20.6 Z', fill: 'url(#brassTop)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
        ['path', { d: 'M13 20.6 L32 30.8 L32 54.4 L13 44.2 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
        ['path', { d: 'M51 20.6 L32 30.8 L32 54.4 L51 44.2 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
        ['path', { d: 'M15.8 25.4 L29.2 32.6 L29.2 50 L15.8 42.8 Z', fill: '#2a1806', 'fill-opacity': 0.18, stroke: '#2a1806', 'stroke-width': 0.8 }],
        ['path', { d: 'M48.2 25.4 L34.8 32.6 L34.8 50 L48.2 42.8 Z', fill: '#000000', 'fill-opacity': 0.18, stroke: '#0e0702', 'stroke-width': 0.8 }],
        ...script(['M18.4 30.4 L24.6 33.8 L24.6 39.2', 'M18.4 35.6 L21.6 37.4', 'M18.4 40.6 L22.6 42.8 L22.6 45.4', 'M26.8 38.8 L26.8 44.6 L27.6 45'], '#9ff9fc', 0),
        ...script(['M45.6 30.4 L39.4 33.8 L39.4 39.2', 'M45.6 35.6 L42.4 37.4', 'M45.6 40.6 L41.4 42.8 L41.4 45.4', 'M37.2 38.8 L37.2 44.6 L36.4 45'], '#7fe0ff', 0.3),
        ['path', { d: 'M32 15 L40.6 20.6 L32 26.2 L23.4 20.6 Z', fill: '#7a5420', stroke: '#2a1806', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
        ['path', { d: 'M32 16.8 L37.6 20.6 L32 24.4 L26.4 20.6 Z', fill: '#3fb8ff', stroke: '#06223a', 'stroke-width': 0.8 }],
        ['path', { d: 'M32 16.8 L37.6 20.6 L32 20.6 L26.4 20.6 Z', fill: '#9ff9fc', opacity: 0.8 }],
        ['circle', { cx: 32, cy: 20.6, r: 6.4, fill: 'url(#glowBlue)', opacity: 0.8 }, [pulse('r', '5.6;7.6;5.6', 3.2)]],
        ['circle', { cx: 30.4, cy: 19.6, r: 0.7, fill: '#ffffff' }],
        ['path', { d: 'M32 31.2 L32 54', stroke: '#fff0c0', 'stroke-width': 0.9, opacity: 0.7 }],
        ['path', { d: 'M13.6 20.6 L32 10.8 L50.4 20.6', stroke: '#fff7d6', 'stroke-width': 0.8, fill: 'none', opacity: 0.7 }],
        ['path', { d: 'M13 20.6 L16.4 22.4 L16.4 24 L13 22.2 Z M51 20.6 L47.6 22.4 L47.6 24 L51 22.2 Z M13 44.2 L16.4 46 L16.4 44.4 L13 42.6 Z M51 44.2 L47.6 46 L47.6 44.4 L51 42.6 Z', fill: '#f3d78a', stroke: '#2a1806', 'stroke-width': 0.6 }],
        sway('translate', '0 0;0 -1.6;0 0', 4, 0, { calcMode: 'spline', keyTimes: '0;0.5;1', keySplines: '0.45 0 0.55 1;0.45 0 0.55 1' }),
      ]],
      ['circle', { cx: 0, cy: 0, r: 1, fill: '#c8f8ff' }, [drift('M32 33 m-23 0 a23 6.5 0 1 0 46 0 a23 6.5 0 1 0 -46 0', 7), pulse('opacity', '1;0.2;1', 7)]],
      ['circle', { cx: 0, cy: 0, r: 0.7, fill: '#9ff9fc' }, [drift('M32 33 m23 0 a23 6.5 0 1 0 -46 0 a23 6.5 0 1 0 46 0', 7), pulse('opacity', '0.2;1;0.2', 7)]],
      mote(32, 15, 0.7, '#c8f8ff', 13, 2.8, 0, -1.4),
      mote(31, 15.6, 0.5, '#9ff9fc', 11, 2.8, 1.4, 1.6),
    ],
  }),
  gearheart: Object.freeze({   // gears turning about an aetherium heart that beats, its light ringing out, steam venting off a pipe
    field: ['#173040', '#04080c'],
    bezel: 'brass',
    defs: {
      heart: ['radialGradient', { cx: '36%', cy: '30%', r: '75%' }, [[0, '#ffffff'], [0.25, '#9ff9fc'], [0.6, '#2a9ae0'], [1, '#0e3a66']]],
    },
    shapes: [
      ['circle', { cx: 32, cy: 31, r: 27, fill: 'url(#glowBlue)', opacity: 0.5 }, [pulse('opacity', '0.45;0.85;0.5;0.72;0.45', 1.6, 0, BEAT)]],
      ['path', { d: gearPath(32, 32, 28.6, 26.4, 26), fill: 'none', stroke: '#c9963a', 'stroke-width': 0.6, opacity: 0.22 }, [spin(90, 32, 32, true)]],
      smallGear(50.2, 13.6, 16),
      smallGear(12.6, 47.6, 16),
      ['g', {}, [
        ['path', { d: gearPath(32, 31, 20.4, 17.2, 12), fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
        ['circle', { cx: 32, cy: 31, r: 15, fill: 'url(#brassDeep)', stroke: '#140a02', 'stroke-width': 0.9 }],
        ...[0, 1, 2, 3, 4, 5].map((i) => ['circle', { cx: 32 + Math.cos(i * Math.PI / 3 + 0.5) * 11.4, cy: 31 + Math.sin(i * Math.PI / 3 + 0.5) * 11.4, r: 2.4, fill: '#081018', stroke: '#2a1806', 'stroke-width': 0.6 }]),
        ['circle', { cx: 32, cy: 31, r: 15, fill: 'none', stroke: '#f3d78a', 'stroke-width': 0.5, opacity: 0.55, 'stroke-dasharray': '18 76' }],
        spin(24, 32, 31),
      ]],
      ['circle', { cx: 32, cy: 31, r: 9.6, fill: '#06111a', stroke: 'url(#brassV)', 'stroke-width': 2.4 }],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['circle', { cx: 32 + Math.cos(i * Math.PI / 4) * 9.6, cy: 31 + Math.sin(i * Math.PI / 4) * 9.6, r: 0.55, fill: i < 4 ? '#fff0c0' : '#7a5420' }]),
      ['circle', { cx: 32, cy: 31.5, r: 7, fill: 'none', stroke: '#9ff9fc', 'stroke-width': 1.2, opacity: 0 }, [
        pulse('r', '7;7;14;14', 1.6, 0, { keyTimes: '0;0.12;0.6;1' }), pulse('opacity', '0;0.85;0;0', 1.6, 0, { keyTimes: '0;0.12;0.6;1' }),
      ]],
      ['g', { transform: 'translate(32 31.6)' }, [
        ['path', { d: HEART, fill: 'url(#heart)', stroke: '#06223a', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }],
        ['path', { d: 'M0 6.4 L-6 0.4 Q-8.6 -2.6 -6.4 -5 Q-3.8 -7.2 -1.4 -5.2 L0 -3.8 Z', fill: '#c8f8ff', opacity: 0.35 }],
        ['path', { d: 'M0 -3.8 L0 6.4 L-3 -0.4 Z', fill: '#ffffff', opacity: 0.45 }],
        ['path', { d: 'M-5.4 -2.4 Q-4.4 -5 -2 -4.6', stroke: '#ffffff', 'stroke-width': 0.9, fill: 'none', 'stroke-linecap': 'round' }],
        sway('scale', '1;1.14;0.97;1.08;1', 1.6, 0, BEAT),
      ]],
      ['rect', { x: 45, y: 46.4, width: 3.6, height: 18, fill: 'url(#brassV)', stroke: '#2a1806', 'stroke-width': 0.6 }],
      ['rect', { x: 44.2, y: 52.6, width: 5.2, height: 1.6, rx: 0.4, fill: 'url(#brassTop)', stroke: '#2a1806', 'stroke-width': 0.5 }],
      ['rect', { x: 43.8, y: 44.4, width: 6, height: 2.2, rx: 0.6, fill: 'url(#brassTop)', stroke: '#2a1806', 'stroke-width': 0.6 }],
      ['circle', { cx: 46.8, cy: 53.4, r: 0.45, fill: '#2a1806' }],
      ['ellipse', { cx: 46.8, cy: 44.6, rx: 2.4, ry: 0.7, fill: '#0a0603' }],
      ['circle', { cx: 46.6, cy: 43, r: 2, fill: 'url(#steam)', opacity: 0 }, [drift('M0 0 Q-1 -6 1.4 -13', 3.3, 0), pulse('r', '2;5.4', 3.3, 0), pulse('opacity', '0;0.9;0', 3.3, 0)]],
      ['circle', { cx: 46.6, cy: 43, r: 2, fill: 'url(#steam)', opacity: 0 }, [drift('M0 0 Q2 -6 -0.6 -13', 3.3, 1.1), pulse('r', '2;5.4', 3.3, 1.1), pulse('opacity', '0;0.9;0', 3.3, 1.1)]],
      ['circle', { cx: 46.6, cy: 43, r: 2, fill: 'url(#steam)', opacity: 0 }, [drift('M0 0 Q-0.4 -7 2.2 -12', 3.3, 2.2), pulse('r', '2;5.4', 3.3, 2.2), pulse('opacity', '0;0.9;0', 3.3, 2.2)]],
      ['path', { d: glintPath(19, 17, 2.8), fill: '#fffbe6', opacity: 0 }, [pulse('opacity', '0;0;1;0', 5, 0, { keyTimes: '0;0.7;0.8;1' })]],
    ],
  }),
});
