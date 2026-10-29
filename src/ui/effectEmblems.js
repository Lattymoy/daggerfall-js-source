// @ts-check
// AUDIT-STOREFRONT (2026-10-29, the owner: "exceptional design for all assets"; bible/06-Systems/Storefront.md section 9):
// THE EFFECTS' EMBLEMS - a kill effect's, a portal skin's and a mount look's picture where the effect itself cannot
// play: a bundle's stage, the profile's slot choices, the Battle Pass's track. The profile icons' hand (ui/profileIcons.js):
// a round field in two colours, rimmed in gold, the picture over it. DRAWN IN CODE (Port-Doctrine: A RENDER OF GAME DATA
// IS GAME DATA): an SVG of a 64-unit square, one drawing at every size; a gradient a shape names (`url(#name)`) is the
// emblem's own. A document that cannot make SVG answers null. Not a DFU member.
import { effectName } from './effectText.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A figure 34 units tall standing at the middle - the one a kill effect takes. */
const FIGURE = 'M28.6 25.4 Q32 23.6 35.4 25.4 L38.2 37.6 L35.6 38 L35 50.4 L32.8 50.4 L32 41.6 L31.2 50.4 L29 50.4 L28.4 38 L25.8 37.6 Z';
/** A horse's head and neck in profile, its muzzle to the left - the one a mount look dresses. */
const HEAD = 'M47 58 L46.4 44 Q45 33 39.6 25.6 L41.4 16.4 L37.4 21.6 L36.2 15 L33.4 22.4 Q27 25 21.4 31.4 L14 40.2 Q11.6 43.4 13.6 46 Q15.8 48.4 19.4 47 L27.6 43.2 Q29.6 50.4 32.2 58 Z';
/** Its mane, along the neck's top. */
const MANE = 'M33.4 22.4 Q40.8 22.6 43.6 30.6 Q46.6 38.4 47.2 47 Q50.6 38.6 49.2 30.4 Q47 21.2 39.6 18.4 Z';

/**
 * The emblems, `<slot>:<key>`: `field` the round field's two colours, `grads` its own gradients (`{ id: [type, attrs,
 * [[offset, colour, opacity?], ...]] }`), `shapes` the picture, back to front.
 */
