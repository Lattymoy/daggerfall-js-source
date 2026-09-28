// ONE-SEAT (2026-09-27, Mac: "Can we also make it where the player can only have one character only at a time. Like
// they shouldnt be able to open multiple tabs and join as different characters").
//
// ONE TAB OF A PLAYER ONLINE. The hub - the one room every online tab holds - decides it for an ACCOUNT (the token's
// verified subject): a hub hello that CLAIMS (`cl`) closes the account's other tabs there, and one that does not is a
// reconnect, refused while another tab of the account holds the hub. The client that is closed so leaves every room
// and stays out (net/online.js `superseded`) until its player presses Play online here; and every tab of one browser
// hears the others go online (net/oneSeat.js), so two tabs signed in as two players are one seat too. These pins drive
// the real Room over the fake object, the real session over a fake socket, and the lock over a fake channel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { parseClient, SEAT_ELSEWHERE, SOCIAL_ROOM, CLOSE_REPLACED, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession, SEAT_TEXT, BACKOFF_MAX_MS, CLAIM_TTL_MS } from '../src/net/online.js';
import { createSeatLock, SEAT_CHANNEL, SEAT_NOTICE, SEAT_MID_TEXT, PLAY_HERE_LABEL } from '../src/net/oneSeat.js';
import { createChatPanel, CHAT_CSS } from '../src/ui/chatPanel.js';
import { ChatLog } from '../src/net/chat.js';
import { setSigilOnline, setSigilRenown, drinkSigil, sigilOnline, sigilRenown, _resetSigilForTests } from '../src/systems/sigil.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const errorsOf = (ws) => ws.sent.filter((f) => f.t === 'error').map((f) => f.m);
const welcomed = (ws) => ws.sent.some((f) => f.t === 'welcome');

test('ONE-SEAT: the hello\'s claim is 1 or nothing - anything else is refused, as a malformed token is; the version moved (mutants: the claim dropped at the door; any value taken)', () => {
  const base = { t: 'hello', id: 'tab-0001', secret: 'secret-of-tab-0001', name: 'Mac', look, pose: null };
  assert.equal(parseClient(JSON.stringify({ ...base, cl: 1 })).cl, 1, 'a tab going online says so');
  assert.equal('cl' in parseClient(JSON.stringify(base)), false, 'a reconnect says nothing');
  for (const bad of [0, true, '1', 2]) assert.deepEqual(parseClient(JSON.stringify({ ...base, cl: bad })), { error: 'bad claim' }, JSON.stringify(bad));
  assert.equal(SEAT_ELSEWHERE, 'online in another tab, window or device');
  assert.equal(RELAY_VERSION, 'world122');   // world119, then world120, on this branch - main's AUDIT SET took world119 and PARTY-BUFFS + REST-OPT world120 first (the merges renumbered ONE-SEAT's)
});

test('ONE-SEAT at the hub: a claim closes the account\'s other tab - the reason said first, CLOSE_REPLACED - and its leave is said to the room; the newest tab stays; another account is not touched (mutants: no supersede; by the browser\'s account instead of the verified one; every room instead of the hub)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const a = r.connect(), b = r.connect(), other = r.connect();
  await r.hello(other, 'tab-other', null, { tokenSub: 'player-2' });
  await r.hello(a, 'tab-a', null, { tokenSub: 'player-1', cl: 1, acct: 'aprofile1', asecret: 'asecret-profile-1' });
  assert.ok(welcomed(a) && !a.closed, 'the first tab online');
  // the second tab is another browser profile (its own hub account) signed in as the same player
  await r.hello(b, 'tab-b', null, { tokenSub: 'player-1', cl: 1, acct: 'aprofile2', asecret: 'asecret-profile-2' });
  assert.ok(welcomed(b) && !b.closed, 'the tab that claimed is in');
  assert.deepEqual(a.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE }, 'the older tab is closed, CLOSE_REPLACED');
  assert.deepEqual(errorsOf(a), [SEAT_ELSEWHERE], 'and told why first');
  assert.ok(!other.closed && welcomed(other), 'another player is not touched');
  assert.ok(other.sent.some((f) => f.t === 'leave' && f.id === 'tab-a'), 'the room hears the older tab go (its leave, at the reap)');
  assert.ok(!r.sockets.includes(a), 'and it is out of the object');
});

test('ONE-SEAT at the hub: a hello that does NOT claim is a reconnect - refused while another tab of the account holds the hub, before anything is written; admitted when none does (an older build\'s first tab); the holder\'s own reconnect replaces its old socket (mutants: the refusal dropped; the same-id exclusion dropped, so a holder\'s reconnect refused itself)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const holder = r.connect();
  await r.hello(holder, 'tab-holder', null, { tokenSub: 'player-1' });   // no claim: a build before ONE-SEAT, first in
  assert.ok(welcomed(holder) && !holder.closed, 'the first tab in holds the seat, claim or none');
  const stale = r.connect();
  await r.hello(stale, 'tab-stale', null, { tokenSub: 'player-1' });   // a tab superseded while its socket was down, back
  assert.deepEqual(stale.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE }, 'the seat is the holder\'s');
  assert.equal(welcomed(stale), false, 'no welcome');
  assert.equal(r.store.has('secret:tab-stale'), false, 'and nothing written for it - a refused hello leaves nothing behind');
  assert.ok(!holder.closed, 'the holder stands');
  // the holder's own socket drops without the object hearing it, and the tab reconnects - the same id, no claim
  const again = r.connect();
  await r.hello(again, 'tab-holder', null, { tokenSub: 'player-1' });
  assert.ok(welcomed(again) && !again.closed, 'its own reconnect is in');
  assert.deepEqual(holder.closed, { code: CLOSE_REPLACED, reason: 'replaced' }, 'its old socket replaced, as every reconnect is');
  // and a claim from the stale tab takes the seat back - the player pressed Play online here
  const back = r.connect();
  await r.hello(back, 'tab-stale', null, { tokenSub: 'player-1', cl: 1 });
  assert.ok(welcomed(back) && !back.closed, 'a claim is always in');
  assert.deepEqual(again.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE }, 'and the other tab goes');
});

