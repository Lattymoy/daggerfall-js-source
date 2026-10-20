# Two Hands - both fists, a pair of weapons, the running hands (TWO-HANDS, 2026-10-16)

Mac: *"Duel wielding and bare hand improvements.
1. When bare handed, the fist should be mirrored on the other side of the screen (like 2 hands). Attacking should
utilize both hands in a detailed way
2. When bare handed, or with nothing equipped, sprinting should show the hands in a running motion.
3. Weapons should now be able to be duel wielded instead of using a hand swap. With 2 weapons equipped, both weapons can
be seen and animated in view.
4. With duel wielding, we need to balance this to not be overpowered and make sense.
We need to tackle this and be as detailed as possible, use the climbing hands/animations as reference and do not band
aid fix anything."* - then: *"the morrowind model should have its own set of animations also following this, only
tackle this slice after completing the 2d work. Take your time and put this all within one PR"*.

The port's own (SCOPE1, `01-Overview/Port-Doctrine.md`): DFU has none of it, and this page names every place it
departs from DFU's one hand. The ledger row is Port-Ledger A (TWO-HANDS).

## What DFU does - the reference

- **One hand fights.** `WeaponManager` holds `usingRightHand`; ToggleHand (WeaponManager.cs:702-729, the H key) flips
  it, refuses while a shield is in the left hand, and says "Using weapon in right/left hand." UpdateHands caches the
  two hand items and ApplyWeapon puts the used hand's weapon on the one `FPSWeapon`.
- **One sprite.** `FPSWeapon` draws one picture; FlipHorizontal (FPSWeapon.cs:378) mirrors three of its states for a
  left-handed player, reading the source rect right to left (FPSWeapon.cs:381-390).
- **No running hands.** An empty hand is the bare-hand sprite while the weapon is drawn, nothing while it is sheathed;
  the run moves the camera (HeadBobber, its timer walked by PlayerFootsteps.WalkStepInterval) and nothing in the hands.
- **One clock and one formula.** FormulaHelper.GetMeleeWeaponAnimTime times a swing (the port's SWING-LAW,
  `characters/weaponStates.js`), CalculateSwingModifiers gives a StrikeDown -10 to hit, CalculateAttackDamage rolls the
  blow off the used hand's weapon and skill, and CalculateHandToHandAttackDamage reads the skill, never a hand.

## The law - `src/combat/twoHands/handsLaw.js` (pure, @ts-check)

One law, read by both lanes and by the swing: which way the hands are held, which hand strikes, the mirror, the
balance, the guard and the run. It reads no setting, no clock and no equip table; the callers hand it each hand's item
described (`playerWeapon.js` `handDesc`: the item, its WeaponTypes, its ItemHands, a shield).

**The modes** (`HANDS_MODE`):

