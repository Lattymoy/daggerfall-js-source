// ARENA3 (2026-10-02, Mac: "Joining a team comes with it's own enhanced UI where you can view your ranking and even player
// leaderboards"; "All UI elements and text must be enhanced UI plus"): THE ARENA WINDOW (systems/arenaBoard.js the model,
// ui/arenaWindow.js the window, ui/arenaDoor.js its door, scenes/arenaGate.js its presses). Pinned here: every page's
// model - Bouts (the hour's exhibition or the next, the Red's against the Blue's with records and prices, Watch and
// Wager and why not; the players' bouts said online; the ladder's next with Fight and why not; what the bookmaker owes),
// Ladder (ten tiers, cleared, here, ahead, the next marked, the purses and titles), Team (unjoined: both banners and
// where to join; joined: the season's split, the laurel, my points, the roster's top ten with me pinned), Leaderboards
// (the highest tier, the fastest Grand Champion, the season's rating said online, the banners by season), Records (the
// stats, the last twenty, the wagers), Rules (plain and short); the window driven on a fake page - six tabs a pad turns,
// a page a key, the wager's three presses, a refused press said and dead, Close; the door; the gate's presses at the
// gate only; the Herald's and the pause window's doors; the kit's roles and the sheets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as AB from '../src/systems/arenaBoard.js';
import * as LG from '../src/systems/arenaLeague.js';
import * as BK from '../src/systems/arenaBook.js';
import { newArenaLadder, ladderAfter, exhibitionFor, LADDER_TIERS, BOUT_PURSE, CHAMPION_PURSE } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { heraldChoice } from '../src/systems/arenaHerald.js';
import { withDom } from './invdrag.mjs';
import { mountArenaWindow, arenaSkinCss } from '../src/ui/arenaWindow.js';
import { createArenaOverlay } from '../src/ui/arenaDoor.js';
import { createArenaGate, nearArenaGate, AT_GATE_M } from '../src/scenes/arenaGate.js';
import { FRAME_ROLES } from '../src/ui/enhancedFrame.js';
import { ARENA_WINDOW_CSS } from '../src/ui/enhancedPlusStyle.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const START = 523530;
const noon = (d = 1) => START - (START % MINUTES_PER_DAY) + d * MINUTES_PER_DAY + 12 * 60;
const W = ARENA_TEXT.window;
const grandLadderOf = () => ({ ...newArenaLadder(), grand: true, tier: 9, won: 3, champs: Array(10).fill(true) });
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
/** A ladder `n` bouts up the mountain, all won. */
function climbed(n) {
  let L = newArenaLadder();
  for (let i = 0; i < n; i++) L = ladderAfter(L, { won: true, purse: 50 }).ladder;
  return L;
}

