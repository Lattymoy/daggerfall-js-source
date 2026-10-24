// SCALE4h (2026-10-11, the plan's eighth slice - "10k writes, by the metrics"; Mac: "I wanna do every single slice";
// bible/11-Multiplayer/Scale-Arc.md SCALE4h): THE HOT ROWS, WRITTEN LESS. A fighter's Renown reported at the minute's
// pace only while its answer says what the page cannot (net/renownTracker.js renownReportSoon, the service's `room`),
// nothing earned in an hour the bound has spent, a session touched once an hour, and the metrics that say which rows a
// route writes (server-account/src/metrics.js: a first()'s rows, rows by table, a heartbeat's parts).
// tools/mutants/scale4h.json; tools/hotWritesBench.mjs measures it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1, standService } from '../accountDb.mjs';
import { createGuest, resolveSession, SESSION_TOUCH_S } from '../../server-account/src/accounts.js';
import { reportRenownXp } from '../../server-account/src/renownTracks.js';
import { countedDb, measured, tableOf, tablesBlob, HOT_TABLES, heartbeatPartsOf } from '../../server-account/src/metrics.js';
import { createRenownTracker, renownAnswer, renownReportSoon, RENOWN_BACKOFF_MAX_MS } from '../../src/net/renownTracker.js';
import { RENOWN_REPORT_MS, RENOWN_COALESCE_MS, RENOWN_XP_HOUR_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_MAX, renownXpFor } from '../../src/net/renown.js';
import { playerHour } from '../../tools/hotWritesBench.mjs';
import { seatRealm } from '../realmSeat.mjs';   // INT16: a Renown report is a progression claim, asked of the account's seated realm character

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const T0 = 1_800_000_000;   // a clock hour's first second
const player = async (db) => ({ id: (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id });

// ═══ RENOWN, COALESCED ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE4h the law: a report is soon while the hour is spent, the total or the room is not known, what waits reaches the room, or what waits completes the level - at the cap\'s total no rise is left; otherwise it waits (mutants: the spent hour unread; an unknown total read as known; an unknown room read as known; the room\'s edge strict; the rise unread; a rise at the cap)', () => {
  const at20 = renownXpFor(20) + 100;               // 100 into Renown 20, whose span is renownXpFor(21) - renownXpFor(20)
  const rest = renownXpFor(21) - at20;              // what completes it
  const big = RENOWN_XP_HOUR_MAX;
  const s = (o) => renownReportSoon({ xp: at20, pending: 40, room: big, capped: false, ...o });
  assert.equal(s({}), false, 'forty earned, the hour open, no rise near: it waits');
  assert.equal(s({ capped: true }), true, 'an hour the bound has spent');
  for (const xp of [null, undefined, 1.5, '5']) assert.equal(s({ xp }), true, `the total ${xp}`);
  for (const room of [null, undefined, 1.5, '9']) assert.equal(s({ room }), true, `the room ${room}`);
  assert.equal(s({ room: 40 }), true, 'what waits reaches the room');
  assert.equal(s({ room: 41 }), false, 'one short of it');
  assert.equal(s({ room: 0, pending: 0 }), true, 'a spent room with nothing waiting is soon - and nothing goes, there being nothing');
  assert.equal(s({ pending: rest }), true, 'what waits completes the level');
  assert.equal(s({ pending: rest - 1 }), false, 'one short of it');
  for (const pending of [NaN, -50, undefined]) assert.equal(s({ pending, room: 1 }), false, `nothing waiting (${pending}) against a room of one`);
  for (const pending of [NaN, -50, undefined]) assert.equal(s({ pending, room: 0 }), true, `nothing waiting (${pending}) is nothing - against a spent room, soon, as zero is`);
  assert.equal(renownReportSoon({ xp: RENOWN_XP_MAX, pending: 4000, room: big, capped: false }), false, 'at the cap\'s total no rise is left to say');
  assert.equal(renownReportSoon({ xp: 0, pending: 99, room: big, capped: false }), false, 'Renown 1, one short of 2 (100)');
  assert.equal(renownReportSoon({ xp: 0, pending: 100, room: big, capped: false }), true);
  assert.equal(RENOWN_COALESCE_MS, 5 * 60_000);
  assert.equal(RENOWN_REPORT_MS, 60_000, 'the minute stays the soon pace');
});

