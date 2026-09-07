// THE CLOUD NOISE, SEEN (VC2). Opens the sky lab's `?noise=` door and
// reads the volumes back: both compile and draw (no page error, no GL
// error), a slice is a field and not a flat (many levels, a mid mean),
// the volume TILES - two tiles across the frame are the same picture
// and the seam between them is no busier than its neighbours; the z
// axis wraps (z=0 and z=1 are one slice) and varies (z=0.25 and z=0.5
// are not); and the Worley octaves rise in frequency across the
// channels.
//
//     node tools/cloudNoiseProbe.mjs          (writes /tmp/noise-*.png)
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5237, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5237';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function shoot(label, q) {
  await page.goto(`${BASE}/sky.html?still&nopanel&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__skyReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(200);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const n = w * h;
    let sum = 0; const levels = new Set(); let changes = 0;
    for (let i = 0; i < n; i++) { const v = px[i * 4]; sum += v; levels.add(v); }
    const row = (h >> 1) * w * 4;
    for (let x = 1; x < w; x++) if (Math.abs(px[row + x * 4] - px[row + (x - 1) * 4]) > 2) changes++;
    // the two halves (for tiles=2): the same picture?
    const half = w >> 1; let halfDiff = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < half; x++) halfDiff += Math.abs(px[(y * w + x) * 4] - px[(y * w + x + half) * 4]);
    halfDiff /= half * h;
    // the seam column against its neighbours: mean |dx| at x=half vs the mean over the frame
    let seam = 0, all = 0;
    for (let y = 0; y < h; y++) {
      seam += Math.abs(px[(y * w + half) * 4] - px[(y * w + half - 1) * 4]);
      for (let x = 1; x < w; x++) all += Math.abs(px[(y * w + x) * 4] - px[(y * w + x - 1) * 4]);
    }
    seam /= h; all /= (w - 1) * h;
    return { mean: sum / n, levels: levels.size, changes, halfDiff, seam, all, glError: gl.getError(), red: Array.from(px.filter((_, i) => i % 4 === 0)) };
  });
  await page.screenshot({ path: `${shots}/noise-${label}.png` });
  console.log(`  ${shots}/noise-${label}.png  mean ${stats.mean.toFixed(1)} levels ${stats.levels} changes ${stats.changes}`);
  return stats;
}
const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; };

const shapeR = await shoot('shape-r', 'noise=shape&z=0.25&ch=r');
const shapeG = await shoot('shape-g', 'noise=shape&z=0.25&ch=g');
const shapeA = await shoot('shape-a', 'noise=shape&z=0.25&ch=a');
const shapeRgb = await shoot('shape-rgb', 'noise=shape&z=0.25&ch=rgb');
const shape2 = await shoot('shape-tiles2', 'noise=shape&z=0.25&ch=r&tiles=2');
const shapeZ0 = await shoot('shape-z0', 'noise=shape&z=0&ch=r');
const shapeZ1 = await shoot('shape-z1', 'noise=shape&z=1&ch=r');
const shapeZ5 = await shoot('shape-z0.5', 'noise=shape&z=0.5&ch=r');
const detail = await shoot('detail-r', 'noise=detail&z=0.25&ch=r');
const detail2 = await shoot('detail-tiles2', 'noise=detail&z=0.25&ch=r&tiles=2');

check('no page or WebGL errors across the set', errors.length === 0 && [shapeR, shapeG, shapeA, detail].every((s) => s.glError === 0), errors.join(' | '));
check('the shape volume is a field, not a flat: many levels, a mid mean', shapeR.levels > 40 && shapeR.mean > 30 && shapeR.mean < 225, `${shapeR.levels} levels, mean ${shapeR.mean.toFixed(0)}`);
check('the detail volume too', detail.levels > 40 && detail.mean > 30 && detail.mean < 225, `${detail.levels} levels, mean ${detail.mean.toFixed(0)}`);
check('the shape volume TILES across x: two tiles are one picture', shape2.halfDiff < 2.5, `half-to-half diff ${shape2.halfDiff.toFixed(2)}`);
check('and the seam between them is no busier than the field', shape2.seam < shape2.all * 2.5 + 2, `seam ${shape2.seam.toFixed(2)} vs field ${shape2.all.toFixed(2)}`);
check('the detail volume tiles too', detail2.halfDiff < 2.5 && detail2.seam < detail2.all * 2.5 + 2, `half ${detail2.halfDiff.toFixed(2)} seam ${detail2.seam.toFixed(2)} vs ${detail2.all.toFixed(2)}`);
check('the z axis wraps: z=0 and z=1 are one slice', diff(shapeZ0.red, shapeZ1.red) < 1.5, `diff ${diff(shapeZ0.red, shapeZ1.red).toFixed(2)}`);
check('and varies: z=0.25 and z=0.5 are different slices', diff(shapeR.red, shapeZ5.red) > 8, `diff ${diff(shapeR.red, shapeZ5.red).toFixed(2)}`);
check('the Worley octaves rise in frequency across the channels (A busier than G busier than R)', shapeA.changes > shapeG.changes && shapeG.changes > shapeR.changes, `${shapeR.changes} < ${shapeG.changes} < ${shapeA.changes}`);
check('the RGB view draws colour (the channels differ)', shapeRgb.levels > 40, `${shapeRgb.levels}`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; shots in ${shots}/noise-*.png`);
process.exit(failed.length ? 1 : 0);
