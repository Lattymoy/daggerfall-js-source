// STAFF-PANEL5-FREEZE (2026-10-22, mob: "the player can only look around"; design doc "DFO Staff Panel: design", Freeze
// player and Freeze chat) - THE GAME'S HALF: the session's `fv`, its `frozen` and its staff nudges (net/online.js); the
// Staff tab and its thread (net/staffChat.js, net/chat.js); the Copy button (ui/chatPanel.js); the screen
// (ui/freezeScreen.js); the motor held and no blow delivered (characters/playerEntity.js), and the host's wiring
// (scenes/staffFreezeHost.js, scenes/world.js). The relay's half: staffpanel5_freeze_relay.test.js; the service's:
// test/server/staffpanel5_freeze.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { CHAT_WORLD_ROOM } from '../../src/net/wire.js';
import { ChatLog, CHAT_TABS } from '../../src/net/chat.js';
import { createChatPanel } from '../../src/ui/chatPanel.js';
import { createStaffChat, STAFF_TAB, STAFF_TAB_ROW, STAFF_POLL_MS, inviteOf, frozenLiftedText, staffInviteText } from '../../src/net/staffChat.js';
import { createFreezeScreen } from '../../src/ui/freezeScreen.js';
import { setStaffFrozen, staffFrozen, playerDamageWithheld, hurtPlayer } from '../../src/characters/playerEntity.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { createStaffFreezeHost } from '../../src/scenes/staffFreezeHost.js';
import { fakeRooms } from '../fakeRoom.mjs';
import { createChatSafetyHost } from '../../src/scenes/chatSafetyHost.js';
import { RELAY_VERSION } from '../../src/net/wire.js';
import { ARENA_HALL } from '../../src/net/arena/arenaLaw.js';
import { leaseKeyOf, mintLease, LEASE_MS, LEASE_FRAME_MIN_MS } from '../../src/net/roomLease.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
const INVITE = 'https://discord.gg/QADbZYQ73j';

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', hidden: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t) { for (const fn of n.listeners.get(t) ?? []) fn({ type: t, target: n, preventDefault() {}, stopPropagation() {} }); },
    focus() { doc.activeElement = n; }, blur() {},
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
const walk = (n, out = []) => { out.push(n); for (const c of n.children) walk(c, out); return out; };
const byClass = (n, cls) => walk(n).filter((x) => String(x.className).split(/\s+/).includes(cls));

/** The account service's two player routes, scripted: `lines` the thread, `frozen` its freeze, each call kept. */
function service({ lines = [], frozen = null, open = true, invite = INVITE } = {}) {
  const calls = [];
  let nextId = 100;
  let hold = null;
  return {
    calls, lines,
    setFrozen(v) { frozen = v; },
    holdNext() { let go; hold = new Promise((r) => { go = r; }); return () => go(); },
    async read(after) {
      calls.push(['read', after]);
      if (hold) { const h = hold; hold = null; await h; }
      return { ok: true, data: { open, frozen, invite, lines: lines.filter((l) => l.id > after) } };
    },
    async send(text) {
      calls.push(['send', text]);
      if (text === 'refused') return { ok: false, error: 'no-thread' };
      const line = { id: nextId++, at: 1_800_000_100, staff: false, text };
      lines.push(line);
      return { ok: true, data: { ok: true, line } };
    },
  };
}

