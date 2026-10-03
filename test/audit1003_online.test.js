// AUDIT PRE-MERGE 1003 (2026-10-03, Mac: "Audit this", of PR 545 - the Arena arc) - LENS O, the client's online half of
// the arena: the healers on a relay's sand (O1), a bout the relay has no more of (O2), the book on an hour whose verdict
// this screen already holds (O3), online and offline decided by the socket's state this frame (O4), the hall's queue
// across a reconnect (O5), the stands' cheer at the hour's exhibition (O7), a seat lost with the arena's sockets kept
// (O9), and a displaced home's move said read before the realm took the save (O10). Design: bible/11-Multiplayer/Arena.md
// "7. Online", the ARENA4/ARENA4b records; the one-seat rule (Seats-Arc.md, net/oneSeat.js).
//
// Each test failed on the unfixed tree for its finding's reason: a fighter healed and struck back to 1 (O1); a fighter's
// mirror held in its ring with every door saying "You are in a bout" after the relay said the bout was over (O2); 1,000
// gold taken on the side the relay had already named the winner (O3); a connecting socket's wager settled by the house,
// Fight offered off the save's ladder and the local exhibition stood (O4); "Seeking" for ever on a relay queue without me
// (O5); Cheer refused at the exhibition with its presses drawn (O7); a seat-lost tab kept in the relay's queue and sent
// to the sand (O9); the move said read under a refused checkpoint (O10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRooms } from './fakeRoom.mjs';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { createArenaGate } from '../src/scenes/arenaGate.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { ARENA_HALL, ARENA_FLOOR_CENTRE, ARENA_TICK_MS, arenaBoutRoom, arenaExhibitionRoom, validArenaIn, isArenaRoom } from '../src/net/arenaLaw.js';
import { readArenaOut, wallMsForClassicMinutes } from '../src/net/wire.js';
import { exhibitionFor, exhibitionBoutId } from '../src/net/arenaExhibition.js';
import { fighterIdentity } from '../src/systems/arenaFighters.js';
import { callMs, COUNT_MS } from '../src/systems/arenaBout.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import * as BK from '../src/systems/arenaBook.js';
import { moveArenaHomes } from '../src/systems/onlineHomes.js';
import { HOME_ARENA_MAP_ID } from '../src/net/homeLaw.js';
import * as acorn from 'acorn';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const C = ARENA_FLOOR_CENTRE;
const settled = () => new Promise((r) => setTimeout(r, 0));
const arenaOf = (ws) => ws.sent.filter((m) => m.t === 'arena');
const lastOf = (ws, k) => arenaOf(ws).filter((m) => m.k === k).at(-1) ?? null;
const word = (R, ws, w) => R.raw(ws, JSON.stringify({ t: 'arena', ...w }));
const names = (seed) => (i, mob) => fighterIdentity(seed, i, mob);
const NOON = 600 * 1440 + 12 * 60;
const noAccount = (me = null) => ({ board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => me });

/** Date.now walked by hand - the Room's clock and the client's alike; `gameMinute` stands it on the shared clock there. */
async function onClock(fn, gameMinute = null) {
  const realNow = Date.now;
  let clock = gameMinute == null ? 1_800_000_000_000 : Math.round(wallMsForClassicMinutes(gameMinute));
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}
/** A relay's receipt key - the bout's room signs its receipts with it. */
async function signingKey() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  await importReceiptKey(pkcs8, { subtle });
  return pkcs8;
}
/**
 * A CLIENT'S SOCKET IN A REAL ROOM (test/fakeRoom.mjs), shaped as net/online.js's session is to the arena: a word sent goes
 * through the wire's validArenaIn into the Room, only while open in an arena room; the Room's words to it come back
 * through readArenaOut (`pump`). `join`/`leave` as a presence-less link's; `tick` counted (O5: the link's own retry).
 */
function clientSocket(R, ws, room) {
  let seen = 0;
  const s = {
    status: 'open', arenaOk: true, room, ws, q: [], ticks: 0, onArena: null,
    sendArena(w) { const v = validArenaIn(w); if (!v || s.status !== 'open' || !isArenaRoom(s.room)) return false; s.q.push(word(R, s.ws, v)); return true; },
    async flush() { while (s.q.length) await Promise.all(s.q.splice(0)); },
    pump(onArena = (w) => s.onArena?.(w, s.room)) {
      const out = s.ws.sent.slice(seen); seen = s.ws.sent.length;
      for (const m of out) if (m.t === 'arena') { const w = readArenaOut(m); if (w) onArena(w, s.room); }
    },
    rebind(ws2) { s.ws = ws2; seen = 0; },
    join(r) { s.room = r; },
    leave() { s.status = 'closed'; s.q.push(R.drop(s.ws)); },
    tick() { s.ticks++; },
  };
  return s;
}
/** The floor's instance as a stage (its puppets stood at once). */
const floorStage = () => ({ kind: 'floor', centre: () => [...C], spawn: async (m, feet) => ({ mobile: m, entity: { health: 20, maxHealth: 20 }, attack: {}, ai: { feet: [...feet], walkTo() {} } }), remove() {}, heightAt: () => null });
/** The city's sand as a stage. */
const cityStage = (c = [400, 12, -300]) => ({ kind: 'city', centre: () => c, spawn: async (m, feet) => ({ mobile: m, entity: { health: 20, maxHealth: 20 }, attack: { swingSeq: 0 }, ai: { feet: [...feet], yaw: 0, walkTo() {} } }), remove() {}, heightAt: () => null });
/** A relay's `st` word for a bout between Alva (p0) and Brann (p1). */
const pvpSt = (o, ph = 'fight', me = 'p0') => ({ k: 'st', o, kind: 'pvp', ph, pa: 5000, fa: ph === 'fight' ? 9000 : null, lim: 180000,
  f: [['p0', 'Alva', 0, 340, 340, '', 0, -1, 0, '', ''], ['p1', 'Brann', 1, 360, 360, '', 0, -1, 0, '', '']], me, sp: 0 });
