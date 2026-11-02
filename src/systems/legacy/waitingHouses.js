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
import {
  MODELS,
  isAlive,
  personOf,
  fullNameOf,
  setCurrent,
  touch,
  newbornAllowed,
  addChild,
  rollSiblings,
} from './family.js';
import { loadFamily, storeFamily, leaveBirth } from './store.js';
import { t } from '../textManager.js'; // RPT1026-MISC HEIR-WAITS: the newborn's door, in the player's language
//
// RPT1026-MISC HEIR-WAITS (a private report: a high-level Bloodline character's death offered an heir, the game went back
// to the menu before one was chosen, and the parent was gone from the realm). THE NEWBORN'S DOOR. The Succession the fall offers is every living member of the blood
// AND, when the heir answer allows, a newborn heir of the fallen (legacyHost.js fallOutcome's `newborn`) - and this door
// named the living members alone. A line whose fallen left no sibling or child, its Succession left waiting by a page
// that went back to the title before the choice, had no card on the Online page and no character anywhere: the fallen is
// the realm's tombstone, and the heir the fall would have raised was never made. The card offers that newborn now, made
// here as the Succession makes them (legacyHost.js succeed: addChild, then rollSiblings, at the fall's own minute).

/** The town a member is born in when the line has no seat (legacyHost.js play's last answer). */
export const DEFAULT_BIRTH_PLACE = Object.freeze({ region: 'Daggerfall', loc: 'Daggerfall' });

/**
 * THE LINES WHOSE SUCCESSION WAITS, and who may answer it: `[{ family, fallen, heirs, newborn }]`. A line is listed while its fall
 * is unanswered (`pending`) and it has not ended; an heir is a living member of the blood (never one wed in), not
 * retired, never the fallen - a child too (succeed brings them of age) - who has no living character to be played as
 * (`played(characterId)`: online the account's roster holds them, and they are joined from there).
 * RPT1026-MISC HEIR-WAITS: `newborn` - the fall may raise a newborn heir (`settings`, the player's legacy settings,
 * answer the Descendants dial), and a line with that alone is listed too.
 * @param {any[]} families @param {{ played?: (characterId: string) => boolean, settings?: any }} [opts]
 */
export function waitingHouses(families, { played = () => false, settings = null } = {}) {
  const out = [];
  for (const family of Array.isArray(families) ? families : []) {
    const pend = family?.pending;
    if (!pend || family.ended != null || !Array.isArray(family.people)) continue;
    const heirs = family.people
      .filter((p) => isAlive(p) && (p.kind ?? 'member') === 'member' && p.retired == null && p.id !== pend.fallenId)
      .filter((p) => !(p.characterId && played(String(p.characterId))))
      .sort((a, b) => (a.gen | 0) - (b.gen | 0) || a.id - b.id);
    const fallen = personOf(family, pend.fallenId);
    const newborn = newbornOffered(family, fallen, settings); // RPT1026-MISC HEIR-WAITS: and a newborn of the fallen, as the Succession offers one
    if (heirs.length || newborn) out.push({ family, fallen, heirs, newborn });
  }
  return out;
}

/** FAMILY-REMOVE (FIELD BUGS 2026-10-29e): the account's lines (`ids`) no living realm character plays (`rows`, the
 *  roster - each its `lineage`), the ones the Online page offers to remove. */
export const spareLines = (/** @type {string[]} */ ids, /** @type {any[]} */ rows) => {
  const played = new Set((rows ?? []).map((r) => r?.lineage).filter(Boolean));
  return (ids ?? []).filter((id) => !played.has(id));
};
/** FAMILY-REMOVE: the families the Online page's card offers - the spare lines whose record the device holds (`load`) -
 *  or null for no card: none spare, or a roster the realm did not answer (`rowsOk`; AUDIT FB1029e F5). */
export function spareFamilies(
  /** @type {{ rows: any[] | null, rowsOk: boolean, lineIds: string[] | null, load: (id: string) => any }} */ at,
) {
  if (!at.rows || !at.rowsOk || !at.lineIds?.length) return null;
  const families = spareLines(at.lineIds, at.rows).map(at.load).filter(Boolean);
  return families.length ? families : null;
}
/** FAMILY-REMOVE: the account's lines with one removed. */
export const withoutLine = (/** @type {string[] | null} */ ids, /** @type {string} */ id) =>
  ids?.filter((x) => x !== id) ?? null;

