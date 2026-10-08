// SCALE4b (2026-10-08, Mac: "Do 1 2 and 3" - the scaling audit's D1 discipline; bible/11-Multiplayer/Scale-Arc.md
// SCALE4b): THE ACCOUNT SERVICE'S OWN CLOCK. Until this the service had no scheduled job, so the sweeps that keep its
// database small ran inside reads - the Notice Board's on every look, a guild board's, the professions' state's on a
// gatherer's every ask, the market History's nine deletes - and the tables nothing swept grew for ever. Now a
// scheduled() of two crons (server-account/src/cron.js): every minute the settlements nobody's read should wait on
// (still run by their reads too, which find them done), every hour the sweeps the reads no longer run and the retention
// the tables never had. And the always-issued updates on the market's, the Work tab's and the guilds' reads are asked
// before they are written. Driven through the real Worker over node:sqlite with every migration (test/accountDb.mjs).
// Each pin failed on the build before it. tools/mutants/scale4b.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { standService, T0 } from './accountDb.mjs';
import worker from '../server-account/src/index.js';
import {
  runCron, jobsFor, CRON_MINUTE, CRON_HOUR, MINUTE_JOBS, HOUR_JOBS, RATE_ROW_KEEP_S, SWEEP_ROWS, ROUNDS_MAX, _resetCronForTests,
} from '../server-account/src/cron.js';
import { openSession, SESSION_IDLE_S } from '../server-account/src/accounts.js';
import { utcDay } from '../src/net/marksLaw.js';
import { CARRIED_ROW_DAYS } from '../src/net/bagLaw.js';
import { MARKET_KEEP_DAYS } from '../src/net/marketLaw.js';
import { GUILD_INVITE_TTL_S } from '../src/net/guildLaw.js';
import { seatWeekOf } from '../src/net/townSeatLaw.js';
import { arenaSeasonOf } from '../src/net/arenaLaw.js';
import { ARENA_CHAMPION_CLOCK_S, ARENA_CHAMPION_STORED_S } from '../server-account/src/arena.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
const DAY = 86_400;
const DF = 17;
const HUBS = { [DF]: [207, 212] };

const OPEN = { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', SEATS_OPEN: 'on' };
const isWrite = (sql) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);

/** The service's database, every statement it is asked recorded - the same binding for every request (the service
 *  keys its kept answers by it). */
function watched(s) {
  const base = s.env.DB;
  const asked = [];
  s.env.DB = { _raw: base._raw, prepare(sql) { asked.push(String(sql)); return base.prepare(sql); }, batch: (list) => base.batch(list) };
  return { asked, raw: base._raw, writes: () => asked.filter(isWrite) };
}

const count = (raw, sql, ...a) => Number(raw.prepare(sql).get(...a).n);

/** The top-level arguments of the call whose `(` ends just before `at` - brackets, strings and a template's `${}`
 *  stepped over (a template resumed after its `}`), so a key built of parts is one argument. */
