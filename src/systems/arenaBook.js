// @ts-check
// ARENA3 (2026-10-02, Mac: "Players can choose to watch AI fights"; "extremely detailed and authentic"): THE
// BOOKMAKER'S BOOK - wagers on the hour's exhibition, held in the league's save (systems/arenaLeague.js `book`). Design:
// bible/11-Multiplayer/Arena.md "1. The gate" ("the bookmaker - wagers on the bout on the floor (gold, house edge, odds
// from the fighters' records)").
//
// THE FIGHTERS' RECORDS. An exhibition's two fighters (systems/arenaLadder.js exhibitionFor) come with a record on the
// sand and a form, both from the bout's own seed (the same hour, the same record, on every screen): a fighter's
// STRENGTH is its level - the tier's for a class fighter, Daggerfall's own for a beast (ENEMY_BASICS) - and its form; its
// record (won and lost) follows its form. The chance each wins is the two strengths apart (`exhibitionOdds`).
//
// THE ODDS. The house shades each fair price by its tenth (BOOK_EDGE) and rounds DOWN to the bookmaker's own ladder of
// prices ("evens", "7 to 4", "4 to 6") - so a winning wager pays its stake and the price in whole gold, never a fraction.
// A DRAW gives every stake back.
//
// THE WAGER. One a bout, from STAKE_MIN to STAKE_MAX gold (and no more than the purse holds), taken while the bout is
// open (its first EXHIBITION_START_MINUTES) and not yet fighting. It is settled by the bout's own verdict when it was seen
// on this screen (`bookVerdict`), else - the bout fought with nobody here to see it - by the house's record of it
// (`houseOutcome`, seeded, by the same odds) once its hour is out. What it won waits with the bookmaker until it is
// collected at his stall (`collectWinnings`): he pays in person.
//
// Pure. Not a DFU member. Ledger A (ARENA).

import { ENEMY_BASICS, enemyDisplayName } from '../characters/enemyBasics.js';
import { arenaHash, seededRng, exhibitionFor } from './arenaLadder.js';
import { fighterIdentity } from './arenaFighters.js';
import { ARENA_TEXT } from './arenaText.js';

/** The house's share of every price. */
export const BOOK_EDGE = 0.1;
/** A wager's least and most, gold; the stakes the bookmaker's choice offers. */
export const STAKE_MIN = 10;
export const STAKE_MAX = 1000;
export const STAKES = Object.freeze([10, 25, 50, 100, 250, 500, 1000]);
/** The chance the house records an unseen bout as a draw. */
export const HOUSE_DRAW = 0.04;
/** How far apart two strengths must be for the stronger to win about three bouts in four. */
const STRENGTH_SPREAD = 3;
/** How many wagers the book keeps. */
export const WAGERS_KEPT = 20;
/** AUDIT PRE-MERGE 1003 B3: THE BOUT LEFT - an exhibition of this screen's seen past its word and walked away from before
 *  its verdict (scenes/arenaBouts.js dismiss), kept as the hour's verdict seen: no side won it for the one who backed
 *  either (settleBook - lost), and the book on it is shut (wagerRefusal). */
export const BOUT_LEFT = 'left';
/** A verdict seen as the book keeps it: a side, a draw (null), or the bout left. */
const seenSide = (side) => (side === 0 || side === 1 || side === BOUT_LEFT ? side : null);
/** THE BOOKMAKER'S PRICES (net to one), longest-standing first - the house rounds a price down to the one under it. */
export const ODDS_LADDER = Object.freeze([
  [1, 5], [2, 9], [1, 4], [2, 7], [1, 3], [4, 11], [2, 5], [4, 9], [1, 2], [8, 15], [4, 7], [8, 13], [4, 6], [8, 11],
  [4, 5], [5, 6], [10, 11], [1, 1], [11, 10], [6, 5], [5, 4], [11, 8], [6, 4], [13, 8], [7, 4], [15, 8], [2, 1], [9, 4],
  [5, 2], [11, 4], [3, 1], [10, 3], [7, 2], [4, 1], [9, 2], [5, 1], [6, 1], [7, 1], [8, 1], [10, 1],
].map((x) => Object.freeze(x)));

