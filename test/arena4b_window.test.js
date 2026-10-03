// ARENA4b (2026-10-03): THE ARENA WINDOW ONLINE, DRIVEN - the Records page from the account's record and its last bouts
// (systems/arenaBoard.js recordsPageOnline over the board's `me.record` / `me.recent`, tolerant of an older service), the
// header with no purses chip unless the board says one, the fastest Grand Champions each in their own season, the realm's
// Hall of Champions under them (hallBoardOnline) and the Keeper's wall online (hallLinesOnline), and the window drawing all
// of it on a fake page (ui/arenaWindow.js). Mac, 2026-10-02: "Joining a team comes with it's own enhanced UI where you can
// view your ranking and even player leaderboards".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as AB from '../src/systems/arenaBoard.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { arenaLadderOf, arenaSeasonOf, arenaSeasonDay, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../src/net/arenaLaw.js';
import { newArenaLadder, ladderAfter, LADDER_TIERS } from '../src/systems/arenaLadder.js';
import * as LG from '../src/systems/arenaLeague.js';
import * as BK from '../src/systems/arenaBook.js';
import { exhibitionFor } from '../src/systems/arenaLadder.js';
import { withDom } from './invdrag.mjs';
import { mountArenaWindow } from '../src/ui/arenaWindow.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const O = ARENA_TEXT.online, W = ARENA_TEXT.window, U = ARENA_TEXT.undercroft;
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
/** A unix second in season `n`, day `d`. */
const atS = (n, d = 1) => ARENA_SEASON_EPOCH_S + (n - 1) * ARENA_SEASON_S + (d - 1) * 86400 + 3600;
const gm = 523530 - (523530 % MINUTES_PER_DAY) + 40 * MINUTES_PER_DAY + 12 * 60;
/** The service's board, as server-account/src/arena.js arenaBoardOf answers it - ARENA4b's `me.record` and `me.recent`
 *  (another stream's) on it. */
function boardOf(me = {}) {
  return {
    season: 4, day: 12, endsAt: 0, champion: null,
    pvp: { rows: [], pinned: null, total: 0 }, pve: { rows: [], pinned: null, total: 0 },
    fast: { rows: [{ rank: 1, name: 'Ivo', days: 9, at: atS(2, 30) }, { rank: 2, name: 'Ceryn', days: 21, at: atS(4, 3) }, { rank: 3, name: 'Old', days: 40 }], pinned: null, total: 3 },
    team: { standings: { red: 3, blue: 5 }, last: { season: 3, red: 9, blue: 4, winner: 'red' }, laurel: 'red', members: { red: 1, blue: 1 }, rosters: { red: { rows: [], pinned: null, total: 0 }, blue: { rows: [], pinned: null, total: 0 } } },
    hall: [{ name: 'Ceryn', at: atS(4, 3), title: null, glyphs: [] }, { name: 'Ivo', at: atS(2, 30), title: null, glyphs: [] }],
    me: { ladder: arenaLadderOf(Array.from({ length: 6 }, (_, k) => ({ tier: Math.floor(k / 4), bout: k % 4 })), { wins: 6, losses: 2, best: 4 }), pvp: { rating: 1016, wins: 1, losses: 0, draws: 0, bouts: 1 }, rank: 3, banner: 'red', points: 7, grand: false, champion: false, ...me },
  };
}
const recent = [
  { at: atS(4, 12), kind: 'pvp', won: true, how: 'fall', rating: { before: 1000, after: 1016 }, rated: true, opponent: { name: 'Brann', title: null, glyphs: [] }, points: 2 },
  { at: atS(4, 11), kind: 'pve', tier: 1, step: 3, won: true, how: 'yield', points: 3 },
  { at: atS(4, 11), kind: 'pve', tier: 1, step: 1, won: false, how: 'judges', points: 0 },
  { at: atS(4, 10), kind: 'pvp', won: null, how: 'draw', rated: false, opponent: { name: 'Gwyn' }, points: 0 },
  { at: atS(4, 9), kind: 'pvp', won: true, how: 'forfeit', rating: { before: 990, after: 1000 }, opponent: { name: 'Hal' }, points: 2 },
  { at: atS(3, 50), kind: 'pve', tier: 9, step: 3, won: false, how: 'fall', points: 0 },
];

