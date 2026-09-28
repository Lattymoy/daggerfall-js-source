// PAD-DOOR (2026-09-27): THE FRONT DOOR DRIVEN BY A CONTROLLER, IN A REAL PAGE.
//
// Discord, an AYN Thor (a handheld with the controller built in): "unable to select online, load game anything".
// No pad reached the door before a scene attached one. This probe stands a fake standard-mapped pad behind
// navigator.getGamepads and walks the door with it alone: past the intro, the first visit's sign-in window closed
// with B, down the home's buttons to Load Game, A into it, the rail walked to Online, and B home again.
//
//     npx vite --port 5199 &
//     node tools/menuPadProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const ctx = await browser.newContext({ viewport: { width: 731, height: 411 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const pad = { id: 'probe pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
  window.__pad = pad;
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
});
const BTN = { A: 0, B: 1, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const press = async (b) => {
  await page.evaluate((i) => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; }, b);
  await page.waitForTimeout(90);
  await page.evaluate((i) => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; }, b);
  await page.waitForTimeout(90);
};
const focused = () => page.evaluate(() => { const e = document.activeElement; return !e || e === document.body ? "" : (e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40); });

await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
// THE INTRO: A (twice at most - the first focuses when nothing is) until the menu stands
for (let i = 0; i < 6 && !(await page.locator('#enhanced-menu .px-home').count()); i++) {
  await press(BTN.A);
  await page.waitForTimeout(700);
}
await page.waitForSelector('#enhanced-menu .px-home', { timeout: 15000 });
check('the intro is passed with A', true);
await page.waitForTimeout(1300);   // the fade that holds the menu inert (introScreen.js)
if (await page.locator('#enhanced-menu .px-acctwin').count()) {
  await press(BTN.B);
  await page.waitForTimeout(200);
  check('B closes the first visit\'s sign-in window', (await page.locator('#enhanced-menu .px-acctwin').count()) === 0);
}
// THE HOME: down to Load Game, A
let steps = 0;
while (steps++ < 12 && !/Load Game/i.test(await focused())) await press(BTN.DOWN);
check('the d-pad walks the home to Load Game', /Load Game/i.test(await focused()), await focused());
await press(BTN.A);
await page.waitForTimeout(300);
check('A opens it', (await page.locator('#enhanced-menu .shell').count()) === 1
  && /Load/i.test(await page.locator('#enhanced-menu .railbtn.on').first().textContent()));
// THE RAIL: the focus onto the rail, down to Online, A
steps = 0;
while (steps++ < 14 && !/^◆? ?Online$/i.test((await focused()).replace(/[^\w ]/g, '').trim())) {
  const f = await focused();
  await press(/Load Game|Continue|New Game/i.test(f) || !f ? BTN.DOWN : BTN.LEFT);
}
check('the rail is walked to Online', /Online/i.test(await focused()), await focused());
await press(BTN.A);
await page.waitForTimeout(300);
check('A opens the Online door', /Online/i.test(await page.locator('#enhanced-menu .railbtn.on').first().textContent()));
// RIGHT into the pane: a control there takes the focus
await press(BTN.RIGHT);
const inPane = await page.evaluate(() => !!document.activeElement?.closest('.pane'));
check('right moves the focus into the pane', inPane, await focused());
// B: back to the home
await press(BTN.B);
await page.waitForTimeout(300);
check('B goes back to the home', (await page.locator('#enhanced-menu .px-home').count()) === 1);

await browser.close();
console.log(failed ? `${failed} check(s) FAILED` : 'the door answers the pad');
process.exit(failed ? 1 : 0);
