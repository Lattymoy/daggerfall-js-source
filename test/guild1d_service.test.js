// GUILD1d (2026-09-30, Mac: "Lets do this"): THE GUILD HALL AND HERALDRY, AS THE SERVICE KEEPS THEM - driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 8;
// `06-Systems/Online-Arc.md` GUILD1d.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm, realmAt } from './realmSeat.mjs';
import { GUILD_FOUND_GOLD } from '../src/net/guildLaw.js';
import { guildHallPrice, guildHallOwner } from '../src/net/hallLaw.js';
import { homeSaleRefund, homeMayEnter } from '../src/net/homeLaw.js';
import { HERALDRY_CHANGE_DRAKES } from '../src/net/heraldryLaw.js';

const HALL = { mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: null };   // AUDIT PRE-MERGE 1003 WD1: a hall says its town's layout (none: an old build's, 426)
const piece = (over = {}) => ({ id: 'bench1', model: 41000, flat: null, pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });

/** A guild founded by Gwen, `gold` of realm gold deposited on Gwen's record; Otto joined and made an Officer, Rhea a
 *  Recruit - each a realm character of their own. */
async function stood({ gold = 60_000, marks = null } = {}) {
  const svc = await standService(marks ? { MARKS_OPEN: 'on' } : {});
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const dep = await svc.call('/v1/guilds/deposit', { character: gm.character, gold, realm: gm.at(), region: 17 }, gm.secret);
  assert.equal(dep.status, 200, JSON.stringify(dep.body));
  const join = async (handle) => {
    const who = await svc.registered(handle);
    const R = await seatRealm(svc.env, who.secret, handle, { name: handle, level: 5, goldPieces: 50_000, items: [] });
    who.character = R.id; who.at = R.at;
    assert.equal((await svc.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret)).status, 200);
    const inv = await svc.call('/v1/guilds/invites', {}, who.secret);
    assert.equal((await svc.call('/v1/guilds/answer', { character: who.character, guild: inv.body.invites[0].guild, accept: true }, who.secret)).status, 200);
    return who;
  };
  const officer = await join('Otto');
  const recruit = await join('Rhea');
  const view = async (who = gm) => (await svc.call('/v1/guilds/mine', { character: who.character }, who.secret)).body.guild;
  const otto = (await view()).members.find((m) => m.name === 'Otto');
  assert.equal((await svc.call('/v1/guilds/rank', { character: gm.character, member: otto.member, rank: 1 }, gm.secret)).status, 200);
  const town = async (who) => (await svc.call('/v1/homes/town', { mapId: HALL.mapId, character: who?.character ?? null }, who?.secret ?? (await svc.guest()).secret)).body.homes;
  const raw = svc.env.DB._raw;
  return { svc, gm, officer, recruit, view, town, raw };
}

