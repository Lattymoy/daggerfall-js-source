// @ts-check
// WITCH1 (2026-10-20, the owner: "a brand new item (profile icon)"; bible/06-Systems/Witches-Festival.md): THE PROFILE
// ICONS - a picture a player WEARS in their portrait well in place of their character's face (net/identityToken.js
// ICONS, signed as `pi`): the profile mark in the menu's corner (ui/profileBadge.js), the account card's plate
// (ui/enhanced/enhancedAccount.js) and another player's Inspect card (ui/profileWindow.js). The Witches' Festival brings
// the first four - three a Wyrd Sister sells, the Soul Cake an account earns taking cakes from other players' offerings.
//
// DRAWN IN CODE (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): each an SVG of a 64-unit square, a round field and
// its picture, the same drawing at every size. A document that cannot make SVG (a pin's fake) answers null.
//
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).

import { t } from '../systems/textManager.js';   // STOREFRONT: the season's portraits' words, in the player's language

const SVG_NS = 'http://www.w3.org/2000/svg';

/** An icon's word, as a player reads it (the wardrobe's button, the window's row). */
export const ICON_TEXT = Object.freeze({
  tallowskull: 'Tallow Skull',
  twinmoons: 'Twin Moons',
  wyrdcauldron: 'Wyrd Cauldron',
  soulcake: 'Soul Cake',
  // STOREFRONT (2026-10-29, bible/06-Systems/Battle-Pass.md section 3): Season One's eight, read through the text core
  get centurion() { return t('account.icon.centurion', 'Centurion Helm'); },
  get aetherium() { return t('account.icon.aetherium', 'Aetherium Shard'); },
  get lexicon() { return t('account.icon.lexicon', 'Dwemer Lexicon'); },
  get spider() { return t('account.icon.spider', 'Brass Spider'); },
  get sphere() { return t('account.icon.sphere', 'Dwarven Sphere'); },
  get colossus() { return t('account.icon.colossus', 'Brass Colossus'); },
  get gearheart() { return t('account.icon.gearheart', 'Gearheart'); },
  get numidium() { return t('account.icon.numidium', 'Numidium'); },
});

/** Each icon's drawing: its field's two colours (the round ground, inner to outer) and its shapes - each `[tag, attrs]`
 *  in a 64-unit square, painted in order. */
