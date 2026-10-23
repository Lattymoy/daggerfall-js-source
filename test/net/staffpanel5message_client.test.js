// STAFF-PANEL5-MESSAGE (2026-10-22, mob, 04:14Z: a message in the middle of one player's screen; design doc "DFO Staff
// Panel: design", Message on screen) - THE RELAY'S AND THE GAME'S HALVES: the order of its own kind ('smsg'), the hub's
// nudge to one account's own sockets and its count back through the door (server/src/staffMessage.js), the hello's `sm`
// (a build that shows the box), the session's frame arm, the box (ui/staffMessageBox.js) and the game's half
// (net/staffMessages.js) - and the whole chain, from the panel's send to "they pressed OK", over the real relay and the
// real account service.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../chargenDom.mjs';
import worker from '../../server/src/index.js';
import { fakeRooms } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { standService, sessionStorageOf } from '../accountDb.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { SOCIAL_ROOM, SAFE_LAW_PATH, parseClient } from '../../src/net/wire.js';
import { mintStaffMessageOrder, mintOrder, mintBanOrder, orderValid, verifyOrder, ORDER_KINDS } from '../../src/net/identityToken.js';
import { createStaffMessages, STAFF_ASK_GAP_MS, STAFF_TAB, staffMessageLine } from '../../src/net/staffMessages.js';
import { createStaffChat } from '../../src/net/staffChat.js';
import { ChatLog } from '../../src/net/chat.js';
import { showStaffMessageBox, STAFF_MESSAGE_BOX_ID } from '../../src/ui/staffMessageBox.js';
import { staffWords, STAFF_SESSION_HEADER } from '../../server-account/src/staff.js';
import * as H from '../../src/net/hubShards.js';

const subtle = globalThis.crypto.subtle;
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const nowS = () => Math.floor(Date.now() / 1000);
const MI = 'msg-id-0000000001';
/** Turns of the loop until `cond` holds (a call through the real Worker takes a few). */
const until = async (cond, n = 500) => { for (let i = 0; i < n && !(await cond()); i++) await new Promise((r) => setImmediate(r)); };
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn }; console.info = console.warn = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

/** The hub, its door, and a key the service and the relay share. */
async function hubWithDoor() {
  const world = fakeRooms();
  const hub = world.room(SOCIAL_ROOM);
  const kp = await hub.signer();
  const env = { ROOMS: world.ROOMS, IDENTITY_PUBLIC_KEY: hub.env.IDENTITY_PUBLIC_KEY };
  const post = async (order) => { const res = await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), env); return { status: res.status, body: await res.json() }; };
  return { world, hub, kp, env, post };
}

test('STAFF-PANEL5-MESSAGE THE ORDER: \'smsg\' joins ORDER_KINDS carrying its message\'s id (`mi`) and no other kind\'s fields, as no other kind carries a `mi`; a mute\'s or a ban\'s door never takes one (mutants: `mi` unchecked; a mute carrying `mi`)', async () => {
  assert.ok(ORDER_KINDS.includes('smsg'));
  const o = { o: 'smsg', s: 'acct-0001', i: 1000, e: 1060 };
  assert.equal(orderValid({ ...o, mi: MI }), true);
  assert.equal(orderValid(o), false, 'no message named');
  assert.equal(orderValid({ ...o, mi: 'x' }), false, 'not an id');
  assert.equal(orderValid({ ...o, mi: MI, mu: 5 }), false, 'a mute\'s field on it');
  assert.equal(orderValid({ ...o, mi: MI, bn: 5 }), false, 'a ban\'s field on it');
  assert.equal(orderValid({ ...o, mi: MI, bm: 5 }), false, 'a home\'s field on it');
  assert.equal(orderValid({ o: 'mute', s: 'acct-0001', mu: 0, mi: MI, i: 1000, e: 1060 }), false, 'a mute carrying a message');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const order = await mintStaffMessageOrder({ s: 'acct-0001', mi: MI }, kp.privateKey, { subtle, nowS: 1000 });
  assert.deepEqual((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'smsg' })).claims, { o: 'smsg', s: 'acct-0001', mi: MI, i: 1000, e: 1060 });
  for (const kind of ['mute', 'ban']) assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind })).ok, false, `${kind}'s door`);
  await assert.rejects(() => mintStaffMessageOrder({ s: 'acct-0001', mi: 'no' }, kp.privateKey, { subtle, nowS: 1000 }));
});

