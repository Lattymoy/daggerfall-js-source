// RAID-ROLL (2026-09-28, Mac: "Fix it" - AUDIT RAID's "not changed": the relay held no copy of the day's schedule, so a
// modified client could name a raid the day never rolled, stand on its own pixel and be paid for it, and a many-socket
// griefer could fill a cell's eight places with raids it kept "fought"). THE DAY'S ROLL IS THE RELAY'S TOO:
//   - a raid's start, party and target are the day's generator's alone - the relay reads every word against the day's
//     slots with no game data (net/raid/raidLaw.js raidDaySlots), one generator for relay and client (raidDayRandom);
//   - its region and town are the towns table's (the player's game files): a client hands the hub the table it asks
//     for by the operator's pinned hash (RAID_TOWNS_SHA256), the hub keeps only a table that hashes to it, and every
//     cell then reads a word against the day's whole roll (raidDayIds) - its key and pixel too, or nothing.
// Driven through the real Room (fakeRoom.mjs), the real session and the real raid module. bible/03-World/
// Raiding-Parties.md, "RAID-ROLL".
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import {
  raidDayRandom, raidsPerDay, rollRaidTowns, raidDaySlots, raidOnSlot, raidTownsCanon, readRaidTowns, raidTownsHash,
  raidDayIds, raidLedgerId, RAID_DAY_SALT, RAID_SLOTS_MAX, RAID_REGIONS_MAX, RAID_TOWNS_BYTES_MAX, RAID_TOWNS_CHUNK,
  RAID_TOWNS_CHUNKS_MAX, RAID_TOWNS_SHA_RE, RAID_DAY_MINUTES,
} from '../../src/net/raid/raidLaw.js';
import {
  validRaidTownsIn, validRaidOut, parseClient, raidTownsGate, RAID_TOWNS_HZ_MAX, RAID_OUT_KINDS, RAID_INTERNAL_DAY,
  RAID_DAY_ASK_MS, worldRoom, wallMsForClassicMinutes, SOCIAL_ROOM, PIXEL_UNITS, raidLedgerKey, RELAY_VERSION,
} from '../../src/net/wire.js';
import { dayRng, DAY_SALT } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import {
  raidsForDay, rollRaids, RAID_REGION_REAL_HOURS, GAME_DAY_REAL_HOURS, raidTownsFor, setRaidingPartiesHost, _resetRaidingParties, raidRegions, RAID_TOWN_TYPES,
} from '../../src/systems/raidingParties.js';
import { fakeRooms } from '../fakeRoom.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

/** A towns table as raidRegions reads one: four regions, every town in one cell (world:6,12). */
const TOWNS = Object.freeze([
  { region: 3, towns: [{ index: 7, px: 100, py: 200 }, { index: 8, px: 101, py: 201 }, { index: 9, px: 102, py: 202 }] },
  { region: 5, towns: [{ index: 1, px: 103, py: 203 }, { index: 2, px: 104, py: 204 }] },
  { region: 9, towns: [{ index: 4, px: 105, py: 205 }, { index: 6, px: 106, py: 206 }] },
  { region: 12, towns: [{ index: 0, px: 107, py: 207 }] },
]);
const TEXT = raidTownsCanon(TOWNS);
const PIN = sha(TEXT);
const D = 600;
const wordOf = (r, day = D) => ({ k: 'w', key: `${r.region}:${r.town.index}:${day}`, st: r.st, tg: r.tg, ty: r.ty, px: r.town.px, py: r.town.py, n: 0, s: 0 });
const raids = (ws, k) => ws.sent.filter((m) => m.t === 'raid' && (!k || m.k === k));
const ledgers = (room) => [...room.store.keys()].filter((k) => k.startsWith('raid:'));
const on = (px, py) => ({ x: px * PIXEL_UNITS + 16384, y: 0, z: (499 - py) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 });

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════

