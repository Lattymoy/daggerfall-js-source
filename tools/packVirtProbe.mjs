// VIRT (2026-10-16) - THE LONG PACK, DRIVEN IN A BROWSER AND TIMED.
//
// A container of 700 pieces over 351 kinds (312 pictures), the player's own storage of 700 beside the pack, and a pack
// page of 700: how long the window takes to open cold and warm, how many times it repaints while its pictures land, how
// long a press takes, and whether the long list is still the whole list - every drawn row at its piece's own place to
// the pixel and none in view missing, the list one height at every scroll, its columns still, its last piece flush at
// the foot, a press's act done and its scroll kept, a search's scroll kept. AUDIT VIRT added the rest: a hover card
// whose row a scroll took away, a carried tile across a scroll, a focused row scrolled away. The archives are SYNTHETIC (tools/enhancedIconProbe.mjs's device:
// a valid TEXTURE file built here and served by intercepting the fetch) - no ARENA2 is read, and the timings are this
// machine's, said as such. Run it on a tree without VIRT for the before.
//
//     node tools/packVirtProbe.mjs            (starts its own dev server)
//     PROBE_PORT=5199 node tools/packVirtProbe.mjs
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'packvirt.tmp.html';
const N = Number(process.env.PILE ?? 700);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VIRT probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#333}</style></head><body>
<script type="module">
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '/src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '/src/systems/armorMaterials.js';
import { createInventoryWindow } from '/src/ui/inventoryDoor.js';

const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 12,
  stats: { strength: 90, endurance: 90, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  skills: new Array(35).fill(40), health: 60, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
  items: [], spells: [], activeEffects: [], career2: null };
const thing = (group, t) => mintCondition(setItemFields({ group, templateIndex: t }));
// the kinds: every weapon in every metal, every armour piece in every material, and the small things
const kinds = [];
for (let t = 113; t <= 131; t++) for (let m = 0; m <= 9; m++) kinds.push(() => createWeapon(t, m));
for (let t = 102; t <= 111; t++) for (const m of Object.values(ARMOR_MATERIAL)) kinds.push(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: t, material: m, flags: 0 })));
for (let t = 0; t <= 12; t++) kinds.push(() => thing('Gems', t));
for (let t = 133; t <= 140; t++) kinds.push(() => thing('Jewellery', t));
const pile = (n, only = null) => { const ks = only ? kinds.slice(0, only) : kinds; return Array.from({ length: n }, (_, i) => ks[(i * 7) % ks.length]()); };
let loot = [];
globalThis.__kinds = kinds.length;
const close = () => { document.getElementById('enhanced-inventory')?.remove(); document.querySelectorAll('.inv-tip,.dragghost').forEach((n) => n.remove()); };
const frame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
/** Open: a container (n pieces, the loot window alone), the player's own storage (n pieces beside the pack - the store's
 *  filter and the paired layout) or the pack (n weapons, its Weapons page). Timed to the frame. */
globalThis.__open = async (n, where) => {
  close();
  if (where === 'pack') { e.items = pile(n, 190); loot = []; } else { e.items = where === 'storage' ? pile(12) : []; loot = pile(n); }
  const deps = { entity: e, items: () => e.items, wagonItems: () => [] };
  if (where !== 'pack') deps.loot = { items: () => loot, storage: where === 'storage' };
  const t0 = performance.now();
  createInventoryWindow(deps);
  // the window mounts once its chunk has loaded (a task, warm): its rows are drawn when it does
  for (let i = 0; i < 2000 && !document.querySelector('#enhanced-inventory .itemrow'); i++) await new Promise((res) => setTimeout(res, 0));
  const built = performance.now() - t0;
  document.body.offsetHeight;
  const laid = performance.now() - t0;
  await frame();
  return { built, laid, framed: performance.now() - t0 };
};
globalThis.__close = close;
const listOf = (where) => document.querySelector(where === 'pack' ? '#enhanced-inventory .packlists' : '#enhanced-inventory .remotelist');
const colOf = (where) => (where === 'pack' ? listOf(where).querySelector('.packcol') : listOf(where));
const rowsIn = (where) => [...colOf(where).querySelectorAll('.itemrow')];
const itemsOf = (where) => (where === 'pack' ? e.items : loot);
globalThis.__state = (where) => {
  const l = listOf(where);
  if (!l) return null;
  const rows = [...l.querySelectorAll('.itemrow')];
  const p = JSON.parse(globalThis.__pack());
  return { rows: rows.length, initials: rows.filter((r) => !r.querySelector('.tile.has-icon')).length, tiles: document.querySelectorAll('#enhanced-inventory .tile').length,
    scrollHeight: l.scrollHeight, clientHeight: l.clientHeight, repaints: p.repaints, landings: p.landings ?? null, painted: p.painted ?? null };
};
/** The list scrolled to its foot: the row drawn last is the last piece - by the piece itself, not its name - flush. */
globalThis.__foot = async (where) => {
  const l = listOf(where);
  l.scrollTop = l.scrollHeight;
  await frame(); await frame();
  const last = rowsIn(where).at(-1);
  const lb = l.getBoundingClientRect(), rb = last.getBoundingClientRect();
  return { lastIsLast: last._padItem === itemsOf(where).at(-1), gapBelow: Math.round(lb.bottom - rb.bottom), scrollTop: l.scrollTop, scrollHeight: l.scrollHeight };
};
/** A press on a row in the middle of the list: its own time to the frame, and that it DID its act - a loot row's press
 *  takes the piece (IG7), a pack row's picks it and opens its card - with the list's scroll kept. */
