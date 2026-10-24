// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK) - and AUDIT
// SEASON-BOOK (bible/01-Overview/audits/Audit-Season-Book.md): every finding's fix held here, or in seasonbook_face.test.js
// (the face mounted).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { realmSeasonAt, seatSeasonAt, seatSeasonTitle, seasonBookModel, arenaStanding, spireStanding, ladderStanding, seaStanding,
  SEASON_BOOK_DAYS, SEASON_TITLE_GAMES, SEASON_TITLE_FOES } from '../../../src/systems/seasonBook.js';
import { createSeasonBook, SEASON_BOARD_FRESH_MS, SEASON_BOARDS, boardSeasonOf } from '../../../src/scenes/seasonBookHost.js';
import { seasonMark, seasonWindow, seasonSource, anchorSeason, seasonLeftText, seasonWhenText, SEASON_TICK_MS } from '../../../src/ui/enhanced/enhancedSeason.js';
import { pauseCommandOf, pauseCommandRefusal, HOST_COMMANDS, HELP_LINES, parseChatLine } from '../../../src/net/chatCommands.js';
import { ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_SEASON_S, ARENA_SEASON_EPOCH_S } from '../../../src/net/arena/arenaLaw.js';
import { ILIAC_CHAMPION_MIN_GAMES, ILIAC_CHAMPION_MIN_FOES } from '../../../server-account/src/iliac.js';
import { GAMBIT_CHAMPION_MIN_GAMES, GAMBIT_CHAMPION_MIN_FOES } from '../../../server-account/src/gambit.js';
import { SEASON_ZERO_WEEKS, SEASON_WEEKS } from '../../../src/net/townSeatLaw.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
// Thursday 2026-10-22 12:00 UTC - the season's Season 1, day 25; the seats' Season 0 (zero 2), its third week; the festival open
const NOW = Date.UTC(2026, 9, 22, 12);
const sec = (m, id) => m.sections.find((s) => s.id === id);
const row = (s, id) => s.rows.find((r) => r.id === id);
const ok = (data) => ({ state: 'ok', data });
const tick = () => new Promise((r) => setImmediate(r));

test('SEASON-BOOK the clocks: the season is the arena\'s eight weeks from 28 September 2026; the seats\' Season townSeatLaw\'s off the service\'s zero, Season 0 its four-week beta; each knows its end; AUDIT L10: before the epoch or with no clock the day holds at 1 (mutants: the realm\'s day off by one; the seats\' week counted from zero; Season 0 not a trial; the day wrapping)', () => {
  assert.equal(SEASON_BOOK_DAYS, 56);
  assert.equal(SEASON_BOOK_DAYS * 86_400, ARENA_SEASON_S);
  assert.deepEqual(realmSeasonAt(NOW), { n: 1, day: 25, days: 56, startMs: Date.UTC(2026, 8, 28), endMs: Date.UTC(2026, 10, 23) });
  assert.equal(realmSeasonAt(Date.UTC(2026, 8, 28)).day, 1, 'its first day is day 1');
  assert.deepEqual([realmSeasonAt(Date.UTC(2026, 10, 23)).n, realmSeasonAt(Date.UTC(2026, 10, 23)).day], [2, 1], 'the next starts at the end');
  assert.deepEqual([realmSeasonAt(ARENA_SEASON_EPOCH_S * 1000 - 1).n, realmSeasonAt(ARENA_SEASON_EPOCH_S * 1000 - 1).day], [1, 1], 'L10: a moment before the epoch is day 1, never day 56');
  assert.equal(realmSeasonAt(NaN).day, 1, 'L10: no clock, day 1');
  assert.deepEqual(seatSeasonAt(NOW, 2), { n: 0, week: 3, weeks: SEASON_ZERO_WEEKS, endMs: Date.UTC(2026, 10, 1, 18), trial: true, month: null, numeral: null });
  assert.equal(new Date(seatSeasonAt(NOW, 2).endMs).getUTCDay(), 0, 'a Season ends at a Sunday Turning');
  const one = seatSeasonAt(Date.UTC(2026, 10, 10), 2);
  assert.deepEqual([one.n, one.week, one.weeks, one.trial, one.month, one.numeral], [1, 2, SEASON_WEEKS, false, 0, null]);
  assert.equal(seatSeasonAt(NOW, null), null, 'no Season counted');
  assert.equal(seatSeasonAt(NOW, 2, false), null, 'the seats shut to the account');
  assert.equal(seatSeasonAt(NOW, 99), null, 'before the zero');
});

test('AUDIT SEASON-BOOK W1/U8: the seats\' Season named in the player\'s language - "Season 0", else "Season of {month}" off the months\' own table, its round\'s numeral after it; never townSeatLaw\'s English (mutants: the English name in a translated title; the numeral lost)', () => {
  assert.equal(seatSeasonTitle({ trial: true, month: null, numeral: null }), 'Season 0');
  assert.equal(seatSeasonTitle({ trial: false, month: 0, numeral: null }), 'Season of Morning Star');
  assert.equal(seatSeasonTitle({ trial: false, month: 11, numeral: null }), 'Season of Evening Star');
  // the thirteenth Season: Morning Star's second round
  const s13 = seatSeasonAt(Date.UTC(2026, 9, 4, 18) + (2 + SEASON_ZERO_WEEKS + 12 * SEASON_WEEKS) * 7 * 86_400_000, 2);
  assert.deepEqual([s13.n, s13.month, s13.numeral, seatSeasonTitle(s13)], [13, 0, 'II', 'Season of Morning Star II']);
  const src = read('src/systems/seasonBook.js');
  assert.match(src, /monthNames\(\)\[seat\.month\]/, 'the months\' own localized table (gameDate.js monthNames)');
  assert.doesNotMatch(src, /seat\.name\.replace/, 'no English article stripped off an English name');
});

test('SEASON-BOOK the model: three sections, each its clock; the season\'s five boards, the seats\' Season (Season 0 as the beta it is; a counted Season its own lead), the festival open or coming - every section\'s title, sub-line, lead, countdown word and foot (mutants: the trial crowning; the beta\'s lead on every Season; the seats\' end said as an opening; the festival\'s end for its opening; a shut seat shown)', () => {
  const m = seasonBookModel({ now: NOW, seatsOpen: true, zero: 2, boards: {} });
  assert.deepEqual(m.sections.map((s) => s.id), ['realm', 'seats', 'festival']);
  const realm = sec(m, 'realm');
  assert.deepEqual([realm.title, realm.sub, realm.at, realm.atLabel, realm.lead], ['Season 1', 'Day 25 of 56', Date.UTC(2026, 10, 23), 'ends', 'Every board here starts fresh each season.']);
  assert.deepEqual(realm.rows.map((r) => r.id), ['arena', 'spire', 'iliac', 'gambit', 'sea']);
  assert.deepEqual(realm.rows.map((r) => r.name), ['The Arena', 'The Spire', 'Iliac Hand', 'The King\'s Gambit', 'The season\'s captains']);
  const seats = sec(m, 'seats');
  assert.deepEqual([seats.title, seats.sub, seats.at, seats.atLabel], ['The Seats: Season 0', 'Week 3 of 4', Date.UTC(2026, 10, 1, 18), 'ends']);
  assert.equal(seats.lead, 'Season 0 is the beta. When it ends, the seats\' war is wiped and no one is crowned. Silver, the Stores and your professions stay.');
  assert.deepEqual(seats.rows.map((r) => r.id), ['tides', 'chapters'], 'Season 0 crowns no one: no titles, no ribbon, no soft reset');
  assert.ok(seats.rows.every((r) => r.standing === null && r.door === null));
  assert.equal(seats.foot, 'The Notice Board\'s Seat tab has the week\'s standings.');
  const later = seasonBookModel({ now: Date.UTC(2026, 10, 10), seatsOpen: true, zero: 2, boards: {} });
  const s1 = sec(later, 'seats');
  assert.deepEqual([s1.title, s1.atLabel], ['The Seats: Season of Morning Star', 'ends']);
  assert.equal(s1.lead, 'The guilds\' war for the towns. A Season ends at its last Sunday Turning.', 'P7: a counted Season never told it is the beta');
  assert.deepEqual(s1.rows.map((r) => r.id), ['crowns', 'ribbon', 'reset', 'tides', 'chapters']);
  assert.equal(sec(seasonBookModel({ now: NOW, seatsOpen: false, zero: 2 }), 'seats'), undefined, 'the seats shut: no section');
  assert.equal(sec(seasonBookModel({ now: NOW, seatsOpen: true, zero: null }), 'seats'), undefined, 'no Season counted: no section');
  const fest = sec(m, 'festival');
  assert.deepEqual([fest.title, fest.sub, fest.at, fest.atLabel, fest.lead, fest.foot], ['The Witches\' Festival', 'On now', FESTIVALS[0].toMs, 'ends', null, null]);
  assert.deepEqual(fest.rows.map((r) => r.id), ['cakes', 'starfall']);
  const coming = sec(seasonBookModel({ now: Date.UTC(2026, 9, 1) }), 'festival');
  assert.deepEqual([coming.sub, coming.at, coming.atLabel], ['Coming', FESTIVALS[0].fromMs, 'opens']);
  assert.equal(sec(seasonBookModel({ now: Date.UTC(2026, 10, 9) }), 'festival'), undefined, 'none to come: no section');
});

