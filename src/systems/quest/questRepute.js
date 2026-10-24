// QUEST REPUTE (Quest.cs:36-37): what a quest's end pays the faction it was given for - DFU's QuestSuccessRep and
// QuestFailureRep. A leaf, no imports: quest.js charges them at EndQuest, and the guild hall's way back
// (guild/guildServiceFlow.js wayBackLines, WAY-BACK, FIELD BUGS 2026-10-16d) says the success's without reaching the
// quest machine - the HUD stays light (AUDIT GUIDE O6), and guildServiceFlow is on its walk.

export const QUEST_SUCCESS_REP = 5;     // Quest.cs:36
export const QUEST_FAILURE_REP = -2;    // Quest.cs:37
