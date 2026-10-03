// @ts-check
// ARENA3 (2026-10-02, Mac: "join a team (red and blue) and climb esclating tiers of opponents"; "Joining a team comes
// with it's own enhanced UI where you can view your ranking and even player leaderboards"; "Being a top rank PvE fighter
// comes with it's own title"): THE BANNERS AND THEIR SEASON, offline. Design: bible/11-Multiplayer/Arena.md "3. The
// teams", "5. The Arena window", "6. Titles and the laurel".
//
// TWO COMPANIES - the Red Banner and the Blue Banner. Joining is at their recruiters at the gate, free; CHANGING COSTS A
// SEASON - a fighter may quit at once, and may join THE OTHER only when the next season opens (rejoining the banner you
// quit is no change). A banner gives its colours on your ladder bouts (the versus bar's mark), TEAM POINTS (a ladder
// bout won 1, a tier champion beaten 3, the Grand Champion beaten 10 - a refereed PvP win's 2 is ARENA4's) and, to the
// banner with more points when the SEASON closes, THE LAUREL for the next season: the crowd favours its fighters at the
// start of every bout.
//
// THE SEASON offline is the game's year (Daggerfall's 360 days; the online 8 weeks are ARENA4's): its number the year
// (3E 405), its day the day of the year. The season rolls over on the first read past its end (`rollLeague`): the
// standings closed (the AI roster's whole season and the player's points), the winner kept for the Team board and the
// Hall of Champions, the laurel handed on.
//
// THE ROSTER. Each banner fields ROSTER_PER_BANNER fighters a season - Daggerfall's own classes, named by the bout
// names' own law (systems/arenaFighters.js fighterIdentity: DFU's NameHelper over their home's bank on a seeded DFRandom
// stream) - and each climbs the same ten tiers the player climbs (systems/arenaLadder.js), one bout every few days, won
// or lost by their talent against the tier: `leagueRoster(season, day)` is the season's every fighter on its day,
// computed from the season alone, so the same day is the same board on every screen and at every load. The roster is
// the leaderboards' field, the banners' points, and the Grand Champions the Hall cuts in its wall.
//
// THE SAVE: `arenaLeagueSnapshot` / `arenaLeagueRestore` (systems/save.js `arenaLeague`), versioned (`v`); any older or
// broken shape reads back to a fighter of no banner. Pure: the game minute is handed to every call that reads the
// calendar. Not a DFU member. Ledger A (ARENA).

import { MOBILE_TYPES as M } from '../characters/mobileTypes.js';
import { dateFromClassicMinutes, dayOfYearFromMinutes, DAYS_PER_YEAR } from './gameDate.js';
import { LADDER_TIERS, BOUTS_PER_TIER, arenaHash, seededRng } from './arenaLadder.js';
import { fighterIdentity } from './arenaFighters.js';
import { ARENA_TEXT } from './arenaText.js';
import { bookRestore, newArenaBook } from './arenaBook.js';

/** The save shape's version. */
export const ARENA_LEAGUE_VERSION = 1;
/** The two banners, in the order they are always read. */
export const BANNERS = Object.freeze(['red', 'blue']);
/** TEAM POINTS (the design's): a ladder bout won, a tier champion beaten, the Grand Champion beaten. */
export const TEAM_POINTS = Object.freeze({ bout: 1, champion: 3, grand: 10 });
/** The crowd's favour at the start of a bout for a fighter who wears the laurel (systems/arenaCrowd.js newCrowd). */
export const LAUREL_FAVOUR = 0.25;
/** How many bouts the Records page keeps, and how many closed seasons the Team board keeps. */
export const BOUTS_KEPT = 20;
export const SEASONS_KEPT = 12;
/** The roster: fighters a banner fields in a season. */
export const ROSTER_PER_BANNER = 24;
/** The classes a banner recruits (Daggerfall's own class enemies, MobileTypes 128-145). */
export const ROSTER_CLASSES = Object.freeze([
  M.Mage, M.Spellsword, M.Battlemage, M.Sorcerer, M.Healer, M.Nightblade, M.Bard, M.Burglar, M.Rogue, M.Acrobat,
  M.Thief, M.Assassin, M.Monk, M.Archer, M.Ranger, M.Barbarian, M.Warrior, M.Knight,
]);

