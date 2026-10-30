// GPU-BACKEND (2026-10-26, the performance proposal's P8): THE GRAPHICS BACKEND, A PLAYER'S CHOICE ON WINDOWS.
//
// The game never picks a graphics API: Chromium's ANGLE translates WebGL2, and on Windows it translates to Direct3D 11.
// Measured on one RTX 5080 (Daggerfall city, 15:00, winter; bible/01-Overview/Desktop-App.md GPU-BACKEND), ANGLE's
// Vulkan backend linked the first launch's shaders in 1.3 s where D3D11 took 37.4 s. Chromium keeps D3D11 the default
// because Vulkan drivers vary on older Intel and AMD GPUs, and a backend that fails to start does NOT fall back to
// D3D11: Chromium falls to its software renderer (WARP, 2 fps). So Vulkan is opt-in, and this module guards it.
//
//   1. Before the app is ready: the port's own pref (`graphicsBackend` on the `dagger.ui.v1` shelf, read alone through
//      fileStorage.cjs readPref, as frameRate.cjs reads VSync) chooses the switches - unless a failure is on record in
//      the shell's config.json, which holds every launch on the default.
//   2. On a launch that took the switches (watchBackend), any of these records the failure keyed by the GPU and its
//      driver version, tells the player, and relaunches without the switches:
//      - Chromium's renderer, read once the first window is up, is a software one or does not name the backend;
//      - the game page's own WebGL2 context, made by its preload (webgl2Report), does not exist, or its renderer is a
//        software one or does not name the backend;
//      - the game page does not report within PAGE_REPORT_TIMEOUT_MS of its window opening;
//      - the GPU process is gone within the first minute.
//   3. A launch held by the record compares the GPU, driver and Chromium it runs on with the record's. A different one
//      (a driver update, or an app update that brings a new Chromium and its ANGLE) clears the record, and the NEXT
//      start tries the chosen backend again.
//   4. VULKAN-BLANK (#1379): a window that draws blank passes every check in 2. So on a GPU, driver or Chromium the
//      player has not confirmed, each window that shows - the launcher, then the game - asks the player in a box Windows
//      draws itself. Go back fails the launch as 2 does, without the notice; no answer holds this launch only.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readPref, writePref } = require('./fileStorage.cjs');

/** src/systems/uiPrefs.js STORAGE_KEY - the port's own shelf (test/tooling/gpubackend.test.js holds the two equal). */
const UI_PREFS = 'dagger.ui.v1';
/** The shelf's key, and its values: 'default' is Chromium's own choice (D3D11 on Windows). */
const GRAPHICS_BACKEND_PREF = 'graphicsBackend';
/** app/main.cjs CONFIG_FILE's name. Read here because main.cjs defines CONFIG_FILE after the switches are appended. */
const CONFIG_NAME = 'config.json';
/** The failure record's key in config.json: { backend, gpu, reason, at }. */
const FAILURE_RECORD = 'graphicsBackendFailure';
/** VULKAN-BLANK: the player's word in config.json, { backend, gpu, chromium, at }: they saw the window on this GPU,
 *  driver and Chromium. */
const CONFIRM_RECORD = 'graphicsBackendConfirmed';
/** How long the box waits for the player before the launch counts as failed: a blank window may hide the box's owner,
 *  never the box. */
const CONFIRM_TIMEOUT_MS = 20_000;
/** The probe's door, in the shape of DAGGER_USER_DATA: names a backend for one launch over the pref. `metal`
 *  (ANGLE's macOS backend) cannot start on Windows - Chromium falls to WARP, as a failed Vulkan would - so it forces the
 *  guard's failure path on a working machine. `d3d9` starts on the card but gives the page no WebGL2 context, so it forces
 *  the page's own check alone. Neither is a player's choice: the pref names only 'vulkan'. (`gl`, which failed in Edge,
 *  starts in the app on an NVIDIA driver.) */
const BACKEND_ENV = 'DAGGER_GRAPHICS_BACKEND';
/** A GPU process that stops within this long of the launch counts as the backend failing to start. */
const GPU_GONE_GRACE_MS = 60_000;
/** getGPUInfo can wait on a GPU process that is gone; the guard does not wait past this. */
const GPU_INFO_TIMEOUT_MS = 10_000;
/** The game page's preload reports its WebGL2 context as the page's document commits; a page that has not reported this
 *  long after its window opened (hung, blank, or its preload stopped) counts as the backend failing. */
