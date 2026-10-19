// SPELL-SCROLL (FIELD BUGS 2026-10-18f): THE BOOK'S LIST, AND ITS SIBLINGS, IN A REAL BROWSER.
//
// The pins (test/ui/enhanced/fb1018f_spellscroll.test.js) run on the suite's minimal DOM, which has no layout: they prove
// a pane's offset is carried across a repaint, and they read the book's CSS as text. What the CSS DOES - that the list
// is the pane that scrolls, and the chosen spell's page stands beside it in view - only a browser's layout can say. This
// mounts the real windows over the dev server's real modules and sheets in Chromium, scrolls each list, presses as a
// player does (a real mouse click at the row's centre), and reads where every pane stands after.
//
//   npx vite --port 5199 --strictPort --host 127.0.0.1 &
//   node tools/spellScrollProbe.mjs
//
// It checks: the enhanced spellbook at a desktop and a phone size (the list kept, the pick lit, its page in view), the
// Chronicle's notes (a fold and a remove kept, another section at its top) - exit 1 if any fails - and reads the two
// salvage surfaces the report's reply named, which held before the fix (the Reforge's Salvage page and the pack's
// Salvage): their readings are printed, not judged.
import { chromium } from 'playwright';

const ORIGIN = process.env.PROBE_ORIGIN ?? 'http://127.0.0.1:5199';
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };
const browser = await chromium.launch();

/** A blank page on the dev server's origin, so the modules import as the game imports them. */
async function page(viewport) {
  const p = await browser.newPage({ viewport });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(`${ORIGIN}/src/ui/domRepaint.js`);
  await p.evaluate(() => { document.open(); document.write('<!doctype html><html><head></head><body style="margin:0"></body></html>'); document.close(); });
  return p;
}
/** Every pane under the window's host that scrolls, as `class=offset`. */
const panes = (p) => p.evaluate(() => [...window.__host.querySelectorAll('*')]
  .filter((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1)
  .map((e) => ({ cls: e.className, top: e.scrollTop })));
/** Scroll the first pane that holds `inside` (or is it) to `y`. */
const scrollTo = (p, inside, y) => p.evaluate(([inside, y]) => {
  const sc = [...window.__host.querySelectorAll('*')].find((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)
    && e.scrollHeight > e.clientHeight + 1 && (e.matches(inside) || e.querySelector(inside)));
  sc.scrollTop = y;
  return sc.scrollTop;
}, [inside, y]);
/** Click, with the mouse, the first `sel` whose words hold `words` and that stands inside its pane's view. */
async function press(p, sel, words = '') {
  const at = await p.evaluate(([sel, words]) => {
    const n = [...window.__host.querySelectorAll(sel)].find((x) => {
      const b = x.getBoundingClientRect();
      if (!b.height || !x.textContent.includes(words)) return false;
      for (let s = x.parentElement; s; s = s.parentElement) {
        const r = s.getBoundingClientRect();
        if (['auto', 'scroll'].includes(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight + 1) return b.top >= r.top + 4 && b.bottom <= r.bottom - 4;
      }
      return b.top >= 0 && b.bottom <= innerHeight;
    });
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, text: n.textContent };
  }, [sel, words]);
  if (!at) throw new Error(`nothing to press: ${sel} "${words}"`);
  await p.mouse.click(at.x, at.y);
  await p.waitForTimeout(150);
  return at.text;
}

// ── THE ENHANCED SPELLBOOK: forty spells from the Spell Maker's own producer ──────────────────────────────────────────
for (const [size, viewport] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 393, height: 851 }]]) {
  const p = await page(viewport);
  await p.evaluate(async () => {
    const { mountEnhancedSpellbook } = await import('/src/ui/enhanced/enhancedSpellbook.js');
    const { buildCustomSpell, blankEffectSettings } = await import('/src/systems/spell/spellMaker.js');
    const spells = Array.from({ length: 40 }, (_, i) => buildCustomSpell({ slots: [{ type: 0, subType: 0, settings: blankEffectSettings() }], name: `Spell ${String(i).padStart(2, '0')}` }));
    window.__host = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0' });
    document.body.append(window.__host);
    mountEnhancedSpellbook(window.__host, { spells: () => spells, castCost: () => 5, entity: { magicka: 50 }, onExit: () => {}, onReady: () => {} });
  });
  const before = await scrollTo(p, '.px-qrow', 600);
  const picked = (await press(p, '.px-qrow')).replace('◆', '').replace(/5$/, '');
  const after = await panes(p);
  const list = after.find((x) => x.cls.includes('px-qrail')) ?? after.find((x) => x.top > 0) ?? after[0];
  const shown = await p.evaluate(() => {
    const h = window.__host, name = h.querySelector('.px-qname h3'), ready = [...h.querySelectorAll('button')].find((b) => b.textContent === 'Ready');
    const inView = (n) => { const b = n.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; };
    return { lit: h.querySelector('.px-qrow.on')?.textContent.replace('◆', '').replace(/5$/, ''), name: name?.textContent, nameInView: !!name && inView(name), readyInView: !!ready && inView(ready) };
  });
  console.log(`spellbook, ${size}:`, JSON.stringify({ before, after, shown }));
  check(list?.cls.includes('px-qrail') && list.top === before, `spellbook ${size}: the list is its own pane and keeps its place (${before} -> ${list?.cls} ${list?.top})`);
  check(shown.lit === picked && shown.name === picked, `spellbook ${size}: ${picked} picked, lit and shown`);
  check(shown.nameInView && shown.readyInView, `spellbook ${size}: its page and Ready stand in view`);
  await p.close();
}