test('AUDIT SEASON-BOOK L1/L5/L6/L7/L12/W4-W8: every line says what the game does, in the game\'s own words - the champions\' rule names its three titles (never the Spire\'s); the Tides\' five lands and Calm; the cakes found on any foe; the eve\'s UTC day; Keeper the guildmaster\'s; silver, the beta, "Season n", the season\'s captains, the harbormaster, rated, opponents, registered accounts (mutants: each sentence as it stood)', () => {
  const m = seasonBookModel({ now: Date.UTC(2026, 10, 10), seatsOpen: true, zero: 2, boards: {} });
  const realm = sec(m, 'realm'), seats = sec(m, 'seats');
  assert.equal(realm.foot, 'Arena Champion, Iliac Champion and Grandmaster are worn by the leader, once they have 10 rated bouts or games against 5 different opponents.');
  assert.doesNotMatch(realm.foot, /Spire/, 'L1: Spire Champion is the top ten\'s, through the next season');
  assert.equal(row(realm, 'spire').about, 'Each bracket ranks companies by their deepest Descent from Hall 1. The top ten are Spire Champions next season. A new season lets you start from half your deepest Redoubt.');
  assert.equal(row(realm, 'arena').about, 'Rated bouts set your season rating. The leader wears Arena Champion, and the banner with more points wears the laurel next season.');
  assert.equal(row(realm, 'iliac').about, 'Rated games at the card table. The leader wears Iliac Champion.');
  assert.equal(row(realm, 'gambit').about, 'Rated games between registered accounts. The leader wears Grandmaster.');
  assert.equal(row(realm, 'sea').about, 'The deepest voyage past the Veil and the most legends sunk or taken, on the board at any freeport\'s harbormaster.');
  assert.equal(row(seats, 'tides').about, 'Each week every kingdom, the Marches and the Free Lands draw a Tide - a harvest, a plague, raiders - or stay Calm.');
  assert.equal(row(seats, 'crowns').about, 'Each crown\'s guildmaster earns Crowned in Season 1. The guildmaster of a guild that holds a seat all Season earns Keeper of its town.');
  assert.equal(row(seats, 'reset').about, 'Standing drifts halfway back to 50 and every fortification loses a tier. Charters stand.');
  const fest = sec(seasonBookModel({ now: NOW }), 'festival');
  assert.equal(row(fest, 'cakes').about, 'Found on foes, the dead and the summoned most often, and in gathering, crafting, looting and at sea. Spend them with the Wyrd Sister outside any tavern. Finds count double on 31 October (UTC) and on in-game nights the dead walk.');
  assert.equal(row(fest, 'starfall').about, 'Every in-game night, about once a real hour, one coven pulls three stars down near its region\'s towns. Hold the crater against the waves.');
  const words = JSON.stringify(seasonBookModel({ now: NOW, seatsOpen: true, zero: 2, boards: {} }));
  for (const gone of [/\bMarks\b/, /profession tracks/, /Ranked Season/, /harbourmaster/, /\brivals?\b/, /ranked bouts/i, /real-world calendar/]) assert.doesNotMatch(words, gone, `W6-W8: ${gone}`);
  // P16/L13: the foot's numbers are all three boards' - the service's own constants held to the book's
  assert.deepEqual([SEASON_TITLE_GAMES, SEASON_TITLE_FOES], [ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES]);
  assert.deepEqual([SEASON_TITLE_GAMES, SEASON_TITLE_FOES], [ILIAC_CHAMPION_MIN_GAMES, ILIAC_CHAMPION_MIN_FOES]);
  assert.deepEqual([SEASON_TITLE_GAMES, SEASON_TITLE_FOES], [GAMBIT_CHAMPION_MIN_GAMES, GAMBIT_CHAMPION_MIN_FOES]);
});

test('SEASON-BOOK the standings: each line as the board says it - AUDIT L2/W3 the points the player\'s own for their banner; L3 the company\'s best Descent; W2/L8 every number ungrouped, as the boards print it; P11 a bout is a win, a loss or a draw, a rank of 0 no rank, legends alone a voyage (mutants: the banner\'s total; "deepest"; a grouped rating; a term of the bouts dropped)', () => {
  const me = (pvp, more = {}) => ({ me: { pvp: { rating: 1240, wins: 0, losses: 0, draws: 0, ...pvp }, rank: 4, banner: null, points: 0, ...more } });
  assert.equal(arenaStanding(me({ wins: 7 }, { banner: 'red', points: 1 })), '#4 - rating 1240 - 1 point for the Red Banner');
  assert.equal(arenaStanding(me({ wins: 1 }, { banner: 'blue', points: 12 })), '#4 - rating 1240 - 12 points for the Blue Banner');
  assert.equal(arenaStanding(me({ draws: 1 })), '#4 - rating 1240', 'draws alone are bouts');
  assert.equal(arenaStanding(me({ losses: 1 })), '#4 - rating 1240', 'losses alone are bouts');
  assert.equal(arenaStanding(me({ wins: 1 })), '#4 - rating 1240', 'wins alone are bouts');
  assert.equal(arenaStanding(me({}, { rank: null })), 'Rating 1240 - no rated bouts yet');
  assert.equal(arenaStanding(me({ wins: 1 }, { rank: 0 })), 'Rating 1240', 'a rank of 0 is none');
  assert.equal(arenaStanding({ me: { pvp: {}, banner: 'red' } }), 'Rating 0 - no rated bouts yet - 0 points for the Red Banner');
  assert.equal(arenaStanding({ me: null }), null);
  assert.equal(spireStanding({ best: { h: 14, t: 3000 } }), 'Your best Descent: Hall 14');
  assert.equal(spireStanding({ best: { h: 0 } }), 'No Descent yet this season');
  assert.equal(spireStanding({ best: null }), 'No Descent yet this season');
  assert.equal(ladderStanding({ me: { rating: 1100, games: 1 }, rows: [{ rank: 1 }], pinned: { you: true, rank: 23 } }), '#23 - rating 1100 - 1 game');
  assert.equal(ladderStanding({ me: { rating: 1100, games: 3 } }), 'Rating 1100 - 3 games', 'no rows at all');
  assert.equal(ladderStanding({ me: { rating: 1000, games: 0 } }), 'No rated games yet');
  assert.equal(ladderStanding({ me: null }), null);
  assert.equal(seaStanding({ n: 1, deepest: 212.7, legends: 1 }, 1), 'Deepest: 212 leagues past the Veil - 1 legend ended');
  assert.equal(seaStanding({ n: 1, deepest: 0, legends: 2 }, 1), 'Deepest: 0 leagues past the Veil - 2 legends ended', 'legends alone are a season counted');
  assert.equal(seaStanding({ n: 0, deepest: 400, legends: 3 }, 1), 'No voyage counted yet this season', 'last season\'s figures are not this one\'s');
  assert.equal(seaStanding(null, 1), 'No voyage counted yet this season');
});

