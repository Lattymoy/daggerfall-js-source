// U8c: the NATIVE TRADE WINDOW - the classic shop screen on real
// art (DFU DaggerfallInventoryWindow + DaggerfallTradeWindow
// geometry, MIT Daggerfall Workshop): INVE00I0.IMG base,
// INVE08I0.IMG buy-mode action panel at (222,10), SHOP00I0.IMG cost strip at
// (49,13) with cost/gold labels at +28/+68. Item lists are the
// classic vertical scrollers - local (163,48,59x152) = the player's
// shop-accepted sellables, remote (261,48,59x152) = the open
// shelf's stock - four ~38px slots each, REAL item icons through
// the world-texture records the E1 templates carry.
//
// The trade model this slice (the E2/E3 loop on classic art):
// clicking a REMOTE item buys it (gold check, CalculateTradePrice
// buy), clicking a LOCAL item sells it (the selling branch; the
// item lands on the shelf, buy-backs work); the cost strip shows
// the LAST price + live gold. The list's top/bottom 12px bands
// scroll. FLAGGED loud: the basket + mode-action flow (DFU
// accumulates then Buy), wagon/info/select/steal buttons (consumed
// no-ops), the material-dye icon variants, scroll-arrow art.

import { loadImg, nativeMetrics, drawImg, SCREEN_DIM, shadowText } from './nativePanel.js';
import { LIST_SLOTS, CELL_X, CELL_W, SLOT_H, ARROW_H, DOWN_ARROW_Y, scrollerHit, applyScroll, makeIconDrawer, drawStackLabel } from './itemScroller.js';
import { FntFile } from '../formats/fntFile.js';
import { makeFont } from './text.js';

// re-exported so the composed window keeps one import surface
export { LIST_SLOTS, CELL_X, CELL_W, SLOT_H, ARROW_H, DOWN_ARROW_Y };

export const TRADE_RECTS = Object.freeze({
  costPanel: [49, 13, 111, 9],           // SHOP00I0 strip
  actionPanel: [222, 10, 39, 190],       // INVE08I0 (buy buttons; the sell-mode INVE10 art pends the mode flow)
  localList: [163, 48, 59, 152],
  remoteList: [261, 48, 59, 152],
  exit: [222 + 0, 178, 39, 22],          // the inventory exit rect over the action panel art
  modeAction: [222 + 4, 10 + 124, 31, 14],   // the Buy button (panel-child 4,124)
  clear: [222 + 4, 10 + 146, 31, 14],
});
// The ItemListScroller layout lives in itemScroller.js (the 17d UI
// audit's corrected law, shared with the inventory window).

let _art = null;
export async function preloadTradeArt(deps) {
  if (_art) return;
  try {
    const [base, action, cost, fnt4] = await Promise.all([
      loadImg(deps, 'INVE00I0.IMG'), loadImg(deps, 'INVE08I0.IMG'), loadImg(deps, 'SHOP00I0.IMG'),
      deps.fetchBytes('FONT0004.FNT'),   // the stack-count font (DFU Font4)
    ]);
    _art = { base, action, cost, font4: makeFont(deps.renderer, new FntFile().load(fnt4), 'FONT0004') };
  } catch { console.warn('[trade] INVE00I0/INVE08I0/SHOP00I0 unavailable; the keyed shelf window stands in'); }
}
export const tradeArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** hooks = { shelfItems() -> [], sellables() -> [], buy(item) ->
 *  price|null, sell(item) -> price, gold() -> n, icons:
 *  { getTexture, uploadRecord, textures } (the host pipeline),
 *  shopName }. */
export class NativeTradeWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seams
    this.localScroll = 0;
    this.remoteScroll = 0;
    this.lastPrice = null;
    this._icon = makeIconDrawer(hooks.icons);   // the shared scroller's warm cache
  }

  input(code) {
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE') { this.done = true; return; }
    const d = /^Digit([1-4])$/.exec(code);   // keyboard: digits buy the visible remote slots
    if (d) this._pickRemote(Number(d[1]) - 1);
    if (code === 'KeyN') this.remoteScroll++;
    if (code === 'KeyP') this.remoteScroll = Math.max(0, this.remoteScroll - 1);
  }

  _pickRemote(slot) {
    const it = this.hooks.shelfItems()[this.remoteScroll + slot];
    if (it) this.lastPrice = this.hooks.buy(it) ?? this.lastPrice;
  }
  _pickLocal(slot) {
    const it = this.hooks.sellables()[this.localScroll + slot];
    if (it) this.lastPrice = this.hooks.sell(it);
  }
  click(vx, vy) {
    const R = TRADE_RECTS;
    if (inRect(R.exit, vx, vy)) { this.done = true; return true; }
    for (const [rect, which, items, pick] of [
      [R.remoteList, 'remoteScroll', this.hooks.shelfItems(), (s) => this._pickRemote(s)],
      [R.localList, 'localScroll', this.hooks.sellables(), (s) => this._pickLocal(s)],
    ]) {
      const hit = scrollerHit(rect, vx, vy);
      if (!hit) continue;
      if (hit.kind === 'slot') pick(hit.slot);
      else this[which] = applyScroll(this[which], hit.kind, items.length);
      return true;
    }
    // action-panel buttons: consumed no-ops this slice (basket/haggle pend)
    return inRect(R.actionPanel, vx, vy) || inRect(R.costPanel, vx, vy);
  }

  _drawIcon(renderer, m, it, rect, slot) { return this._icon(renderer, m, it, rect, slot); }

  draw(renderer, canvas, font) {
    if (!_art) { this.done = true; return; }
    const m = nativeMetrics(canvas);
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, SCREEN_DIM);
    drawImg(renderer, _art.base, m, 0, 0);
    const R = TRADE_RECTS;
    drawImg(renderer, _art.action, m, R.actionPanel[0], R.actionPanel[1]);
    drawImg(renderer, _art.cost, m, R.costPanel[0], R.costPanel[1]);
    shadowText(renderer, font, String(this.lastPrice ?? 0), m, R.costPanel[0] + 28, R.costPanel[1] + 2);
    shadowText(renderer, font, String(this.hooks.gold()), m, R.costPanel[0] + 68, R.costPanel[1] + 2);
    for (const [rect, scroll, items] of [
      [R.remoteList, this.remoteScroll, this.hooks.shelfItems()],
      [R.localList, this.localScroll, this.hooks.sellables()],
    ]) {
      items.slice(scroll, scroll + LIST_SLOTS).forEach((it, s) => {
        this._drawIcon(renderer, m, it, rect, s);
        drawStackLabel(renderer, _art?.font4 ?? font, m, it, rect, s);
      });
    }
  }
}
