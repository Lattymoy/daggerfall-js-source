// @ts-check
// WITCH1 (2026-10-20, bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL'S WORDS, in the player's language -
// every line the festival says, through the text core (`t`, Port_Strings), each read when it is shown (never at module
// load). The law (net/festivalLaw.js) is both ends' and shows no word. Kept short: what a player needs, nothing more.
//
// Not a DFU member. Ledger A (THE WITCHES' FESTIVAL).
import { t, intlLocale } from '../textManager.js';

export const festivalName = () => t('festival.name', "The Witches' Festival");
export const vendorOffice = () => t('festival.vendor.office', 'Wyrd Sister');
/** "1 Soul Cake", "12 Soul Cakes". */
export const cakesText = (/** @type {number} */ n) => t('festival.cakes', '{n, plural, one {# Soul Cake} other {# Soul Cakes}}', { n });

/** What a refusal says, by its code (server-account/src/festival.js's words; any other is the service unheard). */
const REFUSALS = Object.freeze({
  closed: () => t('festival.refusal.closed', 'The festival is not open.'),
  guest: () => t('festival.refusal.guest', 'Link an account to keep Soul Cakes.'),
  offline: () => t('festival.refusal.offline', 'The Wyrd cannot hear you right now.'),
  cakes: () => t('festival.refusal.cakes', 'You need more Soul Cakes.'),
  owned: () => t('festival.refusal.owned', 'You already own that.'),
  ware: () => t('festival.refusal.ware', 'The Wyrd Sister has no such thing.'),
  empty: () => t('festival.refusal.empty', 'The bowl is empty.'),
  taken: () => t('festival.refusal.taken', 'You already took a cake here today.'),
  own: () => t('festival.refusal.own', 'This offering is your own.'),
  full: () => t('festival.refusal.full', 'The bowl is full.'),
  home: () => t('festival.refusal.home', 'Set it out at your own home.'),
  set: () => t('festival.refusal.set', 'An offering already stands here.'),
  room: () => t('festival.refusal.room', 'There is no room for it by this door.'),
  none: () => t('festival.refusal.none', 'No offering of yours stands here.'),
  item: () => t('festival.refusal.item', 'You have no Hearth Offering.'),
  gone: () => t('festival.refusal.gone', 'This offering has been taken in.'),
  held: () => t('festival.refusal.held', 'Your account does not hold that.'),
  capped: () => t('festival.refusal.capped', 'You have found enough for today.'),
  rate: () => t('festival.refusal.rate', 'Too fast. Wait a moment.'),
});
/** Whether a refusal's code is the festival's own (every other is the account service's - net/accountClient.js). */
export const isFestivalRefusal = (/** @type {unknown} */ code) => typeof code === 'string' && Object.hasOwn(REFUSALS, code);
export const festivalRefusalText = (/** @type {unknown} */ code) => (typeof code === 'string' && Object.hasOwn(REFUSALS, code) ? REFUSALS[/** @type {keyof typeof REFUSALS} */ (code)]() : REFUSALS.offline());

/** CAKE-CAP-SAID: the day's finds spent - how many a day gives and the time (the player's own clock) the next day's open
 *  from: the UTC midnight `resetMs`. */
export const findsFullText = (/** @type {number} */ n, /** @type {number} */ resetMs) => t('festival.finds.full', 'You have found all {n, number} Soul Cakes a day allows. More can be found from {time}.', { n, time: clockText(resetMs) });
/** CAKE-CAP-SAID: the Wyrd's window - the day's finds so far, and once they are spent, when more are found. */
export const findsTodayText = (/** @type {number} */ n, /** @type {number} */ max) => t('festival.finds.today', 'Found today: {n, number} of {max, number} Soul Cakes.', { n, max });
export const findsTodayFullText = (/** @type {number} */ max, /** @type {number} */ resetMs) => t('festival.finds.todayFull', 'Found today: all {max, number} Soul Cakes. More from {time}.', { max, time: clockText(resetMs) });
/** A time of day in the player's language and zone ("8:00 PM", "20:00"). */
function clockText(/** @type {number} */ ms) {
  try { return new Intl.DateTimeFormat(intlLocale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(ms)); } catch { return ''; }
}
/** A find's line: "+2 Soul Cakes". */
export const cakesFoundText = (/** @type {number} */ n) => t('festival.found', '+{n, plural, one {# Soul Cake} other {# Soul Cakes}}', { n });
/** A festival's last day in the player's language ("7 November", "7 novembre") - the day before its end. */
export function lastDayText(/** @type {{ toMs: number } | null | undefined} */ f) {
  if (!f) return '';
  try { return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(f.toMs - 1)); } catch { return ''; }
}
/** The festival's notice, once a session, on the first town that keeps it. */
export const festivalNotice = (/** @type {string} */ last) => t('festival.notice', "The Witches' Festival: until {last}. Find a Wyrd Sister at any tavern.", { last });
/** A night the dead walk (the sky's 13 Frostfall or 3 Hearthfire, or the festival's own night - festivalLaw deadWalk). */
export const festivalNightText = () => t('festival.night', 'The dead walk tonight. Soul Cake finds are doubled.');
/** The Wyrd's Raiment's Soul Harvest (systems/sigil/sigilSetPowers.js): its name, its proc and its recovery's end. */
export const HARVEST_TEXT = Object.freeze({
  name: () => t('festival.harvest.name', 'Soul Harvest'),
  proc: (/** @type {number} */ n) => t('festival.harvest.proc', 'Soul Harvest! +{n}% health and magicka.', { n }),
  ready: () => t('festival.harvest.ready', 'Soul Harvest is ready again.'),
});
