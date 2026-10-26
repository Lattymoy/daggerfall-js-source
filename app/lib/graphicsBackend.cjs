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
//   2. Once the first window is up (watchBackend): a launch that took the switches reads the renderer that draws. A
//      software renderer, or the GPU process gone within the first minute, records the failure keyed by the GPU and its
//      driver version, tells the player, and relaunches without the switches.
//   3. A launch held by the record compares the GPU, driver and Chromium it runs on with the record's. A different one
//      (a driver update, or an app update that brings a new Chromium and its ANGLE) clears the record, and the NEXT
//      start tries the chosen backend again.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readPref } = require('./fileStorage.cjs');

/** src/systems/uiPrefs.js STORAGE_KEY - the port's own shelf (test/tooling/gpubackend.test.js holds the two equal). */
const UI_PREFS = 'dagger.ui.v1';
/** The shelf's key, and its values: 'default' is Chromium's own choice (D3D11 on Windows). */
const GRAPHICS_BACKEND_PREF = 'graphicsBackend';
/** app/main.cjs CONFIG_FILE's name. Read here because main.cjs defines CONFIG_FILE after the switches are appended. */
const CONFIG_NAME = 'config.json';
/** The failure record's key in config.json: { backend, gpu, reason, at }. */
const FAILURE_RECORD = 'graphicsBackendFailure';
/** The probe's door, in the shape of DAGGER_USER_DATA: names a backend for one launch over the pref. `metal`
 *  (ANGLE's macOS backend) cannot start on Windows - Chromium falls to WARP, as a failed Vulkan would - so it forces the
 *  guard's failure path on a working machine. (`gl`, which failed in Edge, starts in the app on an NVIDIA driver.) */
const BACKEND_ENV = 'DAGGER_GRAPHICS_BACKEND';
/** A GPU process that stops within this long of the launch counts as the backend failing to start. */
const GPU_GONE_GRACE_MS = 60_000;
/** getGPUInfo can wait on a GPU process that is gone; the guard does not wait past this. */
const GPU_INFO_TIMEOUT_MS = 10_000;

/** Each backend's Chromium switches, as [name, value]. */
const BACKEND_SWITCHES = Object.freeze({
  vulkan: Object.freeze([['use-gl', 'angle'], ['use-angle', 'vulkan']]),
  metal: Object.freeze([['use-gl', 'angle'], ['use-angle', 'metal']]),
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
function backendLaunch(userDataRoot, { platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32') return { backend: 'default', switches: [], held: null };
  const backend = Object.hasOwn(BACKEND_SWITCHES, env[BACKEND_ENV] ?? '') ? env[BACKEND_ENV] : savedBackend(userDataRoot);
  if (backend === 'default') return { backend, switches: [], held: null };
  const held = failureRecord(userDataRoot);
  if (held) return { backend, switches: [], held };
  return { backend, switches: BACKEND_SWITCHES[backend].map(([name, value]) => [name, value]), held: null };
}

/** Whether a renderer string names a software renderer. */
function isSoftwareRenderer(renderer) {
  const text = String(renderer ?? '').toLowerCase();
  return SOFTWARE_RENDERERS.some((name) => name.test(text));
}

/** The word each backend's renderer string carries when ANGLE runs on it ("ANGLE (NVIDIA, Vulkan 1.4.341 (...), ...)"). */
const BACKEND_RENDERER_WORDS = Object.freeze({ vulkan: /vulkan/i, metal: /metal/i });

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

const BACKEND_NAMES = Object.freeze({ vulkan: 'Vulkan', metal: 'Metal' });

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
 * `beforeExit` runs before the relaunch's app.exit, which skips will-quit (main.cjs flushes its held GPU-gone entry);
 * `chromium` is this build's Chromium version, kept in the record.
 * Returns { check, onGpuGone }: main.cjs calls check() once the first window is up, and onGpuGone(details) from its
 * child-process-gone handler for a GPU process.
 */
function watchBackend({ app, launch, loadConfig, saveConfig, notify, beforeExit = () => {}, chromium = process.versions.chrome ?? null, now = Date.now, log = console.warn, infoTimeoutMs = GPU_INFO_TIMEOUT_MS }) {
  const startedAt = now();
  const armed = launch.switches.length > 0;
  let key = null;
  let failing = false;

  function fail(reason) {
    if (failing) return Promise.resolve();
    failing = true;
    const record = { backend: launch.backend, gpu: key, chromium, reason, at: new Date(now()).toISOString() };
    saveConfig({ ...loadConfig(), [FAILURE_RECORD]: record });
    log(`[shell] GPU-BACKEND: ${launch.backend} failed (${reason}) on ${key ?? 'an unknown GPU'} - relaunching on the default`);
    return Promise.resolve()
      .then(() => notify(backendFailedNotice(launch.backend)))
      .catch(() => {})
      .then(() => { try { beforeExit(); } catch { /* the relaunch goes ahead */ } app.relaunch(); app.exit(0); });
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
      return;
    }
    if (!current) return;
    if (!record.gpu) {
      saveConfig({ ...config, [FAILURE_RECORD]: { ...record, gpu: current } });
    } else if (record.gpu !== current) {
      const { [FAILURE_RECORD]: _cleared, ...rest } = config;
      saveConfig(rest);
      log(`[shell] GPU-BACKEND: the GPU or driver changed (${record.gpu} -> ${current}) - the next start tries ${record.backend} again`);
    }
  }

  let checked = false;
  /** Once a launch: main.cjs calls it at each load of the first window. */
  async function check() {
    if (checked || (!armed && !launch.held)) return;
    checked = true;
    const info = await gpuInfoWithin(app, 'complete', infoTimeoutMs) ?? await gpuInfoWithin(app, 'basic', infoTimeoutMs);
    key = gpuKey(info) ?? key;
    if (launch.held) { review(info); return; }
    const renderer = rendererOf(info);
    if (isSoftwareRenderer(renderer)) await fail(`software renderer: ${renderer}`);
    else if (rendererMissesBackend(renderer, launch.backend)) await fail(`renderer is not ${launch.backend}: ${renderer}`);
  }

  async function onGpuGone(details) {
    if (!armed || now() - startedAt > GPU_GONE_GRACE_MS) return;
    if (!key) key = gpuKey(await gpuInfoWithin(app, 'basic', infoTimeoutMs));
    await fail(`GPU process gone: ${details?.reason ?? 'unknown'}`);
  }

  return { check, onGpuGone };
}

module.exports = {
  UI_PREFS, GRAPHICS_BACKEND_PREF, CONFIG_NAME, FAILURE_RECORD, BACKEND_ENV, GPU_GONE_GRACE_MS, BACKEND_SWITCHES,
  savedBackend, failureRecord, backendLaunch, isSoftwareRenderer, rendererMissesBackend, gpuKey, rendererOf, backendFailedNotice, watchBackend,
};
