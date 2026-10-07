// PROF1 (2026-09-28, Mac: "Begin!") - THE PROFESSIONS' CLIENT: the book (a harvest kept until answered and never
// counted twice, a lapse, a withdrawal minted once, a delivery's id kept across presses), the acts (the kneel, the
// steady hand's bruise, the Basket's search, Gentle acts), a material as DFU's own item - and the done-when, driven
// through the real Worker: AN HERB PICKED ONLINE REACHES DFU'S POTION MAKER BY THE PACK. Then the faces: the prompt's
// plan, the patches where nature stands, the toasts' law, the Stores page's rows, the Work tab on the minimal DOM, the
// shelves' online exception, the act choice key, and the four hosts' wiring. bible/06-Systems/Professions-Arc.md 22.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from './chargenDom.mjs';
import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook, PROF_QUEUE_MS, PROF_KEPT_KEY } from '../src/net/profBook.js';
import { herbPatches, nodeKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { herbKey, HERB_ACT, BASKET_ACT } from '../src/net/professionLaw.js';
import { createHerbAct } from '../src/systems/herbAct.js';
import { mintMaterialItem, materialLabel, materialCountLabel, withdrawIntoPack, foodTemplate } from '../src/systems/profItems.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { mixCauldron, POTION_RECIPES, isIngredient } from '../src/systems/potions.js';
import { patchPlan, standPatches, patchFlats, PATCH_FLATS } from '../src/scenes/herbHost.js';
import { createToastQueue, PROF_TOASTS_MAX, PROF_TOAST_S } from '../src/ui/profHud.js';
import { storesRows, xpLine, craftsAboveJourneyman } from '../src/ui/profPages.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { foragingCustomItemsForGroup } from '../src/systems/foragingInstall.js';
import { FORAGING_GROUP, TOOL_TEMPLATES, FORAGING_TEMPLATES, FT } from '../src/systems/foragingLaw.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { DEFAULT_BINDINGS, ACTION_GROUPS } from '../src/systems/inputActions.js';
import { natureStandsAt } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** The page as the lane reads it: `?online` on the URL (systems/onlineLane.js isOnlinePage) - empirebank.test.js's door. */
function online(fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: '?online=1' };
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
}
const tick = () => new Promise((r) => setImmediate(r));
const noWait = () => Promise.resolve();
const DAY = 86_400;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function noonOf(dayStart) {
  for (let s = dayStart + 3600; s < dayStart + 3 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
}
const NOON = noonOf(utcDay(T0) * DAY);
/** A storage as the browser's, in memory. */
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), _m: m }; };

// ─── THE BOOK ────────────────────────────────────────────────────────

