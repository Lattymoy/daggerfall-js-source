// REPUTE-GATE (2026-10-16, bible/01-Overview/bugs/Field-Bugs-2026-10-15g.md; AUDIT GUILD-WORDS II; a Discord report: "The
// very first quest i did for them dropped my rep by 25 points"; Mac, asked: "Gate by reputation"). ONLINE, TWO MAGES
// GUILD QUESTS WAIT FOR THE STANDING THEIR OWN HEADERS NAME. The Mages Guild offers its quests by the player's level
// (offerFlow.js offerGuildQuest, MagesGuild.cs IsSatisfyQuestReqByLevel), and the list's rank column (QuestList-Classic
// `N0B10Y03, MagesGuild, M, 1` and `N0B20Y02, MagesGuild, M, 2`) lets a level-2 apprentice draw both - where the
// quests' own headers say `-- Repute: 10` and `-- Repute: 20`. Each takes standing back from the guild that gave it:
// "Guard the Guild" -30 for the guarded treasure taken, "Protect an Honored Mage" -10 and -50 to its mage - and online
// that standing is the Roll's, kept by the service. So online each is offered only once the guild's standing reaches
// its header's number; the penalties stay as Daggerfall has them, and offline the pool is DFU's (GetGuildQuestPool).
// A leaf: no imports.

/** The two quests and the standing their headers name (`-- Repute:`), pinned against the vendored text. */
export const ONLINE_REPUTE_GATES = Object.freeze({ N0B10Y03: 10, N0B20Y02: 20 });

/**
 * The guild pool as the shared world offers it: offline (or no pool) the pool itself; online, without the gated quests
 * whose header's standing `rep` has not reached. Answers a new array online, the same one offline.
 * @param {Array<{ name: string }> | null} pool
 * @param {number} rep
 * @param {boolean} online
 */
export function reputeGated(pool, rep, online) {
  if (!online || !pool) return pool;
  return pool.filter((q) => !Object.hasOwn(ONLINE_REPUTE_GATES, q.name) || rep >= ONLINE_REPUTE_GATES[q.name]);
}
