// @ts-check
// SHADER-EASE GFX-BAR (2026-10-29, the owner: in Chrome the game froze for 30-60 s in the world after each update): the
// menu's "Preparing graphics" bar. It fills as the programs started at page load (render/bootPrograms.js, mountPrograms.js)
// report done, asked without waiting (COMPLETION_STATUS_KHR) over glProgram.js startedPrograms - never startPrograms'
// ready(), which starts again a program a build took. A program taken counts done. No KHR_parallel_shader_compile
// (Firefox, Safari): nothing compiles beside the page, so no bar. FIX-STUTTER: a page cannot clear the browser's shader
// cache, so the button beside the bar shows how - in a Chromium tab alone: the desktop app clears its own (SHADER-EASE
// CACHE-TURN), and other browsers have no such folders.
import { parallelCompile, startedPrograms } from '../render/glProgram.js';
import { mountSettled } from '../render/bootPrograms.js';
import { t } from '../systems/textManager.js';

export const GFX_POLL_MS = 250;
/** Full this long before "ready": the mount queue lands a little after the boot's own start. */
export const GFX_HOLD_MS = 1500;
/** A driver that never says done: the bar goes after this long, as bootPrograms.js MOUNT_WAIT_TURNS gives up. */
export const GFX_GIVE_UP_MS = 90000;

export const CHROME_WIN = '%LOCALAPPDATA%\\Google\\Chrome\\User Data';
export const EDGE_WIN = '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data';
export const CHROME_MAC = '~/Library/Application Support/Google/Chrome';
export const EDGE_MAC = '~/Library/Application Support/Microsoft Edge';
/** The folders to delete, as each system writes the profile's own. */
export const cacheFolders = (sep = '\\') => ({ a: 'GrShaderCache', b: 'ShaderCache', c: `Default${sep}GPUCache` });

/** The words, read when shown. */
export const gfxWords = () => ({
  preparing: t('gfx.bar.preparing', 'Preparing graphics'),
  ready: t('gfx.bar.ready', 'Graphics ready'),
  fix: t('gfx.fix.button', 'Fix stutter'),
  why: t(
    'gfx.fix.why',
    'Old graphics files in the browser can make the game stutter after an update. A web page cannot delete them, but you can.',
  ),
  winClose: t(
    'gfx.fix.win.close',
    'Close every Chrome window. If its icon stays near the clock, right-click it and select Exit.',
  ),
  winRun: t('gfx.fix.win.run', 'Press Win+R, paste this path and press Enter:'),
  winFolders: t('gfx.fix.folders', 'Delete the folders {a} and {b}, and {c}.', cacheFolders('\\')),
  profile: t('gfx.fix.profile', "For another profile, use that profile's folder in place of {d}.", { d: 'Default' }),
  winStart: t('gfx.fix.win.start', 'Start Chrome again.'),
  edge: t('gfx.fix.edge', 'For Edge, use this path:'),
  macQuit: t('gfx.fix.mac.quit', 'Quit Chrome.'),
  macGo: t('gfx.fix.mac.go', 'In Finder, press Cmd+Shift+G and paste this path:'),
  macFolders: t('gfx.fix.folders', 'Delete the folders {a} and {b}, and {c}.', cacheFolders('/')),
  note: t('gfx.fix.note', 'The first load after this is slower once, while the game builds its graphics again.'),
  copy: t('gfx.fix.copy', 'Copy'),
  close: t('gfx.fix.close', 'Close'),
});

/** Whether the Fix stutter button shows: a desktop Chromium (Chrome, Edge) in a tab, never the desktop app.
 *  @param {any} nav @param {unknown} shell `globalThis.daggerShell` */
