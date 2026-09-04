// TR3 - THE TRANSPORT WINDOW: DaggerfallTransportWindow (MIT,
// Daggerfall Workshop), whole. The last of DFU's 60 real windows the
// port did not have (UI-Arc.md's table), and the door TR1's mode and
// TR2's sprite have both been waiting on.
//
// The panel is MOVE00I0.IMG with four rows and an exit button. A
// transport you do not own is not hidden and not greyed by a tint:
// its button takes a SUB-RECT OF A SECOND IMAGE, MOVE01I0.IMG, whose
// 122x36 sheet carries the three disabled rows at their own y offsets
// (:16-18). That is why the disabled rects differ from the button
// rects by (-4, -4) - they are coordinates in the sheet, not on the
// panel.
//
// The window's own laws:
//   - AllowCancel = false (:44) and the Transport key closes it on KEY
//     UP (:106-110), the same deferred-close shape the other native
//     windows use.
//   - `ParentPanel.BackgroundColor = Color.clear` (:43): the world
//     stays visible behind it.
//   - every handler sets the mode and closes (:199-235).
//   - mainPanel is Center + Middle (:88-89), so the declared
//     Position (0,50) never applies - the same BaseScreenComponent law
//     the guild and merchant popups document. The panel's size is the
//     IMAGE's size, read at load.
//
// The SHIP row is drawn and gated here, but nothing can enable it
// until TR4 gives `shipAvailable` something to answer with - DFU's own
// default is HasShip(), which reads DaggerfallBankManager. Until then
// the row is permanently the disabled art, which is exactly what a
// shipless player sees in DFU.

import { loadImg, drawImg, nativeMetrics } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table

/** DaggerfallUI.cs:693's localized key, and the English DFU ships. */
export const CANNOT_CHANGE_INDOORS = 'You cannot change transportation indoors.';

export const TRANSPORT_BASE_IMG = 'MOVE00I0.IMG';
export const TRANSPORT_DISABLED_IMG = 'MOVE01I0.IMG';

/** The five DaggerfallShortcut buttons, in DFU's own ADD order
 *  (:98-137) - Panel.ProcessHotkeySequences walks its buttons in that
 *  order and returns on the first Handled (:215-235). */
export const TRANSPORT_BUTTONS = Object.freeze([
  'TransportFoot', 'TransportHorse', 'TransportCart', 'TransportShip', 'TransportExit',
]);

/** Panel-child rects (:20-23) and the disabled SHEET rects (:16-18). */
export const TRANSPORT_RECTS = Object.freeze({
  foot: [5, 5, 120, 7],
  horse: [5, 14, 120, 7],
  cart: [5, 23, 120, 7],
  ship: [5, 32, 120, 7],
  exit: [44, 42, 43, 15],
});
export const TRANSPORT_DISABLED_RECTS = Object.freeze({
  horse: [1, 10, 120, 7],
  cart: [1, 19, 120, 7],
  ship: [1, 28, 120, 7],
});
/** DFSize disabledTextureSize (:93) - the sheet the sub-rects index. */
export const DISABLED_SHEET = Object.freeze({ width: 122, height: 36 });

let _art = null;
export async function preloadTransportArt(deps) {
  if (_art) return;
  try {
    _art = {
      base: await loadImg(deps, TRANSPORT_BASE_IMG),
      disabled: await loadImg(deps, TRANSPORT_DISABLED_IMG),
    };
  } catch { console.warn('[transport] MOVE00I0/MOVE01I0 unavailable; the transport window stays closed'); }
}
export const transportArtLoaded = () => !!_art;

/** The panel is centred on the image's own size, as Center + Middle
 *  force (:88-89) over the declared Position. */
export const transportPanelOrigin = (art) => ({
  x: Math.round((320 - (art?.base?.w ?? 0)) / 2),
  y: Math.round((200 - (art?.base?.h ?? 0)) / 2),
});

export class TransportWindow {
  /**
   * @param {{hasHorse:boolean, hasCart:boolean, shipAvailable?:boolean,
   *          onMode:Function, onClose?:Function}} hooks
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;
    // Setup reads ownership ONCE (:78-81) - a window open while the
    // horse is sold keeps the row it drew.
    this.enabled = Object.freeze({
      foot: true,
      horse: !!hooks.hasHorse,
      cart: !!hooks.hasCart,
      ship: !!hooks.shipAvailable,
    });
  }

  _close() { this.done = true; this.hooks.onClose?.(); }

  /** Every mode handler: set the mode, then close (:199-235). */
  _pick(mode) {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.hooks.onMode?.(mode);
    this._close();
  }