test('SCALE4h the tracker\'s pace: a report not soon waits RENOWN_COALESCE_MS, a soon one the minute; a word that throws is soon, and none given is soon (as before); a report\'s worth still goes at once, and a refusal\'s backoff is its own (mutants: the word unread; a throw read as not soon; none given read as not soon)', async () => {
  const run = async (o) => {
    let t = 0;
    const sent = [];
    const k = createRenownTracker({ report: async (c, xp) => { sent.push([t, xp]); return o.answer ?? { ok: true, data: {} }; }, character: () => 'char-aaaa', now: () => t, ...(o.soon !== undefined ? { soon: o.soon } : {}) });
    k.earn(10);
    await k.tick(t);   // the first goes at once
    k.earn(10);
    const at = (dt) => { t = dt; return k.due(t); };
    return { k, sent, at, setT: (v) => { t = v; } };
  };
  let r = await run({ soon: () => false });
  assert.equal(r.at(RENOWN_REPORT_MS), false, 'not soon: the minute is not enough');
  assert.equal(r.at(RENOWN_COALESCE_MS - 1), false);
  assert.equal(r.at(RENOWN_COALESCE_MS), true, 'RENOWN_COALESCE_MS after the last');
  r.k.earn(RENOWN_XP_REPORT_MAX);
  assert.equal(r.at(1), true, 'a report\'s worth goes at once, soon or not');
  r = await run({ soon: () => true });
  assert.equal(r.at(RENOWN_REPORT_MS - 1), false);
  assert.equal(r.at(RENOWN_REPORT_MS), true, 'soon: the minute');
  r = await run({ soon: () => { throw new Error('the host broke'); } });
  assert.equal(r.at(RENOWN_REPORT_MS), true, 'a word that throws is soon');
  r = await run({});
  assert.equal(r.at(RENOWN_REPORT_MS), true, 'no word given: soon, as every report was');
  // a refusal waits its own doubling, whatever the word says
  r = await run({ soon: () => false, answer: { ok: false, error: 'offline' } });
  assert.equal(r.at(RENOWN_REPORT_MS), true, 'the first refusal waits a minute');
  await r.k.tick(RENOWN_REPORT_MS);
  r.setT(RENOWN_REPORT_MS);
  assert.equal(r.at(RENOWN_REPORT_MS + 2 * RENOWN_REPORT_MS - 1), false);
  assert.equal(r.at(RENOWN_REPORT_MS + 2 * RENOWN_REPORT_MS), true, 'and then two - the backoff, never the coalescing');
  assert.ok(RENOWN_BACKOFF_MAX_MS > RENOWN_COALESCE_MS);
});