function argsOf(text, at) {
  const out = [], stack = [];
  let cur = '', q = null;
  for (let i = at; i < text.length; i++) {
    const c = text[i];
    if (q) {
      cur += c;
      if (c === '\\') { cur += text[++i]; continue; }
      if (q === '`' && c === '$' && text[i + 1] === '{') { cur += text[++i]; stack.push('${'); q = null; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { stack.push(c); cur += c; continue; }
    if (c === ')' || c === ']' || c === '}') {
      if (!stack.length) { out.push(cur.trim()); return out; }
      cur += c;
      if (stack.pop() === '${') q = '`';   // back inside the template the `${` opened
      continue;
    }
    if (c === ',' && !stack.length) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return out;
}

// ═══ A. THE SCHEDULE ═════════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE4b A: wrangler.toml\'s two crons are cron.js\'s two schedules, the Worker still exports `default` alone and its scheduled() fires the list its cron names - none for a cron the service does not keep, nothing while it is held for maintenance, and one metrics point a job (mutants: the hour\'s list for the minute, maintenance ignored, the point never written)', async () => {
  const toml = src('server-account/wrangler.toml');
  const crons = /^\[triggers\]\ncrons = \[([^\]]*)\]$/m.exec(toml);
  assert.ok(crons, 'a [triggers] crons line');
  assert.deepEqual(JSON.parse(`[${crons[1]}]`), [CRON_MINUTE, CRON_HOUR]);
  assert.equal(jobsFor(CRON_MINUTE), MINUTE_JOBS);
  assert.equal(jobsFor(CRON_HOUR), HOUR_JOBS);
  assert.deepEqual(jobsFor('0 0 * * *'), []);
  // a module Worker reads every named export of its entrypoint as an entrypoint (AUDIT-ACC F2): `default` alone
  const index = src('server-account/src/index.js');
  assert.deepEqual(index.match(/^export\s+(?!default\b)\S+/gm) ?? [], []);
  assert.deepEqual(Object.keys(worker).sort(), ['fetch', 'scheduled']);

  const s = await standService(OPEN);
  const points = [];
  s.env.METRICS = { writeDataPoint: (p) => points.push(p) };
  const g = await s.guest();
  s.env.DB._raw.prepare(`INSERT INTO board_notices (id, subject, body, author_name, at, expires_at, rid) VALUES ('gone', 's', 'b', 'Mac', ?, ?, 'r1')`).run(T0 - 2 * DAY, T0 - DAY);
  points.length = 0;
  // the minute's list touches no sweep
  await worker.scheduled({ cron: CRON_MINUTE, scheduledTime: T0 * 1000 }, s.env, {});
  assert.equal(count(s.env.DB._raw, 'SELECT COUNT(*) AS n FROM board_notices'), 1, 'the minute sweeps nothing');
  assert.deepEqual(points.map((p) => p.indexes[0]), MINUTE_JOBS.map(([name]) => `cron:${name}`));
  // held for maintenance: nothing runs, nothing is written
  points.length = 0;
  await worker.scheduled({ cron: CRON_HOUR, scheduledTime: T0 * 1000 }, { ...s.env, MAINTENANCE: '1' }, {});
  assert.equal(count(s.env.DB._raw, 'SELECT COUNT(*) AS n FROM board_notices'), 1, 'a held service sweeps nothing');
  assert.deepEqual(points, []);
  // the hour's
  await worker.scheduled({ cron: CRON_HOUR, scheduledTime: T0 * 1000 }, s.env, {});
  assert.equal(count(s.env.DB._raw, 'SELECT COUNT(*) AS n FROM board_notices'), 0, 'the hour sweeps');
  assert.deepEqual(points.map((p) => p.indexes[0]), HOUR_JOBS.map(([name]) => `cron:${name}`));
  const board = points.find((p) => p.indexes[0] === 'cron:board');
  assert.deepEqual(board.blobs, ['cron:board', 'CRON', '200', '']);
  assert.ok(board.doubles[2] >= 2, 'its statements counted');
  assert.equal(board.doubles[3], 1, 'the rows it moved');
  // and nothing of it names a player
  assert.ok(!JSON.stringify(points).includes(g.id));
});

// ═══ B. THE READS WRITE NOTHING THEY SWEPT ═══════════════════════════════════════════════════════════════════════════

