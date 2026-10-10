// SD3 (2026-10-05, Mac: "Super dungeons are random finds on the world map, and spawn where population is at its most.
// Only one can be active at a time."): THE SUPER DUNGEON ON THE RELAY - the hub's director moves its one record on
// (net/sdLaw.js) on its alarm, asks the 62 region channels their census before a rise, and says every move to everyone
// online and the record at every hello; the cell a Hollow stands in hears its finder from the socket's own pose and tells
// the hub until it answers; a Hollow's realm (`sd:<s>`) is minted and admits by the hub's record. One frame, `sd`
// (net/wire.js). bible/11-Multiplayer/Super-Dungeons.md sections 2-4 and 14.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../server/src/index.js';
import {
  SD_RELAY_MIN, relaySupportsSd, RELAY_VERSION, SD_KINDS, SD_OUT_KINDS, validSdIn, validSdOut, validSdFoundTell, parseClient,
  SD_INTERNAL_CENSUS, SD_INTERNAL_FOUND, SD_INTERNAL_LIVE, SD_TELL_RETRY_MS, SD_KEY, SD_FOUND_KEY, SD_REALM_KEY, SD_HZ_MAX,
  SD_RELAY_BURST, SD_REGION_COUNT, CHAT_REGION_COUNT, chatRegionRoom, worldRoom, SOCIAL_ROOM, PIXEL_UNITS, validSdRecord, sanitizeName,
} from '../src/net/wire.js';
import * as sdLaw from '../src/net/sdLaw.js';
import {
  SD_FIRST_RISE_MS, SD_LIFETIME_MS, SD_COOLDOWN_MS, SD_COLLAPSE_MS, SD_FOUND_RADIUS_M, sdFell, sdRoomKey, SD_NO_CLOSED,
  SD_NO_FULL, SD_NO_RIFT, SD_FOUND_NEAR_M, SD_FOUND_RESEND_MS,
} from '../src/net/sdLaw.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { fakeRooms } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const PX = 300, PY = 200;
const CELL = worldRoom(PX, PY);
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
/** A pose `east` metres east of pixel (px, py)'s centre - where a spawned dungeon stands (MapsFile's frame). */
const doorPose = (east = 10, px = PX, py = PY) => ({ x: (px + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - py - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const sds = (ws) => ws.sent.filter((m) => m.t === 'sd');
const T0 = 1_800_000_000_000;

async function withWorld(fn, { start = T0 } = {}) {
  const realNow = Date.now;
  let clock = start;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  // a hub account's socket: the hello that marks the room a hub and arms its alarm
  const hubber = async (n) => { const ws = hub.connect(); await hub.hello(ws, `peer-h${n}`, null, { name: `H${n}`, acct: `acct-h${n}`, asecret: `secret-of-acct-h${n}` }); return ws; };
  // a socket in region r's channel - registered (`kind: 'linked'`) or a guest - for the account `sub`
  const inRegion = async (r, id, sub, kind = 'linked') => { const room = world.room(chatRegionRoom(r)); const ws = room.connect(); await room.hello(ws, id, null, { kind, tokenSub: sub }); return ws; };
  const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
  try { await quiet(() => fn({ world, hub, hubber, inRegion, fire, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } })); }
  finally { Date.now = realNow; }
}

/** The world driven to a risen Hollow - slot 1, in region 17 (two registered accounts stand there). */
async function risen(W) {
  const h = await W.hubber(1);
  await W.fire(W.hub);
  W.set(W.hub.room._sdRec.next);
  await W.inRegion(17, 'peer-r1', 'acct-r1');
  await W.inRegion(17, 'peer-r2', 'acct-r2');
  await W.fire(W.hub);
  return h;
}

test('SD3 the wire: the frame\'s one kind each way, projected; the record\'s law moved beside it (net/sdLaw.js re-exports it); the relay that keeps it - world176 (mutants: a slot of 0 believed; a pixel off the map; the record\'s s 0 fanned; the version gate a version early)', () => {
  assert.equal(RELAY_VERSION, 'world186');   // PIN MOVED: world186, INT11-INT14 (the INTEGRITY arc's lane 3); PIN MOVED: world183, CHAP4c (the chapters' seats' titles on the token - past THE WROTHGARIAN ZONE's world177, TAVERN CARDS' world178, HOURS-FIRST's world179, TAVERN-TABLES' world180, TV-BEYOND's world181 and CARDS10's world182 at the merges); SUPER-DUNGEONS - world171 on its branch, then world172 and world175, renumbered past main's CRYSTAL-FIST, WATCH-FIX, SERPENT3, LEGACY7 and TEXT-F1 at the merges (PIN MOVED)
  assert.equal(SD_RELAY_MIN, 176, 'the Super Dungeons arc\'s one version (world171 on its branch, then world172 and world175; main\'s CRYSTAL-FIST, WATCH-FIX, SERPENT3, LEGACY7 and TEXT-F1 took world171-world175)');
  assert.equal(relaySupportsSd(RELAY_VERSION), true);
  assert.equal(relaySupportsSd('world174'), false, 'LEGACY7\'s relay closes the socket on `sd`');
  for (const v of [undefined, null, '', 'world', 'world17x', 'acct172', 172]) assert.equal(relaySupportsSd(v), false, String(v));
  assert.deepEqual([...SD_KINDS], ['found', 'pz', 'in', 'hit', 'ehit', 'xhit', 'spent']);   // SD9a: and a slot's spoils taken (PIN MOVED)   // SD6b: and `pz`, the Orrery's turn (PIN MOVED); SD8b: and the fight's words (PIN MOVED)
  assert.deepEqual([...SD_OUT_KINDS], ['ev', 'pz', 'st', 'mv', 'atk', 'hp', 'ph', 'ec', 'cx', 'cxh', 'cxb', 'stun', 'fell', 'lost', 'no', 'rcpt']);   // SD9a: and the fall's receipt (PIN MOVED)   // SD6b: and `pz`, the Orrery's hall (PIN MOVED); SD8b: and the fight's (PIN MOVED)
  assert.deepEqual(validSdIn({ k: 'found', s: 3, px: PX, py: PY, junk: 1 }), { k: 'found', s: 3, px: PX, py: PY }, 'projected');
  for (const bad of [{ k: 'found', s: 0, px: 1, py: 1 }, { k: 'found', s: 1e9, px: 1, py: 1 }, { k: 'found', s: 1.5, px: 1, py: 1 }, { k: 'found', s: 1, px: 1000, py: 1 }, { k: 'found', s: 1, px: 1, py: 500 }, { k: 'found', s: 1, px: -1, py: 1 }, { k: 'ev', s: 1, px: 1, py: 1 }, null, 'found']) assert.equal(validSdIn(bad), null, JSON.stringify(bad));
  assert.equal(parseClient(JSON.stringify({ t: 'sd', k: 'found', s: 1, px: 1, py: 1 })).error, 'sd before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'sd', k: 'found', s: 0, px: 1, py: 1 }), { hasHello: true }).error, 'bad sd');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'sd', k: 'found', s: 7, px: 1, py: 2 }), { hasHello: true }), { t: 'sd', k: 'found', s: 7, px: 1, py: 2 });
  // the hub's word: the record, through its own law, a Hollow that rose
  const rec = { s: 2, ph: 'found', r: 17, at: 10, until: 20, next: 30, foundAt: 12, fb: 'Mara' };
  assert.deepEqual(validSdOut({ t: 'sd', k: 'ev', ...rec }), { k: 'ev', ...rec });
  assert.equal(validSdOut({ t: 'sd', k: 'ev', ...rec, s: 0, ph: 'gone' }), null, 'the hub\'s own first beat is said to nobody');
  assert.equal(validSdOut({ t: 'sd', k: 'ev', ...rec, ph: 'lost' }), null);
  assert.equal(validSdOut({ t: 'sd', k: 'found', ...rec }), null, 'a kind the client does not know');
  assert.equal(validSdOut({ t: 'sd', k: 'ev', ...rec, fb: 'Ma\u0000ra\u202e' }).fb, 'Mara', 'the names sanitized at both ends (wire.js sanitizeName)');
  assert.equal(validSdOut({ t: 'sd', k: 'ev', ...rec, top: 'x'.repeat(200) }).top, sanitizeName('x'.repeat(200)), 'and bounded');
  // the record's law is the wire's, and the law's module hands on the same one
  assert.equal(sdLaw.validSdRecord, validSdRecord);
  assert.equal(SD_REGION_COUNT, CHAT_REGION_COUNT, 'a census region is a region\'s channel');
  // the cell's tell to the hub
  assert.deepEqual(validSdFoundTell({ s: 1, px: 2, py: 3, x: 4.5, z: 6, fb: 'Mara', extra: 1 }), { s: 1, px: 2, py: 3, x: 4.5, z: 6, fb: 'Mara' });
  for (const bad of [{ s: 0, px: 2, py: 3, x: 4, z: 6, fb: 'M' }, { s: 1, px: 2, py: 3, x: NaN, z: 6, fb: 'M' }, { s: 1, px: 2, py: 3, x: 4, z: 6 }, null]) assert.equal(validSdFoundTell(bad), null);
  assert.equal(SD_INTERNAL_CENSUS, '/internal/sd/census');
  assert.equal(SD_INTERNAL_FOUND, '/internal/sd/found');
  assert.equal(SD_INTERNAL_LIVE, '/internal/sd/live');
  assert.equal(SD_TELL_RETRY_MS, 5000);
  assert.deepEqual([SD_KEY, SD_FOUND_KEY, SD_REALM_KEY], ['sdev', 'sdfound', 'sdrealm'], 'never under a prefix the sweeps delete');
  assert.equal(SD_HZ_MAX, 1); assert.equal(SD_RELAY_BURST, 3);
  assert.equal(SD_NO_RIFT, 'The Rift will not take you yet.');
  assert.equal(SD_NO_CLOSED, 'The Hour has closed.');
  assert.equal(SD_NO_FULL, 'The Hour is full.');
  assert.equal(SD_FOUND_NEAR_M, 25);
  assert.equal(SD_FOUND_RESEND_MS, 15_000);
});

test('SD3 the director: a hub\'s first account hello arms it; its first beat keeps slot 0 and waits SD_FIRST_RISE_MS, saying nothing; then the census - the distinct REGISTERED accounts in each region\'s channel - raises slot 1 where the most stand, fanned to everyone and said at every hello; its time run out, gone, fanned; after the rest, the next - in the Bay\'s great cities when no region holds two (mutants: a guest counted; one account\'s two tabs counted twice; the first beat raising at once; the gone unsaid; the welcome without the record)', async () => {
  await withWorld(async (W) => {
    const h1 = await W.hubber(1);
    assert.equal(W.hub.alarm.at, T0, 'armed at once: the director has no record');
    await W.fire(W.hub);
    const first = W.hub.store.get(SD_KEY);
    assert.deepEqual(first, { s: 0, ph: 'gone', r: -1, at: T0, until: T0, next: T0 + SD_FIRST_RISE_MS });
    assert.equal(sds(h1).length, 0, 'the first beat is said to nobody');
    assert.ok(W.hub.alarm.at <= T0 + SD_FIRST_RISE_MS, 'the alarm armed for the rise');
    // the crowd: region 17 two registered accounts; region 9 one account in two tabs; region 5 three guests
    await W.inRegion(17, 'peer-r1', 'acct-r1');
    await W.inRegion(17, 'peer-r2', 'acct-r2');
    await W.inRegion(9, 'peer-n1', 'acct-n1');
    await W.inRegion(9, 'peer-n2', 'acct-n1');
    for (const i of [1, 2, 3]) await W.inRegion(5, `peer-g${i}`, `acct-g${i}`, 'guest');
    assert.deepEqual(await W.world.room(chatRegionRoom(9)).room.fetch(new Request(`https://relay.internal${SD_INTERNAL_CENSUS}`, { method: 'POST', body: '{}' })).then((r) => r.json()), { n: 1 }, 'one account, however many tabs');
    assert.deepEqual(await W.world.room(chatRegionRoom(5)).room.fetch(new Request(`https://relay.internal${SD_INTERNAL_CENSUS}`, { method: 'POST', body: '{}' })).then((r) => r.json()), { n: 0 }, 'a guest is one click: never counted');
    W.set(T0 + SD_FIRST_RISE_MS - 1);
    await W.hub.fire();
    assert.equal(W.hub.store.get(SD_KEY).s, 0, 'not before its instant');
    W.set(T0 + SD_FIRST_RISE_MS);
    await W.fire(W.hub);
    const rec = W.hub.store.get(SD_KEY);
    const at = T0 + SD_FIRST_RISE_MS;
    assert.deepEqual(rec, { s: 1, ph: 'risen', r: 17, at, until: at + SD_LIFETIME_MS, next: at + SD_LIFETIME_MS + SD_COOLDOWN_MS });
    assert.deepEqual(sds(h1).at(-1), { t: 'sd', k: 'ev', ...rec }, 'fanned');
    assert.ok(W.hub.alarm.at <= rec.until, 'armed for its fading');
    // a hello hears the record after its welcome
    const h2 = await W.hubber(2);
    const said = h2.sent.findIndex((m) => m.t === 'sd'), welcomed = h2.sent.findIndex((m) => m.t === 'welcome');
    assert.ok(welcomed >= 0 && said > welcomed, 'after the welcome');
    assert.deepEqual(h2.sent[said], { t: 'sd', k: 'ev', ...rec });
    // its time runs out: gone, said; then the rest; then the next, in the Bay's great cities (nobody counted twice now)
    for (const r of [17, 9]) for (const ws of W.world.room(chatRegionRoom(r)).sockets.slice()) await W.world.room(chatRegionRoom(r)).drop(ws);
    W.set(rec.until);
    await W.fire(W.hub);
    assert.deepEqual(sds(h1).at(-1), { t: 'sd', k: 'ev', ...rec, ph: 'gone' }, 'the fading said');
    assert.equal(W.hub.store.get(SD_KEY).ph, 'gone');
    W.set(rec.next);
    await W.fire(W.hub);
    const next = W.hub.store.get(SD_KEY);
    assert.equal(next.s, 2);
    assert.equal(next.r, -1, 'no region holds two: the Bay\'s great cities');
  });
});

test('SD3 the census\'s rest: the last Hollow\'s region rests while another qualifies, and keeps it when none does; a channel that does not answer counts nobody (mutants: the last region never resting)', async () => {
  await withWorld(async (W) => {
    await risen(W);
    assert.equal(W.hub.store.get(SD_KEY).r, 17);
    await W.inRegion(30, 'peer-t1', 'acct-t1');
    await W.inRegion(30, 'peer-t2', 'acct-t2');
    await W.inRegion(17, 'peer-r3', 'acct-r3');
    W.set(W.hub.store.get(SD_KEY).until); await W.fire(W.hub);
    W.set(W.hub.store.get(SD_KEY).next); await W.fire(W.hub);
    assert.equal(W.hub.store.get(SD_KEY).r, 30, 'region 17 holds three, but it rests: 30 holds two');
    // only region 30 qualifies now: it keeps the next too
    for (const ws of W.world.room(chatRegionRoom(17)).sockets.slice()) await W.world.room(chatRegionRoom(17)).drop(ws);
    W.set(W.hub.store.get(SD_KEY).until); await W.fire(W.hub);
    // and a region whose channel does not answer counts nobody
    const get = W.world.ROOMS.get;
    W.world.ROOMS.get = (id) => (id === chatRegionRoom(30) ? { fetch: async () => { throw new Error('down'); } } : get(id));
    W.set(W.hub.store.get(SD_KEY).next); await W.fire(W.hub);
    assert.equal(W.hub.store.get(SD_KEY).r, -1, 'the only crowd did not answer: the great cities');
    W.world.ROOMS.get = get;
  });
});

test('SD3 the find: the cell believes its own socket\'s pose near the claimed pixel\'s centre, keeps the first finder\'s word and tells the hub; the hub believes it while its record says risen for that slot - found, the finder\'s VERIFIED name kept and fanned; a word from afar keeps nothing, one naming another cell\'s pixel is junk; the hub down, the cell tells it again on its alarm until it answers, and a find the hub refuses for good is let go (mutants: the pose unasked at the cell; the slot unasked at the hub; the tell never retried; the first finder\'s word overwritten; a refusal told for ever)', async () => {
  await withWorld(async (W) => {
    const h1 = await risen(W);
    const rec = W.hub.store.get(SD_KEY);
    const cell = W.world.room(CELL);
    // the hub down from here, so whatever the cell keeps stays kept: what it refuses it never kept at all
    const get = W.world.ROOMS.get;
    W.world.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async () => new Response('no', { status: 503 }) } : get(id));
    const far = cell.connect(); await cell.hello(far, 'peer-far', doorPose(SD_FOUND_RADIUS_M + 20), { name: 'Afar' });
    await cell.raw(far, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
    assert.equal(cell.store.get(SD_FOUND_KEY), undefined, 'from afar: nothing kept');
    assert.equal(W.hub.store.get(SD_KEY).ph, 'risen');
    const other = cell.connect(); await cell.hello(other, 'peer-oth', doorPose(5), { name: 'Other' });
    await cell.raw(other, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX + 40, py: PY }));
    assert.equal(cell.store.get(SD_FOUND_KEY), undefined, 'another cell\'s pixel: junk');
    assert.ok((other.meters.junk ?? 0) >= 1 || other.closed, 'struck as junk');
    // a finder at the door, the hub down: kept, the retry armed before the tell
    const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
    await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY, fb: 'Forged' }));
    assert.equal(cell.store.get(SD_FOUND_KEY).fb, 'Mara', 'the verified name, never the frame\'s');
    assert.equal(W.hub.store.get(SD_KEY).ph, 'risen', 'the hub never heard it');
    assert.ok(cell.alarm.at != null && cell.alarm.at <= Date.now() + SD_TELL_RETRY_MS, 'the retry armed');
    // a second finder while it is owed: the first finder's stands
    const bo = cell.connect(); await cell.hello(bo, 'peer-bo', doorPose(-10), { name: 'Bo' });
    await cell.raw(bo, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
    assert.equal(cell.store.get(SD_FOUND_KEY).fb, 'Mara');
    // the hub back: the alarm tells it
    W.world.ROOMS.get = get;
    W.step(SD_TELL_RETRY_MS);
    await W.fire(cell);
    assert.equal(cell.store.get(SD_FOUND_KEY), undefined, 'let go once the hub answered');
    const found = W.hub.store.get(SD_KEY);
    assert.equal(found.ph, 'found');
    assert.equal(found.fb, 'Mara');
    assert.ok(found.foundAt >= rec.at);
    assert.deepEqual(sds(h1).at(-1), { t: 'sd', k: 'ev', ...found }, 'fanned');
    // a word for another slot, or a second find: the hub answers and moves nothing
    const doorTell = (body) => W.hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FOUND}`, { method: 'POST', body: JSON.stringify(body) }));
    assert.equal((await doorTell({ s: rec.s, px: PX, py: PY, ...doorPose(1), fb: 'Late' })).status, 200);
    assert.equal(W.hub.store.get(SD_KEY).fb, 'Mara', 'found once');
    assert.equal((await doorTell({ s: 9, px: PX })).status, 400, 'a body the hub will never take');
    // a hub that refuses a find FOR GOOD (a 4xx) is not told it again: the cell lets it go
    W.world.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async () => new Response('bad', { status: 400 }) } : get(id));
    W.set(Date.now() + 10 * 60_000);   // AUDIT SD II (PIN MOVED, L7 M4): the hub's last word on its slot grown old - another slot's find is told
    const cy = cell.connect(); await cell.hello(cy, 'peer-cy', doorPose(12), { name: 'Cy' });
    await cell.raw(cy, JSON.stringify({ t: 'sd', k: 'found', s: rec.s + 1, px: PX, py: PY }));
    assert.equal(cell.store.get(SD_FOUND_KEY), undefined, 'refused for good: let go');
    W.world.ROOMS.get = get;
  });
  await withWorld(async (W) => {
    await risen(W);
    const rec = W.hub.store.get(SD_KEY);
    const tell = (body) => W.hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FOUND}`, { method: 'POST', body: JSON.stringify(body) }));
    await tell({ s: rec.s + 1, px: PX, py: PY, ...doorPose(1), fb: 'Wrong' });
    assert.equal(W.hub.store.get(SD_KEY).ph, 'risen', 'another slot\'s find');
    await tell({ s: rec.s, px: PX, py: PY, ...doorPose(SD_FOUND_RADIUS_M + 5), fb: 'Afar' });
    assert.equal(W.hub.store.get(SD_KEY).ph, 'risen', 'the hub asks the pose again');
    W.set(rec.until);
    await tell({ s: rec.s, px: PX, py: PY, ...doorPose(1), fb: 'Late' });
    assert.notEqual(W.hub.store.get(SD_KEY).ph, 'found', 'faded: no find');
  });
});

