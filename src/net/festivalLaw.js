// @ts-check
// WITCH1 (2026-10-20, the owner: "With Halloween on the horizon. I think its fair to develop our first live event.
// Daggerfall lore style"; bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL'S LAW - the one home both ends
// read: the client (the finds, the offerings, the Wyrd Sister's window) and the account service
// (server-account/src/festival.js), which holds every Soul Cake an account has.
//
// THE FESTIVAL is Daggerfall's own: the 13th of Frostfall, "known throughout Tamriel as the Witches' Festival when the
// forces of sorcery and religion clash" (TEXT.RSC 8392, PlayerEnterExit.ShowHolidayText's record for holiday 43). Online
// it runs on the real calendar - FESTIVALS, a row a year, a week past Halloween - and the sky's own Witches' Festival and
// Tales and Tallows (holiday 38, "the dead do walk tonight") double what a find gives while they last (a sky's day is a
// real hour), and so does the festival's own night, 31 October, a whole UTC day for every player at once.
//
// THE CAKES ARE THE ACCOUNT'S, as a Weir Key is (net/eliteGates/egLaw.js's model): the service rolls every find with its
// own die and caps a day's, every spend and every offering moves the service's count, and the pack's Soul Cakes are the
// count's face (systems/festival/soulCake.js restacks them on every answer).
//
// A leaf but for the holiday tables (systems/holidayTables.js, itself a leaf). Not a DFU member: DFU has no live events.
// Ledger A (THE WITCHES' FESTIVAL).
import { HOLIDAYS, holidayDayOfYear } from '../systems/holidayTables.js';

/** THE FESTIVALS, one a year: its id (the service's rows carry it), its first and its end instant (UTC ms; the end is
 *  not inside), and its own night's (`eveFromMs`, `eveToMs` - All Hallows' Eve's whole UTC day). 2026's opens 20 October
 *  and closes at the end of 7 November, a week past Halloween. */
export const FESTIVALS = Object.freeze([
  Object.freeze({ id: 'witches-2026', fromMs: Date.UTC(2026, 9, 20), toMs: Date.UTC(2026, 10, 8), eveFromMs: Date.UTC(2026, 9, 31), eveToMs: Date.UTC(2026, 10, 1) }),
]);
/** The festival open at `nowMs`, or null. Pure. */
export const festivalAt = (/** @type {number} */ nowMs) => (Number.isFinite(nowMs) ? FESTIVALS.find((f) => nowMs >= f.fromMs && nowMs < f.toMs) ?? null : null);
/** Whether a festival is open at `nowMs`. */
export const festivalOpen = (/** @type {number} */ nowMs) => festivalAt(nowMs) != null;
/** The festival open now or the next to come, or null when none is left. */
export const festivalNext = (/** @type {number} */ nowMs) => festivalAt(nowMs) ?? FESTIVALS.find((f) => f.fromMs > nowMs) ?? null;

/** THE NIGHTS THE DEAD WALK: the sky's Witches' Festival (13 Frostfall) and Tales and Tallows (3 Hearthfire), each kept
 *  in every region (holidayTables.js REGION_CELEBRATING_HOLIDAY's 0xFF). On either, a find gives twice. */
export const FESTIVAL_NIGHTS = Object.freeze([HOLIDAYS.Witches_Festival, HOLIDAYS.Tales_and_Tallow]);
const NIGHT_DAYS = Object.freeze(FESTIVAL_NIGHTS.map((id) => holidayDayOfYear(id)));
export const FIND_NIGHT_MULT = 2;
/** Whether a day of the year (1-based, the sky's) is one of the nights. Pure. */
export const festivalNight = (/** @type {number} */ dayOfYear) => NIGHT_DAYS.includes(dayOfYear);
/** Whether `nowMs` is inside an open festival's own night (31 October, UTC). Pure. */
export function festivalEve(/** @type {number} */ nowMs) {
  const f = festivalAt(nowMs);
  return !!f && nowMs >= f.eveFromMs && nowMs < f.eveToMs;
}
/** Whether the dead walk: the sky's night (`dayOfYear`), or the festival's own (`nowMs`). Pure. */
export const deadWalk = (/** @type {number} */ dayOfYear, /** @type {number} */ nowMs) => festivalNight(dayOfYear) || festivalEve(nowMs);

// ═══ THE ITEMS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The port's own templates, free past the gems' 1900-1931 (systems/festival/festivalRows.js holds their rows). */
export const SOUL_CAKE_TEMPLATE = 2000;
export const HEARTH_OFFERING_TEMPLATE = 2001;

// ═══ THE FINDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** What a find is asked for, and what the service's die gives it: a chance `p` and a count `n`. A foe by its kind (the
 *  dead and the summoned walk this festival), and an act by its kind's group (systems/questlines/qlActs.js ACT_KINDS). */