test('ARENA4b the Records page online: the account\'s record (ladder and rated wins, losses and draws, the share, the best streak, the season\'s rating, the champions beaten) and its last bouts - a ladder bout by tier and step with the house\'s fighters it met, a rated bout by its opponent and the rating it moved, a draw, a forfeit, each dated in the realm\'s season; the save\'s wagers kept; an older board\'s record from the climb and the season, its missing bouts said; the save\'s own record never (mutants: the save\'s record online; a draw read as a loss; the season of a bout this season\'s; the champion\'s label a bout\'s)', () => {
  const save = { ladder: ladderAfter(newArenaLadder(), { won: true, purse: 50 }).ladder, league: LG.newArenaLeague(), gameMinutes: gm, name: 'Alva' };
  const m = AB.arenaBoard({ ...save, online: { board: boardOf({ record: { pveWins: 31, pveLosses: 5, pvpWins: 12, pvpLosses: 7, pvpDraws: 2, best: 9 }, recent }), hall: { status: 'open', queue: 'idle', live: [] } } });
  const R = m.records;
  const stat = Object.fromEntries(R.stats.map((s) => [s.k, s.v]));
  assert.deepEqual([stat[O.stat.pveWins], stat[O.stat.pveLosses], stat[O.stat.pvpWins], stat[O.stat.pvpLosses], stat[O.stat.pvpDraws]], ['31', '5', '12', '7', '2'], 'the account\'s, not the save\'s one win');
  assert.equal(stat[W.stat.share], `${Math.round((43 / 55) * 100)}%`);
  assert.equal(stat[W.stat.best], '9');
  assert.equal(stat[O.stat.rating], '1016');
  assert.equal(stat[W.stat.champions], '1', 'the Pit\'s champion beaten on the account\'s climb');
  assert.equal(R.online, O.recordsOnline);
  assert.equal(R.bouts.length, 6);
  const [pvp, champ, lost, draw, forfeit, grand] = R.bouts;
  assert.deepEqual([pvp.opp, pvp.tier, pvp.label, pvp.result, pvp.how, pvp.points], ['Brann', O.livePlayers, O.ratingMove(1016, 16), W.wonWord, W.how.fall, 2]);
  assert.equal(pvp.when, O.boutWhen(4, 12));
  assert.deepEqual([champ.tier, champ.label, champ.opp, champ.result], [ARENA_TEXT.tiers[1], ARENA_TEXT.champLabel, AB.opponentLine(LADDER_TIERS[1].champion), W.wonWord]);
  assert.deepEqual([lost.label, lost.opp, lost.won, lost.draw, lost.how], [ARENA_TEXT.boutLabel(2), AB.opponentLine(LADDER_TIERS[1].bouts[1]), false, false, W.how.judges]);
  assert.deepEqual([draw.result, draw.draw, draw.won, draw.label, draw.how], [W.drew, true, false, O.unratedShort, W.how.draw], 'a draw is a draw, unrated said');
  assert.equal(forfeit.how, O.how.forfeit);
  assert.deepEqual([grand.label, grand.when], [ARENA_TEXT.grandLabel, O.boutWhen(3, 50)], 'the Grand Champion\'s bout, in the season it was fought');
  assert.equal(R.empty, '');
  assert.deepEqual(R.wagers, BK.bookLines(LG.rollLeague(save.league, gm), gm), 'the bookmaker\'s book is this screen\'s');
  // an older service: no record, no recent - the climb's record and the season's rating, the bouts said missing
  const old = AB.recordsPageOnline(boardOf(), { league: null, gameMinutes: gm });
  const st2 = Object.fromEntries(old.stats.map((s) => [s.k, s.v]));
  assert.deepEqual([st2[O.stat.pveWins], st2[O.stat.pveLosses], st2[O.stat.pvpWins], st2[W.stat.best]], ['6', '2', '1', '4']);
  assert.deepEqual([old.bouts, old.empty], [[], O.noRecent]);
  assert.equal(AB.recordsPageOnline(boardOf({ recent: [] }), {}).empty, O.noBouts);
  assert.ok(AB.recordsPageOnline(boardOf({ champion: true, recent: [] }), {}).titles.includes(O.championTitle));
  assert.equal(AB.recordsPageOnline(boardOf({ recent: [null, 'x', { kind: 'pve', tier: 99, step: -4, won: true }] }), {}).bouts.length, 1, 'junk rows dropped, a broken one read safely');
  assert.equal(arenaSeasonDay(atS(4, 12)), 12);
});

