// T3d probe: the STREAMING host's Where-is - boot ?world&play at
// Daggerfall city, talk to a walker, W (where is), pick a category
// and a building, and read the classic direction answer live (the
// directory swapped in by the location-pixel tracker).
//
// ROAD-E E8: THE OPENING BOXES ARE DRAINED BEFORE ANYTHING IS ASKED
// OF THE WORLD. This probe used to report NO LIVE WALKER against a
// host that was fine. A modal holds the motor - every host returns at
// its overlay gate before the frame body - so while the quest arc's
// boot boxes are up the town does not tick AT ALL, nobody walks, and
// the 60x5s poll below runs out against a frozen world. firstHourProbe
// learned this the same way (tools/firstHourProbe.mjs:245-256, :427-432)
// and drains them the way a player does; this is that drain. Escape
// first because the boxes here are read-and-dismiss, Enter after in
// case one wants a button.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1955-1957) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5199/play/?shot&world&play&tod=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 300000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
const talk = async () => JSON.parse(await page.evaluate(() => window.__talk()));

// The drain. `overlay` is townTalk's live slot (townTalk.js:1183), so
// this asks the host what is up rather than guessing at names.
let drained = 0;
for (let i = 0, quiet = 0; i < 30 && quiet < 2; i++) {
  if ((await talk()).overlay) { quiet = 0; drained++; await press('Escape'); await press('Enter'); } else quiet++;
  await waitFrames(1);
}
if ((await talk()).overlay) { console.log('AN OPENING BOX WILL NOT CLOSE - the world stays frozen'); process.exit(1); }
console.log('opening boxes drained:', drained);

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
const p = (await readPeople()).find((q) => q.visible && q.moves > 0);
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, 0, 0), [p.pos[0], p.pos[1] + 0.1, p.pos[2] - 1.6]);
await waitFrames(12);
await press('KeyE');
const greet = await talk();
console.log('greeting:', JSON.stringify(greet));
if (!greet.overlay) { console.log('NO TALK WINDOW'); process.exit(1); }
// E8: the assertions read the LIVE window's own state, which the
// native talk window carries and the keyed one does not - topicMode
// walks none -> categories -> buildings (ui/nativeTalk.js:331, :384-389).
await press('KeyW');
const cats = await talk();
console.log('categories:', JSON.stringify({ mode: cats.topicMode, count: cats.topicCount }));
await press('Digit1');
const blds = await talk();
console.log('buildings:', JSON.stringify({ mode: blds.topicMode, count: blds.topicCount }));
await press('Digit1');
const ans = await talk();
console.log('answer:', JSON.stringify(ans));
await page.screenshot({ path: '/home/claude/world-whereis-answer.png' });
if (!ans.overlayText || ans.buildings === 0) { console.log('NO ANSWER'); process.exit(1); }
console.log('STREAMING WHERE-IS OK');
await browser.close(); await server.close();
