// BAG-CRAFT (FIELD BUGS 2026-10-09c - "People cannot craft from their bag"; Mac: "I just want players to also be able to
// craft from their inventory, not just the store") - A STATION WORKS WHAT THE BAG AND THE PACK HOLD, counted or not: a
// craft, a brew, a smelt and a temper put their shortfall in from every unit the bag, the pack and the wagon hold but
// gold's (net/bagLaw.js carriedWorkable), by the deposit's `work` order, which the service takes past its carried count
// into the Stores as loose - a station's alone (server-account/src/professions.js depositStores; AUDIT BAG-CRAFT A1,
// test/auditbagcraft.test.js, the stations' wall at every other door). A writ, the market and the Stores page's
// Put in still move only what the service handed out. bible/06-Systems/Materials-Bag.md section 14;
// bible/01-Overview/Field-Bugs-2026-10-09c.md.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/systems/profTemplates.js';
import { standService, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook, mintProfRid } from '../src/net/profBook.js';
import { DEPOSIT_ORDERS, LOOSE_ORIGIN, STATION_ORIGINS, WRIT_ORIGINS, looseOrder, depositOrderOk, carriedWorkable, carriedUsable, BAG_TEMPLATE } from '../src/net/bagLaw.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../src/systems/materialsBag.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import { xpForRank, STORES_MAX } from '../src/net/professionLaw.js';
import { mintPieces } from '../src/systems/smithItems.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** AUDIT BAG-CRAFT C1: a source pin on a line of CODE - its text at a line's start past the indent, so a comment that
 *  quotes it (`// const ready = ...`) never satisfies it. */
const codeHas = (text, line) => text.split('\n').some((l) => l.trimStart().startsWith(line));
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
/** A character of strength 50 with a Materials Bag on its back. */
const body = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 });
/** The host's hands on an entity, as scenes/world.js builds them (no checkpoint: the entity IS the save). */
const hands = (e) => ({
  held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
  take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
  stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
});
/** The raw goods of a Steel Longsword (CRAFT1's done-when): 6 Iron, 3 Pine Logs, 1 Copper, 2 Rat hides. */
const RAW = { 'metal:iron': 6, 'log:pine': 3, 'metal:copper': 1, 'hide:rat': 2 };

/** A registered character's service, door, raw rows, and a book carrying `e` - Smithing at `rank`. */
async function stand({ rank = 10 } = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(rank));
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const rows = (table, m) => Object.fromEntries(raw.prepare(`SELECT origin, qty FROM ${table} WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin`).all(mac.id, mac.character, m).map((r) => [r.origin, Number(r.qty)]));
  const count = (m, origin, qty) => raw.prepare(`INSERT INTO prof_carried (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)`).run(mac.id, mac.character, m, origin, qty);
  return { s, raw, mac, door, stores: (m) => rows('prof_stores', m), carried: (m) => rows('prof_carried', m), count };
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('BAG-CRAFT DONE WHEN: a Steel Longsword from raw goods the service never counted, every one in the Materials Bag and none in the Stores, in one press through the real Worker - the chain\'s works and the craft put each shortfall in from the bag; the bag spent of exactly them; the sword minted; each put in loose, the carried count untouched', async () => {
  const { door, mac, raw, stores, carried } = await stand();
  const e = body();
  for (const [m, n] of Object.entries(RAW)) assert.deepEqual(mintCarried(e, m, n), { bag: n, pack: 0, left: 0 }, `${m} into the bag - looted, traded, withdrawn before the bag: no count`);
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait, carry: hands(e) });
  assert.equal((await book.refresh()).ok, true);
  for (const [m, n] of Object.entries(RAW)) {
    assert.equal(book.held(m), 0, `${m}: a writ's and the market's read - the service's count alone`);
    assert.equal(book.workable(m), n, `${m}: a station's - everything the bag holds`);
  }
  const pack = [];
  const r = await book.craft('longsword:steel', { clean: false, name: 'Mac' }, (data) => pack.push(...mintPieces(data)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.refined.map((w) => [w.id, w.count]), [['ingot:iron', 3], ['burn:pine', 3], ['ingot:steel', 3], ['cure:rat', 1]], 'the chain planned from the bag');
  assert.equal(pack.length, 1, 'the sword');
  for (const m of Object.keys(RAW)) {
    assert.equal(heldOf(e, m), 0, `${m}: out of the bag`);
    assert.deepEqual(stores(m), {}, `${m}: spent`);
    assert.deepEqual(carried(m), {}, `${m}: the count never touched - it held none`);
  }
  const moved = raw.prepare('SELECT material, qty, own, bought, gold, loose FROM prof_deposits WHERE player = ? ORDER BY material').all(mac.id).map((d) => [d.material, Number(d.qty), Number(d.own) + Number(d.bought) + Number(d.gold), Number(d.loose)]);
  assert.deepEqual(moved, [['hide:rat', 2, 0, 2], ['log:pine', 3, 0, 3], ['metal:copper', 1, 0, 1], ['metal:iron', 6, 0, 6]], 'each a deposit of units the count did not hold, put in loose');
});

