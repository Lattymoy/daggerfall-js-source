// @ts-check
// UPDATE-FORCE (2026-10-29, as the owner asked). SRV-N's poll (net/updateNotice.js) finds a new build; this gives a minute's warning, then a
// screen that cannot be closed: the character saved, the unload guard stood down, the page reloaded.
// A death screen or a duel holds the reload (at most UPDATE_HOLD_MAX_MS), so no corpse or duel health is saved.
import { t } from '../systems/textManager.js';
import { releaseUnloadGuard } from '../systems/unloadGuard.js';
import { buildUpdateText, buildUpdateSeen, fetchLiveBuildTag } from '../net/updateNotice.js';
import { BUILD_TAG } from '../buildTag.js';
import { forceShellUpdates } from '../systems/shellUpdates.js';
import { getPref } from '../systems/uiPrefs.js';

/** The warning before the screen, the screen before the reload, and the longest a death or duel may hold it, ms. */
export const UPDATE_WARN_MS = 60_000;
export const UPDATE_SCREEN_MS = 5_000;
export const UPDATE_HOLD_MAX_MS = 120_000;
export const UPDATE_TICK_MS = 250;
export const UPDATE_SCREEN_ID = 'update-screen';
export const UPDATE_BANNER_ID = 'update-banner';
/** Over every window and the crash banner; only the pad's cursor stands higher. */
export const UPDATE_Z = 2147483000;

export const updateBannerText = (clock) => t('net.update.banner', 'A new version is out. Reloading in {clock}', { clock });
export const updateHoldText = () => t('net.update.hold', 'A new version is out. Reloading when this fight or death screen ends.');
export const updateTitleText = () => t('net.update.title', 'A New Version Is Out');
export const updateBodyText = () => t('net.update.body', 'Your character is saved. You will be back in a few seconds on the new version.');
export const updateSavingText = () => t('net.update.saving', 'Saving your character');
export const updateReloadingText = () => t('net.update.reloading', 'Reloading the game');
export const updateButtonText = () => t('net.update.button', 'Reload Now');
// UPDATE-RESTART (2026-10-30, as the owner asked): the
// desktop app plays its own copy, so a reload there loads the same version again. In the app the run is started by the
// app's own update (systems/shellUpdates.js forceShellUpdates) and ends with the app restarting onto it; the words say so.
export const updateAppNoticeText = () => t('net.update.appBuild', 'A new version of the game is ready. Your character will be saved and the app restarted in one minute.');
export const updateAppBannerText = (clock) => t('net.update.appBanner', 'A new version is ready. The app restarts in {clock}', { clock });
export const updateAppHoldText = () => t('net.update.appHold', 'A new version is ready. The app restarts when this fight or death screen ends.');
export const updateAppBodyText = () => t('net.update.appBody', 'Your character is saved. The app closes, updates and opens again by itself.');
export const updateRestartingText = () => t('net.update.restarting', 'Restarting the app');
export const updateRestartButtonText = () => t('net.update.restartButton', 'Restart Now');
// AUTO-UPDATE (2026-10-30, the owner: "turn off the automatic updates by default. Im tired of players being forced out
// of the game"): the forced run is the player's choice now, off by default (uiPrefs autoUpdates). Off, a new build is
// told once and the player reloads when ready; the app's update keeps its HUD line (systems/shellUpdates.js updateReadyText).
export const autoUpdatesOn = () => getPref('autoUpdates') === true;
export const updateReadyNoticeText = () => t('net.update.buildReady', 'A new version of the game is out. Reload the page when you are ready to play it.');

/** m:ss for a count of ms, rounded up so the clock never reads 0:00 while time is left. */
export const countdownOf = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Where a forced update stands. Pure: the run's three stamps, the clock, and whether a death or duel is up.
 * @param {{ startedAt: number, holdSince?: number|null, screenAt?: number|null }} run
 * @param {number} now
 * @param {boolean} busy
 * @returns {'warn'|'hold'|'screen'|'go'}
 */
export function updatePhase(run, now, busy) {
  if (run.screenAt != null) return now - run.screenAt >= UPDATE_SCREEN_MS ? 'go' : 'screen';
  if (now - run.startedAt < UPDATE_WARN_MS) return 'warn';
  if (busy && (run.holdSince == null || now - run.holdSince < UPDATE_HOLD_MAX_MS)) return 'hold';
  return 'screen';
}

const BANNER_CSS = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 16px;max-width:calc(100vw - 32px);'
  + 'background:rgba(27,21,16,.94);border:1px solid #d9a94e;color:#e9dfcf;font:15px Georgia,serif;text-align:center;pointer-events:none;';
const VEIL_CSS = 'position:fixed;inset:0;display:grid;place-items:center;padding:16px;background:rgba(11,9,7,.92);';
const CARD_CSS = 'display:grid;gap:12px;max-width:360px;width:100%;padding:18px 20px;text-align:center;background:#1f1a15;'
  + 'border:2px solid #4a3d2f;box-shadow:0 0 0 4px #2b241d;color:#e9dfcf;font:15px Georgia,serif;';
const BUTTON_CSS = 'justify-self:center;padding:7px 18px;background:#2b241d;color:#d9a94e;border:1px solid #d9a94e;font:bold 14px Georgia,serif;cursor:pointer;';

/** @type {any} the one run a page has: a second new build found while one counts down changes nothing */
let _run = null;

/**
 * Start the forced update. False when one is already running. `app`: the desktop app's own update - its words, and
 * `reload` is the app's restart.
 * @param {{ notice?: (text: string) => void, save?: () => unknown, busy?: () => boolean,
 *   reload?: () => void, app?: boolean, doc?: any, win?: any, now?: () => number }} [opts]
 */