const PAGE_REPORT_TIMEOUT_MS = 60_000;
/** The relaunch's own argument when the failure record could not be written: that launch takes no switches. */
const HOLD_DEFAULT_ARG = '--dagger-default-backend';

/** Each backend's Chromium switches, as [name, value]. */
// disable-gpu-sandbox, on Vulkan only: with Chromium's GPU sandbox on, ANGLE's Vulkan path has no GPU compositor on Windows
// (gpu_compositing disabled_software, webgl enabled_readback), so every frame's WebGL canvas is read back and composited
// on the CPU - 64 fps against D3D11's 120 (its cap) at 2560x1440 (2026-10-28, bible GPU-BACKEND). Without the sandbox the GPU
// composites (120 at the cap, 230 uncapped). The game window's renderer already runs with sandbox: false (main.cjs
// webPreferences, for the preload's file IO), fenced to dagger:// by its navigation handlers, so lifting the GPU sandbox
// adds only what reaches the driver through WebGL: the game's own shaders and its own or installed textures. D3D11 keeps it.
const BACKEND_SWITCHES = Object.freeze({
  vulkan: Object.freeze([['use-gl', 'angle'], ['use-angle', 'vulkan'], ['disable-gpu-sandbox', '']]),
  metal: Object.freeze([['use-gl', 'angle'], ['use-angle', 'metal']]),
  d3d9: Object.freeze([['use-gl', 'angle'], ['use-angle', 'd3d9']]),
});

/** Renderer strings that mean Chromium draws without the GPU: WARP is D3D11's software rasterizer (its adapter is the
 *  "Microsoft Basic Render Driver"), SwiftShader and llvmpipe the other software paths. WARP is matched as a word, so a
 *  GPU's name that merely holds the letters is never taken for it. */
const SOFTWARE_RENDERERS = Object.freeze([/basic render driver/, /(^|[^a-z])warp([^a-z]|$)/, /swiftshader/, /llvmpipe/]);
/** Vendor ids that name no physical GPU: Microsoft's (the Basic Render Driver, listed beside the card) and ANGLE's
 *  synthetic 0xffff ("SwANGLE") - on a backend that fell to WARP the only device Chromium lists. */
const SOFTWARE_VENDORS = Object.freeze([0x1414, 0xffff]);

/** The saved pref: 'vulkan', or 'default' for anything else (nothing saved, an unreadable shelf). */
function savedBackend(userDataRoot) {
  try {
    const raw = readPref(userDataRoot, UI_PREFS);
    return raw && JSON.parse(raw)?.[GRAPHICS_BACKEND_PREF] === 'vulkan' ? 'vulkan' : 'default';
  } catch {
    return 'default';
  }
}

/** The failure record in config.json, or null. */
function failureRecord(userDataRoot) {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(userDataRoot, CONFIG_NAME), 'utf8'))?.[FAILURE_RECORD];
    return record && typeof record === 'object' ? record : null;
  } catch {
    return null;
  }
}

/** This launch's backend: { backend, switches, held }. `backend` is the one chosen (the env door over the pref);
 *  `switches` are the [name, value] pairs to append - none off Windows, for 'default', or while a failure record
 *  `held` the launch on the default. */
function backendLaunch(userDataRoot, { platform = process.platform, env = process.env, argv = process.argv } = {}) {
  if (platform !== 'win32' || argv.includes(HOLD_DEFAULT_ARG)) return { backend: 'default', switches: [], held: null };
  const backend = Object.hasOwn(BACKEND_SWITCHES, env[BACKEND_ENV] ?? '') ? env[BACKEND_ENV] : savedBackend(userDataRoot);
  if (backend === 'default') return { backend, switches: [], held: null };
  const held = failureRecord(userDataRoot);
  if (held) return { backend, switches: [], held };
  return { backend, switches: BACKEND_SWITCHES[backend].map(([name, value]) => [name, value]), held: null };
}

/** Whether this launch keeps VSync on whatever the VSync setting says: it took Vulkan's switches. With VSync off the shell
 *  adds `disable-gpu-vsync` and `disable-frame-rate-limit` (frameRate.cjs), and on Vulkan with the GPU sandbox off either
 *  one froze the page for good on a stream of resizes (3 to 6 steps) or on leaving fullscreen; with VSync on there was no
 *  freeze in 400 resize steps or 20 toggles, and D3D11 and the sandboxed Vulkan never froze (2026-10-28, bible GPU-BACKEND,
 *  dfo-verify/tools/perf/vulkan-half-2026-10-28/notes.md). A launch held on the default, or one that fell back to D3D11
 *  after a failed Vulkan, took no switches, so it gets the VSync setting as before. */