export const ICON_ART = Object.freeze({
  tallowskull: Object.freeze({
    field: ['#3a2350', '#120a1c'],
    shapes: [
      ['ellipse', { cx: 32, cy: 52, rx: 15, ry: 3, fill: '#0a0610', opacity: 0.6 }],
      ['path', { d: 'M18 34 Q18 20 32 20 Q46 20 46 34 Q46 41 41 44 L41 50 L23 50 L23 44 Q18 41 18 34 Z', fill: '#e8e0c8', stroke: '#2a2016', 'stroke-width': 1.5 }],
      ['ellipse', { cx: 26, cy: 35, rx: 4.2, ry: 4.8, fill: '#1a1012' }],
      ['ellipse', { cx: 38, cy: 35, rx: 4.2, ry: 4.8, fill: '#1a1012' }],
      ['path', { d: 'M32 39 L29.5 44 L34.5 44 Z', fill: '#1a1012' }],
      ['path', { d: 'M26 47 L26 50 M30 47 L30 50 M34 47 L34 50 M38 47 L38 50', stroke: '#2a2016', 'stroke-width': 1.4 }],
      ['rect', { x: 28.5, y: 11, width: 7, height: 10, rx: 1.2, fill: '#efe2b8', stroke: '#6b5a36', 'stroke-width': 1 }],
      ['path', { d: 'M35.5 14 Q37.5 17 36 21', stroke: '#efe2b8', 'stroke-width': 2, fill: 'none' }],
      ['path', { d: 'M32 4 Q35.5 8.5 32 11 Q28.5 8.5 32 4 Z', fill: '#ffcf5a' }],
      ['path', { d: 'M32 6.5 Q33.6 8.8 32 10 Q30.4 8.8 32 6.5 Z', fill: '#fff6d0' }],
    ],
  }),
  twinmoons: Object.freeze({
    field: ['#1d2a52', '#070a18'],
    shapes: [
      ['circle', { cx: 14, cy: 16, r: 0.9, fill: '#fff' }], ['circle', { cx: 50, cy: 12, r: 0.8, fill: '#fff' }],
      ['circle', { cx: 46, cy: 46, r: 0.7, fill: '#cfd8ff' }], ['circle', { cx: 20, cy: 48, r: 0.6, fill: '#cfd8ff' }],
      ['circle', { cx: 28, cy: 34, r: 15, fill: '#c8502c', stroke: '#6a2412', 'stroke-width': 1.5 }],
      ['circle', { cx: 23, cy: 29, r: 3.2, fill: '#a63c20' }], ['circle', { cx: 33, cy: 39, r: 4.5, fill: '#a63c20' }],
      ['circle', { cx: 31, cy: 27, r: 2, fill: '#a63c20' }],
      // Secunda's crescent, a shape of its own (AUDIT WITCH1 E7: a sky-blue disc laid over the gradient showed as a patch)
      ['path', { d: 'M45.62 15.01 A7 7 0 1 0 51.99 25.63 A6.2 6.2 0 0 1 45.62 15.01 Z', fill: '#e6ecf4', stroke: '#7a8494', 'stroke-width': 1 }],
    ],
  }),
  wyrdcauldron: Object.freeze({
    field: ['#24402a', '#0a140c'],
    shapes: [
      ['circle', { cx: 24, cy: 12, r: 2.4, fill: '#b56bf0' }], ['circle', { cx: 38, cy: 8, r: 1.8, fill: '#d5a8ff' }],
      ['circle', { cx: 31, cy: 16, r: 1.5, fill: '#b56bf0' }],
      ['path', { d: 'M14 30 Q14 52 32 54 Q50 52 50 30 Z', fill: '#1c1a1e', stroke: '#050406', 'stroke-width': 1.5 }],
      ['ellipse', { cx: 32, cy: 30, rx: 19, ry: 5, fill: '#2a282e', stroke: '#050406', 'stroke-width': 1.5 }],
      ['ellipse', { cx: 32, cy: 30, rx: 15.5, ry: 3.4, fill: '#7dd654' }],
      ['circle', { cx: 27, cy: 28.5, r: 2.2, fill: '#d5f9b0' }], ['circle', { cx: 37, cy: 29.5, r: 1.6, fill: '#d5f9b0' }],
      ['path', { d: 'M27 26 Q25 21 29 18 M36 26 Q39 22 36 19', stroke: '#7dd654', 'stroke-width': 1.6, fill: 'none', opacity: 0.8 }],
      ['path', { d: 'M20 52 L17 58 M44 52 L47 58', stroke: '#1c1a1e', 'stroke-width': 3 }],
      ['path', { d: 'M22 47 Q32 50 42 47', stroke: '#3a3840', 'stroke-width': 1.2, fill: 'none' }],
    ],
  }),
  soulcake: Object.freeze({
    field: ['#5a3416', '#1e0f06'],
    shapes: [
      ['ellipse', { cx: 32, cy: 46, rx: 22, ry: 6, fill: '#c9b48a', stroke: '#5a4628', 'stroke-width': 1.2 }],
      ['path', { d: 'M13 40 Q13 22 32 22 Q51 22 51 40 Q51 46 32 46 Q13 46 13 40 Z', fill: '#c4823a', stroke: '#4a2a10', 'stroke-width': 1.5 }],
      ['path', { d: 'M17 33 Q20 25 32 24.5 Q40 24.8 45 29', stroke: '#e2b266', 'stroke-width': 2.4, fill: 'none', opacity: 0.8 }],
      ['path', { d: 'M32 24 L32 45 M15 35 Q32 39 49 35', stroke: '#f6f0de', 'stroke-width': 3.2, 'stroke-linecap': 'round', fill: 'none' }],
      ['circle', { cx: 24, cy: 31, r: 0.9, fill: '#2e180c' }], ['circle', { cx: 40, cy: 30, r: 0.9, fill: '#2e180c' }],
      ['circle', { cx: 25, cy: 41, r: 0.9, fill: '#2e180c' }], ['circle', { cx: 41, cy: 41, r: 0.9, fill: '#2e180c' }],
    ],
  }),
  // STOREFRONT: SEASON ONE'S EIGHT, the Rourken's works in brass (#c9963a, its shine #f3d78a, its shade #4a3010) lit by
  // aetherium (#3fb8ff, its glow #9ff9fc) - ui/playerBadge.js DWEMER_* and AETHERIUM_*
  centurion: Object.freeze({   // a Steam Centurion's domed helm, its visor's eyes lit, steam off its pipes
    field: ['#24465a', '#081218'],
    shapes: [
      ['ellipse', { cx: 32, cy: 55, rx: 16, ry: 3, fill: '#03080b', opacity: 0.6 }],
      ['path', { d: 'M17 30 Q9 31 10 44 M47 30 Q55 31 54 44', stroke: '#a8751b', 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round' }],
      ['path', { d: 'M19 46 L45 46 L48 53 L16 53 Z', fill: '#8a5f1f', stroke: '#3a2608', 'stroke-width': 1.4 }],
      ['path', { d: 'M16 44 L16 30 Q16 12 32 11 Q48 12 48 30 L48 44 Z', fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.5 }],
      ['path', { d: 'M29.5 11.5 L34.5 11.5 L34 24 L30 24 Z', fill: '#f3d78a', stroke: '#4a3010', 'stroke-width': 1 }],
      ['path', { d: 'M20 28 Q21 18 27 14', stroke: '#f3d78a', 'stroke-width': 2, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }],
      ['rect', { x: 19, y: 25, width: 26, height: 8, rx: 3, fill: '#140d05', stroke: '#4a3010', 'stroke-width': 1 }],
      ['ellipse', { cx: 32, cy: 29, rx: 12, ry: 5, fill: '#3fb8ff', opacity: 0.25 }],
      ['circle', { cx: 25.5, cy: 29, r: 2.3, fill: '#9ff9fc' }], ['circle', { cx: 38.5, cy: 29, r: 2.3, fill: '#9ff9fc' }],
      ['path', { d: 'M24 36 V43 M28 36 V43 M32 36 V43 M36 36 V43 M40 36 V43', stroke: '#4a3010', 'stroke-width': 1.6 }],
      ['circle', { cx: 19.5, cy: 40, r: 1.1, fill: '#f3d78a' }], ['circle', { cx: 44.5, cy: 40, r: 1.1, fill: '#f3d78a' }],
      ['circle', { cx: 10, cy: 46, r: 3, fill: '#d8e6ee', opacity: 0.45 }], ['circle', { cx: 54, cy: 46, r: 3, fill: '#d8e6ee', opacity: 0.45 }],
      ['circle', { cx: 12, cy: 51, r: 2, fill: '#d8e6ee', opacity: 0.3 }], ['circle', { cx: 52, cy: 51, r: 2, fill: '#d8e6ee', opacity: 0.3 }],
    ],
  }),
  aetherium: Object.freeze({   // a shard of aetherium and two splinters, set in a brass clasp
    field: ['#103a5c', '#030a14'],
    shapes: [
      ['circle', { cx: 32, cy: 30, r: 20, fill: '#3fb8ff', opacity: 0.16 }],
      ['path', { d: 'M22 30 L15 42 L19 52 L26 50 Z M42 30 L49 42 L45 52 L38 50 Z', fill: '#2a86c8', stroke: '#0c3552', 'stroke-width': 1.2 }],
      ['path', { d: 'M32 6 L42 26 L37 51 L27 51 L22 26 Z', fill: '#3fb8ff', stroke: '#0c3552', 'stroke-width': 1.4 }],
      ['path', { d: 'M32 6 L27 26 L31 50 L27 51 L22 26 Z', fill: '#9ff9fc', opacity: 0.55 }],
      ['path', { d: 'M32 6 L32 50 M22 26 L42 26', stroke: '#b8f6ff', 'stroke-width': 0.8, fill: 'none', opacity: 0.7 }],
      ['path', { d: 'M18 49 L46 49 L44 56 L20 56 Z', fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.4 }],
      ['path', { d: 'M20 52.5 L44 52.5', stroke: '#f3d78a', 'stroke-width': 1 }],
      ['path', { d: 'M48 12 L49 15 L52 16 L49 17 L48 20 L47 17 L44 16 L47 15 Z', fill: '#ffffff' }],
      ['path', { d: 'M14 18 L14.7 20 L16.7 20.7 L14.7 21.4 L14 23.4 L13.3 21.4 L11.3 20.7 L13.3 20 Z', fill: '#d8f7ff' }],
    ],
  }),
  lexicon: Object.freeze({   // a lexicon's brass cube, an aetherium gem on top and its script lit down its faces
    field: ['#3e2e12', '#0d0904'],
    shapes: [
      ['ellipse', { cx: 32, cy: 56, rx: 18, ry: 3, fill: '#050302', opacity: 0.6 }],
      ['circle', { cx: 32, cy: 32, r: 22, fill: '#3fb8ff', opacity: 0.1 }],
      ['path', { d: 'M32 11 L51 21 L32 31 L13 21 Z', fill: '#e2b75a', stroke: '#4a3010', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M13 21 L32 31 L32 54 L13 44 Z', fill: '#a8751b', stroke: '#4a3010', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M51 21 L32 31 L32 54 L51 44 Z', fill: '#7a5420', stroke: '#4a3010', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M13 21 L32 31 L51 21', stroke: '#f3d78a', 'stroke-width': 0.9, fill: 'none', opacity: 0.8 }],
      ['path', { d: 'M32 16 L38 21 L32 26 L26 21 Z', fill: '#3fb8ff', stroke: '#0c3552', 'stroke-width': 1 }],
      ['path', { d: 'M32 18.5 L35 21 L32 23.5 L29 21 Z', fill: '#9ff9fc' }],
      ['path', { d: 'M17 29 L27 34.3 L27 42 M17 35.5 L22 38.2 M17 40 L21 42.2 M47 29 L37 34.3 L37 42 M47 35.5 L42 38.2 M47 40 L43 42.2', stroke: '#7fe0ff', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }],
    ],
  }),
  spider: Object.freeze({   // a brass spider of the Rourken, eight jointed legs, its one eye and its core lit
    field: ['#2e2616', '#0a0805'],
    shapes: [
      ['ellipse', { cx: 32, cy: 54, rx: 18, ry: 3, fill: '#050302', opacity: 0.6 }],
      ['path', { d: 'M27 33 L15 25 L8 36 M27 37 L12 39 L9 50 M37 33 L49 25 L56 36 M37 37 L52 39 L55 50 M28 29 L21 16 L13 13 M36 29 L43 16 L51 13 M29 41 L23 50 L19 58 M35 41 L41 50 L45 58', stroke: '#a8751b', 'stroke-width': 2.6, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }],
      ['circle', { cx: 15, cy: 25, r: 1.6, fill: '#f3d78a' }], ['circle', { cx: 49, cy: 25, r: 1.6, fill: '#f3d78a' }], ['circle', { cx: 12, cy: 39, r: 1.6, fill: '#f3d78a' }], ['circle', { cx: 52, cy: 39, r: 1.6, fill: '#f3d78a' }],
      ['circle', { cx: 21, cy: 16, r: 1.6, fill: '#f3d78a' }], ['circle', { cx: 43, cy: 16, r: 1.6, fill: '#f3d78a' }], ['circle', { cx: 23, cy: 50, r: 1.6, fill: '#f3d78a' }], ['circle', { cx: 41, cy: 50, r: 1.6, fill: '#f3d78a' }],
      ['ellipse', { cx: 32, cy: 39, rx: 9.5, ry: 8.5, fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.4 }],
      ['path', { d: 'M23.5 38 Q32 42 40.5 38', stroke: '#4a3010', 'stroke-width': 1.4, fill: 'none' }],
      ['circle', { cx: 32, cy: 42, r: 2, fill: '#3fb8ff' }],
      ['circle', { cx: 32, cy: 27, r: 6.5, fill: '#e2b75a', stroke: '#4a3010', 'stroke-width': 1.4 }],
      ['circle', { cx: 32, cy: 27, r: 4, fill: '#3fb8ff', opacity: 0.35 }],
      ['circle', { cx: 32, cy: 27, r: 2.3, fill: '#9ff9fc' }],
      ['path', { d: 'M29 32.5 L28 35.5 M35 32.5 L36 35.5', stroke: '#4a3010', 'stroke-width': 1.4 }],
    ],
  }),
  sphere: Object.freeze({   // a Dwarven Sphere rolled shut, its visor's eye lit
    field: ['#26323c', '#080b0e'],
    shapes: [
      ['ellipse', { cx: 32, cy: 54, rx: 15, ry: 3, fill: '#030405', opacity: 0.6 }],
      ['circle', { cx: 32, cy: 32, r: 19, fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.6 }],
      ['path', { d: 'M13.5 34 Q32 48 50.5 34 Q48 50 32 51 Q16 50 13.5 34 Z', fill: '#8a5f1f', opacity: 0.55 }],
      ['ellipse', { cx: 25, cy: 21, rx: 7, ry: 4.5, fill: '#f3d78a', opacity: 0.6 }],
      ['path', { d: 'M13 32 Q32 39 51 32 M32 13 V23', stroke: '#4a3010', 'stroke-width': 1.5, fill: 'none' }],
      ['rect', { x: 21, y: 24, width: 22, height: 6, rx: 3, fill: '#0a0f14', stroke: '#4a3010', 'stroke-width': 1 }],
      ['ellipse', { cx: 32, cy: 27, rx: 8, ry: 3.5, fill: '#3fb8ff', opacity: 0.3 }],
      ['circle', { cx: 32, cy: 27, r: 2.2, fill: '#9ff9fc' }],
      ['circle', { cx: 20, cy: 39, r: 1.1, fill: '#f3d78a' }], ['circle', { cx: 44, cy: 39, r: 1.1, fill: '#f3d78a' }], ['circle', { cx: 32, cy: 44, r: 1.1, fill: '#f3d78a' }],
    ],
  }),
  colossus: Object.freeze({   // the Brass Colossus, head and shoulders, its eyes and its chest's core lit
    field: ['#3a2a10', '#0c0803'],
    shapes: [
      ['circle', { cx: 32, cy: 30, r: 24, fill: '#f3d78a', opacity: 0.08 }],
      ['path', { d: 'M5.3 47.5 L10 41 Q18 34 25 34 L39 34 Q46 34 54 41 L58.7 47.5 A30.9 30.9 0 0 1 5.3 47.5 Z', fill: '#a8751b', stroke: '#4a3010', 'stroke-width': 1.5 }],
      ['path', { d: 'M10 41 Q16 36 23 36 L22 44 Q15 44 10 41 Z M54 41 Q48 36 41 36 L42 44 Q49 44 54 41 Z', fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.2 }],
      ['rect', { x: 27, y: 30, width: 10, height: 6, fill: '#7a5420' }],
      ['path', { d: 'M23 32 L23 15 Q23 7 32 7 Q41 7 41 15 L41 32 Q32 35 23 32 Z', fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.5 }],
      ['path', { d: 'M30 7.5 L34 7.5 L33.5 16 L30.5 16 Z', fill: '#f3d78a' }],
      ['path', { d: 'M25.5 17 L38.5 17 L38.5 22 L25.5 22 Z', fill: '#140d05' }],
      ['ellipse', { cx: 32, cy: 19.5, rx: 8, ry: 3.5, fill: '#3fb8ff', opacity: 0.3 }],
      ['circle', { cx: 28.5, cy: 19.5, r: 1.7, fill: '#9ff9fc' }], ['circle', { cx: 35.5, cy: 19.5, r: 1.7, fill: '#9ff9fc' }],
      ['path', { d: 'M28 26 V30 M32 26 V31 M36 26 V30 M18 46 Q24 44 26 50 M46 46 Q40 44 38 50', stroke: '#4a3010', 'stroke-width': 1.3, fill: 'none' }],
      ['circle', { cx: 32, cy: 48, r: 7, fill: '#3fb8ff', opacity: 0.25 }],
      ['circle', { cx: 32, cy: 48, r: 4.2, fill: '#3fb8ff', stroke: '#0c3552', 'stroke-width': 1 }],
      ['circle', { cx: 32, cy: 48, r: 1.8, fill: '#9ff9fc' }],
      ['circle', { cx: 8, cy: 36, r: 2.5, fill: '#d8e6ee', opacity: 0.4 }], ['circle', { cx: 56, cy: 36, r: 2.5, fill: '#d8e6ee', opacity: 0.4 }],
    ],
  }),
  gearheart: Object.freeze({   // a brass gear of ten teeth, an aetherium heart beating at its middle
    field: ['#1a2f40', '#05090d'],
    shapes: [
      ['circle', { cx: 32, cy: 32, r: 26, fill: '#3fb8ff', opacity: 0.12 }],
      ['path', { d: 'M28.5 11.8 L29.3 7.2 L34.7 7.2 L35.5 11.8 L38.3 12.5 L41.1 13.6 L44.4 10.3 L48.8 13.5 L46.7 17.7 L48.6 20 L50.1 22.5 L54.8 21.7 L56.5 26.9 L52.3 29.1 L52.5 32 L52.3 34.9 L56.5 37.1 L54.8 42.3 L50.1 41.5 L48.6 44 L46.7 46.3 L48.8 50.5 L44.4 53.7 L41.1 50.4 L38.3 51.5 L35.5 52.2 L34.7 56.8 L29.3 56.8 L28.5 52.2 L25.7 51.5 L22.9 50.4 L19.6 53.7 L15.2 50.5 L17.3 46.3 L15.4 44 L13.9 41.5 L9.2 42.3 L7.5 37.1 L11.7 34.9 L11.5 32 L11.7 29.1 L7.5 26.9 L9.2 21.7 L13.9 22.5 L15.4 20 L17.3 17.7 L15.2 13.5 L19.6 10.3 L22.9 13.6 L25.7 12.5 Z', fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }],
      ['circle', { cx: 32, cy: 32, r: 14, fill: '#5c3d12', stroke: '#4a3010', 'stroke-width': 1.2 }],
      ['circle', { cx: 32, cy: 20.5, r: 1, fill: '#f3d78a' }], ['circle', { cx: 43.5, cy: 32, r: 1, fill: '#f3d78a' }],
      ['circle', { cx: 32, cy: 43.5, r: 1, fill: '#f3d78a' }], ['circle', { cx: 20.5, cy: 32, r: 1, fill: '#f3d78a' }],
      ['circle', { cx: 32, cy: 32, r: 10, fill: '#3fb8ff', opacity: 0.3 }],
      ['path', { d: 'M32 42 L23.5 33.5 Q20 29.5 23 26 Q26.5 22.8 30 25.5 L32 27.5 L34 25.5 Q37.5 22.8 41 26 Q44 29.5 40.5 33.5 Z', fill: '#3fb8ff', stroke: '#0c3552', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M25 28.5 Q26.5 25.8 29 26.6', stroke: '#9ff9fc', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }],
    ],
  }),
  numidium: Object.freeze({   // the Brass God standing in its own light, horned, its heart and eyes lit
    field: ['#4a3812', '#0e0a03'],
    shapes: [
      ['circle', { cx: 32, cy: 28, r: 21, fill: '#f3d78a', opacity: 0.14 }],
      ['path', { d: 'M32 3 V9 M14 12 L20 16 M50 12 L44 16 M9 30 H15 M55 30 H49', stroke: '#f3d78a', 'stroke-width': 1.2, opacity: 0.35, 'stroke-linecap': 'round' }],
      ['ellipse', { cx: 32, cy: 58.5, rx: 14, ry: 2.5, fill: '#050302', opacity: 0.6 }],
      ['path', { d: 'M32 5 L35 8 L35 13 L39 15 L45 27 L42 38 L39 38 L39 58 L35 58 L33.5 42 L30.5 42 L29 58 L25 58 L25 38 L22 38 L19 27 L25 15 L29 13 L29 8 Z', fill: '#c9963a', stroke: '#4a3010', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M29 8 L25.5 3 L30 6.5 Z M35 8 L38.5 3 L34 6.5 Z', fill: '#f3d78a' }],
      ['path', { d: 'M27 19 L37 19 M26.5 30 L37.5 30 M28 34.5 L36 34.5', stroke: '#4a3010', 'stroke-width': 1.1 }],
      ['circle', { cx: 32, cy: 24, r: 5, fill: '#3fb8ff', opacity: 0.3 }],
      ['circle', { cx: 32, cy: 24, r: 2.8, fill: '#3fb8ff' }],
      ['circle', { cx: 30.6, cy: 10, r: 0.9, fill: '#9ff9fc' }], ['circle', { cx: 33.4, cy: 10, r: 0.9, fill: '#9ff9fc' }],
    ],
  }),
});

let _gradientId = 0;
/**
 * AN ICON'S DRAWING, as an `<svg>` element `size` px square in `doc` (classed `cls`): its round field in its two
 * colours, rimmed, and its shapes. Null for a key with no drawing or a document that cannot make SVG.
 * @param {any} doc @param {unknown} key @param {string} [cls] @param {number} [size]
 */
export function profileIconNode(doc, key, cls = 'px-icon', size = 64) {
  const art = typeof key === 'string' && Object.hasOwn(ICON_ART, key) ? ICON_ART[/** @type {keyof typeof ICON_ART} */ (key)] : null;
  if (!art || typeof doc?.createElementNS !== 'function') return null;
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}) => {
    const n = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const svg = node('svg', { viewBox: '0 0 64 64', width: size, height: size, class: cls, role: 'img', 'aria-label': ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (key)] });
  const id = `pxicon-${key}-${++_gradientId}`;
  const defs = node('defs');
  const grad = node('radialGradient', { id, cx: '50%', cy: '42%', r: '60%' });
  grad.append(node('stop', { offset: '0%', 'stop-color': art.field[0] }), node('stop', { offset: '100%', 'stop-color': art.field[1] }));
  defs.append(grad);
  svg.append(defs, node('circle', { cx: 32, cy: 32, r: 31, fill: `url(#${id})`, stroke: '#c9a55a', 'stroke-width': 1.5 }));
  for (const [tag, attrs] of art.shapes) svg.append(node(/** @type {string} */ (tag), /** @type {Record<string, any>} */ (attrs)));
  return svg;
}
