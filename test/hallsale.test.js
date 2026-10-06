// GUILD-HALL-SALE (2026-10-06, asked: "Guild houses should be able to be sold, like regular houses"): A GUILD'S HALL SOLD
// AT ITS OWN DOOR, AS A HOME IS. The sale stood on the Guild tab alone (GUILD1d); the hall's door now lists "Sell it" to
// whom the service lets sell it (`hallSell` on the town's answer - its guildmaster), on the plaque and in Info's menu,
// asks first at what it pays the treasury, and sells THAT building: the service refuses a hall standing anywhere else
// (`guild-hall-moved`). Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs),
// the door's law, the client's registry and the guild book's door; the hosts by source. bible/06-Systems/Online-Arc.md
// GUILD-HALL-SALE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { homeSaleRefund } from '../src/net/homeLaw.js';
import { guildHallPrice } from '../src/net/hallLaw.js';
import {
  HOME_VERB, HALL_VERB, homeHallRows, hallSellable, hallManaged, hallEntryTurnable, homeDoorPrompt, hallOwnerLines, hallSaleLines,
  hallSoldLine, createOnlineHomes,
} from '../src/systems/onlineHomes.js';
import { GuildBook } from '../src/net/guildBook.js';
import { accountGuilds, SESSION_KEY } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HALL = { mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: null };
const PAID = guildHallPrice(HALL.price);

/** A guild of three - Gwen its guildmaster (a realm character, the treasury filled on her record), Otto an Officer, Rhea a
 *  Recruit - and its hall bought at HALL. */
async function stood() {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 60_000, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
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
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  const town = async (who) => (await svc.call('/v1/homes/town', { mapId: HALL.mapId, character: who.character }, who.secret)).body.homes.find((h) => h.buildingKey === HALL.buildingKey);
  return { svc, gm, officer, recruit, view, town, raw: svc.env.DB._raw };
}

test('GUILD-HALL-SALE the service: the town tells the guildmaster - alone - that the hall is theirs to sell and what it pays (the deed share of what the treasury paid); sold at its door it sells THAT building - one standing anywhere else is the hall moved, nothing sold; a door naming no building is the Guild tab\'s sale, as before (mutants: hallSell to every rank; the refund off the price; the door\'s building unasked)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, officer, recruit, view, town, raw } = await stood();
  // who is told
  const asGm = await town(gm);
  assert.deepEqual([asGm.hallSell, asGm.refund], [true, homeSaleRefund(PAID)], 'the guildmaster: "Sell it", at the deed share of what the treasury paid');
  for (const who of [officer, recruit]) {
    const h = await town(who);
    assert.ok(!('hallSell' in h) && !('refund' in h), `${who === officer ? 'an Officer' : 'a Recruit'} sells nothing and learns nothing of what was paid`);
  }
  // the door's building, held to the hall's own
  const sell = (body) => svc.call('/v1/guilds/hall/sell', { character: gm.character, ...body }, gm.secret);
  const wrong = await sell({ mapId: HALL.mapId, buildingKey: HALL.buildingKey + 1 });
  assert.deepEqual([wrong.status, wrong.body.error], [409, 'guild-hall-moved'], 'a door naming another building sells nothing');
  assert.deepEqual([(await sell({ mapId: HALL.mapId + 1, buildingKey: HALL.buildingKey })).body.error], ['guild-hall-moved'], 'nor another town\'s');
  assert.equal((await sell({ mapId: HALL.mapId, buildingKey: -1 })).body.error, 'bad-home');
  assert.ok(raw.prepare('SELECT 1 FROM homes WHERE guild_id IS NOT NULL').get(), 'the hall stands');
  const byOfficer = await svc.call('/v1/guilds/hall/sell', { character: officer.character, mapId: HALL.mapId, buildingKey: HALL.buildingKey }, officer.secret);
  assert.equal(byOfficer.body.error, 'guild-rank', 'an Officer sells no hall at its door either');
  // the guildmaster at the hall's own door
  const before = (await view()).treasury;
  const sold = await sell({ mapId: HALL.mapId, buildingKey: HALL.buildingKey });
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.deepEqual([sold.body.refund, sold.body.back], [homeSaleRefund(PAID), homeSaleRefund(PAID)], 'the deed share - no pieces in it');
  assert.equal((await view()).treasury, before + homeSaleRefund(PAID), 'into the treasury');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes').get().n, 0, 'the building free again');
  // the Guild tab's sale names no building - the guild's one hall, as before
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret)).status, 200, 'the tab\'s sale, unchanged');
});