test('SEASON-BOOK the rows\' standing by its read: asking, unread, the player\'s own; AUDIT R4/L4 a guest told to add a username and no one signed in to sign in (the festival too); R7 an arena not live says nothing; a host that hands no reads shows none; the doors only where the host hands one (mutants: a guest ranked; an unread board as asking; a door without its host)', () => {
  const arena = { me: { pvp: { rating: 1240, wins: 7, losses: 2, draws: 1 }, rank: 4, banner: 'red', points: 1 } };
  const m = seasonBookModel({ now: NOW, signedIn: true, boards: { arena: ok(arena), spire: { state: 'asking', data: null }, iliac: { state: 'failed', data: null }, gambit: ok({ me: null }) }, sea: { n: 1, deepest: 9, legends: 0 }, doors: { arena: () => true, spire: null } });
  const realm = sec(m, 'realm');
  assert.deepEqual(realm.rows.map((r) => r.standing), ['#4 - rating 1240 - 1 point for the Red Banner', 'Reading the board...', 'The board can\'t be read right now.', 'Sign in to be ranked.', 'Deepest: 9 leagues past the Veil - 0 legends ended']);
  assert.deepEqual(realm.rows.map((r) => r.door), ['arena', null, null, null, null], 'the Arena\'s door handed, the Spire\'s not');
  assert.equal(row(sec(seasonBookModel({ now: NOW, signedIn: true, boards: { arena: null } }), 'realm'), 'arena').standing, null, 'R7: an arena not live reads nothing');
  const guest = seasonBookModel({ now: NOW, guest: true, signedIn: true, boards: {}, doors: { arena: () => true, spire: () => true } });
  assert.deepEqual(sec(guest, 'realm').rows.slice(0, 4).map((r) => r.standing), Array(4).fill('Add a username to be ranked.'), 'R4: a guest is never told a rank will follow');
  assert.equal(row(sec(guest, 'realm'), 'arena').door, null, 'no Arena door for a guest');
  assert.equal(sec(guest, 'festival').foot, 'Add a username to join the festival.', 'L4: the festival shut to a guest, said');
  const out = seasonBookModel({ now: NOW, signedIn: false, boards: {} });
  assert.deepEqual(sec(out, 'realm').rows.slice(0, 4).map((r) => r.standing), Array(4).fill('Sign in to be ranked.'));
  assert.equal(sec(out, 'festival').foot, 'Sign in to join the festival.');
  assert.ok(sec(seasonBookModel({ now: NOW }), 'realm').rows.every((r) => r.standing === null), 'a host that hands no reads: no line at all, never "reading" for ever');
});

// ── the host's reads ──
function world({ answer = () => ({ ok: true, data: { season: { n: 1 }, me: { rating: 1, games: 1 } } }), me = 'acct-a', guest = false } = {}) {
  const asks = { eg: 0, iliac: 0, gambit: 0 };
  const w = { asks, me, guest,
    eg: { board: () => { asks.eg++; return Promise.resolve(answer('eg')); }, me: () => w.me, guest: () => w.guest },
    iliac: { board: () => { asks.iliac++; return Promise.resolve(answer('iliac')); } },
    gambit: { board: () => { asks.gambit++; return Promise.resolve(answer('gambit')); } },
    ledger: { season: () => ({ n: 1, deepest: 3, legends: 0 }) } };
  return w;
}
const total = (w) => w.asks.eg + w.asks.iliac + w.asks.gambit;

test('AUDIT SEASON-BOOK R1: a board is asked when the window OPENS, once a minute at most however often it opens, never while it stays open; never on a hidden page or while the service says it is overloaded; the arena refreshed then too, never a tick (mutants: asked every tick; the minute a second; the `out` flag ignored; hidden asked; busy asked)', async () => {
  assert.equal(SEASON_BOARD_FRESH_MS, 60_000);
  assert.deepEqual(Object.keys(SEASON_BOARDS), ['spire', 'iliac', 'gambit']);
  let clock = 0, hid = false, bz = false;
  const w = world();
  const book = createSeasonBook(() => w, { now: () => clock, hidden: () => hid, busy: () => bz });
  book.source({ opening: true, now: NOW });
  assert.deepEqual(w.asks, { eg: 1, iliac: 1, gambit: 1 }, 'the opening asks each board through its door');
  await tick();
  for (let s = 1; s <= 600; s++) { clock += 1000; book.source({ now: NOW }); }
  assert.equal(total(w), 3, 'ten minutes open: nothing more asked');
  book.source({ opening: true, now: NOW });
  assert.equal(total(w), 6, 'opened again, past the minute: asked again');
  await tick();
  clock += SEASON_BOARD_FRESH_MS - 1;
  book.source({ opening: true, now: NOW });
  assert.equal(total(w), 6, 'opened again inside the minute: nothing');
  clock += 1;
  hid = true; book.source({ opening: true, now: NOW });
  assert.equal(total(w), 6, 'a hidden page asks nothing');
  hid = false; bz = true; book.source({ opening: true, now: NOW });
  assert.equal(total(w), 6, 'an overloaded service is let be');
  bz = false; book.source({ opening: true, now: NOW });
  assert.equal(total(w), 9);
  // an ask still out is never asked twice
  let release;
  const slow = world({ answer: () => new Promise((r) => { release = r; }) });
  let c2 = 0;
  const b2 = createSeasonBook(() => slow, { now: () => c2 });
  b2.source({ opening: true, now: NOW });
  c2 += 10 * SEASON_BOARD_FRESH_MS;
  b2.source({ opening: true, now: NOW });
  assert.equal(total(slow), 3, 'the `out` flag holds while an answer is coming');
  release({ ok: true, data: { me: null } }); await tick();
  // the default clock is the page's own monotonic one
  const was = performance.now;
  let fake = 0;
  performance.now = () => fake;
  try {
    const w3 = world();
    const b3 = createSeasonBook(() => w3);
    b3.source({ opening: true, now: NOW }); await tick();
    b3.source({ opening: true, now: NOW });
    assert.equal(total(w3), 3);
    fake += SEASON_BOARD_FRESH_MS;
    b3.source({ opening: true, now: NOW });
    assert.equal(total(w3), 6, 'performance.now is the default clock');
  } finally { performance.now = was; }
  assert.match(read('src/scenes/seasonBookHost.js'), /busy = \(\) => busyUntil\(\) > Date\.now\(\),/, 'the default busy is BUSY-GATE\'s hold');
});