test('ARENA3 window model: the header and the Bouts page - the exhibition\'s fighters, records and prices; the presses and why not', () => {
  const gm = noon(10);
  const o = { ladder: newArenaLadder(), league: LG.joinBanner(LG.newArenaLeague(), 'red', gm).league, gameMinutes: gm, name: 'Aldric', atGate: true, gold: 300 };
  const h = AB.arenaHeader(o);
  assert.deepEqual([h.name, h.title, h.banner, h.laurel, h.record], ['Aldric', null, 'red', false, '0 won, 0 lost']);
  assert.equal(h.season, W.seasonLine(405, LG.seasonDayOf(gm)));
  const b = AB.boutsPage(o);
  assert.deepEqual(b.cards.map((c) => c.kind), ['exhibition', 'players', 'ladder']);
  const ex = b.cards[0];
  const real = exhibitionFor(gm);
  assert.equal(ex.hour, real.hour, 'the hour\'s own bout');
  assert.equal(ex.state, W.openNow);
  assert.deepEqual(ex.fighters.map((f) => f.banner), ['red', 'blue'], 'the Red\'s against the Blue\'s');
  for (const f of ex.fighters) {
    assert.ok(f.name && f.billing && f.kind, JSON.stringify(f));
    assert.match(f.record, /^\d+-\d+$/);
    assert.ok(/^(evens|\d+ to \d+)$/.test(f.odds), f.odds);
  }
  assert.equal(ex.fighters.filter((f) => f.favourite).length, 1);
  assert.deepEqual(ex.acts.map((a) => [a.act, a.why]), [['watch', null], ['wager', null]]);
  assert.deepEqual(ex.stakes, [10, 25, 50, 100, 250]);
  const away = AB.boutsPage({ ...o, atGate: false });
  assert.deepEqual(away.cards[0].acts.map((a) => a.why), [W.whyGate, W.whyGate], 'only at the gate');
  assert.equal(away.cards[2].acts[0].why, W.whyGate);
  assert.equal(AB.boutsPage({ ...o, healthShare: 0.2 }).cards[2].acts[0].why, W.whyHurt);
  assert.equal(AB.boutsPage({ ...o, begun: true, liveHour: real.hour }).cards[0].acts[1].why, ARENA_TEXT.book.whyClosed, 'the book shuts at the word');
  // past the hour's twenty minutes: the next exhibition, not yet watchable
  const later = AB.boutsPage({ ...o, gameMinutes: gm + 30 });
  assert.equal(later.cards[0].hour, real.hour + 1);
  assert.equal(later.cards[0].acts[0].why, W.whyNotYet('13:00'));
  assert.equal(later.cards[0].state, W.opensAt('13:00'));
  // at night, tomorrow's first
  assert.equal(AB.boutsPage({ ...o, gameMinutes: gm + 11 * 60 }).cards[0].title, W.exhibitionTitle('08:00'));
  // the ladder's next, said; the players' bouts online
  assert.equal(b.cards[2].title, W.ladderTitle('The Pit', 'bout 1 of 3'));
  assert.equal(b.cards[2].opponents, 'Thief, level 1');
  assert.equal(b.cards[2].purse, BOUT_PURSE[0]);
  assert.deepEqual(b.cards[1].lines, [W.playersLine]);
  const g = { ...newArenaLadder(), grand: true, tier: 9, won: 3, champs: Array(10).fill(true) };
  assert.equal(AB.boutsPage({ ...o, ladder: g }).cards[2].title, W.ladderDoneTitle);
  // what the bookmaker owes
  const owing = { ...o.league, book: { ...BK.newArenaBook(), owed: 120 } };
  assert.equal(AB.boutsPage({ ...o, league: owing }).owed, 120);
  assert.equal(AB.opponentLine([{ mobile: 145, level: 17 }, { mobile: 132, level: 17 }]), 'Knight, level 17 and Healer, level 17');
});

test('ARENA3 window model: the Ladder - ten tiers, cleared, here and ahead, the next marked, each tier\'s purses and title', () => {
  const m = AB.ladderPage({ ladder: climbed(5) });   // tier 1's three and its champion, and tier 2's first
  assert.equal(m.tiers.length, 10);
  assert.deepEqual(m.tiers.slice(0, 3).map((t) => t.state), ['cleared', 'current', 'locked']);
  assert.equal(m.current, 1);
  assert.deepEqual(m.tiers[1].bouts.map((x) => [x.won, x.next]), [[true, false], [false, true], [false, false]]);
  assert.equal(m.tiers[0].champion.beaten, true);
  assert.equal(m.tiers[1].won, 1);
  assert.deepEqual([m.tiers[3].purse, m.tiers[3].champPurse, m.tiers[3].title], [BOUT_PURSE[3], CHAMPION_PURSE[3], 'Gladiator']);
  assert.equal(m.tiers[5].beasts, true);
  assert.equal(m.tiers[9].free, true);
  assert.equal(m.tiers[9].champion.label, ARENA_TEXT.grandLabel);
  assert.deepEqual(m.titles, ['Pit Fighter']);
  assert.deepEqual(m.next, { tier: 'Bloodied', label: 'bout 2 of 3', purse: BOUT_PURSE[1], opponents: 'Monk, level 4' });
  const champ = AB.ladderPage({ ladder: climbed(3) });
  assert.equal(champ.tiers[0].champion.next, true, 'three won - the champion next');
  const g = AB.ladderPage({ ladder: { ...newArenaLadder(), grand: true, tier: 9, won: 3, champs: Array(10).fill(true) } });
  assert.ok(g.tiers.every((t) => t.state === 'cleared'));
  assert.equal(g.next, null);
});