/** The words of a waiting line's card. */
export const houseWaitsTitle = (family) => `The house of ${family?.surname || 'your family'} waits`;
export function houseWaitsLine(family, fallen) {
  const who = fallen ? fullNameOf(fallen.given, fallen.surname) : 'Its last member';
  return `${who} ${family?.model === MODELS.enduring ? 'has died of their years' : 'has fallen'}, and the house's Succession was never answered. Choose who carries the line on.`;
}
export const heirButtonLabel = (p) =>
  `Carry on as ${fullNameOf(p.given, p.surname)}${p.minor ? ' (comes of age)' : ''}`;
/** RPT1026-MISC HEIR-WAITS: the newborn's button - the Succession's own "A child of {given}" (world.js's choices). */
export const newbornButtonLabel = (fallen) =>
  t('legacy.houseWaits.newborn', 'Raise a child of {name} as your heir', {
    name: fallen?.given || fallen?.surname || '',
  });
/** RPT1026-MISC HEIR-WAITS: whether the waiting fall may raise a newborn heir - the Succession's own test (legacyHost.js
 *  fallOutcome): the heir answer rolled at the fallen's birth, the Descendants dial at Always, or an elder retired. */
const newbornOffered = (family, fallen, settings) =>
  !!fallen && (fallen.retired != null || newbornAllowed(family, fallen, settings));

/**
 * THE SUCCESSION'S CHOICE, MADE FROM THE MENU: line `familyId`'s member `personId` takes the mantle - of age, the line's
 * current, stored - and their birth is left for the boot in their seat (or Daggerfall). Answers `{ ok: true, family }`
 * (the caller writes it to the realm and boots `?online&realmnew&legacyborn=<personId>&region&loc`) or `{ ok: false,
 * why }`. A member who has been played and whose character stands is no birth: the roster plays them.
 * RPT1026-MISC HEIR-WAITS: `newborn` raises the fall's newborn heir instead of a member (`personId` unread), with the
 * player's legacy `settings` and the child's dice (`rng`).
 * @param {{ storage: any, tab: any, familyId: string, personId: number | null, now?: number, newborn?: boolean, settings?: any, rng?: () => number }} a
 */
export function takeUpLine({
  storage,
  tab,
  familyId,
  personId,
  now = Date.now(),
  newborn = false,
  settings = null,
  rng = Math.random,
}) {
  const family = loadFamily(storage, familyId);
  if (!family)
    return {
      ok: false,
      why: 'That house is not on this device. Play any character on this account online once, then try again.',
    };
  const base = family.rev; // the store's rev this copy was made from (store.js storeFamily's `base`)
  let heir = null;
  if (newborn) {
    // RPT1026-MISC HEIR-WAITS: the newborn made as the Succession makes them, born at the fall's own minute
    const fallen = personOf(family, family.pending?.fallenId);
    if (!family.pending || !newbornOffered(family, fallen, settings))
      return { ok: false, why: t('legacy.houseWaits.noNewborn', 'No heir can be raised for that house.') };
    const at = family.pending.at ?? 0;
    heir = addChild(family, fallen.id, { rng, at, settings }).person;
    rollSiblings(family, heir.id, { rng, at, settings });
  } else heir = personOf(family, personId);
  if (
    !heir ||
    !isAlive(heir) ||
    (heir.kind ?? 'member') !== 'member' ||
    heir.retired != null ||
    heir.id === family.pending?.fallenId
  ) {
    return { ok: false, why: 'That member of the family cannot take up the line.' };
  }
  heir.minor = false; // LEGACY5: they come of age in the telling (succeed's own line)
  heir.characterId = null; // never played as a living character here: born (takeBorn asks the same)
  setCurrent(family, heir.id);
  touch(family);
  if (!storeFamily(storage, family, base))
    return { ok: false, why: 'The family record could not be saved on this device. Free some space and try again.' };
  const place = family.seat?.region && family.seat?.loc ? family.seat : DEFAULT_BIRTH_PLACE;
  if (
    !leaveBirth(
      tab,
      {
        familyId: family.id,
        personId: heir.id,
        region: place.region,
        loc: place.loc,
        estate: 0,
        ...(newborn ? { newborn: true } : {}),
      },
      now,
    )
  ) {
    return { ok: false, why: 'The new heir could not be saved in this window. Try again.' };
  }
  const mapId = /** @type {{ mapId?: number }} */ (place).mapId;
  return {
    ok: true,
    family,
    heirId: heir.id,
    place: { region: place.region, loc: place.loc, ...(Number.isInteger(mapId) ? { mapId } : {}) },
  }; // RPT1026-MISC HEIR-WAITS: a newborn's id is minted here; BAY-LEFT-B: and its map id - a seat past the Bay is booted by it (places.js birthSearch's `seat`)
}