/** A relay's `st` word for the hour's exhibition. */
const exSt = (EX, ph, extra = {}) => ({ k: 'st', o: exhibitionBoutId(EX.hour), kind: 'ex', h: EX.hour, ph, pa: 0, fa: null, lim: 180000,
  f: [['a0', '-', 0, 50, 50, '', 1, EX.opponents[0].mobile, 40, '', ''], ['a1', '-', 1, 34, 34, '', 1, EX.opponents[1].mobile, 30, '', '']], me: '', sp: 3, ...extra });

// ═══ O1 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT PRE-MERGE 1003 O1 the healers on a relay\'s sand: a players\' bout run on the real Room to its end - the loser, healed by the arena\'s healers, leaves the sand whole; the `hp` riding with the relay\'s heal says every fighter whole; no blow is flashed or voiced after the healers (it was: HEALED -> 200, struck 199, myHealth -> 1) (mutants: the relay\'s heal undone; the client\'s belt gone)', async () => {
  await onClock(async ({ step, now }) => {
    const W = fakeRooms();
    const H = W.room(ARENA_HALL);
    const hA = H.connect(), hB = H.connect();
    await H.hello(hA, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ar: 1000 });
    await H.hello(hB, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', ar: 1040 });
    await word(H, hA, { k: 'q', lv: 20 }); await word(H, hB, { k: 'q', lv: 30 });
    step(1000); await H.fire();
    const o = lastOf(hA, 'of').o;
    await word(H, hA, { k: 'y', o }); await word(H, hB, { k: 'y', o });
    const go = readArenaOut(lastOf(hA, 'go'));   // AUDIT PRE-MERGE 1003 S7: the bout's room is the go's, minted there - never the offer's
    const R = W.room(arenaBoutRoom(go.o));
    R.env.GATE_SIGNING_KEY = await signingKey();
    const b = R.connect();
    await R.hello(b, 'fight-brann', { x: C[0] + 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 30 });
    await word(R, b, { k: 'in', r: 'f' });
    // Alva's screen: the real driver on the floor's instance and the host's glue, world.js's own hooks - the healers to
    // the whole, my health the relay's, a blow flashed and voiced
    const P = { name: 'Alva', health: 200, maxHealth: 200 };
    const struck = [];
    const D = createArenaBouts({ now, playerEntity: P, say() {}, notice() {}, drawHud() {}, heal: () => { P.health = P.maxHealth; }, pay() {} });
    D.setStage(floorStage());
    const a = R.connect();
    await R.hello(a, 'fight-alva', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: 20 });
    const S = clientSocket(R, a, 'world:1,1');
    const hall = { status: 'open', join() {}, leave() {}, sendArena: () => true };
    const A = createArenaOnline({ now, session: () => S, makeHall: () => hall, bouts: D, account: noAccount('acct-alva'), enterFloor: () => true, inBout: () => D.holds(), level: () => 20,
      struck: (d) => struck.push([D.bout()?.phase, d]), myHealth: (hp) => { if (P.health > 0) P.health = hp; } });
    A.model();
    hall.onArena(go);
    await settled();
    S.room = arenaBoutRoom(go.o);
    const pump = () => S.pump((w, room) => A.word(w, room));
    A.tick(); await S.flush(); pump();
    const toFight = callMs({ fighters: [0, 0] }) + 300 + COUNT_MS + 600;
    for (let t = 0; t < toFight; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); }
    pump();
    assert.equal(D.bout()?.phase, 'fight', 'the fight is on');
    // Brann beats Alva down: his claims, in reach
    await R.pose(b, { x: C[0] - 4.5, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 });
    for (let i = 0; i < 40 && !(await R.room._boutOf()).res; i++) { step(1000); await R.fire(); await word(R, b, { k: 'hit', i: 'p0', d: 999, r: 0, w: 123, m: 9, q: 300 + i }); pump(); }
    for (let t = 0; t < 12_000; t += ARENA_TICK_MS) { step(ARENA_TICK_MS); await R.fire(); pump(); }
    assert.equal((await R.room._boutOf()).b.phase, 'done', 'the relay\'s bout is done');
    assert.ok(struck.some(([ph]) => ph === 'fight' || ph === 'end'), 'the blows that beat me down were felt');
    assert.deepEqual(struck.filter(([ph]) => ph === 'heal' || ph === 'done'), [], 'nothing struck me after the healers');
    assert.equal(P.health, P.maxHealth, 'the healers\' work stands: I leave the sand whole');
    // the relay's half: the `hp` that rides with its heal says every fighter whole
    const sent = b.sent.filter((m) => m.t === 'arena');
    const at = sent.findIndex((m) => m.k === 'ev' && m.e.some((e) => e.k === 'heal'));
    assert.ok(at >= 0, 'the healers said');
    const hp = sent.slice(at + 1).find((m) => m.k === 'hp');
    assert.ok(hp, 'an `hp` rides with the heal');
    for (const [id, h, max] of hp.h) assert.equal(h, max, `${id} whole at the healers`);
  });
});

