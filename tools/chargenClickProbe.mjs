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
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00');
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
    // AUDIT 17m: `cls` is the DOCUMENT's class; `row` is the picker's
    // own selection, which is what a row click moves.
    cls: f.classIndex, row: f.classListIndex, q: f.biogQuestionIndex, pool: f.statPool ?? null, reflexes: f.reflexes,
    poolBox: !!f.summaryPoolBox, classBox: !!f.classConfirm });
}));

// U15: RACE is the FIRST screen in the classic order.
if ((await st()).state !== 'race') { console.log('RACE IS NOT THE FIRST SCREEN'); process.exit(1); }
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
// U18: the box closes onto the class-METHOD screen (BUTN01I0)
if (g.state !== 'classMethod') { console.log('GENDER BUTTON DID NOT CLOSE ONTO THE METHOD SCREEN', JSON.stringify(g)); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-method.png' });

// U18: the QUESTIONS path first - the bottom button (68+8, 28+100)
await click(68 + 8 + 80, 28 + 100 + 17);
let qs = await st();
if (qs.state !== 'classQuestions') { console.log('QUESTIONS BUTTON DEAD', JSON.stringify(qs)); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-questions.png' });
// answer all ten by CLICKING the a) row, scrolling it into the click
// band (local y 16..64) through the bottom margin when a long
// question pushes it below
const qState = async () => JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow();
  return JSON.stringify({ answered: f.qAnswered, labelY: f.qLabelY, a: f.qDisplay?.aIndex ?? null,
    weights: f.qWeights, cls: f.qClassIndex, box: !!f.qConfirm });
}));
for (let i = 0; i < 10; i++) {
  let q = await qState();
  if (q.box) break;
  let target = q.labelY + q.a * 7 + 3;
  for (let s2 = 0; s2 < 120 && target > 62; s2++) {   // one native px per margin click
    await page.mouse.click(M.ox + 160 * M.s, M.oy + (120 + 70) * M.s);
    q = await qState();
    target = q.labelY + q.a * 7 + 3;
  }
  await waitFrames(2);
  await click(160, 120 + target);
  const after = await qState();
  if (after.answered !== q.answered + 1 && !after.box) { console.log('ANSWER CLICK DEAD at question', i, JSON.stringify(after)); process.exit(1); }
  // the constellation palette-brightening, mid-run (blues 8 + 24w)
  if (after.answered === 5) await page.screenshot({ path: '/home/claude/click-questions-mid.png' });
}
let qEnd = await qState();
console.log('ten answers:', JSON.stringify(qEnd));
if (!qEnd.box) { console.log('THE CLASS DESCRIPTION BOX DID NOT OPEN'); process.exit(1); }
if (qEnd.weights[0] + qEnd.weights[1] + qEnd.weights[2] !== 10) { console.log('WEIGHTS DID NOT SUM TO TEN'); process.exit(1); }
if (qEnd.cls < 0 || qEnd.cls > 17) { console.log('NO CLASS RESOLVED', qEnd.cls); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-questions-box.png' });
// NO drops the pick and falls to the class LIST - which is exactly
// where the original walk continues
const noRect = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._qBox?.buttons?.[1]?.rect ?? null)));
if (!noRect) { console.log('NO BUTTON MISSING ON THE QUESTIONS BOX'); process.exit(1); }
await click(noRect[0] + 4, noRect[1] + 4);
g = await st();
if (g.state !== 'class') { console.log('QUESTIONS NO DID NOT FALL TO THE LIST', JSON.stringify(g)); process.exit(1); }
console.log('questions path probed: ten click-answers, box up, NO -> the list');
await page.screenshot({ path: '/home/claude/click-class.png' });

