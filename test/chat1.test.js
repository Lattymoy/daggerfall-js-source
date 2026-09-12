// CHAT1 (2026-09-12, Mac: "I want to add a new UI element. The live chat
// in enhanced format. Players will be able to type and chat live with
// other players. Currently I just want one world tab with the ability
// to add more tabs at a later time"), re-pinned by AUDIT CHAT (Mac:
// "Lets do an audit on this before merging"). THE CHAT EXECUTES: the
// wire's chat law at both ends (the line sanitized the same way the
// relay sanitizes it - every format character, the variation selectors,
// a lone surrogate, a stack of marks - and idempotently, the frame
// after hello only, the gate at CHAT_HZ_MAX, the channel whitelist);
// the Room as a CHANNEL over fake sockets (no roster, no join, no
// leave, no look; a pose and a ping gated and counted then declined;
// every line to everyone, the sender included; the secret still
// guarding the id; the hello gate deeper, never off; the room's own
// line budget; the deeper socket cap; the Worker's 404 for a channel
// it does not run; the drain sweep) and a line in a PLACE room reaching
// as far as a pose and the sender, the chat gate with its own bucket
// and strikes proved in a place; the channel session over a fake
// socket (the hello with no pose, a pose refused, the ping heartbeat,
// sendChat gated as the relay gates it, onChat with `mine`, rejoin
// after the goodbye and after a terminal close, the labelled status);
// the log (the World tab from CHAT_TABS and the whitelist, the cap,
// unread by open-and-active, the peek's fade, the tag); the panel over
// a fake document and window with both phases (the cursor key opens
// through the registry, the field's keys stopped before the host's
// bubble listener so the ring never fills, F5 swallowed, the IME's
// Enter, a held Enter, Tab, Enter sends and closes, a refused line
// kept, Escape, an untrusted Enter opens nothing, a press stopped and a
// release passed, the pointer hooks, a covering window or overlay
// hides and closes, lines are text never markup, the list grown not
// rebuilt, the badge, the touch button); the host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAT_MAX, CHAT_HZ_MAX, CHAT_STRIKES_MAX, CHAT_SOCKETS_MAX, CHAT_HELLO_HZ_MAX, CHAT_ROOM_HZ_MAX, CHAT_WORLD_ROOM, CHAT_ROOMS,
  SOCKETS_MAX, HELLO_HZ_MAX, DROP_STRIKES_MAX, PIXEL_UNITS,
  sanitizeChat, isChatRoom, parseClient, chatGate,
} from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import worker, { Room } from '../server/src/index.js';
import { OnlineSession, HEARTBEAT_MS, BACKOFF_MIN_MS } from '../src/net/online.js';
import { ChatLog, CHAT_TABS, CHAT_KEEP, CHAT_FADE_MS, CHAT_PEEK, CHAT_REJOIN_MS, tagOf } from '../src/net/chat.js';
import { createChatPanel, isOpenKey, CHAT_STYLE_ID, CHAT_OPEN_ACTION, clockOf } from '../src/ui/chatPanel.js';
import { registerOverlay, overlayOpen } from '../src/ui/enhancedOverlays.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE WIRE ─────────────────────────────────────────────────────────

test('CHAT1 / AUDIT CHAT: the wire - the constants once and literally, one home at both ends; a line sanitized (every format character and the variation selectors gone, U+FE0F kept, a lone surrogate gone, a stack of marks cut to three, whitespace one, the bound never inside a pair) and idempotently; the channel whitelist; the frame after hello only; the gate at CHAT_HZ_MAX', () => {
  assert.equal(CHAT_MAX, 240); assert.equal(CHAT_HZ_MAX, 2); assert.equal(CHAT_STRIKES_MAX, 20); assert.equal(CHAT_SOCKETS_MAX, 2048);
  assert.equal(CHAT_HELLO_HZ_MAX, 50); assert.equal(CHAT_ROOM_HZ_MAX, 20);
  assert.equal(CHAT_WORLD_ROOM, 'chat:world');
  assert.deepEqual([...CHAT_ROOMS], ['chat:world'], 'the whitelist: the World tab alone today');
  for (const k of ['sanitizeChat', 'isChatRoom', 'chatGate']) assert.equal(relay[k], { sanitizeChat, isChatRoom, chatGate }[k], `${k}: the same function object at both ends`);
  assert.equal(relay.CHAT_MAX, CHAT_MAX); assert.equal(relay.CHAT_ROOMS, CHAT_ROOMS);
  // the sanitizer
  assert.equal(sanitizeChat('  hello   there  '), 'hello there', 'whitespace collapsed and trimmed');
  assert.equal(sanitizeChat('a\u202eb\u200bc\u2066d\ufeffe'), 'abcde', 'bidi overrides, zero widths, isolates and the BOM are gone');
  assert.equal(sanitizeChat('a\u061cb\u00adc\u180ed\u2060e'), 'abcde', 'AUDIT CHAT A4: the Arabic letter mark, the soft hyphen, the Mongolian separator, the word joiner - every Cf, not five ranges');
  assert.equal(sanitizeChat('hi\u{E0001}\u{E0041}\u{E007F}'), 'hi', 'the tag block is gone');
  assert.equal(sanitizeChat('x\ufe00y\ufe0ez\u{E0100}w'), 'xyzw', 'the variation selectors are gone');
  assert.equal(sanitizeChat('\u2764\ufe0f'), '\u2764\ufe0f', 'but U+FE0F stays: emoji presentation needs it');
  assert.equal(sanitizeChat('x\u0000y\u001fz\u007fw\u009fv'), 'xyzwv', 'C0, DEL and C1 are gone');
  assert.equal(sanitizeChat('a\ud800b\udfffc'), 'abc', 'AUDIT CHAT B3: a lone surrogate is not a character');
  assert.equal(sanitizeChat('\udbff\udbff'), '', 'two of them are nothing - and the same on a second pass');
  assert.equal(sanitizeChat('hi \u{1F600} there'), 'hi \u{1F600} there', 'a real astral character is one code point and stays');
  assert.equal(sanitizeChat('A' + '\u0300'.repeat(200) + 'b'), 'A\u0300\u0300\u0300b', 'AUDIT CHAT A4: a stack of marks is cut to three');
  assert.equal(sanitizeChat('n\u0303a\u0301'), 'n\u0303a\u0301', 'a mark or two is a language');
  assert.equal(sanitizeChat('\u0928\u092e\u0938\u094d\u0924\u0947'), '\u0928\u092e\u0938\u094d\u0924\u0947', 'Devanagari untouched');
  assert.equal(sanitizeChat('\t\n  \r'), '', 'nothing to say is the empty string');
  assert.equal(sanitizeChat(null), ''); assert.equal(sanitizeChat(42), '42');
  assert.equal(sanitizeChat('héllo wörld — ok'), 'héllo wörld — ok', 'a person\'s own letters stay');
  assert.equal(sanitizeChat('x'.repeat(CHAT_MAX + 50)).length, CHAT_MAX, 'bounded');
  const paired = sanitizeChat('a'.repeat(CHAT_MAX - 1) + '\u{1F600}');
  assert.equal(paired.length, CHAT_MAX - 1, 'the bound fell inside a surrogate pair: the pair goes, not half of it');
  assert.equal(sanitizeChat('<b>hi</b>'), '<b>hi</b>', 'markup is text here - the panel writes textContent, never innerHTML');
  // idempotent: what the client sends the relay takes (B3 - the invariant the whole wire rests on)
  const alphabet = ['a', ' ', '\t', '\u0300', '\u0301', '\ud800', '\udbff', '\udc00', '\u200b', '\u202e', '\u061c', '\ufe0f', '\ufeff', '\u{1F600}', '<', '\u0000', '\u00ad', '\u{E0041}'];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 3000; i++) {
    let x = ''; const n = 1 + Math.floor(rnd() * 12);
    for (let j = 0; j < n; j++) x += alphabet[Math.floor(rnd() * alphabet.length)];
    const once = sanitizeChat(x);
    assert.equal(sanitizeChat(once), once, `idempotent on ${JSON.stringify(x)}`);
  }
  // the rooms
  assert.equal(isChatRoom('chat:world'), true);
  assert.equal(isChatRoom('chat:party.abc'), false, 'AUDIT CHAT A1: a whitelist, not a prefix - a room the port does not run is no channel');
  assert.equal(isChatRoom('chat:' + 'z'.repeat(70)), false);
  assert.equal(isChatRoom('world:1,2'), false); assert.equal(isChatRoom('town:m9'), false); assert.equal(isChatRoom(null), false);
  // the frame
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: ' hi  there ' }), { hasHello: true }), { t: 'chat', text: 'hi there' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'hi' })), { error: 'chat before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: '   ' }), { hasHello: true }), { error: 'bad chat' }, 'an empty line is not the port\'s client');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 7 }), { hasHello: true }), { error: 'bad chat' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat' }), { hasHello: true }), { error: 'bad chat' });
  // the gate: CHAT_HZ_MAX a second, the burst the same number, refilling
  let g = { pass: true, bucket: null };
  for (let i = 0; i < CHAT_HZ_MAX; i++) { g = chatGate(g.bucket, 1000); assert.equal(g.pass, true, `line ${i} of the burst passes`); }
  g = chatGate(g.bucket, 1000); assert.equal(g.pass, false, 'the line past the burst is dropped');
  g = chatGate(g.bucket, 1000 + 1000 / CHAT_HZ_MAX); assert.equal(g.pass, true, 'one refills after 1/CHAT_HZ_MAX s');
  g = chatGate(g.bucket, 1000 + 1000 / CHAT_HZ_MAX); assert.equal(g.pass, false, 'and only one');
});