const isBanner = (b) => b === 'red' || b === 'blue';
const int = (v, lo, hi, d = lo) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const intOrNull = (v, lo = 0, hi = 1e12) => (v == null || !Number.isFinite(Number(v)) ? null : int(v, lo, hi));
const str = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

// ── THE CALENDAR ─────────────────────────────────────────────────────────────────────────────────────────────
/** The season a game minute falls in - the year of Daggerfall's calendar (3E 405 at a new game). */
export const seasonOf = (gameMinutes) => dateFromClassicMinutes(Math.max(0, Math.floor(Number(gameMinutes) || 0))).year;
/** The day of its season, 1..360. */
export const seasonDayOf = (gameMinutes) => dayOfYearFromMinutes(Math.max(0, Math.floor(Number(gameMinutes) || 0)));
/** The other banner. */
export const otherBanner = (b) => (b === 'red' ? 'blue' : 'red');

// ── THE SAVE ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A fighter of no banner, who has fought nothing. */
export function newArenaLeague() {
  return {
    v: ARENA_LEAGUE_VERSION, since: null, season: null, team: null, joinedAt: null, left: null,
    points: { red: 0, blue: 0 }, laurel: null, seasons: [], bouts: [], firstBoutAt: null, grandAt: null,
    book: newArenaBook(),
  };
}
/** Any shape back to a whole league record (a save from before ARENA3, a hand-edited one). */
export function arenaLeagueRestore(raw) {
  const L = newArenaLeague();
  if (!raw || typeof raw !== 'object') return L;
  L.since = intOrNull(raw.since, 0, 1e6);
  L.season = intOrNull(raw.season, 0, 1e6);
  L.team = isBanner(raw.team) ? raw.team : null;
  L.joinedAt = intOrNull(raw.joinedAt);
  L.left = raw.left && isBanner(raw.left.banner) && Number.isFinite(Number(raw.left.season)) ? { banner: raw.left.banner, season: int(raw.left.season, 0, 1e6) } : null;
  L.points = { red: int(raw.points?.red, 0, 1e9), blue: int(raw.points?.blue, 0, 1e9) };
  L.laurel = raw.laurel && isBanner(raw.laurel.banner) && Number.isFinite(Number(raw.laurel.season)) ? { banner: raw.laurel.banner, season: int(raw.laurel.season, 0, 1e6) } : null;
  L.seasons = (Array.isArray(raw.seasons) ? raw.seasons : []).slice(0, SEASONS_KEPT).filter((s) => s && Number.isFinite(Number(s.season))).map((s) => ({
    season: int(s.season, 0, 1e6), red: int(s.red, 0, 1e9), blue: int(s.blue, 0, 1e9),
    winner: isBanner(s.winner) ? s.winner : null, mine: isBanner(s.mine) ? s.mine : null, gave: int(s.gave, 0, 1e9),
  }));
  L.bouts = (Array.isArray(raw.bouts) ? raw.bouts : []).slice(0, BOUTS_KEPT).filter((b) => b && typeof b === 'object').map((b) => ({
    at: int(b.at, 0, 1e12), tier: int(b.tier, 0, LADDER_TIERS.length - 1), label: str(b.label), opp: str(b.opp, 120),
    won: b.won === true, how: str(b.how, 12), purse: int(b.purse, 0, 1e9), team: isBanner(b.team) ? b.team : null,
    champion: b.champion === true, grand: b.grand === true, points: int(b.points, 0, 100),
  }));
  L.firstBoutAt = intOrNull(raw.firstBoutAt);
  L.grandAt = intOrNull(raw.grandAt);
  L.book = bookRestore(raw.book);
  return L;
}
/** The league as the save writes it (a copy). */
export function arenaLeagueSnapshot(L) {
  const s = arenaLeagueRestore(L);
  return JSON.parse(JSON.stringify(s));
}

