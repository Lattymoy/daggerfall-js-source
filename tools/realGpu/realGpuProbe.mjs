// REAL-GPU PROBE (2026-10-26, the owner: "Yes we should" land it; "definitely don't run this in ci on push though").
// What the game costs on a real GPU, frame by frame: a headed Edge on this machine's own graphics (ANGLE over D3D11
// on Windows, the path Windows players run), one CPU profile per phase, and every frame over GAP_MS attributed to the
// code that ran inside it. tools/frameProbe.mjs and tools/bootFreezeProbe.mjs run headless on SwiftShader, whose
// compile and upload costs are not a driver's; BOOT-COMPILE (bible/07-Rendering/Performance-Priority.md) found the
// boot's shader links 22-37 s on D3D11 where SwiftShader had said 3 s. Built from the probe behind that A/B.
//
// For each phase: the frame gaps (p50/p95/p99/max, frames over 50/100/250 ms), the main thread's split into script,
// native (program), GC and idle, every long frame's inclusive and self attribution, the Edge processes' working set,
// and (CLOG=1) every WebGL read over 15 ms that waited, with the JS frames that asked. The run then JUDGES ITSELF
// (judgeRun): a software renderer, a phase that drew nothing, a boot whose profile could not be aligned to its frames,
// a boot with no world frame or a page that threw is reported as no measurement, and the probe exits 1.
//
// NOT FOR CI. It needs a GPU, a visible window and minutes per phase; test/tooling/realgpu_probe.test.js holds that no
// workflow under .github/workflows runs it.
//
// Run (from the tree to measure; ARENA2 is the freeware data, sh tools/fetch-data.sh):
//   ARENA2_PATH=/path/to/arena2 PROFILE_DIR=<fresh dir> PHASES=boot node tools/realGpu/realGpuProbe.mjs town   a COLD launch
//   ...then the same PROFILE_DIR with PHASES=boot,settled,out                                                 a WARM one
//   A first launch on a fresh profile compiles every shader on a cold cache; every later launch reads the browser's
//   shader cache. An A/B is the base and the head one after the other, same scene, nothing else running the game.
// Env:
//   <scene>        (the one argument, required: nothing starts without it) a tools/frameProbe.mjs SCENES name, or a
//                  /play/ URL; the fly phases swap its &play for &fly
//   PHASES=boot,settled,out,back   boot (page load until the stream stands idle), settled (SETTLE_S standing),
//                  out/back (FLY_S flying along DIR at SPEED m a step), walk (&play: the player's feet stepped),
//                  boot2 (the scene booted again in the same browser)
//   PROFILE_DIR    a persistent browser profile (the shader cache survives between its launches); none: a fresh one
//   OUT=<dir>      where the runs go (default: the OS temp dir's realGpuProbe/<time>)
//   PORT=5261      the dev server this probe starts on the tree; BASE=<url> uses a server already running instead
//   TREE=<dir>     the tree to serve (default: this one)
//   CHANNEL=msedge the installed browser (Playwright's own Chromium will not start on every machine; Edge is signed)
//   ANGLE=d3d11|vulkan|gl   the ANGLE backend (Chromium's switch); W=1280 H=720; GAP_MS=100; SETTLE_S=20;
//   FLY_S=60 SPEED=2.5 DIR=x|z; CLOG=1 the GL read log; SHOT=1 a screenshot at each phase's end;
//   HEAP=<phase>   a sampling heap profile from that phase to the end; MW_PATH=<Morrowind Data Files> mounts them at
//                  /mwdata and MW=1 stores them in the page before the first phase.
// Read:  node tools/realGpu/profileAttr.mjs <phase>.cpuprofile [top] [filter]
//        node tools/realGpu/compileWaits.mjs <boot>.cpuprofile
//        node tools/realGpu/compareRuns.mjs <label>=<cold dir>[,<warm dir>] ...
//        node tools/realGpu/pngDiff.mjs a.png b.png [tolerance] / tools/realGpu/pngMask.mjs a.png b.png out.png
import { writeFileSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMain } from '../lib/isMain.mjs';
import { FIRST_FRAME_MARK } from '../bootFreezeProbe.mjs';