test('GUILD1d a hall BOUGHT: the guildmaster\'s, from what realm records paid in, at the home\'s price and half again - the ledger names it, the row names the guild and its mark, the town answers it; a second hall, a taken building, a short treasury, gold no record paid in and a rank below refused (mutants: the half again dropped; realm_gold unguarded; the one-hall index; the mark a character\'s id; the rank unasked)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, recruit, view, town, raw } = await stood();
  const buy = (who, over = {}) => svc.call('/v1/guilds/hall/buy', { character: who.character, ...HALL, ...over }, who.secret);
  assert.equal((await buy(officer)).body.error, 'guild-rank', 'an Officer buys no hall - the gold is the guildmaster\'s');
  const before = (await view()).treasury;
  const r = await buy(gm);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.cost, guildHallPrice(HALL.price));
  assert.equal(guildHallPrice(20_000), 30_000, 'half again');
  assert.equal(guildHallPrice(3), 5, 'rounded up - never a fraction of a coin under');
  const g = await view();
  assert.equal(g.treasury, before - 30_000);
  assert.deepEqual(g.hall, { mapId: 7, buildingKey: 300, region: 17, entry: 'guild', price: 20_000, paid: 30_000, boughtAt: T0 });
  assert.equal(g.ledger[0].kind, 'hall', 'the ledger says why the gold went');
  assert.equal(g.ledger[0].amount, 30_000);
  const row = raw.prepare('SELECT player, char_id, guild_id, owner_name FROM homes WHERE map_id = 7 AND building_key = 300').get();
  assert.equal(row.char_id, guildHallOwner(g.id));
  assert.equal(row.guild_id, g.id);
  assert.equal(row.owner_name, 'The Silver Hand');
  assert.ok(!/^[A-Za-z0-9_-]{4,64}$/.test(row.char_id), 'the guild\'s mark is outside every character id\'s shape');
  // the town: the members see their hall, its keepers may furnish it; a stranger sees whose it is
  const mine = (await town(gm)).find((h) => h.buildingKey === 300);
  assert.deepEqual(mine, { buildingKey: 300, owner: 'The Silver Hand', entry: 'guild', mine: false, hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null }, member: true, keeper: true, hallEntry: true });   // AUDIT PROF-541 G2: `hallEntry`
  assert.equal((await town(officer)).find((h) => h.buildingKey === 300).keeper, true, 'an Officer keeps it');
  const rh = (await town(recruit)).find((h) => h.buildingKey === 300);
  assert.equal(rh.member, true);
  assert.equal(rh.keeper, undefined, 'a Recruit walks in and furnishes nothing');
  const stranger = (await town(null)).find((h) => h.buildingKey === 300);
  assert.equal(stranger.member, undefined);
  assert.equal(homeMayEnter(stranger), false, 'shut to a stranger while its guild keeps it');
  assert.equal(homeMayEnter(rh), true);
  // a second hall, and one bought again after a lost answer
  assert.equal((await buy(gm, { buildingKey: 301 })).body.error, 'guild-hall-have', 'one hall a guild');
  const again = await buy(gm);
  assert.equal(again.status, 200);
  assert.equal(again.body.repeat, true, 'the same building asked again is the claim');
  assert.equal((await view()).treasury, before - 30_000, 'paid once');
  // a building somebody owns
  raw.prepare('DELETE FROM homes WHERE guild_id IS NOT NULL').run();
  const other = await svc.registered('Hugo');
  assert.equal((await svc.seatHome(other, { mapId: 7, buildingKey: 302, region: 17, price: 5000 })).status, 200);
  assert.equal((await buy(gm, { buildingKey: 302 })).body.error, 'home-taken');
  // short: the treasury, then the part of it realm records paid in
  assert.equal((await buy(gm, { buildingKey: 303, price: 9_000_000 })).body.error, 'guild-treasury-short');
  raw.prepare('UPDATE guilds SET realm_gold = 1000').run();
  assert.equal((await buy(gm, { buildingKey: 303 })).body.error, 'guild-treasury-old', 'gold no record paid in buys no hall');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes WHERE guild_id IS NOT NULL').get().n, 0, 'a refused hall leaves nothing');
});

test('GUILD1d the hall is NO CHARACTER\'S: its anchor account neither sells it, opens it nor lists it; a hall is sold by its guild - the deed share and its pieces\' half back into the treasury, the ledger naming it, the building free; a guild never goes while it holds one (mutants: the guild_id guards dropped from release, entry and mine; guildKeepsSql without the hall; the sale\'s refund to a record)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, view, raw } = await stood();
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  // the account that bought it, through a home's own doors
  assert.equal((await svc.call('/v1/homes/release', { mapId: 7, buildingKey: 300, realm: gm.at() }, gm.secret)).body.error, 'no-home', 'never sold as a home');
  assert.equal((await svc.call('/v1/homes/release', { mapId: 7, buildingKey: 300 }, gm.secret)).body.error, 'no-home', 'nor down the old lane');
  assert.equal((await svc.call('/v1/homes/entry', { mapId: 7, buildingKey: 300, entry: 'public' }, gm.secret)).body.error, 'no-home', 'nor opened as a home');
  assert.deepEqual((await svc.call('/v1/homes/mine', {}, gm.secret)).body.homes, [], 'nor listed among the account\'s homes');
  // disband and a lone leave refused while it stands
  raw.prepare('DELETE FROM guild_members WHERE rank <> 0').run();
  raw.prepare("UPDATE guilds SET treasury = 0, realm_gold = 0, moved_by = 'x', moved_at = 1").run();
  assert.equal((await svc.call('/v1/guilds/disband', { character: gm.character }, gm.secret)).body.error, 'guild-hall', 'sell the hall first');
  assert.equal((await svc.call('/v1/guilds/leave', { character: gm.character }, gm.secret)).body.error, 'guild-hall');
  // a piece in it, paid by its keeper's record (the guildmaster keeps it too)
  const placed = await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: gm.character, piece: piece(), realm: gm.at() }, gm.secret);
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const sold = await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret);
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.equal(sold.body.refund, homeSaleRefund(30_000), 'the deed share of what the treasury paid');
  assert.equal(sold.body.decorBack, 60, 'half of what its keeper\'s record paid for its piece');
  assert.equal(sold.body.decorCount, 1);
  const g = await view();
  assert.equal(g.treasury, homeSaleRefund(30_000) + 60);
  assert.equal(raw.prepare('SELECT realm_gold FROM guilds').get().realm_gold, homeSaleRefund(30_000) + 60, 'into what records paid in - its guildmaster may take it out again');
  assert.equal(g.ledger[0].kind, 'hall-sale');
  assert.equal(g.hall, null);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'its pieces went with it');
  assert.equal((await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret)).body.error, 'guild-hall-none');
  void officer;
});

