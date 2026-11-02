// DOMAIN2 (2026-10-24, the owner: "Allowing the purchase of the actual castle in major cities (cyrodil excluded), using the
// instancing system"; asked, "One owner per castle", "Silver", "Region holder buys it"): A GUILD'S CASTLE - bought in
// silver by the Guildmaster of the guild holding its crown region alone, one owner a castle, its own instance (an epoch
// minted at the purchase); released with the region by any road, half its price home; given up while held, 85% home
// (bible/11-Multiplayer/Domains.md section 6; src/net/castleLaw.js, server-account/src/castles.js, net/instanceRoom.js's
// `guild` arm). Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, SEAT_MEMBER_WAIT_S, CROWN_SEAT_REGIONS } from '../../src/net/townSeatLaw.js';
import {
  CASTLE_PRICE, CASTLE_SALE_SHARE, CASTLE_LOST_SHARE, CASTLE_REGIONS, castleMay, castleRegionOk, castleKeyOk, castleSaleRefund, castleLostRefund, castleOffers,
} from '../../src/net/castleLaw.js';
import { MAIN_STORY_DUNGEON_IDS } from '../../src/world/dungeon/dungeonTextures.js';
import { HOME_SALE_SHARE } from '../../src/net/homeLaw.js';
import { GUILD_RANK_MASTER } from '../../src/net/guild/guildLaw.js';
import { releaseCastles } from '../../server-account/src/castles.js';
import { _resetWeeksKept } from '../../server-account/src/weekKept.js';

const WAYREST = { key: 630439035, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };   // AUDIT DOMAINS R2: the crown seats' own keys, the castles the relay admits
const SENTINEL = { key: 6634853, name: 'Sentinel', region: 20, tier: 'crown', pixel: [250, 410] };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
let _rid = 0;
const rid = () => `castle-${String(++_rid).padStart(6, '0')}`;

async function stood(t, env = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', ...env });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [WAYREST, SENTINEL, ANTICLERE]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.seated(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, rank) => {
    const m = await svc.seated(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const silver = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const hold = (seat, gid) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 0, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 1, T0 - 7 * DAY);
  const lose = (seat) => raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(seat.key);
  const castle = (region) => raw.prepare('SELECT * FROM guild_castles WHERE region = ?').get(region) ?? null;
  const buy = async (who, region, r = rid()) => svc.call('/v1/guilds/castle/buy', { character: who.character, region, rid: r }, who.secret);
  const sell = async (who, region, r = rid()) => svc.call('/v1/guilds/castle/sell', { character: who.character, region, rid: r }, who.secret);
  const mine = async (who) => (await svc.call('/v1/guilds/mine', { character: who.character }, who.secret)).body.guild;
  return { svc, raw, guild, member, treasury, silver, hold, lose, castle, buy, sell, mine, at: (s) => { now = s; } };
}

test('DOMAIN2 THE LAW: a castle is a crown region\'s - the Bay\'s three; 120,000 silver; 85% home given up (a hall\'s share, one home), half lost with the region; the Guildmaster buys and gives up; a guild may buy each crown it holds whose castle nobody keeps (mutants: the regions; the price; the shares; the rank; the offers)', () => {
  // PIN MOVED (WW7-3, bible/03-World/World-Wide.md WW7): every crown's region a castle's - the provinces' too
  assert.deepEqual(CASTLE_REGIONS, [17, 20, 23, 64, 65, 66, 67, 68, 69, 70]);
  assert.deepEqual(CASTLE_REGIONS, Object.keys(CROWN_SEAT_REGIONS).map(Number).sort((a, b) => a - b));
  for (const r of [17, 20, 23, 64, 70]) assert.equal(castleRegionOk(r), true);
  for (const r of [0, 21, 61, 62, 63, 71, -1, 17.5, '17']) assert.equal(castleRegionOk(r), false, String(r));
  assert.equal(CASTLE_PRICE, 120_000);
  assert.deepEqual([CASTLE_SALE_SHARE, CASTLE_LOST_SHARE], [HOME_SALE_SHARE, 0.5]);
  assert.deepEqual([castleSaleRefund(120_000), castleLostRefund(120_000), castleSaleRefund(7), castleLostRefund(7), castleLostRefund(-5)], [102_000, 60_000, 5, 3, 0]);
  assert.deepEqual([castleMay(GUILD_RANK_MASTER, 'buy'), castleMay(GUILD_RANK_MASTER, 'sell'), castleMay(1, 'buy'), castleMay(1, 'sell'), castleMay(2, 'buy')], [true, true, false, false, false]);
  assert.deepEqual(castleOffers([
    { key: 630439035, region: 23, tier: 'crown' }, { key: 3021, region: 21, tier: 'palace' }, { key: 6634853, region: 20, tier: 'crown' }, { key: 9, region: 9, tier: 'crown' },
    { key: 5017, region: 17, tier: 'crown' },   // AUDIT DOMAINS R2: a crown key that is no castle the relay admits
  ], [20]), [{ region: 23, key: 630439035 }]);
});

