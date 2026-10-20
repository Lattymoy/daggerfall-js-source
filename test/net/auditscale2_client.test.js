// AUDIT SCALE II (2026-10-11, the audit of PR #757 - Mac: "Lets do an audit on everything. Ensure perfection.";
// bible/11-Multiplayer/Scale-Arc.md): THE CLIENT'S HALF. Each finding the reviewers reproduced against the frozen head
// (e729cea7), pinned by its ID:
//   C-1   the new client against a relay before the shards: `find` (a search, the Guild tab's ask) only of a relay that
//         answers it - world191 closed the hub link 1008 on it, every frame the Guild tab was drawn;
//   C-2   the shard fallback by the socket's own word (a browser fires `error`, then `close`), a relay without shards
//         taking the links off them, and the remembered flag kept per relay;
//   R3-4  a party's layer asked of the same cell only;
//   R3-10 a badge said again (AURA-LIVE's rehello) in the layer the old socket stands in;
//   C-3   a `capped` answer kept for the hour its report was SENT in;
//   C-4   a report in the hour's last minute, so what waited is credited by its own hour;
//   C-5   the page's last word carries every region's pending, the held report last;
//   C-6   the hub's lists of everyone and the guild online let go with the room;
//   D-7   a reconnect that never opened is no wave (SCALE2c's unpinned law), and the spread's cap exactly;
//   D-8   a rise reported within a minute of being earned, over the real Worker (SCALE4h's fighter hour).
// The real OnlineSession over the pins' fake socket, the real tracker over the real account service (test/accountDb.mjs),
// and world.js's own closures lifted out of the host and run (as test/world/audit68_worldjs.test.js runs its). A relay before
// the shards is modelled by what lane C saw base757's real Room (world191) do: its welcome's `v`, and `find` refused as
// an unknown message, closed 1008. tools/mutants/auditscale2_client.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeSocketClass } from '../fakeSocket.mjs';
import { d1 } from '../accountDb.mjs';
import { createGuest } from '../../server-account/src/accounts.js';
import { reportRenownXp } from '../../server-account/src/renownTracks.js';
import { OnlineSession, BACKOFF_MIN_MS } from '../../src/net/online.js';
import { reconnectWave, WAVE_SPREAD_MAX_MS } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM, RELAY_VERSION, CLOSE_REPLACED, CLOSE_POLICY, cellOfRoom, worldRoom } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import * as CC from '../../src/net/chatCommands.js';
import { rosterRows, guildRosterSource } from '../../src/net/roster.js';
import { createRenownTracker, renownAnswer, renownReportSoon } from '../../src/net/renownTracker.js';
import { RENOWN_REPORT_MS, RENOWN_COALESCE_MS, RENOWN_XP_HOUR_MAX, RENOWN_XP_REPORT_MAX, renownXpFor } from '../../src/net/renown.js';
import { playerHour } from '../../tools/hotWritesBench.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const WORLD = src('src/scenes/world.js');
/** A span of world.js, or the test fails saying which. */
const span = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `world.js: ${what}`); return m[0]; };
const POSE = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, ts: 0 };
const session = (FakeWS, o = {}) => { let t = o.t ?? 1_000_000; const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: false, ...o.opts }); return { s, adv: (ms) => { t += ms; }, now: () => t }; };
const finds = (ws) => ws.sent.filter((x) => JSON.parse(x).t === 'find');

// ═══ C-1: `find` ONLY OF A RELAY THAT ANSWERS IT ═══════════════════════════════════════════════════════════════════

