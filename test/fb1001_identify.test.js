// FIELD BUGS 2026-10-01 part four (TRADE-KNOWN) - Masta_Fu in #bug-reports, "Unidenitified items": "If you trade someone
// unidentified items and they identify them, They will not be identified when traded back to the original player."
//
// IT DID NOT REPRODUCE ON THE CODE - neither way a trade settles. What a piece knows is its own record's
// `isIdentified` (tradeModes.js itemIsIdentified - DFU's GetIsIdentified: an enchanted piece is unknown until its flag
// says so), and every door a traded piece passes carries that record whole. The offer is the pack's piece through the
// wire's clamp, which clamps rather than whitelists and reads the flag as the bool it is (tradePack.js wire, loot.js
// validLootItem, itemFields.js); the relay reads the frame's shape and none of its items (wire.js validTradeData); the
// peer's records are minted through the same clamp (tradePack.js unwire); and a realm trade moves the giver's OWN
// checkpointed record, which must be the offer in every field but the count, the price and the receiver's marks
// (realmTradeLaw.js recordIsOffered over TRADE_VOLATILE_FIELDS) - so the piece that comes back is the piece the giver's
// window held out, known or not. Nothing a trade reads is keyed by a piece's id, so no older copy can be put back: the
// port's item is its own UID (inventory.js addItem), and the realm keeps no item ledger yet (Realm-Arc's phase 3).
// So this file is a GUARD PIN, not a fix: the round trip as the report tells it, hand to hand and through the realm,
// and the law that keeps a piece's knowing part of what it IS in a trade. Left open, unconfirmed: knowing a piece is no
// realm act - it rides the identifying tab's next checkpoint (the two-minute one, a page hidden, a trade's hold), and a
// tab that joins again before one lands plays the record the first trade wrote, the piece unknown in it.
// Fixtures are the producers': DFU's own magic Broadsword (loot.js createRegularMagicItem over DFU's
// '%it of Featherweight' row, read by formats/magicDef.js readMagicDef) and the loot ladder's Rare (lootRarity.js
// applyRarity - online loot drops it unknown), known by the identify law the game runs (tradeModes.js
// identifySpellPass, and the host's own write - worldModes.js commitTrade's spell arm), traded by the real
// createTradeManager over createTradePack and validTradeData, and settled by the real account Worker over node:sqlite
// with the real createRealmSession and realmTradeEscrow (test/realm4.test.js's two tabs).
import './modsOff.js';   // the producers' draws as Daggerfall makes them - no mod's custom template or loot override in them
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import { ACCEPTED } from '../src/net/legalLaw.js';
import { createTradeManager } from '../src/net/tradeSession.js';
import { validTradeData } from '../src/net/wire.js';
import { recordIsOffered } from '../src/net/realmTradeLaw.js';
import { createTradePack } from '../src/systems/tradePack.js';
import { checkpointedTradePack } from '../src/systems/onlineCheckpoint.js';
import { realmIo, realmFetch, createRealmSession, realmTradeEscrow } from '../src/systems/realmSaves.js';
import { MAGIC_ITEM_RECORD_SIZE, ENCHANTMENT_TYPES as T, readMagicDef } from '../src/formats/magicDef.js';
import { createRegularMagicItem } from '../src/systems/loot.js';
import { applyRarity } from '../src/systems/lootRarity.js';
import { setItemFields, mintCondition, templateByIndex } from '../src/systems/itemTemplates.js';
import { itemIsIdentified, identifySpellPass, tradeCost } from '../src/systems/tradeModes.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { seededRng } from '../src/systems/wind.js';
import { d1 } from './accountDb.mjs';
import { r2, seatRealm } from './realmSeat.mjs';

const BROADSWORD = 118;
/** A roll that answers these in turn, then its last. */
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
/** MAGIC.DEF's bytes for these records (MagicItemsFile.ReadNextMagicItem's 62 bytes each). */
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = 0;
  }
  return buf;
}
/** DFU's MagicItemTemplates.txt row (test/fb0929_featherweight.test.js's): a regular magic item of group 0. */
const FEATHERWEIGHT = { name: '%it of Featherweight', type: 0, group: 0, ench: [[T.CastWhenUsed, 37]], uses: 1500, value: 550 };
/** DFU's own magic Broadsword, as CreateRegularMagicItem mints it: the one record, group 0's second group (Weapons), the
 *  weapon table's sixth slot (the Broadsword) at a level-1 material - and UNKNOWN, as every enchanted piece is minted. */
