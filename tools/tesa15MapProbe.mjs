// TESA15 (bible/03-World/Arena-Provinces.md TESA15) - THE MAP PAST THE BAY AT THE WORLD'S FIDELITY, in the real game: the
// world host boots in Daggerfall, the roads' regions land (from the roads' cache, after a first run), the places they laid
// are read (window.__tesaPlaces), the paint past the Bay is timed through its kept tiles against the same paint with none,
// and the travel map (V) is opened and photographed out on the continent, at far, at mid and near over Skyrim. Grown from
// TESA13's probe (tools/tesa13MapProbe.mjs, retired with the page's own roll it watched fill in).
//
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 node tools/tesa15MapProbe.mjs   (SHOTS=dir, default tesa15-shots;
// PROFILE=dir keeps the browser's profile - its roads' cache - between runs; NO_MAP=1 times the paint and opens no map - a
// software GPU's frames make the map's walk round the continent a quarter of an hour; CHROMIUM=path for a browser other
// than the pinned Playwright's). The canvas is the CPU's (--disable-accelerated-2d-canvas): a headless software GPU runs an
// accelerated canvas ten times slower than a CPU's, and is no GPU's measure.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHOTS = process.env.SHOTS ?? 'tesa15-shots';
mkdirSync(SHOTS, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PROFILE = process.env.PROFILE ?? mkdtempSync(join(tmpdir(), 'tesa15-'));

const server = await createServer({
  root: process.cwd(),
  server: { port: 5249, strictPort: true, hmr: false, watch: null },
  logLevel: 'silent',
});
await server.listen();
const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 1280, height: 800 },
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-accelerated-2d-canvas',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = browser.pages()[0] ?? (await browser.newPage());
const errors = [],
  said = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (/^\[roads\]/.test(t)) {
    said.push(t);
    if (!/^\[roads\] region \(/.test(t) || / all in /.test(t)) console.log(`  console: ${t.slice(0, 220)}`);
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
const shot = async (name) => {
  await page.waitForTimeout(6000);
  try {
    await page.screenshot({ path: `${SHOTS}/${name}`, timeout: 120000 });
    console.log(`  shot ${SHOTS}/${name}`);
  } catch (e) {
    console.log(`(screenshot ${name} skipped: ${e.message.split('\n')[0]})`);
  }
};

const t0 = Date.now();
await page.goto(
  'http://localhost:5249/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=12:00&skin=enhanced&touch=off',
);
const landed = () => said.filter((t) => /^\[roads\] region \(/.test(t)).length;
for (const until = Date.now() + 900000; Date.now() < until && !(landed() && said.some((t) => / all in /.test(t)));)
  await page.waitForTimeout(1000);
const cached = said.filter((t) => /from the cache/.test(t)).length;
check(
  said.some((t) => / all in /.test(t)),
  `every region landed (${landed()}, ${cached} from the cache) in ${((Date.now() - t0) / 1000).toFixed(0)} s of the page's life`,
);
const placed = await ev(() => window.__tesaPlaces(-1000, -1000, 6000, 3000).length);
check(placed > 100000, `the places the regions laid, all of them (${placed})`);

// the paint past the Bay, timed off the window: its kept tiles filling a view and panning it, and the same paint with none
const cost = await ev(async () => {
  const ti = await import('/src/ui/tamrielInk.js'),
    tt = await import('/src/ui/tamrielTiles.js'),
    pb = await import('/src/world/pastBayPlaces.js');
  const ink = ti.tamrielInkFor(null);
  const c = document.createElement('canvas');
  c.width = 1150;
  c.height = 720;
  const g = c.getContext('2d');
  const tiles = tt.createTamrielTiles({
    paint: (cc, v, w, h, o, job) => ti.paintPastBay(cc, v, { ...o, paperW: w, paperH: h }, job),
    stamp: ti.pastBayStamp,
  });
  const paint = (view, band, continent, kept) => {
    const t = performance.now();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 1150, 720);
    ti.paintTamrielInk(g, view, ink, {
      paperW: 1150,
      paperH: 720,
      band,
      continent,
      filters: {},
      placesIn: pb.pastBayPlacesIn,
      tiles: kept ? tiles : null,
      dpr: 1,
    });
    g.getImageData(0, 0, 1, 1);
    return performance.now() - t;
  };
  const run = (view, band, continent) => {
    const ms = [];
    do ms.push(paint(view, band, continent, true));
    while (tiles.takePending() && ms.length < 400);
    const pan = [];
    for (let k = 1; k <= 6; k++)
      pan.push(paint({ ...view, ox: view.ox + (k * 2) / view.scale }, band, continent, true));
    return {
      frames: ms.length,
      fill: Math.round(ms.reduce((a, b) => a + b, 0)),
      worst: Math.round(Math.max(...ms)),
      pan: Math.round((pan.reduce((a, b) => a + b, 0) / pan.length) * 10) / 10,
      none: Math.round(paint(view, band, continent, false)),
    };
  };
  return {
    continent: run({ ox: -600, oy: -900, scale: 0.2 }, 'far', true),
    far: run({ ox: 948, oy: -457, scale: 0.73 }, 'far', false),
    mid: run({ ox: 1433, oy: -351, scale: 3.29 }, 'mid', false),
    near: run({ ox: 1500, oy: -300, scale: 6 }, 'near', false),
  };
});
for (const [k, v] of Object.entries(cost)) {
  console.log(
    `  ${k}: a view's first paint ${v.fill} ms over ${v.frames} frames (the worst ${v.worst}); a pan ${v.pan} ms a frame kept, ${v.none} ms with no tiles`,
  );
  check(v.pan < v.none || v.none < 5, `${k}: the kept tiles' pan is the cheaper`);
}

for (let i = 0; i < 60 && !process.env.NO_MAP; i++) {
  // the headless start's tutorial (a Yes/No: No ends it) and the main quest's opening box
  const t = JSON.parse(await ev(() => window.__talk()));
  if (!t.overlay) break;
  await page.keyboard.press(/tutorial/i.test(t.overlayBox ?? '') ? 'KeyN' : 'Space');
  await page.waitForTimeout(300);
}
const state = async () => {
  const s = await ev(() => (globalThis.__heldMap ? globalThis.__heldMap() : null));
  return s ? JSON.parse(s) : null;
};
let st = null;
if (!process.env.NO_MAP) {
  await page.keyboard.press('KeyV');
  for (let i = 0; i < 120 && st?.phase !== 'map'; i++) {
    await page.waitForTimeout(500);
    st = await state();
  } // risen: the keys are the sheet's
  await page.waitForTimeout(2000);
  st = await state();
  check(!!st, `the travel map opened (view ${JSON.stringify(st?.view)}, band ${st?.band})`);
}
const mid = (v) => [v.view.ox + v.paper.w / v.view.scale / 2, v.view.oy + v.paper.h / v.view.scale / 2];
async function goTo(TX, TY, scale) {
  for (let i = 0; i < 30 && st.view.scale > scale * 1.2; i++) {
    await page.keyboard.press('Minus');
    await page.waitForTimeout(200);
    st = await state();
  }
  for (let i = 0; i < 30 && st.view.scale < scale / 1.2; i++) {
    await page.keyboard.press('Equal');
    await page.waitForTimeout(200);
    st = await state();
  }
  for (let i = 0; i < 25; i++) {
    // drags pan the sheet (the stage owns the pointer)
    const [cx, cy] = mid(st);
    if (Math.abs(cx - TX) * st.view.scale < 40 && Math.abs(cy - TY) * st.view.scale < 40) break;
    const dx = Math.max(-300, Math.min(300, (cx - TX) * st.view.scale)),
      dy = Math.max(-300, Math.min(300, (cy - TY) * st.view.scale));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    for (let k = 1; k <= 6; k++) await page.mouse.move(640 + (dx * k) / 6, 400 + (dy * k) / 6);
    await page.mouse.up();
    await page.waitForTimeout(300);
    st = await state();
  }
  console.log(`  at ${JSON.stringify(st.view)}, band ${st.band}`);
}
if (st) {
  await goTo(2200, 700, 0.15);
  await shot('1-the-continent.png');
  check(st.view.scale < 0.3, `out on the continent (scale ${st.view.scale})`);
  await goTo(1700, 0, 0.73);
  await shot('2-far-over-skyrim.png');
  check(st.band === 'far', 'far');
  await goTo(1600, -250, 3.3);
  await shot('3-mid-over-skyrim.png');
  check(st.band === 'mid', 'mid');
  await goTo(1600, -250, 6);
  await shot('4-near-over-skyrim.png');
  check(st.band === 'near', 'near');
  await page.keyboard.press('Escape');
}
check(errors.length === 0, errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'zero page errors');
await browser.close();
await server.close();
console.log(fails === 0 ? 'TESA15 MAP PROBE: ALL GREEN' : `TESA15 MAP PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
