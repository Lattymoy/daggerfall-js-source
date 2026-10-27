// MARKET-LOOK (2026-10-27, the owner: "on the market/notice board do offered items there show stats? enchantments etc?
// ... thats a big issue"): WHAT IS OFFERED IS LOOKED AT BEFORE IT IS BOUGHT - ui/marketTab.js lookNode: the picked row of
// Crafted, Goods and Auctions opens the List form's card (ui/packPicker.js packCardNode) over its bar, its rows and magic
// the look panel's (systems/item/itemLook.js itemLookRows), of the item that arrives - a crafted piece as the collect
// mints it (systems/smithItems.js mintMarketPiece), a pack's piece through its name's clamp (systems/tradePack.js
// goodItemOf). The pieces are the producers' (loot.js generateRandomLoot, lootRarity.js applyRarity, smithItems.js
// mintPiece; the wire's record tradePack.js createMarketGoods). Mutants: tools/mutants/market_look.json.
import '../chargenDom.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMarketTab } from '../../src/ui/marketTab.js';
import { createMarketGoods, goodItemOf } from '../../src/systems/tradePack.js';
import { itemLookRows } from '../../src/systems/item/itemLook.js';
import { mintPiece, mintMarketPiece } from '../../src/systems/smithItems.js';
import { wearCondition } from '../../src/net/marketLaw.js';
import { MASTERWORK } from '../../src/net/recipeLaw.js';
import { MINT_VERSION } from '../../src/net/productRecord.js';
import { generateRandomLoot, LOOT_MATRICES } from '../../src/systems/loot/loot.js';
import { applyRarity, LOOT_RARITY_KEY } from '../../src/systems/loot/lootRarity.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';

afterEach(() => resetPrefs());
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const byClass = (n, c) => [...n.querySelectorAll(`.${c}`)];
const texts = (n, c) => byClass(n, c).map((x) => x.textContent);
/** The node after `n` among its parent's children. */
const after = (n) => { const kids = [...n.parentNode.children]; return kids[kids.indexOf(n) + 1]; };

/** A Rare weapon a body drops, and the record its seller's pack lists it as (the trade's wire). */
function listedGood() {
  const loot = generateRandomLoot({ ...LOOT_MATRICES['-'], MinGold: 0, MaxGold: 0, WP: 100, AM: 0 }, { level: 10, gender: 'male' }, seededRng(21));
  const weapon = loot.find((it) => it.group === 'Weapons' && it.templateIndex !== ARROW_TEMPLATE);
  assert.ok(weapon, 'the drop holds a weapon');
  applyRarity(weapon, 'rare', seededRng(4));
  const goods = createMarketGoods({ items: [weapon] });
  return { weapon, goods, record: goods.good(weapon).offered };
}
/** A Masterwork's record as the service sends it (server-account/src/market.js pieceOf), worn to 62%. */
const masterwork = (over = {}) => ({ recipe: 'dagger:steel', quality: MASTERWORK, seed: 9, maker: 'Ana', provenance: '00000000000000ab', wear: 620, version: MINT_VERSION, ...over });

function rig(rows, { goods = null } = {}) {
  const book = { state: { open: true, balance: 5000, road: [], counts: {}, goldHeld: 0 }, pending: 0, cached: () => null, goldOk: true, purse: () => 5000,
    read: async (view) => ({ ok: true, data: { rows: rows[view] ?? [], medians: {}, total: (rows[view] ?? []).length } }), settle: async () => ({ ok: true, settled: 0 }) };
  const m = { book, stores: () => new Map(), region: 17, regionName: 'Daggerfall', regionNameOf: () => 'Daggerfall', hubs: { 17: [207, 212] }, name: (k) => k, countName: (k) => k,
    pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'Ana\'s Dagger', weavers: [], stock: async () => ({ ok: true }),
    ...(goods ? { goods: () => goods.goods(), good: (it) => goods.good(it), goodName: (r) => goods.goodName(r) } : {}) };
  let root = null;
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => start(), rerender: () => { root = tab.body(); }, nowS: () => 0, alive: () => true });
  const show = async (view) => { tab.state.view = view; await tab.load(true); root = tab.body(); };
  const pick = (i = 0) => { byClass(root, 'market-row')[i].onclick(); root = tab.body(); };
  return { tab, show, pick, root: () => root };
}
const row = (id, kind, extra) => ({ id, kind, region: 17, price: 400, units: 1, road: { courier: 0, seconds: 0, road: 0 }, currency: kind === 'item' ? 'gold' : 'marks', ...extra });

