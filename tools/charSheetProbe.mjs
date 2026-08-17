// U8a probe: F5 in the exterior host opens the CLASSIC character
// sheet - real INFO00I0.IMG art with DFU's verbatim label geometry.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const art = JSON.parse(await page.evaluate(() => window.__uiArt()));
console.log('art loaded:', JSON.stringify(art));
if (!art.charsheet) { console.log('NO CHARSHEET ART'); process.exit(1); }
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
await press('F5');
const t = JSON.parse(await page.evaluate(() => window.__talk()));
console.log('overlay:', t.overlay);
if (!t.overlay) { console.log('SHEET DID NOT OPEN'); process.exit(1); }
await waitFrames(3);
await page.screenshot({ path: '/home/claude/charsheet-native.png' });
// The skill page popup (key 1 = primary)
await press('Digit1');
await waitFrames(3);
await page.screenshot({ path: '/home/claude/charsheet-skills.png' });
// F5 toggles closed
await press('F5');
const closed = JSON.parse(await page.evaluate(() => window.__talk()));
console.log('after F5 again, overlay:', closed.overlay);
if (closed.overlay) { console.log('SHEET DID NOT CLOSE'); process.exit(1); }
console.log('CHARSHEET OK');
await browser.close(); await server.close();