test('DOMAIN2 A CASTLE BOUGHT: the Guildmaster of the guild holding Wayrest\'s crown buys Castle Wayrest - 120,000 silver burnt, the castle its own (its key the crown seat\'s, an epoch minted), its members told on the guild\'s view; asked again it is one purchase (mutants: the burn; the epoch; the key; the request id)', async (t) => {
  const s = await stood(t);
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(WAYREST, eo.gid);
  s.treasury(eo.gid, 150_000);
  const view0 = await s.mine(eo.gm);
  assert.deepEqual([view0.castles, view0.castleOffers], [[], [{ region: 23, key: WAYREST.key, price: 120_000 }]], 'the Guildmaster is offered its crown\'s castle');
  const r1 = rid();
  const a = await s.buy(eo.gm, 23, r1);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const row = s.castle(23);
  assert.deepEqual([row.guild_id, row.key, row.paid], [eo.gid, WAYREST.key, 120_000]);
  assert.match(row.epoch, /^[0-9a-f]{8}$/);
  assert.equal(s.silver(eo.gid), 30_000);
  assert.equal(s.raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'castle' AND src_id = ?").get(eo.gid).amount, 120_000);
  const again = await s.buy(eo.gm, 23, r1);
  assert.equal(again.body.repeat, true);
  assert.equal(s.silver(eo.gid), 30_000, 'one purchase');
  // every member reads it - the epoch the door keys its room by
  const off = await s.member(eo, 'Ofelia', 1);
  const view = await s.mine(off);
  assert.deepEqual(view.castles, [{ region: 23, key: WAYREST.key, epoch: row.epoch, paid: 120_000, boughtAt: T0 }]);
  assert.deepEqual(view.castleOffers, [], 'an Officer buys none');
});

test('DOMAIN2 WHO MAY BUY: an Officer never; a guild holding no crown there, or a palace alone, never; a castle kept is nobody else\'s; a treasury short of 120,000 buys none and burns nothing; a region with no castle none (mutants: the rank; the crown; the region\'s one owner; the silver; the castle\'s region)', async (t) => {
  const s = await stood(t);
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(WAYREST, eo.gid);
  s.hold(ANTICLERE, sh.gid);
  s.treasury(eo.gid, 119_999);
  s.treasury(sh.gid, 500_000);
  const off = await s.member(eo, 'Ofelia', 1);
  assert.equal((await s.buy(off, 23)).body.error, 'guild-rank');
  assert.equal((await s.buy(eo.gm, 23)).body.error, 'guild-marks-short');
  assert.equal(s.silver(eo.gid), 119_999, 'nothing burnt');
  assert.equal((await s.buy(sh.gm, 23)).body.error, 'castle-not-held', 'another guild\'s crown');
  assert.equal((await s.buy(sh.gm, 21)).body.error, 'castle-none', 'a palace region keeps no castle');
  assert.equal((await s.buy(sh.gm, 62)).body.error, 'castle-none');
  s.treasury(eo.gid, 1);
  assert.equal((await s.buy(eo.gm, 23)).status, 200);
  // the crown changes hands, but the castle is not free until the old owner's is released - the new holder buys it then
  s.lose(WAYREST);
  s.hold(WAYREST, sh.gid);
  const b = await s.buy(sh.gm, 23);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(s.castle(23).guild_id, sh.gid);
  assert.equal((await s.buy(eo.gm, 23)).body.error, 'castle-not-held');
  // the crown lost between the read and the write: the purchase's own statement asks it again - nothing burnt, no castle
  const lt = await s.guild('Lorna', 'Low Tide', 'LT');
  s.hold(SENTINEL, lt.gid);
  s.treasury(lt.gid, 130_000);
  const db = s.svc.env.DB, batch = db.batch.bind(db);
  db.batch = async (stmts) => { s.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(SENTINEL.key); db.batch = batch; return batch(stmts); };
  assert.equal((await s.buy(lt.gm, 20)).body.error, 'castle-not-held');
  assert.deepEqual([s.castle(20), s.silver(lt.gid)], [null, 130_000]);
});

test('DOMAIN2 GOES WITH THE REGION: a castle whose guild no longer holds its crown is released at the next read - half its price home, once, the room\'s epoch gone with it; the new holder buys a fresh one; given up while held, 85% home and the castle free (mutants: the release\'s hold; the half; once; the sale\'s share; the fresh epoch)', async (t) => {
  const s = await stood(t);
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(WAYREST, eo.gid);
  s.treasury(eo.gid, 120_000);
  assert.equal((await s.buy(eo.gm, 23)).status, 200);
  const first = s.castle(23).epoch;
  assert.equal(s.silver(eo.gid), 0);
  s.lose(WAYREST);
  const view = await s.mine(eo.gm);
  assert.deepEqual(view.castles, [], 'released at the read');
  assert.equal(s.silver(eo.gid), 60_000, 'half home');
  assert.deepEqual(await releaseCastles(s.svc.env.DB, T0), [], 'once');
  assert.equal(s.silver(eo.gid), 60_000);
  s.hold(WAYREST, sh.gid);
  s.treasury(sh.gid, 240_000);
  assert.equal((await s.buy(sh.gm, 23)).status, 200);
  assert.notEqual(s.castle(23).epoch, first, 'a fresh castle');
  const sold = await s.sell(sh.gm, 23);
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.equal(sold.body.back, 102_000);
  assert.equal(s.castle(23), null);
  assert.equal(s.silver(sh.gid), 120_000 + 102_000);
  assert.equal((await s.sell(sh.gm, 23)).body.error, 'castle-not-yours');
  // the Season's wipe takes every Charter - and so every castle, at its next read
  assert.equal((await s.buy(sh.gm, 23)).status, 200);
  s.raw.prepare('DELETE FROM town_seat_holds').run();
  assert.deepEqual(await releaseCastles(s.svc.env.DB, T0), [23]);
});

test('DOMAIN2 THE SWITCHES: a castle is the seats\' and the silver\'s - shut where either is (mutants: the seats\' switch; the silver\'s)', async (t) => {
  for (const [env, word] of [[{ SEATS_OPEN: 'off' }, 'seats-closed'], [{ MARKS_OPEN: 'off' }, 'marks-closed']]) {
    const s = await stood(t, env);
    const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
    s.hold(WAYREST, eo.gid);
    s.treasury(eo.gid, 150_000);
    assert.equal((await s.buy(eo.gm, 23)).body.error, word);
  }
});

// ─── THE ROOM: the relay's `guild` arm, the door, the throne room, the window ─────────────────────────────────────────
import { fakeRooms } from '../fakeRoom.mjs';
import {
  instanceAdmission, instanceGuildOwnerOf, instanceOwnerOf, instanceRoomOf, instanceWord, relaySupportsGuildInstances, GUILD_INSTANCE_RELAY_MIN, INSTANCE_DOOR_WORD, CASTLE_MAP_IDS,
} from '../../src/net/instanceRoom.js';
import { SOCIAL_ROOM, RELAY_VERSION } from '../../src/net/wire.js';
import { instanceOffer, INSTANCE_ROWS_MAX } from '../../src/systems/instancePlaces.js';
import { createInstanceDoor, dungeonSite, buildingSite } from '../../src/scenes/instanceDoor.js';
import { createSeatHallHost } from '../../src/scenes/seatHallHost.js';
import { guildCastleText, guildSilverLineText } from '../../src/ui/socialPanel.js';
import { readFileSync } from 'node:fs';

const G = 'gabcdefghij', OTHER = 'gzyxwvutsrq';
const CASTLE_WAYREST = 630439035;
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); await new Promise((r) => setTimeout(r, 60)); };
const refusal = (ws) => ws.sent.find((m) => m.t === 'error')?.m ?? null;
const welcomed = (ws) => ws.sent.some((m) => m.t === 'welcome');

