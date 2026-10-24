# AUDIT MIXED-PAIR / SPELL-HAND (2026-10-23) - a blade and a gun, a spell beside a weapon, audited

The owner, of MIXED-PAIR and SPELL-HAND (`05-Combat/Two-Hands.md` "A blade and a gun" and "The spell hand"; branch
`ccr-c9890b71-i984g3`, the slice `4728fb88a..617351208`): **"Audit this and ensure perfection"**. This page is the
findings, each with its verdict. What the audit changed is written into the record's sections as they now stand, each
marked AUDIT MIXED-PAIR or AUDIT SPELL-HAND and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 617351208 - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: nothing was fixed while the lanes read), each told to prove a finding - a repro against the
real code, or the code quoted with a concrete trace - before reporting it. Then every finding was reproduced or traced
by the author before it was acted on, and fixed with a pin that fails without the fix and a mutant that proves the pin:

| Lane | Over | How |
|---|---|---|
| L1 - the law, the machines, the balance | `handsLaw.js`, `playerWeapon.js`'s mixed turns, the reloads, the balance table | probes on the real machine and `calculateAttackDamage` in the test's context and the rig's (`swingCtx`), at four Speeds and three frame rates |
| L2 - the sprite lane and the spell hand | `weaponRig.js`'s mixed branch and spell hand, `spellHand.js`, the Weapon Widget, Handheld Torches | the real rig in Node on ARENA2's own CIFs, every screen quad recorded per frame, base against head |
| L3 - the Morrowind arm | `fpArm.js`'s wiring, `spellHandArm.js`, `mixedArm.js`, the pistol stance's `only`, the rig's arm doors | the arm on the fixture and the retail biped, with a retail-like throw's timing |
| L4 - the hosts, the wire, the integration | the four hosts' cast presses, `hostMagic.js`'s doors, touch, the tutorial, the peers | the magic engine and the rig wired as the hosts wire them, base against head |
| L5 - the record, the pins, the process | every sentence the slice wrote, the moved pins, the mutants | the records run whole (116, all dead), 38 scratch mutants of the slice's new lines, the gates |

**What reached a player: nothing** - the branch was unmerged, its pull request not yet opened. On the branch:
- under the Morrowind arm a blade-led pair's gun shot reached the hosts as the blade's blow (L1-1 = L3-1);
- the balance and its one tuning number were measured in a context the game never runs - in the game's own the
  one-handed reload cost the gun nothing (L1-2, L1-3);
- a cast pressed with the swing button held never left, and the hotbar's and CasterOnly's casts played over a blow
  (L4-1, L2-2);
- other players saw a spell-hand player in the Spell stance with no blows, and a blade-and-gun pair holding one weapon
  (L4-2, L4-3);
- the tutorial told players to cast with the swing button (L4-4).

55 findings over five lanes, 54 distinct (L1-1 and L3-1 are one). Every one is fixed or recorded below.

## Findings

