// ARENA6 (2026-10-03, the owner: "I also want to add a way to simply host private matches. In this case, a streamer is
// hosting a tournement later today and I want them to be able to open a session where people can join, watch,
// participate, and allow the host of the session to choose who is fighting and who is in the crowd"; decided: every
// fighter of a session's bout equally whole, registered accounts fight and guests only watch, the host a registered
// account): A PRIVATE SESSION, `arena:p<code>`. The relay over fake sockets and fake objects (test/fakeRoom.mjs) - the
// Worker's door, the session opened, joined, picked, its casual bout refereed with equal health and kept in its results,
// voided, a member removed, the host's absence and the session's ends, the seat cap, the hall's list; the wire both ways;
// the client over the real modules (scenes/arenaOnline.js driving scenes/arenaBouts.js's relay mirror on a real Room);
// the window's model (systems/arenaBoard.js sessionCard and arenaBoard - the window itself is mounted in
// test/audit1003b_ui.test.js); and the hosts' seams. Design: bible/11-Multiplayer/Arena.md,
// the ARENA6 record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../server/src/index.js';
import { fakeRooms } from './fakeRoom.mjs';
import {
  ARENA_HALL, ARENA_FLOOR_CENTRE, ARENA_TICK_MS, ARENA_SPECTATORS_MAX, ARENA_PRIVATE_MEMBERS_MAX, ARENA_PRIVATE_VITALITY,
  ARENA_PRIVATE_HOST_GONE_MS, ARENA_PRIVATE_LIFE_MS, ARENA_PRIVATE_KEEP_MS, ARENA_PRIVATE_HIST_MAX, ARENA_PRIVATE_CODE_ALPHABET,
  ARENA_PRIVATE_CODE_RE, ARENA_NO_TEXT, arenaPrivateRoom, arenaPrivateCode, isArenaPrivateRoom, isArenaRoom, isArenaFloorRoom,
  arenaFloorRoomOf, privateCodeTyped, pvpVitality, validArenaIn, validArenaOut, privateSessionOver, ARENA_JOIN_WAIT_MS,
} from '../src/net/arenaLaw.js';
import { readArenaOut, parseClient } from '../src/net/wire.js';
import { callMs, COUNT_MS } from '../src/systems/arenaBout.js';

const C = ARENA_FLOOR_CENTRE;
const CODE = 'K7PX2M';
const ROOM = arenaPrivateRoom(CODE);
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const ps = (r, ws, a, extra = {}) => word(r, ws, { k: 'ps', a, ...extra });
const idOf = (pss, name) => pss.m.find((x) => x[1] === name)?.[0] ?? null;
/** A crowd's names (letters alone - the name filter's own law). */
const fan = (i) => `Fan${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'abcdefghijklmnopqrstuvwxyz'[Math.floor(i / 26)]}`;

/** A world on a fake clock (the Room's Date.now). */
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** The session's room with its host (Hela, registered) in it and the session open; `who` more sockets, each
 *  `[id, name, linked, extra]`, hello'd (not yet joined). */
async function session(W, who = []) {
  const R = W.room(ROOM);
  const host = R.connect();
  await R.hello(host, 'peer-hela', { x: C[0], y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Hela', kind: 'linked', tokenSub: 'acct-hela' });
  await ps(R, host, 'open');
  const out = { R, host };
  for (const [id, name, linked, extra = {}] of who) {
    const ws = R.connect();
    await R.hello(ws, `peer-${id}`, { x: C[0] + 1, y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name, ...(linked ? { kind: 'linked' } : {}), tokenSub: `acct-${id}`, ...extra });
    out[id] = ws;
  }
  return out;
}
/** The clock walked a beat at a time, the room's alarm fired each. */
async function walk(R, step, ms) { for (let t = 0; t < ms; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); } }

// ═══ THE RELAY ════════════════════════════════════════════════════════════════════════════════════════════════════════

test('ARENA6 the door and the code: the Worker opens `arena:p<code>` for a code of the unambiguous alphabet and no other; a private room is an arena floor room; a fresh code is six of the alphabet, drawn without bias; a typed code is upper-cased (mutants: the alphabet with an O, an I, a 1 or a 0; the code\'s length; a private room not a floor room; the Worker refusing it; the floor\'s room for a code missing; the code biased)', async () => {
  const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('x') }) } };
  const at = (k) => worker.fetch(new Request(`https://relay.invalid/room/${k}`), env);
  assert.equal((await at(ROOM)).status, 426, 'a private session\'s room: a socket only');
  for (const bad of ['arena:pK7PX2', 'arena:pK7PX2MM', 'arena:pK7PX2O', 'arena:pK7PX2I', 'arena:pK7PX2L', 'arena:pK7PX20', 'arena:pK7PX21', 'arena:pk7px2m', 'arena:p']) assert.equal((await at(bad)).status, 404, bad);
  assert.equal(ARENA_PRIVATE_CODE_ALPHABET, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', 'no I, L, O, 0 or 1 - nothing read as another off a stream');
  assert.equal(ARENA_PRIVATE_CODE_ALPHABET.length, 31);
  for (const ch of 'ILO01') assert.equal(ARENA_PRIVATE_CODE_RE.test(`K7PX2${ch}`), false, ch);
  assert.ok(isArenaPrivateRoom(ROOM) && isArenaRoom(ROOM) && isArenaFloorRoom(ROOM), 'an arena room, and a floor room - the bout law stands on it');
  assert.equal(arenaFloorRoomOf(`p${CODE}`), ROOM, 'the floor\'s instance entered for a session stands in its room');
  assert.equal(arenaFloorRoomOf('pK7PX2O'), null);
  // a fresh code: six letters of the alphabet, a byte past 247 thrown back (248 = 31 x 8 - no letter likelier)
  let calls = 0;
  const code = arenaPrivateCode((n) => { calls++; return calls === 1 ? Uint8Array.from([0, 30, 31, 247, 248, 255]) : Uint8Array.from([62, 93, 1, 2, 3, 4].slice(0, n)); });
  assert.equal(code, `A9A9AA`.slice(0, 4) + 'AA', 'bytes 0, 30, 31, 247 taken (A, 9, A, 9), 248 and 255 thrown back, the next draw\'s first two (62, 93 - A, A)');
  assert.ok(ARENA_PRIVATE_CODE_RE.test(arenaPrivateCode((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)))));
  assert.equal(privateCodeTyped(' k7p-x2m '), CODE);
});