test('STAFF-PANEL5-FREEZE the session: every hello says the build shows the freeze screen (`fv`); `frozen` is handed up once well formed and asks the hub\'s lease again at once; a staff nudge (a line\'s id, no words) is the hub\'s alone and never a chat line; a staff nudge goes only to a hub that spoke the staff word first (mutants: `fv` unsaid; the nudge as a line; the staff gate)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: FakeWS, now: () => now });
  const frozen = [], nudges = [], lines = [];
  s.onFrozen = (f) => frozen.push(f);
  s.onStaffNudge = (n) => nudges.push(n);
  s.onChat = (l) => lines.push(l);
  s.join(CHAT_WORLD_ROOM);
  const ws = sockets[0];
  ws.open();
  await settle();
  assert.equal(JSON.parse(ws.sent.find((f) => JSON.parse(f).t === 'hello')).fv, 1, 'the hello says `fv` 1');
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world245' });
  assert.equal(s.sendChat('41', { ch: 'staff' }), false, 'no staff word heard yet: no nudge goes');
  s._leaseAskAt = now;
  ws.receive({ t: 'frozen', until: 1_800_003_600 });
  ws.receive({ t: 'frozen', until: -1 });
  ws.receive({ t: 'frozen', until: '1' });
  ws.receive({ t: 'frozen' });
  assert.deepEqual(frozen, [{ until: 1_800_003_600 }], 'a malformed frozen frame is dropped');
  // STAFF-FREEZE-ASK: again as soon as the hub's meter takes it (one lease frame a socket in LEASE_FRAME_MIN_MS) - an ask
  // made at once, a moment after the last, was dropped, and the freeze reached no other room until LEASE_MS on
  assert.equal(s._leaseAskAt + LEASE_MS, now + LEASE_FRAME_MIN_MS + 500, 'the hub\'s lease asked again once its meter takes it');
  assert.equal(s.staffOk, true);
  ws.receive({ t: 'chat', ch: 'staff', th: 'acct-mac', sl: 7, st: 1, at: 1 });
  ws.receive({ t: 'chat', ch: 'staff', sl: 0 });
  ws.receive({ t: 'chat', ch: 'staff', id: 'bob-0001', name: 'Bob', text: 'words', at: 1 });
  assert.deepEqual(nudges, [{ sl: 7 }], 'a nudge: its line\'s id alone');
  assert.equal(lines.length, 0, 'never a chat line, words or none');
  now += 2000;
  assert.equal(s.sendChat('41', { ch: 'staff' }), true);
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { t: 'chat', text: '41', ch: 'staff' });
  // a presence session's room is no hub: its nudge is nothing, its `frozen` heard
  const { FakeWS: W2, sockets: s2 } = fakeSocketClass();
  const cell = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: W2, now: () => now });
  const cf = [], cn = [];
  cell.onFrozen = (f) => cf.push(f); cell.onStaffNudge = (n) => cn.push(n);
  cell.join('dungeon:m4242');
  s2[0].open();
  s2[0].receive({ t: 'frozen', until: 0 });
  s2[0].receive({ t: 'chat', ch: 'staff', sl: 9 });
  assert.deepEqual([cf, cn, cell.staffOk], [[{ until: 0 }], [], false]);
});

test('STAFF-PANEL5-FREEZE THE STAFF TAB: on the bar and to the front when a freeze lands; the thread read from the service (staff lines named Staff, mine as mine), the Discord invite said once with its Copy; a nudge reads what is new, one read at a time and one more after; a line said goes to the service first and its id down the hub; a refusal said in words; a lift said; the slow read while the tab stands (mutants: the tab unshown; the read from the start every time; two reads at once; the nudge before the store; the poll never)', async () => {
  let clock = 1_800_000_000_000;
  const log = new ChatLog({ now: () => clock });
  const svc = service({ frozen: { until: 1_800_003_600, reason: 'spawn camping' }, lines: [{ id: 5, at: 1_800_000_000, staff: true, text: 'Hello, this is staff.' }] });
  const nudged = [], painted = [];
  const chat = createStaffChat({ log, read: svc.read, send: svc.send, nudge: (sl) => { nudged.push(sl); return true; }, onFrozen: (s) => painted.push(s), me: () => 'Troll', now: () => clock });
  assert.ok(!CHAT_TABS.some((t) => t.id === STAFF_TAB), 'no row of the bar\'s own');
  assert.deepEqual([STAFF_TAB_ROW.id, STAFF_TAB_ROW.hidden, STAFF_TAB_ROW.link], [STAFF_TAB, true, false], 'a hidden tab of its own, added by the chat');
  assert.equal(log.tab(STAFF_TAB).shown, false);
  chat.heardFrozen(1_800_003_600);
  await settle(); await settle();
  assert.equal(chat.frozen(), true);
  assert.equal(log.tab(STAFF_TAB).shown, true, 'on the bar');
  assert.equal(log.active, STAFF_TAB, 'and to the front');
  assert.deepEqual(svc.calls, [['read', 0]]);
  const msgs = () => log.tab(STAFF_TAB).messages;
  assert.deepEqual(msgs().map((l) => [l.name, l.text, l.system, l.mine, l.copy ?? null]), [['', staffInviteText(INVITE), true, false, INVITE], ['Staff', 'Hello, this is staff.', false, false, null]]);
  assert.deepEqual(painted.at(-1), { until: 1_800_003_600, reason: 'spawn camping', invite: INVITE });
  // a nudge reads what is new; two meanwhile are one more read
  svc.lines.push({ id: 6, at: 1_800_000_010, staff: true, text: 'Why were you there?' });
  const go = svc.holdNext();
  chat.heardNudge(); chat.heardNudge(); chat.heardNudge();
  go(); await settle(); await settle(); await settle();
  assert.deepEqual(svc.calls.slice(1), [['read', 5], ['read', 6]], 'from the last line read, one at a time and one more after');
  assert.equal(msgs().filter((l) => l.text === staffInviteText(INVITE)).length, 1, 'the invite said once');
  // a line said: the service first, then its id down the hub, then the thread read
  assert.equal(chat.say('I was waiting for a friend'), true);
  await settle(); await settle(); await settle();
  assert.deepEqual(svc.calls.slice(3), [['send', 'I was waiting for a friend'], ['read', 6]]);
  assert.deepEqual(nudged, [100]);
  assert.deepEqual(msgs().at(-1) && [msgs().at(-1).name, msgs().at(-1).mine, msgs().at(-1).text], ['Troll', true, 'I was waiting for a friend']);
  chat.say('refused');
  await settle(); await settle();
  assert.equal(msgs().at(-1).text, accountRefusalText('no-thread'), 'a refusal said in words');
  assert.deepEqual(nudged, [100], 'and nothing nudged');
  // the slow read
  const reads = () => svc.calls.filter((c) => c[0] === 'read').length;
  const was = reads();
  clock += STAFF_POLL_MS - 1; chat.tick(); await settle();
  assert.equal(reads(), was);
  clock += 1; chat.tick(); await settle(); await settle();
  assert.equal(reads(), was + 1, 'read again at STAFF_POLL_MS');
  // the lift
  chat.heardFrozen(0);
  assert.equal(chat.frozen(), false);
  assert.equal(msgs().at(-1).text, frozenLiftedText());
  assert.equal(painted.at(-1).until, 0);
  // the invite is a link a player may be shown, or none
  assert.equal(inviteOf(INVITE), INVITE);
  for (const v of ['http://discord.gg/x', 'https://a b', 'javascript:alert(1)', '', null, 7, `https://${'x'.repeat(200)}`]) assert.equal(inviteOf(v), null, String(v));
});

