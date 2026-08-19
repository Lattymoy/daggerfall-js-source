// T4 probe: ask "where is" repeatedly until the 35% arm fires - the
// answer must switch from the 7333 compass hint to a 7332 "marked on
// your map" line, live, with the real %hnr/%ra expanded. Based on
// whereIsProbe (T3c).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
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
console.log('greeting:', JSON.stringify(await talk()));
let revealed = null, directions = 0;
for (let ask = 0; ask < 15 && !revealed; ask++) {
  await press('KeyW');          // where is... (also "ask another" on the answer window)
  await press('Digit1');        // first category
  await press('Digit1');        // first building
  const ans = await talk();
  const text = ans.overlayText ?? '';
  console.log(`ask ${ask}:`, JSON.stringify(text));
  if (/map/i.test(text)) revealed = text;
  else directions++;
}
await page.screenshot({ path: '/home/claude/map-reveal-answer.png' });
if (!revealed) { console.log(`NO REVEAL in 15 asks (${directions} direction answers) - P ~0.2%, re-run`); process.exit(1); }
console.log('REVEALED:', JSON.stringify(revealed));
console.log(`(direction answers before the reveal: ${directions})`);
await browser.close(); await server.close();
process.exit(0);
