// Headless screenshot proof for the current milestone scene.
// Boots vite in-process, drives Chromium (pre-provisioned at
// /opt/pw-browsers), waits for the scene's __shotReady flag, captures.
// Usage: ARENA2_PATH=... node tools/screenshot.mjs [out.png]
// SHOT_QUERY overrides the scene query string (must keep `shot`), e.g.
//   SHOT_QUERY='shot&interior=MAGEAA00.RMB:0' for a building interior.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2] || '/home/claude/dagger-shot.png';
const query = process.env.SHOT_QUERY || 'shot';

const server = await createServer({ server: { port: 5199, strictPort: true } });
await server.listen();

const browser = await chromium.launch({
  headless: true,
  args: [
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:5199/?${query}`);
const readyTimeout = Number(process.env.SHOT_TIMEOUT || 30000);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: readyTimeout });
// Optional post-ready action for streaming scenes: evaluate an expression
// (e.g. window.__move(1600, 0, 0)), then wait for the stream to go idle.
if (process.env.SHOT_EVAL) {
  await page.evaluate(process.env.SHOT_EVAL);
  await page.waitForFunction(
    () => !window.__streamIdle || window.__streamIdle() === true,
    null, { timeout: readyTimeout });
  await page.waitForTimeout(400);
}
await page.screenshot({ path: out });
console.log('screenshot:', out);
await browser.close();
await server.close();
