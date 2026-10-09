// AUDIT BAG-CRAFT (2026-10-09, Mac: "Audit this"; bible/06-Systems/Materials-Bag.md section 15) - THE STATIONS' WALL.
// A1: BAG-CRAFT's `work` put-in moved the units the carried count did not hold into the Stores as BOUGHT - and a `work`
// put-in is no station's act but a request any client may send. Reproduced against the real Worker before the fix: 200
// Mithril Ore no pack had, put in by a bare `work` deposit, listed for Drakes, and withdrawn counted as carried (every
// counted door open to it). Fixed: the Stores' fourth origin, `loose` (migration 0095_loose_origin.sql, bagLaw.js
// LOOSE_ORIGIN) - a station alone spends it (craft, smelt, brew, temper: STATION_ORIGINS, loose first); a writ, the
// guild Stores and the market read own and bought (WRIT_ORIGINS); a withdrawal gives it back to the pack uncounted; a
// station's products of it stay walled (a smelt's loose, a piece walled to gold - MARKET-ANY's pack-piece law).
// GOLD-MARKET's wall turned the other way: test/goldmarket_service.test.js THE WALL at every door is the pattern.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../src/systems/profTemplates.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { xpForRank, STORES_MAX } from '../src/net/professionLaw.js';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { storesRoom } from '../src/net/chainLaw.js';
import { storesSplit, storesRows, storesRoomOf, LOOSE_GOODS_LINE } from '../src/ui/profPages.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../src/systems/materialsBag.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import { BAG_TEMPLATE } from '../src/net/bagLaw.js';
import { sessionStorageOf } from './accountDb.mjs';