| Mode | When | Drawn |
|---|---|---|
| `fists` | both hand slots empty | both fists up |
| `dual` | two one-handed melee weapons (`DUAL_TYPES`: blades, daggers, maces, flails, hammers, axes, plain and magic - one-handed by ItemHands) | both weapons up |
| `single` | everything else - a shield (a fist and a shield is DFU's), a two-hander, a bow, a staff, a gun, the beast's claws, one weapon and an empty hand, **a light carried in a hand** | DFU's one used hand |

The light: a lit torch or lantern held (not hung at the waist, HT-WAIST) takes the left hand where a lane paints it there -
Handheld Torches' sprite on the classic lane, the Morrowind arm's torch on its Shield Bone (a torch alone: the arm holds no
lantern) - so it is one fist beside the light, DFU's and the mod's (`leftBusy`, set by `weaponRig.js` `syncWorn` before
ApplyWeapon). A light NO lane draws in a hand (Handheld Torches off on the classic lane) holds no hand: both fists stand
(AUDIT, lanes 1/2/4). The mod stows a light when no hand is free, so a pair seldom meets one - except under its
RelaxedLanterns (with LanternsAtWaist off, both non-default), where a lit lantern stays in the hand and the pair is one
hand until it is put out.

**Which hand strikes** (`strikeHandOf`): the LEAD hand opens an exchange; a strike begun within `FLURRY_WINDOW` (0.75 s)
of the last one ending is the OTHER hand's - a flurry; past it the hands have settled and the lead opens again. The
window is nearly twice SWING_FRAME_MAX (0.4 s), so a slow fighter's held button still alternates. In `single` the hand
is always the lead. The lead is DFU's `usingRightHand`.

**H with both hands up** picks the lead and says so - "Leading with the right hand." / "Leading with the left hand."
(`combat.leadRightHand` / `combat.leadLeftHand`, the port's own lines, in every locale) - and ENDS the exchange in
progress: the next blow opens a new one with the new lead (AUDIT: left running, a blow after H was the old exchange's
quick answer thrown by the new lead with none of the off hand's costs - x1.2 damage for a key press between swings).
Nothing changes hands, so BowLeftHandWithSwitching bills nothing. One hand in use keeps DFU's two lines and DFU's bill.
Under the Morrowind arm H moved only between two held weapons (MW-HAND); it now moves between the fists too. The
Fighting tutorial says so ("H swaps hands, or picks the lead when both hands fight" - AUDIT 2,
L4: the first cut's "Two weapons or two fists both fight; H picks the lead" dropped what H does with one weapon).

**The mirror**: a left hand is a right hand in the glass - CLIMB-HANDS' rule (`combat/climbHands.js`: Mac's painting a
left hand, mirrored for the right). `mirrorStrike` keeps a strike's way across the screen (the left hand's sweep to the
right is the right hand's sweep to the left, mirrored); `mirrorRect` mirrors a screen rect about the middle;
`handOnLeft`: a left-handed player's picture is mirrored whole - the right hand on the left.

### The painted arm

Probed with Daggerfall's own `WEAPON10.CIF` (DFU's freeware DaggerfallGameFiles, `tools/fetch-data.sh`): **the bare
hand's art paints BOTH arms.** Its idle (record 0) and its StrikeDownLeft, StrikeRight and StrikeDownRight records are
the right arm (the light glove, the grey sleeve); its StrikeDown, StrikeLeft and StrikeUp records are the LEFT arm (the
dark glove, the brown sleeve with the stitched cuff) - classic Daggerfall threw its hand-to-hand with both fists, by
direction. WeaponBasics carries nothing of it (every melee strike aligns Center); it is a fact of the shipped frames,
`MELEE_PAINTED_ARM` (by record). Every weapon file paints the right arm alone.

So a hand's picture is CHOSEN, never assumed (`strikePicture`), and the arm on the screen is always the hand that throws
the blow, on its own side:

1. the state's own record as painted, when it paints this hand's side - DFU's own picture;
2. else the mirror state's record in the mirror, when that paints the other side - this hand, this way across;
3. else the art has this hand only the other way across: the mirror state's record as painted.

A weapon is always 1 for the right hand and 2 for the left - the mirror of the mirrored strike, as before. The fists take
all three; e.g. the right fist's StrikeDown is the left-arm painting mirrored, the left fist's StrikeDown the painting
as it is. Every draw uses ONE rule - a record is mirrored exactly when its painted arm is not the hand's side - so the
classic sprite, each Weapon Widget clone (by the record the clone actually draws, a frame behind the machine), the rest
and the run all agree. Before this the left StrikeDown mirrored a left-arm painting into a second right fist.

## The balance - two weapons are tempo, not twice the damage

`DUAL` in `handsLaw.js`. Every number is a term on DFU's own, and the LEAD's blow is DFU's exactly (CalculateAttackDamage,
the swing modifiers, the skill tallied by the weapon in the striking hand) - its flurry blows too. The fists keep DFU's
numbers whole: hand-to-hand was always both fists.

| Term | Value | Why |
|---|---|---|
| `FLURRY_FROM_FRAME` | a flurry's blow starts 1 frame into its swing: 4 ticks of 5, the hit a tick sooner | the other hand is already raised; in FRAMES, so it is the same at every frame rate (below) |
| `OFF_DAMAGE` | 0.8 of the rolled damage (a landed blow at least 1, a miss a miss) | the weaker hand |
| `OFF_TO_HIT` | -5 at Agility 50, plus the rounded tenth of (Agility - 50), held in [-10, 0] | half a StrikeDown's own -10 (CalculateSwingModifiers); the off hand's sureness is Agility's |
| `OFF_WEIGHT` | the off arm feels its weapon 1.5x heavier (SWING-LAW's heft at 1.5x the weight over the heft at the weight), paid in WHOLE TICKS held at the end of its own blows (`offHandHold`, AUDIT 2) | a dagger (0.5 kg) costs nothing, a longsword (4.5 kg) a tenth of the swing at Strength 50 |
| `OFF_HAND_BLOW` | the off hand's blow as the formula takes it: its share (`blowShare`), and its WEIGHT as a blow (`blowWeight`, `OFF_DAMAGE`) - 0.8 of a blow for what a blow sets off at its own rate rather than its damage's (AUDIT 2) | a pair sets off a weapon's Strikes enchantments, a power's per-blow charge and a skill's use as often a second as its damage edge allows, not its blow rate |

**Why frames, not seconds (AUDIT, lane 1).** The machine steps a swing's frames one tick at a time and drops each tick's
remainder at the frame it lands on (DFU's coroutine, `weaponStates.js` `machineStep`), so the first cut's 0.75 factor on
a tick's time rounded to a different answer at every frame rate: measured through the machine the pair was x0.97 at
30 fps and x1.09 at 1000 fps - a 144 Hz player's pair out-dealt a 60 Hz player's. Starting the flurry a frame in is 0.8
of one weapon's time at any frame rate. The Morrowind arm's pacing (`blowSchedule`) times a strike from the frame it
stands on.

**The burden in ticks too (AUDIT 2, lane 1).** The first audit moved the flurry into frames and left `OFF_WEIGHT`'s
burden a factor on the off hand's tick (`ctx.tempo`), which rounded the same way: a battle-axe pair swung x1.11 as often
as one axe at 30 fps and x1.20 at 1000, a longsword pair landed x0.96 to x1.05. Now the off hand's blow of `ticks` ticks
owes (burden - 1) x ticks more, HELD on its last frame after its hit - the heavier follow-through - in whole ticks of the
swing's own (`handsLaw.js` `offHandHold`, `weaponStates.js` `machineStep`'s `m.hold`, set by `PlayerWeapon._attack`), the
fraction carried to the hand's next blow (`_burdenCarry`), so a fight pays it exactly at any frame rate; no blow averages
a tick slower than `SWING_FRAME_MAX`. The hit lands where DFU's does; `blowSchedule` counts the held ticks, so the
Morrowind arm's blow ends with the machine's; a Weapon Widget clone holds its last frame while the machine still
attacks. A tick's time is now the weapon's whatever the hand, a mod's answer included (`swingCtx` carries no factor).

**The off hand's blow is 0.8 of a blow in everything it counts (AUDIT 2, lane 1).** Its share made its DAMAGE 0.8, but
everything a blow sets off at its own rate still came a quarter faster with the pair's blows: a weapon's Cast When
Strikes spell (x1.17-1.25 a second), Potent Vs' flat five, a loot power's per-blow charge (Conduit's mana, Flow's
stack, the Undertow's), the Serpent's Coil, and the skills a swing trains. Now `OFF_HAND_BLOW.blowWeight` (0.8) rides
the blow: `calculateAttackDamage` rolls once whether an off-hand blow counts whole (`rolls() < blowWeight`), sets off the
weapon's Strikes payloads only if it does, and tells the strike listeners (`info.blow`), where `lootPowers.js`
`lootStrike` and `sigilSetPowers.js` `setStrike` take their per-blow charges only from a whole blow. The shares of the
damage (a leech, a chain, an echo, Cleave) already ride the blow's own damage. A swing's skill tally
(`hostCombat.js` `tallySwingSkills`) counts its weight, the fraction carried on the player (`PlayerWeapon.blowWeight`,
handed on by every melee tally the hosts make): a pair trains x1.07-1.12 a second, the same per kill as one weapon,
where it had trained x1.25.

**Measured, not on paper** (the audit's own scripts, through the real machine and the real formula):

| | swings a second | damage a second |
|---|---|---|
| a dagger pair vs one dagger, 65% to hit, Speed 50 and 100, 30/60/144/1000 fps | x1.24-1.25 | x1.08-1.09 at every frame rate |
| a longsword pair vs one longsword (the off arm feels 4.5 kg), the same (AUDIT 2: its burden in held ticks) | x1.19-1.20 | x1.03-1.04 at every frame rate |
| a longsword pair, the real formula, 200k seeded rolls, 60 fps, Speed 50 / 100 | | x1.058 / x1.031 |
| longsword + dagger vs the longsword alone, same | | x0.881 / x0.839 |

A matched pair lands about 9% more damage a second than one of its weapons when they are light, and less when they are
heavy (a longsword pair about 4%: the off arm's burden) - at every frame rate - for a quarter more fatigue a second
(DFU's per-swing cost, unchanged) and the shield's armour given up - under PCAAO too since TWO-HANDS-SHIELD
(2026-10-17), where the mod's block roll had read the off weapon as a shield and an iron one blocked as a leather
buckler (`05-Combat/Physical-Combat-Overhaul.md`, the sixth departure). A light off
weapon trades damage for quickness: half the blows are the dagger's (a quarter of the longsword's), so a longsword with a
dagger lands LESS than the longsword alone - the pair is as good as its weaker hand. (The first cut's record called the
dagger "the off hand's natural blade"; measured, it is not.)

**One home for the off hand's blow** (AUDIT): its share is laid INSIDE the formula (`formulas.js` `calculateAttackDamage`'s
`blowShare`) - in the stock core ahead of the equipment's wear, and (AUDIT 2) handed into a mod's core, where PCAAO's -
on by default, and every blow's - lays it after its armour and ahead of its own wear and says so (`notes.shared`, never
shared twice; a core that does not take it is shared after) - so the HUD's number, the strike listeners (a leech, an
echo, Ruhn's Cleave, the feud ledger), the Strikes payloads and the wear all see the blow that landed (L5: under PCAAO
the wear had seen the whole roll on 194 of 194 landed blows). Its to-hit rides the swing's own channel (`playerAttackOptions`' `toHitMod`), so an AdjustWeaponHitChanceMod
override sees it as it sees the StrikeDown's. And **a blow between players carries the same terms**
(`duelCombat.js` `resolveDuelStrike`'s `off`, on the striker's own sheet): every duel, siege, siege-work, Royal Tourney
and wild-zone arm hands the STRIKING rig's `offStrike` on (world.js's and the dungeon's own rig alike - AUDIT 2: through
the streamed world's relay too, `worldModes.js`'s `wildStrike`, which had taken three arguments and dropped `{ off }`, so
every off-hand blow in a PvP dungeon landed whole, x1.53; pinned by running the three arrows' own source) - measured
equal to the blow against a foe (the off hand's mean blow 13.657 both ways, where it had landed whole between players).
`offStrike` is the one predicate (a pair's strike in flight that is the off hand's); `resolveHit` reads it too.

**What the strike carries** (`playerWeapon.js`): `_attack` asks the law for the hand (`_nextStrike`), and while a strike
of both hands is in flight the weapon in use is the STRIKING hand's (`activeHand`, `handItem`) - its art, its skill
tally, its swing time, its poison, its recoil - and the lead's again after it; if the hands stop being two mid-strike
(a quickslot swap) the weapon in use is the one hand's at once. `restingWeapon` is the lead's - what the HUD's diamond
(all four hosts) and a technique read, so neither flickers to the off hand's item for its blows. `_attack` sets the off
hand's held ticks (its burden off `readSwing`); `resolveHit` the off hand's to-hit by the live Agility (`liveStat`, pinned
with a fever's +40) and `OFF_HAND_BLOW`. A technique (TECH1) is always the lead hand's (`lead: true`), never a flurry's.
H re-applies as ApplyWeapon does (AUDIT 2, L4): a transformed lycanthrope's claws stay the weapon in use, one hand, and
DFU's line is said, not the fists' lead.

## The sprite lane - `src/combat/twoHands/twoHands.js`

Wired by `combat/weapon/weaponRig.js`, the one surface all four hosts mount (no host carries a line of it, HOST-SPLIT).

- **The machine is one.** The rig's PlayerWeapon runs DFU's one machine; each hand sees a VIEW of it (`view(hand)`):
  its picture's state (above) while the strike is that hand's, the idle otherwise.
- **Each hand drawn by DFU's own placement**: the classic body by `fpsWeaponQuad` (`fpsWeapon.js`, drawFpsWeapon's
  placement without the draw), or a Weapon Widget clone - the rig's own for the right hand, `offWidget` for the left -
  mirrored by the one rule. A pair's clone is never flipped by Handedness or Ambidexterity (`pairHand`). Each clone plays
  its own hand's blows and holds its idle through the other's; the left clone's coroutines resume at the frame's end
  like the right's (`endOfFrame`). The striking hand is drawn over the other. A pair's left hand's blow recoils the left
  clone (WW1's recoil).
- **The sway, two rules** (AUDIT 2, L2 - the first audit's "both hands sway as one body" turned Bob about with Inertia,
  and Bob's x is the mod's own one-way swing, so the left hand sent with it drew its cut outer side up to 38 px into the
  view on 225 of 240 walking frames, where the mod's own left-handed weapon shows none): **Bob goes outward**, the left
  hand the right's exact mirror on every frame, as the mod's flipped sprite takes Bob (`widgetTransformRect`'s
  `r.x -= position[0]`); **Inertia keeps the screen's direction**, both hands lagging the look as one body, as the mod
  pre-signs it for a flipped sprite (`inertiaStep`'s sign). The clone keeps the two apart (`swayDx`) and `pairRect`
  lays Bob minus Inertia before the mirror. The Offset slide is the hand's own and is mirrored with it.
- **One clock** (AUDIT 2, L2): the left clone keeps the right's (`lateUpdate`'s `clockOf`) - the Bob's phase is a clone's
  own time, and a left clone left resting through single-hand play woke seconds behind (11.47 s against 4.07 s after
  7.3 s with one weapon): the hands swung 38 px out of step on the walk. Its smoothing is taken too while it rests.
- **A clone lets go of a blow that stopped being its own** (AUDIT): the Swings module's wind-up ends when the strike it
  shadows ends (a pair dissolved mid-blow - a light lit, a weapon swapped, the beast); before, the left clone wound up
  forever and its fist sat off the screen until its next blow. DFU's one machine always reaches the hit frame first, so
  the one hand never comes there. The left clone is stepped only while a pair is up, or until its swing has ended and
  its slide settled out of sight (`settledHidden`): single-hand play never pays for it - and (AUDIT 2, L4) it is BORN
  there (`createWeaponWidget`'s `hidden`), where it had been born in view and stepped at every boot until it slid out,
  fetching the left hand's art (WEAPON10) for a single weapon; shown on its very first frame (a game loaded with a pair
  up) it stands at its place.
- **A punch off the running arm winds up from below** (AUDIT 2, L2): the Swings module's default wind-up shows the idle
  at rest and sinks it - on the run that drew the fists' rest in sight where no fist stood, the punch frames 0.4 s
  later. A punch thrown with the run at or past its swap (`twoHands.fromBelow`) starts its clone's wind-up at the Offset
  slide's low place, where the arm went.
- **The guard** (`GUARD`): while one hand strikes the other draws in - a fist toward the middle (10 px on the 320x200
  surface) and down 9 px; **a pair's resting weapon straight down by `LOWER`, 0.12 of its own drawn height** (Mac, after
  the first pictures: "When attacking with a weapon, the other weapon in hand should lower slightly"). A weapon's picture
  is several fists tall (WEAPON02's dagger 143 design px, WEAPON04's katana 86), so the fists' 9 px, which the pair had,
  did not read on it; a share of its own height lowers every weapon alike - the dagger 17 px, the katana 10, its hand
  still in the view. Straight down, never in: **THE CUT STAYS OFF THE SCREEN** (Mac: "The sprite on the right moves ...
  and exposes where it clips off"). Every weapon a pair holds is painted with its hand leaving the frame through its
  outer side (measured on the shipped idles: the katana 32 rows cut down its right column, a warhammer 53, a battleaxe
  37 - every one but the plain mace) and WeaponBasics draws it flush to the view's side (AlignRight, Offset 0; the
  dagger DFU's 0.04), so the fists' tuck toward the middle drew the katana's cut 10 design px into the view (30 px at 960 wide). Eased in fast (0.05 s time constant) and out slower (0.14 s) - ClimbPose's limb law, no pop; laid in SCREEN
  space, from the hand's own side, whatever its picture, on the classic sprite and on a Weapon Widget clone alike (the
  clone's own rect height). **THE GUARD IS THE RESTING HAND'S** (AUDIT 2, L2): a striking picture is never moved - a
  flurry's blow began with its hand still lowered from the guard it was easing out of, so blades, mace heads and flail
  balls DFU runs off the top of the screen were sliced flat up to 57 px down the view on every second blow (370
  exposures over 100 pairs with the Weapon Widget, 200 without; none now). The fists' guard is alive standing: a bounce
  at 1.15 Hz, the two hands out of step, gone in a strike or a walk - ONLY EVER DOWN (AUDIT 2, L2: the first cut's sine
  about the rest lifted each fist's cut wrist off the view's bottom edge on 166 of 360 standing frames, up to 4.8 px at
  600 tall - the floating hands again), from the rest to 3.2 px below it and back (`(1 - cos) x BOUNCE_PX`, 1.6).
- **The running hands** (`RUN_PUMP`): running on the feet (DFU's run - not standing, crouched, mounted, swimming, in the
  air or on a wall) at 1 m/s or more with NOTHING in either hand (`weaponRig.js` `handsEmpty`: no weapon or shield, no
  light a lane draws, not the beast, no spell, no act's tool, no held sheet, no swap under way) - drawn or sheathed - the
  two arms pump - kept through a hop (AUDIT 2, L2: a jump on the run swapped arms, fists, fists, arms in under a
  second; `runHandsKept` keeps the run aloft for `AIR_GRACE` 0.6 s, one answer for both lanes) - ON THE HEAD BOB'S OWN
  CLOCK (AUDIT): `HeadBobber` hands its timer out every frame
  (`player/headBobber.js`'s `out`, `player/motor.js` `motionBagOf`'s `bobTimer`) and the pump's phase FOLLOWS that timer
  a quarter turn behind (`runPhaseOfBob`) - the right arm most forward as the left foot is planted, on the bob's phase
  every step while it keeps step; with head bobbing off the pump keeps its own stride (`RUN_STEP_M` 2.5 m a step).
  **Followed, never jumped with** (AUDIT 2, L2 F5 / L3 M3 - `handsLaw.js` `runPhaseFollow`, one law for both lanes):
  the head bob resets its timer to PI when a run resumes within half a second, and the first cut took the reset whole -
  a stop of a frame swapped the arms in one frame (227 px of 600). The stride now catches a jump up at its own tempo
  held within `CATCH` (0.5: half again as fast, or half as fast, the short way round, never backward); a run's first
  frame, with nothing of the pump drawn, takes the bob's phase at once. Worst one-frame jump at a stutter-step: 37 px.
  - **THE RUNNING ARM IS THE ART'S OWN** (Mac, of the first cut: "theres no arm portion of the sprite, so it looks like
    floating hands"). The first cut lifted the bare hand's idle - `WEAPON10.CIF` record 0, a 63x53 fist cut at the
    wrist, painted to stand on the view's bottom edge - up to 0.42 of its height, and the cut floated. So a running
    hand is a frame of the bare hand's art that holds a fist on its own grey forearm from the frame's foot:
    **record 2 (StrikeDownLeft, the right arm's jab across), frame 1** (`ARM_STATE`, `ARM_FRAME`) - a closed fist seen
    from its BACK, knuckles leading toward the middle, as the idle fist is seen, on its forearm reaching in from the
    outer foot, 67 of the view's 200 design pixels. TWO-HANDS FIELD, Mac after the merge, twice. The merged cut drew
    record 5 (StrikeDownRight, the uppercut), its frames 1, 2 and 3 by how far up the stroke was with a snap
    (|sin|^0.7) that held the hand at the top - "Too high, like uppercuts": 2 and 3 are the punch's peak, a fist on an
    upright forearm 98 pixels high, half the screen, every stride. Its lowest frame alone then - "Why is the underhand
    showing when extended and not the fist": an uppercut shows the fist's INSIDE, curled fingers toward the eye, in
    every frame. Record 2's frame 1 leaves its frame through its FOOT alone (no row cut down either side, measured on
    the shipped file and pinned there, the ARENA2 test; record 5's frame 0 had 14 rows down its right, which the
    stroke's outward swing drew into the view - Mac: "The sprite on the right moves to the right and exposes where it
    clips off"). The STROKE is the motion: an even sine, fastest through the middle. It is placed as FPSWeapon places a
    frame - **its foot on the view's bottom edge at the top of the stroke, never lifted** (OnGUI's `height - h`): the
    stroke only LOWERS it (`DROP` 1.05 of its height at the back, out of the view - the hand passing the hip, half of
    it at the stroke's middle), so the forearm always runs off the screen. Across the view it stands where its fist
    rests (the idle's own place), 0.06 of the width toward the middle at the top and 0.03 out at the bottom; the left
    hand is record 2's right arm in the mirror (the one rule). Measured on the real art: the fist at the top of the
    stroke stands a third of the way up the view (the idle fists 27%), one arm rising as the other drops.
  - **The art changes under the view, never in sight**: as the run starts, the fists' own rest (the idle, where the pair
    draws it) goes DOWN out of the view over the first half of the run's weight (`SWAP` 0.5) and the arms come up from
    under it over the second; as it ends, the reverse (a sheathed body's fists were down - the arms simply rise). The
    weight follows time constants of 0.12 s in and 0.16 s out. A punch thrown on the run is drawn from its FIRST frame
    over the other arm (0.04 s away). A hand TAKEN mid-run (AUDIT 2, L2): the run YIELDS at once to any picture that
    takes the hands - a weapon, a shield, a light a lane draws, the gun, a spell's hands, the beast's claws
    (`weaponRig.js` `runDrawn`) - and with nothing in their place (a spell readied with Readied Spellcasting Hands
    off, a swap's pause) eases out under the view as any end does; the first audit ended it at once, which emptied the
    view in a frame. The ground speed is read
    off the eye every frame, whatever mods are on (AUDIT: kept inside the mods' gate, the running hands never ran with
    the Weapon Widget, Handheld Torches and Shield Widget off).
- **The draw seam** (`weaponRig.js`): the two-hands branch stands after the climb's return and before the Morrowind
  arm's seam, never under the Beholder's sprite, the Morrowind arm or the held map's window (MAP-WEAPON); it draws whole
  and returns - the running arms first, then the pair (a punch on the run over them). A pair holds no shield and no
  light, so the one-hand ladder below it (the shield, the torch hand, the gun, the clone, the sprite) is the single
  hand's, untouched. The gate gains `runHands` and `armsRun`: an empty-handed run is often a sheathed one, and the
  running hands are not a weapon either (as CLIMB-HANDS' `armsClimb`).

## The Morrowind lane - `src/combat/twoHands/mirrorRig.js`, `src/combat/fpArm.js`

Tackled after the sprite lane, as asked. Morrowind has one weapon hand: its one-handed groups swing the right arm, its
hand-to-hand groups throw each punch with the hand the clip was made for, and there is no clip for a left-hand blow or a
second weapon. So the second hand is the sprite lane's idea on a skeleton: THE LEFT ARM IS THE RIGHT ARM IN THE MIRROR.

- **The mirror rig** (`mirrorRig.js`) holds no number about any skeleton (CLIMB6's rule). Every bone's counterpart is
  found by its NAME (`counterpartName`: Bip01's L/R, the attach family's Left/Right, Weapon Bone and Weapon Bone Left);
  the plane is the skeleton's own middle (halfway between its upper arms at rest). **The law, in each bone's own frame**
  (AUDIT, L3 2): a bone moves as its counterpart moves, in the mirror, FROM ITS OWN REST -
  `L'(b) = RestL(b) . K^(b)^-1 . [RestL(m)^-1 . L(m)] . K^(b)`, `K^(b)` the 3x3 of `Rest(m)^-1 . S . Rest(b)`, a
  constant of the skeleton. Every bone's rotation is the graph law's (`M'(b) = S . M(m) . Rest(m)^-1 . S . Rest(b)`) and
  every joint stays on its parent; where the rest is its own mirror (the fixture arm) it IS the graph law, translations
  and all. The first cut hung each bone at the mirror of its counterpart's frame: on the retail biped (`xbase_anim_sh`),
  whose rest stands 6.7 units off its own mirror at the knees, a turned upper arm slid the shoulder 0.52 units off the
  clavicle and a finger joint 10% off its bone. Measured: rotations to 5e-4 on retail, the fixture exact to 1e-5. A bone
  with no counterpart keeps its local and rides its mirrored parent; a bone INSIDE an arm with no counterpart (the Shield
  Bone) is unpaired, so it never crosses the body.
- **An arm set from another pose hangs from this frame's body** (AUDIT, L3 2): its bones' locals are read off that pose
  (copied, or mirrored as above), so its shoulder stays where this frame's chest carries it (the first cut set it in the
  graph's space: a 25-degree spine twist left the shoulder 9.07 units off the chest). Another clip's arm is sampled for
  that arm alone (`limbSkeleton`), and the frame reads only the locals it mirrors - no whole-skeleton matrices (AUDIT,
  L3 10: 0.101 -> 0.011 ms a frame).
- **Posed in the assembly** (`mwFirstPerson.js` `poseAssembly`'s `mirror`): right after the clip poses the skeleton,
  ahead of the neck and the climb's IK, on both rigs (the first-person arms and the third-person body).
- **In first person, mirrored across the picture** (TWO-HANDS FIELD, Mac after the merge, of the pair in first person:
  "No left arm"): the rule above hangs a mirrored arm from this frame's chest, so it lands where the right one stands
  only while the chest stands on the eye's own middle - the fixture arm's, not Morrowind's, whose first-person clips
  pose the body to put the weapon hand in view. The pair's left arm was out of the picture whole. The first-person
  rig's mirrored arms are placed in the graph's space as the mirror of the other through the upright plane through
  the eye (`mirrorRig.js` `plane`, `pictureMirrorArm`: `W'(b) = P . W(m) . K(b)`, `K(b) = Rest(m)^-1 . S . Rest(b)`,
  P the reflection through the eye's x - the camera node as the clip poses it, moved `fpOffset` across; the lens
  looks down the rig's +Y, so that x is the picture's middle). The left hand stands in the picture where the right
  stands in the glass - the sprite lane's law. Its top stands off the chest by as far as the body stands off the eye;
  no chest is drawn in first person. The body in third person keeps the chest's rule. Only the chains to the eye and
  to each arm's parent are read (`chainWorld`) - the frame composes no whole skeleton (L3 10). Arms COPIED (the fists,
  the idle's own arm) are untouched; the left-hand blow mirrors the whole body, the eye with it, so its picture was
  the glass's already.
- **Mirrored by the bind, not the rest** (TWO-HANDS MIRROR-BIND, 2026-10-17, Mac: "adjust the positioning of the
  morrowind left hand duel wield model on first person, so its properly mirrored. Third person looks good"). The
  picture law's `K(b) = Rest(m)^-1 . S . Rest(b)` moved a mirrored arm as its counterpart moved FROM ITS OWN REST,
  translation and all, so the left arm stood as the right's mirror only where the rest is its own mirror. Third person's
  nearly is (xbase_anim's hands 1.09 units off each other's mirror); the first person's rest is a clip's first frame,
  posed for the weapon hand. On the MW-STEEL4 stand-in for it (retail's bones, a camera, the arms' rests turned 70, 85
  and -50 degrees off each other's mirror), the left hand stood 38 units off the right's mirror and the left blade 65;
  on the near-symmetric retail rest, 1.1 and 2.6. What the left arm must be on the screen is the right arm's MESH in the
  glass, and a skinned vertex lands at `M(b) . Bind(b)^-1 . v`, so `K(b) = Bind(m)^-1 . S . Bind(b)` - the bind's
  (`mirrorRig.js` `pictureK`). A skin bound symmetric makes it a pure turn of the bone's axes with no translation, so
  every joint stands exactly at its counterpart's mirror. The binds are the skeleton file's own skins (retail's Tri
  Shadow, kept at assembly as `skinBinds`) and the assembly's skinned pieces (`mirrorBindSources`; a turned skin is not
  read). A pair is read from one skin binding both, else from each side's own piece, and only where the two binds ARE
  a mirror (`mirroredBinds`: each joint's y and z the other's to a hundredth of their span). An unbound node whose name
  rule 13 mirrors (Weapon Bone Left, the Left Hand and Left Wrist attach nodes: a part on it is drawn with x negated) is
  `X`, so the right part's mesh, drawn negated, lands as the right one's mirror - the left blade in the left fist as
  the right is in the right, whatever the made bone's F was read from. Anything else keeps the rest's K, so the fixture
  arm, whose rest is its own mirror, is the old law. Measured after: hand, elbow, blade (vertex for vertex), a rigid
  part on Left Hand and every left gauntlet vertex land on the mirror to 1e-3, with the Tri Shadow and with only the two
  gauntlets' skins. Third person (the body's local law, `buildPlan`) is untouched.
- **The compositions** (`fpArm.js` `mirrorFor`), while the pair is IN THE HANDS (`pairHeld`: from the first frame of the
  draw to the last of the sheathe - AUDIT, L3 7; the blades still appear and vanish on the attach and detach keys):
  - a pair at rest - the left arm the right's mirror: both weapons up, as the stance holds the one; **on the move, the
    right's mirror HALF A STRIDE ON** (TWO-HANDS FIELD, Mac after the merge: "Both arms swing the same direction"): the
    movement clip that poses the body, sampled half its loop later (`strideOppositeTime` - its group's own loop keys,
    so the window is the same from the first frame; one loop is one whole stride, the hip swaying once a loop), so the
    arms swing against each other as the clip's own two do, each blade carried as the right carries its own. The merged
    cut mirrored the frame's own right arm and swung both together. A clip over the walk (the draw, a recoil, a blow)
    poses the arms itself;
  - the right's blow - the clip swings the right; the left holds the idle's right arm, mirrored;
  - the left's blow - the whole body in the mirror (the left swings the clip's blow, the torso turns with it) and the
    right arm the idle's own; **a mirrored blow keeps the way the player asked** (AUDIT, L3 5): it plays the backhand of
    the mirror strike (`mirrorStrike`), so the left hand's StrikeLeft is the right hand's StrikeRight in the glass;
  - the fists - as the clip has them, but a blow thrown by the hand its clip does not throw with is the whole body in
    the mirror, the other fist held where the idle holds it. Which fist a clip throws is MEASURED, not assumed: the
    wrist that travels the farther from the attack's "start" to its "hit" (`strikingSide`), once per clip.
  Nothing for a sheet held, the stone, a spell, the dead, a beast - the guard included (AUDIT 2, L3 M2: `handsTaken`;
  the gated case is a carry key of its own, `'taken'`, and a hand that took the sheet mid-blow was turned down below it
  for 112 frames). The inventory portrait shows the pair, both arms up (AUDIT, L3 8).
- **The guard on the body** (Mac: "the other weapon in hand should lower slightly"): while one hand of a pair strikes,
  the other arm turns DOWN at its shoulder - never translated, so it stays on the body and every bone keeps its length -
  eased by the sprite lane's weight (`guardStep`). Its size is the sprite lane's PAIR guard (AUDIT 2, L3 M4 - the first
  cut sized it from the fists' 9 of 200 design px, which the sprite lane gave up on a weapon because it did not read):
  `GUARD.LOWER` of the blade's own height on the arms' picture (`bladePictureHeight`, the blade placed in the right
  hand at the build's rest; `guardLensDrop` - on the fixture 0.0898 rad at the eye), the fists' `GUARD_LENS_DROP`
  (0.0519) for a hand with no blade, carried to the shoulder by each rig's own arm (`pairGuardDip`) and measured once
  per bound blade at the pair's first guard, never on a build (L3 M5: every NPC's and peer's build had paid for it). No
  guard is asked while something else has the hands, and the dip is laid into the pose ahead of the carry, so it eases
  off the arm rather than snapping (L3 M2).
- **The spread** (TWO-HANDS SPREAD, 2026-10-17, Mac: "For the morrowind first person, when duel wielding can we spread
  out the arms a bit more sense it can make the weapons overlap"). The left arm in the glass stands its blade where the
  right's would stand in it, and Morrowind's one-handed stance leans its weapon in toward the picture's middle - so a
  long pair's blades crossed there. In first person, while a pair is in the hands, both arms are turned OUT, each at its
  top (the clavicle, else the upper arm) about the upright line through that top's own joint, each its own way
  (`mirrorRig.js`'s `spread`; which way is out is read off the skeleton, the plan's `outward`): no joint leaves its
  parent, and the left stays the right's mirror. How far is the law's (`handsLaw.js` `PAIR_SPREAD`, `pairSpreadAngle`): always
  MIN (0.04 of the picture's height), further until the two blades stand GAP (0.04) apart, never past MAX (0.2) - each a
  share of the picture's height taken as the angle it spans at the middle, as the guard's LOWER is a share of a blade's.
  Each blade's inner edge is READ, never assumed (`fpArm.js` `bladeInnerEdge`): the angle from the picture's middle to
  the blade's nearest point, every triangle edge cut to the picture's height first (a tip off the top is read where it
  leaves the picture), the left blade read in the right hand as the guard reads it (`pictureBone`). A turn about a
  shoulder moves an edge less than the turn (the arm swings about a joint off the eye), so the edges are measured at
  every angle the halving tries (`spreadMeasure`) - on the build's rest pose, once per bound blade, the first frame a
  pair is held, through the guard's own memo (`pairBladeMeasure`, now one for both: the guard's measure moved out of
  `createFpArm` with it, `guardMeasure`, so the arm's closure gains the wiring alone - 1,997 -> 1,999 code lines, under
  HOST-SPLIT's 2,000-line knot). The angle eases on `PAIR_SPREAD.TAU` (0.12 s) in either view (`pairSpreadStep`) and is
  laid in first person alone (the body in third person carries a pair its own way - BODY-MOTION, `04-Characters/Body-Motion.md`: down and away from its sides at rest, swept behind it at a run; with Morrowind Body Motion switched off, the clips' own pair as before - AUDIT BODY-MOTION DOC-16), over every composition and its
  guard, so the carry starts from what was drawn; sheathed or with the hands taken, it eases back. Measured on the
  fixture: its blades stand clear at rest, so MIN (0.046 rad); a blade leaned 0.45 rad across the middle, 0.121 rad, the
  two GAP apart.
- **No pop** (the carry, AUDIT, L3 3 and 6): every change of composition carries every bone, IN ITS OWN FRAME, from the
  local it was drawn with last frame onto its new one over `POSE.LIMB_TAU` (ClimbPose's limb law) - its turn, its
  joint's move and its scale eased away, children riding their carried parents, so no joint leaves its bone (worst bone
  during a carry 71% -> 0.0%; the Shield Bone stays on its hand). A carry that has drawn nothing (a new rig, a view just
  entered) takes its first composition at once.
- **The left hand's weapon**: the right hand's record, mesh and door, hung on `Weapon Bone Left` in a slot of its own
  (`offweapon`) - rule 13 already draws a "Left" bone's part mirrored (the bow's law). **A skeleton without one is
  given one by the mirror** (AUDIT, L3 1 - the blocker: Morrowind's retail skeletons carry no Weapon Bone Left, OpenMW's
  optional node a modded skeleton has, so the pair drew one weapon and the left hand never swung): `offWeaponBoneAddon`
  hangs it under the left hand MIRRORED HAND TO HAND (AUDIT 2, L3 M1): its local in the left hand is
  `F^-1 . local(Weapon Bone) . X` (X turns its x back, rule 13 negating it), F the hands' mirror in the frame the
  skeleton file's own skin binds them (`skinHandMirror`: retail's never-drawn "Tri Shadow" binds the whole Bip01 chain
  in the T-pose, exactly symmetric), or the rest's own rotation where no skin binds both. The first cut mirrored the
  Weapon Bone in graph space at the REST, which retail stands with its hands 1.09 units off each other's mirror: the
  left grip sat 1.4 units off and 2.8 degrees turned in the left fist; now the right's mirror to about 1e-9. It reads
  one rest pass and two names (0.73 ms a body -> 0.05). Through the addons' own door on both of `buildFpArm`'s
  assemblies - the player's, a peer's and an NPC's body alike - recorded in the assembly's `injected` as
  `mirrorRig.offWeaponBoneAddon`. On the fixture, which carries one, the made bone equals the authored exactly. A bow never hangs on it (it reads the actor's own bytes). Shown while a pair is drawn, hidden
  sheathed, under a sheet, on the stone or in a spell. `setOffWeapon` queues behind a build like `setWeapon`, and a
  failed left swap is tried again the next time (AUDIT, L3 9). A rebuild keeps it (AUDIT 2, L3 M6): `buildFpArm` takes
  the left weapon the rig recorded (`offWeapon`) and binds it on both rigs after assembly (`resolveOffWeaponParts`) -
  an armour change had dropped the left blade until the archives reopened (23 frames at a 600 ms reopen; 0 now). The
  arm's hands go through ONE door (AUDIT 2, L4:
  `weaponRig.js` `handArm` - the right hand's item, the left's, the mode and the lead), asked by the frame and by the
  enhanced pack (`ui/enhanced/enhancedInventory.js`, handed `handArm` by each host on the line that hands it `usingRightHand`),
  whose window blocks the frame while the table changes under it: the pack had kept its own one-hand read, so a
  left-led pair held the left weapon in both hands while the window was up and a pair made in it showed only on close.
- **The running hands** (`RUN_3D`): the same stride, snap and weight as the sprite lane's, the stride FOLLOWING the
  rig's own head-bob phase when handed one (`setRunHands`' `phase`, by the sprite lane's `runPhaseFollow` - AUDIT 2, L3
  M3: a stutter-step's reset had swung the wrists 8.9 units in a frame on the retail scale, now 4.4, its own stride's), each hand at its stroke's place on the arms' own picture - a
  line from the rig's eye through a share of the frame, laid in the arm LENS's pitched frame (AUDIT, L3 11: with
  follow-camera off a look half a radian down lifted the hands 0.4 rad up the picture), a point `d` metres out -
  reached by the climb's solver (`climbRig.js`) with the fist clenched, the palm in, the elbow out and back; first
  person alone (in third the body's own gait swings its arms - BODY-MOTION, `04-Characters/Body-Motion.md`). **Solved under the climb** (AUDIT, L3 4): its own
  `run` slot in `poseAssembly`, before the climb's request, which eases each wrist on from where the run put it - the
  first frame onto the wall moved the wrists 1.19 units, now 0.52 (the climb's own ease), the frame a sheet comes up
  1.05, now 0.005.
  **RUN-WIDE** (2026-10-19, Mac: "The hands are way too close together when running both in third and first person"):
  the top of the stroke stood 0.36 of the half-frame across - 14 cm out at its 0.42 m on a 16:9 picture (11 on a 4:3),
  inside the retail shoulder joint's 15.5 - so each fist came up toward the middle of the picture; now 0.6 (21 cm, 17),
  before and just outside its own shoulder, and the bottom 0.8 (it was 0.6), the hand coming in a little as it rises.
  Pinned in `test/combat/twohands_mw.test.js` (RUN-WIDE THE FIRST PERSON'S RUNNING FISTS); the third person's running
  hands are the body's gait (`04-Characters/Body-Motion.md`, RUN-WIDE).

## Weapon glow on two hands (WEAPON-GLOW1, merged from main)

WEAPON-GLOW1 (`05-Combat/Weapon-Glow.md`) landed on main beside this slice: a weapon's element drawn in the hand. On two
hands **each hand wears its own weapon's element** - a frost dagger beside a fire sword is a frost outline and a fire
one, never one hand's glow on both:
- **The classic pair** (`twoHands.js` `drawClassicHand`): each hand's outline over its own picture - the same frame, rect
  and source (the left's mirror), measured in the record's own pixels as `drawFpsWeapon`'s; the rig hands each hand its
  own item's (`glowFor`: `glowOf(playerWeapon.handItem(hand))`), and each hand's art is its item's plain sheet while an
  element shows (`artFor`).
- **The Weapon Widget clones** (`weaponRig.js` `cloneFrame`): every clone - the one hand's, and each of a pair's - is
  handed its own item's set and outline (`heldType(item)`, `glowOf(item)`); a clone of a pair draws its outline on its
  own rect and source (`weaponWidget.js` `draw`), the one hand's two lines WEAPON-GLOW1's own.
- **The Morrowind arm** (`fpArm.js`): the held glow is the item the arm HOLDS (`armItem` - in a pair the right hand's
  whichever hand strikes; main's line handed the weapon in use, which changes mid-blow, and the arm's key guard would
  have dropped the glow for every left blow); the left blade its own (`setOffWeaponGlow`), laid only on the blade bound
  and while the pair is drawn (`offGlowShown` - the held glow's NET-1 law for the second hand). The renderer lights each
  slot with its own glow, each its own pass (`Renderer._drawWeaponGlows`: 'weapon', then 'offweapon'); a third-person
  picture is padded for the larger of the two outlines (`characterSprite.js` `drawRigSpriteBox`'s `glowLook`, one look
  or two). Neither blade wears its glow on the stone, and a blade's particle effect hides wherever its mesh does - under a
  sheet, on the stone (AUDIT 2, L3's two suspected gaps, both confirmed: `glowShown`/`offGlowShown`, `effectHidden`; the
  right blade had the same gap and takes the same rule).
- PIN MOVED, each with its note: `weaponglow1` (the clone's set and outline per item, the arm's held item and left
  blade, the pad's looks), `coats3d_horse3d`, `invislook` and `prbow1_bow` (the third-person draw's `glowLook: padLooks`),
  `mwtorch` (the left item named once).

## Departures from DFU (Port-Ledger A, TWO-HANDS)

1. ToggleHand/ApplyWeapon: with both hands up both are in use; H picks the lead, ends the exchange and bills no switch
   (BowLeftHandWithSwitching's delay is a swap's, and nothing changes hands); the weapon in use is the striking hand's
   while a strike is in flight, the lead's at rest (`restingWeapon`: the HUD's plaque, a technique's weapon).
2. FPSWeapon: a second sprite; a hand of a pair mirrored whole (every state) by the one painted-arm rule, not three
   states for Handedness.
3. The weapon state machine: a flurry's blow starts at frame 1 - a tick sooner, in ticks, so the same at any frame rate;
   the off weapon's burden is whole ticks held on the last frame of its own blows (`m.hold`), the fraction carried, held
   to SWING_FRAME_MAX.
4. CalculateAttackDamage: the off hand's to-hit term at its caller, its damage share INSIDE the formula (`blowShare`,
   handed into a mod's core), so the share, the report and the wear agree; its weight (`blowWeight`) gates the Strikes
   payloads and tells the strike listeners on one roll; the player-vs-player blow (`resolveDuelStrike`'s `off`) carries
   them. TallySkill: an off-hand swing tallies 0.8 of a use, carried.
5. The running hands: DFU draws nothing in the hands on a run.
6. No Features switch (the owner, of the second audit's L4 m3: "Leave them on"): both fists up and the running hands
   stay under Settings > Features' All off, whose word is that every enhancement goes to Off; a pair needs none, being
   the player's own choice of two weapons.

## Not carried

- **Peers on the wire**: another player's body still holds the one hand the wire names (`shown.lh`,
  `net/peer/peerBodies.js`), not the pair.
- **The off weapon's holster**: sheathed, the left hand's weapon is hidden, not hung on the body as Weapon Sheathing
  hangs the one weapon.
- **The Beholder's sprite body** (EOTB): third person on the sprite body shows one weapon.
- **Werecreature claws**: the beast stays single (DFU's racial override, one claw sprite).
- **A skeleton with no Weapon Bone at all**: no left weapon is made for it (there is nothing to mirror); the pair still
  composes and swings.
- **The 3D run on the fixture's scale**: the fixture arm's run targets stand ~28 units out from a ~1.5-unit arm, so its
  pins measure the targets asked (identical at every look) rather than a reach.
- **The test suite holds no ARENA2**: the sprite lane is pinned through a real rig on a synthetic WEAPON CIF (its
  painted arms set as WEAPON10's are), the Morrowind lane on the retail biped and the fixture arm. The real art was
  probed outside the suite (Audit-Two-Hands.md, "Evidence").

## Pins

- `test/combat/twohands.test.js` (23 - AUDIT 2's two: the off hand's blow as 0.8 of a blow in all it counts, and the sprite lane audited again): the law and the painted arm, the balance MEASURED through the machine at two frame
  rates, PlayerWeapon through the real formula and the override seam (the flurry's frame, the schedule's ticks, H's
  exchange, the resting weapon, the off strike), the off hand's blow in the formula and between players, the rig on a
  synthetic CIF - the fists, the guard, the widget's two clones, the pair, the running hands (the stroke, the bob's
  clock, what takes a hand, the mods), the branch by source, a left-handed player.
- `test/combat/twohands_mw.test.js` (38 - SPREAD's four: the law's angle, a blade's inner edge cut to the picture, the turn on the skeleton, the arm in lockstep with one weapon; AUDIT 2's six for L3; MIRROR-BIND's two: the first-person pair the right in the glass on a rest that is not its own mirror, and the binds read only where they are a mirror; the field reports' three: the stride's other half, a pair
  walking in third person swinging its arms against each other on a female body's two sources, the first-person pair
  mirrored across an eye moved off the chest): the mirror rig on the retail biped (counterparts, the plan, the law in each bone's
  frame - every joint on its parent, a twisted chest, the carry per bone, the made Weapon Bone Left, which fist a clip
  throws) and the arm over the fixture arm (the left weapon on a skeleton without one, the pair from draw to sheathe,
  the mirrored blow's way, the guard's dip, the fists, the running hands under the climb and on the pitched lens, the
  portrait, a retried swap, by source). `tools/mutants/twohands_mw.json`: 78 mutants, all dead (8 the field reports',
  `FIELD-*`: each fix reverted). `tools/mutants/twohandsmirrorbind.json`: 9 mutants, all dead (MIRROR-BIND: the rest's
  K, one skin only, the Left node's X and its bind's precedence, the mirror check both ways, each source unread, a
  turned skin read). `tools/mutants/twohandsspread.json`: 23 mutants, all dead (SPREAD: the law's floor, cap, gap,
  halving and answer, one blade asking; the turn inward, in the bone's own frame, ignored, not alone, not kept, popping
  under a new key, its way out assumed; the edge uncut, read at its corners, turned the wrong way; the angle in third
  person, measured for one weapon, kept after the pair, uneased, never at rest, never stepped, measured once for good).
- `tools/mutants/twohands.json`: 184 mutants, all dead (4 the field reports', `TWOHANDS-FIELD-*`: the run on the
  uppercut, on a high frame, the snap, the fist held at the top - AUDIT 2's `RUN_PUMP-shape` and the first audit's
  `run-pump-frame-by-stroke` retired with the code they reverted, `hands-in-step` and two `TWOHANDS-ARM-*` re-aimed
  onto the one frame; 65 of them AUDIT 2's, `TWOHANDS-AUDIT2-*` and `TWOHANDS-SPRITE2-*`; 39 the first audit's, `TWOHANDS-AUDIT-*`: each fix reverted, and
  each claim the record made that no pin could fail; 14 the running arm's and the lowered weapon's, `TWOHANDS-ARM-*`,
  `TWOHANDS-LOWER-*`; 12 the pair's glow, `TWOHANDS-GLOW-*`).
- PIN MOVED (SPREAD), four `twohands_mw.json` records re-aimed, each the same mutation on the line it now stands on, all
  dead: `TWOHANDSMW-AUDIT2-left-blade-on-its-own-bone` onto `pictureBone` (the line `bladePictureHeight` and
  `bladeInnerEdge` share), `TWOHANDSMW-AUDIT2-guard-memo-blind` onto `pairBladeMeasure` (the memo the guard and the spread
  share), `TWOHANDSMW-AUDIT2-dip-drawn-unkept` and `TWOHANDSMW-AUDIT2-idle-key-reads-the-plan` onto the mirror's `keep` and
  its idle key's early answer, which read the spread beside the dip.
- PIN MOVED, each with its note: `a12_lefthand` (H's lines with both hands up; the bow-switch arm on its own case, a
  bow in the left hand), `audit_seats_client` G5, `auditcc_pvp` H5 and `duel_combat` DUEL1 (the off hand's blow between
  players), `enhancedHud` AUDIT 39 (the plaque reads the resting weapon), `ww2_idlebob` WW2 (the motion bag's
  `bobTimer`), `ww1_weaponwidget` (the recoil's hand, the frame's end), `ht1_handheldtorches`, `climbhands2`,
  `mwcast1`, `map3_heldpose` (the draw gate's two new legs), `mwtorch`, `werewolf1`, `mwattach` MW-D19 (the arm's item
  is the right hand's in a pair), `climb6` C16 (the climb slot's run), `fparm` MAC-S1 (five busy takers), `thunderlock`
  FIELD-GUN13 (the gate), `auditrr` F1 and `rri2_realism` (the swing's ctx is `swingCtx`, the clone's the rig's when
  handed one), `tech1_hosts` (a technique through `_attack`, the lead's), `fb1003_widgetlook` (the clone's frame built
  by `cloneFrame`), `mwload_fparm` MW-LOAD (`resolveOffWeaponParts` a door its callers open), `arrowPick` MW-D50 (the
  left weapon's three archive reads); and the Morrowind lane's audit (L3): `reversedSwing` (a mirrored blow's
  backhand), `fb1012b_headheld` and `ws1_sheathing` (both assemblies ask for the made Weapon Bone Left), `climb6` again
  (the run's own slot under the climb), `fparm` again (the portrait's window, its pair), `twohands_mw` (`setRunHands`'
  phase).
- Mutant records whose anchors this slice moved, re-aimed by content and re-run (all dead): `arrow2`,
  `auditdisc28_arrest`, `climb4`, `climbhands2`, `disc10`, `l10n3dcrossings` (two), `mwcast1`, `mwhand`, `sw1`, `tech1`,
  `torchvis`.
- The one-hand draws keep their own lines: `drawFpsWeapon`'s quad call and the widget's `getWeaponRect()` draw are
  untouched (MAC-I's tint pins); only a hand of a pair takes the guard and the mirror.