test('GUILD1d who may walk in: an Officer opens the hall to anyone or keeps it to its members, a Recruit may not; a home\'s owner opens it to their guild - the town answers `guildmate` to a guildmate alone (mutants: hallEntry\'s ranks; the entry unchecked; guildmate for a stranger; the hall rule before `mine`)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, recruit, town } = await stood();
  assert.equal((await svc.call('/v1/guilds/hall/entry', { character: officer.character, entry: 'public' }, officer.secret)).body.error, 'guild-hall-none', 'no hall yet');
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/guilds/hall/entry', { character: recruit.character, entry: 'public' }, recruit.secret)).body.error, 'guild-rank');
  assert.equal((await svc.call('/v1/guilds/hall/entry', { character: officer.character, entry: 'private' }, officer.secret)).body.error, 'bad-entry', 'a hall is its members\' or anyone\'s');
  assert.equal((await svc.call('/v1/guilds/hall/entry', { character: officer.character, entry: 'public' }, officer.secret)).status, 200);
  const open = (await town(null)).find((h) => h.buildingKey === 300);
  assert.equal(open.entry, 'public');
  assert.equal(homeMayEnter(open), true, 'anyone, now');
  assert.equal(homeMayEnter({ ...open, entry: 'guild', mine: true }), false, 'a hall is never an account\'s own - `mine` opens no hall');
  // a home opened to its owner's guild
  const h = await svc.seatHome(recruit, { mapId: 7, buildingKey: 310, region: 17, price: 5000 });
  assert.equal(h.status, 200, JSON.stringify(h.body));
  // the recruit's realm character that owns the house joins nobody's guild: seat it in the guild as the recruit's own
  svc.env.DB._raw.prepare('UPDATE guild_members SET char_id = ? WHERE player = ?').run(h.character, recruit.id);
  assert.equal((await svc.call('/v1/homes/entry', { mapId: 7, buildingKey: 310, entry: 'guild' }, recruit.secret)).status, 200, 'the `guild` entry is a home\'s');
  const seen = async (who) => (await town(who)).find((x) => x.buildingKey === 310);
  const byOfficer = await seen(officer);
  assert.equal(byOfficer.guildmate, true, 'a guildmate');
  assert.equal(homeMayEnter(byOfficer), true);
  const stranger = await svc.registered('Sven');
  const R = await seatRealm(svc.env, stranger.secret, 'Sven', { name: 'Sven', level: 3, goldPieces: 10, items: [] });
  stranger.character = R.id;
  const bySven = await seen(stranger);
  assert.equal(bySven.guildmate, undefined, 'a stranger is no guildmate');
  assert.equal(homeMayEnter(bySven), false);
});

