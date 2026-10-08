// CARDS6 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 23): A REALM CHARACTER'S STAKES ON THE DEVICE
// (net/cardStakes.js) - the stake asked as the record's act with the purse's gold held out while it is, its request kept
// first and its order kept till the relay sits it; a lost answer asked again by the same request; a cash-out kept, its
// stake let go, and claimed into the record's account at the region it was staked in, once; a receipt the service will
// never pay let go, another character's kept for it; a stake never sat voided back in its own room after its minute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createCardStakes, CARD_STAKES_KEY, CARD_RECEIPTS_KEY, CARD_VOID_AFTER_MS, mintCardRid } from '../src/net/cardStakes.js';
import { mintCardReceipt } from '../src/net/cardReceipt.js';
import { readFileSync } from 'node:fs';

const { subtle } = webcrypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The record's act as realmSaves.js realmGoldAct runs it: the hold, the call, the answer applied or the hold undone. */
const realmAct = (log) => ({
  async act({ reserve = null, apply = null, call }) {
    const undo = reserve ? reserve() : null;
    const r = await call({ id: 'R', lease: 'L', seq: 1 });
    log.push(['act', r?.ok ?? r?.error]);
    if (r?.ok) apply?.(r); else if (!r?.unknown) undo?.();
    return r;
  },
});
function rig({ answers = {} } = {}) {
  const store = new Map(), log = [], purse = { gold: 1000, bank: 0 };
  let clock = 1_000_000, character = 'CH1';
  const door = {
    stake: async (req) => { log.push(['stake', req]); return answers.stake ? answers.stake(req) : { ok: true, data: { stake: `order-${req.rid}`, id: `id${req.rid.slice(-6)}`, realm: { seq: 2 } } }; },
    cashout: async (req) => { log.push(['cashout', req]); return answers.cashout ? answers.cashout(req) : { ok: true, data: { gold: 777, realm: { seq: 3 } } }; },
  };
  const wallet = (region) => ({ gold: () => purse.gold, pay: (n) => { purse.gold -= n; log.push(['pay', region, n]); return () => { purse.gold += n; log.push(['undo', n]); }; }, bank: (n) => { purse.bank += n; log.push(['bank', region, n]); } });
  const book = createCardStakes({ door, realm: realmAct(log), wallet, character: () => character, region: () => 17, storage: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => clock, rand: () => 0.5 });
  return { book, store, log, purse, tick: (ms) => { clock += ms; }, setCharacter: (c) => { character = c; } };
}

test('CARDS6 the stake: kept first, the purse held out while asked, the order kept till the relay sits it; refused, nothing kept and the purse back', async () => {
  const r = rig();
  const got = await r.book.stake({ room: 'interior:m1.2', table: 0, bb: 10, amount: 300 });
  assert.equal(got.ok, true);
  assert.match(got.stake, /^order-card-/);
  assert.deepEqual(r.log.filter((x) => x[0] === 'pay'), [['pay', 17, 300]], 'held out of the purse');
  assert.equal(r.purse.gold, 700);
  const kept = r.store.get(CARD_STAKES_KEY);
  assert.equal(kept.length, 1);
  assert.deepEqual([kept[0].order, kept[0].id, kept[0].room, kept[0].table, kept[0].c], [got.stake, got.id, 'interior:m1.2', 0, 'CH1']);
  r.book.seated(got.id);
  assert.deepEqual(r.store.get(CARD_STAKES_KEY), [], 'sat: nothing of it to keep');
  const no = rig({ answers: { stake: () => ({ ok: false, error: 'realm-gold' }) } });
  const refused = await no.book.stake({ room: 'interior:m1.2', table: 0, bb: 10, amount: 300 });
  assert.deepEqual([refused.ok, refused.error], [false, 'realm-gold']);
  assert.equal(no.purse.gold, 1000, 'the purse back');
  assert.deepEqual(no.store.get(CARD_STAKES_KEY), [], 'nothing held, nothing kept');
  assert.match(mintCardRid(() => 0.1), /^card-[a-z0-9]{20}$/, 'the service\'s request id shape');
});

test('CARDS6 a lost answer: the request kept, asked again by the same id (the service\'s one stake), no purse held twice; then voided back in its room after its minute', async () => {
  let lost = true;
  const r = rig({ answers: { stake: (req) => (lost ? { ok: false, error: 'offline', unknown: true } : { ok: true, data: { stake: `order-${req.rid}`, id: 'abcdabcdabcdabcdabcd', repeat: true } }) } });
  const first = await r.book.stake({ room: 'interior:m1.2', table: 1, bb: 10, amount: 400 });
  assert.equal(first.ok, false);
  const rid = r.store.get(CARD_STAKES_KEY)[0].rid;
  assert.equal(r.purse.gold, 600, 'a lost answer keeps the hold - the record may have paid it');
  lost = false;
  await r.book.recover();
  const asks = r.log.filter((x) => x[0] === 'stake').map((x) => x[1].rid);
  assert.deepEqual(asks, [rid, rid], 'the same request');
  assert.equal(r.log.filter((x) => x[0] === 'pay').length, 1, 'held once');
  assert.deepEqual(r.book.voidable('interior:m1.2'), [], 'not yet: its order may still be sat on');
  r.tick(CARD_VOID_AFTER_MS);
  assert.deepEqual(r.book.voidable('interior:m1.2').map((v) => [v.table, v.id]), [[1, 'abcdabcdabcdabcdabcd']]);
  assert.deepEqual(r.book.voidable('interior:other'), [], 'in its own room alone');
  r.book.voiding('abcdabcdabcdabcdabcd');
  assert.deepEqual(r.book.voidable('interior:m1.2'), [], 'a void said is not said again at once');
});

