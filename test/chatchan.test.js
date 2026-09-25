// CHAT-CHAN (2026-09-23, the community arc): THE FOUR CHANNELS - kurkku: "Global chat that everyone everywhere sees /
// regional chat that everyone in the region can see (so players in Wayrest see messages from other players in Wayrest
// and so on) / party chat"; Addison Knox: "Roleplay chat channels (IC/OOC) keeps immersion intact by separating
// in-character dialogue from coordination chatter".
//
// Driven, not read: the relay's party fan over the real Room (test/fakeRoom.mjs), the wire's channel law, the session's
// gates over a fake socket, the log's shared line and its peek, earshot, the region's step, the command grammar, the
// two composed rosters and the panel over a fake document. The host's wiring is held by source at the end, where only
// source can see it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOCIAL_ROOM, CHAT_ROOMS, CHAT_REGION_COUNT, CHAT_REGION_PREFIX, CHAT_LINE_CHANNELS, CHAN_RELAY_MIN, PARTY_CHAT_ROOM_HZ_MAX, CHAT_ROOM_HZ_MAX,
  CHAT_HZ_MAX, CAST_BURST_MAX, chatRegionRoom, isChatRoom, isSocialRoom, relaySupportsChannels, parseClient, RELAY_VERSION, DROP_STRIKES_MAX,
} from '../src/net/wire.js';
import {
  ChatLog, CHAT_TABS, CHAT_SAY_RANGE, CHAT_PEEK, CHAT_REGION_HOLD_MS, isOocText, oocText, inEarshot, localLineHeard, nextRegionRoom,
  regionJoinedText, CHAN_OLD_RELAY_TEXT, partyNoteTab,
} from '../src/net/chat.js';
import { parseChatLine, CHANNEL_COMMANDS, HOST_COMMANDS, HELP_LINES, unknownCommandText, emptyCommandText, hostMisuseText } from '../src/net/chatCommands.js';
import { rosterRows, rosterTitle, partyRosterSource, localRosterSource } from '../src/net/roster.js';
import { OnlineSession } from '../src/net/online.js';
import { NAME_RANGE } from '../src/net/remotePlayers.js';
import { REGION_NAMES } from '../src/formats/mapsFile.js';
import { createChatPanel } from '../src/ui/chatPanel.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('CHAT-CHAN wire: one channel per politic region, whitelisted by enumeration; a line may name the party channel and nothing else; world102 is the first relay that routes either (world99 before the first merge, world101 before the sixth: main\'s world99, world100 and world101 route neither) (mutants: a region key off the end of the map; the whitelist a prefix test; an unknown channel falling through to the room; the version gate one high)', () => {
  assert.equal(CHAT_REGION_COUNT, REGION_NAMES.length, 'the politic map\'s regions, all of them - the channel a player joins is PlayerGPS.CurrentRegionIndex\'s');
  assert.equal(CHAT_REGION_COUNT, 62);
  assert.equal(chatRegionRoom(0), `${CHAT_REGION_PREFIX}0`);
  assert.equal(chatRegionRoom(61), 'chat:region.61');
  for (const bad of [-1, 62, 1.5, NaN, null, undefined, '3']) assert.equal(chatRegionRoom(bad), null, `no region ${String(bad)}`);
  for (let i = 0; i < CHAT_REGION_COUNT; i++) assert.ok(isChatRoom(chatRegionRoom(i)), `region ${i}'s channel is one the relay opens`);
  assert.equal(CHAT_ROOMS.size, 1 + CHAT_REGION_COUNT);
  for (const bad of ['chat:region.62', 'chat:region.-1', 'chat:region.01', 'chat:region.x', 'chat:party.q123']) assert.equal(isChatRoom(bad), false, `${bad}: a list, not a prefix (AUDIT CHAT A1)`);
  assert.ok(isSocialRoom(SOCIAL_ROOM) && !isSocialRoom(chatRegionRoom(4)), 'a region\'s channel is no hub: it keeps no seats');

  assert.deepEqual(CHAT_LINE_CHANNELS, ['party', 'guild']);   // GUILD1c: and a guild's line (test/guild1c.test.js)
  const hello = { hasHello: true };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'hi all' }), hello), { t: 'chat', text: 'hi all' }, 'a line naming no channel: the old shape, no key');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: ' hi party ', ch: 'party' }), hello), { t: 'chat', text: 'hi party', ch: 'party' });
  for (const ch of ['clan', 'world', '', null, 7, ['party']]) assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'hi', ch }), hello), { error: 'bad chat' }, `ch ${JSON.stringify(ch)}: refused whole - never quietly the room's line`);

  assert.equal(CHAN_RELAY_MIN, 102);
  assert.equal(relaySupportsChannels('world101'), false, 'DISC12\'s relay (the last before the arc) projects `{t:\'chat\', text}` and would fan a party line to everyone');
  assert.equal(relaySupportsChannels('world102'), true);
  assert.equal(relaySupportsChannels('world120'), true);
  for (const bad of [null, undefined, '', 'world', 'World102', 'world102x', 102]) assert.equal(relaySupportsChannels(bad), false);
  assert.ok(relaySupportsChannels(RELAY_VERSION), 'this build\'s own relay routes them');
  assert.ok(PARTY_CHAT_ROOM_HZ_MAX >= CHAT_ROOM_HZ_MAX, 'the parties\' budget is at least the room\'s: many small fans, not one of everyone');
  assert.match(CHAN_OLD_RELAY_TEXT, /server's next update/, 'a tab the relay cannot carry says why, in the player\'s words');
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