test('ARENA4b the header online carries no purses chip unless the board says one; the fastest Grand Champions each in the season they took it (an older row this season\'s); the realm\'s Hall, the newest first with its seasons, my name marked when it is mine; the Keeper\'s wall online - my own names by the account\'s climb, "not yet" beside the realm\'s, each with its season (mutants: purses 0 shown; every row this season\'s; the realm\'s names dropped from the wall; my row unmarked; my row by the character\'s name)', () => {
  const b = boardOf();
  const h = AB.arenaHeaderOnline({ board: b, name: 'Alva' });
  assert.equal(h.purses, null, 'the realm keeps no purse - no chip');
  assert.equal(AB.arenaHeaderOnline({ board: boardOf({ purses: 640 }), name: 'Alva' }).purses, 640, 'unless the board says one');
  assert.equal(AB.arenaHeaderOnline({ board: boardOf({ record: { purses: 75 } }), name: 'Alva' }).purses, 75);
  const B = AB.boardsPageOnline(b, 'Alva');
  assert.deepEqual(B.fast.rows.map((r) => r.cells[1]), [O.seasonShort(2), O.seasonShort(4), O.seasonShort(4)], 'each row its own season; a row with no `at` this season\'s');
  assert.equal(arenaSeasonOf(atS(2, 30)), 2);
  assert.deepEqual(B.hall.rows.map((r) => [r.name, r.season, r.you]), [['Ceryn', O.seasonShort(4), false], ['Ivo', O.seasonShort(2), false]]);
  assert.deepEqual([B.hall.title, B.hall.sub, B.hall.empty], [U.hallTitle, O.hallTheirs, '']);
  assert.equal(AB.hallBoardOnline(boardOf({ grand: true }), 'Ceryn').rows[0].you, true, 'mine, when I am one of them');
  assert.equal(AB.hallBoardOnline(boardOf(), 'Ceryn').rows[0].you, false, 'a namesake who is no Grand Champion is not me');
  // the realm names me by my account (the fastest board's `you` row), not by this save's character
  const asRealm = { ...boardOf({ grand: true }), fast: { rows: [{ rank: 1, name: 'Ceryn', days: 21, at: atS(4, 3), you: true }], pinned: null, total: 1 } };
  assert.deepEqual(AB.hallBoardOnline(asRealm, 'Alva').rows.map((r) => r.you), [true, false], 'my row by the realm\'s name for me');
  assert.deepEqual(AB.hallBoardOnline({ ...asRealm, fast: { rows: [], pinned: { rank: 9, name: 'Ivo', days: 80, you: true }, total: 9 } }, 'Ceryn').rows.map((r) => r.you), [false, true], 'pinned under the top ten too');
  assert.equal(AB.hallBoardOnline({ ...b, hall: [] }, 'Alva').empty, U.hallNone);
  // the Keeper: my tier's champion beaten (the account's climb), "not yet" beside the realm's
  const lines = AB.hallLinesOnline(b, 'Alva');
  assert.deepEqual(lines.slice(0, 4), [U.hallTitle, '', U.hallIntro, '']);
  assert.ok(lines.includes(U.hallTier(U.hallTierName(1, ARENA_TEXT.tiers[0]), ARENA_TEXT.titles[0], 'Alva')), 'my Pit champion, cut by the account\'s climb');
  assert.ok(lines.includes(O.hallTheirs));
  assert.deepEqual(lines.slice(-2), [O.hallTheirAt('Ceryn', 4), O.hallTheirAt('Ivo', 2)], 'the realm\'s, the newest first, each its season');
  const fresh = AB.hallLinesOnline(boardOf({ ladder: arenaLadderOf([]) }), 'Alva');
  assert.ok(fresh.includes(U.hallNotYou) && !fresh.includes(U.hallNone), 'not yet - beside theirs');
  assert.ok(AB.hallLinesOnline({ ...b, hall: [], me: { ladder: arenaLadderOf([]) } }, 'Alva').includes(U.hallNone), 'an empty wall');
  assert.ok(AB.hallLinesOnline(boardOf({ ladder: arenaLadderOf(Array.from({ length: 40 }, (_, k) => ({ tier: Math.floor(k / 4), bout: k % 4 }))) }), 'Alva').includes(U.hallGrand('Alva')), 'the account\'s Grand Champion');
});

