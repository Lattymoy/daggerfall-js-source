// SPELL-HAND (2026-10-23; bible/05-Combat/Two-Hands.md "The spell hand"): THE MORROWIND ARM'S SPELL HAND - a spell in
// the free hand beside the weapon, on the skeleton. The law and the classic lane: combat/twoHands/spellHand.js. Wired by
// combat/fpArm.js (HOST-SPLIT: the arm wires it and grows only by the wiring).
//
// Morrowind has no such stance: a readied spell is the Spell stance, both arms raised in its idle and the weapon out of
// the hand (OpenMW's animateWeapon - the Spell weapon type), and a cast plays the spellcast group on the whole body. The
// spell hand keeps both and lends one arm to the other:
//   - READIED: the arm stays in the WEAPON's stance - its idle, its blows, its draw and sheathe - and only the LEFT arm
//     takes the Spell stance's idle ("idlespell"), its own left arm copied as it stands on its own loop;
//   - CASTING: the cast plays the spellcast group on the whole body as it always did ("<type> start" to "<type> stop",
//     the spell leaving on "<type> release" - MW-CAST1, untouched), and the RIGHT arm takes the weapon stance's idle
//     (the stance's "idle1h", "idle1s", ...), its own right arm copied - the weapon in the hand that holds it.
// The Morrowind arm always draws its weapon in the right hand (MW-HAND: the hand in use follows the weapons), so the spell
// hand there is always the left arm. Each arm is set through the second hand's own door (mirrorRig.js `limbs`: an arm
// read from another clip, hung from this frame's body) and carried between compositions as every change is (POSE.LIMB_TAU
// - no pop).

/** The stance whose idle the spell hand's arm is posed from - the Spell stance's own group base (fpArm.js FP_IDLE_BASE). */
export const SPELL_HAND_ARM = Object.freeze({ spell: 'L', weapon: 'R' });

/**
 * A GROUP'S CLIP HELD ON ITS OWN CLOCK, per rig - the idle an arm is posed from while the body plays something else.
 * `pick(r, group)` is the arm's own source pick (pickAnimSource over r.sources, looping); `step(state, keys, dt)` its clip
 * stepper (advanceClip). `clip(r, group, dt)` answers the mirror's limb clip - `{ tracks, sampleTrack, time }` - advanced
 * by `dt` on its loop, or null where the rig's sources carry no such group. A rig is remembered weakly (a rebuilt rig is
 * new), and each group starts from its own first frame.
 */
export function createHeldClips({ pick, step, sampleTrack }) {
  const memo = new WeakMap();
  return {
    clip(r, group, dt = 0) {
      if (!r || !r.sources || !group) return null;
      let m = memo.get(r);
      if (!m) { m = new Map(); memo.set(r, m); }
      if (!m.has(group)) m.set(group, pick(r, group));
      const p = m.get(group);
      if (!p) return null;
      if (dt > 0) step(p.state, p.source.keys, dt);
      return { tracks: p.source.trackMap, sampleTrack, time: p.state.time };
    },
  };
}

/**
 * THE SPELL HAND'S COMPOSITION - the mirror request's arm (`limbs`) and its carry key, or null for none:
 *   casting    - the cast's hands play (the arm's Casting section): the right arm the weapon's idle (`weaponIdle`);
 *   ready      - a spell readied in the free hand: the left arm the Spell stance's idle (`spellIdle`);
 * each a limb clip from createHeldClips (null where the rig carries no such group: nothing composed, the clip stands).
 * @param {{ casting?: boolean, ready?: boolean, weaponIdle?: object | null, spellIdle?: object | null }} s
 */
export function spellHandLimbs({ casting = false, ready = false, weaponIdle = null, spellIdle = null } = {}) {
  if (casting) return weaponIdle ? { limbs: { [SPELL_HAND_ARM.weapon]: { clip: weaponIdle, side: SPELL_HAND_ARM.weapon, mirror: false } }, key: 'spellhand:cast' } : null;
  if (ready) return spellIdle ? { limbs: { [SPELL_HAND_ARM.spell]: { clip: spellIdle, side: SPELL_HAND_ARM.spell, mirror: false } }, key: 'spellhand:ready' } : null;
  return null;
}

/**
 * AUDIT SPELL-HAND L3-11 (HOST-SPLIT): THE STANCE A SPELL IN THE FREE HAND KEEPS - what the arm does as the rig says a
 * spell is readied there (fpArm.js readySpell's spell-hand door): 'wait' under an equip or an unequip (its keys are its
 * group's - a stance flipped mid-section never crosses "unequip detach", AUDIT SPELL-HAND L3-3; OpenMW waits the same),
 * 'afterCast' while a cast plays (it finishes; the stance lets go at its end, MW-CAST1), 'drop' where a Spell stance stands
 * (a cast latched it - AUDIT 36 F2 - or the hands held it sheathed): the weapon's stance comes back; else 'keep'.
 * @param {{ upper: number, spellReady: boolean }} s
 * @param {{ Equipping: number, Unequipping: number, Casting: number }} U the arm's UPPER_BODY
 * @returns {'wait' | 'afterCast' | 'drop' | 'keep'}
 */
export function spellHandStanceStep({ upper, spellReady }, U) {
  if (upper === U.Equipping || upper === U.Unequipping) return 'wait';
  if (upper === U.Casting) return 'afterCast';
  return spellReady ? 'drop' : 'keep';
}

/**
 * AUDIT SPELL-HAND L3-3: A WEAPON DRAWN WITH THE SPELL KEPT comes up in its own stance - the two-handed Spell stance the
 * sheathed hands held is let go before the draw composes its group (never the spellcast group's own equip played for the
 * blade). True when the draw takes the spell into the free hand: the spell hand is up and a Spell stance stands, no cast in
 * flight.
 */
export const drawsIntoSpellHand = ({ spellHand = false, spellReady = false, casting = false } = {}) => !!spellHand && !!spellReady && !casting;
