// AUDIT 54 (talk lane) - THE REPAIR-SHOP MERCHANT POPUP: DFU's
// DaggerfallMerchantRepairPopupWindow (MIT, Daggerfall Workshop /
// Hazelnut) on real ARENA2 art. The FOUR-button panel an armorer, a
// general store or a weaponsmith puts in front of you - Repair, Talk,
// Sell, Exit - of which only Repair opens the repair screen.
//
// The port SKIPPED it. `PlayerActivate.cs:1579-1580` pushes
// UIWindowType.MerchantRepairPopup for a repair shop exactly as
// :1582 pushes the MerchantServicePopup for every other one, and the
// port shipped the sibling (ui/merchantServiceWindow.js) and routed
// the repair click STRAIGHT into openRepairService. That call carried
// `onTalk`/`onSell` hooks, but openRepairService's first arm - the
// native INVE12I0 trade screen, taken whenever a building record and
// the trade art are present, which IS the shipping configuration -
// reads neither. So inside a repair shop the player was dropped into
// the Repair trade screen with no Talk and no Sell; the two hooks were
// live only on the keyed fallback list, i.e. only with ARENA2 absent.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is REPR01I0.IMG (:43) with mainPanel.Size 130x51 (:79),
//   the coven popup's geometry twin.
// - mainPanel is Center/Middle (:75-76), so BaseScreenComponent
//   :1218/:1235 discard the declared `Position = new Vector2(0, 50)`
//   (:78) and the panel sits at ((320-130)/2, (200-51)/2).
// - the four buttons are panel-CHILD rects (:24-27): repair
//   (5,5,120,7), talk (5,14,120,7), sell (5,23,120,7), exit
//   (44,33,43,15). Every word is painted in the art - this window
//   draws no text of its own.
// - `ParentPanel.BackgroundColor = Color.clear` (:62): the room stays
//   visible behind the panel.
// - all four handlers are `PlayOneShot(ButtonClick); CloseWindow();`
//   and only then the action (:121-126, :143-148, :165-170, :187-191),
//   so the trade window DFU pushes is pushed over a CLOSED popup.
//   Their keyboard twins defer the action to KeyUp (:128-141, :150-163,
//   :172-185, :193-201); the port's windows are handed KeyDown alone,
//   the one-frame collapse dialogShortcuts.hotkeyHit already records.
//
// THE HOTKEYS are the DaggerfallShortcut table's (A8), in the ctor's
// button ADD order - DialogShortcuts.txt:157-161 ("-- Merchant menu")
// binds MerchantRepair R, MerchantTalk T, MerchantSell S, MerchantExit
// E, and systems/dialogShortcuts.js already carries all four rows.

import { loadImg, nativeMetrics, drawImg } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';   // F141: the ButtonClick roster
import { SOUND } from '../systems/soundClips.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table

/** The window's DaggerfallShortcut.Buttons in ctor ADD order (:82-103),
 *  which is the order Panel.ProcessHotkeySequences asks them in. */
export const MERCHANT_REPAIR_BUTTONS = Object.freeze([
  'MerchantRepair', 'MerchantTalk', 'MerchantSell', 'MerchantExit',
]);

/** mainPanel.Size (:79) - and the size REPR01I0.IMG ships. */
export const REPAIR_PANEL_W = 130, REPAIR_PANEL_H = 51;
/** Center/Middle on the 320x200 native panel (:75-76). */
export const REPAIR_PANEL_X = Math.round((320 - REPAIR_PANEL_W) / 2);
export const REPAIR_PANEL_Y = Math.round((200 - REPAIR_PANEL_H) / 2);

/** #region UI Rects (:24-27), panel-relative. */
export const REPAIR_RECTS = Object.freeze({
  repair: [5, 5, 120, 7],
  talk: [5, 14, 120, 7],
  sell: [5, 23, 120, 7],
  exit: [44, 33, 43, 15],
});

let _art = null;
export async function preloadMerchantRepairArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'REPR01I0.IMG'); }
  catch { console.warn('[repair] REPR01I0 unavailable; the repair popup stays the keyed flow'); }
}
export const merchantRepairArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + REPAIR_PANEL_X && y >= ry + REPAIR_PANEL_Y
  && x < rx + REPAIR_PANEL_X + rw && y < ry + REPAIR_PANEL_Y + rh;

/**
 * hooks:
 *   onRepair()  WindowModes.Repair (:125)
 *   onTalk()    TalkManager.TalkToStaticNPC(merchantNPC) (:147)
 *   onSell()    WindowModes.Sell (:169)
 *   onClose()
 */
export class MerchantRepairWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
  }

  _close() { this.done = true; this.hooks.onClose?.(); }

  /** Every handler is click-sound, CloseWindow, then the action. */
  _act(fn) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); fn?.(); }

  input(code, e = null) {
    // Escape/Enter are the port host's close keys, not DFU buttons.
    if (code === 'Escape' || code === 'Enter') { this._act(null); return; }
    const hit = firstHotkey(MERCHANT_REPAIR_BUTTONS, code, e);
    if (hit === null) return;
    switch (hit) {
      case 'MerchantRepair': this._act(this.hooks.onRepair); return;
      case 'MerchantTalk': this._act(this.hooks.onTalk); return;
      case 'MerchantSell': this._act(this.hooks.onSell); return;
      default: this._act(null);   // MerchantExit
    }
  }

  click(vx, vy) {
    if (inRect(REPAIR_RECTS.repair, vx, vy)) { this._act(this.hooks.onRepair); return true; }
    if (inRect(REPAIR_RECTS.talk, vx, vy)) { this._act(this.hooks.onTalk); return true; }
    if (inRect(REPAIR_RECTS.sell, vx, vy)) { this._act(this.hooks.onSell); return true; }
    if (inRect(REPAIR_RECTS.exit, vx, vy)) { this._act(null); return true; }
    return true;   // the panel eats its own clicks
  }

  draw(renderer, canvas) {
    if (!_art) { this._close(); return; }   // art gone mid-session: release the slot
    const m = nativeMetrics(canvas);
    // AUDIT 26 F136 / AUDIT 24 ui: `ParentPanel.BackgroundColor =
    // Color.clear` (:62) - the letterbox is NOT painted, the room shows.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, REPAIR_PANEL_X, REPAIR_PANEL_Y);
  }
}
