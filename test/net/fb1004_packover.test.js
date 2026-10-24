// PACK-OVER (FIELD BUGS 2026-10-04): "People are doing gathering without a crafting bag and they're not seeing the
// materials in their inventory". A carried harvest (BAG1) was minted into the bag, then the pack up to its weight, and
// the rest was "left where it was gathered" - counted carried by the service and never made. A DFU pack is carried to
// its limit, and a character with no Materials Bag has nothing else, so it gathered goods it never saw. Every unit the
// service counts is minted now: the bag, the pack, then the pack past its weight - the hands' `give` (giveCarried), B5's
// law for a withdrawal and the Foraging mod's own AddItem (bible/01-Overview/bugs/Field-Bugs-2026-10-04.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../../src/systems/professions/profTemplates.js';
import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { BAG_TEMPLATE, BAG_KG_LIMIT, BAG_WORDS, goodsWhere } from '../../src/net/bagLaw.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf, bagWeight } from '../../src/systems/materialsBag.js';
import { mintMaterialItem, materialCountLabel } from '../../src/systems/professions/profItems.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { carriedWeight } from '../../src/systems/inventory.js';
import { entityMaxEncumbrance } from '../../src/combat/formulas.js';
import { harvestHauls } from '../../src/ui/haulCards.js';
import { storesLine, OVER_SAID_MS } from '../../src/scenes/gatherHost.js';
import { herbPatches, nodeKey } from '../../src/net/nodeLaw.js';
import { herbKey } from '../../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { utcDay } from '../../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const bagItem = () => setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE });
const OAK = 'log:oak';        // 2 kg a log
const STONE = 'stone:rough';  // 3 kg - the load, a material the harvests here are not
const HERB = 'p1:9';          // 0.25 kg
const RUBY = 'gem:ruby';      // 0.25 kg
const stack = (key, n) => { const it = mintMaterialItem(key); it.stackCount = n; return it; };
/** A character of strength 50 - a 75 kg pack - carrying `packKg` of stone (a multiple of 3), with a bag holding
 *  `bagKg` of stone, or no bag. */
const body = ({ packKg = 0, bag = false, bagKg = 0 } = {}) => ({
  stats: { strength: 50 }, goldPieces: 0,
  items: [...(packKg ? [stack(STONE, packKg / 3)] : []), ...(bag ? [bagItem()] : [])],
  bagItems: bagKg ? [stack(STONE, bagKg / 3)] : [],
});
/** The host's hands on an entity, as scenes/world.js builds them (its `give` is giveCarried - pinned by BAG1's wired test). */
const hands = (e) => ({
  held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
  take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
  stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
});
/** A book over a door that answers one carried harvest with `data`. */
const bookAnswering = (e, data, carry = hands(e)) => createProfBook({
  door: { account: () => 'a', harvest: async () => ({ ok: true, data: { carry: true, ...data } }) },
  storage: memStorage(), character: () => 'c', sleep: noWait, carry,
});
const ask = (book, material) => book.harvest({ node: 'n', kind: 'logs', climate: 231, region: 21, act: {}, at: 1, material });

test('PACK-OVER: a carried harvest into a pack with room for one log mints all four - one under the weight, three past it - and none is left where it was gathered (mutants: minted through `mint`; `over` counted as left; `over` unsummed)', async () => {
  const e = body({ packKg: 72 });
  assert.deepEqual([carriedWeight(e), entityMaxEncumbrance(e), roomFor(e, OAK)], [72, 75, 1], 'a pack 3 kg short of its limit: room for one log');
  const r = await ask(bookAnswering(e, { material: OAK, qty: 4, carried: { material: OAK, own: 4, bought: 0 } }), OAK);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.data.put, { bag: 0, pack: 1, over: 3, left: 0, lost: [] });
  assert.equal(heldOf(e, OAK), 4, 'every log the service counted is in the pack');
  assert.equal(carriedWeight(e), 80, 'the pack past its weight, as a withdrawal\'s overflow is');
  assert.equal(e.bagItems.length, 0, 'no bag, nothing into its list');
});

test('PACK-OVER: with a bag, the bag first, the pack next, then the pack past its weight - a gem beside the logs the same (mutants: minted through `mint`; `over` unsummed)', async () => {
  const e = body({ packKg: 72, bag: true, bagKg: 297 });
  assert.deepEqual([bagWeight(e), BAG_KG_LIMIT, roomFor(e, OAK)], [297, 300, 2], 'one log fits the bag, one the pack');
  const r = await ask(bookAnswering(e, { material: OAK, qty: 5, gem: RUBY, carried: { material: OAK, own: 5, bought: 0 } }), OAK);
  assert.equal(r.ok, true, JSON.stringify(r));
  // the ruby (0.25 kg) fits the bag's last kilo after its one log: 1 + 1 into the bag, 1 log into the pack, 3 over
  assert.deepEqual(r.data.put, { bag: 2, pack: 1, over: 3, left: 0, lost: [] });
  assert.deepEqual([heldOf(e, OAK), heldOf(e, RUBY)], [5, 1]);
});

test('PACK-OVER: hands with no `give` (an older host\'s shape) still mint through `mint`, and what it could not make is still named, each by its own (mutants: `over` counted as left)', async () => {
  const e = body({ packKg: 72 });
  const { give, ...older } = hands(e);
  assert.equal(typeof give, 'function');
  const r = await ask(bookAnswering(e, { material: OAK, qty: 4, carried: { material: OAK, own: 4, bought: 0 } }, older), OAK);
  assert.deepEqual(r.data.put, { bag: 0, pack: 1, over: 0, left: 3, lost: [{ key: OAK, n: 3 }] });
});

// ─── THROUGH THE REAL WORKER ────────────────────────────────────────

const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}

