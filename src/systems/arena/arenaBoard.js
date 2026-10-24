// @ts-check
// ARENA3 (2026-10-02, Mac: "Joining a team comes with it's own enhanced UI where you can view your ranking and even
// player leaderboards"; "extremely detailed and authentic"): WHAT THE ARENA WINDOW SAYS - every page of it, as data,
// built from the save (the ladder, the league and its book), the game's clock and the gate's state. The window
// (ui/arena/arenaWindow.js) draws these and asks the host to act; nothing here touches a door. Design:
// bible/11-Multiplayer/Arena.md "5. The Arena window" - Bouts, Ladder, Team, Leaderboards, Records, Rules.
//
// ARENA4b: online the account is the record and the realm the field - the Records page is the account's
// (`recordsPageOnline`, the board's `me.record` and `me.recent`), the fastest Grand Champions each in their own season,
// the realm's Hall of Champions on the Leaderboards page (`hallBoardOnline`) and on the Keeper's wall (`hallLinesOnline`),
// and before the board is in the ladder's Fight waits for the account's climb.
//
// Pure. Not a DFU member. Ledger A (ARENA).

import { ARENA_TEXT } from './arenaText.js';
import {
  LADDER_TIERS, BOUTS_PER_TIER, BOUT_PURSE, CHAMPION_PURSE, EXHIBITION_HOURS, arenaLadderRestore, nextLadderBout, ladderTitle,
  ladderTitles, exhibitionFor, hourIndexOf, hallOfChampions,
} from './arenaLadder.js';
import { fighterIdentity } from './arenaFighters.js';
import {
  rollLeague, leagueStandings, leagueRoster, laurelWorn, laurelBanner, rosterGrandChampions, seasonDayOf, BANNERS,
  seasonOf,   // ARENA5: the season this save's own Grand Champion took the title in, for the Hall's plaque
} from './arenaLeague.js';
import { exhibitionCard, bookLines } from './arenaBook.js';
import { enemyDisplayName, ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { dateFromClassicMinutes, monthNames, MINUTES_PER_DAY } from '../gameDate.js';   // L10N3e: the month in the player's language
import { arenaSeasonOf, arenaSeasonDay } from '../../net/arena/arenaLaw.js';   // ARENA4b: the realm's season a row was taken in
import { arenaReplaysRestore } from './arenaReplay.js';   // ARENA5: the Records page's Watch the replay

/** The window's pages, in their order on the tab bar. */
export const ARENA_PAGES = Object.freeze(['bouts', 'ladder', 'team', 'boards', 'records', 'rules']);
/** The leaderboards' boards, in their order. */
export const ARENA_BOARDS = Object.freeze(['pve', 'fast', 'pvp', 'team']);
/** How many rows a board shows before the player's own is pinned under it. */
export const BOARD_TOP = 10;
/** A fighter may be sent onto the sand with this share of their health (systems/arena/arenaHerald.js FIGHT_HEALTH_MIN). */
const FIT = 0.5;

const W = () => ARENA_TEXT.window;
const T = () => ARENA_TEXT.teams;
/** "Thief, level 1" - a ladder opponent as the window bills it before the bout names them. */
export function opponentLine(list) {
  const one = (o) => {
    const kind = enemyDisplayName(o.mobile) ?? W().fighter;
    const lvl = o.level ?? ENEMY_BASICS[o.mobile]?.level ?? null;
    return lvl ? W().opponent(kind, lvl) : kind;
  };
  return list.map(one).join(W().and);
}
/** A game minute as the window dates it: "14 First Seed, 3E 405". */
export function arenaDate(gameMinutes) {
  const d = dateFromClassicMinutes(Math.max(0, Math.floor(Number(gameMinutes) || 0)));
  return `${d.day + 1} ${monthNames()[d.month]}, 3E ${d.year}`;
}
const hh = (h) => `${String(h % 24).padStart(2, '0')}:00`;

/**
 * THE HEADER: who the arena calls you, your banner and laurel, the season's day, your record and purse.
 * @param {{ ladder: any, league: any, gameMinutes: number, name: string }} o
 */
export function arenaHeader({ ladder, league, gameMinutes, name }) {
  const L = arenaLadderRestore(ladder);
  const G = rollLeague(league, gameMinutes);
  const st = leagueStandings(G, gameMinutes);
  return {
    name: name || W().you, title: ladderTitle(L), banner: G.team, laurel: laurelWorn(G, gameMinutes),
    season: W().seasonLine(st.season, st.day), record: W().recordLine(L.record.wins, L.record.losses), purses: L.record.purses,
    owed: G.book?.owed ?? 0,
  };
}

// ── BOUTS ────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE BOUTS PAGE: the exhibition of the hour (or the next one), the bouts between players (online), and your next
 * ladder bout - each a card with its fighters, their records and the odds, and its presses (Watch, Wager, Fight) with
 * why not where one cannot be pressed.
 * @param {{ ladder: any, league: any, gameMinutes: number, atGate?: boolean, onSand?: ({a:string,b:string}|null),
 *   healthShare?: number, gold?: number, liveHour?: number|null, begun?: boolean }} o `liveHour` the hour whose exhibition stands
 *   on the sand here, `begun` whether its fight has begun (the book shuts at the word)
 */
export function boutsPage({ ladder, league, gameMinutes, atGate = false, onSand = null, healthShare = 1, gold = 0, liveHour = null, begun = false }) {
  const cards = [];
  const gm = Math.max(0, Math.floor(Number(gameMinutes) || 0));
  // THE EXHIBITION: this hour's while it may still be watched, else the next hour that holds one
  let ex = exhibitionFor(gm);
  const now = !!ex && (ex.open || liveHour === ex.hour);
  if (!now) {
    let h = hourIndexOf(gm) + 1;
    for (let k = 0; k < 48 && !EXHIBITION_HOURS.includes(h % 24); k++) h++;
    ex = exhibitionFor(h * 60);
  }
  if (ex) {
    const book = exhibitionCard(league, ex, gm, { gold, begun: now && begun, atGate });
    const fighters = ex.opponents.map((o, i) => {
      const who = fighterIdentity(ex.seed, i, o.mobile);
      return {
        name: who.name, billing: who.beast ? who.billing : `${who.home}, ${who.epithet}`, banner: i === 0 ? 'red' : 'blue',
        kind: opponentLine([o]), record: book.records[i], odds: book.odds[i], favourite: book.favourite === i,
      };
    });
    const at = hh(hourIndexOf(ex.startsAt));
    const watchWhy = !now ? W().whyNotYet(at) : !atGate ? W().whyGate : null;
    cards.push({
      key: 'exhibition', kind: 'exhibition', title: W().exhibitionTitle(at), state: now ? (liveHour === ex.hour || onSand ? W().onSand : W().openNow) : W().opensAt(at),
      tier: ARENA_TEXT.tiers[ex.tier], fighters, hour: ex.hour, beasts: !!ex.beasts,
      acts: [
        { act: 'watch', label: W().watch, why: watchWhy },
        { act: 'wager', label: W().wager, why: book.why },
      ],
      wager: book.wager, lines: book.lines, stakes: book.stakes,
    });
  }
  // THE PLAYERS' BOUTS: online (ARENA4) - said, never a hole
  cards.push({ key: 'players', kind: 'players', title: W().playersTitle, state: W().onlineOnly, fighters: [], acts: [], lines: [W().playersLine] });
  // THE LADDER'S NEXT
  const next = nextLadderBout(ladder);
  if (next) {
    const fit = healthShare >= FIT;
    const why = !atGate ? W().whyGate : !fit ? W().whyHurt : null;
    cards.push({
      key: 'ladder', kind: 'ladder', title: W().ladderTitle(next.tierName, next.label), state: next.grand ? W().grandBout : next.champion ? W().champBout : W().ladderBout,
      tier: next.tierName, fighters: [], opponents: opponentLine(next.opponents), purse: next.purse, beasts: next.beasts, free: next.free,
      acts: [{ act: 'fight', label: W().fight, why }], lines: [W().purseLine(next.purse)],
    });
  } else cards.push({ key: 'ladder', kind: 'ladder', title: W().ladderDoneTitle, state: ARENA_TEXT.titles[LADDER_TIERS.length - 1], fighters: [], acts: [], lines: [ARENA_TEXT.herald.ladderDone] });
  const owed = rollLeague(league, gm).book?.owed ?? 0;
  return { cards, owed, bookLines: bookLines(league, gm) };
}

// ── LADDER ───────────────────────────────────────────────────────────────────────────────────────────────────
/** THE LADDER PAGE: the ten tiers as a column - each its three bouts' opponents and its champion, what you have
 *  cleared, where you stand, the title it gives and its purses; and the next fight's purse. */
export function ladderPage({ ladder }) {
  const L = arenaLadderRestore(ladder);
  const next = nextLadderBout(L);
  const tiers = LADDER_TIERS.map((t, i) => {
    const cleared = L.champs[i] || (L.grand && i === LADDER_TIERS.length - 1);
    const current = !L.grand && L.tier === i;
    const state = cleared ? 'cleared' : current ? 'current' : i < L.tier ? 'cleared' : 'locked';
    const bouts = t.bouts.map((b, k) => ({ label: ARENA_TEXT.boutLabel(k + 1), opponents: opponentLine(b), won: state === 'cleared' || (current && L.won > k), next: !!next && current && !next.champion && next.bout === k }));
    return {
      n: i + 1, name: ARENA_TEXT.tiers[i], title: ARENA_TEXT.titles[i], state, beasts: !!t.beasts, free: !!t.free,
      bouts, champion: { label: i === LADDER_TIERS.length - 1 ? ARENA_TEXT.grandLabel : ARENA_TEXT.champLabel, opponents: opponentLine(t.champion), beaten: cleared, next: !!next && current && next.champion },
      purse: BOUT_PURSE[i], champPurse: CHAMPION_PURSE[i], won: current ? L.won : cleared ? BOUTS_PER_TIER : 0,
    };
  });
  return {
    tiers, current: L.grand ? LADDER_TIERS.length - 1 : L.tier, grand: L.grand, titles: ladderTitles(L),
    next: next ? { tier: next.tierName, label: next.label, purse: next.purse, opponents: opponentLine(next.opponents) } : null,
  };
}

// ── TEAM ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A roster row as a board shows it. */
const rosterRow = (f) => ({ id: f.id, name: f.name, home: f.home, banner: f.banner, title: f.title, tier: f.grand ? LADDER_TIERS.length : f.tier, wins: f.wins, losses: f.losses, points: f.points, you: false });
/** The rows ranked, the top shown and the player's own pinned under them when it is not among them. */
function topWithYou(rows, top = BOARD_TOP) {
  rows.forEach((r, i) => { r.rank = i + 1; });
  const shown = rows.slice(0, top);
  const me = rows.find((r) => r.you) ?? null;
  return { rows: shown, pinned: me && !shown.includes(me) ? me : null, total: rows.length };
}
/**
 * THE TEAM PAGE: your banner, its season against the other, the laurel, your points for it, and the roster's top ten
 * (you among them, or pinned under them). Unjoined: both banners, their standing and their best, and where to join.
 * @param {{ ladder: any, league: any, gameMinutes: number, name: string }} o
 */
export function teamPage({ ladder, league, gameMinutes, name }) {
  const G = rollLeague(league, gameMinutes);
  const st = leagueStandings(G, gameMinutes);
  const day = seasonDayOf(gameMinutes);
  const roster = leagueRoster(G.season, day);
  const L = arenaLadderRestore(ladder);
  const laurel = laurelBanner(G, gameMinutes);
  const meRow = (banner) => ({
    id: 'you', name: name || W().you, home: '', banner, title: ladderTitle(L), tier: L.grand ? LADDER_TIERS.length : L.tier,
    wins: G.bouts.filter((b) => b.won && b.team === banner).length, losses: G.bouts.filter((b) => !b.won && b.team === banner).length, points: G.points[banner] ?? 0, you: true,
  });
  const banners = BANNERS.map((b) => {
    const rows = roster.filter((f) => f.banner === b).map(rosterRow);
    if (G.team === b) rows.push(meRow(b));
    rows.sort((x, y) => y.points - x.points || y.tier - x.tier || x.losses - y.losses || x.name.localeCompare(y.name));
    return { banner: b, name: T().name[b], motto: T().motto[b], lore: T().lore[b], points: st[b], laurel: laurel === b, fighters: rows.length, ...topWithYou(rows) };
  });
  const total = st.red + st.blue;
  return {
    joined: G.team, season: st.season, day, standings: { red: st.red, blue: st.blue, leader: st.leader, redShare: total > 0 ? Math.round((st.red / total) * 1000) / 1000 : 0.5 },
    laurel, laurelYou: laurelWorn(G, gameMinutes), given: st.given, boutsFor: G.team ? G.bouts.filter((b) => b.team === G.team && b.won).length : 0,
    left: G.left, banners, lines: teamLines(G, st, laurel),
  };
}
function teamLines(G, st, laurel) {
  const out = [];
  out.push(st.leader ? T().leads(T().name[st.leader]) : T().level);
  if (laurel) out.push(T().laurel(T().name[laurel]));
  if (G.team) { out.push(T().under(T().the[G.team])); out.push(T().given(st.given)); }
  else { out.push(T().none); out.push(W().joinWhere); }
  return out;
}

// ── LEADERBOARDS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE LEADERBOARDS: PvE - the highest tier this season's field reached (you among them, by your ladder); the fastest
 * Grand Champions this save has seen (days from the first bout); PvP - the season's rating, fought online; the
 * banners, season by season. Each `{ title, sub, cols, rows, pinned, empty }`, a row `{ rank, name, banner, cells, you }`.
 * @param {{ ladder: any, league: any, gameMinutes: number, name: string }} o
 */
export function boardsPage({ ladder, league, gameMinutes, name }) {
  const G = rollLeague(league, gameMinutes);
  const L = arenaLadderRestore(ladder);
  const day = seasonDayOf(gameMinutes);
  const roster = leagueRoster(G.season, day);
  const me = name || W().you;
  // PvE: the highest tier reached - the Grand Champions first (the fastest first), then the tiers cleared, the wins
  const myTier = L.grand ? LADDER_TIERS.length : L.champs.filter(Boolean).length;
  const myDays = L.grand && G.grandAt != null && G.firstBoutAt != null ? Math.max(1, Math.ceil((G.grandAt - G.firstBoutAt) / MINUTES_PER_DAY)) : null;
  const pveRows = roster.map((f) => ({ name: f.name, home: f.home, banner: f.banner, title: f.title, reached: f.grand ? LADDER_TIERS.length : f.champs, wins: f.wins, losses: f.losses, days: f.days, you: false }));
  if (L.record.wins + L.record.losses > 0 || G.team) pveRows.push({ name: me, home: '', banner: G.team, title: ladderTitle(L), reached: myTier, wins: L.record.wins, losses: L.record.losses, days: myDays, you: true });
  pveRows.sort((a, b) => b.reached - a.reached || (a.reached === LADDER_TIERS.length ? (a.days ?? 1e9) - (b.days ?? 1e9) : 0) || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  // where each stands: the tier they fight in now (the one above the last champion they beat), or all ten taken
  const reachedLine = (n) => (n >= LADDER_TIERS.length ? W().allTen : W().cleared(n + 1, ARENA_TEXT.tiers[n]));
  const pve = topWithYou(pveRows.map((r) => ({ name: r.name, home: r.home, banner: r.banner, you: r.you, cells: [r.title ?? W().noTitle, reachedLine(r.reached), W().wl(r.wins, r.losses)] })));
  // the fastest Grand Champions: this save's seasons, and you
  const fastRows = rosterGrandChampions(G, gameMinutes).map((g) => ({ name: g.name, home: g.home, banner: g.banner, days: g.days, season: g.season, you: false }));
  if (myDays != null) fastRows.push({ name: me, home: '', banner: G.team, days: myDays, season: G.grandAt != null ? dateFromClassicMinutes(G.grandAt).year : G.season, you: true });
  fastRows.sort((a, b) => a.days - b.days || b.season - a.season || a.name.localeCompare(b.name));
  const fast = topWithYou(fastRows.map((r) => ({ name: r.name, home: r.home, banner: r.banner, you: r.you, cells: [W().days(r.days), W().seasonShort(r.season)] })));
  // the banners by season: this one standing, the closed ones with their winner and the side you fought on
  const st = leagueStandings(G, gameMinutes);
  const teamRows = [{ name: W().seasonShort(st.season), banner: st.leader, you: false, cells: [String(st.red), String(st.blue), st.leader ? W().leading(T().short[st.leader]) : T().level, G.team ? T().short[G.team] : W().none] }];
  for (const s of G.seasons) teamRows.push({ name: W().seasonShort(s.season), banner: s.winner, you: false, cells: [String(s.red), String(s.blue), s.winner ? W().won(T().short[s.winner]) : W().levelShort, s.mine ? T().short[s.mine] : W().none] });
  teamRows.forEach((r, i) => { r.rank = i + 1; });
  return {
    pve: { title: W().boards.pve, sub: W().boards.pveSub, cols: W().cols.pve, ...pve, empty: '' },
    fast: { title: W().boards.fast, sub: W().boards.fastSub, cols: W().cols.fast, ...fast, empty: fast.rows.length ? '' : W().boards.fastNone },
    pvp: { title: W().boards.pvp, sub: W().boards.pvpSub, cols: W().cols.pvp, rows: [], pinned: null, total: 0, empty: W().boards.pvpNone },
    team: { title: W().boards.team, sub: W().boards.teamSub, heads: [W().season], cols: W().cols.team, rows: teamRows, pinned: null, total: teamRows.length, empty: '' },   // AUDIT PRE-MERGE 1003 U11: its rows are seasons - no Rank, no Fighter over them
  };
}

// ── RECORDS ──────────────────────────────────────────────────────────────────────────────────────────────────
/** THE RECORDS PAGE: your record on the sand - wins, losses, yields, falls, ring-outs, the streak and the best, the
 *  purses, the champions beaten - and the last twenty bouts, newest first; and your wagers with the bookmaker. */
export function recordsPage({ ladder, league, gameMinutes, replays = [], atGate = true }) {
  const L = arenaLadderRestore(ladder);
  const G = rollLeague(league, gameMinutes);
  const r = L.record;
  const fought = r.wins + r.losses;
  const stats = [
    { k: W().stat.wins, v: String(r.wins) }, { k: W().stat.losses, v: String(r.losses) },
    { k: W().stat.share, v: fought ? `${Math.round((r.wins / fought) * 100)}%` : '-' },
    { k: W().stat.yields, v: String(r.yields) }, { k: W().stat.falls, v: String(r.falls) }, { k: W().stat.ringouts, v: String(r.ringouts) },
    { k: W().stat.streak, v: String(r.streak) }, { k: W().stat.best, v: String(r.best) },
    { k: W().stat.purses, v: W().gold(r.purses) }, { k: W().stat.champions, v: String(L.champs.filter(Boolean).length) },
  ];
  const how = (b) => (b.how === 'draw' ? W().how.draw : W().how[b.how] ?? '');
  // ARENA5: a bout the records keep (systems/arena/arenaReplay.js - the record fought at the same game minute and tier) carries
  // its press, Watch the replay, refused away from the gate as Watch is
  const kept = arenaReplaysRestore(replays);
  const replayOf = (b) => {
    const i = kept.findIndex((r) => r.at === b.at && (r.next?.tier ?? -1) === b.tier);
    return i < 0 ? null : { act: 'replay', label: ARENA_TEXT.replay.press, i, why: atGate ? '' : W().whyGate };
  };
  const bouts = G.bouts.map((b) => ({
    when: arenaDate(b.at), tier: ARENA_TEXT.tiers[b.tier], label: b.grand ? ARENA_TEXT.grandLabel : b.champion ? ARENA_TEXT.champLabel : b.label,
    opp: b.opp || W().fighter, result: b.how === 'draw' ? W().drew : b.won ? W().wonWord : W().lostWord, won: b.won, draw: b.how === 'draw', how: how(b),
    purse: b.purse, points: b.points, banner: b.team, replay: replayOf(b),
  }));
  return { stats, bouts, title: ladderTitle(L), titles: ladderTitles(L), empty: bouts.length ? '' : W().noBouts, wagers: bookLines(G, gameMinutes) };
}

// ── RULES ────────────────────────────────────────────────────────────────────────────────────────────────────
/** THE RULES PAGE: the arena's law in plain words, section by section. */
export const rulesPage = () => W().rules.map((s) => ({ head: s.head, lines: [...s.lines] }));

// ── ONLINE (ARENA4) ──────────────────────────────────────────────────────────────────────────
const O = () => ARENA_TEXT.online;
/** A fighter the service or the hall bills, as a row or a card names one. */
const billed = (b) => (b ? { name: b.n ?? b.name ?? '', rating: b.r ?? b.rating ?? null, banner: b.b ?? b.banner ?? null, title: b.t ?? b.title ?? null } : null);
/** THE BOUTS PAGE'S ONLINE CARDS: the bouts on the sand to watch (the hall's list - each with its fighters and how many
 *  watch, and Watch), and the challenge (the queue's state, the offer and its clock, the presses it allows). `hall`
 *  net/arena/arenaLink.js's hall state; `me` the service's own of this account. */
export function onlineCards({ hall, me, guest = false, busy = false, inSession = false, now = 0 }) {
  const busyWhy = inSession ? O().privIn : O().whyBusy;   // AUDIT PRE-MERGE 1003b U7: in a session, said as one
  const live = (hall?.live ?? []).map((b) => ({
    o: b.o, kind: b.kind, title: b.kind === 'ex' ? O().liveExhibition(ARENA_TEXT.tiers[b.tier ?? 0] ?? '') : b.kind === 'pve' ? O().liveLadder(ARENA_TEXT.tiers[b.tier ?? 0] ?? '') : b.u === 1 ? O().liveCasual : O().livePlayers,   // ARENA4b: a casual bout listed as one   // ARENA4b: the hour's exhibition, the relay's
    a: billed(b.a), b: billed(b.b), watching: O().watching(b.sp ?? 0), acts: [{ act: 'spectate', label: W().watch, why: busy ? busyWhy : null }],
  }));
  const players = {
    key: 'players', kind: 'players', title: O().liveTitle, state: String(live.length), fighters: [], live,
    acts: [], lines: [live.length ? O().liveLine(live.length) : O().noLive],
  };
  const st = hall?.status !== 'open' ? 'off' : hall.queue ?? 'idle';
  const why = st === 'off' ? O().whyOffline : guest ? O().whyGuest : busy ? busyWhy : null;
  /** @type {string[]} */
  const lines = [O().challengeLine];
  if (me?.pvp) lines.push(O().ratingLine(me.pvp.rating, me.pvp.wins, me.pvp.losses));
  let acts;
  if (st === 'queued') { acts = [{ act: 'unqueue', label: O().leaveQueue, why: null }]; lines.push(hall.casual ? O().casualQueued(hall.n ?? 0) : O().queuedLine(hall.band ?? 0, hall.n ?? 0)); }   // ARENA4b: a casual seeker's line
  else if (st === 'offer' && hall.offer) {
    // AUDIT PRE-MERGE 1003 U10: at 0 the offer has lapsed (the hall's beat says so within the second) - no Accept to press
    const left = Math.max(0, Math.ceil(((hall.offer.until ?? 0) - now) / 1000));
    acts = left > 0 ? [{ act: 'accept', label: O().accept, why: null }, { act: 'decline', label: O().decline, why: null }] : [];
    const vs = billed(hall.offer.vs);
    lines.push(O().offerLine(vs.name, vs.rating ?? '?'), O().offerClock(left));
    if (hall.offer.casual) lines.push(O().casualOffer);   // ARENA4b
  } else if (st === 'going') { acts = []; lines.push(O().goingLine(billed(hall.go?.vs)?.name ?? W().fighter)); }
  else { acts = [{ act: 'queue', label: O().findMatch, why }, { act: 'casual', label: O().casualMatch, why }]; lines.push(O().casualLine); }   // ARENA4b: Casual bout beside Find a match
  const challenge = { key: 'challenge', kind: 'challenge', title: O().challengeTitle, state: O().queueState[st], fighters: [], acts, lines, offer: st === 'offer' ? billed(hall.offer?.vs) : null };
  return [players, challenge];
}

/** AUDIT PRE-MERGE 1003b U6: the session's card on the Bouts page - first while this screen is in it, else last. */
function placeSession(cards, c) { if (c.code) cards.unshift(c); else cards.push(c); }
/** AUDIT PRE-MERGE 1003b U7: whether the hall holds me queued or offered a bout. */
const queuedOf = (hall) => hall?.queue === 'queued' || hall?.queue === 'offer';
/**
 * ARENA6: THE PRIVATE SESSION'S CARD (scenes/arena/arenaOnline.js sessionView): out of one, Host a session and Join with a
 * code; in one, its code to share, who fights now or who is picked, its members - each with what it is (Host, Red, Blue,
 * Guest, Away) and, to the host alone, the presses that make it the Red or the Blue (a member here and registered, while
 * no bout is on) or remove it - the host's Start bout, End bout and Close session (a member's Leave), and its recent
 * results. `busy` a bout of this screen's, `queued` the hall's queue or offer (a session waits for either). AUDIT PRE-MERGE
 * 1003b: every row's presses stand still (U4), the lock (S4), the last word (U3), the rejoin (C8).
 */
export function sessionCard(v, { guest = false, busy = false, queued = false } = {}) {
  const T = O();
  if (!v?.in) {
    // AUDIT PRE-MERGE 1003b U7: queued, Host and Join say why they wait; U3/U8: the last word the session said (a wrong
    // code, a removal, its end) stands on the card; C8: a session stepped out of (the host through the gates) offers its
    // code again
    const wait = busy ? T.whyBusy : queued ? T.privQueued : null;
    const lines = [T.privLine];
    if (v?.word) lines.push(v.word);
    /** @type {Array<{ act: string, label: string, why: string|null, data?: any }>} */
    const acts = [{ act: 'privHost', label: T.privHost, why: guest ? T.privHostGuest : wait }];
    if (v?.back) acts.push({ act: 'privJoin', label: T.privRejoin(v.back), why: wait, data: { code: v.back } });
    return {
      key: 'session', kind: 'session', title: T.privTitle, state: T.privState.none, fighters: [], lines, acts,
      join: { label: T.privJoin, field: T.privCodeLabel, hint: T.privCodeHint, why: wait },
    };
  }
  const w = v.state;
  const head = { key: 'session', kind: 'session', title: T.privTitleIn(v.code), state: /** @type {string} */ (v.host ? T.privState.host : T.privState.member), fighters: [], code: v.code };
  if (!w) return { ...head, lines: [T.privShare(v.code), ...(v.word ? [v.word] : [])], acts: [{ act: 'privLeave', label: T.privLeave, why: null }], members: [], results: [] };
  const host = w.h === 1;
  const name = (id) => w.m.find((x) => x[0] === id)?.[1] ?? '';
  const on = !!w.o && w.ph !== 'done' && w.ph !== 'void';
  // AUDIT PRE-MERGE 1003b R8/S1: a bout with its result is no bout to end "with no result" - from the end to the healers
  const decided = on && (w.ph === 'end' || w.ph === 'verdict' || w.ph === 'heal');
  const lines = [T.privShare(v.code)];
  if (on && w.f.length === 2) lines.push(T.privOn(name(w.f[0]), name(w.f[1])));
  else { lines.push(T.privWaitHost); if (w.r || w.b) lines.push(T.privPicks(name(w.r), name(w.b))); }
  lines.push(T.privMembers(w.m.length));
  if (w.lo) lines.push(T.privLocked);   // AUDIT PRE-MERGE 1003b S4
  if (v.word) lines.push(v.word);   // AUDIT PRE-MERGE 1003b U3: the relay's answer to the last press, in the window
  const members = w.m.map(([id, n, guestOf, here, , banner]) => {
    const roles = [];
    if (id === w.me) roles.push(T.privRole.you);   // AUDIT PRE-MERGE 1003b U10: your own row, in words
    if (id === w.hm) roles.push(T.privRole.host);
    if (id === w.r) roles.push(T.privRole.red);
    if (id === w.b) roles.push(T.privRole.blue);
    if (guestOf) roles.push(T.privRole.guest);
    if (!here) roles.push(T.privRole.away);
    // AUDIT PRE-MERGE 1003b U4: A ROW'S PRESSES STAND STILL - to the host, Make Red, Make Blue and Remove on every row (none
    // to remove on its own), each that may not be pressed now saying why. A picked member's own press was dropped, so the
    // row's presses moved at every pick and a redraw put the keyboard on the next member's: Enter on "Make Red - Brann"
    // then Enter again picked the host
    /** @type {Array<{ act: string, label: string, why: string|null, data: any, key: string }>} */
    const acts = [];
    if (host) {
      const no = on ? T.privBoutOn : !here ? T.privAwayWhy : guestOf ? T.privGuestWhy : null;
      acts.push({ act: 'privPick', label: T.privMakeRed, why: no ?? (id === w.r ? T.privIsRed : null), data: { r: id }, key: `aw-priv-${id}-r` });
      acts.push({ act: 'privPick', label: T.privMakeBlue, why: no ?? (id === w.b ? T.privIsBlue : null), data: { b: id }, key: `aw-priv-${id}-b` });
      if (id !== w.hm) acts.push({ act: 'privKick', label: T.privRemove, why: null, data: { m: id }, key: `aw-priv-${id}-kick` });
    }
    return { id, name: n, me: id === w.me, banner: banner || null, red: id === w.r, blue: id === w.b, roles, acts };
  });
  if (on && w.f.includes(w.me)) head.state = T.privState.fighter;   // AUDIT PRE-MERGE 1003b U7
  const acts = host
    ? [
      { act: 'privGo', label: T.privStart, why: on ? T.privBoutOn : !(w.r && w.b) ? T.privNoPicks : null, key: 'aw-priv-go' },
      { act: 'privVoid', label: T.privVoid, why: !on ? T.privNoBout : decided ? T.privHasResult : null, key: 'aw-priv-void' },
      { act: 'privLock', label: w.lo ? T.privUnlock : T.privLock, why: null, data: { l: w.lo ? 0 : 1 }, key: 'aw-priv-lock' },
      { act: 'privClose', label: T.privClose, why: null, key: 'aw-priv-close' },
    ]
    : [{ act: 'privLeave', label: T.privLeave, why: null, key: 'aw-priv-leave' }];
  return { ...head, lines, acts, members, results: w.hist.map(([r, b, win, how]) => T.privResult(r, b, win, how)) };
}

/** THE TEAM PAGE ONLINE, teamPage's own shape over the service's board: the season's points, the laurel, both banners
 *  with their top ten (you pinned in yours). */
export function teamPageOnline(board) {
  const t = board.team, me = board.me ?? {};
  const st = t.standings ?? { red: 0, blue: 0 };
  const leader = st.red > st.blue ? 'red' : st.blue > st.red ? 'blue' : null;
  const total = st.red + st.blue;
  const rowOf = (r) => ({ name: r.name, home: '', banner: r.banner, title: r.title ?? null, wins: r.wins ?? 0, losses: 0, points: r.points ?? 0, rank: r.rank, you: !!r.you });
  const banners = BANNERS.map((b) => {
    const R = t.rosters?.[b] ?? { rows: [], pinned: null, total: 0 };
    return { banner: b, name: T().name[b], motto: T().motto[b], lore: T().lore[b], points: st[b] ?? 0, laurel: t.laurel === b, fighters: t.members?.[b] ?? 0, rows: R.rows.map(rowOf), pinned: R.pinned ? rowOf(R.pinned) : null, total: R.total };
  });
  const lines = [leader ? T().leads(T().name[leader]) : T().level];
  if (t.laurel) lines.push(T().laurel(T().name[t.laurel]));
  if (me.banner) { lines.push(T().under(T().the[me.banner])); lines.push(T().given(me.points ?? 0)); } else { lines.push(T().none); lines.push(W().joinWhere); }
  return {
    joined: me.banner ?? null, season: board.season, seasonName: O().seasonShort(board.season), day: board.day,
    standings: { red: st.red, blue: st.blue, leader, redShare: total > 0 ? Math.round((st.red / total) * 1000) / 1000 : 0.5 },
    laurel: t.laurel ?? null, laurelYou: !!me.banner && t.laurel === me.banner, given: me.points ?? 0,
    boutsFor: (t.rosters?.[me.banner]?.rows ?? []).concat(t.rosters?.[me.banner]?.pinned ? [t.rosters[me.banner].pinned] : []).find((r) => r.you)?.wins ?? 0,
    left: me.left ? { banner: me.left, season: me.leftSeason } : null, banners, lines, online: true,
  };
}

/** The ladder's title a climb of `n` bouts won in order gives (every fourth bout a tier's champion), or null. Pure. */
export function ladderTitleOfReached(n) {
  const tiers = Math.floor(Math.max(0, n | 0) / (BOUTS_PER_TIER + 1));
  return tiers > 0 ? ARENA_TEXT.titles[Math.min(LADDER_TIERS.length, tiers) - 1] : null;
}

/** ARENA4b: the realm's season a row of the board was taken in (its `at`, unix seconds - net/arena/arenaLaw.js arenaSeasonOf),
 *  or this season for a row that carries none (an older service). */
const seasonOfRow = (r, board) => (Number.isFinite(r?.at) && r.at > 0 ? arenaSeasonOf(r.at) : board.season);

/** ARENA4b: THE REALM'S HALL OF CHAMPIONS (the board's `hall` - every account that took the Grand Champion's title, the
 *  newest first, each with the season it was cut in), as the Leaderboards page draws it under the fastest Grand
 *  Champion: `{ title, sub, rows: [{ name, season, you }], empty }`. My row marked when I am one of them - by the name the
 *  realm gives me (the fastest board's `you` row: the account's name, not the character's), else `name`. */
export function hallBoardOnline(board, name = '') {
  const grand = !!board?.me?.grand;
  const fast = board?.fast ? [...(Array.isArray(board.fast.rows) ? board.fast.rows : []), board.fast.pinned] : [];
  const mine = fast.find((r) => r?.you && typeof r.name === 'string' && r.name)?.name || name;
  const rows = (Array.isArray(board?.hall) ? board.hall : []).filter((h) => h && typeof h.name === 'string' && h.name)
    .map((h) => ({ name: h.name, season: O().seasonShort(seasonOfRow(h, board)), you: grand && !!mine && h.name === mine }));
  return { title: ARENA_TEXT.undercroft.hallTitle, sub: O().hallTheirs, rows, empty: rows.length ? '' : ARENA_TEXT.undercroft.hallNone };
}

/** ARENA4b: THE KEEPER OF THE HALL ONLINE (scenes/arena/arenaGate.js hall, the undercroft's Keeper - scenes/worldModes.js): the
 *  wall as she reads it - my own names cut by the account's climb (systems/arena/arenaLadder.js hallOfChampions over the
 *  board's `me.ladder`: the Grand Champion, each tier's champion beaten), then the realm's Grand Champions, the newest
 *  first, each with its season; "not yet" for me beside theirs. Pure. */
export function hallLinesOnline(board, name) {
  const U = ARENA_TEXT.undercroft;
  const who = name || W().you;
  const realm = (Array.isArray(board?.hall) ? board.hall : []).filter((h) => h && typeof h.name === 'string' && h.name);
  const mine = hallOfChampions(board?.me?.ladder ?? null, who, []);
  const lines = realm.length ? mine.map((l) => (l === U.hallNone ? U.hallNotYou : l)) : [...mine];
  if (realm.length) {
    lines.push('', O().hallTheirs);
    for (const h of realm) lines.push(O().hallTheirAt(h.name, seasonOfRow(h, board)));
  }
  return lines;
}

/**
 * ARENA5: THE HALL'S PLAQUES (world/arena/arenaPlaques.js - the wall in the undercroft): one a Grand Champion, the newest first,
 * at most `max`. Offline this save's (Arena.md 1: "every Grand Champion this save") - its own (the player, the banner the
 * title was won under, the season it was taken in: the league's `grandAt`) among the banners' fighters who took the title
 * (systems/arena/arenaLeague.js rosterGrandChampions - their name and home, their banner, their season), by season; online
 * (`board` - the service's) the realm's: every account the board's `hall` names, with the season it was cut in, no banner
 * (the realm's hall carries none). `[{ name, banner, season }]` - `season` the words ("3E 406", "Season 2"). Pure.
 * @param {{ ladder?: any, league?: any, gameMinutes?: number, name?: string, board?: any, max?: number }} o
 */
export function hallPlaques({ ladder = null, league = null, gameMinutes = 0, name = '', board = null, max = 10 } = {}) {
  /** @type {{ name: string, banner: string|null, season: string, at: number }[]} */
  const out = [];
  if (board) {
    for (const h of Array.isArray(board.hall) ? board.hall : []) if (h && typeof h.name === 'string' && h.name) out.push({ name: h.name, banner: null, season: O().seasonShort(seasonOfRow(h, board)), at: 0 });
    return out.slice(0, Math.max(0, max)).map(({ at, ...p }) => p);
  }
  const L = arenaLadderRestore(ladder);
  const G = rollLeague(league, gameMinutes);
  if (L.grand) {
    const year = Number.isFinite(G.grandAt) ? seasonOf(G.grandAt) : G.season;
    const won = G.bouts.find((b) => b.grand && b.won);
    out.push({ name: name || W().you, banner: (won ? won.team : G.team) ?? null, season: W().seasonShort(year), at: year + 0.5 });   // mine first in my season
  }
  for (const c of rosterGrandChampions(league, gameMinutes)) out.push({ name: `${c.name} of ${c.home}`, banner: c.banner ?? null, season: W().seasonShort(c.season), at: c.season });
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, Math.max(0, max)).map(({ at, ...p }) => p);
}

/** THE LEADERBOARDS ONLINE, boardsPage's shape over the service's board: the realm's climb, its fastest Grand Champions,
 *  the season's ratings (its #1 and the laurel) and the banners this season and the last. ARENA4b: each fastest Grand
 *  Champion with the season it was taken in (its own `at`, not this season), and the realm's Hall (`hall`). */
export function boardsPageOnline(board, name = '') {
  const row = (r, cells) => ({ rank: r.rank, name: r.name, home: '', banner: r.banner ?? null, you: !!r.you, cells });
  const pveCells = (r) => [ladderTitleOfReached(r.reached) ?? W().noTitle,
    r.reached >= LADDER_TIERS.length * (BOUTS_PER_TIER + 1) ? W().allTen : O().reached(r.reached + 1), W().wl(r.reached, r.losses)];
  const map = (b, cells) => ({ rows: b.rows.map((r) => row(r, cells(r))), pinned: b.pinned ? row(b.pinned, cells(b.pinned)) : null, total: b.total });
  const pvp = map(board.pvp, (r) => [String(r.rating), O().pvpCells(r.wins, r.losses, r.draws)]);
  const pve = map(board.pve, pveCells);
  const fast = map(board.fast, (r) => [W().days(r.days), O().seasonShort(seasonOfRow(r, board))]);
  const t = board.team;
  const teamRows = [
    { rank: 1, name: O().seasonShort(board.season), banner: null, you: false, cells: [String(t.standings.red), String(t.standings.blue), t.standings.red === t.standings.blue ? T().level : W().leading(T().short[t.standings.red > t.standings.blue ? 'red' : 'blue']), board.me?.banner ? T().short[board.me.banner] : W().none] },
  ];
  if (board.season > 1) teamRows.push({ rank: 2, name: O().seasonShort(board.season - 1), banner: t.last?.winner ?? null, you: false, cells: [String(t.last?.red ?? 0), String(t.last?.blue ?? 0), t.last?.winner ? W().won(T().short[t.last.winner]) : W().levelShort, W().none] });
  return {
    pve: { title: W().boards.pve, sub: O().pveSub, cols: W().cols.pve, ...pve, empty: pve.rows.length ? '' : W().boards.fastNone },
    fast: { title: W().boards.fast, sub: O().fastSub, cols: W().cols.fast, ...fast, empty: fast.rows.length ? '' : W().boards.fastNone },
    pvp: { title: W().boards.pvp, sub: O().pvpSub, cols: W().cols.pvp, ...pvp, empty: pvp.rows.length ? '' : O().pvpNone, champion: board.champion ? O().champion(board.champion.name) : O().noChampion },
    team: { title: W().boards.team, sub: O().teamSub, heads: [W().season], cols: W().cols.team, rows: teamRows, pinned: null, total: teamRows.length, empty: '' },   // AUDIT PRE-MERGE 1003 U11
    hall: hallBoardOnline(board, name),
  };
}

/** THE HEADER ONLINE: the season of the realm, the account's ladder title (the Arena Champion's or the Grand Champion's
 *  first), its banner and the laurel, its rating and its rank. ARENA4b: no purses chip unless the board says one (a purse
 *  is paid on this screen, never kept by the realm - `purses` null, the chip left out, never a 0). */
export function arenaHeaderOnline({ board, name }) {
  const me = board.me ?? {};
  const L = arenaLadderRestore(me.ladder);
  const T10 = ARENA_TEXT.titles[LADDER_TIERS.length - 1];
  return {
    name: name || W().you, title: me.champion ? O().championTitle : me.grand ? T10 : ladderTitle(L), banner: me.banner ?? null,
    laurel: !!me.banner && board.team?.laurel === me.banner, season: O().seasonLine(board.season, board.day),
    record: W().recordLine(L.record.wins, L.record.losses), purses: purseOf(me), owed: 0,
    rating: me.pvp ? O().ratingChip(me.pvp.rating) : null, rank: me.rank ? O().rankChip(me.rank) : null, champion: !!me.champion, online: true,
  };
}

/** The purses the board says the account has won, or null when it says none (an older service, or never). */
const purseOf = (me) => { const v = me?.purses ?? me?.record?.purses; return Number.isSafeInteger(v) && v >= 0 ? v : null; };

/**
 * ARENA4b: THE RECORDS PAGE ONLINE, recordsPage's shape over the board's `me`: the account's record on the realm's sand
 * (`me.record` - its ladder and rated wins, losses and draws and its best streak; an older service's board without it,
 * what the climb's record and the season's rating carry) and its last bouts (`me.recent`, newest first, at most
 * twenty - a ladder bout by its tier and step and the house's fighters it met, a rated bout by its opponent and the
 * rating it moved, a draw when `won` is null); the wagers stay the save's (the bookmaker's book is this screen's). The
 * save's own record stays the offline page's.
 * @param {any} board the service's board @param {{ league?: any, gameMinutes?: number }} [o]
 */
export function recordsPageOnline(board, { league = null, gameMinutes = 0 } = {}) {
  const me = board?.me ?? {};
  const L = arenaLadderRestore(me.ladder);
  const n = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
  const rec = me.record && typeof me.record === 'object' ? me.record : null;
  const pveW = rec ? n(rec.pveWins) : L.record.wins, pveL = rec ? n(rec.pveLosses) : L.record.losses;
  const pvpW = n(rec ? rec.pvpWins : me.pvp?.wins), pvpL = n(rec ? rec.pvpLosses : me.pvp?.losses), pvpD = n(rec ? rec.pvpDraws : me.pvp?.draws);
  const wins = pveW + pvpW, decided = wins + pveL + pvpL;
  const S = O().stat;
  const stats = [
    { k: S.pveWins, v: String(pveW) }, { k: S.pveLosses, v: String(pveL) },
    { k: S.pvpWins, v: String(pvpW) }, { k: S.pvpLosses, v: String(pvpL) }, { k: S.pvpDraws, v: String(pvpD) },
    { k: W().stat.share, v: decided ? `${Math.round((wins / decided) * 100)}%` : '-' },
    { k: W().stat.best, v: String(rec ? n(rec.best) : L.record.best) },
    { k: S.rating, v: me.pvp && Number.isFinite(me.pvp.rating) ? String(me.pvp.rating) : '-' },
    { k: W().stat.champions, v: String(L.champs.filter(Boolean).length) },
  ];
  const recent = Array.isArray(me.recent) ? me.recent : null;
  const tierOf = (v) => (Number.isSafeInteger(v) && v >= 0 && v < LADDER_TIERS.length ? v : 0);
  const stepOf = (v) => (Number.isSafeInteger(v) && v >= 0 && v <= BOUTS_PER_TIER ? v : 0);
  const bouts = (recent ?? []).filter((b) => b && typeof b === 'object').slice(0, 20).map((b) => {
    const pve = b.kind !== 'pvp';
    const tier = tierOf(b.tier), step = stepOf(b.step), champ = step === BOUTS_PER_TIER;
    const draw = b.won === null, won = b.won === true;
    const rating = b.rating && Number.isFinite(b.rating.after) && Number.isFinite(b.rating.before) ? O().ratingMove(b.rating.after, b.rating.after - b.rating.before) : '';
    return {
      when: Number.isFinite(b.at) && b.at > 0 ? O().boutWhen(arenaSeasonOf(b.at), arenaSeasonDay(b.at)) : '',
      tier: pve ? ARENA_TEXT.tiers[tier] : O().livePlayers,
      label: pve ? (champ ? (tier === LADDER_TIERS.length - 1 ? ARENA_TEXT.grandLabel : ARENA_TEXT.champLabel) : ARENA_TEXT.boutLabel(step + 1)) : b.rated === false ? O().unratedShort : rating,
      opp: (typeof b.opponent?.name === 'string' && b.opponent.name) || (pve ? opponentLine(champ ? LADDER_TIERS[tier].champion : LADDER_TIERS[tier].bouts[step]) : W().fighter),
      result: draw ? W().drew : won ? W().wonWord : W().lostWord, won, draw,
      how: typeof b.how === 'string' ? (b.how === 'draw' ? W().how.draw : W().how[b.how] ?? O().how[b.how] ?? '') : '',
      purse: 0, points: n(b.points), banner: '',
    };
  });
  const titles = ladderTitles(L);
  if (me.champion) titles.unshift(O().championTitle);
  return {
    stats, bouts, title: me.champion ? O().championTitle : ladderTitle(L), titles, online: O().recordsOnline,
    empty: recent === null ? O().noRecent : bouts.length ? '' : O().noBouts, wagers: bookLines(rollLeague(league, gameMinutes), gameMinutes),
  };
}

/** FIELD BUGS 2026-10-16b ARENA-WAIT: the realm's board before the service's is in - its season and day by the wall clock
 *  (`nowS`, unix seconds), nobody on it. Only ever drawn as "on its way" (arenaBoard's no-board arm). */
function pendingBoard(nowS) {
  const t = Number.isFinite(nowS) ? Number(nowS) : Date.now() / 1000;
  const none = { rows: [], pinned: null, total: 0 };
  return { season: arenaSeasonOf(t), day: arenaSeasonDay(t), me: {}, team: { standings: { red: 0, blue: 0 }, rosters: {}, members: {}, laurel: null, last: null }, pve: none, pvp: none, fast: none, hall: [] };
}

/** FIELD BUGS 2026-10-16b ARENA-WAIT (AUDIT A1): THE LADDER PAGE BEFORE THE ACCOUNT'S CLIMB IS IN (arenaBoard's no-board
 *  arm) - the ten tiers as the law has them (their bouts, champions, purses and the titles they give), and nobody's climb
 *  on them: no tier cleared or current (`waiting`), no pip, no champion beaten, no next bout, no title earned and no tier
 *  the climb stands on (`current` null) - `line` saying why (the climb on its way, the seat elsewhere, the server gone). The
 *  arm drew the SAVE's ladder here ("Tier 2, Bloodied", "Pit Fighter") over a realm Grand Champion. */
export function ladderPageWaiting(line) {
  // the law's page over no climb at all (no pip, no champion beaten), its tiers nobody's and its first bout nobody's next
  const law = ladderPage({ ladder: null });
  return {
    tiers: law.tiers.map((t) => ({ ...t, state: 'waiting', bouts: t.bouts.map((b) => ({ ...b, next: false })) })),
    current: null, grand: false, titles: [], next: null, online: line, waiting: true,
  };
}
/** ARENA-WAIT (AUDIT A1): THE BOUTS PAGE'S LADDER CARD before the account's climb is in - no bout named, no opponents, no
 *  purse (the save's next bout and its purse stood here), its Fight shut with `line`. */
export const ladderCardWaiting = (line) => ({
  key: 'ladder', kind: 'ladder', title: W().ladderBout, state: W().tierState.waiting, fighters: [], acts: [{ act: 'fight', label: W().fight, why: line }], lines: [],
});

/** EVERY PAGE at once - the window's whole model. ARENA4: online (`o.online` - the service's `board`, the hall's state),
 *  the ladder is the account's (every bout refereed), the Team and Leaderboards pages the realm's, and the Bouts page
 *  carries the bouts to watch and the challenge; offline, the save's as ARENA3 drew them. */
export function arenaBoard(o) {
  const on = o.online?.board ? o.online : null;
  if (!on) {
    const m = { header: arenaHeader(o), bouts: boutsPage(o), ladder: ladderPage(o), team: teamPage(o), boards: boardsPage(o), records: recordsPage(o), rules: rulesPage() };
    if (o.online) m.bouts.cards = m.bouts.cards.map((c) => (c.kind === 'players' ? onlineCards({ hall: o.online.hall, me: null, guest: !!o.online.guest, busy: !!o.online.busy, inSession: !!o.online.inSession, now: o.online.now ?? 0 })[0] : c));
    // ARENA6 (AUDIT PRE-MERGE 1003b U6: in a session its card leads the page - the pause menu's Arena opened on the page's
    // top, the card 2.6 screens down on a phone)
    if (o.online?.session) placeSession(m.bouts.cards, sessionCard(o.online.session, { guest: !!o.online.guest, busy: !!o.online.busy && !o.online.session.in, queued: queuedOf(o.online.hall) }));
    // ARENA4b: online before the realm's board is in, the climb is not the save's - the ladder's Fight waits for it - and
    // neither is the record: the Records page says the realm's is on its way (the save's wagers kept), no purses chip
    if (o.online) {
      // ARENA-WAIT (AUDIT A1/A4): `away` - the seat elsewhere or the server gone (scenes/arena/arenaOnline.js model) - is said on
      // every page in place of "on its way"; `shutWhy` is what a press says while the doors are shut (the lane waiting)
      const away = o.online.away ?? null, shutWhy = o.online.shutWhy ?? null;
      // AUDIT A1: the ladder page and the Bouts page's ladder card are nobody's - the save's tiers, pips, titles, next bout
      // and purse stood here while every other page waited
      /** @type {any} */ (m).ladder = ladderPageWaiting(away ?? O().climbWait);
      m.bouts.cards = m.bouts.cards.map((c) => (c.kind === 'ladder' ? ladderCardWaiting(away ?? O().climbWait) : c));
      // a shut door's Watch says why on its card - the hour's bout is the relay's (the press closed the window to say it)
      if (shutWhy) for (const c of m.bouts.cards) if (c.kind === 'exhibition') c.acts = c.acts.map((a) => (a.act === 'watch' ? { ...a, why: a.why ?? shutWhy } : a));
      m.records = { ...recordsPageOnline(null, o), stats: [], ...(away ? { empty: away } : {}) };
      // FIELD BUGS 2026-10-16b ARENA-WAIT: nor the header, the banners or the boards - the save's offline season ("Season
      // of 3E 406"), its title and record and its seeded roster stood over a realm Grand Champion while the board was
      // asked. The realm's season by the clock (net/arena/arenaLaw.js arenaSeasonOf), no title, record or banner of the save's,
      // and every board says the names are on their way.
      const wait = pendingBoard(o.online.nowS);
      m.header = { ...arenaHeaderOnline({ board: wait, name: o.name }), title: null, record: '' };
      m.team = { ...teamPageOnline(wait), lines: [away ?? O().rollWait] };
      /** @type {any} */
      const boards = boardsPageOnline(wait, o.name ?? '');
      for (const k of ['pve', 'fast', 'pvp', 'team']) boards[k] = { ...boards[k], rows: [], pinned: null, total: 0, empty: away ?? O().rollWait };
      delete boards.pvp.champion;
      /** @type {any} */ (m).boards = boards;
    }
    return m;
  }
  const oo = { ...o, ladder: on.board.me?.ladder ?? o.ladder };
  const bouts = boutsPage(oo);
  const cards = [];
  for (const c of bouts.cards) {
    if (c.kind === 'players') cards.push(...onlineCards({ hall: on.hall, me: on.board.me, guest: !!on.guest, busy: !!on.busy, inSession: !!on.inSession, now: on.now ?? 0 }));
    else cards.push(c);
  }
  if (on.session) placeSession(cards, sessionCard(on.session, { guest: !!on.guest, busy: !!on.busy && !on.session.in, queued: queuedOf(on.hall) }));   // ARENA6: the private session's card (AUDIT PRE-MERGE 1003b U6: first while in one)
  bouts.cards = cards;
  const ladder = ladderPage(oo);
  ladder.online = O().ladderOnline;
  /** @type {Array<{ head: string, lines: string[] }>} */
  const rules = rulesPage();
  rules.push({ head: O().rules.head, lines: [...O().rules.lines] });
  return {
    header: arenaHeaderOnline({ board: on.board, name: o.name }), bouts, ladder, team: teamPageOnline(on.board), boards: boardsPageOnline(on.board, o.name ?? ''),
    records: recordsPageOnline(on.board, o), rules, hall: (on.board.hall ?? []).map((h) => O().hallTheir(h.name)),   // ARENA4b: the account's record, not the save's
  };
}