test('STAFF-PANEL5-FREEZE THE LOCK: a freeze holds the motor and withholds every blow until it ends, and a lift or its end lets go; the screen says Frozen by staff, why, until when and the invite with its Copy, and hides at a lift; a game line\'s Copy writes its words to the clipboard, a player\'s line carries none (mutants: the blow delivered; the screen never hidden; the copy kept on a player\'s line)', async () => {
  const nowS = Math.floor(Date.now() / 1000);
  setStaffFrozen(nowS + 60);
  assert.equal(staffFrozen(), true);
  assert.equal(playerDamageWithheld(), true);
  const body = { health: 10, maxHealth: 10 };
  assert.equal(hurtPlayer(body, 5), false, 'no blow lands');
  assert.equal(body.health, 10);
  assert.equal(staffFrozen(nowS + 61), false, 'its end lets go');
  setStaffFrozen(0);
  assert.equal(staffFrozen(), false); assert.equal(playerDamageWithheld(), false);
  setStaffFrozen('9999999999'); assert.equal(staffFrozen(), false, 'a word that is no time is no freeze');
  // the motor: every host's paralysis gate ORs the freeze
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(readFileSync(f, 'utf8'), /const paralyzed = entityIsParalyzed\(playerEntity\) \|\| staffFrozen\(\);/, f);
  assert.match(readFileSync('src/scenes/worldModes.js', 'utf8'), /const paralyzed = staffFrozen\(\) \|\| \(\(mode === 'dungeon' && dungeonCtx\)/);
  // the screen
  const doc = fakeDocument();
  const screen = createFreezeScreen({ doc, win: { navigator: { clipboard: { writeText: async (w) => { copied.push(w); } } } } });
  const copied = [];
  assert.equal(screen.root.hidden, true);
  screen.paint({ until: nowS + 3600, reason: 'spawn camping', invite: INVITE });
  assert.equal(screen.root.hidden, false);
  const text = walk(screen.root).map((n) => n.textContent).join('|');
  assert.match(text, /Frozen by staff/); assert.match(text, /spawn camping/); assert.match(text, /discord\.gg\/QADbZYQ73j/);
  walk(screen.root).find((n) => n.tagName === 'BUTTON').fire('click');
  await settle();
  assert.deepEqual(copied, [INVITE]);
  screen.paint({ until: 0, reason: null, invite: null });
  assert.equal(screen.root.hidden, true, 'a lift hides it');
  // the chat's Copy
  const log = new ChatLog();
  assert.equal(log.addTab(STAFF_TAB_ROW), true); assert.equal(log.addTab(STAFF_TAB_ROW), false, 'once');
  log.setShown(STAFF_TAB, true); log.select(STAFF_TAB);
  assert.equal(log.push(STAFF_TAB, { text: 'spoken', id: 'bob-0001', name: 'Bob', copy: INVITE }).copy, undefined, 'a player\'s line offers nothing to copy');
  log.push(STAFF_TAB, { text: staffInviteText(INVITE), system: true, copy: INVITE });
  const cdoc = fakeDocument(), got = [];
  const win = { addEventListener() {}, removeEventListener() {}, navigator: { clipboard: { writeText: async (w) => { got.push(w); } } } };
  const panel = createChatPanel({ log, onSend() {}, action: () => null, doc: cdoc, win, touch: false });
  log.setOpen(true);
  panel.render();
  const btns = byClass(cdoc.body, 'dfchat-copy');
  assert.equal(btns.length, 1, 'one Copy, on the game\'s line');
  btns[0].fire('click');
  await settle();
  assert.deepEqual(got, [INVITE]);
  panel.destroy();
});

test('STAFF-PANEL5-FREEZE THE HOST: the host wires `frozen` on every session and the nudge on the hub\'s; a frozen player\'s line on any other tab is refused in words, commands too, and a Staff tab\'s line goes to the service; world.js wires it and nothing more (mutants: a tab left open while frozen; the Staff tab\'s line sent as chat)', async () => {
  const doc = fakeDocument();
  const log = new ChatLog();
  const said = [];
  const hub = { sendChat: (text, o) => { said.push([text, o.ch]); return true; } };
  const online = { name: 'Troll' };
  const storage = new Map();
  const host = createStaffFreezeHost(log, () => hub, online, null, { doc, storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) }, fetch: async () => { throw new Error('no network in a pin'); } });
  try {
    const link = {};
    host.wire(link);
    assert.equal(typeof online.onFrozen, 'function', 'the presence session wired at the start');
    assert.equal(typeof link.onFrozen, 'function'); assert.equal(typeof link.onStaffNudge, 'function');
    assert.equal(host.claims('world'), false, 'unfrozen: the World tab is the World tab\'s');
    assert.equal(host.claims(STAFF_TAB), true);
    link.onFrozen({ until: Math.floor(Date.now() / 1000) + 600 });
    assert.equal(staffFrozen(), true, 'the motor held');
    assert.equal(host.claims('world'), true);
    assert.equal(host.send('world', '/unstuck'), true);
    assert.match(log.tab('world').messages.at(-1).text, /only talk to staff/);
    assert.equal(said.length, 0);
    host.send(STAFF_TAB, 'hello');
    await settle(); await settle();
    assert.match(log.tab(STAFF_TAB).messages.at(-1).text, /not signed in/, 'no session on this page: the service is not asked, and it says so');
    link.onFrozen({ until: 0 });
    assert.equal(staffFrozen(), false);
  } finally { host.destroy(); }
  assert.equal(staffFrozen(), false);
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /staffHost = createStaffFreezeHost\(chatLog, socialLink, online, staffHost\);/);
  assert.match(w, /staffHost\.wire\(link\);/);
  assert.match(w, /if \(staffHost\?\.claims\(tabId\)\) return staffHost\.send\(tabId, text\);[^\n]*\n\s*\/\/ EG-PLAY: `\/breach`/, 'before every command but the mailbox\'s');
});