test('AUDIT SCALE II C-1 the new client on a relay before the shards: no search and no guild ask is ever sent it (it closes the hub link 1008, terminal) - ten minutes of the Guild tab drawn leave the link open; a relay with them is asked, and a new socket asks nothing until its own welcome says so; `/find` says it needs a newer relay (mutants: the word unread by the search; unread by the guild ask; never reset at a socket; the version unread; the line\'s words)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv, now } = session(FakeWS);
    s.join(SOCIAL_ROOM);
    const ws = sockets[0];
    // world191's answer to `find` (lane C, base757's real Room): `{t:'error'}` 'unknown message', closed CLOSE_POLICY
    ws.send = function (x) { this.sent.push(x); if (JSON.parse(x).t === 'find') { this.receive({ t: 'error', error: 'unknown message' }); this.drop(CLOSE_POLICY, 'unknown message'); } };
    ws.open();
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 3, v: 'world191', now: now() });
    for (let sec = 0; sec < 600; sec++) { adv(1000); s.rejoin(SOCIAL_ROOM, 30_000); s.tick(); s.sendGuildWho(); }   // the Guild tab drawn, a frame a second
    assert.deepEqual(finds(ws), [], 'nothing it would close the link on');
    assert.equal(s.terminal, false);
    assert.equal(s.status, 'open', 'ten minutes on, the hub link stands');
    assert.equal(sockets.length, 1, 'never closed, never rejoined');
    assert.equal(s.sendFind('Ald'), false, '`/find` is not sent');
    assert.deepEqual(finds(ws), []);
    assert.equal(s.findOk, false, 'world191 keeps no shards, and answers no `find`');
    assert.equal(s.welcomed, true, 'its relay has answered - the word is that relay\'s');
  });
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv, now } = session(FakeWS);
    s.join('chat:world.3');
    sockets[0].open();
    assert.equal(s.welcomed, false, 'open, not yet answered');
    assert.equal(s.sendFind('Ald'), false, 'nothing before the welcome');
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 3, v: 'world192', now: now() });
    assert.equal(s.findOk, true, 'world192 has the shards and answers `find`');
    assert.equal(s.findOk, H.hubShardsSupported('world192'));
    assert.equal(s.sendFind('Ald'), true);
    assert.equal(s.sendGuildWho(), true);
    assert.deepEqual(finds(sockets[0]).map((x) => JSON.parse(x)), [{ t: 'find', q: 'Ald' }, { t: 'find', g: 1 }]);
    // the relay rolls back: the new socket says nothing until ITS welcome has spoken
    sockets[0].drop(1006);
    adv(5000); s.tick();
    const again = sockets.at(-1);
    assert.notEqual(again, sockets[0]);
    again.open();
    assert.equal(s.findOk, false, 'a new socket\'s relay has said nothing yet');
    adv(60_000);
    assert.equal(s.sendGuildWho(), false);
    assert.equal(s.sendFind('Ald'), false);
    again.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 3, v: 'world191', now: now() });
    assert.equal(s.findOk, false);
    assert.equal(s.sendGuildWho(), false);
    assert.deepEqual(finds(again), []);
  });
  assert.equal(typeof CC.FIND_RELAY_TEXT, 'string');
  assert.notEqual(CC.FIND_RELAY_TEXT, CC.FIND_OFFLINE_TEXT);
  assert.equal(CC.FIND_RELAY_TEXT, 'Search is not available on this server yet.');
  assert.match(WORLD, /if \(cmd\.kind === 'find'\) \{ findTab = tabId; const hub = chatLinks\?\.get\('world'\); if \(!hub\?\.sendFind\(cmd\.q\)\) note\(hub\?\.welcomed && !hub\.findOk \? FIND_RELAY_TEXT : FIND_OFFLINE_TEXT\); return 'read'; \}/, 'the line says why');
});

// ═══ C-2: THE SHARD FALLBACK, AS A BROWSER FAILS A SOCKET ══════════════════════════════════════════════════════════

test('AUDIT SCALE II C-2 a shard a relay refuses, failed as a browser fails it (`error`, then `close`), twice: the link goes to the bus; a shard socket that opened and dropped is no miss (mutants: the miss read off `status`; every close a miss)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv } = session(FakeWS);
    s.join('chat:world.7');   // channelLinkRoom's answer while the page remembers the shards
    const refuse = (ws) => { ws.onerror?.({}); ws.drop(1006); };   // the WebSocket standard's "fail the WebSocket connection"
    refuse(sockets[0]);
    assert.equal(s.room, 'chat:world.7', 'one miss is a miss');
    adv(70_000); s.tick();
    assert.equal(sockets.length, 2);
    refuse(sockets[1]);
    assert.equal(s.room, SOCIAL_ROOM, 'two, and the link is on the bus');
    sockets.at(-1).open();
    assert.equal(JSON.parse(sockets.at(-1).sent.find((x) => x.startsWith('{"t":"hello"'))).hs, undefined, 'offering the shards no more');
  });
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv } = session(FakeWS);
    s.join('chat:world.7');
    for (let i = 0; i < 3; i++) {
      const ws = sockets.at(-1);
      ws.open();   // the relay keeps the key: it upgraded - then dropped before the welcome (a deploy)
      ws.onerror?.({}); ws.drop(1006);
      adv(70_000); s.tick();
    }
    assert.equal(s.room, 'chat:world.7', 'a socket that opened is no relay refusing its key');
    assert.equal(s._hubBus, false);
  });
});

