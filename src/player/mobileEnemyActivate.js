// AUDIT 63 F33: PlayerActivate.ActivateMobileEnemy (:800-841) - the
// arm every host's activation ladder was missing. A living enemy was
// not an activation target anywhere in the port: the only foe the ray
// could reach was a CORPSE (the loot pick), so Info/Grab/Talk said
// nothing about the thing in front of you and Steal mode could not
// pickpocket a class enemy at all - `CalculatePickpocketingChance`'s
// level-difference arm (formulas.js, FormulaHelper.cs:262-265) had
// exactly one caller in the tree and it passed null.
//
// DFU's body, both arms:
//
//   case Info: case Grab: case Talk:
//       enemyName = GetLocalizedEnemyName(mobileEnemy.ID);          // :816
//       startsWithVowel = "aeiouAEIOU".Contains(enemyName[0]);      // :817
//       PopupMessage(youSeeAn / youSeeA with %s -> enemyName);      // :818-825
//       break;                                                     // NO distance gate
//   case Steal:
//       if (EntityType != EnemyClass) break;                       // :827-828
//       if (enemyEntity != null && !PickpocketByPlayerAttempted) {  // :830
//           if (hit.distance > PickpocketDistance) {                // :832
//               SetMidScreenText(youAreTooFarAway); break; }        // :834-835
//           PickpocketByPlayerAttempted = true;                     // :837
//           Pickpocket(mobileEnemyBehaviour); }                     // :838
//
// Two orderings are load-bearing and are pinned. The distance test is
// NESTED INSIDE the attempt flag (:830-836), so a foe already tried
// produces NO output at any range - the same nesting AUDIT 26 F048
// forced on the townsperson arm. And a MONSTER breaks out silently
// (:827-828, DFU's own comment: "For now, the only enemy mobiles
// being allowed by DF Unity are classes"), consuming the activation
// because the enemy IS the ray's hit.
//
// The failure tail belongs to the host, not to the pickpocket law:
// PlayerActivate.cs:1654-1658 skips the crime and the guard spawn for
// a non-null target, and :1661-1671 replaces them with
//     if (!enemyMotor.IsHostile) MakeEnemiesHostile();
//     enemyMotor.MakeEnemyHostileToAttacker(PlayerEntityBehaviour);
// - the `IsHostile` read BEFORE the walk (the walk flips this foe
// too), and the second call unconditional. `resetAllyTeamOnPlayerAttack`
// does NOT belong here: it is DaggerfallEntityBehaviour's damage path
// (dungeonContext.handleAttackFromPlayer), and Pickpocket does not
// call it.
//
// The flag is per-foe and is NOT serialized: EnemyEntity
// .PickpocketByPlayerAttempted (EnemyEntity.cs) is read and written by
// PlayerActivate alone and appears in no save record, so it lives on
// the live foe entity and dies with the pool, as DFU's does.

import { PICKPOCKET_DISTANCE, TOO_FAR_AWAY_TEXT, pickFoeHit } from './activate.js';
import { PLAYER_TARGET } from '../characters/enemyTargets.js';
import { enemyDisplayName } from '../characters/enemyBasics.js';
import { pickpocket } from '../systems/talk.js';

/** Internal_Strings.csv:23-24 - `youSeeAn,You see an %s.` and
 *  `youSeeA,You see a %s.`, picked by the vowel test at :817 over the
 *  FIRST letter of the localized enemy name. */
export const YOU_SEE_A_TEXT = 'You see a %s.';
export const YOU_SEE_AN_TEXT = 'You see an %s.';
export function youSeeEnemyText(name) {
  const n = name ?? '';
  const vowel = 'aeiouAEIOU'.includes(n[0] ?? '');
  return (vowel ? YOU_SEE_AN_TEXT : YOU_SEE_A_TEXT).replace('%s', n);
}

/**
 * ActivateMobileEnemy for one clicked foe.
 *
 * @param foe        the live pool record ({ ai, entity, mobileType, dead })
 * @param distance   the hit distance the pick handed back
 * @param mode       the interaction mode ('info'|'grab'|'talk'|'steal')
 * @param player     the player entity
 * @param deps.hud            PopupMessage / SetMidScreenText sink
 * @param deps.modal          MessageBox sink (both Pickpocket successes)
 * @param deps.makeEnemiesHostile  the host's GameManager.MakeEnemiesHostile
 *   over its full live foe union
 * @param deps.playerFeet     where the attack came from, for the seed
 * @param deps.rolls          Dice100 / Random.Range
 * @param deps.nothingText    GetRandomText(8999)
 * @returns true when the activation was CONSUMED (DFU's `break` out of
 *   ActivateMobileEnemy - the enemy was the ray's hit either way)
 */