test('STAFF-PANEL5-FREEZE-FIX THE SERVICE\'S ANSWER BOTH WAYS (a review: a lift the relay never said - the hub link down then - held the motor until the old end): a read that finds the freeze gone lets go, a read that finds it raised holds; a read begun before the relay\'s latest word changes no freeze, its lines all the same (mutants: the read raising only; the relay\'s word overruled)', async () => {
  const clock = 1_800_000_000_000;
  const log = new ChatLog({ now: () => clock });
  const svc = service({ frozen: { until: 1_800_003_600, reason: 'spawn camping' } });
  const painted = [];
  const chat = createStaffChat({ log, read: svc.read, send: svc.send, nudge: () => true, onFrozen: (s) => painted.push(s), me: () => 'Troll', now: () => clock });
  chat.heardFrozen(1_800_003_600);
  await settle(); await settle();
  assert.equal(chat.frozen(), true);
  // the lift, said while a read was on its way: the read (begun before it) leaves it lifted
  const go = svc.holdNext();
  chat.heardNudge();
  svc.lines.push({ id: 7, at: 1_800_000_010, staff: true, text: 'You are free to go.' });
  chat.heardFrozen(0);
  go(); await settle(); await settle(); await settle();
  assert.equal(chat.frozen(), false, 'the relay\'s lift is newer than the read');
  assert.equal(painted.at(-1).until, 0);
  assert.ok(log.tab(STAFF_TAB).messages.some((l) => l.text === 'You are free to go.'), 'its lines kept all the same');
  // the service froze again (its word, the relay silent): a read raises it
  svc.setFrozen({ until: 1_800_007_200, reason: 'again' });
  await chat.refresh();
  assert.deepEqual([chat.frozen(), painted.at(-1).until, painted.at(-1).reason], [true, 1_800_007_200, 'again']);
  // and lifted with the hub link down - the relay never says it: the next read lets go
  svc.setFrozen(null);
  await chat.refresh();
  assert.deepEqual([chat.frozen(), painted.at(-1).until, painted.at(-1).reason], [false, 0, null], 'the motor and the screen let go');
});