test('ARENA6 the session opened: a registered account\'s `open` opens it and hosts it - every member told the whole session (`pss`), named by member ids and never an account; a guest cannot host; a second `open` of another is refused; a member joins and is told it; a guest joins to watch (mutants: a guest hosts; another\'s open takes the session; an account id on the wire; the join untold)', async () => onClock(async () => {
  const W = fakeRooms();
  // a guest's open is refused - the host is a registered account
  const G = W.room(arenaPrivateRoom('GUEST2'));
  const g = G.connect();
  await G.hello(g, 'peer-gull', null, { name: 'Gull', tokenSub: 'acct-gull' });
  await ps(G, g, 'open');
  assert.deepEqual(last(g, 'no'), { t: 'arena', k: 'no', m: 'host guest' });
  assert.equal(last(g, 'pss'), null, 'no session for a guest to host');
  assert.equal(await G.room._sessionOf(), null);
  // a registered host opens it
  const { R, host, alva, gull, brann } = await session(W, [['alva', 'Alva', true], ['gull', 'Gull', false], ['brann', 'Brann', true]]);
  const s0 = readArenaOut(last(host, 'pss'));
  assert.ok(s0, 'the host is told the session, as the wire reads it');
  assert.deepEqual([s0.c, s0.hn, s0.h, s0.me, s0.hm, s0.m, s0.r, s0.b, s0.o, s0.hist], [CODE, 'Hela', 1, 'm1', 'm1', [['m1', 'Hela', 0, 1, '', '']], '', '', '', []]);
  assert.equal(last(alva, 'pss'), null, 'a socket that has not joined is told nothing');
  await ps(R, alva, 'open');
  assert.equal(last(alva, 'no').m, 'taken', 'another\'s open is refused - the code is in use');
  assert.equal((await R.room._sessionOf()).host, 'acct-hela');
  await ps(R, alva, 'join', { bn: 'red' });
  await ps(R, gull, 'join');
  const sa = readArenaOut(last(alva, 'pss'));
  assert.deepEqual([sa.h, sa.me], [0, 'm2'], 'Alva joins - not the host, her own member id');
  const sh = readArenaOut(last(host, 'pss'));
  assert.deepEqual(sh.m, [['m1', 'Hela', 0, 1, '', ''], ['m2', 'Alva', 0, 1, '', 'red'], ['m3', 'Gull', 1, 1, '', '']], 'the host told each who joined: Alva with her banner, Gull a guest');
  assert.ok(!JSON.stringify(arena(host)).includes('acct-'), 'never an account\'s id on the wire');
  assert.ok(!JSON.stringify(arena(gull)).includes('acct-'));
  assert.equal(last(brann, 'pss'), null);
}));

test('ARENA6 the host\'s words: pick, go, void, kick and close are the host\'s alone; a guest cannot be picked, nor a member gone, nor one on both sides; a pick moves a member from the other side (mutants: a member\'s pick taken; a guest picked; one fighter both sides; a gone member picked; go without picks)', async () => onClock(async () => {
  const W = fakeRooms();
  const { R, host, alva, gull, brann } = await session(W, [['alva', 'Alva', true], ['gull', 'Gull', false], ['brann', 'Brann', true]]);
  for (const ws of [alva, gull, brann]) await ps(R, ws, 'join');
  const s = readArenaOut(last(host, 'pss'));
  const [mA, mG, mB] = [idOf(s, 'Alva'), idOf(s, 'Gull'), idOf(s, 'Brann')];
  for (const [a, extra] of [['pick', { r: mA }], ['go', {}], ['void', {}], ['kick', { m: mB }], ['close', {}]]) {
    await ps(R, alva, a, extra);
    assert.equal(last(alva, 'no').m, 'host only', `${a}: the host's alone`);
  }
  assert.equal((await R.room._sessionOf()).red, null);
  await ps(R, host, 'pick', { r: mG });
  assert.equal(last(host, 'no').m, 'guest fighter', 'a guest watches; only a registered account fights');
  await ps(R, host, 'pick', { r: mA, b: mA });
  assert.equal(last(host, 'no').m, 'same fighter');
  await ps(R, host, 'go');
  assert.equal(last(host, 'no').m, 'no picks');
  await ps(R, host, 'pick', { r: mA, b: mB });
  let p = readArenaOut(last(gull, 'pss'));
  assert.deepEqual([p.r, p.b], [mA, mB], 'every member sees the picks');
  await ps(R, host, 'pick', { b: mA });
  p = readArenaOut(last(host, 'pss'));
  assert.deepEqual([p.r, p.b], ['', mA], 'Alva picked for Blue moves there - the Red is empty');
  await ps(R, host, 'pick', { r: 'm1' });
  p = readArenaOut(last(host, 'pss'));
  assert.equal(p.r, 'm1', 'the host may pick themselves');
  await R.drop(brann);
  await ps(R, host, 'pick', { r: mB });
  assert.equal(last(host, 'no').m, 'not here', 'a member gone is not picked');
  assert.equal(readArenaOut(last(host, 'pss')).m.find((x) => x[0] === mB)[3], 0, 'and is said gone');
  await ps(R, host, 'pick', { r: 'm9' });
  assert.equal(last(host, 'no').m, 'not here', 'nor one never a member');
  await ps(R, gull, 'pick', { r: mA });
  assert.equal(last(gull, 'no').m, 'host only');
}));

