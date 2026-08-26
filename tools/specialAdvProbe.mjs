// U20b probe: the SPECIAL ADVANTAGES / DISADVANTAGES window driven
// live by clicks - the window opening over the builder, a pick with a
// secondary, the difficulty DAGGER moving because of it, a label click
// removing the pick, and the built career carrying the flags out.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5204, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exitCode = 1; });
await page.goto('http://localhost:5204/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await page.waitForFunction(() => window.__chargenFlow?.() != null, null, { timeout: 60000 });
const M = { s: 4, ox: 60, oy: 50 };
const click = async (vx, vy) => { await page.mouse.click(M.ox + vx * M.s, M.oy + vy * M.s); await waitFrames(3); };
const dbl = async (vx, vy) => { await page.mouse.click(M.ox + vx * M.s, M.oy + vy * M.s, { clickCount: 2, delay: 20 }); await waitFrames(3); };
const key = async (k) => { await page.keyboard.press(k); await waitFrames(2); };
const st = async () => JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow(); const c = f.custom;
  return JSON.stringify({
    state: f.state, sub: c?.sub ?? null, pickList: c?.pickList ?? null, pickPrimary: c?.pickPrimary ?? null,
    adv: c?.advantages ?? null, dis: c?.disadvantages ?? null,
    advAdj: c?.advantageAdjust ?? null, disAdj: c?.disadvantageAdjust ?? null,
    difficulty: f.customDifficulty?.() ?? null, rows: (c?._advRows ?? []).map((r) => [r.text, r.y]),
    career: f.customCareer && { immunityFlags: f.customCareer.immunityFlags, mult: f.customCareer.advancementMultiplier },
  });
}));
const die = (m, x) => { console.log('FAIL:', m, x ?? ''); process.exit(1); };

// ---- down to the builder ----
let yes = null;
for (let i = 0; i < 20 && !yes; i++) {
  await click(110, 95);
  yes = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._raceBox?.buttons?.[0]?.rect ?? null)));
  if (!yes) await waitFrames(5);
}
await click(yes[0] + 4, yes[1] + 4);
const female = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._genderBox?.buttons?.[1]?.rect ?? null)));
await click(female[0] + 4, female[1] + 4);
await click(68 + 8 + 80, 28 + 41 + 20);
const PICK = { ox: 60, oy: 36 };
for (let i = 0; i < 18; i++) await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
const rowH = await page.evaluate(() => window.__chargenFlow()._classRowH ?? 7);
await dbl(PICK.ox + 26 + 60, PICK.oy + 27 + 8 * rowH + 2);
if ((await st()).state !== 'customClass') die('THE BUILDER DID NOT OPEN');

const before = (await st()).difficulty;
// ---- the ADVANTAGES button (CUSTOM_ADVANTAGE 249,98,66,22) ----
await click(249 + 30, 98 + 10);
let s = await st();
if (s.sub !== 'advantage') die('THE ADVANTAGES WINDOW DID NOT OPEN', JSON.stringify(s));
await page.screenshot({ path: '/home/claude/u20b-advantages.png' });
console.log('advantages window open over the builder');

// ---- Add (80,4,72,22 in panel space; the panel is at 0,0) ----
await click(80 + 36, 4 + 11);
s = await st();
if (!s.pickList) die('THE PRIMARY PICKER DID NOT OPEN', JSON.stringify(s));
console.log('primary picker rows:', s.pickList.length, s.pickList.slice(0, 3).join('/'), '...');
if (s.pickList.length !== 11) die('THE ADVANTAGE LIST IS NOT ELEVEN', s.pickList.length);
await page.screenshot({ path: '/home/claude/u20b-primary.png' });

// pick "immunity" (index 5) - a DOUBLE click, the picker's law
const rowY = (i) => PICK.oy + 27 + i * (0 || 7) + 2;
let idx = s.pickList.indexOf('immunity');
// scroll the picker to the row with the NEXT arrow, then use it
for (let i = 0; i < idx; i++) await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
const prH = await page.evaluate(() => window.__chargenFlow().custom._rowH ?? 7);
s = await st();
const scroll = await page.evaluate(() => window.__chargenFlow().custom.pickScroll ?? 0);
await dbl(PICK.ox + 26 + 60, PICK.oy + 27 + (idx - scroll) * prH + 2);
s = await st();
if (s.pickPrimary !== 'immunity') die('THE PRIMARY PICK DID NOT REGISTER', JSON.stringify(s));
console.log('primary picked -> secondary list:', s.pickList.join('/'));
await page.screenshot({ path: '/home/claude/u20b-secondary.png' });

