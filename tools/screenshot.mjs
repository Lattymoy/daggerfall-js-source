// Headless screenshot proof for the current milestone scene.
// Boots vite in-process, drives Chromium (pre-provisioned at
// /opt/pw-browsers), waits for the scene's __shotReady flag, captures.
// Usage: ARENA2_PATH=... node tools/screenshot.mjs [out.png]
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const out = process.argv[2] || '/home/claude/dagger-shot.png';

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
await page.goto('http://localhost:5199/?shot');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
await page.screenshot({ path: out });
console.log('screenshot:', out);
await browser.close();
await server.close();
