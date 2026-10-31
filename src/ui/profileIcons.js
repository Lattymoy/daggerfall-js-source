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

import { shieldSvg } from './heraldryArt.js';
import { t } from '../systems/textManager.js';   // STOREFRONT: the season's portraits' words, in the player's language; GUILD-SHOP: the Guild Crest wears its wearer's guild's arms
import { ownGuildArms, guildLogoSrc } from '../net/guild/guildArmsBook.js';
import { SEASON_ICON_ART } from './icons/seasonIconArt.js';   // STOREFRONT: Season One's
import { DAILY_ICON_ART } from './icons/dailyIconArt.js';   // AURUM: the daily wares'

const SVG_NS = 'http://www.w3.org/2000/svg';

/** An icon's word, as a player reads it (the wardrobe's button, the window's row). */
export const ICON_TEXT = Object.freeze({
  tallowskull: 'Tallow Skull',
  twinmoons: 'Twin Moons',
  wyrdcauldron: 'Wyrd Cauldron',
  soulcake: 'Soul Cake',
  // STOREFRONT (2026-10-29, bible/06-Systems/Battle-Pass.md section 3): Season One's three, read through the text core
  get aetherium() { return t('account.icon.aetherium', 'Aetherium Shard'); },
  get lexicon() { return t('account.icon.lexicon', 'Dwemer Lexicon'); },
  get gearheart() { return t('account.icon.gearheart', 'Gearheart'); },
  // AURUM (bible/06-Systems/Aurum.md): the daily wares' eight
  get gatefire() { return t('account.icon.gatefire', 'Gate of Flame'); },
  get aurbis() { return t('account.icon.aurbis', 'The Aurbis'); },
  get elderscroll() { return t('account.icon.elderscroll', 'Elder Scroll'); },
  get azurastar() { return t('account.icon.azurastar', "Azura's Star"); },
  get redmountain() { return t('account.icon.redmountain', 'Red Mountain'); },
  get hourglass() { return t('account.icon.hourglass', 'Turning Hourglass'); },
  get sanguinerose() { return t('account.icon.sanguinerose', 'Sanguine Rose'); },
  get whitegold() { return t('account.icon.whitegold', 'White-Gold Tower'); },
  get guildcrest() { return t('profile.icon.guildcrest', 'Guild Crest'); },   // GUILD-SHOP
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
  // STOREFRONT: Season One's three (ui/icons/seasonIconArt.js); AURUM: the daily wares' eight (ui/icons/dailyIconArt.js)
  ...SEASON_ICON_ART,
  ...DAILY_ICON_ART,
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
  // AURUM: the daily wares' rims - gold, black glass, silver
  goldRim: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#fff6d0'], [0.22, '#f2cf6a'], [0.5, '#a8771e'], [0.74, '#f0c860'], [1, '#5a3a0c']]],
  obsidianRim: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#6a5664'], [0.25, '#2a1c24'], [0.55, '#0c0709'], [0.8, '#3a2228'], [1, '#050304']]],
  silverRim: ['linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, '#ffffff'], [0.3, '#cfd6e2'], [0.55, '#6e7888'], [0.8, '#e2e8f2'], [1, '#4a5262']]],
});
/** A rim's four marks at its quarters (or, `diag`, between them). */
const quarters = (/** @type {(x: number, y: number) => any[]} */ mark, diag = false) => (diag ? [[10.8, 10.8], [53.2, 10.8], [53.2, 53.2], [10.8, 53.2]] : [[32, 2], [62, 32], [32, 62], [2, 32]]).flatMap(([x, y]) => mark(x, y));
/** The bezels a drawing sits in: `brass` the Rourken's, riveted at its quarters; `iron` the festival's, studded. AURUM:
 *  `gold`, beaded with a lozenge at each quarter; `obsidian`, black glass with embers in its cracks; `silver`, starred. */
const BEZEL = Object.freeze({
  gold: [
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#1a0f02', 'stroke-width': 3.8 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: 'url(#goldRim)', 'stroke-width': 2.6 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#fff6d0', 'stroke-width': 0.7, 'stroke-dasharray': '0.7 2.3', 'stroke-linecap': 'round', opacity: 0.85 }],
    ['circle', { cx: 32, cy: 32, r: 28.3, fill: 'none', stroke: '#3a2404', 'stroke-width': 0.6 }],
    ...quarters((x, y) => [['path', { d: `M${x} ${y - 2.4} L${x + 2.4} ${y} L${x} ${y + 2.4} L${x - 2.4} ${y} Z`, fill: 'url(#goldRim)', stroke: '#1a0f02', 'stroke-width': 0.7 }], ['circle', { cx: x - 0.4, cy: y - 0.4, r: 0.6, fill: '#fffbe6' }]]),
  ],
  obsidian: [
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#000000', 'stroke-width': 3.8 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: 'url(#obsidianRim)', 'stroke-width': 2.6 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#ff6a1a', 'stroke-width': 0.55, 'stroke-dasharray': '1.4 9 0.8 13', opacity: 0.8 }],
    ['circle', { cx: 32, cy: 32, r: 28.3, fill: 'none', stroke: '#3a0c06', 'stroke-width': 0.6 }],
    ...quarters((x, y) => [['circle', { cx: x, cy: y, r: 1.5, fill: '#0a0304', stroke: '#2a1418', 'stroke-width': 0.5 }], ['circle', { cx: x, cy: y, r: 0.7, fill: '#ff6a1a' }]]),
  ],
  silver: [
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: '#0a0c14', 'stroke-width': 3.8 }],
    ['circle', { cx: 32, cy: 32, r: 30, fill: 'none', stroke: 'url(#silverRim)', 'stroke-width': 2.6 }],
    ['circle', { cx: 32, cy: 32, r: 28.3, fill: 'none', stroke: '#1c2232', 'stroke-width': 0.6 }],
    ...quarters((x, y) => [['path', { d: `M${x} ${y - 2.6} L${x + 0.7} ${y - 0.7} L${x + 2.6} ${y} L${x + 0.7} ${y + 0.7} L${x} ${y + 2.6} L${x - 0.7} ${y + 0.7} L${x - 2.6} ${y} L${x - 0.7} ${y - 0.7} Z`, fill: '#ffffff', stroke: '#2a3244', 'stroke-width': 0.5 }]]),
  ],
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
/** AURUM: the shapes a still drawing leaves out - every animation, under prefers-reduced-motion or a caller's `still`. A
 *  drawing's own attributes are its still frame. */
const MOTION = new Set(['animate', 'animateTransform', 'animateMotion', 'set']);
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
/** Whether a paint is a gradient's `[type, attrs, stops]` (each stop `[offset, colour, opacity?]`) rather than a node's. */
const isStops = (/** @type {any} */ m) => Array.isArray(m[2]) && m[2].every((/** @type {any} */ x) => typeof x[0] === 'number');
/** The paints a list of shapes names (`url(#name)`), its children's too. */
const namedIn = (/** @type {any[]} */ shapes) => shapes.flatMap((/** @type {any} */ [, a = {}, kids = []]) => [...JSON.stringify(a).matchAll(/url\(#(\w+)\)/g)].map((m) => m[1]).concat(namedIn(kids)));
/**
 * AN ICON'S DRAWING, as an `<svg>` element `size` px square in `doc` (classed `cls`): its round field in its two
 * colours, its shapes clipped to it, and its rim - a gold line, or (AUDIT-STOREFRONT) its bezel. A shape is `[tag, attrs,
 * children?]`; AURUM: its children may animate it, left out for a still drawing (`still`, by default the player's
 * reduced motion). The paints a shape names, the drawing's own (`defs`) before the shared, are laid in its own `<defs>`
 * with its ids. Null for a key with no drawing or a document that cannot make SVG.
 * @param {any} doc @param {unknown} key @param {string} [cls] @param {number} [size] @param {{ still?: boolean, arms?: any }} [o]
 */
export function profileIconNode(doc, key, cls = 'px-icon', size = 64, { still = reducedMotion(), arms = undefined } = {}) {
  if (key === 'guildcrest') return guildCrestIcon(doc, cls, size, arms === undefined ? ownGuildArms() : arms);   // GUILD-SHOP
  const art = /** @type {any} */ (typeof key === 'string' && Object.hasOwn(ICON_ART, key) ? ICON_ART[/** @type {keyof typeof ICON_ART} */ (key)] : null);
  return art ? drawnIconNode(doc, art, { key: `pxicon-${key}`, label: ICON_TEXT[/** @type {keyof typeof ICON_TEXT} */ (key)], cls, size, still }) : null;
}
/**
 * THE ENGINE THE ICONS ARE DRAWN BY, one for every round picture in a bezel - the profile icons and (AUDIT-STOREFRONT II,
 * the owner: "the general art of those icons is so bad") the effects' emblems (ui/effectEmblems.js): `art` a drawing
 * (`{ field, bezel?, defs?, shapes }`), `key` its ids' stem, `label` its name for a screen reader.
 * `inner` a node of the caller's own laid over the picture (a glyph's mark in its medallion).
 * @param {any} doc @param {any} art @param {{ key: string, label?: string, cls?: string, size?: number, still?: boolean, inner?: any }} o
 */
export function drawnIconNode(doc, art, { key, label = '', cls = 'px-icon', size = 64, still = reducedMotion(), inner = null }) {
  if (!art || typeof doc?.createElementNS !== 'function') return null;
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}) => {
    const n = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const svg = node('svg', { viewBox: '0 0 64 64', width: size, height: size, class: cls, role: 'img', 'aria-label': label });
  const id = `${key.replace(/[^\w-]/g, '-')}-${++_gradientId}`;
  const own = (/** @type {string} */ k, /** @type {unknown} */ v) => {
    if (typeof v !== 'string') return v;
    if (k === 'id') return `${id}-${v}`;
    if (k === 'href' && v[0] === '#') return `#${id}-${v.slice(1)}`;
    return v.replace(/url\(#(\w+)\)/g, (_, m) => `url(#${id}-${m})`);
  };
  /** @returns {any} */
  const build = (/** @type {any} */ [tag, attrs = {}, kids = []]) => {
    if (still && MOTION.has(tag)) return null;
    const n = node(tag, Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, own(k, v)])));
    for (const k of kids) { const c = build(k); if (c) n.append(c); }
    return n;
  };
  const defs = node('defs');
  const grad = node('radialGradient', { id, cx: '50%', cy: '42%', r: '60%' });
  grad.append(node('stop', { offset: '0%', 'stop-color': art.field[0] }), node('stop', { offset: '100%', 'stop-color': art.field[1] }));
  defs.append(grad);
  const rim = art.bezel ? BEZEL[/** @type {keyof typeof BEZEL} */ (art.bezel)] : [];
  const mats = { ...ICON_MATERIALS, ...(art.defs ?? {}) };
  const laid = new Set(), todo = namedIn([...art.shapes, ...rim]);
  while (todo.length) {
    const m = /** @type {string} */ (todo.pop()), mat = /** @type {any} */ (mats)[m];
    if (!mat || laid.has(m)) continue;
    laid.add(m);
    if (isStops(mat)) {
      const g = node(mat[0], { id: `${id}-${m}`, ...mat[1] });
      for (const [o, c, a = 1] of mat[2]) g.append(node('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }));
      defs.append(g);
    } else {
      defs.append(build([mat[0], { ...mat[1], id: m }, mat[2] ?? []]));
      todo.push(...namedIn(mat[2] ?? []));   // a filter or a pattern naming a paint of its own
    }
  }
  const clip = node('clipPath', { id: `${id}-clip` });
  clip.append(node('circle', { cx: 32, cy: 32, r: 31 }));
  defs.append(clip);
  const pic = node('g', { 'clip-path': `url(#${id}-clip)` });
  for (const sh of art.shapes) { const c = build(sh); if (c) pic.append(c); }
  if (inner) pic.append(inner);
  svg.append(defs, node('circle', { cx: 32, cy: 32, r: 31, fill: `url(#${id})`, stroke: art.bezel ? 'none' : '#c9a55a', 'stroke-width': 1.5 }), pic);
  for (const sh of rim) { const c = build(sh); if (c) svg.append(c); }
  return svg;
}

/** GUILD-SHOP: A SHIELD'S OUTLINE for arms not known yet (or none): Ash on the dark field. */
const PLAIN_SHIELD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104"><path d="M8 4 H92 V46 C92 74 74 92 50 102 C26 92 8 74 8 46 Z" fill="#e6e6e6" stroke="#8a8a8a" stroke-width="10"/></svg>';
/**
 * GUILD-SHOP: THE GUILD CREST - the wearer's guild's arms in the portrait well: a round field of deep blue rimmed in gold,
 * the arms' shield on it (heraldryArt.js shieldSvg), or the guild's approved logo in a gilt ring. `arms` - `{ heraldry,
 * logo }`, the wearer's guild's (net/guild/guildArmsBook.js), or null for a plain shield. Null where SVG cannot be made.
 * @param {any} doc @param {string} cls @param {number} size @param {any} arms
 */
export function guildCrestIcon(doc, cls, size, arms) {
  if (typeof doc?.createElementNS !== 'function') return null;
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}) => {
    const n = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  const svg = node('svg', { viewBox: '0 0 64 64', width: size, height: size, class: cls, role: 'img', 'aria-label': ICON_TEXT.guildcrest });
  const id = `pxicon-guildcrest-${++_gradientId}`;
  const defs = node('defs');
  const grad = node('radialGradient', { id, cx: '50%', cy: '42%', r: '60%' });
  grad.append(node('stop', { offset: '0%', 'stop-color': '#2a3a6a' }), node('stop', { offset: '100%', 'stop-color': '#0a0f22' }));
  const clip = node('clipPath', { id: `${id}c` });
  clip.append(node('circle', { cx: 32, cy: 32, r: 20 }));
  defs.append(grad, clip);
  svg.append(defs, node('circle', { cx: 32, cy: 32, r: 31, fill: `url(#${id})`, stroke: '#c9a55a', 'stroke-width': 1.5 }));
  const logo = typeof arms?.logo === 'string' ? guildLogoSrc(arms.logo) : null;
  if (logo) {
    svg.append(node('circle', { cx: 32, cy: 32, r: 22, fill: '#1a1408', stroke: '#e0b84e', 'stroke-width': 2.5 }));
    svg.append(node('image', { href: logo, x: 12, y: 12, width: 40, height: 40, 'clip-path': `url(#${id}c)`, preserveAspectRatio: 'xMidYMid slice' }));
    return svg;
  }
  const shield = shieldSvg(arms?.heraldry, { size: 40 }) || PLAIN_SHIELD;
  svg.append(node('image', { href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shield)}`, x: 12, y: 10, width: 40, height: 42 }));
  return svg;
}
