// FPS-CAP1 (2026-09-25, Mac: "Add FPS limiter to settings") - THE FRAME
// RATE CAP. DFU's `Video/TargetFrameRate` had sat in the store since the
// settings screen shipped, labelled "Frame Rate Cap" and read by nothing.
// This is its consumer: StartGameBehaviour.ApplyStartSettings' two lines,
// `if (TargetFrameRate >= 30 && !VSync) Application.targetFrameRate =
// TargetFrameRate` (StartGameBehaviour.cs:244-250), with the setting read
// the way SettingsManager reads it, GetInt(0, 300) (SettingsManager.cs:414).
//
// ONE RECORDED DEPARTURE: THE CAP HOLDS UNDER VSYNC. Unity ignores
// targetFrameRate while vSyncCount is set, so DFU's rule turns the cap
// off whenever VSync is on. A browser has no other mode: every frame
// waits for the screen, and `Video/VSync` is unavailable here for that
// reason (systems/settings.js UNAVAILABLE). Read DFU's way, the cap
// could never do anything. So it holds frames BACK from the screen's
// rate, which is the only thing a page can do - it never runs faster.
//
// HOW A FRAME IS HELD. Each host's rAF callback asks `frameCapSkip(now)`
// before its clock stamp and its input frame (the pins in
// test/fpscap1.test.js say where). A held callback re-arms and returns:
// nothing is simulated or drawn, `last` does not move (so the next drawn
// frame's dt covers the held time), and the input rings keep gathering
// (beginInputFrame has not run), so no key press is lost. The decision
// is made ONCE per rAF stamp, because every callback of one browser
// frame is handed the same stamp - so the FPS counter (ui/fpsCounter.js),
// which runs on its own rAF, asks the same question and counts the
// frames the game drew, not the screen's refresh.
import { getInt } from './settings.js';

/** SettingsManager.cs:414 - GetInt(sectionVideo, "TargetFrameRate", 0, 300). */
export const FRAME_CAP_MAX = 300;
/** StartGameBehaviour.cs:246-247: "anything below 30 is ignored and treated as disabled". */
export const FRAME_CAP_FLOOR = 30;
/** The rates the settings row steps through (ui/settingsLaw.js): Off, then what screens run at. */
export const FRAME_CAP_STOPS = Object.freeze([0, 30, 45, 60, 75, 90, 120, 144, 165, 240, FRAME_CAP_MAX]);
/** A frame due within this much of its slot is drawn. rAF stamps wobble by a fraction of a millisecond,
 *  and a frame that just missed its slot would otherwise wait a whole extra refresh - a 60 cap on a 60 Hz
 *  screen dropping to 30. */
export const FRAME_CAP_SLACK_MS = 1;

/** The cap in force for a stored value: frames a second, or 0 for none. */
export function frameCapRate(n) {
  return Number.isFinite(n) && n >= FRAME_CAP_FLOOR ? Math.min(FRAME_CAP_MAX, Math.floor(n)) : 0;
}

/** The player's cap, read as DFU reads it. */
export function frameCapFps() {
  return frameCapRate(getInt('Video', 'TargetFrameRate', 0, 300));   // spelled out: MENU T5 reads this clamp against the row's range
}

/**
 * THE GATE, pure: is the callback stamped `now` held back? `state` is
 * `{ due, at, held }`: the next frame's slot, the last stamp decided and
 * its answer. A frame that is drawn books the next slot one interval on;
 * a frame drawn a whole interval late (a hidden tab, a long load) books
 * from itself instead of racing to catch up.
 * @param {{due:number, at:number, held:boolean}} state
 * @param {number} now the rAF stamp, ms
 * @param {number} fps the cap in force (0 = none)
 */
export function capStep(state, now, fps) {
  if (state.at === now) return state.held;   // one decision per stamp: the host and the counter agree
  state.at = now;
  if (!fps) { state.due = 0; return (state.held = false); }
  const interval = 1000 / fps;
  if (state.due && now < state.due - FRAME_CAP_SLACK_MS) return (state.held = true);
  state.due = state.due && now - state.due < interval ? state.due + interval : now + interval;
  return (state.held = false);
}

const _state = { due: 0, at: -1, held: false };

/** A host's question at the top of its frame: hold this one back? */
export function frameCapSkip(now) { return capStep(_state, now, frameCapFps()); }

export function _resetFrameCap() { _state.due = 0; _state.at = -1; _state.held = false; }
