// YARD-SNAP (2026-10-19, the account database overloaded again; bible/11-Multiplayer/Scale-Arc.md YARD-SNAP; migration
// 0136) - A TOWN'S YARDS READ AS ONE ROW: `home_yards` keeps each town's yard rows as yardsOf reads them, built at a
// version the database moves on every yard row written (a route, a home released, an account gone, a sweep); a read is
// that row while it is its version's and the rows as they stand while it is not; a decor route builds its town again as
// it answers and the minute's clock builds what anything else left stale.
//
// The proof is an oracle: random yard and room pieces placed, moved within a town and between towns, in and out of a
// yard, taken away, and homes released under them - after each, every town's answer off its built row held to its
// answer off its rows, and a stale row never answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1, standService, T0 } from '../accountDb.mjs';
import {
  yardsOf, settleYards, settleStaleYards, yardRowsOf, yardRowsSql, YARD_SNAP_COLS, YARD_SNAP_READ, YARD_SNAP_SHAPE, YARDS_SETTLE_A_MINUTE, _resetYardsKept,
} from '../../server-account/src/decor.js';
import { shapeOf, KEPT_BOARD_MAX_BYTES } from '../../server-account/src/keptBoard.js';
import { DECOR_YARDS_TOWN_MAX } from '../../src/net/decorLaw.js';
import { MINUTE_JOBS } from '../../server-account/src/cron.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
const TOWNS = [7, 8, 9];
const KEYS = [300, 301, 302];
const place = (x) => JSON.stringify({ pos: [x, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });

/** A database with the towns' homes owned. */
function world(db = d1()) {
  const raw = db._raw;
  raw.prepare('INSERT OR IGNORE INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 0, 0)').run('p-owner', 'owner');
  const home = raw.prepare("INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (?, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)");
  for (const t of TOWNS) for (const k of KEYS) home.run(t, k);
  return { db, raw, home };
}
const put = (raw, t, k, id, yard, at, x = 4) => raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, ?, 0, ?)')
  .run(t, k, id, place(x), at, yard);
/** A town's answer as the rows give it: its built row made stale for the one read, then put back. */
async function fromRows(db, raw, t) {
  const was = raw.prepare('SELECT built FROM home_yards WHERE map_id = ?').get(t);
  if (was) raw.prepare('UPDATE home_yards SET built = -1 WHERE map_id = ?').run(t);
  try { return await yardsOf({ db }, null, { mapId: t }); } finally { if (was) raw.prepare('UPDATE home_yards SET built = ? WHERE map_id = ?').run(was.built, t); }
}
/** A town's version and its built row (AUDIT LEAN-READS 2 B3: the version a row of its own). */
const snapOf = (raw, t) => raw.prepare('SELECT v.ver, y.built, y.shape, y.rows FROM home_yards_ver v LEFT JOIN home_yards y ON y.map_id = v.map_id WHERE v.map_id = ?').get(t);
const stale = (raw, t) => { const r = snapOf(raw, t); return !!r && (r.ver !== r.built || r.shape !== YARD_SNAP_SHAPE); };