test('STAFF-PANEL5-MESSAGE THE HELLO: `sm` is 1 or nothing (the `w2` law), and the session says it on a hub link alone (mutants: the field dropped at the wire; said to every room)', () => {
  const base = { t: 'hello', id: 'peer-0001', secret: 'secret-of-peer-0001', name: 'Mac', look: { f: 0, r: 0, g: 0, h: 0, s: 0 } };
  const said = (m) => parseClient(JSON.stringify(m), false);
  const plain = said(base);
  assert.ok(!plain.error, plain.error);
  assert.equal(said({ ...base, sm: 1 }).sm, 1);
  assert.equal('sm' in said({ ...base, sm: 2 }), false, 'any other value is no offer');
  assert.equal('sm' in plain, false);
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: class {}, now: () => 0 });
  s.room = SOCIAL_ROOM;
  assert.equal(s._helloFrame(null).sm, 1, 'the hub link');
  assert.equal(s._helloFrame(null, H.hubOfSubject('acct-x')).sm, 1, 'a hub shard');
  assert.equal('sm' in s._helloFrame(null, 'world:9,9'), false, 'a cell room hears no such word');
});

test('STAFF-PANEL5-MESSAGE THE HUB: the door\'s order nudges that account\'s own hub sockets whose game shows the box - `{t:\'smsg\', mi}` - counts the old builds\' and hands nobody else anything; the door answers the hub\'s count; an account offline is 0 and 0 (mutants: the order unrouted; every socket told; old builds told; the count dropped at the door)', async () => {
  const { hub, kp, post } = await hubWithDoor();
  const troll = hub.connect(); await hub.hello(troll, 'trol-0002', null, { sm: 1 });
  const olda = hub.connect(); await hub.hello(olda, 'olda-0012');   // a build from before the box: its hello says no `sm`
  const bob = hub.connect(); await hub.hello(bob, 'bobb-0003', null, { sm: 1 });
  const order = await mintStaffMessageOrder({ s: 'acct-trol-0002', mi: MI }, kp.privateKey, { subtle, nowS: nowS() });
  assert.deepEqual(await post(order), { status: 200, body: { ok: true, n: 1, old: 0 } });
  assert.deepEqual(ofType(troll, 'smsg'), [{ t: 'smsg', mi: MI }]);
  assert.deepEqual([ofType(olda, 'smsg'), ofType(bob, 'smsg')], [[], []], 'nobody else');
  assert.equal(troll.closed, null);
  const toOld = await mintStaffMessageOrder({ s: 'acct-olda-0012', mi: MI }, kp.privateKey, { subtle, nowS: nowS() });
  assert.deepEqual(await post(toOld), { status: 200, body: { ok: true, n: 0, old: 1 } });
  assert.deepEqual(ofType(olda, 'smsg'), [], 'a build without the box is counted, never sent');
  assert.equal(olda.closed, null);
  const away = await mintStaffMessageOrder({ s: 'acct-nobody-here', mi: MI }, kp.privateKey, { subtle, nowS: nowS() });
  assert.deepEqual(await post(away), { status: 200, body: { ok: true, n: 0, old: 0 } });
  // a forgery, and a mute's answer that stays a mute's
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  assert.equal((await post(await mintStaffMessageOrder({ s: 'acct-trol-0002', mi: MI }, other.privateKey, { subtle, nowS: nowS() + 1 }))).status, 403);
  const mute = await mintOrder({ s: 'acct-bobb-0003', mu: 0 }, kp.privateKey, { subtle, nowS: nowS() });
  assert.deepEqual(await post(mute), { status: 200, body: { ok: true } });
  assert.equal(ofType(troll, 'smsg').length, 1);
});

test('STAFF-PANEL5-MESSAGE NO SOCKET MAKES ONE: a client\'s `smsg` frame is no frame the relay takes, and the order carried in by a client\'s `ban` arm is the wrong kind - nobody hears a nudge (mutants: a carried order taken)', () => quiet(async () => {
  const { hub, kp } = await hubWithDoor();
  const troll = hub.connect(); await hub.hello(troll, 'trol-0002', null, { sm: 1 });
  const mallory = hub.connect(); await hub.hello(mallory, 'mall-0004', null, { sm: 1 });
  await hub.raw(mallory, JSON.stringify({ t: 'smsg', mi: MI }));
  const order = await mintStaffMessageOrder({ s: 'acct-trol-0002', mi: MI }, kp.privateKey, { subtle, nowS: nowS() });
  const m2 = hub.connect(); await hub.hello(m2, 'mall-0005', null, { sm: 1 });
  await hub.raw(m2, JSON.stringify({ t: 'ban', order }));
  assert.deepEqual(ofType(troll, 'smsg'), []);
  assert.deepEqual(ofType(troll, 'banned'), []);
}));