let _now = T0;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `loose-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212] };

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const carried = (who, m) => raw.prepare('SELECT origin, qty FROM prof_carried WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const rank = (who, prof, r) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xpForRank(r));
  /** THE PRODUCER: a `work` put-in of `n` units no pack need hold - what a modified client sends, and what an honest one
   *  sends of a looted herb before a craft. */
  const loose = async (who, m, n) => {
    const r = await s.call('/v1/stores/deposit', { character: who.character, material: m, qty: n, held: n, order: 'work', rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.loose, n, 'every unit loose');
    return r.body;
  };
  const ask = (who, path, body) => s.call(path, { character: who.character, rid: rid(), ...body }, who.secret);
  const seated = async (handle) => {
    const who = await s.registered(handle);
    const R = await seatRealm(s.env, who.secret, handle, { name: handle, level: 5, items: [], goldPieces: 0 });
    who.character = R.id;
    who.at = R.at;
    return who;
  };
  return { ...s, raw, stores, carried, give, fund, rank, loose, ask, seated };
}

// ─── THE WALL ────────────────────────────────────────────────────────

test('AUDIT BAG-CRAFT A1 service: THE STATIONS\' WALL at every door - a Court writ, the guild Stores, a guild writ\'s supply, a Drakes and a gold listing and a Drakes order\'s fill take none of the loose units; each refuses and moves nothing, and takes the own ones; a withdrawal gives them back uncounted (mutants: spendable reads loose; a withdrawal counts it; loose never withdrawn)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  // the repro: 200 Mithril Ore no pack held, put in by a bare `work` deposit
  s.fund(mac, 10_000);
  await s.loose(mac, 'ore:mithril', 200);
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['loose', 200]], 'loose - never bought');
  for (const currency of ['marks', 'gold']) {
    const l = await s.ask(mac, '/v1/market/list', { region: DF, kind: 'material', material: 'ore:mithril', units: 100, price: 8, hubs: HUBS, currency });
    assert.notEqual(l.status, 200, `no ${currency} listing: ${JSON.stringify(l.body)}`);
  }
  assert.deepEqual(s.stores(mac, 'ore:mithril'), [['loose', 200]], 'nothing listed');
  // a Court writ
  const day = Math.floor(_now / 86_400);
  s.raw.prepare(`INSERT INTO writs (id, kind, day, region, slot, material, tier, qty, pay, renown, expires_at) VALUES ('writloose1', 'court', ?, ?, 0, 'metal:iron', 1, 3, 10, 1, ?)`)
    .run(day, DF, _now + 3600);
  await s.loose(mac, 'metal:iron', 9);
  const deliver = () => s.ask(mac, '/v1/writs/deliver', { id: 'writloose1' });
  assert.equal((await deliver()).body.error, 'stores-short', 'no Court writ');
  s.give(mac, 'metal:iron', 'own', 3);
  const took = await deliver();
  assert.equal(took.status, 200, JSON.stringify(took.body));
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['loose', 9]], 'the own ones delivered; the loose untouched');
  // a Drakes order's fill
  const ann = await s.registered('Ann');
  s.fund(ann, 100_000);
  const o = await s.ask(ann, '/v1/market/order', { region: DF, material: 'metal:iron', units: 5, price: 10, hubs: HUBS });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const fill = await s.ask(mac, '/v1/market/fill', { region: DF, order: o.body.order.id, units: 5, hubs: HUBS });
  assert.notEqual(fill.status, 200, `no fill: ${JSON.stringify(fill.body)}`);
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['loose', 9]]);
  // a withdrawal to the pack: back as it was, never counted as carried
  const w = await s.ask(mac, '/v1/stores/withdraw', { material: 'metal:iron', qty: 4, carry: true, held: 0 });
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['loose', 5]]);
  assert.deepEqual(s.carried(mac, 'metal:iron'), [], 'uncounted - the count holds only what the service handed out');
  // gold's go first, then loose: a withdrawal's order
  s.give(mac, 'metal:iron', 'gold', 1);
  s.give(mac, 'metal:iron', 'own', 2);
  assert.equal((await s.ask(mac, '/v1/stores/withdraw', { material: 'metal:iron', qty: 3, carry: true, held: 4 })).status, 200);
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['loose', 3], ['own', 2]], 'gold\'s one, then two loose');
  assert.deepEqual(s.carried(mac, 'metal:iron'), [['gold', 1]], 'gold\'s counted, as ever; the loose not');
  // the guild Stores and a guild writ (PROF6)
  const gm = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(gm, 100_000, 'gm');
  const g = (await s.found(gm, { name: 'The Gilded', tag: 'GLD' })).body.guild;
  assert.ok(g?.id);
  await s.loose(gm, 'log:oak', 40);
  assert.equal((await s.ask(gm, '/v1/stores/guild-deposit', { material: 'log:oak', units: 5 })).body.error, 'stores-short', 'no guild Stores');
  assert.equal((await s.ask(gm, '/v1/marks/guild/deposit', { marks: 1000 })).status, 200);
  const post = await s.ask(gm, '/v1/writs/post', { region: DF, material: 'log:oak', units: 10, pay: 3 });
  assert.equal(post.status, 200, JSON.stringify(post.body));
  const eve = await s.registered('Eve');
  await s.loose(eve, 'log:oak', 40);
  const supply = await s.ask(eve, '/v1/writs/supply', { region: DF, writ: post.body.writ.id, units: 5 });
  assert.notEqual(supply.status, 200, `no guild writ: ${JSON.stringify(supply.body)}`);
  assert.deepEqual([s.stores(gm, 'log:oak'), s.stores(eve, 'log:oak')], [[['loose', 40]], [['loose', 40]]]);
});

// ─── THE STATIONS ────────────────────────────────────────────────────

test('AUDIT BAG-CRAFT A1 service: a station spends the loose units first, and what it makes of them stays walled - a smelt\'s products loose, a piece walled to gold (never Drakes), a temper\'s piece walled to gold; a piece of own goods unmarked; the refusal reasons count them (mutants: a station spends bought or own first; a smelt\'s products bought; a piece of loose goods for Drakes; a temper unmarked; workable reads no loose)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.rank(mac, 'smithing', 10);
  // a smelt: 4 loose Iron spent before 2 own; its 2 ingots loose
  s.give(mac, 'metal:iron', 'own', 2);
  await s.loose(mac, 'metal:iron', 4);
  const sm = await s.ask(mac, '/v1/prof/smelt', { recipe: 'ingot:iron', count: 2 });
  assert.equal(sm.status, 200, JSON.stringify(sm.body));
  assert.deepEqual([sm.body.own, sm.body.bought, sm.body.loose], [0, 0, 2]);
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['own', 2]], 'loose first - the own ones stay for writs');
  assert.deepEqual(s.stores(mac, 'ingot:iron'), [['loose', 2]], 'its products as walled as its goods');
  // a craft of them: the Repair Kit walled to gold
  s.give(mac, 'leather:cured', 'own', 3);
  const kit = await s.ask(mac, '/v1/prof/craft', { recipe: 'kit:iron', clean: false, name: 'Mac' });
  assert.equal(kit.status, 200, JSON.stringify(kit.body));
  const pv = kit.body.pieces[0].provenance;
  assert.equal(s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(pv).bought_with, 'gold');
  s.fund(mac, 10_000);
  const drakes = await s.ask(mac, '/v1/market/list', { region: DF, kind: 'piece', provenance: pv, wear: 1000, price: 50, hubs: HUBS, currency: 'marks' });
  assert.deepEqual(drakes.body, { error: 'market-gold-goods' }, 'never for Drakes - a pack\'s piece');
  // the second loose ingot is spent before any own one: walled too
  const kit2 = await s.ask(mac, '/v1/prof/craft', { recipe: 'kit:iron', clean: false, name: 'Mac' });
  assert.equal(s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(kit2.body.pieces[0].provenance).bought_with, 'gold');
  assert.deepEqual(s.stores(mac, 'ingot:iron'), []);
  // a craft of own goods: unmarked, as ever
  s.give(mac, 'ingot:iron', 'own', 1);
  const own = await s.ask(mac, '/v1/prof/craft', { recipe: 'kit:iron', clean: false, name: 'Mac' });
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.equal(s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(own.body.pieces[0].provenance).bought_with, null);
  // a temper of an own Steel Longsword with loose Steel: walled to gold
  s.give(mac, 'ingot:steel', 'own', 3);
  s.give(mac, 'metal:copper', 'own', 1);
  s.give(mac, 'leather:cured', 'own', 1);
  const sword = await s.ask(mac, '/v1/prof/craft', { recipe: 'longsword:steel', clean: false, name: 'Mac' });
  assert.equal(sword.status, 200, JSON.stringify(sword.body));
  const spv = sword.body.pieces[0].provenance;
  const q = Number(s.raw.prepare('SELECT quality FROM products WHERE provenance = ?').get(spv).quality);
  assert.equal(s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(spv).bought_with, null);
  await s.loose(mac, 'ingot:steel', 2);
  const t = await s.ask(mac, '/v1/prof/temper', { recipe: 'longsword:steel', quality: q, provenance: spv });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(spv).bought_with, 'gold', 'raised with goods no Stores had');
  // a Ram Kit of loose planks: loose - a station's, never a camp's writ (it reads own and bought)
  s.rank(mac, 'building', 60);   // CRAFT3: Carpentry is Building's
  s.give(mac, 'ingot:iron', 'own', 20);
  s.give(mac, 'hide:bear', 'own', 4);
  await s.loose(mac, 'plank:oak', 40);
  const ram = await s.ask(mac, '/v1/prof/craft', { recipe: 'ramkit:oak', clean: false, name: 'Mac' });
  assert.equal(ram.status, 200, JSON.stringify(ram.body));
  assert.deepEqual(s.stores(mac, 'work:ram'), [['loose', 1]]);
  // the refusal counts the loose units as a station's
  assert.equal((await s.ask(mac, '/v1/prof/smelt', { recipe: 'ingot:iron', count: 2 })).body.error, 'stores-short', 'two own Iron: one ingot\'s worth');
  await s.loose(mac, 'metal:iron', 2);
  assert.equal((await s.ask(mac, '/v1/prof/smelt', { recipe: 'ingot:iron', count: 2 })).status, 200, 'two loose and two own: two ingots');
  s.give(mac, 'metal:iron', 'gold', 1);
  await s.loose(mac, 'metal:iron', 1);
  assert.equal((await s.ask(mac, '/v1/prof/smelt', { recipe: 'ingot:iron', count: 1 })).body.error, 'stores-gold', 'one loose and one gold\'s: short only of what gold bought');
});

test('AUDIT BAG-CRAFT A1 service: a brew spends the loose herb before the own one, and never reckons it unbruised - the own herb\'s unbruised count stays (mutants: the loose herb reckoned own)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  for (const k of ['reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']) s.give(mac, k, 'own', 1);
  s.give(mac, 'p1:16', 'own', 1);
  s.raw.prepare('INSERT INTO prof_unbruised (player, char_id, material, qty) VALUES (?, ?, ?, 1)').run(mac.id, mac.character, 'p1:16');
  await s.loose(mac, 'p1:16', 1);
  const b = await s.ask(mac, '/v1/prof/brew', { potion: 'healing', keys: ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'] });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.deepEqual(s.stores(mac, 'p1:16'), [['own', 1]], 'the loose herb into the cauldron, the own one kept');
  assert.equal(Number(s.raw.prepare('SELECT qty FROM prof_unbruised WHERE player = ? AND material = ?').get(mac.id, 'p1:16')?.qty ?? 0), 1, 'the own herb still unbruised');
});

// ─── THE PAGE ────────────────────────────────────────────────────────

test('AUDIT BAG-CRAFT A1 client: the Stores page says the loose units - counted in the material\'s total and its room, split "from your pack", the stations\' wall said under it; the book reads them as a station\'s and no writ\'s (mutants: the total without them; the room without them; the split silent; the line undrawn)', async () => {
  assert.equal(storesSplit({ own: 2, bought: 0, loose: 3 }), '2 own · 3 from your pack');
  assert.equal(storesSplit({ own: 5, bought: 0 }), 'own', 'a Store with none says what it always said');
  assert.deepEqual(storesRows(new Map([['metal:iron', { material: 'metal:iron', own: 0, bought: 0, loose: 4 }]])).map((r) => [r.material, r.total]), [['metal:iron', 4]]);
  assert.deepEqual([storesRoom({ own: 1, loose: STORES_MAX - 1 }), storesRoomOf(null, { own: 1, loose: STORES_MAX - 3 })], [0, 2], 'every origin fills the 5,000');
  const s = await stand();
  const mac = await s.registered('Mac');
  const e = { stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 };
  const hands = {
    held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
    take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
    stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
    stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
  };
  const mem = new Map();
  const book = createProfBook({ door: accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    character: () => mac.character, sleep: () => Promise.resolve(), carry: hands });
  mintCarried(e, 'metal:iron', 3);
  assert.equal((await book.refresh()).ok, true);
  assert.deepEqual(await book.ensureInStores([{ key: 'metal:iron', n: 3 }], { work: true }), { ok: true, moved: 3 });
  assert.deepEqual(book.store('metal:iron'), { material: 'metal:iron', own: 0, bought: 0, loose: 3 }, 'the service\'s answer, loose');
  assert.deepEqual([book.storesWorkable('metal:iron'), book.storesHeld('metal:iron')], [3, 0]);
  const { setProfessionsPages, drawStoresPage, resetProfPages } = await import('../src/ui/profPages.js');
  resetProfPages();
  setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, carriedHeld: (k) => heldOf(e, k), room: (k) => roomFor(e, k),
    bag: () => ({ has: true, kg: 0, max: 300, count: e.bagItems.length }) });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (word) => el('h3', null, word), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  try {
    draw();
    const card = [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-mat') && b.textContent.includes('metal:iron'));
    assert.ok(card, 'the loose units\' material has its card');
    card.onclick();
    assert.ok(root.textContent.includes('3 from your pack'), 'its split');
    assert.ok(root.textContent.includes(LOOSE_GOODS_LINE), 'the stations\' wall said');
  } finally { setProfessionsPages(null); resetProfPages(); root?.remove(); }
});