const int = (v, lo, hi, d = lo) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const B = () => ARENA_TEXT.book;

// ── THE SAVE ─────────────────────────────────────────────────────────────────────────────────────────────────
/** An empty book: no wager standing, nothing owed. */
export function newArenaBook() {
  return { wagers: [], owed: 0, won: 0, lost: 0, staked: 0, seen: [] };
}
const STATUS = new Set(['open', 'won', 'lost', 'draw']);
/** Any shape back to a whole book. */
export function bookRestore(raw) {
  const b = newArenaBook();
  if (!raw || typeof raw !== 'object') return b;
  b.owed = int(raw.owed, 0, 1e9); b.won = int(raw.won, 0, 1e9); b.lost = int(raw.lost, 0, 1e9); b.staked = int(raw.staked, 0, 1e9);
  b.wagers = (Array.isArray(raw.wagers) ? raw.wagers : []).slice(0, WAGERS_KEPT).filter((w) => w && Number.isFinite(Number(w.hour))).map((w) => ({
    hour: int(w.hour, 0, 1e9), side: w.side === 1 ? 1 : 0, stake: int(w.stake, 0, 1e9), num: int(w.num, 1, 100, 1), den: int(w.den, 1, 100, 1),
    names: Array.isArray(w.names) ? [String(w.names[0] ?? '').slice(0, 60), String(w.names[1] ?? '').slice(0, 60)] : ['', ''],
    at: int(w.at, 0, 1e12), status: STATUS.has(w.status) ? w.status : 'open', paid: int(w.paid, 0, 1e9), seen: w.seen === true,
  }));
  b.seen = (Array.isArray(raw.seen) ? raw.seen : []).slice(0, WAGERS_KEPT).filter((s) => s && Number.isFinite(Number(s.hour))).map((s) => ({ hour: int(s.hour, 0, 1e9), side: seenSide(s.side) }));   // AUDIT PRE-MERGE 1003 B3: and the bout left
  return b;
}

// ── THE RECORDS AND THE ODDS ─────────────────────────────────────────────────────────────────────────────────
/** A fighter's level on the sand: the tier's for a class fighter, Daggerfall's own for a monster. */
const levelOf = (o) => o.level ?? ENEMY_BASICS[o.mobile]?.level ?? 1;
/**
 * AN EXHIBITION FIGHTER'S RECORD AND STRENGTH (fighter `i` of `ex`): `{ wins, losses, form, strength }` - the same for the
 * same bout on every screen.
 */
export function exhibitionRecord(ex, i) {
  const o = ex.opponents[i];
  const rng = seededRng(arenaHash(ex.seed, 0x600 + i));
  const form = (rng() - 0.5) * 4;
  const bouts = 6 + Math.floor(rng() * 30);
  const share = Math.max(0.15, Math.min(0.9, 0.52 + form * 0.09));
  const wins = Math.round(bouts * share);
  return { wins, losses: bouts - wins, form: Math.round(form * 100) / 100, strength: levelOf(o) + form };
}
/** THE CHANCES: `[pA, pB]`, each fighter's to win (a draw aside), from the two strengths. */
export function exhibitionOdds(ex) {
  const a = exhibitionRecord(ex, 0).strength, b = exhibitionRecord(ex, 1).strength;
  const pa = 1 / (1 + Math.exp(-(a - b) / STRENGTH_SPREAD));
  return [pa, 1 - pa];
}
/** The bookmaker's price for a chance `p`: the fair price shaded by the house's tenth and rounded down his ladder -
 *  `[num, den]`, paying `num` for every `den` staked; null when even his shortest is too long (he lays no price).
 *  @returns {[number, number] | null} */
