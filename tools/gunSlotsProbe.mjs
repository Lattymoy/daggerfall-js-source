// THUNDERLOCK-ART (2026-10-07, AUDIT SD III's companion; Mac: "The thunderlock/ammo also doesnt recieve proper artwork
// in slots like the hotbar or inventory") - THE GUN AND ITS SHOT IN THEIR SLOTS, DRAWN AND MEASURED.
//
// A pin can say an item resolves to an archive and a record; only a layout engine can say the picture in the slot reads
// as a gun. So the REAL pack (ui/inventoryDoor.js createInventoryWindow, the enhanced skin) and the REAL hotbar
// (ui/enhancedHotbar.js) are drawn here over the real sheets with a Dwarven Thunderlock worn, a stack of Dwemer Pellets
// carried and (THE GILDED RUNG) the Hourlock beside them, and each slot's picture is read back: which art it drew
// (the item's archive and record, through the one door every slot asks - itemTemplates.js inventoryItemImage), its
// natural size, and how much of the slot it fills. Every state is photographed.
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/setUiProbe.mjs's reason).
//
//     node tools/gunSlotsProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/gunSlotsProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'gunslots.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>gun slots probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}#dock{position:fixed;left:0;right:0;bottom:12px;display:flex;justify-content:center}</style></head><body><div id="dock"></div>
<script type="module">
import { createThunderlock, createPellets, installThunderlockIcons } from '/src/systems/thunderlock.js';
import { inventoryItemImage } from '/src/systems/itemTemplates.js';
import { equipItem } from '/src/systems/equip.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { createInventoryWindow } from '/src/ui/inventoryDoor.js';
import { mountHotbarDock, drawEnhancedHotbar, hotbarDropItem, HOTBAR_PREF } from '/src/ui/enhancedHotbar.js';
let gilded = null;
try { gilded = await import(/* @vite-ignore */ ['', 'src', 'systems', 'gilded.js'].join('/')); } catch { gilded = null; }   // THE GILDED RUNG, where it exists

setPref('lootRarity', true);
setPref(HOTBAR_PREF, 'hotbar');
installThunderlockIcons();   // as systems/worldTick.js does at its import, which every host loads
const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Archer' }, level: 30,
  stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 70, speed: 50, personality: 50, luck: 50 },
  skills: new Array(35).fill(60), health: 100, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
  items: [], spells: [], activeEffects: [], career2: null };
const gun = createThunderlock();
const pellets = createPellets(30);
e.items.push(gun, pellets);
equipItem(e, gun);
const hourlock = gilded?.mintHourlock ? gilded.mintHourlock() : null;
if (hourlock) e.items.push(hourlock);
globalThis.__images = () => [gun, pellets, hourlock].filter(Boolean).map((it) => ({ name: it.name ?? it.shortName, image: inventoryItemImage(it, e) }));
let pack = null;
globalThis.__openPack = () => {
  pack?.dispose?.();
  pack = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  return !!pack;
};
globalThis.__tab = (label) => { const b = [...document.querySelectorAll('#enhanced-inventory .packtab')].find((x) => x.textContent.startsWith(label)); b?.click(); return !!b; };
// CLOSED THROUGH ITS OWN DOOR (the overlay's dispose): the pack holds the hotbar in its drop mode while it is up, and a
// pack whose DOM is merely removed never lets go - the bar stayed tucked under a window that was gone
globalThis.__closePack = () => { pack?.dispose?.(); pack = null; return !document.getElementById('enhanced-inventory'); };
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.x + r.width, b: r.y + r.height }; };
globalThis.__packPictures = () => [...document.querySelectorAll('#enhanced-inventory img')].filter((i) => i.getClientRects().length)
  .map((i) => ({ src: (i.getAttribute('src') ?? '').slice(0, 40), nat: [i.naturalWidth, i.naturalHeight], box: box(i), slot: box(i.closest('.itemrow, .wornrow, .wornsock, .tile, button') ?? i.parentElement), row: i.closest('.itemrow, .wornrow, .wornsock')?.textContent?.trim().slice(0, 40) ?? '' }));
