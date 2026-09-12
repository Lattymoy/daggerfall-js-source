// CHAT1 (2026-09-12, Mac: "I want to add a new UI element. The live chat
// in enhanced format. Players will be able to type and chat live with
// other players. Currently I just want one world tab with the ability
// to add more tabs at a later time"). THE CHAT EXECUTES: the wire's
// chat law at both ends (the line sanitized the same way the relay
// sanitizes it, the frame after hello only, the gate at CHAT_HZ_MAX);
// the Room as a CHANNEL over fake sockets (no roster, no join, no
// leave, no look, no pose, every line to everyone - the sender
// included, the secret still guarding the id, the hello gate off, the
// deeper socket cap) and a line in a PLACE room reaching as far as a
// pose, the chat gate with its own strikes; the channel session over a
// fake socket (the hello with no pose, the ping heartbeat, sendChat,
// onChat with `mine`); the log (the World tab from CHAT_TABS, the cap,
// unread by open-and-active, the peek's fade); the panel over a fake
// document and window (Enter opens, the field's keys are stopped at
// the window so the ring never fills, F5 stays swallowed, Enter sends
// and closes, Escape closes, an untrusted Enter opens nothing, the
// mouse inside the box is stopped, a covering window closes and hides
// it, lines are text and never markup); the host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAT_MAX, CHAT_HZ_MAX, CHAT_STRIKES_MAX, CHAT_SOCKETS_MAX, CHAT_WORLD_ROOM, SOCKETS_MAX, HELLO_HZ_MAX, PIXEL_UNITS,
  sanitizeChat, isChatRoom, parseClient, chatGate,
} from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { Room } from '../server/src/index.js';
import { OnlineSession, HEARTBEAT_MS } from '../src/net/online.js';
import { ChatLog, CHAT_TABS, CHAT_KEEP, CHAT_FADE_MS, CHAT_PEEK } from '../src/net/chat.js';
import { createChatPanel, isOpenKey, CHAT_STYLE_ID, clockOf } from '../src/ui/chatPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE WIRE ─────────────────────────────────────────────────────────

