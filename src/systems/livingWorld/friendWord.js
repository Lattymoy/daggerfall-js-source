// @ts-check
// FIELD BUGS 2026-10-21d REGARD-OWN, its other half (lumin: "Better feedback and controls on finding a spouse"): THE
// MOMENT A RESIDENT BECOMES A FRIEND IS SAID. A friend (relations.js FRIEND_AT) is where a courtship begins
// (legacy/marriage.js topicsFor), and nothing marked it: the Courtship row appeared under Tell me about the next time the
// list was read, and a player in the classic skin - no regard badge - had no way to know it had happened, nor what had
// made it. Whatever carries a resident's regard into friendship - a word, its tone, a deed (regardClock.js friendsMade
// counts them where the regard is written) - is said on the HUD, and where the house can court them, where to ask.
import { t } from '../textManager.js';
import { residentOfId } from './people.js';

const FRIEND_TEXT = '{name} counts you a friend now.';
const FRIEND_COURT_TEXT = '{name} counts you a friend now. You can court them: ask about Courtship under Tell me about.';

/** The line for a friend made. @param {{ name: string, court: boolean }} who - their name, and whether the Courtship row
 *  is theirs now */
export function friendLine({ name, court }) {
  return court ? t('livingWorld.friend.court', FRIEND_COURT_TEXT, { name }) : t('livingWorld.friend.made', FRIEND_TEXT, { name });
}

/**
 * AUDIT FB1021d RO-4: the friends made, as the line names them - each id the relations counted, the resident it names
 * minted again from their town (people.js residentOfId), and whether the house's Courtship row is theirs. An id that names
 * no resident of a town known is not said.
 * @param {string[]} ids @param {(mapId: number) => any} townOf
 * @param {(person: any) => { topic?: string }[]} topicsOf - the legacy's Tell me about rows for a person (a resident's
 *  body: `{ living: { res } }`, as the talk hands it - world.js legacyTopicRows)
 * @returns {{ name: string, court: boolean }[]}
 */
export function friendCards(ids, townOf, topicsOf) {
  return ids.map((id) => residentOfId(id, townOf)).filter(Boolean)
    .map((res) => ({ name: res.name, court: (topicsOf({ living: { res } }) ?? []).some((r) => r.topic === 'court') }));
}
