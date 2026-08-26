// T2 probe: boot the STREAMING world in fly+shot mode at Daggerfall
// city, wait for the pixel queue to drain and a townsperson to
// complete a move, then close-up screenshot (the sprite-orientation
// doctrine on the floating-origin host). Positions from __people are
// WORLD-space (already through the live translation).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto('http://localhost:5199/play/?shot&world&tod=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 300000 });
console.log('stream idle, pixels:', await page.evaluate(() => window.__builtCount()));
console.log('townDebug:', await page.evaluate(() => window.__townDebug()));
// Drop the fly cam INTO the city center so spawns can land around
// the player (the pool spawns relative to the player's nav cell).
const dbg = JSON.parse(await page.evaluate(() => window.__townDebug()));
if (!dbg.pixels.length) { console.log('NO POPULATED PIXELS'); process.exit(1); }
const px0 = dbg.pixels[0];
const center = [px0.origin[0] + px0.navW * 0.8, px0.origin[1] + 1.7, px0.origin[2] + px0.navH * 0.8];
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.05), center);
console.log('posed at city center', center.map((v) => v.toFixed(1)));
page.on('crash', () => console.log('[CRASH] page crashed'));
const readPeople = async () => {
  const raw = await page.evaluate(() => (window.__people ? window.__people() : '[]'));
  return JSON.parse(raw || '[]') ?? [];
};
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const arr = await readPeople();
  console.log(`t+${(i + 1) * 5}s people=${arr.length} visible=${arr.filter((p) => p.visible).length} moved=${arr.filter((p) => p.moves > 0).length} dbg=${await page.evaluate(() => (window.__townDebug ? window.__townDebug() : '{}'))} first=${JSON.stringify(arr[0] ?? null)}`);
  if (arr.some((p) => p.visible && p.moves > 0)) break;
}
const live = (await readPeople()).find((p) => p.visible && p.moves > 0);
if (!live) { console.log('NO LIVE WALKER'); process.exit(1); }
// Re-read RIGHT before posing (walkers wander during waits).
const fresh = (await readPeople()).find((p) => p.i === live.i && p.pixel === live.pixel);
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.05), [fresh.pos[0], fresh.pos[1] + 1.4, fresh.pos[2] + 2.2]);
const f0 = await page.evaluate(() => window.__frame);
await page.waitForFunction((n) => window.__frame > n + 2, f0, { timeout: 120000 });
await page.screenshot({ path: '/home/claude/world-town-closeup.png' });
const after = (await readPeople()).find((p) => p.i === live.i && p.pixel === live.pixel);
console.log('closeup of archive', live.archive, 'now:', JSON.stringify(after));
await browser.close(); await server.close();
