// FIELD BUGS 2026-10-14 QUEST-HOME (Discord: "Currently on the final part of the quest to 'Travel to the second town
// named by the poisonmaker'. However coming to the location it has NPCs, but NO Houses, except for a player house which
// is marked as the residence I need for the quest, but it's just.. a player house..?" - Buckinghouse Farmstead, its one
// house "The Mesmerized Residence" on the map, its door "To <owner>'s home", Vote up, Vote down; the quest the Dark
// Brotherhood's The Acceptance Test, L0A01L00 - the poisonmaker its Chemist, the second town `_mansion_`'s). HOME1's rule - no quest
// picks a player's online home as its residence (systems/quest/place.js, the collector's isPlayerHome) - read the homes
// of the towns this page had ASKED, one at a time at a town's gate or door, and a quest's `remote` residence is picked in
// a town its player has never walked into: the rule held in the player's own town alone, and the farmstead's only house,
// a player's home, was the quest's. The layouts read every online boot already makes (WD3) now names every town's homes
// by building (server-account/src/homes.js homeLayouts' `homes`), the registry keeps it (systems/online/onlineHomes.js
// hearEveryTown / homeStands), and the quest machine's isPlayerHome asks it (scenes/world.js). Every fixture is the
// producer's: the real Worker over node:sqlite with every migration applied, the client's own door to it, the real
// registry, and the real quest machine choosing its residence in a region of synthetic blocks (test/fb1004dTowns.mjs).
// bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; 06-Systems/Online-Arc.md HOME1.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { realmJoinAt, seatRealm } from '../realmSeat.mjs';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { accountHomes, onHomeOrders, SESSION_KEY } from '../../src/net/accountClient.js';
import { OnlineSession } from '../../src/net/online.js';
import { SOCIAL_ROOM, RELAY_VERSION, parseClient, validHomeWord, validHomeFrame, HOME_RELAY_MIN, HOME_WORDS_KEY, HOME_WORDS_KEEP_MS } from '../../src/net/wire.js';
import { ORDER_KINDS, orderValid, mintHomeOrder, verifyOrder } from '../../src/net/identityToken.js';
import { createOnlineHomes } from '../../src/systems/online/onlineHomes.js';
import { HOME_KEYS_MAX, HOME_LAYOUTS_MAX, HOME_ORDER_KEYS_MAX } from '../../src/net/homeLaw.js';
import { QuestMachine } from '../../src/systems/quest/machine.js';
import { SITE_TYPES } from '../../src/systems/quest/place.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, questScript } from '../fb1004dTowns.mjs';
import { seeded } from '../fb1004dArena.mjs';

loadTables();
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const { House1, House3, Alchemist } = BUILDING_TYPES;
const FARM = 7101, VILLAGE = 7102, CITY = 7103;
const HOUSE = makeBuildingKey(0, 0, 0);   // each town's one house: block (0,0), record 0 - BuildingDirectory's 1<<24

/** The service with Aldric's home at the farmstead's only house and Mara's in a city, and a guest's client door to it. */
async function served(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const S = await standService();
  const aldric = await S.registered('Aldric'), mara = await S.registered('Mara');
  const farm = await S.seatHome(aldric, { mapId: FARM, buildingKey: HOUSE, region: 17, price: 42000 });
  assert.equal(farm.status, 200, JSON.stringify(farm.body));
  now += 60;
  for (const buildingKey of [0x10203, 0x101]) assert.equal((await S.seatHome(mara, { mapId: CITY, buildingKey, region: 17, price: 42000 })).status, 200);
  const api = accountHomes({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, await S.guest()) });
  return { S, api, aldric, farm, tick: () => { now += 60; } };
}

/** The registry as scenes/world.js builds it, its town asks counted - a farmstead never walked into is never asked. */
function registry(api) {
  const asked = [];
  const homes = createOnlineHomes({ api: { ...api, town: (mapId, c) => { asked.push(mapId); return api.town(mapId, c); } }, character: () => null });
  return { homes, asked };
}