globalThis.__pickMiddle = async (where) => {
  const l = listOf(where);
  l.scrollTop = l.scrollHeight / 2;
  await frame(); await frame();
  const lb = l.getBoundingClientRect();
  const row = rowsIn(where).find((r) => r.getBoundingClientRect().top > lb.top + 40);
  const item = row._padItem, count = itemsOf(where).length;
  const before = Math.round(l.scrollTop);
  const t0 = performance.now();
  row.click();
  const clicked = performance.now() - t0;
  await frame();
  const framed = performance.now() - t0;
  await frame();
  const did = where === 'pack'
    ? !!document.querySelector('#enhanced-inventory .pack-dock .itemrow.on') && !!document.querySelector('.packtip')
    : !loot.includes(item) && loot.length === count - 1 && e.items.includes(item);
  // the repaint built a new list: its scroll is the one the player sees
  return { clicked, framed, did, scrollBefore: before, scrollAfter: Math.round(listOf(where).scrollTop) };
};
/** At a share of the scroll, every drawn row stands EXACTLY where the whole list stands its piece - its line by its
 *  index, its column by the column's own left - and every piece whose place meets the band is drawn. */
globalThis.__placed = async (where, frac, query = '') => {
  const l = listOf(where);
  l.scrollTop = Math.round((l.scrollHeight - l.clientHeight) * frac);
  await frame(); await frame();
  const col = colOf(where);
  const rows = rowsIn(where);
  const { itemLine } = await import('/src/ui/enhanced/enhancedInventory.js');
  const items = itemsOf(where).filter((it) => !query || itemLine(it, e).name.toLowerCase().includes(query));
  const idx = rows.map((r) => items.indexOf(r._padItem));
  const boxes = rows.map((r) => r.getBoundingClientRect());
  const cols = boxes.filter((b) => Math.abs(b.top - boxes[0].top) < 1).length;
  const pitch = boxes.find((b) => b.top > boxes[0].top + 1).top - boxes[0].top;
  // the dock's column moves with its scroller; the loot list IS its scroller, so its content top is its box's less the scroll
  const top0 = col.getBoundingClientRect().top + parseFloat(getComputedStyle(col).paddingTop) - (col === l ? l.scrollTop : 0);
  const lefts = new Map();
  let wrong = 0, firstWrong = null;
  rows.forEach((r, i) => {
    const want = top0 + Math.floor(idx[i] / cols) * pitch, c = idx[i] % cols;
    if (!lefts.has(c)) lefts.set(c, boxes[i].left);
    if (idx[i] < 0 || Math.abs(boxes[i].top - want) > 0.5 || Math.abs(boxes[i].left - lefts.get(c)) > 0.5) {
      wrong++; firstWrong ??= { i, idx: idx[i], top: Math.round(boxes[i].top - top0), want: Math.round(want - top0) };
    }
  });
  const lb = l.getBoundingClientRect();
  const lo = Math.max(lb.top, 0), hi = Math.min(lb.bottom, innerHeight);
  const drawn = new Set(idx);
  let missing = 0;
  for (let k = Math.max(0, Math.floor((lo - top0) / pitch)) * cols; k < Math.min(items.length, (Math.floor((hi - top0) / pitch) + 1) * cols); k++) if (!drawn.has(k)) missing++;
  return { frac, scrollTop: Math.round(l.scrollTop), scrollHeight: l.scrollHeight, scrollWidth: l.scrollWidth, clientWidth: l.clientWidth,
    drawn: rows.length, cols, pitch, lefts: [...lefts.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => Math.round(v * 10) / 10), wrong, missing, firstWrong, items: items.length };
};
/** The store's search, typed deep in the list: the refill's own time, its focus, and its scroll kept as the whole list
 *  kept it (at most the filtered list's own foot). */
