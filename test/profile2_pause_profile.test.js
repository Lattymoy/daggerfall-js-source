// PROFILE2 (2026-09-25, Mac: "Go ahead and make the profile icon visible somehow on the pause menu and allow changes").
//
// The profile mark - PROFILE1's portrait - stood on the front door alone, and the window it opens (the account and the
// Skin card) could not be reached from a game in progress. It stands on the pause screen now, as the character being
// PLAYED, and opens the same window over the pause window.
//
// AND A CHANGE MADE THERE HAS TO REACH THE ROOM. The look rode the hello alone (net/online.js said so: "a look is sent
// with the hello alone"), so a skin chosen mid-session stayed on this screen and nobody else's until the next room.
// The `look` frame says it again: the session keeps the new look and sends it down every socket already hello'd
// (through a relay that knows the frame, at LOOK_HZ_MAX), and the relay stores it as the hello's and fans the hello's
// JOIN - which every client already reads as "this peer's look is now this".
//
// Driven through the real relay (server/src/index.js Room, fakeRoom's real tokens), the real session (OnlineSession
// over fake sockets) and the real portrait reader; the pause face's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { parseClient, LOOK_HZ_MAX, LOOK_MIN_MS, LOOK_RELAY_MIN, relaySupportsLook, HELLO_HZ_MAX, CLOSE_BUSY } from '../src/net/wire.js';
import { liveCharacter, characterLine } from '../src/ui/profileBadge.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const i = console.info; console.info = () => {}; try { return fn(); } finally { console.info = i; } };
const LOOK_A = { race: 'Nord', gender: 'male', faceIndex: 2, eo: 3, items: [] };
const LOOK_B = { race: 'Nord', gender: 'male', faceIndex: 2, eo: 21, items: [] };

// ─── THE PORTRAIT ───────────────────────────────────────────────────────────────────────────────────────────────────

test('PROFILE2: paused, the portrait is the character being PLAYED - its race, sex, face, name and level off the live entity', () => {
  const e = { name: 'Mithriil', level: 7, race: 'HighElf', gender: 'female', faceIndex: 3, career: {}, items: [] };
  assert.deepEqual(liveCharacter(e), { name: 'Mithriil', level: 7, race: 'HighElf', gender: 'female', faceIndex: 3 });
  assert.equal(characterLine(liveCharacter(e)), 'Mithriil · level 7');
  assert.equal(liveCharacter({ name: 'x', race: '' }), null, 'no race: no character yet - the silhouette');
  assert.equal(liveCharacter({ name: 'x' }), null);
  assert.equal(liveCharacter(null), null);
});

test('PROFILE2: the pause face carries the mark and its window - the window innermost, and the door reads the live character only when paused', () => {
  const menu = src('src/ui/enhancedMenu.js');
  const mark = menu.slice(menu.indexOf('function profileMark()'), menu.indexOf('function profileMark()') + 600);
  assert.match(mark, /const save = mode === 'pause' \? liveCharacter\(playerEntity\) : portraitSave\(savedGames\(\)\);/);
  const pause = menu.slice(menu.indexOf('stage.append(pauseWindow());'), menu.indexOf('stage.append(pauseWindow());') + 2400);
  assert.match(pause, /home\.append\(profileMark\(\)\);/, 'the mark over the game');
  assert.match(pause, /if \(accountOpen\) \{\s*\n\s*const acct = el\('div', 'px-stage px-acctstage'\);\s*\n\s*acct\.append\(accountWindow\(\)\);/, 'the same window the door opens: the account and the Skin card');
  // the window is the innermost thing Escape closes, ahead of the pause face's resume (the one back stack)
  assert.match(menu, /const back = accountOpen \? \(\) => \{ accountOpen = false; render\(\); \}/);
  // and a visit's: a window left open on the door does not stand over the next pause unasked
  const mount = menu.slice(menu.indexOf('export function mountEnhancedMenu('), menu.indexOf('export function mountEnhancedMenu(') + 5000);
  assert.match(mount, /questRepairSaid = null;[^\n]*\n(\s*\/\/[^\n]*\n)*\s*accountOpen = false;\n/);
  const css = src('src/ui/enhancedStyle.js');
  assert.match(css, /\n\.px-over \.px-profile \{ top: 10px; right: 12px; \}/, 'a size smaller over the game, above the pause window');
  assert.match(css, /\n\.px-over \.px-portrait \{ width: 48px; height: 48px; \}/);
  assert.match(css, /\n\.px-over \.px-acctstage \{[^}]*align-items: center;/, 'its window centred - no wordmark to sit under');
});

// ─── THE WIRE AND THE RELAY ─────────────────────────────────────────────────────────────────────────────────────────

test('PROFILE2 wire: `look` is the hello\'s look without the hello - after one only, through validLook', () => {
  assert.deepEqual(parseClient(JSON.stringify({ t: 'look', look: LOOK_B }), { hasHello: true }), { t: 'look', look: LOOK_B });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'look', look: LOOK_B })), { error: 'look before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'look', look: 'x' }), { hasHello: true }), { error: 'bad look' });
  assert.equal(parseClient(JSON.stringify({ t: 'look', look: { ...LOOK_B, eo: 999 } }), { hasHello: true }).look.eo, 35, 'clamped at the door as the hello\'s is');
  assert.equal(LOOK_RELAY_MIN, 109);
  assert.equal(relaySupportsLook('world108'), false, 'an older relay closes on an unknown frame');
  assert.equal(relaySupportsLook('world109'), true);
  assert.equal(relaySupportsLook(null), false);
  assert.equal(LOOK_MIN_MS, 1000 / LOOK_HZ_MAX);
});

