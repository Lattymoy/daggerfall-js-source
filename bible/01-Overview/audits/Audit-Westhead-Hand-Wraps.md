# AUDIT WESTHEAD-NORTH and HAND-WRAPS - read cold, 2026-10-29

The owner: *"Audit this"*, of WESTHEAD-NORTH (Westhead Moor's shipyard back on the north side,
`../bugs/Field-Bugs-2026-10-28.md`) and HAND-WRAPS (`../../05-Combat/Hand-Wraps.md`), the day they were written. Four
cold lanes read the head (`278aa3134`) against its base (`5995d0bb9`), each in its own worktree with the freeware's
data, each given the files and a brief, never a conclusion. Each finding was proven on the real code - a probe on the
real data, a mutant that survives, or quoted lines - before it was reported.

| Lane | Read | Found |
|---|---|---|
| A | WESTHEAD-NORTH: the placing, the host, the cache, both layouts on the real data, the walk, the pins | 5 |
| B | HAND-WRAPS, the fight: every reader of the weapon, both cores, the loot and the relay, the wire | 11 |
| C | HAND-WRAPS, the glow: the classic hands, the Morrowind arm in both views, gloves, peers, the renderer | 5 |
| D | the pins, the mutants and the record: the whole suite, every survivor, every number and claim | 7 |

## Lane A - WESTHEAD-NORTH

**A1 (must-fix).** `test/systems/shipyards1_found.test.js` pinned the host's line before the row was handed, and failed
at the head. PIN MOVED (WESTHEAD-NORTH): it reads the row's argument.

