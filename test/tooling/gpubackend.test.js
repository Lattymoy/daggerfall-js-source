// GPU-BACKEND (2026-10-26, app/lib/graphicsBackend.cjs): the desktop app's Vulkan opt-in on Windows and its guard. The
// switch choice reads the shelf the page writes (through the page's own uiPrefs writer, as disc28e_vsync.test.js reads
// VSync) and the failure record in config.json; the guard is driven with a fake Electron app. The shell's wiring is
// pinned by source (it runs in Electron), as FPS-VSYNC's is. The settings row is test/systems/org2_options.test.js's.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { codeHasOnce } from '../codeOnly.mjs';

const require = createRequire(import.meta.url);
const B = require('../../app/lib/graphicsBackend.cjs');
const { createFileStorage } = require('../../app/lib/fileStorage.cjs');
const { frameRateSwitches, VSYNC_OFF_SWITCHES } = require('../../app/lib/frameRate.cjs');
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const WIN = { platform: 'win32', env: {} };
const VULKAN = [['use-gl', 'angle'], ['use-angle', 'vulkan'], ['disable-gpu-sandbox', '']];

const roots = [];
/** A userData folder with the shell's file store on the page's bridge, as app/preload.cjs puts it there. */
function shell() {
  const root = mkdtempSync(join(tmpdir(), 'gpubackend-'));
  roots.push(root);
  globalThis.daggerShell = { storage: createFileStorage(root), platform: 'win32' };
  resetPrefs();
  return root;
}
afterEach(() => {
  delete globalThis.daggerShell;
  resetPrefs();
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});
const writeConfig = (root, cfg) => writeFileSync(join(root, B.CONFIG_NAME), JSON.stringify(cfg));

/** GPU info as the app's Chromium answers it, read on the RTX 5080 (2026-10-26, CDP SystemInfo.getInfo): on the card,
 *  the NVIDIA device and Microsoft's Basic Render Driver beside it; on a backend that failed to WARP, ONLY ANGLE's
 *  synthetic software device (vendor 0xffff, "SwANGLE") - the card is not named at all. */
const NVIDIA = { vendorId: 0x10de, deviceId: 0x2c02, driverVersion: '32.0.16.1088' };
const BASIC_RENDER = { vendorId: 0x1414, deviceId: 0x8c, driverVersion: '10.0.26100.9711' };
const SWANGLE = { vendorId: 0xffff, deviceId: 0xffff, driverVendor: 'SwANGLE', driverVersion: '10.0.26100.9711' };
const infoOf = (renderer, { warp = false, driver = NVIDIA.driverVersion } = {}) => ({
  auxAttributes: { glRenderer: renderer },
  gpuDevice: warp ? [{ ...SWANGLE, active: true }] : [{ ...NVIDIA, driverVersion: driver, active: true }, { ...BASIC_RENDER, active: false }],
});
const D3D11 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const VK = 'ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA GeForce RTX 5080 (0x00002C02)), NVIDIA-581.57.0.0)';
const WARP = 'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)';

test('GPU-BACKEND: the shell reads the backend the page saved - Vulkan takes ANGLE\'s two switches, the default takes none (mutants: the switches for the default; the pref read off another shelf)', () => {
  const root = shell();
  assert.equal(B.savedBackend(root), 'default', 'nothing saved: Chromium\'s own choice');
  assert.deepEqual(B.backendLaunch(root, WIN), { backend: 'default', switches: [], held: null });
  assert.ok(setPref(B.GRAPHICS_BACKEND_PREF, 'vulkan'), 'the page writes through the shell\'s store');
  assert.equal(B.savedBackend(root), 'vulkan');
  assert.deepEqual(B.backendLaunch(root, WIN), { backend: 'vulkan', switches: VULKAN, held: null });
  setPref(B.GRAPHICS_BACKEND_PREF, 'default');
  assert.deepEqual(B.backendLaunch(root, WIN).switches, [], 'back to the default: no switches');
});