test('QUEST-HOME the service and the registry: the layouts read every boot makes names each town\'s homes by building, ascending, to any session - a guest\'s too - beside the towns\' layouts; the registry keeps it, and a building is a home in a town this page never asked (homeAt, the old knowledge, knows nothing there); a town asked adds its own fresher word; a read from a service before it changes nothing; the next read replaces the last (mutants: the read names no homes; the boot\'s word not kept; homeStands asks the asked towns alone)', async (t) => {
  const { S, api, aldric, farm, tick } = await served(t);
  const read = await api.layouts();
  assert.equal(read.ok, true, JSON.stringify(read));
  assert.deepEqual(read.data.homes, [[FARM, [HOUSE]], [CITY, [0x101, 0x10203]]], 'every town holding a home, each home by building, ascending');
  assert.deepEqual(read.data.towns.map(([mapId]) => mapId), [FARM, CITY], 'the towns\' layouts as before (WD3)');
  assert.equal(HOME_KEYS_MAX, 3 * HOME_LAYOUTS_MAX);

  const { homes, asked } = registry(api);
  assert.equal(homes.homeStands(FARM, HOUSE), false, 'before the boot\'s read: nothing known');
  assert.equal(homes.hearEveryTown(read.data.homes), true);
  assert.equal(homes.homeStands(FARM, HOUSE), true, 'the farmstead\'s house is a player\'s home - in a town this page never asked');
  assert.equal(homes.homeAt(FARM, HOUSE), null, 'which homeAt, the towns asked one at a time, never knew');
  assert.deepEqual(asked, [], 'no town was asked');
  assert.equal(homes.homeStands(FARM, makeBuildingKey(0, 0, 1)), false, 'a building nobody owns is none');
  assert.equal(homes.homeStands(VILLAGE, HOUSE), false, 'nor the same key in a town holding no home');
  assert.equal(homes.homeStands(CITY, 0x101) && homes.homeStands(CITY, 0x10203), true);

  // a home bought after the boot's read, in a town asked at its gate: the town's own answer says it
  tick();
  assert.equal((await S.seatHome(aldric, { mapId: VILLAGE, buildingKey: HOUSE, region: 17, price: 42000 })).status, 200);
  assert.equal(homes.homeStands(VILLAGE, HOUSE), false, 'unknown until a read says it');
  assert.equal(await homes.ensure(VILLAGE), true);
  assert.equal(homes.homeStands(VILLAGE, HOUSE), true, 'the town asked adds its own word');

  // an answer from a service before it (no `homes`) is not taken - what was known stands
  assert.equal(homes.hearEveryTown(undefined), false);
  assert.equal(homes.homeStands(FARM, HOUSE), true);
  // the farmstead's home sold: the next read replaces the last
  tick();
  assert.equal((await S.call('/v1/homes/release', { mapId: FARM, buildingKey: HOUSE, realm: await realmJoinAt(S.env, aldric.secret, farm.character) }, aldric.secret)).status, 200);
  const again = await api.layouts();
  assert.deepEqual(again.data.homes, [[VILLAGE, [HOUSE]], [CITY, [0x101, 0x10203]]]);
  assert.equal(homes.hearEveryTown(again.data.homes), true);
  assert.equal(homes.homeStands(FARM, HOUSE), false, 'sold, and read again: a house again');
});

/** The village's buildings: room for every Place of the quest without the farmstead's house. */
const VILLAGE_TYPES = [House1, House1, House1, House1, House3, Alchemist, Alchemist];
/** The reporter's quest - the Dark Brotherhood's The Acceptance Test (L0A01L00): a letter sends the player to the
 *  poisonmaker (`_apothecary_`, a Chemist, at `Place _apo_ remote apothecary`), who sends them on to `_mansion_`
 *  (`Place _mansion_ remote house1`) "in __mansion_", the second town, to poison `_npc_`'s wine; its three people's
 *  homes are generated residences too (Person.cs AssignHomeTown, `Place _x_home_ remote house`). Taken under `seed`
 *  with the player out in the wilds of a region of two towns - Buckinghouse Farmstead, whose one house is `HOUSE`, and a
 *  village (VILLAGE_TYPES) - by the real machine handed `isPlayerHome`.
 *  Answers each Place's site. */
