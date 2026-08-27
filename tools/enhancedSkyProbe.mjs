// THE ENHANCED SKY, SEEN (ES1). Opens the sky lab at a set of hours,
// weathers and views and screenshots each - the eyeball tool - and
// judges what a screenshot can: the pass compiles and draws (no page
// error, no WebGL error), the frame is not black, the dome is brighter
// at noon than at midnight, the sun's disc is in the frame at noon when
// looking up at it, and the stars are there at midnight.
//
//     node tools/enhancedSkyProbe.mjs          (writes /tmp/sky-*.png)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { skyState } from '../src/render/enhancedSky.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5235, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5235';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function shoot(label, q) {
  await page.goto(`${BASE}/sky.html?still&nopanel&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__skyReady === true, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, max = 0, bright = 0, warm = 0, n = w * h;
    for (let i = 0; i < n; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], l = (r + g + b) / 3;
      sum += l; if (l > max) max = l; if (l > 250) bright++;
      if (r > 150 && r > b + 20 && l > 100) warm++;   // Masser's colour class: a warm, lit disc
    }
    return { mean: sum / n, max, brightFrac: bright / n, warmFrac: warm / n, glError: gl.getError() };
  });
  await page.screenshot({ path: `${shots}/sky-${label}.png` });
  console.log(`  ${shots}/sky-${label}.png  mean ${stats.mean.toFixed(1)} max ${stats.max} bright ${(stats.brightFrac * 100).toFixed(2)}%`);
  return stats;
}

const noon = await shoot('noon', 'hour=12&weather=sunny&yaw=90&pitch=12');
const noonUp = await shoot('noon-up', 'hour=12&weather=sunny&yaw=90&pitch=78');
const dawn = await shoot('dawn', 'hour=6.2&weather=sunny&yaw=0&pitch=8');
const dusk = await shoot('dusk', 'hour=17.8&weather=sunny&yaw=180&pitch=8');
const night = await shoot('midnight', 'hour=0&weather=sunny&yaw=90&pitch=20&day=3');
// Point the camera AT Masser on a night it is up: the law says where.
const moonNight = (() => {
  for (let day = 0; day < 32; day++) {
    const m = 22 * 60, cm = (405 * 360 + day) * MINUTES_PER_DAY + m;
    const st = skyState({ minuteOfDay: m, weather: 'sunny', classicMinutes: cm });
    if (st.masser.dir[1] > 0.3 && st.masser.vis > 0.5) {
      const d = st.masser.dir;
      return { day, yaw: Math.atan2(d[0], d[2]) * 180 / Math.PI, pitch: Math.asin(d[1]) * 180 / Math.PI, phase: st.masser.phase };
    }
  }
  return null;
})();
const moons = await shoot('evening-moons', `hour=22&weather=sunny&day=${moonNight.day}&yaw=${moonNight.yaw.toFixed(0)}&pitch=${moonNight.pitch.toFixed(0)}`);
console.log(`  (Masser phase ${moonNight.phase}, at yaw ${moonNight.yaw.toFixed(0)} pitch ${moonNight.pitch.toFixed(0)} on day ${moonNight.day})`);
const overcast = await shoot('overcast', 'hour=12&weather=overcast&yaw=90&pitch=12');
const storm = await shoot('storm', 'hour=12&weather=thunder&yaw=90&pitch=12');
const foggy = await shoot('fog', 'hour=12&weather=fog&yaw=90&pitch=12&fog=0.8');

check('no page or WebGL errors across the set', errors.length === 0 && [noon, dawn, night, overcast].every((s) => s.glError === 0), errors.join(' | '));
check('every frame draws (none black)', [noon, dawn, dusk, night, overcast, storm, foggy].every((s) => s.mean > 4));
check('noon is brighter than midnight', noon.mean > night.mean * 3, `${noon.mean.toFixed(0)} vs ${night.mean.toFixed(0)}`);
check('the sun\'s disc is in the frame looking up at noon', noonUp.brightFrac > 0.0005 && noonUp.max === 255, `${(noonUp.brightFrac * 100).toFixed(3)}% at 255`);
check('the storm is darker than the overcast, which is darker than the clear noon', storm.mean < overcast.mean && overcast.mean < noon.mean, `${storm.mean.toFixed(0)} < ${overcast.mean.toFixed(0)} < ${noon.mean.toFixed(0)}`);
check('midnight has points of light (stars)', night.max > 120 && night.mean < 40, `max ${night.max} mean ${night.mean.toFixed(0)}`);
check('Masser is in the frame when the camera is pointed at where the law puts it', moons.warmFrac > 0.0003 && moons.warmFrac < 0.01, `${(moons.warmFrac * 100).toFixed(3)}% of the frame is its warm lit disc`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
