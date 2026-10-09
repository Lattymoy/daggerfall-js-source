// THE FEATURES HOME, in a real browser, WITH NO ARENA2 (FT0-FT11,
// 2026-09-14). What a source sweep cannot say: the home renders every
// registry row with its labels, the chip row filters by kind and its
// counts agree with the rows, a condensed row's one press moves BOTH
// stores (Land view distance: the pref and DFU's TerrainDistance), and
// the Settings pane draws a moved key NOT AT ALL (FT13).
//
// ORG2 (2026-10-09, Mac: "Graphic settings needs its own tab, etc. I really need you to go all in"): the home is the
// Settings screen's tabs now, so this walks THAT screen - every registry row drawn once across the tabs, each wearing a
// label; the kind filters; the Graphics tab's quality preset writing the rows through their own doors (Low's view
// distance lands in both stores) and reading Custom when a row leaves it; the one search finding a row on another tab
// under its "Tab > Section" head; a moved key drawn by its row alone (FT13); and each tab's rail count the rows it draws.
//
// Run against a dev server with NO arena2 on disk:
//     npx vite --port 5199 &
//     node tools/featuresProbe.mjs
import { chromium } from 'playwright';
import { FEATURES } from '../src/systems/features.js';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const SHOTS = process.env.PROBE_SHOTS ?? null;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 15000 });
if (await page.locator('.px-acctstage').count()) await page.keyboard.press('Escape');
check('ORG2: no Features door - its rows are Settings\' tabs', (await page.locator('.px-menu .door-features').count()) === 0);
await page.locator('.px-menu .door-settings').click();
await page.waitForSelector('#enhanced-menu .subbtn', { timeout: 10000 });

const tabNames = await page.$$eval('#enhanced-menu .subbtn', (bs) => bs.map((b) => b.firstChild.textContent.trim()));
check('the rail is the nine tabs, Graphics first', tabNames.join('|') === 'Graphics|Gameplay|Combat|World|Interface|Audio|Controls|Accessibility|Mods & files', tabNames.join('|'));
const pressTab = async (name) => { await page.locator('#enhanced-menu .subbtn').filter({ hasText: new RegExp(`^${name.replace(/[&]/g, '\\$&')}`) }).first().click(); await page.waitForTimeout(150); };

// every registry row, drawn once across the tabs, each wearing a label - and each tab's count is what it draws
const drawn = new Map();
for (const name of tabNames) {
  await pressTab(name);
  const tab = await page.evaluate(() => {
    const body = document.querySelector('#enhanced-menu .opt-body');
    const tiles = [...body.querySelectorAll(':scope > .ft-tile')];
    const rows = body.querySelectorAll(':scope > .row:not([data-live="0"]):not(.opt-link), :scope > .ft-tile').length;   // the Overhauls door is no option
    const on = document.querySelector('#enhanced-menu .subbtn.on .count');
    return { ids: tiles.map((t) => t.dataset.fid), labelled: tiles.every((t) => t.querySelector('.kind')), rows, count: Number(on?.textContent) };
  });
  for (const id of tab.ids) drawn.set(id, (drawn.get(id) ?? 0) + 1);
  check(`${name}: every row wears a label`, tab.labelled);
  check(`${name}: the rail counts what the tab draws`, tab.count === tab.rows, `${tab.count} on the rail, ${tab.rows} drawn`);
}
const missing = FEATURES.filter((f) => !drawn.has(f.id)).map((f) => f.id);
check('every registry row is drawn on a tab', missing.length === 0, missing.join(', '));
check('...and only once', [...drawn.values()].every((n) => n === 1));

