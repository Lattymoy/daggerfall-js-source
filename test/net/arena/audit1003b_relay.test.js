// AUDIT PRE-MERGE 1003b (2026-10-03, the owner: "We're going to do one last deep audit on everything before we push this.
// It needs to be perfection"): THE RELAY'S SIDE OF A PRIVATE SESSION (ARENA6), each finding red first on the real Room
// over fake sockets and fake objects (test/fakeRoom.mjs), as test/systems/arena/arena6_private.test.js drives it. The record:
// bible/01-Overview/audits/Audit-PreMerge-1003.md, its second pass (1003b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../../fakeRoom.mjs';
import { ARENA_FLOOR_CENTRE, ARENA_TICK_MS, ARENA_GONE_MS, ARENA_PRIVATE_KEEP_MS, arenaPrivateRoom } from '../../../src/net/arena/arenaLaw.js';
import { readArenaOut } from '../../../src/net/wire.js';
import { callMs, COUNT_MS } from '../../../src/systems/arena/arenaBout.js';

const C = ARENA_FLOOR_CENTRE;
const ROOM = arenaPrivateRoom('K7PX2M');
const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const ps = (r, ws, a, extra = {}) => word(r, ws, { k: 'ps', a, ...extra });
const idOf = (pss, name) => pss.m.find((x) => x[1] === name)?.[0] ?? null;
const at = { x: C[0] + 1, y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 };

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** The session's room, its host Hela in it and the session open; `who` more sockets `[id, name, linked]`, hello'd and joined. */
async function session(W, who = []) {
  const R = W.room(ROOM);
  const host = R.connect();
  await R.hello(host, 'peer-hela', { ...at, x: C[0] }, { name: 'Hela', kind: 'linked', tokenSub: 'acct-hela' });
  await ps(R, host, 'open');
  const out = { R, host };
  for (const [id, name, linked] of who) {
    const ws = R.connect();
    await R.hello(ws, `peer-${id}`, at, { name, ...(linked ? { kind: 'linked' } : {}), tokenSub: `acct-${id}` });
    await ps(R, ws, 'join');
    out[id] = ws;
  }
  return out;
}
async function walk(R, step, ms) { for (let t = 0; t < ms; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); } }
/** Alva (Red) and Brann (Blue) picked and called, both on the sand, the walk and the count past: the fight is on. */
async function fightOn(c, step) {
  const s = readArenaOut(last(c.host, 'pss'));
  await ps(c.R, c.host, 'pick', { r: idOf(s, 'Alva'), b: idOf(s, 'Brann') });
  await ps(c.R, c.host, 'go');
  await word(c.R, c.alva, { k: 'in', r: 'f' });
  await word(c.R, c.brann, { k: 'in', r: 'f' });
  await walk(c.R, step, callMs({ fighters: [0, 0] }) + 300 + COUNT_MS + 600);
  return s;
}
/** Alva fells Brann: in reach, a blow a second until the result. */
async function fell(c, step) {
  await c.R.pose(c.alva, { x: C[0] + 4.6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 });
  for (let i = 0; i < 60 && !(await c.R.room._boutOf())?.res; i++) { step(1000); await c.R.fire(); await word(c.R, c.alva, { k: 'hit', i: 'p1', d: 999, r: 0, w: 123, m: 9, q: 10 + i }); }
  assert.ok((await c.R.room._boutOf())?.res, 'the bout has its result');
}
const four = [['alva', 'Alva', true], ['brann', 'Brann', true], ['gull', 'Gull', false]];

