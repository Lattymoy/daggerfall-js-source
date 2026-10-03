// ARENA4b (2026-10-03, bible/11-Multiplayer/Arena.md 2: "Exhibition - online: yes - the relay runs it, every client sees
// one bout"): THE RELAY'S EXHIBITION ON THE CLIENT, DRIVEN - the bout driver standing the relay's bout as the hour's on
// the city's sand (scenes/arenaBouts.js startExhibitionRelay / exhibitionWord: the relay's frame on the city's, the
// exterior's own bodies walked by their motor, the swing off the attack's count, the Red against the Blue, the call, the
// purse's bark, the verdict to the bookmaker, the HUD by the distance), the host's glue (scenes/arenaOnline.js: the
// city's spectator socket, the Herald's Watch and the window's list into the room, the verdict heard or asked), the
// bookmaker settling by the relay's verdict (scenes/arenaGate.js settle), and the hosts' wiring (by source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArenaBouts, CITY_SNAP_M, CROWD_STAYS_MS, LEAVE_AFTER_MS } from '../src/scenes/arenaBouts.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { createArenaGate } from '../src/scenes/arenaGate.js';
import { exhibitionFor, exhibitionBoutId, EXHIBITION_KEPT_HOURS } from '../src/net/arenaExhibition.js';
import { ARENA_FLOOR_CENTRE, arenaExhibitionRoom } from '../src/net/arenaLaw.js';
import { verdictOfWord } from '../src/net/arenaLink.js';
import { fighterIdentity } from '../src/systems/arenaFighters.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import * as BK from '../src/systems/arenaBook.js';
import { onlineCards } from '../src/systems/arenaBoard.js';

const NOON = 600 * 1440 + 12 * 60;
const EX = exhibitionFor(NOON + 2);
const O = exhibitionBoutId(EX.hour);
const C0 = ARENA_FLOOR_CENTRE;
const names = (seed) => (i, mob) => fighterIdentity(seed, i, mob);
/** The relay's `st` of the hour's bout - its two, the stands. */
const exSt = (ph = 'call', extra = {}) => ({ k: 'st', o: O, kind: 'ex', h: EX.hour, ph, pa: 5000, fa: ph === 'fight' ? 9000 : null, lim: 180000,
  f: [['a0', '-', 0, 50, 50, '', 1, EX.opponents[0].mobile, 40, '', ''], ['a1', '-', 1, 34, 34, '', 1, EX.opponents[1].mobile, 30, '', '']], me: '', sp: 3, ...extra });

/** A city's stage (its sand's centre far from the instance's frame) and a driver over it. */
function cityDriver() {
  let t = 1000;
  const P = { name: 'Alva', health: 80, maxHealth: 80 };
  const said = [], huds = [], spawned = [], spawnOpts = [], removed = [], told = [];
  const c = [400, 12, -300];
  const stage = {
    kind: 'city', centre: () => c,
    spawn: async (mobile, feet, o) => {
      spawnOpts.push(o);
      const foe = { mobile, entity: { health: 20, maxHealth: 20 }, attack: { swingSeq: 0, firedRanged: true }, ai: { feet: [...feet], yaw: 0, isHostile: true, walkGoal: null, walks: [], walkTo(p, w) { this.walkGoal = [...p]; this.walks.push([[...p], w.pace]); } } };
      spawned.push(foe);
      return foe;
    },
    remove: (f) => removed.push(f), heightAt: () => null,
  };
  const D = createArenaBouts({ now: () => t, playerEntity: P, say: (l) => said.push(l), drawHud: (m) => huds.push(m), exhibitionVerdict: (h, s) => told.push([h, s]), gameMinutes: () => NOON + 2 });
  D.setStage(stage);
  return { D, P, c, said, huds, spawned, spawnOpts, removed, told, step: (ms) => { t += ms; }, now: () => t };
}

