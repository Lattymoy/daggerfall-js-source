// UI2 - THE MERCHANT SERVICE POPUP: DaggerfallMerchantServicePopupWindow
// (MIT, Daggerfall Workshop), whole. The small two-button panel a
// general merchant or a bank teller puts in front of you: Talk, then
// the one service they offer, then Exit.
//
// The port SKIPPED it. `staticNpcRoute` has answered 'sell' and
// 'banking' since G8 and worldModes jumped straight to the trade or
// bank window (:1526, :1532) - so the merchant's own greeting panel,
// and with it the Talk row, never appeared. DFU never opens either
// window without this popup in front.
//
// THE NATIVE-WINDOW RULE, element by element:
// - GNRC01I0.IMG, 130x42 in the shipping data, which is exactly
//   mainPanel.Size (:66).
// - mainPanel is HorizontalAlignment.Center + VerticalAlignment.Middle
//   (:63-64), and BaseScreenComponent :1217/:1234 make BOTH alignments
//   ignore Position, so the declared `Position = new Vector2(0, 50)`
//   (:65) never applies - the panel sits at ((320-130)/2, (200-42)/2)
//   = (95, 79). The same law the guild sibling documents.
// - the three buttons are panel-CHILD rects (:22-24): talk (5,5,120,7),
//   service (5,14,120,7), exit (44,24,43,15).
// - the service label is the one piece of text DFU's window draws
//   (:70-73; PORTAL1's row under the art is the port's own): Position (0,1) INSIDE the service button,
//   HorizontalAlignment.Center, ShadowPosition = Vector2.zero - no
//   shadow, unlike every other label in the port's native windows.
// - `ParentPanel.BackgroundColor = Color.clear` (:39) and
//   DaggerfallPopupWindow's hard-clear ScreenDimColor: the room stays
//   visible behind the panel.
//
// The custom-merchant-service arms (:112-115, :149-151) are Hazelnut's mod
// hook - `Guilds.Services.HasCustomMerchantService`, a registry only a
// mod writes to. RR3 ported the registry (systems/guild/guildServices.js) for
// Roleplay & Realism's master armorer: the host hands the label in as
// `hooks.label` and runs the service from its own `onService`.

import { loadImg, drawImg, nativeMetrics, drawRect, shadowText, DEFAULT_TEXT_COLOR } from '../native/nativePanel.js';
import { REFORGE_ROW_BG } from '../guildServiceWindow.js';   // PORTAL1: the port-drawn rows' one parchment dark
import { drawScreenDimBackdrop } from '../chargenArt.js';
import { drawText, measureText } from '../text.js';
import { audio } from '../../systems/audio.js';   // F141: the ButtonClick roster
import { SOUND } from '../../systems/soundClips.js';
import { localizedTable } from '../../systems/textManager.js';   // L10N3d: the service label

/** mainPanel.Size (:66) and the centring both alignments force. */
export const MERCHANT_PANEL_W = 130, MERCHANT_PANEL_H = 42;
export const MERCHANT_PANEL_X = Math.round((320 - MERCHANT_PANEL_W) / 2);   // 95
export const MERCHANT_PANEL_Y = Math.round((200 - MERCHANT_PANEL_H) / 2);   // 79

/** Panel-child rects, verbatim (:22-24). */
export const MERCHANT_RECTS = Object.freeze({
  talk: [5, 5, 120, 7],
  service: [5, 14, 120, 7],
  exit: [44, 24, 43, 15],
});

/** serviceLabel.Position (:71) inside the service button. */
const SERVICE_LABEL_OFFSET_Y = 1;

/** PORTAL1 (systems/portalStone.js): THE PORTAL STONE'S ROW - every shop's keeper sells one for Welkynd Shards when the
 *  host hands `hooks.portal` ({ label, onBuy }). Neither shop popup's art (GNRC01I0 here, REPR01I0 in
 *  merchantRepairWindow.js) has room for it, so this one row is the port's own, drawn just under the panel in the
 *  parchment's dark - the guild popup's Reforge row's law (guildServiceWindow.js REFORGE_RECT) - and its key is P.
 *  Panel-relative, at the panel's foot. */
export const portalRowRect = (panelH) => Object.freeze([5, panelH + 2, 120, 10]);
export const PORTAL_ROW_KEY = 'KeyP';
/** The row, drawn under a panel at (px, py) of height ph. */
export function drawPortalRow(renderer, m, font, px, py, ph, label) {
  const [rx, ry, rw, rh] = portalRowRect(ph);
  drawRect(renderer, m, px + rx, py + ry, rw, rh, REFORGE_ROW_BG);
  shadowText(renderer, font, label, m, px + rx, py + ry + 2, { align: 'center', w: rw });
}