/** A page of the wave's (SCALE2c): the presence session in a cell with its `halos` and the hub link, on one wave, every
 *  socket open and the hub's count of 500 noted (lane D's harness). `roll` is the wave's draw. */
function page(halos = ['world:3,12']) {
  let t = 1_000_000, r = 0.5;
  const now = () => t;
  const wave = reconnectWave({ rand: () => r, online: () => true });
  const { FakeWS, sockets } = fakeSocketClass();
  const presence = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now, rand: () => 0, wave });
  const hub = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now, rand: () => 0, presence: false, wave });
  presence.join('world:2,12', POSE); presence.setHalo(halos); hub.join(SOCIAL_ROOM, null);
  for (const ws of sockets) ws.open();
  hub._ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 500, v: RELAY_VERSION, now: t });
  hub.tick();
  return { sockets, wave, roll: (x) => { r = x; }, advance: (ms) => { t += ms; presence.tick(); hub.tick(); } };
}

test('AUDIT SCALE II C-2 (found on the way, the same cause) a relay deploy\'s unclean close, as a browser says it (`error`, then `close` 1006): the page\'s wave is still weighed - the cell, its halo and the hub held to the one slot (mutant: the drop read off the status the error wrote)', async () => {
  await quiet(() => {
    const p = page();
    assert.equal(p.wave.online, 500);
    for (const ws of p.sockets.slice(0, 3)) { ws.onerror?.({}); ws.drop(1006); }
    p.advance(BACKOFF_MIN_MS * 2 + 100);
    assert.equal(p.sockets.length, 3, 'past the old retry, all held by the wave');
    p.advance(5_000 - (BACKOFF_MIN_MS * 2 + 100));
    assert.equal(p.sockets.length, 6, 'and back together at the page\'s slot');
  });
});

/** world.js's channel-link room, its per-relay flag and its word on a relay's version, lifted out of the host and run
 *  over the test's storage, relay address and chat links. */
function channelHost({ storage, online, chatLinks }) {
  const room = span(/ {2}const HUB_SHARDS_SEEN_KEY = 'dfjs\.hubShards';\n(?:[\s\S]*?\n)? {2}const channelLinkRoom = \(room\) => \{[\s\S]*?\n {2}\};\n/, 'channelLinkRoom');
  const off = /^ {2}const channelLinksOffShards = .*$/m.exec(WORLD)?.[0] ?? '';
  const onv = span(/^ {2}const onRelayVersion = .*$/m, 'onRelayVersion');
  const make = new Function('appStorage', 'online', 'chatLinks', 'storedSession', 'shardOf', 'isChannelBus', 'isChannelShard', 'channelOf', 'hubShardsSupported', 'relaySupportsRite', 'relaySupportsCage', 'relayVersionSeen', 'chatNotice', 'RELAY_RESTART_TEXT',
    `let _relayKeepsRite = null, _relayKeepsCage = null;\n${room}\n${off}\n${onv}\nreturn { channelLinkRoom, onRelayVersion };`);
  return make(() => storage, online, chatLinks, () => ({ id: 'acct-mac' }), H.shardOf, H.isChannelBus, H.isChannelShard, H.channelOf, H.hubShardsSupported, () => true, () => true, () => 'same', () => {}, '');
}
const mapStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, m }; };

