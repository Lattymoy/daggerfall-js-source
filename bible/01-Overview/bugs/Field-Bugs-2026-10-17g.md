# FIELD BUGS 2026-10-17g - Disintegrate and your own revenant

> Renumbered at three merges of main: #996's ORRERY-HEIGHT took `Field-Bugs-2026-10-17c.md`, #992's CURSE-CARRY
> `Field-Bugs-2026-10-17d.md`, ORRERY-SIGHT `Field-Bugs-2026-10-17e.md` and #1005's KEY-LIFT and GROUND-GATE
> `Field-Bugs-2026-10-17f.md` first; the test and the mutant record were renamed with it (`fb1017g_`).

One report from the Discord's #general, handed over as a screenshot, read on the code as it stands at main's `cb4b88484`.
Revenants are the port's own (Daggerfall Unity has none); DFU's Disintegrate (`Disintegrate.cs:44-53`,
`SetHealth(0)`) is unchanged for every other foe. The fix departs from RVN-OWNERS-CHOICE's own rule
(`Field-Bugs-2026-10-16b.md`: "Your own Disintegrate still finishes your own").

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Dude7ox: "Disintegrate just outright kills your rev with no option to hire" - the card "REVENANT SLAIN - Skulthor, Psytha's Shadow - Rank 9 - Vampire - Elite ... Has fallen. Your revenant is no more."; the owner: "Hmm thought I fixed this. Ill look into it" | RVN-OWNERS-CHOICE took the delete away from everyone else's Disintegrate and kept it, on purpose, for the owner's own: the player's whole blow passed over the last stand, the will AND the kneel, to the death arm and `revenantSlain` | fixed (RVN-OWN-KNEEL) |

## RVN-OWN-KNEEL: no blow skips the kill-or-spare

`src/systems/revenant/revenantFate.js` ownersWholeKill (its law unchanged, its word); `src/scenes/exteriorFoes.js`
damageFoe; `src/scenes/dungeonContext.js` damageFoe.

THE REPORT. #general, 2026-10-17, Dude7ox: "ight. Fun fact / Disintegrate just outright kills your rev with no option to
hire", then "feck". The screenshot: the REVENANT SLAIN card for Skulthor, Psytha's Shadow (rank 9, a vampire, Elite),
its last words "At least... I had the last word... didn't I?", "Has fallen. Your revenant is no more.", and its body,
"Skulthor, Psytha's Shadow (dead)", open on its loot. "Hire" is SPARE: a spared revenant is sworn to the player as a
companion (`06-Systems/Revenants.md` section 13).

FOUND. A Disintegrate is a whole blow (`effects.js:"sinks.hurt(left, { whole: true });"`). RVN-OWNERS-CHOICE
(2026-10-16) made anyone else's whole blow a killing blow like any, and kept the owner's own as a kill - its record says
so ("The owner's own Disintegrate and Razor still kill outright"): `ownersWholeKill` answered true for the player's own
whole blow, and both doors' last-stand gate and yield gate passed it straight to the death arm and `revenantSlain`, the
card in the screenshot. At rank 9 the fight had a last stand to make and a will to break; the Disintegrate passed both,
and the kneel with them. Reproduced on `cb4b88484`: the new pins (below) are red on the unfixed doors - the owner's
Disintegrate on the real street pool closed the record at rank 1 and at rank 3, and the dungeon's door returned `dies`.

CHANGED (the owner: "Hmm thought I fixed this"; the reporter: "no option to hire"):
- The owner's own whole blow - a Disintegrate, Mehrunes' Razor's whole-health strike - still passes over the last stand
  and the will, the Disintegrate's recorded edge (`06-Systems/Revenants.md` 19, 20; `12-Enhanced-AI/Feud-Arc.md` 14.2,
  15.1), and now stops at the kneel: alive at 1, its record open, KILL or SPARE offered. Both doors' yield gate asks
  `ownersWholeKill` of the will alone (`exteriorFoes.js:"if (fates && revenantMayYield(f)) {"`,
  `dungeonContext.js:"if (opts.fates && (!onlineRoom() || !isRoomFoe(foe)) && revenantMayYield(foe)) {"`). KILL is the
  execution, its trophy in the pile and its record closed as executed; SPARE swears it.
