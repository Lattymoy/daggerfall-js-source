// ARENA-BOARD (2026-10-19, the account database overloaded again; bible/11-Multiplayer/Scale-Arc.md ARENA-BOARD;
// migration 0139) - THE ARENA'S BOARD READ AS ONE ROW A SEASON: its ten counts, every caller's alike, kept at a version the
// database moves on every bout, void, account gone and banner joined or left; the caller's own rows read after them.
//
// The proof is an oracle: ladder and players' bouts across seasons and banners, runs voided, banners joined and left and
// accounts deleted under their bouts (a cascade, a SET NULL) - after each, the board as every caller reads it off its kept
// row held to the board counted afresh.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1, T0 } from '../accountDb.mjs';
import { arenaBoardOf, arenaShared, arenaSharedOf, ARENA_BOARD_READ, ARENA_BOARD_KEEP, ARENA_BOARD_SHAPE } from '../../server-account/src/arena.js';
import { arenaSeasonOf } from '../../src/net/arena/arenaLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
const PEOPLE = ['p-ana', 'p-bo', 'p-cy', 'p-di', 'p-ed'];
const ENV = {};

function world() {
  const db = d1();
  const raw = db._raw;
  for (const p of PEOPLE) raw.prepare('INSERT OR IGNORE INTO players (id, guest_name, handle, created_at, last_seen, registered_at) VALUES (?, ?, ?, 0, 0, 0)').run(p, p, p.slice(2));
  return { db, raw };
}
/** The board as a caller reads it, its counts kept - and counted afresh. */
async function both(db, raw, player, nowS) {
  const season = arenaSeasonOf(nowS);
  await arenaShared({ db }, season);   // kept
  const kept = await arenaBoardOf({ db, nowS }, player, ENV);
  const row = raw.prepare('SELECT built FROM arena_boards WHERE season = ?').get(season);
  assert.equal(row?.built, raw.prepare('SELECT ver FROM arena_board_ver').get().ver, 'kept at the arena\'s version');
  raw.prepare('UPDATE arena_boards SET built = -1 WHERE season = ?').run(season);
  const fresh = await arenaBoardOf({ db, nowS }, player, ENV);
  return { kept, fresh, row };
}

test('ARENA-BOARD the oracle: through ladder and players\' bouts across seasons and banners, runs voided, banners joined and left and accounts deleted under their bouts, every caller\'s board off its kept counts is the board counted afresh (mutants: a trigger dropped, the version unread)', async () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { db, raw } = world();
    const r = lcg(seed * 7727);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const SEASON_S = 28 * 86_400;
    let nowS = T0, bouts = 0;
    for (let op = 0; op < 60; op++) {
      const x = r();
      const season = arenaSeasonOf(nowS);
      if (x < 0.35) {
        raw.prepare('INSERT OR IGNORE INTO arena_pve (bout, player, season, tier, step, won, how, banner, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(`v${bouts++}`, pick(PEOPLE), season, Math.floor(r() * 10), Math.floor(r() * 4), r() < 0.7 ? 1 : 0, 'k', pick(['red', 'blue', null]), nowS + op);
      } else if (x < 0.6) {
        const a = pick(PEOPLE), b = pick(PEOPLE);
        raw.prepare('INSERT INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at) VALUES (?, ?, ?, ?, ?, ?, 1000, 1000, ?, ?, ?, ?, ?, ?)')
          .run(`b${bouts++}`, season, a, b, Math.floor(r() * 3), 'k', 1000 + Math.floor(r() * 50), 1000 - Math.floor(r() * 50), r() < 0.85 ? 1 : 0, pick(['red', 'blue', null]), pick(['red', 'blue', null]), nowS + op);
      } else if (x < 0.68) raw.prepare('UPDATE arena_pve SET voided = 1 WHERE player = ?').run(pick(PEOPLE));
      else if (x < 0.8) {
        raw.prepare(`INSERT INTO arena_members (player, banner, season, left_banner, left_season, at) VALUES (?1, ?2, ?3, NULL, NULL, ?4)
          ON CONFLICT (player) DO UPDATE SET banner = ?2, season = ?3, at = ?4`).run(pick(PEOPLE), pick(['red', 'blue', null]), season, nowS);
      } else if (x < 0.86) {
        const p = pick(PEOPLE);
        raw.prepare('DELETE FROM players WHERE id = ?').run(p);   // its ladder bouts go; its side of a players' bout is set NULL
        raw.prepare('INSERT INTO players (id, guest_name, handle, created_at, last_seen, registered_at) VALUES (?, ?, ?, 0, 0, 0)').run(p, p, p.slice(2));
      } else if (x < 0.92) nowS += Math.floor(r() * SEASON_S);   // a season turns now and then
      const me = r() < 0.2 ? null : { id: pick(PEOPLE), handle: 'x', registered_at: 0 };
      const { kept, fresh, row } = await both(db, raw, me, nowS);
      assert.ok(row && Number.isSafeInteger(row.built) && row.built > 0, 'kept');
      assert.deepEqual(kept, fresh, `seed ${seed} op ${op}`);
    }
  }
});

