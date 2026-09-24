// ═══════════════════════════════════════════════════════════════════
// DISC16-F — THE WATCH DEFENDS THE TOWN. The port's own; a departure
// (Port-Ledger A), behind the Features row `town-watch`.
//
// Discord, relayed by Mac ("I want to fix these issues + enhance guard
// interaction"): "guards will arrest and attack me for resting within
// city limits but will not protect me from 5 angry centaur invaders
// who wanna beat me to death in town?"
//
// WHAT DFU DOES, AND WHY THIS IS NOT IT. DFU's combat watch exists
// only during a crime: the Knight_CityWatch enemy is spawned by
// SpawnCityGuards (PlayerEntity.cs:651-689) and destroyed the moment the
// crime clears (EnemyEntity.cs:184-191). A wandering guard NPC is
// scenery, and enemy senses skip civilians (EnemySenses.cs:738-749). So
// with no crime there is no watch at all, and nothing in DFU puts a
// guard between a monster and the player. The resting arrest the report
// sets against it IS DFU's law (DaggerfallRestWindow.cs:542-600, the
// IllegalRestWarning box first), and it stays 1:1.
//
// WHAT THIS DOES. When a hostile monster is hunting the player inside
// a town's widened rect (IsPlayerInTown's own rect, PlayerGPS.cs:504-527
// and :671-691) and the player holds no crime, the watch comes - after
// DFU's own arrival countdown for a witnessed crime, Random.Range(5, 11)
// seconds (PlayerEntity.cs:739-741), and at the same place the crime
// response would put them (the wandering guards near the player first,
// else 2-5 at the spawner's band). They come as the player's ALLIES
// (team PlayerAlly, the allied summon's shape, exteriorFoes.js), so
// DFU's own target chain (EnemySenses.GetTargets, characters/
// enemyTargets.js) sends them at the monster and never at the player,
// and the existing guard-vs-monster melee resolves the fight. They walk
// away once the town is quiet. A crime turns them into the ordinary
// watch on the spot.
//
// THIS MODULE IS THE DECISION ONLY - pure, no scene, no clock of its
// own - so the pins can drive it. The guard pool mints and dismisses
// (scenes/cityGuards.js summonDefenders / dismissDefenders); the host
// reads the town and the threats (scenes/world.js).
// ═══════════════════════════════════════════════════════════════════

import { isPlayerTarget } from '../characters/enemyTargets.js';

/** Random.Range(5, 11), the int overload: the witnessed-crime arrival
 *  (PlayerEntity.cs:739-741, cityGuards.js's countdown) - the watch takes
 *  as long to reach a fight as to reach a crime. */
export const TOWN_WATCH_ARRIVAL_MIN_SECONDS = 5;
export const TOWN_WATCH_ARRIVAL_SPAN = 6;
/** How long the town must be quiet before the defenders walk away. The
 *  port's own number: long enough that a monster stepping out of sight
 *  for a moment does not send them home. */
export const TOWN_WATCH_STAND_DOWN_SECONDS = 10;

/**
 * A foe that brings the watch: alive and this client's own (a peer's
 * puppet is its owner's business, WORLD6b), hostile, not the player's
 * ally, not a quest's foe (a quest foe is kept out of every other
 * enemy's target list too, EnemySenses.cs:806-815), not a watchman, and
 * HUNTING a player - not a rat minding its own business at the edge of
 * town - inside the town's widened rect (`inTownRect`, the host's test).
 */
export function isTownThreat(f, { inTownRect, isWatchman = () => false } = {}) {
  if (!f || f.dead || f.puppet || !f.ai || !f.entity) return false;
  if (f.isQuestFoe) return false;
  if (!f.ai.isHostile) return false;
  if (f.entity.team === 'PlayerAlly') return false;
  if (isWatchman(f)) return false;
  if (!isPlayerTarget(f.ai.target)) return false;
  return !!inTownRect?.(f);
}

/**
 * The watch's decision, one frame at a time. `tick` answers 'summon'
 * (the defenders arrive now), 'dismiss' (they walk away now) or null.
 *
 *   enabled       the Features switch
 *   playerInTown  IsPlayerInTown(true, true) - outdoors, in the widened rect
 *   crime         the player's CrimeCommitted - a wanted player gets the
 *                 ordinary watch, never defenders (the pool turns any
 *                 standing defender into it)
 *   threats       how many isTownThreat foes stand
 *   defenders     how many defenders are alive
 *   locationKey   the location the countdown was started in - a player
 *                 who leaves inside the window is not followed, the
 *                 countdown's own law (PlayerEntity.cs:355-359)
 */
export function createTownWatch({ rand = Math.random } = {}) {
  let countdown = 0;
  let countdownKey = null;
  let calm = 0;
  return {
    get countdown() { return countdown; },
    tick(dt, { enabled = true, playerInTown = false, crime = false, threats = 0, defenders = 0, locationKey = null } = {}) {
      if (crime) { countdown = 0; calm = 0; return null; }   // the pool enlists them; nothing to decide
      if (!enabled || !playerInTown) {
        countdown = 0; calm = 0;
        return defenders > 0 ? 'dismiss' : null;
      }
      if (threats > 0) {
        calm = 0;
        if (defenders > 0) return null;
        if (countdown > 0) {
          countdown -= dt;
          if (countdown > 0) return null;
          countdown = 0;
          return locationKey === countdownKey ? 'summon' : null;
        }
        countdown = TOWN_WATCH_ARRIVAL_MIN_SECONDS + Math.floor(rand() * TOWN_WATCH_ARRIVAL_SPAN);
        countdownKey = locationKey;
        return null;
      }
      countdown = 0;
      if (defenders <= 0) { calm = 0; return null; }
      calm += dt;
      if (calm < TOWN_WATCH_STAND_DOWN_SECONDS) return null;
      calm = 0;
      return 'dismiss';
    },
  };
}