function acceptanceTest(isPlayerHome, seed) {
  const blocks = new Map([
    ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: House1 }])],
    ['VILLAGE.RMB', rmbBlock('VILLAGE.RMB', VILLAGE_TYPES.map((type) => ({ type })))],
  ]);
  const farm = town({ name: 'Buckinghouse Farmstead', locationIndex: 0, mapId: FARM, type: 3, grid: ['FARM.RMB'] });   // DFRegion.LocationTypes.HomeFarms
  const village = town({ name: 'Aldleigh', locationIndex: 1, mapId: VILLAGE, grid: ['VILLAGE.RMB'] });
  // the MAPS directory each names (SelectRemoteTownSite's pre-check for a house1 and an apothecary)
  farm.exterior.buildings = [{ buildingType: House1, nameSeed: 11, factionId: 0 }];
  village.exterior.buildings = VILLAGE_TYPES.map((buildingType, i) => ({ buildingType, nameSeed: 20 + i, factionId: 0 }));
  const world = { ...worldOf({ locations: [farm, village], blocks }), isPlayerHome };
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  const say = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {};
  let quest;
  try { quest = machine.parseQuestForLists(questScript('L0A01L00'), 0, { rolls: seeded(seed) }); } finally { console.log = say; console.warn = warn; }
  assert.ok(quest, `seed ${seed}: The Acceptance Test is made`);
  machine.startQuestImmediate(quest);
  const sites = [...quest.resources.values()].filter((r) => r.isPlace).map((p) => ({ name: p.symbol.name, ...p.siteDetails }));
  return { sites, machine, quest, world };
}
const inTheHome = (s) => s.siteType === SITE_TYPES.Building && s.mapId === FARM && s.buildingKey === HOUSE;
/** The type of the village's building at `key` (its one block, record `key & 0xff` - 0 spelt BuildingDirectory's 1<<24). */
const typeAt = (key) => VILLAGE_TYPES[key === HOUSE ? 0 : key & 0xff];

test('QUEST-HOME the quest: the reporter\'s own, the Dark Brotherhood\'s The Acceptance Test (L0A01L00) - its poisonmaker\'s second town\'s residence and its people\'s homes - is never set in a player\'s home in a town its player never walked into: the farmstead\'s only house a player\'s, every draw sets them in the village, and the quest\'s rung opens no stranger\'s home to its player; with the towns asked alone (the old knowledge) the same draws set the quest in the home (mutants: the boot\'s word unread by the quest; the service names no homes)', async (t) => {
  const { api } = await served(t);
  const { homes } = registry(api);
  homes.hearEveryTown((await api.layouts()).data.homes);
  const asked = createOnlineHomes({ api, character: () => null });   // the towns asked alone - none
  let inHome = 0, mansionInHome = 0;
  for (let seed = 1; seed <= 24; seed++) {
    // the quest machine's seam, as scenes/world.js hands it
    const { sites, machine } = acceptanceTest((mapId, buildingKey) => homes.homeStands(mapId, buildingKey) ?? false, seed);
    assert.deepEqual(sites.map((s) => s.name).sort(), ['apo', 'apothecary_home', 'darkbmember_home', 'mansion', 'npc_home']);
    assert.deepEqual(sites.filter(inTheHome).map((s) => s.name), [], `seed ${seed}: nothing of the quest in the farmstead's home`);
    const mansion = sites.find((s) => s.name === 'mansion');
    assert.deepEqual([mansion.locationName, mansion.siteType], ['Aldleigh', SITE_TYPES.Building], 'the second town\'s residence is the village\'s');
    assert.match(mansion.buildingName, /^The \S+ Residence$/);
    assert.equal(machine.isActiveQuestBuilding(FARM, HOUSE, House1), false, 'no quest is set in the home, so its door opens to nobody by the quest\'s rung');
    const old = acceptanceTest((mapId, buildingKey) => !!asked.homeAt(mapId, buildingKey), seed).sites.filter(inTheHome);
    if (old.length) inHome++;
    if (old.some((s) => s.name === 'mansion')) mansionInHome++;
  }
  assert.ok(inHome > 0, 'with the towns asked alone, the farmstead\'s home was the quest\'s');
  assert.ok(mansionInHome > 0, '...and the poisonmaker\'s second town\'s residence among them - the report');
});

