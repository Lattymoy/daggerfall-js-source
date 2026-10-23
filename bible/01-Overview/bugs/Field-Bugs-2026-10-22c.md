# FIELD BUGS 2026-10-22c - a readied spell's hands and the hands on the wall, both at once

One thread from the Discord's #bug-reports, handed over as a screenshot with no word beside it: "Spell+Climbing=4 arms"
- Panthyon: "When you hold a spell and dont drop it, climbing will then manifest a second set of arms", with a crop of
the classic lane on a wall: the climb's two fists up on the stone and a readied spell's two casting hands at the bottom
of the screen. Read on main's `c7e5395cc`, against Daggerfall Unity's C# (`EntityEffectManager.Update`,
`WeaponManager.Update`, `FPSSpellCasting`) and the vendored mod's own (`Modded_FPSSpellCasting_Ready.cs`). Named 22c:
main's `Field-Bugs-2026-10-22.md` (DAY-TURN) and `-22b.md` (CREATE-HOME) took 22 and 22b. The pins are
`test/combat/weapon/fb1022c_spellclimb.test.js`, the mutants `tools/mutants/fb1022c_spellclimb.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "When you hold a spell and dont drop it, climbing will then manifest a second set of arms" | Two pictures of the classic lane's hands that never met when each was made: RSH1's readied hands (frame 0 of the element's cast, `05-Combat/Readied-Spellcasting-Hands.md`) and CLIMB-HANDS' fists on the wall (`03-World/Parkour-Arc.md`), each drawn by `weaponRig.js` with no word of the other. A cast on the wall did the same for its length | SPELL-CLIMB |

## SPELL-CLIMB (1) - `src/combat/weapon/weaponRig.js`

FOUND. Reproduced through the real rig before the fix: a readied Fireball, then a hang - every frame from the fists'
first rose with both pairs drawn; a click on the wall, every frame of the cast the same.

WHY NOTHING STOPPED IT. DFU has no such picture. Its climb is `WeaponManager.Update`'s "Do nothing if player paralyzed
or is climbing" - `ShowWeapons(false)` and return - which hides the weapon and nothing else: a readied spell stays readied
on a climb (`EntityEffectManager.Update` reads no climb, so a click there casts it), and `FPSSpellCasting` is its own
component, whose cast plays on the climb's empty screen. The mod's readied hands read no climb either - in DFU there was
nothing beside them. Two of the port's own additions put pictures in that empty screen: RSH1's readied hands (2026-10-11)
draw under the cast hands' own two lane gates and nothing else, and CLIMB-HANDS' fists (2026-10-02) draw "under the same
vetoes the spell's hands take" - their vetoes, not a veto by them. The Morrowind lane never had it: one arm rig, which
CLIMB6 poses on the stone over whatever stance it holds.

THE CALL (the classic lane; DFU named where we leave it):

- **A readied spell yields to the hands on the wall.** Its hands stand down while the fists show
  (`climbHands.showing()`) and come back once they are off the screen, as the mod's own picture comes and goes - at
  once. The spell is not aborted: a click on the wall still casts it, as in DFU. A departure from the mod's
  `AnimateSpellCast`, which raises the hands whatever the body is doing.
- **A cast takes the hands off the stone.** While a cast's hands play (`fpsSpellCasting.isPlayingAnim`, where the
  spell's hands are drawn at all - not under the Beholder's third person, `eotbHidesSpellHands`), the climb law is handed
  no climb and the fists are not drawn; after it they come back up onto the stone on the law's own ease (`POSE.IN_TAU`),
  not popped back whole - AUDIT CLIMB-HANDS's "No pop". DFU's cast plays on its climb; so does ours, and its hands are
  the only ones on the screen while it does.
- **DFU's own climb draws no fists** (`climbRigInput`'s `classic`), so there the readied hands stand on the empty climb
  screen as the mod has them.

The one law under all three: one pair of arms on the screen. The draw's veto is the frame's `spellHandsDrawn`, the
flag the running hands already yield to (TWO-HANDS AUDIT 2).

PINS. `fb1022c_spellclimb.test.js` (4): through the real rig, frame by frame, the readied hands on and off the wall, a
cast on it and the fists' eased return, the Beholder's handless cast leaving the fists on the stone, and DFU's climb.
Pins moved, each marked: `climbhands.test.js` (the law's feed and the draw's line), `auditclimbhands.test.js` (A16),
`rsh1_readiedhands.test.js` (the readied hands' condition). MUTANTS: `tools/mutants/fb1022c_spellclimb.json` (5, all
dead); `tools/mutants/climbhands.json`'s AUDIT-CLIMBHANDS-hands-over-the-weapon re-aimed at the law's feed by content,
and that list re-run whole (68, all dead).

NOT SEEN IN GAME. Checked through the real rig with the climb law's own hands and a synthetic casting archive, not on a
real install.
