// EG-ZM (2026-10-12, bible/11-Multiplayer/Elite-Gates.md section 23, "The clock" - the EG-ZA departure it retires): THE STAKE'S
// CLOCK. A Weir Key's stake no receipt ever settled is spent by the account service's own hourly clock (server-account/src/
// cron.js `eg-stakes`, eg.js spendLapsedStakes) once nothing can name it - EG_STAKE_CLOCK_S past its end, the void's window
// and a receipt's life - its key kept taken, never returned by a clock; and its opener is told in the mailbox, one letter a
// stake (a Rehearsal's held no key and is told nothing). The real Worker over node:sqlite with every migration
// (test/accountDb.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { mintEgReceipt, EG_RECEIPT_TTL_S } from '../../../src/net/eliteGates/egReceipt.js';
import { EG_VOID_MAX_S } from '../../../src/net/eliteGates/egDurable.js';
import { POST_SENDER, POST_BATCH_RE, POST_SUBJECT_MAX, POST_BODY_MAX, postWhole } from '../../../src/net/postLaw.js';
import { spendLapsedStakes, EG_STAKE_CLOCK_S, EG_VOID_WINDOW_S, EG_STAKE_POST, EG_LIVE_S } from '../../../server-account/src/eg.js';
import { runCron, CRON_HOUR, HOUR_JOBS, SWEEP_ROWS } from '../../../server-account/src/cron.js';

const { subtle } = globalThis.crypto;
const DAY = 86_400;

async function stood(t) {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const S = await standService();
  const me = await S.registered('KeyBearer');
  return { S, me, raw: S.env.DB._raw, at: (s) => { clock = s * 1000; } };
}
const keysOf = (raw, id) => raw.prepare('SELECT eg_keys AS k FROM players WHERE id = ?').get(id).k;
const stake = (raw, ez) => ({ ...raw.prepare('SELECT state, at, until, rh FROM eg_stakes WHERE ez = ?').get(ez) });
const letters = (raw, id) => raw.prepare('SELECT batch, sender, subject, body, item, sent_at FROM server_post WHERE to_id = ? ORDER BY batch').all(id).map((r) => ({ ...r }));
const dayOf = (s) => new Date(s * 1000).toISOString().slice(0, 10);

