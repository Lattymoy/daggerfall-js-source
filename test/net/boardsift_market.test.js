// BOARD-SIFT (2026-10-21, feature-feedback: "The notice board market also doesnt show everything if there are too many
// weapons/armor/etc listed it stops after a certain number"): THE MARKET'S VIEWS OF PIECES AND ORDERS TURN PAGES - a
// view showed its first MARKET_SHOWN rows and nothing past them - every filter in the query so a page is a page; Crafted,
// Goods and Auctions read in the order asked; Crafted and Auctions searched by the recipes a search names, Crafted by its
// least quality (net/marketLaw.js, server-account/src/market.js marketRead, net/marketBook.js keyOf). AUDIT BOARD-SIFT
// (2026-10-22): the fixture's orders apart - the cheapest, the dearest, the newest, the best and the soonest to end each a
// different row, auctions with standing bids - and every order judged against a plain model of it; a search is the
// client's recipes. The record: bible/06-Systems/Professions-Arc.md 10.13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { recipeById, RECIPES } from '../../src/net/recipeLaw.js';
import { material } from '../../src/net/nodeLaw.js';
import {
  MARKET_SHOWN, MARKET_PAGED_VIEWS, MARKET_PAGES_MAX, MARKET_SORTS, MARKET_QUERY_MAX, marketPageOf, marketSortOf, marketQueryOf, marketQualityOf, recipesNamed,
  searchWords, wordsIn, marketRecipesOf,
} from '../../src/net/marketLaw.js';
import { createMarketBook } from '../../src/net/marketBook.js';

