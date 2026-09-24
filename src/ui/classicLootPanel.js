// DISC22-C (2026-09-24, Satranath on Discord: "no hotbar or quickloot on grimoire either, i think i will stick with the
// enhanced ui"; Mac, with a parchment image: "The screenshot of the parchment is a spritesheet to be used for the loot
// menu (grimoire UI)") - QUICK LOOT ON THE CLASSIC SKINS.
//
// The quick-loot law (ui/worldPlaque.js worldHoverFrame -> systems/quickLoot.js) never had DOM in it; what kept it
// off the classic skins was the one gate over the whole resolve, because the plaque it drew on is the enhanced skin's
// DOM. The resolve now runs on both skins and this is the classic face of the same frame: a canvas panel beside the
// crosshair, drawn from drawHud like the rest of the classic HUD, listing the pile under the reticle with the lit row
// banded - the same wheel, the same P and J, the same take, because it is the same selection.
//
// Drawn only where there is a LOOT LIST and quick loot is on: DFU's classic HUD names nothing in the world (the
// enhanced skin's World Tooltips plaque is its own departure), so the classic face adds the one thing a player asked
// for - taking from a pile without the window - and nothing else.
//
// TWO FACES. Under the GrimoireUI pack it is Mac's parchment (public/art/grimoire-loot-parchment.png, 106 x 180): the
// title in the band above the first gold rule, the rows between the rules, the count below the second, and the sheet
// cut at the rules into three so it grows and shrinks with the rows - the body stretched, the curls and the rules
// kept whole. Without the pack it is DFU's own tooltip box (ToolTip.cs: the settings' ToolTipBackgroundColor and
// ToolTipTextColor, a bare DrawText), the classic HUD's only word-in-a-box.
import { APP_ROOT } from '../systems/appRoot.js';
import { NATIVE_W, NATIVE_H, drawImgCrop, drawRect } from './nativePanel.js';
import { drawText, measureText } from './text.js';
import { getString } from '../systems/settings.js';
import { parseHexColor, DEFAULT_TOOLTIP_TEXT_BG, DEFAULT_TOOLTIP_TEXT_FG, TOOLTIP_MARGIN } from './toolTip.js';
import { activeUiPack } from '../systems/uiPack.js';

/** Mac's sheet: its size, and the rows its two gold rules sit on (38 and 141, each with a shadow row beside it). */
export const PARCHMENT = Object.freeze({
  file: 'grimoire-loot-parchment.png',
  w: 106, h: 180,
  cutTop: 40,        // the first rule and its shadow stay with the top piece
  cutBottom: 140,    // the second rule's shadow and the rule go with the bottom piece
  titleY: 24,        // the band between the top curl and the first rule
  textX: 16, textW: 74,
  footY: 146,        // below the second rule, above the bottom curl
});
/** The ink on the parchment, and the band behind the lit row. */
export const PARCHMENT_INK = Object.freeze([0.23, 0.13, 0.05, 1]);
export const PARCHMENT_LIT = Object.freeze([0.42, 0.24, 0.08, 0.35]);
/** Where the panel stands: this far right of the screen's middle, on the native 320 x 200 (its row: lootPanelBounds). */
export const PANEL_OFFSET_X = 24;

export const lootPanelUrl = (root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`art/${PARCHMENT.file}`, root).href;

let _fetch = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
let _decode = null;
const _byRenderer = new WeakMap();   // renderer -> { state, img }