test('ONE-SEAT: only the hub decides - two tabs of one account in a place room are both admitted there, claim or none; the client that the hub closes leaves the rest (mutant: the rule run in every room)', async () => {
  const r = fakeRoom('1234567890');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'tab-a', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { tokenSub: 'player-1' });
  await r.hello(b, 'tab-b', { x: 1, y: 0, z: 0, yaw: 0, pitch: 0 }, { tokenSub: 'player-1', cl: 1 });
  assert.ok(welcomed(a) && welcomed(b) && !a.closed && !b.closed);
});

/** A fake WebSocket class: records what was sent, lets the test drive the events (test/online.test.js's own). */
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
const hub = (FakeWS, clock) => new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look, id: 'tab-0001', secret: 'secret-of-tab-0001', presence: false, WebSocketImpl: FakeWS, now: () => clock.t });
const hellos = (ws) => ws.sent.filter((f) => f.t === 'hello');

test('ONE-SEAT, the session: the hub link claims until the hub welcomes it, and a reconnect after does not (mutants: the claim never sent; the welcome not spending it)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = hub(FakeWS, clock);
  s.claim = true;
  s.join(SOCIAL_ROOM);
  await sockets[0].onopen();
  assert.equal(hellos(sockets[0])[0].cl, 1, 'the tab going online claims');
  sockets[0].drop(1006);   // dropped before the hub answered: the claim was never taken
  clock.t += BACKOFF_MAX_MS;
  s.tick();
  await sockets[1].onopen();
  assert.equal(hellos(sockets[1])[0].cl, 1, 'so the retry claims again');
  sockets[1].receive({ t: 'welcome', id: 'tab-0001', peers: [], n: 1, v: RELAY_VERSION, now: clock.t });
  assert.equal(s.claim, false, 'the hub took it');
  sockets[1].drop(1006);
  clock.t += BACKOFF_MAX_MS;
  s.tick();
  await sockets[2].onopen();
  assert.equal('cl' in hellos(sockets[2])[0], false, 'a reconnect is a reconnect');
});

test('ONE-SEAT, the session: the hub\'s close is STICKY - nothing joins, rejoins or retries, and the line says why - until resume(), whose join claims again (mutants: the close not sticky; join or rejoin not shut; resume not claiming)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = hub(FakeWS, clock);
  let heard = 0;
  s.onSuperseded = () => { heard++; throw new Error('a host that throws is contained'); };
  s.join(SOCIAL_ROOM);
  await sockets[0].onopen();
  sockets[0].receive({ t: 'welcome', id: 'tab-0001', peers: [], n: 1, v: RELAY_VERSION, now: clock.t });
  sockets[0].receive({ t: 'error', m: SEAT_ELSEWHERE });
  sockets[0].drop(CLOSE_REPLACED);
  assert.equal(s.superseded, true);
  assert.equal(s.statusLine('World'), `World: ${SEAT_TEXT}`, 'the line says why');
  clock.t += BACKOFF_MAX_MS * 4;
  s.tick();
  assert.equal(s.rejoin(SOCIAL_ROOM, 0), false, 'the chat frame\'s door is shut');
  s.join(SOCIAL_ROOM);
  s.join('1234567890');
  assert.equal(sockets.length, 1, 'no socket opened - by the clock, the chat frame, or a crossing');
  assert.equal(heard, 1, 'the host heard it at once - a hidden tab draws no frame to notice in');
  s.resume({ claim: true });
  assert.equal(s.superseded, false);
  s.join(SOCIAL_ROOM);
  assert.equal(sockets.length, 2, 'Play online here: in again');
  await sockets[1].onopen();
  assert.equal(hellos(sockets[1])[0].cl, 1, 'taking the seat back');
});