test('DOMAIN2 THE LAW OF THE ROOM: a guild\'s digest is its own hash domain - never an account\'s of the same name; the relay admits a token whose guild owns the room (`guild`), after staff and the owner, never a party\'s guest; a relay before world260 is offered no castle; a castle\'s room alone (AUDIT DOMAINS R2) (mutants: the domain; the arm; the arm\'s order; the relay minimum)', async () => {
  assert.notEqual(await instanceGuildOwnerOf(G), await instanceOwnerOf(G));
  assert.equal(await instanceGuildOwnerOf(null), null);
  const key = instanceRoomOf(`dungeon:m${CASTLE_WAYREST}`, { owner: await instanceGuildOwnerOf(G), epoch: '89abcdef' });
  assert.equal(await instanceAdmission(key, 'acct-ofelia', { guild: G }), 'guild');
  assert.equal(await instanceAdmission(key, 'acct-carl', { guild: OTHER }), null);
  assert.equal(await instanceAdmission(key, 'acct-gary', {}), null);
  assert.equal(await instanceAdmission(key, 'acct-gary', { kin: async () => true }), 'party', 'the party arm is the hub\'s word - the relay asks it with the owner\'s digest, which no account\'s party holds');
  assert.equal(await instanceAdmission(key, 'acct-ofelia', { guild: G, staff: true }), 'staff');
  // AUDIT DOMAINS R2: a castle's room alone - a crown city's own dungeon, whole - never a guild's copy of any other room
  const g = await instanceGuildOwnerOf(G);
  for (const other of ['dungeon:m123456', 'interior:m630439035.5', `dungeon:m${CASTLE_WAYREST}.m`]) {
    const k = instanceRoomOf(other, { owner: g, epoch: 'deadbeef' });
    if (k) assert.equal(await instanceAdmission(k, 'acct-ofelia', { guild: G }), null, other);
  }
  // PIN MOVED (WW7-4): the provinces' capitals' castles after the Bay's (ww7_castles.test.js)
  assert.deepEqual(CASTLE_MAP_IDS.slice(0, 3), [6634853, 630439035, 1291010263], 'Sentinel, Wayrest and Daggerfall - measured on the freeware: the crown seats\' own keys, each a main-story dungeon');
  for (const k of CASTLE_MAP_IDS.slice(0, 3)) assert.ok(MAIN_STORY_DUNGEON_IDS.has(k));
  assert.deepEqual([castleKeyOk(630439035), castleKeyOk(5023), castleKeyOk('630439035')], [true, false, false]);
  // PIN MOVED (AUDIT TESA III E2-4, bible/01-Overview/audits/Audit-Tesa-III-E2.md): the castle's relay is the LAW row of
  // test/net/relayversion.test.js that names DOMAIN2, as AUDIT TESA II Z2 holds the world-wide gates to theirs - a literal
  // here beside the literal in instanceRoom.js let a renumber leave the gate on a number the live relay holds with no
  // guild arm (main's world260 is THE FOLD), so a castle's members were offered a door that refused them
  const law = readFileSync(new URL('./relayversion.test.js', import.meta.url), 'utf8');
  const named = [...law.matchAll(/^ {2}world(\d+): '[0-9a-f]{64}',\s+\/\/[^\n]*\bDOMAIN2\b/gm)].map((m) => Number(m[1]));
  assert.deepEqual(named, [GUILD_INSTANCE_RELAY_MIN], 'the castle\'s relay gate is the one row that names DOMAIN2 - a merge that renumbers the row moves it');
  assert.deepEqual([relaySupportsGuildInstances(`world${GUILD_INSTANCE_RELAY_MIN - 1}`), relaySupportsGuildInstances(`world${GUILD_INSTANCE_RELAY_MIN}`), relaySupportsGuildInstances(RELAY_VERSION)], [false, true, true]);
});

