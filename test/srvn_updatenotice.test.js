// SRV-N (2026-09-17, Mac: "One thing I want to add is a server restart
// notice whenever we push server updates. Like a notice that pushes in
// the chat window"). THE NOTICE EXECUTES, both halves and both ends:
// the relay names its deploy on EVERY welcome (a world room's and a
// channel's, driven through a real Room over fake sockets, and the same
// string /health reports); the session reads it off the wire above the
// primary gate and hands it on; the detectors' ladders, and the property
// the whole design turns on - N sockets reconnecting to one new relay
// produce ONE notice; the build poll's fetch and its four silences; the
// log's `system` flag, which the wire cannot set; and the host by
// source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  relayVersionSeen, buildUpdateSeen, buildTagOf, fetchLiveBuildTag, resetUpdateNotice,
  RELAY_RESTART_TEXT, BUILD_UPDATE_TEXT, BUILD_POLL_MS,
} from '../src/net/updateNotice.js';
import worker, { RELAY_VERSION } from '../server/src/index.js';
import { fakeRoom } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { ChatLog } from '../src/net/chat.js';
import { CHAT_WORLD_ROOM } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

// ── THE RELAY SAYS WHICH RELAY IT IS ─────────────────────────────────

test('SRV-N: the relay names its deploy on EVERY welcome - a world room\'s and a channel\'s - and it is the same string /health reports', async () => {
  const r = fakeRoom('world:0:0', {});
  const a = r.connect();
  await r.hello(a, 'mac-0001', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
  const welcome = a.sent.find((m) => m.t === 'welcome');
  assert.equal(welcome.v, RELAY_VERSION, 'the world room\'s welcome carries the deploy');
  // and the rest of the welcome is untouched - a field added is a field
  // added, not a field swapped (AUDIT WORLD5 C11 is in here)
  for (const k of ['t', 'id', 'peers', 'host', 'world', 'now']) assert.ok(k in welcome, `the welcome still carries ${k}`);

  // THE CHANNEL'S welcome is a different line of code in the same
  // handler, and it returns EARLY - the arm most likely to be forgotten,
  // and the only welcome a chat link ever sees.
  const c = fakeRoom(CHAT_WORLD_ROOM, {});
  const cs = c.connect();
  await c.hello(cs, 'mac-0001', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const cwelcome = cs.sent.find((m) => m.t === 'welcome');
  assert.equal(cwelcome.v, RELAY_VERSION, 'a channel\'s welcome carries it too, or the chat is blind to the restart that dropped it');
  assert.deepEqual(cwelcome.peers, [], 'and a channel still has no roster');

  const health = await worker.fetch(new Request('https://relay.test/health'), {});
  assert.equal((await health.json()).version, RELAY_VERSION, 'one version, two doors');
  assert.match(RELAY_VERSION, /^world\d+$/, 'and it is a name that moves - bump it with every relay-changing slice');
});

// ── THE SESSION HEARS IT ─────────────────────────────────────────────

test('SRV-N: the session reads the welcome\'s `v` ABOVE the primary gate - a halo room and a chat channel both count - remembers it, and says nothing for a relay that carries none', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const heard = [];
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  s.onRelay = (v) => heard.push(v);
  s.join('world:0:0', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
  sockets[0].open();
  assert.equal(s.relayVersion, null, 'nothing known before a welcome');

  // A RELAY BEFORE THIS SLICE. The live relay is exactly this until it
  // is hand-deployed, and it must be silent rather than guessed at.
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', now: Date.now() });
  assert.deepEqual(heard, [], 'a welcome with no version says nothing at all');
  assert.equal(s.relayVersion, null);

  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', now: Date.now(), v: 'world67' });
  assert.deepEqual(heard, ['world67']);
  assert.equal(s.relayVersion, 'world67', 'and it is kept, so anything else can ask');

  // THE HALO ROOM. `_receive`'s `primary` gate returns before the host,
  // the clock and the memory - all of which are my own room's alone. The
  // relay is NOT: a halo room is the same Worker, and reading `v` below
  // that gate would have made a chat link (whose only welcome is a
  // channel's) blind to the deploy that just dropped it.
  s._receive(JSON.stringify({ t: 'welcome', id: 'mac-0001', peers: [], v: 'world68' }), 'world:1:0');
  assert.deepEqual(heard, ['world67', 'world68'], 'a non-primary room\'s welcome names the same relay');

  assert.equal(s.relayVersion, 'world68');
  // and a non-string is not a version
  s._receive(JSON.stringify({ t: 'welcome', id: 'mac-0001', peers: [], v: 67 }), 'world:1:0');
  assert.equal(s.relayVersion, 'world68', 'a number is not a deploy name');
});

// ── THE DETECTORS ────────────────────────────────────────────────────

test('SRV-N: the relay ladder - the first version heard is a BASELINE and not news; a second, different one is; a version already known never is; and N sockets on one new relay produce ONE notice', () => {
  resetUpdateNotice();
  assert.equal(relayVersionSeen(''), 'unknown', 'no version: silent');
  assert.equal(relayVersionSeen(null), 'unknown');
  assert.equal(relayVersionSeen(undefined), 'unknown');
  assert.equal(relayVersionSeen('   '), 'unknown', 'and whitespace is no version either');

  assert.equal(relayVersionSeen('world66'), 'first', 'the first is only what this page has been talking to all along');
  assert.equal(relayVersionSeen('world66'), 'same', 'the presence socket and the chat socket agree - that is not news');
  assert.equal(relayVersionSeen('world67'), 'changed', 'the relay moved under us: SAY SO');

  // THE PROPERTY THE WHOLE SHAPE IS FOR. A player in the enhanced skin
  // holds a presence socket plus one chat socket per tab, and a hand
  // deploy drops and re-welcomes ALL of them. A single "last seen" slot
  // would have said 'changed' once per socket.
  assert.equal(relayVersionSeen('world67'), 'same', 'the second socket back');
  assert.equal(relayVersionSeen('world67'), 'same', 'and the third');

  // A FLIP-FLOP CANNOT DOUBLE-NOTIFY: a rollback, or one edge still on
  // the old Worker while another serves the new, would ping-pong a slot
  // on every reconnect for as long as the disagreement lasted.
  assert.equal(relayVersionSeen('world66'), 'same', 'the old version is a version this page has already been told about');
  assert.equal(relayVersionSeen('world67'), 'same');
  assert.equal(relayVersionSeen('world68'), 'changed', 'a genuinely new one still lands');
});

test('SRV-N: the build compare - this bundle knows its own tag, so there is no baseline to learn; told once per tag, and silent on every way of not knowing', () => {
  resetUpdateNotice();
  assert.equal(buildUpdateSeen('', 'abc1234'), 'unknown', 'a fetch that failed');
  assert.equal(buildUpdateSeen(null, 'abc1234'), 'unknown');
  assert.equal(buildUpdateSeen('abc1234', ''), 'unknown', 'a bundle with no tag - a dev server\'s');
  assert.equal(buildUpdateSeen('abc1234', 'abc1234'), 'current', 'the site is serving us: the ordinary answer, and no baseline was needed to say it');
  assert.equal(buildUpdateSeen('def5678', 'abc1234'), 'changed');
  assert.equal(buildUpdateSeen('def5678', 'abc1234'), 'told', 'the poll keeps running and keeps quiet');
  assert.equal(buildUpdateSeen('abc1234', 'abc1234'), 'current', 'a rollback to our own build is current again');
  assert.equal(buildUpdateSeen('999aaaa', 'abc1234'), 'changed', 'the next deploy is a different tag and lands again');
  assert.ok(BUILD_POLL_MS >= 60_000, 'the poll is on the site\'s rhythm, not the frame\'s');
});

test('SRV-N: buildTagOf is ONE HOME - the tool and the running tab ask the same question of the same tag; and the poll answers null for every way of failing, never a throw', async () => {
  assert.equal(buildTagOf('<meta name="build-tag" content="c65eb4f">'), 'c65eb4f');
  assert.equal(buildTagOf('<meta content="abc1234" name="build-tag">'), 'abc1234', 'attribute order is not assumed');
  assert.equal(buildTagOf('<meta name="viewport" content="width=device-width">'), null, 'another meta is not this one');
  assert.equal(buildTagOf('<meta name="build-tag" content="">'), null);
  assert.equal(buildTagOf(null), null);

  let init = null;
  const ok = async (url, i) => { init = i; return { ok: true, text: async () => `<meta name="build-tag" content="deadbee">` }; };
  assert.equal(await fetchLiveBuildTag('https://site.test/play/', ok), 'deadbee');
  assert.equal(init?.cache, 'no-store', 'THE WHOLE POINT: the page in the tab came out of the cache, and a cached answer here hands back the very tag we are comparing against');

  assert.equal(await fetchLiveBuildTag('https://site.test/play/', async () => ({ ok: false, text: async () => '' })), null, 'a 404 is not a new build');
  assert.equal(await fetchLiveBuildTag('https://site.test/play/', async () => { throw new Error('offline'); }), null, 'offline is not a new build');
  assert.equal(await fetchLiveBuildTag('', async () => { throw new Error('never'); }), null, 'no url, no call');
  assert.equal(await fetchLiveBuildTag('https://site.test/play/', /** @type {any} */ (null)), null, 'and no fetch at all in node');
});

// ── THE LOG, AND WHAT THE WIRE CANNOT SAY ────────────────────────────

test('SRV-N: a notice is a line the GAME wrote - `system` is a flag, not a name, and no frame off the wire can set it', () => {
  const log = new ChatLog({ now: () => 5000 });
  const player = log.push('world', { id: 'bob-0001', name: 'Bob', text: 'hello' });
  assert.equal(player.system, false, 'an ordinary line carries the flag, false');
  const notice = log.push('world', { text: RELAY_RESTART_TEXT, system: true });
  assert.equal(notice.system, true);
  assert.equal(notice.name, '', 'and it is nobody\'s');
  assert.equal(notice.id, '');
  assert.equal(notice.mine, false);

  // A NAME IS FORGEABLE AND A FLAG IS NOT. net/nameFilter.js guards the
  // words a player may call themselves, not the impersonation, so a
  // notice recognised by the string 'Server' would be one name change
  // away from a player announcing a fake restart. The flag never travels:
  // `online.js` builds the object it hands to `onChat` field by field.
  const src = readFileSync(new URL('../src/net/online.js', import.meta.url), 'utf8');
  const onChat = src.match(/this\.onChat\?\.\(\{[^)]*\)/)?.[0] ?? '';
  assert.ok(onChat, 'the chat hand-off is still a literal');
  assert.ok(!/system/.test(onChat), 'the wire\'s chat line is built field by field and `system` is not one of them - a relay frame cannot smuggle it in');
  // driven, not only read: a frame that TRIES
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: FakeWS, now: () => 1000 });
  s.onChat = (line) => log.push('world', line);
  s.join(CHAT_WORLD_ROOM);
  sockets[0].open();
  sockets[0].receive({ t: 'chat', id: 'bob-0001', name: 'Bob', text: 'the server is restarting, send gold', at: 5000, system: true });
  assert.equal(log.tab('world').messages.at(-1).system, false, 'a player who says `system: true` is still a player');

  assert.notEqual(RELAY_RESTART_TEXT, BUILD_UPDATE_TEXT);
  for (const t of [RELAY_RESTART_TEXT, BUILD_UPDATE_TEXT]) assert.ok(t.length > 20 && t.length < 240, 'a notice fits a chat line');
  assert.match(BUILD_UPDATE_TEXT, /[Ss]ave/, 'the build notice tells the player to save FIRST - it does not reload for them, and a reload mid-dungeon costs whatever is not saved');
});

