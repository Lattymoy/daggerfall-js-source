// @ts-check
// SEASON-BOOK (2026-10-22, the owner: "I think we need a new pause menu icon, like we did for the timers and mail. A
// condensed place to see season related content and descriptions"; bible/10-UI/UI-Arc.md SEASON-BOOK) - THE SEASON'S
// LAW FOR THE PAUSE FACE'S LAUREL: what the season window shows, built from what the world host already holds. Pure: the
// clock, the seats' word and each board's last answer in, the window's sections out (ui/enhanced/enhancedSeason.js draws
// them).
//
// THREE CLOCKS, KEPT APART - each says which it is:
//   - THE SEASON (net/arena/arenaLaw.js arenaSeasonOf - eight weeks from Monday 28 September 2026, 00:00 UTC): the boards
//     that start fresh with it - the Arena, the Spire's Descent, Iliac Hand, the King's Gambit and the season's captains.
//     "Season {n}", as every one of those boards names it (AUDIT SEASON-BOOK W7).
//   - THE SEATS' SEASON (net/townSeatLaw.js seasonOf - its own weeks off the service's Season 0, ending at a Sunday
//     Turning): the guilds' war for the towns, its titles, its ribbon, its reset; Season 0 the beta, wiped at its end.
//   - THE FESTIVAL (net/festivalLaw.js FESTIVALS - the real calendar): the Witches' Festival and its Starfall.
// Words through the text core (L10N4), read when built; every name a player reads in their own language (AUDIT
// SEASON-BOOK W1: the seats' Season by the months' own table, never townSeatLaw's English).
import { arenaSeasonOf, arenaSeasonDay, arenaSeasonEndsS, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../net/arena/arenaLaw.js';
import { seasonOf, seatWeekOf, seatWeekStartMs, seatSeasonName } from '../net/townSeatLaw.js';
import { festivalAt, festivalNext } from '../net/festivalLaw.js';
import { monthNames } from './gameDate.js';
import { t } from './textManager.js';

/** The realm's season in days (eight weeks). */
export const SEASON_BOOK_DAYS = ARENA_SEASON_S / 86_400;
/** A champion's title asks this much of the board's leader - the Arena's, Iliac Hand's and the Gambit's laws alike
 *  (ARENA_CHAMPION_MIN_BOUTS, server-account's ILIAC_CHAMPION_MIN_GAMES and GAMBIT_CHAMPION_MIN_GAMES and their FOES -
 *  test/ui/enhanced/seasonbook.test.js holds all three to these). Spire Champion is not one of them (AUDIT SEASON-BOOK L1). */
export const SEASON_TITLE_GAMES = 10;
export const SEASON_TITLE_FOES = 5;

/** THE SEASON at `nowMs` (the relay's clock): `{ n, day, days, startMs, endMs }`. AUDIT SEASON-BOOK L10: before the
 *  epoch (or with no clock) the arena's day would wrap round while its season held at 1 - the day holds at 1 with it. */
export function realmSeasonAt(/** @type {number} */ nowMs) {
  const s = Math.floor(nowMs / 1000), n = arenaSeasonOf(s);
  const day = Number.isFinite(s) && s >= ARENA_SEASON_EPOCH_S ? arenaSeasonDay(s) : 1;
  return { n, day, days: SEASON_BOOK_DAYS, startMs: (ARENA_SEASON_EPOCH_S + (n - 1) * ARENA_SEASON_S) * 1000, endMs: arenaSeasonEndsS(n) * 1000 };
}

/** THE SEATS' SEASON at `nowMs`, Season 0 at seat week `zero` (the service's - net/townSeatBook.js `zero`): `{ n, week,
 *  weeks, endMs, trial, month, numeral }` (`week` 1-based, `trial` Season 0's, `month` the index of the month it is named
 *  for and `numeral` its round past the first - "II" - or null), or null - the seats shut to the account, or no Season. */
export function seatSeasonAt(/** @type {number} */ nowMs, /** @type {number|null} */ zero, open = true) {
  if (!open || zero == null) return null;
  const week = seatWeekOf(nowMs), s = seasonOf(week, zero);
  if (!s) return null;
  const numeral = / ([IVXLCDM]+)$/.exec(seatSeasonName(s.n) ?? '')?.[1] ?? null;
  return { n: s.n, week: week - s.start + 1, weeks: s.end - s.start, endMs: seatWeekStartMs(s.end), trial: s.n === 0, month: s.n > 0 ? (s.n - 1) % 12 : null, numeral };
}
/** A seats' Season's name in the player's language: "Season 0", else "Season of Morning Star" by the months' own table
 *  (gameDate.js monthNames - townSeatLaw.js seatSeasonName's order), its round's numeral after it. */
export function seatSeasonTitle(/** @type {{ trial: boolean, month: number|null, numeral: string|null }} */ seat) {
  if (seat.trial || seat.month == null) return t('season.book.seats.zero', 'Season 0');
  const month = `${monthNames()[seat.month] ?? ''}${seat.numeral ? ` ${seat.numeral}` : ''}`;
  return t('season.book.seats.named', 'Season of {month}', { month });
}

/** A board's standing line: `b` its read as the window shows it (scenes/seasonBookHost.js - `{ state: 'asking' | 'ok' |
 *  'failed', data }`), `line` its own line off the answer's data. A guest and no one signed in are told what ranks them
 *  (AUDIT SEASON-BOOK R4/L4: every board answers a guest's `me`, and no guest's game is ever kept); null where there is no
 *  read (a host that hands none, an arena not live - R7). */
function boardLine(/** @type {any} */ src, /** @type {any} */ b, /** @type {(data: any) => string|null} */ line) {
  if (src?.guest) return t('season.book.guest', 'Add a username to be ranked.');
  if (src?.signedIn === false) return t('season.book.signin', 'Sign in to be ranked.');
  if (!b) return null;
  if (b.state === 'asking') return t('season.book.asking', 'Reading the board...');
  if (b.state !== 'ok' || !b.data) return t('season.book.unread', 'The board can\'t be read right now.');
  return line(b.data) ?? t('season.book.signin', 'Sign in to be ranked.');
}

/** THE ARENA'S LINE: the season rating and rank, and the points this player has given their banner - `board` the arena's
 *  board (arenaOnline.board). AUDIT SEASON-BOOK L2/W3: `me.points` is the player's own, as the Arena says it ("You have N
 *  points this season") - never the banner's total. W2: every number as the boards print it, ungrouped. */
export function arenaStanding(/** @type {any} */ board) {
  const me = board?.me;
  if (!me) return null;
  const rating = Number(me.pvp?.rating) || 0, bouts = (Number(me.pvp?.wins) || 0) + (Number(me.pvp?.losses) || 0) + (Number(me.pvp?.draws) || 0);
  const line = !bouts ? t('season.book.arena.none', 'Rating {rating} - no rated bouts yet', { rating })
    : Number.isSafeInteger(me.rank) && me.rank > 0 ? t('season.book.arena.ranked', '#{rank} - rating {rating}', { rank: me.rank, rating })
      : t('season.book.arena.rated', 'Rating {rating}', { rating });
  const banner = me.banner === 'red' ? t('season.book.arena.red', 'Red Banner') : me.banner === 'blue' ? t('season.book.arena.blue', 'Blue Banner') : null;
  return banner ? t('season.book.arena.withBanner', '{line} - {points, plural, one {# point} other {# points}} for the {banner}', { line, banner, points: Number(me.points) || 0 }) : line;
}
/** THE SPIRE'S LINE: the best Descent of the player's company this season (the board's `best` - the Spire's own window
 *  says it "Your best"; AUDIT SEASON-BOOK L3: a Descent, from Hall 1 - never the player's own deepest hall). */
export function spireStanding(/** @type {any} */ data) {
  const h = Number(data?.best?.h);
  return Number.isSafeInteger(h) && h > 0 ? t('season.book.spire.best', 'Your best Descent: Hall {hall}', { hall: h }) : t('season.book.spire.none', 'No Descent yet this season');
}
/** A CARD OR GAMBIT BOARD'S LINE (iliac.js iliacBoardOf, gambit.js gambitBoardOf - one shape): rank, rating, games. */
export function ladderStanding(/** @type {any} */ data) {
  const me = data?.me;
  if (!me) return null;
  const games = Number(me.games) || 0;
  if (!games) return t('season.book.ladder.none', 'No rated games yet');
  const mine = [...(Array.isArray(data.rows) ? data.rows : []), data.pinned].find((r) => r?.you);
  const args = { rating: Number(me.rating) || 0, games };
  return Number.isSafeInteger(mine?.rank) && mine.rank > 0 ? t('season.book.ladder.ranked', '#{rank} - rating {rating} - {games, plural, one {# game} other {# games}}', { rank: mine.rank, ...args })
    : t('season.book.ladder.rated', 'Rating {rating} - {games, plural, one {# game} other {# games}}', args);
}
/** THE SEA'S LINE: the captain's ledger's season figures (captainLedger.js `season`) - this season's alone. */
export function seaStanding(/** @type {any} */ figures, /** @type {number} */ n) {
  if (!figures || figures.n !== n || (!(figures.deepest > 0) && !(figures.legends > 0))) return t('season.book.sea.none', 'No voyage counted yet this season');
  return t('season.book.sea.figures', 'Deepest: {leagues, plural, one {# league} other {# leagues}} past the Veil - {legends, plural, one {# legend} other {# legends}} ended', { leagues: Math.floor(figures.deepest) || 0, legends: Math.floor(figures.legends) || 0 });
}

/**
 * THE WINDOW'S MODEL. `src`:
 *   now        the relay's clock, ms
 *   seatsOpen  the seats open to the account; zero - Season 0's seat week (the hourglass's source carries both)
 *   boards     { arena, spire, iliac, gambit } - each `{ state, data }` or null (scenes/seasonBookHost.js); absent: no reads
 *   signedIn   false - no one signed in; guest - a guest's session (both: ranked by nothing here)
 *   sea        the ledger's season figures, or null
 *   doors      { arena, spire } - whether each row's door stands
 * Answers `{ sections: [{ id, title, sub, at, atLabel, lead, rows: [{ id, name, about, standing, door }], foot }] }` -
 * `at` the moment its countdown counts to (ms), `door` a door's id or null.
 */
export function seasonBookModel(/** @type {any} */ src) {
  const now = Number(src?.now) || 0;
  const sections = [];
  const realm = realmSeasonAt(now);
  const b = src?.boards ?? {};
  sections.push({
    id: 'realm',
    title: t('season.book.realm.title', 'Season {n}', { n: realm.n }),
    sub: t('season.book.realm.sub', 'Day {day} of {days}', { day: realm.day, days: realm.days }),
    at: realm.endMs, atLabel: 'ends',
    lead: t('season.book.realm.lead', 'Every board here starts fresh each season.'),
    rows: [
      { id: 'arena', name: t('season.book.arena.name', 'The Arena'),
        about: t('season.book.arena.about', 'Rated bouts set your season rating. The leader wears Arena Champion, and the banner with more points wears the laurel next season.'),
        standing: boardLine(src, b.arena, arenaStanding), door: src?.doors?.arena && !src?.guest ? 'arena' : null },
      { id: 'spire', name: t('season.book.spire.name', 'The Spire'),
        about: t('season.book.spire.about', 'Each bracket ranks companies by their deepest Descent from Hall 1. The top ten are Spire Champions next season. A new season lets you start from half your deepest Redoubt.'),
        standing: boardLine(src, b.spire, spireStanding), door: src?.doors?.spire ? 'spire' : null },
      { id: 'iliac', name: t('season.book.iliac.name', 'Iliac Hand'),
        about: t('season.book.iliac.about', 'Rated games at the card table. The leader wears Iliac Champion.'),
        standing: boardLine(src, b.iliac, ladderStanding), door: null },
      { id: 'gambit', name: t('season.book.gambit.name', 'The King\'s Gambit'),
        about: t('season.book.gambit.about', 'Rated games between registered accounts. The leader wears Grandmaster.'),
        standing: boardLine(src, b.gambit, ladderStanding), door: null },
      { id: 'sea', name: t('season.book.sea.name', 'The season\'s captains'),
        about: t('season.book.sea.about', 'The deepest voyage past the Veil and the most legends sunk or taken, on the board at any freeport\'s harbormaster.'),
        standing: src?.boards ? seaStanding(src.sea, realm.n) : null, door: null },
    ],
    // AUDIT SEASON-BOOK L1/W4: the three titles the rule is theirs, by name - Spire Champion is the top ten's, above
    foot: t('season.book.realm.foot', 'Arena Champion, Iliac Champion and Grandmaster are worn by the leader, once they have {games} rated bouts or games against {foes} different opponents.', { games: SEASON_TITLE_GAMES, foes: SEASON_TITLE_FOES }),
  });
  const seat = seatSeasonAt(now, src?.zero ?? null, !!src?.seatsOpen);
  if (seat) {
    sections.push({
      id: 'seats',
      title: t('season.book.seats.title', 'The Seats: {name}', { name: seatSeasonTitle(seat) }),
      sub: t('season.book.seats.sub', 'Week {week} of {weeks}', { week: seat.week, weeks: seat.weeks }),
      at: seat.endMs, atLabel: 'ends',
      lead: seat.trial
        ? t('season.book.seats.trialLead', 'Season 0 is the beta. When it ends, the seats\' war is wiped and no one is crowned. Silver, the Stores and your professions stay.')
        : t('season.book.seats.lead', 'The guilds\' war for the towns. A Season ends at its last Sunday Turning.'),
      rows: [
        ...(seat.trial ? [] : [
          { id: 'crowns', name: t('season.book.crowns.name', 'Crowns and keepers'),
            about: t('season.book.crowns.about', 'Each crown\'s guildmaster earns Crowned in Season {n}. The guildmaster of a guild that holds a seat all Season earns Keeper of its town.', { n: seat.n }) },
          { id: 'ribbon', name: t('season.book.ribbon.name', 'The banner ribbon'),
            about: t('season.book.ribbon.about', 'Members of a guild that kept a seat all Season wear its ribbon through the next.') },
          { id: 'reset', name: t('season.book.reset.name', 'The turn of the Season'),
            about: t('season.book.reset.about', 'Standing drifts halfway back to 50 and every fortification loses a tier. Charters stand.') },
        ]),
        { id: 'tides', name: t('season.book.tides.name', 'Tides'),
          about: t('season.book.tides.about', 'Each week every kingdom, the Marches and the Free Lands draw a Tide - a harvest, a plague, raiders - or stay Calm.') },
        { id: 'chapters', name: t('season.book.chapters.name', 'Guild chapters'),
          about: t('season.book.chapters.about', 'Every chapter draws an event when the Season opens. In a Schism or a Succession, members back a side.') },
      ].map((r) => ({ ...r, standing: null, door: null })),
      foot: t('season.book.seats.foot', 'The Notice Board\'s Seat tab has the week\'s standings.'),
    });
  }
  const fest = festivalNext(now), open = festivalAt(now);
  if (fest) {
    sections.push({
      id: 'festival',
      title: t('season.book.festival.title', 'The Witches\' Festival'),
      sub: open ? t('season.book.festival.open', 'On now') : t('season.book.festival.coming', 'Coming'),
      at: open ? fest.toMs : fest.fromMs, atLabel: open ? 'ends' : 'opens',
      lead: null,   // AUDIT SEASON-BOOK W5: its days are the real calendar's, its nights the sky's - each row says which
      rows: [
        { id: 'cakes', name: t('season.book.cakes.name', 'Soul Cakes'),
          about: t('season.book.cakes.about', 'Found on foes, the dead and the summoned most often, and in gathering, crafting, looting and at sea. Spend them with the Wyrd Sister outside any tavern. Finds count double on 31 October (UTC) and on in-game nights the dead walk.') },
        { id: 'starfall', name: t('season.book.starfall.name', 'The Starfall'),
          about: t('season.book.starfall.about', 'Every in-game night, about once a real hour, one coven pulls three stars down near its region\'s towns. Hold the crater against the waves.') },
      ].map((r) => ({ ...r, standing: null, door: null })),
      // AUDIT SEASON-BOOK L4: the festival is shut to a guest (festivalClient.js festivalShut) - said, never implied
      foot: src?.guest ? t('season.book.festival.guest', 'Add a username to join the festival.')
        : src?.signedIn === false ? t('season.book.festival.signin', 'Sign in to join the festival.') : null,
    });
  }
  return { sections };
}
