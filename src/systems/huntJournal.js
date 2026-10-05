// @ts-check
// RVN7c (bible/12-Enhanced-AI/Feud-Arc.md 18.3): A REVENANT'S HUNT IN THE QUEST LOG, AND ITS ONE PRESS THERE.
//
// A revenant whose lair the player has heard of rides the quest log every journal face reads (scenes/questBridge.js
// questLog, wrapped by the world host - scenes/world.js) as an active side quest whose id is `hunt:<revenant id>` -
// BOUNTY1's precedent (systems/bountyJournal.js). The faces (the pause window's Quests tab, ui/enhancedMenu.js; the
// chronicle, ui/enhancedChronicle.js) are lazy chunks, so the revenant store registers its door here once and the
// faces ask this leaf. Abandoning a hunt forgets that the player knew its lair. It imports nothing.
//
// Not a DFU member.

/** @type {{ abandon: (id: string) => boolean } | null} */
let _journal = null;
/** The revenant store's word: its door (null clears). */
export function setHuntJournal(j) { _journal = j && typeof j === 'object' ? j : null; }
/** The quest-log id prefix a hunt wears. */
export const HUNT_QUEST_PREFIX = 'hunt:';
/** Is this quest-log id a hunt's? */
export const isHuntQuestId = (id) => typeof id === 'string' && id.startsWith(HUNT_QUEST_PREFIX);
/** Give the hunt up, from the journal - its lair forgotten. */
export function abandonHuntQuest(id) {
  if (!isHuntQuestId(id) || !_journal) return false;
  try { return !!_journal.abandon(id.slice(HUNT_QUEST_PREFIX.length)); } catch { return false; }
}
