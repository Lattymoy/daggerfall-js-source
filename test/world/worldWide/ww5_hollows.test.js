// WW5 (bible/03-World/World-Wide.md WW5; bible/11-Multiplayer/Super-Dungeons.md WW5 - the owner's call taken, 2026-10-26:
// "Every single thing here needs to be addressed. No exceptions."): A HOLLOW IN EVERY THEATRE. One Abyss Dungeon stood at a
// time, in the world: the hub's one record (`sdev`), its census the Bay's 62 region channels, its site over MAPS.BSA's
// rows (`W = 1000`), its find's word the Bay's 0..999. Now each theatre that holds ground for one (the Bay and the eight
// provinces; Cyrodiil's open zone none) keeps a slot of its own - its own record, census, rest, find, receipts and herald,
// its slots numbered in its lane's span (the Bay's the 1, 2, 3 they always were); a crowd in Skyrim counts and draws
// Skyrim's Hollow; a province's stands by its own cities (the registry's - TESA's places) on its theatre's ground, named
// and heralded in its province. The Bay's Hollow is the one it always was. tools/mutants/ww5_hollows.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SD_LANE_SPAN, sdLaneWire, sdSlotOk, sdLaneRegionOk, SD_LANE_KIND, sdLaneKey, sdReceiptKey, SD_KEY, SD_SLOT_KEY, SD_FOUND_KEY, SD_REGION_COUNT, CHAT_REGION_COUNT,
  validSdRecord, validSdOut, validSdIn, validSdFoundTell, SOCIAL_ROOM, SD_INTERNAL_LIVE, chatRegionRoom, worldRoom, PIXEL_UNITS, SITE_EVENT_LANES,
} from '../../../src/net/wire.js';
import {
  sdLaneOf, SD_LANES, sdLaneRegions, sdFirst, sdRise, sdFind, sdFell, pickSdRegion, sdRoomKey, isSdRoom, sdWhere, sdFoundLine, SD_FIRST_RISE_MS, SD_LIFETIME_MS,
  SD_COOLDOWN_MS, SD_BAY_NAME, SD_COLLAPSE_MS,
} from '../../../src/net/superDungeon/sdLaw.js';
import { sdProvinceName, sdRisePost, sdFoundPost, sdFellPost, sdHeraldDue } from '../../../src/net/superDungeon/sdHerald.js';
import { mintSdReceipt } from '../../../src/net/superDungeon/sdReceipt.js';
import { sdTheatreCities, findSdTheatreSite, sdHollowLocation, sdWorldMapId, SD_WORLD_LANE, sdSalt, sdTemplates, pickSdTemplate, findSdSite, sdCities } from '../../../src/systems/superDungeon/sdSite.js';
import { spawnedMapId } from '../../../src/world/spawnedDungeons.js';
import { createSdLanes } from '../../../src/scenes/superDungeon/sdLanes.js';
import { SD_LINE_WAIT_MS } from '../../../src/scenes/superDungeon/sdHost.js';
import { scanTheatreGate } from '../../../src/systems/gate/theatreGateSite.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { eventBoardModel } from '../../../src/systems/eventBoard.js';
import { readGateMarks } from '../../../src/ui/gate/gateMapMark.js';
import { theatreAt, THEATRE_KEYS, worldPixelKey } from '../../../src/world/worldWide/worldGrid.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { PROVINCE_REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { isCountryPlaceId } from '../../../src/world/tamrielCountry.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { codeOnly } from '../../codeOnly.mjs';
import { HAVE, ww5World } from './ww5World.mjs';

const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));
const T0 = 1_800_000_000_000, M = 60_000;
const SKY = 3, SKY_S = 3 * SD_LANE_SPAN;   // Skyrim's lane, its zero slot

