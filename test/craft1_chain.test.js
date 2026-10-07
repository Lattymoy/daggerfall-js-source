// CRAFT1 (2026-10-07, Mac: "How could we enhance the profession element of the game while reducing complexity and
// making crafting more viable"; then "Lets do it") - THE CHAIN: a station plans the refining a craft needs. A Steel
// Longsword from 6 Iron, 3 Pine Logs, 1 Copper and 2 Rat hides was four works at two stations before the anvil; the
// craft runs them now (net/chainLaw.js chainPlan, net/profBook.js craft), each the service's own smelt kept in the
// Stores. The done-when: that sword, made in one press through the real Worker, its works' XP and its own.
// bible/06-Systems/Professions-Arc.md 41.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf } from './accountDb.mjs';
import { trackView } from '../server-account/src/professions.js';
import { heldOf as bagHeld, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../src/systems/materialsBag.js';
import { BAG_TEMPLATE } from '../src/net/bagLaw.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, WORK_RECIPES, SMELT_MAX, materialOf } from '../src/net/professionLaw.js';
import { recipeById } from '../src/net/recipeLaw.js';
import { chainPlan, chainWorks, chainNeeded, chainYield, refinedText, chainStopText, storesRoom, CHAIN_WORKS, CHAIN_DEPTH, producersOf } from '../src/net/chainLaw.js';
import { mintPieces } from '../src/systems/smithItems.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const heldOf = (o) => (k) => o[k] ?? 0;
const STEEL_SWORD = recipeById('longsword:steel');
const RAW = { 'metal:iron': 6, 'log:pine': 3, 'metal:copper': 1, 'hide:rat': 2 };

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('CRAFT1 DONE WHEN: a Steel Longsword from raw goods in one press through the real Worker - the Iron smelted, the Pine burnt, the Steel smelted, the hide cured, each kept in the Stores for the anvil; the sword minted into the pack; every unit spent; Smithing the works\' XP and the craft\'s', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(10));
  for (const [m, n] of Object.entries(RAW)) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, m, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const pack = [];
  const r = await book.craft('longsword:steel', { clean: false, name: 'Mac' }, (data) => pack.push(...mintPieces(data)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.refined.map((w) => [w.id, w.count]), [['ingot:iron', 3], ['burn:pine', 3], ['ingot:steel', 3], ['cure:rat', 1]], 'the works, in the order they were asked');
  assert.equal(pack.length, 1);
  assert.deepEqual([pack[0].templateIndex, pack[0].material], [STEEL_SWORD.templateIndex, STEEL_SWORD.material], 'DFU\'s Steel Longsword');
  for (const k of [...Object.keys(RAW), 'ingot:iron', 'ingot:steel', 'wood:charcoal', 'leather:cured']) assert.equal(book.held(k), 0, `${k} spent`);
  const works = r.refined.reduce((n, w) => n + w.xp, 0);
  assert.ok(works > 0, 'the smelts paid Smithing');
  assert.equal(book.track('smithing').xp, xpForRank(10) + works + r.data.xp, 'the works\' XP and the craft\'s, as the service credited them');
  const rows = raw.prepare('SELECT recipe, count FROM prof_smelts WHERE player = ? ORDER BY at, rowid').all(mac.id).map((x) => [x.recipe, Number(x.count)]);
  assert.deepEqual(rows, [['ingot:iron', 3], ['burn:pine', 3], ['ingot:steel', 3], ['cure:rat', 1]], 'the service\'s own works - no new door');
});

// ─── THE LAW ─────────────────────────────────────────────────────────

