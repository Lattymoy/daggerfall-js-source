// U20a probe: the CUSTOM-CLASS BUILDER driven live, by clicks. The
// last chargen screen the port did not have - CreateCharCustomClass
// with its skill pickers, HP spinner, difficulty dagger, reputation
// window and four exit gates, then the built class carried all the
// way onto the player entity.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exitCode = 1; });
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await page.waitForFunction(() => window.__chargenFlow?.() != null, null, { timeout: 60000 });
const M = { s: 4, ox: 60, oy: 50 };                 // the native mapping at 1400x900
const click = async (vx, vy) => { await page.mouse.click(M.ox + vx * M.s, M.oy + vy * M.s); await waitFrames(3); };
const key = async (k) => { await page.keyboard.press(k); await waitFrames(2); };
const st = async () => JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow();
  const c = f.custom;
  return JSON.stringify({
    // AUDIT 17m: the PICKER's row and the DOCUMENT's class are two
    // fields now - the row name comes from the picker, the affinity
    // (`cls`) from the document.
    state: f.state, cls: f.classIndex, row: f.classListIndex, rows: f.classRowCount(),
    rowName: f.classRowName(f.classListIndex),
    isCustom: f.isCustom, careerName: f.career?.name ?? null, reps: f.customReps,
    custom: c && { name: c.className, hp: c.hp, skills: c.skills.filter((s) => s != null).length,
      pool: c.statPool, sub: c.sub, box: !!c.box, reps: c.reps, difficulty: f.customDifficulty() },
  });
}));
const die = (msg, extra) => { console.log(msg, extra ?? ''); process.exit(1); };

// ---- the classic walk down to the class list ----
// the province click is dropped until the ART is up (clickNative
// gates on it), so retry rather than racing the loader
let yes = null;
for (let i = 0; i < 20 && !yes; i++) {
  await click(110, 95);                             // Hammerfell -> Redguard + the confirm box
  yes = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._raceBox?.buttons?.[0]?.rect ?? null)));
  if (!yes) await waitFrames(5);
}
if (!yes) die('RACE CONFIRM BOX MISSING');
await click(yes[0] + 4, yes[1] + 4);
const female = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._genderBox?.buttons?.[1]?.rect ?? null)));
await click(female[0] + 4, female[1] + 4);          // -> U18's class-method screen
await click(68 + 8 + 80, 28 + 41 + 20);             // "choose from a list" -> the picker
let s = await st();
if (s.state !== 'class') die('DID NOT REACH THE CLASS LIST', JSON.stringify(s));
console.log('class list rows:', s.rows, '(18 careers + Custom)');
if (s.rows !== 19) die('THE CUSTOM ROW IS MISSING', s.rows);

// ---- the Custom row: 18 clicks on the picker's NEXT arrow ----
const PICK = { ox: 60, oy: 36 };                    // PICK00I0 is 200x128, Center/Middle
for (let i = 0; i < 18; i++) await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
s = await st();
console.log('after 18 next-clicks:', s.cls, s.rowName);
if (s.rowName !== 'Custom') die('THE ARROW WALK DID NOT REACH CUSTOM', JSON.stringify(s));
await page.screenshot({ path: '/home/claude/custom-list.png' });
// the row sits at the bottom of the 9-row window; USE it with a double click
const rowH = await page.evaluate(() => window.__chargenFlow()._classRowH ?? 7);
const rowY = PICK.oy + 27 + 8 * rowH + 2;
await page.mouse.click(M.ox + (PICK.ox + 26 + 60) * M.s, M.oy + rowY * M.s, { clickCount: 2, delay: 20 });
await waitFrames(3);
s = await st();
if (s.state !== 'customClass') die('THE CUSTOM ROW DID NOT OPEN THE BUILDER', JSON.stringify(s));
console.log('builder opened at the DFU defaults:', JSON.stringify(s.custom));
await page.screenshot({ path: '/home/claude/custom-builder.png' });   // U20a: CUST00I0

