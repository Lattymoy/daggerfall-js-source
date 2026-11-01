# Two Hands

Both hands in first person: bare fists both up and throwing blows, two one-handed weapons wielded at once, a blade
beside a Pistolet, a readied spell in the free hand beside a one-handed weapon, and hands that pump when running. It
works on the classic sprites and on the Morrowind arms. The player meets it by equipping two weapons, none, or a
weapon and a spell.

## How it works

- **The law** (`src/combat/twoHands/handsLaw.js`, pure). `handsModeOf` gives the mode (`HANDS_MODE`): `fists` (both
  hand slots empty), `dual` (two one-handed weapons of `DUAL_TYPES`, two Pistolets `DUAL_GUN_TYPES`, or one of each),
  `single` (everything else: a shield, a two-hander, a bow, a staff, the Thunderlock, the beast's claws, one weapon, or
  a light carried in a hand that a lane draws there).
- **Which hand strikes** (`strikeHandOf`). The lead hand opens; a strike begun within `FLURRY_WINDOW` (0.75 s) of the
  last one ending is the other hand's. The lead is DFU's used hand. With both hands up, **H** picks the lead, ends the
  exchange and bills no hand switch.
- **The mirror.** A left hand is a right hand mirrored (`mirrorStrike`, `mirrorRect`, `handOnLeft`). Daggerfall's
  bare-hand art paints both arms by direction (`MELEE_PAINTED_ARM`), so a hand's picture is chosen
  (`strikePicture`): the arm on screen is always the hand throwing the blow.
- **The balance** (`DUAL`). The lead's blow is DFU's exactly; the fists keep DFU's numbers. A flurry blow starts one
  frame into its swing (`FLURRY_FROM_FRAME`). The off hand lands 0.8 of the rolled damage (`OFF_DAMAGE`, at least 1),
  takes -5 to hit at Agility 50 eased by Agility within [-10, 0] (`offHandToHit`), and feels its weapon 1.5 times
  heavier (`OFF_WEIGHT`), paid as whole ticks held after its blows (`offHandHold`). Its blow counts as 0.8 of a blow
  for Strikes enchantments, per-blow powers and skill training (`OFF_HAND_BLOW`). The share is laid inside the damage
  formula (`blowShare` in `calculateAttackDamage`), so HUD, listeners and wear agree; duels and every PvP lane carry
  the same terms (`resolveDuelStrike`).
- **The sprite lane** (`createTwoHands`, `src/combat/twoHands/twoHands.js`), wired only by the weapon rig
  (`src/combat/weapon/weaponRig.js`): one DFU swing machine, each hand a view of it, each drawn by DFU's placement or
  its own Weapon Widget clone. Bob mirrors outward; inertia lags both hands as one body; the clones share one clock.
  The guard keeps the resting hand up while the other strikes. Running, empty hands pump in step.
- **The Morrowind lane** (`src/combat/twoHands/mirrorRig.js`, `src/combat/fpArm.js`). Morrowind has one weapon hand, so
  the left arm is the right arm in the mirror: each bone's counterpart is found by name, mirrored about the skeleton's
  own middle, moving from its own rest.
- **A blade and a gun** (`gunHandOf`, `mixedStrike`, `src/combat/twoHands/mixedArm.js`): the hands take turns on two
  machines; the gun reloads one-handed and a pull falls to the blade while it reloads.
- **The spell hand** (`spellHandOf`, `src/combat/twoHands/spellHand.js`, `spellHandArm.js`). A one-handed weapon in
  the fighting hand and nothing in the other: a readied spell goes in the free hand and the weapon stays up. The
  swing button is the weapon's; the spell leaves on its own press (`CAST_PRESS`). Otherwise it is DFU's two-handed
  cast.
- **Peers** see both hands: the look carries the pair and the lead, and each strike plays with the hand that made it.

## Rules

- Mac's ask: mirrored fists that both attack, running hands, true dual wielding with both weapons seen and animated,
  balanced to not be overpowered, the Morrowind arm with its own animations, no band-aids.
- Two weapons are tempo, not twice the damage: a matched light pair lands about 9% more a second than one of its
  weapons, a heavy pair less, at every frame rate, for more fatigue and no shield. A pair is as good as its weaker
  hand.
- Frame-rate independent: every dual term is paid in whole ticks, never a factor on a tick's time.
- No Features switch: fists, running hands, pairs and the spell hand stay on, even under All off (the owner).
- A technique is always the lead hand's.
- A blade and a Pistolet are a pair; a spell beside a one-handed weapon takes one hand (the owner: make the best
  decisions).

## Daggerfall Unity

DFU fights with one hand (`WeaponManager.usingRightHand`, `ToggleHand` on H), draws one sprite (`FPSWeapon`), draws no
running hands, and never shows a weapon with a readied spell (`FPSSpellCasting`). Departures: both hands in use and H
picking the lead; a second sprite mirrored by the painted-arm rule; the flurry frame and the off hand's held ticks;
the off hand's share inside `CalculateAttackDamage`; running hands; a blade and gun pair; the spell hand; H works
beside a readied spell (DFU's `Update` returns before `ToggleHand` then).

## Code and tests

- `src/combat/twoHands/handsLaw.js` - modes, strike hand, mirror, balance, guard, run
- `src/combat/twoHands/twoHands.js`, `mirrorRig.js`, `mixedArm.js`, `spellHand.js`, `spellHandArm.js` - the lanes
- `src/combat/playerWeapon.js` - the striking hand's weapon, `offStrike`
- `test/combat/twohands.test.js`, `twohands_mw.test.js` - the law, the sprite lane, the Morrowind lane
- `test/combat/mixedpair.test.js`, `spellhand.test.js`, `spellhand_mw.test.js`, `a12_lefthand.test.js` - mixed pairs,
  the spell hand, the left hand

## Open

- On the Eye of the Beholder sprite body, third person shows one weapon and DFU's readied-spell stance.
- A sheathed off weapon is hidden, not hung on the body.
- Werecreature claws stay single.
- The suite holds no ARENA2: the sprite lane is pinned on a synthetic CIF, the Morrowind lane on the retail biped and a
  fixture arm.
