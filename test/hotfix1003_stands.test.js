// HOTFIX 1003f (2026-10-03, live: "people join and are alone"; the owner: "Everyone should be shown. Nobody should be
// invisible."): AN ARENA FLOOR DRAWS EVERYONE IN IT. A floor room drew the sockets on its sand alone (ARENA4's bodiless
// stands), so a private session's members in the stands saw nobody and were seen by nobody, and every watcher of a bout
// stood in an empty arena. On the real Room over fake sockets and fake objects (test/fakeRoom.mjs), as
// test/arena6_private.test.js and test/audit1003b_relay.test.js drive it: a private session's members shown to each
// other at their join and their poses fanned among them, a stranger drawn to nobody and seeing nobody, a member gone,
// removed or the session ended said gone; a bout's stands drawn to its fighter and to each other; a tokenless hello
// still refused at the door (ACC1g); and the client's Host and Join wanting an account and an open socket.
// Design: bible/11-Multiplayer/Arena.md, the ARENA6 record's HOTFIX 1003f paragraph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from './fakeRoom.mjs';
import { ARENA_FLOOR_CENTRE, arenaPrivateRoom, arenaBoutRoom } from '../src/net/arenaLaw.js';
import { readArenaOut, CLOSE_POLICY } from '../src/net/wire.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';

const C = ARENA_FLOOR_CENTRE;
const ROOM = arenaPrivateRoom('K7PX2M');
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const ps = (r, ws, a, extra = {}) => word(r, ws, { k: 'ps', a, ...extra });
const idOf = (pss, name) => pss.m.find((x) => x[1] === name)?.[0] ?? null;
/** A place on the terrace, `i` seats along, `dz` a step forward. */
const at = (i, dz = 0) => ({ x: C[0] + i, y: 7, z: C[2] - 21.8 + dz, yaw: 0, pitch: 0, mv: dz ? 1 : 0 });
const welcomeOf = (ws) => ws.sent.find((m) => m.t === 'welcome');
const ids = (ws, t, from = 0) => ws.sent.slice(from).filter((m) => m.t === t).map((m) => m.id);

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}

