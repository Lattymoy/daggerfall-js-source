// SEAT-HALL (2026-10-02, Mac: "Please do" - the palace as the holder's guild hall): A PALACE'S CHARTER ROOM, AS THE
// SERVICE KEEPS IT - its own table (`seat_hall_decor`, migration 0065), written through DECOR's own routes with `seat`
// named, by an Officer of the guild holding the palace seat, at most a hundred pieces over the seat, DECOR's gold a
// placement; cleared whenever the seat changes hands or lapses (bible/11-Multiplayer/Seats-Arc.md 7.2;
// server-account/src/decor.js SEAT_STORE). Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). `06-Systems/Online-Arc.md` SEAT-HALL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm, layRecord } from '../realmSeat.mjs';
import { SEAT_HALL_DECOR_CAP } from '../../src/net/townSeatLaw.js';
import { REALM_EMPIRE_ACCOUNT } from '../../src/net/realm/realmGoldLaw.js';

const PALACE = { key: 3021, region: 21, buildingKey: 512 };
const piece = (over = {}) => ({ id: 'bench1', model: 41000, flat: null, pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });

/** The Silver Hand holds the palace seat at Anticlere: Gwen its guildmaster, Otto an Officer, Rhea a Recruit; Hugo
 *  guildmaster of another guild. Each a realm character. */