test('PROF1 book: a harvest with no answer is KEPT under its account and character, asked again by the pump with the SAME id, and counted once; a refusal lets it go', async () => {
  let t = 1_000_000;
  const asked = [];
  let answer = { ok: false, error: 'offline' };
  const door = { account: () => 'acct-1', harvest: async (b) => { asked.push(b.rid); return answer; } };
  const storage = memStorage();
  let n = 0;
  const book = createProfBook({ door, storage, character: () => 'char-1', now: () => t, rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait });
  const r = await book.harvest({ node: 'herb:1:1:1:0', kind: 'herbs', climate: 231, region: 21, act: { clean: false, bruised: false }, at: 11 });
  assert.deepEqual([r.ok, r.kept], [false, true]);
  assert.equal(book.pendingHarvests, 1);
  assert.equal(book.counting('herb:1:1:1:0', 'herbs'), true, 'being counted: no second act on it');
  assert.ok(JSON.parse(storage.getItem(PROF_KEPT_KEY))['acct-1|char-1'].harvests.length === 1, 'kept in the storage, under its account and character');
  answer = { ok: true, data: { node: 'herb:1:1:1:0', kind: 'herbs', material: 'p1:9', qty: 2, xp: 15, track: { profession: 'herbalism', xp: 15, rank: 1 }, today: 1, store: { material: 'p1:9', own: 2, bought: 0 } } };
  const heard = [];
  assert.equal(book.pump((h, res) => heard.push(res)), null, 'not due yet');
  t += 60_000;
  await book.pump((h, res) => heard.push(res));
  assert.deepEqual(asked, ['prof-000001', 'prof-000001'], 'the same id - the service answers the harvest it made, never a second');
  assert.equal(heard.length, 1);
  assert.equal(book.pendingHarvests, 0);
  assert.equal(book.taken('herb:1:1:1:0', 'herbs'), true);
  assert.equal(book.held('p1:9'), 2);
  answer = { ok: false, error: 'node-taken' };
  const again = await book.harvest({ node: 'herb:1:1:1:1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 11 });
  assert.deepEqual(again, { ok: false, error: 'node-taken' });
  assert.equal(book.pendingHarvests, 0, 'the service looked and said no: let go');
});

test('PROF1 book: a kept harvest LAPSES after ten minutes, or when its UTC day ends - said, and let go (PROF0 19)', async () => {
  let t = utcDay(T0) * DAY * 1000 + 3_600_000;
  const door = { account: () => 'a', harvest: async () => ({ ok: false, error: 'offline' }) };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', now: () => t, sleep: noWait });
  await book.harvest({ node: 'herb:1:1:1:0', kind: 'herbs', climate: 231, region: 21, act: {}, at: Math.floor(t / 1000) });
  t += PROF_QUEUE_MS + 1;
  const heard = [];
  await book.pump((h, r) => heard.push(r.error));
  assert.deepEqual(heard, ['lapsed']);
  assert.equal(book.pendingHarvests, 0);
});

test('PROF1 book: a withdrawal whose answer is lost is kept and minted ONCE when it settles; a delivery\'s id is kept across presses until answered', async () => {
  let answer = { ok: false, error: 'offline' };
  const rids = [];
  const door = {
    account: () => 'a',
    withdraw: async (c, m, q, rid) => { rids.push(rid); return answer; },
    deliver: async (c, id, rid) => { rids.push(rid); return answer; },
  };
  let n = 0;
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait });
  const minted = [];
  const r = await book.withdraw('p1:19', 3, (k, q) => minted.push([k, q]));
  assert.equal(r.kept, true);
  assert.deepEqual(minted, []);
  answer = { ok: true, data: { material: 'p1:19', qty: 3, store: { material: 'p1:19', own: 1, bought: 0 } } };
  await book.settle((k, q) => minted.push([k, q]));
  await book.settle((k, q) => minted.push([k, q]));
  assert.deepEqual(minted, [['p1:19', 3]], 'minted once');
  assert.equal(new Set(rids).size, 1, 'one id through every try');
  rids.length = 0;
  answer = { ok: false, error: 'offline' };
  await book.deliver('c:1:21:0', 21);
  await book.deliver('c:1:21:0', 21);
  assert.equal(new Set(rids).size, 1, 'a press after a lost answer is the same delivery');
  answer = { ok: false, error: 'writ-taken' };
  await book.deliver('c:1:21:0', 21);
  await book.deliver('c:1:21:0', 21);
  assert.equal(new Set(rids).size, 2, 'answered, the next press is a new ask');
});

test('PROF1 book: the state is stale for another character or another UTC day; a closed switch reads open false; the pixels are asked once a day', async () => {
  let t = 1_000_000_000;
  let who = 'c1';
  let pixelAsks = 0;
  const door = {
    account: () => 'a',
    state: async (c) => ({ ok: true, data: { character: c, day: Math.floor(t / 86_400_000), tracks: [], today: {}, taken: [], stores: [], writs: { today: 0, max: 3 }, caps: {} } }),
    pixels: async (c, list) => { pixelAsks++; return { ok: true, data: { pixels: list.map(([x, y]) => ({ x, y, state: 'unconfirmed' })) } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => who, now: () => t, sleep: noWait });
  assert.equal(book.stale(), true);
  await book.refresh();
  assert.equal(book.stale(), false);
  who = 'c2';
  assert.equal(book.stale(), true, 'another character');
  await book.refresh();
  t += 86_400_000;
  assert.equal(book.stale(), true, 'another day');
  assert.equal((await book.askPixels([[1, 1], [2, 2]])).length, 2);
  assert.equal((await book.askPixels([[1, 1], [2, 2]])).length, 0);
  assert.equal(pixelAsks, 1, 'known today: not asked again');
  const shut = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: false, error: 'prof-closed' }) }, character: () => 'c', sleep: noWait });
  await shut.refresh();
  assert.equal(shut.state.open, false);
});

