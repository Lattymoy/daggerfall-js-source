// AUDIT 30 (2026-09-29, Mac: "Do it") - THE MARKET'S AND THE SMITH'S SERVICE, AS THE AUDIT FOUND IT, through the real
// Worker over node:sqlite (test/accountDb.mjs): every ledger line under its own id (the stock's, a fill's tax), a spent id
// refused (a pruned row's id reused), the tax on a listing's running total, a piece listed only when it is the seller's
// to hand over (no delivery waiting, not standing in a home, a crafted family's), a settle past the rows that cannot
// settle, the kind's own fields, the unyielded and the unbounded refused; the read by the search's materials, the
// Stores it moved, the Marks each trade moved; the mark signed. Each pin failed on the code before its fix.
// bible/06-Systems/Online-Arc.md AUDIT 30.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { MARKET_LISTING_S, MARKET_KEEP_DAYS, saleTax, courierFee, roadPixels, courierSeconds } from '../src/net/marketLaw.js';
import { MARKS_MAX } from '../src/net/marksLaw.js';
import { xpForRank } from '../src/net/professionLaw.js';
import { readProductRecord } from '../src/net/productRecord.js';
import { readFileSync } from 'node:fs';
import { runCron, CRON_HOUR } from '../server-account/src/cron.js';   // SCALE4b: the History's prune is the service's clock's

const DAY = 86_400;
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = (p = 'a30') => `${p}-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', MODERATOR_HANDLES: 'Asynian', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m, character = who.character) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin')
    .all(who.id, character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty, character = who.character) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, character, m, origin, qty);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const line = (actor, r) => raw.prepare('SELECT kind, src_kind, dst_kind, amount FROM marks_ledger WHERE actor = ? AND rid = ?').get(actor, r);
  const burnt = (kind) => Number(raw.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE kind = ?').get(kind).s);
  const piece = (who, provenance, recipe = 'longsword:mithril', { template = 120, material = 5, quality = 2 } = {}) => raw.prepare(`INSERT INTO products
    (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at) VALUES (?, ?, ?, 'Silverthorn', ?, ?, ?, ?, 4242, 'p1.x', ?)`)
    .run(provenance, who.id, who.character, recipe, template, material, quality, _now);
  const owner = (p) => raw.prepare('SELECT owner, listed FROM products WHERE provenance = ?').get(p);
  const read = (who, view, extra = {}) => s.call('/v1/market/read', { character: who.character, region: DF, view, hubs: HUBS, ...extra }, who.secret);
  /** The order escrow the rows hold, against the ledger's escrow end (in less out) - one number, however the Marks moved. */
  const escrowRows = () => Number(raw.prepare('SELECT COALESCE(SUM(escrow), 0) AS s FROM market_orders').get().s);
  const escrowLedger = () => {
    const r = raw.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount END), 0) AS i, COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount END), 0) AS o
      FROM marks_ledger`).get();
    return Number(r.i) - Number(r.o);
  };
  return { ...s, raw, stores, give, balance, fund, line, burnt, piece, owner, read, escrowRows, escrowLedger };
}
const list = (who, extra = {}) => ({ character: who.character, region: DF, kind: 'material', material: 'ore:mithril', units: 10, price: 5, hubs: HUBS, rid: rid(), ...extra });

// ─── THE LEDGER'S LINES (S1-S4) ──────────────────────────────────────

test('AUDIT 30 S1: the smith\'s stock bought under an id the ledger already holds (a Bank exchange\'s) is charged - its line its own, `<rid>:stock`', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 1000);
  const R = rid('coll');
  assert.equal((await s.call('/v1/marks/exchange', { marks: 1, rid: R }, mac.secret)).status, 200);
  assert.equal(s.balance(mac), 999);
  const st = await s.call('/v1/prof/stock', { character: mac.character, material: 'leather:cured', qty: 100, rid: R }, mac.secret);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.deepEqual([st.body.marks, s.balance(mac), s.stores(mac, 'leather:cured')], [400, 599, [['bought', 100]]], 'the goods were free: the line dropped as the exchange\'s duplicate');
  assert.deepEqual({ ...s.line(mac.id, `${R}:stock`) }, { kind: 'stock', src_kind: 'account', dst_kind: 'burn', amount: 400 });
});

