// CRAFT-FIRST-SHOWN (FIELD BUGS 2026-10-15f; the Discord, 2026-10-13: "The first time craft bonus is not applying to
// the outfitting. I got somehow it once from...Fishing net? Then never after"): WHAT A CRAFT PAYS, SAID WHERE IT IS
// EARNED. AUDIT 32 S1 (net/recipeLaw.js firstCraftPays) withholds the first-make's XP (then 500) from a pattern
// made wholly of goods only a counter sells - the Weavers' Linen and Wool: 152 of the loom's patterns, the Fishing-Net
// among them - and the owner keeps it. Nothing in the game said so: the anvil, the workbench, the loom and the mason's
// bench showed no XP, the jeweller's and the fire's showed theirs without the first, and the craft's word left the
// answer's `first` unread. These are the words both say it with: the station pages' boxes (ui/professions/profPages.js) and the
// craft's word (scenes/world.js's `craft`, one call).
//
// FACT: the client holds no record of which patterns were made - the service's state answers the tracks, the Stores and
// the day (server-account/src/professions.js profState), never prof_crafts - so a page says what a first craft pays,
// never whether this one's is still owed. The craft's answer says it, and its word says it after.
// bible/06-Systems/Professions-Arc.md 41.9.
//
// CRAFT-LIMIT-SAID (FIELD BUGS 2026-10-18f; the Discord, "Smithing stuck at 50": "I have been stuck at level 50 smithing
// for about 3 days now. it is literally 1xp off of levelling up but everything I craft gives me 0xp"): WHAT A STATION
// SAYS IS WHAT THE SERVICE CREDITS. The service pays an act its own law's XP with the Firmament's percent on it (FIRM1's
// scaleXp - never on the first's XP), the first's XP laid on whole, all under the room its track has left (professionLaw
// creditedXp): THE CRAFTER'S LIMIT (PROF0 3.2 - a craft that is not one of the character's two past Journeyman stops one
// XP short of rank 51, professionLaw craftXpCap) or Master's top. A station's line read the act's own law alone (craftXp),
// so at the limit the anvil promised "60 Smithing XP, and 500 more" and the craft paid none, and nothing in the game said
// why. `pay` is what a station reads off the book (ui/professions/profPages.js craftPayOf): the limit over its track
// (professionLaw craftLimit, from the service's ten tracks) and the Firmament's percent on its XP.
// bible/06-Systems/Professions-Arc.md 41.10.
//
// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids"): S1 JUDGES THE
// UNITS. The loom weaves Linen and spins Wool of the world's goods now (net/professionLaw.js WEAVE_RECIPES, SPIN_RECIPES),
// and a piece made wholly of cloth pays its first where its cloth is the character's own (recipeLaw firstCraftPays's
// `own`); the Weavers' - bought - never does, and a station spends bought units first. So a box says which way its
// units stand (`own`, the page's read of the Stores and the bag: ui/professions/profPages.js ownSpend), and the craft's
// word says what the service decided (its answer's `firstPaid`). bible/06-Systems/Professions-Arc.md 50.
//
// FIRST-BUDGET (SaberGGaming's report, 2026-10-25: Provisioning is slow; the owner, asked: "Match Smithing's pace"): A
// FIRST-MAKE'S XP IS ITS TRACK'S SHARE (net/recipeLaw.js FIRST_MAKE_SHARE - firstCraftXp, workFirstXp), no longer a flat
// 500 every track: Smithing's 500, Outfitting's 511, Building's 1,823, Provisioning's 3,155 - each the least that brings
// its track to Master in Smithing's crafts - and every line below says the recipe's own. The share says how much a first
// pays, CLOTH-GEMS whether. bible/06-Systems/Professions-Arc.md 52.
import { t, intlLocale } from '../systems/textManager.js';
import { craftXp, firstCraftPays, counterMade, firstCraftXp, workFirstXp, masonXp } from '../net/recipeLaw.js';
import { creditedXp, professionName, JOURNEYMAN_RANK, CRAFTS_ABOVE_JOURNEYMAN, MASON_RECIPES } from '../net/professionLaw.js';   // FIRST-BUDGET: the bench's two works, each its first's share
import { scaleXp } from '../net/firmament/firmamentLaw.js';

/** @typedef {{ limit?: { cap: number, room: number, by: string[], rank: number }|null, pct?: number }} CraftPay */

/** CRAFT-LIMIT-SAID: the crafts that hold a track at the limit, as the player's language lists them ("Building and
 *  Provisioning" - Intl.ListFormat's conjunction, ui/credits.js's way). @param {string[]} by track ids */
function craftsList(by) {
  const names = by.map((p) => professionName(p)).filter(Boolean);
  try { return new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(names); } catch { return names.join(', '); }
}