test('AUDIT PRE-MERGE 1003 O1 the client\'s belt: the blow that ends the fight is still felt (its `hp` comes on the end\'s beat), but an `hp` heard once the healers have come is the relay\'s picture, never my health - an older relay\'s bout-end health is not struck back onto me (mutants: the belt gone; the belt from the end, the last blow unfelt)', () => {
  const P = { name: 'Alva', health: 90, maxHealth: 90 };
  const felt = [], set = [];
  const D = createArenaBouts({ now: () => 1000, playerEntity: P, say() {}, notice() {}, drawHud() {}, heal: () => { P.health = P.maxHealth; }, pay() {} });
  D.setStage(floorStage());
  const O = '0123456789abcdef';
  D.startRelay({ o: O, kind: 'pvp', me: 'p0', struck: (d) => felt.push(d), myHealth: (h) => { set.push(h); P.health = h; } });
  D.relayWord(pvpSt(O, 'fight'));
  D.relayWord({ k: 'ev', e: [{ k: 'hit', at: 20_000, a: 'p1', b: 'p0', dmg: 339 }, { k: 'fall', at: 20_000, a: 'p0' }, { k: 'end', at: 20_000, side: 1, how: 'fall' }] });
  D.relayWord({ k: 'hp', h: [['p0', 1, 340], ['p1', 360, 360]] });
  assert.equal(felt.length, 1, 'the last blow felt');
  assert.equal(P.health, 1, 'down at the breath of life');
  D.relayWord({ k: 'ev', e: [{ k: 'verdict', at: 21_500, side: 1, how: 'fall' }, { k: 'heal', at: 26_000 }] });
  assert.equal(P.health, P.maxHealth, 'the healers');
  D.relayWord({ k: 'hp', h: [['p0', 1, 340], ['p1', 360, 360]] });
  assert.equal(P.health, P.maxHealth, 'the healers\' work stands');
  assert.equal(felt.length, 1, 'no blow flashed after them');
  D.relayWord({ k: 'ev', e: [{ k: 'done', at: 28_000 }] });
  D.relayWord({ k: 'hp', h: [['p0', 1, 340], ['p1', 360, 360]] });
  assert.equal(P.health, P.maxHealth);
  assert.deepEqual(set, [1], 'my health set once - by the blow, never brought down after the healers');
  // back on the sand mid-heal (a dropped socket's `in` again): the heal event missed here, the relay's healed `hp` lifts me
  const Q = { name: 'Alva', health: 1, maxHealth: 90 };
  const lifted = [], hurt = [];
  const E = createArenaBouts({ now: () => 1000, playerEntity: Q, say() {}, notice() {}, drawHud() {}, heal: () => { Q.health = Q.maxHealth; }, pay() {} });
  E.setStage(floorStage());
  E.startRelay({ o: O, kind: 'pvp', me: 'p0', struck: (d) => hurt.push(d), myHealth: (h) => { lifted.push(h); Q.health = h; } });
  E.relayWord({ ...pvpSt(O, 'heal'), res: { side: 1, how: 'fall' } });
  E.relayWord({ k: 'hp', h: [['p0', 340, 340], ['p1', 360, 360]] });
  assert.deepEqual([Q.health, lifted, hurt], [90, [90], []], 'the healers\' word lifts me whole - nothing struck');
});

// ═══ O2 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT PRE-MERGE 1003 O2 the relay says the bout this screen stands in is over (`no bout`) or void: the mirror ends - no ring, no hold, no bout - and every door is free again (it was: the mirror held in its last phase for ever, the ring 4.6 m short of the gate, "You are in a bout" at every door) (mutants: the mirror kept; the bout kept; a void bout kept)', async () => {
  for (const [m, ph] of [['no bout', 'fight'], ['void', 'wait']]) {
    const t = 1000;
    const P = { name: 'Alva', health: 80, maxHealth: 80 };
    const D = createArenaBouts({ now: () => t, playerEntity: P, say() {}, notice() {}, drawHud() {}, heal() {}, pay() {} });
    D.setStage(floorStage());
    const said = [], hallSent = [];
    const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
    const hall = { status: 'open', join() {}, leave() {}, sendArena: (w) => { hallSent.push(w); return true; } };
    const A = createArenaOnline({ now: () => t, session: () => session, makeHall: () => hall, bouts: D, account: noAccount('acct-alva'), enterFloor: () => true, inBout: () => D.holds(), say: (l) => said.push(l), level: () => 20 });
    A.model();
    const O = '0123456789abcdef';
    hall.onArena({ k: 'go', o: O, side: 0, vs: { n: 'Brann', r: 1040 } });
    await settled();
    session.room = arenaBoutRoom(O);
    A.tick();
    A.word(pvpSt(O, ph), session.room);
    assert.ok(D.holds(), `${m}: my bout holds me`);
    assert.ok(D.ring(), `${m}: the ring keeps me`);
    assert.equal(A.act('queue').text, ARENA_TEXT.online.whyBusy, `${m}: every door says so`);
    assert.equal(A.word({ k: 'no', m }, session.room), true);
    assert.ok(said.length > 0, `${m}: the line said`);
    assert.equal(D.holds(), false, `${m}: the hold let go`);
    assert.equal(D.ring(), null, `${m}: the ring let go - I may walk to the gate`);
    assert.equal(D.bout(), null, `${m}: the mirror ended`);
    assert.equal(A.bout(), null, `${m}: the bout forgotten here`);
    assert.equal(A.act('queue').ok, true, `${m}: the doors free again`);
  }
  // the hour's exhibition from the floor's stands, its room saying it has no bout: the empty stands let go too
  const EX = exhibitionFor(NOON + 2);
  const D = createArenaBouts({ now: () => 1000, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, drawHud() {}, gameMinutes: () => NOON + 2 });
  D.setStage(floorStage());
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const A = createArenaOnline({ now: () => 1000, session: () => session, makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }), bouts: D, names, account: noAccount(), enterFloor: () => true });
  assert.equal(A.watchExhibition(EX), true);
  await settled();
  session.room = arenaExhibitionRoom(EX.hour);
  A.tick();
  assert.equal(D.relay()?.o, exhibitionBoutId(EX.hour));
  A.word({ k: 'no', m: 'no bout' }, session.room);
  assert.deepEqual([D.relay(), A.bout()], [null, null], 'no bout this hour: the stands let go');
  assert.equal(A.watchExhibition(EX), true, 'the Herald\'s Watch free again');
});