test('ONE-SEAT, the session: supersede() - the host\'s word, when the hub closed ANOTHER of this tab\'s links or another tab of the browser went online - leaves the room cleanly and shuts the doors (mutant: supersede only marking)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const presence = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look, id: 'tab-0001', secret: 'secret-of-tab-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  presence.join('1234567890', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  await sockets[0].onopen();
  presence.supersede();
  assert.deepEqual(sockets[0].closed, { code: 1000, reason: 'leaving' }, 'a clean leave - the room says it at once');
  assert.equal(presence.room, null);
  assert.equal(presence.superseded, true);
  assert.equal(presence.terminal, true, 'and terminal - what the gate\'s door asks (world.js gateRefusal: a tab out of the seat walks through no gate) - AUDIT ONESEAT T1');
  assert.equal(presence.statusLine('Local'), `Local: ${SEAT_TEXT}`);
  presence.join('1234567891', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  assert.equal(sockets.length, 1, 'the next crossing joins nothing');
});

/** A BroadcastChannel over one bus: a post reaches every OTHER object of the name, never its source - the real one's law. */
function fakeChannels() {
  const all = [];
  class Channel {
    constructor(name) { this.name = name; this.onmessage = null; this.closed = false; all.push(this); }
    postMessage(data) { if (this.closed) throw new Error('closed'); for (const c of all) if (c !== this && !c.closed && c.name === this.name) c.onmessage?.({ data: structuredClone(data) }); }
    close() { this.closed = true; }
  }
  return { Channel, all };
}

test('ONE-SEAT, the browser\'s arm: a tab going online takes the seat from every other tab of the browser that holds it - once, the newest wins, and it turns back (mutants: the hold not asked; the page\'s own word taken for another\'s)', () => {
  const { Channel, all } = fakeChannels();
  const lost = { a: 0, b: 0 };
  let t = 0;
  const now = () => (t += 1000);   // AUDIT ONESEAT C4: a claim is stamped - a second between a player's presses, as there is
  const a = createSeatLock({ Channel, now, onLost: () => { lost.a++; } });
  const b = createSeatLock({ Channel, now, onLost: () => { lost.b++; } });
  assert.equal(all[0].name, SEAT_CHANNEL);
  a.claim();
  assert.deepEqual(lost, { a: 0, b: 0 }, 'b held nothing, so it lost nothing');
  b.claim();
  assert.deepEqual(lost, { a: 1, b: 0 }, 'a gave the seat to the newer tab');
  assert.equal(a.held, false); assert.equal(b.held, true);
  b.claim();
  assert.equal(lost.a, 1, 'said once - a tab out of the seat is not told again');
  a.claim();
  assert.deepEqual(lost, { a: 1, b: 1 }, 'Play online here: it turns back');
  b.release();
  a.claim();
  assert.equal(lost.b, 1, 'a released tab holds nothing to lose');
  // one PAGE's two objects (a nonce shared) are one tab: its own word is never another's
  const one = createSeatLock({ Channel, now, nonce: 'page-1', onLost: () => { lost.a += 100; } });
  const same = createSeatLock({ Channel, now, nonce: 'page-1' });
  one.claim(); same.claim();
  assert.equal(one.held, true, 'a page does not take its own seat');
});

test('ONE-SEAT, the browser\'s arm: a browser without BroadcastChannel (or a channel that throws) has the hub\'s arm alone - the lock never throws', () => {
  const none = createSeatLock({ Channel: undefined });
  none.claim(); assert.equal(none.held, true); none.release(); none.close();
  const bad = createSeatLock({ Channel: class { constructor() { throw new Error('no'); } } });
  bad.claim(); bad.close();
});

// ── THE BUTTON ───────────────────────────────────────────────────────
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', type: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    removeAttribute(k) { delete n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {} }; for (const fn of n.listeners.get(t) ?? []) fn(ev); },
    focus() { doc.activeElement = n; }, blur() { if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 440, height: 300, right: 440, bottom: 300 }),
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.documentElement = fakeNode('html', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const fakeWindow = () => ({ innerWidth: 1280, innerHeight: 720, listeners: [], addEventListener(t, fn) { this.listeners.push({ t, fn }); }, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

test('ONE-SEAT, the way back: the chat\'s strip carries "Play online here" while the host hands the action in, a press runs it, and Hide does not take it - a player who hid the chat is still told (mutants: the button never drawn; the press not wired; hidden with the chat)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  const panel = createChatPanel({ log: new ChatLog(), onSend: () => true, doc, win, overlay: () => false });
  const [here] = find(doc.body, 'dfchat-here');
  assert.ok(here, 'the button is built');
  assert.equal(here.type, 'button');
  panel.render({ status: `World: ${SEAT_TEXT}`, here: null });
  assert.equal(here.className, 'dfchat-here', 'no action, no button');
  let ran = 0;
  panel.render({ status: `World: ${SEAT_TEXT}`, here: { label: PLAY_HERE_LABEL, run: () => { ran++; } } });
  assert.equal(here.className, 'dfchat-here on');
  assert.equal(here.textContent, 'Play online here');
  here.fire('click');
  assert.equal(ran, 1, 'the press takes the seat back');
  panel.render({ status: null, here: null });
  assert.equal(here.className, 'dfchat-here', 'back online, gone');
  here.fire('click');
  assert.equal(ran, 1, 'and a stale press does nothing');
  const hiddenRule = CHAT_CSS.slice(CHAT_CSS.indexOf('.dfchat[data-hidden="1"]'), CHAT_CSS.indexOf('.dfchat-show { display: inline-flex'));
  assert.ok(hiddenRule.length > 40 && !hiddenRule.includes('dfchat-here'), 'Hide does not take it');
  assert.match(CHAT_CSS, /\n\.dfchat-here \{ display: none; pointer-events: auto;[^}]*font-size: 14px; padding: 6px 10px;/, 'a thumb\'s button, unscaled, as the others');
  assert.match(CHAT_CSS, /\n\.dfchat-here\.on \{ display: inline-flex; \}/);
  panel.destroy();
});

test('ONE-SEAT, the host: the World link claims, the tab claims the browser\'s seat as it goes online, a lost seat is left once before anything else of the frame (the foes handed and the room\'s last word said first) and every session is marked, the renown earns only in the seat, and Play online here resumes every link with the hub\'s claiming (mutants: each line)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.claim = true;/, 'the hub link\'s first hello claims');
  assert.match(w, /seatLock = createSeatLock\(\{ onLost: \(\) => seatLostNow\(\) \}\);\n\s*if \(online\.url\) seatLock\.claim\(\);/, 'the browser\'s arm, at online start - acted on as it arrives (AUDIT ONESEAT C3: by a tab with a relay to be online on)');
  assert.match(w, /\n\s*link\.onSuperseded = \(\) => seatLostNow\(\);/, 'the hub\'s close acted on as it arrives - a hidden tab draws no frame');
  assert.doesNotMatch(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onSuperseded/, 'AUDIT ONESEAT C5: every link\'s close, not the hub\'s alone - a shut Region link had no way back');
  assert.match(w, /online\.onSuperseded = \(\) => seatLostNow\(\);/, 'and a room\'s');
  assert.match(w, /const seatLostNow = \(\) => \{\n\s*_seatOut = true;\n\s*try \{ leaveSeat\(performance\.now\(\)\); \}/, 'the network\'s half at once, contained');
  assert.match(w, /const seatOut = \(\) => _seatOut \|\| !!online\?\.superseded \|\| !!chatLinks\?\.get\('world'\)\?\.superseded;/, 'either arm');
  const frame = w.slice(w.indexOf('  const onlineFrame = (now, dt) => {'));
  const branch = frame.indexOf('    if (seatOut()) {\n      if (!_seatLeft) leaveSeat(now);');
  assert.ok(branch > 0, 'the frame asks');
  assert.ok(branch < frame.indexOf('// AUDIT ONLINE D12: the dead broadcast nothing and see no one'), 'before the dead\'s law');
  assert.ok(branch < frame.indexOf('online.join('), 'and before anything joins');
  assert.match(frame.slice(branch, branch + 1200), /peerBodies\.destroy\(\); remotePlayers\.sync\(\[\], onlineToScene\);[^\n]*return;/, 'nobody drawn while out');
  const leave = w.slice(w.indexOf('  const leaveSeat = (now) => {'), w.indexOf('  const seatLostNow = () => {'));
  assert.match(leave, /const leaveSeat = \(now\) => \{\n\s*if \(_seatLeft\) return;\n\s*_seatLeft = true;/, 'once, whoever asks first');
  assert.ok(leave.indexOf('handOverFoes() || handOverRoomFoes()') > 0 && leave.indexOf('worldPublish(now, true)') > 0, 'my foes and the room\'s memory, first');
  assert.ok(leave.indexOf('online?.supersede();') > leave.indexOf('worldPublish(now, true)'), 'while the socket still stands');
  assert.match(leave, /for \(const link of chatLinks\?\.values\?\.\(\) \?\? \[\]\) link\.supersede\(\);/, 'every link marked');
  const words = frame.slice(branch, frame.indexOf('peerBodies.destroy();', branch));
  assert.match(words, /if \(!_seatSaid\) \{[^\n]*\n\s*_seatSaid = true;/, 'the frame\'s half, once');
  assert.match(words, /if \(modes\?\.gateArenaDay\?\.\(\) != null\) ejectFromCourt\(COURT_TEXT\.lost\);/, 'the court is online\'s alone - cast out in the frame, where a mode may change');
  assert.match(words, /chatNotice\(SEAT_NOTICE\);/);
  assert.match(words, /setMidScreenText\(SEAT_MID_TEXT\);/);
  const take = w.slice(w.indexOf('  const takeSeat = () => {'), w.indexOf('  const onlineFrame = (now, dt) => {'));
  assert.match(take, /_seatOut = false; _seatLeft = false; _seatSaid = false;/, 'a seat taken back is lost afresh next time');
  assert.match(take, /online\?\.resume\(\);/);
  assert.match(take, /link\.resume\(\{ claim: room === SOCIAL_ROOM \}\);\n\s*if \(room\) link\.join\(room\);/, 'the hub\'s link claims the seat back');
  assert.match(take, /seatLock\?\.claim\(\);/, 'and the browser\'s other tabs are told');
  assert.match(w, /earning: \(\) => !!online && !seatOut\(\),/, 'a tab out of the seat earns no Renown');
  assert.match(w, /here: seatOut\(\) \? \{ label: PLAY_HERE_LABEL, run: takeSeat \} : null,/, 'the way back, drawn');
  assert.match(w, /const chatRegionFrame = \(now\) => \{\n\s*if \(seatOut\(\)\) return;/, 'no region said while out');
  assert.ok(SEAT_NOTICE.includes(PLAY_HERE_LABEL) && SEAT_MID_TEXT.length < 60);
});

// ── AUDIT ONESEAT (2026-09-27, Mac: "Audit this") ───────────────────────────────────────────────────────────────────
// Four lenses read ONE-SEAT (the relay, the session and the browser's lock, the host and the button, the pins and the
// record), each reproducing what it reported; every finding pinned here was verified before it was fixed.
// bible/01-Overview/Audit-OneSeat.md is the record.

test('AUDIT ONESEAT R1: a seat that MOVES is not a drain - a claim that closes the lone holder of the hub keeps its party and a stranger\'s, and so does a lone player\'s reconnect over its own socket; a room that did drain still sweeps (mutants: the moved seat not asked before the sweep; the sweep never run)', async () => {
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const r = fakeRoom(SOCIAL_ROOM);
    const social = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
    const lastOf = (ws, k) => ws.sent.filter((f) => f.t === 'social' && f.k === k).at(-1) ?? null;
    const hello = async (id, sub, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, null, { name: sub, tokenSub: sub, acct: `acct-${sub}`, asecret: `secret-of-acct-${sub}`, ...extra }); clock += 10; return ws; };
    const partyOf = async (a, b, peer) => { await social(a, { k: 'party.invite', peer }); clock += 600; await social(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); clock += 600; return a.att.party; };
    const me = await hello('tab-p1', 'player-p', { cl: 1 }), friend = await hello('tab-f1', 'player-f', { cl: 1 });
    const g = await hello('tab-g1', 'player-g', { cl: 1 }), h = await hello('tab-h1', 'player-h', { cl: 1 });
    const mine = await partyOf(me, friend, 'tab-f1'), theirs = await partyOf(g, h, 'tab-h1');
    for (const ws of [friend, g, h]) { await r.drop(ws); clock += 600; }   // everyone else steps away - their seats kept PARTY_OFFLINE_MS
    assert.ok(r.store.has(`party:${mine}`) && r.store.has(`party:${theirs}`));
    const me2 = await hello('tab-p2', 'player-p', { cl: 1 });   // I go on in a second tab: its claim closes the hub's only other socket
    assert.deepEqual(me.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE });
    assert.ok(r.store.has(`party:${mine}`), 'my party stands');
    assert.equal(lastOf(me2, 'state')?.party?.id, mine, 'and the tab I went on in sits in it');
    assert.ok(r.store.has(`party:${theirs}`), 'and a stranger\'s is not swept by my tab switch');
    const again = await hello('tab-p2', 'player-p');   // alone again, and my connection blips: its reconnect replaces its old socket
    assert.deepEqual(me2.closed, { code: CLOSE_REPLACED, reason: 'replaced' });
    assert.ok(welcomed(again) && r.store.has(`party:${mine}`) && r.store.has(`party:${theirs}`), 'a reconnect is not a drain either');
    // the relay is deployed: every socket gone without a close heard, and the first hello finds an empty room - swept
    r.sockets.length = 0; r.wake();
    await hello('tab-q1', 'player-q', { cl: 1 });
    assert.equal(r.store.has(`party:${theirs}`) || r.store.has(`party:${mine}`), false, 'a drained hub still forgets its parties (SOC1)');
  } finally { Date.now = realNow; }
});

test('AUDIT ONESEAT R4: a socket the object closed never holds the seat - a runtime that lists it until its close completes does not turn the claimer\'s own reconnect away (mutants: the closed not asked; the reaped not asked)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const lingering = (ws) => { ws.close = function (code, reason) { this.closed = { code, reason }; }; return ws; };   // closed by the object, still listed
  const phone = lingering(r.connect());
  await r.hello(phone, 'tab-phone', null, { tokenSub: 'player-1', cl: 1 });
  const desk = lingering(r.connect());
  await r.hello(desk, 'tab-desk', null, { tokenSub: 'player-1', cl: 1 });
  assert.deepEqual(errorsOf(phone), [SEAT_ELSEWHERE], 'the phone is told, and closed');
  assert.ok(phone.closed && r.sockets.includes(phone), 'and still listed');
  await r.drop(desk);   // the desk's own network blips
  const back = r.connect();
  await r.hello(back, 'tab-desk', null, { tokenSub: 'player-1' });
  assert.equal(back.closed, null, 'the desk keeps the seat across its own reconnect');
  assert.ok(welcomed(back));
  // and one closed by the object and not yet reaped (a send that failed while no door was open) holds nothing either
  const lone = fakeRoom(SOCIAL_ROOM);
  const held = lingering(lone.connect());
  await lone.hello(held, 'tab-a', null, { tokenSub: 'player-2', cl: 1 });
  held.close(1011, 'send failed'); lone.room._dead.add(held);
  const other = lone.connect();
  await lone.hello(other, 'tab-b', null, { tokenSub: 'player-2' });
  assert.equal(other.closed, null, 'the seat is free');
});

