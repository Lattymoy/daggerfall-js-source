// ARENA-WAIT (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord: "I reloaded my game near the
// arena, and I saw that there was the option to fight from the Arena master guy (I've done all 40 fights already for this
// season), so I hit fight, and it reset my rank, and when I look at the season it doesn't have a number"). On the online
// lane, before the relay has said whether its arena is open - no session yet, or one no welcome has answered - every
// arena door read `live()` false as OFFLINE: the Herald offered Fight off the save's ladder (the online climb never
// writes it), the bout was this screen's and paid its purse here, and the window drew the save's season ("Season of 3E
// 406"), title and record. Now the arena WAITS, as it does for the board. Over the real OnlineSession's welcome, the real
// arena online and the real gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { OnlineSession } from '../../../src/net/online.js';
import { createArenaOnline } from '../../../src/scenes/arena/arenaOnline.js';
import { createArenaGate } from '../../../src/scenes/arena/arenaGate.js';
import { ARENA_TEXT } from '../../../src/systems/arena/arenaText.js';
import { arenaSeasonOf, arenaSeasonDay, arenaLadderOf } from '../../../src/net/arena/arenaLaw.js';
import { ARENA_RELAY_MIN } from '../../../src/net/wire.js';
import { exhibitionFor } from '../../../src/systems/arena/arenaLadder.js';
import * as BK from '../../../src/systems/arena/arenaBook.js';
import { fighterIdentity } from '../../../src/systems/arena/arenaFighters.js';
import { SEAT_NOTICE } from '../../../src/net/oneSeat.js';
import { CLOSE_POLICY } from '../../../src/net/wire.js';
import { newArenaLadder, ladderAfter, LADDER_TIERS, ladderTitles, arenaLadderSnapshot } from '../../../src/systems/arena/arenaLadder.js';
import { mountArenaWindow } from '../../../src/ui/arena/arenaWindow.js';
import { withDom } from '../../invdrag.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const O = ARENA_TEXT.online;
const NOON = 600 * 1440 + 12 * 60;
const NOW_S = 1_792_000_000;   // a wall clock well inside the realm's seasons
const names = (seed) => (i, mob) => fighterIdentity(seed, i, mob);
const bouts = () => ({ ask() { this.asked = (this.asked ?? 0) + 1; }, relay: () => null, dismiss() {}, exhibitionWord: () => true, relayWord: () => true, holds: () => false, setRealm() {} });
/** The account's board: a Grand Champion's climb, 40 won. */
const grandBoard = () => {
  const L = { ...arenaLadderOf([]), grand: true };
  return { season: arenaSeasonOf(NOW_S), day: arenaSeasonDay(NOW_S), me: { ladder: L, grand: true, banner: null }, team: { standings: { red: 0, blue: 0 }, rosters: {}, members: {}, laurel: null }, pve: { rows: [], pinned: null, total: 0 }, pvp: { rows: [], pinned: null, total: 0 }, fast: { rows: [], pinned: null, total: 0 }, hall: [] };
};
function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