// ─── THE LAW ─────────────────────────────────────────────────────────

test('BAG-CRAFT law: the `work` order is a station\'s - spend\'s counted order, then units the count does not hold, as loose (AUDIT A1: a station spends own, bought and loose, loose first; a writ own and bought); a station works every unit held but gold\'s, counted or not; a writ\'s and the market\'s read is the count\'s alone (mutants: work not loose; spend loose; the loose origin own; gold\'s worked; the cut skipped)', () => {
  assert.deepEqual(DEPOSIT_ORDERS, { all: ['gold', 'bought', 'own'], spend: ['bought', 'own'], work: ['bought', 'own'] });
  assert.deepEqual(['all', 'spend', 'work', 'loose', null].map(looseOrder), [false, false, true, false, false]);
  assert.deepEqual(['all', 'spend', 'work', 'loose'].map(depositOrderOk), [true, true, true, false]);
  assert.equal(LOOSE_ORIGIN, 'loose', 'AUDIT A1: its own origin - never own (no gatherer\'s word), never bought (a writ\'s, a guild\'s, a sale\'s), never gold\'s');
  assert.deepEqual([STATION_ORIGINS, WRIT_ORIGINS], [['loose', 'bought', 'own'], ['own', 'bought']], 'the stations\' wall: loose first at a station, never at a writ');
  const cases = [
    [{}, 10, 10, 0], [{ own: 2 }, 10, 10, 2], [{ own: 2, bought: 1, gold: 3 }, 10, 7, 3],
    [{ own: 2, bought: 1, gold: 9 }, 2, 2, 2], [{ gold: 9 }, 5, 0, 0], [{ own: 4 }, 0, 0, 0], [{ own: 4 }, -3, 0, 0],
  ];
  assert.deepEqual(cases.map(([c, held]) => [carriedWorkable(c, held), carriedUsable(c, held)]), cases.map(([, , w, u]) => [w, u]),
    'workable: held but the gold the count names once cut (gold\'s first) - usable: the count\'s own and bought, as far as held');
});

// ─── THE SERVICE ─────────────────────────────────────────────────────

