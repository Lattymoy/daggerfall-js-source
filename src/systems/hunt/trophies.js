// @ts-check
// HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.5, Professions-Arc.md section 58): A MOUNTED TROPHY
// MINTED - a named mark's at its payday (scenes/huntersMark.js), a Trophy Hunter's at a clean pelt of a tier 5+ body
// (scenes/huntHost.js). The item carries its beast (`message`) and a mark's name (`variant`), and its own picture: the
// beast's own front frame of the player's data, which the pack lists and the decorator hangs on a plaque drawn at runtime
// (scenes/decor/trophyArt.js). Nothing here is a piece of kit: a trophy is decor, and worth little at a counter.
import { setItemFields, mintCondition } from '../item/itemTemplates.js';
import { ENEMY_BASICS, enemyDisplayName } from '../../characters/enemy/enemyBasics.js';
import { getLocalizedEnemyName, t } from '../textManager.js';
import { TROPHY_TEMPLATE, trophyFoeOf, trophyNameIndexOf } from '../../net/trophyLaw.js';
import { HUNT_MARK_NAMES } from '../../net/huntLaw.js';
import { hideOfFoe, HIDES, HIGH_HIDE_TIER } from '../../net/professionLaw.js';
import { BOUNTY_TIERS } from '../bounty/bountyBoard.js';
import { noteGathered } from './gatheredLog.js';
import { addItem } from '../inventory.js';

/** The group every custom row mints in (systems/item/itemLaw.js: an index it does not name is UselessItems2's). */
export const TROPHY_GROUP = 'UselessItems2';

/** The archive a beast is drawn from - its own (EnemyBasics' male texture), or, for a mod's animal with no row here, its
 *  hide's first classic foe's (net/professionLaw.js HIDES: a Land Dreugh is the Dreugh's). Null for none. */
export function trophyArchiveOf(/** @type {number} */ foe) {
  const own = Number(/** @type {any} */ (ENEMY_BASICS)[foe]?.maleTexture);
  if (Number.isSafeInteger(own) && own > 0) return own;
  const kin = hideOfFoe(foe)?.foes?.find((f) =>
    Number.isSafeInteger(/** @type {any} */ (ENEMY_BASICS)[f]?.maleTexture),
  );
  return kin == null ? null : Number(/** @type {any} */ (ENEMY_BASICS)[kin].maleTexture);
}
/** Every beast a trophy can be of, in the boards' tiers' order then the high hides': a named mark is one of the boards'
 *  beasts, a Trophy Hunter's a body of a hide of HIGH_HIDE_TIER or past it - the classic ones (a mod's beast is listed
 *  once taken). The Collections page's Trophies part lists them (ui/collections/gatheredPart.js). */
export const TROPHY_BEASTS = Object.freeze(
  [
    ...new Set([
      ...BOUNTY_TIERS.flatMap((t) => t.foes),
      ...HIDES.filter((h) => h.tier >= HIGH_HIDE_TIER).flatMap((h) => h.foes),
    ]),
  ].filter((f) => /** @type {any} */ (ENEMY_BASICS)[f] && trophyArchiveOf(f) != null),
);
/** A beast's name in the player's language. */
export const trophyBeastName = (/** @type {number} */ foe) => getLocalizedEnemyName(foe, enemyDisplayName(foe) ?? '?');
/** What a trophy is called: "Gorefang the Grizzly Bear" for a mark's, the beast's own name otherwise. */
export function trophyTitle(/** @type {number} */ foe, /** @type {number|null} */ nameIndex = null) {
  const beast = trophyBeastName(foe);
  const name = nameIndex == null ? null : HUNT_MARK_NAMES[nameIndex];
  return name ? t('hunt.mark.title', '{name} the {beast}', { name, beast }) : beast;
}
/** The item's own name in the pack: "Trophy: Gorefang the Grizzly Bear". */
export const trophyItemName = (/** @type {number} */ foe, /** @type {number|null} */ nameIndex = null) =>
  t('hunt.trophy.item', 'Trophy: {beast}', { beast: trophyTitle(foe, nameIndex) });
/** A trophy item's title, read off its numbers (a visitor's room, the decorator's list). */
export const trophyTitleOf = (/** @type {any} */ item) => {
  const foe = trophyFoeOf(item);
  return foe == null ? null : trophyTitle(foe, trophyNameIndexOf(item));
};

/**
 * A MOUNTED TROPHY of `foe` - `nameIndex` a named mark's name (huntLaw.js HUNT_MARK_NAMES) - or null for a beast with no
 * picture. `day` the UTC day it was taken, for the Collections page's log (systems/hunt/gatheredLog.js).
 * @param {number} foe @param {{ nameIndex?: number|null, day?: number|null }} [o]
 */
export function mintTrophy(foe, { nameIndex = null, day = null } = {}) {
  const archive = trophyArchiveOf(foe);
  if (archive == null || !Number.isSafeInteger(foe) || foe < 0) return null;
  const named =
    Number.isSafeInteger(nameIndex) &&
    /** @type {number} */ (nameIndex) >= 0 &&
    /** @type {number} */ (nameIndex) < HUNT_MARK_NAMES.length;
  const item = mintCondition(
    setItemFields({
      group: TROPHY_GROUP,
      templateIndex: TROPHY_TEMPLATE,
      material: 0,
      flags: 0,
      variant: named ? /** @type {number} */ (nameIndex) + 1 : 0,
      message: foe,
      stackCount: 1,
      worldTextureArchive: archive,
      worldTextureRecord: 0,
      name: trophyItemName(foe, named ? nameIndex : null),
    }),
  );
  if (Number.isSafeInteger(day)) noteGathered('trophies', foe, /** @type {number} */ (day));
  return item;
}
/** A trophy into a pack - answers the item, or null. */
export function giveTrophy(
  /** @type {any} */ entity,
  /** @type {number} */ foe,
  /** @type {{ nameIndex?: number|null, day?: number|null }} */ o = {},
) {
  const item = mintTrophy(foe, o);
  if (!item || !entity) return null;
  addItem((entity.items ??= []), item);
  return item;
}
/** HUNTERS-MARK: a trophy into the pack and the save told - the hosts' one door (`saved` the save's own soon). */
export function giveTrophySaved(
  /** @type {any} */ entity,
  /** @type {number} */ foe,
  /** @type {() => void} */ saved,
  /** @type {{ nameIndex?: number|null }} */ o = {},
) {
  const item = giveTrophy(entity, foe, { ...o, day: Math.floor(Date.now() / 86_400_000) });
  if (item) saved?.();
  return !!item;
}
/** The door a host hands the hunt's kind: `saveSoon` the save's; the entity the gather host's, at each trophy. */
export const trophyDoor =
  (/** @type {{ changed: () => void }} */ saveSoon) => (/** @type {number} */ foe, /** @type {any} */ entity) =>
    giveTrophySaved(entity, foe, () => saveSoon.changed());
