// YC4 HOME-CELL (2026-10-29, bible/11-Multiplayer/Yard-Cells.md section 14) - THE TOWN'S HOMES BY CELL AND BY VERSION.
// Over the real migrations: the triggers move exactly the cells whose shared rows changed, the shared answer is
// homesInTown's for a reader with nothing of its own, the own answer is homesInTown's rows for the caller's own homes,
// a tenancy's end moves its cell by the clock, a version never goes back, and the routes answer through the Worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1, standService, T0 } from '../accountDb.mjs';
import {
  settleHomeCell, settleHomeCellsClock, settleHomeCellsAfter, readHomeCells, homeCellRowsOf, homeCellsKept, forgetHomeCell,
  _resetHomeCellsKept, HOME_CELL_SHAPE, HOME_CELLS_FROM, HOMES_KEPT_S,
} from '../../server-account/src/homeCells.js';
import { homesInTown, homesOwn, sharedHomeOf } from '../../server-account/src/homes.js';
import { yardCellOf } from '../../src/net/yardCellLaw.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';

const LOOK = JSON.stringify({ door: { climate: 'desert', record: 1 } });
const WOLF = JSON.stringify({ field: 'azure', border: 'gold', device: 'wolf' });
const ME = { id: 'p-me' };
const MY_CHAR = 'char-me';
const STRANGER = { id: 'p-stranger' };

/** A database with the players a test needs, and writers for its homes, rooms, guilds and the caller's own rows. */
function standDb(raw = null) {
  const db = raw ? null : d1();
  const r = raw ?? db._raw;
  for (const id of ['p-me', 'p-other', 'p-third', 'p-stranger']) r.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 0, 0)').run(id, id);
  const home = (mapId, key, { player = 'p-other', char = 'char-other', name = 'Other', entry = 'private', look = null, score = 0, deed = 0, guild = null, paid = 0 } = {}) => r
    .prepare('INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at, entry, look, score, deed, guild_id, paid) VALUES (?, ?, ?, ?, ?, 17, 1, 1, ?, ?, ?, ?, ?, ?)')
    .run(mapId, key, player, char, name, entry, look, score, deed, guild, paid);
  const room = (mapId, key, n, { price = 5, listed = 1, tenant = null, tenantChar = null, until = 0 } = {}) => r
    .prepare('INSERT INTO home_rooms (map_id, building_key, room, anchor, price, listed, tenant, tenant_char, until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(mapId, key, n, 'a', price, listed, tenant, tenantChar, until);
  const guild = (id, name, tag) => r.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at, heraldry) VALUES (?, ?, ?, ?, '[]', 0, ?)").run(id, name, name.toLowerCase(), tag, WOLF);
  const member = (player, char, guildId, rank) => r.prepare("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, 'n', 0)").run(player, char, guildId, rank);
  const ver = (mapId, cell) => { const got = r.prepare('SELECT ver, built, stale_at FROM home_cell_ver WHERE map_id = ? AND cell = ?').get(mapId, cell); return got ? { ...got } : null; };
  const row = (mapId, cell) => { const got = r.prepare('SELECT built, shape, rows FROM home_cells WHERE map_id = ? AND cell = ?').get(mapId, cell); return got ? { ...got } : null; };
  return { db, raw: r, home, room, guild, member, ver, row };
}

/** Every home of `mapId` in `cells` as the cells answer them, by building key. */
async function sharedOf(db, mapId, cells, nowS = T0) {
  const read = await readHomeCells(db, mapId, cells.map((c) => [c, 0]), nowS);
  return new Map(read.cells.flatMap((c) => c.homes).map((h) => [h.buildingKey, h]));
}

const without = (row, field) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== field));