const chats = (ws) => ws.sent.filter((m) => m.t === 'chat');
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 600) => { clock += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  /** A hello with an account: peer `peer-<n><tab>`, account `acct-<n>` - a second tab of one account is another peer id. */
  const join = async (n, tab = '') => { const ws = r.connect(); await r.hello(ws, `peer-${n}${tab}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); tick(10); return ws; };
  const say = (ws, text, ch) => r.raw(ws, JSON.stringify(ch === undefined ? { t: 'chat', text } : { t: 'chat', text, ch }));
  try { await fn({ r, act, join, tick, say }); } finally { Date.now = realNow; }
}
async function partyOfTwo({ act, join, tick }) {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick();
  const pid = b.sent.filter((m) => m.t === 'social' && m.k === 'invite').at(-1).party;
  await act(b, { k: 'party.accept', party: pid }); tick();
  assert.equal(a.att.party, pid); assert.equal(b.att.party, pid); assert.equal(c.att.party ?? null, null);
  return { a, b, c, pid };
}

test('CHAT-CHAN relay: a party\'s line is heard by the party alone - every tab of each member, the sender\'s own echo the receipt - and a line naming no channel is everyone\'s as it always was (mutants: the party line fanned to the room; the sender left out of the fan; a stranger hearing it; the channel word dropped off the line)', () => withHub(async (h) => {
  const { a, b, c } = await partyOfTwo(h);
  const b2 = await h.join('b', '2');   // b's second tab: an account's every socket is the account's
  for (const ws of [a, b, c, b2]) ws.sent.length = 0;
  await h.say(a, 'to the party', 'party'); h.tick();
  for (const [ws, who] of [[a, 'a, the echo'], [b, 'b'], [b2, 'b\'s other tab']]) {
    assert.deepEqual(chats(ws).map((m) => [m.id, m.name, m.text, m.ch]), [['peer-a', 'a', 'to the party', 'party']], who);
  }
  assert.equal(chats(c).length, 0, 'c is in no party with a: nothing');
  await h.say(c, 'hello everyone'); h.tick();
  for (const ws of [a, b, c, b2]) assert.deepEqual(chats(ws).at(-1).text, 'hello everyone', 'a line naming no channel fans to the room');
  assert.equal(chats(c).at(-1).ch, undefined, 'and says no channel');
}));

test('CHAT-CHAN relay: a party line with no party to reach says nothing - from a stranger, from a seat gone since - and on any room but the hub it is junk, struck, the chat token it spent staying spent (mutants: a stranger\'s party line fanned to the room; the junk unstruck)', () => withHub(async (h) => {
  const { a, b, c } = await partyOfTwo(h);
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await h.say(c, 'am I in a party?', 'party'); h.tick();
  for (const ws of [a, b, c]) assert.equal(chats(ws).length, 0, 'no party: no one hears it, not even the room');
  await h.act(b, { k: 'party.leave' }); h.tick();
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await h.say(b, 'still here?', 'party'); h.tick();
  assert.equal(chats(a).length, 0, 'a seat left says nothing to the party it left');

  // a place room: the party line is junk - struck, and the chat token it spent stays spent. AUDIT ATTACH: the strike and
  // the chat bucket are two meters of one record, so neither write can undo the other (a stale attachment written back
  // over the chat gate's once refunded the token - CHAT-CHAN's own fix, a class that cannot recur)
  const r = fakeRoom('dungeon:m187');
  const realNow = Date.now; let clock = 2e12; Date.now = () => clock;
  try {
    const ws = r.connect(); await r.hello(ws, 'peer-z', null, { name: 'z' });
    const other = r.connect(); await r.hello(other, 'peer-y', null, { name: 'y' });
    other.sent.length = 0;
    await r.raw(ws, JSON.stringify({ t: 'chat', text: 'party?', ch: 'party' }));
    assert.equal(chats(other).length, 0, 'a place has no party to reach, and the room does not hear it either');
    assert.equal(ws.meters.junk, 1, 'struck');
    assert.deepEqual(ws.meters.cbucket, { tokens: CHAT_HZ_MAX - 1, at: clock }, 'and the chat gate\'s spend stands - the strike is a count beside the bucket, never a copy written back over it');
    await r.raw(ws, JSON.stringify({ t: 'chat', text: 'party?', ch: 'party' }));
    assert.equal(ws.meters.junk, 2);
    assert.deepEqual(ws.meters.cbucket, { tokens: CHAT_HZ_MAX - 2, at: clock }, 'every junk line pays its token');
    for (let i = 0; i < DROP_STRIKES_MAX + 2 && !ws.closed; i++) { clock += 1000; await r.raw(ws, JSON.stringify({ t: 'chat', text: 'party?', ch: 'party' })); }
    assert.ok(ws.closed, 'a stream of junk closes the socket, as any junk does');
  } finally { Date.now = realNow; }
}));

test('CHAT-CHAN relay: the parties\' budget is their own - a party line never spends the World channel\'s (AUDIT CHAT A2 priced that for a fan of everyone), so a busy party cannot silence the World and a busy World cannot silence a party (mutants: the party line charged to the room\'s budget; the party budget left unchecked)', () => withHub(async (h) => {
  const { a, b, c } = await partyOfTwo(h);
  // the World's budget spent to its floor by strangers, inside one instant
  const crowd = [];
  for (let i = 0; i < CHAT_ROOM_HZ_MAX + 2; i++) crowd.push(await h.join(`x${i}`));
  for (const ws of [a, b, c]) ws.sent.length = 0;
  for (const ws of crowd) await h.say(ws, 'spam');
  const worldHeard = chats(c).length;
  assert.ok(worldHeard <= CHAT_ROOM_HZ_MAX && worldHeard > 0, `the room's budget holds the World: ${worldHeard}`);
  await h.say(a, 'still there?', 'party');
  assert.equal(chats(b).at(-1).text, 'still there?', 'and the party\'s line goes regardless - its budget is its own');
  assert.equal(chats(c).filter((m) => m.ch === 'party').length, 0);
  const src = rd('server/src/index.js');
  const arm = src.slice(src.indexOf('async _sayLine(ws, a, ch, frame, now) {'), src.indexOf('  _junk(ws, a) {'));   // DICE1: the chat's and the roll's one fan
  assert.match(arm, /tokenGate\(this\._partyChat, now, PARTY_CHAT_ROOM_HZ_MAX\)/, 'the parties\' own budget, spent in the party arm');
  assert.ok(arm.indexOf("if (ch === 'party')") >= 0 && arm.indexOf("if (ch === 'party')") < arm.indexOf('tokenGate(this._roomChat'), 'and the room\'s is spent only after the party arm has returned');
}));

