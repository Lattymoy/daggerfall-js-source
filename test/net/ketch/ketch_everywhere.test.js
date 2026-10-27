// KETCH-EVERYWHERE (2026-10-26, the owner after the audit "no system left behind in the Bay": "Every single thing here
// needs to be addressed. No exceptions."; bible/11-Multiplayer/Sky-Ketch.md section 22): A SKY-KETCH STATION IN EVERY
// PROVINCE - the law (net/ketch/ketchLaw.js: the stations, their stagger, a voyage's number naming its theatre), the herald
// (net/ketch/ketchHerald.js, the hub's beat a station), the relay (a station's ship minted and held, the hub's receipts a
// station), the account (a station's voyage its own share), the Timers, and on the freeware the stations' cities and the
// page (scenes/ketch/ketchClient.js, ketchStations.js). The Bay's Ketch is the one she always was, to the byte.
// tools/mutants/ketch_everywhere.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  KT_THEATRES, KT_STATION_CITIES, KT_STATION_CROWNS, ketchStationSlot, KT_THEATRE_SPAN, KT_THEATRE_STAGGER_MS, KT_EVERY_MS, KT_EPOCH_MS, KT_SIGHT_MS, KT_STATION_MS, KT_LAST_MS,
  ketchVoyageOf, ketchVoyageAt, ketchBoards, ketchHolds, ketchRoomKey, ketchRoomOf, ketchRoomHolds, ketchTheatreOf, ketchVoyageNumber, ketchStationOk,
} from '../../../src/net/ketch/ketchLaw.js';
import { ketchHeraldDue, ketchHeraldPost, ketchHeraldKey, readKetchHeraldState } from '../../../src/net/ketch/ketchHerald.js';
import { GATE_LANE_SPAN } from '../../../src/net/gate/gateLaw.js';
import {
  SOCIAL_ROOM, ketchReceiptKey, KT_THEATRES_RELAY_MIN, relaySupportsKetchTheatres, WORLD_WIDE_RELAY_MIN, RELAY_VERSION,
} from '../../../src/net/wire.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { KT_STAGE } from '../../../src/net/ketch/ketchLaw.js';
import { KETCH_SEAM } from '../../../src/net/ketch/ketchWarden.js';
import { deckToDungeon } from '../../../src/net/ketch/ketchDeck.js';
import { mintKetchReceipt, readKetchReceipt } from '../../../src/net/ketch/ketchReceipt.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../../src/net/identityToken.js';
import { claimKetch } from '../../../server-account/src/ketch.js';
import { createGuest } from '../../../server-account/src/accounts.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { setKetchStationsStanding, ketchStationHere } from '../../../src/scenes/ketch/ketchStanding.js';
import { KT_STATION_REACH_PX, ketchStationPixel, ketchStationNear, KT_BAY_STATION_ROWS } from '../../../src/scenes/ketch/ketchStations.js';
import { KT_SKY, ketchSkyBucket, KT_SKY_BUCKET, ketchSkyPose } from '../../../src/scenes/ketch/ketchSky.js';
import { KT_STATION_WORDS, KT_WORDS, KT_REFUSE_WORDS, ketchWhenLine } from '../../../src/systems/ketch/ketchWords.js';
import { KT_CLIENT_TEXT } from '../../../src/scenes/ketch/ketchClient.js';
import { ketchShipHit } from '../../../src/scenes/ketch/ketchDeckHost.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { THEATRE_KEYS, theatreAt } from '../../../src/world/worldWide/worldGrid.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { CAPITALS } from '../../../src/world/tamrielCapitals.js';
import { KINGDOMS, BAY_KINGDOMS, kingdomSeatName } from '../../../src/net/kingdomLaw.js';
import { regionOfTheatre } from '../../../src/formats/mapsTables.js';
import { ARENA_REGION, ARENA_LOCATION } from '../../../src/world/arena/arenaCity.js';
import { pictureToBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { fakeRooms, fakeRoom } from '../../fakeRoom.mjs';
import { d1 } from '../../accountDb.mjs';

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const H = 3600 * 1000;
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const SKYRIM = THEATRE_KEYS.indexOf('Skyrim');

// ─── the law ───────────────────────────────────────────────────────────────────────────────────

/** The Bay's law as it was before KETCH-EVERYWHERE, word for word (net/ketch/ketchLaw.js at e77eadc58f). */
const oldVoyageOf = (n) => { const k = Math.max(0, Math.floor(Number(n) || 0)), at = KT_EPOCH_MS + k * KT_EVERY_MS; return { n: k, sightAt: at - KT_SIGHT_MS, at, departAt: at + KT_STATION_MS, endAt: at + KT_STATION_MS + KT_LAST_MS }; };
function oldVoyageAt(now) {
  const t = Number(now);
  if (!Number.isFinite(t)) return { ...oldVoyageOf(0), phase: 'away' };
  const n = Math.floor((t - (KT_EPOCH_MS - KT_SIGHT_MS)) / KT_EVERY_MS);
  if (n < 0) return { ...oldVoyageOf(0), phase: 'away' };
  const v = oldVoyageOf(n);
  if (t >= v.endAt) return { ...oldVoyageOf(n + 1), phase: 'away' };
  return { ...v, phase: t < v.at ? 'sighted' : t < v.departAt ? 'docked' : 'departing' };
}

test('KETCH-EVERYWHERE THE STATIONS: one a province, at its crown capital (the owner\'s call) - High Rock\'s over Daggerfall (the Bay\'s own lane), Hammerfell\'s over Sentinel (its crown the Bay\'s), each province\'s past the Bay over its own crown\'s seat; none on High Rock past the Bay\'s lane, none in the open zone (mutants: the open zone a station; a crown\'s station moved; a city not its crown\'s seat)', { timeout: 120_000 }, () => {
  assert.deepEqual([...KT_THEATRES], [0, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual({ ...KT_STATION_CROWNS }, { 0: 'daggerfall', 2: 'sentinel', 3: 'skyrim', 4: 'morrowind', 5: 'summerset', 6: 'valenwood', 7: 'elsweyr', 8: 'blackmarsh' });
  assert.deepEqual(Object.keys(KT_STATION_CROWNS).map(Number), [...KT_THEATRES], 'a lane a crown');
  assert.deepEqual([...KT_STATION_CITIES], ['Daggerfall', null, 'Sentinel', 'Solitude', 'Mournhold', 'Alinor', 'Falinesti', 'Torval', 'Helstrom']);
  assert.deepEqual([0, 1, 2, 3, 8, 9, 10, -1].map(ketchStationOk), [true, false, true, true, true, false, false, false]);
  // every station's city its crown's seat - the crown capital (net/kingdomLaw.js kingdomSeatName)
  for (const t of KT_THEATRES) assert.equal(KT_STATION_CITIES[t], kingdomSeatName(KT_STATION_CROWNS[t]), `lane ${t}`);
  // a lane is its province's theatre: Hammerfell's 2, each province past the Bay its own - High Rock's the Bay's own 0
  assert.deepEqual(KT_THEATRES.map((t) => THEATRE_KEYS[t]), ['IliacBay', 'Hammerfell', 'Skyrim', 'Morrowind', 'Sumurset', 'Valenwood', 'Elsweyr', 'BlackMarsh']);
  // the crown seats past the Bay are the capitals the port lays (world/tamrielCapitals.js), each its province's own crown's
  for (let t = 3; t <= 8; t++) {
    const cap = CAPITALS.find((c) => c.province === THEATRE_KEYS[t]);
    assert.equal(cap?.name, KT_STATION_CITIES[t], `${THEATRE_KEYS[t]}: its capital`);
    assert.deepEqual([...KINGDOMS[KT_STATION_CROWNS[t]].regions], [regionOfTheatre(t)], `${cap.name}: its province's crown`);
  }
  // High Rock's and Hammerfell's crowns are the Bay's three (WW7-3): one station a province - High Rock's Daggerfall's (of its
  // two crowns, Daggerfall and Wayrest), Hammerfell's Sentinel's; Wayrest keeps none; no crown of Cyrodiil's keeps one
  assert.deepEqual([...BAY_KINGDOMS].map((k) => Object.values(KT_STATION_CROWNS).includes(k)), [true, false, true]);
  assert.equal(Object.values(KT_STATION_CROWNS).includes('cyrodiil'), false, 'the open zone keeps none');
  assert.equal(new Set(Object.values(KT_STATION_CROWNS)).size, KT_THEATRES.length, 'one a crown');
});

test('KETCH-EVERYWHERE THE VOYAGES: the Bay\'s law the one it always was, to the millisecond over every edge; a station\'s voyage k is k plus its lane\'s span (the gates\' lane span), its times the Bay\'s k\'s an eighth of a round on per station in the round\'s order - eight arrivals a round, evenly, never two at once; every number names its own lane; the room\'s key holds every station\'s; the open zone\'s and High Rock past the Bay\'s numbers no ship (mutants: the stagger; the span; the open zone held; the slot the lane)', { timeout: 120_000 }, () => {
  assert.equal(KT_THEATRE_SPAN, GATE_LANE_SPAN);
  assert.equal(KT_THEATRE_STAGGER_MS, 4_500_000, 'an hour and a quarter');
  assert.deepEqual([...KT_THEATRES, 1, 9, 42].map(ketchStationSlot), [0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0], 'the round\'s order; a lane with no station the Bay\'s place');
  // the Bay's, to the millisecond: every edge of three voyages
  for (let n = 0; n < 3; n++) {
    const v = oldVoyageOf(n);
    assert.deepEqual(ketchVoyageOf(n), v);
    for (const t of [v.sightAt - 1, v.sightAt, v.at - 1, v.at, v.departAt - 1, v.departAt, v.endAt - 1, v.endAt]) assert.deepEqual(ketchVoyageAt(t), oldVoyageAt(t), `${n} at ${t}`);
  }
  assert.deepEqual(ketchVoyageAt(NaN), oldVoyageAt(NaN));
  // each station's
  const arrivals = [];
  for (const th of KT_THEATRES) {
    const n = ketchVoyageNumber(5, th), v = ketchVoyageOf(n), b = oldVoyageOf(5), off = KT_THEATRES.indexOf(th) * KT_THEATRE_STAGGER_MS;
    assert.deepEqual(v, { n, sightAt: b.sightAt + off, at: b.at + off, departAt: b.departAt + off, endAt: b.endAt + off }, `station ${th}`);
    assert.deepEqual([ketchTheatreOf(n), n - th * KT_THEATRE_SPAN], [th, 5]);
    assert.deepEqual(ketchVoyageAt(v.at, th), { ...v, phase: 'docked' });
    assert.deepEqual(ketchVoyageAt(v.endAt, th).n, n + 1, 'gone: its next, its own lane\'s');
    assert.deepEqual(ketchVoyageAt(v.sightAt - 1, th).phase, 'away');
    assert.equal(ketchRoomOf(ketchRoomKey(n, '0123456789abcdef')).n, n, 'the room\'s eight hex hold it');
    assert.deepEqual([ketchBoards(n, v.at), ketchHolds(n, v.endAt - 1), ketchHolds(n, v.endAt), ketchRoomHolds(ketchRoomKey(n, '0123456789abcdef'), v.at)], [true, true, false, true]);
    arrivals.push(v.at % KT_EVERY_MS);
  }
  assert.equal(new Set(arrivals).size, 8, 'eight arrivals a round');
  const sorted = [...arrivals].sort((a, b) => a - b);
  assert.deepEqual(sorted.slice(1).map((a, i) => a - sorted[i]), Array(7).fill(KT_THEATRE_STAGGER_MS), 'evenly round the ten hours');
  assert.deepEqual(KT_THEATRES.map((th) => ketchVoyageOf(ketchVoyageNumber(5, th)).at - oldVoyageOf(5).at), [0, 4_500_000, 9_000_000, 13_500_000, 18_000_000, 22_500_000, 27_000_000, 31_500_000], 'Sentinel an hour and a quarter after Daggerfall, Black Marsh last');
  const zone = ketchVoyageNumber(5, 9), zv = ketchVoyageOf(zone);
  assert.deepEqual([ketchBoards(zone, zv.at), ketchHolds(zone, zv.at), ketchRoomHolds(ketchRoomKey(zone, '0123456789abcdef'), zv.at)], [false, false, false], 'the open zone keeps no ship');
  const hr = ketchVoyageNumber(5, 1), hv = ketchVoyageOf(hr);
  assert.deepEqual([ketchBoards(hr, hv.at), ketchHolds(hr, hv.at), ketchRoomHolds(ketchRoomKey(hr, '0123456789abcdef'), hv.at)], [false, false, false], 'nor High Rock past the Bay\'s lane - High Rock\'s station is Daggerfall\'s');
  assert.equal(ketchRoomKey(ketchVoyageNumber(0, 42), '0123456789abcdef') !== null, true);
  assert.equal(ketchHolds(ketchVoyageNumber(0, 42) + 3, ketchVoyageOf(ketchVoyageNumber(0, 42) + 3).at), false, 'nor any theatre past the last');
});

// ─── the herald ────────────────────────────────────────────────────────────────────────────────

test('KETCH-EVERYWHERE THE HERALD: every station\'s three cards name its own city (the Bay\'s Daggerfall\'s, word for word as they were); each station\'s moments owed on its own state at its own instants; the hub keeps each station\'s under its own key (mutants: a station\'s city the Bay\'s; the state the Bay\'s)', { timeout: 120_000 }, async () => {
  const n0 = 7, n3 = ketchVoyageNumber(7, SKYRIM);
  const bay = JSON.stringify(ketchHeraldPost(n0, 'sighted', '112233445566778899'));
  assert.ok(bay.includes('The Sky-Ketch has been sighted east of Daggerfall. When it arrives, its anchor-lift comes down in the fields east of the city.'));
  assert.ok(bay.includes('Over the fields east of Daggerfall'));
  assert.ok(JSON.stringify(ketchHeraldPost(n0, 'arrived')).includes('The Sky-Ketch is over Daggerfall'));
  for (const k of ['sighted', 'arrived', 'departing']) {
    const p = JSON.stringify(ketchHeraldPost(n3, k));
    if (k !== 'departing') assert.ok(p.includes('Solitude') && !p.includes('Daggerfall'), `${k}: Solitude's`);
  }
  assert.deepEqual([ketchHeraldKey(0), ketchHeraldKey(SKYRIM)], ['ktherald', `ktherald:${SKYRIM}`]);
  const v = ketchVoyageOf(n3);
  assert.deepEqual(ketchHeraldDue(v.sightAt - 60_000, { n: -1, k: -1 }, SKYRIM), { n: n3, k: 'sighted', i: 0, at: v.sightAt });
  assert.deepEqual(ketchHeraldDue(v.at + 1, { n: n3, k: 0 }, SKYRIM), { n: n3, k: 'arrived', i: 1, at: v.at + 1 });
  // the hub: each station's sighting posted at its own instant, kept under its own key
  const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
  const r = fakeRoom(SOCIAL_ROOM);
  Object.assign(r.env, { GATE_DISCORD_WEBHOOK: HOOK });
  for (const k of ['_serpentHeraldBeat', '_serpentHeraldArm', '_sdBeat', '_sdHeraldArm', '_egHeraldBeat', '_heraldBeat']) if (typeof r.room[k] === 'function') r.room[k] = async () => {};
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = ketchVoyageOf(n0).sightAt - 60_000;
  const posts = [];
  Date.now = () => clock;
  globalThis.fetch = async (url, init) => { posts.push(JSON.parse(init.body)); return { ok: true, status: 204 }; };
  try {
    await quiet(async () => {
      const ws = r.connect(); await r.hello(ws, 'peer-a', null, { name: 'a', acct: 'acct-a', asecret: 'secret-of-acct-a' });
      for (const th of KT_THEATRES) {
        clock = ketchVoyageOf(ketchVoyageNumber(7, th)).sightAt; await r.room._ktHeraldBeat(clock);
        assert.deepEqual(readKetchHeraldState(r.store.get(ketchHeraldKey(th))), { n: ketchVoyageNumber(7, th), k: 0 }, `station ${th}'s sighting kept on its own key`);
      }
      const sightings = posts.filter((p) => JSON.stringify(p).includes('has been sighted east of'));
      assert.deepEqual(sightings.map((p) => KT_STATION_CITIES.findIndex((c) => JSON.stringify(p).includes(`sighted east of ${c}.`))), [...KT_THEATRES], 'each station\'s, at its own instant');
      assert.equal(readKetchHeraldState(r.store.get(ketchHeraldKey(0))).n, 7, 'the Bay\'s on its own key, as it always was');
    });
  } finally { Date.now = realNow; globalThis.fetch = realFetch; }
});

// ─── the relay ─────────────────────────────────────────────────────────────────────────────────

test('KETCH-EVERYWHERE THE RELAY: Skyrim\'s ship minted while its voyage holds and boarded by its captain; its fall\'s receipt names its voyage, kept at the hub on Skyrim\'s key beside the Bay\'s and both handed at a hello; its spent word spends its own; the open zone\'s ship never minted; the stations ride the world-wide relay (mutants: a station\'s receipt on the Bay\'s key; the spent word\'s station)', { timeout: 120_000 }, async () => {
  assert.equal(KT_THEATRES_RELAY_MIN, WORLD_WIDE_RELAY_MIN);
  assert.deepEqual([relaySupportsKetchTheatres(RELAY_VERSION), relaySupportsKetchTheatres(`world${WORLD_WIDE_RELAY_MIN - 1}`)], [true, false]);
  const onl = readFileSync(new URL('../../../src/net/online.js', import.meta.url), 'utf8');
  assert.match(onl, /this\.ktTheatresOk = false;/, 'none before a welcome');
  assert.match(onl, /if \(primary\) this\.ktTheatresOk = relaySupportsKetchTheatres\(relayV\);/, 'the session\'s word off its welcome');
  const nSky = ketchVoyageNumber(1, SKYRIM), V = ketchVoyageOf(nSky), nBay = 1;
  assert.deepEqual(V.at - ketchVoyageOf(nBay).at, 2 * KT_THEATRE_STAGGER_MS, 'Skyrim\'s voyage 1 two stations after the Bay\'s (Sentinel\'s between)');
  const owner = await instanceOwnerOf('acct-alice');
  // THE WINDOW
  const worker = (await import('../../../server/src/index.js')).default;
  let minted = 0;
  const env = { ROOMS: { idFromName: () => { minted++; return 'id'; }, get: () => ({ fetch: async () => new Response('ok') }) } };
  const upgrade = (key) => new Request(`https://relay.test/room/${key}`, { headers: { Upgrade: 'websocket' } });
  const realNow = Date.now;
  let clock = V.at + 60_000;
  Date.now = () => clock;
  try {
    assert.equal((await worker.fetch(upgrade(ketchRoomKey(nSky, owner)), env)).status, 200, 'Skyrim\'s ship');
    assert.equal((await worker.fetch(upgrade(ketchRoomKey(ketchVoyageNumber(1, 9), owner)), env)).status, 404, 'the open zone\'s: none');
    clock = ketchVoyageOf(ketchVoyageNumber(1, 1)).at + 60_000;
    assert.equal((await worker.fetch(upgrade(ketchRoomKey(ketchVoyageNumber(1, 1), owner)), env)).status, 404, 'High Rock past the Bay\'s lane: none');
    clock = ketchVoyageOf(ketchVoyageNumber(1, 2)).at + 60_000;
    assert.equal((await worker.fetch(upgrade(ketchRoomKey(ketchVoyageNumber(1, 2), owner)), env)).status, 200, 'Sentinel\'s ship');
    assert.equal(minted, 2);
    clock = V.at + 60_000;
    await quiet(async () => {
      const world = fakeRooms({ now: () => clock });
      const hub = world.room(SOCIAL_ROOM);
      hub.store.set('acct:acct-alice', { name: 'alice', party: null });
      const ship = world.room(ketchRoomKey(nSky, owner));
      const at = (x, y, z) => { const [dx, dy, dz] = deckToDungeon(x, y, z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, mv: 0 }; };
      const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 200), { charLevel: 30 });
      assert.ok(alice.sent.some((m) => m.t === 'welcome'), 'the captain aboard Skyrim\'s ship');
      const K = ship.room._kt;
      assert.equal(K.n, nSky);
      K.sg = KT_STAGE.bridge; K.bridge = { at: clock, by: 'alice' };
      K.wf = KETCH_SEAM.new({ room: K.key, fi: 1, now: clock });
      KETCH_SEAM.join(K.wf, 'acct-alice', 'alice', 30, clock);
      K.wf.players['acct-alice'].dealt = K.wf.players['acct-alice'].share;
      K.wf.liveMs = 60_000;
      K.wf.fell = { at: clock, top: ['alice'], n: 1 };
      await ship.pose(alice, at(0, 0, 200));
      // a Bay voyage's receipt kept first (the same account, an earlier round)
      hub.store.set(ketchReceiptKey('acct-alice'), { n: nBay, r: 'y1.bay.', e: Math.floor(clock / 1000) + 3600 });
      clock += 250; await ship.fire();
      const rc = alice.sent.filter((m) => m.t === 'kt' && m.k === 'rcpt');
      assert.equal(readKetchReceipt(rc[0].r).d, nSky, 'the receipt names Skyrim\'s voyage');
      assert.deepEqual([hub.store.get(ketchReceiptKey('acct-alice', SKYRIM))?.n, hub.store.get(ketchReceiptKey('acct-alice'))?.n], [nSky, nBay], 'kept on Skyrim\'s key, the Bay\'s left as it was');
      const later = hub.connect(); await hub.hello(later, 'alice');
      assert.deepEqual(later.sent.filter((m) => m.t === 'kt' && m.k === 'rcpt').map((m) => m.r).sort(), ['y1.bay.', rc[0].r].sort(), 'both handed at a hello');
      await hub.raw(later, JSON.stringify({ t: 'kt', k: 'spent', n: nSky }));
      assert.deepEqual([hub.store.get(ketchReceiptKey('acct-alice', SKYRIM)).spent, hub.store.get(ketchReceiptKey('acct-alice')).spent], [true, undefined], 'its own spent');
      await hub.raw(later, JSON.stringify({ t: 'kt', k: 'spent', n: ketchVoyageAt(clock, 9).n }));   // the open zone's voyage the clock is on - no number past it
      assert.equal(hub.store.get(ketchReceiptKey('acct-alice', 9)), undefined, 'none of the open zone\'s');
    });
  } finally { Date.now = realNow; }
});

// ─── the account ───────────────────────────────────────────────────────────────────────────────

test('KETCH-EVERYWHERE THE ACCOUNT: a station\'s voyage is its own share - Skyrim\'s and the Bay\'s of one round each paid once, as the gates\' lanes are each their own row (the hold\'s rates, the budget\'s fill unchanged)', { timeout: 120_000 }, async () => {
  const { subtle } = globalThis.crypto;
  const rand = (b) => globalThis.crypto.getRandomValues(b);
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const db = d1();
  const nowS = 1_800_000_000;
  const id = (await createGuest({ db, subtle, rand, nowS }, { deviceLabel: null })).id;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run('Skyfarer', 'skyfarer', id);
  const player = { id, handle: 'Skyfarer' };
  const claim = async (d, o = '0123456789abcdef') => claimKetch({ db, nowS, subtle, rand }, player, await mintKetchReceipt({ d, o, s: id, c: 1, x: 'dealt', l: 30 }, priv, { subtle, nowS }), pub);
  const sky = await claim(ketchVoyageNumber(4, SKYRIM));
  assert.deepEqual([sky.recorded, sky.share, sky.voyage], [true, true, ketchVoyageNumber(4, SKYRIM)]);
  const bay = await claim(4);
  assert.deepEqual([bay.recorded, bay.share, bay.sailed], [true, true, 2], 'the Bay\'s of the same round its own');
  assert.equal((await claim(4, 'fedcba9876543210')).why, 'taken', 'and another crew\'s ship that voyage pays nothing');
  assert.equal((await claim(ketchVoyageNumber(4, SKYRIM), 'fedcba9876543210')).why, 'taken', 'Skyrim\'s neither');
});

// ─── the Timers and the page's words ───────────────────────────────────────────────────────────

test('KETCH-EVERYWHERE THE TIMERS AND THE WORDS: in a province whose station is not the Bay\'s own, its rows beside the Bay\'s, over its own city - Hammerfell\'s (Sentinel\'s) in Sentinel\'s crown\'s regions on the Bay and in Hammerfell past it, none in High Rock (Daggerfall\'s every screen\'s), the open zone or the sea, none while the stations do not stand; every line that names her city names the station\'s (the Bay\'s its own words, as they were); a province\'s ship laid in its province (mutants: the province\'s rows unasked; the standing unread; the words\' city; the Bay\'s crown unread; the reader unhanded)', { timeout: 120_000 }, () => {
  setTamrielTrace(null); setTamrielFit(null);
  const pxOf = (name) => { const c = CITIES.find((q) => q.name === name); return pictureToBay(c.at[0], c.at[1]).map(Math.floor); };
  const [sx, sy] = pxOf('Solitude'), [hx, hy] = pxOf('Hegathe'), [rx, ry] = pxOf('Shornhelm'), [cx, cy] = pxOf('Imperial City');
  assert.deepEqual([theatreAt(sx, sy), theatreAt(hx, hy), theatreAt(rx, ry), theatreAt(cx, cy)], [SKYRIM, 2, 1, 9]);
  assert.deepEqual([ketchStationHere(sx, sy), ketchStationHere(hx, hy), ketchStationHere(rx, ry), ketchStationHere(cx, cy)], [SKYRIM, 2, null, null], 'past the Bay: its province\'s - High Rock\'s Daggerfall\'s, the open zone none');
  // on the Bay, the crown the region is under: Sentinel's (20 its own, 0 the Alik'r, 61 an Isle of its crown) Hammerfell's
  // station; Daggerfall's (17) and Wayrest's (23) High Rock's - Daggerfall's, every screen's own; the Marches (19, 21, 22),
  // the Free Lands (9, 16) and the sea (-1) no crown's
  const regionIs = (r) => () => r;
  assert.deepEqual([20, 0, 61, 17, 23, 19, 21, 22, 9, 16, -1].map((r) => ketchStationHere(397, 343, regionIs(r))), [2, 2, 2, null, null, null, null, null, null, null, null]);
  assert.deepEqual([ketchStationHere(397, 343), ketchStationHere(207, 213), ketchStationHere(NaN, 0)], [null, null, null], 'no reader: none on the Bay');
  const now = ketchVoyageOf(ketchVoyageNumber(3, SKYRIM)).at + H;
  // her voyage on the round's own clock - asked first: the Timers' gate rows walk the gate's days to it
  assert.equal(now - H - ketchVoyageOf(3).at, 2 * KT_THEATRE_STAGGER_MS, 'Skyrim\'s voyage 3 two stations after the Bay\'s');
  const rows = (pixel) => eventTimerRows({ now, pixel }).filter((r) => r.kind === 'ketch').map((r) => [r.id, r.where]);
  setKetchStationsStanding(false, regionIs(20));
  assert.deepEqual(rows({ x: sx, y: sy }), rows({ x: 207, y: 213 }), 'not standing: the Bay\'s alone');
  assert.deepEqual(rows({ x: 397, y: 343 }), rows({ x: 207, y: 213 }), 'not standing: the Bay\'s alone at Sentinel too');
  setKetchStationsStanding(true, regionIs(17));
  try {
    const bayRows = rows({ x: 207, y: 213 });
    assert.ok(bayRows.length > 0 && bayRows.every(([, w]) => w === 'Over Daggerfall'));
    assert.deepEqual(rows({ x: sx, y: sy }), [...bayRows, [`ketch:${ketchVoyageNumber(3, SKYRIM)}`, 'Over Solitude']]);
    assert.deepEqual(rows({ x: 397, y: 343 }), bayRows, 'Daggerfall\'s crown: the Bay\'s alone');
    setKetchStationsStanding(true, regionIs(20));
    assert.equal(ketchVoyageAt(now, 2).n, ketchVoyageNumber(3, 2), 'Sentinel\'s voyage 3, a station before Skyrim\'s');
    assert.deepEqual(rows({ x: 397, y: 343 }), [...bayRows, [`ketch:${ketchVoyageNumber(3, 2)}`, 'Over Sentinel']], 'Sentinel\'s crown: Sentinel\'s beside');
    assert.deepEqual(rows({ x: hx, y: hy }), [...bayRows, [`ketch:${ketchVoyageNumber(3, 2)}`, 'Over Sentinel']], 'Hammerfell past the Bay: Sentinel\'s');
    assert.deepEqual(rows({ x: rx, y: ry }), bayRows, 'High Rock past the Bay: Daggerfall\'s alone');
  } finally { setKetchStationsStanding(false, null); }
  // the words: the Bay's as they always were, a station's of its city
  assert.deepEqual([KT_STATION_WORDS.sighted(0), KT_STATION_WORDS.arrived(0), KT_STATION_WORDS.lowered(0), KT_STATION_WORDS.away(0), KT_CLIENT_TEXT.awayAt(0)], [KT_WORDS.sighted, KT_WORDS.arrived, KT_WORDS.lowered, KT_REFUSE_WORDS.away, KT_CLIENT_TEXT.away]);
  assert.deepEqual([KT_STATION_WORDS.sighted(SKYRIM), KT_STATION_WORDS.arrived(4), KT_STATION_WORDS.lowered(5), KT_STATION_WORDS.away(2), KT_CLIENT_TEXT.awayAt(7)], [
    'The Sky-Ketch has been sighted east of Solitude.',
    'The Sky-Ketch has arrived over Mournhold. Its anchor-lift is down in the fields east of the city.',
    'The anchor-lift sets you down in the fields outside Alinor.',
    'The Ketch is not over Sentinel right now. It comes every ten hours.',
    'The Ketch has gone. You are back in the fields outside Torval.',
  ]);
  const docked = ketchVoyageOf(ketchVoyageNumber(3, 8)).at + 60_000;
  assert.match(ketchWhenLine(docked, 8), /^over Helstrom, /);
  assert.match(ketchWhenLine(ketchVoyageOf(3).at + 60_000), /^over Daggerfall, /);
  // a province's ship laid in its province (its site's region, WW-R's); the Bay's as it always was
  const hit = (site) => ketchShipHit({ n: ketchVoyageNumber(3, SKYRIM), owner: '0123456789abcdef', site }, { getBlock: () => null }).dfLocation;
  assert.deepEqual([hit({ regionIndex: 64, regionName: '' }).regionName, hit({ regionIndex: 17, regionName: '' }).regionName, hit(null).regionName, hit(null).regionIndex], ['Skyrim', 'Daggerfall', 'Daggerfall', 17]);
  // the sky a station: its pose its own voyage's, its collider its own bucket
  assert.deepEqual([ketchSkyBucket(0), ketchSkyBucket(SKYRIM)], [KT_SKY_BUCKET, `${KT_SKY_BUCKET}:${SKYRIM}`]);
  assert.equal(ketchSkyPose(now, SKYRIM)?.v.n, ketchVoyageNumber(3, SKYRIM));
  assert.equal(KT_STATION_REACH_PX, Math.ceil((KT_SKY.far + KT_SKY.approach) / TERRAIN_SIZE) + 1, 'the reach the sky\'s own numbers');
});

// ─── the freeware: the stations' cities, and the page ─────────────────────────────────────────

test('KETCH-EVERYWHERE (ARENA2) EACH STATION OVER ITS CROWN\'S SEAT: on the freeware the Bay\'s two crown stations are Daggerfall\'s and Sentinel\'s own MAPS.BSA rows, and every province\'s seat past the Bay stands in its own province on the trace; each anchor-lift\'s pixel (KT_STATION off the city\'s middle) the pixel east of it, its province\'s own dry land with no place on it; and the page frames a station\'s ship where she can be seen - Skyrim\'s at Solitude, Hammerfell\'s at Sentinel - says her words in her province, rings her on the map and boards her own voyage (mutants: the station\'s pixel; the reach; the page\'s province unasked; Sentinel\'s row)', { skip: HAVE ? false : 'ARENA2_PATH not set', timeout: 300_000 }, async () => {
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { groundWoods, tamrielClimateAt, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { gateSeaPixel } = await import('../../../src/systems/gate/gateSite.js');
  const { arenaPixels, setArenaStanding } = await import('../../../src/world/arenaPlaces.js');
  const { capitalOnPixel } = await import('../../../src/world/tamrielCapitals.js');
  const { KT_STATION } = await import('../../../src/world/ketch/ketchModel.js');
  const { KT_LIFT_AT } = await import('../../../src/scenes/ketch/ketchSky.js');
  const { createKetchClient } = await import('../../../src/scenes/ketch/ketchClient.js');
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { spawnedLocationCentreLocal } = await import('../../../src/world/spawnedDungeons.js');
  const { kingdomOf } = await import('../../../src/net/kingdomLaw.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (f) => bytes(f), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  setArenaStanding(true);
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    const ap = arenaPixels();
    const lifts = [];
    // THE BAY'S CROWN STATIONS: each its city's own row (Daggerfall's the arena city's), its pixel pinned, its lift the pixel
    // east on the Bay's dry land, no place on it, under its own crown
    assert.deepEqual(Object.keys(KT_BAY_STATION_ROWS).map(Number), [0, 2]);
    assert.deepEqual([KT_BAY_STATION_ROWS[0].region, KT_BAY_STATION_ROWS[0].location], [ARENA_REGION, ARENA_LOCATION]);
    const bayPlaces = new Set();
    for (let r = 0; r < maps.regionCount; r++) {
      if (!maps.getRegion(r)) continue;
      for (let l = 0; l < maps.baseLocationCount(r); l++) { const q = maps.getLocation(r, l), p = longitudeLatitudeToMapPixel(q.mapTableData.longitude, q.mapTableData.latitude); bayPlaces.add(`${p.x},${p.y}`); }
    }
    for (const th of [0, 2]) {
      const row = KT_BAY_STATION_ROWS[th], loc = maps.getLocation(row.region, row.location), city = KT_STATION_CITIES[th];
      assert.equal(loc.name, city, `lane ${th}'s row is ${city}'s`);
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      assert.deepEqual({ x: p.x, y: p.y }, { ...row.px }, `${city}'s pixel pinned`);
      assert.deepEqual(ketchStationPixel(th), row.px);
      assert.equal(kingdomOf(row.region), KT_STATION_CROWNS[th], `${city} its crown's seat`);
      const [mx, mz] = spawnedLocationCentreLocal(loc);
      const lx = p.x + Math.floor((mx + KT_LIFT_AT.x) / TERRAIN_SIZE), ly = p.y - Math.floor((mz + KT_LIFT_AT.z) / TERRAIN_SIZE);
      assert.equal(gateSeaPixel(maps.getClimateIndex(lx, ly), woods.getHeightMapValue(lx, ly)), false, `${city}'s lift on dry land`);
      assert.equal(bayPlaces.has(`${lx},${ly}`), false, `${city}'s lift on no place`);
      assert.equal(kingdomOf(maps.getPoliticIndex(lx, ly) - 128), KT_STATION_CROWNS[th], `${city}'s lift under its crown`);
      lifts.push([city, lx - p.x, ly - p.y]);
    }
    for (const th of KT_THEATRES.filter((x) => !(x in KT_BAY_STATION_ROWS))) {
      const p = ketchStationPixel(th);
      const stood = ap.stood.find((q) => q.name === KT_STATION_CITIES[th] && q.province === THEATRE_KEYS[th]);
      assert.deepEqual(p, { x: stood.bx, y: stood.by }, `${KT_STATION_CITIES[th]} stands`);
      assert.equal(theatreAt(p.x, p.y), th, `${KT_STATION_CITIES[th]} in its province`);
      // the lift's pixel: KT_LIFT_AT off the pixel's middle
      const lx = p.x + Math.floor((TERRAIN_SIZE / 2 + KT_LIFT_AT.x) / TERRAIN_SIZE), ly = p.y - Math.floor((TERRAIN_SIZE / 2 + KT_LIFT_AT.z) / TERRAIN_SIZE);
      assert.equal(theatreAt(lx, ly), th, `${KT_STATION_CITIES[th]}'s lift in its province`);
      assert.equal(gateSeaPixel(tamrielClimateAt(lx, ly), ground.getHeightMapValue(lx, ly)), false, `${KT_STATION_CITIES[th]}'s lift on dry land`);
      assert.equal(ap.byPixel.get(`${lx},${ly}`) ?? capitalOnPixel(lx, ly) ?? null, null, `${KT_STATION_CITIES[th]}'s lift on no place`);
      lifts.push([KT_STATION_CITIES[th], lx - p.x, ly - p.y]);
    }
    assert.equal(lifts.length, KT_THEATRES.length);
    assert.ok(lifts.every(([, dx, dy]) => dx === 1 && dy === 0), 'the lift on the pixel east of the city, as Daggerfall\'s');
    assert.ok(KT_STATION.x > 0);
    // THE PAGE in Skyrim: her sky framed near Solitude, her words, her ring, her own voyage boarded
    const sol = ketchStationPixel(SKYRIM), nSky = ketchVoyageNumber(4, SKYRIM), V = ketchVoyageOf(nSky);
    assert.equal(V.at - ketchVoyageOf(4).at, 2 * KT_THEATRE_STAGGER_MS, 'her voyage on the round\'s own clock');
    const st = { clock: V.at + KT_SKY.lower + 5000, here: { x: sol.x, y: sol.y }, entered: [], said: [], mids: [] };
    const online = { status: 'open', ktOk: true, ktTheatresOk: true, terminal: false, peers: new Map(), sendKetch: () => true };
    const modes = { mode: 'exterior', ktShip: () => null, enterKetch: async (o) => { st.entered.push(o.n); return false; }, ktLeave: () => false, dungeonCtx: null };
    const col = { buckets: new Map(), addMesh(b) { this.buckets.set(b, 1); }, removeBucket(b) { this.buckets.delete(b); } };
    const kc = createKetchClient({
      online: () => online, modes: () => modes, social: () => null, account: { me: () => 'mem0', claim: async () => ({ ok: true }) },
      entity: { health: 50, maxHealth: 100, level: 10, items: [] }, player: { feetAt: () => [0, 0, 0] }, cam: { pos: [0, 0, 0], yaw: 0 }, now: () => st.clock,
      renderer: { createMesh: (m) => ({ m }), drawMesh: () => {}, destroyMesh() {} }, collider: () => col,
      maps,
      state: { current: st.here, pixelTranslation: (x, y, o) => { o[0] = (x - st.here.x) * TERRAIN_SIZE; o[1] = 0; o[2] = -(y - st.here.y) * TERRAIN_SIZE; return o; } },
      heightAt: () => 50, feetOutside: () => null, say: (t) => st.said.push(t), mid: (t) => st.mids.push(t), store: { get: () => null, set: () => {} },
    });
    await quiet(() => { kc.frame(); kc.frame(); });
    assert.ok(st.said.includes('The Sky-Ketch has arrived over Solitude. Its anchor-lift is down in the fields east of the city.'), 'her word said in Skyrim');
    assert.ok(col.buckets.has(ketchSkyBucket(SKYRIM)), 'Skyrim\'s ship stands to the collider near Solitude');
    const marks = kc.mapMarks();
    assert.deepEqual(marks.filter((m) => m.day === nSky).map((m) => [m.cx, m.cy]), [[sol.x + 0.5, sol.y + 0.5]], 'her ring about Solitude');
    await quiet(() => kc.board(SKYRIM));
    assert.deepEqual(st.entered.map(ketchTheatreOf), [SKYRIM], 'her own voyage boarded');
    // far from every station past the Bay: none framed, none said
    st.here.x = 207; st.here.y = 213; st.said.length = 0;
    await quiet(() => { kc.frame(); kc.frame(); });
    assert.equal(col.buckets.has(ketchSkyBucket(SKYRIM)), false, 'her collider taken back');
    assert.ok(st.said.every((t) => !t.includes('Solitude')), 'no word of Solitude on the Bay');
    // a relay that keeps no station past the Bay: none
    online.ktTheatresOk = false; st.here.x = sol.x; st.here.y = sol.y;
    await quiet(() => kc.frame());
    assert.deepEqual(kc.mapMarks().filter((m) => m.day === nSky), [], 'no ring on an older relay');
    // THE PAGE AT SENTINEL: Hammerfell's station on the Bay - her sky framed at Sentinel, her words, her ring about Sentinel,
    // her own voyage boarded, the lift's default the station of Sentinel's crown (the Bay's politic map read)
    online.ktTheatresOk = true;
    const sen = KT_BAY_STATION_ROWS[2].px, nSen = ketchVoyageNumber(4, 2), V2 = ketchVoyageOf(nSen);
    assert.equal(V2.at - ketchVoyageOf(4).at, KT_THEATRE_STAGGER_MS, 'Sentinel\'s a station after Daggerfall\'s');
    st.clock = V2.at + KT_SKY.lower + 5000; st.here.x = sen.x; st.here.y = sen.y; st.said.length = 0; st.entered.length = 0;
    await quiet(() => { kc.frame(); kc.frame(); });
    assert.ok(st.said.includes('The Sky-Ketch has arrived over Sentinel. Its anchor-lift is down in the fields east of the city.'), 'her word said at Sentinel');
    assert.ok(col.buckets.has(ketchSkyBucket(2)), 'Sentinel\'s ship stands to the collider');
    assert.deepEqual(kc.mapMarks().filter((m) => m.day === nSen).map((m) => [m.cx, m.cy]), [[sen.x + 0.5, sen.y + 0.5]], 'her ring about Sentinel');
    assert.ok(ketchStationNear(2, sen.x + KT_STATION_REACH_PX, sen.y) && !ketchStationNear(2, sen.x + KT_STATION_REACH_PX + 1, sen.y), 'framed within the reach');
    // the frame told the Timers the stations stand and how a Bay pixel's crown is read: Sentinel's rows at Sentinel
    assert.deepEqual(eventTimerRows({ now: st.clock, pixel: { x: sen.x, y: sen.y } }).filter((r) => r.kind === 'ketch').map((r) => r.where), ['Over Daggerfall', 'Over Sentinel']);
    await quiet(() => kc.board());
    assert.deepEqual(st.entered, [nSen], 'the lift at Sentinel boards Sentinel\'s own voyage');
    // on a relay that keeps no station past the Bay's own, the lift's default there is the Bay's own voyage
    online.ktTheatresOk = false; st.entered.length = 0;
    const bay5 = ketchVoyageOf(5);
    st.clock = bay5.at + 60_000;
    await quiet(() => kc.board());
    assert.deepEqual(st.entered, [5], 'an older relay: the Bay\'s own');
    online.ktTheatresOk = true; st.clock = V2.at + KT_SKY.lower + 5000;
    // at Daggerfall the default is the Bay's own; Sentinel's sky taken back
    st.here.x = 207; st.here.y = 213; st.entered.length = 0;
    await quiet(() => { kc.frame(); kc.frame(); });
    assert.equal(col.buckets.has(ketchSkyBucket(2)), false, 'Sentinel\'s collider taken back at Daggerfall');
    st.clock = ketchVoyageOf(4).at + 60_000;
    await quiet(() => kc.board());
    assert.deepEqual(st.entered, [4], 'Daggerfall\'s lift boards the Bay\'s voyage');
  } finally { setArenaStanding(false); setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
