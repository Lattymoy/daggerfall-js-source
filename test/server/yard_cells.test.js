// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md YC1) - A TOWN'S YARDS KEPT AND READ ONE BLOCK AT A TIME.
// Over the real Worker and the real migrations: a town has no cap of its own (a yard still has its 60), a write rebuilds
// its own cell and no other, a cascade leaves its cell stale for the clock, a reader is answered only the cells that
// moved past the versions it holds, nearest first within the answer's budget, and the whole town's old route is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1, standService, T0 } from '../accountDb.mjs';
import {
  settleYardCell, settleStaleYardCells, readYardCells, yardCellRowsOf, yardCellsKept, forgetYardCell, _resetYardCellsKept, _yardCellsKeptState,
  YARD_CELL_SHAPE, YARD_CELLS_ANSWER_BYTES, YARD_CELLS_FROM, YARDS_KEPT_S,
} from '../../server-account/src/yardCells.js';
import { yardCellOf, yardCellAskOf, YARD_CELLS_ASK_MAX } from '../../src/net/yardCellLaw.js';
import { DECOR_YARD_CAP } from '../../src/net/decorLaw.js';
import { HOME_TOWN_MAX } from '../../src/net/homeLaw.js';
import { KEPT_BOARD_MAX_BYTES } from '../../server-account/src/keptBoard.js';
import { BUILDING_KEY_0, makeBuildingKey } from '../../src/systems/talk/talkTopics.js';

const PLACE = JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });

/** A database with an owner and the yard rows a test lays down - triggers and all, as the migrations made them. */
function standDb() {
  const db = d1();
  const raw = db._raw;
  raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 0, 0)').run('p-owner', 'owner');
  const home = raw.prepare("INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (?, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)");
  const put = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, ?, 0, 1)');
  const lay = (mapId, buildingKey, ids, at = T0) => {
    home.run(mapId, buildingKey);
    for (const id of ids) put.run(mapId, buildingKey, id, PLACE, at);
  };
  const ver = (mapId, cell) => { const got = raw.prepare('SELECT ver, built FROM home_yard_cell_ver WHERE map_id = ? AND cell = ?').get(mapId, cell); return got ? { ...got } : null; };
  const row = (mapId, cell) => { const got = raw.prepare('SELECT built, shape, rows FROM home_yard_cells WHERE map_id = ? AND cell = ?').get(mapId, cell); return got ? { ...got } : null; };
  return { db, raw, lay, ver, row };
}
const ids = (answer) => answer.yards.flatMap((y) => y.pieces.map((p) => p.id)).sort();

test('YARD-CELL the cell is the block: a building key\'s high bytes, BUILDING_KEY_0 a cell of its own, a request a town\'s cells at most (mutants: the shift, the bound)', () => {
  assert.equal(yardCellOf(makeBuildingKey(3, 5, 17)), (3 << 8) + 5);
  assert.equal(yardCellOf(makeBuildingKey(3, 5, 0)), yardCellOf(makeBuildingKey(3, 5, 255)), 'every record of a block, one cell');
  assert.notEqual(yardCellOf(makeBuildingKey(3, 5, 0)), yardCellOf(makeBuildingKey(3, 6, 0)), 'the next block, another');
  assert.equal(yardCellOf(BUILDING_KEY_0), 65536, 'block 0,0 record 0 is kept as 1 << 24 - a cell of its own');
  assert.equal(YARD_CELLS_ASK_MAX, 65, 'a town\'s 64 blocks and that one key');
  const cells = Array.from({ length: YARD_CELLS_ASK_MAX }, (_, i) => [i, 0]);
  assert.ok(yardCellAskOf({ mapId: 7, cells }), 'a whole town asked at once');
  assert.equal(yardCellAskOf({ mapId: 7, cells: [...cells, [999, 0]] }), null, 'a town and one more refused');
  assert.equal(yardCellAskOf({ mapId: 7, cells: [[1, 0], [1, 0]] }), null, 'a cell twice refused');
  assert.equal(yardCellAskOf({ mapId: 7, cells: [[65537, 0]] }), null, 'past BUILDING_KEY_0\'s cell refused');
  assert.equal(yardCellAskOf({ mapId: 7, cells: [[1, -1]] }), null, 'a version below 0 refused');
  assert.equal(yardCellAskOf({ mapId: 0, cells: [[1, 0]] }), null, 'no town');
  assert.equal(HOME_TOWN_MAX, 64 * 32, 'a town\'s homes answer lists every building a town of Daggerfall\'s blocks can hold');
});

