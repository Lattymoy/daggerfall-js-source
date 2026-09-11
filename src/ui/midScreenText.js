// AUDIT 64 F34 - THE HUD'S SECOND TEXT SURFACE (UI arc, U5's sibling).
//
// DaggerfallHUD owns TWO text surfaces, not one. `popupText` is
// PopupText - a stacking seven-row queue at the TOP of the native
// panel, ported as ui/hudText.js - and `midScreenTextLabel` is a
// single centred TextLabel with its own timer that REPLACES itself on
// every write (DaggerfallHUD.cs:32-33, two distinct fields). The port
// had only the first, so every SetMidScreenText caller - the
// interaction-mode line on EVERY mode change (PlayerActivate.cs:1424),
// the eleven `youAreTooFarAway` refusals (:330/:503/:688/:711/:763/
// :780/:790/:834/:852/:872/:940), the whole lockpick-difficulty ladder
// and `magicLock` (LookAtInteriorLock, :991-1007) and the bow's
// `youHaveNoArrows` (FPSWeapon.cs:365) - was folded into the popup
// queue: the wrong place (native y=4 instead of y=146), the wrong
// lifetime (PopupText.popDelay 1.0 s instead of 1.5 s) and the wrong
// semantics (a stack that scrolls instead of a line that replaces).
//
// AUDIT 65 MC-2 - HOW MANY OF THOSE ELEVEN THE PORT CAN SPEAK. The
// list above is DFU's, not a claim about this tree, and for a long
// while the port reached five of the refusals (the board :711, the
// static/mobile NPC :763/:780/:790 and the pickpocket :834) because
// player/activate.js PRE-GATED THE PICK: a target beyond its own reach
// was dropped before any host saw it, so a door, action door, shelf,
// ladder, chest, pile or body at five units answered with SILENCE and
// let the click fall through to whatever stood behind it. DFU rays
// once to RayDistance (PlayerActivate.cs:76/:314) and gates inside
// each handler. The families now compete for that one ray and carry
// their handler's own reach beside it, so :503, :688, :852, :872 and
// :940 are spoken too. Two stay silent on purpose: :330, the quest
// resource, is a RECORDED delta (scenes/worldModes.js's own note and
// bible/06-Systems/Quest-Arc.md), and an action RECORD is not a
// refusal at all in C# either (:380-383 gates in the Update ladder
// with no else and no line).
//
// The reference itself proves the two are deliberately distinct in one
// file: PlayerActivate.cs:527-529 speaks `PopupMessage(lockedExterior
// Door)` and then `LookAtInteriorLock(...)` - one line per surface.
//
// This is DaggerfallUI.cs's static shim shape (:783-789,
// `DaggerfallUI.SetMidScreenText` -> `Instance.dfHUD.SetMidScreenText`):
// one label per game, reached by a free function, so a caller in any
// of the four hosts speaks to the same surface without a sink threaded
// through it.

import { drawText, measureText } from './text.js';
import { nativeMetrics, NATIVE_W, DEFAULT_TEXT_COLOR } from './nativePanel.js';

/** DaggerfallHUD.cs:25 `const int midScreenTextDefaultY = 146`, the
 *  label's Position.y on the 320x200 NativePanel (:176). */
export const MID_SCREEN_TEXT_DEFAULT_Y = 146;
/** DaggerfallHUD.cs:51 `midScreenTextDelay = 1.5f`, which is also
 *  SetMidScreenText's own parameter default (:353). */
export const MID_SCREEN_TEXT_DEFAULT_DELAY = 1.5;
/** DaggerfallHUD.cs:360 - the large-HUD lift's `- 7` native rows. */
export const MID_SCREEN_TEXT_LARGE_HUD_MARGIN = 7;