test('QUEST-HOME the wiring: the boot\'s read hands every town\'s homes to the registry before the layouts\' pins are read from it, and the quest machine\'s isPlayerHome asks homeStands - its every town - while the collector keeps HOME1\'s exclusion (mutants: the read not handed on; isPlayerHome back on homeAt; the mount marks nothing)', () => {
  const w = src('src/scenes/world.js');
  const take = w.slice(w.indexOf('function takeHomeLayouts(heard) {'));
  assert.ok(take.indexOf('onlineHomes?.hearEveryTown(heard.data?.homes);') > 0
    && take.indexOf('onlineHomes?.hearEveryTown(heard.data?.homes);') < take.indexOf('_serverLayoutRecords = towns'), 'the boot\'s read is handed on as it lands');
  assert.match(w, /isPlayerHome: \(mapId, buildingKey\) => onlineHomes\?\.homeStands\(mapId, buildingKey\) \?\? false,/);
  assert.match(src('src/systems/quest/place.js'), /if \(world\.isPlayerHome\?\.\(location\.mapTableData\?\.mapId, buildingKey\)\) continue;/);
  // Mac's "Close both" (2026-10-15): the live list and the re-pick, wired - every home order an answer carries goes to the
  // hub link, the hub link's word reaches the registry, a home learned of re-picks the sites not yet reached (and so does a
  // load, once its layouts stand), a moved site's map mark follows it, and a building's mount marks its sites reached
  assert.match(w, /if \(homesApi\) onHomeOrders\(\(order\) => \{ socialLink\(\)\?\.sendHomeOrder\?\.\(order\); \}\);/);
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onHome = \(words\) => \{ onlineHomes\?\.hearHome\(words\); \};/);
  assert.match(w, /onHomes: \(\) => homesLearned\(\) \}\) : null;/);
  assert.match(w, /const n = questBridge\?\.machine\?\.reseatHomedSites\?\.\(\) \?\? 0;/);
  const reseat = w.indexOf('const reseated = homeLayoutsOnline');
  assert.ok(reseat > 0 && w.indexOf('homesLearned();   // QUEST-HOME', reseat) - reseat < 400, 'and a load\'s sites, once its layouts stand');
  assert.match(w, /questSiteMoved: \(quest, place, was\) => questSiteMovedHere\(place, was\),/);
  assert.match(src('src/scenes/quest/questBridge.js'), /if \(siteType === SITE_TYPES\.Building\) machine\.noteSiteReached\(adapter\.currentMapId\?\.\(\) \?\? 0, buildingKey\);\n\s*addQuestResourceObjects\(/);
});

test('QUEST-HOME the home order and the home word: an order names one town, its buildings homes now (`bu`) and none (`bd`) - at least one, at most HOME_ORDER_KEYS_MAX, never one twice - and carries no other kind\'s fields, as no other kind carries a home\'s; the wire takes `{t:\'home\', order}` as a shape after the hello, and a home word is the order\'s shapes, a frame a list of them (mutants: a home order with no building; a mute carrying a town)', async () => {
  assert.equal(ORDER_KINDS.includes('home'), true);
  assert.equal(HOME_ORDER_KEYS_MAX, 16);
  const o = { o: 'home', s: 'acct-0001', i: 1000, e: 1060 };
  assert.equal(orderValid({ ...o, bm: FARM, bu: [HOUSE] }), true, 'a home now');
  assert.equal(orderValid({ ...o, bm: FARM, bd: [HOUSE] }), true, 'a home no more');
  assert.equal(orderValid({ ...o, bm: FARM, bu: [1], bd: [2] }), true, 'an arena move: the new house and the old');
  assert.equal(orderValid({ ...o, bm: FARM }), false, 'a home order names a building');
  assert.equal(orderValid({ ...o, bm: FARM, bu: [] }), false, 'an empty list is no list');
  assert.equal(orderValid({ ...o, bm: FARM, bu: [1], bd: [1] }), false, 'never one building twice');
  assert.equal(orderValid({ ...o, bm: FARM, bu: Array.from({ length: HOME_ORDER_KEYS_MAX + 1 }, (_, i) => i + 1) }), false);
  assert.equal(orderValid({ ...o, bm: 0, bu: [1] }), false, 'a town is a map id');
  assert.equal(orderValid({ ...o, bm: FARM, bu: [0] }), false, 'a building is a key');
  assert.equal(orderValid({ ...o, bm: FARM, bu: [1], mu: 0 }), false, 'no mute\'s field');
  assert.equal(orderValid({ o: 'mute', s: 'acct-0001', mu: 0, i: 1000, e: 1060, bm: FARM }), false, 'and no other kind a home\'s');
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const order = await mintHomeOrder({ s: 'acct-0001', bm: FARM, bd: [HOUSE] }, kp.privateKey, { subtle, nowS: 1000 });
  assert.deepEqual((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'home' })).claims, { o: 'home', s: 'acct-0001', bm: FARM, bd: [HOUSE], i: 1000, e: 1060 });
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'guild' })).ok, false, 'read at its own door alone');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'home', order }), { hasHello: true }), { t: 'home', order });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'home', order }), { hasHello: false }), { error: 'home before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'home', order: 7 }), { hasHello: true }), { error: 'bad home' });
  assert.deepEqual(validHomeWord({ m: FARM, u: [HOUSE], d: [], i: 1000 }), { m: FARM, u: [HOUSE], d: [], i: 1000 });
  for (const bad of [{ m: FARM, u: [], d: [], i: 1 }, { m: FARM, u: [1, 1], d: [], i: 1 }, { m: 0, u: [1], d: [], i: 1 }, { m: FARM, u: [1], i: 1 }, { m: FARM, u: [1], d: [], i: 0 }]) assert.equal(validHomeWord(bad), null, JSON.stringify(bad));
  assert.equal(validHomeFrame({ t: 'home', l: [{ m: FARM, u: [1], d: [], i: 1 }, { m: 0 }] }), null, 'one bad word, no frame');
  assert.equal(HOME_RELAY_MIN, 205);   // FIELD BUGS 2026-10-14's one relay bump (201 on its branch, 203 on the integration): main's world201 (CHAT-TRADE), world202 (FIVE-ASKS), world203 (KG-SET) and world204 (KG5) close a socket on the frame
  for (const p of ['hellos', 'look:', 'secret:', 'party:', 'world:', 'acct:', 'asecret:', 'sweep:', 'hub', 'event:']) assert.equal(HOME_WORDS_KEY.startsWith(p), false, p);
});

