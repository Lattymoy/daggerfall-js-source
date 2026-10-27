// WOVEN-PAYS (FIELD BUGS 2026-10-26b; fogs, #feature-feedback, "First time XP bonus from the Loom still isn't working":
// "We now have the ability to weave our own linen bolts (finally!) but I'm still not receiving the first time XP bonus";
// the owner, asked: "Woven cloth pays"). REPRODUCED on main before the fix, through the real book and the real Worker:
// Root Tendrils the service never counted (looted, or bought at a shop for gold) wove into LOOSE Linen, which the loom
// carried out to the bag; the Straps' box (it read the Stores and the carried count, which held none of it) said "and
// 511 more ... from cloth you wove or spun yourself", and the craft put a bolt back in loose and paid +20, "Your first,
// but only cloth you wove or spun yourself earns the first-time bonus".
// AUDIT WOVEN-PAYS: the wall is SILVER, AND COUNTED. A unit's origin could not hold it - a Weavers' bolt set down and
// picked up again went in loose and paid (A1, B3), the loom's own cloth of silver-bought goods came out bought and was
// walled (A2, B1, C1), a guildmate's cloth out of the guild Stores too (B2). So the service counts the bolts of Linen and
// Wool a character buys with silver (the Weavers' and the furnisher's counters, the Drakes market) and takes off every
// bolt its stations use: while the count stands, a piece made wholly of cloth lays no first on (`prof_silver_cloth`,
// migration 0177; server-account/src/professions.js craftAtAnvil `pays`); the box reads the count (net/profBook.js
// silver, ui/professions/profPages.js silverOf); and a pattern is made by the craft that laid its first on (`first_paid`).
// bible/01-Overview/bugs/Field-Bugs-2026-10-26b.md.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../../src/systems/professions/profTemplates.js';
import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { BAG_TEMPLATE } from '../../src/net/bagLaw.js';
import { RECIPES, counterMade, craftXp, recipeById, firstCraftXp, JUDGED_CLOTH, FIRST_MAKE_FLOOR, FIRST_MAKE_SHARE } from '../../src/net/recipeLaw.js';
import { FIRM_NODES } from '../../src/net/firmament/firmamentTree.js';
import { scaleXp } from '../../src/net/firmament/firmamentLaw.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../../src/systems/materialsBag.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { silverOf } from '../../src/ui/professions/profPages.js';
import { craftXpLine, craftXpText } from '../../src/ui/craftXpWords.js';
import { utcDay, MARK_WORTH_GOLD } from '../../src/net/marksLaw.js';
import { courierFee } from '../../src/net/marketLaw.js';
import { craftLimit } from '../../src/net/professionLaw.js';

let _now = utcDay(T0) * 86_400 + 12 * 3600;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `woven-${String(++_rid).padStart(6, '0')}`;
const SHARE = firstCraftXp(recipeById('garment-141:linen'), true);
const DAY = 86_400;

/** A seated character on the real Worker, a bag in its pack, and the real book carrying for it - its hands the game's
 *  own shape (scenes/world.js carryHands: `held` the service's units, `heldAll` a counter's pieces too; AUDIT WOVEN-PAYS B5). */
