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

// GPU-TRAIL (2026-10-24, src/render/gpuTrail.js): THE GPU'S LAST SAMPLES, UNDER THE STOP'S LINE. "It ran out of memory"
// is only Electron's reason; one reporter's kernel log showed the GPU hang and reset instead. The game's page hands the
// shell its trail with every sample (app/preload.cjs gpuTrail), the shell keeps the newest, and a process gone writes it
// under its own line. What the page hands is read field by field - known numbers, two flags, a short GPU name, the
// newest TRAIL_KEEP samples - so no line it makes is long: logWith keeps whole lines, and one line past CRASH_LOG_MAX
// would leave the log nothing.

/** The samples kept: the page's own ring (src/render/gpuTrail.js GPU_TRAIL_KEEP). */
const TRAIL_KEEP = 20;
/** A sample's numbers as crash.log writes them: the page's field, its label, its unit. */
const TRAIL_FIELDS = Object.freeze([
  ['upS', 'up', 's'], ['textures', 'tex', ''], ['buffers', 'buf', ''], ['vaos', 'vao', ''], ['framebuffers', 'fbo', ''], ['programs', 'prog', ''],
  ['fps', 'fps', ''], ['frameMs', 'ms', ''], ['worstMs', 'worst', ''], ['hitchMs', 'hitch', ''], ['draws', 'draws', ''], ['binds', 'binds', ''],
  ['viewDraws', 'view', ''], ['shadowDraws', 'shadow', ''], ['heapMB', 'heap', 'MB'],
]);
/** A sample's flags, written by name when set. */
const TRAIL_FLAGS = Object.freeze(['hidden', 'lost']);
/** The latest time a Date can print (toISOString throws past it). */
const TIME_MOST = 8.64e15;

/** The page's trail as the shell keeps it - `{ gpu, samples }`, the newest TRAIL_KEEP samples of known fields - or null
 *  with no sample to keep. */
function trailFrom(raw) {
  const samples = [];
  for (const s of Array.isArray(raw?.samples) ? raw.samples.slice(-TRAIL_KEEP) : []) {
    if (!Number.isFinite(s?.at) || Math.abs(s.at) > TIME_MOST) continue;
    const kept = { at: s.at };
    for (const [field] of TRAIL_FIELDS) kept[field] = Number.isFinite(s[field]) ? s[field] : null;
    for (const flag of TRAIL_FLAGS) kept[flag] = s[flag] === true;
    samples.push(kept);
  }
  if (!samples.length) return null;
  return { gpu: typeof raw.gpu === 'string' ? raw.gpu.replace(/\s+/g, ' ').slice(0, 160) : null, samples };
}

/** crash.log's lines for a kept trail, under a process gone's line: the GPU's name, then a sample a line, oldest first;
 *  a number the page did not have is '-'. '' with no trail. */
function trailLines(trail) {
  if (!trail?.samples?.length) return '';
  let out = `  gpu ${trail.gpu ?? 'unknown'}\n`;
  for (const s of trail.samples) {
    out += `  ${new Date(s.at).toISOString()}${TRAIL_FIELDS.map(([field, label, unit]) => ` ${label}=${s[field] == null ? '-' : `${s[field]}${unit}`}`).join('')}`
      + `${TRAIL_FLAGS.filter((flag) => s[flag]).map((flag) => ` ${flag}`).join('')}\n`;
  }
  return out;
}

module.exports = { GONE_WHY, LOOP_STOPS, RESTART_SPAN_MS, goneAsk, restarts, hangAsk, restartsHung, createStopCount, goneLine, CRASH_LOG_MAX, logWith, TRAIL_KEEP, trailFrom, trailLines };