// the class list: click the third visible row
const rowH = await page.evaluate(() => window.__chargenFlow()._classRowH ?? 0);
const pickOx = await page.evaluate(() => Math.floor((320 - 190) / 2));   // PICK00I0 is 190 wide
const rowY = 65 + Math.floor(rowH * 2.5) - rowH * 2 + 2 * rowH;
await click(pickOx + 60, rowY);
s = await st();
console.log('picker row after a row click:', s.row, '(the document is still', s.cls + ')');
// U17: a SINGLE click only selects - the row must NOT pick
if (s.state !== 'class' || s.classBox) { console.log('SINGLE CLICK PICKED THE CLASS', JSON.stringify(s)); process.exit(1); }
// a DOUBLE click picks it and opens the class description box. The
// probe's own click helper waits frames between clicks, so drive the
// pair straight at the mouse to stay inside doubleClickDelay.
await page.mouse.click(M.ox + (pickOx + 60) * M.s, M.oy + rowY * M.s, { clickCount: 2, delay: 20 });
await waitFrames(3);
s = await st();
if (!s.classBox) { console.log('DOUBLE CLICK DID NOT OPEN THE CLASS BOX', JSON.stringify(s)); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-classbox.png' });
// Yes leaves the picker - by CLICK, which is the whole point: the
// picker has no OK button, so before U17 there was no pointer path
// off this screen at all.
const yesRect = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._classBox?.buttons?.[0]?.rect ?? null)));
if (!yesRect) { console.log('NO YES BUTTON ON THE CLASS BOX'); process.exit(1); }
await click(yesRect[0] + 4, yesRect[1] + 4);
// U19: the class accept lands on the BIO-METHOD screen; this probe
// clicks ANSWER QUESTIONS (the bottom button, 8,113 on the panel at
// 68,16) and keeps the manual walk - the keyboard probe takes the
// generate path.
if ((await st()).state !== 'bioMethod') { console.log('CLASS CONFIRM DID NOT REACH THE BIO-METHOD SCREEN', JSON.stringify(await st())); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-biomethod.png' });
await click(68 + 8 + 80, 16 + 113 + 20);
if ((await st()).state !== 'biography') { console.log('BIO QUESTIONS BUTTON DEAD', JSON.stringify(await st())); process.exit(1); }
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
if (s.state !== 'name') { console.log('BIOGRAPHY CLICKS DID NOT FINISH', JSON.stringify(s)); process.exit(1); }
console.log('biography finished by clicks; now at', s.state);

// U15: the RANDOM NAME button (279,3,36,10) - live now that the race
// is known, which is exactly why the classic order had to land first.
await click(279 + 18, 3 + 5);
const rolled = await page.evaluate(() => window.__chargenFlow().name);
console.log('random name:', JSON.stringify(rolled));
if (!rolled) { console.log('RANDOM NAME BUTTON DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-name.png' });
await click(283, 183);                       // OK -> face
if ((await st()).state !== 'face') { console.log('NAME OK DEAD'); process.exit(1); }
await click(300, 73);                        // NEXT face (287,69,26,9)
if ((await st()).face !== 1) { console.log('FACE NEXT DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-face.png' });
await click(283, 183);                       // OK -> stats
s = await st();
if (s.state !== 'stats') { console.log('FACE OK DEAD', JSON.stringify(s)); process.exit(1); }
console.log('stat pool', s.pool);

// stats: spend the pool on the spinner's UP half (44, 21 + 22*cursor)
for (let i = 0; i < 20 && (await st()).pool > 0; i++) await click(44 + 7, 21 + 3);
if ((await st()).pool !== 0) { console.log('STAT SPINNER CLICK DEAD'); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-stats.png' });
await click(283, 183);                       // OK -> skills
if ((await st()).state !== 'skills') { console.log('STATS OK DEAD'); process.exit(1); }

await page.screenshot({ path: '/home/claude/click-skills.png' });   // U17: all THREE group spinners
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
await click(283, 183);                       // OK -> U16's SUMMARY
s = await st();
if (s.state !== 'summary') { console.log('REFLEX OK DID NOT REACH THE SUMMARY', JSON.stringify(s)); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-summary.png' });

// U16: the summary's own controls are live. Take a stat point back
// DOWN, which is the only way to open the bonus-points gate, and check
// that OK refuses until it is spent again.
await click(44 + 7, 21 + 15);                // the spinner's DOWN half on the selected stat
let sum = await st();
if (sum.pool !== 1) { console.log('SUMMARY STAT SPINNER DEAD', JSON.stringify(sum)); process.exit(1); }
await click(283, 183);                       // OK -> refused, box up
sum = await st();
if (sum.state !== 'summary' || !sum.poolBox) { console.log('SUMMARY OK GATE DEAD', JSON.stringify(sum)); process.exit(1); }
await page.screenshot({ path: '/home/claude/click-summary-gate.png' });
await click(160, 100);                       // ClickAnywhereToClose
if ((await st()).poolBox) { console.log('SUMMARY POOL BOX WOULD NOT CLOSE'); process.exit(1); }
await click(44 + 7, 21 + 3);                 // spend it again
if ((await st()).pool !== 0) { console.log('SUMMARY RESPEND DEAD'); process.exit(1); }

// the summary's reflex picker sits at (246,95), not the reflex
// screen's (127,148) - click HIGH there and watch the pick move
await click(246 + 30, 95 + 9 + 4);
if ((await st()).reflexes !== 1) { console.log('SUMMARY REFLEX PICKER DEAD'); process.exit(1); }
await click(246 + 30, 95 + 4);               // back to VERY HIGH
if ((await st()).reflexes !== 0) { console.log('SUMMARY REFLEX PICKER DEAD (2)'); process.exit(1); }

await click(283, 183);                       // OK -> done
await waitFrames(6);
const e = await page.evaluate(() => ({ done: !!window.__playerEntity.chargenDone, race: window.__playerEntity.race,
  gender: window.__playerEntity.gender, reflexes: window.__playerEntity.reflexes }));
console.log('entity after a CLICK-ONLY chargen:', JSON.stringify(e));
if (!e.done) { console.log('CHARGEN DID NOT COMPLETE BY CLICKS'); process.exit(1); }
if (e.reflexes !== 0) { console.log('REFLEX PICK LOST', e.reflexes); process.exit(1); }
console.log('CLICK CHARGEN OK');
await browser.close(); await server.close();