// ─── THE ACTS ────────────────────────────────────────────────────────

test('PROF1 acts: a common herb comes up by hand in 0.8 s, plain; the steady hand holds 2.5 s - let go early and it is cancelled, nothing lost', () => {
  const hand = createHerbAct({ kind: 'hand' });
  for (let i = 0; i < 7; i++) hand.tick(0.1);
  assert.equal(hand.state.done, false);
  hand.tick(0.11);
  assert.equal(hand.state.done, true);
  assert.deepEqual(hand.report(), { clean: false, bruised: false });
  const steady = createHerbAct({ kind: 'steady' });
  steady.tick(1, { held: true });
  steady.tick(0.1, { held: false });
  assert.equal(steady.state.cancelled, true);
  assert.equal(steady.report(), null, 'a cancelled act asks nothing');
  assert.equal(HERB_ACT.steadyS, 2.5);
});

test('PROF1 acts: the steady hand bruises past its window (3 degrees x the band x Botanist\'s 1.5) or a quarter metre moved; unbruised is clean; Gentle acts never bruise', () => {
  const run = (o, views) => {
    const a = createHerbAct({ kind: 'steady', ...o });
    for (const v of views) a.tick(0.25, { held: true, view: v.view ?? { yaw: 0, pitch: 0 }, pos: v.pos ?? { x: 0, z: 0 } });
    while (!a.state.done && !a.state.cancelled) a.tick(0.25, { held: true, view: views[views.length - 1].view ?? { yaw: 0, pitch: 0 }, pos: views[views.length - 1].pos ?? { x: 0, z: 0 } });
    return a.report();
  };
  assert.deepEqual(run({}, [{ view: { yaw: 0, pitch: 0 } }, { view: { yaw: 2.9, pitch: 0 } }]), { clean: true, bruised: false });
  assert.deepEqual(run({}, [{ view: { yaw: 0, pitch: 0 } }, { view: { yaw: 3.1, pitch: 0 } }]), { clean: false, bruised: true });
  assert.deepEqual(run({ botanist: true }, [{ view: { yaw: 0, pitch: 0 } }, { view: { yaw: 4.4, pitch: 0 } }]), { clean: true, bruised: false }, 'Botanist: 4.5 degrees');
  assert.deepEqual(run({ band: 1.3 }, [{ view: { yaw: 359, pitch: 0 } }, { view: { yaw: 2.8, pitch: 0 } }]), { clean: true, bruised: false }, 'the turn is the short way round, x the band');
  assert.deepEqual(run({}, [{ pos: { x: 0, z: 0 } }, { pos: { x: 0.3, z: 0 } }]), { clean: false, bruised: true }, 'a step bruises');
  assert.deepEqual(run({ gentle: true }, [{ view: { yaw: 0, pitch: 0 } }, { view: { yaw: 40, pitch: 0 } }]), { clean: false, bruised: false }, 'gentle: plain, whatever the hand does');
  const g = createHerbAct({ kind: 'steady', gentle: true });
  g.tick(0.1, { held: true, view: { yaw: 0, pitch: 0 } });
  g.tick(0.1, { held: true, view: { yaw: 90, pitch: 0 } });
  assert.equal(g.state.bruised, false, 'and the meter never says a bruise');
});

test('PROF1 acts: the Basket\'s search - three glints in turn, attack while each shows finds it; the report is the finds; Gentle acts search plainly', () => {
  const play = (o, pressWhenShowing) => {
    let seq = 0;
    const a = createHerbAct({ kind: 'basket', rng: () => ((seq++ * 0.37) % 1), ...o });
    let guard = 0;
    while (!a.state.done && guard++ < 1000) {
      const showing = a.state.spot >= 0;
      a.tick(0.05, { attack: showing && pressWhenShowing(a.state.find) });
    }
    return a.report();
  };
  assert.deepEqual(play({}, () => true), { finds: 3 });
  assert.deepEqual(play({}, (i) => i !== 1), { finds: 2 });
  assert.deepEqual(play({}, () => false), { finds: 0 });
  assert.deepEqual(play({ gentle: true }, () => true), { finds: 0 });
  assert.equal(BASKET_ACT.finds, 3);
});

// ─── THE ITEMS, AND THE DONE-WHEN ────────────────────────────────────

