// DYNAMIC SKIES, SEEN (DS1). Opens the sky lab with `?sky=dynamic` - the
// mod's own pass, presets and textures on the lab's canvas, no game data
// needed - at a set of hours and weathers and screenshots each. Judges
// what a screenshot can: the pass compiles and draws (no page error,
// no WebGL error), the textures landed (the lab reports ready only once
// they have), the frame is not black, noon is brighter than midnight,
// the sun's disc is in the frame at noon looking up at it, the stars
// are there at midnight, and the weathers differ from one another.
//
//     node tools/dynamicSkiesProbe.mjs          (writes /tmp/dsky-*.png)
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5236, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5236';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall due to ReadPixels/.test(m.text())) errors.push(`[${m.type()}] ${m.text()}`); });   // SwiftShader's readback note is not a fault

async function shoot(label, q) {
  await page.goto(`${BASE}/sky.html?sky=dynamic&still&nopanel&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__skyReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, max = 0, bright = 0, n = w * h, distinct = new Set();
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const R = px[i * 4], G = px[i * 4 + 1], B = px[i * 4 + 2], l = (R + G + B) / 3;
      sum += l; if (l > max) max = l; if (l > 245) bright++;
      r += R; g += G; b += B;
      if ((i & 63) === 0) distinct.add((R >> 3) * 1024 + (G >> 3) * 32 + (B >> 3));
    }
    return { mean: sum / n, max, bright, distinct: distinct.size, glError: gl.getError(), r: r / n, g: g / n, b: b / n };
  });
  await page.screenshot({ path: `${shots}/dsky-${label}.png` });
  return stats;
}

const noonUp = await shoot('noon-sunny-up', 'hour=12&weather=sunny&yaw=0&pitch=80&day=10');
const noon = await shoot('noon-sunny', 'hour=12&weather=sunny&yaw=90&pitch=12&day=10');
const dusk = await shoot('dusk-sunny', 'hour=17.6&weather=sunny&yaw=-90&pitch=8&day=10');
const midnight = await shoot('midnight-sunny', 'hour=0&weather=sunny&yaw=90&pitch=30&day=10');
const overcast = await shoot('noon-overcast', 'hour=12&weather=overcast&yaw=90&pitch=12&day=10');
const rain = await shoot('noon-rain', 'hour=12&weather=rain&yaw=90&pitch=12&day=10');
const thunder = await shoot('noon-thunder', 'hour=12&weather=thunder&yaw=90&pitch=12&day=10');
const snow = await shoot('noon-snow', 'hour=12&weather=snow&yaw=90&pitch=12&day=10');
const fog = await shoot('noon-fog', 'hour=12&weather=fog&yaw=90&pitch=12&day=10');
const nightMoon = await shoot('night-moons', 'hour=22&weather=sunny&yaw=-90&pitch=25&day=20');

check('no page error, no console error', errors.length === 0, errors.join(' | ').slice(0, 400));
check('no WebGL error', [noon, midnight, overcast].every((s) => s.glError === 0));
check('noon is not black', noon.mean > 30, `mean ${noon.mean.toFixed(1)}`);
check('noon is brighter than midnight', noon.mean > midnight.mean * 1.5, `${noon.mean.toFixed(1)} vs ${midnight.mean.toFixed(1)}`);
check('noon sky is blue', noon.b > noon.r, `r ${noon.r.toFixed(0)} b ${noon.b.toFixed(0)}`);
check('the sun disc is in the frame looking up at noon', noonUp.bright > 20, `${noonUp.bright} bright px`);
check('midnight has stars', midnight.max > 120 && midnight.mean < 60, `max ${midnight.max} mean ${midnight.mean.toFixed(1)}`);
check('the weathers differ', new Set([noon, overcast, rain, thunder, snow, fog].map((s) => Math.round(s.mean))).size >= 4,
  [noon, overcast, rain, thunder, snow, fog].map((s) => s.mean.toFixed(0)).join('/'));
check('thunder is darker than sunny', thunder.mean < noon.mean * 0.7, `${thunder.mean.toFixed(1)} vs ${noon.mean.toFixed(1)}`);
check('dusk is warmer than noon', dusk.r / Math.max(1, dusk.b) > noon.r / Math.max(1, noon.b), `dusk r/b ${(dusk.r / dusk.b).toFixed(2)} noon ${(noon.r / noon.b).toFixed(2)}`);
check('a night frame draws something', nightMoon.distinct > 3, `${nightMoon.distinct} colour cells`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed; shots in ${shots}/dsky-*.png`);
process.exit(failed ? 1 : 0);