test('AUDIT SCALE II C-2 the host: the shards remembered per relay - a staging relay\'s word moves nothing on production\'s; a relay that keeps none takes every channel link off its shard to its channel at once, the hub\'s and the region\'s, and leaves one its own shard has welcomed (mutants: one flag for every relay; the links left on their shards; a welcomed link moved)', async () => {
  const storage = mapStorage();
  const online = { url: 'wss://relay.prod.test' };
  const hub = H.shardOf(SOCIAL_ROOM, 'acct-mac');
  assert.ok(H.isChannelShard(hub));
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const links = new Map();
    const host = channelHost({ storage, online, chatLinks: links });
    assert.equal(host.channelLinkRoom(SOCIAL_ROOM), SOCIAL_ROOM, 'nothing heard: the bus, which says where');
    host.onRelayVersion('world192');
    assert.equal(host.channelLinkRoom(SOCIAL_ROOM), hub, 'production keeps them: the next page goes straight to its shard');
    // a `?server=` visit to a staging relay rolled back behind them
    online.url = 'wss://relay.staging.test';
    assert.equal(host.channelLinkRoom(SOCIAL_ROOM), SOCIAL_ROOM, 'staging\'s own word, not production\'s');
    host.onRelayVersion('world191');
    online.url = 'wss://relay.prod.test';
    assert.equal(host.channelLinkRoom(SOCIAL_ROOM), hub, 'production\'s page still goes to its shard');
    // production rolls back: the links standing on shards go to their channels, now
    const mk = () => new OnlineSession({ url: online.url, name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000, rand: () => 0, presence: false });
    const world = mk(), region = mk(), kept = mk();
    world.join(hub);
    region.join('chat:region.17.2');
    kept.join('chat:region.20.1');
    links.set('world', world); links.set('region', region); links.set('other', kept);
    const keptWs = sockets.at(-1);
    keptWs.open(); keptWs.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 2, v: 'world192', now: 1_000_000 });
    host.onRelayVersion('world191');
    assert.equal(world.room, SOCIAL_ROOM, 'the hub link on the bus');
    assert.equal(region.room, 'chat:region.17', 'the region link on its region\'s channel');
    assert.equal(kept.room, 'chat:region.20.1', 'a link its own shard welcomed stays - its relay keeps them');
    assert.equal(host.channelLinkRoom(SOCIAL_ROOM), SOCIAL_ROOM, 'and the next page goes to the bus');
  });
  assert.ok(storage.m.has('dfjs.hubShards@wss://relay.prod.test') && storage.m.has('dfjs.hubShards@wss://relay.staging.test'), 'a key a relay');
});

// ═══ R3-4 and R3-10: THE LAYER ═════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II R3-4 a party\'s layer is asked of the cell the mate stands in, never a neighbour\'s: a mate in layer 3 of the next cell asks nothing of mine; the leader\'s first in my own; a mate indoors or without a layer, nothing (mutants: a neighbour\'s layer taken; the cell unread)', () => {
  const body = span(/const partyLayerAt = \(key\) => \{[\s\S]*?\n {2}\};/, 'partyLayerAt');
  const at = (social) => new Function('social', 'layerCellOf', 'layerCellAt', `${body}; return partyLayerAt;`)(social, cellOfRoom, worldRoom);
  const mine = worldRoom(100, 150), next = 'world:7,9';
  assert.notEqual(mine, next);
  assert.deepEqual(cellOfRoom(mine).map((c, i) => Math.abs(c - cellOfRoom(next)[i])), [1, 0], 'neighbours');
  const party = (members, leader = 'mate') => ({ acct: 'me', party: { leader, members: [{ acct: 'me' }, ...members] } });
  assert.equal(at(party([{ acct: 'mate', p: { in: 0, px: 100, py: 150, ly: 3 } }]))(next), 0, 'the mate\'s layer is a number of ITS cell\'s objects');
  assert.equal(cellOfRoom(worldRoom(100, 166))[1] - cellOfRoom(mine)[1], 1);
  assert.equal(at(party([{ acct: 'mate', p: { in: 0, px: 100, py: 166, ly: 3 } }]))(mine), 0, 'nor the cell beyond my other edge');
  assert.equal(at(party([{ acct: 'mate', p: { in: 0, px: 100, py: 150, ly: 3 } }]))(mine), 3, 'in the same cell, asked');
  assert.equal(at(party([{ acct: 'mate', p: { in: 0, px: 100, py: 150, ly: 3 } }, { acct: 'lead', p: { in: 0, px: 101, py: 151, ly: 5 } }], 'lead'))(mine), 5, 'the leader\'s first');
  assert.notEqual(worldRoom(100, 190), mine);
  assert.equal(at(party([{ acct: 'lead', p: { in: 0, px: 100, py: 190, ly: 5 } }, { acct: 'mate', p: { in: 0, px: 100, py: 150, ly: 3 } }], 'lead'))(mine), 3, 'a leader elsewhere: any mate here');
  assert.equal(at(party([{ acct: 'mate', p: { in: 2, px: 100, py: 150, ly: 3 } }]))(mine), 0, 'indoors');
  assert.equal(at(party([{ acct: 'mate', p: { in: 0, px: 100, py: 150 } }]))(mine), 0, 'no layer said');
});

