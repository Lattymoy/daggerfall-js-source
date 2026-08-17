// T3d probe: the STREAMING host's Where-is - boot ?world&play at
// Daggerfall city, talk to a walker, W (where is), pick a category
// and a building, and read the classic direction answer live (the
// directory swapped in by the location-pixel tracker).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
await page.goto('http://localhost:5199/?shot&world&play&tod=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 300000 });
const dbg = JSON.parse(await page.evaluate(() => window.__townDebug()));
if (!dbg.pixels.length) { console.log('NO POPULATED PIXELS'); process.exit(1); }
const px0 = dbg.pixels[0];
const center = [px0.origin[0] + px0.navW * 0.8, px0.origin[1] + 2, px0.origin[2] + px0.navH * 0.8];
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.05), center);
console.log('posed at city center; talk:', await page.evaluate(() => window.__talk()));
const readPeople = async () => JSON.parse(await page.evaluate(() => window.__people()) || '[]') ?? [];
let live = null;
for (let i = 0; i < 60 && !live; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  live = (await readPeople()).find((p) => p.visible && p.moves > 0);
}
if (!live) { console.log('NO LIVE WALKER'); process.exit(1); }
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
const talk = async () => JSON.parse(await page.evaluate(() => window.__talk()));
const p = (await readPeople()).find((q) => q.visible && q.moves > 0);
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, 0, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] - 1.6]);
await waitFrames(12);
await press('KeyE');
console.log('greeting:', JSON.stringify(await talk()));
await press('KeyW');
console.log('categories:', JSON.stringify(await talk()));
await press('Digit1');
console.log('buildings:', JSON.stringify(await talk()));
await press('Digit1');
const ans = await talk();
console.log('answer:', JSON.stringify(ans));
await page.screenshot({ path: '/home/claude/world-whereis-answer.png' });
if (!ans.overlayText || ans.buildings === 0) { console.log('NO ANSWER'); process.exit(1); }
console.log('STREAMING WHERE-IS OK');
await browser.close(); await server.close();