test('SCALE4b B: the Notice Board\'s read, a guild board\'s, the professions\' state and the market\'s History write nothing - and answer what they answered when they swept first; the expired rows wait for the hour, which takes them and leaves the live (mutants: each sweep back on its read, a sweep that takes the live)', async () => {
  const s = await standService(OPEN);
  const w = watched(s);
  const raw = w.raw;
  const a = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(a, 100_000, 'a');
  const map = 4242;
  const note = (id, at, expires) => raw.prepare(`INSERT INTO board_notes (id, map_id, author, author_name, subject, body, at, expires_at, rid)
    VALUES (?, ?, ?, 'Aldric', 'subject', 'body', ?, ?, ?)`).run(id, map, a.id, at, expires, `rid-${id}`);
  note('live', T0 - 100, T0 + DAY); note('old1', T0 - 3 * DAY, T0 - 2 * DAY); note('old2', T0 - 2 * DAY, T0 - 1);
  raw.prepare(`INSERT INTO board_notices (id, subject, body, author_name, at, expires_at, rid) VALUES ('n-live', 's', 'b', 'Mac', ?, ?, 'rn1'), ('n-old', 's', 'b', 'Mac', ?, ?, 'rn2')`)
    .run(T0 - 100, T0 + DAY, T0 - 3 * DAY, T0 - DAY);
  const day = utcDay(T0);
  const harvest = (node, d, carry) => raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n, carry)
    VALUES (?, ?, 'ore', ?, ?, 'mining', 'ore:iron', 1, 1, ?, ?, 'n', ?)`).run(d, node, a.id, a.character, d * DAY, `h-${node}`, carry);
  harvest('today', day, 0); harvest('yesterday', day - 1, 0); harvest('older', day - 2, 0);
  harvest('carried-kept', day - CARRIED_ROW_DAYS, 1); harvest('carried-old', day - CARRIED_ROW_DAYS - 1, 1);
  raw.prepare('INSERT INTO market_prices (day, material, price, units) VALUES (?, ?, 5, 1), (?, ?, 5, 1)').run(day - 1, 'ore:iron', day - MARKET_KEEP_DAYS - 1, 'ore:iron');

  // the service as it stands at play: its clock has run (the season's #1 kept, the minute's settlements made)
  _resetCronForTests();
  await runCron(s.env, { cron: CRON_MINUTE, nowS: T0, rand });
  const board = async () => s.call('/v1/board/read', { map }, a.secret);
  const state = async () => s.call('/v1/prof/state', { character: a.character }, a.secret);
  const history = async () => s.call('/v1/market/read', { character: a.character, region: DF, view: 'history', hubs: HUBS }, a.secret);
  for (const [what, read] of [['board', board], ['state', state], ['history', history]]) {
    w.asked.length = 0;
    const r = await read();
    assert.equal(r.status, 200, `${what}: ${JSON.stringify(r.body)}`);
    assert.deepEqual(w.writes(), [], `${what}: a read writes nothing`);
  }
  // the answers before the hour's sweep...
  const before = { board: (await board()).body, state: (await state()).body, history: (await history()).body };
  assert.deepEqual(before.board.notes.map((n) => n.id), ['live']);
  assert.deepEqual(before.board.notices.map((n) => n.id), ['n-live']);
  assert.equal(count(raw, 'SELECT COUNT(*) AS n FROM board_notes'), 3, 'the expired wait for the hour');
  // ...and after it: the same answers, the dead rows gone and the live kept
  _resetCronForTests();
  const ran = await runCron(s.env, { cron: CRON_HOUR, nowS: T0, rand });
  assert.ok(ran.every((j) => j.ok), JSON.stringify(ran));
  assert.deepEqual((await board()).body, before.board);
  assert.deepEqual((await state()).body, before.state);
  assert.deepEqual((await history()).body, before.history);
  assert.deepEqual(raw.prepare('SELECT id FROM board_notes ORDER BY id').all().map((r) => r.id), ['live']);
  assert.deepEqual(raw.prepare('SELECT id FROM board_notices ORDER BY id').all().map((r) => r.id), ['n-live']);
  assert.deepEqual(raw.prepare('SELECT node FROM node_harvests ORDER BY node').all().map((r) => r.node), ['carried-kept', 'today', 'yesterday'],
    'the state\'s own bounds: yesterday kept, a carried row CARRIED_ROW_DAYS');
  assert.deepEqual(raw.prepare('SELECT day FROM market_prices').all().map((r) => r.day), [day - 1], 'MARKET_KEEP_DAYS kept');

  // a guild's board, the same
  const f = await s.found(a, { name: 'The Hound', tag: 'HND' });
  assert.equal(f.status, 200, JSON.stringify(f.body));
  const gid = f.body.guild.id;
  const gnote = (id, expires) => raw.prepare(`INSERT INTO guild_notes (id, guild_id, author, char_id, author_name, subject, body, at, expires_at, rid)
    VALUES (?, ?, ?, ?, 'Aldric', 's', 'b', ?, ?, ?)`).run(id, gid, a.id, a.character, T0 - 100, expires, `g-${id}`);
  gnote('g-live', T0 + DAY); gnote('g-old', T0 - 1);
  w.asked.length = 0;
  const gb = await s.call('/v1/guilds/board', { character: a.character }, a.secret);
  assert.equal(gb.status, 200, JSON.stringify(gb.body));
  assert.deepEqual(w.writes(), [], 'a guild board\'s read writes nothing');
  assert.deepEqual(gb.body.notes.map((n) => n.id), ['g-live']);
  await runCron(s.env, { cron: CRON_HOUR, nowS: T0, rand });
  assert.deepEqual(raw.prepare('SELECT id FROM guild_notes').all().map((r) => r.id), ['g-live']);
  assert.deepEqual((await s.call('/v1/guilds/board', { character: a.character }, a.secret)).body, gb.body);
});

// ═══ C. ASKED BEFORE IT IS WRITTEN ═══════════════════════════════════════════════════════════════════════════════════

test('SCALE4b C: the market\'s read, the Work tab\'s and a guild\'s write nothing while nothing is due - and the moment something is, the same updates go: a listing past its hours expired, a commission past its days, a guild that lost its master crowned (mutants: each update left unasked, its guard inverted)', async () => {
  const s = await standService(OPEN);
  const w = watched(s);
  const raw = w.raw;
  const a = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(a, 100_000, 'a');
  const f = await s.found(a, { name: 'The Hound', tag: 'HND' });
  const gid = f.body.guild.id;
  const market = () => s.call('/v1/market/read', { character: a.character, region: DF, view: 'materials', hubs: HUBS }, a.secret);
  const work = () => s.call('/v1/writs/list', { character: a.character, region: DF }, a.secret);
  const mine = () => s.call('/v1/guilds/mine', { character: a.character }, a.secret);
  for (const [what, read] of [['market', market], ['work', work], ['guild', mine]]) {
    w.asked.length = 0;
    const r = await read();
    assert.equal(r.status, 200, `${what}: ${JSON.stringify(r.body)}`);
    assert.deepEqual(w.writes(), [], `${what}: nothing due, nothing written`);
  }
  // a listing past its hours: expired by the same update, on the read
  raw.prepare(`INSERT INTO market_listings (id, seller, char_id, region, kind, material, units, own, price, fee, at, expires_at, rid, n)
    VALUES ('L1', ?, ?, ?, 'material', 'ore:iron', 5, 5, 3, 1, ?, ?, 'rL1', 'n')`).run(a.id, a.character, DF, T0 - 4 * DAY, T0 - 1);
  w.asked.length = 0;
  assert.equal((await market()).status, 200);
  assert.ok(w.writes().some((sql) => /UPDATE market_listings SET state = 'expired'/.test(sql)), 'the expiry went');
  assert.equal(raw.prepare("SELECT state FROM market_listings WHERE id = 'L1'").get().state, 'expired');
  // a commission past its days, on the Work tab's read
  raw.prepare(`INSERT INTO commissions (id, poster, poster_char, crafter, region, recipe, pay, at, expires_at, rid, n)
    VALUES ('C1', ?, ?, ?, ?, 'longsword:mithril', 900, ?, ?, 'rC1', 'n')`).run(a.id, a.character, a.id, DF, T0 - 4 * DAY, T0 - 1);
  w.asked.length = 0;
  assert.equal((await work()).status, 200);
  assert.ok(w.writes().some((sql) => /UPDATE commissions SET state = 'expired'/.test(sql)));
  assert.equal(raw.prepare("SELECT state FROM commissions WHERE id = 'C1'").get().state, 'expired');
  // a guild with no master (its row demoted by hand - the case a master's going leaves): its first member crowned
  raw.prepare('UPDATE guild_members SET rank = 3 WHERE guild_id = ?').run(gid);
  w.asked.length = 0;
  assert.equal((await mine()).status, 200);
  assert.ok(w.writes().some((sql) => /UPDATE guild_members SET rank = 0/.test(sql)));
  assert.equal(raw.prepare('SELECT rank FROM guild_members WHERE guild_id = ?').get(gid).rank, 0);
  w.asked.length = 0;
  await mine();
  assert.deepEqual(w.writes(), [], 'crowned: nothing to write again');
});

// ═══ D. THE MINUTE'S SETTLEMENTS ═════════════════════════════════════════════════════════════════════════════════════

test('SCALE4b D: every minute the clock settles what no read has asked for - an auction past its end closed, a guild\'s writ and contract past theirs expired and their escrow back, the seats\' Turning (only while the seats are everyone\'s) and the day\'s Motherlodes, picked once an isolate (mutants: a job dropped from the minute, the seats settled behind `dev`, the day picked every minute)', async () => {
  const s = await standService(OPEN);
  const raw = s.env.DB._raw;
  const a = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(a, 100_000, 'a');
  const f = await s.found(a, { name: 'The Hound', tag: 'HND' });
  const gid = f.body.guild.id;
  raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, rid, n)
    VALUES ('A1', ?, ?, ?, '00000000000000a1', 900, 100, 5, ?, ?, 'rA1', 'n')`).run(a.id, a.character, DF, T0 - DAY, T0 - 60);
  raw.prepare(`INSERT INTO guild_writs (id, guild_id, poster, poster_char, officer, week, region, material, units, left_units, pay, escrow, at, expires_at, rid, n)
    VALUES ('W1', ?, ?, ?, 1, 1, ?, 'ore:iron', 10, 10, 3, 30, ?, ?, 'rW1', 'n')`).run(gid, a.id, a.character, DF, T0 - DAY, T0 - 60);
  raw.prepare(`INSERT INTO guild_contracts (id, guild_id, poster, poster_char, officer, week, region, kind, deeds, left_deeds, pay, escrow, at, expires_at, rid, n)
    VALUES ('K1', ?, ?, ?, 1, 1, ?, 'raid', 2, 2, 5, 10, ?, ?, 'rK1', 'n')`).run(gid, a.id, a.character, DF, T0 - DAY, T0 - 60);
  _resetCronForTests();
  const env = { ...s.env, SEATS_OPEN: 'dev' };
  let ran = await runCron(env, { cron: CRON_MINUTE, nowS: T0, rand });
  assert.ok(ran.every((j) => j.ok), JSON.stringify(ran));
  assert.equal(raw.prepare("SELECT state FROM market_auctions WHERE id = 'A1'").get().state, 'unsold', 'no bid: closed unsold, nobody\'s read asked');
  const wr = raw.prepare("SELECT state, returned FROM guild_writs WHERE id = 'W1'").get();
  assert.deepEqual({ ...wr }, { state: 'expired', returned: 1 });
  const k = raw.prepare("SELECT state, returned FROM guild_contracts WHERE id = 'K1'").get();
  assert.deepEqual({ ...k }, { state: 'expired', returned: 1 });
  assert.equal(count(raw, 'SELECT COUNT(*) AS n FROM town_seat_weeks'), 0, 'behind dev, the seats are a developer\'s - settled by their reads');
  assert.equal(count(raw, 'SELECT COUNT(*) AS n FROM motherlode_days WHERE day = ?', utcDay(T0)), 1, 'the day picked');
  assert.equal(count(raw, 'SELECT COUNT(*) AS n FROM arena_champions WHERE season = ? AND at = ?', arenaSeasonOf(T0), T0), 1, 'the season\'s #1 counted and kept');
  // the seats open to everyone: the Turning due is the clock's
  ran = await runCron(s.env, { cron: CRON_MINUTE, nowS: T0, rand });
  assert.deepEqual(raw.prepare('SELECT week FROM town_seat_weeks').all().map((r) => r.week), [seatWeekOf(T0 * 1000) - 1]);
  assert.equal(ran.find((j) => j.name === 'motherlodes').statements, 0, 'picked once an isolate - asked no more');
  assert.equal(ran.find((j) => j.name === 'seats').changed, 1, 'the week due, settled');
  ran = await runCron(s.env, { cron: CRON_MINUTE, nowS: T0 + 60, rand });
  assert.equal(ran.find((j) => j.name === 'seats').changed, 0, 'and a week settled is not settled again');
  assert.equal(ran.find((j) => j.name === 'seats').statements, 1, 'one read says so');
  // the #1 kept younger than ARENA_CHAMPION_CLOCK_S is read, not counted; past it, counted again before a reader would
  assert.deepEqual(['changed', 'statements'].map((k) => ran.find((j) => j.name === 'arena-champion')[k]), [0, 1]);
  ran = await runCron(s.env, { cron: CRON_MINUTE, nowS: T0 + ARENA_CHAMPION_CLOCK_S, rand });
  assert.equal(ran.find((j) => j.name === 'arena-champion').changed, 1);
  assert.ok(ARENA_CHAMPION_CLOCK_S < ARENA_CHAMPION_STORED_S, 'the clock first, the readers never');
  assert.equal(raw.prepare('SELECT at FROM arena_champions WHERE season = ?').get(arenaSeasonOf(T0)).at, T0 + ARENA_CHAMPION_CLOCK_S);
});