test('RAID-ROLL law: THE DAY\'S GENERATOR is worldTick\'s for the raids\' salt - one copy for the relay and the client, whose roll is the law\'s; the count is the pace\'s; every raid any table rolls is on one of the day\'s slots, which are the draws alone (mutants: the seed off; the salt off; the slot\'s draws misread; the count off)', () => {
  assert.equal(RAID_DAY_SALT, DAY_SALT.raids);
  for (const day of [0, 1, 600, 99_999, 9_999_999]) {
    const a = raidDayRandom(day), b = dayRng(day * MINUTES_PER_DAY, DAY_SALT.raids);
    for (let i = 0; i < 64; i++) assert.equal(a(), b(), `day ${day}, draw ${i}`);
  }
  for (let n = 0; n <= 70; n++) assert.equal(raidsPerDay(n), Math.round((n * GAME_DAY_REAL_HOURS) / RAID_REGION_REAL_HOURS));
  assert.equal(RAID_SLOTS_MAX, raidsPerDay(RAID_REGIONS_MAX));
  assert.ok(RAID_SLOTS_MAX >= raidsPerDay(62), 'every region MAPS.BSA holds');
  const big = Array.from({ length: 62 }, (_, r) => ({ region: r, towns: Array.from({ length: 1 + (r % 5) }, (_, k) => ({ index: k, px: (r * 10 + k) % 1000, py: r * 5, name: `t${r}.${k}` })) }));
  for (const day of [0, 600, 601, 12_345]) {
    const slots = raidDaySlots(day);
    assert.ok(slots.size > 0 && slots.size <= RAID_SLOTS_MAX);
    for (const t of [TOWNS, big, big.slice(0, 9)]) {
      const rolled = raidsForDay(day, t);
      assert.equal(rolled.length, Math.min(raidsPerDay(t.length), t.reduce((n, g) => n + g.towns.length, 0)));
      for (const r of rolled) assert.ok(raidOnSlot({ st: r.startMinute, tg: r.attackAmount, ty: r.type }, slots), `day ${day}: ${r.startMinute}.${r.attackAmount}.${r.type} is one of its slots`);
    }
  }
  // the client's roll is the law's, draw for draw
  const law = rollRaidTowns(D, big, 31, raidDayRandom(D));
  const client = rollRaids(D, big, 31, raidDayRandom(D));
  assert.deepEqual(client.map((r) => [r.regionIndex, r.locationIndex, r.startMinute, r.type, r.attackAmount, r.px, r.py, r.locationName]),
    law.map((r) => [r.region, r.town.index, r.st, r.ty, r.tg, r.town.px, r.town.py, r.town.name]));
  // a start, target or party the day did not draw is on no slot
  const first = rollRaidTowns(D, TOWNS, 2, raidDayRandom(D))[0];
  const slots = raidDaySlots(D);
  for (const o of [{ st: first.st + 1 }, { tg: first.tg === 25 ? 24 : first.tg + 1 }, { ty: (first.ty + 1) % 3 }]) {
    const w = { st: first.st, tg: first.tg, ty: first.ty, ...o };
    assert.equal(raidOnSlot(w, slots), [...slots].includes(`${w.st}.${w.tg}.${w.ty}`), 'read off the draws');
  }
  assert.equal(raidOnSlot({ st: D * RAID_DAY_MINUTES + 1321, tg: 15, ty: 0 }, slots), false, 'a start the roll never makes');
});

