// PX31 - THE PACK'S LAYOUT, MEASURED IN A REAL BROWSER.
//
// PX31 is a MEDIA QUERY and node cannot see one, so this is its only
// pin. It is deliberately a NEW probe rather than more checks bolted
// onto enhancedPackProbe.mjs, whose body still asserts the U53 slot
// map (`.node`, `.node.filled`) that PX19d and PX20a replaced with the
// worn map - a separate rot with its own repair, and not something to
// bury inside a layout slice.
//
// Every number here was MEASURED on the shipped screen before the
// change, because the reverted 2026-08-31 pack attempt picked 74px and
// 820px against a fixture page and both were wrong in play. At
// 1440x900, 1920x1080 and 1280x720 - all identical, since .pack-win is
// min(660px, 94dvh) and the cap binds on every desktop - the window
// was 1040x660, the title bar 62, the character region 400, the tab
// strip 38, and the item list was left A 116px VIEWPORT.
//
// The checks are GEOMETRIC on purpose. They ask where the dock is and
// how much the list got, not what a rule says, so each one fails when
// the breakpoint is disabled rather than when a selector is renamed.
//
// PACK-PHONE (FIELD BUGS 2026-09-30, "Still can't use my bag/Inventory on mobile"): THE PHONE, WITH ITS DOLL. The
// phone case below measured a Pixel 5 with no ARENA2 behind the page - no doll art - and the stacked list with the art
// was 0px: a phone on its side (915x412) could reach none of its tiles, and upright (412x915) the worn panels' columns
// came to 0px and the list to 8px. The container still has no ARENA2, so the page stands the art in: a 440x736 figure
// (the classic doll's 110x184 at paperDollDataUrl's 4x) wherever the pack draws its Avatar plaque, repainted with every
// render. For each phone this reads the list a finger has, whether every tile in its first row and Close and Body are
// the topmost thing at their centres, that the body is hidden until Body and capped when shown, that the worn panels
// keep their width, and that a worn piece is still a tap from its card and its Take off; a tablet and a narrow mouse
// window keep the figure, capped; the desk is PX31's and keeps its doll whole. The probe no longer boots the game:
// the front door it clicked through ('.doorbtn') is gone, so like tools/cardFitProbe.mjs it draws the REAL pack
// (ui/inventoryDoor.js createInventoryWindow) on a page of its own, on VITE'S OWN DEV SERVER (tools/qs3Probe.mjs's
// reason).
//
//     node tools/enhancedPackLayoutProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/enhancedPackLayoutProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium, devices } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'packlayout.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');
/** Two rows of a phone's 56px tiles and their gaps: the least list a player can scan. */
const LIST_FLOOR = 120;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PACK layout probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { equipItem } from '/src/systems/equip.js';
import { setItemFields, mintCondition } from '/src/systems/item/itemTemplates.js';
import { ITEM_TEMPLATES } from '/src/characters/paperdoll/paperdoll.js';
import { createInventoryWindow } from '/src/ui/inventoryDoor.js';

// the doll's art, stood in wherever the pack draws its Avatar plaque, every render
let art = null, wantArt = false;
const artUrl = () => {
  if (art) return art;
  const cv = document.createElement('canvas'); cv.width = 440; cv.height = 736;
  const g = cv.getContext('2d'); g.fillStyle = '#c9a27e'; g.beginPath(); g.arc(220, 110, 70, 0, 7); g.fill();
  g.fillStyle = '#6b4a2e'; g.fillRect(120, 190, 200, 300); g.fillRect(150, 490, 60, 240); g.fillRect(230, 490, 60, 240);
  return (art = cv.toDataURL());
};
new MutationObserver(() => {
  if (!wantArt) return;
  for (const f of document.querySelectorAll('#enhanced-inventory .wornmap-doll.noart')) {
    const img = document.createElement('img'); img.src = artUrl(); img.alt = 'Your character';
    f.className = 'wornmap-doll hasart'; f.replaceChildren(img);
  }
}).observe(document.body, { childList: true, subtree: true });

