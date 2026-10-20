// QUEST-WORDS-FIRST (2026-10-20, Dudey: "when youve completed a quest that when you click the npc the quest complete message
// with its reward afterwards pops up and then you see the dialog options... cause right now you get the complete quest
// message plus reward when you press exit in the dialog options which is weird and wrong").
//
// WHY IT CAME LAST. A click on a quest's Person only marks it clicked (machine.setLastNPCClicked); its ClickedNpc trigger
// runs on the machine's next tick, and the talk window opened in the same click pauses the world, so the tick - and the
// quest's words and its reward - waited for the conversation to end. And the talk window draws in townTalk's slot, over
// the building's own window stack, where the quest's box stands.
//
// THE ORDER NOW. When the click marked a Person of a live quest, the machine ticks at once. If that raised a window in
// the building's slot (the quest's box, then its reward), the NPC's own door - the talk, the guild's or the shop's popup -
// opens once that slot is clear again: the words, the reward, then the conversation. A click no quest heard, or one
// whose tick said nothing, opens the door at once, as before.
//
// The host hands in its two reads (scenes/worldModes.js): `tick()` the bridge's tick now, `top()` the building slot's top
// window; and calls `settled(top)` whenever that slot's top changes.

/** Does a click on this NPC mark a Person in a live quest (setLastNPCClicked's sweep)? */
export function clickHeardByQuest(machine) {
  for (const quest of machine?.quests?.values?.() ?? []) {
    if (quest?.questComplete) continue;
    for (const r of quest?.resources?.values?.() ?? []) if (r?.isPerson && r.hasPlayerClicked) return true;
  }
  return false;
}

export function createQuestClickFirst({ tick, top, heard }) {
  let waiting = null;
  return {
    /** Open the NPC's door now (`open`), or, when the click's quest spoke, after its windows. Answers whether it waits. */
    hold(open) {
      if (!heard?.()) return false;
      const before = top?.() ?? null;
      try { tick?.(); } catch (e) { console.error('[quest] the click\'s tick failed:', e?.message ?? e); return false; }
      const after = top?.() ?? null;
      if (!after || after === before) return false;
      waiting = open;
      return true;
    },
    /** The slot's top changed: an empty slot opens the door that waited. */
    settled(w) {
      if (w || !waiting) return;
      const open = waiting;
      waiting = null;
      open();
    },
    /** A scene left with the door still waiting: it never opens. */
    drop() { waiting = null; },
    get waiting() { return !!waiting; },
  };
}
