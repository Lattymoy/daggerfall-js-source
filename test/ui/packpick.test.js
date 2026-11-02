// PACK-PICK (2026-10-26, #feature-feedback "SELLING ITEMS ON THE MARKET IS A PAIN!": "When selling items from backpack for
// GOLD, you get a dropdown with just the name of the item.. no description or icon"; the owner: "This needs a comprehensive
// detailed overhaul"): THE PACK, PICTURED, WHERE A PIECE IS CHOSEN TO SELL - ui/packPicker.js, the Market's List form
// (ui/marketTab.js) and a trader's stall (ui/vendor/vendorTab.js) over it, and the look it shows (systems/item/itemLook.js).
// The pieces are the producers' (systems/loot/loot.js generateRandomLoot, lootRarity.js applyRarity) and the pack side the
// host builds (systems/tradePack.js createMarketGoods). Mutants: tools/mutants/packpick.json.
import '../chargenDom.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packPickerNode, packCardNode, freshPackSift, siftEntries, packTierWord } from '../../src/ui/packPicker.js';
import { itemLookRows } from '../../src/systems/item/itemLook.js';
import { magicPowersLines } from '../../src/systems/item/itemPowers.js';
import { createMarketTab, LIST_KINDS } from '../../src/ui/marketTab.js';
import { createVendorTab } from '../../src/ui/vendor/vendorTab.js';
import { createMarketGoods } from '../../src/systems/tradePack.js';
import { generateRandomLoot, LOOT_MATRICES, setMagicItemTemplates, getMagicItemTemplates } from '../../src/systems/loot/loot.js';
import { applyRarity, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { mintPiece } from '../../src/systems/smithItems.js';
import { wearCondition } from '../../src/net/marketLaw.js';
import { createVendorHost } from '../../src/scenes/vendorHost.js';
import { storeMaterialOf } from '../../src/ui/storeFilter.js';
import { pageOf } from '../../src/ui/packPages.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { PROF_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { SLOT_BOX } from '../../src/ui/iconFit.js';
import { frameWake } from '../../src/ui/menu/menuGlyphs.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';

afterEach(() => resetPrefs());
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const byClass = (n, c) => n.querySelectorAll(`.${c}`);
const word = (n, c) => byClass(n, c)[0]?.textContent;
/** The pressable tiles of the picker `root` is, or of the first under it. */
const tilesOf = (root) => [...byClass(root.className.split(' ').includes('packpick') ? root : byClass(root, 'packpick')[0], 'packpick-tile')].filter((n) => n.tagName === 'BUTTON');

/** A pack the producers fill: a body's weapons and armour (none an arrow), its gold, and a quest's piece (quest/item.js
 *  writes `questItem`) - the gold and the quest's refused by the market's own law (net/marketLaw.js goodRefusal). */
function pack() {
  const loot = [21, 22, 23, 24].flatMap((s) => generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 5, MaxGold: 5, WP: 100, AM: 100 }, { level: 10, gender: 'male' }, seededRng(s)));
  const gear = loot.filter((it) => (it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE) || it.group === 'Armor');
  const gold = loot.find((it) => it.group === 'Currency');
  assert.ok(gear.filter((it) => it.group === 'Weapons').length >= 2 && gear.some((it) => it.group === 'Armor') && gold, 'the drop holds each');
  const quest = { ...JSON.parse(JSON.stringify(gear.find((it) => it.group === 'Weapons'))), questItem: true };
  const owner = { items: [...gear, gold, quest] };
  return { owner, gear, gold, quest, goods: createMarketGoods(owner) };
}
const entriesOf = (goods) => goods.goods().map((g, i) => ({ key: `t|${i}`, item: g.item, name: g.name, sub: packTierWord(g.item), why: g.why }));

test('PACK-PICK the sift: the pack\'s own pages, tiers and metals (ui/storeFilter.js) and a search of the names the tiles wear - every piece while nothing is asked; a shape the laws cannot read is left out, never thrown on (mutants: the search unread; the page unread)', () => {
  setPref(LOOT_RARITY_KEY, true);
  const { gear, goods } = pack();
  applyRarity(gear[0], 'rare', seededRng(4));
  const all = entriesOf(goods);
  assert.equal(siftEntries(all, freshPackSift()), all, 'nothing asked: the list as it stands');
  const name = all[0].name;
  const q = name.slice(1, 5).toUpperCase();
  assert.deepEqual(siftEntries(all, { ...freshPackSift(), query: `  ${q} ` }).map((e) => e.key), all.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).map((e) => e.key));
  assert.deepEqual(siftEntries(all, { ...freshPackSift(), query: 'no such piece anywhere' }), []);
  for (const cat of ['weapons', 'armor']) {
    const got = siftEntries(all, { ...freshPackSift(), cat });
    assert.ok(got.length > 0 && got.length < all.length, cat);
    assert.ok(got.every((e) => pageOf(e.item) === cat), `${cat}: the pack's own page`);
  }
  assert.deepEqual(siftEntries(all, { ...freshPackSift(), rarity: 'rare' }).map((e) => e.item), [gear[0]]);
  const metal = all.map((e) => storeMaterialOf(e.item)).find(Boolean);
  const byMetal = siftEntries(all, { ...freshPackSift(), material: metal });
  assert.ok(byMetal.length > 0 && byMetal.every((e) => storeMaterialOf(e.item) === metal), `the metal ${metal}`);
  assert.deepEqual(siftEntries([{ key: 'x', item: 'a word, no item', name: 'a word' }], { ...freshPackSift(), cat: 'weapons' }), []);
  assert.equal(packTierWord(gear[0]), 'Rare');
  assert.equal(packTierWord(gear[1]), null, 'Common says nothing');
});