test('PROFILE2 relay: a look is stored as the hello\'s and fanned as its JOIN to everyone else - never to its sender, never with a pose; `who` and a later welcome say the new one', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'peer-0001', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 }); await r.hello(b, 'peer-0002'); await r.hello(c, 'peer-0003');
  assert.ok(r.room._attach(a).pose, 'a stands somewhere the relay knows - so a join that named it would say where');
  const joins = (ws) => ws.sent.filter((m) => m.t === 'join' && m.id === 'peer-0001');
  const before = joins(b).length;
  await r.raw(a, JSON.stringify({ t: 'look', look: LOOK_B }));
  const said = joins(b).at(-1);
  assert.equal(joins(b).length, before + 1, 'b is told');
  assert.deepEqual(said.look, LOOK_B, 'the new look');
  assert.equal(said.pose, null, 'a join to the whole room names no position - the pose fan is the ranged one');
  assert.equal(typeof said.name, 'string');
  assert.deepEqual(joins(c).at(-1).look, LOOK_B, 'c too');
  assert.equal(joins(a).length, 0, 'never back to its sender');
  // the stored look is the one a later hello's roster and a `who` answer read
  const d = r.connect(); await r.hello(d, 'peer-0004');
  const welcome = d.sent.find((m) => m.t === 'welcome');
  assert.deepEqual(welcome.peers.find((p) => p.id === 'peer-0001').look, LOOK_B, 'a later joiner is welcomed with it');
  await r.raw(d, JSON.stringify({ t: 'who', id: 'peer-0001' }));
  assert.deepEqual(d.sent.filter((m) => m.t === 'join' && m.id === 'peer-0001').at(-1).look, LOOK_B, 'and a `who` answers it');
});

test('PROFILE2 relay: the look is metered - one a socket per 1/LOOK_HZ_MAX s (the rest dropped and struck), the room\'s hello budget spent by the fan and a busy refusal past it; a channel keeps no look', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'peer-0001'); await r.hello(b, 'peer-0002');
  const told = () => b.sent.filter((m) => m.t === 'join' && m.id === 'peer-0001').length;
  const t0 = told();
  await r.raw(a, JSON.stringify({ t: 'look', look: LOOK_B }));
  await r.raw(a, JSON.stringify({ t: 'look', look: LOOK_A }));
  assert.equal(told(), t0 + 1, 'the second inside the gate is dropped');
  assert.equal(a.meters.lookDrops, 1, 'and struck on the looks\' own meter');
  assert.equal(a.closed, null, 'one strike is not a close');
  // the fan is a hello's fan: a room whose hello budget is spent refuses a look busy - its reconnect's hello carries it
  const busy = fakeRoom('world:4,12');
  const x = busy.connect(), y = busy.connect();
  await busy.hello(x, 'peer-0011'); await busy.hello(y, 'peer-0012');
  const bucket = await busy.state.storage.get('hellos');
  await busy.state.storage.put('hellos', { ...bucket, tokens: 0, at: Date.now() });
  await busy.raw(x, JSON.stringify({ t: 'look', look: LOOK_B }));
  assert.equal(x.closed?.code, CLOSE_BUSY, 'refused busy, exactly as a hello past HELLO_HZ_MAX is');
  assert.equal(y.sent.filter((m) => m.t === 'join' && m.id === 'peer-0011').length, 0, 'nothing fanned');
  assert.ok(HELLO_HZ_MAX >= 1);
  // a channel: nobody is drawn from it
  const hub = fakeRoom('chat:world');
  const h1 = hub.connect(), h2 = hub.connect();
  await hub.hello(h1, 'peer-0021'); await hub.hello(h2, 'peer-0022');
  const n = h2.sent.length;
  await hub.raw(h1, JSON.stringify({ t: 'look', look: LOOK_B }));
  assert.equal(h2.sent.length, n, 'a channel says nothing');
  assert.equal(await hub.state.storage.get('look:peer-0021'), undefined, 'and keeps nothing');
});

// ─── THE SESSION ────────────────────────────────────────────────────────────────────────────────────────────────────

function linkRig(relayV) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', look: LOOK_A, WebSocketImpl: FakeWS, now: () => t });
  quiet(() => s.join('world:2,12', { x: 1, y: 0, z: 1, yaw: 0 }));
  sockets[0].open();
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, v: relayV }));
  const looks = (ws) => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'look');
  return { s, sockets, looks, tick: (ms) => { t += ms; s.tick(); } };
}

