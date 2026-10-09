// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOUSE-WAITS (FIELD BUGS 2026-10-09f, Sahh: "Blocked out of continuing as another bloodline character" - "My bloodline
// permadeath character with two siblings died, and I was for a brief second shown the prompt to continue playing as one
// of the two remaining siblings. The game however loaded me back into main menu right after and now despite the
// bloodline still having two characters left in it, I cannot access those characters in any way.").
//
// THE DEAD END. A Bloodline fall leaves its Succession waiting on the record (`family.pending`), and the only door to it
// was a save of the line loaded into the world: the fallen's (THE PAST) or a living member's. Online a fall is the
// realm's TOMBSTONE - the fallen leaves the roster and the realm refuses their join - and a sibling never played has no
// character at all. So a birth that did not take (it goes back to the title, said: "load the fallen's save to try
// again") left a line with living members and no character of it anywhere on the Online page: nothing to press.
//
// THE DOOR: the Online page names every line of the account whose Succession waits (`waitingHouses`) and the members
// who may take it up, each with a button; the press is the Succession's own choice of a living member (legacyHost.js
// succeed) made from the menu (`takeUpLine`): the heir the line's current, of age (LEGACY5's departure, as succeed
// says it), the record stored and written to the realm, the birth left for the boot - which is the world host's own
// birth door (`?online&realmnew&legacyborn=`), so the birth, its first save and the fall's settling are the law that
// already ran. Pure where it can be: storage, the tab and the realm line come in.
// ═══════════════════════════════════════════════════════════════════
import { MODELS, isAlive, personOf, fullNameOf, setCurrent, touch } from './family.js';
import { loadFamily, storeFamily, leaveBirth } from './store.js';

/** The town a member is born in when the line has no seat (legacyHost.js play's last answer). */
export const DEFAULT_BIRTH_PLACE = Object.freeze({ region: 'Daggerfall', loc: 'Daggerfall' });

/**
 * THE LINES WHOSE SUCCESSION WAITS, and who may answer it: `[{ family, fallen, heirs }]`. A line is listed while its fall
 * is unanswered (`pending`) and it has not ended; an heir is a living member of the blood (never one wed in), not
 * retired, never the fallen - a child too (succeed brings them of age) - who has no living character to be played as
 * (`played(characterId)`: online the account's roster holds them, and they are joined from there).
 * @param {any[]} families @param {{ played?: (characterId: string) => boolean }} [opts]
 */
export function waitingHouses(families, { played = () => false } = {}) {
  const out = [];
  for (const family of Array.isArray(families) ? families : []) {
    const pend = family?.pending;
    if (!pend || family.ended != null || !Array.isArray(family.people)) continue;
    const heirs = family.people
      .filter((p) => isAlive(p) && (p.kind ?? 'member') === 'member' && p.retired == null && p.id !== pend.fallenId)
      .filter((p) => !(p.characterId && played(String(p.characterId))))
      .sort((a, b) => (a.gen | 0) - (b.gen | 0) || a.id - b.id);
    if (heirs.length) out.push({ family, fallen: personOf(family, pend.fallenId), heirs });
  }
  return out;
}

/** The words of a waiting line's card. */
export const houseWaitsTitle = (family) => `The house of ${family?.surname || 'your family'} waits`;
export function houseWaitsLine(family, fallen) {
  const who = fallen ? fullNameOf(fallen.given, fallen.surname) : 'Its last member';
  return `${who} ${family?.model === MODELS.enduring ? 'has died of their years' : 'has fallen'}, and the house's Succession was never answered. Choose who carries the line on.`;
}
export const heirButtonLabel = (p) => `Carry on as ${fullNameOf(p.given, p.surname)}${p.minor ? ' (comes of age)' : ''}`;

/**
 * THE SUCCESSION'S CHOICE, MADE FROM THE MENU: line `familyId`'s member `personId` takes the mantle - of age, the line's
 * current, stored - and their birth is left for the boot in their seat (or Daggerfall). Answers `{ ok: true, family }`
 * (the caller writes it to the realm and boots `?online&realmnew&legacyborn=<personId>&region&loc`) or `{ ok: false,
 * why }`. A member who has been played and whose character stands is no birth: the roster plays them.
 * @param {{ storage: any, tab: any, familyId: string, personId: number, now?: number }} a
 */
export function takeUpLine({ storage, tab, familyId, personId, now = Date.now() }) {
  const family = loadFamily(storage, familyId);
  if (!family) return { ok: false, why: 'That house is not on this device. Play any character of the account online once, then try again.' };
  const base = family.rev;   // the store's rev this copy was made from (store.js storeFamily's `base`)
  const heir = personOf(family, personId);
  if (!heir || !isAlive(heir) || (heir.kind ?? 'member') !== 'member' || heir.retired != null || heir.id === family.pending?.fallenId) {
    return { ok: false, why: 'That member of the family cannot take up the line.' };
  }
  heir.minor = false;   // LEGACY5: they come of age in the telling (succeed's own line)
  heir.characterId = null;   // never played as a living character here: born (takeBorn asks the same)
  setCurrent(family, heir.id);
  touch(family);
  if (!storeFamily(storage, family, base)) return { ok: false, why: 'This device would not keep the family record. Free some space and try again.' };
  const place = family.seat?.region && family.seat?.loc ? family.seat : DEFAULT_BIRTH_PLACE;
  if (!leaveBirth(tab, { familyId: family.id, personId: heir.id, region: place.region, loc: place.loc, estate: 0 }, now)) {
    return { ok: false, why: 'This window would not keep the birth. Try again.' };
  }
  return { ok: true, family, place: { region: place.region, loc: place.loc } };
}