test('CHAT-CHAN relay: the parties\' own budget HOLDS - eight seats at three tabs each, two lines a tab inside one instant, and the hub fans PARTY_CHAT_ROOM_HZ_MAX of them and drops the rest without a strike (mutants: the party budget left unchecked)', () => withHub(async (h) => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'k'];
  const first = [];
  for (const n of names) first.push(await h.join(n));
  for (const n of names.slice(1)) { await h.act(first[0], { k: 'party.invite', peer: `peer-${n}` }); h.tick(); }
  const pid = first[0].att.party;
  for (let i = 1; i < names.length; i++) { await h.act(first[i], { k: 'party.accept', party: pid }); h.tick(); }
  const tabs = [...first];
  for (const n of names) for (const t of ['2', '3']) tabs.push(await h.join(n, t));
  assert.ok(tabs.every((ws) => ws.att.party === pid), 'every tab of every seat sits in the party');
  h.tick(5000);
  for (const ws of tabs) ws.sent.length = 0;
  for (const ws of tabs) for (let i = 0; i < CHAT_HZ_MAX; i++) await h.say(ws, `line ${i}`, 'party');
  assert.ok(tabs.length * CHAT_HZ_MAX > PARTY_CHAT_ROOM_HZ_MAX, 'more said than the budget');
  for (const ws of [tabs[0], tabs.at(-1)]) assert.equal(chats(ws).length, PARTY_CHAT_ROOM_HZ_MAX, 'the budget, fanned whole to every tab');
  assert.ok(tabs.every((ws) => !ws.closed && (ws.meters.cdrops ?? 0) === 0), 'a line over the budget is dropped, and nobody is struck for it');
}));

// ─── THE SESSION ────────────────────────────────────────────────────────────────────────────────────────────────

function hubLink(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => t });
  const heard = []; s.onChat = (line) => heard.push(line);
  quiet(() => s.join(SOCIAL_ROOM));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'chat');
  return { s, ws, heard, out, tick: (ms) => { t += ms; } };
}

test('CHAT-CHAN session: a party line goes only to a relay that routes it (the welcome\'s version), names its channel on the wire, and a channel the wire does not know is refused at home; a line coming in carries the relay\'s channel word, or none (mutants: the gate on the version dropped; `ch` sent on a plain line; an unknown channel sent; a forged channel word believed)', () => {
  const old = hubLink('world100');
  assert.equal(old.s.chanOk, false);
  assert.equal(old.s.sendChat('psst', { ch: 'party' }), false, 'world100 would fan it to everyone online');
  assert.equal(old.out().length, 0, 'nothing on the wire');
  assert.equal(old.s.sendChat('hello all'), true, 'the World line is untouched');

  const { s, heard, out, ws } = hubLink();
  assert.equal(s.chanOk, true);
  assert.equal(s.sendChat('  psst  ', { ch: 'party' }), true);
  assert.deepEqual(out().at(-1), { t: 'chat', text: 'psst', ch: 'party' }, 'sanitized, and the channel named');
  assert.equal(s.sendChat('clan line', { ch: 'clan' }), false, 'no such channel: refused at home, never sent for the relay to close on');
  assert.deepEqual(Object.keys(out().at(-1)), ['t', 'text', 'ch']);
  quiet(() => ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'b', text: 'on my way', at: 5, ch: 'party' }));
  quiet(() => ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'b', text: 'clan?', at: 6, ch: 'clan' }));
  quiet(() => ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'b', text: 'world', at: 7 }));
  assert.deepEqual(heard.map((l) => [l.text, l.ch]), [['on my way', 'party'], ['clan?', null], ['world', null]], 'the relay\'s word, one of the wire\'s own, or none');
});