test('ARENA4b the relay\'s exhibition on the city\'s sand: its fighters stood where the relay has them on the CITY\'s frame (its sand\'s centre, not the instance\'s), bodies every screen stands its own copy of, held by the bout, named off the hour, the Red against the Blue; the Herald calls the exhibition (mutants: the instance\'s frame on the city; the bodies streamed; the players\' call)', async () => {
  const R = cityDriver();
  R.D.ask({ where: 'city', relayEx: { o: O, ex: EX, names: names(EX.seed) } });
  assert.deepEqual(R.D.relay(), { o: O, me: '', kind: 'ex' }, 'the relay\'s bout, from the stands');
  assert.equal(R.D.hour(), EX.hour, 'the hour\'s exhibition stands here (the book and the schedule read it)');
  R.D.exhibitionWord({ k: 'mv', i: 'a0', x: C0[0] - 6, z: C0[2], tx: C0[0] - 6, tz: C0[2], v: 0, at: 5000 });
  R.D.exhibitionWord({ k: 'mv', i: 'a1', x: C0[0] + 6, z: C0[2] + 1, tx: C0[0] + 6, tz: C0[2] + 1, v: 0, at: 5000 });
  assert.equal(R.D.exhibitionWord(exSt('call')), true);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(R.spawned.map((f) => [f.mobile, f.ai.feet[0], f.ai.feet[2]]), [[EX.opponents[0].mobile, R.c[0] - 6, R.c[2]], [EX.opponents[1].mobile, R.c[0] + 6, R.c[2] + 1]], 'the relay\'s marks on the city\'s sand');
  assert.ok(R.spawnOpts.every((o) => o.mirror === true), 'a mirror\'s body - the cell streams it to nobody');
  assert.ok(R.spawnOpts.every((o) => o.bout.hold === true && typeof o.bout.hooks.intrude === 'function'), 'held by the bout; a blow from the stands answered as this screen\'s bout answers it');
  assert.equal(R.D.bout().fighters[0].name, fighterIdentity(EX.seed, 0, EX.opponents[0].mobile).name, 'named as the offline bout names them');
  assert.equal(R.D.bout().kind, 'exhibition', 'the law\'s own kind of bout');
  R.D.exhibitionWord({ k: 'ev', e: [{ k: 'call', at: 5000 }] });
  assert.ok(R.said.includes(ARENA_TEXT.call.exhibition), 'the exhibition\'s call');
  assert.ok(!R.said.includes(ARENA_TEXT.call.players));
  R.D.frame(0.016, { playerFeet: [R.c[0], R.c[1], R.c[2] - 20] });
  const hud = R.huds.at(-1);
  assert.deepEqual([hud.left[0].team, hud.right[0].team], ['red', 'blue'], 'the Red\'s fighter against the Blue\'s');
  R.D.frame(0.016, { playerFeet: [R.c[0] + 200, R.c[1], R.c[2]] });
  assert.equal(R.huds.at(-1), null, 'watched from the far market: no bar');
});

test('ARENA4b the city\'s bodies follow the relay: walked by their own motor to the relay\'s walk\'s end, stood there when they fall behind, a telegraphed blow their own swing toward its mark (mutants: no walk; never stood; the swing unplayed)', async () => {
  const R = cityDriver();
  R.D.ask({ where: 'city', relayEx: { o: O, ex: EX, names: names(EX.seed) } });
  R.D.exhibitionWord({ k: 'mv', i: 'a0', x: C0[0] - 6, z: C0[2], tx: C0[0] - 6, tz: C0[2], v: 0, at: 5000 });
  R.D.exhibitionWord(exSt('call'));
  await new Promise((r) => setTimeout(r, 0));
  const foe = R.spawned[0];
  R.D.exhibitionWord({ k: 'ev', e: [{ k: 'fight', at: 9000 }] });
  R.D.exhibitionWord({ k: 'mv', i: 'a0', x: C0[0] - 6, z: C0[2], tx: C0[0] - 1, tz: C0[2], v: 3, at: 9000 });
  R.step(500);
  R.D.frame(0.016, { playerFeet: R.c });
  assert.deepEqual(foe.ai.walks.at(-1), [[R.c[0] - 1, foe.ai.feet[1], R.c[2]], 1], 'its motor walks it to the relay\'s walk\'s end, on the city\'s frame');
  R.step(10_000);
  foe.ai.walkGoal = null;
  R.D.frame(0.016, { playerFeet: R.c });
  assert.ok(Math.abs(foe.ai.feet[0] - (R.c[0] - 1)) < 1e-9, `fallen ${CITY_SNAP_M} m behind, stood where the relay has it`);
  const seq = foe.attack.swingSeq;
  R.D.exhibitionWord({ k: 'atk', i: 'a0', at: 20_000, x: C0[0] + 3, z: C0[2], tg: 'a1' });
  assert.equal(foe.attack.swingSeq, seq + 1, 'its own swing, off the attack\'s count');
  assert.equal(foe.attack.firedRanged, false);
  assert.ok(Math.abs(foe.ai.yaw - Math.PI / 2) < 1e-9, 'turned to its blow\'s mark');
});

