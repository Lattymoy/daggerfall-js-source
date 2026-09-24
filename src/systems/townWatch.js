// ═══════════════════════════════════════════════════════════════════
// DISC18-F — THE WATCH DEFENDS THE TOWN. The port's own; a departure
// (Port-Ledger A), behind the Features row `town-watch`.
//
// Discord, relayed by Mac ("I want to fix these issues + enhance guard
// interaction"): "guards will arrest and attack me for resting within
// city limits but will not protect me from 5 angry centaur invaders
// who wanna beat me to death in town?"
//
// WHAT DFU DOES, AND WHY THIS IS NOT IT. DFU's combat watch exists
// only during a crime: the Knight_CityWatch enemy is spawned by
// SpawnCityGuards (PlayerEntity.cs:621-745) and destroyed the moment the
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
// seconds (PlayerEntity.cs:739-741), and from two of the crime
// response's places (the wandering guards near the player first, else
// 2-5 at the spawner's band; not its third, the townsperson behind the
// player, :675-680). They come as the player's ALLIES (team PlayerAlly,
// the allied summon's shape, exteriorFoes.js), so DFU's own target chain
// (EnemySenses.GetTargets, characters/enemyTargets.js) sends them at the
// monster and never at the player, and the existing guard-vs-monster
// melee resolves the fight. They walk away once the town is quiet. A
// crime turns them into the ordinary watch on the spot - and a blow on
// one is that crime (cityGuards.js handleAttackFromPlayer).
//
// AUDIT DISC18 (the watch lens) closed four holes in the first cut: the
// squad walked away mid-melee (a monster fighting a defender read as
// quiet), a struck defender went rogue with no crime, the town sent a
// fresh armoured squad for every one a monster killed (an armour farm),
// and the player's own splash and shafts struck the defenders. See
// isTownThreat, TOWN_WATCH_MAX_WAVES and cityGuards.js.
//
// THIS MODULE IS THE DECISION AND THE HOST'S FRAME - pure, no scene,
// no clock of its own - so the pins can drive both. The guard pool mints
// and dismisses (scenes/cityGuards.js summonDefenders / dismissDefenders);
// the host answers where the town is (scenes/world.js, the one host that
// runs it: the fixed-city host, exterior.js, has no watch).
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
/** How many defender waves one incident brings. The port's own number.
 *  Without it a monster the defenders could not beat drew a fresh squad
 *  every countdown for as long as it stood - sixteen waves in two
 *  minutes against one centaur (AUDIT DISC18). The count starts over
 *  once the town has been quiet a stand-down's length. */
export const TOWN_WATCH_MAX_WAVES = 3;

/**
 * A foe that brings the watch, and keeps it: alive and this client's own
 * (a peer's puppet is its owner's business, WORLD6b), hostile, not the
 * player's ally, not a quest's foe (a quest foe is kept out of every
 * other enemy's target list too, EnemySenses.cs:806-815), and HUNTING a
 * player or a standing defender - not a rat minding its own business at
 * the edge of town - inside the town's widened rect (`inTownRect`, the
 * host's test). The defender half is the fight the watch came for: a
 * monster that turns from the player onto a defender is still that
 * fight, and counting the player's hunters alone read the town quiet
 * the moment it turned - the squad walked away mid-melee, every ten
 * seconds (AUDIT DISC18).
 */
export function isTownThreat(f, { inTownRect } = {}) {
  if (!f || f.dead || f.puppet || !f.ai || !f.entity) return false;
  if (f.isQuestFoe) return false;
  if (!f.ai.isHostile) return false;
  if (f.entity.team === 'PlayerAlly') return false;
  const t = f.ai.target;
  if (!isPlayerTarget(t) && !(t?.defender === true && !t.dead)) return false;
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
 *
 * An INCIDENT is the time a threat stands; it ends once the town has
 * been quiet TOWN_WATCH_STAND_DOWN_SECONDS, in town or out, and brings
 * at most TOWN_WATCH_MAX_WAVES waves.
 */
export function createTownWatch({ rand = Math.random } = {}) {
  let countdown = 0;
  let countdownKey = null;
  let calm = 0;
  let quiet = 0;
  let waves = 0;
  return {
    get countdown() { return countdown; },
    get waves() { return waves; },
    tick(dt, { enabled = true, playerInTown = false, crime = false, threats = 0, defenders = 0, locationKey = null } = {}) {
      if (threats > 0) quiet = 0;
      else if ((quiet += dt) >= TOWN_WATCH_STAND_DOWN_SECONDS) waves = 0;   // the incident is over
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
          if (locationKey !== countdownKey) return null;
          waves++;
          return 'summon';
        }
        if (waves >= TOWN_WATCH_MAX_WAVES) return null;   // the town has sent all it will this incident
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

/**
 * One frame of the town watch in a host, after its pools moved - all the
 * host does with the decision, here so the pins run it rather than read
 * it (AUDIT DISC18: six one-token breaks of the inline copy survived the
 * whole suite). The host answers where the town is:
 *
 *   enabled, inTown, crime, locationKey   as createTownWatch's tick
 *   foes          the host's monsters, read for isTownThreat
 *   inTownRect    the host's rect test for a foe's feet
 *   guards        the watch's pool (cityGuards.js): defenderCount,
 *                 summonDefenders, dismissDefenders
 *   playerFeet, playerFwd   where the arrival is placed from
 *   pool          the host's wandering guard NPCs, read only on 'summon'
 *
 * Answers the act.
 */
export function runTownWatchFrame(watch, dt, { enabled, inTown, crime, locationKey, foes = [], inTownRect, guards, playerFeet, playerFwd, pool = () => [] }) {
  const threats = inTown ? foes.filter((f) => isTownThreat(f, { inTownRect })) : [];
  const act = watch.tick(dt, {
    enabled, playerInTown: inTown, crime,
    threats: threats.length, defenders: guards.defenderCount(), locationKey,
  });
  if (act === 'summon') guards.summonDefenders({ playerFeet, playerFwd, pool: pool(), threats }).catch((e) => console.error('[guards]', e));
  else if (act === 'dismiss') guards.dismissDefenders();
  return act;
}
