// @ts-check
// TIER1 (2026-10-05, Mac: "Along with this change will be a simplier addition, visible showing dungeons difficulty as
// Regular, Elite or Super"; bible/11-Multiplayer/Super-Dungeons.md section 12): A DUNGEON'S TIER, IN ONE WORD.
//
// ONE LAW for every surface that names a dungeon: 'super' for a Hollow (the Super dungeon - its location says so,
// `superTier`), 'elite' for an Elite spawn (`elite`, world/spawnedDungeons.js synthesizeDungeonLocation), 'regular'
// for every other dungeon - and null for a place with no dungeon at all. DUNGEON_TIER_TEXT is the words each surface
// draws; tierPhrase the one phrase it draws them in, with the size beside them (world/dungeonLabel.js, which knows the
// size law and the places the port made, which are no dungeon to tier). The tiers only differ online (an Elite or a
// Super dungeon stands nowhere else), so the surfaces say them online (`tierShown`); offline every dungeon is DFU's,
// and its plaque stays the World Tooltips mod's own "To <name>".
//
// A LEAF - no imports - so the plaque's law (systems/worldTooltips.js) reads the words without the size law's
// imports behind it.
//
// Not a DFU member: DFU has no tiers and no online. Ledger A (TIER1).

/** The three tiers, easiest first. */
export const DUNGEON_TIERS = Object.freeze(['regular', 'elite', 'super']);
/** Each tier's words - the plaque's title, the map's label, the entry line. */
export const DUNGEON_TIER_TEXT = Object.freeze({ regular: 'Regular Dungeon', elite: 'Elite Dungeon', super: 'Super Dungeon' });
/** The three sizes' words (world/dungeonLabel.js reads which, off the built dungeon's block count). */
export const DUNGEON_SIZE_TEXT = Object.freeze({ small: 'Small', medium: 'Medium', large: 'Large' });

/** The tier of a location's dungeon: 'super', 'elite' or 'regular' - or null when the place has no dungeon. */
export function dungeonTier(loc) {
  if (!loc?.hasDungeon) return null;
  if (loc.superTier === true) return 'super';
  return loc.elite === true ? 'elite' : 'regular';
}

/** The tier's words for a location, or null (no dungeon). */
export function dungeonTierText(loc) {
  const t = dungeonTier(loc);
  return t ? DUNGEON_TIER_TEXT[t] : null;
}

/** The tiers are said where they differ: online. A surface asks this with its own online flag. */
export const tierShown = (online) => online === true;

/** A label in the one phrase every surface writes it in: "Regular Dungeon, Large" - the tier's words, the size's after
 *  a comma when it is known; '' for none. */
export const tierPhrase = (label) => (label?.text ? `${label.text}${label.size ? `, ${label.size}` : ''}` : '');