test('ARENA4b the relay\'s verdict on the city\'s sand: the Herald\'s line, the purse\'s bark, the bookmaker told the relay\'s side for the hour; the crowd goes home and the sand is let go (mutants: the verdict untold; the city\'s bout never let go)', async () => {
  const R = cityDriver();
  R.D.ask({ where: 'city', relayEx: { o: O, ex: EX, names: names(EX.seed) } });
  R.D.exhibitionWord(exSt('fight'));
  await new Promise((r) => setTimeout(r, 0));
  R.D.exhibitionWord({ k: 'ev', e: [{ k: 'fall', at: 20_000, a: 'a0' }, { k: 'end', at: 20_000, side: 1, how: 'fall' }, { k: 'verdict', at: 21_500, side: 1, how: 'fall' }] });
  assert.deepEqual(R.told, [[EX.hour, 1]], 'the bookmaker settles by what the relay decided');
  const n0 = fighterIdentity(EX.seed, 0, EX.opponents[0].mobile).name, n1 = fighterIdentity(EX.seed, 1, EX.opponents[1].mobile).name;
  assert.ok(R.said.includes(ARENA_TEXT.verdict.fall(n1, n0)), 'the Herald\'s verdict');
  R.D.frame(0.016, { playerFeet: R.c });
  assert.equal(R.huds.at(-1).bark, ARENA_TEXT.purse.won(100), 'the purse said for the crowd');
  R.D.exhibitionWord({ k: 'ev', e: [{ k: 'heal', at: 23_000 }, { k: 'done', at: 25_000 }] });
  R.D.frame(0.016, { playerFeet: R.c });
  R.step(LEAVE_AFTER_MS + 10);
  R.D.frame(0.016, { playerFeet: R.c });
  assert.equal(R.removed.length, 2, 'the fighters off the sand');
  R.step(CROWD_STAYS_MS);
  R.D.frame(0.016, { playerFeet: R.c });
  assert.equal(R.D.relay(), null, 'the city\'s bout let go');
  assert.deepEqual(verdictOfWord(exSt('done', { res: { side: 0, how: 'yield' } })), { side: 0 });
  assert.deepEqual(verdictOfWord({ k: 'ev', e: [{ k: 'end', at: 1, side: null, how: 'judges' }] }), { side: null });
  assert.equal(verdictOfWord({ k: 'ev', e: [{ k: 'hit', at: 1 }] }), null);
});

/** A fake presence-less link (the hall's kind): it joins one room, opens there, says what it sends. */
function fakeLink(sent) {
  return { status: 'open', room: null, onArena: null, join(r) { this.room = r; }, leave() { this.status = 'closed'; this.room = null; }, sendArena(w) { sent.push([this.room, w]); return true; } };
}