test('AUDIT 30 S2: a fill and a buy under one id each keep their tax - the fill\'s `<rid>:filltax`, the buy\'s `<rid>:tax`; the escrow rows and the ledger agree', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 100_000); s.fund(ann, 100_000);
  s.give(mac, 'ore:mithril', 'own', 100); s.give(ann, 'metal:iron', 'own', 100);
  const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'metal:iron', units: 50, price: 100, hubs: HUBS, rid: rid() }, mac.secret);
  const R = rid('both');
  const f = await s.call('/v1/market/fill', { character: ann.character, region: DF, order: o.body.order.id, units: 10, hubs: HUBS, rid: R }, ann.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  const l = await s.call('/v1/market/list', list(mac, { units: 50, price: 900 }), mac.secret);
  const macBefore = s.balance(mac);
  const b = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, units: 50, max: 100_000, hubs: HUBS, rid: R }, ann.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.repeat, undefined, 'a buy, not the fill answered again');
  assert.equal(s.balance(mac) - macBefore, 45_000 - saleTax(45_000), 'the seller paid the price less its tax');
  assert.deepEqual([s.line(ann.id, `${R}:filltax`)?.amount, s.line(ann.id, `${R}:tax`)?.amount].map(Number), [saleTax(1000), saleTax(45_000)]);
  assert.equal(s.burnt('market-tax'), saleTax(1000) + saleTax(45_000), 'both taxes burnt');
  assert.equal(s.escrowRows(), s.escrowLedger(), 'the escrow the rows hold is the ledger\'s');
});

test('AUDIT 30 S3: an id whose row the market\'s prune took (SCALE4b: the hour\'s, pruneMarketHistory) is spent - an order, a buy, a listing asked under it again are refused, never an escrow held unpaid or goods moved unpaid', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 10_000); s.fund(ann, 100_000);
  s.give(mac, 'ore:mithril', 'own', 1000);
  const RO = rid('ord'), RB = rid('buy'), RL = rid('lst');
  const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ore:mithril', units: 100, price: 10, hubs: HUBS, rid: RO }, mac.secret);
  assert.equal(o.status, 200);
  await s.call('/v1/market/unorder', { order: o.body.order.id, rid: rid('un') }, mac.secret);
  const l = await s.call('/v1/market/list', list(mac, { units: 100, price: 50, rid: RL }), mac.secret);
  assert.equal((await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, units: 100, max: 5000, hubs: HUBS, rid: RB }, ann.secret)).status, 200);
  clock(_now + (MARKET_KEEP_DAYS + 1) * DAY);
  await runCron(s.env, { cron: CRON_HOUR, nowS: _now });   // the prune - PIN MOVED (SCALE4b): the service's clock's each hour, no longer the History view's read
  assert.equal(Number(s.raw.prepare('SELECT COUNT(*) AS n FROM market_orders').get().n), 0, 'the rows are gone, the ledger\'s lines are not');
  s.fund(mac, 1_000_000);
  const o2 = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ore:mithril', units: 1000, price: 1000, hubs: HUBS, rid: RO }, mac.secret);
  assert.deepEqual([o2.body.error, s.balance(mac), s.escrowRows()], ['prof-rid', 1_000_000, 0], 'the escrow held with no Marks moved - withdrawn, a mint');
  s.give(mac, 'ore:mithril', 'own', 1000);
  const l3 = await s.call('/v1/market/list', list(mac, { units: 100, price: 900 }), mac.secret);
  const [a0, m0] = [s.balance(ann), s.balance(mac)];
  const b3 = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l3.body.listing.id, units: 100, max: 100_000, hubs: HUBS, rid: RB }, ann.secret);
  assert.deepEqual([b3.body.error, s.balance(ann), s.balance(mac)], ['prof-rid', a0, m0], 'the goods moved, the buyer charged nothing, the seller unpaid');
  const f0 = s.balance(mac);
  const l4 = await s.call('/v1/market/list', list(mac, { units: 100, price: 1000, rid: RL }), mac.secret);
  assert.deepEqual([l4.body.error, s.balance(mac)], ['prof-rid', f0], 'a listing free of its fee');
});

