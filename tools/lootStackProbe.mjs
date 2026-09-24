// LOOT-STACK, MEASURED (2026-09-23, Janome: "a toggle key to switch between the inventories of enemies stacked on top
// of each other"; Mac, on the key the first slice shipped: "that solution is better than a keybind").
//
// test/lootstack.test.js holds the law on fakes; this draws the REAL surfaces in Chromium and reads back what a fake
// cannot.
//   - THE PLAQUE, through the real seam the four hosts call (ui/worldPlaque.js worldHoverFrame) with three bodies in one
//     pile under the reticle: the front body named, and the pile's mark - "3 bodies" - ONE line inside the plaque's box,
//     at a desktop's width and a narrow window's (the sheet shrinks the plaque under 720px), with a long name too. The
//     first slice's probe found two defects in the plaque it draws on, both older than the pile, and still measures
//     them: the divider is the LIST's top edge, not the title's foot; and the list's cap clips DOWN only, so quick
//     loot's lit band stays edge to edge with its name whole and unmoved.
//   - THE LOOT WINDOW, through the real inventory door (ui/inventoryDoor.js createInventoryWindow) on the enhanced skin,
//     opened the way a host's corpse door opens it: a tab per body in the pile, the open one lit; a real click on
//     another tab closes this window and opens that body's, whose own tab is lit; and on a phone's width a pile of five
//     wraps inside the window, every tab a finger's height, the page never scrolling sideways.
// Photographs to tools/shots/ (or SHOT_DIR).
//
//     node tools/lootStackProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5236, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

