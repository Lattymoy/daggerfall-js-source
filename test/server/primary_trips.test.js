// PRIMARY-TRIPS (2026-10-16, Mac: "Is the server okay?", then "Start #2"; bible/11-Multiplayer/Scale-Arc.md PRIMARY-TRIPS):
// THE ACCOUNT DATABASE'S PRIMARY IS CAPPED BY ITS ROUND TRIPS. It overloaded at 00:00 UTC that night at some 224 batches a
// second, every batch a fraction of a millisecond (p50 0.4 ms) - as at DISPLAY-REPLICA's ceiling, it is the count of trips
// that holds it, never the rows. Each slice here takes trips off it without moving an answer: the seats' list's six reads
// in one batch (SEAT-BATCH), a town's yards off a replica (YARDS-REPLICA), a checkpoint's reads in one batch (SAVE-BATCH),
// the badge's honours in one batch (SIGN-BATCH), a heartbeat's reads before its beat (BEAT-LAST), and a hall witness's
// version bump off the key's own rows (HALL-PLAN). Held over the account service on node:sqlite (test/accountDb.mjs), every
// statement and batch counted where the Worker asks it. tools/mutants/primary_trips.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../../server-account/src/index.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, freshSave } from '../realmSeat.mjs';
import { yardsKept, forgetYards, YARDS_FROM, YARDS_KEPT_MAX, _resetYardsKept } from '../../server-account/src/decor.js';
import { forgetBudgetConfig, budgetKept } from '../../server-account/src/budget.js';
import { _resetArenaCache, arenaHonoursOf } from '../../server-account/src/arena.js';
import { withHonours } from '../../server-account/src/honours.js';
import { ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../../src/net/arena/arenaLaw.js';
import { _resetIliacCache, iliacHonoursOf } from '../../server-account/src/iliac.js';
import { _resetGambitCache, gambitHonoursOf } from '../../server-account/src/gambit.js';

const quiet = async (fn) => { const keep = { warn: console.warn }; console.warn = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** The service stood with every round trip it asks of its database counted, in order: a statement's own `first`, `all` or
 *  `run` is one trip (`sql`), a batch is one trip (`batch`, its statements' SQL). Sessions are the binding's, so a
 *  session's statements are counted here too. */
async function counted(extra = {}) {
  const S = await standService({ SEATS_OPEN: 'on', CHAPTERS_OPEN: 'on', ...extra });
  const db = S.env.DB;
  /** @type {{ sql?: string, batch?: string[] }[]} */
  const trips = [];
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const st = prepare(sql);
    const one = (fn) => async (...a) => { trips.push({ sql }); return fn(...a); };
    return Object.assign(st, { first: one(st.first), all: one(st.all), run: one(st.run), _sql: sql });
  };
  const batch = db.batch.bind(db);
  db.batch = async (list) => { trips.push({ batch: list.map((st) => st._sql) }); return batch(list); };
  const who = await S.registered('Alda');
  const R = await seatRealm(S.env, who.secret, 'Alda', freshSave({ name: 'Alda' }));
  const ask = async (fn) => { trips.length = 0; const r = await fn(); return { r, trips: [...trips] }; };
  return { S, db, who, R, ask };
}
const has = (trip, re) => !!trip.batch?.some((s) => re.test(s));

test('PRIMARY-TRIPS SEAT-BATCH: the seats\' list asks its holders, the week\'s battles and revolts, the Edicts, the works and the red lines in ONE batch - never a trip each - and answers them as before (mutants: a read taken out of the batch; the red lines asked apart)', async () => {
  const { S, who, ask } = await counted();
  await S.call('/v1/seats/list', {}, who.secret);   // the first settles a fresh service's week
  const { r, trips } = await ask(() => S.call('/v1/seats/list', {}, who.secret));
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.seats) && Array.isArray(r.body.red) && 'zero' in r.body, 'the list\'s answer as it was');
  const boards = trips.filter((t) => t.batch);
  assert.equal(boards.length, 1, 'one batch');
  const b = boards[0].batch;
  assert.equal(b.length, 6);
  for (const re of [/FROM town_seat_holds h\s+JOIN guilds/, /FROM town_seat_rights r/, /x\.kind = 'revolt'/, /FROM town_seat_edicts WHERE week = \? AND state = 'law'/, /FROM town_seat_forts/, /FROM town_seat_red/]) assert.ok(b.some((s) => re.test(s)), `${re} in the batch`);
  assert.ok(!trips.some((t) => t.sql && /town_seat_holds h|town_seat_red|town_seat_forts|town_seat_rights/.test(t.sql)), 'none of them a trip of its own');
});

