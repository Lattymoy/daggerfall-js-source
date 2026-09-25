// DICE1 (2026-09-23, the community arc - Addison Knox: "Chat dice-rolling"): THE RELAY ROLLS, and a roll is a frame of
// its own type. Driven: the grammar and its bounds, the unbiased draw over a scripted source, the client's check of
// what it is told; the relay's roll arm over the real Room (its own CSPRNG, its gate, the mute, the channel fans); the
// session's ask and its door; the log's roll line; the host's /roll by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROLL_DICE_MAX, ROLL_SIDES_MAX, ROLL_MOD_MAX, ROLL_DEFAULT, validRollSpec, parseRollSpec, rollSpecText, rollDice, validRoll, rollText,
} from '../src/net/dice.js';
import { parseClient, ROLL_HZ_MAX, rollGate, ROLL_RELAY_MIN, relaySupportsRoll, RELAY_VERSION, CHAT_WORLD_ROOM, SOCIAL_ROOM, CHAT_STRIKES_MAX, validRoll as wireValidRoll } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { ChatLog, ROLL_OLD_RELAY_TEXT } from '../src/net/chat.js';
import { parseChatLine, HELP_LINES, badRollText } from '../src/net/chatCommands.js';
import { bubbleLineOk } from '../src/ui/nameLayer.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ─── THE LAW ────────────────────────────────────────────────────────────────────────────────────────────────────

test('DICE1 grammar: NdM+K as the tabletop writes it, a bare N one die of N sides, nothing at all a d20, d% a hundred - and every bound refused rather than clamped (mutants: the default not a d20; d% unread; a bare number read as dice count; a bound off by one)', () => {
  assert.deepEqual(parseRollSpec(''), { n: 1, m: 20, k: 0 });
  assert.deepEqual(parseRollSpec('   '), ROLL_DEFAULT);
  assert.deepEqual(parseRollSpec('2d6+3'), { n: 2, m: 6, k: 3 });
  assert.deepEqual(parseRollSpec(' 3 D 8 - 1 '), { n: 3, m: 8, k: -1 }, 'spaces and case are nothing');
  assert.deepEqual(parseRollSpec('d20'), { n: 1, m: 20, k: 0 });
  assert.deepEqual(parseRollSpec('d%'), { n: 1, m: 100, k: 0 });
  assert.deepEqual(parseRollSpec('100'), { n: 1, m: 100, k: 0 }, 'the MMO\'s /roll 100: one die of a hundred sides');
  assert.deepEqual(parseRollSpec(`${ROLL_DICE_MAX}d${ROLL_SIDES_MAX}+${ROLL_MOD_MAX}`), { n: ROLL_DICE_MAX, m: ROLL_SIDES_MAX, k: ROLL_MOD_MAX }, 'the bounds themselves');
  assert.deepEqual(parseRollSpec(`1d2-${ROLL_MOD_MAX}`), { n: 1, m: 2, k: -ROLL_MOD_MAX });
  for (const bad of [`${ROLL_DICE_MAX + 1}d6`, `1d${ROLL_SIDES_MAX + 1}`, `1d6+${ROLL_MOD_MAX + 1}`, '0d6', '1d1', '1d0', '1', '0', 'd', '2d', 'dd6', '2d6+', '2d6+3+1', '2d6*3', 'abc', '1.5d6', '-2d6', '2d-6', '99999'])
    assert.equal(parseRollSpec(bad), null, `${bad}: refused, not clamped - a roll is exactly what was asked or nothing`);
  assert.equal(rollSpecText({ n: 2, m: 6, k: 3 }), '2d6+3');
  assert.equal(rollSpecText({ n: 1, m: 20, k: 0 }), '1d20');
  assert.equal(rollSpecText({ n: 3, m: 8, k: -1 }), '3d8-1');
  for (const bad of [null, {}, { n: 1, m: 6 }, { n: 1, m: 6, k: 0.5 }, { n: '1', m: 6, k: 0 }]) assert.equal(validRollSpec(bad), false);
});

