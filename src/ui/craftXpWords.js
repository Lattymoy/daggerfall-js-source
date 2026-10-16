// CRAFT-FIRST-SHOWN (FIELD BUGS 2026-10-15f; the Discord, 2026-10-13: "The first time craft bonus is not applying to
// the outfitting. I got somehow it once from...Fishing net? Then never after"): WHAT A CRAFT PAYS, SAID WHERE IT IS
// EARNED. AUDIT 32 S1 (net/recipeLaw.js firstCraftPays) withholds the first-make 500 (FIRST_CRAFT_XP) from a pattern
// made wholly of goods only a counter sells - the Weavers' Linen and Wool: 152 of the loom's patterns, the Fishing-Net
// among them - and the owner keeps it. Nothing in the game said so: the anvil, the workbench, the loom and the mason's
// bench showed no XP, the jeweller's and the fire's showed theirs without the first, and the craft's word left the
// answer's `first` unread. These are the words both say it with: the station pages' boxes (ui/profPages.js) and the
// craft's word (scenes/world.js's `craft`, one call).
//
// FACT: the client holds no record of which patterns were made - the service's state answers the tracks, the Stores and
// the day (server-account/src/professions.js profState), never prof_crafts - so a page says what a first craft pays,
// never whether this one's is still owed. The craft's answer says it, and its word says it after.
// bible/06-Systems/Professions-Arc.md 41.9.
import { t } from '../systems/textManager.js';
import { craftXp, firstCraftPays, masonXp, FIRST_CRAFT_XP } from '../net/recipeLaw.js';

/**
 * A station box's XP line for its picked recipe at `rank` (the craft's track's rank): its craft's XP (craftXp - a quarter
 * more than two tiers below the rank's top), and what its first time lays on - the first of its PATTERN AT ITS TIER
 * (firstCraftKey) - or, for a recipe wholly of the Weavers' cloth, that it lays on none. Every recipe of RECIPES that
 * pays none is made of that cloth (FACT, pinned), so the line names it.
 * @param {any} r a recipe of net/recipeLaw.js RECIPES @param {number} rank @param {string} profession the track's name
 */
export function craftXpLine(r, rank, profession) {
  const xp = craftXp(r.tier, rank, false);
  return firstCraftPays(r)
    ? t('prof.page.craft.xpFirst', '{xp} {profession} XP, and {more} more the first time you make this piece at this tier.', { xp, profession, more: craftXp(r.tier, rank, true) - xp })
    : t('prof.page.craft.xpShop', '{xp} {profession} XP. Made only of cloth from the Weavers, it earns no first-time bonus.', { xp, profession });
}

/**
 * The fire's first-time line for a dish (its XP is the pans line's - cookXp, XP follows the rank; the first's 500 the
 * service lays on beside it, professions.js craftAtAnvil): empty for a dish whose first pays none.
 * @param {any} r a recipe of net/recipeLaw.js COOKING_RECIPES @param {string} profession
 */
export const dishFirstLine = (r, profession) => (firstCraftPays(r) ? t('prof.page.fire.first', 'The first time you cook this dish: {more} more {profession} XP.', { more: FIRST_CRAFT_XP, profession }) : '');

/**
 * The mason's bench's works' first-time line: the first cut and the first mix each lay on the 500 (masonXp's `first` -
 * the service's, keyed by the work, professions.js smeltAtForge; both works pay it, FACT, pinned).
 * @param {number} rank @param {string} profession
 */
export const masonWorksFirstLine = (rank, profession) => t('prof.page.mason.worksFirst', 'Your first cut and your first mix each earn {more} more {profession} XP.',
  { more: masonXp(1, rank, { first: true }) - masonXp(1, rank), profession });

/**
 * The craft's word's XP, from the service's answer (professions.js craftAnswer - `xp` as credited, `first` whether this
 * craft was the character's first of its pattern at its tier): "(+620 Smithing XP, with the first-time bonus)"; a first
 * of the Weavers' cloth says why none came; any other craft its XP alone.
 * @param {any} r the recipe asked @param {{ xp?: number, first?: boolean }|null|undefined} data the answer @param {string} profession
 */
export function craftXpText(r, data, profession) {
  const xp = Number(data?.xp) || 0;
  if (!r || data?.first !== true) return t('prof.craft.xp', '(+{xp} {profession} XP)', { xp, profession });
  return firstCraftPays(r)
    ? t('prof.craft.xpFirst', '(+{xp} {profession} XP, with the first-time bonus)', { xp, profession })
    : t('prof.craft.xpFirstShop', '(+{xp} {profession} XP - your first, but cloth from the Weavers earns no first-time bonus)', { xp, profession });
}