// pick "toFire" (index 1 of the effect list)
await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
const sc2 = await page.evaluate(() => window.__chargenFlow().custom.pickScroll ?? 0);
await dbl(PICK.ox + 26 + 60, PICK.oy + 27 + (1 - sc2) * prH + 2);
s = await st();
if (s.adv.length !== 1) die('THE PICK DID NOT LAND', JSON.stringify(s));
console.log('picked:', JSON.stringify(s.adv[0]), '| rows drawn:', JSON.stringify(s.rows));
if (s.advAdj !== 10) die('IMMUNITY SHOULD COST 10', s.advAdj);
if (s.difficulty !== before + 10) die('THE DIFFICULTY DID NOT MOVE - the U20b terms are inert', `${before} -> ${s.difficulty}`);
console.log('difficulty', before, '->', s.difficulty, '(the dagger moved because of an ADVANTAGE)');
await page.screenshot({ path: '/home/claude/u20b-picked.png' });

// ---- a label click removes it (rows are at panel y, x from 8) ----
const row0 = s.rows[0];
await click(8 + 4, row0[1] + 2);
s = await st();
if (s.adv.length !== 0) die('THE LABEL CLICK DID NOT REMOVE THE ITEM', JSON.stringify(s));
if (s.difficulty !== before) die('THE TALLY DID NOT FOLLOW THE REMOVAL', s.difficulty);
console.log('label click removed it; difficulty back to', s.difficulty);

// ---- re-add, exit, and carry it out of the builder ----
await click(80 + 36, 4 + 11);
for (let i = 0; i < idx; i++) await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
const sc3 = await page.evaluate(() => window.__chargenFlow().custom.pickScroll ?? 0);
await dbl(PICK.ox + 26 + 60, PICK.oy + 27 + (idx - sc3) * prH + 2);
await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
const sc4 = await page.evaluate(() => window.__chargenFlow().custom.pickScroll ?? 0);
await dbl(PICK.ox + 26 + 60, PICK.oy + 27 + (1 - sc4) * prH + 2);
// exit the window (6,179,155,13)
await click(6 + 70, 179 + 6);
s = await st();
if (s.sub !== null) die('THE EXIT BUTTON DID NOT CLOSE THE WINDOW', JSON.stringify(s));
console.log('window closed; advantage kept:', JSON.stringify(s.adv[0]), 'difficulty', s.difficulty);

// fill the rest of the class and leave the builder
const SKILL_RECTS = JSON.parse(await page.evaluate(async () => {
  const m = await import('/src/ui/chargenArt.js'); return JSON.stringify(m.CUSTOM_SKILL_RECTS);
}));
for (let i = 0; i < 12; i++) {
  let set = false;
  for (let a = 0; a < 4 && !set; a++) {
    if ((await page.evaluate(() => window.__chargenFlow().custom.sub)) !== 'skillPick') await click(SKILL_RECTS[i][0] + 40, SKILL_RECTS[i][1] + 4);
    await dbl(PICK.ox + 26 + 60, PICK.oy + 27 + 2);
    set = (await page.evaluate(() => window.__chargenFlow().custom.skills.filter((x) => x != null).length)) === i + 1;
  }
  if (!set) die(`SKILL ${i} DID NOT LAND`);
}
for (const ch of 'Scout') await key(ch === ch.toUpperCase() ? `Shift+${ch}` : ch);
await click(263 + 10, 172 + 10);
s = await st();
if (!s.career) die('THE BUILDER DID NOT EXIT', JSON.stringify(s));
console.log('built career:', JSON.stringify(s.career));
if (s.career.immunityFlags !== 8) die('PARSECAREERDATA DID NOT WRITE THE IMMUNITY (Fire = 8)', s.career.immunityFlags);
console.log('\nU20b PROBE PASSED: the window edits the list, the dagger follows it, and the flags reach the career.');
await browser.close();
await server.close();
