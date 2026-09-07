// THE VOLUMETRIC CLOUDS, SEEN (VC3). Opens the sky lab with the clouds
// on and off across the weathers and judges what a screenshot can.
//     node tools/volumetricCloudsProbe.mjs          (writes /tmp/vc-*.png)
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5238, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5238';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function shoot(label, q) {
  await page.goto(`${BASE}/sky.html?still&nopanel&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__skyReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(300);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // the UPPER half only (the lab has no ground): mean, variance, blueness, max
    let sum = 0, sum2 = 0, blue = 0, max = 0, n = 0;
    for (let y = h >> 1; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const r = px[i], g = px[i + 1], b = px[i + 2], l = (r + g + b) / 3;
      sum += l; sum2 += l * l; blue += b - r; if (l > max) max = l; n++;
    }
    const mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), blue: blue / n, max, glError: gl.getError() };
  });
  await page.screenshot({ path: `${shots}/vc-${label}.png` });
  console.log(`  ${shots}/vc-${label}.png  mean ${stats.mean.toFixed(1)} sd ${stats.sd.toFixed(1)} blue ${stats.blue.toFixed(1)} max ${stats.max}`);
  return stats;
}

const sunny = await shoot('sunny-noon', 'hour=12&weather=sunny&yaw=90&pitch=30');
const sunnyOff = await shoot('sunny-noon-off', 'hour=12&weather=sunny&yaw=90&pitch=30&clouds=off');
const cloudyToward = await shoot('cloudy-toward-sun', 'hour=15&weather=cloudy&yaw=270&pitch=25');
const cloudyAway = await shoot('cloudy-away-sun', 'hour=15&weather=cloudy&yaw=90&pitch=25');
const overcast = await shoot('overcast-noon', 'hour=12&weather=overcast&yaw=90&pitch=30');
const overcastOff = await shoot('overcast-noon-off', 'hour=12&weather=overcast&yaw=90&pitch=30&clouds=off');
const storm = await shoot('thunder-noon', 'hour=12&weather=thunder&yaw=90&pitch=30');
const nightSunny = await shoot('midnight-sunny', 'hour=0&weather=sunny&yaw=90&pitch=30&day=3');
const nightOvercast = await shoot('midnight-overcast', 'hour=0&weather=overcast&yaw=90&pitch=30&day=3');
const dusk = await shoot('dusk-cloudy', 'hour=17.8&weather=cloudy&yaw=180&pitch=15');

check('no page or WebGL errors across the set', errors.length === 0 && [sunny, overcast, storm, nightSunny].every((s) => s.glError === 0), errors.join(' | '));
check('a sunny noon has clouds: more variation in the sky than the bare dome', sunny.sd > sunnyOff.sd * 1.5, `sd ${sunny.sd.toFixed(1)} vs bare ${sunnyOff.sd.toFixed(1)}`);
check('and it is still a blue sky (scattered, not a lid)', sunny.blue > sunnyOff.blue * 0.5, `blue ${sunny.blue.toFixed(1)} vs bare ${sunnyOff.blue.toFixed(1)}`);
check('an overcast noon is a lid: the sky loses its blue', overcast.blue < sunny.blue * 0.5, `blue ${overcast.blue.toFixed(1)} vs sunny ${sunny.blue.toFixed(1)}`);
check('and the lid is grey, not blown out (an overcast noon is brighter than a blue sky, and never white)', overcast.mean < 215 && overcast.max < 250, `mean ${overcast.mean.toFixed(0)} max ${overcast.max}`);
check('the storm is darker than the overcast', storm.mean < overcast.mean * 0.85, `${storm.mean.toFixed(0)} vs ${overcast.mean.toFixed(0)}`);
check('the clouds are lit: toward the sun is brighter than away from it', cloudyToward.mean > cloudyAway.mean * 1.05, `${cloudyToward.mean.toFixed(0)} vs ${cloudyAway.mean.toFixed(0)}`);
check('an overcast midnight hides the stars a clear one shows', nightOvercast.max < nightSunny.max * 0.7, `max ${nightOvercast.max} vs ${nightSunny.max}`);
check('a cloudy dusk is warm-lit, not black', dusk.mean > 20, `${dusk.mean.toFixed(0)}`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; shots in ${shots}/vc-*.png`);
process.exit(failed.length ? 1 : 0);