test('ARENA6 THE BOUT: the host\'s go opens a refereed casual bout between the two - every fighter ARENA_PRIVATE_VITALITY whole whatever their levels, the others in the stands; blows judged by PVP-REF; no receipt; the result kept in the session\'s results and the session back to choosing, its fighters off the sand; never on the hall\'s list (mutants: health by level; a receipt minted; the result not kept; the bout told to the hall; the bout never cleared; a stands pose taken for the fighter\'s place)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const H = W.room(ARENA_HALL);
  const watcher = H.connect();
  await H.hello(watcher, 'peer-watch', null, { name: 'Wat' });
  const { R, host, alva, brann, gull } = await session(W, [['alva', 'Alva', true, { lv: 3 }], ['brann', 'Brann', true, { lv: 50 }], ['gull', 'Gull', false]]);
  R.env.GATE_SIGNING_KEY = 'unused';   // a receipt minted would try it - none is
  for (const ws of [alva, brann, gull]) await ps(R, ws, 'join');
  const s = readArenaOut(last(host, 'pss'));
  const [mA, mB] = [idOf(s, 'Alva'), idOf(s, 'Brann')];
  await ps(R, host, 'pick', { r: mA, b: mB });
  await ps(R, host, 'go');
  const sg = readArenaOut(last(gull, 'pss'));
  assert.ok(/^[0-9a-f]{16}$/.test(sg.o), 'the bout\'s id');
  assert.deepEqual([sg.ph, sg.f], ['wait', [mA, mB]], 'its two, waiting for them on the sand');
  const o = sg.o;
  // each comes as its pss says: the two to the sand, the rest to the stands
  await word(R, alva, { k: 'in', r: 'f' });
  await word(R, gull, { k: 'in', r: 's' });
  await word(R, host, { k: 'in', r: 's' });
  await word(R, brann, { k: 'in', r: 'f' });
  const st = readArenaOut(last(alva, 'st'));
  assert.deepEqual([st.o, st.kind, st.u, st.me, st.sp], [o, 'pvp', 1, 'p0', 2], 'a casual players\' bout, Alva the Red (p0), two in the stands');
  assert.equal(readArenaOut(last(brann, 'st')).me, 'p1', 'Brann the Blue');
  assert.equal(readArenaOut(last(gull, 'st')).me, '', 'Gull in the stands');
  assert.deepEqual(st.f.map((f) => [f[0], f[1], f[3], f[4]]), [['p0', 'Alva', ARENA_PRIVATE_VITALITY, ARENA_PRIVATE_VITALITY], ['p1', 'Brann', ARENA_PRIVATE_VITALITY, ARENA_PRIVATE_VITALITY]], 'EQUAL HEALTH: level 3 and level 50 alike');
  assert.notEqual(pvpVitality(3), pvpVitality(50), 'a rated bout would have held them apart');
  assert.equal(ARENA_PRIVATE_VITALITY, pvpVitality(30), 'a level-30 fighter\'s rated vitality - the middle of the range');
  assert.ok(gull.sent.some((m) => m.t === 'join' && m.id === 'peer-alva') && gull.sent.some((m) => m.t === 'join' && m.id === 'peer-brann'), 'the stands see both fighters come onto the sand');
  // the fighters' places are their marks, never the terrace their sockets last said
  const B = await R.room._boutOf();
  assert.deepEqual(B.last.p0.slice(0, 2), [C[0] - 6, C[2]], 'the Red on the west mark');
  assert.deepEqual(B.last.p1.slice(0, 2), [C[0] + 6, C[2]], 'the Blue on the east');
  // never on the hall's list
  await word(H, watcher, { k: 'ls' });
  assert.deepEqual(last(watcher, 'live').l, [], 'the hall lists no private bout');
  assert.equal(Object.keys((await H.room._hallOf()).live).length, 0);
  // the fight: the call, the count; Brann beaten down by Alva's claims in reach
  await walk(R, step, callMs({ fighters: [0, 0] }) + 300 + COUNT_MS + 600);
  assert.equal(readArenaOut(last(alva, 'st')).ph, 'fight');
  await R.pose(alva, { x: C[0] + 4.6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 });
  for (let i = 0; i < 60 && !(await R.room._boutOf())?.res; i++) { step(1000); await R.fire(); await word(R, alva, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 10 + i }); }
  const res = (await R.room._boutOf()).res;
  assert.deepEqual([res.side, res.how], [0, 'fall'], 'the Red wins - by the referee\'s count');
  assert.equal(last(alva, 'rc'), null, 'NO RECEIPT: nothing of it is the realm\'s to keep');
  assert.deepEqual((await R.room._boutOf()).owed, []);
  // the result kept, every member told
  const kept = readArenaOut(last(gull, 'pss'));
  assert.deepEqual(kept.hist, [['Alva', 'Brann', 0, 'fall']], 'the session\'s results: the Red, the Blue, the winner, how');
  // the healers, the keep, and back to choosing - the fighters off the sand (HOTFIX 1003f: and still drawn, in the stands)
  await walk(R, step, 15_000 + ARENA_PRIVATE_KEEP_MS + 1000);
  assert.equal(await R.room._boutOf(), null, 'the bout cleared');
  const back = readArenaOut(last(host, 'pss'));
  assert.deepEqual([back.o, back.ph, back.f, back.r, back.b], ['', '', [], mA, mB], 'back to choosing, the picks kept for a rematch');
  assert.ok(!gull.sent.some((m) => m.t === 'leave' && m.id === 'peer-alva'), 'HOTFIX 1003f: the Red stays drawn - back in the stands, a member as every member is');
  const att = alva.deserializeAttachment();
  assert.deepEqual([att.af, att.asp], [0, 0], 'every socket out of the bout');
  await word(H, watcher, { k: 'ls' });
  assert.deepEqual(last(watcher, 'live').l, [], 'and never on the list after');
  // a second bout: the stands seat again from nothing
  await ps(R, host, 'go');
  const o2 = readArenaOut(last(host, 'pss')).o;
  assert.ok(o2 && o2 !== o, 'a new bout, its own id');
  await word(R, gull, { k: 'in', r: 's' });
  assert.equal(readArenaOut(last(gull, 'st')).o, o2);
  assert.equal(readArenaOut(last(gull, 'st')).sp, 1, 'a seat taken again in the next bout');
}));