// ── THE ROOM ─────────────────────────────────────────────────────────

/** The relay test's fake Room: a state with sockets and storage, a socket with a bounded attachment (the runtime's 16 KiB). */
function fakeRoom(key) {
  const sockets = [];
  const store = new Map();
  const state = {
    getWebSockets: () => sockets.slice(),
    acceptWebSocket: (ws) => sockets.push(ws),
    storage: {
      async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k); },
      async put(k, v) { if (k && typeof k === 'object') { for (const [kk, vv] of Object.entries(k)) store.set(kk, vv); } else store.set(k, v); }, async delete(k) { for (const x of Array.isArray(k) ? k : [k]) store.delete(x); }, async deleteAll() { store.clear(); }, async list({ prefix = '' } = {}) { return new Map([...store].filter(([k]) => k.startsWith(prefix))); },
    },
  };
  const room = new Room(state);
  const connect = () => {
    const ws = { sent: [], closed: null, att: { key, id: null, name: null, pose: null, bucket: null, drops: 0 },
      send(s) { if (this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); }, close(code, reason) { this.closed = { code, reason }; },
      serializeAttachment(a) { if (JSON.stringify(a).length > 16384) throw new Error('attachment too large'); this.att = JSON.parse(JSON.stringify(a)); }, deserializeAttachment() { return this.att; } };
    state.acceptWebSocket(ws);
    return ws;
  };
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  const hello = (ws, id, pose = null, secret = 'secret-of-' + id) => room.webSocketMessage(ws, JSON.stringify({ t: 'hello', id, secret, name: id, look, pose }));
  const chat = (ws, text) => room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text }));
  const pose = (ws, p) => room.webSocketMessage(ws, JSON.stringify({ t: 'pose', p }));
  const ping = (ws) => room.webSocketMessage(ws, '{"t":"ping","x":1}');   // not the byte-exact one the runtime answers in its sleep: this one wakes the object
  const drop = (ws) => { sockets.splice(sockets.indexOf(ws), 1); return room.webSocketClose(ws, 1005, ''); };
  return { room, state, store, sockets, connect, hello, chat, pose, ping, drop };
}
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const chats = (ws) => ws.sent.filter((m) => m.t === 'chat');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const upgrade = (path) => new Request('https://relay.test' + path, { headers: { Upgrade: 'websocket' } });

