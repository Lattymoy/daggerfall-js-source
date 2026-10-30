// GUILD-SHOP (2026-10-30, the owner: "New guild furniture pieces. A guild bank vendor, unique guild furniture pieces and
// anything else applicable"; bible/11-Multiplayer/Guild-Shop.md) - THE GUILD'S OWN HALL PIECES: seven models of the
// port's own under the guild art's archive, offered in a guild's hall alone at no gold; the service stands one only in its
// guild's hall and only while the guild owns more than it stands; the banker's press opens the vault to a member; the
// pieces wear the hall's arms.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { GUILD_FURNITURE_BUILDS, GUILD_FURNITURE_ENTRIES, GUILD_BRAZIER_LIGHT, isGuildBanker, registerGuildFurniture } from '../../src/world/guildFurniture.js';
import { GUILD_ART_ARCHIVE, GUILD_ART_REC, guildMaterialArt, guildArmsArt, wearGuildArt } from '../../src/world/guildFurnitureArt.js';
import { customModelFor } from '../../src/world/customModels.js';
import { GUILD_FURNITURE_MODELS } from '../../src/net/guild/guildShopLaw.js';
import { guildWareName } from '../../src/ui/guild/guildShopText.js';
import { decorRoomEntries } from '../../src/systems/decor/decorCatalogue.js';
import { decorLightOf } from '../../src/net/decorLaw.js';
import { hallPiecePress } from '../../src/scenes/guildHallPress.js';
import { noteHallArms, hallArms, _resetArmsBook } from '../../src/net/guild/guildArmsBook.js';
import { guildStockOwned, noteGuildShop, setGuildStockReader, _resetGuildStock } from '../../src/net/guild/guildStock.js';
import { guildStockText } from '../../src/ui/guild/guildShopText.js';
import { guildPieceRule } from '../../server-account/src/guildFurniture.js';

const realNow = Date.now;
let _now = T0;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });

test('GUILD-SHOP the hall pieces: seven models of the port\'s own, each standing on its foot under the guild art\'s archive, the banner and the shield faces the hall\'s arms (mutants: a piece built off another\'s builder; a picture face lost)', () => {
  registerGuildFurniture();
  assert.deepEqual(Object.keys(GUILD_FURNITURE_BUILDS), ['banker', 'standard', 'crestplaque', 'throne', 'wartable', 'weaponrack', 'brazier']);
  for (const id of GUILD_FURNITURE_MODELS) {
    const m = customModelFor(id);
    assert.ok(m && m.positions.length > 0 && m.indices.length > 0, `${id} builds`);
    assert.ok(m.subMeshes.every((sm) => sm.textureArchive === GUILD_ART_ARCHIVE), `${id}: the guild art's pictures alone`);
    let minY = Infinity;
    for (let i = 1; i < m.positions.length; i += 3) minY = Math.min(minY, m.positions[i]);
    assert.ok(Math.abs(minY) < 1e-6, `${id} stands on its foot`);
  }
  const recs = (/** @type {number} */ id) => new Set(customModelFor(id).subMeshes.map((sm) => sm.textureRecord));
  assert.ok(recs(864301).has(GUILD_ART_REC.banner), 'the standard flies the banner');
  for (const id of [864300, 864302, 864303, 864305]) assert.ok(recs(id).has(GUILD_ART_REC.shield), `${id} carries the shield`);
  assert.ok(recs(864304).has(GUILD_ART_REC.map), 'the war table its map');
  assert.ok(recs(864306).has(GUILD_ART_REC.coals), 'the brazier its coals');
  assert.equal(guildMaterialArt().length, 8);
  for (const [, pic] of guildMaterialArt()) assert.equal(pic.colors.length, pic.width * pic.height * 4);
});