test('AUDIT SCALE II R3-10 a badge said again (rehello) asks the layer the old socket stands in - the primary\'s and a halo\'s own; the place itself asks none, a channel never (mutants: the primary\'s layer unasked; a halo\'s unasked)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv, now } = session(FakeWS, { opts: { presence: true } });
    s.layerHint = 3;
    s.join('world:10,10', POSE);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: now(), v: 'world192', ly: 3 });
    s.setHalo(['world:11,10', 'world:9,10']);
    const [h1, h2] = sockets.slice(1);
    h1.open(); h1.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: now(), v: 'world192', ly: 2 });
    h2.open(); h2.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: now(), v: 'world192' });
    s.layerHint = 0;   // the party moved on: the room I stand in is still layer 3's
    adv(60_000);
    assert.equal(s.rehello(), true);
    const made = sockets.slice(3);
    const of = (room) => made.find((w) => w.url.includes(`/room/${room}`))?.url;
    assert.match(of('world:10,10'), /\/room\/world:10,10\?ly=3$/, 'my own layer, where the old socket stands');
    assert.match(of('world:11,10'), /\/room\/world:11,10\?ly=2$/, 'a halo\'s, as its welcome said');
    assert.match(of('world:9,10'), /\/room\/world:9,10$/, 'the place itself asks none');
    const mine = made.find((w) => w.url.includes('world:10,10'));
    mine.open();
    mine.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: now(), v: 'world192', ly: 3 });
    assert.equal(s.layer, 3, 'the player is where the party is');
  });
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv, now } = session(FakeWS);
    s.layerHint = 3;
    s.join('chat:world.3');
    sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 2, v: 'world192', now: now() });
    adv(60_000); s.rehello();
    assert.doesNotMatch(sockets.at(-1).url, /\?ly=/, 'a channel is never asked a layer');
  });
});

// ═══ C-3 and C-4: THE HOUR ═════════════════════════════════════════════════════════════════════════════════════════

const HOUR0 = 1_800_000_000_000;   // a clock hour's first instant (500,000 hours)
/** The account service: a guest whose hour is real (server-account/src/renownTracks.js over node:sqlite). */
async function service() {
  const db = d1();
  const P = { id: (await createGuest({ db, subtle: globalThis.crypto.subtle, rand: (b) => globalThis.crypto.getRandomValues(b), nowS: HOUR0 / 1000 }, { deviceLabel: null })).id };
  const seed = (char, xp) => db._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(P.id, char, 'Mac', xp, 0, 0);
  return { db, P, seed, report: (ms, o) => reportRenownXp({ db, nowS: Math.floor(ms / 1000) }, P, o) };
}
/** world.js's own Renown host - its hours, the report's wrapper, the answer's plan, the tracker's words - lifted out as
 *  it stands and run over the real tracker, on the test's clock, with the test's service behind `renownAccount`. */
function renownHost({ clock, account }) {
  const block = span(/\n {2}let _renownCapHour = null;\n[\s\S]*?\n {2}\}\) : null;\n/, 'the Renown tracker');
  const said = [];
  const make = new Function('Date', '_sharedOffsetMs', 'onlineOn', 'createRenownTracker', 'renownAnswer', 'renownReportSoon', 'renownAccount', 'online', 'seatOut', 'characterIdOf', 'playerEntity', 'playerTravelPixel', 'maps', 'renownAdopt', 'townTalk', 'tradeSay', 'accountRefusalText',
    `let renownXp = null; const renownXpAdopt = (xp) => { if (Number.isSafeInteger(xp) && xp >= 0 && (renownXp === null || xp > renownXp)) renownXp = xp; };${block}\nreturn { tracker: renownTracker, capHour: () => _renownCapHour, hour: renownHour };`);
  const host = make({ now: clock }, 0, true, createRenownTracker, renownAnswer, renownReportSoon, account, {}, () => false, () => 'char-aaaa', { name: 'Mac' }, () => ({ x: 0, y: 0 }), { getRegionIndexAt: () => 17 },
    (l) => l, { say: () => {} }, (t) => said.push(t), (e) => e);
  return { ...host, said };
}

