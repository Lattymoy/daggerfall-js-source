// AUDIT 63 F13 - EntityEffectBroker.SyntheticTimeIncrease
// (MagicAndEffects/EntityEffectBroker.cs:81), the one piece of broker
// state that is NOT the magic-round marker.
//
// WHAT IT IS. Three places in DFU move the clock by hours or days and
// then tell the broker that those minutes were SYNTHESISED rather than
// lived: DaggerfallCourtWindow_OnEndPrisonTime (:841-842),
// DaggerfallTravelPopUp_OnPostFastTravel (:846-847) and
// VampirismInfection's fortnight (VampirismInfection.cs:161-162). The
// broker still runs the whole capped catch-up over those minutes -
// spells still expire, diseases still advance - but THREE enchantment
// arms read the flag and sit the window out:
//
//   ItemDeteriorates.cs:76-80   `... || SyntheticTimeIncrease) return;`
//   HealthLeech.cs:101-105      the identical three-way guard
//   CastWhenHeld.cs:131-136     ApplyDurabilityLoss wraps its WHOLE body
//
// Without them a three-day journey is 2880 rounds, i.e. 720 hits at one
// per four rounds: an equipped ItemDeteriorates or Cast-When-Held item
// loses 720 condition and is destroyed, and an "unless used weekly"
// HealthLeech item deals 720 damage. Nothing else is gated - RegensHealth,
// UserTakesDamage, the reputation arms and RepairsObjects all run.
//
// WHY IT IS ITS OWN LEAF. The flag's natural home is worldTick.js, which
// is this port's broker - but worldTick imports the enchantment pump
// (worldTick.js:67) and enchantments.js is deliberately kept off that
// cycle (see its own note at :51). A leaf with no imports lets the pump
// read the flag and the broker own its lifecycle without closing it.
//
// THE LIFECYCLE. DFU lowers the flag at the TAIL of the broker Update
// that ran the window, OUTSIDE the `if (catchupRounds > 0)` block
// (:244-248) - so exactly one Update is shielded, however many or few
// rounds it claimed. The port's Update is split in two: worldTick claims
// the window and runs the PLAYER, then the host fans the same window out
// to its foe pools (shared.js's ticker subscribers, dungeonContext's own
// loops), and ItemDeteriorates/HealthLeech are not player-gated. Lowering
// at the tail of the player's half would leave every foe in the window
// unshielded, and asking each of the four hosts to lower it after its
// fan-out is a law a host can forget - and a forgotten lower is a
// PERMANENT shield, a worse failure than the bug. So the lowering is
// deferred by one claim instead: `claimSyntheticTimeIncrease` retires a
// flag an earlier window already took and then takes it for this one.
// Same window shielded, same single window, and no host can drop it.

/** EntityEffectBroker.SyntheticTimeIncrease (:81). */
let _synthetic = false;
/** True once a claimed magic-round window has taken the standing flag -
 *  the DFU tail-lower (:248), owed at the next claim. */
let _claimed = false;

/**
 * Raise (or clear) the flag - `SyntheticTimeIncrease = true` at
 * EntityEffectBroker.cs:842/:847 and VampirismInfection.cs:162.
 * A raise always re-arms: a second jump before the first was claimed
 * shields the window that finally runs, as DFU's plain field does.
 */
export function setSyntheticTimeIncrease(v = true) {
  _synthetic = !!v;
  _claimed = false;
  return _synthetic;
}

/** The flag as the three enchantment arms read it. */
export const syntheticTimeIncrease = () => _synthetic;

/**
 * The broker Update's own read, called once per claimed magic-round
 * window (EntityEffectBroker.cs:244-248 - the raise of
 * OnEndSyntheticTimeIncrease and the lowering, both outside the
 * catchup-rounds test). Retires the flag a PREVIOUS window claimed,
 * then claims it for this one.
 *
 * @returns {boolean} whether this window is synthetic
 */
export function claimSyntheticTimeIncrease() {
  if (_claimed) { _synthetic = false; _claimed = false; }
  if (_synthetic) _claimed = true;
  return _synthetic;
}

/** A load starts a fresh broker - nothing in DFU serialises the flag. */
export function resetSyntheticTimeIncrease() {
  _synthetic = false;
  _claimed = false;
}
