// @ts-check
// COURT-DEEDS (2026-10-26, Discord #feature-feedback "Better Courtship" - lumin: "There should be specific interactions
// with NPC for courtship. Compliments, giving gifts, hugging, kissing ... Right now it's confusing on what exactly you're
// supposed to use to improve relationships"; Revy: "the only thing that seems to work is to have 1 conversation per day
// with an NPC, with specific attitude (blunt etc), to raise their disposition by 1 point";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md): THE DEEDS OF A COURTSHIP - four things the one played can do for a
// townsperson of a household, each on the Tell me about page beside Courtship, each once a day per resident, and each
// answer SAYING what it moved, since a regard and a courtship's affection were numbers the player never saw move:
//
//  - PAY A COMPLIMENT: anyone courtable. Regard +2 (relations.js EVENTS.compliment); a courtship's affection +3, +1
//    more in a tone they take kindly. In a tone they take ill it falls flat - nothing gained, and the tone's own cost
//    stands and is said with it (the row hears the tone itself: townTalk.js `hearsTone`, AUDIT FB1026d B3).
//  - GIVE A GIFT: anyone courtable, GIFT_GOLD from the purse (court.js deductGold - coin, then letters of credit).
//    Regard +8 (EVENTS.gift, which LW1 named and no door ever paid); affection +6.
//  - HUG: from one they count a FRIEND (FRIEND_AT), one courting them, or their spouse. Regard +3; affection +5.
//  - KISS: in a courtship at KISS_AT affection or past it (the "I like your company" of MARRIAGE_TEXT.courted), a
//    betrothal, or a marriage. Regard +4; affection +8.
//
// A hug or a kiss not yet welcome is refused kindly and SAYS what it waits on - nothing lost, nothing counted. A spouse
// takes every deed (regard alone: a marriage has no affection to fill). A friend comes in about three days of play with
// the talk in a tone they like, a compliment and a gift each day (eight without the gift) where the talk alone took
// twelve, and, with Courtship's own day, a courtship to Marriage in about four where Courtship
// alone took eight to ten (AUDIT FB1026d B6, II F3: measured over the real relations and courtGain).
//
// PURE: the law and the words. The host (scenes/legacyHost.js topicRows) offers the rows, notes the regard on the
// Living World's relations, takes the gold and keeps the affection in the house's record (marriage.js warmCourtship).
import { FRIEND_AT, EVENTS } from '../livingWorld/relations.js';
import { AFFECTION_MAX, courtable, spouseOf, residentInHouse, betrothedElsewhere } from './marriage.js';
import { t } from '../textManager.js';

/** The deeds, in the page's order. */
export const DEEDS = Object.freeze(['compliment', 'gift', 'embrace', 'kiss']);
/** A courtship's affection each deed adds (marriage.js AFFECTION_MAX fills it). */
export const DEED_AFFECTION = Object.freeze({ compliment: 3, gift: 6, embrace: 5, kiss: 8 });
/** A compliment in a tone they take kindly: this much more affection. */
export const COMPLIMENT_TASTE = 1;
/** The affection a kiss is welcome at - MARRIAGE_TEXT.courted's second tier. */
export const KISS_AT = 34;
/** What a gift costs. */
export const GIFT_GOLD = 50;

/**
 * The deeds a resident offers the member, in the page's order: every deed to a courtable townsperson (a hug or a kiss
 * not yet welcome is offered, and its refusal says what it waits on) and to the member's own spouse - none to one of the
 * house or one another member is betrothed to; a member wed to another offers no kiss (marriage.js topicsFor's law).
 * @param {any} family @param {any} member @param {{ id: string }} res
 */
export function deedsFor(family, member, res) {
  if (!family || !member || !res?.id) return [];
  const spouse = spouseOf(family, member);
  if (spouse?.residentId === res.id) return [...DEEDS];
  if (!courtable(res) || residentInHouse(family, res.id) || betrothedElsewhere(family, member, res.id)) return [];
  return spouse ? DEEDS.filter((k) => k !== 'kiss') : [...DEEDS];
}

/** The row's label. @param {string} kind */
export function deedLabel(kind) {
  if (kind === 'compliment') return t('legacy.deed.compliment', 'Pay a compliment');
  if (kind === 'gift') return t('legacy.deed.gift', 'Give a gift ({gold, number} gold)', { gold: GIFT_GOLD });
  if (kind === 'embrace') return t('legacy.deed.embrace', 'Hug');
  return t('legacy.deed.kiss', 'Kiss');
}

