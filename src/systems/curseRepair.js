// @ts-check
// CURSE-REPAIR1 (2026-09-24, the contributor's report: players "getting lycanthropy or vampirism and losing it again") -
// GIVE BACK THE CURSE THE ROUND CLOCK TOOK.
//
// THE BUG (CURSE-PERSIST1, systems/effects.js tickActiveEffects): the curse entry - and the infection before it -
// carried no round budget and no `permanent` flag, where every other entry whose lifetime is not the magic round's
// (a disease, a poison) carries the flag. So `roundsRemaining` ticked undefined -> NaN, a save wrote NaN as null, and
// the first tick after the load read `null <= 0` and pruned the curse. The player came back human.
//
// WHAT THE PRUNE LEFT BEHIND is the fingerprint: the curse's free spells. They are tagged ('lycanthrope' / 'vampire'),
// saved whole (custom records), refused by the spellbook's delete law, and removed ONLY by the cure (cureLycanthropy /
// cureVampirism filter them out). Nothing else removes a curse entry - no cure-by-kind names 'racialOverride', and the
// online revival keeps diseases and curses (deathRespawn.js). So a tagged spell with no curse behind it is a curse the
// prune took, never one a cure took; a cured player has neither.
//
// WHAT COMES BACK
//  - VAMPIRISM, with its clan: the clan's own spells sit beside the three base spells, and each record's SPELLS.STD
//    `index` names them - Anthotis has none, so "base spells only" IS Anthotis.
//  - LYCANTHROPY, as a werewolf: both strains grant record 92 and nothing the save kept says which, so the strain is the
//    caller's `lycanthropyType` (Werewolf by default) and the log says it was assumed.
//  - THE CURSE ALONE (`restore`): the curse's Start ran when it was caught, so the old life is not ended a second time -
//    the buffs and drains running now are this life's, and they stay.
//
// Idempotent: a curse live again is not "lost", so a second load does nothing.

import { LYCANTHROPY_TYPES, VAMPIRE_CLANS, liveInfection } from './infection.js';
import { createLycanthropyCurse, liveLycanthropy, LYCANTHROPY_SPELL_TAG, VAMPIRE_SPELL_TAG } from './lycanthropy.js';
import { createVampirismCurse, liveVampirism, VAMPIRE_CLAN_SPELLS } from './vampirism.js';

/** The clan whose clan spells are among `indexes`; none is the base three alone - Anthotis. EXACT because the clans'
 *  lists share no spell with each other or with the base three (a pin holds VAMPIRE_CLAN_SPELLS to that), so at most
 *  one clan can match a vampire's own spellbook. */
export function inferVampireClan(indexes) {
  const have = new Set(indexes);
  for (const [clan, ids] of Object.entries(VAMPIRE_CLAN_SPELLS)) if (ids.length && ids.every((id) => have.has(id))) return Number(clan);
  return VAMPIRE_CLANS.Anthotis;
}

/**
 * The curse a player lost to the prune, given back - or null when nothing was lost.
 * @param {any} entity the player, its spellbook AND its effect list already restored
 * @param {{ now?: number, lycanthropyType?: number }} [o] `now`: the clock the curse's satiation reads (the save's
 *        classic minutes)
 * @returns {'vampirism'|'lycanthropy'|null}
 */
export function repairLostCurses(entity, { now = 0, lycanthropyType = LYCANTHROPY_TYPES.Werewolf } = {}) {
  if (!entity) return null;
  // a curse is live, one is waiting to deploy, or an infection will deploy one itself: nothing was lost
  if (liveLycanthropy(entity) || liveVampirism(entity)) return null;
  if (entity.racialOverride || entity.racialOverridePending || liveInfection(entity)) return null;
  const spells = Array.isArray(entity.spells) ? entity.spells : [];
  const vampire = spells.filter((s) => s?.tag === VAMPIRE_SPELL_TAG);
  if (vampire.length) {
    const clan = inferVampireClan(vampire.map((s) => s.index));
    if (!createVampirismCurse(entity, clan, { now, restore: true })) return null;
    console.info(`[curse-repair] CURSE-REPAIR1: vampirism given back (clan ${clan}) - its spells outlived the curse the round clock pruned`);
    return 'vampirism';
  }
  if (spells.some((s) => s?.tag === LYCANTHROPY_SPELL_TAG)) {
    if (!createLycanthropyCurse(entity, lycanthropyType, { now, restore: true })) return null;
    console.info(`[curse-repair] CURSE-REPAIR1: lycanthropy given back (strain ${lycanthropyType}, assumed - both strains grant spell 92)`);
    return 'lycanthropy';
  }
  return null;
}