test('PACK-PICK the picker: a pictured tile for each piece that may go, none pressed; what may not go folded under them with why and never pressable; the search refills the tiles in place (the field never redrawn) and the menus too; nothing matching offers "Show everything"; a tile pressed is handed back (mutants: typing redraws the window; the refused pressable; the why unsaid; the tier unmarked; the menus gone)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const { gear, goods, gold, quest } = pack();
  applyRarity(gear[0], 'rare', seededRng(4));
  const entries = entriesOf(goods);
  const ok = entries.filter((e) => !e.why);
  const sift = freshPackSift();
  const picked = [], redraws = [];
  const box = packPickerNode({ entries, chosen: null, sift, pick: (it) => picked.push(it), label: 'The pieces in your pack', focus: 'f', empty: 'none',
    refusedWhat: 'Not for the market', redraw: () => redraws.push(1) });
  assert.equal(box.getAttribute('aria-label'), 'The pieces in your pack');
  let tiles = tilesOf(box);
  assert.deepEqual(tiles.map((b) => word(b, 'packpick-name')), ok.map((e) => e.name));
  assert.ok(tiles.every((b) => b.getAttribute('aria-pressed') === 'false'), 'nothing chosen');
  assert.equal(new Set(tiles.map((b) => b.getAttribute('data-focus'))).size, tiles.length, 'each its own focus key');
  assert.equal(tiles.find((b) => word(b, 'packpick-name') === entries.find((e) => e.item === gear[0]).name).getAttribute('data-rarity'), 'rare', 'its tier on its frame');
  assert.equal(word(tiles[0], 'packpick-sub'), 'Rare');
  assert.equal(word(box, 'packpick-count'), `${ok.length} pieces`);
  // the refused: folded, each a picture and its why - never a press
  const fold = byClass(box, 'packpick-refused')[0];
  assert.equal(fold.tagName, 'DETAILS');
  const refused = entries.filter((e) => e.why);
  assert.ok(refused.some((e) => e.item === gold) && refused.some((e) => e.item === quest && e.why === 'a quest\'s'), 'the gold and the quest\'s piece among them');
  assert.equal(fold.children[0].textContent, `Not for the market (${refused.length})`, 'its name and how many');
  const off = [...byClass(fold, 'packpick-tile')];
  assert.deepEqual(off.map((n) => [n.tagName, word(n, 'packpick-name'), word(n, 'packpick-why')]), refused.map((e) => ['DIV', e.name, e.why]));
  // a press hands the piece back
  tiles[1].onclick();
  assert.deepEqual(picked, [ok[1].item]);
  // the search: in place - the same field, the tiles refilled, no redraw of the window
  const find = byClass(box, 'packpick-find')[0];
  find.value = 'no such piece anywhere';
  find.oninput();
  await tick(160);
  assert.ok(box.contains(find), 'the field typed in stands');
  assert.equal(tilesOf(box).length, 0);
  assert.equal(word(box, 'packpick-none'), 'Nothing in your pack matches. Show everything');
  assert.equal(word(box, 'packpick-count'), `0 of ${ok.length}`);
  assert.deepEqual(redraws, [], 'typing never redraws the window');
  [...box.querySelectorAll('button')].find((b) => b.textContent === 'Show everything').onclick();
  assert.deepEqual([sift.query, redraws.length], ['', 1], 'the sift let go, and the window drawn with it');
  // the page menu - the pages the pieces lie on, each its count
  const menus = [...byClass(box, 'packpick-menu')];
  const page = menus.find((s) => s.getAttribute('aria-label') === 'Kind of piece');
  assert.ok(page, 'a page to choose');
  assert.ok(menus.some((s) => s.getAttribute('aria-label') === 'Rarity'), 'the tiers, while the ladder is on');
  page.value = 'armor';
  page.onchange();
  tiles = tilesOf(box);
  assert.ok(tiles.length > 0 && tiles.length < ok.length);
  assert.equal(word(box, 'packpick-count'), `${tiles.length} of ${ok.length}`);
  // the chosen marked; nothing that may go is the empty words alone, the refused still said
  const again = packPickerNode({ entries, chosen: ok[2].item, sift: freshPackSift(), pick: () => {}, label: 'x', focus: 'f', empty: 'none', refusedWhat: 'r', redraw: () => {} });
  assert.deepEqual(tilesOf(again).map((b) => b.getAttribute('aria-pressed')).indexOf('true'), 2);
  assert.ok(tilesOf(again)[2].className.split(' ').includes('on'));
  const bare = packPickerNode({ entries: entries.filter((e) => e.why), chosen: null, sift: freshPackSift(), pick: () => {}, label: 'x', focus: 'f', empty: 'Nothing here.', refusedWhat: 'r', redraw: () => {} });
  assert.equal(word(bare, 'packpick-empty'), 'Nothing here.');
  assert.equal(byClass(bare, 'packpick-find').length, 0, 'no search over nothing');
  assert.equal(byClass(bare, 'packpick-refused').length, 1);
});

test('PACK-PICK the tiles keep their scroll: a press redraws the window, and the picker drawn again gives its tiles back where they were scrolled (once it stands in the window); a sift that changes what the tiles are lets it go (mutants: the scroll unkept; the scroll kept over a new sift)', async () => {
  const { goods } = pack();
  const entries = entriesOf(goods);
  const sift = freshPackSift();
  const draw = () => packPickerNode({ entries, chosen: null, sift, pick: () => {}, label: 'x', focus: 'f', empty: 'none', refusedWhat: 'r', redraw: () => {} });
  let grid = byClass(draw(), 'packpick-grid')[0];
  grid.scrollTop = 140;
  grid.dispatch('scroll', {});
  assert.equal(sift.top, 140, 'the scroll kept');
  grid = byClass(draw(), 'packpick-grid')[0];
  assert.equal(grid.scrollTop, 0, 'not before the window has drawn it');
  await tick();
  assert.equal(grid.scrollTop, 140, 'given back');
  const box = draw();
  await tick();
  const page = [...byClass(box, 'packpick-menu')].find((s) => s.getAttribute('aria-label') === 'Kind of piece');
  page.value = 'weapons';
  page.onchange();
  assert.deepEqual([sift.top, byClass(box, 'packpick-grid')[0].scrollTop], [0, 0], 'a new sift starts at the top');
});

test('AUDIT PACK-PICK the folded keep their scroll as the tiles do - unfolded, scrolled, and a press redraws the window - and a new sift lets it go (mutants: B the folded scroll unkept; unrestored; kept over a new sift)', async () => {
  const { goods } = pack();
  const entries = entriesOf(goods);
  const sift = { ...freshPackSift(), refusedOpen: true };
  const draw = () => pickerOf(entries, sift);
  const offOf = (box) => byClass(box, 'packpick-offgrid')[0];
  let off = offOf(draw());
  off.scrollTop = 90;
  off.dispatch('scroll', {});
  assert.equal(sift.offTop, 90);
  off = offOf(draw());
  await tick();
  assert.equal(off.scrollTop, 90, 'given back');
  const box = draw();
  await tick();
  const page = [...byClass(box, 'packpick-menu')].find((s) => s.getAttribute('aria-label') === 'Kind of piece');
  page.value = 'weapons';
  page.onchange();
  assert.deepEqual([sift.offTop, offOf(box).scrollTop], [0, 0]);
});

test('PACK-PICK the piece looked at: its name and line, the look panel\'s rows and its magic (systems/item/itemLook.js) - the trader\'s look, moved, one presenter; the words that stand in while nothing is chosen (mutants: the look unread; the stall\'s look a second copy)', () => {
  setPref(LOOT_RARITY_KEY, true);
  const { gear } = pack();
  const weapon = gear.find((it) => it.group === 'Weapons');
  applyRarity(weapon, 'rare', seededRng(4));
  const none = packCardNode(null, { none: 'Press a piece.' });
  assert.deepEqual([none.className, none.textContent], ['notice-tip packpick-cardnone', 'Press a piece.']);
  const card = packCardNode({ key: 'k', item: weapon, name: 'My Blade', sub: 'Rare' }, { look: itemLookRows, none: '' });
  assert.equal(card.getAttribute('data-rarity'), 'rare');
  assert.deepEqual([word(card, 'packpick-name'), word(card, 'packpick-sub')], ['My Blade', 'Rare']);
  const look = itemLookRows(weapon);
  assert.deepEqual([...byClass(card, 'packpick-stat')].map((n) => n.textContent), look.rows);
  assert.ok(look.rows.some((r) => /^Damage: \d+ - \d+$/.test(r)) && look.rows.some((r) => /^Weight: /.test(r)), look.rows.join(' | '));
  assert.ok(look.magic.length > 0, 'a Rare piece says its tier and its lines');
  assert.deepEqual([...byClass(card, 'packpick-magic')[0].children].map((n) => n.textContent), look.magic);
  assert.equal(itemLookRows(null), null);
  assert.equal(itemLookRows('a word'), null);
  assert.match(src('src/scenes/vendorHost.js'), /const vendorItemStats = itemLookRows;/, 'the trader\'s look is this one');
});