test('CRAFT1 law: the works a chain may plan - every work of the forge, the workbench, the loom and the mason\'s bench, never a transmutation and never one that trades down a tier (no wood but Pine burnt to Charcoal; no Tiger cured to Cured Leather, no Dragonling to Hardened)', () => {
  assert.deepEqual(CHAIN_WORKS.map((r) => r.id), [
    'ingot:iron', 'ingot:steel', 'ingot:silver', 'metal:brass', 'ingot:moonstone', 'ingot:dwarven', 'ingot:mithril', 'ingot:adamantium', 'ingot:ebony', 'ingot:orichalcum',
    'burn:pine',
    'saw:pine', 'saw:oak', 'saw:cherry', 'saw:teak', 'saw:mahogany', 'saw:ironwood', 'saw:ghostwood',
    'cure:rat', 'cure:bat', 'cure:bear', 'cure:scorpion', 'cure:slaughterfish', 'cure:dreugh',
    'weave:silk', 'cut:stone', 'mix:mortar',
  ]);
  const left = WORK_RECIPES.filter((r) => !CHAIN_WORKS.includes(r)).map((r) => r.id);
  assert.deepEqual(left, ['burn:oak', 'burn:cherry', 'burn:teak', 'burn:mahogany', 'burn:ironwood', 'burn:ghostwood', 'cure:tiger', 'cure:dragonling',
    'transmute:tin', 'transmute:copper', 'transmute:silver', 'transmute:gold']);
  assert.deepEqual(producersOf('leather:cured').map((r) => r.id), ['cure:rat', 'cure:bat', 'cure:bear'], 'the cheapest hide first');
  assert.deepEqual(producersOf('leather:hardened').map((r) => r.id), ['cure:scorpion', 'cure:slaughterfish', 'cure:dreugh']);
  // FACT, pinned rather than sorted: every product two works make stands in the table cheapest first
  const worth = (r) => r.inputs.reduce((n, i) => n + i.n * materialOf(i.key, () => null).value, 0) / r.per;
  for (const out of new Set(CHAIN_WORKS.map((r) => r.out))) {
    const costs = producersOf(out).map(worth);
    assert.deepEqual(costs, [...costs].sort((a, b) => a - b), `${out}: cheapest first`);
  }
  assert.equal(CHAIN_DEPTH, 4);
});

test('CRAFT1 law: the Steel Longsword\'s chain from raw goods - the works in the order they are asked, the held units each takes, nothing short; from part-made goods only what is wanting', () => {
  assert.deepEqual(chainPlan(STEEL_SWORD.inputs, heldOf(RAW)), {
    ok: true,
    works: [{ id: 'ingot:iron', count: 3 }, { id: 'burn:pine', count: 3 }, { id: 'ingot:steel', count: 3 }, { id: 'cure:rat', count: 1 }],
    spent: [{ key: 'metal:copper', n: 1 }, { key: 'metal:iron', n: 6 }, { key: 'log:pine', n: 3 }, { key: 'hide:rat', n: 2 }],
    short: [],
    full: [],
  });
  // a Steel Ingot and an Iron Ingot held, a Charcoal and a Cured Leather: two Steel to smelt, one Iron for one of them
  const part = chainPlan(STEEL_SWORD.inputs, heldOf({ 'ingot:steel': 1, 'ingot:iron': 1, 'metal:iron': 2, 'wood:charcoal': 1, 'log:pine': 1, 'metal:copper': 1, 'leather:cured': 1 }));
  assert.deepEqual([part.ok, part.works], [true, [{ id: 'ingot:iron', count: 1 }, { id: 'burn:pine', count: 1 }, { id: 'ingot:steel', count: 2 }]]);
  // every input held: no chain wanted, and an empty one
  const held = heldOf({ 'ingot:steel': 3, 'metal:copper': 1, 'leather:cured': 1 });
  assert.equal(chainNeeded(STEEL_SWORD.inputs, held), false);
  assert.equal(chainNeeded(STEEL_SWORD.inputs, heldOf(RAW)), true);
  assert.deepEqual(chainPlan(STEEL_SWORD.inputs, held).works, []);
});

test('CRAFT1 law: short at the bottom of the chain - 4 Iron and one Rat hide for the sword say 2 Iron and 1 Rat hide short, not Steel; a rank the service asks (Mortar\'s 10) is asked here', () => {
  const short = chainPlan(STEEL_SWORD.inputs, heldOf({ ...RAW, 'metal:iron': 4, 'hide:rat': 1 }));
  assert.equal(short.ok, false);
  assert.deepEqual(short.short, [{ key: 'metal:iron', n: 2 }, { key: 'hide:rat', n: 1 }]);
  const mortar = [{ key: 'stone:mortar', n: 3 }];
  const goods = heldOf({ 'metal:sulphur': 1, 'metal:lead': 1, 'stone:rough': 5 });
  assert.deepEqual(chainPlan(mortar, goods, { track: () => ({ rank: 9 }) }).short, [{ key: 'stone:mortar', n: 3 }], 'below Masonry 10: no mix');
  assert.deepEqual(chainPlan(mortar, goods, { track: () => ({ rank: 10 }) }).works, [{ id: 'mix:mortar', count: 1 }], 'ten a mix');
});