test('ARENA-WAIT: on the online lane before the relay\'s word, the Herald offers no Fight, Fight is refused at every door, the window draws the realm\'s season and nothing of the save\'s, no wager settles by the house - then the welcome makes it the account\'s', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  /** @type {any} */
  let session = null;   // world.js: the session starts once the player stands in the world
  let boardAsked = 0;
  const said = [];
  const B = bouts();
  const A = createArenaOnline({ now: () => 0, nowS: () => NOW_S, session: () => session, lane: () => true, bouts: B, names, say: (l) => said.push(l),
    makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }),
    account: { board: async () => { boardAsked++; return { ok: true, data: grandBoard() }; }, claim: async () => ({ ok: true, data: {} }), me: () => 'acct-spartank', team: async () => ({ ok: true }) },
    enterFloor: () => true });
  let gm = NOON + 2;
  // the save's own ladder: what an offline climb last left (the online climb never writes it) - a fresh Pit
  const P = { goldPieces: 1000, items: [], arenaLeague: null, arenaLadder: null, health: 100, maxHealth: 100, name: 'spartank' };
  const fought = [];
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay() {}, liveHour: () => null, begun: () => false, online: () => A, openWindow: null,
    atGate: () => true, heraldAct: (a) => fought.push(a) });

  for (const phase of ['no session', 'not welcomed']) {
    if (phase === 'not welcomed') {
      session = new OnlineSession({ url: 'wss://relay.test', name: 'spartank', id: 'spar-0001', secret: 'secret-of-spar-0001', WebSocketImpl: FakeWS, now: () => 1000 });
      session.join('world:0:0', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
      sockets[0].open();
      assert.equal(session.status, 'open', 'the socket open, no welcome yet');
      assert.deepEqual([session.arenaOk, session.arenaHeard], [false, false], 'the session minted: nothing said');
    }
    assert.deepEqual([A.live(), A.waiting()], [false, true], `${phase}: neither online nor offline - waiting`);
    const ch = gate.heraldChoice({ cityBout: null, healthShare: 1, league: null });
    assert.ok(!ch.options.some((o) => o.act === 'fight'), `${phase}: no Fight off the save's ladder`);
    assert.ok(ch.lines.includes(O.climbWait), `${phase}: the Herald says the climb is on its way`);
    assert.deepEqual(gate.windowAct('fight'), { ok: false, text: O.climbWait }, `${phase}: the window's Fight waits`);
    assert.deepEqual(fought, [], 'no bout');
    assert.deepEqual(A.fightLadder(), { ok: false, text: O.climbWait }, `${phase}: the host's Fight (world.js arenaHeraldAct) waits`);
    assert.deepEqual(A.act('queue'), { ok: false, text: O.hallWait }, `${phase}: a challenge waits, never "Online only"`);
    assert.equal(A.watchExhibition(exhibitionFor(gm)), false, `${phase}: the hour's bout is the relay's, waited for`);
    assert.equal(said.at(-1), O.hallWait);
    assert.equal(await A.team('red'), null, `${phase}: a banner is the account's, waited for`);
    assert.equal(said.at(-1), O.climbWait, 'said, never a silent press');
    const m = gate.board();
    assert.equal(m.header.season, O.seasonLine(arenaSeasonOf(NOW_S), arenaSeasonDay(NOW_S)), `${phase}: the realm's season, numbered (never "Season of 3E 406")`);
    assert.match(m.header.season, /^Season \d+, day \d+ of 56$/);
    assert.deepEqual([m.header.title, m.header.record, m.header.banner, m.header.purses ?? null], [null, '', null, null], `${phase}: no title, record or banner of the save's`);
    assert.deepEqual(m.team.lines, [O.rollWait], 'the banners on their way');
    for (const k of ['pve', 'fast', 'pvp', 'team']) assert.deepEqual([m.boards[k].rows, m.boards[k].pinned, m.boards[k].empty], [[], null, O.rollWait], `${phase}: the ${k} board - nobody of the save's roster`);
    assert.equal(m.boards.pvp.champion, undefined);
    assert.equal(m.ladder.next, null, 'no next bout offered');
    assert.equal(m.ladder.online, O.climbWait);
    assert.ok(m.bouts.cards.find((c) => c.kind === 'ladder').acts.find((a) => a.act === 'fight').why, 'the ladder card\'s Fight shut');
  }
  assert.equal(boardAsked, 0, 'nothing asked of the service before the relay\'s word');

  // a wager placed while waiting, its hour out: never settled by the house's seeded record
  const EX = exhibitionFor(gm);
  const house = BK.houseOutcome(EX);
  assert.equal(gate.wager(EX.hour, house === 0 ? 1 : 0, 100).ok, true);
  gm = NOON + 70;
  gate.settle();
  assert.equal(P.arenaLeague.book.wagers[0].status, 'open', 'the wager waits for the relay\'s verdict');

  // THE WELCOME: a relay with the arena's rooms - online, the account's climb
  sockets[0].receive({ t: 'welcome', id: 'spar-0001', peers: [], host: 'spar-0001', now: Date.now(), v: `world${ARENA_RELAY_MIN}` });
  assert.deepEqual([session.arenaOk, session.arenaHeard], [true, true]);
  assert.deepEqual([A.live(), A.waiting()], [true, false]);
  await A.fetchBoard();
  const ch = gate.heraldChoice({ cityBout: null, healthShare: 1, league: null });
  assert.ok(!ch.options.some((o) => o.act === 'fight'), 'the Grand Champion: nobody left to beat');
  assert.deepEqual(A.fightLadder(), { ok: false, text: ARENA_TEXT.herald.ladderDone });
  assert.equal(P.arenaLadder, null, 'the save\'s ladder never touched');
});