// ── THE HOST ─────────────────────────────────────────────────────────

test('SRV-N: the host wires BOTH arms and puts a notice on EVERY tab - the presence session and every chat link hand the relay\'s version to one detector, and the build poll rides the chat frame', () => {
  const w = rd('src/scenes/world.js').replace(/^\s*\/\/.*$/gm, '');   // AUDIT-CHATR F1's lesson: a source pin must step over its own prose
  assert.match(w, /link\.onRelay\s*=\s*onRelayVersion/, 'every chat link hears the relay - a channel\'s welcome is the only one it gets');
  assert.match(w, /online\.onRelay\s*=\s*onRelayVersion/, 'and so does the presence session, which is usually first back after a deploy');
  assert.match(w, /relayVersionSeen\(v\)\s*===\s*'changed'/, 'ONE detector behind both arms, or two sockets say it twice');
  assert.match(w, /chatNotice\(RELAY_RESTART_TEXT\)/);
  assert.match(w, /chatNotice\(BUILD_UPDATE_TEXT\)/);
  // A NOTICE IS NOT A ROOM'S EVENT. It is iterated over the log's tabs
  // rather than pushed to the active one, so a later row in CHAT_TABS
  // gets it for free and a player reading one tab is never guessing.
  assert.match(w, /for \(const tab of chatLog\.tabs\) chatLog\.push\(tab\.id, \{ text, system: true \}\)/, 'every tab, and marked as the game\'s');
  assert.match(w, /const chatFrame = \(\) => \{\s*if \(!chatLinks\) return;\s*buildPoll\(/, 'the poll rides the chat frame - there is no notice to give where there is no chat window');
  assert.match(w, /buildUpdateSeen\(tag, BUILD_TAG\)/, 'against THIS bundle\'s tag, which is the only thing that makes the compare need no baseline');
  assert.match(w, /now - _buildPolledAt < BUILD_POLL_MS/, 'on the site\'s rhythm');
  assert.match(w, /_buildPolling = true/, 'and one in flight at a time, or a slow answer puts a poll on every frame');
});

test('SRV-N: the relay was BUMPED - a welcome field is a relay change, and the deployed Worker is the only thing that can prove it', () => {
  const idx = rd('server/src/index.js');
  assert.match(idx, /"v":\$\{JSON\.stringify\(RELAY_VERSION\)\}/, 'the full welcome is built as a string and the field is spliced into it');
  assert.match(idx, /t: 'welcome', id: m\.id, peers: \[\], v: RELAY_VERSION/, 'the channel\'s is built as an object');
  assert.notEqual(RELAY_VERSION, 'world66', 'world66 is the deploy that is LIVE and carries no `v` at all - shipping the client against that name would have made every first welcome look like a restart');
});