test('EG-ZM THE STAKE\'S CLOCK (section 23): a stake no receipt settled stays held until EG_STAKE_CLOCK_S past its end - the void\'s window and a receipt\'s life, so nothing can name it after - and is then spent by the hourly clock, its key kept taken, its opener written one letter (the day it was staked, the developers\' words) that the mailbox reads; a Rehearsal\'s is spent and says nothing; a stake a void returned, and one not yet due, are untouched; asked again, the clock writes nothing more (mutants: the clock a second early; the key returned; the letter unwritten, written twice or to a Rehearsal; a settled stake spent; the day the end\'s)', async (t) => {
  const { S, me, raw, at } = await stood(t);
  assert.equal((await S.claim(me, 700, T0)).body.weir.found, true, 'proven, a key');
  raw.prepare('UPDATE players SET eg_keys = 3 WHERE id = ?').run(me.id);
  // a key's stake nothing will settle
  at(T0);
  const o1 = (await S.call('/v1/eg/open', { rq: 'rq0123456789abcdef' }, me.secret)).body;
  // the day's Rehearsal, after the first lapsed
  const t2 = T0 + EG_LIVE_S + 60;
  at(t2);
  const o2 = (await S.call('/v1/eg/open', { rq: 'rq1123456789abcdef', rh: 1 }, me.secret)).body;
  // a key's stake a void returns
  const t3 = t2 + EG_LIVE_S + 60;
  at(t3);
  const o3 = (await S.call('/v1/eg/open', { rq: 'rq2123456789abcdef' }, me.secret)).body;
  const v = await mintEgReceipt({ q: 'v', b: o3.b, s: me.id, z: o3.ez }, S.gatePriv, { subtle, nowS: t3 });
  assert.equal((await S.call('/v1/eg/claim', { receipt: v }, me.secret)).body.recorded, true);
  // a key's stake staked last
  const t4 = t3 + 2 * DAY;
  at(t4);
  const o4 = (await S.call('/v1/eg/open', { rq: 'rq3123456789abcdef' }, me.secret)).body;
  assert.ok(o1.ez && o2.ez && o3.ez && o4.ez && o2.rh === 1);
  assert.deepEqual([stake(raw, o1.ez).state, stake(raw, o2.ez).state, stake(raw, o3.ez).state, stake(raw, o4.ez).state], ['held', 'held', 'returned', 'held']);
  const keys = keysOf(raw, me.id);
  assert.equal(keys, 1, 'three, less two staked (o1, o4) - the void\'s back');
  // THE BOUND: the void's window (the relay's, pinned equal) and a receipt's life, past the stake's end
  assert.equal(EG_VOID_WINDOW_S, EG_VOID_MAX_S, 'the relay\'s void window');
  assert.equal(EG_STAKE_CLOCK_S, EG_VOID_MAX_S + EG_RECEIPT_TTL_S);
  const due1 = stake(raw, o1.ez).until + EG_STAKE_CLOCK_S;
  const job = (nowS) => runCron(S.env, { cron: CRON_HOUR, nowS }).then((r) => r.find((j) => j.name === 'eg-stakes'));
  at(due1 - 1);
  assert.deepEqual(await job(due1 - 1).then((j) => [j.ok, j.changed]), [true, 0], 'a second short: nothing');
  assert.equal(stake(raw, o1.ez).state, 'held');
  assert.deepEqual(letters(raw, me.id), []);
  at(due1);
  assert.deepEqual(await job(due1).then((j) => [j.ok, j.changed]), [true, 1], 'due: spent');
  assert.deepEqual([stake(raw, o1.ez).state, stake(raw, o2.ez).state, stake(raw, o3.ez).state, stake(raw, o4.ez).state], ['spent', 'held', 'returned', 'held'], 'the one due alone');
  assert.equal(keysOf(raw, me.id), keys, 'the key kept taken: a clock never returns one');
  const body = EG_STAKE_POST.body.replace('{day}', dayOf(T0));
  assert.deepEqual(letters(raw, me.id), [{ batch: `spire-stake-${o1.ez}`, sender: POST_SENDER, subject: 'A Weir Key spent', body, item: null, sent_at: due1 }], 'its opener told, once');
  assert.match(body, new RegExp(`^The Weir Key you staked on ${dayOf(T0)} opened a breach that never sent word back: no Redoubt, no end and no void reached the Spire's ledger in the time a key waits for one\\.\\n\\nThat key is spent\\. It does not return\\.\\n\\n- ${POST_SENDER}$`));
  assert.ok(POST_BATCH_RE.test(`spire-stake-${o1.ez}`) && EG_STAKE_POST.subject.length <= POST_SUBJECT_MAX && body.length <= POST_BODY_MAX, 'inside the post\'s law');
  // the mailbox reads it, as the client's law reads a piece
  const box = await (await S.fetch('https://accounts.invalid/v1/post/box', { method: 'GET', headers: { authorization: `Bearer ${me.secret}` } })).json();
  assert.deepEqual(box.post.map((p) => [p.subject, p.from, p.item, p.read]), [['A Weir Key spent', POST_SENDER, null, false]], 'in the mailbox beside the hourglass');
  const read = await S.call('/v1/post/read', { id: box.post[0].id }, me.secret);
  assert.equal(postWhole(read.body.post ?? read.body)?.body, body, 'whole, by the client\'s own law');
  // asked again: nothing more
  assert.equal((await job(due1 + 3600)).changed, 0);
  assert.equal(letters(raw, me.id).length, 1, 'one letter a stake');
  // the Rehearsal's: spent, no letter
  const due2 = stake(raw, o2.ez).until + EG_STAKE_CLOCK_S;
  at(due2);
  assert.equal((await job(due2)).changed, 1);
  assert.equal(stake(raw, o2.ez).state, 'spent');
  assert.equal(letters(raw, me.id).length, 1, 'a Rehearsal held no key - nothing to tell');
  assert.equal(stake(raw, o3.ez).state, 'returned', 'a returned stake untouched');
  assert.equal(stake(raw, o4.ez).state, 'held', 'not yet due');
  assert.equal(keysOf(raw, me.id), keys);
});