test('YARD-SNAP the oracle: through yard and room pieces placed, moved within and between towns, in and out of a yard, taken away and their homes released, every town\'s answer off its built row is its answer off its rows, a stale row is never answered, and a room piece moves no town (mutants: a delete unmoved, a move between towns moving one, a room piece moving its town, the build\'s order, the stale row answered)', async () => {
  for (let seed = 1; seed <= 25; seed++) {
    const { db, raw, home } = world();
    const r = lcg(seed * 104729);
    let ids = 0;
    for (let op = 0; op < 80; op++) {
      const x = r();
      const t = TOWNS[Math.floor(r() * TOWNS.length)], k = KEYS[Math.floor(r() * KEYS.length)];
      const vers = () => TOWNS.map((m) => raw.prepare('SELECT ver FROM home_yards_ver WHERE map_id = ?').get(m)?.ver ?? 0);
      const before = vers();
      let movesTowns = [];
      if (x < 0.45) {
        const yard = r() < 0.7 ? 1 : 0;
        put(raw, t, k, `p${ids++}`, yard, 1 + Math.floor(r() * 5), Math.floor(r() * 8));
        if (yard) movesTowns = [t];
      } else if (x < 0.75) {
        const row = raw.prepare('SELECT map_id, building_key, id, yard FROM home_decor ORDER BY id LIMIT 1 OFFSET ?').get(Math.floor(r() * 10));
        if (row) {
          const to = r() < 0.5 ? row.map_id : t, yard = r() < 0.5 ? row.yard : 1 - row.yard;
          raw.prepare('UPDATE home_decor SET map_id = ?, building_key = ?, yard = ?, placed_at = placed_at + 1 WHERE map_id = ? AND building_key = ? AND id = ?')
            .run(to, k, yard, row.map_id, row.building_key, row.id);
          movesTowns = [...(row.yard ? [row.map_id] : []), ...(yard ? [to] : [])];
        }
      } else if (x < 0.92) {
        const row = raw.prepare('SELECT map_id, building_key, id, yard FROM home_decor ORDER BY id LIMIT 1 OFFSET ?').get(Math.floor(r() * 10));
        if (row) { raw.prepare('DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').run(row.map_id, row.building_key, row.id); if (row.yard) movesTowns = [row.map_id]; }
      } else {
        const had = raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = 1').get(t, k).n;
        raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(t, k);   // the cascade takes its pieces
        home.run(t, k);
        if (had) movesTowns = [t];
      }
      const after = vers();
      TOWNS.forEach((m, i) => assert.equal(after[i] !== before[i], movesTowns.includes(m), `seed ${seed} op ${op}: town ${m} moved ${after[i] - before[i]}`));
      // half the time the route's build, half the time the rows read as they stand
      if (r() < 0.5) for (const m of TOWNS) await settleYards(db, m);
      for (const m of TOWNS) {
        const want = await fromRows(db, raw, m);
        assert.deepEqual(await yardsOf({ db }, null, { mapId: m }), want, `seed ${seed} op ${op}: town ${m}`);
        if (stale(raw, m)) {
          const asked = [];
          await yardsOf({ db: { prepare: (sql) => { asked.push(sql); return db.prepare(sql); } } }, null, { mapId: m });
          assert.equal(asked.length, 2, 'a stale row: the rows read as they stand');
        }
      }
    }
  }
});

test('YARD-SNAP a built town is one row and one statement, its answer in the read\'s own order and under the town\'s bound - the Daggerfall city\'s past it too; a town that never stood a yard has none, and answers none (mutants: the bound, the order, the columns)', async () => {
  const { db, raw } = world();
  // past the bound, placed out of order
  for (let i = 0; i < DECOR_YARDS_TOWN_MAX + 40; i++) put(raw, 7, KEYS[i % 3], `y${String((i * 7919) % 5000).padStart(4, '0')}`, 1, 1 + (i % 4), i % 8);
  put(raw, 7, 300, 'room', 0, 1);
  await settleYards(db, 7);
  const asked = [];
  const answer = await yardsOf({ db: { prepare: (sql) => { asked.push(sql); return db.prepare(sql); } } }, null, { mapId: 7 });
  assert.deepEqual(asked, [YARD_SNAP_READ], 'one statement: the built row');
  assert.deepEqual(answer, await fromRows(db, raw, 7));
  assert.equal(answer.yards.reduce((n, y) => n + y.pieces.length, 0), DECOR_YARDS_TOWN_MAX);
  const row = raw.prepare('SELECT rows FROM home_yards WHERE map_id = 7').get();
  const rows = yardRowsOf(row.rows);
  assert.equal(rows.length, DECOR_YARDS_TOWN_MAX);
  assert.deepEqual(Object.keys(rows[0]), [...YARD_SNAP_COLS]);
  assert.deepEqual([...YARD_SNAP_COLS], raw.prepare('PRAGMA table_info(home_decor)').all().map((c) => c.name), 'every column of home_decor - a column added to it is added to the built row and the read alike');
  assert.deepEqual(rows.map((x) => ({ ...x })), raw.prepare(yardRowsSql('?')).all(7).map((x) => ({ ...x })), 'the rows the read gives, in its order');
  assert.equal(yardRowsOf('not json'), null);
  assert.equal(yardRowsOf('[[1,2]]'), null, 'a row of other columns is no row');
  assert.deepEqual(await yardsOf({ db }, null, { mapId: 9 }), { mapId: 9, yards: [] });
  assert.equal(raw.prepare('SELECT (SELECT COUNT(*) FROM home_yards WHERE map_id = 9) + (SELECT COUNT(*) FROM home_yards_ver WHERE map_id = 9) AS n').get().n, 0);
  // the build reads in the index's order: no sort
  const plan = raw.prepare(`EXPLAIN QUERY PLAN ${yardRowsSql('?')}`).all(7).map((p) => p.detail).join(' | ');
  assert.match(plan, /idx_home_decor_yard_order/);
  assert.doesNotMatch(plan, /TEMP B-TREE/);
});