/** A market book as the tab reads it - `goldOk` a realm character's - and the listings it is asked for. */
function bookOf(goldOk, ways = {}) {
  const listed = [];
  return {
    listed, state: { open: true, balance: 1000, road: [], counts: {}, goldHeld: 0 }, pending: 0, cached: () => null, goldOk, purse: () => 500,
    read: async (view) => ({ ok: true, data: view === 'mine' ? { rows: [], ways } : { rows: [] } }), settle: async () => ({ ok: true, settled: 0 }),
    list: async (req) => { listed.push(req); return { ok: true, data: {} }; },
  };
}
/** The market's host as the tab reads it, over a pack's goods. */
const marketHostOf = (book, goods, extra = {}) => ({
  book, stores: () => new Map(), region: 17, regionName: 'Daggerfall', regionNameOf: () => 'Daggerfall', hubs: { 17: [207, 212] }, name: (k) => k, countName: (k) => k,
  pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece', weavers: [], stock: async () => ({ ok: true }),
  goods: () => goods.goods(), good: (it) => goods.good(it), goodName: (r) => goods.goodName(r), ...extra,
});
function tabOf(book, goods, extra = {}) {
  let root = null, draws = 0;
  const said = [];
  const m = marketHostOf(book, goods, extra);
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => { const r = await start(); said.push(r?.text); }, rerender: () => draw(), nowS: () => 0, alive: () => true });
  function draw() { draws++; root = tab.body(); }
  return { tab, said, root: () => root, draw, draws: () => draws, press: (k) => [...root.querySelectorAll('button')].find((b) => b.getAttribute('data-kind') === k) };
}
const mine = async (t) => { t.tab.state.view = 'mine'; await t.tab.load(true); t.draw(); };

test('PACK-PICK the List form: its kinds presses, the pack\'s first - a realm character\'s form opens on it, the kind pressed kept for the market book\'s session and no other\'s; none chosen until a tile is pressed (a press again lets it go); the piece listed is the one pressed (mutants: the first by default; the kind unkept; the kind kept unread; the pack\'s form not first; a press that never lets go)', async () => {
  const { gear, goods } = pack();
  const book = bookOf(true);
  const a = tabOf(book, goods);
  await mine(a);
  assert.deepEqual([...a.root().querySelectorAll('button')].filter((b) => b.getAttribute('data-kind')).map((b) => b.getAttribute('data-kind')), LIST_KINDS.map(([k]) => k));
  assert.equal(a.press('item').getAttribute('aria-pressed'), 'true', 'a realm character\'s form opens on the pack');
  assert.equal(byClass(a.root(), 'market-kinds')[0].getAttribute('aria-label'), 'What to list');
  const listBtn = () => [...a.root().querySelectorAll('button')].find((b) => b.textContent === 'List');
  assert.equal(listBtn().disabled, true, 'nothing chosen: nothing to list');
  assert.equal(word(a.root(), 'packpick-cardnone'), 'Press a piece above to look at it and set its price.');
  const weapon = gear.find((it) => it.group === 'Weapons');
  const tile = () => tilesOf(a.root()).find((b) => word(b, 'packpick-name') === goods.goodName(weapon));
  tile().onclick();
  assert.equal(word(byClass(a.root(), 'packpick-card')[0], 'packpick-name'), goods.goodName(weapon));
  assert.equal(listBtn().disabled, false);
  tile().onclick();
  assert.equal(byClass(a.root(), 'packpick-card').length, 0, 'pressed again: let go');
  tile().onclick();
  await listBtn().onclick();
  assert.equal(book.listed.length, 1);
  assert.deepEqual([book.listed[0].kind, book.listed[0].item, book.listed[0].pick], ['item', goods.good(weapon).offered, goods.good(weapon).pick], 'the piece pressed, as the trade\'s wire writes it');
  // the kind kept: another board on the same book opens where this one was left; another book on its own default
  a.press('material').onclick();
  assert.equal(a.press('material').getAttribute('aria-pressed'), 'true');
  const b = tabOf(book, goods);
  await mine(b);
  assert.equal(b.press('material').getAttribute('aria-pressed'), 'true', 'kept for the session');
  const c = tabOf(bookOf(true), goods);
  await mine(c);
  assert.equal(c.press('item').getAttribute('aria-pressed'), 'true', 'another book\'s own');
  const d = tabOf(bookOf(false), goods);
  await mine(d);
  assert.equal(d.press('item'), undefined, 'gold is a realm character\'s');
  assert.equal(d.press('material').getAttribute('aria-pressed'), 'true');
});

test('PACK-PICK the Goods view: beside its filters, a realm character\'s "Sell from your pack" - My listings\' form opened on the pack, whatever kind was left; another character has none (mutants: the press for anyone; the press not on the pack)', async () => {
  const { goods } = pack();
  const t = tabOf(bookOf(true), goods);
  await mine(t);
  t.press('material').onclick();
  t.tab.state.view = 'goods';
  await t.tab.load(true);
  t.draw();
  const sell = byClass(t.root(), 'market-sellpack')[0];
  assert.equal(sell.textContent, 'Sell from your pack');
  assert.equal(sell.parentNode.className, 'market-filters', 'beside the filters');
  sell.onclick();
  await tick();
  t.draw();
  assert.deepEqual([t.tab.state.view, t.tab.state.list.kind], ['mine', 'item']);
  assert.equal(t.press('item').getAttribute('aria-pressed'), 'true');
  const other = tabOf(bookOf(false), goods);
  other.tab.state.view = 'goods';
  await other.tab.load(true);
  other.draw();
  assert.equal(byClass(other.root(), 'market-sellpack').length, 0);
});

test('PACK-PICK the stall: a trader\'s "Put up a piece from your pack" is the same picker - the stall\'s own pictures and look, the refused folded with why, none chosen until pressed, the piece put up the one pressed (mutants: the first by default; the stall\'s look unread)', async () => {
  const { gear, goods, quest } = pack();
  const put = [];
  const tab = createVendorTab({ mode: 'stall', own: true, read: async () => ({ ok: true, data: { rows: [] } }), nameOf: (it) => goods.goodName(it), purse: () => 100,
    stats: itemLookRows, goods: () => goods.goods(), put: async (it, p) => { put.push([it, p]); return { ok: true }; } },
  { busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true });
  await tab.open();
  let b = tab.body();
  const press = () => [...b.querySelectorAll('button')].find((x) => x.textContent === 'Put up for sale');
  assert.equal(press().disabled, true, 'nothing chosen');
  assert.ok([...byClass(byClass(b, 'packpick-refused')[0], 'packpick-tile')].some((n) => word(n, 'packpick-name') === goods.goodName(quest) && word(n, 'packpick-why') === 'a quest\'s'));
  const armour = gear.find((it) => it.group === 'Armor');
  tilesOf(b).find((x) => word(x, 'packpick-name') === goods.goodName(armour)).onclick();
  b = tab.body();
  assert.deepEqual([...byClass(b, 'packpick-stat')].map((n) => n.textContent), itemLookRows(armour).rows, 'the stall\'s own look');
  press().onclick();
  await tick();
  assert.deepEqual(put, [[armour, 100]]);
});

