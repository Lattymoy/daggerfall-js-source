// AUDIT PRE-MERGE 1003 (2026-10-03) - lens WD, WD3's half of PR 545: Beautiful Villages and Beautiful Cities, and the
// housing promise. A guild's hall is a home (a row of `homes`, GUILD1d), so it is bought in its town's layout, as a
// home's claim is - stored with it, refused in another, asked to update from a build that says none, kept to one layout
// in its own write - and the client asks it as it asks a claim, behind the same gates; and a quest's building site
// chosen again in a town that moved carries what was ASSIGNED to its markers, never the old building's markers. The
// record: AUDIT PRE-MERGE 1003's WD lens, and bible/03-World/Beautiful-Towns.md.
//
// Each test failed on the unfixed tree for its finding's reason: a hall bought in a Villages town was stored as
// Daggerfall's own and `/v1/homes/layouts` answered `[[town, null]]`; a Cities hall in a Villages town, and a hall that
// named no layout, were both seated (200); a hall bought after a Villages home flipped the town to Daggerfall's own once
// the home was sold; the client posted no layout and bought before the towns were heard (WD1); a reseated quest site
// kept the old building's marker, standing its person at the old building's coordinates, and lost what stood at its
// numbered markers (WD2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { standService, T0 } from './accountDb.mjs';
import { realmJoinAt } from './realmSeat.mjs';
import { guildHallPrice } from '../src/net/hallLaw.js';
import { HOME_CLAIMS_MAX } from '../src/net/homeLaw.js';
import { accountGuilds, accountRefusalText } from '../src/net/accountClient.js';
import { GuildBook } from '../src/net/guildBook.js';
import { hallBoughtLine, hallShortLine } from '../src/systems/onlineHomes.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BV = 'beautiful-villages@1.4.2', BOTH = 'beautiful-cities@0.5.0+beautiful-villages@1.4.2';
const TOWN = 1291010263;

/** Gwen's guild, 90,000 of realm gold in its treasury - a hall at 20,000 costs 30,000. */
async function stood() {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const raw = svc.env.DB._raw;
  raw.prepare("UPDATE guilds SET treasury = 90000, realm_gold = 90000, moved_by = 'x', moved_at = 1").run();
  const buy = (over = {}) => svc.call('/v1/guilds/hall/buy', { character: gm.character, mapId: TOWN, buildingKey: 0x10203, region: 17, price: 20_000, ...over }, gm.secret);
  const treasury = () => raw.prepare('SELECT treasury FROM guilds').get().treasury;
  const layoutOf = (key, mapId = TOWN) => raw.prepare('SELECT layout FROM homes WHERE map_id = ? AND building_key = ?').get(mapId, key)?.layout;
  const guest = (await svc.guest()).secret;
  const towns = async () => (await svc.call('/v1/homes/layouts', {}, guest)).body.towns;
  return { svc, gm, raw, buy, treasury, layoutOf, towns };
}