// ---- the twelve skill buttons, each through its own picker ----
const SKILL_RECTS = JSON.parse(await page.evaluate(async () => {
  const m = await import('/src/ui/chargenArt.js');
  return JSON.stringify(m.CUSTOM_SKILL_RECTS);
}));
for (let i = 0; i < 12; i++) {
  await click(SKILL_RECTS[i][0] + 40, SKILL_RECTS[i][1] + 4);   // open the picker
  const sub = (await st()).custom.sub;
  if (sub !== 'skillPick') die(`SKILL BUTTON ${i} DID NOT OPEN THE PICKER`, sub);
  if (i === 0) await page.screenshot({ path: '/home/claude/custom-skillpick.png' });
  // a DaggerfallListPickerWindow picks from the ListBox's
  // OnUseSelectedItem, so the row takes a DOUBLE click (U17's law,
  // which the extracted picker now carries)
  const rx = M.ox + (PICK.ox + 26 + 60) * M.s, ry = M.oy + (PICK.oy + 27 + 2) * M.s;
  await page.mouse.click(rx, ry);
  if ((await st()).custom.skills !== i) die(`SINGLE CLICK PICKED A SKILL at ${i}`);
  await page.mouse.click(rx, ry, { clickCount: 2, delay: 20 });
  await waitFrames(3);
  const after = (await st()).custom;
  if (after.skills !== i + 1) die(`SKILL PICK ${i} DID NOT LAND`, JSON.stringify(after));
}
console.log('twelve skills set by clicks');

// ---- the HP spinner moves the difficulty dagger ----
const before = (await st()).custom.difficulty;
for (let i = 0; i < 6; i++) await click(252 + 4, 46 + 5);        // hitPointsUpButton
let c = (await st()).custom;
console.log('hp', c.hp, 'difficulty', before, '->', c.difficulty);
if (c.hp !== 14 || c.difficulty !== 6) die('THE HP SPINNER DID NOT MOVE THE DIFFICULTY', JSON.stringify(c));
for (let i = 0; i < 3; i++) await click(252 + 4, 57 + 5);        // hitPointsDownButton
c = (await st()).custom;
if (c.hp !== 11) die('THE HP DOWN ARROW IS DEAD', JSON.stringify(c));

// ---- the name (typed, as classic types it) ----
for (const ch of 'Scout') await key(ch === ch.toUpperCase() ? `Shift+${ch}` : ch);
c = (await st()).custom;
console.log('class name typed:', JSON.stringify(c.name));
if (!c.name.length) die('THE NAME BOX IS DEAD');

// ---- the stat gate: spend one point, watch OK refuse ----
await click(44 + 7, 21 + 3);                                     // the freeEdit spinner's UP half
c = (await st()).custom;
if (c.pool !== -1) die('THE FREE-EDIT SPINNER IS DEAD', JSON.stringify(c));
await click(263 + 10, 172 + 10);                                 // exit -> refused
c = (await st()).custom;
if (!c.box) die('THE UNBALANCED-POOL GATE DID NOT REFUSE', JSON.stringify(c));
await page.screenshot({ path: '/home/claude/custom-gate.png' });
await click(160, 100);                                           // ClickAnywhereToClose
await click(44 + 7, 21 + 15);                                    // spend it back
c = (await st()).custom;
if (c.pool !== 0 || c.box) die('THE POOL DID NOT REBALANCE', JSON.stringify(c));

// ---- the reputation window, with its own balance gate ----
await click(249 + 30, 146 + 10);                                 // the Reputations button
if ((await st()).custom.sub !== 'rep') die('THE REPUTATION WINDOW DID NOT OPEN');
const REP = { ox: 76, oy: 5 };                                   // CUST03I0 168x189, Center/Middle
await click(REP.ox + 10, REP.oy + 76 - 25);                      // merchants +5
await click(REP.ox + 129 + 10, REP.oy + 165 + 5);                // exit -> refused (unbalanced)
c = (await st()).custom;
if (!c.box) die('THE REP BALANCE GATE DID NOT REFUSE', JSON.stringify(c));
await page.screenshot({ path: '/home/claude/custom-rep.png' });
await click(160, 100);                                           // close the box
await click(REP.ox + 43, REP.oy + 76 + 25);                      // peasants -5
c = (await st()).custom;
console.log('reps:', JSON.stringify(c.reps));
if (c.reps.merchants !== 5 || c.reps.peasants !== -5) die('THE REP BARS DID NOT SET', JSON.stringify(c.reps));
await click(REP.ox + 129 + 10, REP.oy + 165 + 5);                // exit -> balanced, closes
if ((await st()).custom.sub !== null) die('THE BALANCED REP WINDOW WOULD NOT CLOSE');

