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
// too), and the second call unconditional. AUDIT NAV2 F54: that call's
// PLAYER ARM is the ally revert (resetAllyTeamOnPlayerAttack, the half
// the port keeps off the motor), so it runs here too - see the tail.
// And a shipmate is no mark at all (combat/friendlyFire.js).
//
// The flag is per-foe and is NOT serialized: EnemyEntity
// .PickpocketByPlayerAttempted (EnemyEntity.cs) is read and written by
// PlayerActivate alone and appears in no save record, so it lives on
// the live foe entity and dies with the pool, as DFU's does.

import { PICKPOCKET_DISTANCE, TREASURE_ACTIVATION_DISTANCE, tooFarAwayText, pickFoeHit, DOOR_ACTIVATION_DISTANCE } from './activate.js';   // AUDIT WK-P6: a companion's pack is storage, at storage's reach
import { setMidScreenText } from '../ui/midScreenText.js';   // AUDIT 64 F34: :834 is the HUD's centred label, not the popup queue
import { PLAYER_TARGET, resetAllyTeamOnPlayerAttack } from '../characters/enemyTargets.js';   // AUDIT NAV2 F54: MakeEnemyHostileToAttacker's entity-side half
import { enemyDisplayName } from '../characters/enemyBasics.js';
import { properName } from '../systems/champions.js';   // AUDIT WB12d (D2): a foe with a name of its own
import { pickpocket } from '../systems/talk.js';
import { localizedText, getLocalizedEnemyName } from '../systems/textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language; L10N3e: and the enemy's name
import { sparedByPlayer } from '../combat/friendlyFire.js';   // AUDIT NAV2 F54: the player's own hands - and a town's defenders - are no mark

/** Internal_Strings.csv:23-24 - `youSeeAn,You see an %s.` and
 *  `youSeeA,You see a %s.`, picked by the vowel test at :817 over the
 *  FIRST letter of the localized enemy name. */
export const YOU_SEE_A_TEXT = 'You see a %s.';
/** AUDIT WB12d (D2): a foe with a name of its own, seen by it (no article). */
export const YOU_SEE_PROPER_TEXT = 'You see %s.';
export const YOU_SEE_AN_TEXT = 'You see an %s.';
export function youSeeEnemyText(name) {
  const n = name ?? '';
  const vowel = 'aeiouAEIOU'.includes(n[0] ?? '');
  return (vowel ? localizedText('youSeeAn', YOU_SEE_AN_TEXT) : localizedText('youSeeA', YOU_SEE_A_TEXT)).replaceAll('%s', n);
}

/**
 * ActivateMobileEnemy for one clicked foe.
 *
 * @param foe        the live pool record ({ ai, entity, mobileType, dead })
 * @param distance   the hit distance the pick handed back
 * @param mode       the interaction mode ('info'|'grab'|'talk'|'steal')
 * @param player     the player entity
 * @param deps.hud            PopupMessage sink (the info line, the pickpocket result)
 * @param deps.midScreen      SetMidScreenText sink (the too-far refusal alone)
 * @param deps.modal          MessageBox sink (both Pickpocket successes)
 * @param deps.makeEnemiesHostile  the host's GameManager.MakeEnemiesHostile
 *   over its full live foe union
 * @param deps.playerFeet     where the attack came from, for the seed
 * @param deps.rolls          Dice100 / Random.Range
 * @param deps.nothingText    GetRandomText(8999)
 * @param deps.openCompanion  COMPANION-KIT: a companion of MINE (crewAshore.js - `companion`, a shipmate, never another
 *   player's `peer:` one) activated in any mode but Steal opens his pack (the host's window); none, DFU's line as ever
 * @returns true when the activation was CONSUMED (DFU's `break` out of
 *   ActivateMobileEnemy - the enemy was the ray's hit either way)
 */