test('AUDIT ONESEAT T7: a claim refused for its own fault (\'id taken\') closes nobody - the claim is made after the refusals asked before anything is written (mutant: the claim before the id\'s secret)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const holder = r.connect(), stranger = r.connect(), squat = r.connect();
  await r.hello(holder, 'tab-a', null, { tokenSub: 'player-1', cl: 1 });
  await r.hello(stranger, 'tab-b', null, { tokenSub: 'player-2', cl: 1 });
  await r.hello(squat, 'tab-b', null, { tokenSub: 'player-1', cl: 1, secret: 'not-the-secret-of-tab-b' });
  assert.deepEqual(errorsOf(squat), ['id taken']);
  assert.equal(holder.closed, null, 'the player\'s tab stands');
  assert.equal(stranger.closed, null);
});

test('AUDIT ONESEAT H1: a press on "Play online here" is the panel\'s - pointerdown, mousedown, click and touchstart stop at the button, as the Chat, Show and Social buttons\' do, so the game never reads it as Mouse0 (the readied spell cast, the centre used) (mutant: the press not swallowed)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  const panel = createChatPanel({ log: new ChatLog(), onSend: () => true, doc, win, overlay: () => false });
  const [here] = find(doc.body, 'dfchat-here');
  let ran = 0;
  panel.render({ status: `World: ${SEAT_TEXT}`, here: { label: PLAY_HERE_LABEL, run: () => { ran++; } } });
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) {
    let stopped = 0;
    for (const fn of here.listeners.get(t) ?? []) fn({ type: t, target: here, preventDefault() {}, stopPropagation() { stopped++; } });
    assert.ok(stopped > 0, `${t} stops at the button`);
  }
  assert.equal(ran, 1, 'the click alone takes the seat');
  panel.destroy();
});

