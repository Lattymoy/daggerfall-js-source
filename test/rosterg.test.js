// ROSTER-G (2026-09-16, Mac: "Players dont show in online and the roster naming itself seems hardcoded").
//
// TWO FINDINGS, one root. CHAT-R1 asked for "all currently online players" and wired the panel to the PRESENCE
// session - the peers in the player's own map CELL - because the world channel, the one room every player is in, held
// no roster: its welcome said `peers: []`, it announced no join and said no leave (CHAT1's cost decision, when a
// channel was lines alone). So a friend two towns over never showed, and the list beside a world-wide chat was a
// list of the street. The channel names its members now (id and name - no look, no pose; nothing is drawn from a
// channel), cut at CHAT_ROSTER_MAX with the true count `n` beside it, and says its joins and leaves; the panel reads
// the tab's own link. And the #tag - the tie-breaker for two players with one name - is drawn only where it breaks a
// tie: stuck to every name it read as a code somebody hardcoded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAT_WORLD_ROOM, CHAT_ROSTER_MAX, CHAT_SOCKETS_MAX, SOCKETS_MAX, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { rosterRows, rosterTitle, ROSTER_ROWS_MAX } from '../src/net/roster.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const quiet = (fn) => { const info = console.info; console.info = () => {}; try { return fn(); } finally { console.info = info; } };

test('ROSTER-G: the channel\'s welcome NAMES who is in it - id and name, no look, no pose - with the true count, and the channel says its joins and leaves and never a host (mutants: `peers: []` as it was; the join fan dropped; the leave skipped; the look on the join)', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const a = r.connect(), b = r.connect(), c = r.connect();
    await r.hello(a, 'aaaa-0001', null, { name: 'Alpha' }); clock += 100;
    await r.hello(b, 'bbbb-0002', null, { name: 'Bravo' }); clock += 100;
    assert.deepEqual(a.sent[0], { t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION, now: a.sent[0].now }, 'first in: nobody to name, and the count says one');
    assert.equal(typeof a.sent[0].now, 'number', 'AUDIT SOC B7: the relay\'s clock rides the channel\'s welcome too');
    assert.deepEqual(b.sent[0], { t: 'welcome', id: 'bbbb-0002', peers: [{ id: 'aaaa-0001', name: 'Alpha' }], n: 2, v: RELAY_VERSION, now: b.sent[0].now }, 'second in: told the first, by name alone');
    assert.deepEqual(ofType(a, 'join'), [{ t: 'join', id: 'bbbb-0002', name: 'Bravo' }], 'the first hears the second join - the name and nothing else');
    await r.hello(c, 'cccc-0003', null, { name: 'Charlie' }); clock += 100;
    assert.deepEqual(c.sent[0].peers.map((p) => p.id).sort(), ['aaaa-0001', 'bbbb-0002']); assert.equal(c.sent[0].n, 3);
    for (const p of c.sent[0].peers) assert.deepEqual(Object.keys(p).sort(), ['id', 'name'], 'a channel names; it does not dress or place');
    await r.drop(b);
    assert.deepEqual(ofType(a, 'leave'), [{ t: 'leave', id: 'bbbb-0002' }], 'and says the leave');
    assert.deepEqual(ofType(c, 'leave'), [{ t: 'leave', id: 'bbbb-0002' }]);
    assert.equal(ofType(a, 'host').length + ofType(c, 'host').length, 0, 'a channel has no host, so the leave of the longest-in says no host');
    assert.equal(r.store.has('look:aaaa-0001'), false, 'and still no look in storage: the hello path stays as cheap as CHAT1 priced it');
  } finally { Date.now = realNow; }
});

test('ROSTER-G: the list is CUT at CHAT_ROSTER_MAX and the count is not - a full event\'s worth of names fits the welcome whole (mutants: the cut removed, which is an unbounded welcome; the count taken from the cut list)', async () => {
  assert.ok(CHAT_ROSTER_MAX >= SOCKETS_MAX, 'every player a place room can hold is named in the channel');
  assert.ok(CHAT_ROSTER_MAX > ROSTER_ROWS_MAX, 'and more than the panel draws, so the panel\'s own cut is the one that shows');
  assert.ok(CHAT_ROSTER_MAX < CHAT_SOCKETS_MAX, 'but not the whole channel: a channel holds more sockets than a welcome should carry names');
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const n = CHAT_ROSTER_MAX + 3;
    for (let i = 0; i < n; i++) { if (i % 40 === 39) clock += 1000; const s = r.connect(); await r.hello(s, `p${String(i).padStart(4, '0')}`, null, { name: `N${i}` }); }
    clock += 1000;
    const last = r.connect(); await r.hello(last, 'zzzz-9999', null, { name: 'Last' });
    const w = last.sent[0];
    assert.equal(w.peers.length, CHAT_ROSTER_MAX, 'the list is cut');
    assert.equal(w.n, n + 1, 'the count is everyone');
    assert.ok(w.peers.every((p) => typeof p.id === 'string' && typeof p.name === 'string'));
  } finally { Date.now = realNow; }
});