test('ARENA3 window model: the Team page - unjoined both banners and where to join; joined the split, the laurel, my points, the top ten', () => {
  const gm = noon(60);
  const free = AB.teamPage({ ladder: newArenaLadder(), league: LG.newArenaLeague(), gameMinutes: gm, name: 'Aldric' });
  assert.equal(free.joined, null);
  assert.deepEqual(free.banners.map((b) => b.banner), ['red', 'blue']);
  assert.ok(free.lines.includes(ARENA_TEXT.teams.none) && free.lines.includes(W.joinWhere));
  assert.ok(free.banners.every((b) => b.rows.length === 10 && !b.pinned && b.fighters === 24));
  let L = LG.joinBanner(LG.newArenaLeague(), 'blue', gm).league;
  L = LG.leagueAfterBout(L, { gameMinutes: gm, tier: 0, opp: 'Bran', won: true, how: 'fall', purse: 50 });
  const me = AB.teamPage({ ladder: climbed(1), league: L, gameMinutes: gm, name: 'Aldric' });
  assert.equal(me.joined, 'blue');
  assert.equal(me.given, 1);
  assert.equal(me.boutsFor, 1);
  const blue = me.banners.find((b) => b.banner === 'blue');
  assert.equal(blue.fighters, 25, 'the roster and me');
  assert.ok(blue.pinned?.you, 'one point puts me under the top ten - pinned');
  assert.ok(blue.pinned.rank > AB.BOARD_TOP, 'its true rank');
  assert.ok(blue.rows.every((r, i, a) => i === 0 || a[i - 1].points >= r.points), 'by points');
  const st = LG.leagueStandings(L, gm);
  assert.deepEqual([me.standings.red, me.standings.blue], [st.red, st.blue]);
  assert.ok(Math.abs(me.standings.redShare - st.red / (st.red + st.blue)) < 0.001);
  assert.ok(me.lines.includes(ARENA_TEXT.teams.under('the Blue Banner')));
  // a big contribution climbs the roster
  const big = { ...L, points: { red: 0, blue: 500 } };
  const top = AB.teamPage({ ladder: climbed(1), league: big, gameMinutes: gm, name: 'Aldric' }).banners.find((b) => b.banner === 'blue');
  assert.equal(top.rows[0].you, true);
  assert.equal(top.pinned, null);
  // the laurel
  const laurel = { ...L, laurel: { banner: 'blue', season: 405 } };
  const lp = AB.teamPage({ ladder: climbed(1), league: laurel, gameMinutes: gm, name: 'Aldric' });
  assert.equal(lp.laurel, 'blue');
  assert.equal(lp.laurelYou, true);
  assert.ok(lp.banners.find((b) => b.banner === 'blue').laurel);
});