export function priceFor(p) {
  const fair = 1 / Math.max(0.01, Math.min(0.99, p)) - 1;
  const net = fair * (1 - BOOK_EDGE);
  // AUDIT PRE-MERGE 1003 B4: A FAVOURITE SHORTER THAN HIS SHORTEST RUNG IS NOT LAID. Past a chance of 0.818 the shaded
  // price is under 1 to 5, and 1 to 5 was laid anyway - better than fair (1.08 back for every 1 staked at 0.9, 9.8% a
  // year backing every such favourite unseen); his ladder ends at 1 to 5 (Arena.md), so the side is refused instead
  let best = null;
  for (const x of ODDS_LADDER) if (x[0] / x[1] <= net + 1e-9) best = x;
  return best ? [best[0], best[1]] : null;
}
/** A price said: "evens", "7 to 4" - AUDIT PRE-MERGE 1003 B4: "no price" for a side he will not lay. */
export const oddsText = (pr) => (!pr ? B().noPrice : pr[0] === pr[1] ? B().evens : B().price(pr[0], pr[1]));
/** What a winning stake pays back, stake and winnings, in whole gold. */
export const payoutFor = (stake, [num, den]) => Math.max(0, Math.floor(stake)) + Math.floor((Math.max(0, Math.floor(stake)) * num) / den);

/**
 * THE HOUSE'S RECORD of a bout nobody here saw: 0 or 1 (the side that won) or null (a draw), seeded by the bout - the
 * same on every screen - and by the same chances the prices came from.
 */
export function houseOutcome(ex) {
  const r = seededRng(arenaHash(ex.seed, 0x77))();
  if (r < HOUSE_DRAW) return null;
  return (r - HOUSE_DRAW) / (1 - HOUSE_DRAW) < exhibitionOdds(ex)[0] ? 0 : 1;
}

// ── THE WAGER ────────────────────────────────────────────────────────────────────────────────────────────────
/** The book's wager on the bout of `hour`, or null. */
export const wagerOn = (book, hour) => bookRestore(book).wagers.find((w) => w.hour === hour) ?? null;

/** AUDIT PRE-MERGE 1003 B3: whether the book keeps a verdict seen here for the bout of `hour` (or the bout left). */
export const bookSaw = (book, hour) => bookRestore(book).seen.some((s) => s.hour === hour);
/**
 * Why a wager of `stake` on `ex` will not be taken now, or null: 'none' (no bout this hour), 'closed' (not open, or the
 * fight begun - AUDIT PRE-MERGE 1003 B3: or the bout already seen here, to its verdict or left), 'placed' (one stands on
 * it), 'price' (AUDIT PRE-MERGE 1003 B4: fighter `side` he lays no price on), 'stake' (under the least or over the
 * most), 'gold' (more than the purse).
 */
export function wagerRefusal(book, ex, stake, { gold = 0, begun = false, side = null } = {}) {
  if (!ex) return 'none';
  if (!ex.open || begun || bookSaw(book, ex.hour)) return 'closed';
  if (wagerOn(book, ex.hour)) return 'placed';
  if (side != null && !priceFor(exhibitionOdds(ex)[side === 1 ? 1 : 0])) return 'price';
  if (!(stake >= STAKE_MIN && stake <= STAKE_MAX)) return 'stake';
  if (stake > gold) return 'gold';
  return null;
}
/** PLACE a wager of `stake` gold on fighter `side` of `ex`: `{ ok, book, reason, cost }` - the host takes `cost` from the
 *  purse. A new book. */
export function placeWager(book, ex, side, stake, { gold = 0, begun = false, gameMinutes = 0 } = {}) {
  const b = bookRestore(book);
  const s = Math.floor(Number(stake) || 0);
  const reason = wagerRefusal(b, ex, s, { gold, begun, side: side === 1 ? 1 : 0 });   // AUDIT PRE-MERGE 1003 B4: the side's price
  if (reason) return { ok: false, book: b, reason, cost: 0 };
  const odds = exhibitionOdds(ex);
  const [num, den] = /** @type {[number, number]} */ (priceFor(odds[side === 1 ? 1 : 0]));
  const names = ex.opponents.map((o, i) => fighterIdentity(ex.seed, i, o.mobile).name);
  b.wagers.unshift({ hour: ex.hour, side: side === 1 ? 1 : 0, stake: s, num, den, names: [names[0], names[1]], at: Math.floor(gameMinutes), status: 'open', paid: 0, seen: false });
  b.wagers = b.wagers.slice(0, WAGERS_KEPT);
  b.staked += s;
  return { ok: true, book: b, reason: null, cost: s };
}
/** THE VERDICT SEEN on this screen for the exhibition of `hour` (`side` 0 / 1, null a draw, BOUT_LEFT left after its
 *  word): kept, so the wager on it is settled by what was seen rather than the house's record. A new book.
 *  AUDIT PRE-MERGE 1003 B3: kept whether or not a wager stands on it - the book on an hour seen here takes none after
 *  (wagerRefusal): once its bout was gone the word no longer shut it, and a wager on a winner already seen was taken. */
