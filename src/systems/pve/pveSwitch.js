// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): THE SWITCH. Off: no spawn reads a template, and every foe stands as it
// does today. It turns on for a whole realm at once, in the stage that wires the spawns - never per player, so two
// players in one place never meet two different worlds. Ledger A (FIXED-PVE).

/** Whether fixed PvE stands. Off until the spawn stage ships. */
export const fixedPveOn = () => false;