test('GPU-BACKEND: off Windows, an unknown value or an unreadable shelf, nothing changes; the probe door names a backend for one launch (mutants: the platform gate dropped; any value taken as a backend)', () => {
  const root = shell();
  setPref(B.GRAPHICS_BACKEND_PREF, 'vulkan');
  for (const platform of ['darwin', 'linux']) assert.deepEqual(B.backendLaunch(root, { platform, env: {} }).switches, [], platform);
  const store = createFileStorage(root);
  store.setItem(B.UI_PREFS, JSON.stringify({ [B.GRAPHICS_BACKEND_PREF]: 'metal' }));
  assert.equal(B.savedBackend(root), 'default', 'a value that is no backend');
  store.setItem(B.UI_PREFS, '{ not json');
  assert.equal(B.savedBackend(root), 'default', 'unreadable: the default, never a surprise backend');
  assert.deepEqual(B.backendLaunch(root, { platform: 'win32', env: { [B.BACKEND_ENV]: 'metal' } }).switches, [['use-gl', 'angle'], ['use-angle', 'metal']]);
  assert.deepEqual(B.backendLaunch(root, { platform: 'win32', env: { [B.BACKEND_ENV]: 'nonsense' } }).switches, [], 'the door takes only a known backend');
});

test('GPU-BACKEND: a failure on record holds every launch on the default, whatever the pref says (mutant: the record not read before the switches)', () => {
  const root = shell();
  setPref(B.GRAPHICS_BACKEND_PREF, 'vulkan');
  const record = { backend: 'vulkan', gpu: '10de:2c02@32.0.16.1088', reason: 'software renderer', at: '2026-10-26T00:00:00.000Z' };
  writeConfig(root, { arena2Path: 'X', [B.FAILURE_RECORD]: record });
  assert.deepEqual(B.backendLaunch(root, WIN), { backend: 'vulkan', switches: [], held: record });
  writeConfig(root, { arena2Path: 'X' });
  assert.deepEqual(B.backendLaunch(root, WIN).switches, VULKAN, 'no record: the chosen backend');
});

test('GPU-BACKEND: the guard knows a software renderer by its name - WARP, the Basic Render Driver, SwiftShader, llvmpipe - and never a GPU\'s, on either backend, whoever made it (mutants: a name dropped; a match on "Microsoft" alone; WARP matched inside a word)', () => {
  const software = [
    WARP,
    'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11-10.0.26100.9711)',   // read in the app, getGPUInfo's form
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'Google SwiftShader',
    'ANGLE_D3D11_WARP',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
  ];
  for (const r of software) assert.equal(B.isSoftwareRenderer(r), true, r);
  const gpus = [
    D3D11, VK,
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11-32.0.16.1088)',   // read in the app
    'ANGLE (NVIDIA, Vulkan 1.4.341 (NVIDIA NVIDIA GeForce RTX 5080 (0x00002C02)), NVIDIA-610.88.0.0)',   // read in the app
    'ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 5080/PCIe/SSE2, OpenGL 4.5.0)',   // read in the app (use-angle=gl)
    'ANGLE (Intel, Intel(R) UHD Graphics 630 (0x00003E92) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Intel, Vulkan 1.3.260 (Intel(R) Iris(R) Xe Graphics (0x00009A49)), Intel Corporation)',
    'ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, Vulkan 1.3.270 (AMD Radeon RX 7800 XT (0x0000747E)), AMD proprietary driver)',
    'ANGLE (Qualcomm, Qualcomm(R) Adreno(TM) X1-85 GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Microsoft, Microsoft Surface GPU, D3D11)',
    'ANGLE (Acme, Warpdrive 9000 Direct3D11 vs_5_0 ps_5_0, D3D11)',   // the letters, not the rasterizer
    '', undefined,
  ];
  for (const r of gpus) assert.equal(B.isSoftwareRenderer(r), false, String(r));
});

