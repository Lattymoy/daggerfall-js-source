// V2d - THE RACIAL-OVERRIDE QUEST STARTS: PlayerEntity's
// StartRacialOverrideQuest (:540-545) with its two cadence arms
// (:470-477), VampirismEffect.StartQuest (:227-263) and
// LycanthropyEffect.StartQuest (:437-452), and the two cure-time
// tombstone sweeps (EndVampireQuests :375-386, EndLycanthropyQuests
// :660-670) - MIT, Daggerfall Workshop.
//
// THE CADENCE IS THE ENTITY UPDATE'S MINUTE WALK, not the magic
// round: every 38 days (54720 minutes - the same arm that runs the
// region-conditions update, which is why the call rides beside
// regionPowerUpdate in worldTick) DFU rolls the NON-cure quest, and
// every 84 days (120960) the CURE quest. Both walks run on absolute
// classic minutes, so a fortnight of prison or travel catches up
// exactly as DFU's `for (i < minutesPassed)` does.
//
// THE ROLLS ARE EACH CURSE'S OWN, verbatim:
//  - werewolf/wereboar: CURE only (the base StartQuest is empty) -
//    (1,100) < 30, and NEVER a second instance ($CUREWER is
//    long-running: hunters come if the time limit lapses, so DFU
//    checks FindQuests first).
//  - vampire CURE: (10,100) < 30 - the odd 10 floor is DFU's own
//    line, kept; no already-running check, also DFU's own.
//  - vampire NON-cure: the FIRST hit of (1,100) < 50 starts
//    P0A01L00 and latches hasStartedInitialVampireQuest on the curse
//    entry (it rides the save with the entry); every later hit rolls
//    (1,100) < 50 for a clan quest from the Vampires guild pool -
//    GetGuildQuest(Vampires, Member, clanFactionId, clanRep, LEVEL),
//    the level standing in the rank seat, DFU's own call.
//
// THE MACHINE IS HOST-OWNED (createQuestBridge), so this module is a
// LEAF with a registered host - the passiveSpecials shape: an absent
// host idles every arm (the headless charter), and the setter answers
// the displaced host.

/** :475-476 - `% 120960`, eighty-four days: the cure-quest arm. */
export const CURE_QUEST_INTERVAL_MINUTES = 120960;
/** EndVampireQuests' prefix (:377) - the whole clan line is P0*. */
export const VAMPIRE_QUEST_PREFIX = 'P0';
export const LYCANTHROPY_CURE_QUEST = '$CUREWER';
export const VAMPIRISM_CURE_QUEST = '$CUREVAM';
export const VAMPIRE_INITIAL_QUEST = 'P0A01L00';

// { startQuest(name), startQuestObject(quest), findQuests(name) ->
//   array, tombstoneQuestsByName(name), tombstoneQuestsByPrefix(p),
//   getVampireClanQuest(clanFactionId, level) -> quest|null (the
//   host reads the clan rep itself - it owns the faction store) }
let _host = null;
export function setRacialQuestHost(host) { const prev = _host; _host = host ?? null; return prev; }

/** DFRandom.random_range_inclusive over the tick's injectable 0..1
 *  rolls - the substitution every tick consumer records. */
const rangeInclusive = (rolls, lo, hi) => lo + Math.min(hi - lo, Math.floor(rolls() * (hi - lo + 1)));

/**
 * StartRacialOverrideQuest (:540-545): a no-op without a live
 * override; otherwise the curse's own StartQuest. Answers the started
 * quest's name (or the clan quest object's name) for the pins, null
 * when nothing started.
 */
export function startRacialOverrideQuest(entity, isCureQuest, { rolls = Math.random } = {}) {
  const override = entity?.racialOverride;
  if (!override || override.ended || !_host) return null;

  if (override.racial === 'lycanthropy') {
    // LycanthropyEffect.StartQuest (:437-452) - cure arm only
    if (!isCureQuest) return null;
    if (rangeInclusive(rolls, 1, 100) >= 30) return null;
    if ((_host.findQuests?.(LYCANTHROPY_CURE_QUEST) ?? []).length > 0) return null;
    _host.startQuest?.(LYCANTHROPY_CURE_QUEST);
    return LYCANTHROPY_CURE_QUEST;
  }

  if (override.racial === 'vampirism') {
    if (isCureQuest) {
      // :233-236 - random_range_inclusive(10, 100) < 30, verbatim
      if (rangeInclusive(rolls, 10, 100) >= 30) return null;
      _host.startQuest?.(VAMPIRISM_CURE_QUEST);
      return VAMPIRISM_CURE_QUEST;
    }
    if (override.hasStartedInitialVampireQuest) {
      // :237-256 - the clan's own quest line, by the player's level
      if (rangeInclusive(rolls, 1, 100) >= 50) return null;
      const factionId = override.clan ?? 0;
      const quest = _host.getVampireClanQuest?.(factionId, entity.level ?? 1) ?? null;
      if (!quest) return null;
      _host.startQuestObject?.(quest);
      return quest.questName ?? quest.name ?? null;
    }
    // :257-262 - the initiation, once
    if (rangeInclusive(rolls, 1, 100) >= 50) return null;
    _host.startQuest?.(VAMPIRE_INITIAL_QUEST);
    override.hasStartedInitialVampireQuest = true;
    return VAMPIRE_INITIAL_QUEST;
  }

  return null;
}

/** EndVampireQuests (:375-386): the cure tombstones EVERY active
 *  quest named P0* - the whole clan line goes with the curse. Note
 *  $CUREVAM is NOT P0*: it ends itself with its own `end quest`. */
export function endVampireQuests() {
  _host?.tombstoneQuestsByPrefix?.(VAMPIRE_QUEST_PREFIX);
}

/** EndLycanthropyQuests (:660-670): every $CUREWER instance. */
export function endLycanthropyQuests() {
  _host?.tombstoneQuestsByName?.(LYCANTHROPY_CURE_QUEST);
}