test('YARD-CELL migration 0190 keeps every cell in the shape the code reads, and its triggers move a cell\'s version on every yard row written - both cells when a row moves between them (mutants: the trigger\'s shift, the moved trigger\'s OLD arm)', async () => {
  const migration = readFileSync(new URL('../../server-account/migrations/0190_yard_cell.sql', import.meta.url), 'utf8');
  assert.ok(migration.includes(`'${YARD_CELL_SHAPE}'`), 'the backfill writes the code\'s own shape');
  const { db, raw, lay, ver, row } = standDb();
  const a = makeBuildingKey(1, 2, 3);
  const b = makeBuildingKey(5, 5, 1);
  lay(7, a, ['a1', 'a2']);
  assert.deepEqual(ver(7, yardCellOf(a)), { ver: 2, built: 0 }, 'two pieces placed: a version of 2, never built');
  await settleYardCell(db, 7, a);
  assert.deepEqual(ver(7, yardCellOf(a)), { ver: 2, built: 2 }, 'built at its version');
  assert.equal(row(7, yardCellOf(a)).shape, YARD_CELL_SHAPE);
  assert.deepEqual(yardCellRowsOf(row(7, yardCellOf(a)).rows).map((r) => r.id), ['a1', 'a2']);
  // a home's rows carried to another key in another block (homes.js arenaMoveHome) - both cells move
  raw.prepare('INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (7, ?, ?, ?, ?, 17, 1, 1)').run(b, 'p-owner', 'c', 'Owner');
  raw.prepare("UPDATE home_decor SET building_key = ? WHERE map_id = 7 AND id = 'a1'").run(b);
  assert.ok(ver(7, yardCellOf(a)).ver > 2, 'the cell it left moved');
  assert.ok(ver(7, yardCellOf(b)), 'the cell it reached has a version');
  // a room's piece moves no cell
  const before = ver(7, yardCellOf(a)).ver;
  raw.prepare("INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, ?, 'room', 41000, ?, ?, 0, 0)").run(a, PLACE, T0);
  assert.equal(ver(7, yardCellOf(a)).ver, before, 'a room\'s piece is no yard\'s');
  // a version row lost and made again starts past the row kept (AUDIT LEAN-READS 2 B4)
  await settleYardCell(db, 7, a);
  const kept = row(7, yardCellOf(a)).built;
  raw.prepare('DELETE FROM home_yard_cell_ver WHERE map_id = 7 AND cell = ?').run(yardCellOf(a));
  lay(7, a, ['a3']);
  assert.ok(ver(7, yardCellOf(a)).ver > kept, 'counted again past the kept row, never meeting it');
});