function holdsVSync(launch) {
  return launch?.backend === 'vulkan' && launch.switches.length > 0;
}

/** Whether a renderer string names a software renderer. */
function isSoftwareRenderer(renderer) {
  const text = String(renderer ?? '').toLowerCase();
  return SOFTWARE_RENDERERS.some((name) => name.test(text));
}

/** The word each backend's renderer string carries when ANGLE runs on it ("ANGLE (NVIDIA, Vulkan 1.4.341 (...), ...)"). */
const BACKEND_RENDERER_WORDS = Object.freeze({ vulkan: /vulkan/i, metal: /metal/i, d3d9: /direct3d9/i });

/** Whether a known renderer string is not the chosen backend's: ANGLE started on another one. use-angle=d3d9 ran on
 *  "Direct3D9Ex", which gives the page no WebGL2 context, on a GPU and with every feature status "enabled" - Electron
 *  42's Chromium reports no WebGL2 status of its own. An empty renderer (no GPU info in time) is no failure. */
function rendererMissesBackend(renderer, backend) {
  const word = BACKEND_RENDERER_WORDS[backend];
  return !!word && !!renderer && !word.test(renderer);
}

/** The record's key: the physical GPU and its driver version, as "vvvv:dddd@driver" - the active one, else the first.
 *  null when the info names no physical device, as on a launch whose backend fell to WARP: that record is keyed by the
 *  next launch, on the card (watchBackend review). */
function gpuKey(info) {
  const devices = Array.isArray(info?.gpuDevice) ? info.gpuDevice : [];
  const physical = devices.filter((d) => d && !SOFTWARE_VENDORS.includes(d.vendorId));
  const device = physical.find((d) => d.active) ?? physical[0];
  if (!device) return null;
  const hex = (n) => Number(n ?? 0).toString(16).padStart(4, '0');
  return `${hex(device.vendorId)}:${hex(device.deviceId)}@${device.driverVersion ?? '?'}`;
}

/** The renderer Chromium reports drawing with (ANGLE's string, e.g. "ANGLE (NVIDIA, Vulkan 1.4 ...)"). */
const rendererOf = (info) => String(info?.auxAttributes?.glRenderer ?? '');

const BACKEND_NAMES = Object.freeze({ vulkan: 'Vulkan', metal: 'Metal', d3d9: 'Direct3D 9' });

/** The notice a failed backend shows before the relaunch: one button, which relaunches (DA6's notice shape, a
 *  dialog.showMessageBox options object). */
const backendFailedNotice = (backend) => ({
  type: 'warning',
  message: `${BACKEND_NAMES[backend] ?? backend} could not start on this graphics card`,
  detail: 'DFO Online restarts on the default graphics backend, Direct3D 11. It tries again after a graphics driver update, or an app update that brings a new graphics engine.',
  buttons: ['Restart'],
  defaultId: 0,
  cancelId: 0,
});

/** VULKAN-BLANK: the box that asks the player whether they see the window - the launcher or the game
 *  (dialog.showMessageBox options). The safe answer is the default: Enter, Escape and closing the box all go back. */
const backendConfirmNotice = (backend, where = 'game') => ({
  type: 'question',
  message: where === 'launcher' ? 'Can you see the DFO Online launcher?' : 'Can you see the game?',
  detail: `You selected ${BACKEND_NAMES[backend] ?? backend}. If the window is blank, select Go back. With no answer in ${CONFIRM_TIMEOUT_MS / 1000} seconds, DFO Online restarts once on Direct3D 11.`,
  buttons: [`Keep ${BACKEND_NAMES[backend] ?? backend}`, 'Go back'],
  defaultId: 1,
  cancelId: 1,
  noLink: true,
});

/** GPU-BACKEND-LAUNCHER: the launcher's Graphics option - the backend saved, whether a failure on record holds it off,
 *  whether this launch took its switches, and whether HOLD_DEFAULT_ARG holds this launch alone on the default. */