// ── THE SEASON ROLLS ─────────────────────────────────────────────────────────────────────────────────────────
/** The two banners' points at the close of `season`, the player's `extra` added (`{ red, blue }`). */
export function seasonFinal(season, extra = { red: 0, blue: 0 }) {
  const t = rosterTotals(season, DAYS_PER_YEAR);
  return { red: t.red + (extra.red | 0), blue: t.blue + (extra.blue | 0) };
}
const winnerOf = (s) => (s.red > s.blue ? 'red' : s.blue > s.red ? 'blue' : null);

/**
 * THE LEAGUE ON ITS DAY: the record rolled forward to the season `gameMinutes` falls in - each season passed CLOSED
 * (its standings with the player's points in it, its winner, which banner the player wore at its close), the laurel
 * handed to the banner that won the season just closed (worn by the player if they wore it then and still do), the
 * player's points begun again. The first read stamps `since` (the Hall's first season). A new record when it moved;
 * the same one when it did not.
 */
export function rollLeague(raw, gameMinutes) {
  const now = seasonOf(gameMinutes);
  if (raw && raw.season === now && raw.since != null && raw.v === ARENA_LEAGUE_VERSION) return raw;
  const L = arenaLeagueRestore(raw);
  if (L.since == null) L.since = L.season ?? now;
  if (L.season == null) { L.season = now; return L; }
  if (L.season >= now) { L.season = now; return L; }
  // close every season between: the first with the player's points, the rest the roster's alone
  let laurel = null;
  for (let s = L.season; s < now; s++) {
    const first = s === L.season;
    const fin = seasonFinal(s, first ? L.points : { red: 0, blue: 0 });
    const winner = winnerOf(fin);
    const gave = first ? L.points.red + L.points.blue : 0;
    L.seasons.unshift({ season: s, red: fin.red, blue: fin.blue, winner, mine: L.team, gave });
    laurel = winner ? { banner: winner, season: s + 1 } : null;
  }
  L.seasons = L.seasons.slice(0, SEASONS_KEPT);
  L.laurel = laurel && laurel.season === now ? laurel : null;
  L.points = { red: 0, blue: 0 };
  L.season = now;
  return L;
}
/** Whether the player wears the laurel now: their banner won the season just closed. */
export const laurelWorn = (L, gameMinutes) => {
  const s = rollLeague(L, gameMinutes);
  return !!s.team && !!s.laurel && s.laurel.season === s.season && s.laurel.banner === s.team;
};
/** The banner whose fighters wear the laurel this season (the last season's winner), or null. */
export const laurelBanner = (L, gameMinutes) => {
  const s = rollLeague(L, gameMinutes);
  return s.laurel && s.laurel.season === s.season ? s.laurel.banner : null;
};

// ── JOINING AND QUITTING ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Why `banner` will not take the player now, or null: 'already' (they wear it), 'other' (they wear the other - quit it
 * first), 'season' (they quit the other this season - changing costs a season), 'banner' (no such banner).
 */
export function joinRefusal(L, banner, gameMinutes) {
  if (!isBanner(banner)) return 'banner';
  const s = rollLeague(L, gameMinutes);
  if (s.team === banner) return 'already';
  if (s.team) return 'other';
  if (s.left && s.left.banner !== banner && s.left.season >= s.season) return 'season';
  return null;
}
/** JOIN `banner`: `{ ok, league, reason }` - a new record (the old one untouched). */
export function joinBanner(L, banner, gameMinutes) {
  const reason = joinRefusal(L, banner, gameMinutes);
  const s = arenaLeagueRestore(rollLeague(L, gameMinutes));
  if (reason) return { ok: false, league: s, reason };
  s.team = /** @type {'red'|'blue'} */ (banner);
  s.joinedAt = Math.max(0, Math.floor(Number(gameMinutes) || 0));
  s.left = null;
  return { ok: true, league: s, reason: null };
}
/** QUIT the banner worn: `{ ok, league, reason }` ('none' - no banner to quit). The points given stay the banner's. */
export function quitBanner(L, gameMinutes) {
  const s = arenaLeagueRestore(rollLeague(L, gameMinutes));
  if (!s.team) return { ok: false, league: s, reason: 'none' };
  s.left = { banner: s.team, season: s.season ?? seasonOf(gameMinutes) };
  s.team = null;
  s.joinedAt = null;
  return { ok: true, league: s, reason: null };
}

