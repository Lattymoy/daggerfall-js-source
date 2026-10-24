// OFFER-ID (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; found re-reading the Discord's
// "Unidenitified items"): a valuable piece offered in a realm trade carries its id from the offer. The realm's checkpoint
// gives every valuable piece its id (INT4, world.js realmCheckpoint -> itemIds.js stampItemIds), and the trade's hold
// checkpoints AFTER the offer was written for the wire (tradeSession.js setOffer -> tradePack.js wire) - so a piece looted
// since the last checkpoint stood in the realm's record with an id its offer did not carry, `uid` is no field a trade
// lets differ (realmTradeLaw.js recordIsOffered), and the trade was refused whole: "The realm could not find the goods
// offered - nothing was traded." Now the offer stamps the pieces it holds out, the id the checkpoint would give them -
// the stamp handed to the pack by the host (world.js), never imported by it: itemIds.js reads the item law, and the law
// imported installs itself into the wire's clamp for every reader of tradePack.js (a Soulbound pin's own fixture found it).
// Fixtures are the producers' (the loot ladder's Rare, lootRarity.js applyRarity - minted with no id); the trade is the
// real createTradeManager over the host's checkpointed pack, settled by the real account Worker over node:sqlite with the
// real createRealmSession and realmTradeEscrow (test/systems/fb1001_identify.test.js's realm rig), each checkpoint composed as the
// host composes it: the ids stamped, then the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../modsOff.js';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { createTradeManager } from '../../src/net/tradeSession.js';
import { validTradeData } from '../../src/net/wire.js';
import { recordIsOffered } from '../../src/net/realm/realmTradeLaw.js';
import { readFileSync } from 'node:fs';
import { createTradePack } from '../../src/systems/tradePack.js';
import { checkpointedTradePack } from '../../src/systems/online/onlineCheckpoint.js';
import { realmIo, realmFetch, createRealmSession, realmTradeEscrow } from '../../src/systems/realmSaves.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { stampItemIds, valuablePiece } from '../../src/systems/item/itemIds.js';
import { ITEM_UID_RE } from '../../src/systems/item/itemLaw.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { d1 } from '../accountDb.mjs';
import { r2, seatRealm } from '../realmSeat.mjs';

const BROADSWORD = 118;
/** The loot ladder's Rare on a Broadsword, as a corpse drops it: no id until a checkpoint gives it one. */
const rareSword = (seed) => applyRarity(mintCondition(setItemFields({ group: 'Weapons', templateIndex: BROADSWORD, material: 3 })), 'rare', seededRng(seed));
const hero = (name, items) => ({ name, items, goldPieces: 100, stats: { strength: 60 } });

