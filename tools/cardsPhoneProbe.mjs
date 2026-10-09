// THE CARD TABLE'S FRAME COST (CARDS3c, bible/11-Multiplayer/Tavern-Cards.md section 32; section 3, MEASURE: "the frame
// cost ... the interior frame is already measured against phones; the slice reports the cost on the probe before it
// ships"). Opens the card table lab (cards.html, src/tools/cardsLab.js `bench`) headless and times its frames with the
// cards and without - the Hold'em evening at its busiest street and an Iliac Hand cloth at its last turn - first at the
// probe's desktop size, then as a PHONE: a 390 x 844 viewport (the renderer draws the world at the canvas's CSS size,
// never its device pixels - systems/renderScale.js), touch, and the CPU throttled four times. The GL is the probe's
// software one (SwiftShader), so every pixel is the CPU's: a phone's GPU does that part faster than this does, which
// makes the measure a ceiling, not a phone's own number. It reports; it fails only on an error or a frame it cannot time.
//     node tools/cardsPhoneProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5242, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5242';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let failed = 0;
const rows = [];
/** MEASURE: the frames a run times, and the CPU throttle that stands for a phone. */
const FRAMES = 60, PHONE_THROTTLE = 4;
for (const [label, viewport, throttle, mobile] of [['desktop 1100x640', { width: 1100, height: 640 }, 1, false], ['phone 390x844, CPU /4', { width: 390, height: 844 }, PHONE_THROTTLE, true]]) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  for (const [game, q] of [['holdem', 't=14&cam=seat&nohud&patrons=5'], ['holdem, no chips', 't=14&cam=seat&nohud&patrons=5&chips=0'], ['holdem from above (no hand held)', 't=14&cam=over&nohud&patrons=5'], ['iliac', 't=30&cam=seat&nohud&game=iliac']]) {
    await page.goto(`${BASE}/cards.html?${q}&bench=${FRAMES}`, { waitUntil: 'commit', timeout: 600000 });   // the bench runs in the page's own load
    await page.waitForFunction(() => window.__cardsReady === true, null, { timeout: 600000 });
    const b = await page.evaluate(() => window.__cardsBench);
    if (!b || !Number.isFinite(b.cardsMs) || !Number.isFinite(b.bareMs)) { failed++; console.log(`FAIL ${label} ${game}: no timing`); continue; }
    rows.push({ label, game, ...b });
    console.log(`${label} ${game}: ${b.width}x${b.height}, ${b.plates} plates, ${b.chips} chips - the room ${b.bareMs.toFixed(2)} ms, with the cards ${b.cardsMs.toFixed(2)} ms: the cards cost ${b.costMs.toFixed(2)} ms a frame`);
  }
  await context.close();
}
if (errors.length) { failed++; console.log('FAIL errors:\n' + errors.join('\n')); }
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