test('PACK-PICK the dress: the tiers\' colours laid inside the List form (the board is drawn on either skin), a tile framed by its tier, the kinds two by two on a phone (mutant: the tiers\' colours left to the Plus sheet)', () => {
  assert.match(PROF_CSS, /\.market-listform \[data-rarity="rare"\] \{ --rar: #e4c34f;/);
  assert.match(PROF_CSS, /\.packpick-tile\[data-rarity\] \{ border-color: var\(--rar-hi\) var\(--rar-lo\) var\(--rar-lo\) var\(--rar-hi\);/);
  assert.match(PROF_CSS, /\.market-kinds \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); \}/);
});

test('AUDIT PACK-PICK the dress\'s own rules: the card\'s name in its tier\'s colour as a tile\'s is; two tiles across inside the phone\'s rule alone; a press a finger\'s height on a touch screen (mutants: C17 the card\'s name uncoloured; C18 the phone\'s rule on a desktop; C19 a touch press small)', () => {
  assert.match(PROF_CSS, /\.packpick-card\[data-rarity\] \.packpick-name[^{]*\{ color: var\(--rar-hi\); \}/);
  assert.match(PROF_CSS, /@media \(max-width: 640px\) \{ \.packpick-grid \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  assert.match(PROF_CSS, /@media \(pointer: coarse\) \{ \.packpick-tile, \.market-kinds \.market-kind, \.market-filters \.market-sellpack \{ min-height: 44px; \}/);
});

// ─── AUDIT PACK-PICK (2026-10-27): the pins the cold lanes found missing ───────────────────────────────────────────────

/** A bare picker over `entries` on `sift`. */
const pickerOf = (entries, sift, extra = {}) => packPickerNode({ entries, chosen: null, sift, pick: () => {}, label: 'x', focus: 'f', empty: 'none', refusedWhat: 'Not for the market', redraw: () => {}, ...extra });
/** A picture as the host's itemPicture hands it back - fitted to the box it is asked for (the market's rows ask none). */
const picture = (item, _wake, box = 26) => ({ src: `pic:${item.name}`, w: box - 2, h: box - 4 });
const srcOf = (n) => byClass(n, 'packpick-img')[0]?.getAttribute('src') ?? null;

test('AUDIT PACK-PICK what a redraw keeps: the fold opened stays open, and "Show everything" leaves it so; the words searched for stand in the field and the page chosen shows in its menu; the field its focus key, each tile its name on hover (mutants: C01 the fold shut on a redraw; C02 its toggle unkept; C03 "Show everything" shuts it; C10 the words lost; C49 the choice lost; C39 the title gone; C41 the field\'s focus key gone)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const { goods } = pack();
  const entries = entriesOf(goods);
  const sift = freshPackSift();
  let box = pickerOf(entries, sift);
  assert.deepEqual(tilesOf(box).map((b) => b.getAttribute('title')), entries.filter((e) => !e.why).map((e) => e.name), 'a long name whole on hover');
  const fold = byClass(box, 'packpick-refused')[0];
  assert.equal(fold.open, false, 'folded at first');
  fold.open = true;
  fold.dispatch('toggle', {});
  assert.equal(sift.refusedOpen, true);
  box = pickerOf(entries, sift);
  assert.equal(byClass(box, 'packpick-refused')[0].open, true, 'open after the redraw');
  const find = byClass(box, 'packpick-find')[0];
  find.value = 'no such piece anywhere';
  find.oninput();
  await tick(160);
  [...box.querySelectorAll('button')].find((b) => b.textContent === 'Show everything').onclick();
  assert.deepEqual([sift.query, sift.refusedOpen], ['', true], 'the sift let go, the fold left open');
  Object.assign(sift, { query: 'sword', cat: 'weapons' });
  box = pickerOf(entries, sift);
  const again = byClass(box, 'packpick-find')[0];
  assert.deepEqual([again.value, again.getAttribute('data-focus')], ['sword', 'f|find']);
  const page = [...byClass(box, 'packpick-menu')].find((s) => s.getAttribute('aria-label') === 'Kind of piece');
  assert.ok(page.value === 'weapons' || [...page.children].find((o) => o.value === 'weapons')?.selected === true, 'the page chosen, shown');
});

test('AUDIT PACK-PICK the sift bar offers a choice or nothing: each page, tier and metal says its count; a page menu only where the pieces lie on two pages, a tier menu only while the ladder is on and they hold two tiers, a metal menu where a metal narrows them - and a menu chosen stays while its choice is all there is, so it can be let go; the search reads a capital as its small letter, and narrows the folded too (mutants: C04 the counts unsaid; C05 the search case-bound; C06 the folded unsifted; C07 a page menu with no choice; C08 a tier menu with the ladder off; C51 a tier menu at one tier; C09 and C50 the metal menu gone; C52 a chosen page\'s menu dropped)', () => {
  setPref(LOOT_RARITY_KEY, true);
  const { gear, goods, quest } = pack();
  applyRarity(gear[0], 'rare', seededRng(4));
  const entries = entriesOf(goods);
  const ok = entries.filter((e) => !e.why);
  const menusOf = (box) => Object.fromEntries([...byClass(box, 'packpick-menu')].map((s) => [s.getAttribute('aria-label'), [...s.children].map((o) => o.textContent)]));
  const menus = menusOf(pickerOf(entries, freshPackSift()));
  const pages = menus['Kind of piece'];
  assert.equal(pages[0], 'All', 'All\'s count is the pack\'s');
  for (const [id, label] of [['weapons', 'Weapons'], ['armor', 'Armor']]) assert.ok(pages.includes(`${label} (${ok.filter((e) => pageOf(e.item) === id).length})`), pages.join(' | '));
  assert.deepEqual(menus.Rarity, ['Rarity', `Common (${ok.length - 1})`, 'Rare (1)']);
  // the search: the first word of a name, capital and all, found by its small letters
  const first = ok[0].name.split(' ')[0];
  assert.match(first, /^[A-Z]/);
  const found = siftEntries(ok, { ...freshPackSift(), query: first.toLowerCase() });
  assert.ok(found.length > 0 && found.every((e) => e.name.toLowerCase().includes(first.toLowerCase())), first);
  // the folded, narrowed by the same search: the quest's piece by its name, the gold not
  const questWord = goods.goodName(quest).split(' ')[0].toLowerCase();
  const folded = [...byClass(byClass(pickerOf(entries, { ...freshPackSift(), query: questWord }), 'packpick-refused')[0], 'packpick-tile')].map((n) => word(n, 'packpick-name'));
  assert.ok(folded.includes(goods.goodName(quest)) && folded.length < entries.filter((e) => e.why).length, folded.join(' | '));
  // a page menu needs two pages; a chosen page keeps its menu while the pieces are all on it
  const weaponsOnly = ok.filter((e) => pageOf(e.item) === 'weapons');
  assert.equal(menusOf(pickerOf(weaponsOnly, freshPackSift()))['Kind of piece'], undefined, 'one page: no choice');
  const armourOnly = ok.filter((e) => pageOf(e.item) === 'armor');
  assert.deepEqual(menusOf(pickerOf(armourOnly, { ...freshPackSift(), cat: 'armor' }))['Kind of piece'], ['All', `Armor (${armourOnly.length})`], 'the choice there to let go');
  // a tier menu needs two tiers, and the ladder on
  assert.equal(menusOf(pickerOf(ok.filter((e) => e.item !== gear[0]), freshPackSift())).Rarity, undefined, 'all Common: no choice');
  setPref(LOOT_RARITY_KEY, false);
  assert.equal(menusOf(pickerOf(entries, freshPackSift())).Rarity, undefined, 'the ladder off: no tiers to pick');
  // a metal menu where one metal narrows the pieces - a weapon's metal beside a piece of clothing, which has none
  const cloth = generateRandomLoot({ ...LOOT_MATRICES['-'], CL: 100 }, { level: 10, gender: 'male' }, seededRng(5)).find((it) => it.group === 'MensClothing' || it.group === 'WomensClothing');
  const metalled = gear.find((it) => storeMaterialOf(it));
  assert.ok(cloth && metalled && !storeMaterialOf(cloth));
  const two = entriesOf(createMarketGoods({ items: [metalled, cloth] }));
  assert.deepEqual(menusOf(pickerOf(two, freshPackSift())).Material, ['Material', `${storeMaterialOf(metalled)} (1)`]);
});

test('AUDIT PACK-PICK the pictures: each tile the host\'s picture of its piece fitted to a row\'s box, the card\'s fitted to the pack grid\'s (never a row\'s stretched - UI1) and drawn at its own size in its frame; the folded pictured only once unfolded, each landing a redraw - in the List form from the market\'s own itemPicture and at a stall from the stall\'s (mutants: C13 the pictures never drawn; C14 the card\'s at a row\'s box; C15 the market\'s unread; C16 the stall\'s unread; A1 the folded asked while folded; A1 the folded never asked)', async () => {
  const { gear, goods } = pack();
  const entries = entriesOf(goods);
  const asked = [];
  const sift = freshPackSift();
  const box = pickerOf(entries, sift, { picture: (item, wake, b) => { asked.push([item, b]); return picture(item, wake, b); } });
  const ok = entries.filter((e) => !e.why), refused = entries.filter((e) => e.why);
  assert.deepEqual(tilesOf(box).map(srcOf), ok.map((e) => `pic:${e.item.name}`));
  assert.deepEqual(asked, ok.map((e) => [e.item, SLOT_BOX.row]), 'a row\'s box, and the folded not asked');
  const tileImg = byClass(tilesOf(box)[0], 'packpick-img')[0];
  assert.deepEqual([tileImg.getAttribute('width'), tileImg.getAttribute('height')], [String(SLOT_BOX.row - 2), String(SLOT_BOX.row - 4)], 'its own fitted size');
  const fold = byClass(box, 'packpick-refused')[0];
  const offSrcs = () => [...byClass(fold, 'packpick-tile')].map(srcOf);
  assert.deepEqual(offSrcs(), refused.map(() => null), 'folded: frames alone');
  fold.open = true;
  fold.dispatch('toggle', {});
  assert.deepEqual(offSrcs(), refused.map((e) => `pic:${e.item.name}`), 'unfolded: pictured');
  const card = packCardNode(entries[0], { picture, none: '' });
  const pic = byClass(card, 'packpick-img')[0];
  assert.deepEqual([pic.getAttribute('src'), pic.getAttribute('width'), pic.getAttribute('height')], [`pic:${entries[0].item.name}`, String(SLOT_BOX.grid - 2), String(SLOT_BOX.grid - 4)]);
  assert.ok(byClass(card, 'packpick-pic')[0].className.split(' ').includes('packpick-bigpic'), 'its frame the card\'s');
  assert.equal(byClass(pickerOf(entries, freshPackSift()), 'packpick-nopic').length, entries.length, 'no picture: a frame its size');
  const t = tabOf(bookOf(true), goods, { itemPicture: picture });
  await mine(t);
  const weapon = gear.find((it) => it.group === 'Weapons');
  const tile = tilesOf(t.root()).find((b) => word(b, 'packpick-name') === goods.goodName(weapon));
  assert.equal(srcOf(tile), `pic:${weapon.name}`, 'the market\'s');
  const stall = createVendorTab({ mode: 'stall', own: true, read: async () => ({ ok: true, data: { rows: [] } }), nameOf: (it) => goods.goodName(it), purse: () => 100,
    picture, goods: () => goods.goods(), put: async () => ({ ok: true }) }, { busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true });
  await stall.open();
  assert.equal(srcOf(tilesOf(stall.body())[0]), `pic:${goods.goods().find((g) => !g.why).item.name}`, 'the stall\'s');
});

test('AUDIT PACK-PICK the List form\'s kinds, lines and presses: the four kinds in their order with their icons and focus keys; a pack piece\'s line its tier and wear; a crafted piece\'s its tier, quality, wear and "your home", looked at when pressed and let go when pressed again; the crafted and the auction each their own search; an auction asks for its opening bid; "Sell from your pack" keeps the pack for the book (mutants: C30 the kinds reordered; C31 their icons swapped; C40 a kind\'s focus key gone; C20 the wear unsaid; C21 a crafted piece\'s tier unsaid; C22 "your home" unsaid; C23 a crafted press that never lets go; C25 the crafted card unlooked; C26 one search for both; C27 the auction asked a price; C28 the Sell press unkept)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const { gear, goods } = pack();
  const weapon = gear.find((it) => it.group === 'Weapons');
  applyRarity(weapon, 'rare', seededRng(4));
  weapon.currentCondition = wearCondition(weapon.maxCondition, 500);
  const mw = mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 77, maker: 'Me' }, 'aaaaaaaaaaaaaaaa');
  mw.currentCondition = wearCondition(mw.maxCondition, 900);
  const fine = mintPiece({ recipe: 'longsword:mithril', quality: 2, seed: 78, maker: 'Me' }, 'bbbbbbbbbbbbbbbb');
  const book = bookOf(true, { aaaaaaaaaaaaaaaa: 'yours', bbbbbbbbbbbbbbbb: 'yours' });
  const t = tabOf(book, goods, { pieces: () => [{ item: mw, where: 'home', name: 'Me\'s Longsword' }, { item: fine, where: 'pack', name: 'Fine Longsword' }] });
  await mine(t);
  const kinds = [...t.root().querySelectorAll('button')].filter((b) => b.getAttribute('data-kind'));
  assert.deepEqual(kinds.map((b) => [b.getAttribute('data-kind'), b.getAttribute('data-dficon'), b.getAttribute('data-focus')]),
    [['item', 'own', 'list-kind|item'], ['material', 'ore', 'list-kind|material'], ['piece', 'station', 'list-kind|piece'], ['auction', 'gavel', 'list-kind|auction']]);
  assert.equal(word(tilesOf(t.root()).find((b) => word(b, 'packpick-name') === goods.goodName(weapon)), 'packpick-sub'), 'Rare · worn to 50%');
  t.press('piece').onclick();
  const subOf = (name) => word(tilesOf(t.root()).find((b) => word(b, 'packpick-name') === name), 'packpick-sub');
  assert.deepEqual([subOf('Me\'s Longsword'), subOf('Fine Longsword')], ['Rare · Masterwork · worn to 90% · your home', 'Fine']);
  const mwTile = () => tilesOf(t.root()).find((b) => word(b, 'packpick-name') === 'Me\'s Longsword');
  mwTile().onclick();
  assert.deepEqual([...byClass(t.root(), 'packpick-stat')].map((n) => n.textContent), itemLookRows(mw).rows, 'looked at');
  mwTile().onclick();
  assert.equal(byClass(t.root(), 'packpick-card').length, 0, 'pressed again: let go');
  const find = byClass(t.root(), 'packpick-find')[0];
  find.value = 'fine';
  find.oninput();
  await tick(160);
  t.press('auction').onclick();
  assert.equal(byClass(t.root(), 'packpick-find')[0].value, '', 'the auction\'s own search');
  assert.deepEqual(tilesOf(t.root()).map((b) => [word(b, 'packpick-name'), word(b, 'packpick-sub')]), [['Me\'s Longsword', 'Rare · worn to 90% · your home']], 'its Masterworks, no quality said');
  assert.equal(word(t.root(), 'packpick-cardnone'), 'Press a Masterwork above to look at it and set its opening bid.');
  t.press('piece').onclick();
  assert.equal(byClass(t.root(), 'packpick-find')[0].value, 'fine', 'the crafted search where it was left');
  // the Goods' press: the pack kept for the book, so the board opened again opens there
  t.tab.state.view = 'goods';
  await t.tab.load(true);
  t.draw();
  byClass(t.root(), 'market-sellpack')[0].onclick();
  const again = tabOf(book, goods);
  await mine(again);
  assert.equal(again.press('item').getAttribute('aria-pressed'), 'true');
});

test('AUDIT PACK-PICK the stall\'s own words and presses: what stays folded under "Stays in your pack"; a piece\'s line its tier and wear; a press again lets it go; a pack of nothing it may take still shows what stays, and why (mutants: C32 the fold named as the market\'s; C33 the line unsaid; C24 a press that never lets go; C34 a refused pack said empty)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const { gear, goods, gold, quest } = pack();
  const armour = gear.find((it) => it.group === 'Armor');
  applyRarity(armour, 'rare', seededRng(4));
  armour.currentCondition = wearCondition(armour.maxCondition, 500);
  const stallOf = (g) => createVendorTab({ mode: 'stall', own: true, read: async () => ({ ok: true, data: { rows: [] } }), nameOf: (it) => g.goodName(it), purse: () => 100,
    stats: itemLookRows, goods: () => g.goods(), put: async () => ({ ok: true }) }, { busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true });
  const tab = stallOf(goods);
  await tab.open();
  let b = tab.body();
  const refused = goods.goods().filter((g) => g.why).length;
  assert.equal(byClass(b, 'packpick-refused')[0].children[0].textContent, `Stays in your pack (${refused})`);
  const tile = () => tilesOf(b).find((x) => word(x, 'packpick-name') === goods.goodName(armour));
  assert.equal(word(tile(), 'packpick-sub'), 'Rare · worn to 50%');
  tile().onclick();
  b = tab.body();
  assert.equal(byClass(b, 'packpick-card').length, 1);
  tile().onclick();
  b = tab.body();
  assert.equal(byClass(b, 'packpick-card').length, 0, 'pressed again: let go');
  const bare = stallOf(createMarketGoods({ items: [gold, quest] }));
  await bare.open();
  const nothing = bare.body();
  assert.equal(byClass(nothing, 'packpick-refused').length, 1, 'what stays, and why');
  assert.ok([...byClass(nothing, 'packpick-tile')].some((n) => word(n, 'packpick-why') === 'a quest\'s'));
});