// ═══ O3 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The city's exhibition online: the real driver on the city's sand, the real glue (its socket a fake link), the real
 *  gate with world.js's own `begun` (arenaBoutBegun) and `liveHour` - the c1 sequence's pieces. */
function cityBook(gm0) {
  const st = { t: 1000, gm: gm0 };
  const P = { name: 'Alva', health: 80, maxHealth: 80, goldPieces: 2000, items: [], arenaLeague: null };
  const c = [400, 12, -300];
  let gate;
  const D = createArenaBouts({ now: () => st.t, playerEntity: P, say() {}, drawHud() {}, gameMinutes: () => st.gm, exhibitionVerdict: (h, s) => gate.verdictSeen(h, s) });
  D.setStage(cityStage(c));
  const links = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const A = createArenaOnline({ now: () => st.t, session: () => session, bouts: D, names,
    makeHall: () => { const l = { status: 'open', room: null, join(r) { this.room = r; }, leave() { this.status = 'closed'; }, sendArena: () => true }; links.push(l); return l; },
    account: noAccount(), enterFloor: () => true, verdictHeard: () => gate.settle() });
  const begun = () => { const b = D.bout(); return D.hour() != null && !!b && !['call', 'walk', 'count'].includes(b.phase); };   // world.js arenaBoutBegun
  gate = createArenaGate({ playerEntity: P, gameMinutes: () => st.gm, showOverlay() {}, liveHour: () => D.hour(), begun, online: () => A, openWindow: null });
  return { st, P, c, D, A, gate, links, session, say: (w, EX) => links[0].onArena(w, arenaExhibitionRoom(EX.hour)) };
}

test('AUDIT PRE-MERGE 1003 O3 the book online shuts on what this screen heard of the hour, not on the mirror standing: the relay\'s verdict heard and the city\'s crowd gone home, a wager on the winner is refused (it was taken - 1,000 gold at 6 to 4 on a known result, every game hour); the fight\'s start heard and the sand walked off, refused too; before the fight it is taken (mutants: the hour\'s heard verdict ignored; the fight heard ignored; the book shut at the call)', () => {
  const EX = exhibitionFor(NOON + 1);
  const K = cityBook(NOON + 1);
  K.A.watchCity(EX); K.A.tick();
  K.say(exSt(EX, 'call'), EX);
  // a second purse at the call: the book is open before the fight (one wager an hour - the first purse's stays clear)
  const P2 = { name: 'Brann', health: 80, maxHealth: 80, goldPieces: 2000, items: [], arenaLeague: null };
  const begun = () => { const b = K.D.bout(); return K.D.hour() != null && !!b && !['call', 'walk', 'count'].includes(b.phase); };
  const gate2 = createArenaGate({ playerEntity: P2, gameMinutes: () => K.st.gm, showOverlay() {}, liveHour: () => K.D.hour(), begun, online: () => K.A, openWindow: null });
  assert.equal(gate2.wager(EX.hour, 0, 10).ok, true, 'the call: the book open');
  K.say({ k: 'ev', e: [{ k: 'fight', at: 9000 }] }, EX);
  assert.equal(K.gate.wager(EX.hour, 0, 1000).ok, false, 'the fight on the sand: shut');
  K.st.t += 25_000; K.st.gm = NOON + 6;
  K.say({ k: 'ev', e: [{ k: 'fall', at: 25000, a: 'a0' }, { k: 'end', at: 25000, side: 1, how: 'fall' }, { k: 'verdict', at: 26500, side: 1, how: 'fall' }, { k: 'heal', at: 31000 }, { k: 'done', at: 33000 }] }, EX);
  assert.deepEqual(K.A.exhibitionVerdict(EX.hour, K.st.gm), { side: 1 }, 'the relay\'s verdict heard');
  for (let i = 0; i < 40; i++) { K.st.t += 1000; K.D.frame(1, { playerFeet: K.c }); K.A.tick(); }
  K.st.gm = NOON + 14;
  assert.equal(K.D.bout(), null, 'the crowd went home - the mirror is gone');
  assert.equal(K.A.watchCity(EX), false, 'the hour is not stood again');
  const before = K.P.goldPieces;
  const r = K.gate.wager(EX.hour, 1, 1000);
  assert.equal(r.ok, false, 'the winner already named: no wager');
  assert.equal(r.text, ARENA_TEXT.book.whyRefused.closed);
  assert.equal(K.P.goldPieces, before, 'no gold taken');
  // the fight's start heard (an `ev`, or an `st` past the count) and the sand walked off before any verdict
  for (const words of [[exSt(EX, 'call'), { k: 'ev', e: [{ k: 'fight', at: 9000 }] }], [exSt(EX, 'fight', { fa: 9000 })]]) {
    const L = cityBook(NOON + 2);
    L.A.watchCity(EX); L.A.tick();
    for (const w of words) L.say(w, EX);
    L.D.dismiss();
    L.A.tick();
    assert.equal(L.D.bout(), null);
    assert.equal(L.gate.wager(EX.hour, 1, 100).ok, false, `${words.at(-1).k}: the fight begun is heard - shut`);
  }
});