test('GUILD-HALL-SALE the door\'s law: a hall\'s rows list "Sell it" to whom the service lets sell it, and Info opens its menu to whom may turn or sell it; the sale asks first at what it pays (mutants: the row to every member; the menu to a plain member; the row\'s gate and the press\'s apart)', () => {
  const hall = (over = {}) => ({ hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null }, member: true, entry: 'guild', refund: 25_500, ...over });
  const gm = hall({ hallEntry: true, hallSell: true });
  assert.deepEqual(homeHallRows(gm, 'enter').map((r) => [r.id, r.label]), [[HOME_VERB.enter, 'Go in'], [HALL_VERB.entry, 'Who may enter: Members'], [HALL_VERB.sell, 'Sell it']]);
  assert.deepEqual(homeHallRows(hall({ hallEntry: true }), 'enter').map((r) => r.id), [HOME_VERB.enter, HALL_VERB.entry], 'an Officer: no sale');
  assert.deepEqual(homeHallRows(hall(), 'enter').map((r) => r.id), [HOME_VERB.enter], 'a member: the door alone');
  assert.equal(homeHallRows(gm, 'locked'), null, 'a door shut on me lists nothing');
  assert.deepEqual([hallSellable(gm), hallSellable(hall({ hallSell: 'yes' })), hallSellable({ hallSell: true }), hallSellable(null)], [true, false, false, false]);
  assert.deepEqual([hallManaged(gm), hallManaged(hall({ hallEntry: true })), hallManaged(hall())], [true, true, false]);
  assert.equal(hallEntryTurnable(gm), true);
  // Info at a hall I may turn or sell is its menu; any other mode walks in; a plain member's press is the way in
  for (const [mode, want] of [['info', 'hall-menu'], ['grab', null], ['talk', null], ['steal', null]]) {
    assert.equal(homeDoorPrompt({ door: 'enter', mode, hallMenu: true }), want, `${mode}`);
  }
  assert.equal(homeDoorPrompt({ door: 'enter', mode: 'info', hallMenu: false }), null, 'a member\'s Info press walks in');
  assert.equal(homeDoorPrompt({ door: 'enter', mode: 'info', hallMenu: true, asked: true }), null, 'the press that comes back from the menu goes on');
  assert.equal(homeDoorPrompt({ door: 'own', mode: 'info', hallMenu: true }), 'menu', 'my own home is my own menu still');
  // the words
  assert.deepEqual(hallOwnerLines(gm), ['This is the hall of The Silver Hand.', 'Who may enter: Members.']);
  assert.deepEqual(hallSaleLines(gm), [
    'Sell the hall of The Silver Hand for 25,500 gold, and half of what its placed pieces cost?',
    "The gold goes to the guild's treasury. The pieces go with the hall.",
    "The guild's vault stays the guild's.",
  ]);
  assert.equal(hallSoldLine('The Silver Hand', 25_560), "You sold the hall of The Silver Hand. 25,560 gold went to the guild's treasury.");
});

