// AUDIT 17m probe: the class PICKER's row survives a finished custom
// class, driven live by clicks and keys.
//
// The defect, end to end: build a custom class, step back off the
// biography-method screen (the wizard's cancel arm, :458-461), and the
// class list used to come back with a STANDARD class highlighted -
// whichever one the biography AFFINITY walk picked - because the port
// carried DFU's two class indices in ONE field. Confirming there ran
// _acceptStandardClass and threw the built career away. DFU REUSES the
// class window (SetClassSelectWindow :158-167), so the Custom row is
// still selected and Return re-opens the builder.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5203, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exitCode = 1; });
await page.goto('http://localhost:5203/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await page.waitForFunction(() => window.__chargenFlow?.() != null, null, { timeout: 60000 });
const M = { s: 4, ox: 60, oy: 50 };
const click = async (vx, vy) => { await page.mouse.click(M.ox + vx * M.s, M.oy + vy * M.s); await waitFrames(3); };
const key = async (k) => { await page.keyboard.press(k); await waitFrames(2); };
const st = async () => JSON.parse(await page.evaluate(() => {
  const f = window.__chargenFlow();
  const c = f.custom;
  return JSON.stringify({
    state: f.state, doc: f.classIndex, row: f.classListIndex,
    rowName: f.classRowName(f.classListIndex), docName: f.careers[f.classIndex]?.name ?? null,
    isCustom: f.isCustom, careerName: f.career?.name ?? null, confirm: !!f.classConfirm,
    custom: c && { name: c.className, skills: c.skills.filter((s) => s != null).length, pool: c.statPool },
  });
}));
const die = (msg, extra) => { console.log('FAIL:', msg, extra ?? ''); process.exit(1); };

// ---- down to the class list ----
let yes = null;
for (let i = 0; i < 20 && !yes; i++) {
  await click(110, 95);
  yes = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._raceBox?.buttons?.[0]?.rect ?? null)));
  if (!yes) await waitFrames(5);
}
if (!yes) die('RACE CONFIRM BOX MISSING');
await click(yes[0] + 4, yes[1] + 4);
const female = JSON.parse(await page.evaluate(() => JSON.stringify(window.__chargenFlow()._genderBox?.buttons?.[1]?.rect ?? null)));
await click(female[0] + 4, female[1] + 4);
await click(68 + 8 + 80, 28 + 41 + 20);             // "choose from a list"
let s = await st();
if (s.state !== 'class') die('DID NOT REACH THE CLASS LIST', JSON.stringify(s));

// ---- the Custom row, and into the builder ----
const PICK = { ox: 60, oy: 36 };
for (let i = 0; i < 18; i++) await click(PICK.ox + 179 + 4, PICK.oy + 108 + 4);
s = await st();
if (s.rowName !== 'Custom') die('THE ARROW WALK DID NOT REACH CUSTOM', JSON.stringify(s));
const rowH = await page.evaluate(() => window.__chargenFlow()._classRowH ?? 7);
const rowY = PICK.oy + 27 + 8 * rowH + 2;
await page.mouse.click(M.ox + (PICK.ox + 26 + 60) * M.s, M.oy + rowY * M.s, { clickCount: 2, delay: 20 });
await waitFrames(3);
if ((await st()).state !== 'customClass') die('THE CUSTOM ROW DID NOT OPEN THE BUILDER');

// ---- the minimum a legal class needs: twelve skills and a name ----
const SKILL_RECTS = JSON.parse(await page.evaluate(async () => {
  const m = await import('/src/ui/chargenArt.js');
  return JSON.stringify(m.CUSTOM_SKILL_RECTS);
}));
// The picker takes a DOUBLE click (U17's law), and the synthesized
// pair occasionally lands outside DOUBLE_CLICK_DELAY_MS on a loaded
// machine - the row then only SELECTS and the skill does not set. That
// is the probe's timing, not the port's, so retry the pair rather than
// reporting a failure the code did not cause.
for (let i = 0; i < 12; i++) {
  const rx = M.ox + (PICK.ox + 26 + 60) * M.s, ry = M.oy + (PICK.oy + 27 + 2) * M.s;
  let set = false;
  for (let attempt = 0; attempt < 4 && !set; attempt++) {
    if ((await st()).custom.sub !== 'skillPick') await click(SKILL_RECTS[i][0] + 40, SKILL_RECTS[i][1] + 4);
    await page.mouse.click(rx, ry, { clickCount: 2, delay: 20 });
    await waitFrames(3);
    set = (await st()).custom.skills === i + 1;
  }
  if (!set) die(`SKILL PICK ${i} DID NOT LAND IN FOUR ATTEMPTS`, JSON.stringify((await st()).custom));
}
for (const ch of 'Scout') await key(ch === ch.toUpperCase() ? `Shift+${ch}` : ch);
s = await st();
if (s.custom.skills !== 12 || !s.custom.name.length) die('THE BUILDER IS NOT READY', JSON.stringify(s.custom));

// ---- the keyboard must not move the freeEdit pool (17m) ----
const poolBefore = s.custom.pool;
await key('Equal'); await key('Equal');             // '+' -> 'plus' in the overlay table
await key('Minus');                                 // '-' -> 'char:-' - types into the NAME
s = await st();
if (s.custom.pool !== poolBefore) die('THE KEYBOARD STILL SPENDS FROM THE POOL', JSON.stringify(s.custom));
if (!s.custom.name.endsWith('-')) die('THE HYPHEN DID NOT REACH THE CLASS NAME', JSON.stringify(s.custom));
console.log('keyboard: pool held at', poolBefore, '| name took the hyphen:', JSON.stringify(s.custom.name));
// take the hyphen back off so the name reads Scout again
await key('Backspace');

// ---- out of the builder ----
await click(263 + 10, 172 + 10);
s = await st();
if (s.state !== 'bioMethod') die('THE BUILDER DID NOT REACH THE BIOGRAPHY METHOD', JSON.stringify(s));
const built = s.careerName;
console.log('built:', built, '| picker row:', s.rowName, '| document class:', s.doc, `(${s.docName})`);
if (s.rowName !== 'Custom') die('THE PICKER FOLLOWED THE AFFINITY - THE 17m DEFECT', JSON.stringify(s));

// ---- THE DEFECT: step back to the list ----
await key('Escape');                                // CreateCharChooseBioWindow_OnClose's cancel arm
s = await st();
if (s.state !== 'class') die('ESCAPE DID NOT REACH THE CLASS LIST', JSON.stringify(s));
console.log('back at the list | highlighted row:', s.rowName, '| document still:', s.doc);
if (s.rowName !== 'Custom') die('THE LIST CAME BACK ON A STANDARD CLASS - THE 17m DEFECT', JSON.stringify(s));
await page.screenshot({ path: '/home/claude/17m-list-on-custom.png' });

// ---- and Return re-opens the BUILDER, career intact ----
await key('Enter');
s = await st();
console.log('after Return:', JSON.stringify({ state: s.state, career: s.careerName, confirm: s.confirm }));
if (s.confirm) die('RETURN OPENED A STANDARD CLASS DESCRIPTION - THE 17m DEFECT', JSON.stringify(s));
if (s.state !== 'customClass') die('RETURN DID NOT RE-OPEN THE BUILDER', JSON.stringify(s));
if (s.careerName !== built) die('THE BUILT CAREER WAS DISCARDED', `${s.careerName} != ${built}`);
await page.screenshot({ path: '/home/claude/17m-builder-reopened.png' });

console.log('\nAUDIT 17m PROBE PASSED: the picker kept the Custom row, and the built career survived the round trip.');
await browser.close();
await server.close();