globalThis.__hotbar = () => {
  mountHotbarDock(document.getElementById('dock'));
  hotbarDropItem(0, gun); hotbarDropItem(1, pellets); if (hourlock) hotbarDropItem(2, hourlock);
  drawEnhancedHotbar(e, {});
  return true;
};
// a picture in the DOM that the eye cannot see is no picture: hidden, transparent or tucked away by any ancestor (the
// bar is pointer-transparent outside a drag, so a hit-test would pass straight through it and prove nothing)
const onTop = (i) => { let op = 1; for (let n = i; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity); return i.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && op > 0.5 ? 'self' : 'hidden (opacity ' + op.toFixed(2) + ')'; };
globalThis.__hotbarPictures = () => [...document.querySelectorAll('.hb-icon')].slice(0, 3).map((i) => ({ shown: getComputedStyle(i).display !== 'none' && !!i.getAttribute('src'), top: onTop(i), nat: [i.naturalWidth, i.naturalHeight], box: box(i), slot: box(i.closest('.hb-slot') ?? i.parentElement) }));
globalThis.__redraw = () => { drawEnhancedHotbar(e, {}); return true; };
globalThis.__ready = true;
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const settle = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    page.on('console', (m) => { if (/\[icons\]|vendor|texture/i.test(m.text())) console.log(`${v.name}: console ${m.type()} ${m.text().slice(0, 200)}`); });
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 90000 });
    console.log(`${v.name}: images ${JSON.stringify(await page.evaluate(() => globalThis.__images()))}`);
    // ── THE PACK ──
    check(await page.evaluate(() => globalThis.__openPack()), `${v.name}: the pack did not open`);
    await page.waitForSelector('#enhanced-inventory .packtab', { timeout: 30000 });
    check(await page.evaluate(() => globalThis.__tab('Weapons')), `${v.name}: no Weapons page`);
    await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    for (let i = 0; i < 20; i++) await settle(page);   // the art's own fetch and fit land a few frames on
    await page.waitForTimeout(400);
    for (let i = 0; i < 6; i++) await settle(page);
    const pics = await page.evaluate(() => globalThis.__packPictures());
    console.log(`${v.name}: pack pictures ${JSON.stringify(pics)}`);
    await page.screenshot({ path: join(OUT, `gunslots-${v.name}-pack.png`) });
    check(await page.evaluate(() => globalThis.__closePack()), `${v.name}: the pack did not close`);
    // ── THE HOTBAR ──
    check(await page.evaluate(() => globalThis.__hotbar()), `${v.name}: the hotbar did not mount`);
    for (let i = 0; i < 20; i++) { await page.evaluate(() => globalThis.__redraw()); await settle(page); }
    await page.waitForTimeout(400);
    for (let i = 0; i < 6; i++) { await page.evaluate(() => globalThis.__redraw()); await settle(page); }
    const hb = await page.evaluate(() => globalThis.__hotbarPictures());
    console.log(`${v.name}: hotbar pictures ${JSON.stringify(hb)}`);
    for (const [k, h] of hb.entries()) {
      check(h.shown, `${v.name}: hotbar slot ${k + 1} draws no picture`);
      check(h.top === 'self', `${v.name}: hotbar slot ${k + 1} is ${h.top}`);
    }
    const dock = await page.evaluate(() => { const r = document.getElementById('dock').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const slots = hb.map((h) => h.slot).filter(Boolean);
    if (slots.length) {
      const x0 = Math.max(0, Math.min(...slots.map((s) => s.x)) - 16), y0 = Math.max(0, Math.min(...slots.map((s) => s.y)) - 16);
      const x1 = Math.min(v.viewport.width, Math.max(...slots.map((s) => s.r)) + 16), y1 = Math.min(v.viewport.height, Math.max(...slots.map((s) => s.b)) + 16);
      await page.screenshot({ path: join(OUT, `gunslots-${v.name}-hotbar.png`), clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
    } else await page.screenshot({ path: join(OUT, `gunslots-${v.name}-hotbar.png`), clip: { x: 0, y: Math.max(0, dock.y - 80), width: v.viewport.width, height: Math.min(200, v.viewport.height) } });
    await ctx.close();
  }
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
console.log(`\n${checks - fails.length}/${checks} checks${fails.length ? ':' : ''}`);
for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`shots in ${OUT}`);
process.exitCode = fails.length ? 1 : 0;