test('YARD-CELL migration 0190\'s backfill: every cell standing yard pieces when it is applied is built at a version it holds, in the shape the code reads, its rows the code\'s own build of them (mutants: the backfill\'s range, its order)', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const dir = new URL('../../server-account/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files.filter((f) => f < '0190')) raw.exec(readFileSync(new URL(f, dir), 'utf8'));
  raw.prepare('INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, ?, 0, 0)').run('p-owner', 'owner');
  const keys = [makeBuildingKey(0, 0, 3), makeBuildingKey(0, 0, 9), makeBuildingKey(2, 7, 1), BUILDING_KEY_0];
  for (const bk of keys) {
    raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (7, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)").run(bk);
    for (const [i, at] of [[2, T0 + 5], [1, T0]]) raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, ?, ?, 41000, ?, ?, 0, 1)').run(bk, `${bk}-${i}`, PLACE, at);
  }
  raw.exec(readFileSync(new URL(files.find((f) => f.startsWith('0190')), dir), 'utf8'));
  const backfilled = raw.prepare('SELECT cell, built, shape, rows FROM home_yard_cells WHERE map_id = 7 ORDER BY cell').all().map((r) => ({ ...r }));
  assert.deepEqual(backfilled.map((r) => r.cell), [...new Set(keys.map(yardCellOf))].sort((a, b) => a - b), 'one row a cell standing a yard');
  for (const r of backfilled) assert.equal(r.shape, YARD_CELL_SHAPE);
  const vers = raw.prepare('SELECT COUNT(*) AS n FROM home_yard_cell_ver WHERE map_id = 7 AND ver = built').get().n;
  assert.equal(vers, backfilled.length, 'each built at its version, none stale');
  // the code's own build of the same rows, cell for cell
  const { db, raw: fresh } = standDb();
  for (const bk of keys) {
    fresh.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (7, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)").run(bk);
    for (const [i, at] of [[2, T0 + 5], [1, T0]]) fresh.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, ?, ?, 41000, ?, ?, 0, 1)').run(bk, `${bk}-${i}`, PLACE, at);
  }
  for (const bk of keys) await settleYardCell(db, 7, bk);
  const built = fresh.prepare('SELECT cell, rows FROM home_yard_cells WHERE map_id = 7 ORDER BY cell').all().map((r) => ({ ...r }));
  assert.deepEqual(backfilled.map((r) => ({ cell: r.cell, rows: r.rows })), built);
});