test('AUDIT SCALE II C-3 a capped answer is the hour its report was SENT in: sent at 10:59:59.7 and answered at 11:00:00.3, hour 11 still earns and is credited whole; capped within its own hour, that hour is spent (mutants: the cap stamped with the hour it arrived in; the sent hour unkept)', async () => {
  const S = await service();
  S.seed('char-aaaa', renownXpFor(40));
  let t = HOUR0 + 3_600_000 - 300;   // 10:59:59.7 on the shared clock
  for (const xp of [5000, 5000, 4960]) await S.report(t - 60_000, { character: 'char-bbbb', xp });   // the account's hour 10 spent but 40, by another character
  const answers = [];
  const host = renownHost({ clock: () => t, account: {
    report: async (c, xp, name, rid, region) => { const data = await S.report(t, { character: c, xp, name, rid }); t += 600; answers.push(data); return { ok: true, data }; },   // the answer's way back: 600 ms
    leave: () => {},
  } });
  assert.equal(host.tracker.earn(200), 200);
  await host.tracker.flush(t);
  assert.deepEqual([answers[0].credited, answers[0].room], [40, 0], 'hour 10\'s last 40 credited: the answer is capped');
  assert.equal(host.hour(), HOUR0 / 3_600_000 + 1, 'and it arrived in hour 11');
  assert.equal(host.capHour(), null, 'a cap that spoke of hour 10');
  let earned = 0;
  for (let m = 1; m <= 59; m++) { t += 60_000; earned += host.tracker.earn(200); await host.tracker.tick(t); }
  await host.tracker.flush(t);
  assert.equal(earned, 59 * 200, 'hour 11 earns');
  const credited = answers.slice(1).reduce((n, a) => n + a.credited, 0);
  assert.equal(credited + host.tracker.pending(), earned, 'and every point of it is credited or still on its way');
  assert.ok(credited >= earned - RENOWN_XP_REPORT_MAX);
  assert.deepEqual(host.said, []);
  // capped within the hour it was sent in: spent
  for (const xp of [5000, 5000]) await S.report(t, { character: 'char-bbbb', xp });
  host.tracker.earn(RENOWN_XP_HOUR_MAX);
  await host.tracker.flush(t);
  assert.equal(answers.at(-1).room, 0);
  assert.equal(host.capHour(), host.hour(), 'the hour spent');
  assert.equal(host.tracker.earn(100), 0, 'earns nothing more in it');
  assert.equal(host.said.length, 1, 'said once');
});

test('AUDIT SCALE II C-4 the law: a report is soon in the hour\'s last RENOWN_REPORT_MS - and, unknown, the hour says nothing (mutants: the arm unread; its edge strict; the minute read as the coalescing)', () => {
  const at20 = renownXpFor(20) + 100;
  const s = (o) => renownReportSoon({ xp: at20, pending: 40, room: RENOWN_XP_HOUR_MAX, capped: false, ...o });
  assert.equal(s({}), false, 'nothing near: it waits');
  assert.equal(s({ hourLeftMs: RENOWN_REPORT_MS }), true, 'the hour\'s last minute');
  assert.equal(s({ hourLeftMs: 1 }), true);
  assert.equal(s({ hourLeftMs: RENOWN_REPORT_MS + 1 }), false, 'a minute and a moment left: it waits');
  assert.equal(s({ hourLeftMs: RENOWN_COALESCE_MS }), false, 'only the last minute - the coalescing\'s span would cost four reports an hour for nothing');
  for (const hourLeftMs of [null, undefined, NaN, '30']) assert.equal(s({ hourLeftMs }), false, `an hour left of ${hourLeftMs} says nothing`);
});

test('AUDIT SCALE II C-4 the host over the real service: six hours just under the hourly bound, what is earned in an hour is credited by that hour - nothing lost to the next one\'s bound, and still coalesced (mutants: the hour\'s end not said; the world host\'s word unwired)', async () => {
  const S = await service();
  S.seed('char-aaaa', renownXpFor(40) + 10);   // a high Renown: a rise is rare
  let t = HOUR0 + 30_000;
  const perHour = new Map();
  let reports = 0;
  const host = renownHost({ clock: () => t, account: {
    report: async (c, xp, name, rid) => { reports++; const data = await S.report(t, { character: c, xp, name, rid }); const h = Math.floor(t / 3_600_000); perHour.set(h, (perHour.get(h) ?? 0) + data.credited); return { ok: true, data }; },
    leave: () => {},
  } });
  const perMin = 245;   // 14,700 an hour: under the 15,000 bound
  let earned = 0;
  for (let m = 0; m < 6 * 60; m++) { t += 60_000; earned += host.tracker.earn(perMin); await host.tracker.tick(t); }
  const credited = [...perHour.values()].reduce((a, b) => a + b, 0);
  assert.equal(earned, 6 * 60 * perMin);
  assert.equal(credited + host.tracker.pending(), earned, `nothing lost (credited ${credited}, pending ${host.tracker.pending()}, by hour ${JSON.stringify([...perHour.values()])})`);
  for (const [, v] of perHour) assert.ok(v <= RENOWN_XP_HOUR_MAX);
  assert.ok(reports <= 6 * 14, `${reports} reports in six hours - coalesced still (the minute's pace was 360)`);
});