test('CHAT-CHAN session: the party lines coming in have their OWN gate - an honest hub at the World\'s full budget and the parties\' at once passes whole - and the cast\'s bucket is no longer the chat\'s (mutants: party lines on the room\'s bucket; a heal cast spending a chat token, which Local chat on the presence session made real)', () => {
  const { heard, ws } = hubLink();
  for (let i = 0; i < CHAT_ROOM_HZ_MAX; i++) ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'b', text: `w${i}`, at: i });
  for (let i = 0; i < CHAT_ROOM_HZ_MAX; i++) ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'b', text: `p${i}`, at: i, ch: 'party' });
  assert.equal(heard.length, 2 * CHAT_ROOM_HZ_MAX, 'both budgets at their full tilt, and not a line dropped');
  let dropped = 0;
  quiet(() => { for (let i = 0; i < PARTY_CHAT_ROOM_HZ_MAX; i++) { const n = heard.length; ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'b', text: 'flood', at: 1, ch: 'party' }); if (heard.length === n) dropped++; } });
  assert.ok(dropped > 0, 'past the parties\' budget a dishonest relay\'s party lines are dropped');

  // the presence session: a chat line and a cast each spend their own bucket
  const { FakeWS, sockets } = fakeSocketClass();
  const t = 5_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  quiet(() => s.join('dungeon:m187', { x: 1, y: 0, z: 1, yaw: 0 }));
  sockets[0].open();
  quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: RELAY_VERSION }));
  const fx = { type: 10, subType: 8, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 };
  const cast = { to: 'peer-0002', level: 5, spell: { name: 'Heal', element: 4, rangeType: 1, effects: [fx] } };
  for (let i = 0; i < CAST_BURST_MAX; i++) assert.equal(s.sendCast(cast), true, `cast ${i}`);
  for (let i = 0; i < CHAT_HZ_MAX; i++) assert.equal(s.sendChat(`said ${i}`), true, `a whole blast cast, and the chat still has its own ${CHAT_HZ_MAX}`);
  assert.equal(s.sendCast(cast), false, 'and the casts\' own bucket is empty, chat or no chat');
  const src = rd('src/net/online.js');
  assert.match(src, /const gate = castGate\(this\._castBucket, this\._now\(\)\);/);
  assert.match(src, /const gate = chatGate\(this\._cbucket, this\._now\(\)\);/);
});

// ─── THE LOG ────────────────────────────────────────────────────────────────────────────────────────────────────

test('CHAT-CHAN log: a line the game says goes on EVERY tab as ONE line - peeked once, counted once, unread on the active tab alone - and a player\'s aside in (( )) is drawn as one on any tab, never a line nobody spoke (mutants: pushAll one line per tab; the unread counted on every tab; the peek not deduplicated; the mark read anywhere in the line; a notice drawn as an aside)', () => {
  let clock = 10_000;
  const log = new ChatLog({ now: () => clock });
  const v0 = log.version;
  const n = log.pushAll({ text: 'The server is restarting.' });
  assert.ok(log.version > v0);
  assert.equal(n.system, true, 'the game\'s, whatever the caller said');
  assert.equal(n.tab, null, 'said on no one tab');
  for (const tab of log.tabs) assert.equal(tab.messages.at(-1), n, `the same line object on ${tab.id}`);
  assert.deepEqual(log.tabs.map((t) => t.unread), [1, 0, 0, 0, 0], 'unread where the player reads - the active tab');   // GUILD1c: five tabs
  assert.equal(log.unreadTotal(), 1, 'the Chat button counts the line that arrived, not the line times the tabs');
  assert.equal(log.peek().length, 1, 'the peek draws it once');
  assert.equal(log.pushAll({ text: '' }), null, 'nothing to say: nothing kept');
  assert.equal(log.pushAll({ text: 'red', red: true }).red, true);
  log.setOpen(true);
  log.pushAll({ text: 'read at once' });
  assert.equal(log.unreadTotal(), 0, 'open: read as it arrives');

  const aside = log.push('local', { id: 'b', name: 'B', text: '  ((brb, the door))' });
  assert.equal(aside.kind, 'ooc');
  assert.equal(log.push('world', { id: 'b', name: 'B', text: '((lag))' }).kind, 'ooc', 'the mark is the speaker\'s on any tab');
  assert.equal(log.push('local', { id: 'b', name: 'B', text: 'Well met. ((afk soon))' }).kind, '', 'a line that only ends in one is said in character');
  assert.equal(log.push('local', { id: 'b', name: 'B', text: 'hi', kind: 'ooc' }).kind, '', 'never off a field: the text decides');
  assert.equal(log.pushAll({ text: '((a notice))' }).kind, '', 'a line nobody spoke is no aside');
  assert.equal(aside.tab, 'local', 'the tab it was said on rides the line');
  assert.equal(isOocText('((x'), true); assert.equal(isOocText('( (x'), false); assert.equal(isOocText(null), false);
  assert.equal(oocText('  brb  '), '((brb))');
});

test('CHAT-W log: the peek is the open tab\'s and the party\'s - a World line never stands over a player reading Region (Mac: "Messages sent in world chat shouldnt carry over to region chat"), a party\'s "help" still cannot wait on a badge while the Party tab is on the bar, the game\'s notice is every tab\'s, in the order heard, the last CHAT_PEEK of them (mutants: every tab peeked; the party dropped from the peek; a tab off the bar peeked)', () => {
  let clock = 10_000;
  const log = new ChatLog({ now: () => clock });
  const texts = () => log.peek().map((p) => p.line.text);
  log.push('world', { id: 'a', name: 'A', text: 'w1' });
  log.push('party', { id: 'b', name: 'B', text: 'help!' });
  log.push('local', { id: 'c', name: 'C', text: 'l1' });
  log.push('region', { id: 'd', name: 'D', text: 'r1' });
  log.push('world', { id: 'a', name: 'A', text: 'w2' });
  assert.deepEqual(texts(), ['w1', 'w2'], 'the World tab\'s own - the Party tab is off the bar outside a party (CHAT-P)');
  log.setShown('party', true);
  assert.deepEqual(texts(), ['w1', 'help!', 'w2'], 'a party\'s line is said to the player, whatever tab they read');
  log.select('region');
  assert.deepEqual(texts(), ['help!', 'r1'], 'reading Region: no World line and no Local line stands over the world');
  log.pushAll({ text: 'The server is restarting.' });
  assert.deepEqual(texts(), ['help!', 'r1', 'The server is restarting.'], 'the game\'s notice is every tab\'s');
  for (let i = 0; i < CHAT_PEEK; i++) log.push('region', { id: 'd', name: 'D', text: `r${i + 2}` });
  assert.deepEqual(texts(), Array.from({ length: CHAT_PEEK }, (_, i) => `r${i + 2}`), 'the newest CHAT_PEEK of what it draws');
});

