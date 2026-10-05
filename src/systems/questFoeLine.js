// @ts-check
// QUEST-FOE-LINE (FIELD BUGS 2026-10-04f, the Discord's #bug-reports "Bugged Quests": "The quest The Assassin ... has
// you track down and kill Rodyn Buckingston. I am at his location, he doesn't spawn. I double checked with multiple
// NPCs on his location as well"; the owner, of a line naming the foe as the quest's: "Do it").
//
// A0C00Y08 is DFU's own and the port runs it as written: walking into `_place_` sets `_S.11_`, which hides the named
// man (`hide npc _darkb_`) and picks ONE of four tasks that stand a RESTRAINED class foe - an Archer, a Bard, a Rogue
// or a Spellsword - on the marker he stood on (`restrain foe` + `place foe`). That foe is the kill the quest counts.
// At peace the plaque names it by its career ("Rogue" - worldTooltips.js liveEntityName, EnemyEntity's own
// `name = career.Name`), and nothing anywhere ties it to the quest, so the player stands in the right room looking for
// a man who is not there. Twenty-six quests of the corpus restrain a foe; every one of them carries a DisplayName.
//
// So, on the enhanced skin's plaque, a quest's foe at peace carries one line under its name: the quest it belongs to,
// in the journal's own words. The line is read, never kept: the foe's own QuestResourceBehaviour (every pool's live
// record carries it - scenes/questFoeHost.js bindQuestFoeHost) names its quest, and the quest is asked. NOTHING THE
// JOURNAL HAS NOT SAID (the Quest Guide arc's second law): a quest that has written no entry, that has ended, or that
// has no display name says nothing. A departure (Port-Ledger A, QUEST-FOE-LINE). The classic skins' panel draws a
// pile's rows and nothing else (ui/classicLootPanel.js), so a name frame - and this line on it - is the enhanced
// skin's alone; and the machine is only read.
import { questTitleOf } from '../ui/questRail.js';   // the journal's own title for a quest, one home

/** What the line says before the quest's title. */
export const QUEST_FOE_PREFIX = 'Quest: ';

/**
 * The line under a quest foe's name, or null.
 * @param {any} behaviour the foe's QuestResourceBehaviour (`f.questBehaviour`), or null for a foe no quest stood
 * @returns {string | null}
 */
export function questFoeLine(behaviour) {
  if (!behaviour) return null;
  const quest = behaviour.machine?.getQuest?.(behaviour.questUID) ?? null;
  if (!quest?.getResource?.(behaviour.targetSymbol)?.isFoe) return null;
  if (!quest.getLogMessages?.()?.length) return null;   // Quest.GetLogMessages: none once the quest has ended, too
  const title = questTitleOf(quest.displayName);
  return title ? `${QUEST_FOE_PREFIX}${title}` : null;
}

/**
 * A live foe record's plaque sub-lines: the quest line, or none. Each host's live-foe namer hands it the record it
 * named (scenes/exteriorFoes.js liveHoverName - the street's, both above-ground hosts - scenes/worldModes.js's
 * interior arm and scenes/dungeonContext.js's).
 * @param {any} f
 * @returns {string[]}
 */
export function questFoeSubs(f) {
  const line = questFoeLine(f?.questBehaviour);
  return line ? [line] : [];
}