test('YC4 migration 0193 builds every cell holding a home in the shape the code reads, its rows the code\'s own build, its stale_at the soonest tenancy\'s end (mutants: the backfill\'s range, the stale_at\'s tenant clause)', async () => {
  const migration = readFileSync(new URL('../../server-account/migrations/0193_home_cell.sql', import.meta.url), 'utf8');
  assert.ok(migration.includes(`'${HOME_CELL_SHAPE}'`), 'the backfill writes the code\'s own shape');
  const keys = [makeBuildingKey(0, 0, 3), makeBuildingKey(0, 0, 9), makeBuildingKey(2, 7, 1), makeBuildingKey(2, 7, 255)];
  const lay = (s) => {
    s.guild('g1', 'Wolves', 'WLF');
    s.home(7, keys[0], { look: LOOK, score: 3 });
    s.home(7, keys[1], { player: 'p-third', char: 'char-third', name: 'Third', entry: 'public', deed: 1 });
    s.home(7, keys[2], { guild: 'g1', name: 'Founder' });
    s.home(7, keys[3], { look: LOOK, score: -9 });
    s.room(7, keys[0], 1, { price: 9 });
    s.room(7, keys[0], 2, { price: 4, tenant: 'p-me', tenantChar: MY_CHAR, until: 2_100_000_000 });
    s.room(7, keys[3], 1, { price: 7, tenant: 'p-me', tenantChar: MY_CHAR, until: 2_000_000_000 });
    s.room(7, keys[3], 2, { price: 7, listed: 0, tenant: 'p-me', tenantChar: MY_CHAR, until: 1_900_000_000 });
  };
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const dir = new URL('../../server-account/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files.filter((f) => f < '0193')) raw.exec(readFileSync(new URL(f, dir), 'utf8'));
  lay(standDb(raw));
  raw.exec(readFileSync(new URL(files.find((f) => f.startsWith('0193')), dir), 'utf8'));
  const backfilled = raw.prepare('SELECT cell, built, shape, rows FROM home_cells WHERE map_id = 7 ORDER BY cell').all().map((r) => ({ ...r }));
  assert.deepEqual(backfilled.map((r) => r.cell), [...new Set(keys.map(yardCellOf))].sort((a, b) => a - b), 'one row a cell holding a home');
  for (const r of backfilled) assert.equal(r.shape, HOME_CELL_SHAPE);
  const vers = raw.prepare('SELECT cell, ver, built, stale_at FROM home_cell_ver WHERE map_id = 7 ORDER BY cell').all().map((r) => ({ ...r }));
  assert.ok(vers.every((v) => v.ver === v.built), 'each built at its version, none stale');
  assert.deepEqual(vers.map((v) => v.stale_at), [2_100_000_000, 2_000_000_000], 'the soonest end of a listed room let - an unlisted room\'s none');
  // the code's own build of the same homes, cell for cell
  const fresh = standDb();
  lay(fresh);
  for (const k of keys) await settleHomeCell(fresh.db, 7, k, T0);
  const built = fresh.raw.prepare('SELECT cell, rows FROM home_cells WHERE map_id = 7 ORDER BY cell').all().map((r) => ({ ...r }));
  assert.deepEqual(backfilled.map((r) => ({ cell: r.cell, rows: r.rows })), built);
  assert.deepEqual(fresh.raw.prepare('SELECT stale_at FROM home_cell_ver WHERE map_id = 7 ORDER BY cell').all().map((r) => r.stale_at), vers.map((v) => v.stale_at));
  assert.ok(homeCellRowsOf(built[0].rows).every((r) => !('player' in r) && !('char_id' in r)), 'no player\'s id, no character\'s');
});

test('YC4 the oracle: through homes claimed, released, moved between cells and towns, repainted, rescored, renamed; rooms offered, let, ended and withdrawn; guilds renamed - a cell\'s version moves exactly when a shared field of it is written, never for an owner\'s own column, and its answer off its built row is its answer off its rows (mutants: the moved trigger\'s OLD arm, a WHEN guard, the guild trigger, the rooms\' key)', async () => {
  const TOWNS = [7, 8];
  const KEYS = [makeBuildingKey(1, 1, 1), makeBuildingKey(1, 1, 2), makeBuildingKey(3, 4, 1)];
  const CELLS = [...new Set(KEYS.map(yardCellOf))];
  const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
  for (let seed = 1; seed <= 20; seed++) {
    const s = standDb();
    const { db, raw } = s;
    s.guild('g1', 'Wolves', 'WLF');
    s.guild('g2', 'Bears', 'BER');
    const r = lcg(seed * 7919);
    const pick = (list) => list[Math.floor(r() * list.length)];
    const cellVers = () => TOWNS.flatMap((t) => CELLS.map((c) => s.ver(t, c)?.ver ?? 0));
    const homeAt = (t, k) => raw.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').get(t, k);
    const hallTaken = (g) => raw.prepare('SELECT 1 FROM homes WHERE guild_id = ?').get(g);
    for (let op = 0; op < 60; op++) {
      const t = pick(TOWNS);
      const k = pick(KEYS);
      const before = cellVers();
      /** @type {string[]} the cells the op must move, `town:cell` */
      let moves = [];
      const here = `${t}:${yardCellOf(k)}`;
      const x = r();
      const h = homeAt(t, k);
      if (!h) {
        const g = r() < 0.2 && !hallTaken('g1') ? 'g1' : null;
        s.home(t, k, { guild: g, look: r() < 0.5 ? LOOK : null, score: Math.floor(r() * 12) - 6 });
        moves = [here];
      } else if (x < 0.12) {
        raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(t, k);   // its rooms go with it
        moves = [here];
      } else if (x < 0.24) {
        const t2 = pick(TOWNS);
        const k2 = pick(KEYS);
        if (!homeAt(t2, k2)) {
          raw.prepare('PRAGMA foreign_keys = OFF').run();   // the rooms carried to a house not yet there, as arenaMoveHome's batch does it
          raw.prepare('UPDATE home_rooms SET map_id = ?, building_key = ? WHERE map_id = ? AND building_key = ?').run(t2, k2, t, k);
          raw.prepare('UPDATE homes SET map_id = ?, building_key = ? WHERE map_id = ? AND building_key = ?').run(t2, k2, t, k);
          raw.prepare('PRAGMA foreign_keys = ON').run();
          moves = t2 === t && k2 === k ? [] : [here, `${t2}:${yardCellOf(k2)}`];
        }
      } else if (x < 0.4) {
        const [column, value] = pick([['entry', pick(['public', 'private', 'guild'])], ['look', pick([LOOK, null])], ['score', Math.floor(r() * 12) - 6], ['owner_name', pick(['Other', 'Renamed'])], ['deed', pick([0, 1])]]);
        raw.prepare(`UPDATE homes SET ${column} = ? WHERE map_id = ? AND building_key = ?`).run(value, t, k);
        if (h[column] !== value) moves = [here];
      } else if (x < 0.5) {
        const [column, value] = pick([['paid', Math.floor(r() * 900)], ['rent_due', Math.floor(r() * 50)], ['char_id', pick(['char-a', 'char-b'])], ['layout', pick(['L1', null])], ['bought_at', Math.floor(r() * 9)]]);
        raw.prepare(`UPDATE homes SET ${column} = ? WHERE map_id = ? AND building_key = ?`).run(value, t, k);   // the owner's own: no cell moves
      } else if (x < 0.62) {
        const n = 1 + Math.floor(r() * 3);
        if (!raw.prepare('SELECT 1 FROM home_rooms WHERE map_id = ? AND building_key = ? AND room = ?').get(t, k, n)) {
          s.room(t, k, n, { price: 1 + Math.floor(r() * 9), listed: r() < 0.8 ? 1 : 0 });
          moves = [here];
        }
      } else if (x < 0.85) {
        const room = raw.prepare('SELECT * FROM home_rooms ORDER BY map_id, building_key, room LIMIT 1 OFFSET ?').get(Math.floor(r() * 4));
        if (room) {
          const roomCell = `${room.map_id}:${yardCellOf(room.building_key)}`;
          const y = r();
          if (y < 0.2) {
            raw.prepare('DELETE FROM home_rooms WHERE map_id = ? AND building_key = ? AND room = ?').run(room.map_id, room.building_key, room.room);
            moves = [roomCell];
          } else if (y < 0.8) {
            const [column, value] = pick([['listed', pick([0, 1])], ['tenant', pick(['p-me', null])], ['until', T0 + Math.floor(r() * 5) * 100], ['price', 1 + Math.floor(r() * 9)]]);
            raw.prepare(`UPDATE home_rooms SET ${column} = ? WHERE map_id = ? AND building_key = ? AND room = ?`).run(value, room.map_id, room.building_key, room.room);
            if (room[column] !== value) moves = [roomCell];
          } else {
            raw.prepare('UPDATE home_rooms SET anchor = ?, tenant_char = ? WHERE map_id = ? AND building_key = ? AND room = ?').run(`a${op}`, `c${op}`, room.map_id, room.building_key, room.room);
          }
        }
      } else {
        const g = pick(['g1', 'g2']);
        const hall = raw.prepare('SELECT map_id, building_key FROM homes WHERE guild_id = ?').get(g);
        if (r() < 0.6) {
          raw.prepare('UPDATE guilds SET name = ?, heraldry = ? WHERE id = ?').run(`Guild ${op}`, r() < 0.5 ? WOLF : null, g);
          if (hall) moves = [`${hall.map_id}:${yardCellOf(hall.building_key)}`];
        } else {
          raw.prepare('UPDATE guilds SET ranks = ? WHERE id = ?').run(`[${op}]`, g);   // nobody's shared field
        }
      }
      const after = cellVers();
      TOWNS.flatMap((t2) => CELLS.map((c) => `${t2}:${c}`)).forEach((key, i) => assert.equal(after[i] !== before[i], moves.includes(key), `seed ${seed} op ${op}: cell ${key} moved ${after[i] - before[i]}`));
      if (r() < 0.5) for (const t2 of TOWNS) for (const k2 of KEYS) await settleHomeCell(db, t2, k2, T0);
      for (const t2 of TOWNS) {
        const asked = CELLS.map((c) => [c, 0]);
        const built = await readHomeCells(db, t2, asked, T0);
        raw.prepare('UPDATE home_cells SET built = -built WHERE map_id = ?').run(t2);
        const standing = await readHomeCells(db, t2, asked, T0);
        raw.prepare('UPDATE home_cells SET built = -built WHERE map_id = ?').run(t2);
        assert.deepEqual(built.cells.map((c) => c.homes), standing.cells.map((c) => c.homes), `seed ${seed} op ${op}: town ${t2}`);
      }
    }
  }
});

/** A town with every kind of home a reader can meet, and the caller's own rows in it. */
function standTown() {
  const s = standDb();
  const { raw } = s;
  const k = (record) => makeBuildingKey(2, 2, record);
  const far = (record) => makeBuildingKey(5, 1, record);
  s.guild('g1', 'Wolves', 'WLF');
  s.guild('g2', 'Bears', 'BER');
  s.guild('g3', 'Owls', 'OWL');
  raw.prepare("INSERT INTO realm_characters (id, player, name, created_at, updated_at) VALUES (?, 'p-me', 'Me', 0, 0)").run(MY_CHAR);
  s.home(7, k(1), { player: 'p-me', char: MY_CHAR, name: 'Me', look: LOOK, score: -7, paid: 400 });   // mine, shunned
  s.home(7, k(2), { player: 'p-me', char: 'char-alt', name: 'Me', paid: 0 });   // mine, crossed
  s.home(7, k(3), { player: 'p-me', char: MY_CHAR, name: 'Me', deed: 1 });   // a deed held for the named character: hidden
  s.home(7, k(4), { player: 'p-me', char: 'char-alt', name: 'Me', deed: 1 });   // a deed of the account's other character
  s.home(7, k(5), { guild: 'g1', name: 'Founder', look: LOOK, score: -8 });   // a hall the caller's character is in
  s.home(7, k(6), { guild: 'g2', name: 'Founder2', look: LOOK });   // a hall the account's other character is in
  s.home(7, k(7), { guild: 'g3', name: 'Founder3', look: LOOK, score: -9 });   // a stranger's hall, shunned
  s.home(7, k(8), { look: LOOK, score: 2 });   // rented by the caller
  s.home(7, k(9), { score: -1 });   // voted on by the caller
  s.home(7, k(10), {});   // the caller's offer to buy
  s.home(7, far(1), { player: 'p-me', char: MY_CHAR, name: 'Me' });   // the caller's offer to sell
  s.home(7, far(2), { player: 'p-third', char: 'char-third', name: 'Third', entry: 'guild' });   // a guildmate's
  s.home(7, far(3), { player: 'p-third', char: 'char-third', name: 'Third', entry: 'guild', look: LOOK, score: -6 });   // a guildmate's, shunned
  s.home(7, far(4), { entry: 'public', look: LOOK, score: 4 });   // nothing of the caller's
  s.home(7, far(5), { deed: 1, player: 'p-third', char: 'char-third', name: 'Third' });   // another's deed
  s.home(8, k(1), { player: 'p-me', char: MY_CHAR, name: 'Me' });   // another town
  s.member('p-me', MY_CHAR, 'g1', 0);
  s.member('p-me', 'char-alt', 'g2', 2);
  s.member('p-third', 'char-third', 'g1', 3);
  s.room(7, k(8), 1, { price: 6, tenant: 'p-me', tenantChar: MY_CHAR, until: T0 + 500 });
  s.room(7, k(8), 2, { price: 3 });
  s.room(7, far(4), 1, { price: 8, tenant: 'p-other', tenantChar: 'x', until: T0 - 5 });
  s.room(7, k(1), 1, { price: 2 });
  raw.prepare("INSERT INTO home_votes (map_id, building_key, player, vote, voted_at) VALUES (7, ?, 'p-me', -1, 0)").run(k(9));
  const offer = (id, key, seller, buyer) => raw.prepare("INSERT INTO home_offers (id, map_id, building_key, seller, seller_char, buyer, price, keep_decor, keep_items, rev, state, at, until) VALUES (?, 7, ?, ?, 'sc', ?, 50, 1, 0, 0, 'open', 0, ?)").run(id, key, seller, buyer, T0 + 900);
  offer('a'.repeat(32), k(10), 'p-other', 'p-me');
  offer('b'.repeat(32), far(1), 'p-me', 'p-other');
  return { ...s, cells: [yardCellOf(k(1)), yardCellOf(far(1))], keys: { k, far } };
}

test('YC4 the shared answer is homesInTown\'s for a reader with nothing of its own, home for home - built or standing, halls, shunned looks, deeds, free rooms and all; never a player\'s id or a character\'s (mutants: sharedHomeOf keeps `mine`, the rooms counted at another moment)', async () => {
  const { db, raw, cells } = standTown();
  const town = await homesInTown({ db, nowS: T0 }, STRANGER, { mapId: 7, character: 'char-stranger' });
  assert.ok(town.homes.length >= 15);
  const standing = await sharedOf(db, 7, cells);
  for (const c of cells) await settleHomeCell(db, 7, c * 256, T0);
  assert.ok(raw.prepare('SELECT COUNT(*) AS n FROM home_cells WHERE map_id = 7').get().n >= 2, 'built');
  const built = await sharedOf(db, 7, cells);
  for (const row of town.homes) {
    assert.equal(row.mine, false, 'a stranger owns none');
    assert.deepEqual(standing.get(row.buildingKey), without(row, 'mine'), `${row.buildingKey}: as its rows stand`);
    assert.deepEqual(built.get(row.buildingKey), without(row, 'mine'), `${row.buildingKey}: off its built row`);
  }
  assert.equal(built.size, town.homes.length, 'every home of the town, no more');
  for (const h of built.values()) assert.deepEqual(Object.keys(h).filter((f) => !['buildingKey', 'owner', 'entry', 'rent', 'score', 'look', 'deed', 'hall'].includes(f)), [], JSON.stringify(h));
  assert.ok([...built.values()].some((h) => h.look) && [...built.values()].some((h) => h.rent) && [...built.values()].some((h) => h.hall) && [...built.values()].some((h) => h.deed), 'the town reaches every shared field');
  assert.deepEqual(sharedHomeOf({ building_key: 9, owner_name: 'X', entry: 'private', score: -6, look: LOOK }), { buildingKey: 9, owner: 'X', entry: 'private', score: -6 }, 'a shunned home\'s paint is no stranger\'s');
});

test('YC4 the own answer: every home the caller\'s own rows reach - owned, a hall of its guilds, a room it rents, a vote, an offer either way, a guildmate\'s door - as homesInTown answers it, every home homesInTown answers with anything of the caller\'s among them, and the named character\'s deed hidden (mutants: an arm of the keys dropped, the hidden deed listed)', async () => {
  const { db, keys } = standTown();
  const town = await homesInTown({ db, nowS: T0 }, ME, { mapId: 7, character: MY_CHAR });
  const own = await homesOwn({ db, nowS: T0 }, ME, { mapId: 7, character: MY_CHAR });
  const shared = await sharedOf(db, 7, [yardCellOf(keys.k(1)), yardCellOf(keys.far(1))]);
  const ownByKey = new Map(own.homes.map((h) => [h.buildingKey, h]));
  const townByKey = new Map(town.homes.map((h) => [h.buildingKey, h]));
  for (const row of own.homes) assert.deepEqual(row, townByKey.get(row.buildingKey), `${row.buildingKey}: homesInTown's own row`);
  for (const row of town.homes) {
    const anything = row.mine || !isDeepEqual(without(row, 'mine'), shared.get(row.buildingKey));
    if (anything) assert.ok(ownByKey.has(row.buildingKey), `${row.buildingKey} carries the caller's own: ${JSON.stringify(row)}`);
  }
  const expected = [keys.k(1), keys.k(2), keys.k(4), keys.k(5), keys.k(6), keys.k(8), keys.k(9), keys.k(10), keys.far(1), keys.far(2), keys.far(3)];
  assert.deepEqual([...ownByKey.keys()].sort((a, b) => a - b), expected.sort((a, b) => a - b), 'each arm reached, nothing of a stranger\'s');
  assert.deepEqual(own.hidden, [keys.k(3)], 'the named character\'s deed: no online home to it');
  assert.ok(!town.homes.some((h) => h.buildingKey === keys.k(3)), 'as homesInTown leaves it out');
  assert.ok(ownByKey.get(keys.k(1)).look && !shared.get(keys.k(1)).look, 'a shunned home\'s paint to its owner alone');
  assert.equal(ownByKey.get(keys.k(8)).tenant, T0 + 500);
  assert.equal(ownByKey.get(keys.k(9)).vote, -1);
  assert.equal(ownByKey.get(keys.far(2)).guildmate, true);
  assert.deepEqual((await homesOwn({ db, nowS: T0 }, ME, { mapId: 9 })).homes, [], 'a town with nothing of the caller\'s');
  assert.deepEqual(await homesOwn({ db, nowS: T0 }, ME, { mapId: 0 }), { error: 'bad-home' });
});

const isDeepEqual = (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } };

