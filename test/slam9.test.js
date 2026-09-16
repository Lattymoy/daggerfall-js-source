// SLAM9 (2026-09-16, AUDIT SLAM over SLAM1..SLAM7): THE ROOM COULD NOT INTRODUCE ITSELF.
//
// Three lenses hit this from three sides, and it was the biggest thing wrong with the branch.
//
// AT HOME: the ask was a REACTION. `_askWho` fired from every stranger's pose as it arrived, and a rank-ordered far
// tier delivers those in a STABLE order, so the same head of that order re-qualified after WHO_RETRY_MS and won the
// WHO_HZ_MAX token every time. Measured over a real session, 199 peers, 135 strangers, ten minutes: 3,004 asks
// sent, 54 distinct ids ever asked, 81 never asked once - flat from the first minute to the tenth. Not slow. STUCK.
// Reshuffling the arrival order alone made it 135 of 135, which is the proof the order was the cause. The ask is now
// a fair rotation from tick() over every un-introduced peer (`_askRound`): each is reached once per pass whatever
// order its poses arrive in, and a pass over a full room is ~27 s at WHO_HZ_MAX. Measured after: 135 of 135 asked,
// the last of them by t=26 s.
//
// AT THE RELAY: WHO_ROOM_HZ_MAX was 60, justified in its own comment as bounding STORAGE READS - and SLAM5 deleted
// that cost when the hello started filling `_looks`. The budget outlived the expense it was sized for, and it was
// binding: 200 clients offered ~1,000 asks a second against 60 answered, and the room took 172 s to finish
// introducing itself. It is now the SUM of every socket's own gate (SOCKETS_MAX x WHO_HZ_MAX) - a room of correct
// clients is answered in full, and the room-wide bound binds only when the per-socket gates are not the whole story.
// And it is spent BEFORE the scan for the target, not after: a refused ask used to cost the object a fresh
// SOCKETS_MAX-entry array and a linear search for nothing.
//
// AND TWO THINGS THE FIRST TWO MADE VISIBLE. A socket blip re-anonymised everyone past the nearest ROSTER_MAX: the
// welcome prunes the roster it does not name, and their next pose re-stood each as a nameless, look-less stranger to
// be asked for all over again (199 named and dressed -> 64 -> 135 "Travellers", measured). An introduction is a fact
// about an ID, so it is kept (`_known`, bounded) and a re-stood stranger wears it at once. And a pose is proof of
// membership in the room it arrived on: `_rooms` was written by a welcome or a join alone, so a peer introduced in my
// cell and posing through a halo was no member of the halo, and the cell's `leave` deleted her while she stood alive
// next door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession, KNOWN_MAX } from '../src/net/online.js';
import { SOCKETS_MAX, WHO_HZ_MAX, WHO_ROOM_HZ_MAX, WHO_RETRY_MS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { fakeRoom } from './fakeRoom.mjs';

const at = (x, z = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(4, '0')}`);
const whos = (ws) => ws.sent.filter((f) => typeof f === 'string' && f.startsWith('{"t":"who"')).map((f) => JSON.parse(f).id);

/** A session in `room`, opened and welcomed with `known` peers. `now` is the caller's to move. */
function session(room, known, clock) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
  s.join(room, at(0)); const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: known.map((id, i) => ({ id, name: `K${i}`, look, pose: at(i) })), host: null, world: null });
  return { s, ws, sockets };
}
/** One simulated second: the strangers' poses in a STABLE order, then sixty ticks. */
function second(s, ws, strangers, clock) {
  for (const id of strangers) ws.receive({ t: 'pose', id, p: at(1) });
  for (let f = 0; f < 60; f++) { clock.now += 1000 / 60; s.tick(); }
}

test('SLAM9: every stranger in a full room is asked for inside one pass, in a STABLE arrival order - the case that starved 81 of 135 for ever (mutant: the ask back to a reaction on the pose, which is SLAM6 verbatim)', () => {
  const clock = { now: 1_000_000 };
  const info = console.info; console.info = () => {};
  try {
    const { s, ws } = session('town:m1', ids('kn', 64), clock);
    const strangers = ids('st', 135);
    const firstAsked = new Map();
    for (let sec = 0; sec < 40; sec++) {
      second(s, ws, strangers, clock);
      for (const id of whos(ws)) if (!firstAsked.has(id)) firstAsked.set(id, sec);
    }
    assert.equal(s.peers.size, 199, 'the whole room is stood');
    assert.equal(new Set(whos(ws)).size, 135, 'every one of the 135 strangers has been asked for');
    assert.equal(strangers.filter((id) => !firstAsked.has(id)).length, 0, 'and none was starved');
    const pass = Math.ceil(135 / WHO_HZ_MAX);
    assert.ok(Math.max(...firstAsked.values()) <= pass + 1, `the last of them inside one pass (~${pass}s at WHO_HZ_MAX)`);
    assert.ok(whos(ws).length <= 40 * WHO_HZ_MAX + WHO_HZ_MAX, 'and the gate at home is still the gate');
  } finally { console.info = info; }
});

test('SLAM9: the round is FAIR - a stranger not yet reached this pass is asked before any repeat, and the cursor picks up where the last tick stopped (mutant: the round restarting from the front each tick, which is the same head-of-line bias in new clothes)', () => {
  const clock = { now: 1_000_000 };
  const info = console.info; console.info = () => {};
  try {
    const { s, ws } = session('town:m1', [], clock);
    const strangers = ids('st', 12);
    for (const id of strangers) ws.receive({ t: 'pose', id, p: at(1) });
    s.tick();
    assert.deepEqual(whos(ws), strangers.slice(0, WHO_HZ_MAX), 'the first five, in order');
    clock.now += 1000; s.tick();
    assert.deepEqual(whos(ws).slice(WHO_HZ_MAX), strangers.slice(WHO_HZ_MAX, 2 * WHO_HZ_MAX), 'the NEXT five - not the first five again');
    clock.now += 1000; s.tick();
    assert.deepEqual(whos(ws).slice(2 * WHO_HZ_MAX, 12), strangers.slice(2 * WHO_HZ_MAX), 'the last two...');
    assert.deepEqual(whos(ws).slice(12), [], '...and NOT a repeat inside the retry, tokens or no tokens');
    clock.now += WHO_RETRY_MS; s.tick();
    assert.equal(whos(ws).length, 12 + WHO_HZ_MAX, 'past the retry the pass begins again');
  } finally { console.info = info; }
});

test('SLAM9: a peer this session once KNEW is re-stood as itself after a socket blip - named, dressed and told, not a Traveller to be asked for again (mutant: `_known` never consulted; mutant: introductions never remembered)', () => {
  const clock = { now: 1_000_000 };
  const info = console.info; console.info = () => {};
  try {
    const { s, ws } = session('town:m1', ids('kn', 64), clock);
    // the rest of the room: stood by their poses, then INTRODUCED by the relay's answers
    const rest = ids('st', 40);
    for (const id of rest) ws.receive({ t: 'pose', id, p: at(1) });
    for (const [i, id] of rest.entries()) ws.receive({ t: 'join', id, name: `R${i}`, look: { ...look, faceIndex: i % 9 }, pose: at(1) });
    assert.equal([...s.peers.values()].filter((p) => p.told).length, 104, 'everyone is introduced');
    // THE BLIP: a re-welcome naming only the nearest few prunes the rest of the roster
    ws.receive({ t: 'welcome', id: 'mac-0001', peers: ids('kn', 10).map((id, i) => ({ id, name: `K${i}`, look, pose: at(i) })), host: null, world: null });
    assert.equal(s.peers.size, 10, 'the welcome kept what it named');
    // their next poses: re-stood as THEMSELVES
    for (const id of rest) ws.receive({ t: 'pose', id, p: at(2) });
    for (const id of ids('kn', 64).slice(10)) ws.receive({ t: 'pose', id, p: at(2) });
    assert.equal(s.peers.size, 104);
    const back = s.peers.get('st-0007');
    assert.equal(back.told, true, 'a peer this session was introduced to is not a stranger');
    assert.equal(back.name, 'R7'); assert.equal(back.look.faceIndex, 7, 'in its own name and its own face');
    assert.equal([...s.peers.values()].filter((p) => !p.told).length, 0, 'nobody came back anonymous');
    s.tick(); assert.deepEqual(whos(ws), [], 'and nobody is asked for again');
    // a peer NEVER introduced is still a stranger, still asked
    ws.receive({ t: 'pose', id: 'new-0099', p: at(3) }); s.tick();
    assert.equal(s.peers.get('new-0099').told, false); assert.deepEqual(whos(ws), ['new-0099']);
  } finally { console.info = info; }
});

test('SLAM9: what a session remembers is BOUNDED at KNOWN_MAX, newest kept, stalest forgotten (mutant: the bound removed, which is one entry per identity ever met over a four-hour stream)', () => {
  const clock = { now: 1_000_000 };
  const info = console.info; console.info = () => {};
  try {
    const { s, ws } = session('town:m1', [], clock);
    assert.equal(KNOWN_MAX, SOCKETS_MAX * 2, 'two rooms\' worth: the one I am in and the one I just left');
    const many = ids('id', KNOWN_MAX + 40);
    for (const [i, id] of many.entries()) { ws.receive({ t: 'join', id, name: `N${i}`, look, pose: at(1) }); ws.receive({ t: 'leave', id }); }
    assert.equal(s._known.size, KNOWN_MAX, 'the bound holds');
    assert.ok(s._known.has(many.at(-1)), 'the newest is kept');
    assert.ok(!s._known.has(many[0]), 'the oldest is gone');
    // re-introducing an old one moves it to the back, so the bound forgets by staleness
    ws.receive({ t: 'join', id: many[100], name: 'Again', look, pose: at(1) });
    assert.equal([...s._known.keys()].at(-1), many[100]);
  } finally { console.info = info; }
});

test('SLAM9: a pose is proof of membership in the room it came on - a leave in one room does not delete a peer alive in another (mutant: membership from the welcome and the join alone, as it was)', () => {
  const clock = { now: 1_000_000 };
  const info = console.info; console.info = () => {};
  try {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => clock.now });
    s.join('world:3,12', at(0)); const P = sockets[0]; P.open();
    P.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    s.setHalo(['world:2,12']); const H = sockets[1]; H.open();
    H.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null });
    // Eve is introduced in P (a join), and poses through H as a peer standing on the seam does
    P.receive({ t: 'join', id: 'eve-0003', name: 'Eve', look, pose: at(1) });
    H.receive({ t: 'pose', id: 'eve-0003', p: at(2) });
    assert.ok(s._rooms.get('world:2,12')?.has('eve-0003'), 'her pose made her a member of the halo');
    // she walks out of P: the relay says leave THERE
    P.receive({ t: 'leave', id: 'eve-0003' });
    assert.ok(s.peers.has('eve-0003'), 'still held - she is alive in the halo');
    assert.equal(s.peers.get('eve-0003').told, true); assert.equal(s.peers.get('eve-0003').name, 'Eve', 'and still herself');
    H.receive({ t: 'leave', id: 'eve-0003' });
    assert.ok(!s.peers.has('eve-0003'), 'gone when the last room lets her go');
  } finally { console.info = info; }
});

test('SLAM9: the room\'s who budget is the SUM of the socket gates - a room of correct clients at full rate is answered in full (mutants: 60, as it was, which answered 60 of these 200; the budget left after the scan)', async () => {
  assert.equal(WHO_ROOM_HZ_MAX, SOCKETS_MAX * WHO_HZ_MAX, 'derived, not chosen');
  assert.equal(relay.WHO_ROOM_HZ_MAX, WHO_ROOM_HZ_MAX, 'one home, both ends');
  assert.ok(WHO_ROOM_HZ_MAX > 60, 'and it is no longer the number sized for storage reads SLAM5 deleted');
  const r = fakeRoom('town:m2');
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  let answered = 0;
  try {
    const t = r.connect(); await r.hello(t, 'tttt-0000', at(1, 1));
    const askers = [];
    for (let i = 0; i < 40; i++) { if (i % 7 === 6) clock += 1000; const w = r.connect(); await r.hello(w, `ask${String(i).padStart(3, '0')}-0${i}`, at(1, 1)); askers.push(w); }
    clock += 1000;
    for (const w of askers) for (let k = 0; k < WHO_HZ_MAX; k++) await r.raw(w, JSON.stringify({ t: 'who', id: 'tttt-0000' }));
    for (const w of askers) answered += w.sent.filter((m) => m.t === 'join' && m.id === 'tttt-0000').length;   // the target hello'd before every asker, so the only joins naming it are answers
    assert.equal(answered, 40 * WHO_HZ_MAX, `200 asks in one instant, 200 answered (${answered}) - the old budget answered 60`);
    for (const w of askers) assert.equal(w.att.wdrops ?? 0, 0, 'and nobody struck');
  } finally { Date.now = realNow; }
});