/** The parchment as `{ tex, w, h }` once it has loaded, or null (loading, failed, or no renderer to hold it). */
export function parchmentImage(renderer) {
  if (typeof renderer?.uploadTexture !== 'function') return null;
  let slot = _byRenderer.get(renderer);
  if (!slot) {
    slot = { state: 'loading', img: null };
    _byRenderer.set(renderer, slot);
    (async () => {
      const { toScreenOrder } = await import('../formats/color32Order.js');
      const decode = _decode ?? (await import('../systems/textureReplacement.js')).decodePng;
      const px = toScreenOrder(await decode(await _fetch(lootPanelUrl())));
      slot.img = { tex: renderer.uploadTexture('art', PARCHMENT.file, px, { alpha: true }), w: px.width, h: px.height };
      slot.state = 'ready';
    })().catch((e) => { slot.state = 'failed'; console.warn(`[loot] ${PARCHMENT.file} did not load - the tooltip box stands in:`, e?.message ?? e); });
  }
  return slot.state === 'ready' ? slot.img : null;
}

/** Cut `text` to `w` native pixels, with an ellipsis where it was cut. */
function fit(fnt, text, w) {
  if (measureText(fnt, text) <= w) return text;
  let t = text;
  while (t.length > 1 && measureText(fnt, `${t}…`) > w) t = t.slice(0, -1);
  return `${t}…`;
}

/** The rows the panel lists: the frame's rows, their stacks, and "and N more". */
export function lootPanelLines(frame) {
  const rows = (frame?.rows ?? []).map((r) => (r.stack > 1 ? `${r.name} (${r.stack})` : r.name));
  const more = frame?.rest > 0 ? `and ${frame.rest} more` : null;
  return { title: frame?.title ?? '', rows, more };
}

/**
 * AUDIT RETRO1 G5: WHERE THE PANEL STANDS, in the native frame `m` draws in - the reticle's row and the floor it
 * stands above, handed over in canvas pixels (ui/hud.js). Over a docked large HUD the crosshair is re-centred into the
 * strip the bar leaves (ROAD-E E5) and the bar is drawn before the panel: centred on the screen's own middle, the panel
 * stood 138 px below the crosshair at 1920x1080 and a four-row parchment reached 31 px over the bar. Neither given,
 * the native screen's middle and foot - the plain HUD's, unchanged.
 */
export function lootPanelBounds(m, reticleY = null, floorY = null) {
  return {
    centreY: reticleY == null ? NATIVE_H / 2 : (reticleY - m.oy) / m.s,
    bottom: floorY == null ? NATIVE_H : Math.min(NATIVE_H, (floorY - m.oy) / m.s),
  };
}

/**
 * The layout, in native pixels - pure, so the pins can read it without a renderer. `parchment` picks the face;
 * `centreY` and `bottom` are lootPanelBounds' (the panel centred on the one, clear of the other, and never above the
 * screen's top - that clamp wins where a strip is shorter than the panel).
 * @returns {{x:number, y:number, w:number, h:number, parchment:boolean, rowH:number, rowsY:number, middle:number, titleY:number, footY:number}}
 */
export function lootPanelLayout(frame, glyphH, { parchment = false, centreY = NATIVE_H / 2, bottom = NATIVE_H } = {}) {
  const { rows, more } = lootPanelLines(frame);
  const rowH = glyphH + 1;
  const n = rows.length;
  const top = (h) => Math.max(2, Math.min(Math.floor(bottom) - h - 2, Math.round(centreY - h / 2)));
  if (parchment) {
    const middle = Math.max(rowH, n * rowH) + 6;   // the body, cut at the rules and stretched to the rows
    const h = PARCHMENT.cutTop + middle + (PARCHMENT.h - PARCHMENT.cutBottom);
    const x = Math.min(NATIVE_W - PARCHMENT.w - 2, NATIVE_W / 2 + PANEL_OFFSET_X);
    const y = top(h);
    return { x, y, w: PARCHMENT.w, h, parchment: true, rowH, rowsY: y + PARCHMENT.cutTop + 3, middle,
      titleY: y + PARCHMENT.titleY, footY: y + PARCHMENT.cutTop + middle + (PARCHMENT.footY - PARCHMENT.cutBottom) };
  }
  const lines = 1 + n + (more ? 1 : 0);
  const w = 120;
  const h = lines * glyphH + 2 * TOOLTIP_MARGIN + 2;
  const x = Math.min(NATIVE_W - w - 2, NATIVE_W / 2 + PANEL_OFFSET_X);
  const y = top(h);
  return { x, y, w, h, parchment: false, rowH: glyphH, rowsY: y + TOOLTIP_MARGIN + glyphH + 2, middle: 0,
    titleY: y + TOOLTIP_MARGIN, footY: y + TOOLTIP_MARGIN + (1 + n) * glyphH + 2 };
}