test('GPU-BACKEND: a renderer that does not name the chosen backend is ANGLE on another one - D3D9, which gives no WebGL2, read in the app (mutants: the backend unread; an empty renderer taken for a failure)', () => {
  const D3D9 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 Direct3D9Ex vs_3_0 ps_3_0, nvldumdx.dll -32.0.16.1088)';   // read in the app, use-angle=d3d9
  assert.equal(B.rendererMissesBackend(D3D9, 'vulkan'), true);
  assert.equal(B.rendererMissesBackend(D3D11, 'vulkan'), true, 'Vulkan asked, D3D11 drawn');
  assert.equal(B.rendererMissesBackend(VK, 'vulkan'), false);
  assert.equal(B.rendererMissesBackend('ANGLE (Intel, Vulkan 1.3.260 (Intel(R) Iris(R) Xe Graphics (0x00009A49)), Intel Corporation)', 'vulkan'), false);
  assert.equal(B.rendererMissesBackend('', 'vulkan'), false, 'no GPU info in time: no decision');
  assert.equal(B.rendererMissesBackend(D3D11, 'default'), false, 'the default asks for nothing');
});

test('GPU-BACKEND: the record\'s key is the physical GPU and its driver, another after a driver update; a failed launch names no GPU, never the software device as one (mutants: Microsoft\'s or SwANGLE\'s device keyed)', () => {
  const onCard = B.gpuKey(infoOf(D3D11));
  assert.equal(onCard, '10de:2c02@32.0.16.1088');
  assert.notEqual(B.gpuKey(infoOf(D3D11, { driver: '32.0.16.2000' })), onCard, 'a driver update');
  assert.equal(B.gpuKey(infoOf(WARP, { warp: true })), null, 'under WARP the card is not listed - the next launch keys the record');
  assert.equal(B.gpuKey({ gpuDevice: [{ ...BASIC_RENDER, active: true }] }), null, 'the Basic Render Driver is no GPU');
  assert.equal(B.gpuKey(null), null);
});

/** A fake Electron app and main.cjs's config store, over one launch. */
function rig({ launch, info, config = {}, clock = 0, chromium = '142.0.7444.0', reportTimeoutMs = 50, writable = true, argv = ['app.exe', 'main'] }) {
  const calls = [];
  const state = { config: structuredClone(config), now: clock };
  const app = {
    getGPUInfo: async () => (typeof info === 'function' ? info() : info),
    releaseSingleInstanceLock: () => calls.push('unlock'),
    relaunch: (options) => { calls.push('relaunch'); state.relaunchOptions = options; },
    exit: (code) => calls.push(`exit ${code}`),
  };
  const guard = B.watchBackend({
    app, launch,
    loadConfig: () => structuredClone(state.config),
    saveConfig: (c) => { if (writable) state.config = structuredClone(c); calls.push('save'); },
    notify: async (opts) => { calls.push(`notice: ${opts.message}`); return { response: 0 }; },
    beforeExit: () => calls.push('flush'),
    chromium,
    now: () => state.now,
    log: () => {},
    infoTimeoutMs: 50,
    reportTimeoutMs,
    argv,
  });
  return { guard, calls, state };
}
const ARMED = { backend: 'vulkan', switches: VULKAN, held: null };

test('GPU-BACKEND: a launch on Vulkan that lands on a software renderer records the failure, tells the player, and relaunches; the relaunch on the card keys the record and keeps it (mutants: no record; no relaunch; the notice skipped; the unkeyed record cleared)', async () => {
  const { guard, calls, state } = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }), config: { arena2Path: 'X' } });
  await guard.check();
  assert.deepEqual(calls, ['save', 'notice: Vulkan could not start on this graphics card', 'flush', 'unlock', 'relaunch', 'exit 0']);
  assert.equal(state.config.arena2Path, 'X', 'the rest of config.json kept');
  const record = state.config[B.FAILURE_RECORD];
  assert.equal(record.backend, 'vulkan');
  assert.equal(record.gpu, null, 'the failed launch cannot see the card');
  const relaunch = rig({ launch: { backend: 'vulkan', switches: [], held: record }, info: infoOf(D3D11), config: state.config });
  await relaunch.guard.check();
  assert.equal(relaunch.state.config[B.FAILURE_RECORD]?.gpu, '10de:2c02@32.0.16.1088', 'kept, and keyed by the card it failed on');
  assert.match(record.reason, /^software renderer: .*Basic Render Driver/);
  const notice = B.backendFailedNotice('vulkan');
  assert.deepEqual([notice.buttons, notice.defaultId, notice.cancelId], [['Restart'], 0, 0], 'one answer: the relaunch');
});