/** A page's hub link: the real client session over a fake socket, beside the socket the real relay holds for it - frames
 *  carried between the two by hand, as the network carries them (the session's own hello goes unsent: the harness's
 *  hello is the real token's). */
async function pageOnHub(hub, id) {
  const { FakeWS, sockets } = fakeSocketClass();
  const link = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: `secret-of-${id}`, WebSocketImpl: FakeWS, presence: false });
  link.join(SOCIAL_ROOM);
  const ws = sockets[0];
  ws.open();
  ws.sent.length = 0;
  const room = hub.connect();
  await hub.hello(room, id);
  return {
    link, ws, room,
    hear: () => { for (const f of room.sent.splice(0)) ws.receive(f); },   // the hub's frames, to the page
    carry: async () => { for (const f of ws.sent.splice(0)) await hub.raw(room, f); },   // the page's frames, to the hub
  };
}
/** The hub, and the account service signing with the hub's own key - as the deployed pair hold one key between them. */
async function hubAndService(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const hub = fakeRoom(SOCIAL_ROOM);
  const kp = await hub.signer();
  const pkcs8 = Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const S = await standService({ IDENTITY_PRIVATE_KEY: pkcs8 });
  return { hub, kp, S, tick: (s = 60) => { now += s; } };
}
/** A realm character for `who`, and its page's homes door. */
async function buyer(S, who) {
  const R = await seatRealm(S.env, who.secret, who.handle, { name: who.handle, level: 9, goldPieces: 1_000_000, items: [] });
  return { R, api: accountHomes({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, who) }) };
}
const homeFrames = (ws) => ws.sent.filter((m) => m.t === 'home');