/**
 * CRAFT-LIMIT-SAID: WHAT AN ACT AT A STATION IS PAID, as the service decides it - `xp` the act's own law's figure (cookXp,
 * brewXp, temperXp, disenchantXp) with the Firmament's percent on it, under the room `pay.limit` leaves (none read, no
 * bound). A first's XP (its track's first-make share) is laid on whole beside it, never scaled (the lines
 * that say one, below).
 * @param {number} xp @param {CraftPay} [pay]
 */
export const paidXp = (xp, pay = {}) => creditedXp(scaleXp(xp, pay.pct ?? 0), pay.limit?.room ?? Infinity);

/**
 * CRAFT-LIMIT-SAID: THE LINE A STATION SAYS IN PLACE OF AN ACT'S XP where its track cannot take `most` (the most the act
 * earns, its first's included, the Firmament's percent on it): the crafter's limit's - "No Smithing XP: Building and
 * Provisioning stand above Journeyman, and the crafter's limit holds Smithing at rank 50." (or "At most 9 Smithing XP"
 * where a little room is left) - or, where no limit holds it, Master's; '' where the track takes all of it. AUDIT FB1018f L5-2:
 * the rank the limit holds it at (professionLaw craftLimit's `rank`) - a track past its cap its own, never "at rank 50".
 * @param {string} profession the track's name @param {CraftPay|null|undefined} pay @param {number} most
 */
export function capLine(profession, pay, most) {
  const limit = pay?.limit;
  if (!limit || limit.room >= most) return '';
  if (limit.by?.length) {
    return t('prof.page.craft.xpLimit', '{room, plural, =0 {No {profession} experience} other {At most # {profession} experience}}: {crafts} are past Journeyman, so the crafter\'s limit holds {profession} at rank {rank}.',
      { room: limit.room, profession, crafts: craftsList(limit.by), rank: limit.rank });
  }
  return t('prof.page.craft.xpTop', '{room, plural, =0 {No {profession} experience: {profession} is at Master} other {At most # {profession} experience: {profession} stops at Master}}.', { room: limit.room, profession });
}

/**
 * CRAFT-LIMIT-SAID: WHAT THE PROFESSIONS TAB'S COUNT OF CRAFTS ABOVE JOURNEYMAN DOES (PROF0 3.2, DECIDED; kept by Mac at
 * CAP-OFF, Professions-Arc 40): a character raises only two crafts past it, and once two stand there every other craft
 * stops at rank 50, one XP short of 51 (professionLaw craftXpCap). FACT: nothing in the game lowers a track's XP (every
 * write to prof_tracks raises it or holds it; only deleting the character removes it), so the two are the character's
 * for good - the line says so, before the second is raised. `past` the crafts above Journeyman now, the tab's order.
 * @param {string[]} past track ids
 */
export const limitRuleLine = (past) => t('prof.page.limit.rule', 'Only {max} crafts can rise past Journeyman{full, select, yes {. Yours are {crafts}, so your other crafts stop at rank {rank}} other {. Once {max} of yours pass rank {rank}, the others stop there}}. A craft never loses rank.',
  { max: CRAFTS_ABOVE_JOURNEYMAN, full: past.length >= CRAFTS_ABOVE_JOURNEYMAN ? 'yes' : 'no', crafts: craftsList(past), rank: JOURNEYMAN_RANK });

/**
 * A station box's XP line for its picked recipe at `rank` (the craft's track's rank): its craft's XP (craftXp - a quarter
 * more than two tiers below the rank's top), and what its first time lays on - the first of its PATTERN AT ITS TIER
 * (firstCraftKey). Every recipe of RECIPES that S1 judges is made wholly of cloth (FACT, pinned), so the line names it:
 * CLOTH-GEMS - its first pays where `own` (the units the craft would spend are the character's own - its own cloth), and
 * where the Stores or the bag hold cloth for it that is not (the Weavers', bought; a pack's, loose), that is spent first
 * and lays on none. CRAFT-LIMIT-SAID: the XP
 * the service's own (craftAtAnvil's ?10, the Firmament's percent on it, and its ?13 whole), and the limit's line in its
 * place where the track cannot take it (capLine).
 * @param {any} r a recipe of net/recipeLaw.js RECIPES @param {number} rank @param {string} profession the track's name
 * @param {CraftPay} [pay] @param {boolean} [own] whether the units it would spend are the character's own
 */
export function craftXpLine(r, rank, profession, pay = {}, own = false) {
  const xp = scaleXp(craftXp(r.tier, rank), pay.pct ?? 0);
  const more = firstCraftXp(r, own);   // FIRST-BUDGET: its track's first-make share; CLOTH-GEMS: a cloth piece's where its cloth is own
  if (!counterMade(r)) {
    return capLine(profession, pay, xp + more) || t('prof.page.craft.xpFirst', '{xp} {profession} experience, and {more, number} more the first time you make this piece at this grade.', { xp, profession, more });
  }
  return capLine(profession, pay, xp + more) || (more
    ? t('prof.page.craft.xpFirstOwn', '{xp} {profession} experience, and {more} more the first time you make this piece at this grade from cloth you wove or spun yourself.', { xp, profession, more })
    : t('prof.page.craft.xpBought', '{xp} {profession} experience. Cloth you did not weave or spin yourself is used first, and earns no first-time bonus.', { xp, profession }));
}