// the kind filters: a row the Mods filter shows is a mod's, and a filtered tab says so when it is empty
await pressTab('World');
await page.locator('#enhanced-menu .opt-filters .chip.mod').click(); await page.waitForTimeout(150);
const worldMods = await page.$$eval('#enhanced-menu .opt-body > .ft-tile', (ts) => ts.map((t) => [...t.querySelectorAll('.kind')].map((k) => k.className)));
check('the Mods filter keeps the mods\' rows alone', worldMods.length > 0 && worldMods.every((ks) => ks.some((c) => /\bmod\b/.test(c))), `${worldMods.length} rows`);
await page.locator('#enhanced-menu .opt-filters .chip').first().click(); await page.waitForTimeout(150);

// THE PRESET (ORG2): Low writes each row through its own door, so the view distance lands in both stores
await pressTab('Graphics');
const preset = () => page.$$eval('#enhanced-menu .opt-preset .ft-segb', (bs) => bs.map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-current') === 'true' ? '*' : ''}`).join(' '));
check('a fresh shelf reads High - how the game ships', (await preset()) === 'Low Medium High* Ultra', await preset());
await page.locator('#enhanced-menu .opt-preset .ft-segb', { hasText: /^Low$/ }).click(); await page.waitForTimeout(150);
const stores = await page.evaluate(async () => {
  const p = await import('/src/systems/uiPrefs.js'); p._resetForTests();
  const s = await import('/src/systems/settings.js'); s._resetForTests();
  return { view: p.getPref('landViewDistance'), ini: s.getInt('Experimental', 'TerrainDistance', 1, 4), grass: p.getPref('grassDensity'), water: p.getPref('waterQuality') };
});
check('Low wrote every row it sets, the view distance in BOTH stores', stores.view === 3 && stores.ini === 3 && stores.grass === 0.25 && stores.water === 'simple', JSON.stringify(stores));
check('...and the bar reads Low', (await preset()) === 'Low* Medium High Ultra', await preset());
if (SHOTS) await page.screenshot({ path: `${SHOTS}/options-graphics.png` });
await page.locator('#enhanced-menu .ft-tile', { hasText: 'Water quality' }).locator('.ft-segb', { hasText: /^Full/ }).click(); await page.waitForTimeout(150);
check('a row moved off the preset reads Custom', /Custom\*/.test(await preset()), await preset());
await page.locator('#enhanced-menu .opt-preset .ft-segb', { hasText: /^High$/ }).click(); await page.waitForTimeout(150);
check('High puts them back', (await preset()) === 'Low Medium High* Ultra', await preset());

// THE SEARCH (ORG2): over every tab, each find under the tab and section it lives in
await page.locator('#enhanced-menu .opt-search').fill('footsteps'); await page.waitForTimeout(150);
const found = await page.$$eval('#enhanced-menu .opt-body .sec-head h3', (hs) => hs.map((h) => h.textContent));
check('the search finds a row on another tab, under its Tab > Section head', found.some((t) => /^Audio › Sounds$/.test(t)), found.join(' | '));
check('...and the rail lights no tab while it reads them all', (await page.locator('#enhanced-menu .subbtn.on').count()) === 0);
await page.locator('#enhanced-menu .opt-search').fill(''); await page.waitForTimeout(150);

// FT13: a moved key is drawn by its row alone - Gameplay's Dungeons section carries Smaller dungeons once, as a Features row
await pressTab('Gameplay');
const smaller = await page.evaluate(() => [...document.querySelectorAll('#enhanced-menu .opt-body .row-name, #enhanced-menu .opt-body .ft-tile-name')].filter((n) => /Smaller dungeons/i.test(n.textContent)).map((n) => n.className));
check('FT13: Smaller dungeons is drawn once, by its Features row - not a second switch, not a pointer', smaller.length === 1 && smaller[0] === 'ft-tile-name' && (await page.locator('#enhanced-menu .row.moved').count()) === 0, JSON.stringify(smaller));

// FT12: the outdoors test door is the Test Room's
await page.locator('#enhanced-menu .railbtn', { hasText: 'Test Room' }).click(); await page.waitForTimeout(200);
check('FT12: the Test Room carries the outdoors test door', (await page.locator('#enhanced-menu .row-name', { hasText: 'Test the outdoors' }).count()) === 1);
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
