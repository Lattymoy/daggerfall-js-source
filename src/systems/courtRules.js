// @ts-check
// WBX6 (2026-09-26, Swololo on Discord: "regeneration defeats the purpose if someone regenerates all the health back in
// 5 seconds. instead of wiping buffs, maybe disable regen in oblivion"): THE DEADLANDS KEEP NO REGENERATION. One switch
// the world host sets every frame (scenes/world.js - the mode machine's gateArenaDay: the Burning Court stands under this
// player), read where each regeneration lives, and each heals nothing while it is on:
//   - the Regenerate effect's round (systems/effects.js - the spell, the potion, the enchantment's cast),
//   - a RegensHealth enchantment's round (systems/enchantments.js),
//   - a career's Regenerate Health advantage (systems/passiveSpecials.js).
// HEALING IS NOT REGENERATION: a Heal spell, a potion of healing and a friend's cast land as they always did - the fight
// still has its healers (World-Bosses.md section 6: standing the fight earns the spoils). Nothing is wiped: a buff that
// regenerates simply regrows nothing inside the court, and goes on regrowing the moment its wearer leaves it.
//
// Offline and outside the court the switch is off and nothing changes. Not a DFU member. Ledger A (WB).

let _on = false;

/** The court's laws on (the Burning Court stands under this player) or off. */
export function setCourtRules(on) { _on = !!on; }

/** Whether a regeneration may heal now - never inside the court. */
export const regenBarred = () => _on;