test('MARKET-LOOK a crafted piece offered: minted from its record at its wear - the one mint the collect puts into the pack (world.js marketMint reads it); none for no record or one this client cannot mint (mutants: the wear unread; the collect\'s own mint)', () => {
  const rec = masterwork();
  const it = mintMarketPiece(rec);
  const whole = mintPiece(rec, rec.provenance);
  assert.equal(it.maxCondition, whole.maxCondition);
  assert.equal(it.currentCondition, wearCondition(whole.maxCondition, 620));
  assert.ok(it.currentCondition < it.maxCondition, 'worn, as listed');
  assert.deepEqual(it.enchantments, whole.enchantments, 'its record\'s roll');
  assert.equal(mintMarketPiece(null), null);
  assert.equal(mintMarketPiece({ ...rec, provenance: undefined }), null);
  assert.equal(mintMarketPiece(masterwork({ recipe: 'no:such' })), null);
  assert.match(src('src/scenes/world.js'), /const it = mintMarketPiece\(piece\);/, 'the collect mints what the look shows');
});

test('MARKET-LOOK the Crafted view: the picked row opens its piece\'s card over its bar - the look panel\'s rows and its magic, the row\'s name; an unpicked row none; a row this client cannot mint keeps its bar alone (mutants: the look never drawn; the look of the wrong piece)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const rec = masterwork();
  const r = rig({ crafted: [row('c1', 'piece', { piece: rec }), row('c2', 'piece', { piece: masterwork({ recipe: 'no:such', provenance: '00000000000000ac' }) })] });
  await r.show('crafted');
  assert.equal(byClass(r.root(), 'market-look').length, 0, 'nothing picked: nothing looked at');
  r.pick(0);
  const [card] = byClass(r.root(), 'market-look');
  assert.ok(card, 'the picked piece looked at');
  const look = itemLookRows(mintMarketPiece(rec));
  assert.deepEqual(texts(card, 'packpick-stat'), look.rows);
  assert.ok(look.rows.some((t) => /^Damage: \d+ - \d+$/.test(t)) && look.rows.some((t) => /^Condition: /.test(t)), look.rows.join(' | '));
  assert.ok(look.magic.length > 0, 'a Masterwork says its tier and its lines');
  assert.deepEqual(texts(card, 'packpick-magic').length ? [...byClass(card, 'packpick-magic')[0].children].map((n) => n.textContent) : [], look.magic);
  assert.equal(texts(card, 'packpick-name')[0], 'Ana\'s Dagger');
  assert.equal(after(card).className, 'market-bar', 'over its bar');
  r.pick(1);
  assert.equal(byClass(r.root(), 'market-look').length, 0, 'a record not minted here: no card');
  assert.equal(byClass(r.root(), 'market-bar').length, 1, 'its bar still there');
});

test('MARKET-LOOK the Goods view: a pack\'s piece picked is looked at through the clamp its name reads (tradePack.js goodItemOf) - its rows and its Rare lines (mutants: the Goods look never drawn; the raw record read)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const { weapon, goods, record } = listedGood();
  const r = rig({ goods: [row('g1', 'item', { item: record })] }, { goods });
  await r.show('goods');
  r.pick(0);
  const [card] = byClass(r.root(), 'market-look');
  assert.ok(card, 'the picked piece looked at');
  const look = itemLookRows(goodItemOf(record));
  assert.deepEqual(texts(card, 'packpick-stat'), look.rows);
  assert.deepEqual(look.rows, itemLookRows(weapon).rows, 'the piece the seller holds');
  assert.ok(look.magic.length > 0);
  assert.deepEqual([...byClass(card, 'packpick-magic')[0].children].map((n) => n.textContent), look.magic);
  assert.equal(card.getAttribute('data-rarity'), 'rare');
  assert.equal(goodItemOf(null), null);
  // a forged record - a tier off the ladder - is no piece the clamp passes: the row keeps its bar, and nothing is looked at
  const forged = { ...record, rarity: 'godly' };
  assert.equal(goodItemOf(forged), null);
  const f = rig({ goods: [row('g2', 'item', { item: forged })] }, { goods });
  await f.show('goods');
  f.pick(0);
  assert.equal(byClass(f.root(), 'market-look').length, 0, 'a forged piece is not shown as if it were one');
  assert.equal(byClass(f.root(), 'market-bar').length, 1);
});

test('MARKET-LOOK the Auctions view: a Masterwork picked is looked at over its Bid (mutant: the auction\'s look never drawn)', async () => {
  setPref(LOOT_RARITY_KEY, true);
  const rec = masterwork();
  const r = rig({ auctions: [{ ...row('a1', 'piece', { piece: rec }), kind: undefined, opening: 100, high: null, bids: 0, next: 100, endsAt: 3600 }] });
  await r.show('auctions');
  r.pick(0);
  const [card] = byClass(r.root(), 'market-look');
  assert.ok(card);
  assert.deepEqual(texts(card, 'packpick-stat'), itemLookRows(mintMarketPiece(rec)).rows);
  assert.equal(after(card).className, 'market-bar');
});
