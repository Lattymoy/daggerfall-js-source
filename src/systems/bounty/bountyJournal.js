// @ts-check
// BOUNTY1 (2026-09-28, Mac: "i also dont see the bounty in my questlog means i cant abandon it?"): A BOUNTY IN THE
// QUEST LOG, AND ITS TWO PRESSES THERE.
//
// A held bounty rides the quest log every journal face reads (scenes/quest/questBridge.js questLog, wrapped by the world
// host - scenes/world.js) as an active side quest whose id is `bounty:<bounty id>`. The faces (the pause window's
// Quests tab, ui/enhanced/enhancedMenu.js; the chronicle, ui/enhanced/enhancedChronicle.js) are lazy chunks mounted by many hosts, so
// rather than thread two more hooks through every one of them, the host registers the bounty host's own doors here
// once and the faces ask this leaf. It imports nothing, so any chunk can reach it without a cycle.

/** @type {{ abandon: (id:string) => boolean, share: (id:string) => boolean, canShare: (id:string) => boolean } | null} */
let _journal = null;
/** The world host's word: the bounty host's doors (null clears). */
export function setBountyJournal(j) { _journal = j && typeof j === 'object' ? j : null; }

/** The quest-log id prefix a bounty wears. */
export const BOUNTY_QUEST_PREFIX = 'bounty:';
/** Is this quest-log id a bounty's? */
export const isBountyQuestId = (id) => typeof id === 'string' && id.startsWith(BOUNTY_QUEST_PREFIX);
const bare = (id) => String(id).slice(BOUNTY_QUEST_PREFIX.length);

/** Give the bounty up, from the journal. */
export function abandonBountyQuest(id) {
  if (!isBountyQuestId(id) || !_journal) return false;
  try { return !!_journal.abandon(bare(id)); } catch { return false; }
}
/** Share it with the party, from the journal. */
export function shareBountyQuest(id) {
  if (!isBountyQuestId(id) || !_journal) return false;
  try { return !!_journal.share(bare(id)); } catch { return false; }
}
/** May it be shared now (in a party, not shared already)? */
export function bountyQuestShareable(id) {
  if (!isBountyQuestId(id) || !_journal) return false;
  try { return !!_journal.canShare(bare(id)); } catch { return false; }
}
