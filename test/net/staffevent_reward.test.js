// STAFF-EVENT THE REWARD (2026-10-24, mob: "what should we do for the mini bosses drop for loot?", "something like dagons
// leaderboard", "but not his ghear", "build that base", "but we will tweak the drop table"; bible/11-Multiplayer/
// Staff-Events.md section 9) - who earns a reward at the mini boss's first fall and the board of the top fighters
// (net/staffEvent/staffEventLaw.js), the relay's signed receipt for each (net/staffEvent/staffEventReceipt.js `e1`), and
// the spoils the game rolls off it (systems/staffEventSpoils.js), straight into the pack once a receipt.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newStaffLedger, foldStaffWord, staffEventEarned, staffEventBoard, validStaffBoard, staffEventTell, validStaffEventTell, validStaffEventOut,
  STAFF_EVENT_EARN_KILLS, STAFF_EVENT_BOARD_MAX, STAFF_EVENT_STAND_TICK_MS, STAFF_EVENT_KILL_MS,
} from '../../src/net/staffEvent/staffEventLaw.js';
import {
  mintStaffReceipt, readStaffReceipt, verifyStaffReceipt, staffReceiptValid, STAFF_RECEIPT_V, STAFF_RECEIPT_TTL_S,
} from '../../src/net/staffEvent/staffEventReceipt.js';
import { readRaidReceipt } from '../../src/net/raid/raidReceipt.js';
import { STAFF_SPOILS_TABLE, rollStaffSpoils, staffSpoilsList, staffSpoilsDay, grantStaffSpoils } from '../../src/systems/staffEventSpoils.js';
import { createSpoilsPool } from '../../src/scenes/spoilsPool.js';
import { RAID_SPOILS_KEYS } from '../../src/systems/raidSpoils.js';

const { subtle } = globalThis.crypto;
const EV = Object.freeze({ id: 'ab12cd34ef', rg: 17, loc: 0, px: 207, py: 213, nm: 'Daggerfall', ct: 1, mt: [7, 12], n: 500, m: 25, b: 24, bs: 200, bh: 10, at: 0, ue: 0, eb: 1, fb: 0, by: 'SirMcMobdon' });
const T0 = 1_700_000_000_000;
const ORDER = ['magic', 'rare', 'legendary'];

/** A ledger past its call, every account's word folded in at `at` (kills to `n`), the boss stood and felled by `killer`. */
function fought(words, killer, fallAt) {
  const led = newStaffLedger(EV, T0);
  for (const [acct, nm, h, at] of words) foldStaffWord(led, EV, acct, nm, { n: 0, h, s: 1 }, at);   // the board's kills a word's `h` (`n` the runner's)
  led.bd = 1;
  foldStaffWord(led, EV, killer, words.find((w) => w[0] === killer)?.[1] ?? '', { n: 0, bu: 1, fb: 0 }, fallAt - 1);
  foldStaffWord(led, EV, killer, words.find((w) => w[0] === killer)?.[1] ?? '', { n: 0, bu: 1, bk: 1, fb: 0 }, fallAt);
  return led;
}