// ---- exit: all four gates pass ----
await click(263 + 10, 172 + 10);
s = await st();
console.log('after the builder:', JSON.stringify({ state: s.state, isCustom: s.isCustom, career: s.careerName, affinity: s.cls, reps: s.reps }));
if (!s.isCustom) die('THE CUSTOM CLASS DID NOT TAKE', JSON.stringify(s));
if (s.careerName !== 'Scout') die('THE CAREER NAME IS NOT THE TYPED ONE', s.careerName);
if (JSON.stringify(s.reps) !== JSON.stringify([-5, 5, 0, 0, 0])) die('THE REPS DID NOT REACH THE DOCUMENT', JSON.stringify(s.reps));
if (s.state !== 'bioMethod') die('THE BUILDER DID NOT REACH THE BIOGRAPHY METHOD', s.state);

// ---- and out through the rest of the wizard ----
await click(68 + 8 + 80, 16 + 41 + 25);                          // generate the history
if (await page.evaluate(() => !!window.__chargenFlow().biogRepBox)) await click(160, 100);
s = await st();
if (s.state !== 'name') die('THE GENERATED BIOGRAPHY DID NOT FINISH', JSON.stringify(s));
await click(279 + 18, 3 + 5);                                    // the random name button
await click(283, 183);                                           // OK -> face
await click(283, 183);                                           // OK -> stats
for (let i = 0; i < 20 && (await page.evaluate(() => window.__chargenFlow().statPool)) > 0; i++) await click(44 + 7, 21 + 3);
await click(283, 183);                                           // OK -> skills
const spend = async (top) => { for (let i = 0; i < 8; i++) await click(203 + 30, top + 4); };
await spend(31); await click(68 + 20, 81); await spend(80); await click(68 + 20, 130); await spend(129);
await click(283, 183);                                           // OK -> reflexes
await click(127 + 30, 148 + 4);
await click(283, 183);                                           // OK -> the summary
await page.screenshot({ path: '/home/claude/custom-summary.png' });
await click(283, 183);                                           // OK -> done
await waitFrames(6);

const e = await page.evaluate(() => {
  const p = window.__playerEntity;
  return { done: !!p.chargenDone, career: p.career?.name, hpPerLevel: p.career?.hitPointsPerLevel,
    advancement: p.career?.advancementMultiplier, maxHealth: p.maxHealth,
    reps: [...(p.sGroupReputations ?? [])].slice(0, 5),
    spells: (p.spells ?? []).map((sp) => sp.name ?? sp.index), items: (p.items ?? []).map((i) => i.name) };
});
console.log('entity after a CUSTOM-CLASS chargen:', JSON.stringify(e));
if (!e.done) die('CHARGEN DID NOT COMPLETE');
if (e.career !== 'Scout') die('THE CUSTOM CAREER DID NOT REACH THE ENTITY', e.career);
if (e.hpPerLevel !== 11) die('THE BUILT HP DID NOT REACH THE ENTITY', e.hpPerLevel);
// the reps SEED the groups, then the biography effects add on top -
// so the seeded values must still be visible in the totals
if (e.reps[1] < 5) die('THE MERCHANT REPUTATION SEED WAS LOST', JSON.stringify(e.reps));
// the first twelve alphabetical skills start with Alteration, a
// MAGIC primary - so the Spellsword starting set applies
if (!e.spells.length) die('A MAGIC-PRIMARY CUSTOM CLASS GOT NO STARTING SPELLS', JSON.stringify(e.spells));
console.log('CUSTOM CLASS OK');
await browser.close(); await server.close();
