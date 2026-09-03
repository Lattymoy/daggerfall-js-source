// U32: the character sheet's navigation hooks, in ONE place.
//
// Three hosts open the sheet (dungeonContext, exterior, world). Each
// has to say how to build the windows its buttons lead to, and two of
// those four - the inventory and the spellbook - genuinely differ per
// host: a dungeon's inventory can carry a loot target, a town's cannot,
// and a host without a spell index has no spellbook to give.
//
// The other two do NOT differ, so they are built here rather than
// three times. That is the FOUR HOSTS rule doing its job: the last
// time a window was wired host-by-host, chargen ended up living in one
// host only and a town boot ran the whole session on a pre-chargen
// entity.
import { QuestJournalWindow, preloadQuestJournalArt } from './questJournal.js';
import { PlayerHistoryWindow, preloadPlayerHistoryArt } from './playerHistory.js';

/**
 * @param {object} deps
 *   entity            - the player entity (history reads its backStory)
 *   inventory()       - the host's own inventory window, or null
 *   spellbook()       - the host's own spellbook window, or null
 *   questMessages()   - QuestMachine.getAllQuestLogMessages()
 *   notebook()        - the PlayerNotebook, or null
 *   artDeps           - {renderer, fetchBytes, palette} to warm LGBK00I0
 * @returns the hook bag CharSheet's constructor takes.
 */
export function charSheetHooks({
  entity, inventory = null, spellbook = null, questMessages = null, notebook = null, artDeps = null,
  // HandleQuestClicks' find-place seam (DaggerfallQuestJournalWindow.cs
  // :439-466), host-specific like inventory and spellbook: only a host
  // that owns a travel map can answer it, and one that does not leaves
  // all three unset so the journal simply never offers the dialog.
  currentLocationName = null, canFindPlace = null, gotoPlace = null,
  // AUDIT 54: the sheet's own TEXT.RSC door. StatButton_OnMouseClick
  // (DaggerfallCharacterSheetWindow.cs:925-941) pops records 0..7 - the
  // eight attribute descriptions - as ClickAnywhereToClose boxes, and
  // every host already holds this exact expression for the inventory
  // window's item text. Host-agnostic in shape, host-supplied in fact,
  // which is why it comes through the ONE hook builder rather than
  // three copies: THE FOUR HOSTS rule.
  rows = null,
} = {}) {
  // Both new windows share LGBK00I0.IMG, so one warm covers both. Fire
  // and forget, exactly as preloadCharSheetArt does: art that has not
  // arrived leaves the window on its text fallback rather than trapping.
  if (artDeps) { preloadQuestJournalArt(artDeps); preloadPlayerHistoryArt(artDeps); }
  return {
    // Host-specific: passed straight through. A host that hands null
    // gets the sheet's honest refusal rather than a dead button.
    inventory: inventory ?? undefined,
    spellbook: spellbook ?? undefined,
    // Host-agnostic: the logbook needs only the quest machine's log
    // walk and the notebook, the history only the entity.
    //
    // A host with NO quest source does not get an empty logbook - it
    // gets the refusal. "You have no active quests" would be a lie
    // told to a player who has three, and the port does not tell a
    // player that a thing is empty when the truth is that this screen
    // cannot see it. The dungeon host is exactly this case today.
    logbook: (questMessages || notebook)
      ? () => new QuestJournalWindow({
        questMessages: questMessages ?? (() => []),
        notebook: notebook ?? (() => null),
        currentLocationName: currentLocationName ?? undefined,
        canFindPlace: canFindPlace ?? undefined,
        gotoPlace: gotoPlace ?? undefined,
      })
      : undefined,
    history: () => new PlayerHistoryWindow(entity),
    // AUDIT 54: the attribute popups' text. A host with no TEXT.RSC
    // leaves it unset and the eight buttons still CLICK and consume,
    // which is what DFU's own empty-record path shows.
    rows: rows ?? undefined,
  };
}