test('DICE1 the draw: UNBIASED over the source - a draw at or past the last whole multiple of the sides below 2^32 is thrown back - every face reachable, the total the dice plus the modifier (mutants: the rejection dropped, which favours low faces; a face off by one; the modifier not added)', () => {
  // m = 6 does not divide 2^32: 2^32 % 6 = 4, so the four draws at the very top would bias faces 1..4 - they must be thrown back
  const limit = 2 ** 32 - (2 ** 32 % 6);
  const script = [limit, limit + 3, 2 ** 32 - 1, 5, 0];
  let i = 0;
  const r = rollDice({ n: 2, m: 6, k: 3 }, () => script[i++]);
  assert.equal(i, 5, 'three draws thrown back, two kept');
  assert.deepEqual(r, { n: 2, m: 6, k: 3, dice: [6, 1], total: 10 });
  assert.ok(validRoll(r));
  // every face of a d6 over a long even source, and none past it
  const seen = new Set();
  let x = 0;
  for (let j = 0; j < 600; j++) { const d = rollDice({ n: 1, m: 6, k: 0 }, () => (x = (x + 2654435761) >>> 0)); seen.add(d.dice[0]); }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(rollDice({ n: 0, m: 6, k: 0 }, () => 0), null, 'a spec the law refuses rolls nothing');
});

test('DICE1 the client\'s check: a roll it is told is n dice each 1..m and a total that IS their sum plus k - anything else is not a roll (mutants: the sum unchecked; a face past the sides admitted; the count unchecked)', () => {
  assert.equal(validRoll({ n: 2, m: 6, k: 3, dice: [4, 5], total: 12 }), true);
  assert.equal(validRoll({ n: 2, m: 6, k: 3, dice: [4, 5], total: 13 }), false, 'a total the dice do not make');
  assert.equal(validRoll({ n: 2, m: 6, k: 0, dice: [4, 7], total: 11 }), false, 'a face past the sides');
  assert.equal(validRoll({ n: 2, m: 6, k: 0, dice: [4], total: 4 }), false, 'one die short');
  assert.equal(validRoll({ n: 1, m: 6, k: 0, dice: [0], total: 0 }), false);
  assert.equal(validRoll({ n: 1, m: 6, k: 0, dice: '6', total: 6 }), false);
  assert.equal(validRoll(null), false);
  assert.equal(rollText({ n: 2, m: 6, k: 3, dice: [4, 5], total: 12 }), 'rolls 2d6+3: 4 + 5 +3 = 12');
  assert.equal(rollText({ n: 3, m: 8, k: -1, dice: [1, 2, 3], total: 5 }), 'rolls 3d8-1: 1 + 2 + 3 -1 = 5');
  assert.equal(rollText({ n: 1, m: 20, k: 0, dice: [17], total: 17 }), 'rolls 1d20: 17', 'one die and nothing added: the number alone');
  assert.equal(rollText({ n: 1, m: 20, k: 2, dice: [17], total: 19 }), 'rolls 1d20+2: 17 +2 = 19');
});

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('DICE1 wire: the ask is a spec and nothing else - the dice\'s bounds, after hello, a channel only the chat\'s law allows; world102 the first relay that rolls (world99 before the first merge, world101 before the sixth: main\'s world99, world100 and world101 roll nothing); one roll a second (mutants: the ask carrying a result; the bounds unchecked at the relay; an unknown channel admitted; the version gate one high)', () => {
  const h = { hasHello: true };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', n: 2, m: 6, k: 3 }), h), { t: 'roll', n: 2, m: 6, k: 3 });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', n: 2, m: 6, k: 3, dice: [6, 6], total: 15 }), h), { t: 'roll', n: 2, m: 6, k: 3 }, 'a result on the ask is read by nobody - the relay rolls');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', n: 1, m: 20, k: 0, ch: 'party' }), h), { t: 'roll', n: 1, m: 20, k: 0, ch: 'party' });
  for (const bad of [{ n: 0, m: 6, k: 0 }, { n: 11, m: 6, k: 0 }, { n: 1, m: 1, k: 0 }, { n: 1, m: 1001, k: 0 }, { n: 1, m: 6, k: 1001 }, { n: 1, m: 6 }, { n: '1', m: 6, k: 0 }])
    assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', ...bad }), h), { error: 'bad roll' }, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', n: 1, m: 6, k: 0, ch: 'clan' }), h), { error: 'bad roll' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'roll', n: 1, m: 6, k: 0 })), { error: 'roll before hello' });
  assert.equal(ROLL_RELAY_MIN, 102);
  assert.equal(relaySupportsRoll('world101'), false, 'DISC12\'s relay (the last before the arc) answers a roll with "unknown message" and closes the socket');
  assert.equal(relaySupportsRoll('world102'), true);
  assert.ok(relaySupportsRoll(RELAY_VERSION));
  assert.equal(ROLL_HZ_MAX, 1);
  const a = rollGate(null, 0); assert.equal(a.pass, true);
  assert.equal(rollGate(a.bucket, 10).pass, false, 'the second in the same second');
  assert.equal(rollGate(a.bucket, 1000).pass, true, 'and one a second after');
  assert.equal(wireValidRoll, validRoll, 'the relay\'s law and the client\'s are one function');
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