// ═══ O4 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT PRE-MERGE 1003 O4 online is a fact of the session, not of its socket this frame: a door\'s reconnect (`connecting`) with the arena\'s relay known keeps every door online - an online wager waits for the relay\'s verdict (it was settled by the house\'s seeded record), the Herald offers no Fight before the realm\'s climb is in (it offered the save\'s), the city\'s hour is the relay\'s (the local exhibition was stood); a seat lost or a relay without the arena is offline (mutants: the socket\'s status read; the seat ignored; the relay\'s word ignored)', async () => {
  const EX = exhibitionFor(NOON + 2);
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const links = [];
  const bouts = { ask() {}, relay: () => null, dismiss() {}, exhibitionWord: () => true, relayWord: () => true, holds: () => false, setRealm() {} };
  const A = createArenaOnline({ now: () => 0, session: () => session, bouts, names,
    makeHall: () => { const l = { status: 'open', room: null, join(r) { this.room = r; }, leave() { this.status = 'closed'; }, sendArena: () => true }; links.push(l); return l; },
    account: noAccount(), enterFloor: () => true });
  let gm = NOON + 2;
  const P = { goldPieces: 1000, items: [], arenaLeague: null, arenaLadder: null, health: 100, maxHealth: 100, name: 'Alva' };
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay() {}, liveHour: () => null, begun: () => false, online: () => A, openWindow: null });
  const house = BK.houseOutcome(EX);
  assert.equal(gate.wager(EX.hour, house === 0 ? 1 : 0, 100).ok, true, 'a wager online, against the house\'s record');
  gm = NOON + 70;   // the hour is out; its verdict not heard here
  session.status = 'connecting';   // a door's room change: the socket between rooms
  assert.equal(A.live(), true, 'online all the same');
  assert.equal(A.exhibitions(), true, 'the hour\'s bout the relay\'s');
  gate.settle();
  assert.equal(P.arenaLeague.book.wagers[0].status, 'open', 'the wager waits for the relay\'s verdict - never the house\'s');
  assert.equal(links.at(-1)?.room, arenaExhibitionRoom(EX.hour), 'asked of its room');
  links.at(-1).tick = () => { links.at(-1).ticks = (links.at(-1).ticks ?? 0) + 1; };
  A.tick();
  assert.equal(links.at(-1).ticks, 1, 'the verdict\'s socket ticked here - its own retry (O5)');
  P.arenaLadder = null;
  const ch = gate.heraldChoice({ cityBout: null, healthShare: 1, league: null });
  assert.ok(!ch.options.some((o) => o.act === 'fight'), 'no Fight before the realm\'s climb is in - never the save\'s');
  for (const status of ['closed', 'error']) { session.status = status; assert.equal(A.live(), true, `${status}: a blip is no logout`); }
  // world.js arenaFrame's branch, over the real driver: stepping out of a door beside the colosseum in the hour
  let t = 1000;
  const D = createArenaBouts({ now: () => t, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, drawHud() {}, gameMinutes: () => NOON + 2 });
  const S2 = { status: 'connecting', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const links2 = [];
  const B = createArenaOnline({ now: () => t, session: () => S2, bouts: D, names,
    makeHall: () => { const l = { status: 'open', room: null, join(r) { this.room = r; }, leave() { this.status = 'closed'; }, sendArena: () => true }; links2.push(l); return l; },
    account: noAccount(), enterFloor: () => true });
  const city = cityStage();
  let hourRun = null;
  const asked = [];
  const ask = D.ask;
  const frame = (stg) => {   // world.js arenaFrame, its branch verbatim but for the host's names
    B.tick();
    D.setStage(stg);
    if (stg === city && !D.bout() && !D.pending()) {
      const ex = exhibitionFor(NOON + 2);
      if (B.exhibitions?.()) B.watchCity(ex);
      else if (ex?.open && ex.hour !== hourRun) { hourRun = ex.hour; asked.push(ex.hour); ask({ where: 'city', kind: 'exhibition', ex }); }
    }
  };
  frame(null); frame(city);
  await settled();
  t += 16; frame(city);
  assert.deepEqual(asked, [], 'no local exhibition stood online');
  assert.notEqual(D.kind(), 'exhibition');
  assert.equal(links2.length, 1, 'the hour\'s room watched from a socket of its own');
  assert.match(rd('src/scenes/world.js'), /if \(arenaOnline\?\.exhibitions\?\.\(\)\) arenaOnline\.watchCity\(ex\);\n\s+else if \(ex\?\.open && ex\.hour !== _arenaHourRun\)/, 'world.js arenaFrame is that branch');
  // offline: a seat lost (net/online.js supersede - its status 'error', its relay's word kept), a relay without the arena
  S2.status = 'open';
  assert.equal(B.live(), true);
  Object.assign(S2, { superseded: true, status: 'error' });
  assert.equal(B.live(), false, 'a seat lost is offline');
  Object.assign(S2, { superseded: false, status: 'open', arenaOk: false });
  assert.equal(B.live(), false, 'a relay that opens no arena room is offline');
});

test('AUDIT PRE-MERGE 1003 O4 a door that needs a socket waits for it with a line that says so: Find a match while the hall\'s own socket is still opening says the hall is a moment away - not "Online only" (mutants: the offline line online)', () => {
  const session = { status: 'connecting', arenaOk: true, room: 'world:1,1', sendArena: () => false };
  const hall = { status: 'connecting', join() {}, leave() {}, sendArena: () => false };
  const A = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => hall, bouts: { ask() {}, dismiss() {}, relay: () => null, setRealm() {}, holds: () => false }, account: noAccount('acct-alva'), enterFloor: () => true, level: () => 10 });
  const r = A.act('queue');
  assert.equal(r.ok, false);
  assert.equal(r.text, ARENA_TEXT.online.hallWait, 'a moment, not offline');
  assert.notEqual(ARENA_TEXT.online.hallWait, ARENA_TEXT.online.whyOffline);
  hall.status = 'open'; hall.sendArena = () => true;
  assert.equal(A.act('queue').ok, true, 'and once it stands, the queue');
});

