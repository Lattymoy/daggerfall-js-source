// @ts-check
// FIELD BUGS 2026-10-18f RELAY-SHARE (Jigglehimmer, #bug-reports, "Night Mothers Embrace Legendary does not function":
// "Does not do what the tooltip implies" - "Imprint: Sweet Mother's Kiss (of The Night Mother's Embrace) - +50% to foes
// under 25%"): A BODY'S SHARE OF ITS HEALTH, the one law every "under its health" power reads.
//
// Five copies of `health / maxHealth` stood in five files (the loot's powers, the weapon masteries, the martial and the
// arcane paths, the sigil sets). A body the relay runs - the gate's Warden, his crystals and his host, the Abyss
// Dungeon's Remnant, its Echoes and its Hearts, every lord and every add of an Elite Breach, the sea serpent - is struck
// on this machine against a stand-in (world/gate/gateBoss.js bossStandIn) whose health is a placeholder nothing empties
// (1e9 of 1e9), and every copy but the mastery's (AUDIT MARTIAL L3 F2) read it as whole: Sweet Mother's Kiss, Serpent's
// Kiss's double, Gutting Lunge, Blood Boil and Run Them Down never fired on any of them, though every screen in the fight
// holds the relay's own word of that body's health (the boss's bar draws it). A stand-in now carries its owner's reader
// of that word (`relayShare`), and this law reads it.
//
// Not a DFU member: DFU's foes are all its own (DaggerfallEntity.CurrentHealth / MaxHealth on the entity).

/**
 * A body's share of its health now, 0..1: its entity's own `health` of `maxHealth` (whole - 1 - where it says none) -
 * or, for a body the relay runs (`relayHealth`), the relay's word of it through the stand-in's `relayShare` reader,
 * clamped to 0..1; null where that body's word has said nothing (no reader, a reader that throws or answers no number).
 * @param {any} e
 * @returns {number|null}
 */
export function healthShare(e) {
  if (e?.relayHealth) {
    let s = null;
    try { s = typeof e.relayShare === 'function' ? e.relayShare() : null; } catch { s = null; }
    return typeof s === 'number' && Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : null;
  }
  return Number.isFinite(e?.health) && e.maxHealth > 0 ? e.health / e.maxHealth : 1;
}

/** The share a relay's word says of a body - `hp` of `max` - or null where it says none (no whole, no number). The
 *  stand-ins' owners build their readers from it. @param {any} hp @param {any} max @returns {number|null} */
export const wordShare = (hp, max) => (typeof hp === 'number' && Number.isFinite(hp) && typeof max === 'number' && Number.isFinite(max) && max > 0 ? hp / max : null);