const magicSword = () => createRegularMagicItem(readMagicDef(magicDefBytes([FEATHERWEIGHT])), 1, 'male', seq(0, 0.2, 0.3, 0.5));
/** The loot ladder's Rare on a Broadsword: its flavour enchantment is DFU's own, so it drops unknown (lootRarity.js). */
const rareSword = () => applyRarity(mintCondition(setItemFields({ group: 'Weapons', templateIndex: BROADSWORD, material: 3 })), 'rare', seededRng(11));
/** A character with the pieces it holds - a purse, and the strength a lot is weighed against. */
const hero = (name, items) => ({ name, items, goldPieces: 100, stats: { strength: 60 } });
/** The long name a piece reads by, unknown and known - the name the pack's rows and the trade window show. */
const names = (it) => ({ unknown: itemLongName({ ...it, isIdentified: undefined }), known: itemLongName({ ...it, isIdentified: true }) });
/** THE NEW HOLDER KNOWS THEM as the Identify spell's window does (worldModes.js commitTrade's spell arm): the law's pass
 *  at a sure chance, then the host's own write over what it named. */
function identify(items) {
  const pass = identifySpellPass(items, 100, () => 0.5);
  for (const it of pass.identified) it.isIdentified = true;
  return pass;
}

/** Two players over a fake wire, one trade manager each for the life of the session, each over the REAL trade pack
 *  (`packOf` - the host's checkpointed one in a realm) and, in a realm, the realm's escrow (`escrowOf`). `give(from, to)`
 *  hands every piece `from` holds to `to` - offered, locked and confirmed on both sides, as the window presses - and
 *  answers the two sessions. */
function rig(ents, { packOf = (me) => createTradePack(ents[me]), escrowOf = () => null, now = () => 0 } = {}) {
  const q = [], said = { A: [], B: [] };
  const id = (who) => `peer${who.repeat(4)}`;
  const mgrs = {};
  for (const [me, other] of [['A', 'B'], ['B', 'A']]) {
    mgrs[me] = createTradeManager({
      pack: packOf(me), now, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id(me),
      send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id(me), to: v.to === id('A') ? 'A' : 'B', d: v }); return true; },
      near: () => true, open: () => {}, escrow: escrowOf(me),
    });
  }
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  const give = (from, to) => {
    assert.deepEqual(mgrs[from].request(id(to)), { ok: true }); pump();
    assert.deepEqual(mgrs[to].request(id(from)), { ok: true }); pump();
    const g = mgrs[from].session, t = mgrs[to].session;
    assert.ok(g && t, 'a trade is open between them');
    assert.deepEqual(g.setOffer(ents[from].items.map((item) => ({ item, count: 1 })), 0), { ok: true }, 'every piece goes on the table'); pump();
    assert.deepEqual(t.lock(), { ok: true }); pump();
    assert.deepEqual(g.lock(), { ok: true }); pump();
    assert.deepEqual(t.confirm(), { ok: true }); pump();
    assert.deepEqual(g.confirm(), { ok: true }); pump();
    return [g, t];
  };
  return { give, pump, said };
}

