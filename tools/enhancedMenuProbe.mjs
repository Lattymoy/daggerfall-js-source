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
  await page.waitForSelector('.px-menu button', { timeout: 15000 });   // PX1: the door is the pixel home now

  // 1. THE DOOR OPENED WITHOUT DATA. ensureArena2's picker is a fixed
  //    overlay with a #pick input; if it is up, the claim is false.
  check(`${label}: the menu draws with no ARENA2`,
    (await page.locator('.px-menu button').count()) === 6)   // R7 added Enhanced;

  const sw = await page.evaluate(() => {
    const on = document.querySelector('.skinswitch .skinopt.on'), off = document.querySelector('.skinswitch .skinopt:not(.on)');
    const hint = document.querySelector('.skinswitch .skinhint');
    const inFoot = Boolean(document.querySelector('.px-foot .skinswitch'));
    return on && off ? { on: on.textContent, off: off.textContent, pressed: on.getAttribute('aria-pressed'), inFoot,
      h: Math.round(Math.max(on.getBoundingClientRect().height, off.getBoundingClientRect().height)),
      hintHidden: !hint || getComputedStyle(hint).display === 'none',
      lit: getComputedStyle(on).color } : null;
  });
  check(`${label}: the skin switch is dead centre of the foot, Enhanced lit, Classic a press away`,
    sw?.on === 'Enhanced' && sw?.off === 'Classic' && sw?.pressed === 'true' && sw?.hintHidden
    && sw?.inFoot && sw?.h >= 44 && sw?.lit === 'rgb(243, 239, 44)', JSON.stringify(sw));
  if (label === 'phone') check('phone: the switch is a thumb\'s target', sw?.h >= 44, `${sw?.h}px`);
  check(`${label}: the folder pick has NOT been asked for`,
    (await page.locator('#pick').count()) === 0);

  // 2. SETTINGS WORK WITHOUT DATA. The law modules are pure, so this
  //    should hold - it is exactly what the U29/U30 split bought.
  await page.locator('.px-menu button').filter({ hasText: /Settings/ }).first().click();
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

  // 2b. THE SWITCH ON THE DOOR (U62): the two skins under the brand, the
  //     one in effect lit and pressed, the other a control, the hint
  //     under them - and on a phone, a thumb's target.
  // U62's switch, where PX1b put it: DEAD CENTRE of the pixel foot,
  // with the shell's 'switch anytime' hint hidden - the centred pair
  // reads as a control on its own.

  // 2c. THE ENHANCED SECTION. A source sweep can say the pane exists
  //     and is dispatched; only a browser can say the rail entry opens
  //     it without throwing, that its switch reads its default, and
  //     that a press PERSISTS.
  //
  //     This rode the ROADS switch until the road system was removed
  //     whole (2026-08-29, Mac's call). Re-aimed at the procedural sky,
  //     which is the enhanced pane's other real preference - the checks
  //     are about the PANE and its switch machinery, not about which
  //     enhancement happens to be sitting in it.
  await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
  await page.locator('.px-menu button').filter({ hasText: /Enhanced/ }).first().click();
  await page.waitForTimeout(300);
  const pane = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#enhanced-menu .row')];
    const find = (n) => rows.find((r) => r.querySelector('.row-name')?.textContent === n);
    const sky = find('Procedural sky');
    return {
      sky: sky ? sky.querySelector('.ctl .act')?.textContent : null,
      skyTarget: sky ? Math.round(sky.querySelector('.ctl .act').getBoundingClientRect().height) : 0,
      skin: !!find('Interface Style'),
    };
  });
  check(`${label}: the Enhanced section opens with its switches`,
    pane.sky !== null && pane.skin, JSON.stringify(pane));
  check(`${label}: the sky reads ON by default`, pane.sky === 'On', String(pane.sky));
  if (label === 'phone') check("phone: the sky switch is a thumb's target", pane.skyTarget >= 38, `${pane.skyTarget}px`);
  await page.locator('#enhanced-menu .row', { hasText: 'Procedural sky' }).locator('.ctl .act').click();
  const skyOff = await page.evaluate(async () => {
    const m = await import('/src/systems/uiPrefs.js');
    m._resetForTests();
    return m.getPref('proceduralSky');
  });
  check(`${label}: the sky switch PERSISTS`, skyOff === false, String(skyOff));
  await page.locator('#enhanced-menu .row', { hasText: 'Procedural sky' }).locator('.ctl .act').click();

  // 3. THE PICK APPEARS WHEN A GAME STARTS, and not one moment before.
  await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Escape');   // PX2: Escape backs a section out to home
  await page.waitForSelector('.px-menu button', { timeout: 10000 });
  await page.locator('.px-menu button').filter({ hasText: /New Game/ }).first().click();
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

// 5. THE PRESS (U62). Pressing Classic on the door STORES the choice
//    and reloads with no ?skin= on the URL - onto the classic door,
//    which gates the data before its menu. A fresh context, so the
//    stored choice is this context's alone, and it is cleared after.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/`, { waitUntil: 'load' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await page.locator('.skinswitch .skinopt:not(.on)').click();
  const picked = await page.waitForSelector('#pick', { timeout: 15000 }).then(() => true, () => false);
  check('press Classic: the classic door opens, data first', picked && (await page.locator('#enhanced-menu').count()) === 0);
  check('press Classic: the URL carries no override - the choice is STORED', !new URL(page.url()).searchParams.has('skin'));
  const stored = await page.evaluate(async () => { const { uiSkin } = await import('/src/systems/uiSkin.js'); return uiSkin(''); });
  check('press Classic: uiSkin reads classic with no URL at all', stored === 'classic');
  await page.evaluate(() => localStorage.clear());
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