test('PROF1 items: an herb withdrawn is DFU\'s own plant in its group - named as DFU names it, an ingredient; a Basket food the template Foraging would make now', () => {
  const rose = mintMaterialItem('p1:19');
  assert.deepEqual([rose.group, rose.templateIndex, rose.name], ['PlantIngredients1', 19, 'Red Rose']);
  assert.equal(templateByIndex(19).isIngredient, true);
  assert.equal(materialLabel('p1:8'), 'Twigs (northern)');
  assert.equal(materialLabel('p2:8'), 'Twigs (southern)');
  assert.deepEqual([materialCountLabel('p1:19', 3), materialCountLabel('p1:19', 1), materialCountLabel('p2:32', 2), materialCountLabel('p1:8', 5)], ['Red Roses', 'Red Rose', 'Cacti', 'Twigs (northern)']);
  assert.deepEqual([foodTemplate('food:apple', true), foodTemplate('food:apple', false), foodTemplate('food:orange', true), foodTemplate('food:egg', true), foodTemplate('food:mushroom', false)], [532, FT.Apple, 533, FT.Egg, FT.Mushroom]);
  const e = { items: [] };
  assert.equal(withdrawIntoPack(e, 'p1:19', 4), 4);
  assert.equal(e.items.length, 1, 'DFU\'s AddItem stacks an ingredient');
  assert.equal(e.items[0].stackCount, 4);
  assert.equal(withdrawIntoPack(e, 'nothing', 2), 0);
});

test('PROF1 DONE WHEN: an herb picked online reaches DFU\'s potion maker by the pack - harvested through the real Worker, withdrawn, minted, and mixed by DFU\'s own recipe law', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const mac = await s.registered('Mac');
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  // a Swamp pixel's common herb (winter at T0: Green Leaves, Root Tendrils or Root Bulb grow)
  const day = utcDayOfMs(NOON * 1000);
  let hit = null;
  for (let x = 300; x < 700 && !hit; x++) {
    const p = herbPatches({ x, y: 210, day, climate: 228, confirmed: false }).find((q) => q.tier === 1 && q.herb === 9);
    if (p) hit = { x, p };
  }
  assert.ok(hit, 'a Green Leaves patch');
  const node = nodeKey({ kind: 'herb', x: hit.x, y: 210, day, slot: hit.p.slot });
  const r = await book.harvest({ node, kind: 'herbs', climate: 228, region: 20, act: { clean: false, bruised: false }, at: NOON - 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const key = herbKey(9, 20);
  assert.equal(key, 'p2:9', 'Sentinel is Redguard ground: southern Green Leaves');
  const pack = { items: [] };
  const w = await book.withdraw(key, 1, (k, n) => withdrawIntoPack(pack, k, n));
  assert.equal(w.ok, true);
  const leaves = pack.items[0];
  assert.deepEqual([leaves.group, leaves.templateIndex], ['PlantIngredients2', 9]);
  assert.equal(isIngredient(leaves), true, 'the potion maker lists it among its ingredients (ItemHelper.IsIngredient)');
  const chameleon = POTION_RECIPES.find((p) => p.name === 'chameleonForm');
  assert.ok(chameleon.ingredients.includes(leaves.templateIndex));
  const mixed = mixCauldron([leaves.templateIndex, 11, 16, 60, 63]);
  assert.deepEqual([mixed.kind, mixed.recipe?.name], ['mixed', 'chameleonForm'], 'DFU\'s own recipe takes the picked leaf');
});

// ─── THE FACES ───────────────────────────────────────────────────────

test('PROF1 faces: the prompt\'s plan - the herbs first while untaken, the Basket by the choice key; what a patch needs said (rank, Sickle, Basket, the Stores - CAP-OFF: never the day)', () => {
  const base = { patch: { key: 'k', herb: 19, tier: 2 }, taken: () => false, counting: () => false, basket: false, rank: 10, sickle: true, basketTool: true, storesFull: () => false, herbKeyOf: (h) => `p1:${h}` };
  assert.deepEqual(patchPlan(base), { kind: 'herbs', verb: 'Pick Red Rose', rest: 'Herbalism 10', ready: true, both: true });
  assert.equal(patchPlan({ ...base, rank: 9 }).rest, 'needs Herbalism 10');
  assert.equal(patchPlan({ ...base, sickle: false }).rest, 'needs a Sickle');
  assert.equal(patchPlan({ ...base, patch: { key: 'k', herb: 9, tier: 1 }, sickle: false }).ready, true, 'a common herb comes up by hand');
  assert.equal(patchPlan({ ...base, storesFull: () => true }).rest, 'Stores full - Red Rose');
  assert.deepEqual([patchPlan({ ...base, basket: true }).kind, patchPlan({ ...base, basket: true }).verb], ['food', 'Search with the Basket']);
  assert.equal(patchPlan({ ...base, basket: true, basketTool: false }).rest, 'needs a Basket');
  assert.equal(patchPlan({ ...base, taken: (k) => k === 'herbs' }).kind, 'food', 'herbs taken: E searches');
  assert.equal(patchPlan({ ...base, taken: () => true }).ready, false);
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): the day's sixty spent was no ready plan
  assert.equal(patchPlan({ ...base, today: 600, cap: 60 }).ready, true, 'a day past the old sixty: ready');
  assert.equal(patchPlan({ ...base, basket: true, today: 600, cap: 60 }).ready, true, 'and the Basket\'s');
});