test('DOMAIN2 AT THE RELAY: a castle\'s room admits its guild\'s members by their token\'s guild; another guild, no guild and a member\'s party guest are refused before anything is written; a member who leaves the guild while inside is refused out (mutants: the hello\'s guild; the mark; the refusal out)', async () => {
  const world = fakeRooms();
  const hub = world.room(SOCIAL_ROOM);
  hub.store.set('acct:acct-gary', { name: 'gary', party: 'p1' });
  hub.store.set('party:p1', { id: 'p1', leader: 'acct-ofelia', members: ['acct-ofelia', 'acct-gary'], invites: [], away: {} });
  const key = instanceRoomOf(`dungeon:m${CASTLE_WAYREST}`, { owner: await instanceGuildOwnerOf(G), epoch: '89abcdef' });
  const r = world.room(key);
  const ofelia = r.connect(); await r.hello(ofelia, 'ofelia', null, { gi: G, gt: 'EO', gm: 'm2' });
  assert.ok(welcomed(ofelia), JSON.stringify(ofelia.sent.slice(0, 2)));
  assert.equal(r.room._attach(ofelia)?.ig, G, 'marked as the castle\'s guild');
  const carl = r.connect(); await r.hello(carl, 'carl', null, { gi: OTHER, gt: 'SH', gm: 'm1' });
  assert.equal(refusal(carl), INSTANCE_DOOR_WORD);
  const gary = r.connect(); await r.hello(gary, 'gary');
  assert.equal(refusal(gary), INSTANCE_DOOR_WORD, 'a member\'s party guest: one owner a castle');
  // the guild taken off (a removal carried in, as the guild arms of the relay write it)
  r.room._setAttach(ofelia, r.room._unguild(r.room._attach(ofelia)));
  await settle();
  assert.equal(refusal(ofelia), INSTANCE_DOOR_WORD, 'refused out');
  assert.ok(!r.sockets.includes(ofelia));
  // AUDIT DOMAINS R5: a socket already gone (a replacement's close) is refused no second time
  assert.match(readFileSync(new URL('../../server/src/index.js', import.meta.url), 'utf8'), /if \(this\._dead\.has\(ws\) \|\| this\._gone\.has\(ws\) \|\| !this\.state\.getWebSockets\(\)\.includes\(ws\)\) return;   \/\/ AUDIT DOMAINS R5/);
});