test('CHAT1 / AUDIT CHAT: the Room as a CHANNEL - a hello keeps the secret and no look, is told an empty roster and announced to no one; a pose and a ping are gated and counted, then reach no one; a line reaches everyone, the sender included, shaped {t,id,name,text,at} on the relay\'s clock; the leave says nothing; the secret still guards the id; the hello gate runs deeper, never off; the socket cap is CHAT_SOCKETS_MAX; the Worker opens no object for a channel it does not run; a room that drains sweeps its storage', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001'); await r.hello(b, 'bbbb-0002', at(3, 3));
  assert.deepEqual(a.sent, [{ t: 'welcome', id: 'aaaa-0001', peers: [] }]);
  assert.deepEqual(b.sent, [{ t: 'welcome', id: 'bbbb-0002', peers: [] }], 'a channel has no roster: b is told no one though a is there');
  assert.equal(ofType(a, 'join').length, 0, 'and a hears no join');
  assert.equal(r.store.has('secret:aaaa-0001'), true, 'the secret is kept');
  assert.equal(r.store.has('look:aaaa-0001'), false, 'the look is not: nobody is drawn from a channel');
  assert.equal(r.store.has('hellos'), true, 'AUDIT CHAT A1: the hello bucket is kept - the gate is never off');
  assert.equal(b.att.pose, null, 'a pose in the hello is not kept either');
  await r.pose(a, at(1, 1));
  assert.equal(ofType(b, 'pose').length, 0, 'a pose in a channel reaches no one');
  assert.equal(a.att.pose, null, 'and is kept by no one');
  assert.ok(a.att.bucket, 'AUDIT CHAT A3: but it spent a token - gated and counted before it was declined');
  for (let i = 0; i < DROP_STRIKES_MAX + 30; i++) await r.pose(a, at(1, 1));
  assert.equal(a.closed?.code, 1008, 'a pose storm into a channel closes the socket as it does in a place');
  assert.deepEqual(a.sent.at(-1), { t: 'error', m: 'too many poses' });
  const p = r.connect(); await r.hello(p, 'ping-0009');
  for (let i = 0; i < 5; i++) await r.ping(p);
  assert.equal(ofType(p, 'pong').length, 5, 'a ping that wakes the object is answered');
  for (let i = 0; i < DROP_STRIKES_MAX + 30; i++) await r.ping(p);
  assert.equal(p.closed?.code, 1008, 'AUDIT CHAT A3: and a ping storm is not ungated ingress either');
  const before = Date.now();
  await r.chat(b, '  hello   world ');
  const line = chats(b)[0];
  assert.ok(line, 'the sender hears its own line back: the receipt');
  assert.equal(line.id, 'bbbb-0002'); assert.equal(line.name, 'bbbb-0002'); assert.equal(line.text, 'hello world', 'sanitized by the relay');
  assert.ok(line.at >= before && line.at <= Date.now(), 'stamped by the relay\'s own clock, now (AUDIT CHAT D8)');
  assert.equal(chats(c).length, 0, 'c never said hello: it hears nothing');
  await r.hello(c, 'bbbb-0002', null, 'not-the-secret-of-b');
  assert.equal(c.closed?.code, 1008, 'the secret guards an id in a channel as in a place');
  assert.deepEqual(c.sent.at(-1), { t: 'error', m: 'id taken' });
  const d = r.connect(); await r.hello(d, 'dddd-0004');
  await r.drop(b);
  assert.equal(ofType(d, 'leave').length, 0, 'a channel announced no join, so it says no leave');
  assert.equal(r.store.has('secret:bbbb-0002'), false, 'the secret goes with the socket');
  assert.equal(r.store.has('secret:dddd-0004'), true, 'and no one else\'s');
  // the hello gate: deeper than a place's, never off (A1)
  const burst = fakeRoom(CHAT_WORLD_ROOM);
  const many = Array.from({ length: CHAT_HELLO_HZ_MAX + 10 }, () => burst.connect());
  for (let i = 0; i < many.length; i++) await burst.hello(many[i], `peer-${String(i).padStart(4, '0')}`);
  assert.equal(many.filter((ws) => ws.sent[0]?.t === 'welcome' && !ws.closed).length, CHAT_HELLO_HZ_MAX, 'CHAT_HELLO_HZ_MAX hellos in one instant are welcomed');
  assert.equal(many.filter((ws) => ws.closed?.code === 1013).length, 10, 'and the rest are refused busy: the gate is never off');
  assert.ok(CHAT_HELLO_HZ_MAX > HELLO_HZ_MAX, 'deeper than a place\'s: a channel\'s hello costs no roster');
  // the cap: deeper than a place's; the Worker: no object for a channel the port does not run
  let pairs = 0;
  const hadPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { pairs++; this[0] = {}; this[1] = { serializeAttachment() {} }; } };
  try {
    const full = fakeRoom(CHAT_WORLD_ROOM); for (let i = 0; i < CHAT_SOCKETS_MAX; i++) full.connect();
    assert.equal((await full.room.fetch(upgrade('/room/chat:world'))).status, 503, 'CHAT_SOCKETS_MAX: room full');
    assert.equal(pairs, 0);
    const deep = fakeRoom(CHAT_WORLD_ROOM); for (let i = 0; i < SOCKETS_MAX; i++) deep.connect();
    const r2 = await deep.room.fetch(upgrade('/room/chat:world')).then((x) => x.status, (e) => e);
    assert.notEqual(r2, 503, 'SOCKETS_MAX sockets do not fill a channel');
    assert.equal(pairs, 1, 'the upgrade went on to the pair (the 101 itself is the runtime\'s to mint, not node\'s)');
    const place = fakeRoom('town:m9'); for (let i = 0; i < SOCKETS_MAX; i++) place.connect();
    assert.equal((await place.room.fetch(upgrade('/room/town:m9'))).status, 503, 'a place still fills at SOCKETS_MAX');
  } finally { globalThis.WebSocketPair = hadPair; }
  let minted = 0;
  const env = { ROOMS: { idFromName: () => { minted++; return 'id'; }, get: () => ({ fetch: async () => new Response('ok') }) } };
  assert.equal((await worker.fetch(upgrade('/room/chat:junk'), env)).status, 404, 'AUDIT CHAT A1: a chat: key the port does not run is no room');
  assert.equal((await worker.fetch(upgrade('/room/chat:' + 'z'.repeat(70)), env)).status, 404);
  assert.equal(minted, 0, 'and no object is minted for it');
  assert.equal((await worker.fetch(upgrade('/room/chat:world'), env)).status, 200, 'the World tab\'s room opens');
  assert.equal((await worker.fetch(upgrade('/room/world:1,2'), env)).status, 200, 'a place opens as before');
  assert.equal(minted, 2);
  // the drain sweep (A7): a channel is never empty on the way in, so it sweeps on the way out
  const drain = fakeRoom(CHAT_WORLD_ROOM);
  const x = drain.connect(), y = drain.connect();
  await drain.hello(x, 'xxxx-0001'); await drain.hello(y, 'yyyy-0002');
  drain.store.set('secret:lost-0003', 'left-by-an-unclean-close');
  await drain.drop(x);
  assert.equal(drain.store.has('secret:lost-0003'), true, 'one still in: nothing swept');
  assert.equal(drain.store.has('secret:yyyy-0002'), true);
  await drain.drop(y);
  assert.equal(drain.store.size, 0, 'the last one out sweeps everything - the secrets, the leftovers, the hello bucket');
});

test('CHAT1 / AUDIT CHAT: the Room - a line in a PLACE room reaches as far as a pose (the sender always); the chat gate is CHAT_HZ_MAX with its OWN bucket and strikes (a mover over the pose rate may still talk) - an over-rate line is dropped, never queued, and past CHAT_STRIKES_MAX in a row the socket is closed; the room spends CHAT_ROOM_HZ_MAX lines a second for everyone, and a line over that is dropped with no strike', async () => {
  const r = fakeRoom('world:0,0');
  const a = r.connect(), near = r.connect(), far = r.connect(), mute = r.connect();
  await r.hello(a, 'aaaa-0001', at(2, 2)); await r.hello(near, 'near-0002', at(4, 4)); await r.hello(far, 'farr-0003', at(9, 9)); await r.hello(mute, 'mute-0004');
  await r.chat(a, 'over here');
  assert.equal(chats(a).length, 1, 'the sender'); assert.equal(chats(near).length, 1, 'within RANGE_PIXELS');
  assert.equal(chats(far).length, 0, 'past it: not heard'); assert.equal(chats(mute).length, 0, 'no pose: no range to measure, not heard');
  // the gate's own bucket, proved where the pose gate runs (AUDIT CHAT D1)
  for (let i = 0; i < 40; i++) await r.pose(a, at(2, 2));
  assert.ok(a.att.drops > 0, 'the mover is over the pose rate');
  await r.chat(a, 'can you hear me');
  assert.equal(chats(near).length, 2, 'a mover may still talk: the chat gate has its own bucket');
  assert.equal(a.att.cdrops, 0, 'and its own strikes');
  // the gate's strikes
  const fresh = fakeRoom(CHAT_WORLD_ROOM);
  const t = fresh.connect(), l = fresh.connect();
  await fresh.hello(t, 'talk-0001'); await fresh.hello(l, 'list-0002');
  for (let i = 0; i < CHAT_HZ_MAX + 3; i++) await fresh.chat(t, `line ${i}`);
  assert.equal(chats(l).length, CHAT_HZ_MAX, 'the burst is relayed, the rest dropped');
  assert.equal(t.att.cdrops, 3, 'three strikes'); assert.equal(t.closed, null, 'not yet an offence');
  for (let i = 0; i < CHAT_STRIKES_MAX; i++) await fresh.chat(t, 'spam');
  assert.equal(t.closed?.code, 1008, 'past CHAT_STRIKES_MAX dropped in a row the socket is closed');
  assert.deepEqual(t.sent.at(-1), { t: 'error', m: 'too many lines' });
  assert.equal(chats(l).length, CHAT_HZ_MAX, 'and none of the spam reached anyone');
  // the room's budget (AUDIT CHAT A2): everyone under their own rate, the room over its
  const crowd = fakeRoom(CHAT_WORLD_ROOM);
  const talkers = Array.from({ length: CHAT_ROOM_HZ_MAX + 10 }, () => crowd.connect());
  const ear = crowd.connect(); await crowd.hello(ear, 'ear-0000');
  for (let i = 0; i < talkers.length; i++) await crowd.hello(talkers[i], `talk-${String(i).padStart(4, '0')}`);
  for (let i = 0; i < talkers.length; i++) await crowd.chat(talkers[i], `line from ${i}`);
  assert.equal(chats(ear).length, CHAT_ROOM_HZ_MAX, 'CHAT_ROOM_HZ_MAX lines in one instant reach the room');
  assert.ok(talkers.every((ws) => (ws.att.cdrops ?? 0) === 0 && !ws.closed), 'the ten dropped were nobody\'s offence: no strike, no close');
  assert.equal(chats(talkers.at(-1)).filter((m) => m.id === `talk-${String(talkers.length - 1).padStart(4, '0')}`).length, 0, 'the sender over the room\'s budget hears no echo - the only word of it');
  assert.equal(chats(talkers.at(-1)).length, CHAT_ROOM_HZ_MAX, 'though it hears everyone else');
});