test('ARENA6 void, kick and the session\'s ends: the host\'s void ends the bout with no result; a member removed is told, taken off the sand, refused again for the session\'s life; the host gone and back keeps it; it ends ARENA_PRIVATE_HOST_GONE_MS after the host went, at the host\'s close, and ARENA_PRIVATE_LIFE_MS after it opened (mutants: a void kept as a result; the removed let back; the removed one\'s bout left standing; the session ended the moment its host blinked; the timeouts changed; close left to stand)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const { R, host, alva, brann, gull } = await session(W, [['alva', 'Alva', true], ['brann', 'Brann', true], ['gull', 'Gull', false]]);
  for (const ws of [alva, brann, gull]) await ps(R, ws, 'join');
  const s = readArenaOut(last(host, 'pss'));
  const [mA, mB, mG] = [idOf(s, 'Alva'), idOf(s, 'Brann'), idOf(s, 'Gull')];
  await ps(R, host, 'void');
  assert.equal(last(host, 'no').m, 'no bout');
  await ps(R, host, 'pick', { r: mA, b: mB });
  await ps(R, host, 'go');
  await word(R, alva, { k: 'in', r: 'f' }); await word(R, brann, { k: 'in', r: 'f' });
  await walk(R, step, 3000);
  await ps(R, host, 'pick', { r: mB });
  assert.equal(last(host, 'no').m, 'bout on', 'no pick while a bout stands');
  await ps(R, host, 'void');
  assert.equal(last(gull, 'no').m, 'voided', 'every member told');
  assert.equal(await R.room._boutOf(), null);
  const v = readArenaOut(last(gull, 'pss'));
  assert.deepEqual([v.o, v.hist], ['', []], 'no result kept');
  // a member removed mid-bout: its bout void, it told, out of the stands, refused for the session's life
  await ps(R, host, 'go');
  await word(R, alva, { k: 'in', r: 'f' }); await word(R, brann, { k: 'in', r: 'f' }); await word(R, gull, { k: 'in', r: 's' });
  await ps(R, host, 'kick', { m: mB });
  assert.equal(last(brann, 'no').m, 'removed');
  assert.equal(last(alva, 'no').m, 'voided', 'a fighter removed: the bout void');
  assert.equal(await R.room._boutOf(), null);
  const k = readArenaOut(last(host, 'pss'));
  assert.equal(k.m.some((x) => x[1] === 'Brann'), false, 'out of the members');
  assert.equal(k.b, '', 'and out of the picks');
  assert.equal(brann.closed, null, 'told, never closed - the relay closing it would leave its screen offline');
  const told = arena(brann).length;
  await ps(R, brann, 'join');
  assert.equal(last(brann, 'no').m, 'removed', 'refused again');
  await word(R, brann, { k: 'in', r: 's' });
  assert.equal(last(brann, 'no').m, 'removed');
  assert.equal(arena(brann).slice(told).some((m) => m.k === 'pss'), false, 'and told nothing of the session again');
  await ps(R, host, 'kick', { m: 'm1' });
  assert.equal(last(host, 'no').m, 'host only', 'the host never removes themselves');
  // the host gone and back: the session stands
  await R.drop(host);
  assert.ok((await R.room._sessionOf()).hostGoneAt != null, 'the host\'s absence stamped');
  assert.equal(readArenaOut(last(gull, 'pss')).m[0][3], 0, 'and said');
  step(ARENA_PRIVATE_HOST_GONE_MS - 60_000); await R.fire();
  assert.ok(await R.room._sessionOf(), 'fourteen minutes: still open');
  const host2 = R.connect();
  await R.hello(host2, 'peer-hela', null, { name: 'Hela', kind: 'linked', tokenSub: 'acct-hela', secret: 'secret-of-peer-hela' });
  await ps(R, host2, 'open');
  const back = readArenaOut(last(host2, 'pss'));
  assert.deepEqual([back.h, back.me, back.m.find((x) => x[1] === 'Gull')?.[0]], [1, 'm1', mG], 'the host is the host again - the same session, its members kept');
  assert.equal((await R.room._sessionOf()).hostGoneAt, null);
  step(ARENA_PRIVATE_HOST_GONE_MS); await R.fire();
  assert.ok(await R.room._sessionOf(), 'its absence forgotten');
  // gone for good: it ends at the fifteenth minute, every member told
  await R.drop(host2);
  step(ARENA_PRIVATE_HOST_GONE_MS + 1000); await R.fire();
  assert.equal(await R.room._sessionOf(), null, 'ended');
  assert.equal(last(gull, 'no').m, 'ended');
  assert.deepEqual([ARENA_PRIVATE_HOST_GONE_MS, ARENA_PRIVATE_LIFE_MS], [15 * 60_000, 8 * 3600_000]);
  await ps(R, gull, 'join');
  assert.equal(last(gull, 'no').m, 'no session');
  // the host's close
  const W2 = fakeRooms();
  const T = await session(W2, [['alva', 'Alva', true]]);
  await ps(T.R, T.alva, 'join');
  await ps(T.R, T.host, 'close');
  assert.equal(last(T.alva, 'no').m, 'closed');
  assert.equal(await T.R.room._sessionOf(), null);
  assert.equal(T.R.store.has('arenasession'), false, 'nothing kept');
  // its life: eight hours whoever stays
  const W3 = fakeRooms();
  const L = await session(W3, [['alva', 'Alva', true]]);
  await ps(L.R, L.alva, 'join');
  for (let h = 0; h < 8; h++) { step(3600_000 - 1000); await L.R.fire(); if (h < 7) assert.ok(await L.R.room._sessionOf(), `hour ${h + 1}`); }
  step(8000); await L.R.fire();
  assert.equal(await L.R.room._sessionOf(), null, 'eight hours: ended');
  assert.equal(last(L.alva, 'no').m, 'ended');
  assert.equal(privateSessionOver({ at: 0, hostGoneAt: null }, ARENA_PRIVATE_LIFE_MS - 1), null);
  assert.equal(privateSessionOver({ at: 0, hostGoneAt: 10 }, 10 + ARENA_PRIVATE_HOST_GONE_MS), 'host');
}));

