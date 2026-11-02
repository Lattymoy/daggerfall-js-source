// LIGHT-REACH (2026-10-29): THE NIGHT STREET'S LIGHT, PRICED IN THE REAL GAME - the fixed-city bench (`?exterior`) over
// ARENA2 in headless Chromium (SwiftShader) at 22:00: each view's frame time all lit, windows off, lanterns off too, and
// what it lit (window lights near and far, cuts, lanterns, cells, the lanterns' shadow faces). Run on two trees and compare:
// SwiftShader's ms are not a player's, but one machine prices both alike. Exits 1 on a page error, or a view with no
// lantern, no near window light or no far row (AUDIT LIGHT-REACH R8: a probe that could not fail priced nothing).
// Usage: ARENA2_PATH=... node tools/lightReachProbe.mjs [--label head] [--out scratch/reach] [--port 5271]
//   [--region Daggerfall --loc Daggerfall] [--views '[[x,y,z,yaw,pitch],...]']   (CHROMIUM: a browser to launch)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const LABEL = arg('label', 'head'),
  OUT = arg('out', 'scratch/reach'),
  PORT = Number(arg('port', 5271));
const REGION = arg('region', 'Daggerfall'),
  LOC = arg('loc', 'Daggerfall'); // AUDIT LIGHT-REACH R7: any town the bench stands
/** Behind a lantern looking down the street to the next; from that one looking back; beside the first, turned to the houses. */
const VIEWS = JSON.parse(
  arg('views', '[[383.91,0,372.65,1.209,-0.1],[470.1,0,405.3,-1.932,-0.1],[383.91,0,372.65,0.4,-0.1]]'),
);
mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({
  root: process.cwd(),
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
// the tutorials' cards off before the first frame (uiPrefs' own store), and nothing leaves the machine
await page.addInitScript(() => {
  try {
    const k = 'dagger.ui.v1',
      o = JSON.parse(localStorage.getItem(k) || '{}');
    o.tutorialPopups = false;
    localStorage.setItem(k, JSON.stringify(o));
  } catch {
    /* a page with no storage boots as it would */
  }
});
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
await page.goto(
  `http://localhost:${PORT}/play/?exterior&region=${encodeURIComponent(REGION)}&loc=${encodeURIComponent(LOC)}&shot&play&class=1&novideo&weather=sunny&tod=22%3A00`,
);
const ev = (f, a) => page.evaluate(f, a);
await page.waitForFunction(() => !!(window.__shotReady && window.__pose), null, { timeout: 1500e3, polling: 2000 });
const frames = async (k) => {
  const f0 = await ev(() => window.__frame);
  await page.waitForFunction((n) => window.__frame > n, f0 + k, { timeout: 900000 });
};
for (let i = 0; i < 40; i++) {
  // the arrival's talk, pressed through
  const t = await ev(() => {
    try {
      return JSON.parse(window.__talk?.() ?? 'null');
    } catch {
      return null;
    }
  }).catch(() => null);
  if (!t?.overlay) break;
  await page.keyboard.press('Space');
  await frames(2); // AUDIT LIGHT-REACH R8: on the frame counter, never a sleep
}
const frameMs = (n = 12) =>
  ev(
    (n) =>
      new Promise((res) => {
        const f0 = window.__frame,
          t0 = performance.now();
        const tick = () => {
          if (window.__frame >= f0 + n) res((performance.now() - t0) / (window.__frame - f0));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
const windowsOff = (off) =>
  ev((off) => {
    const p = window.__renderer._wl;
    p.__frame ??= p.frame;
    p.frame = off
      ? function () {
          this.count = 0;
          this.farCount = 0;
          return 0;
        }
      : p.__frame;
  }, off);
const lanternsOff = (off) =>
  ev((off) => {
    const r = window.__renderer;
    r.__set ??= r.setPointLights;
    r.setPointLights = off
      ? function (d, c) {
          return r.__set.call(r, new Float32Array(0), c, null);
        }
      : r.__set;
  }, off);
const res = [];
for (const [vi, v] of VIEWS.entries()) {
  await ev((v) => window.__pose(...v), v);
  await frames(10);
  const row = { view: vi };
  for (const [k, setup] of [
    [
      'all',
      async () => {
        await windowsOff(false);
        await lanternsOff(false);
      },
    ],
    ['nowin', () => windowsOff(true)],
    ['none', () => lanternsOff(true)],
  ]) {
    await setup();
    await frames(4);
    const t = [await frameMs(), await frameMs()];
    row[k] = Math.round((t[0] + t[1]) / 2);
    if (k !== 'all') continue;
    await page.screenshot({ path: `${OUT}/${LABEL}-v${vi}.png` });
    row.lit = await ev(() => {
      const r = window.__renderer,
        w = r._wl,
        sh = r.shadows?.stats ?? {};
      return {
        near: w.count,
        far: w.farCount ?? 0,
        cut: +w._cuts.street.toFixed(1),
        farCut: w._cutFar === undefined ? null : +w._cutFar.toFixed(1),
        cells: w.stats.cells,
        farCells: w.farSpace?.total ?? null,
        lanterns: r._pointLights.length / 4,
        lanternCells: r._clusters.total,
        shadowFaces: sh.facesDrawn ?? null,
        staticFaces: sh.staticFaces ?? null,
        dynFaces: sh.dynFaces ?? null,
        pointDraws: sh.pointDraws ?? null,
        cachedSlots: sh.cachedSlots ?? null,
      };
    });
  }
  await windowsOff(false);
  await lanternsOff(false);
  res.push(row);
  console.log(LABEL, JSON.stringify(row));
}
writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify({ label: LABEL, views: VIEWS, res, errors }, null, 1));
await browser.close();
await server.close();
const dark = res.filter((r) => !(r.lit?.lanterns > 0 && r.lit.near > 0 && (r.lit.far > 0 || r.lit.farCut === null)));
if (errors.length || dark.length) {
  console.error(
    `FAIL - ${errors.length ? `the page threw:\n${errors.join('\n')}` : `views ${dark.map((r) => r.view)} lit no lantern, near window or far row`}`,
  );
  process.exit(1);
}