async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  mac.character = (await seatRealm(s.env, mac.secret, 'Mac', { name: 'Mac', level: 5, items: [], goldPieces: 0 })).id;
  const rows = (table, m) => raw.prepare(`SELECT origin, qty FROM ${table} WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin`)
    .all(mac.id, mac.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, origin, qty);
  const silver = (m) => Number(raw.prepare('SELECT qty FROM prof_silver_cloth WHERE player = ? AND char_id = ? AND material = ?').get(mac.id, mac.character, m)?.qty ?? 0);
  const xpOf = () => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(mac.id, mac.character, 'outfitting')?.xp ?? 0);
  raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 1000)').run(mac.id);
  const e = { stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 };
  const hands = {
    held: (k) => heldOf(e, k, { counter: false }), heldAll: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
    take: (k, n, id, order, counter = false) => takeCarried(e, k, n, id, order, { counter }), give: (k, n) => giveCarried(e, k, n),
    stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
    stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
  };
  /** The bolts of a material out of the bag and the pack - set down in a home's chest, on the ground - and back. */
  const stash = (k) => {
    const out = [];
    for (const list of [e.items, e.bagItems]) for (let i = list.length - 1; i >= 0; i--) if (heldOf({ items: [list[i]] }, k) > 0) out.push(...list.splice(i, 1));
    return () => { e.items.push(...out); };
  };
  const mem = new Map();
  const book = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    character: () => mac.character, now: () => _now * 1000, sleep: () => Promise.resolve(), carry: hands });
  const craft = async (id) => {
    const r = await book.craft(id, { clean: false, name: 'Mac' }, () => {});
    assert.equal(r.ok, true, JSON.stringify(r));
    return r.data;
  };
  const buy = async (m, qty) => assert.equal((await book.stock(m, qty)).ok, true);
  const ask = (id, at) => s.call('/v1/prof/craft', { character: mac.character, recipe: id, clean: false, name: 'Mac', rid: at }, mac.secret);
  return { s, raw, mac, e, book, rows, give, silver, xpOf, craft, buy, stash, ask };
}

// ─── THE LAW ─────────────────────────────────────────────────────────

test('AUDIT WOVEN-PAYS law: the cloth S1 counts when it is bought with silver is every key its 152 judged recipes are made of - Linen and Wool, single-input each (mutants: the count read of another key)', () => {
  const judged = RECIPES.filter(counterMade);
  assert.equal(judged.length, 152);
  assert.deepEqual(JUDGED_CLOTH, ['cloth:linen', 'cloth:wool']);
  assert.ok(judged.every((r) => r.inputs.length === 1 && JUDGED_CLOTH.includes(r.inputs[0].key)));
});

test('WOVEN-PAYS law: an old row\'s XP says whether it paid its first - every judged recipe\'s own XP, at any rank and the Firmament\'s every star, stays under the least share (FIRST_MAKE_FLOOR), and every share is at least it (mutants: the floor moved)', () => {
  const judged = RECIPES.filter(counterMade);
  let pct = 0;
  for (const n of FIRM_NODES.values()) pct += Number(n.stats?.['xp.outfitting'] ?? 0);
  const most = Math.max(...judged.flatMap((r) => Array.from({ length: 101 }, (_, rank) => scaleXp(craftXp(r.tier, rank), pct))));
  assert.ok(most < FIRST_MAKE_FLOOR, `a judged craft's own XP at most ${most}`);
  assert.ok(Object.values(FIRST_MAKE_SHARE).every((x) => x >= FIRST_MAKE_FLOOR));
  assert.equal(FIRST_MAKE_FLOOR, 500);
});

test('AUDIT WOVEN-PAYS the loom\'s line under the crafter\'s limit: room between a cloth piece\'s own XP and its first\'s share says "At most" while no silver count stands, and the plain line with the count while one does - the limit read against what the craft would lay on (mutants: the cloth\'s most without its share; the share said beside a count)', () => {
  const r = recipeById('garment-141:linen'), xp = craftXp(r.tier, 50), ranks = { building: 60, provisioning: 60, outfitting: 50 };
  const pay = { limit: craftLimit('outfitting', ranks, craftLimit('outfitting', ranks, 0).cap - (xp + 5)) };
  assert.equal(pay.limit.room, xp + 5);
  assert.equal(craftXpLine(r, 50, 'Outfitting', pay, 0), `At most ${xp + 5} Outfitting experience: Building and Provisioning are past Journeyman, so the crafter's limit holds Outfitting at rank 50.`);
  assert.equal(craftXpLine(r, 50, 'Outfitting', pay, 3), `${xp} Outfitting experience. Bolts of this cloth bought with silver and not yet used: 3. Until you have used that many, no piece of it earns a first-time bonus.`);
});

// ─── THE REPORT ──────────────────────────────────────────────────────