### Lane L1 - the law, the machines, the balance

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L1-1 | MAJOR | Under the Morrowind arm a blade-led mixed pair's gun shot, its hit held for the arm's "shoot release", reached the host as the blade's blow: the pistol's frames ended, `strike` was nulled and `activeHand` fell back to the lead blade before the hit was handed | FIXED: `activeHand` is the gun's hand while its hit is held (`_gunStriking`: the shot's mirror or `shotHeld`), and a gun pair's held shot keeps its own hand (`_shotHand`) - the hosts' `isBowWeapon(weapon)` reads the gun; pinned (`mixedpair.test.js` "NOT LOST"), mutants AUDITMS-L1-1-* |
| L1-2 | MAJOR | The balance table and "Why 1.5" were measured with a bare hand's heft (the test's own swing context, no equip); in the game's context (`swingCtx`) the numbers move | FIXED: measured in the rig's own context (`realPair`, `pw.animCtx = () => pw.swingCtx(entity)`) at Speed 10, 50 and 100 and 30, 60 and 144 frames a second; `MIXED.RELOAD` retuned to 2 (below); the table re-measured; mutants MIXEDPAIR-reload-free, AUDITMS-L1-2-reload-free-pace |
| L1-3 | MAJOR | A float edge: at Speed 50 a flurry blade and a full one are exactly 2.1 s, `1.4 x 1.5`, and the reload's `_cool >= cooldownMs` missed it by a float's width at some frame rates - the rate depended on fps, and at 60 the one-handed reload cost nothing | FIXED: `settleReload` ends a reload within `RELOAD_EPS_MS` of its end as the turn is decided; pinned (the balance test's edge leg, and the same rate at 30, 60 and 144 fps), mutants AUDITMS-L1-3-* |
| L1-4 | MINOR | A pull became a phantom blade blow when the gun's hand changed mid-shot (the gun's strike was read off its hand) | FIXED: the shot marks the machine as its mirror (`_shotMirror`) until its 'done'; a swapped pistol's shot is lost whole, a moved gun lands its one shot as a shot; pinned ("TO ITS END"), mutant AUDITMS-L1-4-* |
| L1-5 | MINOR | AUDIT PISTOL-PORT C1 regressed through a mixed pair: the gun's shot, and the gun put by on the blade's turn, wiped a cooldown the Thunderlock owed | FIXED: the mixed mirror and the blade's-turn put-by keep `_classicCooldown`; pinned - the Thunderlock fired again, and the blade beside the gun, each wait out the owed time; mutant AUDITMS-L1-5-mirror-wipes-owed dead, AUDITMS-L1-5-putby-wipes-owed recorded equivalent (the mirror's keep already holds the bound it restates) |
| L1-6 | MINOR | "A blade put away mid-reload loads at the free pace from there" was false: the total changed, the elapsed share did not | FIXED: `_pistolsFor` rescales the loaded share when a reload's length changes; pinned ("THE ONE-HANDED RELOAD"), mutant AUDITMS-L1-6-reload-share-dropped |

**The retune (L1-2)**: in the game's own swing the gun is asked only as the blade's blow ends, so a reload counts in
whole blows. At 1.5 the reload (2.1 s) ended inside the same blade blow as a free hand's (1.4 s): the pair landed 9.35 a
second at Speed 50, x1.31 a longsword pair (7.14), nine tenths of a gun pair's 10.58 on 23 Pellets a minute - the 1.5
changed nothing. At 2 it is a blow more at every Speed: 8.53 (x1.19) with the blade leading, 7.29 with the gun leading,
16 Pellets a minute against the gun pair's 63. `Two-Hands.md` has the table.

### Lane L2 - the sprite lane and the spell hand

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L2-1 | MAJOR | With the Weapon Widget's defaults (Ambidexterity, Recovery Hide) and the weapon in the left hand, the readied hand jumped to the weapon's side on every swing - the side was read only while the clone was `drawing()` | FIXED: the side is the clone's flip whenever the clone has the weapon (`widget.applies()`), through its Hide frames; pinned on the real rig with the Widget on ("THE WEAPON WIDGET"), mutants AUDITMS-L2-1-*, AUDITMS-L5-spellside-widget-unread |
| L2-2 | MAJOR | The hotbar's ready-and-cast and CasterOnly's instant cast played over a blow: the busy word was `up && busy`, and the spell had not been up for a frame | FIXED: the rig tells whether the hands FIT a spell hand (`fits`), and `spellHandBusy` is busy for hands that fit; CasterOnly's instant cast parks as a press (`setPending`); pinned ("THE PRESS KEPT AND MANAGED", "THE BUSY WORD"), mutants AUDITMS-L2-2-* |
| L2-3 | MAJOR | With Handheld Torches on (the default), StowWhenSpellcasting stowed the light the frame a spell was readied, and the spell hand came up a frame later - a two-frame pop, and "a light: DFU's two-handed cast" false | FIXED: a light the torch mod puts away for the spell (`torchStowsForSpell`: Handheld Torches on, StowWhenSpellcasting) leaves the hand to the spell from the first frame - never DFU's two hands for two frames first; a light the mod keeps in the hand is still DFU's two-handed cast; pinned ("A LIGHT PUT AWAY FOR THE SPELL"), mutant AUDITMS-L2-3-torch-stow-unread |
| L2-4 | MINOR | A cast's hand count changed mid-animation (a two-handed cast's spell hand rose as a swap delay ended), and H worked mid-cast where DFU's Update returns before ToggleHand while IsPlayingAnim | FIXED: the cast's hands are decided as it starts (`_castOneHand`, latched in `castSpellAnim` only by a cast that starts); `switchHand` refuses while a cast plays; pinned ("THE CAST'S HANDS ARE ITS OWN"), mutants AUDITMS-L2-4-* |
| L2-5 | MINOR | The readied hand's guard carried into the cast frames: frames 1-4 drawn up to 15 px of 200 below UpdateSpellCast's rect | FIXED: the cast frames stand on UpdateSpellCast's own rect (guard 0 while the cast plays); pinned (frame for frame against an unlowered cast), mutant AUDITMS-L2-5-guard-on-the-cast |