test('BOARD-SIFT the law: the paged views, a page in range or the first, a view\'s orders its own first, a search trimmed and lower-cased, a least quality 1 to Masterwork; a search\'s words each in a name or its piece\'s shown name, read without spaces and hyphens too, of the families asked; the recipes a read asks known and once (mutants: a page past the last kept; an unknown order kept; one word enough; the families ignored; the shown name ignored; the close reading gone; an unknown recipe kept)', () => {
  assert.deepEqual(MARKET_PAGED_VIEWS, ['crafted', 'goods', 'auctions', 'orders']);
  assert.deepEqual([MARKET_PAGES_MAX, MARKET_QUERY_MAX], [500, 40]);
  assert.deepEqual([0, 1, 499, 500, -1, 1.5, '2', null, undefined, NaN].map(marketPageOf), [0, 1, 499, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(MARKET_SORTS, { crafted: ['cheap', 'dear', 'new', 'quality'], goods: ['cheap', 'dear', 'new'], auctions: ['ending', 'cheap', 'dear', 'new'] });
  assert.deepEqual([marketSortOf('crafted', 'quality'), marketSortOf('crafted', 'ending'), marketSortOf('goods', 'quality'), marketSortOf('auctions', 'cheap'),
    marketSortOf('auctions', null), marketSortOf('materials', 'cheap'), marketSortOf('__proto__', 'cheap'), marketSortOf('crafted', ['cheap'])],
  ['quality', 'cheap', 'cheap', 'cheap', 'ending', null, null, 'cheap']);
  assert.deepEqual([marketQueryOf('  Mithril SWORD '), marketQueryOf(42), marketQueryOf(null), marketQueryOf('x'.repeat(60)).length], ['mithril sword', '', '', 40]);
  assert.deepEqual([0, 1, 4, 5, -1, 2.5, '3'].map(marketQualityOf), [0, 1, 4, 0, 0, 0, 0]);
  assert.deepEqual(searchWords('  Short  BOW '), ['short', 'bow']);
  assert.deepEqual([wordsIn(['shortbow'], 'Oak Short Bow'), wordsIn(['daikatana'], 'Ebony Dai-Katana'), wordsIn(['dai-katana'], 'Ebony Dai-Katana'), wordsIn(['short', 'axe'], 'Oak Short Bow'), wordsIn([], 'x')],
    [true, true, true, false, true]);
  assert.deepEqual(recipesNamed('mithril dagger'), ['dagger:mithril']);
  assert.deepEqual(recipesNamed('Mithril  SWORD ', ['weapons']), ['shortsword:mithril', 'broadsword:mithril', 'longsword:mithril']);
  assert.deepEqual(recipesNamed('dagger', ['armour']), [], 'of the families asked');
  assert.equal(recipesNamed('', ['kits']).length, 10, 'no words: the families whole');
  // the name a recipe's piece wears on its row: a Pine Staff is an "Iron Staff"
  const shown = (r) => ({ 'staff:pine': 'Iron Staff', 'staff:oak': 'Steel Staff' })[r.id] ?? null;
  assert.deepEqual(recipesNamed('iron staff', ['staves']), ['staff:ironwood'], 'the recipe\'s own name alone');
  assert.deepEqual(recipesNamed('iron staff', ['staves'], shown), ['staff:pine', 'staff:ironwood'], 'and the name its row wears');
  assert.deepEqual(recipesNamed('shortbow pine', ['bows']), ['shortbow:pine'], 'read without its space');
  assert.deepEqual([marketRecipesOf(['dagger:mithril', 'nope', 'dagger:mithril', 7, null]), marketRecipesOf([]), marketRecipesOf('dagger:mithril'), marketRecipesOf(null)],
    [['dagger:mithril'], [], null, null]);
});

const N_PIECES = 230, N_AUCTIONS = 130, N_GOODS = 120, N_ORDERS = 105;
/** A permutation of 0..n-1 (k prime to n), shifted by c - so each order's first is its own row. */
const perm = (i, k, n, c = 0) => (i * k + c) % n;
const pid = (c, i) => `${c}${String(i).padStart(3, '0')}`;
/** The fixture as a plain model: each listing's own numbers. */
const PIECES = Array.from({ length: N_PIECES }, (_, i) => ({ id: pid('p', i), price: perm(i, 37, N_PIECES, 11) + 1, at: T0 - perm(i, 53, N_PIECES, 101), quality: (i * 3) % 5,
  recipe: i < 200 ? 'longsword:mithril' : 'cuirass:iron' }));
const AUCTIONS = Array.from({ length: N_AUCTIONS }, (_, i) => ({ id: pid('a', i), opening: perm(i, 7, N_AUCTIONS, 3) + 10, high: i % 3 === 0 ? perm(i, 11, N_AUCTIONS, 50) + 5 : null,
  at: T0 - perm(i, 17, N_AUCTIONS, 40), endsAt: T0 + 3600 + perm(i, 19, N_AUCTIONS, 77), recipe: i < 120 ? 'longsword:mithril' : 'dagger:mithril' }));
const GOODS = Array.from({ length: N_GOODS }, (_, i) => ({ id: pid('g', i), price: perm(i, 7, N_GOODS, 5) + 10, at: T0 - perm(i, 13, N_GOODS, 60), group: i < 115 ? 'Weapons' : 'Jewellery' }));
const ORDERS = Array.from({ length: N_ORDERS }, (_, i) => ({ id: pid('o', i), price: perm(i, 2, N_ORDERS) + 1, at: T0 - i, material: i % 4 === 0 ? 'log:oak' : 'metal:iron' }));
const cmp = (...keys) => (a, b) => { for (const k of keys) { const d = k(a, b); if (d) return d; } return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; };
const ids = (rows) => rows.map((r) => r.id);

/** A service over the fixture, read as a buyer. */
async function marketOf() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const buyer = await s.registered('Buyer'), db = s.env.DB._raw;
  for (let i = 0; i < 40; i++) db.prepare('INSERT INTO players(id,handle,handle_lc,guest_name,created_at,last_seen) VALUES(?,?,?,?,?,?)').run(`s${i}`, `Seller${i}`, `seller${i}`, 'Fixture', T0, T0);
  const pv = (i) => i.toString(16).padStart(16, '0');
  const product = db.prepare('INSERT INTO products(provenance,owner,char_id,maker,recipe,template,material,quality,seed,record,made_at,listed) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)');
  const piece = (i, recipe, quality) => {
    const seller = `s${i % 40}`, r = recipeById(recipe);
    product.run(pv(i), seller, `c${seller}`, 'Fixture', recipe, r.templateIndex, r.material ?? 0, quality, 4242, 'p1.x', T0);
    return seller;
  };
  const listing = db.prepare("INSERT INTO market_listings(id,seller,char_id,region,kind,provenance,units,own,price,wear,fee,at,expires_at,rid,n) VALUES(?,?,?,17,'piece',?,1,1,?,1000,1,?,?,?,'')");
  PIECES.forEach((p, i) => { const seller = piece(i, p.recipe, p.quality); listing.run(p.id, seller, `c${seller}`, pv(i), p.price, p.at, T0 + 86400, `r${i}`); });
  // a piece of a family Crafted does not list (arrows), listed the cheapest of all: never in Crafted, whatever is asked
  const arrows = RECIPES.find((r) => r.family === 'arrows').id;
  { const seller = piece(900, arrows, 0); listing.run('zarrow', seller, `c${seller}`, pv(900), 1, T0, T0 + 86400, 'rarrow'); }
  const auction = db.prepare("INSERT INTO market_auctions(id,seller,char_id,region,provenance,wear,opening,high,bids,fee,at,ends_at,rid,n) VALUES(?,?,?,17,?,1000,?,?,?,1,?,?,?,'')");
  AUCTIONS.forEach((a, i) => { const seller = piece(1000 + i, a.recipe, 4); auction.run(a.id, seller, `c${seller}`, pv(1000 + i), a.opening, a.high, a.high == null ? 0 : 1, a.at, a.endsAt, `ra${i}`); });
  const good = db.prepare("INSERT INTO market_listings(id,seller,char_id,region,kind,item,units,own,price,fee,at,expires_at,rid,n,currency) VALUES(?,?,?,17,'item',?,1,1,?,1,?,?,?,'','gold')");
  GOODS.forEach((g, i) => good.run(g.id, `s${i % 40}`, `cs${i % 40}`, JSON.stringify({ group: g.group, templateIndex: 1, stackCount: 1 }), g.price, g.at, T0 + 86400, `rg${i}`));
  good.run('gbad', 's0', 'cs0', '{broken', 1, T0, T0 + 86400, 'rgbad');
  const order = db.prepare("INSERT INTO market_orders(id,poster,char_id,region,material,units,left_units,price,escrow,at,expires_at,rid,n) VALUES(?,?,?,17,?,5,5,?,5,?,?,?,'')");
  ORDERS.forEach((o, i) => order.run(o.id, `s${i % 40}`, `cs${i % 40}`, o.material, o.price, o.at, T0 + 86400, `ro${i}`));
  const read = async (view, extra = {}) => {
    const r = await s.call('/v1/market/read', { character: buyer.character, region: 17, view, hubs: { 17: [207, 212] }, ...extra }, buyer.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  /** Every page of a read, in order. */
  const all = async (view, extra = {}) => {
    const first = await read(view, extra), out = [...(first.rows ?? first.orders)];
    for (let p = 1; p * MARKET_SHOWN < first.total; p++) { const b = await read(view, { ...extra, page: p }); out.push(...(b.rows ?? b.orders)); }
    return { total: first.total, rows: out };
  };
  return { read, all };
}
const clock = () => { const real = Date.now; Date.now = () => T0 * 1000; return () => { Date.now = real; }; };

test('BOARD-SIFT Crafted: a page of MARKET_SHOWN at a time and the whole count, every listing on one page; each order its own - cheapest, dearest, newest, best quality - the pages together the model\'s order; a search\'s recipes, a family past the crafted ones and the least quality in the query, the count theirs (mutants: no offset; an order ignored or swapped; the search ignored; a family not crafted served; the quality ignored; the count without it)', async () => {
  const done = clock();
  try {
    const { read, all } = await marketOf();
    const p0 = await read('crafted');
    assert.deepEqual([p0.page, p0.total, p0.rows.length], [0, N_PIECES, MARKET_SHOWN]);
    assert.ok(p0.rows.every((r) => r.road), 'each row its courier');
    const p2 = await read('crafted', { page: 2 });
    assert.deepEqual([p2.page, p2.rows.length], [2, N_PIECES - 2 * MARKET_SHOWN]);
    assert.deepEqual(ids((await read('crafted', { page: MARKET_PAGES_MAX })).rows), ids(p0.rows), 'a page past the last: the first');
    const model = {
      cheap: cmp((a, b) => a.price - b.price, (a, b) => a.at - b.at),
      dear: cmp((a, b) => b.price - a.price, (a, b) => a.at - b.at),
      new: cmp((a, b) => b.at - a.at),
      quality: cmp((a, b) => b.quality - a.quality, (a, b) => a.price - b.price, (a, b) => a.at - b.at),
    };
    for (const [sort, by] of Object.entries(model)) {
      const got = await all('crafted', sort === 'cheap' ? {} : { sort });
      assert.deepEqual(ids(got.rows), ids([...PIECES].sort(by)), `${sort}: the pages together, the model's order`);
    }
    const firsts = Object.keys(model).map((sort) => [...PIECES].sort(model[sort])[0].id);
    assert.equal(new Set(firsts).size, 4, 'each order a different first row - an order ignored is seen');
    assert.deepEqual(ids((await read('crafted', { sort: 'nonsense' })).rows), ids(p0.rows), 'an order it does not offer: its own');
    const cuirass = await read('crafted', { recipes: ['cuirass:iron'] });
    assert.deepEqual([cuirass.total, cuirass.rows.length, cuirass.rows.every((r) => r.piece.recipe === 'cuirass:iron')], [30, 30, true], 'thirty, past two hundred cheaper swords');
    assert.deepEqual([(await read('crafted', { recipes: ['longsword:mithril'], family: 'armour' })).total, (await read('crafted', { recipes: [] })).total,
      (await read('crafted', { recipes: ['nope', 3] })).total, (await read('crafted', { recipes: 'longsword:mithril' })).total], [0, 0, 0, N_PIECES],
    'a family the search\'s recipes are not of: none; a search that named none: none; no list: no search');
    assert.equal((await read('crafted', { family: 'arrows' })).total, 0, 'a family Crafted does not list: none');
    const fine = await read('crafted', { quality: 3 });
    assert.equal(fine.total, PIECES.filter((p) => p.quality >= 3).length, 'Superior or better: its count');
    assert.ok(fine.rows.every((r) => r.piece.quality >= 3));
    assert.equal((await read('crafted', { quality: 9 })).total, N_PIECES, 'a quality it does not know: any');
  } finally { done(); }
});

test('BOARD-SIFT Goods, Auctions and Orders: each a page at a time with its count - a broken record counted nowhere, a family\'s orders counted as its own; every order the model\'s, Auctions\' cheapest and dearest by the standing bid where one stands; Auctions searched by recipes within its family (mutants: goods\' broken record counted; an auction\'s order ignored or the opening alone; the orders unpaged; the orders\' count without the family; the family dropped from a search)', async () => {
  const done = clock();
  try {
    const { read, all } = await marketOf();
    const goods = await read('goods');
    assert.deepEqual([goods.total, goods.rows.length, (await read('goods', { page: 1 })).rows.length], [N_GOODS, 100, 20], 'the broken record nowhere');
    const gModel = { cheap: cmp((a, b) => a.price - b.price, (a, b) => a.at - b.at), dear: cmp((a, b) => b.price - a.price, (a, b) => a.at - b.at), new: cmp((a, b) => b.at - a.at) };
    for (const [sort, by] of Object.entries(gModel)) assert.deepEqual(ids((await all('goods', sort === 'cheap' ? {} : { sort })).rows), ids([...GOODS].sort(by)), `goods ${sort}`);
    assert.deepEqual([(await read('goods', { family: 'jewellery' })).total, (await read('goods', { family: 'weapons', page: 1 })).rows.length], [5, 15]);
    const standing = (a) => a.high ?? a.opening;
    const aModel = {
      ending: cmp((a, b) => a.endsAt - b.endsAt, (a, b) => a.at - b.at),
      cheap: cmp((a, b) => standing(a) - standing(b), (a, b) => a.endsAt - b.endsAt),
      dear: cmp((a, b) => standing(b) - standing(a), (a, b) => a.endsAt - b.endsAt),
      new: cmp((a, b) => b.at - a.at),
    };
    const aFirsts = Object.keys(aModel).map((sort) => [...AUCTIONS].sort(aModel[sort])[0].id);
    assert.equal(new Set(aFirsts).size, 4, 'each auction order a different first row');
    assert.notEqual([...AUCTIONS].sort(aModel.cheap)[0].id, [...AUCTIONS].sort(cmp((a, b) => a.opening - b.opening))[0].id, 'a standing bid moves the cheapest');
    for (const [sort, by] of Object.entries(aModel)) assert.deepEqual(ids((await all('auctions', sort === 'ending' ? {} : { sort })).rows), ids([...AUCTIONS].sort(by)), `auctions ${sort}`);
    const daggers = await read('auctions', { recipes: ['dagger:mithril'] });
    assert.deepEqual([daggers.total, ids(daggers.rows)], [10, ids(AUCTIONS.filter((a) => a.recipe === 'dagger:mithril').sort(aModel.ending))]);
    assert.equal((await read('auctions', { recipes: ['dagger:mithril'], family: 'armour' })).total, 0, 'the search within its family');
    const oModel = cmp((a, b) => b.price - a.price, (a, b) => a.at - b.at);
    const orders = await all('orders');
    assert.deepEqual([orders.total, ids(orders.rows)], [N_ORDERS, ids([...ORDERS].sort(oModel))], 'dearest first, a page at a time');
    const wood = await read('orders', { family: material('log:oak').family });
    assert.deepEqual([wood.total, ids(wood.orders)], [ORDERS.filter((o) => o.material === 'log:oak').length, ids(ORDERS.filter((o) => o.material === 'log:oak').sort(oModel))], 'a family\'s count its own');
    const mats = await read('materials', { page: 3 });
    assert.deepEqual(['page' in mats, 'total' in mats], [false, false], 'Materials is not paged');
  } finally { done(); }
});

test('BOARD-SIFT the book: a page, an order, a search\'s recipes and a least quality each its own minute\'s read - page 1 never answered from page 0\'s, a search that named none never the unsearched view\'s (mutants: the key without them; the empty search keyed as none)', async () => {
  const asked = [];
  const door = { read: async (req) => { asked.push(req); return { ok: true, status: 200, data: { ok: true, rows: [], page: req.page ?? 0 } }; } };
  const book = createMarketBook({ door, character: () => 'c1', now: () => 1000 });
  const base = { region: 17, hubs: {} };
  for (const q of [{}, { page: 1 }, { sort: 'dear' }, { recipes: ['dagger:iron'] }, { recipes: [] }, { quality: 2 }]) await book.read('crafted', { ...base, ...q });
  assert.equal(asked.length, 6, 'six reads, six asks');
  await book.read('crafted', { ...base, page: 1 });
  await book.read('crafted', { ...base, recipes: [] });
  assert.equal(asked.length, 6, 'the same again: the minute\'s');
  assert.equal(book.cached('crafted', { ...base, page: 1 })?.page, 1);
});