test('AUDIT ONESEAT T6: "Play online here" is not the chat\'s to hide - it stands on the panel\'s root under the status line (never in the box, shut unless the chat is open), a hidden chat still draws it, and no Hide rule names it (mutants: off the root; hidden with the chat, in the render or by a rule)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  const panel = createChatPanel({ log: new ChatLog(), onSend: () => true, doc, win, overlay: () => false });
  const [root] = find(doc.body, 'dfchat'), [status] = find(doc.body, 'dfchat-status'), [here] = find(doc.body, 'dfchat-here');
  assert.equal(here.parent, root, 'on the root');
  assert.equal(root.children.indexOf(here), root.children.indexOf(status) + 1, 'right under the line that says why');
  panel.setHidden(true);
  panel.render({ status: `World: ${SEAT_TEXT}`, here: { label: PLAY_HERE_LABEL, run: () => {} } });
  assert.equal(root.dataset.hidden, '1');
  assert.equal(here.className, 'dfchat-here on', 'a hidden chat still draws it');
  for (const rule of CHAT_CSS.split('}')) if (rule.includes('data-hidden')) assert.ok(!rule.includes('dfchat-here'), `no Hide rule names it: ${rule.trim()}`);
  panel.setHidden(false);
  panel.destroy();
});

test('AUDIT ONESEAT H2, the session: resume() is only a superseded session\'s - a live one keeps its socket, its status and its sends, and arms no claim on a seat it holds (mutant: resume over a live session)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = hub(FakeWS, clock);
  s.join(SOCIAL_ROOM);
  await sockets[0].onopen();
  sockets[0].receive({ t: 'welcome', id: 'tab-0001', peers: [], n: 1, v: RELAY_VERSION, now: clock.t });
  assert.equal(s.status, 'open');
  s.resume({ claim: true });
  assert.equal(s.status, 'open', 'never written "closed" over an open socket - every send would be refused');
  assert.equal(s.claim, false);
  assert.equal(sockets[0].closed, null);
  s.join(SOCIAL_ROOM);
  assert.equal(sockets.length, 1, 'the same room, the same socket');
});