export class MidScreenText {
  constructor() {
    this.text = '';
    // :50 `float midScreenTextTimer = -1` - the SENTINEL. A label at
    // rest does not accumulate dt; only a set() arms it.
    this.timer = -1;
    // :51 - a FIELD, not a constant: SetMidScreenText's `delay`
    // parameter overwrites it per message.
    this.delay = MID_SCREEN_TEXT_DEFAULT_DELAY;
    // :176 - Position (0, midScreenTextDefaultY), recomputed inside
    // set() when the large HUD is on (:355-365) and NOT per frame.
    this.y = MID_SCREEN_TEXT_DEFAULT_Y;
    // :371 `GameManager.Instance.PlayerEntity.Notebook.AddMessage
    // (message)` - the same notebook tail PopupText.AddText carries
    // (PopupText.cs:123), which the port wires as HudText.onMessage.
    // The host hands this one the same sink.
    this.onMessage = null;
    // What SetMidScreenText reads off the live screen at set time:
    // `Screen.height`, `midScreenTextLabel.LocalScale.y` and
    // `LargeHUD.ScreenHeight`. drawHud feeds them every frame through
    // observe(); a null bar height means the LargeHUD SETTING is off,
    // which is the guard at :357 - the setting, not whether a bar
    // happens to be drawn.
    this._screenHeight = 0;
    this._scale = 1;
    this._largeHudHeight = null;
  }

  /** The live screen state SetMidScreenText reads (:357-359). */
  observe(screenHeight, scale, largeHudHeight = null) {
    this._screenHeight = screenHeight;
    this._scale = scale || 1;
    this._largeHudHeight = largeHudHeight;
  }

  /**
   * SetMidScreenText verbatim (DaggerfallHUD.cs:353-372).
   *
   * The large-HUD lift (:356-365) is CLAMPED and TRUNCATED:
   * `localY = (offset / LocalScale.y) - 7; if (localY <
   * midScreenTextDefaultY) Position = (0, (int)localY); else Position
   * = (0, midScreenTextDefaultY)`. Both halves are load-bearing - a
   * SHORT bar leaves localY above 146 and the label must stay at 146
   * rather than drop with the bar - and the whole block is guarded by
   * `DaggerfallUnity.Settings.LargeHUD`.
   *
   * Then :367-370: the text REPLACES, the timer re-arms at 0 and the
   * delay is overwritten. Nothing stacks and nothing queues.
   */
  set(message, delayInSeconds = MID_SCREEN_TEXT_DEFAULT_DELAY) {
    if (this._largeHudHeight !== null) {
      const offset = this._screenHeight - this._largeHudHeight;
      const localY = (offset / this._scale) - MID_SCREEN_TEXT_LARGE_HUD_MARGIN;
      this.y = localY < MID_SCREEN_TEXT_DEFAULT_Y ? Math.trunc(localY) : MID_SCREEN_TEXT_DEFAULT_Y;
    }
    this.text = message;
    this.timer = 0;
    this.delay = delayInSeconds;
    this.onMessage?.(message);
  }

  /** The Update tail (:259-267): the sentinel gates the tick, and a
   *  crossing blanks the label and re-arms the sentinel. */
  tick(dt) {
    if (this.timer === -1) return;
    this.timer += dt;
    if (this.timer > this.delay) {
      this.timer = -1;
      this.text = '';
    }
  }

  /** HorizontalAlignment.Center over the 320-wide NativePanel (:175),
   *  at Position.y (:176) - a NativePanel child, so it rides the
   *  centred native fit exactly as the popup column does. */
  draw(renderer, canvas, font) {
    if (!font || !this.text) return;
    const m = nativeMetrics(canvas);
    const x = (NATIVE_W - measureText(font.fnt, this.text)) / 2;
    drawText(renderer, font, this.text, m.ox + x * m.s, m.oy + this.y * m.s, m.s, DEFAULT_TEXT_COLOR);
  }

  /** The tests' reset. */
  _reset() {
    this.text = '';
    this.timer = -1;
    this.delay = MID_SCREEN_TEXT_DEFAULT_DELAY;
    this.y = MID_SCREEN_TEXT_DEFAULT_Y;
    this._screenHeight = 0;
    this._scale = 1;
    this._largeHudHeight = null;
  }
}

/** One label per game (DaggerfallHUD.cs:33 - a field of the one HUD). */
export const midScreenText = new MidScreenText();

/** DaggerfallUI.cs:783-789's static funnel, which is how every caller
 *  in the reference reaches the label. */
export function setMidScreenText(message, delayInSeconds = MID_SCREEN_TEXT_DEFAULT_DELAY) {
  midScreenText.set(message, delayInSeconds);
}
