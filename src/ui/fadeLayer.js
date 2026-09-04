// D4 - THE FADE LAYER: FadeBehaviour.cs (MIT, Daggerfall Workshop),
// ported whole. A hundred and thirty lines of C# with no asset and no
// table behind it, and the port had none of it: every scene transition
// that DFU covers with black - fast travel, the Mages Guild teleport,
// a load, a building door, a vampire waking - cut straight from one
// frame of the old world to one frame of the new.
//
// WHAT THE PANEL IS, because it decides the draw order. DaggerfallUI
// hands the behaviour ONE target: `fadeBehaviour.FadeTargetPanel =
// dfHUD.ParentPanel` (DaggerfallUI.cs:409). That is the HUD window's
// root panel, and a Panel draws its own BackgroundColor and THEN its
// children (the vitals, the compass, the crosshair, the escort faces).
// So a smashed-to-black HUD is black over the WORLD and under every
// HUD element - the bars stay readable on the black, which is exactly
// what the classic does. Here that is one screen quad drawn at the top
// of `drawHud`, above the viewmodel and below the bars.
//
// AND IT IS THE SAME PANEL THE NEAR-DEATH FLICKER WRITES.
// HUDFlickerController is a component of that same ParentPanel
// (DaggerfallHUD.cs:163) and its NextCycle assigns
// `Parent.BackgroundColor` (HUDFlickerController.cs:81-82) - one
// colour, two writers. That is the whole reason NextCycle opens with
// `FadeBehaviour.FadeInProgress || Parent.BackgroundColor.a > 0.9`
// (:46-47, commented "prevents conflict with fade in from black"):
// without those two gates the flicker's Normal arm would clear a
// smashed-black screen on the very next frame. ui/hudFlicker.js has
// carried both parameters since AUDIT 28 W2d with nothing to feed
// them; `ui/hud.js` feeds them from here now, and the flicker's write
// lands in this module's `backgroundColor` rather than in a second
// quad of its own.
//
// THE TICK IS FRAME-QUANTISED, AND THAT IS A LAW, NOT A ROUNDING.
// TickFade (:97-122) accumulates real dt into `fadeTimer`, and on any
// frame where the accumulator passes 0.02 it advances `fadeTotalTime`
// by EXACTLY 0.02 - not by the elapsed time - and zeroes the timer.
// At 60 fps (dt about 0.0167) two frames are needed to pass the step,
// so the fade advances 0.02 per two frames: 0.6 units of progress per
// real second, and DFU's "0.5 second" fade takes about five sixths of
// a second. Ported verbatim, quirk included; a fade rewritten to step
// by dt would be smoother and wrong.
//
// The other quirks, each kept:
//  - SmashHUDToBlack (:54-60) sets the colour and NOTHING else. It
//    does not raise fadeInProgress and does not stop a fade already
//    running, so a smash during a fade is overwritten by that fade's
//    next step. Both callers this slice wires smash from a standstill.
//  - ClearFade (:86-95) zeroes the timers and the flag but leaves
//    fadeDuration and the two endpoint colours where they were.
//  - Completion is `fadeTotalTime > fadeDuration`, strictly, tested in
//    the same call that just stepped, so the end colour is assigned
//    twice on the closing frame (once by the lerp, once exactly).
//  - Every one of the five entry points returns early on a null target
//    panel or `allowFade` false; the tick tests all three.
//
// WHO CALLS IT. DFU's producers are the scene transitions
// (PlayerEnterExit, SaveLoadManager, StartGameBehaviour, PlayerDeath,
// TransportManager, VampirismInfection, the Teleport effect) plus the
// two travel windows this slice closes - DaggerfallTravelPopUp.cs:242
// and :381, DaggerfallTeleportPopUp.cs:137 and :150. Its one consumer
// besides the flicker is UserInterfaceManager.PushWindow, which clears
// an in-flight fade whenever any window is pushed (:88-89).

/** FadeHUDToBlack / FadeHUDFromBlack's default argument (:62, :74). */
export const DEFAULT_FADE_DURATION = 0.5;
/** TickFade's `const float fadeStep` (:99). */
export const FADE_STEP = 0.02;
/** Unity's Color.black and Color.clear, which are the only two
 *  endpoints this behaviour ever lerps between. */