test('CRAFT1 law: the cheapest first, then the next for what it could not cover; a Tanner\'s cure is two leathers (the service\'s yield); a count past SMELT_MAX asked in more than one request', () => {
  const three = chainPlan([{ key: 'leather:cured', n: 3 }], heldOf({ 'hide:rat': 2, 'hide:bat': 2, 'hide:bear': 2 }));
  assert.deepEqual(three.works, [{ id: 'cure:rat', count: 1 }, { id: 'cure:bat', count: 1 }, { id: 'cure:bear', count: 1 }]);
  const tanner = (prof) => (prof === 'hunting' ? { rank: 50, specs: { 50: 'tanner' } } : null);
  assert.deepEqual(chainPlan([{ key: 'leather:cured', n: 2 }], heldOf({ 'hide:rat': 2 }), { track: tanner }).works, [{ id: 'cure:rat', count: 1 }]);
  assert.equal(chainPlan([{ key: 'leather:cured', n: 2 }], heldOf({ 'hide:rat': 2 })).ok, false, 'no Tanner: two hides a leather');
  assert.equal(chainYield(producersOf('leather:cured')[0], tanner), 2);
  assert.equal(chainYield(producersOf('plank:pine')[0]), 2, 'a log saws to two planks');
  assert.deepEqual(chainPlan([{ key: 'ingot:iron', n: 250 }], heldOf({ 'metal:iron': 500 })).works, [{ id: 'ingot:iron', count: SMELT_MAX }, { id: 'ingot:iron', count: SMELT_MAX }, { id: 'ingot:iron', count: 50 }]);
  // what a work made past its need is there for the next: one log saws to the two planks two inputs ask
  assert.deepEqual(chainPlan([{ key: 'plank:pine', n: 1 }, { key: 'plank:pine', n: 1 }], heldOf({ 'log:pine': 1 })).works, [{ id: 'saw:pine', count: 1 }]);
  assert.deepEqual(chainWorks([{ id: 'a', count: 1 }, { id: 'a', count: 2 }, { id: 'b', count: 1 }, { id: 'a', count: 1 }]), [{ id: 'a', count: 3 }, { id: 'b', count: 1 }, { id: 'a', count: 1 }]);
});

test('AUDIT CRAFT1 law: F1 the Stores\' room - a product the Stores have no room for is never planned past it (gold-bought units count, as the service counts them) and is said `full`; F2 what is held is taken first, whatever the inputs\' order; F3 `spent` is what was held, never what a work made', () => {
  // F1: a Quartermaster's dagger, 4,999 gold-bought Iron Ingots in the Stores - the service would answer `stores-full`
  const qm = (prof) => (prof === 'smithing' ? { rank: 100, specs: { 100: 'quartermaster' } } : null);
  const room = (k) => storesRoom(k === 'ingot:iron' ? { own: 0, bought: 0, gold: 4999 } : null);
  const dagger = recipeById('dagger:iron');
  const full = chainPlan(dagger.inputs, heldOf({ 'metal:iron': 2, 'metal:tin': 1 }), { track: qm, room });
  assert.deepEqual([full.ok, full.short, full.full], [false, [], [{ key: 'ingot:iron', n: 2 }]]);
  assert.equal(chainPlan(dagger.inputs, heldOf({ 'metal:iron': 2, 'metal:tin': 1 }), { track: qm }).ok, true, 'room enough: planned');
  assert.equal(storesRoom({ own: 10, bought: 5, gold: 985 }), 4000);
  assert.equal(storesRoom(null), 5000);
  // F2: Rat hides asked as they are and a Cured Leather: the leather from the Bat hides, in either order
  const held = heldOf({ 'hide:rat': 2, 'hide:bat': 2 });
  for (const inputs of [[{ key: 'leather:cured', n: 1 }, { key: 'hide:rat', n: 2 }], [{ key: 'hide:rat', n: 2 }, { key: 'leather:cured', n: 1 }]]) {
    assert.deepEqual(chainPlan(inputs, held).works, [{ id: 'cure:bat', count: 1 }], JSON.stringify(inputs));
  }
  // F3: a Quartermaster's Iron smelt makes two ingots; the one past the Steel's need meets the Iron Ingot asked - never held
  const f3 = chainPlan([{ key: 'ingot:steel', n: 1 }, { key: 'ingot:iron', n: 1 }], heldOf({ 'metal:iron': 2, 'log:pine': 1 }), { track: qm });
  assert.equal(f3.ok, true);
  assert.deepEqual(f3.spent, [{ key: 'metal:iron', n: 2 }, { key: 'log:pine', n: 1 }]);
});