test('GUILD-HALL-SALE the client: the registry reads `hallSell` off the town; the guild book sells at the door\'s building, the Guild tab\'s sale naming none; the door posts the building (mutants: hallSell unread; the building dropped)', async () => {
  const api = { town: async () => ({ ok: true, data: { homes: [{ buildingKey: 300, owner: 'The Silver Hand', entry: 'guild', mine: false, hall: { name: 'The Silver Hand', tag: 'SH' }, member: true, hallEntry: true, hallSell: true, refund: 25_500 }] } }) };
  const homes = createOnlineHomes({ api, character: () => 'r0123456789abcdef0123' });
  await homes.ensure(7);
  const h = homes.homeAt(7, 300);
  assert.deepEqual([h.hallSell, h.refund, h.own], [true, 25_500, false], 'a hall is nobody\'s own home - its sale is its guild\'s');
  // the guild book's door
  const asked = [];
  const door = {
    hallSell: async (...a) => { asked.push(a); return { ok: true, data: { back: 25_500 } }; },
    mine: async () => ({ ok: true, data: { guild: null } }), invites: async () => ({ ok: true, data: { invites: [] } }),   // the look after an act
  };
  const book = new GuildBook({ door, character: () => 'r0123456789abcdef0123', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }) });
  const told = [];
  book.onHall = (m) => told.push(m);
  assert.equal((await book.sellHall({ mapId: 7, buildingKey: 300 })).ok, true);
  assert.deepEqual(asked[0], ['r0123456789abcdef0123', { mapId: 7, buildingKey: 300 }], 'the door\'s building');
  assert.deepEqual(told, [7], 'its town read again');
  assert.equal((await book.sellHall()).ok, true);
  assert.deepEqual(asked[1], ['r0123456789abcdef0123'], 'the tab\'s sale names none');
  // the account service's door posts it
  const posts = [];
  const session = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const guilds = accountGuilds({ fetch: async (u, i) => { posts.push([u, JSON.parse(i.body)]); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }, storage: { getItem: (k) => session.get(k) ?? null } });
  await guilds.hallSell('r0123456789abcdef0123', { mapId: 7, buildingKey: 300 });
  await guilds.hallSell('r0123456789abcdef0123');
  assert.deepEqual(posts.map(([u, b]) => [u.replace(/^.*\/v1/, '/v1'), b]), [
    ['/v1/guilds/hall/sell', { character: 'r0123456789abcdef0123', mapId: 7, buildingKey: 300 }],
    ['/v1/guilds/hall/sell', { character: 'r0123456789abcdef0123' }],
  ]);
});

test('GUILD-HALL-SALE the hosts, by source: the plaque\'s "Sell it" pressed opens the sale as the row\'s own gate allows; Info at a hall I manage opens its menu; the sale asks first and sells the door\'s building through the host, the town read again; the world hands the guild book\'s sale over (mutants: each wire cut)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(verb === HALL_VERB\.sell && hallSellable\(home\)\) \{ openHallSale\(bd, home\); return true; \}/, 'the press as the row');
  assert.match(m, /if \(prompt === 'hall-menu'\) \{ openHallMenu\(bd, home, hit, entries\); return true; \}/);
  assert.match(m, /\.\.\.\(hallSellable\(home\) \? \[\{ code: 'KeyS', label: 'S - sell it', action: \(\) => openHallSale\(bd, home\) \}\] : \[\]\),/, 'the menu sells as the row does');
  assert.match(m, /lines: hallSaleLines\(home\),\s*options: \[\s*\{ code: 'KeyY', label: 'Y - yes', action: \(\) => sellHallAt\(bd, home\) \},/, 'asked first');
  assert.match(m, /Promise\.resolve\(host\.guildHall\?\.sell\?\.\(\{ mapId, buildingKey: bd\.buildingKey \}\) \?\? \{ ok: false, error: 'no-guild' \}\)/, 'the door\'s building');
  assert.match(m, /if \(r\?\.ok \|\| r\?\.error === 'guild-hall-moved' \|\| r\?\.error === 'guild-hall-none'\) host\.onlineHomes\?\.ensure\?\.\(mapId, \{ force: true \}\);/);
  assert.match(src('src/scenes/world.js'), /sell: \(at\) => \(guildBook \? guildBook\.sellHall\(at\) : Promise\.resolve\(\{ ok: false, error: 'no-guild' \}\)\),/);
});