test('GPU-BACKEND: Vulkan drawing on the card is left alone, and so is a launch on the default (mutant: the guard armed without the switches)', async () => {
  const onVulkan = rig({ launch: ARMED, info: infoOf(VK) });
  await onVulkan.guard.check();
  assert.deepEqual(onVulkan.calls, []);
  const onDefault = rig({ launch: { backend: 'default', switches: [], held: null }, info: infoOf(WARP, { warp: true }) });
  await onDefault.guard.check();
  await onDefault.guard.onGpuGone({ type: 'GPU', reason: 'crashed' });
  assert.deepEqual(onDefault.calls, [], 'a D3D11 launch never writes a Vulkan failure');
});

test('GPU-BACKEND: the GPU process gone in the first minute of a Vulkan launch is a failure; later, it is the GPU-TRAIL log\'s alone (mutant: the grace dropped)', async () => {
  const early = rig({ launch: ARMED, info: infoOf(VK) });
  early.state.now = B.GPU_GONE_GRACE_MS - 1;
  await early.guard.onGpuGone({ type: 'GPU', reason: 'crashed' });
  assert.deepEqual(early.calls, ['save', 'notice: Vulkan could not start on this graphics card', 'flush', 'unlock', 'relaunch', 'exit 0']);
  assert.equal(early.state.config[B.FAILURE_RECORD].reason, 'GPU process gone: crashed');
  assert.equal(early.state.config[B.FAILURE_RECORD].gpu, '10de:2c02@32.0.16.1088');
  const late = rig({ launch: ARMED, info: infoOf(VK) });
  late.state.now = B.GPU_GONE_GRACE_MS + 1;
  await late.guard.onGpuGone({ type: 'GPU', reason: 'crashed' });
  assert.deepEqual(late.calls, []);
  const twice = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }) });
  await Promise.all([twice.guard.check(), twice.guard.onGpuGone({ reason: 'crashed' })]);
  assert.equal(twice.calls.filter((c) => c === 'relaunch').length, 1, 'one relaunch, however many signs');
});

test('GPU-BACKEND: a held launch clears a record made on another driver, so the next start retries; the same driver keeps it; a record without a key gets one (mutants: the record never cleared; cleared on the same driver)', async () => {
  const record = { backend: 'vulkan', gpu: '10de:2c02@32.0.16.1088', reason: 'software renderer', at: 'x' };
  const held = { backend: 'vulkan', switches: [], held: record };
  const same = rig({ launch: held, info: infoOf(D3D11), config: { [B.FAILURE_RECORD]: record } });
  await same.guard.check();
  assert.deepEqual(same.calls, [], 'same GPU, same driver: held');
  const updated = rig({ launch: held, info: infoOf(D3D11, { driver: '32.0.16.2000' }), config: { arena2Path: 'X', [B.FAILURE_RECORD]: record } });
  await updated.guard.check();
  assert.deepEqual(updated.state.config, { arena2Path: 'X' }, 'a driver update clears the record');
  assert.ok(!updated.calls.includes('relaunch'), 'the retry is the next start, not a relaunch now');
  const unkeyed = { ...record, gpu: null };
  const keyed = rig({ launch: { ...held, held: unkeyed }, info: infoOf(D3D11), config: { [B.FAILURE_RECORD]: unkeyed } });
  await keyed.guard.check();
  assert.equal(keyed.state.config[B.FAILURE_RECORD].gpu, '10de:2c02@32.0.16.1088');
});

