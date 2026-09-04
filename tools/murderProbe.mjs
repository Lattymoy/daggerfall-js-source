// G4 probe: unsheathe, strike a wandering civilian - one hit kills,
// the crime lands as Murder (5), and the city watch answers.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1953-1955) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const readPeople = async () => JSON.parse(await page.evaluate(() => window.__people()));
let live = null;
for (let i = 0; i < 60 && !live; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  live = (await readPeople()).find((p) => p.visible && p.moves > 0 && !p.guard);
}
if (!live) { console.log('NO LIVE WALKER'); process.exit(1); }
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
await press('KeyZ');   // ReadyWeapon - the swing needs an unsheathed blade
// Strike attempts: re-pose into reach right before each click (the
// target wanders during SwiftShader's slow frames).
let crime = 0;
for (let i = 0; i < 10 && !crime; i++) {
  const p = (await readPeople()).find((q) => q.visible && q.moves > 0);
  if (!p) break;
  await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] + 1.2]);
  await waitFrames(2);
  await page.evaluate(() => window.__attack());
  await waitFrames(20);   // the machine reaches the strike frame
  crime = await page.evaluate(() => window.__playerEntity.crimeCommitted ?? 0);
  console.log(`swing ${i}: crime = ${crime}`);
}
if (crime !== 5) { console.log('NO MURDER CRIME'); process.exit(1); }
await page.waitForFunction(() => JSON.parse(window.__guards()).length > 0, null, { timeout: 60000 });
console.log('murder registered; the watch:', await page.evaluate(() => window.__guards()));
await page.screenshot({ path: '/home/claude/murder-response.png' });
console.log('MURDER OK');
await browser.close(); await server.close();
