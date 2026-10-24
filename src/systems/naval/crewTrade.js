// @ts-check
// CREW-TRADE (2026-10-23, the owner: "add crew as a resource that can be sold and traded"; asked, the owner chose "Exchange
// good only" - crew bought and sold at the port exchange straight into and out of the ship at the quay, priced per port
// like the other goods - a headcount, and a price that varies by port; bible/03-World/Captains-Sea.md CREW-TRADE) - THE
// CREW AT THE EXCHANGE, her side of it. The row is the exchange's (tradeGoods.js CREW, exchangeOf's `crew`: a port's stand
// to sailors, the day's drift, the spread, the day's stock); here, what the exchange pays for a man at most, how many men
// may leave her and how many more she takes, and the words.
//
// WHAT A MAN FETCHES (`crewPayMost`): a gold under what the shipwright asks for one at most (navalYard.js yardOffer's own
// price for a hand, at the captain's yard discount) - or a captain hires at the yard and sells at the exchange for
// something, as often as the exchange's day allows. A port short of men pays near the yard's price; one with men to spare
// sells them at well under it, so the exchange is the cheaper way to fill her where sailors are to be had.
//
// WHO MAY LEAVE HER (`crewSpare`): men by the head, never a named hand carried over; never her last man (a ship with
// nobody aboard strikes - crewHall.js releasePlan's law); never a named hand in the player's shore party, nor so many
// that her deck stands no named hand aboard beside them; and none of a ship that came into the realm through customs
// (fleet.js fleetCrossed - RESTORE's "Keep all, can't sell": her men are an offline save's). Men signed on raise her crew
// to her whole at most (`crewRoom`).
//
// WHICH NAMED HANDS GO WITH THEM (`signOffOrder`, AUDIT CREW-TRADE H1): the ones least worth losing first - a plain hand
// before a post's holder, her First Mate last of all, a hand of the deck's own before a crew hall's recruit (his fee paid),
// the less service before the more, and of the rest the last to join. The tail went first (the sync's order), and the
// tail is where a hall's recruit stands: one press of Sell 1 paid off a Veteran First Mate signed on for 1,120 gold, his
// post and the spirits he lifted with him, for one man's price and unsaid. Each hand who goes is named, as each who joins.
//
// Pure: no DOM, no clock. Not a DFU member - Daggerfall has no ships. Ledger A (CREW-TRADE).
import { CREW, exchangeOf } from './tradeGoods.js';
import { yardOffer } from './navalYard.js';
import { playerCrewCount } from './crewLife.js';
import { FIRST_MATE, serviceOf } from './shipCrew.js';
import { t } from '../textManager.js';   // the exchange's words in the player's language

/** The fewest men a ship keeps aboard: her last is never signed off. */
export const CREW_LEAST = 1;

/** What the shipwright asks for a man at `discount` (a captain's rank's - navalYard.js yardOffer's own crew row). */
export const yardHandPrice = (discount = 0) => yardOffer({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 0, maxCrew: 1 }, 0, 0, { discount }).rows.find((r) => r.id === 'crew')?.price ?? 0;
/** The most the exchange pays for a man: a gold under the shipwright's price for one (never under a gold). */
export const crewPayMost = (discount = 0) => Math.max(1, Math.ceil(yardHandPrice(discount) - 1e-9) - 1);

/**
 * CREW'S ROW AT A PORT'S EXCHANGE TODAY: exchangeOf's (its stand, its two prices, how many more it signs on - `sells` -
 * and takes off her - `buys`), what it pays for a man held under the shipwright's price (`crewPayMost` at `discount`).
 * @param {{ key: string, crown?: string|null, ether?: boolean }} port @param {number} day
 * @param {{ dealt?: { sold?: any, bought?: any }, edge?: number, town?: { ask: number, pay: number } | null, discount?: number }} [o]
 */
export function crewRowOf(port, day, { dealt = {}, edge = 0, town = null, discount = 0 } = {}) {
  const r = exchangeOf(port, day, dealt, edge, town, true)[0];
  return { ...r, buy: Math.min(r.buy, crewPayMost(discount)) };
}

/**
 * HOW MANY MEN MAY LEAVE HER: `crew` her crew now, `hands` her named hands (shipCrew.js), `away` the names of hers in the
 * player's shore party, `crossed` whether she came into the realm through customs. Answers `{ n, why }` - `why` the
 * reason none may, or null. Pure.
 * @param {{ hull: number, crew: number, hands?: readonly { name: string }[], away?: { has: (name: string) => boolean } | null, crossed?: boolean }} o
 */