test('HOTFIX 1003f a private session\'s stands are drawn: each member shown every member here at its join and shown to each, its pose fanned to the members; a stranger in the room welcomed to nobody, drawn to nobody, its pose to nobody, a member\'s reconnect never said to it; a member gone, removed or the session closed said gone; a tokenless hello still refused at the door (mutants: the joiner shown the fighters alone; the others never told of it; a stranger told of it; a member\'s welcome naming the stranger; the stranger\'s pose fanned; a member\'s hello to all; the end said to nobody)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const R = W.room(ROOM);
  const host = R.connect();
  await R.hello(host, 'peer-hela', at(0), { name: 'Hela', kind: 'linked', tokenSub: 'acct-hela' });
  await ps(R, host, 'open');
  // a stranger with the code, in the room before anyone joins
  const str = R.connect();
  await R.hello(str, 'peer-str', at(2), { name: 'Stranger', tokenSub: 'acct-str' });
  assert.deepEqual(welcomeOf(str).peers, [], 'a stranger is welcomed to a room that draws nobody');
  // two members join - a registered fighter and a guest who watches - each shown every member here, and to each
  const alva = R.connect();
  await R.hello(alva, 'peer-alva', at(1), { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
  assert.deepEqual(welcomeOf(alva).peers, [], 'before its join it is a stranger too');
  await ps(R, alva, 'join');
  const gull = R.connect();
  await R.hello(gull, 'peer-gull', at(3), { name: 'Gull', tokenSub: 'acct-gull' });
  await ps(R, gull, 'join');
  assert.deepEqual(ids(alva, 'join').sort(), ['peer-gull', 'peer-hela'], 'Alva sees the host and the later joiner');
  assert.deepEqual(ids(gull, 'join').sort(), ['peer-alva', 'peer-hela'], 'Gull sees everyone already in the stands');
  assert.deepEqual(ids(host, 'join').sort(), ['peer-alva', 'peer-gull'], 'the host sees both come');
  assert.deepEqual(ids(str, 'join'), [], 'the stranger is shown no member');
  assert.ok(!ids(host, 'join').includes('peer-str') && !ids(alva, 'join').includes('peer-str'), 'and no member the stranger');
  const j = host.sent.find((m) => m.t === 'join' && m.id === 'peer-gull');
  assert.deepEqual([j.name, !!j.look, j.pose?.x, j.pose?.z], ['Gull', true, at(3).x, at(3).z], 'a body to draw - its name, its look, where it stands');
  // poses: a member's to every other member; the stranger's to nobody, and it hears none
  step(100); await R.pose(alva, at(1, 0.5));
  step(100); await R.pose(gull, at(3, 0.5));
  assert.ok(ids(host, 'pose').includes('peer-alva') && ids(gull, 'pose').includes('peer-alva'), 'a member\'s step reaches the members');
  assert.ok(ids(host, 'pose').includes('peer-gull') && ids(alva, 'pose').includes('peer-gull'), 'a guest\'s too - the stands move');
  assert.deepEqual(ids(str, 'pose'), [], 'a stranger hears no member move');
  step(100); await R.pose(str, at(2, 0.5));
  for (const ws of [host, alva, gull]) assert.ok(!ids(ws, 'pose').includes('peer-str'), 'a stranger\'s pose reaches nobody');
  // a member's reconnect: its welcome names the members and never the stranger; its hello said to the members alone
  const strAt = str.sent.length;
  step(1500);
  const gull2 = R.connect();
  await R.hello(gull2, 'peer-gull', at(3), { name: 'Gull', tokenSub: 'acct-gull' });
  assert.deepEqual(welcomeOf(gull2).peers.map((p) => p.id).sort(), ['peer-alva', 'peer-hela'], 'a member\'s welcome: the members here, never the stranger');
  assert.equal(ids(host, 'join').filter((id) => id === 'peer-gull').length, 2, 'its hello said again to the members');
  assert.deepEqual(ids(str, 'join', strAt), [], 'and never to the stranger');
  // a tokenless hello: refused at the door, as in every room (ACC1g) - nobody told of it
  const anon = R.connect();
  await R.hello(anon, 'peer-anon', at(4), { name: 'Anon', tok: null });
  assert.deepEqual(anon.closed, { code: CLOSE_POLICY, reason: 'sign in to play online' }, 'no token, no room');
  assert.ok(!ids(host, 'join').includes('peer-anon'));
  // a member gone: said gone to the others
  await R.drop(alva);
  assert.ok(ids(host, 'leave').includes('peer-alva') && ids(gull2, 'leave').includes('peer-alva'), 'a member\'s close takes its body off every screen');
  // a member removed: said gone, and its steps reach nobody after
  await ps(R, host, 'kick', { m: idOf(readArenaOut(last(host, 'pss')), 'Gull') });
  assert.ok(ids(host, 'leave').includes('peer-gull'), 'the removed member said gone');
  const hostAt = host.sent.length;
  step(100); await R.pose(gull2, at(3, 1));
  assert.deepEqual(ids(host, 'pose', hostAt), [], 'and drawn to nobody after');
  // the session closed: every body it showed said gone to every other screen
  const brann = R.connect();
  await R.hello(brann, 'peer-brann', at(5), { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann' });
  await ps(R, brann, 'join');
  assert.ok(ids(brann, 'join').includes('peer-hela') && ids(host, 'join').includes('peer-brann'));
  await ps(R, host, 'close');
  assert.ok(ids(brann, 'leave').includes('peer-hela') && ids(host, 'leave').includes('peer-brann'), 'no ghost stands when the session ends');
  const brannAt = brann.sent.length;
  step(100); await R.pose(host, at(0, 1));
  assert.deepEqual(ids(brann, 'pose', brannAt), [], 'a room with no session draws nobody');
}));

test('HOTFIX 1003f a bout\'s stands are bodies: a spectator\'s welcome names the fighter and the stands before it, its hello is said to the room, its pose reaches the fighter and the other spectators, and its close is said; the fighter\'s pose reaches the stands (mutants: the stands drawn to nobody; a spectator\'s pose to nobody)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const R = W.room(arenaBoutRoom('00000000000000aa'));
  const f = R.connect();
  await R.hello(f, 'fight-ceryn', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-ceryn' });
  await word(R, f, { k: 'in', r: 'f', tier: 0, bout: 1, lv: 6, mh: 90, z: 'feedc0de00000001' });
  assert.equal(last(f, 'st')?.kind, 'pve', 'a ladder bout on the sand');
  const s1 = R.connect(), s2 = R.connect();
  await R.hello(s1, 'seat-sola', at(1), { name: 'Sola' });
  await word(R, s1, { k: 'in', r: 's' });
  await R.hello(s2, 'seat-tam', at(2), { name: 'Tam' });
  await word(R, s2, { k: 'in', r: 's' });
  assert.equal(last(f, 'sp').n, 2, 'two in the stands');
  assert.deepEqual(welcomeOf(s1).peers.map((p) => p.id), ['fight-ceryn'], 'the stands see the fighter');
  assert.deepEqual(welcomeOf(s2).peers.map((p) => p.id).sort(), ['fight-ceryn', 'seat-sola'], 'and the stands before them');
  assert.deepEqual(ids(f, 'join').sort(), ['seat-sola', 'seat-tam'], 'the fighter sees the stands');
  assert.deepEqual(ids(s1, 'join'), ['seat-tam'], 'the stands see each other');
  step(100); await R.pose(s1, at(1, 0.5));
  assert.ok(ids(f, 'pose').includes('seat-sola') && ids(s2, 'pose').includes('seat-sola'), 'a spectator\'s step reaches the fighter and the stands');
  step(300); await R.pose(f, { x: C[0] - 5.5, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 1 });
  assert.ok(ids(s1, 'pose').includes('fight-ceryn') && ids(s2, 'pose').includes('fight-ceryn'), 'the fighter\'s reaches the stands');
  await R.drop(s1);
  assert.ok(ids(f, 'leave').includes('seat-sola') && ids(s2, 'leave').includes('seat-sola'), 'a spectator gone is said gone');
}));

test('HOTFIX 1003f the client: a private session\'s Host and Join want an account held and my socket open - refused otherwise with the sign-in line, nothing entered; signed in and open, the floor is entered (mutants: the press never refused; signed out let through; a socket not open let through)', async () => {
  const open = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const screen = (signedIn, S) => {
    const doors = [];
    const A = createArenaOnline({
      now: () => 0, session: () => S, makeHall: () => null, bouts: { ask() {}, holds: () => false, dismiss() {} },
      account: { board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null },
      enterFloor: async (kind, o) => { doors.push([kind, o]); return true; }, closeWindow() {}, say() {}, guest: () => false, inBout: () => false,
      signedIn: () => signedIn, rand: (n) => new Uint8Array(n),
    });
    return { A, doors };
  };
  const line = ARENA_TEXT.online.privSignIn;
  assert.ok(line.length <= 90 && !/[—–]/.test(line), 'a short line, the house\'s dash');
  for (const [why, signedIn, S] of [['signed out', false, open], ['a socket reconnecting', true, { ...open, status: 'connecting' }], ['a socket refused at the door', true, { ...open, status: 'error' }]]) {
    const { A, doors } = screen(signedIn, S);
    assert.deepEqual(A.act('privHost'), { ok: false, text: line }, `${why}: Host`);
    assert.deepEqual(A.act('privJoin', { code: 'AAAAAA' }), { ok: false, text: line }, `${why}: Join`);
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(doors, [], `${why}: no floor entered`);
  }
  const { A, doors } = screen(true, open);
  assert.equal(A.act('privJoin', { code: 'aaa-aaa' }).ok, true, 'signed in and open: Join goes');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(doors, [['watch', 'pAAAAAA']]);
});
