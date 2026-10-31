// BOUND-DESTROY (FIELD FEEDBACK 2026-10-31, "Soulbound items need to be disposable, certain aetheric sets and hearth
// offerings."): THE ACCOUNT SERVICE LETS SOUL CAKES AND HEARTH OFFERINGS GO - the REAL function over the REAL migrations
// (test/accountDb.mjs, migrations 0140 and 0204) and the route through the Worker: guarded by the count, one let-go a
// request id, on any day and under any switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { ROUTES, ACCOUNT_VERSION } from '../../server-account/src/service.js';
import { discardFestival, FEST_STATUS } from '../../server-account/src/festival.js';
import { FESTIVALS } from '../../src/net/festivalLaw.js';

const AFTER_S = FESTIVALS[0].toMs / 1000 + 86_400;

async function stand(env = {}) {
  const S = await standService(env);
  const alice = await S.registered('Alice');
  const db = S.env.DB;
  const row = (who) => ({ ...db._raw.prepare('SELECT fest_cakes, fest_bowls FROM players WHERE id = ?').get(who.id) });
  const lay = (who, cakes, bowls) => db._raw.prepare('UPDATE players SET fest_cakes = ?, fest_bowls = ? WHERE id = ?').run(cakes, bowls, who.id);
  const player = (who) => ({ id: who.id, handle: who.handle });
  const ctx = (nowS = AFTER_S) => ({ db, nowS });
  return { S, alice, db, row, lay, player, ctx };
}

test('BOUND-DESTROY the route: behind a session, through the Worker after the festival with its switch off - a let-go answers the counts, the same id again moves nothing, a count short is refused with the counts; a guest is the session\'s 403 (mutants: the route unwired; the closed festival refusing it)', async () => {
  assert.ok(ROUTES.has('/v1/festival/discard'));
  assert.equal(ACCOUNT_VERSION, 'acct233');
  const { S, alice, row, lay } = await stand();   // FESTIVAL_OPEN unset: shut
  lay(alice, 9, 3);
  const a = await S.call('/v1/festival/discard', { kind: 'bowls', n: 2, rid: 'aaaaaaaaaaaa' }, alice.secret);
  assert.deepEqual([a.status, a.body], [200, { cakes: 9, bowls: 1 }]);
  const again = await S.call('/v1/festival/discard', { kind: 'bowls', n: 2, rid: 'aaaaaaaaaaaa' }, alice.secret);
  assert.deepEqual([again.status, again.body], [200, { repeat: true, cakes: 9, bowls: 1 }], 'asked again: answered, nothing moved');
  assert.deepEqual(row(alice), { fest_cakes: 9, fest_bowls: 1 });
  const short = await S.call('/v1/festival/discard', { kind: 'bowls', n: 2, rid: 'aaaaaaaaaaab' }, alice.secret);
  assert.deepEqual([short.status, short.body], [400, { error: 'count', cakes: 9, bowls: 1 }]);
  const cakes = await S.call('/v1/festival/discard', { kind: 'cakes', n: 9, rid: 'aaaaaaaaaaac' }, alice.secret);
  assert.deepEqual([cakes.status, cakes.body], [200, { cakes: 0, bowls: 1 }]);
  const g = await S.guest();
  const guest = await S.call('/v1/festival/discard', { kind: 'cakes', n: 1, rid: 'aaaaaaaaaaad' }, g.secret);
  assert.deepEqual([guest.status, guest.body?.error], [403, 'guest']);
  assert.equal(FEST_STATUS.guest, 403);
});

test('BOUND-DESTROY discardFestival: the request id\'s row decides - laid only while the count holds n, the count down where it was laid; every bad word refused with nothing moved (mutants: the guard gone; the count down twice; a word unchecked)', async () => {
  const { alice, row, lay, player, ctx, db } = await stand();
  lay(alice, 5, 2);
  const p = player(alice);
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'bowls', n: 1, rid: 'nope' }), { error: 'rid' });
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'bowls', n: 1 }), { error: 'rid' });
  assert.deepEqual(await discardFestival(ctx(), { id: alice.id, handle: null }, { kind: 'bowls', n: 1, rid: 'bbbbbbbbbbbb' }), { error: 'guest' });
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'gold', n: 1, rid: 'bbbbbbbbbbbb' }), { error: 'kind' });
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'toString', n: 1, rid: 'bbbbbbbbbbbb' }), { error: 'kind' }, 'no word off the prototype');
  for (const n of [0, -1, 1.5, '1', null]) assert.deepEqual(await discardFestival(ctx(), p, { kind: 'bowls', n, rid: 'bbbbbbbbbbbb' }), { error: 'count', cakes: 5, bowls: 2 }, `n ${n}`);
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'bowls', n: 3, rid: 'bbbbbbbbbbbb' }), { error: 'count', cakes: 5, bowls: 2 }, 'more than held');
  assert.deepEqual(row(alice), { fest_cakes: 5, fest_bowls: 2 }, 'nothing moved');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS c FROM fest_discards').get().c, 0, 'and no id laid for a refusal');
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'bowls', n: 2, rid: 'bbbbbbbbbbbb' }), { cakes: 5, bowls: 0 }, 'exactly what is held');
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'cakes', n: 2, rid: 'bbbbbbbbbbbc' }), { cakes: 3, bowls: 0 });
  assert.deepEqual(db._raw.prepare('SELECT kind, n FROM fest_discards WHERE account = ? ORDER BY rid').all(alice.id).map((r) => ({ ...r })), [{ kind: 'bowls', n: 2 }, { kind: 'cakes', n: 2 }]);
});