test('SD3 the realm: the Worker mints `sd:<s>` only for the slot the hub\'s record holds - found, or fallen and collapsing; the realm admits a newcomer while it is found, one who entered before until it is gone, one seat an account (mutants: the Worker unasked; a newcomer after the kill; a returner refused; two seats)', async () => {
  await withWorld(async (W) => {
    await risen(W);
    const rec = W.hub.store.get(SD_KEY);
    const forwarded = [];
    const env = { ROOMS: { idFromName: (n) => n, get: (id) => (id === SOCIAL_ROOM ? W.world.ROOMS.get(id) : { fetch: async () => { forwarded.push(id); return new Response('ok'); } }) } };
    const at = (k, ws = true) => worker.fetch(new Request(`https://relay.invalid/room/${k}`, ws ? { headers: { Upgrade: 'websocket' } } : {}), env);
    assert.equal((await at(sdRoomKey(rec.s))).status, 404, 'risen, not found: no realm');
    assert.equal((await at('sd:01')).status, 404, 'a key the hub never mints');
    assert.equal((await at(sdRoomKey(rec.s), false)).status, 426, 'a socket only');
    // found
    const cell = W.world.room(CELL);
    const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
    await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
    assert.equal(W.hub.store.get(SD_KEY).ph, 'found');
    assert.equal((await at(sdRoomKey(rec.s))).status, 200, 'found: the realm stands');
    assert.deepEqual(forwarded, [sdRoomKey(rec.s)]);
    assert.equal((await at(sdRoomKey(rec.s + 1))).status, 404, 'another slot');
    // the realm's own hello
    const realm = W.world.room(sdRoomKey(rec.s));
    const a = realm.connect(); await realm.hello(a, 'peer-a', null, { name: 'Ann' });
    assert.equal(a.closed, null, 'a newcomer while found');
    assert.deepEqual(realm.store.get(SD_REALM_KEY), { s: rec.s, in: ['acct-peer-a'], gu: ['acct-peer-a'], dead: [] });   // AUDIT SD II (PIN MOVED, L7 M3): and the guests among them; SD-ONELIFE (PIN MOVED): and its dead
    const a2 = realm.connect(); await realm.hello(a2, 'peer-a2', null, { name: 'Ann', tokenSub: 'acct-peer-a' });
    assert.equal(a.closed?.reason, 'replaced', 'one seat an account');
    // the boss falls: the record says fell (the realm's own slice says it in SD8 - here, the hub's record moved)
    const fell = sdFell(W.hub.store.get(SD_KEY), Date.now(), { top: 'Ann', n: 1 });
    await W.hub.room._sdSave(fell);
    W.step(10_001);   // past the realm's kept answer
    const b = realm.connect(); await realm.hello(b, 'peer-b', null, { name: 'Bo' });
    assert.equal(b.closed?.reason, SD_NO_CLOSED, 'a newcomer after the kill');
    const a3 = realm.connect(); await realm.hello(a3, 'peer-a3', null, { name: 'Ann', tokenSub: 'acct-peer-a' });
    assert.equal(a3.closed, null, 'one who entered before, until it is gone');
    assert.equal((await at(sdRoomKey(rec.s))).status, 200, 'collapsing: the realm still stands');
    W.set(fell.fellAt + SD_COLLAPSE_MS);
    W.step(10_001);
    const a4 = realm.connect(); await realm.hello(a4, 'peer-a4', null, { name: 'Ann', tokenSub: 'acct-peer-a' });
    assert.equal(a4.closed?.reason, SD_NO_CLOSED, 'gone: nobody');
    assert.equal((await at(sdRoomKey(rec.s))).status, 404, 'gone: no realm minted');
  });
});