// ── THE SESSION ──────────────────────────────────────────────────────

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
    drop(code = 1006) { this.onclose?.({ code, reason: '' }); }
  }
  return { FakeWS, sockets };
}

test('CHAT1 / AUDIT CHAT: the session as a CHANNEL (presence: false) - the hello carries no pose, a pose is refused, a ping every HEARTBEAT_MS keeps the socket, sendChat sanitizes and gates as the relay does and sends nothing for nothing, a line in reaches onChat with mine; rejoin is the way back after the page\'s goodbye and, after CHAT_REJOIN_MS, after a terminal close; the status line carries its label; a presence session is unchanged', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const now = () => clock;
  const heard = [];
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: FakeWS, now });
  s.onChat = (line) => heard.push(line);
  assert.equal(s.presence, false);
  s.join(CHAT_WORLD_ROOM, { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 });
  const ws = sockets[0];
  assert.equal(ws.url, 'wss://relay.test/room/chat:world');
  ws.open();
  assert.equal(ws.sent[0].t, 'hello'); assert.equal(ws.sent[0].pose, null, 'a channel\'s hello carries no pose whatever the join was handed');
  assert.equal(ws.sent[0].id, 'mac-0001'); assert.equal(ws.sent[0].secret, 'secret-of-mac-0001');
  assert.equal(s.sendPose({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 }), false, 'AUDIT CHAT D3: a channel session refuses a pose');
  assert.equal(s.sendChat('   '), false, 'nothing to say sends nothing');
  assert.equal(s.sendChat('\u200b'), false);
  assert.equal(s.sendChat('  hi  all '), true);
  assert.deepEqual(ws.sent.at(-1), { t: 'chat', text: 'hi all' }, 'sanitized here as the relay sanitizes it');
  assert.equal(s.stats.chats, 1);
  assert.equal(s.sendChat('two'), true, 'the burst');
  assert.equal(s.sendChat('three'), false, 'AUDIT CHAT A8: the third line in the same second is refused HERE - the relay would drop it without a word');
  assert.equal(s.stats.chats, 2);
  clock += HEARTBEAT_MS - 1; s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 0, 'no ping before HEARTBEAT_MS');
  clock += 1; s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 1, 'a ping at HEARTBEAT_MS');
  s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 1, 'one, not one a frame');
  clock += HEARTBEAT_MS; s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 2, 'and the next at the next');
  assert.equal(ws.sent.filter((m) => m.t === 'pose').length, 0, 'no pose ever left a channel session');
  assert.equal(s.sendChat('three'), true, 'and the third line goes once the gate has refilled');
  assert.equal(s.stats.chats, 3);
  ws.receive({ t: 'chat', id: 'mac-0001', name: 'Mac', text: 'hi all', at: 5 });
  ws.receive({ t: 'chat', id: 'bob-0002', name: '  Bob <b>  ', text: ' yo \u202e', at: 6 });
  assert.deepEqual(heard, [
    { id: 'mac-0001', name: 'Mac', text: 'hi all', at: 5, mine: true },
    { id: 'bob-0002', name: 'Bob <b>', text: 'yo', at: 6, mine: false },
  ], 'the line in: the name and the text checked by the relay\'s own law, mine by id');
  ws.receive({ t: 'chat', name: 'x', text: 'no id' }); ws.receive({ t: 'chat', id: 'bob-0002', text: '   ' }); ws.receive({ t: 'chat', id: 'bob-0002', text: 7 });
  assert.equal(heard.length, 2, 'a line with no id or nothing to say is dropped');
  ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: 'no stamp' });
  assert.equal(heard.at(-1).at, clock, 'no stamp from the relay: the session\'s own clock');
  // the status line, labelled (B5): a drop is 'reconnecting', not 'closed'
  ws.drop(1006);
  assert.equal(s.statusLine('chat'), 'chat: reconnecting');
  assert.equal(s.statusLine(), 'online: reconnecting', 'the default label is the presence session\'s');
  assert.equal(s.sendChat('anyone?'), false, 'no socket: refused, so the field keeps it (B2)');
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, CHAT_REJOIN_MS), false, 'a session on its way back needs no rejoin');
  clock += BACKOFF_MIN_MS; s.tick();
  assert.equal(sockets.length, 2, 'the retry opened a second socket');
  sockets[1].open();
  // the goodbye and the way back (B4)
  s.leave();
  assert.equal(s.room, null);
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, CHAT_REJOIN_MS), true, 'left by the page\'s goodbye: rejoined at once');
  assert.equal(sockets.length, 3); assert.equal(s.room, CHAT_WORLD_ROOM);
  sockets[2].open();
  // a terminal close and the way back (A6/B6)
  sockets[2].drop(1008);
  assert.equal(s.terminal, true); assert.equal(s.terminalAt, clock);
  for (let i = 0; i < 20; i++) { clock += 1000; s.tick(); }
  assert.equal(sockets.length, 3, 'terminal: no retry of its own');
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, CHAT_REJOIN_MS), false, 'not before CHAT_REJOIN_MS has passed');
  clock = s.terminalAt + CHAT_REJOIN_MS;
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, CHAT_REJOIN_MS), true, 'and then once');
  assert.equal(sockets.length, 4); assert.equal(s.terminal, false);
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, CHAT_REJOIN_MS), false, 'a session on its way is left alone');
  // a presence session is what it was
  const p = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now });
  assert.equal(p.presence, true);
  p.join('town:m9', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 });
  const pw = sockets[4]; pw.open();
  assert.deepEqual(pw.sent[0].pose, { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 });
  assert.equal(p.sendPose({ x: 2, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 }), true, 'a presence session sends its pose');
  clock += HEARTBEAT_MS * 2; p.tick();
  assert.equal(pw.sent.filter((m) => m.t === 'ping').length, 0, 'a presence session heartbeats with its pose, not a ping');
});