test('RAID-ROLL law: THE TOWNS TABLE has one spelling, read back only whole and sane - regions ascending and on the map, each with a town, each town a row and a world-map pixel; its hash is SHA-256 of that spelling; the day\'s whole roll is each raid\'s identity (mutants: a region out of order let in; a pixel off the map let in; a town row unbounded; the hash of another spelling; an identity missing its town)', async () => {
  assert.equal(TEXT, '[[3,[[7,100,200],[8,101,201],[9,102,202]]],[5,[[1,103,203],[2,104,204]]],[9,[[4,105,205],[6,106,206]]],[12,[[0,107,207]]]]');
  assert.deepEqual(readRaidTowns(TEXT), TOWNS);
  assert.equal(raidTownsCanon(readRaidTowns(TEXT)), TEXT, 'read and spelt again, the same bytes');
  for (const [why, bad] of [
    ['not JSON', '[[3,'], ['not a list', '{"a":1}'], ['a region twice', '[[3,[[1,1,1]]],[3,[[2,2,2]]]]'], ['regions out of order', '[[5,[[1,1,1]]],[3,[[2,2,2]]]]'],
    ['a region past the map', `[[${RAID_REGIONS_MAX},[[1,1,1]]]]`], ['a region with no town', '[[3,[]]]'], ['a town of two numbers', '[[3,[[1,1]]]]'],
    ['a pixel off the map', '[[3,[[1,1000,1]]]]'], ['a pixel below it', '[[3,[[1,1,500]]]]'], ['a negative row', '[[3,[[-1,1,1]]]]'], ['a row past its bound', '[[3,[[65536,1,1]]]]'],
    ['a fraction', '[[3,[[1.5,1,1]]]]'], ['a region no number', '[["3",[[1,1,1]]]]'],
  ]) assert.equal(readRaidTowns(bad), null, why);
  assert.equal(readRaidTowns(' '.repeat(RAID_TOWNS_BYTES_MAX + 1)), null, 'past its weight');
  assert.equal(readRaidTowns(7), null);
  assert.equal(await raidTownsHash(TEXT), PIN, 'SHA-256 of the one spelling');
  assert.ok(RAID_TOWNS_SHA_RE.test(PIN));
  assert.equal(await raidTownsHash(TEXT, undefined), PIN, 'the platform\'s own digest');
  assert.equal(await raidTownsHash(TEXT, null), null, 'none without a digest');
  const ids = raidDayIds(D, TOWNS);
  assert.deepEqual([...ids], raidsForDay(D, TOWNS).map((r) => raidLedgerId({ key: `${r.regionIndex}:${r.locationIndex}:${D}`, st: r.startMinute, tg: r.attackAmount, ty: r.type, px: r.px, py: r.py })));
  assert.equal(ids.size, raidsPerDay(TOWNS.length));
  assert.ok(RAID_TOWNS_CHUNKS_MAX * RAID_TOWNS_CHUNK >= RAID_TOWNS_BYTES_MAX, 'the largest table goes in its pieces');
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════

test('RAID-ROLL wire: a piece of the table is projected - its hash, its count, its index, its text, each bounded; only after a hello; the hub\'s ask is `tw` and its pinned hash; the pieces\' bucket takes a whole table at once, then four a second (mutants: the index let past its count; a piece past its bound; the ask\'s hash unread)', () => {
  const ok = { h: PIN, n: 3, i: 2, c: 'abc' };
  assert.deepEqual(validRaidTownsIn({ ...ok, junk: 1 }), ok);
  for (const [why, bad] of [['no hash', { ...ok, h: 'x' }], ['an upper-case hash', { ...ok, h: PIN.toUpperCase() }], ['no pieces', { ...ok, n: 0 }],
    ['too many pieces', { ...ok, n: RAID_TOWNS_CHUNKS_MAX + 1, i: 0 }], ['an index past the count', { ...ok, i: 3 }], ['a negative index', { ...ok, i: -1 }],
    ['an empty piece', { ...ok, c: '' }], ['a piece past its bound', { ...ok, c: 'x'.repeat(RAID_TOWNS_CHUNK + 1) }], ['no text', { ...ok, c: 7 }]]) assert.equal(validRaidTownsIn(bad), null, why);
  assert.ok(validRaidTownsIn({ ...ok, n: RAID_TOWNS_CHUNKS_MAX, i: RAID_TOWNS_CHUNKS_MAX - 1, c: 'x'.repeat(RAID_TOWNS_CHUNK) }), 'every top end is in');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'raidtowns', data: ok }), { hasHello: false }), { error: 'raid towns before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'raidtowns', data: ok }), { hasHello: true }), { t: 'raidtowns', ...ok });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'raidtowns', data: { ...ok, i: 9 } }), { hasHello: true }), { error: 'bad raid towns' });
  assert.ok(RAID_OUT_KINDS.includes('tw'));
  assert.deepEqual(validRaidOut({ k: 'tw', h: PIN, x: 1 }), { k: 'tw', h: PIN });
  assert.equal(validRaidOut({ k: 'tw', h: 'nope' }), null);
  assert.equal(validRaidOut({ k: 'tw' }), null);
  let b = null, pass = 0;
  for (let i = 0; i < RAID_TOWNS_CHUNKS_MAX + 4; i++) { const g = raidTownsGate(b, 1000); b = g.bucket; if (g.pass) pass++; }
  assert.equal(pass, RAID_TOWNS_CHUNKS_MAX, 'a whole table at once');
  const g = raidTownsGate(b, 1000 + 1000);
  assert.equal(g.bucket.tokens, RAID_TOWNS_HZ_MAX - 1, 'then four a second');
  assert.equal(RAID_INTERNAL_DAY, '/internal/raid/day');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════

/** The relay rig: the day's roll of TOWNS, its first raid R open ten minutes, its cell, the hub (pinned or not). */
async function withRoll(fn, { pin = null } = {}) {
  const roll = rollRaidTowns(D, TOWNS, raidsPerDay(TOWNS.length), raidDayRandom(D));
  const R = roll[0];
  const realNow = Date.now; let clock = wallMsForClassicMinutes(R.st + 10); Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  if (pin) hub.env.RAID_TOWNS_SHA256 = pin;
  const cell = world.room(worldRoom(R.town.px, R.town.py));
  try { await fn({ world, hub, cell, R, roll, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** A table into the hub, in pieces `size` long. */
const upload = async (hub, ws, h, text, size = RAID_TOWNS_CHUNK) => {
  const n = Math.ceil(text.length / size);
  for (let i = 0; i < n; i++) await hub.raw(ws, JSON.stringify({ t: 'raidtowns', data: { h, n, i, c: text.slice(i * size, (i + 1) * size) } }));
};

test('RAID-ROLL relay: A WORD THE DAY NEVER DREW is nobody\'s - with no table held, a start, target and party that are not one of the day\'s slots make no ledger, get no answer and strike nobody (a data-modded world\'s raids are its own); the day\'s own raid is made as before (mutants: the slots not asked; a slot miss struck as junk)', async () => {
  await withRoll(async ({ cell, R, step }) => {
    const a = cell.connect(); await cell.hello(a, 'peer-0001', on(R.town.px, R.town.py));
    const w = wordOf(R);
    const slots = raidDaySlots(D);
    const off = [{ st: w.st + 1 }, { tg: w.tg === 25 ? 24 : w.tg + 1 }, { ty: (w.ty + 1) % 3 }].map((o) => ({ ...w, ...o })).filter((x) => !raidOnSlot(x, slots));
    assert.ok(off.length >= 2, 'the forgeries are off the day\'s slots');
    for (const x of off) { await cell.raw(a, JSON.stringify({ t: 'raid', ...x })); step(1000); }   // the raid meter's own second
    assert.deepEqual(ledgers(cell), [], 'no raid made');
    assert.deepEqual(raids(a), [], 'nothing said back');
    assert.equal(a.meters.junk ?? 0, 0, 'nobody struck');
    await cell.raw(a, JSON.stringify({ t: 'raid', ...w }));
    assert.deepEqual(ledgers(cell), [raidLedgerKey(raidLedgerId(w))], 'the day\'s own raid is made');
    assert.equal(raids(a).at(-1).k, 'st');
  });
});

test('RAID-ROLL relay: THE HUB ASKS FOR THE TABLE BY ITS PIN - no pin, no ask; pinned and not held, every hello is asked (`tw`); a piece of another hash, an unfinished table, a table that does not hash to the pin, and one in another room are kept nowhere; the pinned table, in any number of pieces, is kept whole and the asking stops (mutants: the hash not checked; kept before it is whole; the ask said with a table held; a cell taking pieces)', async () => {
  await withRoll(async ({ hub }) => {
    const h1 = hub.connect(); await hub.hello(h1, 'peer-0009');
    assert.deepEqual(raids(h1, 'tw'), [], 'no pin: no ask');
  });
  await withRoll(async ({ hub, cell, R, step }) => {
    const h1 = hub.connect(); await hub.hello(h1, 'peer-0009');
    assert.deepEqual(raids(h1, 'tw'), [{ t: 'raid', k: 'tw', h: PIN }], 'pinned and not held: asked');
    await upload(hub, h1, sha('other'), TEXT);
    assert.equal(hub.store.has('raidtowns'), false, 'a piece of another hash');
    const n = 5, size = Math.ceil(TEXT.length / n);
    for (let i = 0; i < n - 1; i++) await hub.raw(h1, JSON.stringify({ t: 'raidtowns', data: { h: PIN, n, i, c: TEXT.slice(i * size, (i + 1) * size) } }));
    assert.equal(hub.store.has('raidtowns'), false, 'unfinished');
    step(10_000);
    const forged = TEXT.replace('[7,100,200]', '[7,100,201]');
    await upload(hub, h1, PIN, forged, size);
    assert.equal(hub.store.has('raidtowns'), false, 'whole, but not the pinned table');
    const c = cell.connect(); await cell.hello(c, 'peer-0002', on(R.town.px, R.town.py));
    await cell.raw(c, JSON.stringify({ t: 'raidtowns', data: { h: PIN, n: 1, i: 0, c: TEXT } }));
    assert.equal(c.meters.junk, 1, 'a table is the hub\'s - a cell strikes it');
    step(10_000);
    await upload(hub, h1, PIN, TEXT, 40);
    assert.deepEqual(hub.store.get('raidtowns'), { h: PIN, n: Math.ceil(TEXT.length / 40) }, 'kept, in its pieces');
    assert.equal([...hub.store.keys()].filter((k) => k.startsWith('raidtowns:')).map((k) => hub.store.get(k)).join(''), TEXT);
    const h2 = hub.connect(); await hub.hello(h2, 'peer-0008');
    assert.deepEqual(raids(h2, 'tw'), [], 'held: nobody asked');
    const res = await hub.room.fetch(new Request(`https://relay.internal${RAID_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: D }) }));
    assert.deepEqual((await res.json()).ids, [...raidDayIds(D, TOWNS)], 'the day\'s roll, off the kept table');
    const junk = await hub.room.fetch(new Request(`https://relay.internal${RAID_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: -1 }) }));
    assert.equal(junk.status, 400);
  }, { pin: PIN });
});

test('RAID-ROLL relay: WITH THE TABLE HELD, A WORD IS THE DAY\'S WHOLE ROLL OR NOTHING - a real slot named at another town (its key and pixel, stood on) makes no ledger; the rolled raid is made; a cell asks the hub once a day and, the hub holding none, again after RAID_DAY_ASK_MS (mutants: the roll not asked; the answer never cached; "none" cached for ever)', async () => {
  await withRoll(async ({ hub, cell, R, roll, step }) => {
    const other = TOWNS.flatMap((g) => g.towns.map((t) => ({ region: g.region, town: t }))).find((x) => !roll.some((r) => r.region === x.region && r.town.index === x.town.index));
    const forged = { ...wordOf(R), key: `${other.region}:${other.town.index}:${D}`, px: other.town.px, py: other.town.py };
    let asks = 0;
    const fetch = hub.room.fetch.bind(hub.room);
    hub.room.fetch = async (req) => { if (new URL(req.url).pathname === RAID_INTERNAL_DAY) asks++; return fetch(req); };
    // no table yet: the slot alone is read - a real slot named at another town is its own raid (AUDIT RAID R1's law)
    const f = cell.connect(); await cell.hello(f, 'peer-0666', on(other.town.px, other.town.py));
    await cell.raw(f, JSON.stringify({ t: 'raid', ...forged }));
    assert.equal(asks, 1, 'the cell asked the hub for the day');
    assert.deepEqual(ledgers(cell), [raidLedgerKey(raidLedgerId(forged))], 'no table: the slot alone');
    step(1000);
    await cell.raw(f, JSON.stringify({ t: 'raid', ...forged }));
    assert.equal(asks, 1, '"none" trusted a while');
    // the table arrives, and "none" grows old
    const h1 = hub.connect(); await hub.hello(h1, 'peer-0009');
    await upload(hub, h1, PIN, TEXT);
    assert.ok(hub.store.has('raidtowns'));
    step(RAID_DAY_ASK_MS);
    const heard = raids(f).length;
    await cell.raw(f, JSON.stringify({ t: 'raid', ...forged, n: 3, s: 1 }));
    assert.equal(asks, 2, 'asked again once "none" was old');
    assert.equal(raids(f).length, heard, 'the forgery made before the table is heard no more');
    assert.equal(cell.store.get(raidLedgerKey(raidLedgerId(forged))).n, 0, 'and counts nothing');
    step(1000);
    const unrolled = { ...forged, key: `${other.region}:${other.town.index + 100}:${D}` };
    await cell.raw(f, JSON.stringify({ t: 'raid', ...unrolled }));
    assert.equal(ledgers(cell).includes(raidLedgerKey(raidLedgerId(unrolled))), false, 'a key the day never rolled, on a real slot: nothing');
    const a = cell.connect(); await cell.hello(a, 'peer-0001', on(R.town.px, R.town.py));
    await cell.raw(a, JSON.stringify({ t: 'raid', ...wordOf(R) }));
    assert.ok(ledgers(cell).includes(raidLedgerKey(raidLedgerId(wordOf(R)))), 'the rolled raid is made');
    assert.equal(raids(a).at(-1).g, `${R.st}.${R.tg}.${R.ty}.${R.town.px}.${R.town.py}`);
    assert.equal(asks, 2, 'the day\'s roll asked once, then kept');
  }, { pin: PIN });
});

test('RAID-ROLL relay: THE HUB\'S TABLE OUTLIVES ITS SLEEP and is read back only while it is the pinned one - a new pin asks again; a table whose stored text no longer hashes to its pin is not used (mutants: the stored table trusted without its hash; the pin\'s change ignored)', async () => {
  await withRoll(async ({ hub }) => {
    const h1 = hub.connect(); await hub.hello(h1, 'peer-0009');
    await upload(hub, h1, PIN, TEXT);
    hub.wake();
    const h2 = hub.connect(); await hub.hello(h2, 'peer-0008');
    assert.deepEqual(raids(h2, 'tw'), [], 'asleep and awake, still held');
    const res = await hub.room.fetch(new Request(`https://relay.internal${RAID_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: D }) }));
    assert.equal((await res.json()).ids.length, raidsPerDay(TOWNS.length));
    // storage tampered: the text no longer hashes to its pin
    hub.store.set('raidtowns:0', hub.store.get('raidtowns:0').replace('100,200', '100,201'));
    hub.wake();
    const h3 = hub.connect(); await hub.hello(h3, 'peer-0007');
    assert.deepEqual(raids(h3, 'tw'), [{ t: 'raid', k: 'tw', h: PIN }], 'not the pinned table: asked for again');
    const none = await hub.room.fetch(new Request(`https://relay.internal${RAID_INTERNAL_DAY}`, { method: 'POST', body: JSON.stringify({ d: D }) }));
    assert.equal((await none.json()).ids, null);
    // the operator pins another table
    hub.env.RAID_TOWNS_SHA256 = sha('another world');
    hub.wake();
    const h4 = hub.connect(); await hub.hello(h4, 'peer-0006');
    assert.deepEqual(raids(h4, 'tw'), [{ t: 'raid', k: 'tw', h: sha('another world') }]);
  }, { pin: PIN });
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════

function sessionRig(room) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const got = []; s.onRaid = (f, r) => got.push({ f, r });
  const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {};
  try { s.join(room, { x: 1, y: 0, z: 1, yaw: 0 }); } finally { console.warn = warn; console.info = info; }
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION });
  return { s, ws, got, out: () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'raidtowns') };
}

test('RAID-ROLL session: the hub\'s ask comes in from the hub alone; the table goes down the hub\'s socket alone, in pieces the wire\'s projection takes, which join to the table (mutants: an ask let in from a cell; a piece past its bound; a table sent down a cell\'s socket)', () => {
  const hub = sessionRig(SOCIAL_ROOM);
  hub.ws.receive({ t: 'raid', k: 'tw', h: PIN });
  assert.deepEqual(hub.got, [{ f: { k: 'tw', h: PIN }, r: SOCIAL_ROOM }]);
  const cell = sessionRig(worldRoom(100, 200));
  cell.ws.receive({ t: 'raid', k: 'tw', h: PIN });
  assert.deepEqual(cell.got, [], 'a cell never asks');
  assert.equal(cell.s.sendRaidTowns(PIN, TEXT), false, 'nor is it handed the table');
  const long = 'x'.repeat(RAID_TOWNS_CHUNK * 2 + 5);
  assert.equal(hub.s.sendRaidTowns(PIN, long), true);
  const pieces = hub.out();
  assert.equal(pieces.length, 3);
  assert.ok(pieces.every((p) => validRaidTownsIn(p.data) && p.data.n === 3));
  assert.equal(pieces.map((p) => p.data.c).join(''), long);
  assert.equal(hub.s.sendRaidTowns(PIN, 'x'.repeat(RAID_TOWNS_CHUNK * RAID_TOWNS_CHUNKS_MAX + 1)), false, 'past the table\'s bound: nothing');
  assert.equal(hub.out().length, 3);
  assert.equal(hub.s.sendRaidTowns(PIN, ''), false);
});

test('RAID-ROLL client: this world\'s table is handed only when it hashes to the hub\'s pin, and its hash said once to the console; the world host asks on `tw`, a few times while the picker loads, once a session; the tool and the relay\'s config name the pin (mutants: the table sent whatever its hash; the ask unwired)', async () => {
  _resetRaidingParties();
  const said = [];
  const info = console.info; console.info = (...a) => said.push(a.join(' '));
  try {
    // raidRegions over a stub of the maps and the picker (a picker pixel is 128 + its region)
    const row = (px, py) => ({ locationType: RAID_TOWN_TYPES[0], longitude: px * 128, latitude: (499 - py) * 128 });   // a map pixel's own corner
    const table = { 3: [row(200, 100), null, row(210, 120)], 5: [row(300, 150)] };
    const maps = { regionCount: 8, getRegion: (r) => (table[r] ? { mapTable: table[r], mapNames: table[r].map((_, k) => `town ${r}.${k}`) } : null) };
    const picker = new Uint8Array([128 + 3, 128 + 5, 0, 128 + 7]);
    setRaidingPartiesHost({ maps: () => maps, picker: () => null });
    assert.equal(await raidTownsFor(PIN), null, 'no picker yet: nothing');
    _resetRaidingParties();
    setRaidingPartiesHost({ maps: () => maps, picker: () => picker });
    const text = raidTownsCanon(raidRegions(maps, picker));
    assert.equal(readRaidTowns(text).length, 2, 'two regions with a town on the map');
    assert.equal(await raidTownsFor(sha('another world')), null, 'another pin: not handed');
    assert.equal(await raidTownsFor(sha(text)), text, 'its own pin: handed, in its one spelling');
    assert.deepEqual(said.filter((l) => l.startsWith('[raid] this world')), [`[raid] this world's towns table: ${sha(text)}`], 'its hash said once');
  } finally { console.info = info; }
  _resetRaidingParties();
  const rp = rd('src/systems/raidingParties.js');
  assert.match(rp, /return _townsHash && _townsHash === h \? _townsText : null;/, 'handed only when it hashes to the pin');
  assert.match(rp, /console\.info\(`\[raid\] this world's towns table: \$\{hash\}`\)/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /link\.onRaid = \(f, room\) => \(f\.k === 'tw' \? offerRaidTowns\(link, f\.h\) : raidRelayWord\(f, room\)\);/);
  assert.match(w, /if \(text\) \{ if \(link\.sendRaidTowns\(h, text\)\) _raidTownsSent = true; return; \}\n\s*if \(tries > 1\) setTimeout\(\(\) => offerRaidTowns\(link, h, tries - 1\), 10_000\);/);
  const tool = rd('tools/raidTowns.mjs');
  assert.match(tool, /const regions = raidRegions\(maps, picker\.getDFBitmap\(\)\.data\) \?\? \[\];\n\s*const text = raidTownsCanon\(regions\);/, 'the game\'s own reading of the same files');
  assert.match(rd('server/wrangler.toml'), /^RAID_TOWNS_SHA256 = "(?:[0-9a-f]{64})?"$/m, 'the relay\'s pin - empty a legal state');
  const idx = rd('server/src/index.js');
  assert.match(idx, /if \(!raidWordFits\(m, sharedClassicMinutes\(now\)\)\) return;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const day = raidDayOfKey\(m\.key\);\n\s*if \(!raidOnSlot\(m, this\._raidSlotsOf\(day\)\)\) return;\n\s*const rolled = await this\._raidDayIdsOf\(day, now\);\n\s*if \(rolled && !rolled\.has\(raidLedgerId\(m\)\)\) return;\n\s*const id = raidLedgerId\(m\);/, 'read before the ledger - and before any storage read');
});