// ═══ E. RETENTION ════════════════════════════════════════════════════════════════════════════════════════════════════

test('SCALE4b E: each hour the rows nothing reads any more go - a rate window a day past its start (the longest window any bucket counts is an hour), a session idle past its year (the bound resolveSession refuses it at, by its own index), an invitation past its week - and the live stay; a sweep past a page is taken in rounds, never more than ROUNDS_MAX pages a firing (mutants: the cutoffs moved, the rounds unbounded, the session sweep unindexed)', async () => {
  const s = await standService(OPEN);
  const raw = s.env.DB._raw;
  const g = await s.guest();
  raw.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 3), (?, ?, 7)').run('ip:old', T0 - RATE_ROW_KEEP_S - 1, 'ip:live', T0 - 600);
  const ctx = { db: s.env.DB, subtle, rand };
  const stale = await openSession({ ...ctx, nowS: T0 - SESSION_IDLE_S - 1 }, g.id, 'an old phone');
  const atBound = await openSession({ ...ctx, nowS: T0 - SESSION_IDLE_S }, g.id, 'a laptop');
  const a = await s.registered('Aldric', { renown: 10 });
  s.seedMarks(a, 100_000, 'a');
  const f = await s.found(a, { name: 'The Hound', tag: 'HND' });
  const gid = f.body.guild.id;
  raw.prepare('INSERT INTO guild_invites (guild_id, player, by_name, at) VALUES (?, ?, ?, ?)').run(gid, g.id, 'Aldric', T0 - GUILD_INVITE_TTL_S);
  const b = await s.guest();
  raw.prepare('INSERT INTO guild_invites (guild_id, player, by_name, at) VALUES (?, ?, ?, ?)').run(gid, b.id, 'Aldric', T0 - GUILD_INVITE_TTL_S + 1);
  await runCron(s.env, { cron: CRON_HOUR, nowS: T0, rand });
  assert.deepEqual(raw.prepare('SELECT key FROM rate_limits WHERE key LIKE ? ORDER BY key').all('ip:%').map((r) => r.key).filter((k) => k !== 'ip:unknown'), ['ip:live']);
  const left = raw.prepare('SELECT device_label FROM sessions WHERE player_id = ? ORDER BY device_label').all(g.id).map((r) => r.device_label);
  assert.ok(!left.includes('an old phone') && left.includes('a laptop'), JSON.stringify(left));
  assert.ok(stale.secret && atBound.secret);
  assert.deepEqual(raw.prepare('SELECT player FROM guild_invites').all().map((r) => r.player), [b.id], 'a week old to the second is gone, a second younger stays');
  // a live window's row still counts after the sweep (the bucket's next call increments it, never starts again)
  assert.equal(raw.prepare("SELECT count FROM rate_limits WHERE key = 'ip:live'").get().count, 7);

  // every bucket's window inside the keep: each overRate call's window is an hour or less
  const windows = new Map();
  for (const f2 of readdirSync(new URL('../server-account/src', import.meta.url))) {
    for (const m of src(`server-account/src/${f2}`).matchAll(/export const ([A-Z_]+_WINDOW_S) = ([0-9 *]+);/g)) windows.set(m[1], Function(`return ${m[2]}`)());
  }
  for (const f2 of readdirSync(new URL('../src/net', import.meta.url))) {
    for (const m of src(`src/net/${f2}`).matchAll(/export const ([A-Z_]+_WINDOW_S) = ([0-9 *]+);/g)) windows.set(m[1], Function(`return ${m[2]}`)());
  }
  let calls = 0;
  for (const f2 of readdirSync(new URL('../server-account/src', import.meta.url))) {
    const text = src(`server-account/src/${f2}`);
    for (const m of text.matchAll(/(?<!function )\boverRate\(/g)) {
      calls++;
      const win = argsOf(text, m.index + m[0].length)[3];
      if (win == null) continue;   // the default, LOGIN_WINDOW_S
      const s2 = /^[0-9 *]+$/.test(win) ? Function(`return ${win}`)() : windows.get(win);   // a literal (seatBattles.js's hour) or a named window
      assert.ok(Number.isFinite(s2), `${f2}: overRate counts a window this pin cannot read (${win})`);
      assert.ok(s2 * 2 <= RATE_ROW_KEEP_S, `${win} = ${s2} s - a day keeps it`);
    }
  }
  assert.ok(calls > 40, `every overRate call read (${calls})`);
  assert.ok(windows.get('LOGIN_WINDOW_S') * 2 <= RATE_ROW_KEEP_S);

  // the sessions' sweep by its own index
  const plan = new DatabaseSync(':memory:');
  for (const m of readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) plan.exec(src(`server-account/migrations/${m}`));
  const detail = plan.prepare('EXPLAIN QUERY PLAN SELECT id FROM sessions WHERE last_seen < ?1 LIMIT ?2').all().map((r) => r.detail).join(' | ');
  assert.match(detail, /USING (COVERING )?INDEX idx_sessions_last_seen/, detail);

  // rounds: a backlog past a page is taken a page at a time, ROUNDS_MAX pages a firing at most
  const many = SWEEP_ROWS * ROUNDS_MAX + 5;
  const ins = raw.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)');
  raw.exec('BEGIN');
  for (let i = 0; i < many; i++) ins.run(`backlog:${i}`, T0 - RATE_ROW_KEEP_S - 10);
  raw.exec('COMMIT');
  const first = (await runCron(s.env, { cron: CRON_HOUR, nowS: T0, rand })).find((j) => j.name === 'rate-limits');
  assert.equal(first.changed, SWEEP_ROWS * ROUNDS_MAX, 'one firing, ROUNDS_MAX pages');
  const second = (await runCron(s.env, { cron: CRON_HOUR, nowS: T0, rand })).find((j) => j.name === 'rate-limits');
  assert.equal(second.changed, 5, 'the next firing the rest');
});