async function held(t, { seats = 'on', tier = 'palace' } = {}) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ SEATS_OPEN: seats });
  const raw = svc.env.DB._raw;
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  const join = async (handle, rank) => {
    const who = await svc.registered(handle);
    const R = await seatRealm(svc.env, who.secret, handle, { name: handle, level: 5, goldPieces: 50_000, items: [] });
    who.character = R.id; who.at = R.at;
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(who.id, who.character, gid, rank, handle, T0);
    return who;
  };
  const officer = await join('Otto', 1);
  const recruit = await join('Rhea', 3);
  const rival = await svc.registered('Hugo', { renown: 12 });
  assert.equal((await svc.found(rival, { name: 'The Iron Fist', tag: 'IF' })).status, 200);
  const rid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ?').get(rival.id).guild_id;
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, 1, 50, NULL, ?, 0, 0)`).run(PALACE.key, gid, PALACE.region, tier, T0);
  const at = (over = {}) => ({ mapId: PALACE.key, buildingKey: PALACE.buildingKey, seat: true, ...over });
  const place = (who, body = {}) => svc.call('/v1/homes/decor/place', { ...at(), character: who.character, realm: who.at(), piece: piece(), ...body }, who.secret);
  const list = (who, over = {}) => svc.call('/v1/homes/decor', at(over), who.secret);
  const goldOf = (who) => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj))).goldPieces;
  const treasury = () => raw.prepare('SELECT treasury FROM guilds WHERE id = ?').get(gid).treasury;
  const count = () => raw.prepare('SELECT COUNT(*) AS n FROM seat_hall_decor').get().n;
  return { svc, raw, gm, officer, recruit, rival, gid, rid, at, place, list, goldOf, treasury, count };
}

test('SEAT-HALL the Charter Room FURNISHED (7.2): an Officer of the palace\'s holder places off their own record, at DECOR\'s gold; the piece stands in the seat\'s own table, listed with `seat` named and never as a home\'s; a Recruit, another guild\'s guildmaster and a crown\'s holder furnish nothing; no keeper\'s own thing, no yard, nothing taken out of the court (mutants: SEAT_OWNS\'s tier, rank and holder; the table; the hall\'s rule; the hidden door)', async (t) => {
  const s = await held(t);
  const had = s.goldOf(s.officer);
  const p = await s.place(s.officer);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(s.goldOf(s.officer), had - 120, 'the Officer\'s own record paid DECOR\'s gold');
  assert.equal(s.count(), 1);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'never a home\'s');
  const l = await s.list(s.recruit);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.deepEqual(l.body.pieces.map((x) => x.id), ['bench1'], 'every member sees the room');
  assert.deepEqual(l.body.hidden, [], 'nothing of the court taken out');
  assert.deepEqual((await s.list(s.recruit, { seat: undefined })).body.pieces, [], 'the same building read as a home stands none of it');
  assert.equal((await s.place(s.gm, { piece: piece({ id: 'gm1' }) })).status, 200, 'the guildmaster keeps it too');
  assert.equal((await s.place(s.recruit, { piece: piece({ id: 'r1' }) })).body.error, 'no-home', 'a Recruit furnishes nothing');
  assert.equal((await s.place(s.rival, { piece: piece({ id: 'h1' }) })).body.error, 'no-home', 'another guild\'s guildmaster furnishes nothing');
  assert.equal((await s.place(s.officer, { piece: piece({ id: 'own1', model: null, flat: [204, 1], paid: 0, item: { t: 1 } }) })).body.error, 'hall-item', 'a keeper\'s own things stand in no Charter Room');
  assert.equal((await s.place(s.officer, { piece: piece({ id: 'y1' }), yard: true })).body.error, 'hall-yard');
  const hid = await s.svc.call('/v1/homes/decor/hidden', { ...s.at(), character: s.officer.character, keys: ['m:1'] }, s.officer.secret);
  assert.equal(hid.body.error, 'bad-home', 'the court stays where DFU stands it');
  // a home's own write never reaches the Charter Room
  assert.equal((await s.place(s.officer, { seat: undefined, piece: piece({ id: 'x1' }) })).body.error, 'no-home');
  // a crown's castle stands no decor
  s.raw.prepare("UPDATE town_seat_holds SET tier = 'crown'").run();
  assert.equal((await s.place(s.officer, { piece: piece({ id: 'c1' }) })).body.error, 'no-home', 'a crown\'s castle takes no decor (7.2)');
});

test('SEAT-HALL the Charter Room MOVED and TAKEN DOWN by its keepers: half of a piece taken out or shrunk goes into the holder\'s treasury, never to the keeper; a Recruit moves nothing (mutants: the seat store\'s guild; the table in move and remove)', async (t) => {
  const s = await held(t);
  assert.equal((await s.place(s.officer, { piece: piece({ paid: 200 }) })).status, 200);
  const mv = (who, place) => s.svc.call('/v1/homes/decor/move', { ...s.at(), character: who.character, realm: who.at(), id: 'bench1', place }, who.secret);
  const shape = { pos: [3, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 200 };
  assert.equal((await mv(s.recruit, shape)).body.error, 'no-decor');
  const moved = await mv(s.officer, shape);
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.deepEqual(moved.body.piece.pos, [3, 0, 2]);
  const t0 = s.treasury();
  const had = s.goldOf(s.gm);
  const shrink = await mv(s.gm, { ...shape, paid: 100 });
  assert.equal(shrink.status, 200, JSON.stringify(shrink.body));
  assert.equal(shrink.body.treasury, 50);
  assert.equal(s.treasury(), t0 + 50);
  const gone = await s.svc.call('/v1/homes/decor/remove', { ...s.at(), character: s.gm.character, realm: s.gm.at(), id: 'bench1' }, s.gm.secret);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(gone.body.treasury, 50);
  assert.equal(s.treasury(), t0 + 100, 'half of what it cost, into the holder\'s treasury');
  assert.equal(s.goldOf(s.gm), had, 'nothing to the purse of whoever took it down');
  assert.equal(s.count(), 0);
});

test('SEAT-HALL a keeper is a REALM character (AUDIT SEATS-3 F3, the Charter Room\'s copy of AUDIT GUILD1d S2): an Officer seated under a made-up id moves and places nothing; the realm Officer\'s own move still lands (mutants: SEAT_OWNS\'s realm clause)', async (t) => {
  const s = await held(t);
  assert.equal((await s.place(s.officer)).status, 200);
  const madeUp = `r${'f'.repeat(20)}`;   // a realm id's shape, no realm character's
  s.raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 1, ?, ?)').run(s.officer.id, madeUp, s.gid, 'Otto', T0);
  const shape = { pos: [5, 0, 5], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 };
  const lie = await s.svc.call('/v1/homes/decor/move', { ...s.at(), character: madeUp, id: 'bench1', place: shape }, s.officer.secret);
  assert.equal(lie.body.error, 'no-decor', 'no keeper on a client\'s word');
  assert.deepEqual(JSON.parse(s.raw.prepare('SELECT place FROM seat_hall_decor').get().place).pos, [2, 0, 2]);
  const put = await s.svc.call('/v1/homes/decor/place', { ...s.at(), character: madeUp, piece: piece({ id: 'free1', paid: 0 }) }, s.officer.secret);
  assert.equal(put.body.error, 'no-home');
  assert.equal(s.count(), 1);
  const moved = await s.svc.call('/v1/homes/decor/move', { ...s.at(), character: s.officer.character, realm: s.officer.at(), id: 'bench1', place: shape }, s.officer.secret);
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
});

test('SEAT-HALL a placement PAYS AS THE WALLET PAYS, its shortfall off the bank in the seat\'s region (AUDIT SEATS-3 F4; realmGoldLaw.js payFromSave) - the Officer\'s purse short, the Empire\'s account covers the rest (mutants: the seat\'s region unread)', async (t) => {
  const s = await held(t);
  const bankAccounts = Array.from({ length: REALM_EMPIRE_ACCOUNT + 1 }, () => ({ accountGold: 0 }));
  bankAccounts[REALM_EMPIRE_ACCOUNT].accountGold = 1000;
  layRecord(s.svc.env, s.officer.character, { level: 5, goldPieces: 50, items: [], bankAccounts });
  const p = await s.place(s.officer);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(s.goldOf(s.officer), 0, 'the purse first');
  const save = JSON.parse(new TextDecoder().decode(s.svc.env.SAVES._map.get(s.raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(s.officer.character).obj)));
  assert.equal(save.bankAccounts[REALM_EMPIRE_ACCOUNT].accountGold, 1000 - 70, 'the rest off the bank');
  assert.equal(s.count(), 1);
});

test('SEAT-HALL AT MOST A HUNDRED over the seat (7.2), whichever building the keeper\'s client named; another seat\'s pieces count for none (mutants: the cap; the cap\'s scope the building)', async (t) => {
  const s = await held(t);
  assert.equal(SEAT_HALL_DECOR_CAP, 100);
  const ins = s.raw.prepare(`INSERT INTO seat_hall_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (?, ?, ?, 41000, NULL, NULL, ?, ?, NULL, 0, 0)`);
  const place = JSON.stringify({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  for (let i = 0; i < 99; i++) ins.run(PALACE.key, i % 2 ? PALACE.buildingKey : 513, `p${i}`, place, T0);
  for (let i = 0; i < 5; i++) ins.run(4000, PALACE.buildingKey, `o${i}`, place, T0);
  assert.equal((await s.place(s.officer, { piece: piece({ id: 'last' }) })).status, 200, 'the hundredth');
  const over = await s.place(s.officer, { piece: piece({ id: 'more' }) });
  assert.equal(over.body.error, 'decor-cap', 'the hundred and first, refused - though this building holds fewer');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM seat_hall_decor WHERE map_id = ?').get(PALACE.key).n, 100);
});

test('SEAT-HALL THE ROOM FALLS WITH THE CHARTER (migration 0065): the seat taken by another guild clears its pieces, a Charter lapsed clears them, nothing given back; another seat\'s stand; a standing or tithe changed, or the holder written again, clears nothing (mutants: either trigger; its WHEN)', async (t) => {
  const s = await held(t);
  assert.equal((await s.place(s.officer)).status, 200);
  s.raw.prepare(`INSERT INTO seat_hall_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    VALUES (4000, 1, 'other', 41000, NULL, NULL, '{}', ?, NULL, 0, 0)`).run(T0);
  const t0 = s.treasury();
  s.raw.prepare('UPDATE town_seat_holds SET standing = 20, tithe = 5 WHERE key = ?').run(PALACE.key);
  s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(s.gid, PALACE.key);   // held again by its holder (a siege defended)
  assert.equal(s.count(), 2, 'a week\'s change, or the same holder, is no change of hands');
  s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(s.rid, PALACE.key);
  assert.equal(s.count(), 1, 'taken - its pieces gone');
  assert.equal(s.treasury(), t0, 'nothing given back');
  assert.equal((await s.place(s.rival, { piece: piece({ id: 'new1' }) })).status, 200, 'the new holder furnishes it afresh');
  s.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(PALACE.key);
  assert.deepEqual(s.raw.prepare('SELECT id FROM seat_hall_decor').all().map((r) => r.id), ['other'], 'lapsed - gone; another seat\'s stand');
});

test('SEAT-HALL THE SEATS\' SWITCH: with the seats shut to the account, every Charter Room door is refused, the homes\' own doors untouched (mutants: the gate; its seat test)', async (t) => {
  const s = await held(t, { seats: 'off' });
  const l = await s.list(s.officer);
  assert.equal(l.status, 403);
  assert.equal(l.body.error, 'seats-closed');
  assert.equal((await s.place(s.officer)).body.error, 'seats-closed');
  assert.equal((await s.svc.call('/v1/homes/decor/remove', { ...s.at(), character: s.officer.character, id: 'bench1' }, s.officer.secret)).body.error, 'seats-closed');
  assert.equal((await s.list(s.officer, { seat: undefined })).status, 200, 'a home\'s list as ever');
  assert.equal(s.count(), 0);
});
