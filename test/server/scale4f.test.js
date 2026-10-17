// SCALE4f (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE4f): THE ACCOUNT'S HALF - THE MINT FOLDED, AND THE
// METRICS THAT SAY HOW BUSY THE ONE PRIMARY IS. The mint asked four statements of one realm_characters row (whether it is
// the account's realm character in play, its level, its arms, its house); one answers all four now
// (realm.js realmMintFacts), held here to the four over every state a row can be in. Every statement a request awaits is
// timed, its answers' rows summed, and a replica's serving counted (metrics.js countedDb) - a primary going under shows
// first as that wait. An overloaded D1 is answered `server` still (every book asks that again), but 503, counted apart.
// tools/mutants/scale4f.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { realmMintFacts, REALM_LEVEL_CLAIM_MAX, REALM_ID_RE } from '../../server-account/src/realm.js';
import { houseOn } from '../../server-account/src/legacy.js';
import { armsIssuable } from '../../src/net/identityToken.js';
import { countedDb, measured } from '../../server-account/src/metrics.js';
import { d1Overloaded, _resetBusyShed } from '../../server-account/src/service.js';

const realNow = Date.now;
Date.now = () => T0 * 1000;
test.after(() => { Date.now = realNow; });

const FAM = 'fam-s4f-a1b2c3';
const record = (surname, people, id = FAM) => ({ v: 1, id, surname, model: 'bloodline', rev: 1, people });