test('YC4 time moves vacancy: a built cell keeps when its let room ends, the clock moves its version past that moment and builds it again with the room free, and a quiet world costs the clock one statement (mutants: the clock\'s bump, its due compare)', async () => {
  const s = standDb();
  const { db, raw } = s;
  const key = makeBuildingKey(4, 4, 4);
  const cell = yardCellOf(key);
  s.home(7, key, {});
  s.room(7, key, 1, { price: 6, tenant: 'p-me', tenantChar: MY_CHAR, until: T0 + 100 });
  s.room(7, key, 2, { price: 9, tenant: 'p-me', tenantChar: MY_CHAR, until: T0 + 400 });
  const first = await settleHomeCell(db, 7, key, T0);
  assert.equal(s.ver(7, cell).stale_at, T0 + 100, 'the soonest end kept');
  assert.deepEqual((await readHomeCells(db, 7, [[cell, 0]], T0)).cells[0].homes[0].rent, undefined, 'no room free');
  assert.equal(await settleHomeCellsClock(db, T0 + 99), 0, 'not yet');
  assert.equal(s.ver(7, cell).ver, first.ver, 'the version stands');
  assert.equal(await settleHomeCellsClock(db, T0 + 100), 1, 'at the end: moved and built');
  const at = s.ver(7, cell);
  assert.equal(at.ver, first.ver + 1);
  assert.equal(at.built, at.ver);
  assert.equal(at.stale_at, T0 + 400, 'the next end kept');
  const read = await readHomeCells(db, 7, [[cell, first.ver]], T0 + 100);
  assert.deepEqual(read.cells.map((c) => [c.ver, c.homes[0].rent]), [[first.ver + 1, { vacant: 1, from: 6 }]], 'a page holding the old version hears the room free');
  await settleHomeCellsClock(db, T0 + 400);
  assert.equal(s.ver(7, cell).stale_at, null, 'nothing let: nothing to wait for');
  // a quiet world: one look
  let statements = 0;
  const counted = { ...db, prepare: (sql) => { statements++; return db.prepare(sql); }, batch: (list) => db.batch(list) };
  assert.equal(await settleHomeCellsClock(counted, T0 + 500), 0);
  assert.equal(statements, 1);
  // a cascade (no route) leaves its cell stale for the clock
  raw.prepare('DELETE FROM home_rooms WHERE map_id = 7 AND building_key = ?').run(key);
  assert.notEqual(s.ver(7, cell).ver, s.ver(7, cell).built);
  assert.equal(await settleHomeCellsClock(db, T0 + 500), 1);
  assert.equal(s.ver(7, cell).ver, s.ver(7, cell).built);
});