test('ARENA6 the seats: a session holds ARENA_PRIVATE_MEMBERS_MAX (the stands\' sixty and the two on the sand); a newcomer to a full one takes the place of the member longest gone, never one here, and is refused when all are here; a stranger takes no place at its bout; a member\'s `in` never opens a ladder bout (mutants: the cap unbounded or changed; one here evicted; a stranger seated; a ladder bout opened in a session\'s room)', async () => onClock(async ({ step }) => {
  assert.equal(ARENA_PRIVATE_MEMBERS_MAX, ARENA_SPECTATORS_MAX + 2);
  assert.equal(ARENA_PRIVATE_MEMBERS_MAX, 62);
  const W = fakeRooms();
  const { R, host } = await session(W);
  const socks = [];
  for (let i = 0; i < ARENA_PRIVATE_MEMBERS_MAX - 1; i++) {
    const ws = R.connect();
    await R.hello(ws, `peer-n${i}`, null, { name: fan(i), kind: 'linked', tokenSub: `acct-n${i}` });
    await ps(R, ws, 'join');
    socks.push(ws);
    step(1000);   // the room's hellos, at the relay's own rate (HELLO_HZ_MAX)
  }
  assert.equal(Object.keys((await R.room._sessionOf()).members).length, ARENA_PRIVATE_MEMBERS_MAX);
  const late = R.connect();
  await R.hello(late, 'peer-late', null, { name: 'Late', kind: 'linked', tokenSub: 'acct-late' });
  await ps(R, late, 'join');
  assert.equal(last(late, 'no').m, 'session full', 'every one of them here');
  await R.drop(socks[5]); step(10);
  await R.drop(socks[2]);
  await ps(R, late, 'join');
  const sl = readArenaOut(last(late, 'pss'));
  assert.ok(sl && sl.me, 'the newcomer takes a place');
  const names = sl.m.map((x) => x[1]);
  assert.ok(!names.includes(fan(5)) && names.includes(fan(2)), 'the place of the member gone longest');
  assert.equal(sl.m.length, ARENA_PRIVATE_MEMBERS_MAX);
  // a stranger (no join) takes no place at the bout; nor does an `in` before a bout open one
  const S0 = await R.room._sessionOf();
  await ps(R, host, 'pick', { r: S0.members['acct-n0'].id, b: S0.members['acct-n1'].id });
  const stranger = R.connect();
  await R.hello(stranger, 'peer-str', null, { name: 'Stranger', kind: 'linked', tokenSub: 'acct-str' });
  await word(R, stranger, { k: 'in', r: 'f', tier: 0, bout: 0, lv: 5 });
  assert.equal(last(stranger, 'no').m, 'not member');
  // AUDIT ARENA-LADDER 2 (PIN MOVED): with a ticket - a ticketless ladder `in` is told 'no bout' by the ladder's own door, so
  // only a ticketed one shows the session room refusing to open a ladder bout
  await word(R, socks[0], { k: 'in', r: 'f', tier: 0, bout: 0, lv: 5, z: 'feedc0de000000e1' });
  assert.equal(last(socks[0], 'no').m, 'no bout', 'a member\'s `in` with no bout standing - and an `in` here opens no ladder bout');
  assert.equal(await R.room._boutOf(), null);
  await ps(R, host, 'go');
  await word(R, stranger, { k: 'in', r: 's' });
  assert.equal(last(stranger, 'no').m, 'not member', 'a stranger is no member');
  assert.equal(last(stranger, 'st'), null);
  void ARENA_JOIN_WAIT_MS;
}));

