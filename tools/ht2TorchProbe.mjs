// HT2 - THE PACK'S ACT ON A LIGHT SOURCE, in a real browser.
//
// Mac: "So you cant equip the torch in your offhand, you can only drop
// it on the ground". The enhanced pack's primary act was Wear, no light
// source has an equip slot, and the card answered "torch cannot be
// worn." - so the only act on it that named the torch honestly was
// Drop. The law is headless and pinned there
// (test/ht2_packlight.test.js drives `localPrimaryAct` and the use);
// what only a browser answers is whether the CARD a player actually
// presses now offers Light, lights that torch, says which one burns,
// and comes back offering Douse.
//
// No ARENA2 is needed: the items are built from the port's own
// templates, as tools/enhancedPackProbe.mjs builds its.
//
//     npx vite --port 5199 &
//     node tools/ht2TorchProbe.mjs
import { chromium } from 'playwright';
const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const out = [];
const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
await page.waitForSelector('#enhanced-menu .doorbtn', { timeout: 20000 });
await page.locator('#enhanced-menu .doorbtn.door-new').first().click();
await page.getByRole('button', { name: 'Begin', exact: true }).click();
await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
await page.waitForFunction(() => document.body.textContent.includes('boot failed'), null, { timeout: 15000 }).catch(() => {});

await page.evaluate(async () => {
  const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
  const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
  const { TEMPLATES } = await import('/src/systems/useItem.js');
  const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
  const mk = (n, group = 'Weapons') => { const tp = t(n); return tp && { name: tp.name, templateIndex: tp.index, group, stackCount: 1, currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50 }; };
  const torch = () => ({ name: 'Torch', group: 'UselessItems2', templateIndex: TEMPLATES.Torch, stackCount: 1, currentCondition: 50, maxCondition: 50 });
  const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] };
  e.items = [mk('Longsword'), torch(), torch()].filter(Boolean);
  globalThis.__ent = e;
  globalThis.__slot = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
});
await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });

await page.locator('#enhanced-inventory .packtab', { hasText: 'Misc' }).first().click();
const rows = page.locator('#enhanced-inventory .itemrow', { hasText: 'Torch' });
check('two torches in the list', (await rows.count()) === 2, String(await rows.count()));
await rows.first().click();
const acts = () => page.$$eval('#enhanced-inventory .acts button', (ns) => ns.map((n) => n.textContent));
const before = await acts();
check('the primary act on a torch reads Light, not Wear', before[0] === 'Light', before.join(' | '));
check('...and Wear is nowhere on the card', !before.includes('Wear'), before.join(' | '));
await page.locator('#enhanced-inventory .acts button', { hasText: 'Light' }).first().click();
const lit = await page.evaluate(() => globalThis.__ent.lightSource === globalThis.__ent.items.find((i) => i.name === 'Torch'));
check('pressing it lights THAT torch', lit);
const notice = await page.$eval('#enhanced-inventory', (n) => n.textContent);
check('and the pane says so', /ignite|light/i.test(notice));
const subs = await page.$$eval('#enhanced-inventory .itemrow small', (ns) => ns.map((n) => n.textContent));
check('exactly one row says lit', subs.filter((s) => /lit/.test(s)).length === 1, subs.join(' | '));
await rows.first().click();
const after = await acts();
check('the same card now offers Douse', after[0] === 'Douse', after.join(' | '));
const statLine = await page.$eval('#enhanced-inventory .packdetail .stats', (n) => n.textContent);
check('the card reads Lit, never Worn', /Lit/.test(statLine) && !/Worn/.test(statLine), statLine);
await page.locator('#enhanced-inventory .acts button', { hasText: 'Douse' }).first().click();
check('and dousing puts it out', await page.evaluate(() => globalThis.__ent.lightSource === null));
// the sword is untouched
await page.locator('#enhanced-inventory .packtab', { hasText: 'Weapons' }).first().click();
await page.locator('#enhanced-inventory .itemrow', { hasText: 'Longsword' }).first().click();
check('a sword is still Wear', (await acts())[0] === 'Wear', (await acts()).join(' | '));
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(out.every(Boolean) ? '\nALL OK' : '\nFAILURES');
process.exit(out.every(Boolean) ? 0 : 1);