test('AUDIT PRE-MERGE 1003b R1/S3: a member\'s repeated join is answered to it alone - no write, no fan - and past its budget a changed join waits; the fan asks the room for its sockets once, not once per member (mutants: the quiet answer gone; the budget gone; here re-listed per member)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  step(5000);
  let puts = 0;
  const put0 = c.R.state.storage.put;
  c.R.state.storage.put = async (...a) => { if (a[0] === 'arenasession') puts++; return put0(...a); };
  const others = () => [c.host, c.alva, c.brann].reduce((n, ws) => n + arena(ws).filter((m) => m.k === 'pss').length, 0);
  const o0 = others(), g0 = arena(c.gull).filter((m) => m.k === 'pss').length;
  for (let k = 0; k < 16; k++) { await ps(c.R, c.gull, 'join'); step(60); }
  assert.equal(puts, 0, 'a join that changes nothing writes nothing');
  assert.equal(others() - o0, 0, 'and is fanned to nobody else');
  assert.equal(arena(c.gull).filter((m) => m.k === 'pss').length - g0, 16, 'the asker has its answer each time');
  // a join that changes what the others see (its banner), sixteen in a second: two pass (the budget's burst), the rest wait
  step(5000);
  const o1 = others();
  for (let k = 0; k < 16; k++) { await ps(c.R, c.gull, 'join', { bn: k % 2 ? 'red' : 'blue' }); step(60); }
  assert.ok(others() - o1 <= 2 * 3, `a member's changes fan at most twice a burst (${others() - o1} pss to the other three)`);
  c.R.state.storage.put = put0;
  // the fan: the room's sockets listed a constant number of times, whatever the members
  let lists = 0;
  const all0 = c.R.room._all.bind(c.R.room);
  c.R.room._all = function () { lists++; return all0(); };
  c.R.room._sessionFan(await c.R.room._sessionOf());
  c.R.room._all = all0;
  assert.ok(lists <= 3, `${lists} listings of the room for one fan`);
}));

test('AUDIT PRE-MERGE 1003b R2: a stranger\'s tokenless hellos never shut a session\'s door - the floor room\'s gate is spent after the token, by account, and a member\'s hello waits on itself alone (mutant: the room gate before the token)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, [['alva', 'Alva', true]]);
  step(2000);
  let refused = 0;
  for (let i = 0; i < 12; i++) { const ws = c.R.connect(); await c.R.hello(ws, `peer-x${i}`, null, { tok: null }); if (ws.closed) refused++; }
  assert.equal(refused, 12, 'every tokenless hello refused');
  const back = c.R.connect();
  await c.R.hello(back, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann' });
  assert.equal(back.closed, null, `a newcomer with a token is let in the same second (${JSON.stringify(back.closed)})`);
  assert.ok(back.sent.some((m) => m.t === 'welcome'));
}));

test('AUDIT PRE-MERGE 1003b R3/S8: a fighter removed mid-bout is said gone to every screen - its body leaves the sand (mutant: the leave unsaid)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  const s = await fightOn(c, step);
  await word(c.R, c.gull, { k: 'in', r: 's' });
  assert.ok(c.gull.sent.some((m) => m.t === 'join' && m.id === 'peer-brann'), 'the stands saw Brann come onto the sand');
  const mark = c.gull.sent.length;
  await ps(c.R, c.host, 'kick', { m: idOf(s, 'Brann') });
  const after = c.gull.sent.slice(mark);
  assert.ok(after.some((m) => m.t === 'leave' && m.id === 'peer-brann'), 'the removed fighter is said gone');
  assert.ok(!after.some((m) => m.t === 'leave' && m.id === 'peer-alva'), 'HOTFIX 1003f: and the other stays drawn as the bout clears - back in the stands, a member');
}));

