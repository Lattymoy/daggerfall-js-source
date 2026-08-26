// T3f probe: the tone cycle on the live talk window - greet, cycle
// T (Normal -> Blunt -> Polite), and re-ask Where-is under a new
// tone; the label tracks and the toned answer still renders.
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
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
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
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
const talk = async () => JSON.parse(await page.evaluate(() => window.__talk()));
const p = (await readPeople()).find((q) => q.visible && q.moves > 0);
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, 0, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] - 1.6]);
await waitFrames(12);
await press('KeyE');
const greet = await talk();
console.log('greeting:', JSON.stringify({ text: greet.overlayText, opts: greet.overlayOptions, tone: greet.tone }));
if (!greet.overlayOptions?.some((o) => o.includes('tone: Normal'))) { console.log('NO TONE BUTTON'); process.exit(1); }
await press('KeyT');   // Normal -> Blunt
const blunt = await talk();
console.log('after T:', JSON.stringify({ opts: blunt.overlayOptions, tone: blunt.tone }));
if (blunt.tone !== 'Blunt') { console.log('TONE DID NOT CYCLE'); process.exit(1); }
await press('KeyW');
await press('Digit1');
await press('Digit1');
const ans = await talk();
console.log('blunt answer:', JSON.stringify({ text: ans.overlayText, tone: ans.tone, session: ans.toneSession }));
await page.screenshot({ path: '/home/claude/tone-answer.png' });
if (!ans.overlayText) { console.log('NO ANSWER'); process.exit(1); }
if (!(ans.toneSession[2] !== 0)) { console.log('BLUNT REACTION NOT CACHED'); process.exit(1); }
console.log('TONE OK');
await browser.close(); await server.close();