/**
 * Draw the classic panel for `frame` with row `lit` banded, through the native metrics `m`, beside the reticle's row
 * and above the floor (canvas pixels - lootPanelBounds). Draws nothing for a frame with no loot list. Answers whether
 * it drew.
 */
export function drawLootPanel(renderer, m, font, frame, lit = -1, { reticleY = null, floorY = null } = {}) {
  if (!frame || frame.kind !== 'items' || !frame.rows?.length || !font?.fnt) return false;
  const glyph = font.fnt.fixedHeight ?? 7;
  const sheet = activeUiPack()?.id === 'grimoire' ? parchmentImage(renderer) : null;
  const L = lootPanelLayout(frame, glyph, { parchment: !!sheet, ...lootPanelBounds(m, reticleY, floorY) });
  const { title, rows, more } = lootPanelLines(frame);
  const text = (s, x, y, color) => drawText(renderer, font, s, m.ox + x * m.s, m.oy + y * m.s, m.s, color);
  if (sheet) {
    const P = PARCHMENT;
    drawImgCrop(renderer, sheet, m, [0, 0, P.w, P.cutTop], [L.x, L.y, P.w, P.cutTop]);
    drawImgCrop(renderer, sheet, m, [0, P.cutTop, P.w, P.cutBottom - P.cutTop], [L.x, L.y + P.cutTop, P.w, L.middle]);
    drawImgCrop(renderer, sheet, m, [0, P.cutBottom, P.w, P.h - P.cutBottom], [L.x, L.y + P.cutTop + L.middle, P.w, P.h - P.cutBottom]);
    const t = fit(font.fnt, title, P.textW);
    text(t, L.x + (P.w - measureText(font.fnt, t)) / 2, L.titleY, PARCHMENT_INK);
    rows.forEach((r, i) => {
      const y = L.rowsY + i * L.rowH;
      if (i === lit) drawRect(renderer, m, L.x + P.textX - 2, y - 1, P.textW + 4, L.rowH, PARCHMENT_LIT);
      text(fit(font.fnt, r, P.textW), L.x + P.textX, y, PARCHMENT_INK);
    });
    if (more) text(fit(font.fnt, more, P.textW), L.x + (P.w - measureText(font.fnt, more)) / 2, L.footY, PARCHMENT_INK);
    return true;
  }
  const bg = parseHexColor(getString('GUI', 'ToolTipBackgroundColor'), DEFAULT_TOOLTIP_TEXT_BG);
  const fg = parseHexColor(getString('GUI', 'ToolTipTextColor'), DEFAULT_TOOLTIP_TEXT_FG);
  drawRect(renderer, m, L.x, L.y, L.w, L.h, bg);
  const inner = L.w - 2 * TOOLTIP_MARGIN;
  text(fit(font.fnt, title, inner), L.x + TOOLTIP_MARGIN, L.titleY, fg);
  rows.forEach((r, i) => {
    const y = L.rowsY + i * L.rowH;
    if (i === lit) drawRect(renderer, m, L.x + 1, y - 1, L.w - 2, L.rowH, [fg[0], fg[1], fg[2], 0.25]);
    text(fit(font.fnt, r, inner), L.x + TOOLTIP_MARGIN, y, fg);
  });
  if (more) text(fit(font.fnt, more, inner), L.x + TOOLTIP_MARGIN, L.footY, fg);
  return true;
}

export function _setLootPanelSeamsForTests({ fetch: f = null, decode = null } = {}) {
  _decode = decode;
  _fetch = f ?? (async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
}