export function startForcedUpdate(opts = {}) {
  if (_run) return false;
  const win = opts.win ?? globalThis;
  const doc = opts.doc ?? win.document;
  const now = opts.now ?? (() => Date.now());
  const busy = () => { try { return !!opts.busy?.(); } catch { return false; } };
  const run = { startedAt: now(), holdSince: /** @type {number|null} */ (null), screenAt: /** @type {number|null} */ (null), banner: null, veil: null, steps: null, count: null, button: null, timer: null, done: false };
  _run = run;
  const app = !!opts.app;
  try { opts.notice?.(app ? updateAppNoticeText() : buildUpdateText()); } catch { /* no chat yet: the banner says it */ }
  const block = (e) => { if (run.veil && e.target !== run.button) { e.stopImmediatePropagation(); e.preventDefault(); } };
  const go = () => {
    if (run.done) return;
    run.done = true;
    win.clearInterval?.(run.timer);
    releaseUnloadGuard();   // the game is leaving on purpose: no "Leave site?" between the player and the new build
    (opts.reload ?? (() => win.location?.reload?.()))();
  };
  const showScreen = (at) => {
    run.screenAt = at;
    run.banner?.remove?.();
    const el = (tag, css, text) => { const n = doc.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; };
    const veil = el('div', VEIL_CSS + `z-index:${UPDATE_Z};`);
    veil.id = UPDATE_SCREEN_ID;
    const card = el('div', CARD_CSS);
    const title = el('h2', 'margin:0;color:#d9a94e;font:bold 19px Georgia,serif;letter-spacing:.04em;', updateTitleText());
    const steps = el('div', 'display:grid;gap:4px;text-align:left;font:13px monospace;');
    const saving = el('div', 'color:#d9a94e;', `● ${updateSavingText()}`);
    const leavingText = app ? updateRestartingText() : updateReloadingText();
    const reloading = el('div', 'color:#b3a58f;', `○ ${leavingText}`);
    steps.append(saving, reloading);
    const count = el('div', 'font:22px monospace;color:#d9a94e;', countdownOf(UPDATE_SCREEN_MS));
    const button = el('button', BUTTON_CSS, app ? updateRestartButtonText() : updateButtonText());
    button.type = 'button';
    button.addEventListener('click', go);
    card.append(title, el('p', 'margin:0;', app ? updateAppBodyText() : updateBodyText()), steps, count, button);
    veil.append(card);
    doc.body?.append?.(veil);
    Object.assign(run, { veil, steps: { saving, reloading }, count, button });
    for (const type of ['keydown', 'keyup', 'keypress']) win.addEventListener?.(type, block, true);
    try { doc.exitPointerLock?.(); } catch { /* not locked */ }
    try { opts.save?.(); } catch (err) { console.warn('[update] the save before the reload threw:', err); }
    saving.textContent = `✓ ${updateSavingText()}`;
    saving.style.color = '#7fb37a';
    reloading.textContent = `● ${leavingText}`;
    reloading.style.color = '#d9a94e';
    button.focus?.();
  };
  const tick = () => {
    if (run.done) return;
    const at = now();
    const phase = updatePhase(run, at, busy());
    if (phase === 'go') { go(); return; }
    if (phase === 'screen') {
      if (run.screenAt == null) showScreen(at);
      if (run.count) run.count.textContent = countdownOf(UPDATE_SCREEN_MS - (at - /** @type {number} */ (run.screenAt)));
      return;
    }
    if (phase === 'hold' && run.holdSince == null) run.holdSince = at;
    if (!run.banner) {
      run.banner = doc.createElement('div');
      run.banner.id = UPDATE_BANNER_ID;
      run.banner.style.cssText = BANNER_CSS + `z-index:${UPDATE_Z};`;
      doc.body?.append?.(run.banner);
    }
    const clock = countdownOf(UPDATE_WARN_MS - (at - run.startedAt));
    run.banner.textContent = phase === 'hold' ? (app ? updateAppHoldText() : updateHoldText()) : (app ? updateAppBannerText(clock) : updateBannerText(clock));
  };
  tick();
  run.timer = win.setInterval?.(tick, UPDATE_TICK_MS);
  return true;
}

/**
 * The host's build poll (scenes/world.js buildPoll). In a browser: the site's page, against THIS bundle's tag - a new
 * build starts the run. UPDATE-RESTART: in the desktop app that page is the app's own copy, so the app's own update
 * starts it, and the app restarting onto it ends it (systems/shellUpdates.js forceShellUpdates).
 * @param {{ notice?: (text: string) => void, save?: () => unknown, busy?: () => boolean }} opts
 * @param {any} [shell]  globalThis.daggerShell
 */
export function pollForUpdate(opts, shell = globalThis.daggerShell) {
  forceShellUpdates(shell, () => autoUpdatesOn() && startForcedUpdate({ ...opts, app: true, reload: () => shell.restartForUpdate() }));   // AUTO-UPDATE: the switch read when the update is heard
  // `fetchLiveBuildTag` swallows its own throws; the second handler is the belt for a rejection it cannot see
  return fetchLiveBuildTag(globalThis.location?.href ?? '').then((tag) => buildUpdateSeen(tag, BUILD_TAG) === 'changed' && (autoUpdatesOn() ? startForcedUpdate(opts) : opts.notice?.(updateReadyNoticeText())), () => {});
}

/** Whether this page is counting down to a reload. */
export const forcedUpdateRunning = () => !!_run;

/** The tests drive a fresh page per case. */
export function resetForcedUpdate() {
  if (_run?.timer != null) globalThis.clearInterval(_run.timer);
  _run = null;
}
