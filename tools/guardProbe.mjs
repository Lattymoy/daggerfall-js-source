// G1 probe: boot the exterior walk mode, force the crime response
// (__crime), and watch the city watch answer - guards spawn (from a
// wandering guard NPC or the ring fallback), detect, pursue, and the
// close-up crops against raw 399 art (the doctrine).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
// Let the population breathe so the pool has convert candidates
await new Promise((r) => setTimeout(r, 15000));
console.log('people:', JSON.parse(await page.evaluate(() => window.__people())).length);
await page.evaluate(() => window.__crime());
await new Promise((r) => setTimeout(r, 2000));
let dbg = JSON.parse(await page.evaluate(() => window.__guards()));
console.log('guards after crime:', JSON.stringify(dbg));
if (!dbg.length) { console.log('NO GUARDS SPAWNED'); process.exit(1); }
// Watch pursuit for a few seconds
for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  dbg = JSON.parse(await page.evaluate(() => window.__guards()));
  console.log(`t+${(i + 1) * 3}s`, JSON.stringify(dbg));
  if (dbg.some((g) => g.detected)) break;
}
// Close-up: pose in front of the nearest live guard (doctrine crop)
const g = dbg.find((x) => !x.dead);
if (g) {
  await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.05), [g.pos[0], g.pos[1] + 0.1, g.pos[2] + 2.2]);
  const f0 = await page.evaluate(() => window.__frame);
  await page.waitForFunction((n) => window.__frame > n + 5, f0, { timeout: 60000 });
  await page.screenshot({ path: '/home/claude/guard-closeup.png' });
  console.log('closeup:', await page.evaluate(() => window.__guards()));
}
await browser.close(); await server.close();
