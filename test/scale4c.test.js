// SCALE4c (2026-10-08, Mac: "Do 1 2 and 3" - the scaling audit's "one heartbeat replacing the mail, beat and board
// polls"; bible/11-Multiplayer/Scale-Arc.md SCALE4c): a tab's three clocks - the play beat, the letterbox, the board of
// the town it stands in - ride ONE request (src/net/heartbeat.js -> /v1/heartbeat, server-account/src/heartbeat.js),
// each part answered exactly as its own route answers it and each clock at its own pace. The service's half over the
// real Worker on node:sqlite (test/accountDb.mjs); the client's over fake clocks; the world host's wiring by its text.
// Each pin failed on the build before it. tools/mutants/scale4c.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from './accountDb.mjs';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { HEARTBEAT_PARTS } from '../server-account/src/heartbeat.js';
import {
  createHeartbeat, partAnswer, whileLive, HEARTBEAT_TICK_MS, RIDE_EARLY_MS, BEAT_RIDE_MS,
} from '../src/net/heartbeat.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import { MailBox, MAIL_POLL_MS } from '../src/net/mail.js';
import { createNoticeBook, NOTICE_TRIES } from '../src/net/noticeBook.js';
import { BOARD_CACHE_MS } from '../src/net/boardLaw.js';
import { PLAY_BEAT_S, PLAY_GRACE_S } from '../src/net/playClock.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);

/** The service's database, every statement it is asked counted. */
function counted(s) {
  const base = s.env.DB;
  const c = { n: 0 };
  s.env.DB = { _raw: base._raw, prepare(sql) { c.n++; return base.prepare(sql); }, batch: (list) => base.batch(list) };
  return c;
}
const get = async (s, path, secret) => {
  const r = await s.fetch(`https://accounts.invalid${path}`, { method: 'GET', headers: { authorization: `Bearer ${secret}` } });
  return { status: r.status, body: await r.json() };
};