test('ARENA3 window model: the Leaderboards - the highest tier with me pinned, the fastest Grand Champion, the rating online, the banners', () => {
  const gm = noon(300);
  const L = LG.joinBanner(LG.newArenaLeague(), 'red', gm).league;
  const m = AB.boardsPage({ ladder: climbed(1), league: L, gameMinutes: gm, name: 'Aldric' });
  assert.deepEqual(AB.ARENA_BOARDS, ['pve', 'fast', 'pvp', 'team']);
  assert.equal(m.pve.rows.length, AB.BOARD_TOP);
  assert.ok(m.pve.pinned?.you, 'one bout won - I am under the top ten, pinned');
  assert.equal(m.pve.total, 49);
  assert.deepEqual(m.pve.cols, W.cols.pve);
  assert.equal(m.pve.rows[0].rank, 1);
  // a Grand Champion stands at the head of the PvE board
  const G = { ...L, firstBoutAt: gm - 40 * MINUTES_PER_DAY, grandAt: gm };
  const g = AB.boardsPage({ ladder: { ...newArenaLadder(), grand: true, tier: 9, won: 3, champs: Array(10).fill(true), record: { ...newArenaLadder().record, wins: 40, losses: 3 } }, league: G, gameMinutes: gm, name: 'Aldric' });
  const gc = g.pve.rows.find((r) => r.you);
  assert.ok(gc && gc.rank <= 3, 'among the first');
  assert.equal(gc.cells[0], 'Grand Champion');
  assert.ok(g.fast.rows.some((r) => r.you && r.cells[0] === W.days(40)), 'forty days to the title');
  assert.ok(g.fast.rows.every((r, i, a) => i === 0 || Number(a[i - 1].cells[0].split(' ')[0]) <= Number(r.cells[0].split(' ')[0])), 'the fastest first');
  // over many seasons the fastest board fills, the fastest first
  const old = { ...G, season: 405, since: 405 };
  const later = gm + 4 * 360 * MINUTES_PER_DAY;
  const many = AB.boardsPage({ ladder: grandLadderOf(), league: old, gameMinutes: later, name: 'Aldric' }).fast.rows;
  assert.ok(many.length >= 2, `${many.length} on the board`);
  const days = many.map((r) => Number(r.cells[0].split(' ')[0]));
  assert.deepEqual(days, [...days].sort((x, y) => x - y), 'the fastest first');
  // the rating: online
  assert.deepEqual([m.pvp.rows.length, m.pvp.empty], [0, W.boards.pvpNone]);
  // the banners: this season, then the closed ones
  const rolled = LG.rollLeague(L, gm + 500 * MINUTES_PER_DAY);
  const t = AB.boardsPage({ ladder: climbed(1), league: rolled, gameMinutes: gm + 500 * MINUTES_PER_DAY, name: 'Aldric' }).team;
  assert.deepEqual(t.rows.map((r) => r.name), ['3E 407', '3E 406', '3E 405']);
  assert.equal(t.rows[2].cells[3], 'Red', 'the side I fought on');
});