test('QUEST-HOME the live list (Mac, 2026-10-15: "Close both"): a house bought AFTER a page\'s boot read reaches it - the real service answers the claim with its signed home order, the client\'s own door hands it to the page\'s ear, the buyer\'s hub link carries it once the hub\'s welcome names a relay that knows the frame, the real relay checks it with the one key and fans it to every hub socket and holds it, the questing page\'s hub link hears it and its registry takes it; the reporter\'s quest taken there afterwards never stands in the house, where the boot\'s read alone set it there; a page that joins later hears the held word on its welcome; the sale says the house a house again (mutants: the claim answers no order; the sale answers none; the route signs nothing; the ear unheard; the link sends nothing; the hub fans nothing; the hub holds nothing; the welcome says nothing; the word not delivered; the word not taken)', async (t) => {
  const { hub, kp, S, tick } = await hubAndService(t);
  const aldric = await S.registered('Aldric');
  const guestApi = accountHomes({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, await S.guest()) });
  // the questing page boots: every town's homes read - the farmstead holds none
  const { homes } = registry(guestApi);
  const boot = (await guestApi.layouts()).data.homes;
  assert.deepEqual(boot, []);
  homes.hearEveryTown(boot);
  const a = await pageOnHub(hub, 'aldric-0001'), b = await pageOnHub(hub, 'questr-0002');
  a.hear(); b.hear();
  assert.equal(a.link.homeOk && b.link.homeOk, true, `the hub's welcome names ${RELAY_VERSION}`);
  b.link.onHome = (words) => { homes.hearHome(words); };   // as scenes/world.js hangs it on the hub link
  // Aldric buys the farmstead's only house after that read, at its door - through the client's own door
  const ears = [];
  const off = onHomeOrders((order) => { ears.push(order); a.link.sendHomeOrder(order); });   // scenes/world.js: socialLink().sendHomeOrder
  const { R, api } = await buyer(S, aldric);
  try {
    const bought = await api.claim({ mapId: FARM, buildingKey: HOUSE, region: 17, character: R.id, price: 42000, realm: R.at(), layout: null });
    assert.equal(bought.ok, true, JSON.stringify(bought));
  } finally { off(); }
  assert.equal(ears.length, 1, 'the claim\'s answer carries one home order, and the page\'s ear hears it');
  const claims = (await verifyOrder(ears[0], kp.publicKey, { subtle: globalThis.crypto.subtle, nowS: T0 + 1, kind: 'home' })).claims;
  assert.deepEqual([claims.bm, claims.bu, claims.bd], [FARM, [HOUSE], undefined]);
  assert.deepEqual(a.ws.sent.map((x) => JSON.parse(x)), [{ t: 'home', order: ears[0] }], 'carried down the hub link');
  await a.carry();
  for (const [who, page] of [['the buyer', a], ['the questing page', b]]) assert.deepEqual(homeFrames(page.room), [{ t: 'home', l: [{ m: FARM, u: [HOUSE], d: [], i: claims.i }] }], `${who} told`);
  assert.equal(hub.store.get(HOME_WORDS_KEY)?.length, 1, 'held for a page that joins after');
  assert.equal(homes.homeStands(FARM, HOUSE), false, 'not yet heard');
  b.hear();
  assert.equal(homes.homeStands(FARM, HOUSE), true, 'the questing page knows the house is a home - it never asked the farmstead');
  // the reporter's quest, taken on the questing page now - never in the house; with the boot's read alone it was
  const bootOnly = createOnlineHomes({ api: guestApi, character: () => null });
  bootOnly.hearEveryTown(boot);
  let before = 0;
  for (let seed = 1; seed <= 24; seed++) {
    assert.deepEqual(acceptanceTest((m, k) => homes.homeStands(m, k), seed).sites.filter(inTheHome).map((x) => x.name), [], `seed ${seed}`);
    if (acceptanceTest((m, k) => bootOnly.homeStands(m, k), seed).sites.some(inTheHome)) before++;
  }
  assert.ok(before > 0, 'with the boot\'s read alone, the quest stood in the house bought after it');
  // a page whose boot read went out before the purchase and whose hub link opens after it hears the held word
  const late = createOnlineHomes({ api: guestApi, character: () => null });
  late.hearEveryTown(boot);
  const c = await pageOnHub(hub, 'latec-0003');
  c.link.onHome = (words) => { late.hearHome(words); };
  c.hear();
  assert.equal(late.homeStands(FARM, HOUSE), true, 'the welcome said it');
  // the sale: the house a house again on every page online
  tick();
  const ears2 = [];
  const off2 = onHomeOrders((order) => { ears2.push(order); a.link.sendHomeOrder(order); });
  try { assert.equal((await api.release(FARM, HOUSE, R.at())).ok, true); } finally { off2(); }
  assert.equal(ears2.length, 1);
  await a.carry();
  b.hear();
  assert.equal(homes.homeStands(FARM, HOUSE), false, 'sold: a house again');
  assert.equal(hub.store.get(HOME_WORDS_KEY)?.length, 2, 'both words held, in their order');
  tick(HOME_WORDS_KEEP_MS / 1000 + 1);
  const d = await pageOnHub(hub, 'later-0004');
  assert.deepEqual(homeFrames(d.room), [], 'past HOME_WORDS_KEEP_MS a joiner is told nothing - its boot read knows');
});

