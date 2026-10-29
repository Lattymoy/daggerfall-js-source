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
  // THE WITCHES' FESTIVAL'S FOUR (AUDIT-STOREFRONT: drawn again lit, in the iron bezel - the owner: "The profile images
  // leave a lot to be desired")
  tallowskull: Object.freeze({   // a skull of old bone, a tallow candle burning on its crown and lighting its brow
    field: ['#3e2656', '#100818'],
    bezel: 'iron',
    shapes: [
      ['circle', { cx: 32, cy: 17, r: 18, fill: 'url(#candle)' }],
      ['ellipse', { cx: 32, cy: 54.4, rx: 16, ry: 3, fill: '#06030a', opacity: 0.65 }],
      ['path', { d: 'M17.6 34.4 Q17.6 19.4 32 19.4 Q46.4 19.4 46.4 34.4 Q46.4 41.4 41.4 44.4 L41.4 51 L22.6 51 L22.6 44.4 Q17.6 41.4 17.6 34.4 Z', fill: 'url(#bone)', stroke: '#2a2016', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M40.4 21.6 Q46.4 25 46.4 34.4 Q46.4 41.4 41.4 44.4 L41.4 51 L37 51 Q41.6 36 40.4 21.6 Z', fill: '#3a2a1a', opacity: 0.3 }],
      ['path', { d: 'M20 31 Q22 23 30 21.4', stroke: '#fffaf0', 'stroke-width': 1.4, fill: 'none', opacity: 0.6, 'stroke-linecap': 'round' }],
      ['path', { d: 'M21.4 35.4 Q21.6 30.4 26 30.6 Q30.4 30.8 30.2 35.6 Q30 40.4 26 40.4 Q21.4 40.4 21.4 35.4 Z M33.8 35.6 Q33.6 30.8 38 30.6 Q42.4 30.4 42.6 35.4 Q42.6 40.4 38 40.4 Q34 40.4 33.8 35.6 Z', fill: '#140a10', stroke: '#2a2016', 'stroke-width': 0.6 }],
      ['ellipse', { cx: 26, cy: 36.4, rx: 1.8, ry: 1.6, fill: '#ffb45a', opacity: 0.45 }], ['ellipse', { cx: 38, cy: 36.4, rx: 1.8, ry: 1.6, fill: '#ffb45a', opacity: 0.45 }],
      ['path', { d: 'M32 39.6 L29.6 44.6 L34.4 44.6 Z', fill: '#140a10' }],
      ['path', { d: 'M24.6 47 L39.4 47', stroke: '#2a2016', 'stroke-width': 0.9 }],
      ['path', { d: 'M26.4 47 V51 M29.6 47 V51 M32.8 47 V51 M36 47 V51', stroke: '#2a2016', 'stroke-width': 1.1 }],
      ['path', { d: 'M38.4 22.6 L36.6 26.4 L38 28.6', stroke: '#3a2a1a', 'stroke-width': 0.8, fill: 'none', opacity: 0.8 }],
      ['path', { d: 'M28.4 21 L28.4 14.4 Q28.4 13 30 13 L34 13 Q35.6 13 35.6 14.4 L35.6 21 Z', fill: 'url(#wax)', stroke: '#6b5a36', 'stroke-width': 0.9 }],
      ['path', { d: 'M35.6 15 Q37.4 16.8 36.6 19.8 Q35.6 21.4 35.4 19.4 Z M28.4 15.6 Q27.2 17.4 28 18.8 Q28.6 18.2 28.4 16.8 Z', fill: '#efe2b8', stroke: '#6b5a36', 'stroke-width': 0.6 }],
      ['path', { d: 'M28.6 21 Q32 22.4 35.4 21', stroke: '#efe2b8', 'stroke-width': 1.6, fill: 'none' }],
      ['path', { d: 'M32 13 L32 11.4', stroke: '#2a1a10', 'stroke-width': 0.8 }],
      ['ellipse', { cx: 32, cy: 8.8, rx: 3.4, ry: 5, fill: 'url(#flame)' }],
      ['path', { d: 'M32 5.4 Q34.4 8.8 32.8 11.6 Q32 12.2 31.2 11.6 Q29.6 8.8 32 5.4 Z', fill: '#ffcf5a' }],
      ['path', { d: 'M32 7.6 Q33.2 9.6 32.4 11 Q32 11.4 31.6 11 Q30.8 9.6 32 7.6 Z', fill: '#fffbe6' }],
    ],
  }),
  twinmoons: Object.freeze({   // Masser full and red over a starred night, Secunda's silver crescent beside it
    field: ['#1e2c58', '#05081a'],
    bezel: 'iron',
    shapes: [
      ['path', { d: 'M14 15 L14.5 16.5 L16 17 L14.5 17.5 L14 19 L13.5 17.5 L12 17 L13.5 16.5 Z M50 9.6 L50.4 10.8 L51.6 11.2 L50.4 11.6 L50 12.8 L49.6 11.6 L48.4 11.2 L49.6 10.8 Z', fill: '#ffffff' }],
      ['circle', { cx: 46, cy: 47, r: 0.7, fill: '#cfd8ff' }], ['circle', { cx: 19, cy: 50, r: 0.6, fill: '#cfd8ff' }], ['circle', { cx: 9, cy: 31, r: 0.6, fill: '#cfd8ff' }],
      ['circle', { cx: 55, cy: 34, r: 0.5, fill: '#cfd8ff' }], ['circle', { cx: 39, cy: 6.4, r: 0.5, fill: '#ffffff' }],
      ['circle', { cx: 28, cy: 34, r: 19.6, fill: 'url(#masserGlow)' }],
      ['circle', { cx: 28, cy: 34, r: 15, fill: 'url(#masser)', stroke: '#5a1c0c', 'stroke-width': 1 }],
      ['circle', { cx: 22.6, cy: 28.6, r: 3.4, fill: '#8a2c14', opacity: 0.75 }], ['path', { d: 'M19.4 29.4 Q20 25.6 23.4 25.4', stroke: '#ffb48a', 'stroke-width': 0.7, fill: 'none', opacity: 0.6 }],
      ['circle', { cx: 33.4, cy: 39.4, r: 4.6, fill: '#8a2c14', opacity: 0.7 }], ['path', { d: 'M29 40 Q29.4 35.4 33.6 34.8', stroke: '#ffb48a', 'stroke-width': 0.7, fill: 'none', opacity: 0.55 }],
      ['circle', { cx: 31.4, cy: 26.6, r: 2, fill: '#8a2c14', opacity: 0.7 }], ['circle', { cx: 21.4, cy: 40, r: 1.6, fill: '#8a2c14', opacity: 0.6 }],
      ['path', { d: 'M38.4 25 Q43 33 39.6 42.4 Q35 48.6 28 49 Q41.6 46 42.4 34 Q42.6 28.4 38.4 25 Z', fill: '#2a0a04', opacity: 0.45 }],
      ['circle', { cx: 47.6, cy: 21.6, r: 8.6, fill: 'url(#secundaGlow)' }],
      ['path', { d: 'M45.62 15.01 A7 7 0 1 0 51.99 25.63 A6.2 6.2 0 0 1 45.62 15.01 Z', fill: 'url(#silver)', stroke: '#7a8494', 'stroke-width': 0.8 }],
      ['path', { d: 'M8 46 Q20 43 30 46.4 Q40 49.6 54 46', stroke: '#8a9ac8', 'stroke-width': 1.6, fill: 'none', opacity: 0.25, 'stroke-linecap': 'round' }],
    ],
  }),
  wyrdcauldron: Object.freeze({   // a black iron cauldron over embers, its green brew bubbling and its vapours rising violet
    field: ['#24422c', '#08120a'],
    bezel: 'iron',
    shapes: [
      ['circle', { cx: 32, cy: 28, r: 22, fill: 'url(#brewGlow)' }],
      ['path', { d: 'M27 26 Q24 20 28 15 Q31 11 28.6 6 M36 26 Q40 21 36.4 16 Q34 12 37 7.4', stroke: '#b56bf0', 'stroke-width': 2.2, fill: 'none', opacity: 0.45, 'stroke-linecap': 'round' }],
      ['path', { d: 'M27 26 Q24 20 28 15 Q31 11 28.6 6 M36 26 Q40 21 36.4 16 Q34 12 37 7.4', stroke: '#e2c8ff', 'stroke-width': 0.8, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }],
      ['circle', { cx: 24, cy: 12, r: 2.2, fill: '#b56bf0' }], ['circle', { cx: 23.4, cy: 11.4, r: 0.7, fill: '#f4e8ff' }],
      ['circle', { cx: 40, cy: 9, r: 1.7, fill: '#d5a8ff' }], ['circle', { cx: 31, cy: 17, r: 1.3, fill: '#b56bf0' }],
      ['ellipse', { cx: 32, cy: 57, rx: 13, ry: 3.4, fill: 'url(#embers)' }],
      ['path', { d: 'M24 58 L38 54.6 M26 54.6 L40 58', stroke: '#3a1a0a', 'stroke-width': 2, 'stroke-linecap': 'round' }],
      ['path', { d: 'M20.6 51 L17 58.4 M43.4 51 L47 58.4', stroke: '#141216', 'stroke-width': 3, 'stroke-linecap': 'round' }],
      ['path', { d: 'M13.6 30 Q13.6 52.6 32 54.6 Q50.4 52.6 50.4 30 Z', fill: 'url(#ironPot)', stroke: '#050406', 'stroke-width': 1.3 }],
      ['path', { d: 'M18 34 Q18.4 46 26 50.4', stroke: '#8a8a98', 'stroke-width': 1.2, fill: 'none', opacity: 0.45, 'stroke-linecap': 'round' }],
      ['path', { d: 'M22 52 Q32 55.4 42 52', stroke: '#ff7a1a', 'stroke-width': 1, fill: 'none', opacity: 0.5 }],
      ['ellipse', { cx: 32, cy: 30, rx: 19.2, ry: 5.2, fill: '#2a282e', stroke: '#050406', 'stroke-width': 1.3 }],
      ['path', { d: 'M13.4 29.4 Q22 25.2 32 25.2', stroke: '#9a9aa8', 'stroke-width': 0.9, fill: 'none', opacity: 0.6 }],
      ['ellipse', { cx: 32, cy: 30, rx: 15.6, ry: 3.6, fill: 'url(#brew)' }],
      ['circle', { cx: 26.6, cy: 29, r: 2.2, fill: '#c8f5a0', stroke: '#4a8a2a', 'stroke-width': 0.5 }], ['circle', { cx: 26, cy: 28.4, r: 0.7, fill: '#ffffff' }],
      ['circle', { cx: 37.4, cy: 30, r: 1.6, fill: '#c8f5a0', stroke: '#4a8a2a', 'stroke-width': 0.5 }], ['circle', { cx: 37, cy: 29.6, r: 0.5, fill: '#ffffff' }],
      ['circle', { cx: 32, cy: 31.2, r: 1, fill: '#c8f5a0' }],
    ],
  }),
  soulcake: Object.freeze({   // a Soul Cake fresh from the oven on a pewter plate, iced with its cross and studded with currants
    field: ['#5c3618', '#1c0e05'],
    bezel: 'iron',
    shapes: [
      ['circle', { cx: 32, cy: 30, r: 24, fill: 'url(#hearth)' }],
      ['path', { d: 'M24 18 Q22 14 25 11 Q27.6 8.6 25.6 5.6 M33 17 Q31 13 34 10 Q36.6 7.6 34.6 4.6 M41 18.6 Q39.4 15 42 12.4', stroke: '#fff4e0', 'stroke-width': 1.4, fill: 'none', opacity: 0.3, 'stroke-linecap': 'round' }],
      ['ellipse', { cx: 32, cy: 47, rx: 23, ry: 6.6, fill: 'url(#pewter)', stroke: '#3a3630', 'stroke-width': 1 }],
      ['ellipse', { cx: 32, cy: 46, rx: 18.6, ry: 4.4, fill: '#8a8278', opacity: 0.5 }],
      ['path', { d: 'M12.6 40 Q12.6 22 32 22 Q51.4 22 51.4 40 Q51.4 46.4 32 46.4 Q12.6 46.4 12.6 40 Z', fill: 'url(#bread)', stroke: '#4a2a10', 'stroke-width': 1.3 }],
      ['path', { d: 'M13.2 40.6 Q32 47.4 50.8 40.6 Q50.4 45.6 32 46 Q13.6 45.6 13.2 40.6 Z', fill: '#4a2a10', opacity: 0.45 }],
      ['path', { d: 'M17.4 32.6 Q20.6 25 32 24.4 Q40.4 24.6 45 28.6', stroke: '#f2c27a', 'stroke-width': 2, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }],
      ['path', { d: 'M32 24.4 L32 45.6 M14.8 35.6 Q32 39.6 49.2 35.6', stroke: '#8a5a2a', 'stroke-width': 4.4, 'stroke-linecap': 'round', fill: 'none', opacity: 0.45 }],
      ['path', { d: 'M32 23.8 L32 45 M14.8 35 Q32 39 49.2 35', stroke: '#fbf6ea', 'stroke-width': 3.2, 'stroke-linecap': 'round', fill: 'none' }],
      ['path', { d: 'M31.2 25 L31.2 33.4 M17 34.4 Q24 36.4 29.6 36.8', stroke: '#ffffff', 'stroke-width': 0.9, 'stroke-linecap': 'round', fill: 'none' }],
      ['circle', { cx: 24, cy: 30.6, r: 1.1, fill: '#2e180c' }], ['circle', { cx: 40.4, cy: 29.6, r: 1.1, fill: '#2e180c' }],
      ['circle', { cx: 24.6, cy: 41.4, r: 1.1, fill: '#2e180c' }], ['circle', { cx: 40.6, cy: 41.2, r: 1.1, fill: '#2e180c' }],
      ['circle', { cx: 23.7, cy: 30.3, r: 0.35, fill: '#c88a5a' }], ['circle', { cx: 40.1, cy: 29.3, r: 0.35, fill: '#c88a5a' }],
      ['circle', { cx: 19.4, cy: 38.4, r: 0.5, fill: '#f2c27a' }], ['circle', { cx: 44.6, cy: 37.4, r: 0.5, fill: '#f2c27a' }], ['circle', { cx: 36.4, cy: 27, r: 0.5, fill: '#f2c27a' }],
    ],
  }),
  // STOREFRONT: SEASON ONE'S EIGHT, the Rourken's works in brass lit from above left, aetherium their light (AUDIT-
  // STOREFRONT: drawn again lit and shaded - the owner: "The profile images leave a lot to be desired"). Each on the
  // brass bezel; its materials ICON_MATERIALS'.
  centurion: Object.freeze({   // a Steam Centurion's domed helm, its visor lit, steam venting off its pipes
    field: ['#1f4a5e', '#061015'],
    bezel: 'brass',
    shapes: [
      ['path', { d: 'M8 40 A24 24 0 0 1 56 40 M12 46 A20 20 0 0 1 52 46', stroke: '#9ff9fc', 'stroke-width': 0.6, fill: 'none', opacity: 0.12 }],
      ['circle', { cx: 32, cy: 28, r: 21, fill: 'url(#glowBlue)', opacity: 0.55 }],
      ['ellipse', { cx: 11.6, cy: 47, rx: 6, ry: 5, fill: 'url(#steam)' }], ['ellipse', { cx: 52.4, cy: 47, rx: 6, ry: 5, fill: 'url(#steam)' }],
      ['ellipse', { cx: 8, cy: 41, rx: 4.6, ry: 3.6, fill: 'url(#steam)', opacity: 0.7 }], ['ellipse', { cx: 56, cy: 41, rx: 4.6, ry: 3.6, fill: 'url(#steam)', opacity: 0.7 }],
      ['path', { d: 'M17 31 Q10 32 10.6 45 M47 31 Q54 32 53.4 45', stroke: '#2a1806', 'stroke-width': 5.4, fill: 'none', 'stroke-linecap': 'round' }],
      ['path', { d: 'M17 31 Q10 32 10.6 45 M47 31 Q54 32 53.4 45', stroke: 'url(#brassV)', 'stroke-width': 3.6, fill: 'none', 'stroke-linecap': 'round' }],
      ['path', { d: 'M16 32.4 Q11.6 33.6 11.6 42 M48 32.4 Q52.4 33.6 52.4 42', stroke: '#fff0c0', 'stroke-width': 0.8, fill: 'none', opacity: 0.55 }],
      ['path', { d: 'M18 47 L46 47 L50.6 55.6 L13.4 55.6 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M16 51 L48 51', stroke: '#140a02', 'stroke-width': 1 }], ['path', { d: 'M16.4 52 L47.6 52', stroke: '#f3d78a', 'stroke-width': 0.6, opacity: 0.5 }],
      ['path', { d: 'M16.4 45.6 L16.4 29 Q16.4 10.4 32 9.4 Q47.6 10.4 47.6 29 L47.6 45.6 Q32 49.4 16.4 45.6 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M39.6 11.8 Q47.6 16 47.6 29 L47.6 45.6 Q44.4 46.6 41 47 Q45.6 29 39.6 11.8 Z', fill: '#140a02', opacity: 0.35 }],
      ['path', { d: 'M29.6 9.6 L34.4 9.6 L33.8 22.4 L30.2 22.4 Z', fill: 'url(#brassV)', stroke: '#2a1806', 'stroke-width': 0.9 }],
      ['path', { d: 'M31 10.6 L30.8 21.4', stroke: '#fff7d6', 'stroke-width': 0.8, opacity: 0.8 }],
      ['ellipse', { cx: 23.6, cy: 18.4, rx: 4.6, ry: 1.8, transform: 'rotate(-38 23.6 18.4)', fill: '#fffbe6', opacity: 0.55 }],
      ['path', { d: 'M17.4 24.4 Q32 19.4 46.6 24.4 L46.6 26.6 Q32 21.6 17.4 26.6 Z', fill: '#2a1806', opacity: 0.55 }],
      ['path', { d: 'M18.6 26 Q32 22.2 45.4 26 L45.4 32.6 Q32 35.8 18.6 32.6 Z', fill: '#080503', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['ellipse', { cx: 32, cy: 29.4, rx: 13.4, ry: 4.6, fill: 'url(#glowBlue)' }],
      ['path', { d: 'M20.4 29.6 Q32 31.4 43.6 29.6', stroke: '#3fb8ff', 'stroke-width': 0.8, fill: 'none', opacity: 0.7 }],
      ['ellipse', { cx: 25.2, cy: 29.4, rx: 2.8, ry: 1.8, fill: 'url(#aether)' }], ['ellipse', { cx: 38.8, cy: 29.4, rx: 2.8, ry: 1.8, fill: 'url(#aether)' }],
      ['circle', { cx: 25.2, cy: 29.2, r: 0.8, fill: '#ffffff' }], ['circle', { cx: 38.8, cy: 29.2, r: 0.8, fill: '#ffffff' }],
      ['path', { d: 'M24 35.6 L40 35.6 L39 43.6 L25 43.6 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 0.9 }],
      ['path', { d: 'M27.2 37 V42.4 M30.4 37 V42.6 M33.6 37 V42.6 M36.8 37 V42.4', stroke: '#0e0702', 'stroke-width': 1.3 }],
      ['path', { d: 'M27.8 37 V42.4 M31 37 V42.6 M34.2 37 V42.6', stroke: '#f3d78a', 'stroke-width': 0.4, opacity: 0.6 }],
      ['circle', { cx: 20.4, cy: 38, r: 1.3, fill: '#2a1806' }], ['circle', { cx: 43.6, cy: 38, r: 1.3, fill: '#2a1806' }],
      ['circle', { cx: 20.4, cy: 43, r: 1.3, fill: '#2a1806' }], ['circle', { cx: 43.6, cy: 43, r: 1.3, fill: '#2a1806' }],
      ['circle', { cx: 20.1, cy: 37.7, r: 0.7, fill: '#fff0c0' }], ['circle', { cx: 43.3, cy: 37.7, r: 0.7, fill: '#f3d78a' }],
      ['circle', { cx: 20.1, cy: 42.7, r: 0.7, fill: '#fff0c0' }], ['circle', { cx: 43.3, cy: 42.7, r: 0.7, fill: '#f3d78a' }],
      ['path', { d: 'M18.2 41 Q17.4 22 26.4 13.2', stroke: '#fff0c0', 'stroke-width': 0.9, fill: 'none', opacity: 0.45 }],
    ],
  }),
  aetherium: Object.freeze({   // a cut shard of aetherium, two splinters beside it, set in a brass clasp
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
      ['path', { d: 'M48 11 L49 14.4 L52.4 15.4 L49 16.4 L48 19.8 L47 16.4 L43.6 15.4 L47 14.4 Z', fill: '#ffffff' }],
      ['path', { d: 'M14 19 L14.6 20.8 L16.4 21.4 L14.6 22 L14 23.8 L13.4 22 L11.6 21.4 L13.4 20.8 Z', fill: '#d8f7ff' }],
      ['path', { d: 'M37.4 10.6 L37.8 11.8 L39 12.2 L37.8 12.6 L37.4 13.8 L37 12.6 L35.8 12.2 L37 11.8 Z', fill: '#ffffff' }],
    ],
  }),
  lexicon: Object.freeze({   // a Dwemer lexicon's brass cube, an aetherium gem set in its top, its script lit down its faces
    field: ['#40301a', '#0c0803'],
    bezel: 'brass',
    shapes: [
      ['circle', { cx: 32, cy: 32, r: 24, fill: 'url(#glowBlue)', opacity: 0.45 }],
      ['ellipse', { cx: 32, cy: 56.4, rx: 17, ry: 2.8, fill: '#050302', opacity: 0.6 }],
      ['path', { d: 'M32 10.4 L51 20.6 L32 30.8 L13 20.6 Z', fill: 'url(#brassTop)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M13 20.6 L32 30.8 L32 54.4 L13 44.2 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M51 20.6 L32 30.8 L32 54.4 L51 44.2 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M15.8 25.4 L29.2 32.6 L29.2 50 L15.8 42.8 Z', fill: 'none', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['path', { d: 'M48.2 25.4 L34.8 32.6 L34.8 50 L48.2 42.8 Z', fill: 'none', stroke: '#0e0702', 'stroke-width': 0.8 }],
      ['path', { d: 'M18.4 30.4 L24.6 33.8 L24.6 39.2 M18.4 35.6 L21.6 37.4 M18.4 40.6 L22.6 42.8 L22.6 45.4 M26.8 38.8 L26.8 44.6 L27.6 45',
        stroke: '#3fb8ff', 'stroke-width': 2.6, fill: 'none', opacity: 0.35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
      ['path', { d: 'M18.4 30.4 L24.6 33.8 L24.6 39.2 M18.4 35.6 L21.6 37.4 M18.4 40.6 L22.6 42.8 L22.6 45.4 M26.8 38.8 L26.8 44.6 L27.6 45',
        stroke: '#9ff9fc', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
      ['path', { d: 'M45.6 30.4 L39.4 33.8 L39.4 39.2 M45.6 35.6 L42.4 37.4 M45.6 40.6 L41.4 42.8 L41.4 45.4 M37.2 38.8 L37.2 44.6 L36.4 45',
        stroke: '#3fb8ff', 'stroke-width': 2.6, fill: 'none', opacity: 0.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
      ['path', { d: 'M45.6 30.4 L39.4 33.8 L39.4 39.2 M45.6 35.6 L42.4 37.4 M45.6 40.6 L41.4 42.8 L41.4 45.4 M37.2 38.8 L37.2 44.6 L36.4 45',
        stroke: '#7fe0ff', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 15 L40.6 20.6 L32 26.2 L23.4 20.6 Z', fill: '#7a5420', stroke: '#2a1806', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 16.8 L37.6 20.6 L32 24.4 L26.4 20.6 Z', fill: '#3fb8ff', stroke: '#06223a', 'stroke-width': 0.8 }],
      ['path', { d: 'M32 16.8 L37.6 20.6 L32 20.6 L26.4 20.6 Z', fill: '#9ff9fc', opacity: 0.8 }],
      ['circle', { cx: 32, cy: 20.6, r: 6.4, fill: 'url(#glowBlue)', opacity: 0.8 }],
      ['circle', { cx: 30.4, cy: 19.6, r: 0.7, fill: '#ffffff' }],
      ['path', { d: 'M32 31.2 L32 54', stroke: '#fff0c0', 'stroke-width': 0.9, opacity: 0.7 }],
      ['path', { d: 'M13.6 20.6 L32 10.8 L50.4 20.6', stroke: '#fff7d6', 'stroke-width': 0.8, fill: 'none', opacity: 0.7 }],
      ['path', { d: 'M13 20.6 L16.4 22.4 L16.4 24 L13 22.2 Z M51 20.6 L47.6 22.4 L47.6 24 L51 22.2 Z M13 44.2 L16.4 46 L16.4 44.4 L13 42.6 Z M51 44.2 L47.6 46 L47.6 44.4 L51 42.6 Z', fill: '#f3d78a', stroke: '#2a1806', 'stroke-width': 0.6 }],
    ],
  }),
  spider: Object.freeze({   // a brass spider of the Rourken, eight jointed legs braced, its eye and its core lit
    field: ['#30281a', '#0a0805'],
    bezel: 'brass',
    shapes: [
      ['ellipse', { cx: 32, cy: 55.4, rx: 19, ry: 3, fill: '#050302', opacity: 0.6 }],
      ['circle', { cx: 32, cy: 36, r: 18, fill: 'url(#glowBlue)', opacity: 0.35 }],
      ['path', { d: 'M24.6 33.4 L14 24.4 L8.4 36.4 M24 38 L11.6 39.4 L9 50.6 M39.4 33.4 L50 24.4 L55.6 36.4 M40 38 L52.4 39.4 L55 50.6 M27 28.6 L20.4 15.4 L12.6 12.6 M37 28.6 L43.6 15.4 L51.4 12.6 M27.4 44 L22.6 51.6 L19.6 58 M36.6 44 L41.4 51.6 L44.4 58',
        stroke: '#2a1806', 'stroke-width': 4, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }],
      ['path', { d: 'M24.6 33.4 L14 24.4 L8.4 36.4 M24 38 L11.6 39.4 L9 50.6 M39.4 33.4 L50 24.4 L55.6 36.4 M40 38 L52.4 39.4 L55 50.6 M27 28.6 L20.4 15.4 L12.6 12.6 M37 28.6 L43.6 15.4 L51.4 12.6 M27.4 44 L22.6 51.6 L19.6 58 M36.6 44 L41.4 51.6 L44.4 58',
        stroke: 'url(#brassV)', 'stroke-width': 2.4, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }],
      ['path', { d: 'M24 32.6 L14.2 24.2 M23.6 37.4 L12 38.8 M26.6 28 L20.4 15.6 M27 43.4 L22.6 50.8', stroke: '#fff0c0', 'stroke-width': 0.7, fill: 'none', opacity: 0.6 }],
      ['circle', { cx: 14, cy: 24.4, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }], ['circle', { cx: 50, cy: 24.4, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }],
      ['circle', { cx: 11.6, cy: 39.4, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }], ['circle', { cx: 52.4, cy: 39.4, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }],
      ['circle', { cx: 20.4, cy: 15.4, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }], ['circle', { cx: 43.6, cy: 15.4, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }],
      ['circle', { cx: 22.6, cy: 51.6, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }], ['circle', { cx: 41.4, cy: 51.6, r: 2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 0.7 }],
      ['ellipse', { cx: 32, cy: 39.6, rx: 10.6, ry: 9.4, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 1.2 }],
      ['path', { d: 'M21.8 38 Q32 42.6 42.2 38 M23.4 43.6 Q32 47.6 40.6 43.6', stroke: '#2a1806', 'stroke-width': 1.1, fill: 'none' }],
      ['path', { d: 'M22.4 38.8 Q32 43.2 41.6 38.8', stroke: '#fff0c0', 'stroke-width': 0.5, fill: 'none', opacity: 0.5 }],
      ['ellipse', { cx: 32, cy: 45.6, rx: 3.6, ry: 2, fill: 'url(#aether)' }],
      ['ellipse', { cx: 27.6, cy: 34.6, rx: 3, ry: 1.4, transform: 'rotate(-25 27.6 34.6)', fill: '#fffbe6', opacity: 0.5 }],
      ['path', { d: 'M29 32.6 Q27.4 35.4 28.6 37 M35 32.6 Q36.6 35.4 35.4 37', stroke: '#2a1806', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }],
      ['circle', { cx: 32, cy: 27, r: 7.2, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 1.2 }],
      ['circle', { cx: 32, cy: 27.4, r: 4.2, fill: '#080503', stroke: '#2a1806', 'stroke-width': 0.6 }],
      ['circle', { cx: 32, cy: 27.4, r: 3.4, fill: 'url(#aether)' }],
      ['circle', { cx: 31, cy: 26.4, r: 0.9, fill: '#ffffff' }],
      ['ellipse', { cx: 28.6, cy: 22.8, rx: 2.4, ry: 1.1, transform: 'rotate(-30 28.6 22.8)', fill: '#fffbe6', opacity: 0.6 }],
    ],
  }),
  sphere: Object.freeze({   // a Dwarven Sphere rolled shut, its seams tight, its visor's eye lit
    field: ['#24323e', '#070a0d'],
    bezel: 'brass',
    shapes: [
      ['ellipse', { cx: 32, cy: 53.6, rx: 16, ry: 3, fill: '#020304', opacity: 0.65 }],
      ['circle', { cx: 32, cy: 31.4, r: 19.6, fill: 'url(#brassBall)', stroke: '#2a1806', 'stroke-width': 1.3 }],
      ['path', { d: 'M12.6 33.4 Q32 42.8 51.4 33.4', stroke: '#140a02', 'stroke-width': 2.4, fill: 'none' }],
      ['path', { d: 'M13.2 35.4 Q32 44.6 50.8 35.4', stroke: '#f3d78a', 'stroke-width': 0.7, fill: 'none', opacity: 0.55 }],
      ['path', { d: 'M32 11.8 Q37.4 20.4 37 26.2 M32 51 Q35.6 45.6 36.6 40.4', stroke: '#2a1806', 'stroke-width': 1.1, fill: 'none' }],
      ['path', { d: 'M19.4 19.6 Q16 26 16.6 31.4 M44.6 19.6 Q48 26 47.4 31.4', stroke: '#2a1806', 'stroke-width': 0.9, fill: 'none', opacity: 0.7 }],
      ['path', { d: 'M21 24.6 Q32 21 43 24.6 L43 31.4 Q32 34.6 21 31.4 Z', fill: '#060809', stroke: '#2a1806', 'stroke-width': 0.9 }],
      ['ellipse', { cx: 32, cy: 28, rx: 10.6, ry: 3.8, fill: 'url(#glowBlue)' }],
      ['ellipse', { cx: 32, cy: 28.2, rx: 3, ry: 2, fill: 'url(#aether)' }],
      ['circle', { cx: 31.2, cy: 27.6, r: 0.7, fill: '#ffffff' }],
      ['circle', { cx: 18.4, cy: 38, r: 1, fill: '#2a1806' }], ['circle', { cx: 25, cy: 41.4, r: 1, fill: '#2a1806' }], ['circle', { cx: 39, cy: 41.4, r: 1, fill: '#2a1806' }], ['circle', { cx: 45.6, cy: 38, r: 1, fill: '#2a1806' }],
      ['circle', { cx: 18.2, cy: 37.7, r: 0.5, fill: '#fff0c0' }], ['circle', { cx: 24.8, cy: 41.1, r: 0.5, fill: '#fff0c0' }], ['circle', { cx: 38.8, cy: 41.1, r: 0.5, fill: '#f3d78a' }], ['circle', { cx: 45.4, cy: 37.7, r: 0.5, fill: '#f3d78a' }],
      ['ellipse', { cx: 24.6, cy: 19.4, rx: 5.4, ry: 2.8, transform: 'rotate(-35 24.6 19.4)', fill: '#fffbe6', opacity: 0.5 }],
      ['circle', { cx: 23, cy: 18, r: 1.2, fill: '#ffffff', opacity: 0.85 }],
      ['path', { d: 'M48.6 38 Q45.4 46.6 37 50', stroke: '#f3d78a', 'stroke-width': 0.9, fill: 'none', opacity: 0.4 }],
    ],
  }),
  colossus: Object.freeze({   // the Brass Colossus, head and shoulders, steam at its pauldrons, its eyes and its heart lit
    field: ['#3a2a10', '#0c0803'],
    bezel: 'brass',
    shapes: [
      ['circle', { cx: 32, cy: 30, r: 26, fill: 'url(#forge)', opacity: 0.8 }],
      ['ellipse', { cx: 9, cy: 33, rx: 6, ry: 4.4, fill: 'url(#steam)' }], ['ellipse', { cx: 55, cy: 33, rx: 6, ry: 4.4, fill: 'url(#steam)' }],
      ['path', { d: 'M5.4 48 L9.6 41 Q17.6 34 25 34 L39 34 Q46.4 34 54.4 41 L58.6 48 A30.9 30.9 0 0 1 5.4 48 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 1.3 }],
      ['path', { d: 'M24.6 38 L39.4 38 L41 50 Q32 54 23 50 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1 }],
      ['path', { d: 'M9.6 41 Q15.6 35.4 23.4 35.6 L22.4 45 Q14.6 45 9.6 41 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.1 }],
      ['path', { d: 'M54.4 41 Q48.4 35.4 40.6 35.6 L41.6 45 Q49.4 45 54.4 41 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 1.1 }],
      ['path', { d: 'M11.6 39.6 Q16.4 36.6 22 36.8', stroke: '#fff0c0', 'stroke-width': 0.8, fill: 'none', opacity: 0.6 }],
      ['circle', { cx: 15.6, cy: 41.6, r: 0.9, fill: '#fff0c0' }], ['circle', { cx: 19.6, cy: 42.4, r: 0.9, fill: '#fff0c0' }], ['circle', { cx: 44.4, cy: 42.4, r: 0.9, fill: '#c9963a' }], ['circle', { cx: 48.4, cy: 41.6, r: 0.9, fill: '#c9963a' }],
      ['rect', { x: 27, y: 30, width: 10, height: 6, fill: '#5a3a12', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['path', { d: 'M23 32.4 L23 15 Q23 6.6 32 6.6 Q41 6.6 41 15 L41 32.4 Q32 35.6 23 32.4 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M36.6 7.6 Q41 9.6 41 15 L41 32.4 Q38.6 33.6 36.4 34 Q39.6 20 36.6 7.6 Z', fill: '#140a02', opacity: 0.35 }],
      ['path', { d: 'M30.2 6.8 L33.8 6.8 L33.4 15.6 L30.6 15.6 Z', fill: 'url(#brassV)', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['path', { d: 'M25.2 16.8 L38.8 16.8 L38.8 22.2 L25.2 22.2 Z', fill: '#080503', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['ellipse', { cx: 32, cy: 19.5, rx: 9.4, ry: 3.6, fill: 'url(#glowBlue)' }],
      ['ellipse', { cx: 28.4, cy: 19.5, rx: 2, ry: 1.4, fill: 'url(#aether)' }], ['ellipse', { cx: 35.6, cy: 19.5, rx: 2, ry: 1.4, fill: 'url(#aether)' }],
      ['path', { d: 'M28 25.6 V30 M30.6 25.6 V30.6 M33.4 25.6 V30.6 M36 25.6 V30', stroke: '#140a02', 'stroke-width': 1.1 }],
      ['ellipse', { cx: 26.6, cy: 11.4, rx: 2.6, ry: 1.2, transform: 'rotate(-40 26.6 11.4)', fill: '#fffbe6', opacity: 0.55 }],
      ['circle', { cx: 32, cy: 46.4, r: 7.6, fill: 'url(#glowBlue)' }],
      ['circle', { cx: 32, cy: 46.4, r: 4.6, fill: '#0c3552', stroke: '#2a1806', 'stroke-width': 1 }],
      ['circle', { cx: 32, cy: 46.4, r: 3.6, fill: 'url(#aether)' }],
      ['circle', { cx: 31, cy: 45.4, r: 0.9, fill: '#ffffff' }],
      ['path', { d: 'M18 47 Q24 45 26 51 M46 47 Q40 45 38 51', stroke: '#2a1806', 'stroke-width': 1.1, fill: 'none' }],
    ],
  }),
  gearheart: Object.freeze({   // a brass gear of ten teeth, an aetherium heart beating at its hub
    field: ['#1a3042', '#05090d'],
    bezel: 'brass',
    shapes: [
      ['circle', { cx: 32, cy: 32, r: 26, fill: 'url(#glowBlue)', opacity: 0.6 }],
      ['path', { d: 'M28.5 11.8 L29.3 7.2 L34.7 7.2 L35.5 11.8 L38.3 12.5 L41.1 13.6 L44.4 10.3 L48.8 13.5 L46.7 17.7 L48.6 20 L50.1 22.5 L54.8 21.7 L56.5 26.9 L52.3 29.1 L52.5 32 L52.3 34.9 L56.5 37.1 L54.8 42.3 L50.1 41.5 L48.6 44 L46.7 46.3 L48.8 50.5 L44.4 53.7 L41.1 50.4 L38.3 51.5 L35.5 52.2 L34.7 56.8 L29.3 56.8 L28.5 52.2 L25.7 51.5 L22.9 50.4 L19.6 53.7 L15.2 50.5 L17.3 46.3 L15.4 44 L13.9 41.5 L9.2 42.3 L7.5 37.1 L11.7 34.9 L11.5 32 L11.7 29.1 L7.5 26.9 L9.2 21.7 L13.9 22.5 L15.4 20 L17.3 17.7 L15.2 13.5 L19.6 10.3 L22.9 13.6 L25.7 12.5 Z',
        fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M9.6 22.2 L13.9 22.5 L15.4 20 L17.3 17.7 L15.2 13.5 L19.6 10.3 L22.9 13.6 L25.7 12.5 L28.5 11.8 L29.3 7.2 L34.7 7.2', stroke: '#fff0c0', 'stroke-width': 0.8, fill: 'none', opacity: 0.6 }],
      ['circle', { cx: 32, cy: 32, r: 16.4, fill: 'none', stroke: '#2a1806', 'stroke-width': 1 }],
      ['circle', { cx: 32, cy: 32, r: 15.2, fill: 'url(#brassDeep)', stroke: '#140a02', 'stroke-width': 0.9 }],
      ['circle', { cx: 32, cy: 32, r: 15.2, fill: 'none', stroke: '#f3d78a', 'stroke-width': 0.5, opacity: 0.5, 'stroke-dasharray': '22 74' }],
      ['circle', { cx: 32, cy: 19.4, r: 0.9, fill: '#fff0c0' }], ['circle', { cx: 44.6, cy: 32, r: 0.9, fill: '#c9963a' }], ['circle', { cx: 32, cy: 44.6, r: 0.9, fill: '#c9963a' }], ['circle', { cx: 19.4, cy: 32, r: 0.9, fill: '#fff0c0' }],
      ['circle', { cx: 23.1, cy: 23.1, r: 0.9, fill: '#fff0c0' }], ['circle', { cx: 40.9, cy: 23.1, r: 0.9, fill: '#f3d78a' }], ['circle', { cx: 40.9, cy: 40.9, r: 0.9, fill: '#a8751b' }], ['circle', { cx: 23.1, cy: 40.9, r: 0.9, fill: '#f3d78a' }],
      ['circle', { cx: 32, cy: 32.4, r: 11, fill: 'url(#glowBlue)' }],
      ['path', { d: 'M32 42 L23.6 33.6 Q20 29.6 23 26 Q26.6 22.8 30 25.6 L32 27.6 L34 25.6 Q37.4 22.8 41 26 Q44 29.6 40.4 33.6 Z', fill: '#2a8ad0', stroke: '#06223a', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M32 42 L23.6 33.6 Q20 29.6 23 26 Q26.6 22.8 30 25.6 L32 27.6 Z', fill: '#7fe0ff' }],
      ['path', { d: 'M32 27.6 L32 42 L28 33 Z', fill: '#c8f8ff', opacity: 0.8 }],
      ['path', { d: 'M32 42 L40.4 33.6 Q42 31.6 41.6 29.6 L34.6 33.6 Z', fill: '#155a94', opacity: 0.8 }],
      ['path', { d: 'M24.6 28.6 Q26 25.8 28.8 26.4', stroke: '#ffffff', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }],
    ],
  }),
  numidium: Object.freeze({   // the Brass God standing in its own light, horned, arms at its sides, its heart and eyes lit
    field: ['#4a3812', '#0e0a03'],
    bezel: 'brass',
    shapes: [
      ['path', { d: 'M32 24 L20 5 L25 4 Z M32 24 L44 5 L39 4 Z M32 24 L6 17 L8 13 Z M32 24 L58 17 L56 13 Z M32 24 L3 30 L3.4 25 Z M32 24 L61 30 L60.6 25 Z', fill: '#fff2a8', opacity: 0.1 }],
      ['circle', { cx: 32, cy: 24, r: 22, fill: 'url(#forge)', opacity: 0.9 }],
      ['circle', { cx: 32, cy: 24, r: 14, fill: 'none', stroke: '#f3d78a', 'stroke-width': 0.8, opacity: 0.45 }],
      ['ellipse', { cx: 32, cy: 58.4, rx: 15, ry: 2.4, fill: '#050302', opacity: 0.65 }],
      ['path', { d: 'M23.6 18.4 L18.4 21 L15.6 34 L17 43.6 L19.6 43.6 L19.8 34.6 L22.4 25 Z M40.4 18.4 L45.6 21 L48.4 34 L47 43.6 L44.4 43.6 L44.2 34.6 L41.6 25 Z', fill: 'url(#brassV)', stroke: '#2a1806', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M15.4 43 L21 43 L20.4 47.4 L16 47.4 Z M43 43 L48.6 43 L48 47.4 L43.6 47.4 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['path', { d: 'M27.4 13 L36.6 13 L41.6 17.4 L42 27 L39.6 37.6 L24.4 37.6 L22 27 L22.4 17.4 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M24.6 37 L39.4 37 L40.6 42.4 L23.4 42.4 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 1 }],
      ['path', { d: 'M24.4 42.2 L30.6 42.2 L30 56.6 L25.6 56.6 Z M33.4 42.2 L39.6 42.2 L38.4 56.6 L34 56.6 Z', fill: 'url(#brassV)', stroke: '#2a1806', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M24.8 48.4 L30.4 48.4 L30.2 51 L25.2 51 Z M33.6 48.4 L39.2 48.4 L38.8 51 L33.8 51 Z', fill: '#f3d78a', stroke: '#2a1806', 'stroke-width': 0.7 }],
      ['path', { d: 'M24 56.4 L31.2 56.4 L31.4 58.4 L23.4 58.4 Z M32.8 56.4 L40 56.4 L40.6 58.4 L32.6 58.4 Z', fill: 'url(#brassDeep)', stroke: '#2a1806', 'stroke-width': 0.8 }],
      ['path', { d: 'M33.6 13.4 L36.6 13 L41.6 17.4 L42 27 L39.6 37.6 L34 37.6 Q37.4 25 33.6 13.4 Z', fill: '#140a02', opacity: 0.3 }],
      ['path', { d: 'M23 19 L41 19 M22.6 30.4 L41.4 30.4', stroke: '#2a1806', 'stroke-width': 0.9 }],
      ['path', { d: 'M23.4 17.8 L22.6 27 L24.8 36.8 M19 21.6 L16.4 33.6', stroke: '#fff0c0', 'stroke-width': 0.8, fill: 'none', opacity: 0.65 }],
      ['path', { d: 'M29 13.2 L29 7.4 Q29 5.4 32 5.4 Q35 5.4 35 7.4 L35 13.2 Z', fill: 'url(#brass)', stroke: '#2a1806', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M29.2 7 L25.6 2 L29.6 5.2 Z M34.8 7 L38.4 2 L34.4 5.2 Z', fill: '#f3d78a', stroke: '#2a1806', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }],
      ['path', { d: 'M29.8 8.6 L34.2 8.6 L34.2 10.4 L29.8 10.4 Z', fill: '#080503' }],
      ['circle', { cx: 31, cy: 9.5, r: 0.8, fill: '#9ff9fc' }], ['circle', { cx: 33, cy: 9.5, r: 0.8, fill: '#9ff9fc' }],
      ['circle', { cx: 32, cy: 24.6, r: 6.4, fill: 'url(#glowBlue)' }],
      ['circle', { cx: 32, cy: 24.6, r: 3.2, fill: 'url(#aether)', stroke: '#06223a', 'stroke-width': 0.6 }],
      ['circle', { cx: 31.2, cy: 23.8, r: 0.8, fill: '#ffffff' }],
      ['circle', { cx: 24.6, cy: 21.6, r: 0.7, fill: '#fff0c0' }], ['circle', { cx: 39.4, cy: 21.6, r: 0.7, fill: '#c9963a' }], ['circle', { cx: 25.6, cy: 33.6, r: 0.7, fill: '#fff0c0' }], ['circle', { cx: 38.4, cy: 33.6, r: 0.7, fill: '#c9963a' }],
    ],
  }),
});

/** AUDIT-STOREFRONT: THE PAINTS a drawing names (`url(#brass)`), each laid in its own SVG once it is named: brass lit from
 *  above left (its plain, upright, top-face and deep shades, and a ball's), aetherium's light and its glow, a forge's
 *  warmth and a puff of steam. `[type, attrs, [[offset, colour, opacity?], ...]]`. */
export const ICON_MATERIALS = Object.freeze({
  brass: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff0c0'], [0.2, '#f3d78a'], [0.48, '#c9963a'], [0.8, '#7a5420'], [1, '#3a2408']]],
  brassV: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#7a5420'], [0.3, '#f3d78a'], [0.55, '#c9963a'], [1, '#5a3a12']]],
  brassTop: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff7d6'], [0.5, '#f0cf7a'], [1, '#c9963a']]],
  brassDeep: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#c9963a'], [0.5, '#8a5f1f'], [1, '#3a2408']]],
  brassBall: ['radialGradient', { cx: '36%', cy: '30%', r: '72%' }, [[0, '#fff7d6'], [0.22, '#f0cf7a'], [0.55, '#c9963a'], [0.85, '#7a5420'], [1, '#3a2408']]],
  aether: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffffff'], [0.3, '#9ff9fc'], [0.75, '#3fb8ff'], [1, '#1a6aa8']]],
  glowBlue: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#3fb8ff', 0.6], [0.5, '#3fb8ff', 0.22], [1, '#3fb8ff', 0]]],
  forge: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffd27a', 0.42], [0.55, '#e89a3a', 0.14], [1, '#e89a3a', 0]]],
  steam: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#f2f7fa', 0.7], [1, '#f2f7fa', 0]]],
  // the festival's: bone and tallow by candlelight, the moons, a witch's iron and brew, a baked cake on pewter
  bone: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fffaf0'], [0.4, '#e8e0c8'], [0.8, '#b8a888'], [1, '#7a6a50']]],
  wax: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#d8c898'], [0.35, '#fff6d8'], [1, '#c8b480']]],
  flame: ['radialGradient', { cx: '50%', cy: '60%', r: '50%' }, [[0, '#fff2a8', 0.9], [0.5, '#ff9a3c', 0.45], [1, '#ff7a1a', 0]]],
  candle: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffcf5a', 0.32], [1, '#ffcf5a', 0]]],
  masser: ['radialGradient', { cx: '38%', cy: '34%', r: '70%' }, [[0, '#ffb48a'], [0.3, '#e0663a'], [0.75, '#a63c20'], [1, '#4a1408']]],
  masserGlow: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0.7, '#ff7a4a', 0.28], [1, '#ff7a4a', 0]]],
  silver: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#ffffff'], [0.5, '#dfe6f0'], [1, '#8a94a8']]],
  secundaGlow: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0.5, '#cfd8ff', 0.3], [1, '#cfd8ff', 0]]],
  ironPot: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#3a3840'], [0.25, '#5a5864'], [0.5, '#1c1a1e'], [1, '#08070a']]],
  brew: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#e8ffc8'], [0.4, '#9be86a'], [1, '#3a8a1a']]],
  brewGlow: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#7dd654', 0.4], [0.6, '#7dd654', 0.12], [1, '#7dd654', 0]]],
  embers: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffcf5a', 0.9], [0.5, '#ff6a14', 0.55], [1, '#a62a0a', 0]]],
  bread: ['radialGradient', { cx: '42%', cy: '24%', r: '78%' }, [[0, '#f2c27a'], [0.35, '#d8954a'], [0.75, '#a8622a'], [1, '#6a3a14']]],
  pewter: ['linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#d8d2c8'], [0.5, '#a8a298'], [1, '#5a5650']]],
  hearth: ['radialGradient', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#ffb45a', 0.32], [1, '#ffb45a', 0]]],
  iron: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#c8ccd8'], [0.3, '#7a7e8c'], [0.6, '#3a3c46'], [1, '#141418']]],
});
/** The bezels a drawing sits in: `brass` the Rourken's, riveted at its quarters; `iron` the festival's, studded. */
const BEZEL = Object.freeze({
  brass: [
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#140a02', 'stroke-width': 3.6 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: 'url(#brass)', 'stroke-width': 2.4 }],
    ['circle', { cx: 32, cy: 32, r: 28.4, fill: 'none', stroke: '#2a1806', 'stroke-width': 0.6 }],
    ...[[32, 2], [62, 32], [32, 62], [2, 32]].flatMap(([x, y]) => [['circle', { cx: x, cy: y, r: 1.5, fill: '#2a1806' }], ['circle', { cx: x - 0.3, cy: y - 0.3, r: 0.8, fill: '#fff0c0' }]]),
  ],
  iron: [
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#050508', 'stroke-width': 3.6 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: 'url(#iron)', 'stroke-width': 2.4 }],
    ['circle', { cx: 32, cy: 32, r: 28.4, fill: 'none', stroke: '#141418', 'stroke-width': 0.6 }],
    ...[[10.8, 10.8], [53.2, 10.8], [53.2, 53.2], [10.8, 53.2]].flatMap(([x, y]) => [['circle', { cx: x, cy: y, r: 1.4, fill: '#141418' }], ['circle', { cx: x - 0.3, cy: y - 0.3, r: 0.7, fill: '#d8dce6' }]]),
  ],
});

let _gradientId = 0;
/**
 * AN ICON'S DRAWING, as an `<svg>` element `size` px square in `doc` (classed `cls`): its round field in its two
 * colours, its shapes clipped to it, and its rim - a gold line, or (AUDIT-STOREFRONT) its bezel. The paints a shape
 * names are laid in its own `<defs>`, their ids its own. Null for a key with no drawing or a document that cannot make SVG.
 * @param {any} doc @param {unknown} key @param {string} [cls] @param {number} [size]
 */
export function profileIconNode(doc, key, cls = 'px-icon', size = 64) {
  const art = /** @type {any} */ (typeof key === 'string' && Object.hasOwn(ICON_ART, key) ? ICON_ART[/** @type {keyof typeof ICON_ART} */ (key)] : null);
  if (!art || typeof doc?.createElementNS !== 'function') return null;
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}) => {
    const n = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const svg = node('svg', { viewBox: '0 0 64 64', width: size, height: size, class: cls, role: 'img', 'aria-label': ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (key)] });
  const id = `pxicon-${key}-${++_gradientId}`;
  const own = (/** @type {unknown} */ v) => (typeof v === 'string' ? v.replace(/url\(#(\w+)\)/g, (_, m) => `url(#${id}-${m})`) : v);
  const defs = node('defs');
  const grad = node('radialGradient', { id, cx: '50%', cy: '42%', r: '60%' });
  grad.append(node('stop', { offset: '0%', 'stop-color': art.field[0] }), node('stop', { offset: '100%', 'stop-color': art.field[1] }));
  defs.append(grad);
  const rim = art.bezel ? BEZEL[/** @type {keyof typeof BEZEL} */ (art.bezel)] : [];
  const named = new Set([...art.shapes, ...rim].flatMap(([, a]) => Object.values(a)).join(' ').match(/url\(#\w+\)/g) ?? []);
  for (const u of named) {
    const m = u.slice(5, -1), mat = /** @type {any} */ (ICON_MATERIALS)[m];
    if (!mat) continue;
    const g = node(mat[0], { id: `${id}-${m}`, ...mat[1] });
    for (const [o, c, a = 1] of mat[2]) g.append(node('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }));
    defs.append(g);
  }
  const clip = node('clipPath', { id: `${id}-clip` });
  clip.append(node('circle', { cx: 32, cy: 32, r: 31 }));
  defs.append(clip);
  const pic = node('g', { 'clip-path': `url(#${id}-clip)` });
  for (const [tag, attrs] of art.shapes) pic.append(node(/** @type {string} */ (tag), Object.fromEntries(Object.entries(/** @type {Record<string, any>} */ (attrs)).map(([k, v]) => [k, own(v)]))));
  svg.append(defs, node('circle', { cx: 32, cy: 32, r: 31, fill: `url(#${id})`, stroke: art.bezel ? 'none' : '#c9a55a', 'stroke-width': 1.5 }), pic);
  for (const [tag, attrs] of rim) svg.append(node(/** @type {string} */ (tag), Object.fromEntries(Object.entries(/** @type {Record<string, any>} */ (attrs)).map(([k, v]) => [k, own(v)]))));
  return svg;
}