test('ARENA3 window model: the Records - the stats, the last twenty, the wagers; the Rules plain and short', () => {
  const gm = noon(20);
  let L = LG.newArenaLeague();
  L = LG.leagueAfterBout(L, { gameMinutes: gm, tier: 0, label: 'bout 1 of 3', opp: 'Bran the Quick', won: true, how: 'yield', purse: 61 });
  L = LG.leagueAfterBout(L, { gameMinutes: gm + 60, tier: 0, label: 'bout 2 of 3', opp: 'Cyr', won: false, how: 'fall' });
  let lad = ladderAfter(newArenaLadder(), { won: true, purse: 61 }).ladder;
  lad = ladderAfter(lad, { won: false, how: 'fall' }).ladder;
  const m = AB.recordsPage({ ladder: lad, league: L, gameMinutes: gm + 61 });
  const stat = Object.fromEntries(m.stats.map((s) => [s.k, s.v]));
  assert.deepEqual([stat[W.stat.wins], stat[W.stat.losses], stat[W.stat.share], stat[W.stat.falls], stat[W.stat.purses]], ['1', '1', '50%', '1', '61 gold']);
  assert.equal(m.bouts.length, 2);
  assert.deepEqual([m.bouts[0].opp, m.bouts[0].result, m.bouts[0].how], ['Cyr', W.lostWord, W.how.fall], 'newest first');
  assert.deepEqual([m.bouts[1].result, m.bouts[1].how, m.bouts[1].purse], [W.wonWord, W.how.yield, 61]);
  assert.match(m.bouts[0].when, /^\d+ [A-Za-z' ]+, 3E 405$/);
  assert.equal(AB.arenaDate(START), '4 Morning Star, 3E 405', 'a new game\'s day');
  assert.equal(AB.recordsPage({ ladder: newArenaLadder(), league: null, gameMinutes: gm }).empty, W.noBouts);
  const rules = AB.rulesPage();
  assert.deepEqual(rules.map((r) => r.head), ['The bouts', 'The ladder', 'The banners', 'Purses and the crowd', 'Exhibitions and wagers']);
  for (const r of rules) for (const l of r.lines) { assert.ok(l.length <= 90, l); assert.ok(!/[—–]/.test(l)); }
  const all = AB.arenaBoard({ ladder: lad, league: L, gameMinutes: gm, name: 'A' });
  assert.deepEqual(Object.keys(all), ['header', 'bouts', 'ladder', 'team', 'boards', 'records', 'rules']);
  assert.deepEqual(AB.ARENA_PAGES, ['bouts', 'ladder', 'team', 'boards', 'records', 'rules'], 'the design\'s six, in its order');
});

test('ARENA3 the window on a page: six tabs the pad turns, a page a key, the wager\'s presses, a refused press dead, Close', () => withDom((dom) => {
  const gm = noon(200);
  const P = { name: 'Aldric', arenaLadder: climbed(4), arenaLeague: LG.joinBanner(LG.newArenaLeague(), 'red', gm).league };
  let atGate = true;
  const acts = [];
  let exits = 0;
  const board = () => AB.arenaBoard({ ladder: P.arenaLadder, league: P.arenaLeague, gameMinutes: gm, name: P.name, atGate, gold: 500 });
  const host = dom.mk('div');
  dom.body.append(host);
  const v = mountArenaWindow(host, { board, act: (k, d) => { acts.push([k, d]); return { ok: true, text: 'Taken.' }; }, onExit: () => exits++ });
  const shell = one(host, 'aw-shell');
  assert.equal(shell.attrs.role, 'dialog');
  assert.equal(shell.attrs['aria-label'], W.title);
  const tabs = kids(shell, 'aw-tab');
  assert.deepEqual(tabs.map((t) => t.textContent), ['Bouts', 'Ladder', 'Team', 'Leaderboards', 'Records', 'Rules']);
  assert.ok(tabs.every((t) => t.attrs.role === 'tab'), 'the pad turns them');
  assert.equal(one(shell, 'aw-tabs').attrs.role, 'tablist');
  assert.deepEqual(tabs.map((t) => t.attrs['aria-selected']), ['true', 'false', 'false', 'false', 'false', 'false']);
  assert.equal(one(shell, 'aw-name').textContent, 'Aldric');
  assert.ok(textOf(one(shell, 'aw-id')).includes('Pit Fighter'), 'the title on my card');
  assert.ok(textOf(one(shell, 'aw-id')).includes('The Red Banner'));
  // Bouts: the exhibition's two fighters, the Wager's three presses
  const vs = kids(shell, 'aw-fighter');
  assert.deepEqual(vs.map((f) => f.dataset.banner), ['red', 'blue']);
  const wagerBtn = kids(shell, 'aw-act').find((b) => b.dataset.act === 'wager');
  wagerBtn.onclick();
  const sides = kids(shell, 'aw-side'), stakes = kids(shell, 'aw-stake');
  assert.equal(sides.length, 2);
  assert.deepEqual(stakes.map((s) => s.textContent), ['10 gold', '25 gold', '50 gold', '100 gold', '250 gold', '500 gold']);
  assert.equal(one(shell, 'aw-place').attrs.disabled, '', 'nothing to place yet');
  sides[1].onclick();
  kids(shell, 'aw-stake')[2].onclick();
  one(shell, 'aw-place').onclick();
  assert.deepEqual(acts, [['wager', { hour: exhibitionFor(gm).hour, side: 1, stake: 50 }]]);
  assert.equal(one(shell, 'aw-note').textContent, 'Taken.', 'the host\'s word in the status line');
  // Fight - the host's
  kids(shell, 'aw-act').find((b) => b.dataset.act === 'fight').onclick();
  assert.deepEqual(acts.at(-1), ['fight', { hour: undefined }]);
  // away from the gate: refused, said, and dead
  atGate = false;
  v.repaint();
  const dead = kids(shell, 'aw-act').find((b) => b.dataset.act === 'watch');
  assert.equal(dead.attrs.disabled, '');
  assert.equal(dead.attrs.title, W.whyGate);
  assert.ok(kids(shell, 'aw-why').some((n) => n.textContent === W.whyGate), 'the reason under it');
  const n = acts.length;
  dead.onclick();
  assert.equal(acts.length, n, 'pressed, nothing');
  // a page a key; the arrows on a tab
  const key = (code, extra = {}) => dom.win.fire('keydown', { code, key: code, preventDefault() {}, stopPropagation() {}, target: { getAttribute: () => null }, ...extra });
  key('Digit2');
  assert.equal(v.page(), 'ladder');
  assert.equal(kids(shell, 'aw-tier').length, 10);
  assert.ok(kids(shell, 'aw-tier')[1].classList.contains('on'), 'my tier picked');
  kids(shell, 'aw-tier')[6].onclick();
  assert.ok(textOf(one(shell, 'aw-tiercard')).includes('Hero'), 'a tier opened whole');
  key('ArrowRight', { key: 'ArrowRight', target: { getAttribute: (k) => (k === 'role' ? 'tab' : null) } });
  assert.equal(v.page(), 'team');
  assert.ok(one(shell, 'aw-split'), 'the season on one bar');
  assert.ok(one(shell, 'aw-table'), 'the roster');
  tabs[3].onclick();
  assert.equal(v.page(), 'boards');
  assert.deepEqual(kids(shell, 'aw-subtab').map((b) => b.dataset.board), ['pve', 'fast', 'pvp', 'team']);
  assert.ok(kids(shell, 'aw-row').some((r) => r.classList.contains('you')), 'my row, pinned');
  assert.ok(one(shell, 'aw-gap'), 'under the top ten');
  kids(shell, 'aw-subtab')[2].onclick();
  assert.equal(one(shell, 'aw-empty').textContent, W.boards.pvpNone);
  key('Digit5');
  assert.ok(kids(shell, 'aw-stat').length >= 10);
  key('Digit6');
  assert.equal(kids(shell, 'aw-rule').length, 5);
  // the words are set as text: a name with markup in it stays words
  P.name = '<b>Aldric</b>';
  v.repaint();
  assert.equal(one(shell, 'aw-name').textContent, '<b>Aldric</b>');
  // Escape, and Close
  key('Escape', { key: 'Escape' });
  assert.equal(exits, 1);
  one(shell, 'aw-close').onclick();
  assert.equal(exits, 2);
  v.unmount();
  assert.equal(dom.win.count('keydown'), 0, 'its key listener gone with it');
}));

test('ARENA3 the door, the gate\'s presses at the gate only, the Herald\'s and the pause window\'s doors', () => {
  assert.equal(createArenaOverlay({ board: () => null }), null, 'no document, no window');
  assert.equal(AT_GATE_M, 60);
  assert.equal(nearArenaGate([0, 0, 0], [30, 0, 40]), true);
  assert.equal(nearArenaGate([0, 0, 0], [50, 0, 40]), false);
  assert.equal(nearArenaGate([0, 0, 0], null), false, 'no gate here');
  const gm = noon(14);
  const P = { name: 'Aldric', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: null, goldPieces: 400, items: [] };
  let atGate = false;
  const herald = [];
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: () => {}, heraldAct: (a) => herald.push(a), atGate: () => atGate });
  const m = gate.board();
  assert.equal(m.header.name, 'Aldric');
  assert.equal(m.bouts.cards[0].acts[0].why, W.whyGate);
  assert.deepEqual(gate.windowAct('watch'), { ok: false, text: W.whyGate });
  assert.deepEqual(gate.windowAct('wager', { hour: exhibitionFor(gm).hour, side: 0, stake: 50 }), { ok: false, text: W.whyGate });
  atGate = true;
  assert.deepEqual(gate.windowAct('watch'), { ok: true, text: '' });
  assert.deepEqual(herald, ['watch'], 'the Herald\'s own door');
  P.health = 20;
  assert.deepEqual(gate.windowAct('fight'), { ok: false, text: W.whyHurt });
  P.health = 100;
  gate.windowAct('fight');
  assert.deepEqual(herald, ['watch', 'fight']);
  const w = gate.windowAct('wager', { hour: exhibitionFor(gm).hour, side: 0, stake: 50 });
  assert.equal(w.ok, true);
  assert.equal(P.goldPieces, 350);
  assert.equal(gate.windowOverlay('team'), null, 'the overlay needs a page');
  // the Herald's choice carries the window; the hosts answer it
  const ch = heraldChoice({ gameMinutes: gm, ladder: newArenaLadder() });
  assert.equal(ch.options.find((o) => o.act === 'window').label, ARENA_TEXT.herald.window);
  assert.ok(!heraldChoice({ gameMinutes: gm, ladder: newArenaLadder(), window: false }).options.some((o) => o.act === 'window'));
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const S = rd(f);
    assert.match(S, /else if \(a === 'window'\) arenaGate\.openWindow\('bouts'\);/, f);
    assert.match(S, /heraldAct: \(a\) => arenaHeraldAct\(a\), atGate: \(\) => \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && nearArenaGate\(player\.pos, arenaHeraldAt\(\)\),/, f);
    // ARENA4b: the banner worn is the gate's word (scenes/arenaGate.js joined - the save's league offline, the account's online)
    assert.match(S, /openArena: \(\) => arenaGate\.openWindow\('team'\), arenaJoined: \(\) => arenaGate\.joined\(\),/, `${f}: the pause window's door`);
    assert.match(S, /makeArenaWindow: \(page\) => arenaGate\.windowOverlay\(page\),/, f);
  }
  assert.match(rd('src/scenes/worldModes.js'), /openArena: \(\) => mountedInterior\(host\.makeArenaWindow\?\.\('team'\) \?\? null\), arenaJoined: \(\) => !!host\.arenaJoined\?\.\(\),/);
  assert.match(rd('src/scenes/worldModes.js'), /makeArenaWindow: \(page\) => host\.makeArenaWindow\?\.\(page\) \?\? null, arenaJoined: \(\) => !!host\.arenaJoined\?\.\(\),/, 'the dungeon is handed it');
  assert.match(rd('src/scenes/dungeonContext.js'), /openArena: opts\.makeArenaWindow \? \(\) => \{ const w = opts\.makeArenaWindow\('team'\); if \(w\) activeOverlay = w; return !!w; \} : undefined,/);
  assert.match(rd('src/ui/enhancedMenu.js'), /\['Arena', hooks\.arenaJoined\?\.\(\) \? hooks\.openArena : undefined\],/, 'the Stats page\'s door, once joined');
  assert.match(rd('src/ui/charSheetDoor.js'), /openArena: door\('openArena'\)/, 'and the F5 page\'s');
});