export function chromiumWeb(nav = globalThis.navigator, shell = /** @type {any} */ (globalThis).daggerShell) {
  if (shell || !nav) return false;
  const ua = String(nav.userAgent ?? '');
  const platform = `${ua} ${nav.userAgentData?.platform ?? ''}`;
  if (!/Windows|Macintosh|macOS/.test(platform)) return false; // the steps are Windows' and the Mac's alone, never a phone's
  const brands = nav.userAgentData?.brands; // Chrome and Edge alone: Brave, Opera and Vivaldi keep their folders elsewhere
  if (Array.isArray(brands) && brands.length)
    return brands.some((b) => /Google Chrome|Microsoft Edge/.test(String(b?.brand ?? '')));
  return /\b(Chrome|Edg)\//.test(ua) && !/\b(OPR|Vivaldi|Brave|YaBrowser)\//.test(ua);
}

/** The bar's count over the context's started programs: `poll()` answers { done, total }. A program once seen and now
 *  gone (a build took it) is done; a lost context is all done. Reads COMPLETION_STATUS_KHR alone - never links.
 *  @param {any} gl @param {any} ext @param {(gl: any) => Array<[string, any]>} [list] */
export function gfxProgress(gl, ext, list = startedPrograms) {
  const seen = new Set(),
    done = new Set();
  return () => {
    const now = new Map(list(gl)),
      lost = !!gl.isContextLost?.();
    for (const k of now.keys()) seen.add(k);
    for (const k of seen) {
      if (done.has(k)) continue;
      const p = now.get(k);
      if (lost || p === undefined || (p !== null && gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR) === true))
        done.add(k);
    }
    return { done: done.size, total: seen.size };
  };
}

/** @typedef {{ phase: 'idle'|'filling'|'ready'|'gone', done: number, total: number, fullAt: number|null, since: number }} GfxState */
/** The bar's next state. idle (hidden) until the first count; filling; ready once full for GFX_HOLD_MS and the mount
 *  set is queued (`settled`), and it holds while the menu stands; gone after GFX_GIVE_UP_MS. GFX-ALWAYS (2026-10-29, the
 *  owner: "dont see shader bar"): a warm cache, or a build done during the intro, shows ready at once - never no bar.
 *  @param {GfxState} s @param {{ done: number, total: number }} c @param {number} now @param {boolean} [settled]
 *  @returns {GfxState} */
export function gfxStep(s, { done, total }, now, settled = true) {
  if (s.phase === 'gone' || s.phase === 'ready') return s;
  if (s.phase === 'filling' && now - s.since >= GFX_GIVE_UP_MS) return { ...s, phase: 'gone', since: now };
  const full = total > 0 && done >= total;
  if (s.phase === 'idle') {
    if (!settled && total === 0) return s; // nothing started yet
    if (settled && (full || total === 0)) return { ...s, phase: 'ready', done, total, fullAt: now, since: now };
    return { ...s, phase: 'filling', done, total, since: now };
  }
  if (!full) return { ...s, done, total, fullAt: null };
  const fullAt = s.fullAt ?? now;
  return settled && now - fullAt >= GFX_HOLD_MS
    ? { ...s, phase: 'ready', done, total, fullAt, since: now }
    : { ...s, done, total, fullAt };
}
/** @returns {GfxState} */
export const gfxStart = () => ({ phase: 'idle', done: 0, total: 0, fullAt: null, since: 0 });