test('CARDS6 the cash-out: kept and its stake let go, claimed into the account it was staked from, once; the answers that end it, and another character\'s kept', async () => {
  const r = rig();
  const got = await r.book.stake({ room: 'interior:m1.2', table: 0, bb: 10, amount: 300 });
  const receipt = await mintCardReceipt({ s: 'acct-me', j: got.id.padEnd(20, '0').slice(0, 20).replace(/[^a-z0-9]/g, '0'), r: 777, w: 'stood' }, null, { subtle, nowS: 1000 });
  // a stake id the receipt names: the book's own
  const kept0 = r.store.get(CARD_STAKES_KEY);
  kept0[0].id = JSON.parse(Buffer.from(receipt.split('.')[1], 'base64url').toString()).j;
  r.store.set(CARD_STAKES_KEY, kept0);
  const j = r.book.receive(receipt);
  assert.equal(j, kept0[0].id);
  assert.deepEqual(r.store.get(CARD_STAKES_KEY), [], 'its stake let go');
  assert.equal(r.book.receive(receipt), j, 'heard twice, kept once');
  assert.equal(r.store.get(CARD_RECEIPTS_KEY).length, 1);
  assert.equal(r.book.receive('nonsense'), null);
  await r.book.claim();
  assert.deepEqual(r.log.filter((x) => x[0] === 'bank'), [['bank', 17, 777]], 'into the account it was staked from');
  assert.deepEqual(r.store.get(CARD_RECEIPTS_KEY), [], 'claimed: let go');
  // the answers: a repeat pays nothing here (the record had it); never-payable ends it; another character's waits for it
  const other = rig({ answers: { cashout: () => ({ ok: false, error: 'cards-other-character' }) } });
  other.book.receive(receipt);
  await other.book.claim();
  assert.equal(other.store.get(CARD_RECEIPTS_KEY).length, 1, 'kept for the character that staked it');
  other.setCharacter('CH2');
  const calls = other.log.filter((x) => x[0] === 'cashout').length;
  await other.book.claim();
  assert.equal(other.log.filter((x) => x[0] === 'cashout').length, calls, 'another character playing: not even asked');
  const done = rig({ answers: { cashout: () => ({ ok: false, error: 'cards-no-stake' }) } });
  done.book.receive(receipt);
  await done.book.claim();
  assert.deepEqual(done.store.get(CARD_RECEIPTS_KEY), [], 'a stake the service has not: let go');
  const rep = rig({ answers: { cashout: () => ({ ok: true, data: { repeat: true, gold: 777 } }) } });
  rep.book.receive(receipt);
  await rep.book.claim();
  assert.deepEqual(rep.log.filter((x) => x[0] === 'bank'), [], 'a repeat pays the device nothing - the record had it already');
});

test('CARDS6 the hosts: a realm character online sits at a gold table with the service\'s stake; a cash-out from any socket is kept, acked and claimed; voids said on a visit', () => {
  const wm = read('src/scenes/worldModes.js'), w = read('src/scenes/world.js'), on = read('src/net/online.js');
  assert.match(wm, /const goldOnline = !!host\.cardOnline\?\.ok\?\.\(\) && !!host\.cardStakes\?\.goldOk\?\.\(\);/);
  assert.match(wm, /const r = await host\.cardStakes\.stake\(\{ room: host\.cardOnline\.room\(\), table: cardSeat\.table, bb: g\.stakes\.bb, amount \}\);/);
  assert.match(wm, /\.\.\.\(g\.stakeWord \? \{ stake: g\.stakeWord \} : \{\}\) \}\);   \/\/ CARDS6/);
  assert.match(wm, /if \(r\.confirmed && g\.stakeId && !g\.stakeSeated\) \{ g\.stakeSeated = true; host\.cardStakes\?\.seated\(g\.stakeId\); \}/);
  assert.match(wm, /if \(typeof f\?\.cashout === 'string'\) \{\n\s*const j = host\.cardStakes\?\.receive\(f\.cashout\);\n\s*if \(j\) \{ host\.cardOnline\?\.send\(\{ op: 'ack', table: f\.table, j \}\); host\.cardStakes\.claim\(\); \}/);
  assert.match(wm, /for \(const v of host\.cardStakes\.voidable\(room\)\) \{ if \(!host\.cardOnline\.send\(\{ op: 'void', table: v\.table, stake: v\.order \}\)\) break; host\.cardStakes\.voiding\(v\.id\); \}/);
  assert.match(w, /const cardStakes = params\.has\('online'\) && realmSession\n\s*\? createCardStakes\(/);
  assert.match(w, /room: \(\) => online\?\.room \?\? null \},\n\s*cardStakes,/);
  assert.match(on, /if \(!validHoldemOut\(m\) \|\| \(!primary && m\.cashout === undefined\)\) return;/, 'a cash-out from the room just left is heard too');
});