/** Profile nodes that are bookkeeping, not code: never a frame's inclusive cost. */
const GENERIC = new Set(['(root)', '(program)', '(idle)', '(garbage collector)']);

/** A frame gap over this many ms is a long frame and gets its attribution. */
export const DEFAULT_GAP_MS = 100;

/** Renderers whose numbers are not a GPU's: a run on one is no measurement. */
const SOFTWARE_RENDERER = /SwiftShader|WARP|Basic Render Driver|llvmpipe|softpipe/i;

/** The page's frame log: every rAF gap [end, ms], the JS heap each second, and the align marker the profile is read by. */
export const FRAME_LOG = `(() => {
  window.__realGpu = { gaps: [], heap: [] };
  let last = 0;
  const tick = (t) => {
    if (last) window.__realGpu.gaps.push([+t.toFixed(1), +(t - last).toFixed(1)]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setInterval(() => {
    const m = performance.memory;
    window.__realGpu.heap.push([+performance.now().toFixed(0), m ? Math.round(m.usedJSHeapSize / 1048576) : null]);
  }, 1000);
  window.__realGpuAlign = function __realGpuAlign() { const t = performance.now(); while (performance.now() - t < 3); return t; };
})();`;

/** CLOG=1: every WebGL2 read that can wait on the GPU process, timed; those over 15 ms logged with the JS frames that
 *  asked. A shader link waits in getProgramParameter (or the first getUniformLocation after it). */
export const COMPILE_LOG = `(() => {
  const P = WebGL2RenderingContext.prototype;
  const log = (window.__realGpuCompileLog = []);
  const frames = () => (new Error().stack || '').split('\\n').slice(3, 8)
    .map((l) => l.trim().replace(/^at /, '').replace(/\\(?https?:\\/\\/[^/]+\\/(src\\/)?/, '').replace(/\\?[^:]*/, '').replace(/\\)$/, ''));
  for (const name of ['getProgramParameter', 'getShaderParameter', 'getUniformLocation', 'getAttribLocation', 'getError', 'readPixels', 'finish']) {
    const original = P[name];
    P[name] = function (...args) {
      const t = performance.now();
      const answer = original.apply(this, args);
      const ms = performance.now() - t;
      if (ms > 15) log.push({ fn: name, ms: +ms.toFixed(1), at: +t.toFixed(0), by: frames() });
      return answer;
    };
  }
})();`;

/** The kind of main-thread time a profile node is. */
const kindOf = (functionName) => {
  if (functionName === '(idle)') return 'idle';
  if (functionName === '(program)') return 'program';
  if (functionName === '(garbage collector)') return 'gc';
  return 'script';
};

