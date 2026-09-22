// TO1: THE TRAVEL CONTROL PANEL - TravelControlUI.cs (Hazelnut, MIT,
// contributor Jedidia), the strip that sits across the top of the
// screen while an accelerated journey runs: where you are going, how
// fast time is passing, and three buttons - the map, the camp, the way
// out.
//
// NOT AN OVERLAY. In DFU it is a `DaggerfallPopupWindow` with
// `pauseWhileOpened = false` and a clear background (:83-84), which is
// a window that does not stop the game - the player keeps walking
// underneath it. The port's overlay slot is the opposite: a townTalk
// overlay HOLDS the motor and the world clock (scenes/world.js:9779,
// `_overlayHeld`), which is exactly what a journey must not do. So this
// panel lives on the HUD layer, drawn by the host's `drawHud` pass and
// clicked through the host's pointer ladder beside the large HUD's own
// router (ui/hudLarge.js routeLargeHudClick) - the same place, and for
// the same reason, DFU's own HUD elements live.
//
// It draws at the NATIVE 320x200 scale like every classic window
// (ui/nativePanel.js), so the strip is the mod's 320x27 image at the
// top, centred, whatever the canvas is.
//
// THE ART is the mod's own `TOcontrolUI.png`, vendored and re-encoded
// out of its bundle (vendor/travel-options/README.md says how and why).
// The spinner over it is DFU's `UpDownSpinner`, whose art and geometry
// the port already has for the chargen rollout (ui/chargenArt.js
// UD_SPINNER, CHAR02I1.IMG) - the mod adds the spinner as a component
// and does not ship art for it (:106-110).

import { loadImg, nativeMetrics, drawImg, shadowText, NATIVE_W } from './nativePanel.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { accelLimitOf, halfAccelLimitOf } from '../systems/timeScale.js';
import { TRAVEL_OPTIONS_TEXT as T } from '../systems/travelOptionsText.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';

/** TravelControlUI.cs:19-24 - every rect on the strip, virtual pixels
 *  of the 320x200 screen. The panel itself is `baseSize` at the top
 *  centre (:98-103), so these are relative to its own top-left, which
 *  on a 320-wide screen is (0, 0). */
export const CONTROL_RECTS = Object.freeze({
  panel: [0, 0, 320, 27],
  dest: [5, 14, 152, 7],
  timeAccel: [163, 4],
  map: [183, 3, 45, 21],
  camp: [230, 3, 45, 21],
  exit: [279, 3, 38, 21],
});

/** :116-119 - the message label hangs BELOW the strip, on the screen's
 *  own panel rather than the strip's, centred. */
export const MESSAGE_POS = Object.freeze([0, 32]);

/** :160 - a message shows for three seconds of UNSCALED time, so a x50
 *  journey does not blink it away in a frame. */
export const MESSAGE_SECONDS = 3;

/** ui/chargenArt.js UD_SPINNER, which is UpDownSpinner.cs:96-116 - the
 *  15x20 widget, its up arrow, its value row and its down arrow. */
export const UD_SPINNER = Object.freeze({ w: 15, h: 20, up: [0, 0, 15, 7], value: [0, 7, 15, 6], down: [0, 13, 15, 7] });

/** :222-236 - the two steps. Below five the spinner moves by one, at
 *  five and above by five, and it never goes under 1 or over the
 *  limit in force (which is halved while a path is being followed). */
export function fasterAcceleration(current, limit) {
  return current < 5 ? current + 1 : Math.min(limit, current + 5);
}
export function slowerAcceleration(current) {
  return current <= 5 ? Math.max(1, current - 1) : Math.max(1, current - 5);
}

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

let _art = null;
/** The strip's own image, from the vendor folder. A host that cannot
 *  load it gets a panel that draws its text on a plain bar rather than
 *  nothing: the journey is still steerable, which is what the mod's own
 *  `Debug.LogError` arm (:207-210) leaves the player with. */
