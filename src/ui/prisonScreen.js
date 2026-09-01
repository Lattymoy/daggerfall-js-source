// THE PRISON SCREEN - DaggerfallCourtWindow's serving-time half
// (DaggerfallCourtWindow.cs, MIT, Daggerfall Workshop; original
// author Allofich). The court's LAWS live in systems/court.js and the
// window sequence in scenes/arrestFlow.js; this is the picture the
// player actually sits in front of while the sentence passes.
//
// DFU's court window is ONE window with two backgrounds. It opens on
// CORT01I0.IMG (:31, :77) - the courtroom - and every message box of
// the trial is PUSHED OVER it. When the verdict is prison, state 3
// calls SwitchToPrisonScreen (:511-524), which swaps the panel to
// PRIS00I0.IMG and writes the days-until-freedom label; state 100
// then ticks UpdatePrisonScreen (:465-480) every
// prisonUpdateInterval seconds until the counter empties.
//
// The counter is the whole presentation: one day per 0.3 SECONDS of
// real time, an interval DFU's own comment calls "Approximated to
// classic based on measuring a video recording" (:55). A thirty-day
// sentence is nine seconds of watching the number fall - which is why
// the port's old one-line "You serve 30 days in prison." box was not
// a shorthand for this screen but a replacement of it.
//
// The end of the countdown is not cosmetic either. UpdatePrisonScreen
// only raises the clock when daysInPrisonLeft reaches ZERO
// (:471-479), and it raises it by the WHOLE sentence at once -
// daysInPrison * 1440 * 60 seconds - after setting both prevent
// flags. The arrest flow owns that arm through onEndPrisonTime; this
// window owns the clock that reaches it.
//
// ROAD-B B5 RETIRED THE BACKDROP FLAG. It read: "the trial's own
// message boxes still stand on the port's plain overlay panel rather
// than over CORT01I0... townTalk's overlay slot holds exactly one
// occupant, so the backdrop behind the plea boxes waits on a stacking
// seam". B1 landed the stacking seam. CourtScreenWindow below is
// Setup's courtPanel (:75-84) - the courtroom, opened before the first
// plea box and standing under every one of them - and arrestFlow
// pushes the trial over it.
//
// ONE DEVIATION, named: DFU has ONE window with two backgrounds, and
// SwitchToPrisonScreen (:511-524) swaps the texture in place. Here the
// prison screen is a separate window laid at the same stack level (the
// port's showOverlay is DFU's CloseWindow-then-Push, which nets to a
// one-level replacement). Both panels are the same opaque 320x200
// native panel at the same anchor, so the screen is identical; what
// differs is which object owns it.

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText, NATIVE_W } from './nativePanel.js';
import { DFPalette } from '../formats/dfPalette.js';

/** nativeImgName / nativeImgName2 (:31-32). */
export const COURT_IMG = 'CORT01I0.IMG';
export const PRISON_IMG = 'PRIS00I0.IMG';

/** prisonUpdateInterval (:55) - "Approximated to classic based on
 *  measuring a video recording." One in-game day per tick. */
export const PRISON_UPDATE_INTERVAL = 0.3;
/** The held-Back accelerator (:301-304). DFU labels it "Not in
 *  classic" itself, and it is a HELD read: `InputManager.GetBackButton()`
 *  is `Input.GetKey(KeyCode.Escape)` (InputManager.cs:1075-1078) - the
 *  RAW key, not a binding and not routed through any window - polled
 *  every frame of state 100, so the interval flips back the moment the
 *  key comes up.
 *
 *  ROAD-B B5 wired it. The sentence that stood here said "the port's
 *  overlay slot has no key-HELD edge, so no host wires it today", and
 *  it was true of the SLOT and false of the hosts: both outdoor hosts
 *  keep a live held-keys set, they simply return out of their keydown
 *  ladder before reaching it while a window is up - which is exactly
 *  what DFU's raw poll does not do. */
export const PRISON_UPDATE_INTERVAL_FAST = 0.001;

/** daysUntilFreedomLabel's anchor (:91) - HorizontalAlignment.Center
 *  overrides the 156, so only the 165 is load-bearing; the x is kept
 *  because DFU writes it. */
export const DAYS_LABEL_POS = Object.freeze([156, 165]);
/** DaggerfallUI.cs:72-73. */
export const DAYS_LABEL_COLOR = Object.freeze([232 / 255, 196 / 255, 76 / 255, 1]);
export const DAYS_LABEL_SHADOW = Object.freeze([48 / 255, 36 / 255, 20 / 255, 1]);

/** Internal_Strings.csv:108 - `daysUntilFreedom`, the key
 *  UpdatePrisonScreen and SwitchToPrisonScreen both read. */
export const DAYS_UNTIL_FREEDOM = '%d days until freedom.';

/** The label DFU builds: GetLocalizedText then a plain %d replace
 *  (:468-469, :522-523). `localizedText` is the port's TextManager
 *  seam; a host that answers nothing falls back to the shipped row. */
export function daysUntilFreedomText(days, localizedText = null) {
  const t = localizedText?.('daysUntilFreedom') || DAYS_UNTIL_FREEDOM;
  return t.replace('%d', String(days));
}

let _courtArt = null;
/** ROAD-B B5 - Setup's `GetTextureFromImg(nativeImgName)` (:75).
 *
 *  THE PALETTE LAW, and it is the same one PRIS00I0 broke on
 *  2026-09-01: CORT01I0 is a palettized IMG - ImgFile._readPalette
 *  writes INTO the palette instance it is handed - so it MINTS ITS
 *  OWN DFPalette and is never given the host's shared ART_PAL. One
 *  boot-time preload with the session palette repaints every texture
 *  decoded after it for the rest of the session. Read
 *  test/incident_texture.test.js before touching this line. */