export function activateMobileEnemy(foe, distance, mode, player, {
  hud = null, modal = null, makeEnemiesHostile = null, playerFeet = null,
  rolls = Math.random, nothingText = () => 'You found nothing valuable.',
  // AUDIT 64 F34: the ONE line in this member that is
  // SetMidScreenText (PlayerActivate.cs:834) rather than
  // PopupMessage/MessageBox - the refusal, not the pickpocket result
  // (:838 -> :1611). It is a second sink so re-pointing `hud` cannot
  // drag the result onto the label with it; the default is the same
  // static funnel DaggerfallUI.cs:783-789 gives every caller.
  midScreen = setMidScreenText,
  openCompanion = null,
  openFate = null,   // REVENANT-FATE: (foe) => the yielded revenant's choice (the host's loot-menu door)
} = {}) {
  if (!foe || foe.dead) return false;
  // REVENANT-FATE (2026-10-02, Mac: "Players should have the option to kill or spare"; "the choice popup should reuse
  // the loot menu"): a beaten revenant on its knees is reached as a body is - at the treasure's reach, the HUD's one
  // refusal past it - and opens its fate's window; a peer's (a puppet's) is its owner's choice
  if (foe.yielded && !foe.puppet && openFate) {
    if (!(distance <= TREASURE_ACTIVATION_DISTANCE)) { midScreen?.(tooFarAwayText()); return true; }   // the treasure's reach, as his pack's (WK-P6)
    openFate(foe);
    return true;
  }
  const entity = foe.entity ?? null;
  // COMPANION-KIT (2026-10-01, Mac: companions "act as storage"): my companion activated opens his pack - Steal from him
  // is the shipmate's silent break below
  if (mode !== 'steal' && openCompanion && foe.companion != null && foe.shipmate === true && !String(foe.companion).startsWith('peer:')) {
    // AUDIT WK-P6: HIS PACK IS STORAGE, AND STORAGE IS REACHED. This arm runs at the ray's reach (RAY_DISTANCE, 76.8 -
    // MC-2's one call in every host), and his pack opened from across a square; a chest, a pile, a boat's box and a cart
    // open at TreasureActivationDistance and refuse past it with the HUD's one refusal (ActivateLootContainer :868-873)
    if (distance > TREASURE_ACTIVATION_DISTANCE) { midScreen?.(tooFarAwayText()); return true; }
    if (openCompanion(foe)) return true;
  }
  if (mode !== 'steal') {
    // :814-826 - Info, Grab and Talk all pop the one line, with no
    // distance gate of any kind. L10N3e: the name is GetLocalizedEnemyName's
    // (PlayerActivate.cs:811) - a translation's enemyNames row by the
    // MobileTypes id, the port's own name where it has none - so the
    // vowel test reads the first letter of the name the player sees.
    const own = properName(entity);   // AUDIT WB12d (D2): a foe with a name of its own is seen by it - "You see the Summoner."
    const mobileType = foe.mobileType ?? entity?.mobileType ?? -1;
    const name = own ?? enemyDisplayName(mobileType);
    if (name) hud?.(own ? YOU_SEE_PROPER_TEXT.replace('%s', own.replace(/^The /, 'the ')) : youSeeEnemyText(getLocalizedEnemyName(mobileType, name)));
    return true;
  }
  // :827-828 - a monster breaks out, silently, and the activation is
  // still consumed.
  if (!entity?.isClass) return true;
  // AUDIT NAV2 F54: A SHIPMATE IS NO MARK - the player's own hand on a
  // deck breaks out as the monster above does: consumed, silent at any
  // range, nothing rolled, no attempt spent. A failed lift turned him on
  // the player (the tail below) while every door of the player's harm
  // still passed him by - he was a shipmate yet (isShipmate's law). And
  // so a town's defender (DISC19): whoever the player's harm passes by
  // (sparedByPlayer) is no mark, or the lift turns him on an untouchable.
  if (sparedByPlayer(foe)) return true;
  // :830 - the flag wraps EVERYTHING below, the distance line included.
  if (entity.pickpocketAttempted) return true;
  if (distance > PICKPOCKET_DISTANCE) { midScreen?.(tooFarAwayText()); return true; }   // :834 - the mid-screen refusal
  entity.pickpocketAttempted = true;   // :837
  const r = pickpocket(player, { target: entity, rolls, nothingText });   // :838 -> :1611
  if (r.modal) modal?.(r.message); else hud?.(r.message);
  if (!r.success) {
    // :1661-1671, in DFU's order: the IsHostile read precedes the walk.
    if (!foe.ai?.isHostile) makeEnemiesHostile?.();
    foe.ai?.makeEnemyHostileToAttacker?.(PLAYER_TARGET, playerFeet ?? null);
    // AUDIT NAV2 F54: ...and the rest of that call. The port splits
    // MakeEnemyHostileToAttacker in two - the motor's target bookkeeping
    // above, and its PLAYER arm's ally revert on the entity (the motor
    // owns no entity: enemyMotor.js, enemyTargets.js) - and every other
    // caller runs both (each pool's handleAttackFromPlayer). This arm ran
    // the motor's half alone, so an ally who caught the player's hand
    // turned on him still PlayerAlly. The header once called the revert
    // the damage path's own: that path reaches it only THROUGH this call.
    if (foe.ai) resetAllyTeamOnPlayerAttack(foe.ai, foe.entity, foe.mobileType);
  }
  return true;
}