test('ARENA-WAIT: what is not waiting - off the online lane the save\'s arena as ever (Fight offered); a relay that said no (an older one) is the lane\'s ONE offline (a seat given up is shut - AUDIT A4, the next test); and the host wires the lane, its three doors through the online arm', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let session = null;
  let lane = false;
  const A = createArenaOnline({ now: () => 0, session: () => session, lane: () => lane, bouts: bouts(), names, account: { board: async () => ({ ok: false }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true });
  const P = { goldPieces: 1000, items: [], arenaLeague: null, arenaLadder: null, health: 100, maxHealth: 100, name: 'Alva' };
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => NOON + 2, showOverlay() {}, liveHour: () => null, begun: () => false, online: () => A, openWindow: null, atGate: () => true, heraldAct() {} });
  assert.equal(A.waiting(), false, 'an offline character waits for nothing');
  assert.ok(gate.heraldChoice({ cityBout: null, healthShare: 1, league: null }).options.some((o) => o.act === 'fight'), 'offline: the save\'s ladder, Fight offered');
  assert.match(gate.board().header.season, /^Season of 3E \d+, day \d+ of 360$/, 'offline: the save\'s season');
  lane = true;
  session = new OnlineSession({ url: 'wss://relay.test', name: 'Alva', id: 'alva-0001', secret: 'secret-of-alva-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  session.join('world:0:0', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
  sockets[0].open();
  assert.equal(A.waiting(), true);
  sockets[0].receive({ t: 'welcome', id: 'alva-0001', peers: [], host: 'alva-0001', now: Date.now(), v: `world${ARENA_RELAY_MIN - 1}` });
  assert.deepEqual([session.arenaOk, session.arenaHeard, A.live(), A.waiting()], [false, true, false, false], 'a relay without the arena said so: offline');
  assert.ok(gate.heraldChoice({ cityBout: null, healthShare: 1, league: null }).options.some((o) => o.act === 'fight'));
  // PIN MOVED (ARENA-WAIT AUDIT A4): a seat given up was offline here (O9) - the save's ladder, its purses paid into the
  // realm's save; on the online lane its doors are shut now, in the seat's own words (the next test)
  session = { arenaOk: false, arenaHeard: false, superseded: true, terminal: true };
  assert.deepEqual([A.waiting(), A.shutText(O.climbWait)], [true, SEAT_NOTICE], 'a seat given up is shut, never offline');
  // world.js: the lane and the clock handed in; Fight, the city's sand and the Herald's Watch take the online arm while waiting
  const w = rd('src/scenes/world.js');
  assert.match(w, /session: \(\) => online, lane: \(\) => onlineOn, nowS: \(\) => relayNowS\(\) \?\? Date\.now\(\) \/ 1000,/);
  assert.match(w, /if \(arenaOnline\?\.live\(\) \|\| arenaOnline\?\.waiting\(\)\) \{ const r = arenaOnline\.fightLadder\(\);/);
  assert.match(w, /if \(arenaOnline\?\.exhibitions\?\.\(\) \|\| arenaOnline\?\.waiting\?\.\(\)\) arenaOnline\.watchCity\(ex\);/);
  assert.match(w, /if \(arenaOnline\?\.exhibitions\?\.\(\) \|\| arenaOnline\?\.waiting\?\.\(\)\) \{ arenaBouts\.dismiss\(\); arenaOnline\.watchExhibition\(ex\); return; \}/);
});

// ═══ AUDIT (2026-10-16) ═══════════════════════════════════════════════════════════════════════════════════════════════
const W = ARENA_TEXT.window;
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
/** The reporter's save: the offline climb's last word - the Pit cleared (Pit Fighter), Bloodied begun ("Tier 2, Bloodied"). */
const reporterLadder = () => { let L = newArenaLadder(); for (let i = 0; i < 5; i++) L = ladderAfter(L, { won: true, purse: 50 }).ladder; return arenaLadderSnapshot(L); };
/** The ladder page and its card as nobody's: every tier the law's alone, no climb on them. */
function assertNobodys(m, line, what) {
  assert.deepEqual([m.ladder.current, m.ladder.grand, m.ladder.titles, m.ladder.next, m.ladder.online, m.ladder.waiting], [null, false, [], null, line, true], `${what}: no current tier, no title, no next bout - the line says why`);
  assert.deepEqual(m.ladder.tiers.map((t) => t.name), [...ARENA_TEXT.tiers], `${what}: the ten tiers, the law's`);
  for (const t of m.ladder.tiers) {
    assert.deepEqual([t.state, t.won, t.champion.beaten, t.champion.next], ['waiting', 0, false, false], `${what}: ${t.name} - nobody's`);
    assert.deepEqual(t.bouts.map((b) => [b.won, b.next]), [[false, false], [false, false], [false, false]], `${what}: ${t.name}'s bouts - no pip, no next`);
  }
  assert.deepEqual(m.bouts.cards.find((c) => c.kind === 'ladder'), { key: 'ladder', kind: 'ladder', title: W.ladderBout, state: W.tierState.waiting, fighters: [], acts: [{ act: 'fight', label: W.fight, why: line }], lines: [] }, `${what}: the card names no bout, no opponents, no purse - Fight shut`);
}

test('ARENA-WAIT AUDIT A1: before the account\'s climb is in - the lane waiting, or live with the board still asked - the Ladder page and the Bouts page\'s ladder card are NOBODY\'S: every tier `waiting`, no pip, no champion beaten, no next bout, no title, no current tier, the climb\'s wait said; the card no bout, opponents or purse, its Fight shut - never the save\'s "Tier 2, Bloodied", "Pit Fighter", its next bout and its purse; the window draws that shape and takes up the climb when it comes (mutants: the save\'s ladder page; the save\'s card; a pip, a tier\'s state, a title or the current tier the save\'s; the renderer reading an absent tier; "No titles yet." said)', async () => {
  const P = { goldPieces: 1000, items: [], arenaLeague: null, arenaLadder: reporterLadder(), health: 100, maxHealth: 100, name: 'spartank' };
  let session = null, lane = false, boardIn = null;
  const A = createArenaOnline({ now: () => 0, nowS: () => NOW_S, session: () => session, lane: () => lane, bouts: bouts(), names, say: () => {},
    makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }),
    account: { board: () => new Promise((r) => { boardIn = () => r({ ok: true, data: grandBoard() }); }), claim: async () => ({ ok: true, data: {} }), me: () => 'acct-spartank' }, enterFloor: () => true });
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => NOON + 2, showOverlay() {}, liveHour: () => null, begun: () => false, online: () => A, openWindow: null, atGate: () => true, heraldAct() {} });
  // the fixture is the reporter's save: offline its page is the save's climb
  const off = gate.board();
  assert.deepEqual([off.ladder.current, off.ladder.titles, off.ladder.tiers[0].state, off.ladder.tiers[1].won], [1, ladderTitles(P.arenaLadder), 'cleared', 1], 'offline: Tier 2, Bloodied, one won - Pit Fighter');
  assert.deepEqual(off.ladder.titles, [ARENA_TEXT.titles[0]]);
  const offCard = off.bouts.cards.find((c) => c.kind === 'ladder');
  assert.ok(offCard.opponents && offCard.purse > 0, 'offline: the save\'s next bout and its purse');
  lane = true;
  assertNobodys(gate.board(), O.climbWait, 'the lane waiting, no session');
  session = { arenaOk: true, arenaHeard: true, status: 'open', room: 'world:1,1', sendArena: () => true };
  assert.equal(A.live(), true);
  assertNobodys(gate.board(), O.climbWait, 'live, the board still asked');
  // the window draws it - no tier the climb's, nobody's state, no pip, no titles block - and the climb when it comes
  await new Promise((r) => setTimeout(r, 0));   // the board's ask goes out on a microtask (scenes/arena/arenaOnline.js askBoard)
  let v = null, host = null;
  withDom((dom) => {
    host = dom.mk('div');
    dom.body.append(host);
    v = mountArenaWindow(host, { board: () => gate.board(), page: 'ladder' });
    const rows = kids(host, 'aw-tier');
    assert.equal(rows.length, LADDER_TIERS.length);
    assert.deepEqual(rows.map((r) => r.dataset.state), Array(LADDER_TIERS.length).fill('waiting'));
    assert.deepEqual(kids(host, 'aw-tierstate').map((x) => x.textContent), Array(LADDER_TIERS.length).fill(W.tierState.waiting));
    assert.deepEqual(rows.map((r) => r.getAttribute('aria-pressed')), ['true', ...Array(LADDER_TIERS.length - 1).fill('false')], 'the first tier shown, nobody\'s');
    assert.equal(kids(host, 'aw-pips').flatMap((p) => p.children).filter((i) => /\bon\b/.test(i.className ?? '')).length, 0, 'no pip, no crown');
    assert.equal(one(host, 'aw-titles'), null, 'no titles block - "No titles yet." is a claim about a climb not in');
    assert.ok(!textOf(host).includes(W.noTitles));
    assert.equal(one(host, 'aw-online').textContent, O.climbWait);
  });
  // the board comes in: the climb's own tier taken up (the Grand Champion's last), its titles drawn
  boardIn();
  await new Promise((r) => setTimeout(r, 0));
  withDom(() => {
    v.repaint();
    assert.equal(kids(host, 'aw-tier').findIndex((r) => r.getAttribute('aria-pressed') === 'true'), LADDER_TIERS.length - 1, 'the climb\'s own tier, once it is known');
    assert.ok(one(host, 'aw-titles'), 'and its titles');
    v.unmount();
  });
});

