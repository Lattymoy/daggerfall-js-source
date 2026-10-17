// GRIM1 - DFO GRIMOIRE, in a real browser, WITH NO ARENA2. What the suite cannot say: the dress lands on the page with
// the pack's art cut and laid (ui/grimoireArt.js), the front door's doors are written on the desk's open book, the
// pack stands in GrimoireUI's own roster (the tab plates in one row, the jewellery down the left, the goods on the
// right), a press on a page is written in ink and the way out wears the red Exit, the Ascend is the character book (the
// attributes down the left page, the skills down the right), and the vitals are the pack's three vials upright in the
// corner in Daggerfall's order. Pictures of each go to SHOT_DIR.
//
//     node tools/grimoireDressProbe.mjs          (stands its own dev server; SHOT_DIR for the pictures)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0, checks = 0;
const check = (name, ok, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5243, strictPort: true }, logLevel: 'silent' });
await server.listen();
const BASE = 'http://localhost:5243';
const browser = await chromium.launch({ headless: true });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));

/** Wear the dress on the shelf, then load the front door with it. */
async function frontDoor() {
  await page.goto(`${BASE}/play/?skin=enhanced&nointro&nofonts`, { waitUntil: 'load', timeout: 180000 });
  await page.evaluate(async () => { (await import('/src/systems/uiPrefs.js')).setPref('plusDress', 'grimoire'); });
  await page.goto(`${BASE}/play/?skin=enhanced&nointro&nofonts`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForSelector('#enhanced-menu .doorbtn', { timeout: 90000 });
  const close = page.locator('.px-acctstage button', { hasText: /^close$/i });
  if (await close.count()) await close.first().click();
  await page.waitForFunction(() => document.documentElement.dataset.grimArt === 'ready', null, { timeout: 30000 }).catch(() => {});
}

// ── the front door ───────────────────────────────────────────────────────────────────────────────────────────────────
await frontDoor();
const door = await page.evaluate(() => {
  const root = document.documentElement;
  const doors = [...document.querySelectorAll('#enhanced-menu .px-menu .doorbtn')].map((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { x: r.x, w: r.width, bg: cs.backgroundImage, plusFace: /Pixelify/.test(cs.fontFamily) }; });
  return { dress: root.dataset.plusDress, theme: root.dataset.plusTheme, art: root.dataset.grimArt, kit: !!document.getElementById('dfo-grimoire-kit'), ink: document.getElementById('dfo-grimoire-ink')?.textContent.length ?? 0,
    frame: getComputedStyle(root).getPropertyValue('--grim-frame').startsWith('url("data:image/png'), doors };
});
check('the dress is worn: the root says so, the colour stands at Slate, the kit and the ink are on the page', door.dress === 'grimoire' && door.theme === 'slate' && door.kit && door.ink > 100000, JSON.stringify({ ...door, doors: door.doors.length }));
check('...and the pack\'s art is cut and laid on the root', door.art === 'ready' && door.frame);
const cols = [...new Set(door.doors.map((d) => Math.round(d.x / 50)))];
check('the doors are written on the book\'s two pages - two columns, no plate behind a word, no pixel face', cols.length === 2 && door.doors.every((d) => d.bg === 'none' && !d.plusFace), JSON.stringify(door.doors.map((d) => Math.round(d.x))));
await page.screenshot({ path: `${OUT}/grim-frontdoor.png` });

// ── the pack ─────────────────────────────────────────────────────────────────────────────────────────────────────────
await page.evaluate(async () => {
  const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
  const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll/paperdoll.js');
  const tp = ITEM_TEMPLATES.find((x) => x.name === 'Longsword');
  const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: [{ name: tp.name, templateIndex: tp.index, group: 'Weapons', stackCount: 1, currentCondition: 50, maxCondition: 50 }] };
  globalThis.__inv = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
});
await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 30000 });
await page.locator('#enhanced-inventory .itemrow').first().click();
await page.waitForTimeout(500);
const pack = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('#enhanced-inventory .packtab')].map((t) => Math.round(t.getBoundingClientRect().top));
  const shelf = document.querySelector('#enhanced-inventory .wornshelf').getBoundingClientRect();
  const doll = document.querySelector('#enhanced-inventory .equipped').getBoundingClientRect();
  const list = document.querySelector('#enhanced-inventory .packlists').getBoundingClientRect();
  const wear = [...document.querySelectorAll('#enhanced-inventory button')].find((b) => b.textContent.trim() === 'Wear');
  const closeBtn = [...document.querySelectorAll('#enhanced-inventory button')].find((b) => b.textContent.trim() === 'Close');
  const card = wear?.closest('.card');
  return { tabsOneRow: new Set(tabs).size === 1 && tabs.length === 9, order: shelf.right <= doll.left && doll.right <= list.left,
    wearOn: wear?.dataset.grimOn, wearBg: wear && getComputedStyle(wear).backgroundImage, exit: closeBtn?.dataset.grimExit != null && /^url\("data/.test(getComputedStyle(closeBtn).borderImageSource),
    scroll: card && /^url\("data/.test(getComputedStyle(card).borderImageSource), tab: getComputedStyle(document.querySelector('#enhanced-inventory .packtab.on'), '::after').content };
});
check('the pack stands in GrimoireUI\'s roster: the nine tab plates in one row, the jewellery left of the body, the goods right of it', pack.tabsOneRow && pack.order, JSON.stringify(pack));
check('a press on a page is written there (no plate), the way out wears the red Exit, the item\'s card is a scroll, the chosen tab has no diamond', pack.wearOn === 'page' && pack.wearBg === 'none' && pack.exit && pack.scroll && /none|normal/.test(pack.tab), JSON.stringify(pack));
await page.screenshot({ path: `${OUT}/grim-pack.png` });

// ── the Ascend ───────────────────────────────────────────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/levelup.html?lane=door`, { waitUntil: 'load', timeout: 180000 });
await page.waitForSelector('.lv-star', { timeout: 60000 });
await page.waitForTimeout(800);
const asc = await page.evaluate(() => {
  const xs = [...document.querySelectorAll('.lv-star')].map((s) => Math.round(s.getBoundingClientRect().x));
  const ys = [...document.querySelectorAll('.lv-star')].map((s) => s.getBoundingClientRect().y);
  const sk = document.querySelector('.lv-ribbonwrap').getBoundingClientRect();
  const st = document.querySelector('.lv-stage').getBoundingClientRect();
  const pts = document.querySelector('.lv-plate').getBoundingClientRect();
  return { column: new Set(xs).size === 1, rising: ys.every((y, i) => i === 0 || y > ys[i - 1]), skillsRight: sk.left >= st.right, pointsUnder: pts.top >= st.bottom - 1,
    book: getComputedStyle(document.querySelector('.lv-sky'), '::after').borderImageSource.startsWith('url("data'), lines: getComputedStyle(document.querySelector('.lv-lines')).display };
});
check('the Ascend is the character book: the eight attributes a ledger down the left page, the points under them, the skills down the right page, Plus\'s star lines gone', asc.column && asc.rising && asc.skillsRight && asc.pointsUnder && asc.book && asc.lines === 'none', JSON.stringify(asc));
await page.screenshot({ path: `${OUT}/grim-ascend.png` });

// ── the vitals ───────────────────────────────────────────────────────────────────────────────────────────────────────
await frontDoor();
await page.evaluate(async () => {
  document.getElementById('enhanced-menu')?.remove();
  const { drawEnhancedHud } = await import('/src/ui/enhanced/enhancedHud.js');
  const e = { name: 'A', stats: {}, health: 9, maxHealth: 40, fatigue: 150, maxFatigue: 200, magicka: 12, maxMagicka: 20, items: [], spells: [] };
  const f = () => { drawEnhancedHud(e, 0.25, 1 / 60, {}); requestAnimationFrame(f); }; f();
});
await page.waitForTimeout(1200);
const vit = await page.evaluate(() => ['health', 'fatigue', 'magicka'].map((k) => { const r = document.querySelector(`.hud-${k} .hud-track`).getBoundingClientRect(); return { k, x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(document.querySelector(`.hud-${k} .hud-fill`)).backgroundImage.slice(0, 20) }; }));
check('the vitals are the pack\'s vials standing upright in the corner, health, fatigue and magicka from the left', vit.every((v) => v.h > v.w * 4 && v.x < 200 && v.bg.startsWith('url("data')) && vit[0].x < vit[1].x && vit[1].x < vit[2].x, JSON.stringify(vit));
await page.screenshot({ path: `${OUT}/grim-hud.png` });

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
