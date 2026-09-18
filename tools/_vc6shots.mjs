import { createServer } from 'vite';
import { chromium } from 'playwright';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5262, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
for (const [label, q] of [
  ['partly-1', 'hour=12&weather=sunny&yaw=0&pitch=35'],
  ['partly-2', 'hour=12&weather=sunny&yaw=90&pitch=35'],
  ['partly-3', 'hour=12&weather=sunny&yaw=180&pitch=35'],
  ['partly-4', 'hour=12&weather=sunny&yaw=270&pitch=35'],
  ['set-toward', 'hour=18.0&weather=sunny&yaw=270&pitch=15'],
  ['set-away', 'hour=18.0&weather=sunny&yaw=90&pitch=15'],
  ['set-toward-off', 'hour=18.0&weather=sunny&yaw=270&pitch=15&clouds=off'],
  ['after-set', 'hour=18.2&weather=cloudy&yaw=270&pitch=15'],
  ['golden-cloudy', 'hour=17.7&weather=cloudy&yaw=270&pitch=20'],
]) {
  await page.goto(`http://127.0.0.1:5262/sky.html?still&nopanel&${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__skyReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/vc6-${label}.png` });
  console.log('shot', label);
}
await browser.close(); await server.close();