const rolls = (ws) => ws.sent.filter((m) => m.t === 'roll');
async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 1000) => { clock += ms; };
  try { await fn({ r, tick, now: () => clock }); } finally { Date.now = realNow; }
}

test('DICE1 relay: the RELAY rolls - every face from its own CSPRNG, the result said to the channel as a frame of its own type, the asker included (the receipt), every face of a d6 reached and none past it (mutants: the fan leaving the asker out; the dice unrolled; the id or the name off the frame)', () => withRoom(CHAT_WORLD_ROOM, async ({ r, tick }) => {
  const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
  a.sent.length = 0; b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'roll', n: 2, m: 6, k: 3 }));
  for (const ws of [a, b]) {
    const got = rolls(ws);
    assert.equal(got.length, 1, 'one roll to each - the asker too');
    const x = got[0];
    assert.equal(x.id, 'peer-a'); assert.equal(x.name, 'Ann');
    assert.ok(validRoll(x), `the law holds: ${JSON.stringify(x)}`);
    assert.deepEqual([x.n, x.m, x.k], [2, 6, 3]);
  }
  assert.deepEqual(rolls(a)[0].dice, rolls(b)[0].dice, 'ONE roll, the same numbers to everyone');
  const faces = new Set();
  for (let i = 0; i < 300; i++) { tick(); await r.raw(a, JSON.stringify({ t: 'roll', n: 2, m: 6, k: 0 })); for (const d of rolls(b).at(-1).dice) faces.add(d); }
  assert.deepEqual([...faces].sort(), [1, 2, 3, 4, 5, 6], 'every face, and none past the sides');
}));

test('DICE1 relay: one roll a second a socket, the rest dropped and struck like chat, a muted player\'s roll nowhere (they are told), and a party\'s roll heard by the party alone (mutants: the roll gate removed; a muted player rolling; the party roll fanned to the room)', async () => {
  await withRoom(CHAT_WORLD_ROOM, async ({ r }) => {
    const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
    const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
    b.sent.length = 0;
    await r.raw(a, JSON.stringify({ t: 'roll', n: 1, m: 20, k: 0 }));
    await r.raw(a, JSON.stringify({ t: 'roll', n: 1, m: 20, k: 0 }));
    assert.equal(rolls(b).length, 1, 'the second roll in the same second goes nowhere');
    assert.equal(a.meters.rollDrops, 1, 'and is a strike');
    for (let i = 0; i < CHAT_STRIKES_MAX + 1 && !a.closed; i++) await r.raw(a, JSON.stringify({ t: 'roll', n: 1, m: 20, k: 0 }));
    assert.ok(a.closed, 'a flood of rolls closes the socket, as a flood of lines does');
  });
  await withRoom(CHAT_WORLD_ROOM, async ({ r, now }) => {
    const m = r.connect(); await r.hello(m, 'peer-m', null, { name: 'Mute', mu: Math.floor(now() / 1000) + 600 });
    const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
    b.sent.length = 0; m.sent.length = 0;
    await r.raw(m, JSON.stringify({ t: 'roll', n: 1, m: 20, k: 0 }));
    assert.equal(rolls(b).length, 0, 'a muted player rolls for nobody');
    assert.equal(m.sent.filter((x) => x.t === 'muted').length, 1, 'and is told why');
  });
  await withRoom(SOCIAL_ROOM, async ({ r, tick }) => {
    const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); tick(10); return ws; };
    const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
    const a = await join('a'), b = await join('b'), c = await join('c');
    await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(600);
    const pid = b.sent.filter((x) => x.t === 'social' && x.k === 'invite').at(-1).party;
    await act(b, { k: 'party.accept', party: pid }); tick(600);
    for (const ws of [a, b, c]) ws.sent.length = 0;
    await r.raw(a, JSON.stringify({ t: 'roll', n: 1, m: 100, k: 0, ch: 'party' }));
    assert.equal(rolls(a).length, 1); assert.equal(rolls(b).length, 1);
    assert.equal(rolls(b)[0].ch, 'party', 'said on the party\'s channel');
    assert.equal(rolls(c).length, 0, 'and nobody else hears it');
  });
});

