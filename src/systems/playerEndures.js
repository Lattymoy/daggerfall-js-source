// @ts-check
// DEEDS3 (2026-10-23, bible/06-Systems/Deeds-And-Talents.md section 6.1): WHAT THE PLAYER ENDURED, TOLD.
//
// A deed is earned by facing the thing it names, and the elements are faced in two doors: a foe's spell landing on me
// (systems/effects.js applySpell, once a landing) and a foe's poison (systems/poisons.js inflictPoison, never a drug).
// Each door tells it here with the spell's effect flags (spellcast.js EFFECT_FLAGS), and deeds.js counts the elements it
// names. playerKills.js's shape: a leaf, it imports nothing, so neither door grows a cycle.

const _listeners = new Map();
/** Register a listener by name: `fn(entity, flags)` - the player, and the effect flags of what it endured. A name
 *  re-registered replaces; `null` removes. */
export function registerPlayerEndureListener(name, fn) { if (typeof fn === 'function') _listeners.set(name, fn); else _listeners.delete(name); }
/** A door's word: the player endured something carrying these effect flags. Every listener is told; one that throws
 *  is skipped. */
export function reportPlayerEndured(entity, flags) {
  if (!entity?.isPlayer || entity.peer || !(flags > 0)) return;   // AUDIT DEEDS: a refereed fight's stand-in for a peer is no player of mine
  for (const fn of _listeners.values()) { try { fn(entity, flags); } catch { /* a deed is not the spell's problem */ } }
}
