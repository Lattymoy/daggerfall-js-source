// WINDOW-WEATHER LIVE CHECK: enter a real building through its exterior door and save evidence.
// This is a correctness probe, not a performance measurement. Keep outputs outside the repo because
// screenshots can contain the user's ARENA2 data. Pixel readback runs around the add-on in a single
// live-renderer frame. Caravan entry
// must come from a supplied live helper; this probe never substitutes a synthetic room.
//
//   node tools/windowWeatherLiveProbe.mjs --help
//   ARENA2_PATH=<local ARENA2 folder> node tools/windowWeatherLiveProbe.mjs

import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createServer as createNetServer } from 'node:net';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, access, stat, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { installLiveSampling } from './windowWeatherLiveSample.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = 5310;
const DEFAULT_TIMEOUT_MS = 300_000;
const VIEWPORT = { width: 800, height: 450 };
const execFile = promisify(execFileCallback);

function help() {
  return `Usage: node tools/windowWeatherLiveProbe.mjs [options]

Options:
  --arena2-path <dir>          ARENA2 folder (default: ARENA2_PATH)
  --browser-executable <path>  Browser executable (default: Edge on Windows if installed,
                               otherwise Playwright Chromium)
  --output-dir <absolute-dir>  Parent for a fresh, create-only run directory
                               (default: OS temp/dfo-window-weather-live)
  --port <port>                Dedicated loopback port; occupied ports fail (default: ${DEFAULT_PORT})
  --timeout-ms <ms>            Overall watchdog limit (default: ${DEFAULT_TIMEOUT_MS})
  --lowload                    Delay requestAnimationFrame callbacks by 100 ms
  --setup-only                 Return success when interior setup is verified;
                               setup verification only
  -h, --help                   Show this help without starting Vite or a browser

The probe boots Daggerfall in shot mode, prefers a live tavern door, warps and
aims the player at it, then calls the game's __enter hook. It records same-frame
pixel observations around the add-on draw for rain, snow, sand and a scheduled
flash. Caravan validation remains pending.
`;
}