// ═══ O5 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT PRE-MERGE 1003 O5 the hall\'s socket comes back while I seek: my queue word said again on it - the relay\'s queue holds me again and a waiting rival is offered (it was: "Seeking" for ever on a queue without me); an offer the drop lost is sought again, a casual seek stays casual; the link\'s own retry is ticked here (mutants: the word never said again; said again on the old socket only; the offer case left; the link never ticked)', async () => {
  await onClock(async ({ step, now }) => {
    const W = fakeRooms();
    const H = W.room(ARENA_HALL);
    const hello = async (id, sub, name) => { const ws = H.connect(); await H.hello(ws, id, null, { name, kind: 'linked', tokenSub: sub, ar: 1000 }); return ws; };
    const s1 = await hello('peer-alva', 'acct-alva', 'Alva');
    const hall = clientSocket(H, s1, ARENA_HALL);
    const presence = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
    const A = createArenaOnline({ now, session: () => presence, makeHall: () => hall, bouts: { ask() {}, dismiss() {}, relay: () => null, setRealm() {}, holds: () => false }, account: noAccount('acct-alva'), enterFloor: () => true, level: () => 10 });
    const run = async (ms) => { for (let t = 0; t < ms; t += 1000) { step(1000); A.tick(); await hall.flush(); await H.fire(); hall.pump(); } };
    A.model();
    assert.equal(A.act('casual').ok, true);
    await hall.flush(); hall.pump();
    assert.equal(A.hall().queue, 'queued');
    A.tick();
    assert.equal(hall.ticks, 1, 'the hall\'s link ticked here - its retry and its heartbeat are its own tick');
    const queued = async () => (await H.room._hallOf()).q.map((e) => [e.sub, e.casual]);
    assert.deepEqual(await queued(), [['acct-alva', true]]);
    // the hall's socket drops (a blip, a relay deploy); the relay takes me out of its queue as it closes
    hall.status = 'closed';
    A.tick();
    await H.drop(s1);
    assert.deepEqual(await queued(), [], 'out of the relay\'s queue');
    const s2 = await hello('peer-alva', 'acct-alva', 'Alva');
    hall.rebind(s2); hall.status = 'open';
    A.tick(); await hall.flush(); hall.pump();
    assert.deepEqual(await queued(), [['acct-alva', true]], 'my word said again on the new socket - casual still');
    assert.equal(A.hall().queue, 'queued');
    // a casual rival comes: offered
    const r1 = await hello('peer-brann', 'acct-brann', 'Brann');
    await word(H, r1, { k: 'q', u: 1 });
    await run(3000);
    assert.equal(A.hall().queue, 'offer', 'a waiting rival is offered');
    assert.equal(A.hall().offer.vs.n, 'Brann');
    // the socket drops with the offer standing: the relay declines it for me as I go; back, I seek again
    hall.status = 'closed';
    A.tick();
    await H.drop(s2);
    const s3 = await hello('peer-alva', 'acct-alva', 'Alva');
    hall.rebind(s3); hall.status = 'open';
    A.tick();
    assert.deepEqual([A.hall().queue, A.hall().offer], ['queued', null], 'the dead offer is not there to accept while the relay answers');
    await run(2000);
    assert.equal(A.hall().queue, 'queued', 'the lost offer sought again');
    assert.ok((await queued()).some(([sub]) => sub === 'acct-alva'), 'in the relay\'s queue again');
  });
});

// ═══ O7 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT PRE-MERGE 1003 O7 the stands\' cheer at the hour\'s exhibition: from the floor\'s instance (the Herald\'s Watch) and from the city\'s sand, Cheer goes down the socket standing in `arena:x<hour>` - the real Room takes it and echoes the shout (it was: the presses drawn, every press refused); a bout watched with no door draws no presses (mutants: the floor\'s door unhanded; the city\'s unhanded; the exhibition\'s door dropped; the presses drawn without a door)', async () => {
  const EX = exhibitionFor(NOON + 2);
  const room = arenaExhibitionRoom(EX.hour);
  const cr = (ws) => arenaOf(ws).filter((m) => m.k === 'cr');
  // the floor's instance: the presence session's own room
  await onClock(async ({ now }) => {
    const W = fakeRooms();
    const R = W.room(room);
    const ws = R.connect();
    await R.hello(ws, 'seat-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
    const S = clientSocket(R, ws, 'world:1,1');
    const D = createArenaBouts({ now, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, drawHud() {}, gameMinutes: () => NOON + 2 });
    D.setStage(floorStage());
    const A = createArenaOnline({ now, session: () => S, makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }), bouts: D, names, account: noAccount('acct-alva'), enterFloor: () => true });
    assert.equal(A.watchExhibition(EX), true);
    await settled();
    S.room = room;
    A.tick(); await S.flush(); S.pump((w, r) => A.word(w, r));
    assert.equal(D.relay()?.o, exhibitionBoutId(EX.hour), 'the relay\'s exhibition stands on the floor');
    assert.equal(D.cheer(1), true, 'Cheer pressed from the stands');
    await S.flush();
    assert.deepEqual(cr(ws).map((m) => [m.c, m.n]), [[1, 1]], 'the room took my cheer and fanned it');
  }, NOON + 2);
  // the city's sand: its own socket in the same room
  await onClock(async ({ now, step }) => {
    const W = fakeRooms();
    const R = W.room(room);
    const ws = R.connect();
    await R.hello(ws, 'city-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva' });
    const link = clientSocket(R, ws, null);
    const D = createArenaBouts({ now, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, drawHud() {}, gameMinutes: () => NOON + 2 });
    const c = [400, 12, -300];
    D.setStage(cityStage(c));
    const A = createArenaOnline({ now, session: () => ({ status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true }), makeHall: () => link, bouts: D, names, account: noAccount(), enterFloor: () => true });
    assert.equal(A.watchCity(EX), true);
    A.tick(); await link.flush(); link.pump();
    await settled();
    assert.equal(link.ticks, 1, 'the city\'s socket ticked here - its own retry (O5)');
    assert.equal(D.relay()?.o, exhibitionBoutId(EX.hour), 'the relay\'s exhibition stands on the city\'s sand');
    D.frame(0.016, { playerFeet: c });
    assert.equal(D.cheer(1), true, 'Cheer pressed from the city\'s stands');
    await link.flush();
    assert.deepEqual(cr(ws).map((m) => [m.c, m.n]), [[1, 1]], 'down the city\'s socket, taken and fanned');
    // the socket between its drop and its `in` again: no seat yet, so no shout (the relay junks one from a seatless socket)
    link.status = 'closed';
    A.tick();
    link.status = 'open';
    step(2000);
    assert.equal(D.cheer(-1), false, 'no shout before my seat is taken again');
    await link.flush();
    assert.equal(cr(ws).length, 1);
  }, NOON + 2);
  // a relay's bout watched with no door back: no presses drawn, none taken
  const huds = [];
  const D = createArenaBouts({ now: () => 1000, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, drawHud: (m, o) => huds.push([m, o]) });
  D.setStage(floorStage());
  const O = '0123456789abcdef';
  D.startRelay({ o: O, kind: 'pvp', me: '' });
  D.relayWord(pvpSt(O, 'fight', ''));
  D.frame(0.016, {});
  const [m, o] = huds.at(-1);
  assert.equal(m.stands, null, 'no door: no presses');
  assert.equal(o.cheer, null);
  assert.equal(D.cheer(1), false);
});