test('PRIMARY-TRIPS YARDS-REPLICA: a town\'s yards are read on a session of their own - any instance\'s first, then from the last kept read\'s bookmark, and the primary\'s right after a decor write in this isolate - and the route itself never opens one (mutants: the read on the binding; a write not marked; the bookmark not kept)', async () => {
  await quiet(async () => {
    const { db } = await counted();
    db._sessions.length = 0;
    const ctx = { db, nowS: T0 };
    assert.equal(YARDS_FROM, 'first-unconstrained');
    await yardsKept(ctx, 1291, T0);
    await yardsKept(ctx, 1291, T0 + 1);   // kept: no read
    assert.deepEqual(db._sessions.map((s) => s.constraint), ['first-unconstrained'], 'the first read any instance\'s, the kept answer no read at all');
    assert.match(db._sessions[0].statements.join('\n'), /LEFT JOIN home_yards_ver v ON v\.map_id = q\.m LEFT JOIN home_yards y/);   // PIN MOVED (YARD-SNAP; AUDIT LEAN-READS 2 B3: the version a row of its own): the town's version and built row - a town with no yard has none, and no rows are read
    await yardsKept(ctx, 1291, T0 + 60);   // past YARDS_KEPT_S
    const mark = db._sessions[1]?.constraint;
    assert.ok(mark && mark !== 'first-unconstrained' && mark !== 'first-primary', `the next read from the last one's bookmark (${mark})`);
    forgetYards(1291);   // a decor write in this isolate (index.js, after every place, move, hide or remove)
    await yardsKept(ctx, 1291, T0 + 61);
    assert.equal(db._sessions[2]?.constraint, 'first-primary', 'the read after this isolate\'s own write the primary\'s - it sees the write');
    await yardsKept(ctx, 1291, T0 + 120);
    assert.notEqual(db._sessions[3]?.constraint, 'first-primary', 'and only that one');
  });
});

test('PRIMARY-TRIPS SAVE-BATCH: a checkpoint reads its record\'s row, the ledger\'s two reads of the character\'s own rows and (where the isolate kept none) the budget\'s config in ONE batch - three trips with the session\'s lookup and the write - and lands as before (mutants: a ledger read asked apart; the config asked apart; the config asked though kept)', async () => {
  const { S, db, who, R, ask } = await counted();
  const save = async () => {
    const at = R.at();
    return worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, { method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(freshSave({ name: 'Alda' })) }), S.env);
  };
  forgetBudgetConfig(db);
  const cold = await ask(save);
  assert.equal(cold.r.status, 200);
  assert.equal(cold.trips.length, 3, `the lookup, the reads, the write (${cold.trips.map((t) => t.batch ? `BATCH(${t.batch.length})` : t.sql.slice(0, 40)).join(' | ')})`);
  const reads = cold.trips[1].batch ?? [];
  assert.equal(reads.length, 4);
  // PIN MOVED (SESSION-SIGN, AUDIT PLAN-1000 E3): the record's row asks its session and the ban beside it, its places numbered
  assert.ok(has(cold.trips[1], /FROM realm_characters WHERE id = \?1 AND player = \?2/) && has(cold.trips[1], /FROM item_uids WHERE char_id = \?1 OR claim_char = \?1/) && has(cold.trips[1], /FROM item_dupes WHERE char_id = \?/) && has(cold.trips[1], /FROM realm_config WHERE key = 'budget'/));
  const warm = await ask(save);
  assert.equal(warm.r.status, 200);
  assert.equal(warm.trips[1].batch?.length, 3, 'the config this isolate keeps is not asked');
  assert.equal(R.at().seq, 3, 'both landed');
});