test('PROF1 faces: a patch stands where DFU\'s nature would - on grass, not water, not a cliff, never in a town; a cluster of five of the herb\'s own flats', () => {
  const hDim = HEIGHTMAP_DIMENSION;
  const flat = new Float32Array(hDim * hDim).fill(0.5);
  const grass = new Uint8Array(128 * 128).fill(2);
  assert.ok(natureStandsAt(flat, grass, null, 10, 10));
  const water = new Uint8Array(128 * 128).fill(0);
  assert.equal(natureStandsAt(flat, water, null, 10, 10), null, 'water');
  assert.equal(natureStandsAt(flat, grass, { xMin: 20, xMax: 40, yMin: 20, yMax: 40 }, 18, 30), null, 'the town, widened by four');
  assert.ok(natureStandsAt(flat, grass, { xMin: 20, xMax: 40, yMin: 20, yMax: 40 }, 15, 30));
  const low = new Float32Array(hDim * hDim).fill(0);
  assert.equal(natureStandsAt(low, grass, null, 10, 10), null, 'under the beach line');
  const cliff = new Float32Array(hDim * hDim).map((_, i) => ((Math.floor(i / hDim) % 2) ? 1 : 0));
  assert.equal(natureStandsAt(cliff, grass, null, 10, 10), null, 'too steep');
  const stood = standPatches({ px: 400, py: 200, day: 20000, climate: 231, samples: flat, tilemap: grass });
  assert.equal(stood.length, 8, 'Woodlands: eight (PIN MOVED, MORE-NODES)');
  assert.equal(patchFlats(stood[0]).length, PATCH_FLATS);
  assert.deepEqual(standPatches({ px: 400, py: 200, day: 20000, climate: 223, samples: flat, tilemap: grass }), [], 'the sea stands none');
});

test('PROF1 faces: the toasts - four at most, three seconds each (PROF0 8); the Stores page\'s rows filter, search and sort; the XP line; the crafter\'s limit', () => {
  const q = createToastQueue();
  for (const w of ['a', 'b', 'c', 'd', 'e']) q.push(w);
  assert.deepEqual(q.lines.map((l) => l.text), ['b', 'c', 'd', 'e']);
  assert.equal(PROF_TOASTS_MAX, 4);
  q.tick(PROF_TOAST_S - 0.01);
  assert.equal(q.lines.length, 4);
  q.tick(0.02);
  assert.equal(q.lines.length, 0);
  const stores = new Map([['p1:19', { material: 'p1:19', own: 3, bought: 0 }], ['p1:9', { material: 'p1:9', own: 10, bought: 2 }], ['food:egg', { material: 'food:egg', own: 1, bought: 0 }]]);
  const nameOf = (k) => materialLabel(k, false);
  assert.deepEqual(storesRows(stores, {}, nameOf).map((r) => r.name), ['Egg', 'Green Leaves (northern)', 'Red Rose'], 'by tier, then name');
  assert.deepEqual(storesRows(stores, { family: 'food' }, nameOf).map((r) => r.name), ['Egg']);
  assert.deepEqual(storesRows(stores, { query: 'rose' }, nameOf).map((r) => r.name), ['Red Rose']);
  assert.deepEqual(storesRows(stores, { sort: 'count' }, nameOf).map((r) => r.total), [12, 3, 1]);
  assert.equal(xpLine({ xp: 11900, rank: 34 }), '11,900 / 12,250 XP');
  assert.equal(xpLine({ xp: 100000, rank: 100 }), '100,000 XP - Master');
  assert.equal(craftsAboveJourneyman(new Map([['smithing', { rank: 51 }], ['alchemy', { rank: 50 }], ['herbalism', { rank: 90 }]])), 1, 'only a craft above 50 counts; gathering is unlimited');
});

