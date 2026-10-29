# AUDIT IC-BACKYARD - IC-BACKYARD read cold, 2026-10-29

The owner: *"Audit this"*, of `21bb7fe81a` - IC-BACKYARD (`../../03-World/Arena-Provinces.md` IC-BACKYARD): an Imperial
City house's yard is the court behind it. Three cold lanes read a frozen worktree of that commit, each given the files and
one brief (what to hunt, how to prove it), never a conclusion. Each finding was proven on the real code - a probe, a
test that fails at the head, or quoted lines - before it was reported, and proven again here before its fix.

| Lane | Read | Found |
|---|---|---|
| L | the law: every yard of all 19,994 of the city's own cells against what the cells draw (walls, sheds, wells, buildings), pairwise, and the court each picked; the frames, the turn, the cost | 6 |
| P | the player's view: the real free camera flown from the door through the fabric's faces, every reader of a lot, strangers' yards, old pieces, the service | 6 |
| T | the pins, the mutants (6 more of its own run) and the record: every claim measured again | 10 |

Twenty-two found, three of them twice: T1 is L1, P1 is L5, P5 is L4. Every defect is fixed or its record corrected; two
older gaps it met are recorded, not this change's. Each fix carries an `AUDIT IC-BACKYARD <id>` comment and is pinned in
`test/world/worldWide/ic_backyard.test.js`, with mutants in `tools/mutants/ic_backyard.json` (26, all dead).

## The law (L, and T1)

**L1 = T1 (HIGH). Two yards shared ground.** The yard took the court over a point behind its back wall and parted it at
that court's mitres, never asking whether the wall stood on that court's edge. Where two neighbourhoods meet, one's
houses stand in the other's court (their back walls 6 to 11 m off its edges); two of them picked the same edge and the
mitre parted nothing - 34 pairs city-wide, up to 62 m2 shared, and 40 yards ran past the court they picked. Now a yard is
the ground nearer its own back wall than any other building standing before that wall's line, by 0.4 m: parted alike by
every house, no two meet, and no court is picked.

**L2 (MEDIUM). The fabric's ground read court inside sheds and walls.** A cell laid a block's court where the court
neared it, but its walls, sheds and wells only where the block's corners did - a long block's (a polar far ring's) court
stood in a cell without them, 61 yards in a drawn wall, shed or well. A piece now joins every cell its ground reaches
(`imperialFabric.js` makeCell); a tree or a yard no longer stands in one.

**L3 (MEDIUM). Half the polar houses had no yard.** A court is laid as four chords; a polar block's outer houses stand
on an arc and an organic one's on a warped line, and the strip between them and the chord read as street - 434 of the
Arena District's 913 houses with one street front lost their yard to it, 278 of Talos Plaza's 729. A court on the
ground (`lawn`) is laid out to the line its back walls stand on (`imperialFabric.js` courtGround); the skyline keeps the
chords.

**L4 = P5 (LOW). A yard ran under a well's roof** - its roof 1.4 m out along x at 2.8 m, its ground's pad 1.2 m: 4,173
yards. A yard now keeps a well's roof clear (`WELL.eave`, `WELL.ridge`, named for the model that builds it).

**L5 = P1 (LOW). Every yard was surveyed as it was stood** - a stranger's too, whose lot nothing reads: 97 ms a frame for
ten decorated houses, 424 ms for a hundred. A lot is worked when first read: the owner's, at its door.

**L6 (LOW). The record** claimed the old sweep's "none meeting another" and named no town past the Bay. Corrected (below).

## The player's view (P)

**P2 (MEDIUM). Nothing said where the yard is.** From the door the owner sees the street, and a piece there is "Outside
your lot": 0 of 120 marked edges in sight over 30 houses. As the decorator opens on a lot away from its door, a line says
the yard is the court behind the house and to fly over the roof (`decor.yard.behind`, drafted in 25 languages).

**P3 (LOW). Pieces stand where they were placed**, and the yards come from the fabric's law: a change to either moves
the ground under them. The PATCH's yards are pinned as built (their count and their ground), so a change says what it
does to them.

**P4 (LOW, RECORDED). A court's trees stand in about a fifth of yards** (267 of 1,319 sampled). The yard ignores them as
a Bay lot ignores a town's trees.

**P6 (RECORDED). The Waterfront's warehouses stand in rows**, each with a street on two sides: few yards there, as the
patch notes say of such a house.

Checked sound by P: the free eye flown from the door over the real roofs placed 207 of 210 targets, 39.4 m from its
start at most; `lot.y` is the ground's; a turned lot read only where it must be; the midline skipped where no other
home's frame stands; the service's 48 m bound; an old client keeps the door's box.

## The pins and the record (T)

**T2 (MEDIUM). No yard's size was pinned** - lane T's mutants keeping the first rectangle (a third of the ground) and
halving the reach both lived. Pinned: the PATCH's yards as built, and the house the reach cuts reaching past 30 m.
**T3 (LOW)**: the gap between yards (now: none within 0.25 m) and a road under a turned lot pinned; the near edge's walk
changed no yard measured, and stays the law's fourth edge. **T4 to T7 (LOW)**: the record's mutant counts, "one yard
in 5,424" (5,424 buildings, 3,273 yards), "two of 12,506" (a sample, one of them a corner house) and "a third less on
the world's axes" (a quarter, measured against the biggest such box) - each corrected. **T8**: the pull request's
placeholder. **T10**: a refusal asserted exactly.

## Met, not this change's (recorded)

- **T9.** `test/world/fb1009_yardfoot.test.js`, "a point 2 m inside every door is still the house", fails with ARENA2
  (2842 !== 0) on main and at the commit that added it (`34584a5c09`); CI runs no ARENA2. Its own fix.
- **P.** The yards' host hands the decorator a collider without `_resolveSphere`, so its skin push (DECOR-SHELL) never
  runs outdoors; the flights placed through it all the same. Its own fix.