test('PRIMARY-TRIPS SIGN-BATCH: the doors that read a badge ask the arena\'s, Iliac Hand\'s and The King\'s Gambit\'s honours in ONE batch on the binding - never a session\'s - and leave out a #1 this Worker kept (mutants: a game\'s reads asked apart; the kept #1 asked again)', async () => {
  const { S, db, who, R, ask } = await counted();
  _resetArenaCache(); _resetIliacCache(); _resetGambitCache();
  db._sessions.length = 0;
  const cold = await ask(() => S.call('/v1/auth/token', { character: R.id }, who.secret));
  assert.equal(cold.r.status, 200);
  const honours = cold.trips.filter((t) => has(t, /FROM arena_pve WHERE player = \?1/));
  assert.equal(honours.length, 1, 'one batch');
  for (const re of [/FROM arena_champions WHERE season/, /FROM iliac_champions WHERE season/, /FROM iliac_games WHERE season/, /FROM gambit_champions WHERE season/, /FROM gambit_games WHERE season/]) assert.ok(has(honours[0], re), `${re} in it`);
  assert.ok(!cold.trips.some((t) => t.sql && /arena_pve WHERE player|FROM (arena|iliac|gambit)_champions WHERE season|FROM (iliac|gambit)_games WHERE season/.test(t.sql)), 'none asked apart (a #1 found stale is counted and stored after, as before)');
  assert.ok(!db._sessions.some((s) => s.statements.some((x) => /arena_pve WHERE player/.test(x))), 'on the binding, never the mint\'s session (AUDIT SCALE4d A1)');
  const warm = await ask(() => S.call('/v1/auth/token', { character: R.id }, who.secret));
  const again = warm.trips.filter((t) => has(t, /FROM arena_pve WHERE player = \?1/));
  assert.equal(again.length, 1);
  assert.deepEqual(again[0].batch?.length, 1, 'the three #1s this Worker kept are not asked again - the Grand Champion\'s row alone');
});

test('PRIMARY-TRIPS BEAT-LAST: a heartbeat asks its reads - the box, the board, the post - before its beat, so a session sends none of them after the write to the primary; every part answered as before (mutant: the beat first)', async () => {
  const { S, db, who, ask } = await counted();
  db._sessions.length = 0;
  const { r, trips } = await ask(() => S.call('/v1/heartbeat', { beat: true, mail: true, board: 1291, post: true }, who.secret));
  assert.equal(r.status, 200);
  for (const k of ['beat', 'mail', 'board', 'post']) assert.ok(k in r.body, `${k} answered`);
  const sqls = trips.flatMap((t) => t.batch ?? [t.sql]);
  const beat = sqls.findIndex((s) => /UPDATE players SET\s+played_s = played_s/.test(s));
  assert.ok(beat >= 0, 'the beat written');
  const lastRead = sqls.reduce((at, s, k) => (/^\s*SELECT/i.test(s) && !/FROM sessions s/.test(s) ? k : at), -1);
  assert.ok(beat > lastRead, `the beat after every read of the box, the board and the post (beat at ${beat}, last read at ${lastRead})`);
});