test('THE REWARD: earned by three kills or by standing half the run - never a guest; the board most kills first, the killing blow before an equal count, ten at most', () => {
  const late = T0 + 600_000;
  const words = [
    ['acctA', 'Ana', 9, T0 + 10_000], ['acctB', 'Bo', 4, T0 + 20_000], ['acctC', 'Cy', 4, T0 + 30_000],
    ['acctD', 'Di', 2, T0 + 40_000],   // two kills, one word: not earned
    ['id:guest', 'Guest', 9, T0 + 50_000],   // a guest's socket: never
  ];
  const led = fought(words, 'acctC', late);
  assert.equal(led.kb, 'acctC');
  assert.equal(led.fellAt, late);
  assert.deepEqual(staffEventEarned(led).map((x) => [x.acct, x.rank]), [['acctA', 1], ['acctC', 2], ['acctB', 3]], 'the killer before an equal count');
  assert.deepEqual(staffEventBoard(led), [['Ana', 9, 0], ['Cy', 4, 1], ['Bo', 4, 0]]);
  // the stand: a word a tick, enough of them to cover half the run from the ledger's first word to the fall
  const stand = newStaffLedger(EV, T0);
  for (let at = T0; at <= T0 + 60_000; at += STAFF_EVENT_STAND_TICK_MS) foldStaffWord(stand, EV, 'acctS', 'Sal', { n: 0 }, at);
  foldStaffWord(stand, EV, 'acctQ', 'Quick', { n: 9, h: 1 }, T0 + 1000);   // nine deaths it stood, one its own kill
  stand.bd = 1;
  foldStaffWord(stand, EV, 'acctS', 'Sal', { n: 0, bu: 1, fb: 0 }, T0 + 60_000);
  foldStaffWord(stand, EV, 'acctS', 'Sal', { n: 0, bu: 1, bk: 1, fb: 0 }, T0 + 60_000);
  assert.deepEqual(staffEventEarned(stand).map((x) => x.acct), ['acctS'], 'stood the run with no kills: earned; one word and one kill: not');
  assert.equal(stand.a.acctS.t, 16, 'a word a tick');
  // ten on the board, the rest earned past it (rank 0)
  const many = fought(Array.from({ length: 14 }, (_, i) => [`acct${i}`, `P${i}`, STAFF_EVENT_EARN_KILLS + i, T0 + 1000 + i * STAFF_EVENT_KILL_MS * 40]), 'acct0', late);
  const earned = staffEventEarned(many);
  assert.equal(earned.length, 14);
  assert.equal(earned.filter((x) => x.rank > 0).length, STAFF_EVENT_BOARD_MAX);
  assert.deepEqual(earned.slice(STAFF_EVENT_BOARD_MAX).map((x) => x.rank), [0, 0, 0, 0]);
  assert.equal(staffEventBoard(many).length, STAFF_EVENT_BOARD_MAX);
});

test('THE REWARD: the board on the wire - a tell and a frame carry it, a bad one refused, a nameless row kept nameless', () => {
  const top = [['Ana', 9, 0], ['', 4, 1]];
  assert.deepEqual(validStaffBoard(top), top);
  assert.deepEqual(validStaffBoard([['<b>Ana</b>', 9, 7]]), [['bAna/b', 9, 0]], 'cleaned, the mark a bit');
  for (const bad of [null, 'x', [['Ana', -1, 0]], [['Ana', 9]], [[7, 9, 0]], Array.from({ length: STAFF_EVENT_BOARD_MAX + 1 }, () => ['A', 1, 0])]) {
    assert.equal(validStaffBoard(bad), null, JSON.stringify(bad));
  }
  const led = newStaffLedger(EV, T0);
  assert.equal('top' in staffEventTell(led, T0), false, 'no board before the fall');
  led.top = top;
  assert.deepEqual(validStaffEventTell(staffEventTell(led, T0)).top, top);
  assert.equal(validStaffEventTell({ ...staffEventTell(led, T0), top: 'x' }), null);
  assert.deepEqual(validStaffEventOut({ k: 'bd', id: EV.id, top }), { k: 'bd', id: EV.id, top });
  assert.equal(validStaffEventOut({ k: 'bd', id: EV.id, top: 7 }), null);
  assert.deepEqual(validStaffEventOut({ k: 'rc', id: EV.id, r: 'e1.x.' }), { k: 'rc', id: EV.id, r: 'e1.x.' });
  assert.equal(validStaffEventOut({ k: 'rc', id: EV.id, r: 'e'.repeat(513) }), null);
});

test('THE REWARD: the receipt - minted signed or not, read by the game, verified by its key alone, never a raid\'s or a gate\'s', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_700_000_000;
  const what = { v: EV.id, s: 'acct-0001', c: 123456789, r: 1 };
  const r = await mintStaffReceipt(what, kp.privateKey, { subtle, nowS });
  assert.ok(r.startsWith(`${STAFF_RECEIPT_V}.`));
  assert.deepEqual(readStaffReceipt(r), { ...what, i: nowS, e: nowS + STAFF_RECEIPT_TTL_S, signed: true });
  assert.deepEqual(await verifyStaffReceipt(r, kp.publicKey, { subtle, nowS: nowS + 1 }), { ok: true, claims: { ...what, i: nowS, e: nowS + STAFF_RECEIPT_TTL_S } });
  assert.equal((await verifyStaffReceipt(r, other.publicKey, { subtle, nowS })).why, 'signature');
  assert.equal((await verifyStaffReceipt(r, kp.publicKey, { subtle, nowS: nowS + STAFF_RECEIPT_TTL_S })).why, 'expired');
  const bare = await mintStaffReceipt(what, null, { subtle, nowS });
  assert.ok(bare.endsWith('.'));
  assert.equal(readStaffReceipt(bare).signed, false, 'unsigned is read');
  assert.equal((await verifyStaffReceipt(bare, kp.publicKey, { subtle, nowS })).why, 'unsigned', 'and never verified');
  assert.equal(readRaidReceipt(r), null, 'a raid\'s reader refuses an event\'s');
  assert.equal((await verifyStaffReceipt(r.replace(/^e1/, 'w1'), kp.publicKey, { subtle, nowS })).why, 'version');
  for (const bad of [{ r: 11 }, { r: -1 }, { c: -1 }, { v: 'NO' }, { w: 'x' }, { d: 1 }, { n: 'x' }]) {
    assert.equal(staffReceiptValid({ ...what, i: nowS, e: nowS + 60, ...bad }), false, JSON.stringify(bad));
  }
  await assert.rejects(mintStaffReceipt({ ...what, r: 99 }, null, { subtle, nowS }), TypeError);
});