test('YARD-CELL the oracle: through yard and room pieces placed, moved within and between towns and cells, in and out of a yard, taken away and their homes released, every cell\'s answer off its built row is its answer off its rows, its version moves exactly when a yard row of it is written, and the old town version still moves with it - the rollback\'s net (mutants: a delete unmoved, a move between cells moving one, a room piece moving its cell, the build\'s order)', async () => {
  const TOWNS = [7, 8];
  const KEYS = [makeBuildingKey(1, 1, 1), makeBuildingKey(1, 1, 2), makeBuildingKey(3, 4, 1)];
  const CELLS = [...new Set(KEYS.map(yardCellOf))];
  const lcg = (seed) => { let x = seed % 2147483647 || 1; return () => (x = (x * 48271) % 2147483647) / 2147483647; };
  const placeAt = (x) => JSON.stringify({ pos: [x, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  for (let seed = 1; seed <= 20; seed++) {
    const { db, raw } = standDb();
    const home = raw.prepare("INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (?, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)");
    for (const t of TOWNS) for (const k of KEYS) home.run(t, k);
    const put = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, ?, 0, ?)');
    const r = lcg(seed * 104729);
    const cellVers = () => TOWNS.flatMap((t) => CELLS.map((c) => raw.prepare('SELECT ver FROM home_yard_cell_ver WHERE map_id = ? AND cell = ?').get(t, c)?.ver ?? 0));
    const townVers = () => TOWNS.map((t) => raw.prepare('SELECT ver FROM home_yards_ver WHERE map_id = ?').get(t)?.ver ?? 0);
    let ids = 0;
    for (let op = 0; op < 60; op++) {
      const x = r();
      const t = TOWNS[Math.floor(r() * TOWNS.length)];
      const k = KEYS[Math.floor(r() * KEYS.length)];
      const before = cellVers();
      const townsBefore = townVers();
      /** @type {string[]} the cells the op moves, `town:cell` */
      let moves = [];
      if (x < 0.45) {
        const yard = r() < 0.7 ? 1 : 0;
        put.run(t, k, `p${ids++}`, placeAt(Math.floor(r() * 8)), 1 + Math.floor(r() * 5), yard);
        if (yard) moves = [`${t}:${yardCellOf(k)}`];
      } else if (x < 0.75) {
        const row = raw.prepare('SELECT map_id, building_key, id, yard FROM home_decor ORDER BY id LIMIT 1 OFFSET ?').get(Math.floor(r() * 10));
        if (row) {
          const to = r() < 0.5 ? row.map_id : t;
          const yard = r() < 0.5 ? row.yard : 1 - row.yard;
          raw.prepare('UPDATE home_decor SET map_id = ?, building_key = ?, yard = ?, placed_at = placed_at + 1 WHERE map_id = ? AND building_key = ? AND id = ?')
            .run(to, k, yard, row.map_id, row.building_key, row.id);
          moves = [...(row.yard ? [`${row.map_id}:${yardCellOf(row.building_key)}`] : []), ...(yard ? [`${to}:${yardCellOf(k)}`] : [])];
        }
      } else if (x < 0.92) {
        const row = raw.prepare('SELECT map_id, building_key, id, yard FROM home_decor ORDER BY id LIMIT 1 OFFSET ?').get(Math.floor(r() * 10));
        if (row) {
          raw.prepare('DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').run(row.map_id, row.building_key, row.id);
          if (row.yard) moves = [`${row.map_id}:${yardCellOf(row.building_key)}`];
        }
      } else {
        const had = raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = 1').get(t, k).n;
        raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(t, k);   // the cascade takes its pieces
        home.run(t, k);
        if (had) moves = [`${t}:${yardCellOf(k)}`];
      }
      const after = cellVers();
      TOWNS.flatMap((t2) => CELLS.map((c) => `${t2}:${c}`)).forEach((key, i) => assert.equal(after[i] !== before[i], moves.includes(key), `seed ${seed} op ${op}: cell ${key} moved ${after[i] - before[i]}`));
      const townsAfter = townVers();
      TOWNS.forEach((t2, i) => assert.equal(townsAfter[i] !== townsBefore[i], moves.some((key) => key.startsWith(`${t2}:`)), `seed ${seed} op ${op}: town ${t2}'s old version - the rollback's net`));
      // half the time the routes' builds, half the time the rows read as they stand
      if (r() < 0.5) for (const t2 of TOWNS) for (const k2 of KEYS) await settleYardCell(db, t2, k2);
      for (const t2 of TOWNS) {
        const asked = CELLS.map((c) => [c, 0]);
        const built = await readYardCells(db, t2, asked);
        raw.prepare('UPDATE home_yard_cells SET built = -1 WHERE map_id = ?').run(t2);
        const standing = await readYardCells(db, t2, asked);
        raw.prepare('UPDATE home_yard_cells SET built = (SELECT v.ver FROM home_yard_cell_ver v WHERE v.map_id = home_yard_cells.map_id AND v.cell = home_yard_cells.cell) WHERE map_id = ? AND built = -1 AND EXISTS (SELECT 1 FROM home_yard_cell_ver v WHERE v.map_id = home_yard_cells.map_id AND v.cell = home_yard_cells.cell AND v.built = v.ver)').run(t2);
        assert.deepEqual(built.cells.map((c) => c.yards), standing.cells.map((c) => c.yards), `seed ${seed} op ${op}: town ${t2}`);
      }
    }
  }
});

test('YARD-CELL a write rebuilds its own cell and leaves every other cell\'s row as it stood; the clock builds what a cascade left stale, off the stale index (mutants: the settle\'s cell, the mark)', async () => {
  const { db, raw, lay, ver, row } = standDb();
  const a = makeBuildingKey(1, 1, 1);
  const b = makeBuildingKey(6, 6, 1);
  lay(7, a, ['a1']);
  lay(7, b, ['b1']);
  await settleYardCell(db, 7, a);
  await settleYardCell(db, 7, b);
  const bRow = row(7, yardCellOf(b));
  lay(7, a, ['a2']);
  await settleYardCell(db, 7, a);
  assert.deepEqual(yardCellRowsOf(row(7, yardCellOf(a)).rows).map((r) => r.id), ['a1', 'a2'], 'its own cell built again');
  assert.deepEqual(row(7, yardCellOf(b)), bRow, 'the other cell untouched');
  // a cascade (no decor route) - the cell stale until the clock
  raw.prepare("DELETE FROM home_decor WHERE map_id = 7 AND id = 'b1'").run();
  const stale = ver(7, yardCellOf(b));
  assert.notEqual(stale.ver, stale.built, 'stale');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_yard_cell_ver INDEXED BY idx_home_yard_cell_stale WHERE ver <> built').get().n, 1, 'one stale cell, on the index');
  assert.equal(await settleStaleYardCells(db), 1);
  assert.deepEqual(yardCellRowsOf(row(7, yardCellOf(b)).rows), [], 'built empty');
  assert.equal(ver(7, yardCellOf(b)).built, ver(7, yardCellOf(b)).ver, 'and marked');
  assert.equal(await settleStaleYardCells(db), 0, 'nothing left');
});

test('YARD-CELL a cell at the law\'s widest - 32 buildings of 60 pieces, every row as wide as the yard\'s law allows - is kept in its built row, under KEPT_BOARD_MAX_BYTES (mutant: the kept bound)', async () => {
  const { db, raw, row } = standDb();
  const wide = JSON.stringify({ pos: [-47.125, 3.875, -47.125], rot: [-179.9, -89.9, -179.9], scale: 3.875, light: null, storage: false, paid: 400 });
  const home = raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) VALUES (7, ?, 'p-owner', 'c', 'Owner', 17, 1, 1)");
  const put = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, ?, ?, 999999, ?, 1792926824, 400, 1)');
  for (let record = 0; record < 32; record++) {
    const bk = makeBuildingKey(7, 7, 200 + record);
    home.run(bk);
    for (let i = 0; i < DECOR_YARD_CAP; i++) put.run(bk, `${record}-${i}`.padStart(24, 'w'), wide);
  }
  await settleYardCell(db, 7, makeBuildingKey(7, 7, 200));
  const built = row(7, yardCellOf(makeBuildingKey(7, 7, 200)));
  assert.notEqual(built.rows, null, 'kept');
  assert.equal(yardCellRowsOf(built.rows).length, 32 * DECOR_YARD_CAP);
  assert.ok(Buffer.byteLength(built.rows) < KEPT_BOARD_MAX_BYTES / 2, `${Buffer.byteLength(built.rows)} bytes`);
});