export const FADE_BLACK = Object.freeze([0, 0, 0, 1]);
export const FADE_CLEAR = Object.freeze([0, 0, 0, 0]);

/** Color.Lerp: t is CLAMPED to [0,1] and every channel moves. */
function lerpColor(a, b, t) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}

/**
 * FadeBehaviour.cs, one class. The Unity Panel it drives is reduced to
 * the one thing it reads and writes - `backgroundColor` - and
 * `hasTarget` stands in for `fadeTargetPanel != null`, which is false
 * only in the window between startup and the HUD being pushed.
 */
export class FadeBehaviour {
  constructor() {
    this.allowFade = true;          // :22, DFU's own default
    this.fadeInProgress = false;
    this.hasTarget = true;          // fadeTargetPanel, assigned once at DaggerfallUI.cs:409
    /** fadeTargetPanel.BackgroundColor - the HUD parent panel's own. */
    this.backgroundColor = [...FADE_CLEAR];
    this.fadeTimer = 0;
    this.fadeTotalTime = 0;
    this.fadeDuration = 0;
    this.fadeStartColor = [...FADE_CLEAR];
    this.fadeEndColor = [...FADE_CLEAR];
  }

  /** The guard the four public entry points share (:56, :64, :76, :88). */
  _blocked() { return !this.hasTarget || !this.allowFade; }

  /** SmashHUDToBlack (:54-60). */
  smashHUDToBlack() {
    if (this._blocked()) return;
    this.backgroundColor = [...FADE_BLACK];
  }

  /** FadeHUDToBlack (:62-72). */
  fadeHUDToBlack(fadeDuration = DEFAULT_FADE_DURATION) {
    if (this._blocked()) return;
    this.fadeStartColor = [...FADE_CLEAR];
    this.fadeEndColor = [...FADE_BLACK];
    this.fadeDuration = fadeDuration;
    this.backgroundColor = [...FADE_CLEAR];
    this.fadeInProgress = true;
  }

  /** FadeHUDFromBlack (:74-84). */
  fadeHUDFromBlack(fadeDuration = DEFAULT_FADE_DURATION) {
    if (this._blocked()) return;
    this.fadeStartColor = [...FADE_BLACK];
    this.fadeEndColor = [...FADE_CLEAR];
    this.fadeDuration = fadeDuration;
    this.backgroundColor = [...FADE_BLACK];
    this.fadeInProgress = true;
  }

  /** ClearFade (:86-95) - note fadeDuration and the endpoints stand. */
  clearFade() {
    if (this._blocked()) return;
    this.backgroundColor = [...FADE_CLEAR];
    this.fadeTimer = 0;
    this.fadeTotalTime = 0;
    this.fadeInProgress = false;
  }

  /** TickFade (:97-122), on OnGUI's Time.deltaTime. */
  tickFade(dt) {
    if (!this.hasTarget || !this.fadeInProgress || !this.allowFade) return;
    this.fadeTimer += dt;
    if (this.fadeTimer > FADE_STEP) {
      // The step is a CONSTANT 0.02, not the elapsed time - see the header.
      this.fadeTotalTime += FADE_STEP;
      const progress = this.fadeTotalTime / this.fadeDuration;
      this.backgroundColor = lerpColor(this.fadeStartColor, this.fadeEndColor, progress);
      this.fadeTimer = 0;
    }
    if (this.fadeTotalTime > this.fadeDuration) {
      this.backgroundColor = [...this.fadeEndColor];
      this.fadeTimer = 0;
      this.fadeTotalTime = 0;
      this.fadeInProgress = false;
    }
  }

  /** The panel's background, as the one screen quad it is. Answers
   *  whether anything drew, the way the damage flash's does. */
  draw(renderer, canvas) {
    const c = this.backgroundColor;
    if (!(c[3] > 0)) return false;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height },
      undefined, [c[0], c[1], c[2], c[3]]);
    return true;
  }
}

// THE ONE HUD PARENT PANEL. DFU has exactly one FadeBehaviour - it is
// a RequireComponent of DaggerfallUI (:43) and reached everywhere as
// `DaggerfallUI.Instance.FadeBehaviour` - so the port has one module
// singleton, for the reason ui/damageFlash.js has one: a fade threaded
// through six layers of host callbacks is a fade some host forgets.
export const hudFade = new FadeBehaviour();