/** A node's name for the tables: its function, and its file and line under src/, tools/, vendor/ or node_modules/. */
export function nodeKey(node) {
  const frame = node.callFrame;
  const file = (frame.url || '').replace(/^.*?\/(src|tools|vendor|node_modules)\//, '$1/').replace(/\?.*$/, '');
  return file ? `${frame.functionName || '(anon)'} ${file}:${frame.lineNumber + 1}` : frame.functionName || '(anon)';
}

/** A phase's CPU profile read against its frame gaps. `alignNow` is the page's performance.now() when the align marker
 *  ran (null: a navigation reset the page clock and the marker after it is the one found). Answers whether the two
 *  clocks were aligned, the main thread's share by kind, the whole phase's attribution, and each gap over `gapMs`
 *  with the code that ran inside it.
 *  @param {{ nodes: any[], samples: number[], timeDeltas: number[], startTime: number }} profile
 *  @param {number|null} alignNow @param {Array<[number, number]>} gapsRaw [end, ms] @param {number} [gapMs] */
export function analysePhase(profile, alignNow, gapsRaw, gapMs = DEFAULT_GAP_MS) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const times = [];
  let t = profile.startTime;
  for (let i = 0; i < profile.samples.length; i++) {
    t += profile.timeDeltas[i] ?? 0;
    times.push(t / 1000);
  }
  let alignAt = null;
  for (let i = 0; i < profile.samples.length && alignAt === null; i++) {
    for (let c = profile.samples[i]; c != null; c = parent.get(c)) {
      if (byId.get(c).callFrame.functionName === '__realGpuAlign') {
        alignAt = times[i];
        break;
      }
    }
  }
  // profile ms = performance.now() + offset
  const offset = alignAt === null || alignNow == null ? null : alignAt - alignNow;
  const weight = (i) => Math.max(0, (times[i + 1] ?? times[i]) - times[i]);
  const attribute = (inWindow, top = 10) => {
    const inclusive = new Map();
    const self = new Map();
    const kinds = { script: 0, program: 0, gc: 0, idle: 0 };
    for (let i = 0; i < times.length; i++) {
      if (!inWindow(times[i])) continue;
      const w = weight(i);
      const node = byId.get(profile.samples[i]);
      const kind = kindOf(node.callFrame.functionName);
      kinds[kind] += w;
      if (kind === 'idle') continue;
      const own = nodeKey(node);
      self.set(own, (self.get(own) || 0) + w);
      const seen = new Set();
      for (let c = node.id; c != null; c = parent.get(c)) {
        const key = nodeKey(byId.get(c));
        if (GENERIC.has(key) || seen.has(key)) continue;
        seen.add(key);
        inclusive.set(key, (inclusive.get(key) || 0) + w);
      }
    }
    const rank = (m, k) =>
      [...m]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([f, v]) => [f, +v.toFixed(1)]);
    return {
      kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, +v.toFixed(1)])),
      inclusive: rank(inclusive, top),
      self: rank(self, 8),
    };
  };
  const whole = attribute(() => true, 40);
  const wall = Object.values(whole.kinds).reduce((a, b) => a + b, 0) || 1;
  const share = Object.fromEntries(Object.entries(whole.kinds).map(([k, v]) => [k, +((100 * v) / wall).toFixed(1)]));
  const hitches =
    offset === null
      ? []
      : gapsRaw
          .filter(([, ms]) => ms > gapMs)
          .map(([end, ms]) => ({ atNow: end, ms, ...attribute((x) => x >= end - ms + offset && x <= end + offset) }));
  return { aligned: offset !== null, share, whole, hitches };
}

/** The frame gaps' figures: p50/p95/p99/max and the frames over 50, 100 and 250 ms.
 *  @param {number[]} gaps */
export function frameFigures(gaps) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? null;
  const over = (ms) => gaps.filter((g) => g > ms);
  return {
    frames: gaps.length,
    frameMs: { p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: sorted.at(-1) ?? null },
    over50: over(50).length,
    over100: over(100).length,
    over250: over(250).length,
    sumOver50: +over(50)
      .reduce((s, g) => s + g, 0)
      .toFixed(0),
  };
}

/** A boot's own figures, the A/B's columns: when the first world frame came, the longest frame, the frames over 100 ms
 *  in the first `playS` seconds of play and their sum, and (CLOG=1) the time the main thread waited on the GPU process
 *  before and after the first world frame, by caller.
 *  @param {{ gapsRaw: Array<[number, number]>, firstFrame: number|null, compileLog?: Array<{ fn: string, ms: number, at: number, by: string[] }>|null }} raw */
export function bootFigures({ gapsRaw, firstFrame, compileLog = null }, playS = 25) {
  const longest = gapsRaw.reduce((a, g) => (g[1] > a[1] ? g : a), [0, 0]);
  const play =
    firstFrame == null
      ? []
      : gapsRaw.filter(([end, ms]) => end - ms >= firstFrame - 1 && end <= firstFrame + playS * 1000 && ms > 100);
  const figures = {
    firstFrameS: firstFrame == null ? null : +(firstFrame / 1000).toFixed(1),
    longestS: +(longest[1] / 1000).toFixed(2),
    over100Play: play.length,
    sumOver100PlayS: +(play.reduce((s, g) => s + g[1], 0) / 1000).toFixed(2),
  };
  if (!compileLog) return figures;
  const seconds = (entries) => +(entries.reduce((s, e) => s + e.ms, 0) / 1000).toFixed(2);
  const caller = (e) =>
    `${e.fn} < ${e.by
      .filter((f) => !/glProgram\.js|^_buildProgram|^buildProgram/.test(f))
      .slice(0, 2)
      .join(' < ')}`;
  const byCaller = new Map();
  for (const e of compileLog) byCaller.set(caller(e), (byCaller.get(caller(e)) || 0) + e.ms);
  return {
    ...figures,
    glWaitS: {
      total: seconds(compileLog),
      beforeFirstFrame: seconds(compileLog.filter((e) => firstFrame == null || e.at < firstFrame)),
      afterFirstFrame: seconds(compileLog.filter((e) => firstFrame != null && e.at >= firstFrame)),
    },
    byCaller: [...byCaller]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([k, v]) => [Math.round(v), k]),
  };
}