test('AUDIT 30 S4: no ledger line of the market\'s or the stock\'s is an OR IGNORE - a line that breaks the balance\'s CHECK fails its act, never lands unpaid', () => {
  const m = src('server-account/src/market.js');
  assert.equal((m.match(/INSERT OR IGNORE INTO marks_ledger/g) ?? []).length, 0);
  const p = src('server-account/src/professions.js');
  assert.equal((p.match(/INSERT OR IGNORE INTO marks_ledger/g) ?? []).length, 1, 'the writ\'s pay alone (its id a writ\'s, filled once by its nonce)');
  assert.match(p, /SELECT 'account', \?1, 'burn', NULL, 'stock', marks, \?2, at, \?1, material, rid \|\| ':stock' FROM prof_stock WHERE player = \?1 AND rid = \?3 AND n = \?4/);
  assert.match(p, /SELECT 'account', \?1, 'burn', NULL, 'respec', \?4, \?5, \?6, \?1, \?8, \?7\n\s*WHERE COALESCE\(\(SELECT balance FROM marks WHERE account = \?1\), 0\) >= \?4\n\s*AND NOT EXISTS \(SELECT 1 FROM marks_ledger WHERE actor = \?1 AND rid = \?7\)/);
});

// ─── THE TAX (L6) ────────────────────────────────────────────────────

test('AUDIT 30 L6: the tax is taken on a listing\'s running total - two buys of ten Marks pay what one of twenty does', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 1000); s.fund(ann, 1000);
  s.give(mac, 'ore:mithril', 'own', 10);
  const l = await s.call('/v1/market/list', list(mac, { units: 10, price: 2 }), mac.secret);
  const m0 = s.balance(mac);
  for (let i = 0; i < 2; i++) assert.equal((await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, units: 5, max: 10, hubs: HUBS, rid: rid() }, ann.secret)).status, 200);
  assert.deepEqual([saleTax(10), saleTax(20)], [0, 1]);
  assert.deepEqual([s.balance(mac) - m0, s.burnt('market-tax')], [19, 1], 'split in two, the tax was nothing');
});

// ─── A PIECE THE SELLER'S TO HAND OVER (S5, S6, L2) ──────────────────

test('AUDIT 30 S5: a piece whose delivery waits is not listed; a delivery is collected only by the piece\'s owner - one id is never handed out twice', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann'), bob = await s.registered('Bob');
  for (const w of [mac, ann, bob]) s.fund(w, 100_000);
  const P = '0123456789abcdef';
  s.piece(mac, P);
  const l = await s.call('/v1/market/list', { character: mac.character, region: WR, kind: 'piece', provenance: P, wear: 900, price: 1000, hubs: HUBS, rid: rid() }, mac.secret);
  const b = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, max: 100_000, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const l2 = await s.call('/v1/market/list', { character: ann.character, region: DF, kind: 'piece', provenance: P, wear: 1000, price: 5000, hubs: HUBS, rid: rid() }, ann.secret);
  assert.equal(l2.body.error, 'market-uncollected', 'listed while it was still on the road');
  // the owner moved another way (a moderator's hand, an old row): the delivery is not the collector's to take
  s.raw.prepare('UPDATE products SET owner = ? WHERE provenance = ?').run(bob.id, P);
  clock(_now + courierSeconds(ROAD));
  const c = await s.call('/v1/market/collect', { character: ann.character, delivery: b.body.delivery.id, rid: rid() }, ann.secret);
  assert.equal(c.body.error, 'market-gone');
});