export async function preloadTravelControlArt(deps = {}) {
  if (_art) return _art;
  const fetchFn = deps.fetchFn ?? globalThis.fetch;
  const url = new URL('../../vendor/travel-options/Textures/TOcontrolUI.png', import.meta.url).href;
  let strip = null;
  try {
    const res = await fetchFn(url);
    if (res?.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const { decodePng } = await import('../systems/textureReplacement.js');
      const { toScreenOrder } = await import('../formats/color32Order.js');
      // AUDIT-TO1 E1: a decoded PNG is `{ width, height, data }`, which is
      // what uploadTexture EATS, not what drawImg DRAWS - drawImg reads
      // `img.tex` (ui/nativePanel.js), and a decode stored as-is has none,
      // so drawScreenQuad ran untextured and painted the whole 320x27
      // strip as one opaque white bar with the yellow text on top. The
      // port's idiom for a vendored PNG on a screen quad is
      // handheldTorches.js:232 - toScreenOrder, then upload, then
      // `{ tex, w, h }` (loadImg's own shape, ui/nativePanel.js:44-49).
      const px = toScreenOrder(await decodePng(bytes));
      const tex = deps.renderer?.uploadTexture?.('img', 'travelopts:TOcontrolUI', px, { mips: false, variant: '#travelopts' }) ?? null;
      strip = tex ? { tex, w: px.width, h: px.height, key: 'TOcontrolUI' } : null;
    }
  } catch { strip = null; }
  let spinner = null;
  try { spinner = await loadImg(deps, 'CHAR02I1.IMG'); } catch { spinner = null; }
  _art = { strip, spinner };
  return _art;
}
export const travelControlArtLoaded = () => !!_art;
export function _setTravelControlArtForTests(art) { _art = art; }

/** The panel. `deps`: { onClose, onCancel, onTimeAccelerationChanged,
 *  binding } - the mod's three events (:245-252, :77-79) and the host's
 *  key-binding reader for the exit button's hotkey. */
export class TravelControlUI {
  /** :70-87, the constructor. `accelerationLimit` is rounded down to a
   *  multiple of five, and the half-limit is the same rounding of half
   *  of it - so a setting of 60 gives 60 and 30, and a setting of 55
   *  gives 55 and 25. */
  constructor({ defaultStartingAccel = 10, accelerationLimit = 100, ...deps } = {}) {
    this.deps = deps;
    this.timeAcceleration = defaultStartingAccel;
    this.accelLimit = accelLimitOf(accelerationLimit);
    this.halfAccelLimit = halfAccelLimitOf(accelerationLimit);
    this.halfLimit = false;          // :65
    this.isShowing = false;          // :56
    this.destinationName = '';
    this.message = '';
    this.messageTimer = 0;
    this.done = false;
    this.isChoiceWindow = true;      // the port's raw-key routing flag
  }

  /** :67-70, GetAccelerationLimit. */
  accelerationLimit() { return this.halfLimit ? this.halfAccelLimit : this.accelLimit; }

  /** :60-63, SetDestinationName. */
  setDestinationName(name) { this.destinationName = String(name ?? ''); }

  /** :156-163, ShowMessage - three seconds of unscaled time. */
  showMessage(message) { this.message = String(message ?? ''); this.messageTimer = MESSAGE_SECONDS; }

  /** :186-193, OnPush - the panel appears and the acceleration is
   *  clamped into the limit in force. */
  show() {
    this.isShowing = true;
    this.done = false;
    this.timeAcceleration = Math.max(1, Math.min(this.accelerationLimit(), this.timeAcceleration));
  }

  /** :195-199, OnPop. */
  _pop() { this.isShowing = false; this.message = ''; this.messageTimer = 0; }

  /** DaggerfallPopupWindow.CloseWindow - the CAMP button and the C key
   *  (:136-141). The journey stops, the destination stays, so the map's
   *  resume prompt can pick it up again. */
  closeWindow() {
    if (!this.isShowing) return;
    this._pop();
    this.deps.onClose?.();
  }

  /** CancelWindow - the EXIT button and its binding (:143-147). The
   *  destination is cleared as well: this is "I am not going there".
   *  The mod wires OnCancel to ClearTravelDestination and OnClose to
   *  InterruptTravel (:377-379), and a cancel raises BOTH, because
   *  DFU's CancelWindow calls CloseWindow underneath. */
  cancelWindow() {
    if (!this.isShowing) return;
    this._pop();
    this.deps.onCancel?.();
    this.deps.onClose?.();
  }

  _accelChanged() { this.deps.onTimeAccelerationChanged?.(this.timeAcceleration); }

  /** :220-236, the two spinner handlers. */
  faster() {
    this.timeAcceleration = fasterAcceleration(this.timeAcceleration, this.accelerationLimit());
    this._accelChanged();
  }
  slower() {
    this.timeAcceleration = slowerAcceleration(this.timeAcceleration);
    this._accelChanged();
  }