// ── A BOUT RECORDED ──────────────────────────────────────────────────────────────────────────────────────────
/** The points a won ladder bout gives the banner worn. */
export const boutPoints = ({ won, champion = false, grand = false }) => (!won ? 0 : grand ? TEAM_POINTS.grand : champion ? TEAM_POINTS.champion : TEAM_POINTS.bout);
/**
 * A LADDER BOUT'S END in the league: kept for the Records page (the newest first, BOUTS_KEPT of them), its points
 * given to the banner worn, the first bout's and the Grand Champion's minute stamped (the fastest Grand Champion's
 * board). `o` `{ gameMinutes, tier, label, opp, won, how, purse, champion, grand }`. A new record.
 */
export function leagueAfterBout(L, o) {
  const gm = Math.max(0, Math.floor(Number(o.gameMinutes) || 0));
  const s = arenaLeagueRestore(rollLeague(L, gm));
  const pts = s.team ? boutPoints(o) : 0;
  if (s.team && pts) s.points[s.team] += pts;
  s.bouts.unshift({
    at: gm, tier: int(o.tier, 0, LADDER_TIERS.length - 1), label: str(o.label), opp: str(o.opp, 120), won: !!o.won,
    how: str(o.how, 12), purse: int(o.purse, 0, 1e9), team: s.team, champion: !!o.champion, grand: !!o.grand, points: pts,
  });
  s.bouts = s.bouts.slice(0, BOUTS_KEPT);
  if (s.firstBoutAt == null) s.firstBoutAt = gm;
  if (o.won && o.grand && s.grandAt == null) s.grandAt = gm;
  return s;
}

// ── THE ROSTER ───────────────────────────────────────────────────────────────────────────────────────────────
/** The skill a talent of 1 brings to the ladder, in tiers; how steeply a tier above it is lost. */
const SKILL_TIERS = 10;
const SKILL_SLOPE = 1.3;
/** A fighter's chance against the next bout of `tier` (`champion` its champion; the last tier's is the Grand
 *  Champion, a little harder still). Pure. */
export function rosterWinChance(talent, tier, champion) {
  const diff = tier + (champion ? 0.6 : 0) + (champion && tier === LADDER_TIERS.length - 1 ? 0.4 : 0);
  const p = 1 / (1 + Math.exp((diff - talent * SKILL_TIERS) * SKILL_SLOPE));
  return Math.max(0.04, Math.min(0.96, p));
}