test('CRAFT1 law: what a chain refined, said - the products and each profession\'s XP; nothing said where nothing was refined', () => {
  const name = (k) => ({ 'ingot:iron': 'Iron Ingot', 'wood:charcoal': 'Charcoal', 'ingot:steel': 'Steel Ingot', 'leather:cured': 'Cured Leather' })[k] ?? k;
  assert.equal(refinedText([{ id: 'ingot:iron', count: 3, xp: 30 }, { id: 'burn:pine', count: 3, xp: 0 }, { id: 'ingot:steel', count: 3, xp: 60 }, { id: 'cure:rat', count: 1, xp: 0 }], name),
    'Refined first: Iron Ingot x3, Charcoal x3, Steel Ingot x3, Cured Leather x1 (+90 Smithing XP).');
  assert.equal(refinedText([{ id: 'saw:pine', count: 2, xp: 0 }], name), 'Refined first: plank:pine x4.');
  assert.equal(refinedText([{ id: 'cure:rat', count: 1, xp: 0, made: 2 }], name), 'Refined first: Cured Leather x2.', 'AUDIT CRAFT1 F4: the service\'s made, not the yield the book reads now');
  assert.equal(refinedText([{ id: 'cure:rat', count: 1, xp: 0 }], name, () => ({ specs: { 50: 'tanner' } })), 'Refined first: Cured Leather x2.', 'no made kept: the yield');
  assert.equal(refinedText([], name), '');
  assert.equal(refinedText(undefined, name), '');
});

// ─── THE BOOK ────────────────────────────────────────────────────────

/** A stand-in door over a Stores map: works and crafts as the service answers them, `failAt` a work refused. */
function standIn(stores, { failAt = null, tracks = [['smithing', xpForRank(10)]] } = {}) {
  const asked = [];
  const view = (k) => ({ material: k, own: stores.get(k) ?? 0, bought: 0 });
  return {
    asked,
    door: {
      account: () => 'acct-1',
      // the service's own track view (professions.js trackView) - its rank and its choices, as the state read mints them
      state: async () => ({ ok: true, data: { open: true, character: 'c', stores: [...stores].map(([k, n]) => ({ material: k, own: n, bought: 0 })), tracks: tracks.map(([p, xp, specs = {}]) => trackView({ xp, ...specs }, p, 0)) } }),
      smelt: async (c, recipe, count, rid) => {
        asked.push(['smelt', recipe, count]);
        if (recipe === failAt) return { ok: false, error: 'prof-rate' };
        const w = WORK_RECIPES.find((x) => x.id === recipe);
        for (const i of w.inputs) stores.set(i.key, (stores.get(i.key) ?? 0) - i.n * count);
        stores.set(w.out, (stores.get(w.out) ?? 0) + w.per * count);
        return { ok: true, data: { recipe, count, own: w.per * count, bought: 0, xp: w.xp ? 10 : 0, stores: [w.out, ...w.inputs.map((i) => i.key)].map(view), track: null, rid } };   // a burn's and a cure's none (smeltAtForge: `r.xp` null)
      },
      craft: async (c, recipe, clean, name, rid) => {
        asked.push(['craft', recipe]);
        for (const i of recipeById(recipe).inputs) stores.set(i.key, (stores.get(i.key) ?? 0) - i.n);
        return { ok: true, data: { recipe, quality: 1, count: 1, seed: 7, maker: null, xp: 40, first: false, pieces: [], stores: [], track: null, rid } };
      },
    },
  };
}