// ── THE LOG ──────────────────────────────────────────────────────────

test('CHAT1 / AUDIT CHAT: the log - the World tab from CHAT_TABS (one today, each a room the relay whitelists); a line kept on its tab under the cap; unread unless the panel is open ON that tab; select and open read it; the version bumps on what the panel would show; the peek holds then fades on the log\'s own clock; the tag from the id', () => {
  assert.deepEqual(CHAT_TABS, [{ id: 'world', label: 'World', room: 'chat:world' }]);
  assert.ok(CHAT_TABS.every((t) => CHAT_ROOMS.has(t.room)), 'every tab\'s room is a channel the relay runs (AUDIT CHAT A1)');
  assert.equal(CHAT_KEEP, 200); assert.equal(CHAT_FADE_MS, 20000); assert.equal(CHAT_PEEK, 5); assert.equal(CHAT_REJOIN_MS, 30000);
  assert.match(tagOf('p1a2b3c4d5e6'), /^[0-9a-z]{4}$/, 'four base-36 characters');
  assert.equal(tagOf('p1a2b3c4d5e6'), tagOf('p1a2b3c4d5e6'), 'the same id, the same tag');
  assert.notEqual(tagOf('p1a2b3c4d5e6'), tagOf('p1a2b3c4d5e7'), 'another id, another tag');
  assert.equal(tagOf(''), tagOf(null));
  let clock = 10_000;
  const log = new ChatLog({ keep: 3, now: () => clock });
  assert.deepEqual(log.tabs.map((t) => [t.id, t.label, t.room, t.messages.length, t.unread]), [['world', 'World', 'chat:world', 0, 0]]);
  assert.equal(log.active, 'world'); assert.equal(log.open, false);
  const v0 = log.version;
  assert.equal(log.push('nowhere', { id: 'a', name: 'A', text: 'x' }), null, 'no such tab: nothing kept');
  assert.equal(log.push('world', { id: 'a', name: 'A', text: '' }), null, 'nothing to say: nothing kept');
  assert.equal(log.version, v0, 'and nothing to show');
  const l1 = log.push('world', { id: 'a', name: 'A', text: 'one', at: 5 });
  assert.deepEqual(l1, { seq: 1, id: 'a', name: 'A', text: 'one', at: 5, t: 10_000, mine: false });
  assert.equal(log.tab('world').unread, 1, 'closed: unread');
  assert.ok(log.version > v0);
  log.push('world', { id: 'me', name: 'Me', text: 'two', mine: true });
  assert.equal(log.recent().at(-1).at, clock, 'no stamp: the log\'s clock');
  log.push('world', { id: 'a', name: 'A', text: 'three' });
  log.push('world', { id: 'a', name: 'A', text: 'four' });
  assert.deepEqual(log.recent().map((l) => l.text), ['two', 'three', 'four'], 'the cap drops the oldest');
  assert.equal(log.unreadTotal(), 4);
  log.setOpen(true);
  assert.equal(log.tab('world').unread, 0, 'opened on the active tab: read');
  log.push('world', { id: 'a', name: 'A', text: 'five' });
  assert.equal(log.tab('world').unread, 0, 'open and active: read as it arrives');
  log.setOpen(false);
  log.push('world', { id: 'a', name: 'A', text: 'six' });
  assert.equal(log.tab('world').unread, 1);
  assert.equal(log.select('world'), false, 'already the active tab');
  assert.equal(log.select('nowhere'), false);
  log.markRead('world'); assert.equal(log.unreadTotal(), 0);
  // two tabs: unread by tab, select reads only when open
  const two = new ChatLog({ tabs: [...CHAT_TABS, { id: 'party', label: 'Party', room: 'chat:party.x' }], now: () => clock });
  two.push('party', { id: 'a', name: 'A', text: 'psst' });
  assert.deepEqual(two.tabs.map((t) => t.unread), [0, 1]);
  assert.equal(two.select('party'), true); assert.equal(two.active, 'party');
  assert.equal(two.tab('party').unread, 1, 'closed: selecting does not read');
  two.setOpen(true); assert.equal(two.tab('party').unread, 0);
  two.push('world', { id: 'a', name: 'A', text: 'hey' });
  assert.equal(two.tab('world').unread, 1, 'open on another tab: unread');
  two.select('world'); assert.equal(two.tab('world').unread, 0, 'open: selecting reads');
  // the peek
  const p = new ChatLog({ now: () => clock });
  for (let i = 0; i < CHAT_PEEK + 2; i++) p.push('world', { id: 'a', name: 'A', text: `l${i}` });
  assert.equal(p.peek().length, CHAT_PEEK, 'the last CHAT_PEEK');
  assert.deepEqual(p.peek().map((x) => x.alpha), Array(CHAT_PEEK).fill(1), 'fresh: full');
  clock += CHAT_FADE_MS * 0.75; assert.equal(p.peek()[0].alpha, 1, 'held through three quarters');
  clock += CHAT_FADE_MS * 0.125; assert.ok(Math.abs(p.peek()[0].alpha - 0.5) < 1e-9, 'half gone at seven eighths');
  clock += CHAT_FADE_MS * 0.125; assert.equal(p.peek().length, 0, 'gone at the window');
  p.push('world', { id: 'a', name: 'A', text: 'new' });
  assert.equal(p.peek().length, 1, 'a new line stands alone');
  p.setOpen(true);
  assert.equal(p.peek().length, 1, 'the peek is the log\'s to compute; the panel shows none while open');
});

// ── THE PANEL ────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** A window with BOTH phases (AUDIT CHAT D2): the capture pass, then - unless propagation was stopped - the bubble pass,
 *  where the host's own listener (world.js's, `keys.add(e.code)`) lives. */