for (const [W, H] of [[1440, 900], [480, 800]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5236/play/?skin=enhanced&touch=off');
  const r = await page.evaluate(async ({ W, H }) => {
    const { worldHoverFrame, destroyWorldPlaque } = await import('/src/ui/worldPlaque.js');
    const { RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } = await import('/src/player/activate.js');
    const { setBindings } = await import('/src/ui/input.js');
    const { createBindings, resetDefaults } = await import('/src/systems/inputActions.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    const store = createBindings(); resetDefaults(store); setBindings(store);
    destroyWorldPlaque();
    const body = (key, z) => ({ key, aabb: { min: [-0.5, -0.3, z], max: [0.5, 0.3, z + 1] }, distance: RAY_DISTANCE, reach: CORPSE_ACTIVATION_DISTANCE, body: true });
    const names = { 'foeCorpse:a': 'Dead Orc', 'foeCorpse:b': 'Dead Rat', 'foeCorpse:c': 'Dead Daedra Seducer' };
    const lists = {
      'foeCorpse:a': [{ name: 'Rusty Dagger', group: 'Weapons', templateIndex: 121, material: 0, maxCondition: 200, currentCondition: 40 }],
      'foeCorpse:b': [],
      'foeCorpse:c': [{ name: 'Gold Pieces', group: 'Currency', templateIndex: 0, stackCount: 212, maxCondition: 1, currentCondition: 1 }, { name: 'Ebony Longsword', group: 'Weapons', templateIndex: 115, material: 0x0206, maxCondition: 1000, currentCondition: 1000 }],
    };
    const canvas = { width: W, height: H, clientWidth: W };
    const frame = (front) => worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity }, canvas,
      targets: () => ['foeCorpse:a', 'foeCorpse:b', 'foeCorpse:c'].map((k) => body(k, k === front ? 1 : 1.2 + (k.charCodeAt(10) - 97) * 0.1)),
      name: (k) => (names[k] ? { title: names[k] } : null), contents: (k) => lists[k] ?? null,
    });
    const read = () => {
      const n = document.querySelector('.wplaque');
      if (!n) return null;
      const box = n.getBoundingClientRect();
      const subs = [...n.querySelectorAll('.wplaque-sub')].map((s) => {
        const range = document.createRange(); range.selectNodeContents(s);
        const lines = new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size;
        const q = s.getBoundingClientRect();
        return { text: s.textContent, lines, inside: q.left >= box.left - 0.5 && q.right <= box.right + 0.5 && q.top >= box.top - 0.5 && q.bottom <= box.bottom + 0.5 };
      });
      // the lit row (quick loot's highlight): its band should reach the plaque's inner edges and its name be whole -
      // the list clips what overflows it, so a band that reached past the list lost its ends and its name's first
      // letter with them
      const sel = n.querySelector('.wplaque-row.sel');
      let lit = null;
      if (sel) {
        const cs = getComputedStyle(n);
        const innerL = box.left + parseFloat(cs.borderLeftWidth), innerR = box.right - parseFloat(cs.borderRightWidth);
        const list = n.querySelector('.wplaque-list').getBoundingClientRect();
        const band = sel.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(sel.firstChild);
        const text = range.getBoundingClientRect();
        const clipL = getComputedStyle(n.querySelector('.wplaque-list')).overflowX === 'visible' ? innerL : Math.max(innerL, list.left);
        // ...and the lit name stands where every other name stands - the band moves no name
        const other = n.querySelector('.wplaque-row:not(.sel):not(.wplaque-empty):not(.wplaque-more)');
        let shift = null;
        if (other) { const r2 = document.createRange(); r2.selectNodeContents(other.firstChild); shift = Math.round((text.left - r2.getBoundingClientRect().left) * 10) / 10; }
        lit = { bandL: Math.round(band.left - innerL), bandR: Math.round(innerR - band.right), textClipped: text.left < clipL - 0.5, overflowX: getComputedStyle(n.querySelector('.wplaque-list')).overflowX, shift };
      }
      // the divider is the list's top edge: every sub-line stands above it
      const listTop = n.querySelector('.wplaque-list')?.getBoundingClientRect().top ?? null;
      const subBottom = Math.max(...[...n.querySelectorAll('.wplaque-sub')].map((s) => s.getBoundingClientRect().bottom));
      return { on: n.classList.contains('on'), title: n.querySelector('.wplaque-title')?.textContent, subs, rows: n.querySelectorAll('.wplaque-row').length, w: Math.round(box.width), lit, subAboveList: listTop == null || subBottom <= listTop + 0.5 };
    };
    await document.fonts.ready;
    const out = {};
    frame('foeCorpse:a'); out.first = read();
    frame('foeCorpse:c'); out.long = read();
    return out;
  }, { W, H });
  await page.screenshot({ path: `${OUT}/lootstack_${W}.png` });
  const tag = `${W}px`;
  check(`${tag}: the front body named, with its pile's mark under it`, r.first?.on && r.first.title === 'Dead Orc' && r.first.subs[0]?.text === '3 bodies', JSON.stringify(r.first));
  check(`${tag}: ...the mark ONE line, inside the plaque, above the list's divider`, r.first?.subs[0]?.lines === 1 && r.first.subs[0].inside && r.first.subAboveList, JSON.stringify(r.first?.subs));
  check(`${tag}: a long body name and a list of two, the mark still one line inside the box`, r.long?.title === 'Dead Daedra Seducer' && r.long.subs[0]?.text === '3 bodies' && r.long.subs[0].lines === 1 && r.long.subs[0].inside, JSON.stringify(r.long));
  check(`${tag}: quick loot's lit row - its band edge to edge inside the plaque, its name whole`, r.first?.lit && Math.abs(r.first.lit.bandL) <= 0.5 && Math.abs(r.first.lit.bandR) <= 0.5 && !r.first.lit.textClipped, JSON.stringify(r.first?.lit));
  check(`${tag}: ...and with a list of two, the lit name stands where the unlit one does`, r.long?.lit && r.long.lit.shift === 0 && !r.long.lit.textClipped && Math.abs(r.long.lit.bandL) <= 0.5 && Math.abs(r.long.lit.bandR) <= 0.5, JSON.stringify(r.long?.lit));
  await page.close();
}