test('AUDIT PACK-PICK the look\'s magic: an enchanted piece the loot mints says "Powers unknown." until it is identified, then its powers as the trade window says them (systems/item/itemPowers.js magicPowersLines) (mutants: C35 the powers unsaid; C36 the powers said unidentified)', () => {
  setPref(LOOT_RARITY_KEY, false);
  const prev = getMagicItemTemplates();
  try {
    setMagicItemTemplates([{ type: 0, group: 2, groupIndex: 0, enchantments: [{ type: 1, param: 0 }], uses: 100, value: 500 }]);
    const piece = generateRandomLoot({ ...LOOT_MATRICES['-'], MI: 100 }, { level: 10, gender: 'male' }, seededRng(3)).find((it) => it.enchantments?.length);
    assert.ok(piece && piece.isIdentified !== true, 'the loot\'s magic comes unidentified');
    const lines = magicPowersLines(piece, { identified: true });
    assert.ok(lines.length && lines[0] !== 'Powers unknown.');
    let look = itemLookRows(piece);
    assert.ok(look.magic.includes('Powers unknown.') && !look.magic.includes(lines[0]), look.magic.join(' | '));
    piece.isIdentified = true;
    look = itemLookRows(piece);
    assert.ok(lines.every((l) => look.magic.includes(l)) && !look.magic.includes('Powers unknown.'), look.magic.join(' | '));
  } finally { setMagicItemTemplates(prev); }
});

