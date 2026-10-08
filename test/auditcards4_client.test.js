// AUDIT CARDS-4 (2026-10-08, bible/01-Overview/Audit-Cards-4.md): THE DEVICE'S STAKES BOOK (net/cardStakes.js) and the
// host's words for it. C1 a stake asked again pays the purse when the service takes it then; C2 a request the service
// never refused is kept; C3 a receipt acked only once kept; C4 (cards6_client) whose a receipt is; C5 a stake's refusal
// loses the pending chair; C6 the bound drops a sat stake first and never a receipt, and what nothing can bring home
// goes; C7 a lost answer said as one; C8 a receipt heard mid-claim is claimed in that claim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCardStakes, CARD_STAKES_KEY, CARD_RECEIPTS_KEY, CARD_KEPT_MAX, CARD_STAKE_KEEP_MS, cardStakeRefused } from '../src/net/cardStakes.js';
import { mintCardReceipt } from '../src/net/cardReceipt.js';
import { RemoteCardTable, SIT_REFUSALS } from '../src/systems/cardRemoteTable.js';

const { subtle } = webcrypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const realmAct = (log) => ({
  async act({ reserve = null, apply = null, call }) {
    const undo = reserve ? reserve() : null;
    const r = await call({ id: 'R', lease: 'L', seq: 1 });
    log.push(['act', r?.ok ?? r?.error]);
    if (r?.ok) apply?.(r); else if (!r?.unknown) undo?.();
    return r;
  },
});
let ids = 0;
const sid = () => (0xb0000000 + ++ids).toString(16).padEnd(20, '0');
function rig({ stake = null, cashout = null, storage = null } = {}) {
  const store = new Map(), log = [], purse = { gold: 5000 };
  let clock = 1_000_000;
  const door = {
    stake: async (req) => { log.push(['stake', req.rid]); return stake ? stake(req) : { ok: true, data: { stake: `order-${req.rid}`, id: sid() } }; },
    cashout: async (req) => { log.push(['cashout', req.character]); return cashout ? cashout(req) : { ok: true, data: { gold: 1 } }; },
  };
  const wallet = () => ({ gold: () => purse.gold, pay: (n) => { purse.gold -= n; log.push(['pay', n]); return () => { purse.gold += n; log.push(['undo', n]); }; }, bank: (n) => { purse.gold += n; log.push(['bank', n]); } });
  const book = createCardStakes({ door, realm: realmAct(log), wallet, character: () => 'CH1', region: () => 17, storage: storage ?? { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, now: () => clock, rand: Math.random });
  return { book, store, log, purse, tick: (ms) => { clock += ms; } };
}
const receiptOf = (j, r = 100) => mintCardReceipt({ s: 'acct-me', j, r, w: 'stood' }, null, { subtle, nowS: 1000 });

test('AUDIT CARDS-4 C1: a lost first answer, then the join and the asking again - the stake the service takes NOW is paid from the purse once; a repeat (the record paid it before the join) is not', async () => {
  let mode = 'lost';
  const r = rig({ stake: (req) => (mode === 'lost' ? { ok: false, error: 'offline', unknown: true } : { ok: true, data: { stake: `order-${req.rid}`, id: sid(), repeat: mode === 'repeat' } }) });
  await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 500 });
  assert.equal(r.purse.gold, 4500, 'held while unknown');
  r.purse.gold = 5000;   // the join: the record's save, which never paid it
  mode = 'new';
  await r.book.recover();
  assert.equal(r.purse.gold, 4500, 'the service took it now: the purse pays it, before the act\'s checkpoint');
  const q = rig({ stake: (req) => (mode === 'lost' ? { ok: false, error: 'offline', unknown: true } : { ok: true, data: { stake: `order-${req.rid}`, id: sid(), repeat: true } }) });
  mode = 'lost';
  await q.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 500 });
  q.purse.gold = 4500;   // the join: the record's save, which had paid it
  mode = 'repeat';
  await q.book.recover();
  assert.equal(q.purse.gold, 4500, 'a repeat: the record had paid it - nothing more');
});

test('AUDIT CARDS-4 C2: asked again and answered by the session (offline, busy, the session gone) - kept; refused by the service - let go', async () => {
  for (const [answer, keep] of [[{ ok: false, error: 'offline', why: 'offline' }, true], [{ ok: false, error: 'busy', why: 'busy' }, true], [{ ok: false, error: 'unknown' }, true], [{ ok: false, error: 'cards-realm' }, false], [{ ok: false, error: 'realm-gold' }, false], [{ ok: false, error: 'bad-buy-in' }, false]]) {
    let first = true;
    const r = rig({ stake: () => (first ? { ok: false, error: 'offline', unknown: true } : answer) });
    await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 500 });
    first = false;
    await r.book.recover();
    assert.equal(r.store.get(CARD_STAKES_KEY).length, keep ? 1 : 0, JSON.stringify(answer));
  }
  assert.equal(cardStakeRefused('held'), false);
});