test('CHAT1: the wire - the constants once and literally, one home at both ends; a line sanitized (controls, format and bidi gone, whitespace one, the bound never inside a pair); the frame after hello only; the gate at CHAT_HZ_MAX', () => {
  assert.equal(CHAT_MAX, 240); assert.equal(CHAT_HZ_MAX, 2); assert.equal(CHAT_STRIKES_MAX, 20); assert.equal(CHAT_SOCKETS_MAX, 2048);
  assert.equal(CHAT_WORLD_ROOM, 'chat:world');
  for (const k of ['sanitizeChat', 'isChatRoom', 'chatGate']) assert.equal(relay[k], { sanitizeChat, isChatRoom, chatGate }[k], `${k}: the same function object at both ends`);
  assert.equal(relay.CHAT_MAX, CHAT_MAX);
  // the sanitizer
  assert.equal(sanitizeChat('  hello   there  '), 'hello there', 'whitespace collapsed and trimmed');
  assert.equal(sanitizeChat('a\u202eb\u200bc\u2066d\ufeffe'), 'abcde', 'bidi overrides, zero widths, isolates and the BOM are gone');
  assert.equal(sanitizeChat('x\u0000y\u001fz\u007fw\u009fv'), 'xyzwv', 'C0, DEL and C1 are gone');
  assert.equal(sanitizeChat('\t\n  \r'), '', 'nothing to say is the empty string');
  assert.equal(sanitizeChat(null), ''); assert.equal(sanitizeChat(42), '42');
  assert.equal(sanitizeChat('héllo wörld — ok'), 'héllo wörld — ok', 'a person\'s own letters stay');
  assert.equal(sanitizeChat('x'.repeat(CHAT_MAX + 50)).length, CHAT_MAX, 'bounded');
  const paired = sanitizeChat('a'.repeat(CHAT_MAX - 1) + '\u{1F600}');
  assert.equal(paired.length, CHAT_MAX - 1, 'the bound fell inside a surrogate pair: the pair goes, not half of it');
  assert.equal(sanitizeChat('<b>hi</b>'), '<b>hi</b>', 'markup is text here - the panel writes textContent, never innerHTML');
  // the rooms
  assert.equal(isChatRoom('chat:world'), true); assert.equal(isChatRoom('chat:party.abc'), true);
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

/** The relay test's fake Room: a state with sockets and storage, a socket with an attachment. */
function fakeRoom(key) {
  const sockets = [];
  const store = new Map();
  const state = {
    getWebSockets: () => sockets.slice(),
    acceptWebSocket: (ws) => sockets.push(ws),
    storage: {
      async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)])) : store.get(k); },
      async put(k, v) { store.set(k, v); }, async delete(k) { for (const x of Array.isArray(k) ? k : [k]) store.delete(x); }, async deleteAll() { store.clear(); },
    },
  };
  const room = new Room(state);
  const connect = () => {
    const ws = { sent: [], closed: null, att: { key, id: null, name: null, pose: null, bucket: null, drops: 0 },
      send(s) { if (this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); }, close(code, reason) { this.closed = { code, reason }; },
      serializeAttachment(a) { this.att = JSON.parse(JSON.stringify(a)); }, deserializeAttachment() { return this.att; } };
    state.acceptWebSocket(ws);
    return ws;
  };
  const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
  const hello = (ws, id, pose = null, secret = 'secret-of-' + id) => room.webSocketMessage(ws, JSON.stringify({ t: 'hello', id, secret, name: id, look, pose }));
  const chat = (ws, text) => room.webSocketMessage(ws, JSON.stringify({ t: 'chat', text }));
  const pose = (ws, p) => room.webSocketMessage(ws, JSON.stringify({ t: 'pose', p }));
  const drop = (ws) => { sockets.splice(sockets.indexOf(ws), 1); return room.webSocketClose(ws, 1005, ''); };
  return { room, state, store, sockets, connect, hello, chat, pose, drop };
}
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const chats = (ws) => ws.sent.filter((m) => m.t === 'chat');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);