function parseArgs(argv) {
  const out = { help: false, lowload: false, setupOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--lowload') out.lowload = true;
    else if (arg === '--setup-only') out.setupOnly = true;
    else if (['--arena2-path', '--browser-executable', '--output-dir', '--port', '--timeout-ms'].includes(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      out[{ '--arena2-path': 'arena2Path', '--browser-executable': 'browserExecutable', '--output-dir': 'outputDir', '--port': 'port', '--timeout-ms': 'timeoutMs' }[arg]] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return out;
}

async function edgeFallback() {
  if (process.platform !== 'win32') return null;
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean);
  for (const root of roots) {
    const candidate = join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    try { await access(candidate); return candidate; } catch { /* try the other standard install root */ }
  }
  return null;
}

async function assertFreeLoopbackPort(port) {
  await new Promise((resolvePromise, reject) => {
    const probe = createNetServer();
    probe.once('error', (error) => reject(new Error(`Loopback port ${port} is unavailable: ${error.message}`)));
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => probe.close((error) => error ? reject(error) : resolvePromise()));
  });
}

async function freshRunDirectory(parent) {
  if (!isAbsolute(parent)) throw new Error('--output-dir must be absolute');
  await mkdir(parent, { recursive: true });
  for (let attempt = 0; attempt < 8; attempt++) {
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const path = join(parent, `run-${stamp}-${process.pid}-${Math.random().toString(16).slice(2, 8)}`);
    try { await mkdir(path, { recursive: false }); return path; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('Could not allocate a fresh output directory');
}

async function sourceReceipt() {
  const { stdout: commit } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: ROOT });
  const { stdout: changed } = await execFile('git', ['diff', '--name-only', '-z', 'HEAD', '--'], { cwd: ROOT, encoding: null });
  const { stdout: untracked } = await execFile('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: null });
  const trackedNames = changed.toString('utf8').split('\0').filter(Boolean);
  const untrackedNames = untracked.toString('utf8').split('\0').filter(Boolean);
  const workingTreeFiles = {};
  for (const [name, status] of [...trackedNames.map((name) => [name, 'tracked-dirty']), ...untrackedNames.map((name) => [name, 'untracked'])]) {
    try { workingTreeFiles[name] = { status, sha256: createHash('sha256').update(await readFile(join(ROOT, name))).digest('hex') }; }
    catch (error) { workingTreeFiles[name] = { status, unreadable: error.code ?? error.message }; }
  }
  const ownSourceHash = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  let windowWeatherModuleHash = null;
  try { windowWeatherModuleHash = createHash('sha256').update(await readFile(join(ROOT, 'src/render/windowWeather.js'))).digest('hex'); } catch { /* recorded as unavailable */ }
  return { commit: commit.trim(), workingTreeFiles, harnessSourceHash: ownSourceHash, windowWeatherModuleHash };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(help()); return; }

  const arena2Path = resolve(args.arena2Path ?? process.env.ARENA2_PATH ?? '');
  if (!args.arena2Path && !process.env.ARENA2_PATH) throw new Error('Set ARENA2_PATH or pass --arena2-path <dir>');
  const arenaInfo = await stat(arena2Path).catch(() => null);
  if (!arenaInfo?.isDirectory()) throw new Error(`ARENA2_PATH is not a directory: ${arena2Path}`);
  process.env.ARENA2_PATH = arena2Path;

  const outputParent = resolve(args.outputDir ?? process.env.WINDOW_WEATHER_LIVE_OUTPUT ?? join(tmpdir(), 'dfo-window-weather-live'));
  if (!isAbsolute(args.outputDir ?? process.env.WINDOW_WEATHER_LIVE_OUTPUT ?? outputParent)) throw new Error('--output-dir must be absolute');
  const runDir = await freshRunDirectory(outputParent);
  const port = Number(args.port ?? process.env.WINDOW_WEATHER_LIVE_PORT ?? DEFAULT_PORT);
  const timeoutMs = Number(args.timeoutMs ?? process.env.WINDOW_WEATHER_LIVE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Invalid loopback port: ${port}`);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error(`Invalid timeout: ${timeoutMs}`);

  const requestedExecutable = args.browserExecutable ?? process.env.PW_EXECUTABLE_PATH ?? await edgeFallback();
  if (requestedExecutable) await access(requestedExecutable).catch(() => {
    throw new Error(`Browser executable is not accessible: ${requestedExecutable}`);
  });

  const result = {
    status: 'running', startedAt: new Date().toISOString(), repo: ROOT,
    source: await sourceReceipt(),
    arena2Path, browserExecutable: requestedExecutable ?? 'Playwright Chromium',
    viewport: VIEWPORT, lowload: args.lowload, timeoutMs,
    outputDirectory: runDir, mode: null, building: null, exteriorDoor: null,
    scope: { setup: 'not-run', windowWeatherPixels: 'pending', scenarioComparison: 'pending', caravan: 'pending' },
    diagnostics: { pageErrors: [], pageCrashes: [], webglContextLost: [], consoleErrors: [], consoleWarnings: [], failedRequests: [], httpErrors: [] },
    screenshots: [],
    scenarioPlan: {
      status: 'same-frame instrumentation; see scenarios for measured results',
      controlQuery: '?weather=rain&windows=full&windowweatherdepth=off',
      addonQuery: '?weather=rain&windows=full',
      pixelCapture: 'Twelve same-frame samples per weather case (one flash frame), actual cut/uncut glass mask, fixed weather time and wind steps; same pose and building after depth-door reload.',
      caravan: 'Deferred until a helper enters the real caravan interior and exposes its live glass frame.',
    },
  };

  let server = null, browser = null, context = null, page = null, cleanupPromise = null, watchdogTimer = null;
  let interrupted = false, watchdogExpired = false, cancelled = false;
  let rejectWatchdog;
  const watchdogFailure = new Promise((_, reject) => { rejectWatchdog = reject; });
  watchdogFailure.catch(() => {});
  const bounded = (label, operation) => Promise.race([
    Promise.resolve().then(operation),
    watchdogFailure.then(() => { throw new Error(`${label} was cancelled`); }),
  ]);
  const acquire = async (label, operation, assign, closeLate) => {
    const pending = Promise.resolve().then(operation);
    pending.then((handle) => { if (cancelled) void closeLate(handle); }, () => {});
    const handle = await bounded(label, () => pending);
    if (cancelled) { await closeLate(handle); throw new Error(`${label} completed after cancellation`); }
    assign(handle);
    return handle;
  };
  const settleWithin = (promise, ms) => Promise.race([
    Promise.resolve(promise).then(() => undefined, () => undefined),
    new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
  ]);
  const closeWithin = async (fn) => { await settleWithin(Promise.resolve().then(fn), 2500); };
  const cleanup = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      await Promise.allSettled([
        ...(context ? [closeWithin(() => context?.close())] : []),
        ...(browser ? [closeWithin(() => browser?.close())] : []),
        ...(server ? [closeWithin(() => server?.close())] : []),
      ]);
    })().finally(() => { cleanupPromise = null; });
    return cleanupPromise;
  };
  const onSignal = (signal) => {
    interrupted = true;
    cancelled = true;
    result.interruptedBy = signal;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    rejectWatchdog(new Error(`Interrupted by ${signal}`));
    void cleanup();
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  watchdogTimer = setTimeout(() => {
    watchdogExpired = true;
    cancelled = true;
    result.watchdogExpired = true;
    process.exitCode = 1;
    rejectWatchdog(new Error(`Overall watchdog expired after ${timeoutMs} ms`));
    void cleanup();
  }, timeoutMs);
  const saveShot = async (name) => {
    const file = join(runDir, name);
    await page.screenshot({ path: file, fullPage: false, timeout: Math.min(timeoutMs, 30_000) });
    result.screenshots.push(file);
  };

  try {
    await bounded('Loopback port check', () => assertFreeLoopbackPort(port));
    if (interrupted) throw new Error('Interrupted before server startup');
    await acquire('Vite server creation', () => createServer({
      configFile: join(ROOT, 'vite.config.js'), root: ROOT,
      server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null }, logLevel: 'error',
    }), (handle) => { server = handle; }, (handle) => closeWithin(() => handle.close()));
    await bounded('Vite server startup', () => server.listen());
    if (interrupted) throw new Error('Interrupted before browser startup');

    await acquire('Browser launch', () => chromium.launch({
      headless: true,
      ...(requestedExecutable ? { executablePath: requestedExecutable } : {}),
      args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
      timeout: Math.min(timeoutMs, 30_000),
    }), (handle) => { browser = handle; }, (handle) => closeWithin(() => handle.close()));
    if (interrupted) throw new Error('Interrupted during browser startup');
    await acquire('Browser context creation', () => browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce' }),
      (handle) => { context = handle; }, (handle) => closeWithin(() => handle.close()));
    if (args.lowload) await context.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
      const timers = new Map(), native = new Map(); let token = 0;
      window.requestAnimationFrame = (callback) => {
        const id = ++token;
        timers.set(id, setTimeout(() => {
          timers.delete(id);
          native.set(id, raf((time) => { native.delete(id); callback(time); }));
        }, 100));
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        clearTimeout(timers.get(id)); timers.delete(id);
        const nativeId = native.get(id); if (nativeId !== undefined) caf(nativeId);
        native.delete(id);
      };
    });
    await acquire('Page creation', () => context.newPage(), (handle) => { page = handle; }, (handle) => closeWithin(() => handle.close()));
    await page.addInitScript(() => {
      window.__wwWebglContextLosses = [];
      document.addEventListener('webglcontextlost', (event) => {
        window.__wwWebglContextLosses.push({ canvasId: event.target?.id ?? null, time: Date.now() });
      }, true);
    });

    // Install every diagnostic before navigation so boot failures are captured too.
    page.on('pageerror', (error) => result.diagnostics.pageErrors.push(String(error.stack ?? error.message).slice(0, 1200)));
    page.on('crash', () => result.diagnostics.pageCrashes.push({ at: new Date().toISOString() }));
    page.on('console', (message) => {
      const text = message.text().slice(0, 600);
      if (message.type() === 'error') result.diagnostics.consoleErrors.push(text);
      if (message.type() === 'warning') result.diagnostics.consoleWarnings.push(text);
    });
    page.on('requestfailed', (request) => result.diagnostics.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
    page.on('response', (response) => { if (response.status() >= 400) result.diagnostics.httpErrors.push({ status: response.status(), url: response.url() }); });

    const query = 'world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12%3A02&wseed=1&weather=rain&rain=200&skin=enhanced&windows=full&touch=off';
    let entered = null;
    const waitFrames = async (count = 3) => {
      const frame = await page.evaluate(() => window.__frame);
      await page.waitForFunction(([frame, count]) => window.__frame > frame + count, [frame, count], { timeout: 30_000, polling: 'raf' });
    };
    const dismissNotices = async () => {
      for (let i = 0; i < 100; i++) {
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press('Enter');
        await waitFrames(4);
        const busy = await page.evaluate(() => !!window.__overlayKind?.() || !!document.querySelector('.notice-in'));
        if (!busy) return;
      }
      throw new Error(`Intro/tutorial overlay did not dismiss: ${JSON.stringify(await page.evaluate(() => ({ kind: window.__overlayKind?.(), notices: [...document.querySelectorAll('.notice-in')].map((n) => n.textContent) })))}`);
    };
    const boot = async (depthOff = false) => {
      await page.goto(`http://127.0.0.1:${port}/play/?${query}${depthOff ? '&windowweatherdepth=off' : ''}`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForFunction(() => window.__mode?.() === 'exterior' && window.__streamIdle?.() && window.__frame > 0, null, { timeout: timeoutMs, polling: 'raf' });
      await page.evaluate(async () => {
        const { setTutorialPopups } = await import('/src/systems/tutorials.js');
        setTutorialPopups(false);
        const { setPref } = await import('/src/systems/uiPrefs.js');
        setPref('questHerald', false); // Transient notifications off in this isolated test context only.
        const { setValue } = await import('/src/systems/settings/settings.js');
        setValue('Controls', 'HeadBobbing', false);
      });
      // The intro explicitly asks for a click or a key: deliver a real key, rather than dropping its host slot.
      await dismissNotices();
      await page.evaluate(installLiveSampling);
      const candidates = await page.evaluate(() => (window.__doors?.() ?? []).flatMap((door, index) => {
        let building = null;
        try { building = JSON.parse(window.__buildingAt?.(index) ?? 'null'); } catch { /* not a building */ }
        return door.type === 1 && building?.buildingType === 15 ? [{ door, index, building }] : [];
      }));
      candidates.sort((a, b) => (a.building.name === 'The Black Dungeon' ? -1 : 0) - (b.building.name === 'The Black Dungeon' ? -1 : 0));
      const candidate = entered ? candidates.find((c) => c.building.buildingKey === entered.building.buildingKey) : candidates[0];
      if (!candidate) throw new Error('The same real tavern door is unavailable');
      const { pos, normal } = candidate.door;
      const stand = [pos[0] + normal[0] * 1.6, pos[1] - 1.2, pos[2] + normal[2] * 1.6];
      const yaw = Math.atan2(-normal[0], -normal[2]);
      await page.evaluate(([p, y]) => { window.__pose(...p, y, 0); window.__warpTo(p, y); window.__look(y, 0); }, [stand, yaw]);
      if (!await page.evaluate(async () => await window.__enter?.())) throw new Error('The live tavern entry failed');
      await page.waitForFunction(() => window.__mode?.() === 'interior' && !!window.__building?.(), null, { timeout: timeoutMs, polling: 'raf' });
      await dismissNotices();
      await waitFrames(5);
      entered = candidate; result.exteriorDoor = candidate;
      process.stdout.write(`Entered ${candidate.building.name}, depth ${depthOff ? 'OFF' : 'ON'}\n`);
    };
    process.stdout.write('Booting the live tavern\n');
    await boot();
    process.stdout.write('Interior entered; searching for a valid pose\n');
    await waitFrames();
    const initial = await page.evaluate(() => window.__wwLiveDiagnostics().last);
    const bounds = initial.colliderBounds;
    result.searchBounds = bounds;
    result.poseSearch = [];
    const captureMask = async () => {
      for (const [mode, cut] of [['mask-cut', true], ['mask-uncut', false], ['mask-final', true]]) {
        await page.evaluate(([mode, cut]) => window.__wwCapture(mode, cut), [mode, cut]);
        await page.waitForFunction(() => window.__wwLiveDiagnostics().mode === null, null, { timeout: 30_000, polling: 'raf' });
        await waitFrames(3);
      }
      const info = await page.evaluate(() => window.__wwLiveDiagnostics());
      if (!(info.mask.glass > 5000 && info.mask.wall > 1000 && info.mask.noise < info.mask.glass * 0.25 && info.last.validity.valid)) return null;
      return info.mask;
    };
    // A static batch can contain several window walls. Stand on the room side of each real triangle plane.
    const candidates = await page.evaluate(() => window.__wwPoseCandidates());
    candidates.sort((a, b) => Math.abs(a.plane.center[1] - initial.eye[1]) - Math.abs(b.plane.center[1] - initial.eye[1]));
    let pose = null;
    for (const candidate of candidates) {
      const { pos, yaw } = candidate;
      if (![0, 2].every((k) => pos[k] > bounds.min[k] + 0.5 && pos[k] < bounds.max[k] - 0.5)) continue;
      await page.evaluate(([pos, yaw]) => { window.__warpTo(pos, yaw); window.__look(yaw, 0); window.__wwResetPlanes(); }, [pos, yaw]);
      await waitFrames(60);
      const mask = await captureMask();
      const info = await page.evaluate(() => window.__wwLiveDiagnostics());
      result.poseSearch.push({ pos, yaw, mask: info.mask, last: info.last, error: info.wrapperError });
      if (mask) { pose = { pos, yaw }; break; }
    }
    if (!pose) throw new Error(`No stable real glass mask facing a pane at least 1.5 m away: ${JSON.stringify(result.poseSearch)}`);
    result.pose = pose;
    process.stdout.write(`Valid pose: ${JSON.stringify(pose)}\n`);
    const restorePose = async () => {
      await page.evaluate(({ pos, yaw }) => { window.__warpTo(pos, yaw); window.__look(yaw, 0); window.__wwResetPlanes(); }, pose);
      await waitFrames(60);
    };
    result.scenarios = {};
    const measure = async (name, word, flash = false) => {
      const mask = await captureMask();
      if (!mask) throw new Error('The selected pose lost its stable real glass mask');
      await page.evaluate(async ([word, flash]) => {
        const { setHeardWeather } = await import('/src/systems/weather/weatherSim.js');
        setHeardWeather(word, 1); window.__wwArmSample(word, flash);
      }, [word, flash]);
      await page.waitForFunction(() => window.__wwLiveDiagnostics().mode === null, null, { timeout: 150_000, polling: 'raf' });
      const info = await page.evaluate(() => window.__wwLiveDiagnostics());
      const frames = info.frames;
      const evidence = { mask, frames, depthReadback: info.depthReadback ?? null, glassChangedMean: frames.reduce((s, f) => s + f.glassChanged, 0) / frames.length, wallChanged: frames.reduce((s, f) => s + f.wallChanged, 0), glErrors: frames.map((f) => f.glError), diagnostics: info.last };
      result.scenarios[name] = evidence;
      await writeFile(join(runDir, 'partial.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      process.stdout.write(`${name}: glass mean ${evidence.glassChangedMean}, wall ${evidence.wallChanged}\n`);
      await saveShot(`${name}.png`);
      if (info.wrapperError || !frames.length || frames.some((f) => !f.validity.valid || f.glError !== 0)) throw new Error(`Invalid ${name} sample: ${JSON.stringify(info)}`);
      return evidence;
    };
    await restorePose();
    const on = await measure('rainDepthOn', 'rain');
    await boot(true); await restorePose();
    const off = await measure('rainDepthOff', 'rain');
    result.rainRatio = on.glassChangedMean / off.glassChangedMean;
    await boot(false); await restorePose();
    await measure('snow', 'snow');
    await measure('sand', 'sandstorm');
    await measure('flash', 'thunder', true);

    const observed = await page.evaluate(() => {
      let building = null;
      try { building = JSON.parse(window.__building?.() ?? 'null'); } catch { /* preserve the raw identity below */ }
      return { mode: window.__mode?.() ?? null, building, rawBuilding: window.__building?.() ?? null, frame: window.__frame ?? null };
    });
    result.mode = observed.mode;
    result.building = observed;
    if (observed.mode !== 'interior' || !observed.building) throw new Error(`Interior verification failed: ${JSON.stringify(observed)}`);
    const expectedName = entered.building?.name ?? entered.building?.buildingName ?? null;
    const expectedType = entered.building?.type ?? entered.building?.buildingType ?? null;
    const expectedFaction = entered.building?.faction ?? entered.building?.factionId ?? null;
    if (expectedName != null && observed.building.name !== expectedName) {
      throw new Error(`Entered building name changed: expected ${expectedName}, observed ${observed.building.name}`);
    }
    if (expectedType != null && observed.building.type !== expectedType) {
      throw new Error(`Entered building type changed: expected ${expectedType}, observed ${observed.building.type}`);
    }
    if (expectedFaction != null && observed.building.faction !== expectedFaction) {
      throw new Error(`Entered building faction changed: expected ${expectedFaction}, observed ${observed.building.faction}`);
    }
    if (expectedName == null && expectedType == null && expectedFaction == null) {
      throw new Error('The exterior door did not expose comparable building identity fields');
    }
    result.scope.setup = 'passed';
    await saveShot('interior.png');
    if (Object.values(result.scenarios).some((s) => !(s.glassChangedMean > 0) || s.wallChanged !== 0)) throw new Error('Weather missing at the real glass, or wall pixels changed; see all measured scenarios');
    if (result.rainRatio < 0.5) throw new Error('Depth ON suppresses more than half the rain: diagnose the live readback before changing rendering code');
    result.scope.windowWeatherPixels = 'passed';
    result.scope.scenarioComparison = 'same-session depth ON/OFF rain and depth ON snow/sand/flash; actual glass mask';
    result.status = 'passed';
  } catch (error) {
    result.status = watchdogExpired ? 'timed-out' : interrupted ? 'interrupted' : 'failed';
    result.error = String(error?.stack ?? error).slice(0, 3000);
    if (page && !cancelled) await bounded('Failure screenshot', () => saveShot('failure.png')).catch((shotError) => { result.screenshotError = String(shotError.message); });
  } finally {
    result.finishedAt = new Date().toISOString();
    if (page && !cancelled) {
      await settleWithin(bounded('Final diagnostics', async () => {
        result.diagnostics.webglContextLost = await page.evaluate(() => window.__wwWebglContextLosses ?? []).catch(() => result.diagnostics.webglContextLost);
        result.windowWeatherProbe ??= await page.evaluate(() => window.__wwLiveDiagnostics?.() ?? null).catch(() => null);
      }), 2500);
    }
    cancelled = true;
    await cleanup();
    if (watchdogExpired) result.status = 'timed-out';
    if (watchdogTimer) clearTimeout(watchdogTimer);
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    await writeFile(join(runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`${JSON.stringify({ status: result.status, scope: result.scope, outputDirectory: runDir, mode: result.mode, building: result.building?.building ?? null, scenarios: result.scenarios ?? null, pixelEvidence: result.windowWeatherProbe?.pixelEvidence ?? null, error: result.error ?? null }, null, 2)}\n`);
  if (args.setupOnly) {
    if (result.scope.setup !== 'passed') process.exitCode ||= 1;
  } else if (result.status !== 'passed') process.exitCode ||= 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