test('AUDIT CARDS-4 C3: a receipt the storage would not keep is not acked - the room keeps owing it', async () => {
  const store = new Map();
  const full = { get: (k) => store.get(k), set: (k, v) => { if (k === CARD_RECEIPTS_KEY) throw new Error('quota'); store.set(k, v); } };
  const r = rig({ storage: full });
  assert.equal(r.book.receive(await receiptOf(sid())), null);
});

test('AUDIT CARDS-4 C6: past the bound a sat stake goes first and a receipt never; a stake past what anything can bring home goes; a request the device cannot keep is never asked', async () => {
  const r = rig();
  const first = await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  r.book.seated(first.id);
  for (let i = 1; i < CARD_KEPT_MAX; i++) await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  const unsat = r.store.get(CARD_STAKES_KEY).filter((x) => !x.sat)[0];
  await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 });
  const kept = r.store.get(CARD_STAKES_KEY);
  assert.equal(kept.length, CARD_KEPT_MAX);
  assert.ok(!kept.some((x) => x.id === first.id), 'the sat stake went');
  assert.ok(kept.some((x) => x.id === unsat.id), 'the oldest unsat stake stayed');
  const asks = r.log.filter((x) => x[0] === 'stake').length;
  assert.equal((await r.book.stake({ room: 'interior:a', table: 0, bb: 10, amount: 200 })).error, 'cards-kept-full');
  assert.equal(r.log.filter((x) => x[0] === 'stake').length, asks, 'never asked');
  // receipts: the bound never drops one kept
  const q = rig({ cashout: () => ({ ok: false, error: 'server' }) });
  const js = [];
  for (let i = 0; i < CARD_KEPT_MAX; i++) { const j = sid(); js.push(j); assert.equal(q.book.receive(await receiptOf(j)), j); }
  assert.equal(q.book.receive(await receiptOf(sid())), null, 'the one past the bound is not kept, so not acked');
  assert.deepEqual(q.store.get(CARD_RECEIPTS_KEY).map((x) => x.j), js, 'every one kept, kept');
  // a stake past its keeping goes
  r.tick(CARD_STAKE_KEEP_MS + 1);
  r.book.prune();
  assert.equal(r.store.get(CARD_STAKES_KEY).length, 0);
});

test('AUDIT CARDS-4 C8: a receipt heard while a claim runs is claimed by that claim', async () => {
  let release;
  const gate = new Promise((res) => { release = res; });
  let calls = 0;
  const r = rig({ cashout: async () => { calls++; if (calls === 1) await gate; return { ok: true, data: { gold: 5 } }; } });
  r.book.receive(await receiptOf(sid()));
  const running = r.book.claim();
  await new Promise((res) => setTimeout(res, 0));
  r.book.receive(await receiptOf(sid()));
  r.book.claim();
  release();
  await running;
  assert.equal(calls, 2);
  assert.deepEqual(r.store.get(CARD_RECEIPTS_KEY), []);
});

test('AUDIT CARDS-4 C5, C7: a stake\'s or a table kind\'s refusal loses the pending chair; the host says a lost answer as one, a stake never asked as "try again"', () => {
  for (const w of ['gold table', 'friendly table', 'stake spent', 'stake refused', 'stake elsewhere', 'stakes closed', 'bad stake', 'cashed out']) {
    assert.ok(SIT_REFUSALS.includes(w), w);
    const t = new RemoteCardTable({ myId: 'me', chair: 1 });
    t.ingest({ table: 0, error: w });
    assert.equal(t.lost?.why, 'refused', w);
  }
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /unknown: 'The realm did not answer - your stake will be settled when it does\.', offline: 'The realm could not be reached - try again\.'/);
  assert.match(wm, /say\(\(r\.unknown \? CARD_STAKE_REFUSALS\.unknown : CARD_STAKE_REFUSALS\[r\.error\]\) \?\? /);
});

test('AUDIT CARDS-4 E2: a claim with nothing to claim lets the latch go - the next claim claims', async () => {
  const r = rig();
  await r.book.claim();   // nothing kept: the round awaits nothing
  r.book.receive(await receiptOf(sid()));
  await r.book.claim();
  assert.deepEqual(r.store.get(CARD_RECEIPTS_KEY), [], 'claimed - the latch was let go');
});