test('DOMAIN2 THE DOOR: the castle\'s dungeon door offers "Your guild\'s castle" beside the public castle where my guild keeps it and the relay admits a guild; a save inside it goes back in while the castle is still my guild\'s at that epoch, else to the public castle (mutants: the row; the relay\'s word; the epoch kept)', async () => {
  const castle = { kind: 'castle', owner: await instanceGuildOwnerOf(G), epoch: 'aabbccdd' };
  assert.deepEqual(instanceOffer({ online: true, instanceOk: true, castle: { owner: castle.owner, epoch: castle.epoch } }), [{ kind: 'public' }, castle]);
  assert.equal(instanceOffer({ online: true, instanceOk: true, castle: null }), null);
  // AUDIT DOMAINS C4: nine rows at most - the door's keys are 1-9; a castle, a quest of mine and a full party's seven partners
  const seven = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, acct: `a${i}`, owner: castle.owner, epoch: `0000000${i}` }));
  const nine = instanceOffer({ online: true, instanceOk: true, questHere: true, partners: seven, castle: { owner: castle.owner, epoch: castle.epoch } });
  // PIN MOVED (AUDIT RELEASE R3-4, the merge of main into TESA): main's order - the party's rooms before mine - under this
  // bound: six partners, then my own row on the ninth key (unbounded, my row was the tenth no key chose)
  assert.deepEqual([nine.length, INSTANCE_ROWS_MAX, nine.at(-2).name, nine.at(-1).kind], [9, 9, 'P5', 'mine']);
  let mine = { guild: G, epoch: 'aabbccdd', key: CASTLE_WAYREST, region: 23 };
  const door = createInstanceDoor({ online: () => true, instanceOk: () => true, castle: () => mine });
  const site = { ...dungeonSite({ mapTableData: { mapId: CASTLE_WAYREST }, name: 'Wayrest' }), relaid: false };
  const back = await door.entryFor(site, { ins: instanceWord({ owner: castle.owner, epoch: 'aabbccdd' }), whole: true });
  assert.deepEqual(back, { instance: { owner: castle.owner, epoch: 'aabbccdd' }, whole: true });
  mine = { ...mine, epoch: '11223344' };   // sold and bought again: a fresh castle
  assert.deepEqual(await door.entryFor(site, { ins: instanceWord({ owner: castle.owner, epoch: 'aabbccdd' }), whole: true }), { instance: null, whole: true });
  // AUDIT DOMAINS R1: a building of the crown city - its site carries the city's map id, the castle's - is no castle
  mine = { guild: G, epoch: 'aabbccdd', key: CASTLE_WAYREST, region: 23 };
  const shop = buildingSite(CASTLE_WAYREST, { buildingKey: 5 });
  assert.deepEqual(await door.entryFor(shop, { ins: instanceWord({ owner: castle.owner, epoch: 'aabbccdd' }), whole: true }), { instance: null, whole: true }, 'a save in a shop never keeps the castle\'s word');
  mine = null;
  assert.deepEqual(await door.entryFor(site, { ins: instanceWord({ owner: castle.owner, epoch: '11223344' }), whole: true }), { instance: null, whole: true });
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  // PIN MOVED (AUDIT DOMAINS R3): the world link's word too, as the instances' own
  assert.match(w, /castle: \(site\) => \(online\?\.guildInstanceOk \|\| chatLinks\?\.get\('world'\)\?\.guildInstanceOk \? seatHalls\.castleAt\(site\.mapId\) : null\),/, 'the door is handed the castle only where the relay admits a guild');
  assert.match(readFileSync(new URL('../../src/scenes/instanceDoor.js', import.meta.url), 'utf8'), /const c = site\?\.siteType === SITE_TYPES\.Dungeon \? \(deps\.castle\?\.\(site\) \?\? null\) : null;/);
});