test('YC4 a reader is answered only the cells that moved past the versions it holds, in its order, within the budget; a version older than it holds is no change (mutants: the version compare, the budget)', async () => {
  const s = standDb();
  const { db } = s;
  const near = makeBuildingKey(4, 4, 1);
  const far = makeBuildingKey(0, 7, 1);
  s.home(7, near, { name: 'Near' });
  s.home(7, far, { name: 'Far' });
  await settleHomeCell(db, 7, near, T0);
  const empty = yardCellOf(makeBuildingKey(2, 2, 2));
  const first = await readHomeCells(db, 7, [[yardCellOf(near), 0], [yardCellOf(far), 0], [empty, 0]], T0);
  assert.deepEqual(first.cells.map((c) => c.homes.map((h) => h.owner)), [['Near'], ['Far']], 'the asker\'s order; a cell with no home is no change');
  assert.equal(first.vers.get(empty), 0);
  const held = first.cells.map((c) => [c.cell, c.ver]);
  assert.deepEqual((await readHomeCells(db, 7, held, T0)).cells, [], 'nothing moved: nothing sent');
  assert.deepEqual((await readHomeCells(db, 7, held.map(([c, v]) => [c, v + 5]), T0)).cells, [], 'a version held past the read\'s (a replica behind) is no change');
  s.raw.prepare("UPDATE homes SET entry = 'public' WHERE map_id = 7 AND building_key = ?").run(far);
  assert.deepEqual((await readHomeCells(db, 7, held, T0)).cells.map((c) => c.cell), [yardCellOf(far)], 'only the cell that moved');
  const tight = await readHomeCells(db, 7, [[yardCellOf(near), 0], [yardCellOf(far), 0]], T0, 1);
  assert.deepEqual(tight.cells.map((c) => c.cell), [yardCellOf(near)], 'the first always');
  assert.deepEqual(tight.more, [yardCellOf(far)], 'the rest for the next request');
});