test('AUDIT PRE-MERGE 1003 WD1: a guild\'s hall is bought in its town\'s layout - bought first in a Villages town it keeps the town Villages for every client (`/v1/homes/layouts`), and a home claimed there after it in Daggerfall\'s own layout is refused for the hall\'s town; the unfixed service stored the hall as Daggerfall\'s own (NULL) and told every client to stand the town classic (mutants: the layout unwritten; the COALESCE dropped)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, buy, layoutOf, towns } = await stood();
  const r = await buy({ layout: BV });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(layoutOf(0x10203), BV, 'the hall keeps the layout its town stood in');
  assert.deepEqual(await towns(), [[TOWN, BV]], 'and every client stands the town so - never Daggerfall\'s own');
  // the hall decides the town for the homes after it, as a town's first home does
  const aldric = await svc.registered('Aldric');
  const classic = await svc.seatHome(aldric, { mapId: TOWN, buildingKey: 0x10305, region: 17, price: 42_000, layout: null });
  assert.deepEqual([classic.status, classic.body?.error, classic.body?.layout], [409, 'home-layout', BV]);
  const villages = await svc.seatHome(aldric, { mapId: TOWN, buildingKey: 0x10305, region: 17, price: 42_000, layout: 'beautiful-villages@1.4.3' });
  assert.equal(villages.status, 200, JSON.stringify(villages.body));
  assert.equal(layoutOf(0x10305), BV, 'a later home takes the town\'s own stamp');
  // a hall in Daggerfall's own town stays Daggerfall's own
  const raw = svc.env.DB._raw;
  raw.prepare('DELETE FROM homes WHERE guild_id IS NOT NULL').run();
  assert.equal((await buy({ mapId: TOWN + 1, buildingKey: 5, layout: null })).status, 200);
  assert.equal(layoutOf(5, TOWN + 1), null);
  assert.deepEqual(await towns(), [[TOWN, BV], [TOWN + 1, null]]);
});

test('AUDIT PRE-MERGE 1003 WD1: a hall in ANOTHER layout of a town that holds homes is refused 409 `home-layout` naming the town\'s (as `/v1/homes/claim` answers), before the hour\'s claims count it; a hall that names no layout at all is a build from before the town mods (426 `home-update`), a stamp the law does not take is `bad-home` - none of them pays or seats anything; the unfixed service seated each (mutants: the town unasked before the hour; the 426 unasked; the stamp unchecked; the route\'s layout unsaid; home-update\'s status)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, buy, treasury, layoutOf, raw } = await stood();
  const mara = await svc.registered('Mara');
  assert.equal((await svc.seatHome(mara, { mapId: TOWN, buildingKey: 0x10305, region: 17, price: 42_000, layout: BV })).status, 200);
  now += 60;
  const before = treasury();
  const crossed = await buy({ layout: BOTH });
  assert.deepEqual([crossed.status, crossed.body?.error, crossed.body?.layout], [409, 'home-layout', BV], 'refused, and told the town\'s layout');
  const classic = await buy({ layout: null });
  assert.deepEqual([classic.status, classic.body?.error, classic.body?.layout], [409, 'home-layout', BV], 'Daggerfall\'s own town is another layout too');
  // AUDIT WD3 B8's law: refused for the town's layout BEFORE the hour's claims count it - the client hears the town and
  // buys once more, which a counted refusal would leave rate-limited
  for (let i = 0; i < HOME_CLAIMS_MAX + 2; i++) assert.equal((await buy({ layout: BOTH })).body?.error, 'home-layout');
  const old = await buy();
  assert.deepEqual([old.status, old.body?.error], [426, 'home-update'], 'a build from before the town mods: its key may name a stranger\'s building');
  const bad = await buy({ layout: 'classic' });
  assert.deepEqual([bad.status, bad.body?.error], [400, 'bad-home']);
  assert.equal((await buy({ layout: 'detailed-ships@1.0.0' })).body?.error, 'bad-home', 'a mod that moves no building');
  assert.equal(treasury(), before, 'nothing paid');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes WHERE guild_id IS NOT NULL').get().n, 0, 'nothing seated');
  // the same town in its own layout: bought, the town's stamp kept
  const ok = await buy({ layout: 'beautiful-villages@1.4.3' });
  assert.equal(ok.status, 200, `never home-rate after the refusals: ${JSON.stringify(ok.body)}`);
  assert.equal(layoutOf(0x10203), BV);
  assert.equal(treasury(), before - guildHallPrice(20_000));
});

