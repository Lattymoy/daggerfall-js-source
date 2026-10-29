// KEEP-MARK (2026-10-29, the account database overloaded from 01:15 UTC with its read replicas serving none of it;
// bible/11-Multiplayer/Scale-Arc.md KEEP-MARK). The page forgets its D1 bookmark on a read answered with none and on a
// call that could not be made (AUDIT SCALE II A-6, C-7) - and an overload answers exactly so: a shed or a refusal says no
// position, and a read past its wait times out. Every next read then started at the primary, and the replicas' share fell
// from a quarter to none while the primary refused half the service. A replica read the service answers with no session
// position hands back the bookmark it carried, and a read that timed out keeps the page's. Each pin failed on the build
// before it. tools/mutants/keep_mark.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import { noteOverload, _resetBusyShed } from '../../server-account/src/service.js';
import { call, noteD1Bookmark, d1BookmarkFor, forgetD1Bookmark, _resetBusyForTests } from '../../src/net/accountClient.js';

const MARK = (n) => `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;
const send = (S, path, { secret, body = {}, mark = null } = {}) => S.fetch(`https://accounts.invalid${path}`, {
  method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', ...(mark ? { 'x-d1-bookmark': mark } : {}) }, body: JSON.stringify(body),
});

test('KEEP-MARK: a replica read the service sheds hands back the bookmark it carried, so the page keeps it; a write route\'s answer, or a malformed bookmark, hands back none (mutant: the carried bookmark unsaid)', async () => {
  const S = await standService();
  try {
    const who = await S.registered('Aldric');
    // a session that says no position - D1's before it has answered anything, as a shed's never has
    const open = S.env.DB.withSession.bind(S.env.DB);
    S.env.DB.withSession = (c) => {
      const s = open(c);
      return new Proxy(s, { get(t, k) { if (k === 'getBookmark') return () => null; const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
    };
    const CARRIED = MARK(0xabc);
    noteOverload(Date.now());   // this isolate met an overloaded database: its busy reads are shed
    const shed = await send(S, '/v1/homes/town', { secret: who.secret, body: { mapId: 1 }, mark: CARRIED });
    assert.equal(shed.status, 503, 'shed');
    assert.equal(shed.headers.get('x-d1-bookmark'), CARRIED, 'the bookmark it carried, said back');
    assert.match(shed.headers.get('access-control-expose-headers') ?? '', /x-d1-bookmark/);
    const bad = await send(S, '/v1/homes/town', { secret: who.secret, body: { mapId: 1 }, mark: 'not a bookmark!' });
    assert.equal(bad.headers.get('x-d1-bookmark'), null, 'a malformed one is never said back');
    _resetBusyShed();
    const write = await send(S, '/v1/renown/xp', { secret: who.secret, body: { character: who.character, xp: 1, rid: 'k1' }, mark: CARRIED });
    assert.equal(write.headers.get('x-d1-bookmark'), null, 'a write route says no bookmark it did not make');
  } finally { _resetBusyShed(); }
});

test('KEEP-MARK: a bookmark read that timed out keeps the page\'s bookmark; a call that could not be made, or a write that timed out, still lets it go (mutants: a timeout forgets it; a write\'s timeout keeps it)', async () => {
  const SEC = 'secret-keepmark-0123456789';
  const timeout = async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); };
  const refused = async () => { throw new TypeError('Failed to fetch (CORS preflight)'); };
  forgetD1Bookmark();
  _resetBusyForTests();
  noteD1Bookmark(SEC, MARK(9));
  assert.deepEqual(await call({ fetch: timeout, secret: SEC }, '/v1/prof/pixels', { pixels: [[1, 1]] }), { ok: false, error: 'offline' });
  assert.equal(d1BookmarkFor(SEC), MARK(9), 'a read past its wait keeps the bookmark');
  _resetBusyForTests();
  await call({ fetch: refused, secret: SEC }, '/v1/prof/pixels', { pixels: [[1, 1]] });
  assert.equal(d1BookmarkFor(SEC), null, 'AUDIT SCALE II A-6: a call that could not be made lets it go');
  // a write that timed out may have landed: a bookmark a read brought back while it was out may stand before it
  let release;
  const held = new Promise((r) => { release = r; });
  const writing = call({ fetch: async () => { await held; throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }, secret: SEC }, '/v1/renown/xp', { xp: 1 });
  const answered = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'x-d1-bookmark': MARK(10) } });
  await call({ fetch: answered, secret: SEC }, '/v1/prof/pixels', { pixels: [[1, 1]] });
  assert.equal(d1BookmarkFor(SEC), MARK(10), 'a read while the write is out');
  release();
  await writing;
  assert.equal(d1BookmarkFor(SEC), null, 'the write timed out: the bookmark goes');
  forgetD1Bookmark();
  _resetBusyForTests();
});