test('YARD-SNAP a decor route builds its town as it answers; the minute\'s clock builds the towns a cascade left stale, YARDS_SETTLE_A_MINUTE a firing (mutants: the route\'s build, the clock\'s job, the clock\'s page)', async () => {
  const svc = await standService();
  const raw = svc.env.DB._raw;
  assert.match(src('server-account/src/index.js'), /if \(path !== '\/v1\/homes\/decor\/use'\) \{[^\n]*\n\s+forgetYards\(body\?\.mapId\);[^\n]*\n\s+await settleYards\(ctx\.db, body\?\.mapId\)/, 'a route that moves a yard builds its town; using a chest does not');
  assert.ok(MINUTE_JOBS.some(([name]) => name === 'yard-snap'), 'a minute\'s job');
  assert.equal(YARDS_SETTLE_A_MINUTE, 50);
  const { db } = world(svc.env.DB);
  const n = YARDS_SETTLE_A_MINUTE + 3;
  const home = raw.prepare("INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (?, 300, 'p-owner', 'c', 'Owner', 17, 1, 1)");
  for (let t = 1000; t < 1000 + n; t++) { home.run(t); put(raw, t, 300, 'a', 1, 1); }
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_yards_ver v LEFT JOIN home_yards y ON y.map_id = v.map_id WHERE y.built IS NOT v.ver').get().n, n);
  assert.equal(await settleStaleYards(db), YARDS_SETTLE_A_MINUTE);
  assert.equal(await settleStaleYards(db), 3);
  assert.equal(await settleStaleYards(db), 0);
  _resetYardsKept();
});

/** The shape 0136 built every town in: the 2,000 bound's build (YARD-TOWN moved the bound - 0175 builds them again). */
const SHAPE_0136 = '92826ba1';

test('YARD-SNAP the migrations\' backfills: the towns standing yards when 0136 is applied are built in its own shape at its 2,000 bound; YARD-TOWN\'s 0175 builds every one again in the shape the code reads, at DECOR_YARDS_TOWN_MAX, their answers their rows\' (mutants: 0136\'s bound and shape; 0175\'s bound and shape, its rebuild kept as it was)', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const files = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files.filter((f) => f < '0136')) raw.exec(src(`server-account/migrations/${f}`));
  const db = { _raw: raw, prepare: (sql) => { const st = raw.prepare(sql); let a = []; const api = { bind: (...x) => { a = x; return api; }, first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }) }; return api; } };
  world({ _raw: raw });
  for (let i = 0; i < DECOR_YARDS_TOWN_MAX + 5; i++) put(raw, 8, KEYS[i % 3], `b${i}`, 1, 1, i % 8);
  put(raw, 7, 300, 'one', 1, 1);
  raw.exec(src(`server-account/migrations/${files.find((f) => f.startsWith('0136'))}`));
  const at0136 = snapOf(raw, 8);
  assert.equal(at0136.shape, SHAPE_0136, '0136 built in its own day\'s shape');
  assert.equal(yardRowsOf(at0136.rows).length, 2000, '0136 at its own day\'s bound');
  assert.ok(DECOR_YARDS_TOWN_MAX > 2000);
  for (const f of files.filter((f) => f >= '0137')) raw.exec(src(`server-account/migrations/${f}`));
  assert.equal(yardRowsOf(snapOf(raw, 8).rows).length, DECOR_YARDS_TOWN_MAX, '0175 at the town\'s bound now');
  for (const t of [7, 8]) {
    const r = snapOf(raw, t);
    assert.equal(r.built, r.ver, `town ${t} built`);
    assert.equal(r.shape, YARD_SNAP_SHAPE, `town ${t} built in the shape the code reads (the deploy reads it at once)`);
    const asked = [];
    assert.deepEqual(await yardsOf({ db: { prepare: (sql) => { asked.push(sql); return db.prepare(sql); } } }, null, { mapId: t }), await fromRows(db, raw, t));
    assert.deepEqual(asked, [YARD_SNAP_READ], 'off its built row');
  }
  // AUDIT LEAN-READS B8: 0039's (map_id, yard) is the order index's prefix - gone
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'idx_home_decor_yard'").get().n, 0);
});

