// @ts-check
// FONT3 (2026-10-02, Mac: "we need to ensure everything recieves our enhanced font"): A CANVAS DRAW LIST'S WORDS, IN
// THE ENHANCED FACE.
//
// Some windows hand the host a list of draws in the canvas's own pixels - a picture here, a line of text there - and
// the host drew every text with the 1996 bitmap font on both skins. Come Sail Away's position reading (its help lines,
// the marker colour, a marker's label under the mouse) was the one such window a player reaches under the enhanced
// skin. This is the enhanced arm of those texts: one fixed, click-through layer per id, a node per line kept and
// MOVED (never rebuilt), each at the bitmap line's own top-left in CSS pixels, its colour and its one hard shadow step
// carried over. The pictures stay on the canvas; only the words change face.
//
// A DOM line stays painted until it is told (AUDIT 64 F37's law), so the window that draws through here hides its
// layer when it goes - `hideEnhancedTextLayer(id)` in its dispose.
import { PIXEL_FONT_CSS, PIXELIFY_FIVE_FACE } from '../pixelifyFive.js';
import { injectEnhancedFonts } from './enhancedStyle.js';

const STYLE_ID = 'dagger-enhanced-textlayer-style';
/** The layer's own sheet: carries the five's face, because a host may mount this on a document without the skin's. */
export const TEXT_LAYER_CSS = `${PIXELIFY_FIVE_FACE}
.etl-layer { position: fixed; inset: 0; pointer-events: none; z-index: 6; ${PIXEL_FONT_CSS} }
.etl-line { position: absolute; left: 0; top: 0; white-space: pre; line-height: 1; }`;

/** The bitmap line's cell is the font's fixed height times its scale; the pixel face is set a tenth under it, so a
 *  line set at DFU's spacing (Come Sail Away's help lines stand 20 px apart at scale 3 over a 7 px cell) keeps clear
 *  of the next one. */
export const TEXT_LAYER_FIT = 0.9;

/** @type {Map<string, { root: any, nodes: any[], doc: any }>} */
const layers = new Map();

const css = (c) => `rgba(${Math.round((c?.[0] ?? 1) * 255)}, ${Math.round((c?.[1] ?? 1) * 255)}, ${Math.round((c?.[2] ?? 1) * 255)}, ${c?.[3] ?? 1})`;

/**
 * Draw `items` on the layer `id`. Each item: { text, x, y, cell } in the canvas's device pixels (x, y the bitmap
 * line's top-left, `cell` its height - fixedHeight x scale), `color` and `shadow` as [r, g, b, a] in 0..1, and
 * `shadowPos` [dx, dy] in device pixels. Lines beyond the list are hidden, not removed.
 */
export function drawEnhancedTextLayer(id, items, canvas, doc = (typeof document === 'undefined' ? null : document)) {
  if (!doc) return null;
  let layer = layers.get(id);
  if (layer && layer.doc !== doc) { layer.root.remove?.(); layer = null; }   // AUDIT FONT3 F5: a layer belongs to the document it was built in
  if (!layer) {
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = TEXT_LAYER_CSS;
      doc.head.append(style);
    }
    injectEnhancedFonts(doc);
    const root = doc.createElement('div');
    root.className = 'etl-layer';
    root.id = id;
    root.setAttribute('aria-hidden', 'true');
    doc.body.append(root);
    layer = { root, nodes: [], doc };
    layers.set(id, layer);
  }
  const dpr = canvas?.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  layer.root.style.display = '';
  items.forEach((it, i) => {
    let n = layer.nodes[i];
    if (!n) { n = doc.createElement('div'); n.className = 'etl-line'; layer.root.append(n); layer.nodes[i] = n; }
    if (n.textContent !== it.text) n.textContent = it.text;
    const sx = (it.shadowPos?.[0] ?? 0) / dpr, sy = (it.shadowPos?.[1] ?? 0) / dpr;
    n.style.cssText = `transform: translate(${(it.x / dpr).toFixed(1)}px, ${(it.y / dpr).toFixed(1)}px);`
      + `font-size: ${((it.cell * TEXT_LAYER_FIT) / dpr).toFixed(1)}px; color: ${css(it.color)};`
      + (sx || sy ? `text-shadow: ${sx.toFixed(1)}px ${sy.toFixed(1)}px 0 ${css(it.shadow)};` : '');
  });
  for (let i = items.length; i < layer.nodes.length; i++) layer.nodes[i].style.display = 'none';
  return layer.root;
}

/** Take the layer `id` down (its window went). Safe off a document and on a layer never drawn. */
export function hideEnhancedTextLayer(id) {
  const layer = layers.get(id);
  if (layer && layer.root.style.display !== 'none') layer.root.style.display = 'none';   // AUDIT FONT3 F1: called every frame by a host's guard
}