test('PROF1 faces: THE WORK TAB - the region\'s Court writs under the Court\'s seal, Take only with the Stores to fill it, the day\'s count; a Take fills it (MODAL CONTRACT: one board, two tabs)', async () => {
  const writs = [
    { id: 'c:1:21:0', material: 'p1:19', tier: 2, qty: 30, pay: 72, renown: 150, expiresAt: 2_000_000_000, state: 'open' },
    { id: 'c:1:21:1', material: 'p1:9', tier: 1, qty: 20, pay: 24, renown: 50, expiresAt: 2_000_000_000, state: 'taken' },
  ];
  const delivered = [];
  const book = {
    state: { open: true, writs: { today: 0, max: 3 } },
    held: (k) => (k === 'p1:19' ? 34 : 0),
    writs: async () => ({ data: { writs, today: { filled: 0, max: 3 } }, error: null, stale: false }),
    deliver: async (id) => { delivered.push(id); return { ok: true, data: { pay: 72, today: { filled: 1, max: 3 } } }; },
  };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book, region: 21, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), onTaken: () => 'Writ filled: 72 silver.' } });
  await tick();
  const tabs = byClass(host, 'notice-tab');
  assert.deepEqual(tabs.map((t) => t.textContent), ['Notices', 'Work']);
  tabs[1].click();
  for (let i = 0; i < 3; i++) await tick();
  const cards = byClass(host, 'notice-writ');
  assert.equal(cards.length, 2);
  assert.ok(cards[0].className.includes('seal-court'));
  assert.match(cards[0].textContent, /The Court of Anticlere needs 30 Red Roses/);
  assert.match(cards[0].textContent, /Pays 72 silver, 150 Renown/);
  assert.match(cards[0].textContent, /34 in your Stores/);
  assert.match(cards[1].textContent, /Filled by another/);
  assert.equal(byClass(cards[1], 'notice-take').length, 0, 'a taken writ has no Take');
  assert.match(host.textContent, /Court writs today: 0 of 3/);
  byClass(cards[0], 'notice-take')[0].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(delivered, ['c:1:21:0']);
  assert.match(host.textContent, /Writ filled: 72 silver\./);
  assert.match(byClass(host, 'notice-writ')[0].textContent, /Taken by you/);
  v.unmount();
  const short = { ...book, held: () => 12 };
  const v2 = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: { book: short, region: 21, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n) } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.equal(byClass(host, 'notice-take')[0].disabled, true, 'the Stores hold 12 of 30');
  v2.unmount();
  const v3 = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, work: null });
  await tick();
  assert.deepEqual(byClass(host, 'notice-tab').map((t) => t.textContent), ['Notices'], 'no professions: no Work tab - no door painted on a wall');
  v3.unmount();
});

test('PROF1 FORAGE0 law 6\'s exception: online, the six tools shelve whatever Foraging\'s switch says - the foods stay the switch\'s; offline and off, nothing', () => {
  _resetModSettings();
  const all = FORAGING_TEMPLATES.map((t) => t.index);
  assert.deepEqual(foragingCustomItemsForGroup(FORAGING_GROUP), all, 'on: the twelve');
  setModSetting('foraging', 'Enabled', false);
  assert.deepEqual(foragingCustomItemsForGroup(FORAGING_GROUP), [], 'off, offline: none');
  online(() => {
    assert.deepEqual(foragingCustomItemsForGroup(FORAGING_GROUP), [...TOOL_TEMPLATES], 'off, online: the six tools');
    assert.deepEqual(foragingCustomItemsForGroup('Weapons'), []);
  });
  _resetModSettings();
  online(() => assert.deepEqual(foragingCustomItemsForGroup(FORAGING_GROUP), all, 'on, online: the twelve'));
});