// ═══ O9 ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT PRE-MERGE 1003 O9 ONE-SEAT: a tab that gave its seat up leaves the arena\'s rooms too - out of the relay\'s queue at once (it stayed, was shown the offer and sent to the sand offline); a call or an offer heard while the seat is another tab\'s is not followed; world.js leaveSeat says so (mutants: the hall kept; the city kept; the call followed; the offer shown; leaveSeat unwired)', async () => {
  await onClock(async ({ step, now }) => {
    const W = fakeRooms();
    const H = W.room(ARENA_HALL);
    const t1 = H.connect();
    await H.hello(t1, 'tab1-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ar: 1000 });
    const hall = clientSocket(H, t1, ARENA_HALL);
    const presence = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
    const cityLinks = [];
    const A = createArenaOnline({ now, session: () => presence,
      makeHall: () => { if (!cityLinks.length && hall.status === 'open' && !hall.used) { hall.used = true; return hall; } const l = { status: 'open', room: null, join(r) { this.room = r; }, leave() { this.status = 'closed'; }, sendArena: () => true }; cityLinks.push(l); return l; },
      bouts: { ask() {}, dismiss() {}, relay: () => null, setRealm() {}, holds: () => false, exhibitionWord: () => true }, account: noAccount('acct-alva'), enterFloor: () => true, level: () => 10, names });
    A.model();
    assert.equal(A.act('queue').ok, true);
    await hall.flush(); hall.pump();
    assert.deepEqual((await H.room._hallOf()).q.map((e) => e.sub), ['acct-alva']);
    assert.equal(A.watchCity(exhibitionFor(NOON + 2)), true);
    const past = exhibitionFor(NOON - 60 + 2).hour;
    assert.equal(A.exhibitionVerdict(past, NOON + 2), null, 'a verdict asked of a past hour\'s room');
    assert.equal(cityLinks.length, 2);
    // the seat is another tab's now (world.js leaveSeat: online.supersede(), then the arena's own rooms)
    Object.assign(presence, { superseded: true, status: 'error' });
    A.leaveAll?.();
    await hall.flush();
    step(1000); await H.fire();
    assert.deepEqual((await H.room._hallOf()).q.map((e) => e.sub), [], 'out of the relay\'s queue');
    assert.equal(hall.status, 'closed', 'the hall\'s socket left');
    assert.equal(cityLinks[0].status, 'closed', 'the city\'s exhibition socket left');
    assert.equal(cityLinks[1].status, 'closed', 'the verdict\'s socket left');
    assert.equal(A.hall().queue, 'idle');
  });
  // a tab on the sand when its seat goes: the bout let go with the room it stood in - its mirror ended
  let relay = null;
  const dismissed = [];
  const fl = { status: 'open', join() {}, leave() { this.status = 'closed'; }, sendArena: () => true };
  const P0 = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const F = createArenaOnline({ now: () => 0, session: () => P0, makeHall: () => fl, bouts: { ask: (p) => { relay = { o: p.relay.o, me: p.relay.me }; }, relay: () => relay, dismiss: () => { dismissed.push(1); relay = null; }, setRealm() {}, holds: () => !!relay }, account: noAccount('acct-alva'), enterFloor: () => true, level: () => 10 });
  F.model();
  fl.onArena({ k: 'go', o: '0123456789abcdef', side: 0, vs: { n: 'Brann', r: 1000 } });
  await settled();
  assert.equal(F.bout()?.o, '0123456789abcdef');
  Object.assign(P0, { superseded: true, status: 'error', room: null });
  F.leaveAll();
  assert.deepEqual([F.bout(), dismissed.length], [null, 1], 'the bout and its mirror let go');
  // a word on a link still standing while the seat is another tab's: no offer shown, no call followed
  const entered = [], closed = [];
  const presence = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const link = { status: 'open', join() {}, leave() { this.status = 'closed'; }, sendArena: () => true };
  const B = createArenaOnline({ now: () => 0, session: () => presence, makeHall: () => link, bouts: { ask() {}, dismiss() {}, relay: () => null, setRealm() {}, holds: () => false }, account: noAccount('acct-alva'), enterFloor: (k, o) => { entered.push([k, o]); return true; }, closeWindow: () => closed.push(1), level: () => 10 });
  B.model();
  Object.assign(presence, { superseded: true, status: 'error' });
  link.onArena({ k: 'of', o: '0123456789abcdef', vs: { n: 'Brann', r: 1000 }, until: 20_000 });
  assert.notEqual(B.hall().queue, 'offer', 'no offer shown to a seat-lost tab');
  link.onArena({ k: 'go', o: '0123456789abcdef', side: 0, vs: { n: 'Brann', r: 1000 } });
  await settled();
  assert.deepEqual([entered, closed, B.bout()], [[], [], null], 'the call not followed - the window kept, the floor not entered');
  assert.match(rd('src/scenes/world.js'), /const leaveSeat = \(now\) => \{[\s\S]*?online\?\.supersede\(\);[\s\S]*?arenaOnline\?\.leaveAll\(\)[\s\S]*?seatLock\?\.release\(\);/, 'world.js leaveSeat leaves the arena\'s rooms');
});