test('ARENA4b the city\'s socket: online the hour\'s bout is the relay\'s room watched from a socket of its own - one `in` from the stands, its words the bout\'s; its end kept, not stood again; a room with no bout lets the sand go; walked off, the socket goes (mutants: the `in` a fighter\'s; the hour stood again after its end; the socket kept after the sand went)', () => {
  const sent = [], links = [], asked = [], dismissed = [];
  let relay = null;
  const bouts = { ask: (p) => { asked.push(p); relay = { o: p.relayEx.o, me: '', kind: 'ex' }; }, relay: () => relay, dismiss: () => { dismissed.push(1); relay = null; }, exhibitionWord: (w) => { bouts.words.push(w); return true; }, words: [], holds: () => false };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  let t = 0;
  const A = createArenaOnline({ now: () => t, session: () => session, makeHall: () => { const l = fakeLink(sent); links.push(l); return l; }, bouts, names, account: { board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true });
  assert.equal(A.exhibitions(), true);
  assert.equal(A.watchCity(EX), true);
  assert.equal(links[0].room, arenaExhibitionRoom(EX.hour), 'the hour\'s room');
  assert.equal(asked[0].where, 'city');
  assert.equal(asked[0].relayEx.ex, EX);
  assert.equal(asked[0].relayEx.o, O);
  assert.equal(A.watchCity(EX), true, 'asked again each frame: the one socket');
  assert.equal(links.length, 1);
  A.tick(); A.tick();
  assert.deepEqual(sent, [[arenaExhibitionRoom(EX.hour), { k: 'in', r: 's' }]], 'one `in`, from the stands');
  links[0].onArena(exSt('call'), arenaExhibitionRoom(EX.hour));
  assert.equal(bouts.words[0].k, 'st', 'its words the bout\'s');
  links[0].onArena({ k: 'ev', e: [{ k: 'verdict', at: 9, side: 1, how: 'fall' }] }, arenaExhibitionRoom(EX.hour));
  assert.deepEqual(A.exhibitionVerdict(EX.hour, NOON + 70), { side: 1 }, 'the relay\'s verdict kept for the book');
  relay = null; A.tick();
  assert.equal(links[0].status, 'closed', 'the sand went: its socket goes');
  assert.equal(A.watchCity(EX), false, 'an hour whose end was heard is not stood again');
  // a room with no bout (nobody watched it while it might begin): the sand let go, the house's record for the book
  const EX2 = exhibitionFor(NOON + 60 + 30);
  assert.equal(A.watchCity(EX2), true);
  links[1].onArena({ k: 'no', m: 'no bout' }, arenaExhibitionRoom(EX2.hour));
  assert.equal(dismissed.length, 1, 'the mirror let go');
  assert.equal(links[1].status, 'closed');
  assert.deepEqual(A.exhibitionVerdict(EX2.hour, NOON + 200), { house: true });
  assert.equal(A.watchCity(EX2), false);
});

test('ARENA4b the verdict asked: a wager\'s hour this screen did not see to its end is asked of its room (a finished bout answers its whole state), one ask at a time, its answer settling the book as it comes, let go when the stands take its room; past the kept day it is the house\'s (mutants: never asked; the asked verdict dropped; the answer left for the next visit; the ask kept beside the stands; the kept day ignored)', () => {
  const sent = [], links = [];
  let heard = 0;
  const bouts = { ask() {}, relay: () => null, dismiss() {}, exhibitionWord: () => true, holds: () => false };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  let t = 0;
  const A = createArenaOnline({ now: () => t, session: () => session, makeHall: () => { const l = fakeLink(sent); links.push(l); return l; }, bouts, names, account: { board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true, verdictHeard: () => { heard++; } });
  assert.equal(A.exhibitionVerdict(EX.hour, NOON + 61), null, 'not known yet');
  assert.equal(links[0].room, arenaExhibitionRoom(EX.hour), 'asked of its room');
  assert.equal(A.exhibitionVerdict(EX.hour, NOON + 61), null);
  assert.equal(links.length, 1, 'one ask at a time');
  A.tick();
  assert.deepEqual(sent.at(-1), [arenaExhibitionRoom(EX.hour), { k: 'in', r: 's' }]);
  links[0].onArena(exSt('fight'), arenaExhibitionRoom(EX.hour));
  assert.equal(heard, 0, 'a bout still on says no verdict');
  links[0].onArena(exSt('done', { res: { side: 0, how: 'yield' } }), arenaExhibitionRoom(EX.hour));
  assert.equal(links[0].status, 'closed', 'answered, let go');
  assert.equal(heard, 1, 'the host told: the book settles now, not at the next visit');
  assert.deepEqual(A.exhibitionVerdict(EX.hour, NOON + 61), { side: 0 });
  assert.deepEqual(A.exhibitionVerdict(EX.hour - 30, NOON + 61), { house: true }, 'past the kept day the relay has let it go');
  assert.equal(links.length, 1, 'nothing asked for it');
  void EXHIBITION_KEPT_HOURS;
  // an hour still being asked of its room, watched from the window's list: the ask let go before the stands take its
  // room - one id twice in a room is replaced at the relay, a seat lost
  const EXP = exhibitionFor(NOON - 60 + 2);
  t = 100_000;
  assert.equal(A.exhibitionVerdict(EXP.hour, NOON + 61), null);
  assert.equal(links[1].room, arenaExhibitionRoom(EXP.hour));
  A.watchExhibition(EXP);
  assert.equal(links[1].status, 'closed', 'the ask let go for the stands');
});

test('ARENA4b the Herald\'s Watch and the window\'s list: the hour\'s exhibition on the hall\'s list named off its hour (the Red\'s against the Blue\'s, titled the hour\'s); Watch takes the floor\'s instance as its room and says one `in` from the stands; the stands strike nobody (mutants: the exhibition entered as a bout\'s room; a watcher\'s blow sent)', async () => {
  const hallSent = [], boutSent = [], entered = [], asked = [];
  const hallLink = { status: 'open', join() {}, leave() {}, sendArena: (w) => { hallSent.push(w); return true; } };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { boutSent.push(w); return true; } };
  const bouts = { ask: (p) => asked.push(p), relay: () => null, dismiss() {}, exhibitionWord: () => true, relayWord: () => true, holds: () => false };
  const A = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => hallLink, bouts, names, account: { board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: (k, o) => { entered.push([k, o]); return true; } });
  A.model();
  hallLink.onArena({ k: 'live', l: [{ o: O, kind: 'ex', h: EX.hour, tier: EX.tier, sp: 4, at: 1 }] });
  const e = A.hall().live[0];
  assert.deepEqual([e.a.n, e.a.b, e.b.n, e.b.b], [fighterIdentity(EX.seed, 0, EX.opponents[0].mobile).name, 'red', fighterIdentity(EX.seed, 1, EX.opponents[1].mobile).name, 'blue']);
  const card = onlineCards({ hall: A.hall(), me: null }).find((c) => c.kind === 'players');
  assert.equal(card.live[0].title, ARENA_TEXT.online.liveExhibition(ARENA_TEXT.tiers[EX.tier]));
  assert.deepEqual(A.act('spectate', { o: O }), { ok: true, text: '' });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(entered.at(-1), ['watch', `x${EX.hour}`], 'the floor\'s instance entered as the hour\'s room');
  assert.equal(asked.at(-1).where, 'floor');
  assert.equal(asked.at(-1).relayEx.o, O);
  A.tick();
  assert.equal(boutSent.length, 0, 'nothing before I stand in its room');
  session.room = arenaExhibitionRoom(EX.hour);
  A.tick(); A.tick();
  assert.deepEqual(boutSent, [{ k: 'in', r: 's' }]);
  assert.equal(A.hit({ i: 'a0', d: 9, kind: 'melee', q: 4 }), false, 'the stands strike nobody');
  assert.deepEqual(boutSent, [{ k: 'in', r: 's' }]);
  A.word({ k: 'st', ...exSt('done', { res: { side: 1, how: 'fall' } }) }, arenaExhibitionRoom(EX.hour));
  assert.deepEqual(A.exhibitionVerdict(EX.hour, NOON + 61), { side: 1 }, 'its verdict kept from the stands too');
});

