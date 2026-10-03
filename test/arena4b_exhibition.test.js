// ARENA4b (2026-10-03, bible/11-Multiplayer/Arena.md 2: "Exhibition - online: yes - the relay runs it, every client sees
// one bout"; the ARENA2 record: "ARENA4's relay runs the schedule on the shared clock"): THE HOUR'S EXHIBITION ON THE
// RELAY, over fake sockets and fake objects (test/fakeRoom.mjs) - the law moved into the relay's graph (one copy, the
// game's draw unchanged), the Worker's door for `arena:x<hour>`, its first watcher opening it inside its window on the
// shared clock, one bout for every watcher, the relay's two fighters to a verdict in the `st`, the verdict kept a game
// day, and the bout on the hall's list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/src/index.js';
import { fakeRooms } from './fakeRoom.mjs';
import {
  ARENA_HALL, arenaExhibitionRoom, arenaExhibitionHourOf, isArenaExhibitionRoom, isArenaRoom, isArenaFloorRoom, arenaFloorRoomOf, ARENA_TICK_MS,
  ARENA_EX_KEEP_MS, validArenaOut, ARENA_FLOOR_CENTRE, arenaFoeStats,
} from '../src/net/arenaLaw.js';
import {
  exhibitionFor, exhibitionOpening, exhibitionAdmits, exhibitionBoutId, hourIndexOf, arenaHash, EXHIBITION_START_MINUTES, EXHIBITION_KEPT_HOURS,
} from '../src/net/arenaExhibition.js';
import * as LADDER from '../src/systems/arenaLadder.js';
import { arenaBoutSeed, openBout, stepBout, stateWord, liveEntry, boutFinished, arenaMarks } from '../src/net/arenaBrain.js';
import { wallMsForClassicMinutes, sharedClassicMinutes } from '../src/net/wire.js';