test('AUDIT 30 S6 + S8/L2: a piece standing in a home is not listed, and stands marked once; arrows are no listable piece', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 10_000);
  const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
  const house = await s.seatHome(mac, { ...HOME, region: DF, price: 42000 });   // MERGE 2: a house is a realm character's (AUDIT REALM2 S2)
  assert.equal(house.status, 200);
  s.raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'building', ?, NULL, 'master-joiner', 1)`)
    .run(mac.id, mac.character, xpForRank(100));   // PIN MOVED (CRAFT3): a table is Carpentry's, read from the Building track (a 'carpentry' row is read by nothing)
  s.give(mac, 'plank:oak', 'own', 3);
  const made = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'table-small:oak', clean: false, name: 'Silverthorn', rid: rid() }, mac.secret);
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const pv = made.body.pieces[0].provenance;
  const at = (item, id) => ({ id, model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, item });
  const marks = [];
  for (const id of ['tb1', 'tb2', 'tb3']) marks.push((await s.call('/v1/homes/decor/place', { ...HOME, character: house.character, piece: at({ t: 225, g: 8, pv }, id) }, mac.secret)).body.piece?.item?.pv ?? null);
  assert.deepEqual(marks, [pv, null, null], 'one piece set down marked three times');
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: pv, wear: 1000, price: 100, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.body.error, 'market-standing', 'sold while it stood in the seller\'s home');
  s.give(mac, 'plank:pine', 'own', 1); s.give(mac, 'ingot:iron', 'own', 1); s.give(mac, 'p1:8', 'own', 4);
  const c = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'arrows:north', clean: false, name: 'Silverthorn', rid: rid() }, mac.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const a = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: c.body.pieces[0].provenance, wear: 1000, price: 500, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(a.body.error, 'market-not-listable', 'twenty arrows kept by the seller and minted again for the buyer');
});

// ─── THE SETTLE, THE KIND'S FIELDS, THE BOUNDS (S7, S9, L7, L8) ──────

test('AUDIT 30 S7: a settle reaches past the rows that cannot settle - twenty returns waiting on a full Stores hold back no other material\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 10_000);
  s.give(mac, 'ore:mithril', 'own', 100);
  s.give(mac, 'metal:iron', 'own', 10);
  for (let i = 0; i < 20; i++) {
    assert.equal((await s.call('/v1/market/list', list(mac, { units: 1, price: 5 }), mac.secret)).status, 200);
    clock(_now + 1);
  }
  const iron = await s.call('/v1/market/list', list(mac, { material: 'metal:iron', units: 10, price: 5 }), mac.secret);
  assert.equal(iron.status, 200);
  clock(_now + MARKET_LISTING_S);
  s.give(mac, 'ore:mithril', 'own', 5000);   // the mithril's Stores full meanwhile
  const r = await s.read(mac, 'mine');
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['own', 10]], 'the iron came home');
  // AUDIT 30 U1: and the read says so - the Stores it moved, for the professions' book
  assert.deepEqual(r.body.stores, [{ material: 'metal:iron', own: 10, bought: 0 }]);
});

test('AUDIT 30 S9 + L7 + L8: a listing binds only its kind\'s fields; an order for a material nothing yields is refused; a listing worth more than any balance is a bad price', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, MARKS_MAX);
  s.give(mac, 'ore:mithril', 'own', 100);
  const w = await s.call('/v1/market/list', list(mac, { wear: 500 }), mac.secret);
  assert.equal(w.status, 200, `a stray wear refused as if the Stores were short: ${JSON.stringify(w.body)}`);
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['own', 90]]);
  s.piece(mac, '0123456789abcdef');
  const p = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: '0123456789abcdef', wear: 900, price: 5, material: 'ore:mithril', hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  for (const m of ['ingot:daedric']) {   // PROF7 moved it: the Bear Hide is Hunting's now; PIN MOVED (AUDIT-SEATS): the sieges' Spoils yield the Warforged ingot and the silk
    const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: m, units: 1, price: 10, hubs: HUBS, rid: rid() }, mac.secret);
    assert.equal(o.body.error, 'market-unyielded', `${m}: an escrow held a week for goods nobody can bring`);
  }
  for (const m of ['ingot:warforged', 'cloth:standard', 'gem:siege']) {   // AUDIT-SEATS: a siege's Spoils - an order for one is an order someone can fill
    const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: m, units: 1, price: 10, hubs: HUBS, rid: rid() }, mac.secret);
    assert.equal(o.status, 200, `${m}: ${JSON.stringify(o.body)}`);
  }
  const big = await s.call('/v1/market/list', list(mac, { units: 20, price: 1_000_000 }), mac.secret);
  assert.equal(big.body.error, 'bad-price', 'a worth past MARKS_MAX, its fee within it');
});

// ─── THE READ (U2, U15) ──────────────────────────────────────────────

test('AUDIT 30 U2: the materials read by the search\'s own materials - a rarity listed behind a hundred cheaper listings is found', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 10_000);
  s.give(mac, 'ore:mithril', 'own', 10);
  assert.equal((await s.call('/v1/market/list', list(mac, { units: 10, price: 900 }), mac.secret)).status, 200);
  const ins = s.raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n)
    VALUES (?, ?, ?, ?, 'material', 'metal:iron', 1, 1, 1, 1, ?, ?, ?, ?)`);
  for (let i = 0; i < 120; i++) ins.run(`fill${String(i).padStart(12, '0')}`, ann.id, ann.character, DF, _now, _now + MARKET_LISTING_S, `f${i}`, `n${i}`);
  const all = await s.read(ann, 'materials');
  assert.equal(all.body.rows.some((r) => r.material === 'ore:mithril'), false, 'the hundred cheapest of everything');
  const found = await s.read(ann, 'materials', { materials: ['ore:mithril'] });
  assert.deepEqual(found.body.rows.map((r) => [r.material, r.price]), [['ore:mithril', 900]]);
  const fam = await s.read(ann, 'materials', { family: 'metals', tier: 5 });
  assert.equal(fam.body.rows.some((r) => r.material === 'ore:mithril'), true, 'a family and a tier are read in the query too');
});