test('YC4 an isolate keeps home cells: an asker holding a cell\'s version is answered from memory, a write here sends the next read to the primary, and a replica behind the asker never takes a cell back (mutants: the kept compare, the written mark)', async () => {
  _resetHomeCellsKept();
  const s = standDb();
  const { db } = s;
  const key = makeBuildingKey(2, 3, 4);
  s.home(7, key, { name: 'Kept' });
  await settleHomeCell(db, 7, key, T0);
  const sessions = [];
  const counted = { ...db, prepare: (sql) => { sessions.at(-1).reads++; return db.prepare(sql); } };
  const ctx = { db: { ...counted, withSession: (from) => { sessions.push({ from, reads: 0 }); return { ...counted, getBookmark: () => `mark-${sessions.length}` }; } } };
  const cell = yardCellOf(key);
  const first = await homeCellsKept(ctx, { mapId: 7, cells: [[cell, 0]] }, T0);
  assert.deepEqual(first.cells.map((c) => c.homes[0].owner), ['Kept']);
  assert.equal(sessions.at(-1).from, HOME_CELLS_FROM);
  const ver = first.cells[0].ver;
  const reads = sessions.length;
  assert.deepEqual((await homeCellsKept(ctx, { mapId: 7, cells: [[cell, ver]] }, T0 + 1)).cells, [], 'held: unchanged, from memory');
  assert.equal((await homeCellsKept(ctx, { mapId: 7, cells: [[cell, 0]] }, T0 + 2)).cells[0].homes[0].owner, 'Kept', 'not held: the kept homes');
  assert.equal(sessions.length, reads, 'no read for either');
  assert.deepEqual((await homeCellsKept(ctx, { mapId: 7, cells: [[cell, ver + 3]] }, T0 + 3)).cells, [], 'an asker past the kept version keeps its own');
  forgetHomeCell(7, key);
  s.raw.prepare("UPDATE homes SET owner_name = 'Moved' WHERE map_id = 7 AND building_key = ?").run(key);
  await settleHomeCell(db, 7, key, T0);
  const again = await homeCellsKept(ctx, { mapId: 7, cells: [[cell, ver]] }, T0 + 4);
  assert.equal(sessions.at(-1).from, 'first-primary', 'the read after this isolate\'s write is the primary\'s');
  assert.deepEqual(again.cells.map((c) => c.homes[0].owner), ['Moved']);
  await homeCellsKept(ctx, { mapId: 7, cells: [[cell, 0]] }, T0 + 4 + HOMES_KEPT_S);
  assert.equal(sessions.at(-1).from, `mark-${sessions.length - 1}`, 'past HOMES_KEPT_S, read from the last read\'s bookmark');
  assert.deepEqual(await homeCellsKept(ctx, { mapId: 7, cells: [[cell, 0], [cell, 0]] }, T0), { error: 'bad-cells' });
  _resetHomeCellsKept();
});