test('ARENA-WAIT AUDIT A3/A4: on the online lane the offline arena runs for ONE word - a relay that said it opens no arena room; a seat given up (O9) and a session no welcome can answer (terminal) SHUT the doors, each saying why - the seat elsewhere in ONE-SEAT\'s words, the server gone - never the save\'s Fight, purse or house-settled book, never "Still loading" for ever (mutants: superseded offline; terminal waiting silently; the seat\'s words unsaid; the server\'s unsaid; the relay\'s no shut; terminal after a no offline)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const said = [];
  /** @type {any} */
  let session = null;
  const A = createArenaOnline({ now: () => 0, nowS: () => NOW_S, session: () => session, lane: () => true, bouts: bouts(), names, say: (l) => said.push(l),
    makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }),
    account: { board: async () => ({ ok: true, data: grandBoard() }), claim: async () => ({ ok: true, data: {} }), me: () => 'acct-spartank', team: async () => ({ ok: true }) }, enterFloor: () => true });
  let gm = NOON + 2;
  const P = { goldPieces: 1000, items: [], arenaLeague: null, arenaLadder: reporterLadder(), health: 100, maxHealth: 100, name: 'spartank' };
  const shown = [];
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: (w) => shown.push(w), liveHour: () => null, begun: () => false, online: () => A, openWindow: null, atGate: () => true, heraldAct() {} });
  const fresh = () => {
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'spartank', id: `spar-000${sockets.length + 1}`, secret: 'secret-of-spar-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    s.join('world:0:0', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
    sockets.at(-1).open();
    return s;
  };
  /** Every door, shut with `line`: the Herald, the window's Fight and challenge, the host's Fight, Watch and banner, the
   *  window's pages and the recruiter. */
  async function shutWith(line, what) {
    assert.deepEqual([A.live(), A.waiting()], [false, true], `${what}: shut`);
    const ch = gate.heraldChoice({ cityBout: null, healthShare: 1, league: null });
    assert.ok(!ch.options.some((o) => o.act === 'fight'), `${what}: the Herald offers no Fight off the save's ladder`);
    assert.ok(ch.lines.includes(line), `${what}: and says why`);
    assert.deepEqual(gate.windowAct('fight'), { ok: false, text: line }, `${what}: the window's Fight`);
    assert.deepEqual(A.fightLadder(), { ok: false, text: line }, `${what}: the host's Fight (world.js arenaHeraldAct)`);
    assert.deepEqual(A.act('queue'), { ok: false, text: line }, `${what}: a challenge`);
    assert.equal(A.watchExhibition(exhibitionFor(gm)), false);
    assert.equal(said.at(-1), line, `${what}: Watch says why`);
    assert.equal(await A.team('red'), null);
    assert.equal(said.at(-1), line, `${what}: a banner says why`);
    const m = gate.board();
    assertNobodys(m, line, what);
    assert.deepEqual([m.team.lines, m.boards.pve.empty, m.records.empty], [[line], line, line], `${what}: every page says why`);
    assert.equal(m.bouts.cards.find((c) => c.kind === 'exhibition').acts.find((a) => a.act === 'watch').why, line, `${what}: the hour's Watch shut on its card`);
    shown.length = 0;
    gate.recruiter('redRecruiter');
    assert.ok(shown.length === 1 && shown[0].lines.includes(line), `${what}: the recruiter says why`);
    gate.hall();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(shown[1]?.lines, [ARENA_TEXT.undercroft.hallTitle, '', line], `${what}: the Keeper says why`);
  }

  // A3: a hello the relay refused for good - terminal, never welcomed ("Still loading" was said for ever)
  session = fresh();
  sockets.at(-1).onclose?.({ code: CLOSE_POLICY, reason: 'policy' });
  assert.deepEqual([session.terminal, session.arenaHeard, session.superseded], [true, false, false]);
  await shutWith(O.noServer, 'terminal');
  // a door joins again (net/online.js join clears `terminal`): the relay's word waited for, said as the wait
  session.join('world:0:1', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
  assert.deepEqual([A.waiting(), A.fightLadder().text], [true, O.climbWait], 'a door joined: the wait\'s own words');

  // A4: a seat given up (world.js leaveSeat: online.supersede()) - it ran the save's ladder and settled the book offline
  session = fresh();
  sockets.at(-1).receive({ t: 'welcome', id: session.id, peers: [], host: session.id, now: Date.now(), v: `world${ARENA_RELAY_MIN}` });
  assert.equal(A.live(), true);
  const EX = exhibitionFor(gm);
  const house = BK.houseOutcome(EX);
  assert.equal(gate.wager(EX.hour, house === 0 ? 1 : 0, 100).ok, true, 'a wager online');
  session.supersede();
  assert.deepEqual([session.superseded, session.arenaOk], [true, true], 'the relay\'s word kept, the seat gone');
  await shutWith(SEAT_NOTICE, 'superseded');
  gm = NOON + 70;
  gate.settle();
  assert.equal(P.arenaLeague.book.wagers[0].status, 'open', 'the book settles nothing by the house\'s record - it waits for the relay\'s verdict');
  gm = NOON + 2;

  // the relay's no - the lane's ONE offline: ARENA3's arena, Fight off the save's ladder
  session = fresh();
  sockets.at(-1).receive({ t: 'welcome', id: session.id, peers: [], host: session.id, now: Date.now(), v: `world${ARENA_RELAY_MIN - 1}` });
  assert.deepEqual([session.arenaHeard, session.arenaOk, A.live(), A.waiting()], [true, false, false, false], 'a relay that said no: offline');
  assert.ok(gate.heraldChoice({ cityBout: null, healthShare: 1, league: null }).options.some((o) => o.act === 'fight'), 'the save\'s Fight');
  // ...but not once terminal, nor with the seat given up
  sockets.at(-1).onclose?.({ code: CLOSE_POLICY, reason: 'policy' });
  assert.equal(session.terminal, true);
  assert.deepEqual([A.waiting(), A.fightLadder().text], [true, O.noServer], 'terminal after the no: shut');
  session.join('world:0:1', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 });
  assert.deepEqual([session.terminal, A.waiting()], [false, false], 'a door joined: the relay\'s no stands - offline');
  session.supersede();
  assert.deepEqual([A.waiting(), A.fightLadder().text], [true, SEAT_NOTICE], 'a seat given up after the no: shut');
  assert.notEqual(O.noServer, O.climbWait);
});