export function bookVerdict(book, hour, side) {
  const b = bookRestore(book);
  b.seen = [{ hour, side: seenSide(side) }, ...b.seen.filter((s) => s.hour !== hour)].slice(0, WAGERS_KEPT);
  return b;
}
/**
 * SETTLE what can be settled at `gameMinutes`: each open wager whose bout was seen to its verdict, or whose hour is out
 * (the house's record) - unless its bout stands on the sand here now (`liveHour`). A winner's stake and price owed, a
 * draw's stake owed, a loser's stake the house's. `{ book, settled }` - a new book and the wagers just settled.
 */
export function settleBook(book, gameMinutes, { liveHour = null } = {}) {
  const b = bookRestore(book);
  const settled = [];
  for (const w of b.wagers) {
    if (w.status !== 'open') continue;
    const seen = b.seen.find((s) => s.hour === w.hour);
    let side;
    if (seen) side = seen.side;
    else if (liveHour !== w.hour && gameMinutes >= (w.hour + 1) * 60) { const ex = exhibitionFor(w.hour * 60); side = ex ? houseOutcome(ex) : null; }
    else continue;
    w.seen = !!seen;
    if (side === null) { w.status = 'draw'; w.paid = w.stake; }
    else if (side === w.side) { w.status = 'won'; w.paid = payoutFor(w.stake, [w.num, w.den]); b.won += w.paid - w.stake; }
    else { w.status = 'lost'; w.paid = 0; b.lost += w.stake; }
    b.owed += w.paid;
    settled.push(w);
  }
  // AUDIT PRE-MERGE 1003 B3: the verdicts seen are kept (the newest WAGERS_KEPT - bookVerdict), settled or never wagered
  // on: each shuts its hour's book
  return { book: b, settled };
}
/** COLLECT at the bookmaker's stall: `{ book, gold }` - what he owed, paid. */
export function collectWinnings(book) {
  const b = bookRestore(book);
  const gold = b.owed;
  b.owed = 0;
  return { book: b, gold };
}

// ── WHAT THE WINDOW AND THE STALL SAY ────────────────────────────────────────────────────────────────────────
/** A wager in a line: "50 gold on Gorlak gro-Mazgul at 7 to 4 - won 137 gold". */
export function wagerLine(w) {
  const on = B().wagerOn(w.stake, w.names[w.side] || ARENA_TEXT.window.fighter, oddsText([w.num, w.den]));
  if (w.status === 'open') return `${on} - ${B().open}`;
  if (w.status === 'won') return `${on} - ${B().wonLine(w.paid)}`;
  if (w.status === 'draw') return `${on} - ${B().drawLine}`;
  return `${on} - ${B().lostLine}`;
}
/** AUDIT PRE-MERGE 1003 B4: the line for each fighter of `ex` he lays no price on (`prices` theirs, priceFor's). */
const notLaid = (ex, prices) => prices.flatMap((pr, i) => (pr ? [] : [B().notLaid(fighterIdentity(ex.seed, i, ex.opponents[i].mobile).name)]));
/** The book's lines for a page: each wager, newest first. */
export const bookLines = (league, _gameMinutes) => bookRestore(league?.book).wagers.map((w) => ({ text: wagerLine(w), status: w.status, hour: w.hour }));

/**
 * THE EXHIBITION'S CARD, as the book sees it: each fighter's record and price, the favourite, the wager standing on it,
 * why no wager may be taken (`why` - a line, or null), and the stakes the purse allows.
 */