test('AUDIT ONESEAT C1: a claim speaks for CLAIM_TTL_MS - within it a retry still claims (the hub never welcomed the first), past it the hello is a reconnect, so a first hello that never reached the hub (no network, a lid shut) does not take the seat from a tab the player opened after it (mutant: the claim a standing order)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = hub(FakeWS, clock);
  s.claim = true;
  s.join(SOCIAL_ROOM);
  await sockets[0].onopen();
  assert.equal(hellos(sockets[0])[0].cl, 1, 'the tab going online claims');
  sockets[0].drop(1006);
  clock.t += BACKOFF_MAX_MS;
  s.tick();
  await sockets[1].onopen();
  assert.equal(hellos(sockets[1])[0].cl, 1, 'a retry inside the claim\'s life is still the player\'s act');
  sockets[1].drop(1006);
  clock.t += BACKOFF_MAX_MS * 2;
  assert.ok(clock.t - 1000 > CLAIM_TTL_MS);
  s.tick();
  await sockets[2].onopen();
  assert.equal('cl' in hellos(sockets[2])[0], false, 'past it: a reconnect, refused while another tab holds the seat');
  assert.equal(s.claim, false);
  s.claim = true;   // Play online here (resume) - a new act, a new claim
  assert.equal(s.claim, true);
});

test('AUDIT ONESEAT C4/T5: over the RUNTIME\'s BroadcastChannel (which delivers later, as a browser\'s does - the suite\'s fake delivered inside the post and hid it), two tabs that claim before either hears the other leave exactly one holding the seat; a press in the same millisecond still takes it; and a claim that crossed a newer one is answered, not obeyed (mutants: no stamp asked; the older not answered; the stamp the clock alone)', async () => {
  const BC = globalThis.BroadcastChannel;
  assert.equal(typeof BC, 'function');
  const settle = () => new Promise((res) => setTimeout(res, 25));
  const opened = [];
  const lock = (name, nonce, lost, key) => { const l = createSeatLock({ Channel: BC, name, nonce, now: () => 5000, onLost: () => { lost[key]++; } }); opened.push(l); return l; };
  try {
    // two tabs, both online at once: each claims before the other's word arrives
    let lost = { a: 0, b: 0 }, name = `dagger.test.seat.${process.pid}.1`;
    let a = lock(name, 'n-2', lost, 'a'), b = lock(name, 'n-1', lost, 'b');
    a.claim(); b.claim();
    await settle();
    assert.equal(Number(a.held) + Number(b.held), 1, 'one tab holds the seat - two had given it up');
    assert.equal(lost.a + lost.b, 1);
    // Play online here in the tab that lost, in the same millisecond (the clock stands still): it takes the seat
    const [out, holder] = a.held ? [b, a] : [a, b];
    out.claim();
    await settle();
    assert.equal(out.held, true, 'the newer press holds');
    assert.equal(holder.held, false);
    // a tab whose channel opened after the holder's claim never heard it: the holder answers its claim with its own
    lost = { a: 0, b: 0 }; name = `dagger.test.seat.${process.pid}.2`;
    a = lock(name, 'n-2', lost, 'a');
    a.claim();
    await settle();
    b = lock(name, 'n-1', lost, 'b');   // the same instant, a lower nonce: the tie is a's
    b.claim();
    await settle();
    assert.deepEqual([a.held, b.held], [true, false], 'one seat, not two');
    assert.deepEqual(lost, { a: 0, b: 1 });
  } finally { for (const l of opened) l.close(); }
});

