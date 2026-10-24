// SHOP-PLUS probe: the guild's Buy Spells (the spellbook in buy mode) in its Enhanced Plus face, on a real page - the
// shelf, a spell chosen, and Buy through its haggle Yes/No to a spell in the book.
//     node tools/spellShopProbe.mjs [dir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const SHOTS = process.argv[2] ?? 'artifacts/shop';
mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { port: 5246, strictPort: true, hmr: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5246/menu.html?skin=enhanced', { waitUntil: 'networkidle' });
const out = await page.evaluate(async () => {
  document.getElementById('enhanced-menu')?.remove();
  document.body.style.background = '#3a3226';
  const { SpellbookWindow, SPELLBOOK_TEMPLATE_INDEX } = await import('/src/ui/spellbookWindow.js').then(async (m) => ({ ...m, ...(await import('/src/systems/spell/spellMaker.js')) }));
  const { enhancedWindow } = await import('/src/ui/enhanced/enhancedPorts.js');
  // a handful of SPELLS.STD-shaped records (the fields the book reads)
  const fx = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, durationBase: 0, chanceBase: 0, ...o });
  const spells = [
    { name: 'Fireball', icon: 12, rangeType: 3, element: 0, cost: 30, effects: [fx(4, 0, { magnitudeBaseLow: 5, magnitudeBaseHigh: 15, magnitudeLevelBase: 2 })] },
    { name: 'Heal', icon: 3, rangeType: 0, element: 4, cost: 15, effects: [fx(10, 8, { magnitudeBaseLow: 10, magnitudeBaseHigh: 20 })] },
    { name: 'Levitate', icon: 7, rangeType: 0, element: 4, cost: 40, effects: [fx(14, 255, { durationBase: 3, durationMod: 1 })] },
    { name: 'Water Walking', icon: 9, rangeType: 0, element: 4, cost: 25, effects: [fx(31, 255, { durationBase: 5, durationMod: 2 })] },
    { name: 'Frostbite', icon: 14, rangeType: 1, element: 1, cost: 20, effects: [fx(4, 0, { magnitudeBaseLow: 4, magnitudeBaseHigh: 9 }), fx(1, 1, { magnitudeBaseLow: 1, magnitudeBaseHigh: 3, durationBase: 2 })] },
    { name: 'Light', icon: 1, rangeType: 0, element: 4, cost: 5, effects: [fx(15, 255, { durationBase: 10 })] },
    { name: 'Shock', icon: 16, rangeType: 2, element: 3, cost: 22, effects: [fx(4, 0, { magnitudeBaseLow: 3, magnitudeBaseHigh: 12 })] },
    { name: '!Internal', icon: 0, rangeType: 0, element: 0, cost: 1, effects: [] },
  ];
  const entity = { goldPieces: 400, items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }], spells: [], stats: { personality: 55 } };
  let win = new SpellbookWindow({
    spells: () => entity.spells, entity, castCost: (sp) => sp.cost ?? 0, offered: () => spells,
    buildingQuality: () => 12, shopName: () => 'The Mages Guild of Daggerfall',
    skills: () => ({ mercantile: 35, personality: 55 }), classicMinutes: () => 0,
    rows: () => ['A fair price for a fine spell. Do we have a deal?'],   // stands in for the host's TEXT.RSC reader
    onClose: () => { globalThis.__closed = true; },
  }, { buyMode: true });
  win = enhancedWindow(win, 'spellShop');
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
  // the host's route for a press on the game canvas (client -> native -> the top window's click), which the
  // enhanced Yes/No replays its press through
  cv.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:200px;opacity:0;z-index:0';
  document.body.append(cv);
  cv.addEventListener('pointerdown', (e) => { const r = cv.getBoundingClientRect(); win.click((e.clientX - r.left) * 320 / r.width, (e.clientY - r.top) * 200 / r.height); });
  // the game's renderer answers every draw call; the port quiets them all, so any function will do here
  const renderer = new Proxy({ canvas: cv }, { get: (t, k) => (k in t ? t[k] : () => undefined) });
  globalThis.__shop = win;
  // a stand-in for FONT0003's metrics (the host passes the real one; no ARENA2 here) - the box is laid out with it
  const font = { fnt: { fixedHeight: 7, glyphWidth: () => 5 } };
  globalThis.__frame = () => win.draw(renderer, cv, font);
  // the host draws the window every frame; so does this page
  setInterval(() => globalThis.__frame(), 16);
  globalThis.__entity = entity;
  return { host: !!document.querySelector('.port-spellshop'), rows: document.querySelectorAll('.port-spellshop .port-row').length };
});
console.log('shop', JSON.stringify(out));
const frame = () => page.evaluate(() => { for (let i = 0; i < 3; i++) globalThis.__frame(); });
await page.waitForTimeout(400); await frame();
await page.screenshot({ path: `${SHOTS}/s1-shelf.png` });
// choose Frostbite on the shelf with the mouse
const names = await page.evaluate(() => [...document.querySelectorAll('.port-spellshop .port-row')].map((n) => n.tagName + ':' + n.textContent));
console.log('rows', JSON.stringify(names));
await page.locator('.port-spellshop button.port-row', { hasText: 'Frostbite' }).first().click(); await frame();
await page.screenshot({ path: `${SHOTS}/s2-chosen.png` });
// Buy - the haggle line and its Yes/No
await page.click('.port-spellshop .port-foot .port-btn.primary'); await frame(); await page.waitForTimeout(200); await frame();
await page.screenshot({ path: `${SHOTS}/s3-haggle.png` });
console.log('haggle', JSON.stringify(await page.evaluate(() => ({ top: globalThis.__shop.top, box: !!globalThis.__shop._box, dlg: !!document.querySelector('.dlg-shell') }))));
const yes = await page.$('text=/^\\s*Yes\\s*$/i');
if (yes) { await yes.click(); } else { await page.evaluate(() => globalThis.__shop.input('KeyY')); }
await frame();
const after = await page.evaluate(() => ({ gold: globalThis.__entity.goldPieces, book: globalThis.__entity.spells.map((s) => s.name), closed: !!globalThis.__closed }));
console.log('bought', JSON.stringify(after));
// EM3-3D merge (the patch's SHOP-PLUS), T3: the shelf, the haggle's Yes/No, the spell in the book and the gold paid
const fail = (why) => { console.error('FAIL', why); process.exitCode = 1; };   // T3: a probe judges its subject
if (!names.length) fail('the Enhanced Plus shop listed no spells');
if (after.book.length !== 1) fail(`the book holds ${after.book.length} spells after one purchase`);
if (!(after.gold < 400)) fail(`the purchase cost nothing (gold ${after.gold} of 400)`);
await browser.close(); await server.close();