/** One roster fighter's who-and-how for `season`, slot `i` (even slots Red, odd Blue). */
function rosterEntrant(season, i) {
  const seed = arenaHash(season, 0x4c00 + i);
  const rng = seededRng(seed);
  const banner = i % 2 === 0 ? 'red' : 'blue';
  const mobile = ROSTER_CLASSES[Math.floor(rng() * ROSTER_CLASSES.length)];
  const who = fighterIdentity(seed, i, mobile);
  // talent: most fighters are middling, a few are great (the season's Grand Champions come from them)
  const talent = 0.2 + 0.8 * rng() ** 1.6;
  const pace = 0.05 + rng() * 0.09;   // bouts a day - a fighter heals and trains between
  const start = Math.floor(rng() * 24);   // the day of the season they first fight
  return { id: `s${season}:${i}`, slot: i, seed, banner, mobile, name: who.name, home: who.home, epithet: who.epithet, talent, pace, start };
}
/** One fighter's season up to `day`: their ladder, their record, their points. */
function rosterClimb(e, day) {
  const rng = seededRng(arenaHash(e.seed, 0x51));
  let tier = 0, won = 0, wins = 0, losses = 0, points = 0, champs = 0, grandDay = null;
  const n = day < e.start ? 0 : Math.floor((day - e.start) * e.pace) + 1;
  for (let k = 0; k < n && grandDay == null; k++) {
    const champion = won >= BOUTS_PER_TIER;
    if (rng() < rosterWinChance(e.talent, tier, champion)) {
      wins++;
      if (!champion) { won++; points += TEAM_POINTS.bout; continue; }
      champs++;
      if (tier === LADDER_TIERS.length - 1) { points += TEAM_POINTS.grand; grandDay = Math.min(DAYS_PER_YEAR, e.start + Math.ceil(k / e.pace)); } else { points += TEAM_POINTS.champion; tier++; won = 0; }
    } else losses++;
  }
  return { tier, won, wins, losses, points, champs, grandDay, grand: grandDay != null };
}
const _entrants = new Map();
/** The season's entrants (named once a season - the name stream is DFRandom's). */
function entrantsOf(season) {
  let list = _entrants.get(season);
  if (!list) {
    list = Array.from({ length: ROSTER_PER_BANNER * 2 }, (_, i) => rosterEntrant(season, i));
    if (_entrants.size > 16) _entrants.clear();
    _entrants.set(season, list);
  }
  return list;
}
const _roster = new Map();
/**
 * THE ROSTER of `season` on its `day` (1..360): every fighter of both banners - `{ id, banner, name, home, epithet,
 * mobile, tier, won, wins, losses, points, champs, grand, grandDay, days, title }` (`title` the highest the ladder gave
 * them, `days` the days they took to the Grand Champion). Pure, cached by season and day.
 */
export function leagueRoster(season, day) {
  const d = Math.max(0, Math.min(DAYS_PER_YEAR, Math.floor(day)));
  const key = `${season}:${d}`;
  const hit = _roster.get(key);
  if (hit) return hit;
  const rows = entrantsOf(season).map((e) => {
    const c = rosterClimb(e, d);
    const title = c.grand ? ARENA_TEXT.titles[LADDER_TIERS.length - 1] : c.champs ? ARENA_TEXT.titles[c.champs - 1] : null;
    return Object.freeze({ id: e.id, banner: e.banner, name: e.name, home: e.home, epithet: e.epithet, mobile: e.mobile, ...c, title, days: c.grand ? c.grandDay - e.start : null, season });
  });
  const out = Object.freeze(rows);
  if (_roster.size > 64) _roster.clear();
  _roster.set(key, out);
  return out;
}
/** The roster's points by banner on `day`. */
export function rosterTotals(season, day) {
  const t = { red: 0, blue: 0 };
  for (const f of leagueRoster(season, day)) t[f.banner] += f.points;
  return t;
}

/** THE STANDINGS NOW: `{ season, day, red, blue, leader, mine }` - the roster's points and the player's this season. */
export function leagueStandings(L, gameMinutes) {
  const s = rollLeague(L, gameMinutes);
  const day = seasonDayOf(gameMinutes);
  const t = rosterTotals(s.season, day);
  const red = t.red + s.points.red, blue = t.blue + s.points.blue;
  return { season: s.season, day, red, blue, leader: winnerOf({ red, blue }), mine: s.team, given: s.team ? s.points[s.team] : 0, points: { ...s.points } };
}

/** Every Grand Champion of the roster this save has seen (from `since` to now), the newest season first - the Hall's
 *  wall. `[{ season, name, home, banner, days }]`. */
export function rosterGrandChampions(L, gameMinutes) {
  const s = rollLeague(L, gameMinutes);
  const out = [];
  const from = s.since ?? s.season;
  for (let season = s.season; season >= from && season > s.season - 40; season--) {
    const day = season === s.season ? seasonDayOf(gameMinutes) : DAYS_PER_YEAR;
    const g = leagueRoster(season, day).filter((f) => f.grand).sort((a, b) => a.grandDay - b.grandDay);
    for (const f of g) out.push({ season, name: f.name, home: f.home, banner: f.banner, days: f.days, grandDay: f.grandDay });
  }
  return out;
}