test('STAFF-PANEL5-MESSAGE over the SHARDED hub: the bus finds its target\'s ShardSocket by account, its shard hands the real socket the nudge, and the door counts it (mutants: the hello\'s `sm` lost on the way to the bus)', () => quiet(async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const W = fakeRooms({ now: () => clock });
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
      for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
      for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
    }
  };
  const bus = W.room(SOCIAL_ROOM);
  try {
    const link = async (n, extra = {}) => {
      const R = W.room(H.hubOfSubject(`acct-${n}`));
      const ws = R.connect();
      clock += 30;
      await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra });
      await settle();
      return ws;
    };
    const A = await link('p0', { sm: 1 });
    const B = await link('p1', { sm: 1 });
    const C = await link('p2');
    const kp = await bus.signer();
    const env = { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: bus.env.IDENTITY_PUBLIC_KEY };
    const post = async (order) => (await worker.fetch(new Request(`https://relay.example${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order }) }), env)).json();
    assert.deepEqual(await post(await mintStaffMessageOrder({ s: 'acct-p0', mi: MI }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) })), { ok: true, n: 1, old: 0 });
    assert.deepEqual(await post(await mintStaffMessageOrder({ s: 'acct-p2', mi: MI }, kp.privateKey, { subtle, nowS: Math.floor(clock / 1000) })), { ok: true, n: 0, old: 1 });
    await settle();
    assert.deepEqual(ofType(A, 'smsg'), [{ t: 'smsg', mi: MI }], 'the shard handed the real socket its nudge');
    assert.deepEqual([ofType(B, 'smsg'), ofType(C, 'smsg')], [[], []]);
  } finally {
    Date.now = realNow;
    for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._feedQ?.timer); }
  }
}));

test('STAFF-PANEL5-MESSAGE THE SESSION: a nudge is heard from the hub alone, by its frame type, and handed on as its id; from a cell room it is nothing (mutants: the room unasked)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const heard = [];
  const hubLink = new OnlineSession({ url: 'wss://relay.test', name: 'p', id: 'peer-0001', secret: 'secret-of-peer-0001', WebSocketImpl: FakeWS, presence: false });
  hubLink.onStaffMessage = (mi) => heard.push(['hub', mi]);
  hubLink.join(SOCIAL_ROOM);
  sockets[0].open();
  sockets[0].receive({ t: 'smsg', mi: MI });
  sockets[0].receive({ t: 'smsg', mi: 7 });
  const cell = new OnlineSession({ url: 'wss://relay.test', name: 'p', id: 'peer-0001', secret: 'secret-of-peer-0001', WebSocketImpl: FakeWS, presence: false });
  cell.onStaffMessage = (mi) => heard.push(['cell', mi]);
  cell.join('world:9,9');
  sockets[1].open();
  sockets[1].receive({ t: 'smsg', mi: MI });
  assert.deepEqual(heard, [['hub', MI]]);
});

test('STAFF-PANEL5-MESSAGE THE BOX: "Message from staff", the staff member\'s name and the words, in the middle of the screen, until OK - pressed once, it goes; nothing in it takes the focus (mutants: the name dropped; OK twice)', () => {
  const oks = [];
  const root = showStaffMessageBox({ from: 'Asynian', text: 'Please stop spamming trade.', onOk: () => oks.push(1) });
  assert.ok(root);
  assert.equal(root.id, STAFF_MESSAGE_BOX_ID);
  assert.match(root.className, /\binputbox\b/);
  assert.equal(root.getAttribute('role'), 'alertdialog');
  assert.equal(root.textContent, 'Message from staffFrom AsynianPlease stop spamming trade.OK');
  assert.ok(globalThis.document.body.contains(root));
  assert.notEqual(globalThis.document.activeElement?.tagName, 'BUTTON', 'a key pressed in play never closes it unread');
  const ok = root.querySelector('button');
  ok.click(); ok.click();
  assert.deepEqual(oks, [1]);
  assert.equal(globalThis.document.body.contains(root), false);
  const a = showStaffMessageBox({ from: 'a', text: 'one', onOk() {} });
  const b = showStaffMessageBox({ from: 'b', text: 'two', onOk() {} });
  assert.equal(globalThis.document.body.contains(a), false, 'one box at a time');
  b.querySelector('button').click();
  assert.equal(showStaffMessageBox({ from: 'x', text: 'y', onOk() {} }, null), null, 'off a document, nothing');
});

test('STAFF-PANEL5-MESSAGE THE GAME\'S HALF: a nudge asks the service, each message is shown once, one box at a time, oldest first, its OK said back; a copy goes on the Staff tab and in its own list; asks are paced and never two at once (mutants: shown twice; the OK unsaid; the pace dropped; the copy dropped)', async () => {
  let now = 1_000_000;
  const asked = [];
  let answer = { ok: true, messages: [{ id: 'm1-000001', from: 'Asynian', text: 'first', at: 100 }, { id: 'm2-000002', from: 'SirMcMobdon', text: 'second', at: 101 }] };
  const fetch = async (url, init) => { const path = new URL(url).pathname; asked.push([path, init.body ? JSON.parse(init.body) : null]); return Response.json(path.endsWith('/staff-messages') ? answer : { ok: true, marked: true }); };
  const shown = [];
  const show = (m) => { shown.push(m); };
  const lines = [];
  const log = { push: (tab, line) => { lines.push([tab, line]); return line; }, setShown: () => true };
  const timers = [];
  const box = createStaffMessages(log, { fetch, storage: sessionStorageOf(SESSION_KEY, { secret: 'sess-secret', id: 'acct-1' }), show, now: () => now, wait: (fn, ms) => timers.push([fn, ms]) });
  box.heard('m1-000001');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(asked.map((a) => a[0]), ['/v1/safety/staff-messages']);
  assert.deepEqual(shown.map((m) => [m.from, m.text]), [['Asynian', 'first']], 'one box at a time, the oldest first');
  assert.deepEqual(lines.map(([tab, l]) => [tab, l.text, l.system, l.at]), [[STAFF_TAB, staffMessageLine({ from: 'Asynian', text: 'first' }), true, 100_000], [STAFF_TAB, 'Message from staff (SirMcMobdon): second', true, 101_000]]);
  assert.equal(STAFF_TAB, 'staff');
  shown[0].onOk();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(asked.at(-1), ['/v1/safety/staff-message-ok', { id: 'm1-000001' }]);
  assert.deepEqual(shown.map((m) => m.text), ['first', 'second'], 'the next box after the OK');
  // a nudge for a message shown is nothing; a new one inside the pace waits for it
  box.heard('m1-000001');
  answer = { ok: true, messages: [{ id: 'm2-000002', from: 'SirMcMobdon', text: 'second', at: 101 }, { id: 'm3-000003', from: 'Asynian', text: 'third', at: 102 }] };
  box.heard('m3-000003');
  box.heard('m4-000004');
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.filter((a) => a[0].endsWith('/staff-messages')).length, 1, 'paced');
  assert.deepEqual(timers.map((t) => t[1]), [STAFF_ASK_GAP_MS], 'one wait, however many nudges');
  now += STAFF_ASK_GAP_MS;
  timers[0][0]();
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.filter((a) => a[0].endsWith('/staff-messages')).length, 2);
  shown[1].onOk();
  assert.deepEqual(shown.map((m) => m.text), ['first', 'second', 'third'], 'a message already shown is never shown again');
  assert.deepEqual(box.list().map((m) => m.text), ['first', 'second', 'third']);
  // no session, no ask
  const none = createStaffMessages(null, { fetch, storage: { getItem: () => null }, show, now: () => now, wait: () => {} });
  const before = asked.length;
  none.heard('m9-000009');
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.length, before);
});

/** The service's game doors over a list, by their rule (server-account/src/staffMessage.js staffMessagesFor and
 *  staffMessageOk): the five oldest not pressed OK, and `more` when more wait. */
function serviceOf(rows) {
  const asked = [];
  const fetch = async (url, init) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : null;
    asked.push(path);
    if (path.endsWith('/staff-message-ok')) { const m = rows.find((x) => x.id === body.id && !x.ok); if (m) m.ok = true; return Response.json({ ok: true, marked: !!m }); }
    const waiting = rows.filter((x) => !x.ok);
    return Response.json({ ok: true, messages: waiting.slice(0, 5).map(({ id, from, text, at }) => ({ id, from, text, at })), more: waiting.length > 5 });
  };
  return { fetch, asked };
}
const turns = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

test('STAFF-PANEL5-MESSAGE-FIX 7: SIX MESSAGES ALL SHOWN - an answer is the service\'s five oldest, so a nudge for the sixth while the five are up finds nothing new; when the answer said `more`, the game asks again once the last box is OK\'d and its OK is in, and the sixth is shown (mutants: `more` unread; no ask after the OKs)', async () => {
  let now = 1_000_000;
  const rows = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `m${i}-00000${i}`, from: 'Asynian', text: `message ${i}`, at: 100 + i }));
  const { fetch, asked } = serviceOf(rows);
  const shown = [];
  const timers = [];
  const box = createStaffMessages({ push: () => ({}), setShown: () => true }, { fetch, storage: sessionStorageOf(SESSION_KEY, { secret: 'sess-secret', id: 'acct-1' }), show: (m) => shown.push(m), now: () => now, wait: (fn, ms) => timers.push(fn) });
  box.heard(rows[0].id);
  await turns();
  assert.deepEqual(shown.map((m) => m.text), ['message 1']);
  box.heard(rows[5].id);   // the sixth's nudge, while the five are still up
  now += STAFF_ASK_GAP_MS;
  timers.shift()?.();
  await turns();
  assert.equal(asked.filter((p) => p.endsWith('/staff-messages')).length, 2, 'asked, and answered the same five');
  for (let i = 0; i < 5; i++) { now += 1000; shown[i].onOk(); await turns(); }
  now += STAFF_ASK_GAP_MS;
  while (timers.length) timers.shift()();
  await turns();
  assert.deepEqual(shown.map((m) => m.text), rows.map((r) => r.text), 'all six shown, oldest first');
  shown[5].onOk();
  await turns();
  const asks = asked.filter((p) => p.endsWith('/staff-messages')).length;
  assert.equal(asks, 3, 'and nothing asked after the last, which said no more');
});

test('STAFF-PANEL5-MESSAGE-FIX 8: THE COPY CAN BE READ AGAIN - the Staff tab is off the bar for a player neither frozen nor talking to staff; a message\'s copy puts it on the bar, and the staff chat\'s own word (a read with no thread open, a freeze lifted) leaves it there (mutants: the copy left off the bar; the staff chat taking it off)', async () => {
  const log = new ChatLog({ now: () => 1_000_000 });
  const chat = createStaffChat({ log, read: async () => ({ ok: true, data: { open: false, lines: [] } }), send: async () => ({ ok: false }), nudge: () => false, onFrozen: () => {}, now: () => 1_000_000 });
  assert.equal(log.tab(STAFF_TAB).shown, false, 'off the bar before');
  const { fetch } = serviceOf([{ id: 'm1-000001', from: 'Asynian', text: 'Are you there?', at: 100 }]);
  const box = createStaffMessages(log, { fetch, storage: sessionStorageOf(SESSION_KEY, { secret: 'sess-secret', id: 'acct-1' }), show: () => {}, now: () => 1_000_000, wait: () => {} });
  box.heard('m1-000001');
  await turns();
  assert.equal(log.tab(STAFF_TAB).shown, true, 'on the bar with its copy');
  assert.deepEqual(log.tab(STAFF_TAB).messages.map((l) => l.text), ['Message from staff (Asynian): Are you there?']);
  assert.equal(log.unreadTotal(), 1, 'and counted on the Chat button');
  await chat.refresh();
  chat.heardFrozen(0);
  assert.equal(log.tab(STAFF_TAB).shown, true, 'the staff chat leaves it there');
  // a log with no copy: the staff chat's own rule as it stood
  const bare = new ChatLog({ now: () => 1_000_000 });
  const other = createStaffChat({ log: bare, read: async () => ({ ok: true, data: { open: false, lines: [] } }), send: async () => ({ ok: false }), nudge: () => false, onFrozen: () => {}, now: () => 1_000_000 });
  other.heardFrozen(2_000_000);
  assert.equal(bare.tab(STAFF_TAB).shown, true, 'frozen: on the bar');
  other.heardFrozen(0);
  assert.equal(bare.tab(STAFF_TAB).shown, false, 'lifted, and no copy: off again');
});

/** The panel signed in, as test/server/staffpanel5message.test.js stands it - its relay door the REAL relay's. */
async function panelOverRelay() {
  const { hub, kp, env } = await hubWithDoor();
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const owner = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', owner.publicKey))).toString('base64url');
  const RELAY = `https://relay.example${SAFE_LAW_PATH}`;
  const s = await standService({ IDENTITY_PRIVATE_KEY: pkcs8, DEVELOPER_HANDLES: 'SirMcMobdon', OWNER_HANDLES: 'SirMcMobdon', OWNER_KEYS: `SirMcMobdon:${pub}`, RELAY_LAW_URL: RELAY });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url) === RELAY ? worker.fetch(new Request(url, init), env) : real(url, init));
  await s.registered('SirMcMobdon');
  const ts = nowS();
  const sig = Buffer.from(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, owner.privateKey, new TextEncoder().encode(staffWords('login', 'sirmcmobdon', ts))))).toString('base64url');
  const staff = async (path, body, token) => (await s.fetch(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...(token ? { [STAFF_SESSION_HEADER]: token } : {}) }, body: JSON.stringify(body) })).json();
  const mob = await staff('/v1/staff/login', { handle: 'SirMcMobdon', password: 'a good long one', pub, ts, sig });
  assert.ok(mob.session, JSON.stringify(mob));
  return { s, hub, staff, mob, restore: () => { globalThis.fetch = real; } };
}

