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
/** Register a listener by name: `fn(entity, { kind, fx })` - the killed foe's entity, the blow's kind ('melee',
 *  'arrow', 'spell', 'remote' for a puppet's owner's word) and (STOREFRONT) where its body falls, for a kill effect
 *  (killFxOf), or null. A name re-registered replaces; `null` removes. */
export function registerPlayerKillListener(name, fn) {
  if (typeof fn === 'function') _listeners.set(name, fn);
  else _listeners.delete(name);
}
/** A pool's word: the player's own blow killed this foe. Every listener is told; one that throws is skipped. */
export function reportPlayerKill(entity, info = {}) {
  const kind = typeof info?.kind === 'string' ? info.kind : 'melee';
  const fx = info?.fx ?? null;
  for (const fn of _listeners.values()) {
    try {
      fn(entity, { kind, fx });
    } catch {
      /* a set is not the death's problem */
    }
  }
}
/** STOREFRONT (bible/06-Systems/Storefront.md section 4): WHERE A FOE RECORD'S BODY FALLS, for a kill effect - its feet,
 *  height and width (m), and the flat it stood in while one is drawn (a Morrowind body's, a concealed foe's or a released
 *  one's is none) - read by the pool's door as the foe dies, before its flat is let go. Null with no feet. Pure. */
export function killFxOf(f) {
  const feet = f?.ai?.feet;
  if (!feet || !(feet.length >= 3)) return null;
  const b = f.batch ?? null;
  const shown = b && !b.castOnly && !b._dead && !(b.conceal && b.conceal.mode) ? b : null;
  const h = Number.isFinite(f.ai.height) && f.ai.height > 0 ? f.ai.height : Math.abs(shown?.size?.h ?? 1.8);
  return { at: [feet[0], feet[1], feet[2]], h, w: Math.abs(shown?.size?.w ?? h * 0.45), batch: shown };
}