test('AUDIT PACK-PICK the stall opened through the vendor host looks at a piece with the one look (mutant: C53 the host\'s stall unlooked)', () => {
  const { gear } = pack();
  let host = null;
  const { openHomeVendorWindow } = createVendorHost({
    marketBook: { settle: async () => ({ ok: true, settled: 0, refused: [] }), purse: () => 0 }, marketMint: () => {}, marketPutBack: () => {}, marketDrop: () => {},
    profBook: { state: { open: true } }, marksBook: { state: { open: true } }, noticeBook: {},
    showNoticeWindow: (window) => { host = window.vendors; return true; },
  });
  assert.equal(openHomeVendorWindow({ vendor: { map: 1001, id: 'trader1' }, owner: 'Eve' }), true);
  assert.equal(host.mode, 'stall');
  const armour = gear.find((it) => it.group === 'Armor');
  assert.deepEqual(host.stats(armour), itemLookRows(armour));
});

test('AUDIT PACK-PICK the pictures that land in one frame redraw the window once (ui/menu/menuGlyphs.js frameWake) - fifty were fifty redraws, and swallowed the presses made under them (mutant: A1 each landing a redraw)', () => {
  const was = globalThis.requestAnimationFrame;
  const frames = [];
  globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
  try {
    let draws = 0;
    const wake = frameWake(() => { draws++; });
    for (let i = 0; i < 50; i++) wake();
    assert.deepEqual([draws, frames.length], [0, 1], 'one frame asked for');
    frames.shift()();
    assert.equal(draws, 1);
    wake();
    frames.shift()();
    assert.equal(draws, 2, 'a picture after it, its own');
  } finally { globalThis.requestAnimationFrame = was; }
});

test('AUDIT PACK-PICK the List form and the stall hand the host that one wake: the pictures their tiles ask for, landing together, redraw once (mutants: A1 the market\'s wake raw; A1 the stall\'s wake raw)', async () => {
  const { goods } = pack();
  const wakes = new Set();
  const asking = (item, wake) => { wakes.add(wake); return null; };
  const t = tabOf(bookOf(true), goods, { itemPicture: asking });
  await mine(t);
  let draws = 0;
  const stall = createVendorTab({ mode: 'stall', own: true, read: async () => ({ ok: true, data: { rows: [] } }), nameOf: (it) => goods.goodName(it), purse: () => 100,
    picture: asking, goods: () => goods.goods(), put: async () => ({ ok: true }) }, { busy: () => false, run: async (start) => start(), rerender: () => { draws++; }, nowS: () => 0, alive: () => true });
  await stall.open();
  stall.body();
  assert.equal(wakes.size, 2, 'one wake a tab, asked by every tile');
  const was = globalThis.requestAnimationFrame;
  const frames = [];
  globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length; };
  try {
    const before = [t.draws(), draws];
    for (const w of wakes) for (let i = 0; i < 20; i++) w();
    assert.deepEqual([t.draws(), draws, frames.length], [...before, 2], 'nothing drawn yet, a frame asked for each');
    while (frames.length) frames.shift()();
    assert.deepEqual([t.draws(), draws], [before[0] + 1, before[1] + 1]);
  } finally { globalThis.requestAnimationFrame = was; }
});