test('AUDIT PRE-MERGE 1003 WD1: a Villages home and then a hall in its town - the home sold, the town is still Villages: the unfixed hall was stored NULL, became the town\'s oldest row, and flipped it to Daggerfall\'s own for every client (mutants: the layout unwritten)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, buy, towns } = await stood();
  const aldric = await svc.registered('Aldric');
  const a = await svc.seatHome(aldric, { mapId: TOWN, buildingKey: 0x10305, region: 17, price: 42_000, layout: BV });
  assert.equal(a.status, 200);
  now += 60;
  assert.equal((await buy({ layout: BV })).status, 200);
  assert.deepEqual(await towns(), [[TOWN, BV]]);
  assert.equal((await svc.call('/v1/homes/release', { mapId: TOWN, buildingKey: 0x10305, realm: await realmJoinAt(svc.env, aldric.secret, a.character) }, aldric.secret)).status, 200);
  assert.deepEqual(await towns(), [[TOWN, BV]], 'the hall holds the town in the layout it was bought in');
});

test('AUDIT PRE-MERGE 1003 WD1: the hall\'s ONE write keeps its town in one layout (AUDIT WD3 R5\'s law) - a first home in another layout landed between the hall\'s check and its batch: the hall seats nothing, pays nothing, and is answered `home-layout` naming the town\'s (mutants: the write\'s guard; the raced answer)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, gm, raw, buy, treasury } = await stood();
  const RACE = TOWN + 7;
  const orig = svc.env.DB.batch.bind(svc.env.DB);
  let fired = false;
  svc.env.DB.batch = async (list) => {
    if (!fired) {
      fired = true;
      raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, layout) VALUES (?, 5, ?, 'char-x', 'X', 17, 'private', 1, ?, 0, ?)`).run(RACE, gm.id, T0, BOTH);
    }
    return orig(list);
  };
  const before = treasury();
  const lost = await buy({ mapId: RACE, buildingKey: 6, layout: BV });
  assert.ok(fired, 'the race ran');
  assert.deepEqual([lost.status, lost.body?.error, lost.body?.layout], [409, 'home-layout', BOTH]);
  assert.equal(treasury(), before, 'the treasury moved with the hall: neither');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM homes WHERE map_id = ?').get(RACE).n, 1, 'one layout in the town');
});

test('AUDIT PRE-MERGE 1003 WD1 the client: the hall\'s post says its town\'s layout (null for Daggerfall\'s own), and the guild book passes it through; the layout a hall says is a claim\'s own (onlineHomes.js homeClaimLayout - the town\'s stamp, none for the classic town) (mutants: the body\'s layout; the book dropping it; classic sent as a stamp)', async () => {
  const { homeClaimLayout } = await import('../src/systems/onlineHomes.js');
  const { configureLayoutPins, _resetLayoutPins } = await import('../src/systems/layoutPins.js');
  try {
    _resetLayoutPins();
    configureLayoutPins({ vendorOn: (v) => v === 'beautiful-villages', vendorVersion: () => '1.4.2', locationKeyOfMapId: () => 4242 });
    assert.equal(homeClaimLayout(TOWN), BV);
    configureLayoutPins({ vendorOn: () => false });
    assert.equal(homeClaimLayout(TOWN), null, 'Daggerfall\'s own town: no stamp, never "classic"');
  } finally { _resetLayoutPins(); }
  assert.match(src('src/systems/onlineHomes.js'), /const layout = homeClaimLayout\(mapId\);/, 'a home\'s claim says it the same way');
  const seen = [];
  const store = { getItem: () => JSON.stringify({ secret: 's', id: 'p' }) };
  const door = accountGuilds({ fetch: async (url, init) => { seen.push([String(url).replace(/^.*\/v1/, '/v1'), JSON.parse(init.body)]); return new Response('{}', { status: 200 }); }, storage: store });
  await door.hallBuy({ character: 'rabc', mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: BV });
  await door.hallBuy({ character: 'rabc', mapId: 7, buildingKey: 300, region: 17, price: 20_000 });
  assert.deepEqual(seen.map((s) => s[1].layout), [BV, null], 'always said - a hall that says none is an old build\'s');
  assert.ok(seen.every((s) => Object.hasOwn(s[1], 'layout')));
  const calls = [];
  const guild = { id: 'g0123456789', name: 'The Hand', tag: 'HND', rank: 0, members: [], ledger: [], hall: null };
  const book = new GuildBook({
    door: { mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }), hallBuy: async (b) => { calls.push(b); return { ok: true, data: {} }; } },
    character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }),
  });
  await book.refresh();
  await book.buyHall({ mapId: 7, buildingKey: 300, region: 17, price: 20_000, layout: BV });
  assert.equal(calls[0].layout, BV);
});

/** worldModes.js buyHallAt, lifted out and run over a host the test holds (AUDIT MERGE-PLUS A1's lift). */
function liftBuyHallAt() {
  const WM = src('src/scenes/worldModes.js');
  const at = WM.indexOf('  function buyHallAt(bd, price) {');
  assert.ok(at > 0, 'the host\'s hall buy');
  const body = WM.slice(at, WM.indexOf('\n  }\n', at) + 4);
  return new Function('host', 'homeIdOf', '_hallBuying', 'hallGuild', 'homeTownOf', 'townTalk', 'hallBoughtLine', 'hallShortLine', 'guildHallPrice',
    'accountRefusalText', 'homeClaimLayout', `${body}\nreturn buyHallAt;`);
}

test('AUDIT PRE-MERGE 1003 WD1 the host: the door\'s hall buy (worldModes.js buyHallAt, lifted out) posts NOTHING before the room\'s homes\' towns are heard, or where a town mod\'s pack did not load here - buyHomeAt\'s own gates, said in its words and the towns asked again; heard, it posts its town\'s layout, and a refusal for the town\'s layout hears them again (mutants: either gate; the layout unsent; the refusal not heard again)', async () => {
  const posts = [], said = [];
  let heard = false, missing = false, asks = 0, answer = { ok: true };
  const host = {
    homeLayoutsHeard: () => heard, homeTownsMissing: () => missing, hearHomeLayouts: () => { asks++; },
    guildHall: { buy: async (o) => { posts.push(o); return answer; } },
    onlineHomes: { ensure: () => {} },
  };
  const press = liftBuyHallAt()(host, (b) => `${b.townMapId}:${b.buildingKey}`, new Set(), () => ({ name: 'The Hand' }), (b) => b.townMapId,
    { say: (l) => said.push(l) }, hallBoughtLine, hallShortLine, guildHallPrice, accountRefusalText, (mapId) => (mapId === TOWN ? BV : null));
  const bd = { townMapId: TOWN, buildingKey: 0x10203, regionIndex: 17 };
  const go = async () => { press(bd, 20_000); await new Promise((res) => { setImmediate(res); }); };
  await go();
  assert.deepEqual(posts, [], 'not heard: nothing posted');
  assert.deepEqual(said, [accountRefusalText('home-layout')]);
  assert.equal(asks, 1, 'and the towns asked again');
  heard = true; missing = true;
  await go();
  assert.deepEqual(posts, [], 'a town mod\'s pack missing here: nothing posted');
  assert.equal(said.at(-1), accountRefusalText('home-towns'));
  missing = false;
  await go();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].layout, BV, 'the town\'s layout, as a home\'s claim says it');
  answer = { ok: false, error: 'home-layout' };
  await go();
  assert.equal(posts.length, 2);
  assert.equal(asks, 2, 'refused for the town\'s layout: the towns heard again');
  assert.equal(said.at(-1), accountRefusalText('home-layout'));
});

/** A quest whose building site in Aldleigh (map 1001) was chosen while the village stood in Beautiful Villages, the
 *  village Daggerfall's own now - its victim placed at the site's default marker (a spawn marker), its thug "at marker
 *  2" and its letter "at item marker 1"; `next` the building the place's own law chooses again. */
async function movedSite(next) {
  const { QuestMachine } = await import('../src/systems/quest/machine.js');
  const { Place, SITE_TYPES, MARKER_TYPES } = await import('../src/systems/quest/place.js');
  const { loadQuestTables } = await import('../src/systems/quest/tables.js');
  const { configureLayoutPins, _resetLayoutPins } = await import('../src/systems/layoutPins.js');
  const T = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
  { const s = {}; for (const f of readdirSync(T)) if (f.endsWith('.txt')) s[f.replace('.txt', '')] = readFileSync(new URL(f, T), 'utf8').replace(/^﻿/, ''); loadQuestTables(s); }
  _resetLayoutPins();
  configureLayoutPins({ vendorOn: () => false, locationKeyOfMapId: (id) => (id === 1001 ? 4242 : null) });   // the village Daggerfall's own now
  const m = new QuestMachine();
  const quest = m.parseQuestForLists(['Quest: __QRS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'], 0, { rolls: () => 0 });
  m.startQuestImmediate(quest);
  const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
  quest.resources.set('victim', { symbol: sym('victim'), isPerson: true, parentQuest: quest });
  quest.resources.set('thug', { symbol: sym('thug'), isFoe: true, parentQuest: quest });
  quest.resources.set('letter', { symbol: sym('letter'), isItem: true, parentQuest: quest });
  const place = new Place(quest); place.symbol = sym('house'); place.p1 = 0; place.p2 = 17; place.p3 = 0;
  const at = (type, xs) => (xs ? xs.map((x) => place._createQuestMarker(type, { x, y: 0, z: x })) : null);
  const S = MARKER_TYPES.QuestSpawn, I = MARKER_TYPES.QuestItem;
  place.siteDetails = {
    siteType: SITE_TYPES.Building, mapId: 1001, regionIndex: 17, locationName: 'Aldleigh', buildingKey: 0x10203, magicNumberIndex: 0,
    selectedMarker: { targetResources: null }, questSpawnMarkers: at(S, [100, 110, 120]), questItemMarkers: at(I, [200, 210]), layout: 'beautiful-villages@1.4.2',
  };
  quest.resources.set('house', place);
  m.createSiteLink(quest, place.symbol);
  place.assignQuestResource(sym('victim'));       // the default marker: a spawn marker of the old building
  place.assignQuestResource(sym('thug'), 2);      // "at marker 2"
  place.assignQuestResource(sym('letter'), 1);    // "at item marker 1"
  const was = place.siteDetails;
  const [spawn, item] = next;
  place._collectQuestSitesOfBuildingType = () => [{
    siteType: SITE_TYPES.Building, mapId: 1001, regionIndex: 17, locationName: 'Aldleigh', buildingKey: 0x20101, buildingName: 'The Penrose Residence', magicNumberIndex: 0,
    selectedMarker: { targetResources: null }, questSpawnMarkers: at(S, spawn), questItemMarkers: at(I, item),
  }];
  const w = { maps: { getRegion: () => ({ mapNameLookup: new Map([['Aldleigh', 3]]) }), getLocation: () => ({ name: 'Aldleigh', exterior: { exteriorData: {} } }) } };
  return { m, place, was, w, S, I, done: _resetLayoutPins };
}
const targetsOf = (mk) => (mk?.targetResources ?? []).map((s) => s.name);

test('AUDIT PRE-MERGE 1003 WD2: a quest\'s building site chosen again in a town that moved carries its ASSIGNMENTS onto the new building\'s own markers - the person placed at the default marker stands at one of the new building\'s marker positions (the unfixed reseat kept the old building\'s marker, in the old interior\'s frame: in a wall, outside the rooms), and what stood "at marker N" is still on the site, at the new building\'s marker N or, where it has none, at the selected marker (the unfixed reseat dropped it) (mutants: the old marker kept; the numbered targets dropped; the overflow dropped)', async () => {
  const { markerScenePosition } = await import('../src/systems/quest/sceneMount.js');
  const { m, place, was, w, S, done } = await movedSite([[5, 6], [7, 8]]);
  try {
    const pos = (mk) => { const p = markerScenePosition(mk); return `${p.x},${p.y},${p.z}`; };
    assert.equal(pos(was.selectedMarker), '100,0,100', 'the old site: its person at the old building\'s first spawn marker');
    assert.deepEqual([targetsOf(was.questSpawnMarkers[2]), targetsOf(was.questItemMarkers[1])], [['thug'], ['letter']]);
    assert.equal(m.reseatMovedSites(w), 1);
    const sd = place.siteDetails;
    assert.equal(sd.buildingKey, 0x20101);
    assert.ok(sd.questSpawnMarkers.map(pos).includes(pos(sd.selectedMarker)), `the person stands at the new building's own marker - ${pos(sd.selectedMarker)}, never the old building's`);
    assert.equal(sd.selectedMarker.markerType, S, 'a spawn marker, as the old one was');
    assert.equal(targetsOf(sd.selectedMarker)[0], 'victim', 'the selected marker names the one placed by default');
    // every marker the mount walks (sceneMount.js addQuestResourceObjects: the selected and the spawn markers), and the item markers
    const targeted = [sd.selectedMarker, ...sd.questSpawnMarkers, ...sd.questItemMarkers].flatMap(targetsOf);
    for (const n of ['victim', 'thug', 'letter']) assert.ok(targeted.includes(n), `${n} still targeted on the site`);
    assert.ok(targetsOf(sd.selectedMarker).includes('thug'), 'marker 2 is none of the new building\'s: its thug at the selected marker');
    assert.deepEqual(targetsOf(sd.questItemMarkers[1]), ['letter'], 'item marker 1 is the new building\'s item marker 1');
    assert.ok([...sd.questSpawnMarkers, ...sd.questItemMarkers].every((mk) => [5, 6, 7, 8].includes(mk.flatPosition.x)), 'the new building\'s markers, in its own frame');
    assert.equal('layout' in sd, false, 'stamped in the layout it stands in now');
    assert.equal(m.reseatMovedSites(w), 0, 'and stands');
  } finally { done(); }
});

test('AUDIT PRE-MERGE 1003 WD2: a selected ITEM marker is carried to an item marker, or a spawn marker where the new building has none (_getSiteMarker\'s fallback); marker N kept at the new building\'s marker N; a building with no marker at all is no site, and the record is left as it was (mutants: the type unread; the fallback unread; the markerless building taken)', async () => {
  const { markerScenePosition } = await import('../src/systems/quest/sceneMount.js');
  const itemSelected = (was) => { was.selectedMarker = { ...was.questItemMarkers[0], targetResources: [{ name: 'letter', original: '_letter_' }] }; };
  {
    const { m, place, was, w, done } = await movedSite([[5, 6, 9], [7]]);
    try {
      itemSelected(was);
      assert.equal(m.reseatMovedSites(w), 1);
      assert.equal(markerScenePosition(place.siteDetails.selectedMarker).x, 7, 'an item marker for an item marker');
      assert.deepEqual(targetsOf(place.siteDetails.questSpawnMarkers[2]), ['thug'], 'marker 2 is the new building\'s marker 2');
    } finally { done(); }
  }
  {
    const { m, place, was, w, done } = await movedSite([[5], null]);
    try {
      itemSelected(was);
      assert.equal(m.reseatMovedSites(w), 1);
      assert.equal(markerScenePosition(place.siteDetails.selectedMarker).x, 5, 'no item marker there: a spawn marker');
      assert.ok(targetsOf(place.siteDetails.selectedMarker).includes('letter'));
    } finally { done(); }
  }
  {
    const { m, place, was, w, done } = await movedSite([null, []]);
    try {
      assert.equal(m.reseatMovedSites(w), 0, 'no marker to carry its people and things to');
      assert.equal(place.siteDetails, was, 'the record as it was');
    } finally { done(); }
  }
});
