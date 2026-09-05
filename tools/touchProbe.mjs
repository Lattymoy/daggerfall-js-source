// T3-touch probe: boot the exterior in a touch-emulating context and
// prove the mobile interaction path - the mode-cycle button flips
// __talk.mode (grab -> info per the verbatim NextInteractionMode
// order), and E (the same synthetic-key seam the E button drives)
// opens AND closes the talk window.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:2072-2074) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
// The touch UI must exist with the mode button labeled by the LIVE mode
const btns = await page.evaluate(() =>
  [...document.querySelectorAll('#touch-ui div')].map((d) => d.textContent).filter((t) => t && t.length <= 4));
console.log('touch buttons:', JSON.stringify(btns));
if (!btns.includes('grab')) { console.log('NO MODE BUTTON'); process.exit(1); }
// Tap the mode button twice: grab -> info -> dialogue
const box = await (await page.locator('#touch-ui div', { hasText: 'grab' }).first()).boundingBox();
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
console.log('after tap 1:', await page.evaluate(() => window.__talk()));
const box2 = await (await page.locator('#touch-ui div', { hasText: 'info' }).first()).boundingBox();
await page.touchscreen.tap(box2.x + box2.width / 2, box2.y + box2.height / 2);
console.log('after tap 2:', await page.evaluate(() => window.__talk()));
// E opens then CLOSES the window (the same synthetic seam as the E button)
const readPeople = async () => JSON.parse(await page.evaluate(() => window.__people()));
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
const p = (await readPeople()).find((q) => q.visible && q.moves > 0);
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, 0, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] - 1.6]);
await waitFrames(12);
await page.keyboard.down('KeyE'); await waitFrames(4); await page.keyboard.up('KeyE');
await waitFrames(2);
console.log('after E (dialogue mode):', await page.evaluate(() => window.__talk()));
await page.keyboard.down('KeyE'); await waitFrames(3); await page.keyboard.up('KeyE');
console.log('after second E (goodbye):', await page.evaluate(() => window.__talk()));
await page.screenshot({ path: '/home/claude/touch-ui.png' });
await browser.close(); await server.close();