test('GUILD-SHOP the catalogue: the pieces offered in a guild\'s hall alone, never a home or a yard; named, free of gold (their stock instead), the brazier lit (mutants: a home offered them; the brazier dark)', () => {
  assert.deepEqual(GUILD_FURNITURE_ENTRIES.map((e) => [e.model, e.guild, e.name]), GUILD_FURNITURE_MODELS.map((m, i) => [m, Object.keys(GUILD_FURNITURE_BUILDS)[i], guildWareName(Object.keys(GUILD_FURNITURE_BUILDS)[i])]));
  assert.equal(decorRoomEntries(GUILD_FURNITURE_ENTRIES, { hall: true }).length, 7);
  assert.equal(decorRoomEntries(GUILD_FURNITURE_ENTRIES, { hall: false }).length, 0, 'a home');
  assert.equal(decorRoomEntries(GUILD_FURNITURE_ENTRIES, { hall: true, yard: true }).length, 0, 'a hall\'s yard');
  assert.deepEqual(decorLightOf(GUILD_FURNITURE_ENTRIES.find((e) => e.guild === 'brazier').light), { ...GUILD_BRAZIER_LIGHT, color: [1, 0.62, 0.3] });
  assert.equal(guildStockText({ guild: 'banker' }, 2), 'From the guild\'s stock: 2 left');
  assert.match(guildStockText({ guild: 'banker' }, 0), /Every Guild Banker the guild owns is set down/);
  _resetGuildStock();
  let asked = 0;
  setGuildStockReader(() => { asked++; });
  assert.equal(guildStockOwned('banker'), null, 'unread');
  assert.equal(asked, 1, 'and asked');
  noteGuildShop({ wares: [{ key: 'banker', payer: 'guild', owned: 2 }, { key: 'guildcrest', payer: 'account', held: true }] });
  assert.deepEqual([guildStockOwned('banker'), guildStockOwned('throne')], [2, 0]);
  _resetGuildStock();
});

test('GUILD-SHOP the banker pressed: a member\'s - the vault; a visitor\'s - told it serves the guild\'s members; the board still the board; any other piece none of theirs (mutants: the vault open to all; the board lost)', () => {
  const said = [];
  let vault = 0, board = 0;
  const press = (piece, isBoard, member) => hallPiecePress(piece, isBoard, () => { board++; }, () => { vault++; }, member, (x) => said.push(x));
  assert.equal(press({ model: 864300 }, false, true), true);
  assert.equal(vault, 1);
  assert.equal(press({ model: 864300 }, false, false), true);
  assert.deepEqual([vault, said], [1, ['The banker serves this guild\'s members alone.']]);
  assert.equal(press({ model: 41100 }, true, true), true);
  assert.equal(board, 1);
  assert.equal(press({ model: 864303 }, false, true), false, 'the seat is sat on, not pressed');
  assert.equal(isGuildBanker({ model: 864300, item: { t: 1 } }), false, 'a pack item is no banker');
});

test('GUILD-SHOP the pieces wear the hall\'s arms: the materials once a renderer, the arms\' two pictures again whenever the hall\'s arms change - each let go first (mutants: the arms never painted again; never let go)', () => {
  const log = [];
  const renderer = { uploadTexture: (a, r) => log.push(['up', a, r]), releaseTexture: (a, r) => log.push(['free', a, r]) };
  _resetArmsBook();
  noteHallArms({ tag: 'IRON', heraldry: { field: 'azure', border: 'gold', device: 'owl' }, logo: null });
  assert.equal(hallArms().heraldry.device, 'owl');
  assert.equal(wearGuildArt(renderer, hallArms()), true);
  assert.equal(log.filter((c) => c[0] === 'up').length, 10, 'eight materials and two arms');
  log.length = 0;
  assert.equal(wearGuildArt(renderer, hallArms()), false, 'nothing again');
  noteHallArms({ tag: 'GREY', heraldry: { field: 'crimson', border: 'sable', device: 'wolf' }, logo: null });
  assert.equal(wearGuildArt(renderer, hallArms()), true);
  assert.deepEqual(log, [['free', GUILD_ART_ARCHIVE, GUILD_ART_REC.banner], ['up', GUILD_ART_ARCHIVE, GUILD_ART_REC.banner], ['free', GUILD_ART_ARCHIVE, GUILD_ART_REC.shield], ['up', GUILD_ART_ARCHIVE, GUILD_ART_REC.shield]]);
  const [[, banner], [, shield]] = guildArmsArt(hallArms());
  assert.deepEqual([banner.width, banner.height, shield.width], [64, 192, 128], 'painted without a canvas as the arms\' colours');
  _resetArmsBook();
});