test('ARENA-BOARD each count where the board says it, hand-counted: this season\'s standings and last season\'s (its laurel), the rosters by banner, the members by banner, the climb, the Hall and the fastest (mutants: a count read into another\'s place)', async () => {
  const { db, raw } = world();
  const S = arenaSeasonOf(T0);
  let at0 = T0;
  while (arenaSeasonOf(at0) === S) at0 -= 86_400;
  assert.equal(arenaSeasonOf(at0), S - 1, 'a bout of last season');
  const pve = raw.prepare("INSERT INTO arena_pve (bout, player, season, tier, step, won, how, banner, at) VALUES (?, ?, ?, ?, ?, ?, 'k', ?, ?)");
  const pvp = raw.prepare("INSERT INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at) VALUES (?, ?, ?, ?, ?, 'k', 1000, 1000, ?, ?, 1, ?, ?, ?)");
  pve.run('g1', 'p-ana', S - 1, 9, 3, 1, 'blue', at0);        // last season: blue's Grand Champion, 10
  pve.run('l1', 'p-bo', S - 1, 0, 0, 1, 'red', at0);          // and red's one bout, 1 - blue the laurel
  pve.run('n1', 'p-cy', S, 2, 3, 1, 'red', T0);               // this season: red's champion of tier 2, 3
  pve.run('n2', 'p-di', S, 0, 0, 1, 'blue', T0 + 1);          // blue's bout, 1
  pvp.run('p1', S, 'p-cy', 'p-di', 0, 1010, 990, 'red', 'blue', T0 + 2);   // red's players' win, 2
  raw.prepare("INSERT INTO arena_members (player, banner, season, at) VALUES ('p-cy', 'red', ?1, 0), ('p-di', 'blue', ?1, 0), ('p-ed', 'blue', ?1, 0)").run(S);
  const b = await arenaBoardOf({ db, nowS: T0 + 10 }, { id: 'p-cy', handle: 'cy', registered_at: 0 }, ENV);
  assert.deepEqual(b.team.standings, { red: 5, blue: 1 });
  assert.deepEqual({ red: b.team.last.red, blue: b.team.last.blue, winner: b.team.last.winner, laurel: b.team.laurel }, { red: 1, blue: 10, winner: 'blue', laurel: 'blue' });
  assert.deepEqual(b.team.members, { red: 1, blue: 2 });
  assert.deepEqual(b.team.rosters.red.rows.map((r) => [r.points, r.wins]), [[5, 2]], 'red: the champion\'s 3 and the players\' win\'s 2');
  assert.deepEqual(b.team.rosters.blue.rows.map((r) => [r.points, r.wins]), [[1, 1]]);
  assert.equal(b.me.points, 5);
  assert.equal(b.pve.total, 4, 'the climb: every account that won a ladder bout');
  assert.equal(b.hall.length, 1, 'the Hall: the one Grand Champion');
  assert.equal(b.fast.total, 1);
  assert.equal(b.pvp.total, 2, 'the season\'s rated board');
});