- Unchanged: anyone else's whole blow (a party member's `z`, a foe's, a companion's, a stat drained to zero) is a killing
  blow like any - the stand, then, unbroken, the tear-away (RVN-OWNERS-CHOICE). A host that cannot open the choice
  (`exterior.js`, no `fates`) lets a revenant die to any killing blow, the owner's Disintegrate too, as REVENANT-FATE
  always has: nothing there could judge a kneeling one.
- DECIDED here, named: the owner's Disintegrate kneels it past the stand and the will, rather than becoming a killing
  blow like any. As a killing blow like any it would make a rank 3+ revenant with an unbroken will stand, and the next
  one lose it to the smoke - the Disintegrate the arc wrote as the answer to both (Feud-Arc 14.2, 15.1) would be the one
  spell that cannot win the fight. This keeps that edge and takes only the delete.
- Not changed: a revenant already closed by a Disintegrate stays closed. Its record is `defeated` in the save, and
  nothing tells a Disintegrate's close from any other death there to reopen it.

THE FOUR HOSTS: world.js and worldModes.js - WIRED through exteriorFoes' one door (no host line); dungeonContext.js -
WIRED, its own door's yield gate edited in place (one line for one, no code line added: the host does not grow);
exterior.js - the same door, no `fates`, FLAGGED as in Feud-Arc 32 and `Field-Bugs-2026-10-16b.md` (its revenants die to
any killing blow; no net, so no peer's blow reaches it).

Pinned by `test/systems/revenant/fb1017g_rvnownkneel.test.js` (4): the report on the real street pool (the real
Disintegrate through the host's sink kneels it, Kill and Spare offered, Spare swears it); rank 3 with its will unbroken
(no stand, no tear-away, the kneel, then Kill's execution, the record executed, the trophy in the pile); a host with no
fates (it dies as before); and the dungeon's door mounted from its source over the real law (the owner's whole kneels at
rank 1, at rank 3 and once stood with its will unbroken; a party member's still stands and tears away; a room's shared
foe online and a door with no fates let it die). `tools/mutants/fb1017g_rvnownkneel.json` (6).

PINS MOVED (each marked PIN MOVED where it stands): `fb1016b_rvnownerschoice.test.js` (the owner's own Disintegrate on
the street, rank 1 and 3, and underground), `revenant_fate.test.js` (no door, no yield; the dungeon's gate as written),
`rvn4_stand.test.js` (BY RANK's Disintegrate; the dungeon's seam ahead of the will), `rvn3_weak.test.js` (THE WILL's
Disintegrate; the dungeon's will gate as written), `rvn6_band.test.js` (a death's scatter now a no-fates host's death; at
rank 5 the owner's Disintegrate kneels it, and the kneel scatters its kin). Mutant records re-aimed by content, because
the lines they named changed: five in `fb1016b_rvnownerschoice.json` (the two `whole-kill-withheld` now name the will,
the privilege the owner's kill keeps at the yield gate), `REVENANT-FATE-dies-as-before`, and RVN3's two
`kneels-unbroken`.

FLAGGED (as `Field-Bugs-2026-10-16b.md` flagged it): `audit24_lifetimes.test.js`'s proximity bound (`health <= 0`
within 4,200 characters of `releaseFoeBatch(f)`) stands at 4,170 in exteriorFoes' death arm - the door's comment was
tightened to keep it, not the bound moved.

What the reporter is owed: you were right - your own Disintegrate still deleted your own revenant, with no choice. It now
brings it to its knees - past its last stand and its will, as a Disintegrate always did - and Kill or Spare is yours.
Skulthor stays fallen: a record the old rule closed is not reopened.
