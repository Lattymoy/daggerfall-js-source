// THE FEATURES HOME, in a real browser, WITH NO ARENA2 (FT0-FT11,
// 2026-09-14). What a source sweep cannot say: the home renders every
// registry row with its labels, the chip row filters by kind and its
// counts agree with the rows, a condensed row's one press moves BOTH
// stores (Land view distance: the pref and DFU's TerrainDistance), and
// the Settings pane draws a moved key as a pointer.
//
// Run against a dev server with NO arena2 on disk:
//     npx vite --port 5199 &
//     node tools/featuresProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 15000 });
await page.locator('.px-menu .door-features').click();
await page.waitForSelector('#enhanced-menu .chips', { timeout: 10000 });

const rows = () => page.$$eval('#enhanced-menu .row.feature', (rs) => rs.length);
const chips = await page.$$eval('#enhanced-menu .chip', (cs) => cs.map((c) => ({ label: c.firstChild.textContent.trim(), n: Number(c.querySelector('.n')?.textContent) })));
const all = await rows();
check('the chip row: All then the three kinds, with counts', chips.map((c) => c.label).join('|') === 'All|Enhanced|Mod Authored|DFU Classic', JSON.stringify(chips));
check('every registry row is drawn, each wearing a label', all === chips[0].n && all >= 21 && (await page.$$eval('#enhanced-menu .row.feature', (rs) => rs.every((r) => r.querySelector('.kind')))), `${all} rows`);
for (const [cls, i] of [['enhanced', 1], ['mod', 2], ['classic', 3]]) {
  await page.locator(`#enhanced-menu .chip.${cls}`).click(); await page.waitForTimeout(120);
  check(`the ${chips[i].label} chip filters to its count`, (await rows()) === chips[i].n, `${await rows()} of ${chips[i].n}`);
}
await page.locator('#enhanced-menu .chip').first().click(); await page.waitForTimeout(120);
check('a two-label row shows under both of its chips', (await page.$$eval('#enhanced-menu .row.feature', (rs) => rs.filter((r) => r.querySelectorAll('.kind').length === 2).length)) >= 2);

// a condensed row: ONE press moves BOTH stores (FT2)
const lv = () => page.locator('#enhanced-menu .row.feature', { hasText: 'Land view distance' });
const before = await lv().locator('.ctl .act').textContent();
await lv().locator('.ctl .act').click(); await page.waitForTimeout(120);
const after = await lv().locator('.ctl .act').textContent();
const stores = await page.evaluate(async () => {
  const p = await import('/src/systems/uiPrefs.js'); p._resetForTests();
  const s = await import('/src/systems/settings.js'); s._resetForTests();
  return { pref: p.getPref('landViewDistance'), ini: s.getInt('Experimental', 'TerrainDistance', 1, 4) };
});
check('a condensed row steps its tier', before !== after, `${before} -> ${after}`);
check('...and ONE press wrote BOTH stores, DFU\'s capped at 4', stores.pref === 6 && stores.ini === 4, JSON.stringify(stores));
await lv().locator('.ctl .act').click();   // wraps to 1
await page.evaluate(async () => { const { landViewWrite } = await import('/src/world/landView.js'); landViewWrite(5); });   // the default back

// the Settings pane draws a moved key as a pointer (FT1), and the emptied Enhanced category as one (FT8)
await page.locator('#enhanced-menu .railbtn', { hasText: 'Settings' }).click(); await page.waitForTimeout(200);
check('FT12: the settings rail has no Enhanced category', !(await page.$$eval('#enhanced-menu .subbtn', (bs) => bs.map((b) => b.textContent))).some((t) => /^Enhanced/.test(t)));
await page.locator('#enhanced-menu .subbtn').filter({ hasText: /^Game/ }).first().click(); await page.waitForTimeout(200);
const moved = await page.$$eval('#enhanced-menu .row.moved .row-name', (ns) => ns.map((n) => n.textContent));
check('Settings > Game draws Smaller dungeons as a pointer, not a second switch', moved.includes('Smaller dungeons'), moved.join(', '));
await page.locator('#enhanced-menu .row.moved', { hasText: 'Smaller dungeons' }).locator('.ctl .act').click(); await page.waitForTimeout(200);
check('...and the pointer walks to the home', (await page.locator('#enhanced-menu .chips').count()) === 1);
// FT12: the outdoors test door is the Test Room's
await page.locator('#enhanced-menu .railbtn', { hasText: 'Test Room' }).click(); await page.waitForTimeout(200);
check('FT12: the Test Room carries the outdoors test door', (await page.locator('#enhanced-menu .row-name', { hasText: 'Test the outdoors' }).count()) === 1);
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