test('GUILD-SHOP the service stands a guild piece only in its guild\'s hall, at no gold, while the guild owns one more than it stands - a keeper\'s placement and the Confirm\'s batch alike (mutants: the stock unread; a home took one; a piece priced)', async () => {
  assert.equal(guildPieceRule({ model: 864300, paid: 0 }, { hall: false, yard: false }), 'guild-ware-hall');
  assert.equal(guildPieceRule({ model: 864300, paid: 0 }, { hall: true, yard: true }), 'guild-ware-hall');
  assert.equal(guildPieceRule({ model: 864300, paid: 120 }, { hall: true, yard: false }), 'bad-decor', 'its silver was paid - no gold besides');
  assert.equal(guildPieceRule({ model: 864300, paid: 0 }, { hall: true, yard: false }), null);
  assert.equal(guildPieceRule({ model: 41000, paid: 120 }, { hall: false, yard: false }), null, 'any other piece is no business of this rule');
  const s = await standService({ MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.realm.id, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.realm.id, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const gid = found.body.guild.id;
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, region, price, paid, bought_at, guild_id, owner_name) VALUES (7, 3, ?, ?, 0, 100, 100, 1, ?, 'The Iron Oath')").run(gm.id, gm.realm.id, gid);
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, region, price, paid, bought_at, owner_name) VALUES (7, 4, ?, ?, 0, 100, 100, 1, 'Aldric')").run(gm.id, gm.realm.id);
  const piece = (id) => ({ id, model: 864300, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });
  const place = (buildingKey, id) => s.call('/v1/homes/decor/place', { mapId: 7, buildingKey, character: gm.realm.id, piece: piece(id) }, gm.secret);
  assert.deepEqual((await place(3, 'g1')).body, { error: 'guild-ware-none' }, 'the guild owns none');
  raw.prepare("INSERT INTO guild_furniture (guild_id, ware, owned) VALUES (?, 'banker', 1)").run(gid);
  assert.deepEqual((await place(4, 'g1')).body, { error: 'guild-ware-hall' }, 'a home takes none');
  const r = await place(3, 'g1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(raw.prepare('SELECT paid FROM home_decor WHERE id = ?').get('g1').paid, 0, 'no gold');
  assert.deepEqual((await place(3, 'g2')).body, { error: 'guild-ware-none' }, 'one owned, one stands');
  const list = await s.call('/v1/homes/decor', { mapId: 7, buildingKey: 3 }, gm.secret);
  assert.deepEqual(list.body.arms, { tag: 'IRON', name: 'The Iron Oath', heraldry: null, logo: null }, 'the hall\'s arms, said with its pieces');
  // the Confirm's batch: a second bought, the two counted as the batch stands them
  raw.prepare("UPDATE guild_furniture SET owned = 2 WHERE guild_id = ?").run(gid);
  const rev = Number(raw.prepare('SELECT rev FROM decor_rev WHERE map_id = 7 AND building_key = 3').get()?.rev ?? 0);
  const batch = (put, txn) => s.call('/v1/homes/decor/batch', { mapId: 7, buildingKey: 3, character: gm.realm.id, rev, txn, put, drop: [] }, gm.secret);
  const over = await batch([piece('g2'), piece('g3')], 'txn-guild-furniture-a');
  assert.equal(over.status, 409, JSON.stringify(over.body));
  assert.equal(over.body.error, 'guild-ware-none', 'two put, one left');
  const fits = await batch([piece('g2')], 'txn-guild-furniture-b');
  assert.equal(fits.status, 200, JSON.stringify(fits.body));
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE model = 864300').get().n, 2);
  // AUDIT GUILD-SHOP S6: a batch that takes one down and stands another is no new piece
  const rev2 = Number(raw.prepare('SELECT rev FROM decor_rev WHERE map_id = 7 AND building_key = 3').get()?.rev ?? 0);
  const swap = await s.call('/v1/homes/decor/batch', { mapId: 7, buildingKey: 3, character: gm.realm.id, rev: rev2, txn: 'txn-guild-furniture-c', put: [piece('g4')], drop: ['g2'] }, gm.secret);
  assert.equal(swap.status, 200, JSON.stringify(swap.body));
  assert.deepEqual(raw.prepare('SELECT id FROM home_decor WHERE model = 864300 ORDER BY id').all().map((r) => r.id), ['g1', 'g4']);
  // AUDIT GUILD-SHOP S5: moved, it stays a guild piece - no chest, no station
  const move = (place) => s.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 3, character: gm.realm.id, id: 'g1', place }, gm.secret);
  assert.deepEqual((await move({ pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, storage: true, paid: 0 })).body, { error: 'bad-decor' }, 'a banker made a chest');
  assert.equal((await move({ pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, paid: 0 })).status, 200, 'moved as it is');
});