  input(code, e = null) {
    // Escape/Enter are the port host's close keys, not DFU buttons
    // (AllowCancel is false here, so DFU closes only on the Transport
    // key's release - the toggle the port host owns).
    if (code === 'Escape' || code === 'Enter') { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return; }
    // ROAD-G G7: the five Hotkeys, FROM THE TABLE, in DFU's button ADD
    // order (:98-137). The comment that stood here claimed "the port's
    // own letters (Ledger A - DFU reads its keybind table)" and both
    // halves were false: DaggerfallShortcut reads a TEXT DATABASE,
    // `StreamingAssets/Text/DialogShortcuts.txt` (DaggerfallShortcut.cs
    // :307-326), which A8 ported whole to `systems/dialogShortcuts.js` -
    // the same correction D1 made for the tavern, coven and guild
    // popups, and this window and the merchant popup were the two the
    // sweep left behind. The invented letters were right by accident
    // for F/H/C/S and WRONG for the exit, which has no letter here at
    // all where DFU binds TransportExit.
    // A DISABLED ROW GETS NO HOTKEY IN DFU: the else arm sets only the
    // disabled sub-texture (:105-121), so the binding is never assigned
    // and the letter does nothing - which is why the enable test rides
    // the button here rather than the pick.
    switch (firstHotkey(TRANSPORT_BUTTONS, code, e)) {
      case 'TransportFoot': this._pick(TRANSPORT_MODES.Foot); return;
      case 'TransportHorse': if (this.enabled.horse) this._pick(TRANSPORT_MODES.Horse); return;
      case 'TransportCart': if (this.enabled.cart) this._pick(TRANSPORT_MODES.Cart); return;
      case 'TransportShip': if (this.enabled.ship) this._pick(TRANSPORT_MODES.Ship); return;
      case 'TransportExit': audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return;
      default: break;   // DFU hangs no other accelerator on this window
    }
  }

  click(vx, vy) {
    const origin = transportPanelOrigin(_art);
    const hit = ([rx, ry, rw, rh]) => vx >= rx + origin.x && vy >= ry + origin.y
      && vx < rx + origin.x + rw && vy < ry + origin.y + rh;
    if (hit(TRANSPORT_RECTS.foot)) { this._pick(TRANSPORT_MODES.Foot); return true; }
    // A disabled row has NO click handler in DFU - the button exists
    // and does nothing (:82-91), so the click is eaten here too.
    if (hit(TRANSPORT_RECTS.horse)) { if (this.enabled.horse) this._pick(TRANSPORT_MODES.Horse); return true; }
    if (hit(TRANSPORT_RECTS.cart)) { if (this.enabled.cart) this._pick(TRANSPORT_MODES.Cart); return true; }
    if (hit(TRANSPORT_RECTS.ship)) { if (this.enabled.ship) this._pick(TRANSPORT_MODES.Ship); return true; }
    if (hit(TRANSPORT_RECTS.exit)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    return true;
  }

  draw(renderer, canvas) {
    if (!_art) return;
    const m = nativeMetrics(canvas);
    const o = transportPanelOrigin(_art);
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art.base, m, o.x, o.y);
    // GetSubTexture(disabledTexture, rect, 122x36) per disabled row.
    for (const row of ['horse', 'cart', 'ship']) {
      if (this.enabled[row]) continue;
      const [sx, sy, sw, sh] = TRANSPORT_DISABLED_RECTS[row];
      const [bx, by] = TRANSPORT_RECTS[row];
      drawTransportDisabledRow(renderer, _art.disabled, m, [sx, sy, sw, sh], [o.x + bx, o.y + by]);
    }
  }
}

/** The sub-rect blit, split out so a pin can drive it without art.
 *  DFU's GetSubTexture reads the rect from a sheet DECLARED 122x36,
 *  which is what makes the disabled rects sheet coordinates rather
 *  than panel ones. */
export function drawTransportDisabledRow(renderer, sheet, m, [sx, sy, sw, sh], [dx, dy]) {
  const u0 = sx / DISABLED_SHEET.width;
  const u1 = (sx + sw) / DISABLED_SHEET.width;
  // The sheet's rows are read top-down here, as every port blit is;
  // DFU's Rect is bottom-up in Unity space and ImageReader flips it.
  const v0 = sy / DISABLED_SHEET.height;
  const v1 = (sy + sh) / DISABLED_SHEET.height;
  renderer.drawScreenQuad(sheet.tex,
    { x: m.ox + dx * m.s, y: m.oy + dy * m.s, w: sw * m.s, h: sh * m.s },
    { u0, v0, u1, v1 });
}
