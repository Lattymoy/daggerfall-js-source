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

  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button', { timeout: 15000 });   // PX1: the door is the pixel home now

  // 1. THE DOOR OPENED WITHOUT DATA. ensureArena2's picker is a fixed
  //    overlay with a #pick input; if it is up, the claim is false.
  //
  // FT16: this counted the doors and hardcoded the number - 6 from R7
  // on, then 9 from FT0, each one stale the moment a door moved, and
  // its own comment says so ("nobody ran it"). A census is not this
  // probe's subject; the claim is that the home DREW, with the doors
  // this file goes on to drive. So it asks for those by name, and a
  // door added or moved is not a failure here.
  const doors = (await page.locator('.px-menu button').allInnerTexts()).map((t) => t.trim().toUpperCase());
  check(`${label}: the menu draws with no ARENA2`, doors.length > 0, `${doors.length} doors`);
  for (const want of ['SETTINGS', 'FEATURES']) {
    check(`${label}: the ${want.toLowerCase()} door is on the rail`, doors.includes(want), doors.join(' / '));
  }

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
  // SO1 (2026-09-11) put the Enhanced category first, and FT8 (2026-09-14)
  // emptied it of switches (they are the Features home's now) - the rows
  // this step reads and the one it presses are the GAME category's.
  await page.locator('#enhanced-menu .subbtn').filter({ hasText: /^Game/ }).first().click();
  await page.waitForTimeout(200);
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

  // 2c. THE FEATURES HOME. A source sweep can say the pane exists
  //     and is dispatched; only a browser can say the rail entry opens
  //     it without throwing, that its switch reads its default, and
  //     that a press PERSISTS.
  //
  //     This rode the ROADS switch until the road system was removed
  //     whole (2026-08-29, Mac's call), then the procedural sky in the
  //     Enhanced pane; FT4 (2026-09-14) condensed that switch with
  //     Dynamic Skies' into the Features home's three-way outdoors row,
  //     and the home is where every enhanceable feature lives now. The
  //     checks are about the HOME and its switch machinery
  //     (tools/featuresProbe.mjs walks the rest of it).
  //
  //     FT16: THIS HAD BEEN RED SINCE FT14 AND NOBODY RAN IT - the
  //     second time this file has failed that way (see the door census
  //     above). FT14 replaced the scrolling list with a grid of tiles,
  //     so `.row.feature` matched nothing, the pane read zero rows, and
  //     the switch click timed out. Re-aimed at the tiles: the control
  //     is a SEGMENTED BAR now, not one cycling button, so a tier is
  //     pressed by name rather than stepped into.
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
  await page.locator('.px-menu button').filter({ hasText: /Features/ }).first().click();
  await page.waitForSelector('#enhanced-menu .ft-tile', { timeout: 10000 });
  const skyTile = page.locator('#enhanced-menu .ft-tile')
    .filter({ has: page.locator('.ft-tile-name', { hasText: /^Enhanced environments$/ }) });
  const pane = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#enhanced-menu .ft-tile')];
    const sky = tiles.find((t) => t.querySelector('.ft-tile-name')?.textContent === 'Enhanced environments');
    const pressed = sky?.querySelector('.ft-segb[aria-pressed="true"]');
    return {
      rows: tiles.length,
      sky: pressed ? pressed.textContent : null,
      skyTarget: pressed ? Math.round(pressed.getBoundingClientRect().height) : 0,
      labels: sky ? [...sky.querySelectorAll('.kind')].map((k) => k.textContent) : [],
    };
  });
  check(`${label}: the Features home opens with its tiles`, pane.rows >= 21 && pane.sky !== null, JSON.stringify(pane));
  check(`${label}: the outdoors read Dynamic Skies by default, wearing both labels`,
    pane.sky === 'On, with Dynamic Skies' && pane.labels.join('+') === 'Enhanced+Mod Authored', JSON.stringify(pane));
  if (label === 'phone') check("phone: the outdoors switch is a thumb's target", pane.skyTarget >= 38, `${pane.skyTarget}px`);
  // the bar's OFF segment is the pref off - pressed by name, where the old list stepped a cycling button
  await skyTile.locator('.ft-segb', { hasText: /^Off/ }).first().click();
  const skyOff = await page.evaluate(async () => {
    const m = await import('/src/systems/uiPrefs.js');
    m._resetForTests();
    return m.getPref('enhancedEnvironments');   // EE1
  });
  check(`${label}: the outdoors switch PERSISTS`, skyOff === false, String(skyOff));
  await skyTile.locator('.ft-segb', { hasText: /Dynamic Skies/ }).first().click();   // back to where it was

  // 3. THE PICK APPEARS WHEN A GAME STARTS, and not one moment before.
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
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

// 4. THE CLASSIC SKIN OPENS ON THE SAME DOOR (FD1, 2026-09-11): the
//    rail collapses to Begin / Online / Settings / Controls / Features / Mods / About
//    (ONLINE1 and FT0 since), and BEGIN - the door, then the pane's own
//    Begin - gates the data: the pick is up before any classic screen.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=classic&nointro`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  const st = await page.evaluate(() => JSON.parse(window.__menu()));
  // FT14 took Mods off this rail and FT16 took Controls into Settings;
  // this line still expected both, which is the third thing in this
  // file that had gone stale unnoticed.
  check('classic: the enhanced door mounts with the classic rail', JSON.stringify(st.sections) === JSON.stringify(['begin', 'online', 'settings', 'features', 'about']), JSON.stringify(st.sections));
  await page.locator('.px-menu .door-begin').click();
  await page.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();   // FD1: the door opens the Begin pane; its button starts
  const picked = await page.waitForSelector('#pick', { timeout: 15000 }).then(() => true, () => false);
  check('classic: Begin gates the data before its own start sequence', picked);
  await ctx.close();
}

// 5. THE PRESS (U62). Pressing Classic on the door STORES the choice
//    and reloads with no ?skin= on the URL - onto the classic door,
//    which gates the data before its menu. A fresh context, so the
//    stored choice is this context's alone, and it is cleared after.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'load' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await page.locator('.skinswitch .skinopt:not(.on)').click();
  // FD1: the classic door is this same screen with the Begin rail; the pick rises behind Begin
  await page.waitForSelector('.px-menu .door-begin', { timeout: 20000 });
  await page.locator('.px-menu .door-begin').click();
  await page.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();   // FD1: the pane's own Begin
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