test('YC4 a write route settles the cells it names: an arena move both of its houses\' cells, an accepted offer its house\'s off the offer, the rest the body\'s; a cell the write did not move answers nothing (mutants: the move\'s `to`, the offer looked up)', async () => {
  const s = standDb();
  const { db, raw } = s;
  const from = makeBuildingKey(1, 1, 1);
  const to = makeBuildingKey(6, 6, 1);
  s.home(7, from, {});
  await settleHomeCell(db, 7, from, T0);
  raw.prepare('UPDATE homes SET building_key = ? WHERE map_id = 7 AND building_key = ?').run(to, from);
  const moved = await settleHomeCellsAfter(db, '/v1/homes/arena-move', { mapId: 7, from, to }, T0);
  assert.deepEqual(moved.map((m) => [m.mapId, m.cell]), [[7, yardCellOf(from)], [7, yardCellOf(to)]]);
  assert.deepEqual(await settleHomeCellsAfter(db, '/v1/homes/entry', { mapId: 7, buildingKey: to }, T0), [], 'built already: nothing moved');
  raw.prepare("INSERT INTO home_offers (id, map_id, building_key, seller, seller_char, buyer, price, keep_decor, keep_items, rev, state, at, until) VALUES (?, 7, ?, 'p-other', 's', 'p-me', 5, 1, 1, 0, 'accepted', 0, 0)").run('c'.repeat(32), to);
  raw.prepare("UPDATE homes SET owner_name = 'Buyer', player = 'p-me' WHERE map_id = 7 AND building_key = ?").run(to);
  const accepted = await settleHomeCellsAfter(db, '/v1/homes/transfer', { op: 'accept', id: 'c'.repeat(32) }, T0);
  assert.deepEqual(accepted.map((m) => m.cell), [yardCellOf(to)]);
  assert.deepEqual(await settleHomeCellsAfter(db, '/v1/homes/transfer', { op: 'decline', id: 'd'.repeat(32) }, T0), [], 'a refused offer names no house');
});