test('ROSTER-G: a channel link (presence: false) HOLDS the roster it is told - the welcome\'s names, a join, a leave - and the roster reads the room\'s count when the list was cut (mutants: the count ignored; the count used even when the rows exceed it)', () => quiet(() => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1e6, presence: false });
  s.join(CHAT_WORLD_ROOM, null); const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'aaaa-0001', name: 'Alpha' }, { id: 'bbbb-0002', name: 'Bravo' }], n: 3, v: RELAY_VERSION });
  let rr = rosterRows(s);
  assert.deepEqual(rr.rows.map((x) => x.name), ['Alpha', 'Bravo', 'Mac'], 'the channel\'s members, in the roster\'s order, mine among them');
  assert.equal(rr.total, 3); assert.equal(rosterTitle(rr.total), 'Online — 3');
  ws.receive({ t: 'join', id: 'cccc-0003', name: 'Charlie' });
  rr = rosterRows(s); assert.deepEqual(rr.rows.map((x) => x.name), ['Alpha', 'Bravo', 'Charlie', 'Mac'], 'a join is a row at once'); assert.equal(rr.total, 4, 'and the count follows the rows past the welcome\'s');
  ws.receive({ t: 'leave', id: 'aaaa-0001' });
  rr = rosterRows(s); assert.deepEqual(rr.rows.map((x) => x.name), ['Bravo', 'Charlie', 'Mac'], 'a leave takes the row');
  assert.equal(s.roomCount, null, 'a whole list counts itself - no room count kept, so a leave cannot leave a stale one (the browser run that found this: three rows, one left, the header still said three)');
  // a CUT welcome: the room says 600, the list is 2 - the header is the room's word, and it FOLLOWS the joins and leaves
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'aaaa-0001', name: 'Alpha' }, { id: 'bbbb-0002', name: 'Bravo' }], n: 600, v: RELAY_VERSION });
  rr = rosterRows(s); assert.equal(rr.total, 600, 'the count is the room\'s'); assert.ok(rr.rows.length <= ROSTER_ROWS_MAX);
  assert.equal(rosterTitle(rr.total), 'Online — 600');
  ws.receive({ t: 'leave', id: 'aaaa-0001' }); assert.equal(rosterRows(s).total, 599, 'a leave the channel says takes one off the count');
  ws.receive({ t: 'leave', id: 'nobody-known' }); assert.equal(rosterRows(s).total, 599, 'a leave for someone this list never held moves nothing');
  ws.receive({ t: 'join', id: 'dddd-0004', name: 'Delta' }); assert.equal(rosterRows(s).total, 600, 'a join adds one');
  ws.receive({ t: 'join', id: 'dddd-0004', name: 'Delta' }); assert.equal(rosterRows(s).total, 600, 'the same join again adds nothing');
  assert.equal(s.drawable().length, 0, 'nothing is drawn from a channel: no pose, nothing shown');
}));

test('ROSTER-G: world.js hands the panel the ACTIVE CHANNEL\'s link, with the presence session as the stand-in; and the #tag is drawn only beside a name another row shares (mutants: `online` alone, as CHAT-R1 wired it; the tag on every row, as it was)', async () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /roster: \(\) => chatLinks\?\.get\(chatLog\?\.active\) \?\? online \?\? null,/, 'the tab\'s own link first');
  const panel = rd('src/ui/chatPanel.js');
  assert.match(panel, /if \(dup\.has\(r\.name\.toLowerCase\(\)\)\) n\.append\(el\('span', 'dfchat-who-tag', '#' \+ r\.tag\)\);/, 'the tag is conditional on a shared name');
  // the relay's side, by source: a channel's welcome is built from `others` by name, cut and counted
  const idx = rd('server/src/index.js');
  assert.match(idx, /const named = others\.slice\(0, CHAT_ROSTER_MAX\)\.map\(\(b\) => \(\{ id: b\.id, name: b\.name, \.\.\.\(b\.v \? \{ v: true \} : \{\}\) \}\)\);/, 'ACC1d: and the verdict rides each row');
  assert.doesNotMatch(idx, /if \(isChatRoom\(a\.key\)\) return;   \/\/ a channel announced no join/, 'the leave arm no longer skips a channel');
});