export function exhibitionCard(league, ex, gameMinutes, { gold = 0, begun = false, atGate = true } = {}) {
  const book = league?.book;
  const odds = exhibitionOdds(ex);
  const prices = odds.map(priceFor);
  const recs = [0, 1].map((i) => exhibitionRecord(ex, i));
  const w = wagerOn(book, ex.hour);
  const why = !ex.open || begun || bookSaw(book, ex.hour) ? B().whyClosed : w ? B().whyPlaced : !atGate ? ARENA_TEXT.window.whyGate : gold < STAKE_MIN ? B().whyGold : null;   // AUDIT PRE-MERGE 1003 B3: a bout seen here
  return {
    records: recs.map((r) => ARENA_TEXT.window.wl(r.wins, r.losses)), odds: prices.map(oddsText), prices,
    favourite: odds[0] >= odds[1] ? 0 : 1, chances: odds, why, wager: w ? wagerLine(w) : '',
    stakes: STAKES.filter((s) => s <= gold),
    lines: notLaid(ex, prices),   // AUDIT PRE-MERGE 1003 B4: a side he lays no price on, said
    kinds: ex.opponents.map((o) => enemyDisplayName(o.mobile) ?? ''),
  };
}

/**
 * THE BOOKMAKER'S CHOICE at the gate: his patter, the hour's bout and its prices, the wager standing, what he owes - and
 * the presses: collect, back either fighter (then the stake, `stakeChoice`), the Arena window, leave. Pure.
 * @param {{ league: any, gameMinutes: number, gold: number, begun?: boolean, window?: boolean }} o
 */
export function bookmakerChoice({ league, gameMinutes, gold, begun = false, window = true }) {
  const book = bookRestore(league?.book);
  const ex = exhibitionFor(gameMinutes);
  const lines = [...B().greet, ''];
  const options = [];
  if (book.owed > 0) { lines.push(B().owes(book.owed)); options.push({ code: 'KeyC', label: B().collect(book.owed), act: 'collect' }); }
  if (!ex) lines.push(B().shut);
  else {
    const names = ex.opponents.map((o, i) => fighterIdentity(ex.seed, i, o.mobile).name);
    const prices = exhibitionOdds(ex).map(priceFor);
    lines.push(B().bout(names[0], names[1]));
    const recs = [0, 1].map((i) => exhibitionRecord(ex, i));
    lines.push(B().priced(names[0], oddsText(prices[0]), ARENA_TEXT.window.recordLine(recs[0].wins, recs[0].losses)));
    lines.push(B().priced(names[1], oddsText(prices[1]), ARENA_TEXT.window.recordLine(recs[1].wins, recs[1].losses)));
    const w = wagerOn(book, ex.hour);
    const why = wagerRefusal(book, ex, Math.min(gold, STAKE_MIN), { gold, begun });
    if (w) lines.push(B().standing(wagerLine(w)));
    else if (why === 'closed') lines.push(B().whyClosed);
    else if (why === 'gold' || why === 'stake') lines.push(B().whyGold);
    else {
      lines.push(B().edge);
      lines.push(...notLaid(ex, prices));   // AUDIT PRE-MERGE 1003 B4: a side he lays no price on is not offered, and said
      if (prices[0]) options.push({ code: 'KeyA', label: B().back('A', names[0], oddsText(prices[0])), act: 'back0' });
      if (prices[1]) options.push({ code: 'KeyB', label: B().back('B', names[1], oddsText(prices[1])), act: 'back1' });
    }
  }
  if (window) options.push({ code: 'KeyW', label: B().window, act: 'window' });
  options.push({ code: 'KeyL', label: B().leave, act: 'leave' });
  options.push({ code: 'Escape', label: null, act: 'leave' });
  return { lines, options, exhibition: ex };
}
/** THE STAKE: the stakes the purse allows, a key each ("1 - 10 gold"), and never mind. */
export function stakeChoice({ name, price, gold }) {
  const can = STAKES.filter((s) => s <= gold);
  return {
    lines: [B().howMuch(name, price)],
    options: [
      ...can.map((s, i) => ({ code: `Digit${i + 1}`, label: B().stake(i + 1, s), act: 'stake', stake: s })),
      { code: 'KeyN', label: B().never, act: 'stay' }, { code: 'Escape', label: null, act: 'stay' },
    ],
  };
}
