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

/** Where this device keeps the day it last reported each town: { [mapId]: UTC day } - HALL_DONE past the day for a town
 *  the service has counted or struck, which is never reported again (an account's first answer stands for ever). */
export const HALL_REPORTED_KEY = 'chap2.halls';
/** AUDIT CHAP2 E9: a town done for good - counted or struck. Above every UTC day, so the newest-first keep holds them. */
export const HALL_DONE = 1_000_000;
/** The towns remembered - a player who wanders the Bay does not grow the key for ever. */
export const HALL_REPORTED_MAX = 200;
/** The answers that say the halls are not this account's to witness now - the book asks no more this page. AUDIT CHAP2
 *  C8: an account under a week old is answered `counted: false, why: 'young'`, and asks no more this page either. */
export const HALL_STOPS = Object.freeze(['chapters-closed', 'halls-need-account', 'no-session', 'auth']);
/** A refusal that ends this town for good (a developer struck it). */
const HALL_DONE_ERRORS = Object.freeze(['hall-struck']);

/** @type {Set<number>} */
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
    const f = chapterFactionOf(id, factionDict);
    if (f != null) out.add(f);
  }
  return [...out].sort((a, b) => a - b);
}

/** A HALL BUILDING'S FACTION AS ITS CHAPTER'S, through FACTION.TXT (createGuildForGroup over its guild group - a temple
 *  carrying its templar order's faction reads its divine's): a Roll guild's faction, or null; one of the hidden two as it
 *  is. AUDIT CHAP4 (D, worth a look): the living town reads its halls by this, as the witness does.
 *  @param {unknown} id @param {any} factionDict @returns {number | null} */
export function chapterFactionOf(id, factionDict) {
  if (HIDDEN.has(/** @type {number} */ (id))) return /** @type {number} */ (id);
  if (typeof id !== 'number' || !id || !factionDict) return null;
  const f = createGuildForGroup(guildGroupOfFaction(factionDict, id), id, factionDict)?.factionId;
  return isRollFaction(f) && !HIDDEN.has(/** @type {number} */ (f)) ? /** @type {number} */ (f) : null;
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
      const at = t[String(h.key)];
      if (at === dayNow() || at >= HALL_DONE) return false;
      t[String(h.key)] = dayNow();
      write(t);
      let r = null;
      try { r = await door.witness(h); } catch { /* the next day asks again */ }
      if (HALL_STOPS.includes(r?.error) || (r?.ok && r.data?.why === 'young')) stopped = true;
      // AUDIT CHAP2 E9: a town counted (the account's answer stands for ever) or struck is never asked again - a counted
      // account re-reported every town every day, each report a rate row and the region's kept chapters thrown away
      if ((r?.ok && r.data?.counted === true) || HALL_DONE_ERRORS.includes(r?.error)) { t[String(h.key)] = HALL_DONE + dayNow(); write(t); }
      return true;
    },
  };
}

/** AUDIT CHAP2 E1: A DEVELOPER'S CHAT WORD (the seats' `/seat strike`, townSeatBook.js parseSeatCommand): `/hall audit`
 *  (the region the player stands in - the towns the audit names) or `/hall strike <map id>` - `{ op, key? }`, `{ error }`
 *  in words, or null when the line is not /hall. NEVER GUARDED HERE (RED1's law): whether this player may is the
 *  service's question (server-account/src/npcHalls.js listHalls, strikeHall). */
export const HALL_USAGE = 'Usage: /hall audit - the towns of this region the audit names; /hall strike <map id> - a false town struck.';
export function parseHallCommand(/** @type {unknown} */ text) {
  const m = /^\/hall(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, key, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const o = String(op ?? '').toLowerCase();
  if (o === 'audit' && key == null) return { op: 'audit' };
  const k = Number(key);
  if (o !== 'strike' || !/^\d+$/.test(key ?? '') || !Number.isSafeInteger(k) || k > 0xffffffff || more.length) return { error: HALL_USAGE };
  return { op: 'strike', key: k };
}

/** The audit list as chat lines: one a town the audit names (its map id, state, guilds and witnesses), or a line that
 *  none is. `name(f)` a faction's name. */
export function hallAuditLines(/** @type {any} */ data, /** @type {(f: number) => string} */ name) {
  const towns = (data?.towns ?? []).filter((/** @type {any} */ t) => t.audit);
  if (!towns.length) return [`No town of this region is on the halls' audit list (${data?.ignored ?? 0} accounts ignored).`];
  return towns.map((/** @type {any} */ t) => `Town ${t.key}: ${t.state}, ${t.witnesses} witnesses - ${(t.factions ?? []).map(name).join(', ') || 'no hall'}`);
}
