// BOOT-FREEZE (2026-10-20, the owner: "do your own performance pass ... install the freeware and go deep"): THE BOOT'S
// FREEZES, MEASURED IN THE REAL GAME. tools/frameProbe.mjs reads a frame of a scene that stands settled; a player's
// complaint since HOLY-DAYS and TRIP-PICKS (bible/07-Rendering/Performance-Priority.md) is the other half - the frames
// that freeze while the world comes in. This boots a scene over the freeware ARENA2 under one CPU profile, from the page's
// first byte until the stream stands idle FRAMES frames after the first world frame (or MAX_S seconds), and reads the
// main thread's LONG TASKS off the profile itself: a task is a run of samples that are not `(idle)`, closed by a gap of
// IDLE_GAP_MS, and each is attributed by its samples' stacks (inclusive, every function once a sample; and self). The
// first world frame is marked IN the profile: the page's `__frame` turning from 0 calls `__bootFreezeFirstFrame`, whose
// samples give its time on the profile's own clock (performance.now() and the profile's clock are not one base) - the
// frame #854's player froze on (TRIP-PICKS). Not `__shotReady`: the world's is the whole stream built, which at the real
// slice under SwiftShader is hours, and is not the moment a player waits on.
// The real stream's slices (no probe transforms), so the frames after the first are the frames a player waits through.
// SwiftShader draws the frames: a task that holds GL work is slower here than on a GPU, and `(program)` is where its
// native time lands - the script's own functions are what this probe ranks. The figures are this machine's CPU, read
// as relative: an A/B runs its arms one after the other with nothing else running (AUDIT 637 D3).
//
// Run:  ARENA2_PATH=/path/to/arena2 node tools/bootFreezeProbe.mjs knight
//   scenes: tools/frameProbe.mjs SCENES;  TREE=<dir> serve another worktree (an A/B's base);  TAG=<name> the run's name
//   OUT=<dir> (default: the OS temp dir's bootFreeze/);  FRAMES=20 frames past the first with the stream idle;
//   MAX_S=600 seconds after the first frame at most;  MIN_TASK_MS=50;  IDLE_GAP_MS=4;  TOP=12 functions listed a task;
//   PORT=5243;  W=480 H=270
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain } from './lib/isMain.mjs';
import { SCENES, SWIFTSHADER_ARGS } from './frameProbe.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.OUT || join(tmpdir(), 'bootFreeze');
const PORT = Number(process.env.PORT || 5243);
const FRAMES = Number(process.env.FRAMES || 20);
const MAX_S = Number(process.env.MAX_S || 600);
const MIN_TASK_MS = Number(process.env.MIN_TASK_MS || 50);
const IDLE_GAP_MS = Number(process.env.IDLE_GAP_MS || 4);
const TOP = Number(process.env.TOP || 12);
const W = Number(process.env.W || 480), H = Number(process.env.H || 270);

/** The first world frame's mark: `__frame` turning from 0 calls a function the profile can name, held 3 ms so a sample
 *  lands in it; and each frame's performance.now() kept (the page's own clock), so the frames' lengths are read too. */
export const FIRST_FRAME_MARK = `(() => {
  let f;
  const at = window.__bootFreezeFrames = [];
  function __bootFreezeFirstFrame() { const t = performance.now(); while (performance.now() - t < 3); }
  Object.defineProperty(window, '__frame', { configurable: true, get: () => f,
    set: (x) => { if (!(f > 0) && x > 0) __bootFreezeFirstFrame(); if (x > 0) at.push(performance.now()); f = x; } });
})();`;

/** Not the script's own: the profile's bookkeeping frames. */
const GENERIC = new Set(['(root)', '(program)', '(idle)', '(garbage collector)']);

/** The main thread's long tasks and where their time went, off a CPU profile. Pure: the suite can hand it a profile.
 *  @param {{ nodes: any[], samples: number[], timeDeltas: number[], startTime: number }} profile */