test('ARENA4b the window online on a page: the Records page says it is the account\'s and draws its record and bouts (a rated bout\'s rating in its line), no purses chip in the header; the fastest Grand Champion board with the realm\'s Hall under it; offline the purses chip in the header and no Hall (mutants: the Hall card not drawn; the purse chip at 0; the online note missing)', () => withDom((dom) => {
  const host = dom.mk('div');
  dom.body.append(host);
  const save = { ladder: ladderAfter(newArenaLadder(), { won: true, purse: 50 }).ladder, league: LG.newArenaLeague(), gameMinutes: gm, name: 'Alva', atGate: true, gold: 0 };
  const online = { board: boardOf({ record: { pveWins: 31, pveLosses: 5, pvpWins: 12, pvpLosses: 7, pvpDraws: 2, best: 9 }, recent }), hall: { status: 'open', queue: 'idle', live: [] } };
  const v = mountArenaWindow(host, { board: () => AB.arenaBoard({ ...save, online }), page: 'records' });
  const shell = one(host, 'aw-shell');
  assert.equal(one(shell, 'aw-purse'), null, 'no purses chip online');
  const body = one(shell, 'aw-body');
  assert.ok(textOf(body).includes(O.recordsOnline));
  const rows = kids(body, 'aw-bout');
  assert.equal(rows.length, 6);
  assert.equal(one(rows[0], 'aw-bt').textContent, `${O.livePlayers} - ${O.ratingMove(1016, 16)}, ${W.how.fall}`);
  assert.equal(one(rows[0], 'aw-bd').textContent, O.boutWhen(4, 12));
  assert.ok(rows[3].className.includes('draw'));
  // the leaderboards: the fastest board, the Hall under it
  [...kids(shell, 'aw-tab')].find((t) => t.dataset.page === 'boards').onclick();
  assert.equal(one(shell, 'aw-hall'), null, 'the Hall stands under the fastest board alone');
  kids(shell, 'aw-subtab').find((t) => t.dataset.board === 'fast').onclick();
  const hall = one(shell, 'aw-hall');
  assert.ok(hall, 'the realm\'s Hall');
  assert.deepEqual(kids(hall, 'aw-n').map((n) => n.textContent), ['Ceryn', 'Ivo']);
  assert.deepEqual(kids(hall, 'aw-pts').map((n) => n.textContent), [O.seasonShort(4), O.seasonShort(2)]);
  assert.deepEqual(kids(shell, 'aw-table')[0] && kids(kids(shell, 'aw-table')[0], 'aw-row').map((r) => r.children.at(-1).textContent), [O.seasonShort(2), O.seasonShort(4), O.seasonShort(4)]);
  v.unmount();
  // offline: the save's purses in the header, no Hall
  const host2 = dom.mk('div');
  dom.body.append(host2);
  const v2 = mountArenaWindow(host2, { board: () => AB.arenaBoard(save), page: 'boards' });
  assert.equal(one(host2, 'aw-purse').textContent, W.gold(50), 'the save\'s purse');
  kids(host2, 'aw-subtab').find((t) => t.dataset.board === 'fast').onclick();
  assert.equal(one(host2, 'aw-hall'), null);
  v2.unmount();
  const zero = AB.arenaBoard({ ...save, ladder: newArenaLadder() });
  const host3 = dom.mk('div');
  dom.body.append(host3);
  const v3 = mountArenaWindow(host3, { board: () => zero });
  assert.equal(one(host3, 'aw-purse'), null, 'never a 0');
  v3.unmount();
  void exhibitionFor;
}));

test('ARENA4b online before the board is in: the window\'s ladder card waits for the account\'s climb - its Fight refused with the line, never the save\'s climb fought; the Records page not the save\'s either, the realm\'s said on its way, no purses chip (mutants: Fight offered on the save\'s climb online; the save\'s record before the board)', () => {
  const save = { ladder: newArenaLadder(), league: LG.newArenaLeague(), gameMinutes: gm, name: 'Alva', atGate: true };
  const m = AB.arenaBoard({ ...save, online: { board: null, hall: { status: 'open', queue: 'idle', live: [] } } });
  const card = m.bouts.cards.find((c) => c.kind === 'ladder');
  assert.equal(card.acts.find((a) => a.act === 'fight').why, O.climbWait);
  // nor is the record the save's: the realm's on its way, the save's wagers kept, no purses chip
  const played = { ...save, ladder: ladderAfter(newArenaLadder(), { won: true, how: 'fall', purse: 50 }).ladder };
  assert.ok(AB.arenaBoard(played).records.stats.length > 0 && AB.arenaBoard(played).header.purses === 50, 'offline: the save\'s record and purses');
  const wait = AB.arenaBoard({ ...played, online: { board: null, hall: { status: 'open', queue: 'idle', live: [] } } });
  assert.deepEqual([wait.records.stats, wait.records.bouts, wait.records.online, wait.records.empty, wait.header.purses], [[], [], O.recordsOnline, O.noRecent, null]);
  assert.deepEqual(wait.records.wagers, AB.arenaBoard(played).records.wagers);
  assert.equal(AB.arenaBoard(save).bouts.cards.find((c) => c.kind === 'ladder').acts[0].why, null, 'offline the save\'s climb, as ever');
});