/** Wait until `ok()` holds, a few real milliseconds at a time (test/net/realm4.test.js's). */
async function until(ok, what, ms = 30_000) {
  const end = performance.now() + ms;
  while (!(await ok())) {
    if (performance.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((res) => { setTimeout(res, 2); });
  }
}

test('OFFER-ID: the pack\'s offer gives each valuable piece held out its id, in place - the id the checkpoint keeps; a piece with one keeps it; a plain one none', () => {
  const fresh = rareSword(3), kept = rareSword(4), plain = mintCondition(setItemFields({ group: 'Weapons', templateIndex: BROADSWORD, material: 0 }));
  assert.ok(valuablePiece(fresh) && valuablePiece(kept) && !valuablePiece(plain), 'two Rares and a plain blade');
  stampItemIds({ items: [kept] });
  const had = kept.uid;
  assert.equal(fresh.uid, undefined, 'a Rare drops with no id');
  const recs = createTradePack({ items: [fresh, kept, plain] }, { stampIds: stampItemIds }).wire([{ item: fresh, count: 1 }, { item: kept, count: 1 }, { item: plain, count: 1 }]);
  assert.ok(ITEM_UID_RE.test(fresh.uid), 'the fresh piece has its id from the offer');
  assert.deepEqual(recs.map((r) => r.uid), [fresh.uid, had, undefined], 'each record the piece\'s own: minted, kept, none');
  assert.equal(stampItemIds({ items: [fresh, kept, plain] }), 0, 'the checkpoint after it stamps nothing new');
  assert.ok(recordIsOffered(JSON.parse(JSON.stringify(fresh)), recs[0]), 'so the record the realm finds IS the one offered');
});

test('OFFER-ID through the realm: a Rare looted since the last checkpoint is offered, and the trade settles - the receiver holds it under the id the giver\'s hold stamped (it was refused whole: "could not find the goods offered")', async () => {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const ents = { A: hero('Masta_Fu', []), B: hero('Ondolemar', []) };
  let stamping = false;
  // the host's realmCheckpoint: every valuable piece stamped, then the save (the seat below is the realm's first record)
  const snap = (e) => { if (stamping) stampItemIds(e); return JSON.stringify({ name: e.name, level: 1, items: e.items, goldPieces: e.goldPieces }); };
  let clock = 0;
  const lost = [], said = { A: [], B: [] };
  const tabs = {};
  for (const me of ['A', 'B']) {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const kept = new Map([[SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret })]]);
    const storage = { get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
    const io = realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), env), storage });
    const char = await seatRealm(env, g.secret, ents[me].name, JSON.parse(snap(ents[me])));
    const session = createRealmSession({ io, id: char.id, lease: char.lease, seq: 1, onLost: (why) => lost.push(`${me}: ${why}`) });
    tabs[me] = { io, id: char.id, session, checkpoint: () => session.checkpoint(snap(ents[me])) };
  }
  stamping = true;
  // A loots a Rare after its last checkpoint: in the pack, no id, and the realm's record without it
  const sword = rareSword(11);
  ents.A.items.push(sword);
  assert.equal(sword.uid, undefined);
  const q = [];
  const id = (who) => `peer${who.repeat(4)}`;
  const mgrs = {};
  for (const [me, other] of [['A', 'B'], ['B', 'A']]) {
    mgrs[me] = createTradeManager({
      pack: checkpointedTradePack(createTradePack(ents[me], { stampIds: stampItemIds }), tabs[me].checkpoint),   // the host's pack, as world.js builds it now: () => clock, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id(me),
      send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id(me), to: v.to === id('A') ? 'A' : 'B', d: v }); return true; },
      near: () => true, open: () => {},
      escrow: realmTradeEscrow({ session: tabs[me].session, checkpoint: tabs[me].checkpoint, wait: async () => { clock += 100; await new Promise((res) => { setImmediate(res); }); }, now: () => clock }),
    });
  }
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  assert.deepEqual(mgrs.A.request(id('B')), { ok: true }); pump();
  assert.deepEqual(mgrs.B.request(id('A')), { ok: true }); pump();
  const g = mgrs.A.session, t = mgrs.B.session;
  assert.deepEqual(g.setOffer([{ item: sword, count: 1 }], 0), { ok: true }); pump();
  assert.deepEqual(t.lock(), { ok: true }); pump();
  assert.deepEqual(g.lock(), { ok: true }); pump();
  assert.deepEqual(t.confirm(), { ok: true }); pump();
  assert.deepEqual(g.confirm(), { ok: true }); pump();
  await until(() => { pump(); return g.isOver && t.isOver; }, 'the realm settled it');
  assert.deepEqual([g.phase, t.phase], ['done', 'done'], `${said.A} / ${said.B}`);
  assert.deepEqual([ents.A.items.length, ents.B.items.length], [0, 1]);
  const uid = sword.uid;
  assert.ok(ITEM_UID_RE.test(uid), 'the piece carried its id across');
  assert.equal(ents.B.items[0].uid, uid, 'B holds it under the id A\'s hold stamped');
  await until(async () => JSON.parse((await realmFetch(tabs.B.io, tabs.B.id)).text).items.length === 1, 'B\'s record');
  assert.equal(JSON.parse((await realmFetch(tabs.B.io, tabs.B.id)).text).items[0].uid, uid, 'and so does the realm\'s record of B');
  assert.deepEqual(lost, [], 'neither tab lost its session');
});

test('OFFER-ID by source: the host hands its realm pack the id stamp; a pack handed none stamps nothing (the other readers of the pack)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const tradePack = checkpointedTradePack\(createTradePack\(playerEntity, \{ stampIds: stampItemIds \}\), \(\) => onlineCheckpoint\(\)\);/);
  assert.doesNotMatch(readFileSync(new URL('../../src/systems/tradePack.js', import.meta.url), 'utf8'), /from '(?:\.\.?\/)+(?:[\w-]+\/)*itemIds\.js'/, 'never imported: the item law would install itself');
  const fresh = rareSword(5);
  createTradePack({ items: [fresh] }).wire([{ item: fresh, count: 1 }]);
  assert.equal(fresh.uid, undefined);
});