test('CHAT1: the Room as a CHANNEL - a hello keeps the secret and no look, is told an empty roster and announced to no one; a pose reaches no one; a line reaches everyone, the sender included, shaped {t,id,name,text,at}; the leave says nothing; the secret still guards the id; the hello gate is off; the socket cap is CHAT_SOCKETS_MAX', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001'); await r.hello(b, 'bbbb-0002', at(3, 3));
  assert.deepEqual(a.sent, [{ t: 'welcome', id: 'aaaa-0001', peers: [] }]);
  assert.deepEqual(b.sent, [{ t: 'welcome', id: 'bbbb-0002', peers: [] }], 'a channel has no roster: b is told no one though a is there');
  assert.equal(ofType(a, 'join').length, 0, 'and a hears no join');
  assert.equal(r.store.has('secret:aaaa-0001'), true, 'the secret is kept');
  assert.equal(r.store.has('look:aaaa-0001'), false, 'the look is not: nobody is drawn from a channel');
  assert.equal(b.att.pose, null, 'a pose in the hello is not kept either');
  await r.pose(a, at(1, 1));
  assert.equal(ofType(b, 'pose').length, 0, 'a pose in a channel reaches no one');
  assert.equal(a.att.pose, null, 'and is kept by no one');
  assert.equal(a.closed, null, 'and is no offence');
  await r.chat(a, '  hello   world ');
  const line = chats(a)[0];
  assert.ok(line, 'the sender hears its own line back: the receipt');
  assert.equal(line.id, 'aaaa-0001'); assert.equal(line.name, 'aaaa-0001'); assert.equal(line.text, 'hello world', 'sanitized by the relay');
  assert.equal(typeof line.at, 'number', 'stamped by the relay\'s clock');
  assert.deepEqual(chats(b), [line], 'b hears the same line');
  assert.equal(chats(c).length, 0, 'c never said hello: it hears nothing');
  await r.hello(c, 'aaaa-0001', null, 'not-the-secret-of-a');
  assert.equal(c.closed?.code, 1008, 'the secret guards an id in a channel as in a place');
  assert.deepEqual(c.sent.at(-1), { t: 'error', m: 'id taken' });
  await r.drop(b);
  assert.equal(ofType(a, 'leave').length, 0, 'a channel announced no join, so it says no leave');
  assert.equal(r.store.has('secret:bbbb-0002'), false, 'the secret goes with the socket');
  // the hello gate is off: a burst past HELLO_HZ_MAX in one instant is all welcomed
  const burst = fakeRoom(CHAT_WORLD_ROOM);
  const many = Array.from({ length: HELLO_HZ_MAX * 3 }, (_, i) => burst.connect());
  for (let i = 0; i < many.length; i++) await burst.hello(many[i], `peer-${String(i).padStart(4, '0')}`);
  assert.ok(many.every((ws) => ws.sent[0]?.t === 'welcome' && !ws.closed), 'no hello refused busy: a channel\'s hello costs no one anything');
  assert.equal(burst.store.has('hellos'), false, 'and no hello bucket is kept for it');
  // the cap: deeper than a place's
  let pairs = 0;
  const hadPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { pairs++; this[0] = {}; this[1] = { serializeAttachment() {} }; } };
  try {
    const full = fakeRoom(CHAT_WORLD_ROOM); for (let i = 0; i < CHAT_SOCKETS_MAX; i++) full.connect();
    assert.equal((await full.room.fetch(new Request('https://relay.test/room/chat:world', { headers: { Upgrade: 'websocket' } }))).status, 503, 'CHAT_SOCKETS_MAX: room full');
    assert.equal(pairs, 0);
    const deep = fakeRoom(CHAT_WORLD_ROOM); for (let i = 0; i < SOCKETS_MAX; i++) deep.connect();
    const r2 = await deep.room.fetch(new Request('https://relay.test/room/chat:world', { headers: { Upgrade: 'websocket' } })).then((x) => x.status, (e) => e);
    assert.notEqual(r2, 503, 'SOCKETS_MAX sockets do not fill a channel');
    assert.equal(pairs, 1, 'the upgrade went on to the pair (the 101 itself is the runtime\'s to mint, not node\'s)');
    const place = fakeRoom('town:m9'); for (let i = 0; i < SOCKETS_MAX; i++) place.connect();
    assert.equal((await place.room.fetch(new Request('https://relay.test/room/town:m9', { headers: { Upgrade: 'websocket' } }))).status, 503, 'a place still fills at SOCKETS_MAX');
  } finally { globalThis.WebSocketPair = hadPair; }
});

test('CHAT1: the Room - a line in a PLACE room reaches as far as a pose (the sender always); the chat gate is CHAT_HZ_MAX with its own bucket and strikes - an over-rate line is dropped, never queued, and past CHAT_STRIKES_MAX in a row the socket is closed; a talker\'s poses are not counted against it', async () => {
  const r = fakeRoom('world:0,0');
  const a = r.connect(), near = r.connect(), far = r.connect(), mute = r.connect();
  await r.hello(a, 'aaaa-0001', at(2, 2)); await r.hello(near, 'near-0002', at(4, 4)); await r.hello(far, 'farr-0003', at(9, 9)); await r.hello(mute, 'mute-0004');
  await r.chat(a, 'over here');
  assert.equal(chats(a).length, 1, 'the sender'); assert.equal(chats(near).length, 1, 'within RANGE_PIXELS');
  assert.equal(chats(far).length, 0, 'past it: not heard'); assert.equal(chats(mute).length, 0, 'no pose: no range to measure, not heard');
  // the gate
  const fresh = fakeRoom(CHAT_WORLD_ROOM);
  const t = fresh.connect(), l = fresh.connect();
  await fresh.hello(t, 'talk-0001'); await fresh.hello(l, 'list-0002');
  for (let i = 0; i < CHAT_HZ_MAX + 3; i++) await fresh.chat(t, `line ${i}`);
  assert.equal(chats(l).length, CHAT_HZ_MAX, 'the burst is relayed, the rest dropped');
  assert.equal(t.att.cdrops, 3, 'three strikes'); assert.equal(t.closed, null, 'not yet an offence');
  for (let i = 0; i < 20; i++) await fresh.pose(t, at(1, 1));
  assert.equal(t.att.cdrops, 3, 'poses are another bucket: a talker is not a mover');
  for (let i = 0; i < CHAT_STRIKES_MAX; i++) await fresh.chat(t, 'spam');
  assert.equal(t.closed?.code, 1008, 'past CHAT_STRIKES_MAX dropped in a row the socket is closed');
  assert.deepEqual(t.sent.at(-1), { t: 'error', m: 'too many lines' });
  assert.equal(chats(l).length, CHAT_HZ_MAX, 'and none of the spam reached anyone');
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
  }
  return { FakeWS, sockets };
}

