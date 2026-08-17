// T3a talk foundation (DFU TalkManager / PersistentFactionData /
// PlayerGPS, MIT Daggerfall Workshop) - the reaction layer under the
// talk window (T3b) and pickpocketing.
//
// - findFactions: PersistentFactionData.FindFactions verbatim (-1
//   wildcards; region compares against the parser's 0-based value).
// - getPeopleOfCurrentRegion: PlayerGPS verbatim - the single
//   People/Commoners/GeneralPopulace faction of the region; every
//   mobile townsperson talks as that faction.
// - getReactionToPlayer: TalkManager verbatim - faction rep +
//   biography reaction mod + live effect reaction mod (sgroup) +
//   the player's social-group reputation (sgroup).
//
// The player's faction state: classic clones FACTION.TXT into the
// save and mutates rep in place. Until the save arc carries factions,
// the live FactionFile dict IS the state (rep deltas land with the
// crime/quest slices - FLAGGED there, not here).

import { SOCIAL_GROUP_COUNT, FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../formats/factionFile.js';
import { calculatePickpocketingChance, dice100 } from '../combat/formulas.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';

// PlayerActivate constants, verbatim (classic units x GlobalScale).
export const MOBILE_NPC_ACTIVATION_DISTANCE = 256 * 0.025;   // 6.4
export const STATIC_NPC_ACTIVATION_DISTANCE = 256 * 0.025;
export const PICKPOCKET_DISTANCE = 128 * 0.025;              // 3.2
export const FOUND_NOTHING_VALUABLE_TEXT_ID = 8999;

/** PersistentFactionData.FindFactions, verbatim (-1 = any). */
export function findFactions(factionDict, { type = -1, socialGroup = -1, guildGroup = -1, region = -1 } = {}) {
  const out = [];
  for (const item of factionDict.values()) {
    if (type !== -1 && type !== item.type) continue;
    if (socialGroup !== -1 && socialGroup !== item.sgroup) continue;
    if (guildGroup !== -1 && guildGroup !== item.ggroup) continue;
    if (region !== -1 && region !== item.region) continue;
    out.push(item);
  }
  return out;
}

/** PlayerGPS.GetPeopleOfCurrentRegion, verbatim: the region's single
 *  People faction (type 15, Commoners, GeneralPopulace). */
export function getPeopleOfCurrentRegion(factionDict, regionIndex) {
  const factions = findFactions(factionDict, {
    type: FACTION_TYPES.People,
    socialGroup: SOCIAL_GROUPS.Commoners,
    guildGroup: GUILD_GROUPS.GeneralPopulace,
    region: regionIndex,
  });
  if (factions.length !== 1) return null;   // DFU throws; the caller decides
  return factions[0];
}

/** Ensure the entity carries the reaction-state fields (all zero at
 *  chargen; classic starts every social-group rep at 0). */
export function ensureReactionState(entity) {
  if (!entity.sGroupReputations) entity.sGroupReputations = new Array(SOCIAL_GROUP_COUNT).fill(0);
  if (!entity.reactionMods) entity.reactionMods = new Array(SOCIAL_GROUP_COUNT).fill(0);
  if (entity.biographyReactionMod === undefined) entity.biographyReactionMod = 0;
  return entity;
}

/** TalkManager.GetReactionToPlayer, verbatim. */
export function getReactionToPlayer(faction, player) {
  ensureReactionState(player);
  let reaction = faction.rep + player.biographyReactionMod;
  const sgroup = faction.sgroup;
  if (sgroup >= 0 && sgroup < player.reactionMods.length) reaction += player.reactionMods[sgroup];
  if (sgroup >= 0 && sgroup < player.sGroupReputations.length) reaction += player.sGroupReputations[sgroup];
  return reaction;
}

/** PlayerActivate.Pickpocket on a TOWNSPERSON, verbatim: tally the
 *  skill, roll the chance, 67% of successes pinch 1-6 gold (the
 *  Currency stack), 33% find nothing valuable (random text 8999);
 *  failure sets CrimeCommitted = Pickpocketing (guard SPAWNING is
 *  FLAGGED to the crime slice - the state lands now, verbatim).
 *  Enemy pickpocketing pends the same slice (targetLevel wiring).
 *  Returns { success, gold, message } for the scene's UI routing.
 *  rolls: Math.random-compatible (Random.Range + Dice100). */
export function pickpocketTownsperson(player, { rolls = Math.random, nothingText = () => 'You found nothing valuable.' } = {}) {
  tallySkill(player, SKILLS.Pickpocket, 1);
  const chance = calculatePickpocketingChance(skillValue(player, SKILLS.Pickpocket), player.level, null);
  if (dice100(chance, rolls())) {
    if (!dice100(33, rolls())) {   // Dice100.FailedRoll(33)
      const gold = Math.floor(rolls() * 6) + 1;   // Random.Range(0,6) + 1
      let stack = player.items.find((it) => it.group === 'Currency');
      if (!stack) player.items.push(stack = { group: 'Currency', name: 'Gold pieces', stackCount: 0 });
      stack.stackCount += gold;
      // TallyCrimeGuildRequirements(true, 1) FLAGGED: thieves-guild
      // membership pends the guilds arc.
      return { success: true, gold, message: gold === 1 ? 'You pinched 1 gold piece.' : `You pinched ${gold} gold pieces.` };
    }
    return { success: true, gold: 0, message: nothingText() };
  }
  player.crimeCommitted = 'Pickpocketing';   // PlayerEntity.Crimes, verbatim state
  // SpawnCityGuards(true) FLAGGED: the crime/guards slice mounts the response.
  return { success: false, gold: 0, message: 'You are not successful.' };
}
