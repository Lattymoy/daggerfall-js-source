// OW-STREAM (2026-10-26, the owner: "the overworld experiences hitching"; bible/07-Rendering/Performance-Priority.md
// OW-STREAM): THE OVERWORLD'S FRAMES ON A FIXED ROUTE, BY THEIR LENGTH.
//
// OW-HITCH (2026-10-21) profiled one journey from a driver in a session's scratch; nothing in the tree could make its
// figures again. This is that journey as a tool: the world host boots at Knightstale (Wayrest) at 15:00 with no foes, the
// stream settles, the opening windows are put away, the Overworld is raised and W held - the keys' travel at the road's or
// the open ground's rate (TV-WASD) - for SECONDS of real time, and every frame is timed in the page:
//   - `cb`: the frame callback's own time (requestAnimationFrame wrapped before the page's scripts run) - the host's frame;
//   - `gap`: the time from one frame's start to the next - the frame a player waits through, everything the main thread
//     ran between two frames included (a worker's answer handled, an idle callback, the collector);
// and the long tasks the browser saw (PerformanceObserver 'longtask', over 50 ms) beside them. With DRAWS=off (the
// default) the frame's draws are stubbed as tools/pixelBuildSweep.mjs's journey stubs them: SwiftShader's raster is the
// container's CPU and no GPU's, so what is left is the main thread's own work - the hitches a player's machine meets
// whatever its GPU. Uploads (texImage, bufferData) still run.
//
// Run:  ARENA2_PATH=/home/claude/dfdata/arena2 node tools/owHitchProbe.mjs
//   SECONDS=60       the journey's real seconds after the Overworld rises
//   WALK=1           no Overworld: W held on foot (the exterior's own streaming at a walk) - the same route
//   TREE=<dir>       serve another worktree of this repository (its node_modules linked) - an A/B's base
//   OUT=<file>       append the run's row (and its frame lists) as one JSON line
//   LAND=<the streamed radius>  HEAP_MB=<the page's old space>  PORT=5182  W=320 H=180  DRAWS=on (rasterise too)  QUERY=<more of the page's query>  CHROMIUM=<a browser other than the
//   pinned Playwright's>
//   IC=<bearing>,<metres>,<yaw>   IC-STUTTER (2026-10-27, the owner: "Traveling in the Imperial City at x60 presents really
//                    bad stuttering"; bible/03-World/Arena-Provinces.md IC-STUTTER): the journey in the Imperial City - after
//                    the boot the jump to the city's slice at that point of its own metres (bearing degrees clockwise from
//                    north, metres out from its middle: `90,6600,270` the Arena District's avenue by the city wall, facing
//                    the tower), the stream let go idle, the body stood on the point facing `yaw` (degrees clockwise from
//                    north) - then the Overworld and W as ever, at the city's own pace (IC-PACE, x60)
//   AT=<px>,<py>[,<yaw>]  the journey from a world pixel (TAMRIEL-WIDE: a province's, past the Bay) - after the boot the jump
//                    there as a fast travel lands, the stream let go idle, the body turned to `yaw` (degrees clockwise from
//                    north) - then the Overworld and W as ever
//   FOES=1           the wild's foes sense the traveller (by default the player is unseen, so no band brings the view down)
//   TURN=<s>         turn about every s real seconds (IC: back along the avenue, so the run stays in the city)
//   PROFILE=<file>   Chrome's sampler over the journey (CDP, 1 ms between samples) written as a .cpuprofile - its long
//                    frames' functions read with a summariser of self time
// The figures are this machine's CPU, shared, and only relative: run an A/B's arms one after the other, nothing else
// beside them, and compare like with like.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(join(A2, 'MAPS.BSA')))
  throw new Error('owHitchProbe: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)');
const PORT = Number(process.env.PORT || 5182);
const SECONDS = Number(process.env.SECONDS || 60);
const W = Number(process.env.W || 320),
  H = Number(process.env.H || 180);
const WALK = process.env.WALK === '1';
const DRAWS = process.env.DRAWS === 'on';
const QUERY = `world&region=Wayrest&loc=Knightstale&class=1&novideo&shot&play&fps&tod=15:00&nofoes&skin=enhanced&touch=off${process.env.QUERY ? `&${process.env.QUERY}` : ''}`;

/** The frame lists' figures: p50, p95, the worst, and how many frames ran past 33 ms (two of a 60 Hz display's beats). */
function frameFigures(ms) {
  const s = [...ms].sort((a, b) => a - b),
    q = (p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN);
  return {
    frames: s.length,
    p50: q(0.5),
    p95: q(0.95),
    max: s.length ? s[s.length - 1] : NaN,
    over33: s.filter((x) => x > 33).length,
    over100: s.filter((x) => x > 100).length,
  };
}