test('SD3 the session: a find goes down the socket of the cell its pixel is in, only to a relay that keeps it - a halo\'s by its own welcome, each socket keeping its own word across a seam; SD_HZ_MAX a second; the hub\'s record heard from the hub alone (mutants: the halo never keeps it; the promotion forgets it; any room; unmetered; a cell\'s word believed)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const log = console.info; console.info = () => {};
  const heard = [];
  s.onSd = (r, room) => heard.push([r, room]);
  try {
    const here = worldRoom(PX, PY), there = worldRoom(PX + 16, PY);
    s.join(here, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION });
    assert.equal(s.sdOk, true);
    s.setHalo([there]);
    sockets[1].open();
    sockets[1].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: 'world171' });
    const w = { s: 1, px: PX, py: PY }, w2 = { ...w, px: PX + 16 };
    assert.equal(s.sendSdFound(w2, there), false, 'the halo on an older relay is said none');
    assert.equal(s.sendSdFound(w, here), true);
    assert.deepEqual(JSON.parse(sockets[0].sent.at(-1)), { t: 'sd', k: 'found', s: 1, px: PX, py: PY });
    s.join(there, null);
    assert.equal(s.sdOk, false, 'the promoted socket\'s word');
    t += 1000;
    assert.equal(s.sendSdFound(w2, there), false);
    assert.equal(s.sendSdFound(w, here), true, 'the stepped-down socket\'s own word');
    assert.equal(s.sendSdFound(w, 'dungeon:m1'), false, 'no cell');
    assert.equal(s.sendSdFound({ s: 0, px: PX, py: PY }, here), false, 'a word the wire would refuse');
    t += 1000;
    for (let i = 0; i < SD_HZ_MAX; i++) assert.equal(s.sendSdFound(w, here), true);
    assert.equal(s.sendSdFound(w, here), false, 'SD_HZ_MAX a second');
    // a cell's `sd` frame is no record: dropped
    sockets[1].receive({ t: 'sd', k: 'ev', s: 1, ph: 'risen', r: 3, at: 1, until: 2, next: 3 });
    assert.equal(heard.length, 0, 'a cell never says the record');
  } finally { console.info = log; }
  const k = fakeSocketClass();
  const hubS = new OnlineSession({ url: 'wss://relay.test', name: 'b', id: 'bbbb-0001', secret: 'secret-of-bbbb-0001', WebSocketImpl: k.FakeWS, now: () => t });
  const got = [];
  hubS.onSd = (r, room) => got.push([r, room]);
  console.info = () => {};
  try {
    hubS.join(SOCIAL_ROOM, null);
    k.sockets[0].open();
    k.sockets[0].receive({ t: 'welcome', id: 'bbbb-0001', peers: [], n: 1, v: RELAY_VERSION });
    const rec = { s: 1, ph: 'risen', r: 3, at: 1, until: 2, next: 3 };
    k.sockets[0].receive({ t: 'sd', k: 'ev', ...rec });
    assert.deepEqual(got, [[{ k: 'ev', ...rec }, SOCIAL_ROOM]], 'the hub\'s record, projected');
    k.sockets[0].receive({ t: 'sd', k: 'ev', ...rec, ph: 'odd' });
    assert.equal(got.length, 1, 'a record the law refuses is dropped');
  } finally { console.info = log; }
  // a halo on a relay that keeps it says it for itself; a primary that is no cell is said none
  const h = fakeSocketClass();
  const s2 = new OnlineSession({ url: 'wss://relay.test', name: 'c', id: 'cccc-0001', secret: 'secret-of-cccc-0001', WebSocketImpl: h.FakeWS, now: () => t });
  console.info = () => {};
  try {
    const here = worldRoom(PX, PY), there = worldRoom(PX + 16, PY);
    s2.join(here, null);
    h.sockets[0].open();
    h.sockets[0].receive({ t: 'welcome', id: 'cccc-0001', peers: [], host: 'cccc-0001', world: null, v: RELAY_VERSION });
    s2.setHalo([there]);
    h.sockets[1].open();
    h.sockets[1].receive({ t: 'welcome', id: 'cccc-0001', peers: [], n: 1, v: RELAY_VERSION });
    assert.equal(s2.sendSdFound({ s: 1, px: PX + 16, py: PY }, there), true, 'the halo\'s own welcome');
    assert.equal(h.sockets[1].sent.filter((x) => JSON.parse(x).t === 'sd').length, 1, 'down the halo\'s socket');
    const d = fakeSocketClass();
    const dn = new OnlineSession({ url: 'wss://relay.test', name: 'd', id: 'dddd-0001', secret: 'secret-of-dddd-0001', WebSocketImpl: d.FakeWS, now: () => t });
    dn.join('dungeon:m1', null);
    d.sockets[0].open();
    d.sockets[0].receive({ t: 'welcome', id: 'dddd-0001', peers: [], host: 'dddd-0001', world: null, v: RELAY_VERSION });
    assert.equal(dn.sendSdFound({ s: 1, px: PX, py: PY }, 'dungeon:m1'), false, 'no cell: never a word the relay would strike as junk');
    assert.equal(d.sockets[0].sent.filter((x) => JSON.parse(x).t === 'sd').length, 0);
  } finally { console.info = log; }
});