test('SCALE4h the service says what the hour still takes: after each report, the account\'s hour less what it spent - across its characters, nothing in a spent hour, a repeat too, and a new clock hour whole again; the route answers it (mutants: the room the whole hour always; the hour\'s spend unread)', async () => {
  const db = d1();
  const P = await player(db);
  let r = await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-aaaa', xp: 1000 });
  assert.equal(r.room, RENOWN_XP_HOUR_MAX - 1000);
  r = await reportRenownXp({ db, nowS: T0 + 5 }, P, { character: 'char-bbbb', xp: 4000, rid: '00000000000000aa' });
  assert.equal(r.room, RENOWN_XP_HOUR_MAX - 5000, 'the account\'s hour, across its characters');
  r = await reportRenownXp({ db, nowS: T0 + 6 }, P, { character: 'char-bbbb', xp: 4000, rid: '00000000000000aa' });
  assert.equal(r.repeat, true);
  assert.equal(r.room, RENOWN_XP_HOUR_MAX - 5000, 'a repeat says it, spending nothing');
  for (let i = 0; i < 3; i++) r = await reportRenownXp({ db, nowS: T0 + 10 + i }, P, { character: 'char-aaaa', xp: 5000 });
  assert.deepEqual([r.credited, r.room], [0, 0], 'the hour spent: nothing credited, nothing left');
  r = await reportRenownXp({ db, nowS: T0 + 3600 }, P, { character: 'char-aaaa', xp: 300 });
  assert.equal(r.room, RENOWN_XP_HOUR_MAX - 300, 'the next clock hour, whole again');
  // through the real Worker
  const S = await standService();
  const g = await S.guest();
  // INT16 (Integrity-Arc section 7): a report is asked of the account's SEATED realm character - the guest seats one, and
  // the offline id this pin reported for is refused before the route reads a word
  assert.deepEqual(await S.call('/v1/renown/xp', { character: 'char-cccc', xp: 250 }, g.secret), { status: 403, body: { error: 'progress-seat' } }, 'INT16: an offline id earns nothing');   // PIN MOVED (INT16, Integrity-Arc section 7): this pin's guest was credited for an offline id; a report names the account's seated realm character now
  const C = (await seatRealm(S.env, g.secret, 'Cass')).id;
  const res = await S.call('/v1/renown/xp', { character: C, xp: 250 }, g.secret);
  assert.equal(res.status, 200);
  assert.equal(res.body.room, RENOWN_XP_HOUR_MAX - 250, 'the route answers the room');
  assert.deepEqual(renownAnswer(res.body, 250, null).room, RENOWN_XP_HOUR_MAX - 250, 'and the page\'s plan carries it');
  for (const room of [-1, 1.5, '20', null]) assert.equal(renownAnswer({ room }, 1, null).room, null, `a room of ${room} is none`);
  assert.equal(renownAnswer({ room: 0 }, 1, null).room, 0, 'a spent hour is a room of nothing, not none');
});

test('SCALE4h the host: the room kept with the hour and the total it was said at, read only while both still hold; the tracker\'s word the law over what the page last heard; nothing earned in an hour the bound has spent (mutants: a room read in another hour; a room read after another door moved the total; the word not given; a spent hour still earning)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ createRenownTracker, [^}]*renownReportSoon \} from '\.\.\/net\/renownTracker\.js';/);
  assert.match(w, /if \(a\.room !== null\) _renownRoom = \{ room: a\.room, hour: renownHour\(\), xp: renownXp \};/, 'kept as the answer said it, after the total is adopted');
  assert.match(w, /renownXpAdopt\(a\.xp\);[^\n]*\n\s*if \(a\.room !== null\) _renownRoom/, 'the total adopted first, so the room is kept against the total it belongs to');
  // PIN MOVED, AUDIT SCALE II C-4: the hour's last minute said beside the spent hour (renownHourLeftMs)
  assert.match(w, /soon: \(\) => renownReportSoon\(\{ xp: renownXp, pending: renownTracker\?\.pending\(\) \?\? 0, capped: _renownCapHour === renownHour\(\), hourLeftMs: renownHourLeftMs\(\),\s*room: _renownRoom && _renownRoom\.hour === renownHour\(\) && _renownRoom\.xp === renownXp \? _renownRoom\.room : null \}\),/);
  assert.match(w, /earning: \(\) => !!online && !seatOut\(\) && _renownCapHour !== renownHour\(\),/, 'a spent hour earns nothing');
});