/** GetServiceLabelText's switch (:78-88), with the `default:` folded
 *  into Sell exactly as the C# folds it - keyed by the service, each
 *  label read through its DFU key when drawn (L10N3d). */
export const MERCHANT_SERVICE_LABEL = localizedTable({ Sell: ['serviceSell', 'Sell'], Banking: ['serviceBanking', 'Banking'] });
export const merchantServiceLabel = (service) => MERCHANT_SERVICE_LABEL[service] ?? MERCHANT_SERVICE_LABEL.Sell;

let _art = null;
export async function preloadMerchantServiceArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'GNRC01I0.IMG'); }
  catch { console.warn('[merchant] GNRC01I0 unavailable; the merchant popup stays text'); }
}
export const merchantServiceArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + MERCHANT_PANEL_X && y >= ry + MERCHANT_PANEL_Y
  && x < rx + MERCHANT_PANEL_X + rw && y < ry + MERCHANT_PANEL_Y + rh;

export class MerchantServiceWindow {
  /**
   * @param {{service:'Sell'|'Banking', onTalk:Function, onService:Function,
   *          onClose?:Function, label?:string, portal?:{label:string, onBuy:Function}}} hooks   PORTAL1: `portal` the Portal Stone's row
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
  }

  _close() { this.done = true; this.hooks.onClose?.(); }

  /** Every handler heads with PlayOneShot(SoundClips.ButtonClick)
   *  (:86, :93, :113) and CLOSES BEFORE it acts (:87, :94, :114) - the
   *  trade or bank window DFU pushes is pushed over a closed popup. */
  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }
  _talk() { this._click(); this._close(); this.hooks.onTalk?.(); }
  _service() { this._click(); this._close(); this.hooks.onService?.(); }
  _exit() { this._click(); this._close(); }
  _portal() { this._click(); this._close(); this.hooks.portal?.onBuy?.(); }   // PORTAL1: closes first, as the three do

  input(code) {
    // ROAD-G G7: these three letters ARE the port's own, and the
    // reason written here was wrong. DFU does not "read its keybinds"
    // for this window - it binds NOTHING: unlike its guild sibling,
    // which hangs GuildsTalk/GuildsExit and Services.GetServiceShortcut-
    // Button on its three buttons (DaggerfallGuildServicePopupWindow.cs
    // :128-151), DaggerfallMerchantServicePopupWindow adds all three
    // with a click handler ALONE (:88-103) and no `Hotkey` anywhere in
    // the file. So there is no table entry to read and no letter to be
    // wrong against: keyboard access here is an ADDITION, recorded at
    // Ledger A, THE MERCHANT SERVICE POPUP'S ACCELERATORS ARE THE
    // PORT'S OWN, cited by name.
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE') { this._exit(); return; }
    if (code === 'KeyT') { this._talk(); return; }
    if (code === 'KeyS') { this._service(); return; }
    if (code === PORTAL_ROW_KEY && this.hooks.portal) this._portal();   // PORTAL1
  }

  click(vx, vy) {
    if (inRect(MERCHANT_RECTS.talk, vx, vy)) { this._talk(); return true; }
    if (inRect(MERCHANT_RECTS.service, vx, vy)) { this._service(); return true; }
    if (inRect(MERCHANT_RECTS.exit, vx, vy)) { this._exit(); return true; }
    if (this.hooks.portal && inRect(portalRowRect(MERCHANT_PANEL_H), vx, vy)) { this._portal(); return true; }   // PORTAL1
    return true;   // the panel eats its own clicks
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    drawScreenDimBackdrop(renderer, canvas);
    if (_art) drawImg(renderer, _art, m, MERCHANT_PANEL_X, MERCHANT_PANEL_Y);
    const [sx, sy, sw] = MERCHANT_RECTS.service;
    const label = this.hooks.label ?? merchantServiceLabel(this.hooks.service);   // RR3: GetServiceLabelText's custom arm (:114-115) - the registered service's own name
    const lw = measureText(font.fnt, label);
    drawText(renderer, font, label,
      m.ox + (MERCHANT_PANEL_X + sx + Math.round((sw - lw) / 2)) * m.s,
      m.oy + (MERCHANT_PANEL_Y + sy + SERVICE_LABEL_OFFSET_Y) * m.s, m.s, DEFAULT_TEXT_COLOR);
    if (this.hooks.portal) drawPortalRow(renderer, m, font, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H, this.hooks.portal.label);   // PORTAL1
  }
}