test('ARENA4b the bookmaker online: a wager settled by the relay\'s verdict, never the house\'s seeded record while the relay holds one; the house\'s only for an hour the relay ran no bout in; an hour unanswered waits (mutants: the house\'s record online; the relay\'s verdict ignored)', () => {
  const gm0 = NOON + 2;
  let gm = gm0;
  const answers = new Map();
  const asked = [];
  const online = { live: () => true, exhibitions: () => true, exhibitionVerdict: (h) => { asked.push(h); return answers.get(h) ?? null; }, model: () => null };
  const P = { goldPieces: 1000, items: [], arenaLeague: null };
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: () => {}, liveHour: () => null, begun: () => false, online: () => online, openWindow: null });
  const house = BK.houseOutcome(EX);
  const side = house === 0 ? 1 : 0;   // the side the house's record would NOT give
  assert.equal(gate.wager(EX.hour, side, 100).ok, true);
  gate.settle();
  assert.equal(P.arenaLeague.book.wagers[0].status, 'open', 'inside its hour nothing is asked');
  assert.deepEqual(asked, []);
  gm = gm0 + 60;
  gate.settle();
  assert.deepEqual(asked, [EX.hour], 'its hour out: the relay asked');
  assert.equal(P.arenaLeague.book.wagers[0].status, 'open', 'unanswered, it waits - the house\'s record is not the online verdict');
  answers.set(EX.hour, { side });
  gate.settle();
  assert.equal(P.arenaLeague.book.wagers[0].status, 'won', 'the relay\'s verdict settles it');
  // an hour the relay ran no bout in: the house's record
  const EX3 = exhibitionFor(gm0 + 120);
  gm = gm0 + 120;
  assert.equal(gate.wager(EX3.hour, 0, 50).ok, true);
  gm = gm0 + 180;
  answers.set(EX3.hour, { house: true });
  gate.settle();
  const w3 = P.arenaLeague.book.wagers[0];
  const h3 = BK.houseOutcome(EX3);
  assert.equal(w3.status, h3 === null ? 'draw' : h3 === 0 ? 'won' : 'lost', 'by the house\'s seeded record');
  // offline the ARENA3 law stands: the house's record once the hour is out
  const Q = { goldPieces: 1000, items: [], arenaLeague: null };
  let gq = gm0;
  const g2 = createArenaGate({ playerEntity: Q, gameMinutes: () => gq, showOverlay: () => {}, liveHour: () => null, begun: () => false, openWindow: null });
  g2.wager(EX.hour, side, 100);
  gq = gm0 + 60;
  g2.settle();
  assert.equal(Q.arenaLeague.book.wagers[0].status, house === null ? 'draw' : 'lost', 'offline, the house\'s record');
});

