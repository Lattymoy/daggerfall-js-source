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
// reason (systems/settings/settings.js UNAVAILABLE). Read DFU's way, the cap
// could never do anything. So it holds frames BACK from the screen's
// rate, which is the only thing a page can do - it never runs faster.
// FPS-VSYNC (2026-09-28): EXCEPT IN THE DESKTOP APP WITH VSYNC OFF. The
// shell lifts Chromium's wait at launch (app/lib/frameRate.cjs), rAF
// then runs past the screen, and the cap is what holds the frames -
// DFU's targetFrameRate exactly, Off letting them run free - through
// THE PACER below, not this gate alone (AUDIT 28e).
//
// HOW A FRAME IS HELD. Each host's rAF callback asks `frameCapSkip(now)`
// before its clock stamp and its input frame (the pins in
// test/ui/settings/fpscap1.test.js say where). A held callback re-arms and returns:
// nothing is simulated or drawn, `last` does not move (so the next drawn
// frame's dt covers the held time), and the input rings keep gathering
// (beginInputFrame has not run), so no key press is lost. The decision
// is made ONCE per rAF stamp, because every callback of one browser
// frame is handed the same stamp - so the FPS counter (ui/fpsCounter.js),
// which runs on its own rAF, asks the same question and counts the
// frames the game drew, not the screen's refresh.
import { getInt } from './settings/settings.js';

/** SettingsManager.cs:414 - GetInt(sectionVideo, "TargetFrameRate", 0, 300). */
export const FRAME_CAP_MAX = 300;
/** StartGameBehaviour.cs:246-247: "anything below 30 is ignored and treated as disabled". */
export const FRAME_CAP_FLOOR = 30;
/** The rates the settings row steps through (ui/settings/settingsLaw.js): Off, then what screens run at. */
export const FRAME_CAP_STOPS = Object.freeze([0, 30, 45, 60, 75, 90, 120, 144, 165, 240, FRAME_CAP_MAX]);
/** A frame due within this much of its slot is drawn. rAF stamps wobble by a fraction of a millisecond,
 *  and a frame that just missed its slot would otherwise wait a whole extra refresh - a 60 cap on a 60 Hz
 *  screen dropping to 30. */
export const FRAME_CAP_SLACK_MS = 1;
/** THE PACER asks for its frame this much before the slot: the browser's answer takes about a millisecond, and an ask
 *  made after the browser's idle tick waits a whole refresh (FPS-VSYNC, AUDIT 28e; the frame lane's 1.5). */
export const PACER_LEAD_MS = 1.5;

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

/** THE PACER'S STAMP IS A SLOT (FPS-VSYNC, AUDIT 28e): the gate's one decision for `stamp` made "drawn", and the next
 *  slot booked as a drawn frame books it - an interval on from the slot it answers (so the cadence is the cap's, not the
 *  timer's), or from itself when a whole interval late. The pacer asks for its frame a little EARLY (a callback that
 *  arrives past an idle tick of the browser's waits a refresh), and a gate that held that early stamp would spend the
 *  refresh anyway. The hosts' own question for the same stamp then reads this answer. */
export function capTake(state, stamp, fps) {
  state.at = stamp;
  state.held = false;
  if (!fps) { state.due = 0; return; }
  const interval = 1000 / fps;
  state.due = state.due && stamp - state.due < interval ? state.due + interval : stamp + interval;
}

export function _resetFrameCap() { _state.due = 0; _state.at = -1; _state.held = false; }

/**
 * THE PACER (FPS-VSYNC, AUDIT 28e: the frame lane measured it). With Chromium's frame-rate limit lifted, a rAF callback
 * that draws nothing costs a whole refresh: the display scheduler waits out the screen's deadline for a frame with no
 * damage (display_scheduler.cc: `if (!needs_draw_) return kLate`), and the back-to-back begin-frame source ticks again
 * only after a frame finishes - so an ask that comes after an idle tick waits that tick's refresh out too. So the gate
 * alone - a held callback re-arms and returns - held every cap UNDER the screen: 300 drew 56 a second on a 60 Hz one.
 * There, and only there, the page's rAF is paced instead: a request waits on a timer until just before its slot
 * (PACER_LEAD_MS) and is handed to the browser only then, and the frame that answers IS the slot (capTake) - so no
 * callback runs that does not draw. Every request of one slot rides one browser frame with one stamp, whoever made it
 * (a host, the counter, a menu's loop, a window's one-off), and the hosts' own question for that stamp reads the same
 * answer and draws. The cap Off hands every request straight through: DFU's VSync off with no target frame rate, as
 * fast as it goes. Measured in the app (Electron 42 under Xvfb, the frame lane's harness): 144, 240 and 300 draw 144,
 * 240 and 300. Pure over its seams, so the tests drive it on a clock of their own.
 * @param {{ raf: (cb: (t:number) => void) => number, caf: (id:number) => void, later: (fn: () => void, ms:number) => unknown,
 *   now: () => number, fps: () => number, take: (stamp:number) => void, due: () => number, report?: (e:unknown) => void }} seams
 */
export function createFramePacer({ raf, caf, later, now, fps, take, due, report = (e) => { setTimeout(() => { throw e; }); } }) {
  const queue = new Map();
  let nextId = 2 ** 30;   // clear of the browser's own ids, so a cancel of one IT minted (a caller from before the install) passes through
  let native = null, timer = null;
  const run = (stamp) => {
    native = null;
    take(stamp);   // this frame is the slot: drawn, the next one booked
    const batch = [...queue.values()];
    queue.clear();   // a request made while the batch runs is the NEXT slot's
    for (const cb of batch) { try { cb(stamp); } catch (e) { report(e); } }   // one callback's throw is not the others'
  };
  function arm() {
    if (native != null || timer != null || queue.size === 0) return;
    const wait = fps() > 0 ? due() - PACER_LEAD_MS - now() : 0;
    if (wait > 0) timer = later(() => { timer = null; native = raf(run); }, wait);
    else native = raf(run);
  }
  return {
    request(cb) { const id = nextId++; queue.set(id, cb); arm(); return id; },
    cancel(id) { if (!queue.delete(id)) caf(id); },
    get pending() { return queue.size; },
  };
}

/** Put the pacer in front of the page's rAF - only where the shell lifted the wait at launch (`daggerShell.framesLifted`,
 *  app/preload.cjs: the switches main.cjs appended, not the setting as it stands now - a VSync changed since takes
 *  effect at the next start, as the settings screen says). A browser, or the app with VSync on, is left alone: there
 *  every frame waits for the screen and the gate holds frames as it always did. Once; true when installed. */
export function installFramePacer(win = globalThis) {
  if (!win?.daggerShell?.framesLifted || typeof win.requestAnimationFrame !== 'function' || win.__framePacer) return false;
  const raf = win.requestAnimationFrame.bind(win), caf = win.cancelAnimationFrame.bind(win);
  const pacer = createFramePacer({
    raf, caf, later: (fn, ms) => win.setTimeout(fn, ms), now: () => win.performance.now(),
    fps: frameCapFps, take: (stamp) => capTake(_state, stamp, frameCapFps()), due: () => _state.due,
    report: (e) => (typeof win.reportError === 'function' ? win.reportError(e) : win.setTimeout(() => { throw e; })),
  });
  win.requestAnimationFrame = (cb) => pacer.request(cb);
  win.cancelAnimationFrame = (id) => pacer.cancel(id);
  win.__framePacer = pacer;
  return true;
}