test('YARD-CELL a reader is answered only the cells that moved past the versions it holds, in its order, within the answer\'s budget; a version older than it holds is no change (mutants: the version compare, the budget)', async () => {
  const { db, lay } = standDb();
  const near = makeBuildingKey(4, 4, 1);
  const far = makeBuildingKey(0, 7, 1);
  lay(7, near, ['n1', 'n2']);
  lay(7, far, ['f1']);
  await settleYardCell(db, 7, near);
  const first = await readYardCells(db, 7, [[yardCellOf(near), 0], [yardCellOf(far), 0], [yardCellOf(makeBuildingKey(2, 2, 2)), 0]]);
  assert.deepEqual(first.cells.map((c) => c.cell), [yardCellOf(near), yardCellOf(far)], 'the asker\'s order; a cell with no yard is no change');
  assert.deepEqual(ids(first.cells[0]), ['n1', 'n2'], 'off its built row');
  assert.deepEqual(ids(first.cells[1]), ['f1'], 'a cell never built read as its rows stand');
  const held = first.cells.map((c) => [c.cell, c.ver]);
  assert.deepEqual((await readYardCells(db, 7, held)).cells, [], 'nothing moved: nothing sent');
  assert.deepEqual((await readYardCells(db, 7, held.map(([c, v]) => [c, v + 5]))).cells, [], 'a version held past the read\'s is no change');
  lay(7, far, ['f2']);
  const after = await readYardCells(db, 7, held);
  assert.deepEqual(after.cells.map((c) => c.cell), [yardCellOf(far)], 'only the cell that moved');
  // the budget: the first cell always whole, the rest left for the next request
  const tight = await readYardCells(db, 7, [[yardCellOf(near), 0], [yardCellOf(far), 0]], 1);
  assert.deepEqual(tight.cells.map((c) => c.cell), [yardCellOf(near)]);
  assert.deepEqual(tight.more, [yardCellOf(far)]);
  assert.ok(YARD_CELLS_ANSWER_BYTES >= 415_000, 'a whole cell at the widest fits one answer');
});