test('SCALE4h a fighter\'s hour, measured: Renown reported far less often at the SCALE4h law, the rise still reported at the minute\'s pace (tools/hotWritesBench.mjs over the real Worker; mutants: the law unwired)', async () => {
  const quiet = console.warn; console.warn = () => {};
  try {
    // PIN MOVED, AUDIT SCALE II D-8: the counts exactly, and each rise's report within RENOWN_REPORT_MS of the minute that
    // earned it - `<= 7`, `>= 5` and `level > 2` all held with the rise rule replaced by `return false` (bench's `rises`)
    const r = await playerHour({ role: 'fighter', minutes: 30, xp: 40, renown: 20 });
    assert.equal(r.routes['/v1/renown/xp'].requests, 6, `${r.routes['/v1/renown/xp'].requests} reports in half an hour (the minute's law made 29): the first, then every RENOWN_COALESCE_MS`);
    assert.deepEqual(r.reportsAt.map((at) => at - r.reportsAt[0]), [0, 1, 2, 3, 4, 5].map((i) => i * RENOWN_COALESCE_MS));
    const low = await playerHour({ role: 'fighter', minutes: 30, xp: 40, renown: 2 });
    assert.equal(low.routes['/v1/renown/xp'].requests, 8, 'the coalesced pace and each rise\'s');
    assert.equal(low.level, 6, `a rise reached at the minute's pace (Renown ${low.level})`);
    assert.deepEqual(low.rises.map((x) => x.level), [3, 4, 5, 6]);
    for (const x of low.rises) assert.ok(x.earnedAt != null && x.reportedAt - x.earnedAt <= RENOWN_REPORT_MS, `Renown ${x.level}: earned at ${x.earnedAt}, reported at ${x.reportedAt}`);
  } finally { console.warn = quiet; }
});

// ═══ THE SESSION'S TOUCH, HOURLY ═══════════════════════════════════════════════════════════════════════════════════

test('SCALE4h a session is touched once an hour: within it nothing is written, at it both rows (mutants: the ten minutes back)', async () => {
  assert.equal(SESSION_TOUCH_S, 60 * 60);
  const db = d1();
  const made = await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null });
  const seen = () => db._raw.prepare('SELECT last_seen FROM sessions WHERE player_id = ?').get(made.id).last_seen;
  await resolveSession({ db, subtle, nowS: T0 + 30 * 60 }, made.secret);
  assert.equal(seen(), T0, 'half an hour on: untouched');
  await resolveSession({ db, subtle, nowS: T0 + 60 * 60 }, made.secret);
  assert.equal(seen(), T0 + 3600, 'an hour on: touched');
});

// ═══ WHICH ROWS: THE METRICS ═══════════════════════════════════════════════════════════════════════════════════════

/** A D1 whose statements answer D1's meta: each `all`/`run` its rows read and written, a batch's each - and a first()
 *  that says none, as D1's does. */
function metaD1() {
  const calls = [];
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (...a) => { calls.push(['first', sql, a]); return a.length ? 'col' : { sql, args }; },
    all: async () => { calls.push(['all', sql]); return { results: /^SELECT none/.test(sql) ? [] : [{ sql, args }], meta: { rows_read: 2, rows_written: /^\s*(UPDATE|INSERT|DELETE)/i.test(sql) ? 3 : 0 } }; },
    run: async () => { calls.push(['run', sql]); return { meta: { rows_read: 1, rows_written: /^\s*(UPDATE|INSERT|DELETE)/i.test(sql) ? 1 : 0 } }; },
  });
  return { calls, prepare: (sql) => stmt(sql), batch: async (list) => list.map((s, i) => ({ results: [], meta: { rows_read: 0, rows_written: i + 1 } })) };
}