test('CHAT1: the session as a CHANNEL (presence: false) - the hello carries no pose, no pose ever goes out, a ping every HEARTBEAT_MS keeps the socket, sendChat sanitizes as the relay does and sends nothing for nothing, a line in reaches onChat with mine; a presence session is unchanged (the pose in the hello, no pings)', () => {
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
  assert.equal(s.sendChat('   '), false, 'nothing to say sends nothing');
  assert.equal(s.sendChat('\u200b'), false);
  assert.equal(s.sendChat('  hi  all '), true);
  assert.deepEqual(ws.sent.at(-1), { t: 'chat', text: 'hi all' }, 'sanitized here as the relay sanitizes it');
  assert.equal(s.stats.chats, 1);
  clock += HEARTBEAT_MS - 1; s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 0, 'no ping before HEARTBEAT_MS');
  clock += 1; s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 1, 'a ping at HEARTBEAT_MS');
  s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 1, 'one, not one a frame');
  clock += HEARTBEAT_MS; s.tick();
  assert.equal(ws.sent.filter((m) => m.t === 'ping').length, 2, 'and the next at the next');
  assert.equal(ws.sent.filter((m) => m.t === 'pose').length, 0, 'no pose ever left a channel session');
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
  // a presence session is what it was
  const p = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now });
  assert.equal(p.presence, true);
  p.join('town:m9', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 });
  const pw = sockets[1]; pw.open();
  assert.deepEqual(pw.sent[0].pose, { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 1 });
  clock += HEARTBEAT_MS * 2; p.tick();
  assert.equal(pw.sent.filter((m) => m.t === 'ping').length, 0, 'a presence session heartbeats with its pose, not a ping');
});

// ── THE LOG ──────────────────────────────────────────────────────────

