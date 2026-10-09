// @ts-check
// FIELD BUGS 2026-10-09e - EVERY-STANDING (bible/01-Overview/Field-Bugs-2026-10-09e.md; the Discord's suggestion "Could
// we have a setting to see our reputation with every guild/kingdoms?": "I got expelled from the Mages Guild recently ...
// and now I wanted to get my reputation back into positive with them to get unlist again. Problem is, since I don't am
// part of the guild anymore, I can't see how is my standing with them ... could we be able to see most or all
// organizations? I personally feel that could be a setting since with many temples and knight orders, some people could
// feel the menu bloated").
//
// The enhanced pause menu's Standing page shows the five social groups, the law region by region, and the guilds the
// player BELONGS to (systems/affiliations.js - DFU's ShowAffiliationsDialog, one row a membership). An expelled
// member's guild is no membership, so the one number the way back in reads (Guild.GetReputation, the faction's own -
// systems/guilds.js) was nowhere on the screen. With the setting on (prefs `standingAll`, off by default - the page
// as it was), the page lists every organization's reputation from the player's live faction store (factionRep.js, the
// clone of FACTION.TXT the guild ranks read): the four guilds, the eight temples by the god their membership reads
// (guildVariants.js DIVINES, as the temples' own ranks do), the ten knightly orders (ORDERS), the kingdoms (FACTION.TXT's
// Province type - the rulers of every region and the Empire), the witches' covens, the vampire clans and the Daedric
// Princes. A faction the player belongs to is under Guilds already, with its rank, and is not listed twice. The number
// is the store's to the point; nothing here changes a reputation.

import { FACTION_TYPES } from '../formats/factionFile.js';
import { getReputation } from './factionRep.js';
import { DIVINES, ORDERS } from './guildVariants.js';
import { GUILDS } from './guilds.js';
import { affiliations } from './affiliations.js';
import { RANDOM_RULER } from './npcSession.js';   // FACTION.TXT's placeholder ruler a random noble quest stands in for - no kingdom

/** @typedef {{ id: string, title: string, ids?: readonly number[], type?: number }} StandingGroup */
/** The groups, in the page's order: a title and how its factions are found (fixed ids, or a FACTION.TXT type).
 *  @type {readonly StandingGroup[]} */
export const ORG_STANDING_GROUPS = Object.freeze([
  Object.freeze({ id: 'guilds', title: 'Guilds', ids: Object.freeze(Object.values(GUILDS).map((g) => g.factionId)) }),
  Object.freeze({ id: 'temples', title: 'Temples', ids: Object.freeze(Object.values(DIVINES)) }),
  Object.freeze({ id: 'orders', title: 'Knightly orders', ids: Object.freeze(Object.values(ORDERS)) }),
  Object.freeze({ id: 'kingdoms', title: 'Kingdoms', type: FACTION_TYPES.Province }),
  Object.freeze({ id: 'covens', title: 'Witches\' covens', type: FACTION_TYPES.WitchesCoven }),
  Object.freeze({ id: 'clans', title: 'Vampire clans', type: FACTION_TYPES.VampireClan }),
  Object.freeze({ id: 'daedra', title: 'Daedric Princes', type: FACTION_TYPES.Daedra }),
]);

/**
 * Every organization's standing, by group: [{ id, title, rows: [{ factionId, name, rep }] }] - a group's fixed ids in
 * their own order, a type's factions by name; the player's memberships (affiliations) and a faction the store does not
 * hold left out; an empty group left out.
 * @param {any} entity
 */
export function standingGroups(entity) {
  const store = entity?.factionRep;
  const dict = store?.dict;
  if (!dict) return [];
  const member = new Set(affiliations(entity).map((a) => a.factionId));
  const out = [];
  for (const g of ORG_STANDING_GROUPS) {
    const ids = g.ids
      ? [...g.ids]
      : [...dict.values()].filter((f) => f.type === g.type && f.id !== RANDOM_RULER).sort((a, b) => String(a.name).localeCompare(String(b.name))).map((f) => f.id);
    const rows = [];
    for (const id of ids) {
      const f = dict.get(id);
      if (!f || member.has(id)) continue;
      rows.push({ factionId: id, name: String(f.name ?? id), rep: getReputation(store, id) });
    }
    if (rows.length) out.push({ id: g.id, title: g.title, rows });
  }
  return out;
}
