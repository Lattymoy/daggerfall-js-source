// TR1 - THE TRANSPORT MODE: TransportManager.cs (MIT, Daggerfall
// Workshop) - its mode half - plus the laws that read it in
// PlayerSpeedChanger, PlayerEntity and ClimbingMotor. The port has
// carried the CART as an inventory fact since the W-slice (the wagon's
// 750kg, the dungeon-exit prompt) and the HORSE as an item nobody
// could sit on: `motor.js:"prev/target fields"` passed `riding: false` with the note
// "the transport arc pends". This is that arc's first slice - the
// MODE and everything that keys off it. The riding sprite and its
// audio (TR2) and the transport window (TR3) sit on top of this.
//
// What rides on the mode, each at its own DFU site:
//   PlayerSpeedChanger.GetBaseSpeed (:156-160) - dfRideBase is
//     walk + 225, dfCartBase is walk + 100, and the crouch arm wins
//     over both because it is tested first.
//   PlayerSpeedChanger.GetRunSpeed (:404-405) - RIDING HAS NO RUN
//     BONUS: baseRunSpeed IS baseSpeed, so the 1.35 + Running/200
//     multiplier applies to the ride speed rather than the walk one.
//   PlayerSpeedChanger.CanRunUnlessRiding (:137-140).
//   (HORSE-WALK, the port's own: horse care walks a horse - rideWalks.)
//   PlayerEntity.Update (:311) - the running skill does NOT tally
//     while mounted.
//   ClimbingMotor (:398) - no climbing from a saddle.
//   HeadBobber.GetBobbingStyle (:107) - the Horse style, which AUDIT
//     28 W10 ported and passed `riding: false` into.
//   TransportManager.HandleTransition (:196-202) - entering a BUILDING
//     or a DUNGEON dismounts you. (Exiting does not remount: DFU's
//     handler has no arm for it, so you walk out on foot.)

import { TRANSPORT_HORSE_TEMPLATE, hasCart, hasHorse } from './inventorySession.js';

/** TransportModes (:23-31). Ship is "(not a real player transport
 *  mode)" in DFU's own comment - it is the fast-travel boarding, and
 *  it is not part of TR1. */
export const TRANSPORT_MODES = Object.freeze({ Foot: 'Foot', Horse: 'Horse', Cart: 'Cart', Ship: 'Ship' });

/** PlayerSpeedChanger.cs:31-34. */
export const DF_RIDE_BASE = 375;   // dfWalkBase 150 + 225
export const DF_CART_BASE = 250;   // dfWalkBase 150 + 100

/** `horseItemIndexes` (:72), seeded with Transportation.Horse. DFU
 *  exposes AddHorseItemIndex for mods to widen it; with no mods the
 *  list is the one index, which is what hasHorse tests. */
export const HORSE_ITEM_INDEXES = Object.freeze([TRANSPORT_HORSE_TEMPLATE]);

/** HasHorse (:99-106) and HasCart (:89-93) are questions
 *  inventorySession has answered since PX21a and the W-slice, and its
 *  own note says "one home for both". Re-exported, not restated -
 *  AUDIT 24's one-home ratchet caught the copy this slice first made.
 *  DFU's HasHorse walks `horseItemIndexes`; with no mod calling
 *  AddHorseItemIndex that list IS the single template below, so the
 *  two are the same test. */
export { hasCart, hasHorse };

/** IsOnFoot (:55-58). */
export const isOnFoot = (mode) => mode === TRANSPORT_MODES.Foot;
export const isRiding = (mode) => mode === TRANSPORT_MODES.Horse || mode === TRANSPORT_MODES.Cart;

/**
 * ToggleMount (:113-127), verbatim: mounted dismounts; on foot the
 * HORSE is preferred and the cart is the fallback, so a player who
 * owns both always mounts the horse.
 * @returns {string} the new mode
 */
export function toggleMount(mode, items = []) {
  if (isRiding(mode)) return TRANSPORT_MODES.Foot;
  if (hasHorse(items)) return TRANSPORT_MODES.Horse;
  if (hasCart(items)) return TRANSPORT_MODES.Cart;
  return mode;   // nothing to mount: the mode is unchanged (no else arm)
}

/** GetBaseSpeed's riding arm (:156-160) in classic units, for the
 *  motor's own base-speed law to add. Crouching is tested FIRST in
 *  DFU, so a crouch on a horse takes the crouch base - which cannot
 *  happen, because PlayerHeightChanger refuses to crouch while
 *  riding, but the ORDER is the law and the port keeps it. */
export const rideBaseFor = (mode) => (mode === TRANSPORT_MODES.Cart ? DF_CART_BASE : DF_RIDE_BASE);

/** CanRunUnlessRiding (:137-140). */
// RR2: `GameManager.Instance.SpeedChanger.CanRun = CanRunUnlessRidingCart`
// (EnhancedRiding.cs:69) - a mod's delegate over PlayerSpeedChanger.CanRun;
// DFU's own is CanRunUnlessRiding. Answers a boolean, or null for DFU's.
let _canRun = null;
export function setCanRunOverride(fn) { _canRun = typeof fn === 'function' ? fn : null; }
// STEED1 (bible/06-Systems/Horse-Care.md): HORSE CARE'S WORD ON A GALLOP, after the mod's - `(mode, modsWord)` answers a
// boolean, or null for no word (horse care off, or not a horse). A winded or starving horse will not gallop whatever the
// mod allows; with no mod ruling, horse care lets a horse gallop on its breath. One a host (systems/upkeep/upkeepRuntime.js).
let _gallop = null;
export function setGallopGate(fn) { _gallop = typeof fn === 'function' ? fn : null; }
export const canRunUnlessRiding = (mode) => {
  const mods = _canRun?.(mode) ?? null;
  return _gallop?.(mode, mods) ?? mods ?? !isRiding(mode);
};
// HORSE-WALK (2026-10-12, the owner: "when youre riding a horse, it walks by default and to gallop you must shift to
// sprint, just like when you are walking as a character" - bible/06-Systems/Horse-Care.md, THE WALK): HORSE CARE'S WORD
// ON THE RIDE'S PACE - `(mode)` answers true where the ride WALKS: GetBaseSpeed's riding arm on DFU's own walk base
// (the motor's DF_WALK_BASE, undragged as every ride arm is), the run the gallop the gate above lets it. Anything but
// true keeps DFU's ride base. Only where horse care rules the gallop - off it a horse is DFU's (one pace, no run in the
// saddle, the mod's gallop where it rules), and a walk with no gallop to shift into would hold a rider to it. One a
// host (systems/upkeep/upkeepRuntime.js). HORSE-TIERS (2026-10-15): `(mode, runAsked)` - whether the rider asks the gallop (Run
// held or latched) rides with the question, because a tier that never puts a horse below DFU's (Boons) rides a gallop
// asked and refused at DFU's own pace, where Hard holds it to the walk (upkeepRuntime.js rideWalks).
let _walk = null;
export function setRideWalk(fn) { _walk = typeof fn === 'function' ? fn : null; }
export const rideWalks = (mode, runAsked = false) => isRiding(mode) && _walk?.(mode, !!runAsked) === true;

/** HandleTransition (:196-202): a building or dungeon interior puts
 *  you back on foot. Anything else leaves the mode alone. */
export const dismountOnTransition = (mode, transition) =>
  (transition === 'ToBuildingInterior' || transition === 'ToDungeonInterior' ? TRANSPORT_MODES.Foot : mode);