test('ARENA6 the wire: a session word in is projected and junk refused - only its acts, member ids or none, a kick naming one; a session word out is projected - its code, its members, its picks, its bout and its results - and a malformed one refused; every refusal has its words (mutants: an unknown act taken; an account id taken for a member; a pss with a bad code, a bad member, too many, a bad phase or one fighter accepted; a refusal unsaid)', () => {
  assert.deepEqual(validArenaIn({ k: 'ps', a: 'open', bn: 'blue' }), { k: 'ps', a: 'open', bn: 'blue' });
  assert.deepEqual(validArenaIn({ k: 'ps', a: 'join', bn: 'green' }), { k: 'ps', a: 'join' }, 'a banner of no banner dropped, never refused');
  assert.deepEqual(validArenaIn({ k: 'ps', a: 'pick', r: 'm3', b: '' }), { k: 'ps', a: 'pick', r: 'm3', b: '' });
  assert.deepEqual(validArenaIn({ k: 'ps', a: 'kick', m: 'm12' }), { k: 'ps', a: 'kick', m: 'm12' });
  assert.deepEqual(validArenaIn({ k: 'ps', a: 'go', r: 'm1' }), { k: 'ps', a: 'go' });
  assert.deepEqual(validArenaIn({ k: 'ps', a: 'lock', l: 1 }), { k: 'ps', a: 'lock', l: 1 });   // AUDIT PRE-MERGE 1003b S4
  for (const bad of [{ k: 'ps', a: 'host' }, { k: 'ps' }, { k: 'ps', a: 'pick' }, { k: 'ps', a: 'pick', r: 'acct-alva' }, { k: 'ps', a: 'pick', r: 'm0' }, { k: 'ps', a: 'pick', b: 7 }, { k: 'ps', a: 'kick' }, { k: 'ps', a: 'kick', m: '' }, { k: 'ps', a: 'kick', m: 'm1000' }, { k: 'ps', a: 'lock' }, { k: 'ps', a: 'lock', l: 2 }]) assert.equal(validArenaIn(bad), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'arena', k: 'ps', a: 'close' }), { hasHello: true }), { t: 'arena', k: 'ps', a: 'close' });
  const pss = { k: 'pss', c: CODE, hn: 'Hela', hm: 'm1', h: 1, me: 'm1', m: [['m1', 'Hela', 0, 1, 'sprout', ''], ['m2', 'Alva', 0, 0, '', 'red'], ['m3', 'Gull', 1, 1, '', '']], r: 'm2', b: 'm1', o: '0123456789abcdef', ph: 'fight', f: ['m2', 'm1'], hist: [['Alva', 'Hela', 1, 'yield'], ['Hela', 'Gull', -1, 'judges']], lo: 0 };   // AUDIT PRE-MERGE 1003b S4: `lo` the lock
  assert.deepEqual(validArenaOut(pss), pss);
  assert.deepEqual(readArenaOut({ t: 'arena', ...pss }), pss);
  const bad = (over) => validArenaOut({ ...pss, ...over });
  for (const [what, over] of [
    ['a code of the wrong alphabet', { c: 'K7PX2O' }], ['no host name', { hn: '' }], ['h not a bit', { h: 2 }], ['an account for me', { me: 'acct-hela' }],
    ['a member of five fields', { m: [['m1', 'Hela', 0, 1, '']] }], ['an account as a member id', { m: [['acct-x', 'X', 0, 1, '', '']] }], ['a member\'s title not a title', { m: [['m1', 'H', 0, 1, 'Sir <b>', '']] }],
    ['a banner of no banner', { m: [['m1', 'H', 0, 1, '', 'green']] }], ['too many members', { m: Array.from({ length: ARENA_PRIVATE_MEMBERS_MAX + 1 }, (_, i) => [`m${i + 1}`, 'X', 0, 1, '', '']) }],
    ['a bout id not one', { o: 'xyz' }], ['a phase not one', { ph: 'brawl' }], ['one fighter', { f: ['m2'] }], ['too many results', { hist: Array.from({ length: ARENA_PRIVATE_HIST_MAX + 1 }, () => ['A', 'B', 0, 'fall']) }],
    ['a winner of three', { hist: [['A', 'B', 2, 'fall']] }], ['a lock not a bit', { lo: 2 }], ['no lock', { lo: undefined }],
  ]) assert.equal(bad(over), null, what);
  for (const m of ['host guest', 'taken', 'no session', 'removed', 'session full', 'host only', 'not member', 'not here', 'guest fighter', 'same fighter', 'bout on', 'no picks', 'voided', 'closed', 'ended', 'locked', 'has result', 'no contest']) {   // AUDIT PRE-MERGE 1003b: the lock's, the result's, both gone
    assert.ok(typeof ARENA_NO_TEXT[m] === 'string' && ARENA_NO_TEXT[m].length > 8 && ARENA_NO_TEXT[m].length <= 90, `"${m}" said`);
    assert.deepEqual(validArenaOut({ k: 'no', m }), { k: 'no', m });
  }
});

// ═══ THE CLIENT ═══════════════════════════════════════════════════════════════════════════════════════════════════════

import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { sessionCard, arenaBoard } from '../src/systems/arenaBoard.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';

const settled = () => new Promise((r) => setTimeout(r, 0));
/** A client's presence socket in a real Room, as net/online.js's session is to the arena (test/audit1003_online.test.js's
 *  shape): a word sent goes through validArenaIn into the Room while it stands in an arena room; the Room's words come
 *  back through readArenaOut (`pump`). */
