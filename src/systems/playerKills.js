// @ts-check
// SET2 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md): THE PLAYER'S OWN KILLS, TOLD.
//
// A foe's death is known in one place per pool - its damage door (scenes/exteriorFoes.js damageFoe,
// scenes/dungeonContext.js damageFoe, scenes/cityGuards.js damageGuard), where the blow's provenance (`fromPlayer`,
// `peer`, `kind`) is in hand - and nothing told anyone else whose blow it was: the loot handlers
// (corpseMarker.js registerEnemyDeathHandler) hear a death with no killer, and Renown's kill (net/renownTracker.js)
// pays an ASSIST - any blow of mine inside its window, whoever struck last. A set that answers "each kill" (Dagon's
// Rampage, Nocturnal's Eventide) needs the other thing: MY blow was the one that killed it. Each door tells it here, at
// the moment it marks the foe dead, when the blow was mine and not a peer's; and a foe another player's machine runs
// tells it when its owner's `slain` word arrives (exteriorFoes.js - DISC10-E's own report of my killing blow).
//
// A leaf: it imports nothing, so every pool can tell it without a cycle.

const _listeners = new Map();
/** Register a listener by name: `fn(entity, { kind })` - the killed foe's entity, and the blow's kind ('melee',
 *  'arrow', 'spell', 'remote' for a puppet's owner's word). A name re-registered replaces; `null` removes. */
export function registerPlayerKillListener(name, fn) { if (typeof fn === 'function') _listeners.set(name, fn); else _listeners.delete(name); }
/** A pool's word: the player's own blow killed this foe. Every listener is told; one that throws is skipped. */
export function reportPlayerKill(entity, info = {}) {
  const kind = typeof info?.kind === 'string' ? info.kind : 'melee';
  for (const fn of _listeners.values()) { try { fn(entity, { kind }); } catch { /* a set is not the death's problem */ } }
}