/**
 * The fire's first-time line for a dish (its XP is the pans line's - cookXp, XP follows the rank; the first's XP - FIRST-BUDGET:
 * Provisioning's first-make share, firstCraftXp - the service lays on beside it, professions.js craftAtAnvil):
 * empty for a dish whose first pays none. CRAFT-LIMIT-SAID: the
 * limit's line in its place where the track cannot take `clean` (a clean pan's XP, the Firmament's percent on it) and the
 * first's.
 * @param {any} r a recipe of net/recipeLaw.js COOKING_RECIPES @param {string} profession @param {CraftPay} [pay] @param {number} [clean]
 */
export const dishFirstLine = (r, profession, pay = {}, clean = 0) => capLine(profession, pay, clean + firstCraftXp(r))
  || (firstCraftXp(r) > 0 ? t('prof.page.fire.first', 'The first time you cook this dish: {more, number} more {profession} experience.', { more: firstCraftXp(r), profession }) : '');

/**
 * The mason's bench's works' first-time line: the first cut and the first mix each lay on their first's XP (FIRST-BUDGET:
 * Building's first-make share, each work's, workFirstXp - the service's, keyed by the work, professions.js smeltAtForge;
 * both works pay it, and pay the same, FACT, pinned). CRAFT-LIMIT-SAID: the limit's line in its place where the track
 * cannot take a first clean work of one unit.
 * @param {number} rank @param {string} profession @param {CraftPay} [pay]
 */
export const masonWorksFirstLine = (rank, profession, pay = {}) => capLine(profession, pay, scaleXp(masonXp(1, rank, { clean: true }), pay.pct ?? 0) + workFirstXp(MASON_RECIPES[0]))
  || t('prof.page.mason.worksFirst', 'Your first cut and your first mix each earn {more, number} more {profession} experience.',
    { more: workFirstXp(MASON_RECIPES[0]), profession });

/**
 * The craft's word's XP, from the service's answer (professions.js craftAnswer - `xp` as credited, `first` whether this
 * craft was the character's first of its pattern at its tier, CLOTH-GEMS `firstPaid` whether its 500 was laid on): "(+620
 * Smithing XP, with the first-time bonus)"; a first of bought cloth says why none came; any other craft its XP alone. An
 * answer without `firstPaid` (a service before CLOTH-GEMS) is read by the recipe, as it was. CRAFT-LIMIT-SAID: where the crafter's limit
 * now holds the track with no room left (`limit`, professionLaw craftLimitOf over the book's tracks once the answer is in
 * them - net/profBook.js limit), that is what it says - a first's bonus the limit ate is never said as paid. AUDIT FB1018f
 * L5-4: AND MASTER'S, where no craft holds the track and the top leaves it none - "(+0 Smithing XP - Smithing is at
 * Master)": a Master's limit names no crafts, so its word fell through to "(+0 Smithing XP, with the first-time bonus)",
 * and a first the top ate (200 paid at 99,800) was said as paid. L5-2: the rank the limit holds it at, the track's own
 * past its cap.
 * @param {any} r the recipe asked @param {{ xp?: number, first?: boolean, firstPaid?: boolean }|null|undefined} data the answer @param {string} profession
 * @param {{ room: number, by: string[], rank: number }|null} [limit]
 */
export function craftXpText(r, data, profession, limit = null) {
  const xp = Number(data?.xp) || 0;
  if (limit?.room === 0) {
    return limit.by?.length
      ? t('prof.craft.xpLimit', '(+{xp} {profession} experience. {crafts} are past Journeyman, so the crafter\'s limit holds {profession} at rank {rank})', { xp, profession, crafts: craftsList(limit.by), rank: limit.rank })
      : t('prof.craft.xpTop', '(+{xp} {profession} experience. {profession} is at Master)', { xp, profession });
  }
  if (!r || data?.first !== true) return t('prof.craft.xp', '(+{xp} {profession} experience)', { xp, profession });
  return (typeof data.firstPaid === 'boolean' ? data.firstPaid : firstCraftPays(r))
    ? t('prof.craft.xpFirst', '(+{xp} {profession} experience, with the first-time bonus)', { xp, profession })
    : t('prof.craft.xpFirstBought', '(+{xp} {profession} experience. Your first, but only cloth you wove or spun yourself earns the first-time bonus)', { xp, profession });
}