test('AUDIT PRE-MERGE 1003b R4/S8: a session\'s floor is its members\' - a stranger in the room and a removed member see no fighter, no pose, no roster, and their room chat reaches nobody; a member who joins mid-bout is shown the sand (mutants: the join fanned to all; the poses to all; the roster to all; chat from a stranger; the late member never shown)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, [...four, ['kim', 'Kim', true]]);
  const s0 = readArenaOut(last(c.host, 'pss'));
  await ps(c.R, c.host, 'kick', { m: idOf(s0, 'Kim') });
  const kimAt = c.kim.sent.length;   // HOTFIX 1003f: a member, Kim was shown the members in the stands; removed, nothing after
  const stranger = c.R.connect();
  await c.R.hello(stranger, 'peer-str', at, { name: 'Stranger', tokenSub: 'acct-str' });
  await fightOn(c, step);
  for (let i = 0; i < 5; i++) { step(100); await c.R.pose(c.alva, { x: C[0] - 5 + i * 0.5, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 1 }); }
  for (const [who, ws, from] of [['the stranger', stranger, 0], ['the removed', c.kim, kimAt]]) {
    assert.equal(ws.sent.slice(from).filter((m) => m.t === 'join' && (m.id === 'peer-alva' || m.id === 'peer-brann')).length, 0, `${who} is shown no fighter`);
    assert.equal(ws.sent.slice(from).filter((m) => m.t === 'pose' && m.id === 'peer-alva').length, 0, `${who} hears no pose`);
  }
  assert.ok(c.gull.sent.some((m) => m.t === 'pose' && m.id === 'peer-alva'), 'a member hears the fighter move');
  // a stranger's hello mid-bout: no roster of the sand
  const late = c.R.connect();
  await c.R.hello(late, 'peer-late', at, { name: 'Late', tokenSub: 'acct-late' });
  assert.deepEqual(late.sent.find((m) => m.t === 'welcome').peers.map((p) => p.id), [], 'a non-member\'s welcome draws nobody');
  // ...until it joins: then it is shown the two on the sand
  await ps(c.R, late, 'join');
  assert.deepEqual(late.sent.filter((m) => m.t === 'join').map((m) => m.id).sort(), ['peer-alva', 'peer-brann', 'peer-gull', 'peer-hela'], 'a member who joins mid-bout is shown the sand (HOTFIX 1003f: and the stands - every member here, never the stranger or the removed)');
  // room chat: a stranger's and a removed member's lines reach no member, and a member's reaches no stranger
  const heard = (ws, text) => ws.sent.some((m) => m.t === 'chat' && m.text === text);
  step(2000); await c.R.chat(c.kim, 'from the removed');
  step(2000); await c.R.chat(stranger, 'from the stranger');
  step(2000); await c.R.chat(c.gull, 'from a member');
  assert.ok(!heard(c.gull, 'from the removed') && !heard(c.gull, 'from the stranger'), 'no non-member\'s line reaches a member');
  assert.ok(heard(c.alva, 'from a member') && !heard(stranger, 'from a member'), 'a member\'s line reaches members alone');
}));

test('AUDIT PRE-MERGE 1003b R5: a watcher\'s socket replaced by its own reconnect keeps its one seat in the stands (mutant: the seat not carried)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  await fightOn(c, step);
  await word(c.R, c.gull, { k: 'in', r: 's' });
  const seats = [(await c.R.room._boutOf()).spectators];
  for (let i = 0; i < 4; i++) {
    step(1500);
    const g2 = c.R.connect();
    await c.R.hello(g2, 'peer-gull', null, { name: 'Gull', tokenSub: 'acct-gull', secret: 'secret-of-peer-gull' });
    await ps(c.R, g2, 'join');
    await word(c.R, g2, { k: 'in', r: 's' });
    seats.push((await c.R.room._boutOf()).spectators);
  }
  assert.deepEqual(seats, [1, 1, 1, 1, 1]);
}));

test('AUDIT PRE-MERGE 1003b R6/S2: a room woken mid-bout whose first word is a member\'s close tells the members the bout that stands, never none (mutant: the session fanned before the bout is read)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  await fightOn(c, step);
  const o = (await c.R.room._boutOf()).o;
  c.R.wake();
  await c.R.drop(c.gull);
  const p = readArenaOut(last(c.alva, 'pss'));
  assert.equal(p.o, o, 'the bout stands');
  assert.equal(p.f.length, 2, 'with its two fighters');
}));