const arena = (ws) => ws.sent.filter((m) => m.t === 'arena');
const last = (ws, k) => arena(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
/** A game minute: noon (and `min` past it) of a day well inside the online era. */
const NOON = 600 * 1440 + 12 * 60;
/** The shared clock walked to a game minute, the room's beats run in between. */
async function onClock(gameMinute, fn) {
  const realNow = Date.now;
  let clock = Math.round(wallMsForClassicMinutes(gameMinute));
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** Two watchers in the hour's room. */
async function stands(W, hour) {
  const R = W.room(arenaExhibitionRoom(hour));
  const a = R.connect(), b = R.connect();
  await R.hello(a, 'seat-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
  await R.hello(b, 'seat-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann' });
  return { R, a, b };
}

test('ARENA4b the law moved, not copied: the game\'s exhibition IS the relay\'s (the same function, the same draw - the ladder hands it on), its room by its hour, its bout id carrying the hour\'s seed (mutants: the draw off another tier list; the bout id\'s seed not the hour\'s; the room key\'s hour misread)', () => {
  assert.equal(LADDER.exhibitionFor, exhibitionFor, 'systems/arenaLadder.js hands on the one function');
  assert.equal(LADDER.arenaHash, arenaHash);
  assert.equal(LADDER.hourIndexOf, hourIndexOf);
  for (let h = 0; h < 48; h++) {
    const ex = exhibitionFor(NOON - 12 * 60 + h * 60 + 3);
    if (!ex) continue;
    const t = LADDER.LADDER_TIERS[ex.tier];
    const pool = t.bouts.map((b) => b[0]);
    for (const o of ex.opponents) assert.ok(pool.some((p) => p.mobile === o.mobile && p.level === o.level), `hour ${h}: a fighter of tier ${ex.tier}'s own bouts`);
    assert.equal(ex.beasts, !!t.beasts);
  }
  const ex = exhibitionFor(NOON + 2);
  const o = exhibitionBoutId(ex.hour);
  assert.match(o, /^[0-9a-f]{16}$/);
  assert.equal(arenaBoutSeed(o), ex.seed, 'the relay\'s fighters are named on every screen by the seed the offline bout names them by');
  assert.equal(parseInt(o.slice(8), 16), ex.hour);
  const room = arenaExhibitionRoom(ex.hour);
  assert.equal(room, `arena:x${ex.hour}`);
  assert.equal(arenaExhibitionHourOf(room), ex.hour);
  assert.ok(isArenaExhibitionRoom(room) && isArenaRoom(room) && isArenaFloorRoom(room));
  assert.equal(isArenaExhibitionRoom('arena:x012'), false, 'one spelling of an hour');
  assert.equal(isArenaExhibitionRoom('arena:x'), false);
  assert.equal(arenaFloorRoomOf(`x${ex.hour}`), room, 'the floor\'s instance entered for the exhibition stands in its room');
  assert.equal(arenaFloorRoomOf('0123456789abcdef'), 'arena:b0123456789abcdef');
  assert.equal(arenaFloorRoomOf('xyz'), null);
});

test('ARENA4b the window on the shared clock: the hour\'s own room opens inside its first twenty minutes of the gates\' hours, never another hour, never past the window, never at night; the door stands for the hour now, the one before and the kept day (mutants: the window unchecked; another hour opened; the door open to any hour)', () => {
  const ex = exhibitionFor(NOON + 1);
  assert.equal(exhibitionOpening(ex.hour, NOON + 1)?.hour, ex.hour);
  assert.equal(exhibitionOpening(ex.hour, NOON + EXHIBITION_START_MINUTES - 0.01)?.hour, ex.hour);
  assert.equal(exhibitionOpening(ex.hour, NOON + EXHIBITION_START_MINUTES), null, 'twenty minutes in it may not begin');
  assert.equal(exhibitionOpening(ex.hour + 1, NOON + 1), null, 'not an hour the clock is not in');
  assert.equal(exhibitionOpening(hourIndexOf(NOON - 9 * 60), NOON - 9 * 60 + 1), null, 'three in the morning: the gates are shut');
  assert.equal(exhibitionAdmits(ex.hour, NOON + 30), true);
  assert.equal(exhibitionAdmits(ex.hour + 1, NOON + 59), true, 'a clock a breath fast');
  assert.equal(exhibitionAdmits(ex.hour + 2, NOON), false);
  assert.equal(exhibitionAdmits(ex.hour - EXHIBITION_KEPT_HOURS - 1, NOON), true, 'its verdict kept a game day');
  assert.equal(exhibitionAdmits(ex.hour - EXHIBITION_KEPT_HOURS - 2, NOON), false);
  assert.equal(EXHIBITION_KEPT_HOURS * 60 * 5000, ARENA_EX_KEEP_MS, 'a game day is two real hours on the shared clock');
});

test('ARENA4b the relay\'s bout of the hour: the hour\'s two at their marks on sides 0 and 1, the relay\'s bodies, the law begun at once with nobody waited for, fought to a verdict with no receipt owed; its state and its list entry say the hour (mutants: the law waits for a fighter; the pair the wrong sides; a receipt owed)', () => {
  const ex = exhibitionFor(NOON + 2);
  const st = openBout({ o: exhibitionBoutId(ex.hour), kind: 'ex', f: [], ex, now: 5000 });
  assert.equal(st.phase, 'law');
  assert.equal(st.b.kind, 'exhibition');
  const marks = arenaMarks(2, [1, 1]);
  st.ai.forEach((a, i) => {
    assert.equal(a.mobile, ex.opponents[i].mobile);
    assert.equal(a.side, i, 'the Red\'s fighter side 0, the Blue\'s side 1');
    assert.equal(a.hp, arenaFoeStats(ex.opponents[i].mobile, ex.opponents[i].level).hp);
    assert.deepEqual(a.pos, [ARENA_FLOOR_CENTRE[0] + marks[i][0][0], ARENA_FLOOR_CENTRE[2] + marks[i][0][1]]);
  });
  let now = 5000;
  let s = 7;
  const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 8000 && !boutFinished(st); i++) { now += ARENA_TICK_MS; stepBout(st, now, rng); }
  assert.ok(boutFinished(st), 'fought to the healers');
  assert.ok(st.res && (st.res.side === 0 || st.res.side === 1 || st.res.side === null));
  assert.deepEqual(st.owed, [], 'nobody of the realm fought it');
  const w = validArenaOut(stateWord(st, ''));
  assert.equal(w.kind, 'ex');
  assert.equal(w.h, ex.hour);
  assert.deepEqual(w.res, st.res);
  assert.deepEqual(validArenaOut({ k: 'live', l: [liveEntry(st)] }).l[0], { o: st.o, kind: 'ex', h: ex.hour, a: { b: 'red' }, b: { b: 'blue' }, tier: ex.tier, sp: 0, at: 5000 }, 'by its hour and tier, its two by their banners alone (ARENA4b)');
  assert.equal(validArenaOut({ ...stateWord(st, ''), h: undefined }), null, 'an exhibition names its hour');
  assert.equal(validArenaOut({ k: 'live', l: [{ o: st.o, kind: 'pvp', h: 1, sp: 0, at: 1 }] }), null, 'any other bout its fighters');
  assert.equal(validArenaOut({ k: 'live', l: [{ o: st.o, kind: 'ex', sp: 0, at: 1 }] }), null, 'an exhibition on the list by its hour');
  assert.deepEqual(validArenaOut({ k: 'live', l: [{ o: st.o, kind: 'ex', h: 5, a: { n: 'Stray', b: 'red' }, b: { n: 'Stray' }, sp: 0, at: 1 }] }).l[0], { o: st.o, kind: 'ex', h: 5, a: { b: 'red' }, sp: 0, at: 1 }, 'and no name of its own - a stray one dropped, a bill without a banner too, not a refusal');
});

test('ARENA4b the Worker\'s door: an exhibition\'s room is minted for the hour now and the kept day, refused for an hour the clock is not near (mutants: the door open to any hour)', async () => onClock(NOON + 3, async ({ now }) => {
  const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('x') }) } };
  const at = (k) => worker.fetch(new Request(`https://relay.invalid/room/${k}`), env);
  const hour = hourIndexOf(sharedClassicMinutes(now()));
  assert.equal((await at(`arena:x${hour}`)).status, 426, 'the hour\'s room: a socket only');
  assert.equal((await at(`arena:x${hour - 20}`)).status, 426, 'a kept verdict\'s');
  assert.equal((await at(`arena:x${hour + 5}`)).status, 404, 'an hour to come');
  assert.equal((await at(`arena:x${hour - 40}`)).status, 404, 'an hour long gone');
}));