export const EMBLEM_ART = Object.freeze({
  // ═══ KILL EFFECTS: the body taken, each its own way ═══
  'kill:ashen': Object.freeze({   // the body crumbling to grey flakes from the feet up, an ember ring under it
    field: ['#3b3632', '#0c0a09'],
    grads: {
      ash: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#d4cdc4'], [0.45, '#8f8780'], [0.8, '#5a534d', 0.6], [1, '#5a534d', 0]]],
      glow: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ff9c3a', 0.55], [1, '#ff7a1a', 0]]],
    },
    shapes: [
      ['ellipse', { cx: 32, cy: 52, rx: 21, ry: 7, fill: 'url(#glow)' }],
      ['ellipse', { cx: 32, cy: 52, rx: 17, ry: 4.2, fill: 'none', stroke: '#ffb45a', 'stroke-width': 1.8 }],
      ['ellipse', { cx: 30, cy: 48.4, rx: 11, ry: 4, fill: '#a8a098', opacity: 0.45 }],
      ['ellipse', { cx: 36.4, cy: 49.6, rx: 7, ry: 2.6, fill: '#c8c0b6', opacity: 0.35 }],
      ['circle', { cx: 32, cy: 19.6, r: 4, fill: 'url(#ash)' }],
      ['path', { d: FIGURE, fill: 'url(#ash)' }],
      ['path', { d: 'M27 41 l2 -1.4 l0.8 2 Z M36.6 39.4 l2.2 -0.4 l-0.6 2 Z M30.6 45 l1.8 0.6 l-1.4 1.4 Z M34.6 44 l2 -1 l0.2 2 Z', fill: '#a8a098' }],
      ['path', { d: 'M28.4 30 L31 33.4 L29.6 36.4 M35.6 29.4 L33.6 32 L35 35', stroke: '#ffb45a', 'stroke-width': 0.8, fill: 'none', opacity: 0.9 }],
      ['path', { d: 'M40 30 l2.4 -1 l-0.4 2.4 Z M43.4 24.6 l2 0.4 l-1.6 1.4 Z M38.6 21.4 l1.6 -1.2 l0.4 1.8 Z M46.4 30.4 l1.4 1 l-1.8 0.6 Z M42 35.6 l2 -0.2 l-1 1.6 Z M23.4 28 l-2 -0.8 l1.6 -1.2 Z M20.6 33.6 l-1.8 0.6 l0.6 -1.8 Z',
        fill: '#d8d2c8', opacity: 0.9 }],
      ['path', { d: 'M47.6 22 l1.2 -0.6 l-0.2 1.4 Z M44.8 18.2 l1.4 0.2 l-1 1 Z M50 27 l1 0.8 l-1.3 0.3 Z', fill: '#d8d2c8', opacity: 0.55 }],
      ['circle', { cx: 37.4, cy: 33.4, r: 0.9, fill: '#ffb45a' }], ['circle', { cx: 29.2, cy: 44.2, r: 0.8, fill: '#ffb45a' }], ['circle', { cx: 41.6, cy: 27, r: 0.7, fill: '#ffb45a' }],
    ],
  }),
  'kill:voidrend': Object.freeze({   // a rift torn open where the body stood, the body's shards drawn into it
    field: ['#2a1150', '#07020f'],
    grads: { rift: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#000000'], [0.62, '#12042a'], [0.86, '#7a3cff'], [1, '#e2c8ff']]] },
    shapes: [
      ['ellipse', { cx: 32, cy: 32, rx: 14, ry: 25, fill: '#8f5bff', opacity: 0.16 }],
      ['path', { d: 'M32 7 Q42.6 20 41 32 Q42.6 44 32 57 Q21.4 44 23 32 Q21.4 20 32 7 Z', fill: 'url(#rift)', stroke: '#d6b8ff', 'stroke-width': 1.3 }],
      ['circle', { cx: 30.4, cy: 22, r: 0.8, fill: '#f4eeff' }], ['circle', { cx: 34, cy: 30, r: 0.6, fill: '#f4eeff' }], ['circle', { cx: 29.6, cy: 38.6, r: 0.7, fill: '#f4eeff' }],
      ['circle', { cx: 33.4, cy: 45, r: 0.5, fill: '#f4eeff' }],
      ['path', { d: 'M14 20 l5 2.4 l-4.4 1.6 Z M11.6 35 l5.4 -0.6 l-3.4 3.2 Z M17.4 46 l4.4 -2.8 l-1 4.4 Z M50 18.6 l-5 2.6 l4.6 1.4 Z M52.4 33 l-5.4 -0.4 l3.6 3 Z M47 47.4 l-4.4 -3 l1 4.4 Z',
        fill: '#3a2a5a', stroke: '#b593ff', 'stroke-width': 0.8 }],
      ['path', { d: 'M19 23 Q24 25 26.6 28 M16.6 34.6 Q22 34 24.6 33 M21.4 44.6 Q24.4 41.4 26 39 M45 21.6 Q40 24.4 37.4 28 M47.4 33 Q42 33.4 39.6 33.2 M42.6 44.6 Q40 41.6 38.4 39',
        stroke: '#d6b8ff', 'stroke-width': 0.8, fill: 'none', opacity: 0.6, 'stroke-dasharray': '1.4 1.6' }],
    ],
  }),
  'kill:pyre': Object.freeze({   // a Daedric sigil burning into the ground, a pillar of crimson fire taking the body
    field: ['#4d140a', '#0d0302'],
    grads: { flame: ['linearGradient', { x1: 0, y1: 1, x2: 0, y2: 0 }, [[0, '#ffd27a'], [0.35, '#ff7a1a'], [0.75, '#d2280a'], [1, '#d2280a', 0]]] },
    shapes: [
      ['ellipse', { cx: 32, cy: 52, rx: 19, ry: 5, fill: 'none', stroke: '#ff5a1e', 'stroke-width': 1.5 }],
      ['ellipse', { cx: 32, cy: 52, rx: 14.4, ry: 3.6, fill: 'none', stroke: '#ff8a3a', 'stroke-width': 0.9 }],
      ['path', { d: 'M13 52 H51 M32 47 V57 M18.6 48.6 L45.4 55.4 M18.6 55.4 L45.4 48.6', stroke: '#ff5a1e', 'stroke-width': 0.8, opacity: 0.8 }],
      ['path', { d: 'M24 52 Q22.4 40 26.6 30 Q27.6 22 31 12 Q33 20 36 24 Q41.4 34 40 52 Z', fill: 'url(#flame)' }],
      ['circle', { cx: 32, cy: 21.6, r: 3.6, fill: '#2a0602', opacity: 0.85 }],
      ['path', { d: 'M28.8 27 Q32 25.4 35.2 27 L37.4 37.4 L35.2 37.8 L34.6 49 L32.6 49 L32 41.4 L31.4 49 L29.4 49 L28.8 37.8 L26.6 37.4 Z', fill: '#2a0602', opacity: 0.85 }],
      ['path', { d: 'M21 30 q1 -3 0 -6 q2.4 2.6 1.4 6 Z M43 27 q1.4 -3 0.6 -6.4 q2.4 3 1 6.4 Z M19.4 40.4 q0.6 -2.4 -0.4 -4.6 q2 2.2 1.4 4.6 Z M45.6 39 q1 -2.6 0.2 -5 q2 2.4 1 5 Z',
        fill: '#ff9a3c' }],
      ['circle', { cx: 25, cy: 18, r: 0.8, fill: '#ffd27a' }], ['circle', { cx: 40, cy: 14.6, r: 0.7, fill: '#ffd27a' }], ['circle', { cx: 37.4, cy: 9.4, r: 0.6, fill: '#ffd27a' }],
    ],
  }),
  'kill:tonal': Object.freeze({   // the body struck to a ringing crystal and shattered by its own note
    field: ['#123848', '#03090c'],
    shapes: [
      ['path', { d: 'M12 22 Q7 32 12 42 M17 25 Q13.6 32 17 39 M52 22 Q57 32 52 42 M47 25 Q50.4 32 47 39', stroke: '#7fd8ff', 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round', opacity: 0.85 }],
      ['circle', { cx: 32, cy: 19.6, r: 4, fill: '#9fe6ff', opacity: 0.5, stroke: '#dff7ff', 'stroke-width': 0.8 }],
      ['path', { d: FIGURE, fill: '#9fe6ff', opacity: 0.45, stroke: '#dff7ff', 'stroke-width': 0.8 }],
      ['path', { d: 'M32 24 L30.4 30 L33.6 33 L31 38.4 M28.6 36 L30.4 30 M33.6 33 L36.6 35', stroke: '#ffffff', 'stroke-width': 0.9, fill: 'none' }],
      ['path', { d: 'M40 18 l3 -1.6 l-0.6 3.2 Z M44 27 l3.4 0.6 l-2.6 2 Z M21 16.6 l-2.8 -1.4 l0.6 3 Z M18 29 l-3.2 0.8 l2.4 1.8 Z M41.6 42 l2.8 1.4 l-2.8 1 Z M21.6 44 l-2.6 1.8 l2.8 0.8 Z',
        fill: '#c8f2ff', stroke: '#ffffff', 'stroke-width': 0.4 }],
      ['ellipse', { cx: 32, cy: 52.6, rx: 12, ry: 2.6, fill: '#3fb8ff', opacity: 0.3 }],
    ],
  }),

  // ═══ PORTAL SKINS: each gate's frame and its heart ═══
  'portal:runic': Object.freeze({   // a ring of grey standing stone cut with runes, a blue vortex turning in it
    field: ['#18283c', '#05080d'],
    grads: { swirl: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#dff4ff'], [0.25, '#4aa6ff'], [0.7, '#123a8a'], [1, '#081a40']]] },
    shapes: [
      ['ellipse', { cx: 32, cy: 32, rx: 15.6, ry: 22.6, fill: 'url(#swirl)' }],
      ['path', { d: 'M32 14 Q42 16 41 27 Q40 35 32 36 Q26 36.6 26.6 31 Q27.4 26.6 32 27.4 M32 50 Q22 48 23 37 Q24 29 32 28', stroke: '#bfe6ff', 'stroke-width': 1.3, fill: 'none', opacity: 0.8 }],
      ['ellipse', { cx: 32, cy: 32, rx: 18.6, ry: 25.6, fill: 'none', stroke: '#8c96a2', 'stroke-width': 5.4 }],
      ['ellipse', { cx: 32, cy: 32, rx: 18.6, ry: 25.6, fill: 'none', stroke: '#5a626c', 'stroke-width': 0.9 }],
      ['ellipse', { cx: 32, cy: 32, rx: 21.2, ry: 28.2, fill: 'none', stroke: '#3a4048', 'stroke-width': 0.8 }],
      ['path', { d: 'M30.6 6.6 l1.4 2 l1.4 -2 M47.6 14.6 l0.4 2.4 l2 -1 M50.8 31 l-2.2 1 l2.2 1 M47.6 49.4 l-1.6 -1.8 l-0.6 2.4 M31 57.4 l1 -2.2 l1 2.2 M16 49.6 l1.8 -1.6 l0.4 2.4 M13.2 33 l2.2 -1 l-2.2 -1 M16.4 14.4 l1.6 1.8 l0.6 -2.4',
        stroke: '#bfe6ff', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }],
    ],
  }),
  'portal:daedric': Object.freeze({   // a black arch of Oblivion spiked and burning at its edge, a crimson vortex in it
    field: ['#3d0d08', '#0b0202'],
    grads: { maw: ['radialGradient', { cx: '50%', cy: '55%', r: '55%' }, [[0, '#ffb45a'], [0.3, '#d2280a'], [0.75, '#4a0602'], [1, '#160100']]] },
    shapes: [
      ['ellipse', { cx: 32, cy: 54, rx: 20, ry: 3.6, fill: 'none', stroke: '#ff5a1e', 'stroke-width': 1.2, opacity: 0.8 }],
      ['path', { d: 'M18.6 54 L18.6 26 Q18.6 10 32 9 Q45.4 10 45.4 26 L45.4 54 Z', fill: 'url(#maw)' }],
      ['path', { d: 'M32 15 Q41 18 39 30 Q37 40 30 39 Q25 38 26.4 33 Q28 29 32 31', stroke: '#ffb45a', 'stroke-width': 1.2, fill: 'none', opacity: 0.85 }],
      ['path', { d: 'M15 55 L15 26 Q15 6.4 32 5.4 Q49 6.4 49 26 L49 55 L45.4 55 L45.4 26 Q45.4 10 32 9 Q18.6 10 18.6 26 L18.6 55 Z', fill: '#140606', stroke: '#ff5a1e', 'stroke-width': 1 }],
      ['path', { d: 'M15 20 L10.4 17 L15.6 24 Z M49 20 L53.6 17 L48.4 24 Z M20.4 9.6 L17 4.6 L23 8.4 Z M43.6 9.6 L47 4.6 L41 8.4 Z M32 5.4 L32 0.8 L34 5.4 Z M15 36 L10.6 35 L15 40 Z M49 36 L53.4 35 L49 40 Z',
        fill: '#140606', stroke: '#ff5a1e', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M17 46 q-1.4 -3 0 -6 q1.4 3 0 6 Z M47 44 q-1.4 -3 0 -6 q1.4 3 0 6 Z M24 6.6 q-0.6 -2.6 1 -4.4 q0.4 2.6 -1 4.4 Z', fill: '#ff8a3a' }],
    ],
  }),
  'portal:aetheric': Object.freeze({   // a ring of shifting colour round a violet heart, aetheric crystals turning about it
    field: ['#261a4a', '#06040f'],
    grads: {
      heart: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f4eeff'], [0.3, '#b593ff'], [0.75, '#3f1f8a'], [1, '#160a3a']]],
      prism: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#7fffd4'], [0.25, '#7fb8ff'], [0.5, '#d6b8ff'], [0.75, '#ff9ad6'], [1, '#ffe27a']]],
    },
    shapes: [
      ['ellipse', { cx: 32, cy: 32, rx: 15, ry: 21.6, fill: 'url(#heart)' }],
      ['ellipse', { cx: 32, cy: 32, rx: 17, ry: 23.6, fill: 'none', stroke: 'url(#prism)', 'stroke-width': 3.2 }],
      ['path', { d: 'M11 22 l2.2 -4.6 l2.2 4.6 l-2.2 4.6 Z M48.6 26 l2.2 -4.6 l2.2 4.6 l-2.2 4.6 Z M13.6 42 l1.8 -3.8 l1.8 3.8 l-1.8 3.8 Z M47 44.6 l1.8 -3.8 l1.8 3.8 l-1.8 3.8 Z',
        fill: '#c8b4ff', stroke: '#f4eeff', 'stroke-width': 0.7, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M13.2 17.4 V26.6 M50.8 21.4 V30.6', stroke: '#ffffff', 'stroke-width': 0.6, opacity: 0.7 }],
      ['circle', { cx: 28, cy: 24, r: 0.8, fill: '#ffffff' }], ['circle', { cx: 36, cy: 36, r: 0.7, fill: '#ffffff' }], ['circle', { cx: 31, cy: 43, r: 0.6, fill: '#ffffff' }],
    ],
  }),
  'portal:brass': Object.freeze({   // a brass cog-ring gate, an aetherium vortex in it, steam venting off its teeth
    field: ['#3b2b10', '#0c0803'],
    grads: {
      core: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#e8fbff'], [0.3, '#3fb8ff'], [0.75, '#0c3552'], [1, '#04121c']]],
      steam: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f2f7fa', 0.75], [1, '#f2f7fa', 0]]],
    },
    shapes: [
      ['circle', { cx: 32, cy: 32, r: 15.2, fill: 'url(#core)' }],
      ['path', { d: 'M32 19 Q41 22 38 31 Q35 37 30 34 Q27.6 32 30 29.6', stroke: '#9ff9fc', 'stroke-width': 1.2, fill: 'none' }],
      ['path', { d: 'M29.2 11.4 L29.8 7.4 L34.2 7.4 L34.8 11.4 L38.6 12.8 L41.6 10.2 L45 13 L42.8 16.4 L45.6 19.4 L49.4 18.2 L51.2 22.2 L47.8 24.4 L48.8 28.4 L52.8 29.2 L52.8 34.8 L48.8 35.6 L47.8 39.6 L51.2 41.8 L49.4 45.8 L45.6 44.6 L42.8 47.6 L45 51 L41.6 53.8 L38.6 51.2 L34.8 52.6 L34.2 56.6 L29.8 56.6 L29.2 52.6 L25.4 51.2 L22.4 53.8 L19 51 L21.2 47.6 L18.4 44.6 L14.6 45.8 L12.8 41.8 L16.2 39.6 L15.2 35.6 L11.2 34.8 L11.2 29.2 L15.2 28.4 L16.2 24.4 L12.8 22.2 L14.6 18.2 L18.4 19.4 L21.2 16.4 L19 13 L22.4 10.2 L25.4 12.8 Z M32 17 A15 15 0 1 0 32.01 17 Z',
        fill: '#c9963a', 'fill-rule': 'evenodd', stroke: '#4a3010', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['circle', { cx: 32, cy: 32, r: 15.6, fill: 'none', stroke: '#f3d78a', 'stroke-width': 0.8, opacity: 0.7 }],
      ['circle', { cx: 32, cy: 14.6, r: 1, fill: '#f3d78a' }], ['circle', { cx: 49.4, cy: 32, r: 1, fill: '#f3d78a' }], ['circle', { cx: 32, cy: 49.4, r: 1, fill: '#f3d78a' }], ['circle', { cx: 14.6, cy: 32, r: 1, fill: '#f3d78a' }],
      ['ellipse', { cx: 9, cy: 22, rx: 6, ry: 4.4, fill: 'url(#steam)' }], ['ellipse', { cx: 6, cy: 15.6, rx: 4.4, ry: 3.4, fill: 'url(#steam)', opacity: 0.7 }],
      ['ellipse', { cx: 55, cy: 42, rx: 6, ry: 4.4, fill: 'url(#steam)' }], ['ellipse', { cx: 58, cy: 48.4, rx: 4.4, ry: 3.4, fill: 'url(#steam)', opacity: 0.7 }],
    ],
  }),

  // ═══ MOUNT LOOKS: the horse's head in its look ═══
  'mount:spectral': Object.freeze({   // a pale blue ghost, light streaming off its mane, its eye a white star
    field: ['#16344c', '#040a10'],
    grads: { ghost: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#e6f6ff', 0.95], [0.6, '#8fcaff', 0.7], [1, '#4a7fd8', 0.15]]] },
    shapes: [
      ['path', { d: HEAD, fill: 'url(#ghost)', stroke: '#dff4ff', 'stroke-width': 0.9 }],
      ['path', { d: 'M38 20 Q48 18 54 24 M42 27 Q52 26 57 33 M45 35 Q53 36 57 43 M46.4 43 Q52 46 54 52', stroke: '#cfeeff', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }],
      ['path', { d: 'M40 23 Q47 24 50 29 M44 31 Q50 33 52 38', stroke: '#ffffff', 'stroke-width': 0.8, fill: 'none', opacity: 0.7 }],
      ['circle', { cx: 28.4, cy: 31.2, r: 1.5, fill: '#ffffff' }], ['circle', { cx: 28.4, cy: 31.2, r: 3, fill: '#ffffff', opacity: 0.3 }],
      ['circle', { cx: 18, cy: 21, r: 0.8, fill: '#cfeeff' }], ['circle', { cx: 12, cy: 30, r: 0.6, fill: '#cfeeff' }], ['circle', { cx: 22, cy: 53, r: 0.7, fill: '#cfeeff' }],
    ],
  }),
  'mount:dawnfire': Object.freeze({   // a radiant gold charger, its mane a sheet of morning fire, the sun rising behind it
    field: ['#4d3810', '#0e0903'],
    grads: {
      gold: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff2a8'], [0.5, '#e8b43a'], [1, '#9a6a14']]],
      fire: ['linearGradient', { x1: 0, y1: 1, x2: 1, y2: 0 }, [[0, '#ff6a14'], [0.5, '#ffb42e'], [1, '#fff2a8']]],
    },
    shapes: [
      ['circle', { cx: 40, cy: 26, r: 17, fill: '#ffd27a', opacity: 0.16 }],
      ['path', { d: 'M40 4 V9 M54.6 10 L51 13.6 M60.4 26 H55.4 M25.4 10 L29 13.6', stroke: '#ffd27a', 'stroke-width': 1.3, opacity: 0.55, 'stroke-linecap': 'round' }],
      ['path', { d: 'M33 22 Q38 13 42 15 Q40 18 44 18 Q47 14 50.6 16 Q48 20 52 23 Q55.4 22 57 26 Q53 28 55.6 33 Q58 34 58.4 39 Q54 39.4 54.6 45 Q51 44 49.6 49 Z', fill: 'url(#fire)' }],
      ['path', { d: HEAD, fill: 'url(#gold)', stroke: '#6a4a10', 'stroke-width': 1 }],
      ['path', { d: 'M24 36 Q27 38 31 36.6 M18 44 Q20 43 21.6 44.6', stroke: '#9a6a14', 'stroke-width': 0.9, fill: 'none' }],
      ['circle', { cx: 28.4, cy: 31.2, r: 1.3, fill: '#3a2002' }], ['circle', { cx: 28.8, cy: 30.8, r: 0.4, fill: '#fff2a8' }],
    ],
  }),
  'mount:warhorse': Object.freeze({   // a black Daedric charger in crimson-edged scale, a spiked chanfron, its eye a coal
    field: ['#2c0808', '#080202'],
    shapes: [
      ['path', { d: HEAD, fill: '#1a1010', stroke: '#5a1a14', 'stroke-width': 1 }],
      ['path', { d: MANE, fill: '#0a0606', stroke: '#d2280a', 'stroke-width': 0.6 }],
      ['path', { d: 'M33.6 46 Q36.4 43 39.2 46 M36.4 52 Q39.2 49 42 52 M39.8 39 Q42.4 36.4 45 39 M34.4 38 Q37 35.4 39.6 38 M38.6 31.6 Q40.8 29.4 43 31.6 M41 25 Q42.6 23.4 44.4 25.4',
        stroke: '#ff5a1e', 'stroke-width': 1, fill: 'none' }],
      ['path', { d: 'M17 40 L27 31.2 L33.4 24 L35 29 L28.6 36 L21.4 42.4 Z', fill: '#2a1414', stroke: '#8a2a1e', 'stroke-width': 0.8 }],
      ['path', { d: 'M27 31 L22 22.4 L29.2 28.6 Z M31.6 26.4 L30.4 17 L34 25 Z', fill: '#2a1414', stroke: '#d2280a', 'stroke-width': 0.7 }],
      ['circle', { cx: 28.6, cy: 31.6, r: 1.4, fill: '#ff3a12' }], ['circle', { cx: 28.6, cy: 31.6, r: 2.8, fill: '#ff3a12', opacity: 0.35 }],
      ['circle', { cx: 15.6, cy: 45.4, r: 0.8, fill: '#ff5a1e', opacity: 0.8 }],
      ['circle', { cx: 50, cy: 20, r: 0.7, fill: '#ff9a3c' }], ['circle', { cx: 53.4, cy: 28, r: 0.6, fill: '#ff9a3c' }], ['circle', { cx: 48, cy: 13.4, r: 0.5, fill: '#ff9a3c' }],
    ],
  }),
  'mount:automaton': Object.freeze({   // a Dwemer horse of brass plates and rivets, an aetherium lamp for an eye
    field: ['#3b2d12', '#0c0903'],
    grads: { brass: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#f3d78a'], [0.45, '#c9963a'], [1, '#6a4a14']]] },
    shapes: [
      ['path', { d: HEAD, fill: 'url(#brass)', stroke: '#4a3010', 'stroke-width': 1.2 }],
      ['path', { d: MANE, fill: '#3a3a40', stroke: '#1a1a1e', 'stroke-width': 0.6 }],
      ['path', { d: 'M38.4 28 Q36 34 37 40 M41.6 38 Q40 46 41 54 M22 34 L30 38 M20.6 42 Q24 41 27.6 43.2', stroke: '#4a3010', 'stroke-width': 1, fill: 'none' }],
      ['circle', { cx: 39.6, cy: 31, r: 0.8, fill: '#f3d78a' }], ['circle', { cx: 38.4, cy: 43, r: 0.8, fill: '#f3d78a' }], ['circle', { cx: 42.8, cy: 49.6, r: 0.8, fill: '#f3d78a' }],
      ['circle', { cx: 24.6, cy: 36.4, r: 0.8, fill: '#3fb8ff' }],
      ['circle', { cx: 28.4, cy: 31.2, r: 3.2, fill: '#3fb8ff', opacity: 0.3 }],
      ['circle', { cx: 28.4, cy: 31.2, r: 1.8, fill: '#3fb8ff', stroke: '#0c3552', 'stroke-width': 0.7 }],
      ['circle', { cx: 28.4, cy: 31.2, r: 0.6, fill: '#9ff9fc' }],
    ],
  }),
});

let _id = 0;
/**
 * AN EFFECT'S EMBLEM, as an `<svg>` element `size` px square in `doc` (classed `cls`): its round field, rimmed, and its
 * picture. Null for an effect with no emblem or a document that cannot make SVG.
 * @param {any} doc @param {string} slot @param {string} key @param {string} [cls] @param {number} [size]
 */
export function effectEmblemNode(doc, slot, key, cls = 'fx-emblem', size = 64) {
  const id = `${slot}:${key}`;
  const art = Object.hasOwn(EMBLEM_ART, id) ? /** @type {any} */ (EMBLEM_ART)[id] : null;
  if (!art || typeof doc?.createElementNS !== 'function') return null;
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}) => {
    const n = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const own = `fxem${++_id}`, ref = (/** @type {string} */ v) => v.replace(/url\(#(\w+)\)/g, (_, g) => `url(#${own}-${g})`);
  const svg = node('svg', { viewBox: '0 0 64 64', width: size, height: size, class: cls, role: 'img', 'aria-label': effectName(slot, key) });
  const defs = node('defs');
  const field = node('radialGradient', { id: `${own}-field`, cx: '50%', cy: '42%', r: '60%' });
  field.append(node('stop', { offset: '0%', 'stop-color': art.field[0] }), node('stop', { offset: '100%', 'stop-color': art.field[1] }));
  defs.append(field);
  for (const [g, [type, attrs, stops]] of Object.entries(art.grads ?? {})) {
    const gr = node(type, { id: `${own}-${g}`, ...attrs });
    for (const [o, c, a = 1] of stops) gr.append(node('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }));
    defs.append(gr);
  }
  const clip = node('clipPath', { id: `${own}-clip` });
  clip.append(node('circle', { cx: 32, cy: 32, r: 31 }));
  defs.append(clip);
  const pic = node('g', { 'clip-path': `url(#${own}-clip)` });
  pic.append(node('circle', { cx: 32, cy: 32, r: 31, fill: `url(#${own}-field)` }));
  for (const [tag, attrs] of art.shapes) pic.append(node(tag, Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, typeof v === 'string' ? ref(v) : v]))));
  svg.append(defs, pic, node('circle', { cx: 32, cy: 32, r: 31, fill: 'none', stroke: '#c9a55a', 'stroke-width': 1.5 }));
  return svg;
}