test('QUEST-HOME the re-pick (Mac, 2026-10-15: "Close both"): a quest site the player has NOT reached that becomes another player\'s home is chosen again by the quest machine\'s own Place law, in its own town - The Acceptance Test\'s `_mansion_` in the village, bought through the real service and relay after the quest chose it: another house of the village, its site link moved to it, the journal naming the new residence, the home no quest\'s building; a site the player has stood in (QuestMachine.noteSiteReached, the interior mount\'s) is never moved, and the quest\'s rung still opens the home to them (mutants: the re-pick never asked; a reached site moved; the reach unmarked; the link left behind)', async (t) => {
  const { hub, S, tick } = await hubAndService(t);
  const mara = await S.registered('Mara');
  const guestApi = accountHomes({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, await S.guest()) });
  const a = await pageOnHub(hub, 'maraa-0001');
  a.hear();
  const { R, api } = await buyer(S, mara);
  for (const reached of [false, true]) {
    // the questing page: its registry, as scenes/world.js builds it (onHomes -> the machine's re-pick), its hub link
    let machine = null;
    const homes = createOnlineHomes({ api: guestApi, character: () => null, onHomes: () => machine?.reseatHomedSites() });
    homes.hearEveryTown((await guestApi.layouts()).data.homes);
    const b = await pageOnHub(hub, `quest${reached ? 'r' : 'n'}-0002`);
    b.hear();
    b.link.onHome = (words) => { homes.hearHome(words); };
    // the quest taken: a draw that sets `_mansion_` in the village
    let taken = null;
    for (let seed = 1; seed <= 24 && !taken; seed++) {
      const r = acceptanceTest((m, k) => homes.homeStands(m, k), seed);
      if (r.sites.find((x) => x.name === 'mansion').mapId === VILLAGE) taken = r;
    }
    assert.ok(taken, 'a draw sets the residence in the village');
    machine = taken.machine;
    const place = taken.quest.getPlace({ name: 'mansion' });
    const was = { ...place.siteDetails };
    machine.createSiteLink(taken.quest, place.symbol);   // what the quest placed there (its decanter's link)
    if (reached) machine.noteSiteReached(VILLAGE, was.buildingKey);   // the player stood inside (questBridge.js mountScene)
    assert.equal(place.siteDetails.reached === true, reached);
    // another player buys the residence's building - through the real service, carried by their page to the real hub
    tick();
    const off = onHomeOrders((order) => a.link.sendHomeOrder(order));
    try { assert.equal((await api.claim({ mapId: VILLAGE, buildingKey: was.buildingKey, region: 17, character: R.id, price: 42000, realm: R.at(), layout: null })).ok, true); } finally { off(); }
    await a.carry();
    b.hear();
    assert.equal(homes.homeStands(VILLAGE, was.buildingKey), true, 'the questing page heard it');
    const now = place.siteDetails;
    if (!reached) {
      assert.notEqual(now.buildingKey, was.buildingKey, 'chosen again: another building');
      assert.deepEqual([now.mapId, now.locationName], [VILLAGE, 'Aldleigh'], 'in its own town');
      assert.equal(homes.homeStands(VILLAGE, now.buildingKey), false, 'never a home');
      assert.ok([House1, House3].includes(typeAt(now.buildingKey)), 'a house still - the place\'s own law (house1, then any house)');
      assert.equal(place.expandMacro(1), now.buildingName, 'the journal names the residence the quest stands in now');
      assert.match(now.buildingName, /^The \S+ Residence$/);
      assert.equal(machine.getSiteLinks(SITE_TYPES.Building, VILLAGE, was.buildingKey).length, 0, 'nothing of the quest stands in the home');
      assert.equal(machine.getSiteLinks(SITE_TYPES.Building, VILLAGE, now.buildingKey).length, 1, 'its link moved with it');
      assert.equal(machine.isActiveQuestBuilding(VILLAGE, was.buildingKey, House1), false, 'the home is no quest\'s building - its door is its owner\'s');
      assert.equal(machine.reseatHomedSites(), 0, 'asked again: nothing more to move');
    } else {
      assert.deepEqual([now.buildingKey, now.buildingName], [was.buildingKey, was.buildingName], 'a site the player reached stays where they found it');
      assert.equal(machine.getSiteLinks(SITE_TYPES.Building, VILLAGE, was.buildingKey).length, 1);
      assert.equal(machine.isActiveQuestBuilding(VILLAGE, was.buildingKey, House1), true, 'and the quest\'s rung opens the home to its player, as before');
    }
    tick(); assert.equal((await api.release(VILLAGE, was.buildingKey, R.at())).ok, true);   // the next round's house free again
    tick(2);
  }
});