export function crewSpare({ hull, crew, hands = [], away = null, crossed = false }) {
  if (crossed) return { n: 0, why: CREW_TRADE_TEXT.crossed };
  const now = Math.max(0, Math.floor(Number(crew) || 0));
  const party = hands.filter((h) => away?.has?.(h?.name));
  const need = party.length ? party.length + 1 : 0;   // the shore party's places, and one hand aboard beside them
  let least = CREW_LEAST;
  while (least < now && playerCrewCount(hull, least) < need) least++;
  const n = Math.max(0, now - least);
  return { n, why: n > 0 ? null : now > CREW_LEAST && party.length ? CREW_TRADE_TEXT.ashore(party.at(-1).name) : CREW_TRADE_TEXT.lastMan };
}
/**
 * THE NAMED HANDS IN THE ORDER A HEADCOUNT SALE SIGNS THEM OFF (AUDIT CREW-TRADE H1): never one in the shore party (`away`);
 * a plain Deckhand before a post's holder (a Bard's calling is his post), her First Mate last of all; a hand of the deck's
 * own before a crew hall's recruit; the less service (shipCrew.js serviceOf) before the more; of the rest, the last to join
 * first. Pure. @param {readonly any[]} hands @param {{ has: (name: string) => boolean } | null} [away]
 */
export function signOffOrder(hands, away = null) {
  const worth = (h, i) => [h.role === FIRST_MATE ? 1 : 0, h.role !== 'Deckhand' ? 1 : 0, h.hall ? 1 : 0, serviceOf(h), -i];
  const before = (a, b) => { for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return a[j] - b[j]; return 0; };
  return hands.map((h, i) => ({ h, w: worth(h, i) })).filter(({ h }) => !away?.has?.(h.name)).sort((a, b) => before(a.w, b.w)).map(({ h }) => h);
}
/** Named hands as the exchange's note names them: "Name (Post), Name (Post)". @param {readonly { name: string, role: string }[]} hands */
export const handsNamed = (hands) => hands.map((h) => `${h.name} (${h.role})`).join(', ');
/** How many more men she takes: her whole less her crew now. @param {{ crew: number, maxCrew: number }} d */
export const crewRoom = (d) => Math.max(0, Math.floor((Number(d?.maxCrew) || 0) - (Number(d?.crew) || 0)));

/** The exchange's words for crew, in the player's language (each asked as it is said). AUDIT CREW-TRADE O2: `gold` a
 *  number, its word the language's own (it came as English, "90 gold" and its en-US comma, inside every language's
 *  sentence); O3: the refusals and the row's own words the crew's, never the crew hall's English. */
export const CREW_TRADE_TEXT = Object.freeze({
  bought: (n, gold) => t('sea.crew.bought', 'Signed on {n, plural, one {# man} other {# men}} for {gold, number} gold.', { n, gold }),   // AUDIT CREW-TRADE R4: a man, as the row counts him
  sold: (n, gold) => t('sea.crew.sold', 'Signed off {n, plural, one {# man} other {# men}} for {gold, number} gold.', { n, gold }),
  short: (gold) => t('sea.crew.short', 'Not enough gold - {gold, number} gold a man.', { gold }),
  get noneToday() { return t('sea.crew.noneToday', 'The exchange has no more sailors to sign on today.'); },
  get noneWanted() { return t('sea.crew.noneWanted', 'The exchange will take no more crew today.'); },
  get full() { return t('sea.crew.full', 'The ship has her whole crew aboard.'); },
  get noCrew() { return t('sea.crew.noCrew', 'This ship carries no crew.'); },
  get crossed() { return t('sea.crew.crossed', 'This ship came through customs with her crew. The exchange takes none of them.'); },
  ashore: (who) => t('sea.crew.ashore', '{who} is in your shore party. Send them back aboard first.', { who }),   // AUDIT CREW-TRADE H2: on deck at the helm, his place kept for the shore
  signedOn: (names) => t('sea.crew.signedOn', 'Signed on: {names}.', { names }),   // AUDIT CREW-TRADE H3
  paidOff: (names) => t('sea.crew.paidOff', 'Paid off: {names}.', { names }),   // AUDIT CREW-TRADE H1
  get fighting() { return t('sea.crew.fighting', 'Not while the ship is in combat.'); },
  get lastMan() { return t('sea.crew.lastMan', 'That\'s your last crew member. The ship would have nobody aboard.'); },
  get charter() { return t('sea.crew.charter', 'Her crew are her master\'s. You only booked passage.'); },   // AUDIT CREW-TRADE E1
  get title() { return t('sea.crew.title', 'Crew'); },
  buyAt: (gold, left) => t('sea.crew.buyAt', 'buy at {gold, number} gold a man ({left} left today)', { gold, left }),
  sellAt: (gold, wanted) => t('sea.crew.sellAt', 'sell at {gold, number} gold ({wanted} wanted)', { gold, wanted }),
  get noneToBuy() { return t('sea.crew.noneToBuy', 'none to sign on today'); },
  get noneTaken() { return t('sea.crew.noneTaken', 'none wanted today'); },
});
