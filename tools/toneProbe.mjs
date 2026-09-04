// T3f probe: the tone cycle on the live talk window - greet, cycle
// T (Normal -> Blunt -> Polite), and re-ask Where-is under a new
// tone; the selection tracks and the toned answer still renders.
//
// ROAD-E E8 PORTED IT ACROSS THE WINDOW. This probe was written
// against the KEYED talk window and asserted on a text option row
// naming the tone, read out of `overlayOptions`. B5-6's native window
// (ui/nativeTalk.js) draws the tone as ART - three 6x6 radios at
// (258,18/28/38), the selection a flat toggleColor fill (:63-65,
// :545-547) - so there IS no text row to find and the probe failed on
// a window that was working. The DRIVE is unchanged, because the keys
// are: KeyT is the tone cycle (nativeTalk.js:431), KeyW opens the
// where-is categories (:430) and a digit uses a visible row (:435).
// What moved is what is READ: `native` (townTalk.js:1185, true only
// when the art window is up), `tone`, and the ABSENCE of
// `overlayOptions` - which is the positive statement that the window
// under the keys is the native one and not the keyed fallback.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1955-1957) - swallows every
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
console.log('greeting:', JSON.stringify({ text: greet.overlayText, native: greet.native, opts: greet.overlayOptions, tone: greet.tone }));
if (!greet.native) { console.log('NOT THE NATIVE TALK WINDOW'); process.exit(1); }
if (greet.overlayOptions) { console.log('KEYED OPTION ROWS ARE UP - the art window did not mount'); process.exit(1); }
if (greet.tone !== 'Normal') { console.log(`TONE DOES NOT START NORMAL: ${greet.tone}`); process.exit(1); }
await press('KeyT');   // Normal -> Blunt
const blunt = await talk();
console.log('after T:', JSON.stringify({ native: blunt.native, tone: blunt.tone }));
if (blunt.tone !== 'Blunt') { console.log('TONE DID NOT CYCLE'); process.exit(1); }
await press('KeyW');
const cats = await talk();
console.log('categories:', JSON.stringify({ mode: cats.topicMode, count: cats.topicCount }));
if (cats.topicMode !== 'categories') { console.log(`WHERE-IS DID NOT OPEN: ${cats.topicMode}`); process.exit(1); }
await press('Digit1');
const blds = await talk();
console.log('buildings:', JSON.stringify({ mode: blds.topicMode, count: blds.topicCount }));
if (blds.topicMode !== 'buildings') { console.log(`CATEGORY DID NOT OPEN: ${blds.topicMode}`); process.exit(1); }
await press('Digit1');
const ans = await talk();
console.log('blunt answer:', JSON.stringify({ text: ans.overlayText, tone: ans.tone, session: ans.toneSession }));
await page.screenshot({ path: '/home/claude/tone-answer.png' });
if (!ans.overlayText) { console.log('NO ANSWER'); process.exit(1); }
if (!(ans.toneSession[2] !== 0)) { console.log('BLUNT REACTION NOT CACHED'); process.exit(1); }
console.log('TONE OK');
await browser.close(); await server.close();
