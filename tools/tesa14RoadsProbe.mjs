// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, in the real game: the world host boots in
// Daggerfall, the trace lands, the roads' workers (world/tamrielRoadsWorker.js, as Vite bundles it) build the regions
// nearest the player first, each landing on the terrain client and in the held map's ink.
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 node tools/tesa14RoadsProbe.mjs   (REGIONS=n to wait for, default 6;
// CHROMIUM=path for a browser other than the pinned Playwright's)
import { createServer } from 'vite';
import { chromium } from 'playwright';

const WANT = Number(process.env.REGIONS ?? 6);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const server = await createServer({
  root: process.cwd(),
  server: { port: 5244, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [],
  said = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (/^\[(roads|tamriel|arena)\]/.test(t)) {
    said.push(t);
    console.log(`  console: ${t.slice(0, 220)}`);
  }
  if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t))
    errors.push(`[console] ${t.slice(0, 300)}`);
});
let fails = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) fails++;
  return !!ok;
};
const ev = (fn, ...args) => page.evaluate(fn, ...args);

const t0 = Date.now();
await page.goto(
  'http://localhost:5244/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12:00&skin=enhanced&touch=off',
);
const regions = () => said.filter((t) => /^\[roads\] region \(/.test(t)).length;
for (const until = Date.now() + 480000; Date.now() < until && regions() < WANT && !errors.length;)
  await page.waitForTimeout(1000);
const started = said.find((t) => /^\[roads\] the roads past the Bay: \d+ regions/.test(t));
check(!!started, `the build started (${started ?? 'none'})`);
check(
  regions() >= WANT,
  `${regions()} regions landed in ${((Date.now() - t0) / 1000).toFixed(0)} s of the page's life`,
);
const ink = await ev(async () => {
  const m = await import('/src/ui/tamrielInk.js');
  const k = m.tamrielInkFor(null);
  return { roads: k.roads.length, tracks: k.tracks.length };
});
check(
  ink.roads > 0 && ink.tracks > 0,
  `the held map's ink holds them (${ink.roads} road chains, ${ink.tracks} track chains)`,
);
check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