test('PRIMARY-TRIPS HALL-PLAN: a hall witness\'s version bump reads the key\'s own reports - the (kind, key) index - never every hall report through (kind, region) (mutant: the bump\'s DISTINCT on the bare column)', () => {
  const src = readFileSync(new URL('../../server-account/src/npcHalls.js', import.meta.url), 'utf8');
  const m = /`INSERT INTO npc_hall_regions \(region, ver, done, at\) SELECT DISTINCT (\+?region), 1, 0, \?2 FROM world_witness/.exec(src);
  assert.ok(m, 'the bump\'s statement');
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../../server-account/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const plan = db.prepare(`EXPLAIN QUERY PLAN INSERT INTO npc_hall_regions (region, ver, done, at) SELECT DISTINCT ${m[1]}, 1, 0, ?2 FROM world_witness
    WHERE kind = 'npchall' AND key = ?1 AND changes() > 0
    ON CONFLICT (region) DO UPDATE SET ver = npc_hall_regions.ver + 1`).all().map((r) => r.detail).join('\n');
  assert.match(plan, /USING INDEX sqlite_autoindex_world_witness_1 \(kind=\? AND key=\?\)/, plan);
  assert.doesNotMatch(plan, /idx_world_witness_region/);
});

/** A D1 binding over two node:sqlite copies of the schema - a primary and a replica that lags it until `catchUp` - its
 *  sessions served as D1 serves them: 'first-primary' the primary, 'first-unconstrained' the replica, a bookmark the
 *  replica once it has caught up to it, else the primary. `refuse` names a bookmark whose session fails at its read. */
function laggingD1() {
  const mig = readdirSync(new URL('../../server-account/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const mk = () => { const d = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false }); for (const f of mig) d.exec(readFileSync(new URL(`../../server-account/migrations/${f}`, import.meta.url), 'utf8')); return d; };
  const primary = { db: mk(), pos: 0 }, replica = { db: mk(), pos: 0 };
  const mark = (n) => `${n.toString(16).padStart(8, '0')}-00000000-00000000-${'0'.repeat(32)}`;
  const posOf = (m) => parseInt(m.slice(0, 8), 16);
  const L = { refuse: /** @type {string | null} */ (null), sessions: /** @type {{ c: string, on: string }[]} */ ([]) };
  // PIN MOVED (YARD-SNAP): a refused bookmark refuses its first statement whatever it is - the town's built row now
  const stmtOn = (node, sql, refused) => { const st = node.db.prepare(sql); let a = []; const api = { bind(...x) { a = x; return api; }, async all() { if (refused) throw new Error('D1_ERROR: bookmark refused'); return { results: st.all(...a) }; }, async first() { if (refused) throw new Error('D1_ERROR: bookmark refused'); return st.get(...a) ?? null; }, async run() { return { meta: { changes: st.run(...a).changes } }; } }; return api; };
  const binding = {
    prepare: (sql) => stmtOn(primary, sql, false),
    withSession(c) {
      const node = c === 'first-primary' ? primary : c === 'first-unconstrained' ? replica : replica.pos >= posOf(c) ? replica : primary;
      L.sessions.push({ c, on: node === primary ? 'primary' : 'replica' });
      return { prepare: (sql) => stmtOn(node, sql, c === L.refuse), getBookmark: () => mark(node.pos) };
    },
  };
  const ROW = JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  const write = (mapId, id) => { primary.db.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, 300, ?, 41000, ?, 1, 0, 1)').run(mapId, id, ROW); primary.pos++; };
  return { L, binding, write };
}
const pieceIds = (a) => a.yards.flatMap((y) => y.pieces.map((p) => p.id));

test('PRIMARY-TRIPS audit: a town\'s yards never read older than this isolate already answered or wrote once YARDS_KEPT_MAX towns let the kept ones go - the newest bookmark let go is where the next read starts - and a floor whose read fails is let go (mutants: the floor never kept; the floor never read; a failed floor kept)', async () => {
  _resetYardsKept();
  const { L, binding, write } = laggingD1();
  const ctx = { db: binding, nowS: T0 };
  const T = 7;
  write(T, 'mine');   // this isolate's own decor write; the replica not caught up
  forgetYards(T);
  assert.deepEqual(pieceIds(await yardsKept(ctx, T, T0)), ['mine'], 'the read after the write is the primary\'s');
  for (let i = 1; i <= YARDS_KEPT_MAX; i++) await yardsKept(ctx, 100_000 + i, T0);   // the last of them lets every kept town go
  const again = await yardsKept(ctx, T, T0 + 31);
  assert.notEqual(L.sessions.at(-1)?.c, YARDS_FROM, 'from the floor, never any instance\'s');
  assert.deepEqual(pieceIds(again), ['mine'], 'the write still stands - a replica behind it never answers it');
  // the floor's session refused at its read: that read fails, and the next starts from any instance's
  L.refuse = L.sessions.at(-1)?.c ?? null;
  await assert.rejects(() => yardsKept(ctx, 9, T0 + 100));
  await yardsKept(ctx, 10, T0 + 100);
  assert.equal(L.sessions.at(-1)?.c, YARDS_FROM, 'the refused floor let go');
  _resetYardsKept();
});

test('PRIMARY-TRIPS audit: a checkpoint keeps the budget\'s config the moment its batch reads it - a staff change forgotten while the save is opened and the baseline read is never undone by the older row (mutant: the config kept after the baseline\'s read)', async () => {
  const S = await standService();
  const who = await S.registered('Alda');
  const R = await seatRealm(S.env, who.secret, 'Alda', freshSave({ name: 'Alda' }));
  const raw = S.env.DB._raw;
  const OLD = { enforce: false, bands: [{ upTo: 99, rate: 1, cap: 1 }] };
  const NEW = { enforce: true, bands: [{ upTo: 99, rate: 2, cap: 2 }] };
  const setCfg = (c) => raw.prepare("INSERT INTO realm_config (key, value, at, by) VALUES ('budget', ?, 1, NULL) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(JSON.stringify(c));
  setCfg(OLD);
  forgetBudgetConfig(S.env.DB);
  raw.prepare('UPDATE realm_characters SET wealth_v = -1 WHERE id = ?').run(R.id);   // the measure moved: the baseline reads the stored record (R2)
  const get = S.env.SAVES.get.bind(S.env.SAVES);
  let changed = false;
  S.env.SAVES.get = async (k) => { if (!changed) { changed = true; setCfg(NEW); forgetBudgetConfig(S.env.DB); } return get(k); };   // staff's change, mid-checkpoint
  const at = R.at();
  const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R.id}/data`, { method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) }, body: JSON.stringify(freshSave({ name: 'Alda' })) }), S.env);
  assert.equal(res.status, 200);
  assert.ok(changed, 'the change landed between the batch and the baseline');
  assert.equal(budgetKept(S.env.DB), null, 'the older config is not kept over the forgetting - the next checkpoint reads staff\'s');
  S.env.SAVES.get = get;
});