test('YARD-CELL a map id in a past-the-Bay lane and the BUILDING_KEY_0 cell are kept and served like any other (#1184: a country place\'s id carries 0x80000)', async () => {
  const { db, lay } = standDb();
  const country = ((0x301 << 20) | 0x80000 | 1234) >>> 0;
  lay(country, BUILDING_KEY_0, ['zero']);
  await settleYardCell(db, country, BUILDING_KEY_0);
  const read = await readYardCells(db, country, [[yardCellOf(BUILDING_KEY_0), 0]]);
  assert.deepEqual(read.cells.map(ids), [['zero']]);
});

test('YARD-CELL over the real Worker: a town past YARD-TOWN\'s 6,500 takes the next piece, a yard\'s 61st is still `yard-cap`, the route answers the cells, and the whole town\'s old route is refused `client-update` (mutants: the cap gone, the 410)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), ...body }, owner.secret);
  const copyHome = raw.prepare('INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at) SELECT ?, ?, player, char_id, owner_name, region, price, bought_at FROM homes WHERE map_id = 7 AND building_key = 300');
  const fill = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, ?, ?, 41000, ?, ?, 0, 1)');
  // 110 neighbours of 60 pieces: 6,600 in the town, past YARD-TOWN's bound
  for (let n = 0; n < 110; n++) {
    const bk = makeBuildingKey(1 + (n % 7), 1 + Math.floor(n / 16), 1 + (n % 16));
    copyHome.run(7, bk);
    for (let i = 0; i < DECOR_YARD_CAP; i++) fill.run(bk, `n${n}-${i}`, PLACE, T0);
  }
  const next = await place({ piece: piece({ id: 'next' }), yard: true });
  assert.equal(next.status, 200, `the town past 6,500 takes it: ${JSON.stringify(next.body)}`);
  for (let i = 1; i < DECOR_YARD_CAP; i++) fill.run(300, `own${i}`, PLACE, T0);
  const sixtyFirst = await place({ piece: piece({ id: 'over' }), yard: true });
  assert.equal(sixtyFirst.body.error, 'yard-cap', 'the yard\'s own cap stands');
  const cell = yardCellOf(300);
  const cells = await svc.call('/v1/homes/yards/cells', { mapId: 7, cells: [[cell, 0]] });
  assert.equal(cells.status, 200);
  assert.equal(cells.body.cells[0].cell, cell);
  assert.ok(ids(cells.body.cells[0]).includes('next'), 'the piece placed is served');
  assert.equal((await svc.call('/v1/homes/yards/cells', { mapId: 7, cells: [[cell, 0], [cell, 0]] })).status, 400, 'a malformed ask');
  const old = await svc.call('/v1/homes/yards', { mapId: 7 });
  assert.equal(old.status, 410);
  assert.equal(old.body.error, 'client-update');
});