// ═══ A. THE SERVICE ══════════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE4c A: /v1/heartbeat is a session\'s route, and each part it carries is answered EXACTLY as its own route answers it - the box as /v1/mail/inbox, a town\'s board as /v1/board/read, the knock as /v1/account/played - under one session, a guest\'s box refused in that route\'s word and its board and beat answered all the same (mutants: a part dropped, the guest\'s box opened, the board read for another town)', async () => {
  assert.ok(ROUTES.has('/v1/heartbeat'));
  assert.ok(!OPEN_ROUTES.has('/v1/heartbeat'), 'behind a session, as the three are');
  assert.deepEqual([...HEARTBEAT_PARTS], ['beat', 'mail', 'board']);
  const s = await standService({ BOARD_OPEN: 'on' });
  const ann = await s.registered('Ann'), bob = await s.registered('Bob');
  const map = 4242;
  s.env.DB._raw.prepare(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, at, expires_at, rid) VALUES ('n1', ?, ?, 'Bob', 'Hiring', 'Swords', ?, ?, 'r1')`)
    .run(map, bob.id, T0 - 60, T0 + 86_400);
  assert.equal((await s.call('/v1/mail/send', { to: 'Ann', subject: 'A note', body: 'Meet me at the Rusty Relic.' }, bob.secret)).status, 200);
  assert.equal((await s.call('/v1/heartbeat', {}, null)).status, 401, 'no session, no heartbeat');

  // the three routes' answers, asked alone (once to warm the isolate's kept words - the season's #1 - then measured)...
  const c = counted(s);
  await get(s, '/v1/mail/inbox', ann.secret);
  await s.call('/v1/board/read', { map }, ann.secret);
  c.n = 0;
  const box = await get(s, '/v1/mail/inbox', ann.secret);
  const board = await s.call('/v1/board/read', { map }, ann.secret);
  const alone = c.n;
  assert.equal(box.status, 200); assert.equal(board.status, 200);
  // ...and the heartbeat's: the same bodies, one session resolved for them all
  c.n = 0;
  const hb = await s.call('/v1/heartbeat', { mail: true, board: map }, ann.secret);
  assert.equal(hb.status, 200);
  assert.deepEqual(Object.keys(hb.body).sort(), ['board', 'mail']);
  assert.deepEqual(hb.body.mail, box.body);
  assert.deepEqual(hb.body.board, board.body);
  assert.equal(c.n, alone - 1, 'two parts, one session read - the other request\'s was the saving');
  assert.equal(hb.body.mail.letters.length, 1);
  assert.deepEqual(hb.body.board.notes.map((n) => n.id), ['n1']);
  // the knock: the gap by the service's own clock, as /v1/account/played credits it
  const first = await s.call('/v1/heartbeat', { beat: true }, ann.secret);
  assert.deepEqual(first.body, { beat: { playedS: 0 } });
  clock(T0 + 240);
  const second = await s.call('/v1/heartbeat', { beat: true, board: map }, ann.secret);
  assert.equal(second.body.beat.playedS, 240);
  clock(T0 + 480);
  assert.equal((await s.call('/v1/account/played', {}, ann.secret)).body.playedS, 480, 'the route and the part one clock');
  clock(T0);
  // a part the body does not name is not answered; a board the route refuses, refused in its word
  assert.deepEqual((await s.call('/v1/heartbeat', { board: -5 }, ann.secret)).body, { board: { error: 'bad-board' } });
  // a guest: its box refused as /v1/mail/inbox's door refuses one, its board and its beat answered
  const g = await s.guest();
  const gb = await s.call('/v1/heartbeat', { mail: true, board: map, beat: true }, g.secret);
  assert.equal(gb.status, 200);
  assert.deepEqual(gb.body.mail, { error: 'mail-needs-account' });
  assert.equal((await get(s, '/v1/mail/inbox', g.secret)).body.error, 'mail-needs-account');
  assert.deepEqual(gb.body.board.notes.map((n) => n.id), ['n1']);
  assert.equal(gb.body.beat.playedS, 0);
  // the route's method is the three's: a POST
  assert.equal((await get(s, '/v1/heartbeat', ann.secret)).status, 405);
});

// ═══ B. THE CLIENT'S HEARTBEAT ═══════════════════════════════════════════════════════════════════════════════════════

/** A heartbeat over a fake service and a fake clock: each request's body kept, each answered as `answer` says. */
function rig({ answer = (body) => ({ status: 200, json: body }), signedIn = true } = {}) {
  let t = 1_000_000;
  const sent = [];
  const storage = new Map(signedIn ? [[SESSION_KEY, JSON.stringify({ id: 'p1', secret: 'a-secret-long-enough-0001', name: 'Ann' })]] : []);
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url, body, at: t });
    const a = answer(body, sent.length);
    if (a === 'offline') throw new Error('down');
    return { ok: a.status < 400, status: a.status, headers: { get: () => 'application/json' }, json: async () => a.json };
  };
  const timers = [];
  const hb = createHeartbeat({
    fetch, storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    now: () => t, setInterval: (fn, ms) => { timers.push([fn, ms]); return timers.length; }, clearInterval: () => {}, sleep: async () => {},
  });
  return { hb, sent, timers, at: () => t, advance: async (ms) => { t += ms; await hb.tick(); await Promise.resolve(); }, set: (v) => { t = v; } };
}
/** A clock's part: due every `every` ms from its last send (its period said, as the books' parts say theirs), its
 *  answers kept. */
function every(r, name, everyMs, body = true) {
  const p = { last: -Infinity, took: [], asked: 0 };
  p.part = {
    due: (t) => t - p.last >= everyMs,
    soon: (t, early) => t - p.last >= everyMs - early,
    every: everyMs,
    body: () => { p.last = r.at(); p.asked++; return body; },
    take: (a) => p.took.push(a),
  };
  r.hb.add(name, p.part);
  return p;
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

test('SCALE4c B: a part goes when its own clock says, a part due within RIDE_EARLY_MS rides with it, and each takes its own answer out of the one (mutants: the riders left behind, a part sent before it is due, the answers crossed)', async () => {
  const r = rig({ answer: (body) => ({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, { echo: k }])) }) });
  assert.deepEqual(r.timers.map(([, ms]) => ms), [HEARTBEAT_TICK_MS], 'its own tick');
  const board = every(r, 'board', BOARD_CACHE_MS, 4242), mail = every(r, 'mail', MAIL_POLL_MS);
  await r.hb.tick(); await flush();
  assert.deepEqual(r.sent.map((x) => x.body), [{ board: 4242, mail: true }], 'both due at once: one request');
  assert.deepEqual(board.took, [{ ok: true, data: { echo: 'board' } }]);
  assert.deepEqual(mail.took, [{ ok: true, data: { echo: 'mail' } }]);
  // fifteen minutes in town: the board's minute and the box's three fall in step - fifteen requests, not twenty
  for (let s = 1; s <= 15 * 60; s++) await r.advance(1000);
  await flush();
  assert.equal(board.asked, 16);
  assert.equal(mail.asked, 6);
  assert.equal(r.sent.length, 16, 'every look at the box rode a board\'s');
  // nothing is sent before it is due, nor earlier than RIDE_EARLY_MS when it rides
  for (const x of r.sent.slice(1)) assert.ok('board' in x.body);
  const mailAt = r.sent.filter((x) => x.body.mail).map((x) => x.at);
  for (let i = 1; i < mailAt.length; i++) assert.ok(mailAt[i] - mailAt[i - 1] >= MAIL_POLL_MS - RIDE_EARLY_MS, `${mailAt[i] - mailAt[i - 1]}`);
  // two clocks a moment out of step: the box comes due two seconds after the board went, and rides the board's next
  // heartbeat early rather than going alone (without RIDE_EARLY_MS: a request of its own every three minutes)
  const d = rig({ answer: (body) => ({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, {}])) }) });
  const db = every(d, 'board', BOARD_CACHE_MS, 4242);
  await d.hb.tick(); await flush();
  await d.advance(2000); await flush();
  const dm = every(d, 'mail', MAIL_POLL_MS);
  await d.hb.tick(); await flush();
  assert.equal(d.sent.length, 2, 'the box\'s first look, two seconds behind');
  for (let s = 1; s <= 15 * 60; s++) await d.advance(1000);
  await flush();
  assert.equal(db.asked, 16);
  assert.ok(dm.asked >= 5);
  assert.equal(d.sent.length, 17, 'after its first look every one rode a board\'s - none alone');
  // a part whose body says nothing this time is not sent, and is told nothing
  const quiet = { due: () => true, soon: () => true, body: () => undefined, took: [], take(a) { this.took.push(a); } };
  r.hb.add('quiet', quiet);
  await r.advance(BOARD_CACHE_MS); await flush();
  assert.ok(!('quiet' in r.sent.at(-1).body));
  assert.deepEqual(quiet.took, []);
});

test('SCALE4c B: two clocks far out of step fall into step at the slower one\'s next look, through the real books - a town entered half a minute into the box\'s three starts the board\'s minute there, and the box\'s next look rides the board\'s heartbeat early (by less than the board\'s minute less RIDE_EARLY_MS) rather than going alone every three minutes for ever; in step it rides the board\'s third minute, never its second; the faster clock never rides the slower one\'s early (mutants: no slower clock riding early, the bound without RIDE_EARLY_MS, the faster riding the slower, a book\'s part without its period, whileLive dropping it, the riders within RIDE_EARLY_MS left)', async () => {
  const r = rig({ answer: (body) => ({ status: 200, json: {
    ...(body.mail ? { mail: { letters: [], max: 50 } } : {}),
    ...(body.board !== undefined ? { board: { notes: [], notices: [] } } : {}),
  } }) });
  const box = new MailBox({ ioOf: () => ({ fetch: async () => { throw new Error('the box asked alone'); }, secret: 'sek', storage: null }), now: r.at });
  const book = createNoticeBook({ door: { read: async () => { throw new Error('the board asked alone'); } }, nowMs: r.at, sleep: async () => {} });
  let town = null;
  r.hb.add('mail', whileLive(box.heartbeatPart(), () => true));   // as the world host adds them (scenes/world.js)
  r.hb.add('board', book.heartbeatPart(() => town));
  await r.hb.tick(); await flush();
  for (let s = 1; s <= 30; s++) await r.advance(1000);
  town = 4242;   // the street frame names a town: its board is due at once, the box not for two and a half minutes
  await r.hb.tick(); await flush();
  assert.deepEqual(r.sent.map((x) => Object.keys(x.body)), [['mail'], ['board']]);
  for (let s = 1; s <= 15 * 60; s++) await r.advance(1000);
  await flush();
  const boards = r.sent.filter((x) => x.body.board === 4242).map((x) => x.at);
  const looks = r.sent.filter((x) => x.body.mail === true).map((x) => x.at);
  assert.equal(boards.length, 16, 'the board\'s minute, from the town\'s first read');
  assert.equal(r.sent.length, 17, 'after the box\'s first look every one rode a board\'s - none alone (twenty-two without)');
  // the one early look: the board's heartbeat at two and a half minutes carried the box due at three
  assert.equal(looks[1] - looks[0], MAIL_POLL_MS - 30_000);
  assert.ok(MAIL_POLL_MS - (looks[1] - looks[0]) < BOARD_CACHE_MS - RIDE_EARLY_MS);
  // and in step after it: every MAIL_POLL_MS to the millisecond - the board's third minute, never its second
  assert.deepEqual(looks.slice(2).map((at, i) => at - looks[i + 1]), Array(looks.length - 2).fill(MAIL_POLL_MS));
  assert.equal(looks.length, 6);
  // the other way about - the box going while the board's minute has a while to run - the board waits for its minute:
  // a faster clock goes again within its own period, and riding early would only move it
  const q = rig({ answer: (body) => ({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, {}])) }) });
  const qb = every(q, 'board', BOARD_CACHE_MS, 4242);
  await q.hb.tick(); await flush();
  for (let s = 1; s <= 20; s++) await q.advance(1000);
  every(q, 'mail', MAIL_POLL_MS);
  await q.hb.tick(); await flush();
  assert.deepEqual(q.sent.map((x) => Object.keys(x.body)), [['board'], ['mail']], 'the box\'s first look alone, the board\'s minute left as it was');
  assert.equal(qb.asked, 1);
  // the narrow gap the early bound leaves: a town entered 123 s into the box's three, so the board's next read is due
  // three seconds after the box - past the box's early bound (the board's minute less RIDE_EARLY_MS) - and the board,
  // a faster clock due within RIDE_EARLY_MS, rides the box's heartbeat; in step from there
  const g = rig({ answer: (body) => ({ status: 200, json: Object.fromEntries(Object.keys(body).map((k) => [k, {}])) }) });
  every(g, 'mail', MAIL_POLL_MS);
  await g.hb.tick(); await flush();
  for (let s = 1; s <= 123; s++) await g.advance(1000);
  every(g, 'board', BOARD_CACHE_MS, 4242);
  await g.hb.tick(); await flush();
  for (let s = 1; s <= 15 * 60; s++) await g.advance(1000);
  await flush();
  assert.deepEqual(g.sent.slice(0, 3).map((x) => Object.keys(x.body).sort()), [['mail'], ['board'], ['board', 'mail']]);
  assert.equal(g.sent.filter((x) => !('board' in x.body)).length, 1, 'none alone after the box\'s first look');
});

test('SCALE4c B: the knock waits for a ride - carried by the next part that goes within BEAT_RIDE_MS, alone once nothing will come, at once where no clock rides at all (a single-player world); a late beat still credits its whole gap (mutants: the knock sent at once beside a ride coming, held past its wait, held where nothing rides)', async () => {
  assert.ok(BEAT_RIDE_MS <= (PLAY_GRACE_S - PLAY_BEAT_S) * 1000, 'a knock carried as late as it may be credits all it would have');
  // no clock to ride: the knock goes at once, alone - the play clock's own knock, as it always went
  const solo = rig();
  const p = solo.hb.beat();
  await flush(); await p;
  assert.deepEqual(solo.sent.map((x) => x.body), [{ beat: true }]);
  // a box due in a minute: the knock waits for it, and rides
  const r = rig();
  const mail = every(r, 'mail', MAIL_POLL_MS);
  await r.hb.tick(); await flush();   // the box's first look
  r.set(r.at() + MAIL_POLL_MS - 60_000);
  r.hb.beat(); await flush();
  assert.equal(r.sent.length, 1, 'the knock waits: a look is a minute off');
  for (let s = 0; s < 60; s++) await r.advance(1000);
  await flush();
  assert.deepEqual(r.sent.map((x) => x.body), [{ mail: true }, { mail: true, beat: true }]);
  // a box three minutes off: past the knock's wait - it goes alone, now
  r.set(r.at() + 1000);
  r.hb.beat(); await flush();
  assert.deepEqual(r.sent.at(-1).body, { beat: true });
  assert.equal(mail.asked, 2);
  // a knock while one waits is the same knock
  const q = rig();
  every(q, 'mail', MAIL_POLL_MS);
  await q.hb.tick(); await flush();
  q.set(q.at() + MAIL_POLL_MS - 30_000);
  q.hb.beat(); q.hb.beat(); await flush();
  for (let s = 0; s < 31; s++) await q.advance(1000);
  await flush();
  assert.equal(q.sent.filter((x) => x.body.beat).length, 1);
});

test('SCALE4c B: a lost answer is asked again (NOTICE_TRIES in all) and then each part takes the failure as its own request\'s; a refusal is a part\'s answer; signed out, every part is told so and nothing is sent; a hidden page sends nothing (mutants: never asked again, asked again on a refusal, the session unasked, sent while hidden)', async () => {
  let n = 0;
  const r = rig({ answer: () => (++n < NOTICE_TRIES ? 'offline' : { status: 200, json: { board: { notes: [] } } }) });
  const board = every(r, 'board', BOARD_CACHE_MS, 7);
  await r.hb.tick(); await flush(); await r.hb.flying;
  assert.equal(r.sent.length, NOTICE_TRIES, 'asked again after each lost answer');
  assert.deepEqual(board.took, [{ ok: true, data: { notes: [] } }]);
  // every try lost: the failure, as its own request's
  const down = rig({ answer: () => 'offline' });
  const b2 = every(down, 'board', BOARD_CACHE_MS, 7);
  await down.hb.tick(); await flush(); await down.hb.flying;
  assert.equal(down.sent.length, NOTICE_TRIES);
  assert.deepEqual(b2.took, [{ ok: false, error: 'offline' }]);
  // a refusal is answered once, never asked again - the whole request's (a 429) or a part's own word
  const rate = rig({ answer: () => ({ status: 429, json: { error: 'rate' } }) });
  const b3 = every(rate, 'board', BOARD_CACHE_MS, 7);
  await rate.hb.tick(); await flush(); await rate.hb.flying;
  assert.equal(rate.sent.length, 1);
  assert.deepEqual(b3.took, [{ ok: false, error: 'rate', status: 429 }]);
  assert.deepEqual(partAnswer({ error: 'board-closed' }), { ok: false, error: 'board-closed' });
  assert.deepEqual(partAnswer(undefined), { ok: false, error: 'server' });
  // signed out
  const out = rig({ signedIn: false });
  const b4 = every(out, 'board', BOARD_CACHE_MS, 7);
  await out.hb.tick(); await flush();
  assert.deepEqual(out.sent, []);
  assert.deepEqual(b4.took, [{ ok: false, error: 'no-session' }]);
  // hidden: a part due, nothing sent; a part asked only while its lane runs
  let shown = false;
  const hid = rig();
  const hb = createHeartbeat({ fetch: async () => { throw new Error('sent while hidden'); }, storage: { getItem: () => null }, visible: () => shown, setInterval: () => 0, clearInterval: () => {} });
  hb.add('board', every(hid, 'x', 1).part);
  assert.equal(hb.tick(), null);
  shown = false;
  let live = false;
  const gated = whileLive(every(hid, 'y', 1).part, () => live);
  assert.equal(gated.due(1e9), false); assert.equal(gated.soon(1e9, 5000), false);
  live = true;
  assert.equal(gated.due(1e9), true);
});

// ═══ C. THE BOOKS' PARTS ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE4c C: the letterbox as a part - due when a look is, stamped as it sets out (never two looks at once), its answer taken as a look takes one: new letters said once, a guest\'s box a guest\'s, signed out nothing sent (mutants: the part never due, a look twice in flight, the answer untaken)', async () => {
  let t = 5_000_000;   // a clock past nought: the box's `at` 0 is its never-looked mark
  const notes = [];
  let io = { fetch: async () => { throw new Error('the box asked alone'); }, secret: 'sek', storage: null };
  const box = new MailBox({ ioOf: () => io, now: () => t, onLetter: (e) => notes.push(e) });
  const part = box.heartbeatPart();
  assert.equal(part.due(t), true, 'never looked: due');
  assert.equal(part.body(), true);
  assert.equal(part.due(t), false, 'in flight: not due again');
  assert.equal(part.soon(t, RIDE_EARLY_MS), false);
  part.take({ ok: true, data: { letters: [{ id: 'l'.repeat(24), from: 'Bob', subject: 'Hi', sentAt: 5, read: false }], max: 50 } });
  assert.equal(box.state, 'ready');
  assert.equal(box.unread, 1);
  assert.deepEqual(notes.map((e) => e.kind), ['waiting'], 'the first look says what waits');
  const looked = t;
  t = looked + MAIL_POLL_MS - RIDE_EARLY_MS;
  assert.equal(part.due(t), false);
  assert.equal(part.soon(t, RIDE_EARLY_MS), true, 'rides a heartbeat within RIDE_EARLY_MS');
  t = looked + MAIL_POLL_MS;
  assert.equal(part.due(t), true);
  part.body();
  part.take({ ok: true, data: { letters: [{ id: 'm'.repeat(24), from: 'Cass', subject: 'Yo', sentAt: 9, read: false }, { id: 'l'.repeat(24), from: 'Bob', subject: 'Hi', sentAt: 5, read: false }], max: 50 } });
  assert.deepEqual(notes.map((e) => e.kind), ['waiting', 'new']);
  assert.equal(notes[1].letters[0].from, 'Cass');
  // a guest's box: the route's own word, the box a guest's
  t += MAIL_POLL_MS;
  part.body();
  part.take({ ok: false, error: 'mail-needs-account' });
  assert.equal(box.state, 'guest');
  // signed out: nothing rides, and the box says so
  io = null;
  t += MAIL_POLL_MS;
  assert.equal(part.body(), undefined);
  assert.equal(box.state, 'signed-out');
});

test('SCALE4c C: the town\'s board as a part - due when the town the host stands in has its minute up, in flight as the town\'s own read (a window\'s read meanwhile waits for it), its answer kept as a read keeps one, a refusal the minute too, a board shut said shut (mutants: due for no town, the read asked twice, the refusal not kept)', async () => {
  let t = 10_000_000;
  let asked = 0;
  const door = { read: async () => { asked++; return { ok: true, data: { notes: [{ id: 'own', at: 1 }], notices: [] } }; } };
  const book = createNoticeBook({ door, nowMs: () => t, sleep: async () => {} });
  let town = null;
  const part = book.heartbeatPart(() => town);
  assert.equal(part.due(t), false, 'no town underfoot: nothing to read');
  town = 4242;
  assert.equal(part.due(t), true);
  assert.equal(part.body(), 4242);
  assert.equal(part.due(t), false);
  const meanwhile = book.read(4242);   // the window opened while the heartbeat was out
  part.take({ ok: true, data: { notes: [{ id: 'a', at: 5 }], notices: [] } });
  assert.deepEqual((await meanwhile).board.notes.map((n) => n.id), ['a'], 'the window took the heartbeat\'s answer');
  assert.equal(asked, 0, 'and asked nothing of its own');
  assert.equal(book.open, true);
  assert.deepEqual(book.cached(4242).notes.map((n) => n.id), ['a']);
  assert.equal(book.unseen(4242), 1, 'the count over the board, from the part\'s answer');
  t += BOARD_CACHE_MS - RIDE_EARLY_MS;
  assert.equal(part.due(t), false);
  assert.equal(part.soon(t, RIDE_EARLY_MS), true);
  t += RIDE_EARLY_MS;
  assert.equal(part.due(t), true);
  // a refusal is kept the minute, the last good board kept with it
  part.body();
  part.take({ ok: false, error: 'server' });
  assert.equal(part.due(t), false, 'a refusal is an answer too: asked again after the minute');
  assert.deepEqual(book.cached(4242).notes.map((n) => n.id), ['a']);
  t += BOARD_CACHE_MS;
  part.body();
  part.take({ ok: false, error: 'board-closed' });
  assert.equal(book.open, false);
  assert.equal(book.cached(4242), null);
  // a bad town is no town
  town = -1;
  assert.equal(part.due(t + BOARD_CACHE_MS), false);
  assert.equal(part.body(), undefined);
});

// ═══ D. THE WORLD HOST ═══════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE4c D: the world host makes ONE heartbeat on the device\'s session, the play clock knocks through it, the town\'s board and the letterbox join it - each where and while its frame asked it before - and neither the street frame nor the online lane asks the service itself any more; no other host keeps any of the three (mutants: the board read in the frame again, the box polled in the lane again, the knock past the heartbeat)', () => {
  const w = src('src/scenes/world.js');
  assert.equal((w.match(/createHeartbeat\(/g) ?? []).length, 1, 'one heartbeat a page');
  assert.match(w, /startPlayClock\(\{\s*beat: \(\) => heartbeat\.beat\(\),\s*visible: \(\) => globalThis\.document\?\.visibilityState !== 'hidden',/);
  assert.match(w, /if \(noticeBook\) heartbeat\.add\('board', noticeBook\.heartbeatPart\(\(\) => \(_noticeTown && performance\.now\(\) - _noticeTown\.at < FRAME_LIVE_MS \? _noticeTown\.mapId : null\)\)\);/);
  assert.match(w, /heartbeat\.add\('mail', whileLive\(mail\.heartbeatPart\(\), \(\) => performance\.now\(\) - _mailFrameAt < FRAME_LIVE_MS\)\);/);
  assert.doesNotMatch(w, /mail\?\.poll\(\)/, 'the lane no longer looks at the box itself');
  assert.doesNotMatch(w, /if \(town\) noticeBook\.read\(town\.mapId\)/, 'the street frame no longer reads the board itself');
  assert.match(w, /_noticeTown = \{ mapId: town \? town\.mapId : null, at: performance\.now\(\) \};/);
  assert.match(w, /_mailFrameAt = performance\.now\(\);/);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const h = src(host);
    for (const clockWord of ['startPlayClock', 'createNoticeBook', 'new MailBox', 'createHeartbeat']) assert.ok(!h.includes(clockWord), `${host} keeps ${clockWord}`);
  }
});