test('GPU-BACKEND: a Vulkan launch that drew on the card through another backend is a failure too (mutant: the renderer\'s backend unread)', async () => {
  const { guard, calls, state } = rig({ launch: ARMED, info: infoOf('ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 Direct3D9Ex vs_3_0 ps_3_0, nvldumdx.dll -32.0.16.1088)') });
  await guard.check();
  assert.deepEqual(calls, ['save', 'notice: Vulkan could not start on this graphics card', 'flush', 'unlock', 'relaunch', 'exit 0']);
  assert.match(state.config[B.FAILURE_RECORD].reason, /^renderer is not vulkan: .*Direct3D9Ex/);
});

test('GPU-BACKEND refresh on update: the record keeps the Chromium it failed on; an app update that brings another clears it so the next start retries, one that keeps it holds (mutants: the version unrecorded; a new Chromium held; the same one cleared)', async () => {
  const failed = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }), chromium: '142.0.7444.0' });
  await failed.guard.check();
  const record = failed.state.config[B.FAILURE_RECORD];
  assert.equal(record.chromium, '142.0.7444.0');
  const held = { backend: 'vulkan', switches: [], held: record };
  const sameApp = rig({ launch: held, info: infoOf(D3D11), config: failed.state.config, chromium: '142.0.7444.0' });
  await sameApp.guard.check();
  assert.ok(sameApp.state.config[B.FAILURE_RECORD], 'a game-only update keeps the Chromium: still held');
  const newApp = rig({ launch: held, info: infoOf(D3D11), config: failed.state.config, chromium: '144.0.7559.0' });
  await newApp.guard.check();
  assert.equal(newApp.state.config[B.FAILURE_RECORD], undefined, 'a new Chromium: the next start retries');
  assert.ok(!newApp.calls.includes('relaunch'));
});

test('GPU-BACKEND: a getGPUInfo that never answers does not hold the guard (mutant: no deadline)', async () => {
  const { guard, calls } = rig({ launch: ARMED, info: () => new Promise(() => {}) });
  // The deadline's timer is unref'd so it never holds the shell open; this one keeps the test's own loop alive past it.
  const hold = setInterval(() => {}, 1000);
  try {
    await guard.check();
  } finally {
    clearInterval(hold);
  }
  assert.deepEqual(calls, []);
});

test('GPU-BACKEND by source: the shell appends the switches before the app is ready, checks once the first window loads, and hears the GPU process gone; the shelf and the config file are the page\'s and main.cjs\'s', () => {
  const main = read('app/main.cjs');
  const from = main.indexOf("\nif (process.env.DAGGER_USER_DATA) app.setPath('userData'"), to = main.indexOf('\napp.whenReady()');
  assert.ok(from > 0 && to > from);
  const early = main.slice(from, to);
  codeHasOnce(early, /\nconst BACKEND_LAUNCH = backendLaunch\(app\.getPath\('userData'\)\);/);
  codeHasOnce(early, /\nfor \(const \[name, value\] of BACKEND_LAUNCH\.switches\) app\.commandLine\.appendSwitch\(name, value\);/);
  codeHasOnce(early, /app\.once\('browser-window-created', \(_e, w\) => w\.webContents\.on\('did-finish-load', backendGuard\.check\)\);/);
  codeHasOnce(early, /app\.on\('child-process-gone', \(_e, details\) => \{ if \(details\?\.type === 'GPU'\) backendGuard\.onGpuGone\(details\); \}\);/);
  codeHasOnce(early, /beforeExit: \(\) => gpuGone\.flush\(\) \}\);/, 'the relaunch writes a held GPU-gone entry first (app.exit skips will-quit)');
  codeHasOnce(main, new RegExp(`const CONFIG_FILE = \\(\\) => path\\.join\\(app\\.getPath\\('userData'\\), '${B.CONFIG_NAME.replace('.', '\\.')}'\\);`));
  assert.match(read('src/systems/uiPrefs.js'), new RegExp(`\\nconst STORAGE_KEY = '${B.UI_PREFS.replace(/\./g, '\\.')}';`));
});