function clientSocket(R, ws, room) {
  let seen = 0;
  const s = {
    status: 'open', arenaOk: true, room, ws, q: [],
    sendArena(w) { const v = validArenaIn(w); if (!v || s.status !== 'open' || !isArenaRoom(s.room)) return false; s.q.push(word(R, s.ws, v)); return true; },
    async flush() { while (s.q.length) await Promise.all(s.q.splice(0)); },
    pump(onArena) { const out = s.ws.sent.slice(seen); seen = s.ws.sent.length; for (const m of out) if (m.t === 'arena') { const w = readArenaOut(m); if (w) onArena(w, s.room); } },
  };
  return s;
}
const floorStage = () => ({ kind: 'floor', centre: () => [...C], spawn: async (m, feet) => ({ mobile: m, entity: { health: 20, maxHealth: 20 }, attack: {}, ai: { feet: [...feet], walkTo() {} } }), remove() {}, heightAt: () => null });
/** One screen: the real bout driver on the floor and the real online half over its socket - every door it opens noted. */
function screen(R, ws, name, { guest = false, outdoors = true } = {}) {
  const P = { name, health: 200, maxHealth: 200 };
  const D = createArenaBouts({ now: () => Date.now(), playerEntity: P, say() {}, notice() {}, drawHud() {}, heal: () => { P.health = P.maxHealth; }, pay() {} });
  D.setStage(floorStage());
  const S = clientSocket(R, ws, 'world:1,1');
  const doors = [], said = [];
  const A = createArenaOnline({
    now: () => Date.now(), session: () => S, makeHall: () => null, bouts: D, account: { board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null },
    enterFloor: async (kind, o) => { doors.push(['enter', kind, o]); if (!outdoors) return false; S.room = arenaFloorRoomOf(o); return true; },   // the floor's door refuses a screen indoors (worldModes.js enterArenaFloor)
    standOnMark: (kind) => { doors.push(['mark', kind]); return true; }, leaveFloor: () => { doors.push(['leave']); S.room = 'world:1,1'; return true; },
    closeWindow: () => doors.push(['closeWindow']), say: (l) => said.push(l), guest: () => guest, inBout: () => D.holds(), level: () => 20,
    rand: (n) => new Uint8Array(n),   // every byte nought: the code AAAAAA
  });
  return { P, D, S, A, doors, said, async beat() { A.tick(); await S.flush(); S.pump((w, room) => A.word(w, room)); } };
}