test('ARENA4b one bout for every watcher: the first watcher\'s `in` opens the hour\'s bout inside its window and every other joins it - the same bout, the same fighters, no body drawn, the stands counted, the hall told; nobody fights it (mutants: each watcher a bout of their own; a watcher put on the sand; the hall not told)', async () => onClock(NOON + 2, async ({ now }) => {
  const W = fakeRooms();
  const ex = exhibitionFor(sharedClassicMinutes(now()));
  const { R, a, b } = await stands(W, ex.hour);
  assert.deepEqual(b.sent.find((m) => m.t === 'welcome').peers, [], 'the stands see no body - the sand is the relay\'s two');
  assert.ok(!a.sent.some((m) => m.t === 'join'), 'a watcher\'s hello is said to nobody');
  await word(R, a, { k: 'in', r: 's' });
  const sa = last(a, 'st');
  assert.equal(sa.kind, 'ex');
  assert.equal(sa.h, ex.hour);
  assert.equal(sa.o, exhibitionBoutId(ex.hour));
  assert.equal(sa.me, '');
  assert.deepEqual(sa.f.map((f) => [f[0], f[2], f[6], f[7]]), [['a0', 0, 1, ex.opponents[0].mobile], ['a1', 1, 1, ex.opponents[1].mobile]], 'the hour\'s pair, the relay\'s own');
  await word(R, b, { k: 'in', r: 's' });
  const sb = last(b, 'st');
  assert.equal(sb.o, sa.o, 'one bout');
  assert.deepEqual(sb.f.map((f) => f[1]), sa.f.map((f) => f[1]));
  assert.equal(last(a, 'sp').n, 2, 'two in the stands');
  assert.ok(last(b, 'mv'), 'its fighters\' places said to a joiner');
  await word(R, b, { k: 'in', r: 'f' });
  assert.equal(last(b, 'no').m, 'not yours', 'nobody of the realm fights the hour\'s bout');
  const hpBefore = arena(a).filter((m) => m.k === 'hp' || m.k === 'ev').length;
  await word(R, a, { k: 'hit', i: 'a1', d: 20, r: 0, q: 1 });
  assert.equal(arena(a).filter((m) => m.k === 'hp' || m.k === 'ev').length, hpBefore, 'a watcher\'s blow is no claim');
  const H = W.room(ARENA_HALL);
  const h = H.connect();
  await H.hello(h, 'hall-gull', null, { name: 'Gull', kind: 'linked', tokenSub: 'acct-gull' });
  await word(H, h, { k: 'ls' });
  const entry = last(h, 'live').l.find((e) => e.o === sa.o);
  assert.deepEqual([entry.kind, entry.h, entry.tier], ['ex', ex.hour, ex.tier], 'on the hall\'s list, by its hour');
  assert.deepEqual([entry.a, entry.b], [{ b: 'red' }, { b: 'blue' }], 'the relay bills no names - its sides by their banners (ARENA4b)');
}));