test('CHAT1: the log - the World tab from CHAT_TABS (one today, each a room); a line kept on its tab under the cap; unread unless the panel is open ON that tab; select and open read it; the version bumps on what the panel would show; the peek holds then fades on the log\'s own clock', () => {
  assert.deepEqual(CHAT_TABS, [{ id: 'world', label: 'World', room: 'chat:world' }]);
  assert.equal(CHAT_KEEP, 200); assert.equal(CHAT_FADE_MS, 20000); assert.equal(CHAT_PEEK, 5);
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
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100,
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
function fakeWindow() {
  const listeners = [];
  return {
    listeners,
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    key(code, e = {}) {
      const ev = { type: 'keydown', code, target: null, isTrusted: true, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e };
      for (const l of listeners) if (l.t === 'keydown' && l.capture) l.fn(ev);
      return ev;
    },
  };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const textOf = (n) => n.textContent + n.children.map(textOf).join('');

test('CHAT1: the panel - built once over the document with the sheet injected once; Enter (the keyboard\'s own, no field, no overlay, the host willing) opens it and puts the caret in the field; the field\'s keys are stopped at the window (the ring never fills) with the browser\'s reload keys still swallowed; Enter sends the line on the active tab and closes; an empty Enter and Escape close; the mouse inside the box is stopped; a covering window hides and closes it; lines are text, never markup; the badge counts unread; the touch layer gets a button; destroy takes the listener', () => {
  let clock = 50_000;
  const log = new ChatLog({ now: () => clock });
  const doc = fakeDocument(), win = fakeWindow();
  const sent = [];
  let willing = true;
  const panel = createChatPanel({ log, onSend: (tab, text) => sent.push([tab, text]), canOpen: () => willing, doc, win, touch: false });
  const root = doc.body.children[0];
  assert.equal(root.className, 'dfchat'); assert.equal(root.dataset.state, 'closed');
  assert.equal(doc.getElementById(CHAT_STYLE_ID)?.tagName, 'STYLE', 'the sheet');
  createChatPanel({ log: new ChatLog(), onSend() {}, doc, win, touch: false }).destroy();
  assert.equal(find(doc.head, '').filter((n) => n.id === CHAT_STYLE_ID).length, 1, 'injected once');
  assert.deepEqual(find(root, 'dfchat-tab').map((b) => [b.textContent, b.dataset.tab]), [['World', 'world']], 'one tab per row of the log');
  assert.equal(win.listeners.filter((l) => l.t === 'keydown' && l.capture).length, 1, 'one capture listener on the window');
  const input = panel.input;
  assert.equal(input.tagName, 'INPUT'); assert.equal(input.maxLength, CHAT_MAX);
  // the open key
  assert.equal(isOpenKey({ code: 'Enter', isTrusted: true, target: { tagName: 'BODY' } }, { overlay: () => false }), true);
  assert.equal(isOpenKey({ code: 'Enter', isTrusted: false, target: { tagName: 'BODY' } }, { overlay: () => false }), false, 'the touch layer\'s synthesized Enter opens nothing');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'INPUT' } }, { overlay: () => false }), false, 'another field\'s Enter is the field\'s');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'BODY' } }, { overlay: () => true }), false, 'under an enhanced overlay: the overlay\'s');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'BODY' }, ctrlKey: true }, { overlay: () => false }), false, 'modified: not the gesture');
  assert.equal(isOpenKey({ code: 'Enter', target: { tagName: 'BODY' }, repeat: true }, { overlay: () => false }), false);
  assert.equal(isOpenKey({ code: 'KeyT', target: { tagName: 'BODY' } }, { overlay: () => false }), false);
  willing = false;
  let e = win.key('Enter', { target: doc.body });
  assert.equal(log.open, false, 'the host unwilling (a window up): nothing opens'); assert.equal(e.stopped, false, 'and the key goes on to the host');
  willing = true;
  e = win.key('Enter', { target: doc.body, isTrusted: false });
  assert.equal(log.open, false, 'an untrusted Enter opens nothing');
  e = win.key('Enter', { target: doc.body });
  assert.equal(log.open, true, 'Enter opens'); assert.equal(e.prevented, true); assert.equal(e.stopped, true, 'and the host never sees it');
  assert.equal(root.dataset.state, 'open'); assert.equal(input.focused, true, 'the caret in the field');
  // the field's keys
  e = win.key('KeyW', { target: input });
  assert.equal(e.stopped, true, 'stopped at the window: the ring never fills from a chat line');
  assert.equal(e.prevented, false, 'but the browser types it');
  e = win.key('F5', { target: input });
  assert.equal(e.prevented, true, 'the reload key stays swallowed in the field'); assert.equal(e.stopped, true);
  input.value = '  hi all  ';
  e = win.key('Enter', { target: input });
  assert.deepEqual(sent, [['world', '  hi all  ']], 'Enter sends the line on the active tab (the session sanitizes)');
  assert.equal(input.value, '', 'the field cleared');
  assert.equal(log.open, false, 'and the panel closes'); assert.equal(root.dataset.state, 'closed'); assert.equal(input.focused, false);
  assert.equal(e.prevented, true); assert.equal(e.stopped, true);
  win.key('Enter', { target: doc.body }); assert.equal(log.open, true);
  win.key('Enter', { target: input });
  assert.equal(sent.length, 1, 'an empty Enter sends nothing'); assert.equal(log.open, false, 'and closes');
  win.key('Enter', { target: doc.body }); assert.equal(log.open, true);
  e = win.key('Escape', { target: input });
  assert.equal(log.open, false, 'Escape closes'); assert.equal(e.stopped, true, 'and opens no pause menu');
  win.key('Enter', { target: doc.body });
  e = win.key('Enter', { target: doc.body, isTrusted: true });
  assert.equal(input.focused, true, 'open with the caret wandered: Enter brings it back'); assert.equal(e.stopped, true);
  panel.close();
  // the mouse
  const box = one(root, 'dfchat-box');
  for (const t of ['mousedown', 'pointerdown', 'click', 'touchstart', 'wheel']) assert.equal(box.fire(t).stopped, true, `${t} inside the box is the panel's: no swing, no ring`);
  // render: the lines, text only
  log.push('world', { id: 'bob', name: 'Bob', text: '<img src=x onerror=alert(1)>', at: Date.UTC(2026, 8, 12, 14, 5) });
  log.push('world', { id: 'me', name: 'Me', text: 'hey', mine: true });
  panel.render();
  const peekLines = find(one(root, 'dfchat-peek'), 'dfchat-line');
  assert.equal(peekLines.length, 2, 'closed: the peek');
  assert.equal(one(peekLines[0], 'dfchat-text').textContent, '<img src=x onerror=alert(1)>', 'textContent, never innerHTML');
  assert.equal(one(peekLines[0], 'dfchat-name').textContent, 'Bob');
  assert.equal(peekLines[1].className, 'dfchat-line mine');
  assert.equal(peekLines[0].style.opacity, '1');
  assert.equal(one(root, 'dfchat-open').children[0].textContent, '2', 'the badge counts unread');
  clock += CHAT_FADE_MS * 0.875; panel.render();
  assert.equal(peekLines[0].style.opacity, '0.5', 'the fade stepped');
  clock += CHAT_FADE_MS; panel.render();
  assert.equal(find(one(root, 'dfchat-peek'), 'dfchat-line').length, 0, 'faded out: gone');
  panel.open(); panel.render();
  const listLines = find(one(root, 'dfchat-list'), 'dfchat-line');
  assert.equal(listLines.length, 2, 'open: the whole tab');
  assert.equal(one(listLines[0], 'dfchat-time').textContent, clockOf(Date.UTC(2026, 8, 12, 14, 5)), 'stamped with the relay\'s clock, local time');
  assert.match(clockOf(Date.UTC(2026, 8, 12, 14, 5)), /^\d\d:\d\d$/);
  assert.equal(one(root, 'dfchat-badge').textContent, '', 'open on the tab: read');
  // a covering window
  panel.render({ hidden: true, status: 'chat: connecting' });
  assert.equal(log.open, false, 'a window over the HUD closes the chat'); assert.equal(root.style.display, 'none', 'and hides it');
  panel.render({ status: 'chat: connecting' });
  assert.equal(root.style.display, ''); assert.equal(one(root, 'dfchat-status').textContent, 'chat: connecting', 'the session\'s state, said');
  panel.render({ status: null }); assert.equal(one(root, 'dfchat-status').textContent, '');
  // the touch layer
  const tdoc = fakeDocument(), twin = fakeWindow();
  const tlog = new ChatLog({ now: () => clock });
  const tsent = [];
  createChatPanel({ log: tlog, onSend: (tab, text) => tsent.push(text), doc: tdoc, win: twin, touch: true });
  const troot = tdoc.body.children[0];
  assert.equal(troot.className, 'dfchat touch');
  one(troot, 'dfchat-open').fire('click');
  assert.equal(tlog.open, true, 'the button opens');
  const tinput = one(troot, 'dfchat-input'); tinput.value = 'thumbs';
  one(troot, 'dfchat-form').fire('submit');
  assert.deepEqual(tsent, ['thumbs']); assert.equal(tlog.open, true, 'Send keeps a touch panel open: the next line is likely');
  one(troot, 'dfchat-close').fire('click'); assert.equal(tlog.open, false);
  // destroy
  panel.destroy();
  assert.equal(win.listeners.filter((l) => l.t === 'keydown').length, 0, 'the listener goes with the panel');
  assert.equal(root.removed, true);
});