test('WOVEN-PAYS the report: Root Tendrils the service never counted weave into loose Linen, carried out to the bag; no silver count stands, so the Straps\' box says the share, and the craft - a bolt put back in loose - lays it on and says so (mutants: the count unread, or loose cloth walled again)', async () => {
  const { book, e, rows, silver, xpOf, craft } = await stand();
  mintCarried(e, 'p1:12', 6);   // looted, or bought at a shop for gold: in the pack, never counted
  assert.equal((await book.refresh()).ok, true);
  const w = await book.smelt('weave:linen-north', 3);
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.deepEqual([w.data.own, w.data.bought, w.data.loose, w.data.put.bag], [0, 0, 3, 3], 'loose bolts, into the bag');
  assert.deepEqual([rows('prof_stores', 'cloth:linen'), rows('prof_carried', 'cloth:linen'), heldOf(e, 'cloth:linen'), silver('cloth:linen')], [[], [], 3, 0], 'carried, uncounted');
  const straps = recipeById('garment-141:linen');
  assert.equal(silverOf(book, straps), 0);
  assert.equal(craftXpLine(straps, 0, 'Outfitting', {}, silverOf(book, straps)), `20 Outfitting experience, and ${SHARE} more the first time you make this piece at this grade from cloth not bought with silver.`);
  const made = await craft('garment-141:linen');
  assert.deepEqual([made.xp, made.first, made.firstPaid, xpOf()], [20 + SHARE, true, true, 20 + SHARE]);
  assert.equal(craftXpText(straps, made, 'Outfitting'), `(+${20 + SHARE} Outfitting experience, with the first-time bonus)`);
});

// ─── THE SILVER COUNT ────────────────────────────────────────────────

test('AUDIT WOVEN-PAYS A1, B3: a Weavers\' bolt bought with silver, withdrawn, set down while the count is cut, and picked up again goes in loose - and still counts: the box says the count, the craft lays no first on, and the count is spent (mutants: the count unread; a purchase uncounted; a use not taken off)', async () => {
  const { book, e, rows, give, silver, buy, stash, craft } = await stand();
  const mint = (/** @type {string} */ k, /** @type {number} */ q) => { mintCarried(e, k, q); };
  give('cloth:linen', 'own', 1);
  assert.equal((await book.refresh()).ok, true);
  await buy('cloth:linen', 1);
  assert.deepEqual([silver('cloth:linen'), book.silver('cloth:linen')], [1, 1], 'counted, and the book heard it');
  assert.equal((await book.withdraw('cloth:linen', 1, mint)).ok, true);
  assert.deepEqual(rows('prof_carried', 'cloth:linen'), [['bought', 1]], 'the Weavers\' bolt carried, counted bought');
  const back = stash('cloth:linen');
  assert.equal((await book.withdraw('cloth:linen', 1, mint)).ok, true);
  assert.deepEqual(rows('prof_carried', 'cloth:linen'), [['own', 1]], 'the count cut to what the pack held: the bought bolt gone from it');
  back();
  const breeches = recipeById('garment-152:linen');
  assert.equal(silverOf(book, breeches), 1);
  assert.equal(craftXpLine(breeches, 0, 'Outfitting', {}, silverOf(book, breeches)), '20 Outfitting experience. Bolts of this cloth bought with silver and not yet used: 1. Until you have used that many, no piece of it earns a first-time bonus.');
  const b = await craft('garment-152:linen');
  assert.deepEqual([b.xp, b.first, b.firstPaid], [20, true, false], 'the pack\'s Weavers\' bolt, in loose, paid none');
  assert.equal(craftXpText(breeches, b, 'Outfitting'), '(+20 Outfitting experience. Cloth bought with silver earns no first-time bonus, so this piece\'s is still yours to earn)');
  assert.deepEqual([silver('cloth:linen'), book.silver('cloth:linen')], [0, 0], 'used: the count spent, and the book heard it');
});