test('ARENA4b the hosts\' wiring: online the city\'s schedule is the relay\'s room (offline the seeded bout, once an hour), the Herald\'s Watch the relay\'s room, the floor\'s instance in the exhibition\'s room, the book shut by the hour standing, the mirror\'s bodies `placed`, an asked verdict settling the book (by source) (mutants: the city\'s bout this screen\'s own online; the Watch this screen\'s own online; the bodies streamed; the asked verdict unwired)', () => {
  const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(W, /if \(arenaOnline\?\.exhibitions\?\.\(\)\) arenaOnline\.watchCity\(ex\);\n\s+else if \(ex\?\.open && ex\.hour !== _arenaHourRun\) \{ _arenaHourRun = ex\.hour; arenaBouts\.ask\(\{ where: 'city', kind: 'exhibition', ex \}\); \}/);
  assert.match(W, /if \(arenaOnline\?\.exhibitions\?\.\(\)\) \{ arenaBouts\.dismiss\(\); arenaOnline\.watchExhibition\(ex\); return; \}/);
  assert.match(W, /key = arenaFloorRoomOf\(modes\?\.roomIdentity\?\.\(\)\?\.o\);/);
  assert.match(W, /return arenaBouts\.hour\(\) != null && !!b && !\['call', 'walk', 'count'\]\.includes\(b\.phase\);/);
  assert.match(W, /champion: null, \.\.\.\(o\.mirror \? \{ placed: true \} : \{\}\) \}\)/);
  assert.match(W, /exhibitionVerdict: \(hour, side\) => arenaGate\.verdictSeen\(hour, side\)/, 'the mirror\'s verdict reaches the book through the bout\'s own door');
  assert.match(W, /verdictHeard: \(\) => arenaGate\.settle\(\),/, 'and a verdict asked of its room settles it as it comes');
  const E = readFileSync(new URL('../src/scenes/exterior.js', import.meta.url), 'utf8');
  assert.match(E, /if \(ex\?\.open && ex\.hour !== _arenaHourRun\) \{ _arenaHourRun = ex\.hour; arenaBouts\.ask\(\{ where: 'city', kind: 'exhibition', ex \}\); \}/, 'the offline host: its own seeded bout');
  assert.ok(!E.includes('watchCity'), 'the offline host holds no session');
});