export function longTasks(profile, { minTaskMs = MIN_TASK_MS, idleGapMs = IDLE_GAP_MS, top = TOP } = {}) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const keyOf = (n) => { const cf = n.callFrame; const f = (cf.url || '').replace(/^.*?\/(src|tools|vendor|node_modules)\//, '$1/').replace(/\?.*$/, ''); return f ? `${cf.functionName || '(anon)'} ${f}:${cf.lineNumber + 1}` : (cf.functionName || '(anon)'); };
  const ts = [];
  let t = profile.startTime;
  for (let i = 0; i < profile.samples.length; i++) { t += profile.timeDeltas[i] ?? 0; ts.push(t); }
  const dt = (i) => Math.max(0, ((ts[i + 1] ?? ts[i]) - ts[i]) / 1000);   // ms this sample stands for
  let firstAt = null;
  const tasks = [];
  let cur = null;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    const fn = n.callFrame.functionName;
    if (firstAt === null) for (let c = n.id; c != null; c = parent.get(c)) if (byId.get(c).callFrame.functionName === '__bootFreezeFirstFrame') { firstAt = ts[i]; break; }
    if (fn === '(idle)') continue;
    if (!cur || (ts[i] - cur.end) / 1000 > idleGapMs) { cur = { start: ts[i], end: ts[i], idx: [] }; tasks.push(cur); }
    cur.end = ts[i] + dt(i) * 1000;
    cur.idx.push(i);
  }
  const t0 = profile.startTime;
  const attribute = (idx) => {
    const incl = new Map(), self = new Map();
    let ms = 0;
    for (const i of idx) {
      const w = dt(i);
      ms += w;
      const n = byId.get(profile.samples[i]);
      const sk = keyOf(n);
      self.set(sk, (self.get(sk) || 0) + w);
      const seen = new Set();
      for (let c = n.id; c != null; c = parent.get(c)) {
        const k = keyOf(byId.get(c));
        if (GENERIC.has(k) || seen.has(k)) continue;
        seen.add(k);
        incl.set(k, (incl.get(k) || 0) + w);
      }
    }
    const rank = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => [k, +v.toFixed(1)]);
    return { busyMs: +ms.toFixed(1), inclusive: rank(incl), self: rank(self) };
  };
  const long = tasks.filter((k) => (k.end - k.start) / 1000 >= minTaskMs).map((k) => ({
    atMs: +((k.start - t0) / 1000).toFixed(0),
    fromFirstMs: firstAt === null ? null : +((k.start - firstAt) / 1000).toFixed(0),
    ms: +((k.end - k.start) / 1000).toFixed(1),
    ...attribute(k.idx),
  }));
  const phase = (pred) => attribute(profile.samples.map((_, i) => i).filter((i) => byId.get(profile.samples[i]).callFrame.functionName !== '(idle)' && pred(ts[i])));
  return {
    firstFrameAtMs: firstAt === null ? null : +((firstAt - t0) / 1000).toFixed(0),
    long,
    boot: phase((x) => firstAt === null || x < firstAt),
    afterFirst: firstAt === null ? null : phase((x) => x >= firstAt),
    frozenAfterFirstMs: firstAt === null ? null : +long.filter((k) => k.fromFirstMs >= 0).reduce((s, k) => s + k.ms, 0).toFixed(0),
  };
}

async function runScene(browser, name) {
  const url = SCENES[name] + (process.env.EXTRA || '');
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(FIRST_FRAME_MARK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}${url}`);
  await page.waitForFunction(() => (window.__frame | 0) > 0, null, { timeout: 1200000, polling: 250 });
  const bootS = (Date.now() - t0) / 1000;
  console.log(`  [${name}] first world frame after ${bootS.toFixed(0)}s`);
  // until the stream stands idle FRAMES frames running, or MAX_S
  const t1 = Date.now();
  let idleFrom = null, last = -1;
  for (;;) {
    const s = await page.evaluate(() => ({ f: window.__frame | 0, idle: typeof window.__streamIdle === 'function' ? window.__streamIdle() : true }));
    if (s.f !== last && (s.f % 10 === 0 || !idleFrom)) console.log(`  [${name}] +${((Date.now() - t1) / 1000).toFixed(0)}s frame ${s.f}${s.idle ? ' (stream idle)' : ''}`);
    last = s.f;
    if (!s.idle) idleFrom = null; else idleFrom ??= s.f;
    if ((idleFrom !== null && s.f - idleFrom >= FRAMES) || Date.now() - t1 > MAX_S * 1000) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const frameTimes = await page.evaluate(() => window.__bootFreezeFrames.slice());
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.detach().catch(() => {});
  await ctx.close();
  mkdirSync(OUT, { recursive: true });
  const tag = name + (process.env.TAG ? '.' + process.env.TAG : '');
  writeFileSync(`${OUT}/${tag}.cpuprofile`, JSON.stringify(profile));
  const gaps = frameTimes.slice(1).map((t, i) => +(t - frameTimes[i]).toFixed(1));
  const r = { name, url, bootS, frames: frameTimes.length, frameGapsMs: gaps, errors: errors.slice(0, 20), ...longTasks(profile) };
  writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(r, null, 1));
  return r;
}

if (isMain(import.meta.url)) {
  const names = process.argv.slice(2);
  if (!names.length || names.some((n) => !SCENES[n])) throw new Error(`bootFreezeProbe: name one or more scenes of ${Object.keys(SCENES).join(', ')}`);
  const server = await createServer({ root: ROOT, configFile: `${ROOT}/vite.config.js`, server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ args: SWIFTSHADER_ARGS });
  const failed = [];
  try {
    for (const name of names) {
      const r = await runScene(browser, name);
      console.log(`== ${name}: first frame at ${r.firstFrameAtMs} ms of the profile, ${r.frames} frames, frozen after it ${r.frozenAfterFirstMs} ms in ${r.long.filter((k) => k.fromFirstMs >= 0).length} long tasks, errors ${r.errors.length}`);
      for (const k of r.long) {
        console.log(`  task at ${k.atMs} ms (${k.fromFirstMs ?? '?'} from the first frame): ${k.ms} ms, busy ${k.busyMs}`);
        for (const [f, ms] of k.inclusive.slice(0, TOP)) console.log(`      ${String(ms).padStart(8)}  ${f}`);
      }
      // a run is a measurement when the first world frame stands in its profile and the page threw nothing
      const why = r.firstFrameAtMs === null ? 'the first world frame is not in the profile' : r.errors[0] ?? null;
      if (why) failed.push(`${name} (${why})`);
    }
  } finally { await browser.close(); await server.close(); }
  if (failed.length) throw new Error(`bootFreezeProbe: no measurement for ${failed.join('; ')}`);
}
