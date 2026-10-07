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
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank, WORK_RECIPES, SMELT_MAX, materialOf } from '../src/net/professionLaw.js';
import { recipeById } from '../src/net/recipeLaw.js';
import { chainPlan, chainWorks, chainNeeded, chainYield, refinedText, CHAIN_WORKS, CHAIN_DEPTH, producersOf } from '../src/net/chainLaw.js';
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
    spent: [{ key: 'metal:iron', n: 6 }, { key: 'log:pine', n: 3 }, { key: 'metal:copper', n: 1 }, { key: 'hide:rat', n: 2 }],
    short: [],
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

test('CRAFT1 law: what a chain refined, said - the products and each profession\'s XP; nothing said where nothing was refined', () => {
  const name = (k) => ({ 'ingot:iron': 'Iron Ingot', 'wood:charcoal': 'Charcoal', 'ingot:steel': 'Steel Ingot', 'leather:cured': 'Cured Leather' })[k] ?? k;
  assert.equal(refinedText([{ id: 'ingot:iron', count: 3, xp: 30 }, { id: 'burn:pine', count: 3, xp: 0 }, { id: 'ingot:steel', count: 3, xp: 60 }, { id: 'cure:rat', count: 1, xp: 0 }], name),
    'Refined first: Iron Ingot x3, Charcoal x3, Steel Ingot x3, Cured Leather x1 (+90 Smithing XP).');
  assert.equal(refinedText([{ id: 'saw:pine', count: 2, xp: 0 }], name), 'Refined first: plank:pine x4.');
  assert.equal(refinedText([], name), '');
  assert.equal(refinedText(undefined, name), '');
});

// ─── THE BOOK ────────────────────────────────────────────────────────

/** A stand-in door over a Stores map: works and crafts as the service answers them, `failAt` a work refused. */
function standIn(stores, { failAt = null } = {}) {
  const asked = [];
  const view = (k) => ({ material: k, own: stores.get(k) ?? 0, bought: 0 });
  return {
    asked,
    door: {
      account: () => 'acct-1',
      state: async () => ({ ok: true, data: { open: true, character: 'c', stores: [...stores].map(([k, n]) => ({ material: k, own: n, bought: 0 })), tracks: [{ profession: 'smithing', xp: xpForRank(10) }] } }),
      smelt: async (c, recipe, count, rid) => {
        asked.push(['smelt', recipe, count]);
        if (recipe === failAt) return { ok: false, error: 'prof-rate' };
        const w = WORK_RECIPES.find((x) => x.id === recipe);
        for (const i of w.inputs) stores.set(i.key, (stores.get(i.key) ?? 0) - i.n * count);
        stores.set(w.out, (stores.get(w.out) ?? 0) + w.per * count);
        return { ok: true, data: { recipe, count, own: w.per * count, bought: 0, xp: 10, stores: [w.out, ...w.inputs.map((i) => i.key)].map(view), track: null, rid } };
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
  assert.deepEqual(r.refined, [{ id: 'ingot:iron', count: 3, xp: 10 }, { id: 'burn:pine', count: 3, xp: 10 }, { id: 'ingot:steel', count: 3, xp: 10 }, { id: 'cure:rat', count: 1, xp: 10 }]);
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
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => ({ kind: 'home', fee: 0 }), smelt: async () => ({ ok: true, text: '' }),
    craft: async (recipe) => { crafted.push(recipe); return { ok: true, text: 'made' }; }, stock: async () => ({ ok: true, text: '' }), heatBand: () => 1,
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
  await press('Quick craft');
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

test('CRAFT1 host: the world\'s craft says what its chain refined first - made or refused - and the four other stations\' pages offer the chain as the anvil does (source pins)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /const chain = refinedText\(r\?\.refined, materialLabel, \(prof\) => profBook\.track\(prof\)\);/);
  assert.match(world, /return \{ ok: true, text: `\$\{chain \? `\$\{chain\} ` : ''\}\$\{made\} \(\+\$\{r\.data\.xp\} \$\{st\.xp\} XP\)/);
  assert.match(world, /movedFirstText\(r\)\}\$\{chain \? ` \$\{chain\}` : ''\}` \};/);
  const pages = src('src/ui/profPages.js');
  for (const st of ['_anvil', '_bench', '_loom', '_mason', '_jewel']) assert.match(pages, new RegExp(`\\(craftable\\(r, held(, spends)?\\) \\|\\| chain\\?\\.ok === true\\) && !${st}\\.`), `${st} offers the chain`);
  assert.equal((pages.match(/const chain = chainNote\(box, el, p, book, /g) ?? []).length, 5, 'five boxes say it');
  const book = src('src/net/profBook.js');
  assert.match(book, /if \(r\?\.ok && carry && work && stay !== true\) r\.data\.put/);
});