test('PACK-OVER done when: a character with no bag and a pack at its limit gathers herbs through the real Worker - every herb the service counted is in the pack, the service\'s carried count is exactly what the pack holds, and they go into the Stores from there (mutants: minted through `mint`)', async () => {
  const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
  const realNow = Date.now;
  Date.now = () => NOON * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
    const mac = await s.seated('Mac');
    const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
    const e = body({ packKg: 75 });
    assert.equal(carriedWeight(e), entityMaxEncumbrance(e), 'the pack at its limit');
    const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait, carry: hands(e) });
    assert.equal((await book.refresh()).ok, true);
    let patch = null;
    for (let x = 300; x < 700 && !patch; x++) {
      const p = herbPatches({ x, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false }).find((q) => q.tier === 1);
      if (p) patch = { x, y: 200, ...p };
    }
    const r = await book.harvest({
      node: nodeKey({ kind: 'herb', x: patch.x, y: patch.y, day: utcDay(NOON), slot: patch.slot }), kind: 'herbs', climate: WOODS, region: ANTICLERE,
      act: { clean: false, bruised: false }, at: NOON - 2, material: herbKey(patch.herb, ANTICLERE),
    });
    assert.equal(r.ok, true, JSON.stringify(r));
    const k = r.data.material, n = r.data.qty;
    assert.ok(n > 0);
    assert.deepEqual(r.data.put, { bag: 0, pack: 0, over: n, left: 0, lost: [] }, 'all of it past the pack\'s weight - none lost');
    assert.equal(heldOf(e, k), n, 'in the inventory');
    assert.equal(book.carried(k).own, n, 'the service counted what the pack holds - no unit counted and never made');
    const d = await book.deposit(k, n);
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.deepEqual([book.storesHeld(k), heldOf(e, k)], [n, 0], 'into the Stores from the pack');
  } finally { Date.now = realNow; }
});

// ─── THE WORDS ──────────────────────────────────────────────────────

test('PACK-OVER the words: goods past the pack\'s weight are the pack\'s, and the line says the pack is over its weight; the haul card counts them all and the enhanced skin says the weight beside it (mutants: `over` not the pack\'s; the weight unsaid; the toast unsaid)', () => {
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 1, over: 3, left: 0 } }), 'to your pack - your pack is over its weight');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 0, over: 3, left: 0 } }), 'to your pack - your pack is over its weight');
  assert.equal(goodsWhere({ carry: true, put: { bag: 2, pack: 0, over: 1, left: 0 } }), 'to your bag and pack - your pack is over its weight');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 2, over: 0, left: 0 } }), 'to your pack', 'under the weight, as before');
  assert.equal(goodsWhere({ carry: true, put: { bag: 2, pack: 0, left: 0 } }), 'to your bag', 'a put with no `over`, as before');
  const d = { carry: true, material: OAK, qty: 4, xp: 2, carried: { material: OAK, own: 4, bought: 0 }, track: { profession: 'logging', xp: 2, rank: 0 }, put: { bag: 0, pack: 0, over: 4, left: 0, lost: [] } };
  assert.equal(storesLine(d), `+4 ${materialCountLabel(OAK, 4)} to your pack - your pack is over its weight`);
  assert.equal(harvestHauls(d)[0].count, 4, 'the card counts what came - all of it');
  assert.equal(BAG_WORDS.overWeight, 'Your pack is over its weight. Put materials in your Stores in any town, or carry them in a Materials Bag.');
});

// ─── THE AUDIT ──────────────────────────────────────────────────────

test('AUDIT PACK-OVER A: what goes past the pack\'s weight is minted as the pack\'s own - a Butcher\'s meat slow to rot and a Provisioner\'s food never rotting, and the Basket\'s food by Climates & Calories as asked (mutants: the overflow\'s rot words dropped; its C&C forced)', () => {
  const meat = body({ packKg: 75 });
  assert.deepEqual(giveCarried(meat, 'food:meat', 3, { slowRot: true, noRot: true }), { bag: 0, pack: 0, over: 3 });
  const over = meat.items.filter((it) => it.templateIndex === mintMaterialItem('food:meat').templateIndex);
  assert.ok(over.length >= 1 && over.every((it) => it.slowRot === true && it.noRot === true), 'every unit past the weight keeps both');
  for (const cc of [true, false]) {
    const e = body({ packKg: 75 });
    assert.equal(giveCarried(e, 'food:apple', 2, { cc }).over, 2);
    const want = mintMaterialItem('food:apple', cc).templateIndex;
    assert.ok(e.items.some((it) => it.templateIndex === want), `C&C ${cc ? 'on' : 'off'}: template ${want}`);
  }
  assert.notEqual(mintMaterialItem('food:apple', true).templateIndex, mintMaterialItem('food:apple', false).templateIndex, 'the two skins differ');
});

test('AUDIT PACK-OVER B/C: the world\'s hands save a harvest that went wholly past the weight - its only change is `over`; and the over-weight line is said once in ten seconds, not once an answer (by source; mutants: `over` uncounted for the save; the line every answer)', () => {
  assert.match(src('src/scenes/world.js'), /give: \(key, n\) => \{ const got = giveCarried\(playerEntity, key, n, carryOpts\(key\)\); if \(got\.bag \+ got\.pack \+ got\.over > 0\) saveSoon\.changed\(\); return got; \},/);
  assert.equal(OVER_SAID_MS, 10_000);
  assert.match(src('src/scenes/gatherHost.js'), /if \(hauled && d\.carry === true && \(d\.put\?\.over \?\? 0\) > 0 && deps\.nowMs\(\) - overSaidAt >= OVER_SAID_MS\) \{ overSaidAt = deps\.nowMs\(\); hud\.toast\(BAG_WORDS\.overWeight\); \}/);
});
