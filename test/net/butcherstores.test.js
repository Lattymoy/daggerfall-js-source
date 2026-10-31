// BUTCHER-STORES (FIELD FEEDBACK 2026-10-31; Sammy, Discord #feature-feedback: "The game should not add meat to your
// inventory when you skin animals.") - a carried body's butchery lands in the Stores, never the bag or the pack: the
// service writes it to prof_stores for a client that asks it so (`butcheryStores`), keeps that on the row
// (node_harvests.extra_stores, migration 0203) and answers no `extraCarried` for it, and the client mints only the
// second finds the answer counts carried (net/bagLaw.js extraStored). An older client is carried as before; a new
// client against an older service mints what that service counted. A tree's Resin keeps its path. Through the real
// Worker. bible/06-Systems/Professions-Arc.md section 60.
import '../../src/systems/professions/profTemplates.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { bodyKey, trees, nodeKey } from '../../src/net/nodeLaw.js';
import { xpForRank, STORES_MAX } from '../../src/net/professionLaw.js';
import { extraStored, CARRIED_MAX } from '../../src/net/bagLaw.js';
import { createProfBook } from '../../src/net/profBook.js';
import { heldOf, roomFor, mintCarried, takeCarried, giveCarried, bagTakesOf } from '../../src/systems/materialsBag.js';
import { BAG_TEMPLATE } from '../../src/net/bagLaw.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { storesLine } from '../../src/scenes/gatherHost.js';
import { harvestHauls } from '../../src/ui/haulCards.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { utcDay } from '../../src/net/marksLaw.js';

