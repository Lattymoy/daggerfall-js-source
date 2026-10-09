// SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
// menu. It should show notifications whenever players have a message. First use is to utilize it for players being
// granted items."): THE SERVICE'S SIDE - migration 0093 (server_post), server-account/src/post.js and its four routes,
// the heartbeat's `post` part. A piece is the developers' to one registered account; its item is claimed into the
// realm character being played, written into the record by the service in the claim's own batch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, realmAt } from './realmSeat.mjs';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { HEARTBEAT_PARTS } from '../server-account/src/heartbeat.js';
import { claimPost, deletePost, readPost, postBoxOf } from '../server-account/src/post.js';
import { POST_SENDER, POST_BOX_MAX, POST_ID_RE, postHead, postWhole, postItemHead, unclaimedOf } from '../src/net/postLaw.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { mintHourlock } from '../src/systems/gilded.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A piece, as the operator's statement writes one (tools/sendServerPost.mjs). */
const send = (env, who, { batch = 'test-batch', subject = 'A gift', body = 'For you.', item = null, at = T0 } = {}) => {
  const id = `p${Math.random().toString(16).slice(2).padEnd(20, '0')}`.slice(0, 24);
  const r = env.DB._raw.prepare('INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, who.id, batch, POST_SENDER, subject, body, item ? JSON.stringify(item) : null, at);
  return Number(r.changes) ? id : null;
};
const box = async (svc, who) => {
  const res = await svc.fetch('https://accounts.invalid/v1/post/box', { method: 'GET', headers: { authorization: `Bearer ${who.secret}` } });
  return { status: res.status, body: await res.json() };
};
/** The record a realm character's row names, parsed. */
const recordOf = (env, id) => {
  const row = env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id);
  return JSON.parse(new TextDecoder().decode(env.SAVES._map.get(row.obj)));
};

test('SERVER-POST the table and the doors: 0093 lays server_post - one piece a batch an account; four routes behind a session, none open; a guest refused every one (post-needs-account, 403); the box a GET; every word the routes answer has a sentence (mutants: a batch sent twice; the wall dropped)', async () => {
  const mig = src('server-account/migrations/0093_server_post.sql');
  assert.match(mig, /CREATE TABLE IF NOT EXISTS server_post \(/);
  assert.match(mig, /CREATE UNIQUE INDEX IF NOT EXISTS ux_server_post_batch ON server_post \(to_id, batch\);/);
  assert.match(mig, /FOREIGN KEY \(to_id\) REFERENCES players\(id\) ON DELETE CASCADE/);
  for (const r of ['/v1/post/box', '/v1/post/read', '/v1/post/claim', '/v1/post/delete']) { assert.ok(ROUTES.has(r), r); assert.ok(!OPEN_ROUTES.has(r), r); }
  assert.ok(HEARTBEAT_PARTS.includes('post'));
  for (const w of ['post-needs-account', 'no-post', 'post-no-item', 'post-claimed', 'post-unclaimed']) assert.equal(typeof REFUSALS[w], 'string', w);

  const svc = await standService();
  const ann = await svc.registered('Ann');
  assert.ok(send(svc.env, ann, { batch: 'once' }));
  assert.equal(send(svc.env, ann, { batch: 'once' }), null, 'the same batch to the same account is sent once');
  assert.ok(send(svc.env, ann, { batch: 'twice' }), 'another batch is another piece');

  const g = await svc.guest();
  const guest = { secret: g.secret, id: g.id };
  assert.deepEqual(await box(svc, guest), { status: 403, body: { error: 'post-needs-account' } });
  for (const [path, body] of [['/v1/post/read', { id: 'x'.repeat(24) }], ['/v1/post/claim', { id: 'x'.repeat(24), character: 'r' + '0'.repeat(20) }], ['/v1/post/delete', { id: 'x'.repeat(24) }]]) {
    assert.deepEqual(await svc.call(path, body, guest.secret), { status: 403, body: { error: 'post-needs-account' } }, path);
  }
  assert.equal((await svc.call('/v1/post/box', {}, ann.secret)).status, 405, 'the box is a GET');
  const res = await svc.fetch('https://accounts.invalid/v1/post/read', { method: 'GET', headers: { authorization: `Bearer ${ann.secret}` } });
  assert.equal(res.status, 405, 'the rest are POSTs');
});

test('SERVER-POST the box and a piece opened: newest first, heads alone - the item\'s name and rarity, never its record or a body; unread and unclaimed counted; opened, the whole piece and it reads read; another\'s piece is no piece; a message alone is never unclaimed (mutants: the body in the box; the record in the box; read never stamped; another\'s piece read)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob');
  const gun = mintHourlock();
  const words = send(svc.env, ann, { batch: 'words', subject: 'Welcome', body: 'Hello there.', at: T0 });
  const gift = send(svc.env, ann, { batch: 'gift', subject: 'The Hourlock', body: 'For the first clear.', item: gun, at: T0 + 10 });
  send(svc.env, bob, { batch: 'gift', item: gun, at: T0 + 20 });

  const b = await box(svc, ann);
  assert.equal(b.status, 200);
  assert.deepEqual(b.body.post.map((p) => p.id), [gift, words], 'newest first, and only Ann\'s');
  assert.deepEqual(b.body.post[0], { id: gift, from: POST_SENDER, subject: 'The Hourlock', sentAt: T0 + 10, read: false, item: { name: 'The Hourlock', rarity: 'gilded' }, claimed: false });
  assert.deepEqual(b.body.post[1].item, null);
  assert.equal(b.body.post[1].claimed, false, 'a message alone is never waiting to be claimed');
  assert.deepEqual([b.body.unread, b.body.unclaimed, b.body.max], [2, 1, POST_BOX_MAX]);
  assert.ok(!JSON.stringify(b.body).includes('For the first clear') && !JSON.stringify(b.body).includes('"affixes"'), 'no body, no record');
  // the client reads the box through the law
  assert.deepEqual(b.body.post.map(postHead), b.body.post);
  assert.equal(unclaimedOf(b.body.post), 1);

  const r = await svc.call('/v1/post/read', { id: gift }, ann.secret);
  assert.equal(r.status, 200);
  assert.equal(r.body.post.body, 'For the first clear.');
  assert.equal(r.body.post.read, true);
  assert.ok(postWhole(r.body.post), 'a whole piece by the law');
  assert.equal((await box(svc, ann)).body.unread, 1, 'opened is read');
  assert.equal((await box(svc, ann)).body.unclaimed, 1, 'and its item still waits');
  assert.deepEqual(await svc.call('/v1/post/read', { id: gift }, bob.secret), { status: 404, body: { error: 'no-post' } }, 'Ann\'s is not Bob\'s');
  assert.deepEqual(await svc.call('/v1/post/read', { id: 'not an id' }, ann.secret), { status: 404, body: { error: 'no-post' } });
  assert.equal(postItemHead({ name: 'x', rarity: 'NOT ONE' }).rarity, null);
  assert.ok(POST_ID_RE.test(gift));
});

