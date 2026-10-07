// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP2a (2026-10-07, Mac: "Do it") — THIS DEVICE'S HALF OF THE HALLS
// WITNESSED: which of the twenty-two guild factions keep a hall in the
// town this client walked into, read off the town's own buildings, and
// that answer reported once a UTC day a town while the Chapters are open
// to this account. bible/11-Multiplayer/Chapters-Arc.md section 4; the
// law is npcChapterLaw.js, the service server-account/src/npcHalls.js.
//
// A HALL is what DFU's own map and doors say it is:
//   - a Guild Hall or a Temple whose building faction resolves to a guild
//     through GuildManager's own group dispatch (guildVariants.js
//     createGuildForGroup over guilds.js guildGroupOfFaction - the read
//     worldModes.js's shelves and doors make): the Fighters, the Mages, a
//     temple (a templar order walks to its divine) or a knightly order;
//   - for the two hidden guilds, a building carrying the guild's own
//     faction (ThievesGuild.cs/DarkBrotherhood.cs reveal exactly those -
//     guildHallReveal.js), never a GeneralPopulace door: that group is
//     every commoner's, and the Thieves Guild would stand in every town.
//
// Online only; offline nothing here is asked and the town is DFU's.
// ═══════════════════════════════════════════════════════════════════

import { BUILDING_TYPES } from '../world/buildingNames.js';
import { GUILD_FACTION_IDS } from '../systems/guildFactions.js';
import { guildGroupOfFaction } from '../systems/guilds.js';
import { createGuildForGroup } from '../systems/guildVariants.js';
import { isRollFaction, hallReportOf } from './npcChapterLaw.js';

/** Where this device keeps the day it last reported each town: { [mapId]: UTC day }. */
export const HALL_REPORTED_KEY = 'chap2.halls';
/** The towns remembered - a player who wanders the Bay does not grow the key for ever. */
export const HALL_REPORTED_MAX = 200;
/** The answers that say the halls are not this account's to witness now - the book asks no more this page. */
export const HALL_STOPS = Object.freeze(['chapters-closed', 'halls-need-account', 'no-session', 'auth']);

const HIDDEN = new Set([GUILD_FACTION_IDS.ThievesGuild, GUILD_FACTION_IDS.DarkBrotherhood]);

/**
 * A TOWN'S HALLS: the guild factions (ascending, each once) the town keeps a hall of, read off buildingSummaries' rows
 * through FACTION.TXT. None while the faction file is unread: half an answer (the hidden two without the rest) would
 * stand against the whole one every other witness gives.
 * @param {ReadonlyArray<any>} buildings @param {any} factionDict
 * @returns {number[]}
 */
export function hallFactionsOf(buildings, factionDict) {
  if (!factionDict) return [];
  /** @type {Set<number>} */
  const out = new Set();
  for (const b of buildings ?? []) {
    const id = b?.factionId;
    if (HIDDEN.has(id)) { out.add(id); continue; }
    if (!id || (b?.buildingType !== BUILDING_TYPES.GuildHall && b?.buildingType !== BUILDING_TYPES.Temple)) continue;
    const f = createGuildForGroup(guildGroupOfFaction(factionDict, id), id, factionDict)?.factionId;
    if (isRollFaction(f) && !HIDDEN.has(f)) out.add(f);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * THE HALL BOOK. `witness({ key, region, factions })` reports a town once a UTC day (answers whether a report was sent);
 * a refusal in HALL_STOPS stops it for the page. Quiet either way - the town is the same town.
 * @param {{ door: { witness: (hall: any) => Promise<any> }, storage?: any, nowMs?: () => number }} o
 */
export function createHallBook({ door, storage = null, nowMs = () => Date.now() }) {
  /** @type {Record<string, number> | null} */
  let reported = null;
  let stopped = false;
  const table = () => {
    if (reported) return reported;
    reported = {};
    try {
      const v = JSON.parse(storage?.getItem?.(HALL_REPORTED_KEY) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) reported = v;
    } catch { /* a bad key reads as none */ }
    return /** @type {Record<string, number>} */ (reported);
  };
  const write = (/** @type {Record<string, number>} */ t) => {
    reported = Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, HALL_REPORTED_MAX));
    try { storage?.setItem?.(HALL_REPORTED_KEY, JSON.stringify(reported)); } catch { /* this page keeps it */ }
  };
  const dayNow = () => Math.floor(nowMs() / 86_400_000);
  return {
    get stopped() { return stopped; },
    /** @param {any} report */
    async witness(report) {
      const h = hallReportOf(report);
      if (!h || stopped) return false;
      const t = table();
      if (t[String(h.key)] === dayNow()) return false;
      t[String(h.key)] = dayNow();
      write(t);
      let r = null;
      try { r = await door.witness(h); } catch { /* the next day asks again */ }
      if (HALL_STOPS.includes(r?.error)) stopped = true;
      return true;
    },
  };
}