test('DOMAIN2 THE THRONE ROOM: its holder\'s banners, board and chest stand in the public castle and in the holder\'s own instance at the epoch its view names - never in another instance, as a quest\'s private castle (mutants: the instance gate; the epoch; the guild)', () => {
  const seat = { key: CASTLE_WAYREST, tier: 'crown', region: 23, holder: { guild: { id: G, name: 'Ebon Oath', tag: 'EO', heraldry: null } } };
  let guild = { id: G, rank: 0, castles: [{ region: 23, key: CASTLE_WAYREST, epoch: 'aabbccdd', paid: 120_000 }] };
  const halls = createSeatHallHost({ seatHere: (k) => (k === CASTLE_WAYREST ? seat : null), guild: () => guild });
  assert.equal(halls.crown(CASTLE_WAYREST)?.member, true, 'the public castle');
  assert.equal(halls.crown(CASTLE_WAYREST, { owner: 'x', epoch: 'aabbccdd' })?.member, true, 'the holder\'s own');
  assert.equal(halls.crown(CASTLE_WAYREST, { owner: 'x', epoch: 'ffffffff' }), null, 'a quest\'s private castle');
  assert.deepEqual(halls.castleAt(CASTLE_WAYREST), { guild: G, key: CASTLE_WAYREST, epoch: 'aabbccdd', region: 23 });
  guild = { id: OTHER, rank: 0, castles: [] };
  assert.equal(halls.crown(CASTLE_WAYREST, { owner: 'x', epoch: 'aabbccdd' }), null);
  assert.equal(halls.castleAt(CASTLE_WAYREST), null);
  const m = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(m, /host\.seatHall\?\.crown\?\.\(\(dungeonLoc\.mapTableData\?\.mapId \?\? 0\) >>> 0, placeInstance\)/, 'the modes host hands the room\'s instance over');
});

test('DOMAIN2 THE WINDOW\'S WORDS: the castle\'s price, both refunds and its door said before any press; the ledger names a castle bought, given up and lost (mutants: the price said; the words)', () => {
  assert.match(guildCastleText.none(), /120,000 silver/);
  assert.equal(guildCastleText.name('Wayrest'), 'Castle Wayrest');
  assert.match(guildCastleText.rule('Wayrest', '60,000', '102,000'), /If the crown is lost, 60,000 silver comes home; given up now, 102,000\./);
  assert.equal(guildSilverLineText({ raw: 'castle', out: true, amount: 120_000, who: 'Horst' }), 'The guild bought a castle for 120,000 silver');
  assert.equal(guildSilverLineText({ raw: 'castle-lost', out: false, amount: 60_000, who: null }), 'The guild lost a castle with its crown, and got back 60,000 silver');
});