/** THE RUN JUDGES ITSELF. Answers what makes the run no measurement, or an empty list: a software renderer (its
 *  compiles and uploads are not a driver's), a phase that drew no frame (the window was covered or the GPU process
 *  lost), a boot whose profile could not be aligned to its frames (its long frames would be unattributed), a boot with
 *  no world frame, a page that threw.
 *  @param {{ backend: { renderer: string, parallelCompile: boolean } | null, phases: Record<string, { frames: number, aligned: boolean, firstFrameS?: number|null }>, errors: string[] }} run */
export function judgeRun({ backend, phases, errors }) {
  const problems = [];
  if (!backend) problems.push('no backend read: the page never answered which GPU it draws on');
  else if (SOFTWARE_RENDERER.test(backend.renderer))
    problems.push(`a software renderer (${backend.renderer}): these are not a GPU's numbers`);
  for (const [name, phase] of Object.entries(phases)) {
    if (!(phase.frames > 0)) problems.push(`${name}: no frame drawn (a covered window, or the GPU process gone)`);
    const isBoot = name === 'boot' || name === 'boot2';
    if (isBoot && !phase.aligned)
      problems.push(`${name}: the profile could not be aligned to the frames - its long frames are unattributed`);
    if (isBoot && phase.firstFrameS == null) problems.push(`${name}: no world frame`);
  }
  if (errors.length) problems.push(`the page threw ${errors.length} time(s): ${errors[0]}`);
  return problems;
}

/** [pid, working set MB] of every running msedge.exe (Windows tasklist; elsewhere none). */
function edgeMemory() {
  try {
    const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq msedge.exe'], { encoding: 'utf8' });
    return out
      .trim()
      .split(/\r?\n/)
      .map((l) => l.split('","'))
      .filter((c) => c.length > 4)
      .map((c) => [Number(c[1]), Number(c[4].replace(/[^0-9]/g, '')) / 1024]);
  } catch {
    return [];
  }
}