test('AUDIT SEASON-BOOK R2/R4: the reads are the signed-in account\'s - another account\'s are dropped and asked again; a no-session answer drops the read; a guest and no one signed in are asked nothing (mutants: a read kept across accounts; no-session kept; a guest asked)', async () => {
  let clock = 0;
  const w = world({ answer: (k) => ({ ok: true, data: { season: { n: 1 }, me: { rating: w.me === 'acct-a' ? 1820 : 1000, games: 3 }, rows: [] } }) });
  const book = createSeasonBook(() => w, { now: () => clock });
  book.source({ opening: true, now: NOW }); await tick();
  assert.equal(book.source({ now: NOW }).boards.iliac.data.me.rating, 1820);
  w.me = 'acct-b';
  const b = book.source({ now: NOW });
  assert.equal(b.boards.iliac.state, 'asking', 'A\'s line is gone the moment B is signed in');
  assert.equal(total(w), 6, 'and B\'s asked at once');
  await tick();
  assert.equal(book.source({ now: NOW }).boards.iliac.data.me.rating, 1000);
  // signed out: nothing asked, nothing kept
  w.me = null;
  const out = book.source({ opening: true, now: NOW });
  assert.deepEqual([out.signedIn, out.guest, out.boards], [false, false, {}]);
  assert.equal(total(w), 6);
  // a guest: nothing asked
  w.me = 'guest-1'; w.guest = true;
  const g = book.source({ opening: true, now: NOW });
  assert.deepEqual([g.signedIn, g.guest, g.boards], [true, true, {}], 'a guest is signed in - as a guest, ranked by nothing');
  assert.equal(total(w), 6);
  // a no-session answer drops what was kept
  const w2 = world();
  let n = 0;
  const b2 = createSeasonBook(() => w2, { now: () => clock + n });
  b2.source({ opening: true, now: NOW }); await tick();
  assert.equal(b2.source({ now: NOW }).boards.spire.state, 'ok');
  w2.eg.board = () => Promise.resolve({ ok: false, error: 'no-session' });
  n += SEASON_BOARD_FRESH_MS;
  b2.source({ opening: true, now: NOW }); await tick();
  assert.deepEqual(b2.source({ now: NOW }).boards.spire, { state: 'failed', data: null }, 'no session: never a standing kept');
  w2.iliac.board = () => Promise.resolve({ ok: false, error: 'server' });
  n += SEASON_BOARD_FRESH_MS;
  b2.source({ opening: true, now: NOW }); await tick();
  assert.equal(b2.source({ now: NOW }).boards.iliac.state, 'ok', 'a failure of the service keeps the last good answer');
});

test('AUDIT SEASON-BOOK R3/L9: an answer of another season is no standing, and the season turning asks again at once, open or not (mutants: last season\'s lines under the new season)', async () => {
  let clock = 0;
  let season = 1;
  const w = world({ answer: () => ({ ok: true, data: { season: { n: season }, me: { rating: 1, games: 1 } } }) });
  const book = createSeasonBook(() => w, { now: () => clock });
  const S2 = Date.UTC(2026, 10, 23, 0, 0, 30);
  book.source({ opening: true, now: S2 - 60_000 }); await tick();
  assert.equal(book.source({ now: S2 - 60_000 }).boards.spire.state, 'ok');
  const turned = book.source({ now: S2 });
  assert.equal(turned.boards.spire.state, 'asking', 'season 1\'s answer under season 2: asked again, never shown');
  assert.equal(total(w), 6, 'asked the moment the season turned, inside the minute and with no opening');
  await tick();
  assert.equal(book.source({ now: S2 }).boards.spire.state, 'failed', 'the service still on season 1: unread, never last season\'s line');
  season = 2;
  clock += SEASON_BOARD_FRESH_MS;
  book.source({ opening: true, now: S2 }); await tick();
  assert.equal(book.source({ now: S2 }).boards.spire.state, 'ok');
  assert.deepEqual([boardSeasonOf({ season: 3 }), boardSeasonOf({ season: { n: 4 } }), boardSeasonOf({})], [3, 4, null], 'the arena says it as a number, the others as { n }');
});

test('AUDIT SEASON-BOOK R5/S1/R7: the arena\'s board is a read like the others - asked at an opening through fetchBoard, said unread when it cannot be had (never "reading" for ever); a board of another account asked again; an arena not live none (mutants: the arena reading for ever; a stranger\'s board shown; a dead arena read)', async () => {
  let clock = 0;
  const w = world();
  let board = null, fetches = 0, refreshes = 0, live = true, answer = null;
  w.arena = { live: () => live, board: () => board, refresh: () => { refreshes++; }, fetchBoard: () => { fetches++; return Promise.resolve(answer); } };
  const book = createSeasonBook(() => w, { now: () => clock });
  assert.equal(book.source({ opening: true, now: NOW }).boards.arena.state, 'asking');
  assert.equal(fetches, 1);
  await tick();
  assert.deepEqual(book.source({ now: NOW }).boards.arena, { state: 'failed', data: null }, 'the board could not be had: said so');
  for (let s = 0; s < 120; s++) { clock += 1000; book.source({ now: NOW }); }
  assert.deepEqual([fetches, refreshes], [1, 0], 'nothing asked while the window stays open');
  board = answer = { season: 1, me: { pvp: { rating: 1300 } } };   // the arena's own window read it since
  book.source({ opening: true, now: NOW }); await tick();
  assert.deepEqual(book.source({ now: NOW }).boards.arena, { state: 'ok', data: board });
  assert.deepEqual([fetches, refreshes], [1, 1], 'a board held: the opening refreshes it (the arena keeps its own 20 s), never fetched again');
  clock += SEASON_BOARD_FRESH_MS;
  book.source({ opening: true, now: NOW });
  assert.equal(refreshes, 2, 'each opening a minute on refreshes it once');
  w.me = 'acct-b';
  const b = book.source({ now: NOW });
  assert.notEqual(b.boards.arena.state, 'ok', 'A\'s board is not B\'s');
  assert.ok(refreshes >= 2, 'and the arena asked again');
  board = { season: 1, me: { pvp: { rating: 999 } } };
  assert.equal(book.source({ now: NOW }).boards.arena.data, board, 'the board that lands under B is B\'s');
  live = false;
  assert.equal(book.source({ opening: true, now: NOW }).boards.arena, null, 'R7: not live, no read');
});

test('AUDIT SEASON-BOOK P12: never a throw out of the source - a board door that throws, a ledger that throws, an arena that throws, a getter not declared yet (AUDIT TIMERS1 D6\'s law); an ok answer without data keeps what was kept (mutants: each try dropped)', async () => {
  let clock = 0;
  const w = world();
  w.gambit.board = () => { throw new Error('sync'); };
  w.ledger.season = () => { throw new Error('ledger'); };
  w.arena = { live: () => { throw new Error('arena'); } };
  const book = createSeasonBook(() => w, { now: () => clock });
  const s = book.source({ opening: true, now: NOW });
  assert.equal(s.sea, null);
  assert.equal(s.boards.arena, null);
  await tick();
  assert.equal(book.source({ now: NOW }).boards.gambit.state, 'failed', 'a throwing door is a failed read');
  w.iliac.board = () => Promise.resolve({ ok: true });
  clock += SEASON_BOARD_FRESH_MS;
  book.source({ opening: true, now: NOW }); await tick();
  assert.equal(book.source({ now: NOW }).boards.iliac.state, 'ok', 'an answer with no data never wipes the kept one');
  const early = createSeasonBook(() => { throw new ReferenceError('Cannot access before initialization'); });
  assert.deepEqual(early.source({ opening: true, now: NOW }), { signedIn: false, guest: false, boards: {}, sea: null });
});

