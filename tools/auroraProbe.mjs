// SKYRIM-AURORA (bible/07-Rendering/Skyrim-Aurora.md): the aurora in the real game. The world boots in the Bay at night
// and shoots north (the Bay's sky has none), jumps to Solitude on Skyrim's north coast (`__tesaJump`) and shoots north,
// up and south. A shot's score is the mean green of its top 40%; frames are counted on `__frame`, never slept for. Exit 1
// on a page error, or when Skyrim's north is not GREEN_OVER greener than the Bay's.
// Usage: ARENA2_PATH=/home/claude/dfdata/arena2 OUT=<dir> node tools/auroraProbe.mjs - and PORT=5184, TOD=23:00,
// TIMESCALE=0 (DFU's is 12; 0 holds the night through a boot of many minutes), EXTRA=<more query>, BOOT_MS=3600000,
// GREEN_OVER=3, CHROMIUM=<a browser other than the pinned Playwright's>.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const PORT = Number(process.env.PORT ?? 5184),
  OUT = process.env.OUT ?? 'aurora-probe';
mkdirSync(OUT, { recursive: true });
const deg = (d) => (d * Math.PI) / 180;

const server = await createServer({
  root: process.cwd(),
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
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
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(900000);
page.on('crash', () => {
  console.log('  the page crashed');
  process.exit(3);
});
await page.addInitScript(() => {
  try {
    const k = 'dagger.ui.v1';
    const o = JSON.parse(localStorage.getItem(k) || '{}');
    o.tutorialPopups = false;
    localStorage.setItem(k, JSON.stringify(o));
  } catch {
    /* none */
  }
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t))
    errors.push(`[console] ${t.slice(0, 300)}`);
  if (/^\[aurora\]/.test(t)) console.log(`  console: ${t.slice(0, 200)}`);
});
const ev = (fn, ...args) => page.evaluate(fn, ...args);
const frames = async (n) => {
  const f0 = await ev(() => window.__frame);
  await page.waitForFunction((t) => window.__frame >= t, f0 + n, { timeout: 900000 });
};
const idle = async () => {
  await page.waitForFunction(() => window.__streamIdle?.() === true, null, { timeout: 1800000 });
  await frames(2);
};

/** The upper sky's green: the mean G over the top 40% of a shot, 0..255 (the aurora's crown and glow are blue-led, so
 *  its green is the one channel the night sky does not carry). */
const greenOf = (buf) => {
  const png = PNG.sync.read(buf);
  let sum = 0,
    n = 0;
  for (let y = 0; y < Math.floor(png.height * 0.4); y++) {
    for (let x = 0; x < png.width; x++) {
      sum += png.data[(y * png.width + x) * 4 + 1];
      n++;
    }
  }
  return sum / n;
};
const shoot = async (label, yaw, pitch) => {
  await ev(([y, p]) => window.__look(y, p), [deg(yaw), deg(pitch)]);
  await frames(4);
  const buf = await page.screenshot({ path: `${OUT}/${label}.png` });
  const g = greenOf(buf);
  const here = await ev(async () => (await import('/src/characters/provinceFolk.js')).pixelHere());
  const lat = here
    ? await ev(
        async ([x, y]) => (await import('/src/world/tamriel/skyrimAurora.js')).auroraLatitude(x, y),
        [here.x, here.y],
      )
    : null;
  console.log(JSON.stringify({ shot: label, here, latitude: lat, green: +g.toFixed(2) }));
  return g;
};

const t0 = Date.now();
await page.goto(
  `http://localhost:${PORT}/play/?world&shot&region=Daggerfall&loc=Daggerfall&class=1&novideo&tod=${process.env.TOD ?? '23:00'}&timescale=${process.env.TIMESCALE ?? '0'}&weather=sunny&skin=enhanced&touch=off${process.env.EXTRA ?? ''}`,
);
for (let i = 0; ; i++) {
  if (await ev(() => window.__shotReady === true).catch(() => false)) break;
  if (i % 12 === 0)
    console.log(
      `  boot ${((Date.now() - t0) / 1000).toFixed(0)} s frame ${await ev(() => window.__frame ?? null).catch(() => null)}`,
    );
  if (Date.now() - t0 > Number(process.env.BOOT_MS ?? 3600000)) throw new Error('the boot never settled');
  await page.waitForTimeout(5000); // before a frame exists to count
}
await idle();
console.log(`booted in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const bay = await shoot('bay-north', 0, 30);
const at = await (async () => {
  for (let i = 0; i < 900; i++) {
    const p = await ev(async () => (await import('/src/world/tamrielCapitals.js')).capitalCentrePixel(1));
    if (p) return p;
    await frames(1);
  }
  return null;
})();
if (!at) throw new Error('Solitude never stood (no pixel)');
await ev(
  ([x, y]) => {
    window.__tesaJump(x, y);
  },
  [at.px, at.py],
);
await frames(2);
await idle();
console.log(`jumped to Solitude's pixel ${at.px},${at.py} and idle at ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const north = await shoot('skyrim-north', 0, 30);
await shoot('skyrim-up', 20, 65);
await shoot('skyrim-south', 180, 30);
await browser.close();
await server.close();
if (errors.length) {
  console.log(errors.slice(0, 8).join('\n'));
  process.exit(1);
}
const OVER = Number(process.env.GREEN_OVER ?? 3);
if (!(north > bay + OVER)) {
  console.log(`Skyrim's north sky (${north.toFixed(2)}) is not ${OVER} greener than the Bay's (${bay.toFixed(2)})`);
  process.exit(1);
}
console.log('ok');