/** MW_PATH: the retail Morrowind "Data Files" served at /mwdata/* (a dev-server mount; nothing ships it). */
const mwMount = (dir) => ({
  name: 'real-gpu-mw-mount',
  configureServer(server) {
    server.middlewares.use('/mwdata', (req, res, next) => {
      const name = decodeURIComponent(req.url.slice(1).split('?')[0]);
      if (!/^[A-Za-z0-9._ -]+$/.test(name)) return next();
      const path = join(dir, name);
      if (statSync(path, { throwIfNoEntry: false })?.isFile() !== true) {
        res.statusCode = 404;
        return res.end('not found');
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      createReadStream(path).pipe(res);
    });
  },
});

async function main() {
  const { chromium } = await import('playwright');
  const { SCENES } = await import('../frameProbe.mjs');
  const env = process.env;
  const root = resolve(env.TREE || fileURLToPath(new URL('../..', import.meta.url)));
  const out = resolve(env.OUT || join(tmpdir(), 'realGpuProbe', new Date().toISOString().replace(/[:.]/g, '-')));
  const port = Number(env.PORT || 5261);
  const gapMs = Number(env.GAP_MS || DEFAULT_GAP_MS);
  const width = Number(env.W || 1280);
  const height = Number(env.H || 720);
  const phases = (env.PHASES || 'boot,settled,out,back').split(',');
  const flies = phases.some((p) => p === 'out' || p === 'back');
  const sceneName = process.argv[2] ?? '';
  const sceneUrl = SCENES[sceneName] ?? sceneName;
  // before a server or a browser stands: a bare run starts nothing on a machine whose GPU may be busy
  if (!sceneUrl.startsWith('/'))
    throw new Error(`realGpuProbe: name the scene - one of ${Object.keys(SCENES).join(', ')} - or a /play/ URL`);
  const url = flies ? sceneUrl.replace('&play', '&fly') : sceneUrl;
  mkdirSync(out, { recursive: true });

  let server = null;
  let base = env.BASE;
  if (!base) {
    const { createServer } = await import('vite');
    server = await createServer({
      root,
      configFile: join(root, 'vite.config.js'),
      cacheDir: join(tmpdir(), 'realGpuProbe', 'vite-cache'),
      plugins: env.MW_PATH ? [mwMount(env.MW_PATH)] : [],
      server: { port, strictPort: true, hmr: false, watch: null },
      logLevel: 'error',
    });
    await server.listen();
    base = `http://localhost:${port}`;
  }
  const edgeBefore = new Set(edgeMemory().map(([pid]) => pid));
  const args = [
    `--window-size=${width},${height + 100}`,
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--enable-precise-memory-info',
    ...(env.ANGLE ? ['--use-gl=angle', `--use-angle=${env.ANGLE}`] : []),
  ];
  const launch = { channel: env.CHANNEL || 'msedge', headless: false, args };
  const context = env.PROFILE_DIR
    ? await chromium.launchPersistentContext(resolve(env.PROFILE_DIR), { ...launch, viewport: { width, height } })
    : await (await chromium.launch(launch)).newContext({ viewport: { width, height } });
  const run = { scene: url, backend: null, phases: {}, errors: [] };
  try {
    await context.addInitScript(FIRST_FRAME_MARK);
    await context.addInitScript(FRAME_LOG);
    if (env.CLOG) await context.addInitScript(COMPILE_LOG);
    const page = context.pages()[0] ?? (await context.newPage());
    page.on('dialog', (d) => d.accept()); // the game's leave-page guard, after an idle reload
    page.on('pageerror', (e) => run.errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });

    const waitIdle = async (frames, maxS) => {
      const end = Date.now() + maxS * 1000;
      let idleFrom = null;
      for (;;) {
        const s = await page.evaluate(() => ({
          f: window.__frame | 0,
          idle: typeof window.__streamIdle === 'function' ? window.__streamIdle() : true,
        }));
        if (!s.idle) idleFrom = null;
        else idleFrom ??= s.f;
        if ((idleFrom !== null && s.f - idleFrom >= frames) || Date.now() > end) return;
        await new Promise((r) => setTimeout(r, 500));
      }
    };
    const boot = async () => {
      await page.goto(`${base}${url}`, { timeout: 300000 }); // a fresh server optimises its dependencies first
      await page.waitForFunction(() => (window.__frame | 0) > 0, null, { timeout: 900000, polling: 250 });
      await waitIdle(30, 300);
      return true;
    };
    const fly = (sign) => async () => {
      const steps = (Number(env.FLY_S || 60) * 1000) / 50;
      for (let i = 0; i < steps; i++) {
        await page.evaluate(
          ([d, dir]) => (dir === 'x' ? window.__move(d, 0, 0) : window.__move(0, 0, d)),
          [sign * Number(env.SPEED || 2.5), env.DIR || 'x'],
        );
        await new Promise((r) => setTimeout(r, 50));
      }
      await waitIdle(30, 120);
    };
    const walk = async () => {
      const steps = (Number(env.FLY_S || 60) * 1000) / 250;
      for (let i = 0; i < steps; i++) {
        await page.evaluate(
          ([d, dir]) => {
            const c = window.__cam();
            if (dir === 'x') window.__pose(c[0] + d, c[1] - 1.0, c[2], 0, 0);
            else window.__pose(c[0], c[1] - 1.0, c[2] + d, 0, 0);
          },
          [Number(env.SPEED || 2.5), env.DIR || 'x'],
        );
        await new Promise((r) => setTimeout(r, 250));
      }
    };
    const settle = async () => {
      await new Promise((r) => setTimeout(r, Number(env.SETTLE_S || 20) * 1000));
    };
    const bodies = { boot, boot2: boot, settled: settle, out: fly(1), back: fly(-1), walk };

    if (env.MW) {
      await page.goto(`${base}/play/index.html`, { timeout: 300000 });
      const kept = await page.evaluate(async () => {
        const { storeMorrowindFiles } = await import('/src/scenes/dataSource.js');
        const files = [];
        for (const n of [
          'Morrowind.esm',
          'Tribunal.esm',
          'Bloodmoon.esm',
          'Morrowind.bsa',
          'Tribunal.bsa',
          'Bloodmoon.bsa',
        ]) {
          const r = await fetch(`/mwdata/${n}`);
          if (r.ok) files.push(new File([await r.blob()], n));
        }
        return storeMorrowindFiles(files);
      });
      console.log('morrowind files stored', kept);
    }
    for (const name of phases) {
      const body = bodies[name];
      if (!body) throw new Error(`realGpuProbe: no phase ${name} (${Object.keys(bodies).join(', ')})`);
      if (env.HEAP === name) {
        await cdp.send('HeapProfiler.enable');
        await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768 });
      }
      await cdp.send('Profiler.start');
      let alignNow = await page.evaluate(() => window.__realGpuAlign?.() ?? null).catch(() => null);
      const t0 = alignNow ?? 0;
      const navigated = await body();
      if (navigated) alignNow = await page.evaluate(() => window.__realGpuAlign()); // the navigation reset the page's clock
      const t1 = await page.evaluate(() => performance.now());
      const { profile } = await cdp.send('Profiler.stop');
      writeFileSync(join(out, `${name}.cpuprofile`), JSON.stringify(profile));
      const gapsRaw = (await page.evaluate(() => window.__realGpu.gaps.slice())).filter(
        ([end]) => navigated || (end >= t0 && end <= t1),
      );
      const firstFrame = navigated ? await page.evaluate(() => window.__bootFreezeFrames?.[0] ?? null) : null;
      const compileLog = env.CLOG ? await page.evaluate(() => window.__realGpuCompileLog?.slice() ?? null) : null;
      const phase = {
        name,
        seconds: +((t1 - (navigated ? 0 : t0)) / 1000).toFixed(1),
        ...frameFigures(gapsRaw.map(([, ms]) => ms)),
        ...analysePhase(profile, alignNow, gapsRaw, gapMs),
        ...(navigated ? bootFigures({ gapsRaw, firstFrame, compileLog }) : {}),
      };
      writeFileSync(join(out, `${name}.json`), JSON.stringify({ ...phase, gapsRaw, compileLog }, null, 1));
      const { whole, hitches, ...line } = phase;
      run.phases[name] = { ...line, hitches: hitches.length };
      console.log(name, JSON.stringify(run.phases[name]));
      if (env.SHOT) await page.screenshot({ path: join(out, `${name}.png`) });
      if (navigated && !run.backend) {
        run.backend = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2');
          const info = gl?.getExtension('WEBGL_debug_renderer_info');
          return gl
            ? {
                renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                parallelCompile: !!gl.getExtension('KHR_parallel_shader_compile'),
              }
            : null;
        });
        console.log('  backend', JSON.stringify(run.backend));
      }
    }
    if (env.HEAP) {
      const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
      await cdp.send('HeapProfiler.stopSampling');
      writeFileSync(join(out, 'heap-sampling.json'), JSON.stringify(profile));
    }
    const mine = edgeMemory()
      .filter(([pid]) => !edgeBefore.has(pid))
      .sort((a, b) => b[1] - a[1]);
    run.edgeMB = mine.map(([, mb]) => Math.round(mb));
    console.log('edge processes (MB working set)', JSON.stringify(run.edgeMB));
  } finally {
    await context.close();
    await context
      .browser()
      ?.close()
      .catch(() => {});
    if (server) await server.close();
  }
  const problems = judgeRun(run);
  writeFileSync(join(out, 'summary.json'), JSON.stringify({ ...run, problems }, null, 1));
  console.log(`runs in ${out}`);
  if (problems.length) {
    console.error(`realGpuProbe: NO MEASUREMENT\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) await main();