globalThis.__search = async (q) => {
  const f = document.querySelector('#enhanced-inventory .storesearch, .loot-win .storesearch');
  const l = listOf('storage');
  if (!f || !l) return null;
  l.scrollTop = Math.round(l.scrollHeight * 0.6);
  await frame(); await frame();
  const before = l.scrollTop;
  f.focus();
  const t0 = performance.now();
  f.value = q;
  f.dispatchEvent(new Event('input'));
  const typed = performance.now() - t0;
  await frame(); await frame();
  return { typed, focused: document.activeElement === f, before, after: l.scrollTop, max: l.scrollHeight - l.clientHeight };
};
/** A hover card from the pad - its cursor's enter, and no leave until it moves - and the list scrolled far under it:
 *  the row it stood beside goes with the window, and the card with the row. */
globalThis.__tipAway = async (where) => {
  const l = listOf(where);
  l.scrollTop = 0;
  await frame(); await frame();
  const row = rowsIn(where)[2];
  row.onmouseenter?.();
  const shown = !!document.querySelector('.inv-tip');
  l.scrollTop = l.scrollHeight;
  await frame(); await frame();
  return { shown, rowGone: !row.isConnected, tip: !!document.querySelector('.inv-tip') };
};
/** A mouse carrying a tile, and the list scrolled under the still pointer and back: the ghost names the act at the new
 *  point, and the carried tile is dimmed where it stands. */