test('THE REWARD: the spoils - gold by level and a Magic-or-better piece for everyone, a Rare-or-better more on the board, one more for first; the same seed the same spoils; none of Dagon\'s', () => {
  const tierOf = (p) => ORDER.indexOf(p.tier);
  for (let seed = 1; seed <= 40; seed++) {
    const past = rollStaffSpoils(seed, 10, 0);
    const board = rollStaffSpoils(seed, 10, 5);
    const first = rollStaffSpoils(seed, 10, 1);
    assert.equal(past.pieces.length, STAFF_SPOILS_TABLE.everyone.length);
    assert.equal(board.pieces.length, STAFF_SPOILS_TABLE.everyone.length + STAFF_SPOILS_TABLE.top.length);
    assert.equal(first.pieces.length, STAFF_SPOILS_TABLE.everyone.length + STAFF_SPOILS_TABLE.top.length + 1);
    assert.ok(past.pieces.every((p) => tierOf(p) >= 0), 'Magic or better');
    assert.ok(tierOf(board.pieces[1]) >= 1, 'the board\'s piece Rare or better');
    assert.ok(tierOf(first.pieces[2]) >= 1, 'first place\'s Rare or better');
    for (const s of [past, board, first]) {
      assert.ok(s.gold >= 0.8 * STAFF_SPOILS_TABLE.goldPerLevel * 10 - 1 && s.gold <= 1.2 * STAFF_SPOILS_TABLE.goldPerLevel * 10 + 1, `gold ${s.gold}`);
      for (const { item } of s.pieces) {
        assert.equal(item.isIdentified, true);
        assert.equal(item.gilded, undefined, 'nothing gilded');
        assert.equal(item.sigil, undefined, 'no Sigil');
      }
    }
  }
  assert.deepEqual(JSON.stringify(rollStaffSpoils(77, 12, 1)), JSON.stringify(rollStaffSpoils(77, 12, 1)), 'the same seed, the same spoils');
  const list = staffSpoilsList(77, 12, 2);
  assert.deepEqual(list.map((p) => p.kind), ['item', 'item', 'gold']);
  assert.equal(staffSpoilsDay(EV.id), `sev:${EV.id}`);
});

test('THE REWARD: given once a receipt, straight into the pack, through the town\'s thanks\' pool', async () => {
  const store = new Map();
  const took = [];
  const said = [];
  const pool = createSpoilsPool({
    ray: () => null, now: () => T0, take: (p) => { took.push(p); return true; }, say: (s) => said.push(s),
    store: { get: (k) => store.get(k) ?? null, set: (k, v) => { store.set(k, v); }, remove: (k) => { store.delete(k); } }, who: () => 'char1', keys: RAID_SPOILS_KEYS,
  });
  const lock = (f) => Promise.resolve().then(f);
  const c = { v: EV.id, s: 'acct-0001', c: 4242, r: 1 };
  await grantStaffSpoils(pool, lock, c, 10);
  const first = took.length;
  assert.equal(first, staffSpoilsList(c.c, 10, c.r).length, 'every piece and the gold');
  assert.deepEqual(said, ['Your reward for the fight is in your pack.']);
  await grantStaffSpoils(pool, lock, c, 10);
  assert.equal(took.length, first, 'a receipt handed again (a reconnect) is spent');
});