// ═══ C-5: THE PAGE'S LAST WORD ═════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II C-5 the page\'s last word carries every region\'s pending - a report each, its own id - and the held report LAST, so the service\'s last id is the one a page brought back sends again, answered a repeat: everything earned credited once (mutants: one region only; the held report first; a report\'s id shared)', async () => {
  const S = await service();
  S.seed('char-aaaa', renownXpFor(30));
  let t = HOUR0 + 60_000, region = 17, offline = false;
  const left = [];
  let n = 0;
  const k = createRenownTracker({
    report: async (c, xp, name, rid, r) => (offline ? { ok: false, error: 'offline' } : { ok: true, data: await S.report(t, { character: c, xp, name, rid }) }),
    leave: (c, xp, name, rid, r) => { left.push({ c, xp, rid, r }); },
    character: () => 'char-aaaa', now: () => t, region: () => region, soon: () => false,
    rid: () => (++n).toString(16).padStart(16, '0'),
  });
  offline = true;
  k.earn(300); await k.flush(t);   // a report formed and held: the network lost it
  offline = false;
  t += 60_000; k.earn(200);
  region = 18;   // across the border
  t += 60_000; k.earn(400);
  t += 60_000; k.earn(100);
  region = 17;
  assert.equal(k.pending(), 1000);
  assert.equal(k.leave(), true);
  assert.deepEqual(left.map((x) => [x.r, x.xp]), [[17, 200], [18, 500], [17, 300]], 'each region\'s pending, then the held report last');
  assert.equal(new Set(left.map((x) => x.rid)).size, 3, 'each its own id');
  assert.equal(left.at(-1).rid, '0000000000000001', 'the held report under the id it was formed with');
  let credited = 0;
  for (const x of left) credited += (await S.report(t, { character: x.c, xp: x.xp, rid: x.rid })).credited;   // the browser finishes them, in order
  assert.equal(credited, 1000, 'everything earned');
  // the back-forward cache brings the page back: it sends what it held, again
  const again = await k.flush(t + 60_000);
  assert.equal(again?.repeat, true, 'answered a repeat');
  assert.equal(again.credited, 0, 'credited once');
  assert.equal(k.pending(), 0);
  // a region's report the page could not send stays pending - a page brought back reports it
  let m = 0;
  const kk = createRenownTracker({ report: async () => ({ ok: false, error: 'offline' }), leave: (c, xp, name, rid, r) => { if (r === 18) throw new Error('refused'); },
    character: () => 'char-aaaa', now: () => t, region: () => region, soon: () => false, rid: () => (++m).toString(16).padStart(16, '0') });
  region = 17; kk.earn(100); region = 18; kk.earn(250); region = 17;
  assert.equal(kk.leave(), true);
  assert.equal(kk.pending(), 350, 'the held 100 and the unsent 250');
});

// ═══ C-6: THE HUB'S LISTS GO WITH THE ROOM ═════════════════════════════════════════════════════════════════════════