### Lane L3 - the Morrowind arm

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L3-1 | BLOCKER | = L1-1, from the arm's side (a retail-like "shoot release" past 0.5 s) | FIXED with L1-1 |
| L3-2 | MAJOR | A cast pressed during a shot's follow-through (AttackEnd) played no cast on the arm: the door read the arm free, the arm refused the cast | FIXED: `castSpell` cuts the follow-through as the next blow cuts it (`endAttack`); pinned ("THE ARM'S CLOCK"), mutant AUDITMS-L3-2-follow-refuses-the-cast |
| L3-3 | MAJOR | "Z keeps the spell" left the sword in the sheathed hand and the draw played the Spell stance's equip: the stance flipped mid-unequip | FIXED: the spell-hand stance step waits out an equip or an unequip (`spellHandStanceStep` 'wait'); the draw with the spell kept comes up in the weapon's own stance (`drawsIntoSpellHand`); the rig tells the spell hand before the sheathe; pinned ("Z KEEPS THE SPELL ON THE ARM"), mutants AUDITMS-L3-3-* |
| L3-4 | MAJOR | After DFU's two-handed cast a strike started while the arm still cast: only the spell hand read `armCasting` | FIXED: no strike while the arm casts, whatever the hands (`canAttack`, `handsBusy`, `readyWeapon`); pinned, mutant AUDITMS-L3-4-arm-cast-spell-hand-only |
| L3-5 | MAJOR | On the third-person retail body the spell hand's left arm was the layer's carry, not the Spell idle: the body was never told | FIXED: the arm's word carries `spellHand` and the carry leaves the left arm to the clip, as a torch's (`bodyMotion.js`); pinned (`bodymotion_audit.test.js`, and through the live arm), mutants AUDITMS-L3-5-* |
| L3-6 | MAJOR | Under the arm a left-hand gun's shot left from the right blade's tip | FIXED: `weaponMuzzle(hand)` takes the hand's own piece (`muzzlePieceOf`); the rig asks with the striking hand; pinned, mutants AUDITMS-L3-6-* |
| L3-7 | MINOR | A blow cut short by a rebuild or a view switch kept the struck hand's group | FIXED: both reset `blowType` and `attackHand`; pinned ("A BLOW CUT SHORT"), mutant AUDITMS-L3-7-rebuild-keeps-the-blow |
| L3-8 | MINOR | The left hand's blow played at the right weapon's record speed (OpenMW plays the striking weapon's own `mSpeed`, character.cpp:1322) | FIXED: `blowWeaponOf`; pinned, mutants AUDITMS-L3-8-the-rights-pace, AUDITMS-L3-11-striking-always-right |
| L3-9 | MINOR | A weapon swapped mid-cast cut the cast and let the spell go early (OpenMW lets the cast finish, character.cpp:1420) | FIXED: `setWeapon` waits while Casting; pinned, mutant AUDITMS-L3-9-swap-cuts-the-cast |
| L3-10 | MINOR | A Pistolet with the spell hand: the free hand snapped in one frame as the spell hand came up or went down | FIXED: the hold eases the free hand's own weight (`rifleStanceStep` `free`) and the stance places it at that weight (`pistolStanceRequest` `free`); pinned, mutants AUDITMS-L3-10-* |
| L3-11 | MINOR | "Both slices' Morrowind laws live in their modules" was overstated: the spell hand's stance law and the off arm's composition were inline in `createFpArm` | FIXED: `spellHandStanceStep`, `drawsIntoSpellHand` (spellHandArm.js), `offStanceTypeOf`, `gunAimShooting`, `blowWeaponOf`, `muzzlePieceOf` (mixedArm.js); pinned ("THE ARM'S LAWS IN THEIR MODULES"), mutants AUDITMS-L3-11-* |

### Lane L4 - the hosts, the wire, the integration

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L4-1 | MAJOR | A cast pressed with the swing button HELD (WeaponSwingMode 2, the default) never left until the button was let go: each new blow began before the door looked | FIXED: a press waiting stops new blows (`castPending`, read by `canAttack` and the probes' door) - the hands take turns; pinned ("THE HELD SWING NEVER STARVES THE CAST"), mutants AUDITMS-L4-1-* |
| L4-2 | MAJOR | Other players saw a spell-hand player in the Spell stance, weapon out of hand, and none of their blows | FIXED: the peer's body reads the spell hand off the look and the pose (`peerHandsOf`'s `spellHand`) and tells its rig (`setSpellHand` before `readySpell`); pinned (`test/net/mixedspell_peers.test.js`), mutants AUDITMS-L4-2-* |
| L4-3 | MAJOR | Other players saw a blade-and-Pistolet pair holding one weapon, and the wrong weapon struck | FIXED: the pose carries `ah` (a pair's LEFT hand struck last; `poseHandsOf` in `wire.js`, relay **world251**); the peer's body holds a pair (`setHands`, `setOffWeapon`, the right hand's item in the right hand) and plays each strike with its hand; pinned (`mixedspell_peers.test.js`, `disc12.test.js`), mutants AUDITMS-L4-3-* |
| L4-4 | MAJOR | The tutorial named the swing button as the cast's | FIXED: the spellbook page casts with ActivateCenterObject and says the swing button swings beside a spell in the free hand; pinned, mutant AUDITMS-L4-4-tutorial-names-the-swing |
| L4-5 | MINOR | On a wall the swing button was dead with a spell beside a drawn weapon (the spell hand stayed up; the rig refuses a swing on a wall) | FIXED: no spell hand while climbing (DFU's climb hides the weapon, WeaponManager.cs:236-240) - the swing button casts as before; pinned, mutant AUDITMS-L4-5-climb-unread |
| L4-6 | MINOR | A press could outlive its frame and nothing managed it: a new ready inherited it, a door dropped it, a window let it leave beneath | FIXED: a new ready drops the press, AbortSpell drops it, a door hands it over with the spell (`takeReady`'s `pending`), a window holds it (`firePending`'s `held`); pinned, mutants AUDITMS-L4-6-* |
| L4-7 | MINOR | The cast door read a technique's leap or dash as free hands | FIXED: `handsBusy` reads `techniqueFlying`; pinned, mutant AUDITMS-L4-7-leap-unread |
| L4-8 | MINOR | A blade-and-Pistolet pair with no Pellets was silent | FIXED: "You have no pellets." said once as the pull falls to the blade (a latch), never sheathing; pinned ("THE GUN'S PELLETS"), mutants AUDITMS-L4-8-* |
| L4-9 | MINOR | On touch, a spell beside the weapon turned every tap into a cast - the stick's lock-only tap included (an existing defect the spell hand made routine) | FIXED: the lock-only tap is never a cast, in all four hosts (`hasReadySpell` ... `&& !_tapLockOnly`); pinned ("THE FOUR HOSTS RULE") |
| L4-10 | MINOR | The record and the pins called `rig.clickAttack` the touch button; it is the probes' door | FIXED: the record and the code's comment say the probes' door; the touch button reaches the attack latch, and "THE TOUCH BUTTON ON A DRY PAIR" presses it there |
| L4-11 | MINOR | Patch-note sentences not true as built | FIXED in the pull request's `## Patch notes:` (the reload "twice as long" beside a blade; a cast with the swing button held; peers see both hands) |

### Lane L5 - the record, the pins, the process

| # | Sev | Finding | Verdict |
|---|---|---|---|
| L5-1 | MAJOR | `mixedpair.test.js`'s "under the Weapon Widget the gun is drawn" passed with no gun drawn | FIXED: every frame of the run draws exactly one gun (`withGun === 360`); mutant AUDITMS-L5-gun-hidden-under-widget |
| L5-2 | MAJOR | Survivor: the spell hand's side read without the Widget | FIXED with L2-1 |
| L5-3 | MAJOR | Survivor: the Widget clone's guard under the cast unpinned | FIXED: the clone's rect lowers under the cast on the real rig; mutant AUDITMS-L5-widget-clone-unlowered |
| L5-4 | MAJOR | Survivors on the gun's voice during the blade's turn (the close clack lost; the Thunderlock's clip; the close at the free pace) | FIXED: the sound sequence pinned ("THE GUN BESIDE THE BLADE'S TURN"); mutants AUDITMS-L5-voice-*, -pistoletHeld-*, -reload-voice-free-pace |
| L5-5 | MINOR | Survivor: a pair's technique fired a gun with no Pellet | FIXED: pinned (a dry lead gun refuses its technique); mutant AUDITMS-L5-mixedAttack-gunReady-unasked |
| L5-6 | MINOR | Survivors on the holster slide | FIXED: the slide pinned; mutants AUDITMS-L5-gunSliding-*, -mixed-branch-no-slide |
| L5-7 | MINOR | Morrowind-lane survivors (the gun's aim for the blade's swing; the stance re-composed every frame; the arm's reload pump; the off arm's idle under a blow) | FIXED: pinned on the live arm (under the right blade's blow the aim stays down and the left arm keeps its own weapon's idle) and on the rig (no pump over the arm); mutants AUDITMS-L5-rifle-aim-for-the-blade, -offclip-right-idle-under-blow, -share-mixed-pumps, AUDITMS-L3-11-stance-always-drop |
| L5-8 | MINOR | Survivors in corners (the frame gate with every mod off; the classic machine on the gun's type at rest; a pair's law on a one-handed player; the spell hand under the swap delay) | FIXED: each pinned; of the lane's unproven survivors four were reachable and are pinned too - the machine itself waits out a held shot (not only the rig's door), a shot's hit held past the arm's blow (a `.kf` with no "shoot release", NEVER-TRAPS) keeps a cast waiting, a `.kf` with no "shoot start" leaves the arm in the blade's group, a held map sheet takes the spell hand's arm - and the pair's blade slides down on a wall; four are equivalent, each recorded with its reason (`tools/mutants/audit_mixedspell.json`: the pistol leg of the spell hand's side, an unmapped strike, a dead arm's composition, the cast latch's want) |
| L5-9 | MINOR | Moved pins loosened past their notes (`[^\n]*` taking any guard, optional lines) | FIXED: each pins the full new text - the guard's transform, the `castHands` call, the strike's hand |
| L5-10 | MINOR | Vacuous asserts in `spellhand.test.js` (the beast's line a copy of the fists'; "the swing button the cast's" never pressed) | FIXED: the beast's copy removed and said why (MorphSelf empties both hand slots: the fists' line is the beast's); the swing button pressed, and it never swings |
| L5-11 | MINOR | `Active-Arcs.md`'s counts stale | FIXED: the counts as they stand |
| L5-12 | MINOR | `Port-Ledger.md`'s TWO-HANDS row counts stale, "its own row" false | FIXED: the counts; MIXED-PAIR and SPELL-HAND named inside TWO-HANDS |
| L5-13 | MINOR | The balance numbers did not reproduce to two places | FIXED: re-measured in the game's context (L1-2) |
| L5-14 | MINOR | "No host grows" false by the ceiling's own measure (+1, +2, +1, +1) | FIXED: every host at or under main's count - the cast's press an imported word (`CAST_PRESS`) and the pose's hands one spread (`poseHandsOf`), positional arguments for the dungeon's door |
| L5-15 | MINOR | HOST-SPLIT: `createFpArm` grew by behaviour, not only wiring | FIXED with L3-11 |
| L5-16 | MINOR | Stale sentences in `Dwarven-Pistolet.md` and `Audit-Pistolet.md` | FIXED: the pair's law and the lone pistol's side narrowed; "Still open: the mixed pair" annotated |
| L5-17 | MINOR | `Weapon-Widget.md` untouched: the gun clone's still machine, the guard's transform, the spell hand's side | FIXED: the page says so |
| L5-18 | MINOR | "`fb1009g_bowclock` (two)" was one record | FIXED |
| L5-19 | MINOR | THE FOUR HOSTS RULE: `dungeonContext.js`'s door unnamed | FIXED: named |
| L5-20 | MINOR | Port-Doctrine's "Name the departure": departure 7 cited no DFU member; H working while a spell is readied unnamed | FIXED: both named (`Two-Hands.md` departures 7 and 9) |
| L5-21 | MINOR | Code comments: `fpArm.js`'s import comment moved; `gunHoldOf`'s doc wrong for one gun | FIXED |
| L5-22 | MINOR | No pull request, and the branch conflicted with main | FIXED: main merged (Active-Arcs both sides kept); the pull request is the owner's to ask for |

## Found after the lanes

- **THE FOUR HOSTS, broken by the fixes themselves**: the first cut of L5-14 had the hosts import `CAST_PRESS` and
  `poseHandsOf` from `combat/twoHands/` - `twohands.test.js`'s "the rig is the one surface" failed in the whole suite.
  FIXED: `hostMagic.js` hands `CAST_PRESS` on (the magic door the hosts already import) and `poseHandsOf` is the wire's
  (`net/wire.js`, beside `validPose` - the pose's own law); no host reads a two-hands module.
- **The balance test's free-hand comparison** set the reload's length after `_pistolsFor` rescaled it (L1-6), so the
  free hand's count was inflated by a share doubling each frame. FIXED: the comparison rescales as the machine does.
- **The pair's gun hung on a wall**: climbing, the blade slid out of the view (CLIMB4) while the gun stood at rest the
  whole slide and then vanished - the early return that hides a gun halfway reads the RIGHT hand's gun. FIXED: the mixed
  branch draws its gun only while the climb's lowering is under half, as a lone gun; pinned ("ON A WALL", against a lone
  Pistolet frame for frame), mutant AUDITMS-L5-wall-gun-hung.
- **ONE HOME and the catalog** (the whole suite): the arm's `strikingWeaponOf` named a different function than
  `combatStats.js`'s (audit24's one-home gate) - renamed `blowWeaponOf`; and L4-8's line (`combat.noPellets`) is a new
  catalog key: the English catalog regenerated (`tools/l10nExtract.mjs`) and the thirteen whole languages' drafts merged
  in-session (`tools/l10nInSession.mjs`, recorded as the machine's).
- **H mid-cast's pin** pressed H while the blow still played, so the machine's own gate refused it; it waits for the blow
  now, and the cast is what refuses (mutant AUDITMS-L2-4-h-mid-cast).

## What stands

- Pins: `test/combat/mixedpair.test.js` (20), `test/combat/spellhand.test.js` (19), `test/combat/spellhand_mw.test.js`
  (13), `test/net/mixedspell_peers.test.js` (3, new), `test/characters/bodyMotion/bodymotion_audit.test.js`'s L3-5.
- `tools/mutants/audit_mixedspell.json`: 101 mutants - each fix reverted (64) and the record lane's scratch mutants of
  the slice's new lines re-aimed (36), and the wall's gun (1). Run whole with the slice's own records
  (`mixedpair.json` 35, `spellhand.json` 35, `spellhand_mw.json` 22) at 42fdce1b2: 193 mutants, 188 dead, 5 equivalent
  as recorded (each with its reason), 0 survived, none judged in place. Every record the fixes moved re-aimed by
  content and re-run, all dead.
- PIN MOVED, each with its note: `fieldgunmwaudit` (the muzzle names its hand), `riflestance` (the state's `free`),
  `audit23_magic` magic-14 and `allycast` A1 (CasterOnly's instant cast waits for a blow), `auditclimbarc` F10/F11 (the dungeon's `firePending` hears the window), `disc12`, `mac7`, `fparm`, `audit39_worldstate`,
  `deckfield`, `tech1_hosts`, `hostmagic_wiring`, `weaponglow1`, `audit29_host`, and the relay's version pins (world251).
- To deploy: the relay (**world251**: `ah` - world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS' world249 and
  HERALD-CARDS' world250 at the merge with main). An older relay strips the field and the socket stays open - its peers play
  every strike of a pair with the right hand's weapon, as before.

## Outside the slice

- The whole suite (33,473 tests, in series) on the audit's checkpoint: 14 failures - ten this audit's own moves, each
  fixed and listed above; and `IT1`, `WD1` (the gate and vendored patches rebuilt from ARENA2, sha256 for sha256) and
  `CRATE-FREE` (every RDB block of BLOCKS.BSA) fail identically on `main` here (42be22389): the environment's archives,
  not this slice's; `TECHFX1` (a frame's garbage, measured in a child process) failed once under the suite's load and
  passes alone, at the head as at the checkpoint.

## Still open

- **The spell hand on the Beholder's sprite body** (EOTB), as `Two-Hands.md` "Not carried" says.
