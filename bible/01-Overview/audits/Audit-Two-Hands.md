# AUDIT TWO-HANDS (2026-10-16) - both fists, a pair of weapons and the running hands, audited

Mac, of the branch that brought TWO-HANDS (`05-Combat/Two-Hands.md`): **"I also want to do a comprehensive audit on
this"**, then, of the first pictures, **"why are the running hands at the top of the screen. Why arent you probing
this"**. This page is the findings, each with its verdict. What the audit changed is written into Two-Hands.md's
sections as they now stand, each change marked AUDIT.

## How it was run

Five cold lanes, each an adversarial reader of the slice (e4ded083, under the merge 89912af3), each told to prove a
finding by running it before reporting it; then every finding reproduced again by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| L1 - the law and the balance | `handsLaw.js`, `playerWeapon.js`, the swing, the formula, every blow between players | the real machine at 30/60/144/1000 fps, the real formula over 200k seeded rolls, the real rig, a seeded base-against-head comparison of every one-hand way of fighting |
| L2 - the sprite lane | `twoHands.js`, the Weapon Widget's clones, the running hands, `weaponRig.js`'s seam | the real rig with every mod switch in hand, the retail `WEAPON10.CIF` |
| L3 - the Morrowind lane | `mirrorRig.js`, `fpArm.js`, `mwFirstPerson.js` | the retail biped (`xbase_anim_sh.nif`) and the fixture arm, measured bone by bone |
| L4 - the integration | the hosts, the HUD, techniques, the tutorial, the lights, the wire, save and load | a base-against-head differential of 13 single-hand scenarios, with and without the Weapon Widget |
| L5 - the record, the pins and the process | Two-Hands.md, the Ledger row, the Testing rows, the mutants, the gates | scratch mutants of the slice's claims against its suites; the committed list re-run seven times |