test('ARENA-BOARD a kept season is one statement for its counts; a bout moves the arena\'s one version and the next caller counts again and keeps it; a slow count never stands over a newer one; callers that missed together write it once; a row of another shape is counted again; the board\'s keep runs after the caller\'s own reads (AUDIT LEAN-READS B1, B2, D4, D5; mutants: the keep unguarded, the counts read through a write, the shape unread, the keep rewriting a kept board, the keep before the caller\'s reads)', async () => {
  const { db, raw } = world();
  const season = arenaSeasonOf(T0);
  const bout = (id, p) => raw.prepare("INSERT INTO arena_pve (bout, player, season, tier, step, won, how, banner, at) VALUES (?, ?, ?, 1, 0, 1, 'k', 'red', ?)").run(id, p, season, T0);
  const ver = () => raw.prepare('SELECT ver FROM arena_board_ver WHERE id = 1').get().ver;
  const built = (s = season) => raw.prepare('SELECT built FROM arena_boards WHERE season = ?').get(s)?.built;
  bout('x1', 'p-ana');
  await arenaShared({ db }, season);
  assert.equal(built(), ver());
  const asked = [];
  const counted = Object.create(db);
  counted.prepare = (sql) => { asked.push(sql); return db.prepare(sql); };
  counted.batch = (l) => { asked.push(`BATCH(${l.length})`); return db.batch(l); };
  await arenaShared({ db: counted }, season);
  assert.deepEqual(asked, [ARENA_BOARD_READ], 'kept: one statement');
  // D4: the arena's one version - a bout moves it, and no season's board row is written
  await arenaShared({ db }, season - 1);
  const lastText = raw.prepare('SELECT rows FROM arena_boards WHERE season = ?').get(season - 1).rows;
  const changes = raw.prepare('SELECT total_changes() AS n').get().n;
  bout('x2', 'p-bo');
  assert.equal(raw.prepare('SELECT total_changes() AS n').get().n - changes, 2, 'the bout and the version - no board row rewritten');
  assert.equal(ver(), built() + 1, 'a bout moves it');
  asked.length = 0;
  const after = await arenaShared({ db: counted }, season);
  assert.ok(asked.includes('BATCH(12)'), 'counted again');
  assert.equal(built(), ver(), 'and kept');
  assert.equal(after.rosters.red.length, 2);
  assert.equal(raw.prepare('SELECT rows FROM arena_boards WHERE season = ?').get(season - 1).rows, lastText);
  // a slow count: another caller counts and keeps the newer board while it is out - the slow one's is not put over it
  const slow = Object.create(db);
  slow.batch = async (l) => { const out = await db.batch(l); bout('x3', 'p-cy'); await arenaShared({ db }, season); return out; };
  raw.prepare('UPDATE arena_boards SET built = -1 WHERE season = ?').run(season);
  await arenaShared({ db: slow }, season);
  assert.equal(built(), ver(), 'the newer stands');
  assert.equal(arenaSharedOf(raw.prepare('SELECT rows FROM arena_boards WHERE season = ?').get(season).rows).rosters.red.length, 3, 'with the bout the slow count missed');
  // B2: five callers miss together - written once
  bout('x4', 'p-di');
  let writes = 0;
  const keeps = Object.create(db);
  keeps.prepare = (sql) => {
    const st = db.prepare(sql);
    if (sql !== ARENA_BOARD_KEEP) return st;
    return { bind: (...a) => ({ run: async () => { const res = await st.bind(...a).run(); writes += res.meta.changes; return res; } }) };
  };
  await Promise.all(Array.from({ length: 5 }, () => arenaShared({ db: keeps }, season)));
  assert.equal(writes, 1, 'one write for the five');
  // B1: a row of another shape is no board
  const keptNow = JSON.parse(raw.prepare('SELECT rows FROM arena_boards WHERE season = ?').get(season).rows);
  assert.ok(arenaSharedOf(JSON.stringify({ ...keptNow, rosters: { red: [], blue: [] } })), 'a board\'s text in every way but its shape');
  raw.prepare("UPDATE arena_boards SET shape = 'an older deploy', rows = ? WHERE season = ?").run(JSON.stringify({ ...keptNow, rosters: { red: [], blue: [] } }), season);
  assert.equal((await arenaShared({ db }, season)).rosters.red.length, 4, 'another shape: counted again');
  assert.equal(raw.prepare('SELECT shape FROM arena_boards WHERE season = ?').get(season).shape, ARENA_BOARD_SHAPE, 'and kept in this one');
  // D5: the board's keep after the caller's own reads
  bout('x5', 'p-ed');
  const order = [];
  const seen = Object.create(db);
  seen.prepare = (sql) => { order.push(sql === ARENA_BOARD_KEEP ? 'KEEP' : /arena_members WHERE player|FROM arena_pvp\s+WHERE a = \?1/.test(sql) ? 'MINE' : 'OTHER'); return db.prepare(sql); };
  await arenaBoardOf({ db: seen, nowS: T0 + 10 }, { id: 'p-ana', handle: 'ana', registered_at: 0 }, ENV);
  assert.ok(order.includes('MINE') && order.lastIndexOf('MINE') < order.indexOf('KEEP'), `the caller's reads, then the keep: ${order.join(' ')}`);
  assert.equal(arenaSharedOf('{"grandRows":[]}'), null, 'not a board');
  // AUDIT LEAN-READS 2 B5: the kept text is the reads' rows alone - the banners' points worked out on the way out - so the
  // shape, which hashes the reads, is all of what a row holds
  const keptText = JSON.parse(raw.prepare('SELECT rows FROM arena_boards WHERE season = ?').get(season).rows);
  assert.deepEqual(Object.keys(keptText).sort(), ['counts', 'fastAll', 'grandRows', 'pveAll', 'pvpAll', 'rosters', 'standingRows']);
  assert.equal(arenaSharedOf(JSON.stringify({ ...keptText, standingRows: { now: [[]], last: [[], []] } })), null, 'a season\'s rows short: no board');
});

test('ARENA-BOARD the writes that move a season are the database\'s own - every ladder bout, players\' bout and banner membership written, voided or deleted, by any route or cascade - and stand after every migration (mutant: a trigger dropped)', () => {
  const { raw } = world();
  const triggers = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'arena_board_%' ORDER BY name").all().map((t) => t.name);
  assert.ok(raw.prepare("SELECT sql FROM sqlite_master WHERE name = 'arena_board_pve_in'").get().sql.includes('UPDATE arena_board_ver SET ver = ver + 1 WHERE id = 1'), 'the arena\'s one version');
  assert.deepEqual(triggers, ['arena_board_member_in', 'arena_board_member_out', 'arena_board_member_up', 'arena_board_pve_in', 'arena_board_pve_out', 'arena_board_pve_up', 'arena_board_pvp_in', 'arena_board_pvp_out', 'arena_board_pvp_up']);
  assert.match(src('server-account/src/arena.js'), /const \{ grandRows, pvpAll, pveAll, fastAll, standings, last, rosters, counts \} = await arenaShared\(ctx, season, later\);/, 'the board reads its counts off the kept row');
});
