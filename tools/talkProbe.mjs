// T3b probe: walk-mode exterior, pose face-to-face with a live
// townsperson, press E (default grab mode talks a mobile NPC), and
// screenshot the greeting window. Also proves F1 steal mode + the
// pickpocket HUD line.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1046-1047) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const readPeople = async () => JSON.parse(await page.evaluate(() => window.__people()));
let live = null;
for (let i = 0; i < 60 && !live; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  live = (await readPeople()).find((p) => p.visible && p.moves > 0);
}
if (!live) { console.log('NO LIVE WALKER'); process.exit(1); }
// Face-to-face: pose near, let the politeness idle freeze them, then
// re-aim at the LIVE position and hold E across real frames (a bare
// press can fall between rAFs).
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const aimAndUse = async () => {
  const p = (await readPeople()).find((q) => q.visible && q.moves > 0);
  if (!p) return false;
  await page.evaluate(([x, y, z]) => window.__pose(x, y, z, 0, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] - 1.6]);
  await waitFrames(12);   // the politeness idle freezes the subject
  const q = (await readPeople()).find((r) => r.i === p.i);
  const yaw = Math.atan2(q.pos[0] - p.pos[0], q.pos[2] - (p.pos[2] - 1.6));
  await page.evaluate(([x, y, z, yw]) => window.__pose(x, y, z, yw, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] - 1.6, yaw]);
  await waitFrames(2);
  await page.keyboard.down('KeyE');
  await waitFrames(4);
  await page.keyboard.up('KeyE');
  return true;
};
console.log('talk state before:', await page.evaluate(() => window.__talk()));
await aimAndUse();
await page.waitForFunction(() => JSON.parse(window.__talk()).overlay === true, null, { timeout: 30000 })
  .catch(() => console.log('overlay did not open; talk:', ''));
console.log('talk state after E:', await page.evaluate(() => window.__talk()));
const f1 = await page.evaluate(() => window.__frame);
await page.waitForFunction((n) => window.__frame > n + 3, f1, { timeout: 60000 });
await page.screenshot({ path: '/home/claude/talk-window.png' });
// Goodbye, then steal mode: F1 + E on a person = pickpocket.
await page.keyboard.press('Escape');
await waitFrames(2);
await page.keyboard.press('F1');
await waitFrames(2);
if (await aimAndUse()) {
  await waitFrames(3);
  await page.screenshot({ path: '/home/claude/talk-pickpocket.png' });
  console.log('after pickpocket:', await page.evaluate(() => window.__talk()),
    'gold:', await page.evaluate(() => JSON.stringify(window.__playerEntity?.items ?? [])),
    'crime:', await page.evaluate(() => window.__playerEntity?.crimeCommitted ?? null));
}
await browser.close(); await server.close();