test('PRIMARY-TRIPS audit: a badge\'s kept #1 is the one the plan saw - another request counting a new season while the batch is out never stands in its place (mutant: the kept #1 read after the batch)', async () => {
  _resetArenaCache(); _resetIliacCache(); _resetGambitCache();
  const boundary = ARENA_SEASON_EPOCH_S + 3 * ARENA_SEASON_S;
  const dbFor = (champ, nowS, hold = null) => {
    const st = (sql) => ({ sql, bind() { return this; }, async first() { return /_champions/.test(sql) ? { player: champ, at: nowS } : null; }, async all() { return { results: [] }; }, async run() { return {}; } });
    return { prepare: st, async batch(list) { await hold; return list.map((x) => ({ results: /_champions/.test(x.sql) ? [{ player: champ, at: nowS }] : [] })); } };
  };
  const A = { id: 'A', handle: 'a' };
  for (const of of [arenaHonoursOf, iliacHonoursOf, gambitHonoursOf]) assert.equal((await of({ db: dbFor('A', boundary - 1) }, A, boundary - 1)).champion, true, 'each game\'s #1, kept');
  let release = () => {};
  const hold = new Promise((r) => { release = r; });
  const signing = withHonours({ db: dbFor('A', boundary - 1, hold) }, A, boundary - 1);
  for (const of of [arenaHonoursOf, iliacHonoursOf, gambitHonoursOf]) await of({ db: dbFor(null, boundary) }, { id: 'X', handle: 'x' }, boundary);   // a second on: each game's next season counted
  release();
  const signed = await signing;
  assert.deepEqual([signed.arena.champion, signed.iliac.champion, signed.gambit.champion], [true, true, true], 'the #1 each plan saw');
  _resetArenaCache(); _resetIliacCache(); _resetGambitCache();
});
