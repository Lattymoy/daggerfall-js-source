// ARENA4b (2026-10-03, Mac: "Move them to a new house"): AN ONLINE HOME THE ARENA DISPLACED, MOVED BY THE ACCOUNT
// SERVICE - driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs). The rows
// in Daggerfall's cell (4,3) are laid by hand, as they stand from before the arena (no route can buy one there now - the
// claim's and the hall's guard, pinned here too). Design: bible/11-Multiplayer/Arena.md, the ARENA1 record's "ARENA4 -
// the online homes' migration"; server-account/src/homes.js arenaMoveHome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, realmAt } from './realmSeat.mjs';
import { HOME_MOVE_CARRIED } from '../server-account/src/homes.js';
import { HOME_ARENA_MAP_ID, HOME_ARENA_CELL, homeInArenaCell, RENT_ANCHOR_MOVED } from '../src/net/homeLaw.js';
import { ARENA_CELL, inArenaCell } from '../src/world/arenaCity.js';
import { CASTLE_DAGGERFALL_MAP_ID } from '../src/world/actionSystem.js';
import { guildHallOwner } from '../src/net/hallLaw.js';

const DF = HOME_ARENA_MAP_ID;
const key = (x, y, r) => (x << 16) | (y << 8) | r;
const OLD = key(4, 3, 5);          // a house of the arena's cell
const NEW = key(2, 6, 7);          // the house its owner's client picked
const LOOK = { roof: { climate: 'temperate', record: 2 } };
const T = T0;

/** A service with Aldric's realm character owning a home in the arena's cell - a party house with a painted roof, rent
 *  held on it, three pieces (a catalogue piece, a yard piece and his own thing), the furniture taken out, a room let to
 *  Bran until tomorrow, one only offered and one whose tenancy ran out. */
