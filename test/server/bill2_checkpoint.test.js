// BILL2 (2026-10-24, Mac, of the D1 writes BILL1 left: "Dig into that on top of this PR"; bible/11-Multiplayer/Bill-Arc.md
// section 5): THE CHECKPOINT, WHAT IT WRITES AND WHY IT WENT. D1 wrote 11 million rows on 2026-10-23, and the realm's
// checkpoint route a third of them - 608,000 puts, 5.6 rows each, an R2 object each (R2's whole Class A line) - while the
// five-minute timer accounts for about a fifth of the puts. A checkpoint now says on its put why it went (`?w=`: the
// timer's `tick`, a page put away's `hide`, any other `act`), and the service's metrics point counts each - so the next
// reading can say which costs what before any save's timing moves; and a checkpoint touches `updated_at` (in
// realm_characters_player's index: a second row every put) only once it is REALM_TOUCH_S old. Driven through the real
// Worker over node:sqlite (test/accountDb.mjs) and the real realm session.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { REALM_TOUCH_S } from '../../server-account/src/realm.js';
import { checkpointPartsOf } from '../../server-account/src/metrics.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { realmIo, realmCreate, realmPut, openRealmBoot, createRealmSession } from '../../src/systems/realmSaves.js';
import { CHECKPOINT_WHYS, checkpointWhyOf, checkpointWhyOk } from '../../src/net/realm/realmSaveCodec.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { d1 } from '../accountDb.mjs';
import { r2, freshSave, layRecord } from '../realmSeat.mjs';

const T0 = 1_800_000_000;
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
const save = (gold) => JSON.stringify({ v: 1, name: 'SwordsmanEB', level: 12, goldPieces: gold });

/** One account and one device on the real Worker; every put's URL kept, every metrics point kept, the clock by hand. */
async function joined() {
  _resetKeyForTests();
  const points = [];
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1', METRICS: { writeDataPoint: (p) => points.push(p) } };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret })]]);
  const storage = { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  const puts = [];
  const fetch = async (url, init) => { if (init?.method === 'PUT') puts.push(String(url)); return worker.fetch(new Request(url, init), env); };
  const io = realmIo({ fetch, storage });
  const made = (await realmCreate(io, 'SwordsmanEB')).data;
  assert.equal((await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: 'SwordsmanEB' })))).ok, true);
  layRecord(env, made.id, JSON.parse(save(100)));
  const boot = await openRealmBoot({ io, id: made.id });
  let hide = false;
  const session = createRealmSession({ io, id: made.id, lease: boot.lease, seq: boot.seq, gzip: false, later: () => () => {}, hidden: () => hide, watchHidden: () => {} });
  const row = () => env.DB._raw.prepare('SELECT seq, updated_at, lease_at FROM realm_characters WHERE id = ?').get(made.id);
  return { env, points, puts, session, row, setHidden: (v) => { hide = v; } };
}
const dataPoints = (points) => points.filter((p) => p.blobs?.[0] === '/v1/realm/:id/data' && p.blobs?.[1] === 'PUT');

test('BILL2: a checkpoint\'s why is one of three known words, sorted and joined - the law both ends read (mutants: an unsorted word taken; an unknown one counted)', () => {
  assert.deepEqual(CHECKPOINT_WHYS, ['act', 'hide', 'tick']);
  assert.equal(checkpointWhyOf(['tick', 'act', 'act']), 'act,tick');
  assert.equal(checkpointWhyOf(['nope', 'hide']), 'hide');
  assert.equal(checkpointWhyOf(null), '');
  for (const w of ['act', 'hide', 'tick', 'act,hide', 'act,hide,tick']) assert.equal(checkpointWhyOk(w), true, w);
  for (const w of ['', 'hide,act', 'act,act', 'tock', 'act,', ',act', 7, null]) assert.equal(checkpointWhyOk(w), false, String(w));
  assert.equal(checkpointPartsOf('act,tick'), 'w:act,tick');
  assert.equal(checkpointPartsOf('drop table'), '');
});

test('BILL2: the realm session says on each put why its checkpoints went - the timer\'s `tick`, a hidden page\'s `hide`, any other `act`, several a put sorted - and the service\'s metrics point counts it (mutants: the timer called an act; the word left off the put; the service not counting it; a queued checkpoint\'s why dropped)', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const { points, puts, session, setHidden } = await joined();
    puts.length = 0; points.length = 0;
    assert.equal((await session.idle(() => session.checkpoint(save(101)))).ok, true);
    assert.equal((await session.checkpoint(save(102))).ok, true);
    setHidden(true);
    assert.equal((await session.checkpoint(save(103))).ok, true);
    setHidden(false);
    // one put in flight, two more asked under it: the second put carries both
    const first = session.checkpoint(save(104));
    setHidden(true);
    const second = session.checkpoint(save(105));
    setHidden(false);
    const third = session.checkpoint(save(106));
    assert.deepEqual((await Promise.all([first, second, third])).map((r) => r.ok), [true, true, true]);
    await settle();
    assert.deepEqual(puts.map((u) => new URL(u).searchParams.get('w')), ['tick', 'act', 'hide', 'act', 'act,hide']);
    assert.deepEqual(dataPoints(points).map((p) => p.blobs[5]), ['w:tick', 'w:act', 'w:hide', 'w:act', 'w:act,hide'], 'blob6, the point\'s parts');
  } finally {
    Date.now = realNow;
  }
});

test('BILL2: a checkpoint touches the character\'s updated_at only once it is REALM_TOUCH_S old - its lease_at every time, so "Playing now" is as it was (mutants: always touched; never touched)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock * 1000;
  try {
    const { session, row } = await joined();
    assert.equal(REALM_TOUCH_S, 600);
    const was = row().updated_at;
    clock += 60;
    assert.equal((await session.checkpoint(save(110))).ok, true);
    assert.deepEqual([row().updated_at, row().lease_at], [was, clock], 'a minute on: updated_at kept, the lease renewed');
    clock += REALM_TOUCH_S - 61;
    assert.equal((await session.checkpoint(save(111))).ok, true);
    assert.equal(row().updated_at, was, `${REALM_TOUCH_S - 1} s old: kept`);
    clock += 1;
    assert.equal((await session.checkpoint(save(112))).ok, true);
    assert.deepEqual([row().updated_at, row().lease_at], [clock, clock], `${REALM_TOUCH_S} s old: touched`);
  } finally {
    Date.now = realNow;
  }
});
