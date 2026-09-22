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

import { activeMemberships, GUILDS, getTitle } from './guilds.js';
import { templeOf, orderOf } from './guildVariants.js';
import { getReputation } from './factionRep.js';

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
 * @param {any} entity
 * @returns {{ affiliation: string, title: string, rep: number, factionId: number }[]}
 */
export function affiliations(entity) {
  const out = [];
  for (const membership of Object.values(activeMemberships(entity) ?? {})) {
    const guild = guildForMembership(membership);
    if (!guild) continue;
    out.push({
      affiliation: entity?.factionRep?.dict?.get?.(guild.factionId)?.name ?? guild.name,
      title: getTitle(membership, entity, guild),
      rep: entity?.factionRep ? getReputation(entity.factionRep, guild.factionId) : 0,
      factionId: guild.factionId,
    });
  }
  return out;
}