async function stood() {
  const S = await standService();
  const raw = S.env.DB._raw;
  const owner = await S.registered('Aldric');
  const bran = await S.registered('Bran');
  const R = await seatRealm(S.env, owner.secret, 'Aldric', { name: 'Aldric', level: 9, goldPieces: 500, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, look, layout, rent_due)
    VALUES (?, ?, ?, ?, 'Aldric', 17, 'party', 42000, ?, 42000, ?, NULL, 300)`).run(DF, OLD, owner.id, R.id, T - 9000, JSON.stringify(LOOK));
  const decor = raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (?, ?, ?, 41000, NULL, NULL, ?, ?, ?, ?, ?)`);
  decor.run(DF, OLD, 'bench1', JSON.stringify({ pos: [1, 0, 1], paid: 500 }), T, null, 500, 0);
  decor.run(DF, OLD, 'well1', JSON.stringify({ pos: [9, 0, 9], paid: 200 }), T, null, 200, 1);
  decor.run(DF, OLD, 'mine1', JSON.stringify({ pos: [2, 0, 2], paid: 90 }), T, JSON.stringify({ t: 12, g: 'UselessItems2' }), 90, 0);   // his own thing, made a station: it comes back as itself, never as gold
  raw.prepare('INSERT INTO home_hidden (map_id, building_key, keys) VALUES (?, ?, ?)').run(DF, OLD, JSON.stringify(['m1:41105']));
  const room = raw.prepare(`INSERT INTO home_rooms (map_id, building_key, room, anchor, price, listed, tenant, tenant_char, tenant_name, until) VALUES (?, ?, ?, ?, 40, ?, ?, ?, ?, ?)`);
  room.run(DF, OLD, 1, JSON.stringify([1, 0, 1]), 1, bran.id, 'char-bran', 'Bran', T + 86400);
  room.run(DF, OLD, 2, JSON.stringify([5, 0, 1]), 1, null, null, null, 0);
  room.run(DF, OLD, 3, JSON.stringify([5, 0, 5]), 1, bran.id, 'char-bran', 'Bran', T - 10);
  const move = (who, body) => S.call('/v1/homes/arena-move', { mapId: DF, from: OLD, to: NEW, character: R.id, ...body }, who.secret);
  const saveOf = () => JSON.parse(new TextDecoder().decode(S.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
  return { S, raw, owner, bran, R, move, saveOf };
}

test('ARENA4b the arena\'s cell is one law at both ends: Daggerfall\'s map id and cell (4,3) read off the raw key, pinned to the city\'s own; the rows\' columns all carried (mutants: the cell\'s y read as x; a key outside the shape admitted; a column dropped from the carry)', async () => {
  assert.equal(HOME_ARENA_MAP_ID, CASTLE_DAGGERFALL_MAP_ID, 'Daggerfall\'s map id, the city\'s own');
  assert.deepEqual([...HOME_ARENA_CELL], [...ARENA_CELL], 'the arena\'s cell, world/arenaCity.js\'s');
  for (const k of [OLD, key(4, 3, 0) || 1, key(4, 3, 255), NEW, key(3, 4, 5), key(4, 2, 5), key(5, 3, 5)]) {
    assert.equal(homeInArenaCell(DF, k), inArenaCell(k), `the service reads ${k.toString(16)} as the city reads it`);
  }
  assert.equal(homeInArenaCell(DF, key(3, 4, 1)), false, 'x and y are not interchangeable');
  assert.equal(homeInArenaCell(DF + 1, OLD), false, 'only Daggerfall');
  assert.equal(homeInArenaCell(DF, 0), false);
  assert.equal(homeInArenaCell(DF, (1 << 24) + OLD), false, 'past the key\'s shape');
  assert.equal(homeInArenaCell(DF, OLD + 2 ** 32), false, 'a key whose low bits name the cell is still out of shape');
  const S = await standService();
  const cols = S.env.DB._raw.prepare('PRAGMA table_info(homes)').all().map((c) => c.name).filter((c) => !['map_id', 'building_key', 'guild_id'].includes(c));
  assert.deepEqual([...HOME_MOVE_CARRIED].sort(), cols.sort(), 'every column of a home\'s row is carried (the key moves, the guild is set after)');
});

test('ARENA4b a home MOVED: the row whole at the new key, the old gone; the catalogue\'s and the yard\'s pieces refunded WHOLE onto the record\'s Daggerfall account in the move\'s batch; every piece, the furniture\'s list and the offered rooms gone; a running tenancy carried unlisted and pointless; once (mutants: the old row deleted before the tenancy moves; the refund halved; an item piece refunded; a column not carried; the tenancy kept listed)', async (t) => {
  t.mock.method(Date, 'now', () => T * 1000);
  const { S, raw, owner, bran, R, move, saveOf } = await stood();
  const before = raw.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').get(DF, OLD);
  const at = R.at();
  const r = await move(owner, { realm: at });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ ...r.body, realm: undefined }, { ok: true, mapId: DF, from: OLD, to: NEW, refund: 700, pieces: 2, items: 1, tenancies: 1, withdrawn: 2, hidden: true, realm: undefined });
  assert.equal(r.body.realm.seq, at.seq + 1, 'the record moved one on - a realm act');
  const after = raw.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').get(DF, NEW);
  assert.deepEqual({ ...after, building_key: OLD }, { ...before }, 'every column carried as it stood');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes WHERE map_id = ? AND building_key = ?').get(DF, OLD).n, 0, 'the old key holds nothing');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'every piece went with the old house - catalogue, yard and his own');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_hidden').get().n, 0, 'the furniture taken out is forgotten');
  const rooms = raw.prepare('SELECT * FROM home_rooms ORDER BY room').all();
  assert.equal(rooms.length, 1, 'the offered room and the run-out one withdrawn');
  assert.deepEqual([rooms[0].building_key, rooms[0].room, rooms[0].listed, rooms[0].anchor, rooms[0].tenant, rooms[0].until], [NEW, 1, 0, RENT_ANCHOR_MOVED, bran.id, T + 86400], 'the tenancy carried, unlisted, its point cleared');
  assert.equal(saveOf().bankAccounts[17].accountGold, 700, 'the pieces back WHOLE into the Daggerfall account, on the record');
  assert.equal(saveOf().goldPieces, 500, 'never the purse');
  // the tenant still walks in and the owner sees the room; the door offers it to nobody
  const town = (await S.call('/v1/homes/town', { mapId: DF, character: 'char-bran' }, bran.secret)).body.homes.find((h) => h.buildingKey === NEW);
  assert.equal(town.tenant, T + 86400, 'the tenancy opens the new door');
  assert.equal(town.rent, undefined, 'nothing offered');
  const seen = (await S.call('/v1/homes/rooms', { mapId: DF, buildingKey: NEW, character: R.id }, owner.secret)).body;
  assert.deepEqual(seen.rooms.map((x) => [x.room, x.anchor, x.moved, x.listed, x.taken, x.tenant]), [[1, null, true, false, true, 'Bran']], 'the owner sees the carried room, pointless');
  assert.equal(seen.due, 300, 'the rent held came with the row');
  // once: posted again (an answer lost), the first move answers and nothing moves
  const again = await move(owner, { realm: R.at() });
  assert.equal(again.status, 200);
  assert.deepEqual([again.body.repeat, again.body.to, again.body.refund], [true, NEW, 700]);
  assert.equal(R.at().seq, at.seq + 1, 'the record not moved again');
  assert.equal(saveOf().bankAccounts[17].accountGold, 700, 'not paid twice');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_moves').get().n, 1);
});