// ─── THE SESSION, THE LOG, THE BUBBLE ───────────────────────────────────────────────────────────────────────────

const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
function link(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => t });
  const heard = []; s.onRoll = (x) => heard.push(x);
  quiet(() => s.join(SOCIAL_ROOM));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'roll');
  return { s, ws, heard, out, tick: (ms) => { t += ms; } };
}

test('DICE1 session: a roll is asked only of a relay that rolls, as a spec, one a second, a party\'s only where the channels are; a roll told back is kept only when its numbers add up (mutants: the version door dropped; the gate dropped; a forged total believed)', () => {
  const old = link('world100');
  assert.equal(old.s.rollOk, false);
  assert.equal(old.s.sendRoll({ n: 1, m: 20, k: 0 }), false, 'world100 would close the socket on it');
  assert.equal(old.out().length, 0);
  const { s, out, heard, ws, tick } = link();
  assert.equal(s.rollOk, true);
  assert.equal(s.sendRoll({ n: 2, m: 6, k: 3 }), true);
  assert.deepEqual(out().at(-1), { t: 'roll', n: 2, m: 6, k: 3 });
  assert.equal(s.sendRoll({ n: 1, m: 20, k: 0 }), false, 'one a second');
  tick(1000);
  assert.equal(s.sendRoll({ n: 1, m: 20, k: 0 }, { ch: 'party' }), true);
  assert.deepEqual(out().at(-1), { t: 'roll', n: 1, m: 20, k: 0, ch: 'party' });
  tick(1000);
  assert.equal(s.sendRoll({ n: 0, m: 6, k: 0 }), false, 'a spec the dice refuse never leaves');
  assert.equal(s.sendRoll({ n: 1, m: 6, k: 0 }, { ch: 'clan' }), false);
  ws.receive({ t: 'roll', id: 'bbbb-0002', name: 'Bob', at: 5, n: 2, m: 6, k: 3, dice: [4, 5], total: 12 });
  ws.receive({ t: 'roll', id: 'bbbb-0002', name: 'Bob', at: 6, n: 2, m: 6, k: 3, dice: [4, 5], total: 20 });
  ws.receive({ t: 'roll', id: 'bbbb-0002', name: 'Bob', at: 7, n: 1, m: 6, k: 0, dice: [9], total: 9 });
  ws.receive({ t: 'roll', id: 'bbbb-0002', name: 'Bob', at: 8, n: 1, m: 20, k: 0, dice: [17], total: 17, ch: 'party' });
  assert.deepEqual(heard.map((x) => [x.name, x.roll.total, x.ch]), [['Bob', 12, null], ['Bob', 17, 'party']], 'a total the dice do not make and a face past the sides are no rolls');
});

test('DICE1 log: a roll is a line in the dice\'s own words, its kind set from the FRAME - no typed line can be one - and it stands over no head (mutants: a failed roll kept as its words; the kind lost; a roll bubbled)', () => {
  const log = new ChatLog({ now: () => 1000 });
  const line = log.push('world', { id: 'bbbb-0002', name: 'Bob', roll: { n: 2, m: 6, k: 3, dice: [4, 5], total: 12 } });
  assert.equal(line.kind, 'roll');
  assert.equal(line.text, 'rolls 2d6+3: 4 + 5 +3 = 12');
  assert.deepEqual(line.roll, { n: 2, m: 6, k: 3, dice: [4, 5], total: 12 });
  assert.equal(log.push('world', { id: 'bbbb-0002', name: 'Bob', roll: { n: 2, m: 6, k: 3, dice: [4, 5], total: 99 } }), null, 'a roll that does not add up is no line at all');
  assert.equal(log.push('world', { id: 'bbbb-0002', name: 'Bob', text: 'rolls 2d6+3: 6 + 6 +3 = 15', roll: { n: 2, m: 6, k: 3, dice: [6, 6], total: 99 } }), null, '...not even as the words beside it: a failed roll fails closed');
  const typed = log.push('world', { id: 'cccc-0003', name: 'Cid', text: 'rolls 2d6+3: 6 + 6 +3 = 15' });
  assert.equal(typed.kind, '', 'a typed line that reads like a roll is a typed line');
  assert.equal('roll' in typed, false);
  assert.equal(bubbleLineOk(line), false, 'the table\'s, not the character\'s words');
  assert.equal(bubbleLineOk(typed), true);
});