test('SD3 the relay by source: the hub\'s alarm beats the director beside the sweep and the heralds, its first account hello arms it, its welcome says the record; a cell\'s alarm tells a find owed beside the rite\'s; the Worker asks the hub after the socket\'s own check; the internal doors routed; the census counts registered accounts alone (mutants: each seam removed)', () => {
  const r = read('server/src/index.js');
  assert.match(r, /await this\._serpentHeraldBeat\(Date\.now\(\)\); await this\._sdBeat\(Date\.now\(\)\); return; \}/);
  assert.match(r, /await this\._sdArm\(now\);   \/\/ SD3/);
  assert.match(r, /if \(isSocialRoom\(a\.key\)\) \{ try \{ const r = await this\._sdOf\(\); if \(r && r\.s > 0\) this\._send\(ws, JSON\.stringify\(\{ t: 'sd', k: 'ev', \.\.\.r \}\)\); \}/);
  assert.match(r, /const sdOwed = await this\._sdTellHub\(Date\.now\(\)\);/);
  assert.match(r, /if \(sdOwed\) await this\._sdCellArm\(Date\.now\(\) \+ SD_TELL_RETRY_MS\); return; \}/);
  const upgrade = r.indexOf("!== 'websocket') return json({ error: 'websocket only' }, 426);");
  const asked = r.indexOf('const rec = await sdLiveAsk(env.ROOMS, s);');
  assert.ok(upgrade > 0 && asked > upgrade, 'the hub asked after the socket\'s own check');
  for (const [path, fn] of [['SD_INTERNAL_CENSUS', '_sdCensusInternal()'], ['SD_INTERNAL_FOUND', '_sdFoundInternal(request)'], ['SD_INTERNAL_LIVE', '_sdLiveInternal()']]) assert.ok(r.includes(`if (path === ${path}) return this.${fn};`), path);
  assert.match(r, /const linked = \(isRegionRoom\(a\.key\) \|\| realmRoom\) && who\.kind === 'linked' \? \{ lk: 1 \} : \{\};/);   // AUDIT SD II (PIN MOVED, L7 H2): and a realm's
  assert.match(r, /if \(b\.id && b\.lk && typeof b\.sub === 'string' && b\.sub\) subs\.add\(b\.sub\);/);
  // AUDIT SD II (PIN MOVED, L7 M1/M3): the realm's own gate after the token, by account, then the admission - a guest as one
  assert.match(r, /if \(realmRoom\) \{\n {8}const known = !!who\.subject && \(await this\._sdRealmOf\(sdSlotOfRoom\(a\.key\)\)\)\.in\.includes\(who\.subject\);\n {8}gate = await this\._battleHelloGate\(who\.subject \?\? m\.id, known \? 'fighter' : 'watch', now\);/);
  assert.match(r, /const no = await this\._sdAdmit\(a\.key, who\.subject, now, who\.kind !== 'linked'\);/);
  assert.match(r, /if \(no === SD_NO_BUSY\) \{ this\._refuse\(ws, 'busy', CLOSE_BUSY\); return; \}/);
  assert.match(r, /if \(!battle && !floor && !realmRoom\) \{/);
  const on = read('src/net/online.js');
  assert.match(on, /if \(r && isSocialRoom\(room\)\) this\._deliver\('sd', \(\) => this\.onSd\?\.\(r, room\)\);/);
  assert.match(on, /this\.serpentOk = !!h\.serpentOk; this\.sdOk = !!h\.sdOk;/);
});