test('BAG-CRAFT the service: a `work` deposit moves what the client holds past the count into the Stores as loose, the count untouched; the counted units first, bought then own; never past what is held, never gold\'s; `spend` and `all` move the count alone; a repeat is answered as made (mutants: work past held; spend loose; the loose part own; the count cut for loose units; gold\'s moved)', async () => {
  const { door, mac, raw, stores, carried, count } = await stand();
  const rid = () => mintProfRid();
  const OAK = 'log:oak';
  const put = (qty, held, order, id = rid()) => door.deposit(mac.character, OAK, qty, held, order, id);
  // nothing counted: a writ's, the market's and the Stores page's put-in move nothing
  for (const order of ['all', 'spend']) assert.equal((await put(4, 10, order)).error, 'carried-short', order);
  assert.deepEqual(stores(OAK), {});
  // a station's moves what is held
  const id = rid();
  const w = await put(4, 10, 'work', id);
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.deepEqual([w.data.own, w.data.bought, w.data.gold, w.data.loose], [0, 0, 0, 4]);
  assert.deepEqual(stores(OAK), { loose: 4 }, 'as loose (AUDIT A1)');
  assert.deepEqual(carried(OAK), {}, 'the count untouched');
  const again = await put(4, 10, 'work', id);
  assert.deepEqual([again.ok, again.data.repeat, again.data.loose], [true, true, 4], 'a repeat answered as made');
  assert.deepEqual(stores(OAK), { loose: 4 }, 'and moves nothing');
  // never past what is held
  assert.equal((await put(7, 6, 'work')).error, 'carried-short');
  assert.deepEqual(stores(OAK), { loose: 4 });
  // counted first - bought, then own - then the loose part; the count moves by its own alone
  count(OAK, 'own', 2);
  count(OAK, 'bought', 1);
  const mix = await put(5, 6, 'work');   // held 6, counted 3: 3 loose may move
  assert.equal(mix.ok, true, JSON.stringify(mix));
  assert.deepEqual([mix.data.own, mix.data.bought, mix.data.gold, mix.data.loose], [2, 1, 0, 2]);
  assert.deepEqual(stores(OAK), { bought: 1, loose: 6, own: 2 }, 'each origin as it was, the loose part loose');
  assert.deepEqual(carried(OAK), {});
  // gold's walled: held 5 of which the count names 3 gold - 2 may move
  count(OAK, 'gold', 3);
  assert.equal((await put(3, 5, 'work')).error, 'carried-short', 'gold\'s units never moved by a station');
  const g = await put(2, 5, 'work');
  assert.deepEqual([g.ok, g.data.loose], [true, 2]);
  assert.deepEqual(carried(OAK), { gold: 3 }, 'gold\'s count stays');
  // the count cut to what is held first: counted 8 own, held 3 - 3 move, none of them loose
  const PINE = 'log:pine';
  count(PINE, 'own', 8);
  const cut = await door.deposit(mac.character, PINE, 3, 3, 'work', rid());
  assert.deepEqual([cut.ok, cut.data.own, Object.hasOwn(cut.data, 'loose')], [true, 3, false], 'none loose: the answer as it always was');
  assert.deepEqual(carried(PINE), {}, 'cut to 3, and the 3 moved');
  // a full Store says so, the loose units there to move
  const ASH = 'metal:iron';
  raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, ASH, STORES_MAX - 1);
  assert.equal((await door.deposit(mac.character, ASH, 2, 2, 'work', rid())).error, 'stores-full', 'never said as short of what it holds');
});

// ─── THE BOOK ────────────────────────────────────────────────────────

test('BAG-CRAFT the book: a station\'s put-in covers its shortfall from what is carried counted or not, by `work`; a writ\'s and the market\'s from the count alone, by `spend` - a count moved since it was heard refuses it, the bag given back; a brew, a smelt and a temper are stations (mutants: a station by spend; a writ by work; the shortfall checked against the count)', async () => {
  const { door, mac, raw, count } = await stand();
  const e = body();
  mintCarried(e, 'metal:iron', 5);
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait, carry: hands(e) });
  assert.equal((await book.refresh()).ok, true);
  const writ = await book.ensureInStores([{ key: 'metal:iron', n: 2 }]);
  assert.deepEqual([writ.ok, writ.error], [false, 'materials-short'], 'a writ\'s or the market\'s put-in: the count alone');
  assert.equal(heldOf(e, 'metal:iron'), 5, 'nothing taken');
  assert.deepEqual([(await book.ensureInStores([{ key: 'metal:iron', n: 6 }], { work: true })).error, heldOf(e, 'metal:iron')], ['materials-short', 5], 'a station\'s past what is held: nothing moved');
  const station = await book.ensureInStores([{ key: 'metal:iron', n: 2 }, { key: 'metal:iron', n: 1 }], { work: true });
  assert.deepEqual(station, { ok: true, moved: 3 });
  assert.deepEqual([heldOf(e, 'metal:iron'), book.storesHeld('metal:iron'), book.storesWorkable('metal:iron'), book.workable('metal:iron'), book.held('metal:iron')], [2, 0, 3, 5, 0],
    'AUDIT A1: put in loose - a station\'s three, no writ\'s');
  assert.deepEqual(await book.ensureInStores([{ key: 'metal:iron', n: 3 }], { work: true }), { ok: true, moved: 0 }, 'a station\'s next press spends the loose three where they are');
  assert.deepEqual(await book.ensureInStores([{ key: 'metal:iron', n: 4 }], { work: true }), { ok: true, moved: 1 }, 'and puts in only what they lack');
  // a writ's put-in of units the count named when it was heard, cut since (another device): the service's count decides
  const COPPER = 'metal:copper';
  mintCarried(e, COPPER, 4);
  count(COPPER, 'own', 2);
  assert.equal((await book.refresh({ force: true })).ok, true);
  assert.equal(book.held(COPPER), 2);
  raw.prepare('DELETE FROM prof_carried WHERE player = ? AND material = ?').run(mac.id, COPPER);
  const stale = await book.ensureInStores([{ key: COPPER, n: 2 }]);
  assert.deepEqual([stale.ok, stale.error], [false, 'carried-short'], 'never the loose units for a writ');
  assert.deepEqual([heldOf(e, COPPER), book.storesHeld(COPPER)], [4, 0], 'given back');
  // a writ's put-in beside the Stores' loose units: they are no writ's - the counted unit goes in all the same
  count('metal:iron', 'own', 1);
  assert.equal((await book.refresh({ force: true })).ok, true);
  assert.deepEqual([book.storesWorkable('metal:iron'), book.storesHeld('metal:iron'), heldOf(e, 'metal:iron')], [4, 0, 1]);
  assert.deepEqual(await book.ensureInStores([{ key: 'metal:iron', n: 1 }]), { ok: true, moved: 1 }, 'AUDIT A1: never read as already in');
  assert.equal(book.storesHeld('metal:iron'), 1);
  // the doors: every station's press works the bag; a Court writ's delivery does not (by source - their own suites drive them)
  const pb = src('src/net/profBook.js');
  for (const line of [
    'const ready = r0 ? await book.ensureInStores(inputs, { work: true }) : { ok: true };',
    'const ready = await book.ensureInStores(brewSpends(potionById(potion), keys), { work: true });',
    'const ready = temperableRecipe(r0) ? await book.ensureInStores([temperCost(r0)], { work: true }) : { ok: true };',
    'const ready = work ? await book.ensureInStores(work.inputs.map((i) => ({ key: i.key, n: i.n * count })), { work: true }) : { ok: true };',
    'const ready = asked ? await book.ensureInStores([{ key: asked.material, n: asked.qty }]) : { ok: true };',
  ]) assert.ok(codeHas(pb, line), line);
  const w = src('src/scenes/world.js');
  assert.ok(codeHas(w, 'const ready = await profBook.ensureInStores([{ key: material, n: Number(ask.units) || 0 }]);'), 'a guild writ\'s supply: the count alone');
  assert.ok(codeHas(w, 'putIn: (key, n) => profBook.ensureInStores([{ key, n }]),'), 'the market\'s: the count alone');
});