test('AUDIT 30 U15: "Your trades" says the Marks each trade moved - the buyer the price and the courier, the seller the price less the tax', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  s.fund(mac, 10_000); s.fund(ann, 10_000);
  s.give(mac, 'ore:mithril', 'own', 40);
  const l = await s.call('/v1/market/list', list(mac, { region: WR, units: 40, price: 100 }), mac.secret);
  assert.equal((await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.body.listing.id, units: 40, max: 100_000, hubs: HUBS, rid: rid() }, ann.secret)).status, 200);
  const bought = (await s.read(ann, 'history')).body.trades.find((t) => t.side === 'bought');
  const sold = (await s.read(mac, 'history')).body.trades.find((t) => t.side === 'sold');
  assert.deepEqual([bought.total, sold.total], [4000 + courierFee(40, ROAD), 4000 - saleTax(4000)]);
});

// ─── THE MARK SIGNED (L4) ────────────────────────────────────────────

test('AUDIT 30 L4: a marked piece\'s record signs its mark (`a`), an unmarked one\'s carries none - the name is the service\'s word, not the client\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac'), ann = await s.registered('Ann');
  // a Master Joiner's table bears the mark at any quality; a crafter at the table's own rank (margin 0) never rolls a
  // Masterwork (qualityOdds(0)), whose mark is its own - so hers bears none
  for (const [w, rank, spec] of [[mac, 100, 'master-joiner'], [ann, 10, null]]) {
    s.raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'building', ?, NULL, ?, 1)`)
      .run(w.id, w.character, xpForRank(rank), spec);   // PIN MOVED (CRAFT3): a table is Carpentry's, read from the Building track (a 'carpentry' row is read by nothing)
    s.give(w, 'plank:oak', 'own', 3);
  }
  const claims = async (w) => {
    const r = await s.call('/v1/prof/craft', { character: w.character, recipe: 'table-small:oak', clean: false, name: 'Silverthorn', rid: rid() }, w.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const rec = s.raw.prepare('SELECT record FROM products WHERE provenance = ?').get(r.body.pieces[0].provenance).record;
    return readProductRecord(rec);
  };
  const marked = await claims(mac), plain = await claims(ann);
  assert.equal(marked?.a, 1, 'a Master Joiner\'s table');
  assert.equal(plain?.a, undefined);
});
