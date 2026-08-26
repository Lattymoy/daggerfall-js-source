// T1 probe: boot the exterior in walk+shot mode, wait for a
// townsperson to complete a move, close-up screenshot (doctrine).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const snap = await page.evaluate(() => window.__people ? window.__people() : 'no hook');
  const arr = snap === 'no hook' ? [] : JSON.parse(snap);
  const dbg = await page.evaluate(() => window.__townDebug ? window.__townDebug() : '{}');
  console.log(`t+${(i + 1) * 5}s people=${snap === 'no hook' ? snap : arr.length} visible=${arr.filter((p) => p.visible).length} moved=${arr.filter((p) => p.moves > 0).length} pend=${arr.filter((p) => p.pend).length} dbg=${dbg} first=${JSON.stringify(arr[0] ?? null)}`);
  if (arr.some((p) => p.visible && p.moves > 0)) break;
}
const people = JSON.parse(await page.evaluate(() => window.__people()));
console.log('people:', people.length, JSON.stringify(people.slice(0, 5)));
const live = people.find((p) => p.visible && p.moves > 0);
// Re-read RIGHT before posing (walkers wander during waits), face the
// live position, one short beat for the frame, shoot.
const fresh = JSON.parse(await page.evaluate(() => window.__people())).find((p) => p.i === live.i);
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.05), [fresh.pos[0], fresh.pos[1] + 0.2, fresh.pos[2] + 2.2]);
const f0 = await page.evaluate(() => window.__frame);
await page.waitForFunction((n) => window.__frame > n + 2, f0, { timeout: 120000 });
await page.screenshot({ path: '/home/claude/town-closeup.png' });
const after = JSON.parse(await page.evaluate(() => window.__people())).find((p) => p.i === live.i);
console.log('closeup of archive', live.archive, 'now:', JSON.stringify(after));
await browser.close(); await server.close();