test('ARENA3 the window\'s dress: the kit\'s roles, the Plus sheet, the classic skin\'s own sheet, the pixel face, a phone', () => {
  for (const [role, sel] of [['window', 'body .aw-win'], ['panel', 'body .aw-card'], ['button', 'body .aw-shell .act'], ['primary', 'body .aw-shell .act.primary'], ['header', 'body .aw-head'], ['chip', 'body .aw-chip'], ['listRow', 'body .aw-tier']]) {
    assert.ok(FRAME_ROLES[role].includes(sel), `${role}: ${sel}`);
  }
  assert.match(rd('src/ui/enhancedPlusStyle.js'), /\$\{PROF_CSS\}\n\$\{ARENA_WINDOW_CSS\}\n/, 'the Plus sheet carries it');
  assert.match(ARENA_WINDOW_CSS, /\.aw-shell \{[^}]*font-family: [^;]*Pixelify/, 'the pixel face');
  assert.match(ARENA_WINDOW_CSS, /@media \(max-width: 720px\)/, 'a phone\'s layout');
  assert.match(ARENA_WINDOW_CSS, /\.aw-table \.opt \{ display: none; \}/, 'a phone drops the board\'s optional columns');
  assert.match(ARENA_WINDOW_CSS, /@media \(pointer: coarse\)/);
  assert.match(ARENA_WINDOW_CSS, /\.aw-pennant\[data-banner="red"\]/);
  assert.match(ARENA_WINDOW_CSS, /\.aw-pennant\[data-banner="blue"\]/);
  const classic = arenaSkinCss();
  assert.ok(classic.includes(ARENA_WINDOW_CSS));
  assert.match(classic, /body \.aw-win/, 'the kit cut to its selectors');
  assert.ok(!/\.notice-win/.test(classic.replace(ARENA_WINDOW_CSS, '')), 'and only its own');
});