// THE LOOT WINDOW'S TABS, through the real inventory door, opened as a host's corpse door opens it: the pile handed
// in, each tab back through the "door" with the pile in hand (player/lootStack.js lootPile)
for (const [W, H, n] of [[1440, 900, 3], [390, 800, 5]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5236/play/?skin=enhanced&touch=off');
  await page.evaluate(async (n) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { lootPile } = await import('/src/player/lootStack.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    const names = ['Orc', 'Giant Rat', 'Daedra Seducer', 'Skeletal Warrior', 'Guard'];
    const keys = names.slice(0, n).map((_, i) => `foeCorpse:${i}`);
    const piles = keys.map((_, i) => Array.from({ length: i + 1 }, (_, j) => ({ name: `Dagger ${j + 1}`, group: 'Weapons', templateIndex: 113, stackCount: 1, currentCondition: 40, maxCondition: 40 })));
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] };
    globalThis.__opened = [];
    const door = (key, pileKeys = null) => {
      const i = keys.indexOf(key);
      globalThis.__opened.push(key);
      const pile = lootPile(key, { keys: pileKeys ?? keys, describe: (k) => ({ name: names[keys.indexOf(k)], count: piles[keys.indexOf(k)].length }), open: door });
      globalThis.__win = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [], loot: { items: () => piles[i], playerOwned: false, textureArchive: 380, textureRecord: 1, pile } });
    };
    door(keys[0]);
  }, n);
  await page.waitForSelector('#enhanced-inventory .piletab', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  const read = () => page.evaluate(() => {
    const win = document.querySelector('.loot-win');
    const box = win.getBoundingClientRect();
    const tabs = [...document.querySelectorAll('#enhanced-inventory .piletab')];
    return {
      windows: document.querySelectorAll('#enhanced-inventory').length,
      lit: tabs.filter((t) => t.classList.contains('on')).map((t) => t.querySelector('.piletabname').textContent),
      names: tabs.map((t) => t.querySelector('.piletabname').textContent),
      inside: tabs.every((t) => { const q = t.getBoundingClientRect(); return q.left >= box.left - 0.5 && q.right <= box.right + 0.5; }),
      minH: Math.min(...tabs.map((t) => t.getBoundingClientRect().height)),
      rows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size,
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
      items: document.querySelectorAll('.loot-win .itemrow').length,
      opened: [...globalThis.__opened],
    };
  });
  const tag = `${W}px, ${n} bodies`;
  const a = await read();
  check(`${tag}: one window, a tab per body, the first lit`, a.windows === 1 && a.names.length === n && a.lit.length === 1 && a.lit[0] === 'Orc' && a.items === 1, JSON.stringify(a));
  check(`${tag}: every tab inside the window, a finger's height, the page never scrolling sideways`, a.inside && a.minH >= 32 && !a.hscroll, JSON.stringify(a));
  if (n > 3) check(`${tag}: the row wraps rather than hiding a tab`, a.rows >= 2, JSON.stringify(a));
  else check(`${tag}: one row on a desktop`, a.rows === 1, JSON.stringify(a));
  await page.screenshot({ path: `${OUT}/lootstack_tabs_${W}.png` });
  await page.locator('#enhanced-inventory .piletab', { hasText: 'Daedra Seducer' }).click();
  await page.waitForFunction(() => document.querySelector('#enhanced-inventory .piletab.on')?.textContent.includes('Daedra'), null, { timeout: 20000 });
  const b = await read();
  check(`${tag}: a real click on a tab closes this window and opens that body's - its tab lit, its three items`, b.windows === 1 && b.lit[0] === 'Daedra Seducer' && b.items === 3 && b.opened.join() === 'foeCorpse:0,foeCorpse:2', JSON.stringify(b));
  check(`${tag}: ...and the row did not move under the player's hand`, b.names.join() === a.names.join(), JSON.stringify(b.names));
  await page.screenshot({ path: `${OUT}/lootstack_tabs_${W}_switched.png` });
  await page.close();
}
// THE CAP STILL CLIPS DOWNWARD: a six-row pile at a short window - the list stops at its cap (the room below the
// cross, R7) with its rows clipped under it, while the band across it stays whole
{
  const page = await browser.newPage({ viewport: { width: 1024, height: 360 } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5236/play/?skin=enhanced&touch=off');
  const cap = await page.evaluate(async () => {
    const { worldHoverFrame, destroyWorldPlaque } = await import('/src/ui/worldPlaque.js');
    const { RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } = await import('/src/player/activate.js');
    document.body.innerHTML = '';
    destroyWorldPlaque();
    const item = (name) => ({ name, group: 'Weapons', templateIndex: 121, material: 0, maxCondition: 200, currentCondition: 200 });
    worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity }, canvas: { width: 1024, height: 360, clientWidth: 1024 },
      targets: () => [{ key: 'foeCorpse:z', aabb: { min: [-0.5, -0.3, 1], max: [0.5, 0.3, 2] }, distance: RAY_DISTANCE, reach: CORPSE_ACTIVATION_DISTANCE, body: true }],
      name: () => ({ title: 'Dead Knight' }), contents: () => ['Longsword', 'Shield', 'Helm', 'Cuirass', 'Greaves', 'Boots', 'Gauntlets', 'Ring'].map(item),
    });
    await document.fonts.ready;
    const list = document.querySelector('.wplaque-list');
    const cs = getComputedStyle(list);
    const capPx = parseFloat(cs.maxHeight);
    return { clipped: list.scrollHeight > list.clientHeight + 0.5, contentH: list.clientHeight - parseFloat(cs.paddingTop), capPx, overflowY: cs.overflowY };
  });
  check('a six-row pile at a 360px window: the list stops at its cap and clips the rows under it', cap.clipped && cap.contentH <= cap.capPx + 0.5 && cap.overflowY === 'clip', JSON.stringify(cap));
  await page.screenshot({ path: `${OUT}/lootstack_cap.png` });
  await page.close();
}
check('no page error', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();
await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