test('CRAFT1 book: the craft asks the chain\'s works first, each kept in the Stores (`stay`), then the craft; `chain: false` asks the craft alone, as before', async () => {
  const off = standIn(new Map(Object.entries(RAW)));
  const b0 = createProfBook({ door: off.door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await b0.refresh();
  await b0.craft('longsword:steel', { chain: false }, () => {});
  assert.deepEqual(off.asked, [['craft', 'longsword:steel']], 'no chain: no work asked - the service says what is short');
  const stores = new Map(Object.entries(RAW));
  const { door, asked } = standIn(stores);
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await book.refresh();
  const r = await book.craft('longsword:steel', {}, () => {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(asked, [['smelt', 'ingot:iron', 3], ['smelt', 'burn:pine', 3], ['smelt', 'ingot:steel', 3], ['smelt', 'cure:rat', 1], ['craft', 'longsword:steel']]);
  assert.deepEqual(r.refined, [{ id: 'ingot:iron', count: 3, xp: 10, made: 3 }, { id: 'burn:pine', count: 3, xp: 0, made: 3 }, { id: 'ingot:steel', count: 3, xp: 10, made: 3 }, { id: 'cure:rat', count: 1, xp: 0, made: 1 }], 'each work\'s made the service\'s own and bought (AUDIT CRAFT1 F4)');
});

test('CRAFT1 book: a plan that cannot cover the inputs asks no work - the craft is asked as before, and the service says what is short (the book\'s view is not the service\'s); a work refused stops the craft - the works before it done, said, and no craft kept', async () => {
  const stores = new Map(Object.entries({ ...RAW, 'metal:iron': 4 }));
  const { door, asked } = standIn(stores);
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await book.refresh();
  const short = await book.craft('longsword:steel', {}, () => {});
  assert.deepEqual(asked, [['craft', 'longsword:steel']], 'no work asked');
  assert.equal(short.refined, undefined);
  const full = new Map(Object.entries(RAW));
  const failing = standIn(full, { failAt: 'ingot:steel' });
  const b2 = createProfBook({ door: failing.door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await b2.refresh();
  const r = await b2.craft('longsword:steel', {}, () => {});
  assert.deepEqual([r.ok, r.error], [false, 'prof-rate']);
  assert.deepEqual(r.refined.map((w) => w.id), ['ingot:iron', 'burn:pine'], 'the works before it done');
  assert.equal(failing.asked.some(([k]) => k === 'craft'), false, 'no craft asked');
  assert.equal(b2.pendingCrafts, 0, 'none kept');
  assert.deepEqual([b2.held('ingot:iron'), b2.held('wood:charcoal')], [3, 3], 'what the works made waits in the Stores');
});

test('AUDIT CRAFT1 book: F1 a chain\'s work is asked under its own id - a station\'s press of the same work and count while the chain\'s is on the wire is its own work, never answered the chain\'s; F2 a work refused for what the Stores hold has the book read again; F4 where the chain stopped, kept and said', async () => {
  const stores = new Map(Object.entries(RAW));
  const { door, asked } = standIn(stores);
  let release = null;
  const gate = new Promise((r) => { release = r; });
  const smelt = door.smelt;
  door.smelt = async (...a) => { if (a[1] === 'ingot:iron' && asked.filter(([k, id]) => k === 'smelt' && id === 'ingot:iron').length === 0) await gate; return smelt(...a); };
  stores.set('metal:iron', 12);
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await book.refresh();
  const crafting = book.craft('longsword:steel', {}, () => {});
  await new Promise((r) => setTimeout(r, 5));
  const manual = book.smelt('ingot:iron', 3);
  release();
  const [r, m] = await Promise.all([crafting, manual]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(m.ok, true);
  assert.equal(asked.filter(([k, id]) => k === 'smelt' && id === 'ingot:iron').length, 2, 'two works asked - the press its own');
  // F2 + F4: the Stores moved under the book (a lost answer, a press elsewhere) - the chain's work refused `stores-short`
  const s2 = new Map(Object.entries(RAW));
  const d2 = standIn(s2);
  d2.door.smelt = async (c, recipe) => (recipe === 'burn:pine' ? { ok: false, error: 'stores-short', material: 'log:pine' } : { ok: true, data: { recipe, count: 3, own: 3, bought: 0, xp: 0, stores: [], track: null } });
  let t = 0;
  const b2 = createProfBook({ door: d2.door, storage: memStorage(), character: () => 'c', sleep: noWait, now: () => 1_000_000 + t });
  await b2.refresh();
  t = 60 * 60 * 1000;   // past the backoff, the same UTC day
  assert.equal(b2.stale(), false);
  const r2 = await b2.craft('longsword:steel', {}, () => {});
  assert.deepEqual([r2.ok, r2.error, r2.stopped, r2.material], [false, 'stores-short', 'burn:pine', 'log:pine']);
  assert.equal(b2.stale(), true, 'read again');
  const name = (k) => ({ 'wood:charcoal': 'Charcoal', 'log:pine': 'Pine Log' })[k] ?? k;
  assert.equal(chainStopText('burn:pine', 'log:pine', name), 'The chain stopped at the Charcoal, short of Pine Log.');
  assert.equal(chainStopText('burn:pine', null, name), 'The chain stopped at the Charcoal.');
  assert.equal(chainStopText(undefined, 'log:pine', name), '');
});

test('AUDIT CRAFT1 book: the chain\'s works kept in the Stores through the real Worker with a Materials Bag - four works and the craft, never a work\'s products carried out to the bag and put back (`stay`); the book hands the plan its tracks (a Tanner\'s two leathers of two hides); a recipe the rank does not open runs no chain', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, 1)`).run(mac.id, mac.character, xpForRank(10));
  for (const [m, n] of Object.entries(RAW)) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)`).run(mac.id, mac.character, m, n);
  const paths = [];
  const fetch = (u, i) => { paths.push(new URL(typeof u === 'string' ? u : u.url).pathname); return s.fetch(u, i); };
  const e = { stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 };
  const carry = { held: (k) => bagHeld(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n), take: (k, n, id, order) => takeCarried(e, k, n, id, order),
    give: (k, n) => giveCarried(e, k, n), stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; }, stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })) };
  const book = createProfBook({ door: accountProf({ fetch, storage: sessionStorageOf(SESSION_KEY, mac) }), storage: memStorage(), character: () => mac.character, sleep: noWait, carry });
  assert.equal((await book.refresh()).ok, true);
  paths.length = 0;
  const r = await book.craft('longsword:steel', { name: 'Mac' }, () => {});
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(paths, ['/v1/prof/smelt', '/v1/prof/smelt', '/v1/prof/smelt', '/v1/prof/smelt', '/v1/prof/craft'], 'no withdraw, no deposit - the works\' products stayed where the craft spends them');
  // the book's tracks to the plan: a Tanner (Hunting 50) cures two leathers of two Rat Pelts - the cuirass's two
  const stores = new Map([['ingot:iron', 6], ['hide:rat', 2]]);
  const t = standIn(stores, { tracks: [['smithing', xpForRank(10)], ['hunting', xpForRank(50), { spec50: 'tanner' }]] });
  const tb = createProfBook({ door: t.door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await tb.refresh();
  assert.equal(tb.track('hunting').specs[50], 'tanner', 'the stand-in mints the service\'s choice');
  await tb.craft('cuirass:iron', {}, () => {});
  assert.deepEqual(t.asked, [['smelt', 'cure:rat', 1], ['craft', 'cuirass:iron']]);
  // a Steel Longsword (rank 10) at Smithing 9: no chain - the craft asked as ever, the service to refuse its rank
  const low = standIn(new Map(Object.entries(RAW)), { tracks: [['smithing', xpForRank(9)]] });
  const lb = createProfBook({ door: low.door, storage: memStorage(), character: () => 'c', sleep: noWait });
  await lb.refresh();
  await lb.craft('longsword:steel', {}, () => {});
  assert.deepEqual(low.asked, [['craft', 'longsword:steel']]);
});

test('AUDIT CRAFT1 book: a refused work\'s answer carries the material the service named and `elsewhere` where the character changed under the chain; what the chain refined is said whatever stops the craft after it', async () => {
  const stores = new Map(Object.entries(RAW));
  const d = standIn(stores);
  let who = 'c';
  const smelt = d.door.smelt;
  d.door.smelt = async (...a) => { const r = await smelt(...a); who = 'other'; return r; };   // the character switched as the first work answered
  const b = createProfBook({ door: d.door, storage: memStorage(), character: () => who, sleep: noWait });
  await b.refresh();
  const r = await b.craft('longsword:steel', {}, () => {});
  assert.deepEqual([r.ok, r.elsewhere, r.refined?.map((w) => w.id)], [false, true, []], 'the first work answered elsewhere: stopped, said, nothing done here');
  assert.equal(d.asked.filter(([k]) => k === 'smelt').length, 1, 'no second work for the other character');
  // the chain done, the craft's own put-in refused (the Copper carried, the service's count gone): the works said
  const s2 = new Map(Object.entries(RAW));
  s2.delete('metal:copper');
  const d2 = standIn(s2);
  const state = d2.door.state;
  d2.door.state = async () => { const r0 = await state(); r0.data.carried = [{ material: 'metal:copper', own: 1, bought: 0 }]; return r0; };
  d2.door.deposit = async () => ({ ok: false, error: 'carried-short' });
  const carry = { held: (k) => (k === 'metal:copper' ? 1 : 0), room: () => 1000, mint: () => 0, take: () => 0, give: () => 0, stamped: () => false, unstamp: () => {}, stamps: () => [] };
  const b2 = createProfBook({ door: d2.door, storage: memStorage(), character: () => 'c', sleep: noWait, carry });
  await b2.refresh();
  const r2 = await b2.craft('longsword:steel', {}, () => {});
  assert.equal(r2.ok, false);
  assert.deepEqual(r2.refined?.map((w) => w.id), ['ingot:iron', 'burn:pine', 'ingot:steel', 'cure:rat'], JSON.stringify(r2));
  assert.equal(d2.asked.some(([k]) => k === 'craft'), false);
});

// ─── THE PAGE AND THE HOST ───────────────────────────────────────────

test('CRAFT1 anvil page: a recipe whose inputs are made from raw says so, its box says what is refined first and from what, and Craft is offered; a chain short at the bottom says what is short and offers none', async () => {
  const { setProfessionsPages, drawStoresPage } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setPref('gentleActs', true);
  const held = new Map(Object.entries(RAW));
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks: new Map(), today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: () => ({ profession: 'smithing', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }), materials: () => [],
    pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const crafted = [];
  let craftWait = null;
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'home', fee: 0 }), smelt: async () => ({ ok: true, text: '' }),
    craft: async (recipe) => { crafted.push(recipe); await craftWait; return { ok: true, text: 'made' }; }, stock: async () => ({ ok: true, text: '' }), heatBand: () => 1,
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const buttons = () => [...root.querySelectorAll('button')];
  const press = (label) => buttons().find((b) => b.textContent.startsWith(label)).onclick();
  press('Steel');
  const row = buttons().find((b) => b.textContent.startsWith('Steel Longsword'));
  assert.match(row.textContent, /can make from raw/);
  assert.equal(row.className.includes('prof-locked'), false);
  row.onclick();
  assert.match(root.textContent, /Refined first, here: smelt ingot:iron x3, burn wood:charcoal x3, smelt ingot:steel x3, cure leather:cured x1 - from metal:iron x6, log:pine x3, hide:rat x2\./);
  const craft = buttons().find((b) => b.textContent === 'Craft');
  assert.equal(craft.disabled, false, 'offered');
  // AUDIT CRAFT1 F1 + N1: while the craft (and its chain) is in flight, no forge work is pressed and no other bench's hands start
  let done = null;
  craftWait = new Promise((r) => { done = r; });
  press('Quick craft');
  const smeltRows = buttons().filter((b) => /^Smelt/.test(b.textContent));
  assert.ok(smeltRows.length > 0);
  assert.ok(smeltRows.every((b) => b.disabled), 'the forge\'s rows held under the craft');
  done(); await new Promise((r) => setTimeout(r, 5));   // the press's handler answers nothing: its craft lands a tick on
  assert.ok(buttons().filter((b) => /^Smelt/.test(b.textContent)).some((b) => !b.disabled), 'and let go after');
  assert.deepEqual(crafted, ['longsword:steel']);
  held.set('metal:iron', 4);
  draw();
  press('Steel');
  assert.match(buttons().find((b) => b.textContent.startsWith('Steel Longsword')).textContent, /wants its inputs/);
  buttons().find((b) => b.textContent.startsWith('Steel Longsword')).onclick();
  assert.match(root.textContent, /From raw goods, short of metal:iron x2\./);
  assert.equal(buttons().find((b) => b.textContent === 'Craft').disabled, true);
  setPref('gentleActs', false);
  setProfessionsPages(null);
  root.remove();
});