test('SCALE4b F: a job that throws never stops the next - the failure is its own point (500, `failed`) and every later job still runs and says so (mutants: the first failure ends the firing, its point unwritten)', async () => {
  const s = await standService(OPEN);
  const points = [];
  s.env.METRICS = { writeDataPoint: (p) => points.push(p) };
  const quiet = console.warn; console.warn = () => {};
  let ran;
  try {
    ran = await runCron(s.env, {
      cron: 'test', nowS: T0, rand,
      jobs: [['breaks', async () => { throw new Error('D1_ERROR: storage is having a day'); }], ['after', async () => 3]],
    });
  } finally { console.warn = quiet; }
  assert.deepEqual(ran.map((j) => [j.name, j.ok, j.changed]), [['breaks', false, 0], ['after', true, 3]]);
  assert.deepEqual(points.map((p) => [p.indexes[0], p.blobs[2], p.blobs[3], p.doubles[3]]), [['cron:breaks', '500', 'failed', 0], ['cron:after', '200', '', 3]]);
  // no binding, no clock: nothing at all
  assert.deepEqual(await runCron({}, { cron: CRON_HOUR, nowS: T0 }), []);
  assert.deepEqual(await runCron(s.env, { cron: CRON_HOUR, nowS: NaN }), []);
});
