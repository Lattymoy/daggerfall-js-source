// THE ENHANCED FRONT DOOR, in a real browser, WITH NO ARENA2.
//
// That is the whole claim and it is the one a source sweep cannot
// make: the enhanced menu renders, its settings work and its save card
// answers, all before the game has been given a single byte of game
// data - and the folder pick appears at the moment a game actually
// starts, not before.
//
// Run against a dev server with NO arena2 on disk:
//     npx vite --port 5199 &
//     node tools/enhancedMenuProbe.mjs
//
// It drives index.html (the GAME), not menu.html (the prototype), on
// purpose. The prototype has been green since the design landed; what
// this proves is the integration.
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const shots = process.env.PROBE_SHOTS ?? '/tmp';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();

async function run(label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 15000 });

  // 1. THE DOOR OPENED WITHOUT DATA. ensureArena2's picker is a fixed
  //    overlay with a #pick input; if it is up, the claim is false.
  check(`${label}: the menu draws with no ARENA2`,
    (await page.locator('#enhanced-menu .railbtn').count()) === 6);
  check(`${label}: the folder pick has NOT been asked for`,
    (await page.locator('#pick').count()) === 0);

  // 2. SETTINGS WORK WITHOUT DATA. The law modules are pure, so this
  //    should hold - it is exactly what the U29/U30 split bought.
  await page.locator('#enhanced-menu .railbtn', { hasText: 'Settings' }).click();
  await page.waitForSelector('#enhanced-menu .row');
  const rows = await page.locator('#enhanced-menu .row').count();
  check(`${label}: settings rows render`, rows > 10, `${rows} rows`);

  // a real write, read back through the store
  const before = await page.evaluate(async () => {
    const s = await import('/src/systems/settings.js');
    return s.effectiveSettings().Enhancements.LoiterLimitInHours;
  });
  await page.locator('#enhanced-menu .row', { hasText: 'Maximum Wait Time' })
    .locator('.step').last().click();
  const after = await page.evaluate(async () => {
    const s = await import('/src/systems/settings.js');
    s._resetForTests();
    return s.effectiveSettings().Enhancements.LoiterLimitInHours;
  });
  check(`${label}: a setting changed and PERSISTED`, String(before) !== String(after),
    `${before} -> ${after}`);

  await page.screenshot({ path: `${shots}/door-${label}.png` });

  // 3. THE PICK APPEARS WHEN A GAME STARTS, and not one moment before.
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).click();
  await page.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();
  const picked = await page.waitForSelector('#pick', { timeout: 15000 }).then(() => true, () => false);
  check(`${label}: Begin raises the ARENA2 pick`, picked);
  check(`${label}: the menu is gone`, (await page.locator('#enhanced-menu').count()) === 0);
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));

  await ctx.close();
}

await run('desktop', { viewport: { width: 1400, height: 900 } });
await run('phone', { ...devices['Pixel 5'] });

// 4. THE CLASSIC SKIN IS UNTOUCHED. ?skin=classic must go the old way
//    round: data FIRST, so the pick is up before any menu.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=classic`, { waitUntil: 'domcontentloaded' });
  const picked = await page.waitForSelector('#pick', { timeout: 15000 }).then(() => true, () => false);
  check('classic: gates the data before its menu', picked);
  check('classic: no enhanced menu mounted', (await page.locator('#enhanced-menu').count()) === 0);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