test('ARENA6 THE CLIENT, END TO END on the real Room: Host a session enters the floor\'s instance as its room and opens it; Join with a typed code joins it; the host picks and calls the bout - each fighter\'s screen brought down to its side\'s mark and its mirror a fighter\'s, every fighter ARENA_PRIVATE_VITALITY whole; the window draws the host\'s presses to the host alone; the host\'s void sends the fighters back to the stands; Close session takes every screen out of the instance (mutants: the session\'s word never said; a pss not kept; the fighter left in the stands; the fighters left on the sand; the session\'s end not leaving; a bad code sent; the host\'s presses on a member\'s card)', async () => {
  await onClock(async ({ step }) => {
    const W = fakeRooms();
    const R = W.room(arenaPrivateRoom('AAAAAA'));
    const hw = R.connect(), bw = R.connect();
    await R.hello(hw, 'peer-hela', { x: C[0], y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Hela', kind: 'linked', tokenSub: 'acct-hela' });
    await R.hello(bw, 'peer-brann', { x: C[0] + 1, y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann' });
    const H = screen(R, hw, 'Hela'), B = screen(R, bw, 'Brann');
    // the host's press: the instance entered as the session's room, the session opened there
    assert.deepEqual(H.A.act('privHost'), { ok: true, text: '' });
    await settled();
    assert.deepEqual(H.doors.slice(0, 2), [['closeWindow'], ['enter', 'watch', 'pAAAAAA']]);
    await H.beat();
    assert.equal(H.A.session()?.state?.h, 1, 'the host is told it hosts it');
    assert.equal(H.A.session().state.c, 'AAAAAA');
    // a member's press: the code typed as a player types it
    assert.deepEqual(B.A.act('privJoin', { code: 'nope' }), { ok: false, text: ARENA_TEXT.online.privBadCode }, 'a code that is not one is refused at the press');
    assert.equal(B.A.session(), null, 'and nothing entered for it');
    assert.equal(B.A.act('privJoin', { code: 'aaa-aaa' }).ok, true);
    await settled();
    await B.beat(); await H.beat();
    const st = H.A.session().state;
    assert.equal(st.m.length, 2);
    const hela = idOf(st, 'Hela'), brann = idOf(st, 'Brann');
    // the window: the host's presses to the host, the member's Leave to the member
    const hostCard = sessionCard(H.A.model().session);
    const memberCard = sessionCard(B.A.model().session);
    assert.ok(hostCard.acts.some((a) => a.act === 'privGo') && hostCard.members.some((m) => m.acts.some((a) => a.act === 'privPick')), 'the host picks and starts');
    assert.ok(!memberCard.acts.some((a) => a.act === 'privGo') && memberCard.members.every((m) => m.acts.length === 0), 'a member presses nothing of the host\'s');
    assert.ok(memberCard.acts.some((a) => a.act === 'privLeave'));
    assert.equal(B.A.act('privGo').ok, false, 'refused at the member\'s press too');
    assert.equal(hostCard.code, 'AAAAAA');
    // the host picks Brann the Red and themself the Blue, and calls it
    assert.equal(H.A.act('privPick', { r: brann, b: hela }).ok, true);
    await H.S.flush(); await H.beat(); await B.beat();
    assert.equal(H.A.act('privGo').ok, true);
    await H.S.flush(); await H.beat(); await B.beat();
    assert.ok(B.doors.some((d) => d[0] === 'mark' && d[1] === 'ladder'), 'the Red brought down to side 0\'s mark');
    assert.ok(H.doors.some((d) => d[0] === 'mark' && d[1] === 'rival'), 'the Blue to side 1\'s');
    assert.equal(B.A.bout()?.kind, 'pvp');
    assert.equal(B.A.me(), 'p0');
    assert.equal(H.A.me(), 'p1');
    await H.beat(); await B.beat();   // each fighter's `in`
    await walk(R, step, callMs({ fighters: [0, 0] }) + 300 + COUNT_MS + 600);
    await H.beat(); await B.beat();
    const sw = last(bw, 'st');
    assert.equal(sw.ph, 'fight', 'the fight is on');
    assert.deepEqual(sw.f.map((x) => x[4]), [ARENA_PRIVATE_VITALITY, ARENA_PRIVATE_VITALITY], 'equally whole');
    assert.ok(B.D.holds(), 'the Red is held on the sand while it fights');
    // the host's void: the bout gone with no result, the fighters back up in the stands
    assert.equal(H.A.act('privVoid').ok, true);
    await H.S.flush(); await H.beat(); await B.beat();
    assert.equal(B.A.bout(), null);
    assert.ok(!B.D.holds(), 'the hold let go');
    assert.deepEqual(B.doors.at(-1), ['mark', 'watch'], 'back to the terrace');
    assert.deepEqual(H.doors.at(-1), ['mark', 'watch']);
    assert.equal(H.A.session().state.o, '');
    // the host closes it: every screen out of the instance, the session let go
    assert.equal(H.A.act('privClose').ok, true);
    await H.S.flush(); await H.beat(); await B.beat();
    assert.deepEqual(B.doors.at(-1), ['leave']);
    assert.deepEqual(H.doors.at(-1), ['leave']);
    assert.equal(B.A.session(), null);
    assert.equal(H.A.session(), null);
    assert.ok(B.said.includes(ARENA_NO_TEXT.closed));
  });
});

test('ARENA6 the client\'s refusals and the card out of a session: a guest\'s Host is refused (a guest may join to watch); in a session the challenge waits; the card offers Host and Join with its field; the floor\'s door refused (indoors) says so and holds nothing (mutants: a guest hosting; the queue pressed in a session; the card without its join; the refusal unsaid; the card missing before the board; the session held)', async () => {
  const W = fakeRooms();
  const R = W.room(arenaPrivateRoom('AAAAAA'));
  const gw = R.connect();
  await R.hello(gw, 'peer-gil', null, { name: 'Gil', tokenSub: 'acct-gil' });
  const G = screen(R, gw, 'Gil', { guest: true });
  assert.deepEqual(G.A.act('privHost'), { ok: false, text: ARENA_NO_TEXT['host guest'] });
  const out = sessionCard(G.A.model().session, { guest: true });
  assert.equal(out.acts[0].act, 'privHost');
  assert.equal(out.acts[0].why, ARENA_TEXT.online.privHostGuest);
  assert.equal(out.join.label, ARENA_TEXT.online.privJoin, 'the join field stands');
  assert.equal(G.A.act('privJoin', { code: 'AAAAAA' }).ok, true, 'a guest joins to watch');
  await settled();
  assert.deepEqual(G.A.act('queue'), { ok: false, text: ARENA_TEXT.online.privIn }, 'one place at a time');
  // the window's model carries the session's card on the Bouts page, online, before the realm's board is in
  const m = arenaBoard({ ladder: null, league: null, gameMinutes: 0, name: 'Gil', online: G.A.model(), replays: [] });
  assert.ok(m.bouts.cards.some((c) => c.kind === 'session'));
  // ARENA6: the floor's door refused (a screen indoors, or down) - the press SAYS so and nothing is held; it said only
  // "To the arena" and fell silent, and a host on a stream saw nothing happen
  const iw = R.connect();
  await R.hello(iw, 'peer-ida', null, { name: 'Ida', kind: 'linked', tokenSub: 'acct-ida' });
  const I = screen(R, iw, 'Ida', { outdoors: false });
  assert.equal(I.A.act('privHost').ok, true);
  await settled();
  assert.deepEqual(I.said, [ARENA_TEXT.online.privEntering('AAAAAA'), ARENA_TEXT.online.privOutdoors], 'the refusal said');
  assert.equal(I.A.inSession(), false, 'no session held');
  assert.equal(I.A.model().session.in, false);
});

test('ARENA6 the hosts\' seams, by source: the online half is handed the instance\'s mark and its way out; the floor\'s host moves a session\'s fighter by the made level\'s own arrival points and leaves by its gates\' own way; the pause menu\'s Arena door opens on the session\'s page while one is stood in (mutants: a seam unwired)', () => {
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const world = rd('src/scenes/world.js'), modes = rd('src/scenes/worldModes.js'), gate = rd('src/scenes/arenaGate.js');
  assert.match(world, /standOnMark: \(kind\) => modes\?\.standOnArenaMark\?\.\(kind\) \?\? false,/);
  assert.match(world, /leaveFloor: \(\) => modes\?\.leaveArenaFloor\?\.\(\) \?\? false,/);
  assert.match(world, /arenaJoined: \(\) => arenaGate\.joined\(\) \|\| !!arenaOnline\?\.inSession\?\.\(\),/);
  assert.match(world, /makeArenaWindow: \(page\) => arenaGate\.windowOverlay\(arenaOnline\?\.inSession\?\.\(\) \? 'bouts' : page\),/);
  assert.match(modes, /function standOnArenaMark\(kind\) \{\n\s*if \(mode !== 'dungeon' \|\| !isArenaFloor\(dungeonLoc\)\) return false;/);
  assert.match(modes, /placeLoadedPlayer\(arenaFloorPoint\(a\.at\[0\], a\.at\[1\], a\.at\[2\] \+ 0\.4, arenaFloorCentre\(\)\)\);/);
  assert.match(modes, /function leaveArenaFloor\(\) \{\n\s*if \(mode !== 'dungeon' \|\| !isArenaFloor\(dungeonLoc\) \|\| host\.arenaHolds\?\.\(\)\) return false;/);
  assert.match(gate, /if \(typeof kind === 'string' && kind\.startsWith\('priv'\)\) return online\(\)\?\.act\(kind, data\)/);
});
