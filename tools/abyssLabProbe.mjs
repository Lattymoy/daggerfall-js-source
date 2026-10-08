// SD-LAB - THE HOUR AND THE RIFT, SEEN. Opens the Abyss lab (abyss.html, src/tools/abyssLab.js) on Vite's own server
// in a real Chromium, waits on the lab's frame counter (never a sleep - bible/Home.md's Process), and writes a shot of
// each camera, failing on any page error or GL error and on a frame that drew nothing.
//
//     node tools/abyssLabProbe.mjs                        every view, to $ABYSS_SHOTS (default /tmp)
//     node tools/abyssLabProbe.mjs hollow threshold       the named views
//     ABYSS_Q='lane=off' node tools/abyssLabProbe.mjs     more of the lab's query on every shot
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.ABYSS_SHOTS ?? '/tmp';
const extra = process.env.ABYSS_Q ?? '';
const VIEWS = ['threshold', 'back', 'orrery', 'steps', 'arena', 'overview', 'sky', 'hollow', 'hollow-side', 'hollow-ret', 'hollow-close'];
const want = process.argv.slice(2).filter((a) => VIEWS.includes(a));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.ABYSS_W ?? 960), height: Number(process.env.ABYSS_H ?? 540) } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
try {
  for (const view of want.length ? want : VIEWS) {
    errors.length = 0;
    await page.goto(`http://127.0.0.1:5241/abyss.html?still&nopanel&t=${process.env.ABYSS_T ?? 40}&view=${view}${extra ? `&${extra}` : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window.__frame ?? 0) >= 4, null, { timeout: 240000 });
    const s = await page.evaluate(() => {
      const c = document.getElementById('c'), gl = c.getContext('webgl2');
      const w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, lit = 0;
      for (let i = 0; i < px.length; i += 4) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; sum += l; if (l > 12) lit++; }
      // SD-LOOK: the floor's display luminance (the lower third of the frame - readPixels' first rows - Rec. 709 luma of
      // the sRGB bytes), its 95th and 99th percentiles: the value ladder's L1 holds at or under 0.25
      const lum = [];
      for (let y = 0; y < Math.floor(h / 3); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; lum.push((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255); }
      lum.sort((a, b) => a - b);
      const pc = (q) => lum[Math.min(lum.length - 1, Math.floor(q * lum.length))];
      return { mean: sum / (w * h), lit: lit / (w * h), glError: gl.getError(), p95: pc(0.95), p99: pc(0.99) };
    });
    const file = `${shots}/abyss-${view}${extra ? `-${extra.replace(/[^a-z0-9]+/gi, '_')}` : ''}.png`;
    await page.screenshot({ path: file });
    check(view, !errors.length && s.glError === 0 && s.lit > 0.02, `${file} mean ${s.mean.toFixed(1)} lit ${(s.lit * 100).toFixed(1)}% floor p95 ${s.p95.toFixed(2)} p99 ${s.p99.toFixed(2)}${errors.length ? ` errors: ${errors.slice(0, 3).join(' | ')}` : ''}${s.glError ? ` gl ${s.glError}` : ''}`);
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(results.every(Boolean) ? 0 : 1);