// z 13: over the boot menu's host (12, ui/enhanced/enhancedMenu.js runEnhancedMenu); the panel at 36, among the boxes
const CSS = `.dfgfx{position:fixed;left:16px;bottom:16px;z-index:13;display:flex;align-items:center;gap:12px;
font:13px/1.3 system-ui,sans-serif;color:#d8cdb6;pointer-events:none}
.dfgfx>*{pointer-events:auto}.dfgfx-bar{display:flex;align-items:center;gap:8px;transition:opacity .6s}
.dfgfx-bar[hidden]{display:none}.dfgfx-bar.gone{opacity:0;visibility:hidden;transition:opacity .6s,visibility 0s .6s}
.dfgfx-track{width:140px;height:6px;border:1px solid #5a4d36;background:#14171b}
.dfgfx-fill{height:100%;width:0;background:#c08a3e;transition:width .25s}
.dfgfx button,.dfgfx-panel button{font:inherit;color:#e9dcc0;background:#1b1f25;border:1px solid #5a4d36;padding:3px 10px;cursor:pointer}
.dfgfx-shade{position:fixed;inset:0;z-index:36;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)}
.dfgfx-panel{max-width:min(560px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:18px 20px;
background:#12161b;border:1px solid #5a4d36;color:#d8cdb6;font:14px/1.45 system-ui,sans-serif}
.dfgfx-panel h2{margin:0 0 8px;font-size:18px;color:#e9dcc0}.dfgfx-panel h3{margin:14px 0 4px;font-size:15px;color:#c08a3e}
.dfgfx-panel ol{margin:0;padding-left:22px}.dfgfx-path{display:flex;gap:8px;align-items:center;margin:4px 0}
.dfgfx-path code{user-select:all;word-break:break-all;background:#0b0d10;padding:2px 6px}
.dfgfx-panel .dfgfx-close{display:block;margin:14px 0 0 auto}`;

/** The bar and the button over a menu, and the panel the button opens. Answers its parts, `tick()` (one poll) and
 *  `unmount()`. Nothing to show (no extension, not Chromium in a tab): nothing mounted.
 *  @param {{ gl: any, doc?: Document, win?: any, nav?: any, shell?: unknown, now?: () => number, list?: (gl: any) => Array<[string, any]>, settled?: () => boolean }} o */
export function mountGfxPrep({
  gl,
  doc = document,
  win = globalThis,
  nav = win.navigator,
  shell = win.daggerShell,
  now = () => Date.now(),
  list = startedPrograms,
  settled = mountSettled,
}) {
  const ext = gl ? parallelCompile(gl) : null,
    fixShown = chromiumWeb(nav, shell);
  if (!ext && !fixShown) return { root: null, bar: null, button: null, panel: () => null, tick() {}, unmount() {} };
  const w = gfxWords();
  const el = (/** @type {string} */ tag, cls = '', text = '') => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  if (!doc.getElementById('dfgfx-css')) {
    const s = el('style');
    s.id = 'dfgfx-css';
    s.textContent = CSS;
    doc.head.append(s);
  }
  const root = el('div', 'dfgfx'),
    bar = el('div', 'dfgfx-bar'),
    label = el('span'),
    track = el('div', 'dfgfx-track'),
    fill = el('div', 'dfgfx-fill');
  bar.hidden = true;
  bar.setAttribute('role', 'progressbar');
  track.append(fill);
  bar.append(label, track);
  root.append(bar);
  /** @type {HTMLButtonElement|null} */
  const button = fixShown ? /** @type {HTMLButtonElement} */ (el('button', '', w.fix)) : null;
  /** @type {HTMLElement|null} */
  let shade = null;
  const closePanel = () => {
    if (!shade) return;
    shade.remove();
    shade = null;
    button?.focus?.();
  };
  const openPanel = () => {
    if (shade) return;
    shade = fixPanel(doc, win, el, w, closePanel);
    doc.body.append(shade);
    /** @type {HTMLElement|null} */ (shade.querySelector('.dfgfx-close'))?.focus?.();
  };
  if (button) {
    button.type = 'button';
    button.addEventListener('click', openPanel);
    root.append(button);
  }
  // the menu hears its keys on the window in capture (ui/windowStack.js listenWindowKeys), and capture listeners run in
  // the order laid: main.js mounts this before the menu, so while the panel is up its keys are the panel's
  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (!shade) return;
    e.stopImmediatePropagation();
    if (e.type === 'keydown' && e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
    if (e.type === 'keydown' && e.key === 'Tab') {
      // the focus stays in the panel: never a menu door behind it
      e.preventDefault();
      const keys = /** @type {Element[]} */ ([...shade.querySelectorAll('button')]),
        at = doc.activeElement ? keys.indexOf(doc.activeElement) : -1;
      /** @type {HTMLElement|undefined} */ (keys[(at + (e.shiftKey ? -1 : 1) + keys.length) % keys.length])?.focus?.();
    }
  };
  for (const type of ['keydown', 'keyup']) win.addEventListener?.(type, onKey, true);
  doc.body.append(root);

  const poll = ext ? gfxProgress(gl, ext, list) : null;
  let state = gfxStart(),
    timer = /** @type {any} */ (null);
  const paint = () => {
    bar.hidden = state.phase === 'idle';
    bar.classList.toggle('gone', state.phase === 'gone');
    if (state.phase === 'gone') return; // it fades as it stood: a bar that gave up never says ready
    label.textContent = state.phase === 'filling' ? w.preparing : w.ready;
    const pct = state.total ? Math.round((100 * state.done) / state.total) : 0;
    fill.style.width = `${state.phase === 'filling' ? pct : 100}%`;
    bar.setAttribute('aria-valuenow', String(state.phase === 'filling' ? pct : 100));
  };
  const tick = () => {
    if (!poll) return;
    state = gfxStep(state, poll(), now(), settled());
    paint();
    timer = state.phase === 'gone' || state.phase === 'ready' ? null : win.setTimeout(tick, GFX_POLL_MS);
  };
  tick();
  return {
    root,
    bar,
    button,
    tick,
    panel: () => shade,
    get state() {
      return state;
    },
    unmount() {
      if (timer !== null) win.clearTimeout(timer);
      timer = null;
      for (const type of ['keydown', 'keyup']) win.removeEventListener?.(type, onKey, true);
      shade?.remove();
      shade = null;
      root.remove();
    },
  };
}