test('ARENA4b the window holds: past its first twenty minutes nobody opens the hour\'s bout (no bout), and a fighter\'s `in` opens none (mutants: opened past the window; opened by a fighter)', async () => onClock(NOON + EXHIBITION_START_MINUTES + 1, async ({ now }) => {
  const W = fakeRooms();
  const hour = hourIndexOf(sharedClassicMinutes(now()));
  const { R, a, b } = await stands(W, hour);
  await word(R, a, { k: 'in', r: 's' });
  assert.equal(last(a, 'no').m, 'no bout');
  assert.equal(await R.room._boutOf(), null, 'nothing stood');
  const W2 = fakeRooms();
  await onClock(NOON + 1, async () => {
    const S = await stands(W2, hour);
    await word(S.R, S.b, { k: 'in', r: 'f', tier: 0, bout: 0, lv: 3 });
    assert.equal(last(S.b, 'no').m, 'no bout', 'a fighter\'s word opens no exhibition');
  });
  void b;
}));

test('ARENA4b the relay\'s verdict: the hour\'s bout fought on the relay\'s beat to its healers, its result in the `st` every watcher holds; a late asker is answered the whole bout and no seat; kept a game day, then forgotten (mutants: the verdict never said; a late asker seated; the verdict forgotten at the ladder\'s ten minutes)', async () => onClock(NOON + 2, async ({ now, step }) => {
  const W = fakeRooms();
  const ex = exhibitionFor(sharedClassicMinutes(now()));
  const { R, a, b } = await stands(W, ex.hour);
  await word(R, a, { k: 'in', r: 's' });
  for (let i = 0; i < 4000 && !(await R.room._boutOf())?.toldDone; i++) { step(ARENA_TICK_MS); await R.fire(); }
  const st = await R.room._boutOf();
  assert.ok(st.res, 'a verdict');
  const evs = arena(a).filter((m) => m.k === 'ev').flatMap((m) => m.e);
  const v = evs.find((e) => e.k === 'verdict');
  assert.ok(v, 'the verdict said to the stands');
  assert.equal(v.side, st.res.side);
  assert.ok(evs.some((e) => e.k === 'crier' && e.a === 'a0') && evs.some((e) => e.k === 'fight'), 'the call, the crier, the count, the fight - the law every screen runs');
  assert.ok(arena(a).some((m) => m.k === 'atk' && /^a[01]$/.test(m.i)), 'the relay\'s fighters telegraph their blows');
  await word(R, b, { k: 'in', r: 's' });
  const late = last(b, 'st');
  assert.deepEqual(late.res, st.res, 'the late asker is answered the verdict');
  assert.equal(st.spectators, 1, 'and takes no seat');
  assert.equal(arena(b).filter((m) => m.k === 'no').length, 0);
  step(10 * 60_000 + 1000); await R.fire();
  assert.ok(await R.room._boutOf(), 'kept past the ladder\'s ten minutes');
  step(ARENA_EX_KEEP_MS); await R.fire();
  assert.equal(await R.room._boutOf(), null, 'a game day on, forgotten');
}));