// ── THE HOST ─────────────────────────────────────────────────────────

test('CHAT1: the host by source - world.js starts the chat with the presence session on the enhanced skin with a document, one channel session per tab under the same identity, a line to its tab, a typed line down the active tab, the panel unwilling under a window; the frame ticks every channel and renders before the dead return; the page\'s hide leaves every channel', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ ChatLog \} from '\.\.\/net\/chat\.js';/);
  assert.match(w, /import \{ createChatPanel \} from '\.\.\/ui\/chatPanel\.js';/);
  assert.match(w, /if \(enhanced && typeof document !== 'undefined'\) chatStart\(\);/, 'the enhanced skin\'s, with a document (node has none)');
  assert.match(w, /for \(const tab of chatLog\.tabs\) \{\s*const link = new OnlineSession\(\{ url: online\.url, name: online\.name, look: online\.look, id: online\.id, secret: online\.secret, presence: false \}\);\s*link\.onChat = \(line\) => chatLog\.push\(tab\.id, line\);\s*link\.join\(tab\.room\);\s*chatLinks\.set\(tab\.id, link\);/, 'a channel session per tab, the presence session\'s identity, a line to its tab');
  assert.match(w, /onSend: \(tabId, text\) => chatLinks\.get\(tabId\)\?\.sendChat\(text\)/, 'a typed line down its tab\'s session');
  assert.match(w, /canOpen: \(\) => !gamePaused\(\) && !\(townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\)\)/, 'no chat under a window');
  assert.match(w, /for \(const link of chatLinks\.values\(\)\) link\.tick\(\);/, 'every channel ticked');
  assert.match(w, /chatPanel\.render\(\{\s*hidden: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\),/, 'hidden under a window');
  assert.match(w, /status: link && link\.status !== 'open' \? `chat: \$\{link\.error \?\? link\.status\}` : null/, 'the state said');
  assert.match(w, /const onlineFrame = \(now, dt\) => \{\s*chatFrame\(\);(?:\s*\/\/[^\n]*\n)+\s*if \(townTalk\.overlay instanceof DeathScreen\)/, 'the chat frame runs before the dead return: the dead may still talk');
  assert.match(w, /'pagehide', \(\) => \{ online\?\.leave\(\); for \(const link of chatLinks\?\.values\(\) \?\? \[\]\) link\.leave\(\); chatPanel\?\.destroy\(\);/, 'the goodbye leaves every channel');
  const panel = rd('src/ui/chatPanel.js');
  assert.doesNotMatch(panel, /innerHTML/, 'a chat line is never markup');
  assert.match(panel, /win\.addEventListener\('keydown', onKey, true\)/, 'the capture listener');
  assert.match(panel, /e\.isTrusted !== false/, 'the touch layer\'s synthesized Enter opens nothing');
  const online = rd('src/net/online.js');
  assert.match(online, /if \(!this\.presence && this\.status === 'open' && now - this\._lastSentAt >= HEARTBEAT_MS && this\._send\(\{ t: 'ping' \}\)\) this\._lastSentAt = now;/, 'the channel heartbeat is a ping the runtime answers in its sleep');
  const room = rd('server/src/index.js');
  assert.match(room, /if \(isChatRoom\(a\.key\)\) return;\s*\/\/ a channel is no place/, 'a pose in a channel');
  assert.match(room, /if \(other === ws \|\| chat \|\| inRange\(a\.key \?\? '', a\.pose, b\.pose\)\) this\._send\(other, out\);/, 'the fan: the sender, a channel\'s everyone, a place\'s range');
});