test('PROF1 keys and hosts: the act choice is KB1\'s, on ;, in a Professions group; the streaming world wires the patches, the press, Escape and the swing; the fixed city and the dungeons stand none (FLAGGED)', () => {
  assert.ok(DEFAULT_BINDINGS.some(([c, a]) => c === 'ArrowUp' && a === 'ActChoice'), 'on the up arrow - `=` is the decorator\'s, `;` Come Sail Away\'s lantern (THE MERGE)');
  assert.deepEqual(ACTION_GROUPS.find((g) => g.title === 'Professions')?.rows.map((r) => r.action), ['ActChoice', 'Professions'], 'CLASSIC-PAGES: the Professions key beside it');
  const w = src('src/scenes/world.js');
  // PROF2: the herb host became the one gathering host (src/scenes/gatherHost.js) - Herbalism a kind in it
  assert.match(w, /gatherHost\?\.onBuilt\(built\.get\(key\)\);/);
  assert.match(w, /gatherHost\?\.onDestroyed\(p\);[^\n]*\n\s*for \(const b of p\.batches\) renderer\.destroyBatch\(b\);/, 'forgotten before the pixel frees its batches');
  // PIN MOVED (AUDIT 2026-10-01 part four, CLICK-LIFT): the act's click asked before the ladder, and held to its release;
  // NAVAL-E: the sea's E asked before a node's
  assert.match(w, /const nodeTook = useEdge && (?:!_holdFire && )?!modes\.transitioning && (?:!naval\?\.takesActivate\?\.\(\) && )?\(gatherHost\?\.press\(\) \?\? false\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const _actClick = gatherHost\?\.clickTaken\(_activateDown\) \?\? false;\n(?:\s*\/\/[^\n]*\n|\s*const nodeClicked = [^\n]*\n)*\s*if \(\(\(_act\.activate && !gatherHost\?\.acting\(\) && !_actClick(?: && !nodeClicked)?\) \|\| \(useEdge && !nodeTook\)\) && !modes\.transitioning(?: && !_holdFire)?\) \{/, 'AUDIT 32 H5: nor a click through an act');   // PROF-MENU: a node's lit row's click between   // PIN MOVED (AUDIT HERB-CURSOR B2): the act's click asked before the node's   // PIN MOVED (AUDIT NAV2 F31): E that held fire is spent - no patch takes it
  assert.match(w, /if \(!townTalk\.overlayActive && act === 'Escape' && gatherHost\?\.cancel\(\)\) \{ e\.preventDefault\(\); e\.profActEnded = true; return true; \}/);
  assert.match(w, /actTool: \(\) => gatherHost\?\.handTool\(\) \?\? null,/);
  assert.equal((w.match(/gatherHost\?\.acting\(\)/g) ?? []).length, 9, 'the mouse, the drag, the key and the finger never swing through an act - the dungeon\'s swing asks it (PROF2), the street\'s readied spell (AUDIT 29 D2), a click never activates through one (AUDIT 32 H5), and a tap mid-act is its strike (ACT-TOUCH, FIELD BUGS 2026-10-01)');   // PIN MOVED (ACT-TOUCH): the tap's   // PROF-MENU: 9 - and a node's lit row's click, never mid-act
  assert.equal((w.match(/gatherHost\?\.tick\(dt\)/g) ?? []).length, 2, 'the street\'s frame and the modal one');
  assert.doesNotMatch(src('src/scenes/exterior.js'), /gatherHost|herbHost|createProfBook/, 'the fixed city: no wilderness, no nodes (PROF0 17.1)');
  assert.doesNotMatch(src('src/scenes/dungeonContext.js'), /herbHost|herbKind/, 'the dungeons: no herbs (their veins are PROF2\'s)');
  const rig = src('src/combat/weaponRig.js');
  assert.match(rig, /const tool = c && !paralyzed && !fpArm\.active\(\) && !eotbHidesWeapon\(\) \? actTool\(\) : null;/);
  assert.ok(rig.indexOf('actTool()') < rig.indexOf('const torchOnly ='), 'above every sheathe gate');
  assert.equal(accountRefusalText('writ-cap'), 'You have filled 3 Court writs today - the most a day allows.');
});