/** The player's side, by tone (Polite, Normal, Blunt). @param {string} kind @param {number} [tone] */
export function deedQuestion(kind, tone = 1) {
  const i = Math.max(0, Math.min(2, tone | 0));
  if (kind === 'compliment')
    return [
      t('legacy.deed.complimentPolite', 'May I say, you look very well today.'),
      t('legacy.deed.complimentNormal', 'You look good today.'),
      t('legacy.deed.complimentBlunt', 'You look great.'),
    ][i];
  if (kind === 'gift') return t('legacy.deed.giftAsk', 'I brought you something.');
  if (kind === 'embrace') return t('legacy.deed.embraceAsk', 'Come here.');
  return t('legacy.deed.kissAsk', 'You lean in for a kiss.');
}

/**
 * Why a deed is not welcome yet, or null: 'friend' (a hug waits on their counting you a friend), 'court' (a kiss on a
 * courtship at KISS_AT). `courtship` the member's courtship of them (marriage.js), `spouse` whether they are the
 * member's spouse.
 * @param {string} kind @param {{ regard: number, courtship?: any, spouse?: boolean }} o
 */
export function deedRefusal(kind, { regard, courtship = null, spouse = false }) {
  if (spouse) return null;
  if (kind === 'embrace' && !courtship && !(regard >= FRIEND_AT)) return 'friend';
  if (kind === 'kiss' && !(courtship && (courtship.betrothed || courtship.affection >= KISS_AT))) return 'court';
  return null;
}

/** The affection a deed adds to a courtship begun and not yet full (a betrothal and a marriage take none).
 *  `taste` toneTaste's 1, 0 or -1: a compliment in a tone taken ill adds none, one taken kindly COMPLIMENT_TASTE more.
 *  @param {string} kind @param {number} taste */
export function deedAffection(kind, taste = 0) {
  if (kind === 'compliment') return taste < 0 ? 0 : DEED_AFFECTION.compliment + (taste > 0 ? COMPLIMENT_TASTE : 0);
  return DEED_AFFECTION[/** @type {keyof typeof DEED_AFFECTION} */ (kind)] ?? 0;
}

/** The regard a deed adds (relations.js EVENTS), 0 for a compliment taken ill. @param {string} kind @param {number} taste */
export const deedRegard = (kind, taste = 0) =>
  kind === 'compliment' && taste < 0 ? 0 : (EVENTS[/** @type {keyof typeof EVENTS} */ (kind)] ?? 0);

/** What the deed moved, said after the answer: "(Regard +2, now 14. Courtship +4, now 41 of 100.)" - `gained` the whole
 *  answer's, the tone's with it; the courtship while one is begun and not yet betrothed (at the full mark it says so: a
 *  proposal waits). @param {{ regard: number, gained: number, affection?: number | null, warmed?: number }} o */
export function deedTally({ regard, gained, affection = null, warmed = 0 }) {
  const r = Math.trunc(regard);
  const said = t('legacy.deed.tallyRegard', 'Regard {gained}, now {regard}.', {
    gained: `${gained >= 0 ? '+' : ''}${Math.trunc(gained)}`,
    regard: `${r > 0 ? '+' : ''}${r}`,
  });
  if (affection == null) return `(${said})`;
  return `(${said} ${t('legacy.deed.tallyCourt', 'Courtship {warmed}, now {affection, number} of {max, number}.', { warmed: `+${warmed}`, affection, max: AFFECTION_MAX })})`;
}

/** The resident's answers. `name` their given name. */
export const DEED_TEXT = Object.freeze({
  compliment: (name) => t('legacy.deed.complimented', '{name} smiles. "Flatterer. Say it again tomorrow."', { name }),
  flat: (name) => t('legacy.deed.flat', '{name} frowns. "Is that meant to be a compliment?"', { name }),
  gift: (name) => t('legacy.deed.gifted', '{name} turns the gift over in their hands. "For me? Thank you."', { name }),
  poor: (name) =>
    t('legacy.deed.poor', "You haven't the {gold, number} gold for a gift worthy of {name}.", {
      name,
      gold: GIFT_GOLD,
    }),
  embrace: (name) => t('legacy.deed.embraced', '{name} holds you close for a moment.', { name }),
  kiss: (name) => t('legacy.deed.kissed', '{name} kisses you back.', { name }),
  again: (name) => t('legacy.deed.again', '{name} laughs. "Once a day is plenty. Tomorrow."', { name }),
  notFriend: (name) =>
    t(
      'legacy.deed.notFriend',
      '{name} steps back. "We hardly know each other." (A hug needs them to count you a friend: regard +{at, number}.)',
      { name, at: FRIEND_AT },
    ),
  notCourting: (name) =>
    t(
      'legacy.deed.notCourting',
      '{name} turns their cheek. "Not yet." (A kiss needs a courtship of {at, number} or more - ask about Courtship once you are friends.)',
      { name, at: KISS_AT },
    ),
});