// ═══ O10 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** World.js's own statements, by name (test/auditrealm2_client.test.js's harness): a declaration's text, mounted over a
 *  state that stands in for the host's closure. */
function worldStatements() {
  const S = rd('src/scenes/world.js');
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const hits = (pred) => { const out = []; (function walk(n) { if (!n || typeof n.type !== 'string') return; if (pred(n)) out.push(n); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); } })(AST); return out; };
  const one = (h, what) => { assert.equal(h.length, 1, what); return S.slice(h[0].start, h[0].end); };
  return {
    fn: (name) => one(hits((n) => n.type === 'FunctionDeclaration' && n.id?.name === name), `function ${name}`),
    decl: (name) => one(hits((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id?.name === name)), `the declaration of ${name}`),
  };
}
const scoped = (state) => new Proxy(state, { has: (t, k) => k !== '__s', get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])), set: (t, k, v) => { t[k] = v; return true; } });
// eslint-disable-next-line no-new-func
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

test('AUDIT PRE-MERGE 1003 O10 a displaced home\'s move is said read only once the realm took the save that holds its emptied scene - world.js\'s own checkpoint (onlineCheckpointLanded over onlineCheckpoint and realmCheckpoint, the composer\'s sink) under moveArenaHomes: the put refused - never read (it was read as the save was handed over); landed - read after it; refused outright - never (mutants: read on the hand-over; read on a refusal; the caller\'s sink unhanded; the hand-over answered; the host\'s hook the hand-over)', async () => {
  const key = (x, y, r) => (x << 16) | (y << 8) | r;
  const OLD = key(4, 3, 5), NEW = key(1, 1, 0);
  const W = worldStatements();
  for (const [answer, read] of [[{ ok: false, error: 'lease' }, false], [{ ok: true }, true], ['refused', false]]) {
    const order = [];
    let land = null;
    // the realm session's checkpoint behind the composer's sink (world.js setRealmSaveSink): its put, answered later
    const realmSink = (snap) => { order.push(`handed ${snap.n}`); return new Promise((r) => { land = () => { order.push('put answered'); r(answer); }; }); };
    const state = {
      realmSession: { lost: null }, realmSaveSink: () => realmSink, QUICK_SAVE_NAME: 'QuickSave', townTalk: { overlay: null }, DeathScreen: class {}, playerEntity: { health: 10 },
      checkpointAllowed: () => answer !== 'refused', online: {}, playerSpawned: true, seatOut: () => false, duelMgr: null, ownWalkWaiting: () => false, performance: { now: () => 0 },
      exitAutosaveNames: () => [], _checkpointAt: -Infinity, worldQuickSave: null,
      // the standing composer (worldModes quickSaveNow -> worldQuickSave / dungeonContext quickSave): the caller's sink, else the realm's
      modes: { deathUp: () => false, quickSaveNow: (name, opts = {}) => { const into = opts.sink ?? realmSink; into({ n: name }); return true; } },
    };
    const landed = mount(`${W.decl('onlineCheckpoint')}\n${W.fn('realmCheckpoint')}\n${W.decl('onlineCheckpointLanded')}\nreturn onlineCheckpointLanded;`, state);
    const run = moveArenaHomes({
      homes: { ensure: async () => true, homesIn: () => new Map([[OLD, { buildingKey: OLD, hall: true, keeper: true }]]) },
      api: {
        arenaMoves: async () => ({ ok: true, data: { moves: [] } }),
        arenaMove: async (b) => ({ ok: true, data: { ok: true, mapId: HOME_ARENA_MAP_ID, from: b.from, to: b.to, refund: 0, hall: true } }),
        arenaSeen: async () => { order.push('seen'); return { ok: true, data: { seen: true } }; },
      },
      mapId: HOME_ARENA_MAP_ID, character: 'r-me', realm: null, pick: () => ({ buildingKey: NEW }), emptyScene: () => ({ own: [] }), hooks: { checkpoint: () => landed() },
    });
    for (let i = 0; i < 5; i++) await settled();
    assert.ok(!order.includes('seen'), `${JSON.stringify(answer)}: not read while the put is out`);
    if (answer !== 'refused') assert.deepEqual(order, ['handed QuickSave'], 'the save handed to the realm, its put out');
    land?.();
    await run;
    assert.equal(order.includes('seen'), read, `${JSON.stringify(answer)}: read ${read}`);
    if (read) assert.ok(order.indexOf('seen') > order.indexOf('put answered'), 'read after the realm took it');
  }
  assert.match(rd('src/scenes/world.js'), /checkpoint: \(\) => onlineCheckpointLanded\(\),/, 'moveArenaHomesOnline hands the landed checkpoint');
});
