// U14 probe: the whole chargen flow driven by CLICKS alone, and the
// MENU BACKDROP behind it. Classic runs chargen from the menu with a
// black parent panel (DaggerfallBaseWindow.cs:40); the port ran it
// in-world and let the town show through the letterbox, and several
// screens were keyboard-only.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await page.waitForFunction(() => window.__chargenFlow?.() != null, null, { timeout: 60000 });
// the native mapping at 1400x900
const M = { s: 4, ox: 60, oy: 50 };
const click = async (vx, vy) => { await page.mouse.click(M.ox + vx * M.s, M.oy + vy * M.s); await waitFrames(3); };
const st = async () => JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow();
  return JSON.stringify({ state: f.state, race: f.race?.key, gender: f.gender, face: f.faceIndex,
    cls: f.classIndex, q: f.biogQuestionIndex, pool: f.statPool ?? null, reflexes: f.reflexes });
}));

// the name screen needs typed letters (classic types a name too); the
// OK button is the click under test
for (const c of 'MAC') await page.keyboard.press(c);
await click(283, 183);                       // OK (263,172,39,22)
if ((await st()).state !== 'race') { console.log('NAME OK BUTTON DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-race.png' });

await click(110, 95);                        // Hammerfell -> Redguard + the confirm box
let s = await st();
if (s.race !== 'Redguard') { console.log('PROVINCE CLICK DEAD', s.race); process.exit(1); }
// YES on the confirm box
const yes = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._raceBox?.buttons?.[0]?.rect ?? null)));
if (!yes) { console.log('RACE CONFIRM BOX MISSING'); process.exit(1); }
await click(yes[0] + 4, yes[1] + 4);
s = await st();
if (s.state !== 'gender') { console.log('RACE YES DEAD', JSON.stringify(s)); process.exit(1); }

// gender: the FEMALE button of the parchment box
const female = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._genderBox?.buttons?.[1]?.rect ?? null)));
await click(female[0] + 4, female[1] + 4);
// the button SETS and CLOSES - classic has no OK on this box
let g = await st();
if (g.gender !== 'female') { console.log('GENDER CLICK DEAD'); process.exit(1); }
if (g.state !== 'face') { console.log('GENDER BUTTON DID NOT CLOSE THE BOX', JSON.stringify(g)); process.exit(1); }

await click(300, 73);                        // NEXT face (287,69,26,9)
if ((await st()).face !== 1) { console.log('FACE NEXT DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-face.png' });
await click(283, 183);                       // OK -> class
if ((await st()).state !== 'class') { console.log('FACE OK DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-class.png' });

// the class list: click the third visible row
const rowH = await page.evaluate(() => window.__chargenFlow()._classRowH ?? 0);
const pickOx = await page.evaluate(() => Math.floor((320 - 190) / 2));   // PICK00I0 is 190 wide
await click(pickOx + 60, 65 + Math.floor(rowH * 2.5) - rowH * 2 + 2 * rowH);
s = await st();
console.log('class after a row click:', s.cls);
await page.keyboard.press('Enter');          // confirm the class (no OK button on the picker)
await waitFrames(3);
if ((await st()).state !== 'biography') { console.log('CLASS CONFIRM DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-biography.png' });

// the biography: click answer button 0 twelve times (149x24 from 10,71)
for (let i = 0; i < 12; i++) {
  if ((await st()).state !== 'biography') break;
  const box = await page.evaluate(() => JSON.stringify(window.__chargenFlow().biogRepBox ?? null));
  if (box !== 'null') break;
  await click(10 + 60, 71 + 12);
}
// the reputation box closes on a click anywhere
if (await page.evaluate(() => !!window.__chargenFlow().biogRepBox)) await click(160, 100);
s = await st();
if (s.state !== 'stats') { console.log('BIOGRAPHY CLICKS DID NOT FINISH', JSON.stringify(s)); process.exit(1); }
console.log('biography finished by clicks; stat pool', s.pool);

// stats: spend the pool on the spinner's UP half (44, 21 + 22*cursor)
for (let i = 0; i < 20 && (await st()).pool > 0; i++) await click(44 + 7, 21 + 3);
if ((await st()).pool !== 0) { console.log('STAT SPINNER CLICK DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-stats.png' });
await click(283, 183);                       // OK -> skills
if ((await st()).state !== 'skills') { console.log('STATS OK DEAD'); process.exit(1); }

// skills: the RIGHT half of the left-right spinner on each group row
const spend = async (top) => { for (let i = 0; i < 8; i++) await click(203 + 30, top + 4); };
await spend(31);                             // primary row 0
await click(68 + 20, 81); await spend(80);   // major row 0
await click(68 + 20, 130); await spend(129); // minor row 0
await click(283, 183);                       // OK -> reflexes
s = await st();
if (s.state !== 'reflexes') { console.log('SKILLS NOT FINISHED BY CLICKS', JSON.stringify(s)); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-reflexes.png' });

await click(127 + 30, 148 + 4);              // VERY HIGH row
if ((await st()).reflexes !== 0) { console.log('REFLEX ROW CLICK DEAD'); process.exit(1); }
await click(283, 183);                       // OK -> done
await waitFrames(6);
const e = await page.evaluate(() => ({ done: !!window.__playerEntity.chargenDone, race: window.__playerEntity.race,
  gender: window.__playerEntity.gender, reflexes: window.__playerEntity.reflexes }));
console.log('entity after a CLICK-ONLY chargen:', JSON.stringify(e));
if (!e.done) { console.log('CHARGEN DID NOT COMPLETE BY CLICKS'); process.exit(1); }
if (e.reflexes !== 0) { console.log('REFLEX PICK LOST', e.reflexes); process.exit(1); }
console.log('CLICK CHARGEN OK');
await browser.close(); await server.close();