test('SCALE4h a first() is run as its own all(), so its rows are counted - answered its first row, or null; a first(column) is the runtime\'s own; every write\'s rows charged to its table, a batch\'s each to its own (mutants: a first() run as before; a batch\'s rows to one table; the table unread)', async () => {
  const raw = metaD1();
  const tally = { n: 0 };
  const db = countedDb(raw, tally);
  assert.deepEqual(await db.prepare('UPDATE players SET played_s = 1 RETURNING played_s').bind(7).first(), { sql: 'UPDATE players SET played_s = 1 RETURNING played_s', args: [7] }, 'the first row');
  assert.equal(await db.prepare('SELECT none').first(), null, 'none: null, as first() answers');
  assert.equal(await db.prepare('SELECT x FROM t').first('x'), 'col', 'a column named: the runtime\'s own first');
  assert.deepEqual(raw.calls.map((c) => c[0]), ['all', 'all', 'first']);
  assert.equal(tally.rw, 3, 'the beat\'s kind of write counted at last');
  assert.equal(tally.rr, 4);
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(1).run();
  await db.batch([db.prepare('UPDATE renown_tracks SET xp = 1'), db.prepare('INSERT OR IGNORE INTO town_seat_binds (a) VALUES (1)'), db.prepare('SELECT 1')]);
  assert.deepEqual(tally.tables, { players: 3, sessions: 1, renown_tracks: 1, town_seat_binds: 2 }, 'each to its table; a read charges none');
  for (const [sql, t] of [['UPDATE players SET a=1', 'players'], ['  insert or replace into Renown_Tracks (a)', 'renown_tracks'], ['REPLACE INTO kv (k)', 'kv'], ['DELETE FROM "rate_limits" WHERE', 'rate_limits'], ['UPDATE OR IGNORE sessions SET', 'sessions'], ['SELECT * FROM players', null], ['WITH x AS (SELECT 1) SELECT 2', null], [null, null]]) assert.equal(tableOf(sql), t, String(sql));
  assert.equal(tablesBlob({ a: 1, players: 9, sessions: 9, b: 2 }), 'players:9 sessions:9 b:2 a:1', 'most first, a tie by name');
  assert.equal(tablesBlob(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`t${String(i).padStart(2, '0')}`, 12 - i]))).split(' ').length, 8, 'at most eight');
  assert.equal(tablesBlob(undefined), '');
});

test('SCALE4h the point says the tables written, the hot rows each as its own double, and a heartbeat\'s parts - the service\'s word on the body it read (AUDIT SCALE II A-3), the service still reading the body (mutants: the hot rows unwritten; the parts unsaid; the parts\' order; a part said false counted)', async () => {
  assert.deepEqual([...HOT_TABLES], ['players', 'sessions', 'renown_tracks', 'realm_characters']);
  const raw = metaD1();
  const points = [];
  let heard = null;
  const serve = async (req, env, said) => {
    heard = await req.json();
    said.parts = heartbeatPartsOf(heard);   // PIN MOVED (AUDIT SCALE II A-3): the service says the parts of the body it read
    await env.DB.batch([env.DB.prepare('UPDATE players SET a = 1'), env.DB.prepare('UPDATE sessions SET b = 1'), env.DB.prepare('UPDATE realm_characters SET c = 1')]);
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const body = { post: true, board: 3, beat: true, mail: false };
  await measured(new Request('https://accounts.invalid/v1/heartbeat', { method: 'POST', body: JSON.stringify(body) }), { DB: raw, METRICS: { writeDataPoint: (p) => points.push(p) } }, serve);
  assert.deepEqual(heard, body, 'the service read its body whole');
  assert.equal(points[0].blobs[4], 'realm_characters:3 sessions:2 players:1');
  assert.equal(points[0].blobs[5], 'beat,board,post', 'the parts asked, in the heartbeat\'s order - a part said false is not one');
  assert.deepEqual(points[0].doubles.slice(7), [1, 2, 0, 3], 'players, sessions, renown_tracks, realm_characters');
  assert.equal(heartbeatPartsOf('not an object'), '');   // PIN MOVED (AUDIT SCALE II A-3): a body, not a request
  assert.equal(heartbeatPartsOf(null), '');
  // over the real Worker: a heartbeat's beat - a first() write - is a row written on its point now
  const S = await standService();
  const g = await S.guest();
  const live = [];
  S.env.METRICS = { writeDataPoint: (p) => live.push(p) };
  assert.equal((await S.call('/v1/heartbeat', { beat: true }, g.secret)).status, 200);
  const p = live.at(-1);
  assert.equal(p.blobs[5], 'beat');
  assert.ok(p.doubles[3] >= 1 && p.doubles[7] >= 1, `the beat's row written, and the account's row its hot row (${p.doubles[3]}, ${p.doubles[7]})`);
  assert.equal((await S.call('/v1/account/played', { beat: true }, g.secret)).status, 200);
  assert.equal(live.at(-1).blobs[5], '', 'another route says none, whatever its body holds');   // PIN MOVED (AUDIT SCALE II A-3)
});