test('STAFF-PANEL5-FREEZE-FIX A NEW ARENA HALL LINK HANDS THE PAGE\'S LEASE (round two, a review: every room but the hub\'s is a lease room, and a hall link made after the page\'s lease came held none - with the door on, its one queue word was heard in nothing, the hall said queued and the relay never queued it): adopted (world.js makeHall), the link takes the page\'s newest lease and hands it just ahead of its first hall word, and the hall, its door on, queues it (mutant: the lease untaken)', async (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const secret = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
  // the page: its hub link, welcomed by a relay that knows the lease, handed the hub's lease
  const { FakeWS, sockets } = fakeSocketClass();
  const session = () => new OnlineSession({ url: 'wss://relay.test', name: 'Alva', id: 'peer-alva', secret: 'secret-of-peer-alva', presence: false, WebSocketImpl: FakeWS, now: () => now, wire2: true });
  const hub = session();
  hub.join(CHAT_WORLD_ROOM);
  const hubWs = sockets.at(-1);
  hubWs.open();
  hubWs.receive({ t: 'welcome', id: 'peer-alva', peers: [], n: 1, v: RELAY_VERSION });
  const host = createChatSafetyHost({ log: () => new ChatLog({ now: () => now }), links: () => [hub], storage: { getItem: () => null }, doc: fakeDocument(), touch: false, register: () => () => {}, win: { addEventListener() {}, removeEventListener() {} }, now: () => now });
  await host.start();
  const key = await leaseKeyOf(secret, { subtle });
  const l = await mintLease({ s: 'acct-alva', at: Math.floor(now / 1000) }, key, { subtle });
  hubWs.receive({ t: 'lease', l });
  await settle();
  now += 5000;
  // the hall, its door on
  const W = fakeRooms({ now: () => now });
  const H = W.room(ARENA_HALL);
  Object.assign(H.env, { GATE_SIGNING_KEY: secret, LEASE_DOOR: 'on' });
  const A = H.connect();
  await quiet(() => H.hello(A, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ar: 1000, fv: 1, ls: 1 }));
  assert.equal(A.closed, null);
  // the game's hall link (world.js makeHall), adopted, says its first hall word
  const hall = host.adoptLink(session());
  hall.join(ARENA_HALL);
  const ws = sockets.at(-1);
  ws.open();
  ws.receive({ t: 'welcome', id: 'peer-alva', peers: [], n: 1, v: RELAY_VERSION });
  await settle();
  now += 1000;
  assert.equal(hall.sendArena({ k: 'q', lv: 9 }), true);
  const said = ws.sent.map((f) => JSON.parse(f)).filter((f) => f.t !== 'hello' && f.t !== 'ping');
  assert.deepEqual(said.map((f) => f.t), ['lease', 'arena'], 'the page\'s lease just ahead of the hall word');
  assert.equal(said[0].l, l);
  for (const f of said) await quiet(() => H.raw(A, JSON.stringify(f)));
  assert.ok(A.sent.some((m) => m.t === 'arena' && m.k === 'qd'), `queued: ${JSON.stringify(A.sent.filter((m) => m.t === 'arena'))}`);
  for (const [, r] of W.made) { clearTimeout(r.room._countT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
});