/** A document whose canvas answers getContext('webgl2') with `gl` (null: no context), as the preload's document does. */
function docWith(gl) {
  return { createElement: (tag) => ({ getContext: (kind) => (tag === 'canvas' && kind === 'webgl2' ? gl : null) }) };
}
/** A WebGL2 context that names `renderer` through WEBGL_debug_renderer_info, and records its own loss. */
function glNaming(renderer) {
  const gl = { lost: false, RENDERER: 0x1f01 };
  const debug = { UNMASKED_RENDERER_WEBGL: 0x9246 };
  gl.getExtension = (name) => (name === 'WEBGL_debug_renderer_info' ? debug : name === 'WEBGL_lose_context' ? { loseContext: () => { gl.lost = true; } } : null);
  gl.getParameter = (p) => (p === debug.UNMASKED_RENDERER_WEBGL ? renderer : 'WebKit WebGL');
  return gl;
}

test('GPU-BACKEND webgl2Report: the page\'s own WebGL2 context, its unmasked renderer, lost again at once; no context, or a throwing one, is no WebGL2 (mutants: the masked renderer read; the context kept; a throw escaping)', () => {
  const gl = glNaming(VK);
  assert.deepEqual(B.webgl2Report(docWith(gl)), { webgl2: true, renderer: VK });
  assert.equal(gl.lost, true, 'the probe\'s context is given back');
  assert.deepEqual(B.webgl2Report(docWith(null)), { webgl2: false, renderer: '' });
  const throwing = { createElement: () => ({ getContext: () => { throw new Error('no GPU'); } }) };
  assert.deepEqual(B.webgl2Report(throwing), { webgl2: false, renderer: '' });
});

test('GPU-BACKEND: an armed launch whose game page got no WebGL2 context records the failure and relaunches, though Chromium\'s renderer names Vulkan (mutant: the page\'s report unread)', async () => {
  const { guard, calls, state } = rig({ launch: ARMED, info: infoOf(VK) });
  await guard.check();
  assert.deepEqual(calls, [], 'Chromium\'s own renderer passes');
  assert.equal(guard.pageAsks(), true, 'an armed launch asks the page for its context');
  await guard.pageReport({ webgl2: false, renderer: '' });
  assert.deepEqual(calls, ['save', 'notice: Vulkan could not start on this graphics card', 'flush', 'unlock', 'relaunch', 'exit 0']);
  assert.equal(state.config[B.FAILURE_RECORD].reason, 'the game page got no WebGL2 context');
  assert.equal(state.config[B.FAILURE_RECORD].gpu, '10de:2c02@32.0.16.1088');
});

test('GPU-BACKEND: the game page\'s WebGL2 renderer must name the backend and not be a software one; a Vulkan context passes, and a later reload\'s report is ignored (mutants: the page\'s renderer unread; a reload re-judged)', async () => {
  const D3D9 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 Direct3D9Ex vs_3_0 ps_3_0, nvldumdx.dll -32.0.16.1088)';
  const onD3D9 = rig({ launch: ARMED, info: infoOf(VK) });
  await onD3D9.guard.pageReport({ webgl2: true, renderer: D3D9 });
  assert.match(onD3D9.state.config[B.FAILURE_RECORD].reason, /^the game page's renderer is not vulkan: .*Direct3D9Ex/);
  const onWarp = rig({ launch: ARMED, info: infoOf(VK) });
  await onWarp.guard.pageReport({ webgl2: true, renderer: WARP });
  assert.match(onWarp.state.config[B.FAILURE_RECORD].reason, /^the game page's renderer is a software one: /);
  const onVulkan = rig({ launch: ARMED, info: infoOf(VK) });
  await onVulkan.guard.pageReport({ webgl2: true, renderer: VK });
  await onVulkan.guard.pageReport({ webgl2: false, renderer: '' });
  assert.deepEqual(onVulkan.calls, []);
});

test('GPU-BACKEND: the d3d9 probe door draws on the card under its own name, so only the page\'s missing WebGL2 context catches it (mutants: the door dropped; the page\'s report unread)', async () => {
  const root = shell();
  const launch = B.backendLaunch(root, { platform: 'win32', env: { [B.BACKEND_ENV]: 'd3d9' } });
  assert.deepEqual(launch.switches, [['use-gl', 'angle'], ['use-angle', 'd3d9']]);
  const D3D9 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 Direct3D9Ex vs_3_0 ps_3_0, nvldumdx.dll -32.0.16.1088)';
  const { guard, calls, state } = rig({ launch, info: infoOf(D3D9) });
  await guard.check();
  assert.deepEqual(calls, [], 'Chromium\'s renderer names the backend');
  await guard.pageReport(B.webgl2Report(docWith(null)));
  assert.deepEqual(calls, ['save', 'notice: Direct3D 9 could not start on this graphics card', 'flush', 'unlock', 'relaunch', 'exit 0']);
  assert.equal(state.config[B.FAILURE_RECORD].reason, 'the game page got no WebGL2 context');
});

