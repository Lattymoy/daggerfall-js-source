// AUDIT PRE-MERGE 1003b (2026-10-03, the owner: "We're going to do one last deep audit on everything before we push this.
// It needs to be perfection"): THE CLIENT'S SIDE OF A PRIVATE SESSION (ARENA6) - the session on a screen, the hosts'
// seams, the card - each finding red first on the real modules: the real relay Room over fake sockets
// (test/fakeRoom.mjs), the real online half (scenes/arena/arenaOnline.js) driving the real bout driver (scenes/arena/arenaBouts.js),
// as test/systems/arena/arena6_private.test.js's screen() does. The record: bible/01-Overview/audits/Audit-PreMerge-1003.md, its second pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { ARENA_FLOOR_CENTRE, ARENA_TICK_MS, ARENA_JOIN_WAIT_MS, ARENA_PRIVATE_KEEP_MS, ARENA_PRIVATE_MEMBERS_MAX, ARENA_NO_TEXT, arenaPrivateRoom, arenaFloorRoomOf, isArenaRoom, validArenaIn } from '../../../src/net/arena/arenaLaw.js';
import { readArenaOut } from '../../../src/net/wire.js';
import { createArenaOnline } from '../../../src/scenes/arena/arenaOnline.js';
import { createArenaBouts } from '../../../src/scenes/arena/arenaBouts.js';
import { callMs, COUNT_MS } from '../../../src/systems/arena/arenaBout.js';
import { ARENA_TEXT } from '../../../src/systems/arena/arenaText.js';
import { sessionCard, onlineCards, arenaBoard } from '../../../src/systems/arena/arenaBoard.js';

const C = ARENA_FLOOR_CENTRE;
const O = ARENA_TEXT.online;
const CODE = 'AAAAAA';
const settled = () => new Promise((r) => setTimeout(r, 0));
const word = (R, ws, w) => R.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const idOf = (pss, name) => pss.m.find((x) => x[1] === name)?.[0] ?? null;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
async function walk(R, step, ms, screens = []) { for (let t = 0; t < ms; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); for (const s of screens) await s.beat(); } }
/** The presence session's socket as net/online.js hands it to the online half. */
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
/** One screen: the real bout driver on the floor and the real online half over its socket, world.js's seams in shape -
 *  every door it opens noted, every line it says kept (the Herald's too), its health the relay's as world.js sets it. */
