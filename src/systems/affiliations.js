// @ts-check
// GUILD-REP (2026-09-22, Mac: "we need to add guild reputation to our
// enhanced pause menu, its missing"): THE AFFILIATIONS BOOK, READ ONCE.
//
// DaggerfallCharacterSheetWindow.ShowAffiliationsDialog (:327-364) is
// DFU's only reading of it: one row a membership, the guild's
// affiliation name, then `affiliationFormatString` over its rank TITLE
// and its live REPUTATION. The classic sheet carried that model inside
// its own box builder (ui/charsheet.js), so the enhanced pause menu's
// Standing page - which draws only the five social groups - had no way
// to show a guild without importing the classic window. The model lives
// here now and both skins draw it: the classic box as DFU's tab-stopped
// table, the enhanced page as its own rows.

import { activeMemberships, GUILDS, getTitle } from './guild/guilds.js';
import { reviewWarnings } from './guild/guildServiceFlow.js';   // AUDIT GUILD-WORDS L1-2: the review's warnings, as the hall says them
import { standingOwedOf } from './standingOwed.js';   // STANDING-WORDS: what the Roll still owes, online
import { templeOf, orderOf } from './guild/guildVariants.js';
import { getReputation } from './faction/factionRep.js';
import { getLocalizedFactionName } from './textManager.js';   // L10N3e: the faction's name in the player's language

/** The membership book stores the port's canonical guild-record name;
 *  a temple's or an order's is its variant's (guildVariants.js). */
export function guildForMembership(membership) {
  const name = membership?.guild;
  if (!name) return null;
  for (const guild of Object.values(GUILDS)) if (guild.name === name) return guild;
  if (name.startsWith('Temple:')) return templeOf(name.slice('Temple:'.length));
  if (name.startsWith('Order:')) return orderOf(name.slice('Order:'.length));
  return null;
}

/**
 * GuildManager.GetMemberships, as ShowAffiliationsDialog reads each one:
 * `GetAffiliation()` (the faction's FACTION.TXT name - the same cloned
 * row guild reputation reads - else the guild record's own name),
 * `GetTitle()` and `GetReputation(playerEntity)`. The vampire-aware book
 * (activeMemberships), so a vampire's clan stands where it does in the
 * sheet. A membership naming no guild (hand-built, legacy) is no row.
 *
 * L10N3e: GetFactionData hands the name back through
 * GetLocalizedFactionName (PersistentFactionData.cs:176), so the row
 * shows a translation's name for the faction id - FACTION.TXT's where
 * the language has none. The book is only ever drawn; the faction
 * record keeps FACTION.TXT's name, which is the key.
 * STANDING-WORDS (Field-Bugs-2026-10-15g): each row also carries what the Roll still owes the guild online (`owed`), and
 * the review's warnings - a probation's stakes and a demotion before it lands, on `now`, the character's own date where
 * the caller has one (`warnings`, guildServiceFlow.js reviewWarnings - AUDIT GUILD-WORDS L1-2); `online`, where a
 * promotion does not wait and so may end a probation sooner (AUDIT GUILD-WORDS II C-7).
 * @param {any} entity @param {{ now?: any, online?: boolean }} [o]
 * @returns {{ affiliation: string, title: string, rep: number, factionId: number, probation: boolean, owed: number, warnings: string[] }[]}
 */
export function affiliations(entity, { now = null, online = false } = {}) {
  const out = [];
  for (const membership of Object.values(activeMemberships(entity) ?? {})) {
    const guild = guildForMembership(membership);
    if (!guild) continue;
    const name = entity?.factionRep?.dict?.get?.(guild.factionId)?.name;
    out.push({
      affiliation: name != null ? getLocalizedFactionName(guild.factionId, name) : guild.name,
      title: getTitle(membership, entity, guild),
      rep: entity?.factionRep ? getReputation(entity.factionRep, guild.factionId) : 0,
      factionId: guild.factionId,
      probation: !!membership.probation,   // REP6: on probation - the next review below -10 expels
      owed: standingOwedOf(guild.factionId),   // STANDING-WORDS
      warnings: entity?.factionRep ? reviewWarnings(entity, guild, activeMemberships(entity), entity.factionRep, { now, online }) : [],
    });
  }
  return out;
}
