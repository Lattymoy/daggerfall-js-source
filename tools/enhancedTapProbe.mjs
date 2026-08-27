// EVERY TARGET ON THE ENHANCED SCREENS IS A THUMB, MEASURED.
//
// AUDIT 2026-08-25 F1. The enhanced menu shipped with forty sub-44px
// targets on a Pixel 5 - every row label at 19px, every value pill at
// 38, every stepper at 34 - under a CSS comment claiming "the hit box
// around it is 44 because a thumb is". The rule beneath that comment
// was `content: ''` and `position: absolute` and nothing else: it drew
// no box, claimed no space and hit nothing.
//
// AUDIT 24 found this exact class in the CLASSIC settings screen and
// pinned it there (settingsUI T14), and the screen that replaced it
// broke the same law in a place that pin could not see. So the law
// gets a check on THIS side too, and it MEASURES rather than reads:
// a target's real size is getBoundingClientRect, not a stylesheet.
//
//     npx vite --port 5199 &
//     node tools/enhancedTapProbe.mjs
//
// The floor is 44 CSS px on the short axis, which is what
// settingsMetrics.tapMin uses and where the number comes from.
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const FLOOR = 44;

// The pointer target of an element: its own box, unioned with any
// ::after the design uses to grow the target past the drawn pill.
// Reading the box alone would report the DRAWN size and re-fail a
// screen that is actually fine.
const MEASURE = (floor) => {
  const bad = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('#enhanced-menu button, #app button, #app input')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;          // not displayed
    let w = r.width;
    let h = r.height;
    const a = getComputedStyle(el, '::after');
    if (a.content && a.content !== 'none') {
      w = Math.max(w, parseFloat(a.width) || 0);
      h = Math.max(h, parseFloat(a.height) || 0);
    }
    if (w < floor || h < floor) {
      const key = `${el.className}|${Math.round(w)}x${Math.round(h)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bad.push({ cls: el.className, w: Math.round(w), h: Math.round(h),
        text: el.textContent.trim().slice(0, 22) });
    }
  }
  return bad;
};

const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

for (const [label, opts] of [
  ['phone', { ...devices['Pixel 5'] }],
  ['phone-landscape', { ...devices['Pixel 5 landscape'] }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
  // PX1/PX8: the boot door opens on the PIXEL HOME now, not the rail.
  // The home's own buttons are targets too, so it is measured before
  // walking through it into the shell.
  await page.waitForSelector('#enhanced-menu .px-home');
  {
    const bad = await page.evaluate(MEASURE, FLOOR);
    check(`${label}: pixel home`, bad.length === 0, JSON.stringify(bad));
  }
  await page.locator('#enhanced-menu .px-menu button', { hasText: 'Load Game' }).click();
  await page.waitForSelector('#enhanced-menu .railbtn');

  // every pane, because a target that only exists under Settings is
  // still a target
  for (const pane of ['Continue', 'New Game', 'Load Game', 'Mods', 'About']) {
    await page.locator('#enhanced-menu .railbtn', { hasText: pane }).click();
    const bad = await page.evaluate(MEASURE, FLOOR);
    check(`${label}: ${pane}`, bad.length === 0, JSON.stringify(bad));
  }

  await page.locator('#enhanced-menu .railbtn', { hasText: 'Settings' }).click();
  await page.waitForSelector('#enhanced-menu .row');
  // every CATEGORY, because the widget kinds differ between them - a
  // colour swatch, a stepper and a switch are three different rows
  const cats = await page.locator('#enhanced-menu .subbtn').count();
  for (let i = 0; i < cats; i++) {
    const name = await page.locator('#enhanced-menu .subbtn').nth(i).textContent();
    // A second tap on the ACTIVE category raises its card as a sheet
    // (AUDIT F8), and on a phone that sheet covers the rail - so close
    // it before reaching for the next tab, exactly as a finger would.
    // isVisible() is not the question: the sheet's close bar is
    // display:block whether the sheet is up or translated 101% off the
    // bottom. The class is the state.
    if (await page.locator('#enhanced-menu .detail.open').count()) {
      await page.locator('#enhanced-menu .sheet-close').click();
      await page.waitForTimeout(280);   // the slide
    }
    await page.locator('#enhanced-menu .subbtn').nth(i).click();
    await page.waitForTimeout(60);
    const bad = await page.evaluate(MEASURE, FLOOR);
    check(`${label}: Settings / ${name.trim()}`, bad.length === 0, JSON.stringify(bad));
  }
  await ctx.close();
}

// ── AND THE WIZARD, which inherited the menu's controls and its hole.
// The chargen steppers are the same `.step` class and measured 34x34
// on a Pixel 5 the first time this probe was pointed at them, which is
// exactly why the walk lives here rather than in a second probe: one
// floor, one measurement, every enhanced surface.
for (const [label, opts] of [['phone', { ...devices['Pixel 5'] }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/chargen.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.prov', { timeout: 20000 });
  const at = async (name) => {
    const bad = await page.evaluate(MEASURE, FLOOR);
    check(`${label}: chargen / ${name}`, bad.length === 0, JSON.stringify(bad));
  };
  const primary = () => page.locator('.act.primary');
  await at('homeland');
  await page.evaluate(() => [...document.querySelectorAll('.prov:not(.inert)')][1]
    .dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(150);
  await at('homeland sheet');
  await primary().click();
  await at('sex');
  await page.locator('.bigbtn', { hasText: 'Woman' }).click();
  await at('class method');
  await page.locator('.bigbtn', { hasText: 'Choose from a list' }).click();
  await at('class list');
  await page.locator('.row-main').nth(1).click();
  await primary().click();
  await page.waitForTimeout(150);
  await at('class description');
  await primary().click();
  await at('history method');
  await page.locator('.bigbtn', { hasText: 'Answer twelve' }).click();
  await at('biography');
  for (let i = 0; i < 14; i++) {
    if (!(await page.locator('.answer').count())) break;
    await page.locator('.answer').first().click();
    await page.waitForTimeout(40);
  }
  await at('reputation box');
  if (await page.locator('.repbox').count()) await primary().click();
  await page.waitForTimeout(150);
  await at('name');
  await page.locator('.act', { hasText: 'Suggest one' }).click();
  await primary().click();
  await page.waitForTimeout(800);
  await at('face');
  await primary().click();
  await page.waitForTimeout(200);
  await at('attributes');
  // spend the pool so the screen advances, then measure the skills
  // steppers - three groups, three pools, and the same control
  for (let i = 0; i < 40; i++) {
    if (!(await primary().isDisabled())) break;
    await page.locator('.row .step').last().click();
  }
  await primary().click();
  await page.waitForTimeout(200);
  await at('skills');
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} surfaces clear of sub-${FLOOR}px targets`);
if (failed) process.exit(1);