/** AUDIT ONESEAT T1: THE HOST'S SEAT, RUN - seatOut, renownAdopt, leaveSeat, seatLostNow, takeSeat and the frame's
 *  seat branch, lifted VERBATIM out of world.js (the audit24 waves' way) and run over stubs that write down what they
 *  are asked, in order. A text pin could not tell a line commented out, moved or skipped from a live one. */
function seatHost({ publishThrows = false, duelThrows = false, court = null } = {}) {
  const w = rd('src/scenes/world.js');
  const cut = (from, to) => { const a = w.indexOf(from), b = w.indexOf(to, a + from.length); assert.ok(a > 0 && b > a, from); return w.slice(a, b); };
  const log = [];
  const session = (name, room) => ({
    room, superseded: false,
    supersede() { log.push(`${name} out`); this.superseded = true; this.room = null; },
    resume({ claim = false } = {}) { log.push(`${name} resumed${claim ? ', claiming' : ''}`); this.superseded = false; },
    join(r) { log.push(`${name} joins ${r}`); this.room = r; },
  });
  const rooms = { world: SOCIAL_ROOM, region: 'chat:region.3', trade: null };   // a tab whose room waits for the region
  const deps = {
    online: session('presence', 'dungeon:m123'), chatLinks: new Map(Object.keys(rooms).map((k) => [k, session(k, rooms[k])])),
    chatLog: { tab: (id) => ({ room: rooms[id] ?? null }) }, SOCIAL_ROOM,
    seatLock: { release: () => log.push('lock released'), claim: () => log.push('lock claimed') },
    handOverFoes: () => { log.push('foes handed'); return 0; }, handOverRoomFoes: () => 0,
    worldPublish: (now, force) => { log.push(`last word${force ? ', final' : ''}`); if (publishThrows) throw new TypeError("Cannot read properties of undefined (reading 'records')"); },
    duelLeaveNow: () => { log.push('duel ended'); if (duelThrows) throw new Error('no duel was built'); },
    exteriorFoes: { clearPuppets: () => log.push('puppets gone') }, modes: { clearOwnPuppets: () => log.push('own puppets gone'), gateArenaDay: () => court },
    camps: { sweepOwners: (alive) => log.push(`camps kept for ${alive.size}`) }, hcc: { pruneKept: (list) => log.push(`kept teams for ${list.length} rooms`) },
    setSigilOnline, setSigilRenown, setRenownLayer: (e, level) => log.push(`renown layer ${level}`), playerEntity: { name: 'Mac' }, renownNow: 12, onlineOn: true,
    computeEntityMods: () => log.push('set tiers folded'),   // SET3 (main's): the sets' stat fold, as a Renown rise runs it
    ejectFromCourt: (t) => log.push(`cast out: ${t}`), COURT_TEXT: { lost: 'the fight is lost' },
    chatNotice: (t) => log.push(`said: ${t}`), SEAT_NOTICE, setMidScreenText: (t) => log.push(`over the screen: ${t}`), SEAT_MID_TEXT,
    peerBodies: { destroy: () => log.push('bodies gone') }, remotePlayers: { sync: (list) => log.push(`players ${list.length}`) }, onlineToScene: null,
    peerRiders: { destroy: () => log.push('riders gone') }, peerWalkers: { destroy: () => log.push('walkers gone') }, peerCandlesFrame: (list) => log.push(`candles ${list.length}`),
    PLAY_HERE_LABEL,
  };
  const body = `let { ${Object.keys(deps).join(', ')} } = deps;
    let _seatOut = false, _seatLeft = false, _seatSaid = false, _foesRoom = 'dungeon:m123';
    ${cut('  const seatOut = () =>', '\n')}
    ${cut('  const renownAdopt = (level) => {', '  const adoptIssued = ')}
    ${cut('  const leaveSeat = (now) => {', '  const onlineFrame = (now, dt) => {')}
    const seatFrame = (now, dt) => {
${cut('    if (seatOut()) {\n      if (!_seatLeft) leaveSeat(now);', '    // AUDIT ONLINE D12: the dead broadcast nothing and see no one')}      return 'online';
    };
    return { seatOut, renownAdopt, seatLostNow, takeSeat, seatFrame, flags: () => ({ _seatLeft, _seatSaid, _foesRoom, renownNow }) };`;
  const quiet = { info() {}, warn: (...a) => log.push(`warned: ${a.join(' ')}`), error: (...a) => log.push(`error: ${a[0]}`) };
  // eslint-disable-next-line no-new-func
  const host = new Function('deps', 'performance', 'console', body)(deps, { now: () => 5000 }, quiet);
  return { host, log, deps };
}