test('GPU-BACKEND: a game page that never reports within the bound is a failure; one that reports in time stops the clock (mutants: no bound; the clock left running)', async () => {
  // The clock is unref'd so it never holds the shell open; this one keeps the test's own loop alive past it.
  const hold = setInterval(() => {}, 1000);
  try {
    const silent = rig({ launch: ARMED, info: infoOf(VK), reportTimeoutMs: 20 });
    silent.guard.pageOpened();
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(silent.calls, ['save', 'notice: Vulkan could not start on this graphics card', 'flush', 'unlock', 'relaunch', 'exit 0']);
    assert.equal(silent.state.config[B.FAILURE_RECORD].reason, 'the game page reported no WebGL2 context within 0.02 s');
    const prompt = rig({ launch: ARMED, info: infoOf(VK), reportTimeoutMs: 20 });
    prompt.guard.pageOpened();
    await prompt.guard.pageReport({ webgl2: true, renderer: VK });
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(prompt.calls, []);
  } finally {
    clearInterval(hold);
  }
});

test('GPU-BACKEND: a launch without the switches never asks the page, starts no clock, and ignores a report (mutant: the page probed on the default)', async () => {
  const hold = setInterval(() => {}, 1000);
  try {
    const onDefault = rig({ launch: { backend: 'default', switches: [], held: null }, info: infoOf(D3D11), reportTimeoutMs: 20 });
    assert.equal(onDefault.guard.pageAsks(), false);
    await onDefault.guard.pageReport({ webgl2: false, renderer: '' });
    await new Promise((r) => setTimeout(r, 60));
    assert.deepEqual(onDefault.calls, []);
  } finally {
    clearInterval(hold);
  }
});

test('GPU-BACKEND by source: the game window starts the page\'s clock, the preload makes its WebGL2 context only when the guard asks and reports it, and the shell hears it from the game window only', () => {
  const main = read('app/main.cjs');
  codeHasOnce(main, /\n {2}gameWindow = win;\n {2}backendGuard\.pageOpened\(\);/);
  codeHasOnce(main, /\nipcMain\.on\('dagger:backend-probe', \(e\) => \{ e\.returnValue = backendGuard\.pageAsks\(\); \}\);/);
  codeHasOnce(main, /e\.sender === gameWindow\.webContents\) backendGuard\.pageReport\(report\);/);
  const preload = read('app/preload.cjs');
  codeHasOnce(preload, /\nif \(ipcRenderer\.sendSync\('dagger:backend-probe'\) === true\) ipcRenderer\.send\('dagger:backend-webgl2', webgl2Report\(document\)\);/);
});

test('GPU-BACKEND: the relaunch gives up the single-instance lock before it starts the new copy (mutant: the lock kept)', async () => {
  const { guard, calls } = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }) });
  await guard.check();
  assert.ok(calls.indexOf('unlock') > -1 && calls.indexOf('unlock') < calls.indexOf('relaunch'), 'released before app.relaunch');
  assert.ok(calls.indexOf('unlock') < calls.indexOf('exit 0'));
});