export async function preloadCourtScreenArt(deps) {
  if (!_courtArt) _courtArt = { court: await loadImg({ ...deps, palette: new DFPalette() }, COURT_IMG) };
  return _courtArt;
}
export const courtScreenArtLoaded = () => !!_courtArt;
export function _setCourtScreenArtForTests(art) { _courtArt = art; }

/**
 * The COURTROOM backdrop - Setup's courtPanel (:75-84), the window the
 * whole trial is pushed over. Its own input does nothing:
 * `AllowCancel = false` (:97), so neither Escape nor Enter walks out
 * of a trial.
 *
 * `done` is the port's pop: DFU's court window closes itself from
 * state 100 (ReleaseFromPrison -> CancelWindow, :490), which lands
 * one frame AFTER the last box has popped off it - and townTalk's
 * frame drains a `done` overlay every tick, so setting the flag while
 * the final box is still up gives exactly that ordering.
 */
export class CourtScreenWindow {
  constructor() {
    this.done = false;
    this.isChoiceWindow = true;   // the overlay slot's modal flag
  }

  /** AllowCancel = false (:97). */
  input() {}

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    if (_courtArt) {
      drawImg(renderer, _courtArt.court, m, Math.floor((NATIVE_W - _courtArt.court.w) / 2), 0);
    } else {
      drawRect(renderer, m, 0, 0, NATIVE_W, 200, [0.03, 0.03, 0.04, 1]);
    }
  }
}

let _art = null;
export async function preloadPrisonScreenArt(deps) {
  // PRIS00I0 is one of the SIX palettized IMGs: ImgFile._readPalette
  // writes INTO the palette it is handed, so it gets its OWN DFPalette
  // and never the host's shared ART_PAL (the U18/17k law - see
  // titleScreen.js:44-46). The A3 slice took `deps` whole and the
  // shared palette rode in with it: ONE boot-time preload repainted
  // every texture decoded after it - weapons gold, caves and
  // exteriors off - for the entire session (the 2026-09-01 incident).
  if (!_art) _art = { prison: await loadImg({ ...deps, palette: new DFPalette() }, PRISON_IMG) };
  return _art;
}
export const prisonScreenArtLoaded = () => !!_art;
/** Tests reach the loaded art through the same door the window does. */
export function _setPrisonScreenArtForTests(art) { _art = art; }

export class PrisonScreenWindow {
  /** deps: { daysInPrison, localizedText, onEndPrisonTime, speedUp }.
   *  `onEndPrisonTime` is UpdatePrisonScreen's zero arm (:471-479) -
   *  the flow's, because every line in it writes the player entity or
   *  the clock. It stands in for RaiseOnEndPrisonTimeEvent (:476) too,
   *  which is raised in the middle of that arm and which NOTHING in
   *  DFU subscribes to - an event with no listener, so the port owes
   *  it no seam of its own. */
  constructor({ daysInPrison = 0, localizedText = null, onEndPrisonTime = null, speedUp = null } = {}) {
    this.daysInPrison = daysInPrison;
    // state 3 (:258): daysInPrisonLeft = daysInPrison, and
    // SwitchToPrisonScreen has already written the label with the FULL
    // sentence - the first number the player sees is the whole term.
    this.daysInPrisonLeft = daysInPrison;
    this.label = daysUntilFreedomText(daysInPrison, localizedText);
    this.localizedText = localizedText;
    this.onEndPrisonTime = onEndPrisonTime;
    this.speedUp = speedUp;
    this.timer = 0;
    this.served = false;
    this.done = false;
    this.isChoiceWindow = true;   // the overlay slot's modal flag
  }

  /** AllowCancel = false (:97). Nothing the player presses cuts a
   *  sentence short - not Escape, not Enter. */
  input() {}

  /** UpdatePrisonScreen (:465-480), driven by state 100's timer
   *  (:299-316). DECREMENT FIRST, then the label, then the zero test:
   *  a one-day sentence shows "1", then "0", and only the 0 releases. */
  updatePrisonScreen() {
    this.daysInPrisonLeft--;
    this.label = daysUntilFreedomText(this.daysInPrisonLeft, this.localizedText);
    if (this.daysInPrisonLeft === 0) {
      this.served = true;
      this.onEndPrisonTime?.(this.daysInPrison);
      // state 100 with InPrison now false runs ReleaseFromPrison,
      // which ends in CancelWindow (:490) - the flow's onClosed.
      this.done = true;
    }
  }

  tick(dt) {
    if (this.done) return;
    const interval = this.speedUp?.() ? PRISON_UPDATE_INTERVAL_FAST : PRISON_UPDATE_INTERVAL;
    this.timer += dt;
    // DFU compares against realtimeSinceStartup + interval and resets
    // the stamp on each fire, so a long frame ticks ONE day, not many.
    if (this.timer < interval) return;
    this.timer = 0;
    this.updatePrisonScreen();
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    // courtPanel: HorizontalAlignment.Center at the texture's own size
    // (:82-84), vertical alignment untouched, so it sits at the top.
    if (_art) {
      drawImg(renderer, _art.prison, m, Math.floor((NATIVE_W - _art.prison.w) / 2), 0);
    } else {
      drawRect(renderer, m, 0, 0, NATIVE_W, 200, [0.03, 0.03, 0.04, 1]);
    }
    if (!font) return;
    shadowText(renderer, font, this.label, m, 0, DAYS_LABEL_POS[1], {
      color: DAYS_LABEL_COLOR, shadow: DAYS_LABEL_SHADOW, align: 'center', w: NATIVE_W,
    });
  }
}