let e = null, cloak = null;
globalThis.__open = (count, withArt) => {
  wantArt = !!withArt;
  document.getElementById('enhanced-inventory')?.remove();
  e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 3,
    stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
    skills: new Array(35).fill(40), health: 60, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
    items: [], spells: [], activeEffects: [], career2: null };
  const t = ITEM_TEMPLATES.find((x) => x.name === 'Dagger');
  for (let i = 0; i < count; i++) e.items.push({ name: t.name, templateIndex: t.index, group: 'Weapons', stackCount: 1, currentCondition: 50, maxCondition: 50 });
  cloak = mintCondition(setItemFields({ group: 'MensClothing', templateIndex: 154, flags: 0 }));
  e.items.push(cloak); equipItem(e, cloak);
  return !!createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
};
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
/** the topmost thing at a control's centre is the control, and the centre is on the screen */
const reach = (n) => {
  if (!n) return false;
  const b = n.getBoundingClientRect(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  if (!(b.width > 0 && b.height > 0) || cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) return false;
  const top = document.elementFromPoint(cx, cy);
  return !!top && (top === n || n.contains(top));
};
const q = (s) => document.querySelector('#enhanced-inventory ' + s);
const headBtn = (...labels) => [...document.querySelectorAll('#enhanced-inventory .pack-id button')].find((b) => labels.includes(b.textContent));
globalThis.__measure = () => {
  const vh = innerHeight;
  const lists = q('.packlists');
  const lb = box(lists);
  const tiles = [...document.querySelectorAll('#enhanced-inventory .packlists .itemrow')];
  const top = tiles.length ? Math.min(...tiles.map((t) => t.getBoundingClientRect().top)) : 0;
  const first = tiles.filter((t) => Math.abs(t.getBoundingClientRect().top - top) < 2);
  const doll = q('.wornmap-doll');
  const cells = [...document.querySelectorAll('#enhanced-inventory .wornmap > .wornrow, #enhanced-inventory .wornmap > .wornpair')];
  const cats = q('.packcats');
  const cb = cats && cats.getBoundingClientRect();
  const tabs = [...document.querySelectorAll('#enhanced-inventory .packcats .packtab')];
  const body = headBtn('Body', 'Hide body');
  return {
    vh, main: box(q('.pack-main')), dock: box(q('.pack-dock')), charcol: box(q('.charcol')), shelf: box(q('.wornshelf')),
    list: lb ? Math.max(0, Math.min(lb.b, vh) - Math.max(lb.y, 0)) : 0,
    listScrolls: lists ? lists.scrollHeight > lists.clientHeight + 1 : false,
    tiles: tiles.length, firstRow: first.length, firstRowReach: first.filter(reach).length,
    close: reach(headBtn('Close')), body: body ? { label: body.textContent, shown: getComputedStyle(body).display !== 'none', reach: reach(body) } : null,
    doll: doll ? { shown: getComputedStyle(doll).display !== 'none', art: doll.classList.contains('hasart'), ...box(doll) } : null,
    cellMinW: cells.length ? Math.min(...cells.map((c) => c.getBoundingClientRect().width)) : 0,
    // nothing of the region past its own right edge, or the screen's: the worn panels and the shelf all in view sideways
    sideways: (() => { const m = q('.pack-main'); if (!m) return 0; const r = m.getBoundingClientRect();
      const right = Math.max(...[...cells, ...document.querySelectorAll('#enhanced-inventory .wornshelf')].map((c) => c.getBoundingClientRect().right));
      return Math.max(0, m.scrollWidth - m.clientWidth, right - Math.min(r.right, innerWidth)); })(),
    tabs: tabs.length,
    tabRows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().y))).size,
    tabCols: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().x))).size,
    tabsInside: !!cb && tabs.every((t) => { const g = t.getBoundingClientRect(); return g.right <= cb.right + 1 && g.bottom <= cb.bottom + 1; }),
  };
};
globalThis.__body = () => { const b = headBtn('Body', 'Hide body'); b?.click(); return !!b; };
/** a worn piece with the body hidden: its panel's tap is its card, and the card's Take off takes it off */
globalThis.__wornTap = () => {
  const panel = [...document.querySelectorAll('#enhanced-inventory .wornrow')].find((n) => n.querySelector('.wornslot')?.textContent === 'Cloaks');
  const panelReach = reach(panel);
  panel?.scrollIntoView({ block: 'nearest' });
  panel?.click();
  const off = [...document.querySelectorAll('.packtip .acts button')].find((b) => b.textContent === 'Take off');
  const offReach = reach(off);
  off?.click();
  return { panel: !!panel, panelReach, off: !!off, offReach, worn: cloak.equipSlot != null };
};
globalThis.__ready = true;
</script></body></html>`;

const touch = { isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const PHONES = [
  { name: 'phone-side-915x412', viewport: { width: 915, height: 412 } },
  { name: 'phone-side-bars-915x340', viewport: { width: 915, height: 340 } },   // the same phone less Chrome's bars
  { name: 'phone-side-740x360', viewport: { width: 740, height: 360 } },
  { name: 'phone-412x915', viewport: { width: 412, height: 915 } },
  { name: 'phone-bars-412x780', viewport: { width: 412, height: 780 } },
  { name: 'phone-small-360x640', viewport: { width: 360, height: 640 } },
];
const FIGURES = [   // stacked, the figure kept and capped: a tablet upright, a narrow mouse window
  { name: 'tablet-768x1024', ctx: { viewport: { width: 768, height: 1024 }, ...touch } },
  { name: 'window-900x700', ctx: { viewport: { width: 900, height: 700 } } },
];

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};
const settle = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));

async function open(ctxOpts, count, art) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 90000 });
  await page.evaluate(([n, a]) => globalThis.__open(n, a), [count, art]);
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return { ctx, page, errors };
}
const fmt = (m) => `list ${Math.round(m.list)}px, first row ${m.firstRowReach}/${m.firstRow} reachable, doll ${m.doll?.shown ? `${Math.round(m.doll.w)}x${Math.round(m.doll.h)}` : 'hidden'}, panels ${Math.round(m.cellMinW)}px wide at least`;

async function desk(label, viewport) {
  // PX31's own checks, with the doll's art stood in - the desk is not the phone's rule and keeps its figure whole
  const { ctx, page, errors } = await open({ viewport }, 40, true);
  const m = await page.evaluate(() => globalThis.__measure());
  console.log(`${label}: ${fmt(m)}`);
  // THE DOCK IS A COLUMN BESIDE THE REGION. Stacked, it begins below
  // the region's bottom; as a column it shares the region's top and
  // starts at its right edge. This is the check the breakpoint owns,
  // and it is the one that dies when the breakpoint does.
  check(`${label}: the dock is a COLUMN beside the character region`,
    m.dock.x >= m.main.r - 2 && Math.abs(m.dock.y - m.main.y) <= 4,
    `dock x${Math.round(m.dock.x)} y${Math.round(m.dock.y)}, region right ${Math.round(m.main.r)} y${Math.round(m.main.y)}`);
  // AND IT WAS WORTH DOING. 116 is the measured before and 483 is
  // what shipped; the floor sits between them, well clear of both,
  // so the pin holds a LAW rather than a font's rounding.
  check(`${label}: the item list clears the dock's old ceiling`, m.list >= 380, `${Math.round(m.list)}px viewport (116 stacked)`);
  // THE REGION FILLS THE COLUMN IT WAS GIVEN - no dead glass under what
  // stands last in it (PLUS11: the accessory shelf, where PX21a's
  // transport strip stood when this was written).
  check(`${label}: no dead glass under the accessory shelf`, m.charcol.b - m.shelf.b <= 40, `${Math.round(m.charcol.b - m.shelf.b)}px of slack`);
  // PX31's NINE PAGES, three by three, all inside the box.
  check(`${label}: the tab strip is a 3x3 and stays in its box`,
    m.tabs === 9 && m.tabRows === 3 && m.tabCols === 3 && m.tabsInside, `${m.tabs} tabs, ${m.tabRows}x${m.tabCols}, inside=${m.tabsInside}`);
  // PACK-PHONE: the desk keeps its figure whole (it is height-driven in rows of 1fr, never the phone's cap) and no Body
  check(`${label}: the figure stands whole, no Body button`, m.doll.shown && m.doll.art && m.doll.h > 300 && !m.body?.shown,
    `doll ${Math.round(m.doll.h)}px tall, body button ${m.body?.shown ? 'shown' : 'hidden'}`);
  await page.screenshot({ path: join(OUT, `packlayout-${label}.png`) });
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function phone(label, ctxOpts) {
  const { ctx, page, errors } = await open(ctxOpts, 40, true);
  const vh = ctxOpts.viewport.height;
  let m = await page.evaluate(() => globalThis.__measure());
  console.log(`${label}: ${fmt(m)}`);
  check(`${label}: the list is a list - ${LIST_FLOOR}px at least`, m.list >= LIST_FLOOR, `${Math.round(m.list)}px`);
  check(`${label}: every tile in its first row is a finger's`, m.firstRow > 0 && m.firstRowReach === m.firstRow, `${m.firstRowReach}/${m.firstRow}`);
  check(`${label}: Close is on the screen and pressable`, m.close);
  check(`${label}: Body is on the screen and pressable`, !!m.body?.shown && m.body.reach && m.body.label === 'Body', JSON.stringify(m.body));
  check(`${label}: the body is hidden until Body`, m.doll && !m.doll.shown);
  check(`${label}: the worn panels keep their width`, m.cellMinW >= 100, `${Math.round(m.cellMinW)}px`);
  check(`${label}: nothing of the region runs past it sideways`, m.sideways <= 1, `${Math.round(m.sideways)}px`);
  check(`${label}: a list of forty scrolls inside the dock`, m.listScrolls);
  await page.screenshot({ path: join(OUT, `packlayout-${label}.png`) });
  // the item count never sizes the region: the same pack with five items
  const many = m.main.h;
  await page.evaluate(() => globalThis.__open(5, true));
  await settle(page);
  const few = (await page.evaluate(() => globalThis.__measure())).main.h;
  check(`${label}: the region is the same height with five items as with forty`, Math.abs(few - many) <= 1, `${Math.round(few)} / ${Math.round(many)}`);
  // Body shows it, capped; the list keeps its floor
  await page.evaluate(() => globalThis.__body());
  await settle(page);
  m = await page.evaluate(() => globalThis.__measure());
  console.log(`${label} (Body): ${fmt(m)}`);
  check(`${label}: Body shows the figure`, m.doll?.shown && m.doll.art && m.body?.label === 'Hide body' && m.body.reach, JSON.stringify(m.body));
  check(`${label}: the figure is capped at a third of the screen and 240px`, m.doll.h <= Math.min(vh * 0.34, 240) + 1, `${Math.round(m.doll.h)}px`);
  check(`${label}: with the figure the panels keep a width and the list its floor`, m.cellMinW >= 60 && m.list >= LIST_FLOOR,
    `${Math.round(m.cellMinW)}px panels, ${Math.round(m.list)}px list`);
  check(`${label}: and nothing of the region runs past it sideways`, m.sideways <= 1, `${Math.round(m.sideways)}px`);
  await page.screenshot({ path: join(OUT, `packlayout-${label}-body.png`) });
  // hidden again: a worn piece is still a tap from its card, and its Take off takes it off
  await page.evaluate(() => globalThis.__body());
  await settle(page);
  const t = await page.evaluate(() => globalThis.__wornTap());
  check(`${label}: with the body hidden, the cloak's panel opens its card and Take off takes it off`,
    t.panel && t.panelReach && t.off && t.offReach && !t.worn, JSON.stringify(t));
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function figure(label, ctxOpts) {
  const { ctx, page, errors } = await open(ctxOpts, 40, true);
  const m = await page.evaluate(() => globalThis.__measure());
  console.log(`${label}: ${fmt(m)}`);
  check(`${label}: the list is a list - ${LIST_FLOOR}px at least`, m.list >= LIST_FLOOR, `${Math.round(m.list)}px`);
  check(`${label}: every tile in its first row is reachable`, m.firstRow > 0 && m.firstRowReach === m.firstRow, `${m.firstRowReach}/${m.firstRow}`);
  check(`${label}: Close is on the screen and pressable`, m.close);
  check(`${label}: the figure stands, capped at 240px, and no Body button`, m.doll?.shown && m.doll.art && m.doll.h <= 241 && !m.body?.shown,
    `doll ${Math.round(m.doll?.h ?? 0)}px`);
  check(`${label}: the worn panels keep their width`, m.cellMinW >= 100, `${Math.round(m.cellMinW)}px`);
  check(`${label}: nothing of the region runs past it sideways`, m.sideways <= 1, `${Math.round(m.sideways)}px`);
  await page.screenshot({ path: join(OUT, `packlayout-${label}.png`) });
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  // The three desktop sizes measured identical, because the window is
  // capped at 660 on all of them - so the narrow one is the interesting
  // one: it is the closest to the 1000px breakpoint that still takes it.
  await desk('1440x900', { width: 1440, height: 900 });
  await desk('1280x720', { width: 1280, height: 720 });
  // THE PHONE: PX31's Pixel 5 (it measured one with no doll), and the phones the report's screenshots are
  for (const p of [{ name: 'pixel5', ctx: devices['Pixel 5'] }, ...PHONES.map((v) => ({ name: v.name, ctx: { viewport: v.viewport, ...touch } }))]) {
    await phone(p.name, p.ctx);
  }
  for (const f of FIGURES) await figure(f.name, f.ctx);
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
console.log(`shots in ${OUT}`);
process.exitCode = bad.length ? 1 : 0;
