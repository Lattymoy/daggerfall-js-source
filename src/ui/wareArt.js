// @ts-check
// AUDIT-STOREFRONT (2026-10-29, the owner: "exceptional design for all assets"; bible/06-Systems/Storefront.md section 9):
// A WARE'S PICTURE, one door for every face that shows one without playing it - a bundle's pieces and the Folios'
// items. A portrait its drawing (ui/profileIcons.js), a glyph its mark, an aura its ring (collections/wardrobePart.js),
// an effect its emblem (ui/effectEmblems.js); a title a ribbon in its own paint; Aurum its coins (ui/aurumArt.js).
// PASS-PANELS: no booster or pass is sold any more, so neither has a banner. Not a DFU member.
import { profileIconNode, drawnIconNode } from './profileIcons.js';
import { effectEmblemNode } from './effectEmblems.js';
import { glyphBadges, glyphSvgNode, cssRgba, AURA_PAINT, TITLE_RGBA, TITLE_GRADIENT } from './playerBadge.js';
import { auraRingNode } from './collections/wardrobePart.js';
import { armoryPieceOf } from '../net/armoryLaw.js';
import { aurumArtNode } from './aurumArt.js';   // AURUM: a pack's and a reward's picture

let _medal = 0;
/** A mark set in a medallion as the emblems and portraits are - a field lit in the mark's own colour, in the gold bezel
 *  (AUDIT-STOREFRONT II: the icons' engine, ui/profileIcons.js drawnIconNode) - so a glyph, an aura ring or a title's
 *  ribbon stands beside them as their equal. */
function medallion(/** @type {any} */ doc, /** @type {any} */ inner, /** @type {string} */ tint, /** @type {number} */ size, /** @type {string} */ cls, frame = [12, 12, 40, 40]) {
  for (const [k, v] of Object.entries({ x: frame[0], y: frame[1], width: frame[2], height: frame[3] })) inner.setAttribute(k, String(v));
  const art = { field: [tint, '#0b0a10'], bezel: 'gold', shapes: [['circle', { cx: 32, cy: 32, r: 31, fill: '#0b0a10', opacity: 0.45 }]] };
  return drawnIconNode(doc, art, { key: `ware-medal-${++_medal}`, cls, size, still: true, inner });
}

/** A title's ribbon - a banner with folded tails in its paint (TITLE_GRADIENT, else its one colour), a gold star on it. */
function ribbon(/** @type {any} */ doc, /** @type {string} */ key) {
  const NS = 'http://www.w3.org/2000/svg';
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs) => { const n = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
  const stops = /** @type {any[]} */ (TITLE_GRADIENT[/** @type {keyof typeof TITLE_GRADIENT} */ (key)] ?? [TITLE_RGBA[/** @type {keyof typeof TITLE_RGBA} */ (key)]]).map((c) => cssRgba(c) ?? '#c9a55a');
  const id = `ware-ribbon-${++_medal}`;
  const svg = node('svg', { viewBox: '0 0 40 40' });
  const defs = node('defs', {}), grad = node('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 });
  stops.forEach((c, i) => grad.append(node('stop', { offset: stops.length > 1 ? i / (stops.length - 1) : 0, 'stop-color': c })));
  defs.append(grad);
  svg.append(defs,
    node('path', { d: 'M8 17 L1 18.6 L4.4 22 L1 25.4 L8 27 Z M32 17 L39 18.6 L35.6 22 L39 25.4 L32 27 Z', fill: `url(#${id})`, stroke: '#1a1208', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
    node('path', { d: 'M8 17 L1 18.6 L4.4 22 L1 25.4 L8 27 Z M32 17 L39 18.6 L35.6 22 L39 25.4 L32 27 Z', fill: '#000000', opacity: 0.35 }),
    node('rect', { x: 5.5, y: 13.5, width: 29, height: 12, rx: 1.4, fill: `url(#${id})`, stroke: '#1a1208', 'stroke-width': 0.9 }),
    node('path', { d: 'M6.5 15 L33.5 15', stroke: '#ffffff', 'stroke-width': 0.8, opacity: 0.45 }),
    node('path', { d: 'M20 15.6 L21.4 18.6 L24.6 19 L22.2 21.1 L22.9 24.2 L20 22.6 L17.1 24.2 L17.8 21.1 L15.4 19 L18.6 18.6 Z', fill: '#f3d78a', stroke: '#4a3010', 'stroke-width': 0.5 }));
  return svg;
}

/**
 * A ware's or a reward's picture (`kind:key`), `size` px, classed `cls` - an `<svg>`, or null for one with none (a
 * bundle) or a document that cannot make SVG.
 * @param {any} doc @param {string} id @param {number} [size] @param {string} [cls]
 */
export function wareArtNode(doc, id, size = 48, cls = 'ware-art') {
  const i = typeof id === 'string' ? id.indexOf(':') : -1;
  if (i < 1) return null;
  const kind = id.slice(0, i), key = id.slice(i + 1);
  /** @type {any} */ let art = null;
  if (kind === 'icon') art = profileIconNode(doc, key, cls, size);
  else if (kind === 'kill' || kind === 'portal' || kind === 'mount') art = effectEmblemNode(doc, kind, key, cls, size);
  else if (kind === 'glyph') {
    const g = glyphBadges({ glyphs: [key] })[0], mark = g ? glyphSvgNode(doc, g, 'ware-mark', 1.8) : null;
    art = mark ? medallion(doc, mark, cssRgba(g.rgba) ?? '#c9a55a', size, cls) : null;
  } else if (kind === 'title') {
    const paint = /** @type {any} */ (TITLE_GRADIENT)[key]?.[0] ?? /** @type {any} */ (TITLE_RGBA)[key];
    art = typeof doc?.createElementNS === 'function' ? medallion(doc, ribbon(doc, key), cssRgba(paint) ?? '#c9a55a', size, cls, [8, 8, 48, 48]) : null;
  } else if (kind === 'aurum') art = aurumArtNode(doc, Number(key) || 0, size, cls);   // AURUM: a pack's
  else if (kind === 'aura' || kind === 'armory') {
    const aura = kind === 'armory' ? armoryPieceOf(key)?.line ?? 'eternal' : key, ring = auraRingNode(doc, aura, 40);
    const paint = AURA_PAINT[/** @type {keyof typeof AURA_PAINT} */ (aura)];
    art = ring ? medallion(doc, ring, cssRgba(TITLE_RGBA[/** @type {keyof typeof TITLE_RGBA} */ (paint)]) ?? '#c9a55a', size, cls, [8, 18, 48, 31]) : null;
  }
  art?.setAttribute('aria-hidden', 'true');
  return art;
}