function backendOption(userDataRoot, launch, argv = process.argv) {
  return {
    chosen: savedBackend(userDataRoot),
    held: !!failureRecord(userDataRoot),
    running: launch?.backend === 'vulkan' && launch.switches.length > 0,
    once: argv.includes(HOLD_DEFAULT_ARG),
  };
}

/** GPU-BACKEND-LAUNCHER: the launcher sets the pref the game's own row sets, on the page's shelf, before the page is
 *  up. Vulkan chosen here clears the failure record: the player asked to try again, and the guard still stands. A
 *  shelf that is not the page's JSON is left alone. Returns whether the choice was written. */
function chooseBackend(userDataRoot, backend, { loadConfig, saveConfig }) {
  let prefs = {};
  try {
    const raw = readPref(userDataRoot, UI_PREFS);
    if (raw) prefs = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return false;
  // The page never stores a default (uiPrefs.js overridesOf), so neither does the shell.
  const { [GRAPHICS_BACKEND_PREF]: _old, ...rest } = prefs;
  try {
    writePref(userDataRoot, UI_PREFS, JSON.stringify(backend === 'vulkan' ? { ...rest, [GRAPHICS_BACKEND_PREF]: 'vulkan' } : rest));
  } catch {
    return false;
  }
  if (backend === 'vulkan') {
    const { [FAILURE_RECORD]: held, ...config } = loadConfig();
    if (held) saveConfig(config);
  }
  return true;
}

/** The launcher's restart, after its Graphics option changed: the same arguments, without the guard's one-launch hold. */
const restartArgs = (argv) => argv.slice(1).filter((a) => a !== HOLD_DEFAULT_ARG);

/** The game page's own WebGL2 context, made once in its preload on a launch that took the switches: { webgl2, renderer }.
 *  `renderer` is the unmasked one (WEBGL_debug_renderer_info), ANGLE's string as getGPUInfo gives it. The context is lost
 *  again at once, so the page's own count of contexts is untouched. Never throws. */
function webgl2Report(doc) {
  let gl = null;
  try {
    gl = doc.createElement('canvas').getContext('webgl2');
  } catch {
    gl = null;
  }
  if (!gl) return { webgl2: false, renderer: '' };
  let renderer = '';
  try {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // a context that made it but answers nothing still proves WebGL2; the renderer stays unknown
  }
  return { webgl2: true, renderer };
}

/** getGPUInfo with a deadline: null when it does not answer in time or fails. */
function gpuInfoWithin(app, level, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    timer.unref?.();
    Promise.resolve()
      .then(() => app.getGPUInfo(level))
      .then((info) => { clearTimeout(timer); resolve(info ?? null); }, () => { clearTimeout(timer); resolve(null); });
  });
}

/**
 * The guard over one launch. `launch` is backendLaunch's answer; `app` needs getGPUInfo, relaunch and exit;
 * `loadConfig`/`saveConfig` are main.cjs's; `notify(options)` shows the notice and resolves when it is answered;
 * `confirm(options, signal, win)` asks the player over `win` (VULKAN-BLANK), resolves with { response }, and the signal
 * closes it; `onCleared` hears a held launch clear the record (the launcher redraws its option);
 * `beforeExit` runs before the relaunch's app.exit, which skips will-quit (main.cjs flushes its held GPU-gone entry);
 * `chromium` is this build's Chromium version, kept in the record.
 * Returns { check, onGpuGone, pageOpened, pageAsks, pageReport, windowShown }: main.cjs calls check() once the first window is up,
 * onGpuGone(details) from its child-process-gone handler for a GPU process, pageOpened() when the game window is made,
 * pageAsks() / pageReport(report) for the game page's preload (whether to make its WebGL2 context, and what it got), and
 * windowShown(kind, win) when the launcher or the game window shows.
 */
