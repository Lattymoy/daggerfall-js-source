// @ts-check
// START1 (2026-10-24, bible/06-Systems/Alternate-Starts-Arc.md; Mac: "Each of these quests should tie into the main
// story seamlessly but allow for the main quest to be started on the player's watch", "Keep privateers hold, give it a
// new quest", "A letter they open"): THE STARTS - the quest a new character begins in, and the main quest it hands on to.
// A leaf: the bridge (scenes/quest/questBridge.js GAME_START_QUESTS), the machine's protected list (quest/machine.js
// PROTECTED_QUESTS), the main quest's name test (quest/questLists.js isMainQuestName) and the questlines' layer
// (questlines/qlLayer.js) read it, and it reads nothing.
//
// DFU's StartGameBehaviour starts _BRISIEN on a new character (StartGameBehaviour.cs:445-447), and its `until
// _exitstarter_ performed:` block starts the main quest's driver (S0000999) and Lady Brisienna's invitation clock on
// its first tick (Task.cs:257-262 - "starting player outside of PH ... will cause main quest to start as normal"): the
// story is on a clock from the first second, and its failure letter comes 51 to 58 days in. A start here is a quest of
// DFO's own in DFU's text form (systems/starts/quests/<QUEST>.txt, read by the same parser and machine), and every start
// keeps one contract, pinned for each name in START_QUESTS (test/systems/starts/start1_bay.test.js):
//   - it ends with THE COMMISSION, a quest letter (`Item _commission_ letter used N`) whose `used do` sets `_opened_`;
//   - opening it is the player's own act, at any time - nothing of the main quest runs before it, so no clock and no
//     failure letter;
//   - opened, it orders the player to the city of Daggerfall (`Place _daggerfall_ permanent DaggerfallCity1`, the
//     place S0000977 watches), and there, `when _opened_ and _incity_`, it starts _BRISIEN and ends. _BRISIEN then runs
//     as DFU wrote it, its remote tavern drawn from the city of Daggerfall's own region as DFU's start draws it from
//     Privateer's Hold's - its letter's "_dirtypit_ in __dirtypit_ of Daggerfall" true wherever the seal was broken.
// _BRISIEN's own start-up popup (1025, "You wake and look around the room ... Once free of the cave, you can begin the
// Emperor's quest") is the classic start's, and no start shows it now: the port's patch takes its `say` out
// (quest/questPatches.js). A departure, Port-Ledger section A.

/** The Iliac Bay's start: Privateer's Hold, the wreck, and the commission the tide carried in (Mac: "Keep privateers
 *  hold, give it a new quest"). */
export const BAY_START_QUEST = '_STARTIB';

/** Every start's quest, by name. START1 ships the Bay's; a province's joins with the ship passage (the arc page's
 *  section 6). */
export const START_QUESTS = Object.freeze([BAY_START_QUEST]);

/** The main quest's opener, as DFU ships it - the quest a start's commission starts in the city of Daggerfall. */
export const MAIN_QUEST_OPENER = '_BRISIEN';

/** Is `questName` a start's quest? By the quest's own name, as the machine's protected list and the main quest's test
 *  read one (case-insensitive, as C#'s IsProtectedQuest). */
export const isStartQuestName = (questName) => {
  const n = String(questName ?? '').toUpperCase();
  return START_QUESTS.some((s) => s.toUpperCase() === n);
};