test('SEASON-BOOK the source: the hourglass\'s clock under the laurel\'s reads; only the opening read asks (AUDIT R1 - the seats list too); the seats\' word the clock\'s; the Arena\'s door once a banner is worn, the Spire\'s the hourglass\'s boards door (mutants: a window with no clock; every read asking; the seats always open; the Arena\'s door for a stranger to it)', () => {
  assert.equal(seasonSource({}), null);
  assert.equal(seasonSource({ timers: () => null, season: () => ({}) }), null);
  const asked = [], seasonAsked = [];
  const board = () => true;
  const hooks = { timers: (o) => { asked.push(o); return { now: NOW, seatsOpen: false, zero: 2, doors: { board } }; }, season: (o) => { seasonAsked.push(o); return { boards: { spire: null }, sea: null }; }, arenaJoined: () => false, openArena: () => true };
  const src = seasonSource(hooks, { opening: true });
  seasonSource(hooks);
  assert.deepEqual(asked, [{ ask: true }, { ask: false }], 'the timers\' service read asked at the opening alone');
  assert.deepEqual(seasonAsked, [{ opening: true, now: NOW }, { opening: false, now: NOW }]);
  assert.deepEqual([src.now, src.seatsOpen, src.zero], [NOW, false, 2]);
  assert.equal(sec(seasonBookModel(src), 'seats'), undefined, 'the clock says the seats are shut: no section');
  assert.deepEqual(src.doors, { arena: null, spire: board });
  hooks.arenaJoined = () => true;
  assert.equal(seasonSource(hooks).doors.arena(), true, 'a banner worn: the Arena\'s window');
});