function watchBackend({ app, launch, loadConfig, saveConfig, notify, confirm, onCleared = () => {}, beforeExit = () => {}, chromium = process.versions.chrome ?? null, now = Date.now, log = console.warn, infoTimeoutMs = GPU_INFO_TIMEOUT_MS, reportTimeoutMs = PAGE_REPORT_TIMEOUT_MS, confirmTimeoutMs = CONFIRM_TIMEOUT_MS, argv = process.argv }) {
  const startedAt = now();
  const armed = launch.switches.length > 0;
  let key = null;
  let failing = false;
  /** The open VULKAN-BLANK box's controller: a failure found while it is up closes it. */
  let asking = null;

  /** `told`: the player is shown the notice first - not when they answered the box themselves (VULKAN-BLANK).
   *  `record`: false holds the next launch alone on the default (no answer, or a box that failed). */
  function fail(reason, { told = true, record = true } = {}) {
    if (failing) return Promise.resolve();
    failing = true;
    asking?.abort();
    if (record) saveConfig({ ...loadConfig(), [FAILURE_RECORD]: { backend: launch.backend, gpu: key, chromium, reason, at: new Date(now()).toISOString() } });
    // saveConfig swallows a write error. A record that did not land (a read-only or locked userData) cannot hold the next
    // launch on the default, so the relaunch carries HOLD_DEFAULT_ARG instead; without it the next launch would fail and
    // show the notice again, on every start.
    const recorded = record && !!loadConfig()[FAILURE_RECORD];
    log(`[shell] GPU-BACKEND: ${launch.backend} failed (${reason}) on ${key ?? 'an unknown GPU'} - relaunching on the default${record ? '' : ' once'}`);
    return Promise.resolve()
      .then(() => (told ? notify(backendFailedNotice(launch.backend)) : null))
      .catch(() => {})
      .then(() => {
        try { beforeExit(); } catch { /* the relaunch goes ahead */ }
        // The new copy can start before this one has quit; one that asks for the single-instance lock while this one holds
        // it is refused and quits, so the player's restart would close the app for good (main.cjs AUDIT INSTALL R2-A1).
        app.releaseSingleInstanceLock();
        app.relaunch(recorded || argv.includes(HOLD_DEFAULT_ARG) ? undefined : { args: [...argv.slice(1), HOLD_DEFAULT_ARG] });
        app.exit(0);
      });
  }

  /** A held launch: clear a record made on another GPU, driver or Chromium, and key a record made before the key was
   *  known. */
  function review(info) {
    const current = gpuKey(info);
    const config = loadConfig();
    const record = config[FAILURE_RECORD];
    if (!record) return;
    if (record.chromium && chromium && record.chromium !== chromium) {
      const { [FAILURE_RECORD]: _cleared, ...rest } = config;
      saveConfig(rest);
      log(`[shell] GPU-BACKEND: Chromium changed (${record.chromium} -> ${chromium}) - the next start tries ${record.backend} again`);
      onCleared();
      return;
    }
    if (!current) return;
    if (!record.gpu) {
      saveConfig({ ...config, [FAILURE_RECORD]: { ...record, gpu: current } });
    } else if (record.gpu !== current) {
      const { [FAILURE_RECORD]: _cleared, ...rest } = config;
      saveConfig(rest);
      log(`[shell] GPU-BACKEND: the GPU or driver changed (${record.gpu} -> ${current}) - the next start tries ${record.backend} again`);
      onCleared();
    }
  }

  let checked = false;
  /** The renderer check under way, which a window's box waits for: a software renderer gets the notice, not the box. */
  let checkRun = null;
  /** Once a launch: main.cjs calls it at each load of the first window. */
  function check() {
    if (checked || (!armed && !launch.held)) return Promise.resolve();
    checked = true;
    checkRun = runCheck();
    return checkRun;
  }
  async function runCheck() {
    const info = await gpuInfoWithin(app, 'complete', infoTimeoutMs) ?? await gpuInfoWithin(app, 'basic', infoTimeoutMs);
    key = gpuKey(info) ?? key;
    if (launch.held) { review(info); return; }
    const renderer = rendererOf(info);
    if (isSoftwareRenderer(renderer)) await fail(`software renderer: ${renderer}`);
    else if (rendererMissesBackend(renderer, launch.backend)) await fail(`renderer is not ${launch.backend}: ${renderer}`);
  }

  const shown = new Set();
  /** VULKAN-BLANK: a window the player should now see, 'launcher' or 'game', and the window that owns the box (a box with
   *  no owner can stand behind a fullscreen game). Once a kind a launch, after the renderer check. */
  async function windowShown(kind, win = null) {
    if (!armed || shown.has(kind)) return;
    shown.add(kind);
    if (checkRun) await checkRun;
    await askPlayer(kind, win);
  }

  /** VULKAN-BLANK (#1379): Chromium named Vulkan, the windows stayed blank, and the switch back was in the game's
   *  settings. Only a Keep over the game is recorded: the launcher can draw while the game's canvas does not. Go back is
   *  recorded as a failure. No answer, or a box that failed, holds this launch alone: a player away from the keys is no
   *  proof Vulkan fails. The timeout races the box, so a box that never closes cannot hold the launch. */
  async function askPlayer(kind, win) {
    if (!key) key = gpuKey(await gpuInfoWithin(app, 'basic', infoTimeoutMs));
    const seen = loadConfig()[CONFIRM_RECORD];
    if (failing || (key && seen?.backend === launch.backend && seen.gpu === key && seen.chromium === chromium)) return;
    const stop = new AbortController();
    asking = stop;
    let error = null;
    const timedOut = new Promise((resolve) => {
      const timer = setTimeout(() => { stop.abort(); resolve(null); }, confirmTimeoutMs);
      stop.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(null); }, { once: true });
    });
    const answered = Promise.resolve()
      .then(() => confirm(backendConfirmNotice(launch.backend, kind), stop.signal, win))
      .then((r) => (stop.signal.aborted ? null : r?.response ?? null), (e) => { error = e; return null; });
    const response = await Promise.race([answered, timedOut]);
    if (!stop.signal.aborted) stop.abort();
    if (asking === stop) asking = null;
    if (failing) return;
    if (response === 0) {
      if (kind === 'game' && key) saveConfig({ ...loadConfig(), [CONFIRM_RECORD]: { backend: launch.backend, gpu: key, chromium, at: new Date(now()).toISOString() } });
      log(`[shell] GPU-BACKEND: the player sees the ${kind} on ${launch.backend}`);
      return;
    }
    if (response !== null) await fail(`the player saw no ${kind}`, { told: false });
    else await fail(error ? `the box failed: ${error?.message ?? error}` : `the player did not answer within ${confirmTimeoutMs / 1000} s`, { told: false, record: false });
  }

  async function onGpuGone(details) {
    // A clean exit is the GPU process leaving on purpose, as main.cjs treats a renderer's: not a backend that failed to start.
    if (!armed || details?.reason === 'clean-exit' || now() - startedAt > GPU_GONE_GRACE_MS) return;
    if (!key) key = gpuKey(await gpuInfoWithin(app, 'basic', infoTimeoutMs));
    await fail(`GPU process gone: ${details?.reason ?? 'unknown'}`);
  }

  let reportClock = null;
  let reported = false;
  /** The game window was made: the clock its page's report must beat starts. Once a launch. */
  function pageOpened() {
    if (!armed || reportClock) return;
    reportClock = setTimeout(() => {
      if (!reported) fail(`the game page reported no WebGL2 context within ${reportTimeoutMs / 1000} s`);
    }, reportTimeoutMs);
    reportClock.unref?.();
  }

  /** The game page's preload asks whether to make its WebGL2 context: only on a launch that took the switches. */
  function pageAsks() {
    pageOpened();
    return armed;
  }

  /** The game page's WebGL2 context (webgl2Report). The first report counts; a reload's is ignored. */
  function pageReport(report) {
    if (!armed || reported) return Promise.resolve();
    reported = true;
    clearTimeout(reportClock);
    const renderer = String(report?.renderer ?? '');
    if (report?.webgl2 !== true) return fail('the game page got no WebGL2 context');
    if (isSoftwareRenderer(renderer)) return fail(`the game page's renderer is a software one: ${renderer}`);
    if (rendererMissesBackend(renderer, launch.backend)) return fail(`the game page's renderer is not ${launch.backend}: ${renderer}`);
    log(`[shell] GPU-BACKEND: ${launch.backend} up - the game page's WebGL2 renderer: ${renderer}`);
    return Promise.resolve();
  }

  return { check, onGpuGone, pageOpened, pageAsks, pageReport, windowShown };
}

module.exports = {
  UI_PREFS, GRAPHICS_BACKEND_PREF, CONFIG_NAME, FAILURE_RECORD, CONFIRM_RECORD, BACKEND_ENV, GPU_GONE_GRACE_MS, PAGE_REPORT_TIMEOUT_MS,
  CONFIRM_TIMEOUT_MS, HOLD_DEFAULT_ARG, BACKEND_SWITCHES,
  savedBackend, failureRecord, backendLaunch, holdsVSync, isSoftwareRenderer, rendererMissesBackend, gpuKey, rendererOf, backendFailedNotice,
  backendConfirmNotice, backendOption, chooseBackend, restartArgs, webgl2Report, watchBackend,
};