test('AUDIT PACK-PICK the List form\'s menus hold an answer\'s redraw while one is open, as the tab\'s own lists do, and let it go once a choice is made in it (mutants: A2 the picker\'s lists unheld; A2 the choice unmarked)', async () => {
  const { goods } = pack();
  const t = tabOf(bookOf(true), goods);
  await mine(t);
  const menu = [...byClass(t.root(), 'packpick-menu')].find((s) => s.getAttribute('aria-label') === 'Kind of piece');
  assert.ok(menu);
  const doc = globalThis.document;
  const was = doc.activeElement;
  doc.activeElement = menu;
  try {
    let before = t.draws();
    await t.tab.load(true);
    assert.equal(t.draws(), before + 1, 'the read began drawn; its answer waits for the list');
    menu.dispatch('blur', {});
    assert.equal(t.draws(), before + 2, 'let go: drawn');
    menu.value = 'armor';
    menu.onchange();
    before = t.draws();
    await t.tab.load(true);
    assert.equal(t.draws(), before + 2, 'a choice made in it: no hold');
  } finally { doc.activeElement = was; }
});

test('AUDIT PACK-PICK the fold counts what it holds - a search narrows it, and its count with it; a sift left over once nothing may go is let go there, so what stays is never hidden behind a field that is gone (mutants: A3 the fold counts the unsifted; A3 the leftover sift hides the fold)', () => {
  const { goods, quest } = pack();
  const entries = entriesOf(goods);
  const refused = entries.filter((e) => e.why);
  const questWord = goods.goodName(quest).split(' ')[0].toLowerCase();
  const narrowed = siftEntries(refused, { ...freshPackSift(), query: questWord });
  assert.ok(narrowed.length > 0 && narrowed.length < refused.length);
  const sift = { ...freshPackSift(), query: questWord };
  const said = (box) => byClass(box, 'packpick-refused')[0].children[0].textContent;
  assert.equal(said(pickerOf(entries, sift)), `Not for the market (${narrowed.length})`);
  const left = pickerOf(refused, { ...freshPackSift(), query: 'no such piece anywhere' });
  assert.equal(said(left), `Not for the market (${refused.length})`);
  assert.equal(byClass(left, 'packpick-refused')[0].children[1].children.length, refused.length, 'each one there');
});

test('AUDIT PACK-PICK the presses keep their place: a double press chooses (its second lands on the tile the first redrew); each tile\'s focus key its name and which of that name, so a piece come into the pack ahead of it never takes its focus; "Show everything" and the fold keyed too; the card no live region, rebuilt with every redraw (mutants: A4 a double press lets go; A8 a tile keyed by its place; A8 "Show everything" unkeyed; A8 the fold unkeyed; A9 the card a live region)', () => {
  const { goods } = pack();
  const entries = entriesOf(goods).map(({ key, ...e }) => e);
  const picked = [];
  const box = pickerOf(entries, freshPackSift(), { pick: (it) => picked.push(it) });
  const tiles = tilesOf(box);
  tiles[0].onclick({ detail: 1, stopPropagation() {} });
  tiles[0].onclick({ detail: 2, stopPropagation() {} });
  assert.equal(picked.length, 1, 'the second of a double press is not a second press');
  const ok = entries.filter((e) => !e.why);
  const nth = (i) => ok.slice(0, i + 1).filter((e) => e.name === ok[i].name).length;
  assert.deepEqual(tiles.map((b) => b.getAttribute('data-focus')), ok.map((e, i) => `f|${e.name}#${nth(i)}`));
  const ahead = [{ item: { name: 'a newcomer' }, name: 'A Newcomer' }, ...entries];
  assert.deepEqual(tilesOf(pickerOf(ahead, freshPackSift())).slice(1).map((b) => b.getAttribute('data-focus')), tiles.map((b) => b.getAttribute('data-focus')), 'the same keys behind a newcomer');
  assert.equal(byClass(box, 'packpick-refused')[0].children[0].getAttribute('data-focus'), 'f|refused');
  const none = pickerOf(entries, { ...freshPackSift(), query: 'no such piece anywhere' });
  assert.equal([...none.querySelectorAll('button')].find((b) => b.textContent === 'Show everything').getAttribute('data-focus'), 'f|all');
  assert.equal(packCardNode(entries[0], { none: '' }).getAttribute('aria-live'), undefined);
});

test('AUDIT PACK-PICK the kinds and "Sell from your pack" are chips as the views are (never the frame\'s .act, whose rules outranked theirs), a tier\'s tile answers the pointer; a realm character whose pack holds nothing that may go opens on the Stores (mutants: A5 the kinds as .act; A6 a tier\'s tile deaf to the pointer; the pack opened with nothing to sell)', async () => {
  const { goods, gold, quest } = pack();
  const t = tabOf(bookOf(true), goods);
  await mine(t);
  assert.deepEqual(LIST_KINDS.map(([k]) => t.press(k).className.split(' ').slice(0, 2)), LIST_KINDS.map(() => ['notice-tab', 'market-kind']));
  assert.ok(!t.press('item').className.split(' ').includes('act'));
  t.tab.state.view = 'goods';
  await t.tab.load(true);
  t.draw();
  assert.deepEqual(byClass(t.root(), 'market-sellpack')[0].className.split(' '), ['notice-tab', 'market-sellpack']);
  assert.match(PROF_CSS, /\.packpick-tile\[data-rarity\]:hover \{ border-color: var\(--rar\);/);
  assert.ok(PROF_CSS.indexOf('.packpick-tile[data-rarity]:hover') > PROF_CSS.indexOf('.packpick-tile[data-rarity] {'), 'after the frame it answers over');
  const bare = tabOf(bookOf(true), createMarketGoods({ items: [gold, quest] }));
  await mine(bare);
  assert.equal(bare.press('material').getAttribute('aria-pressed'), 'true', 'the Stores');
  bare.press('item').onclick();
  assert.equal(word(bare.root(), 'packpick-empty'), 'Nothing in your pack can go on the market.', 'the pack still one press away, and why');
});

test('AUDIT PACK-PICK the window\'s paint waits on a press held down in it, and paints once it is let go - after the press\'s own click; a press held past two seconds holds it no more (mutants: B1 a paint under a press; B1 the paint after it a microtask; B1 never let go)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  const ups = [];
  const add = globalThis.addEventListener;
  globalThis.addEventListener = (t, f, o) => { if (t === 'pointerup') ups.push(f); return add(t, f, o); };
  let v;
  try { v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: 1 }, book: noticeBook }); } finally { globalThis.addEventListener = add; }
  try {
    await tick();
    const shell = host.querySelector('.notice-shell'), win = host.querySelector('.notice-win');
    const first = () => win.children[0];
    let before = first();
    shell.dispatch('pointerdown', {});
    v.repaint();
    assert.equal(first(), before, 'held: the pressed node stands');
    for (const f of ups) f({ type: 'pointerup' });
    await Promise.resolve();
    assert.equal(first(), before, 'not before the click that follows the pointer up');
    await tick();
    assert.notEqual(first(), before, 'painted once let go');
    before = first();
    const now = Date.now;
    shell.dispatch('pointerdown', {});
    Date.now = () => now() + 2500;
    try { v.repaint(); } finally { Date.now = now; }
    assert.notEqual(first(), before, 'a press held past two seconds is no hold');
    for (const f of ups) f({ type: 'pointerup' });
  } finally { v.unmount(); }
});

