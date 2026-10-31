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