test('EG-ZM THE CLOCK\'S PAGE (server-account/src/eg.js spendLapsedStakes; cron.js): the stakes due taken oldest first, a page at a time, each page\'s letters in its own transaction - the hourly job asks again while a page is full; asked by the held stakes\' own index, never a walk of every stake; the clock beside the hour\'s others (mutants: the newest first; the page unbounded; the letter\'s batch another\'s; the job off the hour; the index unused)', async (t) => {
  const { S, me, raw, at } = await stood(t);
  const other = await S.registered('Second');
  // two stakes held, by hand - the rows an open writes (its own pins: test/net/eliteGates/egplay_service.test.js)
  const put = (ez, who, atS, state = 'held') => raw.prepare("INSERT INTO eg_stakes (ez, account, b, rq, rh, at, until, state) VALUES (?, ?, ?, ?, 0, ?, ?, ?)").run(ez, who.id, ez.slice(0, 16), `rq${ez}`, atS, atS + EG_LIVE_S, state);
  const late = Math.floor(T0 / DAY) * DAY + DAY - 600;   // ten minutes before a UTC midnight - its end the next day
  put('b'.repeat(24), other, late);
  put('a'.repeat(24), me, T0 + 50);
  put('c'.repeat(24), me, T0 + 9 * DAY);
  put('f'.repeat(24), me, T0 + 10, 'returned');   // a void gave it back - long due, and never the clock's
  // a letter already there for 'a' (one written by hand) never holds the clock: the stake is spent, one letter stands
  raw.prepare("INSERT INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at) VALUES ('handwritten-0000000000', ?, ?, ?, 'Before', 'Written first.', NULL, ?)").run(me.id, `spire-stake-${'a'.repeat(24)}`, POST_SENDER, T0);
  const nowS = late + EG_LIVE_S + EG_STAKE_CLOCK_S;
  at(nowS);
  assert.equal(await spendLapsedStakes(S.env.DB, nowS, 1), 1, 'a page of one');
  assert.deepEqual(raw.prepare('SELECT ez, state FROM eg_stakes ORDER BY ez').all().map((r) => [r.ez[0], r.state]), [['a', 'spent'], ['b', 'held'], ['c', 'held'], ['f', 'returned']], 'the oldest first');
  assert.deepEqual(letters(raw, me.id).map((l) => [l.batch, l.subject]), [[`spire-stake-${'a'.repeat(24)}`, 'Before']], 'the letter there kept, none added - and the stake spent all the same');
  assert.deepEqual(letters(raw, other.id), [], 'its letter with its page');
  assert.equal(await spendLapsedStakes(S.env.DB, nowS, 1), 1);
  assert.notEqual(dayOf(late), dayOf(late + EG_LIVE_S));
  assert.deepEqual(letters(raw, other.id).map((l) => [l.batch, l.body]), [[`spire-stake-${'b'.repeat(24)}`, EG_STAKE_POST.body.replace('{day}', dayOf(late))]], 'each to its own opener, the day it was staked');
  assert.equal(await spendLapsedStakes(S.env.DB, nowS, 1), 0, 'none left due');
  assert.equal(raw.prepare("SELECT state FROM eg_stakes WHERE ez = ?").get('c'.repeat(24)).state, 'held');
  assert.equal(raw.prepare("SELECT state FROM eg_stakes WHERE ez = ?").get('f'.repeat(24)).state, 'returned', 'a returned stake is no held one');
  assert.ok(!letters(raw, me.id).some((l) => l.batch.endsWith('f'.repeat(24))), 'nor told of');
  // the plan: the held stakes' own index
  const plan = raw.prepare("EXPLAIN QUERY PLAN SELECT ez FROM eg_stakes WHERE state = 'held' AND until <= ?1 ORDER BY until, ez LIMIT ?2").all(nowS, 5).map((r) => r.detail).join(' | ');
  assert.match(plan, /USING INDEX idx_eg_stakes_held \(state=\? AND until<\?\)/);
  // the job: the hour's, a page of SWEEP_ROWS asked again while full
  const job = HOUR_JOBS.find(([name]) => name === 'eg-stakes');
  assert.ok(job, 'on the hour');
  let pages = 0;
  const db = { prepare: (sql) => S.env.DB.prepare(sql), batch: async (list) => { pages++; return S.env.DB.batch(list); } };
  put('d'.repeat(24), me, T0 + 60);
  put('e'.repeat(24), other, T0 + 70);
  assert.equal(await job[1]({ db, nowS, rand: () => {}, budget: () => true }, S.env), 2, 'both due, one page');
  assert.equal(pages, 1, 'one page: not full');
  assert.deepEqual(raw.prepare("SELECT ez FROM eg_stakes WHERE state = 'held'").all().map((r) => r.ez[0]), ['c']);
  assert.equal(SWEEP_ROWS, 1000);
  // A RECEIPT BETWEEN THE ASK AND THE SPENDING: a void claimed for one of the stakes asked (returned) and an end for the
  // other (spent by its claim) - the clock spends neither again and tells neither
  put('g'.repeat(24), me, T0 + 80);
  put('h'.repeat(24), other, T0 + 90);
  const raced = { prepare: (sql) => S.env.DB.prepare(sql), batch: async (list) => {
    raw.prepare("UPDATE eg_stakes SET state = 'returned' WHERE ez = ?").run('g'.repeat(24));
    raw.prepare("UPDATE eg_stakes SET state = 'spent' WHERE ez = ?").run('h'.repeat(24));
    return S.env.DB.batch(list);
  } };
  const before = raw.prepare('SELECT COUNT(*) AS n FROM server_post').get().n;
  assert.equal(await spendLapsedStakes(raced, nowS, 10), 0, 'nothing of the clock\'s to spend');
  assert.deepEqual(['g', 'h'].map((c) => raw.prepare('SELECT state FROM eg_stakes WHERE ez = ?').get(c.repeat(24)).state), ['returned', 'spent'], 'the receipts\' own settling stands');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM server_post').get().n, before, 'and no letter');
  // a quiet hour asks once and writes nothing
  const asked = [];
  const quiet = { prepare: (sql) => { asked.push(sql); return S.env.DB.prepare(sql); }, batch: async (list) => { asked.push('batch'); return S.env.DB.batch(list); } };
  assert.equal(await spendLapsedStakes(quiet, nowS, 10), 0);
  assert.equal(asked.length, 1, 'one ask, no batch');
});
