// THE WATER, SEEN (WATER1). Opens the water lab and judges what a
// screenshot can: the pass changes the water and nothing else, the
// surface moves, the sun glints toward the sun and not away from it,
// rain and wind change it, and no frame errors.
//     node tools/waterProbe.mjs          (writes /tmp/water-*.png)
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const server = await createServer({ server: { port: 5239, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5239';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function shoot(label, q) {
  await page.goto(`${BASE}/water.html?still&nopanel&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__waterReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(250);
  const stats = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // the LOWER third of the frame (readPixels is bottom-up: rows 0..h/3),
    // which is the sea in front of the camera in every shot here
    let sum = 0, sum2 = 0, blue = 0, max = 0, n = 0, bright = 0, magenta = 0;
    const grid = [];
    for (let y = 0; y < (h / 3) | 0; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const r = px[i], g = px[i + 1], b = px[i + 2], l = (r + g + b) / 3;
      sum += l; sum2 += l * l; blue += b - r; if (l > max) max = l; if (l >= 200) bright++; n++;
      if (r > 170 && b > 140 && g < 100) magenta++;   // WATER5: the mask view's paint (magenta at 0.65 over the ground)
      if ((x & 7) === 0 && (y & 7) === 0) grid.push(l);
    }
    // and the UPPER third - the sky, which the pass must not touch
    const sgrid = [];
    for (let y = h - 1; y >= h - ((h / 3) | 0); y--) for (let x = 0; x < w; x++) {
      if ((x & 7) === 0 && (y & 7) === 0) { const i = (y * w + x) * 4; sgrid.push((px[i] + px[i + 1] + px[i + 2]) / 3); }
    }
    const mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), blue: blue / n, max, brightFrac: bright / n, magenta: magenta / n, grid, sgrid, glError: gl.getError() };
  });
  // WATER-AUDIT (M5): the SHORE - the fraction of a fixed band across the
  // frame's middle whose pixels read as water (blue well above red), so a
  // transposed or inverted corner table, which moves the feather off the
  // beach line, changes the number; on and off are compared by the caller
  stats.wet = await page.evaluate(() => {
    const c = document.getElementById('c');
    const gl = c.getContext('webgl2');
    const w = c.width, h = c.height;
    const y0 = (h * 0.30) | 0, y1 = (h * 0.62) | 0;
    const px = new Uint8Array(w * (y1 - y0) * 4);
    gl.readPixels(0, y0, w, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let wet = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i + 2] - px[i] > 40) wet++; n++; }
    return wet / n;
  });
  await page.screenshot({ path: `${shots}/water-${label}.png` });
  console.log(`  ${shots}/water-${label}.png  mean ${stats.mean.toFixed(1)} sd ${stats.sd.toFixed(1)} blue ${stats.blue.toFixed(1)} max ${stats.max} bright ${(stats.brightFrac * 100).toFixed(2)}% wet ${(stats.wet * 100).toFixed(1)}%`);
  return stats;
}
const diff = (a, b, k = 'grid') => a[k].reduce((s, v, i) => s + Math.abs(v - b[k][i]), 0) / a[k].length;

const VIEW = 'yaw=0&pitch=-14&height=14';
const on = await shoot('morning-on', `hour=10&${VIEW}&wind=0.4`);
const off = await shoot('morning-off', `hour=10&${VIEW}&wind=0.4&water=off`);
const later = await shoot('morning-t5', `hour=10&${VIEW}&wind=0.4&t=5`);
const calm = await shoot('morning-calm', `hour=10&${VIEW}&wind=0`);
const gale = await shoot('morning-gale', `hour=10&${VIEW}&wind=1`);
const rain = await shoot('morning-rain', `hour=10&${VIEW}&wind=0.4&rain=1&weather=rain`);
const toward = await shoot('dawn-toward-sun', 'hour=7.3&yaw=90&pitch=-5&height=5&wind=0.3');
const away = await shoot('dawn-away-sun', 'hour=7.3&yaw=-90&pitch=-5&height=5&wind=0.3');
const night = await shoot('midnight', `hour=0&${VIEW}&wind=0.4`);
const nightOff = await shoot('midnight-off', `hour=0&${VIEW}&wind=0.4&water=off`);
const overcast = await shoot('overcast', `hour=12&${VIEW}&wind=0.6&weather=overcast`);
const sunny = await shoot('noon', `hour=12&${VIEW}&wind=0.6`);
const shore = await shoot('shore', 'hour=14&yaw=20&pitch=-22&height=6&wind=0.5&z=-236');   // the beach up close, and the feather's own check below
const shoreOff = await shoot('shore-off', 'hour=14&yaw=20&pitch=-22&height=6&wind=0.5&z=-236&water=off');
const shoreMask = await shoot('shore-mask', 'hour=14&yaw=20&pitch=-22&height=6&wind=0.5&z=-236&water=mask');   // WATER5: the mask view - the art's own water, painted
const seaMask = await shoot('sea-mask', `hour=10&${VIEW}&wind=0.4&water=mask`);
await shoot('river', 'hour=14&yaw=40&pitch=-28&height=140&wind=0.3&z=-60');   // the river down the east slope and the lake - for the eye
await shoot('rain-close', 'hour=12&yaw=0&pitch=-30&height=4&wind=0.2&rain=1&weather=rain');   // the rain's pocking up close - for the eye

check('no page or WebGL errors across the set', errors.length === 0 && [on, off, later, toward, night].every((s) => s.glError === 0), errors.join(' | '));
check('the pass changes the water: on and off differ over the sea', diff(on, off) > 6, `mean |diff| ${diff(on, off).toFixed(1)} levels`);
check('and leaves the sky alone', diff(on, off, 'sgrid') < 1, `sky |diff| ${diff(on, off, 'sgrid').toFixed(2)}`);
check('the surface moves: five seconds later is a different picture', diff(on, later) > 0.8, `${diff(on, later).toFixed(2)} levels`);
check('the wind roughens it: a gale varies more than a calm', gale.sd > calm.sd * 1.05 && diff(calm, gale) > 1, `sd ${gale.sd.toFixed(1)} vs ${calm.sd.toFixed(1)}`);
check('rain pocks it: a rainy sea differs from the same sea dry', diff(on, rain) > 1.5, `${diff(on, rain).toFixed(2)} levels`);
check('the sun glints toward the sun and not away from it', toward.brightFrac > away.brightFrac * 2 && toward.brightFrac > 0.001, `bright ${(toward.brightFrac * 100).toFixed(2)}% vs ${(away.brightFrac * 100).toFixed(2)}%`);
check('at midnight the sea is dark, and still water (the pass changes it)', night.mean < on.mean * 0.5 && diff(night, nightOff) > 1, `mean ${night.mean.toFixed(0)} vs day ${on.mean.toFixed(0)}; |diff| off ${diff(night, nightOff).toFixed(1)}`);
check('an overcast sea reflects a grey sky: less blue than a sunny one', overcast.blue < sunny.blue, `blue ${overcast.blue.toFixed(1)} vs ${sunny.blue.toFixed(1)}`);
// WATER-AUDIT (M5): the shore band holds BOTH sand and sea, and the pass wets only the sea's side of the feather -
// a transposed table wets the wrong half, an inverted one wets the beach; the off shot's tile art is what stands on the sand
check('the shore: the pass wets part of the band and not all of it, and more of it than the bare tiles', shore.wet > 0.2 && shore.wet < 0.8 && shore.wet > shoreOff.wet + 0.1, `wet ${(shore.wet * 100).toFixed(1)}% vs off ${(shoreOff.wet * 100).toFixed(1)}%`);
// WATER5: the mask view paints exactly the art's water - all of the open sea, part of the shore band, and nothing of the sky
check('the mask view: the whole sea, part of the shore, none of the sky', seaMask.magenta > 0.9 && shoreMask.magenta > 0.05 && shoreMask.magenta < 0.95 && diff(on, seaMask, 'sgrid') < 1,
  `sea ${(seaMask.magenta * 100).toFixed(1)}% shore ${(shoreMask.magenta * 100).toFixed(1)}% sky |diff| ${diff(on, seaMask, 'sgrid').toFixed(2)}`);

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; shots in ${shots}/water-*.png`);
process.exit(failed.length ? 1 : 0);