test('CHAT-P log: the Party tab starts off the bar, is put on and taken off by the host, cannot be selected while off, counts no unread while off, and taking it off the front hands the front to the first tab on the bar - read at once when the chat is open (mutants: the Party tab shown from the start; select into a hidden tab; the front left on a hidden tab; the hidden count on the badge)', () => {
  const log = new ChatLog({ now: () => 1 });
  assert.deepEqual(log.tabs.map((t) => [t.id, t.shown]), [['world', true], ['region', true], ['party', false], ['guild', false], ['local', true]]);   // GUILD1c: the Guild tab starts off the bar too
  assert.equal(log.select('party'), false, 'off the bar: not to the front');
  log.push('party', { id: 'b', name: 'B', text: 'early' });
  assert.equal(log.unreadTotal(), 0, 'a count on a tab nobody can see is on no badge');
  const v = log.version;
  assert.equal(log.setShown('party', true), true);
  assert.ok(log.version > v, 'the panel repaints the bar');
  assert.equal(log.setShown('party', true), false, 'the same answer again changes nothing');
  assert.equal(log.unreadTotal(), 1);
  assert.equal(log.select('party'), true);
  log.setOpen(true);
  log.push('world', { id: 'a', name: 'A', text: 'meanwhile' });
  assert.equal(log.setShown('party', false), true);
  assert.equal(log.active, 'world', 'the front goes to the first tab on the bar');
  assert.equal(log.tab('world').unread, 0, 'and the open chat reads it');
  assert.equal(log.tab('party').unread, 0);
  assert.equal(log.tab('party').messages.length, 1, 'the history stays');
});

