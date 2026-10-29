# AUDIT FB1029 - FIELD BUGS 2026-10-29 read cold, 2026-10-29

The owner: *"Audit this"*, of BRIDGE-ENDS and GRAVE-PACK (`../bugs/Field-Bugs-2026-10-29.md`). Three cold lanes read the
head (`52b6d5b4d`) against its base (`c1f7101c0`), each in its own worktree with the freeware's data, each given the
files and a brief, never a conclusion. Each finding was proven on the real code - a probe on the real data, a test that
fails at the head, or quoted lines - before it was reported. The fixes are on the same branch: B in `ee7626af5`, A and C
after it.

| Lane | Read | Found |
|---|---|---|
| A | BRIDGE-ENDS as the game runs it: the real ground, the motor, the render, what stands there, caches, the same fault elsewhere | 2 should-fix, 3 minor |
| B | GRAVE-PACK as the game runs it: the real Crypts of Wickfield, every caller, every mode, online | 2 should-fix, 2 minor |
| C | the pins, the mutants and the record: own mutants, every number and claim, the gates | 6 should-fix, 6 minor |

## Lane A - the bridge ends

**A1 (should-fix). A walker stalled at each abutment.** Its top stood 0.35 m over the street, and the collider's
step-up (`collider.js` _moveStep) never lands on a top between about 0.335 and 0.355 m. On the game's motor at Speed 30
and 50, over half of the run-ups from 2 to 12 m stuck there; running, a horse or a jump got on. The old deck's end had
the same edge. FIXED: the abutment's top is a ramp from 2 cm over the street to the deck's end, about 3 degrees. Pinned
by driving the real motor from both banks of both bridges (`fb1029_bridgeends.test.js` A1).

**A2 (should-fix). The town's walkers walked inside the abutments.** The walkers stand on the terrain
(`pixelBuild.js` personGroundY), and nothing closed their grid under the abutments: on the north bank the cells were
Daggerfall's road, the cheapest ground. FIXED: `world/capitalWalks.js` carveCapitalWalks closes a capital's listed
works on the slice's grid, beside the yards' carve. Pinned on a synthetic grid and on the real blocks (ARENA2).

**Minor.** A6-3's leave covered the whole bridges model; now only the abutments' rects (`alinorAbutments`). The record
named only Alinor's quay; Torval's and the Waterfront's stand past the same slope, unreachable from the street, and are
recorded, not changed. "A 6.4 m dip" read as a depth; it is a metre deep across a 6.4 m tile.

Sound: the gap closes at all four ends across the deck's width; nothing of Daggerfall's stands within 0.5 m of an
abutment; no ship berths in the river; no coplanar faces with the ground; custom models are cached in memory only.

## Lane B - the graveyard's pack

**B1 (should-fix; online). A pack owner below blocked the party.** Keeping the pack while its owner was in the crypt
kept the party pose's "standing" true, but a door handover (`exteriorFoes.handOver`, a peer in sight) had dropped its
beasts from the owner's pool. A mate was told the party was already on the trail, and a second pack stood when the
owner came out. FIXED: an open-air pack is judged by the street's pool in every mode (`foePool`'s `open`), so it is kept
while its beasts stand and let go when they were handed off.

**B2 (should-fix). The dungeon hunt's pool was unpinned.** Pinned: a dungeon pack kept while its beasts stand below,
stood again when a load took them.

**B3 (minor). WILD-ALERT read the graveyard's pack as a town's foe**: no mark, no fast traveller's gate, no stealth
check. FIXED: the beasts carry the hunt's place (`bountyPlace`), and the three rect tests read it.

**B4 (minor).** bootWorld grows one logical line, under its ceiling; the comments' wording.

NOT CHANGED, before this branch: bounty beasts handed off at a door count for nobody, and go to any peer in sight.

Sound: on the real block from every start the pack stands, never in solid geometry; no graveyard's rect meets another
location's; every other caller of the rect test and the camp's stand is unchanged.

## Lane C - the pins, the mutants and the record

**Should-fix.** S1: the abutment's body was unpinned (a floating slab passed); its sides and ends are pinned down into
the ground now. S2: the street's pool was pinned for graveyard packs only; an open-ground pack through another dungeon
is pinned too. S3: "from its arrival nothing ever stood" - it stood one try in six; reworded. S4: AUDIT TESA II C10's
lane still starts at the deck's end - kept, with why beside it: its 9 m now begins on the abutment, the ground a walker
meets unchanged. S5: the record said six threads and listed two; it lists the five. S6: GRAVE-PACK's moved pins are
recorded.

**Minor.** The ARENA2 automap check reads the model's own rects; the parapets' height is pinned exactly; the rect law
pins a place's rect over its pixel's edge; a test title's mutant list; the record's "6.4 m dip"; bootWorld's line.

Sound: every number re-measured on the freeware (the metre's drop, 1.35 m, ARMRAL02 and FIGHGL00, Anticlere 302 at
(504, 146), 307 m, 16%); every gate green; the five new tests fail on the base. The DISC19-D survivor in `disc19.json`
predates this branch.

Tests `test/world/fb1029_bridgeends.test.js` (4), `test/scenes/fb1029_gravepack.test.js` (7). Mutants
`tools/mutants/fb1029_bridgeends.json` (16: 15 dead, 1 recorded equivalent), `tools/mutants/fb1029_gravepack.json` (18,
all dead).