test('YARD-CELL YARD-SHED\'s laws a cell at a time, over the real Worker: the cells are answered with no session, a second ask within YARDS_KEPT_S costs the database nothing, two asks at one moment share one read, a decor route\'s write is read at once, and an address past its window is told to wait (mutants: the kept answer, the shared read, the route\'s forget)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const base = svc.env.DB;
  const c = { n: 0 };
  const counted = Object.create(base);
  counted.prepare = (sql) => {
    const inner = base.prepare(sql);
    const api = {
      bind: (...a) => { inner.bind(...a); return api; },
      first: (...a) => { c.n++; return inner.first(...a); },
      all: (...a) => { c.n++; return inner.all(...a); },
      run: (...a) => { c.n++; return inner.run(...a); },
      _result: () => inner._result(),
    };
    return api;
  };
  counted.batch = (list) => { c.n++; return base.batch(list); };
  svc.env.DB = counted;
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const cell = yardCellOf(300);
  const ask = (cells, secret) => svc.call('/v1/homes/yards/cells', { mapId: 7, cells }, secret);
  c.n = 0;
  const first = await ask([[cell, 0]]);
  assert.equal(first.status, 200, 'no secret, no session: answered');
  assert.deepEqual(first.body, { mapId: 7, cells: [], more: [] }, 'a cell that never stood a yard: no change');
  assert.equal(c.n, 1, 'one read - the cells, no session or player row');
  assert.deepEqual((await ask([[cell, 0]], 'not-a-secret')).body.cells, [], 'a secret that opens nothing changes nothing');
  assert.equal(c.n, 1, 'the second ask: the kept cell');
  c.n = 0;
  const both = await Promise.all([ask([[cell + 1, 0]]), ask([[cell + 1, 0]])]);
  assert.ok(both.every((r) => r.status === 200));
  assert.equal(c.n, 1, 'two at one moment: one read');
  // the owner places a piece: the next ask, inside YARDS_KEPT_S, sees it
  const at = () => ({ id: o.character, ...raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const placed = await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), yard: true, piece: piece({ id: 'fresh' }) }, owner.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const after = await ask([[cell, 0]]);
  assert.deepEqual(after.body.cells.map(ids), [['fresh']], 'the write let the kept cell go');
  _resetYardCellsKept();
  let limited = null;
  for (let i = 0; i < 2 * 240 + 10 && limited == null; i++) {   // two windows' worth (ACCOUNT_MAX), should the clock turn one mid-loop
    const r = await svc.call('/v1/homes/yards/cells', { mapId: 11, cells: [[1, 0]] });
    if (r.status === 429) limited = i;
  }
  assert.ok(limited != null, 'the address told to wait once its window\'s asks are spent');
});

test('YARD-CELL an isolate keeps cells by bytes: an asker holding a cell\'s version is answered from memory, a write here sends the next read to the primary and keeps no read in flight (mutants: the kept compare, the written mark)', async () => {
  _resetYardCellsKept();
  const { db, lay } = standDb();
  const bk = makeBuildingKey(2, 3, 4);
  lay(7, bk, ['k1']);
  await settleYardCell(db, 7, bk);
  const sessions = [];
  const counted = { ...db, prepare: (sql) => { sessions.at(-1).reads++; return db.prepare(sql); } };
  const ctx = { db: { ...counted, withSession: (from) => { sessions.push({ from, reads: 0 }); return { ...counted, getBookmark: () => `mark-${sessions.length}` }; } } };
  const cell = yardCellOf(bk);
  const first = await yardCellsKept(ctx, { mapId: 7, cells: [[cell, 0]] }, T0);
  assert.deepEqual(first.cells.map(ids), [['k1']]);
  assert.equal(sessions.at(-1).from, YARD_CELLS_FROM, 'the first read any instance\'s');
  const ver = first.cells[0].ver;
  const reads = sessions.length;
  assert.deepEqual((await yardCellsKept(ctx, { mapId: 7, cells: [[cell, ver]] }, T0 + 1)).cells, [], 'held: unchanged, from memory');
  assert.deepEqual((await yardCellsKept(ctx, { mapId: 7, cells: [[cell, 0]] }, T0 + 2)).cells.map(ids), [['k1']], 'not held: the kept yards');
  assert.equal(sessions.length, reads, 'no read for either');
  forgetYardCell(7, bk);
  lay(7, bk, ['k2']);
  await settleYardCell(db, 7, bk);
  const again = await yardCellsKept(ctx, { mapId: 7, cells: [[cell, ver]] }, T0 + 3);
  assert.equal(sessions.at(-1).from, 'first-primary', 'the read after this isolate\'s write is the primary\'s');
  assert.deepEqual(again.cells.map(ids), [['k1', 'k2']]);
  const later = await yardCellsKept(ctx, { mapId: 7, cells: [[cell, 0]] }, T0 + 3 + YARDS_KEPT_S);
  assert.equal(sessions.at(-1).from, 'mark-' + (sessions.length - 1), 'past YARDS_KEPT_S, read from the bookmark the last read ended at');
  assert.deepEqual(later.cells.map(ids), [['k1', 'k2']]);
  assert.ok(_yardCellsKeptState().bytes > 0);
  _resetYardCellsKept();
});