test('AUDIT SCALE II C-6 the World, Region and Guild tabs\' lists of everyone online go with the room they were asked in - the seat taken, a refusal, a leave, another region - and the next room\'s welcome asks at once (mutants: kept past a terminal close; kept past a leave; the floors kept)', async () => {
  const names = (src) => rosterRows(src).rows.filter((r) => !r.me).map((r) => r.name);
  const stand = async (room, v = 'world192') => {
    const { FakeWS, sockets } = fakeSocketClass();
    const { s, adv, now } = session(FakeWS);
    s.join(room); sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 3, v, now: now() });
    assert.equal(s.sendHubWho(), true);
    sockets[0].receive({ t: 'found', all: 1, l: [{ id: 'peer-b', name: 'Bran' }, { id: 'peer-c', name: 'Cyra' }] });
    if (room.startsWith('chat:world')) {   // the Guild tab rides the hub's link alone
      assert.equal(s.sendGuildWho(), true);
      sockets[0].receive({ t: 'found', g: 1, l: [{ id: 'peer-g', name: 'Guildmate', gt: 'HND' }] });
      assert.deepEqual([...guildRosterSource(s, 'HND').peers.keys()], ['peer-g']);
    }
    assert.deepEqual(names(s), ['Bran', 'Cyra']);
    return { s, sockets, adv, now };
  };
  const gone = (s, why) => { assert.equal(s.hubOnline.size, 0, `${why}: the World tab lists nobody`); assert.equal(s.guildOnline.size, 0, `${why}: nor the Guild tab`); assert.deepEqual(names(s), [], why); };
  await quiet(async () => {
    let r = await stand('chat:world.3');
    r.sockets[0].drop(CLOSE_REPLACED, 'replaced');
    assert.equal(r.s.superseded, true);
    gone(r.s, 'the seat taken');
    r = await stand('chat:world.3');
    r.sockets[0].drop(CLOSE_POLICY, 'refused');
    assert.equal(r.s.terminal, true);
    gone(r.s, 'refused');
    r = await stand('chat:world.3');
    r.s.leave();
    gone(r.s, 'left');
    r = await stand('chat:world.3');
    r.sockets[0].drop(1006);
    assert.deepEqual(names(r.s), ['Bran', 'Cyra'], 'a blip keeps them, as it keeps the peers');
    // the Region tab moves on: the old region's players are not listed in the new, and the new is asked at once
    r = await stand('chat:region.17.2');
    r.adv(2000);
    r.s.join('chat:region.18.2');
    gone(r.s, 'another region');
    r.sockets[1].open();
    r.sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world192', now: r.now() });
    assert.equal(r.s.sendHubWho(), true, 'its welcome asks at once');
    assert.deepEqual(JSON.parse(r.sockets[1].sent.at(-1)), { t: 'find', all: 1 });
    // the hub link left and back (a page's goodbye and the rejoin): the Guild tab asks at once too
    r = await stand('chat:world.3');
    r.adv(2000);
    r.s.leave(); r.s.join('chat:world.3');
    r.sockets[1].open();
    r.sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 3, v: 'world192', now: r.now() });
    assert.equal(r.s.sendGuildWho(), true, 'the Guild tab\'s ask at once');
  });
});

// ═══ D-7: A RECONNECT THAT NEVER OPENED IS NO WAVE (SCALE2c) ═══════════════════════════════════════════════════════

test('AUDIT SCALE II D-7 a page\'s sockets back at their wave\'s slot, failing again before they open (the relay not up yet): no second wave, each at the old retry - the cell, its halos and the hub; and the spread\'s cap exactly (mutants: an unopened primary a drop; an unopened halo a drop; the cap moved)', async () => {
  assert.equal(WAVE_SPREAD_MAX_MS, 40_000, 'the spread\'s cap (bible SCALE2c: 40 s, inside TOKEN_REUSE_MS)');
  await quiet(() => {
    const p = page(['world:3,12', 'world:1,12']);   // two halos: two unopened halo sockets would make a wave on their own
    assert.equal(p.sockets.length, 4);
    for (const ws of p.sockets.slice(0, 4)) ws.drop(1006);   // a relay deploy: a wave
    p.advance(5_000);
    assert.equal(p.sockets.length, 8, 'all four back at the page\'s slot');
    p.roll(0.9);   // a second wave, were one drawn, would hold them 9 s
    for (const ws of p.sockets.slice(4)) ws.drop(1006);   // none of them opened
    p.advance(BACKOFF_MIN_MS * 2 + 1);
    assert.equal(p.sockets.length, 12, 'back at the old retry - never held for a second slot, the cell, the halos or the hub');
  });
});

// ═══ D-8: A RISE REPORTED AT THE MINUTE'S PACE (SCALE4h) ═══════════════════════════════════════════════════════════

test('AUDIT SCALE II D-8 a fighter at Renown 2 over the real Worker: each rise reported within RENOWN_REPORT_MS of the minute it was earned, the half hour\'s reports exactly as the law makes them (mutant: the rise rule unread)', async () => {
  const keep = console.warn; console.warn = () => {};
  try {
    const low = await playerHour({ role: 'fighter', minutes: 30, xp: 40, renown: 2 });
    assert.ok(low.rises.length >= 3, `${low.rises.length} rises in the half hour`);
    for (const r of low.rises) assert.ok(r.earnedAt != null && r.reportedAt - r.earnedAt <= RENOWN_REPORT_MS, `Renown ${r.level} earned at ${r.earnedAt} reported at ${r.reportedAt}`);
    assert.equal(low.routes['/v1/renown/xp'].requests, 8, 'eight reports: the coalesced pace and a rise\'s');
  } finally { console.warn = keep; }
});