test('CHAT-P notes: a party\'s news lands on the Party tab only while the player sits in one; outside a party, and the note that ends their own seat, land on the tab the host names (mutants: every party note on the Party tab; the removal on the Party tab; a friend note on the Party tab)', () => {
  const inParty = { party: { id: 'p1' }, acct: 'me' };
  const alone = { party: null, acct: 'me' };
  assert.equal(partyNoteTab({ code: 'party.joined', acct: 'b' }, inParty, 'world'), 'party');
  assert.equal(partyNoteTab({ code: 'party.kicked', acct: 'b' }, inParty, 'world'), 'party', 'another member removed: the party\'s news');
  assert.equal(partyNoteTab({ code: 'party.kicked', acct: 'me' }, inParty, 'world'), 'world', 'my own removal: wherever I read, whatever order the frames came in');
  assert.equal(partyNoteTab({ code: 'party.declined', acct: 'b' }, alone, 'world'), 'world', 'no party: no Party tab to land on');
  assert.equal(partyNoteTab({ code: 'friend.added', acct: 'b' }, inParty, 'world'), 'world');
  const w = rd('src/scenes/world.js');
  assert.match(w, /social\.onNote = \(note, text\) => \{ if \(text\) chatLog\.push\(partyNoteTab\(note, social, tab\.id\), \{ text, system: true \}\); \};/);
  assert.match(w, /const chatFrame = \(\) => \{\s*if \(!chatLinks\) return;\s*buildPoll\(performance\.now\(\)\);\s*chatLog\.setShown\('party', !!social\?\.party\);/, 'the bar follows the party every frame');
});

test('CHAT-CHAN log: setRoom moves a tab\'s channel and names its PLACE, keeping the short label and the history; the same room again changes nothing (mutants: the label overwritten by the place; the history cleared; the version bumped on a no-op)', () => {
  const log = new ChatLog();
  log.push('region', { id: 'a', name: 'A', text: 'old region line' });
  const v = log.version;
  assert.equal(log.setRoom('region', 'chat:region.17', 'Wayrest'), true);
  const tab = log.tab('region');
  assert.deepEqual([tab.room, tab.place, tab.label], ['chat:region.17', 'Wayrest', 'Region']);
  assert.equal(tab.messages.length, 1, 'what was heard stays');
  assert.ok(log.version > v);
  const v2 = log.version;
  assert.equal(log.setRoom('region', 'chat:region.17', 'Wayrest'), false);
  assert.equal(log.version, v2);
  assert.equal(log.setRoom('nowhere', 'x', 'y'), false);
  assert.deepEqual(log.tabs.map((t) => t.link), [true, true, false, false, false], 'the World and Region tabs ride rooms of their own');   // GUILD1c: the Guild tab rides the hub's
  assert.equal(regionJoinedText('Wayrest'), 'Region channel: Wayrest.');
});

// ─── EARSHOT AND THE REGION ─────────────────────────────────────────────────────────────────────────────────────

test('CHAT-CHAN earshot: a Local line is kept from a body within CHAT_SAY_RANGE - the name\'s own range, in the ground\'s plane, between the two bodies - the player\'s own line always, and a speaker this host cannot place never (mutants: the range off the name\'s; the height counted; an unplaced speaker kept; my own line filtered)', () => {
  assert.equal(CHAT_SAY_RANGE, NAME_RANGE, 'whoever you can read over a head can hear you, and nobody further');
  const here = [0, 0, 0];
  assert.equal(inEarshot(here, [CHAT_SAY_RANGE, 0, 0]), true, 'at the range: heard');
  assert.equal(inEarshot(here, [CHAT_SAY_RANGE + 0.01, 0, 0]), false);
  assert.equal(inEarshot(here, [36, 500, 48]), true, 'a 36-48-60 triangle in the plane, whatever the height');
  assert.equal(inEarshot(here, [NaN, 0, 0]), false);
  assert.equal(inEarshot(null, [0, 0, 0]), false);
  const near = [{ id: 'bran', feet: [10, 0, 10] }, { id: 'zed', feet: [100, 0, 0] }];
  assert.equal(localLineHeard({ id: 'bran', text: 'hi' }, near, here), true);
  assert.equal(localLineHeard({ id: 'zed', text: 'hi' }, near, here), false, 'out of earshot');
  assert.equal(localLineHeard({ id: 'ghost', text: 'hi' }, near, here), false, 'a speaker this host cannot place is not near');
  assert.equal(localLineHeard({ id: 'ghost', text: 'hi' }, null, here), false, 'no room: nobody near');
  assert.equal(localLineHeard({ id: 'me', text: 'hi', mine: true }, null, null), true, 'my own line is the receipt');
});

test('CHAT-CHAN region: the Region tab joins the first region at once and a new one only after it has held CHAT_REGION_HOLD_MS - a walk along a border is not a churn of sockets (mutants: no hold; the first region held too; a flap back keeping the old wait)', () => {
  const hold = { room: null, since: 0 };
  assert.equal(nextRegionRoom(hold, 'chat:region.17', null, 0), 'chat:region.17', 'the first region at once');
  assert.equal(nextRegionRoom(hold, 'chat:region.17', 'chat:region.17', 10), null, 'where it is');
  assert.equal(nextRegionRoom(hold, 'chat:region.18', 'chat:region.17', 1000), null, 'a new region waits');
  assert.equal(nextRegionRoom(hold, 'chat:region.18', 'chat:region.17', 1000 + CHAT_REGION_HOLD_MS - 1), null);
  assert.equal(nextRegionRoom(hold, 'chat:region.17', 'chat:region.17', 1000 + CHAT_REGION_HOLD_MS - 1), null, 'stepped back over the border');
  assert.equal(nextRegionRoom(hold, 'chat:region.18', 'chat:region.17', 1000 + CHAT_REGION_HOLD_MS), null, 'and over again: the wait starts over');
  assert.equal(nextRegionRoom(hold, 'chat:region.18', 'chat:region.17', 1000 + 2 * CHAT_REGION_HOLD_MS), 'chat:region.18', 'held: joined');
  assert.equal(nextRegionRoom(hold, null, 'chat:region.18', 99_999), null, 'no region: stay');
});

// ─── THE COMMANDS ───────────────────────────────────────────────────────────────────────────────────────────────

test('CHAT-CHAN commands: a slash is a channel\'s command, the list, a host command, or refused in words - never said to a room (mutants: an unknown command said as a line; an alias missing; the /ooc wrap lost; // not escaping; case)', () => {
  assert.deepEqual(parseChatLine('hello there'), { kind: 'say', text: 'hello there' });
  assert.deepEqual(parseChatLine('  :)'), { kind: 'say', text: '  :)' }, 'a plain line as typed');
  assert.deepEqual(parseChatLine('//shrug'), { kind: 'say', text: '/shrug' }, 'a line that starts with a slash, said');
  for (const h of ['/help', '/?', '/HELP']) assert.deepEqual(parseChatLine(h), { kind: 'help' });
  const expect = { world: ['world', 'g'], region: ['region', 'r'], party: ['party', 'p'], local: ['local', 'l', 'say', 's'] };
  for (const [tab, names] of Object.entries(expect)) for (const n of names) {
    assert.deepEqual(parseChatLine(`/${n} hi there`), { kind: 'channel', tab, text: 'hi there', wrap: null }, `/${n}`);
    assert.deepEqual(parseChatLine(`/${n.toUpperCase()} hi`), { kind: 'channel', tab, text: 'hi', wrap: null }, `/${n.toUpperCase()}`);
    assert.deepEqual(parseChatLine(`/${n}`), { kind: 'empty', name: n });
  }
  assert.deepEqual(parseChatLine('/ooc brb'), { kind: 'channel', tab: 'local', text: 'brb', wrap: 'ooc' });
  for (const h of HOST_COMMANDS) assert.deepEqual(parseChatLine(`/${h} x`), { kind: 'host', name: h }, `/${h}: the host's own`);
  assert.deepEqual(parseChatLine('/pary hi'), { kind: 'unknown', name: 'pary' });
  assert.deepEqual(parseChatLine('/'), { kind: 'unknown', name: '' });
  assert.deepEqual(parseChatLine('/whisper Ann hi', [{ names: ['whisper'], parse: (rest) => ({ kind: 'whisper', rest }) }]), { kind: 'whisper', rest: 'Ann hi' }, 'a later slice\'s own table');
  assert.deepEqual(parseChatLine('/whisper', [{ names: ['whisper'], parse: () => null }]), { kind: 'unknown', name: 'whisper' }, 'a table that declines is no command');
  assert.deepEqual(parseChatLine('/roll 2d6', [{ names: ['roll'], parse: () => ({ kind: 'other' }) }]), { kind: 'roll', spec: { n: 2, m: 6, k: 0 } }, 'DICE1: /roll is the grammar\'s own, before any table');
  assert.equal(new Set(CHANNEL_COMMANDS.flatMap((c) => c.names)).size, CHANNEL_COMMANDS.flatMap((c) => c.names).length, 'no alias twice');
  assert.ok(CHANNEL_COMMANDS.every((c) => CHAT_TABS.some((t) => t.id === c.tab)), 'every command names a tab there is');
  assert.ok(CHANNEL_COMMANDS.every((c) => HELP_LINES.includes(c.help)), 'and /help says each');
  assert.equal(unknownCommandText('pary'), 'There is no /pary command. /help lists them.');
  assert.equal(emptyCommandText('p'), '/p needs something to say.');
  assert.equal(hostMisuseText('red'), '/red needs something to say.');
  assert.equal(hostMisuseText('unstuck'), '/unstuck takes nothing after it.');
});

// ─── THE ROSTERS ────────────────────────────────────────────────────────────────────────────────────────────────

test('CHAT-CHAN rosters: the Party tab lists my row and each mate online by the first tab they stand as, wearing the badge the hub knows; the Local tab those in earshot; each names what it is of (mutants: the earshot filter dropped; the label lost)', () => {
  const hub = { id: 'peer-a', name: 'Ann', title: null, glyphs: [], peers: new Map([['peer-b1', { id: 'peer-b1', name: 'Bob', title: 'Vetted', glyphs: [] }]]) };
  const party = { members: [
    { acct: 'acct-a', name: 'Ann', online: true, peers: ['peer-a'] },
    { acct: 'acct-b', name: 'Bob', online: true, peers: ['peer-b1', 'peer-b2'] },
    { acct: 'acct-c', name: 'Cid', online: false, peers: [] },
    { acct: 'acct-d', name: 'Dee', online: true, peers: ['peer-d'] },
  ] };
  const src = partyRosterSource(party, hub, 'acct-a');
  const rows = rosterRows(src);
  assert.deepEqual(rows.rows.map((r) => [r.id, r.name, r.me]), [['peer-a', 'Ann', true], ['peer-b1', 'Bob', false], ['peer-d', 'Dee', false]], 'me, and the mates online - one row a mate');
  assert.equal(rows.label, 'Party');
  assert.equal(rosterTitle(rows.total, rows.label), 'Party — 3');
  assert.equal(src.peers.get('peer-b1').title, 'Vetted', 'the badge the hub knows');
  assert.deepEqual(rosterRows(partyRosterSource(null, hub, 'acct-a')).rows.map((r) => r.id), ['peer-a'], 'no party: a list of one');

  const session = { id: 'peer-me', name: 'Me', peers: new Map([['near', { id: 'near', name: 'Near' }], ['far', { id: 'far', name: 'Far' }], ['unplaced', { id: 'unplaced', name: 'Ghost' }]]) };
  const near = [{ id: 'near', feet: [3, 0, 4] }, { id: 'far', feet: [500, 0, 0] }];
  const local = rosterRows(localRosterSource(session, near, [0, 0, 0]));
  assert.deepEqual(local.rows.map((r) => r.name), ['Me', 'Near'], 'those who would hear a line said now');
  assert.equal(local.label, 'Nearby');
  assert.deepEqual(rosterRows(localRosterSource(session, null, [0, 0, 0])).rows.map((r) => r.name), ['Me']);
});

// ─── THE PANEL ──────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', title: '', placeholder: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, blur() {},
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
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
const fakeWindow = () => ({ addEventListener() {}, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

test('CHAT-CHAN panel: each tab says who it reaches (and the region\'s name), the field says where a line goes, an aside is drawn as one, a peek line from another tab wears that tab\'s mark and a notice none, and /help\'s answer keeps the chat open to be read (mutants: the placeholder fixed; the aside class lost; every peek line marked; the "read" answer closing the chat; the unread count gone from the tab\'s spoken name)', () => {
  let clock = 1000;
  const log = new ChatLog({ now: () => clock });
  const doc = fakeDocument();
  let answer = true;
  const panel = createChatPanel({ log, onSend: () => answer, action: () => null, doc, win: fakeWindow(), touch: false });
  const root = doc.body.children[0];
  const tabs = find(root, 'dfchat-tab');
  panel.render({});
  assert.deepEqual(tabs.map((b) => b.title), CHAT_TABS.map((t) => t.hint));
  const input = one(root, 'dfchat-input');
  assert.equal(input.placeholder, 'Say something - World');
  log.setRoom('region', 'chat:region.17', 'Wayrest');
  log.select('region');
  panel.render({});
  assert.equal(tabs[1].title, `Wayrest - ${CHAT_TABS[1].hint}`);
  assert.equal(input.placeholder, 'Say something - Wayrest', 'the place a moving channel is');
  log.select('world');
  assert.equal(tabs[2].style.display, 'none', 'CHAT-P: the Party tab is off the bar outside a party');
  log.setShown('party', true);
  panel.render({});
  assert.equal(tabs[2].style.display, '', 'and on it inside one');

  log.push('world', { id: 'a', name: 'A', text: 'on the World' });
  log.push('party', { id: 'b', name: 'B', text: 'to the party' });
  log.push('local', { id: 'c', name: 'C', text: '((brb))' });
  log.pushAll({ text: 'The server is restarting.' });
  panel.render({});
  // the unread count is the tab's spoken name (the eye gets a dot - tools/chatChanProbe.mjs looks at it)
  assert.deepEqual(tabs.map((b) => b.attrs['aria-label']), ['World, 2 unread', 'Region', 'Party, 1 unread', 'Guild', 'Local, 1 unread'], 'the World line and the game\'s notice (unread on the active tab), a line each on Party and Local');   // GUILD1c: the Guild tab, off the bar and counting nothing
  assert.ok(tabs.every((b) => one(b, 'dfchat-badge').attrs['aria-hidden'] === 'true'), 'the dot says nothing a second time');
  const peek = one(root, 'dfchat-peek').children;
  // CHAT-W: the open tab's line, the party's, the game's - the Local aside is Local's alone (it waits on its dot)
  assert.deepEqual(peek.map((n) => one(n, 'dfchat-chan')?.textContent ?? null), [null, 'Party', null], 'the open tab\'s own line and the game\'s wear no mark');
  assert.deepEqual(peek.map((n) => one(n, 'dfchat-chan')?.dataset.tab ?? null), [null, 'party', null]);
  assert.ok(!String(peek[1].className).split(/\s+/).includes('ooc'));
  log.select('local');
  panel.render({});
  const aside = one(root, 'dfchat-peek').children[1];   // on Local: the party's line, the aside, the game's notice
  assert.ok(String(aside.className).split(/\s+/).includes('ooc'), 'the aside drawn as one');
  log.select('world');

  panel.open();
  input.value = '/help';
  answer = 'read';
  one(root, 'dfchat-form').fire('submit');
  assert.equal(input.value, '', 'the field clears');
  assert.equal(log.open, true, 'and the chat stays open for the list');
  input.value = 'hello';
  answer = true;
  one(root, 'dfchat-form').fire('submit');
  assert.equal(log.open, false, 'a line that went closes it, as it always has');
  panel.destroy?.();
});

// ─── THE HOST, BY SOURCE ────────────────────────────────────────────────────────────────────────────────────────

test('CHAT-CHAN host: the commands are tested in their order - the host\'s own first, then the parser - a refusal keeps the line, /red is the World\'s, each tab has its own door, the Region tab follows the player only on a relay that opens region rooms, and a party\'s news lands on the Party tab (mutants: the parser before /unstuck; /red on the active tab; a party line with no party sent; the region joined before the welcome; party notes on the World tab)', () => {
  const w = rd('src/scenes/world.js');
  const onSend = /onSend: \(tabId, text\) => \{([\s\S]*?)\n {6}\},/.exec(w)[1];
  const at = (s) => { const i = onSend.indexOf(s); assert.ok(i >= 0, `onSend has ${s}`); return i; };
  // the parser is asked ONCE, after every command of the host's own. EMOTE1 re-aimed this pin to the parser over the
  // shortcodes and it let a SECOND call live before the commands - which reads /unstuck, /red, /mute and /ready as the
  // host's and would have refused every one; so the pin names the parser's FIRST call, and says it is the only one
  const parser = onSend.indexOf('parseChatLine(');
  assert.equal(parser, at('parseChatLine(expandShortcodes(text))'), 'the parser\'s first call is its one call, over the shortcodes\' emoji (EMOTE1)');
  assert.equal(onSend.split('parseChatLine(').length - 1, 1, 'and it is asked once');
  assert.ok(at('/^\\/unstuck$/i') < at('const red = ') && at('const red = ') < at('parseModCommand(text)') && at('parseModCommand(text)') < at("/^\\/ready$/i") && at("/^\\/ready$/i") < parser, 'the host\'s own commands by their own tests, then the parser');
  assert.match(onSend, /if \(cmd\.kind === 'help'\) \{ for \(const line of HELP_LINES\) note\(line\); return 'read'; \}/);
  for (const k of ['unknown', 'empty', 'host']) assert.match(onSend, new RegExp(`if \\(cmd\\.kind === '${k}'\\) \\{ note\\([^)]*\\)\\); return false; \\}`), `${k}: refused in words, the line kept to be mended`);
  assert.match(onSend, /if \(cmd\.kind === 'channel'\) return chatSend\(cmd\.tab, cmd\.wrap === 'ooc' \? oocText\(cmd\.text\) : cmd\.text, tabId\);/);
  assert.match(onSend, /if \(red\) return chatLinks\.get\('world'\)\?\.sendRed\(red\[1\]\) \?\? false;/);
  const send = w.slice(w.indexOf('const chatSend = '), w.indexOf('const _regionHold'));
  assert.match(send, /if \(\(tabId === 'party' \|\| tabId === 'region'\) && chanOld\(\)\) return why\(CHAN_OLD_RELAY_TEXT\);/);
  assert.match(send, /if \(tabId === 'local'\) return online\?\.sendChat\(text, \{ me \}\) \?\? false;/);
  assert.match(send, /if \(!social\?\.party\) return why\(NO_PARTY_TEXT\);\s*return socialLink\(\)\?\.sendChat\(text, \{ ch: 'party', me \}\) \?\? false;/);
  assert.match(w, /const chatRegionFrame = \(now\) => \{\s*const link = chatLinks\?\.get\('region'\);\s*if \(!link \|\| !chatLinks\.get\('world'\)\?\.chanOk\) return;/, 'never before the welcome says region rooms open');
  assert.match(w, /const room = nextRegionRoom\(_regionHold, chatRegionRoom\(index\), chatLog\.tab\('region'\)\.room, now\);/);
  assert.match(w, /chatLog\.setRoom\('region', room, place\);\s*link\.join\(room\);\s*chatLog\.push\('region', \{ text: regionJoinedText\(place\), system: true \}\);/);
  assert.match(w, /const index = _questRegionIndex\(\);/, 'PlayerGPS.CurrentRegionIndex - the politic map\'s word, the quests\' own');
  assert.match(w, /social\.onNote = \(note, text\) => \{ if \(text\) chatLog\.push\(partyNoteTab\(note, social, tab\.id\), \{ text, system: true \}\); \};/);   // CHAT-P: net/chat.js partyNoteTab - the Party tab while a party is
  assert.match(w, /if \(\(tabId === 'party' \|\| tabId === 'region'\) && chanOld\(\)\) return CHAN_OLD_RELAY_TEXT;\s*if \(tabId === 'party' && !social\?\.party\) return NO_PARTY_TEXT;/, 'the strip says why a tab cannot talk');
});