/**
 * The host-facing arm: pick, then run ActivateMobileEnemy on the hit.
 *
 * ORDERING, and why each host calls this ONCE.
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
 * AUDIT 65 MC-2: each host therefore calls this ONCE, at the RAY's
 * reach and gated on `nearerThan`. The AUDIT 63 pass called it twice -
 * a NEAR call at DefaultActivationDistance gated on the ladder's
 * winner, then a FAR call at the foot of the ladder for DFU's un-gated
 * Info line (:806-826) and the pickpocket's `youAreTooFarAway`
 * (:832-836), which DFU takes out to RayDistance. That second call ran
 * with `nearerThan` Infinity, so past 3.2 the comparison the paragraph
 * above states simply stopped applying and a foe twenty units off ate
 * the click DFU gives a door at five. One call at RayDistance is both
 * halves: the Info line and the refusal reach as far as the ray does,
 * and the distance comparison never lapses.
 *
 * @param deps.nearerThan  the ladder's winning hit distance; the foe
 *   is dispatched only below it. Infinity when the ladder picked
 *   nothing at all.
 * @param deps.doorBehind  TACT3d: the distance of the door (or other
 *   activatable) the ladder would open behind the foe, Infinity for
 *   none - see `yieldsToDoor`.
 */
export function tryMobileEnemyActivate(eye, dir, foes, collider, reach, mode, player, deps = {}) {
  const hit = pickFoeHit(eye, dir, foes, collider, reach);
  if (!hit) return false;
  // :419 is reached only for the ray's OWN hit - a nearer activatable
  // means the enemy was never the thing the ray struck.
  if (!(hit.distance < (deps.nearerThan ?? Infinity))) return false;
  if (yieldsToDoor(hit.foe, deps.doorBehind, mode)) return false;   // TACT3d: the door behind takes the click
  return activateMobileEnemy(hit.foe, hit.distance, mode, player, deps);
}

/**
 * TACT3d (Mac, 2026-10-02: "Players can grief others with guards by
 * bringing them into interiors and blocking doorways" - fixed in every
 * version, always on). A foe that is NOT hostile to the player - a
 * watchman at peace, a companion, a quest's waiting NPC - standing
 * between the crosshair and a door within the door's own reach no
 * longer eats the click: the door opens. A hostile foe still takes it
 * (DFU's one ray), and with no door in reach behind, nothing changes.
 */
export function yieldsToDoor(foe, doorBehind, mode = null) {
  if (!foe || foe.companion != null || mode === 'steal') return false;   // AUDIT TACT C5: my companion's pack, a pickpocket - asked of HIM
  return !hostileToMe(foe) && Number.isFinite(doorBehind) && doorBehind <= DOOR_ACTIVATION_DISTANCE;
}

/**
 * AUDIT TACT C1: HOSTILE TO ME, not hostile at all. Another player's watch, streamed to me as puppets, is minted
 * `isHostile` (this pool never pacifies a puppet) - so the door passed none of them, and a griefer's guards held every
 * other player's door shut. A puppet is hostile to me only when it is on ME (`_pupMine`); my own foe by its own flag.
 */
export function hostileToMe(foe) {
  if (!foe) return false;
  if (foe.puppet) return !!foe._pupMine;
  return !!foe.ai?.isHostile;
}