function fakeWindow() {
  const listeners = [];
  return {
    listeners,
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    key(code, e = {}) {
      const ev = { type: 'keydown', code, target: null, isTrusted: true, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e };
      for (const l of listeners) if (l.t === 'keydown' && l.capture) l.fn(ev);
      if (!ev.stopped) for (const l of listeners) if (l.t === 'keydown' && !l.capture) l.fn(ev);
      return ev;
    },
  };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
/** The default binding's shape: Enter is ActivateCursor (inputActions.js), nothing else is. */
const defaultAction = (e) => (e.code === 'Enter' ? 'ActivateCursor' : null);

test('CHAT1 / AUDIT CHAT: the panel - built once over the document with the sheet injected once; the cursor key (through the registry - the keyboard\'s own, no field, no overlay, the host willing) opens it, frees the pointer and puts the caret in the field; the field\'s keys are stopped before the host\'s bubble listener (the ring never fills) with the reload keys still swallowed, the IME\'s Enter left alone, a held Enter and Tab inert; Enter sends on the active tab, takes the pointer back and closes; a refused line keeps the field and the panel; an empty Enter and Escape close; a press inside the box is stopped and a release is not; a covering window or an open overlay hides and closes it; lines are text, never markup, tagged by id, the list grown not rebuilt; the badge; the touch button; destroy takes the one listener', () => {
  let clock = 50_000;
  const log = new ChatLog({ now: () => clock });
  const doc = fakeDocument(), win = fakeWindow();
  const sent = [];
  let willing = true, accept = true;
  const pointer = [];
  const hostSaw = [];
  win.addEventListener('keydown', (e) => hostSaw.push(e.code));   // the host's shape: bubble, on the window, filling its ring
  const panel = createChatPanel({ log, onSend: (tab, text) => { sent.push([tab, text]); return accept; }, canOpen: () => willing, onOpen: () => pointer.push('free'), onClose: () => pointer.push('lock'), action: defaultAction, doc, win, touch: false });
  const root = doc.body.children[0];
  assert.equal(root.className, 'dfchat'); assert.equal(root.dataset.state, 'closed');
  assert.equal(root.attrs['aria-live'], undefined, 'AUDIT CHAT C9: the root is no live region - the box is the log');
  assert.equal(one(root, 'dfchat-box').attrs.role, 'log');
  assert.equal(doc.getElementById(CHAT_STYLE_ID)?.tagName, 'STYLE', 'the sheet');
  createChatPanel({ log: new ChatLog(), onSend() {}, action: defaultAction, doc, win, touch: false }).destroy();
  assert.equal(find(doc.head, '').filter((n) => n.id === CHAT_STYLE_ID).length, 1, 'injected once');
  assert.deepEqual(find(root, 'dfchat-tab').map((b) => [b.textContent, b.dataset.tab]), [['World', 'world']], 'one tab per row of the log');
  assert.equal(win.listeners.filter((l) => l !== win.listeners[0]).length, 1, 'ONE listener on the window (AUDIT CHAT D5: of any type)');
  assert.equal(win.listeners[1].t, 'keydown'); assert.equal(win.listeners[1].capture, true);
  const input = panel.input;
  assert.equal(input.tagName, 'INPUT'); assert.equal(input.maxLength, CHAT_MAX);
  // the open key: the cursor action through the registry (C4)
  assert.equal(CHAT_OPEN_ACTION, 'ActivateCursor');
  const off = () => false;
  assert.equal(isOpenKey({ code: 'Enter', isTrusted: true, target: { tagName: 'BODY' } }, { overlay: off, action: defaultAction }), true);
  assert.equal(isOpenKey({ code: 'KeyT', isTrusted: true, target: { tagName: 'BODY' } }, { overlay: off, action: (e) => (e.code === 'KeyT' ? 'ActivateCursor' : null) }), true, 'rebound: the chat key moves with the binding');
  assert.equal(isOpenKey({ code: 'Enter', isTrusted: true, target: { tagName: 'BODY' } }, { overlay: off, action: (e) => (e.code === 'KeyT' ? 'ActivateCursor' : null) }), false, 'and Enter is then nothing');
  assert.equal(isOpenKey({ code: 'Enter', isTrusted: true, target: { tagName: 'BODY' } }, { overlay: off }), true, 'the default: the registry\'s own bindings, Enter -> ActivateCursor');
  assert.equal(isOpenKey({ code: 'Enter', isTrusted: false, target: { tagName: 'BODY' } }, { overlay: off, action: defaultAction }), false, 'the touch layer\'s synthesized Enter opens nothing');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'INPUT' } }, { overlay: off, action: defaultAction }), false, 'another field\'s Enter is the field\'s');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'BODY' } }, { overlay: () => true, action: defaultAction }), false, 'under an enhanced overlay: the overlay\'s');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'BODY' }, ctrlKey: true }, { overlay: off, action: defaultAction }), false, 'modified: not the gesture');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'BODY' }, repeat: true }, { overlay: off, action: defaultAction }), false);
  willing = false;
  let e = win.key('Enter', { target: doc.body });
  assert.equal(log.open, false, 'the host unwilling (a window up): nothing opens'); assert.equal(e.stopped, false, 'and the key goes on to the host');
  assert.deepEqual(hostSaw, ['Enter']);
  willing = true;
  e = win.key('Enter', { target: doc.body, isTrusted: false });
  assert.equal(log.open, false, 'an untrusted Enter opens nothing');
  e = win.key('Enter', { target: doc.body });
  assert.equal(log.open, true, 'Enter opens'); assert.equal(e.prevented, true); assert.equal(e.stopped, true, 'and the host never sees it');
  assert.equal(root.dataset.state, 'open'); assert.equal(input.focused, true, 'the caret in the field');
  assert.deepEqual(pointer, ['free'], 'AUDIT CHAT C2: the pointer is freed on open');
  // the field's keys
  hostSaw.length = 0;
  e = win.key('KeyW', { target: input });
  assert.equal(e.stopped, true, 'stopped at the window'); assert.equal(e.prevented, false, 'but the browser types it');
  assert.deepEqual(hostSaw, [], 'the host\'s bubble listener never ran: the ring never fills from a chat line (CG2, AUDIT CHAT D2)');
  e = win.key('F5', { target: input });
  assert.equal(e.prevented, true, 'the reload key stays swallowed in the field'); assert.equal(e.stopped, true);
  e = win.key('Tab', { target: input });
  assert.equal(e.prevented, true, 'AUDIT CHAT C7: Tab stays in the field'); assert.equal(e.stopped, true);
  input.value = 'にほ';
  e = win.key('Enter', { target: input, isComposing: true });
  assert.equal(sent.length, 0, 'AUDIT CHAT C3: the IME\'s Enter commits a candidate, not a line'); assert.equal(e.prevented, false); assert.equal(e.stopped, true); assert.equal(log.open, true);
  e = win.key('Enter', { target: input, keyCode: 229 });
  assert.equal(sent.length, 0, 'and the 229 kind too');
  e = win.key('Enter', { target: input, repeat: true });
  assert.equal(sent.length, 0, 'AUDIT CHAT C6: a held Enter\'s repeat sends nothing'); assert.equal(log.open, true);
  input.value = '  hi all  ';
  accept = false;
  e = win.key('Enter', { target: input });
  assert.deepEqual(sent, [['world', '  hi all  ']], 'Enter offers the line on the active tab');
  assert.equal(input.value, '  hi all  ', 'AUDIT CHAT B2: refused (no socket, over the rate) - the field keeps it'); assert.equal(log.open, true, 'and the panel stays');
  accept = true;
  e = win.key('Enter', { target: input });
  assert.equal(sent.length, 2, 'offered again');
  assert.equal(input.value, '', 'taken: the field cleared');
  assert.equal(log.open, false, 'and the panel closes'); assert.equal(root.dataset.state, 'closed'); assert.equal(input.focused, false);
  assert.deepEqual(pointer, ['free', 'lock'], 'the pointer taken back inside the closing gesture');
  assert.equal(e.prevented, true); assert.equal(e.stopped, true);
  win.key('Enter', { target: doc.body }); assert.equal(log.open, true);
  win.key('Enter', { target: input });
  assert.equal(sent.length, 2, 'an empty Enter sends nothing'); assert.equal(log.open, false, 'and closes');
  win.key('Enter', { target: doc.body }); assert.equal(log.open, true);
  e = win.key('Escape', { target: input });
  assert.equal(log.open, false, 'Escape closes'); assert.equal(e.stopped, true, 'and opens no pause menu');
  win.key('Enter', { target: doc.body });
  e = win.key('Enter', { target: doc.body, isTrusted: true });
  assert.equal(input.focused, true, 'open with the caret wandered: the cursor key brings it back'); assert.equal(e.stopped, true);
  panel.close();
  // the mouse: a press is the panel's, a release is the host's (C5)
  const box = one(root, 'dfchat-box');
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) assert.equal(box.fire(t).stopped, true, `${t} inside the box is the panel's: no swing, no ring`);
  for (const t of ['pointerup', 'mouseup', 'touchend']) assert.equal(box.fire(t).stopped, false, `${t} inside the box reaches the host: a press begun on the canvas must still let go`);
  const openBtn = one(root, 'dfchat-open');
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) assert.equal(openBtn.fire(t).stopped, true, `${t} on the Chat button is the panel's: no swing on a thumb tap (D7)`);
  for (const t of ['pointerup', 'mouseup', 'touchend']) assert.equal(openBtn.fire(t).stopped, false);
  assert.equal(log.open, true, 'the click on the Chat button opened the panel'); panel.close();
  // render: the lines, text only, tagged
  log.push('world', { id: 'bob-0001', name: 'Bob', text: '<img src=x onerror=alert(1)>', at: Date.UTC(2026, 8, 12, 14, 5) });
  log.push('world', { id: 'me-0002', name: 'Me', text: 'hey', mine: true });
  panel.render();
  const peekLines = find(one(root, 'dfchat-peek'), 'dfchat-line');
  assert.equal(peekLines.length, 2, 'closed: the peek');
  assert.equal(one(peekLines[0], 'dfchat-text').textContent, '<img src=x onerror=alert(1)>', 'textContent, never innerHTML');
  assert.equal(one(peekLines[0], 'dfchat-name').textContent, 'Bob');
  assert.equal(one(peekLines[0], 'dfchat-tag').textContent, `#${tagOf('bob-0001')}`, 'AUDIT CHAT A5: the tag from the guarded id - two Bobs read as two people');
  assert.equal(peekLines[1].className, 'dfchat-line mine');
  assert.equal(peekLines[0].style.opacity, '1');
  assert.equal(openBtn.children[0].textContent, '2', 'the badge counts unread');
  clock += CHAT_FADE_MS * 0.875; panel.render();
  assert.equal(peekLines[0].style.opacity, '0.5', 'the fade stepped');
  clock += CHAT_FADE_MS; panel.render();
  assert.equal(find(one(root, 'dfchat-peek'), 'dfchat-line').length, 0, 'faded out: gone');
  panel.open(); panel.render();
  const list = one(root, 'dfchat-list');
  const listLines = find(list, 'dfchat-line');
  assert.equal(listLines.length, 2, 'open: the whole tab');
  assert.equal(one(listLines[0], 'dfchat-time').textContent, clockOf(Date.UTC(2026, 8, 12, 14, 5)), 'stamped with the relay\'s clock, local time');
  assert.match(clockOf(Date.UTC(2026, 8, 12, 14, 5)), /^\d\d:\d\d$/);
  assert.equal(one(root, 'dfchat-badge').textContent, '', 'open on the tab: read');
  // the list grows (C8): the rows that were there stay, a reader's scroll stays
  log.push('world', { id: 'bob-0001', name: 'Bob', text: 'three' });
  list.scrollTop = 0; list.scrollHeight = 400;   // the reader scrolled up
  panel.render();
  const grown = find(list, 'dfchat-line');
  assert.equal(grown.length, 3); assert.equal(grown[0], listLines[0], 'the first row is the same node: grown, not rebuilt'); assert.equal(grown[1], listLines[1]);
  assert.equal(list.scrollTop, 0, 'a reader who scrolled up is not yanked down');
  list.scrollTop = 300;   // at the bottom (400 - 300 - 100 = 0)
  log.push('world', { id: 'bob-0001', name: 'Bob', text: 'four' }); panel.render();
  assert.equal(list.scrollTop, 400, 'a reader at the bottom follows (to the height the fake reports)');
  const capped = new ChatLog({ keep: 2, now: () => clock });
  const cdoc = fakeDocument(), cwin = fakeWindow();
  const cpanel = createChatPanel({ log: capped, onSend() {}, action: defaultAction, doc: cdoc, win: cwin, touch: false });
  capped.push('world', { id: 'a', name: 'A', text: 'one' }); capped.push('world', { id: 'a', name: 'A', text: 'two' });
  cpanel.open(); cpanel.render();
  const clist = one(cdoc.body.children[0], 'dfchat-list');
  const [row1, row2] = find(clist, 'dfchat-line');
  capped.push('world', { id: 'a', name: 'A', text: 'three' }); cpanel.render();
  const rows = find(clist, 'dfchat-line');
  assert.deepEqual(rows.map((r) => one(r, 'dfchat-text').textContent), ['two', 'three'], 'past the cap the oldest row leaves the front');
  assert.equal(rows[0], row2, 'and the row that stayed is the same node'); assert.equal(row1.removed, true);
  cpanel.destroy();
  // a covering window, an open overlay
  panel.render({ hidden: true, status: 'chat: connecting' });
  assert.equal(log.open, false, 'a window over the HUD closes the chat'); assert.equal(root.style.display, 'none', 'and hides it');
  panel.render({ status: 'chat: connecting' });
  assert.equal(root.style.display, ''); assert.equal(one(root, 'dfchat-status').textContent, 'chat: connecting', 'the session\'s state, said');
  panel.render({ status: null }); assert.equal(one(root, 'dfchat-status').textContent, '');
  const unregister = registerOverlay(() => {});
  try {
    assert.equal(overlayOpen(), true);
    panel.open(); panel.render();
    assert.equal(log.open, false, 'AUDIT CHAT C1: an open overlay (the dial, a sheet) closes and hides the chat'); assert.equal(root.style.display, 'none');
    assert.equal(win.key('Enter', { target: doc.body }).stopped, false, 'and its key is the overlay\'s');
  } finally { unregister(); }
  panel.render(); assert.equal(root.style.display, '');
  // the touch layer
  const tdoc = fakeDocument(), twin = fakeWindow();
  const tlog = new ChatLog({ now: () => clock });
  const tsent = [];
  createChatPanel({ log: tlog, onSend: (tab, text) => { tsent.push(text); return true; }, action: defaultAction, doc: tdoc, win: twin, touch: true });
  const troot = tdoc.body.children[0];
  assert.equal(troot.className, 'dfchat touch');
  one(troot, 'dfchat-open').fire('click');
  assert.equal(tlog.open, true, 'the button opens');
  const tinput = one(troot, 'dfchat-input'); tinput.value = 'thumbs';
  const se = one(troot, 'dfchat-form').fire('submit');
  assert.equal(se.prevented, true, 'AUDIT CHAT D6: the form never navigates - Send is a chat line, not a page load');
  assert.deepEqual(tsent, ['thumbs']); assert.equal(tlog.open, true, 'Send keeps a touch panel open: the next line is likely');
  one(troot, 'dfchat-close').fire('click'); assert.equal(tlog.open, false);
  // destroy
  panel.destroy();
  assert.equal(win.listeners.length, 1, 'every listener of the panel\'s goes with it (D5) - the host\'s own stays');
  assert.equal(root.removed, true);
});