const server = await createServer({
  root: ROOT,
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    ...(process.env.HEAP_MB ? [`--js-flags=--max-old-space-size=${process.env.HEAP_MB}`] : []),
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
  ],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
page.on('crash', () => {
  console.error('the page crashed (a renderer killed - out of memory on a shared box?): no measurement');
  process.exit(3);
});
page.on('console', (m) => {
  const t = m.text();
  if (/^pixel -?\d+,-?\d+ failed:/.test(t)) errors.push(t.slice(0, 300));
});
// LAND=<n>: the streamed radius (the Land View pref), for a shared machine's memory - both arms of an A/B the same.
// The tutorial popups off: a new character's pages open one after another, each pausing the game, and a pause brings the
// Overworld down - the journey was walked on foot and measured nothing
await page.addInitScript(
  (land) => {
    try {
      const k = 'dagger.ui.v1',
        p = JSON.parse(localStorage.getItem(k) ?? '{}');
      localStorage.setItem(
        k,
        JSON.stringify({ ...p, tutorialPopups: false, ...(land ? { landViewDistance: land } : {}) }),
      );
    } catch {
      /* the default */
    }
  },
  Number(process.env.LAND || 0),
);
await page.addInitScript((stub) => {
  // the draws stubbed from the first frame (the boot's own frames are SwiftShader's raster otherwise: a quarter of an hour)
  if (stub && typeof WebGL2RenderingContext !== 'undefined') {
    for (const f of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
      'drawRangeElements',
      'clear',
      'blitFramebuffer',
    ])
      WebGL2RenderingContext.prototype[f] = function () {};
  }
  const raf = window.requestAnimationFrame.bind(window);
  const log = { on: false, cb: [], start: [], long: [] };
  window.__owLog = log;
  window.requestAnimationFrame = (fn) =>
    raf((t) => {
      const a = performance.now();
      try {
        fn(t);
      } finally {
        if (log.on) {
          log.start.push(a);
          log.cb.push(performance.now() - a);
        }
      }
    });
  try {
    new PerformanceObserver((l) => {
      if (log.on) for (const e of l.getEntries()) log.long.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    /* no long tasks here */
  }
}, !DRAWS);
const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/play/?${QUERY}`);
await page.waitForFunction(() => window.__shotReady === true && !!window.__journeyState, null, {
  timeout: 1800000,
  polling: 2000,
});
const frameAt = () => page.evaluate(() => window.__frame);
const frames = async (n) => {
  const f0 = await frameAt();
  await page.waitForFunction((f) => window.__frame >= f, f0 + n, { timeout: 600000, polling: 200 });
};
await frames(30);
// IC=: the jump into the Imperial City (its centre pixel stands once the land past the Bay has landed - polled a frame at a
// time), the stream idle, then the body on the avenue's point facing the way it walks
const IC = process.env.IC ? process.env.IC.split(',').map(Number) : null;
if (IC) {
  console.log(
    `booted in ${Math.round((Date.now() - t0) / 1000)} s, heap ${await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576))} MB`,
  );
  let at = null;
  for (let i = 0; i < 3000 && !at; i++) {
    at = await page.evaluate(async () => (await import('/src/world/tamrielCapitals.js')).capitalCentrePixel(0));
    if (!at) await frames(1);
  }
  if (!at) throw new Error('owHitchProbe: the Imperial City never stood (no centre pixel)');
  const [b, r, yaw] = IC;
  const jump = await page.evaluate(
    async ([b, r, at]) => {
      const ic = await import('/src/world/imperialCity.js'),
        B = 102.4,
        HALF = ic.IMPERIAL_CELLS / 2,
        N = ic.IMPERIAL_SPAN,
        [x, z] = ic.polar(b, r);
      return [
        at.px - (N - 1) / 2 + Math.floor((x + HALF * B) / (8 * B)),
        at.py - (N - 1) / 2 + Math.floor((z + HALF * B) / (8 * B)),
        x,
        z,
      ];
    },
    [b, r, at],
  );
  const tj = Date.now();
  await page.evaluate(([x, y]) => {
    window.__tesaJump(x, y);
  }, jump);
  await frames(2);
  await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000, polling: 1000 });
  await frames(10);
  // the scene's frame: the jump's pixel's south-west corner its origin, the city's middle the centre pixel's (x east, z north;
  // the city's own z runs south)
  const [cx, cy] = (await page.evaluate(() => window.__currentPixel())).split(',').map(Number);
  const y0 = (await page.evaluate(() => window.__cam()))[1];
  const sx = (at.px - cx) * 819.2 + 409.6 + jump[2],
    sz = -(at.py - cy) * 819.2 + 409.6 - jump[3];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, 0), [sx, y0 + 1, sz, (yaw * Math.PI) / 180]);
  await frames(10);
  console.log(
    `the Imperial City: centre ${at.px},${at.py}, jumped to ${jump[0]},${jump[1]} in ${Math.round((Date.now() - tj) / 1000)} s, stood at ${b} degrees ${r} m facing ${yaw}`,
  );
}
// foes calm (FOES=1 keeps them): `&nofoes` empties a dungeon, not the wild - a band that notices the traveller brings the
// view down (its `danger`) and the journey was measured on foot. The player held unseen as a hidden staff member is
// (STAFF-UNSEEN: no foe senses them, the Overworld stays up), pinned against the staff host's own write each frame
if (process.env.FOES !== '1')
  await page.evaluate(() => {
    Object.defineProperty(window.__playerEntity, 'staffHidden', { get: () => true, set() {}, configurable: true });
  });
const AT = process.env.AT && !IC ? process.env.AT.split(',').map(Number) : null;
if (AT) {
  const tj = Date.now();
  await page.evaluate(([x, y]) => {
    window.__tesaJump(x, y);
  }, AT);
  await frames(2);
  await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000, polling: 1000 });
  await frames(10);
  if (AT.length > 2) await page.evaluate((yaw) => window.__look((yaw * Math.PI) / 180, 0), AT[2]);
  console.log(
    `jumped to ${await page.evaluate(() => window.__currentPixel())} in ${Math.round((Date.now() - tj) / 1000)} s`,
  );
}
let view = null,
  rise = null;
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => window.__arenaCloseOverlays?.());
  if (WALK) {
    view = 'walk';
    break;
  }
  rise = await page.evaluate(() => window.__overworld());
  await frames(10);
  view = await page.evaluate(() => window.__journeyState().view);
  if (view === 'up') break;
}
if (!WALK && view !== 'up')
  throw new Error(`owHitchProbe: the Overworld did not rise (${view}: ${JSON.stringify(rise)})`);
const boot = Math.round((Date.now() - t0) / 1000);
const before = await page.evaluate(() => window.__journeyState());
const cdp = process.env.PROFILE ? await page.context().newCDPSession(page) : null;
if (cdp) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
}
await page.evaluate(() => {
  window.__owLog.on = true;
});
await page.keyboard.down('KeyW');
const samples = [];
const TURN = Number(process.env.TURN || 0);
let turnAt = TURN ? Date.now() + TURN * 1000 : Infinity,
  heading = IC ? IC[2] : (AT?.[2] ?? 0);
for (const until = Date.now() + SECONDS * 1000; Date.now() < until;) {
  await frames(15);
  samples.push(
    await page.evaluate(() => ({
      ...window.__journeyState(),
      heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576),
      t: performance.now(),
    })),
  );
  // a band that noticed the traveller brings the view down (its `danger`): raised again once it allows, the samples counting the frames it was down
  if (!WALK && samples.at(-1).view === 'off') await page.evaluate(() => window.__overworld());
  if (Date.now() >= turnAt) {
    turnAt += TURN * 1000;
    heading += 180;
    await page.evaluate((y) => window.__look((y * Math.PI) / 180, 0), heading);
  }
}
await page.keyboard.up('KeyW');
if (cdp) {
  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(process.env.PROFILE, JSON.stringify(profile));
}
const log = await page.evaluate(() => {
  window.__owLog.on = false;
  return window.__owLog;
});
const gaps = log.start.slice(1).map((s, i) => s - log.start[i]);
const after = samples.at(-1) ?? before;
const row = {
  at: new Date().toISOString(),
  tree: ROOT,
  walk: WALK,
  draws: DRAWS,
  seconds: SECONDS,
  boot,
  moved: Math.max(Math.abs(after.pixel.x - before.pixel.x), Math.abs(after.pixel.y - before.pixel.y)),
  built: after.built,
  heapMB: Math.max(...samples.map((s) => s.heapMB)),
  atX1: samples.filter((s) => s.scale === 1).length,
  down: samples.filter((s) => s.view !== 'up').length,
  samples: samples.length,
  cb: frameFigures(log.cb),
  gap: frameFigures(gaps),
  long: frameFigures(log.long.map((l) => l[1])),
  errors: errors.length,
};
const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const line = (k, v) =>
  `${k.padEnd(4)} ${String(v.frames).padStart(5)} frames  p50 ${f(v.p50).padStart(6)}  p95 ${f(v.p95).padStart(6)}  max ${f(v.max).padStart(7)} ms  >33 ms ${v.over33}  >100 ms ${v.over100}`;
console.log(
  `${WALK ? 'walk' : 'overworld'}: ${row.moved} pixels on in ${SECONDS} s, ${row.built} built, heap ${row.heapMB} MB at most, boot ${boot} s, ${row.atX1} of ${row.samples} samples at x1, ${WALK ? '' : `${row.down} with the view down, `}${errors.length} error(s)`,
);
console.log(line('cb', row.cb));
console.log(line('gap', row.gap));
console.log(`long ${row.long.frames} task(s) over 50 ms, the worst ${f(row.long.max)} ms`);
if (process.env.OUT)
  appendFileSync(
    process.env.OUT,
    JSON.stringify({ ...row, lists: { cb: log.cb, gap: gaps, long: log.long, start: log.start } }) + '\n',
  );
await browser.close();
await server.close();
if (errors.length) throw new Error(`owHitchProbe: ${errors.length} page error(s): ${errors.slice(0, 3).join(' | ')}`);
if (!WALK && row.down > row.samples / 2)
  throw new Error(
    `owHitchProbe: the Overworld was down for ${row.down} of ${row.samples} samples - a window or a foe brought it down`,
  );
if (row.cb.frames < 30 || !(row.moved > 0))
  throw new Error(`owHitchProbe: no journey measured (${row.cb.frames} frames, ${row.moved} pixels on)`);