// ─── THE GRAMMAR AT THE CHAT, THE PANEL, THE HOST ───────────────────────────────────────────────────────────────

test('DICE1 at the chat: /roll and /dice take the dice\'s grammar - a d20 with nothing said - and a spec the dice refuse is refused in words, never said (mutants: /dice missing; a bad spec said to the room)', () => {
  assert.deepEqual(parseChatLine('/roll'), { kind: 'roll', spec: { n: 1, m: 20, k: 0 } });
  assert.deepEqual(parseChatLine('/ROLL 2d6+3'), { kind: 'roll', spec: { n: 2, m: 6, k: 3 } });
  assert.deepEqual(parseChatLine('/dice d%'), { kind: 'roll', spec: { n: 1, m: 100, k: 0 } });
  assert.deepEqual(parseChatLine('/roll 50d6'), { kind: 'badroll', name: 'roll' });
  assert.equal(badRollText('roll'), '/roll takes dice like 2d6+3, d20 or 100 - at most 10 dice of up to 1000 sides.');
  assert.ok(HELP_LINES.some((l) => l.startsWith('/roll or /dice')), '/help says it');
});

test('DICE1 host by source: /roll is the parser\'s after the host\'s own, said on the active tab through that tab\'s own door (its session, an older relay said in words, a party that is not there), a roll lands where a line would - and Local\'s within earshot; the panel draws a roll in its own colour (mutants: a roll on the wrong tab; Local\'s rolls heard from anywhere)', () => {
  const w = rd('src/scenes/world.js');
  const onSend = /onSend: \(tabId, text\) => \{([\s\S]*?)\n {6}\},/.exec(w)[1];
  assert.match(onSend, /if \(cmd\.kind === 'badroll'\) \{ note\(badRollText\(cmd\.name\)\); return false; \}/);
  assert.match(onSend, /if \(cmd\.kind === 'roll'\) return chatRoll\(tabId, cmd\.spec\);/);
  const door = w.slice(w.indexOf('const chatRoll = '), w.indexOf('const _regionHold'));
  assert.match(door, /const s = tabId === 'local' \? online : tabId === 'party' \|\| tabId === 'guild' \? socialLink\(\) : chatLinks\.get\(tabId\);/);   // GUILD1c: the Guild tab's door is the hub's too
  assert.match(door, /if \(s\?\.status === 'open' && !s\.rollOk\) return why\(ROLL_OLD_RELAY_TEXT\);/);
  assert.match(door, /return s\?\.sendRoll\(spec, tabId === 'party' \|\| tabId === 'guild' \? \{ ch: tabId \} : \{\}\) \?\? false;/);
  assert.match(w, /link\.onRoll = \(line\) => chatLog\.push\(tab\.room === SOCIAL_ROOM && \(line\.ch === 'party' \|\| line\.ch === 'guild'\) \? line\.ch : tab\.id, line\);/);
  assert.match(w, /online\.onRoll = \(line\) => \{ if \(localLineHeard\(line, peersNear\(\), player\.feetAt\(\)\)\) chatLog\.push\('local', line\); \};/);
  assert.match(ROLL_OLD_RELAY_TEXT, /server's next update/);
  const panel = rd('src/ui/chatPanel.js');
  assert.match(panel, /\$\{line\.kind === 'roll' \? ' roll' : ''\}/);
  assert.match(panel, /\.dfchat-line\.roll \.dfchat-text \{ color: #e7c46a; \}/);
});
