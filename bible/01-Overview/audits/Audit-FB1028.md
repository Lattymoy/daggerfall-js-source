# AUDIT FB1028 - FIELD BUGS 2026-10-28 read cold, 2026-10-28

The owner: *"Audit once everything is finished"*, of #1371 - FIELD BUGS 2026-10-28 (`../bugs/Field-Bugs-2026-10-28.md`):
TOWN-GROUND, WALL-FLICKER and BAY-WALLS with the yards' law. Three cold lanes read the head (`99bf30ce3`) against its base
(`2036a509e`), each in its own worktree with the freeware's data, each given the files and a brief, never a conclusion.
Each finding was proven on the real code - a probe on the real data, a test that fails at the head, or quoted lines -
before it was reported. #1371 merged and deployed while the lanes read (the owner: "Skip ci", "I want you to deploy
this"); the fixes are their own pull request.

| Lane | Read | Found |
|---|---|---|
| A | the town ground: every producer and reader of a town's height and outline, on every thread and launch; the ease on the real data past the two reported towns; online agreement; saved heights | 4 |
| B | the walls and yards: the merged cuts, doors, roads and gates over every walled city; the yards' law against the owner's rule; the hosts; the caches | 5 |
| C | the pins, the mutants and the record: what each assertion holds, survivors with and without ARENA2, every number, every claim, the gates | 10 and 6 minor |

## Lane A - the town ground

**A1 (should-fix). Saved heights were not moved with the ground.** The town blend moved DFU's own samples by more than 5 m
at 747 of the Bay's 3,444 town pixels and by more than 20 m at 147 (Chesterbrugh 291.8 m, Westhead Moor 55.2 m, Aldwall
Rock 37.8 m). A record keeps its height in DFU's frame (the classic blend), and `groundFrameHost.js` restandHeight moved
a record only past the Bay, so a camp, a pile, an anchor or a restored place written before came back off its ground.
GROUND_FRAME_LAW moves 3 to 4: a record stamped before 4 rides its town's blend's move at its spot (`landforms.js`
townGroundMovedField, today's blend less TS2's, kept in `terrain/townBlendBefore.js`), on the Bay and past it. #1371's
build stood today's ground and still stamped 3, so a record it saved is moved only when it stands nearer the old ground
than today's (`groundFrameHost.js` townMove).

**A2 (should-fix; kept, a trade-off recorded).** Where a town's own ground reaches a pixel's edge band, the
ground stays flat to the band and the edge sample is the land's: Sentinel falls 47 m in two samples with the Landforms
row off. The base eased the town's own ground there instead, and its blocks stood off it (Town-Shapes TS2, FB1028). Online
the row's site levelling hides Sentinel's. Changing it moves the ground again, so it waits for a release that moves the
relay anyway.

**A3 (minor; kept).** A sample's reach is read off its own height, so beside tall relief the eased ground can fall where
the land rises: a synthetic 300 m hill took a 13 m pit on its flank. On the Bay's data the reversals stand below the
base's (the worst 11.0 m against 17.3 m). It waits with A2.

**A4 (should-fix).** The ground's print read no town, so its cells were the same at GROUND_LAW 2 and 3 and the gate could
not have failed for this change. The print reads a town now, on a hillside stamped into its copy of the synthetic world; TS2's 12-sample ease moves it
8.9 m, so `fb1017f_groundgate` fails on it.

## Lane B - the walls and the yards

**B1 (recorded).** Past the Bay, 11 of 306 sampled yards moved though their places were not broken: the yards read the
new town-ground mask and the ring painted round it. The Bay's yards hold (84 of its 410 yard towns sampled, none moved).
Holding the land past the Bay, which #1184 opened that morning, needs the ring painted twice; not done.

**B2 (should-fix).** gateFurniture paired the template gates with every gate by bearing, so a street's gate could take a
road gate's boards and carriage: 21 road gates stood bare in 26 of the 55 cities with a street gate (Naresa, Menakat).
Road gates pair first now.

**B3 (minor; recorded).** Three street gates open onto open land with no road out (Naresa, Akhahanu, Menakat).

**B4 (record).** The moved yards were miscounted (52 for 50); corrected.

**B5 (the owner's rule).** A yard whose pad touched a tower grown 0.1 m was counted broken and moved, though it stood
1.5 m clear. A kept yard's pad may touch the wall's growth now; its own ground may not. Re-run on the 23 cities: the 19
"against a grown tower" stand on their #1184 cells, and Puweyn's stable with them (B2). Knightsgate's, Issaqumbaa's and
Syra-Kom's stables still move 1 to 4 cells: the yards read the gate furniture as it stands, and holding them needs a
second layout of it. Now 1,203 of 1,258 yards stand where #1184 stood them; 55 moved, 52 of them broken.

## Lane C - the pins and the record

**C1 (must-fix).** The host's re-placement of a broken yard was unpinned: handing the kept-yards step the yards' own shut,
or no shut, lived. A test runs pixelBuild's and townPlacesFor's own lines on a stub town now; both die without ARENA2.

**C2.** The wall-flicker list's records: FB1028-mitre-gone and -mitre-every-face are equivalent (mitreEnds cuts on the
same plane; none of the 410 walls changes), recorded with why; FB1028-reach-short stays equivalent, its evidence added.

**C3.** The synthetic bends' towers had no `thick`, a shape no producer mints, so the merge's `across` fix lived without
ARENA2. Their towers are grown as wallPieces grows them, and a three-degree bend added.

**C4.** Every yards mutant died on ARENA2 alone, so CI could not fail the yards' law. Synthetic pins hold yardRoads,
yardPieces, the yards' shut and keptSitesSteps; the 37 walls mutants die without ARENA2.

**C5.** The ground's print (A4).

**C6 to C10 and the minors (record).** The moved yards 50, not 52. The doors measured again: 7,169 of 32,779 stood inside
a tower's body (21 of Daggerfall's 106). The wall's cost: 10.6 per cent more triangles, about seven times as long to make.
The ledger's stale clause replaced. Towns past the Bay moved too. The test counts, the 7's population, yardWalkShut's
home, TS-the-edge-moved's aim and audittesa3e1's pin corrected.

## The fixes

Each fix carries an `AUDIT FB1028 <id>` comment and is pinned by a test that fails on the code as it stood, with mutants in
`tools/mutants/fb1028_walls.json` and `tools/mutants/fb1028_townground.json`. They ship in their own pull request, after
#1371 deployed.
