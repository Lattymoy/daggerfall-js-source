// @ts-check
// EG15 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, the Battlemage's
// Panoply): THE PLAYER'S OWN CASTS, TOLD.
//
// A spell the player casts is known in one place - the ONE cast engine every host builds (scenes/hostMagic.js
// createPlayerMagic: scenes/world.js's, whose instance scenes/worldModes.js's interiors take, scenes/exterior.js's and
// scenes/dungeonContext.js's), at its release frame's `done()`, where the spell leaves the hands and DFU raises
// OnCastReadySpell - and nothing told anyone but the quest machine. The Battlemage's Discipline (the Panoply's 4-piece
// tier, systems/sigil/sigilSetPowers.js setCast) answers "a spell cast": it arms the next weapon blow with the spell's element
// and remembers the cost the next blows return a share of. Each released cast is told here with what it cost (0 for a
// free ready: an item's cast-when-used, a trap's spell), playerKills.js's own shape.
//
// A leaf: it imports nothing, so the cast engine tells it without a cycle. Not a DFU member. Ledger A (EG15).

const _listeners = new Map();
/** Register a listener by name: `fn(entity, spell, cost)` - the caster's entity (mine), the spell record that left the
 *  hands, and the magicka its cast spent. A name re-registered replaces; `null` removes. */
export function registerPlayerCastListener(name, fn) { if (typeof fn === 'function') _listeners.set(name, fn); else _listeners.delete(name); }
/** The cast engine's word: the player's own spell left the hands. Every listener is told; one that throws is skipped. */
export function tellPlayerCast(entity, spell, cost = 0) {
  const spent = Number.isFinite(cost) && cost > 0 ? cost : 0;
  for (const fn of _listeners.values()) { try { fn(entity, spell, spent); } catch { /* a set is not the cast's problem */ } }
}