// ── the window, over a document just real enough ──
function fakeDoc() {
  const doc = { activeElement: null };
  const node = (tag) => {
    const n = { tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', id: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); }, focus(o) { doc.activeElement = n; n.focusedWith = o; } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  doc.createElement = node;
  return doc;
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };
const one = (root, cls) => all(root, cls)[0];
/** A window with its interval counted: `ticks` the delays asked, `cleared` the intervals stopped. */
function counted(run) {
  const was = { set: globalThis.setInterval, clear: globalThis.clearInterval };
  const ticks = [], cleared = [];
  globalThis.setInterval = (f, ms) => { ticks.push(ms); return ticks.length; };
  globalThis.clearInterval = (h) => { cleared.push(h); };
  try { return run({ ticks, cleared }); } finally { globalThis.setInterval = was.set; globalThis.clearInterval = was.clear; }
}

test('SEASON-BOOK the window: a dialog named by its title, every section\'s title, sub-line, lead, countdown and foot and every row\'s name, line and standing drawn; AUDIT P5 its tick the second\'s and its stop the tick\'s; P8 the moment the relay\'s clock read in the player\'s (mutants: a description, a name, a sub, a lead or a foot not drawn; the default tick a minute; stop doing nothing; the offset dropped or flipped; the opening said as an end)', () => counted(({ ticks, cleared }) => {
  const offset = 5 * 60_000;   // the relay five minutes ahead of this machine
  const seen = [];
  const src = () => ({ now: Date.now() + offset, seatsOpen: true, zero: 2, boards: { spire: ok({ best: { h: 3 } }) }, signedIn: true, doors: {} });
  const view = seasonWindow(fakeDoc(), { read: src, onClose() {}, focus: false, when: (ms) => { seen.push(ms); return 'WHEN'; } });
  assert.deepEqual(ticks, [SEASON_TICK_MS], 'the window ticks once a second');
  assert.equal(SEASON_TICK_MS, 1000);
  view.stop();
  assert.deepEqual(cleared, [1], 'stop clears the window\'s own interval');
  const root = view.root;
  assert.deepEqual([root.attrs.role, root.attrs['aria-modal'], root.attrs['aria-labelledby']], ['dialog', 'true', 'sb-title']);
  assert.deepEqual([one(root, 'sb-title').id, one(root, 'sb-title').textContent], ['sb-title', 'Season'], 'P6: the dialog\'s name is its title');
  const model = seasonBookModel(src());
  assert.deepEqual(all(root, 'sb-stitle').map((n) => n.textContent), model.sections.map((s) => s.title));
  assert.deepEqual(all(root, 'sb-ssub').map((n) => n.textContent), model.sections.map((s) => s.sub));
  assert.deepEqual(all(root, 'sb-lead').map((n) => n.textContent), model.sections.filter((s) => s.lead).map((s) => s.lead));
  assert.deepEqual(all(root, 'sb-foot').map((n) => n.textContent), model.sections.filter((s) => s.foot).map((s) => s.foot));
  const rows = model.sections.flatMap((s) => s.rows);
  assert.deepEqual(all(root, 'sb-name').map((n) => n.textContent), rows.map((r) => r.name));
  assert.deepEqual(all(root, 'sb-about').map((n) => n.textContent), rows.map((r) => r.about));
  assert.equal(one(one(root, 'sb-spire'), 'sb-standing').textContent, 'Your best Descent: Hall 3');
  assert.equal(one(one(root, 'sb-tides'), 'sb-standing').hidden, true, 'a row with no standing hides its empty line');
  // P8: each section's moment is its own, less the relay's lead on this machine's clock - to the millisecond
  const wantAt = model.sections.map((s) => s.at - offset);
  assert.equal(seen.length, wantAt.length);
  seen.forEach((ms, i) => assert.ok(Math.abs(ms - wantAt[i]) < 50, `section ${i}: ${ms} vs ${wantAt[i]}`));
  assert.deepEqual(all(root, 'sb-when').map((n) => n.textContent), model.sections.map((s) => (s.atLabel === 'opens' ? 'opens WHEN' : 'ends WHEN')));
  const coming = seasonWindow(fakeDoc(), { read: () => ({ now: Date.UTC(2026, 9, 1) }), onClose() {}, focus: false, when: () => 'X' });
  coming.stop();
  assert.equal(one(one(coming.root, 'sb-festival'), 'sb-when').textContent, 'opens X', 'a festival to come counts to its opening');
}));

test('AUDIT SEASON-BOOK P8/W1: the time left as the hourglass counts it, its days\' letters through the text core; the moment in the player\'s own language through Intl (mutants: a countdown half an hour late; the English weekday)', () => {
  assert.equal(seasonLeftText(-5000), '0:00');
  assert.equal(seasonLeftText(247_000), '4:07');
  assert.equal(seasonLeftText(3_909_000), '1:05:09');
  assert.equal(seasonLeftText(2 * 86400_000 + 4 * 3600_000 + 59_000), '2d 04h');
  // the window's own countdown in the season's last minutes, where it runs to the second
  const view = seasonWindow(fakeDoc(), { read: () => ({ now: Date.UTC(2026, 10, 23) - 247_000, signedIn: true, boards: {} }), onClose() {}, focus: false });
  try { assert.equal(one(one(view.root, 'sb-realm'), 'sb-count').textContent, '4:07'); } finally { view.stop(); }
  const ms = Date.UTC(2026, 10, 23, 0, 0);
  assert.equal(seasonWhenText(ms), new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms));
  assert.match(read('src/ui/enhanced/enhancedSeason.js'), /new Intl\.DateTimeFormat\(loc, \{ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' \}\)/);
  assert.match(read('src/ui/enhanced/enhancedSeason.js'), /const loc = intlLocale\(\);/, 'the player\'s language, the text core\'s');
});

test('AUDIT SEASON-BOOK S2/U2: every line rewritten in place - a board\'s answer, the day turning - and the list rebuilt only when its rows or doors change; a door with the focus keeps it across that rebuild; P2 a door hands the source\'s own door read at the press (the Arena\'s, the Spire\'s), and a door gone does nothing (mutants: rebuilt every tick; the sub frozen; the focus dropped; the door read from the draw or the wrong one; the guard gone)', () => counted(() => {
  let now = NOW, iliac = { state: 'asking', data: null }, joined = false;
  const opened = [];
  const doors = { spire: () => { opened.push('spire'); return true; }, arena: () => { opened.push('arena'); return true; } };
  const src = () => ({ now, seatsOpen: true, zero: 2, signedIn: true, boards: { spire: ok({ best: { h: 3 } }), iliac }, doors: { spire: doors.spire, arena: joined ? doors.arena : null } });
  const handed = [];
  const doc = fakeDoc();
  const view = seasonWindow(doc, { read: src, onClose() {}, focus: false, door: (fn) => { handed.push(fn); return fn(); } });
  const root = view.root;
  const realm = one(root, 'sb-realm'), standing = one(one(root, 'sb-iliac'), 'sb-standing');
  assert.equal(standing.textContent, 'Reading the board...');
  iliac = ok({ me: { rating: 1200, games: 2 }, rows: [{ you: true, rank: 2 }] });
  now += 86_400_000;   // the day turns too
  view.draw();
  assert.equal(one(root, 'sb-realm'), realm, 'the same section - nothing rebuilt');
  assert.equal(one(one(root, 'sb-iliac'), 'sb-standing'), standing, 'the same line, its words new');
  assert.equal(standing.textContent, '#2 - rating 1200 - 2 games');
  assert.equal(one(realm, 'sb-ssub').textContent, 'Day 26 of 56', 'the day turned in place');
  assert.equal(one(realm, 'sb-count').textContent, seasonLeftText(Date.UTC(2026, 10, 23) - now), 'the countdown the relay\'s, to the second');
  assert.equal(one(realm, 'sb-count').textContent, '30d 12h');
  const spireDoor = one(one(root, 'sb-spire'), 'sb-door');
  assert.equal(spireDoor.textContent, 'Boards');
  spireDoor.focus();
  joined = true;   // the Arena's door arrives: the rows' doors change, the list is rebuilt
  view.draw();
  assert.notEqual(one(root, 'sb-realm'), realm, 'a new door rebuilds');
  assert.equal(doc.activeElement, one(one(root, 'sb-spire'), 'sb-door'), 'the focused door keeps the focus');
  assert.deepEqual(doc.activeElement.focusedWith, { preventScroll: true });
  const arenaDoor = one(one(root, 'sb-arena'), 'sb-door');
  assert.equal(arenaDoor.textContent, 'Arena');
  arenaDoor.listeners.click[0]();
  one(one(root, 'sb-spire'), 'sb-door').listeners.click[0]();
  assert.deepEqual(opened, ['arena', 'spire'], 'each door its own, read at the press');
  assert.equal(handed.length, 2, 'handed to the pause face\'s handoff');
  doors.arena = null;   // a door gone since the draw
  arenaDoor.listeners.click[0]();
  assert.equal(handed.length, 2, 'a door that is gone opens nothing');
  view.stop();
}));

test('AUDIT SEASON-BOOK U3/P6: the focus goes into the window when it opens (Close, without scrolling), never when the face repaints around it; Close closes; no clock said so (mutants: no focus in; the focus pulled on every build; the scroll jumped)', () => counted(() => {
  const was = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (f) => f();
  try {
    let closed = 0;
    const doc = fakeDoc();
    const opened = seasonWindow(doc, { read: () => ({ now: NOW }), onClose: () => { closed++; } });
    assert.equal(doc.activeElement, opened.close, 'focus defaults on: the opening takes it to Close');
    assert.deepEqual(opened.close.focusedWith, { preventScroll: true });
    opened.close.listeners.click[0]();
    assert.equal(closed, 1);
    const doc2 = fakeDoc();
    const marker = { tag: 'button' };
    doc2.activeElement = marker;
    seasonWindow(doc2, { read: () => ({ now: NOW }), onClose() {}, focus: false });
    assert.equal(doc2.activeElement, marker, 'a repaint\'s window leaves the focus where it was');
    const empty = seasonWindow(fakeDoc(), { read: () => null, onClose() {}, focus: false });
    assert.equal(one(empty.root, 'sb-empty').textContent, 'The world\'s clock can\'t be read right now.');
  } finally { globalThis.requestAnimationFrame = was; }
}));

test('SEASON-BOOK a window taken out of the page stops its own tick (AUDIT TIMERS1 UI-10\'s law)', async () => {
  let reads = 0;
  const view = seasonWindow(fakeDoc(), { read: () => { reads++; return { now: NOW }; }, onClose() {}, every: 5, focus: false });
  view.root.isConnected = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await wait(40);
    const was = reads;
    await wait(40);
    assert.equal(reads, was, 'no more reads once the tick saw it gone');
    assert.equal(was, 1, 'only the first draw read');
  } finally { view.stop(); }   // a failing assertion never leaves the tick alive (and the run hung)
});

test('SEASON-BOOK the laurel: a button named "Season" (AUDIT W11/U9: never a list of sections it may not hold), aria-expanded as it is, placed at the end of the row of marks - each beside the one before it - and AUDIT P13 its teardown lets go of every listener and observer (mutants: always expanded; placed beside the profile; a missing mark breaking the row; the teardown emptied; no resize, no observer, no font)', () => {
  let opened = 0;
  const closedMark = seasonMark(fakeDoc(), { onOpen: () => { opened++; } });
  assert.deepEqual([closedMark.className, closedMark.type, closedMark.title, closedMark.attrs['aria-label']], ['px-seasonmark', 'button', 'Season', 'Season']);
  assert.deepEqual([closedMark.attrs['aria-haspopup'], closedMark.attrs['aria-expanded']], ['dialog', 'false']);
  assert.equal(seasonMark(fakeDoc(), { onOpen() {}, open: true }).attrs['aria-expanded'], 'true');
  assert.deepEqual(closedMark.children.map((c) => [c.className, c.attrs['aria-hidden']]), [['px-laurel', 'true']]);
  closedMark.listeners.click[0]();
  assert.equal(opened, 1);
  const host = { getBoundingClientRect: () => ({ right: 1280, top: 0 }) };
  const profile = { getBoundingClientRect: () => ({ left: 1107, top: 10, width: 161, height: 48 }) };
  const mark = (w) => { const m = { style: {}, offsetHeight: 44 }; m.getBoundingClientRect = () => ({ left: 1280 - parseInt(m.style.right, 10) - w, top: 12, width: w, height: 44 }); return m; };
  const saved = { raf: globalThis.requestAnimationFrame, RO: globalThis.ResizeObserver, add: globalThis.addEventListener, remove: globalThis.removeEventListener, document: globalThis.document };
  const listeners = new Set(), observed = [], disconnected = [];
  let fontsThen = 0;
  globalThis.requestAnimationFrame = (f) => f();
  globalThis.ResizeObserver = class { constructor(f) { this.f = f; } observe(n) { observed.push(n); } disconnect() { disconnected.push(this); } };
  globalThis.addEventListener = (t, f) => listeners.add(`${t}`);
  globalThis.removeEventListener = (t, f) => listeners.delete(`${t}`);
  globalThis.document = { fonts: { ready: { then: () => { fontsThen++; return { catch() {} }; } } } };
  try {
    const glass = mark(39), env = mark(44), laurel = mark(44);
    const off = anchorSeason(laurel, [glass, env], profile, host);
    assert.deepEqual([glass.style.right, env.style.right, laurel.style.right], ['183px', '232px', '286px'], 'the glass beside the profile, the envelope beside it, the laurel last');
    assert.deepEqual(observed, [profile, glass, env, laurel, host], 'every mark of the row observed, and the box they stand in');
    assert.deepEqual([...listeners], ['resize']);
    assert.equal(fontsThen, 1, 'placed again once the web font lands');
    off();
    assert.deepEqual([listeners.size, disconnected.length], [0, 1], 'the teardown lets go of both');
    const alone = mark(44);
    anchorSeason(alone, [null, null], profile, host)();
    assert.equal(alone.style.right, '183px', 'with no other mark, beside the profile');
  } finally { Object.assign(globalThis, { requestAnimationFrame: saved.raf, ResizeObserver: saved.RO, addEventListener: saved.add, removeEventListener: saved.remove, document: saved.document }); }
});

test('SEASON-BOOK `/season`: the window from the chat on either skin and wherever the player stands; AUDIT R6/W12 its refusal says the one case it is (the relay\'s clock unheard); P15 only a whole line opens it (mutants: /season said to the room; /seasons unread; a line ending in /seasons swallowed; the old refusal)', () => {
  assert.equal(pauseCommandOf('/season'), 'season');
  assert.equal(pauseCommandOf(' /Seasons '), 'season');
  assert.equal(pauseCommandOf('/season 2'), null);
  assert.equal(pauseCommandOf('summer/seasons'), null, 'a line that only ends in /seasons is said, not swallowed');
  assert.equal(pauseCommandOf('/mail'), 'mailbox', 'the mailbox\'s lines read as they were');
  assert.equal(pauseCommandOf('/bug'), 'report');
  assert.equal(pauseCommandOf('hello'), null);
  assert.ok(HOST_COMMANDS.includes('season') && HOST_COMMANDS.includes('seasons'));
  assert.deepEqual(parseChatLine('/season'), { kind: 'host', name: 'season' }, 'never said to the room');
  assert.equal(pauseCommandRefusal('season'), 'The world\'s clock hasn\'t been heard yet. Try again in a moment.');
  assert.equal(pauseCommandRefusal('mailbox'), 'Connect and sign in to use the mailbox.');
  assert.ok(HELP_LINES.includes('/season - this season, your standings and the time left'), '/help says it');
  const world = read('src/scenes/world.js');
  assert.match(world, /\n {8}\{ const at = pauseCommandOf\(text\); if \(at\) \{[^\n]*\n {10}if \(!\(at === 'season' \? timersSource\(\) : postSource\(\)\)\) \{ chatLog\.push\(tabId, \{ text: pauseCommandRefusal\(at\), system: true \}\); return true; \}\n {10}if \(!modes\?\.openPauseAt\?\.\(at\)\) hudCtx\.togglePause\(\{ at \}\);/, 'the hourglass\'s clock its door, the pause face opened at it');
  assert.match(read('src/ui/pauseDoor.js'), /\n {2}if \(\(hooks\.at === 'mailbox' \|\| hooks\.at === 'report' \|\| hooks\.at === 'season'\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(show, hooks\);/, 'the classic skin opens the enhanced face (it has no laurel)');
});

test('SEASON-BOOK wiring, anchored to whole lines (AUDIT P10): the face stands the laurel after the envelope; the window on the hourglass\'s stage, its scrim swallowing the tap\'s release (U1), the face and every mark inert under it and the laurel inert under the other windows (P4); a mark gone closes its window (S4); the doors through the one handoff (S3); the focus in at an opening alone (U3); its tick stopped on every rebuild and unmount; every host hands the world\'s reads (mutants: each line commented out)', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /\nimport \{ seasonMark, seasonWindow, seasonSource, anchorSeason \} from '\.\/enhancedSeason\.js';/);
  assert.match(menu, /\nfunction seasonLaurel\(home, chain\) \{\n {2}if \(!hooks\.timers\?\.\(\)\) return null;\n {2}const laurel = seasonMark\(document, \{ open: seasonOpen, onOpen: \(\) => \{ seasonOpen = true; seasonFocusIn = true; render\(\); \} \}\);\n {2}home\.append\(laurel\);\n {2}seasonAnchor = anchorSeason\(laurel, chain, home\.querySelector\?\.\('\.px-profile'\), home\);\n {2}if \(seasonFocusBack && !seasonOpen\) \{ seasonFocusBack = false; globalThis\.requestAnimationFrame\?\.\(\(\) => laurel\.focus\?\.\(\)\); \}\n/);
  assert.match(menu, /\nconst closeSeason = \(\) => \{ seasonOpen = false; seasonFocusBack = true; render\(\); \};\n/);
  assert.match(menu, /\nconst stopSeason = \(\) => \{ seasonView\?\.stop\(\); seasonView = null; seasonAnchor\?\.\(\); seasonAnchor = null; \};\n/);
  assert.match(menu, /\n {4}const laurel = seasonLaurel\(home, \[mark, envelope\]\);[^\n]*\n(\s*\/\/[^\n]*\n)*\s*if \(timersOpen && !mark\) timersOpen = false;\n\s*if \(postOpen && !envelope\) \{ postOpen = false; postKeep = \{\}; \}\n\s*if \(seasonOpen && !laurel\) seasonOpen = false;\n/, 'S4');
  assert.match(menu, /\n {6}closeOnOutsideTap\(home, '\.px-acctwin', closeAccount\);[^\n]*\n {6}for \(const n of \[stage, mark, envelope, laurel\]\) n\?\.setAttribute\?\.\('inert', ''\);/, 'under the account window');
  assert.match(menu, /\n {6}envelope\?\.setAttribute\?\.\('inert', ''\);[^\n]*\n {6}laurel\?\.setAttribute\?\.\('inert', ''\);   \/\/ SEASON-BOOK: and the laurel\n/, 'P4: under the timers window');
  assert.match(menu, /\n {6}closeOnOutsideTap\(home, '\.px-postwin', \(\) => \{ postOpen = false; postKeep = \{\}; postFocusBack = true; render\(\); \}, \{ swallow: true \}\);\n {6}for \(const n of \[stage, home\.querySelector\?\.\('\.px-profile'\), mark, envelope, laurel\]\) n\?\.setAttribute\?\.\('inert', ''\);\n/, 'P4: under the mailbox');
  assert.match(menu, /\n {4}else if \(seasonOpen && laurel\) \{\n(\s*\/\/[^\n]*\n)*\s*const sstage = el\('div', 'px-stage px-timersstage px-seasonstage'\);\n\s*seasonView = seasonWindow\(document, \{ read: \(opening\) => seasonSource\(hooks, \{ opening \}\), onClose: closeSeason, door: seasonDoor, focus: seasonFocusIn \}\);[^\n]*\n\s*seasonFocusIn = false;\n\s*sstage\.append\(seasonView\.root\);\n\s*home\.append\(sstage\);\n\s*closeOnOutsideTap\(home, '\.px-seasonwin', closeSeason, \{ swallow: true \}\);\n\s*for \(const n of \[stage, home\.querySelector\?\.\('\.px-profile'\), mark, envelope, laurel\]\) n\?\.setAttribute\?\.\('inert', ''\);\n/);
  assert.match(menu, /closeOnOutsideTap\(home, '\.px-timerswin', \(\) => \{ timersOpen = false; timersFocusBack = true; render\(\); \}, \{ swallow: true \}\);/, 'U1: the hourglass\'s too');
  assert.match(menu, /\n {4}: seasonOpen && seasonView \? \(\) => closeSeason\(\)/, 'Escape closes a drawn window before it resumes');
  assert.match(menu, /\n {2}stopPost\(\);[^\n]*\n {2}stopSeason\(\);   \/\/ SEASON-BOOK: and the season window's\n {2}app\.innerHTML = '';/, 'a rebuild stops the tick');
  assert.match(menu, /\n {6}releaseTutorialsPane\(\);[^\n]*\n {6}stopSeason\(\);   \/\/ SEASON-BOOK: and the season window's\n/, 'and an unmount');
  assert.match(menu, /\n {2}discardControlsStaging\(\);[^\n]*\n {2}seasonOpen = false;   \/\/ SEASON-BOOK: and the season window's[^\n]*\n {2}seasonFocusBack = false;[\s\S]{0,1600}?\n {2}else if \(at === 'season'\) \{ seasonOpen = true; seasonFocusIn = true; \}/, 'a visit\'s window, reset before the door that opens it');
  assert.match(menu, /\nconst seasonDoor = \(fn\) => \{ if \(pauseTab === 'growth' && growthAsks\(\)\) \{ closeSeason\(\); return; \} timersDoor\(fn\); \};/, 'a Growth face asking under it: the window shut so the ask is seen');
  assert.match(menu, /\nfunction handoff\(fn, opened = \(r\) => r !== false\) \{\n {2}const act = onAction;[^\n]*\n {2}onAction\('handoff'\);\n {2}const r = fn\(\);\n {2}if \(!opened\(r\)\) act\('resume'\);\n {2}return r;\n\}/, 'S3: the handler read before the handoff unmounts the face');
  assert.equal(menu.split("onAction('handoff')").length - 1, 1, 'S3: every door through the one handoff - its own line the only one');
  assert.match(menu, /'\.px-win, \.px-clock, \.px-foot, \.px-profile, \.px-timersmark, \.px-postmark, \.px-seasonmark'/, 'the laurel inside the pause face: a press on it never resumes');
  const world = read('src/scenes/world.js');
  assert.match(world, /\n {2}const seasonBook = createSeasonBook\(\(\) => \(\{ arena: arenaOnline, eg: _accountEg, iliac: iliacDoor, gambit: gambitDoor, ledger: captainLedger \}\)\);\n/);
  assert.match(world, /\n {4}season: seasonBook\.source,   \/\/ SEASON-BOOK: the laurel's boards \(its clock is the hourglass's\)\n/, 'the street\'s pause bag');
  assert.match(world, /\n {4}season: seasonBook\.source,   \/\/ SEASON-BOOK: and the laurel's boards\n/, 'the modes host');
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /\n {4}season: host\.season,   \/\/ SEASON-BOOK/, 'a building\'s pause');
  assert.match(modes, /\n {10}season: \(o\) => host\.season\?\.\(o\) \?\? null,/, 'the dungeon\'s opts, the read\'s options carried');
  assert.match(read('src/scenes/dungeonContext.js'), /\n {8}season: \(o\) => opts\.season\?\.\(o\) \?\? null,/, 'the dungeon\'s pause');
});

// Stone's panel, measured under the timers window (test/ui/enhanced/timers1.test.js AUDIT TIMERS1 UI-4)
const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const ruleOf = (selector) => { const i = ENHANCED_CSS.indexOf(`\n${selector} {`); assert.ok(i >= 0, selector); return ENHANCED_CSS.slice(i, ENHANCED_CSS.indexOf('}', i) + 1); };

test('SEASON-BOOK the sheet (AUDIT P14, U4-U7, U10): the laurel a 12-pixel wreath at 3x beside the envelope, a 44px target with its focus ring above the face; the window the timers\' frame, wider; every door 44px; a narrow screen\'s clock under its title; a phone\'s door under its words; the pause tabs clear of four marks on a phone; the pad\'s bar cleared; Stone\'s words past 4.5:1 - each colour the sheet\'s own (mutants: each rule as it stood)', () => {
  assert.match(ruleOf('.px-seasonmark'), /position: absolute; top: 12px; right: 420px; z-index: 4;[^}]*min-height: 44px; min-width: 44px;/);
  assert.match(ENHANCED_CSS, /\n\.px-seasonmark:focus-visible \{ outline: 2px solid #f3cf86; outline-offset: 2px; \}/);
  assert.match(ruleOf('.px-laurel'), /width: 36px; height: 36px; image-rendering: pixelated;[^}]*viewBox='0 0 12 12' shape-rendering='crispEdges'>/, 'U6: three screen pixels to the art\'s one, as the envelope and the hourglass');
  assert.match(ruleOf('.px-win.px-seasonwin'), /max-height: min\(700px, 88dvh\); width: min\(660px, 94vw\);/);
  assert.match(ruleOf('.px-seasonwin .sb-door'), /min-height: 44px;/, 'U10');
  assert.deepEqual([...ruleOf('.px-seasonwin .sb-shead').matchAll(/flex-wrap: ([a-z-]+)/g)].map((m) => m[1]), ['wrap'], 'U7: the head wraps, and nothing after says otherwise');
  assert.match(ruleOf('.px-seasonwin .sb-clock'), /margin-left: auto;/);
  assert.match(ruleOf('.px-seasonwin .sb-stitle'), /overflow-wrap: break-word;/);
  assert.match(ENHANCED_CSS, /@media \(max-width: 560px\) \{\n\s*\.px-win\.px-seasonwin \.px-body \{ padding: 16px 14px 18px; \}\n\s*\.px-seasonwin \.sb-count \{ font-size: 16px; \}\n\s*\.px-seasonwin \.sb-row \{ flex-wrap: wrap; row-gap: 6px; \}[^\n]*\n\s*\.px-seasonwin \.sb-text \{ flex-basis: 100%; \}\n\}/);
  assert.match(ENHANCED_CSS, /@media \(max-height: 560px\) \{ \.px-win\.px-seasonwin \{ max-height: calc\(100dvh - 20px\); \} \}/);
  assert.match(ENHANCED_CSS, /@media \(max-width: 480px\) \{\n {2}\.px-over \.px-stage:not\(\.px-acctstage\):not\(\.px-timersstage\) \{ padding-top: max\(7dvh, 64px\); \}\n\}/, 'U4');
  assert.match(ENHANCED_CSS, /\nhtml\.plus-pad-prompts-visible \.px-over > \.px-stage\.px-timersstage \{ padding-bottom: calc\(var\(--plus-pad-clearance, 0px\) \+ 10px\); \}\nhtml\.plus-pad-prompts-visible \.px-over > \.px-stage\.px-timersstage > \.px-win \{ max-height: min\(680px, calc\(100dvh - var\(--plus-pad-clearance, 0px\) - 34px\)\); \}/, 'U5');
  const stone = '#51514c';
  const lift = /:root\[data-plus-theme="stone"\] \.px-seasonwin \{ --dim: (#[0-9a-f]{6}); --brass: (#[0-9a-f]{6});/.exec(ENHANCED_CSS);
  const counts = /:root\[data-plus-theme="stone"\] \.px-seasonwin \.sb-count, :root\[data-plus-theme="stone"\] \.px-seasonwin \.sb-standing \{ color: (#[0-9a-f]{6}); \}/.exec(ENHANCED_CSS);
  const lead = /:root\[data-plus-theme="stone"\] \.px-seasonwin \.sb-lead \{ color: (#[0-9a-f]{6}); \}/.exec(ENHANCED_CSS);
  assert.ok(lift && counts && lead, 'Stone\'s lift, its counts and standings, its leads');
  for (const [what, c] of [['dim', lift[1]], ['brass', lift[2]], ['count and standing', counts[1]], ['lead', lead[1]]]) {
    assert.ok(contrast(c, stone) >= 4.5, `Stone ${what} ${c} at ${contrast(c, stone).toFixed(2)}:1`);
  }
});
