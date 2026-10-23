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

const SVG_NS = 'http://www.w3.org/2000/svg';

/** An icon's word, as a player reads it (the wardrobe's button, the window's row). */
export const ICON_TEXT = Object.freeze({
  tallowskull: 'Tallow Skull',
  twinmoons: 'Twin Moons',
  wyrdcauldron: 'Wyrd Cauldron',
  soulcake: 'Soul Cake',
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