export function activateMobileEnemy(foe, distance, mode, player, {
  hud = null, modal = null, makeEnemiesHostile = null, playerFeet = null,
  rolls = Math.random, nothingText = () => 'You found nothing valuable.',
} = {}) {
  if (!foe || foe.dead) return false;
  const entity = foe.entity ?? null;
  if (mode !== 'steal') {
    // :814-826 - Info, Grab and Talk all pop the one line, with no
    // distance gate of any kind.
    const name = enemyDisplayName(foe.mobileType ?? entity?.mobileType ?? -1);
    if (name) hud?.(youSeeEnemyText(name));
    return true;
  }
  // :827-828 - a monster breaks out, silently, and the activation is
  // still consumed.
  if (!entity?.isClass) return true;
  // :830 - the flag wraps EVERYTHING below, the distance line included.
  if (entity.pickpocketAttempted) return true;
  if (distance > PICKPOCKET_DISTANCE) { hud?.(TOO_FAR_AWAY_TEXT); return true; }
  entity.pickpocketAttempted = true;   // :837
  const r = pickpocket(player, { target: entity, rolls, nothingText });   // :838 -> :1611
  if (r.modal) modal?.(r.message); else hud?.(r.message);
  if (!r.success) {
    // :1661-1671, in DFU's order: the IsHostile read precedes the walk.
    if (!foe.ai?.isHostile) makeEnemiesHostile?.();
    foe.ai?.makeEnemyHostileToAttacker?.(PLAYER_TARGET, playerFeet ?? null);
  }
  return true;
}

/**
 * The host-facing arm: pick, then run ActivateMobileEnemy on the hit.
 *
 * ORDERING, and why each host calls this TWICE.
 *
 * DFU fires ONE ray (PlayerActivate.cs:314) and every check in the Hit
 * Checks region reads `hit.transform` off that single RaycastHit - the
 * action door (:374), the loot container (:388), the static NPC
 * (:402), the mobile NPC (:412) and, last of the six,
 * MobileEnemyCheck (:419, :1243-1248). So ActivateMobileEnemy is
 * reached ONLY when the foe is the nearest thing the ray met: a chest,
 * a lever, a corpse or an NPC at arm's length always beats a foe
 * standing behind it, and there is no reach at which that stops being
 * true.
 *
 * The port picks each kind of target from its own pool, so there is no
 * single nearest-hit ordering to fall out of - a host must compare the
 * two picks by distance itself. That is what `deps.nearerThan` is: the
 * distance of whatever the rest of the ladder picked (Infinity when it
 * picked nothing), and the foe consumes only when it is STRICTLY
 * nearer. The AUDIT 63 first pass shipped this arm ahead of every
 * ladder with no such comparison, which let a living foe anywhere
 * inside 3.2 units eat the click on a closer door, lever, chest,
 * corpse or static NPC - the exact failure DFU's one raycast forbids.
 *
 * Each host therefore calls this twice: the NEAR call, gated on
 * `nearerThan` against the ladder's own winner, and the FAR call once
 * the ladder has found nothing at all, which is where DFU's un-gated
 * Info line (:806-826) and the pickpocket's `youAreTooFarAway`
 * (:832-836) live - both of which DFU takes out to RayDistance.
 *
 * @param deps.nearerThan  the ladder's winning hit distance; the foe
 *   is dispatched only below it. Omitted/Infinity on the FAR call.
 */
export function tryMobileEnemyActivate(eye, dir, foes, collider, reach, mode, player, deps = {}) {
  const hit = pickFoeHit(eye, dir, foes, collider, reach);
  if (!hit) return false;
  // :419 is reached only for the ray's OWN hit - a nearer activatable
  // means the enemy was never the thing the ray struck.
  if (!(hit.distance < (deps.nearerThan ?? Infinity))) return false;
  return activateMobileEnemy(hit.foe, hit.distance, mode, player, deps);
}