  /** :165-179, Update - the message's own clock. UNSCALED: the mod
   *  reads `Time.unscaledTime` so a x50 journey does not eat it, and
   *  the host hands this the real frame dt for the same reason. */
  tick(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) { this.message = ''; this.messageTimer = 0; }
    }
  }

  /** The three buttons' hotkeys: M and C are the mod's own literals
   *  (:130, :139), and EXIT takes the port's TravelExit binding exactly
   *  as the mod takes `DaggerfallShortcut.Buttons.TravelExit` (:144).
   *  Returns true when the key was the panel's. */
  input(code, e = null) {
    if (!this.isShowing) return false;
    const key = typeof code === 'string' ? code : '';
    if (firstHotkey(['TravelExit'], key, e) === 'TravelExit') { audio.playOneShot(SOUND.ButtonClick, 1); this.cancelWindow(); return true; }
    if (key === 'KeyM') { audio.playOneShot(SOUND.ButtonClick, 1); this.deps.onOpenMap?.(); return true; }
    if (key === 'KeyC') { audio.playOneShot(SOUND.ButtonClick, 1); this.closeWindow(); return true; }
    // :177-178 - the gamepad's Back button closes it too.
    if (key === 'Escape') { audio.playOneShot(SOUND.ButtonClick, 1); this.closeWindow(); return true; }
    return false;
  }

  /** :131-133 and :140-141 - the two buttons that carry a tooltip.
   *  EXIT has none in the mod (:143-147), and neither has the spinner. */
  tooltipAt(vx, vy) {
    if (!this.isShowing) return null;
    const x0 = Math.trunc((NATIVE_W - CONTROL_RECTS.panel[2]) / 2);
    if (inRect(CONTROL_RECTS.map, vx - x0, vy)) return T.TipMap;
    if (inRect(CONTROL_RECTS.camp, vx - x0, vy)) return T.TipCamp;
    return null;
  }

  /** A click in native (320x200) coordinates. Returns true when it was
   *  the panel's - the host stops there. */
  click(vx, vy) {
    if (!this.isShowing) return false;
    const x0 = Math.trunc((NATIVE_W - CONTROL_RECTS.panel[2]) / 2);
    const px = vx - x0, py = vy;
    if (!inRect(CONTROL_RECTS.panel, px, py)) return false;
    audio.playOneShot(SOUND.ButtonClick, 1);
    if (inRect(CONTROL_RECTS.map, px, py)) { this.deps.onOpenMap?.(); return true; }
    if (inRect(CONTROL_RECTS.camp, px, py)) { this.closeWindow(); return true; }
    if (inRect(CONTROL_RECTS.exit, px, py)) { this.cancelWindow(); return true; }
    // the spinner: its top half is up, its bottom half is down
    const [sx, sy] = CONTROL_RECTS.timeAccel;
    if (inRect([sx, sy, UD_SPINNER.w, UD_SPINNER.h], px, py)) {
      if (py < sy + UD_SPINNER.up[3]) this.faster();
      else if (py >= sy + UD_SPINNER.down[1]) this.slower();
      return true;
    }
    return true;   // the strip swallows a click that hit no button
  }

  /** :180-186, Draw. The mod also draws the HUD's vitals and compass
   *  over its own panel because a DFU window hides the HUD; the port's
   *  HUD is already underneath, so that pair is a recorded no-op here
   *  (bible/06-Systems/Travel-Options.md). */
  draw(renderer, canvas, font) {
    if (!this.isShowing) return;
    const m = nativeMetrics(canvas);
    const [, , pw, ph] = CONTROL_RECTS.panel;
    const x0 = Math.trunc((NATIVE_W - pw) / 2);   // :99-101 - centred, top
    if (_art?.strip?.tex) drawImg(renderer, _art.strip, m, x0, 0, pw, ph);   // AUDIT-TO1 E1: the uploaded strip, in drawImg's own shape
    // :113-115 - the destination label is centred inside its own panel
    const [dx, dy, dw] = CONTROL_RECTS.dest;
    if (this.destinationName) shadowText(renderer, font, this.destinationName, m, x0 + dx, dy, { align: 'center', w: dw });
    // the spinner: DFU's own widget, drawn at the mod's anchor
    const [sx, sy] = CONTROL_RECTS.timeAccel;
    if (_art?.spinner) drawImg(renderer, _art.spinner, m, x0 + sx, sy, UD_SPINNER.w, UD_SPINNER.h);
    const [vx, vy, vw] = UD_SPINNER.value;
    shadowText(renderer, font, String(this.timeAcceleration), m, x0 + sx + vx, sy + vy, { align: 'center', w: vw });
    // :116-119 - the message, centred under the strip on the screen itself
    if (this.message) shadowText(renderer, font, this.message, m, MESSAGE_POS[0], MESSAGE_POS[1], { align: 'center', w: NATIVE_W });
  }
}

export function createTravelControlUI(deps = {}) { return new TravelControlUI(deps); }