export const FIND_SOURCES = Object.freeze({
  foe: Object.freeze({ p: 0.25, n: 1 }),
  undead: Object.freeze({ p: 0.5, n: 1 }),
  daedra: Object.freeze({ p: 0.5, n: 1 }),
  elite: Object.freeze({ p: 1, n: 2 }),
  gather: Object.freeze({ p: 0.2, n: 1 }),
  make: Object.freeze({ p: 0.3, n: 1 }),
  loot: Object.freeze({ p: 0.3, n: 1 }),
  tavern: Object.freeze({ p: 1, n: 2 }),
  sea: Object.freeze({ p: 0.5, n: 2 }),
  world: Object.freeze({ p: 1, n: 2 }),
  endgame: Object.freeze({ p: 1, n: 4 }),
});
export const isFindSource = (/** @type {unknown} */ s) => typeof s === 'string' && Object.hasOwn(FIND_SOURCES, s);
/** A day's bounds an account (UTC days): the asks heard, and the cakes found. */
export const FIND_ASKS_PER_DAY = 1500;
export const FIND_CAKES_PER_DAY = 120;
/** What a find gives on a sky's day at `nowMs`: its count, twice while the dead walk (deadWalk). Pure. */
export const findCount = (/** @type {string} */ source, /** @type {number} */ dayOfYear, nowMs = NaN) => (isFindSource(source) ? FIND_SOURCES[source].n * (deadWalk(dayOfYear, nowMs) ? FIND_NIGHT_MULT : 1) : 0);

// ═══ THE HEARTH OFFERING ═════════════════════════════════════════════════════════════════════════════════════════════
/** A bowl holds this many cakes at most; a fill moves up to OFFERING_FILL from the owner's count. */
export const OFFERING_STOCK_MAX = 60;
export const OFFERING_FILL = 10;
/** Each account takes one cake an offering a UTC day, never from its own. */
export const OFFERING_TAKE = 1;
/** Hearthkeeper: the title an account's offerings earn, given this many cakes. The Soul Cake icon: taken this many. */
export const HEARTHKEEPER_GIVEN = 25;
export const SOULCAKE_TAKEN = 10;

// ═══ THE STARWARDEN'S PURSE ══════════════════════════════════════════════════════════════════════════════════════════
/** The Soul Cakes The Thirteenth of Frostfall's title pays beside it (bible/11-Multiplayer/Starfall.md section 7): laid on
 *  the account's count by the batch that lays Starwarden (server-account/src/questlines.js QL_PURSES), once an account,
 *  only while the festival is open for it, never to a guest. A quarter of a day's finds (FIND_CAKES_PER_DAY) - the line's
 *  four stars and its coven fight are the festival's longest deed. */
export const QL_STARWARDEN_CAKES = 30;

// ═══ THE WYRD SISTER'S WARES ═════════════════════════════════════════════════════════════════════════════════════════
/** The Wyrd's Raiment, the festival's Aetheric set (systems/aetheric.js WYRD_SET_PIECES mints each by its id). */
export const WYRD_PIECE_IDS = Object.freeze([
  'wyrd-hood', 'wyrd-right-mantle', 'wyrd-left-mantle', 'wyrd-robe', 'wyrd-gloves', 'wyrd-greaves', 'wyrd-boots', 'wyrd-hearthward', 'wyrd-athame',
]);
/** The festival's Iliac Hand cards (net/iliac/iliacCards.js FESTIVAL_CARD_IDS: kept out of every pack and every drop). */
export const FESTIVAL_CARD_IDS = Object.freeze(['warlock', 'thaumaturge', 'glenmoril-witch', 'demonologist', 'tales-and-tallows', 'spectre-of-lysandus']);
/** THE PROFILE ICONS the festival brings (net/identityToken.js ICONS): three sold, the Soul Cake's earned. */
export const FESTIVAL_ICONS = Object.freeze(['tallowskull', 'twinmoons', 'wyrdcauldron', 'soulcake']);
const ware = (/** @type {string} */ kind, /** @type {string} */ key, /** @type {number} */ price) => Object.freeze({ id: `${kind}:${key}`, kind, key, price });
/** EVERY WARE, in the window's order: `{ id, kind, key, price }`. The account's - a title, an aura, an icon - are bought
 *  once and kept; the pack's - a set piece, a card - are minted on the client once the service has taken the cakes; the
 *  Hearth Offering is counted on the account as its cakes are (`fest_bowls`), the pack's bowls its face. */
export const FESTIVAL_WARES = Object.freeze([
  ware('title', 'witchwarden', 60),
  ware('aura', 'witchfire', 150),
  ware('icon', 'tallowskull', 40),
  ware('icon', 'twinmoons', 40),
  ware('icon', 'wyrdcauldron', 40),
  ware('item', 'offering', 5),
  ...WYRD_PIECE_IDS.map((id) => ware('piece', id, id === 'wyrd-athame' ? 60 : id === 'wyrd-robe' ? 50 : 40)),
  ...FESTIVAL_CARD_IDS.map((id) => ware('card', id, id === 'spectre-of-lysandus' ? 45 : 20)),
]);
export const wareById = (/** @type {unknown} */ id) => (typeof id === 'string' ? FESTIVAL_WARES.find((w) => w.id === id) ?? null : null);
/** Whether a ware is the Hearth Offering - a bowl the account's count holds (bowlWare), never a piece minted. */
export const bowlWare = (/** @type {{ kind: string, key?: string } | null} */ w) => w != null && w.kind === 'item' && w.key === 'offering';
/** Whether a ware is the account's (bought once, kept). */
export const accountWare = (/** @type {{ kind: string } | null} */ w) => w != null && (w.kind === 'title' || w.kind === 'aura' || w.kind === 'icon');
/** The account wares a stored column holds (space-separated ids, the insignia's shape), known ones alone. */
export const festivalWaresHeld = (/** @type {unknown} */ col) => (typeof col === 'string' ? col.split(' ').filter((id) => accountWare(wareById(id))) : []);
/** A sale's request id: twelve hex digits the client mints, so a sale asked twice is one sale. */
export const SALE_RID_RE = /^[0-9a-f]{12}$/;
