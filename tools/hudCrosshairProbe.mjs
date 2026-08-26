// U38: the crosshair and mode indicator LIVE. Counts the draw calls
// the components make in a real frame, by wrapping the renderer's
// screen-quad path around one frame with a window open and one with
// it closed. Frame-synced like the fleet.
import { chromium } from 'playwright';
import { createServer } from 'vite';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5209, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto('http://localhost:5209/play/?nomenu&class=0&novideo&shot&play');
await page.waitForFunction(() => window.__frame > 5, { timeout: 120000 });
const frames = async (n) => {
  const f0 = await page.evaluate(() => window.__frame ?? 0);
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(150); if (await page.evaluate(() => window.__frame ?? 0) >= f0 + n) break; }
};
await frames(5);
const out = { steps: {} };

// The components draw with a null texture and an explicit colour;
// count the quads whose colour is the crosshair's over one frame.
const countCrosshairQuads = async () => page.evaluate(async () => {
  const { CROSSHAIR_COLOR } = await import('/src/ui/hudCrosshair.js');
  const r = window.__renderer;
  const orig = r.drawScreenQuad.bind(r);
  let n = 0;
  r.drawScreenQuad = (tex, rect, uv, c) => {
    if (!tex && Array.isArray(c) && c[0] === CROSSHAIR_COLOR[0] && c[3] === CROSSHAIR_COLOR[3]) n++;
    return orig(tex, rect, uv, c);
  };
  const f0 = window.__frame;
  await new Promise((res) => {
    const t = setInterval(() => { if (window.__frame > f0 + 1) { clearInterval(t); res(); } }, 30);
  });
  r.drawScreenQuad = orig;
  return n;
});

out.steps.aiming = await countCrosshairQuads();
// open the pause window - the cursor goes active, the crosshair must vanish
await page.keyboard.press('Escape');
await frames(3);
out.steps.windowUp = await countCrosshairQuads();
await page.keyboard.press('Escape');
await frames(3);
out.steps.aimingAgain = await countCrosshairQuads();

out.ok = !!(out.steps.aiming >= 2            // the two arms, at least once in the frame
  && out.steps.windowUp === 0                // suppressed under a window
  && out.steps.aimingAgain >= 2              // and back after it closes
  && errors.length === 0);
out.errors = errors.slice(0, 6);
console.log(JSON.stringify(out, null, 2));
await browser.close(); await server.close();
process.exit(out.ok ? 0 : 1);