test('YARD-SNAP AUDIT LEAN-READS B1: a town built by another deploy\'s read - another shape - is read as its rows stand and built again by the minute\'s clock, however quiet the town; the shape is the build\'s columns, order and bound (mutants: the shape unread, the clock blind to it, the shape\'s parts)', async () => {
  const { db, raw } = world();
  put(raw, 7, 300, 'a', 1, 1);
  put(raw, 8, 300, 'b', 1, 1);
  await settleYards(db, 7);
  await settleYards(db, 8);
  // AUDIT LEAN-READS 2 B5: the shape is the read whole - its columns, its town, its yards alone, its order and bound - and
  // the bound the build keeps under; the read of a town no row answers is the build's own text
  assert.equal(YARD_SNAP_SHAPE, shapeOf('yards: [columns...] each, NULL past the bound', yardRowsSql('?'), KEPT_BOARD_MAX_BYTES));
  assert.match(yardRowsSql('?'), new RegExp(`^SELECT ${YARD_SNAP_COLS.join(', ')} FROM home_decor\\s+WHERE map_id = \\? AND yard = 1 ORDER BY building_key, placed_at, id LIMIT ${DECOR_YARDS_TOWN_MAX}$`));
  raw.prepare("UPDATE home_yards SET shape = 'an older deploy', rows = '[]' WHERE map_id = 7").run();
  const asked = [];
  const got = await yardsOf({ db: { prepare: (sql) => { asked.push(sql); return db.prepare(sql); } } }, null, { mapId: 7 });
  assert.deepEqual(asked, [YARD_SNAP_READ, yardRowsSql('?1')], 'another shape: the rows read as they stand, by the build\'s own read');
  assert.equal(got.yards.length, 1, 'never the older deploy\'s rows');
  assert.equal(await settleStaleYards(db), 1, 'the clock builds it - no write to the town needed');
  assert.equal(raw.prepare('SELECT shape FROM home_yards WHERE map_id = 7').get().shape, YARD_SNAP_SHAPE);
  assert.equal(await settleStaleYards(db), 0);
  assert.deepEqual(await yardsOf({ db }, null, { mapId: 7 }), await fromRows(db, raw, 7));
});

