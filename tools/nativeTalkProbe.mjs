// U8b probe: the NATIVE talk window live - E on a walker opens
// TALK01I0.IMG; mouse clicks drive the verbatim hit rects (Where is
// -> category -> building -> the answer in the conversation panel).
// U10: ?class=16 is the HEADLESS chargen skip. S3c put the chargen
// overlay on a fresh town boot and wedged this probe too - AUDIT 17f
// found three of the six, this is the rest.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
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
let t = await talk();
console.log('opened:', JSON.stringify({ native: t.native, text: t.overlayText, tone: t.tone }));
if (!t.native) { console.log('NOT THE NATIVE WINDOW'); process.exit(1); }
await waitFrames(3);
await page.screenshot({ path: '/home/claude/talk-native.png' });
// virtual -> screen for the 1400x900 canvas: s=4, ox=60, oy=50
const S = 4, OX = 60, OY = 50;
const click = async (vx, vy) => { await page.mouse.click(OX + vx * S, OY + vy * S); await waitFrames(3); };
await click(57, 19);    // the Where is button
t = await talk();
console.log('after Where is:', JSON.stringify({ topicMode: t.topicMode, topics: t.topicCount }));
if (t.topicMode !== 'categories') { console.log('CATEGORIES DID NOT OPEN'); process.exit(1); }
await click(50, 75);    // topic row 1
t = await talk();
console.log('after category:', JSON.stringify({ topicMode: t.topicMode, topics: t.topicCount }));
if (t.topicMode !== 'buildings') { console.log('BUILDINGS DID NOT OPEN'); process.exit(1); }
await click(50, 75);    // building row 1 -> the answer
t = await talk();
console.log('answer:', JSON.stringify(t.overlayText));
if (!t.overlayText || t.overlayText === 'Yes?') { console.log('NO ANSWER APPENDED'); }
await waitFrames(3);
await page.screenshot({ path: '/home/claude/talk-native-answer.png' });
// the Blunt tone radio, then goodbye
await click(260, 40);
t = await talk();
console.log('tone after radio:', t.tone);
await click(150, 188);
t = await talk();
console.log('after goodbye, overlay:', t.overlay);
if (t.overlay) { console.log('DID NOT CLOSE'); process.exit(1); }
console.log('NATIVE TALK OK');
await browser.close(); await server.close();