test('ARENA4b the move\'s refusals: outside the cell, into the cell, not Daggerfall, another\'s home, a taken house, a refund with no record, a guest - each changes nothing (mutants: the from-cell check dropped; the to-cell check dropped; the owner unasked; the taken house unasked; the refund taken with no record)', async (t) => {
  t.mock.method(Date, 'now', () => T * 1000);
  const { S, raw, owner, bran, R, move } = await stood();
  const snap = () => JSON.stringify([raw.prepare('SELECT * FROM homes ORDER BY building_key').all(), raw.prepare('SELECT * FROM home_decor ORDER BY id').all(), raw.prepare('SELECT * FROM home_rooms ORDER BY room').all(), R.at()]);
  const was = snap();
  const no = async (who, body, error, status) => { const r = await move(who, body); assert.equal(r.body?.error, error, JSON.stringify(r.body)); assert.equal(r.status, status, error); };
  await no(owner, { from: NEW, realm: R.at() }, 'home-unmoved', 400);
  await no(owner, { to: key(4, 3, 9), realm: R.at() }, 'home-arena', 400);
  await no(owner, { to: OLD, realm: R.at() }, 'home-arena', 400);
  await no(owner, { mapId: DF + 1, realm: R.at() }, 'home-unmoved', 400);
  const B = await seatRealm(S.env, bran.secret, 'Bran', { name: 'Bran', level: 3, goldPieces: 50, items: [] });
  await no(bran, { character: B.id, realm: B.at() }, 'no-home', 404);
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, 'Bran', 17, 'private', 9000, ?)`).run(DF, NEW, bran.id, B.id, T);
  await no(owner, { realm: R.at() }, 'home-taken', 409);
  raw.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ?').run(DF, NEW);
  await no(owner, {}, 'realm-needed', 400);
  const g = await S.guest();
  const gr = await S.call('/v1/homes/arena-move', { mapId: DF, from: OLD, to: NEW, character: R.id }, g.secret);
  assert.deepEqual([gr.status, gr.body.error], [403, 'homes-need-account']);
  assert.equal(snap(), was, 'nothing moved, nothing paid');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_moves').get().n, 0);
});

test('ARENA4b the room as it was read, or nothing: a piece placed between the read and the batch sends the move back whole - the record unpaid, the row where it was (mutants: the decor guard dropped from the delete)', async (t) => {
  t.mock.method(Date, 'now', () => T * 1000);
  const { S, raw, owner, R, move, saveOf } = await stood();
  const db = S.env.DB;
  const batch = db.batch.bind(db);
  let once = true;
  db.batch = async (list) => {
    if (once && list.length > 6) {
      once = false;   // the move's own batch: a placement lands first, as a second tab's would
      raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, 'late1', 41000, ?, ?, 80, 0)`).run(DF, OLD, JSON.stringify({ pos: [3, 0, 3], paid: 80 }), T);
    }
    return batch(list);
  };
  const at = R.at();
  const r = await move(owner, { realm: at });
  assert.deepEqual([r.status, r.body.error], [409, 'home-changed']);
  assert.equal(R.at().seq, at.seq, 'the record did not move');
  assert.equal(saveOf().bankAccounts[17].accountGold, 0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes WHERE map_id = ? AND building_key = ?').get(DF, OLD).n, 1, 'the house where it stood');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_moves').get().n, 0, 'no move kept');
  db.batch = batch;
  const ok = await move(owner, { realm: R.at() });
  assert.equal(ok.status, 200, 'posted again, it moves - the late piece paid back with the rest');
  assert.equal(ok.body.refund, 780, 'and his own thing never as gold');
});

