// FIELD BUGS 2026-10-21b RENDERER-GONE (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md, BLACK-SCREEN; the Discord's
// #bug-reports: "Crashing every minute" - "No message just black", "when I enter dungeons or traveling overworld"): THE
// GAME'S PAGE STOPPED, AND THE SHELL SAID SO.
//
// A renderer that died after its version's trial (DA13 - gameStore.rollback answers null once the version has proved
// itself) was met by nothing: the window stood on its background colour, black, with no word and no way back but closing
// it. A browser tab says "Aw, Snap" - the shell said less. Now it says the game stopped and why (Electron's reason: out of
// memory, a crash, killed), keeps the reason in `crash.log` beside the saves, and offers Restart - and a page that stops
// answering (`unresponsive`) is offered Wait or Restart, as Chromium's own "Page unresponsive" does. A renderer dying
// again and again inside RESTART_SPAN_MS says so, so a loop of crashes is told, not hidden behind a restart.
//
// Pure, no Electron: app/main.cjs passes these to dialog.showMessageBox and does the restart (shellDialogs.cjs' shape).
'use strict';

/** Electron's render-process-gone reasons, in the player's words. */
const GONE_WHY = Object.freeze({
  oom: 'It ran out of memory.',
  crashed: 'It crashed.',
  killed: 'It was stopped by the system.',
  'launch-failed': 'It could not start.',
  'integrity-failure': 'Its code failed a check.',
  'abnormal-exit': 'It closed unexpectedly.',
});
/** How many stops inside RESTART_SPAN_MS make a loop worth saying. */
const LOOP_STOPS = 3;
const RESTART_SPAN_MS = 120_000;

/** The box when the page stopped: Restart is the default (Enter), Quit the cancel (Escape, the close). */
const goneAsk = (reason, stops = 1) => ({
  type: 'error',
  message: 'The game stopped',
  detail: `${GONE_WHY[reason] ?? 'It closed unexpectedly.'} Your saves are kept - progress since your last save is lost.`
    + (stops >= LOOP_STOPS ? `\n\nIt has stopped ${stops} times in the last two minutes. Closing other programs, or lowering the graphics settings, may help.` : ''),
  buttons: ['Restart', 'Quit'],
  defaultId: 0,
  cancelId: 1,
});
/** The answer to goneAsk that restarts the page. */
const restarts = (choice) => choice === 0;

/** The box when the page stops answering: Wait is the default and the cancel - a long load must not be thrown away. */
const hangAsk = () => ({
  type: 'warning',
  message: 'The game is not responding',
  detail: 'You can wait for it, or restart it - progress since your last save is lost.',
  buttons: ['Wait', 'Restart'],
  defaultId: 0,
  cancelId: 0,
});
/** The answer to hangAsk that restarts the page. */
const restartsHung = (choice) => choice === 1;

/** The stops inside RESTART_SPAN_MS, counted as they come: `stop(now)` answers how many, this one with them. */
function createStopCount() {
  const at = [];
  return {
    stop(now) {
      at.push(now);
      while (at.length && now - at[0] > RESTART_SPAN_MS) at.shift();
      return at.length;
    },
  };
}

/** crash.log's line for a process gone: when, which, why, and its exit code. */
const goneLine = (what, details, at) => `${new Date(at).toISOString()} ${what} ${details?.reason ?? 'unknown'} exitCode=${details?.exitCode ?? '?'}${details?.type ? ` type=${details.type}` : ''}\n`;
/** The log's most kept: past it, its oldest lines go. */
const CRASH_LOG_MAX = 64 * 1024;
/** `text` with `line` after it, its oldest whole lines dropped past CRASH_LOG_MAX. */
function logWith(text, line) {
  let out = `${text ?? ''}${line}`;
  if (out.length > CRASH_LOG_MAX) { out = out.slice(out.length - CRASH_LOG_MAX); out = out.slice(out.indexOf('\n') + 1); }
  return out;
}

module.exports = { GONE_WHY, LOOP_STOPS, RESTART_SPAN_MS, goneAsk, restarts, hangAsk, restartsHung, createStopCount, goneLine, CRASH_LOG_MAX, logWith };