test('AUDIT WOVEN-PAYS A2, B1, C1: cloth the loom weaves of Root Tendrils bought with silver - by the craft\'s own chain, or woven and carried out first - pays its first, the box saying so before the press; a bought bolt out of the guild Stores is no silver either (B2) (mutants: the Stores\' bought units read as silver)', async () => {
  const { book, rows, give, silver, craft } = await stand();
  give('p1:12', 'bought', 4);   // the Drakes market's (market.js BOUGHT_ORIGIN_SQL)
  assert.equal((await book.refresh()).ok, true);
  const straps = recipeById('garment-141:linen');
  assert.equal(craftXpLine(straps, 0, 'Outfitting', {}, silverOf(book, straps)), `20 Outfitting experience, and ${SHARE} more the first time you make this piece at this grade from cloth not bought with silver.`);
  const chained = await book.craft('garment-141:linen', { clean: false, name: 'Mac' }, () => {});
  assert.deepEqual([chained.ok, chained.refined?.map((w) => w.id), chained.data?.xp, chained.data?.firstPaid], [true, ['weave:linen-north'], 20 + SHARE, true], 'the chain wove a bought bolt; it paid');
  const w = await book.smelt('weave:linen-north', 1);
  assert.deepEqual([w.data.bought, rows('prof_carried', 'cloth:linen')], [1, [['bought', 1]]], 'woven, bought, carried out');
  const armbands = await craft('garment-142:linen');
  assert.deepEqual([armbands.xp, armbands.firstPaid], [20 + SHARE, true]);
  give('cloth:linen', 'bought', 3);   // a guildmate's cloth out of the guild Stores (writs.js guild withdraw: bought)
  assert.equal((await book.refresh()).ok, true);
  const net = await craft('fishingnet:linen');
  assert.deepEqual([net.xp, net.firstPaid, silver('cloth:linen')], [20 + SHARE, true, 0]);
});

test('AUDIT WOVEN-PAYS the count: a purchase adds its bolts, every bolt a station uses takes one off - a judged craft\'s, a boot\'s, a temper\'s - a row at nought deleted; Wool apart from Linen; the state read and every Stores answer say it (mutants: a use uncounted; the temper\'s; the state\'s)', async () => {
  const { s, raw, mac, book, give, silver, buy, craft } = await stand();
  give('leather:cured', 'own', 2);
  assert.equal((await book.refresh()).ok, true);
  await buy('cloth:linen', 5);
  await buy('cloth:wool', 2);
  await buy('leather:cured', 1);   // the smith's stock: no cloth, never counted
  assert.deepEqual([silver('cloth:linen'), silver('cloth:wool'), silver('leather:cured')], [5, 2, 0]);
  const state = await s.call('/v1/prof/state', { character: mac.character }, mac.secret);
  assert.deepEqual(state.body.silver, { 'cloth:linen': 5, 'cloth:wool': 2 });
  const boots = await craft('garment-149:linen');   // a bolt and a Cured Leather: never judged, its first pays - and its bolt is used
  assert.deepEqual([boots.xp, boots.firstPaid, silver('cloth:linen')], [20 + SHARE, true, 4]);
  const kimono = await craft('garment-143:linen');   // three bolts
  assert.deepEqual([kimono.firstPaid, silver('cloth:linen')], [false, 1]);
  const t = await s.call('/v1/prof/temper', { character: mac.character, recipe: 'garment-141:linen', quality: 1, rid: rid() }, mac.secret);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.deepEqual([silver('cloth:linen'), t.body.stores[0].silver], [0, 0], 'the temper\'s bolt, used');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM prof_silver_cloth WHERE material = 'cloth:linen'").get().n, 0, 'nought: deleted');
  give('cloth:linen', 'own', 1);
  await book.refresh();
  assert.deepEqual([book.silver('cloth:linen'), book.silver('cloth:wool')], [0, 2]);
  assert.equal((await craft('garment-141:linen')).firstPaid, true, 'the Linen free of it, the Wool not');
});