// ─── THE STATIONS ────────────────────────────────────────────────────

test('BAG-CRAFT the stations read what may be worked: a Steel Longsword whose goods sit uncounted in the bag is "can make now" at the anvil, Quick craft asks it; the forge offers the bag\'s Pine Logs to burn (mutants: the anvil reading `held`; the forge\'s burns reading `held`)', async () => {
  const { door, mac } = await stand();
  const e = body();
  for (const [m, n] of Object.entries({ 'ingot:steel': 3, 'metal:copper': 1, 'leather:cured': 1, 'log:pine': 2 })) mintCarried(e, m, n);
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait, carry: hands(e) });
  assert.equal((await book.refresh()).ok, true);
  const { setProfessionsPages, drawStoresPage, resetProfPages } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  resetProfPages();
  setPref('gentleActs', true);
  const crafted = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'home', fee: 0 }), workbench: () => null, loom: () => null,
    clothing: () => 'MensClothing', stitchBand: () => 1, smelt: async () => ({ ok: true, text: '' }), stock: async () => ({ ok: true, text: '' }),
    craft: async (recipe) => { crafted.push(recipe); return { ok: true, text: 'made' }; }, heatBand: () => 1, planeBand: () => 1,
    inTown: () => true, carriedHeld: (k) => heldOf(e, k), room: (k) => roomFor(e, k), bag: () => ({ has: true, kg: 0, max: 300, count: e.bagItems.length }),
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (word) => el('h3', null, word), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  try {
    draw();
    const buttons = () => [...root.querySelectorAll('button')];
    assert.ok(buttons().some((b) => b.textContent === 'Burn'), 'the forge burns the bag\'s Pine Logs');
    const sword = buttons().find((b) => b.className.includes('prof-recipe') && b.textContent.startsWith('Longsword'));
    assert.equal(sword?.textContent, 'Longswordcan make now', 'the bag\'s goods, uncounted, held as they stand');
    sword.onclick();
    buttons().find((b) => b.textContent.startsWith('Steel')).onclick();
    buttons().find((b) => b.textContent.startsWith('Quick craft')).onclick();
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(crafted, ['longsword:steel']);
  } finally { setProfessionsPages(null); setPref('gentleActs', false); resetProfPages(); root?.remove(); }
});