test('YC4 over the real Worker: a claim answers the cell it moved, the cells route answers under a session and is refused without one, an entry changed is read at once (the kept cell let go), the own route answers the caller\'s home in full, and /v1/homes/town is as it was (mutants: the route\'s forget, the pass path)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const stranger = await svc.registered('Sven');
  const claimed = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const cell = yardCellOf(300);
  assert.deepEqual(claimed.body.homeCellsMoved?.map((m) => [m.mapId, m.cell]), [[7, cell]], 'the claim\'s cell, built');
  const ask = (cells, secret) => svc.call('/v1/homes/cells', { mapId: 7, cells }, secret);
  assert.equal((await ask([[cell, 0]])).status, 401, 'owners\' handles are account data: a session');
  assert.equal((await ask([[cell, 0], [cell, 0]], stranger.secret)).status, 400, 'a malformed ask');
  const first = await ask([[cell, 0]], stranger.secret);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.cells.map((c) => c.homes), [[{ buildingKey: 300, owner: 'Olga', entry: 'private' }]]);
  assert.equal(first.body.cells[0].ver, claimed.body.homeCellsMoved[0].ver);
  const entry = await svc.call('/v1/homes/entry', { mapId: 7, buildingKey: 300, entry: 'public' }, owner.secret);
  assert.equal(entry.status, 200, JSON.stringify(entry.body));
  assert.ok(entry.body.homeCellsMoved[0].ver > first.body.cells[0].ver, 'the entry moved the cell');
  const after = await ask([[cell, first.body.cells[0].ver]], stranger.secret);
  assert.deepEqual(after.body.cells.map((c) => c.homes[0].entry), ['public'], 'read at once, inside HOMES_KEPT_S');
  const town = await svc.call('/v1/homes/town', { mapId: 7, character: claimed.character }, owner.secret);
  const own = await svc.call('/v1/homes/own', { mapId: 7, character: claimed.character }, owner.secret);
  assert.equal(own.status, 200);
  assert.deepEqual(own.body, { mapId: 7, homes: town.body.homes, hidden: [] }, 'the owner\'s own part: its town row in full');
  assert.equal(own.body.homes[0].mine, true);
  const strangers = await svc.call('/v1/homes/town', { mapId: 7 }, stranger.secret);
  assert.deepEqual(strangers.body.homes.map((h) => without(h, 'mine')), after.body.cells[0].homes, 'the old route: the shared rows and `mine`');
  assert.deepEqual((await svc.call('/v1/homes/own', { mapId: 7 }, stranger.secret)).body, { mapId: 7, homes: [], hidden: [] });
});
