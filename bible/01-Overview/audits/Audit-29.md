# AUDIT 29 - THE MORROWIND LANE (2026-08-30)

Mac's call: a comprehensive audit on everything so far - the MW-D
player lane as merged on main, D20 through D28, the day the item map
and the derived face landed on top of it.

## Method

One reader over the lane's own claims, three passes: (1) every
commit-message and Testing.md claim located in code and read; (2)
spot-mutations against the load-bearing laws of prior slices, run
against their OWNING suites (S4's first run taught the method:
fparm.test.js alone acquitted a mutation that mwcharacter.test.js
convicts - a spot check that runs one file is a coin toss about where
the pin lives); (3) integration seams walked end to end (the faceIndex
thread, the item map's consumers, the beast flag's producers).
Findings ship with fix + pin in this same commit; verifications are
recorded so nobody re-chases them.

## Findings

**F1 - THE BEAST FLAG HAD NO PRODUCER (severe, latent on every beast
race).** `fpSkeletonPath`/`tpSkeletonPath` switch skeletons on
`beast`, and `playerBodyRows` hides the tail row on `!beast` - and no
production caller ever set it. An Argonian or Khajiit player built on
the HUMAN skeleton (`base_anim`, not `base_animkna`) with the tail
slot silently skipped, and nothing on screen said which. The flag was
in the player's own data the whole time: the RACE record's RADT bit 2,
which mwEsmFile already decodes for NPCs. Fixed at the root:
`raceBeastFlag()` (mwFirstPerson) reads it the WEAP way - targeted
walk, 140-byte size gate, last esm wins per load order - and
`buildFpArm` derives `beast` from the data when the option is absent
(`null` default; an explicit option still overrides, which the
fixtures use). The skeleton now resolves AFTER the data can answer,
which moved rule 18's `correctActorModelPath` below the esm load.
4 pins (reader, override order, size gate, wiring sweep), 4 mutants
dead.

**F2 - D27 OVER-REACHED: the sort was applied to every slot (mine,
same-day).** The face slice's id-sort replaced first-in-file-order for
ALL body slots, silently rewriting the recorded assembleNpc law for
chest, hands, feet. Retail carries one skin record in those slots so
nothing showed - which is exactly how a divergence hides. The sort and
the index are the FACE'S law now and no one else's; every other slot
keeps the reference's own order. The D27 pin itself was asserting the
over-reach back at the code (its chest expectation followed the sort)
and was corrected to assert file order on a shuffled fixture.

**F3 - THE WEAPON FALLBACK FOLLOWED THE ARCHIVE'S LISTING.**
`pickWeaponRecord`'s `ofType[0]` and its material `find` ran in file
order - the same load-is-not-the-character instability D27 closed for
faces. Two archive arrangements handed one character two swords.
Id-sorted now; on retail the alphabetical first is the chitin/iron
commons the old pick usually landed on anyway. 1 pin (two listings,
one sword), 1 mutant dead.

## Verifications (claims re-proven, not taken)

- **S1, D22's byte-eight:** regressing the WPDT read to byte 10 fails
  the struct pin. Holds.
- **S2, D24's sex law:** collapsing the sexed pool fails two pins.
  Holds.
- **S3, D26's fallback speeds:** bending 33.5452 fails the constants
  pin. Holds.
- **S4, D22's first-duplicate-wins:** regressing `byName` to last-wins
  is acquitted by fparm and CONVICTED by mwcharacter rule 16 - the pin
  exists and bites; the lesson is the method note above.
- **The faceIndex thread** (D27) and **the item-map totality** (D28)
  were mutation-proven at ship time today and were not re-run.
- **dfWeaponToMw's table keys** match the `characters/weapons.js`
  WEAPONS spelling at both call sites (the space-keyed
  `enemyEquipment` enum is not a caller - checked, not assumed).
- **mw-inspect's esm constructor** is single-sited, so D28's `armors`
  field reaches every render path.

## Not covered, said plainly

The animation mathematics (D20/21 assembly, D26's calcAnimVelocity
arithmetic) were verified by their own suites' presence and one
constant mutation, not re-derived against animation.cpp this pass; the
rules doc carries their citations. The item map's armor half has its
report and its pins and NO in-game consumer yet - that is the worn-
body slice's job and the D28 record says so.