test('AUDIT DOMAINS THE CASTLE\'S HOLES: a crown\'s new holder is offered its castle without the old holder\'s read, and the Turning releases it; a sale with a full treasury is refused `marks-full` (never a 500), the castle kept; a purchase asked again after its sale is its repeat; a sale asked again says what came home; a crown lost between the sale\'s release and its batch is released at half, never sold; a castle act waits while another holds the Turning (mutants: the global release; the zero line; the burn line\'s repeat; the repeat\'s refund; the held guard; the lease)', async (t) => {
  const s = await stood(t);
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const sh = await s.guild('Gamal', 'Silver Hand', 'SH');
  s.hold(WAYREST, eo.gid);
  s.treasury(eo.gid, 120_000);
  assert.equal((await s.buy(eo.gm, 23)).status, 200);
  s.lose(WAYREST);
  s.hold(WAYREST, sh.gid);
  assert.deepEqual((await s.mine(sh.gm)).castleOffers, [{ region: 23, key: WAYREST.key, price: CASTLE_PRICE }], 'S2: the old holder never read, and the new one is offered it');
  assert.equal(s.castle(23), null);
  assert.equal(s.silver(eo.gid), 60_000, 'and the old holder had its half');
  assert.match(readFileSync(new URL('../../server-account/src/seatTurning.js', import.meta.url), 'utf8'), /try \{ await releaseCastles\(db, nowS\); \} catch/, 'S2: every Turning releases');
  // S5: bought, given up, the purchase asked again - its repeat, nothing burnt
  s.treasury(sh.gid, 120_000);
  const r1 = rid();
  assert.equal((await s.buy(sh.gm, 23, r1)).status, 200);
  const sale = rid();
  const sold = await s.sell(sh.gm, 23, sale);
  assert.equal(sold.body.back, 102_000);
  const again = await s.buy(sh.gm, 23, r1);
  assert.deepEqual([again.status, again.body.repeat, s.castle(23), s.silver(sh.gid)], [200, true, null, 102_000]);
  // C3: the sale asked again says what came home
  const soldAgain = await s.sell(sh.gm, 23, sale);
  assert.deepEqual([soldAgain.body.repeat, soldAgain.body.back], [true, 102_000]);
  // S4: a treasury full to the brim gives up nothing - refused, the castle kept, never a 500
  s.treasury(sh.gid, 120_000);
  assert.equal((await s.buy(sh.gm, 23)).status, 200);
  s.treasury(sh.gid, 10_000_000 - s.silver(sh.gid));
  const full = await s.sell(sh.gm, 23);
  assert.deepEqual([full.status, full.body.error, !!s.castle(23)], [409, 'marks-full', true]);
  // S6: the crown lost between the sale's release and its batch - released at half, never sold
  s.raw.prepare("INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid) VALUES ('guild', ?, 'burn', NULL, 'test', 5000000, 1, 1, 'seed', NULL, 'drain-sh')").run(sh.gid);
  const db = s.svc.env.DB, batch = db.batch.bind(db);
  db.batch = async (stmts) => { s.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(WAYREST.key); db.batch = batch; return batch(stmts); };
  const raced = await s.sell(sh.gm, 23);
  assert.equal(raced.body.error, 'castle-not-yours');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'castle-sale' AND dst_id = ?").get(sh.gid).n, 1, 'the one sale before, none now');
  assert.equal(s.raw.prepare("SELECT amount FROM marks_ledger WHERE kind = 'castle-lost' AND dst_id = ? ORDER BY rowid DESC").get(sh.gid).amount, 60_000);
  // R2: a crown held at a key no castle stands on (the relay admits no guild there) sells none
  const df = await s.guild('Dara', 'Dawn Fang', 'DF');
  s.raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (5017, ?, 17, 'crown', ?, 50, NULL, ?, 0, 0)`).run(df.gid, W - 1, T0 - 7 * DAY);
  s.treasury(df.gid, 130_000);
  assert.equal((await s.buy(df.gm, 17)).body.error, 'castle-none');
  assert.deepEqual((await s.mine(df.gm)).castleOffers, [], 'and none offered');
  // S6: while another holds the Turning a castle act is asked again in a moment
  s.raw.prepare('DELETE FROM town_seat_weeks').run();
  _resetWeeksKept();   // the week this isolate read settled, forgotten: it is due again
  s.raw.prepare('INSERT INTO town_seat_settling (id, holder, until) VALUES (1, ?, ?)').run('another', T0 + 3600);
  const waiting = await s.buy(sh.gm, 23);
  assert.deepEqual([waiting.status, waiting.body.error], [503, 'seats-settling']);
});