test('AUDIT WOVEN-PAYS the Drakes market: a buy here, a courier\'s load as it lands and a buy order filled each count the cloth bought with silver; a gold buy counts none (mutants: each path uncounted; the gold buy counted)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const DF = 17, WR = 23, HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 9 * DAY, ann.id);
  for (const who of [mac, ann]) raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 5000)').run(who.id);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const silver = (who, m) => Number(raw.prepare('SELECT qty FROM prof_silver_cloth WHERE player = ? AND char_id = ? AND material = ?').get(who.id, who.character, m)?.qty ?? 0);
  give(mac, 'cloth:linen', 'own', 100);
  give(mac, 'cloth:wool', 'own', 100);
  const list = async (material, units, region = DF) => (await s.call('/v1/market/list', { character: mac.character, region, kind: 'material', material, units, price: 2, hubs: HUBS, rid: rid() }, mac.secret)).body.listing;
  // here
  const here = await list('cloth:linen', 10);
  const b = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: here.id, units: 4, max: 100, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(silver(ann, 'cloth:linen'), 4);
  // by courier, from Wayrest: counted as it lands
  const far = await list('cloth:wool', 5, WR);
  const quote = (await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'materials', hubs: HUBS }, ann.secret)).body.rows.find((x) => x.id === far.id)?.road;
  const c = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: far.id, units: 5, max: 10 + (quote?.courier ?? 999), hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(silver(ann, 'cloth:wool'), 0, 'on the road');
  _now += quote.seconds;
  await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'mine', hubs: HUBS }, ann.secret);
  assert.equal(silver(ann, 'cloth:wool'), 5, 'landed');
  // a buy order of Ann's, filled by Mac
  const o = await s.call('/v1/market/order', { character: ann.character, region: DF, material: 'cloth:linen', units: 3, price: 2, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const f = await s.call('/v1/market/fill', { character: mac.character, region: DF, order: o.body.order.id, units: 3, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.equal(silver(ann, 'cloth:linen'), 7);
  assert.equal(silver(mac, 'cloth:linen'), 0, 'the filler sold, and counts nothing');
  // a gold buy - here and by courier - is no silver: its units gold's, counted none
  const seat = async (handle, gold) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: gold });
    Object.assign(who, { character: R.id, at: R.at });
    raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 9 * DAY, who.id);
    return who;
  };
  const eve = await seat('Eve', 0), tom = await seat('Tom', 100_000);
  give(eve, 'cloth:linen', 'own', 20);
  const goldList = async (region) => (await s.call('/v1/market/list', { character: eve.character, region, kind: 'material', material: 'cloth:linen', units: 10, price: 80, hubs: HUBS, rid: rid(), currency: 'gold' }, eve.secret)).body.listing;
  const gbuy = (l, courier = 0) => s.call('/v1/market/buy', { character: tom.character, region: DF, listing: l.id, units: 5, max: 5 * l.price + courier, hubs: HUBS, rid: rid(), realm: tom.at() }, tom.secret);
  const g1 = await gbuy(await goldList(DF));
  assert.equal(g1.status, 200, JSON.stringify(g1.body));
  const gfar = await goldList(WR);
  const groad = (await s.call('/v1/market/read', { character: tom.character, region: DF, view: 'materials', material: 'cloth:linen', currency: 'gold', hubs: HUBS }, tom.secret)).body.rows.find((x) => x.id === gfar.id).road;
  const g2 = await gbuy(gfar, courierFee(5, groad.road) * MARK_WORTH_GOLD);
  assert.equal(g2.status, 200, JSON.stringify(g2.body));
  _now += groad.seconds;
  await s.call('/v1/market/read', { character: tom.character, region: DF, view: 'mine', hubs: HUBS }, tom.secret);
  assert.deepEqual([raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND material = ?').all(tom.id, 'cloth:linen').map((r) => [r.origin, Number(r.qty)]), silver(tom, 'cloth:linen')],
    [[['gold', 10]], 0], 'gold\'s, here and landed, and no silver');
});

// ─── THE PATTERN MADE BY THE CRAFT THAT PAID ─────────────────────────

