# Systems

ACTIVE - see `Systems-Arc.md` for the live record. S1-S22 SHIPPED (effects
and the spell/effect library, chargen, biography, items and equip, loot,
containers, talk, crime and the court, rest and recovery, diseases, poisons,
the Cure family, concealment, FreeAction) plus the economy sub-arc E1-E3
(shop templates and stock, the shelf mount, selling, the guild bookshelf, the health status box), plus ORL1's OBLIVION-REMASTER-LIKE LEVELING - the alternative leveling system a character chooses at creation, plus the DWARVEN THUNDERLOCK (`thunderlock.js`) - the port's own weapon, the first item in this port that Daggerfall does not have, with its two custom templates and the Dwemer Pellet it spends, and `appRoot.js` - the SITE ROOT off a module's own URL, which MAP-FIELD found the hard way on the held map and AUDIT-THUNDERLOCK F7 found again on the weapon's art. 185 modules live under
`src/systems/`. Items still routed here are collected in
`01-Overview/Port-Ledger.md` section C; scope in
`01-Overview/Port-Doctrine.md` phase plan.

AUDIT 18 rewrote this page: its opening paragraph declared the arc
unstarted, with the Readers/World prerequisites its only news, through the
whole S and E arcs. A section
index nobody opens goes stale silently, so
`test/audit18_bible_docs.test.js` now fails if a section index says "Not
started" while its own `*-Arc.md` records a SHIPPED slice.

## HT1 - HANDHELD TORCHES, THE MOD, 1:1 (2026-09-14, Mac's call) - SHIPPED

Mac: "Next mod to integrate 1:1 is this." The whole account is
`Handheld-Torches.md` beside this file; the ledger row is Port-Ledger A.
The short of it: RedRoryOTheGlen's Handheld Torches 1.4.1 - four
MonoBehaviours in a compiled DLL read off the IL method by method -
ported into `systems/handheldTorches.js` (the component the weapon rig
runs beside the Weapon Widget clone: the hand law over the player's
light, the ignite / drop / throw keys as Unity KeyCode names through
`systems/keyCodes.js`, the first-person hand sprite on Weapon Widget's
Bob and Inertia laws) and `scenes/droppedTorches.js` (the pool each of
the five hosts owns: the dropped and thrown torches burning on the
world clock, picked back up, saved; the foe set alight with DFU's own
Continuous Damage-Health and the mod's light and flame riding it). The
mod's 39 textures are vendored - the author's own art, not a render of
ARENA2. TextKey and the two Tuple kinds are new to the Mods pane. Under
the Morrowind arms the law runs and the held torch is the classic
lane's; a Morrowind LIGH mesh on the `torch` animation group pends
Mac's word. Pins: 19 in `test/ht1_handheldtorches.test.js`. Not
filmed: a game.
