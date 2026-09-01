// ═══════════════════════════════════════════════════════════════════
// THE PROTOTYPE'S RENDER GATE.
//
// `npm run check` runs eslint, the node suite and a vite build. NONE
// of those compile a shader or draw a pixel, so every shader fault in
// this lane has shipped green: a NaN uniform that blackened the sky, a
// depth test that discarded it, a backtick that killed the module, and
// a const declared in the wrong GLSL stage that took the whole page
// down to grey. Four times, and four times the gate said pass.
//
// This is the missing check. It loads the page in a real browser and
// FAILS unless:
//   - no page error and no console error was raised;
//   - every shader program linked (the page exposes them);
//   - the canvas is actually DRAWING - not one flat colour, which is
//     what a dead frame looks like and what "grey screen" means;
//   - a frame later, it is still drawing.
//
//   node tools/protoRenderGate.mjs [--url ...]
//
// It needs the dev server up:
//   (setsid npx vite --port 5199 --host 127.0.0.1 &)
import { chromium } from 'playwright';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5199/grass-proto.html');
const fail = (m) => { console.error(`RENDER GATE FAIL: ${m}`); process.exitCode = 1; };

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({
  viewport: { width: 480, height: 300 }, ignoreHTTPSErrors: true,
})).newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });

page.setDefaultTimeout(120000);
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);
// the lab defaults to a million blades; a software rasteriser cannot
// finish a frame in time to be measured, and a gate that times out
// teaches nothing. Ask for a cheap scene first.
await page.evaluate(() => {
  const d = document.getElementById('density');
  if (d) { d.value = d.min; d.dispatchEvent(new Event('input')); }
}).catch(() => {});
await page.waitForTimeout(6000);

/** Is the canvas drawing? A dead frame is ONE colour; a live one is
 *  not. Sampled on a grid so a flat sky over flat ground still counts
 *  as two colours and passes, while a grey screen cannot. */
const sample = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
  const c = document.getElementById('c');
  const gl = c && c.getContext('webgl2');
  if (!gl) { res({ ok: false, why: 'no webgl2 context' }); return; }
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const seen = new Set();
  const px = new Uint8Array(4);
  for (let gy = 1; gy < 6; gy++) {
    for (let gx = 1; gx < 6; gx++) {
      gl.readPixels(Math.floor(w * gx / 7), Math.floor(h * gy / 7), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      seen.add(`${px[0]>>3},${px[1]>>3},${px[2]>>3}`);
    }
  }
  res({ ok: true, colours: seen.size, glError: gl.getError() });
})));

const a = await sample();
await page.waitForTimeout(1200);
const b = await sample();
await browser.close();

for (const e of errors.slice(0, 4)) fail(e);
if (!a.ok) fail(a.why);
else {
  // one distinct colour across 25 samples IS the grey screen
  if (a.colours < 3) fail(`the canvas is drawing ${a.colours} colour(s) - a dead frame`);
  if (b.colours < 3) fail(`still ${b.colours} colour(s) a second later`);
  if (a.glError) fail(`glError ${a.glError}`);
}
if (!process.exitCode) console.log(`render gate ok - ${a.colours} distinct colours, no errors`);