test('AUDIT CRAFT1 the other four benches drawn: the workbench\'s staff from Pine Logs (saw), the loom\'s cuirass from Rat Pelts (cure), the Sculptor\'s column from Rough Stone (cut, mix), the jeweller\'s bracer (cure) - each "can make from raw", unlocked, its note, its Craft offered and asked; a Timberwright\'s saw said three planks, a Quartermaster\'s ingots two', async () => {
  const { setProfessionsPages, drawStoresPage, resetProfPages } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  setPref('gentleActs', true);
  const T = (p, rank, s50 = null, s100 = null) => ({ profession: p, xp: xpForRank(rank), rank, specs: { 50: s50, 100: s100 }, respec: null });
  const held = new Map(Object.entries({ 'log:pine': 2, 'hide:rat': 14, 'hide:scorpion': 12, 'stone:rough': 29, 'metal:sulphur': 1, 'metal:lead': 1, 'metal:silver': 2 }));
  const tracks = new Map([['masonry', T('masonry', 100, null, 'sculptor')], ['outfitting', T('outfitting', 20)]]);
  const book = { state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }), track: (p) => tracks.get(p) ?? T(p, 0), materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0 };
  const crafted = [];
  const home = () => ({ kind: 'home', fee: 0 });
  setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({}), forge: () => null, workbench: home, loom: home, mason: home, jeweller: home, smelt: async () => ({}),
    craft: async (recipe) => { crafted.push(recipe); return { ok: true, text: 'made' }; }, stock: async () => ({}), heatBand: () => 1, planeBand: () => 1, stitchBand: () => 1, chiselBand: () => 1, facetBand: () => 1, clothing: () => 'MensClothing' });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, { el, divider: (w) => el('h3', null, w), meter: () => el('div') }); };
  try {
    draw();
    const buttons = () => [...root.querySelectorAll('button')];
    const row = (name) => buttons().find((b) => b.textContent.startsWith(name));
    const note = () => [...root.querySelectorAll('.prof-chain')].map((n) => n.textContent);
    row('Bracer').onclick();
    const cases = [
      ['Pine Staff', 'Refined first, here: saw plank:pine x4 - from log:pine x2. Their XP is the works\' own; what is left over stays in your Stores.'],
      ['Leather Cuirass', 'Refined first, here: cure leather:cured x6 - from hide:rat x12. Their XP is the works\' own; what is left over stays in your Stores.'],
      ['Stone Column', 'Refined first, here: cut stone:cut x12, mix stone:mortar x10 - from stone:rough x29, metal:sulphur x1, metal:lead x1. Their XP is the works\' own; what is left over stays in your Stores.'],
      ['Silver Bracer', 'Refined first, here: cure leather:cured x1 - from hide:rat x2. Their XP is the works\' own; what is left over stays in your Stores.'],
    ];
    for (const [name, words] of cases) {
      const r = row(name);
      assert.ok(r, name);
      assert.match(r.textContent, /can make from raw$/, `${name}: the row's word`);
      assert.equal(r.className.includes('prof-locked'), false, `${name}: unlocked`);
      r.onclick();
      assert.ok(note().includes(words), `${name}: ${JSON.stringify(note())}`);
      const box = [...root.querySelectorAll('.prof-craft')].find((b) => b.querySelector('b')?.textContent.startsWith(name));
      const go = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Craft');
      assert.equal(go.disabled, false, `${name}: its Craft offered`);
      go.onclick();
      await new Promise((res) => setTimeout(res, 5));
    }
    assert.deepEqual(crafted, ['staff:pine', 'leather-cuirass:cured', 'column:stone', 'bracer:silver']);
    // a choice's yield said: a Timberwright saws three planks a log
    tracks.set('logging', T('logging', 100, null, 'timberwright'));
    draw();
    row('Pine Staff').onclick();
    assert.ok(note().some((n) => n.startsWith('Refined first, here: saw plank:pine x3 - from log:pine x1.')), JSON.stringify(note()));
    // a rank-locked row stays locked, though a chain could make its inputs (12 Scorpion hides cure to its 6 Hardened Leather)
    assert.equal(chainPlan(recipeById('leather-cuirass:hardened').inputs, (k) => held.get(k) ?? 0).ok, true);
    assert.ok(row('Hardened Leather Cuirass').className.includes('prof-locked'));
    assert.match(row('Hardened Leather Cuirass').textContent, /rank 55$/);
  } finally { setPref('gentleActs', false); resetProfPages(); setProfessionsPages(null); root?.remove(); }
});