**A2 (must-fix; the owner's call).** The row was handed in every layout, but its cell was measured on Daggerfall's. In
Beautiful Cities' layout (on by default, and online) it stood the shipyard 176 m inland, in a pocket nothing reaches.
Asked, the owner chose "North in both layouts". `PORT_PLACES_NEAR` holds a row a layout, and `portPlacesNear` hands a
town the row of the layout it stands in. Beautiful Cities' row stands it on the north farmland nearest its old place
(265, 413), on today's ground; Daggerfall's row there would stand it inland, and a test holds that.

**A3 (should-fix; the owner's call).** In Daggerfall's layout the north wall has no gate, so the walk from the north
homes to the yard is as long as to TS7's west place. The owner kept the walk: the wall stays whole.

**A4 (should-fix).** Four mutants survived: the cache's key a flag without the row's value, the unkept path without the
row, the distance squared, and the road's cost skipped for a near place. The wall check counted the south wall too. Each
is pinned now, and the wall check counts the rows between the town's last blocks and the yard.

**A5 (minor).** The docs did not say the row: `03-World/Shipyards.md`, `03-World/Town-Shapes.md`,
`07-Rendering/Performance-Priority.md` and `world/portSites.js`'s header say it now.

## Lane B - HAND-WRAPS, the fight

The root cause of most of the lane: the wraps left the blow only inside `calculateAttackDamage`, while
`PlayerWeapon.weapon` handed them to about ten other readers as a weapon. Now `handItem` answers null for them, so every
reader sees a fist, and `wrapsOf(hand)` and `wraps` name them beside it.

| # | Finding | Verdict |
|---|---|---|
| B1 (must) | The siege's work refused a blow in wraps (its cap read template 563 as 0) | fixed: no weapon, and `duelWeaponOf` null for them |
| B2 (must) | The loot door's law did not move, so an older build in a room's seat dropped a pair | fixed: `LOOT_HELLO_LAW` 2, relay world289 (world286 on the branch) |
| B3 (must) | Bladeturning and Stoneskin read a fist in wraps as a blade | fixed |
| B4 (must) | A Rare pair's imprint, a Legendary pair's power and a won sigil never fired | fixed: they ride the fist's blow |
| B5 | In PvP, armour stopped a wraps blow as an edged one | fixed by B1 |
| B6 | A foe's wind-up read the wraps as a sword | fixed |
| B7 | The swing was silent, the hit and a zero-damage blow a weapon's sounds | fixed |
| B8 | Plain wraps hid a Gauntlets' technique line | fixed by the root cause |
| B9 | The page said the wraps never lose condition | the page corrected: an enchantment's use wears them |
| B10 (minor) | The Stats page read the selected hand alone | fixed: an empty fist beside them wears them |
| B11 (minor) | Five mutants survived (PCAAO's modifiers, the leech, the estimate, the law's import, `handItem`) | each pinned |

One step past the lane's fix: the loot powers' `armed(p)` gate, first written for B4, was dropped. Every power of those
kinds is a weapon's, and `blowPowers` already limits a wraps blow to the wraps' own, so the gate only refused a pair that
carried the same power as another worn weapon.

## Lane C - HAND-WRAPS, the glow

**C1 (must-fix).** Hands in gauntlets or gloves never glowed: a glove's range is named `right hand (<record>)`, and the
match read a part name no piece carries. `inGlowSlot` now matches the names the rig gives. Pinned on the rig the game
builds, in the port's own steel gauntlets, first and third person.

**C2 (should-fix).** With two pairs, the Morrowind arm lit neither hand when the right pair was plain; a peer with the
wraps in the left hand never glowed. The arm has one glow for both fists: the first pair that glows, right hand first.
A peer's body reads it from either hand. A glow for each side was not built: the arm draws both hands in one pass.

**C3 (should-fix).** Six mutants survived: both meshes' glow unset, the climb unread, the sprite pass's gate blind to the
hands, the peer's switch unread, `handItem`'s gate. `test/combat/handwraps_arm.test.js` draws the real rig through a
capturing renderer and the renderer on a logging GL.

**C4 (minor).** The glow showed mid-swap from a blade and with a sheet held up. It now waits for the empty hand's key and
stays off behind a sheet. Drawn fists put the torch away, so it never lights one.

**C5 (minor).** The wraps kept the running hands off. They leave the hands empty now, and the run draws their glow.

## Lane D - the pins, the mutants and the record

| # | Finding | Verdict |
|---|---|---|
| D1 (must) | The suite was red in 8 files: the account deploy's path filter, the realm's registrars, the L10N4 ratchet, MAC-N1's text pin, TRADE-KNOWN's seeded roll, A1's host pin | fixed; the wraps' name and lore counted in L10N4 as the Pistolet's are; MAC-N1's span PIN MOVED; TRADE-KNOWN's roll moved (the weapon roll draws over 20 templates now, as DFU's `Range(enum + custom)`) |
| D2 (must) | A glove's hands never glowed | C1 |
| D3 | The Strikes payload, the leech and slayer lines, PCAAO, both meshes and three gates had no pin that fails | each pinned; the payload by behaviour (Potent Vs on a fist) |
| D4 | Two Westhead mutants died only with ARENA2, which CI has not; the key a flag survived | pinned without ARENA2: all 16 die without it |
| D5 | The records called Daggerfall's row the old cell | corrected: it is an aim on the strip; the old corner pulls the yard back west |
| D6 | No Active-Arcs line; WESTHEAD-NORTH named no hosts | added; THE FOUR HOSTS named in the field bug's record |
| D7 (minor) | A count in the draft, the row's price called a Dagger's, `handWraps.js` unnamed in Systems.md | the first two corrected; Systems.md's paragraph is over its plain-text baseline, so the Ledger and Active-Arcs name it |

## Verification

`test/world/westheadnorth.test.js` (5), `test/world/westheadnorth_bc.test.js` (DELETED) (1, ARENA2),
`test/combat/handwraps.test.js` (7), `test/combat/handwraps_arm.test.js` (4), `test/combat/handwraps_audit.test.js` (7).
Mutants: `tools/mutants/westheadnorth.json` 16, all dead with ARENA2 and without it, and `tools/mutants/handwraps.json` 55,
all dead. 21 records in other lists named lines these fixes rewrote; each was re-aimed by content and dies.