test('SERVER-POST THE CLAIM: into the realm character being played - the record one on with the item in it, the piece claimed in the same batch; asked again, refused and the record unmoved; a stale record refused with the service\'s sequence; a character not the realm\'s refused; a message alone has no item; another\'s piece is no piece; then thrown away, never before (mutants: the claim unguarded; the record unwritten; claimed before the record; a waiting gift thrown away)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann'), bob = await svc.registered('Bob');
  const R = await seatRealm(svc.env, ann.secret, 'Ann', { name: 'Ann', level: 20, goldPieces: 50, items: [] });
  const gun = mintHourlock();
  const gift = send(svc.env, ann, { batch: 'gift', subject: 'The Hourlock', item: gun });
  const words = send(svc.env, ann, { batch: 'words', subject: 'Welcome' });
  const claim = (who, b) => svc.call('/v1/post/claim', b, who.secret);

  assert.deepEqual(await claim(ann, { id: gift, character: 'char-ann' }), { status: 403, body: { error: 'realm-only' } }, 'an offline character holds no claim');
  assert.deepEqual(await claim(ann, { id: gift, character: R.id }), { status: 409, body: { error: 'realm-needed' } }, 'where its record stands, or nothing');
  const stale = { ...R.at(), seq: R.at().seq + 1 };   // a record this tab never had
  assert.deepEqual(await claim(ann, { id: gift, character: R.id, realm: stale }), { status: 409, body: { error: 'seq', seq: R.at().seq } }, 'the service\'s own sequence');

  const was = R.at();
  const r = await claim(ann, { id: gift, character: R.id, realm: was });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.ok, r.body.id, r.body.realm.seq], [true, gift, was.seq + 1]);
  assert.deepEqual(r.body.item, gun, 'the record as it was sent');
  assert.equal(R.at().seq, was.seq + 1, 'the record one on');
  const rec = recordOf(svc.env, R.id);
  assert.deepEqual(rec.items, [gun], 'the item in the record');
  assert.equal(rec.goldPieces, 50, 'and nothing else moved');
  const row = svc.env.DB._raw.prepare('SELECT claimed_at, claimed_by, read_at FROM server_post WHERE id = ?').get(gift);
  assert.equal(row.claimed_by, R.id);
  assert.ok(row.claimed_at != null && row.read_at != null, 'claimed, and read with it');
  const b = (await box(svc, ann)).body;
  assert.deepEqual([b.post.find((p) => p.id === gift).claimed, b.unclaimed], [true, 0]);

  assert.deepEqual(await claim(ann, { id: gift, character: R.id, realm: R.at() }), { status: 409, body: { error: 'post-claimed' } }, 'once');
  assert.deepEqual(recordOf(svc.env, R.id).items, [gun], 'the record unmoved by the second');
  assert.deepEqual(await claim(ann, { id: words, character: R.id, realm: R.at() }), { status: 409, body: { error: 'post-no-item' } });
  const B = await seatRealm(svc.env, bob.secret, 'Bob');
  assert.deepEqual(await claim(bob, { id: gift, character: B.id, realm: B.at() }), { status: 404, body: { error: 'no-post' } }, 'Ann\'s is not Bob\'s');
  assert.deepEqual(await claim(bob, { id: gift, character: R.id, realm: R.at() }), { status: 404, body: { error: 'no-realm-character' } }, 'nor is her character');

  // THROWN AWAY: never a gift still waiting
  const second = send(svc.env, ann, { batch: 'gift-2', item: gun });
  assert.deepEqual(await svc.call('/v1/post/delete', { id: second }, ann.secret), { status: 409, body: { error: 'post-unclaimed' } });
  assert.deepEqual(await svc.call('/v1/post/delete', { id: gift }, ann.secret), { status: 200, body: { ok: true, id: gift } }, 'a claimed one may go');
  assert.deepEqual(await svc.call('/v1/post/delete', { id: words }, ann.secret), { status: 200, body: { ok: true, id: words } }, 'and words alone');
  assert.deepEqual(await svc.call('/v1/post/delete', { id: words }, ann.secret), { status: 404, body: { error: 'no-post' } }, 'gone is gone');
  assert.deepEqual((await box(svc, ann)).body.post.map((p) => p.id), [second]);
});

