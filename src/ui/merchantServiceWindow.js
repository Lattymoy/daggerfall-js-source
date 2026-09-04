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
// - the service label is the one piece of text the window draws
//   (:70-73): Position (0,1) INSIDE the service button,
//   HorizontalAlignment.Center, ShadowPosition = Vector2.zero - no
//   shadow, unlike every other label in the port's native windows.
// - `ParentPanel.BackgroundColor = Color.clear` (:39) and
//   DaggerfallPopupWindow's hard-clear ScreenDimColor: the room stays
//   visible behind the panel.
//
// The custom-merchant-service arms (:75-77, :95-97) are Hazelnut's mod
// hook - `Guilds.Services.HasCustomMerchantService`, a registry only a
// mod writes to. Not ported: there are no mods here, and DFU's own
// answer with an empty registry is the switch below.

import { loadImg, drawImg, nativeMetrics, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { drawText, measureText } from './text.js';
import { audio } from '../systems/audio.js';   // F141: the ButtonClick roster
import { SOUND } from '../systems/soundClips.js';

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

/** GetServiceLabelText's switch (:78-88), with the `default:` folded
 *  into Sell exactly as the C# folds it. */
export const MERCHANT_SERVICE_LABEL = Object.freeze({ Sell: 'Sell', Banking: 'Banking' });
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
   *          onClose?:Function}} hooks
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
    if (code === 'KeyS') this._service();
  }

  click(vx, vy) {
    if (inRect(MERCHANT_RECTS.talk, vx, vy)) { this._talk(); return true; }
    if (inRect(MERCHANT_RECTS.service, vx, vy)) { this._service(); return true; }
    if (inRect(MERCHANT_RECTS.exit, vx, vy)) { this._exit(); return true; }
    return true;   // the panel eats its own clicks
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    drawScreenDimBackdrop(renderer, canvas);
    if (_art) drawImg(renderer, _art, m, MERCHANT_PANEL_X, MERCHANT_PANEL_Y);
    const [sx, sy, sw] = MERCHANT_RECTS.service;
    const label = merchantServiceLabel(this.hooks.service);
    const lw = measureText(font.fnt, label);
    drawText(renderer, font, label,
      m.ox + (MERCHANT_PANEL_X + sx + Math.round((sw - lw) / 2)) * m.s,
      m.oy + (MERCHANT_PANEL_Y + sy + SERVICE_LABEL_OFFSET_Y) * m.s, m.s, DEFAULT_TEXT_COLOR);
  }
}