And the owner's own (O1): the first pictures were drawn on the test suite's synthetic fist art, which stood the
running hands high; drawn again on the shipped `WEAPON10.CIF` (DFU's freeware game files, `tools/fetch-data.sh`) their
top edge is at least 60% down the view - and the probe found the painted arm below, which the stand-in art could not
show.

No lane found a one-hand way of fighting changed: a weapon, a weapon and a shield, a two-hander, a bow, the left hand
alone and the bare hand under H match the base exactly (L1's six hashes, L4's 13 scenarios). The findings are a balance
that held on paper and not in the machine, an off hand whose costs a key press or a blow between players skipped, a
share cut after the blow was reported, a sprite that drew the wrong arm, a run that held the screen after it ended, a
Morrowind pair that never drew its second weapon on the game's own skeletons, and pins that held less than they said.

Severity: **Blocker** breaks the feature or its balance for everyone; **Major** a wrong outcome many will meet;
**Minor** a cost, a corner or a word.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| O1 | BLOCKER | `WEAPON10.CIF` paints the bare hand's StrikeDown, StrikeLeft and StrikeUp on the LEFT arm; the slice mirrored every left-hand picture, so a left StrikeDown drew a second right fist and a right StrikeDown a left arm | FIXED: the painted arm (`MELEE_PAINTED_ARM`, `strikePicture`): a hand's picture chosen so the arm drawn is the hand that throws, on its side, by one mirror rule every draw shares |
| L1 1 / L4 1 | BLOCKER | Every blow between players (duel, siege, siege work, Royal Tourney, the open zone, the dungeon's) skipped the off hand's to-hit and share: a pair was plain extra blows, +17-33% a second | FIXED: `resolveDuelStrike`'s `off`, handed by every arm from the striking rig's `offStrike`; measured equal to the blow against a foe |
| L1 2 | BLOCKER | H between blows kept the exchange running: every blow a flurry's quickness thrown by the new lead, with no off-hand cost - x1.2 damage for a key press | FIXED: H ends the exchange (`toggleHand`) |
| L1 4 / L5 2, 3 | MAJOR | The balance's numbers held in closed form and not in the machine, which steps whole ticks: the pair x0.97 at 30 fps, x1.09 at 1000; at high Speed a loss; "the dagger is the off hand's natural blade" false | FIXED: a flurry starts at frame 1 (`FLURRY_FROM_FRAME`), the same at every frame rate; the share 0.8, the to-hit -5 by Agility in [-10, 0]; MEASURED through the machine in the pins; the record restated from the measurements |
| L1 3 | MAJOR | The off hand's share was cut after the formula had reported the whole roll: the HUD's number, a leech, an echo, Ruhn's Cleave, the feud ledger and the wear saw a blow a third larger than landed | FIXED: the share inside the formula (`calculateAttackDamage`'s `blowShare`), ahead of the wear and the report. OPEN: TECH1's `scaleBlowDamage` scales after the report the same way - older than this branch, its own fix |
| L1 5 / L2 8 / L4 5 | MAJOR | A lit torch took the left hand with Handheld Torches off, where no lane draws it: no second fist, no running hands, the pair back to one hand in every dungeon | FIXED: a light takes a hand only where a lane draws it there (`lightInHand`) |
| L2 1 | MAJOR | The left Weapon Widget clone stuck in its wind-up when the pair dissolved mid-blow (a torch lit, a quickslot): the left fist pushed off the screen until its next strike, which played the stale one | FIXED: the wind-up ends with the strike it shadows (`weaponWidget.js`) |
| L2 2 / L4 3 / L5 1 | MAJOR | The running fists held the draw seam about 1.1 s after something took the hands (a torch, a spell, a weapon): the torch and the weapon not drawn, the fists under the spell's hands | FIXED: a taken hand ends the run at once (`taken`); the ease plays only when the run ends with the hands still empty |
| L2 3 / L4 2 | MAJOR | The running hands never appeared with the Weapon Widget, Handheld Torches and Shield Widget off: the eye the ground speed is read from was tracked only under those mods | FIXED: the eye tracked every frame, above the mods' gate |
| L2 4 | MAJOR | With the Weapon Widget on, the left hand took the widget's Bob and Inertia sway in the mirror: the hands breathed apart walking and spread on a turn | FIXED: the mirrored hand's rect carries the sway in its own screen direction (`pairRect`) - the mod's own rule for a mirrored sprite |
| L2 5 | MAJOR | A punch thrown on the run was hidden for about 0.27 s | FIXED: the striking hand drawn by the pair over the running fists, from the punch's first frame |
| L3 1 | BLOCKER | On the game's own skeletons (no Weapon Bone Left) the Morrowind pair showed one weapon and the left hand never swung | FIXED: a Weapon Bone Left made by the mirror from the skeleton's own Weapon Bone (`offWeaponBoneAddon`) on every body; the composition stands on the pair being held, not on the blade being bound |
| L3 2 | MAJOR | An arm placed from another pose left the torso | FIXED: the mirror law in each bone's own frame, every arm's locals hung from this frame's parent - a twisted chest's shoulder 9.07 units off, now 0.00; and the first law's own slide (a mirrored knee, a shoulder 0.52 units, a finger 10% off its bone) gone with it |
| L3 3 | MAJOR | The carry that prevents pops eased every bone apart in absolute space: joints left their bones mid-carry | FIXED: carried per bone in its own frame - worst bone mid-carry 71% off its length, now 0.0%; the Shield Bone stays on its hand |
| L3 4 | MAJOR | The running hands jumped at the edges of a climb and when the map was raised | FIXED: the run solved under the climb in a slot of its own - onto the wall 1.19 -> 0.52 (the climb's own ease), a sheet up 1.05 -> 0.005 |
| L3 5 | MAJOR | A left-hand slash swept the opposite way to the one asked for | FIXED: a mirrored blow plays the mirror strike's backhand - the left hand's StrikeLeft the right's StrikeRight in the glass, frame for frame |
| L2 6 | MINOR | After the hands stopped being two mid-strike (a quickslot), the hand in use stayed the striking hand's: a bare fist drawn and struck while a katana was held | FIXED: `activeHand` the striking hand's only while the hands are two |
| L2 7 | MINOR | The pump kept its own clock, out of step with the head bob | FIXED: the stride on the HeadBobber's own timer (`runPhaseOfBob`, the motion bag's `bobTimer`) |
| L2 9 | MINOR | H with a pair up billed BowLeftHandWithSwitching's switch delay, a swap's, where nothing changes hands | FIXED: no bill with both hands up |
| L2 10 | MINOR | The left clone was stepped every frame of single-hand play, never drawn | FIXED: stepped while a pair is up or until it has settled hidden |
| L3 6-11 | MINOR | A view's arms starting stale; the pair's draw unmirrored where its sheathe is; the portrait's left blade by the view it was opened from; a failed left swap refused forever; a full mirror pass a frame; the running hands sliding with the look with follow-camera off | FIXED, each: a fresh carry takes its composition at once and a view switch resets it; the pair composed from the draw's first frame; the portrait shows the pair from either view; the failed swap tried again; no whole-skeleton matrices a frame (0.101 -> 0.011 ms, 302 -> 109 collections over 20k frames); the run laid on the pitched lens (0.40 -> 0.033 rad, the rest a fixture's unreachable targets) |
| L4 4 | MINOR | The enhanced HUD's hand plaque and a technique's weapon flipped to the off hand's item on its every blow (an aim cancelled) | FIXED: `restingWeapon` - the lead's - in all four hosts and the technique |
| L4 6 | MINOR | "A pair never meets a light" was false under Handheld Torches' RelaxedLanterns | FIXED: the record says when it does |
| L4 7 | MINOR | The Fighting tutorial still taught H as a swap | FIXED: "Two weapons or two fists both fight; H picks the lead" |
| L5 4 | MAJOR | A committed mutant was dead in 5 runs of 7: the classic test's strikes were random, and two of six click directions are their own mirror | FIXED: the suite's strikes seeded |
| L5 5 | MAJOR | The Weapon Widget lane, on by default, was pinned on which quads were mirrored, never on where they were drawn | FIXED: the arm each clone draws, its side and its sway pinned |
| L5 6-8 | MINOR | "1.2e-4" given as the pin (it is the measurement); the flurry window "half again" SWING_FRAME_MAX (it is nearly twice); the to-hit's wording against its rounding | FIXED in the record and the comments |
| L5 9 | MINOR | The slice rewrote numbers in two dated records no gate asked it to | FIXED: their numbers restored |
| L5 10, 11 | MINOR | Titles that claimed pins their assertions did not make; 13 documented behaviours no pin could fail (the stroke toward the middle, the grow, below the view, a spell, a swap, the beast, a waist lantern, a walk's bounce, the pair under the run, a fist and a shield, ...) | FIXED: each asserted, its scratch mutant re-run dead; the MW titles with L3 |

### Suspected, not reproduced

- A blow carried past its strike's end (a guard spawned on a cold load) resolves with the lead's terms: the same as
  any blow resolved at rest; not reproduced.
- A levitating player whose feet rest on a floor may read grounded and run the hands; not reproduced.
- Custom or Diverse Weapons fist textures: the run draws the classic frame; no custom texture was at hand.
- Two-Hands has no Features switch: it changes no one-hand way of fighting, and a pair is a choice the player makes by
  equipping two weapons. Left to the owner.

## Pinned

`test/combat/twohands.test.js` (21 - AUDIT 2, L5 m7: this read 20 after the WEAPON-GLOW1 merge added one) - every FIXED finding of L1, L2, L4 and L5 above, by execution through the real machine,
formula, rig and Weapon Widget; `test/combat/twohands_mw.test.js` (23) - L3's, on the retail biped and the fixture arm, with
`tools/mutants/twohands_mw.json` (40, dead) and the twelve `twohands.json` records aimed into the Morrowind lane
re-run on its fixed code. Mutants: `tools/mutants/twohands.json` (122, 39 of them the audit's `TWOHANDS-AUDIT-*`: each
fix reverted, and L5's 16 scratch mutants of the record's claims, three of which still lived after the first fixes -
the sheathed run from below, the pair on the climb, one hand's H line - until pinned), every one dead. PIN MOVED
(AUDIT): `a12_lefthand` (the bow-switch arm on a bow in the left hand), `audit_seats_client` G5, `auditcc_pvp` H5 and
`duel_combat` DUEL1 (the off hand's terms between players), `enhancedHud` AUDIT 39 (the plaque reads the resting
weapon), `ww2_idlebob` WW2 (the motion bag's `bobTimer`); for L3, `climb6`, `fparm`, `reversedSwing`,
`fb1012b_headheld` and `ws1_sheathing`. Records re-aimed where the fixes moved their lines, each re-run:
`auditcc_pvp.json` (four), `climb4.json`, `duel.json`, and six of `twohands.json`'s own. Two `twohands.json` records
whose source L3 rewrote (`TWOHANDS-mirror-one-reflection`, `TWOHANDS-arm-off-weapon-any-node`) moved to
`twohands_mw.json`, re-aimed.

## Round 2 (2026-10-16, Mac: "Can we do a comprehensive audit and ensure perfect. Also how is this balanced to not be overpowered?")

Five cold lanes again, on the merged head the first round left (3e5a8ca9, main's WEAPON-GLOW1 in it), each an
adversarial reader told to prove a finding by running it: L1 the law and the balance (the real machine at 30/60/144/1000
fps and the real formula, mods off and at their shipped defaults, 600 s full-loop sims of fatigue, skill tallies, wear
and procs); L2 the sprite lane over the shipped ARENA2 art (every texture's alpha kept, every drawn quad's opaque edge
texels tested against the view, 100 pairs in four modes, every screen shape); L3 the Morrowind lane on the retail biped
and a first-person arm built on it; L4 the integration (37 single-hand scenarios x 1100 frames through a real rig on
base, main and head; 1653 test files on the head); L5 the record, the pins and the process (each suite 23 times, scratch
mutants of the record's claims). What it changed is written into Two-Hands.md, each change marked AUDIT 2.

| Finding | Severity | What | Verdict |
|---|---|---|---|
| L1 B1 / L4 M1 / L5 M1 | BLOCKER | The streamed world's dungeon - the only live dungeon path - handed an off-hand blow on a fair player through `worldModes.js`'s `wildStrike: (id, w, sw) =>`, which dropped `{ off }`: every such blow landed whole (x1.53). The first round's pin read the dungeon's call and the host's door, never the relay between | FIXED: the relay hands it on; pinned by running the three arrows' own source, chained |
| L1 M2 / L5 m3 | MAJOR | The off hand's burden was still a factor on its tick (`ctx.tempo`), which the machine rounds to a whole frame differently at every frame rate: a battle-axe pair x1.11 as often as one axe at 30 fps and x1.20 at 1000, a longsword pair's damage x0.96-1.05. "About 9% at any frame rate" held only for light pairs | FIXED: the burden is whole ticks held on the off hand's last frame after its hit, the fraction carried (`offHandHold`, `m.hold`); measured, a longsword pair x1.034-1.041 at 30-1000 fps, a dagger pair x1.078-1.088; pinned at four frame rates |
| L1 M1 | MAJOR | Everything a blow sets off at its own rate came a quarter faster with the pair's blows while its damage came 9%: Cast When Strikes x1.17-1.25 a second, Potent Vs' flat five, Conduit's mana, Flow's and the Undertow's stacks, the Serpent's Coil | FIXED: the off hand's blow is 0.8 of a blow (`OFF_HAND_BLOW.blowWeight`): one roll gates its Strikes payloads and tells the strike listeners (`info.blow`), whose per-blow charges take only a whole blow |
| L1 m3 | MINOR | A swing's skill tally came a quarter faster too (x1.25 a second) | FIXED: an off-hand swing tallies 0.8 of a use, carried (`tallySwingSkills`' weight, every melee tally a host makes): x1.07-1.12 a second, the same per kill |
| L1 m2 / L5 M2 | MAJOR | Under PCAAO's core - on by default, every blow's - the gear wore by the whole roll (194 of 194 landed blows) while the HUD showed the share: the share was laid after the core had worn the gear | FIXED: the share is handed into the core, which lays it ahead of its own wear and says so (`notes.shared`); pinned at the shipped defaults |
| L1 m1 | MINOR | Two predicates for "the off hand's blow" (`offStrike` and `resolveHit`'s own) | FIXED: one, `offStrike` |
| L1 m4, m5 | MINOR | "No swing quicker than SWING-LAW's floor" read as five ticks (a flurry's blow is four); the balance's ranges unqualified by build | FIXED: the record restated |
| L2 F1 | MAJOR | A flurry's blow began with its hand still lowered by the guard it was easing out of: blades, mace heads and flail balls DFU runs off the top sliced flat up to 57 px down the view on every second blow (370 exposures over 100 pairs with the Weapon Widget, 200 without) | FIXED: the guard never moves a striking picture; 0 exposures |
| L2 F2 | MAJOR | The first round's "both hands sway as one body" turned the Weapon Widget's Bob about with Inertia, and Bob is the mod's one-way swing: the left hand's cut outer side came up to 38 px into the view on 225 of 240 walking frames (the mod's own left-handed weapon: none) | FIXED: two rules - Bob outward (the left the right's exact mirror), Inertia in the screen's direction; 0.0 px |
| L2 F3 | MAJOR | The left clone, resting through single-hand play, woke on its own clock seconds behind the right's: the hands bobbed up to 38 px out of step | FIXED: it keeps the right clone's clock (`clockOf`); 0 px |
| L2 F4 | MAJOR | The fists' guard bounce, a sine about the rest, lifted each cut wrist off the view's bottom edge on 166 of 360 standing frames (4.8 px at 600 tall, 11.5 at 1440) | FIXED: the bounce only lowers; 0 of 360 |
| L2 F5 / L3 M3 | MAJOR | A stop of a frame or a few on the run (the head bob resets its timer to PI when movement resumes within 0.5 s) swapped the arms in one frame, up to 227 px of 600 - on both lanes | FIXED: the stride follows the bob's phase with a bounded catch-up (`runPhaseFollow`), one law for both lanes |
| L2 F6 | MAJOR | With the Weapon Widget a punch thrown on the run turned the running arm into the fists' rest in sight, which sank; the punch frames 0.4 s later | FIXED: its clone winds up from below the view (`fromBelow`) |
| L2 F7 | MINOR | A jump on the run swapped arms, fists, fists, arms in under a second | FIXED: the run kept through a hop of up to 0.6 s (`runHandsKept`), both lanes |
| L2 F8 | MINOR | With nothing taking the hands' place (a spell readied with its hands off, a swap's pause) the arms vanished in a frame - the first round's "a hand taken ends the run at once" | FIXED: the run eases out, and yields at once only to a picture that takes the hands (`runDrawn`) |
| L3 M1 | MINOR | The made Weapon Bone Left mirrored the Weapon Bone at the skeleton's REST, which retail stands asymmetric (the hands 1.09 units off each other's mirror): the left grip sat 1.4 units off and 2.8 degrees turned in the left fist | FIXED: mirrored hand to hand in the frame the skeleton file's own skin binds them (`skinHandMirror`, the never-drawn Tri Shadow), the rest's rotation where none does; the right's mirror to about 1e-9 |
| L3 M2 | MINOR | The guard kept turning down a hand that held the map sheet (112 frames under a sheet raised mid-blow), a spell's hands or the stone | FIXED: no guard while something else has the hands (`handsTaken`), the dip eased off the arm |
| L3 M4 | MINOR | The 3D pair's dip was sized by the fists' 9 px, which the sprite lane had given up on a weapon | FIXED: `GUARD.LOWER` of the blade's own height on the picture (0.0519 -> 0.0898 rad on the fixture) |
| L3 M5 | MINOR | Every NPC and peer build paid ~1.3 ms for a mirror plan and a guard it never used | FIXED: two bone names read (0.73 -> 0.05 ms); the guard measured at a pair's first guard, once per blade |
| L3 M6 | MINOR | An armour-change rebuild dropped the left blade until the archives reopened (23 frames at a 600 ms reopen); the rig's record of it was dead | FIXED: the build binds the recorded left weapon on both rigs; 0 frames |
| L3 suspected | MINOR | A blade's particle effect showed under a sheet or on the stone; a blade's glow on the stone | FIXED, both confirmed - the right blade's too |
| L4 m1 | MINOR | The enhanced pack handed the Morrowind figure its own one-hand read: a left-led pair held the left weapon in both hands while the window was up, a pair made in it showed on close | FIXED: one door for the arm's hands (`handArm`), asked by the frame and the pack |
| L4 m2 | MINOR | A transformed lycanthrope's H re-applied without the claws: the fists' mode and the pair's lead line, where main says DFU's | FIXED: H re-applies the racial arm first (ApplyWeapon's order) |
| L4 m4 | MINOR | The Fighting tutorial's new point dropped what H does with one weapon | FIXED: "H swaps hands, or picks the lead when both hands fight" |
| L4 m5 | MINOR | The left clone was born in view and stepped at every boot, fetching the left hand's art for a single weapon | FIXED: born at rest out of sight (`hidden`); standing at its place when shown on its first frame |
| L5 m1, m2 | MINOR | Documented behaviours no pin could fail (the pair's clone and Handedness, the left clone's stepping, the bounce in a strike, the off hand's live Agility both ways, head bobbing off, GUARD's and RUN_PUMP's numbers, ...) | FIXED: a driven pin and a mutant each |
| L5 m4-m8, NITs | MINOR | Patch notes promising pairs the item table cannot make (flails, warhammers and battle axes take both hands); a stale Active-Arcs line and test count; two dated cites rewritten that no gate asked for; a mutant's stale name; units and counts | FIXED: restated, the two cites restored, the mutant renamed |

### The owner's call

- **No Features switch (L4 m3).** All off's promise is "Every mod and enhancement goes to Off": a pair is a choice made
  by equipping two weapons (the precedent of a row-less feature, Eltheric-Ocean.md), but both fists up and the running
  hands change bare-handed play for everyone and stay on under All off. Put to the owner, who answered **"Leave them
  on"** (Mac, 2026-10-16): Two-Hands has no Features row, and All off leaves both fists and the running hands up - a
  declared departure from All off's word (Two-Hands.md "Departures").

### Pinned (round 2)

`test/combat/twohands.test.js` (23) - every FIXED finding of L1, L2, L4 and L5 above by execution (the balance at four frame
rates through the real machine; the formula's weight, PCAAO at its shipped defaults; the relay's own source; the real
rig and Weapon Widget for the sprite lane), with the loot and set suites' per-blow charges (`loot5_powers`,
`gilded2_world`, `audit625_serpent`). Mutants: `tools/mutants/twohands.json` (172: 33 `TWOHANDS-AUDIT2-*` and 19
`TWOHANDS-SPRITE2-*`, and 13 of L3's for the shared run law and RUN_PUMP), every one dead; `test/combat/twohands_mw.test.js`
(29) - L3's six and its two suspected gaps, with `tools/mutants/twohands_mw.json` (70, every one dead). Three records
retired with the code they guarded (`TWOHANDS-tempo-unbounded` and `-ctx-no-tempo`: the tick carries no factor;
`TWOHANDS-AUDIT-run-not-taken`: the run yields rather than snaps), each law's successor pinned. Records of other features
the change moved, re-aimed by content and re-run: `loot5.json` (two), `rvn1.json`, `serpentset.json`, `set2.json`,
`set3.json`, `wearvanilla.json` (three). PIN MOVED (AUDIT 2): `twohands_mw` (the made bone, the guard, the run's phase,
the lens), `mwcast1` (a weapon's effects), `mwload_fparm` and `arrowPick` (the build's blade bind), `audit18_hosts_dungeon`, `interiorfoes`, `duel_combat` (the
tally's weight), `set2_seams` (the core handed the share), `auditrr` (the swing's ctx carries no factor),
`wear_vanilla` (PCAAO's wear through the share), `mwattach`, `mwtorch`, `werewolf1` (the arm's hands through `handArm`).