test('AUDIT PACK-PICK the keys: the tiles are one stop of the Tab key (the chosen tile, or the first) and the arrows walk them; List, "Put up for sale" and the kind "Sell from your pack" opens keep the focus through a redraw (mutants: B2 every tile a Tab stop; B2 the arrows deaf; B2 List unkeyed; B2 the stall\'s press unkeyed; B2 the Sell press\'s focus dropped)', async () => {
  const { goods } = pack();
  const entries = entriesOf(goods);
  const ok = entries.filter((e) => !e.why);
  const box = pickerOf(entries, freshPackSift());
  let tiles = tilesOf(box);
  assert.deepEqual(tiles.map((b) => b.getAttribute('tabindex')), ok.map((_, i) => (i === 0 ? '0' : '-1')), 'one stop, the first');
  const press = (b, key) => { const ev = { key, preventDefault() { this.prevented = true; }, stopPropagation() {} }; b.onkeydown(ev); return ev; };
  globalThis.document.activeElement = tiles[0];
  assert.ok(press(tiles[0], 'ArrowRight').prevented);
  assert.equal(globalThis.document.activeElement, tiles[1]);
  assert.deepEqual([tiles[0].getAttribute('tabindex'), tiles[1].getAttribute('tabindex')], ['-1', '0'], 'the stop walks with it');
  press(tiles[1], 'End');
  assert.equal(globalThis.document.activeElement, tiles.at(-1));
  press(tiles.at(-1), 'ArrowDown');
  assert.equal(globalThis.document.activeElement, tiles.at(-1), 'the last stays the last');
  press(tiles.at(-1), 'Home');
  assert.equal(globalThis.document.activeElement, tiles[0]);
  assert.equal(press(tiles[0], 'a').prevented, undefined, 'a letter is not the tiles\'');
  tiles = tilesOf(pickerOf(entries, freshPackSift(), { chosen: ok[3].item }));
  assert.deepEqual(tiles.map((b, i) => [i, b.getAttribute('tabindex')]).filter(([, x]) => x === '0'), [[3, '0']], 'the chosen tile the stop');
  const t = tabOf(bookOf(true), goods);
  await mine(t);
  assert.equal([...t.root().querySelectorAll('button')].find((b) => b.textContent === 'List').getAttribute('data-focus'), 'list-do');
  t.tab.state.view = 'goods';
  await t.tab.load(true);
  t.draw();
  assert.equal(byClass(t.root(), 'market-sellpack')[0].getAttribute('data-focus'), 'list-kind|item', 'the pack\'s kind\'s own key: the focus lands on it');
  const stall = createVendorTab({ mode: 'stall', own: true, read: async () => ({ ok: true, data: { rows: [] } }), nameOf: (it) => goods.goodName(it), purse: () => 100,
    goods: () => goods.goods(), put: async () => ({ ok: true }) }, { busy: () => false, run: async (start) => start(), rerender: () => {}, nowS: () => 0, alive: () => true });
  await stall.open();
  assert.equal([...stall.body().querySelectorAll('button')].find((b) => b.textContent === 'Put up for sale').getAttribute('data-focus'), 'vendor-post');
});

test('AUDIT PACK-PICK a crafted piece and a Masterwork to auction are each their kind\'s own choice - a look at the auction keeps the crafted choice, and a Masterwork chosen there is never carried into a sale at a price; their search speaks of no pack (mutants: B3 one choice for both; B6 the pack\'s words over pieces in a home)', async () => {
  const { goods } = pack();
  const mw = mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 77, maker: 'Me' }, 'aaaaaaaaaaaaaaaa');
  const fine = mintPiece({ recipe: 'longsword:mithril', quality: 2, seed: 78, maker: 'Me' }, 'bbbbbbbbbbbbbbbb');
  const t = tabOf(bookOf(true, { aaaaaaaaaaaaaaaa: 'yours', bbbbbbbbbbbbbbbb: 'yours' }), goods, { pieces: () => [{ item: mw, where: 'home', name: 'Me\'s Longsword' }, { item: fine, where: 'pack', name: 'Fine Longsword' }] });
  await mine(t);
  const tile = (name) => tilesOf(t.root()).find((b) => word(b, 'packpick-name') === name);
  const chosen = () => word(byClass(t.root(), 'packpick-card')[0] ?? t.root(), 'packpick-name') ?? null;
  t.press('piece').onclick();
  const find = byClass(t.root(), 'packpick-find')[0];
  assert.deepEqual([find.getAttribute('placeholder') ?? find.placeholder, find.getAttribute('aria-label')], ['Search by name', 'Search by name']);
  tile('Fine Longsword').onclick();
  t.press('auction').onclick();
  assert.equal(byClass(t.root(), 'packpick-card').length, 0, 'the auction\'s own: none chosen there');
  tile('Me\'s Longsword').onclick();
  t.press('piece').onclick();
  assert.equal(chosen(), 'Fine Longsword', 'the crafted choice where it was left');
  t.press('auction').onclick();
  assert.equal(chosen(), 'Me\'s Longsword');
  t.press('piece').onclick();
  const none = byClass(t.root(), 'packpick-find')[0];
  none.value = 'no such piece anywhere';
  none.oninput();
  await tick(160);
  assert.equal(word(t.root(), 'packpick-none'), 'Nothing matches. Show everything');
});

test('AUDIT PACK-PICK the dress for a finger and an eye: the search, the menus, the price and the fold\'s name a finger\'s height on a touch screen; the chosen tile a mark and a light line, never its colour alone; a refused tile no hover (mutants: B4 the form small to a finger; B5 the chosen by colour alone; B the refused hovered)', () => {
  assert.match(PROF_CSS, /\.packpick-find, \.packpick-menu, \.market-listform \.market-num \{ min-height: 44px; \}/);
  assert.match(PROF_CSS, /\.packpick-refused > summary \{ display: flex; align-items: center; min-height: 44px; \}/);
  const coarse = PROF_CSS.indexOf('@media (pointer: coarse) { .packpick-tile');
  assert.ok(coarse > 0 && PROF_CSS.indexOf('.packpick-refused > summary { display: flex') > coarse && PROF_CSS.indexOf('.packpick-refused > summary { display: flex') < PROF_CSS.indexOf('@media (max-width: 640px) { .packpick-grid'), 'inside the coarse pointer\'s rule');
  assert.match(PROF_CSS, /\.packpick-tile\.on::after \{ content: '\\2713';/);
  assert.match(PROF_CSS, /\.packpick-tile\.on \{ padding-right: 18px; box-shadow: inset 0 0 0 2px #f3ead8; \}/);
  assert.match(PROF_CSS, /\.packpick-tile\.on\[data-rarity\] \{ box-shadow: inset 0 0 0 2px #f3ead8,/);
  assert.match(PROF_CSS, /button\.packpick-tile:hover, \.packpick-tile:focus-visible \{/);
  assert.ok(!/(^|[^n])\.packpick-tile:hover/.test(PROF_CSS.replace(/button\.packpick-tile:hover/g, '')), 'no hover for every tile');
});

test('AUDIT PACK-PICK the window gives the focus back to the fold\'s name, keyed, after a paint - a picture landing took it to the page (mutant: B the fold\'s name never given back)', async () => {
  const { goods } = pack();
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  document.body.append(host);
  const v = mountNoticeBoard(host, { town: { name: 'Daggerfall', mapId: 1 }, book: noticeBook, market: marketHostOf(bookOf(true), goods) });
  try {
    await tick();
    [...host.querySelectorAll('.notice-tab')].find((b) => b.textContent.startsWith('Market')).onclick();
    await tick();
    [...host.querySelectorAll('.market-view')].find((b) => b.textContent.startsWith('My listings')).onclick();
    await tick();
    const summary = () => host.querySelector('.packpick-refused').children[0];
    summary().focus();
    v.repaint();
    assert.equal(globalThis.document.activeElement, summary(), 'the new fold\'s name has it');
    assert.equal(summary().getAttribute('data-focus'), 'list-good|refused');
  } finally { v.unmount(); host.remove(); }
});