test('SERVER-POST the functions ask again, and the heartbeat carries the box: a claim that lost its batch leaves the piece waiting and the record where it was; the heartbeat\'s post part is the box\'s answer, a guest\'s its refusal (mutants: the claim\'s stamp outside the batch; the part unanswered)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const R = await seatRealm(svc.env, ann.secret, 'Ann');
  const gun = mintHourlock();
  const gift = send(svc.env, ann, { batch: 'gift', item: gun });
  const player = svc.env.DB._raw.prepare('SELECT * FROM players WHERE id = ?').get(ann.id);
  const ctx = { db: svc.env.DB, bucket: svc.env.SAVES, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: T0 + 100 };

  // A BATCH THAT THROWS: the record does not move and the piece still waits
  const at = R.at();
  const failing = { ...ctx, db: { ...ctx.db, prepare: ctx.db.prepare.bind(ctx.db), batch: async () => { throw new Error('D1 down'); } } };
  const r = await claimPost(failing, { ...player }, { id: gift, character: R.id, realm: at });
  assert.deepEqual(r, { error: 'server' }, 'the service\'s own failure - asked again, not "claimed"');
  assert.deepEqual(realmAt(svc.env, R.id), at, 'the record where it was');
  assert.equal(svc.env.DB._raw.prepare('SELECT claimed_at FROM server_post WHERE id = ?').get(gift).claimed_at, null, 'the piece still waiting');
  assert.deepEqual((await claimPost(ctx, { ...player }, { id: gift, character: R.id, realm: at })).ok, true, 'and claimed when asked again');

  assert.deepEqual(await readPost(ctx, { ...player }, 42), { error: 'no-post' });
  assert.deepEqual(await deletePost(ctx, { ...player }, null), { error: 'no-post' });

  const hb = await svc.call('/v1/heartbeat', { post: true }, ann.secret);
  assert.equal(hb.status, 200);
  assert.deepEqual(hb.body.post, await postBoxOf(ctx, { ...player }), 'the box\'s own answer');
  const g = await svc.guest();
  assert.deepEqual((await svc.call('/v1/heartbeat', { post: true }, g.secret)).body.post, { error: 'post-needs-account' });
  assert.deepEqual(Object.keys((await svc.call('/v1/heartbeat', { mail: true }, ann.secret)).body), ['mail'], 'not asked, not answered');
});