globalThis.__dragScroll = async () => {
  const l = listOf('pack');
  l.scrollTop = 0;
  await frame(); await frame();
  const rows = rowsIn('pack');
  const src = rows[1], b = src.getBoundingClientRect();
  // a row on a later line that the pointer can reach - the phone's window lays its own chrome over some of the dock
  const reach = (r) => { const q = r.getBoundingClientRect(); return document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2)?.closest?.('.itemrow') === r; };
  const to = rows.find((r) => r.getBoundingClientRect().top > b.bottom && reach(r))?.getBoundingClientRect();
  if (!to) return null;
  const ev = (type, x, y) => new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, pointerType: 'mouse', bubbles: true, cancelable: true });
  src.dispatchEvent(ev('pointerdown', b.left + b.width / 2, b.top + b.height / 2));
  window.dispatchEvent(ev('pointermove', to.left + to.width / 2, to.top + to.height / 2));
  await frame();
  const before = document.querySelector('.dragghost .ghostact')?.textContent ?? null;
  l.scrollTop = 2500;
  await frame(); await frame();
  const after = document.querySelector('.dragghost .ghostact')?.textContent ?? null;
  l.scrollTop = 0;
  await frame(); await frame();
  const dimmed = document.querySelectorAll('#enhanced-inventory .itemrow.dragging').length;
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, bubbles: true }));
  await frame();
  return { before, after, dimmed };
};
/** A row holding the keyboard's focus, scrolled away by a jump to the end: the focus stays on the list, not the page. */
globalThis.__focusAway = async () => {
  const l = listOf('pack');
  l.scrollTop = 0;
  await frame(); await frame();
  const row = rowsIn('pack')[0];
  row.focus();
  l.scrollTop = l.scrollHeight;
  await frame(); await frame();
  const a = document.activeElement;
  return { rowGone: !row.isConnected, onList: a !== document.body && (a === l || l.contains(a) || a.contains(l)), held: a?.className ?? a?.tagName };
};
globalThis.__scrollTop = (where) => Math.round(listOf(where).scrollTop);
</script></body></html>`;

/** A 768-byte ART_PAL, a grey ramp. */
function synthPalette() {
  const b = Buffer.alloc(768);
  for (let i = 0; i < 256; i++) { b[i * 3] = i; b[i * 3 + 1] = i; b[i * 3 + 2] = i; }
  b[3] = 200; b[4] = 40; b[5] = 30;
  return b;
}
/** An uncompressed TEXTURE archive of `count` 16x16 records (tools/enhancedIconProbe.mjs's shape, larger). */
function synthArchive(count, W = 16, H = 16, STRIDE = 256) {
  const bodySize = 28 + H * STRIDE;
  const headersEnd = 26 + 20 * count;
  const buf = Buffer.alloc(headersEnd + bodySize * count);
  buf.writeInt16LE(count, 0);
  buf.write('SYNTHETIC', 2, 'ascii');
  for (let r = 0; r < count; r++) {
    const bodyAt = headersEnd + bodySize * r, hAt = 26 + 20 * r;
    buf.writeInt32LE(bodyAt, hAt + 2);
    buf.writeInt16LE(W, bodyAt + 4); buf.writeInt16LE(H, bodyAt + 6);
    buf.writeUInt32LE(bodySize - 28, bodyAt + 10); buf.writeUInt32LE(28, bodyAt + 14);
    buf.writeInt16LE(1, bodyAt + 18); buf.writeUInt16LE(1, bodyAt + 20);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) buf[bodyAt + 28 + y * STRIDE + x] = (x + y + r) % 3 ? 1 + (r % 200) : 0;
  }
  return buf;
}

const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = process.env.PROBE_PORT ?? vite.httpServer.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dpr: 1 },
  { name: 'phone', viewport: { width: 393, height: 851 }, dpr: 2.625, isMobile: true, hasTouch: true },
];
const out = {};
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: v.dpr, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const archive = synthArchive(128);
  await page.route('**/arena2/**', (route) => {
    const name = route.request().url().split('/').pop();
    if (name === 'ART_PAL.COL') return route.fulfill({ status: 200, body: synthPalette() });
    if (/^TEXTURE\.\d+$/.test(name)) return route.fulfill({ status: 200, body: archive });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof globalThis.__open === 'function', null, { timeout: 90000 });
  // the module's first load is not the window's cost: a small pile first
  await page.evaluate(() => globalThis.__open(3, 'loot'));
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 30000 });
  out.kinds = await page.evaluate(() => globalThis.__kinds);
  const res = out[v.name] = {};
  // long tasks, from here on
  await page.evaluate(() => { globalThis.__long = []; new PerformanceObserver((l) => { for (const t of l.getEntries()) globalThis.__long.push(t.duration); }).observe({ type: 'longtask' }); });
  for (const where of ['loot', 'storage', 'pack']) {
    const r = {};
    await page.evaluate(() => { globalThis.__long.length = 0; });
    const t0 = Date.now();
    r.cold = await page.evaluate(([n, w]) => globalThis.__open(n, w), [N, where]);
    // until the drawn rows' pictures settle: no initials left among them, or nothing moved for 1.5 s
    let last = null, still = 0;
    for (let i = 0; i < 300 && still < 15; i++) {
      await page.waitForTimeout(100);
      const s = await page.evaluate((w) => globalThis.__state(w), where);
      if (!s) continue;
      if (s.initials === 0) { last = s; break; }
      still = last && last.initials === s.initials && last.landings === s.landings ? still + 1 : 0;
      last = s;
    }
    r.settleMs = Date.now() - t0;
    r.settled = last;
    await page.waitForTimeout(1000);
    r.later = await page.evaluate((w) => globalThis.__state(w), where);
    r.longTasks = await page.evaluate(() => ({ count: globalThis.__long.length, ms: Math.round(globalThis.__long.reduce((a, b) => a + b, 0)), worst: Math.round(Math.max(0, ...globalThis.__long)) }));
    r.warm = await page.evaluate(([n, w]) => globalThis.__open(n, w), [N, where]);
    r.warmState = await page.evaluate((w) => globalThis.__state(w), where);
    r.pick = await page.evaluate((w) => globalThis.__pickMiddle(w), where);
    r.foot = await page.evaluate((w) => globalThis.__foot(w), where);
    r.placed = [];
    for (const f of [0, 0.13, 0.5, 0.77, 1, 0.31]) r.placed.push(await page.evaluate(([w, x]) => globalThis.__placed(w, x), [where, f]));
    r.tipAway = await page.evaluate((w) => globalThis.__tipAway(w), where);
    if (where === 'storage') {
      r.search = await page.evaluate(() => globalThis.__search('a'));
      r.searchPlaced = [];
      for (const f of [0, 0.5, 1]) r.searchPlaced.push(await page.evaluate(([w, x]) => globalThis.__placed(w, x, 'a'), [where, f]));
    }
    if (where === 'pack') {
      // the press above left its card up - a phone's is a sheet over the dock's foot: put away, as a player would
      if (await page.locator('.packtip').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
      r.drag = await page.evaluate(() => globalThis.__dragScroll());
      r.focus = await page.evaluate(() => globalThis.__focusAway());
      if (r.focus.onList) { await page.keyboard.press('Home'); await page.waitForTimeout(300); }
      r.focusHome = await page.evaluate(() => globalThis.__scrollTop('pack'));
    }
    res[where] = r;
    const tag = `${v.name} ${where}`;
    check(`${tag}: every drawn row's picture landed`, r.settled?.initials === 0, JSON.stringify(r.settled));
    if (r.later?.landings != null) {
      check(`${tag}: and the landing passes stopped (none in the second after)`, r.later.landings === r.settled.landings, `${r.settled.landings} -> ${r.later.landings}`);
      check(`${tag}: each tile was painted at most once`, r.later.painted <= r.later.tiles, `${r.later.painted} painted, ${r.later.tiles} tiles`);
    }
    check(`${tag}: a press did its act, and kept the list's scroll`, r.pick.did && r.pick.scrollAfter === r.pick.scrollBefore, JSON.stringify(r.pick));
    check(`${tag}: the foot of the scroll shows the last piece itself, flush`, r.foot.lastIsLast && Math.abs(r.foot.gapBelow) <= 8, JSON.stringify(r.foot));
    const all = [...r.placed, ...(r.searchPlaced ?? [])];
    for (const p of all) check(`${tag}: at ${p.frac} of the scroll${p.items < N - 1 ? ' (searched)' : ''} every drawn row stands at its piece's place, and none in view is missing`, p.wrong === 0 && p.missing === 0 && p.drawn > 0, `${p.drawn} drawn, ${p.wrong} wrong, ${p.missing} missing${p.firstWrong ? ` ${JSON.stringify(p.firstWrong)}` : ''}`);
    check(`${tag}: the list is one height at every scroll, its foot's`, r.placed.every((p) => p.scrollHeight === r.foot.scrollHeight), r.placed.map((p) => p.scrollHeight).join(', '));
    check(`${tag}: its columns stand still as it scrolls, inside the window`, r.placed.every((p) => JSON.stringify(p.lefts) === JSON.stringify(r.placed[0].lefts) && p.scrollWidth <= p.clientWidth), r.placed.map((p) => `${p.lefts.join('/')}${p.scrollWidth > p.clientWidth ? ` (${p.scrollWidth}>${p.clientWidth})` : ''}`).join(' | '));
    check(`${tag}: a hover card whose row a scroll took away is put away`, r.tipAway.shown && (!r.tipAway.rowGone || !r.tipAway.tip), JSON.stringify(r.tipAway));
    if (r.search) {
      check(`${tag}: the search keeps its focus`, r.search.focused);
      check(`${tag}: and the list's scroll, as the whole list kept it`, Math.abs(r.search.after - Math.min(r.search.before, r.search.max)) <= 1, JSON.stringify(r.search));
    }
    if (where === 'pack') check(`${tag}: a row to carry a tile onto is in reach`, !!r.drag);
    if (r.drag) check(`${tag}: a carried tile across a scroll - the ghost names the act at the new point, the carried tile dimmed`, !!r.drag.before && r.drag.after === r.drag.before && r.drag.dimmed === 1, JSON.stringify(r.drag));
    if (r.focus) check(`${tag}: a focused row scrolled away leaves the focus on the list, and Home scrolls it home`, r.focus.onList && r.focusHome === 0, `${JSON.stringify(r.focus)}, Home -> ${r.focusHome}`);
    console.log(`     ${tag}: cold ${Math.round(r.cold.framed)} ms, settled in ${r.settleMs} ms over ${r.settled?.repaints} repaints${r.settled?.landings != null ? ` and ${r.settled.landings} landing passes` : ''}, ${r.longTasks.count} long tasks (${r.longTasks.ms} ms); warm ${Math.round(r.warm.framed)} ms; a press ${Math.round(r.pick.framed)} ms${r.search ? `; a search ${Math.round(r.search.typed)} ms` : ''}; ${r.warmState.rows} rows drawn, ${r.warmState.scrollHeight} px of list`);
  }
  check(`${v.name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
  }
} finally {
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
  await browser.close();
  await vite?.close();
}
if (process.env.PROBE_JSON) console.log(JSON.stringify(out, null, 1));
process.exitCode = failures ? 1 : 0;