// THE FOUR READS AS THEY STOOD AT acct106 - realm.js realmCharacterHeld, realmLevelOf, realmArmsOf and legacy.js
// realmHouseOf, copied here word for word when the fold took their place, so the fold is held to what they answered.
async function realmCharacterHeld({ db }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return false;
  return !!(await db.prepare('SELECT 1 FROM realm_characters WHERE id = ? AND player = ? AND dead_at IS NULL AND lease IS NOT NULL').bind(id, playerId).first());
}
async function realmLevelOf({ db }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return null;
  const row = await db.prepare('SELECT summary, level_seen FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  let summary = null;
  try { summary = row?.summary ? JSON.parse(row.summary) : null; } catch { summary = null; }
  const lv = row?.level_seen ?? summary?.level;
  return Number.isSafeInteger(lv) && lv >= 1 && lv <= REALM_LEVEL_CLAIM_MAX ? lv : null;
}
async function realmArmsOf({ db }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return null;
  const row = await db.prepare('SELECT arms_top, arms_bow FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  const wa = row && row.arms_top != null ? [row.arms_top, row.arms_bow === 1 ? 1 : 0] : null;
  return armsIssuable(wa) ? wa : null;
}
// NAME-AS (acct122): AND ITS OWN NAME - a fifth answer the fold reads in the same statement (realm.js realmMintFacts
// `name`), held here to its own read beside the four.
async function realmOwnName({ db }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return null;
  const row = await db.prepare('SELECT name FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  return typeof row?.name === 'string' && row.name ? row.name : null;
}
async function realmHouseOf({ db }, playerId, id) {
  if (typeof id !== 'string' || !/^r[0-9a-f]{20}$/.test(id)) return null;
  const row = await db.prepare('SELECT r.person_id AS person, l.record AS record FROM realm_characters r JOIN lineages l ON l.player = r.player AND l.id = r.lineage_id'
    + ' WHERE r.id = ? AND r.player = ? AND r.dead_at IS NULL').bind(id, playerId).first();
  return row ? houseOn(row.record, row.person) : null;
}

/** What the mint asked before the fold - the four reads, each only behind `rc` as the mint asked them. */
async function oracle(ctx, playerId, id) {
  const rc = (await realmCharacterHeld(ctx, playerId, id)) ? 1 : 0;
  return { rc, cl: rc ? await realmLevelOf(ctx, playerId, id) : null, wa: rc ? await realmArmsOf(ctx, playerId, id) : null, house: rc ? await realmHouseOf(ctx, playerId, id) : null, name: rc ? await realmOwnName(ctx, playerId, id) : null };
}

test('SCALE4f the mint\'s four reads of one row, in one - exactly what the four answered, over every state a row can be in: held or not, leased or not, a tombstone, another\'s, a level judged, summarised, none or out of bounds, arms with a bow, without, unjudged, a house, a line gone, a name the filter refuses, no person - NAME-AS: and its own name, a fifth answer of the same read (mutants: the lease unread; a tombstone read as held; the summary\'s level unread; the level\'s bounds unread; the bow unread; the arms\' law unread; a house without its line; the house never read)', async () => {
  const S = await standService();
  const g = await S.guest();
  const other = await S.guest();
  const call = (p, b, who = g) => S.call(p, b, who.secret);
  assert.equal((await call('/v1/realm/lineage', { id: FAM, record: record('Hlaalu', [{ id: 1, given: 'Ysolde' }, { id: 2, given: 'Brenor' }]) })).status, 200);
  const BAD = 'fam-s4f-bad999';
  assert.equal((await call('/v1/realm/lineage', { id: BAD, record: record('Cum', [{ id: 1, given: 'Ysolde' }], BAD) })).status, 200);
  const housed = (await call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: FAM, person: 1 })).body;
  const plain = (await call('/v1/realm/create', { name: 'Plain' })).body;
  const filtered = (await call('/v1/realm/create', { name: 'Ysolde', lineage: BAD, person: 1 })).body;
  const theirs = (await call('/v1/realm/create', { name: 'Theirs' }, other)).body;
  for (const c of [housed, plain, filtered, theirs]) assert.match(c.id ?? '', /^r[0-9a-f]{20}$/, JSON.stringify(c));
  const raw = S.env.DB._raw;
  const set = (id, sql, ...args) => raw.prepare(`UPDATE realm_characters SET ${sql} WHERE id = ?`).run(...args, id);
  const ctx = { db: S.env.DB };
  const states = [
    ['as made', () => {}],
    ['a judged level', (id) => set(id, 'level_seen = ?', 37)],
    ['a summary\'s level', (id) => set(id, 'level_seen = NULL, summary = ?', JSON.stringify({ level: 12 }))],
    ['a level out of bounds', (id) => set(id, 'level_seen = ?', 5000)],
    ['a summary that is no JSON', (id) => set(id, 'level_seen = NULL, summary = ?', '{not json')],
    ['no level at all', (id) => set(id, 'level_seen = NULL, summary = NULL')],
    ['arms with a bow', (id) => set(id, 'arms_top = ?, arms_bow = ?', 3, 1)],
    ['arms without one', (id) => set(id, 'arms_top = ?, arms_bow = ?', 2, 0)],
    ['arms the law refuses', (id) => set(id, 'arms_top = ?, arms_bow = ?', -4, 1)],
    ['no arms', (id) => set(id, 'arms_top = NULL, arms_bow = NULL')],
    ['the line gone', (id) => set(id, 'lineage_id = ?', 'fam-s4f-nowhere')],
    ['no person', (id) => set(id, 'person_id = NULL')],
    ['not in play', (id) => set(id, 'lease = NULL')],
    ['a tombstone, its lease still on the row', (id) => set(id, 'dead_at = ?, lease = ?', T0, 'b'.repeat(32))],
    ['a tombstone without one', (id) => set(id, 'lease = NULL')],
  ];
  let held = 0, housedSeen = 0;
  for (const c of [housed, plain, filtered, theirs]) {
    set(c.id, 'lease = ?, dead_at = NULL', 'a'.repeat(32));   // in play again: making the next character let this one's lease go
    for (const [what, apply] of states) {
      apply(c.id);
      for (const asker of [g.id, other.id]) {
        const want = await oracle(ctx, asker, c.id);
        assert.deepEqual(await realmMintFacts(ctx, asker, c.id), want, `${what}: the four's answer`);
        if (want.rc) held++;
        if (want.house) housedSeen++;
      }
    }
  }
  assert.ok(held >= 20 && housedSeen >= 5, `the states reached both sides of every arm (${held} held, ${housedSeen} housed)`);
  for (const bad of [null, 7, '', 'r123', 'R'.padEnd(21, 'f'), `${housed.id}x`]) assert.deepEqual(await realmMintFacts(ctx, g.id, bad), { rc: 0, cl: null, wa: null, house: null, name: null }, String(bad));
});

test('SCALE4f the mint asks its realm row ONCE - one statement where four were, and a token as it was (mutants: the four asked again)', async () => {
  const S = await standService();
  const g = await S.guest();
  await S.call('/v1/realm/lineage', { id: FAM, record: record('Hlaalu', [{ id: 1, given: 'Ysolde' }]) }, g.secret);
  const c = (await S.call('/v1/realm/create', { name: 'Ysolde Hlaalu', lineage: FAM, person: 1 }, g.secret)).body;
  S.env.DB._sessions.length = 0;
  const r = await S.call('/v1/auth/token', { character: c.id }, g.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.house, { hn: 'Hlaalu', hc: 'Ysolde', hb: 1 }, 'the house as it was signed');
  const claims = JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url').toString());
  assert.equal(claims.rc, 1);
  assert.equal(claims.ci, c.id);
  const rows = S.env.DB._sessions[0].statements.filter((q) => /realm_characters/.test(q));
  assert.equal(rows.length, 1, 'one read of the realm row');
  const src = readFileSync(new URL('../../server-account/src/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /realmCharacterHeld|realmLevelOf\(|realmArmsOf\(|realmHouseOf\(/, 'none of the four is asked by the service any more');
});

// ═══ HOW BUSY THE PRIMARY IS ═══════════════════════════════════════════════════════════════════════════════════════

/** A D1 shaped as workerd's: statements a class with private fields, whose methods throw on any `this` but their own,
 *  and a batch that refuses anything but its own statements (AUDIT SCALE4d D8's law, one level down). Each run moves the
 *  test's clock by the statement's own cost, and answers the meta D1 answers. */
function fakeD1(clock) {
  const real = new WeakSet();
  class Stmt {
    #sql; #args = [];
    constructor(sql) { this.#sql = sql; real.add(this); }
    bind(...a) { const s = new Stmt(this.#sql); s.#args = a; return s; }
    #run(cost) { clock.t += cost; return { results: [{ sql: this.#sql, args: this.#args }], meta: { rows_read: 3, rows_written: /^UPDATE/.test(this.#sql) ? 2 : 0, served_by_primary: !/replica/.test(this.#sql) } }; }
    async first() { return this.#run(7).results[0]; }
    async all() { return this.#run(5); }
    async run() { return this.#run(11); }
    async raw() { this.#run(4); return [[1]]; }
  }
  return {
    prepare: (sql) => new Stmt(sql),
    async batch(list) {
      if (!list.every((s) => real.has(s))) throw new TypeError('D1_TYPE_ERROR: a statement this database did not make');
      clock.t += 13;
      return list.map(() => ({ results: [], meta: { rows_read: 1, rows_written: 1, served_by_primary: true } }));
    },
  };
}

test('SCALE4f every statement a request awaits is timed, its answers\' rows summed, and a replica\'s serving counted - each run on the statement itself, a batch handed D1\'s own statements (mutants: a statement\'s wait uncounted; a batch\'s uncounted; the rows unread; a replica\'s serving unread; a batch handed the timed ones; `bind` answering an untimed one)', async () => {
  const clock = { t: 1_000 };
  Date.now = () => clock.t;
  try {
    const tally = { n: 0 };   // a caller's tally with `n` alone grows the rest
    const db = countedDb(fakeD1(clock), tally);
    assert.deepEqual(await db.prepare('SELECT a FROM t WHERE id = ?').bind(4).first(), { sql: 'SELECT a FROM t WHERE id = ?', args: [4] }, 'the statement\'s own answer, through its own bind');
    await db.prepare('SELECT replica FROM t').all();
    await db.prepare('UPDATE t SET a = 1').run();
    assert.deepEqual(await db.prepare('SELECT 1').raw(), [[1]]);
    const rs = await db.batch([db.prepare('UPDATE a SET x = 1'), db.prepare('UPDATE b SET y = 2').bind(9)]);
    assert.equal(rs.length, 2, 'D1\'s batch took its own statements');
    assert.equal(tally.n, 6, 'six prepared');
    assert.equal(tally.ms, 5 + 5 + 11 + 4 + 13, 'every wait: first (SCALE4h, PIN MOVED: run as its own all()), all, run, raw and the batch whole');
    assert.equal(tally.rr, 3 + 3 + 3 + 1 + 1, 'the rows read that the answers said (SCALE4h: a first\'s now too; a raw says none)');
    assert.equal(tally.rw, 2 + 1 + 1, 'and written');
    assert.equal(tally.replica, 1, 'the one a replica served');
  } finally { Date.now = () => T0 * 1000; }
});

test('SCALE4f the request\'s point carries D1\'s rows written, its wait, its rows read and a replica\'s statements, after the three it had (mutant: the point as before)', async () => {
  const clock = { t: 5_000 };
  Date.now = () => clock.t;
  try {
    const points = [];
    const serve = async (req, env) => { await env.DB.prepare('SELECT replica FROM t').all(); await env.DB.prepare('UPDATE t SET a = 1').run(); clock.t += 2; return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); };
    await measured(new Request('https://accounts.invalid/v1/heartbeat', { method: 'POST' }), { DB: fakeD1(clock), METRICS: { writeDataPoint: (p) => points.push(p) } }, serve);
    assert.equal(points.length, 1);
    assert.deepEqual(points[0].doubles.slice(0, 7), [5 + 11 + 2, 200, 2, 2, 16, 6, 1], 'wall ms, the status, statements, rows written, D1\'s wait, rows read, a replica\'s');   // SCALE4h (PIN MOVED): the hot rows' four follow - test/server/scale4h.test.js
    assert.deepEqual(points[0].indexes, ['/v1/heartbeat']);
  } finally { Date.now = () => T0 * 1000; }
});

test('SCALE4f an overloaded D1 is answered `server` still - every book asks that again - but 503, so the metrics count it apart from a fault; any other throw stays 500 (mutants: the overload unread; every fault a 503)', async () => {
  for (const m of ['D1 DB is overloaded. Requests queued for too long.', 'D1_ERROR: D1 DB is overloaded', 'Error: queued for too long', 'error code: 7429']) assert.equal(d1Overloaded(new Error(m)), true, m);
  for (const m of ['no such table: x', 'D1_ERROR: UNIQUE constraint failed', 'network connection lost', '74290 rows']) assert.equal(d1Overloaded(new Error(m)), false, m);
  assert.equal(d1Overloaded(null), false);
  assert.equal(d1Overloaded('overloaded'), true, 'a thrown string is read as its text');
  const S = await standService();
  const g = await S.guest();
  const keep = S.env.DB;
  const quiet = console.error;
  console.error = () => {};
  try {
    S.env.DB = { ...keep, prepare: () => { throw new Error('D1 DB is overloaded. Requests queued for too long.'); }, batch: keep.batch.bind(keep) };
    const over = await S.call('/v1/heartbeat', { parts: {} }, g.secret);
    assert.deepEqual([over.status, over.body], [503, { error: 'server' }]);
    _resetBusyShed();   // PIN MOVED (BUSY-HEART, 2026-10-16): the overload sheds the heartbeat a moment - the fault asked after it
    S.env.DB = { ...keep, prepare: () => { throw new Error('no such column: nope'); }, batch: keep.batch.bind(keep) };
    const fault = await S.call('/v1/heartbeat', { parts: {} }, g.secret);
    assert.deepEqual([fault.status, fault.body], [500, { error: 'server' }]);
  } finally { S.env.DB = keep; console.error = quiet; }
});