test('WOVEN-PAYS the pattern: a craft of the Weavers\' cloth lays none on and makes no pattern - the next Straps of the loom\'s cloth pay the first, and the one after none; the decision writes `first_paid` (mutants: any craft makes the pattern; first_paid unwritten)', async () => {
  const { book, raw, mac, give, xpOf, buy, craft } = await stand();
  assert.equal((await book.refresh()).ok, true);
  await buy('cloth:linen', 1);
  const bought = await craft('garment-141:linen');
  assert.deepEqual([bought.xp, bought.first, bought.firstPaid], [20, true, false]);
  give('cloth:linen', 'own', 2);
  assert.equal((await book.refresh()).ok, true);
  const own = await craft('garment-141:linen');
  assert.deepEqual([own.xp, own.first, own.firstPaid], [20 + SHARE, true, true], 'the first was still owed');
  const again = await craft('garment-141:linen');
  assert.deepEqual([again.xp, again.first, again.firstPaid], [20, false, false]);
  assert.equal(xpOf(), 60 + SHARE);
  assert.deepEqual(raw.prepare('SELECT xp, first, first_paid FROM prof_crafts WHERE player = ? ORDER BY at, rowid').all(mac.id).map((r) => [Number(r.xp), Number(r.first), r.first_paid]),
    [[20, 1, 0], [20 + SHARE, 1, 1], [20, 0, 0]]);
});

test('WOVEN-PAYS rows from before the column, as the service before it wrote them: a judged first that laid no share on leaves its pattern owed, one whose XP holds the share made it (the floor itself included), a boot\'s made it; and an old row\'s answer reads as the decision does - AUDIT WOVEN-PAYS A4, C6 (mutants: an old row read as made, or as owed, whatever its XP; the floor\'s edge; the answer\'s old reading gone)', async () => {
  const { book, raw, mac, give, buy, craft, ask } = await stand();
  const old = (recipe, xp) => raw.prepare(`INSERT INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, seed, xp, first, at, n)
    VALUES (?, ?, ?, ?, 1, 1, ?, 1, ?, 1, 1, 'old')`).run(mac.id, rid(), mac.character, recipe, String(_rid).padStart(16, '0'), xp);
  old('garment-142:linen', 20);   // the Armbands, of the Weavers' cloth, under S1 before the column
  old('garment-143:linen', 20 + 500);   // the Kimono, its first laid on (the 500 before FIRST-BUDGET)
  old('garment-146:linen', 500);   // the Eodoric, its share's edge (a share the crafter's limit cut there)
  old('garment-149:linen', 20 + 500);   // the Boots (a bolt and a Cured Leather - never judged)
  give('cloth:linen', 'own', 20);
  give('leather:cured', 'own', 2);
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual([(await craft('garment-142:linen')).firstPaid, (await craft('garment-143:linen')).firstPaid, (await craft('garment-146:linen')).firstPaid, (await craft('garment-149:linen')).firstPaid],
    [true, false, false, false]);
  // an old row's answer, asked again with its own id: as the decision reads it
  const paid = rid(), unpaid = rid();
  assert.equal((await ask('garment-151:linen', paid)).body.firstPaid, true);
  await buy('cloth:linen', 2);
  assert.equal((await ask('garment-152:linen', unpaid)).body.firstPaid, false);
  raw.prepare('UPDATE prof_crafts SET first_paid = NULL WHERE player = ? AND rid IN (?, ?)').run(mac.id, paid, unpaid);
  const [p, u] = [await ask('garment-151:linen', paid), await ask('garment-152:linen', unpaid)];
  assert.deepEqual([p.body.repeat, p.body.firstPaid, u.body.repeat, u.body.firstPaid], [true, true, true, false]);
  // A4: a Weavers' craft of the days between AUDIT 32 S1 (2026-09-30) and AUDIT PROF-541 B7 (2026-10-03), whose piece
  // the service wrote with no `bought_with` - its XP says no share was laid on, as the decision reads it; its piece would
  // have said one was
  await buy('cloth:linen', 1);
  const s1era = rid();
  const era = await ask('garment-141:linen', s1era);
  assert.deepEqual([era.body.xp, era.body.firstPaid], [20, false]);
  raw.prepare('UPDATE prof_crafts SET first_paid = NULL WHERE player = ? AND rid = ?').run(mac.id, s1era);
  raw.prepare('UPDATE products SET bought_with = NULL WHERE provenance = ?').run(era.body.pieces[0].provenance);
  const again = await ask('garment-141:linen', s1era);
  assert.deepEqual([again.body.repeat, again.body.firstPaid], [true, false]);
});