const DAY = 86_400;
const WOODS = 231, GLENUMBRA = 59;
const BEAR = 4;   // MobileTypes.GrizzlyBear: the Bear Hide, a Big Tooth, Raw Meat
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0, _body = 0;
const rid = () => `butcher-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice at their lowest while `fn` runs - the Big Tooth, one Raw Meat, a tree's Resin. */
async function low(fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(0), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const rows = (t, m) => raw.prepare(`SELECT origin, qty FROM ${t} WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin`).all(mac.id, mac.character, m).map((r) => [r.origin, Number(r.qty)]);
  const setXp = (prof, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec100, updated_at) VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec100 = excluded.spec100`).run(mac.id, mac.character, prof, xpForRank(prof === 'hunting' && spec100 ? 100 : 10), spec100);
  const give = (t, m, qty) => raw.prepare(`INSERT INTO ${t} (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  const skin = (extra = {}) => ({ character: mac.character, node: bodyKey({ day: utcDay(NOON), id: (++_body).toString(16).padStart(12, '0') }), kind: 'hide', foe: BEAR,
    act: { clean: false, torn: false }, at: NOON - 2, rid: rid(), ...extra });
  const harvest = (b) => low(() => s.call('/v1/prof/harvest', b, mac.secret));
  return { s, raw, mac, rows, setXp, give, skin, harvest, stores: (m) => rows('prof_stores', m), carried: (m) => rows('prof_carried', m) };
}
const CARRY = { carry: true, held: 0, heldKey: 'hide:bear' };

test('BUTCHER-STORES service: a carried body\'s butchery into the Stores - the hide and the part carried, the meat the Stores\', its row saying so and no carried count answered; a Butcher\'s two; asked again, the same; the Stores full, none (mutants: the meat carried again; the row unmarked; extraCarried answered; the room read off the carried count)', async () => {
  const t = await stand();
  t.setXp('hunting');
  const one = t.skin({ ...CARRY, butcheryStores: true });
  const r = await t.harvest(one);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.carry, r.body.material, r.body.gem, r.body.extra, r.body.extraQty], [true, 'hide:bear', 'part:tooth', 'food:meat', 1]);
  assert.deepEqual([r.body.carried?.own, r.body.gemCarried?.own, 'extraCarried' in r.body, r.body.extraStore], [1, 1, false, { material: 'food:meat', own: 1, bought: 0 }]);
  assert.deepEqual([t.carried('hide:bear'), t.carried('part:tooth'), t.carried('food:meat'), t.stores('food:meat'), t.stores('hide:bear')],
    [[['own', 1]], [['own', 1]], [], [['own', 1]], []], 'the hide and the tooth carried, the meat in the Stores');
  assert.equal(extraStored(r.body), true);
  const row = t.raw.prepare('SELECT carry, extra, extra_stores FROM node_harvests WHERE rid = ?').get(one.rid);
  assert.deepEqual([Number(row.carry), row.extra, Number(row.extra_stores)], [1, 'food:meat', 1]);
  // asked again: the row's answer, nothing moved twice
  const body = t.skin({ ...CARRY, butcheryStores: true });
  const first = await t.harvest(body);
  const again = await t.harvest(body);
  assert.deepEqual([again.body.repeat, 'extraCarried' in again.body, again.body.extraStore.own, first.body.extraStore.own], [true, false, 2, 2]);
  assert.deepEqual(t.stores('food:meat'), [['own', 2]]);
  // a Butcher's two, both into the Stores
  t.setXp('hunting', 'butcher');
  const b = await t.harvest(t.skin({ ...CARRY, butcheryStores: true }));
  assert.deepEqual([b.body.extraQty, b.body.extraStore.own, t.carried('food:meat')], [2, 4, []]);
  // the room is the Stores': a full carried count of meat stops nothing, full Stores keep none
  t.give('prof_carried', 'food:meat', CARRIED_MAX);
  const fullBag = await t.harvest(t.skin({ ...CARRY, butcheryStores: true }));
  assert.deepEqual([fullBag.body.extra, fullBag.body.extraStore.own], ['food:meat', 6], 'the bag\'s count is not the Stores\'');
  t.give('prof_stores', 'food:meat', STORES_MAX);
  const full = await t.harvest(t.skin({ ...CARRY, butcheryStores: true }));
  assert.deepEqual([full.status, full.body.material, full.body.extra ?? null, t.stores('food:meat')], [200, 'hide:bear', null, [['own', STORES_MAX]]], 'the Stores full: no meat, the hide still carried');
});

test('BUTCHER-STORES service, both sides sound: an older client (no `butcheryStores`) carries its meat and is answered its count, as before; asked again by a newer one, the row\'s word stands; a harvest not carried keeps all to the Stores; a tree\'s Resin is carried whatever the client asks (mutants: the flag not scoped to bodies; the row ignored on a repeat)', async () => {
  const t = await stand();
  t.setXp('hunting');
  const old = t.skin({ ...CARRY });
  const r = await t.harvest(old);
  assert.deepEqual([r.body.extra, r.body.extraCarried?.own, t.carried('food:meat'), t.stores('food:meat')], ['food:meat', 1, [['own', 1]], []], 'an older client: carried and counted');
  assert.equal(extraStored(r.body), false, 'so its client mints it');
  const asked = await t.harvest({ ...old, butcheryStores: true });
  assert.deepEqual([asked.body.repeat, asked.body.extraCarried?.own, t.stores('food:meat')], [true, 1, []], 'the row says where its meat went');
  const plain = await t.harvest(t.skin({ butcheryStores: true }));
  assert.deepEqual([plain.body.carry, plain.body.extraStore.own, t.stores('hide:bear')], [undefined, 1, [['own', 1]]], 'not carried: the Stores, as ever');
  // a tree's Resin, carried
  t.setXp('logging');
  const tr = (() => {
    for (let x = 300; x < 900; x++) {
      const found = trees({ x, y: 210, day: utcDay(NOON), climate: WOODS, confirmed: false }).find((q) => q.material === 'log:oak');
      if (found) return { key: nodeKey({ kind: 'tree', x, y: 210, day: utcDay(NOON), slot: found.slot }), material: found.material };
    }
    throw new Error('no tree');
  })();
  const logs = await t.harvest({ character: t.mac.character, node: tr.key, kind: 'logs', climate: WOODS, region: GLENUMBRA, act: { cuts: 0, clean: false },
    at: NOON - 2, rid: rid(), carry: true, held: 0, heldKey: tr.material, butcheryStores: true });
  assert.equal(logs.status, 200, JSON.stringify(logs.body));
  assert.deepEqual([logs.body.extra, logs.body.extraCarried?.own, t.carried('wood:resin'), t.stores('wood:resin')], ['wood:resin', 1, [['own', 1]], []], 'Resin keeps its path');
});

// ─── THE CLIENT ─────────────────────────────────────────────────────

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const entity = () => ({ stats: { strength: 50 }, items: [setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE })], bagItems: [], goldPieces: 0 });
const hands = (e) => ({
  held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
  take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
  stamps: () => Object.entries(bagTakesOf(e)).map(([id, x]) => ({ id, ...x })),
});
const track = { profession: 'hunting', xp: 30, rank: 0 };

test('BUTCHER-STORES client: a carried harvest asks `butcheryStores`; the hide and the tooth minted into the bag, the meat never - the Stores\' count raised; an older service\'s carried meat minted as before; the line and the cards say the Stores (mutants: the flag unasked; the meat minted anyway; the old service\'s meat left unminted; the line says the bag)', async () => {
  const run = async (data) => {
    const e = entity();
    const asked = [];
    const door = { account: () => 'a', harvest: async (b) => { asked.push(b); return { ok: true, data }; } };
    const book = createProfBook({ door, storage: memStorage(), character: () => 'c', now: () => 1_000_000, sleep: noWait, carry: hands(e) });
    const r = await book.harvest({ node: 'body:11:000000000001', kind: 'hide', foe: BEAR, act: {}, at: 1, material: 'hide:bear' });
    return { e, asked, r, book };
  };
  const base = { carry: true, material: 'hide:bear', qty: 1, gem: 'part:tooth', extra: 'food:meat', extraQty: 1, xp: 30, track,
    carried: { material: 'hide:bear', own: 1, bought: 0 }, gemCarried: { material: 'part:tooth', own: 1, bought: 0 }, extraStore: { material: 'food:meat', own: 3, bought: 0 } };
  const now = await run(base);
  assert.equal(now.asked[0].butcheryStores, true, 'the client says it reads a body\'s meat in the Stores');
  assert.deepEqual([heldOf(now.e, 'hide:bear'), heldOf(now.e, 'part:tooth'), heldOf(now.e, 'food:meat')], [1, 1, 0], 'no meat in the bag or the pack');
  assert.deepEqual([now.book.storesHeld('food:meat'), now.book.carried('food:meat')?.own ?? 0], [3, 0], 'the Stores\' count, as the answer says - none carried');
  const line = storesLine({ ...now.r.data });
  assert.equal(line, '+1 Bear Hide and a Big Tooth to your bag, and Raw Meat to your Stores');
  const meatCard = harvestHauls(now.r.data).find((c) => c.material === 'food:meat');
  assert.deepEqual([meatCard.where, meatCard.held], ['Stores', 3]);
  // an older service: the meat counted carried - so minted, and said with the rest
  const before = await run({ ...base, extraCarried: { material: 'food:meat', own: 1, bought: 0 } });
  assert.equal(heldOf(before.e, 'food:meat'), 1, 'its carried meat minted, as it counted it');
  assert.equal(storesLine({ ...before.r.data }), '+1 Bear Hide, a Big Tooth and Raw Meat to your bag');
  assert.equal(harvestHauls(before.r.data).find((c) => c.material === 'food:meat').where, 'Carried');
  // not carried: the Stores' words, as ever
  assert.equal(storesLine({ material: 'hide:bear', qty: 1, extra: 'food:meat', extraQty: 2 }), '+1 Bear Hide and 2 Raw Meat to your Stores');
});