test('GPU-BACKEND: a failure record that could not be written still ends the loop - the relaunch holds the default for that launch (mutants: relaunch with no hold; the hold ignored)', async () => {
  const bad = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }), writable: false, argv: ['app.exe', 'main', '--play'] });
  await bad.guard.check();
  assert.deepEqual(bad.state.relaunchOptions, { args: ['main', '--play', B.HOLD_DEFAULT_ARG] }, 'the hold rides the relaunch');
  const kept = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }) });
  await kept.guard.check();
  assert.equal(kept.state.relaunchOptions, undefined, 'a record that landed relaunches as before');
  const held = B.backendLaunch('unused', { platform: 'win32', env: { [B.BACKEND_ENV]: 'vulkan' }, argv: ['app.exe', 'main', B.HOLD_DEFAULT_ARG] });
  assert.deepEqual(held, { backend: 'default', switches: [], held: null }, 'the held launch takes no switches');
  const again = rig({ launch: ARMED, info: infoOf(WARP, { warp: true }), writable: false, argv: ['app.exe', 'main', B.HOLD_DEFAULT_ARG] });
  await again.guard.check();
  assert.deepEqual(again.state.relaunchOptions, undefined, 'the hold is not added twice');
});

test('GPU-BACKEND: a GPU process that exited cleanly is not a backend that failed (mutant: every reason fails)', async () => {
  const clean = rig({ launch: ARMED, info: infoOf(D3D11) });
  await clean.guard.onGpuGone({ type: 'GPU', reason: 'clean-exit' });
  assert.deepEqual(clean.calls, [], 'no record, no notice, no relaunch');
  const crashed = rig({ launch: ARMED, info: infoOf(D3D11) });
  await crashed.guard.onGpuGone({ type: 'GPU', reason: 'crashed' });
  assert.ok(crashed.calls.includes('relaunch'));
});

test('GPU-BACKEND: only Vulkan lifts the GPU sandbox - the cost of a GPU process with no compositor at 1440p; the default and the probe doors keep it (mutants: the switch on every backend; the switch dropped)', () => {
  const names = (backend) => B.BACKEND_SWITCHES[backend].map(([name]) => name);
  assert.ok(names('vulkan').includes('disable-gpu-sandbox'));
  for (const door of ['metal', 'd3d9']) assert.ok(!names(door).includes('disable-gpu-sandbox'), door);
  assert.deepEqual(B.backendLaunch('unused', { platform: 'win32', env: {}, argv: [] }).switches, [], 'no pref: D3D11, nothing added');
});

test('GPU-BACKEND: a launch on Vulkan keeps VSync on - the resize freeze with VSync off; a default launch, a held one (the fallback) and a probe door take the VSync setting (mutants: held on every launch; never held)', () => {
  assert.equal(B.holdsVSync({ backend: 'vulkan', switches: VULKAN, held: null }), true);
  assert.equal(B.holdsVSync({ backend: 'default', switches: [], held: null }), false, 'D3D11');
  assert.equal(B.holdsVSync({ backend: 'vulkan', switches: [], held: { gpu: 'x' } }), false, 'Vulkan on record as failed: the launch is on D3D11, VSync off applies again');
  assert.equal(B.holdsVSync({ backend: 'metal', switches: [['use-gl', 'angle'], ['use-angle', 'metal']], held: null }), false, 'a probe door');
  const root = mkdtempSync(join(tmpdir(), 'gpubackend-vsync-'));
  try {
    const store = createFileStorage(root);
    store.setItem('dagger.ui.v1', JSON.stringify({ graphicsBackend: 'vulkan' }));
    store.setItem('dagger.settings.v1', JSON.stringify({ Video: { VSync: 'False' } }));
    assert.deepEqual(frameRateSwitches(root), [...VSYNC_OFF_SWITCHES], 'the setting alone would lift the wait');
    assert.equal(B.holdsVSync(B.backendLaunch(root, WIN)), true, 'VSync off and Vulkan: the shell skips the VSync-off switches');
    writeFileSync(join(root, 'config.json'), JSON.stringify({ [B.FAILURE_RECORD]: { backend: 'vulkan', gpu: null, chromium: process.versions.chrome, reason: 'x', at: 'then' } }));
    assert.equal(B.holdsVSync(B.backendLaunch(root, WIN)), false, 'after the fallback, the same profile gets VSync off back');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