test('STAFF-PANEL5-MESSAGE END TO END, offline: the panel sends Troll a message by id -> stored, the real relay\'s hub nudges Troll\'s hub link -> the game reads it with its own session and shows the box -> OK -> the panel reads "they pressed OK"; an old build of Troll\'s reads "old game, not shown"', () => quiet(async () => {
  const { s, hub, staff, mob, restore } = await panelOverRelay();
  try {
    const troll = await s.registered('Troll');
    const { FakeWS, sockets } = fakeSocketClass();
    const link = new OnlineSession({ url: 'wss://relay.test', name: 'Troll', id: 'trol-0002', secret: 'secret-of-trol-0002', WebSocketImpl: FakeWS, presence: false });
    link.join(SOCIAL_ROOM);
    sockets[0].open();
    const room = hub.connect(); await hub.hello(room, 'trol-0002', null, { tokenSub: troll.id, sm: link._helloFrame(null).sm });   // the hub's socket, saying what this build's hello says
    const shown = [];
    const lines = [];
    const game = createStaffMessages({ push: (tab, l) => lines.push([tab, l.text]), setShown: () => true }, { fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, troll), show: (m) => shown.push(m) });
    link.onStaffMessage = game.heard;   // as scenes/world.js hangs it on the hub link
    const sent = await staff('/v1/staff/message', { target: troll.id, text: 'Hello from staff.' }, mob.session);
    assert.equal(sent.message.state, 'delivered', JSON.stringify(sent));
    for (const f of room.sent.splice(0)) sockets[0].receive(f);
    await until(() => shown.length > 0);
    assert.deepEqual(shown.map((m) => [m.from, m.text]), [['SirMcMobdon', 'Hello from staff.']]);
    assert.deepEqual(lines, [['staff', 'Message from staff (SirMcMobdon): Hello from staff.']]);
    const read = async () => (await staff('/v1/staff/messages', { target: troll.id }, mob.session)).messages[0];
    assert.equal((await read()).label, 'Delivered');
    shown[0].onOk();
    await until(async () => (await read()).state === 'ok', 50);
    assert.deepEqual([(await read()).state, (await read()).label], ['ok', 'they pressed OK']);
    // a player on a build from before the box
    const sylvia = await s.registered('Sylvia');
    const oldRoom = hub.connect(); await hub.hello(oldRoom, 'sylv-0003', null, { tokenSub: sylvia.id });   // a build whose hello says no `sm`
    s.env.DB._raw.prepare('UPDATE staff_messages SET at = at - 10').run();
    const again = await staff('/v1/staff/message', { target: sylvia.id, text: 'Can you see this?' }, mob.session);
    assert.deepEqual([again.message.state, again.message.label], ['old-game', 'old game, not shown']);
    assert.deepEqual(ofType(oldRoom, 'smsg'), []);
  } finally { restore(); }
}));