// ── THE CHRONICLE: thirty notes and thirty messages from the real notebook ─────────────────────────────────────────────
{
  const p = await page({ width: 1280, height: 720 });
  await p.evaluate(async () => {
    const { mountEnhancedChronicle } = await import('/src/ui/enhanced/enhancedChronicle.js');
    const { PlayerNotebook } = await import('/src/systems/notebook.js');
    const nb = new PlayerNotebook();
    for (let i = 0; i < 30; i++) nb.addMessage(`Message ${i}: a courier says the Baron wants a word, and the word is ${i}.`);
    for (let i = 0; i < 30; i++) nb.addNote(`Note number ${i}: the road north of Daggerfall bends at the old mill, and the miller owes me ${i} gold.`);
    window.__host = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0' });
    document.body.append(window.__host);
    mountEnhancedChronicle(window.__host, { notebook: () => nb, entity: { name: 'P' }, onExit: () => {}, section: 'notes' });
  });
  const top = async () => (await panes(p)).find((x) => x.cls === 'px-body')?.top ?? 0;
  await scrollTo(p, '.cr-fold', 900);
  await press(p, '.cr-fold');
  check(await top() === 900, `chronicle: a card folded keeps the page (900 -> ${await top()})`);
  await press(p, '.cr-rm:not(.cr-share)');
  check(await top() === 900, `chronicle: a note removed keeps the page (900 -> ${await top()})`);
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(150);
  check(await top() === 0, `chronicle: another section starts at its top (-> ${await top()})`);
  await p.close();
}

// ── THE SALVAGE SURFACES (read, not judged): the Reforge's Salvage page and the pack's Salvage ───────────────────────
{
  const p = await page({ width: 1280, height: 720 });
  await p.evaluate(async () => {
    const { mountReforgeWindow } = await import('/src/ui/reforgeWindow.js');
    const { applyRarity } = await import('/src/systems/loot/lootRarity.js');
    const { weaponOfMaterial } = await import('/src/combat/enemyEquipment.js');
    const { seededRng } = await import('/src/systems/wind/wind.js');
    const { salvagePiece } = await import('/src/systems/reforge.js');
    const items = Array.from({ length: 30 }, (_, i) => { const it = weaponOfMaterial(120, 1); applyRarity(it, 'magic', seededRng(100 + i)); it.isIdentified = true; return it; });
    window.__host = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0;overflow:hidden' });
    document.body.append(window.__host);
    mountReforgeWindow(window.__host, { items: () => items, payer: () => ({ items }), gold: () => 0, reforge: () => ({ ok: false }), salvage: (it) => salvagePiece(it, { items }), picture: null, page: 'salvage', nameOf: (it) => it.shortName ?? it.name });
  });
  const y = await scrollTo(p, '.broker-offer', 900);
  await press(p, '.broker-offer .broker-buy:not(.reforge-keep)', 'Salvage');
  const asked = (await panes(p)).find((x) => x.cls === 'broker-body')?.top;
  await press(p, '.broker-offer .broker-buy:not(.reforge-keep)', 'Break it');
  const broke = (await panes(p)).find((x) => x.cls === 'broker-body')?.top;
  console.log(`reforge salvage page: ${y} -> asked ${asked} -> broken ${broke}`);
  await p.close();
}
{
  const p = await page({ width: 1280, height: 720 });
  await p.evaluate(async () => {
    const { mountEnhancedInventory } = await import('/src/ui/enhanced/enhancedInventory.js');
    const { applyRarity } = await import('/src/systems/loot/lootRarity.js');
    const { weaponOfMaterial } = await import('/src/combat/enemyEquipment.js');
    const { seededRng } = await import('/src/systems/wind/wind.js');
    const items = Array.from({ length: 40 }, (_, i) => { const it = weaponOfMaterial(113 + (i % 8), 1 + (i % 5)); applyRarity(it, 'magic', seededRng(300 + i)); it.isIdentified = true; return it; });
    const e = { name: 'P', items, goldPieces: 0, stats: { strength: 50 } };
    window.__host = Object.assign(document.createElement('div'), { style: 'position:fixed;inset:0' });
    document.body.append(window.__host);
    mountEnhancedInventory(window.__host, { entity: e, items: () => e.items, onExit: () => {} });
  });
  const y = await scrollTo(p, '.itemrow', 400);
  await press(p, '.itemrow');
  const picked = (await panes(p)).find((x) => x.cls === 'packlists')?.top;
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Salvage')?.click());
  await p.waitForTimeout(100);
  await p.evaluate(() => [...document.querySelectorAll('.inv-salvage button')].find((b) => b.textContent === 'Salvage')?.click());
  await p.waitForTimeout(150);
  const salvaged = (await panes(p)).find((x) => x.cls === 'packlists')?.top;
  console.log(`pack salvage: ${y} -> picked ${picked} -> salvaged ${salvaged}`);
  await p.close();
}

await browser.close();
if (fails.length) { console.log(`${fails.length} failed`); process.exit(1); }
console.log('all held');