test('AUDIT ONESEAT H2/H3/H5/H6/T1, the host run: the seat lost is left ONCE - my foes handed and the room\'s last word said, a duel ended while the socket stands, every session marked, the puppets gone, the others\' camps and kept teams gone, the sigil and the Renown layer off - and ALL of it though the last word THROWS; the frame draws nobody and says it once; Play online here puts it all back, each link by its tab\'s room and the hub\'s claiming (mutants: each line)', () => {
  _resetSigilForTests();
  try {
    setSigilOnline(true); setSigilRenown(12);   // the page plays online, its Renown known
    const sword = { name: 'Longsword', group: 'Weapons', sigil: { power: 6, party: 1, xp: 100 } };
    const { host, log, deps } = seatHost({ publishThrows: true, duelThrows: true });
    assert.equal(host.seatFrame(1000, 16), 'online', 'in the seat, the frame goes on');
    assert.deepEqual(log, []);
    host.seatLostNow();   // the hub's close or the browser's word, as it arrives
    assert.deepEqual(log, [
      'foes handed', 'last word, final', "error: [online] the seat's last word could not be said - leaving anyway:",   // H2: contained
      'duel ended',   // H6: while the socket stands - its throw contained too
      'presence out', 'world out', 'region out', 'trade out',
      'puppets gone', 'own puppets gone',
      'camps kept for 0', 'kept teams for 0 rooms',   // H5
      'renown layer null', 'set tiers folded',   // H3 - and the sets sleep with the sigils (main's SET3, at the merge)
      'lock released',
    ]);
    assert.equal(sigilOnline(), false, 'H3: the sigils sleep - a weapon won here is won offline');
    assert.equal(drinkSigil(sword, 300), null);
    assert.equal(sword.sigil.xp, 100, 'and the sigil in hand drinks nothing');
    assert.deepEqual(host.flags(), { _seatLeft: true, _seatSaid: false, _foesRoom: null, renownNow: 12 });
    log.length = 0;
    host.seatLostNow();
    assert.deepEqual(log, [], 'left once, whoever asks again');
    assert.equal(host.seatFrame(1016, 16), undefined, 'the frame returns before anything is sent');
    assert.deepEqual(log, [`said: ${SEAT_NOTICE}`, `over the screen: ${SEAT_MID_TEXT}`, 'bodies gone', 'players 0', 'riders gone', 'walkers gone', 'candles 0']);
    log.length = 0;
    host.seatFrame(1032, 16);
    assert.deepEqual(log, ['bodies gone', 'players 0', 'riders gone', 'walkers gone', 'candles 0'], 'said once, nobody drawn every frame');
    // a Renown rise heard while out waits for Play online here
    log.length = 0;
    assert.equal(host.renownAdopt(14), 14);
    assert.deepEqual(log, ['set tiers folded'], 'no layer while out (the sets fold asleep)');
    assert.equal(sigilRenown(), null);
    log.length = 0;
    host.takeSeat();
    assert.deepEqual(log, ['renown layer 14', 'set tiers folded', 'presence resumed', 'world resumed, claiming', `world joins ${SOCIAL_ROOM}`, 'region resumed', 'region joins chat:region.3', 'trade resumed', 'lock claimed']);
    assert.equal(sigilOnline(), true, 'online again');
    assert.equal(sigilRenown(), 14);
    assert.equal(host.seatOut(), false);
    log.length = 0;
    host.takeSeat();
    assert.deepEqual(log, [], 'a second press is nothing');
    // lost again: left afresh, and said afresh
    deps.online.room = 'dungeon:m123';
    host.seatLostNow();
    assert.ok(log.includes('presence out') && log.includes('foes handed'));
    log.length = 0;
    host.seatFrame(2000, 16);
    assert.equal(log[0], `said: ${SEAT_NOTICE}`);
  } finally { _resetSigilForTests(); }
});

test('AUDIT ONESEAT, the host run: a court\'s fighter is cast out on the first frame out, and a tab out of every room hands nothing and says no last word (the dead\'s own law)', () => {
  const { host, log, deps } = seatHost({ court: 3 });
  deps.online.room = null;
  host.seatLostNow();
  assert.ok(!log.includes('foes handed') && !log.some((l) => l.startsWith('last word')), 'no room, no word');
  assert.ok(log.includes('duel ended') && log.includes('presence out'));
  log.length = 0;
  host.seatFrame(1000, 16);
  assert.deepEqual(log.slice(0, 3), ['cast out: the fight is lost', `said: ${SEAT_NOTICE}`, `over the screen: ${SEAT_MID_TEXT}`]);
  _resetSigilForTests();
});

test('AUDIT ONESEAT H4: the page\'s exit save is never a tab\'s the seat was taken from - it is offline, and every slot of the character would be written over what the tab that has the seat saved (mutant: the seat not asked)', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf("  addEventListener('beforeunload', () => {\n    // AUDIT ONESEAT H4");
  assert.ok(at > 0);
  const body = w.slice(w.indexOf('{', at) + 1, w.indexOf('\n  });', at));
  const run = (out) => {
    const written = [];
    // eslint-disable-next-line no-new-func
    new Function('online', 'playerSpawned', 'seatOut', 'duelLeaveNow', 'modes', 'worldQuickSave', 'exitAutosaveNames', 'playerEntity', 'townTalk', 'DeathScreen', body)(
      {}, true, () => out, () => {}, { quickSaveNow: (n) => written.push(n), deathUp: () => false }, null, () => ['QuickSave', 'AutoSave', 'Before the crypt'], {}, { overlay: null }, class {});
    return written;
  };
  assert.deepEqual(run(true), [], 'out of the seat: nothing written');
  assert.deepEqual(run(false), ['QuickSave', 'AutoSave', 'Before the crypt'], 'in it: every slot of the character, as ONLINE-AUTOSAVE1 says');
});