test('WW5 THE LAW: a slot names its lane - lane t\'s are t x SD_LANE_SPAN + 1, + 2 ... (the Bay\'s the 1, 2, 3 they always were), the room `sd:<s>` nine digits at most; a lane\'s first beat its own zero; a rise its lane\'s next slot in its own region - a Bay region on the Bay\'s, its province\'s or its great cities past it, never another\'s; the census\'s pick its slot\'s lane\'s regions (a crowd in Skyrim draws Skyrim\'s Hollow, never the Bay\'s); the Bay\'s first beat and rise the law before WW5 (mutants: the span; the lane\'s zero; a Bay region on a province\'s lane; a province\'s region on the Bay\'s; the pick across lanes; the lane\'s overflow)', () => {
  assert.equal(SD_LANE_SPAN, 10_000_000);
  assert.deepEqual([...SD_LANES], [...SITE_EVENT_LANES]);
  assert.deepEqual([...SITE_EVENT_LANES], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  for (const [s, lane] of [[1, 0], [9_999_999, 0], [SKY_S + 1, SKY], [80_000_001, 8]]) { assert.equal(sdLaneOf(s), lane); assert.equal(sdLaneWire(s), lane); }
  assert.equal(SD_REGION_COUNT, CHAT_REGION_COUNT, 'every region\'s channel counted');
  assert.deepEqual(sdLaneRegions(0), Array.from({ length: 62 }, (_, r) => r));
  for (let t = 1; t <= 8; t++) assert.deepEqual(sdLaneRegions(t), [61 + t], `${THEATRE_KEYS[t]}: its province's region`);
  assert.deepEqual(sdLaneRegions(9), [], 'the open zone counts for none');
  // the Bay's: the law before WW5
  assert.deepEqual(sdFirst(T0), { s: 0, ph: 'gone', r: -1, at: T0, until: T0, next: T0 + SD_FIRST_RISE_MS });
  assert.deepEqual(sdRise(sdFirst(T0), T0 + SD_FIRST_RISE_MS, 17), { s: 1, ph: 'risen', r: 17, at: T0 + SD_FIRST_RISE_MS, until: T0 + SD_FIRST_RISE_MS + SD_LIFETIME_MS, next: T0 + SD_FIRST_RISE_MS + SD_LIFETIME_MS + SD_COOLDOWN_MS });
  assert.equal(sdRise(sdFirst(T0), T0 + SD_FIRST_RISE_MS, 64), null, 'the Bay\'s lane never rises in a province');
  // a province's
  const first = sdFirst(T0, SKY);
  assert.deepEqual(first, { s: SKY_S, ph: 'gone', r: -1, at: T0, until: T0, next: T0 + SD_FIRST_RISE_MS });
  const r1 = sdRise(first, T0 + SD_FIRST_RISE_MS, 64);
  assert.deepEqual([r1.s, r1.r, r1.ph], [SKY_S + 1, 64, 'risen']);
  assert.equal(sdRise(first, T0 + SD_FIRST_RISE_MS, 17), null, 'a Bay region on Skyrim\'s lane');
  assert.equal(sdRise(first, T0 + SD_FIRST_RISE_MS, 65), null, 'Morrowind\'s region on Skyrim\'s lane');
  assert.equal(sdRise(null, T0, -1, SKY).s, SKY_S + 1, 'a lane with no record: its first slot');
  assert.equal(sdRise(null, T0, -1, 9), null, 'the open zone: none');
  assert.equal(sdRise({ ...first, s: SKY_S + SD_LANE_SPAN - 1 }, T0 + SD_FIRST_RISE_MS, -1), null, 'never past its span');
  assert.equal(sdRise(first, T0 + SD_FIRST_RISE_MS, 64, 2), null, 'a record of another lane is no lane\'s');
  assert.equal(sdRise({ ...first, s: SKY_S - 1 }, T0 + SD_FIRST_RISE_MS, 64, SKY), null, 'Hammerfell\'s last slot never rises into Skyrim\'s zero');
  const counts = Object.assign(new Array(71).fill(0), { 17: 3, 64: 5, 70: 9 });
  assert.equal(pickSdRegion(1, counts), 17, 'the Bay\'s lane: the Bay\'s crowd, however full Skyrim');
  assert.equal(pickSdRegion(SKY_S + 1, counts), 64, 'a crowd in Skyrim draws Skyrim\'s Hollow');
  assert.equal(pickSdRegion(2 * SD_LANE_SPAN + 1, counts), -1, 'none in Hammerfell: its great cities');
  assert.equal(pickSdRegion(SKY_S + 1, { ...counts, 64: 1 }), -1);
  assert.equal(sdRoomKey(80_000_001, '0123456789abcdef'), 'sd:80000001.0123456789abcdef'); assert.ok(isSdRoom(sdRoomKey(80_000_001, '0123456789abcdef')));   // PIN MOVED (the eighth merge of main, SD-PARTY): a lane's slot is a room key with its party's owner, as every Hour's is
});

test('WW5 THE WIRE: a record on its own lane\'s span and region - the Bay\'s `ev` as it always was, a province\'s `ln` (an older client drops a kind it does not know), never one read as the other; a find\'s word and its tell on the lane\'s pixel (the Bay\'s map for the Bay\'s, a world pixel off it past it); a lane\'s hub records and an account\'s receipt under a lane\'s key, the Bay\'s the keys they always were (mutants: the lane\'s region unread; the kinds crossed; the find\'s pixel by the Bay\'s bound; a receipt key shared)', () => {
  const bay = { s: 2, ph: 'found', r: 17, at: 10, until: 20, next: 30, foundAt: 12, fb: 'Mara' };
  const sky = { ...bay, s: SKY_S + 2, r: 64 };
  assert.deepEqual(validSdRecord(bay), bay);
  assert.deepEqual(validSdRecord(sky), sky);
  assert.deepEqual(validSdRecord({ ...sky, r: -1 }), { ...sky, r: -1 });
  for (const bad of [{ ...sky, r: 17 }, { ...sky, r: 65 }, { ...bay, r: 64 }, { ...sky, s: 9 * SD_LANE_SPAN + 2 }]) assert.equal(validSdRecord(bad), null, JSON.stringify(bad));
  assert.equal(validSdRecord({ ...sky, s: SKY_S }), null, 'a lane\'s zero is its first beat\'s, said to nobody');
  assert.deepEqual(validSdRecord({ s: SKY_S, ph: 'gone', r: -1, at: 1, until: 1, next: 2 }), { s: SKY_S, ph: 'gone', r: -1, at: 1, until: 1, next: 2 });
  assert.deepEqual(validSdOut({ k: 'ev', ...bay }), { k: 'ev', ...bay }, 'the Bay\'s word as it always was');
  assert.deepEqual(validSdOut({ k: SD_LANE_KIND, ...sky }), { k: 'ln', ...sky });
  assert.equal(validSdOut({ k: 'ev', ...sky }), null, 'a province\'s record never the Bay\'s');
  assert.equal(validSdOut({ k: 'ln', ...bay }), null);
  assert.equal(validSdOut({ k: 'ln', s: SKY_S, ph: 'gone', r: -1, at: 1, until: 1, next: 2 }), null, 'a lane\'s zero said to nobody');
  assert.deepEqual(validSdIn({ k: 'found', s: SKY_S + 2, px: 1566, py: -427 }), { k: 'found', s: SKY_S + 2, px: 1566, py: -427 });
  for (const bad of [{ s: SKY_S + 2, px: 300, py: 200 }, { s: 2, px: 1566, py: -427 }, { s: SKY_S, px: 1566, py: -427 }, { s: 9 * SD_LANE_SPAN + 1, px: 1566, py: -427 }]) assert.equal(validSdIn({ k: 'found', ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(validSdIn({ k: 'found', s: 2, px: 300, py: 200 }), { k: 'found', s: 2, px: 300, py: 200 });
  assert.ok(validSdFoundTell({ s: SKY_S + 2, px: 1566, py: -427, x: 1, z: 2, fb: 'M' }));
  assert.equal(validSdFoundTell({ s: SKY_S + 2, px: 300, py: 200, x: 1, z: 2, fb: 'M' }), null);
  assert.ok(sdSlotOk(1) && sdSlotOk(SKY_S + 1) && !sdSlotOk(SKY_S) && !sdSlotOk(90_000_001) && !sdSlotOk(0));
  assert.ok(sdLaneRegionOk(0, 61) && !sdLaneRegionOk(0, 62) && sdLaneRegionOk(3, 64) && sdLaneRegionOk(3, -1) && !sdLaneRegionOk(3, 63));
  assert.deepEqual([sdLaneKey(SD_KEY), sdLaneKey(SD_KEY, 3), sdLaneKey(SD_SLOT_KEY, 8), sdLaneKey(SD_FOUND_KEY, 1)], ['sdev', 'sdev:3', 'sdslot:8', 'sdfound:1']);
  assert.deepEqual([sdReceiptKey('acct_1'), sdReceiptKey('acct_1', 0), sdReceiptKey('acct_1', 3)], ['sdrc:acct_1', 'sdrc:acct_1', 'sdrc:acct_1.3']);
});

test('WW5 THE WORDS AND THE HERALD: a province\'s Hollow said in its province ("in Skyrim") where a Bay\'s says its region; its herald\'s rise "somewhere in Skyrim", its find "in Skyrim", its end\'s field "In Skyrim" - the Bay\'s posts the words they always were (mutants: the province unnamed; the Bay\'s rise text moved)', () => {
  assert.equal(SD_BAY_NAME, 'the Iliac Bay');
  assert.equal(sdWhere(), 'near the Iliac Bay');
  assert.equal(sdWhere('', '', 'Skyrim'), 'in Skyrim');
  assert.equal(sdWhere('Solitude', 'Daggerfall', 'Skyrim'), 'near Solitude');
  assert.equal(sdFoundLine({ who: 'Mara', near: '', region: '', province: 'Skyrim' }), 'Mara has found an Abyss Dungeon in Skyrim!');
  assert.deepEqual([0, 1, SKY_S + 1, 8 * SD_LANE_SPAN + 1].map(sdProvinceName), ['', '', 'Skyrim', 'Black Marsh']);
  const bayRise = sdRisePost({ rec: { s: 4, ph: 'risen', r: 17, at: T0, until: T0 + SD_LIFETIME_MS, next: T0 + 2 * SD_LIFETIME_MS } });
  assert.match(JSON.stringify(bayRise), /stands over it somewhere in the Iliac Bay, and the taverns of the nearest city speak of it\./, 'the Bay\'s rise, as it always was');
  const skyRise = sdRisePost({ rec: { s: SKY_S + 4, ph: 'risen', r: -1, at: T0, until: T0 + SD_LIFETIME_MS, next: T0 + 2 * SD_LIFETIME_MS } });
  assert.match(JSON.stringify(skyRise), /stands over it somewhere in Skyrim, and the taverns/);
  const found = sdFind({ s: SKY_S + 4, ph: 'risen', r: 64, at: T0, until: T0 + SD_LIFETIME_MS, next: T0 + 2 * SD_LIFETIME_MS }, T0 + M, 'Mara');
  assert.match(JSON.stringify(sdFoundPost({ rec: found })), /Mara has found an Abyss Dungeon in Skyrim!/);
  assert.match(JSON.stringify(sdFellPost({ rec: sdFell(found, T0 + 2 * M, { top: 'Ann', n: 2 }) })), /In Skyrim/);
  assert.equal(sdHeraldDue(found, { rise: SKY_S + 4, found: -1, end: -1 }, T0 + 2 * M).kind, 'found', 'a lane\'s own state');
});

const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (px, py, east = 10) => ({ x: (px + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - py - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });

test('WW5 THE RELAY: the hub keeps a Hollow in every lane - each its own first beat, rest and rise, its census its own regions (a crowd in Skyrim\'s channel draws Skyrim\'s Hollow, the Bay\'s crowd the Bay\'s), fanned and said at every hello as its kind (`ev` the Bay\'s, `ln` a province\'s); a find at a province\'s world pixel found in its own lane alone; the live door answers the asker\'s slot\'s lane; an account\'s receipts kept and spent a lane each (a province\'s never standing over the Bay\'s), handed at its hello; the herald posts each lane\'s (mutants: one lane beaten; the census across lanes; the fan\'s kind; the find\'s lane; the live door\'s lane; a receipt key shared; the herald\'s lane)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const world = fakeRooms({ now: () => clock });
      const hub = world.room(SOCIAL_ROOM);
      const posts = [];
      hub.room._heraldOf = () => ({ sdRole: null });
      hub.room._heraldSend = async (body) => { posts.push(body); return true; };
      hub.room._heraldBeat = async () => {}; hub.room._serpentHeraldBeat = async () => {}; hub.room._egHeraldBeat = async () => {}; hub.room._ktHeraldBeat = async () => {};
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      const hubber = async (n) => { const ws = hub.connect(); await hub.hello(ws, `peer-h${n}`, null, { name: `H${n}`, acct: `acct-h${n}`, asecret: `secret-of-acct-h${n}` }); return ws; };
      const inRegion = async (r, id, sub) => { const room = world.room(chatRegionRoom(r)); const ws = room.connect(); await room.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); return ws; };
      const h1 = await hubber(1);
      await fire(hub);
      for (const lane of SD_LANES) assert.deepEqual(hub.store.get(sdLaneKey(SD_KEY, lane)), sdFirst(T0, lane), `lane ${lane}'s first beat its own`);
      assert.equal(hub.store.get(sdLaneKey(SD_KEY, 9)), undefined, 'the open zone keeps none');
      await inRegion(64, 'peer-s1', 'acct-s1'); await inRegion(64, 'peer-s2', 'acct-s2');
      await inRegion(17, 'peer-b1', 'acct-b1'); await inRegion(17, 'peer-b2', 'acct-b2');
      clock = T0 + SD_FIRST_RISE_MS;
      await fire(hub);
      const bay = hub.store.get(SD_KEY), sky = hub.store.get(sdLaneKey(SD_KEY, SKY)), ham = hub.store.get(sdLaneKey(SD_KEY, 2));
      assert.deepEqual([bay.s, bay.r, bay.ph], [1, 17, 'risen'], 'the Bay\'s, by the Bay\'s crowd');
      assert.deepEqual([sky.s, sky.r, sky.ph], [SKY_S + 1, 64, 'risen'], 'Skyrim\'s, by Skyrim\'s crowd');
      assert.deepEqual([ham.s, ham.r], [2 * SD_LANE_SPAN + 1, -1], 'Hammerfell\'s by its great cities');
      assert.equal(hub.store.get(sdLaneKey(SD_SLOT_KEY, SKY)), SKY_S + 1, 'each lane its own mark');
      const fanned = h1.sent.filter((m) => m.t === 'sd');
      assert.deepEqual(fanned.find((m) => m.s === 1), { t: 'sd', k: 'ev', ...bay });
      assert.deepEqual(fanned.find((m) => m.s === SKY_S + 1), { t: 'sd', k: 'ln', ...sky });
      const h2 = await hubber(2);
      const said = h2.sent.filter((m) => m.t === 'sd');
      assert.deepEqual(said.map((m) => [m.k, sdLaneOf(m.s)]), [['ev', 0], ...[1, 2, 3, 4, 5, 6, 7, 8].map((l) => ['ln', l])], 'a hello: the Bay\'s first, then every lane\'s');
      // the herald: each lane's rise, its province named
      await fire(hub);
      assert.ok(posts.some((p) => JSON.stringify(p).includes('somewhere in Skyrim')), 'Skyrim\'s rise posted');
      assert.ok(posts.some((p) => JSON.stringify(p).includes('somewhere in the Iliac Bay')), 'the Bay\'s, as always');
      // a find at Skyrim's pixel, in its cell
      const [px, py] = [1566, -427];
      const cell = world.room(worldRoom(px, py));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(px, py), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: SKY_S + 1, px, py }));
      assert.equal(hub.store.get(sdLaneKey(SD_KEY, SKY)).ph, 'found', 'found in its own lane');
      assert.equal(hub.store.get(sdLaneKey(SD_KEY, SKY)).fb, 'Mara');
      assert.equal(hub.store.get(SD_KEY).ph, 'risen', 'the Bay\'s untouched');
      assert.equal(cell.store.get(sdLaneKey(SD_FOUND_KEY, SKY)), undefined, 'told and let go');
      const live = async (s) => (await (await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_LIVE}`, { method: 'POST', body: JSON.stringify({ s }) }))).json()).rec;
      assert.equal((await live(SKY_S + 1)).s, SKY_S + 1, 'the live door: the asker\'s lane');
      assert.equal((await live(1)).s, 1);
      assert.equal(await live(9 * SD_LANE_SPAN + 1), null, 'no lane, no record');
      // receipts, a lane each
      const subtle = globalThis.crypto.subtle, nowS = Math.floor(clock / 1000);
      const rcSky = await mintSdReceipt({ d: SKY_S + 1, s: 'acct-h1', c: 1, x: 'dealt', l: 5 }, null, { subtle, nowS });
      const rcBay = await mintSdReceipt({ d: 1, s: 'acct-h1', c: 2, x: 'dealt', l: 5 }, null, { subtle, nowS });
      await hub.room._sdKeepReceipts({ s: SKY_S + 1, rc: [['acct-h1', rcSky]], here: [] }, clock);
      await hub.room._sdKeepReceipts({ s: 1, rc: [['acct-h1', rcBay]], here: [] }, clock);
      assert.equal(hub.store.get(sdReceiptKey('acct-h1', SKY)).r, rcSky);
      assert.equal(hub.store.get(sdReceiptKey('acct-h1')).r, rcBay, 'the Bay\'s kept beside it - a province\'s slot, numbered past it, stands over nothing of the Bay\'s');
      await hub.room._sdSpent('acct-h1', SKY_S + 1, clock);
      assert.equal(hub.store.get(sdReceiptKey('acct-h1', SKY)).spent, true);
      assert.equal(hub.store.get(sdReceiptKey('acct-h1')).spent, undefined, 'the Bay\'s unspent');
      hub.room._noSdRcpt.clear();
      const h3 = await hubber(1);
      assert.deepEqual(h3.sent.filter((m) => m.t === 'sd' && m.k === 'rcpt').map((m) => m.r), [rcBay], 'a hello hands each lane\'s receipt that is good');
    });
  } finally { Date.now = realNow; }
});

/** A province's world on the page: Skyrim's towns (the registry's records) and its theatre's scan by the producer. */
function skyrim() {
  const towns = [];
  for (let j = 2; j >= 0; j--) for (let i = 2; i >= 0; i--) towns.push({ key: 0, mapId: 0x34180000 + i + 3 * j, name: `Sky ${i}.${j}`, px: 1500 + i * 14, py: -200 + j * 14, type: j === 0 ? LOCATION_TYPES.TownCity : LOCATION_TYPES.TownHamlet, region: 64, area: 300, theatre: SKY, w: 3 - j, h: 3 - j, blocks: 1 });
  const at = new Map(towns.map((t) => [`${t.px},${t.py}`, t]));
  const scan = scanTheatreGate({ towns, placeAt: (x, y) => at.get(`${x},${y}`) ?? null, inTheatre: () => true, areaAt: () => 300, wet: () => false, theatre: SKY });
  const places = { inTheatre: (t) => (t === SKY ? towns : []), generation: () => 1 };
  return { towns, scan, places };
}
const LAB = { name: 'Old Lab', hasDungeon: true, regionIndex: 17, dungeon: { blocks: new Array(12).fill({}), recordElement: { header: {} } }, mapTableData: { locationType: LOCATION_TYPES.DungeonLabyrinth, mapId: 7 }, exterior: { exteriorData: { width: 1, height: 1 } } };

test('WW5 A PROVINCE\'S HOLLOW\'S SITE: its cities the registry\'s places of its theatre by the hubs\' own claim (its great cities its first cities, by the slot\'s roll); its site a suitable pixel of its theatre\'s scan whose nearest town is that city, on dry ground; its location the template cloned under the Hollows\' world lane of map ids (no Bay pixel\'s, no TESA place\'s), named and Super; a Bay site\'s the spawned id it always was (mutants: the claim\'s order; the nearest town; the dry ground; the map id\'s lane; the Bay\'s id moved)', () => {
  const { scan, places, towns } = skyrim();
  const cities = sdTheatreCities(places, SKY, 64, { provinceName: 'Skyrim' });
  assert.deepEqual(cities.slice(0, 3).map((c) => c.name), ['Sky 0.0', 'Sky 1.0', 'Sky 2.0'], 'a city over a hamlet, then its blocks, then the lower map id');
  assert.equal(cities.length, towns.length);
  assert.deepEqual(sdTheatreCities(places, SKY, -1).map((c) => c.type), [1, 1, 1].map(() => LOCATION_TYPES.TownCity), 'its great cities its cities alone');
  const great = sdTheatreCities(places, SKY, -1), picked = new Set();
  for (let k = 1; k <= 24; k++) picked.add(findSdTheatreSite({ s: SKY_S + k, r: -1 }, scan, great).city.name);
  assert.ok(picked.size > 1, `by its great cities, the slot's roll where they begin (${[...picked]})`);
  const rec = { s: SKY_S + 1, r: 64 };
  const site = findSdTheatreSite(rec, scan, cities);
  assert.equal(site.city, cities[0]);
  const ti = scan.towns.findIndex((t) => t.px === cities[0].px && t.py === cities[0].py);
  assert.equal(scan.townOf.get(worldPixelKey(site.px, site.py)), ti, 'its nearest town the city');
  assert.equal(site.lane, SKY);
  const dry = findSdTheatreSite(rec, scan, cities, (x, y) => !(x === site.px && y === site.py));
  assert.ok(dry && !(dry.px === site.px && dry.py === site.py) && scan.townOf.get(worldPixelKey(dry.px, dry.py)) === ti, 'past a wet pixel to the next of its city\'s');
  assert.equal(findSdTheatreSite(rec, scan, cities, () => false), null, 'no dry ground: none');
  const loc = sdHollowLocation(rec, site, LAB, { regionIndex: 64, regionName: 'Skyrim' });
  assert.equal(loc.mapTableData.mapId, sdWorldMapId(rec.s));
  assert.equal(sdWorldMapId(rec.s) >>> 20, SD_WORLD_LANE);
  assert.ok((sdWorldMapId(rec.s) & 0x80000) !== 0 && !isCountryPlaceId(sdWorldMapId(rec.s)), 'no Bay pixel\'s id, no TESA place\'s');
  assert.notEqual(sdWorldMapId(SKY_S + 1), sdWorldMapId(SKY_S + 2));
  assert.notEqual(sdWorldMapId(SKY_S + 1), sdWorldMapId(2 * SD_LANE_SPAN + 1), 'a lane\'s own');
  assert.deepEqual([loc.superTier, loc.sdSlot, loc.regionIndex], [true, rec.s, 64]);
  const bay = sdHollowLocation({ s: 3 }, { px: 300, py: 200, cityName: 'Daggerfall' }, LAB, {});
  assert.equal(bay.mapTableData.mapId, spawnedMapId(sdSalt(3), 300, 200), 'the Bay\'s, the id it always was');
});

/** The page's lanes over a fake world - the Bay's host's seams, a province's scan and places, my pixel. */
function page({ here = { x: 300, y: 200 } } = {}) {
  const P = { clock: T0, here, stood: new Map(), cast: [], said: [], sent: [], standing: null, scans: 0 };
  const { scan, places } = skyrim();
  const bayScan = { byRegion: new Map([[17, Int32Array.from([200 * 1000 + 303])]]), towns: [{ name: 'Daggerfall', px: 300, py: 200, region: 17 }], townAt: (() => { const a = new Int32Array(1000 * 500).fill(-1); a[200 * 1000 + 303] = 0; return a; })() };
  const bayCity = { name: 'Daggerfall', regionIndex: 17, locationIndex: 0, mapTableData: { locationType: LOCATION_TYPES.TownCity, mapId: 200 * 1000 + 300 }, exterior: { exteriorData: { width: 4, height: 4 }, buildingCount: 9 } };
  P.lanes = createSdLanes({
    now: () => P.clock, here: () => P.here, scan: () => bayScan, cities: (r) => sdCities([bayCity], r), templates: () => [LAB], where: () => ({}),
    stand: (key, loc) => P.stood.set(key, loc), unstand: (key) => P.stood.delete(key), inside: (loc) => P.standing != null && loc?.sdSlot === P.standing,
    door: () => null, feet: () => null, sendFound: (w) => { P.sent.push(w); return true; }, say: (t) => P.said.push(t), regionName: () => '',
    castOut: (key) => { P.cast.push(key); return true; }, standing: () => P.standing,
    theatreScans: { scanOf: (t) => { P.scans++; return t === SKY ? scan : { theatre: t, byArea: new Map(), towns: [], townOf: new Map() }; }, theatres: () => [SKY], siteOf: () => null },
    places, landVersion: () => 1, idle: null,
  });
  return P;
}

test('WW5 THE PAGE: the hub\'s `ev` to the Bay\'s host, a province\'s `ln` to its lane\'s - each stands its own Hollow at its own pixel; a risen Hollow a province away is never asked of its ground (its scan), one found is; one in focus at a time - the lane I stand in, else the nearest standing Hollow, else the Bay\'s; a slot\'s own lane\'s record and Hollow asked by it; standing in a province\'s Hollow the Bay\'s host never casts me out, nor the province\'s me out of the Bay\'s; the Timers\' source every lane\'s, the map every lane\'s ring (mutants: the lane routing; the ground asked far away; the focus; the Bay\'s host judging a province\'s slot; a lane\'s rows lost)', () => {
  const P = page();
  const bayRec = sdRise(sdFirst(T0), T0 + SD_FIRST_RISE_MS, 17), skyRec = sdRise(sdFirst(T0, SKY), T0 + SD_FIRST_RISE_MS, 64);
  P.clock = T0 + SD_FIRST_RISE_MS + M;
  P.lanes.heard({ k: 'ev', ...bayRec }); P.lanes.heard({ k: 'ln', ...skyRec });
  P.lanes.frame();
  assert.ok(P.stood.has('303,200'), 'the Bay\'s Hollow stands');
  assert.equal(P.scans, 0, 'Skyrim\'s risen Hollow a province away: its ground never asked');
  assert.equal(P.lanes.record(), P.lanes.record(1));
  assert.equal(P.lanes.record(SKY_S + 1).s, SKY_S + 1, 'a slot\'s own lane\'s record');
  P.here = { x: 1520, y: -190 };   // in Skyrim
  P.lanes.frame();
  assert.ok(P.scans > 0, 'standing in its province: its ground asked');
  const sky = P.lanes.hollow(SKY_S + 1);
  assert.ok(sky && P.stood.has(sky.key) && sky.key !== '303,200', 'Skyrim\'s Hollow stands at its own pixel');
  assert.equal(P.lanes.hollow().s, SKY_S + 1, 'in focus: the nearest');
  assert.equal(P.lanes.record().s, SKY_S + 1);
  P.here = { x: 302, y: 201 };
  assert.equal(P.lanes.hollow().s, 1, 'back on the Bay: the Bay\'s');
  // standing in Skyrim's: the Bay's end judges only the Bay's slots
  P.standing = SKY_S + 1;
  assert.equal(P.lanes.hollow().s, SKY_S + 1, 'the lane I stand in');
  // the Bay's Hollow broken and collapsed while I stand in Skyrim's (still risen)
  const bayEnd = sdFell(sdFind(bayRec, P.clock, 'Ann'), P.clock + 1, { top: 'Ann', n: 1 });
  P.lanes.heard({ k: 'ev', ...bayEnd });
  P.clock += SD_COLLAPSE_MS + 10;
  P.lanes.frame();
  assert.deepEqual(P.cast, [], 'the Bay\'s Hollow gone: I am not in it, and nothing casts me out of Skyrim\'s');
  assert.ok(!P.stood.has('303,200'), 'the Bay\'s taken down');
  // Skyrim's broken and collapsed while I stand in the Bay's (a later slot of the Bay's, standing)
  const bay2 = sdRise(bayEnd, bayEnd.next, 17);
  P.clock = bay2.at + M;
  P.lanes.heard({ k: 'ev', ...bay2 });
  P.standing = bay2.s;
  const skyEnd = sdFell(sdFind(skyRec, P.clock, 'Bo'), P.clock + 1, { top: 'Bo', n: 1 });
  P.lanes.heard({ k: 'ln', ...skyEnd });
  P.clock += SD_COLLAPSE_MS + 10;
  P.lanes.frame();
  assert.deepEqual(P.cast, [], 'nor Skyrim\'s end me out of the Bay\'s');
  assert.ok(!P.stood.has(sky.key), 'Skyrim\'s taken down');
  // the Timers and the map: every lane's
  const Q = page({ here: { x: 1520, y: -190 } });
  Q.clock = T0 + SD_FIRST_RISE_MS + M;
  Q.lanes.heard({ k: 'ev', ...bayRec });
  const found = sdFind(skyRec, T0 + SD_FIRST_RISE_MS + M, 'Mara');
  Q.lanes.heard({ k: 'ln', ...found });
  Q.lanes.frame();
  const tm = Q.lanes.timers();
  assert.equal(tm.rec.s, 1, 'the Bay\'s as it always was');
  assert.deepEqual([tm.site?.px, tm.site?.py], [303, 200], 'and its site - the board\'s way to it (AUDIT EVENTS1 A2: the Timers\' source carries the site itself)');
  assert.deepEqual(tm.lanes.map((l) => [l.lane, l.province, l.rec.s, l.mine, !!l.site]), [[SKY, 'Skyrim', SKY_S + 1, true, true]]);
  assert.equal(Q.lanes.mapMarks().length, 1, 'the found Hollow\'s ring (the Bay\'s, only risen, is a find)');
  assert.deepEqual(Q.lanes.mapMark(), Q.lanes.mapMarks()[0], 'the one in focus: the nearest');
});

test('WW5 A PROVINCE\'S GROUND MADE AGAIN: its Hollow stands while its theatre is scanned anew (a new registry generation - TESA\'s places landing after the boot) and moves with the new ground; one whose ground has no town yet waits its line, then says it in its province (mutants: the Hollow kept over a new scan; the same slot\'s new site never stood; the Hollow taken down while its ground is made again; a townless scan read as ground; the province unsaid)', () => {
  const sk = skyrim();
  const movedTowns = sk.towns.map((t) => ({ ...t, px: t.px + 40 }));
  const movedAt = new Map(movedTowns.map((t) => [`${t.px},${t.py}`, t]));
  const moved = scanTheatreGate({ towns: movedTowns, placeAt: (x, y) => movedAt.get(`${x},${y}`) ?? null, inTheatre: () => true, areaAt: () => 300, wet: () => false, theatre: SKY });
  const G = { gen: 1, cur: sk.scan, towns: sk.towns, queue: [], stood: new Map(), said: [], clock: T0 + SD_FIRST_RISE_MS + M };
  const seams = (over) => createSdLanes({
    now: () => G.clock, here: () => ({ x: 1520, y: -190 }), scan: () => null, cities: () => [], templates: () => [LAB], where: () => ({}),
    stand: (key, loc) => G.stood.set(key, loc), unstand: (key) => G.stood.delete(key), inside: () => false,
    door: () => null, feet: () => null, sendFound: () => true, say: (t) => G.said.push(t), regionName: (r) => `Region ${r}`, castOut: () => true, standing: () => null,
    landVersion: () => 1, ...over,
  });
  const lanes = seams({
    theatreScans: { scanOf: (t) => (t === SKY ? G.cur : { theatre: t, byArea: new Map(), towns: [], townOf: new Map() }), theatres: () => [SKY], siteOf: () => null },
    places: { inTheatre: (t) => (t === SKY ? G.towns : []), generation: () => G.gen }, idle: (fn) => G.queue.push(fn),
  });
  const drain = () => { while (G.queue.length) G.queue.shift()(); };
  const skyRec = sdRise(sdFirst(T0, SKY), T0 + SD_FIRST_RISE_MS, 64);
  lanes.heard({ k: 'ln', ...skyRec });
  lanes.frame(); drain(); lanes.frame();
  const a = lanes.hollow(SKY_S + 1);
  assert.ok(a && G.stood.has(a.key), 'Skyrim\'s Hollow stands');
  G.gen = 2; G.cur = moved; G.towns = movedTowns;
  lanes.frame();
  assert.ok(G.stood.has(a.key), 'it stands while its ground is made again');
  drain(); lanes.frame();
  const b = lanes.hollow(SKY_S + 1);
  assert.ok(b && b.key !== a.key && G.stood.has(b.key) && !G.stood.has(a.key), `it moves with the new ground (${a.key} -> ${b?.key})`);
  // a province whose ground has no town yet: its find's line waits for its place, then says its province
  G.said.length = 0;
  const bare = seams({
    theatreScans: { scanOf: (t) => ({ theatre: t, byArea: new Map(), towns: [], townOf: new Map() }), theatres: () => [SKY], siteOf: () => null },
    places: { inTheatre: () => [], generation: () => 1 }, idle: null,
  });
  bare.heard({ k: 'ln', ...skyRec });   // the welcome's record: no news
  bare.heard({ k: 'ln', ...sdFind(skyRec, G.clock, 'Mara') });
  bare.frame();
  assert.deepEqual(G.said, [], 'its line waits for its place');
  G.clock += SD_LINE_WAIT_MS + 1;
  bare.frame();
  assert.equal(G.said[0], 'Mara has found an Abyss Dungeon in Skyrim!');
});

test('WW5 THE TIMERS, THE BOARD AND THE MAP: a province\'s Hollow in the same rows as the Bay\'s - found or collapsing, news to every screen, by its city; its next rise its own theatre\'s players\' alone; the board\'s row its own lane\'s site and way; the held map\'s rings every lane\'s over the continent\'s frame (mutants: a lane\'s found row lost; every lane\'s coming row; the board\'s site the Bay\'s)', () => {
  const now = T0 + SD_FIRST_RISE_MS + 10 * M;
  const bay = sdRise(sdFirst(T0), T0 + SD_FIRST_RISE_MS, 17);
  const sky = sdFind(sdRise(sdFirst(T0, SKY), T0 + SD_FIRST_RISE_MS, 64), T0 + SD_FIRST_RISE_MS + M, 'Mara');
  const ham = { s: 2 * SD_LANE_SPAN + 4, ph: 'gone', r: -1, at: T0 - 10 * M, until: T0 - 5 * M, next: now + 30 * M };
  const els = { s: 7 * SD_LANE_SPAN + 2, ph: 'gone', r: -1, at: T0 - 10 * M, until: T0 - 5 * M, next: now + 40 * M };
  const sd = { rec: bay, name: null, site: null, lanes: [
    { rec: sky, lane: SKY, province: 'Skyrim', mine: false, name: 'The Stopped Bell', site: { cityName: 'Solitude', px: 1566, py: -427 } },
    { rec: ham, lane: 2, province: 'Hammerfell', mine: false, name: null, site: null },
    { rec: els, lane: 7, province: 'Elsweyr', mine: true, name: null, site: null },
  ] };
  const rows = eventTimerRows({ now, sd }).filter((r) => r.kind === 'super');
  assert.deepEqual(rows.map((r) => [r.id, r.live, r.title, r.where]), [
    [`sd:${SKY_S + 1}`, true, 'The Stopped Bell stands', 'Near Solitude'],
    [`sd:${7 * SD_LANE_SPAN + 3}`, false, 'An Abyss Dungeon rises', null],
  ]);
  assert.equal(rows[1].detail, 'Not before this. Watch Elsweyr for its brass omen');
  const board = eventBoardModel({ now, pixel: { x: 1560, y: -420 }, sd });
  const brow = board.all.find((r) => r.id === `sd:${SKY_S + 1}`);
  assert.ok(brow && brow.where === 'Near Solitude' && brow.way && brow.way.m < 10_000, 'the board: its own lane\'s site, and the way there');
  const box = { x0: -900, y0: -1000, w: 6000, h: 3800 };
  assert.equal(readGateMarks(() => [{ cx: 1566.5, cy: -426.5, r: 1.25 }, { cx: 303.5, cy: 200.5, r: 1.25 }], box).length, 2, 'every lane\'s ring');
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ createSdLanes \} from '\.\/superDungeon\/sdLanes\.js';/);
  assert.match(w, /const sdHost = params\.has\('online'\) \? createSdLanes\(\{\n {4}now: \(\) => Date\.now\(\) \+ _sharedOffsetMs, here: \(\) => playerTravelPixel\(\),/);
  assert.match(w, /sd: sdHost\?\.timers\(\) \?\? null,/);
  assert.match(w, /sd: \(\) => sdHost\?\.mapMarks\(\) \?\? null,/);
  assert.match(src('src/scenes/spawnStandHost.js'), /return \(locationIndex\.get\(`\$\{px\},\$\{py\}`\)\?\.superTier \? locationIndex\.get\(`\$\{px\},\$\{py\}`\) : null\) \|\| \(params\.has\('online'\)/, 'a province\'s Hollow built where it stands past the Bay');   // PIN MOVED (AUDIT BAY-LEFT, its packages merged): _locationToBuild left world.js for scenes/spawnStandHost.js (SPAWN-WORLD's HOST-SPLIT), the Hollow-first clause with it
  for (const re of [/const rec = sdHost\.record\(s\), now/, /riftLook\(sdHost\.record\(s\), s,/, /rec = sdHost\?\.record\?\.\(slot\) \?\? null;/, /const h = sdHost\?\.hollow\(s\);/, /if \(sdHost\?\.hollow\(loc\.sdRealm\)\?\.key !== back\.key\) return true;/]) assert.match(w, re);
  const on = src('src/net/online.js');
  assert.match(on, /else if \(r && r\.k !== 'ev' && r\.k !== SD_LANE_KIND\) \{/, 'a province\'s record is the hub\'s word, never a realm\'s fight');
  assert.match(on, /if \(sdLaneWire\(w\.s\) > 0 && !\(this\._mine\(cell\) \? this\.ww5Ok : halo\?\.ww5Ok\)\) return false;/, 'a province\'s find never to an older relay - the socket\'s own relay\'s word (ww5_stars: a halo says for itself)');
});

test('WW5 ON THE FREEWARE\'S WORLD: every province\'s Hollow stands - three slots of each lane, by its crowd and by its great cities, each in its own theatre by a city of its own (the registry\'s, TESA\'s places), on dry ground, under the world lane\'s id; the Bay\'s Hollows by their own rows as they always were', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)', timeout: 600_000 }, async () => {
  const W = await ww5World();
  const templates = sdTemplates(W.rows, W.isMainStoryDungeon);
  assert.ok(templates.length > 10);
  let stood = 0;
  for (let t = 1; t <= 8; t++) {
    const sc = W.scans.scanOf(t);
    for (let k = 1; k <= 3; k++) for (const r of [-1, 61 + t]) {
      const rec = { s: t * SD_LANE_SPAN + k, r };
      const cities = sdTheatreCities(W.places, t, r, { provinceName: PROVINCE_REGION_NAMES[t - 1] });
      assert.ok(cities.length > 0 && cities.every((c) => c.theatre === t), `${THEATRE_KEYS[t]}: its own cities`);
      const site = findSdTheatreSite(rec, sc, cities, W.spawnGround);
      assert.ok(site, `${THEATRE_KEYS[t]} slot ${rec.s} r ${r}`);
      assert.equal(theatreAt(site.px, site.py), t, 'in its own theatre');
      assert.ok(cities.includes(site.city), 'by a city of its own');
      assert.ok(W.spawnGround(site.px, site.py), 'on dry ground');
      const loc = sdHollowLocation(rec, site, pickSdTemplate(rec.s, templates), {});
      assert.equal(loc.mapTableData.mapId, sdWorldMapId(rec.s));
      stood++;
    }
  }
  assert.equal(stood, 48);
  // the Bay's: its own rows, its scan, the spawned id it always had
  const bayCities = sdCities(W.rows.filter((l) => l.regionIndex === 17), 17, { regionNameOf: (i) => W.maps.getRegionName(i) });
  const site = findSdSite({ s: 1, r: 17 }, W.bayScan, bayCities, W.spawnGround);
  assert.ok(site && site.px < 1000 && site.py < 500);
  assert.equal(sdHollowLocation({ s: 1 }, site, templates[0], {}).mapTableData.mapId, spawnedMapId(sdSalt(1), site.px, site.py));
});