/** Wait until `ok()` holds, a few real milliseconds at a time - bounded by real time (test/realm4.test.js's). */
async function until(ok, what, ms = 30_000) {
  const end = performance.now() + ms;
  while (!(await ok())) {
    if (performance.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((res) => { setTimeout(res, 2); });
  }
}

test('TRADE-KNOWN hand to hand: a piece handed over unknown and known by its new holder comes back KNOWN - its flag on the record, its known long name, nothing left on it for the Mages Guild to name (mutants: the wire\'s copy strips the flag; the clamp strips it; the schema reads it as no bool)', () => {
  const ents = { A: hero('Masta_Fu', [magicSword(), rareSword()]), B: hero('Ondolemar', []) };
  assert.deepEqual(ents.A.items.map((it) => templateByIndex(it.templateIndex)?.name), ['Broadsword', 'Broadsword'], 'two Broadswords off the producers');
  const read = ents.A.items.map(names);
  // the report's first half: unknown as minted, and so handed over
  assert.deepEqual(ents.A.items.map(itemIsIdentified), [false, false], 'an enchanted piece is minted unknown');
  assert.deepEqual(ents.A.items.map((it) => itemLongName(it)), ['Broadsword', 'Broadsword'], 'and reads as its bare template');
  assert.ok(read.every((x) => x.known !== x.unknown), 'knowing it changes what it reads as');
  const r = rig(ents);
  const [g1, t1] = r.give('A', 'B');
  assert.deepEqual([g1.phase, t1.phase], ['done', 'done'], `${r.said.A} / ${r.said.B}`);
  assert.deepEqual([ents.A.items.length, ents.B.items.length], [0, 2]);
  assert.deepEqual(ents.B.items.map(itemIsIdentified), [false, false], 'B holds them unknown');
  // the report's second half: B knows them, and hands them back
  assert.equal(identify(ents.B.items).successCount, 2, 'both known');
  assert.deepEqual(ents.B.items.map((it) => itemLongName(it)), read.map((x) => x.known), 'B reads them known');
  const [g2, t2] = r.give('B', 'A');
  assert.deepEqual([g2.phase, t2.phase], ['done', 'done'], `${r.said.A} / ${r.said.B}`);
  assert.deepEqual([ents.A.items.length, ents.B.items.length], [2, 0]);
  assert.deepEqual(ents.A.items.map((it) => it.isIdentified), [true, true], 'the flag came back on the record');
  assert.deepEqual(ents.A.items.map((it) => itemLongName(it)), read.map((x) => x.known), 'A reads them as B did');
  assert.equal(tradeCost('Identify', ents.A.items).modeActionEnabled, false, 'and the Mages Guild finds nothing on them to identify');
});

test('TRADE-KNOWN through the realm: the same round trip between two realm tabs, each trade settled by the service moving the giver\'s own record - A\'s pieces come back KNOWN, in its pack and in the record the realm keeps; and a piece\'s knowing is never a field the realm lets differ, so what a window shows is what the record moves (mutants: knowing made volatile; the realm\'s moved record strips it; the wire\'s copy strips it; the clamp strips it; the schema reads it as no bool)', { timeout: 60_000 }, async () => {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const ents = { A: hero('Masta_Fu', [magicSword(), rareSword()]), B: hero('Ondolemar', []) };
  const read = ents.A.items.map(names);
  const minted = ents.A.items.map((it) => JSON.parse(JSON.stringify(it)));
  // PIN MOVED (INT2, 2026-10-09): the realm judges every checkpoint, and a save with no level is a character the game
  // never wrote (a breach, the trade frozen) - the record carries the level every real save does
  const snap = (e) => JSON.stringify({ name: e.name, level: 1, items: e.items, goldPieces: e.goldPieces });
  let clock = 0;
  const lost = [];
  const tabs = {};
  for (const me of ['A', 'B']) {
    // a signed-in account on its own device (test/realm4.test.js's player), its realm character seated with what it holds
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const kept = new Map([[SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret })]]);
    const storage = { get length() { return kept.size; }, key: (i) => [...kept.keys()][i] ?? null, getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } };
    const io = realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), env), storage });
    const char = await seatRealm(env, g.secret, ents[me].name, JSON.parse(snap(ents[me])));
    const session = createRealmSession({ io, id: char.id, lease: char.lease, seq: 1, onLost: (why) => lost.push(`${me}: ${why}`) });
    tabs[me] = { io, id: char.id, session, checkpoint: () => session.checkpoint(snap(ents[me])) };
  }
  const r = rig(ents, {
    packOf: (me) => checkpointedTradePack(createTradePack(ents[me]), tabs[me].checkpoint),   // the host's pack: P0.5 checkpoints as the goods move
    escrowOf: (me) => realmTradeEscrow({ session: tabs[me].session, checkpoint: tabs[me].checkpoint, wait: async () => { clock += 100; await new Promise((res) => { setImmediate(res); }); }, now: () => clock }),
    now: () => clock,
  });
  const settled = async ([g, t]) => {
    await until(() => { r.pump(); return g.isOver && t.isOver; }, 'the realm settled it');
    assert.deepEqual([g.phase, t.phase], ['done', 'done'], `${r.said.A} / ${r.said.B}`);
  };
  const record = async (me) => { const x = await realmFetch(tabs[me].io, tabs[me].id); return { seq: x.seq, save: JSON.parse(x.text) }; };
  await settled(r.give('A', 'B'));
  assert.deepEqual(ents.B.items.map(itemIsIdentified), [false, false], 'B holds them unknown, as the realm moved them');
  assert.equal(identify(ents.B.items).successCount, 2, 'B knows both - in its pack, where the trade\'s hold checkpoints it');
  await settled(r.give('B', 'A'));
  assert.deepEqual([ents.A.items.length, ents.B.items.length], [2, 0]);
  assert.deepEqual(ents.A.items.map((it) => it.isIdentified), [true, true], 'the flag came back in A\'s pack');
  assert.deepEqual(ents.A.items.map((it) => itemLongName(it)), read.map((x) => x.known), 'A reads them known');
  // the records: each trade's hold at 2 and 5, its settle at 3 and 6, its outcome at 4 and 7 - A's holds them known
  await until(async () => (await record('A')).seq === 7 && (await record('B')).seq === 7 && tabs.A.session.seq === 7 && tabs.B.session.seq === 7, 'the outcome\'s checkpoints');
  const ra = await record('A'), rb = await record('B');
  assert.deepEqual(ra.save.items.map((it) => it.isIdentified), [true, true], 'the realm keeps them known for A - a join reads them so');
  assert.deepEqual(rb.save.items, [], 'and B holds none');
  assert.deepEqual(lost, [], 'neither tab lost its session');
  // THE LAW THAT HOLDS IT: a piece's knowing is not one of the fields a realm trade lets differ - an offer that says
  // known never settles against a record that is not, nor the reverse; an honest offer is its record
  const offer = (it) => createTradePack({ items: [it] }).wire([{ item: it, count: 1 }])[0];
  for (const p of minted) {
    const known = { ...p, isIdentified: true };
    assert.equal(recordIsOffered(known, offer(known)), true, 'an honest offer is its record');
    assert.equal(recordIsOffered(p, offer(known)), false, 'an offer that says known never moves a record that is not');
    assert.equal(recordIsOffered(known, offer(p)), false, 'nor the reverse');
  }
});