test('BOUND-DESTROY ONE ID, ONE LET-GO: two asks by the same id at once take the count down once, and both are answered (mutants: the count down twice)', async () => {
  const { alice, row, lay, player, ctx } = await stand();
  lay(alice, 10, 0);
  const p = player(alice);
  const [x, y] = await Promise.all([
    discardFestival(ctx(), p, { kind: 'cakes', n: 4, rid: 'cccccccccccc' }),
    discardFestival(ctx(), p, { kind: 'cakes', n: 4, rid: 'cccccccccccc' }),
  ]);
  assert.deepEqual(row(alice), { fest_cakes: 6, fest_bowls: 0 }, 'once');
  assert.deepEqual([x, y].map((r) => r.cakes), [6, 6]);
  assert.equal([x, y].filter((r) => r.repeat === true).length, 1, 'the second is the first\'s repeat');
  // two ids at once for the last of the count: one lets it go, the other is short
  lay(alice, 3, 0);
  const both = await Promise.all([
    discardFestival(ctx(), p, { kind: 'cakes', n: 3, rid: 'dddddddddddd' }),
    discardFestival(ctx(), p, { kind: 'cakes', n: 3, rid: 'ddddddddddde' }),
  ]);
  assert.deepEqual(row(alice), { fest_cakes: 0, fest_bowls: 0 });
  assert.deepEqual(both.map((r) => r.error ?? 'ok').sort(), ['count', 'ok']);
});

// AUDIT FB1031 D1: a let-go whose answer was lost kept its id for "the same ask" however long after - five cakes found
// again and destroyed reused it, the service answered the old let-go, and the page said Destroyed with nothing moved.
test('AUDIT FB1031 D1: a count heard since a lost let-go makes the next press a new ask - five found again are let go (mutant: the kept id never spent by a count)', async () => {
  await import('../modsOff.js');
  const { accountFestival, SESSION_KEY } = await import('../../src/net/accountClient.js');
  const { bindFestival, refreshFestival, _resetFestivalClientForTests } = await import('../../src/systems/festival/festivalClient.js');
  const { destroyPiece } = await import('../../src/systems/item/itemDiscard.js');
  const { isSoulCake } = await import('../../src/systems/festival/soulCake.js');
  const Sv = await standService();
  const alice = await Sv.registered('Alice');
  const raw = Sv.env.DB._raw;
  const lay = (c) => raw.prepare('UPDATE players SET fest_cakes = ? WHERE id = ?').run(c, alice.id);
  const count = () => raw.prepare('SELECT fest_cakes FROM players WHERE id = ?').get(alice.id).fest_cakes;
  const store = new Map();
  const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
  const realStorage = globalThis.localStorage;
  globalThis.localStorage = mem;
  store.set(SESSION_KEY, JSON.stringify({ secret: alice.secret, id: alice.id, name: 'Alice', kind: 'linked' }));
  let lose = false;
  const fetch = async (u, i) => {
    const res = await Sv.fetch(u, i);
    if (lose && String(u).endsWith('/v1/festival/discard')) { lose = false; throw new TypeError('the answer lost'); }
    return res;
  };
  try {
    _resetFestivalClientForTests();
    const entity = { isPlayer: true, items: [] };
    bindFestival({ online: () => true, entity: () => entity, say: () => {}, selfId: () => 'me', saved: () => {}, api: accountFestival({ fetch, storage: mem }), nowMs: () => Date.now() });
    const cake = () => entity.items.find(isSoulCake);
    lay(5); await refreshFestival();
    lose = true;
    await destroyPiece(cake(), { items: entity.items });
    await refreshFestival();
    assert.equal(count(), 0, 'the lost let-go landed');
    lay(5); await refreshFestival();
    const r = await destroyPiece(cake(), { items: entity.items });
    assert.deepEqual([r.ok, count(), cake() ?? null], [true, 0, null], 'the new five let go, and the pack says so');
  } finally {
    _resetFestivalClientForTests();
    globalThis.localStorage = realStorage;
  }
});

// AUDIT FB1031 D3: the let-go spends the festival's hourly ask budget as every other festival act does; no pin read it.
test('AUDIT FB1031 D3: past FEST_OPS_MAX asks in the hour a let-go is answered rate, nothing moved (mutant: the budget unread)', async () => {
  const { FEST_OPS_MAX } = await import('../../server-account/src/festival.js');
  const { alice, row, lay, player, ctx } = await stand();
  lay(alice, 5, 2);
  const p = player(alice);
  for (let i = 0; i < FEST_OPS_MAX; i++) await discardFestival(ctx(), p, { kind: 'bowls', n: 9, rid: 'bbbbbbbbbbbb' });   // refused 'count', each spending one ask
  assert.deepEqual(await discardFestival(ctx(), p, { kind: 'bowls', n: 1, rid: 'bbbbbbbbbbbd' }), { error: 'rate' });
  assert.deepEqual(row(alice), { fest_cakes: 5, fest_bowls: 2 });
});