function screen(R, ws, name, { guest = false, banner = null } = {}) {
  const P = { name, health: 200, maxHealth: 200 };
  const herald = [], huds = [];
  const D = createArenaBouts({ now: () => Date.now(), playerEntity: P, say: (l) => herald.push(l), notice() {}, drawHud: (m) => { if (m) huds.push(m); }, heal: () => { P.health = P.maxHealth; }, pay() {} });
  D.setStage(floorStage());
  const S = clientSocket(R, ws, 'world:1,1');
  const doors = [], said = [];
  const A = createArenaOnline({
    now: () => Date.now(), session: () => S, makeHall: () => null, bouts: D,
    account: { board: async () => (banner ? { ok: true, data: { me: { banner, ladder: null }, team: { laurel: null } } } : { ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null },
    enterFloor: async (kind, o) => { doors.push(['enter', kind, o]); S.room = arenaFloorRoomOf(o); return true; },
    standOnMark: (kind) => { doors.push(['mark', kind]); return true; }, leaveFloor: () => { doors.push(['leave']); S.room = 'world:1,1'; return true; },
    closeWindow: () => doors.push(['closeWindow']), say: (l) => said.push(l), guest: () => guest, inBout: () => D.holds(), level: () => 20,
    struck: () => {}, myHealth: (hp) => { if (P.health > 0) P.health = hp; }, heal: () => { P.health = P.maxHealth; },
    rand: (n) => new Uint8Array(n),   // every byte nought: the code AAAAAA
  });
  return { P, D, S, A, ws, doors, said, herald, huds, async beat() { A.tick(); await S.flush(); S.pump((w, room) => A.word(w, room)); D.frame?.(0.016, {}); } };
}
const last = (ws, k) => ws.sent.filter((m) => m.t === 'arena' && m.k === k).at(-1) ?? null;
async function mk(R, name, linked = true, opts = {}) {
  const ws = R.connect();
  await R.hello(ws, `peer-${name.toLowerCase()}`, { x: C[0], y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name, ...(linked ? { kind: 'linked' } : {}), tokenSub: `acct-${name.toLowerCase()}` });
  return screen(R, ws, name, { guest: !linked, ...opts });
}
/** Hela hosts `AAAAAA` on a fresh room; `who` join it (`[name, linked = true, opts]`). Answers the room and the screens. */
async function hosted(who = [], { board = false, hela = {} } = {}) {
  const R = fakeRooms().room(arenaPrivateRoom(CODE));
  const H = await mk(R, 'Hela', true, hela);
  if (board) await H.A.fetchBoard();
  H.A.act('privHost'); await settled(); await H.beat(); await H.beat();
  const o = { R, H };
  for (const [n, linked = true, opts = {}] of who) {
    const sc = await mk(R, n, linked, opts);
    if (board) await sc.A.fetchBoard();
    sc.A.act('privJoin', { code: CODE }); await settled(); await sc.beat(); await sc.beat();
    o[n] = sc;
  }
  await H.beat();
  return o;
}
const screensOf = (o) => Object.entries(o).filter(([k]) => k !== 'R').map(([, v]) => v);
async function beats(o, n = 2) { for (let i = 0; i < n; i++) for (const s of screensOf(o)) await s.beat(); }
/** The host picks `red` and `blue` and calls the bout. */
async function pickGo(o, red, blue) {
  const st = o.H.A.session().state;
  o.H.A.act('privPick', { r: idOf(st, red), b: idOf(st, blue) }); await o.H.S.flush(); await beats(o);
  o.H.A.act('privGo'); await o.H.S.flush(); await beats(o, 3);
}
/** The walk and the count past - the fight is on. */
async function toFight(o, step) { await walk(o.R, step, callMs({ fighters: [0, 0] }) + 300 + COUNT_MS + 600); await beats(o); }

test('AUDIT PRE-MERGE 1003b C1: a fighter whose opponent never comes is back in the stands when the relay voids the bout - never stranded on the sand (mutant: the void lets the mirror go and leaves the fighter on its mark)', async () => onClock(async ({ step }) => {
  const o = await hosted([['Alva'], ['Brann']]);
  const brann = o.Brann;
  delete o.Brann;   // a tab in the background: its socket hears, its frames never run - it never comes onto the sand
  await pickGo(o, 'Alva', 'Brann');
  brann.S.pump((w, room) => brann.A.word(w, room));
  assert.deepEqual(o.Alva.doors.at(-1), ['mark', 'ladder'], 'Alva called to the Red mark');
  await walk(o.R, step, ARENA_JOIN_WAIT_MS + 1000, [o.Alva, o.H]);
  await walk(o.R, step, ARENA_PRIVATE_KEEP_MS + 2000, [o.Alva, o.H]);
  assert.equal(readArenaOut(last(o.Alva.ws, 'pss')).o, '', 'the session is back to choosing');
  assert.deepEqual(o.Alva.doors.at(-1), ['mark', 'watch'], 'Alva is sent back up to the stands');
  assert.equal(o.Alva.D.holds(), false);
}));

for (const how of ['void', 'kick', 'close', 'superseded']) {
  test(`AUDIT PRE-MERGE 1003b C2: a session's bout ended mid-fight (${how}) heals its fighter as its healers would - never left hurt in the stands, where nobody rests (mutant: the bout let go with no heal)`, async () => onClock(async ({ step }) => {
    const o = await hosted([['Alva'], ['Brann']]);
    await pickGo(o, 'Alva', 'Brann');
    await toFight(o, step);
    await o.R.pose(o.Alva.ws, { x: C[0] + 4.6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 });
    for (let i = 0; i < 3; i++) { step(1000); await o.R.fire(); await word(o.R, o.Alva.ws, { k: 'hit', i: 'p1', d: 40, r: 0, w: 123, m: 9, q: 10 + i }); }
    await o.Brann.beat();
    assert.ok(o.Brann.P.health < o.Brann.P.maxHealth, 'Brann struck');
    if (how === 'void') o.H.A.act('privVoid');
    else if (how === 'kick') o.H.A.act('privKick', { m: idOf(o.H.A.session().state, 'Alva') });
    else if (how === 'close') o.H.A.act('privClose');
    else { o.Brann.S.status = 'superseded'; o.Brann.A.leaveAll(); }   // Brann's seat taken by another tab mid-fight (net/online.js superseded: its socket shut, the arena left)
    await o.H.S.flush();
    await walk(o.R, step, 2000, screensOf(o));
    assert.equal(o.Brann.P.health, o.Brann.P.maxHealth, `${how}: whole again`);
  }));
}

test('AUDIT PRE-MERGE 1003b C3: a screen standing in a session\'s room with no session on it (its seat taken back after another tab\'s, a slow floor) adopts the session - it joins and hears it; a room left on purpose is never adopted on the way out (mutants: the adoption gone; the left room adopted)', async () => onClock(async () => {
  const o = await hosted([['Alva'], ['Brann']]);
  // Brann's seat lost to another tab and taken back on the floor: net/online.js's superseded → leaveAll, then the room again
  o.Brann.A.leaveAll();
  assert.equal(o.Brann.A.session(), null, 'the session let go with the seat');
  o.Brann.S.status = 'open';
  await o.Brann.beat(); await o.Brann.beat();
  assert.ok(o.Brann.A.session(), 'adopted');
  assert.equal(o.Brann.A.session().code, CODE);
  assert.ok(o.Brann.A.session().state, 'and told the session again');
  // a Leave pressed: out, and never adopted again while the floor's exit is still under way
  o.Alva.A.act('privLeave');
  o.Alva.S.room = arenaPrivateRoom(CODE);   // the exit not taken yet
  await o.Alva.beat(); await o.Alva.beat();
  assert.equal(o.Alva.A.session(), null, 'the room left on purpose is not taken up again');
}));

test('AUDIT PRE-MERGE 1003b C4: a session\'s sides are its own on every screen - a fighter of the other banner in the realm sees the Red and the Blue as the stands do (mutant: the realm banner over my side)', async () => onClock(async ({ step }) => {
  const o = await hosted([['Alva', true, { banner: 'blue' }], ['Brann', true, { banner: 'red' }]], { board: true, hela: { banner: 'red' } });
  await pickGo(o, 'Alva', 'Brann');
  await toFight(o, step);
  await beats(o);
  const teams = (s) => { const h = s.huds.at(-1); return h ? [...h.left, ...h.right].map((f) => `${f.id}:${f.team}`).sort() : []; };
  assert.deepEqual(teams(o.H), ['p0:red', 'p1:blue'], 'the stands bill the session\'s Red and Blue');
  assert.deepEqual(teams(o.Alva), teams(o.H), 'and so does the Red of the Blue Banner');
  assert.deepEqual(teams(o.Brann), teams(o.H), 'and the Blue of the Red Banner');
}));

test('AUDIT PRE-MERGE 1003b C5/U2: a fighter called to the sand is taken out of the Arena window first - the host who picked themselves pressed Start inside it (mutant: the window left open)', async () => onClock(async () => {
  const o = await hosted([['Alva']]);
  await pickGo(o, 'Hela', 'Alva');
  for (const s of [o.H, o.Alva]) {
    const i = s.doors.findLastIndex((d) => d[0] === 'mark');
    assert.ok(i > 0 && s.doors.slice(0, i).some((d) => d[0] === 'closeWindow') && s.doors.findLastIndex((d) => d[0] === 'closeWindow') > s.doors.findIndex((d) => d[0] === 'enter'), `${s.P.name}: the window closed before the mark`);
  }
}));

test('AUDIT PRE-MERGE 1003b C6/S5: a newcomer refused by a full session (or a locked one) is told, leaves the floor and holds no session (mutant: the refusal only said)', async () => onClock(async ({ step }) => {
  const o = await hosted([['Alva']]);
  // fill the session with members who stay
  for (let i = 0; i < ARENA_PRIVATE_MEMBERS_MAX - 2; i++) {
    const ws = o.R.connect();
    await o.R.hello(ws, `peer-f${i}`, null, { name: `Fan${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'abcdefghijklmnopqrstuvwxyz'[Math.floor(i / 26)]}`, tokenSub: `acct-f${i}` });
    await word(o.R, ws, { k: 'ps', a: 'join' });
    step(150);   // a newcomer's hello waits on the stands' bucket (AUDIT PRE-MERGE 1003b R2) - ten a second
  }
  const late = await mk(o.R, 'Late');
  late.A.act('privJoin', { code: CODE }); await settled(); await late.beat(); await late.beat();
  assert.ok(late.said.includes(ARENA_NO_TEXT['session full']), 'told it is full');
  assert.equal(late.A.session(), null, 'no session held');
  assert.deepEqual(late.doors.at(-1), ['leave'], 'out of the floor');
  // a locked one, the same
  const k = await hosted([['Alva']]);
  k.H.A.act('privLock', { l: 1 }); await k.H.S.flush(); await beats(k);
  const shut = await mk(k.R, 'Shut');
  shut.A.act('privJoin', { code: CODE }); await settled(); await shut.beat(); await shut.beat();
  assert.ok(shut.said.includes(ARENA_NO_TEXT.locked), 'told it is locked');
  assert.equal(shut.A.session(), null);
  assert.deepEqual(shut.doors.at(-1), ['leave']);
}));

test('AUDIT PRE-MERGE 1003b C7: the floor entered away from Daggerfall\'s colosseum lands back where it was entered - its way out is the Herald\'s place only when the Herald is streamed in (mutants: no way back recorded; the exit not falling back to it)', () => {
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /const from = \{ pos: \[player\.pos\[0\], player\.pos\[1\] \+ CAPSULE_HEIGHT \/ 2, player\.pos\[2\]\], normal: \[Math\.sin\(cam\.yaw\), 0, Math\.cos\(cam\.yaw\)\] \};/);
  assert.match(modes, /arenaFloor: kind, arenaFrom: from,/);
  assert.match(modes, /arenaFrom: hit\.arenaFrom \?\? null,/);
  assert.match(modes, /dungeonReturn\.arena \? host\.arenaLanding\?\.\(\) \?\? dungeonReturn\.arenaFrom \?\? null :/);
});

test('AUDIT PRE-MERGE 1003b C8/U3/U8: the card keeps the session\'s word - a host\'s press refused is said in the window, not only in the chat under it; `no bout` with no bout here is said; a session stepped out of offers its code again, a wrong code says why (mutants: the word dropped; `no bout` unsaid; no rejoin)', async () => onClock(async () => {
  const o = await hosted([['Alva']]);
  o.H.A.act('privPick', { r: 'm9' }); await o.H.S.flush(); await beats(o);
  assert.ok(sessionCard(o.H.A.model().session).lines.includes(ARENA_NO_TEXT['not here']), 'the refusal on the card');
  o.H.A.act('privVoid'); await o.H.S.flush(); await beats(o);
  assert.ok(o.H.said.includes(ARENA_NO_TEXT['no bout']), 'End bout with no bout: said');
  // the host walks out through the gates (the room changes, no word to go)
  o.H.S.room = 'world:1,1';
  await o.H.beat();
  for (let i = 0; i < 7; i++) { await new Promise((r) => setTimeout(r, 0)); }
  const t0 = Date.now(); Date.now = () => t0 + 6000;
  await o.H.beat();
  const out = sessionCard(o.H.A.model().session);
  assert.ok(out.acts.some((a) => a.act === 'privJoin' && a.data?.code === CODE && a.label === O.privRejoin(CODE)), 'Rejoin offered');
  // a code nobody hosts: the trip says why, on the card too
  const lost = await mk(fakeRooms().room(arenaPrivateRoom('BBBBBB')), 'Lost');
  lost.A.act('privJoin', { code: 'bbb-bbb' }); await settled(); await lost.beat(); await lost.beat();
  assert.ok(sessionCard(lost.A.model().session).lines.includes(ARENA_NO_TEXT['no session']), 'a wrong code says so on the card');
}));

test('AUDIT PRE-MERGE 1003b U7: the reasons on the page are true - queued, Host and Join wait for the queue; in a session, Find a match and Watch say you are in one; a fighter\'s chip says the sand (mutants: the queue unsaid; the session said as a bout; the fighter "in the stands")', () => {
  const out = sessionCard({ in: false }, { queued: true });
  assert.equal(out.acts[0].why, O.privQueued);
  assert.equal(out.join.why, O.privQueued);
  const [players, challenge] = onlineCards({ hall: { status: 'open', queue: 'idle', live: [{ o: 'x', kind: 'pvp', a: { n: 'A' }, b: { n: 'B' }, sp: 0 }] }, me: null, busy: true, inSession: true });
  assert.equal(players.live[0].acts[0].why, O.privIn);
  assert.ok(challenge.acts.every((a) => a.why === O.privIn), 'Find a match and Casual bout');
  const w = { k: 'pss', c: CODE, hn: 'Hela', hm: 'm1', h: 0, me: 'm2', m: [['m1', 'Hela', 0, 1, '', ''], ['m2', 'Alva', 0, 1, '', ''], ['m3', 'Brann', 0, 1, '', '']], r: 'm2', b: 'm3', o: 'abcdef0123456789', ph: 'fight', f: ['m2', 'm3'], hist: [], lo: 0 };
  assert.equal(sessionCard({ in: true, code: CODE, host: false, state: w }).state, O.privState.fighter);
});

test('AUDIT PRE-MERGE 1003b U4/U6/U9/U10/S4/S7: the card - every row\'s presses stand still with a reason and a key of their own; in a session its card leads the page; results in words and a draw a draw; your row says You; the host\'s lock (mutants: a picked member\'s press dropped; no key; the card last; "- yield"; "no result" for a draw; no You; no lock)', () => {
  const w = { k: 'pss', c: CODE, hn: 'Hela', hm: 'm1', h: 1, me: 'm1', m: [['m1', 'Hela', 0, 1, '', 'red'], ['m2', 'Alva', 0, 1, '', 'blue'], ['m3', 'Brann', 1, 1, '', ''], ['m4', 'Cora', 0, 0, '', '']], r: 'm2', b: '', o: '', ph: '', f: [], hist: [['Alva', 'Brann', 1, 'yield'], ['Alva', 'Cora', -1, 'judges']], lo: 0 };
  const c = sessionCard({ in: true, code: CODE, host: true, state: w });
  const row = (n) => c.members.find((x) => x.name === n);
  for (const n of ['Alva', 'Brann', 'Cora']) assert.deepEqual(row(n).acts.map((a) => a.label), [O.privMakeRed, O.privMakeBlue, O.privRemove], `${n}: Make Red, Make Blue, Remove - always`);
  assert.deepEqual(row('Hela').acts.map((a) => a.label), [O.privMakeRed, O.privMakeBlue], 'the host may fight, never be removed');
  assert.equal(row('Alva').acts[0].why, O.privIsRed, 'the Red already: said, not dropped');
  assert.equal(row('Brann').acts[0].why, O.privGuestWhy);
  assert.equal(row('Cora').acts[0].why, O.privAwayWhy);
  assert.deepEqual(row('Alva').acts.map((a) => a.key), ['aw-priv-m2-r', 'aw-priv-m2-b', 'aw-priv-m2-kick']);
  assert.ok(row('Hela').roles.includes(O.privRole.you), 'your own row says You');
  assert.equal(row('Alva').banner, 'blue', 'a member\'s own banner, the side its chip\'s');
  assert.deepEqual(c.results, ['Brann (Blue) beat Alva (Red) by yield', 'Alva (Red) and Cora (Blue) drew']);
  assert.ok(c.lines.includes(O.privPicks('Alva', '')) && O.privPicks('Alva', '').includes('not picked'));
  assert.ok(c.acts.some((a) => a.act === 'privLock' && a.data.l === 1 && a.label === O.privLock));
  const locked = sessionCard({ in: true, code: CODE, host: true, state: { ...w, lo: 1 } });
  assert.ok(locked.lines.includes(O.privLocked) && locked.acts.some((a) => a.act === 'privLock' && a.data.l === 0 && a.label === O.privUnlock));
  // the page: in a session its card first
  const m = arenaBoard({ ladder: null, league: null, gameMinutes: 0, name: 'Hela', online: { hall: { status: 'open', queue: 'idle', live: [] }, session: { in: true, code: CODE, host: true, state: w } }, replays: [] });
  assert.equal(m.bouts.cards[0].kind, 'session');
  // End bout after the result: refused with its reason
  const decided = sessionCard({ in: true, code: CODE, host: true, state: { ...w, o: 'abcdef0123456789', ph: 'verdict', f: ['m2', 'm3'] } });
  assert.equal(decided.acts.find((a) => a.act === 'privVoid').why, O.privHasResult);
});

test('AUDIT PRE-MERGE 1003b S6: the Herald calls a session\'s bout what it is - casual, nothing counted - never "a rated bout" (mutant: the players\' rated call)', async () => onClock(async ({ step }) => {
  const o = await hosted([['Alva'], ['Brann']]);
  await pickGo(o, 'Alva', 'Brann');
  await walk(o.R, step, callMs({ fighters: [0, 0] }) + 600, screensOf(o));
  assert.ok(o.H.herald.includes(ARENA_TEXT.call.casual), 'the casual call');
  assert.ok(!o.H.herald.includes(ARENA_TEXT.call.players), 'never the rated one');
}));
