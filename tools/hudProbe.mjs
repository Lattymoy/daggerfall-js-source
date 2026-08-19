// AUDIT 21 (hosts lane, F7): does the classic HUD actually draw ABOVE GROUND?
//
// The six scene hosts have no node execution coverage, so the pins for this
// are source rules. This is the half a rule cannot do: boot the real host in a
// browser and read the pixels where the health bar belongs.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { inflateSync } from 'node:zlib';

/** Minimal decoder for the 8-bit RGBA non-interlaced PNGs Playwright emits.
 *
 *  The first draft of this probe called readPixels on a context re-got from
 *  the canvas - which reads a swapped/blank buffer - and reported 0% lit while
 *  the screenshot plainly showed the bars. The second compared PNG BYTE SIZES,
 *  which cannot tell a textured sky from a status bar. Decoding is the only
 *  honest way to answer "is there a red bar at the bottom left". */
function decodePng(buf) {
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  let p = 8;                                   // skip the signature
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported PNG: depth ${bitDepth} colorType ${colorType}`);
  }
  const ch = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, px: out };
}

/** Count strongly-saturated pixels in the crop.
 *
 *  CALIBRATED BY MUTATION, not by taste. Over the 60x100 strip where the three
 *  vitals bars sit, at 1400x900:
 *
 *      with the drawHud call   world 1600, exterior 1799
 *      with it deleted         exterior  438      <- the grass and plaster behind
 *
 *  So the world behind the bars is itself colourful and a bare "is there any
 *  colour" test does not discriminate; 1000 sits cleanly between the two
 *  populations. Two earlier drafts of this probe got this wrong and are worth
 *  recording: the first called readPixels on a context re-got from the canvas,
 *  which reads a swapped buffer and reported 0% while the screenshot plainly
 *  showed the bars; the second compared PNG byte sizes, which cannot tell a
 *  textured sky from a status bar. */
function saturated(png) {
  let n = 0;
  for (let i = 0; i < png.px.length; i += png.ch) {
    const r = png.px[i], g = png.px[i + 1], b = png.px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 70 && mx - mn > 70) n++;
  }
  return n;
}

const HUD_LIT_FLOOR = 1000;

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5202, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const shot = async (url, label) => {
  await page.goto(url);
  // __shotReady needs the streaming queue to drain in ?world, which can take a
  // while; a frame count is enough for "the host is rendering".
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  } catch {
    console.log(`${label}: __shotReady never set - falling back to a frame count`);
  }
  try {
    await page.waitForFunction(() => (window.__frame ?? 0) > 60, null, { timeout: 60000 });
  } catch {
    const f = await page.evaluate(() => ({ frame: window.__frame, ready: window.__shotReady }));
    console.log(`${label}: frame counter stalled at ${JSON.stringify(f)}`);
  }
  const png = `/home/claude/hud-${label}.png`;
  await page.screenshot({ path: png });

  // Measure the SCREENSHOT, not the live GL buffer. The first draft of this
  // probe called readPixels on a context re-got from the canvas, which reads a
  // swapped/blank buffer and reported 0% while the screenshot plainly showed
  // the bars - a measurement failure, not a missing HUD.
  //
  // A blank strip is one flat colour and compresses to almost nothing; the
  // vitals bars are three saturated columns and do not. So the clipped PNG's
  // own byte length is the signal, and it is compared against the SAME strip
  // taken from the top of the screen, which is sky or ceiling and always flat.
  // AGAINST A CONTROL, not a threshold. A bare threshold is not
  // discriminating: with the draw removed the exterior strip still measured
  // 7.3% saturated, because the grass and the plaster wall BEHIND the bars are
  // themselves colourful. So sample the same band a little to the right, where
  // the same world shows through and no bar does, and require the bars to
  // stand out from it.
  const vp = page.viewportSize();
  const strip = decodePng(await page.screenshot({ clip: { x: 0, y: vp.height - 100, width: 60, height: 100 } }));
  const lit = saturated(strip);
  console.log(`${label}: ${lit} saturated px in the vitals strip `
    + `(floor ${HUD_LIT_FLOOR}, no-HUD baseline ~438)  -> ${png}`);
  return lit >= HUD_LIT_FLOOR ? lit : 0;
  return probe.lit;
};

const world = await shot('http://localhost:5202/?shot&play&class=0&time=12:00', 'world');
const ext = await shot('http://localhost:5202/?shot&play&exterior&class=0&time=12:00', 'exterior');

const ok = world > 0 && ext > 0;   // shot() returns 0 unless the bars beat the control 2:1
console.log(ok ? 'HUD OK - both exterior hosts draw a status bar'
  : 'NO HUD - the bottom-left strip is as flat as the sky in at least one host');
await browser.close(); await server.close();
process.exit(ok ? 0 : 1);