test('AUDIT PRE-MERGE 1003b R7/S10: a session\'s finished bout is kept ARENA_PRIVATE_KEEP_MS past the healers, as its record says, then cleared (mutant: kept from the result)', async () => onClock(async ({ now, step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  await fightOn(c, step);
  await fell(c, step);
  let doneAt = null, clearAt = null;
  for (let t = 0; t < 30_000 && clearAt == null; t += ARENA_TICK_MS) {
    step(ARENA_TICK_MS);
    await c.R.fire();
    if (doneAt == null && last(c.alva, 'st')?.ph === 'done') doneAt = now();
    if (clearAt == null && (await c.R.room._boutOf()) == null) clearAt = now();
  }
  assert.ok(doneAt != null && clearAt != null);
  assert.ok(clearAt - doneAt >= ARENA_PRIVATE_KEEP_MS && clearAt - doneAt <= ARENA_PRIVATE_KEEP_MS + 2 * ARENA_TICK_MS, `kept ${clearAt - doneAt} ms past the healers`);
}));

test('AUDIT PRE-MERGE 1003b R8/S1: once the bout has its result, the host\'s End bout (no result) is refused and a fighter removed says no "no result" - nobody is told a bout was voided that the results keep (mutants: void after the result; the kick\'s voided after the result)', async () => onClock(async ({ step }) => {
  for (const how of ['void', 'kick']) {
    const W = fakeRooms();
    const c = await session(W, four);
    const s = await fightOn(c, step);
    await fell(c, step);
    await walk(c.R, step, 2000);
    assert.equal((await c.R.room._boutOf()).b.phase, 'verdict');
    if (how === 'void') {
      await ps(c.R, c.host, 'void');
      assert.equal(last(c.host, 'no')?.m, 'has result', 'void after the result: refused, in its own word (a bout\'s `no bout` is its end on a screen)');
    } else await ps(c.R, c.host, 'kick', { m: idOf(s, 'Brann') });
    assert.ok(!arena(c.gull).some((m) => m.k === 'no' && m.m === 'voided'), `${how}: nobody hears "no result"`);
    const hist = readArenaOut(last(c.gull, 'pss')).hist;
    assert.equal(hist.length, 1, `${how}: the result is kept`);
    assert.equal(hist[0][2], 0, 'the Red won');
  }
}));

test('AUDIT PRE-MERGE 1003b R-f: a seated watcher\'s repeated `in` writes the bout once, not once a word (mutant: every `in` forced to storage)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  await fightOn(c, step);
  await word(c.R, c.gull, { k: 'in', r: 's' });
  let puts = 0;
  const put0 = c.R.state.storage.put;
  c.R.state.storage.put = async (...a) => { if (a[0] === 'arenabout') puts++; return put0(...a); };
  for (let k = 0; k < 16; k++) { await word(c.R, c.gull, { k: 'in', r: 's' }); step(60); }
  c.R.state.storage.put = put0;
  assert.equal(puts, 0, `${puts} writes for sixteen repeated seats`);
  assert.equal((await c.R.room._boutOf()).spectators, 1);
}));

test('AUDIT PRE-MERGE 1003b S9: both fighters of a players\' bout gone together - no contest: the bout is void, never the Blue\'s forfeit win (mutant: the both-gone void dropped)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  await fightOn(c, step);
  await c.R.drop(c.alva);
  await c.R.drop(c.brann);
  await walk(c.R, step, ARENA_GONE_MS + 1000);
  const st = await c.R.room._boutOf();
  assert.ok(!st || !st.res, `no result for a bout both left (${JSON.stringify(st?.res)})`);
  assert.deepEqual(readArenaOut(last(c.gull, 'pss')).hist, [], 'and none kept');
}));

test('AUDIT PRE-MERGE 1003b S4: the host can lock the session - a newcomer is refused (`locked`), a member coming back is let in, and unlocking opens it again; only the host locks (mutants: the lock ignored; a member back refused; a member locking)', async () => onClock(async ({ step }) => {
  const W = fakeRooms();
  const c = await session(W, four);
  await ps(c.R, c.gull, 'lock', { l: 1 });
  assert.equal(last(c.gull, 'no')?.m, 'host only');
  await ps(c.R, c.host, 'lock', { l: 1 });
  assert.equal(readArenaOut(last(c.alva, 'pss')).lo, 1, 'every member told it is locked');
  const fresh = c.R.connect();
  await c.R.hello(fresh, 'peer-new', at, { name: 'Newcomer', tokenSub: 'acct-new' });
  await ps(c.R, fresh, 'join');
  assert.equal(last(fresh, 'no')?.m, 'locked');
  await c.R.drop(c.gull);
  step(3000);
  const back = c.R.connect();
  await c.R.hello(back, 'peer-gull', at, { name: 'Gull', tokenSub: 'acct-gull', secret: 'secret-of-peer-gull' });
  await ps(c.R, back, 'join');
  assert.ok(last(back, 'pss'), 'a member coming back is let in');
  await ps(c.R, c.host, 'lock', { l: 0 });
  await ps(c.R, fresh, 'join');
  assert.ok(last(fresh, 'pss'), 'unlocked, the newcomer joins');
}));
