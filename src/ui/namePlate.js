// @ts-check
// PROFILE-SLOTS (2026-10-28; bible/04-Characters/Aura-Armory.md section 10) - ONE LABEL OVER A HEAD, STILL: the plate the
// world's name layer moves over every head each frame (ui/nameLayer.js - its elements, its classes and so its sheet), built
// once for a stage that hangs a player's own over their figure (ui/characterSlots.js). The title above in its own paint,
// the Renown in its box, the name, the glyphs shown beside it. Light on purpose: the account card draws it, and the
// layer's own module brings the whole relay client. Its sheet is the layer's (nameLayer.js injectNameStyle). Not a DFU
// member.
import { titleBadge, glyphBadges, glyphSvgNode, titlePaint, TITLE_PAINT_KEYS } from './playerBadge.js';
import { setTitleFlame } from './titleFlame.js';
import { renownText } from '../net/renown.js';

/** The plate for `peer` - { title, glyphs, name, lv } as a token carries them - as nameLayer.js makeTag builds one and
 *  its render paints it, standing at the origin for its host to move (`translate(x, y) translate(-50%, -100%)`). */
export function namePlateNode(/** @type {Document} */ doc, /** @type {any} */ peer) {
  const el = (/** @type {string} */ tag, /** @type {string} */ cls, txt = '') => {
    const n = doc.createElement(tag);
    n.className = cls;
    if (txt) n.textContent = txt;
    return n;
  };
  const node = el('div', 'dfname dfname-still');
  const badge = titleBadge(peer);
  const title = el('div', 'dfname-title', badge?.text ?? '');
  if (badge && title.style) {
    const paint = /** @type {Record<string, string>} */ (titlePaint(badge));
    for (const k of TITLE_PAINT_KEYS) /** @type {any} */ (title.style)[k] = paint[k];
  }
  if (badge?.flame) setTitleFlame(title, badge.key);
  const tag = el('div', 'dfname-tag');
  tag.append(
    el('span', 'dfname-renown', renownText(peer?.lv) ?? ''),
    el('span', 'dfname-who', typeof peer?.name === 'string' ? peer.name : ''),
  );
  const glyphs = el('span', 'dfname-glyphs');
  for (const g of glyphBadges(peer)) {
    const svg = glyphSvgNode(doc, g, 'dfname-glyph', 1.6);
    if (svg) glyphs.append(svg);
  }
  tag.append(glyphs);
  node.append(title, tag);
  return node;
}