// ── THE HOST ─────────────────────────────────────────────────────────

test('CHAT1 / AUDIT CHAT: the host by source - world.js starts the chat with the presence session on the enhanced skin with a document and a relay the law admits, one channel session per tab under the same identity, a line to its tab, a typed line down the active tab with its answer, the panel unwilling under a window, the pointer freed and taken back; the frame rejoins and ticks every channel and renders with the session\'s own line before the dead return; the host\'s keydown is bubble-phase; the page\'s hide leaves every channel and keeps the panel; the dial is on the overlay stack', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ ChatLog, CHAT_REJOIN_MS \} from '\.\.\/net\/chat\.js';/);
  assert.match(w, /import \{ createChatPanel \} from '\.\.\/ui\/chatPanel\.js';/);
  assert.match(w, /import \{ requestLook, releaseLook, makeLookGate, bindCursorToggle \} from '\.\.\/player\/pointerLock\.js';/);
  assert.match(w, /if \(enhanced && typeof document !== 'undefined'\) chatStart\(\);/, 'the enhanced skin\'s, with a document (node has none)');
  assert.match(w, /const chatStart = \(\) => \{\s*if \(!online\.url\) return;/, 'AUDIT CHAT A9/B1: a relay the law refused is no relay for the chat either');
  assert.match(w, /for \(const tab of chatLog\.tabs\) \{\s*const link = new OnlineSession\(\{ url: online\.url, name: online\.name, look: online\.look, id: online\.id, secret: online\.secret, presence: false \}\);\s*link\.onChat = \(line\) => chatLog\.push\(tab\.id, line\);\s*link\.join\(tab\.room\);\s*chatLinks\.set\(tab\.id, link\);/, 'a channel session per tab, the presence session\'s identity, a line to its tab');
  assert.match(w, /onSend: \(tabId, text\) => chatLinks\.get\(tabId\)\?\.sendChat\(text\) \?\? false,/, 'a typed line down its tab\'s session, and the answer back (B2)');
  assert.match(w, /canOpen: \(\) => !gamePaused\(\) && !\(townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\)\)/, 'no chat under a window');
  assert.match(w, /onOpen: \(\) => releaseLook\(\),/, 'AUDIT CHAT C2: the pointer freed on open');
  assert.match(w, /onClose: \(\) => \{ if \(!gamePaused\(\)\) requestLook\(canvas\); \},/, 'and taken back inside the closing gesture');
  assert.match(w, /for \(const \[tabId, link\] of chatLinks\) \{\s*link\.rejoin\(chatLog\.tab\(tabId\)\.room, CHAT_REJOIN_MS\);[^\n]*\n\s*link\.tick\(\);/, 'every channel rejoined when it must be, and ticked');
  assert.match(w, /chatPanel\.render\(\{\s*hidden: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\),/, 'hidden under a window');
  assert.match(w, /status: link\?\.statusLine\('chat'\) \?\? null,/, 'the session\'s own line, labelled (B5)');
  assert.doesNotMatch(w, /chat: \$\{link\.error/, 'and no remake of it');
  assert.match(w, /const onlineFrame = \(now, dt\) => \{\s*chatFrame\(\);(?:[^\n]*\n)(?:\s*\/\/[^\n]*\n)*\s*if \(townTalk\.overlay instanceof DeathScreen\)/, 'the chat frame runs before the dead return: the channels keep their heartbeat and reconnect while the death screen is up');
  assert.match(w, /'pagehide', \(\) => \{ worldPublish\(performance\.now\(\), true\); online\?\.leave\(\); for \(const link of chatLinks\?\.values\(\) \?\? \[\]\) link\.leave\(\); peerBodies\?\.destroy\(\);/, 'the goodbye leaves every channel');
  assert.doesNotMatch(w, /chatPanel\?\.destroy\(\)/, 'AUDIT CHAT B4: and keeps the panel - a page restored from the cache gets its chat back');
  // CG2 rests on the host listening in the BUBBLE phase (AUDIT CHAT D2): a capture listener beside the panel's would fill the ring
  assert.match(w, /\n  addEventListener\('keydown', \(e\) => \{/, 'the host\'s window keydown listener');
  assert.doesNotMatch(w, /addEventListener\('keydown', \(e\) => \{[\s\S]*?\n  \}, (true|\{[^}]*capture)/, 'the host listens in the bubble phase');
  const panel = rd('src/ui/chatPanel.js');
  assert.doesNotMatch(panel, /innerHTML/, 'a chat line is never markup');
  assert.match(panel, /win\.addEventListener\('keydown', onKey, true\)/, 'the capture listener');
  assert.equal((panel.match(/win\.addEventListener\(/g) ?? []).length, 1, 'and no other on the window (D5)');
  assert.match(panel, /e\.isTrusted !== false/, 'the touch layer\'s synthesized Enter opens nothing');
  assert.match(panel, /if \(e\.isComposing \|\| e\.keyCode === 229\) \{ e\.stopPropagation\(\); return; \}/, 'the IME\'s Enter (C3)');
  assert.match(panel, /export const actionOfKey = \(e\) => actionForCode\(bindings\(\), e\.code\);/, 'the open key through the registry (C4)');
  const online = rd('src/net/online.js');
  assert.match(online, /if \(!this\.presence && this\.status === 'open' && now - this\._lastSentAt >= HEARTBEAT_MS && this\._send\(\{ t: 'ping' \}\)\) this\._lastSentAt = now;/, 'the channel heartbeat is a ping the runtime answers in its sleep');
  const room = rd('server/src/index.js');
  assert.match(room, /if \(m\.t === 'pose' \|\| m\.t === 'ping'\) \{[\s\S]*?const gate = poseGate\(a\.bucket, Date\.now\(\)\);[\s\S]*?if \(chat\) return;/, 'AUDIT CHAT A3: a channel\'s pose is gated before it is declined');
  assert.match(room, /if \(other === ws \|\| chat \|\| inRange\(a\.key \?\? '', a\.pose, b\.pose\)\) this\._send\(other, out\);/, 'the fan: the sender, a channel\'s everyone, a place\'s range');
  assert.match(room, /const room = tokenGate\(this\._roomChat, now, CHAT_ROOM_HZ_MAX\);/, 'the room\'s own budget (A2)');
  const dial = rd('src/ui/pixelDial.js');
  assert.match(dial, /unregister = registerOverlay\(close\);/, 'AUDIT CHAT C1: the dial is on the overlay stack');
  assert.match(dial, /function unmount\(\) \{[\s\S]*?unregister\?\.\(\); unregister = null;/, 'and leaves it when it goes');
});
