// FIRM1 (2026-10-13) - THIS DEVICE'S FIRMAMENT (src/net/firmament/firmamentBook.js): the state read, a change asked under its own id,
// ASYNC NEVER DROPS - a change asked while another is on its way waits behind it, the newest winning, never dropped and
// never asked beside it - a change whose answer did not come KEPT and asked again with the SAME id at the next read, and a
// refusal the service gave after it looked let go and the state read again. bible/06-Systems/Firmament.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFirmamentBook, FIRM_KEPT_KEY } from '../../../src/net/firmament/firmamentBook.js';
import { packTree } from '../../../src/net/firmament/firmamentLaw.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
let n = 0;
const rid = () => `fbooktest${String(++n).padStart(4, '0')}`;
/** A door over a pretend service: the tree it holds, every ask written down, an answer held until `release`. */
function door({ hold = false, refuse = null } = {}) {
  const asks = [];
  let tree = '';
  const waiting = [];
  const answer = (t) => ({ ok: true, data: { tree: t, renown: 20, stars: 19, craft: 4, ranks: { mining: 32 }, refund: { freeBelow: 10, perStar: 10 } } });
  return {
    asks, waiting,
    account: () => 'acct-1',
    state: async () => { asks.push(['state']); return answer(tree); },
    set: (character, t, id) => {
      asks.push(['set', t, id]);
      const go = () => { if (refuse) return { ok: false, error: refuse }; tree = t; return answer(t); };
      if (!hold) return Promise.resolve(go());
      return new Promise((res) => waiting.push(() => res(go())));
    },
    release() { while (waiting.length) waiting.shift()(); },
  };
}

test('FIRM1 book: the state read - the tree, the purses, what is left', async () => {
  const d = door();
  const b = createFirmamentBook({ door: d, character: () => 'char-1', rid });
  assert.equal(await b.read(), true);
  assert.deepEqual([b.state.open, b.state.stars, b.state.craft, b.state.renown], [true, 19, 4, 20]);
  assert.deepEqual(b.left(), { stars: 19, craft: 4 });
});

test('FIRM1 book: ASYNC NEVER DROPS - a change asked while one is in flight waits, the newest of them wins, each asked once', async () => {
  const d = door({ hold: true });
  const b = createFirmamentBook({ door: d, character: () => 'char-1', rid });
  const first = b.commit({ start: 'wr.start', keys: ['wr.s1'] });
  const second = b.commit({ start: 'wr.start', keys: ['wr.s1', 'wr.s2'] });
  const third = b.commit({ start: 'wr.start', keys: ['wr.s1', 'wr.s2', 'wr.g'] });
  assert.deepEqual((await second).queued, true);
  assert.deepEqual((await third).queued, true);
  assert.equal(d.asks.filter((a) => a[0] === 'set').length, 1, 'one ask in flight');
  d.release();
  await new Promise((r) => setTimeout(r, 0));
  d.release();
  const r = await first;
  assert.equal(r.ok, true);
  const sets = d.asks.filter((a) => a[0] === 'set').map((a) => a[1]);
  assert.deepEqual(sets, [packTree({ start: 'wr.start', keys: ['wr.s1'] }), packTree({ start: 'wr.start', keys: ['wr.s1', 'wr.s2', 'wr.g'] })], 'the middle one superseded, never dropped unasked behind a newer');
  assert.deepEqual(b.current(), { start: 'wr.start', keys: ['wr.g', 'wr.s1', 'wr.s2'] });
});

test('FIRM1 book: a change whose answer did not come is KEPT and asked again at the next read with the same id; a refusal after looking lets it go', async () => {
  const storage = memory();
  const lost = door({ refuse: 'offline' });
  const b = createFirmamentBook({ door: lost, storage, character: () => 'char-1', rid });
  const r = await b.commit({ start: 'mg.start', keys: ['mg.s1'] });
  assert.deepEqual(r, { ok: false, error: 'offline' });
  const kept = JSON.parse(storage.getItem(FIRM_KEPT_KEY))['acct-1|char-1'];
  assert.equal(kept.tree, 'mg.start|mg.s1');
  const back = door();
  const b2 = createFirmamentBook({ door: back, storage, character: () => 'char-1', rid });
  await b2.read();
  assert.deepEqual(back.asks[0], ['set', 'mg.start|mg.s1', kept.rid], 'the same id, asked first');
  assert.equal(JSON.parse(storage.getItem(FIRM_KEPT_KEY))['acct-1|char-1'], undefined);
  assert.deepEqual(b2.current(), { start: 'mg.start', keys: ['mg.s1'] });
  // a refusal the service gave after it looked: let go, and the state read again
  const no = door({ refuse: 'firm-points' });
  const b3 = createFirmamentBook({ door: no, storage, character: () => 'char-1', rid });
  const r3 = await b3.commit({ start: 'mg.start', keys: ['mg.s1', 'mg.s2'] });
  assert.deepEqual(r3, { ok: false, error: 'firm-points' });
  assert.equal(JSON.parse(storage.getItem(FIRM_KEPT_KEY))['acct-1|char-1'], undefined);
  assert.deepEqual(no.asks.at(-1), ['state']);
});

test('FIRM1 book: THE RESPEC - the realm\'s act with the gold reserved (a refusal gives it back); a purse that cannot pay is never asked', async () => {
  const d = door();
  const asks = [];
  d.respec = async (character, id, at, region) => { asks.push([character, id, at, region]); return d.refuse ?? { ok: true, data: { tree: '', renown: 20, stars: 19, craft: 4, ranks: {}, refund: { freeBelow: 10, perStar: 10 }, respec: true } }; };
  let gold = 12_000;
  const wallet = () => ({ gold: () => gold, pay: (n) => { gold -= n; return () => { gold += n; }; }, region: () => 17 });
  const realm = { act: async ({ reserve, call }) => { const undo = reserve(); const r = await call({ id: 'R', lease: 'L', seq: 3 }); if (!r.ok) undo(); return r; } };
  const b = createFirmamentBook({ door: d, character: () => 'char-1', rid, realm, wallet });
  await b.read();
  assert.equal(b.canRespec(), false, 'an empty sky');
  await b.commit({ start: 'mg.start', keys: [] });
  assert.equal(b.canRespec(), true);
  d.refuse = { ok: false, error: 'realm-gold' };
  assert.deepEqual(await b.respec(), { ok: false, error: 'realm-gold' });
  assert.equal(gold, 12_000, 'a refusal gives the gold back');
  d.refuse = null;
  assert.deepEqual(await b.respec(), { ok: true });
  assert.deepEqual([gold, b.state.tree.start, asks.at(-1)[2], asks.at(-1)[3]], [2_000, null, { id: 'R', lease: 'L', seq: 3 }, 17]);
  await b.commit({ start: 'mg.start', keys: [] });
  assert.deepEqual([b.canRespec(), await b.respec(), asks.length], [false, { ok: false, error: 'firm-gold' }, 2], 'too little gold: never asked');
});