test('YARD-SNAP AUDIT LEAN-READS 2: a yard write moves its town\'s version in a row of its own and never rewrites the kept rows (B3); a town standing yard pieces with no version row is read as it stands, never as no yard, and its next write of any kind makes the row again (B4); rows past the bound are kept as none, read as they stand and said (B7) (mutants: a delete\'s version unmade, the orphan unasked, the bound unkept)', async () => {
  const { db, raw } = world();
  assert.ok(!raw.prepare('PRAGMA table_info(home_yards)').all().some((c) => c.name === 'ver'), 'the kept rows carry no version');
  put(raw, 7, 300, 'a', 1, 1);
  await settleYards(db, 7);
  const kept = raw.prepare('SELECT built, rows FROM home_yards WHERE map_id = 7').get();
  const total = () => raw.prepare('SELECT total_changes() AS n').get().n;
  let t = total();
  put(raw, 7, 301, 'b', 1, 2);
  assert.equal(total() - t, 2, 'the piece and its town\'s version: nothing else written');
  assert.deepEqual(raw.prepare('SELECT built, rows FROM home_yards WHERE map_id = 7').get(), kept, 'the kept rows untouched');
  // B4: the version row lost - the town is read as it stands, and a delete or a move makes the row again
  raw.prepare('DELETE FROM home_yards_ver WHERE map_id = 7').run();
  const asked = [];
  const got = await yardsOf({ db: { prepare: (sql) => { asked.push(sql); return db.prepare(sql); } } }, null, { mapId: 7 });
  assert.deepEqual(got, await fromRows(db, raw, 7));
  assert.equal(got.yards.reduce((n, y) => n + y.pieces.length, 0), 2, 'never no yard');
  assert.deepEqual(asked, [YARD_SNAP_READ, yardRowsSql('?1')]);
  raw.prepare("DELETE FROM home_decor WHERE map_id = 7 AND id = 'b'").run();
  assert.ok(snapOf(raw, 7), 'a delete makes the version row again');
  assert.equal(snapOf(raw, 7).ver, kept.built + 1, 'past the version the rows were kept at - never meeting them again');
  raw.prepare('DELETE FROM home_yards_ver WHERE map_id = 7').run();
  raw.prepare("UPDATE home_decor SET placed_at = 5 WHERE map_id = 7 AND id = 'a'").run();
  assert.ok(snapOf(raw, 7), 'and a move');
  assert.equal(await settleStaleYards(db), 1);
  assert.deepEqual(await yardsOf({ db }, null, { mapId: 7 }), await fromRows(db, raw, 7));
  const asked9 = [];
  assert.deepEqual(await yardsOf({ db: { prepare: (sql) => { asked9.push(sql); return db.prepare(sql); } } }, null, { mapId: 9 }), { mapId: 9, yards: [] }, 'a town with neither: none');
  assert.deepEqual(asked9, [YARD_SNAP_READ], 'in one statement');
  // B7: a town's rows past KEPT_BOARD_MAX_BYTES - kept as none (D1 refuses a row past 2 MB, and the clock's page with it)
  const big = JSON.stringify({ note: 'x'.repeat(900) });
  for (let i = 0; i < 1800; i++) raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard, item) VALUES (8, 300, ?, 41000, ?, 1, 0, 1, ?)').run(`g${i}`, place(1), big);
  await settleYards(db, 8);
  const row = snapOf(raw, 8);
  assert.equal(row.built, row.ver, 'built');
  assert.equal(row.rows, null, 'past the bound: no rows kept');
  const said = [];
  const warn = console.warn;
  console.warn = (...a) => said.push(a.join(' '));
  try {
    const asked2 = [];
    const got8 = await yardsOf({ db: { prepare: (sql) => { asked2.push(sql); return db.prepare(sql); } } }, null, { mapId: 8 });
    assert.deepEqual(asked2, [YARD_SNAP_READ, yardRowsSql('?1')], 'read as they stand');
    assert.deepEqual(got8, await fromRows(db, raw, 8));
    await yardsOf({ db }, null, { mapId: 8 });
  } finally { console.warn = warn; }
  assert.equal(said.filter((x) => x.includes('a town\'s yards')).length, 1, 'said once an isolate');
  assert.equal(await settleStaleYards(db), 0, 'and not built again each minute');
});
