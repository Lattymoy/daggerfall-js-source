// SHORT-TOUCH (2026-09-27): THE FRONT DOOR ON A SHORT LANDSCAPE TOUCH SCREEN, MEASURED.
//
// Discord, an AYN Thor and an Android phone: "I can login, get to the main screen but I'm unable to select online,
// load game, anything" - "I luckily have a tiny, tiny space under the title I can use to scroll". The section
// screen stacked the logo, the pane and the rail in one column on every coarse pointer, and held sideways a
// handheld's pane - where Continue, Load, Begin and Play online live - came to a few pixels. The tap probe
// (enhancedTapProbe.mjs) measures button SIZES and passed: a button in a zero-height pane still measures 44 px.
// This one measures what a player can SEE: for each door, the pane's height on screen and whether its first
// button stands inside the viewport; and the first-visit sign-in window's Close.
//
//     npx vite --port 5199 &
//     node tools/shortTouchProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const PANE_FLOOR = 200;   // CSS px of pane a player can read a heading and a button in
const SCREENS = [
  ['AYN Thor top screen (1920x1080 @ 2.625)', 731, 411],
  ['short handheld (1920x1080 @ 2.75)', 698, 393],
  ['Pixel 5 landscape', 851, 393],
  ['handheld with the toolbar showing', 731, 355],
];
const DOORS = ['Continue', 'New Game', 'Load Game', 'Online', 'Test Room', 'Settings'];

const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

for (const [label, width, height] of SCREENS) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });   // the probes' one-visit skip (main.js)
  await page.waitForSelector('#enhanced-menu .px-home');
  // the first visit's sign-in window: its Close must be on the screen
  const win = page.locator('#enhanced-menu .px-acctwin');
  if (await win.count()) {
    const r = await win.boundingBox();
    check(`${label}: the sign-in window fits`, !!r && r.y >= 0 && r.y + r.height <= height + 1, JSON.stringify(r));
    await page.mouse.click(4, height - 4);   // the bare scrim closes it
  }
  await page.locator('#enhanced-menu .px-menu button', { hasText: 'Load Game' }).click();
  await page.waitForSelector('#enhanced-menu .shell');
  for (const door of DOORS) {
    const btn = page.locator('#enhanced-menu .rail .railbtn', { hasText: door }).first();
    if (!(await btn.count())) { check(`${label}: ${door}`, false, 'no rail entry'); continue; }
    await btn.scrollIntoViewIfNeeded();   // the rail scrolls where it outruns the screen - a player's thumb does this
    const rb = await btn.boundingBox();
    check(`${label}: the ${door} rail entry is on the screen`, !!rb && rb.y >= 0 && rb.y + rb.height <= height + 1, JSON.stringify(rb));
    await btn.click();
    await page.waitForTimeout(80);
    const pane = await page.locator('#enhanced-menu .shell > .pane').boundingBox();
    const shown = pane ? Math.max(0, Math.min(pane.y + pane.height, height) - Math.max(pane.y, 0)) : 0;
    check(`${label}: the ${door} pane shows ${Math.round(shown)} px`, shown >= PANE_FLOOR);
    // the pane's first button a player would press (Continue, Begin, Play online, Load...) - scrolled to, it must
    // come to rest inside the screen
    const first = page.locator('#enhanced-menu .shell > .pane .body button, #enhanced-menu .shell > .pane .list button').first();
    if (await first.count()) {
      await first.scrollIntoViewIfNeeded().catch(() => {});
      const fb = await first.boundingBox();
      check(`${label}: the ${door} pane's first button can be reached`, !!fb && fb.height > 0 && fb.y >= 0 && fb.y + fb.height <= height + 1, JSON.stringify(fb));
    }
  }
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) FAILED` : 'every door can be seen and pressed');
process.exit(failed ? 1 : 0);