test('ARENA4b a guild\'s HALL moved by its keeper: no record named, the pieces\' gold back into the treasury (what records paid in) with the ledger\'s line, the guild set on the new row after the old goes (mutants: the guild carried in the insert - the one-hall index; the hall\'s refund onto a record)', async (t) => {
  t.mock.method(Date, 'now', () => T * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const gm = await S.registered('Gwen', { renown: 12 });
  assert.equal((await S.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT id FROM guilds').get().id;
  raw.prepare("UPDATE guilds SET treasury = 1000, realm_gold = 1000, moved_by = 'x', moved_at = 1").run();
  raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, guild_id)
    VALUES (?, ?, ?, ?, 'The Silver Hand', 17, 'guild', 20000, ?, 30000, ?)`).run(DF, OLD, gm.id, guildHallOwner(gid), T - 50, gid);
  raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, 'banner1', 41000, '{}', ?, 450, 0)`).run(DF, OLD, T);
  const r = await S.call('/v1/homes/arena-move', { mapId: DF, from: OLD, to: NEW, character: gm.character }, gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.hall, r.body.refund, r.body.realm], [true, 450, undefined], 'a hall\'s move names no record');
  const row = raw.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').get(DF, NEW);
  assert.deepEqual([row.guild_id, row.char_id, row.paid], [gid, guildHallOwner(gid), 30000], 'the hall, its mark and what it cost, at the new key');
  const g = raw.prepare('SELECT treasury, realm_gold FROM guilds WHERE id = ?').get(gid);
  assert.deepEqual([g.treasury, g.realm_gold], [1450, 1450], 'the pieces\' gold back where it came from');
  assert.equal(raw.prepare('SELECT kind FROM guild_ledger WHERE guild_id = ? ORDER BY seq DESC LIMIT 1').get(gid).kind, 'hall-piece', 'the ledger says why');
  assert.equal(raw.prepare('SELECT hall FROM home_moves').get().hall, 1);
  const guide = (await S.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild;
  assert.equal(guide.hall.buildingKey, NEW, 'the guild\'s own view names the new hall');
});

test('ARENA4b old builds guarded: no claim and no hall bought in the arena\'s cell - `home-arena`, with its words; a key outside it is bought as before (mutants: the claim\'s guard dropped; the hall\'s guard dropped)', async (t) => {
  t.mock.method(Date, 'now', () => T * 1000);
  const S = await standService();
  const who = await S.registered('Cyr');
  const r = await S.seatHome(who, { mapId: DF, buildingKey: key(4, 3, 2), region: 17, price: 30000 });
  assert.deepEqual([r.status, r.body.error], [409, 'home-arena']);
  const fine = await S.seatHome(who, { mapId: DF, buildingKey: key(4, 4, 2), region: 17, price: 30000 });
  assert.equal(fine.status, 200, 'the market\'s cell, beside it, is bought as ever');
  const gm = await S.registered('Gwen', { renown: 12 });
  assert.equal((await S.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  S.env.DB._raw.prepare("UPDATE guilds SET treasury = 90000, realm_gold = 90000, moved_by = 'x', moved_at = 1").run();
  const h = await S.call('/v1/guilds/hall/buy', { character: gm.character, mapId: DF, buildingKey: key(4, 3, 7), region: 17, price: 20000 }, gm.secret);
  assert.deepEqual([h.status, h.body.error], [409, 'home-arena']);
  const { REFUSALS } = await import('../src/net/accountClient.js');
  const { ARENA_TEXT } = await import('../src/systems/arenaText.js');
  assert.equal(REFUSALS['home-arena'], ARENA_TEXT.homeMove.arena, 'the refusal in the arena\'s own words');
  for (const w of ['home-unmoved', 'home-changed']) assert.ok(REFUSALS[w], `${w} said`);
});

test('ARENA4b the unread moves: listed for the character that moved them, the refund told and never owed again; read once (mutants: another character\'s listed; seen_at never set; a read move listed again)', async (t) => {
  t.mock.method(Date, 'now', () => T * 1000);
  const { S, owner, bran, R, move } = await stood();
  assert.equal((await move(owner, { realm: R.at() })).status, 200);
  const list = (who, character) => S.call('/v1/homes/arena-moves', { character }, who.secret);
  assert.deepEqual((await list(owner, R.id)).body.moves, [{ mapId: DF, from: OLD, to: NEW, refund: 700, movedAt: T }]);
  assert.deepEqual((await list(owner, 'char-other')).body.moves, [], 'another character\'s save holds no old scene of it');
  assert.deepEqual((await list(bran, R.id)).body.moves, [], 'another account\'s');
  assert.deepEqual((await S.call('/v1/homes/arena-seen', { mapId: DF, from: OLD }, bran.secret)).body, { ok: true, seen: false }, 'not Bran\'s to read');
  assert.deepEqual((await S.call('/v1/homes/arena-seen', { mapId: DF, from: OLD }, owner.secret)).body, { ok: true, seen: true });
  assert.deepEqual((await S.call('/v1/homes/arena-seen', { mapId: DF, from: OLD }, owner.secret)).body, { ok: true, seen: false }, 'once');
  assert.deepEqual((await list(owner, R.id)).body.moves, [], 'read, not listed again');
  assert.equal(realmAt(S.env, R.id).seq, R.at().seq);
});
