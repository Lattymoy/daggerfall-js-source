// @ts-check
// MAIN-SPINE (2026-10-26, Discord #feature-feedback "Main quest borked" - Blu3cak3: "Level 8 and still no letter from
// Morgiah ... Other people having issues too"; bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md): THE MAIN QUEST'S
// BACKBONE IS KEPT. S0000999 ("Main Quest Backbone") sends every royal letter of the opening - Morgiah's at level 3
// (`_S.46_ when _S.11_ and _S.18_`), Lhotun's at 5 - and starts each court's first quest. Nothing else starts it: the
// main quest's opener, _BRISIEN, does once, `start quest 999 999` in its `until _exitstarter_ performed` block, on the
// game's second tick (vendor/dfu-quests/Quests/_BRISIEN.txt).
//
// WHAT WENT WRONG. Parsing S0000999 reads seven royals' faction records (WhenNpcIsAvailable, WhenReputeWith ->
// person.js getFactionDataOrThrow), and the world host answers them from townTalk's FACTION.TXT, read fire-and-forget at
// boot (world.js `_questStore`). An online character's birth saves and reloads the page between the opener's first tick
// and its second (realmBirth), so the reloaded page's first quest tick parsed the backbone - and when FACTION.TXT had not
// landed yet, the parse threw "Could not find faction data for FactionID 382", `start quest` swallowed it as
// QuestMachine.StartQuest/ParseQuest do (machine.js scheduleQuestByName), StartQuest marked itself done, and nothing ever
// started the backbone again: Brisienna's letter came (its timer is in the same block), no royal letter ever did.
// Measured with the real bridge and FACTION.TXT, either order of meeting Brisienna and reaching level 3.
//
// THE LAW NOW, a departure from StartQuest.cs's one try: A LOST BACKBONE IS STARTED AGAIN (spineOwed, machine.js
// keepSpine), checked every SPINE_CHECK_TICKS - a parse that fails again (the records still away) is asked again at the
// next check. The machine RECORDS the two facts the law reads, saved with the game (machine.js `spine`): `opened`, this
// game's opener began (its start, or a saved table or journal archive naming it - or a saved table naming the Curse,
// below), and `ran`, its backbone began (its
// start, or a saved table naming it - one dropped at a load because it would not rebuild ran all the same). A game is
// owed its backbone when its opener began - and, while the opener stands, has run its `start quest` - and no backbone
// has begun or stands (running, ended, or scheduled), and no step of the story has begun.
//
// THE CURSE IS THE OPENER'S TRACE (AUDIT FB1026d II A1). A save from before the record whose opener has failed, ended and
// been removed (some two months of played game time, Brisienna never met - a failed opener files nothing in the journal
// - or met and its journal entry cleared) keeps no trace of the opener. It keeps the Curse: every game born in the port
// starts S0000977 beside _BRISIEN (scenes/quest/questBridge.js GAME_START_QUESTS), nothing else starts it (the retired
// _TUTOR__ did), and it stands until the curse is lifted, long past the courts' first quests (storyStarted then).
//
// THE EXCEPTIONS, named (AUDIT FB1026d A1/A2/A5/E2, II A2):
//   - A CLASSIC IMPORT IS OWED NOTHING. It starts no quests (world.js classicLoadBoot - the port's own departure), so it
//     has no opener of its own and no Curse, only the classic game's globals (MetLadyBrisienna among them) - which are
//     not read here: read alone, they started a backbone in every imported game, and one whose classic main quest was
//     over ended at once and was owed again every game week.
//   - A backbone this record saw begin and a load then dropped (a rebuild that failed) is not owed again: it ran, and a
//     restart could send its letters twice - so a letter it had not yet sent is lost with it, as it was before the law.
//   - A save from before this law that once dropped a backbone at a load and was saved without it is owed it again
//     (nothing says it ran), and its royal letters come again.
// The story's own record (storyStarted) is the guard for a save from before the record: a backbone that ended ended
// the main quest, and a main quest ends only past the courts' first quests.

/** The backbone, and the quest that starts it. */
export const SPINE = 'S0000999';
export const SPINE_OPENER = '_BRISIEN';
/** The Curse of Daggerfall, started beside the opener in every game born in the port (AUDIT FB1026d II A1). */
export const SPINE_CURSE = 'S0000977';
/** Quest ticks between the checks. */
export const SPINE_CHECK_TICKS = 30;

const named = (q, name) => String(q?.questName ?? '').toUpperCase() === name;

/** Whether the opener has run its backbone start: its StartQuest of S0000999 done. @param {any} quest */
function openerStartedSpine(quest) {
  for (const task of quest?.tasks?.values?.() ?? []) {
    for (const a of task.actions ?? []) {
      if (a?.constructor?.typeName !== 'StartQuest' || !a.isComplete) continue;
      if (String(a.questName ?? '').toUpperCase() === SPINE || a.questIndex1 === 999) return true;
    }
  }
  return false;
}

/** The record as a load finds it: the saved one, and what the saved table (`names`, the quests' file names) says of it -
 *  the opener, or the Curse begun beside it (AUDIT FB1026d II A1). @param {any} saved @param {string[]} names */
export function spineRecord(saved, names) {
  const has = (n) => names.some((x) => String(x ?? '').toUpperCase() === n);
  return {
    opened: saved?.opened === true || has(SPINE_OPENER) || has(SPINE_CURSE),
    ran: saved?.ran === true || has(SPINE),
  };
}

/**
 * Whether this machine's game is owed its backbone: its opener begun (on the table, it has run its start), no backbone
 * begun (one on the table, running or ended, began: the record has it) or scheduled, and no story step begun.
 * @param {{ quests: Map<any, any>, questsToInvoke: any[], storyStarted: Set<string>, spine: { opened: boolean, ran: boolean } }} m
 */
export function spineOwed(m) {
  if (m.spine.ran || m.storyStarted.size > 0) return false;
  if (m.questsToInvoke.some((q) => named(q, SPINE))) return false;
  for (const q of m.quests.values()) if (named(q, SPINE_OPENER)) return openerStartedSpine(q);
  return m.spine.opened;
}