test('GUILD1d a hall\'s DECOR: its Officers furnish it off their own records and a Recruit may not; its pieces are the catalogue\'s alone (GUILD-YARD: its yard stands); half of a piece taken out or shrunk goes into the guild\'s treasury, never to the keeper\'s purse (mutants: OWNS\'s keepers; the item refusal - a yard\'s is a palace\'s alone now; the half to the record; the ledger\'s kind)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, recruit, view, raw } = await stood();
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  const place = (who, body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: who.character, realm: who.at(), ...body }, who.secret);
  assert.equal((await place(recruit, { piece: piece() })).body.error, 'no-home', 'a Recruit furnishes nothing');
  const goldOf = (who) => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj))).goldPieces;
  const had = goldOf(officer);
  const p = await place(officer, { piece: piece() });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(goldOf(officer), had - 120, 'the Officer\'s own record paid for it');
  assert.equal((await place(officer, { piece: piece({ id: 'own1', model: null, flat: [204, 1], paid: 0, item: { t: 1 } }) })).body.error, 'hall-item', 'a keeper\'s own things stand in no hall');
  assert.equal((await place(gm, { piece: piece({ id: 'yard1' }), yard: true })).status, 200, 'GUILD-YARD: its yard is its keepers\' as its rooms are (test/guild_yard.test.js)');
  const t0 = (await view()).treasury;
  const at = realmAt(svc.env, officer.character);
  const gone = await svc.call('/v1/homes/decor/remove', { mapId: 7, buildingKey: 300, character: gm.character, id: 'bench1', realm: gm.at() }, gm.secret);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(gone.body.gold, 0, 'nothing to the purse of whoever took it down');
  assert.equal(gone.body.treasury, 60);
  assert.equal(gone.body.realm, undefined, 'no record moved');
  const g = await view();
  assert.equal(g.treasury, t0 + 60, 'half of what it cost, into the treasury');
  assert.equal(g.ledger[0].kind, 'hall-piece');
  assert.equal(goldOf(officer), had - 120, 'and nothing back to the Officer who paid');
  assert.deepEqual(realmAt(svc.env, officer.character), at);
  // shrunk: half the difference, the same way
  assert.equal((await place(officer, { piece: piece({ id: 'b2', paid: 200 }) })).status, 200);
  const shrink = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: officer.character, id: 'b2', realm: officer.at(), place: { pos: [2, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 100 } }, officer.secret);
  assert.equal(shrink.status, 200, JSON.stringify(shrink.body));
  assert.equal(shrink.body.treasury, 50);
  assert.equal((await view()).ledger[0].kind, 'hall-piece');
});

test('GUILD1d HERALDRY: the guildmaster\'s; the first free, the same again refused, each change after it 500 Drakes burnt from the Drake treasury in one batch with the change, asked again under its id answered as made; a change short of Drakes or with Drakes shut refused and nothing changed (mutants: the first charged; the burn unguarded; the change without its line; the rank)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, view, town, raw } = await stood({ marks: true });
  const set = (who, heraldry, rid) => svc.call('/v1/guilds/heraldry', { character: who.character, heraldry, ...(rid ? { rid } : {}) }, who.secret);
  const wolf = { field: 'azure', border: 'gold', device: 'wolf' };
  assert.equal((await set(officer, wolf)).body.error, 'guild-rank');
  assert.equal((await set(gm, { ...wolf, field: 'ash' })).body.error, 'bad-heraldry', 'Ash is the unheld ring\'s field');
  const first = await set(gm, wolf);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.cost, 0, 'the first is free');
  assert.deepEqual((await view()).heraldry, wolf);
  assert.equal((await set(gm, wolf, 'herald-01')).body.error, 'heraldry-same');
  const bear = { ...wolf, device: 'bear' };
  assert.equal((await set(gm, bear, 'herald-01')).body.error, 'heraldry-drakes', 'the Drake treasury holds none');
  assert.deepEqual((await view()).heraldry, wolf, 'nothing changed');
  svc.seedMarks(gm, 2000);
  assert.equal((await svc.call('/v1/marks/guild/deposit', { character: gm.character, marks: 800, rid: 'deposit-01' }, gm.secret)).status, 200);
  const changed = await set(gm, bear, 'herald-02');
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.cost, HERALDRY_CHANGE_DRAKES);
  assert.equal(raw.prepare('SELECT balance FROM guild_marks').get().balance, 800 - HERALDRY_CHANGE_DRAKES);
  const line = raw.prepare("SELECT src_kind, dst_kind, amount FROM marks_ledger WHERE kind = 'heraldry'").get();
  assert.deepEqual({ ...line }, { src_kind: 'guild', dst_kind: 'burn', amount: HERALDRY_CHANGE_DRAKES }, 'burnt - a sink');
  const again = await set(gm, bear, 'herald-02');
  assert.equal(again.body.repeat, true, 'asked again under its id: the change it made');
  assert.equal(raw.prepare('SELECT balance FROM guild_marks').get().balance, 300, 'burnt once');
  assert.equal((await set(gm, wolf, 'herald-03')).body.error, 'heraldry-drakes', '300 left');
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  assert.deepEqual((await town(gm)).find((h) => h.buildingKey === 300).hall.heraldry, bear, 'the hall\'s door wears it');
  void GUILD_FOUND_GOLD;
});
