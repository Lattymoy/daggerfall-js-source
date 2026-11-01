// The wet world in the real game. Boots a street in the rain at each TODS
// hour, with the wet ground and with `?wet=off`, and shoots the same look both ways. Exit 1 on a page error, or when the
// wet shot does not differ from the dry one. Frames are counted on `__frame`, never slept for.
// Usage: ARENA2_PATH=<arena2> OUT=<dir> node tools/wetProbe.mjs - and PORT=5186, TODS=21:30,12:00, REGION=Daggerfall,
// LOC=Daggerfall, MODE=world|exterior, WEATHER=rain, LOOK=<yaw>,<pitch> (degrees), EXTRA=<more query>, CHANNEL=msedge or CHROMIUM=<a browser>, SWIFT=1 (no GPU).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const PORT = Number(process.env.PORT ?? 5186), OUT = process.env.OUT ?? 'wet-probe';
const TODS = (process.env.TODS ?? '21:30,12:00').split(','), [YAW, PITCH] = (process.env.LOOK ?? '0,-12').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const deg = (d) => (d * Math.PI) / 180;
const server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const gpu = process.env.SWIFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}), ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: [...gpu, '--autoplay-policy=no-user-gesture-required'] });
const errors = [];

const shoot = async (label, query) => {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.setDefaultTimeout(1800000);
  await page.addInitScript(() => { try { const k = 'dagger.ui.v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); o.tutorialPopups = false; localStorage.setItem(k, JSON.stringify(o)); } catch { /* none */ } });
  page.on('pageerror', (e) => errors.push(`${label}: ${String(e.stack ?? e.message).slice(0, 400)}`));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT/.test(t)) errors.push(`${label} [console] ${t.slice(0, 300)}`); });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const frames = async (n) => { const f0 = await ev(() => window.__frame); await page.waitForFunction((t) => window.__frame >= t, f0 + n); };
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/play/?${process.env.MODE ?? 'world'}&shot&region=${process.env.REGION ?? 'Daggerfall'}&loc=${process.env.LOC ?? 'Daggerfall'}&class=1&novideo&yaw=${YAW}&pitch=${PITCH}&timescale=0&weather=${process.env.WEATHER ?? 'rain'}&skin=enhanced&touch=off&${query}${process.env.EXTRA ?? ''}`);
  await page.waitForFunction(() => window.__shotReady === true);
  await page.waitForFunction(() => !window.__streamIdle || window.__streamIdle() === true);
  await page.keyboard.press('Enter');   // a letter on arrival
  await ev(([y, p]) => window.__look?.(y, p), [deg(YAW), deg(PITCH)]);   // the bench takes ?yaw and ?pitch instead
  await frames(30);
  const buf = await page.screenshot({ path: `${OUT}/${label}.png` });
  console.log(`${label}: ${((Date.now() - t0) / 1000).toFixed(0)} s, uWet ${JSON.stringify([...(await ev(() => window.__renderer?._wet ?? []))].map((v) => +v.toFixed(3)))}`);
  await page.close();
  return PNG.sync.read(buf);
};
/** The mean absolute difference of two shots, 0..255 a channel. */
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); return s / (a.data.length / 4) / 3; };

let flat = false;
for (const tod of TODS) {
  const wet = await shoot(`wet-${tod.replace(':', '')}`, `tod=${tod}`);
  const dry = await shoot(`dry-${tod.replace(':', '')}`, `tod=${tod}&wet=off`);
  const d = diff(wet, dry);
  console.log(JSON.stringify({ tod, wetVsDry: +d.toFixed(2) }));
  if (!(d > 1)) flat = true;
}
await browser.close();
await server.close();
if (errors.length) { console.log(errors.slice(0, 8).join('\n')); process.exit(1); }
if (flat) { console.log('a wet shot is the dry one'); process.exit(1); }
console.log('ok');