test('PROFILE2 session: a changed look is kept and said down every hello\'d socket that knows the frame - the primary and each open halo; the same look again says nothing', () => {
  const { s, sockets, looks } = linkRig('world109');
  assert.equal(s.lookOk, true);
  quiet(() => s.setHalo(['world:3,12'])); sockets[1].open();
  quiet(() => sockets[1].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, v: 'world109' }));
  assert.equal(s.setLook(LOOK_A), false, 'the look it already said');
  assert.equal(looks(sockets[0]).length, 0);
  assert.equal(s.setLook(LOOK_B), true);
  assert.deepEqual(looks(sockets[0]).map((m) => m.look), [LOOK_B], 'the primary');
  assert.deepEqual(looks(sockets[1]).map((m) => m.look), [LOOK_B], 'and the halo - a peer across the cell edge draws me too');
  assert.deepEqual(s.look, LOOK_B, 'kept: every hello from now on carries it');
  assert.equal(s.setLook(LOOK_B), false, 'said once');
  // a halo opened after the change says hello WITH it (no frame owed)
  quiet(() => s.setHalo(['world:3,12', 'world:1,12'])); sockets[2].open();
  assert.deepEqual(JSON.parse(sockets[2].sent[0]).look, LOOK_B, 'the new halo\'s hello');
  assert.equal(s.setLook(null), false, 'no look is no change');
});

test('PROFILE2 session: trying skin after skin says the LAST one - held by the gate, flushed by the tick; an older relay is never sent the frame; nothing open owes nothing', () => {
  const { s, sockets, looks, tick } = linkRig('world109');
  s.setLook(LOOK_B);
  s.setLook({ ...LOOK_B, eo: 22 });
  s.setLook({ ...LOOK_B, eo: 23 });
  assert.equal(looks(sockets[0]).length, 1, 'inside the gate: held');
  tick(LOOK_MIN_MS / 2);
  assert.equal(looks(sockets[0]).length, 1, 'still held');
  tick(LOOK_MIN_MS / 2);
  assert.deepEqual(looks(sockets[0]).map((m) => m.look.eo), [21, 23], 'the latest, once the gate opens - never 22');
  tick(LOOK_MIN_MS * 3);
  assert.equal(looks(sockets[0]).length, 2, 'and nothing more');
  // an older relay: the frame would close the socket
  const old = linkRig('world108');
  assert.equal(old.s.lookOk, false);
  assert.equal(old.s.setLook(LOOK_B), true, 'kept for the next hello');
  old.tick(LOOK_MIN_MS * 2);
  assert.equal(old.looks(old.sockets[0]).length, 0, 'never sent');
  assert.deepEqual(old.s.look, LOOK_B);
  // no socket at all: the next hello carries it, and the dirty flag does not linger into a later socket's send
  const none = linkRig('world109');
  quiet(() => none.s.leave());
  none.s.setLook(LOOK_B);
  assert.equal(none.s._lookDirty, false, 'nothing owed');
});

test('PROFILE2 end to end: the frame a session sends, through the real relay, changes the look a peer\'s session draws', async () => {
  const r = fakeRoom('world:3,12');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'peer-0001', { x: 1, y: 0, z: 1, yaw: 0 }, { look: LOOK_A }); await r.hello(b, 'peer-0002');
  // b's session, fed what the relay sends b
  const { FakeWS, sockets } = fakeSocketClass();
  const sb = new OnlineSession({ url: 'wss://relay.test', name: 'Bran', id: 'peer-0002', secret: 'secret-of-peer-0002', WebSocketImpl: FakeWS, now: () => 1000 });
  quiet(() => sb.join('world:3,12', null)); sockets[0].open();
  const feed = (from) => { for (const m of from) quiet(() => sockets[0].receive(m)); };
  feed(b.sent);
  assert.deepEqual(sb.peers.get('peer-0001')?.look, LOOK_A, 'the hello\'s look');
  const n = b.sent.length;
  await r.raw(a, JSON.stringify({ t: 'look', look: LOOK_B }));
  feed(b.sent.slice(n));
  assert.deepEqual(sb.peers.get('peer-0001').look, LOOK_B, 'the new one, without a new room');
  assert.equal(sb.peers.size, 1, 'the same peer, refreshed - not a second one');
});

// ─── THE HOSTS ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('PROFILE2 hosts: the world host hands the session its look once a second and at every hello it opens; the body fetches a changed set whole', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const ONLINE_LOOK_CHECK_MS = 1000;/);
  assert.match(w, /if \(now - _onlineLookAt >= ONLINE_LOOK_CHECK_MS\) \{ _onlineLookAt = now; online\.setLook\(composeLook\(playerEntity\)\); \}/);
  assert.doesNotMatch(w, /online\.look = composeLook/, 'no look written past the session - a promoted halo sends no hello, so only setLook tells it');
  assert.equal((w.match(/online\.setLook\(composeLook\(playerEntity\)\)/g) ?? []).length, 3, 'the cadence, the join and the halo about to open');
  const body = src('src/player/eotbBody.js');
  assert.match(body, /if \(renderer && \(was\.onFoot !== cfg\.onFoot \|\| was\.onHorse !== cfg\.onHorse\)\) preload\(\);/);
});
