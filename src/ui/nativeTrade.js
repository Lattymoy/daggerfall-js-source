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
import { templateByIndex } from '../systems/itemTemplates.js';

export const TRADE_RECTS = Object.freeze({
  costPanel: [49, 13, 111, 9],           // SHOP00I0 strip
  actionPanel: [222, 10, 39, 190],       // INVE08I0 (buy buttons; the sell-mode INVE10 art pends the mode flow)
  localList: [163, 48, 59, 152],
  remoteList: [261, 48, 59, 152],
  exit: [222 + 0, 178, 39, 22],          // the inventory exit rect over the action panel art
  modeAction: [222 + 4, 10 + 124, 31, 14],   // the Buy button (panel-child 4,124)
  clear: [222 + 4, 10 + 146, 31, 14],
});
// ItemListScroller verbatim: four 50x38 item BUTTONS at x0 of the
// scroller (the right 9px is the scroll strip - the art's arrows sit
// at its top/bottom); icons ScaleToFit with MaxAutoScale 1 (never
// upscaled), centered both axes; the ONLY text is the stack count,
// Font4 at the button's top-left, drawn only when stackCount > 1
// (item names ride the info/tooltip seam - classic lists draw none).
export const LIST_SLOTS = 4;
export const CELL_W = 50;
export const SLOT_H = 38;
export const SCROLL_STRIP_W = 9;

let _art = null;
export async function preloadTradeArt(deps) {
  if (_art) return;
  try {
    const [base, action, cost] = await Promise.all([
      loadImg(deps, 'INVE00I0.IMG'), loadImg(deps, 'INVE08I0.IMG'), loadImg(deps, 'SHOP00I0.IMG'),
    ]);
    _art = { base, action, cost };
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
    this._iconWarm = new Set();
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
  _scroll(which, d, len) {
    const max = Math.max(0, len - LIST_SLOTS);
    this[which] = Math.max(0, Math.min(max, this[which] + d));
  }

  click(vx, vy) {
    const R = TRADE_RECTS;
    if (inRect(R.exit, vx, vy)) { this.done = true; return true; }
    for (const [rect, which, items, pick] of [
      [R.remoteList, 'remoteScroll', this.hooks.shelfItems(), (s) => this._pickRemote(s)],
      [R.localList, 'localScroll', this.hooks.sellables(), (s) => this._pickLocal(s)],
    ]) {
      if (!inRect(rect, vx, vy)) continue;
      const x = vx - rect[0], y = vy - rect[1];
      // the right 9px scroll strip: top half up, bottom half down
      // (the art's arrow buttons live at its ends)
      if (x >= CELL_W) { this._scroll(which, y < rect[3] / 2 ? -1 : 1, items.length); return true; }
      pick(Math.floor(y / SLOT_H));
      return true;
    }
    // action-panel buttons: consumed no-ops this slice (basket/haggle pend)
    return inRect(R.actionPanel, vx, vy) || inRect(R.costPanel, vx, vy);
  }

  _drawIcon(renderer, m, it, rect, slot) {
    const t = templateByIndex(it.templateIndex);
    if (!t || !t.worldTexArchive) return false;
    const { getTexture, uploadRecord, textures } = this.hooks.icons;
    const key = `${t.worldTexArchive}_${t.worldTexRecord}`;
    if (!this._iconWarm.has(key)) {
      // warm the record + capture its native size (the GL handle in
      // renderer.textures carries no dimensions)
      this._iconWarm.add(key);
      this._iconSizes ??= new Map();
      getTexture(t.worldTexArchive).then((tex) => {
        if (t.worldTexRecord < tex.recordCount) {
          uploadRecord(t.worldTexArchive, t.worldTexRecord);
          this._iconSizes.set(key, tex.getSize(t.worldTexRecord));
        }
      }).catch(() => {});
    }
    const glTex = textures.get(key);
    const size = this._iconSizes?.get(key);
    if (!glTex || !size?.width) return false;
    // ScaleToFit with MaxAutoScale 1 (never upscale), centered in
    // the 50x38 BUTTON cell (Mac's catch: the old free-fit spilled
    // over the art's slot frames).
    const fit = Math.min(1, CELL_W / size.width, SLOT_H / size.height);
    const w = size.width * fit, h = size.height * fit;
    const x = rect[0] + (CELL_W - w) / 2;
    const y = rect[1] + slot * SLOT_H + (SLOT_H - h) / 2;
    // HOTFIX (Mac's catch): record textures store BOTTOM-UP rows
    // (getColor32 keeps DFU's verbatim GL flip for the mesh/billboard
    // path) while drawScreenQuad samples v0 at the TOP - the icons
    // drew upside down. A V-flipped source rect rights them.
    renderer.drawScreenQuad(glTex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s },
      { u0: 0, v0: 1, u1: 1, v1: 0 });
    return true;
  }

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
        // classic cells carry ONLY the stack count (top-left, >1);
        // names ride the info/tooltip seam (FLAGGED)
        if ((it.stackCount ?? 1) > 1) {
          shadowText(renderer, font, String(it.stackCount), m, rect[0] + 1, rect[1] + s * SLOT_H + 1);
        }
      });
    }
  }
}