/** The Fix stutter panel: the steps for Windows and Mac, a Copy button by each path, and Close. A press on the shade
 *  outside the panel closes it too. */
function fixPanel(doc, win, el, w, close) {
  const shade = el('div', 'dfgfx-shade'),
    panel = el('div', 'dfgfx-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', w.fix);
  const path = (/** @type {string} */ p) => {
    const row = el('div', 'dfgfx-path'),
      copy = el('button', '', w.copy);
    copy.type = 'button';
    copy.addEventListener('click', () => {
      try {
        win.navigator?.clipboard?.writeText?.(p)?.catch?.(() => {});
      } catch {
        /* the path stays on the panel to select */
      }
    });
    row.append(el('code', '', p), copy);
    return row;
  };
  const steps = (/** @type {Array<string|HTMLElement>} */ ...items) => {
    const ol = el('ol');
    for (const it of items) {
      if (typeof it === 'string') ol.append(el('li', '', it));
      else ol.lastElementChild?.append(it);
    }
    return ol;
  };
  const shut = el('button', 'dfgfx-close', w.close);
  shut.type = 'button';
  shut.addEventListener('click', close);
  panel.append(
    el('h2', '', w.fix),
    el('p', '', w.why),
    el('h3', '', 'Windows'),
    steps(w.winClose, w.winRun, path(CHROME_WIN), w.winFolders, el('div', '', w.profile), w.winStart),
    el('p', '', w.edge),
    path(EDGE_WIN),
    el('h3', '', 'Mac'),
    steps(w.macQuit, w.macGo, path(CHROME_MAC), w.macFolders, el('div', '', w.profile), w.winStart),
    el('p', '', w.edge),
    path(EDGE_MAC),
    el('p', '', w.note),
    shut,
  );
  shade.append(panel);
  shade.addEventListener('click', (/** @type {MouseEvent} */ e) => {
    if (e.target === shade) close();
  });
  return shade;
}

/** @type {ReturnType<typeof mountGfxPrep>|null} */
let up = null;
/** main.js: up while a boot menu shows (the enhanced door, the classic title and start window), down once it is left. */
export function gfxPrepUp(gl) {
  up ??= mountGfxPrep({ gl });
}
export function gfxPrepDown() {
  up?.unmount();
  up = null;
}
