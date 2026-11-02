// PERF-CROWD (2026-10-10, Dudey: "keep the tests short cause those seem to take loooooooooong"): THE FRAME PROBE, SHORT.
// tools/frameProbe.mjs boots at the player's default land view (11 x 11 map pixels) and settles the grass - a quarter of
// an hour a scene on SwiftShader before a frame is measured. This boots the same scene with the land view at RADIUS
// (default 2: 5 x 5 pixels) through the player's own pref, waits for the shot to be ready and N_SETTLE frames, and takes
// the frame probe's own CPU profile and heap windows (tools/frameProbe.mjs measure) over FRAMES frames. Its numbers are
// a smaller world's - read them as an A/B of two trees (TREE=) over the same scene, never against frameProbe's.
//
//   node tools/quickProbe.mjs knight [snow ...]      scenes: frameProbe's, and `snow` (Knightstale in winter, snowing)
//   TREE=<dir> TAG=<name> OUT=<dir> FRAMES=24 RADIUS=2 N_SETTLE=20 W=320 H=180 PORT=5251
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { SCENES, probeTransforms, waitFrames, measure, summaryLine, CENSUS, SWIFTSHADER_ARGS } from './frameProbe.mjs';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 5251);
const RADIUS = Number(process.env.RADIUS || 2);
const N_SETTLE = Number(process.env.N_SETTLE || 20);
const W = Number(process.env.W || 320),
  H = Number(process.env.H || 180);
const ALL = {
  ...SCENES,
  snow: '/play/?world&region=Wayrest&loc=Knightstale&class=1&novideo&shot&play&fps&tod=13:00&season=winter&weather=snow',
};

const names = process.argv.slice(2);
if (!names.length || names.some((n) => !ALL[n]))
  throw new Error(`quickProbe: name scenes of ${Object.keys(ALL).join(', ')}`);
const server = await createServer({
  root: ROOT,
  configFile: `${ROOT}/vite.config.js`,
  plugins: [probeTransforms()],
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ args: SWIFTSHADER_ARGS });
try {
  for (const name of names) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript((r) => {
      try {
        const k = 'dagger.ui.v1';
        const o = JSON.parse(localStorage.getItem(k) || '{}');
        o.landViewDistance = r;
        localStorage.setItem(k, JSON.stringify(o));
      } catch {
        /* none */
      }
    }, RADIUS);
    await ctx.addInitScript(CENSUS);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}${ALL[name]}`);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 1800000, polling: 500 });
    const bootS = (Date.now() - t0) / 1000;
    await waitFrames(page, N_SETTLE);
    const r = await measure(ctx, page, { name, url: ALL[name], bootS, errors });
    console.log(`== ${name}${process.env.TAG ? ` [${process.env.TAG}]` : ''}: ${summaryLine(r)}`);
    const pick = (k) => r.cpu.inclusive.find(([n]) => n.startsWith(k))?.[1] ?? 0;
    console.log(
      `   frame ${pick('frame src/scenes/world.js').toFixed(2)} ms, GC ${(r.cpu.self.find(([n]) => n.startsWith('(garbage'))?.[1] ?? 0).toFixed(2)} ms, heap ${r.heap.bytesPerFrame} B/frame`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