test('AUDIT CRAFT1 the yields said: a Quartermaster\'s ingots two a work on the anvil\'s note and in the answer; a Timberwright\'s three planks; a split past SMELT_MAX summed', () => {
  const name = (k) => k;
  const qm = () => ({ specs: { 100: 'quartermaster' } });
  assert.equal(refinedText([{ id: 'ingot:iron', count: 2, xp: 0 }], name, qm), 'Refined first: ingot:iron x4.');
  assert.equal(refinedText([{ id: 'saw:pine', count: 1, xp: 0 }], name, () => ({ specs: { 100: 'timberwright' } })), 'Refined first: plank:pine x3.');
  assert.equal(refinedText([{ id: 'ingot:iron', count: 100, xp: 1000, made: 100 }, { id: 'ingot:iron', count: 50, xp: 500, made: 50 }], name), 'Refined first: ingot:iron x150 (+1500 Smithing XP).');
  // the lenient pass's spare: one log short for two planks asked apart - not two
  assert.deepEqual(chainPlan([{ key: 'plank:pine', n: 1 }, { key: 'plank:pine', n: 1 }], heldOf({})).short, [{ key: 'log:pine', n: 1 }]);
});

test('CRAFT1 host: the world\'s craft says what its chain refined first - made or refused - and the four other stations\' pages offer the chain as the anvil does (source pins)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /const chain = \[refinedText\(r\?\.refined, materialLabel, \(prof\) => profBook\.track\(prof\)\), r\?\.ok \? '' : chainStopText\(r\?\.stopped, r\?\.material, materialLabel\)\]\.filter\(Boolean\)\.join\(' '\);/);
  assert.match(world, /text: r\?\.kept \? `\$\{st\.kept\}\$\{chain \? ` \$\{chain\}` : ''\}` : /, 'AUDIT CRAFT1 F3: a kept craft says what its chain refined');
  assert.match(world, /return \{ ok: true, text: `\$\{chain \? `\$\{chain\} ` : ''\}\$\{made\} \(\+\$\{r\.data\.xp\} \$\{st\.xp\} XP\)/);
  assert.match(world, /movedFirstText\(r\)\}\$\{chain \? ` \$\{chain\}` : ''\}` \};/);
  const pages = src('src/ui/profPages.js');
  for (const st of ['_anvil', '_bench', '_loom', '_mason', '_jewel']) assert.match(pages, new RegExp(`\\(craftable\\(r, held(, spends)?\\) \\|\\| chain\\?\\.ok === true\\) && !${st}\\.`), `${st} offers the chain`);
  assert.equal((pages.match(/const chain = chainNote\(box, el, p, book, /g) ?? []).length, 5, 'five boxes say it');
  const book = src('src/net/profBook.js');
  assert.match(book, /if \(r\?\.ok && carry && work && stay !== true\) r\.data\.put/);
});
